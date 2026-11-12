# NetLab Explorer 事件与状态模型设计（第三阶段交付）

> 版本：V1.0（2026-11-12）
> 定位：固定动画的演示数据模型。**不是网络模拟器**：所有事件、报文、状态变化都是预先定义的静态数据，引擎只负责调度播放，不做任何协议推演。
> 配套：`docs/data-model-design.md`（总体分层）、`docs/sample-demos/`（三份验证样例）、`docs/validation-rules.md`。

---

## 一、Topology（拓扑与广播域）

```ts
interface Topology {
  layout: { view: 'network' | 'stack'; note?: string };  // 渲染视图声明
  participants: Device[];                 // 任意数量，不再固定 4 个
  domains: BroadcastDomain[];             // 广播域（VLAN/链路段）
  links: Link[];
}

interface Device {
  id: string;                    // 'laptop'、'gateway'、'dns-root'…全 demo 内唯一
  label: string;                 // 展示名，如 '笔记本电脑'
  role: 'host' | 'switch' | 'router' | 'server' | 'resolver' | 'gateway' | 'ap';
  kind: 'laptop' | 'router' | 'cloud' | 'server' | 'switch' | 'ap' | 'generic';
  address?: {                    // 展示地址（静态数据，不参与计算）
    ip?: string; mac?: string; port?: number; domain?: string;
  };
}

interface BroadcastDomain {
  id: string;                    // 'lan-a'、'vlan-10'
  label: string;
  members: string[];             // device id[]；广播范围由此推导，不在事件里枚举
}

interface Link {
  from: string; to: string;      // device id
  medium?: 'wired' | 'wireless' | 'virtual';
}
```

**为什么广播域放在拓扑而不是事件里**：广播的语义是「到达同链路层域内的所有设备」。如果每个事件手工列举收件人，拓扑一改（加一台主机）所有广播事件都要改，且容易漏。域是拓扑属性，事件只引用域名。

## 二、事件模型（DemoEvent）

### 2.1 核心定义

```ts
interface Step {
  id: string;                    // 步骤 id，如 'arp-request'
  title: string;                 // 步骤标题（对应现 data.js steps[0]）
  description: string;           // 逐步详解（对应 stepNotes，迁入）
  events: DemoEvent[];           // 本步骤全部事件（≥1）
  stateDeltas: StateDelta[];     // 本步骤状态变化（可空）
  traceRow?: TraceRow;           // 数据包流表格行（对应现 net.main）
}

interface DemoEvent {
  id: string;                    // 事件 id，步骤内唯一，被 dependsOn 引用
  kind: EventKind;
  from: string;                  // 发起方 device id。process 类也必须有（动作归属者）
  to: TargetSpec;                // 目标（联合类型，见 2.2）
  payload?: Packet;              // 报文内容；process 类无 payload
  timing?: { duration?: number; stagger?: number };  // 秒；stagger 仅广播泛洪时逐跳延迟
  dependsOn: string[];           // 依赖的事件 id[]；可引用同步骤或【更早步骤】的事件（必须严格在前）
  note?: string;                 // 该事件的一句解释
}

type EventKind =
  | 'unicast'    // 单播传输：from → to 指定设备，动画画一条点对点路径
  | 'broadcast'  // 广播传输：由 domain 推导接收者集合，动画画扇出泛洪
  | 'multicast'  // 角色多播：域内满足 filter 的子集，动画画扇出
  | 'process'    // 本地处理：不产生报文（查缓存、查路由表、状态迁移、超时判定）
  | 'drop';      // 丢弃/丢失：报文在某处终止（故障场景、TTL=0）
```

### 2.2 TargetSpec：from / to 的类型与语义（回应「不能只加 to: string[]」）

```ts
type TargetSpec =
  | { kind: 'device'; id: string }                        // 单播：恰好一个接收者
  | { kind: 'broadcast'; domain: string;                  // 广播：域内除 from 外全部
      excludeFrom?: string[] }                            //   可排除个别设备（如自己）
  | { kind: 'multicast'; domain: string;                  // 多播：域内按角色过滤的子集
      roleFilter: Device['role'][] }                      //   如 OSPF hello 只到 routers
```

| 问题 | 设计回答 |
|---|---|
| `from` / `to` 的语义 | `from` 是事件的**发起者**（即使 process 类无报文，也标明动作归属设备）；`to` 是**目标集合描述**，不是收件人名单 —— 接收者集合由引擎按拓扑推导 |
| 广播 vs 单播的区别 | 数据上：`kind` + `TargetSpec.kind` 双重标记；行为上：单播画一条线，广播按域成员画扇出（N 条弧），接收者集合随拓扑变化自动更新 |
| 广播域内接收者 ≠ 实际响应者 | 广播事件的语义是「**可见**」，不含「**应答**」。谁应答，由后续独立事件表达：目标设备发一条 `unicast` 回包，`dependsOn` 指向广播事件。**不设 `responder` 字段**——响应是显式事件，不是广播的属性（详见 §3.3 与 ARP 样例） |
| 是否保留 `targets` 字段 | **不保留。** `targets`（枚举收件人）与 `to`（目标描述）是重复表达，必然漂移。接收者集合统一由 `to` + 拓扑推导得出，构建期校验器把推导结果算出来供核对 |

### 2.3 Packet（报文）

```ts
interface Packet {
  proto: string;                 // 'TCP' | 'ARP' | 'DNS' | 'ICMP' | 'DHCP' | 'OSPF' …
  summary: string;               // 表格「信息」列，如 'SYN: 49152 → 80'
  size?: number;                 // 字节（展示用）
  cat?: 'hand' | 'cdata' | 'sdata' | 'fin' | 'query' | 'response' | 'broadcast' | 'generic';
  fields?: Record<string, string | number | boolean>;  // 结构化字段：seq/ack/flags/opcode/qtype…
  layers?: { name: string; keyValues: Record<string, string> }[];  // 分层视图（可选，报文详情）
}
```

`fields` 是展示与核对用，**不是计算输入**。flags 用字符串数组（`['SYN']`、`['SYN','ACK']`）而非位运算，因为固定动画不做位计算。

**值域调整（M1 落地时确认，2026-11-12）**：字段值域由 `string | number | boolean` 扩展为递归的 `FieldValue = string | number | boolean | null | FieldValue[] | { [k]: FieldValue }`。理由：① `null` 是有语义的「字段在本报文中不存在」（如首个 SYN 的 `ack: null`），与缺省不同；② DNS 资源记录（`answers: [{name,type,rdata,ttl}]`）天然是结构化数组，扁平化会丢信息。详见 `docs/m1-implementation.md` §三。

## 三、执行调度：顺序、并行与依赖

### 3.1 依赖图与波次（waves）

一个步骤内的事件构成 `dependsOn` 依赖图（**必须无环**，且只允许引用同步骤或更早步骤的事件——校验器按场景级检查存在性与先后性）。引擎按**拓扑分层**推导执行波次：

- 第 0 波：`dependsOn` 为空的事件；
- 第 n 波：所有依赖都属于第 <n 波的事件；
- 同一波内的事件**并行**（视觉上同时开始）；波与波之间**串行**（上一波全部完成才开始下一波）。

**顺序事件 = 显式依赖链**（A→B→C 各自 dependsOn 前者）；**并行事件 = 同一波次**（依赖为空或指向同一前置）。不需要额外的 `parallel: true`、`order` 或 `at` 字段 —— 一种关系（依赖）表达两种语义，无隐式顺序、无歧义。

**确定性**：同一份数据永远得到同一波次划分。这是「单步回退靠重放折叠」成立的前提。

**调度规则（M0 审查约束落实，2026-11-12）：**

1. `dependsOn` 必须构成**无环**依赖图（校验器拓扑排序检测，validation-rules.md X4）。
2. **同波次事件不得依赖隐式数组顺序**：波次划分只由 `dependsOn` 决定；`events[]` 数组顺序仅影响绘制叠层，不得影响执行语义。校验器将以「打乱数组顺序重算波次」做一致性验证（X13）。
3. **没有依赖关系 ≠ 必然可以并行**——并行是引擎对"同一波次"的**显式调度规则**：同一波内事件由引擎同时启动播放；若两个事件语义上必须先后发生，数据必须写显式 `dependsOn`，禁止靠"数组里排在前/后"或"碰巧同波"来表达先后。
4. StateDelta 折叠（fold）为**纯函数**：不得修改演示数据原文；重复播放、多次折叠、打乱读取顺序都必须得到逐字段一致的结果（X14，实现时以 deep-freeze 单测断言）。

### 3.2 timing

`duration` 是单个事件的动画时长（秒）。波次 k 的实际结束时刻 = 该波所有事件 `start + duration` 的最大值。广播可用 `stagger` 做逐扇出延迟（纯视觉）。**不提供绝对时间 `at`**：绝对时间会把「协议顺序」和「动画节奏」耦合，迁移现有 TCP 数据时由引擎把现有时长换算成 duration。

### 3.3 接收者与响应者（ARP 样例验证的关键语义）

```
Step: 广播 ARP 请求
  events:
    e1 broadcast laptop → domain:lan-a        (接收者: switch/pc2/pc3，扇出动画)
  e2 process pc2   dependsOn:[e1]             (非目标，丢弃/忽略 → 无后续)
  e3 process pc3   dependsOn:[e1]             (同上)
  e4 unicast pc2 → laptop  dependsOn:[e1]     (pc2 是响应者：显式回包事件)
```

e2/e3 是「接收但不响应」的**显式记录**——数据里能看出谁收到、谁处理、谁应答，三者泾渭分明。这正是把 `targets` 枚举删掉后语义反而更完整的地方：接收者集合由域推导（完整、不漏），响应者由显式事件表达（准确、无歧义）。

## 四、StateDelta（状态变化模型）

### 4.1 定义

```ts
interface StateDelta {
  id: string;
  device?: string;                 // 状态归属设备；全局表（如 mac-table 汇总）可省略
  afterEvent?: string;             // 在该事件完成时应用；缺省 = 本步骤全部事件完成后
  changes: StateChange[];          // 原子变更集，一次 delta 内的变更同生共死
}

type StateChange =
  /* ARP 缓存 */
  | { table: 'arp-cache'; op: 'upsert' | 'expire' | 'clear';
      entry: { ip: string; mac?: string; state: 'incomplete' | 'reachable' | 'stale'; } }
  /* 交换机 MAC 表 */
  | { table: 'mac-table'; op: 'learn' | 'age' | 'flush';
      entry: { vlan: number; mac: string; port: string } }   // port: 'G0/1' 或 'CPU'
  /* TCP 连接状态（每设备每连接一条） */
  | { table: 'tcp-state'; op: 'set';
      entry: { peer: string; from?: string; to: string } }   // 'CLOSED'→'SYN_SENT' 等 RFC 9293 状态名
  /* OSPF 邻居状态 */
  | { table: 'ospf-neighbor'; op: 'set';
      entry: { peer: string; from?: string; to: 'Down'|'Attempt'|'Init'|'2-Way'|'ExStart'|'Exchange'|'Loading'|'Full' } }
  /* 通用表：DNS 缓存、路由表、会话表等未来需求，避免 schema 膨胀 */
  | { table: string /* 如 'dns-cache' | 'routing-table' */; op: 'upsert'|'remove'|'set';
      entry: Record<string, string | number | boolean> }
```

**为什么 four concrete + generic**：ARP/MAC/TCP/OSPF 四类是计划书点名的高频教学状态，结构化定义能让右侧「当前状态」面板直接渲染表格；通用表兜住 DNS 缓存、路由表这类长尾，未来新增状态类型不加 schema 就能先跑。

### 4.2 应用时机与恢复机制（重置 / 单步 / 重播）

**状态 = 对基线的纯函数折叠**：`state(i) = fold(initialState, deltas of steps 1..i)`。所有 delta 是纯数据、无副作用，fold 幂等且与路径无关（每个 delta 只描述「终态」，必要时带 `from` 供核对）。

| 操作 | 行为 |
|---|---|
| **前进到第 i 步** | 重放 fold(1..i)：状态面板显示 steps 1..i 所有 delta 的叠加结果 |
| **单步后退** | 不做逆向操作（逆向易错），直接重新 fold(1..i-1)。数据量小（每 demo 几十条 delta），重放成本可忽略 |
| **重置 / 重新播放** | 回到 `initialState`（scenario 声明，如 `laptop: CLOSED, server: LISTEN`），再按当前播放模式前进 |
| **场景切换** | 换 scenario = 换 initialState + delta 序列，整体重折 |
| **跳到任意步** | fold(1..k)，天然支持进度条拖拽 |

`afterEvent` 用于「状态在步骤中途变化」的场景（如 ARP：收到 Reply 的瞬间缓存就写入，而不是步骤结束才写）。引擎在事件完成回调里应用对应 delta；重放时按同样的事件完成顺序重折，保证一致性。

**不做**：状态推导/校验协议正确性（引擎不知道 `SYN_SENT → ESTABLISHED` 是否合法，那是校验器可选的规则检查，见 validation-rules.md §5）。

## 五、TraceRow（数据包流表格行）

```ts
interface TraceRow {
  time: string;        // 相对时间 '0.000'（展示用，保持现表格格式）
  src: string;         // 地址展示
  dst: string;
  proto: string;
  info: string;        // = 主要 payload.summary
  size?: number;
  cat?: Packet['cat'];
  lost?: boolean;      // 丢失行（现 .lost-row 徽标）
  eventRef?: string;   // 关联事件 id，表格行点击 → 步骤定位
}
```

现 `net.main` 七列数据整体映射为 `scenarios[].steps[].traceRow`，字段一一对应，无语义损失。

## 六、Scenario（场景）

```ts
interface DemoScenario {
  id: string;                    // 'main' | 'fault' | 'cross-subnet' …
  label: string;                 // 场景按钮文案
  initialState: Record<string, Record<string, unknown>>;  // 设备 id → 初始状态快照
  steps: Step[];
}
```

场景 = 初始状态 + 步骤序列。同 demo 多场景共享拓扑与设备。现有 `#normal/#fault` 双态、以及计划书要求的「服务端端口未监听 / SYN 丢失 / 跨网段 ARP」等扩展场景都能以新场景形式追加，不动模型。

**现站 `net.alternate` 备用时间线语义保留**（M0 约束）：M2 迁移 TCP 数据时，alternate 备用时间线不得删除，以 `traceRow.alternatives[]`（同一行的时间线变体，UI 切换）或独立 scenario 表达——M2 实施时验证哪种表达更贴合现有交互后定稿。

## 七、三份样例对模型的验证结论

见 `docs/sample-demos/README.md` 与 `docs/data-model-design.md` §7 矩阵。一句话总结：**TCP 验证顺序链与状态机、ARP 验证广播扇出与「接收≠响应」、DNS 验证多设备多跳与通用状态表；三者均未触发模型特例。**

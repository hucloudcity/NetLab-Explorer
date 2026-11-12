# NetLab Explorer 数据模型设计（第三阶段交付）

> 版本：V1.0（2026-11-12）
> 范围：**仅设计与样例验证，本阶段不迁移任何业务代码。**
> 前置：`docs/architecture-analysis.md`（现状分析）、`docs/tech-decisions.md`（四项技术决策）、`docs/network-knowledge-map.md`（九大模块 165 知识点）。
> 配套：`docs/demo-event-model.md`（事件与状态模型）、`docs/sample-demos/`（三份样例）、`docs/migration-plan.md`（迁移方案）、`docs/validation-rules.md`（校验规则）。

---

## 一、设计目标与不做什么

**目标**：为固定动画教学平台建立「知识内容层 / 演示数据层 / 来源台账层」三类分离的数据基础，支持多对多关联、多设备/广播/并行事件表达、设备与协议状态变化描述。

**不做什么**（本阶段与后续均不做）：

1. 不建设真实协议计算引擎（不做子网计算、路由计算、状态机运行时推理）。
2. 不做用户搭建拓扑、参数化实验（那是第二、三产品阶段的能力，模型只留扩展点）。
3. 不在本阶段引入 TypeScript 依赖与 Zod —— 规则先行，落地在迁移阶段 M1（届时 zod 必须在 package.json 显式声明为直接依赖，见 ADR-001）。

**总原则**：模型为未来扩展留空间，但不为未来阶段预付实现成本。

---

## 二、三类数据与总体分层

```
┌─────────────────────────────────────────────────────┐
│  知识内容层 knowledge/      教学正文（是什么/为什么/原理/误区）      │
│      │ knowledgeRefs[]                │ sourceRefs[]       │
│      ▼                                ▼                    │
│  演示数据层 demos/          拓扑/事件/报文/状态变化（纯数据）        │
│      │                                                     │
│      ▼                                                     │
│  通用演示引擎 engine/        播放控制·波次调度·状态折叠（代码）      │
│      │                                                     │
│      ▼                                                     │
│  可视化界面 renderer(SVG)    设备/链路/报文/状态展示             │
│                                                            │
│  来源台账层 sources/        十字段来源 + 授权状态（独立维护）      │
└─────────────────────────────────────────────────────┘
```

与现状的关键差异：知识正文目前寄生在 `mechanisms.js` 的 `sections`（与某次演示绑死）；演示脚本在 `data.js`（LESSONS）。新模型把三者拆开，目录规划（迁移阶段执行）：

```
content/
  knowledge/        # M01-network-basics.ts …（知识点数据）
  demos/            # tcp-handshake.json, arp-resolution.json …
  sources.json      # 来源台账
src/types/          # knowledge.ts / source.ts / demo.ts
src/schemas/        # zod schema（迁移阶段引入，显式声明依赖）
src/engine/         # 播放引擎（纯函数，可单测）
```

---

## 三、Source（来源台账）

来源是独立资源，供 knowledge 多对多引用。**来源的授权状态与知识点的发布状态是两回事，分开管理**（见第六节）。

```ts
/** 一条来源（台账主体，sources.json 的一条记录） */
interface Source {
  sourceId: string;              // 如 'rfc-9293'、'kr-9e-textbook'、'ieee-802-1Q'
  type: 'textbook' | 'rfc' | 'ieee' | 'vendor' | 'lab' | 'tool';
  name: string;                  // 如 'Transmission Control Protocol'
  author: string;                // 如 'W. Eddy (Ed.)' 或 'Kurose & Ross'
  version?: string;              // 如 'RFC 9293' / '9th Edition' / 'IEEE 802.1Q-2022'
  url: string;                   // 官方地址（禁止第三方镜像，见 ADR-003）
  licenseStatus: LicenseStatus;  // 授权状态，独立于任何知识点的发布状态
  licenseNote?: string;          // 如 '付费标准：仅可指认编号，不得引条款正文'
  addedAt: string;               // ISO 日期
}

/**
 * knowledge 对某条来源的一次「引用」（多对多的连接记录，属主在 knowledge 一侧）
 * 目的与章节因知识点而异，所以引用关系单独建模，不塞进 Source 本体。
 */
interface SourceRef {
  sourceId: string;              // 必须存在于 sources.json
  purpose: string;               // 该来源用于核对什么，如 '核对 SYN/SYN-ACK 标志位与状态迁移'
  sections: string[];            // 具体章节/条款，如 ['3.5.1']；禁止凭空填写（计划书 §5）
  checkedAt: string;             // 最后核对日期（ISO），必填
  verificationNote?: string;     // 核对方式说明，如 '对照 Wireshark 抓包验证'
}

type LicenseStatus =
  | 'public-standard'        // 公开标准（RFC）
  | 'paid-standard'          // 付费标准（IEEE）：只引用编号/标题，不引正文
  | 'copyright-textbook'     // 教材：原创表述，不复制正文/插图/习题
  | 'vendor-copyright'       // 厂商文档：不搬运受版权内容，仅作工程核对
  | 'open-source-permissive' // BSD/MIT/Apache 等
  | 'open-source-copyleft'   // GPL 类：只使用不合并
  | 'per-file-review'        // 逐文件授权未核实（如 Wireshark 样本抓包）
  | 'pending';               // 尚未核查
```

**为什么 SourceRef 单独建表**：同一条 RFC 9293，TCP 握手知识点引用 §3.5.1、TCP 状态机知识点引用 §3.5.2 —— 引用的目的、章节、核对日期随知识点变化；把 `sections` 塞进 Source 会导致一条来源只能服务一个知识点。这就是「多对多」的第三张表。

---

## 四、Knowledge（知识点）

对应 `docs/network-knowledge-map.md` 的 165 个知识点（ID 规则 `NET-MM-NN`），逐条扩展为下述结构：

```ts
type ModuleId = 'M01'|'M02'|'M03'|'M04'|'M05'|'M06'|'M07'|'M08'|'M09';

interface KnowledgePoint {
  id: string;                    // 'NET-MM-NN'，全库唯一
  title: string;
  categoryId: ModuleId;
  level: 'basic' | 'intermediate' | 'advanced';

  /* 六问正文（对应计划书 §6.1 基础内容模板） */
  summary: string;               // 一句话介绍
  what: string;                  // 是什么
  why: string;                   // 为什么需要它 / 解决了什么问题
  principle: string;             // 工作原理（原创表述）
  practicalScenario: string;     // 实际网络中如何使用
  commonProblems: string[];      // 常见错误理解

  packetStructure?: PacketStructure;  // 报文/帧结构（可选，见下）

  /* 多对多关联 */
  relatedKnowledge: string[];    // 关联知识点 id[]（双向关系只登记一次，构建期生成反向索引）
  sourceRefs: SourceRef[];       // → 来源台账（第三节）
  demoRefs: string[];            // → 演示数据 id[]（一个知识点可挂多个演示，一个演示可服务多个知识点）

  labId?: string;                // 交互实验 id（本阶段不做实验，仅占位）

  /* 管理字段 */
  accessLevel: 'free' | 'pro';   // 商业化预留（Open Core，见计划书 §8）
  status: ContentStatus;         // 发布状态（见第六节）
  contentState: ContentState;    // 版权状态（原创/改编/第三方）
  createdAt: string;
  updatedAt: string;
}

interface PacketStructure {
  description: string;           // 文字描述，如 'TCP 首部 20~60 字节…'
  layout?: { field: string; bits: string; note?: string }[];  // 字段表
}

type ContentStatus = 'draft' | 'review' | 'published';
type ContentState  = 'original' | 'adapted' | 'third-party' | 'permission-required' | 'license-verified';
```

**字段依据**：`what/why/principle/…` 对应计划书 §5 十字段与 §6.1 模板；`demoRefs` 解决「知识正文寄生在 mechanisms.js」的问题；`accessLevel/status/contentState` 对应计划书 §8 版权与商业化要求。现 `data.js` 里的 `nodes/steps/net` 属于**演示数据**，一律迁出 knowledge，进入 demos（见 demo-event-model.md）。

**多对多的实现约定**（避免双向同步漂移）：

- `knowledge → source`、`knowledge → demo` 的关系**只登记在 knowledge 一侧**。
- 反向索引（某 demo 被哪些知识点引用、某来源支撑哪些知识点）由构建期校验器生成，不落盘。
- `relatedKnowledge` 同理：登记时只写一侧，校验器检查两侧互指一致性（也可只单向）。

---

## 五、Demo（演示数据）——概览

演示数据是**纯数据**：拓扑、参与设备、报文、事件序列、状态变化。不含播放逻辑、不含渲染代码。完整结构见 `docs/demo-event-model.md`，此处只给骨架和设计要点：

```ts
interface Demo {
  id: string;                    // 'tcp-handshake'
  title: string;
  protocol: string;              // 'tcp' | 'arp' | 'dns' | …（用于归类与渲染分支）
  knowledgeRefs: string[];       // 仅作冗余说明字段？——否，见下「反向关系」
  topology: Topology;            // N 个设备 + 广播域 + 链路（不再固定 4 个）
  scenarios: DemoScenario[];     // 多教学场景（主流程 / 故障 / 变体）
  view?: { kind: 'network' | 'stack' | 'timeline' };  // 渲染视图类型，渲染器按 kind 分支
}

/** 反向关系：demo 不持有 knowledgeRefs。被哪些知识点引用由构建期反向索引得出。
 *  理由：关系唯一属主是 knowledge.demoRefs，demo 侧再存一份必然漂移。 */
```

要点（全部在本阶段三份样例中验证）：

1. **参与者数量不固定**：`Topology.participants[]` 任意个；渲染器按设备 `id` 查位置，位置表改为按 `layout` 声明或自动布局（迁移阶段 M4 解决，现有 NETWORK_POSITIONS 硬编码 4 节点是待改项）。
2. **每步可含多个事件、事件可并行**：`Step.events[]` + `dependsOn` 依赖图（详见解 demo-event-model.md §3）。解决了「每步只能一源一目的」的硬约束。
3. **广播/多播是一等公民**：`TargetSpec` 联合类型（设备 / 广播域 / 角色多播），广播范围由拓扑广播域推导，不手工枚举收件人。
4. **状态变化是一等公民**：`StateDelta[]` 描述 ARP Cache / MAC 表 / TCP 状态 / OSPF 邻居态 / 通用表（DNS 缓存、路由表等）的变化，纯函数折叠，支持单步回退与重播（详见 demo-event-model.md §4–5）。

---

## 六、发布状态与授权状态分离（双轨管理）

这是计划书 §8 和用户要求的核心规则，两条轨道独立演进、互不推断：

| 轨道 | 挂在哪里 | 取值 | 含义 |
|---|---|---|---|
| **内容发布状态** `status` | KnowledgePoint（将来 Demo 也加） | `draft → review → published` | 教学内容本身的审核进度 |
| **来源授权状态** `licenseStatus` | Source | 8 种取值（见第三节） | 这条资料能不能用、能用到什么程度 |

**发布门禁规则**（完整规则见 `docs/validation-rules.md` §4）：

- `status = 'published'` 的知识点，其所有 `sourceRefs` 必须满足：
  1. `sourceId` 存在于台账且 `licenseStatus` ∉ {`pending`, `per-file-review`}；
  2. 每条 ref 的 `checkedAt` 非空且 ≤ 当前日期；
  3. `contentState ∈ {original, adapted, license-verified}`（`third-party` / `permission-required` 不得发布）。
- 来源授权状态变更（如某 RFC 被废弃）时，校验器扫描所有引用它的知识点，命中者自动降回 `review` —— 这直接对应 RFC 8446→9846 那类发现（第二阶段实测发生过）。
- demo 的 `published` 要求引用的知识点全部 `published`（演示不能先于它解释的知识上线）。

---

## 七、样例验证结果一览

三份样例（`docs/sample-demos/`）验证的能力矩阵：

| 能力 | TCP 握手 | ARP 解析 | DNS 解析 |
|---|---|---|---|
| 顺序事件（依赖链） | ✅ 3 步串行 | ✅ 广播→响应→回包 | ✅ 五跳递归链 |
| 并行事件 | — | ✅ 广播帧同时到达多设备 | ✅ 迭代查询多路并行（缓存命中分支） |
| 广播 / 一对多 | — | ✅ ARP Request 广播域泛洪 | — |
| 多设备（>4） | — | ✅ 4 主机 + 交换机 | ✅ 5 设备 |
| 多目标 | — | ✅ 广播域内全体 | ✅ 按角色多播/逐级转发 |
| StateDelta | ✅ tcp-state ×4 | ✅ arp-cache ×3 | ✅ custom(dns-cache) ×2 |
| 报文字段 | ✅ seq/ack/flags | ✅ opcode/SHA/SPA/TPA | ✅ A/CNAME/递归位 |
| 处理类事件（无报文） | ✅ 端口未监听判定 | ✅ 查缓存 | ✅ 缓存查询/命中 |

**结论**：模型无需为任何一个样例加特例字段。ARP 的「广播域内接收者 ≠ 实际响应者」、DNS 的「递归 + 迭代混合」都能在同一套事件/目标语义内表达。遗留的模型开放问题见 migration-plan.md §6。

# NetLab Explorer — M2-A 实施计划（TCP 课程迁移）

> 版本 V1.0 · 2026-11-12 · 基线 `b5171bd` · 依据 `docs/product-scope-and-roadmap.md` V1.1 的 D-A…D-E
> 本文是**施工图**：只描述怎么改，不产生任何代码改动、不迁移数据、不创建提交。
> 通过标准见 §10，逐条对应上级指令的 10 条 M2-A 要求。

---

## 0. 一页结论

| 项 | 结论 |
|---|---|
| 目标 | 让新数据模型**第一次被真正消费**：TCP 主演示（14 步）+ 备用演示（4 步）改由 JSON 驱动，页面与今天逐像素一致 |
| 核心手法 | **构建期兼容投影**：`Demo + Knowledge + Source + Catalog` → Node 适配层 → `dist/netlab-data.js`（classic script）→ 现有 `app.js` 原样消费 |
| 新增代码 | 适配层约 230 行（含类型与注释）、生成器约 40 行、测试约 200 行；**播放器 4 个文件 0 改动** |
| 修改代码 | `app.js` ≈ 28 行（数据来源、`fault→alt`、报文行绑定、缺数据兜底）；`index.html` 2 处；`package.json` 3 行；类型/schema +4 个可选字段 |
| 数据 | 4 个新 JSON：`tcp-lifecycle.json`、`NET-04-08.json`、`sources.json`、`catalog.json`（`docs/sample-demos/*` 三份样例不动） |
| 硬门禁 | 4 张截图逐像素 0 差异；18 条状态文案全部由 fold 派生；`npm run check` 全绿；P1–P7 首次真实执行 0 ERROR |
| 最大风险 | 状态文案派生与原手写串不一致 → 已逐条算过：**17 条逐字相同，1 条（第 12 步）变长**，且不在基线截图覆盖范围内 |
| 需要用户点头 | §13 的四个可选字段（`Step.signal` / `Step.caption` / `Source.description` / `Device.stateLabel`），已在 roadmap §4.2 登记为冻结例外 |

---

## 1. 目标与边界

### 1.1 目标（四条，缺一不可）

1. 主演示 14 步、备用演示 4 步，全部由 `content/demos/tcp-lifecycle.json` 描述，`content/data.js` 不再被页面加载。
2. 设备状态文案由 `foldState` 的结果派生，逐步计算后拼句；`stateDeltas` 是唯一来源。
3. 报文表与步骤**按事件绑定**，不再假设 `rows[step]` 一定存在。
4. 多课程导航入口回到 DOM（搜索 / 全部 / 分组 / 当前序号），单课时自动隐藏。

### 1.2 明确不做

- 不改 SVG 渲染器（`isokit-scene.jsx` / `isokit-model.mjs` / `travel-dot.jsx` / `point-motion.mjs`）与 `styles.css`、`scene-motion.css`。
- 不做布局参数化（4 槽位够用），不接 `waves.ts`（线性播放）。
- 不恢复伪代码页签与知识图谱视图（D-C / D-D）。
- 不迁移 ARP/DNS，不改 `content/mechanisms.js`（右侧长文与 CSAPP 阅读留到 M2-B）。
- 不新增校验规则码（X/P 系列一个都不加），不改 `fold-state.ts` / `waves.ts`。
- 不做报文详情抽屉（`Packet.fields` / `layers` 本期留空，M2-C 再补）。

### 1.3 指令 10 条要求 → 落点

| # | 要求 | 落点 |
|---|---|---|
| R1 | 迁移主演示与备用演示 | §4.3 / §4.5（14 + 4 步） |
| R2 | 备用演示映射为 `alternate`，不误判为故障 | §4.5（`scenarios[1].id='alternate'`；DOM id `#fault` 保留，仅变量改名） |
| R3 | 统一主/备用端口 | §4.9（443 → 80） |
| R4 | 建立 `demo → viewModel` 适配层 | §2 / §5（`src/engine/view-model.ts`） |
| R5 | 状态文案从 fold 派生 | §5.3（算法）/ §5.4（18 条对照） |
| R6 | 修复 `traceRow` 与步骤的数组索引绑定 | §6 |
| R7 | 恢复必要导航入口，不建知识图谱 | §4.8（catalog）+ §3.2（HTML，单课时 `hidden`） |
| R8 | 复用播放器，不改渲染器 | §3.3（不动清单）+ §9.4（像素门禁）+ §10（`git diff` 为空） |
| R9 | 首课数据过 L1–L3、P1–P7 | §4.6 / §4.7 / §8 |
| R10 | 四张截图逐像素回归 | §9.4 / §10 |

---

## 2. 三个关键设计决策

### 2.1 适配层跑在**构建期**（Node），不跑在浏览器

**为什么**：`fold-state.ts` 是 TypeScript，浏览器不能直接执行。要让浏览器跑 fold 只有三条路——(a) 再实现一份 JS（**禁止**：两份实现必然漂移）；(b) 加一个 esbuild 产物 `dist/fold.js` 供浏览器 import（多一个运行期依赖 + 多一个模块装载问题）；(c) 构建期算完，浏览器只吃结果。

**选 (c)**：状态文案本来就是静态数据（PPT 式固定动画），没有"运行时重算"的需求；`dist/` 本来就是产物目录。

**代价**：改 JSON 后必须重建（`npm start` / `npm run check` / CI 都已串上，见 §7）。

### 2.2 适配层输出**兼容投影**（legacy lesson 形状），不是中性 VM

**为什么**：现有 `app.js` 与渲染器的契约是"七元组 + `net.main` + `fault`"，`app.js` 里有十余处直接取这几项（`frames()` / `nodes()` / `net.main[step]` / `scenario().code`…）。改成中性 VM 意味着重写 `renderTrace` / `renderDetail` / `draw`，收益为零、像素风险非零。

**做法**：适配层输出与今天 `LESSONS[i]` **完全同构**的对象（含 `steps` 七元组、`net.main`、`alternate`）。旧形状被**收敛到一个文件**里，将来要换播放器只需换这一个文件。

**代价**：`app.js` 里仍留着"七元组"这套旧词汇。可接受——它现在是**渲染契约**，不是数据格式。

### 2.3 视图数据是构建产物 `dist/netlab-data.js`，**不入库**

**为什么**：内容必须只有一份真相（`content/*.json`）。入库会在每次内容改动时产生两份 diff。
**做法**：`.gitignore` 加一行；`build`/`check`/`start` 都先生成；CI 的 `npm run check` 已在 `check-paths` 之前生成，无需新增步骤。
**代价**：新克隆直接开页面会白屏 → `app.js` 加缺数据兜底（§7.4），且 `npm start` 自动构建。

---

## 3. 文件范围

### 3.1 新增

| 路径 | 行数估计 | 职责 |
|---|---|---|
| `content/demos/tcp-lifecycle.json` | ~420 | 4 设备拓扑 + 2 场景（`main` 14 步 / `alternate` 4 步）+ 报文行 |
| `content/knowledge/NET-04-08.json` | ~40 | 首篇知识点（六问 + 2 条 `sourceRefs` + `demoRefs`） |
| `content/sources.json` | ~24 | 2 条来源（RFC 9293 / CSAPP 3e） |
| `content/catalog.json` | ~20 | 1 个分组 + 1 门课（导航与英文副标题的唯一来源） |
| `src/types/catalog.ts` | ~20 | `CatalogGroup` / `CourseEntry` / `Catalog` |
| `src/schemas/catalog.schema.ts` | ~24 | 上述三型的 Zod（`z.ZodType<T>` 锚定） |
| `src/engine/view-model.ts` | ~230 | 适配层（纯函数，见 §5） |
| `scripts/build-data.mts` | ~40 | 读 JSON → 校验快照 → 写 `dist/netlab-data.js` |
| `scripts/check-content.mts` | ~70 | 旧 `check-content.cjs` 的契约全量平移（14 处 `assert`，循环展开覆盖 2 场景 × N 步；改走适配层） |
| `scripts/test-view-model.mts` | ~200 | 适配层单测（≥40 断言，见 §9.1） |
| `docs/m2a-migration-record.md` | ~60 | 交付记录：18 条文案实测对照、截图 diff 结论、14 步 DOM 基线、遗留问题 |

### 3.2 修改

| 路径 | 改动 | 估计 |
|---|---|---|
| `src/types/demo.ts` | `Step.signal?`、`Step.caption?`、`Device.stateLabel?` | +9 行 |
| `src/schemas/demo.schema.ts` | 同步三个可选字段（`.strict()` 必须放行） | +3 行 |
| `src/types/source.ts` | `Source.description?` | +3 行 |
| `src/schemas/source.schema.ts` | 同步 | +1 行 |
| `src/app/index.html` | ①`data.js` → `../../dist/netlab-data.js` ②导航节点（`#search`/`#all-topics`/`#current-no`/`.parts`，默认 `hidden`） | 2 处 |
| `src/app/app.js` | ①`NETLAB_DATA` 解构 ②`fault`→`alt` ③报文行 null 安全 ④缺数据兜底 ⑤删伪代码分支 | ≈28 行 |
| `package.json` | `start` / `build` / `check` 串 `build-data`；`check:content-data` 加视图单测 | 3 行 |
| `.gitignore` | `dist/netlab-data.js` | +1 行 |
| `docs/demo-event-model.md` / `data-model-design.md` | 四个新字段的字段表登记（实施时同步） | 小 |
| `check-content.cjs` | **删除**（由 `scripts/check-content.mts` 取代） | -60 行 |

### 3.3 不动（硬约束，用 `git diff --stat` 证明）

`src/isokit-scene.jsx`、`src/isokit-model.mjs`、`src/travel-dot.jsx`、`src/point-motion.mjs`、`src/app/styles.css`、`src/app/scene-motion.css`、`src/engine/fold-state.ts`、`src/engine/waves.ts`、`scripts/validate-content.mts`、`content/mechanisms.js`、`content/data.js`（本期保留但不加载，M2-A 审查通过后单独提交删除）。

---

## 4. 数据迁移映射

### 4.1 一个文件拆成四个

| 原位置（`content/data.js` / `mechanisms.js`） | 去向 |
|---|---|
| `LESSONS[0].nodes / addresses / scene` | `demos/tcp-lifecycle.json` → `topology` |
| `LESSONS[0].steps`（14 条七元组） | → `scenarios[0].steps[].{title,caption,description,events,traceRow,stateDeltas}` |
| `LESSONS[0].net.main`（14 行） | → 各步 `traceRow` + `events[0].payload` |
| `LESSONS[0].fault`（4 条 + `net.alternate`） | → `scenarios[1]`（`id: 'alternate'`） |
| `LESSONS[0].stepNotes`（14 条深注） | → 各步 `description` |
| `LESSONS[0].principle / tradeoff / pitfall / summary` | → `NET-04-08.json` 的 `principle / why / commonProblems[0] / summary` |
| `LESSONS[0].sources`（`rfc9293`,`csapp`） | → `NET-04-08.json` 的 `sourceRefs[]` |
| `SOURCES`（2 条） | → `sources.json` |
| `GROUPS[0]` | → `catalog.json` → `groups[0]` |
| `MECHANISM_DETAILS.tcp` + `CSAPP_READINGS` | **不动**（仍在 `mechanisms.js`，M2-B 拆） |
| `code`（伪代码） | **不迁**（D-C） |

### 4.2 顶层字段映射

| 视图字段（旧 `LESSONS[i]`） | 新来源 | 说明 |
|---|---|---|
| `id` | `catalog.courses[].hash` | `'tcp'`：**视图 id 沿用 hash**，`#tcp` 深链、`localStorage` 进度键、`MECHANISM_DETAILS['tcp']` 一并保持不变；数据 id 另存 `demoId` |
| `group` | `catalog` 中 group 的序号 | 数字 0 |
| `title` | `demo.title`（"TCP 连接全流程"） | 逐字 |
| `en` | `catalog.courses[].titleEn` | "TCP CONNECTION LIFECYCLE"，模型无此字段，属导航元数据 |
| `summary` | `knowledge.summary` | 逐字 |
| `scene` | `topology.layout.view`（`network`）+ `view.kind` | → `'network'` |
| `nodes` | `topology.participants[].label` | 顺序即槽位序 |
| `addresses` | `participant.address` → `ip` + (`:port` 若有) | 空地址 → `''`（Internet） |
| `stepNotes` | `Step.description` 数组 | 14 条 |
| `net.main` | `Step.traceRow` → 行视图 | 等长、可 `null` |
| `net.alternate` | 备用场景的 `Step.traceRow` | 4 行 |
| `steps` | 逐步投影的七元组（§4.3） | |
| `principle` | `knowledge.principle` | 逐字 |
| `tradeoff` | `knowledge.why` | 语义即"代价与收益"，逐字 |
| `pitfall` | `knowledge.commonProblems[0]` | 逐字 |
| `alternate` | `scenarios[1]` → `{name: label, nodes, steps}` | `label` = "有序关闭：四次挥手与 TIME_WAIT" |
| `sources` | `knowledge.sourceRefs[].sourceId` | `['rfc-9293','csapp-3e']` |
| `related` | `knowledge.relatedKnowledge` | 单篇时 `[]` |

**hash 兼容**：`location.hash`、`systems-completed` 进度键、`MECHANISM_DETAILS` 的键今天都是 `tcp`。因此**视图 id 用 `catalog.courses[].hash`（`'tcp'`），数据 id 用 `demo.id`（`'tcp-lifecycle'`）**，两者在视图对象里各占一个字段（`id` / `demoId`）。不做"由 demo.id 推导 hash"（隐式规则），也不改 hash。

### 4.3 七元组逐位映射（渲染契约）

| 位 | 含义 | 来源 | 例（第 1 步） |
|---|---|---|---|
| `[0]` | 步骤标题 | `Step.title` | 三次握手：发送 SYN |
| `[1]` | 起点槽位 | `participants` 中 `event.from` 的下标 | `0` |
| `[2]` | 终点槽位 | `TargetSpec.device.id` 的下标（`process`/`local` 用 `from`） | `3` |
| `[3]` | 信号行 | `Step.signal`，缺省回退 `event.payload.summary` | `SYN Seq=0` |
| `[4]` | 场景字幕 | `Step.caption`（缺省回退 `description`） | 客户端内核选择源端口 49152… |
| `[5]` | 状态观察 | **fold 派生**（§5.4） | 客户端 SYN_SENT · 服务端 LISTEN |
| `[6]` | 关系类型 | 查表（§5.2） | `request` |

### 4.4 报文行映射

| 行字段 | 来源 | 例 |
|---|---|---|
| `t` | `traceRow.time`（字符串原样） | `0.000`（UI 追加 `s`） |
| `src` / `dst` | `traceRow.src/dst`（展示串原样，含端口写法差异） | `192.168.1.10` |
| `proto` | `traceRow.proto` | `TCP` |
| `info` | `traceRow.info` | `49152 → 80 [SYN] Seq=0` |
| `size` | `traceRow.size`（number）→ `${n} B` | `66 B` |
| `cat` | `traceRow.cat` | `hand` |
| `lost` | `traceRow.lost` | `true`（第 6 步） |

> **G3′ 说明**：`Packet.summary`（信号行）与 `TraceRow.info`（抓包行）在今天就是两种呈现（`SYN Seq=0` vs `49152 → 80 [SYN] Seq=0`），模型只有一个 `summary`。本期**保持两条文本**，不合并、不加字段；X9 只校验 `cat` 一致性，不涉及 `info`。

### 4.5 场景映射

| 旧 | 新 | 备注 |
|---|---|---|
| `LESSONS[0].steps` | `scenarios[0]`，`id: 'main'`，`label: '主流程'` | DOM `#normal` |
| `LESSONS[0].fault`（名字叫"故障"，内容是关闭流程） | `scenarios[1]`，`id: 'alternate'`，`label: '有序关闭：四次挥手与 TIME_WAIT'` | DOM id `#fault` 保留；`app.js` 变量 `fault`→`alt` |
| `special` | **不建** | 无数据，DOM 保持 `hidden` |
| `net.alternate[3]`（`127.0.0.1`、"本机等待，无报文"） | 第 4 步 `process` 事件 + `traceRow`（`category fin`，`size 0`） | 关系 `local`，路径为空（`from===to`） |

### 4.6 知识点 `NET-04-08.json`

| 字段 | 取值 |
|---|---|
| `id` | `NET-04-08`（`docs/network-knowledge-map.md` 既定编号，TCP 三次握手，P0） |
| `title` | TCP 连接生命周期：三次握手、可靠传输与四次挥手 |
| `categoryId` / `level` | `M04` / `basic` |
| `summary` / `principle` / `why` / `commonProblems[0]` | 与今日 `summary` / `principle` / `tradeoff` / `pitfall` **逐字相同**（像素门禁） |
| `what` / `practicalScenario` | 新写（本期不渲染，六问完整性用） |
| `demoRefs` | `['tcp-lifecycle']` |
| `relatedKnowledge` | `[]`（**单篇无法互指**；NET-04-09/13 落地后再按 X3 登记） |
| `sourceRefs` | `rfc-9293`（`sections: ['3.5','3.6','3.10']`，purpose：核对握手/挥手状态迁移与标志位）、`csapp-3e`（`['11.1','11.3']`，purpose：客户端—服务器模型与连接生命周期） |
| `status` / `contentState` / `accessLevel` | `published` / `original` / `free` |
| `createdAt` / `updatedAt` | `2026-11-12` |

### 4.7 来源台账 `sources.json`

| sourceId | type | name | licenseStatus | 作用 |
|---|---|---|---|---|
| `rfc-9293` | `rfc` | Transmission Control Protocol (TCP)，version RFC 9293 | `public-standard` | 状态机与报文语义的权威依据 |
| `csapp-3e` | `textbook` | Computer Systems: A Programmer's Perspective (3e) | `copyright-textbook` | 系统背景；只做原创表述 |

两条均附 `description`（卡片一句说明）与 `url`（HTTPS 官方地址，ADR-003）。卡片上的 `kind` 小标签由 `type` 映射：`rfc → 具体机制资料`、`textbook → 课程背景`（纯展示，属适配层，不动模型）。

### 4.8 目录 `catalog.json`

```json
{
  "groups": [{ "id": "network", "name": "网络协议", "en": "NETWORK PROTOCOLS",
               "color": "#8052c7", "dark": "#b79aeb",
               "question": "在不可靠的网络上，一条连接如何可靠地建立、传输与关闭？" }],
  "courses": [{ "demoId": "tcp-lifecycle", "knowledgeId": "NET-04-08",
                "groupId": "network", "hash": "tcp",
                "titleEn": "TCP CONNECTION LIFECYCLE", "order": 1 }]
}
```

校验（不新增规则码）：`catalog.schema.ts` 走 L1；`demoId` / `knowledgeId` / `groupId` 的存在性由 `validate-content.mts` 在 **X2（demo 引用存在）** 名下复核，并在注释里写明"目录是同一条引用规则的第二个入口"。

### 4.9 端口修正（D9）

备用场景 4 行里的 `443` 全部改为 `80`：`net.alternate[0..2]` 的 `src/dst` 与 `info`。
影响面：仅"备用场景"的表格文本；四张基线截图只覆盖第 1、6 步（主场景），**不受影响**。冒烟脚本新增断言：备用场景 4 行内不出现 `443`。

### 4.10 四个可选字段的缺省语义

| 字段 | 缺省行为 | 本期用途 |
|---|---|---|
| `Step.signal?` | 回退 `Step.events[0].payload.summary`；两者皆无 → 适配层报错（I5） | 信号行（现 `s[3]`）；本期仅备用演示末步需要（`TIME_WAIT 2×MSL`） |
| `Step.caption?` | 回退 `Step.description`（旧样例因此仍然合法） | 场景字幕（现 `s[4]`） |
| `Source.description?` | 来源卡片不渲染说明行 | 来源页签 |
| `Device.stateLabel?` | 回退 `Device.label` | 状态文案短名（`Web 服务器` → `服务端`） |

---

## 5. 适配层职责（`src/engine/view-model.ts`）

### 5.1 公开接口

```ts
export type RelationKind = 'request'|'data'|'control'|'check'|'reject'|'lost'|'local'|'compare';

export function relationOf(ev: DemoEvent, initiatorId: string): RelationKind;
export function stateLabelAt(scenario: DemoScenario, stepIndex: number, devices: Device[]): string;
export function toFrame(step: Step, ctx: { slotOf: (id: string) => number; initiatorId: string;
                                           devices: Device[]; scenario: DemoScenario;
                                           stepIndex: number }): Frame7;
export function toTraceRow(row: TraceRow | null | undefined): TraceRowView | null;
export function buildLesson(demo: Demo, kp: KnowledgePoint, sources: Source[], entry: CourseEntry,
                            groupIndex: number): LessonView;
export function buildSite(input: { demos: Demo[]; knowledge: KnowledgePoint[]; sources: Source[];
                                   catalog: Catalog }): SiteData;   // { groups, lessons, sources }
```

全部**纯函数**：不读 fs、不读 DOM、不依赖时间、同一输入必得同一输出（有单测）。

### 5.2 关系映射表（G2）

| 条件（按顺序命中） | 结果 |
|---|---|
| `kind === 'drop'` | `lost` |
| `kind === 'process'` | `local` |
| `payload.cat === 'cdata' \|\| 'sdata'` | `data` |
| `payload.cat === 'hand' \|\| 'fin'` 且 `from === initiatorId` | `request` |
| `payload.cat === 'hand' \|\| 'fin'` 且 `from !== initiatorId` | `data` |
| `payload.cat ∈ {query,response,broadcast,generic}` 或 `payload` 缺失 | `data`（M2-B/C 再细分） |

`initiatorId` = 场景首个事件的 `from`（当前即 `client`）。
`control / check / reject / compare` 本期**无映射、无消费方**，保留枚举不猜。

### 5.3 状态文案派生算法

```
stateLabelAt(scenario, i):
  1. snapshot ← foldState(scenario.initialState, steps[0..i].stateDeltas 顺次展开)   // 复用引擎，不重写
  2. observed ← steps[i].stateDeltas 覆盖的设备（按 participants 顺序去重）          // "本步观察点"
  3. 对每个设备取折叠后的状态条目：
       tcp-state / ospf-neighbor → entry.to
       arp-cache                 → entry.state
       mac-table                 → 跳过（无状态可读）
  4. 若 observed 覆盖 ≥2 台且状态文本全同 → `双向 <状态>`
     否则 → `<设备短名> <状态>` 按 participants 顺序用 ` · ` 连接
  5. clause 为空 → 用 steps[i].events[0].note 兜底
     clause 非空且 note 存在 → `<clause> · <note>`
```

**三条约定**（写进 `docs/demo-event-model.md`）：

1. **观察点 = 本步 delta 覆盖的设备**——delta 除了"改状态"还承担"声明本步观察谁"的职责；未变化的设备可写一条同值 `set` 作为观察点（第 1 步的 `server: LISTEN` 即此用法）。文案永远取自**折叠后的快照**，不取 delta 里的 `to`，所以写错即暴露。
2. **`event.note` 只写事件观察**（丢包、重传、缺口），**不得复述状态**——单测断言：`note` 中不得出现任何 `TcpState`/`OspfNeighborState` 枚举名，防止手写状态回流。
3. **不做格式化魔法**：状态名一律原样（`SYN_RCVD`，不转"半开"）。

### 5.4 18 条对照（旧手写 vs fold 派生）

| 场景/步 | 旧 `s[5]`（手写） | 派生结果 | 差异 |
|---|---|---|---|
| 主 1 | 客户端 SYN_SENT · 服务端 LISTEN | 客户端 SYN_SENT · 服务端 LISTEN | — |
| 主 2 | 服务端 SYN_RCVD · 半连接队列 | 服务端 SYN_RCVD ＋ note 半连接队列 | — |
| 主 3 | 双向 ESTABLISHED · 连接就绪 | 双向 ESTABLISHED ＋ note 连接就绪 | — |
| 主 4 | 78 B 请求已发出 | 无状态变化 → note | — |
| 主 5 | 服务端分段发送响应 | note | — |
| 主 6 | 分段在途中丢失 | note | — |
| 主 7 | Seq=1461 分段送达 · 缺口留在 Seq=1 | note | — |
| 主 8 | 缺口已上报 · 等待重传 | note | — |
| 主 9 | 重传分段发出 | note | — |
| 主 10 | 响应数据完整接收 | note | — |
| 主 11 | 客户端 FIN_WAIT_1 | 客户端 FIN_WAIT_1 | — |
| 主 12 | 服务端 CLOSE_WAIT | **客户端 FIN_WAIT_2 · 服务端 CLOSE_WAIT** | **变长（+ 客户端 FIN_WAIT_2）** |
| 主 13 | 服务端 LAST_ACK | 服务端 LAST_ACK | — |
| 主 14 | 客户端 TIME_WAIT · 服务端 CLOSED | 客户端 TIME_WAIT · 服务端 CLOSED | — |
| 备 1 | 客户端 FIN_WAIT_1 · 半关闭 | 客户端 FIN_WAIT_1 ＋ note 半关闭 | — |
| 备 2 | 服务端 CLOSE_WAIT · 仍可发送 | 服务端 CLOSE_WAIT ＋ note 仍可发送 | — |
| 备 3 | 服务端 LAST_ACK · 等待最终确认 | 服务端 LAST_ACK ＋ note 等待最终确认 | — |
| 备 4 | 客户端 TIME_WAIT · 服务端 CLOSED | 客户端 TIME_WAIT · 服务端 CLOSED | — |

**第 12 步为什么必须变**：该步 ACK 到达后客户端确实进入 `FIN_WAIT_2`，旧文案漏了它，而步骤正文明确写着"客户端停在 FIN_WAIT_2"——这正是 D-B 要消灭的"文案与正文/报文打脸"。变长后与正文一致，且该步**不在四张基线截图内**（截图只覆盖第 1、6 步），像素门禁仍然成立。此条属**批准范围内的内容修正**，实施时在 `docs/m2a-migration-record.md` 单列。

### 5.5 适配层不变量（违反即 `throw`，构建失败）

| # | 断言 |
|---|---|
| I1 | `net.main.length === steps.length`，`net.alternate.length === alternate.steps.length`（缺行用 `null` 占位，不得短少） |
| I2 | 非空 `traceRow.eventRef` 必须指向**本步**事件；缺省时按"本步唯一事件"补全 |
| I3 | `traceRow.cat === payload.cat`；`traceRow.lost === (event.kind === 'drop')` |
| I4 | 七个槽位号 ∈ `[0, participants.length)`；`[1] === [2]` ⇔ `[6] === 'local'` |
| I5 | `[0] [3] [4] [5]` 非空字符串 |
| I6 | `stateLabelAt` 对每步返回非空串（clause 与 note 同时为空 = 数据缺观察点） |
| I7 | `foldState` 输入先 `deepFreeze`；折叠前后输入快照 JSON 相等（纯函数） |
| I8 | `note` 中不出现状态枚举名（§5.3 约定 2） |
| I9 | 每个 `knowledge.demoRefs` / `catalog` 引用都能解析（与校验器双保险） |

### 5.6 适配层**不做**的事

不做协议推演（不发包、不算序列号）、不做布局（槽位来自 `participants` 顺序）、不读环境（时间、随机、文件）、不做 i18n、不碰渲染器内部结构。

---

## 6. 报文行与步骤的绑定修复（R6）

### 6.1 现状缺陷

`app.js:77` `packetCat: rows?rows[step].cat:undefined`、`app.js:84` `rows[i].cat`、`rows[step].cat` —— 三处都假设"步骤 i 必有第 i 行"。
`traceRow` 在模型里是**可选且可为 `null`**（`Step.traceRow?: TraceRow | null`，语义"本步无报文"）。TCP 主/备恰好 1:1，所以今天不炸；**ARP 有 3/6 步无报文行**（`docs/sample-demos/arp-resolution.json` 实测），一迁就 `TypeError`。

### 6.2 新规则

1. **绑定按 `eventRef`**，不按位置：适配层为每步找到"`eventRef` 命中本步事件"的行；没有则 `null`。
2. **数组等长**：`net.main` 与 `net.alternate` 长度恒等于对应场景步数（I1），空缺为 `null`。
3. **消费端全部空安全**：`rows?.[i]?.cat`、`rows?.[step]?.cat`。
4. **占位行**：`null` 时渲染 7 列表格的一行：
   `<tr class="placeholder-row"><td><span class="row-no">n</span></td><td colspan="6">本步为本机操作，无网络报文</td></tr>`。
   `.placeholder-row` 需要一条 CSS（`td[colspan]` 复用现有 `td` 样式即可，**不新增样式规则**）。
5. **图例**：`now = rows?.[step]?.cat`，为 `undefined` 时无 active 项（现有 `classList` 逻辑天然兼容）。
6. **表头**：仍由"是否存在 traceRow 数据"决定（`net.main.some(Boolean)`），TCP 不变。

### 6.3 回归保护

- 单测：给一个"第 2 步无行"的合成 demo，断言 `net.main = [row, null, row]` 且不抛错。
- 冒烟：TCP 断言 14 行不变；ARP 阶段的占位行断言留到 M2-B。

---

## 7. 数据装载与构建链路

### 7.1 链路

```
content/demos/*.json ─┐
content/knowledge/*.json ─┤
content/sources.json ─┼─→ scripts/build-data.mts ──→ dist/netlab-data.js  (window.NETLAB_DATA)
content/catalog.json ─┘        │                          │
                               ├─ L1 Zod（复用 src/schemas）
                               ├─ 适配层 buildSite()
                               └─ 不变量 I1–I9（失败即退出码 1）
                                                          ↓
index.html: <script defer src="../../dist/netlab-data.js"> + mechanisms.js + isokit.js + app.js
```

`dist/netlab-data.js` 内容：`window.NETLAB_DATA = { groups, lessons, sources }`（`lessons` 为 §4.2 的兼容投影；`sources` 为来源卡片的 `{name,url,note,kind}`）。
`MECHANISM_DETAILS` / `CSAPP_READINGS` 仍由 `mechanisms.js` 提供（本期不动）。

### 7.2 npm scripts

```jsonc
"start": "node scripts/build-data.mts && python -m http.server 8091",
"build": "node scripts/build-data.mts && node scripts/build.mjs",
"check": "node scripts/build-data.mts && node scripts/check-content.mts && node check-isokit.cjs && node check-motion.cjs && node scripts/check-paths.cjs && npm run check:types && npm run check:content-data",
"check:content-data": "node scripts/validate-content.mts && node scripts/test-data-model.mts && node scripts/test-view-model.mts"
```

原四段检查（content / isokit / motion / paths）一个不少，`tsc` 与 `validate-content` 保持独立段。

### 7.3 CI

`pages.yml` **无需新增步骤**：`npm run check` 已包含 `build-data`，且 `check-paths` 在其后；`npm run build` 随后再生成一次（幂等）。可选优化：在 "Check JavaScript" 后加 `node scripts/build-data.mts` 便于更早暴露错误——非必需。

### 7.4 失败模式

| 场景 | 表现 |
|---|---|
| 忘记构建 | `app.js` 首行检测 `window.NETLAB_DATA`，缺失时在 `#main` 渲染 `<p class="empty">缺少 dist/netlab-data.js，请先运行 npm run build</p>` 并 `throw`，**不静默白屏** |
| JSON 不合法 | `build-data` 打印 zod 错误路径并退出码 1 → `check` 红 → CI 红 |
| 不变量被破坏 | 同上（错误信息带 demo/step id） |
| 页面引用路径错 | `check-paths.cjs` P2 直接失败（新资源必须相对路径） |

---

## 8. 校验与门禁（L1–L3 首次真实执行）

### 8.1 期望输出

`node scripts/validate-content.mts`：退出码 0，ERROR 0、WARN 0；不再打印"尚无 knowledge/sources 落地数据"的 INFO。
计数：1 demo / 1 knowledge / 2 sources / 1 catalog；X1–X14 全跑（X4/X5/X6/X9/X10/X13 首次吃到真实事件图），P1–P7 首次实检。

### 8.2 门禁命中表

| 门禁 | 检查点 | 本期数据 |
|---|---|---|
| P1 | `checkedAt ≤ 今天`、`sections` 非空 | 2026-11-12 / `['3.5','3.6','3.10']` ✅ |
| P2 | 来源授权 ∉ {pending, per-file-review} | `public-standard`、`copyright-textbook` ✅ |
| P3 | `contentState ∈ {original, adapted, license-verified}` | `original` ✅ |
| P4 | `paid-standard` 待查项 | 无 ✅（不产生 WARN） |
| P5 | 引用 demo 的知识点必须 published | 唯一知识点 `published` ✅ |
| P6 | 来源失效联动 | 未触发（无失效来源）✅ |
| P7 | published ⇒ `sourceRefs.length ≥ 1` | 2 条 ✅ |

### 8.3 阴性复核（临时目录，不动仓库）

| 注入 | 期望 |
|---|---|
| `status: published` → `sourceRefs: []` | `✗ [P7]`，退出码 1 |
| `licenseStatus: pending` | `✗ [P2]`，退出码 1 |
| `checkedAt: 2027-01-01` | `✗ [P1]` |
| `stateDeltas` 写 `to: 'ESTABLISHEDD'` | `✗ [L1]` 精确到 `scenarios[0].steps[i].stateDeltas[j].changes[k].entry.to` |
| 第 6 步 `traceRow.lost` 但事件非 `drop` | `✗ [X10]` 或适配层 I3 |

---

## 9. 测试计划

### 9.1 `scripts/test-view-model.mts`（≥40 断言）

| 组 | 断言 |
|---|---|
| A 结构（8） | `steps.length===14`；`alternate.steps.length===4`；`nodes.length===4`；`addresses` 四项且第 3 项为空串；每帧 7 位；槽位在范围内；`[1]===[2] ⇔ local`；文本非空 |
| B 状态文案（6） | 18 条与 §5.4 表逐字相等（含第 12 步的新值）；`note` 无状态名；fold 纯函数；观察点为空时抛错；`双向` 规则仅在同状态多设备时触发；`stateLabel` 回退 `label` |
| C 关系（6） | 14 步 `[6]` 与旧值逐条相等；`drop→lost`；`process→local`；`cdata/sdata→data`；`hand` 发起方/非发起方；未知 cat → data |
| D 表格（7） | 14/4 行且等长；`size` 格式化为 `66 B`；`lost` 与 drop 对齐；`eventRef` 命中本步；`null` 行占位不抛错（合成 demo）；表头判定；`443` 不存在（D9） |
| E 站点（5） | `groups.length===1`；`lessons[0].id/key`；`hash` 兼容映射；`sources` 卡片 4 字段齐；`related` 空数组不渲染按钮 |
| F 纯函数（4） | 两次构建深度相等；输入深冻结后不变；不读时间；异常输入抛带 id 的错 |

### 9.2 `scripts/check-content.mts`（旧契约全量平移）

旧 `check-content.cjs` 的断言逐条保留：恰好 1 课 / 1 组 / `details` 键匹配 / 机制 sections 非空 / CSAPP 结构 / 来源 HTTPS / 场景不共享数组 / 每场景 4 节点 / 7 位帧 / 关系枚举 / `local` 不造假传输 / 非空文本 / 14 步 / 第 6 步 lost / `net.main[5].cat==='sdata'` / `cdata`+`fin` 存在 / 深注 14 条且长度 > 40 / TCP 五类 cat。
**唯一删除**：`code.length>0`（D-C 决定不迁伪代码），删除处加注释说明。

### 9.3 冒烟（`.openai/smoke-runtime.cjs`）

保持现有断言并新增 3 条：`#step-description` 与 `#diagram-state` 文本非空且与 `steps[i]` 一致；备用场景 4 行无 `443`；`runtime errors: none`。

### 9.4 截图（4 张，逐像素）

`.openai/shot-tcp.cjs` 不变（idle→第 1 步、lost/dark/mobile→第 6 步）。与 `.openai/baseline-m0/` 逐像素比对，**要求 0 差异**。
另加 DOM 结构断言（弥补截图只覆盖 2 步的盲区）：`#diagram svg` 的 `viewBox`、`[data-node]` 数量与 `transform`、`#active-path` 的 `d` 字符串、`#flow-legend` 文本，对 14 步逐步与迁移前记录比对（迁移前先跑一次存基线 JSON）。

### 9.5 路径

`node scripts/check-paths.cjs`：`../../dist/netlab-data.js` 能解析；`_site` 装配后可解析；无根绝对路径。

### 9.6 手工验收清单（5 分钟）

播放/暂停/单步/重置/变速 × 主备两场景；点表格行跳步；深色切换；430px 窄屏侧栏；`#tcp` 深链刷新；标记已学进度。

---

## 10. 验收标准（对应 R1–R10 + 反例）

| # | 标准 | 反例（出现即失败） |
|---|---|---|
| R1/R3 | 主 14 步、备 4 步全部来自 JSON；`grep -r "443" content/demos/tcp-lifecycle.json` 无命中（服务端地址统一 `203.0.113.10:80`） | 页面仍加载 `content/data.js`；备用场景端口没改 |
| R2 | `scenarios[1].id === 'alternate'`；`lesson.alternate` 存在；DOM `#fault` 文案为"有序关闭…" | 把备用演示叫 `fault` 并在 UI 显示"故障" |
| R4 | `src/engine/view-model.ts` 单文件承担全部投影；`app.js` 中无字段级映射 | 在 `app.js` 里写 `if (step.id === 'e-06')` |
| R5 | 18 条文案 = §5.4 派生值；JSON 内无状态句；`note` 不含状态名 | JSON 里出现 `"stateLabel": "客户端 SYN_SENT"` |
| R6 | 三处 `rows[...]` 全部空安全；`null` 行有占位；等长断言通过 | 保留 `rows[step].cat` 任一处 |
| R7 | `#search`/`#all-topics`/`#current-no`/`.parts` 在 DOM 且单课时 `hidden`；无 `#map-*` | 单课时搜索框可见（基线必炸） |
| R8 | 渲染器 4 文件 + 2 CSS `git diff` 为空 | "为了排版"动 `scene-motion.css` |
| R9 | `validate-content` 0 ERROR；P1–P7 实检；catalog 引用可解析 | 靠 `status: draft` 绕过门禁 |
| R10 | 4 张 PNG 逐像素 0 差异；14 步 DOM 基线 JSON 0 差异 | 重录基线当作"通过" |

**附加硬指标**：`npm run check` 退出码 0；`npm ci` 后从零可复现；工作区提交后 clean。

---

## 11. 风险与回退

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| 派生文案与原串不一致 | 已量化 | 中 | §5.4 逐条对照；17 条同文、1 条批准变长；单测锁死 |
| 像素漂移来自排版（非文案） | 低 | 高 | 截图 0 差异门禁 + 14 步 DOM/路径基线 |
| `dist/netlab-data.js` 与 JSON 不同步 | 中 | 中 | 单一真相 + 每次 `check` 重新生成（不存旧产物） |
| `app.js` 的 `fault→alt` 改名漏改 | 中 | 低 | `node --check` + 冒烟点击 `#fault` 断言；逐处改动列在 §3.2 |
| 构建期 fold 与未来运行时语义分叉 | 低 | 中 | 只调用 `foldState`，不复制逻辑；I7 断言纯度 |
| 双源文案（`mechanisms.js` vs knowledge） | **确定存在** | 中 | 本期 `mechanisms.js` 冻结；M2-B 切六问渲染时删除，见 §12 |

**回退**：M2-A 单提交。回退 = `git revert`，`content/data.js` 在本期保留且完整，`index.html` 一行改回即可复活旧链路——这是本期刻意保留的逃生门（审查通过后单独提交删除）。

---

## 12. 交接给 M2-B 的债务清单

| # | 债务 | 触发时机 |
|---|---|---|
| T1 | `content/mechanisms.js` 与 `NET-04-08.json` 双源（sections/foundation/readings 仍在 JS） | M2-B 把右栏改为六问渲染时删 JS，允许文案变化并重做基线 |
| T2 | 4 槽位布局 + 索引链路由（`NETWORK_POSITIONS` / `topologyLinks`） | M2-B 的 ARP（含 switch）若塞不进 4 槽，先加"每课一张布局表"的最小能力 |
| T3 | 广播扇出视觉未定 | M2-B，可先退化为"逐接收者点亮" |
| T4 | `Packet.fields` / `layers` 未填，报文详情无抽屉 | M2-C |
| T5 | `Packet.summary` 与 `TraceRow.info` 双文本 | M2-C 评估是否加 `TraceRow.display` |
| T6 | `relatedKnowledge` 单篇无法互指 | M2-C 补齐 NET-04-09/13 后按 X3 登记 |
| T7 | `app.js` 120 行单行压缩、`fault` 语义残留 | 不在任何阶段主动重构，只在被改动时顺手整理 |

---

## 13. 需要确认的四个字段（唯一待批事项）

M2-A 的其余部分都可直接施工，只有 §4.10 的四个**可选**字段属于"冻结例外"：

| 字段 | 不加的代价 |
|---|---|
| `Step.signal?` | 备用演示末步（无报文的本机动作）只能空着或复述标题，信号行与今天不一致 |
| `Step.caption?` | 场景字幕与逐步详解只能二选一：字幕消失（可见变化）或深注消失（内容损失） |
| `Source.description?` | 来源卡片少一行说明（可见变化），或把 `licenseNote` 挪来描述（语义错位） |
| `Device.stateLabel?` | 状态文案会变成"Web 服务器 SYN_RCVD"（与今天"服务端"不一致，属可见变化） |

四者都只进类型 + Zod、都有明确缺省、都不新增规则码。**若全部不批**，M2-A 仍可施工，但需接受四处可见文案变化并重录 4 张基线（等于放弃"逐像素 0 差异"这条门禁）。

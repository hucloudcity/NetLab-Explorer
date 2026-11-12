# NetLab Explorer 内容校验与发布规则

> 版本：V1.0（2026-11-12）。落地时机：迁移阶段 M1；本阶段规则先行、样例已按此规则人工验证。
> 原则（用户约束）：**结构校验与跨数据引用校验分开**；published 内容不得引用未完成必要审核的来源。

---

## 一、校验器分层

| 层 | 名称 | 实现 | 失败即失败？ | 作用 |
|---|---|---|---|---|
| L0 | 类型检查 | `tsc --noEmit`（仅覆盖新 TS 代码） | 是 | TS 类型安全 |
| L1 | 结构校验 | Zod schema，逐文件 | 是 | 单文件字段/枚举/形状 |
| L2 | 跨引用校验 | 自研 `scripts/validate-content.mjs`（普通 JS，加载全库后互查） | 是 | 跨文件引用完整性、领域一致性 |
| L3 | 发布门禁 | 同 L2 脚本的 gate 模式 | 仅当目标 status=published | 商业/审核规则 |
| L4 | 技术准确性抽查 | 人工 + AI 对照 RFC/教材核对清单 | 报告，不阻塞（published 必须清零 TODO） | 协议原理正确性 |

L1 用 Zod（迁移时在 package.json 显式声明直接依赖，ADR-001）；L2–L3 不用 Zod——跨文件规则超出单文件 schema 能力，且需要反向索引与领域规则，自研校验器更直接。

## 二、L1 结构校验（Zod，单文件内）

- `sources.json`：Source 十字段（data-model-design.md §3）；`url` 必须 https（例外白名单：无）。
- `content/knowledge/*.ts|json`：KnowledgePoint；`id` 匹配 `^NET-\d{2}-\d{2}$`；六问字段非空字符串；`commonProblems` 至少 1 条；`relatedKnowledge/sourceRefs/demoRefs` 允许空数组。
- `content/demos/*.json`：Demo；顶层 `$schema-note` 等下划线外字段（`knowledgeRefs-` 这类说明字段）**禁止**，落地数据不得携带文档用途字段（样例中仅为说明存在）。
- **未知字段策略（M2-P0 / N5）**：契约对象一律 `.strict()`——Demo / Scenario / Step / Event / TargetSpec 各分支 / Device / Domain / Link / Topology / Packet / TraceRow / StateDelta / StateChange / 四类状态条目 / Source / SourceRef / KnowledgePoint。多余字段视为拼写错误或未登记的模型扩展，必须同时改类型与 schema。**开放容器保持开放**：`Packet.fields`、`layers[].keyValues`、通用状态表条目按 `Record<string, FieldValue>` 接受任意键，不因收紧契约而限制合法扩展。
- **状态条目按表名校验（M2-P0 / N2）**：`initialState` 与 `StateDelta` 使用同一套表名约束。`arp-cache` / `mac-table` / `tcp-state` / `ospf-neighbor` 的条目必须逐字段符合专用 schema（非法状态值、缺字段、多余字段均在 L1 拒绝）；通用表只允许 `dns-cache` / `routing-table`（白名单），新增表需先扩 schema。此前 `StateEntry` 的五路 union 会被 `GenericEntry` 兜底，使畸形条目混入保留表——该漏洞已关闭。
- Step/DemoEvent/StateDelta/TargetSpec/Packet/TraceRow 按 demo-event-model.md §2–5 的形状：
  - `event.kind ∈ {unicast, broadcast, multicast, process, drop}`；
  - `TargetSpec.kind ∈ {device, broadcast, multicast}`；
  - `event.kind = 'process'` ⇒ `payload` 缺省或 null、`to.kind = 'device'` 且 `to.id === from`；
  - `event.kind ∈ {unicast, broadcast, multicast}` ⇒ 必有 payload；
  - `tcp-state.entry.to ∈ RFC 9293 状态名枚举`；`ospf-neighbor.entry.to ∈ RFC 2328 八态枚举`；
  - `dependsOn` 与 `afterEvent` 引用格式合法（字符串、非空）；
  - Packet/StateChange 条目值域为递归 `FieldValue`（允许 null 与嵌套，见 demo-event-model.md §2.3 的 M1 调整注记）。
- **环与波次**：Zod 不查图（超出能力），环检测归 L2。

## 三、L2 跨引用校验（自研脚本，跨文件）

逐条规则（全部来自三份样例的真实风险点）：

| # | 规则 | 错误信息示例 |
|---|---|---|
| X1 | `KnowledgePoint.sourceRefs[].sourceId` 必须存在于 sources.json | `NET-04-01 引用了不存在的来源 rfc-8135` |
| X2 | `KnowledgePoint.demoRefs[]` 存在的 demo id 必须存在；demo 的反向索引据此生成 | |
| X3 | `KnowledgePoint.relatedKnowledge[]` 互指一致性：若 A 引 B，B 的 relatedKnowledge 应含 A（或登记时声明单向，二选一，缺省要求互指） | |
| X4 | 事件依赖图：`dependsOn` 目标必须存在于**同场景**且步骤序 ≤ 本步骤；全图无环（拓扑排序检测） | `e-flood 依赖的 e-decide 不存在 / 指向更晚步骤` |
| X5 | `stateDeltas[].afterEvent` 必须存在于同场景（序 ≤ 本步骤） | |
| X6 | `event.from`、`to.device.id`、广播域成员、`multicast.roleFilter` 产生的角色集 —— 所有设备引用必须存在于 topology.participants；`broadcast.domain` 必须存在于 topology.domains。**多播接收者 = 域成员中 `Device.role ∈ roleFilter` 且 `id ≠ from` 的设备**（与广播一致，发送方不接收自己的多播）；接收者集合为空 → ERROR（动画没有任何接收者）；`roleFilter` 中某角色在域内无任何设备 → WARN。`event.kind` 与 `TargetSpec.kind` 必须同类（broadcast↔broadcast、multicast↔multicast），交叉搭配 → L1-shape ERROR | `多播接收者为空——域 lan 内没有角色 ∈ {ap} 且非发送方 r1 的设备` |
| X7 | 广播域成员一致性：域 members 的每台设备必须与域内至少一台设备有链路（防"幽灵成员"） | |
| X8 | StateDelta 表名合法：`arp-cache/mac-table/tcp-state/ospf-neighbor` 或通用表白名单（`dns-cache/routing-table`，白名单外需先扩 schema）。M2-P0 起同一条约束在 L1 schema 内强制执行（保留表专用分支 + 通用表白名单），L2 保留同规则作为第二道防线 | |
| X9 | `traceRow.eventRef`（若有）指向本步骤事件；`cat` 枚举与 Packet.cat 一致 | |
| X10 | scenario.initialState 键必须是 participant id；`traceRow.lost=true` 的行必须有对应 `drop` 事件或 payload 注明丢失 | |
| X11 | 来源 `sections` 非空时必须通过格式启发式（如 RFC 小节 `\d+(\.\d+)*`）；**无法自动核对内容真实性**，内容真实性走 checkedAt 流程（L3/L4） | |
| X12 | 全库 id 唯一（跨 knowledge/demo/source 三个命名空间各自唯一，跨空间允许同名） | |
| X13 | **波次纯度**：波次划分只由 `dependsOn` 决定，与 `events[]` 数组顺序无关——校验器对每个步骤「打乱数组顺序重算波次」，结果必须逐事件一致 | `打乱顺序后 e-b 波次改变 → 存在隐式顺序依赖` |
| X14 | **fold 纯度**：对 initialState + deltas 做一次 deep-freeze 后执行折叠，不得抛错且不得改变输入对象（实现层单测，M1 落地） | `fold 修改了输入数据 → 重复播放结果不一致` |

## 四、L3 发布门禁（status 与授权双轨，见 data-model-design.md §6）

仅当知识点/演示 `status = 'published'` 时强制：

1. **P1** 所有 `sourceRefs[].checkedAt` 非空且 ≤ 今天；`sections` 为空时必须在 `verificationNote` 说明理由（如 RFC 826 无编号小节，以页码计）。
2. **P2** 所引来源 `licenseStatus ∉ {pending, per-file-review}`；`per-file-review` 来源（如 Wireshark 样本抓包）只能支撑 `draft/review`。
3. **P3** `contentState ∈ {original, adapted, license-verified}`；`third-party` / `permission-required` 不得 published。
4. **P4** `paid-standard`（IEEE）来源支撑的知识点，正文不得出现该标准条款原文引用（人工抽查项，校验器给出待查清单）。
5. **P5** demo published 要求其关联知识点（反向索引）全部 published。
6. **P6** 来源失效联动：当某来源被标记废弃/替换（如 RFC 8446→9846），所有引用它的 published 知识点自动降级 `review` 并生成待办——校验器提供 `--demote <sourceId>` 命令。
7. **P7（M2-P0 / N3）** `status = 'published'` 的知识点必须**至少关联 1 条 sourceRef**。依据：计划书「教材解释知识、标准保证准确」——无来源的 published 内容无法追溯核对，不能上线。边界语义：
   - `draft` 允许没有来源（尚未进入审核）；
   - `review` 允许挂着待确认来源（`pending` / `per-file-review` 等），来源不满足只影响「能否发布」，不影响「能否处于 review」；
   - 发布状态与授权状态继续独立判断：P7 只看 sourceRefs 数量，P2 只看来源 `licenseStatus`，二者互不推断。

**状态流转**：`draft → review → published` 单向；任何编辑使 `updatedAt` 变化时，published 内容必须先退回 `review`（校验器比对 git 记录或导入门禁实现，M1 先做人工规则）。

## 五、技术准确性规则（L4，对照计划书 §7 与执行指令 §八）

数据建模层面已固化的准确性保障：

- TCP 状态名只用 RFC 9293 枚举（Zod 层强制），禁止自由文本状态。
- ARP 模型中 Request=broadcast、Reply=unicast 由样例固定；跨网段必须解析网关 MAC——迁移 ARP 数据时作为 L4 清单检查项。
- `ack` 字段语义注释固定为「期望收到的下一个序列号」（写进 Packet 字段说明）。
- TTL/二层交换等原理表述属知识正文，校验器不做语义判断，由 L4 清单人工核对（每条知识点核对 checklist 随内容研发执行）。
- 不确定的行为在数据中禁止出现——宁可少一步，不允许编造（计划书红线）。

## 六、验收基线

- 三份样例（`docs/sample-demos/`）已按 X4/X5 规则脚本化预检通过（2026-11-12）。
- ~~M1 落地时：上述规则全部脚本化，`npm run check` 扩展为 `check-content + check-isokit + check-motion + validate-content` 四段；样例作为 validate-content 的第一个测试夹具。~~
- ✅ **已落地（M1，2026-11-12）**：`npm run check` 为六段——`check-content + check-isokit + check-motion + check-paths + tsc --noEmit + validate-content`；L1 用 `src/schemas/*`（zod 直接依赖），L2/L3 在 `scripts/validate-content.mts`；样例即首个测试夹具；门禁内核经内建自测（published×pending 来源被拦截、P6 联动命中）。实现对应关系见 `docs/m1-implementation.md`。
- ✅ **M2-P0 修正（2026-11-12）**：X6 多播角色过滤实装（不再空转）、X8 白名单下沉到 L1 schema、状态条目按表名严格校验、新增 P7（published ≥1 来源）；独立测试 `scripts/test-data-model.mts`（65 项）并入 `check:content-data` 与 CI。详见 `docs/m2-p0-fixes.md`。

# M2-P0 数据模型修正（N1–N7）

> 日期：2026-11-12 · 基线：M1 `84fe544` · 范围：仅数据模型层（schema / 校验器 / fold / 类型 / 规则文档）
> 边界：**未修改** `src/app/app.js`、`content/data.js`、`content/mechanisms.js` 与 SVG renderer；**未迁移** TCP 数据；未进入 M2-A。

## 一、总览

| 编号 | 问题 | 处理 | 关键文件 |
|---|---|---|---|
| N1 | multicast `roleFilter` 校验空转 | 实装真实角色过滤 + 空集 ERROR + 角色缺失 WARN | `scripts/validate-content.mts` |
| N2 | initialState 条目形状校验不足 | 按表名分派 schema + 通用表白名单 + 与 StateDelta 一致 | `src/schemas/demo.schema.ts` |
| N3 | published 可无来源 | 新增 P7 门禁 + 文档规则 | `scripts/validate-content.mts`、`docs/validation-rules.md`、`docs/data-model-design.md` |
| N4 | TypeScript 依赖位置与文档不符 | `typescript` 移入 `devDependencies`，文档与实现一致 | `package.json`、`package-lock.json` |
| N5 | 未知字段策略不统一 | 契约对象 strict、开放容器保持开放（明确清单） | `src/schemas/*.ts`、`docs/validation-rules.md` §2 |
| N6 | `SourceRefShape` 死代码 | 删除（已由 `source.ts` 的 `SourceRef` 取代） | `src/types/knowledge.ts` |
| N7 | fold 冗余表达式 / expire 语义 | 消除冗余分支；expire 对不存在条目改 no-op；克隆避免嵌套别名 | `src/engine/fold-state.ts` |

附带修正：`validate-content.mts` 的 `main()` 改为「仅直接运行才执行」，避免被测试脚本 import 时产生重复校验副作用。

## 二、逐项说明

### N1 多播角色过滤（空转 → 实装）

**原问题**：`validate-content.mts` 中 `members.filter((m) => { const dev = m; return dev !== undefined; })` 恒等于 `members.length`，`roleFilter` 从未参与判断；只要域非空就不报错，域内没有匹配角色也不会产生任何诊断。

**设计依据**：`docs/demo-event-model.md` §2.2 —— 多播是「域内按角色过滤的子集」；广播明确「域内除 from 外全部」，多播沿用同一约定（发送方不接收自己的多播）。因此：

```
接收者 = { d ∈ domain.members | Device(d).role ∈ roleFilter, d.id ≠ from }
```

**修改**：
- 新增 `multicastRecipients(domain, participantsById, roleFilter, from)`（纯函数，导出供测试），从拓扑的 `Device.role` 读取真实角色。
- `validateEventShape` 改为接收 `participantsById`，多播分支：
  - 接收者为空 → **ERROR**（动画没有任何接收者，属数据错误；不再是 WARN）；
  - `roleFilter` 中某角色在域内无任何设备 → **WARN**（可能是拓扑角色写错或域成员缺失，但不阻断其余角色的投递）；
  - 域不存在仍走 X6 ERROR，不因角色逻辑短路。
- 同时补上 `kind` 与 `TargetSpec.kind` 的交叉一致性：`broadcast × multicast 目标`、`multicast × broadcast 目标` → L1-shape ERROR（此前只拦截 `device` 目标）。
- `validateEventShape` 改为**返回诊断数组**（不再直接写全局 findings），便于独立测试；调用点 `findings.push(...)`。

**测试证据**（`scripts/test-data-model.mts` E1–E11）：
- E1 角色过滤 `router → ["r2"]`（排除发送方 r1）；E2 多角色过滤；E3 无匹配 → 空；E4 唯一匹配者是发送方 → 空。
- E5 合法事件 0 诊断；E6 无匹配角色 → X6 ERROR「多播接收者为空」；E7 诊断含角色与域；E8 部分角色缺失 → 仅 WARN；E9/E10 kind×目标交叉 → L1-shape ERROR；E11 域不存在 → X6 ERROR。

### N2 initialState 条目形状（union 兜底 → 按表名严格校验）

**原问题**：`StateEntrySchema` 是五路 union，其中 `GenericEntry`（任意 `Record<string, FieldValue>`）会把畸形条目「接住」。实测 `{ ip, state: 'NOT-A-VALID-STATE' }`（arp-cache）可通过 L1；`StateChange` 因有 `table` 判别 + refine 不受影响，导致**快照与 delta 约束不一致**。

**修改**（`src/schemas/demo.schema.ts`）：
- 四类专用条目 schema 全部 `.strict()` 并锚定类型（`z.ZodType<ArpCacheEntry>` 等）；TCP / OSPF 状态枚举收敛为 `TCP_STATES` / `OSPF_STATES` 常量，消除重复字面量。
- 新增 `TABLE_ENTRY_SCHEMAS`（表名 → 条目 schema）。
- `StateSnapshotSchema` 在基础形状解析后 `superRefine`：保留表条目必须再通过专用 schema（错误路径精确到 `设备.表.索引.字段`）；通用表必须在 `KNOWN_GENERIC_TABLES` 白名单内，否则报「不在白名单，需先扩 schema」。
- `StateChange` 的通用分支增加白名单 refine（保留表仍禁止落入通用分支）。至此 **initialState 与 StateDelta 共用同一套表名/形状约束**。

**测试证据**（D1–D11）：非法 ARP / TCP / OSPF 状态、ARP 缺 `state`、条目多余字段、白名单外表名全部拒绝；合法四表 + `dns-cache`、`routing-table` 通过；`StateDelta` 保留表非法状态与白名单外表名同样拒绝。

### N3 发布规则：published 至少一条来源（P7）

**规则核对**：`docs/data-model-design.md` §6 原文只约束「其所有 sourceRefs 必须满足…」，未要求数量 ≥1；`validation-rules.md` §2 允许 `sourceRefs` 为空数组。审计据此提出「空来源可发布」漏洞。本次明确规则：

| status | 来源要求 | 说明 |
|---|---|---|
| `draft` | 可无来源 | 尚未进入审核 |
| `review` | 可挂待确认来源（`pending` / `per-file-review`） | 来源状态只影响「能否发布」 |
| `published` | **至少 1 条 sourceRef**（P7） | 无来源无法追溯核对 |

发布状态与授权状态继续独立：P7 只看数量，P2 只看 `licenseStatus`，互不推断。

**修改**：`knowledgePublishGates` 在 `status === 'published'` 且 `sourceRefs.length === 0` 时产生 `P7` 违规；内建自测补充 P7 正反向断言。

**测试证据**：C1 published 无来源 → P7 拦截；C2 draft 无来源 → 0 违规；C3 review × pending → 0 违规；C6 双轨独立（draft × pending）；C14 两条来源中一条 pending 仍被 P2 拦截。

### N4 TypeScript 依赖归位

`typescript@^7.0.2` 由 `dependencies` 移入 `devDependencies`（构建/类型检查工具不属于运行时依赖）；`zod` 保持在 `dependencies`（运行时校验）。`package-lock.json` 已同步，`npm ls typescript` 正常。文档 `docs/m1-implementation.md` 原描述「typescript 开发依赖」现与实现一致，无需改写。

### N5 未知字段策略

明确两类，不做「一律 strict」：

| 类别 | 策略 | 对象 |
|---|---|---|
| 契约对象 | `.strict()`：多余字段=拼写错误或未登记扩展，必须同时改类型与 schema | Demo / Scenario / Step / Event / TargetSpec 三分支 / Device / Device.address / Domain / Link / Topology + layout / Packet / layer / TraceRow / StateDelta / StateChange 五分支 / 四类状态条目 / Source / SourceRef / KnowledgePoint / PacketStructure |
| 开放容器 | 保持开放，任意键合法 | `Packet.fields`、`layers[].keyValues`、通用状态表条目（`Record<string, FieldValue>`） |

**测试证据**：D6/D12/D14（strict 拒绝未知字段）；D8/D13（开放容器与嵌套 FieldValue 正常通过，证明合法扩展未被破坏）。

### N6 死代码

删除 `src/types/knowledge.ts` 中未被引用的 `SourceRefShape`（知识点已直接 `import type { SourceRef }`）。`tsc` 与全部测试通过。

### N7 fold-state

1. **冗余表达式**：`tcp-state` / `ospf-neighbor` 原三元表达式两个分支完全相同。拆成两个 case，各自以 `TcpStateEntry` / `OspfNeighborEntry` 收窄，消除冗余且不依赖 `as { to: string }` 的弱类型读取。
2. **arp `expire` 对不存在条目**：原实现会**凭空新增** `{ ip, state: 'stale' }`。对照 `docs/demo-event-model.md` §4.2「每个 delta 只描述终态」——没有条目就没有终态可描述，凭空创建 stale 会让状态面板出现从未学习过的表项。改为 **no-op**（语义修正，不是为简洁而改），并在注释与文档中写明；已有条目的 expire 行为不变（置 stale、去 mac）。
3. **嵌套别名**：通用表 `upsert/set` 由 `{...e}` 改为 `clone(e)`，避免输出快照与输入 delta 共享嵌套对象（如 DNS `answers` 数组），保证「改输出不会污染输入/重复折叠一致」。
4. `arp upsert` 缺省 `mac` 时不再写入 `mac: undefined` 键。

**测试证据**：B6 expire 不存在 → 不新增；B7 expire 已存在 → stale 且无 mac；B13 缺省 mac 不写 undefined；B14 篡改输出嵌套对象后输入 delta 不变；B1–B5/B8–B12 原审计断言继续通过。

## 三、验收对照

| # | 验收要求 | 结果 |
|---|---|---|
| 1 | N1/N2/N3 独立阴性测试 | ✅ `scripts/test-data-model.mts` 65 项全过（E1–E11 / D1–D14 / C1–C18 及 A/B 组） |
| 2 | 原 38 项审计测试 + M1 样例继续通过 | ✅ A/B/C 组覆盖审计全部断言（波次 8 / fold 12 / 门禁 14），并新增 P7、expire、clone 断言；三份样例 L1–L3 全过（0 ERROR） |
| 3 | `npm run check` 六段全过 | ✅ 退出码 0：内容契约 / IsoKit / 动效 / 路径 / tsc / 内容校验+测试 |
| 4 | CI 保留原有与 M1 新增检查 | ✅ 新增 `Run data model tests` 步骤；原有 `node --check`、`tsc`、`validate-content`、`npm run check`、build、stage、check-paths 均保留 |
| 5 | 旧页面截图与动画回归不变 | ✅ 四张截图（idle / lost / dark / mobile）与 M0 基线**逐像素 0 差异**；jsdom 冒烟 `runtime errors: none` |
| 6 | 不改 app.js / data.js / mechanisms.js / renderer | ✅ 均未出现在变更列表 |
| 7 | 不迁移 TCP 数据、不进 M2-A | ✅ `content/demos` 仍为空 |
| 8 | 独立提交、工作区 clean | ✅ 见提交记录 |

## 四、文件变化

| 文件 | 变化 |
|---|---|
| `src/schemas/demo.schema.ts` | N2 按表名分派校验 + 通用表白名单；N5 strict 策略；状态枚举常量收敛 |
| `scripts/validate-content.mts` | N1 多播实装 + `multicastRecipients`/`validateEventShape` 可测化；N3 P7；`main()` 仅直接运行 |
| `src/engine/fold-state.ts` | N7 冗余分支消除、expire no-op、通用条目 clone |
| `src/types/knowledge.ts` | N6 删除 `SourceRefShape` |
| `scripts/test-data-model.mts` | 新增：65 项独立测试 |
| `package.json` / `package-lock.json` | N4 typescript → devDependencies；`check:content-data` 纳入测试脚本 |
| `tsconfig.json` | include 扩为 `scripts/**/*.mts` |
| `.github/workflows/pages.yml` | 新增数据模型测试步骤 |
| `docs/validation-rules.md` | X6 多播语义、X8 下沉说明、P7、strict 策略、验收基线 |
| `docs/data-model-design.md` | §6 发布门禁补 P7 与边界语义 |
| `docs/m1-implementation.md` / `README.md` | P1–P7 表述与校验命令说明同步 |

## 五、遗留问题（不阻塞 M2-A）

1. **P7 只约束来源数量**，不判断来源与内容的相关性（`purpose` 是否名副其实）——仍属 L4 人工抽查。
2. **多播空集判定为 ERROR** 是本次明确的语义；若未来出现「故意零接收者」的教学场景（如演示静默丢弃），需先改规则再放开，不能靠数据绕过。
3. **strict 策略的代价**：模型新增字段必须同时改 type 与 schema；新增通用状态表必须扩白名单。这是有意的摩擦，避免数据先漂移再补校验。
4. 真实 GitHub Pages 部署验收仍待首次推送后补做（M0.1 已本地验证三种路径前缀）。
5. M2-A（TCP 数据迁移）未开始；`net.alternate` 备用时间线保留要求继续有效。

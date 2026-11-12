# M1 实现记录：TypeScript 类型与数据校验器

> 日期：2026-11-12。范围：**只建立数据基础与质量门禁**——不迁移 data.js、不拆 mechanisms.js、不碰 app.js 播放逻辑、不碰 SVG 渲染器、不做目录 UI、不做协议计算引擎。
> 前置：`docs/data-model-design.md`、`docs/demo-event-model.md`、`docs/validation-rules.md`（第三阶段设计，均已审查通过）。

---

## 一、新增/修改文件一览

| 文件 | 类型 | 内容 |
|---|---|---|
| `src/types/source.ts` | 新增 | `Source` / `SourceRef` / `LicenseStatus`（data-model-design.md §3） |
| `src/types/knowledge.ts` | 新增 | `KnowledgePoint` / `PacketStructure` / `ContentStatus` / `ContentState` / `ModuleId`（§4）；`SourceRef` 复用自 source.ts |
| `src/types/demo.ts` | 新增 | `Topology` / `Device` / `BroadcastDomain` / `Link` / `DemoEvent` / `EventKind` / `TargetSpec` / `Packet` / `StateDelta` / `StateChange` / `StateSnapshot` / `TraceRow` / `Step` / `DemoScenario` / `Demo` / `TcpState` / `OspfNeighborState` / `FieldValue`（demo-event-model.md §1–6） |
| `src/schemas/demo.schema.ts` | 新增 | 演示数据 Zod schema（L1），含保留状态表/通用表白名单导出 |
| `src/schemas/source.schema.ts` | 新增 | 来源台账 Zod schema；`url` 强制 https（ADR-003） |
| `src/schemas/knowledge.schema.ts` | 新增 | 知识点 Zod schema；id 强制 `NET-MM-NN`；六问字段非空 |
| `src/engine/waves.ts` | 新增 | `computeWaves`（拓扑分层波次推导）+ `checkWavePurity`（X13） |
| `src/engine/fold-state.ts` | 新增 | `foldState`（纯函数状态折叠）+ `deepFreeze` + `snapshotsEqual`（X14 支撑） |
| `scripts/validate-content.mts` | 新增 | 校验器入口：L1 Zod → L2 X1–X14 → L3 P1–P7（P7 于 M2-P0 增加） + 内建自测 |
| `tsconfig.json` | 新增 | strict 全开（`noUncheckedIndexedAccess` 等）；`noEmit`；NodeNext |
| `package.json` | 修改 | **`zod@^4.6.7` 声明为直接依赖**（不再依赖 react-isokit 的传递副本）；`typescript@^7.0.2`、`@types/node` 开发依赖；`"type": "module"`（见下）；新增 `check:types` / `check:content-data` 并接入 `check` |
| `.github/workflows/pages.yml` | 修改 | CI 新增 `tsc --noEmit` 与 `validate-content` 两个独立步骤 |
| `docs/sample-demos/dns-resolution.json` | 修改 | **样例数据修正**：`root-referral` 步骤补缺的 `description` 字段（Step.description 为 schema 必填，见 §四） |
| `docs/validation-rules.md`、`docs/data-model-design.md`、`docs/demo-event-model.md` | 修改 | 记录两处模型调整（§三） |

**零业务代码改动**：`src/app/*`、`content/data.js`、`content/mechanisms.js`、`src/isokit-*.jsx` 均未触碰。

## 二、类型 ↔ 设计文档对应与实现要点

1. **类型与 schema 双向锚定**：每个 Zod schema 用 `z.ZodType<T>` 注解锚定到手写类型（如 `const DemoSchema: z.ZodType<Demo>`），`tsc --noEmit` 强制「schema 输出 = 类型定义」，两者不可能漂移。TS 类型只服务编译期，运行时 JSON 一律过 Zod（类型在运行时不存在，不作为 JSON 校验依据）。
2. **判别联合**：`TargetSpec`（kind: device/broadcast/multicast）与 `StateChange`（table: arp-cache/mac-table/tcp-state/ospf-neighbor/通用）均为 discriminated union。`StateChange` 用 `z.union` 而非 `z.discriminatedUnion`——通用分支的 table 是自由字符串，会与字面量分支冲突；顺序 union + 通用分支 `refine(排除保留表名)` 达到同样效果，且保留表结构错误不会被通用分支兜底吞掉。
3. **可选 / 必填 / nullable 严格区分**：
   - `dependsOn`、`changes`、`events`、六问字段 = **必填**；
   - `device`、`afterEvent`、`version`、`size`、`note` = **可选**（缺省有明确语义）；
   - `payload`、`traceRow` = **nullable + 可选**（`Packet | null`）：`null` 是显式语义（process 无报文 / 本步无表格行），与「未定」不同——样例中 ARP 的 `traceRow: null` 与 `payload: null` 由此合法。
4. **无 any**：全部路径 strict + 显式类型；`noUncheckedIndexedAccess` 开启。
5. **复用**：`SourceRef` 在 knowledge.ts 中 import；`StateEntry` 与 `StateChange['entry']` 共用条目类型；`PacketCat` 在 Packet/TraceRow 间共享。
6. **波次**（waves.ts）：第 0 波 = 无同步骤依赖；第 n 波 = 依赖均属 <n 波；同波并行是引擎显式调度规则（语义先后必须写 `dependsOn`）；跨步骤依赖视为已满足；环检测在拓扑分层时抛错。**数组顺序不参与语义**（X13 用确定性逆置重算验证）。
7. **折叠**（fold-state.ts）：先 `structuredClone` 再在副本上应用 → 输入可以是 deep-frozen 对象；arp-cache 按 ip、mac-table 按 `vlan:mac`、tcp/ospf 按 peer、通用表按 `name→id→JSON` 键做替换；幂等且与调用次数无关。单步后退 = 重新 fold 前缀，重置/跳转/场景切换天然支持。`afterEvent` 只影响引擎呈现时机，不影响终态折叠。

## 三、模型调整（两处，均为「样例暴露设计缺口」，非放宽校验）

按「不让校验通过而随意放宽 Schema」的原则，先判定性质再改设计文档：

| # | 现象 | 判定 | 调整 |
|---|---|---|---|
| 1 | TCP 样例 `fields.ack: null`；DNS 样例 `fields.answers: [{name,type,rdata,ttl}]`，超出文档的 `Record<string, string\|number\|boolean>` | **设计缺陷**：null 是有语义的「字段在本报文中不存在」（首个 SYN 无 ack）；DNS 资源记录天然是结构化数组，扁平化反而丢信息 | `FieldValue = string \| number \| boolean \| null \| FieldValue[] \| { [k]: FieldValue }`（递归）。已同步 data-model-design.md §2.3 注记与 demo-event-model.md §2.3 |
| 2 | DNS 样例 `root-referral` 步骤缺 `description`；ARP 样例 `traceRow: null` | 前者是**样例数据错误**（每步详解是设计必填，第三阶段矩阵也要求"当前步骤解释"）→ 修样例；后者是 nullable 语义（本步无报文行）→ schema 允许 `TraceRow \| null` | 样例补一条与上下文一致的 description；`traceRow` 定义为 `traceRow?: TraceRow \| null` |

## 四、三份样例校验结果

`node scripts/validate-content.mts`（同时跑内建自测）：

- **JSON 解析**：3/3 通过；
- **L1 Zod 结构**：3/3 通过（`$schema-note`、`knowledgeRefs-` 样例注释字段按 validation-rules §2 剥离并提示——落地数据禁止携带）；
- **L2 跨引用**：X4/X5/X6/X7/X8/X9/X10/X12/X13 全过；
- **X14 fold 纯度**：每场景 deep-freeze 后折叠成功、输入未变、双次折叠逐字段一致；
- **阴性测试**（验证校验器非"永远绿灯"，测后已清理）：向 `content/demos/` 注入含 12 类缺陷的假 demo → **25 个 ERROR 全部命中**（重复设备 id、幽灵域成员、无链路成员、悬空 dependsOn、悬空 afterEvent、重复事件 id、未知设备/域引用、process 带 payload、非白名单状态表、lost 行无 drop 事件、unicast 形状错误等），退出码 1。

X1/X2/X3/X11 与发布门禁 P1–P6（M2-P0 起扩展为 P1–P7）：规则**已实现**，当前 `content/` 尚无 knowledge/sources 落地数据，校验器输出 INFO 跳过说明；门禁内核经内建自测验证（published 引用 pending 来源被 P2 拦截；P6 来源失效联动命中降级名单）。

## 五、自动化检查与 CI

- `npm run check` 现为**六段**：内容契约 + IsoKit 渲染 + 动效 + 路径自检 + **`tsc --noEmit`** + **`validate-content`**。原四项标准未降低，全部继续通过。
- CI（pages.yml）：`npm ci` 后依次跑 `node --check` → `tsc --noEmit` → `validate-content` → `npm run check` → build → `_site` 装配 → 路径校验 → 部署。本地 Node 22.22 / CI Node 24 均原生支持 `.mts` 类型剥离，无需额外构建步骤。
- `"type": "module"` 加入 package.json：使 `src/**/*.ts` 按 ESM 解析（`verbatimModuleSyntax` 要求）；仓库内全部 node 脚本本就是 `.cjs`/`.mjs`/`.mts` 显式扩展名，不受影响（全量 check + 冒烟已验证）。

## 六、遗留与不阻塞项

1. **真实 Pages 部署验收**（M0.1 遗留）：首次推送后需补线上资源状态码核对。
2. **门禁 P1/P5 的批量数据路径**未在真实数据上运行（无 knowledge/sources 数据），实现经合成数据自测；M2/M4 首批真实数据落地时自然激活。
3. **X11 启发式较宽松**（RFC 小节 `\d+(\.\d+)*` / Appendix / Page）：格式启发式无法核对内容真实性，内容真实性走 checkedAt 人工流程（validation-rules.md 既有约定）。
4. **migration-plan §6 的 5 个未决模型问题**原样保留（广播扇出布局、stepNotes 粒度、并行表格行、忽略类事件可见性、net.alternate 表达），M2 迁移 TCP 全量数据时验证。
5. **`net.alternate`**：M1 未触碰任何现网数据；语义保留承诺不变（M2 以 `traceRow.alternatives[]` 或独立 scenario 落地）。

## 七、验收对照（M1 指令逐条）

| 要求 | 状态 |
|---|---|
| 类型定义（Knowledge/Source/Demo/Topology/Device/Event/TargetSpec/StateDelta/StateSnapshot/SourceRef 等） | ✅ 12 个核心类型 + 9 个辅助枚举，与设计文档一致，判别联合，无 any，可选/必填/nullable 区分，复用无重复 |
| Zod Schema，zod 声明为直接依赖 | ✅ 3 个 schema 文件，`zod@^4.6.7` 在 package.json `dependencies` 显式声明 |
| 跨数据引用校验器（12 项检查 + 状态双轨） | ✅ X1–X14 全实现；X1–X3/X11、P1–P7 随落地数据自动启用（已自测）；status 与 licenseStatus 分轨检查 |
| 三份样例五级验证（解析/结构/跨引用/依赖/发布规则） | ✅ 全过；发现并修复 1 处样例缺字段、确认 2 处设计缺口并同步文档 |
| tsc --noEmit + 校验脚本 + 样例校验接入 check/CI | ✅ 六段 check + CI 两个独立步骤 |
| 原四项检查继续通过 | ✅ 内容契约 / 渲染回归 / 动效回归 / 路径自检全绿；页面 200、冒烟 `runtime errors: none`（主 14 行 / alternate 4 行）、构建可重复 |
| 禁止事项（不迁移数据/不拆 mechanisms/不碰 app.js·渲染器/不做 UI·引擎） | ✅ 零业务代码改动 |

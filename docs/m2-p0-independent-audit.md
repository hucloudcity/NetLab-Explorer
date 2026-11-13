# M2-P0 独立代码审计报告（`b5171bd`）

> 审计日期：2026-11-12 · 审计对象：`b5171bd0d6707cd1e8baaf7bd36e8d5072c28455`
> 审计方式：**只读**。未修改任何正式源文件，未创建提交。
> 审计范围：M2-P0 提交（N1–N7 修复）+ 全量回归；不评估 M2-A（TCP 数据迁移）内容。

---

## 1. 审计结论

**通过。无阻断问题。** 6 项非阻断观察（其中 2 项需在 M2-A 迁移前做语义确认），4 项未能完整验证（均为环境性限制，非实现缺陷）。

可以批准进入 M2-A。建议 M2-A 开始前先用 5 分钟敲定 NB-1（ARP `expire` 是否保留 `mac`），因为它直接影响 ARP 演示的状态面板内容。

---

## 2. 基础状态（对应审计要求 §1）

| 项 | 结果 | 证据 |
|---|---|---|
| HEAD 是否为 `b5171bd` | ✅ 是 | `git rev-parse HEAD` → `b5171bd0d6707cd1e8baaf7bd36e8d5072c28455` |
| 工作区是否 clean | ✅ 是 | `git status --porcelain` 空输出（审计前后各确认一次） |
| 变更文件数 | ✅ 14 个，与报告一致 | `git diff --name-status b5171bd^ b5171bd` |
| 是否存在未报告的文件修改 | ✅ 无 | 14 个文件全部落在 `docs/m2-p0-fixes.md` §四 的清单内；`src/app/app.js`、`content/data.js`、`content/mechanisms.js`、`content/scene/renderer` 均**未出现在变更列表** |

完整变更列表：

```
M .github/workflows/pages.yml        M package-lock.json
M README.md                          M package.json
M docs/data-model-design.md          A scripts/test-data-model.mts
M docs/m1-implementation.md          M scripts/validate-content.mts
A docs/m2-p0-fixes.md                M src/engine/fold-state.ts
M docs/validation-rules.md           M src/schemas/demo.schema.ts
                                     M src/types/knowledge.ts
                                     M tsconfig.json
```

统计 `14 files changed, 879 insertions(+), 181 deletions(-)`，与报告「14 文件，+879/−181」吻合。

> 注：报告 §四 的文件表列了 13 个文件，缺的第 14 个是报告自身（`docs/m2-p0-fixes.md`），属自引用省略，不影响完整性。

---

## 3. 通过项

### 3.1 N1 — multicast 角色过滤（审计要求 §2，7 项全过）

代码位置：`scripts/validate-content.mts:241-252`（`multicastRecipients`）、`:284-298`（诊断）、`:314-319`（kind×TargetSpec 交叉）。

| 要求 | 结果 | 证据（本次独立构造，未引用仓库测试） |
|---|---|---|
| 收件人仅来自目标域 | ✅ | 双域拓扑（lanA=[r1,r2,pc1,sw1]，lanB=[r3,pc2]），`multicastRecipients(lanA, byId, ['router'], 'pc1')` → `["r1","r2"]` |
| `Device.role ∈ roleFilter` | ✅ | 同上；反向验证：把 `pc1.role` 改成 `server` 后 `['server']` → `["pc1"]`，证明读的是真实 `Device.role` 而非 id/kind 猜测 |
| 发送方不被选为接收者 | ✅ | `domain=[r1]`、filter=`['router']`、from=`r1` → `[]` |
| 域外同角色设备不被选中 | ✅ | `r3`（router，在 lanB）不出现在 lanA 的结果中 |
| 角色不匹配 / 角色缺失 / 空集诊断 | ✅ | 全空 → `X6 ERROR "多播接收者为空——域 lan 内没有角色 ∈ {server} 且非发送方 pc1 的设备"`；部分缺失（`['router','server']`）→ 仅 `WARN`，无 ERROR；域不存在 → `X6 ERROR "不在 topology.domains"`，**不因角色逻辑短路** |
| 无其他路径绕过 roleFilter | ✅ | `grep -rn "roleFilter\|multicast" src/ scripts/ content/` 仅命中 `demo.schema.ts`（结构）与 `validate-content.mts`（校验）；渲染层尚未消费事件模型（app 仍读 `data.js`），不存在第二条接收者推导路径 |
| broadcast / multicast 与 TargetSpec 交叉 | ✅ | `kind=broadcast × 目标 multicast`、`kind=multicast × 目标 broadcast`、`kind=multicast × 目标 device`、`kind=unicast × 目标 multicast`、`kind=process × 目标 multicast` 全部产出 `L1-shape` ERROR；对照组 `broadcast × broadcast` 不误报 |

独立测试结果：**22 passed / 0 failed**。

### 3.2 N2 — initialState 状态表校验（审计要求 §3，7 项全过）

代码位置：`src/schemas/demo.schema.ts:173-227`（四类条目 + 表名映射）、`:229-254`（StateChange）、`:271-299`（`superRefine` 按表名复检）。

| 要求 | 结果 | 证据 |
|---|---|---|
| 四类状态表真正绑定各自 schema | ✅ | `TABLE_ENTRY_SCHEMAS`（`:212-217`）在 `superRefine` 中对每个条目**再解析一次**；跨表串味全部拒绝：arp 表放 `{peer,to}`、arp 表放 `{vlan,mac,port}`、mac 表放 `{ip,state}`、tcp 表放 `{peer,to:'Full'}` |
| 是否仍存在 union 宽泛兜底绕过 | ✅ 已关闭 | `StateEntrySchema`（`:221-227`）仍含 `GenericEntrySchema`（保留快照输出类型所必需），但 `superRefine` 用表名对应 schema 复检，畸形条目逃逸路径被封；实测 `{ip,state:'BAD'}` → 报错路径精确到 `scenarios.0.initialState.pc1.arp-cache.0.state` |
| 通用表只允许 `dns-cache` / `routing-table` | ✅ | `session-table`、`arp_cache`、`ARP-CACHE`、`dns_cache`、`mac_table`、`foo`、空表名 全部拒绝；`dns-cache`、`routing-table` 通过 |
| TCP / OSPF 枚举完整准确 | ✅ | TCP 11 态全部接受，`ESTABLISHEDD`/`established`/`TIME-WAIT`/`FIN_WAIT`/`SYN-RCVD`/空串全部拒绝；OSPF 8 态全部接受，`TwoWay`/`two-way`/`2WAY`/`FULL`/`ExStartt` 全部拒绝（与 `src/types/demo.ts:139-161` 的 RFC 9293 / RFC 2328 枚举逐项一致） |
| initialState 与 StateDelta 约束一致 | ✅ | 同一畸形（非法 state、多余字段、mac 为数字）在 `StateSnapshotSchema` 与 `StateChangeSchema` 中均被拒；`tcp-state` 仅 `op=set`、`mac-table` 仅 `learn/age/flush` |
| `.strict()` 拒绝具体表多余字段 | ✅ | arp/tcp/ospf/mac 四表多余字段全部拒绝；通用表任意键（含嵌套 `answers:[{...}]`）仍通过 |
| 嵌套对象 / 数组绕过 | ✅ 无 | 条目为数组、`null`、字符串、`ip` 为对象、`state` 为对象、`mac` 为数字、vlan 为字符串、表值不是数组、顶层为数组——全部拒绝 |

独立测试结果：**73 passed / 0 failed**。
端到端复核：向临时副本注入 `{"arp-cache":[{"ip":"10.0.0.1","state":"NOT-A-STATE"}]}`，校验器输出 `✗ [L1] ... 状态表 arp-cache 的条目必须符合其字段定义: Invalid option`，退出码 1。

### 3.3 N3 — P7 发布门禁（审计要求 §4，表格 5 行全过）

代码位置：`scripts/validate-content.mts:405-410`。

| 场景 | 预期 | 实测 |
|---|---|---|
| published + 空 sourceRefs | P7 ERROR | ✅ 仅 `P7` 一条，无伪 P1/P2 |
| published + 1 条有效 sourceRef | 不触发 P7 | ✅ 0 违规 |
| published + 来源授权不合规 | P2 独立报错 | ✅ 仅 `P2`，P7 不出现 |
| draft + 空 sourceRefs | 不触发 P7 | ✅ 0 违规 |
| review + pending 来源 | 允许存在，不得发布 | ✅ 0 违规（发布态由 `status` 控制，来源只影响「能否发布」） |

解耦验证：`published + 空来源 + contentState=third-party` → `P3,P7` 同时报（互不吞并）；`published + checkedAt 未来 + sections 空` → `P1,P1` 两条且无 P7；`P4` 待查项不阻塞、不误触 P2；`draft`/`review` 三态穷举均无 P7。

独立测试结果：**12 passed / 0 failed**。
端到端复核（临时副本，含 `content/sources.json` + `content/knowledge/*.json`）：

- published 且 `sourceRefs: []` → `✗ [P7] ... 结果: 1 ERROR`，**退出码 1**
- 补 1 条 `public-standard` 来源 → `0 ERROR`，退出码 0
- 该来源改为 `pending` → `✗ [P2] ... 不得支撑 published 内容`，退出码 1

### 3.4 N4–N7（审计要求 §5）

| 项 | 结果 | 证据 |
|---|---|---|
| N4 依赖归位 | ✅ | `package.json`：`typescript@^7.0.2` 在 `devDependencies`，`zod@^4.6.7` 仍在 `dependencies`；`package-lock.json` 中 `node_modules/typescript` 标记 `dev:true`、`node_modules/zod` `dev:false`；`rm -rf node_modules && npm ci` → `added 11 packages`，退出码 0；`npx tsc --noEmit` 通过（TS 7.0.2） |
| N5 strict / 开放策略 | ✅ 与文档一致 | 契约对象 strict（实测 Device 未知字段、TraceRow 未知字段被拒）；开放容器保持开放（`Packet.fields` 任意键、`layers[].keyValues`、通用表条目嵌套 `FieldValue` 均通过）；策略清单见 `docs/validation-rules.md:25-26`，与代码注释 `demo.schema.ts:49-51` 一致 |
| N6 `SourceRefShape` 移除 | ✅ | `grep -rn SourceRefShape` 仅命中 `docs/m2-p0-fixes.md` 的说明文字，代码中零引用 |
| N7 expire 不存在条目 = no-op | ✅ | `expire {ip:'9.9.9.9'}` → 表长度不变、无新增条目、`snapshotsEqual(结果, 初始)` 为 true |
| N7 expire 已有条目 | ⚠️ 只改 state？**否**（见 NB-1） | 结果 `{"ip":"10.0.0.1","state":"stale"}`——`state` 变 stale 的同时 **`mac` 被丢弃**，即使 delta 显式给出 `mac` 也被丢弃；另一设备不受影响、表长度不变 |
| N7 fold 仍是纯函数 | ✅ | deep-frozen 输入折叠后 JSON 不变（ESM 严格模式下冻结写入会抛错，未抛）；修改输出（含深层嵌套）不回流到 initial / delta；三次折叠逐字段一致；delta 数组序决定终态（符合「顺序 = 显式依赖链」语义） |

独立测试结果：**12 passed**（第 13 项 P4 初次判 FAIL 系我自己的测试在上一用例里故意改坏了共享对象 `out`，去掉污染后重测 `三次折叠一致: true`，非实现缺陷）。

### 3.5 全量回归（审计要求 §6）

| 检查 | 命令 | 结果 |
|---|---|---|
| 干净安装 | `rm -rf node_modules && npm ci` | ✅ 11 packages，exit 0 |
| 类型检查 | `npx tsc --noEmit` | ✅ 通过（Node 22.22.2 / TS 7.0.2） |
| 数据模型测试 | `node scripts/test-data-model.mts` | ✅ 65 passed / 0 failed |
| 三份样例校验 | `node scripts/validate-content.mts` | ✅ 3 份样例，0 ERROR / 0 WARN / 5 INFO，exit 0 |
| 六段 check | `npm run check` | ✅ exit 0；`Content contracts passed`、`IsoKit render regression passed`、`Motion regression passed`、`Deployment path check passed: 37 local references`、`结果: 0 ERROR`、`65 passed` |
| 页面冒烟 | `node .openai/smoke-runtime.cjs` | ✅ `runtime errors: none` |
| 截图回归 | `node .openai/shot-tcp.cjs` + PIL 逐像素 diff | ✅ idle / lost / dark / mobile **四张全部 IDENTICAL**（0 像素差异） |
| CI 与本地一致性 | 读 `.github/workflows/pages.yml` | ✅ 步骤覆盖 `npm ci` → `node --check app.js` → `tsc` → `validate-content` → `test-data-model` → `npm run check` → `build` → `check-paths`；Node 24，devDeps 默认安装 |
| 跨平台可复现性 | 检查 lockfile 平台包 | ✅ 26 个 `@esbuild/*`（含 `linux-x64`）全部入 lock，Ubuntu runner 可解析 |

---

## 4. 阻断问题

**无。**

---

## 5. 非阻断问题

### NB-1 `arp expire` 会丢弃 `mac`，与「只改变 stale 状态」的直觉不符

- **位置**：`src/engine/fold-state.ts:59-63`，核心是 `:62` `list[idx] = { ip: e.ip, state: 'stale' }`（整条替换，不保留原 `mac`，也不采用 delta 中的 `mac`）。
- **复现**：
  ```js
  foldState({pc:{'arp-cache':[{ip:'10.0.0.1',mac:'AA',state:'reachable'}]}},
            [{id:'e',device:'pc',changes:[{table:'arp-cache',op:'expire',
              entry:{ip:'10.0.0.1',mac:'SHOULD-KEEP',state:'stale'}}]}])
  // → {"ip":"10.0.0.1","state":"stale"}   mac 丢失
  ```
- **判定**：**非本次引入**（M1 即如此，`b5171bd^` 的 `fold-state.ts` 同样整条替换；M1 自测显式断言「去 mac」）。代码注释与 `m2-p0-fixes.md` §N7 已把该行为写成既有语义。
- **风险**：RFC 826 / 常见实现中 `stale` 表示「有 MAC 但需重新验证」，丢 MAC 会让面板看起来像 `incomplete`，属教学表达风险。ARP 演示（M2-A 之后）大概率要用到该状态。
- **建议**：M2-A 前明确一次——若 `stale` 保留 MAC，则改为 `list[idx] = { ...原条目, state:'stale' }`（保留 mac、忽略 delta 的 mac），并同步 M1 自测与文档；若确认丢弃，请在设计文档 §4.2 写一行「expire 清除 MAC」，避免后续被当成 bug 反复讨论。

### NB-2 全局 delta（省略 `device`）会在**所有**设备上建表，而非「所有含该表的设备」

- **位置**：`src/engine/fold-state.ts:140`（`const targets = delta.device !== undefined ? [delta.device] : Object.keys(out)`）配合 `:145`（`tables[change.table] ?? (tables[change.table] = [])`）。
- **复现**：初始 `{pc:{'arp-cache':[...]}, sw:{}}` + 全局 `tcp-state` delta → `sw` 得到 `{"tcp-state":[...]}`（凭空建表）。
- **判定**：**非本次引入**（M1 同款逻辑）。与 `src/types/demo.ts:205` 注释「全局表可省略（fold 时作用于所有含该表的设备）」表述不一致。
- **建议**：M2-A 若使用全局 `mac-table` 汇总型 delta，会向每台设备写入条目。迁移前确认真实意图：是「按表存在性过滤」还是「全设备建表」。属语义澄清，不阻塞。

### NB-3 L2 的 X8 分支在 L1 收紧后不可达

- **位置**：`scripts/validate-content.mts:172-178`（L2 X8）vs `src/schemas/demo.schema.ts:247-249`（L1 白名单 refine）。
- **现象**：白名单外表名在 L1 就被拒，含该 delta 的 demo 不会进入 L2，故 L2 的 X8 永远不会产出诊断。
- **判定**：**有意为之**（`validation-rules.md:50` 明写「L2 保留同规则作为第二道防线」）。仅提示：该分支无测试覆盖，属"永久绿灯"代码；若将来 L1 放宽需同步加测试。

### NB-4 步骤内 stateDelta 校验嵌在事件循环里，诊断会重复

- **位置**：`scripts/validate-content.mts:170-184`（`for (const delta of step.stateDeltas)` 位于 `for (const ev of step.events)` 内部）。
- **复现**：一个步骤含 2 个事件 + 1 个 `device:'ghost'` 的 delta → 同一条 `X6` 错误打印 **2 次**。
- **判定**：**非本次引入**（`b5171bd^` 结构相同）。仅影响日志可读性与 ERROR 计数（不影响退出码）。建议后续把 delta 循环提到事件循环外。

### NB-5 `multicastRecipients` 不承诺去重

- **位置**：`scripts/validate-content.mts:247-251`。若 `domain.members` 含重复 id，返回值会重复该设备（如 `['r1','r1','r2']`）。
- **判定**：实际由 X12（`validate-content.mts:86` 「广播域成员重复」）先拦截，不构成漏洞；只是纯函数契约未写明「假定 members 唯一」。

### NB-6 `StateSnapshotSchema` 未导出

- **位置**：`src/schemas/demo.schema.ts:271`（定义）与 `:348`（导出清单不含它）。
- **影响**：外部只能用 `DemoSchema` 整链校验快照；写快照级单测需要构造整个 Demo。低优先级 API 便利性问题（本次审计即因此改用 `DemoSchema` 整链探测）。

### NB-7 P7 只校验来源数量，不校验来源可解析

- **位置**：`scripts/validate-content.mts:408-410`。`sourceRefs:[{sourceId:'ghost'}]` 满足 P7，靠 X1（`:367-368`）报「引用不存在的来源」补位。
- **判定**：分层职责清晰（P7=数量、X1=存在性），不构成绕过；提示若未来移除 X1，P7 会被悬挂引用满足。

---

## 6. 未能验证的事项

| # | 事项 | 原因 | 已做的替代验证 |
|---|---|---|---|
| U-1 | GitHub Actions 真实执行 | 未推送（审计禁止改动/提交），无法触发远端 runner | 逐条复刻 CI 每一步在本地执行（含 `npm ci` 干净安装）+ 静态检查 YAML 结构；确认 lockfile 含 linux-x64 平台包 |
| U-2 | 真实 GitHub Pages 部署（子路径 404 复验） | 同上，需远端部署 | 本地 `check-paths` 37 条引用全解析、`pages path` 三前缀实测脚本仍在（M0.1 遗留基线） |
| U-3 | 多播接收者的**渲染**效果 | 渲染层尚未消费事件模型（app 仍读 `content/data.js`），roleFilter 目前只存在于校验层 | 只能验证校验层语义（本次 22 项）+ 确认页面零回归（四图逐像素一致） |
| U-4 | `licenseStatus` 的**外部真实性** | 授权状态由人工登记，无法从 URL 自动判定 | 只验证「登记值 → 门禁行为」的映射正确性（P2/P4/P7 全路径） |

---

## 7. 是否符合 M2-P0 原始目标

| 原始要求 | 结论 |
|---|---|
| N1 按真实 Device.role 过滤、空集诊断、不删 roleFilter 不放宽 | ✅ 实装且可测（纯函数导出）；空集为 ERROR 比原 WARN 更严 |
| N1 增加正反向测试 | ✅ E1–E11 + 本次独立 22 项 |
| N2 具体表执行各自字段校验、通用表白名单、禁止非法状态值借兜底进入、initialState 与 delta 一致、加阴性测试 | ✅ 全满足；兜底通道已由表名复检封闭 |
| N3 明确 published ≥1 来源 / draft 可空 / review 可待确认 / 双轨独立，并更新规则文档与测试 | ✅ 代码 + `validation-rules.md` §4 + `data-model-design.md` §6 + 12 项测试 |
| N4 依赖声明与文档一致 | ✅ 已移入 devDeps，lockfile 同步，干净安装+类型检查通过 |
| N5 明确 strict/开放策略，不破坏合法扩展 | ✅ 两类清单写入规则文档，开放容器实测仍通过 |
| N6 清理 `SourceRefShape` | ✅ 代码零引用 |
| N7 先核对语义再改，不为简洁改行为 | ✅ expire no-op 有文档依据（「delta 只描述终态」）；冗余分支拆分；clone 防别名。⚠️ 但「expire 丢 mac」这一既有行为未被复核（NB-1） |
| 验收 1–8（测试/六段/CI/截图/禁改文件/不迁移/独立提交 clean） | ✅ 全部满足（见 §3.5） |

**可以批准进入 M2-A。**

给 M2-A 的两条前置建议（各 5 分钟，不影响开工）：
1. 敲定 NB-1：ARP `stale` 是否保留 MAC（决定 ARP 演示状态面板的渲染契约）。
2. 敲定 NB-2：全局 delta 的建表语义（决定 `mac-table` 汇总类数据的写法）。

---

## 附录：本次审计执行的命令与主要输出

```
git rev-parse HEAD                      → b5171bd…（clean）
git diff --name-status b5171bd^ b5171bd → 14 files
rm -rf node_modules && npm ci           → added 11 packages（exit 0）
npx tsc --noEmit                        → TSC-OK（7.0.2）
node scripts/validate-content.mts       → 0 ERROR / 0 WARN / 5 INFO（exit 0）
node scripts/test-data-model.mts        → 65 passed / 0 failed
npm run check                           → exit 0（五段上游全绿 + 65 项）
node .openai/smoke-runtime.cjs          → runtime errors: none
node .openai/shot-tcp.cjs + PIL diff    → 4/4 IDENTICAL
独立测试（本次构造）                     → N1 22/22、N2 73/73、N3 12/12、N7 12 项
端到端（临时副本，已删除）                → P7 退 1、合法来源退 0、P2 退 1、L1 arp 路径精确、X6 多播空集命中
git status --porcelain                  → 空（审计前后各一次）
```

临时副本位于系统临时目录（非仓库内），审计结束已删除；仓库工作区在审计结束时仍为 clean，HEAD 仍为 `b5171bd`。

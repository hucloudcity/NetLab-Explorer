# M2-A 迁移记录（TCP 课程）

> 基线 `b5171bd` · 2026-11-12 · 施工依据 `docs/m2a-implementation-plan.md`
> 本文件记录**实测结果与偏差**，不是计划。验收口径见施工图 §10（R1–R10）。

## 1. 一句话结论

TCP 主演示（14 步）与备用演示（4 步）已由 `content/demos/tcp-lifecycle.json` 驱动，页面改吃构建期产物
`dist/netlab-data.js`；**四张基线截图逐像素 0 差异**，18 步 DOM 快照仅有 3 类差异（见 §3，审查整改后为：
主 12 状态行、主 13 关系类型、备用端口）；
`npm run check` 六段全绿，`validate-content` 首次对真实数据执行 L1–L3 + P1–P7（0 ERROR / 0 WARN）。
独立审查后的整改（FIN 关系类型、双链路渲染回归、第 12 步视觉基线、文档同步）见 §9。

## 2. 18 条状态文案实测（旧手写 vs fold 派生）

| 场景/步 | 旧 `s[5]` | 派生结果 | 差异 |
|---|---|---|---|
| 主 1 | 客户端 SYN_SENT · 服务端 LISTEN | 客户端 SYN_SENT · 服务端 LISTEN | — |
| 主 2 | 服务端 SYN_RCVD · 半连接队列 | 服务端 SYN_RCVD · 半连接队列 | — |
| 主 3 | 双向 ESTABLISHED · 连接就绪 | 双向 ESTABLISHED · 连接就绪 | — |
| 主 4 | 78 B 请求已发出 | 78 B 请求已发出 | — |
| 主 5 | 服务端分段发送响应 | 服务端分段发送响应 | — |
| 主 6 | 分段在途中丢失 | 分段在途中丢失 | — |
| 主 7 | Seq=1461 分段送达 · 缺口留在 Seq=1 | 同左 | — |
| 主 8 | 缺口已上报 · 等待重传 | 同左 | — |
| 主 9 | 重传分段发出 | 同左 | — |
| 主 10 | 响应数据完整接收 | 同左 | — |
| 主 11 | 客户端 FIN_WAIT_1 | 客户端 FIN_WAIT_1 | — |
| 主 12 | 服务端 CLOSE_WAIT | **客户端 FIN_WAIT_2 · 服务端 CLOSE_WAIT** | **批准变长（D-B）** |
| 主 13 | 服务端 LAST_ACK | 服务端 LAST_ACK | — |
| 主 14 | 客户端 TIME_WAIT · 服务端 CLOSED | 同左 | — |
| 备 1 | 客户端 FIN_WAIT_1 · 半关闭 | 同左 | — |
| 备 2 | 服务端 CLOSE_WAIT · 仍可发送 | 同左 | — |
| 备 3 | 服务端 LAST_ACK · 等待最终确认 | 同左 | — |
| 备 4 | 客户端 TIME_WAIT · 服务端 CLOSED | 同左 | — |

第 12 步为**内容修正**：该步 ACK 到达后客户端确实进入 `FIN_WAIT_2`，旧文案漏写，而步骤正文写着
「客户端停在 FIN_WAIT_2」。该步不在四张基线截图内（截图只覆盖第 1、6 步），像素门禁不受影响。

## 3. 逐像素与 DOM 回归

| 项 | 方法 | 结果 |
|---|---|---|
| 4 张基线截图 | `.openai/shot-tcp.cjs` 重拍 → 与 `.openai/baseline-m0/base-*.png` 逐像素比对 | **idle / lost / dark / mobile 全部 0 / 5,640,000 与 0 / 1,548,000 差异** |
| 第 12 步基线（审查整改新增） | `.openai/check-step12.cjs`（reduced-motion 确定性截图）→ 与 `.openai/baseline-m2a/base-step12.png` 逐像素比对 | **0 / 5,640,000 差异**；生成与验证方式见 §9.3 |
| 18 步 DOM | 用 `git worktree` 检出 `b5171bd` 于 8092 端口作对照，逐步抓 `viewBox` / `[data-node]` transform / `#active-path d` / 图例 / 标题 / 信号 / 字幕 / 表格全部单元格 / 详情文本 | 仅 3 类差异，见下 |
| jsdom 冒烟 | `.openai/smoke-runtime.cjs` | `runtime errors: none`；主流程 14 行、备用 4 行、丢失徽标与死包数量与迁移前一致 |
| 交互 | 播放 → 暂停 → 单步 → 表格跳步 → 变速 → 重置 → 场景切换 → 深色 → 进度持久化 | 全部通过，无运行时错误 |

DOM 快照的三类差异（均为预期）：

1. **主 12 状态行**：`服务端 CLOSE_WAIT` → `客户端 FIN_WAIT_2 · 服务端 CLOSE_WAIT`（含详情页「状态观察」同步，§2）。
2. **备用场景 4 行表格端口**：`443` → `80`（D9；每步都重绘整张表，故在 4 个快照里各出现一次）。
3. **主 13 关系类型**：`数据传递` → `请求传递`。原迁移按 §5.2 把响应方向的 FIN 标成 `data`，独立审查指出 FIN 是
   **关闭请求**而非数据；审查整改（§9.1）后两个方向的 FIN 都标 `request`，备用第 3 步因此**恢复旧值** `请求传递`，
   主流程第 13 步则从旧值 `数据传递` 变为 `请求传递`。此项属可见变化，**不在基线截图内**，列在此处供审查确认。

## 4. 四个冻结例外的实际使用

| 字段 | 使用处 | 缺省语义验证 |
|---|---|---|
| `Step.signal` | 仅备用第 4 步（`process` 事件、无 payload）用 `TIME_WAIT 2×MSL` | 其余 17 步均省略，回退 `payload.summary`；单测 B 组断言两者皆无时抛 I5 |
| `Step.caption` | 18 步全部使用（场景字幕 ≠ 逐步详解） | 缺省回退 `description`；单测 B6 用无 caption 的合成数据验证 |
| `Source.description` | 2 条来源各一句（原 `note` 文本） | 缺省不渲染说明行 |
| `Device.stateLabel` | 4 台设备（`Web 服务器` → `服务端`） | 单测 B6b/B6c：删除后回退 `label`，文案仍可成句 |

`Step.signal` 与 `payload.summary` 重合的 17 步**没有**写 `signal`——该字段只用于「无报文的本机动作」。

## 5. traceRow 绑定修复

- 绑定规则：`traceRow.eventRef` → **本步**事件（不按下标）；缺 `eventRef` 时仅本步唯一事件可自动绑定。
- 数组等长：`net.main` / `net.alternate` 由 `steps.map()` 生成，恒等长；无报文步骤为 `null`（TCP 本期无此情况）。
- 消费端三处空安全：`draw()` 的 `packetCat`、`renderTrace()` 的 `now` 与行渲染；`null` 行渲染
  `<td colspan="6">本步为本机操作，无网络报文</td>` 占位行。
- 阴性测试：`eventRef` 指错步骤 → I2；`cat` 与 `payload.cat` 不一致 → I3；非 drop 步骤标 `lost` → I3（实测退出码 1）。

## 6. 校验与门禁实测

| 项 | 结果 |
|---|---|
| L1（Zod） | 1 demo / 1 knowledge / 2 sources / 1 catalog 全部通过；四个可选字段被 `.strict()` 放行 |
| L2（X1–X14） | 0 ERROR / 0 WARN；X6/X9/X10/X13/X14 首次吃到真实事件图 |
| L3（P1–P7） | 真实数据 0 违规；P7（published 必须有来源）首次实际生效 |
| 阴性注入 | `sourceRefs: []` → P7；`licenseStatus: pending` → P2；`checkedAt: 2027-01-01` → P1；非法 `TcpState` → L1（错误路径精确到 `initialState.client.tcp-state.0.to`）；非 drop 标 lost → 适配层 I3。全部退出码 1 |
| `npm run check` | 六段 exit 0（build-data → check-content → **isokit 双链路 18+18 段** → motion → paths → tsc → content-data：65 + 70 项） |

## 7. 偏差与遗留

| # | 项 | 说明 |
|---|---|---|
| 1 | 目录引用未进 X2 | 施工图 §4.8 说由 `validate-content.mts` 复核，但 §3.3 把该文件列为「不动」。本次在适配层用 **I9** 复核（构建失败即报错），未新增规则码、未改校验器 |
| 2 | 备用场景 `description` 与 `caption` 同文 | 旧数据备用场景没有逐步详解；为保证字段非空且不虚构内容，二者取同一段。UI 的详情页读的是 `stepNotes`（主流程），此处暂不显示 |
| 3 | 备用场景详情页显示主流程注 | **迁移前既有行为**：`renderDetail` 用 `current.stepNotes[step]`，与场景无关。本次保持原样（不做无关修复），记为债务 |
| 4 | `content/data.js` 仍保留 | 页面已不加载；作为旧模板兼容数据与 `check-isokit.cjs` 旧链路夹具继续存在（见 §9.2），后续单独提交删除 |
| 5 | `content/mechanisms.js` 双源 | 右栏长文仍来自 JS；M2-B 改六问渲染时删除（T1）。**新增课程必须在此补 `MECHANISM_DETAILS` 条目，否则 `renderNav` 报 TypeError（M2-B 前置条件）** |
| 6 | 报文详情空 | `Packet.fields` / `layers` 本期留空，无抽屉（T4） |
| 7 | 登记不修（独立审查结论） | `stateTextOf` 协议表名硬编码（M2-C 评估）；`app.js` 报文行按下标读取（构建期等长同序保证）；`buildLesson` 的 `sources` 形参未使用 |

## 8. 复现命令

```bash
node scripts/build-data.mts     # 生成 dist/netlab-data.js（构建产物，不入库）
npm run check                   # 六段校验（含双链路渲染回归）
npm start                       # 生成 + 8091 静态服务
node .openai/check-step12.cjs   # 第 12 步视觉基线回归（--update 重录基线）
```

## 9. 独立审查整改（2026-11-13）

### 9.1 FIN 的关系类型：`data` → `request`（协议修正）

- **事实核查**：FIN 是控制标志、不携带应用数据（`Len=0`，60–66 B 空段）；语义是「我这侧不再发送，
  请对端收尾」的**关闭请求**（半关闭，RFC 9293 §3.5）。四次挥手 = 两个方向各一次关闭请求，与
  「谁先发起整个场景」无关，旧映射（响应方向 FIN → `data`）不成立。
- **`control` 为什么不可用**（实测，`renderToStaticMarkup` 渲染四类帧）：`request`/`data` →
  `semantic-edge transfer` + TravelDot 运动粒子；`control`/`check` → `semantic-edge logical`（虚线）+
  **无 TravelDot**。把真实 FIN 段标成 `control` 会让它在动画里静止不动，与报文表和教学演示矛盾；
  且 `check-isokit.cjs` 断言"只有 request/data 有运动点"。修改 renderer 被冻结，故排除。
- **实现**：`relationOf` 对 `cat === 'fin'` 且信号行含 `FIN` 标志 → `request`；`cat` 是**配色分组**
  （备用场景的纯 ACK 也归 `fin` 组），因此必须再看 `payload.summary` 里的 FIN 标志，否则 `ACK u+1`
  会被误标成关闭请求。这是模型暂无 `flags` 字段的临时判据（M2-C 补字段后改读标志位）。
- **影响**：备用第 3 步恢复旧值 `请求传递`；**主流程第 13 步从旧值 `数据传递` 变为 `请求传递`**
  （同为服务端 FIN，旧数据两条流程互相矛盾，现统一为关闭请求）。渲染行为不变（request/data 同为
  transfer，粒子颜色由 `data-packet=fin` 决定）。单测新增 C1b / C5d / C5e，共 70 项。
- 与施工图 §5.2 的偏差：`fin` 分支不再按发起方二分。以本节为准。

### 9.2 渲染回归双链路（审查问题 B1）

`check-isokit.cjs` 原来只读 `content/data.js` —— 通过只能证明旧数据可渲染。现拆成两条链路、共用同一套
渲染断言（ participants/箭头/丢失/暂停/减动效/投影）：

1. **旧链路（保留）**：`content/data.js` → 18 段（原 GitHub 模板兼容性回归）。
2. **新链路（新增）**：`dist/netlab-data.js` → 18 段（14 主 + 4 备），外加消费契约断言：
   七元组形状、槽位在界内、`local` 不伪造传递、标题/信号/字幕/状态文案非空、关系类型在枚举内、
   18 行报文字段完整且 `size` 形如 `66 B`、TCP 课数量契约（14/4/14/4/4 设备/4 地址）。
3. **阴性验证**：删除 `dist/netlab-data.js` → 失败并提示先构建；把某帧 kind 改为 `bogus` → 失败
  （`tcp:main:3 relation kind in enum`）。均退出码 1。

### 9.3 第 12 步视觉基线（审查问题 C）

- 位置：`.openai/baseline-m2a/base-step12.png`（`.openai/` 已 gitignore，与 `baseline-m0/` 四张基线同等待遇，
  是本机回归资产，不随仓库提交）。
- 生成：`node .openai/check-step12.cjs --update`（先 `npm start`）。页面加载**正式产物**
  `dist/netlab-data.js`，走真实播放器与 renderer；跳到主流程第 12 步，截图前断言
  `#flow-count = 12 / 14`、`#diagram-state` 同时含 `FIN_WAIT_2` 与 `CLOSE_WAIT`。
- 验证：`node .openai/check-step12.cjs` → `0 / 5,640,000 differing pixels`，差异即退出码 1。
- 确定性：截图前模拟 `prefers-reduced-motion: reduce`（`data-reduced="true"`），动画粒子不渲染，
  只保留箭头/高亮/文案/表格——否则粒子位置随截图时机漂移，基线无法复现。
- 既有四张 M0 基线未改动。

### 9.4 文档同步（审查问题 D）

- `README.md`：新增「数据源」一节（JSON 为正式数据源、`dist/netlab-data.js` 为构建产物不入库、
  `content/data.js` 保留为兼容与回归夹具）；校验说明更新为双链路 + 70 项；结构说明、文档索引同步。
- `docs/deployment-path-verification.md`：标注旧 404 证据为修复前快照；§3.1 表更新为现值
  `../../dist/netlab-data.js` 并注明构建产物依赖；路径自检计数 37 → 39；复现命令补 `npm run build`。

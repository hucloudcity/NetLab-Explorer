# M2-B 第二阶段：ARP 课程实施记录（arp-resolution）

> 基线 `main @ f66e021`。本文是 C6 交付物：记录课程数据结构、8 步设计、协议语义、
> 测试契约变化、实施过程与回归结果。设计依据见 M2-B 第一、二阶段设计审查记录（会话交付）。

## 1. 目标与范围

在不改动播放器、SVG Renderer、动画机制与 TCP 课程的前提下，基于第一阶段的
G1（按 kind 选字形）/ G2（三设备布局）/ G4（广播逐跳）能力，落地第二门课程
`arp-resolution`（目录 hash `arp`），验证统一数据模型的可复用性。

批准范围：C1 课程级内容契约、C2 渲染计数课程累计、C3 图例三类、C4 ARP 配色、
C5 机制说明、C6 本文档。实施中经批准追加的两处最小修正见 §7。

## 2. 新增/修改文件清单

| 文件 | 变更 |
| --- | --- |
| `content/demos/arp-resolution.json` | 新增：ARP 演示（3 设备 / 2 链路 / 1 场景 8 步） |
| `content/knowledge/NET-04-09.json` | 新增：知识点（六问 + ARP 报文格式 packetStructure），来源仅 RFC 826 |
| `content/catalog.json` | 追加课程 `arp`（order 2）；分组 `question` 改为协议中性文案（见 §7） |
| `content/sources.json` | 追加 `rfc-826`（public-standard，https） |
| `content/mechanisms.js` | 追加 `MECHANISM_DETAILS.arp`（3 节；`foundation`/`readings` 留空，不虚构 CSAPP 材料） |
| `scripts/check-content.mts` | C1：站点级契约改为课程级 + ARP 专项契约（约 40 条断言） |
| `check-isokit.cjs` | C2：报文行按课程累计（TCP 18 + ARP 5 = 23）；新增 ARP 三设备逐帧渲染回归 |
| `scripts/test-view-model.mts` | 单课夹具只取目录中的 tcp 课程（避免 I9 误报；适配层与引擎零改动） |
| `src/app/app.js` | C3：`CATS` 追加 broadcast/response/generic；`#step-count` 随课程同步（见 §7） |
| `src/app/index.html` | 「演示流程 14 步」静态文本加 `id="step-count"`（默认值仍为 14 步） |
| `src/app/scene-motion.css` | C4：追加 `.cat-broadcast/.cat-response/.cat-generic` 与 `svg[data-packet=*]` 浅/深色规则 |
| `docs/sample-demos/arp-resolution.json` | 设计样例 id 改为 `arp-resolution-sample`（运行时课程按授权占用 `arp-resolution`，X12 唯一性冲突只能由样例让出；样例无运行时引用） |

冻结文件（isokit-scene.jsx / isokit-model.mjs / fold-state.ts / view-model.ts / schemas / types / travel-dot / waves / validate-content）本轮**零修改**。

## 3. 课程数据结构

- 拓扑：`a`(host, laptop, 10.0.0.1 / 02:00:00:00:00:0A) — `sw`(switch, switch) — `b`(host, laptop, 10.0.0.2 / 02:00:00:00:00:0B)；广播域 `lan-a` 成员 `[a, sw, b]`（成员语义 = 域内全部设备，含交换机，与 TCP 数据口径一致）。
- 状态分离：`initialState` 只给 `a` 预建 `arp-cache: []`、只给 `sw` 预建 `mac-table: []`（fold 的 fold-state.ts:143 要求目标设备键预存在）；8 步中 `arp-cache` 只写在 `a`、`mac-table` 只写在 `sw`，契约断言强制（check-content `owners()`）。
- 报文类别：Request 两跳 `cat: 'broadcast'`，Reply 两跳 `cat: 'response'`，最后的 IP 数据 `cat: 'generic'`——与 C3 图例三类一一对应。
- `payload.fields` 保留完整协议字段（Opcode / SenderMAC / SenderIP / TargetMAC / TargetIP / SrcMAC / DstMAC），仅供核对与契约断言；用户可见文案全部写在 `signal` / `caption` / `description` / `traceRow.info`。
- 时间与大小：ARP 帧 60 B（42 B 报文按以太网最小帧补齐，与 TCP 表 60/66 B 口径一致），ICMP Echo 74 B；时间为教学相对值。

## 4. 8 步设计（与批准的设计表一致）

| # | 步骤 | 事件 | 状态变化 | traceRow |
| --- | --- | --- | --- | --- |
| 1 | 缓存未命中，创建占位条目 | `process` a→a | a: arp-cache upsert `10.0.0.2 incomplete`（无 MAC） | 无（本地步） |
| 2 | 广播 ARP 请求 | `broadcast` a→域(排除 b) | — | broadcast，A_MAC→FF:FF… |
| 3 | 交换机学习源 MAC 并泛洪 | `broadcast` sw→域(排除 a) | sw: mac-table learn `A@G0/1`（收帧即学） | broadcast，源/目的地址不变 |
| 4 | B 判断目标 IP 是自己 | `process` b→b | — | 无（本地步） |
| 5 | B 单播 ARP 应答 | `unicast` b→sw | sw: mac-table learn `B@G0/2` | response，B_MAC→A_MAC |
| 6 | 交换机查表，单播转发 | `unicast` sw→a | **无**（转发不学习） | response，地址不变 |
| 7 | A 把缓存更新为 reachable | `process` a→a | a: arp-cache upsert `reachable + B_MAC` | 无（本地步） |
| 8 | 用学到的 MAC 封装 IP 数据 | `unicast` a→b（路由经过 sw） | — | generic，10.0.0.1→10.0.0.2 |

5 条报文行 + 3 个本地步；第 12 步像素基线问题不适用于 ARP（无基线），ARP 以本阶段截图为首个视觉基线（`.openai/m2b/`，不入库）。

## 5. 协议语义与关键实现点

- **广播逐跳（G4）**：`lan-a` 成员 − 发送方 − `excludeFrom` 推导唯一接收者。步 2 `excludeFrom:['b']` → 动画送达 sw；步 3 `excludeFrom:['a']` → 送达 b。每跳一个事件，真扇出留给 G3（适配层显式报错）。
- **转发 ≠ 重新生成**：步 3 / 步 6 的事件源是 `sw`，但 payload.fields 中的 Sender MAC/IP、以太网源 MAC 与第一跳逐字段相同；契约断言强制（`broadcast hop 2 keeps SenderMAC/…`）。交换机不改写任何地址字段。
- **收帧即学**：步 3 学 A、步 5 学 B 都发生在「收到帧」时，与该帧是否被应答/转发无关；步 6 明确无 delta（查表命中不产生新表项，同一 MAC 重复出现只刷新老化计时）。
- **两张表独立**：不同设备、不同键（IP↔MAC vs MAC↔端口）、互不写入；`stateTextOf` 对 mac-table 无状态可读，交换机步的状态观察由事件 note 承担（如「已学 02:…:0A@G0/1 · 泛洪到 G0/2」）。
- **缓存生命周期**：incomplete（占位）→ reachable（填充 MAC）；stale/expire 仅在机制说明中讲授，不在本课数据中出现。

## 6. 测试契约变化

- `check-content.mts`：站点级断言改为「2 门课 / 1 组 / 目录序 tcp→arp」；每课声明参与设备数（TCP 4 / ARP 3），槽位边界按各自设备数检查；CSAPP 块改为「写了 foundation 就必须有 readings」+ ARP 显式不得有 readings；TCP 14 步/18 行/第 6 步 lost 等原契约逐条保留。新增 ARP 专项：8 步 / 5 行 / 3 本地步、两跳广播五字段一致、步 3 学 A@G0/1、步 5 学 B@G0/2、步 6 零学习、占位→reachable、两张表 owner 唯一、目录/知识点/来源引用完整。产物来自 vm 沙箱，跨 realm 数组统一按 JSON 文本比较。
- `check-isokit.cjs`：`builtRows` 18 → 23 且按课程断言（TCP 18、ARP 5）；新增 ARP 8 帧逐帧渲染回归（3 参与者、2 条拓扑链路、交换机字形 4 LED 无天线、request/data 帧有粒子与箭头、local 步无路径）。
- `npm run check` 全链路（build-data / validate-content / test-data-model / test-view-model / check-content / check-isokit / check-motion / check-paths / tsc）通过。

## 7. 实施中的两处经批准追加

1. `#step-count`（index.html + app.js 各 1 行）：「演示流程 14 步」原为写死文本，ARP 页会显示错误的 14 步。现绑定 `current.steps.length`（主流程步数）：TCP 仍显示 14 步（切到备用流程也不变，保持原行为），ARP 显示 8 步。
2. 分组 `question` 改为协议中性文案（仅 catalog.json 一处）：原文为 TCP 措辞，会出现在 ARP「来源 → 整理范围」。TCP/ARP 各自的课程与知识内容未动。

## 8. 已知限制与后续事项

- **ARP Reply 的关系类型沿用 `data`**（图内连线显示「数据传递」）：`RelationKind` 无 response 枚举，新增需同步 view-model / app.js RELATIONS / check-isokit / check-content / CSS 五处，本轮按设计审查结论不扩枚举。图内数据包颜色已按 `cat` 区分（response 青色）。
- `data-device` 属性仍按 4 槽位索引表生成，三设备下为 client/router/internet——仅测试用属性，不影响显示（G1/G2 已登记的行为）。
- `relatedKnowledge` 未在 NET-04-08 ↔ NET-04-09 间互联：X3 要求互指，需要修改 TCP 知识点数据，本轮未获批不动。
- B 收到广播后「顺手学习发送方映射」的旁观者效应未建模（步 4 无状态变化），避免与两表分离的主线混淆；已在步骤详解中文字说明。
- 站点品牌「TCP LIFECYCLE」、About 弹窗与 meta description 仍为 TCP 文案：经批准本轮不动，多课程扩展后统一评估是否中性化。
- 多课程下侧栏出现搜索/分类行，步骤列表可视高度变小（滚动查看）——第一阶段 `renderCourseNav` 的既定行为，非本轮引入。
- `docs/sample-demos/arp-resolution.json` 样例 id 改名（见 §2），文档正文中对该文件的路径引用不受影响。

## 9. 回归与验收结果

- `npm run check`：全部通过（2 课 / 1 组 / 3 来源；26 个类型化阶段；23 条报文行；82 项适配层断言；渲染回归 26 built stages + 18 legacy stages）。
- TCP 回归：14 步主流程 + 4 步备用流程双链路渲染全部通过；第 12 步画布区域与 M2-A 基线逐像素比对 **0 差异**（1753×857 区域）；整页差异仅存在于导航/目录/搜索区（多课程 UI），未侵入画布。
- ARP 回归：8 步逐帧渲染通过；UI 冒烟确认步骤数 8、图例三类、表格 8 行含 3 个占位行、3 设备 2 链路、深链 `#arp`、进度 0/2、无备用场景按钮。
- 视觉检查：`.openai/m2b/arp-step02-broadcast.png`（蓝色广播箭头 A→SW）、`arp-step05-reply.png`（青色应答箭头 B→SW）、`arp-step08-data.png`（灰色 IP 数据路径 A→SW→B）、`arp-dark-step03.png`（深色模式可读）。
- 字段一致性与两表独立性：由 check-content.mts 的 ARP 专项断言覆盖（见 §6）。
- Git：本地实施，未提交、未推送；待项目负责人确认后执行提交。

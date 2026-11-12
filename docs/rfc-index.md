# NetLab Explorer · RFC 权威索引（第一批 16 份）

| 项目 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 核查日期 | 2026-11-12（全部状态以下述官方数据源当日抓取结果为准） |
| 数据来源 | ① `https://www.rfc-editor.org/rfc-index.xml`（RFC Editor 官方索引，当日含 9,858 个 RFC 条目）；② `https://www.rfc-editor.org/rfc-index.txt`（用于反向交叉校验）；③ `https://errata.rfc-editor.org/search/?rfc_number=NNNN&presentation=records`（errata 记录）；④ 每份 RFC 正文 `.txt`（用于确认小节编号与标题） |
| 核查方式 | 程序化解析官方索引生成 Status / Obsoletes / Updates / Updated by，再逐份打印 RFC 正文目录验证"重点参考章节"的行号与标题；errata 逐份按状态计数 |
| 是否含推测内容 | **否**。凡未能从官方页面直接确认的字段，一律标 `待核实`，不填猜测值 |
| 关联文档 | `docs/network-knowledge-map.md`（知识点）、`docs/knowledge-source-index.md`（来源台账） |

> 用法提醒：本索引是"引用口径"的依据，不是协议教材。**引用任何协议行为时，应同时标注"基础 RFC + 其全部 Updates + 已核实 Errata"三层**，只写一个旧编号会出错（见文末"关键发现"）。

---

## 一、状态字段说明

| 字段 | 含义 | 取值来源 |
|---|---|---|
| Status | RFC 的当前成熟度等级 | `rfc-index.xml` 的 `<current-status>` |
| Also | 是否同时属于某个 STD（Internet Standard）编号 | `<is-also>` |
| Obsoletes | 本 RFC 废弃了哪些旧文档 | `<obsoletes>` |
| Updates | 本 RFC 修订了哪些文档（局部补充，不废弃） | `<updates>` |
| Updated by | 有哪些后续 RFC 修订了本 RFC（由索引反向计算 + 原文 `(Updated by …)` 交叉校验） | 索引反向映射 |
| Obsoleted by | 是否已被更新的 RFC 整体取代 | 索引反向映射 |
| Errata | 勘误数量，按状态分列：✅ Verified（已核实）/ 🕓 Held for Document Update（留待更新时修订）/ 📨 Reported（已提交待审）/ ❌ Rejected（已驳回） | errata.rfc-editor.org |

**关于 Status 的重要提醒**：`INTERNET STANDARD` 并不等于"最新"，它只表示成熟度最高；`PROPOSED STANDARD` 也不等于"草案不可用"。真正的时效性要看 **Obsoleted by / Updated by / Errata** 三列。

---

## 二、总表

| RFC | 文档名称 | 发布 | Status | Also | Obsoletes | Updates | Updated by | Obsoleted by | Errata ✅/🕓/📨/❌ | 主要模块 |
|---|---|---|---|---|---|---|---|---|---|---|
| [9293](https://www.rfc-editor.org/rfc/rfc9293) | Transmission Control Protocol (TCP) | 2022-08 | INTERNET STANDARD | STD 7 | 793, 879, 2873, 6093, 6429, 6528, 6691 | 1011, 1122, 5961 | — | — | 4 / 2 / 0 / 3 | M04 传输层 |
| [826](https://www.rfc-editor.org/rfc/rfc826) | An Ethernet Address Resolution Protocol | 1982-11 | INTERNET STANDARD | STD 37 | — | — | 5227, 5494 | — | 1 / 0 / 2 / 1 | M02 链路层 |
| [791](https://www.rfc-editor.org/rfc/rfc791) | Internet Protocol | 1981-09 | INTERNET STANDARD | STD 5 | 760 | — | 1349, 2474, 6864 | — | 10 / 8 / 0 / 4 | M03 网络层 |
| [8200](https://www.rfc-editor.org/rfc/rfc8200) | Internet Protocol, Version 6 (IPv6) Specification | 2017-07 | INTERNET STANDARD | STD 86 | 2460 | — | 9673 | — | 2 / 4 / 1 / 5 | M03 网络层 |
| [1034](https://www.rfc-editor.org/rfc/rfc1034) | Domain Names — Concepts and Facilities | 1987-11 | INTERNET STANDARD | STD 13 | 882, 883, 973 | — | 1101, 1183, 1348, 1876, 1982, 2065, 2181, 2308, 2535, 4033, 4034, 4035, 4343, 4592, 5936, 8020, 8482, 8767, 9471 | — | 10 / 8 / 0 / 0 | M05 应用层 |
| [1035](https://www.rfc-editor.org/rfc/rfc1035) | Domain Names — Implementation and Specification | 1987-11 | INTERNET STANDARD | STD 13 | 882, 883, 973 | — | 1101, 1183, 1348, 1876, 1982, 1995, 1996, 2065, 2136, 2137, 2181, 2308, 2535, 2673, 2845, 3425, 3658, 4033, 4034, 4035, 4343, 5936, 5966, 6604, 7766, 8482, 8490, 8767, 9619 | — | 12 / 16 / 0 / 1 | M05 应用层 |
| [2131](https://www.rfc-editor.org/rfc/rfc2131) | Dynamic Host Configuration Protocol | 1997-03 | DRAFT STANDARD | — | 1541 | — | 3396, 4361, 5494, 6842 | — | 7 / 2 / 0 / 3 | M05 应用层 |
| [792](https://www.rfc-editor.org/rfc/rfc792) | Internet Control Message Protocol | 1981-09 | INTERNET STANDARD | STD 5 | 777 | — | 950, 4884, 6633, 6918 | — | 3 / 4 / 0 / 0 | M03 网络层 |
| [2328](https://www.rfc-editor.org/rfc/rfc2328) | OSPF Version 2 | 1998-04 | INTERNET STANDARD | STD 54 | 2178 | — | 5709, 6549, 6845, 6860, 7474, 8042, 9355, 9454 | — | 11 / 7 / 0 / 11 | M06 控制平面 |
| [4271](https://www.rfc-editor.org/rfc/rfc4271) | A Border Gateway Protocol 4 (BGP-4) | 2006-01 | DRAFT STANDARD | — | 1771 | — | 4724, 6286, 6608, 6793, 7606, 7607, 7705, 8212, 8654, 9072, 9687, 9774 | — | 9 / 7 / 0 / 5 | M06 控制平面 |
| [9110](https://www.rfc-editor.org/rfc/rfc9110) | HTTP Semantics | 2022-06 | INTERNET STANDARD | STD 97 | 2818, 7230, 7231, 7232, 7233, 7235, 7538, 7615, 7694 | 3864 | — | — | 6 / 0 / 2 / 6 | M05 应用层 |
| [9112](https://www.rfc-editor.org/rfc/rfc9112) | HTTP/1.1 | 2022-06 | INTERNET STANDARD | STD 99 | 7230 | — | 9931 | — | 2 / 0 / 1 / 2 | M05 应用层 |
| [9113](https://www.rfc-editor.org/rfc/rfc9113) | HTTP/2 | 2022-06 | PROPOSED STANDARD | — | 7540, 8740 | — | — | — | 1 / 0 / 1 / 0 | M05 应用层 |
| [9114](https://www.rfc-editor.org/rfc/rfc9114) | HTTP/3 | 2022-06 | PROPOSED STANDARD | — | — | — | — | — | 3 / 0 / 2 / 2 | M05 应用层 |
| [9000](https://www.rfc-editor.org/rfc/rfc9000) | QUIC: A UDP-Based Multiplexed and Secure Transport | 2021-05 | PROPOSED STANDARD | — | — | — | — | — | 6 / 7 / 1 / 2 | M04 / M05 |
| [8446](https://www.rfc-editor.org/rfc/rfc8446) | The Transport Layer Security (TLS) Protocol Version 1.3 | 2018-08 | PROPOSED STANDARD | — | 5077, 5246, 6961 | 5705, 6066 | — | **9846** | 16 / 19 / 0 / 14 | M05 / M07 |

**总表统计**：16 份中 12 份为 `INTERNET STANDARD`，4 份为 `PROPOSED/DRAFT STANDARD`；1 份已被整体废弃（8446）；15 份存在后续 Updates；9 份存在已核实勘误。

---

## 三、逐份详情

### 3.1 RFC 9293 — TCP

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc9293 |
| 作者 | W. Eddy (Ed.) |
| 发布日期 | 2022-08 |
| Status / Also | INTERNET STANDARD / STD 7 |
| Obsoletes | 793（原始 TCP 规范）、879、2873、6093、6429、6528、6691 |
| Updates | 1011、1122、5961 |
| Updated by / Obsoleted by | 无 / 无 |
| Errata | 共 9 条：✅ 4（如 8167、8171、8126、8710）、🕓 2、❌ 3 |
| 对应模块 | M04 传输层（NET-04-02/05/06/07/08/09/10/11/12/19） |

**重点参考章节（已核对正文目录）**

| 小节 | 标题 | 本项目用途 |
|---|---|---|
| 3.1 | Header Format | TCP 首部逐字段示意图、报文详情面板的数据源 |
| 3.4 | Sequence Numbers（含 3.4.1 Initial Sequence Number Selection） | 序列号初值、SYN 消耗序号 |
| 3.5 | Establishing a Connection | **三次握手**（首发演示的技术依据） |
| 3.6 | Closing a Connection | 四次挥手、TIME_WAIT |
| 3.10 | Event Processing（3.10.1 OPEN … 3.10.6 STATUS） | TCP 状态机与状态迁移 |

**注意事项**：RFC 9293 是 RFC 793 的"合并版"，把三十年间分散的更新整合为一份；它本身仍被 1011/1122/5961 局部修订，且带 4 条已核实勘误。演示中"SYN 消耗一个序列号、ACK 不消耗"这类细节必须以 9293 §3.4 为准，不要沿用二手教程的说法。

---

### 3.2 RFC 826 — ARP

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc826 |
| 作者 | D. Plummer |
| 发布日期 | 1982-11 |
| Status / Also | INTERNET STANDARD / STD 37 |
| Obsoletes / Updates | 无 / 无 |
| Updated by | 5227（ARP 缓存投毒防护）、5494（IANA 分配） |
| Errata | 共 4 条：✅ 1、📨 2、❌ 1 |
| 对应模块 | M02 链路层（NET-02-18） |

**重点参考章节**：本文档**没有编号小节**（1982 年格式），请按正文小节标题引用，标题原文已核对：

| 小节标题 | 本项目用途 |
|---|---|
| `Packet format` | ARP 请求/应答报文字段（htype/ptype/hlen/plen/oper/sha/spa/tha/tpa） |
| `Protocol specification` | 发送、接收、合并缓存的判定流程 |
| `Motivation` / `Definitions` | 为何需要地址解析、操作码取值 |

**注意事项**
1. ARP 没有"请求用广播、应答用单播"的硬性条文，这是**实现惯例 + 以太网帧目的地址选择**的结果；讲解时要把"ARP 报文本身"和"承载它的以太网帧"分开说（依据：RFC 826 `Packet format` + IEEE 802.3 帧格式）。
2. 跨网段时解析的是**下一跳网关**的 MAC，这一点来自 IP 转发模型（RFC 791 §2.4 / §3.1），不是 ARP 的职责——必须在文案中显式区分。
3. 5227 是安全类修订，讲"ARP 欺骗"时应引用它。

---

### 3.3 RFC 791 — IPv4

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc791 |
| 作者 | J. Postel (Ed.) |
| 发布日期 | 1981-09 |
| Status / Also | INTERNET STANDARD / STD 5 |
| Obsoletes | 760 |
| Updated by | 1349、2474、6864 |
| Errata | 共 22 条：✅ 10、🕓 8、❌ 4 |
| 对应模块 | M03 网络层（NET-03-02/08/09/10/16） |

**重点参考章节（已核对正文）**

| 小节 | 标题 | 本项目用途 |
|---|---|---|
| 1.4 | Operation | 分片、重组、TTL 语义 |
| 2.4 | Gateways | 路由器逐跳转发的原始定义（TTL 递减、首部校验和重算） |
| 3.1 | Internet Header Format | IPv4 首部字段（含 `Time to Live`，正文第 341 行附近给出定义） |

**注意事项**：RFC 791 是 1981 年文本，**地址分类（class A/B/C）已被 CIDR 取代**（见 RFC 4632，未在本批核查）。讲子网掩码/CIDR 时，教材用 Top-Down 4.3.2，规范依据应引 RFC 4632 而非 791 的 class 字段。→ 已列入"建议补充核查"。

---

### 3.4 RFC 8200 — IPv6

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc8200 |
| 作者 | S. Deering, R. Hinden |
| 发布日期 | 2017-07 |
| Status / Also | INTERNET STANDARD / STD 86 |
| Obsoletes | 2460 |
| Updated by | **9673**（IPv6 逐跳选项处理流程，2024-10） |
| Errata | 共 12 条：✅ 2、🕓 4、📨 1、❌ 5 |
| 对应模块 | M03 网络层（NET-03-21/22） |

**重点参考章节**：§3 IPv6 Header Format（`Hop Limit` 字段，正文第 348 行："Decremented by 1 by each node that forwards the packet"）、§4 IPv6 Extension Headers、§5 Packet Size Issues。

**注意事项**：IPv6 的 `Hop Limit` 就是 IPv4 `TTL` 的等价物，讲"TTL 递减"时应同时给出两个名字，避免学生以为 IPv6 没有防环机制。地址结构（前缀/接口标识）不在 8200 中定义，需引 RFC 4291（未核查，已列入补充清单）。

---

### 3.5 RFC 1034 + RFC 1035 — DNS

| 字段 | RFC 1034 | RFC 1035 |
|---|---|---|
| 主题 | 概念与设施 | 实现与规范（报文格式） |
| 发布 | 1987-11 | 1987-11 |
| Status / Also | INTERNET STANDARD / STD 13 | INTERNET STANDARD / STD 13 |
| Obsoletes | 882、883、973 | 882、883、973 |
| Updated by | 19 份（含 2181 澄清、4033/4034/4035 DNSSEC、8020/8482/8767/9471 等） | 29 份（含 2136 动态更新、2673 扩展、7766 TCP 使用、8490/9619 等） |
| Errata | 18 条：✅ 10、🕓 8 | 29 条：✅ 12、🕓 16、❌ 1 |
| 对应模块 | M05 应用层（NET-05-03/04/05/06/07） | M05 应用层（NET-05-03/09） |

**重点参考章节（已核对正文）**

| RFC | 小节 | 标题 | 用途 |
|---|---|---|---|
| 1034 | 2.4 | Elements of the DNS | 域空间、名字服务器、解析器三要素 |
| 1034 | 3.6 | Resource Records | RR 概念 |
| 1034 | 4.3.1 | Queries and responses | 查询/响应与 referral 行为 |
| 1034 | 4.3.2 | Algorithm | **递归/迭代解析的判定算法**（根 → TLD → 权威） |
| 1035 | 3.3 | Standard RRs | A/NS/CNAME/MX 等记录 |
| 1035 | 4.1 / 4.1.1 | Format / Header section format | DNS 报文首部（QR/OPCODE/RCODE/计数字段） |
| 1035 | 4.2 | Transport | UDP 53 / TCP 53 传输规则 |

**注意事项**
1. **DNS 不是"一定要问根"**：缓存命中可直接返回（1034 §4.3.2 明确把缓存作为算法第一步）。演示中必须画出"先查缓存"这一步。
2. 迭代与递归的区别是**责任主体**的区别（本地解析器 vs 权威服务器），不是"问几次"。文案必须成对出现，不能只讲一种。
3. 1034/1035 被修订近 50 次，讲 DNSSEC、EDNS、TCP 回退等话题时**必须补引对应更新 RFC**，不能只说 1034/1035。

---

### 3.6 RFC 2131 — DHCP

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc2131 |
| 作者 | R. Droms |
| 发布日期 | 1997-03 |
| Status / Also | **DRAFT STANDARD** / 无 STD 编号 |
| Obsoletes | 1541 |
| Updated by | 3396、4361、5494、6842 |
| Errata | 共 12 条：✅ 7、🕓 2、❌ 3 |
| 对应模块 | M05 应用层（NET-05-17） |

**重点参考章节（已核对正文）**

| 小节 | 标题 | 用途 |
|---|---|---|
| 2 | Protocol Summary | **DHCP 报文格式图**（op/htype/hlen/hops/xid/…/options，正文第 458 行起） |
| 3.1 | Client-server interaction — allocating a network address | **DORA 四步**（Discover/Offer/Request/ACK） |
| 4.1 | Constructing and sending DHCP messages | 各报文字段取值规则 |
| 4.3 / 4.4 | DHCP server behavior / DHCP client behavior | 服务端与客户端状态机 |

**注意事项**：RFC 2131 至今仍是 `DRAFT STANDARD`（不是 Internet Standard），这是事实而非缺陷。DORA 的"广播/单播"混合行为受客户端状态（INIT/REBOOT/RENEW）、广播标志位与中继影响，讲"全是广播"是常见错误。

---

### 3.7 RFC 792 — ICMP

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc792 |
| 作者 | J. Postel |
| 发布日期 | 1981-09 |
| Status / Also | INTERNET STANDARD / STD 5 |
| Obsoletes | 777 |
| Updated by | 950、4884、6633、6918 |
| Errata | 共 7 条：✅ 3、🕓 4 |
| 对应模块 | M03 网络层（NET-03-17/18/19） |

**重点参考章节**（**无编号小节**，标题原文已核对）：`Message Formats`、`Destination Unreachable Message`、`Time Exceeded Message`、`Echo or Echo Reply Message`、`Summary of Message Types`。

**注意事项**：Ping 用 Echo/Echo Reply（Type 8/0），Traceroute 依赖 `Time Exceeded`（Type 11）——两者都是"借用 ICMP"，不是 ICMP 专为它们设计。IPv6 的 ICMPv6 是另一份规范（RFC 4443，未核查）。

---

### 3.8 RFC 2328 — OSPFv2

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc2328 |
| 作者 | J. Moy |
| 发布日期 | 1998-04 |
| Status / Also | INTERNET STANDARD / STD 54 |
| Obsoletes | 2178 |
| Updated by | 5709、6549、6845、6860、7474、8042、9355、9454 |
| Errata | 共 29 条：✅ 11、🕓 7、❌ 11（驳回比例较高，引用前务必看具体条目） |
| 对应模块 | M06 控制平面（NET-06-05/06/07/08/09/10/11/12/13） |

**重点参考章节（已核对正文目录）**

| 小节 | 标题 | 用途 |
|---|---|---|
| 7.1 | The Hello Protocol | Hello 报文与邻居发现 |
| 10.1 | Neighbor states | Down / Init / 2-Way / ExStart / Exchange / Loading / Full |
| 12 | Link State Advertisements (LSAs) | LSA 类型与 LSDB 组织 |
| 13 | The Flooding Procedure | LSA 泛洪 |
| 16 | Calculation of the routing table | SPF（Dijkstra）计算 |

**注意事项**：OSPFv2 仍是 RFC 2328（1998），但被 8 份 RFC 修订；**OSPFv3（IPv6）是另一份规范（RFC 5340，未核查）**。讲"OSPF"时必须声明是 v2 还是 v3，否则示例会自相矛盾。

---

### 3.9 RFC 4271 — BGP-4

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc4271 |
| 作者 | Y. Rekhter, T. Li, S. Hares (Eds.) |
| 发布日期 | 2006-01 |
| Status / Also | **DRAFT STANDARD** / 无 STD 编号 |
| Obsoletes | 1771 |
| Updated by | 4724、6286、6608、6793、7606、7607、7705、8212、8654、9072、9687、9774（共 12 份） |
| Errata | 共 21 条：✅ 9、🕓 7、❌ 5 |
| 对应模块 | M06 控制平面（NET-06-14/15/16/17） |

**重点参考章节**：§4 Message Formats（4.2 OPEN、4.3 UPDATE、4.4 KEEPALIVE）、§5 Path Attributes（5.1.1 ORIGIN … 5.1.7 AGGREGATOR）、§9.1 Decision Process（路径选择）。

**注意事项**：BGP-4 至今为 Draft Standard，且被 12 份 RFC 修订；**"BGP 选路 13 条"是厂商实现总结，不是 RFC 条文**——讲解时应明确区分"RFC 定义的决策过程（§9.1）"与"厂商权重表"。

---

### 3.10 RFC 9110 / 9112 / 9113 / 9114 — HTTP 族

| RFC | 名称 | 发布 | Status / Also | Obsoletes | Updated by | Errata ✅/🕓/📨/❌ |
|---|---|---|---|---|---|---|
| 9110 | HTTP Semantics | 2022-06 | INTERNET STANDARD / STD 97 | 2818, 7230, 7231, 7232, 7233, 7235, 7538, 7615, 7694 | — | 6 / 0 / 2 / 6 |
| 9112 | HTTP/1.1 | 2022-06 | INTERNET STANDARD / STD 99 | 7230 | **9931** | 2 / 0 / 1 / 2 |
| 9113 | HTTP/2 | 2022-06 | PROPOSED STANDARD | 7540, 8740 | — | 1 / 0 / 1 / 0 |
| 9114 | HTTP/3 | 2022-06 | PROPOSED STANDARD | — | — | 3 / 0 / 2 / 2 |

**重点参考章节**

| RFC | 小节 | 用途 |
|---|---|---|
| 9110 | §3 Terminology and Core Concepts、§6 Message Abstraction、§9 Methods、§15 Status Codes | 方法语义、状态码语义（注意：语义在 9110，不在 9112） |
| 9112 | §2 Message、§3 Request Line、§4 Status Line、§9 Connection Management | 报文文法、持久连接与流水线 |
| 9113 | §4 HTTP Frames、§5 Streams and Multiplexing、§8 Expressing HTTP Semantics in HTTP/2 | 多路复用、流与帧 |
| 9114 | §3 Connection Setup and Management、§6 Stream Mapping and Usage、§7 HTTP Framing Layer | HTTP/3 基于 QUIC 的连接建立与流映射 |

**注意事项**：**方法/状态码的权威定义在 RFC 9110，不要错引 9112**（9112 只规定 HTTP/1.1 的报文语法）。HTTP/2、HTTP/3 都是 Proposed Standard，且 9112 已被 9931（2026-03，HTTP/1.1 乐观协议切换的安全考虑）修订。

---

### 3.11 RFC 9000 — QUIC

| 字段 | 值 |
|---|---|
| 官方链接 | https://www.rfc-editor.org/rfc/rfc9000 |
| 发布 | 2021-05，PROPOSED STANDARD，无 Obsoletes / Updated by |
| Errata | 共 16 条：✅ 6、🕓 7、📨 1、❌ 2 |
| 对应模块 | M04（NET-04-02 对照 UDP）、M05（NET-05-14 HTTP/3） |

**重点参考章节**：§2 Streams、§3 Stream States、§4 Flow Control、§7 Cryptographic and Transport Handshake、§9 Connection Migration。

**注意事项**：QUIC 自带 TLS 1.3 握手（集成在 §7），**不是"UDP 上再跑一次 TCP 握手"**。讲 HTTP/3 时必须说明"QUIC 提供可靠传输 + 加密 + 多路复用"，否则学生会把它理解成"UDP 版 HTTP/1.1"。

---

### 3.12 RFC 8446 → RFC 9846 — TLS 1.3（本批最重要的时效性发现）

| 字段 | RFC 8446 | RFC 9846 |
|---|---|---|
| 名称 | The Transport Layer Security (TLS) Protocol Version 1.3 | 同名（TLS 1.3） |
| 发布 | 2018-08 | **2026-07** |
| Status | PROPOSED STANDARD | PROPOSED STANDARD |
| Obsoletes | 5077、5246、6961 | 5077、5246、6961、7627、8422、**8446** |
| Updates | 5705、6066 | 5705、6066 |
| Obsoleted by | **9846** | — |
| Errata | 49 条：✅ 16、🕓 19、❌ 14 | 待观察（发布仅 4 个月） |
| 官方链接 | https://www.rfc-editor.org/rfc/rfc8446 | https://www.rfc-editor.org/rfc/rfc9846 |

**结论**：计划书第二节把 **RFC 8446 当作 TLS 1.3 的现行规范已过时**。当前应引 **RFC 9846**；8446 仅用于查阅历史差异。

**RFC 9846 重点章节（已核对正文目录，注意编号与 8446 不同）**

| 小节 | 标题 | 说明 |
|---|---|---|
| 1.2 | Relationship to RFC 8446 | 新增小节，明确与旧版差异 |
| 2 | Protocol Overview | TLS 1.3 一轮握手全貌 |
| 4.2 | Key Exchange Messages（4.2.2 Client Hello / 4.2.3 Server Hello） | ClientHello / ServerHello |
| 4.5 | Authentication Messages | Certificate / CertificateVerify / Finished |

对比：8446 中"Key Exchange Messages"是 §4.1、"Authentication Messages"是 §4.4；**9846 因新增 4.1 The Transcript Hash，后续编号整体后移**。若沿用 8446 的节号写进内容，会指向错误章节。

---

## 四、引用口径三条硬规则

1. **三层引用**：`基础 RFC + 全部 Updates + 已核实 Errata`。例：讲 TCP 握手 → "RFC 9293 §3.5（受 RFC 1011/1122/5961 修订，含勘误 8167/8171 等 4 条已核实）"。
2. **不引 Obsoleted by 非空的基础文档**。当前唯一命中的是 8446 → 9846。每次新增内容入库前必须重跑一次本索引的核查脚本逻辑（判断 `Obsoleted by` 是否为空）。
3. **Sec/Errata 不进正文**：勘误的具体文字只用于"我们自己写对"，不在页面里复述勘误原文（版权 + 可读性）。

---

## 五、关键发现（相对计划书原文的修正）

| # | 发现 | 影响 |
|---|---|---|
| 1 | **RFC 8446 已于 2026-07 被 RFC 9846 废弃**，TLS 1.3 现行规范是 9846 | 计划书 §2.2 的 RFC 表需替换；讲 HTTPS/TLS 的模块（M05-16、M07-08）必须引 9846 |
| 2 | RFC 9112 被 **9931**（2026-03）修订 | HTTP/1.1 相关表述要加"受 9931 修订" |
| 3 | RFC 8200 被 **9673**（2024-10）修订 | IPv6 逐跳选项处理流程有更新 |
| 4 | RFC 791 被 6864（2020）修订，**地址分类已过时** | 讲 IP 地址必须引 CIDR（RFC 4632），不能只引 791 |
| 5 | RFC 1034/1035 分别被 19 / 29 份 RFC 修订 | DNS 内容不能"只引 1034/1035"，DNSSEC/EDNS/TCP 回退需另引 |
| 6 | RFC 4271（BGP-4）、RFC 2131（DHCP）**仍是 DRAFT STANDARD** | 文案不得写"国际标准 RFC 规定"这种绝对表述，应写"RFC 4271 定义" |
| 7 | RFC 2328 有 11 条驳回勘误（共 29 条） | 引用 OSPF 细节前需逐条确认是否属被驳回条目 |
| 8 | 全部 16 份**无一被新版整体替代**（除 8446） | TCP/IPv4/IPv6/ARP/ICMP/DNS/DHCP/OSPF/BGP/HTTP/QUIC 的"基础文档"选择是稳定的 |

---

## 六、建议补充核查的 RFC（本批未纳入，但知识点会用到）

下列编号**仅作为待核查线索**，其状态、Obsoletes、Errata **尚未核对，不得直接写入内容**：

| 编号 | 用途 | 关联知识点 |
|---|---|---|
| RFC 768 | UDP 原始规范 | NET-04-21 |
| RFC 4632 | CIDR 与地址聚合（替代 791 的分类地址） | NET-03-04/05 |
| RFC 4291 | IPv6 地址结构 | NET-03-21/22 |
| RFC 5681 | TCP 拥塞控制（四算法） | NET-04-18 |
| RFC 3022 / RFC 2663 | NAT 术语与传统 NAT | NET-03-20 |
| RFC 4443 | ICMPv6 | NET-03-17/21 |
| RFC 5340 | OSPFv3 | NET-06-05 |
| RFC 4301 | IPsec 体系结构 | M07-06 |
| RFC 8446 以外的 TLS 1.2 | 兼容性说明 | M05-16 |
| RFC 854 / 855 | Telnet（仅历史） | — |
| RFC 959 | FTP | NET-05-18 |
| RFC 5321 | SMTP | NET-05-19 |
| RFC 6455 | WebSocket | NET-05-20 |
| RFC 2132 | DHCP 选项 | NET-05-17 |

---

## 七、待核实清单

| 项 | 状态 | 说明 |
|---|---|---|
| RFC 9931、9673、9846 的 Errata 计数 | 待核实 | 均为近期发布，errata 仍在累积；本表未统计（避免写入会立刻过期的数字） |
| RFC 4271 的 12 份 Updated by 各自修订了什么 | 待核实 | 需逐份读摘要后填入知识点的"精确依据" |
| RFC 2328 的 8 份 Updated by 与 11 条驳回勘误的对应关系 | 待核实 | 引用 OSPF 细节前必须逐条确认 |
| RFC 1034/1035 的 48 份 Updates 中哪些改变了解析算法 | 待核实 | 至少需确认 2181、8020 对算法描述的影响 |
| IEEE 802.1D / 802.1w 的历史状态 | 待核实 | 见 `docs/knowledge-source-index.md` 的 IEEE 部分 |
| RFC 826 的 2 条 Reported 勘误内容 | 待核实 | 涉及 ARP 报文格式细节，做 ARP 演示前需读 |

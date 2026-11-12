# NetLab Explorer · 知识来源索引与授权台账

| 项目 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编制日期 | 2026-11-12 |
| 覆盖范围 | 九大模块 165 个知识点（见 `docs/network-knowledge-map.md`）的来源映射 |
| 数据来源 | 各级官方站点当日抓取（HTTP 状态、页面标题、章节/条款文本）+ RFC Editor 官方索引 + errata 站点 |
| 记录原则 | **一条来源一条记录**，字段固定；未核实的字段写 `待核实`，不写"应该是" |
| 关联文档 | `docs/rfc-index.md`（16 份 RFC 的逐份状态）、`docs/network-knowledge-map.md`（知识点） |

> 核心原则（计划书 §2）：**教材负责教学组织，标准负责技术准确性，厂商资料负责工程实践，实验负责验证结果。** 来源等级只代表"用途与权威性"，不代表"可以随便引用"——每一级都有自己的授权边界，见第五节。

---

## 一、来源分级

| 级别 | 类型 | 用途 | 可引用范围 | 本项目使用方式 |
|---|---|---|---|---|
| **A** | 正式技术标准（RFC / IEEE） | 判定"协议行为是否准确"的唯一依据 | 可引用条款编号与规范原文含义；**不搬运正文段落** | 每个协议类知识点必须至少挂 1 条 A 级来源 |
| **B** | 权威教材与大学课程（Top-Down / CSAPP / Systems Approach） | 决定教学顺序、概念引入方式、类比与图示结构 | 只参考其**组织方式与解释思路**；正文/插图/习题一律不复制 | 决定知识地图的模块顺序与知识点粒度 |
| **C** | 厂商官方资料（Cisco / NetAcad / Juniper / Cloudflare） | 补充真实设备的行为、配置语义、工程经验 | 参考其技术描述；**配置示例与图表不搬运**，命令必须标注"厂商特定" | 用于教材与标准都没覆盖的工程类知识点（M06/M07/M08/M09） |
| **D** | 实验与抓包工具（Wireshark / Mininet / GNS3 / Packet Tracer） | 验证"我们写的协议行为在真实报文里是否成立" | 工具本身按各自许可证使用；**样本抓包需逐文件确认授权** | 每个首发演示必须有 1 条 D 级验证记录 |

**不得越级替代**：不能用厂商文档证明协议行为，不能用教材插图代替报文结构图，不能用抓包"看起来是这样"推翻 RFC。

---

## 二、来源字段规范

第三阶段的数据模型将直接采用下列字段（`sourceId` 为主键）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sourceId` | string | ✅ | 全局唯一，命名规则见 2.1 |
| `type` | enum | ✅ | `rfc` / `ieee` / `textbook` / `vendor` / `lab` |
| `name` | string | ✅ | 资料名称（原文名，不翻译） |
| `author` | string | ✅ | 作者或组织 |
| `version` | string | ✅ | 版本 / 编号 / 年号（如 `RFC 9293`、`9th ed.`、`802.1Q-2022`） |
| `url` | string | ✅ | 官方地址（**不使用镜像站、转载站、网盘**） |
| `purpose` | string | ✅ | 这条来源用于核对什么（一句话，动词开头） |
| `sections` | string[] | ⬜ | 具体章节/条款；不确定就留空，**不填猜测值** |
| `checkedAt` | string \| null | ✅ | 最后核对日期（`YYYY-MM-DD`）；未核对填 `null` |
| `license` | string | ✅ | 授权状态，取值见 2.2 |

### 2.1 sourceId 命名规则

```
rfc-9293                    RFC 编号
ieee-8021q-2022             IEEE 标准 + 版本年
book-td9e                   Top-Down 9th edition
book-csapp3e                CSAPP 3rd edition
book-systems6e              Systems Approach 6th edition
vendor-cisco                Cisco 官方文档
lab-wireshark               Wireshark 工具
lab-ws-samples              Wireshark 样本抓包库
```

规则：全小写、连字符分隔、**不含年份以外的修饰词**；同一来源换版本时新增 ID（如 `ieee-80211-2024`），不覆盖旧 ID，以便追溯"某条内容当年依据的是哪一版"。

### 2.2 license 取值

| 取值 | 含义 |
|---|---|
| `public-standard` | 公开标准文档，可引用条款，禁止转载正文/图表 |
| `paid-standard` | 付费标准，只能引用编号与条款名，正文不可获取/不可转载 |
| `copyright-textbook` | 版权教材，仅供内部参考与改写，禁止复制正文/插图/习题 |
| `vendor-copyright` | 厂商版权资料，可参考描述，禁止搬运配置示例与图表 |
| `open-source-BSD` / `open-source-GPL` | 开源工具，按其许可证使用 |
| `proprietary-freeware` | 免费但闭源，禁止再分发 |
| `per-file-review` | 需逐文件核查（如样本抓包） |
| `pending` | 尚未核实，**不得进入正式发布内容** |

### 2.3 内容状态（与来源分离，记在知识点上）

| 状态 | 含义 | 允许发布 |
|---|---|---|
| `original` | 完全原创撰写 | ✅ |
| `adapted` | 参考资料后用自己的语言重写 | ✅（须标来源） |
| `third-party` | 直接使用第三方素材 | ❌ 需先获授权 |
| `permission-required` | 已识别需授权，尚未取得 | ❌ |
| `license-verified` | 已完成许可证核查 | ✅ |

---

## 三、A 级来源：正式技术标准

### 3.1 RFC Editor

| sourceId | 名称 | 组织 | 版本 | URL | purpose | license | checkedAt |
|---|---|---|---|---|---|---|---|
| `rfc-editor` | RFC Editor（RFC 系列官方发布与检索入口） | RFC Editor / IETF | 持续更新 | https://www.rfc-editor.org/ | 查询 RFC 编号、状态、Updates/Obsoletes、勘误 | `public-standard` | 2026-11-12 |

**本批已核查的 16 份 RFC**（逐份状态、Obsoletes、Updates、Updated by、Errata 见 `docs/rfc-index.md`，此处只列 ID 与用途）：

| sourceId | 版本 | purpose | sections | license | checkedAt |
|---|---|---|---|---|---|
| `rfc-9293` | RFC 9293 (2022-08) | 核对 TCP 首部、序列号、连接建立与关闭、事件处理 | 3.1 / 3.4 / 3.5 / 3.6 / 3.10 | `public-standard` | 2026-11-12 |
| `rfc-826` | RFC 826 (1982-11) | 核对 ARP 报文格式与请求/应答处理 | Packet format / Protocol specification | `public-standard` | 2026-11-12 |
| `rfc-791` | RFC 791 (1981-09) | 核对 IPv4 首部、TTL、网关转发 | 1.4 / 2.4 / 3.1 | `public-standard` | 2026-11-12 |
| `rfc-8200` | RFC 8200 (2017-07) | 核对 IPv6 首部与 Hop Limit、扩展首部 | 3 / 4 / 5 | `public-standard` | 2026-11-12 |
| `rfc-1034` | RFC 1034 (1987-11) | 核对 DNS 概念、资源记录、解析算法 | 2.4 / 3.6 / 4.3.1 / 4.3.2 | `public-standard` | 2026-11-12 |
| `rfc-1035` | RFC 1035 (1987-11) | 核对 DNS 报文格式与传输 | 3.3 / 4.1 / 4.1.1 / 4.2 | `public-standard` | 2026-11-12 |
| `rfc-2131` | RFC 2131 (1997-03) | 核对 DHCP 报文格式与 DORA | 2 / 3.1 / 4.1 / 4.3 / 4.4 | `public-standard` | 2026-11-12 |
| `rfc-792` | RFC 792 (1981-09) | 核对 ICMP 报文类型与 Echo/Time Exceeded | Message Formats 等（无编号小节） | `public-standard` | 2026-11-12 |
| `rfc-2328` | RFC 2328 (1998-04) | 核对 OSPFv2 Hello、邻居状态、LSA、泛洪、SPF | 7.1 / 10.1 / 12 / 13 / 16 | `public-standard` | 2026-11-12 |
| `rfc-4271` | RFC 4271 (2006-01) | 核对 BGP-4 报文、路径属性、决策过程 | 4 / 5 / 9.1 | `public-standard` | 2026-11-12 |
| `rfc-9110` | RFC 9110 (2022-06) | 核对 HTTP 语义、方法、状态码 | 3 / 6 / 9 / 15 | `public-standard` | 2026-11-12 |
| `rfc-9112` | RFC 9112 (2022-06) | 核对 HTTP/1.1 报文文法与连接管理 | 2 / 3 / 4 / 9 | `public-standard` | 2026-11-12 |
| `rfc-9113` | RFC 9113 (2022-06) | 核对 HTTP/2 帧、流与多路复用 | 4 / 5 / 8 | `public-standard` | 2026-11-12 |
| `rfc-9114` | RFC 9114 (2022-06) | 核对 HTTP/3 连接建立与流映射 | 3 / 6 / 7 | `public-standard` | 2026-11-12 |
| `rfc-9000` | RFC 9000 (2021-05) | 核对 QUIC 流、流控、握手、连接迁移 | 2 / 3 / 4 / 7 / 9 | `public-standard` | 2026-11-12 |
| `rfc-9846` | RFC 9846 (2026-07) | 核对 TLS 1.3 握手（**替代 RFC 8446**） | 1.2 / 2 / 4.2 / 4.5 | `public-standard` | 2026-11-12 |
| `rfc-8446` | RFC 8446 (2018-08) | 仅用于查阅 TLS 1.3 历史版本差异（**已被 9846 废弃**） | 2 / 4.1 / 4.4 | `public-standard` | 2026-11-12 |

**尚未核查、仅登记线索的 RFC**（`license` 均为 `public-standard`，`checkedAt` 为 `null`，**不得直接引用**）：

`rfc-768`（UDP）、`rfc-4632`（CIDR）、`rfc-4291`（IPv6 寻址）、`rfc-5681`（TCP 拥塞控制）、`rfc-3022`（NAT）、`rfc-4443`（ICMPv6）、`rfc-5340`（OSPFv3）、`rfc-4301`（IPsec）、`rfc-959`（FTP）、`rfc-5321`（SMTP）、`rfc-6455`（WebSocket）、`rfc-2132`（DHCP 选项）、`rfc-1812`（路由器要求）、`rfc-2453`（RIP）、`rfc-5798`（VRRP）、`rfc-5415`（CAPWAP）、`rfc-5280`（X.509 证书）、`rfc-4987`（TCP SYN Flood 对策）、`rfc-1122`（主机要求）。

### 3.2 IEEE

| sourceId | 名称 | 组织 | 版本 | URL | purpose | sections | license | checkedAt |
|---|---|---|---|---|---|---|---|---|
| `ieee-8023-2022` | IEEE Standard for Ethernet | IEEE | **802.3-2022**（另有 802.3-2022/Cor 2 维护修订） | https://standards.ieee.org/ | 核对以太网帧格式、MAC 地址、PHY 与速率 | 待核实（需购标） | `paid-standard` | 2026-11-12（版本年号已核对 ieee802.org/3 页面） |
| `ieee-8021q-2022` | IEEE Standard for Local and Metropolitan Area Networks — Bridges and Bridged Networks | IEEE 802.1 | **802.1Q-2022**（802.1Q 修订项目在进行中） | https://standards.ieee.org/ | 核对 VLAN、802.1Q 标签、交换机转发与桥接 | 待核实（需购标） | `paid-standard` | 2026-11-12（版本已核对 1.ieee802.org 项目页） |
| `ieee-80211-2024` | IEEE Standard for Information Technology — Wireless LAN MAC and PHY | IEEE 802.11 | **802.11-2024**（另见 802.11be-2024，Wi-Fi 7） | https://standards.ieee.org/ | 核对 802.11 帧、关联过程、RSN/WPA2/WPA3 | 待核实（需购标） | `paid-standard` | 2026-11-12（版本已核对 ieee802.org/11 页面） |
| `ieee-8021x-2020` | IEEE Standard for Local and Metropolitan Area Networks — Port-Based Network Access Control | IEEE 802.1 | **802.1X-2020**（P802.1X-2020-Rev 修订在进行中） | https://standards.ieee.org/ | 核对 802.1X 认证的三方角色与 EAP 交互 | 待核实（需购标） | `paid-standard` | 2026-11-12（版本已核对 1.ieee802.org 项目名） |
| `ieee-8021d` | IEEE Standard for MAC Bridges（含 STP/RSTP 历史定义） | IEEE 802.1 | **版本待核实**（RSTP 原为 802.1w，后并入 802.1D-2004，桥接内容现以 802.1Q 为准） | https://standards.ieee.org/ | 核对 STP/RSTP 端口状态与收敛 | 待核实 | `paid-standard` | 2026-11-12（仅确认存在 802.1D 项目，**现行状态未核实**） |
| `ieee-8021ax` | IEEE Standard for Link Aggregation | IEEE 802.1 | **版本待核实** | https://standards.ieee.org/ | 核对链路聚合（LACP） | — | `paid-standard` | null |

> **必须知道的坑**：IEEE 标准是**付费文档**。我们只能引用"标准编号 + 条款名"，**不能引用条款正文**，更不能把标准里的图搬进页面。涉及 STP/VLAN 帧格式等细节时，落地写法应为"依据 IEEE 802.1Q-2022 的标签格式定义"这种**指认式引用**，而不是复述条文。

---

## 四、B 级来源：教材与课程

| sourceId | 名称 | 作者 | 版本 | URL | purpose | sections | license | checkedAt |
|---|---|---|---|---|---|---|---|---|
| `book-td9e` | Computer Networking: A Top-Down Approach | James F. Kurose, Keith W. Ross（Pearson） | **9th ed.**（Pearson 商品页 `editionValue=9th`，`copyright=2026`；作者站点标注 © 2010–2025） | https://gaia.cs.umass.edu/kurose_ross/ ；商品页 https://www.pearson.com/en-us/subject-catalog/p/computer-networking-a-top-down-approach/P200000013385 | 决定知识体系与教学顺序（主教材） | 已核对 1.1–1.5、2.1–2.4、3.1–3.8、4.1–4.5、5.1–5.7、6.1–6.7、7.1–7.6、8.1–8.9 | `copyright-textbook` | 2026-11-12 |
| `book-csapp3e` | Computer Systems: A Programmer's Perspective | Randal E. Bryant, David R. O'Hallaron（CMU） | **3rd ed.（CS:APP3e）** | https://csapp.cs.cmu.edu/ | 补充系统基础、Socket 编程、并发服务器 | 网络编程章（**章号待核实**，见待核实表） | `copyright-textbook` | 2026-11-12 |
| `book-systems6e` | Computer Networks: A Systems Approach | Larry Peterson, Bruce Davie | **6th ed.**（站点标注 6.2-dev；另有 7th Edition Preview） | https://book.systemsapproach.org/ | 进阶：体系结构、转发机制、性能 | Ch1 Foundation / Ch3 Internetworking / Ch5 End-to-End Protocols / Ch6 Congestion Control | `copyright-textbook` | 2026-11-12 |

### 4.1 教材使用红线（对应计划书 §8）

1. **不复制正文**：Top-Down 的段落、定义、例子一律重写。我们的知识点必须用"自己的话 + 自己的例子"。
2. **不复制插图**：包括"TCP 状态迁移图""封装层次图"这类经典图。它们看着通用，但具体画法受版权保护。所有示意图必须是本项目原创（现有 `isokit` 等距场景即原创资产）。
3. **不使用课件与习题**：Kurose 站点上的 PPT 明确带版权声明，"能下载"不等于"能商用"。题库同理——这是最容易踩的坑，因为题目看起来"只是一道题"。
4. **章节号可以引**：`9E 3.5.6 TCP Connection Management` 这种"指认式引用"是合理使用，不构成复制。
5. **CSAPP 只作补充**：它不是网络教材，不能承担网络知识体系；且**不再引用任何第三方中文镜像**（原项目的 `hansimov.gitbook.io` 链接已判定不可用）。

---

## 五、C 级来源：厂商与社区文档

| sourceId | 名称 | 组织 | 版本 | URL | purpose | license | checkedAt |
|---|---|---|---|---|---|---|---|
| `vendor-cisco` | Cisco Support & Documentation | Cisco | 持续更新 | https://www.cisco.com/c/en/us/support/index.html | 补充交换机/路由/ACL/NAT/无线设备的实际行为与命令语义 | `vendor-copyright` | 2026-11-12（站点可达） |
| `vendor-netacad` | Cisco Networking Academy | Cisco | 持续更新 | https://www.netacad.com/ | 了解认证类课程的知识组织顺序 | `vendor-copyright` | 2026-11-12（站点可达） |
| `vendor-juniper` | Juniper Networks Documentation | Juniper | 持续更新 | https://www.juniper.net/documentation/ | 补充路由协议与网络架构的另一种实现视角 | `vendor-copyright` | 2026-11-12（站点可达） |
| `vendor-cloudflare` | Cloudflare Learning Center | Cloudflare | 持续更新 | https://www.cloudflare.com/learning/ | DNS / CDN / TLS / DDoS 的通俗解释与产业视角 | `vendor-copyright` | 2026-11-12（**返回 403，抓取被拒**；链接本身有效，内容未核对） |

**使用规则**
1. 厂商命令必须显式标注"以下为 Cisco 设备示例"，且**不得作为协议原理的依据**（例：`switchport mode trunk` 是配置方法，VLAN 标签格式来自 IEEE 802.1Q）。
2. 厂商图表、拓扑示例、配置片段一律不搬运；需要图示时自行绘制虚构拓扑。
3. Cloudflare 页面属"科普向"，只能用于类比与对外行解释，**不能用于判定协议行为**（例如它的 DNS 缓存描述比 RFC 简化很多）。

---

## 六、D 级来源：实验与验证

| sourceId | 名称 | 组织 | 版本 | URL | purpose | license | checkedAt |
|---|---|---|---|---|---|---|---|
| `lab-wireshark` | Wireshark | Wireshark Foundation | 持续更新 | https://www.wireshark.org/ | 抓包验证协议字段、时序与标志位 | `open-source-GPL` | 2026-11-12（站点可达；许可证以官方页面为准） |
| `lab-ws-samples` | Wireshark Sample Captures | Wireshark Wiki | 持续更新 | https://wiki.wireshark.org/SampleCaptures | 获取公开样本抓包用于教学示例 | `per-file-review` | 2026-11-12（页面可达，**未见统一授权声明，须逐文件核查**） |
| `lab-mininet` | Mininet | Mininet 项目 | 持续更新 | https://mininet.org/ | 验证交换机/主机/控制器的转发行为 | `open-source-BSD` | 2026-11-12（站点标注 "BSD Open Source"） |
| `lab-gns3` | GNS3 | GNS3 Technologies | 持续更新 | https://www.gns3.com/ | 多设备拓扑与路由协议实验参考 | `pending` | 2026-11-12（站点可达，许可证未在页面确认） |
| `lab-pt` | Cisco Packet Tracer | Cisco Networking Academy | 持续更新 | https://www.netacad.com/courses/packet-tracer | 初学者拓扑与路由交换实验参考 | `proprietary-freeware` | 2026-11-12（站点可达） |

**使用规则**
1. 样本抓包**未逐文件确认授权前不得进入正式内容**（计划书 §2.5 明确要求）。
2. 我们自己生成的抓包（本地虚拟机 + 虚构 IP）优先，既无授权风险，也能保证拓扑是虚构的。
3. Mininet/GNS3/Packet Tracer 只作为"验证手段与实验设计参考"，**平台本身不依赖它们运行**。

---

## 七、知识点 → 来源映射

### 7.1 第一批 15 个知识点

| 知识点 | ID | 教材 | 标准 | 实验 | 备注 |
|---|---|---|---|---|---|
| 网络通信基础 | NET-01-03 | `book-td9e` 1.3.1 / 1.5.2 | — | `lab-wireshark` | 用一次真实请求的抓包说明"封装" |
| OSI 七层模型 | NET-01-06 | `book-td9e` 1.5.1 | — | — | 注意：OSI 是教学模型，**不是实现模型**，必须与 TCP/IP 四层并列讲 |
| TCP/IP 协议栈 | NET-01-07 | `book-td9e` 1.5.1 / 1.5.2 | `rfc-1122` ⏳ | — | ⏳ 未核查，暂不给条款 |
| MAC 地址 | NET-02-05 | `book-td9e` 6.4.1 | `ieee-8023-2022` | `lab-wireshark` | 48 位、OUI、单播/组播位 |
| VLAN | NET-02-11 | `book-td9e` 6.4.4 | `ieee-8021q-2022` | `lab-mininet` | 标准只能指认，不能引条文 |
| **ARP** | NET-02-18 | `book-td9e` 6.4.1 | **`rfc-826`** | `lab-wireshark` / `lab-ws-samples` | 样本抓包需授权核查 |
| IPv4 | NET-03-02 | `book-td9e` 4.3.2 | `rfc-791`、`rfc-4632` ⏳ | `lab-wireshark` | 分类地址已过时，必须用 CIDR |
| 子网掩码 | NET-03-04 | `book-td9e` 4.3.2 | `rfc-4632` ⏳ | — | 纯计算类 |
| 默认网关 | NET-03-07 | `book-td9e` 4.3.2 | `rfc-791` §2.4 | — | 与 ARP 联动才有意义 |
| 路由表 | NET-03-10 | `book-td9e` 4.1.1 / 5.1 | `rfc-1812` ⏳ | — | ⏳ 未核查 |
| TCP | NET-04-02 | `book-td9e` 3.5 | `rfc-9293` | `lab-wireshark` | — |
| **TCP 三次握手** | NET-04-08 | `book-td9e` 3.5.6 | **`rfc-9293` §3.5** | `lab-wireshark` | 已完成实现，可作为其它演示的模板 |
| **DNS** | NET-05-03 | `book-td9e` 2.4 | **`rfc-1034` §4.3.2 / `rfc-1035` §4.1** | `lab-wireshark` | 五个参与者，需扩展拓扑 |
| DHCP | NET-05-17 | `book-td9e` 6.7.1 | `rfc-2131` §3.1 | `lab-wireshark` | 教材无独立小节，DORA 只能靠 RFC |
| ICMP | NET-03-17 | `book-td9e` 5.6 | `rfc-792` | `lab-wireshark` | 无编号小节，按标题引用 |

### 7.2 三个首发演示的"三源齐备"检查

| 演示 | 教材（讲法） | 标准（准度） | 实验（验证） | 是否齐备 |
|---|---|---|---|---|
| TCP 三次握手 | 9E 3.5.6 | RFC 9293 §3.5 | Wireshark 抓握手 | ✅ 齐备 |
| ARP 地址解析 | 9E 6.4.1 | RFC 826 `Packet format` / `Protocol specification` | Wireshark 抓 ARP Request/Reply | ⚠️ 教材对"广播帧"着墨少，需补 IEEE 802.3 帧格式（指认式） |
| DNS 域名解析 | 9E 2.4.2 | RFC 1034 §4.3.2、RFC 1035 §4.1 | Wireshark 抓查询/响应 | ✅ 齐备（但 1034/1035 被 48 份 RFC 修订，需注意边界） |

### 7.3 模块级默认来源组合

| 模块 | 主教材 | 主标准 | 工程补充 | 验证 |
|---|---|---|---|---|
| M01 网络基础 | `book-td9e` 第 1 章 | — | `vendor-netacad` | `lab-wireshark` |
| M02 链路层 | `book-td9e` 6.1–6.4 | `ieee-8023-2022`、`ieee-8021q-2022`、`rfc-826` | `vendor-cisco` | `lab-wireshark`、`lab-mininet` |
| M03 网络层 | `book-td9e` 4.1–4.3 | `rfc-791`、`rfc-8200`、`rfc-792` | `vendor-cisco` | `lab-wireshark`、`lab-gns3` |
| M04 传输层 | `book-td9e` 3.1–3.7 | `rfc-9293`、`rfc-768` ⏳ | — | `lab-wireshark` |
| M05 应用层 | `book-td9e` 2.1–2.6 | `rfc-1034/1035`、`rfc-2131`、`rfc-9110–9114`、`rfc-9000`、`rfc-9846` | `vendor-cloudflare` | `lab-wireshark` |
| M06 控制平面 | `book-td9e` 5.1–5.4 | `rfc-2328`、`rfc-4271` | `vendor-cisco`、`vendor-juniper` | `lab-gns3` |
| M07 安全 | `book-td9e` 8.1–8.9 | `rfc-9846`、`rfc-4301` ⏳、`ieee-8021x-2020` | `vendor-cisco`、`vendor-cloudflare` | `lab-wireshark` |
| M08 无线 | `book-td9e` 7.1–7.5 | `ieee-80211-2024`、`ieee-8021x-2020` | `vendor-cisco` | `lab-wireshark`（无线抓包需特定网卡） |
| M09 工程实践 | `book-td9e` 6.7（视角） | 视具体协议 | `vendor-cisco`、`vendor-juniper` | `lab-gns3`、`lab-pt` |

---

## 八、版权与授权状态

### 8.1 总体判断

| 资产 | 当前状态 | 风险 | 处置 |
|---|---|---|---|
| 教学内容文字 | 尚未产出 | — | 全部按 `original` 或 `adapted` 标注，`adapted` 必须挂来源 |
| 教材正文/插图/课件/习题 | **不使用** | 高（商业站最容易出事的地方） | 红线，见 4.1 |
| 厂商文档描述 | 可参考改写 | 中 | 改写 + 标注"厂商实现" |
| 厂商配置示例与拓扑图 | **不搬运** | 高 | 自行绘制虚构拓扑 |
| 样本抓包 | 未核查 | 中 | `per-file-review`，未核查不入库 |
| 开源工具与库 | 已记录（`dist/licenses/`） | 低 | 保持现有 notices，新增依赖时同步 |
| 字体 | **无外部 Web 字体**（系统字体栈） | 低 | 继续保持，不引入商业字体 |
| 图标 | 本地 `icons.svg` 雪碧图 | 待核实 | 需确认该雪碧图的原始来源与许可（**已列为待核实**） |
| 站点自有 LICENSE | **仓库根目录无 LICENSE** | 中（Open Core 前必须解决） | 第三阶段补：代码许可证 + 内容许可证分开 |

### 8.2 版权记录字段（随内容一起入库）

每条知识点除 `sources` 外，还需记录：

```jsonc
{
  "contentStatus": "original | adapted | third-party | permission-required | license-verified",
  "authors": ["..."],          // 内容撰写者，便于追责与署名
  "reviewedAt": "YYYY-MM-DD",  // 技术准确性复核日期
  "reviewer": "...",           // 复核人
  "licenseNote": "..."         // 素材授权说明（图片/抓包/字体）
}
```

---

## 九、待核实清单

| 项 | 状态 | 说明 | 影响 |
|---|---|---|---|
| IEEE 802.1D / 802.1w 的现行状态 | 待核实 | 需确认 STP/RSTP 内容是否已完全由 802.1Q-2022 承载 | STP/RSTP 两条知识点的引用口径 |
| IEEE 802.1AX 版本年号 | 待核实 | 链路聚合 | NET-02-17、NET-09-08 |
| 各 IEEE 标准的条款号 | 待核实（需购标） | 现只能指认"标准编号"，无法给出条款号 | 不影响内容正确性，但降低可追溯性 |
| CSAPP 网络编程章的准确章号 | 待核实 | 官方 `/3e/students.html` 同时出现 "Chapter 10: Virtual Memory" 与 "Chapter 12: Network Programming"，与 3e 纸书目录口径不一致 | 引用时只写"网络编程章" |
| Systems Approach 的授权条款 | 待核实 | 在线全文可读，但是否允许引用需看其许可声明 | 现仅作进阶参考，不引用原文 |
| Wireshark 样本抓包的逐文件授权 | 待核实 | 页面无统一声明 | 未核查前不使用 |
| `icons.svg` 图标来源 | 待核实 | 需确认是自绘还是第三方 | 商用前必须澄清 |
| GNS3 许可证 | 待核实 | 站点未标注 | 仅作工具参考，不影响内容 |
| Cloudflare 页面内容 | 未核对（403） | 抓取被拒，未验证其技术描述 | 只能作科普类比，不作依据 |
| 本仓库 LICENSE | 缺失 | Open Core 前必须补 | 商业化前置条件 |

---

## 十、维护流程（每季度执行一次）

1. **重跑 RFC 状态核查**：抓 `rfc-index.xml`，对 `docs/rfc-index.md` 中每份 RFC 比对 `Obsoleted by` 是否变空/变非空；有变化则在文档顶部加"变更记录"。
2. **重跑 errata 计数**：errata 会持续累积，`checkedAt` 只保留最近一次真实抓取日期。
3. **抽查教材版本**：确认 Top-Down 是否已出第 10 版（若出版，章节号可能整体变化）。
4. **抽查 IEEE 版本年号**：802.11 / 802.3 / 802.1Q 都是滚动修订。
5. **核对失效链接**：对所有 `url` 做一次 HEAD 请求，403/404 需标注而不是删除（保留证据链）。
6. **更新本文件的"最后核查日期"**，并在 `docs/rfc-index.md` 同步。

> 免责声明：本索引记录的是"我们依据什么写的"，不是"内容已经正确"。技术准确性仍需按计划书 §7 的逐条规则复核（TCP 标志位/序号、ARP 广播范围、TTL 递减、DNS 递归迭代、DHCP DORA 等）。

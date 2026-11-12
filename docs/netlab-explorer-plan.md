> **记录说明**
> 本文档为项目计划书原文归档，供后续会话与协作者作为需求基线使用。
> 记录时间：2026-11-12 · 记录人：WorkBuddy · 代码底座：`cs-systems-design-tcp`
> 原文未做删改；仅在文末追加「执行状态」小节，用于跟踪阶段进度。

---

# NetLab Explorer 网络知识体系与权威资料索引

**文档版本：** V1.0  
**项目名称：** NetLab Explorer  
**文档用途：** 网络知识体系建设、知识内容研发、交互式教学功能开发  
**主要执行对象：** WorkBuddy / AI 编程助手

---

# 一、项目背景与目标

NetLab Explorer 是一个面向个人学习者和企业培训场景的网络原理可视化与交互实验平台。

它不是普通的网络知识博客，也不是简单的网络题库。

平台希望通过以下学习闭环帮助用户理解网络技术：

1. 知识解释：理解一个技术是什么、为什么存在。
2. 原理演示：通过动画观察协议和网络设备如何工作。
3. 交互实验：调整参数、模拟不同场景、观察结果。
4. 结果验证：通过实验和问题检查是否真正理解。

目前项目已经完成基础复刻，需要逐步建立一套完整、可靠、可持续扩展的网络知识体系。

本项目不能长期只依靠 CSAPP 作为知识来源。

需要建立多来源知识体系：

| 来源类型 | 主要职责 |
|---|---|
| 计算机网络教材 | 构建知识体系、教学顺序和基础解释 |
| RFC 协议标准 | 确保互联网协议行为、字段和状态准确 |
| IEEE 标准 | 确保以太网、无线网络等链路技术准确 |
| 厂商技术文档 | 补充真实网络设备的工程实现 |
| 实验和抓包工具 | 验证知识内容与实际报文是否一致 |
| 自主整理的知识内容 | 形成 NetLab Explorer 自己的教学体系 |

核心原则：

**教材负责解释知识，标准负责保证准确，工程资料负责补充实践，实验负责验证结果。**

注意：所有资料只作为研究、核对和知识整理依据。网站内容必须经过重新组织和原创表达，不得直接复制受版权保护的教材文字、插图、课件和习题。

---

# 二、权威资料来源总表

## 2.1 主教材

### 首选教材：Computer Networking: A Top-Down Approach

作者：James F. Kurose、Keith W. Ross  
出版社：Pearson  
建议版本：第 9 版，2025 年版。

官方网站：

https://gaia.cs.umass.edu/kurose_ross/

出版社：

https://www.pearson.com/en-us/subject-catalog/p/computer-networking-a-top-down-approach/P200000013385

教材特点：

- 从应用层向下讲解网络原理。
- 涵盖 HTTP、DNS、TCP、UDP、IP、路由、链路层、无线网络和网络安全。
- 兼顾原理解释和实验实践。
- 适合作为 NetLab Explorer 的主要知识组织依据。

建议将其作为第一主教材。

### 补充教材：Computer Systems: A Programmer's Perspective（CSAPP）

用途：

- 计算机系统基础。
- 网络编程。
- Socket。
- 客户端与服务器通信。
- 并发服务器。
- 网络应用程序的实现。

定位：

CSAPP 不是完整的计算机网络教材，不承担 NetLab Explorer 全部网络知识体系的建设任务。

它主要用于补充计算机系统与网络编程相关内容。

### 补充教材：Computer Networks: A Systems Approach

官方网站：

https://book.systemsapproach.org/

用途：

- 网络体系结构。
- 网络协议设计。
- 网络转发机制。
- 网络性能。
- 网络架构和工程实践。

主要作为进阶参考资料，不作为第一阶段的主教材。

---

## 2.2 RFC 协议标准

官方网站：

https://www.rfc-editor.org/

RFC Editor 是互联网协议标准文档的重要发布与查询入口。

后续所有协议类知识点，都应该尽可能关联对应的 RFC 文档。

第一批重点 RFC：

| 技术领域 | RFC 编号 | 文档名称 | 主要用途 |
|---|---|---|---|
| TCP | RFC 9293 | Transmission Control Protocol | TCP 基本协议行为 |
| ARP | RFC 826 | An Ethernet Address Resolution Protocol | IPv4 地址解析 |
| IPv4 | RFC 791 | Internet Protocol | IPv4 数据报与转发基础 |
| IPv6 | RFC 8200 | Internet Protocol, Version 6 | IPv6 基础 |
| DNS | RFC 1034 | Domain Names - Concepts and Facilities | DNS 概念与机制 |
| DNS | RFC 1035 | Domain Names - Implementation and Specification | DNS 报文与实现 |
| DHCP | RFC 2131 | Dynamic Host Configuration Protocol | DHCP 工作过程 |
| ICMP | RFC 792 | Internet Control Message Protocol | IPv4 ICMP |
| OSPF | RFC 2328 | OSPF Version 2 | OSPFv2 |
| BGP | RFC 4271 | A Border Gateway Protocol 4 | BGP 基础 |
| HTTP | RFC 9110 | HTTP Semantics | HTTP 语义 |
| HTTP/1.1 | RFC 9112 | HTTP/1.1 | HTTP/1.1 消息格式 |
| HTTP/2 | RFC 9113 | HTTP/2 | HTTP/2 |
| HTTP/3 | RFC 9114 | HTTP/3 | HTTP/3 |
| QUIC | RFC 9000 | QUIC: A UDP-Based Multiplexed and Secure Transport | QUIC 传输协议 |
| TLS | RFC 8446 | The Transport Layer Security (TLS) Protocol Version 1.3 | TLS 1.3 |

建议使用以下 URL 访问：

- https://www.rfc-editor.org/rfc/rfc9293
- https://www.rfc-editor.org/rfc/rfc826
- https://www.rfc-editor.org/rfc/rfc791
- https://www.rfc-editor.org/rfc/rfc8200
- https://www.rfc-editor.org/rfc/rfc1034
- https://www.rfc-editor.org/rfc/rfc1035
- https://www.rfc-editor.org/rfc/rfc2131
- https://www.rfc-editor.org/rfc/rfc792
- https://www.rfc-editor.org/rfc/rfc2328
- https://www.rfc-editor.org/rfc/rfc4271
- https://www.rfc-editor.org/rfc/rfc9110
- https://www.rfc-editor.org/rfc/rfc9112
- https://www.rfc-editor.org/rfc/rfc9113
- https://www.rfc-editor.org/rfc/rfc9114
- https://www.rfc-editor.org/rfc/rfc9000
- https://www.rfc-editor.org/rfc/rfc8446

注意：

RFC 文档可能存在更新、废弃、被替代或补充的情况。

WorkBuddy 在整理资料时，需要检查 RFC 页面中的：

- Status
- Obsoletes
- Updates
- Updated by
- Errata

不能只因为某份 RFC 编号较早，就认为它仍然是当前完整规范。

特别是 IPv4、TCP、DNS 等协议，需要留意后续更新和补充规范。

---

## 2.3 IEEE 技术标准

官方网站：

https://standards.ieee.org/

重点关注：

| 标准 | 技术内容 | 对应知识 |
|---|---|---|
| IEEE 802.3 | Ethernet | 以太网 |
| IEEE 802.1Q | VLAN | VLAN 标签和桥接网络 |
| IEEE 802.1D | MAC Bridges | 网桥与生成树相关历史基础 |
| IEEE 802.1w | Rapid Spanning Tree | RSTP |
| IEEE 802.11 | Wireless LAN | 无线局域网 |

说明：

IEEE 标准主要用于核对链路层、以太网、VLAN、无线网络等技术。

不要把 IEEE 标准、RFC 和厂商配置手册混为一谈。

例如：

- VLAN 的标准依据应关注 IEEE 802.1Q。
- Cisco 的 VLAN 配置命令只是厂商实现方式。
- ARP 的协议依据是 RFC 826。
- 交换机 MAC 学习和转发还需要结合桥接技术标准理解。

---

## 2.4 厂商技术资料

### Cisco

官方网站：

https://www.cisco.com/c/en/us/support/index.html

Networking Academy：

https://www.netacad.com/

主要用途：

- 网络基础知识。
- VLAN。
- STP。
- 路由。
- OSPF。
- ACL。
- NAT。
- 无线网络。
- 网络故障排查。

### Juniper

官方网站：

https://www.juniper.net/documentation/

主要用途：

- 路由原理。
- 路由协议。
- 网络架构。
- 交换技术。
- 网络设备实现。

### Cloudflare Learning Center

官方网站：

https://www.cloudflare.com/learning/

主要用途：

- DNS。
- CDN。
- HTTP。
- HTTPS。
- TLS。
- DDoS。
- 网络安全。
- 互联网基础设施。

厂商资料的定位是补充实际工程实现和通俗解释，不能代替协议标准。

---

## 2.5 实验验证资料

### Wireshark

官方网站：

https://www.wireshark.org/

用户指南：

https://www.wireshark.org/docs/wsug_html_chunked/

用途：

- 观察真实网络报文。
- 验证协议字段。
- 观察请求与响应。
- 验证 TCP 状态和标志位。
- 分析 DNS、ARP、DHCP、ICMP 等报文。

建议作为平台知识研发的重要验证工具。

### Wireshark Sample Captures

https://wiki.wireshark.org/SampleCaptures

用途：

- 获取公开样本抓包。
- 研究典型协议报文。
- 制作知识讲解和实验案例。

使用样本前需要检查具体文件的授权条件。

### Mininet

官方网站：

http://mininet.org/

用途：

- 创建虚拟网络拓扑。
- 观察主机、交换机和控制器之间的关系。
- 验证网络转发行为。
- 后续开发网络实验时作为参考。

### GNS3

官方网站：

https://www.gns3.com/

用途：

- 网络设备实验。
- 路由协议实验。
- 多设备拓扑。
- 网络故障排查场景。

### Cisco Packet Tracer

官方网站：

https://www.netacad.com/courses/packet-tracer

用途：

- 网络拓扑学习。
- 路由交换实验。
- 初学者网络模拟。

注意：上述工具用于验证、参考和辅助实验，不意味着 NetLab Explorer 必须依赖这些工具才能运行。

---

# 三、NetLab Explorer 网络知识体系

平台第一阶段只聚焦计算机网络。

暂时不扩展物理、化学、地理等其他学科。

知识分类建议如下：

## 模块 01：网络基础

目标：建立计算机网络的整体认知。

知识点：

1. 什么是计算机网络
2. 计算机网络的组成
3. 网络通信的基本过程
4. 网络拓扑
5. 网络协议
6. OSI 七层模型
7. TCP/IP 协议栈
8. 封装与解封装
9. 数据包、数据段、数据帧
10. 单播、广播和组播
11. 带宽、吞吐量和延迟
12. 网络设备的基本作用

主要参考：

- Computer Networking: A Top-Down Approach
- CSAPP
- Cisco Networking Academy

演示建议：

- 数据封装与解封装。
- 数据从客户端到服务器的传输过程。
- 不同网络设备在通信过程中的作用。

## 模块 02：物理层与链路层

目标：理解数据如何在局域网中传输。

知识点：

1. 物理层的作用
2. 传输介质
3. 双绞线与光纤
4. 以太网基础
5. MAC 地址
6. MAC 地址表
7. 交换机 MAC 地址学习
8. 交换机转发
9. 未知单播
10. 广播帧
11. VLAN
12. Access 端口
13. Trunk 端口
14. IEEE 802.1Q 标签
15. STP
16. RSTP
17. 链路聚合
18. ARP

主要参考：

- Top-Down Approach 链路层章节
- IEEE 802.3
- IEEE 802.1Q
- IEEE 802.1D / 802.1w
- RFC 826
- Cisco 技术资料

重点演示：

- 交换机 MAC 地址学习。
- 未知单播泛洪。
- 广播帧转发。
- VLAN 隔离。
- Trunk 标签处理。
- ARP 地址解析。
- STP 环路与阻塞端口。

## 模块 03：网络层

目标：理解 IP 寻址、路由和跨网段通信。

知识点：

1. 网络层的作用
2. IPv4 地址
3. 二进制与十进制转换
4. 子网掩码
5. CIDR
6. 网络地址与广播地址
7. 默认网关
8. IP 数据报
9. TTL
10. 路由表
11. 直连路由
12. 静态路由
13. 默认路由
14. 下一跳
15. 最长前缀匹配
16. 路由转发
17. ICMP
18. Ping
19. Traceroute
20. NAT
21. IPv6 基础
22. IPv6 地址与路由

主要参考：

- Top-Down Approach 网络层章节
- RFC 791
- RFC 8200
- RFC 792
- Cisco 路由技术资料

重点演示：

- IP 路由转发。
- 不同网段之间的通信。
- 最长前缀匹配。
- TTL 递减。
- 默认路由匹配。
- NAT 地址转换。
- Ping 与 Traceroute 工作过程。

## 模块 04：传输层

目标：理解端到端通信和可靠传输。

知识点：

1. 传输层的作用
2. TCP 与 UDP
3. 端口号
4. Socket
5. TCP 报文段
6. TCP 首部
7. TCP 标志位
8. TCP 三次握手
9. TCP 四次挥手
10. TCP 状态机
11. TCP 序列号
12. TCP 确认号
13. TCP 重传
14. 超时重传
15. 快速重传
16. 流量控制
17. 滑动窗口
18. 拥塞控制
19. MSS
20. MTU
21. UDP 数据报

主要参考：

- Top-Down Approach 传输层章节
- CSAPP 网络编程章节
- RFC 9293
- RFC 768
- RFC 5681 等 TCP 拥塞控制资料
- Wireshark

重点演示：

- TCP 三次握手。
- TCP 四次挥手。
- TCP 序列号与确认号。
- TCP 滑动窗口。
- TCP 重传。
- UDP 与 TCP 的区别。
- TCP 连接状态变化。

## 模块 05：应用层

目标：理解常见互联网应用协议。

知识点：

1. 应用层的作用
2. 客户端与服务器
3. DNS
4. DNS 查询过程
5. DNS 递归查询
6. DNS 迭代查询
7. DNS 缓存
8. HTTP
9. HTTP 请求与响应
10. HTTP 方法
11. HTTP 状态码
12. HTTP/1.1
13. HTTP/2
14. HTTP/3
15. HTTPS
16. TLS
17. DHCP
18. FTP
19. SMTP
20. WebSocket
21. CDN 基础

主要参考：

- Top-Down Approach 应用层章节
- RFC 1034
- RFC 1035
- RFC 2131
- RFC 9110
- RFC 9112
- RFC 9113
- RFC 9114
- RFC 8446
- Cloudflare Learning Center

重点演示：

- DNS 域名解析。
- DHCP DORA。
- HTTP 请求与响应。
- HTTPS 握手。
- DNS 缓存。
- HTTP/1.1 与 HTTP/2 的差异。

## 模块 06：路由协议与网络控制平面

目标：理解网络设备如何学习路由和维护网络可达性。

知识点：

1. 控制平面与数据平面
2. 路由协议基础
3. 静态路由与动态路由
4. RIP
5. OSPF
6. OSPF 邻居建立
7. OSPF 邻接关系
8. Hello 报文
9. DR 与 BDR
10. LSA
11. LSDB
12. SPF 算法
13. OSPF 路由计算
14. BGP 基础
15. AS 自治系统
16. BGP 邻居
17. BGP 路径选择

主要参考：

- Top-Down Approach 网络控制平面章节
- RFC 2328
- RFC 4271
- Cisco 和 Juniper 路由协议文档

重点演示：

- OSPF 邻居建立。
- OSPF 状态变化。
- LSA 泛洪。
- SPF 路由计算。
- BGP AS 之间的路由传播。

## 模块 07：网络安全

目标：理解网络通信中常见的安全机制。

知识点：

1. 网络安全基础
2. ACL
3. 防火墙
4. NAT 与安全边界
5. VPN
6. IPSec
7. SSL VPN
8. TLS
9. 数字证书
10. 对称加密与非对称加密
11. DNS 安全基础
12. ARP 欺骗
13. DNS 欺骗
14. SYN Flood
15. DDoS
16. 网络访问控制
17. 802.1X

主要参考：

- Top-Down Approach 网络安全章节
- RFC 8446
- RFC 4301
- IEEE 802.1X 相关标准
- Cisco 安全技术文档
- Cloudflare Learning Center

重点演示：

- TLS 握手。
- 数字证书验证过程。
- 防火墙访问控制。
- ACL 匹配过程。
- 802.1X 认证过程。

## 模块 08：无线网络

目标：理解无线局域网的基本工作机制。

知识点：

1. 无线网络基础
2. IEEE 802.11
3. SSID
4. BSSID
5. 无线信道
6. 2.4GHz 与 5GHz
7. 6GHz
8. 无线漫游
9. AP
10. AC / WLC
11. CAPWAP
12. 无线认证
13. WPA2
14. WPA3
15. 802.1X
16. 无线干扰
17. 信号强度
18. 无线网络优化

主要参考：

- Top-Down Approach 无线网络章节
- IEEE 802.11
- Cisco 无线技术文档
- Wireshark 无线抓包资料

重点演示：

- 无线终端接入过程。
- AP 与无线控制器关系。
- 无线认证过程。
- 无线漫游。
- 无线信道冲突。

## 模块 09：网络工程与综合实践

目标：将网络原理和实际企业网络运维场景联系起来。

知识点：

1. 企业网络基本架构
2. 接入层、汇聚层、核心层
3. 园区网架构
4. 数据中心网络基础
5. 出口网络
6. 双机热备
7. VRRP
8. 链路冗余
9. 路由冗余
10. 网络故障排查
11. 网络连通性排查
12. VLAN 故障
13. DHCP 故障
14. DNS 故障
15. 路由故障
16. 网络环路
17. 网络性能分析
18. 网络监控
19. 网络变更与风险控制

主要参考：

- Cisco 官方架构与配置文档
- Juniper 官方技术文档
- Mininet
- GNS3
- Wireshark

重点演示：

- 企业网络跨 VLAN 通信。
- 双出口路由。
- 网关冗余。
- 链路故障切换。
- 常见网络故障定位。

---

# 四、第一阶段重点建设的知识点

不要一开始就把上述所有模块全部做成完整页面。

第一阶段先建设三个高质量交互演示：

## 4.1 TCP 三次握手

知识依据：

- Top-Down Approach 传输层章节
- RFC 9293
- Wireshark TCP 抓包

必须准确展示：

1. 客户端发出 SYN。
2. 服务端返回 SYN + ACK。
3. 客户端返回 ACK。
4. 双方连接状态变化。
5. Sequence Number。
6. Acknowledgment Number。
7. SYN、ACK 标志位。
8. TCP 连接建立完成。

交互要求：

- 播放。
- 暂停。
- 单步执行。
- 重置。
- 自动播放。
- 播放速度调整。
- 报文详情。
- 当前状态说明。

扩展实验：

- 服务端端口未监听。
- SYN 报文丢失。
- SYN-ACK 报文丢失。
- 服务端拒绝连接。
- 不同初始序列号的变化。

## 4.2 ARP 地址解析

知识依据：

- RFC 826
- IEEE 802.3
- Top-Down Approach 链路层章节
- Wireshark ARP 抓包

必须准确展示：

1. 主机判断目标 IP 是否属于本地网段。
2. 判断需要解析的是目标主机还是默认网关的 MAC 地址。
3. 查询本地 ARP 缓存。
4. 缓存未命中时发送 ARP Request。
5. ARP Request 以广播帧发送。
6. 目标设备发送 ARP Reply。
7. 发送方更新 ARP 缓存。
8. 后续使用目标 MAC 地址发送以太网帧。

交互要求：

- 修改源 IP。
- 修改目标 IP。
- 修改子网掩码。
- 修改网关。
- 查看 ARP 缓存。
- 观察广播范围。
- 查看 ARP 报文内容。

必须避免错误：

- ARP 不负责跨网段路由。
- 跨网段通信时，主机通常解析默认网关的 MAC，而不是远端服务器的 MAC。
- ARP Request 和 ARP Reply 不能混为一谈。

## 4.3 DNS 域名解析

知识依据：

- RFC 1034
- RFC 1035
- Top-Down Approach 应用层章节
- Wireshark DNS 抓包

必须准确展示：

1. 用户输入域名。
2. 客户端检查本地缓存。
3. 向配置的 DNS 服务器发送查询。
4. DNS 服务器根据缓存或解析过程获取结果。
5. 返回 DNS Response。
6. 客户端获得 IP 地址。
7. 应用程序使用解析结果建立后续通信。

交互要求：

- 修改域名。
- 修改 DNS 服务器。
- 展示 DNS Query。
- 展示 DNS Response。
- 展示查询类型。
- 展示 A、AAAA、CNAME 等记录。
- 展示缓存命中和未命中。

必须准确区分：

- 递归查询。
- 迭代查询。
- DNS 缓存。
- 根域名服务器。
- 顶级域名服务器。
- 权威 DNS 服务器。

---

# 五、知识内容的数据结构要求

平台不能把所有知识内容直接写死在 React 组件中。

建议使用独立的内容数据结构。

每个知识点至少包括以下字段：

| 字段 | 含义 |
|---|---|
| id | 唯一标识 |
| title | 知识点标题 |
| categoryId | 所属知识分类 |
| level | 初级、中级、高级 |
| summary | 简短介绍 |
| what | 是什么 |
| why | 为什么需要 |
| principle | 工作原理 |
| packetStructure | 报文结构 |
| practicalScenario | 实际应用场景 |
| commonProblems | 常见问题 |
| relatedKnowledge | 关联知识点 |
| sources | 参考资料 |
| demoId | 关联动态演示 |
| labId | 关联交互实验 |
| accessLevel | 免费或商业内容 |
| status | 草稿、审核中、已发布 |

其中：

- 内容数据和页面展示分离。
- 知识分类和知识详情分离。
- 演示逻辑和知识说明分离。
- 实验逻辑和知识说明分离。
- 资料来源和知识正文分离。

后续应该支持独立增加知识点，而不需要每次修改页面组件。

## 5.1 知识来源数据结构

每个知识点可以关联多个来源。

建议字段：

| 字段 | 含义 |
|---|---|
| sourceId | 来源唯一编号 |
| type | textbook / rfc / ieee / vendor / lab |
| name | 资料名称 |
| author | 作者或组织 |
| version | 版本 |
| url | 官方来源地址 |
| purpose | 该来源用于核对什么 |
| sections | 具体章节或条款 |
| checkedAt | 最后核对时间 |
| license | 授权说明或许可证状态 |

示例：

```json
{
  "id": "tcp-handshake",
  "title": "TCP 三次握手",
  "sources": [
    {
      "sourceId": "rfc-9293",
      "type": "rfc",
      "name": "Transmission Control Protocol",
      "version": "RFC 9293",
      "url": "https://www.rfc-editor.org/rfc/rfc9293",
      "purpose": "核对 TCP 连接建立、序列号和标志位",
      "sections": ["3.5.1"],
      "checkedAt": null
    }
  ]
}
```

以上只是结构示例。具体章节编号需要在实际查阅资料后确认，不能凭空填写。

---

# 六、内容研发规范

所有知识点必须按照统一模板进行整理。

## 6.1 基础内容模板

每个知识点需要回答：

1. 是什么？
2. 为什么需要它？
3. 它解决了什么问题？
4. 它的工作原理是什么？
5. 实际网络中如何使用？
6. 它和其他知识点有什么关系？
7. 常见错误理解有哪些？

## 6.2 动态演示模板

每个动态演示至少需要：

1. 场景说明。
2. 初始网络拓扑。
3. 参与通信的设备。
4. 数据包或协议报文。
5. 事件执行顺序。
6. 设备状态变化。
7. 当前步骤解释。
8. 最终结果。

支持：

- 播放。
- 暂停。
- 单步。
- 重置。
- 自动播放。
- 速度控制。
- 事件时间线。
- 报文详情。

复杂演示需要支持条件分支和不同实验结果。

## 6.3 交互实验模板

每个实验至少包括：

- 实验目标。
- 实验环境。
- 初始参数。
- 用户可修改的参数。
- 操作步骤。
- 预期结果。
- 实际结果。
- 结果解释。
- 常见错误。
- 实验结论。

---

# 七、技术准确性要求

这是 NetLab Explorer 的核心质量要求。

不能为了动画效果而改变协议原理。

必须特别注意以下规则：

### TCP

- TCP 是面向连接的字节流协议。
- TCP 三次握手的报文标志位和序列号必须准确。
- ACK 确认号代表接收方期望收到的下一个序列号。
- SYN 和 FIN 会消耗序列号空间。
- TCP 的可靠性涉及序列号、确认、重传等机制。
- TCP 流量控制与拥塞控制不能混淆。

### ARP

- ARP 用于 IPv4 地址到链路层地址的解析。
- ARP Request 通常使用广播以太网帧。
- ARP Reply 通常使用单播以太网帧。
- 跨网段通信时，终端通常解析下一跳网关的 MAC 地址。
- ARP 不是路由协议。

### IP

- IP 层负责逻辑寻址和数据报转发。
- 路由器依据路由表进行下一跳选择。
- IPv4 TTL 在每台执行三层转发的路由器上递减。
- 二层交换机普通二层转发不会递减 IP TTL。
- 普通路由转发不会改变源 IP 和目的 IP，NAT 等机制是例外。
- 数据链路层的源、目的 MAC 地址会随每一跳链路发生变化。

### DNS

- DNS 查询不等于一定会访问根域名服务器。
- DNS 缓存可能直接返回结果。
- 递归查询与迭代查询必须准确区分。
- DNS 记录类型不能混淆。
- DNS 解析结果不等于已经建立 TCP 或 QUIC 连接。

### DHCP

- DHCP DORA 通常是 Discover、Offer、Request、ACK。
- DHCP 广播和单播行为可能受到客户端状态、网络环境及中继的影响。
- DHCP Relay 与普通二层广播不能混淆。

### 网络工程

- 普通终端用户不应被描述为直接修改交换机、防火墙等网络设备配置。
- 企业网络场景要体现终端、网络运维人员、设备管理员之间的职责边界。
- 厂商命令和通用协议原理必须分开。
- 示例拓扑、IP 地址和设备名称使用虚构测试数据，不使用真实企业内部信息。

---

# 八、内容版权与商业化要求

NetLab Explorer 计划采用 Open Core 模式：

- 核心功能免费开源。
- 商业模块闭源。
- 未来面向个人和企业提供专业内容及服务。

因此，内容研发需要注意：

1. 可以依据协议标准理解协议行为，并使用自己的语言解释。
2. 不直接复制教材正文。
3. 不直接复制教材图片和原版插图。
4. 不未经许可转载教材课件。
5. 不直接搬运厂商文档中的图片、配置示例和受版权保护内容。
6. 第三方开源代码必须记录许可证。
7. 字体、图标、图片、动画、抓包样本需要检查使用条件。
8. 代码许可证和教学内容素材许可证分开管理。

特别注意：

Kurose 和 Ross 官方网站提供的课件具有版权声明。允许查看和使用课件不代表可以将其直接复制进商业网站。

每份内容都应保留来源记录和授权状态。

建议增加以下内容状态：

- original：原创内容。
- adapted：参考资料后重新整理的内容。
- third-party：第三方内容。
- permission-required：需要额外授权。
- license-verified：已完成许可证核查。

未经核实的第三方素材不得直接进入正式发布内容。

---

# 九、WorkBuddy 执行任务

WorkBuddy 不应直接一次性生成所有网络知识页面。

请按照以下顺序执行。

## 第一阶段：项目现状分析

1. 分析现有 NetLab Explorer 项目结构。
2. 识别当前 React、TypeScript、Vite 的使用方式。
3. 找到现有知识分类、知识页面和演示组件。
4. 识别哪些内容目前写死在组件中。
5. 识别现有知识数据结构。
6. 不修改现有核心代码，先输出分析报告。

交付物：

`docs/architecture-analysis.md`

## 第二阶段：建立知识体系索引

1. 根据本文件建立网络知识分类。
2. 为每个分类建立知识点列表。
3. 为重点知识点关联教材、RFC、IEEE 和实验资料。
4. 建立统一的知识来源数据结构。
5. 标记尚未找到可靠来源的知识点。
6. 标记需要进一步核对的协议细节。
7. 不要虚构教材章节编号或 RFC 条款。

交付物：

- `docs/network-knowledge-map.md`
- `docs/knowledge-source-index.md`
- `docs/rfc-index.md`

## 第三阶段：建立内容数据模型

1. 设计知识点 TypeScript 类型。
2. 设计知识来源 TypeScript 类型。
3. 设计知识分类类型。
4. 设计演示和实验的关联关系。
5. 设计内容状态和 accessLevel 字段。
6. 使用 Zod 对数据结构进行校验。
7. 保证未来可以独立增加知识内容。

交付物：

- `src/types/knowledge.ts`
- `src/types/source.ts`
- `src/schemas/knowledge.schema.ts`
- `docs/content-data-model.md`

具体文件路径需要先根据现有项目结构确定，不要机械覆盖已有实现。

## 第四阶段：整理第一批知识内容

优先整理：

1. 网络通信基础。
2. OSI 七层模型。
3. TCP/IP 协议栈。
4. MAC 地址。
5. VLAN。
6. ARP。
7. IP 地址。
8. 子网掩码。
9. 默认网关。
10. 路由表。
11. TCP。
12. TCP 三次握手。
13. DNS。
14. DHCP。
15. ICMP。

每个知识点必须包含：

- 基本解释。
- 工作原理。
- 实际场景。
- 常见误区。
- 参考资料。
- 关联知识。
- 是否需要动态演示。

先完成知识数据和来源索引，再逐步开发对应页面。

## 第五阶段：建设三个核心交互演示

按照以下顺序：

1. TCP 三次握手。
2. ARP 地址解析。
3. DNS 域名解析。

每个演示都必须先完成协议行为设计，再开发动画。

开发前需要输出：

- 场景设计。
- 事件执行顺序。
- 数据状态定义。
- 报文结构。
- 状态变化。
- 异常分支。
- 验证方法。

不能直接根据静态插图制作动画。

---

# 十、项目开发约束

1. 先分析现有代码，再决定如何扩展。
2. 不要重建整个项目。
3. 不要随意替换已有技术栈。
4. 不要为了扩展而过度设计。
5. 内容与 React 组件分离。
6. 协议计算与动画展示分离。
7. 数据结构需要支持后续扩展。
8. 不要一次生成大量无法验证的代码。
9. 每次完成一个可验证的功能。
10. 每次修改后说明修改文件、修改原因和验证方法。
11. 所有网络知识必须经过技术准确性检查。
12. 所有外部内容必须进行来源和版权检查。
13. 不要自动扫描真实企业网络。
14. 演示和实验默认使用虚构测试拓扑。

---

# 十一、第一阶段验收标准

第一阶段不是要求完成整个网络知识平台，而是建立稳定的知识内容基础。

验收标准：

| 验收项目 | 要求 |
|---|---|
| 知识分类 | 建立九大知识模块 |
| 知识点索引 | 完成第一批核心知识点 |
| 来源索引 | 重点知识点能够关联可靠来源 |
| RFC 索引 | 核心协议具有对应 RFC 记录 |
| IEEE 索引 | 以太网、VLAN、无线网络具备标准来源 |
| 数据模型 | 知识内容与页面组件分离 |
| 内容校验 | 数据能够通过 Zod 校验 |
| 可扩展性 | 能够独立新增知识点 |
| 版权管理 | 能够记录内容来源与授权状态 |
| 技术准确性 | 不存在明显协议原理错误 |

---

# 十二、给 WorkBuddy 的最终执行指令

请将本文件作为 NetLab Explorer 网络知识体系建设的基础需求文档。

你现在的首要任务不是直接开发所有知识页面，而是：

**先理解现有项目，再建立完整的网络知识体系、权威资料索引和可扩展的知识数据模型。**

执行顺序：

1. 阅读并分析现有项目。
2. 输出当前架构分析。
3. 建立九大网络知识模块。
4. 建立知识点与权威资料的映射关系。
5. 建立 RFC、IEEE 和实验资料索引。
6. 设计知识数据模型。
7. 选取 TCP、ARP、DNS 作为第一批重点内容。
8. 输出实施计划，等待确认后再逐步开发。

不要一次性完成所有任务。

每个阶段都必须提供可检查的交付物。

对于无法确认的技术细节，明确标记待核实，不允许编造来源、标准编号或协议行为。

最终目标：

让 NetLab Explorer 拥有一套独立、准确、可持续扩展、能够支撑交互式教学和未来商业化的网络知识体系。

---

## 执行状态

| 阶段 | 交付物 | 状态 | 日期 |
|---|---|---|---|
| 第一阶段 项目现状分析 | `docs/architecture-analysis.md` | 已完成 | 2026-11-12 |
| 第二阶段 知识体系索引 | `docs/network-knowledge-map.md`、`docs/knowledge-source-index.md`、`docs/rfc-index.md`、`docs/tech-decisions.md` | **已完成，待审查** | 2026-11-12 |
| 第三阶段 内容数据模型 | `src/types/*`、`src/schemas/*`、`docs/content-data-model.md` | 未开始 | — |
| 第四阶段 第一批知识内容 | 内容数据 + 来源索引 | 未开始 | — |
| 第五阶段 三个核心演示 | TCP / ARP / DNS | TCP 已有（需按新模型重构）；ARP、DNS 未开始 | — |

**第二阶段关键修正（相对本计划书原文）：**

1. **RFC 8446 已于 2026-07 被 RFC 9846 废弃**，TLS 1.3 的现行规范是 9846；8446 的小节编号（4.1 Key Exchange / 4.4 Authentication）在 9846 中已变为 4.2 / 4.5。详见 `docs/rfc-index.md`。
2. 计划书假设的 "React + TypeScript + Vite" 与现状不符，实际为 React 19 + JavaScript + esbuild；TypeScript 按 ADR-001 渐进引入（只用于数据模型，`tsc --noEmit` 检查，不引入 Vite）。
3. CSAPP 第三方中文镜像已按 ADR-003 停用，改指官方站点。

**底座变更记录：** 2026-11-12 经用户确认，NetLab Explorer 以 `C:/Users/ECCOM/Desktop/项目/cs-systems-design-tcp` 为唯一代码底座，就地扩展，不再另建目录。

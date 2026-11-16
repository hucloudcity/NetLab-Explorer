// Original teaching notes for the TCP lesson. CSAPP chapter links supply foundations;
// the specialist sources remain authoritative for the protocol details.
const CSAPP_READINGS = {
  "tcp": {
    "section": "§11.3",
    "title": "全球 IP 因特网",
    "path": "part3/ch11-network-programming/11.3-the-global-ip-internet",
    "note": "连接提供有序字节流；应用仍需定义消息边界与业务协议。"
  },
  "client": {
    "section": "§11.1",
    "title": "客户端—服务器编程模型",
    "path": "part3/ch11-network-programming/11.1-the-client-server-programming-model",
    "note": "请求、处理、响应；书中明确区分网络交互与数据库事务。"
  }
};

const MECHANISM_DETAILS = {
  "tcp": {
    "sections": [
      {
        "title": "握手是双向序列号同步，不只是“敲门”",
        "body": "SYN、SYN+ACK、ACK 三个报文各自携带确认号，让双方同时证明“我能发、你能收、你能发、我能收”，并就双方的初始序列号达成一致。第三次 ACK 可以捎带应用数据，这正是“三次”而不是“四次”的原因；本页为看清状态变化把它单独作为一步。"
      },
      {
        "title": "半连接是有代价的状态",
        "body": "服务端在 SYN_RCVD 阶段已分配连接资源，并定时重传 SYN+ACK。第三次 ACK 迟迟不来时，半连接会占据队列；攻击者伪造源地址发送大量 SYN，就是 SYN Flood。SYN Cookie 把状态编码进序列号本身，让服务端在握手完成前不必保存半连接。"
      },
      {
        "title": "关闭是两个独立的单向过程",
        "body": "四次挥手中每个方向独立关闭：FIN 只表示本方不再发送，不表示不再接收，中间可能还有数据在飞。TIME_WAIT 等待 2×MSL，是为了让最后的 ACK 丢失时对方重传的 FIN 仍有回应，也让旧连接的迟到报文在网络中自然消亡，不会串进复用相同地址端口的新连接。"
      }
    ],
    "foundation": "§11.3 介绍 TCP 连接与端到端模型，§11.1 的客户端—服务器模型给出 connect、accept、close 的交互位置；协议状态机细节以保留的 RFC 9293 资料为准。",
    "readings": [
      "tcp",
      "client"
    ]
  },
  "arp": {
    "sections": [
      {
        "title": "请求广播、应答单播：一次往返换一个 MAC",
        "body": "主机只知道目的 IP，而二层转发只认 MAC，中间没有目录可查，只能问整个广播域。请求用广播（目的 MAC = FF:FF:FF:FF:FF:FF，Target MAC 填全 0），域内所有设备都会收到；但只有 Target IP 等于本机地址的那一台会回应，而且回的是单播——请求里已经带着发送方的 MAC，应答不需要再广播一次。这就是 ARP 只需要一次往返的原因。"
      },
      {
        "title": "交换机的 MAC 表与主机的 ARP 缓存是两套东西",
        "body": "交换机的 MAC 地址表记录「某个 MAC 从哪个端口来」，靠每个进入帧的源 MAC 学习（收帧即学），查表时看的是目的 MAC；主机的 ARP 缓存记录「某个 IP 对应哪个 MAC」，由 ARP 请求/应答填写。前者在交换机上、按 MAC 索引、服务于转发；后者在主机上、按 IP 索引、服务于封装。一张表学错了只影响这一个二层域，另一张表学错了会让主机把帧发到错误的 MAC 上。"
      },
      {
        "title": "缓存条目的生命周期与它带来的风险",
        "body": "ARP 缓存条目从 incomplete（已发起解析、等待应答）走到 reachable（可用，带老化计时），过期后转 stale（仍可先试用，同时触发再次确认）。条目存在不代表永久可信：对端换网卡、IP 被别的设备接管，主机都只能靠老化与重新解析发现。正因为主机倾向于相信收到的 ARP 应答，局域网内的 ARP 欺骗才能把流量引到攻击者机器上——这也解释了为什么关键网段要做端口安全与动态 ARP 检测。"
      }
    ],
    "foundation": "",
    "readings": []
  }
};

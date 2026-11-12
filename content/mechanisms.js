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
  }
};

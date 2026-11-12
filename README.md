# NetLab Explorer（底座：TCP 连接全流程演示）

> 本项目已定为 **NetLab Explorer** 的代码底座（2026-11-12 确认），后续在此就地扩展为网络知识平台。
> 需求基线：`docs/netlab-explorer-plan.md` · 现状分析：`docs/architecture-analysis.md`

由 `cs-systems-design` 完整版复制并裁剪而来的单主题站点：**页面只保留 TCP 连接全流程这一课**，其余 27 个主题全部移除。核心代码、渲染引擎（IsoKit / React）与交互形式与完整版一致。

## 演示内容

一条 TCP 连接的一生，共 14 步连续时间线：

- 三次握手建立连接（SYN → SYN,ACK → ACK）
- 客户端 / 服务器双向数据传输
- 一段服务器响应丢失后：重复 ACK、SACK、快速重传补齐缺口
- 四次挥手有序关闭（含故障场景「有序关闭：四次挥手与 TIME_WAIT」）

下方「数据包流」按抓包顺序展示序号、时间、源/目的地址、协议、信息与报文大小；左侧列出 14 个步骤；右侧「机制」页签有每步深入注解，「来源」页签标注 RFC 9293 与 CSAPP 出处。播放前处于待机态，点「播放」才开始演示。

## 运行

```bash
npm start        # http://127.0.0.1:8091/（端口 8091，避免与完整版 8090 冲突）
```

## 校验

```bash
npm run check    # 内容契约（1 课 / 2 场景 / 18 阶段）+ IsoKit 渲染回归 + 动效回归
node .openai/smoke-runtime.cjs   # jsdom 运行时冒烟（需先启动 npm start）
node .openai/shot-tcp.cjs        # 截图（puppeteer-core + 本机 Chrome）
```

## 结构说明（相对完整版的主要差异）

- `dist/data.js`：只保留 TCP 一课；GROUPS 只有一个「网络协议」分组；SOURCES 只保留 RFC 9293 与 CSAPP。
- `dist/mechanisms.js`：机制详解只保留 TCP 条目及引用的 CSAPP 阅读条目。
- `dist/index.html`：移除三部分导航、搜索、筛选、知识图谱页签；标题与页脚改为单主题文案。
- `dist/app.js`：进度、标题、详解对单主题适配；关联主题为空时隐藏对应区块；知识图谱代码保留但不会渲染。
- 端口使用 8091。

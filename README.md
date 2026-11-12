# NetLab Explorer（底座：TCP 连接全流程演示）

> 本项目已定为 **NetLab Explorer** 的代码底座（2026-11-12 确认），后续在此就地扩展为网络知识平台。

## 文档索引

| 阶段 | 文档 | 内容 |
|---|---|---|
| 需求基线 | `docs/netlab-explorer-plan.md` | 计划书全文归档（十二节 + 九大模块）+ 执行状态跟踪 |
| 一 · 已完成 | `docs/architecture-analysis.md` | 现状架构分析、差距矩阵、实施计划 S0–S4 |
| 二 · 已完成 | `docs/tech-decisions.md` | 四项技术决策（TS 渐进引入 / 恢复多主题目录 / CSAPP 官方来源 / Git 基线） |
| 二 · 已完成 | `docs/network-knowledge-map.md` | 九大模块 + 165 个知识点 + 依赖关系 + 学习路径 + 动画/实验适配度 |
| 二 · 已完成 | `docs/knowledge-source-index.md` | 四级来源台账、知识点→来源映射、授权状态、维护流程 |
| 二 · 已完成 | `docs/rfc-index.md` | 16 份 RFC 的官方状态复核（Status / Obsoletes / Updates / Errata） |
| 三 · 待启动 | `docs/content-data-model.md`、`src/types/*.ts` | 知识/来源/分类类型与 Zod 校验 |
| M0 · 已完成 | `docs/migration-plan.md` | 源文件归位方案与里程碑状态 |
| M0.1 · 已完成 | `docs/deployment-path-verification.md` | 部署路径验证：相对路径修复、三前缀实测、路径自检护栏 |

> 代码基线：`main` 分支首个提交 `52fba15`（2026-11-12），作为后续改造的回滚点。

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
npm start        # 服务项目根目录（端口 8091，避免与完整版 8090 冲突）
```

- 站点根 `http://127.0.0.1:8091/` 会跳转到页面入口 `http://127.0.0.1:8091/src/app/`（与 GitHub Pages 上访问 `/<repo>/` 行为一致）。

> **部署约定（勿改回根绝对路径）：** 页面内所有本地资源必须用相对路径（`./` 或 `../../`）。GitHub Pages 项目站点部署在 `https://<user>.github.io/<repo>/` 下，任何 `/content/x.js` 这类以 `/` 开头的引用都会指向域名根而 404。详见 `docs/deployment-path-verification.md`。

## 校验

```bash
npm run check    # 六段：内容契约 + IsoKit 渲染回归 + 动效回归 + 部署路径自检 + tsc --noEmit（数据模型类型）+ 内容校验与数据模型测试（L1 Zod / L2 跨引用 / L3 发布门禁 P1–P7 / 65 项独立测试）
node .openai/smoke-runtime.cjs   # jsdom 运行时冒烟（需先启动 npm start）
node .openai/shot-tcp.cjs        # 截图（puppeteer-core + 本机 Chrome）
```

## 结构说明（M0 源文件归位后）

- `content/data.js`：演示数据，只保留 TCP 一课；GROUPS 只有一个「网络协议」分组；SOURCES 只保留 RFC 9293 与 CSAPP。
- `content/mechanisms.js`：机制详解只保留 TCP 条目及引用的 CSAPP 阅读条目。
- `src/app/index.html`：页面入口；移除三部分导航、搜索、筛选、知识图谱页签；标题与页脚为单主题文案。
- `src/app/app.js`：UI 逻辑（进度、标题、详解对单主题适配；关联主题为空时隐藏对应区块）。
- `dist/`：只含构建产物 `isokit.js`（由 `npm run build` 生成）与 `licenses/`。
- 仓库根 `index.html`：仅作站点根跳转页（`meta refresh` → `./src/app/`），CI 一并装配进 `_site/`。
- 资源引用全部相对路径（`../../content/*`、`../../dist/*`），与部署前缀无关；`scripts/check-paths.cjs` 禁止根绝对路径并校验每条引用真实存在。
- 端口使用 8091；`_site/` 为 CI 装配产物，已在 `.gitignore` 中排除。

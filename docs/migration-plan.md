# NetLab Explorer 迁移方案（旧项目 → 新数据模型）

> 版本：**V1.1**（2026-11-12）。V1.0 为第三阶段设计稿；此后 M0/M0.1/M1/M2-P0 已全部落地。
> 前置阅读：`docs/architecture-analysis.md`、`docs/data-model-design.md`、`docs/demo-event-model.md`。
>
> **V1.1 修订说明**（产品边界收敛后）：本文 §三 的 M2/M3/M4 已由
> `docs/product-scope-and-roadmap.md`（V1.1）重排为 **M2-A / M2-B / M2-C**，施工细节见
> `docs/m2a-implementation-plan.md`。对应关系：
>
> | 本文里程碑 | 现状 | 去向 |
> |---|---|---|
> | M0 源文件归位 | ✅ 6213681 / e1e00e4 / ecf3bcb | 保留 |
> | M0.1 部署路径 | ✅ 7d6686f | 保留 |
> | M1 类型 + Zod + 校验器 | ✅ 84fe544 | 保留并冻结 |
> | M2-P0 审计修复 | ✅ b5171bd | 保留 |
> | M2 TCP 数据迁移 | 未开始 | → **M2-A**（本文 §三 M2 的字段级方案已细化进新施工图） |
> | M3 播放控制换代 | **取消独立里程碑** | 并入 M2-A：播放控制一行不改，只换数据来源 |
> | M4 渲染器任意拓扑 | **推迟** | 降级为 M2-B（ARP 撞墙）或 M2-C（DNS 5 设备）的前置子任务，只在撞墙时做 |
> | M5 ARP/DNS 上线 | 未开始 | → **M2-B（ARP）/ M2-C（DNS）** |

---

## 一、源文件位置确认（用户要求的核实项，已查证）

**结论：`dist/app.js` 是正式源文件，不是构建产物**——但这个位置具有误导性：

- `scripts/build.mjs` 只构建一条链：`src/isokit-renderer.jsx` → `dist/isokit.js`（SVG 渲染器 bundle）。
- `dist/app.js`、`dist/data.js`、`dist/mechanisms.js`、`dist/index.html`、`dist/styles.css` 等**没有被任何构建步骤生成**，它们是手工维护、被 `index.html` 以 `<script src>` 直接加载的源文件。历史上多轮功能改造都是直接编辑它们（这正是它们"活着"的原因）。
- **风险**：任何人运行 `npm run build` 不会破坏它们（好事），但路径暗示"生成物"，新人容易误改 `src/` 却看不到效果，或反过来误以为 dist 可整体重生成。
- **处置（M0）**：把手工维护源文件迁到 `content/` 与 `src/app/`（见下），`dist/` 回归纯产物目录。迁移本身是纯移动 + 改 index.html 引用路径 + 改 npm start 校验路径，不动逻辑。

## 二、迁移前基线

- Git 已初始化（当前 HEAD 见 `git log`），工作区要求干净后才开始每个里程碑。
- 每个里程碑独立提交、可独立回滚；回滚命令 `git revert <commit>`（不用 reset --hard）。
- 回归护栏（每里程碑跑一次）：
  1. `npm run check`（内容契约 + IsoKit 静态回归 + 动效回归）；
  2. `.openai/smoke-runtime.cjs` jsdom 冒烟（14 行表格、四类图例、丢失徽标、runtime errors: none）；
  3. puppeteer 截图对比（`.openai/shot-tcp.cjs`），迁移引擎前后**逐像素对比**主视图。

## 三、里程碑

### M0 — 源文件归位（半天级，纯移动）— ✅ 已完成 2026-11-12（commit 6213681 + e1e00e4）
- `dist/app.js|index.html|styles.css|scene-motion.css|favicon.svg|icons.svg` → `src/app/`；`dist/data.js|mechanisms.js` → `content/`；`dist/accuracy-audit.md` → `docs/`。
- **修正**：`isokit.css` 实为构建产物（删除后 `npm run build` 自动重建），保留在 `dist/`，index.html 以 `/dist/isokit.css` 引用。
- 引用改为根绝对路径（`/content/*`、`/dist/isokit.css`），`npm start` 服务项目根，页面入口 `http://127.0.0.1:8091/src/app/`；校验/冒烟/截图脚本与 CI（Pages 装配 `_site`）同步更新。
- **验收结果**：`npm run check` 三绿；冒烟 `runtime errors: none`（主流程 14 行、故障场景 alternate 4 行）；四场景截图与基线逐像素 0 差异。
- ⚠️ **事后发现**：此处改用的根绝对路径在 GitHub Pages 项目站点（`/<repo>/` 子路径）下全部 404，由 M0.1 修正。

### M0.1 — 部署路径修正（半小时级）— ✅ 已完成 2026-11-12
- **问题**：根绝对路径 `/content/*`、`/dist/*` 在仓库子路径部署下指向域名根，实测 4 个资源 404、`LESSONS is not defined`、页面空白。
- **修复**：全部改回相对路径（`../../content/*`、`../../dist/*`）；新增仓库根 `index.html` 作站点根跳转页，CI 装配进 `_site/`。
- **护栏**：`scripts/check-paths.cjs`（零依赖）接入 `npm run check` 与 CI，禁止根绝对路径并校验每条引用真实存在。
- **顺带修复**：关于对话框的 `./licenses/*` 链接在 M0 后失效（应为 `../../dist/licenses/*`），由新护栏发现。
- 详见 `docs/deployment-path-verification.md`。

### M1 — 类型与校验器落地（1 天级）
- `src/types/{knowledge,source,demo}.ts`（按 data-model-design.md / demo-event-model.md 定稿的类型）。
- `src/schemas/*.ts`：Zod schema（**package.json 显式声明 zod 直接依赖**，遵守 ADR-001；esbuild 构建 TS 文件无需配置）。
- `scripts/validate-content.mjs`：tsc --noEmit + 结构校验 + 跨引用校验（见 validation-rules.md），挂进 `npm run check`。
- **验收**：三份样例 JSON 全部通过校验；故意破坏一条引用时校验器报错定位准确。

### M2 — TCP 数据迁移到新模型（1~2 天级）→ **现为 M2-A**（施工图：`docs/m2a-implementation-plan.md`）
- `content/demos/tcp-handshake.json`：以样例为底，并入现站全部 14 步主流程数据（net.main 14 行 → traceRow、stepNotes → description、fault 四次挥手 → fault 场景）。
- knowledge/source 台账初始化：`sources.json`（TCP 相关 4 条来源）+ 15 个首批知识点中的 TCP 系列。
- 旧 `data.js LESSONS.tcp` / `mechanisms.js.tcp` 保持可读（适配层），**页面输出不变**。
- **验收**：冒烟 + 截图全过；新旧数据字段映射表归档（docs/）。

### M3 — 演示引擎替换 app.js 中的播放控制（1 天级）→ **取消独立里程碑**（并入 M2-A：只换数据来源）
- 新 `src/engine/scheduler.mjs`：波次推导（拓扑分层）、fold 状态机（前进/后退/重置/重播/跳转，见 demo-event-model.md §4.2），纯函数 + jsdom 单测。
- app.js 的 `renderStep/播放器` 改为消费引擎输出；删除内嵌的步骤推进逻辑。
- **验收**：单步后退状态正确回滚（fold 重放）；速度调节/自动播放行为不变；截图逐像素对比。

### M4 — 渲染器支持任意拓扑（1~2 天级）→ **推迟**（M2-B 撞墙或 M2-C 前置时才做）
- `src/isokit-model.mjs` 的 `NETWORK_POSITIONS` 硬编码 4 节点 → 按 `participants.length` 与 `layout` 自动布局（保留 4 节点默认布局参数，现有 TCP 视觉零变化）。
- 广播扇出动画（多弧）、多播弧、drop 终止符为新增绘制分支。
- 校验脚本 `nodes.length===4` 断言放宽为与数据一致。
- **验收**：TCP 页面视觉回归零差异；ARP/DNS 样例在引擎中可被播放（内部验证，不必上线）。

### M5 — ARP / DNS 演示上线（后续阶段，本方案不含）→ **现为 M2-B / M2-C**
- 依赖 M1–M4 全部完成；内容准确性按 RFC 826/1034/1035 复核（来源台账 checkedAt 流程）。

## 四、旧代码影响清单（迁移后需要修改什么）

| 位置 | 现状 | 迁移动作 |
|---|---|---|
| `data.js LESSONS` | 演示脚本与知识混在一起 | 拆出 → `content/demos/*.json`；knowledge 字段迁入 knowledge 数据 |
| `mechanisms.js` | 知识正文寄生（绑死演示） | `sections` → KnowledgePoint 六问字段；`sources/readings` → SourceRef |
| `app.js renderTrace/renderDetail` | 直接读 LESSONS/net | 改读引擎 + 新模型（M3）；`CATS` 图例映射进 Packet.cat 枚举 |
| `app.js` 播放控制（started/step/timer） | 内嵌逻辑 | → `src/engine/scheduler.mjs`（M3） |
| `isokit-model.mjs NETWORK_POSITIONS/topologyLinks` | 硬编码 4 节点 | 参数化（M4） |
| `check-content.cjs` | 针对旧 schema 的 18 阶段断言 | 保留旧断言到 M2 结束，之后替换为新校验器 |
| `index.html` 资源路径 | dist/ 直载 | M0 调整 |

**不需要修改**：esbuild 构建、React 渲染器入口、styles.css 主题系统、CI（pages.yml）、`?v=` 缓存机制（沿用）。

## 五、回归保证（旧页面功能不回归）

1. **像素级截图对比**：迁移引擎（M3）与渲染器（M4）前后各跑一次全步骤截图 diff，任何非预期像素变化即为回归。
2. **行为断言**：smoke-runtime 的既有断言（表格行数/图例/丢失徽标/待机态）不动，作为行为契约。
3. **双数据灰度**：M2 期间新旧数据并存（适配层桥接），切换前用 `npm run check` 同时校验两套；页面切新数据后旧数据只读保留一个提交，再删。
4. **每里程碑一个提交**：出问题 `git revert` 单点回滚，不做混合回退。
5. **路径引用自检**：`scripts/check-paths.cjs` 随 `npm run check` 执行，任何新增资源若用根绝对路径或指向不存在的文件，构建前即失败。
6. **部署形态回归**：`.openai/check-pages-path.cjs` 可在仓库子路径 / 根路径 / 多层嵌套三种前缀下用真实浏览器验证；后续里程碑调整目录布局时必须重跑。

## 六、尚未解决的模型开放问题（诚实清单）

1. **广播扇出的视觉方案未定**：域内 3+ 设备时弧线如何排布（等距视图弧线拥挤），M4 实现时定稿，属渲染问题不阻塞模型。
2. **stepNotes 长文本的归属**：现站逐步详解有时跨事件叙述；迁入 Step.description 单字段可能丢粒度，若不够，扩展 `Step.notes: {eventId?, text}[]`（已预留，先不加）。
3. **并行事件的表格表达**：一条 traceRow 只对应一个主事件；同一波多事件时表格行合并规则未定（DNS 样例采取"每步一行主事件"策略，够用先不加字段）。
4. **过程事件 e-ignore-c 的可见性**：ARP 里"主机 C 收到但忽略"是否画动画、还是仅状态面板可见，UI 决策未定（数据已完整表达，渲染时可静默）。
5. **`net.alternate` 备用时间线**（现站 SACK 交替数据）：对应"场景内时间线变体"，模型暂用多 scenario 表达；若 14 步里仅个别行交替，需加 `traceRow.alternatives`，待迁移 TCP 全量数据时验证（M2 的一个明确任务）。
6. **tsc/esbuild 的 TS 校验**只覆盖新代码；旧 app.js 无类型，迁移完成前保持 jsdom 冒烟兜底。

以上问题均**不阻塞第三阶段审查**；前四项在 M4 决策，后两项在 M2 验证。

**V1.1 结案（2026-11-12）**

| # | 结论 |
|---|---|
| 1 广播扇出的视觉方案 | 仍开放，**M2-B 用 ARP 的真实需求定**（必要时退化为"逐接收者点亮"） |
| 2 stepNotes 长文本归属 | **已定**：`Step.description` 承载右侧逐步详解（深注），新增可选 `Step.caption` 承载场景字幕（短文）；不引入 `notes[]` 分片（当前 0 处需要按事件分片） |
| 3 并行事件的表格表达 | 仍开放，M2-A 全部步骤为"一步一事件"，暂不触发 |
| 4 `e-ignore-c` 的可见性 | 仍开放，M2-B 定 |
| 5 `net.alternate` 备用时间线 | **已定**：模型用多 scenario 表达（`scenarios[1].id = 'alternate'`），**不新增 `traceRow.alternatives`**；原"故障"命名与端口 443 一并修正 |
| 6 tsc/esbuild 覆盖范围 | **已缓解**：新增 `src/engine/view-model.ts` 走 `tsc --noEmit`；旧 `app.js` 仍靠 jsdom 冒烟兜底 |

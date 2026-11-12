# NetLab Explorer · 四项技术决策记录（ADR）

| 项目 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 记录日期 | 2026-11-12 |
| 决策来源 | 《NetLab Explorer 项目执行指令：第二阶段》第二节 |
| 执行状态 | 2 项已落地并验证；2 项已决策、排期到第三阶段（原因见各条） |
| 关联文档 | `docs/architecture-analysis.md`、`docs/network-knowledge-map.md`、`docs/knowledge-source-index.md` |

> 本文件只记录"决定了什么、为什么、什么时候落地、怎么验证"。**不记录未决事项**——未决事项在 `docs/architecture-analysis.md` 第十一节与各文档的"待核实"表中。

---

## 状态总览

| # | 决策 | 状态 | 本轮动作 | 验证方式 |
|---|---|---|---|---|
| ADR-001 | TypeScript 渐进引入 | 🟡 **已决策，S2 落地** | 写入规范与边界；未安装依赖、未加 `tsconfig.json` | S2 落地时用 `tsc --noEmit` |
| ADR-002 | 恢复多主题目录 | 🟡 **已决策，S3 落地** | 九大模块结构已写入 `docs/network-knowledge-map.md`；页面结构未改 | S3 落地时用 `npm run check` + 截图 |
| ADR-003 | CSAPP 改用官方来源 | 🟢 **已落地** | 修改 `dist/app.js` 一行（见 3.2），资源版本号升至 `20261112-5` | `npm run check` 三项全过；`grep hansimov dist/` 为 0 |
| ADR-004 | 初始化 Git 并建立基线 | 🟢 **已落地** | `git init` + 基线提交 `52fba15` | `git log --oneline`、`git status` 干净 |

---

## ADR-001 TypeScript 渐进引入

### 背景
现有代码 100% JavaScript（`.js/.jsx/.mjs`），构建用 esbuild，产物是可被浏览器直接加载的经典脚本（`dist/*.js` 之间存在隐式全局依赖）。

### 决策
1. **只有新增的数据模型、知识类型、来源类型用 TypeScript**（`src/types/*.ts`、`src/schemas/*.ts`）。
2. **运行时代码继续用 JavaScript**，不迁移现有 `dist/app.js`、`src/isokit-*.jsx`。
3. **构建继续用 esbuild**，不引入 Vite，不做全面重构。
4. 类型检查用 `tsc --noEmit`（只检查、不产出）。
5. `zod` 一旦被 `import`，必须在 `package.json` 的 `dependencies` 中**显式声明**（现在是 `react-isokit` 的传递依赖，靠不住）。

### 理由
- 类型只对"数据契约"有价值。现有渲染与播放逻辑是稳定的、已验证的，重写没有收益。
- 引入 Vite 会连带改变产物形态、CI 与 GitHub Pages 发布方式，风险远大于收益。
- `zod` 作为运行时校验必须与"类型编译期检查"分工：TS 管静态，Zod 管数据文件的内容校验（数据是 `.js`/`.json`，静态检查看不到）。

### 为什么不现在做
本阶段不产出任何 `.ts` 文件，提前装 TypeScript 会得到一个"没有输入文件"的空检查（`tsc` 报 `No inputs were found`），属于"为未来增加当前不需要的成本"。

### S2 落地步骤
1. `npm i -D typescript`；`npm i zod`（显式声明）。
2. 新增 `tsconfig.json`：`strict: true`、`noEmit: true`、`include: ["src/types/**/*.ts","src/schemas/**/*.ts"]`、`module: "ESNext"`、`moduleResolution: "Bundler"`、`allowJs: false`。
3. `package.json` 加 `"typecheck": "tsc --noEmit"`，并加入 `npm run check` 链。
4. 首个文件 `src/types/knowledge.ts` 与 `src/schemas/knowledge.schema.ts` 同步产出（缺一不可，否则类型与校验会漂移）。

### 验证
`npm run typecheck` 退出码 0；故意在类型文件中写一个错字段，确认 `tsc` 能报错（避免"配了但不生效"）。

---

## ADR-002 恢复多主题目录

### 背景
当前站点是从完整版裁剪而来的**单主题页**：1 个分组、1 课、14 步。完整版 `cs-systems-design` 里有多分组目录、搜索、知识图谱页签，但它的 28 课内容按计划书要求**不能复制**。

### 决策
1. 恢复"九大模块 → 知识点 → 演示"三级目录与搜索能力。
2. **只参考完整版的结构与交互形式**，不复制其 28 课内容与文案。
3. 九大模块的划分以 `docs/network-knowledge-map.md` 为准（M01–M09，165 个知识点）。

### 理由
知识体系有 165 个知识点，单主题页无法承载；但目录是**数据驱动**的，先有知识数据才谈得上目录。

### 为什么不现在做
目录由 `data.js` 的 `GROUPS` / `LESSONS` 渲染。现在只有 1 课数据，强行加 9 个分组只会得到"9 个空目录"，既不美观也无法验证。UI 改动属于业务代码，与本阶段"只整理文档、不改业务代码"的约束冲突。

### S3 落地步骤
1. `content/categories.js` 写入 9 个分类（id / 名称 / 顺序 / 主色 / 图标）。
2. `content/knowledge/*.js` 先落 15 个首批知识点（只填元信息，不接页面）。
3. 恢复 `dist/app.js` 的目录树与搜索（完整版相关函数仍在，只是当前被早退或删空，可直接复用骨架）。
4. 恢复 `#map-tab` / `#mechanism-tab` 时，先确认知识图谱只画"直接关联"，不画出 165 个节点的全图。

### 验证
`npm run check` 三项全过 + 目录可搜索到 15 个知识点 + 窄屏（430px）截图无溢出。

---

## ADR-003 CSAPP 改用官方来源

### 背景
原项目中 CSAPP 的引用 URL 在运行时拼接为 `https://hansimov.gitbook.io/csapp/<path>` —— 这是**第三方中文镜像站**，既无授权证明，内容也可能与官方版本有出入。计划书 §8 要求"未核实授权的素材不得进入正式发布内容"，因此判定为不可用。

### 决策
1. CSAPP 的正式来源统一为 **https://csapp.cs.cmu.edu/**。
2. 不再引用任何第三方镜像、转载站、网盘。
3. 章节/小节信息以官方站点与纸书目录为准；**章号未核实前只写"网络编程章"**。

### 3.1 落地改动（本轮唯一的数据改动）

| 文件 | 改动 | 原因 |
|---|---|---|
| `dist/app.js` | `sourceById` 中 CSAPP 条目：`url` 由 `https://hansimov.gitbook.io/csapp/'+r.path` 改为 `https://csapp.cs.cmu.edu/`；`kind` 由 `CSAPP 中文版 · 系统基础` 改为 `CSAPP 官方站点 · 系统基础` | 切断镜像站引用；门户页比深链更稳定 |
| `dist/index.html` | 7 处资源版本号 `?v=20261112-4` → `?v=20261112-5` | 让浏览器重新拉取改动后的 `app.js` |

> `CSAPP_READINGS` 里的 `path` 字段**保留未删**：它是"该条目对应哪一节"的内部索引，后续可能用于映射官方目录，但**不再用于拼 URL**。

### 3.2 验证
1. `npm run check` → 内容契约 / IsoKit 渲染 / 动效三项全过。
2. `grep -rn "hansimov" dist/` → 0 命中。
3. 页面「来源」页签中 CSAPP 条目可点击跳转到 CMU 官方站点。

### 风险
官方站点是英文门户，中文读者体验下降。处置：**内容自己写中文**，来源只作"依据指认"，不承担阅读体验（这也符合"不复制教材正文"的要求）。

---

## ADR-004 初始化 Git 并建立基线

### 背景
目录下没有 `.git`，改数据结构无法回滚；且本机同时存在 `cs-systems-design`（完整版）、`cs-systems-design-tcp`（单主题版）两个高度相似的目录，容易改错对象。

### 决策
1. 在当前项目目录初始化独立仓库（**不**初始化在上级 `项目/` 目录，避免把另外两个项目卷进来）。
2. 在**任何数据文件改动之前**完成首次提交，作为回滚点。
3. `.gitignore` 覆盖依赖、本地工具产物、环境变量、密钥、真实抓包。
4. 提交前检查是否有敏感信息（账号、密钥、公司内网配置）。

### 4.1 落地结果

| 项 | 值 |
|---|---|
| 仓库根 | `C:/Users/ECCOM/Desktop/项目/cs-systems-design-tcp` |
| 分支 | `main` |
| 基线提交 | `52fba15` — `chore: 建立 NetLab Explorer 代码基线` |
| 纳入版本控制 | 41 个文件（`src/`、`dist/`、`scripts/`、`docs/`、校验脚本、CI） |
| 排除 | `node_modules/`、`.openai/`（截图与冒烟脚本）、`*.log`、`.env*`、`*.pem/*.key/*.p12`、`secrets/`、`*.pcap(ng)` |
| 换行 | `.gitattributes` 统一 `eol=lf`，避免 Windows 上整文件 diff |
| 敏感信息检查 | 无账号 / 密钥 / 真实网络配置；演示拓扑全为虚构地址（198.51.100.0/24、203.0.113.0/24 等文档专用段） |

### 4.2 为什么额外排除 `*.pcap(ng)`
后续做 ARP/DNS/DHCP 演示会用到抓包。样本抓包可能含真实主机信息且授权未核实（见 `docs/knowledge-source-index.md` 第九节），**默认不入库**，需要时单独核查后放入指定目录。

### 验证
```bash
git log --oneline          # 应有 52fba15
git status --short         # 应为空（除本轮新增文档）
git ls-files | grep -c node_modules   # 应为 0
```

---

## 附：本轮未做的三件事（避免"顺手加了"）

| 事项 | 为什么不做 |
|---|---|
| 安装 TypeScript / Zod | 本阶段无 `.ts` 文件，装了也是空检查 |
| 改页面目录结构 | 属业务代码；且缺少知识数据，加了只有空目录 |
| 拆分 `dist/app.js`（120 行压缩代码） | 属重构，与"每次只动一层"冲突，等 S3 拆目录时一并处理 |

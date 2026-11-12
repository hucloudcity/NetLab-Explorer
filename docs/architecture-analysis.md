# NetLab Explorer · 项目现状分析（第一阶段交付）

| 项目 | 内容 |
|---|---|
| 分析对象 | `C:/Users/ECCOM/Desktop/项目/cs-systems-design-tcp`（经确认作为 NetLab Explorer 唯一底座） |
| 分析日期 | 2026-11-12 |
| 分析方式 | 全量静态阅读 `src/`、`dist/`、构建与校验脚本 + 运行现有校验 + jsdom 冒烟 + 截图核对 |
| 是否改动代码 | **否**。本轮只新增文档，未改动任何核心代码 |
| 对应计划书 | `docs/netlab-explorer-plan.md` 第九节「第一阶段」 |

---

## 一、结论摘要

1. **技术栈与计划书假设不一致。** 计划书假设 "React + TypeScript + Vite"，实际是 **React 19 + 纯 JavaScript + esbuild**，无 TypeScript、无 Vite、无路由库、无状态库、无测试框架。第三阶段要交付 `.ts` 类型与 Zod schema，这是一次**新增**而非"整理现有类型"。
2. **UI 并不是组件化的 React 应用。** React 只负责中间那张 SVG 示意图（`src/isokit-renderer.jsx` 14 行）；目录、表格、详解、对话框全部由 `dist/app.js` 用字符串模板 + `innerHTML` 渲染。这意味着"内容与组件分离"必须落在 `app.js` 的数据消费方式上，而不是"改 React 组件 props"。
3. **内容已经物理分离，但语义上是"演示脚本"而非"知识"。** `dist/data.js` 里一课的对象字段是 `nodes / steps / net / stepNotes`，缺少计划书 §5 要求的 `what / why / packetStructure / demoId / labId / accessLevel / status` 等 10 个字段。知识点正文实际寄生在 `mechanisms.js` 的 `sections[].body` 里。
4. **数据模型存在两个硬约束，会直接卡住 ARP / DNS：**① 参与者固定 4 个（`src/isokit-model.mjs` 的 `POSITIONS` / `NETWORK_POSITIONS`；`check-content.cjs` 断言 `nodes.length===4`）；② 每一步只能表达"一个源 → 一个目的"（`[title, from, to, …]`）。ARP 广播、DHCP DORA、DNS 迭代查询都是"一对多 / 依次多对多"，必须在数据模型阶段先解决，否则动画层会返工两遍。
5. **没有协议计算层。** 计划书 §4.2/§4.3 要求用户改 IP / 掩码 / 网关 / DNS 服务器后看到结果变化（"协议计算与动画展示分离"）。现状 `app.js` 只有"播放哪一步"，没有任何输入参数、没有判定逻辑（如"目标 IP 是否同网段"）。这是本次扩展**最大的一块空白**。
6. **来源模型不足以支撑版权台账。** `SOURCES` 只有 `{name, url, note, kind}`，缺 `type / author / version / sections / checkedAt / license`；且 CSAPP 链接指向第三方 GitBook 镜像 `hansimov.gitbook.io`，属于**未核实的第三方转载**，与 §8 版权要求冲突。
7. **无可复用资产的部分比预期少，但底座质量不错。** 渲染器、播放控制、七列表格、关系图例、三项自检脚本都可以直接沿用；TCP 一课本身就是"第一批内容"的样板。
8. **没有版本控制。** 目录下无 `.git`。在开始改数据结构之前应先 `git init` 并提交当前状态，否则无法回滚（见第七节）。

---

## 二、代码库事实清单

| 维度 | 现状 | 证据 |
|---|---|---|
| 应用类型 | 纯静态单页站点，hash 路由，无后端、无构建期数据接口 | `dist/index.html`（34 行）、`dist/app.js:113` |
| 框架 | React 19.3.1 + react-dom 19.3.1，仅渲染示意图 | `package.json`、`src/isokit-renderer.jsx` |
| 图形库 | `react-isokit@0.5.0`（等距 SVG），MIT | `node_modules/react-isokit/package.json` |
| 语言 | 100% JavaScript（`.js` / `.jsx` / `.mjs`），**0 个 `.ts`/`.tsx`** | `find` 全库（排除 node_modules）无结果 |
| 构建 | esbuild 0.28.2，仅打包渲染器为 IIFE：`src/isokit-renderer.jsx → dist/isokit.js` | `scripts/build.mjs` |
| 开发服务器 | `python -m http.server 8091 -d dist`（无 HMR、无代理） | `package.json` scripts.start |
| 依赖数量 | 直接依赖 3 个 + 1 个 devDep；`node_modules` 顶层 7 个包 | `package.json`、`ls node_modules` |
| 隐藏依赖 | `zod@4.6.7` 由 `react-isokit` 传递引入，**未被声明**，不能直接依赖 | `package-lock.json:530`、`node_modules/zod` |
| 产物体积 | `isokit.js` 279.8 KB（React+IsoKit 压缩）；`app.js` 21.5 KB；`data.js` 18.5 KB；`mechanisms.js` 2.3 KB；CSS 46.6 KB | `ls -la dist` |
| 内容规模 | 1 课 / 2 场景 / 18 个阶段 / 14 行报文表 + 4 行故障表 / 14 条步骤注解 | `dist/data.js` |
| 样式 | 纯 CSS（`styles.css` 26.6 KB 单行压缩 + `scene-motion.css` 9.2 KB + `isokit.css` 10.8 KB），CSS 变量 + `body.dark` 双主题，无预处理器 | `dist/*.css` |
| 测试 | 无框架。3 个 `node:assert` 脚本：内容契约 / 静态渲染回归 / 动效数学回归；另加 jsdom 冒烟与 puppeteer 截图（`.openai/`，已 gitignore） | `check-*.cjs`、`.openai/smoke-runtime.cjs` |
| CI | GitHub Actions：`node --check` → `npm run check` → `npm run build` → 发布 Pages | `.github/workflows/pages.yml` |
| 版本控制 | **无 `.git`**（`.gitignore` 存在但仓库未初始化） | `ls -d .git` 为空 |
| 自有许可证 | 仓库根目录**无 LICENSE**；仅 `dist/licenses/` 有第三方依赖许可证 | `ls`、`dist/licenses/` |
| 外部资源 | 无 Web 字体、无 CDN、无埋点；图标为本地 `icons.svg` 雪碧图 | `dist/index.html` 全文仅 2 个外链（IsoKit 主页、Protocol Explorer） |

---

## 三、运行时架构

### 3.1 加载与依赖

`dist/index.html:7-8` 以四个 `defer` 经典脚本顺序加载：

```
data.js (SOURCES, GROUPS, LESSONS)
  → mechanisms.js (CSAPP_READINGS, MECHANISM_DETAILS)
    → isokit.js (IIFE，挂载 window.SystemsDiagram)
      → app.js (读取上述全局绑定并渲染)
```

- 没有模块系统。`data.js` 顶层的 `const LESSONS` 在经典脚本中形成**全局词法绑定**，后续脚本可直接引用；任何插入顺序错误都会导致 `ReferenceError`（历史事故：`travel-dot.jsx` 漏声明 `useRef` 造成整图空白）。
- 缓存策略靠手写版本号：`?v=20261112-4`（4 个脚本 + 3 个 CSS 共 7 处），改文件必须同步改版本号，否则用户看到旧页面。

### 3.2 渲染管线

```
交互事件 → 改模块级变量 → 全量重绘
  render()            app.js:102   主题 / 标题 / 侧栏 / 步骤 / 视图 / 进度
    ├ renderNav()     app.js:44    目录树 + 当前课 14 个步骤
    ├ renderStep()    app.js:85    步骤标题 / 信号 / 描述
    │   ├ draw()      app.js:69    → window.SystemsDiagram.render(props)  (React + flushSync)
    │   ├ renderTrace() app.js:84  七列报文表 + 图例 + 上一/下一步禁用态
    │   └ renderDetail() app.js:46 右侧「机制／来源」页签（字符串模板）
    └ renderView()    app.js:86    机制视图 / 知识图谱（本版无图谱，函数保留但早退）
```

- **同步渲染**：`flushSync` 保证 SVG 与下方表格在同一帧更新（`src/isokit-renderer.jsx:9`）。
- **局部重绘靠字符串**：`$('#detail-content').innerHTML = html`，`renderedDetail` 做 key 级缓存（`app.js:50`），避免播放时丢失阅读位置。

### 3.3 状态管理

`app.js:8-13` 一组模块级 `let`：`current / step / fault / special / started / timer / speed / view / detail / filter / query / dark / motionMode / motionVersion / playbackEnded / renderedDetail`。
没有 reducer、没有订阅、没有不可变数据。所有"状态迁移"都是就地赋值 + 手动调用重绘函数。**新增演示类型时最容易被漏掉的就是这条隐式契约。**

持久化只有两个键：`systems-completed`（已学标记）、`systems-dark`（主题），均在 `localStorage`。

### 3.4 播放控制

- `play()`（`app.js:29`）用 `setInterval(2600/speed)` 推进，末步停留后 `finish()`。
- 点粒子动画不走 interval：`src/point-motion.mjs` 是**纯函数 + 注入时钟**的可测动画控制器，`src/travel-dot.jsx` 负责主包 + 2 个拖尾。
- 待机态：`preview: !started`，`src/isokit-scene.jsx` 在 preview 时不画路径 / 包 / 节点高亮 —— 满足"未点播放不演示第一步"。
- 无障碍：`prefers-reduced-motion` 生效时全部动画关闭（`app.js:117-118`、`check-isokit.cjs` 有断言）。

### 3.5 场景与语义

- 场景：`main`（14 步主流程）、`fault`（`current.fault`，4 步四次挥手）、`special`（本版已无数据，代码与按钮保留）。
- 关系语义 8 种：`request / data / control / check / reject / lost / local / compare`（`app.js:20`），决定箭头样式、是否画包、是否标红未到达。
- 报文类别 5 种：`hand / cdata / sdata / fin / lost`（`app.js:21` + `scene-motion.css:175-193`），通过 SVG `data-packet` 与 CSS 变量 `--packet` 着色。

---

## 四、内容模型现状

### 4.1 一课（LESSON）的字段

```js
{
  group: 0, id: 'tcp', title: 'TCP 连接全流程', en: 'TCP CONNECTION LIFECYCLE',
  summary, principle, tradeoff, pitfall,          // 四段说明性文字
  scene: 'network', nodes: [4 个设备名], addresses: [4 个地址],
  steps: [ [title, from, to, code, desc, state, kind] × 14 ],
  stepNotes: [14 条深度注解],
  net: { main: [14 行], alternate: [4 行] },      // t/src/dst/proto/info/size/cat
  code: [伪代码行], sources: ['rfc9293','csapp'], related: [],
  fault: { name, nodes, steps[4], code }
}
```

关键点：**每一步只有一个 `from` 和一个 `to`（整数索引）**，且 `s[1]===s[2]` 被强制要求等于 `kind==='local'`（`check-content.cjs`）。广播、组播、一对多查询在当前 schema 中**无法表达**。

### 4.2 机制详解

`mechanisms.js:18` `MECHANISM_DETAILS.tcp = { sections:[{title, body}], foundation, readings:['tcp','client'] }`。
知识点正文（为什么 SYN 消耗序列号、TIME_WAIT 的两个理由等）就在这里，**与演示步骤强耦合**：换一个演示就得重写一套文字。

### 4.3 来源

`SOURCES = { rfc9293:{name,url,note,kind}, csapp:{...} }`；`CSAPP_READINGS` 的条目在运行时被拼成 `csapp_*` 来源，URL 固定为 `https://hansimov.gitbook.io/csapp/...`（第三方中文镜像，非官方站点）。

→ 缺 `type/author/version/sections/checkedAt/license`；`kind` 是中文字符串（"具体机制资料"/"课程背景"），不是可枚举的类型；无"最后核对时间"，无法满足 §2.2 关于 RFC 状态复核的要求。

---

## 五、与计划书要求的差距矩阵

| 计划书要求 | 现状 | 差距 | 计划落点 |
|---|---|---|---|
| §2.1 以 Top-Down 为主教材 | 全部内容以 CSAPP 章节为骨架 | 无 Top-Down 任何映射；教材章节号一个都没填 | 第二阶段 |
| §2.2 每个协议关联 RFC 并复核状态 | 仅 TCP 挂了 RFC 9293 链接 | 差 15 份 RFC；无 Status/Obsoletes/Errata 复核记录 | 第二阶段（`docs/rfc-index.md`） |
| §2.3 IEEE 标准 | 完全缺失 | 以太网/VLAN/无线无标准依据 | 第二阶段 |
| §5 知识点 17 个字段 | 实际约 6 个可用 | 缺 `categoryId/level/what/why/packetStructure/practicalScenario/commonProblems/demoId/labId/accessLevel/status` | 第三阶段 |
| §5.1 来源 10 个字段 | 4 个 | 缺 `sourceId/type/author/version/sections/checkedAt/license` | 第三阶段 |
| §5 内容与展示分离 | 数据独立成文件，但**知识与演示同体** | 无法"加一个知识点而不动演示" | 第三阶段（知识 / 演示拆表 + `demoId`） |
| §6.2 演示模板 8 项 | 7 项具备 | 缺**报文详情**（只有一行 `info` 文本，无字段级结构） | 第五阶段 |
| §6.3 交互实验模板 | **完全没有** | 无参数面板、无预期/实际结果对比、无实验结论 | 第五阶段（先留 `labId`，不实现） |
| §7 TCP 准确性 | 已达标（14 步含 SACK、FIN 消耗序号、TIME_WAIT） | 无 | 保持 |
| §4.1 握手 5 个扩展实验 | 只有 1 个 fault 场景（四次挥手） | 缺端口未监听 / SYN 丢失 / SYN-ACK 丢失 / 拒绝 / 不同 ISN | 第五阶段 |
| §4.2 ARP 7 项交互 | 无 | 需参数输入 + 同网段判定 + ARP 缓存视图 + 广播域可视化 | 第五阶段 |
| §4.3 DNS 7 项交互 | 无 | 需 5–6 个参与者（客户端/递归/根/TLD/权威）→ **超出 4 节点上限** | 第三阶段先解决拓扑约束 |
| §8 版权台账 | 无 | 无 `license` 字段、无内容状态（original/adapted/…）、CSAPP 指向镜像站 | 第三阶段 |
| §11 九大模块 | 1 个分组「网络协议」 | 缺 9 个分类、约 150 个知识点索引 | 第二阶段 |

---

## 六、可复用资产（不必重写）

| 资产 | 位置 | 对 NetLab 的价值 | 扩展时要注意 |
|---|---|---|---|
| 等距场景渲染器 | `src/isokit-scene.jsx`（201 行） | 设备、路径、双箭头拓扑、丢失中断、拖尾都已实现 | 拓扑与端口**硬编码 4 个位置**，需改为数据驱动 |
| 路线与投影数学 | `src/isokit-model.mjs` | `routeBetween / networkRoute / topologyLinks / truncateRoute` 可单测 | 同上，位置表需参数化 |
| 点粒子动画 | `src/point-motion.mjs` + `travel-dot.jsx` | 暂停/续播/变速/结束清理均已验证 | 无 |
| 报文七列表 | `app.js:84 renderTrace` | 时间/源/目的/协议/信息/大小 + 类别色 + 丢失徽标 | 需加"字段级详情"抽屉 |
| 播放控制 | `app.js:29-41`、`index.html` 控件区 | 播放/暂停/单步/重置/速度/键盘 | 需支持"多实验并存的参数面板" |
| 校验体系 | `check-content.cjs`、`check-isokit.cjs`、`check-motion.cjs` | 内容契约 + 静态渲染 + 动效数学三层回归 | 断言硬编码单课，需改为按数据驱动 |
| TCP 内容本身 | `dist/data.js` | 14 步时间线可作为"第一批知识"的样板与迁移验证对象 | 需拆成 知识条目 + 演示描述 两层 |

---

## 七、风险与技术债

按严重度排序：

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| 1 | **无版本控制** | 改数据结构无法回滚，且现有 3 个项目目录内容高度相似，易混淆 | 动手前 `git init` + 首次提交（需你确认） |
| 2 | **4 节点 / 单源单目的硬约束** | ARP 广播、DNS 多级查询无法建模，硬改会推翻动画层 | 第三阶段数据模型优先解决，动画层只做泛化 |
| 3 | **无协议计算层** | §4.2/§4.3 的"改参数看结果"无处落地 | 新增 `src/protocol/*.mjs` 纯函数层（可单测，与动画解耦） |
| 4 | 知识正文寄生在 `MECHANISM_DETAILS` | 一个知识点只能服务一个演示，无法复用/检索/审核 | 拆 `knowledge` 与 `demo` 两张表，用 `demoId` 关联 |
| 5 | `app.js` 120 行 / 21.5 KB，全为压缩式单行代码 | 可维护性差，新增 9 大模块后难以定位 | 按"目录 / 详情 / 表格 / 控制"拆成 4–5 个 `dist/*.js`（不改技术栈） |
| 6 | 来源指向 `hansimov.gitbook.io`（第三方 CSAPP 中文镜像） | 版权与准确性双重风险，与 §8 冲突 | 改链 CMU 官方课程页；镜像仅作本地参阅，不入库 |
| 7 | `dist/accuracy-audit.md` 仍是 27 主题版（2026-11-03） | 对外文档与站点不符 | 归档或重写为单课版 |
| 8 | `.openai/shot2.cjs`、`shot3.cjs` 引用已删除的 `#special`/`#raft` | 脚本必失败，误导后续 | 删除或重写 |
| 9 | `zod` 是传递依赖，未声明 | 直接 `import 'zod'` 会在 `npm ci` 后随时失效 | 第三阶段显式加入 dependencies |
| 10 | 无 LICENSE、无内容状态字段 | Open Core 商业化前必须补齐 | 第三阶段随数据模型一起 |
| 11 | CSS 单行压缩、无 lint/format | 多人协作成本高 | 暂不治理，等模块拆分时一并处理 |

---

## 八、建议的目标分层（不重建项目）

```
content/                      ← 新增：单一事实来源
  knowledge/*.js              ← 知识点（what/why/principle/packetStructure/...）
  sources.js                  ← 来源台账（type/sections/checkedAt/license）
  categories.js               ← 九大模块
  demos/*.js                  ← 演示描述（拓扑/参与者/场景/步骤/报文），只引用 knowledge.id
src/protocol/*.mjs            ← 新增：纯函数协议模型（同网段判定、ARP 目标选择、DNS 解析链）
src/types/*.ts + schemas/*    ← 第三阶段：类型与 Zod 校验（tsc 只做类型检查，esbuild 继续打包）
dist/{app,nav,detail,trace}.js← 现有 app.js 按职责拆分，保持全局脚本约定
dist/isokit*.js               ← 渲染层，仅做"拓扑参数化"改造
```

三条不变量（对应计划书 §10）：

1. **不换技术栈**：仍用 esbuild + 经典脚本；TS 只做类型检查（`tsc --noEmit`），不引入 Vite。
2. **不改渲染语义**：关系 8 种、类别 5 种、`preview` 待机规则保持不变，ARP/DNS 复用同一套。
3. **每次只动一层**：先加数据，再加计算，最后接界面；每步都能用现有 `npm run check` 验证。

---

## 九、实施计划（待确认后逐步执行）

| 步骤 | 内容 | 交付物 | 验证方法 | 风险 |
|---|---|---|---|---|
| S0 | 初始化 git，提交当前状态作为回滚点 | `.git` + 首次提交 | `git log` | 低（需你同意） |
| S1（第二阶段） | 九大模块 → 知识点清单 → RFC/IEEE/教材映射；待核实项显式标注 | `docs/network-knowledge-map.md`、`docs/knowledge-source-index.md`、`docs/rfc-index.md` | 交叉检查：每条来源含 URL 与用途；不确定项标 `待核实`；不出现编造章节号 | 低（纯文档） |
| S2（第三阶段） | 类型 + Zod schema；拓扑参数化（节点数可变、一对多语义）；把 TCP 一课迁移到新模型 | `src/types/*.ts`、`src/schemas/*.ts`、`docs/content-data-model.md`、迁移后的 `content/` | `tsc --noEmit` + `node check-content.cjs` 全绿 + 页面行为与迁移前逐像素一致 | 中（触及数据契约，先只迁 TCP 一课做灰度） |
| S3（第四阶段） | 第一批 15 个知识点的内容数据（含来源），不接页面 | `content/knowledge/*.js` | Zod 全量通过 + 来源链接可访问性抽查 | 低 |
| S4（第五阶段） | TCP 握手按 §4.1 补齐 5 个扩展实验；ARP、DNS 演示 | 演示数据 + 必要渲染泛化 | 每个演示先出"场景/事件/状态/报文/异常/验证"设计文档，再写代码；`check-isokit` 断言覆盖新场景 | 中高（DNS 需要 5–6 节点） |

**本轮不做的事**：不建 `content/` 目录、不写 TS 类型、不碰 ARP/DNS 代码、不重构 `app.js` —— 全部等 S1/S2 确认后按阶段推进。

---

## 十、待你确认的 4 个决策

1. **TypeScript 怎么引入？** 现状无 TS、无 Vite。建议：只加 `typescript` 做 `tsc --noEmit` 类型检查（不改构建、不加 Vite），类型文件与 schema 用 `.ts`，运行时代码继续 `.js`/`.mjs`。若你希望全面迁移 TS，需要额外一轮改造预算。
2. **是否恢复"多主题目录"框架？** 当前是单主题页（1 个分组 / 1 课）。九大模块需要目录、分组、搜索回来；完整版 `cs-systems-design` 仍在，可作为结构参照，但**按计划书 §10.2 不复制它的 28 课内容**。
3. **CSAPP 链接是否改为官方来源？** 建议统一指向 `https://csapp.cs.cmu.edu/`，不再引用 GitBook 镜像。
4. **是否先 `git init`？** 建议在动任何数据文件之前完成，作为整个改造的回滚点。

---

## 十一、待核实清单（不编造，逐条标注）

| 项 | 状态 | 说明 |
|---|---|---|
| Top-Down 第 9 版各章编号与标题 | 待核实 | 需对照 Pearson 官方目录页确认后再写入 `knowledge-source-index.md` |
| RFC 9293 的 Status / 是否被更新 | 待核实 | 需查 rfc-editor 页面元信息（含 Errata） |
| RFC 826、791、1034、1035、2131、792 的当前状态 | 待核实 | 同上；RFC 791 有多次 Updates |
| OSPFv2 现行版本（RFC 2328 vs 后续更新） | 待核实 | 存在 RFC 5709 等扩展，需确认"基础规范"引用口径 |
| IEEE 802.1Q / 802.3 的现行修订年号 | 待核实 | 需查 IEEE 标准页，避免写过时版本号 |
| Wireshark 样本抓包的授权条款 | 待核实 | 每个样本单独检查，未核实前不引用 |
| CSAPP 中文镜像站的授权状态 | **已判定不可用** | 第三方转载，不进入来源台账 |

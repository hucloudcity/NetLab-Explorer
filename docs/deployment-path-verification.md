# 部署路径验证报告（M0.1）

**日期：** 2026-11-12
**触发：** M0 审查提出的部署风险 —— index.html 使用了 `/content/`、`/dist/` 根绝对路径，本地 Python HTTP Server 通过不代表 GitHub Pages 项目站点能加载。
**结论：** 风险成立，且**是 M0 引入的真实回归**。已修复为相对路径，并在三种部署前缀下实测通过；同时发现并修复一处此前未暴露的许可证链接失效。

---

## 一、事实核查：当前部署形态

| 检查项 | 结果 | 依据 |
|---|---|---|
| Git 远程仓库 | **未配置**（`git remote -v` 为空） | 本地仓库只有提交历史，尚无 origin |
| 自定义域名 | **无**，仓库内不存在 `CNAME` 文件 | `ls CNAME` → 不存在 |
| Pages 产物目录 | `_site`（workflow 中 `cp -r src content dist _site/`） | `.github/workflows/pages.yml` |
| 站点入口 | `_site/src/app/index.html` | M0 归位后的目录布局 |

**因此不能假定部署在域名根路径。** 未配置 remote、无 CNAME 的情况下，一旦推送到 `github.com/<user>/<repo>`，默认就是**项目站点**：`https://<user>.github.io/<repo>/`，站点根是子路径而不是域名根。这正是根绝对路径的失效场景。

下文对三种前缀全部实测：
1. `/cs-systems-design-tcp` —— 项目站点（最可能的真实形态）
2. `/` —— 自定义域名或 `user.github.io` 根站点
3. `/a/b/nested-path` —— 任意多层嵌套（防止将来加前缀目录）

---

## 二、问题复现（修复前）

用 `_site` 按 CI 方式装配，再由本地静态服务把 `_site` 挂到 `/cs-systems-design-tcp/` 前缀下，真实浏览器打开 `http://127.0.0.1:8092/cs-systems-design-tcp/src/app/`：

```
资源 ok/failed: 6 / 8
404 /dist/isokit.css?v=20261112-5      ← 请求打到域名根，不是 /<repo>/dist/
404 /content/data.js?v=20261112-5
404 /content/mechanisms.js?v=20261112-5
404 /dist/isokit.js?v=20261112-5
页面错误: LESSONS is not defined
渲染: 数据包流 0 行、示意图 false
```

**页面完全不可用**：样式丢失、数据未加载、示意图空白、表格 0 行。四个资源全部指向 `http://127.0.0.1:8092/dist/...`，即站点前缀被丢掉了。

> 历史注记（M2-A，2026-11-13）：上面 404 列表是**修复前的快照**。M2-A 之后页面已不再加载 `content/data.js`——数据脚本换成 `dist/netlab-data.js`（构建产物），下表第 3 行随之更新。

对照：M0 之前这些引用是 `./data.js`、`./isokit.js`（同目录相对路径），在任何前缀下都能解析——**M0 为跨目录引用改根绝对路径，是把一个原本前缀无关的站点改成了前缀相关**。责任在 M0 实现，不在 CI 配置。

---

## 三、修复方案

### 3.1 引用改为相对路径（核心修复）

`src/app/index.html` 中 4 处跨目录引用 + 2 处许可证链接：

| 修复前 | 修复后 | 解析结果 |
|---|---|---|
| `/dist/isokit.css?v=…` | `../../dist/isokit.css?v=…` | `/<prefix>/dist/isokit.css` |
| `/dist/isokit.js?v=…` | `../../dist/isokit.js?v=…` | `/<prefix>/dist/isokit.js` |
| `/content/data.js?v=…` | `../../content/data.js?v=…`（M0 修复）→ **`../../dist/netlab-data.js?v=…`（M2-A 起现为该值）** | `/<prefix>/dist/netlab-data.js` |
| `/content/mechanisms.js?v=…` | `../../content/mechanisms.js?v=…` | `/<prefix>/content/mechanisms.js` |
| `./licenses/react-isokit.txt` | `../../dist/licenses/react-isokit.txt` | `/<prefix>/dist/licenses/…` |
| `./licenses/isokit-notices.md` | `../../dist/licenses/isokit-notices.md` | `/<prefix>/dist/licenses/…` |

> **M2-A 数据脚本变更：** 页面加载的 `netlab-data.js` 是 `npm run build` 从 `content/*.json` 生成的**构建产物（不入库）**。部署（含 CI 装配 `_site/`）前必须先构建，否则 404——CI workflow 已含 `npm run build` 步骤；`content/data.js` 保留但仅为旧版兼容与渲染回归夹具，页面不再引用。

**为什么用相对路径而不是 basePath：**
- 相对路径的解析基准是**文档 URL**，与站点挂在哪个前缀无关，本地根路径、仓库子路径、自定义域名根路径三种情形同一份文件都成立。
- basePath 方案需要在构建期注入仓库名（`${{ github.event.repository.name }}`），一旦换自定义域名或改仓库名就要重新注入，且**本地与线上行为不一致**（本地 `/`、线上 `/<repo>/`），等于制造两套真相。
- 原项目本来就是相对路径，改回去风险最低、语义最直接。

**代价与护栏：** `../../` 依赖「index.html 位于 `src/app/` 且 `content/`、`dist/` 在仓库根」这一布局。布局一旦调整，这 6 处会静默失效——所以新增自动校验（见第五节）把这条约束变成可执行检查。

### 3.2 站点根补跳转页

`_site` 根下原本没有 `index.html`，`https://<user>.github.io/<repo>/` 会 404（页面其实在 `.../<repo>/src/app/`）。新增仓库根 `index.html` 作为纯跳转页（`meta refresh` + 可见的备用链接 + 同色 favicon），CI 一并装配进 `_site/`。

选择「跳转页」而非「把页面平铺到站点根」，是因为后者需要把 `src/app/` 的内容复制到 `_site/` 根，`./styles.css` 与 `../../content/` 的相对层级随之改变，本地与线上必然分叉；跳转页两边行为完全一致（本地访问 `http://127.0.0.1:8091/` 也会跳到 `/src/app/`）。

### 3.3 CI 与校验

- `pages.yml`：装配步骤补 `cp index.html _site/index.html`；新增一步 `node scripts/check-paths.cjs`，在 `_site` 已就绪时校验线上等价布局。
- `package.json`：`npm run check` 追加 `node scripts/check-paths.cjs`（与原有三项串联）。
- `.gitignore`：新增 `_site/`（CI 装配产物，不入库）。

---

## 四、修复后实测（三种前缀）

同一套 `_site` 装配，分别在三个前缀下用真实浏览器（Chrome headless）打开：

| 检查项 | `/cs-systems-design-tcp` | `/` | `/a/b/nested-path` |
|---|---|---|---|
| HTTP 资源失败 | 0 | 0 | 0 |
| 页面 JS 错误 | 无 | 无 | 无 |
| 数据包流（主时间线） | 14 行 | 14 行 | 14 行 |
| 故障场景（`net.alternate`） | 4 行 | 4 行 | 4 行 |
| 等距示意图渲染 | ✓ | ✓ | ✓ |
| 样式生效（computed background） | ✓ | ✓ | ✓ |
| 图标 `<use href="./icons.svg#menu">` | ✓ | ✓ | ✓ |
| 许可证链接 `react-isokit.txt` | 200 | 200 | 200 |
| 许可证链接 `isokit-notices.md` | 200 | 200 | 200 |
| 站点根 `…/` → 跳转 | → `src/app/`，14 行 | → `src/app/`，14 行 | → `src/app/`，14 行 |

补充说明：`favicon.ico` 偶发 404 是浏览器对站点根的默认探测（根跳转页早期没有 icon 声明），已在跳转页补 `icon` 后消失；不是页面资源缺陷。

---

## 五、新增护栏：`scripts/check-paths.cjs`

零依赖、纯 Node，可直接进 CI：

| 规则 | 内容 |
|---|---|
| P1 | `src/app/index.html`、`src/app/app.js` 中**禁止**根绝对路径引用（`#`、`http(s)`、`data:` 等除外） |
| P2 | 每个相对引用按文档基准解析后，目标文件必须在仓库中真实存在 |
| P3 | 若存在 `_site/`（CI 装配后），同一引用在 `_site` 内也能解析 |
| P4 | 仓库根 `index.html` 的重定向目标存在且为页面 |

当前输出：`Deployment path check passed: 39 local references resolve; no root-absolute paths; root redirect ok.`（M2-A 后引用数从 37 变为 39：数据脚本换成 `dist/netlab-data.js` 并新增目录 JSON 的引用核对。）

**这条护栏立刻抓到两个手工检查漏掉的问题：**
1. 关于对话框的 `./licenses/*` 链接在 M0 后失效（文件在 `dist/licenses/`，引用却指向 `src/app/licenses/`）——截图看不到弹窗，人工验收不会发现，只有真点开对话框才暴露。
2. 早期我误以为 `dist/isokit.css` 是 vendor 副本，正是这类「文件位置与引用位置不一致」问题的同源。

---

## 六、对本地开发环境的影响

| 场景 | 修复前 | 修复后 |
|---|---|---|
| `npm start` + `http://127.0.0.1:8091/` | 404（根目录无 index.html） | 跳转到 `/src/app/` |
| `http://127.0.0.1:8091/src/app/` | 正常 | 正常（不变） |
| `npm run check` | 三项 | 四项（多路径自检） |
| jsdom 冒烟 | `runtime errors: none` | `runtime errors: none` |
| 截图（空闲/丢包/深色/窄屏） | 基线 | **与 M0 基线逐像素 0 差异** |

本地服务仍是 `python -m http.server 8091`（服务项目根），未新增任何服务端逻辑或代理。

---

## 七、残余风险

| 风险 | 影响 | 处置 |
|---|---|---|
| 将来把页面移出 `src/app/` | `../../` 层级失效 | P1/P2 校验会失败，CI 拦截 |
| 仓库改名为非预期值 | 无影响（相对路径与前缀无关） | — |
| 换自定义域名 | 无影响（同上） | — |
| `_site` 目录泄漏进版本库 | 仓库膨胀 | 已加入 `.gitignore` |
| Pages 首次部署需在仓库 Settings → Pages 选 "GitHub Actions" | 否则 deploy job 失败 | 首次推送时在仓库设置中确认（不是代码问题） |

**尚未验证的部分：** 本地没有 GitHub 远端，无法真实触发一次 Pages 部署。上文结论来自「按 CI 相同方式装配 `_site` + 相同前缀模拟」，覆盖了路径解析这一层；Pages CDN 行为、`actions/configure-pages` 的 base_path 注入未实测。首次推送后建议核对一次线上地址与资源状态码。

---

## 八、复现方式

```bash
# 0. 先构建数据与资产（dist/netlab-data.js 是构建产物，不入库）
npm run build

# 1. 按 CI 方式装配
rm -rf _site && mkdir -p _site && cp -r src content dist _site/ && cp index.html _site/index.html

# 2. 静态路径校验（CI 中同样执行）
node scripts/check-paths.cjs

# 3. 浏览器级验证：模拟仓库子路径部署（需本机 Chrome）
node .openai/check-pages-path.cjs --prefix /cs-systems-design-tcp
node .openai/check-pages-path.cjs --prefix /
node .openai/check-pages-path.cjs --prefix /a/b/nested-path
```

> Git Bash 下传 `/xxx` 参数需加 `MSYS_NO_PATHCONV=1`，否则会被转成 Windows 路径。

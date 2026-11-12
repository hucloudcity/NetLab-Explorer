// 部署路径自检：保证站点在「仓库子路径 / 自定义域名根路径」两种部署下资源都可解析。
//
// 背景：GitHub Pages 项目站点部署在 https://<user>.github.io/<repo>/ 下，
// 页面里任何 "/content/x.js" 这类根绝对路径都会指向域名根目录而 404。
// 因此约定：src/app/index.html 只允许相对路径（./ 或 ../），禁止 "/" 开头。
//
// 校验内容：
//  P1 index.html / app.js 中不存在根绝对路径引用（排除 #、http(s)、data:、mailto）
//  P2 每个相对引用按文档基准解析后，目标文件在仓库中真实存在
//  P3 若存在 CI 装配目录 _site/，同一引用在 _site 内也能解析（等价线上布局）
//  P4 站点根 index.html 的重定向目标存在且为目录
//
// 用法：node scripts/check-paths.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'src', 'app');
const ENTRY = path.join(APP_DIR, 'index.html');

const errors = [];
const notes = [];

// 从 HTML/JS 文本中抽取本地资源引用（相对路径才算本地）
function extractRefs(text) {
  const refs = [];
  const attrRe = /(?:href|src)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = attrRe.exec(text))) refs.push({ raw: m[1], kind: 'attr' });
  // app.js 里 innerHTML 拼的 <use href="./icons.svg#...">
  const useRe = /<use\s+href\s*=\s*\\?["']([^"'\\]+)/g;
  while ((m = useRe.exec(text))) refs.push({ raw: m[1], kind: 'use' });
  return refs.filter(r => {
    const v = r.raw.trim();
    if (!v) return false;
    if (v.includes('${')) return false; // JS 模板占位符，运行时才确定
    if (/^(#|mailto:|tel:|data:|javascript:)/i.test(v)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // http:, https:, //cdn 等
    return true;
  });
}

function stripQuery(v) {
  return v.split('#')[0].split('?')[0];
}

function checkFileRefs(file, baseDir, label) {
  const text = fs.readFileSync(file, 'utf8');
  const refs = extractRefs(text);
  for (const r of refs) {
    const clean = stripQuery(r.raw);
    if (!clean) continue;

    // P1：禁止根绝对路径
    if (clean.startsWith('/')) {
      errors.push(`P1 ${label} 使用根绝对路径 "${clean}"（部署到仓库子路径会 404）`);
      continue;
    }
    // 仅相对路径按文档基准解析
    const target = path.resolve(baseDir, clean);
    if (!target.startsWith(ROOT)) {
      errors.push(`P2 ${label} 引用超出项目目录 "${clean}"`);
      continue;
    }
    // P2：仓库内存在
    if (!fs.existsSync(target)) {
      errors.push(`P2 ${label} 引用 "${clean}" 解析为 ${path.relative(ROOT, target)}，文件不存在`);
      continue;
    }
    notes.push(`${label}: ${clean} → ${path.relative(ROOT, target)} ✓`);

    // P3：_site 装配后同样可解析（等价 Pages 线上布局）
    const siteDir = path.join(ROOT, '_site');
    if (fs.existsSync(siteDir)) {
      const relToRoot = path.relative(ROOT, target);
      if (!fs.existsSync(path.join(siteDir, relToRoot))) {
        errors.push(`P3 ${label} 引用 "${clean}" 在 _site 装配目录中缺失`);
      }
    }
  }
}

// ---- 执行 ----
if (!fs.existsSync(ENTRY)) {
  console.error(`路径自检失败：入口不存在 ${ENTRY}`);
  process.exit(1);
}

checkFileRefs(ENTRY, APP_DIR, 'index.html');
const appJs = path.join(APP_DIR, 'app.js');
if (fs.existsSync(appJs)) checkFileRefs(appJs, APP_DIR, 'app.js');

// P4：站点根重定向入口
const rootEntry = path.join(ROOT, 'index.html');
if (fs.existsSync(rootEntry)) {
  const html = fs.readFileSync(rootEntry, 'utf8');
  const m = html.match(/http-equiv=["']refresh["'][^>]*url=([^"'>]+)/i);
  if (!m) {
    errors.push('P4 根 index.html 缺少 meta refresh 重定向');
  } else {
    const dest = stripQuery(m[1].trim());
    const destPath = path.resolve(ROOT, dest);
    if (!fs.existsSync(destPath)) {
      errors.push(`P4 根 index.html 重定向目标 "${dest}" 不存在`);
    } else if (!fs.statSync(destPath).isDirectory() && !dest.endsWith('.html')) {
      errors.push(`P4 根 index.html 重定向目标 "${dest}" 不是页面`);
    } else {
      notes.push(`根 index.html → ${dest} ✓`);
    }
  }
} else {
  errors.push('P4 缺少站点根 index.html（Pages 站点根会 404）');
}

if (errors.length) {
  console.error('部署路径自检失败：');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log(`Deployment path check passed: ${notes.length} local references resolve; no root-absolute paths; root redirect ok.`);

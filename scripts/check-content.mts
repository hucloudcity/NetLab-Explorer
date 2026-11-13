#!/usr/bin/env node
/**
 * NetLab Explorer — 内容契约检查（M2-A：旧 check-content.cjs 的平移版）
 *
 * 旧脚本（已删除）直接 eval `content/data.js` 并断言旧数据形状。迁移后数据真相在
 * `content/*.json`，播放器吃的是构建产物 `dist/netlab-data.js`，因此本脚本**检查产物**
 * （即页面真正消费的那份），并把旧契约逐条保留：
 *
 *   1 课 / 1 组 / 机制说明与读数完整 / 来源 HTTPS / 两场景不共享数组 /
 *   4 节点 / 7 位帧 / 关系枚举 / local 不伪造传递 / 文本非空 /
 *   14 步主流程 / 第 6 步 lost / 第 6 行 sdata + Len=1460 / cdata 与 fin 存在 /
 *   14 条深注且长度 > 40 / TCP 五类 cat
 *
 * 唯一删除的断言：`code.length > 0`（决策 D-C：不迁移伪代码，页签已不存在）。
 * 新增断言：表格行与步骤等长、备用场景端口统一为 80（D9）、无报文步骤允许 null 占位。
 *
 * 运行前需 `node scripts/build-data.mts`（`npm run check` 已串好）。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import type { SiteData, TraceRowView } from '../src/engine/view-model.ts';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_FILE = path.join(ROOT, 'dist', 'netlab-data.js');
const MECH_FILE = path.join(ROOT, 'content', 'mechanisms.js');

if (!fs.existsSync(DATA_FILE)) {
  console.error(`内容检查失败：缺少 ${path.relative(ROOT, DATA_FILE)}，请先运行 node scripts/build-data.mts`);
  process.exit(1);
}

const sandbox: Record<string, unknown> = { window: {} };
vm.runInNewContext(fs.readFileSync(DATA_FILE, 'utf8'), sandbox, { filename: 'dist/netlab-data.js' });
const site = (sandbox.window as { NETLAB_DATA: SiteData }).NETLAB_DATA;

const mech: Record<string, unknown> = {};
vm.runInNewContext(
  fs.readFileSync(MECH_FILE, 'utf8') + ';globalThis.details=MECHANISM_DETAILS;globalThis.readings=CSAPP_READINGS;',
  mech,
  { filename: 'content/mechanisms.js' },
);
interface Reading { section: string; title: string; path: string; note: string }
interface Details { sections: { title: string; body: string }[]; foundation: string; readings: string[]; sources?: string[] }
const details = mech.details as Record<string, Details>;
const readings = mech.readings as Record<string, Reading>;

const lessons = site.lessons;
const ids = new Set(lessons.map((l) => l.id));

/* ---- 站点级契约 ---- */
assert.equal(lessons.length, 1, 'this build must contain exactly one lesson');
assert.deepEqual([...ids], ['tcp'], 'the only lesson is tcp');
assert.equal(site.groups.length, 1, 'single group');
assert.equal(lessons[0]?.group, 0, 'tcp belongs to the only group');
assert.deepEqual(Object.keys(details), ['tcp'], 'mechanism details exist for the only topic');

for (const l of lessons) {
  const d = details[l.id];
  assert.ok(d, l.id + ' mechanism details');
  assert.ok(d.sections.length > 0 && d.sections.every((s) => s.title && s.body), l.id + ' mechanism sections');
  assert.ok(d.foundation && d.readings.length > 0, l.id + ' CSAPP foundation and reading');
  for (const id of d.readings) {
    const r = readings[id];
    assert.ok(r && r.section && r.title && r.path && r.note, l.id + ' CSAPP reference ' + id);
  }
  for (const id of d.sources ?? []) assert.ok(site.sources[id], l.id + ' additional source ' + id);
}

const kinds = new Set(['request', 'data', 'control', 'check', 'reject', 'lost', 'local', 'compare']);
let count = 0;
for (const l of lessons) {
  assert.ok(l.alternate && Array.isArray(l.alternate.steps), l.id + ' needs a complete independent alternate scenario');
  assert.notEqual(l.steps, l.alternate?.steps, l.id + ' scenarios must not share a mutable steps array');
  const scenarios = [
    ['main', { nodes: l.nodes, steps: l.steps }],
    ['alternate', { nodes: l.alternate?.nodes ?? [], steps: l.alternate?.steps ?? [] }],
  ] as const;
  for (const [caseName, c] of scenarios) {
    assert.equal(c.nodes.length, 4, l.id + ' ' + caseName + ' node count');
    assert.ok(c.steps.length >= 2 && c.steps.length <= 16, l.id + ' ' + caseName + ' stage count');
    // 已删除：伪代码非空断言（决策 D-C）
    for (const s of c.steps) {
      count++;
      assert.equal(s.length, 7, l.id + ' ' + caseName + ' frame schema');
      assert.ok(s[1] >= 0 && s[1] < 4 && s[2] >= 0 && s[2] < 4, l.id + ' ' + caseName + ' node index');
      assert.ok(kinds.has(s[6]), l.id + ' ' + caseName + ' relation type');
      assert.equal(s[1] === s[2], s[6] === 'local', l.id + ' internal operations must not invent a transfer');
      for (const i of [0, 3, 4, 5]) assert.ok(typeof s[i] === 'string' && s[i].trim().length > 0, l.id + ' nonempty frame text');
    }
  }
  for (const r of l.related) assert.ok(ids.has(r), l.id + ' related ' + r);
  for (const id of l.sources) {
    const source = site.sources[id];
    assert.ok(source, l.id + ' source ' + id);
    assert.ok(/^https:\/\//.test(source.url), l.id + ' source HTTPS');
  }
}

/* ---- TCP 专项契约（自完整版站点沿用） ---- */
const tcp = lessons.find((l) => l.id === 'tcp');
assert.ok(tcp, 'tcp lesson');
assert.ok(tcp.scene === 'network' && Array.isArray(tcp.addresses) && tcp.addresses.length === 4, 'tcp network scene metadata');
const TCP_CATS = new Set(['hand', 'cdata', 'sdata', 'fin', 'lost']);
const rowSets: [string, (TraceRowView | null)[], number][] = [
  ['main', tcp.net.main, tcp.steps.length],
  ['alternate', tcp.net.alternate, tcp.alternate?.steps.length ?? 0],
];
for (const [key, rows, stepCount] of rowSets) {
  assert.equal(rows.length, stepCount, 'tcp packet rows must match stages (' + key + ')');
  for (const row of rows) {
    if (row === null) continue; // 无报文步骤：显式占位，不造假行
    for (const k of ['t', 'src', 'dst', 'proto', 'info', 'size'] as const) {
      assert.ok(typeof row[k] === 'string' && row[k].trim().length > 0, 'tcp net row field ' + k);
    }
    if (row.cat !== undefined) assert.ok(TCP_CATS.has(row.cat), 'tcp packet category ' + row.cat);
  }
}
// D9：主/备用端口统一（备用场景曾写 443，与主场景 80 冲突）
assert.ok(!tcp.net.alternate.some((r) => r && (r.src.includes('443') || r.dst.includes('443') || r.info.includes('443'))), 'alternate scenario must not use port 443');
assert.ok(tcp.net.main.some((r) => r !== null), 'main scenario has packet rows');
// PE 对齐回归：主流程是一条含握手/数据/丢失/SACK/重传/挥手的连续时间线
assert.equal(tcp.steps.length, 14, 'tcp main must be the continuous 14-stage lifecycle');
assert.equal(tcp.steps[5]?.[6], 'lost', 'row 6 is the lost segment');
const lostRow = tcp.net.main[5];
assert.ok(lostRow && lostRow.info.includes('Len=1460') && lostRow.cat === 'sdata', 'lost row keeps its server-data category');
assert.ok(
  tcp.net.main.map((r) => r?.cat).join(',').includes('cdata') && tcp.net.main.some((r) => r?.cat === 'fin'),
  'client data and FIN categories present',
);
assert.ok(Array.isArray(tcp.stepNotes) && tcp.stepNotes.length === 14 && tcp.stepNotes.every((n) => n.trim().length > 40), 'every stage carries a deep note');

console.log(
  `Content contracts passed: 1 lesson (TCP), 2 scenarios, ${count} typed stages, valid references. ` +
    'These checks do not prove protocol correctness.',
);

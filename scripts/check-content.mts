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
import { DemoSchema } from '../src/schemas/demo.schema.ts';
import type { SiteData, Frame7, TraceRowView } from '../src/engine/view-model.ts';
import type { StateChange } from '../src/types/demo.ts';

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

/* ---- 站点级契约（M2-B：多课程，不再假定全站只有一门课） ---- */
assert.equal(site.groups.length, 1, 'single group');
assert.equal(lessons.length, 2, 'this build must contain exactly two courses (tcp + arp)');
assert.deepEqual([...ids], ['tcp', 'arp'], 'courses follow catalog order: tcp then arp');
assert.ok(lessons.every((l) => l.group === 0), 'both courses belong to the only group');

/** 课程级参与设备数：不再对全站写死 4，也不允许课程自行「多一台少一台」而不更新契约。 */
const EXPECTED_NODES: Readonly<Record<string, number>> = { tcp: 4, arp: 3 };

for (const l of lessons) {
  const d = details[l.id];
  assert.ok(d, l.id + ' mechanism details');
  assert.ok(d.sections.length > 0 && d.sections.every((s) => s.title && s.body), l.id + ' mechanism sections');
  // CSAPP 阅读不是每门课的必备项（ARP 以 RFC 826 为准，不虚构教材条目）；
  // 但一旦写了 foundation，就必须有成套可解析的 readings —— 不允许半填。
  if (d.foundation) assert.ok(d.readings.length > 0, l.id + ' foundation requires readings');
  for (const id of d.readings) {
    const r = readings[id];
    assert.ok(r && r.section && r.title && r.path && r.note, l.id + ' CSAPP reference ' + id);
  }
  for (const id of d.sources ?? []) assert.ok(site.sources[id], l.id + ' additional source ' + id);
}
assert.ok(details.tcp?.foundation && (details.tcp?.readings.length ?? 0) > 0, 'TCP keeps its CSAPP foundation and readings');
assert.equal(details.arp?.readings.length, 0, 'ARP must not claim CSAPP readings it does not have');

const kinds = new Set(['request', 'data', 'control', 'check', 'reject', 'lost', 'local', 'compare']);
let count = 0;
for (const l of lessons) {
  const nodeCount = EXPECTED_NODES[l.id] ?? 0;
  assert.ok(nodeCount > 0, l.id + ' must declare its participant count in the course contract');
  assert.equal(l.nodes.length, nodeCount, l.id + ' node count');
  const scenarios: [string, { nodes: string[]; steps: Frame7[] }][] = [['main', { nodes: l.nodes, steps: l.steps }]];
  if (l.alternate) {
    assert.notEqual(l.steps, l.alternate.steps, l.id + ' scenarios must not share a mutable steps array');
    scenarios.push(['alternate', { nodes: l.alternate.nodes, steps: l.alternate.steps }]);
  }
  for (const [caseName, c] of scenarios) {
    assert.equal(c.nodes.length, nodeCount, l.id + ' ' + caseName + ' node count');
    assert.ok(c.steps.length >= 2 && c.steps.length <= 16, l.id + ' ' + caseName + ' stage count');
    // 已删除：伪代码非空断言（决策 D-C）
    for (const s of c.steps) {
      count++;
      assert.equal(s.length, 7, l.id + ' ' + caseName + ' frame schema');
      assert.ok(s[1] >= 0 && s[1] < nodeCount && s[2] >= 0 && s[2] < nodeCount, l.id + ' ' + caseName + ' node index');
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
assert.ok(tcp.alternate && tcp.alternate.steps.length === 4, 'tcp keeps its independent 4-stage alternate scenario');
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

/* ---- ARP 专项契约（M2-B 第二阶段：课程级协议语义 + 两张状态表的独立性） ---- */
const arp = lessons.find((l) => l.id === 'arp');
assert.ok(arp, 'arp lesson');
assert.equal(arp.scene, 'network', 'arp uses the network scene');
assert.equal(arp.nodes.length, 3, 'arp has three participants (A / SW / B)');
// 产物来自 vm 沙箱（另一个 realm），数组直接 deepEqual 会因原型链不同而假失败，统一按 JSON 文本比较。
assert.equal(JSON.stringify(arp.kinds), JSON.stringify(['laptop', 'switch', 'laptop']), 'arp kinds drive the G1 glyphs');
assert.equal(arp.addresses[0], '10.0.0.1', 'arp slot 0 is host A');
assert.equal(arp.addresses[2], '10.0.0.2', 'arp slot 2 is host B');
assert.equal(arp.steps.length, 8, 'arp main scenario has 8 stages');
assert.ok(!arp.alternate, 'arp carries a single scenario');
assert.equal(arp.net.main.length, 8, 'arp keeps one trace slot per stage (nulls must not be shortened)');
const arpRows = arp.net.main.filter((r): r is TraceRowView => r !== null);
assert.equal(arpRows.length, 5, 'arp has exactly 5 packet rows');
assert.equal(arpRows.filter((r) => r.cat === 'broadcast').length, 2, 'broadcast rows: A→SW and SW→B');
assert.equal(arpRows.filter((r) => r.cat === 'response').length, 2, 'response rows: B→SW and SW→A');
assert.equal(arpRows.filter((r) => r.cat === 'generic').length, 1, 'one encapsulated IP data row');
assert.equal(arp.steps.filter((f) => f[6] === 'local').length, 3, 'three local processing stages');
assert.equal(arp.net.main.filter((r) => r === null).length, 3, 'the three local stages are exactly the null rows');
assert.ok(Array.isArray(arp.stepNotes) && arp.stepNotes.length === 8 && arp.stepNotes.every((n) => n.trim().length > 40), 'arp carries 8 deep notes');

const arpDemo = DemoSchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'demos', 'arp-resolution.json'), 'utf8')));
assert.equal(arpDemo.topology.participants.length, 3, 'arp demo declares 3 devices');
assert.equal(arpDemo.topology.links.length, 2, 'arp demo declares 2 links (A—SW—B)');
const lan = arpDemo.topology.domains[0];
assert.ok(lan && lan.members.length === 3, 'arp broadcast domain covers all three devices');
const arpSteps = arpDemo.scenarios[0]?.steps ?? [];
assert.equal(arpSteps.length, 8, 'arp demo declares 8 steps');
const stepAt = (i: number) => {
  const s = arpSteps[i];
  if (!s) throw new Error('arp demo step ' + i + ' missing');
  return s;
};
const fieldsOf = (i: number): Record<string, string> => {
  const f = stepAt(i).events[0]?.payload?.fields;
  if (!f) throw new Error('arp demo step ' + i + ' has no payload fields');
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v)]));
};
const cacheChanges = (i: number) =>
  stepAt(i)
    .stateDeltas.flatMap((d) => d.changes)
    .filter((c): c is Extract<StateChange, { table: 'arp-cache' }> => c.table === 'arp-cache');
const macChanges = (i: number) =>
  stepAt(i)
    .stateDeltas.flatMap((d) => d.changes)
    .filter((c): c is Extract<StateChange, { table: 'mac-table' }> => c.table === 'mac-table');

// 步 1 建 incomplete 占位；步 7 转 reachable 并填上 B 的 MAC
assert.equal(cacheChanges(0)[0]?.entry.state, 'incomplete', 'step 1 creates an incomplete ARP placeholder');
assert.equal(cacheChanges(0)[0]?.entry.mac, undefined, 'the placeholder carries no MAC yet');
assert.equal(cacheChanges(6)[0]?.entry.state, 'reachable', 'step 7 flips the cache entry to reachable');
assert.equal(cacheChanges(6)[0]?.entry.mac, '02:00:00:00:00:0B', 'step 7 fills the MAC learned from the reply');

// 步 3 / 步 5 收帧即学；步 6 只查表转发，不产生新表项
assert.equal(macChanges(2).length, 1, 'step 3 learns exactly one MAC entry');
assert.equal(macChanges(2)[0]?.entry.mac, '02:00:00:00:00:0A', 'step 3 learns host A');
assert.equal(macChanges(2)[0]?.entry.port, 'G0/1', 'step 3 records the ingress port');
assert.equal(macChanges(4).length, 1, 'step 5 learns exactly one MAC entry');
assert.equal(macChanges(4)[0]?.entry.mac, '02:00:00:00:00:0B', 'step 5 learns host B');
assert.equal(macChanges(4)[0]?.entry.port, 'G0/2', 'step 5 records the ingress port');
assert.equal(macChanges(5).length, 0, 'step 6 forwards by lookup and learns nothing new');

// 两跳广播：Sender MAC / Sender IP / 以太网源 MAC 一致，且第二跳不是重新生成的 Request
const req = fieldsOf(1);
const flood = fieldsOf(2);
for (const k of ['SenderMAC', 'SenderIP', 'SrcMAC', 'TargetMAC', 'TargetIP']) {
  assert.equal(flood[k], req[k], 'broadcast hop 2 keeps ' + k);
}
assert.equal(flood.Opcode, '1', 'the flooded frame is still an ARP Request (opcode 1)');
assert.equal(flood.TargetMAC, '00:00:00:00:00:00', 'the request still asks: target MAC stays unknown in flight');
assert.equal(stepAt(2).events[0]?.payload?.summary, stepAt(1).events[0]?.payload?.summary, 'the forwarded frame keeps the original summary');
assert.equal(stepAt(2).events[0]?.payload?.size, stepAt(1).events[0]?.payload?.size, 'the forwarded frame keeps the original size');
assert.equal(arpRows[0]?.src, arpRows[1]?.src, 'both broadcast rows show the same Ethernet source MAC');
assert.equal(arpRows[0]?.dst, arpRows[1]?.dst, 'both broadcast rows target FF:FF:FF:FF:FF:FF');

// 应答：单播且方向正确；被转发的那一跳不改写任何地址字段
const reply = fieldsOf(4);
const fwd = fieldsOf(5);
assert.equal(reply.Opcode, '2', 'the reply carries opcode 2');
assert.equal(reply.SenderMAC, '02:00:00:00:00:0B', 'the reply advertises host B MAC');
assert.equal(reply.TargetMAC, '02:00:00:00:00:0A', 'the reply is addressed to host A MAC');
for (const k of ['SenderMAC', 'SenderIP', 'SrcMAC', 'DstMAC', 'Opcode']) {
  assert.equal(fwd[k], reply[k], 'forwarded reply keeps ' + k);
}
assert.equal(arpRows[3]?.src, '02:00:00:00:00:0B', 'the reply row is unicast from B');
assert.equal(arpRows[3]?.dst, '02:00:00:00:00:0A', 'the reply row is unicast to A');

// ARP 缓存与 MAC 地址表是两套独立状态：不同设备、不同键、互不写入
const owners = (table: string): string[] => {
  const set = new Set<string>();
  for (const s of arpSteps) for (const d of s.stateDeltas) for (const c of d.changes) if (c.table === table && d.device) set.add(d.device);
  return [...set].sort();
};
assert.deepEqual(owners('arp-cache'), ['a'], 'only host A owns an ARP cache');
assert.deepEqual(owners('mac-table'), ['sw'], 'only the switch owns a MAC address table');
const initial = arpDemo.scenarios[0]?.initialState ?? {};
assert.deepEqual(Object.keys(initial['a'] ?? {}), ['arp-cache'], 'A starts with an ARP cache only');
assert.deepEqual(Object.keys(initial['sw'] ?? {}), ['mac-table'], 'the switch starts with a MAC table only');
assert.ok(!('mac-table' in (initial['a'] ?? {})), 'the ARP cache is not a MAC table');
assert.ok(!('arp-cache' in (initial['sw'] ?? {})), 'the MAC table is not an ARP cache');

// 课程目录与知识内容引用完整
const catalogRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'catalog.json'), 'utf8')) as {
  courses: { demoId: string; knowledgeId: string; hash: string; groupId: string }[];
};
const entry = catalogRaw.courses.find((c) => c.hash === 'arp');
assert.ok(entry, 'catalog registers the arp course');
assert.equal(entry.demoId, 'arp-resolution');
assert.equal(entry.knowledgeId, 'NET-04-09');
assert.equal(entry.groupId, 'network');
const kpRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'knowledge', 'NET-04-09.json'), 'utf8')) as {
  demoRefs: string[];
  sourceRefs: { sourceId: string }[];
};
assert.deepEqual(kpRaw.demoRefs, ['arp-resolution'], 'the knowledge point points back at the demo');
assert.ok(kpRaw.sourceRefs.some((r) => r.sourceId === 'rfc-826'), 'the knowledge point cites RFC 826');
assert.ok(site.sources['rfc-826'], 'RFC 826 is in the built source ledger');

console.log(
  `Content contracts passed: 2 lessons (TCP 14 steps + ARP 8 steps), ${count} typed stages, valid references. ` +
    'These checks do not prove protocol correctness.',
);

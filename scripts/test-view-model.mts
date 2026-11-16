#!/usr/bin/env node
/**
 * NetLab Explorer — 适配层单元测试（M2-A）
 * 覆盖 docs/m2a-implementation-plan.md §9.1 的 A–F 六组断言（≥40 条）。
 *
 * 数据来源两种：
 * - **真实内容** `content/*.json`（过 L1 后进适配层）：验证迁移结果本身；
 * - **结构化克隆 + 定点破坏**：验证不变式与阴性路径（不改仓库文件）。
 *
 * 运行：node scripts/test-view-model.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DemoSchema } from '../src/schemas/demo.schema.ts';
import { KnowledgePointSchema } from '../src/schemas/knowledge.schema.ts';
import { SourceSchema } from '../src/schemas/source.schema.ts';
import { CatalogSchema } from '../src/schemas/catalog.schema.ts';
import { buildSite, relationOf, stateLabelAt, toTraceRow, toFrame } from '../src/engine/view-model.ts';
import type { FrameContext } from '../src/engine/view-model.ts';
import { deepFreeze } from '../src/engine/fold-state.ts';
import type { BroadcastDomain, Demo, DemoEvent, DemoScenario, Device, Step } from '../src/types/demo.ts';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p: string): unknown => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const demo = DemoSchema.parse(read('content/demos/tcp-lifecycle.json'));
const kp = KnowledgePointSchema.parse(read('content/knowledge/NET-04-08.json'));
const sources = (read('content/sources.json') as unknown[]).map((s) => SourceSchema.parse(s));
const catalog = CatalogSchema.parse(read('content/catalog.json'));
// 本文件是 TCP 单课夹具：只取 tcp 这一门课。多课程后完整目录会引用本夹具未加载的演示，
// 触发 I9（那属于目录完整性的构建期校验，由 build-data / check-content 覆盖），与这里的断言无关。
const tcpOnlyCatalog = CatalogSchema.parse({
  groups: catalog.groups,
  courses: catalog.courses.filter((c) => c.hash === 'tcp'),
});

const site = buildSite({ demos: [demo], knowledge: [kp], sources, catalog: tcpOnlyCatalog });
const lesson = site.lessons[0];
if (!lesson) throw new Error('site.lessons 为空');
const alt = lesson.alternate;
if (!alt) throw new Error('TCP 备用场景缺失');

let n = 0;
const ok = (cond: boolean, msg: string): void => {
  assert.ok(cond, msg);
  n++;
};
function eq<T>(actual: T, expected: T, msg: string): void {
  assert.deepEqual(actual, expected, msg);
  n++;
}

/* ================= A 结构（8） ================= */
eq(lesson.steps.length, 14, 'A1 主流程 14 步');
eq(alt.steps.length, 4, 'A2 备用流程 4 步');
eq(lesson.nodes.length, 4, 'A3 四个设备节点');
eq(lesson.addresses, ['192.168.1.10', '192.168.1.1', '', '203.0.113.10:80'], 'A4 地址四项且 Internet 为空串');
ok([...lesson.steps, ...alt.steps].every((f) => f.length === 7), 'A5 每帧 7 位');
ok([...lesson.steps, ...alt.steps].every((f) => f[1] >= 0 && f[1] < 4 && f[2] >= 0 && f[2] < 4), 'A6 槽位在 participants 范围内');
ok([...lesson.steps, ...alt.steps].every((f) => (f[1] === f[2]) === (f[6] === 'local')), 'A7 from==to ⇔ local');
ok(
  [...lesson.steps, ...alt.steps].every((f) => [0, 3, 4, 5].every((i) => typeof f[i] === 'string' && String(f[i]).trim().length > 0)),
  'A8 标题/信号/字幕/状态四列非空',
);

/* ================= B 状态文案（6 组，18 条逐字） ================= */
const expectedLabels = [
  '客户端 SYN_SENT · 服务端 LISTEN',
  '服务端 SYN_RCVD · 半连接队列',
  '双向 ESTABLISHED · 连接就绪',
  '78 B 请求已发出',
  '服务端分段发送响应',
  '分段在途中丢失',
  'Seq=1461 分段送达 · 缺口留在 Seq=1',
  '缺口已上报 · 等待重传',
  '重传分段发出',
  '响应数据完整接收',
  '客户端 FIN_WAIT_1',
  // 批准的内容修正：旧手写文案漏了客户端 FIN_WAIT_2（步骤正文明确写了它）
  '客户端 FIN_WAIT_2 · 服务端 CLOSE_WAIT',
  '服务端 LAST_ACK',
  '客户端 TIME_WAIT · 服务端 CLOSED',
];
expectedLabels.forEach((want, i) => eq(lesson.steps[i]?.[5], want, `B1 主流程第 ${i + 1} 步状态文案`));
const expectedAltLabels = [
  '客户端 FIN_WAIT_1 · 半关闭',
  '服务端 CLOSE_WAIT · 仍可发送',
  '服务端 LAST_ACK · 等待最终确认',
  '客户端 TIME_WAIT · 服务端 CLOSED',
];
expectedAltLabels.forEach((want, i) => eq(alt.steps[i]?.[5], want, `B2 备用流程第 ${i + 1} 步状态文案`));

const STATE_NAMES = ['CLOSED', 'LISTEN', 'SYN_SENT', 'SYN_RCVD', 'ESTABLISHED', 'CLOSE_WAIT', 'FIN_WAIT_1', 'CLOSING', 'LAST_ACK', 'FIN_WAIT_2', 'TIME_WAIT'];
const notes = demo.scenarios.flatMap((s) => s.steps.map((st) => st.events[0]?.note ?? ''));
ok(notes.every((note) => !STATE_NAMES.some((name) => note.includes(name))), 'B3 note 不复述状态枚举名（防手写状态回流）');
ok(JSON.stringify(stateLabelAt(demo.scenarios[0] as never, 0, demo.topology.participants)) === JSON.stringify(lesson.steps[0]?.[5]), 'B4 状态文案可复算且稳定（纯函数）');
eq(lesson.steps[2]?.[5]?.startsWith('双向 '), true, 'B5 多设备同状态才用「双向」');
eq(lesson.steps[13]?.[5]?.includes(' · '), true, 'B5b 多设备不同状态用「 · 」连接');

// 观察点为空（无 delta 且无 note）→ 必须抛错，不得静默产出空文案
const bare = structuredClone(demo) as Demo;
const bareStep = bare.scenarios[0]?.steps[3];
if (!bareStep) throw new Error('夹具缺少第 4 步');
bareStep.stateDeltas = [];
delete bareStep.events[0]?.note;
assert.throws(() => buildSite({ demos: [bare], knowledge: [kp], sources, catalog: tcpOnlyCatalog }), /I6/, 'B6 无观察点且无 note 时报 I6');
n++;

// 短名缺省回退 label（不是把角色中文化写进代码）
const noShort = structuredClone(demo) as Demo;
for (const d of noShort.topology.participants) delete d.stateLabel;
const noShortLesson = buildSite({ demos: [noShort], knowledge: [kp], sources, catalog: tcpOnlyCatalog }).lessons[0];
eq(noShortLesson?.steps[0]?.[5], '客户端 SYN_SENT · Web 服务器 LISTEN', 'B6b stateLabel 缺省回退 Device.label');
eq(noShortLesson?.steps[1]?.[5], 'Web 服务器 SYN_RCVD · 半连接队列', 'B6c 回退后仍按设备短名成句');

/* ================= C 关系 ================= */
// 主流程 14 步：fin 一律 request（第 11、13、14 步），纯 ACK/数据段仍是 data。
const expectedKinds = ['request', 'data', 'request', 'data', 'data', 'lost', 'data', 'request', 'data', 'request', 'request', 'data', 'request', 'request'];
eq(lesson.steps.map((f) => f[6]), expectedKinds, 'C1 主流程 14 步关系符合映射规则');
eq(lesson.alternate?.steps.map((f) => f[6]) ?? [], ['request', 'data', 'request', 'local'], 'C1b 备用 4 步：服务端 FIN 也是 request');
const ev = (patch: Partial<DemoEvent>): DemoEvent => ({
  id: 'e-test',
  kind: 'unicast',
  from: 'a',
  to: { kind: 'device', id: 'b' },
  payload: { proto: 'TCP', summary: 'x', cat: 'hand' },
  dependsOn: [],
  ...patch,
});
eq(relationOf(ev({ kind: 'drop' }), 'a'), 'lost', 'C2 drop → lost');
eq(relationOf(ev({ kind: 'process', to: { kind: 'device', id: 'a' } }), 'a'), 'local', 'C3 process → local');
eq(relationOf(ev({ payload: { proto: 'TCP', summary: 'x', cat: 'cdata' } }), 'a'), 'data', 'C4a cdata → data');
eq(relationOf(ev({ payload: { proto: 'TCP', summary: 'x', cat: 'sdata' } }), 'a'), 'data', 'C4b sdata → data');
eq(relationOf(ev({}), 'a'), 'request', 'C5a hand 发起方 → request');
eq(relationOf(ev({ from: 'b', to: { kind: 'device', id: 'a' } }), 'a'), 'data', 'C5b hand 非发起方 → data');
eq(relationOf(ev({ payload: { proto: 'TCP', summary: 'FIN, ACK Seq=79 Ack=1', cat: 'fin' } }), 'a'), 'request', 'C5c fin 发起方 → request');
eq(relationOf(ev({ from: 'b', to: { kind: 'device', id: 'a' }, payload: { proto: 'TCP', summary: 'FIN seq=w', cat: 'fin' } }), 'a'), 'request', 'C5d fin 非发起方 → request（关闭请求与谁先开口无关）');
eq(relationOf(ev({ from: 'b', to: { kind: 'device', id: 'a' }, payload: { proto: 'TCP', summary: 'ACK u+1', cat: 'fin' } }), 'a'), 'data', 'C5e 关闭阶段的纯 ACK 仍是 data（cat=fin 只是配色分组）');
eq(relationOf(ev({ payload: { proto: 'DNS', summary: 'A? www.example.com', cat: 'query' } }), 'a'), 'request', 'C6a query → request（M2-C：DNS 查询是请求语义）');
eq(relationOf(ev({ payload: { proto: 'DNS', summary: 'A 93.184.216.34', cat: 'response' } }), 'a'), 'data', 'C6b 未知/未细分类别仍落 data（原 C6 语义：默认分支保持 data，response 与 ARP Reply 先例一致）');

/* ================= D 表格（7） ================= */
eq(lesson.net.main.length, 14, 'D1 主流程 14 行');
eq(lesson.net.alternate.length, 4, 'D2 备用流程 4 行');
eq(toTraceRow({ time: '0.000', src: 's', dst: 'd', proto: 'TCP', info: 'i', size: 66 })?.size, '66 B', 'D3 size 格式化为 "66 B"');
eq(toTraceRow(null), null, 'D4 null 行保持 null（不造假）');
eq(toTraceRow(undefined), null, 'D4b 缺省行保持 null');
eq(lesson.net.main[5] !== null && lesson.net.main[5]?.size === '1514 B', true, 'D5 lost 行仍是服务器数据（sdata / 1514 B）');
ok(!lesson.net.alternate.some((r) => r && `${r.t}${r.src}${r.dst}${r.info}`.includes('443')), 'D6 备用场景无 443（D9 端口统一）');
ok(lesson.net.main[0]?.t === '0.000' && lesson.net.main[13]?.t === '0.148', 'D7 时间列原样保留');

// 无报文步骤：合成 demo，第 2 步无行 → 等长且为 null，不抛错
const gap = structuredClone(demo) as Demo;
const gapStep = gap.scenarios[0]?.steps[1];
if (!gapStep) throw new Error('夹具缺少第 2 步');
gapStep.traceRow = null;
const gapLesson = buildSite({ demos: [gap], knowledge: [kp], sources, catalog: tcpOnlyCatalog }).lessons[0];
eq(gapLesson?.net.main.length, 14, 'D8 无报文步骤仍等长（null 占位）');
eq(gapLesson?.net.main[1], null, 'D8b 无报文步骤为 null');
ok(gapLesson?.net.main[2] !== null, 'D8c 其后步骤不受影响（不按下标错位）');

// 绑定错误：eventRef 指向别的步骤 → I2
const badRef = structuredClone(demo) as Demo;
const badStep = badRef.scenarios[0]?.steps[4];
if (!badStep?.traceRow) throw new Error('夹具缺少第 5 步行');
badStep.traceRow.eventRef = 'e01';
assert.throws(() => buildSite({ demos: [badRef], knowledge: [kp], sources, catalog: tcpOnlyCatalog }), /I2/, 'D9 eventRef 不指向本步时报 I2');
n++;

// cat 与 payload.cat 不一致 → I3
const badCat = structuredClone(demo) as Demo;
const badCatRow = badCat.scenarios[0]?.steps[4]?.traceRow;
if (!badCatRow) throw new Error('夹具缺少第 5 步行');
badCatRow.cat = 'sdata';
assert.throws(() => buildSite({ demos: [badCat], knowledge: [kp], sources, catalog: tcpOnlyCatalog }), /I3/, 'D10 cat 与 payload 不一致时报 I3');
n++;

/* ================= E 站点（5） ================= */
eq(site.groups.length, 1, 'E1 单分组');
eq(site.groups[0]?.name, '网络协议', 'E2 分组名');
eq(lesson.id, 'tcp', 'E3 视图 id 用 catalog.hash（深链/进度键兼容）');
eq(lesson.demoId, 'tcp-lifecycle', 'E3b 数据 id 单独保留');
const rfcCard = site.sources['rfc-9293'];
ok(!!rfcCard && Object.keys(rfcCard).sort().join(',') === 'kind,name,note,url', 'E4 来源卡片四字段齐');
ok(rfcCard?.kind === '具体机制资料' && site.sources['csapp-3e']?.kind === '课程背景', 'E4b kind 由 type 映射');
eq(lesson.related, [], 'E5 related 为空数组（单篇不互指）');

/* ================= F 纯函数（4） ================= */
const again = buildSite({ demos: [demo], knowledge: [kp], sources, catalog: tcpOnlyCatalog });
ok(JSON.stringify(again) === JSON.stringify(site), 'F1 两次构建逐字节相同');
const frozen = deepFreeze(structuredClone(demo) as Demo);
assert.doesNotThrow(() => buildSite({ demos: [frozen], knowledge: [kp], sources, catalog: tcpOnlyCatalog }), 'F2 输入深冻结仍可构建');
n++;
const frozenLabels = buildSite({ demos: [frozen], knowledge: [kp], sources, catalog: tcpOnlyCatalog }).lessons[0]?.steps.map((f) => f[5]);
eq(frozenLabels, lesson.steps.map((f) => f[5]), 'F3 冻结输入的派生结果不变');
ok(!/Date|performance/.test(fs.readFileSync(path.join(ROOT, 'src/engine/view-model.ts'), 'utf8')), 'F4 适配层不读时间/性能接口');

/* ================= I9：目录与知识点引用 ================= */
const broken = structuredClone(tcpOnlyCatalog);
if (!broken.courses[0]) throw new Error('目录为空');
broken.courses[0].demoId = 'missing-demo';
assert.throws(() => buildSite({ demos: [demo], knowledge: [kp], sources, catalog: broken }), /I9/, 'G1 目录指向不存在的演示时报 I9');
n++;

/* ================= H 广播逐跳（M2-B G4） ================= */
// 3 设备 ARP 拓扑（主机 A / 交换机 / 主机 B）：域成员含交换机（与 TCP lan-home 口径一致）。
const arpDevices: Device[] = [
  { id: 'a', label: '主机 A', role: 'host', kind: 'laptop', address: { ip: '10.0.0.1', mac: 'AA:AA:AA:AA:AA:AA' } },
  { id: 'sw', label: '交换机', role: 'switch', kind: 'switch' },
  { id: 'b', label: '主机 B', role: 'host', kind: 'laptop', address: { ip: '10.0.0.2', mac: 'BB:BB:BB:BB:BB:BB' } },
];
const arpDomains: BroadcastDomain[] = [{ id: 'lan-a', label: 'LAN A', members: ['a', 'sw', 'b'] }];
const arpSlotOf = (id: string): number => {
  const i = arpDevices.findIndex((d) => d.id === id);
  if (i < 0) throw new Error(`未知设备 ${id}`);
  return i;
};
const bEvent = (patch: Partial<DemoEvent>): DemoEvent => ({
  id: 'e-b',
  kind: 'broadcast',
  from: 'a',
  to: { kind: 'broadcast', domain: 'lan-a' },
  payload: { proto: 'ARP', summary: 'ARP Request who-has 10.0.0.2 tell 10.0.0.1', cat: 'broadcast' },
  dependsOn: [],
  ...patch,
});
const bStep = (ev: DemoEvent): Step => ({
  id: 'st-b',
  title: 'ARP 请求',
  description: '主机 A 广播 ARP Request',
  events: [ev],
  stateDeltas: [{ id: 'd-b1', device: 'a', changes: [{ table: 'arp-cache', op: 'upsert', entry: { ip: '10.0.0.2', state: 'incomplete' } }] }],
});
const bCtx = (ev: DemoEvent): FrameContext => ({
  slotOf: arpSlotOf,
  initiatorId: 'a',
  devices: arpDevices,
  domains: arpDomains,
  scenario: { id: 's-arp', label: 'ARP', initialState: { a: {}, sw: {}, b: {} } as never, steps: [bStep(ev)] } as unknown as DemoScenario,
  stepIndex: 0,
});

// H1 第一跳：A 发出广播，excludeFrom 排除 B（B 由第二跳事件送达）→ 动画目标恰为交换机
const hop1 = toFrame(bStep(bEvent({ to: { kind: 'broadcast', domain: 'lan-a', excludeFrom: ['b'] } })), bCtx(bEvent({ to: { kind: 'broadcast', domain: 'lan-a', excludeFrom: ['b'] } })));
eq(hop1[1], 0, 'H1 第一跳动画起点 = 主机 A 槽位');
eq(hop1[2], 1, 'H1 第一跳动画目标 = 交换机槽位');
eq(hop1[6], 'request', 'H1 广播帧 → request（有运动粒子）');

// H2 第二跳：交换机泛洪转发。动画起点是交换机，但事件源不被改写、原始报文头留在 payload。
const fwd = bEvent({
  from: 'sw',
  to: { kind: 'broadcast', domain: 'lan-a', excludeFrom: ['a'] },
  payload: { proto: 'ARP', summary: 'ARP Request who-has 10.0.0.2 tell 10.0.0.1（交换机泛洪转发）', cat: 'broadcast' },
});
const fwdSnapshot = JSON.stringify(fwd);
const hop2 = toFrame(bStep(fwd), bCtx(fwd));
eq(hop2[1], 1, 'H2 转发步动画起点 = 交换机槽位');
eq(hop2[2], 2, 'H2 转发步动画目标 = 主机 B 槽位');
eq(hop2[6], 'request', 'H2 转发仍是广播 → request');
eq(JSON.stringify(fwd), fwdSnapshot, 'H2 适配层不改写事件对象（源 MAC / Sender 字段原样保留，「转发」≠「重新生成请求」）');

// H3–H6 阴性路径
assert.throws(() => toFrame(bStep(bEvent({})), bCtx(bEvent({}))), /第一阶段仅支持单接收者/, 'H3 多接收者（未写 excludeFrom）显式报错，不静默丢弃');
n++;
assert.throws(() => toFrame(bStep(bEvent({ to: { kind: 'broadcast', domain: 'nope' } })), bCtx(bEvent({ to: { kind: 'broadcast', domain: 'nope' } }))), /不在 topology\.domains/, 'H4 广播域不存在报错');
n++;
assert.throws(
  () => toFrame(bStep(bEvent({ to: { kind: 'broadcast', domain: 'lan-a', excludeFrom: ['b', 'sw'] } })), bCtx(bEvent({ to: { kind: 'broadcast', domain: 'lan-a', excludeFrom: ['b', 'sw'] } }))),
  /没有接收者/,
  'H5 排除后无接收者报错',
);
n++;
assert.throws(
  () => toFrame(bStep(bEvent({ to: { kind: 'multicast', domain: 'lan-a', roleFilter: ['host'] } })), bCtx(bEvent({ to: { kind: 'multicast', domain: 'lan-a', roleFilter: ['host'] } }))),
  /暂不支持 multicast/,
  'H6 multicast 目标仍不支持（留给 G3 之后）',
);
n++;
eq(relationOf(bEvent({}), 'a'), 'request', 'H7 relationOf：broadcast 一律 request（不受 payload.cat 影响）');

console.log(`view-model tests passed: ${n} assertions (18 state labels, 12 relation cases, 9 broadcast-hop cases, null-row placeholder, I2/I3/I6/I9 negative paths).`);

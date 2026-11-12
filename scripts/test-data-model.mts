#!/usr/bin/env node
/**
 * NetLab Explorer — 数据模型独立测试（M2-P0）
 *
 * 覆盖：
 *   A. 波次计算（M1 审计 8 项，含顺序打乱）
 *   B. 状态折叠（M1 审计 12 项 + N7 expire/clone 语义）
 *   C. 发布门禁（M1 审计 14 项 + N3 的 P7 与 draft/review 边界）
 *   D. L1 结构校验（N2：保留表条目形状、通用表白名单、strict 策略）
 *   E. 多播 roleFilter（N1：真实角色过滤、空集诊断、kind/TargetSpec 一致性）
 *
 * 运行：node scripts/test-data-model.mts（退出码非 0 表示有 FAIL）
 * 定位：独立于 validate-content 的自测，不依赖仓库内落地数据。
 */
import { DemoSchema, StateChangeSchema, TraceRowSchema } from '../src/schemas/demo.schema.ts';
import { computeWaves, checkWavePurity } from '../src/engine/waves.ts';
import { deepFreeze, foldState, snapshotsEqual } from '../src/engine/fold-state.ts';
import { knowledgePublishGates, demoPublishGates, demoteOnSourceRetired, multicastRecipients, validateEventShape } from './validate-content.mts';
import type { BroadcastDomain, DemoEvent, Device, StateDelta, StateEntry, StateSnapshot } from '../src/types/demo.ts';
import type { KnowledgePoint } from '../src/types/knowledge.ts';
import type { LicenseStatus, Source } from '../src/types/source.ts';

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? ` | ${detail}` : ''}`);
  }
}

function throws(name: string, fn: () => unknown): void {
  try {
    fn();
    ok(name, false, '未抛出异常');
  } catch (e) {
    ok(name, true);
    console.log(`      ↳ ${(e as Error).message.slice(0, 70)}`);
  }
}

/* ========================= A. 波次 ========================= */

console.log('\n[A] 波次计算');

const events = [
  { id: 'e-a', dependsOn: [] as string[] },
  { id: 'e-b', dependsOn: ['e-a'] },
  { id: 'e-c', dependsOn: ['e-a'] },
  { id: 'e-d', dependsOn: ['e-b', 'e-c'] },
  { id: 'e-e', dependsOn: [] as string[] },
];
const baseWaves = computeWaves(events);
ok(
  'A1 拓扑分层：e-a/e-e=0，e-b/e-c=1，e-d=2',
  baseWaves.get('e-a') === 0 && baseWaves.get('e-e') === 0 && baseWaves.get('e-b') === 1 && baseWaves.get('e-c') === 1 && baseWaves.get('e-d') === 2,
);

const permutations = [
  [...events].reverse(),
  [events[3], events[0], events[4], events[2], events[1]],
  [events[2], events[3], events[1], events[4], events[0]],
  [events[4], events[3], events[2], events[1], events[0]],
].filter((p): p is typeof events => p.every((e) => e !== undefined));
const waveStable = permutations.every((perm) => {
  const m = computeWaves(perm);
  return [...baseWaves].every(([id, w]) => m.get(id) === w);
});
ok('A2 打乱数组顺序（4 种置换）波次逐事件一致', waveStable);

const crossStep = computeWaves([{ id: 'x-1', dependsOn: ['prev-step-event'] }], new Set(['prev-step-event']));
ok('A3 跨步骤依赖视为已满足（第 0 波）', crossStep.get('x-1') === 0);

throws('A4 悬空依赖抛错', () => computeWaves([{ id: 'x', dependsOn: ['ghost'] }]));
throws('A5 依赖环抛错', () => computeWaves([{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }]));
throws('A6 自依赖抛错', () => computeWaves([{ id: 'a', dependsOn: ['a'] }]));
throws('A7 重复事件 id 抛错', () => computeWaves([{ id: 'a', dependsOn: [] }, { id: 'a', dependsOn: [] }]));
ok('A8 纯度检查通过时返回 null', checkWavePurity(events) === null);

/* ========================= B. 状态折叠 ========================= */

console.log('\n[B] 状态折叠');

const init: StateSnapshot = {
  pc: {
    'arp-cache': [{ ip: '10.0.0.1', mac: 'A', state: 'reachable' }],
    'tcp-state': [{ peer: 'srv', to: 'CLOSED' }],
  },
  gw: { 'arp-cache': [{ ip: '10.0.0.9', mac: 'G', state: 'stale' }] },
};
const frozen = deepFreeze(structuredClone(init));
const frozenSnapshot = JSON.stringify(frozen);

/** noUncheckedIndexedAccess 下的读表助手。 */
const tbl = (s: StateSnapshot, dev: string, table: string): StateEntry[] => s[dev]?.[table] ?? [];
const hasIp = (s: StateSnapshot, dev: string, ip: string): boolean => tbl(s, dev, 'arp-cache').some((e) => (e as { ip?: string }).ip === ip);
const arpOf = (s: StateSnapshot, dev: string, ip: string) =>
  tbl(s, dev, 'arp-cache').find((e) => (e as { ip?: string }).ip === ip) as { ip: string; mac?: string; state: string } | undefined;
const tcpStateOf = (s: StateSnapshot, dev: string): string | undefined =>
  (tbl(s, dev, 'tcp-state')[0] as { to?: string } | undefined)?.to;

const d1: StateDelta = { id: 'd1', device: 'pc', changes: [{ table: 'arp-cache', op: 'upsert', entry: { ip: '10.0.0.2', mac: 'B', state: 'reachable' } }] };
const d2: StateDelta = { id: 'd2', changes: [{ table: 'tcp-state', op: 'set', entry: { peer: 'srv', to: 'SYN_SENT' } }] };
const folded = foldState(frozen, [d1, d2]);

ok('B1 纯函数：deep-frozen 输入未被修改', JSON.stringify(frozen) === frozenSnapshot);
ok('B2 确定性：三次折叠逐字段一致', snapshotsEqual(folded, foldState(frozen, [d1, d2])) && snapshotsEqual(folded, foldState(frozen, [d1, d2])));
ok('B3 全局 delta（无 device）作用于含该表的设备', tcpStateOf(folded, 'pc') === 'SYN_SENT');
ok('B4 upsert 保留同表其他条目', hasIp(folded, 'pc', '10.0.0.1') && hasIp(folded, 'pc', '10.0.0.2'));

const cleared = foldState(frozen, [{ id: 'c', device: 'pc', changes: [{ table: 'arp-cache', op: 'clear', entry: { ip: 'x', state: 'stale' } }] }]);
ok('B5 clear 只作用于目标设备', tbl(cleared, 'pc', 'arp-cache').length === 0 && tbl(cleared, 'gw', 'arp-cache').length === 1);

const expiredMissing = foldState(frozen, [{ id: 'e', device: 'pc', changes: [{ table: 'arp-cache', op: 'expire', entry: { ip: '99.9.9.9', state: 'stale' } }] }]);
ok(
  'B6 N7：expire 不存在的条目为 no-op（不凭空创建 stale 条目）',
  !hasIp(expiredMissing, 'pc', '99.9.9.9'),
  JSON.stringify(tbl(expiredMissing, 'pc', 'arp-cache')),
);

const expiredExisting = foldState(frozen, [{ id: 'e2', device: 'pc', changes: [{ table: 'arp-cache', op: 'expire', entry: { ip: '10.0.0.1', state: 'stale' } }] }]);
const expiredEntry = arpOf(expiredExisting, 'pc', '10.0.0.1');
ok('B7 expire 已有条目 → stale 且去掉 mac', expiredEntry !== undefined && expiredEntry.state === 'stale' && !('mac' in expiredEntry));

const removedMissing = foldState({ d: { 'dns-cache': [{ name: 'a', ttl: 1 }] } }, [{ id: 'r', device: 'd', changes: [{ table: 'dns-cache', op: 'remove', entry: { name: 'ghost' } }] }]);
ok('B8 remove 不存在的通用条目 → no-op', tbl(removedMissing, 'd', 'dns-cache').length === 1);

const ghost = foldState(frozen, [{ id: 'g', device: 'ghost-dev', changes: [{ table: 'arp-cache', op: 'clear', entry: { ip: 'x', state: 'stale' } }] }]);
ok('B9 幽灵设备 delta → 静默跳过（X6 负责报错）', snapshotsEqual(ghost, frozen));

const dA: StateDelta = { id: 'A', device: 'pc', changes: [{ table: 'arp-cache', op: 'upsert', entry: { ip: '1.1.1.1', mac: 'X', state: 'reachable' } }] };
const dB: StateDelta = { id: 'B', device: 'pc', changes: [{ table: 'arp-cache', op: 'clear', entry: { ip: 'x', state: 'stale' } }] };
ok(
  'B10 回退=前缀重放（fold([dA]) 与 fold([dA,dB]) 独立可算，无逆操作）',
  tbl(foldState(frozen, [dA]), 'pc', 'arp-cache').length === 2 && tbl(foldState(frozen, [dA, dB]), 'pc', 'arp-cache').length === 0,
);

const midStep: StateDelta = { id: 'm', afterEvent: 'e-mid', device: 'pc', changes: [{ table: 'tcp-state', op: 'set', entry: { peer: 'srv', to: 'ESTABLISHED' } }] };
ok('B11 afterEvent 不影响终态折叠（仅呈现时机）', tcpStateOf(foldState(frozen, [midStep]), 'pc') === 'ESTABLISHED');

const tcpTwice = foldState(frozen, [
  { id: 't1', device: 'pc', changes: [{ table: 'tcp-state', op: 'set', entry: { peer: 'srv', to: 'SYN_SENT' } }] },
  { id: 't2', device: 'pc', changes: [{ table: 'tcp-state', op: 'set', entry: { peer: 'srv', to: 'ESTABLISHED' } }] },
]);
ok('B12 tcp-state set 按 peer 替换（不追加重复连接）', tbl(tcpTwice, 'pc', 'tcp-state').length === 1);

const noMac = foldState({ pc: { 'arp-cache': [] } }, [{ id: 'u', device: 'pc', changes: [{ table: 'arp-cache', op: 'upsert', entry: { ip: '2.2.2.2', state: 'incomplete' } }] }]);
const noMacEntry = tbl(noMac, 'pc', 'arp-cache')[0];
ok('B13 缺省 mac 不写入 undefined 键', noMacEntry !== undefined && !('mac' in noMacEntry));

const nestedInit: StateSnapshot = { d: { 'dns-cache': [{ name: 'a', ttl: 60 }] } };
const nestedDelta: StateDelta = { id: 'n', device: 'd', changes: [{ table: 'dns-cache', op: 'upsert', entry: { name: 'b', answers: [{ ip: '1.1.1.1' }] } }] };
const nestedOut = foldState(nestedInit, [nestedDelta]);
const nestedEntry = tbl(nestedOut, 'd', 'dns-cache').find((e) => 'name' in e && e.name === 'b');
if (nestedEntry && 'answers' in nestedEntry && Array.isArray(nestedEntry.answers)) {
  (nestedEntry.answers[0] as { ip: string }).ip = 'MUTATED';
}
ok('B14 输出与输入 delta 不共享嵌套对象（clone 保证纯度）', JSON.stringify(nestedDelta).includes('1.1.1.1'));

/* ========================= C. 发布门禁 ========================= */

console.log('\n[C] 发布门禁');

const TODAY = '2026-11-12';
const mkSource = (sourceId: string, licenseStatus: LicenseStatus): Source => ({
  sourceId,
  type: 'rfc',
  name: 'n',
  author: 'a',
  url: 'https://example.org/std',
  licenseStatus,
  addedAt: '2026-01-01',
});
const mkRef = (sourceId: string, over: Partial<KnowledgePoint['sourceRefs'][number]> = {}) => ({
  sourceId,
  purpose: 'p',
  sections: ['1'],
  checkedAt: '2026-01-01',
  ...over,
});
const mkKnowledge = (over: Partial<KnowledgePoint> = {}): KnowledgePoint => ({
  id: 'NET-04-99',
  title: 't',
  categoryId: 'M04',
  level: 'basic',
  summary: 's',
  what: 'w',
  why: 'w',
  principle: 'p',
  practicalScenario: 'ps',
  commonProblems: ['x'],
  relatedKnowledge: [],
  sourceRefs: [],
  demoRefs: [],
  accessLevel: 'free',
  status: 'draft',
  contentState: 'original',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
});
const gate = (k: KnowledgePoint, srcs: Source[] = []) =>
  knowledgePublishGates(k, new Map(srcs.map((s) => [s.sourceId, s] as const)), TODAY);

ok('C1 P7：published 无任何来源 → 拦截', gate(mkKnowledge({ status: 'published' })).some((v) => v.level === 'P7'));
ok('C2 P7：draft 无来源 → 不拦（草稿可无来源）', gate(mkKnowledge({ status: 'draft' })).length === 0);
ok(
  'C3 P7：review 挂 pending 来源 → 不拦（待确认来源只影响能否发布）',
  gate(mkKnowledge({ status: 'review', sourceRefs: [mkRef('s-p')] }), [mkSource('s-p', 'pending')]).length === 0,
);
ok(
  'C4 P2：published × pending 来源 → 拦截',
  gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('s-p')] }), [mkSource('s-p', 'pending')]).some((v) => v.level === 'P2'),
);
ok(
  'C5 P2：published × per-file-review 来源 → 拦截',
  gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('s-r')] }), [mkSource('s-r', 'per-file-review')]).some((v) => v.level === 'P2'),
);
ok(
  'C6 双轨独立：licenseStatus=pending 但 status=draft → 0 违规',
  gate(mkKnowledge({ status: 'draft', sourceRefs: [mkRef('s-p')] }), [mkSource('s-p', 'pending')]).length === 0,
);
ok(
  'C7 双轨独立：published × public-standard × original → 0 违规',
  gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('s-ok')] }), [mkSource('s-ok', 'public-standard')]).length === 0,
);
ok(
  'C8 P1：checkedAt 晚于今天 → 拦截',
  gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('s-ok', { checkedAt: '2027-01-01' })] }), [mkSource('s-ok', 'public-standard')]).some((v) => v.level === 'P1'),
);
ok(
  'C9 P1：sections 空且无 verificationNote → 拦截',
  gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('s-ok', { sections: [], verificationNote: undefined })] }), [mkSource('s-ok', 'public-standard')]).some((v) => v.level === 'P1'),
);
ok(
  'C10 P1：sections 空但已说明理由 → 放行',
  gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('s-ok', { sections: [], verificationNote: '该文档无编号小节' })] }), [mkSource('s-ok', 'public-standard')]).length === 0,
);
ok('C11 P3：third-party → 拦截', gate(mkKnowledge({ status: 'published', contentState: 'third-party', sourceRefs: [mkRef('s-ok')] }), [mkSource('s-ok', 'public-standard')]).some((v) => v.level === 'P3'));
ok(
  'C12 P3：permission-required → 拦截',
  gate(mkKnowledge({ status: 'published', contentState: 'permission-required', sourceRefs: [mkRef('s-ok')] }), [mkSource('s-ok', 'public-standard')]).some((v) => v.level === 'P3'),
);
const p4 = gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('ieee')] }), [mkSource('ieee', 'paid-standard')]);
ok('C13 P4：paid-standard → 待人工核查（非 P2，不阻塞）', p4.some((v) => v.level === 'P4') && !p4.some((v) => v.level === 'P2'));
ok(
  'C14 P2 覆盖全部 sourceRefs：两条来源中一条 pending → 拦截',
  gate(mkKnowledge({ status: 'published', sourceRefs: [mkRef('s-ok'), mkRef('s-p')] }), [mkSource('s-ok', 'public-standard'), mkSource('s-p', 'pending')]).some((v) => v.level === 'P2'),
);
ok(
  'C15 P5：demo 被 review 知识点引用 → 拦截',
  demoPublishGates('demo-1', [mkKnowledge({ id: 'NET-04-01', status: 'review', demoRefs: ['demo-1'] })]).some((v) => v.level === 'P5'),
);
ok('C16 P5：关联知识点全部 published → 放行', demoPublishGates('demo-1', [mkKnowledge({ id: 'NET-04-01', status: 'published', demoRefs: ['demo-1'] })]).length === 0);
ok(
  'C17 P6：来源失效联动命中',
  demoteOnSourceRetired([mkKnowledge({ status: 'published', sourceRefs: [mkRef('old')] })], 'old', 'per-file-review').length === 1,
);
ok('C18 P6：非 blocking 授权变更不触发联动', demoteOnSourceRetired([mkKnowledge({ status: 'published', sourceRefs: [mkRef('old')] })], 'old', 'public-standard').length === 0);

/* ========================= D. L1 结构（N2/N5） ========================= */

console.log('\n[D] L1 结构校验（N2/N5）');

const demoWith = (initialState: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'd',
  title: 't',
  protocol: 'tcp',
  topology: { layout: { view: 'network' }, participants: [{ id: 'pc', label: 'PC', role: 'host', kind: 'laptop' }], domains: [{ id: 'lan', label: 'LAN', members: ['pc'] }], links: [{ from: 'pc', to: 'pc' }] },
  scenarios: [
    {
      id: 's',
      label: 'l',
      initialState,
      steps: [{ id: 'st', title: 't', description: 'd', events: [{ id: 'e', kind: 'process', from: 'pc', to: { kind: 'device', id: 'pc' }, dependsOn: [] }], stateDeltas: [] }],
    },
  ],
  ...extra,
});
const parseDemo = (v: unknown) => DemoSchema.safeParse(v);

ok('D1 合法 initialState（四种保留表 + 通用表）通过', parseDemo(demoWith({ pc: { 'arp-cache': [{ ip: '1.1.1.1', mac: 'AA', state: 'reachable' }], 'tcp-state': [{ peer: 'srv', to: 'CLOSED' }], 'ospf-neighbor': [{ peer: 'r', to: 'Full' }], 'dns-cache': [{ name: 'a', ttl: 30 }] } })).success);
ok('D2 非法 ARP state → 拒绝', !parseDemo(demoWith({ pc: { 'arp-cache': [{ ip: '1.1.1.1', state: 'NOT-A-STATE' }] } })).success);
ok('D3 ARP 缺 state 字段 → 拒绝', !parseDemo(demoWith({ pc: { 'arp-cache': [{ ip: '1.1.1.1' }] } })).success);
ok('D4 非法 TCP state → 拒绝', !parseDemo(demoWith({ pc: { 'tcp-state': [{ peer: 'srv', to: 'ESTABLISHEDD' }] } })).success);
ok('D5 非法 OSPF state → 拒绝', !parseDemo(demoWith({ pc: { 'ospf-neighbor': [{ peer: 'r', to: 'TwoWay' }] } })).success);
ok('D6 保留表条目带未知字段 → 拒绝（strict）', !parseDemo(demoWith({ pc: { 'arp-cache': [{ ip: '1.1.1.1', state: 'stale', extra: 1 }] } })).success);
ok('D7 白名单外通用表 → 拒绝', !parseDemo(demoWith({ pc: { 'session-table': [{ id: 'x' }] } })).success);
ok('D8 通用表条目允许嵌套 FieldValue（合法扩展）', parseDemo(demoWith({ pc: { 'dns-cache': [{ name: 'a', answers: [{ ip: '1.1.1.1', ttl: 30 }] }] } })).success);
ok('D9 StateDelta 保留表非法状态 → 拒绝', !StateChangeSchema.safeParse({ table: 'arp-cache', op: 'upsert', entry: { ip: '1.1.1.1', state: 'BAD' } }).success);
ok('D10 StateDelta 白名单外通用表 → 拒绝', !StateChangeSchema.safeParse({ table: 'session-table', op: 'upsert', entry: { id: 'x' } }).success);
ok('D11 StateDelta 白名单内通用表 → 通过', StateChangeSchema.safeParse({ table: 'routing-table', op: 'set', entry: { dest: '0.0.0.0/0' } }).success);
ok('D12 Device 未知字段 → 拒绝（strict 策略）', !parseDemo(demoWith({}, { topology: { layout: { view: 'network' }, participants: [{ id: 'pc', label: 'PC', role: 'host', kind: 'laptop', extraKey: 1 }], domains: [], links: [] } })).success);
ok('D13 Packet.fields 开放容器允许任意键（合法扩展不被破坏）', parseDemo(demoWith({}, { scenarios: [{ id: 's', label: 'l', initialState: {}, steps: [{ id: 'st', title: 't', description: 'd', events: [{ id: 'e', kind: 'unicast', from: 'pc', to: { kind: 'device', id: 'pc' }, dependsOn: [], payload: { proto: 'TCP', summary: 'x', fields: { anyKey: 'v', nested: { a: [1, 2] } } } }], stateDeltas: [] }] }] })).success);
ok('D14 TraceRow 未知字段 → 拒绝', !TraceRowSchema.safeParse({ time: '0.000', src: 'a', dst: 'b', proto: 'TCP', info: 'x', bogus: 1 }).success);

/* ========================= E. 多播（N1） ========================= */

console.log('\n[E] 多播 roleFilter（N1）');

const participants: Device[] = [
  { id: 'r1', label: 'R1', role: 'router', kind: 'router' },
  { id: 'r2', label: 'R2', role: 'router', kind: 'router' },
  { id: 'pc1', label: 'PC1', role: 'host', kind: 'laptop' },
  { id: 'ap1', label: 'AP1', role: 'ap', kind: 'ap' },
];
const byId = new Map(participants.map((d) => [d.id, d] as const));
const domain: BroadcastDomain = { id: 'lan', label: 'LAN', members: ['r1', 'r2', 'pc1', 'ap1'] };
const domains = new Map([[domain.id, domain] as const]);

ok('E1 角色过滤：router → [r2]（排除发送方 r1）', JSON.stringify(multicastRecipients(domain, byId, ['router'], 'r1')) === '["r2"]');
ok('E2 多角色过滤：router+host → [r2, pc1]', JSON.stringify(multicastRecipients(domain, byId, ['router', 'host'], 'r1')) === '["r2","pc1"]');
ok('E3 无匹配角色 → 空数组', multicastRecipients(domain, byId, ['resolver'], 'r1').length === 0);
ok('E4 唯一匹配者是发送方 → 空数组（不自我投递）', multicastRecipients({ members: ['r1'] }, byId, ['router'], 'r1').length === 0);

const multicastEvent: DemoEvent = { id: 'e1', kind: 'multicast', from: 'r1', to: { kind: 'multicast', domain: 'lan', roleFilter: ['router'] }, payload: { proto: 'OSPF', summary: 'Hello' }, dependsOn: [] };
const okFindings = validateEventShape(multicastEvent, 'st', 'demo', 'file', byId, domains);
ok('E5 正向：合法多播事件 0 诊断', okFindings.length === 0, JSON.stringify(okFindings));

const emptyEvent: DemoEvent = { ...multicastEvent, id: 'e2', to: { kind: 'multicast', domain: 'lan', roleFilter: ['resolver', 'server'] } };
const emptyFindings = validateEventShape(emptyEvent, 'st', 'demo', 'file', byId, domains);
ok(
  'E6 反向：无匹配设备 → ERROR（接收者为空）',
  emptyFindings.some((f) => f.severity === 'ERROR' && f.rule === 'X6' && f.msg.includes('多播接收者为空')),
  JSON.stringify(emptyFindings),
);
ok('E7 诊断包含角色与域信息（可定位）', emptyFindings.some((f) => f.msg.includes('resolver') && f.msg.includes('lan')));

const partialEvent: DemoEvent = { ...multicastEvent, id: 'e3', to: { kind: 'multicast', domain: 'lan', roleFilter: ['router', 'server'] } };
const partialFindings = validateEventShape(partialEvent, 'st', 'demo', 'file', byId, domains);
ok(
  'E8 部分角色无匹配 → 仅 WARN，不阻断（router 可投递）',
  partialFindings.some((f) => f.severity === 'WARN' && f.msg.includes('server')) && !partialFindings.some((f) => f.severity === 'ERROR'),
  JSON.stringify(partialFindings),
);

const mismatch1: DemoEvent = { ...multicastEvent, id: 'e4', kind: 'broadcast' };
const mismatch2: DemoEvent = { ...multicastEvent, id: 'e5', to: { kind: 'broadcast', domain: 'lan' } };
ok(
  'E9 broadcast kind × multicast 目标 → L1-shape ERROR',
  validateEventShape(mismatch1, 'st', 'demo', 'file', byId, domains).some((f) => f.rule === 'L1-shape'),
);
ok(
  'E10 multicast kind × broadcast 目标 → L1-shape ERROR',
  validateEventShape(mismatch2, 'st', 'demo', 'file', byId, domains).some((f) => f.rule === 'L1-shape'),
);

const ghostDomainEvent: DemoEvent = { ...multicastEvent, id: 'e6', to: { kind: 'multicast', domain: 'nope', roleFilter: ['router'] } };
ok(
  'E11 域不存在 → X6 ERROR（不因角色逻辑短路）',
  validateEventShape(ghostDomainEvent, 'st', 'demo', 'file', byId, domains).some((f) => f.rule === 'X6' && f.msg.includes('不在 topology.domains')),
);

/* ========================= 汇总 ========================= */

console.log(`\n结果: ${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);

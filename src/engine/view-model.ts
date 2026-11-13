/**
 * NetLab Explorer — 构建期视图适配层（M2-A）
 * 对应 docs/m2a-implementation-plan.md §5。
 *
 * 职责：把**新数据模型**（Demo / KnowledgePoint / Source / Catalog）投影成
 * **现有播放器的兼容契约**（旧 `LESSONS[i]` 形状：七元组 + net.main + alternate）。
 *
 * 三条硬约定：
 * 1. 只在本文件做字段级映射。`app.js` 不得再出现任何「模型字段 → 视图字段」的翻译；
 *    旧七元组在这里被收敛成**渲染契约**，不是数据格式。
 * 2. 纯函数：不读 fs / DOM / 时间 / 随机；同一输入必得同一输出。状态一律
 *    `foldState` 折叠得到（复用引擎，不重写一份），构建期调用，浏览器不重算。
 * 3. 不变式（I1–I9）违反即 `throw`，让 `build-data` 以退出码 1 失败——宁可构建红，
 *    也不产出"能跑但错"的视图数据。
 */
import { foldState } from './fold-state.ts';
import type { Catalog, CatalogGroup, CourseEntry } from '../types/catalog.ts';
import type { Demo, DemoEvent, DemoScenario, Device, PacketCat, StateEntry, StateSnapshot, Step, TraceRow } from '../types/demo.ts';
import type { KnowledgePoint } from '../types/knowledge.ts';
import type { Source, SourceType } from '../types/source.ts';

/* ---------- 视图契约（播放器消费的形状） ---------- */

/** 七元组：`[标题, 起点槽位, 终点槽位, 信号行, 场景字幕, 状态观察, 关系类型]`。 */
export type RelationKind = 'request' | 'data' | 'control' | 'check' | 'reject' | 'lost' | 'local' | 'compare';

export type Frame7 = [string, number, number, string, string, string, RelationKind];

/** 数据包流表格行（沿用旧 `net.main[i]` 的字段名，含展示格式）。 */
export interface TraceRowView {
  /** 相对时间（原字符串，UI 追加 's'） */
  t: string;
  src: string;
  dst: string;
  proto: string;
  info: string;
  /** 已格式化，如 '66 B' */
  size: string;
  cat?: PacketCat;
}

/** 一个场景的视图（主流程 = lesson 自身字段；备用流程 = lesson.alternate）。 */
export interface ScenarioView {
  name: string;
  nodes: string[];
  steps: Frame7[];
}

export interface LessonView {
  /** 视图 id = catalog.hash（深链、进度键、MECHANISM_DETAILS 的键） */
  id: string;
  /** 数据主键（Demo.id），供调试与追溯 */
  demoId: string;
  /** 分组序号（对应 GROUPS 下标） */
  group: number;
  title: string;
  /** 英文副标题（导航第二行） */
  en: string;
  summary: string;
  scene: string;
  nodes: string[];
  addresses: string[];
  /** 逐步详解（14 条） */
  stepNotes: string[];
  net: { main: (TraceRowView | null)[]; alternate: (TraceRowView | null)[] };
  steps: Frame7[];
  principle: string;
  tradeoff: string;
  pitfall: string;
  /** 来源台账 id（sourceId） */
  sources: string[];
  /** 关联知识点 id（单篇时为空数组） */
  related: string[];
  /** 备用场景；数据没有第二个场景时缺省（UI 隐藏场景按钮） */
  alternate?: ScenarioView;
}

export interface GroupView {
  name: string;
  en: string;
  color: string;
  dark?: string;
  question: string;
}

/** 来源卡片（旧 `sourceById` 的条目形状）：note 缺省为空串表示不渲染说明行。 */
export interface SourceCard {
  name: string;
  url: string;
  note: string;
  kind: string;
}

export interface SiteData {
  groups: GroupView[];
  lessons: LessonView[];
  sources: Record<string, SourceCard>;
}

/* ---------- 关系映射（G2） ---------- */

/**
 * 事件 → 七元组关系类型。按顺序命中（docs/m2a-implementation-plan.md §5.2）：
 * drop → lost；process → local；数据类 → data；握手按**发起方**区分请求与响应；
 * **FIN 一律 request**（见下）。
 *
 * FIN 为什么是 request 而不是 data / control：
 * - FIN 是控制标志、不携带应用数据（Len=0），报文表里只是一个 60–66 B 的空段；
 * - 它的语义是「我这侧不再发送，请对端收尾」的**关闭请求**（半关闭），四次挥手是两个
 *   方向各一次的关闭请求，因此两个方向都应标 request，不能按"谁先发起整个场景"分；
 * - `control`（控制关系）在 renderer 里是**无运动的逻辑关系**（isokit-scene.jsx: `transfer`
 *   只认 request/data，control 走 logical 虚线且无 TravelDot），用在真实报文上会让 FIN
 *   段静止不动，与报文表和动画矛盾，故不可用；
 * - 不新增枚举（`check / reject / compare` 亦与 FIN 无关）。
 *
 * 注意 `payload.cat` 是**表格配色分组**，不是标志位：备用场景的 ACK（`ACK u+1`）也归在
 * `fin` 组里。因此关闭阶段必须再看信号行里的 FIN 标志，否则会把 ACK 误标成关闭请求。
 * 这是模型暂无 `flags` 字段的临时判据（M2-C 补字段后应改为读标志位）。
 *
 * `control / check / reject / compare` 本期无数据、无消费方，保留枚举不猜。
 */
export function relationOf(ev: DemoEvent, initiatorId: string): RelationKind {
  if (ev.kind === 'drop') return 'lost';
  if (ev.kind === 'process') return 'local';
  const cat = ev.payload?.cat;
  if (cat === 'cdata' || cat === 'sdata') return 'data';
  if (cat === 'fin') return /\bFIN\b/i.test(ev.payload?.summary ?? '') ? 'request' : 'data';
  if (cat === 'hand') return ev.from === initiatorId ? 'request' : 'data';
  // query / response / broadcast / generic / 无 payload（M2-B/C 再细分）
  return 'data';
}

/* ---------- 状态文案派生（G1，D-B） ---------- */

/** 折叠后某设备可读的一条状态文本（按表优先序）；无状态可读时返回 null。 */
function stateTextOf(tables: Record<string, StateEntry[]> | undefined): string | null {
  if (!tables) return null;
  const tcp = tables['tcp-state'];
  if (tcp && tcp.length > 0) {
    const e = tcp[0] as { to?: unknown };
    if (typeof e.to === 'string') return e.to;
  }
  const ospf = tables['ospf-neighbor'];
  if (ospf && ospf.length > 0) {
    const e = ospf[0] as { to?: unknown };
    if (typeof e.to === 'string') return e.to;
  }
  const arp = tables['arp-cache'];
  if (arp && arp.length > 0) {
    const e = arp[0] as { state?: unknown };
    if (typeof e.state === 'string') return e.state;
  }
  // mac-table：无「状态」可读，跳过（不能把端口名当状态）
  return null;
}

/** 本步 delta 覆盖的设备（= 本步观察点），按 participants 顺序去重。 */
function observedDevices(step: Step, snapshot: StateSnapshot, participants: Device[]): string[] {
  const observed = new Set<string>();
  for (const delta of step.stateDeltas) {
    if (delta.device !== undefined) {
      observed.add(delta.device);
      continue;
    }
    // 全局 delta：作用于所有持有该表的设备（与 foldState 的 targets 语义一致）
    for (const change of delta.changes) {
      for (const dev of participants) {
        if (snapshot[dev.id]?.[change.table] !== undefined) observed.add(dev.id);
      }
    }
  }
  return participants.filter((d) => observed.has(d.id)).map((d) => d.id);
}

/**
 * 状态观察文案：`fold(initialState, deltas[0..i])` 后读取**本步观察点**的状态。
 * 约定（写入 docs/demo-event-model.md）：
 * - 观察点 = 本步 delta 覆盖的设备；文案取自折叠后的快照，不取 delta 里的 `to`；
 * - 全部观察点同状态 → `双向 <状态>`；否则 `<短名> <状态>` 以 ` · ` 连接；
 * - 无状态可读 → 用 `events[0].note` 兜底；有状态且 note 存在 → `<clause> · <note>`。
 */
export function stateLabelAt(scenario: DemoScenario, stepIndex: number, devices: Device[]): string {
  const step = scenario.steps[stepIndex];
  if (!step) throw new Error(`stateLabelAt: 场景 ${scenario.id} 不存在第 ${stepIndex} 步`);
  const deltas = scenario.steps.slice(0, stepIndex + 1).flatMap((s) => s.stateDeltas);

  // I7：fold 是纯函数——折叠前后输入必须逐字段一致（输入被改写即构建失败）
  const before = JSON.stringify([scenario.initialState, deltas]);
  const snapshot = foldState(scenario.initialState, deltas);
  const after = JSON.stringify([scenario.initialState, deltas]);
  if (before !== after) throw new Error(`I7: foldState 修改了输入（场景 ${scenario.id} 步骤 ${step.id}）`);

  const byId = new Map(devices.map((d) => [d.id, d] as const));
  const observed = observedDevices(step, snapshot, devices);
  const parts: { short: string; state: string }[] = [];
  for (const id of observed) {
    const device = byId.get(id);
    const state = stateTextOf(snapshot[id]);
    if (!device || state === null) continue;
    parts.push({ short: device.stateLabel ?? device.label, state });
  }

  let clause = '';
  if (parts.length >= 2 && parts.every((p) => p.state === parts[0]?.state)) {
    clause = `双向 ${parts[0]?.state ?? ''}`;
  } else if (parts.length > 0) {
    clause = parts.map((p) => `${p.short} ${p.state}`).join(' · ');
  }

  const note = step.events[0]?.note?.trim() ?? '';
  const label = clause && note ? `${clause} · ${note}` : clause || note;
  if (!label) {
    throw new Error(`I6: 场景 ${scenario.id} 步骤 ${step.id} 既没有可读状态也没有 note（数据缺观察点）`);
  }
  return label;
}

/* ---------- 帧与表格行 ---------- */

function slotResolver(participants: Device[], demoId: string): (id: string) => number {
  const slots = new Map(participants.map((d, i) => [d.id, i] as const));
  return (id: string): number => {
    const slot = slots.get(id);
    if (slot === undefined) throw new Error(`演示 ${demoId}: 设备 ${id} 不在 participants 中`);
    return slot;
  };
}

function targetSlot(ev: DemoEvent, slotOf: (id: string) => number): number {
  if (ev.to.kind === 'device') return slotOf(ev.to.id);
  // M2-A 只有单播/本机事件；广播扇出（ARP）与多播留给 M2-B 的适配层扩展。
  throw new Error(`M2-A 适配层暂不支持 ${ev.to.kind} 目标（事件 ${ev.id}）`);
}

export interface FrameContext {
  slotOf: (id: string) => number;
  initiatorId: string;
  devices: Device[];
  scenario: DemoScenario;
  stepIndex: number;
}

/** `Step` → 七元组（渲染契约）。缺省语义见 docs/m2a-implementation-plan.md §4.3 / §4.10。 */
export function toFrame(step: Step, ctx: FrameContext): Frame7 {
  const ev = step.events[0];
  if (!ev) throw new Error(`步骤 ${step.id} 没有事件（events 至少 1 条）`);
  const from = ctx.slotOf(ev.from);
  const to = targetSlot(ev, ctx.slotOf);
  const kind = relationOf(ev, ctx.initiatorId);

  const signal = step.signal ?? ev.payload?.summary ?? '';
  if (!signal) throw new Error(`I5: 步骤 ${step.id} 既无 Step.signal 也无 payload.summary（信号行为空）`);
  const caption = step.caption ?? step.description;
  if (!caption) throw new Error(`I5: 步骤 ${step.id} 场景字幕为空`);
  if (!step.title.trim()) throw new Error(`I5: 步骤 ${step.id} 标题为空`);

  // I4：槽位必须落在 participants 范围内；内部操作（local）不得伪造传递
  const n = ctx.devices.length;
  if (![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < n)) {
    throw new Error(`I4: 步骤 ${step.id} 槽位越界（from=${from}, to=${to}, 设备数=${n}）`);
  }
  if ((from === to) !== (kind === 'local')) {
    throw new Error(`I4: 步骤 ${step.id} 的 from/to 与关系类型不自洽（from=${from}, to=${to}, kind=${kind}）`);
  }

  return [step.title, from, to, signal, caption, stateLabelAt(ctx.scenario, ctx.stepIndex, ctx.devices), kind];
}

/** `TraceRow` → 表格行视图；`null`/缺省 = 本步无报文行（I1 用 null 占位，不缩短数组）。 */
export function toTraceRow(row: TraceRow | null | undefined): TraceRowView | null {
  if (!row) return null;
  return {
    t: row.time,
    src: row.src,
    dst: row.dst,
    proto: row.proto,
    info: row.info,
    size: row.size === undefined ? '' : `${row.size} B`,
    ...(row.cat === undefined ? {} : { cat: row.cat }),
  };
}

/**
 * 解析一步的表格行并复核绑定关系（I2/I3）：
 * - 有 `eventRef`：必须指向**本步**事件（不按数组下标猜）；
 * - 无 `eventRef`：本步恰好一个事件时绑定它，否则报错（不允许"猜第几行"）；
 * - `cat` 必须与事件的 payload.cat 一致，`lost` 必须与 kind==='drop' 一致。
 */
function resolveTraceRow(step: Step, demoId: string): TraceRow | null {
  const row = step.traceRow;
  if (!row) return null;
  const events = step.events;
  const ev = row.eventRef !== undefined ? events.find((e) => e.id === row.eventRef) : events.length === 1 ? events[0] : undefined;
  if (!ev) {
    throw new Error(
      `I2: 演示 ${demoId} 步骤 ${step.id} 的 traceRow 无法绑定到本步事件` +
        (row.eventRef !== undefined ? `（eventRef=${row.eventRef}）` : `（本步有 ${events.length} 个事件且未写 eventRef）`),
    );
  }
  if (row.cat !== undefined && ev.payload?.cat !== undefined && row.cat !== ev.payload.cat) {
    throw new Error(`I3: 演示 ${demoId} 步骤 ${step.id} 的 traceRow.cat(${row.cat}) ≠ 事件 ${ev.id} 的 payload.cat(${ev.payload.cat})`);
  }
  if (Boolean(row.lost) !== (ev.kind === 'drop')) {
    throw new Error(`I3: 演示 ${demoId} 步骤 ${step.id} 的 traceRow.lost(${Boolean(row.lost)}) 与事件 kind(${ev.kind}) 不一致`);
  }
  return row;
}

/* ---------- 课程视图 ---------- */

function addressText(address: Device['address']): string {
  if (!address?.ip) return '';
  return address.port === undefined ? address.ip : `${address.ip}:${address.port}`;
}

/** 场景 → 帧序列（主流程与备用流程共用）。 */
function scenarioFrames(scenario: DemoScenario, slotOf: (id: string) => number, devices: Device[]): Frame7[] {
  const initiatorId = scenario.steps[0]?.events[0]?.from;
  if (!initiatorId) throw new Error(`演示场景 ${scenario.id} 第一步没有事件，无法确定发起方`);
  return scenario.steps.map((step, stepIndex) =>
    toFrame(step, { slotOf, initiatorId, devices, scenario, stepIndex }),
  );
}

function scenarioRows(scenario: DemoScenario, demoId: string): (TraceRowView | null)[] {
  return scenario.steps.map((step) => toTraceRow(resolveTraceRow(step, demoId)));
}

/** 组装一门课的视图。字段来源见 docs/m2a-implementation-plan.md §4.2。 */
export function buildLesson(demo: Demo, kp: KnowledgePoint, sources: Source[], entry: CourseEntry, groupIndex: number): LessonView {
  void sources; // 来源卡片由 buildSite 统一投影；此处只登记 sourceRefs 的 id
  const participants = demo.topology.participants;
  const devices = participants;
  const slotOf = slotResolver(participants, demo.id);
  const main = demo.scenarios[0];
  if (!main) throw new Error(`演示 ${demo.id} 至少需要一个场景`);
  const alt = demo.scenarios[1];

  const steps = scenarioFrames(main, slotOf, devices);
  const netMain = scenarioRows(main, demo.id);
  // I1：表格行与步骤等长（缺行用 null 占位，不允许短少）
  if (netMain.length !== steps.length) {
    throw new Error(`I1: 演示 ${demo.id} 主流程表格行 ${netMain.length} 行 ≠ ${steps.length} 步`);
  }

  const alternate: ScenarioView | undefined = alt
    ? { name: alt.label, nodes: participants.map((d) => d.label), steps: scenarioFrames(alt, slotOf, devices) }
    : undefined;
  const netAlternate = alt ? scenarioRows(alt, demo.id) : [];
  if (alt && netAlternate.length !== alt.steps.length) {
    throw new Error(`I1: 演示 ${demo.id} 备用流程表格行 ${netAlternate.length} 行 ≠ ${alt.steps.length} 步`);
  }

  return {
    id: entry.hash,
    demoId: demo.id,
    group: groupIndex,
    title: demo.title,
    en: entry.titleEn,
    summary: kp.summary,
    scene: demo.view?.kind ?? demo.topology.layout.view,
    nodes: participants.map((d) => d.label),
    addresses: participants.map((d) => addressText(d.address)),
    stepNotes: main.steps.map((s) => s.description),
    net: { main: netMain, alternate: netAlternate },
    steps,
    principle: kp.principle,
    tradeoff: kp.why,
    pitfall: kp.commonProblems[0] ?? '',
    sources: [...new Set(kp.sourceRefs.map((r) => r.sourceId))],
    related: [...kp.relatedKnowledge],
    ...(alternate === undefined ? {} : { alternate }),
  };
}

/** 来源类型 → 卡片小标签（纯展示，属适配层，不动模型）。 */
const SOURCE_KIND: Readonly<Record<SourceType, string>> = {
  rfc: '具体机制资料',
  textbook: '课程背景',
  ieee: '标准文献',
  vendor: '厂商文档',
  lab: '实验材料',
  tool: '工具资料',
};

export function toSourceCard(src: Source): SourceCard {
  return { name: src.name, url: src.url, note: src.description ?? '', kind: SOURCE_KIND[src.type] };
}

function groupView(g: CatalogGroup): GroupView {
  return { name: g.name, en: g.en, color: g.color, ...(g.dark === undefined ? {} : { dark: g.dark }), question: g.question };
}

/**
 * 站点视图：目录 + 演示 + 知识点 + 来源 → `{ groups, lessons, sources }`。
 * I9：catalog / knowledge 的跨文件引用必须全部可解析（与校验器双保险；
 * 因 §3.3 冻结 `validate-content.mts`，目录引用在构建期而非 X2 里复核）。
 */
export function buildSite(input: { demos: Demo[]; knowledge: KnowledgePoint[]; sources: Source[]; catalog: Catalog }): SiteData {
  const { demos, knowledge, sources, catalog } = input;
  const demoById = new Map(demos.map((d) => [d.id, d] as const));
  const kpById = new Map(knowledge.map((k) => [k.id, k] as const));
  const sourceIds = new Set(sources.map((s) => s.sourceId));
  const groupIndex = new Map(catalog.groups.map((g, i) => [g.id, i] as const));

  for (const d of demos) {
    if (!d.id) throw new Error('I9: 演示缺少 id');
  }
  for (const k of knowledge) {
    for (const demoId of k.demoRefs) {
      if (!demoById.has(demoId)) throw new Error(`I9: 知识点 ${k.id} 的 demoRefs 引用不存在的演示 ${demoId}`);
    }
    for (const ref of k.sourceRefs) {
      if (!sourceIds.has(ref.sourceId)) throw new Error(`I9: 知识点 ${k.id} 引用了不存在的来源 ${ref.sourceId}`);
    }
  }

  const lessons = [...catalog.courses]
    .sort((a, b) => {
      const ga = groupIndex.get(a.groupId) ?? 0;
      const gb = groupIndex.get(b.groupId) ?? 0;
      return ga === gb ? a.order - b.order : ga - gb;
    })
    .map((entry) => {
      const demo = demoById.get(entry.demoId);
      if (!demo) throw new Error(`I9: 目录课程 ${entry.hash} 指向不存在的演示 ${entry.demoId}`);
      const kp = kpById.get(entry.knowledgeId);
      if (!kp) throw new Error(`I9: 目录课程 ${entry.hash} 指向不存在的知识点 ${entry.knowledgeId}`);
      const gi = groupIndex.get(entry.groupId);
      if (gi === undefined) throw new Error(`I9: 目录课程 ${entry.hash} 指向不存在的分组 ${entry.groupId}`);
      return buildLesson(demo, kp, sources, entry, gi);
    });

  const sourceCards: Record<string, SourceCard> = {};
  for (const src of sources) sourceCards[src.sourceId] = toSourceCard(src);

  return { groups: catalog.groups.map(groupView), lessons, sources: sourceCards };
}

#!/usr/bin/env node
/**
 * NetLab Explorer — 内容校验器（M1 落地）
 * 分层（docs/validation-rules.md §1）：
 *   L1 结构校验   —— Zod schema（src/schemas/*），单文件字段/枚举/形状
 *   L2 跨引用校验 —— 本脚本 X1–X14（跨文件/跨对象，Zod 不查图）
 *   L3 发布门禁   —— 本脚本 P1–P7（仅当 status = published）
 *
 * 校验对象：
 *   1. 夹具样例 docs/sample-demos/*.json（始终校验，作为回归基准）
 *   2. 落地数据 content/demos/*.json、content/sources.json、content/knowledge/*.json（存在即校验）
 *
 * 运行：node scripts/validate-content.mts（零参数即全量；退出码非 0 表示有 ERROR）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DemoSchema } from '../src/schemas/demo.schema.ts';
import { KnowledgePointSchema } from '../src/schemas/knowledge.schema.ts';
import { SourceSchema } from '../src/schemas/source.schema.ts';
import { checkWavePurity, computeWaves } from '../src/engine/waves.ts';
import { deepFreeze, foldState, snapshotsEqual } from '../src/engine/fold-state.ts';
import { KNOWN_GENERIC_TABLES, RESERVED_STATE_TABLES } from '../src/schemas/demo.schema.ts';
import type { ContentState, KnowledgePoint } from '../src/types/knowledge.ts';
import type { Source } from '../src/types/source.ts';
import type { BroadcastDomain, Demo, DemoEvent, DemoScenario, Device, DeviceRole, StateDelta, Topology } from '../src/types/demo.ts';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIXTURE_DIR = path.join(ROOT, 'docs', 'sample-demos');
const CONTENT_DIR = path.join(ROOT, 'content');

type Severity = 'ERROR' | 'WARN' | 'INFO';
interface Finding { file: string; rule: string; msg: string; severity: Severity }
const findings: Finding[] = [];
const err = (file: string, rule: string, msg: string) => findings.push({ file, rule, msg, severity: 'ERROR' });
const warn = (file: string, rule: string, msg: string) => findings.push({ file, rule, msg, severity: 'WARN' });
const info = (file: string, rule: string, msg: string) => findings.push({ file, rule, msg, severity: 'INFO' });

/** 顶层文档注释字段（$ 开头或 - 结尾）仅样例说明用，落地数据禁止——剥离并提示。 */
function stripDocAnnotations(obj: Record<string, unknown>, file: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$') || /-$/.test(k)) {
      info(file, 'L1-doc-key', `样例注释字段 "${k}" 已忽略（落地数据不得携带文档用途字段，validation-rules.md §2）`);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** L1：Zod 结构校验，返回解析结果或 null（已报 ERROR）。 */
function l1Parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number | symbol)[]; message: string }[] } } }, raw: unknown, file: string, label: string): T | null {
  const r = schema.safeParse(raw);
  if (r.success) return r.data ?? null;
  for (const issue of r.error?.issues ?? []) {
    const p = issue.path.length ? issue.path.map(String).join('.') : '(root)';
    err(file, 'L1', `${label} 结构不合法 @ ${p}: ${issue.message}`);
  }
  return null;
}

/* ================= Demo 的 L2 跨引用校验 ================= */

function validateDemoScenarios(demo: Demo, file: string): void {
  const topo: Topology = demo.topology;
  const deviceIds = new Set(topo.participants.map((d) => d.id));
  const participantsById = new Map(topo.participants.map((d) => [d.id, d] as const));
  const domainIds = new Set(topo.domains.map((d) => d.id));
  const domainById = new Map(topo.domains.map((d) => [d.id, d] as const));

  // 设备 id 唯一
  if (deviceIds.size !== topo.participants.length) {
    err(file, 'X12', 'topology.participants 存在重复设备 id');
  }
  // 广播域 id 唯一；成员必须是已登记设备
  if (domainIds.size !== topo.domains.length) err(file, 'X12', 'topology.domains 存在重复域 id');
  for (const d of topo.domains) {
    for (const m of d.members) {
      if (!deviceIds.has(m)) err(file, 'X6', `广播域 ${d.id} 成员 ${m} 不在 participants 中`);
    }
    if (new Set(d.members).size !== d.members.length) err(file, 'X12', `广播域 ${d.id} 成员重复`);
  }
  // X7：域成员必须与域内至少一台设备有链路（防幽灵成员）
  for (const d of topo.domains) {
    const mset = new Set(d.members);
    for (const m of d.members) {
      const linked = topo.links.some((l) => (l.from === m && mset.has(l.to)) || (l.to === m && mset.has(l.from)));
      if (!linked) err(file, 'X7', `设备 ${m} 属于广播域 ${d.id} 但与域内任何设备都没有链路`);
    }
    // 链路端点必须存在
  }
  for (const l of topo.links) {
    if (!deviceIds.has(l.from)) err(file, 'X6', `链路端点 ${l.from} 不在 participants 中`);
    if (!deviceIds.has(l.to)) err(file, 'X6', `链路端点 ${l.to} 不在 participants 中`);
  }

  const allDemoEventIds = new Set<string>();

  for (const scenario of demo.scenarios) {
    const sLabel = `${file} · 场景 ${scenario.id}`;
    // X10：initialState 键必须是 participant id
    for (const dev of Object.keys(scenario.initialState)) {
      if (!deviceIds.has(dev)) err(file, 'X10', `${sLabel}: initialState 键 ${dev} 不是 participant`);
      for (const table of Object.keys(scenario.initialState[dev] ?? {})) {
        // X8：initialState 表名白名单
        if (!(RESERVED_STATE_TABLES as readonly string[]).includes(table) && !(KNOWN_GENERIC_TABLES as readonly string[]).includes(table)) {
          err(file, 'X8', `${sLabel}: initialState 表 "${table}" 不在白名单（${[...RESERVED_STATE_TABLES, ...KNOWN_GENERIC_TABLES].join(', ')}），需先扩 schema`);
        }
      }
    }

    // 事件 id 场景级唯一
    const scenEventIds = new Set<string>();
    for (const step of scenario.steps) {
      for (const ev of step.events) {
        if (scenEventIds.has(ev.id)) err(file, 'X12', `${sLabel}: 事件 id "${ev.id}" 在场景内重复`);
        scenEventIds.add(ev.id);
      }
    }
    for (const id of scenEventIds) allDemoEventIds.add(id);

    // 事件 id → 步骤序（用于先后性检查）
    const idStep = new Map<string, number>();
    scenario.steps.forEach((step, si) => {
      for (const ev of step.events) idStep.set(ev.id, si);
    });

    // X10：lost 行必须有对应 drop 事件
    const hasDrop = scenario.steps.some((s) => s.events.some((e) => e.kind === 'drop'));

    // 依赖图整体无环（跨步骤）由逐步 computeWaves + 场景级检查覆盖
    const earlierIds = new Set<string>();
    scenario.steps.forEach((step, si) => {
      // X4：dependsOn 存在性与先后性
      for (const ev of step.events) {
        for (const dep of ev.dependsOn) {
          const target = idStep.get(dep);
          if (target === undefined) {
            err(file, 'X4', `${sLabel} 步骤 ${step.id}: 事件 ${ev.id} 依赖的 ${dep} 不存在于本场景`);
          } else if (target > si) {
            err(file, 'X4', `${sLabel} 步骤 ${step.id}: 事件 ${ev.id} 依赖指向更晚步骤的事件 ${dep}`);
          }
        }
        // X5：afterEvent 存在性与先后性
      }
      for (const delta of step.stateDeltas) {
        if (delta.afterEvent !== undefined) {
          const target = idStep.get(delta.afterEvent);
          if (target === undefined) {
            err(file, 'X5', `${sLabel} 步骤 ${step.id}: stateDelta ${delta.id} 的 afterEvent ${delta.afterEvent} 不存在于本场景`);
          } else if (target > si) {
            err(file, 'X5', `${sLabel} 步骤 ${step.id}: stateDelta ${delta.id} 的 afterEvent 指向更晚步骤`);
          }
        }
      }

      // 每步：事件 kind 形状约束 + X6 设备/域引用 + X9 traceRow + X8 通用表 + X13 波次纯度
      let waves: Map<string, number> | null = null;
      try {
        waves = computeWaves(step.events, earlierIds);
      } catch (e) {
        err(file, 'X4', `${sLabel} 步骤 ${step.id}: ${(e as Error).message}`);
      }

      for (const ev of step.events) {
        findings.push(...validateEventShape(ev, step.id, sLabel, file, participantsById, domainById));
        // X8：StateDelta 通用表白名单
        for (const delta of step.stateDeltas) {
          for (const change of delta.changes) {
            if (!(RESERVED_STATE_TABLES as readonly string[]).includes(change.table) && !(KNOWN_GENERIC_TABLES as readonly string[]).includes(change.table)) {
              err(file, 'X8', `${sLabel} 步骤 ${step.id}: 状态表 "${change.table}" 不在白名单（validation-rules.md X8）`);
            }
          }
          // StateDelta 设备引用
          if (delta.device !== undefined && !deviceIds.has(delta.device)) {
            err(file, 'X6', `${sLabel} 步骤 ${step.id}: stateDelta ${delta.id} 的设备 ${delta.device} 不在 participants 中`);
          }
        }
      }

      // X9：traceRow
      const stepEventIds = new Set(step.events.map((e) => e.id));
      if (step.traceRow) {
        const tr = step.traceRow;
        if (tr.eventRef !== undefined && !stepEventIds.has(tr.eventRef)) {
          err(file, 'X9', `${sLabel} 步骤 ${step.id}: traceRow.eventRef ${tr.eventRef} 不指向本步骤事件`);
        }
        if (tr.eventRef !== undefined && tr.cat !== undefined) {
          const ev = step.events.find((e) => e.id === tr.eventRef);
          const payloadCat = ev?.payload?.cat;
          if (payloadCat !== undefined && payloadCat !== tr.cat) {
            err(file, 'X9', `${sLabel} 步骤 ${step.id}: traceRow.cat(${tr.cat}) 与事件 ${tr.eventRef} 的 payload.cat(${payloadCat}) 不一致`);
          }
        }
        if (tr.lost === true && !hasDrop) {
          err(file, 'X10', `${sLabel}: traceRow.lost=true 但场景内没有任何 kind='drop' 事件`);
        }
      }

      // X13：波次纯度
      if (waves !== null) {
        const impure = checkWavePurity(step.events, earlierIds);
        if (impure) {
          err(file, 'X13', `${sLabel} 步骤 ${step.id}: 波次划分依赖数组顺序 → ${impure.join('; ')}`);
        }
      }

      for (const id of step.events.map((e) => e.id)) earlierIds.add(id);
    });

    // X14：fold 纯度（deep-freeze 后折叠 + 双次折叠一致性）
    const allDeltas: StateDelta[] = scenario.steps.flatMap((s) => s.stateDeltas);
    try {
      const frozenInitial = deepFreeze(scenario.initialState);
      const frozenDeltas = deepFreeze(allDeltas);
      const snap1 = JSON.stringify(frozenInitial) + '|' + JSON.stringify(frozenDeltas);
      const s1 = foldState(frozenInitial, frozenDeltas);
      const s2 = foldState(frozenInitial, frozenDeltas);
      const snap2 = JSON.stringify(frozenInitial) + '|' + JSON.stringify(frozenDeltas);
      if (snap1 !== snap2) err(file, 'X14', `${sLabel}: fold 修改了输入数据（deep-freeze 对比失败）`);
      if (!snapshotsEqual(s1, s2)) err(file, 'X14', `${sLabel}: 两次折叠结果不一致（非确定性）`);
    } catch (e) {
      err(file, 'X14', `${sLabel}: fold 抛出异常 → ${(e as Error).message}`);
    }
  }
  return void allDemoEventIds; // 场景级唯一已保证；全库唯一在跨文件处统计
}

/**
 * 多播接收者推导（N1）：域成员中 role ∈ roleFilter 且 id ≠ from 的设备。
 * 设计语义（demo-event-model.md §2.2）：多播是「域内按角色过滤的子集」；与广播一致，
 * 发送方自身不计入接收者（广播写明「域内除 from 外全部」，多播沿用同一约定）。
 * 空数组 = 域内没有符合条件的设备，由 validateEventShape 报 ERROR——
 * 此时动画没有任何接收者，属数据错误而非可容忍的退化情况。
 */
export function multicastRecipients(
  domain: Pick<BroadcastDomain, 'members'>,
  participantsById: ReadonlyMap<string, Device>,
  roleFilter: readonly DeviceRole[],
  from: string,
): string[] {
  return domain.members.filter((id) => {
    if (id === from) return false;
    const role = participantsById.get(id)?.role;
    return role !== undefined && roleFilter.includes(role);
  });
}

/** L1 形状约束（validation-rules.md §2）：kind 与 TargetSpec/payload 的搭配。返回诊断，不直接写全局 findings（便于独立测试）。 */
export function validateEventShape(
  ev: DemoEvent,
  stepId: string,
  sLabel: string,
  file: string,
  participantsById: ReadonlyMap<string, Device>,
  domainById: ReadonlyMap<string, BroadcastDomain>,
): Finding[] {
  const out: Finding[] = [];
  const err = (rule: string, msg: string) => out.push({ file, rule, msg, severity: 'ERROR' });
  const warn = (rule: string, msg: string) => out.push({ file, rule, msg, severity: 'WARN' });
  const ctx = `${sLabel} 步骤 ${stepId} 事件 ${ev.id}`;
  // X6：from
  if (!participantsById.has(ev.from)) err('X6', `${ctx}: from "${ev.from}" 不在 participants 中`);
  // X6：to 的设备/域引用
  if (ev.to.kind === 'device') {
    if (!participantsById.has(ev.to.id)) err('X6', `${ctx}: to 设备 "${ev.to.id}" 不在 participants 中`);
  } else {
    if (!domainById.has(ev.to.domain)) {
      err('X6', `${ctx}: ${ev.to.kind} 域 "${ev.to.domain}" 不在 topology.domains 中`);
    } else {
      const domain = domainById.get(ev.to.domain);
      const members = domain?.members ?? [];
      if (ev.to.kind === 'broadcast') {
        for (const ex of ev.to.excludeFrom ?? []) {
          if (!participantsById.has(ex)) err('X6', `${ctx}: excludeFrom "${ex}" 不在 participants 中`);
          if (!members.includes(ex)) warn('X6', `${ctx}: excludeFrom "${ex}" 不属于域 ${ev.to.domain}（排除无效）`);
        }
      }
      if (ev.to.kind === 'multicast') {
        // roleFilter 中没有任何成员具备的角色：可能是拓扑角色写错或域成员缺失，先给诊断
        for (const role of ev.to.roleFilter) {
          if (!members.some((m) => participantsById.get(m)?.role === role)) {
            warn('X6', `${ctx}: roleFilter 角色 "${role}" 在域 ${ev.to.domain} 内没有任何设备具备`);
          }
        }
        const recipients = multicastRecipients({ members }, participantsById, ev.to.roleFilter, ev.from);
        if (recipients.length === 0) {
          err(
            'X6',
            `${ctx}: 多播接收者为空——域 ${ev.to.domain} 内没有角色 ∈ {${ev.to.roleFilter.join(', ')}} 且非发送方 ${ev.from} 的设备（动画将没有任何接收者）`,
          );
        }
      }
    }
  }
  // kind 形状约束
  if (ev.kind === 'process') {
    if (ev.to.kind !== 'device' || ev.to.id !== ev.from) {
      err('L1-shape', `${ctx}: process 事件要求 to 为自身设备（to.kind='device' 且 to.id===from）`);
    }
    if (ev.payload != null) err('L1-shape', `${ctx}: process 事件不得携带 payload`);
  }
  if (ev.kind === 'unicast' && ev.to.kind !== 'device') {
    err('L1-shape', `${ctx}: unicast 事件要求 to.kind='device'`);
  }
  if ((ev.kind === 'broadcast' || ev.kind === 'multicast') && ev.to.kind === 'device') {
    err('L1-shape', `${ctx}: ${ev.kind} 事件要求 to.kind 为 ${ev.kind}`);
  }
  if (ev.kind === 'broadcast' && ev.to.kind === 'multicast') {
    err('L1-shape', `${ctx}: broadcast 事件不得使用 multicast 目标`);
  }
  if (ev.kind === 'multicast' && ev.to.kind === 'broadcast') {
    err('L1-shape', `${ctx}: multicast 事件必须使用带 roleFilter 的 multicast 目标`);
  }
  if (ev.kind !== 'process' && ev.kind !== 'drop' && ev.payload == null) {
    err('L1-shape', `${ctx}: ${ev.kind} 事件必须携带 payload`);
  }
  return out;
}

/* ================= 知识点 / 来源（存在即校验） ================= */

function loadSources(): Map<string, Source> {
  const map = new Map<string, Source>();
  const file = path.join(CONTENT_DIR, 'sources.json');
  if (!fs.existsSync(file)) return map;
  const raw = readJson(file) as unknown;
  const list = Array.isArray(raw) ? raw : (raw as { sources?: unknown[] }).sources ?? [];
  list.forEach((item, i) => {
    const s = l1Parse<Source>(SourceSchema, item, `content/sources.json#${i}`, 'Source');
    if (s) {
      if (map.has(s.sourceId)) err('content/sources.json', 'X12', `sourceId "${s.sourceId}" 重复`);
      map.set(s.sourceId, s);
    }
  });
  return map;
}

function loadKnowledge(): KnowledgePoint[] {
  const dir = path.join(CONTENT_DIR, 'knowledge');
  const out: KnowledgePoint[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const raw = readJson(path.join(dir, name));
    const k = l1Parse<KnowledgePoint>(KnowledgePointSchema, raw, `content/knowledge/${name}`, 'KnowledgePoint');
    if (k) out.push(k);
  }
  return out;
}

function checkKnowledgeReferences(ks: KnowledgePoint[], demos: Demo[], sources: Map<string, Source>): void {
  const demoIds = new Set(demos.map((d) => d.id));
  const kIds = new Set(ks.map((k) => k.id));
  // X12：knowledge 命名空间唯一
  if (kIds.size !== ks.length) err('content/knowledge', 'X12', '知识点 id 存在重复');
  // demo 命名空间唯一
  if (demoIds.size !== demos.length) err('content/demos', 'X12', 'demo id 存在重复');

  for (const k of ks) {
    const label = k.id;
    // X1：sourceRefs[].sourceId 存在
    for (const ref of k.sourceRefs) {
      if (!sources.has(ref.sourceId)) err(label, 'X1', `引用了不存在的来源 ${ref.sourceId}`);
      else {
        // X11：sections 格式启发式
        const src = sources.get(ref.sourceId);
        for (const sec of ref.sections) {
          if (src?.type === 'rfc' && !/^\d+(\.\d+)*([A-Za-z.]\d*)?( \(.*\))?$/.test(sec) && !/^(Appendix [A-Z.]+|Page \d+)$/.test(sec)) {
            err(label, 'X11', `RFC ${ref.sourceId} 的 section "${sec}" 不符合小节编号启发式（\\d+(.\\d+)* / Appendix / Page）`);
          }
        }
      }
    }
    // X2：demoRefs 存在
    for (const d of k.demoRefs) {
      if (!demoIds.has(d)) err(label, 'X2', `demoRefs 引用了不存在的演示 ${d}`);
    }
    // X3：relatedKnowledge 互指一致性
    for (const r of k.relatedKnowledge) {
      const other = ks.find((x) => x.id === r);
      if (!other) err(label, 'X3', `relatedKnowledge 引用了不存在的知识点 ${r}`);
      else if (!other.relatedKnowledge.includes(k.id)) {
        err(label, 'X3', `relatedKnowledge 未互指：${label} → ${r}，但 ${r} 未登记 ${label}`);
      }
    }
  }
}

/* ================= L3 发布门禁（P1–P6） ================= */

interface GateViolation { level: string; msg: string }

const BLOCKING_LICENSE = new Set(['pending', 'per-file-review']);
const PUBLISHABLE_CONTENT_STATE = new Set<ContentState>(['original', 'adapted', 'license-verified']);

/** 知识点发布门禁：仅当 status='published' 时强制（双轨：status 与 licenseStatus 独立检查）。 */
export function knowledgePublishGates(k: KnowledgePoint, sources: Map<string, Source>, today: string): GateViolation[] {
  const out: GateViolation[] = [];
  if (k.status !== 'published') return out;
  // P7（N3，2026-11-12）：published 必须至少关联 1 条来源。
  // 依据：计划书要求「教材解释知识、标准保证准确」，无来源的 published 内容无法追溯核对；
  // draft 允许无来源（尚未进入审核），review 允许挂着待确认来源（来源不满足只影响能否发布）。
  if (k.sourceRefs.length === 0) {
    out.push({ level: 'P7', msg: `${k.id} status=published 但没有任何 sourceRef——published 内容至少需关联 1 条来源（draft 可空，review 可待确认）` });
  }
  // P1：checkedAt 非空且 ≤ 今天；sections 为空需 verificationNote 说明
  for (const ref of k.sourceRefs) {
    if (ref.checkedAt > today) out.push({ level: 'P1', msg: `${k.id} 引用 ${ref.sourceId} 的 checkedAt 晚于今天` });
    if (ref.sections.length === 0 && !ref.verificationNote) {
      out.push({ level: 'P1', msg: `${k.id} 引用 ${ref.sourceId} 无 sections 且无 verificationNote 说明` });
    }
    // P2：授权状态门禁（licenseStatus 轨道）
    const src = sources.get(ref.sourceId);
    if (src && BLOCKING_LICENSE.has(src.licenseStatus)) {
      out.push({ level: 'P2', msg: `${k.id} 引用的来源 ${ref.sourceId} licenseStatus=${src.licenseStatus}，不得支撑 published 内容` });
    }
  }
  // P3：contentState 门禁（status 轨道）
  if (!PUBLISHABLE_CONTENT_STATE.has(k.contentState)) {
    out.push({ level: 'P3', msg: `${k.id} contentState=${k.contentState}，不得 published` });
  }
  // P4：paid-standard 来源 → 输出待查清单（人工项，不阻塞）
  for (const ref of k.sourceRefs) {
    const src = sources.get(ref.sourceId);
    if (src?.licenseStatus === 'paid-standard') {
      out.push({ level: 'P4', msg: `[待人工核查] ${k.id} 引用付费标准 ${ref.sourceId}：正文不得出现条款原文引用` });
    }
  }
  return out;
}

/** P5：demo published 要求关联知识点全部 published（反向索引 = knowledge.demoRefs）。 */
export function demoPublishGates(demoId: string, ks: KnowledgePoint[]): GateViolation[] {
  const out: GateViolation[] = [];
  const related = ks.filter((k) => k.demoRefs.includes(demoId));
  for (const k of related) {
    if (k.status !== 'published') out.push({ level: 'P5', msg: `演示 ${demoId} 关联的知识点 ${k.id} 尚未 published（演示不能先于它解释的知识上线）` });
  }
  return out;
}

/** P6 自测：来源失效联动（--demote <sourceId> 命令的规则内核）。 */
export function demoteOnSourceRetired(ks: KnowledgePoint[], sourceId: string, retiredLicense: string): { id: string; from: string }[] {
  const demoted: { id: string; from: string }[] = [];
  if (!BLOCKING_LICENSE.has(retiredLicense)) return demoted;
  for (const k of ks) {
    if (k.status === 'published' && k.sourceRefs.some((r) => r.sourceId === sourceId)) {
      demoted.push({ id: k.id, from: k.status });
    }
  }
  return demoted;
}

/* ================= 内建自测（fold 各 op + 门禁规则） ================= */

function selftest(): void {
  const file = '(selftest)';
  // fold：全部 op 语义
  const init = {
    pc1: { 'arp-cache': [{ ip: '10.0.0.1', mac: 'GW', state: 'stale' }] },
    pc9: { 'arp-cache': [{ ip: '9.9.9.9', mac: 'Z', state: 'reachable' }] },
    sw1: { 'mac-table': [{ vlan: 1, mac: 'AA', port: 'P1' }] },
    lt: { 'tcp-state': [{ peer: 'srv', to: 'CLOSED' }] },
    dns: { 'dns-cache': [{ name: 'a.example', type: 'A', rdata: '1.1.1.1', ttl: 300 }] },
  };
  const deltas: StateDelta[] = [
    { id: 'd1', device: 'pc1', changes: [{ table: 'arp-cache', op: 'upsert', entry: { ip: '10.0.0.2', mac: 'B', state: 'reachable' } }] },
    { id: 'd2', device: 'pc1', changes: [{ table: 'arp-cache', op: 'expire', entry: { ip: '10.0.0.1', state: 'stale' } }] },
    { id: 'd3', device: 'sw1', changes: [{ table: 'mac-table', op: 'learn', entry: { vlan: 1, mac: 'BB', port: 'P2' } }] },
    { id: 'd4', device: 'lt', changes: [{ table: 'tcp-state', op: 'set', entry: { peer: 'srv', from: 'CLOSED', to: 'SYN_SENT' } }] },
    { id: 'd5', device: 'dns', changes: [{ table: 'dns-cache', op: 'upsert', entry: { name: 'a.example', type: 'A', rdata: '1.1.1.1', ttl: 42 } }] },
    { id: 'd6', device: 'dns', changes: [{ table: 'dns-cache', op: 'remove', entry: { name: 'gone.example' } }] },
    { id: 'd7', device: 'pc9', changes: [{ table: 'arp-cache', op: 'clear', entry: { ip: 'x', state: 'stale' } }] },
  ];
  const s = foldState(init, deltas);
  const arp = (s.pc1?.['arp-cache'] ?? []) as { ip: string; state: string }[];
  // upsert 10.0.0.2 追加；expire 将 10.0.0.1 原地置 stale（去 mac）；clear 只作用于 pc9
  if (!(arp.length === 2 && arp.some((e) => e.ip === '10.0.0.2' && e.state === 'reachable') && arp.some((e) => e.ip === '10.0.0.1' && e.state === 'stale' && !('mac' in e)))) {
    err(file, 'SELFTEST', `arp upsert/expire 结果不符: ${JSON.stringify(arp)}`);
  }
  const arp9 = (s.pc9?.['arp-cache'] ?? []) as unknown[];
  if (arp9.length !== 0) err(file, 'SELFTEST', `arp clear 结果不符: ${JSON.stringify(arp9)}`);
  const mac = (s.sw1?.['mac-table'] ?? []) as { mac: string }[];
  if (!(mac.length === 2 && mac.some((m) => m.mac === 'BB'))) err(file, 'SELFTEST', `mac learn 结果不符: ${JSON.stringify(mac)}`);
  const tcp = (s.lt?.['tcp-state'] ?? []) as { peer: string; to: string }[];
  if (!(tcp.length === 1 && tcp[0]?.to === 'SYN_SENT')) err(file, 'SELFTEST', `tcp set 结果不符: ${JSON.stringify(tcp)}`);
  const dnsC = (s.dns?.['dns-cache'] ?? []) as { name: string; ttl: number }[];
  if (!(dnsC.length === 1 && dnsC[0]?.ttl === 42)) err(file, 'SELFTEST', `dns-cache upsert 替换结果不符: ${JSON.stringify(dnsC)}`);
  // 确定性：重复折叠一致
  if (!snapshotsEqual(s, foldState(init, deltas))) err(file, 'SELFTEST', '两次折叠结果不一致');
  // 门禁：published 引用 pending 来源必须被拦截
  const fakeSources = new Map([['s-bad', { sourceId: 's-bad', type: 'rfc', name: 'x', author: 'y', url: 'https://example.org', licenseStatus: 'pending', addedAt: '2026-01-01' } as Source]]);
  const fakeK = { id: 'NET-04-99', status: 'published', contentState: 'original', sourceRefs: [{ sourceId: 's-bad', purpose: 'p', sections: ['1'], checkedAt: '2026-01-01' }], demoRefs: [] } as unknown as KnowledgePoint;
  const v = knowledgePublishGates(fakeK, fakeSources, '2026-11-12');
  if (!v.some((x) => x.level === 'P2')) err(file, 'SELFTEST', '发布门禁未能拦截 pending 来源');
  // P7（N3）：published 但没有任何来源 → 必须拦截；draft 无来源 → 不拦
  const noSrc = knowledgePublishGates({ ...fakeK, sourceRefs: [] } as unknown as KnowledgePoint, fakeSources, '2026-11-12');
  if (!noSrc.some((x) => x.level === 'P7')) err(file, 'SELFTEST', 'P7 未拦截「published 且无来源」');
  const draftNoSrc = knowledgePublishGates({ ...fakeK, status: 'draft', sourceRefs: [] } as unknown as KnowledgePoint, fakeSources, '2026-11-12');
  if (draftNoSrc.length !== 0) err(file, 'SELFTEST', 'draft 无来源不应触发发布门禁');
  // P6：来源失效联动
  const demoted = demoteOnSourceRetired([fakeK], 's-bad', 'pending');
  if (demoted.length !== 1) err(file, 'SELFTEST', 'P6 来源失效联动未命中');
}

/* ================= 主流程 ================= */

function loadDemoList(dir: string, label: string): { file: string; raw: Record<string, unknown> }[] {
  const out: { file: string; raw: Record<string, unknown> }[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const file = `${label}/${name}`;
    try {
      out.push({ file, raw: readJson(path.join(dir, name)) as Record<string, unknown> });
    } catch (e) {
      err(file, 'L0', `JSON 解析失败: ${(e as Error).message}`);
    }
  }
  return out;
}

function main(): void {
  selftest();

  const fixtureList = loadDemoList(FIXTURE_DIR, 'docs/sample-demos');
  const contentDemoList = loadDemoList(path.join(CONTENT_DIR, 'demos'), 'content/demos');
  const demos: Demo[] = [];
  const demoFiles: string[] = [];

  for (const { file, raw } of [...fixtureList, ...contentDemoList]) {
    const cleaned = stripDocAnnotations(raw, file);
    const demo = l1Parse<Demo>(DemoSchema, cleaned, file, 'Demo');
    if (!demo) continue;
    demos.push(demo);
    demoFiles.push(file);
  }

  for (let i = 0; i < demos.length; i++) {
    validateDemoScenarios(demos[i] as Demo, demoFiles[i] as string);
  }

  const sources = loadSources();
  const knowledge = loadKnowledge();
  const hasKnowledgeData = knowledge.length > 0;
  const hasSourceData = sources.size > 0;

  if (hasKnowledgeData || hasSourceData) {
    checkKnowledgeReferences(knowledge, demos, sources);
    for (const k of knowledge) {
      for (const v of knowledgePublishGates(k, sources, new Date().toISOString().slice(0, 10))) {
        if (v.level === 'P4') warn(k.id, v.level, v.msg);
        else err(k.id, v.level, v.msg);
      }
    }
    for (const d of demos) {
      for (const v of demoPublishGates(d.id, knowledge)) err(`demo:${d.id}`, v.level, v.msg);
    }
  } else {
    info('content/', 'L3', '尚无 knowledge/sources 落地数据——X1/X2/X3/X11 与发布门禁 P1–P7 待数据就绪后自动启用（规则已实现并经内建自测）');
  }

  /* ---- 输出 ---- */
  const errors = findings.filter((f) => f.severity === 'ERROR');
  const warnings = findings.filter((f) => f.severity === 'WARN');
  const infos = findings.filter((f) => f.severity === 'INFO');
  for (const f of findings) {
    const tag = f.severity === 'ERROR' ? '✗' : f.severity === 'WARN' ? '⚠' : '·';
    console.log(`${tag} [${f.rule}] ${f.file}: ${f.msg}`);
  }
  console.log('');
  console.log(`validate-content: 样例 ${fixtureList.length} 份 + 落地演示 ${contentDemoList.length} 份 | 来源 ${sources.size} 条 | 知识点 ${knowledge.length} 条`);
  console.log(`结果: ${errors.length} ERROR / ${warnings.length} WARN / ${infos.length} INFO`);
  if (errors.length > 0) process.exit(1);
}

/** 仅直接运行（node scripts/validate-content.mts）时执行全量校验；
 *  被测试脚本 import 时不触发，避免副作用与重复输出。 */
const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();

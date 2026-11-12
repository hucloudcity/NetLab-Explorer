/**
 * NetLab Explorer — 演示数据 Zod Schema（L1 结构校验）
 * 对应 src/types/demo.ts 与 docs/demo-event-model.md §1–6。
 *
 * 一致性保障：每个 schema 用 `z.ZodType<T>` 注解锚定到手写类型，
 * tsc --noEmit 会在编译期强制「schema 输出 = 类型定义」，两者不可能漂移。
 * 运行时 JSON 必须经本 schema 校验——TS 类型在运行时不存在，不能作为 JSON 校验依据。
 */
import { z } from 'zod';
import type {
  ArpCacheEntry,
  BroadcastDomain,
  Demo,
  DemoEvent,
  DemoScenario,
  Device,
  FieldValue,
  GenericEntry,
  Link,
  MacTableEntry,
  OspfNeighborEntry,
  Packet,
  StateChange,
  StateDelta,
  StateEntry,
  StateSnapshot,
  Step,
  TargetSpec,
  TcpStateEntry,
  Topology,
  TraceRow,
} from '../types/demo.ts';

/* ---------- 标量 ---------- */

const FieldValueSchema: z.ZodType<FieldValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(FieldValueSchema),
    z.record(z.string(), FieldValueSchema),
  ]),
);

/* ---------- 拓扑 ---------- */

/* 未知字段策略（N5，2026-11-12）：契约对象一律 .strict()——多余字段视为拼写错误或
 * 未登记的模型扩展，必须同时改类型与 schema；只有语义上开放的容器
 * （Packet.fields / layers[].keyValues / 通用状态表条目）才允许任意键。 */
const DeviceSchema: z.ZodType<Device> = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    role: z.enum(['host', 'switch', 'router', 'server', 'resolver', 'gateway', 'ap']),
    kind: z.enum(['laptop', 'router', 'cloud', 'server', 'switch', 'ap', 'generic']),
    address: z
      .object({
        ip: z.string().optional(),
        mac: z.string().optional(),
        port: z.number().int().min(0).max(65535).optional(),
        domain: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const BroadcastDomainSchema: z.ZodType<BroadcastDomain> = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    members: z.array(z.string().min(1)).min(1),
  })
  .strict();

const LinkSchema: z.ZodType<Link> = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    medium: z.enum(['wired', 'wireless', 'virtual']).optional(),
  })
  .strict();

const TopologySchema: z.ZodType<Topology> = z
  .object({
    layout: z
      .object({
        view: z.enum(['network', 'stack']),
        note: z.string().optional(),
      })
      .strict(),
    participants: z.array(DeviceSchema).min(1),
    domains: z.array(BroadcastDomainSchema),
    links: z.array(LinkSchema),
  })
  .strict();

/* ---------- 报文 ---------- */

const PacketSchema: z.ZodType<Packet> = z
  .object({
    proto: z.string().min(1),
    summary: z.string().min(1),
    size: z.number().int().min(0).optional(),
    cat: z.enum(['hand', 'cdata', 'sdata', 'fin', 'query', 'response', 'broadcast', 'generic']).optional(),
    fields: z.record(z.string(), FieldValueSchema).optional(),
    layers: z
      .array(
        z
          .object({ name: z.string().min(1), keyValues: z.record(z.string(), z.string()) })
          .strict(),
      )
      .optional(),
  })
  .strict();

/* ---------- 事件 ---------- */

const DeviceRoleSchema = z.enum(['host', 'switch', 'router', 'server', 'resolver', 'gateway', 'ap']);

const TargetSpecSchema: z.ZodType<TargetSpec> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('device'), id: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('broadcast'),
      domain: z.string().min(1),
      excludeFrom: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('multicast'),
      domain: z.string().min(1),
      roleFilter: z.array(DeviceRoleSchema).min(1),
    })
    .strict(),
]);

const DemoEventSchema: z.ZodType<DemoEvent> = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['unicast', 'broadcast', 'multicast', 'process', 'drop']),
    from: z.string().min(1),
    to: TargetSpecSchema,
    payload: PacketSchema.nullish(),
    timing: z
      .object({ duration: z.number().min(0).optional(), stagger: z.number().min(0).optional() })
      .optional(),
    dependsOn: z.array(z.string().min(1)),
    note: z.string().optional(),
  })
  .strict();

/* ---------- 状态 ---------- */

/**
 * N2（2026-11-12）：状态条目按**表名**分派校验，不再依赖宽松 union 兜底。
 * 之前 StateEntrySchema 的五路 union 中 GenericEntry（任意 FieldValue 记录）会把
 * 畸形 arp / tcp / ospf 条目「接住」，导致非法状态值通过 L1。现在：
 * - 保留表（arp-cache/mac-table/tcp-state/ospf-neighbor）条目必须逐字段符合专用 schema；
 * - 通用表只允许 dns-cache / routing-table（白名单），条目为 FieldValue 记录；
 * - initialState 快照与 StateDelta 使用同一套表名约束（一致性由本文件保证）。
 */
const TCP_STATES = [
  'CLOSED', 'LISTEN', 'SYN_SENT', 'SYN_RCVD', 'ESTABLISHED', 'CLOSE_WAIT',
  'FIN_WAIT_1', 'CLOSING', 'LAST_ACK', 'FIN_WAIT_2', 'TIME_WAIT',
] as const;

const OSPF_STATES = ['Down', 'Attempt', 'Init', '2-Way', 'ExStart', 'Exchange', 'Loading', 'Full'] as const;

const ArpCacheEntrySchema: z.ZodType<ArpCacheEntry> = z
  .object({
    ip: z.string().min(1),
    mac: z.string().optional(),
    state: z.enum(['incomplete', 'reachable', 'stale']),
  })
  .strict();

const MacTableEntrySchema: z.ZodType<MacTableEntry> = z
  .object({
    vlan: z.number().int().min(0),
    mac: z.string().min(1),
    port: z.string().min(1),
  })
  .strict();

const TcpStateEntrySchema: z.ZodType<TcpStateEntry> = z
  .object({
    peer: z.string().min(1),
    from: z.enum(TCP_STATES).optional(),
    to: z.enum(TCP_STATES),
  })
  .strict();

const OspfNeighborEntrySchema: z.ZodType<OspfNeighborEntry> = z
  .object({
    peer: z.string().min(1),
    from: z.enum(OSPF_STATES).optional(),
    to: z.enum(OSPF_STATES),
  })
  .strict();

const GenericEntrySchema: z.ZodType<GenericEntry> = z.record(z.string(), FieldValueSchema);

/** 通用表白名单之外的新状态类型需先扩 schema（validation-rules.md X8）。 */
export const RESERVED_STATE_TABLES = ['arp-cache', 'mac-table', 'tcp-state', 'ospf-neighbor'] as const;
export const KNOWN_GENERIC_TABLES = ['dns-cache', 'routing-table'] as const;

/** 表名 → 条目 schema。保留表条目只认专用形状；通用表见下方白名单。 */
const TABLE_ENTRY_SCHEMAS: Readonly<Record<string, z.ZodType<StateEntry>>> = {
  'arp-cache': ArpCacheEntrySchema,
  'mac-table': MacTableEntrySchema,
  'tcp-state': TcpStateEntrySchema,
  'ospf-neighbor': OspfNeighborEntrySchema,
};

const isKnownGenericTable = (t: string): boolean => (KNOWN_GENERIC_TABLES as readonly string[]).includes(t);

const StateEntrySchema: z.ZodType<StateEntry> = z.union([
  ArpCacheEntrySchema,
  MacTableEntrySchema,
  TcpStateEntrySchema,
  OspfNeighborEntrySchema,
  GenericEntrySchema,
]);

const StateChangeSchema: z.ZodType<StateChange> = z.union([
  z
    .object({ table: z.literal('arp-cache'), op: z.enum(['upsert', 'expire', 'clear']), entry: ArpCacheEntrySchema })
    .strict(),
  z
    .object({ table: z.literal('mac-table'), op: z.enum(['learn', 'age', 'flush']), entry: MacTableEntrySchema })
    .strict(),
  z.object({ table: z.literal('tcp-state'), op: z.literal('set'), entry: TcpStateEntrySchema }).strict(),
  z.object({ table: z.literal('ospf-neighbor'), op: z.literal('set'), entry: OspfNeighborEntrySchema }).strict(),
  // 通用表兜底：保留表名与白名单外表名都不得落入此分支（结构错误在此报错，而非被兜底吞掉）
  z
    .object({
      table: z
        .string()
        .min(1)
        .refine((t) => !(RESERVED_STATE_TABLES as readonly string[]).includes(t), {
          message: `保留状态表只能用专用分支（${RESERVED_STATE_TABLES.join('/')}）`,
        })
        .refine(isKnownGenericTable, {
          message: `通用状态表必须来自白名单（${KNOWN_GENERIC_TABLES.join('/')}），新增表需先扩 schema（validation-rules.md X8）`,
        }),
      op: z.enum(['upsert', 'remove', 'set']),
      entry: GenericEntrySchema,
    })
    .strict(),
]);

const StateDeltaSchema: z.ZodType<StateDelta> = z
  .object({
    id: z.string().min(1),
    device: z.string().min(1).optional(),
    afterEvent: z.string().min(1).optional(),
    changes: z.array(StateChangeSchema).min(1),
  })
  .strict();

/**
 * 初始状态快照：设备 id → 表名 → 条目列表。
 * 基础形状用 StateEntrySchema 解析（保证输出类型），superRefine 再按表名做**严格复检**：
 * 保留表的条目必须通过专用 schema；通用表必须在白名单内。这样畸形条目不会再借
 * GenericEntry 兜底混入具体状态表。
 */
const StateSnapshotSchema: z.ZodType<StateSnapshot> = z
  .record(z.string(), z.record(z.string(), z.array(StateEntrySchema)))
  .superRefine((snapshot, ctx) => {
    for (const [deviceId, tables] of Object.entries(snapshot)) {
      for (const [table, entries] of Object.entries(tables)) {
        const entrySchema = TABLE_ENTRY_SCHEMAS[table];
        if (entrySchema) {
          entries.forEach((entry, i) => {
            const r = entrySchema.safeParse(entry);
            if (!r.success) {
              for (const issue of r.error.issues) {
                ctx.addIssue({
                  code: 'custom',
                  message: `状态表 ${table} 的条目必须符合其字段定义: ${issue.message}`,
                  path: [deviceId, table, i, ...issue.path],
                });
              }
            }
          });
        } else if (!isKnownGenericTable(table)) {
          ctx.addIssue({
            code: 'custom',
            message: `状态表 "${table}" 不在白名单（${[...RESERVED_STATE_TABLES, ...KNOWN_GENERIC_TABLES].join(', ')}），需先扩 schema（validation-rules.md X8）`,
            path: [deviceId, table],
          });
        }
      }
    }
  });

/* ---------- 表格行 / 步骤 / 场景 / 演示 ---------- */

const TraceRowSchema: z.ZodType<TraceRow> = z
  .object({
    time: z.string().min(1),
    src: z.string().min(1),
    dst: z.string().min(1),
    proto: z.string().min(1),
    info: z.string().min(1),
    size: z.number().int().min(0).optional(),
    cat: z.enum(['hand', 'cdata', 'sdata', 'fin', 'query', 'response', 'broadcast', 'generic']).optional(),
    lost: z.boolean().optional(),
    eventRef: z.string().min(1).optional(),
  })
  .strict();

const StepSchema: z.ZodType<Step> = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    events: z.array(DemoEventSchema).min(1),
    stateDeltas: z.array(StateDeltaSchema),
    traceRow: TraceRowSchema.nullish(),
  })
  .strict();

const DemoScenarioSchema: z.ZodType<DemoScenario> = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    initialState: StateSnapshotSchema,
    steps: z.array(StepSchema).min(1),
  })
  .strict();

const DemoSchema: z.ZodType<Demo> = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    protocol: z.string().min(1),
    topology: TopologySchema,
    scenarios: z.array(DemoScenarioSchema).min(1),
    view: z.object({ kind: z.enum(['network', 'stack', 'timeline']) }).optional(),
  })
  .strict();

export { DeviceSchema, DemoSchema, DemoEventSchema, DemoScenarioSchema, PacketSchema, StateChangeSchema, StateDeltaSchema, StepSchema, TargetSpecSchema, TopologySchema, TraceRowSchema, FieldValueSchema };

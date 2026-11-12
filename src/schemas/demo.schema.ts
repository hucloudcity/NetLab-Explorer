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
  BroadcastDomain,
  Demo,
  DemoEvent,
  DemoScenario,
  Device,
  FieldValue,
  Link,
  OspfNeighborEntry,
  Packet,
  StateChange,
  StateDelta,
  StateEntry,
  StateSnapshot,
  Step,
  TargetSpec,
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

const DeviceSchema: z.ZodType<Device> = z.object({
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
    .optional(),
});

const BroadcastDomainSchema: z.ZodType<BroadcastDomain> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  members: z.array(z.string().min(1)).min(1),
});

const LinkSchema: z.ZodType<Link> = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  medium: z.enum(['wired', 'wireless', 'virtual']).optional(),
});

const TopologySchema: z.ZodType<Topology> = z.object({
  layout: z.object({
    view: z.enum(['network', 'stack']),
    note: z.string().optional(),
  }),
  participants: z.array(DeviceSchema).min(1),
  domains: z.array(BroadcastDomainSchema),
  links: z.array(LinkSchema),
});

/* ---------- 报文 ---------- */

const PacketSchema: z.ZodType<Packet> = z.object({
  proto: z.string().min(1),
  summary: z.string().min(1),
  size: z.number().int().min(0).optional(),
  cat: z.enum(['hand', 'cdata', 'sdata', 'fin', 'query', 'response', 'broadcast', 'generic']).optional(),
  fields: z.record(z.string(), FieldValueSchema).optional(),
  layers: z
    .array(z.object({ name: z.string().min(1), keyValues: z.record(z.string(), z.string()) }))
    .optional(),
});

/* ---------- 事件 ---------- */

const TargetSpecSchema: z.ZodType<TargetSpec> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('device'), id: z.string().min(1) }),
  z.object({
    kind: z.literal('broadcast'),
    domain: z.string().min(1),
    excludeFrom: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    kind: z.literal('multicast'),
    domain: z.string().min(1),
    roleFilter: z
      .array(z.enum(['host', 'switch', 'router', 'server', 'resolver', 'gateway', 'ap']))
      .min(1),
  }),
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

const ArpCacheEntrySchema = z.object({
  ip: z.string().min(1),
  mac: z.string().optional(),
  state: z.enum(['incomplete', 'reachable', 'stale']),
});

const MacTableEntrySchema = z.object({
  vlan: z.number().int().min(0),
  mac: z.string().min(1),
  port: z.string().min(1),
});

const TcpStateEntrySchema = z.object({
  peer: z.string().min(1),
  from: z
    .enum(['CLOSED', 'LISTEN', 'SYN_SENT', 'SYN_RCVD', 'ESTABLISHED', 'CLOSE_WAIT', 'FIN_WAIT_1', 'CLOSING', 'LAST_ACK', 'FIN_WAIT_2', 'TIME_WAIT'])
    .optional(),
  to: z.enum(['CLOSED', 'LISTEN', 'SYN_SENT', 'SYN_RCVD', 'ESTABLISHED', 'CLOSE_WAIT', 'FIN_WAIT_1', 'CLOSING', 'LAST_ACK', 'FIN_WAIT_2', 'TIME_WAIT']),
});

const OspfNeighborEntrySchema: z.ZodType<OspfNeighborEntry> = z.object({
  peer: z.string().min(1),
  from: z.enum(['Down', 'Attempt', 'Init', '2-Way', 'ExStart', 'Exchange', 'Loading', 'Full']).optional(),
  to: z.enum(['Down', 'Attempt', 'Init', '2-Way', 'ExStart', 'Exchange', 'Loading', 'Full']),
});

const GenericEntrySchema: z.ZodType<Record<string, FieldValue>> = z.record(
  z.string(),
  FieldValueSchema,
);

/** 通用表白名单之外的新状态类型需先扩 schema（validation-rules.md X8）。 */
export const RESERVED_STATE_TABLES = ['arp-cache', 'mac-table', 'tcp-state', 'ospf-neighbor'] as const;
export const KNOWN_GENERIC_TABLES = ['dns-cache', 'routing-table'] as const;

const StateEntrySchema: z.ZodType<StateEntry> = z.union([
  ArpCacheEntrySchema,
  MacTableEntrySchema,
  TcpStateEntrySchema,
  OspfNeighborEntrySchema,
  GenericEntrySchema,
]);

const StateChangeSchema: z.ZodType<StateChange> = z.union([
  z.object({ table: z.literal('arp-cache'), op: z.enum(['upsert', 'expire', 'clear']), entry: ArpCacheEntrySchema }),
  z.object({ table: z.literal('mac-table'), op: z.enum(['learn', 'age', 'flush']), entry: MacTableEntrySchema }),
  z.object({ table: z.literal('tcp-state'), op: z.literal('set'), entry: TcpStateEntrySchema }),
  z.object({ table: z.literal('ospf-neighbor'), op: z.literal('set'), entry: OspfNeighborEntrySchema }),
  // 通用表兜底；保留表名（前四类）不得落入通用分支（结构错误会在此报错而非被兜底吞掉）
  z.object({
    table: z
      .string()
      .min(1)
      .refine((t) => !(RESERVED_STATE_TABLES as readonly string[]).includes(t), {
        message: `保留状态表只能用专用分支（${RESERVED_STATE_TABLES.join('/')}）`,
      }),
    op: z.enum(['upsert', 'remove', 'set']),
    entry: GenericEntrySchema,
  }),
]);

const StateDeltaSchema: z.ZodType<StateDelta> = z
  .object({
    id: z.string().min(1),
    device: z.string().min(1).optional(),
    afterEvent: z.string().min(1).optional(),
    changes: z.array(StateChangeSchema).min(1),
  })
  .strict();

const StateSnapshotSchema: z.ZodType<StateSnapshot> = z.record(
  z.string(),
  z.record(z.string(), z.array(StateEntrySchema)),
);

/* ---------- 表格行 / 步骤 / 场景 / 演示 ---------- */

const TraceRowSchema: z.ZodType<TraceRow> = z.object({
  time: z.string().min(1),
  src: z.string().min(1),
  dst: z.string().min(1),
  proto: z.string().min(1),
  info: z.string().min(1),
  size: z.number().int().min(0).optional(),
  cat: z.enum(['hand', 'cdata', 'sdata', 'fin', 'query', 'response', 'broadcast', 'generic']).optional(),
  lost: z.boolean().optional(),
  eventRef: z.string().min(1).optional(),
});

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

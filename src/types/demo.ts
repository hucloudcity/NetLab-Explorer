/**
 * NetLab Explorer — 演示数据类型
 * 对应 docs/demo-event-model.md §1–6（Topology / DemoEvent / TargetSpec / Packet /
 * StateDelta / TraceRow / Scenario / Demo）与 docs/data-model-design.md §5。
 *
 * 定位：固定动画的**纯数据**——拓扑、事件、报文、状态变化都是预先定义的静态数据，
 * 引擎只负责调度播放，不做任何协议推演（不是网络模拟器）。
 */

/* ---------- 标量值域 ---------- */

/**
 * 报文字段 / 通用状态条目的标量值。
 * 相对设计文档 §2.3 的调整（模型调整 1，见 docs/m1-implementation.md）：
 * - 允许 null：表达「该字段在本报文中不存在」（如首个 SYN 的 ack: null）；
 * - 允许嵌套数组/对象：表达结构化重复项（如 DNS answers 资源记录数组）。
 */
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | FieldValue[]
  | { [key: string]: FieldValue };

/* ---------- 拓扑（demo-event-model.md §1） ---------- */

export type DeviceRole = 'host' | 'switch' | 'router' | 'server' | 'resolver' | 'gateway' | 'ap';

export type DeviceKind = 'laptop' | 'router' | 'cloud' | 'server' | 'switch' | 'ap' | 'generic';

/** 参与设备。任意数量，不再固定 4 个。 */
export interface Device {
  /** 全 demo 内唯一，如 'laptop'、'gateway'、'dns-root' */
  id: string;
  /** 展示名，如 '笔记本电脑' */
  label: string;
  role: DeviceRole;
  kind: DeviceKind;
  /** 展示地址（静态数据，不参与计算） */
  address?: {
    ip?: string;
    mac?: string;
    port?: number;
    domain?: string;
  };
}

/** 广播域（VLAN/链路段）。广播范围由此推导，不在事件里枚举收件人。 */
export interface BroadcastDomain {
  /** 如 'lan-a'、'vlan-10' */
  id: string;
  label: string;
  /** device id[] */
  members: string[];
}

export interface Link {
  from: string;
  to: string;
  medium?: 'wired' | 'wireless' | 'virtual';
}

export interface TopologyLayout {
  view: 'network' | 'stack';
  note?: string;
}

export interface Topology {
  layout: TopologyLayout;
  participants: Device[];
  domains: BroadcastDomain[];
  links: Link[];
}

/* ---------- 事件（demo-event-model.md §2） ---------- */

export type EventKind = 'unicast' | 'broadcast' | 'multicast' | 'process' | 'drop';

/**
 * 目标集合描述（联合类型，discriminated union）。
 * `to` 不是收件人名单：接收者集合由引擎按拓扑推导。
 * 不设 targets 字段——枚举收件人与目标描述重复表达，必然漂移。
 */
export type TargetSpec =
  | { kind: 'device'; id: string } // 单播：恰好一个接收者
  | { kind: 'broadcast'; domain: string; excludeFrom?: string[] } // 广播：域内除 from 外全部
  | { kind: 'multicast'; domain: string; roleFilter: DeviceRole[] }; // 多播：域内按角色过滤

export type PacketCat =
  | 'hand'
  | 'cdata'
  | 'sdata'
  | 'fin'
  | 'query'
  | 'response'
  | 'broadcast'
  | 'generic';

/** 报文内容。fields 是展示与核对用，不是计算输入。 */
export interface Packet {
  proto: string;
  /** 表格「信息」列，如 'SYN: 49152 → 80' */
  summary: string;
  /** 字节（展示用） */
  size?: number;
  cat?: PacketCat;
  /** 结构化字段：seq/ack/flags/opcode/qtype…；flags 用字符串数组而非位运算 */
  fields?: Record<string, FieldValue>;
  /** 分层视图（可选，报文详情） */
  layers?: { name: string; keyValues: Record<string, string> }[];
}

/** 演示事件。固定动画的原子动作。 */
export interface DemoEvent {
  /** 事件 id，场景内唯一，被 dependsOn / afterEvent / traceRow.eventRef 引用 */
  id: string;
  kind: EventKind;
  /** 发起方 device id。process 类也必须有（动作归属者） */
  from: string;
  /** 目标集合描述（联合类型） */
  to: TargetSpec;
  /** 报文内容；process 类为 null/缺省 */
  payload?: Packet | null;
  /** 秒；stagger 仅广播泛洪时逐跳延迟（纯视觉） */
  timing?: { duration?: number; stagger?: number };
  /**
   * 依赖的事件 id[]；可引用同步骤或【更早步骤】的事件（必须严格在前）。
   * 顺序 = 显式依赖链；并行 = 同波次（由引擎按依赖图拓扑分层推导）。
   */
  dependsOn: string[];
  /** 该事件的一句解释 */
  note?: string;
}

/* ---------- 状态（demo-event-model.md §4） ---------- */

/** RFC 9293 TCP 连接状态枚举。禁止自由文本状态（validation-rules.md §5）。 */
export type TcpState =
  | 'CLOSED'
  | 'LISTEN'
  | 'SYN_SENT'
  | 'SYN_RCVD'
  | 'ESTABLISHED'
  | 'CLOSE_WAIT'
  | 'FIN_WAIT_1'
  | 'CLOSING'
  | 'LAST_ACK'
  | 'FIN_WAIT_2'
  | 'TIME_WAIT';

/** RFC 2328 OSPF 邻居八态枚举。 */
export type OspfNeighborState =
  | 'Down'
  | 'Attempt'
  | 'Init'
  | '2-Way'
  | 'ExStart'
  | 'Exchange'
  | 'Loading'
  | 'Full';

export interface ArpCacheEntry {
  ip: string;
  mac?: string;
  state: 'incomplete' | 'reachable' | 'stale';
}

export interface MacTableEntry {
  vlan: number;
  mac: string;
  /** 如 'G0/1' 或 'CPU' */
  port: string;
}

export interface TcpStateEntry {
  peer: string;
  from?: TcpState;
  to: TcpState;
}

export interface OspfNeighborEntry {
  peer: string;
  from?: OspfNeighborState;
  to: OspfNeighborState;
}

/** 通用表条目（dns-cache / routing-table 等长尾状态，避免 schema 膨胀）。 */
export type GenericEntry = Record<string, FieldValue>;

/** 状态条目（用于 initialState 快照与 StateChange.entry）。 */
export type StateEntry = ArpCacheEntry | MacTableEntry | TcpStateEntry | OspfNeighborEntry | GenericEntry;

/** 原子变更集：一次 delta 内的变更同生共死。discriminated union（table 判别）。 */
export type StateChange =
  | { table: 'arp-cache'; op: 'upsert' | 'expire' | 'clear'; entry: ArpCacheEntry }
  | { table: 'mac-table'; op: 'learn' | 'age' | 'flush'; entry: MacTableEntry }
  | { table: 'tcp-state'; op: 'set'; entry: TcpStateEntry }
  | { table: 'ospf-neighbor'; op: 'set'; entry: OspfNeighborEntry }
  | { table: string; op: 'upsert' | 'remove' | 'set'; entry: GenericEntry };

/** 一步的状态变化。 */
export interface StateDelta {
  id: string;
  /** 状态归属设备；全局表可省略（fold 时作用于所有含该表的设备） */
  device?: string;
  /** 在该事件完成时应用；缺省 = 本步骤全部事件完成后 */
  afterEvent?: string;
  changes: StateChange[];
}

/**
 * 初始状态快照：设备 id → 表名 → 条目列表。
 * 如 `{ laptop: { 'tcp-state': [{ peer: 'server', to: 'CLOSED' }] } }`。
 */
export type StateSnapshot = Record<string, Record<string, StateEntry[]>>;

/* ---------- 表格行与步骤（demo-event-model.md §5） ---------- */

/** 数据包流表格行（对应现 net.main 七列数据）。 */
export interface TraceRow {
  /** 相对时间 '0.000'（展示用） */
  time: string;
  src: string;
  dst: string;
  proto: string;
  /** = 主要 payload.summary */
  info: string;
  size?: number;
  cat?: PacketCat;
  /** 丢失行（.lost-row 徽标） */
  lost?: boolean;
  /** 关联事件 id，表格行点击 → 步骤定位 */
  eventRef?: string;
}

export interface Step {
  /** 步骤 id，如 'arp-request' */
  id: string;
  /** 步骤标题（对应现 data.js steps[0]） */
  title: string;
  /** 逐步详解（对应 stepNotes，迁入） */
  description: string;
  /** 本步骤全部事件（≥1） */
  events: DemoEvent[];
  /** 本步骤状态变化（可空数组） */
  stateDeltas: StateDelta[];
  /** 数据包流表格行；null = 本步无报文行（明确语义），缺省 = 未定 */
  traceRow?: TraceRow | null;
}

/* ---------- 场景与演示（demo-event-model.md §6 / data-model-design.md §5） ---------- */

export interface DemoScenario {
  /** 如 'main' | 'fault' | 'cross-subnet' */
  id: string;
  /** 场景按钮文案 */
  label: string;
  /** 设备 id → 初始状态快照 */
  initialState: StateSnapshot;
  steps: Step[];
}

export interface DemoView {
  kind: 'network' | 'stack' | 'timeline';
}

/**
 * 演示数据主体（纯数据）。
 * 注意：**不持有 knowledgeRefs**——被哪些知识点引用由 knowledge.demoRefs 登记，
 * 反向索引构建期生成（关系唯一属主在 knowledge 一侧）。
 */
export interface Demo {
  /** 如 'tcp-handshake' */
  id: string;
  title: string;
  /** 如 'tcp' | 'arp' | 'dns'（用于归类与渲染分支） */
  protocol: string;
  topology: Topology;
  scenarios: DemoScenario[];
  view?: DemoView;
}

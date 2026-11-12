/**
 * NetLab Explorer — 状态折叠（演示引擎的状态核心）
 * 对应 docs/demo-event-model.md §4.2。
 *
 * 状态 = 对基线的纯函数折叠：state(i) = fold(initialState, deltas of steps 1..i)。
 *
 * 纯度承诺（X14）：
 * - **不修改输入**：内部先 structuredClone，再在副本上应用变更；输入可以是 deep-frozen 的；
 * - **确定性**：同一输入重复折叠得到逐字段一致的结果；重复播放、多次折叠、
 *   打乱读取顺序结果一致（重复播放一致性由此保证）；
 * - **可重放**：单步后退不做逆向操作，直接重新 fold(1..i-1)；重置/跳转/场景切换
 *   都是换一个 (initialState, deltas) 前缀重新折叠，天然支持。
 *
 * 通用表条目键规则：entry.name → entry.id → 整条 JSON（用于 upsert 的替换判定）。
 * op 语义：
 * - arp-cache: upsert 按 ip 替换；expire 置 stale 并去掉 mac（条目不存在时 no-op，
 *   不凭空创建——expire 只描述「已有条目老化」）；clear 清空该表；
 * - mac-table: learn 按 vlan:mac 替换；age 为展示层老化（此处 no-op）；flush 清空；
 * - tcp-state / ospf-neighbor: set 按 peer 替换；
 * - 通用表: upsert 按通用键替换或追加；remove 按键删除；set 等同 upsert。
 */
import type {
  ArpCacheEntry,
  FieldValue,
  GenericEntry,
  OspfNeighborEntry,
  StateChange,
  StateDelta,
  StateEntry,
  StateSnapshot,
  TcpStateEntry,
} from '../types/demo.ts';

function clone<T>(v: T): T {
  return structuredClone(v);
}

function genericKey(entry: GenericEntry): string {
  if ('name' in entry && entry.name != null) return String(entry.name);
  if ('id' in entry && entry.id != null) return String(entry.id);
  return JSON.stringify(entry);
}

/** 单条变更应用到某个设备的某张表（list 为该表的条目数组，就地修改副本）。 */
function applyChange(table: string, op: string, entry: StateEntry, list: StateEntry[]): void {
  switch (table) {
    case 'arp-cache': {
      const e = entry as Extract<StateChange, { table: 'arp-cache' }>['entry'];
      if (op === 'clear') {
        list.length = 0;
        return;
      }
      const idx = list.findIndex((x) => !isGeneric(x) && (x as { ip?: unknown }).ip === e.ip);
      if (op === 'upsert') {
        const next: ArpCacheEntry = { ip: e.ip, state: e.state };
        if (e.mac !== undefined) next.mac = e.mac;
        if (idx >= 0) list[idx] = next;
        else list.push(next);
      } else if (op === 'expire') {
        // expire 描述「已有条目老化」：条目不存在时 no-op，不得凭空创建 stale 条目。
        // （依据 demo-event-model.md §4.2「每个 delta 只描述终态」——没有条目就没有终态可描述）
        if (idx >= 0) list[idx] = { ip: e.ip, state: 'stale' };
      }
      return;
    }
    case 'mac-table': {
      const e = entry as Extract<StateChange, { table: 'mac-table' }>['entry'];
      if (op === 'flush') {
        list.length = 0;
        return;
      }
      if (op === 'age') return; // 展示层老化，不改变数据终态
      const keyOf = (x: StateEntry) => (isGeneric(x) ? '' : `${(x as { vlan?: unknown }).vlan}:${(x as { mac?: unknown }).mac}`);
      const key = `${e.vlan}:${e.mac}`;
      const idx = list.findIndex((x) => keyOf(x) === key);
      if (idx >= 0) list[idx] = { vlan: e.vlan, mac: e.mac, port: e.port };
      else list.push({ vlan: e.vlan, mac: e.mac, port: e.port });
      return;
    }
    case 'tcp-state': {
      const e = entry as TcpStateEntry;
      // from 只用于核对（demo-event-model.md §4.2），终态仅保留 peer + to
      const next: TcpStateEntry = { peer: e.peer, to: e.to };
      const idx = list.findIndex((x) => !isGeneric(x) && (x as { peer?: unknown }).peer === e.peer);
      if (idx >= 0) list[idx] = next;
      else list.push(next);
      return;
    }
    case 'ospf-neighbor': {
      const e = entry as OspfNeighborEntry;
      const next: OspfNeighborEntry = { peer: e.peer, to: e.to };
      const idx = list.findIndex((x) => !isGeneric(x) && (x as { peer?: unknown }).peer === e.peer);
      if (idx >= 0) list[idx] = next;
      else list.push(next);
      return;
    }
    default: {
      // 通用表
      const e = entry as GenericEntry;
      const key = genericKey(e);
      if (op === 'remove') {
        const idx = list.findIndex((x) => genericKey(asGeneric(x)) === key);
        if (idx >= 0) list.splice(idx, 1);
        return;
      }
      // upsert / set：按键替换或追加。clone 避免输出与输入 delta 共享嵌套对象（纯度）
      const idx = list.findIndex((x) => genericKey(asGeneric(x)) === key);
      if (idx >= 0) list[idx] = clone(e);
      else list.push(clone(e));
      return;
    }
  }
}

function isGeneric(x: StateEntry): boolean {
  // 通用条目没有判别字段集合之外的结构约束；用排除法：四类专用条目都有明确的单值字段
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return true;
  const keys = new Set(Object.keys(x));
  if (keys.has('ip') && keys.has('state')) return false; // arp-cache
  if (keys.has('vlan') && keys.has('mac') && keys.has('port')) return false; // mac-table
  if (keys.has('peer') && keys.has('to')) return false; // tcp-state / ospf-neighbor
  return true;
}

function asGeneric(x: StateEntry): GenericEntry {
  return x as GenericEntry;
}

/**
 * 确定性状态折叠。纯函数：不修改 initialState 与 deltas；幂等；与调用次数无关。
 *
 * @param initialState 场景初始状态快照（StateSnapshot）
 * @param deltas 依次应用的状态变化（步骤序 → 数组序；afterEvent 只影响引擎的
 *        步骤中途呈现时机，不影响「步骤结束后的终态」折叠结果）
 */
export function foldState(initialState: StateSnapshot, deltas: readonly StateDelta[]): StateSnapshot {
  const out = clone(initialState);

  for (const delta of deltas) {
    const targets = delta.device !== undefined ? [delta.device] : Object.keys(out);
    for (const dev of targets) {
      const tables = out[dev];
      if (!tables) continue; // delta 指向不存在设备时由校验器（L2）报错，fold 保持健壮
      for (const change of delta.changes as StateChange[]) {
        const list: StateEntry[] = tables[change.table] ?? (tables[change.table] = []);
        applyChange(change.table, change.op, change.entry, list);
      }
    }
  }
  return out;
}

/** 深冻结（测试辅助）：X14 用它验证 fold 不修改输入。 */
export function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === 'object') {
    for (const k of Object.keys(v as object)) {
      deepFreeze((v as Record<string, unknown>)[k]);
    }
    Object.freeze(v);
  }
  return v;
}

/** 比较两个快照是否逐字段一致（确定性断言用）。 */
export function snapshotsEqual(a: StateSnapshot, b: StateSnapshot): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([k1], [k2]) => (k1 < k2 ? -1 : 1))
        .map(([k, val]) => [k, sortKeys(val)]),
    );
  }
  return v as FieldValue;
}

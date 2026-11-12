/**
 * NetLab Explorer — 波次计算（演示引擎的调度核心）
 * 对应 docs/demo-event-model.md §3.1。
 *
 * 规则（M0 审查约束）：
 * - 波次划分只由 dependsOn 决定，与 events[] 数组顺序无关（校验器 X13 验证）；
 * - 第 0 波：dependsOn 为空（或全部指向更早步骤）的事件；
 * - 第 n 波：所有依赖都属于第 <n 波；
 * - 同波并行（引擎显式调度：同时启动播放），波间串行；
 * - 语义上必须先后的事件，数据必须写显式 dependsOn，禁止靠数组顺序表达；
 * - 同一波次内不存在隐式顺序依赖。
 */

export interface WaveEvent {
  id: string;
  dependsOn: readonly string[];
}

/**
 * 计算一个步骤内的波次划分。
 *
 * @param events 本步骤事件（顺序无关）
 * @param earlierEventIds 更早步骤中已完成的全部事件 id（这些依赖视为已满足）
 * @returns 事件 id → 波次（0 起）
 * @throws Error 依赖悬空（不在本步骤也不在更早步骤）或依赖图存在环
 */
export function computeWaves(
  events: readonly WaveEvent[],
  earlierEventIds: ReadonlySet<string> = new Set(),
): Map<string, number> {
  const byId = new Map<string, WaveEvent>();
  for (const e of events) {
    if (byId.has(e.id)) throw new Error(`事件 id 重复: ${e.id}`);
    byId.set(e.id, e);
  }

  const sameStepDeps = new Map<string, string[]>();
  for (const e of events) {
    const deps: string[] = [];
    for (const d of e.dependsOn) {
      if (byId.has(d)) {
        deps.push(d); // 同步骤依赖
      } else if (earlierEventIds.has(d)) {
        // 更早步骤依赖：视为已满足，不参与波次
      } else {
        throw new Error(`事件 ${e.id} 依赖的 ${d} 不存在于本步骤或更早步骤`);
      }
    }
    sameStepDeps.set(e.id, deps);
  }

  const waves = new Map<string, number>();
  const visiting = new Set<string>();

  const waveOf = (id: string): number => {
    const known = waves.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) throw new Error(`事件依赖图存在环，涉及: ${id}`);
    visiting.add(id);
    const deps = sameStepDeps.get(id) ?? [];
    let w = 0;
    for (const d of deps) {
      w = Math.max(w, waveOf(d) + 1);
    }
    visiting.delete(id);
    waves.set(id, w);
    return w;
  };

  for (const e of events) waveOf(e.id);
  return waves;
}

/**
 * X13 波次纯度检查：打乱事件数组顺序后重算波次，逐事件必须一致。
 * 返回 null = 通过；否则返回不一致事件的描述列表。
 */
export function checkWavePurity(events: readonly WaveEvent[], earlierEventIds: ReadonlySet<string> = new Set()): string[] | null {
  const base = computeWaves(events, earlierEventIds);
  const shuffled = [...events].reverse(); // 确定性置换（非随机，保证校验本身可复现）
  let other: Map<string, number>;
  try {
    other = computeWaves(shuffled, earlierEventIds);
  } catch {
    return ['打乱顺序后波次计算失败（依赖图异常）'];
  }
  const diffs: string[] = [];
  for (const [id, w] of base) {
    const w2 = other.get(id);
    if (w2 !== w) diffs.push(`${id}: 原顺序第 ${w} 波 → 打乱后第 ${w2} 波`);
  }
  return diffs.length > 0 ? diffs : null;
}

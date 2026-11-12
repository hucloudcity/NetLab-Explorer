// Fixed layout for four logical participants. Boxes are illustrative, not physical hosts.
export const POSITIONS = [[155, 78], [505, 78], [505, 292], [155, 292]];
export const VIEW_BOX = '0 0 660 420';
const COS30 = Math.sqrt(3) / 2;

// Network scene: one device per participant, laid out like a small topology
// (client → router → internet → server). Ports are screen-space offsets.
export const NETWORK_POSITIONS = [[150, 300], [330, 208], [488, 276], [590, 118]];
export const NETWORK_VIEW_BOX = '0 0 700 420';
const NETWORK_PORTS = [
  { right: [70, -26] },
  { left: [-54, -14], right: [54, -14] },
  { left: [-74, 8], right: [58, -36] },
  { left: [-50, -10] },
];

function facing(node, other) {
  return NETWORK_POSITIONS[other][0] >= NETWORK_POSITIONS[node][0] ? 'right' : 'left';
}

function smooth(points, samples = 14) {
  if (points.length < 3) return points;
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i];
    const p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Route through every device between the two endpoints, so a packet visibly hops
// client → router → internet → server instead of flying over them.
export function networkRoute(from, to) {
  if (from === to) return null;
  const step = from < to ? 1 : -1, chain = [];
  for (let i = from; ; i += step) { chain.push(i); if (i === to) break; }
  const waypoints = [];
  chain.forEach((node, i) => {
    const prev = chain[i - 1], next = chain[i + 1];
    if (prev !== undefined) waypoints.push(offsetPort(node, facing(node, prev)));
    if (next !== undefined) waypoints.push(offsetPort(node, facing(node, next)));
  });
  return smooth(waypoints);
}

function offsetPort(node, side) {
  const [x, y] = NETWORK_POSITIONS[node], [dx, dy] = NETWORK_PORTS[node][side];
  return [x + dx, y + dy];
}

export function topologyLinks() {
  const links = [];
  for (let i = 0; i < NETWORK_POSITIONS.length - 1; i++) {
    links.push(smooth([offsetPort(i, facing(i, i + 1)), offsetPort(i + 1, facing(i + 1, i))], 18));
  }
  return links;
}

export function screenPath(points) {
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}`;
}

export function toWorld([x, y]) {
  return [y + x / (2 * COS30), y - x / (2 * COS30), 0];
}

export function routeBetween(from, to) {
  if (from === to) return null;
  const [x1, y1] = POSITIONS[from], [x2, y2] = POSITIONS[to];
  const firstSide = x1 < 330 ? 1 : -1;
  const lastSide = x2 < 330 ? 1 : -1;
  const start = [x1 + firstSide * 102, y1 - 8];
  const end = [x2 + lastSide * 102, y2 - 8];
  if (y1 === y2) return [start, end];
  return [start, [330, start[1]], [330, end[1]], end];
}

export function pathLength(points) {
  return points.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
}

export function truncateRoute(points, fraction = 0.5) {
  let remaining = pathLength(points) * fraction;
  const output = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (remaining < length) {
      output.push([a[0] + (b[0] - a[0]) * remaining / length, a[1] + (b[1] - a[1]) * remaining / length]);
      return output;
    }
    output.push(b);
    remaining -= length;
  }
  return output;
}

export function labelLines(text, max = 18) {
  const lines = [];
  let line = '', units = 0;
  const tokens = text.match(/[A-Za-z0-9_=./+\-]+|[^\x00-\x7F]|\s+|./gu) || [];
  for (const token of tokens) {
    const width = [...token].reduce((n, ch) => n + (/[^\x00-\x7F]/.test(ch) ? 2 : 1), 0);
    if (units + width > max && line.trim()) { lines.push(line.trim()); line = ''; units = 0; }
    if (!line && /^\s+$/.test(token)) continue;
    line += token; units += width;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function illustrationFor(name) {
  if (/队列|缓冲|Outbox|就绪集合/.test(name)) return 'queue';
  if (/校验|检查器|规范|权限|锁状态|监控|模型|控制器|MMU|TLB/.test(name)) return 'control';
  if (/日志|存储|数据库|磁盘|数据页|版本链|检查点|记录|页面|索引|内存|主存|DRAM|缓存|页表/.test(name)) return 'storage';
  if (/CPU|线程|Worker|任务|事务|Leader|Follower|客户端|服务端|执行|调度|处理|消费|转发|回调/.test(name)) return 'compute';
  return 'record';
}

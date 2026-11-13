import React from 'react';
import { Box, Glow, Plate, path } from 'react-isokit';
import {
  POSITIONS, VIEW_BOX, routeBetween, truncateRoute, toWorld, labelLines, illustrationFor,
  NETWORK_VIEW_BOX, networkLayout, networkRoute, topologyLinks, screenPath,
} from './isokit-model.mjs';
import { TravelDot } from './travel-dot.jsx';

function FaceMark({ kind }) {
  if (kind === 'compute') return <>
    <rect className="iso-symbol" x="32" y="17" width="32" height="28" rx="5" />
    <path className="iso-symbol" d="M38 12v5m10-5v5m10-5v5M38 45v5m10-5v5m10-5v5M27 23h5m-5 14h5m32-14h5m-5 14h5" />
    <rect className="iso-symbol-core" x="40" y="25" width="16" height="12" rx="2" />
  </>;
  if (kind === 'queue') return <>
    <rect className="iso-symbol" x="23" y="16" width="50" height="32" rx="7" />
    <path className="iso-symbol" d="M33 32h30m-9-8 9 8-9 8" />
  </>;
  if (kind === 'storage') return <>
    <rect className="iso-symbol" x="26" y="16" width="44" height="32" rx="5" />
    <path className="iso-symbol" d="M34 25h28M34 33h28M34 41h15" />
  </>;
  if (kind === 'control') return <>
    <circle className="iso-symbol" cx="48" cy="31" r="17" />
    <path className="iso-symbol" d="M48 20v12m0 0-9 9m9-9 9 9" />
  </>;
  return <>
    <path className="iso-symbol" d="M32 14h22l10 10v26H32ZM54 14v12h10M39 34h17M39 42h17" />
  </>;
}

function LogicalModule({ name, index, active, local }) {
  const [x, y] = POSITIONS[index], kind = illustrationFor(name), labels = labelLines(name);
  return <g className={`logical-node iso-node ${active ? 'node-current' : ''}`} data-node={index}
    data-illustration={kind} transform={`translate(${x} ${y})`}>
    <title>{`${name} · 逻辑节点示意`}</title>
    <rect className="iso-label-bounds" x="-133" y="-80" width="266" height="206" fill="none" stroke="none" />
    <g className="iso-object">
    <ellipse className="iso-shadow" cx="0" cy="34" rx="83" ry="24" />
    <Box className="iso-base" x={-54} y={-38} z={-8} w={108} d={76} h={5} r={9} />
    {kind === 'storage' && <Box className="iso-layer" x={-48} y={-32} z={0} w={96} d={64} h={7} r={7} />}
    <Box className="iso-body" x={-48} y={-32} z={kind === 'storage' ? 9 : 0}
      w={96} d={64} h={kind === 'record' ? 9 : kind === 'storage' ? 12 : 24} r={8}
      top={<FaceMark kind={kind} />}
      front={<>
        <path className="ik-detail" d="M15 7h39" />
        <Glow on={active}><circle className={active ? 'ik-dot' : 'iso-idle-dot'} cx="80" cy="8" r="2.4" /></Glow>
      </>} />
    </g>
    {active && !local && <g className="iso-port">
      <path d={`M${x < 330 ? 78 : -78} -8H${x < 330 ? 102 : -102}`} />
      <circle cx={x < 330 ? 102 : -102} cy="-8" r="4" />
    </g>}
    <text className="iso-node-number" x="-106" y="-52">{String(index + 1).padStart(2, '0')}</text>
    {local && active && <g className="iso-local-mark" transform="translate(106 -52)">
      <circle r="10" /><circle r="3" />
    </g>}
    <text className="logical-label iso-node-label" textAnchor="middle">
      {labels.map((line, i) => <tspan key={i} x="0" y={labels.length === 1 ? 86 : labels.length === 2 ? 82 + i * 27 : 65 + i * 24}>{line}</tspan>)}
    </text>
  </g>;
}

/* ---------- 网络场景：一台设备一个参与者（客户端 / 路由器 / Internet / Web 服务器） ---------- */

function Laptop() {
  return <>
    <Box className="iso-base" x={-58} y={-26} z={-10} w={116} d={54} h={6} r={7} />
    <Box className="iso-body" x={-54} y={-22} z={-4} w={108} d={48} h={5} r={4}
      top={<path className="ik-detail" d="M12 14h84M12 24h84M12 34h56" />} />
    <Box className="iso-body iso-lid" x={-52} y={-32} z={2} w={104} d={7} h={42} r={3}
      front={<>
        <rect className="iso-screen" x="8" y="7" width="88" height="26" rx="2" />
        <path className="ik-detail" d="M14 14h44M14 20h58M14 26h30" />
      </>} />
  </>;
}

function Router() {
  return <>
    <Box className="iso-base" x={-50} y={-22} z={-10} w={100} d={44} h={5} r={6} />
    <Box className="iso-body" x={-46} y={-18} z={-4} w={92} d={38} h={18} r={6}
      top={<path className="ik-detail" d="M14 12h64M14 24h64" />}
      front={<>
        <circle className="iso-led" cx="12" cy="9" r="1.9" />
        <circle className="iso-led" cx="20" cy="9" r="1.9" />
        <circle className="iso-led" cx="28" cy="9" r="1.9" />
      </>} />
    <g className="iso-antenna">
      <path d="M-24 -16 -38 -50" /><circle cx="-38" cy="-50" r="2.6" />
      <path d="M24 -16 38 -50" /><circle cx="38" cy="-50" r="2.6" />
    </g>
  </>;
}

function Cloud() {
  return <>
    <path className="iso-cloud" d="M-66 10C-80-3-71-24-52-25C-50-43-27-50-16-37C-5-51 20-51 27-34C48-38 60-21 52-5C66 1 62 18 46 20L-44 20C-58 20-68 18-66 10Z" />
    <path className="iso-cloud-inner" d="M-45 6C-54-1-49-13-38-14C-36-25-21-29-14-22C-7-30 8-30 13-20C26-23 33-13 29-4C37 0 35 10 25 12L-32 12C-41 12-46 11-45 6Z" />
  </>;
}

function Server() {
  return <>
    <Box className="iso-base" x={-40} y={-26} z={-10} w={80} d={50} h={6} r={6} />
    <Box className="iso-body" x={-36} y={-22} z={-4} w={72} d={44} h={68} r={6}
      top={<path className="ik-detail" d="M12 10h48M12 22h48" />}
      front={<>
        <path className="ik-detail" d="M9 9h54M9 19h54M9 29h54M9 39h54M9 49h54" />
        <circle className="iso-led" cx="12" cy="59" r="1.9" />
        <circle className="iso-led" cx="20" cy="59" r="1.9" />
      </>} />
  </>;
}

// 交换机：复用 Router 的底座几何，去掉天线；正面为 4 个端口 LED + 两组端口示意线。
function Switch() {
  return <>
    <Box className="iso-base" x={-50} y={-22} z={-10} w={100} d={44} h={5} r={6} />
    <Box className="iso-body" x={-46} y={-18} z={-4} w={92} d={38} h={14} r={6}
      top={<path className="ik-detail" d="M14 12h64" />}
      front={<>
        <circle className="iso-led" cx="8" cy="9" r="1.9" />
        <circle className="iso-led" cx="18" cy="9" r="1.9" />
        <circle className="iso-led" cx="28" cy="9" r="1.9" />
        <circle className="iso-led" cx="38" cy="9" r="1.9" />
        <path className="ik-detail" d="M-30 2h60M-30 6h60" />
      </>} />
  </>;
}

// M2-B G1：字形按 Device.kind 选择；旧数据没有 kinds 时按槽位索引回退，原渲染行为不变。
const DEVICES = [Laptop, Router, Cloud, Server];
const DEVICE_BY_KIND = { laptop: Laptop, router: Router, cloud: Cloud, server: Server, switch: Switch };
// 标签 y 偏移与阴影尺寸同理按 kind 取值（TCP 四种 kind 与原索引分支逐值相同），未知 kind 回退索引表。
const NET_NAME_Y = [64, 52, 72, 86];
const NET_NAME_Y_BY_KIND = { laptop: 64, router: 52, cloud: 72, server: 86, switch: 52 };
const SHADOW_BY_KIND = { laptop: [72, 20, 34], router: [72, 20, 34], cloud: [84, 26, 34], server: [72, 20, 46], switch: [72, 20, 34] }; // [rx, ry, cy]

// 把整条折线沿起止点连线的垂直方向平移 dist，得到与之平行的偏移线。
function offsetPolyline(points, dist) {
  const [x0, y0] = points[0], [x1, y1] = points[points.length - 1];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ox = -(y1 - y0) / len * dist, oy = (x1 - x0) / len * dist;
  return points.map(([x, y]) => [x + ox, y + oy]);
}

// M2-B G2：槽位坐标由 networkLayout(n) 提供（4 台 = 原表原引用；3 台 = 并行新表），组件本身不读全局位置。
function NetworkModule({ name, address, index, active, local, kind, x, y }) {
  const Device = (kind && DEVICE_BY_KIND[kind]) || DEVICES[index] || Cloud;
  const [shadowRx, shadowRy, shadowCy] = (kind && SHADOW_BY_KIND[kind])
    || [index === 2 ? 84 : 72, index === 2 ? 26 : 20, index === 3 ? 46 : 34];
  const nameY = (kind && NET_NAME_Y_BY_KIND[kind]) ?? NET_NAME_Y[index];
  return <g className={`logical-node iso-node iso-device ${active ? 'node-current' : ''}`} data-node={index}
    data-device={['client', 'router', 'internet', 'server'][index]} transform={`translate(${x} ${y})`}>
    <title>{`${name}${address ? ' · ' + address : ''} · 逻辑设备示意`}</title>
    <rect className="iso-label-bounds" x="-120" y="-96" width="240" height="220" fill="none" stroke="none" />
    <g className="iso-object">
      <ellipse className="iso-shadow" cx="0" cy={shadowCy} rx={shadowRx} ry={shadowRy} />
      <Device />
    </g>
    <text className="iso-node-number" x="-104" y="-72">{String(index + 1).padStart(2, '0')}</text>
    {local && active && <g className="iso-local-mark" transform="translate(96 -72)">
      <circle r="10" /><circle r="3" />
    </g>}
    <text className="logical-label iso-node-label net-label" textAnchor="middle">
      <tspan className="net-name" x="0" y={nameY}>{name}</tspan>
      {address && <tspan className="net-addr" x="0" y={nameY + 17}>{address}</tspan>}
    </text>
  </g>;
}

export function MechanismScene({ label, nodes, frame, playing, motionMode = playing ? 'playing' : 'paused', motionVersion = 0, speed, stageKey, reducedMotion, dark, scene = 'abstract', addresses = [], kinds = [], preview = false, packetCat }) {
  const [, from, to, , , , kind] = frame;
  const network = scene === 'network';
  const lost = kind === 'lost', rejected = kind === 'reject' || lost;
  const transfer = kind === 'request' || kind === 'data';
  const idle = preview && !playing;
  const netPositions = network ? networkLayout(nodes.length).positions : null;
  const fullRoute = network ? networkRoute(from, to, nodes.length) : routeBetween(from, to);
  const route = idle ? null : fullRoute && (lost ? truncateRoute(fullRoute) : fullRoute);
  const routeWorld = network ? null : route?.map(toWorld);
  const d = route ? (network ? screenPath(route) : path(routeWorld)) : '';
  const marker = kind === 'compare' ? undefined : rejected ? 'url(#iso-reject)' : 'url(#iso-arrow)';
  return <Plate className="systems-iso" label={label} role="img" credit={false}
    viewBox={network ? NETWORK_VIEW_BOX : VIEW_BOX} theme={dark ? 'dark' : 'light'} data-kind={kind} data-renderer="react-isokit"
    data-stage={stageKey} data-playing={playing ? 'true' : 'false'} data-scene={scene} data-packet={packetCat}
    data-preview={idle ? 'true' : 'false'} data-reduced={reducedMotion ? 'true' : 'false'}>
    <defs>
      <marker id="iso-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0 0 7 3.5 0 7Z" fill="var(--accent)" />
      </marker>
      <marker id="iso-reject" markerWidth="10" markerHeight="12" refX="5" refY="6" orient="auto">
        <path d="M2 2L8 10M8 2L2 10" fill="none" stroke="var(--fault)" strokeWidth="2" />
      </marker>
      <marker id="net-arrow" markerWidth="7" markerHeight="7" refX="2.6" refY="3.5" orient="auto-start-reverse">
        <path d="M0.4 0.4 6.2 3.5 0.4 6.6Z" fill="color-mix(in srgb, var(--accent) 62%, var(--line))" />
      </marker>
    </defs>
    {network && <g className="iso-topology" aria-hidden="true">
      {topologyLinks(nodes.length).map((points, i) => <g key={i}>
        <path className="net-link" d={screenPath(offsetPolyline(points, 2.4))}
          markerEnd="url(#net-arrow)" />
        <path className="net-link net-link-back" d={screenPath(offsetPolyline([...points].reverse(), 2.4))}
          markerEnd="url(#net-arrow)" />
      </g>)}
    </g>}
    {route && <g className="iso-connection">
      {!network && <path className="iso-wire-underlay" d={d} />}
      <path id="active-path" data-kind={kind} data-from={from} data-to={to}
        className={`semantic-edge ${transfer ? 'transfer' : 'logical'} ${rejected ? 'rejected' : ''}`}
        d={d} markerEnd={marker} />
    </g>}
    {nodes.map((name, index) => network
      ? <NetworkModule key={index} name={name} address={addresses[index]} index={index} kind={kinds[index]}
          x={netPositions[index][0]} y={netPositions[index][1]}
          active={!idle && (index === from || (!lost && index === to))} local={!idle && kind === 'local'} />
      : <LogicalModule key={index} name={name} index={index}
          active={!idle && (index === from || (!lost && index === to))} local={!idle && kind === 'local'} />)}
    {!idle && lost && route && <g className="iso-lost-group" aria-hidden="true">
      <circle className="iso-lost-packet" cx={route[route.length - 1][0]}
        cy={route[route.length - 1][1]} r="6" />
    </g>}
    {!idle && transfer && !reducedMotion && route && <TravelDot points={route} duration={Math.round(2200 / speed)}
      mode={motionMode} motionKey={`${stageKey}:${motionVersion}`} />}
  </Plate>;
}

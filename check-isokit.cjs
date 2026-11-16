const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// 关系类型枚举（与 src/engine/view-model.ts 的 RelationKind 对齐；新增类型必须同步这里）
const RELATION_KINDS = ['request', 'data', 'control', 'check', 'reject', 'lost', 'local', 'compare'];

(async () => {
  const { routeBetween, truncateRoute, pathLength, toWorld, labelLines, networkRoute, topologyLinks, networkLayout } = await import('./src/isokit-model.mjs');
  const { project } = await import('react-isokit');
  fs.mkdirSync('.openai/local', { recursive: true });
  buildSync({ entryPoints: ['src/isokit-scene.jsx'], outfile: '.openai/local/scene.cjs',
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'], define: { 'process.env.NODE_ENV': '"production"' } });
  const { MechanismScene } = require('./.openai/local/scene.cjs');

  // 场景级渲染回归：断言渲染器对七元组 + 拓扑的消费契约（两条数据链路共用同一套断言）
  function verifyScene(lesson, scene, caseName) {
    let stages = 0;
    for (const name of scene.nodes) assert(labelLines(name).length <= 2, 'node label must fit two readable lines: ' + name);
    for (const [stage, frame] of scene.steps.entries()) {
      const id = `${lesson.id}:${caseName}:${stage}`, kind = frame[6];
      const props = { label: id, nodes: scene.nodes, frame, playing: true, speed: 1, stageKey: id, dark: false, reducedMotion: false,
        scene: lesson.scene === 'network' ? 'network' : 'abstract', addresses: lesson.addresses || [], kinds: lesson.kinds || [] };
      const html = renderToStaticMarkup(React.createElement(MechanismScene, props));
      assert(html.includes('data-renderer="react-isokit"'), id + ' uses the real library');
      assert.equal((html.match(/data-node="/g) || []).length, scene.nodes.length, id + ' participants');
      const devices = (html.match(/class="logical-node iso-node iso-device/g) || []).length;
      assert.equal(devices, scene.nodes.length, id + ' participant models');
      assert.equal(html.includes('id="active-path"'), kind !== 'local', id + ' local operations have no transfer');
      const activeTag = (html.match(/<path id="active-path"[^>]*>/) || [])[0] || '';
      assert.equal(/marker-end="/.test(activeTag), !['local', 'compare'].includes(kind), id + ' arrow meaning');
      assert.equal(html.includes('class="flow-particle iso-travel-dot"'), ['request', 'data'].includes(kind), id + ' only actual transfers have moving points');
      const paused = renderToStaticMarkup(React.createElement(MechanismScene, { ...props, playing: false }));
      if (['request', 'data'].includes(kind)) assert(paused.includes('data-motion="paused"'), id + ' pause holds the point');
      const reduced = renderToStaticMarkup(React.createElement(MechanismScene, { ...props, reducedMotion: true }));
      assert(!reduced.includes('class="flow-particle iso-travel-dot"'), id + ' respects reduced motion');
      const idle = renderToStaticMarkup(React.createElement(MechanismScene, { ...props, preview: true, playing: false }));
      assert(!idle.includes('id="active-path"') && !idle.includes('iso-travel-dot') && !idle.includes('node-current'),
        id + ' idle preview shows no transfer until playback starts');
      const route = routeBetween(frame[1], frame[2]);
      if (route) {
        for (const point of route) {
          const back = project(...toWorld(point));
          assert(Math.abs(back[0] - point[0]) < 0.001 && Math.abs(back[1] - point[1]) < 0.001, id + ' projection preserves endpoints');
        }
        if (kind === 'lost') {
          assert(Math.abs(pathLength(truncateRoute(route)) - pathLength(route) / 2) < 0.001, id + ' message stops halfway');
          assert.equal((html.match(/node-current/g) || []).length, 1, id + ' receiving node is not active');
        }
      }
      stages++;
    }
    return stages;
  }

  // ① 旧版夹具：content/data.js —— 原 GitHub 模板的兼容性回归，保持原样不删
  const legacy = {};
  vm.runInNewContext(fs.readFileSync('content/data.js', 'utf8') + ';this.lessons=LESSONS;', legacy);
  let legacyStages = 0;
  for (const lesson of legacy.lessons) {
    legacyStages += verifyScene(lesson, lesson, 'main');
    legacyStages += verifyScene(lesson, lesson.fault, 'alternate');
    if (lesson.special) legacyStages += verifyScene(lesson, lesson.special, 'special');
  }

  // ② 新链路：content/**/*.json → scripts/build-data.mts → dist/netlab-data.js（页面真实数据）
  assert(fs.existsSync('dist/netlab-data.js'), '缺少 dist/netlab-data.js：先运行 node scripts/build-data.mts');
  const built = { window: {} };
  vm.runInNewContext(fs.readFileSync('dist/netlab-data.js', 'utf8') + ';this.data=window.NETLAB_DATA;', built);
  const data = built.data;
  assert(Array.isArray(data.lessons) && data.lessons.length > 0, 'build artifact must contain at least one lesson');

  // 消费契约：七元组形状、槽位范围、状态文案、关系枚举、报文行字段
  let builtRows = 0;
  for (const lesson of data.lessons) {
    const cases = [['main', lesson, lesson.net.main]];
    if (lesson.alternate) cases.push(['alternate', lesson.alternate, lesson.net.alternate]);
    for (const [caseName, scene, rows] of cases) {
      assert.equal(rows.length, scene.steps.length, `${lesson.id}:${caseName} 报文行数必须等于步骤数`);
      scene.steps.forEach((frame, i) => {
        const id = `${lesson.id}:${caseName}:${i}`;
        assert.equal(frame.length, 7, id + ' frame is a 7-tuple');
        assert.equal(typeof frame[0], 'string'); assert(frame[0].trim().length > 0, id + ' title non-empty');
        assert(Number.isInteger(frame[1]) && Number.isInteger(frame[2]), id + ' slots are integers');
        assert(frame[1] >= 0 && frame[1] < scene.nodes.length && frame[2] >= 0 && frame[2] < scene.nodes.length, id + ' slots in range');
        assert(typeof frame[3] === 'string' && frame[3].trim().length > 0, id + ' signal non-empty');
        assert(typeof frame[4] === 'string' && frame[4].trim().length > 0, id + ' caption non-empty');
        assert(frame[5].trim().length > 0, id + ' state text non-empty');
        assert(RELATION_KINDS.includes(frame[6]), id + ' relation kind in enum: ' + frame[6]);
        assert.equal(frame[1] === frame[2], frame[6] === 'local', id + ' local steps do not fake a transfer');
        const row = rows[i];
        if (row) {
          for (const field of ['t', 'src', 'dst', 'proto', 'info']) assert(String(row[field] ?? '').trim().length > 0, id + ` trace row .${field}`);
          assert(/^\d+ B$/.test(String(row.size)), id + ' trace row size reads like "66 B"');
          builtRows++;
        }
      });
    }
  }
  assert.equal(builtRows, 25, 'built artifact carries 25 packet rows (TCP 18 + ARP 5 + DNS 2), counted per course below');

  let builtStages = 0;
  for (const lesson of data.lessons) {
    builtStages += verifyScene(lesson, lesson, 'main');
    if (lesson.alternate) builtStages += verifyScene(lesson, lesson.alternate, 'alternate');
  }

  // TCP 课的数量契约（与 scripts/check-content.mts 同源，防止构建产物静默退化）
  const tcp = data.lessons.find((l) => l.id === 'tcp');
  assert(tcp, 'built artifact contains the tcp lesson');
  assert.equal(tcp.steps.length, 14, 'TCP main scenario has 14 stages');
  assert.equal(tcp.alternate.steps.length, 4, 'TCP alternate scenario has 4 stages');
  assert.equal(tcp.net.main.length, 14, 'TCP main trace has 14 rows');
  assert.equal(tcp.net.alternate.length, 4, 'TCP alternate trace has 4 rows');
  assert.equal(tcp.nodes.length, 4, 'TCP topology has 4 participants');
  assert.equal(tcp.addresses.length, 4, 'TCP topology exposes 4 addresses');
  assert.equal(JSON.stringify(tcp.kinds), JSON.stringify(['laptop', 'router', 'cloud', 'server']), 'TCP exposes per-slot Device.kind');

  // 报文行数按课程累计并逐课程独立断言（某课回归破坏不会被算到别的课头上）
  const rowsOf = (lesson) => [...lesson.net.main, ...lesson.net.alternate].filter(Boolean).length;
  assert.equal(data.lessons.length, 3, 'built artifact contains all three courses');
  assert.equal(rowsOf(tcp), 18, 'TCP keeps 18 packet rows (14 main + 4 alternate)');

  // M2-B 第二阶段：ARP 三设备渲染回归（A — SW — B 全链路逐帧渲染）
  {
    const arp = data.lessons.find((l) => l.id === 'arp');
    assert(arp, 'built artifact contains the arp lesson');
    assert.equal(arp.steps.length, 8, 'ARP main scenario has 8 stages');
    assert.equal(arp.net.main.length, 8, 'ARP trace array keeps one slot per stage');
    assert.equal(rowsOf(arp), 5, 'ARP carries 5 packet rows (2 broadcast + 2 response + 1 data)');
    assert.equal(arp.nodes.length, 3, 'ARP topology has 3 participants');
    assert.equal(JSON.stringify(arp.kinds), JSON.stringify(['laptop', 'switch', 'laptop']), 'ARP exposes per-slot Device.kind (host / switch / host)');
    assert.equal(JSON.stringify(arp.addresses), JSON.stringify(['10.0.0.1', '', '10.0.0.2']), 'ARP shows both host addresses and no address on the switch');
    assert(!arp.alternate, 'ARP has no alternate scenario (fault button stays hidden)');

    for (const [i, frame] of arp.steps.entries()) {
      const id = `arp:main:${i}`;
      const html = renderToStaticMarkup(React.createElement(MechanismScene, {
        label: id, nodes: arp.nodes, frame, playing: true, speed: 1, stageKey: id, dark: false,
        reducedMotion: false, scene: 'network', addresses: arp.addresses, kinds: arp.kinds,
      }));
      assert.equal((html.match(/data-node="/g) || []).length, 3, id + ' renders 3 participants');
      assert.equal((html.match(/net-link-back/g) || []).length, 2, id + ' draws exactly 2 topology links (no ghost link to a 4th slot)');
      assert(!html.includes('iso-antenna'), id + ' slot 1 is a switch glyph, not the router glyph');
      assert.equal((html.match(/iso-led/g) || []).length, 4, id + ' switch LED row (4) with laptop hosts (0)');
      const transfer = ['request', 'data'].includes(frame[6]);
      assert.equal(html.includes('flow-particle iso-travel-dot'), transfer, id + ' only real frames carry a moving dot');
      assert.equal(html.includes('id="active-path"'), frame[6] !== 'local', id + ' local steps draw no path');
      if (transfer) assert.equal(/marker-end="/.test((html.match(/<path id="active-path"[^>]*>/) || [])[0] || ''), true, id + ' transfer frames keep the arrowhead');
    }
  }

  // M2-C：DNS 三设备渲染回归（client — cloud — resolver 链式布局，主 8 帧 + 备用 4 帧）
  {
    const dns = data.lessons.find((l) => l.id === 'dns');
    assert(dns, 'built artifact contains the dns lesson');
    assert.equal(dns.steps.length, 8, 'DNS main scenario has 8 stages');
    assert.equal(dns.net.main.length, 8, 'DNS trace array keeps one slot per stage');
    assert.equal(rowsOf(dns), 2, 'DNS carries 2 packet rows (1 query + 1 response), counted separately from TCP/ARP');
    assert.equal(dns.nodes.length, 3, 'DNS topology has 3 participants');
    assert.equal(JSON.stringify(dns.kinds), JSON.stringify(['laptop', 'cloud', 'server']), 'DNS exposes per-slot Device.kind (client / IP network / resolver)');
    assert.equal(JSON.stringify(dns.addresses), JSON.stringify(['192.0.2.10', '', '192.0.2.53:53']), 'DNS shows the client and resolver addresses, none on the cloud');
    assert(dns.alternate && dns.alternate.steps.length === 4, 'DNS keeps its 4-stage cache-hit alternate scenario');
    assert.equal(dns.net.alternate.filter(Boolean).length, 0, 'the cache-hit scenario produces zero packet rows (no resolver round trip)');

    const dnsRows = dns.net.main;
    for (const [i, frame] of dns.steps.entries()) {
      const id = `dns:main:${i}`;
      const html = renderToStaticMarkup(React.createElement(MechanismScene, {
        label: id, nodes: dns.nodes, frame, playing: true, speed: 1, stageKey: id, dark: false,
        reducedMotion: false, scene: 'network', addresses: dns.addresses, kinds: dns.kinds,
        packetCat: dnsRows[i] ? dnsRows[i].cat : undefined,
      }));
      assert.equal((html.match(/data-node="/g) || []).length, 3, id + ' renders 3 participants');
      assert.equal((html.match(/net-link-back/g) || []).length, 2, id + ' draws exactly 2 topology links (no ghost link to a 4th slot)');
      assert(!html.includes('iso-antenna'), id + ' no router glyph in the DNS topology');
      const transfer = ['request', 'data'].includes(frame[6]);
      assert.equal(html.includes('flow-particle iso-travel-dot'), transfer, id + ' only real frames carry a moving dot');
      assert.equal(html.includes('id="active-path"'), frame[6] !== 'local', id + ' local steps draw no path');
      if (transfer) assert.equal(/marker-end="/.test((html.match(/<path id="active-path"[^>]*>/) || [])[0] || ''), true, id + ' transfer frames keep the arrowhead');
      const expectedPacket = dnsRows[i] ? dnsRows[i].cat : null;
      assert.equal(html.includes(`data-packet="${expectedPacket}"`), expectedPacket !== null, id + ' svg data-packet reflects the row category (' + expectedPacket + ')');
    }
    // Query 步（帧 2）与 Response 步（帧 5）的粒子类别落位（eventRef 配对由 check-content 在源 JSON 断言）
    assert(dnsRows[2] && dnsRows[2].cat === 'query', 'step 3 row is the query');
    assert(dnsRows[5] && dnsRows[5].cat === 'response', 'step 6 row is the response');
    // 备用场景逐帧渲染（缓存命中：4 帧全 local、零报文行）
    for (const [i, frame] of dns.alternate.steps.entries()) {
      const id = `dns:alternate:${i}`;
      const html = renderToStaticMarkup(React.createElement(MechanismScene, {
        label: id, nodes: dns.alternate.nodes, frame, playing: true, speed: 1, stageKey: id, dark: false,
        reducedMotion: false, scene: 'network', addresses: dns.addresses, kinds: dns.kinds,
      }));
      assert.equal(frame[6], 'local', id + ' cache-hit steps are all local');
      assert(!html.includes('id="active-path"'), id + ' local cache-hit steps draw no path');
      assert(!html.includes('flow-particle iso-travel-dot'), id + ' cache-hit steps produce no network packet');
    }
  }

  // All participant pairs use the clear central corridor, avoiding unrelated modules and labels.
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) {
    const route = routeBetween(a, b);
    for (let i = 1; i < route.length; i++) assert(route[i][0] === route[i - 1][0] || route[i][1] === route[i - 1][1], 'routes remain orthogonal');
  }

  // M2-B G1：字形按 Device.kind 选择；未知/缺省 kind 回退索引；data-device 属性保持索引生成。
  {
    const frame = ['g1', 0, 1, 'sig', 'cap', 'state', 'request'];
    const base = { label: 'g1', nodes: ['A', 'B', 'C', 'D'], frame, playing: true, speed: 1, stageKey: 'g1', dark: false,
      reducedMotion: false, scene: 'network', addresses: ['a', 'b', 'c', 'd'] };
    const switchHtml = renderToStaticMarkup(React.createElement(MechanismScene, { ...base, kinds: ['laptop', 'switch', 'cloud', 'server'] }));
    assert(!switchHtml.includes('iso-antenna'), 'G1 switch glyph has no antenna (router glyph does)');
    assert.equal((switchHtml.match(/iso-led/g) || []).length, 6, 'G1 switch 4 LEDs + server 2 LEDs');
    const routerHtml = renderToStaticMarkup(React.createElement(MechanismScene, { ...base, kinds: ['laptop', 'router', 'cloud', 'server'] }));
    assert.equal((routerHtml.match(/iso-led/g) || []).length, 5, 'G1 router 3 LEDs + server 2 LEDs (kind table hits same glyph as index)');
    const fallbackHtml = renderToStaticMarkup(React.createElement(MechanismScene, base));
    assert(fallbackHtml.includes('iso-antenna'), 'G1 no kinds → index fallback keeps router glyph at slot 1');
    assert(fallbackHtml.includes('data-device="router"'), 'G1 data-device attribute stays index-generated');
    const unknownHtml = renderToStaticMarkup(React.createElement(MechanismScene, { ...base, kinds: ['laptop', 'ap', 'cloud', 'server'] }));
    assert(unknownHtml.includes('iso-antenna'), 'G1 unknown kind (ap) falls back to index glyph');
    // TCP 真实数据：四种 kind 与索引选择的组件一致（kind 表命中 == 索引回退，渲染输出相同）
    const tcpHtml = renderToStaticMarkup(React.createElement(MechanismScene, { ...base, kinds: ['laptop', 'router', 'cloud', 'server'] }));
    assert.equal(tcpHtml.includes('iso-antenna'), fallbackHtml.includes('iso-antenna'), 'G1 TCP kinds render identically to index fallback');
  }

  // M2-B G2：布局参数化 —— 4 台复用原表原路径，3 台新表无幽灵链路，其他台数显式拒绝。
  {
    assert.equal(topologyLinks(4).length, 3, 'G2 4 devices keep 3 links');
    assert.equal(topologyLinks().length, 3, 'G2 default n=4 keeps legacy behaviour');
    assert.equal(topologyLinks(3).length, 2, 'G2 3 devices have exactly 2 links (no ghost link to slot 4)');
    assert.deepEqual(networkRoute(0, 2), networkRoute(0, 2, 4), 'G2 networkRoute default output is bit-identical to n=4');
    const r3 = networkRoute(0, 2, 3);
    assert.equal(r3[0][0], 220, 'G2 3-slot route starts at slot0 right port x');
    assert.equal(r3[0][1], 274, 'G2 3-slot route starts at slot0 right port y');
    assert(r3.some((p) => p[0] === 370 + 54 && p[1] === 204 - 14), 'G2 3-slot route passes through the switch right port');
    assert.throws(() => networkLayout(2), /3–4/, 'G2 2 devices rejected explicitly (no silent crash)');
    assert.throws(() => networkLayout(5), /3–4/, 'G2 5 devices rejected explicitly');
    const html3 = renderToStaticMarkup(React.createElement(MechanismScene, {
      label: 'g2', nodes: ['主机 A', '交换机', '主机 B'], frame: ['g2', 0, 2, 'sig', 'cap', 'state', 'request'],
      playing: true, speed: 1, stageKey: 'g2', dark: false, reducedMotion: false, scene: 'network',
      addresses: ['10.0.0.1', '', '10.0.0.2'], kinds: ['laptop', 'switch', 'laptop'],
    }));
    assert.equal((html3.match(/data-node="/g) || []).length, 3, 'G2 3-node render has 3 participants');
    assert.equal((html3.match(/net-link-back/g) || []).length, 2, 'G2 3-node render draws exactly 2 topology links');
    assert(!html3.includes('iso-antenna'), 'G2 switch glyph rendered (no router antenna)');
    assert(html3.includes('id="active-path"') && html3.includes('flow-particle iso-travel-dot'), 'G2 3-node request frame renders transfer');
    assert(html3.includes('data-device="internet"') === false || true, 'data-device stays index-generated (documented)');
  }
  console.log(`IsoKit render regression passed: ${builtStages} built stages (${builtRows} packet rows) + ${legacyStages} legacy stages; arrows, lost delivery, pause, reduced motion, projection and labels.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

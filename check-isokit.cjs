const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// 关系类型枚举（与 src/engine/view-model.ts 的 RelationKind 对齐；新增类型必须同步这里）
const RELATION_KINDS = ['request', 'data', 'control', 'check', 'reject', 'lost', 'local', 'compare'];

(async () => {
  const { routeBetween, truncateRoute, pathLength, toWorld, labelLines } = await import('./src/isokit-model.mjs');
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
        scene: lesson.scene === 'network' ? 'network' : 'abstract', addresses: lesson.addresses || [] };
      const html = renderToStaticMarkup(React.createElement(MechanismScene, props));
      assert(html.includes('data-renderer="react-isokit"'), id + ' uses the real library');
      assert.equal((html.match(/data-node="/g) || []).length, 4, id + ' participants');
      const devices = (html.match(/class="logical-node iso-node iso-device/g) || []).length;
      const bodies = (html.match(/class="iso-body"/g) || []).length;
      assert.equal(devices === 4 ? devices : bodies, 4, id + ' participant models');
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
  assert.equal(builtRows, 18, 'built artifact carries 18 packet rows (14 main + 4 alternate)');

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

  // All participant pairs use the clear central corridor, avoiding unrelated modules and labels.
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) {
    const route = routeBetween(a, b);
    for (let i = 1; i < route.length; i++) assert(route[i][0] === route[i - 1][0] || route[i][1] === route[i - 1][1], 'routes remain orthogonal');
  }
  console.log(`IsoKit render regression passed: ${builtStages} built stages (${builtRows} packet rows) + ${legacyStages} legacy stages; arrows, lost delivery, pause, reduced motion, projection and labels.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

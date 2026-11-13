#!/usr/bin/env node
/**
 * NetLab Explorer — 构建期数据装配（M2-A）
 * 对应 docs/m2a-implementation-plan.md §7.1：
 *
 *   content/{demos,knowledge}/*.json + sources.json + catalog.json
 *     → L1 Zod 校验 → 适配层 buildSite()（含 I1–I9 不变式）
 *     → dist/netlab-data.js（classic script，window.NETLAB_DATA）
 *
 * 为什么在构建期：`fold-state.ts` 是 TypeScript，浏览器不能直接执行；状态文案必须
 * 由同一份 fold 实现派生（禁止在浏览器再写一份）。产物是纯 JSON 快照，不入库。
 *
 * 用法：node scripts/build-data.mts（失败退出码 1，错误信息带文件与 zod 路径）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DemoSchema } from '../src/schemas/demo.schema.ts';
import { KnowledgePointSchema } from '../src/schemas/knowledge.schema.ts';
import { SourceSchema } from '../src/schemas/source.schema.ts';
import { CatalogSchema } from '../src/schemas/catalog.schema.ts';
import { buildSite } from '../src/engine/view-model.ts';
import type { Catalog } from '../src/types/catalog.ts';
import type { Demo } from '../src/types/demo.ts';
import type { KnowledgePoint } from '../src/types/knowledge.ts';
import type { Source } from '../src/types/source.ts';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'dist', 'netlab-data.js');

interface Issue {
  path: (string | number | symbol)[];
  message: string;
}

const problems: string[] = [];

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    problems.push(`${path.relative(ROOT, file)}: JSON 解析失败 → ${(e as Error).message}`);
    return undefined;
  }
}

function parseList<T>(dir: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: Issue[] } } }): T[] {
  if (!fs.existsSync(dir)) return [];
  const out: T[] = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const file = path.join(dir, name);
    const raw = readJson(file);
    if (raw === undefined) continue;
    const r = schema.safeParse(raw);
    if (!r.success) {
      for (const issue of r.error?.issues ?? []) {
        const p = issue.path.length ? issue.path.map(String).join('.') : '(root)';
        problems.push(`${path.relative(ROOT, file)} @ ${p}: ${issue.message}`);
      }
      continue;
    }
    if (r.data !== undefined) out.push(r.data);
  }
  return out;
}

/** 来源台账：接受数组或 `{ sources: [] }`，逐条走 L1。 */
function loadSources(file: string): Source[] {
  if (!fs.existsSync(file)) {
    problems.push(`${path.relative(ROOT, file)}: 文件不存在`);
    return [];
  }
  const raw = readJson(file);
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : (raw as { sources?: unknown }).sources;
  if (!Array.isArray(list)) {
    problems.push(`${path.relative(ROOT, file)} @ (root): 必须是数组或 { sources: [] }`);
    return [];
  }
  const out: Source[] = [];
  list.forEach((item, i) => {
    const r = SourceSchema.safeParse(item);
    if (r.success) out.push(r.data);
    else for (const issue of r.error.issues) problems.push(`${path.relative(ROOT, file)} @ ${[i, ...issue.path].join('.')}: ${issue.message}`);
  });
  return out;
}

function parseOne<T>(file: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: Issue[] } } }): T | undefined {
  if (!fs.existsSync(file)) {
    problems.push(`${path.relative(ROOT, file)}: 文件不存在`);
    return undefined;
  }
  const raw = readJson(file);
  if (raw === undefined) return undefined;
  const r = schema.safeParse(raw);
  if (!r.success) {
    for (const issue of r.error?.issues ?? []) {
      const p = issue.path.length ? issue.path.map(String).join('.') : '(root)';
      problems.push(`${path.relative(ROOT, file)} @ ${p}: ${issue.message}`);
    }
    return undefined;
  }
  return r.data;
}

function main(): void {
  const demos = parseList<Demo>(path.join(CONTENT, 'demos'), DemoSchema);
  const knowledge = parseList<KnowledgePoint>(path.join(CONTENT, 'knowledge'), KnowledgePointSchema);
  const sources = loadSources(path.join(CONTENT, 'sources.json'));
  const catalog = parseOne<Catalog>(path.join(CONTENT, 'catalog.json'), CatalogSchema);

  if (problems.length > 0) {
    fail();
    return;
  }
  if (demos.length === 0) problems.push('content/demos/: 没有任何演示数据（M2-A 至少需要 tcp-lifecycle.json）');
  if (knowledge.length === 0) problems.push('content/knowledge/: 没有任何知识点');
  if (sources.length === 0) problems.push('content/sources.json: 没有来源');
  if (!catalog) problems.push('content/catalog.json: 目录缺失或结构不合法');
  if (problems.length > 0 || !catalog) {
    fail();
    return;
  }

  let site;
  try {
    site = buildSite({ demos, knowledge, sources, catalog });
  } catch (e) {
    problems.push(`适配层不变式失败: ${(e as Error).message}`);
    fail();
    return;
  }

  // 产物：classic script（jsdom 冒烟不支持 type=module，启动必须同步完成）
  const payload = `window.NETLAB_DATA = ${JSON.stringify(site, null, 2)};\n`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, payload, 'utf8');

  console.log(
    `build-data: ${site.lessons.length} 课 / ${site.groups.length} 组 / ${Object.keys(site.sources).length} 来源` +
      ` → ${path.relative(ROOT, OUT)}（${Buffer.byteLength(payload)} B）`,
  );
}

function fail(): void {
  console.error('build-data 失败：');
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}

main();

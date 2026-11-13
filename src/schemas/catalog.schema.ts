/**
 * NetLab Explorer — 课程目录 Zod Schema（L1 结构校验）
 * 对应 src/types/catalog.ts 与 docs/m2a-implementation-plan.md §4.8。
 * 跨文件引用（demoId / knowledgeId / groupId 是否真实存在）不在本文件检查：
 * 那是 L2 的职责，由构建期适配层的不变量 I9 承担（只报错，不新增规则码）。
 */
import { z } from 'zod';
import type { Catalog, CatalogGroup, CourseEntry } from '../types/catalog.ts';

const CatalogGroupSchema: z.ZodType<CatalogGroup> = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    en: z.string().min(1),
    color: z.string().min(1),
    dark: z.string().min(1).optional(),
    question: z.string().min(1),
  })
  .strict();

const CourseEntrySchema: z.ZodType<CourseEntry> = z
  .object({
    demoId: z.string().min(1),
    knowledgeId: z.string().regex(/^NET-\d{2}-\d{2}$/, 'knowledgeId 必须匹配 NET-MM-NN'),
    groupId: z.string().min(1),
    hash: z.string().min(1),
    titleEn: z.string().min(1),
    order: z.number().int().min(1),
  })
  .strict();

const CatalogSchema: z.ZodType<Catalog> = z
  .object({
    groups: z.array(CatalogGroupSchema).min(1),
    courses: z.array(CourseEntrySchema).min(1),
  })
  .strict();

export { CatalogGroupSchema, CatalogSchema, CourseEntrySchema };

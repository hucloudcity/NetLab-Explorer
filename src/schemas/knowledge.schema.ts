/**
 * NetLab Explorer — 知识点 Zod Schema（L1 结构校验）
 * 对应 src/types/knowledge.ts 与 docs/data-model-design.md §4。
 */
import { z } from 'zod';
import type { AccessLevel, ContentState, ContentStatus, KnowledgeLevel, KnowledgePoint, ModuleId, PacketStructure } from '../types/knowledge.ts';
import { SourceRefSchema } from './source.schema.ts';

const ModuleIdSchema: z.ZodType<ModuleId> = z.enum(['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09']);

const ContentStatusSchema: z.ZodType<ContentStatus> = z.enum(['draft', 'review', 'published']);

const ContentStateSchema: z.ZodType<ContentState> = z.enum([
  'original',
  'adapted',
  'third-party',
  'permission-required',
  'license-verified',
]);

const KnowledgeLevelSchema: z.ZodType<KnowledgeLevel> = z.enum(['basic', 'intermediate', 'advanced']);

const AccessLevelSchema: z.ZodType<AccessLevel> = z.enum(['free', 'pro']);

const PacketStructureSchema: z.ZodType<PacketStructure> = z
  .object({
    description: z.string().min(1),
    layout: z
      .array(
        z.object({
          field: z.string().min(1),
          bits: z.string().min(1),
          note: z.string().optional(),
        }),
      )
      .optional(),
  })
  .strict();

const KnowledgePointSchema: z.ZodType<KnowledgePoint> = z
  .object({
    id: z.string().regex(/^NET-\d{2}-\d{2}$/, '知识点 id 必须匹配 NET-MM-NN'),
    title: z.string().min(1),
    categoryId: ModuleIdSchema,
    level: KnowledgeLevelSchema,

    /* 六问正文：非空字符串（validation-rules.md §2） */
    summary: z.string().min(1),
    what: z.string().min(1),
    why: z.string().min(1),
    principle: z.string().min(1),
    practicalScenario: z.string().min(1),
    commonProblems: z.array(z.string().min(1)).min(1),

    packetStructure: PacketStructureSchema.optional(),

    relatedKnowledge: z.array(z.string().regex(/^NET-\d{2}-\d{2}$/)),
    sourceRefs: z.array(SourceRefSchema),
    demoRefs: z.array(z.string().min(1)),

    labId: z.string().min(1).optional(),

    accessLevel: AccessLevelSchema,
    status: ContentStatusSchema,
    contentState: ContentStateSchema,
    createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export {
  AccessLevelSchema,
  ContentStateSchema,
  ContentStatusSchema,
  KnowledgeLevelSchema,
  KnowledgePointSchema,
  ModuleIdSchema,
  PacketStructureSchema,
};

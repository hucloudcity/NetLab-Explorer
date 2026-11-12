/**
 * NetLab Explorer — 来源台账 Zod Schema（L1 结构校验）
 * 对应 src/types/source.ts 与 docs/data-model-design.md §3。
 */
import { z } from 'zod';
import type { LicenseStatus, Source, SourceRef, SourceType } from '../types/source.ts';

/** ISO 日期（YYYY-MM-DD）。 */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '必须是 ISO 日期（YYYY-MM-DD）');

const LicenseStatusSchema: z.ZodType<LicenseStatus> = z.enum([
  'public-standard',
  'paid-standard',
  'copyright-textbook',
  'vendor-copyright',
  'open-source-permissive',
  'open-source-copyleft',
  'per-file-review',
  'pending',
]);

const SourceTypeSchema: z.ZodType<SourceType> = z.enum(['textbook', 'rfc', 'ieee', 'vendor', 'lab', 'tool']);

const SourceSchema: z.ZodType<Source> = z
  .object({
    sourceId: z.string().min(1),
    type: SourceTypeSchema,
    name: z.string().min(1),
    author: z.string().min(1),
    version: z.string().optional(),
    // 官方地址必须 https（validation-rules.md §2；例外白名单：无）
    url: z.string().url().refine((u) => u.startsWith('https://'), { message: '来源 url 必须 https（禁止第三方镜像/不安全链接，ADR-003）' }),
    licenseStatus: LicenseStatusSchema,
    licenseNote: z.string().optional(),
    addedAt: IsoDate,
  })
  .strict();

const SourceRefSchema: z.ZodType<SourceRef> = z
  .object({
    sourceId: z.string().min(1),
    purpose: z.string().min(1),
    sections: z.array(z.string().min(1)),
    checkedAt: IsoDate,
    verificationNote: z.string().optional(),
  })
  .strict();

export { IsoDate, LicenseStatusSchema, SourceRefSchema, SourceSchema, SourceTypeSchema };

// [ClinicalConfig] 模块 schema 集合
// 阶段 1：gradingScales 一项
// 后续阶段 2+ 逐个追加
import { z } from "zod";
import { idSchema, percentSchema } from "../primitives";

/** 单个分级选项 */
export const gradingScaleOptionSchema = z.object({
  grade: z.string().min(1).max(32),
  value: z.number(),
  label: z.string().min(1).max(64),
  description: z.string().min(1).max(512),
  imageUrl: z.string().url().optional(),
});

/** 完整分级量表 (LOCS3 / ETDRS / ISNT / DR International / ...) */
export const gradingScaleSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(64),
    fullName: z.string().min(1).max(128),
    category: z.string().min(1).max(64),
    description: z.string().min(1).max(1024),
    options: z.array(gradingScaleOptionSchema).min(1).max(64),
  })
  .refine(
    (s) => {
      // grade 唯一
      const grades = new Set(s.options.map((o) => o.grade));
      return grades.size === s.options.length;
    },
    { message: "options grade must be unique within a scale", path: ["options"] },
  );

/** 分级量表元数据 (轻量级) */
export const gradingScaleMetadataSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(64),
  abbreviation: z.string().min(1).max(16),
  levels: z.number().int().min(1).max(32),
  usedFor: z.string().min(1).max(128),
  source: z.string().min(1).max(64),
  isActive: z.boolean(),
  lastUpdated: z.string(),
});

/** gradingScales 模块的根 schema：支持两种形态 */
export const gradingScalesModuleSchema = z
  .object({
    $schema: z.literal("gradingScales.v1").optional(),
    version: z.number().int().min(1).max(999).default(1),
    scales: z.array(gradingScaleSchema).min(1).max(64),
    metadata: z.array(gradingScaleMetadataSchema).max(64).default([]),
  });

/** zod 推导出的类型（与 src/types/eye.ts 中 GradingScaleDefinition 结构等价） */
export type GradingScaleOptionConfig = z.infer<typeof gradingScaleOptionSchema>;
export type GradingScaleConfig = z.infer<typeof gradingScaleSchema>;
export type GradingScaleMetadata = z.infer<typeof gradingScaleMetadataSchema>;
export type GradingScalesModule = z.infer<typeof gradingScalesModuleSchema>;

// re-export percentSchema for convenience
export { percentSchema };
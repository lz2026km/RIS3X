import { z } from "zod";
import { idSchema, eyeModalitySchema } from "../primitives";

export const reportSectionTypeSchema = z.enum([
  "text",
  "findings_multi",
  "grading_scale",
  "images",
  "measurements",
  "diagnosis",
]);

export const reportTemplateSectionSchema = z.object({
  key: z.string().min(1).max(64),
  title: z.string().min(1).max(64),
  type: reportSectionTypeSchema,
  required: z.boolean(),
  order: z.number().int().min(0).max(64),
});

export const reportTemplateSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(64),
  modality: eyeModalitySchema,
  description: z.string().min(1).max(256),
  version: z.string().min(1).max(32),
  author: z.string().min(1).max(64),
  sections: z.array(reportTemplateSectionSchema).min(1).max(16),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const reportTemplatesModuleSchema = z.object({
  $schema: z.literal("reportTemplates.v1").optional(),
  version: z.number().int().min(1).max(999).default(1),
  templates: z.array(reportTemplateSchema).min(1).max(64),
});

export type ReportTemplateConfig = z.infer<typeof reportTemplateSchema>;
export type ReportTemplateSectionConfig = z.infer<typeof reportTemplateSectionSchema>;
export type ReportTemplatesModule = z.infer<typeof reportTemplatesModuleSchema>;
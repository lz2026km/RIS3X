import { z } from "zod";
import { idSchema, eyeModalitySchema } from "../primitives";

export const findingSeveritySchema = z.enum([
  "normal",
  "abnormal",
  "critical",
  "borderline",
  "mild",
  "moderate",
  "severe",
]);

/** 影像所见词典条目 */
export const findingLexiconEntrySchema = z.object({
  id: idSchema,
  category: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  laterality: z.enum(["OD", "OS", "OU", "any"]),
  modality: z.array(eyeModalitySchema).min(1).max(8),
  severity: findingSeveritySchema,
  common: z.boolean(),
  description: z.string().min(1).max(512),
  keywords: z.array(z.string().min(1).max(64)).max(32),
  gradingScaleId: z.string().max(32).optional(),
});

export const findingsLexiconModuleSchema = z.object({
  $schema: z.literal("findingsLexicon.v1").optional(),
  version: z.number().int().min(1).max(999).default(1),
  entries: z.array(findingLexiconEntrySchema).min(1).max(512),
});

export type FindingLexiconEntry = z.infer<typeof findingLexiconEntrySchema>;
export type FindingsLexiconModule = z.infer<typeof findingsLexiconModuleSchema>;
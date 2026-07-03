import { z } from "zod";
import { idSchema, probabilitySchema, eyeModalitySchema } from "../primitives";

/** AI 诊断结果分类 */
export const aiClassificationCardSchema = z.object({
  condition: z.string().min(1).max(128),
  probability: probabilitySchema,
  grade: z.string().min(1).max(32),
  confidence: probabilitySchema,
  evidenceText: z.string().min(1).max(512),
  heatmapUrl: z.string().url().optional(),
  critical: z.boolean(),
});

/** AI 监管标志 */
export const approvalFlagsSchema = z.object({
  fdaApproved: z.boolean(),
  ceMarked: z.boolean(),
  nmpaApproved: z.boolean(),
});

/** AI 模型注册 */
export const aiModelSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(64),
  version: z.string().min(1).max(32),
  vendor: z.string().min(1).max(64),
  modality: z.array(eyeModalitySchema).min(1).max(8),
  conditions: z.array(z.string().min(1).max(64)).min(1).max(32),
  accuracy: probabilitySchema,
  sensitivity: probabilitySchema,
  specificity: probabilitySchema,
  approval: approvalFlagsSchema,
  releaseDate: z.string(),
  inputRequirements: z.string().min(1).max(256),
  processingTime: z.string().min(1).max(32),
  active: z.boolean().default(true),
});

/** AI 诊断结果 */
export const aiDiagnosisSchema = z.object({
  id: idSchema,
  studyId: idSchema,
  modelName: z.string().min(1).max(64),
  modelVersion: z.string().min(1).max(32),
  vendor: z.string().min(1).max(64),
  modality: eyeModalitySchema,
  /** "OD" | "OS" | "OU" */
  eyeSide: z.enum(["OD", "OS", "OU"]),
  findings: z.array(z.string().min(1).max(256)).min(1).max(32),
  probabilities: z.record(z.string(), probabilitySchema),
  primaryDiagnosis: z.string().min(1).max(128),
  primaryConfidence: probabilitySchema,
  severity: z.enum(["none", "mild", "moderate", "severe", "proliferative"]),
  classificationCards: z.array(aiClassificationCardSchema).min(1).max(16),
  recommendAction: z.string().min(1).max(256),
  reviewStatus: z.enum(["pending", "accepted", "rejected", "modified"]),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  processedAt: z.string(),
  processingTimeMs: z.number().int().min(0).max(60_000),
  alerts: z.array(z.string().min(1).max(128)).max(32),
});

export const aiModelsModuleSchema = z.object({
  $schema: z.literal("aiModels.v1").optional(),
  version: z.number().int().min(1).max(999).default(1),
  models: z.array(aiModelSchema).min(1).max(64),
  diagnoses: z.array(aiDiagnosisSchema).max(256).default([]),
});

export type AiModelConfig = z.infer<typeof aiModelSchema>;
export type AiDiagnosisConfig = z.infer<typeof aiDiagnosisSchema>;
export type AiModelsModule = z.infer<typeof aiModelsModuleSchema>;
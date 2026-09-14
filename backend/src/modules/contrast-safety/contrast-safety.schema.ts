/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B - 对比剂安全闭环 zod 校验
 *   - 过敏试验记录
 *   - 注射前核查 (同意书/过敏/eGFR/妊娠)
 *   - 增强注射指令 (前置核查)
 *   - 注射后留观 (开始/记录/离院)
 */
import { z } from 'zod'

export const AllergyResultSchema = z.enum(['negative', 'positive', 'unknown'])

export const RecordAllergyTestSchema = z.object({
  patientId: z.string().min(1),
  contrastType: z.string().min(1),
  result: AllergyResultSchema,
  testedAt: z.string().datetime().optional(),
  testedBy: z.string().min(1),
  notes: z.string().optional(),
})

export const PreInjectionCheckSchema = z.object({
  patientId: z.string().min(1),
  contrastType: z.string().optional(),
  consentSigned: z.boolean().optional(),
  allergyResult: AllergyResultSchema.optional(),
  egfr: z.number().optional(),
  eGFR: z.number().optional(),
  pregnant: z.boolean().optional(),
  threshold: z.number().positive().optional(),
})

export const ContrastInjectionSchema = z.object({
  examId: z.string().min(1).optional(),
  patientId: z.string().min(1),
  patientName: z.string().optional(),
  protocolId: z.string().min(1).optional(),
  protocolName: z.string().optional(),
  contrastType: z.string().optional(),
  totalVolumeMl: z.number().positive().optional(),
  flowRateMls: z.number().positive().optional(),
  operator: z.string().optional(),
  weightKg: z.number().positive().optional(),
  egfr: z.number().optional(),
  eGFR: z.number().optional(),
  adjustedVolumeMl: z.number().positive().optional(),
  consentSigned: z.boolean().optional(),
  allergyResult: AllergyResultSchema.optional(),
  pregnant: z.boolean().optional(),
  threshold: z.number().positive().optional(),
})

export const ObservationStartSchema = z.object({
  patientId: z.string().min(1),
  examId: z.string().optional(),
  contrastType: z.string().optional(),
  injectionId: z.string().optional(),
  durationMinutes: z.number().int().positive().max(1440).optional(),
  startedAt: z.string().datetime().optional(),
  operator: z.string().optional(),
})

export const ObservationRecordSchema = z.object({
  symptoms: z.string().min(1),
  action: z.string().optional(),
  at: z.string().datetime().optional(),
  recordedBy: z.string().optional(),
  reactionId: z.string().optional(),
})

export const ObservationDischargeSchema = z
  .object({
    doctorRelease: z.boolean().optional(),
    dischargedBy: z.string().optional(),
    notes: z.string().optional(),
  })
  .optional()

// ────────────────────────────────────────────────────────────────────────────
// [v3.0.6.11-105 Wave 1B] 对比剂外渗事件 zod 校验
// ────────────────────────────────────────────────────────────────────────────

export const ExtravasationSeveritySchema = z.enum(['mild', 'moderate', 'severe'])

export const RecordExtravasationSchema = z.object({
  patientId: z.string().min(1),
  examId: z.string().min(1).optional(),
  severity: ExtravasationSeveritySchema,
  site: z.string().min(1),
  estimatedVolumeMl: z.number().min(0),
  management: z.string().min(1),
  recordedBy: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
})

export const ListExtravasationSchema = z.object({
  patientId: z.string().optional(),
  severity: ExtravasationSeveritySchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
})

export const HandleExtravasationSchema = z
  .object({
    management: z.string().min(1).optional(),
    followUp: z.string().optional(),
    handledBy: z.string().optional(),
    note: z.string().optional(),
  })
  .optional()

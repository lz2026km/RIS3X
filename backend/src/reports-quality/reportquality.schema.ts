import { z } from 'zod'

export const CreateScoreRuleSchema = z.object({
  name: z.string().min(1),
  weights: z.record(z.number().nonnegative()),
  passingScore: z.number().min(0).max(100).default(60),
  active: z.boolean().default(true),
})

export const UpdateScoreRuleSchema = CreateScoreRuleSchema.partial()

export const CreateDefectEntrySchema = z.object({
  name: z.string().min(1),
  defectType: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
})

export const UpdateDefectEntrySchema = CreateDefectEntrySchema.partial()

export const CreateAiReportDraftSchema = z.object({
  patientId: z.string().min(1),
  examId: z.string().min(1).optional(),
  radiologistId: z.string().min(1).optional(),
  findings: z.string().default(''),
  diagnosis: z.string().default(''),
  impression: z.string().default(''),
  recommendations: z.string().default(''),
  conclusion: z.string().default(''),
})

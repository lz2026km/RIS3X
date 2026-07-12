import { z } from 'zod'

export const ApproveCosignSchema = z.object({
  comment: z.string().optional(),
})

export const RejectCosignSchema = z.object({
  reason: z.string().min(1),
})

export const CreateCosignRuleSchema = z.object({
  name: z.string().min(1),
  modality: z.string().min(1),
  threshold: z.enum(['CRITICAL', 'URGENT', 'ALL']),
  cosignerIds: z.array(z.string().min(1)).min(1),
})

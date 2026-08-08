import { z } from 'zod'

// imageId 已移至路径参数 (/qc-ext/image/:id/rate), body 不再携带
export const RateQcImageSchema = z.object({
  score: z.number().int().min(0).max(100),
  radiologistId: z.string().optional(),
  comments: z.string().optional(),
})

export const ReportQcDefectSchema = z.object({
  imageId: z.string().min(1),
  defectType: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).default('MINOR'),
  reportedBy: z.string().min(1),
})

import { z } from 'zod'

export const RateQcImageSchema = z.object({
  imageId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  radiologistId: z.string().min(1),
  comments: z.string().optional(),
})

export const ReportQcDefectSchema = z.object({
  imageId: z.string().min(1),
  defectType: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).default('MINOR'),
  reportedBy: z.string().min(1),
})

import { z } from 'zod'

export const StartAmendmentSchema = z.object({
  reportId: z.string().min(1),
  reason: z.string().min(1),
})

export const UpdateAmendmentSchema = z.object({
  changes: z.string().optional(),
  status: z.enum(['draft', 'pending', 'in_progress', 'completed', 'rejected', 'archived']).optional(),
})

export const CompleteAmendmentSchema = z.object({
  finalReason: z.string().min(1),
  changes: z.string().min(1),
})

export const ApproveAmendmentSchema = z.object({
  comment: z.string().optional(),
})

export const RejectAmendmentSchema = z.object({
  reason: z.string().min(1),
})

// [G005 W8-Report] 补发: 独立文档 + parentReportId 关联
export const SupplementAmendmentSchema = z.object({
  parentReportId: z.string().min(1),
  reportId: z.string().min(1).optional(),
  reason: z.string().min(1),
  changes: z.string().optional(),
})

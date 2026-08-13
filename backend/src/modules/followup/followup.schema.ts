import { z } from 'zod'

export const FollowUpStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'])

export const CreateFollowUpPlanSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  planDate: z.string().min(1),
  intervalDays: z.number().int().positive().default(30),
  status: FollowUpStatusEnum.optional(),
  note: z.string().optional(),
  reminderEnabled: z.boolean().default(true),
  // [v3.0.6.11-92 Wave1B P0] 报告→随访关联: 可选来源报告/检查 (报告详情"创建随访"入口带入)
  reportId: z.string().optional(),
  examId: z.string().optional(),
})

export const UpdateFollowUpPlanSchema = CreateFollowUpPlanSchema.partial()

export const ListFollowUpQuerySchema = z.object({
  status: FollowUpStatusEnum.optional(),
  date: z.string().optional(),
  patientId: z.string().optional(),
  search: z.string().optional(),
})

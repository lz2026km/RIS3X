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
})

export const UpdateFollowUpPlanSchema = CreateFollowUpPlanSchema.partial()

export const ListFollowUpQuerySchema = z.object({
  status: FollowUpStatusEnum.optional(),
  date: z.string().optional(),
  patientId: z.string().optional(),
  search: z.string().optional(),
})

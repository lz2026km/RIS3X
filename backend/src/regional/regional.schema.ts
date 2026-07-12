import { z } from 'zod'

export const UpdateScheduleSchema = z.object({
  date: z.string().min(1),
  timeSlot: z.string().min(1),
  departmentId: z.string().min(1),
  doctorId: z.string().min(1),
  status: z.enum(['AVAILABLE', 'BOOKED', 'BLOCKED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
})

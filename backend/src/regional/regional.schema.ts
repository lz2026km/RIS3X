import { z } from 'zod'

export const UpdateScheduleSchema = z.object({
  date: z.string().min(1),
  timeSlot: z.string().min(1),
  departmentId: z.string().min(1),
  doctorId: z.string().min(1),
  status: z.enum(['AVAILABLE', 'BOOKED', 'BLOCKED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
})

export const CreateAccessApplicationSchema = z.object({
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  hospital: z.string().min(1),
  modality: z.string().min(1),
  reason: z.string().min(1),
  studyDate: z.string().optional(),
})

export const CreateConsultationRequestSchema = z.object({
  patientName: z.string().min(1),
  hospital: z.string().min(1),
  diagnosis: z.string().min(1),
  priority: z.enum(['normal', 'urgent', 'critical']).optional(),
  createDate: z.string().optional(),
})

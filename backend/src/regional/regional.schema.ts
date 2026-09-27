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

/** [G005 Wave 4B] 跨院调阅记录 (RegionalCollaborationPage) */
export const CreateAccessRecordSchema = z.object({
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  studyType: z.string().min(1),
  hospital: z.string().min(1),
  purpose: z.string().optional(),
  accessor: z.string().optional(),
})

// ── [G005 W11-MultiSite] 多院区站点/联邦配置 ──

export const CreateSiteSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(['active', 'offline', 'syncing', 'maintenance']).optional(),
  studies: z.number().nonnegative().optional(),
  patients: z.number().nonnegative().optional(),
  users: z.number().nonnegative().optional(),
  storage: z.number().nonnegative().optional(),
  bandwidth: z.number().nonnegative().optional(),
  latencyMs: z.number().nonnegative().optional(),
  uptimePct: z.number().min(0).max(100).optional(),
  version: z.string().optional(),
  primary: z.boolean().optional(),
})

export const UpdateSiteSchema = CreateSiteSchema.partial()

export const UpdateFederationConfigSchema = z.object({
  name: z.string().optional(),
  mode: z.enum(['centralized', 'federated']).optional(),
  syncIntervalSec: z.number().int().positive().optional(),
  autoFailover: z.boolean().optional(),
  crossSiteQueryEnabled: z.boolean().optional(),
  sharedPatientIndex: z.boolean().optional(),
  members: z.array(z.string()).optional(),
})

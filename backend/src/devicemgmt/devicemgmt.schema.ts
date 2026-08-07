import { z } from 'zod'

export const UpdateEquipmentLifecycleSchema = z.object({
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
  maintenanceDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE', 'RETIRED']).optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
})

export const ReportDeviceFaultSchema = z.object({
  deviceId: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reportedBy: z.string().min(1),
})

export const AddMaterialSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  unit: z.string().min(1),
  minStock: z.number().int().nonnegative().optional(),
})

export const RecordDoseSchema = z.object({
  patientId: z.string().min(1),
  deviceId: z.string().min(1),
  doseValue: z.number().positive(),
  doseUnit: z.string().min(1),
  examType: z.string().min(1),
  recordedAt: z.string().datetime().optional(),
})

export const ReportAdverseReactionSchema = z.object({
  patientId: z.string().min(1),
  contrastType: z.string().min(1),
  reaction: z.string().min(1),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
  administeredAt: z.string().datetime(),
  notes: z.string().optional(),
})

export const UpdateContrastInventorySchema = z.object({
  quantity: z.number().int().nonnegative(),
  batchNo: z.string().min(1).optional(),
  expiryDate: z.string().optional(),
  location: z.string().optional(),
})

// [W4-B] 设备保养计划
export const CreateMaintenancePlanSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1).optional(),
  maintenanceDate: z.string().min(1),
  intervalDays: z.number().int().positive().default(90),
  type: z.string().default('定期保养'),
  content: z.string().default(''),
  estimatedCost: z.number().nonnegative().optional(),
  assignee: z.string().optional(),
})

export const UpdateMaintenancePlanSchema = CreateMaintenancePlanSchema.partial()

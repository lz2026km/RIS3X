import { z } from 'zod'

const WorkOrderStatusEnum = z.enum(['new', 'open', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'closed'])
const WorkOrderKindEnum = z.enum(['maintenance', 'fault'])
const WorkOrderPriorityEnum = z.enum(['critical', 'high', 'medium', 'low'])

export const PartSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
})

export const CreateWorkOrderSchema = z.object({
  kind: WorkOrderKindEnum,
  title: z.string().min(1),
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  priority: WorkOrderPriorityEnum.default('medium'),
  assignee: z.string().optional(),
  parts: z.array(PartSchema).optional(),
  description: z.string().optional(),
  source: z.enum(['manual', 'fault-report']).optional(),
})

export const UpdateWorkOrderSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: WorkOrderPriorityEnum.optional(),
  assignee: z.string().optional(),
  parts: z.array(PartSchema).optional(),
})

export const AdvanceWorkOrderSchema = z.object({
  to: WorkOrderStatusEnum,
  assignee: z.string().optional(),
  parts: z.array(PartSchema).optional(),
  note: z.string().optional(),
  operator: z.string().optional(),
})

export const CreateCalibrationSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  kind: z.enum(['calibration', 'certification']),
  standard: z.string().min(1),
  lastDate: z.string().optional(),
  nextDue: z.string().optional(),
  result: z.enum(['pass', 'fail', 'pending']).optional(),
  certNo: z.string().optional(),
  lab: z.string().optional(),
  operator: z.string().optional(),
  notes: z.string().optional(),
})

export const CreateAssetSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
  procurementCost: z.number().positive(),
  procurementDate: z.string().optional(),
  installDate: z.string().optional(),
  warrantyEnd: z.string().optional(),
  method: z.enum(['straight-line', 'declining']).optional(),
  salvageRate: z.number().min(0).max(1).optional(),
  usefulLifeMonths: z.number().int().positive().optional(),
  status: z.enum(['in_use', 'maintenance', 'retired', 'scrapped']).optional(),
})

export const UpdateAssetSchema = CreateAssetSchema.partial().omit({ deviceId: true })

export const RequestRetirementSchema = z.object({
  type: z.enum(['retire', 'scrap']),
  reason: z.string().min(1),
  requestedBy: z.string().optional(),
})

export const ApproveRetirementSchema = z.object({
  approved: z.boolean(),
  approvedBy: z.string().optional(),
  approvedByRole: z.string().optional(),
  scrapValue: z.number().nonnegative().optional(),
})

export const CreateReportDefinitionSchema = z.object({
  name: z.string().min(1),
  reportType: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'manual']),
  timeOfDay: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  format: z.enum(['xlsx', 'pdf', 'csv']).optional(),
  enabled: z.boolean().optional(),
})

export const UpdateReportDefinitionSchema = CreateReportDefinitionSchema.partial()

export const RunReportSchema = z.object({
  trigger: z.enum(['manual', 'cron']).optional(),
})

export const GroupDiagnosisSchema = z.object({
  principalDiagnosisCode: z.string().min(1),
  baseRate: z.number().positive().optional(),
})

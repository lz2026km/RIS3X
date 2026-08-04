import { z } from 'zod'

export const UpdateTenantProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  license: z.string().min(1).max(100).optional(),
  maxUsers: z.number().min(1).max(100000).optional(),
  maxStorageGb: z.number().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateTenantFeaturesSchema = z.object({
  aiOrchestration: z.boolean().optional(),
  biDashboard: z.boolean().optional(),
  doseManagement: z.boolean().optional(),
  vna: z.boolean().optional(),
  similarCases: z.boolean().optional(),
  environmentReport: z.boolean().optional(),
  mobileApp: z.boolean().optional(),
  teleRadiology: z.boolean().optional(),
})

export const CreateTenantSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'code 仅允许小写字母、数字和连字符'),
  name: z.string().min(1).max(100),
  license: z.string().min(1).max(100).optional(),
  maxUsers: z.number().min(1).max(100000).optional(),
  maxStorageGb: z.number().min(1).optional(),
  features: UpdateTenantFeaturesSchema.optional(),
})

export const UpdateTenantStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
})

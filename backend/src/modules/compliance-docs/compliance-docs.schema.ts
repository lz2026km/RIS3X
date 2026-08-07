import { z } from 'zod'

export const ComplianceDocStatusSchema = z.enum(['DRAFT', 'CURRENT', 'ARCHIVED'])

export const CreateComplianceDocSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  category: z.string().min(1, '分类不能为空').max(100),
  type: z.string().max(50).optional(),
  version: z.string().max(50).optional(),
  content: z.string().optional(),
  status: ComplianceDocStatusSchema.optional(),
  author: z.string().max(100).optional(),
  approvedBy: z.string().max(100).optional(),
  effectiveDate: z.string().datetime().optional(),
})

export const UpdateComplianceDocSchema = CreateComplianceDocSchema.partial()

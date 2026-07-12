import { z } from 'zod'

export const CreateNationalReportSchema = z.object({
  title: z.string().min(1),
  reportType: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  data: z.record(z.unknown()),
  description: z.string().optional(),
})

export const CreateDataReportSchema = z.object({
  title: z.string().min(1),
  reportType: z.string().min(1),
  filters: z.record(z.unknown()).optional(),
  format: z.enum(['PDF', 'EXCEL', 'CSV', 'JSON']).default('PDF'),
  schedule: z.string().optional(),
})

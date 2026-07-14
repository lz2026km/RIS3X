// RED09: Common zod schemas extracted from duplicated patterns across *.schema.ts
import { z } from 'zod'

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export const IdParamSchema = z.object({
  id: z.string().min(1),
})

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export const StatusEnumSchema = <T extends [string, ...string[]]>(values: T) =>
  z.enum(values)

export const OptionalStringField = z.string().min(1).optional()
export const RequiredStringField = z.string().min(1)
export const RequiredDateTimeField = z.string().datetime()
export const OptionalDateTimeField = z.string().datetime().optional()

export const AuditFieldsSchema = z.object({
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
})

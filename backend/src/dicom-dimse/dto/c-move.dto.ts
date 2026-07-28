import { z } from 'zod'

export const CMoveSchema = z
  .object({
    studyInstanceUid: z.string().min(1).optional(),
    seriesInstanceUid: z.string().min(1).optional(),
    sopInstanceUid: z.string().min(1).optional(),
    destinationAe: z.string().min(1),
    destinationHost: z.string().optional(),
    destinationPort: z.number().int().positive().optional(),
    queryRetrieveLevel: z.enum(['STUDY', 'SERIES', 'IMAGE']).default('STUDY'),
  })
  .superRefine((data, ctx) => {
    if (!data.studyInstanceUid && !data.seriesInstanceUid && !data.sopInstanceUid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of studyInstanceUid, seriesInstanceUid, or sopInstanceUid is required',
      })
    }
  })

export type CMoveDto = z.infer<typeof CMoveSchema>

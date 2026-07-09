import { z } from 'zod'

export const CMoveSchema = z.object({
  studyInstanceUid: z.string().min(1).optional(),
  seriesInstanceUid: z.string().min(1).optional(),
  sopInstanceUid: z.string().min(1).optional(),
  destinationAe: z.string().min(1),
  destinationHost: z.string().optional(),
  destinationPort: z.number().int().positive().optional(),
  queryRetrieveLevel: z.enum(['STUDY', 'SERIES', 'IMAGE']).default('STUDY'),
})

export type CMoveDto = z.infer<typeof CMoveSchema>

import { z } from 'zod'

export const CFindMwlSchema = z.object({
  patientName: z.string().optional(),
  patientId: z.string().optional(),
  accessionNumber: z.string().optional(),
  modality: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledDateFrom: z.string().optional(),
  scheduledDateTo: z.string().optional(),
  studyInstanceUid: z.string().optional(),
  queryRetrieveLevel: z.enum(['PATIENT', 'STUDY', 'SERIES', 'IMAGE']).default('STUDY'),
})

export type CFindMwlDto = z.infer<typeof CFindMwlSchema>

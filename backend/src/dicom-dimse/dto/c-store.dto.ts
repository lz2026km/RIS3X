import { z } from 'zod'

export const CStoreSchema = z.object({
  sopClassUid: z.string().min(1),
  sopInstanceUid: z.string().min(1),
  studyInstanceUid: z.string().min(1),
  seriesInstanceUid: z.string().min(1),
  modality: z.string().min(1),
  patientId: z.string().optional(),
  transferSyntax: z.string().default('1.2.840.10008.1.2.1'),
  pixelData: z.string().optional(),
  calledAeTitle: z.string().optional(),
  callingAeTitle: z.string().optional(),
})

export type CStoreDto = z.infer<typeof CStoreSchema>

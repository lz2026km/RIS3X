import { z } from 'zod'

export const CStoreSchema = z.object({
  sopClassUid: z.string().min(1),
  sopInstanceUid: z.string().min(1),
  studyInstanceUid: z.string().min(1),
  seriesInstanceUid: z.string().min(1),
  modality: z.string().min(1),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  studyDate: z.string().optional(),
  studyDescription: z.string().optional(),
  seriesNumber: z.number().int().nonnegative().optional(),
  instanceNumber: z.number().int().nonnegative().optional(),
  // 1.2.840.10008.1.2.1 = Explicit VR Little Endian
  // 1.2.840.10008.1.2   = Implicit VR Little Endian
  transferSyntax: z.string().default('1.2.840.10008.1.2.1'),
  pixelData: z.string().optional(),
  calledAeTitle: z.string().optional(),
  callingAeTitle: z.string().optional(),
})

export type CStoreDto = z.infer<typeof CStoreSchema>

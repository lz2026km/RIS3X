import { z } from 'zod'

export const UploadS3Schema = z.object({
  sopInstanceUid: z.string().min(1),
  bucketName: z.string().default('dicom'),
  endpoint: z.string().optional(),
  region: z.string().optional(),
})

export type UploadS3Dto = z.infer<typeof UploadS3Schema>

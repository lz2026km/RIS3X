import { z } from 'zod'

export const CreateEyeStudySchema = z.object({
  patientId: z.string(),
  modality: z.string().min(1).max(64),
  bodyPart: z.string().min(1).max(128),
  studyDate: z.string().datetime().optional(),
  findings: z.string().optional(),
  impressions: z.string().optional(),
})

export type CreateEyeStudyDto = z.infer<typeof CreateEyeStudySchema>

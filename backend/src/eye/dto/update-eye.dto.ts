import { z } from 'zod'

export const UpdateEyeStudySchema = z.object({
  modality: z.string().min(1).max(64).optional(),
  bodyPart: z.string().min(1).max(128).optional(),
  studyDate: z.string().datetime().optional(),
  findings: z.string().optional(),
  impressions: z.string().optional(),
  status: z.string().optional(),
})

export type UpdateEyeStudyDto = z.infer<typeof UpdateEyeStudySchema>

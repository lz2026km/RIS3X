import { z } from 'zod'

export const CEchoSchema = z.object({
  calledAeTitle: z.string().optional(),
  callingAeTitle: z.string().optional(),
  affectedSopClassUid: z.string().default('1.2.840.10008.1.1'),
})

export type CEchoDto = z.infer<typeof CEchoSchema>

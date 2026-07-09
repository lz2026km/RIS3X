import { z } from 'zod'

export const CEchoSchema = z.object({
  calledAeTitle: z.string().optional(),
  callingAeTitle: z.string().optional(),
})

export type CEchoDto = z.infer<typeof CEchoSchema>

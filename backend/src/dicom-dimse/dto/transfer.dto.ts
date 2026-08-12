import { z } from 'zod'

/** [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列入队请求 */
export const TransferEnqueueSchema = z.object({
  studyUid: z.string().min(1, 'studyUid 必填'),
  targetAe: z.string().min(1, 'targetAe 必填'),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']).optional(),
})
export type TransferEnqueueDto = z.infer<typeof TransferEnqueueSchema>

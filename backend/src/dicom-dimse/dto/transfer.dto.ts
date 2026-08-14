import { z } from 'zod'

/** [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列入队请求
 * [G005 v3.0.6.11-96 Wave 2B (D)] 可选关联检查 (examId/accessionNumber, worklist 联动) */
export const TransferEnqueueSchema = z.object({
  studyUid: z.string().min(1, 'studyUid 必填'),
  targetAe: z.string().min(1, 'targetAe 必填'),
  priority: z.enum(['HIGH', 'NORMAL', 'LOW']).optional(),
  examId: z.string().optional(),
  accessionNumber: z.string().optional(),
})
export type TransferEnqueueDto = z.infer<typeof TransferEnqueueSchema>

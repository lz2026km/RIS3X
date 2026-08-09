import { z } from 'zod'

/** [G005 v3.0.6.11-86 Wave 4B (G-03)] DICOM DIMSE TLS 全局配置 */
export const TlsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  certificate: z.string().optional(),
  caCert: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  verifyPeer: z.boolean().optional(),
})
export type TlsConfigDto = z.infer<typeof TlsConfigSchema>

/** [G005 v3.0.6.11-86 Wave 4B (G-03)] 节点级 TLS 开关 */
export const NodeTlsSchema = z.object({
  enabled: z.boolean(),
})
export type NodeTlsDto = z.infer<typeof NodeTlsSchema>

/** [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS N-CREATE/N-SET 简化请求 */
export const MppsSchema = z.object({
  studyUid: z.string().min(1),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'DISCONTINUED']),
  performedSteps: z
    .array(
      z.object({
        code: z.string().optional(),
        description: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      }),
    )
    .optional(),
})
export type MppsDto = z.infer<typeof MppsSchema>

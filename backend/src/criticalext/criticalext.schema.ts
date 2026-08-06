import { z } from 'zod'

export const CreateCriticalRuleSchema = z.object({
  name: z.string().min(1),
  triggerCondition: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  channels: z.array(z.enum(['SMS', 'PHONE', 'APP', 'WECHAT'])).min(1),
  recipients: z.array(z.string().min(1)).min(1),
})

export const UpdateCriticalRuleSchema = z.object({
  name: z.string().min(1).optional(),
  triggerCondition: z.string().min(1).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  channels: z.array(z.enum(['SMS', 'PHONE', 'APP', 'WECHAT'])).min(1).optional(),
  recipients: z.array(z.string().min(1)).min(1).optional(),
  enabled: z.boolean().optional(),
})

export const AutoDetectCriticalSchema = z.object({
  examId: z.string().min(1),
  reportContent: z.string().min(1),
  radiologistId: z.string().optional(),
})

export const CloseCriticalLoopSchema = z.object({
  criticalId: z.string().min(1),
  resolution: z.string().min(1),
  resolvedBy: z.string().min(1),
  resolvedAt: z.string().datetime().optional(),
})

// [W5] 危急值通知通道开关配置 (落库 critical_channel_<CHANNEL>)
export const CriticalChannelsSchema = z.object({
  channels: z
    .array(
      z.object({
        channel: z.enum(['SYSTEM', 'SMS', 'PHONE', 'WECHAT', 'EMAIL']),
        enabled: z.boolean(),
      }),
    )
    .min(1),
})

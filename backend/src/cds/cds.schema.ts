import { z } from 'zod'

export const CreateGuidelineSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  modality: z.string().min(1),
  category: z.string().optional(),
  version: z.string().optional(),
})

export const AcknowledgeAlertSchema = z.object({
  note: z.string().optional(),
  ackedBy: z.string().min(1),
})

export const CreateCdsRuleSchema = z.object({
  name: z.string().min(1),
  condition: z.string().min(1),
  action: z.string().min(1),
  priority: z.number().int().min(0).max(100).default(50),
  enabled: z.boolean().default(true),
})

import { z } from 'zod'

export const DeployAiModelSchema = z.object({
  modelId: z.string().min(1),
  targetEndpoint: z.string().min(1),
  config: z.record(z.unknown()).optional(),
  version: z.string().optional(),
})

export const GenerateStructuredReportSchema = z.object({
  studyId: z.string().min(1),
  templateId: z.string().min(1),
  findings: z.array(z.string()).optional(),
  additionalContext: z.record(z.unknown()).optional(),
})

export const CreateAiOrchestrationSchema = z.object({
  workflowName: z.string().min(1),
  steps: z.array(z.object({ order: z.number().int(), action: z.string(), params: z.record(z.unknown()) })).min(1),
  trigger: z.enum(['ON_STUDY_COMPLETE', 'ON_REPORT_SAVE', 'MANUAL']).default('MANUAL'),
})

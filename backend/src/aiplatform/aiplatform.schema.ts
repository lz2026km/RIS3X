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

export const CreateAiModelSchema = z.object({
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(60),
  vendor: z.string().min(1).max(120),
  category: z.string().min(1).max(60).optional(),
  endpoint: z.string().url().max(500),
  description: z.string().max(500).optional(),
  triggerConditions: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
})

export const TestAiModelSchema = z.object({
  timeoutMs: z.number().int().positive().max(30000).optional(),
})

export const CreateWorkflowIntegrationSchema = z.object({
  modelId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  triggerConditions: z.record(z.unknown()),
  targetWorkflow: z.string().min(1).max(120),
})

export const CreateAiJobSchema = z.object({
  modelId: z.string().min(1),
  examId: z.string().min(1),
  trigger: z.string().max(60).optional(),
})

export const TriggerWorkflowEventSchema = z.object({
  trigger: z.enum(['ON_STUDY_COMPLETE', 'ON_REPORT_SAVE', 'ON_EXAM_CREATE', 'MANUAL']),
  examId: z.string().min(1),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
})

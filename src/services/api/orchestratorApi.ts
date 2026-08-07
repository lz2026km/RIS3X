import { api } from './client'

export interface FlowStepDefinition {
  name: string
  stepType: string
  assigneeRole?: string
  timeoutMinutes?: number
  autoDispatch?: boolean
  condition?: string
  slaMinutes?: number
  config?: Record<string, unknown>
}

export interface CreateFlowDto {
  name: string
  description?: string
  steps: FlowStepDefinition[]
  slaConfigId?: string
}

export interface OrchestratorFlow {
  id: string
  tenantId: string
  name: string
  description: string
  steps: FlowStepDefinition[]
  active: boolean
  version: number
  slaConfigId?: string
  slaConfig?: SlaConfigDto
  createdAt: string
  updatedAt: string
  executions?: FlowExecution[]
  _count?: { executions: number }
}

export interface FlowStepExecution {
  id: string
  executionId: string
  stepIndex: number
  stepName: string
  stepType: string
  status: string
  assigneeId?: string
  assigneeName?: string
  autoDispatch: boolean
  slaMinutes?: number
  condition?: string
  startedAt?: string
  completedAt?: string
  slaDeadline?: string
  slaBreached: boolean
  result?: unknown
  error?: string
}

export interface FlowExecution {
  id: string
  flowId: string
  flow?: { id: string; name: string }
  status: string
  currentStep: number
  context: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  slaDeadline?: string
  slaBreached: boolean
  trigger?: string
  createdAt: string
  stepExecutions: FlowStepExecution[]
}

export interface SlaConfigDto {
  id?: string
  name: string
  stepType?: string
  priority?: string
  targetMinutes: number
  warningMinutes: number
  autoEscalate?: boolean
  escalateRole?: string
  notifyOnBreach?: boolean
  createdAt?: string
}

export interface SlaStats {
  totalExecutions: number
  breachedExecutions: number
  slaComplianceRate: number
  avgCompletionMin: number
  totalSteps: number
  breachedSteps: number
}

export const orchestratorApi = {
  createFlow: async (data: CreateFlowDto) => {
    const res = await api.post<OrchestratorFlow>('/orchestrator/flow', data);
    return res.data;
  },

  getFlow: async (id: string) => {
    const res = await api.get<OrchestratorFlow>(`/orchestrator/flow/${id}`);
    return res.data;
  },

  triggerFlow: async (id: string, context?: Record<string, unknown>) => {
    const res = await api.post<FlowExecution>(`/orchestrator/flow/${id}/trigger`, { context });
    return res.data;
  },

  triggerNextStep: async (id: string) => {
    const res = await api.post<FlowExecution>(`/orchestrator/flow/${id}/next`, {});
    return res.data;
  },

  getFlows: async () => {
    const res = await api.get<OrchestratorFlow[]>(`/orchestrator/flows`);
    return res.data ?? [];
  },

  getExecutions: async (page = 1, limit = 20, status?: string) => {
    const res = await api.get<{ items: FlowExecution[]; total: number; page: number; limit: number }>(
      `/orchestrator/executions?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}`,
    );
    return res.data;
  },

  upsertSla: async (data: SlaConfigDto) => {
    const res = await api.put<SlaConfigDto>('/orchestrator/sla', data);
    return res.data;
  },

  getSlaConfigs: async () => {
    const res = await api.get<SlaConfigDto[]>('/orchestrator/sla');
    return res.data ?? [];
  },

  getSlaStats: async () => {
    const res = await api.get<SlaStats>('/orchestrator/sla/stats');
    return res.data;
  },
}

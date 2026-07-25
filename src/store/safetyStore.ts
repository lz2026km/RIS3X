import { create } from 'zustand'
import {
  getAdverseEvents, createAdverseEvent, updateAdverseEvent, deleteAdverseEvent,
  getRcaInvestigations, createRcaInvestigation, updateRcaInvestigation,
  getRiskItems, createRiskItem, updateRiskItem,
  getCqiDashboard, createCqiProject, closeCqiProject,
  getPatientSafetyGoals,
  type AdverseEvent, type RcaInvestigation, type RiskItem, type CqiProject,
  type PatientSafetyGoal,
} from '../services/api/safetyApi'
import { createCrudStore } from './helpers'

interface SafetyState {
  adverseEvents: AdverseEvent[]
  rcaInvestigations: RcaInvestigation[]
  riskItems: RiskItem[]
  cqiProjects: CqiProject[]
  safetyGoals: PatientSafetyGoal[]
  loading: boolean
  error: string | null

  loadAdverseEvents: () => Promise<void>
  loadRcaInvestigations: () => Promise<void>
  loadRiskItems: () => Promise<void>
  loadCqiProjects: () => Promise<void>
  loadSafetyGoals: () => Promise<void>

  createAdverseEvent: (data: Parameters<typeof createAdverseEvent>[0]) => Promise<void>
  updateAdverseEvent: (id: string, data: Partial<AdverseEvent>) => Promise<void>
  deleteAdverseEvent: (id: string) => Promise<void>

  createRcaInvestigation: (data: Parameters<typeof createRcaInvestigation>[0]) => Promise<void>
  closeRca: (id: string) => Promise<void>

  createRiskItem: (data: Parameters<typeof createRiskItem>[0]) => Promise<void>
  mitigateRisk: (id: string, plan: string, owner: string, deadline: string) => Promise<void>

  createCqiProject: (data: Parameters<typeof createCqiProject>[0]) => Promise<void>
  closeCqi: (id: string) => Promise<void>
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  adverseEvents: [],
  rcaInvestigations: [],
  riskItems: [],
  cqiProjects: [],
  safetyGoals: [],
  loading: false,
  error: null,

  ...createCrudStore<AdverseEvent>({
    field: 'adverseEvents',
    label: '不良事件',
    api: { list: getAdverseEvents, create: createAdverseEvent, update: updateAdverseEvent, delete: deleteAdverseEvent },
  })(set, get),

  ...createCrudStore<RcaInvestigation>({
    field: 'rcaInvestigations',
    label: 'RCA调查',
    api: { list: getRcaInvestigations, create: createRcaInvestigation },
  })(set, get),

  ...createCrudStore<RiskItem>({
    field: 'riskItems',
    label: '风险项',
    api: { list: getRiskItems, create: createRiskItem },
  })(set, get),

  ...createCrudStore<CqiProject>({
    field: 'cqiProjects',
    label: 'CQI项目',
    api: { list: getCqiDashboard, create: createCqiProject },
  })(set, get),

  ...createCrudStore<PatientSafetyGoal>({
    field: 'safetyGoals',
    label: '安全目标',
    api: { list: getPatientSafetyGoals },
  })(set, get),

  closeRca: async (id) => {
    set({ loading: true, error: null })
    try {
      const result = await updateRcaInvestigation(id, {
        capaStatus: 'closed',
        closedAt: new Date().toISOString(),
      })
      if (!result) throw new Error('关闭RCA失败')
      await get().loadRcaInvestigations()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '关闭RCA失败' })
    } finally {
      set({ loading: false })
    }
  },

  mitigateRisk: async (id, plan, owner, deadline) => {
    set({ loading: true, error: null })
    try {
      const result = await updateRiskItem(id, { mitigationPlan: plan, mitigationOwner: owner, mitigationDeadline: deadline, status: 'mitigating' })
      if (!result) throw new Error('更新风险缓解失败')
      await get().loadRiskItems()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '更新风险缓解失败' })
    } finally {
      set({ loading: false })
    }
  },

  closeCqi: async (id) => {
    set({ loading: true, error: null })
    try {
      const result = await closeCqiProject(id, '项目完成', '持续监测')
      if (!result) throw new Error('关闭CQI项目失败')
      await get().loadCqiProjects()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '关闭CQI项目失败' })
    } finally {
      set({ loading: false })
    }
  },
}))

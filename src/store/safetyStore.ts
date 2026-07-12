import { create } from 'zustand'
import {
  getAdverseEvents, createAdverseEvent, updateAdverseEvent, deleteAdverseEvent,
  getRcaInvestigations, createRcaInvestigation, updateRcaInvestigation, deleteRcaInvestigation,
  getRiskItems, createRiskItem, updateRiskItem, deleteRiskItem,
  getCqiDashboard, createCqiProject, closeCqiProject,
  getPatientSafetyGoals,
  type AdverseEvent, type RcaInvestigation, type RiskItem, type CqiProject,
  type PatientSafetyGoal, type EventSeverity, type EventCategory, type RiskCategory, type RcaStatus,
} from '../services/api/safetyApi'

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

  loadAdverseEvents: async () => {
    set({ loading: true, error: null })
    try {
      const data = await getAdverseEvents()
      set({ adverseEvents: data, loading: false })
    } catch {
      set({ error: '加载不良事件失败', loading: false })
    }
  },

  loadRcaInvestigations: async () => {
    set({ loading: true, error: null })
    try {
      const data = await getRcaInvestigations()
      set({ rcaInvestigations: data, loading: false })
    } catch {
      set({ error: '加载RCA调查失败', loading: false })
    }
  },

  loadRiskItems: async () => {
    set({ loading: true, error: null })
    try {
      const data = await getRiskItems()
      set({ riskItems: data, loading: false })
    } catch {
      set({ error: '加载风险项失败', loading: false })
    }
  },

  loadCqiProjects: async () => {
    set({ loading: true, error: null })
    try {
      const data = await getCqiDashboard()
      set({ cqiProjects: data, loading: false })
    } catch {
      set({ error: '加载CQI项目失败', loading: false })
    }
  },

  loadSafetyGoals: async () => {
    set({ loading: true, error: null })
    try {
      const data = await getPatientSafetyGoals()
      set({ safetyGoals: data, loading: false })
    } catch {
      set({ error: '加载安全目标失败', loading: false })
    }
  },

  createAdverseEvent: async (data) => {
    set({ loading: true, error: null })
    try {
      await createAdverseEvent(data)
      await get().loadAdverseEvents()
    } catch {
      set({ error: '创建不良事件失败', loading: false })
    }
  },

  updateAdverseEvent: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await updateAdverseEvent(id, data)
      await get().loadAdverseEvents()
    } catch {
      set({ error: '更新不良事件失败', loading: false })
    }
  },

  deleteAdverseEvent: async (id) => {
    set({ loading: true, error: null })
    try {
      await deleteAdverseEvent(id)
      await get().loadAdverseEvents()
    } catch {
      set({ error: '删除不良事件失败', loading: false })
    }
  },

  createRcaInvestigation: async (data) => {
    set({ loading: true, error: null })
    try {
      await createRcaInvestigation(data)
      await get().loadRcaInvestigations()
    } catch {
      set({ error: '创建RCA调查失败', loading: false })
    }
  },

  closeRca: async (id) => {
    set({ loading: true, error: null })
    try {
      await updateRcaInvestigation(id, {
        capaStatus: 'closed',
        closedAt: new Date().toISOString(),
      })
      await get().loadRcaInvestigations()
    } catch {
      set({ error: '关闭RCA失败', loading: false })
    }
  },

  createRiskItem: async (data) => {
    set({ loading: true, error: null })
    try {
      await createRiskItem(data)
      await get().loadRiskItems()
    } catch {
      set({ error: '创建风险项失败', loading: false })
    }
  },

  mitigateRisk: async (id, plan, owner, deadline) => {
    set({ loading: true, error: null })
    try {
      await updateRiskItem(id, { mitigationPlan: plan, mitigationOwner: owner, mitigationDeadline: deadline, status: 'mitigating' })
      await get().loadRiskItems()
    } catch {
      set({ error: '更新风险缓解失败', loading: false })
    }
  },

  createCqiProject: async (data) => {
    set({ loading: true, error: null })
    try {
      await createCqiProject(data)
      await get().loadCqiProjects()
    } catch {
      set({ error: '创建CQI项目失败', loading: false })
    }
  },

  closeCqi: async (id) => {
    set({ loading: true, error: null })
    try {
      await closeCqiProject(id, '项目完成', '持续监测')
      await get().loadCqiProjects()
    } catch {
      set({ error: '关闭CQI项目失败', loading: false })
    }
  },
}))

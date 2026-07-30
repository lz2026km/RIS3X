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

let _loadCount = 0

function startLoading(set: (partial: Partial<SafetyState>) => void) {
  _loadCount++
  if (_loadCount === 1) set({ loading: true })
}

function endLoading(set: (partial: Partial<SafetyState>) => void) {
  _loadCount--
  if (_loadCount <= 0) { _loadCount = 0; set({ loading: false }) }
}

function createLoadWrapper(set: (partial: Partial<SafetyState>) => void, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    startLoading(set)
    try { await fn() } finally { endLoading(set) }
  }
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  adverseEvents: [],
  rcaInvestigations: [],
  riskItems: [],
  cqiProjects: [],
  safetyGoals: [],
  loading: false,
  error: null,

  ...(function buildSafeCruds() {
    const ae = createCrudStore<AdverseEvent>({
      field: 'adverseEvents', label: '不良事件',
      api: { list: getAdverseEvents, create: createAdverseEvent, update: updateAdverseEvent, delete: deleteAdverseEvent },
    })(set as any, get)
    const rca = createCrudStore<RcaInvestigation>({
      field: 'rcaInvestigations', label: 'RCA调查',
      api: { list: getRcaInvestigations, create: createRcaInvestigation },
    })(set as any, get)
    const ri = createCrudStore<RiskItem>({
      field: 'riskItems', label: '风险项',
      api: { list: getRiskItems, create: createRiskItem },
    })(set as any, get)
    const cqi = createCrudStore<CqiProject>({
      field: 'cqiProjects', label: 'CQI项目',
      api: { list: getCqiDashboard, create: createCqiProject },
    })(set as any, get)
    const sg = createCrudStore<PatientSafetyGoal>({
      field: 'safetyGoals', label: '安全目标',
      api: { list: getPatientSafetyGoals },
    })(set as any, get)
    return {
      loadAdverseEvents: createLoadWrapper(set as any, ae.loadAdverseEvents!),
      loadRcaInvestigations: createLoadWrapper(set as any, rca.loadRcaInvestigations!),
      loadRiskItems: createLoadWrapper(set as any, ri.loadRiskItems!),
      loadCqiProjects: createLoadWrapper(set as any, cqi.loadCqiProjects!),
      loadSafetyGoals: createLoadWrapper(set as any, sg.loadSafetyGoals!),
      createAdverseEvent: ae.createAdverseEvent!,
      updateAdverseEvent: ae.updateAdverseEvent!,
      deleteAdverseEvent: ae.deleteAdverseEvent!,
      createRcaInvestigation: rca.createRcaInvestigation!,
      createRiskItem: ri.createRiskItem!,
      createCqiProject: cqi.createCqiProject!,
    }
  })(),

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
      set({ loading: false, error: err instanceof Error ? err.message : '关闭RCA失败' })
    }
  },

  mitigateRisk: async (id, plan, owner, deadline) => {
    set({ loading: true, error: null })
    try {
      const result = await updateRiskItem(id, { mitigationPlan: plan, mitigationOwner: owner, mitigationDeadline: deadline, status: 'mitigating' })
      if (!result) throw new Error('更新风险缓解失败')
      await get().loadRiskItems()
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '更新风险缓解失败' })
    }
  },

  closeCqi: async (id) => {
    set({ loading: true, error: null })
    try {
      const result = await closeCqiProject(id, '项目完成', '持续监测')
      if (!result) throw new Error('关闭CQI项目失败')
      await get().loadCqiProjects()
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '关闭CQI项目失败' })
    }
  },
}))

// @deprecated v3.0.4: Consumers should use useStore() hook pattern instead of .getState()
// TODO: Convert all getState() calls to useStore() for reactive subscriptions
import { create } from 'zustand'
import { createActor, type Actor } from 'xstate'
import { criticalApi } from '../services/api'
import type { CriticalValueDto, NotificationMethod as ApiNotificationMethod } from '../services/api'
import { criticalValueMachine, type CriticalMachine, type NotificationMethod as MachineNotificationMethod } from '../machines/criticalValueMachine'
import { criticalValueService } from '../services/quality/criticalValueService'

type NotificationMethod = MachineNotificationMethod
type CriticalValueStatus = 'pending' | 'notified' | 'voice_called' | 'acknowledged' | 'receipted' | 'resolving' | 'resolved' | 'closed_loop' | 'escalated' | 'cancelled'

const NOTIFICATION_METHOD_MAP: Record<string, MachineNotificationMethod> = {
  PHONE: 'phone', SMS: 'sms', SYSTEM: 'system', EMAIL: 'email', WECHAT: 'wechat', DINGTALK: 'dingtalk',
}

function toMachineMethod(method?: string): MachineNotificationMethod {
  if (!method) return 'system'
  const lower = NOTIFICATION_METHOD_MAP[method]
  return lower ?? (method.toLowerCase() as MachineNotificationMethod)
}

interface CriticalState {
  values: CriticalValueDto[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  voiceCall: (id: string, phoneNumber: string) => Promise<void>
  acknowledge: (id: string) => Promise<void>
  clinicalReceipt: (id: string, data: { confirmedBy: string; signature?: string; comment?: string }) => Promise<void>
  resolve: (id: string) => Promise<void>
  notify: (id: string, method?: ApiNotificationMethod) => Promise<void>
  escalate: (id: string, to: string) => Promise<void>
  startEscalationWatcher: () => void
  stopEscalationWatcher: () => void
}

/** Map criticalMachine state value → store status string */
const MACHINE_STATE_TO_STORE: Record<string, CriticalValueStatus> = {
  found: 'pending',
  notified: 'notified',
  voice_called: 'voice_called',
  acknowledged: 'acknowledged',
  receipted: 'receipted',
  resolving: 'resolving',
  resolved: 'resolved',
  closed_loop: 'resolved',
  escalated: 'escalated',
  cancelled: 'cancelled',
}

/** Actor 存在模块级 Map 中(不入 Zustand state,避免序列化问题) */
const actorsMap = new Map<string, Actor<CriticalMachine>>()

/** 从列表 DTO 重建一个最小的 machine input 上下文。 */
function buildActorFor(value: CriticalValueDto): Actor<CriticalMachine> {
  const actor = createActor(criticalValueMachine, {
    input: {
      criticalId: value.id,
      reportId: value.reportId ?? '',
      examId: value.examId ?? '',
      patientId: value.patientId ?? '',
      patientName: value.patientName,
      finding: value.finding,
      category: value.category ?? '',
      severity: (value.severity as 'critical' | 'urgent' | 'high') ?? 'critical',
      reportedBy: '',
      reportedAt: value.triggeredAt,
    },
  })
  actor.start()
  // 把 actor 推进到当前 store status,这样后续 send() 才会被状态机接受
  if (value.status === 'notified' || value.status === 'voice_called' || value.status === 'acknowledged' || value.status === 'receipted' || value.status === 'resolved' || value.status === 'escalated') {
    actor.send({
      type: 'NOTIFY',
      to: '',
      method: (value.notificationMethod as NotificationMethod) ?? 'system',
      by: '',
    })
  }
  if (value.status === 'voice_called' || value.status === 'acknowledged' || value.status === 'receipted' || value.status === 'resolved') {
    actor.send({ type: 'VOICE_CALL', by: value.voiceCalledBy ?? '', phoneNumber: '' })
  }
  if (value.status === 'acknowledged' || value.status === 'receipted' || value.status === 'resolved') {
    actor.send({ type: 'ACKNOWLEDGE', by: '' })
  }
  if (value.status === 'receipted' || value.status === 'resolved') {
    actor.send({ type: 'RECEIPT', by: value.confirmedBy ?? '' })
  }
  if (value.status === 'resolved') {
    actor.send({ type: 'START_PROCESSING', doctorId: '' })
    actor.send({ type: 'COMPLETE_PROCESSING', note: '' })
  }
  if (value.status === 'escalated') {
    actor.send({ type: 'ESCALATE', to: (value as unknown as { escalatedTo?: string }).escalatedTo ?? '', reason: 'replay' })
  }
  return actor
}

let _escalationTimer: ReturnType<typeof setInterval> | null = null
const STUCK_STATES = ['found', 'notified', 'voice_called', 'acknowledged', 'receipted', 'resolving']

export const useCriticalStore = create<CriticalState>((set, get) => ({
  values: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const res = await criticalApi.list()
      if (res.success && Array.isArray(res.data)) {
        const values = res.data as CriticalValueDto[]
        // 清理不再出现的 actor
        const currentIds = new Set(values.map(v => v.id))
        actorsMap.forEach((actor, id) => {
          if (!currentIds.has(id)) {
            actor.stop()
            actorsMap.delete(id)
          }
        })
        // 为新条目创建 actor
        values.forEach((v) => {
          if (!actorsMap.has(v.id)) {
            actorsMap.set(v.id, buildActorFor(v))
          }
        })
        set({ values, loading: false, error: null })
        get().startEscalationWatcher()
      } else {
        set({ loading: false, error: res.error?.message ?? '加载失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  startEscalationWatcher: () => {
    if (_escalationTimer) clearInterval(_escalationTimer)
    _escalationTimer = setInterval(() => {
      const { values } = get()
      values.forEach((v) => {
        const actor = actorsMap.get(v.id)
        if (!actor) return
        const state = actor.getSnapshot().value as string
        if (STUCK_STATES.includes(state)) {
          actor.send({ type: 'ESCALATE', to: '', reason: '通知超时' })
          criticalValueService.runEscalationChain(v.id).catch(() => {})
          set((s) => ({
            values: s.values.map((x) =>
              x.id === v.id ? { ...x, status: 'escalated' as CriticalValueStatus, escalatedAt: new Date().toISOString() } : x,
            ),
          }))
        }
      })
    }, 60000)
  },

  stopEscalationWatcher: () => {
    if (_escalationTimer) {
      clearInterval(_escalationTimer)
      _escalationTimer = null
    }
  },

  voiceCall: async (id, phoneNumber) => {
    set({ loading: true, error: null })
    try {
      const res = await criticalApi.voiceCall(id, { calledBy: 'current-user', phoneNumber })
      if (res.success) {
        const actor = get().actors.get(id)
        if (actor) actor.send({ type: 'VOICE_CALL', by: 'current-user', phoneNumber })
        set((s) => ({
          values: s.values.map((v) =>
            v.id === id
              ? { ...v, status: 'voice_called' as const, voiceCalledAt: new Date().toISOString(), voiceCalledBy: 'current-user' }
              : v
          ),
          loading: false,
        }))
      } else {
        set({ loading: false, error: res.error?.message ?? '电话通知失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  clinicalReceipt: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const res = await criticalApi.clinicalReceipt(id, data)
      if (res.success) {
        const actor = get().actors.get(id)
        if (actor) actor.send({ type: 'RECEIPT', by: data.confirmedBy, signature: data.signature, comment: data.comment })
        set((s) => ({
          values: s.values.map((v) =>
            v.id === id
              ? { ...v, status: 'receipted' as const, confirmedBy: data.confirmedBy, confirmedAt: new Date().toISOString(), confirmedSignature: data.signature, confirmedComment: data.comment }
              : v
          ),
          loading: false,
        }))
      } else {
        set({ loading: false, error: res.error?.message ?? '回执失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  acknowledge: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await criticalApi.acknowledge(id)
      if (res.success) {
        const actor = get().actors.get(id)
        if (actor) actor.send({ type: 'ACKNOWLEDGE', by: '' })
        set((s) => ({
          values: s.values.map((v) =>
            v.id === id ? { ...v, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : v
          ),
          loading: false,
        }))
      } else {
        set({ loading: false, error: res.error?.message ?? '确认失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  resolve: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await criticalApi.resolve(id)
      if (res.success) {
        const actor = get().actors.get(id)
        if (actor) {
          const current = actor.getSnapshot().value
          if (current === 'notified') actor.send({ type: 'ACKNOWLEDGE', by: '' })
          actor.send({ type: 'START_PROCESSING', doctorId: '' })
          actor.send({ type: 'COMPLETE_PROCESSING', note: '已闭环' })
        }
        set((s) => ({
          values: s.values.map((v) =>
            v.id === id ? { ...v, status: 'resolved' as const, resolvedAt: new Date().toISOString() } : v
          ),
          loading: false,
        }))
      } else {
        set({ loading: false, error: res.error?.message ?? '闭环失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  notify: async (id, method) => {
    set({ loading: true, error: null })
    try {
      const finalMethod = toMachineMethod(method)
      const apiMethod = method ?? 'SYSTEM'
      const res = await criticalApi.notify(id, apiMethod)
      if (res.success) {
        const actor = get().actors.get(id)
        if (actor) actor.send({ type: 'NOTIFY', to: '', method: finalMethod, by: '' })
        set((s) => ({
          values: s.values.map((v) =>
            v.id === id
              ? { ...v, status: 'notified' as const, notifiedAt: new Date().toISOString(), notificationMethod: apiMethod as ApiNotificationMethod }
              : v
          ),
          loading: false,
        }))
      } else {
        set({ loading: false, error: res.error?.message ?? '通知失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  escalate: async (id, to) => {
    set({ loading: true, error: null })
    try {
      const res = await criticalApi.escalate(id, to, '通知超时')
      if (res.success) {
        const actor = get().actors.get(id)
        if (actor) actor.send({ type: 'ESCALATE', to, reason: '通知超时' })
        set((s) => ({
          values: s.values.map((v) =>
            v.id === id
              ? { ...v, status: 'escalated' as const, escalatedAt: new Date().toISOString(), escalatedTo: to }
              : v
          ),
          loading: false,
        }))
      } else {
        set({ loading: false, error: res.error?.message ?? '升级失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },
}))

// 兼容旧引用:导出 MACHINE_STATE_TO_STORE 供页面使用
export { MACHINE_STATE_TO_STORE }

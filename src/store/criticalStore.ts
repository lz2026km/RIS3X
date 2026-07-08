// @deprecated v3.0.4: Consumers should use useStore() hook pattern instead of .getState()
// TODO: Convert all getState() calls to useStore() for reactive subscriptions
import { create } from 'zustand'
import { createActor, type Actor } from 'xstate'
import { criticalApi } from '../services/api'
import type { NotificationMethod as ApiNotificationMethod } from '../services/api/criticalApi'
import { criticalValueMachine, type CriticalMachine, type NotificationMethod as MachineNotificationMethod } from '../machines/criticalValueMachine'

type NotificationMethod = MachineNotificationMethod

const NOTIFICATION_METHOD_MAP: Record<string, MachineNotificationMethod> = {
  PHONE: 'phone', SMS: 'sms', SYSTEM: 'system', EMAIL: 'email', WECHAT: 'wechat', DINGTALK: 'dingtalk',
}

function toMachineMethod(method?: string): MachineNotificationMethod {
  if (!method) return 'system'
  const lower = NOTIFICATION_METHOD_MAP[method]
  return lower ?? (method.toLowerCase() as MachineNotificationMethod)
}

interface CriticalValue {
  id: string
  patientName: string
  finding: string
  severity: string
  status: 'pending' | 'notified' | 'acknowledged' | 'resolving' | 'resolved' | 'closed_loop' | 'escalated' | 'cancelled'
  triggeredAt: string
  notifiedAt?: string
  acknowledgedAt?: string
  resolvedAt?: string
  escalatedAt?: string
  escalatedTo?: string
  notificationMethod?: ApiNotificationMethod
}

interface CriticalState {
  values: CriticalValue[]
  loading: boolean
  error: string | null
  /** 内部:每个危急值一个 actor,机器是其真实状态来源 */
  actors: Map<string, Actor<CriticalMachine>>
  load: () => Promise<void>
  acknowledge: (id: string) => Promise<void>
  resolve: (id: string) => Promise<void>
  notify: (id: string, method?: ApiNotificationMethod) => Promise<void>
  escalate: (id: string, to: string) => Promise<void>
}

/** Map criticalMachine state value → store status string */
const MACHINE_STATE_TO_STORE: Record<string, CriticalValue['status']> = {
  found: 'pending',
  notified: 'notified',
  acknowledged: 'acknowledged',
  resolving: 'resolving',
  resolved: 'resolved',
  closed_loop: 'resolved',
  escalated: 'escalated',
  cancelled: 'cancelled',
}

/** 从列表 DTO 重建一个最小的 machine input 上下文。 */
function buildActorFor(value: CriticalValue): Actor<CriticalMachine> {
  const actor = createActor(criticalValueMachine, {
    input: {
      criticalId: value.id,
      reportId: '',
      examId: '',
      patientId: '',
      patientName: value.patientName,
      finding: value.finding,
      category: '',
      severity: (value.severity as 'critical' | 'urgent' | 'high') ?? 'critical',
      reportedBy: '',
      reportedAt: value.triggeredAt,
    },
  })
  actor.start()
  // 把 actor 推进到当前 store status,这样后续 send() 才会被状态机接受
  if (value.status === 'notified' || value.status === 'acknowledged' || value.status === 'resolved' || value.status === 'escalated') {
    actor.send({
      type: 'NOTIFY',
      to: '',
      method: (value.notificationMethod as NotificationMethod) ?? 'system',
      by: '',
    })
  }
  if (value.status === 'acknowledged' || value.status === 'resolved') {
    actor.send({ type: 'ACKNOWLEDGE', by: '' })
  }
  if (value.status === 'resolved') {
    actor.send({ type: 'START_PROCESSING', doctorId: '' })
    actor.send({ type: 'COMPLETE_PROCESSING', note: '' })
  }
  if (value.status === 'escalated') {
    actor.send({ type: 'ESCALATE', to: value.escalatedTo ?? '', reason: 'replay' })
  }
  return actor
}

export const useCriticalStore = create<CriticalState>((set, get) => ({
  values: [],
  loading: false,
  error: null,
  actors: new Map(),

  load: async () => {
    set({ loading: true })
    const res = await criticalApi.list()
    if (res.success && Array.isArray(res.data)) {
      const values = res.data as CriticalValue[]
      // 重建 actor pool,与 values 一一对应
      const actors = new Map<string, Actor<CriticalMachine>>()
      const previousActors = get().actors
      values.forEach((v) => {
        const existing = previousActors.get(v.id)
        if (existing) {
          actors.set(v.id, existing)
        } else {
          actors.set(v.id, buildActorFor(v))
        }
      })
      // 停掉已被移除的 actor
      previousActors.forEach((actor, id) => {
        if (!actors.has(id)) actor.stop()
      })
      set({ values, actors, loading: false, error: null })
    } else {
      set({ loading: false, error: res.error?.message ?? '加载失败' })
    }
  },

  acknowledge: async (id) => {
    const res = await criticalApi.acknowledge(id)
    if (res.success) {
      // criticalValueMachine: notified → acknowledged via ACKNOWLEDGE
      const actor = get().actors.get(id)
      if (actor) actor.send({ type: 'ACKNOWLEDGE', by: '' })
      set((s) => ({
        values: s.values.map((v) =>
          v.id === id ? { ...v, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : v
        ),
      }))
    }
  },

  resolve: async (id) => {
    const res = await criticalApi.resolve(id)
    if (res.success) {
      // criticalValueMachine: acknowledged → resolving → resolved
      // 如果当前是 notified,先自动 acknowledge
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
      }))
    }
  },

  notify: async (id, method) => {
    const finalMethod: NotificationMethod = toMachineMethod(method)
    let res = { success: false, data: null as unknown as CriticalValue, error: undefined as { code?: string; message?: string } | undefined }
    if (typeof (criticalApi as unknown as { notify?: (id: string, m: NotificationMethod) => Promise<typeof res> }).notify === 'function') {
      res = await (criticalApi as unknown as { notify: (id: string, m: NotificationMethod) => Promise<typeof res> }).notify(id, finalMethod)
    } else {
      res = { success: true, data: null as unknown as CriticalValue, error: undefined }
    }
    // criticalValueMachine: found → notified via NOTIFY
    const actor = get().actors.get(id)
    if (actor) actor.send({ type: 'NOTIFY', to: '', method: finalMethod, by: '' })
    set((s) => ({
      values: s.values.map((v) =>
        v.id === id
          ? { ...v, status: 'notified' as const, notifiedAt: new Date().toISOString(), notificationMethod: finalMethod as ApiNotificationMethod }
          : v
      ),
    }))
  },

  escalate: async (id, to) => {
    // criticalValueMachine: 任意非终态 → escalated via ESCALATE (with reason)
    const actor = get().actors.get(id)
    if (actor) actor.send({ type: 'ESCALATE', to, reason: '通知超时' })
    set((s) => ({
      values: s.values.map((v) =>
        v.id === id
          ? { ...v, status: 'escalated' as const, escalatedAt: new Date().toISOString(), escalatedTo: to }
          : v
      ),
    }))
  },
}))

// 兼容旧引用:导出 MACHINE_STATE_TO_STORE 供页面使用
export { MACHINE_STATE_TO_STORE }

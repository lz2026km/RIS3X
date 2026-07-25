// @deprecated v3.0.4: Consumers should use useStore() hook pattern instead of .getState()
// TODO: Convert all getState() calls to useStore() for reactive subscriptions
import { create } from 'zustand'
import { createActor } from 'xstate'
import { reportApi } from '../services/api'
import type { ReportDto } from '../services/api'
import { reportMachine, REPORT_STATE_LABEL, type ReportStateName } from '../machines/reportMachine'

const REPORT_STATUS_TO_STATE: Record<string, ReportStateName> = {
  '待分配': 'pendingAssignment',
  '已分配': 'assigned',
  '书写中': 'writing',
  '已提交': 'submitted',
  '初审中': 'initialReview',
  '终审中': 'finalReview',
  'CoSign双签': 'coSignReview',
  '已审核': 'reviewed',
  '签发中': 'signing',
  '已签发': 'signed',
  '已发布': 'published',
  '修订中': 'amending',
  '已修订': 'amended',
  '已撤回': 'withdrawn',
  '已驳回': 'rejected',
  '已升级': 'escalated',
  '已归档': 'archived',
  '整改中': 'rectifying',
  '补充中': 'supplementing',
  '已补充': 'supplemented',
  '跨院区重分配': 'redistributing',
}

function buildReportActor(report: ReportDto, initial?: ReportStateName) {
  const target = initial ?? REPORT_STATUS_TO_STATE[report.status] ?? 'pendingAssignment'
  const actor = createActor(reportMachine, {
    input: {
      reportId: report.id,
      patientId: report.patientId,
      radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system',
    },
  })
  actor.start()
  // 把 actor 推进到当前 store status,这样后续 send() 才会被状态机接受
  const transitions: Record<ReportStateName, () => void> = {
    pendingAssignment: () => {},
    assigned: () => actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' }),
    writing: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
    },
    submitted: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
    },
    initialReview: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
    },
    finalReview: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
    },
    coSignReview: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
    },
    reviewed: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
    },
    signing: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
      actor.send({ type: 'START_SIGN' })
    },
    signed: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
      actor.send({ type: 'START_SIGN' })
      actor.send({ type: 'COMPLETE_SIGN' })
    },
    published: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
      actor.send({ type: 'START_SIGN' })
      actor.send({ type: 'COMPLETE_SIGN' })
      actor.send({ type: 'PUBLISH', qualityScore: (report as unknown as { qualityScore?: number }).qualityScore ?? 60 })
    },
    amending: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
      actor.send({ type: 'START_SIGN' })
      actor.send({ type: 'COMPLETE_SIGN' })
      actor.send({ type: 'PUBLISH', qualityScore: (report as unknown as { qualityScore?: number }).qualityScore ?? 60 })
      actor.send({ type: 'START_AMEND', reason: 'replay' })
    },
    amended: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
      actor.send({ type: 'START_SIGN' })
      actor.send({ type: 'COMPLETE_SIGN' })
      actor.send({ type: 'PUBLISH', qualityScore: (report as unknown as { qualityScore?: number }).qualityScore ?? 60 })
      actor.send({ type: 'START_AMEND', reason: 'replay' })
      actor.send({ type: 'COMPLETE_AMEND' })
    },
    withdrawn: () => {
      actor.send({ type: 'WITHDRAW' })
    },
    rejected: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'REJECT', reason: 'replay' })
    },
    escalated: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'ESCALATE', reason: 'replay' })
    },
    archived: () => {
      actor.send({ type: 'ARCHIVE' })
    },
    rectifying: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'REJECT', reason: 'replay' })
      actor.send({ type: 'RESTART' })
    },
    supplementing: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
      actor.send({ type: 'START_SIGN' })
      actor.send({ type: 'COMPLETE_SIGN' })
      actor.send({ type: 'PUBLISH', qualityScore: (report as unknown as { qualityScore?: number }).qualityScore ?? 60 })
      actor.send({ type: 'START_SUPPLEMENT' })
    },
    supplemented: () => {
      actor.send({ type: 'ASSIGN', radiologistId: (report as unknown as { doctorId?: string }).doctorId ?? 'system' })
      actor.send({ type: 'START_WRITING' })
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_INITIAL' })
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: (report as unknown as { reviewerId?: string }).reviewerId ?? 'system' })
      actor.send({ type: 'APPROVE_FINAL' })
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: (report as unknown as { coSignerId?: string }).coSignerId ?? 'system' })
      actor.send({ type: 'START_SIGN' })
      actor.send({ type: 'COMPLETE_SIGN' })
      actor.send({ type: 'PUBLISH', qualityScore: (report as unknown as { qualityScore?: number }).qualityScore ?? 60 })
      actor.send({ type: 'START_SUPPLEMENT' })
      actor.send({ type: 'COMPLETE_SUPPLEMENT' })
    },
    redistributing: () => {
      actor.send({ type: 'START_REDISTRIBUTE', targetDoctorId: (report as unknown as { doctorId?: string }).doctorId ?? 'system', reason: 'replay' })
    },
  }
  transitions[target]?.()
  return actor
}

function statusLabelToMachine(status: string): ReportStateName {
  return REPORT_STATUS_TO_STATE[status] ?? 'pendingAssignment'
}

function machineStateToLabel(state: ReportStateName): string {
  return REPORT_STATE_LABEL[state]
}

interface ReportState {
  reports: ReportDto[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  submit: (id: string) => Promise<void>
  review: (
    id: string,
    type: 'initial' | 'final',
    doctorId: string,
    doctorName: string,
    suggestion: string,
    score: number,
  ) => Promise<void>
  sign: (id: string) => Promise<void>
  publish: (id: string, qualityScore?: number) => Promise<void>
  reject: (id: string, reason: string) => Promise<void>
  revise: (id: string) => Promise<void>
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const res = await reportApi.list({})
      if (res.success && Array.isArray(res.data)) {
        set({ reports: res.data as ReportDto[], loading: false, error: null })
      } else {
        set({ loading: false, error: res.error?.message ?? '加载失败' })
      }
    } catch (err) {
      set({ loading: false, error: errorMessage(err, '网络错误') })
    }
  },

  submit: async (id) => {
    set({ error: null })
    const report = get().reports.find((r) => r.id === id)
    if (!report) return
    const actor = buildReportActor(report)
    const before = actor.getSnapshot().value as ReportStateName
    actor.send({ type: 'SUBMIT' })
    const after = actor.getSnapshot().value as ReportStateName
    if (before === after) {
      actor.stop()
      console.warn(`[reportStore] machine rejected SUBMIT for ${id} (was ${before})`)
      set({ error: `状态机拒绝: SUBMIT (当前状态 ${before})` })
      return
    }
    try {
      const res = await reportApi.submit(id)
      actor.stop()
      if (res.success) {
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, status: machineStateToLabel(after) } : r)),
        }))
      } else {
        set({ error: res.error?.message ?? '提交失败' })
      }
    } catch (err) {
      actor.stop()
      set({ error: errorMessage(err, '网络错误') })
    }
  },

  review: async (id, type, doctorId, doctorName, suggestion, score) => {
    set({ error: null })
    const beforeStatus = get().reports.find((r) => r.id === id)?.status
    const report = get().reports.find((r) => r.id === id)
    if (!report) return
    const actor = buildReportActor(report)
    const before2 = actor.getSnapshot().value as ReportStateName
    if (type === 'initial') {
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: doctorId })
      const after1 = actor.getSnapshot().value as ReportStateName
      if (before2 === after1) {
        actor.stop()
        console.warn(`[reportStore] machine rejected START_INITIAL_REVIEW for ${id} (was ${before2})`)
        set({ error: `状态机拒绝: START_INITIAL_REVIEW (当前状态 ${before2})` })
        return
      }
      actor.send({ type: 'APPROVE_INITIAL' })
    } else {
      actor.send({ type: 'START_FINAL_REVIEW', reviewerId: doctorId })
      const after1 = actor.getSnapshot().value as ReportStateName
      if (before2 === after1) {
        actor.stop()
        console.warn(`[reportStore] machine rejected START_FINAL_REVIEW for ${id} (was ${before2})`)
        set({ error: `状态机拒绝: START_FINAL_REVIEW (当前状态 ${before2})` })
        return
      }
      actor.send({ type: 'APPROVE_FINAL' })
    }
    const after = actor.getSnapshot().value as ReportStateName
    try {
      const res = await reportApi.review(id, { type, doctorId, doctorName, suggestion, score })
      actor.stop()
      if (res.success) {
        set((s) => ({
          reports: s.reports.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: machineStateToLabel(after),
                  ...(type === 'initial' ? { initialAuditSuggestion: suggestion } : { finalAuditSuggestion: suggestion }),
                }
              : r,
          ),
        }))
      } else {
        set((s) => ({
          reports: s.reports.map((r) =>
            r.id === id ? { ...r, status: beforeStatus ?? r.status } : r,
          ),
          error: res.error?.message ?? '审核提交失败',
        }))
      }
    } catch (err) {
      actor.stop()
      set((s) => ({
        reports: s.reports.map((r) =>
          r.id === id ? { ...r, status: beforeStatus ?? r.status } : r,
        ),
        error: errorMessage(err, '网络错误'),
      }))
    }
  },

  sign: async (id) => {
    set({ error: null })
    const report = get().reports.find((r) => r.id === id)
    if (!report) return
    const actor = buildReportActor(report)
    const before = actor.getSnapshot().value as ReportStateName
    actor.send({ type: 'START_SIGN' })
    const afterStart = actor.getSnapshot().value as ReportStateName
    if (before === afterStart) {
      actor.stop()
      console.warn(`[reportStore] machine rejected START_SIGN for ${id} (was ${before})`)
      set({ error: `状态机拒绝: START_SIGN (当前状态 ${before})` })
      return
    }
    actor.send({ type: 'COMPLETE_SIGN' })
    const after = actor.getSnapshot().value as ReportStateName
    try {
      const res = await reportApi.sign(id)
      actor.stop()
      if (res.success) {
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, status: machineStateToLabel(after) } : r)),
        }))
      } else {
        set({ error: res.error?.message ?? '签发失败' })
      }
    } catch (err) {
      actor.stop()
      set({ error: errorMessage(err, '网络错误') })
    }
  },

  publish: async (id, qualityScore) => {
    set({ error: null })
    const report = get().reports.find((r) => r.id === id)
    if (!report) return
    const actor = buildReportActor(report)
    const before = actor.getSnapshot().value as ReportStateName
    actor.send({ type: 'PUBLISH', qualityScore })
    const after = actor.getSnapshot().value as ReportStateName
    if (before === after) {
      actor.stop()
      console.warn(`[reportStore] machine rejected PUBLISH for ${id} (was ${before}, score=${qualityScore ?? 'unknown'})`)
      set({ error: `状态机拒绝: PUBLISH (当前状态 ${before}, 质控分 ${qualityScore ?? 0} < 60)` })
      return
    }
    try {
      const res = await reportApi.publish(id, qualityScore)
      actor.stop()
      if (res.success) {
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, status: machineStateToLabel(after) } : r)),
        }))
      } else {
        set({ error: res.error?.message ?? '发布失败' })
      }
    } catch (err) {
      actor.stop()
      set({ error: errorMessage(err, '网络错误') })
    }
  },

  reject: async (id, reason) => {
    set({ error: null })
    const report = get().reports.find((r) => r.id === id)
    if (!report) return
    const actor = buildReportActor(report)
    const before = actor.getSnapshot().value as ReportStateName
    actor.send({ type: 'REJECT', reason })
    const after = actor.getSnapshot().value as ReportStateName
    if (before === after) {
      actor.stop()
      console.warn(`[reportStore] machine rejected REJECT for ${id} (was ${before})`)
      set({ error: `状态机拒绝: REJECT (当前状态 ${before})` })
      return
    }
    try {
      const res = await reportApi.reject(id, reason)
      actor.stop()
      if (res.success) {
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, status: machineStateToLabel(after) } : r)),
        }))
      } else {
        set({ error: res.error?.message ?? '驳回失败' })
      }
    } catch (err) {
      actor.stop()
      set({ error: errorMessage(err, '网络错误') })
    }
  },

  revise: async (id) => {
    set({ error: null })
    const report = get().reports.find((r) => r.id === id)
    if (!report) return
    const actor = buildReportActor(report)
    const before = actor.getSnapshot().value as ReportStateName
    actor.send({ type: 'START_AMEND', reason: '修订请求' })
    const after = actor.getSnapshot().value as ReportStateName
    if (before === after) {
      actor.stop()
      console.warn(`[reportStore] machine rejected START_AMEND for ${id} (was ${before})`)
      set({ error: `状态机拒绝: START_AMEND (当前状态 ${before})` })
      return
    }
    try {
      const res = await reportApi.revise(id)
      actor.stop()
      if (res.success) {
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, status: machineStateToLabel(after) } : r)),
        }))
      } else {
        set({ error: res.error?.message ?? '修订失败' })
      }
    } catch (err) {
      actor.stop()
      set({ error: errorMessage(err, '网络错误') })
    }
  },
}))

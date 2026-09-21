// @deprecated v3.0.4: Consumers should use useStore() hook pattern instead of .getState()
// TODO: Convert all getState() calls to useStore() for reactive subscriptions
import { create } from 'zustand'
import { createActor } from 'xstate'
import { examApi } from '../services/api'
import type { ExamDto } from '../services/api'
import { examMachine, type ExamStateName } from '../machines/examMachine'
import { createCrudStore } from './helpers'

const EXAM_STATUS_TO_STATE: Record<string, ExamStateName> = {
  '已申请': 'scheduled',
  '已排程': 'scheduled',
  '已登记': 'arrived',
  '已报到': 'arrived',
  '检查中': 'inProgress',
  '已暂停': 'paused',
  '已完成': 'completed',
  '图像可用': 'imageAvailable',
  '质控通过': 'qcPass',
  '质控退回': 'qcReject',
  '待报告': 'pendingReport',
  // 报告生命周期态 (已报告/已发布/已归档) 归 reportMachine; worklist 止于 pendingReport
  '已报告': 'pendingReport',
  '已发布': 'pendingReport',
  '已归档': 'pendingReport',
  '已取消': 'cancelled',
}

function buildExamActor(exam: ExamDto) {
  const initial = EXAM_STATUS_TO_STATE[exam.status] ?? 'scheduled'
  const actor = createActor(examMachine, {
    input: {
      examId: exam.id,
      patientId: exam.patientId,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      orderedBy: (exam as unknown as { doctorId?: string }).doctorId ?? 'system',
    },
  })
  actor.start()
  // 把 actor 推进到当前 store status,这样后续 send() 才会被状态机接受
  const toArrived = () => actor.send({ type: 'ARRIVE', by: 'system' })
  const toInProgress = () => {
    toArrived()
    actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
  }
  const toCompleted = () => {
    toInProgress()
    actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
  }
  const toImageAvailable = () => {
    toCompleted()
    actor.send({ type: 'IMAGES_READY', imageCount: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
  }
  const toQcPass = () => {
    toImageAvailable()
    actor.send({ type: 'QC_PASS', by: 'system' })
  }
  const toQcReject = () => {
    toImageAvailable()
    actor.send({ type: 'QC_REJECT', reason: 'replay', by: 'system' })
  }
  const toPendingReport = () => {
    toQcPass()
    actor.send({ type: 'AWAIT_REPORT', by: 'system' })
  }
  const walk: Record<ExamStateName, () => void> = {
    scheduled: () => {},
    arrived: toArrived,
    inProgress: toInProgress,
    paused: () => {
      toInProgress()
      actor.send({ type: 'PAUSE_EXAM', reason: 'replay', by: 'system' })
    },
    completed: toCompleted,
    imageAvailable: toImageAvailable,
    qcPass: toQcPass,
    qcReject: toQcReject,
    pendingReport: toPendingReport,
    cancelled: () => {
      actor.send({ type: 'CANCEL', reason: 'replay', by: 'system' })
    },
  }
  walk[initial]?.()
  return actor
}

interface ExamState {
  exams: ExamDto[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  transition: (id: string, action: 'checkIn' | 'start' | 'complete' | 'cancel') => Promise<void>
}

interface ExamActionPlan {
  apiFn: (id: string) => Promise<{ success: boolean; data?: unknown; error?: { message?: string } }>
  buildEvent: () => Record<string, unknown> | null
  nextState: ExamStateName
}

const ACTION_PLANS: Record<'checkIn' | 'start' | 'complete' | 'cancel', ExamActionPlan> = {
  checkIn: {
    apiFn: examApi.checkIn,
    buildEvent: () => ({ type: 'ARRIVE', by: 'system' }),
    nextState: 'arrived',
  },
  start: {
    apiFn: examApi.start,
    buildEvent: () => ({ type: 'START_EXAM', by: 'system', technologistId: 'system' }),
    nextState: 'inProgress',
  },
  complete: {
    apiFn: examApi.complete,
    buildEvent: () => ({ type: 'COMPLETE_EXAM', imagesAcquired: 0, by: 'system' }),
    nextState: 'completed',
  },
  cancel: {
    apiFn: examApi.cancel,
    buildEvent: () => ({ type: 'CANCEL', reason: 'cancel from store', by: 'system' }),
    nextState: 'cancelled',
  },
}

export const useExamStore = create<ExamState>((set, get) => {
  const crud = createCrudStore<ExamDto>({
    field: 'exams',
    label: '检查',
    api: { list: () => examApi.list({}) },
    methodName: 'load',
    loadErrorMsg: '加载失败',
  })(set as any, get) as Record<string, (...args: any[]) => Promise<void>>

  const { load, ...restCrud } = crud

  return {
    exams: [],
    loading: false,
    error: null,
    load: load!,
    ...restCrud,

    transition: async (id: string, action: 'checkIn' | 'start' | 'complete' | 'cancel') => {
      set({ loading: true, error: null })
      try {
        const plan = ACTION_PLANS[action]
        const exam = get().exams.find((e) => e.id === id)
        if (!exam) {
          set({ loading: false, error: `Exam ${id} not found in store` })
          return
        }
        const actor = buildExamActor(exam)
        const beforeState = actor.getSnapshot().value as ExamStateName
        const event = plan.buildEvent()
        if (!event) {
          actor.stop()
          set({ loading: false })
          return
        }
        actor.send(event as never)
        const afterState = actor.getSnapshot().value as ExamStateName
        if (beforeState === afterState) {
          console.warn(`[examStore] machine rejected ${action} for ${id} (was ${beforeState}); refusing to call API`)
          actor.stop()
          set({ loading: false, error: `状态机拒绝: ${action} (当前状态 ${beforeState})` })
          return
        }
        const res = await plan.apiFn(id)
        actor.stop()
        if (res.success) {
          set((state) => ({
            exams: state.exams.map((e) => (e.id === id ? { ...e, status: afterState } : e)),
            loading: false,
            error: null,
          }))
        } else {
          set({ loading: false, error: res.error?.message ?? '操作失败' })
        }
      } catch (err) {
        set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
      }
    },
  } as unknown as ExamState
})

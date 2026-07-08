// @deprecated v3.0.4: Consumers should use useStore() hook pattern instead of .getState()
// TODO: Convert all getState() calls to useStore() for reactive subscriptions
import { create } from 'zustand'
import { createActor } from 'xstate'
import { examApi } from '../services/api'
import type { ExamDto } from '../services/api'
import { examMachine, type ExamStateName } from '../machines/examMachine'

const EXAM_STATUS_TO_STATE: Record<string, ExamStateName> = {
  '已申请': 'ordered',
  '已排程': 'scheduled',
  '已登记': 'registered',
  '已报到': 'arrived',
  '检查中': 'inProgress',
  '已暂停': 'paused',
  '已完成': 'completed',
  '图像可用': 'imageAvailable',
  '质控退回': 'qcReject',
  '待报告': 'pendingReport',
  '已报告': 'reported',
  '已发布': 'published',
  '已归档': 'archived',
  '已取消': 'cancelled',
}

function buildExamActor(exam: ExamDto) {
  const initial = EXAM_STATUS_TO_STATE[exam.status] ?? 'ordered'
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
  const walk: Record<ExamStateName, () => void> = {
    ordered: () => {},
    scheduled: () => actor.send({ type: 'APPROVE_ORDER', by: 'system' }),
    registered: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
    },
    arrived: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
    },
    inProgress: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
    },
    paused: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'PAUSE_EXAM', reason: 'replay', by: 'system' })
    },
    completed: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
    },
    imageAvailable: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'IMAGES_READY', imageCount: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
    },
    qcReject: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: 0, by: 'system' })
      actor.send({ type: 'IMAGES_READY', imageCount: 0, by: 'system' })
      actor.send({ type: 'QC_REJECT', reason: 'replay', by: 'system' })
    },
    pendingReport: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'IMAGES_READY', imageCount: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'QC_PASS', by: 'system' })
    },
    reported: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'IMAGES_READY', imageCount: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'QC_PASS', by: 'system' })
      actor.send({ type: 'MARK_REPORTED', by: 'system' })
    },
    published: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'IMAGES_READY', imageCount: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'QC_PASS', by: 'system' })
      actor.send({ type: 'MARK_REPORTED', by: 'system' })
      actor.send({ type: 'PUBLISH', by: 'system' })
    },
    archived: () => {
      actor.send({ type: 'APPROVE_ORDER', by: 'system' })
      actor.send({ type: 'REGISTER', roomId: (exam as unknown as { roomId?: string }).roomId ?? 'R-?', deviceId: (exam as unknown as { deviceId?: string }).deviceId ?? 'D-?', by: 'system' })
      actor.send({ type: 'ARRIVE', by: 'system' })
      actor.send({ type: 'START_EXAM', by: 'system', technologistId: (exam as unknown as { technicianId?: string }).technicianId ?? 'system' })
      actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'IMAGES_READY', imageCount: (exam as unknown as { imageCount?: number }).imageCount ?? 0, by: 'system' })
      actor.send({ type: 'QC_PASS', by: 'system' })
      actor.send({ type: 'MARK_REPORTED', by: 'system' })
      actor.send({ type: 'PUBLISH', by: 'system' })
      actor.send({ type: 'ARCHIVE', by: 'system' })
    },
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

export const useExamStore = create<ExamState>((set, get) => ({
  exams: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true })
    const res = await examApi.list({})
    if (res.success && Array.isArray(res.data)) {
      set({ exams: res.data as ExamDto[], loading: false, error: null })
    } else {
      set({ loading: false, error: res.error?.message ?? '加载失败' })
    }
  },

  transition: async (id, action) => {
    const plan = ACTION_PLANS[action]
    const exam = get().exams.find((e) => e.id === id)
    if (!exam) {
      set({ error: `Exam ${id} not found in store` })
      return
    }
    const actor = buildExamActor(exam)
    const beforeState = actor.getSnapshot().value as ExamStateName
    const event = plan.buildEvent()
    if (!event) {
      actor.stop()
      return
    }
    actor.send(event as never)
    const afterState = actor.getSnapshot().value as ExamStateName
    if (beforeState === afterState) {
      console.warn(`[examStore] machine rejected ${action} for ${id} (was ${beforeState}); refusing to call API`)
      actor.stop()
      set({ error: `状态机拒绝: ${action} (当前状态 ${beforeState})` })
      return
    }
    const res = await plan.apiFn(id)
    actor.stop()
    if (res.success) {
      set((state) => ({
        exams: state.exams.map((e) => (e.id === id ? { ...e, status: afterState } : e)),
        error: null,
      }))
    } else {
      set({ error: res.error?.message ?? '操作失败' })
    }
  },
}))

/**
 * G005 放射RIS系统 v3.0.2.10 - 检查执行 12 态状态机
 */
import { createMachine, assign } from 'xstate';

export type ExamStateName =
  | 'ordered' | 'scheduled' | 'registered' | 'arrived'
  | 'inProgress' | 'paused' | 'completed' | 'imageAvailable'
  | 'qcReject' | 'pendingReport'
  | 'reported' | 'published' | 'archived' | 'cancelled';

export const EXAM_STATE_LABEL: Record<ExamStateName, string> = {
  ordered: '已申请', scheduled: '已排程', registered: '已登记', arrived: '已报到',
  inProgress: '检查中', paused: '已暂停', completed: '已完成', imageAvailable: '图像可用',
  pendingReport: '待报告', reported: '已报告', published: '已发布',
  qcReject: '质控退回', archived: '已归档', cancelled: '已取消',
};

export const EXAM_STATE_GROUPS: Record<string, ExamStateName[]> = {
  order: ['ordered', 'scheduled'],
  exam: ['registered', 'arrived', 'inProgress', 'paused', 'completed', 'imageAvailable', 'qcReject'],
  report: ['pendingReport', 'reported', 'published'],
  final: ['archived', 'cancelled'],
};

export interface ExamContext {
  examId: string; patientId: string; modality: string; bodyPart: string;
  orderedBy: string; scheduledAt: string | null; deviceId: string | null;
  roomId: string | null; technologistId: string | null;
  imagesAcquired: number; imageCount: number;
  rejectionReason: string | null; history: ExamStateEvent[];
  pausedReason: string | null; pauseDuration: number;
  qcRejectReason: string | null;
  radiationDose: number; dlp: number; ctDoseIndex: number; kap: number; fluoroscopyTime: number;
  contrastReady: boolean; contrastInjected: boolean;
}

export interface ExamStateEvent { state: ExamStateName; timestamp: string; actorId: string; note?: string; }

export type ExamEvent =
  | { type: 'APPROVE_ORDER'; by: string }
  | { type: 'REJECT_ORDER'; reason: string; by: string }
  | { type: 'SCHEDULE'; scheduledAt?: string; by: string }
  | { type: 'REGISTER'; roomId: string; deviceId: string; by: string }
  | { type: 'ARRIVE'; by: string }
  | { type: 'START_EXAM'; by: string; technologistId: string }
  | { type: 'PAUSE_EXAM'; reason: string; by: string }
  | { type: 'RESUME_EXAM'; by: string }
  | { type: 'COMPLETE_EXAM'; imagesAcquired: number; by: string }
  | { type: 'IMAGES_READY'; imageCount: number; by: string }
  | { type: 'QC_PASS'; by: string }
  | { type: 'QC_REJECT'; reason: string; by: string }
  | { type: 'AWAIT_REPORT'; by: string }
  | { type: 'MARK_REPORTED'; by: string }
  | { type: 'PUBLISH'; by: string }
  | { type: 'ARCHIVE'; by: string }
  | { type: 'CANCEL'; reason: string; by: string }
  | { type: 'RECORD_DOSE'; radiationDose: number; dlp: number; ctDoseIndex: number; kap: number; fluoroscopyTime: number; by: string }
  | { type: 'CONTRAST_READY'; by: string }
  | { type: 'CONTRAST_INJECTED'; by: string };

function initExam(input: { examId: string; patientId: string; modality: string; bodyPart: string; orderedBy: string }): ExamContext {
  return { ...input, scheduledAt: null, deviceId: null, roomId: null, technologistId: null, imagesAcquired: 0, imageCount: 0, rejectionReason: null, history: [], pausedReason: null, pauseDuration: 0, qcRejectReason: null, radiationDose: 0, dlp: 0, ctDoseIndex: 0, kap: 0, fluoroscopyTime: 0, contrastReady: false, contrastInjected: false };
}

const examMachineConfig = {
  id: 'exam',
  initial: 'ordered',
  context: ({ input }: { input: Parameters<typeof initExam>[0] }) => initExam(input),
  types: {} as { context: ExamContext; events: ExamEvent; input: Parameters<typeof initExam>[0] },
  states: {
    ordered: {
      on: {
        APPROVE_ORDER: { target: 'scheduled', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'scheduled', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        REJECT_ORDER: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    scheduled: {
      on: {
        SCHEDULE: { target: 'scheduled', actions: assign({ scheduledAt: ({ context, event }) => event.scheduledAt ?? context.scheduledAt, history: ({ context, event }) => [...context.history, { state: 'scheduled', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        REGISTER: { target: 'registered', actions: assign({ roomId: ({ event }) => event.roomId, deviceId: ({ event }) => event.deviceId, history: ({ context, event }) => [...context.history, { state: 'registered', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    registered: {
      on: {
        ARRIVE: { target: 'arrived', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'arrived', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    arrived: {
      on: {
        START_EXAM: { target: 'inProgress', actions: assign({ technologistId: ({ event }) => event.technologistId, history: ({ context, event }) => [...context.history, { state: 'inProgress', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    inProgress: {
      on: {
        PAUSE_EXAM: { target: 'paused', actions: assign({ pausedReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'paused', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        COMPLETE_EXAM: { target: 'completed', actions: assign({ imagesAcquired: ({ event }) => event.imagesAcquired, history: ({ context, event }) => [...context.history, { state: 'completed', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        RECORD_DOSE: { actions: assign({ radiationDose: ({ event }) => event.radiationDose, dlp: ({ event }) => event.dlp, ctDoseIndex: ({ event }) => event.ctDoseIndex, kap: ({ event }) => event.kap, fluoroscopyTime: ({ event }) => event.fluoroscopyTime, history: ({ context, event }) => [...context.history, { state: 'inProgress', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CONTRAST_READY: { actions: assign({ contrastReady: () => true, history: ({ context, event }) => [...context.history, { state: 'inProgress', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CONTRAST_INJECTED: { actions: assign({ contrastInjected: () => true, history: ({ context, event }) => [...context.history, { state: 'inProgress', timestamp: new Date().toISOString(), actorId: event.by }] }) },
      },
    },
    paused: {
      on: {
        RESUME_EXAM: { target: 'inProgress', actions: assign({ pausedReason: null, pauseDuration: ({ context }) => context.pauseDuration + Math.round((Date.now() - new Date(context.history[context.history.length - 1].timestamp).getTime()) / 60000), history: ({ context, event }) => [...context.history, { state: 'inProgress', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    completed: { on: { IMAGES_READY: { target: 'imageAvailable', actions: assign({ imageCount: ({ event }) => event.imageCount, history: ({ context, event }) => [...context.history, { state: 'imageAvailable', timestamp: new Date().toISOString(), actorId: event.by }] }) } } },
    imageAvailable: { on: { QC_PASS: { target: 'pendingReport', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'pendingReport', timestamp: new Date().toISOString(), actorId: event.by }] }) }, QC_REJECT: { target: 'qcReject', actions: assign({ qcRejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'qcReject', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) }, AWAIT_REPORT: { target: 'pendingReport', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'pendingReport', timestamp: new Date().toISOString(), actorId: event.by }] }) } } },
    qcReject: { on: { IMAGES_READY: { target: 'imageAvailable', actions: assign({ imageCount: ({ event }) => event.imageCount, history: ({ context, event }) => [...context.history, { state: 'imageAvailable', timestamp: new Date().toISOString(), actorId: event.by }] }) } } },
    pendingReport: { on: { MARK_REPORTED: { target: 'reported', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'reported', timestamp: new Date().toISOString(), actorId: event.by }] }) } } },
    reported: { on: { PUBLISH: { target: 'published', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'published', timestamp: new Date().toISOString(), actorId: event.by }] }) } } },
    published: { on: { ARCHIVE: { target: 'archived', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'archived', timestamp: new Date().toISOString(), actorId: event.by }] }) } } },
    archived: { type: 'final' },
    cancelled: { type: 'final' },
  },
};

export const examMachine = createMachine(examMachineConfig);

export type ExamMachine = typeof examMachine;

export function createExamMachine(initialContext?: Partial<ExamContext>): ExamMachine {
  return createMachine({
    ...examMachineConfig,
    context: ({ input }: { input: Parameters<typeof initExam>[0] }) => ({
      ...initExam(input),
      ...initialContext,
    }),
  }) as ExamMachine;
}

/**
 * G005 放射RIS系统 v3.0.2.10 - 检查执行 状态机 (对齐 backend Worklist EXAM_TRANSITIONS)
 *
 * [v3.0.6.11-107] 审计对齐: 后端 `backend/src/modules/worklist/worklist.service.ts`
 *   `EXAM_TRANSITIONS` 权威 10 态:
 *     SCHEDULED, ARRIVED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED,
 *     IMAGE_READY, QC_REJECT, QC_PASS, PENDING_REPORT
 *   前端 camelCase 映射: scheduled, arrived, inProgress, paused, completed, cancelled,
 *     imageAvailable, qcReject, qcPass, pendingReport
 *
 * 与旧版 (14 态) 的状态差异 (本次移除的前端多余态):
 *   - ordered       : 申请/审批属 orderMachine (后端 Appointment 侧), worklist 无此态
 *   - registered    : 登记/签到属 orderMachine (后端 AppointmentState.REGISTERED), worklist 无此态
 *   - reported      : 报告生命周期属 reportMachine (后端 ReportState), worklist 止于 PENDING_REPORT
 *   - published     : 同上, 报告发布态
 *   - archived      : 同上, 报告归档态
 * 新增后端缺失态:
 *   - qcPass (QC_PASS): 后端 IMAGE_READY→QC_PASS→PENDING_REPORT, 旧前端把 QC_PASS 直接落到 pendingReport
 *
 * 兼容保留的边 (后端无但前端流程保留, 属 superset 兼容):
 *   - imageAvailable 直接 AWAIT_REPORT→pendingReport (后端 IMAGE_READY→PENDING_REPORT)
 *   - qcReject 直接 AWAIT_REPORT→pendingReport / IMAGES_READY 重拍
 */
import { createMachine, assign } from 'xstate';

export type ExamStateName =
  | 'scheduled' | 'arrived' | 'inProgress' | 'paused' | 'completed'
  | 'imageAvailable' | 'qcPass' | 'qcReject' | 'pendingReport' | 'cancelled';

export const EXAM_STATE_LABEL: Record<ExamStateName, string> = {
  scheduled: '已排程', arrived: '已报到', inProgress: '检查中', paused: '已暂停',
  completed: '已完成', imageAvailable: '图像可用', qcPass: '质控通过', qcReject: '质控退回',
  pendingReport: '待报告', cancelled: '已取消',
};

export const EXAM_STATE_GROUPS: Record<string, ExamStateName[]> = {
  order: ['scheduled', 'arrived'],
  exam: ['inProgress', 'paused', 'completed'],
  image: ['imageAvailable'],
  qc: ['qcPass', 'qcReject'],
  report: ['pendingReport'],
  final: ['cancelled'],
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
  | { type: 'ARRIVE'; by: string }
  | { type: 'START_EXAM'; by: string; technologistId: string }
  | { type: 'PAUSE_EXAM'; reason: string; by: string }
  | { type: 'RESUME_EXAM'; by: string }
  | { type: 'COMPLETE_EXAM'; imagesAcquired: number; by: string }
  | { type: 'IMAGES_READY'; imageCount: number; by: string }
  | { type: 'QC_PASS'; by: string }
  | { type: 'QC_REJECT'; reason: string; by: string }
  | { type: 'AWAIT_REPORT'; by: string }
  | { type: 'CANCEL'; reason: string; by: string }
  | { type: 'RECORD_DOSE'; radiationDose: number; dlp: number; ctDoseIndex: number; kap: number; fluoroscopyTime: number; by: string }
  | { type: 'CONTRAST_READY'; by: string }
  | { type: 'CONTRAST_INJECTED'; by: string };

function initExam(input: { examId: string; patientId: string; modality: string; bodyPart: string; orderedBy: string }): ExamContext {
  return { ...input, scheduledAt: null, deviceId: null, roomId: null, technologistId: null, imagesAcquired: 0, imageCount: 0, rejectionReason: null, history: [], pausedReason: null, pauseDuration: 0, qcRejectReason: null, radiationDose: 0, dlp: 0, ctDoseIndex: 0, kap: 0, fluoroscopyTime: 0, contrastReady: false, contrastInjected: false };
}

function buildExamMachine(initialContext?: Partial<ExamContext>) {
  return createMachine({
  id: 'exam',
  initial: 'scheduled',
  context: ({ input }: { input: Parameters<typeof initExam>[0] }) => ({ ...initExam(input), ...initialContext }),
  types: {} as { context: ExamContext; events: ExamEvent; input: Parameters<typeof initExam>[0] },
  states: {
    // 后端 EXAM_TRANSITIONS.SCHEDULED: [ARRIVED, CANCELLED]
    scheduled: {
      on: {
        ARRIVE: { target: 'arrived', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'arrived' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 ARRIVED: [IN_PROGRESS, CANCELLED]
    arrived: {
      on: {
        START_EXAM: { target: 'inProgress', actions: assign({ technologistId: ({ event }) => event.technologistId, history: ({ context, event }) => [...context.history, { state: 'inProgress' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 IN_PROGRESS: [COMPLETED, PAUSED, CANCELLED, IMAGE_READY]
    inProgress: {
      on: {
        PAUSE_EXAM: { target: 'paused', actions: assign({ pausedReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'paused' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        COMPLETE_EXAM: { target: 'completed', actions: assign({ imagesAcquired: ({ event }) => event.imagesAcquired, history: ({ context, event }) => [...context.history, { state: 'completed' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        IMAGES_READY: { target: 'imageAvailable', actions: assign({ imageCount: ({ event }) => event.imageCount, history: ({ context, event }) => [...context.history, { state: 'imageAvailable' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        RECORD_DOSE: { actions: assign({ radiationDose: ({ event }) => event.radiationDose, dlp: ({ event }) => event.dlp, ctDoseIndex: ({ event }) => event.ctDoseIndex, kap: ({ event }) => event.kap, fluoroscopyTime: ({ event }) => event.fluoroscopyTime, history: ({ context, event }) => [...context.history, { state: 'inProgress' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CONTRAST_READY: { actions: assign({ contrastReady: () => true, history: ({ context, event }) => [...context.history, { state: 'inProgress' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CONTRAST_INJECTED: { actions: assign({ contrastInjected: () => true, history: ({ context, event }) => [...context.history, { state: 'inProgress' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
      },
    },
    // 后端 PAUSED: [IN_PROGRESS, CANCELLED]
    paused: {
      on: {
        RESUME_EXAM: { target: 'inProgress', actions: assign({ pausedReason: null, pauseDuration: ({ context }) => context.pauseDuration + Math.round((Date.now() - new Date(context.history[context.history.length - 1]?.timestamp ?? Date.now()).getTime()) / 60000), history: ({ context, event }) => [...context.history, { state: 'inProgress' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'cancelled' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 COMPLETED: [IMAGE_READY]
    completed: { on: { IMAGES_READY: { target: 'imageAvailable', actions: assign({ imageCount: ({ event }) => event.imageCount, history: ({ context, event }) => [...context.history, { state: 'imageAvailable' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) } } },
    // 后端 IMAGE_READY: [QC_REJECT, QC_PASS, PENDING_REPORT]
    imageAvailable: {
      on: {
        QC_PASS: { target: 'qcPass', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'qcPass' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        QC_REJECT: { target: 'qcReject', actions: assign({ qcRejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'qcReject' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        AWAIT_REPORT: { target: 'pendingReport', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'pendingReport' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
      },
    },
    // 后端 QC_PASS: [PENDING_REPORT, IMAGE_READY, QC_REJECT]
    qcPass: {
      on: {
        AWAIT_REPORT: { target: 'pendingReport', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'pendingReport' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        IMAGES_READY: { target: 'imageAvailable', actions: assign({ imageCount: ({ event }) => event.imageCount, history: ({ context, event }) => [...context.history, { state: 'imageAvailable' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        QC_REJECT: { target: 'qcReject', actions: assign({ qcRejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'qcReject' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 QC_REJECT: [IN_PROGRESS, PENDING_REPORT]
    qcReject: {
      on: {
        START_EXAM: { target: 'inProgress', actions: assign({ technologistId: ({ event }) => event.technologistId, qcRejectReason: null, history: ({ context, event }) => [...context.history, { state: 'inProgress' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: '质控退回重拍' }] }) },
        IMAGES_READY: { target: 'imageAvailable', actions: assign({ imageCount: ({ event }) => event.imageCount, history: ({ context, event }) => [...context.history, { state: 'imageAvailable' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        AWAIT_REPORT: { target: 'pendingReport', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'pendingReport' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
      },
    },
    // 后端 PENDING_REPORT: [IMAGE_READY, QC_REJECT]
    pendingReport: {
      on: {
        IMAGES_READY: { target: 'imageAvailable', actions: assign({ imageCount: ({ event }) => event.imageCount, history: ({ context, event }) => [...context.history, { state: 'imageAvailable' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by }] }) },
        QC_REJECT: { target: 'qcReject', actions: assign({ qcRejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'qcReject' as ExamStateName, timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    cancelled: { type: 'final' },
  },
  });
}

export const examMachine = buildExamMachine();

export type ExamMachine = typeof examMachine;

export function createExamMachine(initialContext?: Partial<ExamContext>): ExamMachine {
  return buildExamMachine(initialContext) as ExamMachine;
}

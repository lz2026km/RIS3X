/**
 * G005 放射RIS系统 v3.0.0 - 危急值 5 步闭环状态机
 * 5步闭环: found → notified → voice_called → acknowledged → receipted → resolving → resolved
 *   任意时刻可: escalate(升级) / cancel(取消)
 */

import { createMachine, assign } from 'xstate';

/** 危急值状态 */
export type CriticalStateName =
  | 'found'         // 发现危急值
  | 'notified'      // 已通知
  | 'voice_called'  // 电话通知
  | 'acknowledged'  // 已确认
  | 'receipted'     // 临床回执
  | 'resolving'     // 处理中
  | 'resolved'      // 已闭环
  | 'closed_loop'   // 闭环确认
  | 'escalated'     // 已升级
  | 'cancelled';    // 已取消

/** 危急值状态中文映射 */
export const CRITICAL_STATE_LABEL: Record<CriticalStateName, string> = {
  found: '已发现',
  notified: '已通知',
  voice_called: '电话通知',
  acknowledged: '已确认',
  receipted: '临床回执',
  resolving: '处理中',
  resolved: '已闭环',
  closed_loop: '闭环确认',
  escalated: '已升级',
  cancelled: '已取消',
};

/** 通知方式 */
export type NotificationMethod = 'phone' | 'sms' | 'system' | 'email' | 'wechat' | 'dingtalk';

/** 危急值上下文 */
export interface CriticalContext {
  criticalId: string;
  reportId: string;
  examId: string;
  patientId: string;
  patientName: string;
  finding: string;
  /** 国家卫健委 2024 版 15 类目录编码 */
  category: string;
  severity: 'critical' | 'urgent' | 'high';
  reportedBy: string;       // 上报医生
  reportedAt: string;
  notifiedTo: string | null;  // 接收医生
  notifiedAt: string | null;
  notificationMethod: NotificationMethod | null;
  notificationAttempts: number;
  voiceCalledBy: string | null;
  voiceCalledAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  confirmedSignature: string | null;
  confirmedComment: string | null;
  processingDoctor: string | null;
  processingAt: string | null;
  processingNote: string | null;
  resolvedAt: string | null;
  closedLoopConfirmedBy: string | null;
  closedLoopConfirmedAt: string | null;
  closedLoopConclusion: string | null;
  escalatedTo: string | null;
  escalatedAt: string | null;
  /** 超时阈值(分钟) */
  notifyTimeoutMinutes: number;
  acknowledgeTimeoutMinutes: number;
  history: CriticalStateEvent[];
}

export interface CriticalStateEvent {
  state: CriticalStateName;
  timestamp: string;
  actorId: string;
  note?: string;
}

/** 危急值事件 */
export type CriticalEvent =
  | { type: 'NOTIFY'; to: string; method: NotificationMethod; by: string }
  | { type: 'NOTIFY_FAILED'; by: string }
  | { type: 'VOICE_CALL'; by: string; phoneNumber: string }
  | { type: 'ACKNOWLEDGE'; by: string }
  | { type: 'RECEIPT'; by: string; signature?: string; comment?: string }
  | { type: 'START_PROCESSING'; doctorId: string; note?: string }
  | { type: 'COMPLETE_PROCESSING'; note: string }
  | { type: 'ESCALATE'; to: string; reason: string }
  | { type: 'CONFIRM_CLOSED_LOOP'; by: string; conclusion: string }
  | { type: 'CANCEL'; reason: string };

const initialContext = (input: {
  criticalId: string;
  reportId: string;
  examId: string;
  patientId: string;
  patientName: string;
  finding: string;
  category: string;
  severity: 'critical' | 'urgent' | 'high';
  reportedBy: string;
  reportedAt: string;
}): CriticalContext => ({
  ...input,
  notifiedTo: null,
  notifiedAt: null,
  notificationMethod: null,
  notificationAttempts: 0,
  voiceCalledBy: null,
  voiceCalledAt: null,
  acknowledgedBy: null,
  acknowledgedAt: null,
  confirmedBy: null,
  confirmedAt: null,
  confirmedSignature: null,
  confirmedComment: null,
  processingDoctor: null,
  processingAt: null,
  processingNote: null,
  resolvedAt: null,
  closedLoopConfirmedBy: null,
  closedLoopConfirmedAt: null,
  closedLoopConclusion: null,
  escalatedTo: null,
  escalatedAt: null,
  notifyTimeoutMinutes: 5,    // 通知超时 5 分钟
  acknowledgeTimeoutMinutes: 10,  // 确认超时 10 分钟
  history: [
    { state: 'found', timestamp: input.reportedAt, actorId: input.reportedBy },
  ],
});

/** 危急值 5 节点状态机 */
export const criticalValueMachine = createMachine({
  id: 'criticalValue',
  initial: 'found',
  context: ({ input }: { input: Parameters<typeof initialContext>[0] }) => initialContext(input),
  types: {} as { context: CriticalContext; events: CriticalEvent; input: Parameters<typeof initialContext>[0] },
  states: {
    found: {
      on: {
        NOTIFY: {
          target: 'notified',
          actions: assign({
            notifiedTo: ({ event }) => event.to,
            notifiedAt: () => new Date().toISOString(),
            notificationMethod: ({ event }) => event.method,
            notificationAttempts: ({ context }) => context.notificationAttempts + 1,
            history: ({ context, event }) => [...context.history, { state: 'notified', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
        NOTIFY_FAILED: {
          actions: assign({
            notificationAttempts: ({ context }) => context.notificationAttempts + 1,
          }),
        },
        ESCALATE: {
          target: 'escalated',
          actions: assign({
            escalatedTo: ({ event }) => event.to,
            escalatedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: event.to, note: event.reason }],
          }),
        },
        CANCEL: {
          target: 'cancelled',
          actions: assign({
            history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }],
          }),
        },
      },
    },

    notified: {
      on: {
        VOICE_CALL: {
          target: 'voice_called',
          actions: assign({
            voiceCalledBy: ({ event }) => event.by,
            voiceCalledAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'voice_called', timestamp: new Date().toISOString(), actorId: event.by, note: event.phoneNumber }],
          }),
        },
        ACKNOWLEDGE: {
          target: 'acknowledged',
          actions: assign({
            acknowledgedBy: ({ event }) => event.by,
            acknowledgedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'acknowledged', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
        NOTIFY_FAILED: {
          actions: assign({
            notificationAttempts: ({ context }) => context.notificationAttempts + 1,
          }),
        },
        ESCALATE: {
          target: 'escalated',
          actions: assign({
            escalatedTo: ({ event }) => event.to,
            escalatedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: event.to, note: event.reason }],
          }),
        },
        CANCEL: {
          target: 'cancelled',
          actions: assign({
            history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }],
          }),
        },
      },
    },

    voice_called: {
      on: {
        ACKNOWLEDGE: {
          target: 'acknowledged',
          actions: assign({
            acknowledgedBy: ({ event }) => event.by,
            acknowledgedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'acknowledged', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
        ESCALATE: {
          target: 'escalated',
          actions: assign({
            escalatedTo: ({ event }) => event.to,
            escalatedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: event.to, note: event.reason }],
          }),
        },
        CANCEL: {
          target: 'cancelled',
          actions: assign({
            history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }],
          }),
        },
      },
    },

    acknowledged: {
      on: {
        RECEIPT: {
          target: 'receipted',
          actions: assign({
            confirmedBy: ({ event }) => event.by,
            confirmedAt: () => new Date().toISOString(),
            confirmedSignature: ({ event }) => event.signature ?? null,
            confirmedComment: ({ event }) => event.comment ?? null,
            history: ({ context, event }) => [...context.history, { state: 'receipted', timestamp: new Date().toISOString(), actorId: event.by, note: event.comment }],
          }),
        },
        START_PROCESSING: {
          target: 'resolving',
          actions: assign({
            processingDoctor: ({ event }) => event.doctorId,
            processingAt: () => new Date().toISOString(),
            processingNote: ({ event }) => event.note ?? null,
            history: ({ context, event }) => [...context.history, { state: 'resolving', timestamp: new Date().toISOString(), actorId: event.doctorId }],
          }),
        },
        ESCALATE: {
          target: 'escalated',
          actions: assign({
            escalatedTo: ({ event }) => event.to,
            escalatedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: event.to, note: event.reason }],
          }),
        },
      },
    },

    receipted: {
      on: {
        START_PROCESSING: {
          target: 'resolving',
          actions: assign({
            processingDoctor: ({ event }) => event.doctorId,
            processingAt: () => new Date().toISOString(),
            processingNote: ({ event }) => event.note ?? null,
            history: ({ context, event }) => [...context.history, { state: 'resolving', timestamp: new Date().toISOString(), actorId: event.doctorId }],
          }),
        },
        ESCALATE: {
          target: 'escalated',
          actions: assign({
            escalatedTo: ({ event }) => event.to,
            escalatedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: event.to, note: event.reason }],
          }),
        },
      },
    },

    resolving: {
      on: {
        COMPLETE_PROCESSING: {
          target: 'resolved',
          actions: assign({
            resolvedAt: () => new Date().toISOString(),
            processingNote: ({ event }) => event.note,
            history: ({ context, event }) => [...context.history, { state: 'resolved', timestamp: new Date().toISOString(), actorId: context.processingDoctor ?? 'unknown', note: event.note }],
          }),
        },
        ESCALATE: {
          target: 'escalated',
          actions: assign({
            escalatedTo: ({ event }) => event.to,
            escalatedAt: () => new Date().toISOString(),
            history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: event.to, note: event.reason }],
          }),
        },
      },
    },

    resolved: {
      on: {
        CONFIRM_CLOSED_LOOP: {
          target: 'closed_loop',
          actions: assign({
            closedLoopConfirmedBy: ({ event }) => event.by,
            closedLoopConfirmedAt: () => new Date().toISOString(),
            closedLoopConclusion: ({ event }) => event.conclusion,
            history: ({ context, event }) => [...context.history, { state: 'closed_loop', timestamp: new Date().toISOString(), actorId: event.by, note: event.conclusion }],
          }),
        },
        CANCEL: {
          target: 'cancelled',
          actions: assign({
            history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }],
          }),
        },
      },
    },
    closed_loop: { type: 'final' },
    escalated: {
      on: {
        ACKNOWLEDGE: {
          target: 'acknowledged',
          actions: assign({
            acknowledgedBy: ({ event }) => event.by,
            acknowledgedAt: () => new Date().toISOString(),
          }),
        },
        CANCEL: {
          target: 'cancelled',
          actions: assign({
            history: ({ context, event }) => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }],
          }),
        },
      },
    },
    cancelled: { type: 'final' },
  },
});

export type CriticalMachine = typeof criticalValueMachine;

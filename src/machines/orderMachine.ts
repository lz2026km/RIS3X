/**
 * G005 放射RIS系统 v3.0.2.10 - 检查申请/预约 状态机
 *
 * [v3.0.6.11-107] 审计对齐: 后端 `backend/src/appointments/appointments.service.ts`
 *   `APPOINTMENT_TRANSITIONS` 权威主链:
 *     SCHEDULED → CONFIRMED → REGISTERED → CHECKED_IN → IN_PROGRESS → COMPLETED
 *   侧链: SCHEDULED/CONFIRMED/REGISTERED/CHECKED_IN → CANCELLED / NO_SHOW; IN_PROGRESS → CANCELLED
 *   终态: COMPLETED / CANCELLED / NO_SHOW
 *   前端 camelCase: scheduled, confirmed, registered, checkedIn, inProgress, completed,
 *     cancelled, noShow
 *
 * 与旧版差异 (旧版序列反转 + 缺态):
 *   - 旧版: scheduled → registered → confirmed (顺序与后端相反)
 *   - 新版: scheduled → confirmed → registered → checkedIn (对齐后端)
 *   - 补齐 checkedIn (CHECKED_IN) / noShow (NO_SHOW) / inProgress / completed
 *   - 保留申请审批前缀 submitted / approved / rejected (后端 Appointment 侧无此二态,
 *     属前端申请单流程的 superset 扩展)
 */
import { createMachine, assign } from 'xstate';

export type OrderStateName =
  | 'submitted' | 'approved' | 'scheduled' | 'confirmed' | 'registered'
  | 'checkedIn' | 'inProgress' | 'completed' | 'cancelled' | 'rejected' | 'noShow';

export const ORDER_STATE_LABEL: Record<OrderStateName, string> = {
  submitted: '已提交', approved: '已审批', scheduled: '已排程', confirmed: '已确认',
  registered: '已登记', checkedIn: '已报到', inProgress: '检查中', completed: '已完成',
  cancelled: '已取消', rejected: '已退回', noShow: '已失约',
};

export interface OrderContext {
  orderId: string; patientId: string; examItemId: string; modality: string; bodyPart: string;
  requestedBy: string; approvedBy: string | null; scheduledAt: string | null;
  priority: string; clinicalDiagnosis: string; rejectionReason: string | null; history: OrderStateEvent[];
}

export interface OrderStateEvent { state: OrderStateName; timestamp: string; actorId: string; note?: string; }

export type OrderEvent =
  | { type: 'APPROVE'; by: string }
  | { type: 'REJECT'; reason: string; by: string }
  | { type: 'SCHEDULE'; scheduledAt?: string; by: string }
  | { type: 'CONFIRM'; by: string }
  | { type: 'REGISTER'; by: string }
  | { type: 'CHECK_IN'; by: string }
  | { type: 'START'; by: string }
  | { type: 'COMPLETE'; by: string }
  | { type: 'NO_SHOW'; reason?: string; by: string }
  | { type: 'CANCEL'; reason: string; by: string };

function initOrder(input: { orderId: string; patientId: string; examItemId: string; modality: string; bodyPart: string; requestedBy: string; priority?: string; clinicalDiagnosis?: string }): OrderContext {
  return { ...input, approvedBy: null, scheduledAt: null, priority: input.priority ?? 'normal', clinicalDiagnosis: input.clinicalDiagnosis ?? '', rejectionReason: null, history: [] };
}

export const orderMachine = createMachine({
  id: 'order',
  initial: 'submitted',
  context: ({ input }: { input: Parameters<typeof initOrder>[0] }) => initOrder(input),
  types: {} as { context: OrderContext; events: OrderEvent; input: Parameters<typeof initOrder>[0] },
  states: {
    // 前端申请单前缀 (后端 Appointment 从 SCHEDULED 起)
    submitted: {
      on: {
        APPROVE: { target: 'approved', actions: assign({ approvedBy: ({ event }) => event.by, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'approved', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        REJECT: { target: 'rejected', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    approved: {
      on: {
        SCHEDULE: { target: 'scheduled', actions: assign({ scheduledAt: ({ event }) => event.scheduledAt ?? new Date().toISOString(), history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'scheduled', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 SCHEDULED: [CONFIRMED, REGISTERED, CHECKED_IN, CANCELLED, NO_SHOW]
    scheduled: {
      on: {
        CONFIRM: { target: 'confirmed', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'confirmed', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        REGISTER: { target: 'registered', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'registered', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CHECK_IN: { target: 'checkedIn', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'checkedIn', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        NO_SHOW: { target: 'noShow', actions: assign({ rejectionReason: ({ event }) => event.reason ?? null, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'noShow', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 CONFIRMED: [REGISTERED, CHECKED_IN, CANCELLED, NO_SHOW]
    confirmed: {
      on: {
        REGISTER: { target: 'registered', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'registered', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CHECK_IN: { target: 'checkedIn', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'checkedIn', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        NO_SHOW: { target: 'noShow', actions: assign({ rejectionReason: ({ event }) => event.reason ?? null, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'noShow', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 REGISTERED: [CHECKED_IN, CANCELLED, NO_SHOW]
    registered: {
      on: {
        CHECK_IN: { target: 'checkedIn', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'checkedIn', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        NO_SHOW: { target: 'noShow', actions: assign({ rejectionReason: ({ event }) => event.reason ?? null, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'noShow', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 CHECKED_IN: [IN_PROGRESS, CANCELLED, NO_SHOW]
    checkedIn: {
      on: {
        START: { target: 'inProgress', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'inProgress', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        NO_SHOW: { target: 'noShow', actions: assign({ rejectionReason: ({ event }) => event.reason ?? null, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'noShow', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    // 后端 IN_PROGRESS: [COMPLETED, CANCELLED]
    inProgress: {
      on: {
        COMPLETE: { target: 'completed', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'completed', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    completed: { type: 'final' },
    cancelled: { type: 'final' },
    rejected: { type: 'final' },
    noShow: { type: 'final' },
  },
});

export type OrderMachine = typeof orderMachine;

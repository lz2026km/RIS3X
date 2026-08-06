/**
 * G005 放射RIS系统 v3.0.2.10 - 检查申请/排程 6 态状态机
 */
import { createMachine, assign } from 'xstate';

export type OrderStateName = 'submitted' | 'approved' | 'scheduled' | 'confirmed' | 'cancelled' | 'rejected';

export const ORDER_STATE_LABEL: Record<OrderStateName, string> = {
  submitted: '已提交', approved: '已审批', scheduled: '已排程', confirmed: '已确认', cancelled: '已取消', rejected: '已退回',
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
    submitted: {
      on: {
        APPROVE: { target: 'approved', actions: assign({ approvedBy: ({ event }) => event.by, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'approved', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        REJECT: { target: 'rejected', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: event.by, note: event.reason }] }) },
      },
    },
    approved: {
      on: {
        SCHEDULE: { target: 'scheduled', actions: assign({ scheduledAt: ({ event }) => event.scheduledAt ?? new Date().toISOString(), history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'scheduled', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: 'system', note: event.reason }] }) },
      },
    },
    scheduled: {
      on: {
        CONFIRM: { target: 'confirmed', actions: assign({ history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'confirmed', timestamp: new Date().toISOString(), actorId: event.by }] }) },
        CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: 'system', note: event.reason }] }) },
      },
    },
    confirmed: { on: { CANCEL: { target: 'cancelled', actions: assign({ rejectionReason: ({ event }) => event.reason, history: ({ context, event }): OrderStateEvent[] => [...context.history, { state: 'cancelled', timestamp: new Date().toISOString(), actorId: 'system', note: event.reason }] }) } } },
    cancelled: { type: 'final' },
    rejected: { type: 'final' },
  },
});

export type OrderMachine = typeof orderMachine;

/**
 * G005 放射RIS系统 v3.0.0 - 设备 5 态状态机
 * Phase T3-W6: XState 5 完整落地
 *
 * 设备 5 态:
 *   idle(空闲) → inUse(使用中) → maintenance(维护中) → broken(故障) → offline(离线)
 *   任意时刻可: startUse / completeUse / startMaintenance / completeMaintenance / reportFault / repair / goOffline / goOnline
 */

import { createMachine, assign } from 'xstate';

export type DeviceStateName =
  | 'idle'        // 空闲
  | 'inUse'       // 使用中
  | 'maintenance' // 维护中
  | 'broken'      // 故障
  | 'offline';    // 离线

export const DEVICE_STATE_LABEL: Record<DeviceStateName, string> = {
  idle: '空闲',
  inUse: '使用中',
  maintenance: '维护中',
  broken: '故障',
  offline: '离线',
};

export interface DeviceContext {
  deviceId: string;
  deviceCode: string;
  modality: 'CT' | 'MR' | 'DR' | 'DSA' | 'US' | 'MG' | 'PET' | 'SPECT';
  currentPatientId: string | null;
  currentExamId: string | null;
  startedAt: string | null;
  todayExamCount: number;
  todayUsageMinutes: number;
  utilizationRate: number;  // 0-1
  lastMaintenanceAt: string | null;
  nextMaintenanceAt: string | null;
  faultReason: string | null;
  history: DeviceStateEvent[];
}

export interface DeviceStateEvent {
  state: DeviceStateName;
  timestamp: string;
  actorId: string;
  reason?: string;
}

export type DeviceEvent =
  | { type: 'START_USE'; patientId: string; examId: string; by: string }
  | { type: 'COMPLETE_USE'; by: string }
  | { type: 'START_MAINTENANCE'; by: string; notes: string }
  | { type: 'COMPLETE_MAINTENANCE'; by: string }
  | { type: 'REPORT_FAULT'; reason: string; by: string }
  | { type: 'REPAIR_COMPLETE'; by: string }
  | { type: 'GO_OFFLINE'; reason: string; by: string }
  | { type: 'GO_ONLINE'; by: string };

const initialContext = (input: {
  deviceId: string;
  deviceCode: string;
  modality: DeviceContext['modality'];
}): DeviceContext => ({
  ...input,
  currentPatientId: null,
  currentExamId: null,
  startedAt: null,
  todayExamCount: 0,
  todayUsageMinutes: 0,
  utilizationRate: 0,
  lastMaintenanceAt: null,
  nextMaintenanceAt: null,
  faultReason: null,
  history: [],
});

export const deviceMachine = createMachine({
  id: 'device',
  initial: 'idle',
  context: ({ input }: { input: Parameters<typeof initialContext>[0] }) => initialContext(input),
  types: {} as { context: DeviceContext; events: DeviceEvent; input: Parameters<typeof initialContext>[0] },
  states: {
    idle: {
      on: {
        START_USE: {
          target: 'inUse',
          actions: assign({
            currentPatientId: ({ event }) => event.patientId,
            currentExamId: ({ event }) => event.examId,
            startedAt: () => new Date().toISOString(),
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'inUse', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
        START_MAINTENANCE: {
          target: 'maintenance',
          actions: assign({
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'maintenance', timestamp: new Date().toISOString(), actorId: event.by, reason: event.notes }],
          }),
        },
        REPORT_FAULT: {
          target: 'broken',
          actions: assign({
            faultReason: ({ event }) => event.reason,
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'broken', timestamp: new Date().toISOString(), actorId: event.by, reason: event.reason }],
          }),
        },
        GO_OFFLINE: {
          target: 'offline',
          actions: assign({
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'offline', timestamp: new Date().toISOString(), actorId: event.by, reason: event.reason }],
          }),
        },
      },
    },

    inUse: {
      on: {
        COMPLETE_USE: {
          target: 'idle',
          actions: assign({
            currentPatientId: null,
            currentExamId: null,
            startedAt: null,
            todayExamCount: ({ context }) => context.todayExamCount + 1,
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'idle', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
        REPORT_FAULT: {
          target: 'broken',
          actions: assign({
            faultReason: ({ event }) => event.reason,
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'broken', timestamp: new Date().toISOString(), actorId: event.by, reason: event.reason }],
          }),
        },
        GO_OFFLINE: {
          target: 'offline',
          actions: assign({
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'offline', timestamp: new Date().toISOString(), actorId: event.by, reason: event.reason }],
          }),
        },
      },
    },

    maintenance: {
      on: {
        COMPLETE_MAINTENANCE: {
          target: 'idle',
          actions: assign({
            lastMaintenanceAt: () => new Date().toISOString(),
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'idle', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
        REPORT_FAULT: {
          target: 'broken',
          actions: assign({
            faultReason: ({ event }) => event.reason,
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'broken', timestamp: new Date().toISOString(), actorId: event.by, reason: event.reason }],
          }),
        },
      },
    },

    broken: {
      on: {
        REPAIR_COMPLETE: {
          target: 'idle',
          actions: assign({
            faultReason: null,
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'idle', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
        START_MAINTENANCE: {
          target: 'maintenance',
          actions: assign({
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'maintenance', timestamp: new Date().toISOString(), actorId: event.by, reason: event.notes }],
          }),
        },
        GO_OFFLINE: {
          target: 'offline',
          actions: assign({
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'offline', timestamp: new Date().toISOString(), actorId: event.by, reason: event.reason }],
          }),
        },
      },
    },

    offline: {
      on: {
        GO_ONLINE: {
          target: 'idle',
          actions: assign({
            history: ({ context, event }): DeviceStateEvent[] => [...context.history, { state: 'idle', timestamp: new Date().toISOString(), actorId: event.by }],
          }),
        },
      },
    },
  },
});

export type DeviceMachine = typeof deviceMachine;

/**
 * G005 放射RIS系统 v3.0.2.10 - 报告 21 态状态机 (对齐 backend REPORT_TRANSITIONS v3.0.6.11-73)
 * 双阶段审核: 初审(主治) → 终审(主任) → CoSign(双签)
 * 守卫: PUBLISH 前置 qualityScore >= 60, REJECT 必须填写原因
 */
import { createMachine, assign } from 'xstate';

export type ReportStateName =
  | 'pendingAssignment' | 'assigned' | 'writing' | 'submitted'
  | 'initialReview' | 'finalReview' | 'coSignReview' | 'reviewed'
  | 'signing' | 'signed' | 'published'
  | 'amending' | 'amended' | 'withdrawn' | 'rejected' | 'escalated' | 'archived'
  | 'rectifying' | 'supplementing' | 'supplemented'
  | 'redistributing';

export const REPORT_STATE_LABEL: Record<ReportStateName, string> = {
  pendingAssignment: '待分配', assigned: '已分配', writing: '书写中', submitted: '已提交',
  initialReview: '初审中', finalReview: '终审中', coSignReview: 'CoSign双签', reviewed: '已审核',
  signing: '签发中', signed: '已签发', published: '已发布',
  amending: '修订中', amended: '已修订', withdrawn: '已撤回', rejected: '已驳回', escalated: '已升级', archived: '已归档',
  rectifying: '整改中', supplementing: '补充中', supplemented: '已补充',
  redistributing: '跨院区重分配',
};

export const REPORT_STATE_GROUPS = {
  draft: ['pendingAssignment', 'assigned', 'writing'],
  review: ['submitted', 'initialReview', 'finalReview', 'coSignReview', 'reviewed'],
  sign: ['signing', 'signed'],
  published: ['published'],
  special: ['amending', 'amended', 'withdrawn', 'rejected', 'escalated', 'archived', 'rectifying', 'supplementing', 'supplemented', 'redistributing'],
};

export interface ReportContext {
  reportId: string; patientId: string; radiologistId: string;
  findings: string; diagnosis: string; impression: string; recommendations: string;
  rejectReason: string | null; reviewerId: string | null;
  signedAt: string | null; amendmentReason: string | null;
  rectifyingReason: string | null; supplementNote: string | null;
  qualityScore: number; coSignerId: string | null; coSignedAt: string | null;
  rectificationCount?: number;
  supplementCount?: number;
  history: ReportStateEvent[];
}

export interface ReportStateEvent { state: string; timestamp: string; actorId: string; note?: string; }

export type ReportEvent =
  | { type: 'ASSIGN'; radiologistId: string }
  | { type: 'START_WRITING' }
  | { type: 'UPDATE_CONTENT'; findings?: string; diagnosis?: string; impression?: string; recommendations?: string }
  | { type: 'SUBMIT' }
  | { type: 'START_INITIAL_REVIEW'; reviewerId: string }
  | { type: 'APPROVE_INITIAL' }
  | { type: 'APPROVE_REVIEWED' }
  | { type: 'START_FINAL_REVIEW'; reviewerId: string }
  | { type: 'APPROVE_FINAL' }
  | { type: 'COMPLETE_CO_SIGN'; coSignerId: string }
  | { type: 'REJECT'; reason: string }
  | { type: 'RESTART' }
  | { type: 'START_SIGN' }
  | { type: 'COMPLETE_SIGN'; signedAt?: string }
  | { type: 'PUBLISH'; qualityScore?: number }
  | { type: 'WITHDRAW' }
  | { type: 'START_AMEND'; reason: string }
  | { type: 'COMPLETE_AMEND' }
  | { type: 'COMPLETE_RECTIFY' }
  | { type: 'ABORT_RECTIFY' }
  | { type: 'START_SUPPLEMENT' }
  | { type: 'COMPLETE_SUPPLEMENT'; supplementNote?: string }
  | { type: 'START_REDISTRIBUTE'; targetDoctorId: string; reason: string }
  | { type: 'COMPLETE_REDISTRIBUTE'; targetDoctorId: string }
  | { type: 'CANCEL_REDISTRIBUTE' }
  | { type: 'ESCALATE'; reason: string }
  | { type: 'RESOLVE_ESCALATION' }
  | { type: 'START_RECTIFY'; reason?: string }
  | { type: 'ARCHIVE' };

function initReport(input: { reportId: string; patientId: string; radiologistId: string }): ReportContext {
  return {
    ...input, findings: '', diagnosis: '', impression: '', recommendations: '',
    rejectReason: null, reviewerId: null, signedAt: null, amendmentReason: null,
    rectifyingReason: null, supplementNote: null,
    qualityScore: 0, coSignerId: null, coSignedAt: null,
    rectificationCount: 0,
    supplementCount: 0,
    history: [{ state: 'pendingAssignment', timestamp: new Date().toISOString(), actorId: input.radiologistId }],
  };
}

export const reportMachine = createMachine({
  id: 'report',
  initial: 'pendingAssignment',
  context: ({ input }: { input: Parameters<typeof initReport>[0] }) => initReport(input),
  types: {} as { context: ReportContext; events: ReportEvent; input: Parameters<typeof initReport>[0] },
  states: {
    pendingAssignment: {
      on: {
        ASSIGN: { target: 'assigned', actions: assign({ radiologistId: ({ event }) => event.radiologistId, history: ({ context, event }) => [...context.history, { state: 'assigned', timestamp: new Date().toISOString(), actorId: event.radiologistId }] }) },
        // 后端 REPORT_TRANSITIONS.PENDING_ASSIGNMENT: [ASSIGNED, WRITING]
        START_WRITING: { target: 'writing', actions: assign({ history: ({ context }) => [...context.history, { state: 'writing', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        WITHDRAW: { target: 'withdrawn', actions: assign({ history: ({ context }) => [...context.history, { state: 'withdrawn', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        ARCHIVE: { target: 'archived', actions: assign({ history: ({ context }) => [...context.history, { state: 'archived', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
      },
    },
    assigned: {
      on: {
        ASSIGN: { target: 'assigned', actions: assign({ radiologistId: ({ event }) => event.radiologistId, history: ({ context, event }) => [...context.history, { state: 'assigned', timestamp: new Date().toISOString(), actorId: event.radiologistId }] }) },
        START_WRITING: { target: 'writing', actions: assign({ history: ({ context }) => [...context.history, { state: 'writing', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        // 后端 ASSIGNED: [WRITING, REDISTRIBUTING]
        START_REDISTRIBUTE: { target: 'redistributing', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'redistributing', timestamp: new Date().toISOString(), actorId: event.targetDoctorId, note: event.reason }] }) },
        WITHDRAW: { target: 'withdrawn', actions: assign({ history: ({ context }) => [...context.history, { state: 'withdrawn', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        ARCHIVE: { target: 'archived', actions: assign({ history: ({ context }) => [...context.history, { state: 'archived', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
      },
    },
    writing: {
      on: {
        UPDATE_CONTENT: { target: 'writing', actions: assign({ findings: ({ context, event }) => event.findings ?? context.findings, diagnosis: ({ context, event }) => event.diagnosis ?? context.diagnosis, impression: ({ context, event }) => event.impression ?? context.impression, recommendations: ({ context, event }) => event.recommendations ?? context.recommendations }) },
        SUBMIT: { target: 'submitted', actions: assign({ history: ({ context }) => [...context.history, { state: 'submitted', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        // 后端 WRITING: [SUBMITTED, REJECTED]
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
        WITHDRAW: { target: 'withdrawn', actions: assign({ history: ({ context }) => [...context.history, { state: 'withdrawn', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        ARCHIVE: { target: 'archived', actions: assign({ history: ({ context }) => [...context.history, { state: 'archived', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
      },
    },
    submitted: {
      on: {
        START_INITIAL_REVIEW: { target: 'initialReview', actions: assign({ reviewerId: ({ event }) => event.reviewerId, history: ({ context, event }) => [...context.history, { state: 'initialReview', timestamp: new Date().toISOString(), actorId: event.reviewerId }] }) },
        // 后端 SUBMITTED: [INITIAL_REVIEW, REJECTED, ESCALATED]
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
        ESCALATE: { target: 'escalated', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
        WITHDRAW: { target: 'withdrawn', actions: assign({ history: ({ context }) => [...context.history, { state: 'withdrawn', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        ARCHIVE: { target: 'archived', actions: assign({ history: ({ context }) => [...context.history, { state: 'archived', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
      },
    },
    initialReview: {
      on: {
        APPROVE_INITIAL: { target: 'finalReview', actions: assign({ history: ({ context }) => [...context.history, { state: 'finalReview', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '' }] }) },
        // 后端 INITIAL_REVIEW: [FINAL_REVIEW, CO_SIGN_REVIEW, REJECTED, ESCALATED]
        // APPROVE_REVIEWED = 初审跳过终审直达双签 (CO_SIGN_REVIEW), 非直达 reviewed
        APPROVE_REVIEWED: { target: 'coSignReview', actions: assign({ history: ({ context }) => [...context.history, { state: 'coSignReview', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '' }] }) },
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '', note: event.reason }] }) },
        ESCALATE: { target: 'escalated', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '', note: event.reason }] }) },
      },
    },
    finalReview: {
      on: {
        APPROVE_FINAL: { target: 'coSignReview', actions: assign({ history: ({ context }) => [...context.history, { state: 'coSignReview', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '' }] }) },
        // 后端 FINAL_REVIEW: [CO_SIGN_REVIEW, REVIEWED, REJECTED, ESCALATED]
        APPROVE_REVIEWED: { target: 'reviewed', actions: assign({ history: ({ context }) => [...context.history, { state: 'reviewed', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '' }] }) },
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '', note: event.reason }] }) },
        ESCALATE: { target: 'escalated', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '', note: event.reason }] }) },
        WITHDRAW: { target: 'withdrawn', actions: assign({ history: ({ context }) => [...context.history, { state: 'withdrawn', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        ARCHIVE: { target: 'archived', actions: assign({ history: ({ context }) => [...context.history, { state: 'archived', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
      },
    },
    coSignReview: {
      on: {
        COMPLETE_CO_SIGN: { target: 'reviewed', actions: assign({ coSignerId: ({ event }) => event.coSignerId, coSignedAt: () => new Date().toISOString(), history: ({ context, event }) => [...context.history, { state: 'reviewed', timestamp: new Date().toISOString(), actorId: event.coSignerId }] }) },
        // 后端 CO_SIGN_REVIEW: [REVIEWED, REJECTED, ESCALATED]
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '', note: event.reason }] }) },
        ESCALATE: { target: 'escalated', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? '', note: event.reason }] }) },
        WITHDRAW: { target: 'withdrawn' },
        ARCHIVE: { target: 'archived' },
      },
    },
    reviewed: {
      on: {
        START_SIGN: { target: 'signing', actions: assign({ history: ({ context }) => [...context.history, { state: 'signing', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        // 后端 REVIEWED: [SIGNING, SIGNED, REJECTED, ESCALATED]
        COMPLETE_SIGN: { target: 'signed', actions: assign({ signedAt: ({ event }) => event.signedAt ?? new Date().toISOString(), history: ({ context }) => [...context.history, { state: 'signed', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
        ESCALATE: { target: 'escalated', actions: assign({ history: ({ context, event }) => [...context.history, { state: 'escalated', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
        ARCHIVE: { target: 'archived' },
      },
    },
    signing: {
      on: {
        COMPLETE_SIGN: { target: 'signed', actions: assign({ signedAt: ({ event }) => event.signedAt ?? new Date().toISOString(), history: ({ context, event }) => [...context.history, { state: 'signed', timestamp: event.signedAt ?? new Date().toISOString(), actorId: context.radiologistId }] }) },
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired' },
      },
    },
    signed: {
      on: {
        PUBLISH: { target: 'published', guard: 'qualityScoreSufficient', actions: assign({ qualityScore: ({ context, event }) => event.qualityScore ?? context.qualityScore, history: ({ context }) => [...context.history, { state: 'published', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        START_AMEND: { target: 'amending', actions: assign({ amendmentReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'amending', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
        // 后端 SIGNED: [PUBLISHED, AMENDING, AMENDED, RECTIFYING, SUPPLEMENTING]
        START_SUPPLEMENT: { target: 'supplementing', guard: 'supplementAttemptsBelowMax', actions: assign({ supplementCount: ({ context }) => (context.supplementCount ?? 0) + 1, history: ({ context }) => [...context.history, { state: 'supplementing', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        START_RECTIFY: { target: 'rectifying', actions: assign({ rectifyingReason: ({ event }) => event.reason ?? null, history: ({ context }) => [...context.history, { state: 'rectifying', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        ARCHIVE: { target: 'archived' },
      },
    },
    published: {
      on: {
        START_AMEND: { target: 'amending', actions: assign({ amendmentReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'amending', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
        // 后端 PUBLISHED: [AMENDING, AMENDED, SUPPLEMENTING, ARCHIVED, PUBLISHED] (含自环补发)
        PUBLISH: { target: 'published', guard: 'qualityScoreSufficient', actions: assign({ qualityScore: ({ context, event }) => event.qualityScore ?? context.qualityScore, history: ({ context }) => [...context.history, { state: 'published', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: '补发' }] }) },
        COMPLETE_AMEND: { target: 'amended', actions: assign({ history: ({ context }) => [...context.history, { state: 'amended', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        START_SUPPLEMENT: {
          target: 'supplementing',
          guard: 'supplementAttemptsBelowMax',
          actions: assign({
            supplementCount: ({ context }) => (context.supplementCount ?? 0) + 1,
            history: ({ context }) => [...context.history, { state: 'supplementing', timestamp: new Date().toISOString(), actorId: context.radiologistId }],
          }),
        },
        ARCHIVE: { target: 'archived' },
      },
    },
    amending: {
      on: {
        UPDATE_CONTENT: { target: 'amending', actions: assign({ findings: ({ context, event }) => event.findings ?? context.findings, diagnosis: ({ context, event }) => event.diagnosis ?? context.diagnosis, impression: ({ context, event }) => event.impression ?? context.impression, recommendations: ({ context, event }) => event.recommendations ?? context.recommendations }) },
        COMPLETE_AMEND: { target: 'amended', actions: assign({ history: ({ context }) => [...context.history, { state: 'amended', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        // 后端 AMENDING: [AMENDED, REJECTED]
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
      },
    },
    amended: {
      on: {
        PUBLISH: { target: 'signed', actions: assign({ signedAt: () => new Date().toISOString(), history: ({ context }) => [...context.history, { state: 'signed', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: '修订后重新签署' }] }) },
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
      },
    },
    withdrawn: { type: 'final' },
    rectifying: {
      on: {
        COMPLETE_RECTIFY: { target: 'reviewed', actions: assign({ rectifyingReason: null, history: ({ context }) => [...context.history, { state: 'reviewed', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: '整改完成' }] }) },
        ABORT_RECTIFY: { target: 'rejected', actions: assign({ history: ({ context }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
      },
    },
    redistributing: {
      on: {
        START_REDISTRIBUTE: { target: 'redistributing', actions: assign({ history: ({ context }) => [...context.history, { state: 'redistributing', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        COMPLETE_REDISTRIBUTE: { target: 'assigned', actions: assign({ radiologistId: ({ event }) => event.targetDoctorId, history: ({ context, event }) => [...context.history, { state: 'assigned', timestamp: new Date().toISOString(), actorId: event.targetDoctorId, note: '跨院区重分配完成' }] }) },
        CANCEL_REDISTRIBUTE: { target: 'pendingAssignment', actions: assign({ history: ({ context }) => [...context.history, { state: 'pendingAssignment', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
      },
    },
    supplementing: {
      on: {
        COMPLETE_SUPPLEMENT: { target: 'supplemented', actions: assign({ supplementNote: ({ event }) => event.supplementNote ?? null, history: ({ context, event }) => [...context.history, { state: 'supplemented', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.supplementNote }] }) },
        // 后端 SUPPLEMENTING: [SUPPLEMENTED, REJECTED]
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
      },
    },
    supplemented: {
      on: {
        PUBLISH: { target: 'published', guard: 'qualityScoreSufficient', actions: assign({ qualityScore: ({ context, event }) => event.qualityScore ?? context.qualityScore, history: ({ context }) => [...context.history, { state: 'published', timestamp: new Date().toISOString(), actorId: context.radiologistId }] }) },
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: event.reason }] }) },
      },
    },
    rejected: {
      on: {
        RESTART: {
          target: 'writing',
          guard: 'rectifyAttemptsBelowMax',
          actions: assign({
            rejectReason: null,
            rectifyingReason: null,
            rectificationCount: ({ context }) => (context.rectificationCount ?? 0) + 1,
            history: ({ context }) => [...context.history, { state: 'writing', timestamp: new Date().toISOString(), actorId: context.radiologistId, note: '驳回后返工书写' }],
          }),
        },
      },
    },
    escalated: {
      // [v3.0.6.11-107] 后端 ESCALATED: [REVIEWED, REJECTED] (旧前端错误指向 writing/archived)
      on: {
        RESOLVE_ESCALATION: { target: 'reviewed', actions: assign({ history: ({ context }) => [...context.history, { state: 'reviewed', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? context.radiologistId, note: '升级处理完成' }] }) },
        REJECT: { target: 'rejected', guard: 'rejectReasonRequired', actions: assign({ rejectReason: ({ event }) => event.reason, history: ({ context, event }) => [...context.history, { state: 'rejected', timestamp: new Date().toISOString(), actorId: context.reviewerId ?? context.radiologistId, note: event.reason }] }) },
      },
    },
    archived: { type: 'final' },
  },
}, {
  guards: {
    rejectReasonRequired: ({ event }) =>
      (event.type === 'REJECT' || event.type === 'START_AMEND') &&
      typeof event.reason === 'string' &&
      event.reason.trim().length > 0,
    qualityScoreSufficient: ({ context, event }) => {
      const incoming = event.type === 'PUBLISH' ? event.qualityScore : undefined;
      return (incoming ?? context.qualityScore) >= 60;
    },
    rectifyAttemptsBelowMax: ({ context }) => (context.rectificationCount ?? 0) < 3,
    supplementAttemptsBelowMax: ({ context }) => (context.supplementCount ?? 0) < 3,
  },
});

export type ReportMachine = typeof reportMachine;

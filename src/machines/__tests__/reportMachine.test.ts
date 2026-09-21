/**
 * G005 放射RIS系统 v3.0.0 - 报告状态机测试
 * Phase T1-W2: 状态机单元测试
 */

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { reportMachine, REPORT_STATE_GROUPS } from '../reportMachine';

const INPUT = { reportId: 'rpt-001', patientId: 'P001', radiologistId: 'D001' };

const startActor = () =>
  createActor(reportMachine, { input: INPUT }).start();

describe('reportMachine - 报告 17 态状态机', () => {
  describe('Draft 三态', () => {
    it('初始为 pendingAssignment', () => {
      const actor = startActor();
      expect(actor.getSnapshot().value).toBe('pendingAssignment');
    });

    it('pendingAssignment → assigned (ASSIGN)', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      expect(actor.getSnapshot().value).toBe('assigned');
      expect(actor.getSnapshot().context.radiologistId).toBe('D002');
      expect(actor.getSnapshot().context.history).toHaveLength(2);
    });

    it('assigned → writing (START_WRITING)', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      expect(actor.getSnapshot().value).toBe('writing');
    });

    it('writing 支持 UPDATE_CONTENT', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({
        type: 'UPDATE_CONTENT',
        findings: '右肺上叶见磨玻璃结节',
        diagnosis: '考虑肺腺癌',
      });
      const ctx = actor.getSnapshot().context;
      expect(ctx.findings).toBe('右肺上叶见磨玻璃结节');
      expect(ctx.diagnosis).toBe('考虑肺腺癌');
      expect(ctx.impression).toBe('');
    });
  });

  describe('Review 五态（三级审核+双签）', () => {
    it('writing → submitted (SUBMIT)', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      expect(actor.getSnapshot().value).toBe('submitted');
    });

    it('submitted → initialReview (START_INITIAL_REVIEW)', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D005' });
      expect(actor.getSnapshot().value).toBe('initialReview');
      expect(actor.getSnapshot().context.reviewerId).toBe('D005');
    });

    it('initialReview → finalReview (APPROVE_INITIAL)', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D005' });
      actor.send({ type: 'APPROVE_INITIAL' });
      expect(actor.getSnapshot().value).toBe('finalReview');
    });

    it('finalReview → coSignReview (APPROVE_FINAL)', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D005' });
      actor.send({ type: 'APPROVE_INITIAL' });
      actor.send({ type: 'APPROVE_FINAL' });
      expect(actor.getSnapshot().value).toBe('coSignReview');
    });

    it('coSignReview → reviewed (COMPLETE_CO_SIGN)', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D005' });
      actor.send({ type: 'APPROVE_INITIAL' });
      actor.send({ type: 'APPROVE_FINAL' });
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: 'D003' });
      expect(actor.getSnapshot().value).toBe('reviewed');
      expect(actor.getSnapshot().context.coSignerId).toBe('D003');
    });
  });

  describe('Sign 二态', () => {
    const toReviewed = () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D005' });
      actor.send({ type: 'APPROVE_INITIAL' });
      actor.send({ type: 'APPROVE_FINAL' });
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: 'D003' });
      return actor;
    };

    it('reviewed → signing (START_SIGN)', () => {
      const actor = toReviewed();
      actor.send({ type: 'START_SIGN' });
      expect(actor.getSnapshot().value).toBe('signing');
    });

    it('signing → signed (COMPLETE_SIGN) 记录签名时间', () => {
      const actor = toReviewed();
      actor.send({ type: 'START_SIGN' });
      const signedAt = '2026-06-06T10:00:00.000Z';
      actor.send({ type: 'COMPLETE_SIGN', signedAt });
      expect(actor.getSnapshot().value).toBe('signed');
      expect(actor.getSnapshot().context.signedAt).toBe(signedAt);
    });
  });

  describe('Published 一态', () => {
    const toSigned = () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D005' });
      actor.send({ type: 'APPROVE_INITIAL' });
      actor.send({ type: 'APPROVE_FINAL' });
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: 'D003' });
      actor.send({ type: 'START_SIGN' });
      actor.send({ type: 'COMPLETE_SIGN', signedAt: '2026-06-06T10:00:00.000Z' });
      return actor;
    };
    const toPublished = () => {
      const actor = toSigned();
      actor.send({ type: 'PUBLISH', qualityScore: 85 });
      return actor;
    };

    it('signed → published (PUBLISH) 需要 qualityScore >= 60', () => {
      const actor = toSigned();
      actor.send({ type: 'PUBLISH', qualityScore: 85 });
      expect(actor.getSnapshot().value).toBe('published');
    });

    it('signed → PUBLISH 被 guards 拒绝 (qualityScore 不足)', () => {
      const actor = toSigned();
      actor.send({ type: 'PUBLISH' });
      expect(actor.getSnapshot().value).not.toBe('published');
    });

    it('published → amending (START_AMEND)', () => {
      const actor = toPublished();
      actor.send({ type: 'START_AMEND', reason: '新增征象' });
      expect(actor.getSnapshot().value).toBe('amending');
      expect(actor.getSnapshot().context.amendmentReason).toBe('新增征象');
    });

    it('amending → amended (COMPLETE_AMEND)', () => {
      const actor = toPublished();
      actor.send({ type: 'START_AMEND', reason: '新增征象' });
      actor.send({ type: 'COMPLETE_AMEND' });
      expect(actor.getSnapshot().value).toBe('amended');
    });
  });

  describe('Special 五态 - 撤回 / 驳回 / 修订 / 归档', () => {
    it('任意草稿态 → withdrawn (WITHDRAW)', () => {
      const actor = startActor();
      actor.send({ type: 'WITHDRAW' });
      expect(actor.getSnapshot().value).toBe('withdrawn');
    });

    it('initialReview → rejected (REJECT) 记录原因', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D003' });
      actor.send({ type: 'REJECT', reason: '描述不完整' });
      expect(actor.getSnapshot().value).toBe('rejected');
      expect(actor.getSnapshot().context.rejectReason).toBe('描述不完整');
    });

    it('rejected → writing (RESTART) 驳回后返工书写', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D003' });
      actor.send({ type: 'REJECT', reason: '需补充' });
      actor.send({ type: 'RESTART' });
      expect(actor.getSnapshot().value).toBe('writing');
    });

    it('initialReview → coSignReview (APPROVE_REVIEWED) 初审跳过终审直达双签', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D003' });
      actor.send({ type: 'APPROVE_REVIEWED' });
      // 后端 INITIAL_REVIEW→CO_SIGN_REVIEW (旧前端误指向 reviewed)
      expect(actor.getSnapshot().value).toBe('coSignReview');
    });

    it('finalReview → reviewed (APPROVE_REVIEWED) 终审跳过双签', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D003' });
      actor.send({ type: 'APPROVE_INITIAL' });
      actor.send({ type: 'APPROVE_REVIEWED' });
      expect(actor.getSnapshot().value).toBe('reviewed');
    });

    it('escalated → reviewed (RESOLVE_ESCALATION) 升级处理完成', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D003' });
      actor.send({ type: 'ESCALATE', reason: '审核争议' });
      expect(actor.getSnapshot().value).toBe('escalated');
      actor.send({ type: 'RESOLVE_ESCALATION' });
      expect(actor.getSnapshot().value).toBe('reviewed');
    });

    it('escalated → rejected (REJECT) 升级后驳回', () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D003' });
      actor.send({ type: 'ESCALATE', reason: '审核争议' });
      actor.send({ type: 'REJECT', reason: '升级复核不通过' });
      expect(actor.getSnapshot().value).toBe('rejected');
    });

    const toReviewed = () => {
      const actor = startActor();
      actor.send({ type: 'ASSIGN', radiologistId: 'D002' });
      actor.send({ type: 'START_WRITING' });
      actor.send({ type: 'SUBMIT' });
      actor.send({ type: 'START_INITIAL_REVIEW', reviewerId: 'D003' });
      actor.send({ type: 'APPROVE_INITIAL' });
      actor.send({ type: 'APPROVE_FINAL' });
      actor.send({ type: 'COMPLETE_CO_SIGN', coSignerId: 'D003' });
      return actor;
    };

    it('amended → signed (PUBLISH) 修订后重新签署', () => {
      const actor = toReviewed();
      actor.send({ type: 'START_SIGN' });
      actor.send({ type: 'COMPLETE_SIGN', signedAt: '2026-06-06T10:00:00.000Z' });
      actor.send({ type: 'PUBLISH', qualityScore: 85 });
      actor.send({ type: 'START_AMEND', reason: '新增征象' });
      actor.send({ type: 'COMPLETE_AMEND' });
      actor.send({ type: 'PUBLISH' });
      expect(actor.getSnapshot().value).toBe('signed');
    });

    it('supplemented → rejected (REJECT) 补充后驳回', () => {
      const actor = toReviewed();
      actor.send({ type: 'START_SIGN' });
      actor.send({ type: 'COMPLETE_SIGN', signedAt: '2026-06-06T10:00:00.000Z' });
      actor.send({ type: 'PUBLISH', qualityScore: 85 });
      actor.send({ type: 'START_SUPPLEMENT' });
      actor.send({ type: 'COMPLETE_SUPPLEMENT' });
      actor.send({ type: 'REJECT', reason: '补充内容不符' });
      expect(actor.getSnapshot().value).toBe('rejected');
    });

    it('任意态 → archived (ARCHIVE)', () => {
      const actor = startActor();
      actor.send({ type: 'ARCHIVE' });
      expect(actor.getSnapshot().value).toBe('archived');
    });
  });

  describe('状态分组（20 态）', () => {
    it('draft 组含 3 态', () => {
      expect(REPORT_STATE_GROUPS.draft).toEqual(['pendingAssignment', 'assigned', 'writing']);
    });
    it('review 组含 5 态（三级审核+双签）', () => {
      expect(REPORT_STATE_GROUPS.review).toEqual(['submitted', 'initialReview', 'finalReview', 'coSignReview', 'reviewed']);
    });
    it('sign 组含 2 态', () => {
      expect(REPORT_STATE_GROUPS.sign).toEqual(['signing', 'signed']);
    });
    it('published 组含 1 态', () => {
      expect(REPORT_STATE_GROUPS.published).toEqual(['published']);
    });
    it('special 组含 10 态（升级/整改/补充/跨院区重分配）', () => {
      expect(REPORT_STATE_GROUPS.special).toEqual(['amending', 'amended', 'withdrawn', 'rejected', 'escalated', 'archived', 'rectifying', 'supplementing', 'supplemented', 'redistributing']);
    });
    it('总 21 态', () => {
      const total = Object.values(REPORT_STATE_GROUPS).flat().length;
      expect(total).toBe(21);
    });
  });
});

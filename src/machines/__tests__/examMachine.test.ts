/**
 * G005 放射RIS系统 v3.0.3.31 - 检查执行状态机测试
 * Phase T1-W2: 状态机单元测试
 * [v3.0.6.11-107] 对齐 backend worklist EXAM_TRANSITIONS (10 态)
 */

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { examMachine, EXAM_STATE_GROUPS } from '../examMachine';

const INPUT = {
  examId: 'ex-001',
  patientId: 'P001',
  modality: 'CT',
  bodyPart: '胸部',
  orderedBy: 'D001',
};

const startActor = () =>
  createActor(examMachine, { input: INPUT }).start();

const toArrived = () => {
  const actor = startActor();
  actor.send({ type: 'ARRIVE', by: 'P001' });
  return actor;
};
const toInProgress = () => {
  const actor = toArrived();
  actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
  return actor;
};
const toImageAvailable = () => {
  const actor = toInProgress();
  actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: 256, by: 'T001' });
  actor.send({ type: 'IMAGES_READY', imageCount: 256, by: 'T001' });
  return actor;
};

describe('examMachine - 检查执行 10 态状态机 (对齐后端)', () => {
  it('初始为 scheduled', () => {
    const actor = startActor();
    expect(actor.getSnapshot().value).toBe('scheduled');
  });

  it('scheduled → arrived (ARRIVE)', () => {
    const actor = startActor();
    actor.send({ type: 'ARRIVE', by: 'P001' });
    expect(actor.getSnapshot().value).toBe('arrived');
  });

  it('arrived → inProgress (START_EXAM) 记录技师', () => {
    const actor = toInProgress();
    expect(actor.getSnapshot().value).toBe('inProgress');
    expect(actor.getSnapshot().context.technologistId).toBe('T001');
  });

  it('inProgress → completed (COMPLETE_EXAM) 记录图像数', () => {
    const actor = toInProgress();
    actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: 256, by: 'T001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('completed');
    expect(ctx.imagesAcquired).toBe(256);
  });

  it('inProgress → paused (PAUSE_EXAM) 记录原因', () => {
    const actor = toInProgress();
    actor.send({ type: 'PAUSE_EXAM', reason: '患者不适', by: 'T001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('paused');
    expect(ctx.pausedReason).toBe('患者不适');
  });

  it('paused → inProgress (RESUME_EXAM) 清除原因', () => {
    const actor = toInProgress();
    actor.send({ type: 'PAUSE_EXAM', reason: '患者不适', by: 'T001' });
    actor.send({ type: 'RESUME_EXAM', by: 'T001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('inProgress');
    expect(ctx.pausedReason).toBeNull();
  });

  it('inProgress → imageAvailable (IMAGES_READY) 后端允许直跳', () => {
    const actor = toInProgress();
    actor.send({ type: 'IMAGES_READY', imageCount: 128, by: 'T001' });
    expect(actor.getSnapshot().value).toBe('imageAvailable');
  });

  it('completed → imageAvailable (IMAGES_READY)', () => {
    const actor = toInProgress();
    actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: 256, by: 'T001' });
    expect(actor.getSnapshot().value).toBe('completed');
    actor.send({ type: 'IMAGES_READY', imageCount: 256, by: 'T001' });
    expect(actor.getSnapshot().value).toBe('imageAvailable');
  });

  it('imageAvailable → qcPass (QC_PASS) 新增后端态', () => {
    const actor = toImageAvailable();
    actor.send({ type: 'QC_PASS', by: 'QC001' });
    expect(actor.getSnapshot().value).toBe('qcPass');
  });

  it('imageAvailable → qcReject (QC_REJECT) 需重做', () => {
    const actor = toImageAvailable();
    actor.send({ type: 'QC_REJECT', reason: '运动伪影', by: 'QC001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('qcReject');
    expect(ctx.qcRejectReason).toBe('运动伪影');
  });

  it('qcPass → pendingReport (AWAIT_REPORT)', () => {
    const actor = toImageAvailable();
    actor.send({ type: 'QC_PASS', by: 'QC001' });
    actor.send({ type: 'AWAIT_REPORT', by: 'QC001' });
    expect(actor.getSnapshot().value).toBe('pendingReport');
  });

  it('qcReject → inProgress (START_EXAM) 质控退回重拍', () => {
    const actor = toImageAvailable();
    actor.send({ type: 'QC_REJECT', reason: '运动伪影', by: 'QC001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    expect(actor.getSnapshot().value).toBe('inProgress');
  });

  it('qcReject → pendingReport (AWAIT_REPORT) 后端允许', () => {
    const actor = toImageAvailable();
    actor.send({ type: 'QC_REJECT', reason: '运动伪影', by: 'QC001' });
    actor.send({ type: 'AWAIT_REPORT', by: 'QC001' });
    expect(actor.getSnapshot().value).toBe('pendingReport');
  });

  it('pendingReport → imageAvailable (IMAGES_READY) 后端允许', () => {
    const actor = toImageAvailable();
    actor.send({ type: 'QC_PASS', by: 'QC001' });
    actor.send({ type: 'AWAIT_REPORT', by: 'QC001' });
    actor.send({ type: 'IMAGES_READY', imageCount: 300, by: 'T001' });
    expect(actor.getSnapshot().value).toBe('imageAvailable');
  });

  it('CANCEL from scheduled 记录原因', () => {
    const actor = startActor();
    actor.send({ type: 'CANCEL', reason: '设备故障', by: 'D002' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('cancelled');
    expect(ctx.rejectionReason).toBe('设备故障');
  });

  it('CANCEL from arrived', () => {
    const actor = toArrived();
    actor.send({ type: 'CANCEL', reason: '患者改约', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('CANCEL from paused', () => {
    const actor = toInProgress();
    actor.send({ type: 'PAUSE_EXAM', reason: '设备故障', by: 'T001' });
    actor.send({ type: 'CANCEL', reason: '改期', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('已移除的前端多余事件 APPROVE_ORDER 不再改变状态', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' } as never);
    expect(actor.getSnapshot().value).toBe('scheduled');
  });

  it('状态分组（order/exam/image/qc/report/final）', () => {
    expect(EXAM_STATE_GROUPS.order).toEqual(['scheduled', 'arrived']);
    expect(EXAM_STATE_GROUPS.exam).toContain('inProgress');
    expect(EXAM_STATE_GROUPS.exam).toContain('paused');
    expect(EXAM_STATE_GROUPS.image).toEqual(['imageAvailable']);
    expect(EXAM_STATE_GROUPS.qc).toEqual(['qcPass', 'qcReject']);
    expect(EXAM_STATE_GROUPS.report).toEqual(['pendingReport']);
    expect(EXAM_STATE_GROUPS.final).toEqual(['cancelled']);
  });
});

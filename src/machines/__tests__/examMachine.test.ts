/**
 * G005 放射RIS系统 v3.0.3.31 - 检查执行状态机测试
 * Phase T1-W2: 状态机单元测试
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

describe('examMachine - 检查执行 14 态状态机', () => {
  it('初始为 ordered', () => {
    const actor = startActor();
    expect(actor.getSnapshot().value).toBe('ordered');
  });

  it('ordered → scheduled (APPROVE_ORDER)', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    expect(actor.getSnapshot().value).toBe('scheduled');
  });

  it('ordered → cancelled (REJECT_ORDER) 记录原因', () => {
    const actor = startActor();
    actor.send({ type: 'REJECT_ORDER', reason: '临床信息不完整', by: 'D002' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('cancelled');
    expect(ctx.rejectionReason).toBe('临床信息不完整');
  });

  it('scheduled → registered (REGISTER) 记录 room/device', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('registered');
    expect(ctx.roomId).toBe('R1');
    expect(ctx.deviceId).toBe('CT-1');
  });

  it('registered → arrived (ARRIVE)', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    expect(actor.getSnapshot().value).toBe('arrived');
  });

  it('arrived → inProgress (START_EXAM) 记录技师', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('inProgress');
    expect(ctx.technologistId).toBe('T001');
  });

  it('inProgress → completed (COMPLETE_EXAM) 记录图像数', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: 256, by: 'T001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('completed');
    expect(ctx.imagesAcquired).toBe(256);
  });

  it('inProgress → paused (PAUSE_EXAM) 记录原因', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    actor.send({ type: 'PAUSE_EXAM', reason: '患者不适', by: 'T001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('paused');
    expect(ctx.pausedReason).toBe('患者不适');
  });

  it('paused → inProgress (RESUME_EXAM) 清除原因', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    actor.send({ type: 'PAUSE_EXAM', reason: '患者不适', by: 'T001' });
    actor.send({ type: 'RESUME_EXAM', by: 'T001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('inProgress');
    expect(ctx.pausedReason).toBeNull();
  });

  it('imageAvailable → qcReject (QC_REJECT) 需重做', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: 256, by: 'T001' });
    actor.send({ type: 'IMAGES_READY', imageCount: 256, by: 'T001' });
    expect(actor.getSnapshot().value).toBe('imageAvailable');
    actor.send({ type: 'QC_REJECT', reason: '运动伪影', by: 'QC001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('qcReject');
    expect(ctx.qcRejectReason).toBe('运动伪影');
  });

  it('imageAvailable → pendingReport (QC_PASS)', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    actor.send({ type: 'COMPLETE_EXAM', imagesAcquired: 256, by: 'T001' });
    actor.send({ type: 'IMAGES_READY', imageCount: 256, by: 'T001' });
    actor.send({ type: 'QC_PASS', by: 'QC001' });
    expect(actor.getSnapshot().value).toBe('pendingReport');
  });

  it('CANCEL from scheduled 记录原因', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'CANCEL', reason: '设备故障', by: 'D002' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('cancelled');
    expect(ctx.rejectionReason).toBe('设备故障');
  });

  it('CANCEL from registered', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'CANCEL', reason: '患者改约', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('CANCEL from arrived', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'CANCEL', reason: '患者拒绝', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('CANCEL from paused', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE_ORDER', by: 'D002' });
    actor.send({ type: 'REGISTER', roomId: 'R1', deviceId: 'CT-1', by: 'D001' });
    actor.send({ type: 'ARRIVE', by: 'P001' });
    actor.send({ type: 'START_EXAM', by: 'T001', technologistId: 'T001' });
    actor.send({ type: 'PAUSE_EXAM', reason: '设备故障', by: 'T001' });
    actor.send({ type: 'CANCEL', reason: '改期', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('状态分组（order/exam/report/final）', () => {
    expect(EXAM_STATE_GROUPS.order).toEqual(['ordered', 'scheduled']);
    expect(EXAM_STATE_GROUPS.exam).toContain('inProgress');
    expect(EXAM_STATE_GROUPS.exam).toContain('paused');
    expect(EXAM_STATE_GROUPS.report).toEqual(['pendingReport', 'reported', 'published']);
    expect(EXAM_STATE_GROUPS.final).toEqual(['archived', 'cancelled']);
  });
});

/**
 * G005 放射RIS系统 v3.0.3.31 - 检查申请/预约状态机测试
 * Phase T1-W2: 状态机单元测试
 * [v3.0.6.11-107] 对齐 backend APPOINTMENT_TRANSITIONS (11 态, 主链
 *   SCHEDULED→CONFIRMED→REGISTERED→CHECKED_IN→IN_PROGRESS→COMPLETED)
 */

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { orderMachine, ORDER_STATE_LABEL } from '../orderMachine';

const INPUT = {
  orderId: 'ord-001',
  patientId: 'P001',
  examItemId: 'EX001',
  modality: 'CT',
  bodyPart: '胸部',
  requestedBy: 'D001',
};

const startActor = () =>
  createActor(orderMachine, { input: INPUT }).start();

const toScheduled = () => {
  const actor = startActor();
  actor.send({ type: 'APPROVE', by: 'D002' });
  actor.send({ type: 'SCHEDULE', by: 'D001' });
  return actor;
};
const toConfirmed = () => {
  const actor = toScheduled();
  actor.send({ type: 'CONFIRM', by: 'D001' });
  return actor;
};
const toRegistered = () => {
  const actor = toConfirmed();
  actor.send({ type: 'REGISTER', by: 'D001' });
  return actor;
};
const toCheckedIn = () => {
  const actor = toRegistered();
  actor.send({ type: 'CHECK_IN', by: 'P001' });
  return actor;
};

describe('orderMachine - 检查申请/预约 11 态状态机', () => {
  it('初始为 submitted', () => {
    const actor = startActor();
    expect(actor.getSnapshot().value).toBe('submitted');
  });

  it('submitted → approved (APPROVE) 记录审批人', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE', by: 'D002' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('approved');
    expect(ctx.approvedBy).toBe('D002');
  });

  it('submitted → rejected (REJECT) 记录原因', () => {
    const actor = startActor();
    actor.send({ type: 'REJECT', reason: '适应证不符', by: 'D002' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('rejected');
    expect(ctx.rejectionReason).toBe('适应证不符');
  });

  it('approved → scheduled (SCHEDULE) 记录排程时间', () => {
    const actor = startActor();
    actor.send({ type: 'APPROVE', by: 'D002' });
    const scheduledAt = '2026-06-10T09:00:00.000Z';
    actor.send({ type: 'SCHEDULE', scheduledAt, by: 'D001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('scheduled');
    expect(ctx.scheduledAt).toBe(scheduledAt);
  });

  it('scheduled → confirmed (CONFIRM)', () => {
    const actor = toScheduled();
    actor.send({ type: 'CONFIRM', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('confirmed');
  });

  it('confirmed → registered (REGISTER) 后端序列: 确认 → 登记', () => {
    const actor = toConfirmed();
    actor.send({ type: 'REGISTER', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('registered');
  });

  it('registered → checkedIn (CHECK_IN) 后端新增态', () => {
    const actor = toRegistered();
    actor.send({ type: 'CHECK_IN', by: 'P001' });
    expect(actor.getSnapshot().value).toBe('checkedIn');
  });

  it('checkedIn → inProgress (START)', () => {
    const actor = toCheckedIn();
    actor.send({ type: 'START', by: 'T001' });
    expect(actor.getSnapshot().value).toBe('inProgress');
  });

  it('inProgress → completed (COMPLETE)', () => {
    const actor = toCheckedIn();
    actor.send({ type: 'START', by: 'T001' });
    actor.send({ type: 'COMPLETE', by: 'T001' });
    expect(actor.getSnapshot().value).toBe('completed');
  });

  it('scheduled → checkedIn (CHECK_IN) 后端允许跳登记', () => {
    const actor = toScheduled();
    actor.send({ type: 'CHECK_IN', by: 'P001' });
    expect(actor.getSnapshot().value).toBe('checkedIn');
  });

  it('scheduled → noShow (NO_SHOW)', () => {
    const actor = toScheduled();
    actor.send({ type: 'NO_SHOW', reason: '患者未到', by: 'D001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('noShow');
    expect(ctx.rejectionReason).toBe('患者未到');
  });

  it('confirmed → cancelled (CANCEL) 记录原因', () => {
    const actor = toConfirmed();
    actor.send({ type: 'CANCEL', reason: '患者改约', by: 'D001' });
    const ctx = actor.getSnapshot().context;
    expect(actor.getSnapshot().value).toBe('cancelled');
    expect(ctx.rejectionReason).toBe('患者改约');
  });

  it('scheduled → cancelled (CANCEL)', () => {
    const actor = toScheduled();
    actor.send({ type: 'CANCEL', reason: '设备故障', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('submitted 不允许 CANCEL,需先审批或退回', () => {
    const actor = startActor();
    actor.send({ type: 'CANCEL', reason: '重复申请', by: 'D001' });
    expect(actor.getSnapshot().value).toBe('submitted');
  });

  it('状态标签完整（11 态）', () => {
    expect(ORDER_STATE_LABEL.submitted).toBe('已提交');
    expect(ORDER_STATE_LABEL.approved).toBe('已审批');
    expect(ORDER_STATE_LABEL.scheduled).toBe('已排程');
    expect(ORDER_STATE_LABEL.confirmed).toBe('已确认');
    expect(ORDER_STATE_LABEL.registered).toBe('已登记');
    expect(ORDER_STATE_LABEL.checkedIn).toBe('已报到');
    expect(ORDER_STATE_LABEL.inProgress).toBe('检查中');
    expect(ORDER_STATE_LABEL.completed).toBe('已完成');
    expect(ORDER_STATE_LABEL.cancelled).toBe('已取消');
    expect(ORDER_STATE_LABEL.rejected).toBe('已退回');
    expect(ORDER_STATE_LABEL.noShow).toBe('已失约');
  });
});

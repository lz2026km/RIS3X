/**
 * G005 放射RIS系统 v3.0.3.31 - 订单状态机适配器
 * 把旧的字符串 status (pending/confirmed/checked-in/cancelled/no-show) 映射为 orderMachine 状态,
 * 任意"裸赋值 status = 'cancelled'" 都应通过 orderMachine CANCEL 事件。
 */
import { createActor } from 'xstate'
import { orderMachine, type OrderStateName } from '../machines/orderMachine'

/** 字符串预约状态 → orderMachine 起始状态名 */
const STATUS_TO_MACHINE: Record<string, OrderStateName> = {
  pending: 'submitted',
  confirmed: 'approved',
  'checked-in': 'scheduled',
  cancelled: 'cancelled',
  'no-show': 'cancelled',
  rejected: 'rejected',
}

/** 推进 actor 到 fromStatus,然后发送事件,返回目标状态名 */
export function replayOrderEvent(
  fromStatus: string,
  event:
    | { type: 'CANCEL'; reason: string; by: string }
    | { type: 'REJECT'; reason: string; by: string }
    | { type: 'APPROVE'; by: string }
    | { type: 'SCHEDULE'; scheduledAt?: string; by: string }
    | { type: 'CONFIRM'; by: string }
): OrderStateName {
  const from = STATUS_TO_MACHINE[fromStatus]
  if (!from) {
    console.warn(`[orderStateAdapter] Unknown fromStatus "${fromStatus}", treating as 'submitted'`)
    return 'submitted'
  }
  const actor = createActor(orderMachine, {
    input: {
      orderId: 'replay',
      patientId: 'replay',
      examItemId: 'replay',
      modality: 'CT',
      bodyPart: 'replay',
      requestedBy: 'replay',
    },
  })
  actor.start()
  // 走 happy path
  if (from === 'approved' || from === 'scheduled' || from === 'confirmed' || from === 'cancelled') {
    actor.send({ type: 'APPROVE', by: 'replay' })
  }
  if (from === 'scheduled' || from === 'confirmed' || from === 'cancelled') {
    actor.send({ type: 'SCHEDULE', by: 'replay' })
  }
  if (from === 'confirmed' || from === 'cancelled') {
    actor.send({ type: 'CONFIRM', by: 'replay' })
  }
  if (from === 'rejected') {
    actor.send({ type: 'REJECT', reason: 'replay', by: 'replay' })
  }
  if (from === 'cancelled') {
    actor.send({ type: 'CANCEL', reason: 'replay', by: 'replay' })
  }
  actor.send(event as never)
  const value = actor.getSnapshot().value as OrderStateName
  actor.stop()
  return value
}

/** 校验一个 status 字符串是否可由 submitted 出发到达 */
export function validateOrderStatus(status: string): boolean {
  const target = STATUS_TO_MACHINE[status]
  if (!target) {
    console.warn(`[orderStateAdapter] Unknown status "${status}" in validateOrderStatus`)
    return false
  }
  const actor = createActor(orderMachine, {
    input: {
      orderId: 'validate',
      patientId: 'validate',
      examItemId: 'validate',
      modality: 'CT',
      bodyPart: 'validate',
      requestedBy: 'validate',
    },
  })
  actor.start()
  if (target === 'approved' || target === 'scheduled' || target === 'confirmed' || target === 'cancelled') {
    actor.send({ type: 'APPROVE', by: 'system' })
  }
  if (target === 'scheduled' || target === 'confirmed' || target === 'cancelled') {
    actor.send({ type: 'SCHEDULE', by: 'system' })
  }
  if (target === 'confirmed' || target === 'cancelled') {
    actor.send({ type: 'CONFIRM', by: 'system' })
  }
  if (target === 'rejected') {
    actor.send({ type: 'REJECT', reason: 'validate', by: 'system' })
  }
  if (target === 'cancelled') {
    actor.send({ type: 'CANCEL', reason: 'validate', by: 'system' })
  }
  const ok = actor.getSnapshot().value === target
  actor.stop()
  return ok
}

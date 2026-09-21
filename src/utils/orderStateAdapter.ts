/**
 * G005 放射RIS系统 v3.0.3.31 - 订单状态机适配器
 * 把旧的字符串 status 映射为 orderMachine 状态,
 * 任意"裸赋值 status = 'cancelled'" 都应通过 orderMachine CANCEL 事件。
 *
 * [v3.0.6.11-107] 对齐后端 APPOINTMENT_TRANSITIONS 序列:
 *   SCHEDULED → CONFIRMED → REGISTERED → CHECKED_IN → IN_PROGRESS → COMPLETED
 */
import { createActor } from 'xstate'
import { orderMachine, type OrderEvent, type OrderStateName } from '../machines/orderMachine'

/** 字符串预约状态 → orderMachine 起始状态名 */
const STATUS_TO_MACHINE: Record<string, OrderStateName> = {
  pending: 'submitted',
  approved: 'approved',
  scheduled: 'scheduled',
  confirmed: 'confirmed',
  registered: 'registered',
  'checked-in': 'checkedIn',
  checkedIn: 'checkedIn',
  'in-progress': 'inProgress',
  inProgress: 'inProgress',
  completed: 'completed',
  cancelled: 'cancelled',
  'no-show': 'noShow',
  noShow: 'noShow',
  rejected: 'rejected',
}

/** 从 submitted 出发, 驱动 actor 到目标状态 */
function driveTo(actor: { send: (e: OrderEvent) => void }, target: OrderStateName): void {
  const approve: OrderEvent = { type: 'APPROVE', by: 'replay' }
  const schedule: OrderEvent = { type: 'SCHEDULE', by: 'replay' }
  const confirm: OrderEvent = { type: 'CONFIRM', by: 'replay' }
  const register: OrderEvent = { type: 'REGISTER', by: 'replay' }
  const checkIn: OrderEvent = { type: 'CHECK_IN', by: 'replay' }
  const start: OrderEvent = { type: 'START', by: 'replay' }
  const complete: OrderEvent = { type: 'COMPLETE', by: 'replay' }
  switch (target) {
    case 'submitted':
      return
    case 'approved':
      actor.send(approve)
      return
    case 'scheduled':
      actor.send(approve); actor.send(schedule)
      return
    case 'confirmed':
      actor.send(approve); actor.send(schedule); actor.send(confirm)
      return
    case 'registered':
      actor.send(approve); actor.send(schedule); actor.send(confirm); actor.send(register)
      return
    case 'checkedIn':
      actor.send(approve); actor.send(schedule); actor.send(confirm); actor.send(register); actor.send(checkIn)
      return
    case 'inProgress':
      actor.send(approve); actor.send(schedule); actor.send(confirm); actor.send(register); actor.send(checkIn); actor.send(start)
      return
    case 'completed':
      actor.send(approve); actor.send(schedule); actor.send(confirm); actor.send(register); actor.send(checkIn); actor.send(start); actor.send(complete)
      return
    case 'cancelled':
      actor.send(approve); actor.send(schedule); actor.send({ type: 'CANCEL', reason: 'replay', by: 'replay' })
      return
    case 'rejected':
      actor.send({ type: 'REJECT', reason: 'replay', by: 'replay' })
      return
    case 'noShow':
      actor.send(approve); actor.send(schedule); actor.send({ type: 'NO_SHOW', by: 'replay' })
      return
  }
}

/** 推进 actor 到 fromStatus,然后发送事件,返回目标状态名 */
export function replayOrderEvent(fromStatus: string, event: OrderEvent): OrderStateName {
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
  driveTo(actor, from)
  actor.send(event)
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
  driveTo(actor, target)
  const ok = actor.getSnapshot().value === target
  actor.stop()
  return ok
}

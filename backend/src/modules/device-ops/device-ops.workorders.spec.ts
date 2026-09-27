import { BadRequestException } from '@nestjs/common'
import { DeviceOpsService } from './device-ops.service'
import {
  canTransitionWorkOrder,
  computeWorkOrderSla,
  nextWorkOrderStatuses,
  workOrderSlaHours,
  workOrderSlaState,
} from './device-ops.types'

describe('[W11-DeviceOps] 工单状态机', () => {
  describe('纯状态机', () => {
    it('允许合法转移: new→assigned, assigned→in_progress, completed→closed', () => {
      expect(canTransitionWorkOrder('new', 'assigned')).toBe(true)
      expect(canTransitionWorkOrder('assigned', 'in_progress')).toBe(true)
      expect(canTransitionWorkOrder('in_progress', 'waiting_parts')).toBe(true)
      expect(canTransitionWorkOrder('completed', 'closed')).toBe(true)
      expect(canTransitionWorkOrder('closed', 'open')).toBe(true)
    })

    it('拒绝非法转移: new→completed, closed→in_progress, 自环', () => {
      expect(canTransitionWorkOrder('new', 'completed')).toBe(false)
      expect(canTransitionWorkOrder('closed', 'in_progress')).toBe(false)
      expect(canTransitionWorkOrder('open', 'open')).toBe(false)
    })

    it('nextWorkOrderStatuses 返回合法目标', () => {
      expect(nextWorkOrderStatuses('new')).toEqual(expect.arrayContaining(['open', 'assigned', 'closed']))
      expect(nextWorkOrderStatuses('closed')).toEqual(['open'])
    })

    it('故障工单 SLA 比保养更短', () => {
      expect(workOrderSlaHours('critical', 'fault')).toBeLessThan(workOrderSlaHours('critical', 'maintenance'))
      const { slaHours, dueAt } = computeWorkOrderSla('high', 'fault', '2026-09-01T00:00:00.000Z')
      expect(slaHours).toBe(4)
      expect(dueAt).toBe('2026-09-01T04:00:00.000Z')
    })

    it('SLA 状态: 按时 / 超期', () => {
      expect(workOrderSlaState('2026-09-01T04:00:00.000Z', '2026-09-01T05:00:00.000Z', '2026-09-01T03:00:00.000Z')).toBe('met')
      expect(workOrderSlaState('2026-09-01T04:00:00.000Z', '2026-09-01T05:00:00.000Z', '2026-09-01T06:00:00.000Z')).toBe('breached')
      expect(workOrderSlaState('2026-09-01T04:00:00.000Z', '2026-09-01T05:00:00.000Z')).toBe('breached')
      expect(workOrderSlaState('2026-09-01T04:00:00.000Z', '2026-09-01T02:00:00.000Z')).toBe('on_track')
    })
  })

  describe('服务层', () => {
    let svc: DeviceOpsService
    beforeEach(() => {
      svc = new DeviceOpsService()
    })

    it('列表返回种子工单并带 SLA 计算', () => {
      const { items, total } = svc.listWorkOrders()
      expect(total).toBeGreaterThanOrEqual(10)
      expect(items[0].slaHours).toBeGreaterThan(0)
      expect(items[0].nextStatuses.length).toBeGreaterThan(0)
      expect(Array.isArray(items[0].timeline)).toBe(true)
    })

    it('过滤: kind=fault / priority=critical', () => {
      const faults = svc.listWorkOrders({ kind: 'fault' })
      expect(faults.items.every((w) => w.kind === 'fault')).toBe(true)
      const crit = svc.listWorkOrders({ priority: 'critical' })
      expect(crit.items.every((w) => w.priority === 'critical')).toBe(true)
    })

    it('advance 执行合法转移并写入时间线', () => {
      const before = svc.getWorkOrder('WO-1006')
      expect(before.status).toBe('new')
      const after = svc.advanceWorkOrder('WO-1006', { to: 'assigned', assignee: '陈工', note: '指派' })
      expect(after.status).toBe('assigned')
      expect(after.assignee).toBe('陈工')
      expect(after.timeline.some((t) => t.status === 'assigned')).toBe(true)
    })

    it('advance 非法转移抛 BadRequestException', () => {
      expect(() => svc.advanceWorkOrder('WO-1006', { to: 'completed' })).toThrow(BadRequestException)
    })

    it('create 生成新工单 (new, 带时间线)', () => {
      const wo = svc.createWorkOrder({ kind: 'fault', title: '测试故障', deviceId: 'CT-01' })
      expect(wo.id).toMatch(/^WO-/)
      expect(wo.status).toBe('new')
      expect(wo.timeline.length).toBe(1)
    })

    it('stats 汇总状态/优先级/成本/SLA 合规率', () => {
      const stats = svc.getWorkOrderStats()
      expect(stats.total).toBeGreaterThanOrEqual(10)
      expect(stats.active).toBeGreaterThan(0)
      expect(stats.partsCost).toBeGreaterThan(0)
      expect(stats.byStatus).toHaveProperty('in_progress')
      expect(stats.slaCompliancePct).toBeGreaterThanOrEqual(0)
      expect(stats.slaCompliancePct).toBeLessThanOrEqual(100)
    })
  })
})

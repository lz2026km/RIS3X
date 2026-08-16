import { NotFoundException, BadRequestException } from '@nestjs/common'
import { DeviceScheduleService } from './device-schedule.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    device: { findMany: reject, findUnique: reject },
    exam: { findMany: reject },
  } as never
}

describe('DeviceScheduleService', () => {
  describe('DB 不可用 → 确定性 seed 回退', () => {
    it('getWeekView 返回 7 天周视图 + 每设备排程块', async () => {
      const service = new DeviceScheduleService(makePrisma())
      const view = await service.getWeekView('2026-08-10')
      expect(view.days.length).toBe(7)
      expect(view.weekStart).toBe('2026-08-10')
      expect(view.devices.length).toBeGreaterThan(0)
      expect(view.devices[0].blocks.length).toBeGreaterThan(0)
    })

    it('块包含 检查/维护/空闲 三类', async () => {
      const service = new DeviceScheduleService(makePrisma())
      const view = await service.getWeekView('2026-08-10')
      const types = new Set(view.devices.flatMap((d) => d.blocks.map((b) => b.type)))
      expect(types.has('EXAM')).toBe(true)
      expect(types.has('MAINTENANCE')).toBe(true)
      expect(types.has('IDLE')).toBe(true)
    })

    it('getStats 统计字段齐全且利用率合理', async () => {
      const service = new DeviceScheduleService(makePrisma())
      const stats = await service.getStats('2026-08-10')
      expect(stats.totalBlocks).toBeGreaterThan(0)
      expect(stats.examBlocks).toBeGreaterThan(0)
      expect(stats.idleHours).toBeGreaterThan(0)
      expect(stats.utilizationByDevice.length).toBeGreaterThan(0)
      expect(stats.utilizationByDevice.every((u) => u.utilization >= 0 && u.utilization <= 100)).toBe(true)
    })
  })

  describe('排程块 CRUD', () => {
    it('createBlock 创建维护块并返回冲突列表', async () => {
      const service = new DeviceScheduleService(makePrisma())
      const res = await service.createBlock({
        deviceId: 'dev-dr-01',
        type: 'MAINTENANCE',
        title: '月度保养',
        start: '2026-08-12T09:00:00',
        end: '2026-08-12T11:00:00',
      })
      expect(res.block.id).toBeTruthy()
      expect(res.block.type).toBe('MAINTENANCE')
      expect(res.conflicts).toBeDefined()
      const view = await service.getWeekView('2026-08-10')
      const day = view.devices.find((d) => d.deviceId === 'dev-dr-01')?.blocks
      expect(day?.some((b) => b.title === '月度保养')).toBe(true)
    })

    it('updateBlock 拖拽调整时间 + 冲突检测', async () => {
      const service = new DeviceScheduleService(makePrisma())
      const created = await service.createBlock({
        deviceId: 'dev-dr-01',
        type: 'MAINTENANCE',
        title: '可拖拽块',
        start: '2026-08-12T10:00:00',
        end: '2026-08-12T10:30:00',
      })
      const moved = await service.updateBlock(created.block.id, { start: '2026-08-12T15:00:00', end: '2026-08-12T15:30:00' })
      expect(moved.block.start).toContain('2026-08-12T15:00')
      expect(moved.conflicts).toBeDefined()
    })

    it('非法时间 (超工作时段/倒序) → BadRequestException', async () => {
      const service = new DeviceScheduleService(makePrisma())
      await expect(
        service.createBlock({ deviceId: 'dev-dr-01', type: 'MAINTENANCE', title: 'x', start: '2026-08-12T20:00:00', end: '2026-08-12T21:00:00' }),
      ).rejects.toBeInstanceOf(BadRequestException)
      await expect(
        service.createBlock({ deviceId: 'dev-dr-01', type: 'MAINTENANCE', title: 'x', start: '2026-08-12T11:00:00', end: '2026-08-12T10:00:00' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('未知设备/块 → NotFoundException', async () => {
      const service = new DeviceScheduleService(makePrisma())
      await expect(
        service.createBlock({ deviceId: 'unknown', type: 'MAINTENANCE', title: 'x', start: '2026-08-12T09:00:00', end: '2026-08-12T10:00:00' }),
      ).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.updateBlock('unknown', { start: '2026-08-12T09:00:00', end: '2026-08-12T10:00:00' })).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.deleteBlock('unknown')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('deleteBlock 删除后不再出现', async () => {
      const service = new DeviceScheduleService(makePrisma())
      const created = await service.createBlock({
        deviceId: 'dev-dr-01',
        type: 'MAINTENANCE',
        title: '待删除',
        start: '2026-08-12T09:00:00',
        end: '2026-08-12T09:30:00',
      })
      await service.deleteBlock(created.block.id)
      const view = await service.getWeekView('2026-08-10')
      const day = view.devices.find((d) => d.deviceId === 'dev-dr-01')?.blocks
      expect(day?.some((b) => b.title === '待删除')).toBe(false)
    })
  })

  describe('冲突检测 + 建议调整 (确定性)', () => {
    it('重叠块被检出并给出调整建议', async () => {
      const service = new DeviceScheduleService(makePrisma())
      await service.createBlock({
        deviceId: 'dev-dr-01',
        type: 'MAINTENANCE',
        title: '冲突A',
        start: '2026-08-12T09:00:00',
        end: '2026-08-12T10:00:00',
      })
      const second = await service.createBlock({
        deviceId: 'dev-dr-01',
        type: 'MAINTENANCE',
        title: '冲突B',
        start: '2026-08-12T09:30:00',
        end: '2026-08-12T10:30:00',
      })
      expect(second.conflicts.length).toBeGreaterThan(0)
      expect(second.conflicts[0].overlapWith.length).toBeGreaterThan(0)
      expect(second.conflicts[0].suggestion.start).toBeTruthy()
      expect(second.conflicts[0].suggestion.reason).toContain('建议')
    })

    it('getConflicts 汇总周冲突; suggestMove 返回空闲时段', async () => {
      const service = new DeviceScheduleService(makePrisma())
      const created = await service.createBlock({
        deviceId: 'dev-dr-01',
        type: 'MAINTENANCE',
        title: '冲突C',
        start: '2026-08-12T09:00:00',
        end: '2026-08-12T10:00:00',
      })
      await service.createBlock({
        deviceId: 'dev-dr-01',
        type: 'MAINTENANCE',
        title: '冲突D',
        start: '2026-08-12T09:15:00',
        end: '2026-08-12T10:15:00',
      })
      const conflicts = await service.getConflicts('2026-08-10')
      expect(conflicts.length).toBeGreaterThan(0)
      const moved = await service.suggestMove(created.block.id)
      expect(moved.suggestion.start).toBeTruthy()
      expect(moved.suggestion.end).toBeTruthy()
    })
  })
})

/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 4B (tech-ops) - 技师工作站 V2 服务测试
 * 覆盖:
 *   1. 设备利用率历史: 30 天序列正确性 (确定性/0-100/统计一致/设备对比)
 *   2. 紧急插入: 冲突检测 → 调整方案 (顺延/备用设备), 记录落内存
 *   3. 跨机房排程优化: 优化后总等待 ≤ 优化前 (演示队列与自定义输入)
 *   4. 孤儿模块回退: DB 不可用时种子路径可工作
 */
import { BadRequestException } from '@nestjs/common'
import { TechOpsService, buildTodaySchedule } from './tech-ops.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return { exam: { findMany: reject } } as never
}

const dateKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes()

describe('TechOpsService', () => {
  describe('1. 设备利用率历史', () => {
    it('返回 30 天序列 + 统计 + 设备对比 (DB 不可用回退种子)', async () => {
      const service = new TechOpsService(makePrisma())
      const res = await service.getUtilizationHistory({ days: 30 })
      expect(res.days).toBe(30)
      expect(res.seeded).toBe(true)
      expect(res.series.length).toBe(30)
      expect(res.devices.length).toBeGreaterThanOrEqual(5)
      for (const day of res.series) {
        expect(day.rate).toBeGreaterThanOrEqual(0)
        expect(day.rate).toBeLessThanOrEqual(100)
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(day.points.length).toBe(24)
      }
      expect(res.stats.meanRate).toBeGreaterThan(0)
      expect(res.stats.peakRate).toBeGreaterThanOrEqual(res.stats.meanRate)
      expect(res.stats.troughRate).toBeLessThanOrEqual(res.stats.meanRate)
      expect(res.stats.peakDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(res.stats.peakHour).toBeGreaterThanOrEqual(0)
      expect(res.stats.peakHour).toBeLessThanOrEqual(23)
      for (const dev of res.devices) {
        expect(dev.trend.length).toBe(30)
        expect(dev.meanRate).toBeGreaterThan(0)
        expect(dev.totalExams).toBeGreaterThan(0)
        expect(dev.hours.length).toBe(24)
      }
    })

    it('每日均值 = 24 小时点均值, 序列确定性可复现', async () => {
      const service = new TechOpsService(makePrisma())
      const a = await service.getUtilizationHistory({ days: 7, granularity: 'day' })
      const b = await service.getUtilizationHistory({ days: 7, granularity: 'day' })
      for (const day of a.series) {
        const mean = Math.round(day.points.reduce((s, p) => s + p.rate, 0) / 24)
        expect(Math.abs(day.rate - mean)).toBeLessThanOrEqual(2)
      }
      expect(a.series.map((d) => d.rate)).toEqual(b.series.map((d) => d.rate))
    })

    it('峰值时段在日间 (08:00-12:00), 低谷时段在夜间', async () => {
      const service = new TechOpsService(makePrisma())
      const res = await service.getUtilizationHistory({ days: 30 })
      expect(res.stats.peakHour).toBeGreaterThanOrEqual(8)
      expect(res.stats.peakHour).toBeLessThanOrEqual(12)
      expect(res.stats.troughHour >= 20 || res.stats.troughHour <= 6).toBe(true)
    })

    it('days 参数钳制在 1-30, hour 粒度返回小时序列', async () => {
      const service = new TechOpsService(makePrisma())
      const res = await service.getUtilizationHistory({ days: 99, granularity: 'hour' })
      expect(res.days).toBe(30)
      expect(res.granularity).toBe('hour')
    })
  })

  describe('2. 紧急插入', () => {
    it('suggestSlots 返回按等待排序的建议 (当前进行中/最近空闲/备用设备)', () => {
      const service = new TechOpsService(makePrisma())
      const slots = service.suggestSlots({ modality: 'CT', durationMin: 20 })
      expect(slots.length).toBeGreaterThan(0)
      for (const s of slots) {
        expect(s.deviceId).toBeTruthy()
        expect(s.strategyLabel).toBeTruthy()
        expect(s.startMin).toBeGreaterThanOrEqual(0)
        expect(s.endMin).toBe(s.startMin + 20)
        expect(s.conflictCount).toBe(s.conflicts.length)
      }
      const strategies = new Set(slots.map((s) => s.strategy))
      expect(strategies.has('INSERT_NOW')).toBe(true)
      expect(strategies.has('NEXT_FREE')).toBe(true)
      const sorted = [...slots].sort((a, b) => a.startInMin - b.startInMin)
      expect(slots.map((s) => s.startInMin)).toEqual(sorted.map((s) => s.startInMin))
    })

    it('冲突检测: 插入到繁忙时段 → 返回调整方案 (顺延/启用备用设备)', () => {
      const service = new TechOpsService(makePrisma())
      const schedule = buildTodaySchedule(dateKey(), nowMin())
      const busy = schedule.get('DEV-CT1')?.find((e) => e.startMin > nowMin() + 5)
      expect(busy).toBeTruthy()
      const res = service.insert({ deviceId: 'DEV-CT1', startMin: busy!.startMin, durationMin: 15, patientName: '测试急诊', examItem: '头颅CT平扫', modality: 'CT' })
      expect(res.success).toBe(false)
      expect(res.conflicts.length).toBeGreaterThan(0)
      expect(res.conflicts[0].examId).toBe(busy!.examId)
      expect(res.adjustments.length).toBeGreaterThan(0)
      expect(['DEFER', 'MOVE_DEVICE', 'KEEP']).toContain(res.adjustments[0].action)
      expect(res.message).toContain('冲突')
    })

    it('force 强制插入: 记录冲突并生成调整, 记录可查询', () => {
      const service = new TechOpsService(makePrisma())
      const schedule = buildTodaySchedule(dateKey(), nowMin())
      const busy = schedule.get('DEV-MR1')?.find((e) => e.startMin > nowMin() + 5)
      expect(busy).toBeTruthy()
      const res = service.insert({ deviceId: 'DEV-MR1', startMin: busy!.startMin, durationMin: 20, patientName: '急诊患者', modality: 'MR', priority: 'STAT', force: true })
      expect(res.success).toBe(true)
      expect(res.record).toBeTruthy()
      expect(res.conflicts.length).toBeGreaterThan(0)
      expect(res.adjustments.length).toBeGreaterThan(0)
      expect(res.adjustments[0].suggestedDeviceId).toBeTruthy()
      const records = service.listInserts()
      expect(records.length).toBe(1)
      expect(records[0].id).toBe(res.record!.id)
      expect(records[0].startAt).toBeTruthy()
      expect(records[0].status).toBe('INSERTED')
    })

    it('空闲时段插入: 无冲突, 直接成功', () => {
      const service = new TechOpsService(makePrisma())
      const schedule = buildTodaySchedule(dateKey(), nowMin())
      const free = service.suggestSlots({ deviceId: 'DEV-MG1', durationMin: 10 }).find((s) => s.strategy === 'NEXT_FREE')
      expect(free).toBeTruthy()
      expect(free!.conflictCount).toBe(0)
      const res = service.insert({ deviceId: 'DEV-MG1', startMin: free!.startMin, durationMin: 10, patientName: '快速检查', modality: 'MG' })
      expect(res.success).toBe(true)
      expect(res.conflicts.length).toBe(0)
    })

    it('非法模态 → BadRequestException', () => {
      const service = new TechOpsService(makePrisma())
      expect(() => service.insert({ modality: 'PET' })).toThrow(BadRequestException)
      expect(() => service.suggestSlots({ modality: 'XX' })).toThrow(BadRequestException)
    })
  })

  describe('3. 跨机房排程优化', () => {
    it('演示队列: 优化后总等待 ≤ 优化前, 且严格更优', () => {
      const service = new TechOpsService(makePrisma())
      const res = service.optimize(null)
      expect(res.assignments.length).toBe(10)
      expect(res.unassigned.length).toBe(0)
      expect(res.totalWaitAfter).toBeLessThanOrEqual(res.totalWaitBefore)
      expect(res.totalWaitAfter).toBeLessThan(res.totalWaitBefore)
      expect(res.improvementPct).toBeGreaterThan(0)
      expect(res.better).toBe(true)
      for (const a of res.assignments) {
        expect(a.endMin).toBe(a.startMin + a.durationMin)
        expect(a.waitMin).toBeGreaterThanOrEqual(0)
        expect(a.technician).toBeTruthy()
        expect(a.deviceName).toBeTruthy()
        expect(a.startAt).toBeTruthy()
      }
      const byDevice = new Map<string, number>()
      for (const a of res.assignments) {
        expect(a.startMin).toBeGreaterThanOrEqual(byDevice.get(a.deviceId) ?? a.arrivalMin)
        byDevice.set(a.deviceId, a.endMin)
      }
    })

    it('优先级排序: STAT/URGENT 先于 ROUTINE 分配', () => {
      const service = new TechOpsService(makePrisma())
      const res = service.optimize({
        exams: [
          { id: 'X1', patientName: '甲', examItem: 'A', modality: 'CT', durationMin: 10, priority: 'ROUTINE', arrivalMin: 0 },
          { id: 'X2', patientName: '乙', examItem: 'B', modality: 'CT', durationMin: 10, priority: 'STAT', arrivalMin: 5 },
        ],
        devices: [{ id: 'D1', name: 'CT-1', modality: 'CT', availableFrom: 0, technician: '刘洋' }],
      })
      const stat = res.assignments.find((a) => a.examId === 'X2')!
      const routine = res.assignments.find((a) => a.examId === 'X1')!
      expect(stat.startMin).toBe(5)
      expect(stat.waitMin).toBe(0)
      expect(routine.startMin).toBe(15)
      expect(res.totalWaitAfter).toBeLessThanOrEqual(res.totalWaitBefore)
    })

    it('自定义输入: 第一台设备繁忙时优化显著降低等待', () => {
      const service = new TechOpsService(makePrisma())
      const res = service.optimize({
        exams: [
          { id: 'A1', patientName: '甲', examItem: 'CT平扫', modality: 'CT', durationMin: 10, priority: 'ROUTINE', arrivalMin: 0 },
          { id: 'A2', patientName: '乙', examItem: 'CT增强', modality: 'CT', durationMin: 10, priority: 'ROUTINE', arrivalMin: 5 },
          { id: 'A3', patientName: '丙', examItem: 'CT复查', modality: 'CT', durationMin: 10, priority: 'ROUTINE', arrivalMin: 10 },
        ],
        devices: [
          { id: 'BUSY-CT', name: 'CT-1(排程满)', modality: 'CT', availableFrom: 90, technician: '刘洋' },
          { id: 'SPARE-CT', name: 'CT-2(空闲)', modality: 'CT', availableFrom: 0, technician: '赵志刚' },
        ],
      })
      expect(res.totalWaitAfter).toBeLessThanOrEqual(res.totalWaitBefore)
      expect(res.totalWaitAfter).toBeLessThan(res.totalWaitBefore)
      const spareCount = res.assignments.filter((a) => a.deviceId === 'SPARE-CT').length
      expect(spareCount).toBeGreaterThan(0)
    })

    it('无匹配设备模态 → 进入 unassigned', () => {
      const service = new TechOpsService(makePrisma())
      const res = service.optimize({
        exams: [{ id: 'P1', patientName: '甲', examItem: 'PET扫描', modality: 'PET', durationMin: 20, priority: 'ROUTINE', arrivalMin: 0 }],
        devices: [{ id: 'D1', name: 'CT-1', modality: 'CT', availableFrom: 0, technician: '刘洋' }],
      })
      expect(res.unassigned.length).toBe(1)
      expect(res.assignments.length).toBe(0)
      expect(res.totalWaitAfter).toBe(0)
    })

    it('空队列 → BadRequestException', () => {
      const service = new TechOpsService(makePrisma())
      expect(() => service.optimize({ exams: [], devices: [{ id: 'D1', name: 'CT-1', modality: 'CT', availableFrom: 0, technician: '刘洋' }] })).toThrow(BadRequestException)
    })
  })

  describe('4. 孤儿模块元数据', () => {
    it('getMeta 返回设备矩阵 + 模态列表', () => {
      const service = new TechOpsService(makePrisma())
      const meta = service.getMeta()
      expect(meta.devices.length).toBeGreaterThanOrEqual(5)
      expect(meta.modalities).toEqual(expect.arrayContaining(['CT', 'MR', 'DR', 'DSA', 'MG']))
      expect(meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(meta.nowMin).toBeGreaterThanOrEqual(0)
      expect(meta.nowMin).toBeLessThanOrEqual(1439)
    })

    it('demoQueue 返回可优化的演示队列与设备矩阵', () => {
      const service = new TechOpsService(makePrisma())
      const demo = service.demoQueue()
      expect(demo.exams.length).toBeGreaterThan(0)
      expect(demo.devices.length).toBeGreaterThanOrEqual(5)
      const res = service.optimize(demo)
      expect(res.assignments.length).toBe(demo.exams.length)
    })
  })
})

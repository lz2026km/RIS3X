/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 5 (tech-overview) - 技师工作站 V2 收尾服务测试
 * 覆盖:
 *   1. 患者预约分布: 分桶总和 = 总数 (检查类型/时段/星期/设备 + 时段×星期热力图)
 *   2. 预约波峰分析: 高峰时段识别 (HIGH/MEDIUM/LOW + 峰值日) + 确定性
 *   3. 预约 vs 实到: 爽约率计算 (NO_SHOW / (实到 + 爽约)) + 分维度一致
 *   4. 技师值班大屏: 值班概览 (在岗/房间状态/进行中/待处理紧急) + 房间实时状态流
 *   5. 孤儿模块回退: DB 不可用 → 确定性种子可工作
 */
import { BadRequestException } from '@nestjs/common'
import { TechOverviewService } from './tech-overview.service'

const FIXED_START = '2026-08-17' // 周一

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return { appointment: { findMany: reject } } as never
}

describe('TechOverviewService (Wave 5 患者预约分布 + 技师值班大屏)', () => {
  describe('1. 患者预约分布', () => {
    it('分桶总和 = 总数: 检查类型/时段/星期/设备 + 热力图', async () => {
      const service = new TechOverviewService(makePrisma())
      const res = await service.getAppointmentDistribution({ startDate: FIXED_START, days: 30 })
      expect(res.seeded).toBe(true)
      expect(res.total).toBeGreaterThan(0)
      const sum = (arr: Array<{ count: number }>) => arr.reduce((a, b) => a + b.count, 0)
      expect(sum(res.byModality)).toBe(res.total)
      expect(sum(res.byPeriod)).toBe(res.total)
      expect(sum(res.byWeekday)).toBe(res.total)
      expect(sum(res.byDevice)).toBe(res.total)
      expect(sum(res.heatmap)).toBe(res.total)
      // 形状: 8 时段 × 7 星期; 5 种模态; 每桶占比合计约 100%
      expect(res.byPeriod).toHaveLength(8)
      expect(res.byWeekday).toHaveLength(7)
      expect(res.byModality.length).toBeGreaterThanOrEqual(5)
      const pctSum = res.byModality.reduce((a, b) => a + b.pct, 0)
      expect(Math.abs(pctSum - 100)).toBeLessThan(5)
      res.byPeriod.forEach((p) => expect(p.key).toMatch(/^\d{2}-\d{2}$/))
      res.byDevice.forEach((d) => expect(d.modality).toBeTruthy())
    })

    it('确定性: 同一参数两次调用 → 完全一致 (含热力图)', async () => {
      const service = new TechOverviewService(makePrisma())
      const a = await service.getAppointmentDistribution({ startDate: FIXED_START, days: 14 })
      const b = await service.getAppointmentDistribution({ startDate: FIXED_START, days: 14 })
      expect(a).toEqual(b)
    })

    it('工作日高峰: 周一至周五分桶 > 周末分桶 (周季节性)', async () => {
      const service = new TechOverviewService(makePrisma())
      const res = await service.getAppointmentDistribution({ startDate: FIXED_START, days: 28 })
      const wd = (name: string) => res.byWeekday.find((w) => w.label === name)?.count ?? 0
      expect(wd('周一')).toBeGreaterThan(wd('周日'))
      expect(wd('周五')).toBeGreaterThan(wd('周六'))
    })

    it('days 越界 → BadRequestException', async () => {
      const service = new TechOverviewService(makePrisma())
      await expect(service.getAppointmentDistribution({ days: '99' })).rejects.toThrow(BadRequestException)
      await expect(service.getAppointmentDistribution({ days: '0' })).rejects.toThrow(BadRequestException)
    })
  })

  describe('2. 预约波峰分析', () => {
    it('高峰时段识别: 峰值时段日均 ≥ 全局日均, 存在 HIGH 级时段', async () => {
      const service = new TechOverviewService(makePrisma())
      const res = await service.getAppointmentPeaks({ startDate: FIXED_START, days: 30 })
      expect(res.peaks).toHaveLength(8)
      expect(res.peaks.some((p) => p.level === 'HIGH')).toBe(true)
      const sorted = [...res.peaks].sort((a, b) => b.avgCount - a.avgCount)
      expect(res.peaks.map((p) => p.period)).toEqual(sorted.map((p) => p.period))
      const top = res.peaks[0]!
      expect(top.avgCount).toBeGreaterThanOrEqual(res.overallAverage)
      expect(top.maxDay).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      top.peakDays.forEach((d) => {
        expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(d.weekday).toBeTruthy()
        expect(d.count).toBeGreaterThan(0)
      })
      expect(res.busiestPeriod).toBe(top.period)
      expect(res.busiestWeekday).toBeTruthy()
      expect(res.recommendation).toBeTruthy()
    })

    it('确定性 + 波峰日均与分布一致', async () => {
      const service = new TechOverviewService(makePrisma())
      const a = await service.getAppointmentPeaks({ startDate: FIXED_START, days: 14 })
      const b = await service.getAppointmentPeaks({ startDate: FIXED_START, days: 14 })
      expect(a).toEqual(b)
      const dist = await service.getAppointmentDistribution({ startDate: FIXED_START, days: 14 })
      const periodOfPeak = dist.byPeriod.find((p) => p.key === a.busiestPeriod)
      expect(periodOfPeak).toBeDefined()
      expect(periodOfPeak!.count).toBeGreaterThan(0)
    })
  })

  describe('3. 预约 vs 实到 (爽约率)', () => {
    it('爽约率计算: NO_SHOW / (实到 + 爽约), 且 实到+爽约+取消+待检 = 总数', async () => {
      const service = new TechOverviewService(makePrisma())
      const res = await service.getAppointmentAttendance({ startDate: FIXED_START, days: 30 })
      expect(res.total).toBeGreaterThan(0)
      expect(res.attended + res.noShow + res.cancelled + res.upcoming).toBe(res.total)
      expect(res.noShow).toBeGreaterThan(0)
      expect(res.noShowRate).toBeGreaterThan(0)
      expect(res.noShowRate).toBeLessThanOrEqual(100)
      const expected = res.attended + res.noShow > 0 ? (res.noShow / (res.attended + res.noShow)) * 100 : 0
      expect(Math.abs(res.noShowRate - Math.round(expected * 10) / 10)).toBeLessThanOrEqual(0.01)
      expect(res.attendanceRate).toBeGreaterThan(0)
      expect(res.attendanceRate).toBeLessThanOrEqual(100)
    })

    it('分维度一致: 各模态/星期桶总和 = 总数', async () => {
      const service = new TechOverviewService(makePrisma())
      const res = await service.getAppointmentAttendance({ startDate: FIXED_START, days: 30 })
      const sumTotal = (arr: AttendanceLike[]) => arr.reduce((a, b) => a + b.total, 0)
      const sumNoShow = (arr: AttendanceLike[]) => arr.reduce((a, b) => a + b.noShow, 0)
      expect(sumTotal(res.byModality)).toBe(res.total)
      expect(sumTotal(res.byWeekday)).toBe(res.total)
      expect(sumNoShow(res.byModality)).toBe(res.noShow)
      res.byModality.forEach((m) => {
        expect(m.noShowRate).toBeGreaterThanOrEqual(0)
        expect(m.noShowRate).toBeLessThanOrEqual(100)
        expect(m.total).toBe(m.attended + m.noShow + m.cancelled + m.upcoming)
      })
    })

    it('确定性', async () => {
      const service = new TechOverviewService(makePrisma())
      const a = await service.getAppointmentAttendance({ startDate: FIXED_START, days: 14 })
      const b = await service.getAppointmentAttendance({ startDate: FIXED_START, days: 14 })
      expect(a).toEqual(b)
    })
  })

  describe('4. 技师值班大屏', () => {
    it('值班概览: 在岗+休班 = 名册, 进行中 = IN_USE 房间数, 待处理紧急 ≥ 1', () => {
      const service = new TechOverviewService(makePrisma())
      const ov = service.getDashboardOverview()
      expect(ov.onDutyCount + ov.offDutyCount).toBe(ov.technicianTotal)
      expect(ov.technicianTotal).toBeGreaterThanOrEqual(8)
      expect(ov.rooms).toHaveLength(ov.roomCount)
      expect(ov.rooms.length).toBeGreaterThanOrEqual(6)
      const inUse = ov.rooms.filter((r) => r.state === 'IN_USE').length
      expect(ov.inProgressCount).toBe(inUse)
      expect(ov.inUseRooms).toBe(inUse)
      expect(ov.inUseRooms).toBeGreaterThanOrEqual(1)
      expect(ov.idleRooms).toBeGreaterThanOrEqual(0)
      expect(ov.waitingCount).toBeGreaterThanOrEqual(0)
      expect(ov.pendingEmergencyCount).toBeGreaterThanOrEqual(1)
      expect(ov.duty).toHaveLength(ov.technicianTotal)
      ov.duty.forEach((d) => {
        expect(d.shift).toBeTruthy()
        expect(d.shiftLabel).toBeTruthy()
      })
      ov.rooms.forEach((r) => {
        expect(['IN_USE', 'IDLE', 'MAINTENANCE', 'OFFLINE']).toContain(r.state)
        expect(r.todayExams).toBeGreaterThan(0)
        expect(r.technician).toBeTruthy()
        if (r.state === 'IN_USE') {
          expect(r.currentExam).toBeTruthy()
          expect(r.currentExam!.progressPct).toBeGreaterThanOrEqual(0)
          expect(r.currentExam!.progressPct).toBeLessThanOrEqual(100)
          expect(r.currentExam!.startedAt).toBeTruthy()
        }
      })
    })

    it('房间实时状态流: 事件时间降序, 事件房间均为现有房间, 进行中房间含 EXAM_START', () => {
      const service = new TechOverviewService(makePrisma())
      const stream = service.getRoomStatusStream()
      expect(stream.rooms.length).toBeGreaterThanOrEqual(6)
      expect(stream.events.length).toBeGreaterThan(0)
      const roomIds = new Set(stream.rooms.map((r) => r.roomId))
      stream.events.forEach((e) => {
        expect(roomIds.has(e.roomId)).toBe(true)
        expect(e.technician).toBeTruthy()
        expect(e.timestamp).toBeTruthy()
      })
      const times = stream.events.map((e) => e.timestamp)
      const sorted = [...times].sort((a, b) => b.localeCompare(a))
      expect(times).toEqual(sorted)
      const inUseRoomIds = new Set(stream.rooms.filter((r) => r.state === 'IN_USE').map((r) => r.roomId))
      for (const roomId of inUseRoomIds) {
        expect(stream.events.some((e) => e.roomId === roomId && e.type === 'EXAM_START')).toBe(true)
      }
      expect(stream.events.some((e) => e.type === 'EMERGENCY')).toBe(true)
    })

    it('确定性: 两次调用一致', () => {
      const service = new TechOverviewService(makePrisma())
      const now = new Date('2026-08-18T09:30:00Z')
      const a = service.getRoomStatusStream(now)
      const b = service.getRoomStatusStream(now)
      expect(a).toEqual(b)
    })
  })

  describe('5. 孤儿模块回退 + 元数据', () => {
    it('DB 不可用 → 全部端点回退确定性种子且正常返回', async () => {
      const service = new TechOverviewService(makePrisma())
      const dist = await service.getAppointmentDistribution({ days: '7' })
      expect(dist.seeded).toBe(true)
      const peaks = await service.getAppointmentPeaks({ days: '7' })
      expect(peaks.seeded).toBe(true)
      const att = await service.getAppointmentAttendance({ days: '7' })
      expect(att.seeded).toBe(true)
      expect(dist.total).toBeGreaterThan(0)
      expect(peaks.peaks).toHaveLength(8)
      expect(att.total).toBe(dist.total)
    })

    it('getMeta 返回房间/技师/模态/时段', () => {
      const service = new TechOverviewService(makePrisma())
      const meta = service.getMeta()
      expect(meta.rooms.length).toBeGreaterThanOrEqual(6)
      expect(meta.technicians.length).toBeGreaterThanOrEqual(8)
      expect(meta.modalities).toEqual(expect.arrayContaining(['CT', 'MR', 'DR', 'DSA', 'MG']))
      expect(meta.periods).toHaveLength(8)
      expect(meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})

interface AttendanceLike {
  total: number
  noShow: number
}

/**
 * G005 RIS v3.0.6.11-101 Wave 5 (tech-overview) - 控制器端点 spec
 * - 全部端点 200 (孤儿模块, 无 DB)
 * - 委托正确性 (controller → service)
 * - 非法 days → 400
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { TechOverviewController } from './tech-overview.controller'
import { TechOverviewService } from './tech-overview.service'

describe('TechOverviewController (Wave 5 端点 200)', () => {
  let app: INestApplication
  const serviceMock = {
    getMeta: jest.fn().mockReturnValue({
      rooms: [{ id: 'R-CT1', name: 'CT-1 检查室', modality: 'CT', technician: '刘洋' }],
      technicians: [{ id: 'T-001', name: '刘洋', group: 'CT 组' }],
      modalities: ['CT'],
      date: '2026-08-17',
      periods: [{ period: '09-12', hourRange: '9-13' }],
    }),
    getAppointmentDistribution: jest.fn().mockImplementation((params: { startDate?: string; days?: string }) => {
      const daysNum = Number(params.days)
      if (params.days !== undefined && params.days !== '' && (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > 90)) {
        throw new BadRequestException('days 应为 1-90')
      }
      return {
        startDate: '2026-08-17',
        days: 30,
        total: 1800,
        seeded: true,
        byModality: [{ key: 'CT', label: 'CT', count: 600, pct: 33.3 }],
        byPeriod: [{ key: '09-12', label: '09-12', count: 300, pct: 16.7 }],
        byWeekday: [{ key: '1', label: '周一', count: 300, pct: 16.7 }],
        byDevice: [{ key: 'R-CT1', label: 'CT-1 检查室', modality: 'CT', count: 300, pct: 16.7 }],
        heatmap: [{ period: '09-12', weekday: '周一', count: 60 }],
      }
    }),
    getAppointmentPeaks: jest.fn().mockReturnValue({
      startDate: '2026-08-17',
      days: 30,
      seeded: true,
      overallAverage: 7.5,
      peaks: [{ period: '09-12', hourRange: '9-13', avgCount: 12, maxCount: 20, maxDay: '2026-08-18', level: 'HIGH', peakDays: [] }],
      busiestPeriod: '09-12',
      busiestWeekday: '周五',
      recommendation: '建议增派技师',
    }),
    getAppointmentAttendance: jest.fn().mockReturnValue({
      startDate: '2026-08-17',
      days: 30,
      seeded: true,
      total: 1800,
      attended: 1500,
      noShow: 180,
      cancelled: 60,
      upcoming: 60,
      noShowRate: 10.7,
      attendanceRate: 83.3,
      byModality: [],
      byWeekday: [],
    }),
    getDashboardOverview: jest.fn().mockReturnValue({
      date: '2026-08-17',
      generatedAt: '2026-08-17T09:00:00.000Z',
      seeded: true,
      onDutyCount: 7,
      offDutyCount: 1,
      technicianTotal: 8,
      roomCount: 6,
      inUseRooms: 3,
      idleRooms: 2,
      inProgressCount: 3,
      waitingCount: 8,
      pendingEmergencyCount: 2,
      duty: [{ technicianId: 'T-001', name: '刘洋', group: 'CT 组', shift: 'DAY', shiftLabel: '白班' }],
      rooms: [{ roomId: 'R-CT1', roomName: 'CT-1 检查室', modality: 'CT', technician: '刘洋', state: 'IN_USE', currentExam: null, queueCount: 2, todayExams: 12 }],
    }),
    getRoomStatusStream: jest.fn().mockReturnValue({
      generatedAt: '2026-08-17T09:00:00.000Z',
      seeded: true,
      rooms: [{ roomId: 'R-CT1', roomName: 'CT-1 检查室', modality: 'CT', technician: '刘洋', state: 'IN_USE', currentExam: null, queueCount: 2, todayExams: 12 }],
      events: [{ id: 'EVT-001', roomId: 'R-CT1', roomName: 'CT-1 检查室', modality: 'CT', type: 'EXAM_START', patientName: '张伟', examItem: '胸部CT平扫', technician: '刘洋', timestamp: '2026-08-17T08:58:00.000Z', note: '检查开始' }],
    }),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TechOverviewController],
      providers: [{ provide: TechOverviewService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /tech-overview/meta → 200', async () => {
    const res = await request(app.getHttpServer()).get('/tech-overview/meta').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.rooms[0].id).toBe('R-CT1')
  })

  it('GET /tech-overview/appointments/distribution → 200 (分桶分布)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-overview/appointments/distribution?days=30&startDate=2026-08-17').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.total).toBe(1800)
    expect(res.body.data.byModality[0].count).toBe(600)
    expect(serviceMock.getAppointmentDistribution).toHaveBeenCalledWith({ startDate: '2026-08-17', days: '30' })
  })

  it('GET /tech-overview/appointments/distribution days 越界 → 400', async () => {
    await request(app.getHttpServer()).get('/tech-overview/appointments/distribution?days=99').expect(400)
    await request(app.getHttpServer()).get('/tech-overview/appointments/distribution?days=0').expect(400)
  })

  it('GET /tech-overview/appointments/peaks → 200 (高峰时段识别)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-overview/appointments/peaks?days=14').expect(200)
    expect(res.body.data.busiestPeriod).toBe('09-12')
    expect(res.body.data.peaks[0].level).toBe('HIGH')
  })

  it('GET /tech-overview/appointments/attendance → 200 (爽约率)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-overview/appointments/attendance?days=30').expect(200)
    expect(res.body.data.noShowRate).toBeCloseTo(10.7, 1)
    expect(res.body.data.noShow + res.body.data.attended + res.body.data.cancelled + res.body.data.upcoming).toBe(res.body.data.total)
  })

  it('GET /tech-overview/dashboard/overview → 200 (值班概览)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-overview/dashboard/overview').expect(200)
    expect(res.body.data.onDutyCount).toBe(7)
    expect(res.body.data.inProgressCount).toBe(3)
    expect(res.body.data.pendingEmergencyCount).toBe(2)
  })

  it('GET /tech-overview/dashboard/rooms → 200 (房间实时状态流)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-overview/dashboard/rooms').expect(200)
    expect(res.body.data.events[0].type).toBe('EXAM_START')
    expect(res.body.data.rooms[0].state).toBe('IN_USE')
  })
})

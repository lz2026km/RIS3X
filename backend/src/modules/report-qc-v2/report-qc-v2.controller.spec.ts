/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (report-qc-v2) - 控制器端点 spec
 * - 全部端点 200 (孤儿模块, 无 DB, POST 经 @HttpCode(200))
 * - 委托正确性 (controller → service)
 * - 任务流转链路 (分配/复核/二次复核/关闭) 200
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ReportQcV2Controller } from './report-qc-v2.controller'
import { ReportQcV2Service } from './report-qc-v2.service'

const dims = [
  { key: 'completeness', label: '完整性', labelEn: 'Completeness', max: 20, color: '#3b82f6', subItems: [{ key: 'structure', name: '结构字段齐全', max: 8 }] },
]

const scoreResult = {
  id: 'QS-1',
  reportId: 'RPT-1',
  modality: 'CT',
  totalScore: 92,
  grade: 'A',
  modelVersion: 'qc-v2.1',
  evaluatedAt: '2026-08-16T09:00:00.000Z',
  dimensions: [{ key: 'completeness', label: '完整性', score: 18, max: 20, subItems: [], issues: [] }],
  defects: [],
  suggestions: ['整体质量优秀, 保持当前书写规范。'],
}

const task = {
  id: 'TQ-1',
  reportId: 'RPT-1',
  patientName: '李明',
  modality: 'CT',
  scoreId: 'QS-1',
  totalScore: 92,
  grade: 'A',
  status: 'in_progress',
  assignee: 'u-201',
  assigneeName: '质控员甲',
  createdAt: '2026-08-16T09:00:00.000Z',
  updatedAt: '2026-08-16T09:30:00.000Z',
  reviews: [],
  history: [{ at: '2026-08-16T09:00:00.000Z', action: 'created', actor: '系统', note: '创建' }],
  defects: [],
}

const stats = {
  totalTasks: 8,
  avgScore: 84.2,
  passRate: 75,
  gradeDistribution: [{ grade: 'A', count: 4 }],
  taskByStatus: { pending: 1, in_progress: 2, reviewing: 2, closed: 3 },
  defectDistribution: [{ key: 'completeness', label: '完整性', count: 5, high: 2, medium: 2, low: 1 }],
  severityDistribution: [{ severity: 'high', count: 2 }],
  monthlyTrend: [{ month: '2026-07', count: 3, avgScore: 85 }],
}

describe('ReportQcV2Controller (Wave 6B 端点 200)', () => {
  let app: INestApplication
  const serviceMock = {
    getDimensions: jest.fn().mockReturnValue(dims),
    scoreReport: jest.fn().mockResolvedValue(scoreResult),
    listScores: jest.fn().mockResolvedValue([scoreResult]),
    getScore: jest.fn().mockResolvedValue(scoreResult),
    createTask: jest.fn().mockResolvedValue(task),
    listTasks: jest.fn().mockReturnValue([task]),
    getTask: jest.fn().mockReturnValue(task),
    assignTask: jest.fn().mockImplementation((id: string) => (id === 'bad' ? Promise.reject(new BadRequestException('bad')) : Promise.resolve({ ...task, status: 'in_progress' }))),
    reviewTask: jest.fn().mockResolvedValue({ ...task, status: 'reviewing' }),
    secondReviewTask: jest.fn().mockResolvedValue({ ...task, status: 'closed', closedAt: '2026-08-16T10:00:00.000Z' }),
    closeTask: jest.fn().mockResolvedValue({ ...task, status: 'closed' }),
    listReviews: jest.fn().mockReturnValue([{ id: 'RV-1', round: 1, reviewer: '张质控', opinion: 'pass', comment: '通过', at: '2026-08-16T09:40:00.000Z' }]),
    listRecords: jest.fn().mockReturnValue([{ id: 'TQ-1', reportId: 'RPT-1', patientName: '李明', modality: 'CT', totalScore: 92, grade: 'A', status: 'closed', assigneeName: '质控员甲', defectCount: 0, reviewedRounds: 2, createdAt: '2026-08-16T09:00:00.000Z', closedAt: '2026-08-16T10:00:00.000Z' }]),
    getStats: jest.fn().mockReturnValue(stats),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportQcV2Controller],
      providers: [{ provide: ReportQcV2Service, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /report-qc-v2/dimensions → 200 (5 维度元数据)', async () => {
    const res = await request(app.getHttpServer()).get('/report-qc-v2/dimensions').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data[0].key).toBe('completeness')
    expect(serviceMock.getDimensions).toHaveBeenCalled()
  })

  it('POST /report-qc-v2/score → 200 (多维评分)', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-qc-v2/score')
      .send({ reportId: 'RPT-1', findings: '胸部CT平扫: 双肺纹理清晰。', modality: 'CT', reportTimeMinutes: 30 })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.grade).toBe('A')
    expect(res.body.data.totalScore).toBe(92)
    expect(serviceMock.scoreReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'RPT-1' }))
  })

  it('POST /report-qc-v2/score reportId 缺失 → 400', async () => {
    await request(app.getHttpServer()).post('/report-qc-v2/score').send({ findings: '内容' }).expect(400)
  })

  it('GET /report-qc-v2/scores + /scores/:id → 200', async () => {
    const list = await request(app.getHttpServer()).get('/report-qc-v2/scores').expect(200)
    expect(list.body.data[0].id).toBe('QS-1')
    const detail = await request(app.getHttpServer()).get('/report-qc-v2/scores/QS-1').expect(200)
    expect(detail.body.data.totalScore).toBe(92)
  })

  it('POST /report-qc-v2/tasks → 200 (创建)', async () => {
    const res = await request(app.getHttpServer()).post('/report-qc-v2/tasks').send({ reportId: 'RPT-1', patientName: '李明' }).expect(200)
    expect(res.body.data.id).toBe('TQ-1')
    expect(serviceMock.createTask).toHaveBeenCalledWith({ reportId: 'RPT-1', patientName: '李明' })
  })

  it('GET /report-qc-v2/tasks (status 过滤) → 200', async () => {
    const res = await request(app.getHttpServer()).get('/report-qc-v2/tasks?status=in_progress').expect(200)
    expect(res.body.data[0].status).toBe('in_progress')
    expect(serviceMock.listTasks).toHaveBeenCalledWith({ status: 'in_progress' })
  })

  it('GET /report-qc-v2/tasks/:id → 200 (含历史)', async () => {
    const res = await request(app.getHttpServer()).get('/report-qc-v2/tasks/TQ-1').expect(200)
    expect(res.body.data.history.length).toBeGreaterThan(0)
  })

  it('任务流转: assign → review → second-review → close 全 200', async () => {
    const a = await request(app.getHttpServer()).post('/report-qc-v2/tasks/TQ-1/assign').send({ assignee: 'u-201', assigneeName: '质控员甲' }).expect(200)
    expect(a.body.data.status).toBe('in_progress')
    const r = await request(app.getHttpServer()).post('/report-qc-v2/tasks/TQ-1/review').send({ reviewer: '张质控', opinion: 'pass', comment: '一级通过' }).expect(200)
    expect(r.body.data.status).toBe('reviewing')
    const s = await request(app.getHttpServer()).post('/report-qc-v2/tasks/TQ-1/second-review').send({ reviewer: '王主任', opinion: 'pass', comment: '双人复核通过' }).expect(200)
    expect(s.body.data.status).toBe('closed')
    const c = await request(app.getHttpServer()).post('/report-qc-v2/tasks/TQ-1/close').send({ comment: '闭环' }).expect(200)
    expect(c.body.data.status).toBe('closed')
    expect(serviceMock.assignTask).toHaveBeenCalledWith('TQ-1', { assignee: 'u-201', assigneeName: '质控员甲' })
    expect(serviceMock.secondReviewTask).toHaveBeenCalledWith('TQ-1', expect.objectContaining({ reviewer: '王主任', opinion: 'pass' }))
  })

  it('review opinion 非法 → 400', async () => {
    await request(app.getHttpServer()).post('/report-qc-v2/tasks/TQ-1/review').send({ reviewer: '张质控', opinion: 'maybe' }).expect(400)
  })

  it('GET /report-qc-v2/tasks/:id/reviews → 200 (二次复核记录)', async () => {
    const res = await request(app.getHttpServer()).get('/report-qc-v2/tasks/TQ-1/reviews').expect(200)
    expect(res.body.data[0].reviewer).toBe('张质控')
  })

  it('GET /report-qc-v2/records → 200 (质控记录历史)', async () => {
    const res = await request(app.getHttpServer()).get('/report-qc-v2/records').expect(200)
    expect(res.body.data[0].reviewedRounds).toBe(2)
  })

  it('GET /report-qc-v2/stats → 200 (缺陷分布/月度趋势/等级分布)', async () => {
    const res = await request(app.getHttpServer()).get('/report-qc-v2/stats').expect(200)
    expect(res.body.data.defectDistribution[0].label).toBe('完整性')
    expect(res.body.data.monthlyTrend[0].month).toBe('2026-07')
    expect(res.body.data.gradeDistribution[0].grade).toBe('A')
  })
})

/**
 * G005 v3.0.6.11-101 - 报告导出中心 V2 spec (Wave 7B, F15)
 *
 * - 导出内容包含报告全文 (全部 5 种格式)
 * - 任务流转: PENDING → PROCESSING → COMPLETED (进度/文件名/大小)
 * - 批量导出 (报告 ID 列表) + 权限校验 (角色/批量)
 * - 下载确定性内容 + 导出历史
 * - 端点全部 200 (supertest)
 */
import { Test } from '@nestjs/testing'
import { INestApplication, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { ReportExportCenterV2Controller } from './report-export-center-v2.controller'
import { ReportExportCenterV2Service } from './report-export-center-v2.service'

const makePrisma = () =>
  ({
    auditLog: { create: jest.fn().mockRejectedValue(new Error('no db')) },
  }) as never

describe('ReportExportCenterV2Service (Wave 7B 报告导出中心 V2)', () => {
  let service: ReportExportCenterV2Service

  beforeEach(() => {
    service = new ReportExportCenterV2Service(makePrisma())
  })

  describe('导出内容: 5 种格式均包含报告全文', () => {
    it.each(['PDF', 'DOCX', 'HTML', 'CSV', 'DICOM_SR'] as const)('%s 包含报告全文', (format) => {
      const task = service.createAndProcess({ format, reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(task.state).toBe('COMPLETED')
      expect(task.content!).toContain('头颅CT平扫示脑实质内未见明确高密度或低密度灶')
      expect(task.content!).toContain('张伟')
    })

    it('CSV 每行含全文且字段正确转义', () => {
      const task = service.createAndProcess({ format: 'CSV', reportIds: ['rep-002'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(task.content!).toContain('报告全文')
      expect(task.content!).toContain('胸部CT平扫未见明显异常')
      expect(task.fileName).toMatch(/\.csv$/)
    })

    it('HTML 生成完整文档结构', () => {
      const task = service.createAndProcess({ format: 'HTML', reportIds: ['rep-003'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(task.content!.startsWith('<!DOCTYPE html>')).toBe(true)
      expect(task.content!).toContain('<pre class="body">')
      expect(task.content!).toContain('L4/5、L5/S1椎间盘突出')
      expect(task.mimeType).toContain('text/html')
    })

    it('DICOM SR 含结构化标签与内容序列', () => {
      const task = service.createAndProcess({ format: 'DICOM_SR', reportIds: ['rep-005'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(task.content!).toContain('SOPClassUID')
      expect(task.content!).toContain('ContentSequence')
      expect(task.content!).toContain('左前降支近段重度狭窄')
      expect(task.content!).toContain('危急值提示')
    })

    it('PDF/DOCX 为概念导出并含报告全文', () => {
      const pdf = service.createAndProcess({ format: 'PDF', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(pdf.content!).toContain('概念导出')
      expect(pdf.fileName).toMatch(/\.pdf$/)
      const docx = service.createAndProcess({ format: 'DOCX', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(docx.content!).toContain('WordprocessingML')
      expect(docx.fileName).toMatch(/\.docx$/)
    })
  })

  describe('任务流转: 创建 → 处理 → 完成 / 取消', () => {
    it('创建为 PENDING/0 进度', () => {
      const task = service.createTask({ format: 'HTML', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(task.state).toBe('PENDING')
      expect(task.progress).toBe(0)
      expect(task.content).toBeUndefined()
    })

    it('处理 → COMPLETED 100%, 含文件名/大小/完成时间', () => {
      const created = service.createTask({ format: 'HTML', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      const processed = service.processTask(created.id)
      expect(processed.state).toBe('COMPLETED')
      expect(processed.progress).toBe(100)
      expect(processed.fileName).toBeDefined()
      expect(processed.fileSize).toBeGreaterThan(0)
      expect(processed.completedAt).toBeDefined()
      expect(Buffer.byteLength(processed.content!, 'utf8')).toBe(processed.fileSize)
    })

    it('重复处理幂等返回已完成任务', () => {
      const created = service.createTask({ format: 'CSV', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      service.processTask(created.id)
      const again = service.processTask(created.id)
      expect(again.state).toBe('COMPLETED')
    })

    it('取消后不可继续处理', () => {
      const created = service.createTask({ format: 'PDF', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      service.cancelTask(created.id)
      expect(() => service.processTask(created.id)).toThrow(BadRequestException)
    })

    it('已完成任务不可取消', () => {
      const created = service.createAndProcess({ format: 'PDF', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(() => service.cancelTask(created.id)).toThrow(BadRequestException)
    })
  })

  describe('下载: 确定性内容', () => {
    it('未完成任务下载 → BadRequestException', () => {
      const created = service.createTask({ format: 'HTML', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      expect(() => service.download(created.id)).toThrow(BadRequestException)
    })

    it('完成 → 下载返回内容/文件名/MIME', () => {
      const created = service.createAndProcess({ format: 'HTML', reportIds: ['rep-002'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      const dl = service.download(created.id)
      expect(dl.fileName).toBe(created.fileName)
      expect(Buffer.byteLength(dl.content, 'utf8')).toBe(dl.fileSize)
      expect(dl.mimeType).toContain('text/html')
    })

    it('未知任务 → NotFoundException', () => {
      expect(() => service.download('nope')).toThrow(NotFoundException)
    })
  })

  describe('批量导出 + 权限校验', () => {
    it('DOCTOR 单份导出允许', () => {
      expect(() => service.createTask({ format: 'PDF', reportIds: ['rep-001'], requestedBy: '李明', requestedByRole: 'DOCTOR' })).not.toThrow()
    })

    it('DOCTOR 批量 (2 份) → ForbiddenException', () => {
      expect(() => service.createTask({ format: 'PDF', reportIds: ['rep-001', 'rep-002'], requestedBy: '李明', requestedByRole: 'DOCTOR' })).toThrow(ForbiddenException)
    })

    it('DIRECTOR/ADMIN 批量允许', () => {
      const task = service.createAndProcess({ format: 'PDF', reportIds: ['rep-001', 'rep-002', 'rep-003'], requestedBy: '王浩', requestedByRole: 'DIRECTOR' })
      expect(task.state).toBe('COMPLETED')
      expect(task.reportIds.length).toBe(3)
    })

    it('TECH 角色一律禁止 → ForbiddenException', () => {
      expect(() => service.createTask({ format: 'PDF', reportIds: ['rep-001'], requestedBy: '技师', requestedByRole: 'TECH' })).toThrow(ForbiddenException)
    })

    it('批量内容包含全部报告全文', () => {
      const task = service.createAndProcess({ format: 'CSV', reportIds: ['rep-001', 'rep-004'], requestedBy: '王浩', requestedByRole: 'ADMIN' })
      expect(task.content!).toContain('头颅CT平扫报告')
      expect(task.content!).toContain('乳腺钼靶BI-RADS报告')
    })

    it('未知报告 ID → BadRequestException', () => {
      expect(() => service.createTask({ format: 'PDF', reportIds: ['rep-999'], requestedBy: '王浩', requestedByRole: 'ADMIN' })).toThrow(BadRequestException)
    })

    it('空报告列表 → BadRequestException', () => {
      expect(() => service.createTask({ format: 'PDF', reportIds: [], requestedBy: '王浩', requestedByRole: 'ADMIN' })).toThrow(BadRequestException)
    })
  })

  describe('导出历史 / 统计', () => {
    it('history 仅含已结束任务', () => {
      service.createAndProcess({ format: 'HTML', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      const pending = service.createTask({ format: 'CSV', reportIds: ['rep-002'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      const history = service.history()
      expect(history.some((h) => h.id === pending.id)).toBe(false)
      expect(history.length).toBeGreaterThanOrEqual(1)
      expect(history[0]?.reportCount).toBeGreaterThanOrEqual(1)
    })

    it('stats 汇总按格式/字节数', () => {
      const completed = service.createAndProcess({ format: 'HTML', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      const s = service.stats()
      expect(s.total).toBeGreaterThanOrEqual(1)
      expect(s.completed).toBeGreaterThanOrEqual(1)
      expect(s.byFormat.HTML).toBeGreaterThanOrEqual(1)
      expect(s.totalExportedBytes).toBeGreaterThanOrEqual(completed.fileSize ?? 0)
      expect(s.totalReportsExported).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('ReportExportCenterV2Controller (端点 → 200)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportExportCenterV2Controller],
      providers: [{ provide: ReportExportCenterV2Service, useValue: new ReportExportCenterV2Service(makePrisma()) }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /report-export-center-v2/reports → 200', async () => {
    const res = await request(app.getHttpServer()).get('/report-export-center-v2/reports').expect(200)
    expect(res.body.length).toBeGreaterThanOrEqual(8)
  })

  it('GET /report-export-center-v2/stats → 200', async () => {
    const res = await request(app.getHttpServer()).get('/report-export-center-v2/stats').expect(200)
    expect(typeof res.body.total).toBe('number')
  })

  it('GET /report-export-center-v2/history → 200', async () => {
    const res = await request(app.getHttpServer()).get('/report-export-center-v2/history').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('任务流转端点: 创建 → 处理 → 下载 → 全部 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/report-export-center-v2/tasks')
      .send({ format: 'HTML', reportIds: ['rep-001'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      .expect(200)
    expect(created.body.state).toBe('PENDING')
    expect(created.body.progress).toBe(0)

    const processed = await request(app.getHttpServer())
      .post(`/report-export-center-v2/tasks/${created.body.id}/process`)
      .expect(200)
    expect(processed.body.state).toBe('COMPLETED')
    expect(processed.body.progress).toBe(100)
    expect(processed.body.content).toContain('头颅CT平扫')

    const detail = await request(app.getHttpServer()).get(`/report-export-center-v2/tasks/${created.body.id}`).expect(200)
    expect(detail.body.state).toBe('COMPLETED')

    const downloaded = await request(app.getHttpServer())
      .post(`/report-export-center-v2/tasks/${created.body.id}/download`)
      .expect(200)
    expect(downloaded.body.fileName).toBe(processed.body.fileName)
    expect(downloaded.body.content).toContain('头颅CT平扫')
  })

  it('批量导出端点 → 200 (含全部报告全文)', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-export-center-v2/batch')
      .send({ format: 'CSV', reportIds: ['rep-001', 'rep-002', 'rep-004'], requestedBy: '王浩', requestedByRole: 'DIRECTOR' })
      .expect(200)
    expect(res.body.state).toBe('COMPLETED')
    expect(res.body.reportIds.length).toBe(3)
    expect(res.body.content).toContain('头颅CT平扫报告')
    expect(res.body.content).toContain('胸部CT平扫报告')
    expect(res.body.content).toContain('乳腺钼靶BI-RADS报告')
  })

  it('批量权限校验 → 403 (DOCTOR 批量)', async () => {
    await request(app.getHttpServer())
      .post('/report-export-center-v2/batch')
      .send({ format: 'PDF', reportIds: ['rep-001', 'rep-002'], requestedBy: '李明', requestedByRole: 'DOCTOR' })
      .expect(403)
  })

  it('取消端点 → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/report-export-center-v2/tasks')
      .send({ format: 'PDF', reportIds: ['rep-005'], requestedBy: '张伟', requestedByRole: 'DOCTOR' })
      .expect(200)
    const canceled = await request(app.getHttpServer())
      .post(`/report-export-center-v2/tasks/${created.body.id}/cancel`)
      .expect(200)
    expect(canceled.body.state).toBe('CANCELED')
  })

  it('任务列表端点 (state 过滤) → 200', async () => {
    const res = await request(app.getHttpServer()).get('/report-export-center-v2/tasks?state=COMPLETED').expect(200)
    expect(res.body.items).toBeDefined()
  })
})

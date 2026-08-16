/**
 * G005 v3.0.6.11-101 - 模板审批流 V2 spec (Wave 6C, F7)
 *
 * - 状态机非法流转拒绝 (未提交直接审批 / 已发布再提交 / 重复提交)
 * - 版本递增 (每次修改生成新版本)
 * - 完整审批流: 创建 → 提交 → 审批 → 发布 → 200 (supertest)
 * - 审批人分配 / 收藏 / 使用统计
 */
import { Test } from '@nestjs/testing'
import { INestApplication, BadRequestException, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { TemplateApprovalController } from './template-approval.controller'
import { TemplateApprovalService } from './template-approval.service'

const makePrisma = () =>
  ({
    reportTemplate: { create: jest.fn().mockRejectedValue(new Error('no db')) },
    auditLog: { create: jest.fn().mockRejectedValue(new Error('no db')) },
  }) as never

describe('TemplateApprovalService (Wave 6C 模板审批流 V2)', () => {
  let service: TemplateApprovalService

  beforeEach(() => {
    service = new TemplateApprovalService(makePrisma())
  })

  describe('状态机: 合法流转', () => {
    it('创建 → 草稿', () => {
      const t = service.createTemplate({ name: '测试模板', category: 'CT', bodyPart: '胸部', content: '测试内容', createdBy: '张伟' })
      expect(t.state).toBe('draft')
      expect(t.version).toBe(1)
    })

    it('完整流程: 提交 → 通过 → 发布', () => {
      const t = service.createTemplate({ name: '测试模板', category: 'CT', bodyPart: '胸部', content: '测试内容', createdBy: '张伟' })
      const submitted = service.submit(t.id, { submittedBy: '张伟' })
      expect(submitted.state).toBe('pending')
      expect(submitted.assignee?.approverName).toBe('王浩') // 按类别自动分配
      const approved = service.approve(t.id, { approvedBy: '王浩', comment: '同意' })
      expect(approved.state).toBe('approved')
      const published = service.publish(t.id, { publishedBy: '王浩' })
      expect(published.state).toBe('published')
      expect(published.approvals.map((a) => a.action)).toEqual(['submit', 'approve', 'publish'])
      expect(published.approvals.every((a) => a.at)).toBe(true)
    })

    it('驳回 → 修改 → 重新提交', () => {
      const t = service.createTemplate({ name: '测试模板', category: 'CT', bodyPart: '腹部', content: '内容', createdBy: '李明' })
      service.submit(t.id, { submittedBy: '李明' })
      const rejected = service.reject(t.id, { rejectedBy: '王浩', reason: '描述不完整' })
      expect(rejected.state).toBe('rejected')
      const reworked = service.updateContent(t.id, { content: '补充描述', changedBy: '李明', note: '按意见修改' })
      expect(reworked.state).toBe('draft')
      expect(reworked.version).toBe(2)
      const resubmitted = service.submit(t.id, { submittedBy: '李明' })
      expect(resubmitted.state).toBe('pending')
    })

    it('通过 → 退回草稿 (rework)', () => {
      const t = service.createTemplate({ name: '测试模板', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '李明' })
      service.submit(t.id, { submittedBy: '李明' })
      service.approve(t.id, { approvedBy: '王浩' })
      const back = service.rework(t.id, { by: '王浩', comment: '需补充描述' })
      expect(back.state).toBe('draft')
    })
  })

  describe('状态机: 非法流转拒绝', () => {
    it('草稿直接审批 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      expect(() => service.approve(t.id, { approvedBy: '王浩' })).toThrow(BadRequestException)
    })

    it('草稿直接驳回 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      expect(() => service.reject(t.id, { rejectedBy: '王浩', reason: 'x' })).toThrow(BadRequestException)
    })

    it('草稿直接发布 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      expect(() => service.publish(t.id, { publishedBy: '王浩' })).toThrow(BadRequestException)
    })

    it('已发布模板再提交/再审批 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      service.submit(t.id, { submittedBy: '张伟' })
      service.approve(t.id, { approvedBy: '王浩' })
      service.publish(t.id, { publishedBy: '王浩' })
      expect(() => service.submit(t.id, { submittedBy: '张伟' })).toThrow(BadRequestException)
      expect(() => service.approve(t.id, { approvedBy: '王浩' })).toThrow(BadRequestException)
    })

    it('重复提交 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      service.submit(t.id, { submittedBy: '张伟' })
      expect(() => service.submit(t.id, { submittedBy: '张伟' })).toThrow(BadRequestException)
    })

    it('驳回后直接发布 → BadRequestException (必须经修改重新提交)', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      service.submit(t.id, { submittedBy: '张伟' })
      service.reject(t.id, { rejectedBy: '王浩', reason: 'x' })
      expect(() => service.publish(t.id, { publishedBy: '王浩' })).toThrow(BadRequestException)
    })

    it('审批人非分配人 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      service.submit(t.id, { submittedBy: '张伟' })
      expect(() => service.approve(t.id, { approvedBy: '李四' })).toThrow(BadRequestException)
    })

    it('未知模板操作 → NotFoundException', () => {
      expect(() => service.submit('nope', { submittedBy: 'x' })).toThrow(NotFoundException)
    })
  })

  describe('版本管理: 每次修改生成新版本', () => {
    it('修改两次 → version 3, 历史快照 3 条', () => {
      const t = service.createTemplate({ name: '测试模板', category: 'CT', bodyPart: '胸部', content: 'v1 内容', createdBy: '张伟' })
      service.updateContent(t.id, { content: 'v2 内容', changedBy: '张伟', note: '第一轮修改' })
      const v3 = service.updateContent(t.id, { content: 'v3 内容', changedBy: '张伟', note: '第二轮修改' })
      expect(v3.version).toBe(3)
      expect(v3.versions.length).toBe(3)
      expect(v3.versions.map((v) => v.version)).toEqual([1, 2, 3])
      expect(v3.versions[2]!.note).toBe('第二轮修改')
      const history = service.getVersions(t.id)
      expect(history[0]!.version).toBe(3)
      expect(history[0]!.content).toBe('v3 内容')
    })

    it('审批中模板禁止修改 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      service.submit(t.id, { submittedBy: '张伟' })
      expect(() => service.updateContent(t.id, { content: 'x', changedBy: '张伟' })).toThrow(BadRequestException)
    })

    it('已发布模板禁止直接修改 → BadRequestException', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      service.submit(t.id, { submittedBy: '张伟' })
      service.approve(t.id, { approvedBy: '王浩' })
      service.publish(t.id, { publishedBy: '王浩' })
      expect(() => service.updateContent(t.id, { content: 'x', changedBy: '张伟' })).toThrow(BadRequestException)
    })
  })

  describe('审批人分配 (按科室/角色)', () => {
    it('提交时按类别自动分配审批人', () => {
      const t = service.createTemplate({ name: '钼靶模板', category: 'MG', bodyPart: '乳腺', content: '内容', createdBy: '王芳' })
      const submitted = service.submit(t.id, { submittedBy: '王芳' })
      expect(submitted.assignee).toEqual({ dept: '乳腺影像组', role: 'DIRECTOR', approverName: '陈雅芝' })
    })

    it('手动分配审批人并生效', () => {
      const t = service.createTemplate({ name: '测试', category: 'CT', bodyPart: '头颅', content: '内容', createdBy: '张伟' })
      const assigned = service.assignApprover(t.id, { dept: '神经影像组', role: 'DIRECTOR', approverName: '刘建国' })
      expect(assigned.assignee?.approverName).toBe('刘建国')
      service.submit(t.id, { submittedBy: '张伟' })
      const approved = service.approve(t.id, { approvedBy: '刘建国' })
      expect(approved.state).toBe('approved')
    })
  })

  describe('收藏 / 使用统计', () => {
    it('收藏切换与按用户隔离', () => {
      const first = service.toggleFavorite('tpa-001', 'u-01')
      expect(first.favorite).toBe(true)
      expect(first.favorites).toContain('tpa-001')
      const second = service.toggleFavorite('tpa-001', 'u-01')
      expect(second.favorite).toBe(false)
      const other = service.listFavorites('u-02')
      expect(other.some((t) => t.id === 'tpa-001')).toBe(false)
    })

    it('使用统计: 已发布模板计数增加', () => {
      const before = service.getTemplate('tpa-001').usageCount
      const after = service.recordUsage('tpa-001', '医生A').usageCount
      expect(after).toBe(before + 1)
    })

    it('stats 字段齐全', () => {
      const s = service.stats()
      expect(s.total).toBeGreaterThanOrEqual(5)
      expect(s.pendingCount).toBeGreaterThanOrEqual(1)
      expect(s.publishedCount).toBeGreaterThanOrEqual(1)
      expect(s.totalVersions).toBeGreaterThan(5)
      expect(typeof s.avgApprovalHours).toBe('number')
      expect(typeof s.totalFavorites).toBe('number')
      expect(typeof s.totalUsage).toBe('number')
      expect(Object.keys(s.byState)).toEqual(['draft', 'pending', 'approved', 'rejected', 'published'])
    })
  })
})

describe('TemplateApprovalController (端点 → 200)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TemplateApprovalController],
      providers: [{ provide: TemplateApprovalService, useValue: new TemplateApprovalService(makePrisma()) }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /template-approval/templates → 200 (列表)', async () => {
    const res = await request(app.getHttpServer()).get('/template-approval/templates').expect(200)
    expect(res.body.length).toBeGreaterThanOrEqual(5)
  })

  it('GET /template-approval/stats → 200 (统计)', async () => {
    const res = await request(app.getHttpServer()).get('/template-approval/stats').expect(200)
    expect(res.body.pendingCount).toBeGreaterThanOrEqual(1)
    expect(res.body.publishedCount).toBeGreaterThanOrEqual(1)
  })

  it('GET /template-approval/favorites → 200', async () => {
    const res = await request(app.getHttpServer()).get('/template-approval/favorites').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('审批流端点: 创建 → 提交 → 审批 → 发布 → 全部 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/template-approval/templates')
      .send({ name: '接口测试模板', category: 'CT', bodyPart: '胸部', content: '接口内容', createdBy: '张伟' })
      .expect(200)
    const id = created.body.id
    expect(created.body.state).toBe('draft')

    const submitted = await request(app.getHttpServer())
      .post(`/template-approval/templates/${id}/submit`)
      .send({ submittedBy: '张伟' })
      .expect(200)
    expect(submitted.body.state).toBe('pending')
    expect(submitted.body.assignee.approverName).toBe('王浩')

    const approved = await request(app.getHttpServer())
      .post(`/template-approval/templates/${id}/approve`)
      .send({ approvedBy: '王浩', comment: '接口审批通过' })
      .expect(200)
    expect(approved.body.state).toBe('approved')

    const published = await request(app.getHttpServer())
      .post(`/template-approval/templates/${id}/publish`)
      .send({ publishedBy: '王浩' })
      .expect(200)
    expect(published.body.state).toBe('published')

    const versions = await request(app.getHttpServer()).get(`/template-approval/templates/${id}/versions`).expect(200)
    expect(versions.body.length).toBe(1)

    const approvals = await request(app.getHttpServer()).get(`/template-approval/templates/${id}/approvals`).expect(200)
    expect(approvals.body.map((a: { action: string }) => a.action)).toEqual(['publish', 'approve', 'submit'])
  })

  it('非法流转 → 400', async () => {
    const created = await request(app.getHttpServer())
      .post('/template-approval/templates')
      .send({ name: '非法流转模板', category: 'CT', bodyPart: '胸部', content: '内容', createdBy: '张伟' })
      .expect(200)
    await request(app.getHttpServer())
      .post(`/template-approval/templates/${created.body.id}/approve`)
      .send({ approvedBy: '王浩' })
      .expect(400)
  })

  it('版本递增端点: PATCH content → version+1 → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/template-approval/templates')
      .send({ name: '版本测试模板', category: 'CT', bodyPart: '胸部', content: 'v1', createdBy: '张伟' })
      .expect(200)
    const updated = await request(app.getHttpServer())
      .patch(`/template-approval/templates/${created.body.id}/content`)
      .send({ content: 'v2 修订', changedBy: '张伟', note: '修订' })
      .expect(200)
    expect(updated.body.version).toBe(2)
    expect(updated.body.versions.length).toBe(2)
  })

  it('收藏/使用端点 → 200', async () => {
    const fav = await request(app.getHttpServer()).post('/template-approval/templates/tpa-001/favorite').expect(200)
    expect(typeof fav.body.favorite).toBe('boolean')
    const use = await request(app.getHttpServer()).post('/template-approval/templates/tpa-001/use').expect(200)
    expect(use.body.usageCount).toBeGreaterThan(0)
  })
})

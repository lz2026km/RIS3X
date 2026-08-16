/**
 * G005 v3.0.6.11-101 - 危急值管理 V2 spec (Wave 6C, F5)
 *
 * - 规则匹配正确性 (阈值边界: > 不含边界 / >= 含边界 / < / <= / contains)
 * - 通知状态流转 (sent → accepted|rejected, 重复确认拒绝, failed 不可确认)
 * - 统计端点 → 200 (supertest) + 字段齐全
 */
import { Test } from '@nestjs/testing'
import { INestApplication, BadRequestException, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { CriticalV2Controller } from './critical-v2.controller'
import { CriticalV2Service } from './critical-v2.service'

const makePrisma = () =>
  ({
    criticalValue: { create: jest.fn().mockRejectedValue(new Error('no db')) },
    auditLog: { create: jest.fn().mockRejectedValue(new Error('no db')) },
  }) as never

describe('CriticalV2Service (Wave 6C 危急值 V2)', () => {
  let service: CriticalV2Service

  beforeEach(() => {
    service = new CriticalV2Service(makePrisma())
  })

  describe('规则库', () => {
    it('内置规则 ≥ 20 条, 覆盖 CT 脑出血 / MR 急性梗死 / 肺栓塞', () => {
      const rules = service.listRules()
      expect(rules.length).toBeGreaterThanOrEqual(20)
      expect(rules.some((r) => r.code === 'CV-R-001' && r.name.includes('脑出血'))).toBe(true)
      expect(rules.some((r) => r.code === 'CV-R-002' && r.name.includes('脑梗死'))).toBe(true)
      expect(rules.some((r) => r.code === 'CV-R-003' && r.name.includes('肺栓塞'))).toBe(true)
    })

    it('支持按模态/类别/关键字过滤', () => {
      expect(service.listRules({ modality: 'MR' }).every((r) => r.modality === 'MR')).toBe(true)
      expect(service.listRules({ category: '神经' }).every((r) => r.category === '神经')).toBe(true)
      expect(service.listRules({ keyword: '肺栓塞' }).length).toBeGreaterThanOrEqual(1)
    })

    it('updateRule 可启停规则并持久生效', () => {
      service.updateRule('cvr-001', { enabled: false })
      const rule = service.listRules().find((r) => r.id === 'cvr-001')!
      expect(rule.enabled).toBe(false)
      const hits = service.evaluate({
        modality: 'CT', examType: '头颅CT平扫',
        items: [{ key: 'ct_value_hu', value: 82 }],
      }).triggers
      expect(hits.some((t) => t.ruleCode === 'CV-R-001')).toBe(false)
    })

    it('未知规则 → NotFoundException', () => {
      expect(() => service.updateRule('nope', { enabled: false })).toThrow(NotFoundException)
    })
  })

  describe('规则匹配正确性 (阈值边界)', () => {
    it('> 不含边界: 70 不触发, 70.1 触发', () => {
      const base = { modality: 'CT', examType: '头颅CT平扫' }
      const at = service.evaluate({ ...base, items: [{ key: 'ct_value_hu', value: 70 }] }).triggers
      expect(at.some((t) => t.ruleCode === 'CV-R-001')).toBe(false)
      const over = service.evaluate({ ...base, items: [{ key: 'ct_value_hu', value: 70.1 }] }).triggers
      expect(over.some((t) => t.ruleCode === 'CV-R-001')).toBe(true)
    })

    it('>= 含边界: 2 触发 (CV-R-015 胰周渗出 ≥ 2)', () => {
      const hits = service.evaluate({
        modality: 'CT', examType: '腹部CT增强',
        items: [{ key: 'peri_pancreatic_count', value: 2 }],
      }).triggers
      expect(hits.some((t) => t.ruleCode === 'CV-R-015')).toBe(true)
    })

    it('< 不含边界: 4.9 触发 (CV-R-019 胆囊壁 > 4 的取反验证用 <= 规则)', () => {
      service.createRule({
        name: '测试-阈值下界', category: '测试', modality: 'CT', examType: '腹部CT增强',
        itemKey: 'test_low', item: '测试值', operator: '<', threshold: 5, unit: 'mm',
        level: 'warning', description: '测试', suggestion: '测试', responseDeadlineMin: 30,
      })
      const at = service.evaluate({ modality: 'CT', examType: '腹部CT增强', items: [{ key: 'test_low', value: 5 }] }).triggers
      expect(at.some((t) => t.ruleName === '测试-阈值下界')).toBe(false)
      const below = service.evaluate({ modality: 'CT', examType: '腹部CT增强', items: [{ key: 'test_low', value: 4.9 }] }).triggers
      expect(below.some((t) => t.ruleName === '测试-阈值下界')).toBe(true)
    })

    it('contains: 描述关键字命中触发, 未命中不触发', () => {
      const hit = service.evaluate({ modality: 'CT', examType: '主动脉CTA', description: '升主动脉见内膜片及真假双腔' }).triggers
      expect(hit.some((t) => t.ruleCode === 'CV-R-005')).toBe(true)
      const miss = service.evaluate({ modality: 'CT', examType: '主动脉CTA', description: '主动脉管径正常, 未见异常' }).triggers
      expect(miss.some((t) => t.ruleCode === 'CV-R-005')).toBe(false)
    })

    it('模态不匹配不触发 (MR 输入不命中 CT 规则)', () => {
      const hits = service.evaluate({ modality: 'MR', examType: '头颅MR平扫', items: [{ key: 'ct_value_hu', value: 90 }] }).triggers
      expect(hits.some((t) => t.ruleCode === 'CV-R-001')).toBe(false)
    })

    it('规则可同时多命中, 结果带级别/描述/建议处置', () => {
      const hits = service.evaluate({
        modality: 'CT', examType: '头颅CT平扫',
        items: [{ key: 'ct_value_hu', value: 82 }, { key: 'midline_shift', value: 12 }],
        description: '脑沟高密度',
      }).triggers
      expect(hits.length).toBeGreaterThanOrEqual(3)
      const red = hits.find((t) => t.level === 'critical')!
      expect(red.description.length).toBeGreaterThan(0)
      expect(red.suggestion.length).toBeGreaterThan(0)
      expect(red.matchedText).toContain('阈值')
    })
  })

  describe('自动判定与通知管理', () => {
    it('judge 生成触发记录并自动发送三通道通知', async () => {
      const created = await service.judge({
        patientId: 'RAD-P099', patientName: '测试患者',
        modality: 'CT', examType: '头颅CT平扫',
        items: [{ key: 'ct_value_hu', value: 82 }],
        recipients: [{ name: '刘医生', dept: '神经外科', phone: '13800000001' }],
      })
      expect(created.length).toBe(1)
      const t = created[0]!
      expect(t.status).toBe('notified')
      const notes = service.listNotifications(t.id)
      expect(notes.length).toBe(3)
      expect(notes.map((n) => n.channel).sort()).toEqual(['message', 'phone', 'sms'])
      expect(notes.every((n) => n.content.includes('建议'))).toBe(true)
    })

    it('judge 未命中规则 → 空触发列表', async () => {
      const created = await service.judge({ modality: 'DR', examType: '胸部DR', description: '双肺纹理清晰' })
      expect(created.length).toBe(0)
    })

    it('通知失败模拟: 电话尾号 9 → failed, 短信尾号 8 → failed', async () => {
      const created = await service.judge({
        modality: 'CT', examType: '主动脉CTA', items: [{ key: 'aorta_diameter', value: 55 }],
        recipients: [
          { name: '心外A', phone: '13800000009', channels: ['phone'] },
          { name: '心外B', phone: '13800000008', channels: ['sms'] },
        ],
      })
      const notes = service.listNotifications(created[0]!.id)
      expect(notes.find((n) => n.channel === 'phone' && n.recipientName === '心外A')!.status).toBe('failed')
      expect(notes.find((n) => n.channel === 'sms' && n.recipientName === '心外B')!.status).toBe('failed')
    })
  })

  describe('通知状态流转', () => {
    it('sent → accepted, 触发记录同步 confirmed', async () => {
      const created = await service.judge({
        modality: 'CT', examType: '肺动脉CTA', items: [{ key: 'pe_index', value: 55 }],
        recipients: [{ name: '呼吸科医生', phone: '13800000001' }],
      })
      const note = service.listNotifications(created[0]!.id)[0]!
      const { notification, trigger } = service.confirmNotification(note.id, {
        decision: 'accepted',
        comment: '已电话确认',
        confirmedBy: '王医生',
      })
      expect(notification.status).toBe('accepted')
      expect(trigger.status).toBe('confirmed')
      expect(trigger.confirmedBy).toBe('王医生')
      expect(trigger.responseMinutes).toBeGreaterThanOrEqual(0)
    })

    it('sent → rejected, 触发记录同步 rejected 并保留备注', async () => {
      const created = await service.judge({
        modality: 'CT', examType: '腹部CT平扫', items: [{ key: 'small_bowel_diameter', value: 45 }],
        recipients: [{ name: '普外科医生', phone: '13800000001' }],
      })
      const note = service.listNotifications(created[0]!.id)[0]!
      const { notification, trigger } = service.confirmNotification(note.id, {
        decision: 'rejected',
        comment: '临床复核为假阳性',
      })
      expect(notification.status).toBe('rejected')
      expect(trigger.status).toBe('rejected')
      expect(trigger.confirmComment).toBe('临床复核为假阳性')
    })

    it('重复确认 → BadRequestException', async () => {
      const created = await service.judge({
        modality: 'CT', examType: '肺动脉CTA', items: [{ key: 'pe_index', value: 55 }],
        recipients: [{ name: '呼吸科医生', phone: '13800000001' }],
      })
      const note = service.listNotifications(created[0]!.id)[0]!
      service.confirmNotification(note.id, { decision: 'accepted' })
      expect(() => service.confirmNotification(note.id, { decision: 'accepted' })).toThrow(BadRequestException)
    })

    it('failed 通知不可确认 → BadRequestException', async () => {
      const created = await service.judge({
        modality: 'CT', examType: '主动脉CTA', items: [{ key: 'aorta_diameter', value: 55 }],
        recipients: [{ name: '心外A', phone: '13800000009', channels: ['phone'] }],
      })
      const note = service.listNotifications(created[0]!.id).find((n) => n.channel === 'phone')!
      expect(note.status).toBe('failed')
      expect(() => service.confirmNotification(note.id, { decision: 'accepted' })).toThrow(BadRequestException)
    })

    it('未知通知 id → NotFoundException', () => {
      expect(() => service.confirmNotification('unknown', { decision: 'accepted' })).toThrow(NotFoundException)
    })

    it('listNotifications 支持按 triggerId 过滤', async () => {
      const all = service.listNotifications()
      expect(all.length).toBeGreaterThan(0)
      const first = all[0]!
      const filtered = service.listNotifications(first.triggerId)
      expect(filtered.every((n) => n.triggerId === first.triggerId)).toBe(true)
    })
  })

  describe('统计', () => {
    it('统计字段齐全且数值合法', () => {
      const s = service.stats()
      expect(s.totalTriggers).toBeGreaterThanOrEqual(5)
      expect(typeof s.triggerRate).toBe('number')
      expect(s.triggerRate).toBeGreaterThanOrEqual(0)
      expect(typeof s.onTimeConfirmRate).toBe('number')
      expect(typeof s.timeoutCount).toBe('number')
      expect(typeof s.timeoutRate).toBe('number')
      expect(typeof s.confirmedCount).toBe('number')
      expect(typeof s.rejectedCount).toBe('number')
      expect(typeof s.avgResponseMinutes).toBe('number')
      expect(Array.isArray(s.byLevel)).toBe(true)
      expect(s.byLevel.length).toBe(3)
      expect(Array.isArray(s.topRules)).toBe(true)
      expect(s.topRules[0]!.count).toBeGreaterThanOrEqual(s.topRules[1]!.count)
    })

    it('judge 后 totalTriggers 增加, 触发率上升', async () => {
      const before = service.stats().totalTriggers
      await service.judge({ modality: 'CT', examType: '头颅CT平扫', items: [{ key: 'ct_value_hu', value: 85 }] })
      const after = service.stats()
      expect(after.totalTriggers).toBe(before + 1)
      const rule = service.listRules().find((r) => r.id === 'cvr-001')!
      expect(after.topRules.find((t) => t.ruleId === 'cvr-001')!.count).toBeGreaterThanOrEqual(1)
      expect(rule.responseDeadlineMin).toBe(10)
    })
  })
})

describe('CriticalV2Controller (端点 → 200)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CriticalV2Controller],
      providers: [{ provide: CriticalV2Service, useValue: new CriticalV2Service(makePrisma()) }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /critical-v2/rules → 200', async () => {
    const res = await request(app.getHttpServer()).get('/critical-v2/rules').expect(200)
    expect(res.body.length).toBeGreaterThanOrEqual(20)
  })

  it('GET /critical-v2/stats → 200 (统计)', async () => {
    const res = await request(app.getHttpServer()).get('/critical-v2/stats').expect(200)
    expect(res.body.totalTriggers).toBeGreaterThanOrEqual(5)
    expect(typeof res.body.onTimeConfirmRate).toBe('number')
    expect(typeof res.body.timeoutRate).toBe('number')
  })

  it('POST /critical-v2/evaluate → 200 (自动判定, 阈值边界)', async () => {
    const hit = await request(app.getHttpServer())
      .post('/critical-v2/evaluate')
      .send({ modality: 'CT', examType: '头颅CT平扫', items: [{ key: 'ct_value_hu', value: 82 }] })
      .expect(200)
    expect(hit.body.triggers.some((t: { ruleCode: string }) => t.ruleCode === 'CV-R-001')).toBe(true)
    const miss = await request(app.getHttpServer())
      .post('/critical-v2/evaluate')
      .send({ modality: 'CT', examType: '头颅CT平扫', items: [{ key: 'ct_value_hu', value: 70 }] })
      .expect(200)
    expect(miss.body.triggers.some((t: { ruleCode: string }) => t.ruleCode === 'CV-R-001')).toBe(false)
  })

  it('POST /critical-v2/judge → 200 且生成通知; confirm → 200 状态流转', async () => {
    const created = await request(app.getHttpServer())
      .post('/critical-v2/judge')
      .send({
        patientName: '接口测试患者',
        modality: 'CT', examType: '肺动脉CTA',
        items: [{ key: 'pe_index', value: 55 }],
        recipients: [{ name: '呼吸科医生', phone: '13800000001' }],
      })
      .expect(200)
    expect(created.body.length).toBe(1)
    const triggerId = created.body[0]!.id
    const notes = await request(app.getHttpServer()).get(`/critical-v2/notifications?triggerId=${triggerId}`).expect(200)
    expect(notes.body.length).toBe(3)
    const confirm = await request(app.getHttpServer())
      .post(`/critical-v2/notifications/${notes.body[0]!.id}/confirm`)
      .send({ decision: 'accepted', comment: '接口确认', confirmedBy: '测试员' })
      .expect(200)
    expect(confirm.body.notification.status).toBe('accepted')
    expect(confirm.body.trigger.status).toBe('confirmed')
  })

  it('非法确认决策 → 400 (zod)', async () => {
    const notes = await request(app.getHttpServer()).get('/critical-v2/notifications').expect(200)
    await request(app.getHttpServer())
      .post(`/critical-v2/notifications/${notes.body[0]!.id}/confirm`)
      .send({ decision: 'maybe' })
      .expect(400)
  })

  it('POST /critical-v2/rules → 200, PATCH 启停 → 200', async () => {
    const created = await request(app.getHttpServer())
      .post('/critical-v2/rules')
      .send({
        name: '测试规则', category: '测试', modality: 'CT', examType: '测试检查',
        itemKey: 'test_key', item: '测试项目', operator: '>', threshold: 10,
        level: 'warning', description: '测试', suggestion: '测试', responseDeadlineMin: 30,
      })
      .expect(200)
    expect(created.body.id).toBeTruthy()
    const updated = await request(app.getHttpServer())
      .patch(`/critical-v2/rules/${created.body.id}`)
      .send({ enabled: false })
      .expect(200)
    expect(updated.body.enabled).toBe(false)
  })
})

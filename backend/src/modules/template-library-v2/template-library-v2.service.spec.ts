/**
 * G005 v3.0.6.11-101 - 模板库 V2 spec (Wave 7B, F13)
 *
 * - 搜索匹配 (关键词/标签/模态/科室/用途)
 * - 推荐排序确定性 (同参数多次调用结果一致 + 匹配加分生效)
 * - 使用统计递增 (usageCount/lastUsedAt/采纳率)
 * - 复制 / 导入导出 (JSON 序列化往返)
 * - 端点全部 200 (supertest)
 */
import { Test } from '@nestjs/testing'
import { INestApplication, NotFoundException, BadRequestException } from '@nestjs/common'
import request from 'supertest'
import { TemplateLibraryV2Controller } from './template-library-v2.controller'
import { TemplateLibraryV2Service } from './template-library-v2.service'

const makePrisma = () =>
  ({
    auditLog: { create: jest.fn().mockRejectedValue(new Error('no db')) },
  }) as never

describe('TemplateLibraryV2Service (Wave 7B 模板库 V2)', () => {
  let service: TemplateLibraryV2Service

  beforeEach(() => {
    service = new TemplateLibraryV2Service(makePrisma())
  })

  describe('分类树 / Seed', () => {
    it('内置 30+ 放射模板', () => {
      const list = service.listTemplates()
      expect(list.length).toBeGreaterThanOrEqual(30)
    })

    it('分类树包含 检查类型/科室/用途 三轴', () => {
      const tree = service.getCategoryTree()
      const types = tree.map((n) => n.nodeType)
      expect(types).toEqual(expect.arrayContaining(['modality', 'dept', 'purpose']))
      const modality = tree.find((n) => n.nodeType === 'modality')
      expect(modality?.children?.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe('搜索: 关键词/标签/类型匹配', () => {
    it('关键词命中名称/内容/标签', () => {
      const byName = service.search({ keyword: '头颅CT平扫' })
      expect(byName.items.length).toBeGreaterThanOrEqual(1)
      const byTag = service.search({ keyword: '危急' })
      expect(byTag.items.length).toBeGreaterThanOrEqual(3)
      const byContent = service.search({ keyword: '磨玻璃结节' })
      expect(byContent.items.some((t) => t.id === 'tpl-005')).toBe(true)
    })

    it('标签过滤: 任一匹配即命中', () => {
      const res = service.search({ tags: ['增强', '危急'] })
      expect(res.items.length).toBeGreaterThanOrEqual(4)
      expect(res.items.every((t) => t.tags.includes('增强') || t.tags.includes('危急'))).toBe(true)
    })

    it('类型过滤: 模态/科室/用途/部位', () => {
      const byModality = service.search({ modality: 'MR' })
      expect(byModality.items.every((t) => t.modality === 'MR')).toBe(true)
      const byDept = service.search({ dept: '乳腺影像组' })
      expect(byDept.items.every((t) => t.dept === '乳腺影像组')).toBe(true)
      const byPurpose = service.search({ purpose: 'URGENT' })
      expect(byPurpose.items.every((t) => t.purpose === 'URGENT')).toBe(true)
      const byBodyPart = service.search({ bodyPart: '乳腺' })
      expect(byBodyPart.items.length).toBeGreaterThanOrEqual(1)
    })

    it('分页与总数', () => {
      const all = service.search({})
      const page2 = service.search({ page: 2, pageSize: 10 })
      expect(page2.total).toBe(all.total)
      expect(page2.items.length).toBeGreaterThan(0)
      expect(all.total).toBeGreaterThanOrEqual(30)
    })
  })

  describe('推荐: 确定性评分', () => {
    it('同参数两次调用结果完全一致 (确定性)', () => {
      const a = service.recommend({ modality: 'CT', dept: '心胸影像组', limit: 8 })
      const b = service.recommend({ modality: 'CT', dept: '心胸影像组', limit: 8 })
      expect(a.map((r) => r.templateId)).toEqual(b.map((r) => r.templateId))
      expect(a.map((r) => r.score)).toEqual(b.map((r) => r.score))
    })

    it('模态匹配的模板排前且得分含匹配加分', () => {
      const res = service.recommend({ modality: 'MG', limit: 3 })
      expect(res[0]?.template.modality).toBe('MG')
      expect(res[0]?.score).toBeGreaterThanOrEqual(20)
    })

    it('按评分降序排列', () => {
      const res = service.recommend({ dept: '神经影像组', limit: 10 })
      for (let i = 1; i < res.length; i += 1) {
        expect(res[i - 1]!.score).toBeGreaterThanOrEqual(res[i]!.score)
      }
    })

    it('高频模板 (使用频率) 评分更高', () => {
      const res = service.recommend({ limit: 5 })
      const top = res[0]
      expect(top).toBeDefined()
      expect(top!.score).toBeGreaterThan(20)
      expect(res.every((r) => r.reason)).toBe(true)
    })
  })

  describe('使用统计: 递增 / 采纳率 / 最近使用', () => {
    it('recordUsage 递增 usageCount 并更新 lastUsedAt', () => {
      const before = service.templateUsageStats('tpl-001')
      const after = service.recordUsage('tpl-001', 'u-001')
      expect(after.usageCount).toBe(before.usageCount + 1)
      const stats = service.templateUsageStats('tpl-001')
      expect(stats.usageCount).toBe(before.usageCount + 1)
      expect(stats.recentUsedDays).toBe(0)
      expect(new Date(stats.lastUsedAt!).getTime()).toBeGreaterThanOrEqual(new Date(before.lastUsedAt!).getTime())
    })

    it('采纳率 = 使用次数/展示次数 (百分比)', () => {
      const stats = service.templateUsageStats('tpl-004')
      expect(stats.adoptionRate).toBeCloseTo((245 / 420) * 100, 0)
    })

    it('最近使用历史按时间倒序去重', () => {
      service.recordUsage('tpl-002', 'u-002')
      service.recordUsage('tpl-003', 'u-002')
      service.recordUsage('tpl-002', 'u-002')
      const history = service.listUsageHistory('u-002')
      expect(history[0]?.id).toBe('tpl-002')
      expect(history[1]?.id).toBe('tpl-003')
    })
  })

  describe('收藏管理', () => {
    it('切换收藏 / 列表', () => {
      const fav = service.toggleFavorite('tpl-005', 'u-003')
      expect(fav.favorite).toBe(true)
      const list = service.listFavorites('u-003')
      expect(list.map((t) => t.id)).toContain('tpl-005')
      const unfav = service.toggleFavorite('tpl-005', 'u-003')
      expect(unfav.favorite).toBe(false)
      expect(service.listFavorites('u-003').map((t) => t.id)).not.toContain('tpl-005')
    })
  })

  describe('复制 / 导入导出 (JSON 序列化)', () => {
    it('复制模板: 新 id + (副本) 后缀 + 来源记录', () => {
      const copy = service.copyTemplate('tpl-001', '测试用户')
      expect(copy.id).not.toBe('tpl-001')
      expect(copy.name).toContain('副本')
      expect(copy.sourceTemplateId).toBe('tpl-001')
      expect(copy.isSystem).toBe(false)
      expect(copy.usageCount).toBe(0)
    })

    it('导出 → 导入 往返内容一致', () => {
      const exported = service.exportTemplates(['tpl-001', 'tpl-002'])
      expect(exported.schemaVersion).toBe(1)
      expect(exported.templates.length).toBe(2)
      const result = service.importTemplates(JSON.stringify(exported), '测试用户')
      expect(result.imported).toBe(2)
      const imported = service.getTemplate(result.ids[0]!)
      expect(imported.name).toBe('头颅CT平扫模板')
      expect(imported.content).toContain('脑实质')
      expect(imported.isSystem).toBe(false)
      expect(imported.sourceTemplateId).toBe('tpl-001')
    })

    it('非法 JSON → BadRequestException', () => {
      expect(() => service.importTemplates('{bad json', 'x')).toThrow(BadRequestException)
    })

    it('空数组导入 → BadRequestException', () => {
      expect(() => service.importTemplates(JSON.stringify([]), 'x')).toThrow(BadRequestException)
    })
  })

  describe('统计 / 异常', () => {
    it('stats 汇总', () => {
      const s = service.stats()
      expect(s.total).toBeGreaterThanOrEqual(30)
      expect(s.systemCount).toBe(s.total)
      expect(s.totalUsage).toBeGreaterThan(0)
      expect(s.byModality.CT).toBeGreaterThan(0)
      expect(s.byDept['神经影像组']).toBeGreaterThan(0)
      expect(s.byPurpose.URGENT).toBeGreaterThanOrEqual(4)
    })

    it('未知模板 → NotFoundException', () => {
      expect(() => service.getTemplate('nope')).toThrow(NotFoundException)
      expect(() => service.recordUsage('nope')).toThrow(NotFoundException)
      expect(() => service.toggleFavorite('nope')).toThrow(NotFoundException)
    })
  })
})

describe('TemplateLibraryV2Controller (端点 → 200)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TemplateLibraryV2Controller],
      providers: [{ provide: TemplateLibraryV2Service, useValue: new TemplateLibraryV2Service(makePrisma()) }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /template-library-v2/categories → 200', async () => {
    const res = await request(app.getHttpServer()).get('/template-library-v2/categories').expect(200)
    expect(res.body.length).toBe(3)
  })

  it('GET /template-library-v2/templates → 200 (30+)', async () => {
    const res = await request(app.getHttpServer()).get('/template-library-v2/templates').expect(200)
    expect(res.body.length).toBeGreaterThanOrEqual(30)
  })

  it('GET /template-library-v2/search → 200 (关键词/标签/类型)', async () => {
    const res = await request(app.getHttpServer()).get('/template-library-v2/search?keyword=危急').expect(200)
    expect(res.body.total).toBeGreaterThanOrEqual(3)
    const res2 = await request(app.getHttpServer()).get('/template-library-v2/search?modality=MG&keyword=BI-RADS').expect(200)
    expect(res2.body.items.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /template-library-v2/recommend → 200 (确定性排序)', async () => {
    const res = await request(app.getHttpServer()).get('/template-library-v2/recommend?modality=CT&dept=心胸影像组&limit=5').expect(200)
    expect(res.body.length).toBe(5)
    expect(res.body[0].template.modality).toBe('CT')
    const res2 = await request(app.getHttpServer()).get('/template-library-v2/recommend?modality=CT&dept=心胸影像组&limit=5').expect(200)
    expect(res.body.map((r: { templateId: string }) => r.templateId)).toEqual(res2.body.map((r: { templateId: string }) => r.templateId))
  })

  it('GET /template-library-v2/stats → 200', async () => {
    const res = await request(app.getHttpServer()).get('/template-library-v2/stats').expect(200)
    expect(res.body.total).toBeGreaterThanOrEqual(30)
  })

  it('POST 使用统计 → 200 (递增)', async () => {
    const before = await request(app.getHttpServer()).get('/template-library-v2/templates/tpl-001/stats').expect(200)
    const used = await request(app.getHttpServer()).post('/template-library-v2/templates/tpl-001/use').send({ usedBy: 'u-001' }).expect(200)
    expect(used.body.usageCount).toBe(before.body.usageCount + 1)
    const after = await request(app.getHttpServer()).get('/template-library-v2/templates/tpl-001/stats').expect(200)
    expect(after.body.usageCount).toBe(before.body.usageCount + 1)
  })

  it('POST 收藏 / GET favorites → 200', async () => {
    const fav = await request(app.getHttpServer()).post('/template-library-v2/templates/tpl-002/favorite').send({ userId: 'u-001' }).expect(200)
    expect(typeof fav.body.favorite).toBe('boolean')
    const list = await request(app.getHttpServer()).get('/template-library-v2/favorites?userId=u-001').expect(200)
    expect(Array.isArray(list.body)).toBe(true)
  })

  it('POST 复制 / 新建 / 导出 / 导入 → 200', async () => {
    const copy = await request(app.getHttpServer()).post('/template-library-v2/templates/tpl-003/copy').send({ copiedBy: '张伟' }).expect(200)
    expect(copy.body.id).not.toBe('tpl-003')

    const created = await request(app.getHttpServer())
      .post('/template-library-v2/templates')
      .send({ name: '接口测试模板', modality: 'CT', dept: '放射科', content: '接口测试内容' })
      .expect(200)
    expect(created.body.id).toBeDefined()

    const exported = await request(app.getHttpServer()).get(`/template-library-v2/templates/${created.body.id}/export`).expect(200)
    expect(exported.body.templates.length).toBe(1)

    const imported = await request(app.getHttpServer())
      .post('/template-library-v2/import?importedBy=张伟')
      .send({ json: JSON.stringify(exported.body) })
      .expect(200)
    expect(imported.body.imported).toBe(1)
  })

  it('未知模板 → 404', async () => {
    await request(app.getHttpServer()).get('/template-library-v2/templates/nope').expect(404)
  })
})

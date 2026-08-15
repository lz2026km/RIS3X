/**
 * [v3.0.6.11-100 Wave2C (报告工作站 P2)] 模板类型 (FULL/SECTION/PHRASE) spec
 * - list 按 templateType 过滤 (全文模板独立分类)
 * - create/update/clone 保留 templateType, 缺失时默认 SECTION
 * - 内存兼容: 旧数据 (无字段) 回退 SECTION
 */
import { TemplatesService } from '../src/templates/templates.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    reportTemplate: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

describe('TemplatesService templateType (FULL/SECTION/PHRASE)', () => {
  it('list passes templateType filter to prisma where clause', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 't1', name: '胸部CT全文模板', category: 'CT', bodyPart: '胸部', body: 'x', templateType: 'FULL' },
    ])
    const service = new TemplatesService(makePrisma({ reportTemplate: { findMany } }))
    const res = await service.list({ templateType: 'FULL' as any })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ templateType: 'FULL' }) }))
    expect(res[0]?.templateType).toBe('FULL')
  })

  it('list without templateType filter does not add the field', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const service = new TemplatesService(makePrisma({ reportTemplate: { findMany } }))
    await service.list({})
    const where = (findMany as jest.Mock).mock.calls[0][0].where
    expect(where.templateType).toBeUndefined()
  })

  it('create defaults templateType to SECTION when omitted (旧数据内存兼容)', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't-new', ...data }))
    const service = new TemplatesService(makePrisma({ reportTemplate: { create } }))
    const res = await service.create({
      name: '无类型模板',
      category: 'CT',
      bodyPart: '胸部',
      body: '双肺纹理清晰',
      createdById: 'u-1',
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ templateType: 'SECTION' }) }))
    expect(res.templateType).toBe('SECTION')
  })

  it('create keeps FULL templateType and returns it (全文模板)', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't-full', ...data }))
    const service = new TemplatesService(makePrisma({ reportTemplate: { create } }))
    const res = await service.create({
      name: '胸部CT全文模板',
      category: 'CT',
      modality: 'CT',
      bodyPart: '胸部',
      templateType: 'FULL' as any,
      body: '影像所见：…\n诊断意见：…',
      createdById: 'u-1',
    })
    expect(res.templateType).toBe('FULL')
  })

  it('update persists PHRASE type and rejects invalid type by normalizing to SECTION', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 't-ph', body: 'old', templateType: 'SECTION' })
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't-ph', ...data }))
    const service = new TemplatesService(makePrisma({ reportTemplate: { findUnique, update } }))
    const res = await service.update('t-ph', { templateType: 'PHRASE' as any })
    expect(res.templateType).toBe('PHRASE')
    await service.update('t-ph', { templateType: 'BOGUS' as any })
    const callData = (update as jest.Mock).mock.calls[1][0].data
    expect(callData.templateType).toBe('SECTION')
  })

  it('clone preserves templateType of the original template', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 't-src', name: '乳腺全文模板', category: 'MG', modality: 'MG', bodyPart: '乳腺',
      body: 'x', templateType: 'FULL', structure: null, parentId: null, radsCategory: null,
      tags: [], createdById: 'u-1', status: 'approved', version: 2,
    })
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't-clone', ...data }))
    const service = new TemplatesService(makePrisma({ reportTemplate: { findUnique, create } }))
    await service.clone('t-src')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ templateType: 'FULL' }) }))
  })
})

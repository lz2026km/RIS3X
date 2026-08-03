import { NotFoundException } from '@nestjs/common'
import { AiMarketplaceService } from '../src/modules/ai-marketplace/ai-marketplace.service'

describe('AiMarketplaceService', () => {
  let svc: AiMarketplaceService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      aiModel: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
    }
    svc = new AiMarketplaceService(mockPrisma)
  })

  it('list seeds defaults when DB empty', async () => {
    mockPrisma.aiModel.findMany.mockResolvedValue([])
    const models = await svc.list()
    expect(models).toHaveLength(5)
    expect(mockPrisma.aiModel.createMany).toHaveBeenCalled()
    expect(models[0].name).toBe('肺结节检测')
  })

  it('list maps DB rows to DTO', async () => {
    mockPrisma.aiModel.findMany.mockResolvedValue([
      { id: 'm1', name: '模型1', version: '1.0', vendor: null, category: 'CT', status: 'weird', deployedAt: new Date('2026-01-01'), config: { description: 'd', accuracy: 0.9 } },
    ])
    const models = await svc.list()
    expect(models[0]).toMatchObject({ id: 'm1', modality: 'CT', status: 'running', accuracy: 0.9 })
  })

  it('list falls back to defaults when DB fails', async () => {
    mockPrisma.aiModel.findMany.mockRejectedValue(new Error('db down'))
    const models = await svc.list()
    expect(models).toHaveLength(5)
  })

  it('deploy creates model via DB or memory fallback', async () => {
    mockPrisma.aiModel.create.mockResolvedValue({ id: 'm1' })
    const m = await svc.deploy('新模型', '1.0', 'MR', '描述')
    expect(m.status).toBe('running')
    expect(m.id).toMatch(/^md-/)
    mockPrisma.aiModel.create.mockRejectedValue(new Error('db down'))
    const m2 = await svc.deploy('离线模型', '2.0', 'DX', 'd')
    const list = await svc.list()
    expect(list.some((x) => x.name === '离线模型')).toBe(true)
  })

  it('remove deletes model via DB', async () => {
    mockPrisma.aiModel.deleteMany.mockResolvedValue({ count: 1 })
    await expect(svc.remove('md-001')).resolves.toBeUndefined()
    mockPrisma.aiModel.deleteMany.mockResolvedValue({ count: 0 })
    await expect(svc.remove('md-001')).rejects.toThrow(NotFoundException)
  })

  it('remove falls back to memory list', async () => {
    mockPrisma.aiModel.deleteMany.mockRejectedValue(new Error('db down'))
    await expect(svc.remove('md-001')).resolves.toBeUndefined()
    await expect(svc.remove('md-999')).rejects.toThrow(NotFoundException)
  })

  it('getStatus returns DB row or memory model', async () => {
    mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'md-001', name: 'x', version: '1', vendor: null, category: 'CT', status: 'running', deployedAt: new Date(), config: {} })
    await expect(svc.getStatus('md-001')).resolves.toMatchObject({ id: 'md-001' })
    mockPrisma.aiModel.findUnique.mockRejectedValue(new Error('db down'))
    await expect(svc.getStatus('md-002')).resolves.toMatchObject({ id: 'md-002' })
    await expect(svc.getStatus('ghost')).rejects.toThrow(NotFoundException)
  })
})

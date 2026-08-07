/**
 * G005 RIS v3.0.6.11-79 - ReportsService 分页消费者 spec
 * 断言 admin config default_page_size 决定未传 take 时的默认分页大小
 */
import { ReportsService } from './reports.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  report: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
  reportRevision: { create: jest.fn().mockResolvedValue({}) },
  ...overrides,
})

const makeQueue = () => ({ addReportExport: jest.fn().mockResolvedValue({}) }) as never

const makeSystemConfig = (values: Record<string, unknown> = {}) => ({
  getNumber: jest.fn(async (key: string, fallback: number) => {
    const v = values[key] ?? (key === 'default_page_size' ? 20 : undefined)
    return typeof v === 'number' ? v : fallback
  }),
  getString: jest.fn(async (_key: string, fb: string) => fb),
  get: jest.fn(),
  invalidate: jest.fn(),
}) as never

const makeService = (values: Record<string, unknown> = {}) =>
  new ReportsService(makePrisma() as never, makeQueue(), makeSystemConfig(values))

describe('ReportsService.list (default_page_size 消费者)', () => {
  it('uses admin config default_page_size when take is not provided', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const prisma = makePrisma({ report: { findMany, count } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({ default_page_size: 50 }))

    await service.list({})

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it('falls back to 20 when config is not stored', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const prisma = makePrisma({ report: { findMany, count } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({}))

    await service.list({})

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }))
  })

  it('keeps explicit take param as-is', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const count = jest.fn().mockResolvedValue(0)
    const prisma = makePrisma({ report: { findMany, count } })
    const service = new ReportsService(prisma as never, makeQueue(), makeSystemConfig({ default_page_size: 50 }))

    await service.list({ take: 8 })

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 8 }))
  })
})

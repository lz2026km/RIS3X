import { Test } from '@nestjs/testing'
import { CacheService } from '../src/cache/cache.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'

describe('CacheService', () => {
  let svc: CacheService
  let mockCache: any

  beforeAll(async () => {
    mockCache = { get: jest.fn(), set: jest.fn(), reset: jest.fn() }
    const module = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile()
    svc = module.get(CacheService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('get calls cache.get', async () => {
    mockCache.get.mockResolvedValue('value')
    const result = await svc.get('key')
    expect(result).toBe('value')
  })

  it('set calls cache.set with default TTL', async () => {
    await svc.set('key', 'value')
    expect(mockCache.set).toHaveBeenCalledWith('key', 'value', 300)
  })

  it('reset calls cache.reset', async () => {
    await svc.reset()
    expect(mockCache.reset).toHaveBeenCalled()
  })
})

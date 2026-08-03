import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { TenantService } from './tenant.service'
import { tenantStorage } from '../../common/interceptors/tenant-context.interceptor'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  const base = {
    tenant: {
      findUnique: reject,
      findMany: reject,
      create: reject,
      update: reject,
    },
    user: { count: reject },
    patient: { count: reject },
    exam: { count: reject },
    report: { count: reject },
    dicomInstance: { aggregate: reject },
    vnaObject: { aggregate: reject },
  }
  return { ...base, ...overrides } as never
}

const withTenant = async <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
  tenantStorage.run({ tenantId, enforce: false }, () => fn())

describe('TenantService', () => {
  let service: TenantService

  beforeEach(() => {
    service = new TenantService(makePrisma())
  })

  describe('memory fallback (DB unavailable)', () => {
    it('getCurrent returns default tenant', async () => {
      const info = await service.getCurrent()
      expect(info.id).toBe('default')
      expect(info.status).toBe('ACTIVE')
      expect(info.name).toBeTruthy()
    })

    it('getCurrent resolves unknown tenant to default record', async () => {
      const info = await withTenant('tenant-x', () => service.getCurrent())
      expect(info.id).toBe('tenant-x')
      expect(info.name).toBe('主租户（默认）')
    })

    it('getFeatures returns all 8 feature switches with defaults', async () => {
      const features = await service.getFeatures()
      expect(Object.keys(features)).toHaveLength(8)
      expect(features.aiOrchestration).toBe(true)
      expect(features.environmentReport).toBe(true)
    })

    it('updateFeatures toggles switches and persists', async () => {
      const updated = await service.updateFeatures({ vna: false, biDashboard: false })
      expect(updated.vna).toBe(false)
      expect(updated.biDashboard).toBe(false)
      const features = await service.getFeatures()
      expect(features.vna).toBe(false)
      expect(features.aiOrchestration).toBe(true)
      await service.updateFeatures({ vna: true, biDashboard: true })
    })

    it('updateProfile updates name and quota', async () => {
      const updated = await service.updateProfile({ name: '测试医院放射科', maxUsers: 300 })
      expect(updated.name).toBe('测试医院放射科')
      expect(updated.maxUsers).toBe(300)
      await service.updateProfile({ name: '主租户（默认）', maxUsers: 200 })
    })

    it('getUsage returns seed usage when DB unavailable', async () => {
      const usage = await service.getUsage()
      expect(usage.users).toBeGreaterThan(0)
      expect(usage.exams).toBeGreaterThan(0)
      expect(usage.storageLimitBytes).toBeGreaterThan(0)
    })

    it('listAll returns seeded tenants', async () => {
      const list = await service.listAll()
      expect(list.length).toBeGreaterThanOrEqual(3)
      const demoB = list.find((t) => t.code === 'demo-b')
      expect(demoB?.status).toBe('DISABLED')
    })
  })

  describe('admin platform operations', () => {
    it('create validates code format', async () => {
      await expect(service.create({ code: 'bad code!', name: 'x' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.create({ code: '', name: 'x' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.create({ code: 'ok-code', name: '' })).rejects.toBeInstanceOf(BadRequestException)
    })

    it('create tenant with memory fallback then rejects duplicate code', async () => {
      const created = await service.create({ code: 'spec-tenant', name: 'Spec 租户', maxUsers: 10 })
      expect(created.code).toBe('spec-tenant')
      expect(created.status).toBe('ACTIVE')
      expect(created.features.mobileApp).toBe(true)
      await expect(service.create({ code: 'spec-tenant', name: 'dup' })).rejects.toBeInstanceOf(ConflictException)
    })

    it('setStatus toggles and validates', async () => {
      const created = await service.create({ code: 'status-tenant', name: 'Status 租户' })
      const disabled = await service.setStatus(created.id, 'DISABLED')
      expect(disabled.status).toBe('DISABLED')
      const enabled = await service.setStatus(created.id, 'ACTIVE')
      expect(enabled.status).toBe('ACTIVE')
      await expect(service.setStatus(created.id, 'PAUSED' as never)).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.setStatus('no-such-id', 'ACTIVE')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})

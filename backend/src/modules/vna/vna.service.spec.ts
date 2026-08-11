import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { VnaService } from './vna.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    vnaObject: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      aggregate: jest.fn().mockRejectedValue(new Error('no db')),
    },
    dicomInstance: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

describe('VnaService', () => {
  describe('memory fallback (DB unavailable)', () => {
    let service: VnaService

    beforeEach(() => {
      service = new VnaService(makePrisma())
    })

    it('createObject persists to memory and listObjects returns it with source=memory', async () => {
      const created = await service.createObject({
        patientId: 'P001',
        objectType: 'document',
        name: '知情同意书.pdf',
        description: '增强扫描知情同意',
        mimeType: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('PDF-BYTES'),
      })
      expect(created.wormLocked).toBe(false)
      expect(created.storageSource).toBe('memory')
      expect(created.mimeType).toBe('application/pdf')
      const list = await service.listObjects({ patientId: 'P001' })
      expect(list).toHaveLength(1)
      expect(list[0]?.id).toBe(created.id)
      expect(list[0]?.storageSource).toBe('memory')
    })

    it('wormLock is irreversible and delete of locked object throws ForbiddenException', async () => {
      const created = await service.createObject({
        patientId: 'P002',
        objectType: 'image',
        name: 'CT-001.png',
        mimeType: 'image/png',
        buffer: Buffer.from('PNG'),
      })
      const locked = await service.wormLock(created.id)
      expect(locked.wormLocked).toBe(true)
      await expect(service.deleteObject(created.id)).rejects.toBeInstanceOf(ForbiddenException)
      // 幂等: 再次锁定不报错
      const again = await service.wormLock(created.id)
      expect(again.wormLocked).toBe(true)
    })

    it('deleteObject removes non-locked object', async () => {
      const created = await service.createObject({ name: 'tmp.txt', mimeType: 'text/plain', size: 3 })
      await service.deleteObject(created.id)
      await expect(service.getObject(created.id)).rejects.toBeInstanceOf(NotFoundException)
      const list = await service.listObjects({ search: 'tmp' })
      expect(list).toHaveLength(0)
    })

    it('listObjects filters by type and search keyword', async () => {
      await service.createObject({ patientId: 'P003', objectType: 'document', name: '报告单.pdf', mimeType: 'application/pdf', size: 100 })
      await service.createObject({ patientId: 'P003', objectType: 'image', name: '胸片.png', mimeType: 'image/png', size: 200 })
      await service.createObject({ patientId: 'P004', objectType: 'document', name: '检验单.txt', mimeType: 'text/plain', size: 50 })
      const docs = await service.listObjects({ type: 'document' })
      expect(docs).toHaveLength(2)
      const imgs = await service.listObjects({ type: 'image' })
      expect(imgs).toHaveLength(1)
      const search = await service.listObjects({ search: '胸片' })
      expect(search).toHaveLength(1)
      expect(search[0]?.name).toBe('胸片.png')
      const byPatient = await service.listObjects({ patientId: 'P003' })
      expect(byPatient).toHaveLength(2)
    })

    it('getStats aggregates memory objects incl. wormLocked count', async () => {
      await service.createObject({ objectType: 'document', name: 'a.pdf', mimeType: 'application/pdf', size: 100 })
      const img = await service.createObject({ objectType: 'image', name: 'b.png', mimeType: 'image/png', size: 300 })
      await service.wormLock(img.id)
      const stats = await service.getStats()
      expect(stats.storageSource).toBe('memory')
      expect(stats.totalObjects).toBe(2)
      expect(stats.totalSizeBytes).toBe(400)
      expect(stats.nonDicomCount).toBe(2)
      expect(stats.wormLockedCount).toBe(1)
      expect(stats.studyCount).toBe(0)
    })

    it('patient archive view combines studies grouped by studyUid + objects', async () => {
      await service.createObject({ patientId: 'P005', studyUid: '1.2.840.10008.1', name: 's1.txt', mimeType: 'text/plain', size: 10 })
      await service.createObject({ patientId: 'P005', studyUid: '1.2.840.10008.1', name: 's2.txt', mimeType: 'text/plain', size: 20 })
      await service.createObject({ patientId: 'P005', studyUid: '1.2.840.10008.2', name: 's3.txt', mimeType: 'text/plain', size: 30 })
      const archive = await service.getPatientArchive('P005')
      expect(archive.objects).toHaveLength(3)
      expect(archive.studies).toHaveLength(2)
      expect(archive.totalSizeBytes).toBe(60)
    })
  })

  describe('database persistence (Prisma works)', () => {
    let service: VnaService
    const row = {
      id: 'vna-db-1',
      tenantId: 'default',
      patientId: 'P010',
      studyUid: null,
      objectType: 'document',
      name: 'db-doc.pdf',
      description: 'from db',
      mimeType: 'application/pdf',
      size: 512,
      storagePath: null,
      wormLocked: false,
      createdAt: new Date(),
    }

    beforeEach(() => {
      const dbRow = { ...row }
      const prisma = makePrisma({
        vnaObject: {
          findMany: jest.fn().mockResolvedValue([dbRow]),
          findFirst: jest.fn().mockImplementation(async () => ({ ...dbRow })),
          findUnique: jest.fn().mockImplementation(async () => ({ ...dbRow })),
          create: jest.fn().mockResolvedValue({ ...row, id: 'vna-db-2' }),
          update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
            Object.assign(dbRow, args.data)
            return { ...dbRow }
          }),
          delete: jest.fn().mockResolvedValue(dbRow),
          count: jest.fn().mockResolvedValue(7),
          aggregate: jest.fn().mockResolvedValue({ _sum: { size: 4096 } }),
        },
        dicomInstance: {
          findMany: jest.fn().mockResolvedValue([
            { studyInstanceUid: '1.2.840.1', seriesInstanceUid: '1.2.840.1.1', sopInstanceUid: '1.2.840.1.1.1', modality: 'CT', createdAt: new Date() },
            { studyInstanceUid: '1.2.840.1', seriesInstanceUid: '1.2.840.1.1', sopInstanceUid: '1.2.840.1.1.2', modality: 'CT', createdAt: new Date() },
            { studyInstanceUid: '1.2.840.2', seriesInstanceUid: '1.2.840.2.1', sopInstanceUid: '1.2.840.2.1.1', modality: 'MR', createdAt: new Date() },
          ]),
          count: jest.fn().mockResolvedValue(3),
        },
      })
      service = new VnaService(prisma)
    })

    it('listObjects returns database rows with source=database', async () => {
      const list = await service.listObjects()
      expect(list).toHaveLength(1)
      expect(list[0]?.storageSource).toBe('database')
      expect(list[0]?.name).toBe('db-doc.pdf')
    })

    it('wormLock updates row via prisma and delete of locked row throws ForbiddenException', async () => {
      const locked = await service.wormLock('vna-db-1')
      expect(locked.wormLocked).toBe(true)
      await expect(service.deleteObject('vna-db-1')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('getStats aggregates dicomInstance count + vnaObject counts', async () => {
      const stats = await service.getStats()
      expect(stats.storageSource).toBe('database')
      expect(stats.totalObjects).toBe(7)
      expect(stats.dicomCount).toBe(3)
      expect(stats.totalSizeBytes).toBe(4096)
      expect(stats.studyCount).toBe(2)
    })

    it('listStudies aggregates dicomInstance grouped by studyUid', async () => {
      const studies = await service.listStudies()
      expect(studies).toHaveLength(2)
      const ct = studies.find((s) => s.studyUid === '1.2.840.1')
      expect(ct?.instanceCount).toBe(2)
      expect(ct?.seriesCount).toBe(1)
      expect(ct?.modality).toBe('CT')
      expect(ct?.storageSource).toBe('database')
    })
  })

  describe('G-26 lifecycle (ILM tiered storage, memory + seed)', () => {
    let service: VnaService

    beforeEach(() => {
      service = new VnaService(makePrisma())
    })

    it('seeds hot/warm/cold policies with retention days', () => {
      const policies = service.listLifecyclePolicies()
      expect(policies.map((p) => p.tier).sort()).toEqual(['cold', 'hot', 'warm'])
      const hot = policies.find((p) => p.tier === 'hot')
      expect(hot?.retentionDays).toBe(0)
      expect(hot?.storageSource).toBe('memory')
    })

    it('create/update/delete lifecycle policy (CRUD)', () => {
      const created = service.createLifecyclePolicy({ tier: 'cold', retentionDays: 730, description: '研究数据冷归档' })
      expect(created.id).toMatch(/^lp-/)
      expect(created.objectCount).toBeGreaterThanOrEqual(0)
      const updated = service.updateLifecyclePolicy(created.id, { retentionDays: 1095 })
      expect(updated.retentionDays).toBe(1095)
      expect(service.deleteLifecyclePolicy(created.id)).toEqual({ deleted: true })
      expect(() => service.updateLifecyclePolicy(created.id, { retentionDays: 1 })).toThrow(NotFoundException)
      expect(() => service.createLifecyclePolicy({ tier: 'hot', retentionDays: -1 })).toThrow(BadRequestException)
    })

    it('migrateObject moves tier and records event; unknown object throws', async () => {
      const created = await service.createObject({ name: 'ilm.txt', mimeType: 'text/plain', size: 10 })
      expect(created.tier).toBe('hot')
      const result = await service.migrateObject(created.id, 'cold', '长期保存')
      expect(result.object.tier).toBe('cold')
      expect(result.event.action).toBe('migrate')
      expect(result.event.fromTier).toBe('hot')
      expect(result.event.toTier).toBe('cold')
      const events = service.listLifecycleEvents()
      expect(events[0]?.objectId).toBe(created.id)
      // 幂等: 同层迁移不改变 tier
      const same = await service.migrateObject(created.id, 'cold')
      expect(same.event.fromTier).toBe('cold')
      await expect(service.migrateObject('vna-missing', 'cold')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('objectCount per tier reflects migrations; invalid tier rejected', async () => {
      const a = await service.createObject({ name: 'a.txt', mimeType: 'text/plain', size: 1 })
      await service.createObject({ name: 'b.txt', mimeType: 'text/plain', size: 1 })
      await service.migrateObject(a.id, 'warm')
      const policies = service.listLifecyclePolicies()
      const warm = policies.find((p) => p.tier === 'warm')
      expect(warm?.objectCount).toBeGreaterThanOrEqual(1)
      await expect(service.migrateObject(a.id, 'archive' as never)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('lifecycle events seeded + limit applied', () => {
      const events = service.listLifecycleEvents(2)
      expect(events).toHaveLength(2)
      expect(events[0]?.storageSource).toBe('memory')
      expect(['migrate', 'expire', 'policy-applied']).toContain(events[0]?.action)
    })
  })
})

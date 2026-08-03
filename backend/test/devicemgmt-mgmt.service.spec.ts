import { Test } from '@nestjs/testing'
import { DeviceMgmtService } from '../src/devicemgmt/devicemgmt.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('DeviceMgmtService', () => {
  let svc: DeviceMgmtService
  let prisma: any

  const row = { id: 'x1', createdAt: new Date(), updatedAt: new Date() }

  const mockPrisma = {
    device: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    auditLog: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    adverseEvent: { findMany: jest.fn(), create: jest.fn() },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [DeviceMgmtService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(DeviceMgmtService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('lists and gets equipment lifecycle', async () => {
    mockPrisma.device.findMany.mockResolvedValue([row])
    const listed = await svc.listEquipmentLifecycle()
    expect(listed.data).toHaveLength(1)

    mockPrisma.device.findUnique.mockResolvedValue(row)
    const found = await svc.getEquipmentLifecycle('x1')
    expect(found.data).toHaveLength(1)

    mockPrisma.device.findUnique.mockResolvedValue(null)
    const missing = await svc.getEquipmentLifecycle('nope')
    expect(missing.data).toEqual([])
  })

  it('updates equipment lifecycle', async () => {
    mockPrisma.device.update.mockResolvedValue(row)
    const r = await svc.updateEquipmentLifecycle('x1', { state: 'MAINTENANCE' })
    expect(r.data).toHaveLength(1)
    expect(mockPrisma.device.update).toHaveBeenCalledWith({ where: { id: 'x1' }, data: { state: 'MAINTENANCE' } })
  })

  it('lists, gets and updates devices', async () => {
    mockPrisma.device.findMany.mockResolvedValue([row])
    expect((await svc.listDevices()).data).toHaveLength(1)

    mockPrisma.device.findUnique.mockResolvedValue(row)
    expect((await svc.getDevice('x1')).data).toHaveLength(1)
    mockPrisma.device.findUnique.mockResolvedValue(null)
    expect((await svc.getDevice('nope')).data).toEqual([])

    mockPrisma.device.update.mockResolvedValue(row)
    const r = await svc.updateDevice('x1', { name: 'CT-2' })
    expect(r.data).toHaveLength(1)
  })

  it('lists and reports device faults', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([row])
    expect((await svc.listDeviceFaults()).data).toHaveLength(1)
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { resource: 'device-fault' } }),
    )

    mockPrisma.auditLog.create.mockResolvedValue(row)
    const r = await svc.reportDeviceFault({ level: 'HIGH', message: 'overheat' })
    expect(r.data).toHaveLength(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'REPORT', resource: 'device-fault' }) }),
    )
  })

  it('lists and adds materials', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([])
    expect((await svc.listMaterials()).data).toEqual([])
    mockPrisma.auditLog.create.mockResolvedValue(row)
    const r = await svc.addMaterial({ name: '造影剂' })
    expect(r.data).toHaveLength(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ADD', resource: 'device-material' }) }),
    )
  })

  it('tracks dose records', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([row])
    expect((await svc.getDoseTracking()).data).toHaveLength(1)
    mockPrisma.auditLog.create.mockResolvedValue(row)
    const r = await svc.recordDose({ dlp: 320 })
    expect(r.data).toHaveLength(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'RECORD', resource: 'dose-tracking' }) }),
    )
  })

  it('lists and reports adverse reactions', async () => {
    mockPrisma.adverseEvent.findMany.mockResolvedValue([row])
    expect((await svc.listAdverseReactions()).data).toHaveLength(1)

    mockPrisma.adverseEvent.create.mockResolvedValue(row)
    const r = await svc.reportAdverseReaction({ eventType: 'ALLERGY', severity: 'SEVERE', description: 'rash', department: '放射科', reportedBy: 'nurse' })
    expect(r.data).toHaveLength(1)
    expect(mockPrisma.adverseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'ALLERGY', severity: 'SEVERE' }) }),
    )

    mockPrisma.adverseEvent.create.mockResolvedValue(row)
    await svc.reportAdverseReaction({})
    expect(mockPrisma.adverseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'OTHER', severity: 'MINOR' }) }),
    )
  })

  it('manages contrast inventory and quality', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([row])
    expect((await svc.getInjectionWorkstation()).data).toHaveLength(1)
    expect((await svc.getContrastInventory()).data).toHaveLength(1)

    mockPrisma.auditLog.update.mockResolvedValue(row)
    const r = await svc.updateContrastInventory('x1', { stock: 10 })
    expect(r.data).toHaveLength(1)
    expect(mockPrisma.auditLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'x1' }, data: { detail: { stock: 10 } } }),
    )

    expect((await svc.getContrastQuality()).data).toHaveLength(1)
  })
})

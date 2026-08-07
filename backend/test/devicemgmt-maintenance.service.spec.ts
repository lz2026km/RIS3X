import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { DeviceMgmtService } from '../src/devicemgmt/devicemgmt.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('DeviceMgmtService (MaintenancePlan)', () => {
  let svc: DeviceMgmtService
  let prisma: any

  const row = {
    id: 'MP001',
    tenantId: 'default',
    deviceId: 'DEV-CT-01',
    deviceName: 'CT-1',
    maintenanceDate: new Date('2026-08-15T00:00:00Z'),
    intervalDays: 90,
    type: '定期保养',
    content: '球管衰减检测',
    estimatedCost: null,
    assignee: '张工',
    status: 'PENDING',
    nextDate: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockPrisma = {
    maintenancePlan: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [DeviceMgmtService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(DeviceMgmtService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('lists maintenance plans with deviceId/status filter', async () => {
    mockPrisma.maintenancePlan.findMany.mockResolvedValue([row])
    mockPrisma.maintenancePlan.count.mockResolvedValue(1)
    const result = await svc.listMaintenancePlans({ status: 'PENDING' })
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(prisma.maintenancePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING' }) }),
    )
  })

  it('creates a maintenance plan and derives nextDate from maintenanceDate + intervalDays', async () => {
    mockPrisma.maintenancePlan.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...row, ...data }),
    )
    const created = await svc.createMaintenancePlan({
      deviceId: 'DEV-MR-01',
      maintenanceDate: '2026-08-10',
      intervalDays: 60,
      type: '半年保养',
      content: '液氦补充',
      assignee: '李工',
      estimatedCost: 4500,
    })
    expect(created.deviceId).toBe('DEV-MR-01')
    expect(created.type).toBe('半年保养')
    expect(created.estimatedCost).toBe(4500)
    expect(created.nextDate?.startsWith('2026-10-09')).toBe(true)
  })

  it('updates a maintenance plan', async () => {
    mockPrisma.maintenancePlan.findUnique.mockResolvedValue(row)
    mockPrisma.maintenancePlan.update.mockResolvedValue({ ...row, type: '年度保养' })
    const result = await svc.updateMaintenancePlan('MP001', { type: '年度保养' })
    expect(result.type).toBe('年度保养')
    expect(mockPrisma.maintenancePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'MP001' } }),
    )
  })

  it('throws NotFoundException for missing plan updates', async () => {
    mockPrisma.maintenancePlan.findUnique.mockResolvedValue(null)
    await expect(svc.updateMaintenancePlan('nope', { type: '年度保养' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('deletes a maintenance plan', async () => {
    mockPrisma.maintenancePlan.findUnique.mockResolvedValue(row)
    mockPrisma.maintenancePlan.delete.mockResolvedValue(row)
    const result = await svc.deleteMaintenancePlan('MP001')
    expect(result.ok).toBe(true)
    expect(mockPrisma.maintenancePlan.delete).toHaveBeenCalledWith({ where: { id: 'MP001' } })
  })

  it('returns maintenance due within horizon', async () => {
    mockPrisma.maintenancePlan.findMany.mockResolvedValue([row])
    const result = await svc.maintenanceDue(30)
    expect(result.items).toHaveLength(1)
    expect(result.days).toBe(30)
    expect(prisma.maintenancePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { not: 'COMPLETED' } }) }),
    )
  })
})

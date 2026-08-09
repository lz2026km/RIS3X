// [W1-B] devicemgmt 剂量追踪 + 对比剂注射指令 / 不良反应端点 spec
import { Test } from '@nestjs/testing'
import { DeviceMgmtController } from './devicemgmt.controller'
import { DeviceMgmtService } from './devicemgmt.service'
import { PrismaService } from '../prisma/prisma.service'

describe('DeviceMgmtController (W1-B: dose-tracking + contrast injection)', () => {
  let controller: DeviceMgmtController
  let prisma: PrismaService

  const auditLogCreate = jest.fn()
  const auditLogFindMany = jest.fn()
  const adverseEventCreate = jest.fn()

  beforeEach(async () => {
    auditLogCreate.mockReset()
    auditLogFindMany.mockReset()
    adverseEventCreate.mockReset()
    auditLogFindMany.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
      controllers: [DeviceMgmtController],
      providers: [
        DeviceMgmtService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: { create: auditLogCreate, findMany: auditLogFindMany },
            adverseEvent: { create: adverseEventCreate },
          },
        },
      ],
    }).compile()
    controller = moduleRef.get(DeviceMgmtController)
    prisma = moduleRef.get(PrismaService)
    void prisma
  })

  it('GET dose-tracking returns { items, total }', async () => {
    auditLogFindMany.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }])
    const res = await controller.getDoseTracking()
    expect(res.items).toHaveLength(2)
    expect(res.total).toBe(2)
    expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { resource: 'dose-tracking' } }))
  })

  it('POST dose-tracking records via auditLog.create (resource dose-tracking)', async () => {
    auditLogCreate.mockResolvedValue({ id: 'd1', action: 'RECORD', resource: 'dose-tracking' })
    const body = { patientId: 'P001', deviceId: 'CT-01', doseValue: 12.5, doseUnit: 'mGy', examType: 'CT' }
    const res = await controller.recordDose(body)
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'RECORD', resource: 'dose-tracking' }) }))
    expect(res.id).toBe('d1')
  })

  it('POST contrast/injection sends injection command (resource injection-command)', async () => {
    auditLogCreate.mockResolvedValue({ id: 'inj-1', action: 'SEND', resource: 'injection-command' })
    const body = { protocolId: 'ip-001', protocolName: '胸部CT增强标准方案', contrastType: '碘海醇', totalVolumeMl: 80, flowRateMls: 3.5 }
    const res = await controller.sendInjectionCommand(body)
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'SEND', resource: 'injection-command', detail: body }),
    }))
    expect(res.id).toBe('inj-1')
  })

  it('POST contrast/adverse-reactions reports adverse reaction (adverseEvent.create)', async () => {
    adverseEventCreate.mockResolvedValue({ id: 'ar-1' })
    const body = { patientId: 'P001', contrastType: '碘海醇', reaction: '荨麻疹', severity: 'MILD', administeredAt: new Date().toISOString() }
    const res = await controller.reportAdverseReaction(body)
    expect(adverseEventCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'OTHER', severity: 'MILD', patientId: 'P001', contrastType: '碘海醇' }),
    }))
    expect(res.id).toBe('ar-1')
  })

  it('GET contrast/injection + contrast/quality reachable', async () => {
    auditLogFindMany.mockResolvedValue([])
    await expect(controller.getInjectionWorkstation()).resolves.toEqual({ items: [], total: 0 })
    await expect(controller.getContrastQuality()).resolves.toEqual({ items: [], total: 0 })
  })
})

/**
 * G005 放射RIS系统 v3.0.2.2 - DicomWebModule + NotificationsModule 形状 e2e
 */
import { Test } from '@nestjs/testing'

const vi = { fn: () => {
  const mock: any = () => {}
  mock.mockReturnValue = () => mock
  mock.mockResolvedValue = () => mock
  return mock
}}
import { DicomWebController } from '../src/dicom-web/dicom-web.controller'
import { DicomWebService } from '../src/dicom-web/dicom-web.service'
import { NotificationsController } from '../src/notifications/notifications.controller'
import { NotificationsService } from '../src/notifications/notifications.service'
import { NotificationsGateway } from '../src/notifications/notifications.gateway'
import { PrismaService } from '../src/prisma/prisma.service'

class MockPrisma {
  dicomInstance = {
    findMany: (args: any) => Promise.resolve([]),
    findUnique: (args: any) => Promise.resolve({ id: 'i1', sopInstanceUid: args?.where?.sopInstanceUid, storagePath: '/path', sizeBytes: 1024 }),
    create: (args: any) => Promise.resolve({ id: 'new', ...args.data }),
  }
  notification = {
    count: (args: any) => Promise.resolve(0),
    findMany: (args: any) => Promise.resolve([]),
    create: (args: any) => Promise.resolve({ id: 'n1', ...args.data, read: false, createdAt: new Date().toISOString() }),
    update: (args: any) => Promise.resolve({ id: args.where.id, ...args.data }),
  }
  $connect = () => Promise.resolve()
  $disconnect = () => Promise.resolve()
}

describe('DicomWebModule', () => {
  let ctrl: DicomWebController
  let svc: DicomWebService

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [DicomWebController],
      providers: [
        DicomWebService,
        { provide: PrismaService, useClass: MockPrisma },
      ],
    }).compile()
    ctrl = m.get(DicomWebController)
    svc = m.get(DicomWebService)
  })

  it('capabilities returns 3 transfer syntaxes', () => {
    const r = ctrl.capabilities()
    expect(r.qido.search).toBe(true)
    expect(r.wado.retrieve).toBe(true)
    expect(r.stow.store).toBe(true)
    expect(r.transferSyntaxes.length).toBeGreaterThanOrEqual(3)
  })

  it('searchStudies returns array', async () => {
    const r = await ctrl.searchStudies('P001', 'CT', undefined, '10', '0')
    expect(Array.isArray(r)).toBe(true)
  })

  it('searchSeries returns array', async () => {
    const r = await ctrl.searchSeries('1.2.3.4')
    expect(Array.isArray(r)).toBe(true)
  })

  it('searchInstances returns array', async () => {
    const r = await ctrl.searchInstances('1.2.3.4', '1.2.3.4.1')
    expect(Array.isArray(r)).toBe(true)
  })

  it('retrieve returns instance', async () => {
    const r = await ctrl.retrieve('1.2.3.4.5', {
      setHeader: () => {},
      json: () => {},
    } as any)
    expect(r).toBeDefined()
  })

  it('metadata returns DICOM JSON', async () => {
    const r = await ctrl.metadata('1.2.3.4.5')
    expect(r.sopInstanceUID).toBe('1.2.3.4.5')
    expect(r['00020002'].vr).toBe('UI')
  })

  it('store creates instance', async () => {
    const r = await ctrl.store('1.2.3.4', {
      studyInstanceUid: '1.2.3.4',
      seriesInstanceUid: '1.2.3.4.1',
      sopInstanceUid: '1.2.3.4.5',
      modality: 'CT',
      sopClassUid: '1.2.840.10008.5.1.4.1.1.2',
      sizeBytes: 1024,
      storagePath: '/data/test.dcm',
    })
    expect(r.id).toBeDefined()
  })

  it('service has 6 methods', () => {
    expect(typeof svc.searchStudies).toBe('function')
    expect(typeof svc.searchSeries).toBe('function')
    expect(typeof svc.searchInstances).toBe('function')
    expect(typeof svc.retrieveInstance).toBe('function')
    expect(typeof svc.retrieveMetadata).toBe('function')
    expect(typeof svc.storeInstance).toBe('function')
  })
})

describe('NotificationsModule', () => {
  let ctrl: NotificationsController
  let svc: NotificationsService
  let gw: NotificationsGateway

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        NotificationsGateway,
        { provide: PrismaService, useClass: MockPrisma },
      ],
    }).compile()
    ctrl = m.get(NotificationsController)
    svc = m.get(NotificationsService)
    gw = m.get(NotificationsGateway)
  })

  it('getUnreadCount returns object', async () => {
    const r = await ctrl.unread('U1')
    expect(r.userId).toBe('U1')
    expect(r.unread).toBe(0)
  })

  it('history returns array', async () => {
    const r = await ctrl.history('U1', { page: 1, pageSize: 10 })
    expect(Array.isArray(r)).toBe(true)
  })

  it('read marks notification as read', async () => {
    const r = await ctrl.read('N1')
    expect(r).toBeDefined()
  })

  it('create notification', async () => {
    const r = await ctrl.create({
      userId: 'U1',
      type: 'CRITICAL',
      severity: 'CRITICAL',
      title: '危急值',
      content: '主动脉夹层',
    })
    expect(r.userId).toBe('U1')
  })

  it('broadcast to multiple users', async () => {
    const r = await ctrl.broadcast({
      userIds: ['U1', 'U2', 'U3'],
      type: 'SYSTEM',
      title: '系统通知',
      content: '系统维护',
    })
    expect(r.count).toBe(3)
  })

  it('gateway subscribe/unsubscribe', () => {
    let called = 0
    const cb = () => { called++ }
    const unsub = gw.subscribe('U1', cb)
    gw.push('U1', { id: 'N1' })
    expect(called).toBe(1)
    unsub()
    gw.push('U1', { id: 'N2' })
    expect(called).toBe(1)
  })

  it('gateway broadcastAll', () => {
    let c1 = 0, c2 = 0
    const cb1 = () => { c1++ }
    const cb2 = () => { c2++ }
    gw.subscribe('U1', cb1)
    gw.subscribe('U2', cb2)
    gw.broadcastAll(['U1', 'U2', 'U3'], { id: 'NB' })
    expect(c1).toBe(1)
    expect(c2).toBe(1)
  })
})

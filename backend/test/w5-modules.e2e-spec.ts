/**
 * G005 放射RIS系统 v3.0.2 - 5 个新模块的形状/编译 e2e 测试
 * 不需要真实 DB,只验证 module/controller 形状
 */
import { Test } from '@nestjs/testing'
import { AppointmentsController } from '../src/appointments/appointments.controller'
import { AppointmentsService } from '../src/appointments/appointments.service'
import { CriticalsController } from '../src/criticals/criticals.controller'
import { CriticalsService } from '../src/criticals/criticals.service'
import { TemplatesController } from '../src/templates/templates.controller'
import { TemplatesService } from '../src/templates/templates.service'
import { FilesController } from '../src/files/files.controller'
import { FilesService } from '../src/files/files.service'
import { Hl7Controller } from '../src/hl7/hl7.controller'
import { Hl7Service } from '../src/hl7/hl7.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { SystemConfigService } from '../src/system-storage/system-config.service'

class MockPrisma {
  appointment = {
    findMany: (args: any) => Promise.resolve([]),
    findUnique: (args: any) => Promise.resolve(null),
    create: (args: any) => Promise.resolve({ id: 'mock', ...args.data }),
    update: (args: any) => Promise.resolve({ id: args.where?.id ?? 'mock', ...args.data }),
    count: () => Promise.resolve(0),
  }
  criticalValueNotification = {
    createMany: (args: any) => Promise.resolve({ count: (args?.data as unknown[])?.length ?? 0 }),
    findMany: () => Promise.resolve([]),
  }
  reportTemplate = {
    findMany: () => Promise.resolve([]),
    create: (args: any) => Promise.resolve({ id: 'mock', ...args.data }),
  }
  $connect = () => Promise.resolve()
  $disconnect = () => Promise.resolve()
}

describe('Backend v3.0.2 new modules (10 endpoints)', () => {
  describe('AppointmentsModule', () => {
    let ctrl: AppointmentsController
    let svc: AppointmentsService
    beforeAll(async () => {
      const m = await Test.createTestingModule({
        controllers: [AppointmentsController],
        providers: [
          AppointmentsService,
          { provide: PrismaService, useClass: MockPrisma },
        ],
      }).compile()
      ctrl = m.get(AppointmentsController)
      svc = m.get(AppointmentsService)
    })
    it('list returns paginated', async () => {
      const r = await ctrl.list('0', '10')
      expect(r).toBeDefined()
    })
    it('get throws when not found', async () => {
      await expect(ctrl.get('x')).rejects.toThrow()
    })
    it('cancel returns appointment', async () => {
      const r = await ctrl.cancel('a')
      expect(r).toBeDefined()
    })
    it('service has 5 methods', () => {
      expect(typeof svc.list).toBe('function')
      expect(typeof svc.get).toBe('function')
      expect(typeof svc.create).toBe('function')
      expect(typeof svc.update).toBe('function')
      expect(typeof svc.cancel).toBe('function')
    })
  })

  describe('CriticalsModule', () => {
    let ctrl: CriticalsController
    let svc: CriticalsService
    beforeAll(async () => {
      const m = await Test.createTestingModule({
        controllers: [CriticalsController],
        providers: [
          CriticalsService,
          { provide: PrismaService, useClass: MockPrisma },
        ],
      }).compile()
      ctrl = m.get(CriticalsController)
      svc = m.get(CriticalsService)
    })
    it('list returns notifications', async () => {
      const r = await ctrl.list('c1')
      expect(r).toBeDefined()
    })
    it('notify multi-channel', async () => {
      const r = await ctrl.notify({
        criticalId: 'c1', patientName: 'A', patientId: 'P1', category: 'LIFE_THREATENING',
        finding: 'aortic dissection', channels: ['SMS', 'PHONE'],
        recipientName: 'Dr. X', recipientDept: 'Cardio', recipientPhone: '13800001111',
      })
      expect(r.count).toBe(2)
    })
    it('escalate to new recipients', async () => {
      const r = await ctrl.escalate({
        criticalId: 'c1', reason: 'timeout',
        newRecipients: [{ name: 'Boss', dept: 'Admin', phone: '139' }],
      })
      expect(r.count).toBe(3)
    })
    it('service has notify/escalate/list', () => {
      expect(typeof svc.notify).toBe('function')
      expect(typeof svc.escalate).toBe('function')
      expect(typeof svc.list).toBe('function')
    })
  })

  describe('TemplatesModule', () => {
    let ctrl: TemplatesController
    let svc: TemplatesService
    beforeAll(async () => {
      const m = await Test.createTestingModule({
        controllers: [TemplatesController],
        providers: [
          TemplatesService,
          { provide: PrismaService, useClass: MockPrisma },
        ],
      }).compile()
      ctrl = m.get(TemplatesController)
      svc = m.get(TemplatesService)
    })
    it('list returns templates', async () => {
      const r = await ctrl.list('CT', 'CHEST', undefined)
      expect(r).toBeDefined()
    })
    it('service has list/create', () => {
      expect(typeof svc.list).toBe('function')
      expect(typeof svc.create).toBe('function')
    })
  })

  describe('FilesModule', () => {
    let ctrl: FilesController
    let svc: FilesService
    beforeAll(async () => {
      const m = await Test.createTestingModule({
        controllers: [FilesController],
        providers: [FilesService],
      }).compile()
      ctrl = m.get(FilesController)
      svc = m.get(FilesService)
    })
    it('getUploadUrl returns token', () => {
      const r = ctrl.getUploadUrl('test.dcm', 'application/dicom')
      expect(r.token).toBeDefined()
      expect(r.uploadUrl).toContain(r.token)
    })
    it('confirm returns id', () => {
      const r = ctrl.confirm({ token: 't', metadata: { size: 1024, checksum: 'abc', filename: 'test.dcm' } })
      expect(r.id).toBeDefined()
      expect(r.size).toBe(1024)
    })
    it('service has getUploadUrl/confirmUpload', () => {
      expect(typeof svc.getUploadUrl).toBe('function')
      expect(typeof svc.confirmUpload).toBe('function')
    })
  })

  describe('Hl7Module', () => {
    let ctrl: Hl7Controller
    let svc: Hl7Service
    beforeAll(async () => {
      const m = await Test.createTestingModule({
        controllers: [Hl7Controller],
        providers: [
          Hl7Service,
          // [v3.0.6.11-79] buildORU 读取 admin config hospital_name
          { provide: SystemConfigService, useValue: { getString: jest.fn().mockResolvedValue(undefined), getNumber: jest.fn().mockResolvedValue(30), get: jest.fn(), invalidate: jest.fn() } },
        ],
      }).compile()
      ctrl = m.get(Hl7Controller)
      svc = m.get(Hl7Service)
    })
    it('oru returns message', async () => {
      const r = await ctrl.oru({
        accessionNumber: 'A001', patientName: '张三', patientId: 'P001', patientSex: 'M',
        modality: 'CT', studyDate: '20240615', studyTime: '143000',
        findings: '正常', conclusion: '未见异常', authorName: '张医师', authorId: 'D1', reportId: 'R1',
      })
      expect(r.message).toContain('MSH|')
      expect(r.message).toContain('PID|')
      expect(r.message).toContain('OBR|')
      expect(r.message).toContain('OBX|')
      expect(r.messageType).toBe('ORU^R01')
    })
    it('batch processes multiple', async () => {
      const r = await ctrl.batch({ reports: [{
        accessionNumber: 'A001', patientName: 'A', patientId: 'P1', patientSex: 'F',
        modality: 'MR', studyDate: '20240615', studyTime: '100000',
        findings: 'f', conclusion: 'c', authorName: 'd', authorId: 'D', reportId: 'R1',
      }, {
        accessionNumber: 'A002', patientName: 'B', patientId: 'P2', patientSex: 'M',
        modality: 'CT', studyDate: '20240615', studyTime: '110000',
        findings: 'f', conclusion: 'c', authorName: 'd', authorId: 'D', reportId: 'R2',
      }] })
      expect(r.count).toBe(2)
      expect(r.messages.length).toBe(2)
    })
    it('Hl7Service.escapeText handled', async () => {
      // 通过 oru 内部测试
      const m = await svc.buildORU({
        accessionNumber: 'A1', patientName: 'A|B^C~D', patientId: 'P1', patientSex: 'M',
        modality: 'CT', studyDate: '20240615', studyTime: '100000',
        findings: 'F|with^special~chars', conclusion: 'c', authorName: 'd', authorId: 'D', reportId: 'R1',
      })
      expect(m).toContain('\\F\\')
      expect(m).toContain('\\S\\')
      expect(m).toContain('\\R\\')
    })
  })
})

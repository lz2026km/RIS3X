import { MobileService } from '../src/mobile/mobile.service'

function createPrismaMock() {
  return {
    exam: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    criticalValue: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    report: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  }
}

const cfg = () => ({ get: jest.fn() }) as any

describe('MobileService', () => {
  let svc: MobileService
  let mockConfig: any
  let prismaMock: ReturnType<typeof createPrismaMock>
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('jscode2session', () => {
    it('returns not-configured error when appid/secret missing', async () => {
      mockConfig = { get: jest.fn().mockReturnValue('') }
      svc = new MobileService(mockConfig)
      const r = await svc.jscode2session('code1')
      expect(r).toEqual({ errcode: -1, errmsg: 'WeChat not configured' })
    })

    it('calls WeChat API and returns json when configured', async () => {
      mockConfig = {
        get: jest.fn((key: string, def: string) => (key === 'WECHAT_APPID' ? 'app1' : key === 'WECHAT_SECRET' ? 'sec1' : def)),
      }
      svc = new MobileService(mockConfig)
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openid: 'openid-1', session_key: 'sk' }),
      })
      globalThis.fetch = fetchMock as any
      const r = await svc.jscode2session('js-code-123')
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('appid=app1&secret=sec1&js_code=js-code-123'))
      expect(r.openid).toBe('openid-1')
    })
  })

  describe('todaySummary', () => {
    it('returns seed summary without prisma', async () => {
      svc = new MobileService(cfg())
      const r = await svc.todaySummary()
      expect(r.examsToday).toBeGreaterThan(0)
      expect(typeof r.criticalValues).toBe('number')
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('queries prisma counts when available', async () => {
      prismaMock = createPrismaMock()
      prismaMock.exam.count.mockResolvedValue(10)
      prismaMock.criticalValue.count.mockResolvedValue(2)
      prismaMock.report.count.mockResolvedValue(5)
      svc = new MobileService(cfg(), prismaMock as any)
      const r = await svc.todaySummary()
      expect(r).toMatchObject({ examsToday: 10, pendingExams: 10, criticalValues: 2, reportsToday: 5, signedReportsToday: 5 })
      expect(prismaMock.exam.count).toHaveBeenCalled()
    })

    it('falls back to seed when prisma throws', async () => {
      prismaMock = createPrismaMock()
      prismaMock.exam.count.mockRejectedValue(new Error('db down'))
      svc = new MobileService(cfg(), prismaMock as any)
      const r = await svc.todaySummary()
      expect(r.examsToday).toBeGreaterThan(0)
    })
  })

  describe('worklist', () => {
    it('returns seed worklist without prisma', async () => {
      svc = new MobileService(cfg())
      const all = await svc.worklist()
      expect(all.length).toBeGreaterThan(0)
      expect(all[0]).toHaveProperty('patientName')
      expect(all[0]).toHaveProperty('urgency')
      const pending = await svc.worklist('pending')
      expect(pending.length).toBeLessThanOrEqual(all.length)
    })

    it('maps prisma exams and flags critical urgency', async () => {
      prismaMock = createPrismaMock()
      prismaMock.exam.findMany.mockResolvedValue([
        {
          id: 'E1', accessionNumber: 'ACC1', patientId: 'P1', modality: 'CT', bodyPart: '胸部', state: 'SCHEDULED',
          createdAt: new Date(), scheduledAt: new Date(),
          patient: { id: 'P1', name: '张三', gender: 'MALE', birthDate: new Date('1990-01-01') },
        },
        {
          id: 'E2', accessionNumber: 'ACC2', patientId: 'P2', modality: 'DR', bodyPart: '胸部', state: 'IN_PROGRESS',
          createdAt: new Date(), scheduledAt: new Date(),
          patient: { id: 'P2', name: '李四', gender: 'FEMALE', birthDate: new Date('1985-01-01') },
        },
      ])
      prismaMock.criticalValue.findMany.mockResolvedValue([{ examId: 'E1' }])
      svc = new MobileService(cfg(), prismaMock as any)
      const r = await svc.worklist('pending')
      expect(r.length).toBe(2)
      expect(r[0].status).toBe('pending')
      expect(r[0].urgency).toBe('critical')
      expect(r[1].urgency).toBe('routine')
      expect(prismaMock.exam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ state: 'SCHEDULED' }) }),
      )
    })
  })

  describe('criticalValues', () => {
    it('returns seed list without prisma', async () => {
      svc = new MobileService(cfg())
      const r = await svc.criticalValues()
      expect(r.length).toBeGreaterThan(0)
      expect(r[0]).toHaveProperty('severity')
    })

    it('flattens exam patient info', async () => {
      prismaMock = createPrismaMock()
      prismaMock.criticalValue.findMany.mockResolvedValue([
        {
          id: 'CV1', examId: 'E1', description: '危急描述', severity: 'URGENT', state: 'FOUND', method: 'PHONE', notifiedTo: '急诊科',
          createdAt: new Date(), ackedAt: null,
        },
      ])
      prismaMock.exam.findMany.mockResolvedValue([
        { id: 'E1', accessionNumber: 'ACC1', modality: 'CT', patient: { name: '张三', gender: 'MALE', birthDate: new Date('1990-01-01') } },
      ])
      svc = new MobileService(cfg(), prismaMock as any)
      const r = await svc.criticalValues()
      expect(r[0].patientName).toBe('张三')
      expect(r[0].modality).toBe('CT')
    })
  })

  describe('ackCriticalValue', () => {
    it('acks seed record without prisma', async () => {
      svc = new MobileService(cfg())
      const r = await svc.ackCriticalValue('CV1', { ackedBy: 'mobile' })
      expect(r).toMatchObject({ id: 'CV1', state: 'ACKNOWLEDGED', ackedBy: 'mobile' })
    })

    it('throws NotFound for missing seed id', async () => {
      svc = new MobileService(cfg())
      await expect(svc.ackCriticalValue('missing')).rejects.toThrow('not found')
    })

    it('updates prisma record when available', async () => {
      prismaMock = createPrismaMock()
      prismaMock.criticalValue.findUnique.mockResolvedValue({ id: 'CV1' })
      prismaMock.criticalValue.update.mockResolvedValue({ id: 'CV1', state: 'ACKNOWLEDGED' })
      svc = new MobileService(cfg(), prismaMock as any)
      const r = await svc.ackCriticalValue('CV1')
      expect(r.state).toBe('ACKNOWLEDGED')
      expect(prismaMock.criticalValue.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'CV1' }, data: expect.objectContaining({ state: 'ACKNOWLEDGED' }) }),
      )
    })

    it('throws NotFound when prisma record missing', async () => {
      prismaMock = createPrismaMock()
      prismaMock.criticalValue.findUnique.mockResolvedValue(null)
      svc = new MobileService(cfg(), prismaMock as any)
      await expect(svc.ackCriticalValue('NOPE')).rejects.toThrow('not found')
    })
  })

  describe('latestReports', () => {
    it('returns seed reports without prisma', async () => {
      svc = new MobileService(cfg())
      const r = await svc.latestReports(2)
      expect(r.length).toBeLessThanOrEqual(2)
      expect(r[0]).toHaveProperty('patientName')
      expect(r[0]).toHaveProperty('impression')
    })

    it('maps prisma reports with patient/exam', async () => {
      prismaMock = createPrismaMock()
      prismaMock.report.findMany.mockResolvedValue([
        {
          id: 'R1', state: 'SIGNED', isCritical: false, impression: '正常', conclusion: '未见异常', findings: '',
          createdAt: new Date(), signedAt: new Date(),
          patient: { name: '张三', gender: 'MALE' },
          exam: { modality: 'CT', bodyPart: '胸部', accessionNumber: 'ACC1' },
        },
      ])
      svc = new MobileService(cfg(), prismaMock as any)
      const r = await svc.latestReports()
      expect(r[0].patientName).toBe('张三')
      expect(r[0].modality).toBe('CT')
      expect(prismaMock.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }))
    })
  })

  describe('registerDeviceToken', () => {
    it('registers token in memory', () => {
      svc = new MobileService(cfg())
      const r = svc.registerDeviceToken({ token: 'tok-1', platform: 'android', deviceId: 'dev-1' })
      expect(r).toMatchObject({ success: true, token: 'tok-1', total: 1 })
      expect(svc.listDeviceTokens()).toHaveLength(1)
    })

    it('re-registering same token keeps one entry', () => {
      svc = new MobileService(cfg())
      svc.registerDeviceToken({ token: 'tok-1', platform: 'ios' })
      svc.registerDeviceToken({ token: 'tok-1', platform: 'android', userId: 'u1' })
      expect(svc.listDeviceTokens()).toHaveLength(1)
      expect(svc.listDeviceTokens()[0].userId).toBe('u1')
    })

    it('rejects empty token', () => {
      svc = new MobileService(cfg())
      expect(() => svc.registerDeviceToken({ token: '  ', platform: 'web' } as any)).toThrow('token is required')
    })
  })
})

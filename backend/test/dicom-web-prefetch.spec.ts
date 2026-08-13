import { Test } from '@nestjs/testing'
import { DicomWebController } from '../src/dicom-web/dicom-web.controller'
import { DicomWebService } from '../src/dicom-web/dicom-web.service'

function makeConfig(extra: Record<string, string> = {}): any {
  return { get: (key: string, fallback?: string) => extra[key] ?? fallback }
}

describe('DicomWebService - prefetch (PACS P0-2 影像预取)', () => {
  let svc: DicomWebService

  beforeEach(() => {
    jest.useFakeTimers()
    svc = new DicomWebService({} as any, makeConfig(), undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('构造时 seed 默认已缓存检查 (DICOM_PREFETCH_SEED 或默认样例)', () => {
    const status = svc.getPrefetchStatus()
    expect(status.total).toBeGreaterThanOrEqual(3)
    expect(status.cached).toBe(status.total)
    expect(status.pending).toBe(0)
    expect(status.studies.every(s => s.status === 'cached')).toBe(true)
  })

  it('环境 seed DICOM_PREFETCH_SEED 覆盖默认样例', () => {
    const s = new DicomWebService({} as any, makeConfig({ DICOM_PREFETCH_SEED: 'ST1,ST2' }), undefined)
    const status = s.getPrefetchStatus()
    expect(status.total).toBe(2)
    expect(status.studies.map(x => x.studyUid)).toEqual(['ST1', 'ST2'])
    expect(status.studies.every(x => x.status === 'cached')).toBe(true)
  })

  it('prefetchStudies: 新 studyUid 标记 queued, 已缓存计入 cached', async () => {
    const seeded = svc.getPrefetchStatus().studies[0]!.studyUid
    const r1 = await svc.prefetchStudies([seeded, 'ST-NEW-1', 'ST-NEW-2'])
    expect(r1).toEqual({ queued: 2, cached: 1 })
    const status = svc.getPrefetchStatus()
    expect(status.pending).toBe(2)
    expect(status.studies.find(s => s.studyUid === 'ST-NEW-1')?.status).toBe('queued')
  })

  it('重复入队幂等: 已 queued 的 studyUid 不再重复入队 (仍计入 queued)', async () => {
    await svc.prefetchStudies(['ST-A'])
    const r2 = await svc.prefetchStudies(['ST-A'])
    expect(r2).toEqual({ queued: 1, cached: 0 })
    expect(svc.getPrefetchStatus().studies.filter(s => s.studyUid === 'ST-A').length).toBe(1)
  })

  it('去重 + 空 uid 过滤', async () => {
    const r = await svc.prefetchStudies(['ST-1', 'ST-1', '', '  ', 'ST-2'])
    expect(r).toEqual({ queued: 2, cached: 0 })
  })

  it('模拟预取完成: 延时后 queued → cached, pending 归零', async () => {
    await svc.prefetchStudies(['ST-X'])
    expect(svc.getPrefetchStatus().pending).toBe(1)
    jest.advanceTimersByTime(3000)
    const status = svc.getPrefetchStatus()
    expect(status.studies.find(s => s.studyUid === 'ST-X')?.status).toBe('cached')
    expect(status.pending).toBe(0)
    expect(status.cached).toBe(status.total)
  })

  it('getPrefetchStatus 汇总 total/cached/pending 一致', async () => {
    await svc.prefetchStudies(['ST-Y1', 'ST-Y2'])
    const status = svc.getPrefetchStatus()
    expect(status.total).toBe(status.cached + status.pending)
    expect(status.studies).toHaveLength(status.total)
  })
})

describe('DicomWebController - prefetch', () => {
  let ctrl: DicomWebController
  let svc: jest.Mocked<DicomWebService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DicomWebController],
      providers: [
        {
          provide: DicomWebService,
          useValue: {
            getCapabilities: jest.fn(),
            searchStudies: jest.fn(),
            searchSeries: jest.fn(),
            searchInstances: jest.fn(),
            retrieveInstance: jest.fn(),
            retrieveMetadata: jest.fn(),
            storeInstance: jest.fn(),
            prefetchStudies: jest.fn(),
            getPrefetchStatus: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(DicomWebController)
    svc = module.get(DicomWebService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('POST /dicom-web/prefetch 委托 service.prefetchStudies', async () => {
    svc.prefetchStudies.mockResolvedValue({ queued: 2, cached: 1 })
    const r = await ctrl.prefetch({ studyUids: ['A', 'B'] })
    expect(svc.prefetchStudies).toHaveBeenCalledWith(['A', 'B'])
    expect(r).toEqual({ queued: 2, cached: 1 })
  })

  it('GET /dicom-web/prefetch/status 委托 service.getPrefetchStatus', () => {
    svc.getPrefetchStatus.mockReturnValue({ total: 5, cached: 3, pending: 2, studies: [] })
    const r = ctrl.prefetchStatus()
    expect(svc.getPrefetchStatus).toHaveBeenCalled()
    expect(r.total).toBe(5)
    expect(r.pending).toBe(2)
  })
})

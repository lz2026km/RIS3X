import { Test } from '@nestjs/testing'
import { DicomWebController } from '../src/dicom-web/dicom-web.controller'
import { DicomWebService } from '../src/dicom-web/dicom-web.service'

describe('DicomWebController', () => {
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
          },
        },
      ],
    }).compile()
    ctrl = module.get(DicomWebController)
    svc = module.get(DicomWebService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('capabilities delegates to service', async () => {
    svc.getCapabilities.mockReturnValue({ version: '3.0.2.2' } as any)
    const r = ctrl.capabilities()
    expect(svc.getCapabilities).toHaveBeenCalled()
    expect(r.version).toBe('3.0.2.2')
  })

  it('searchStudies delegates to service', async () => {
    svc.searchStudies.mockResolvedValue([])
    await ctrl.searchStudies('P001', 'CT', undefined, '10', '0')
    expect(svc.searchStudies).toHaveBeenCalledWith({ PatientID: 'P001', Modality: 'CT', StudyInstanceUID: undefined, limit: 10, offset: 0 })
  })

  it('searchStudies uses default limit/offset when not provided', async () => {
    svc.searchStudies.mockResolvedValue([])
    await ctrl.searchStudies(undefined, undefined, undefined, undefined, undefined)
    expect(svc.searchStudies).toHaveBeenCalledWith({ PatientID: undefined, Modality: undefined, StudyInstanceUID: undefined, limit: 50, offset: 0 })
  })

  it('searchSeries delegates to service', async () => {
    svc.searchSeries.mockResolvedValue([])
    await ctrl.searchSeries('study1')
    expect(svc.searchSeries).toHaveBeenCalledWith('study1')
  })

  it('searchInstances delegates to service', async () => {
    svc.searchInstances.mockResolvedValue([])
    await ctrl.searchInstances('study1', 'series1')
    expect(svc.searchInstances).toHaveBeenCalledWith('study1', 'series1')
  })

  it('retrieve delegates to service and sets headers', async () => {
    const buffer = Buffer.from('DICM')
    svc.retrieveInstance.mockResolvedValue({ id: 'i1', storagePath: '/path', size: 4, mimeType: 'application/dicom', buffer } as any)
    const res = { setHeader: jest.fn() } as any
    const r = await ctrl.retrieve('sop1', res)
    expect(svc.retrieveInstance).toHaveBeenCalledWith('sop1')
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/dicom')
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '4')
    expect(r).toBe(buffer)
  })

  it('metadata delegates to service', async () => {
    svc.retrieveMetadata.mockResolvedValue({ '00080018': {} } as any)
    const r = await ctrl.metadata('sop1')
    expect(svc.retrieveMetadata).toHaveBeenCalledWith('sop1')
  })

  it('store delegates to service', async () => {
    svc.storeInstance.mockResolvedValue({ id: 'i1' } as any)
    const body = { studyInstanceUid: 'study1', seriesInstanceUid: 'series1', sopInstanceUid: 'sop1', modality: 'CT', sopClassUid: '1.2.3', sizeBytes: 1024, storagePath: '/path' }
    const r = await ctrl.store('study1', body)
    expect(svc.storeInstance).toHaveBeenCalledWith('study1', 'series1', 'sop1', 'CT', '1.2.3', 1024, '/path', undefined)
  })
})

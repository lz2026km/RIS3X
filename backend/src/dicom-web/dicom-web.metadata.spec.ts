/**
 * G005 W3-BackendParity - DICOMweb study/series 元数据 (DICOM JSON) spec
 */
import { DicomWebService } from './dicom-web.service'

const makeService = (rows: unknown[] = []) => {
  const phsr = { dicomInstance: { findMany: jest.fn().mockResolvedValue(rows) } } as never
  const config = { get: jest.fn().mockReturnValue(undefined) } as never
  return new DicomWebService(phsr, config)
}

describe('DicomWebService 元数据', () => {
  it('getStudyMetadata 返回 DICOM JSON 关键标签', async () => {
    const svc = makeService([{ modality: 'MR', patientName: 'LI^NA', seriesInstanceUid: 'S1' }])
    const meta = await svc.getStudyMetadata('1.2.3')
    expect(meta['0020000D']).toEqual({ vr: 'UI', Value: ['1.2.3'] })
    expect(meta['00080061']).toEqual({ vr: 'CS', Value: ['MR'] })
  })

  it('getSeriesMetadata 返回 series UID / modality', async () => {
    const svc = makeService([{ modality: 'CT', seriesNumber: 2 }])
    const meta = await svc.getSeriesMetadata('1.2.3', '1.2.3.4')
    expect(meta['0020000E']).toEqual({ vr: 'UI', Value: ['1.2.3.4'] })
    expect(meta['00080060']).toEqual({ vr: 'CS', Value: ['CT'] })
  })

  it('无实例时返回占位元数据', async () => {
    const svc = makeService([])
    const meta = await svc.getStudyMetadata('9.9.9')
    expect(meta['0020000D']).toEqual({ vr: 'UI', Value: ['9.9.9'] })
    expect(meta['00080061']).toEqual({ vr: 'CS', Value: ['CT'] })
  })
})

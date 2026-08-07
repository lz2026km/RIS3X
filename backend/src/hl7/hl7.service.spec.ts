/**
 * G005 RIS v3.0.6.11-79 - HL7 buildORU 消费者 spec
 * 断言 admin config hospital_name 写入 MSH.3(发送应用)/MSH.4(发送机构)
 */
import { Hl7Service, type ReportForHL7 } from './hl7.service'

const baseOru: ReportForHL7 = {
  accessionNumber: 'ACC-001',
  patientName: '张明远',
  patientId: 'P1',
  patientSex: 'M',
  modality: 'CT',
  studyDate: '20260801',
  studyTime: '063000',
  findings: '右上肺斑片影',
  conclusion: '炎症可能',
  authorName: '李医生',
  authorId: 'U1',
  reportId: 'R-1',
}

const makeSystemConfig = (values: Record<string, unknown> = {}) => ({
  getString: jest.fn(async (key: string, fallback: string) => {
    const v = values[key]
    return typeof v === 'string' && v.trim().length > 0 ? v : fallback
  }),
  getNumber: jest.fn(async (_key: string, fb: number) => fb),
  get: jest.fn(),
  invalidate: jest.fn(),
}) as never

const makeService = (values: Record<string, unknown> = {}) =>
  new Hl7Service({} as never, makeSystemConfig(values))

describe('Hl7Service.buildORU (MSH 发送方)', () => {
  it('writes admin config hospital_name into MSH.3/MSH.4', async () => {
    const service = makeService({ hospital_name: '协和医院' })
    const message = await service.buildORU(baseOru)
    const msh = message.split('\r')[0]!.split('|')
    expect(msh[2]).toBe('协和医院') // MSH-3 发送应用
    expect(msh[3]).toBe('协和医院') // MSH-4 发送机构
  })

  it('falls back to G005 identifiers when hospital_name absent', async () => {
    const service = makeService({})
    const message = await service.buildORU(baseOru)
    const msh = message.split('\r')[0]!.split('|')
    expect(msh[2]).toBe('G005 放射科信息管理系统')
    expect(msh[3]).toBe('G005 放射科信息管理系统')
  })
})

import { Hl7SiuService } from '../src/modules/hl7-siu/hl7-siu.service'

describe('Hl7SiuService', () => {
  let svc: Hl7SiuService

  beforeAll(() => {
    svc = new Hl7SiuService()
  })

  it('generateS12 creates valid SIU^S12 message with correct segments', () => {
    const result = svc.generateS12({
      patientId: 'P001',
      patientName: '张三',
      patientSex: 'M',
      doctorId: 'D001',
      doctorName: '李医生',
      department: '放射科',
      startDateTime: '2026-07-25T09:00:00Z',
      endDateTime: '2026-07-25T09:30:00Z',
      reason: '常规检查',
    })
    expect(result.messageType).toBe('SIU^S12')
    expect(result.message).toContain('MSH')
    expect(result.message).toContain('PID')
    expect(result.message).toContain('SCH')
    expect(result.bytes).toBeGreaterThan(0)
    expect(result.controlId).toContain('SIU-G005-P001')
  })

  it('generateS12 includes NTE segment when note is provided', () => {
    const result = svc.generateS12({
      patientId: 'P002',
      patientName: '李四',
      patientSex: 'F',
      doctorId: 'D002',
      doctorName: '王医生',
      department: '超声科',
      startDateTime: '2026-07-26T10:00:00Z',
      endDateTime: '2026-07-26T10:30:00Z',
      note: '需空腹',
    })
    expect(result.message).toContain('NTE')
    expect(result.message).toContain('需空腹')
  })

  it('parse extracts all fields from raw HL7 message', () => {
    const raw = [
      'MSH|^~\\&|G005_RIS|G005|HIS|HOSPITAL|20260725120000||SIU^S12|CTL001|P|2.5.1',
      'PID|1||P001^^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^MR||张三^张三||M||||||',
      'SCH|1||D001^^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^DR||李医生|放射科|||20260725090000|20260725093000',
    ].join('\r')
    const parsed = svc.parse(raw)
    expect(parsed.sendingApp).toBe('G005_RIS')
    expect(parsed.patientId).toBe('P001')
    expect(parsed.patientName).toBe('张三')
    expect(parsed.doctorId).toBe('D001')
    expect(parsed.startDateTime).toBe('20260725090000')
  })

  it('fmtDT formats Date to HL7 timestamp format', () => {
    const formatted = (svc as any).fmtDT('2026-07-25T09:00:00Z')
    expect(formatted).toMatch(/^\d{14}$/)
    expect(formatted).toBe('20260725090000')
  })
})

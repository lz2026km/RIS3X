import { Injectable } from '@nestjs/common'

export interface SiuMessage {
  controlId: string
  messageType: string
  message: string
  generatedAt: string
  bytes: number
}

export interface SiuScheduleInput {
  patientId: string
  patientName: string
  patientSex: string
  doctorId: string
  doctorName: string
  department: string
  startDateTime: string
  endDateTime: string
  reason?: string
  note?: string
}

@Injectable()
export class Hl7SiuService {
  generateS12(input: SiuScheduleInput): SiuMessage {
    const now = new Date()
    const controlId = `SIU-G005-${input.patientId}-${now.getTime()}`
    const msh = [
      'MSH|^~\\&|G005_RIS|G005|HIS|HOSPITAL|' + this.fmtDT(now) + '||SIU^S12|' + controlId + '|P|2.5',
    ].join('\r')
    const pid = [
      'PID|1||' + input.patientId + '^^^HOSPITAL||' + input.patientName + '||' + input.patientSex + '||||||',
    ].join('\r')
    const sch = [
      'SCH|1||' + input.doctorId + '^^^HOSPITAL^DR||' + input.doctorName + '|' + input.department + '|||' + this.fmtDT(input.startDateTime) + '|' + this.fmtDT(input.endDateTime),
    ].join('\r')
    const note = input.note ? ['NTE|1|' + input.note].join('\r') : ''
    const message = [msh, pid, sch, note].filter(Boolean).join('\r')
    return {
      controlId,
      messageType: 'SIU^S12',
      message,
      generatedAt: now.toISOString(),
      bytes: Buffer.byteLength(message, 'utf8'),
    }
  }

  parse(raw: string): Record<string, string> {
    const lines = raw.split('\r')
    const result: Record<string, string> = {}
    for (const line of lines) {
      if (line.startsWith('MSH')) {
        const segs = line.split('|')
        result['sendingApp'] = segs[2] || ''
        result['sendingFacility'] = segs[3] || ''
        result['receivingApp'] = segs[4] || ''
        result['receivingFacility'] = segs[5] || ''
        result['dateTime'] = segs[6] || ''
        result['messageType'] = segs[8] || ''
        result['controlId'] = segs[9] || ''
      } else if (line.startsWith('PID')) {
        const segs = line.split('|')
        result['patientId'] = segs[3]?.split('^')[0] || ''
        result['patientName'] = segs[5]?.split('^')[0] || ''
        result['patientSex'] = segs[8] || ''
      } else if (line.startsWith('SCH')) {
        const segs = line.split('|')
        result['doctorId'] = segs[3]?.split('^')[0] || ''
        result['doctorName'] = segs[4] || ''
        result['department'] = segs[5] || ''
        result['startDateTime'] = segs[7] || ''
        result['endDateTime'] = segs[8] || ''
      }
    }
    return result
  }

  private fmtDT(dt: string): string {
    const d = new Date(dt)
    return d.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  }
}

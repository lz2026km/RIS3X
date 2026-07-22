import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

export interface SignSession {
  id: string
  reportId: string
  reportTitle: string
  patientName: string
  signerId: string
  signerName: string
  status: 'pending' | 'approved' | 'rejected'
  signatureData?: string
  comment?: string
  createdAt: string
  updatedAt?: string
}

@Injectable()
export class TeleSignService {
  private sessions: SignSession[] = [
    { id: 'ts-001', reportId: 'RPT001', reportTitle: 'Chest CT Report', patientName: 'Zhang San', signerId: 'dr-001', signerName: 'Dr. Wang', status: 'pending', createdAt: '2026-07-11T10:00:00Z' },
    { id: 'ts-002', reportId: 'RPT002', reportTitle: 'Brain MRI Report', patientName: 'Li Si', signerId: 'dr-002', signerName: 'Dr. Li', status: 'approved', signatureData: 'data:image/png;base64,iVBOR...', createdAt: '2026-07-10T14:00:00Z', updatedAt: '2026-07-10T15:30:00Z' },
    { id: 'ts-003', reportId: 'RPT003', reportTitle: 'Chest X-Ray Report', patientName: 'Wang Wu', signerId: 'dr-003', signerName: 'Dr. Zhang', status: 'rejected', comment: '需要补充影像学描述', createdAt: '2026-07-09T09:00:00Z', updatedAt: '2026-07-09T11:00:00Z' },
  ]

  create(reportId: string, reportTitle: string, patientName: string, signerId: string, signerName: string): SignSession {
    const session: SignSession = {
      id: `ts-${uuid().slice(0, 6)}`, reportId, reportTitle, patientName,
      signerId, signerName, status: 'pending',
      createdAt: new Date().toISOString(),
    }
    this.sessions.push(session)
    return session
  }

  approve(id: string, signatureData: string, comment?: string): SignSession {
    const s = this.sessions.find(x => x.id === id)
    if (!s) throw new NotFoundException('Session not found')
    s.status = 'approved'
    s.signatureData = signatureData
    s.comment = comment
    s.updatedAt = new Date().toISOString()
    return s
  }

  reject(id: string, comment: string): SignSession {
    const s = this.sessions.find(x => x.id === id)
    if (!s) throw new NotFoundException('Session not found')
    s.status = 'rejected'
    s.comment = comment
    s.updatedAt = new Date().toISOString()
    return s
  }

  list(): SignSession[] {
    return this.sessions
  }
}

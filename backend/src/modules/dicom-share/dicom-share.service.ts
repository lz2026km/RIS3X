import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'crypto'

export interface ShareRecord {
  id: string
  studyId: string
  patientName: string
  fromDept: string
  toDept: string
  status: 'sent' | 'received' | 'pending' | 'expired' | 'failed'
  protocol: 'dicom-tls' | 'wado'
  password: string
  expiresAt: string
  sizeMb: number
  url?: string
  createdAt: string
}

export interface CreateShareDto {
  studyId: string
  patientName?: string
  toDept: string
  protocol: 'dicom-tls' | 'wado'
  password?: string
  expiresAt?: string
  sizeMb?: number
}

export interface ShareStats {
  total: number
  todayCount: number
  pendingCount: number
  receivedCount: number
  totalSizeMb: number
}

export interface ShareLinkResult {
  id: string
  url: string
  password: string
}

const SEED: ShareRecord[] = [
  { id: 'SHR-1001', studyId: 'CBCT-20260725-01', patientName: '张伟', fromDept: '放射科', toDept: '口腔科', status: 'sent', protocol: 'dicom-tls', password: '', expiresAt: '2026-08-25', sizeMb: 145, url: '/dicom-share/link/shr-1001', createdAt: '2026-07-25 14:30' },
  { id: 'SHR-1002', studyId: 'CT-20260724-03', patientName: '李娜', fromDept: '放射科', toDept: '口腔外科', status: 'received', protocol: 'dicom-tls', password: '', expiresAt: '2026-08-24', sizeMb: 210, url: '/dicom-share/link/shr-1002', createdAt: '2026-07-24 10:15' },
  { id: 'SHR-1003', studyId: 'OCT-20260723-07', patientName: '王芳', fromDept: '放射科', toDept: '眼科', status: 'pending', protocol: 'wado', password: '8862', expiresAt: '2026-08-23', sizeMb: 85, url: '/dicom-share/link/shr-1003', createdAt: '2026-07-23 16:00' },
  { id: 'SHR-1004', studyId: 'MR-20260722-02', patientName: '赵敏', fromDept: '放射科', toDept: '骨科', status: 'expired', protocol: 'dicom-tls', password: '', expiresAt: '2026-07-22', sizeMb: 320, url: '/dicom-share/link/shr-1004', createdAt: '2026-07-15 09:00' },
]

const memShares: ShareRecord[] = []

@Injectable()
export class DicomShareService {
  list(): ShareRecord[] {
    return [...memShares, ...SEED]
  }

  get(id: string): ShareRecord {
    const found = this.list().find((s) => s.id === id)
    if (!found) throw new NotFoundException('Share not found')
    return found
  }

  create(dto: CreateShareDto): ShareRecord {
    const record: ShareRecord = {
      id: `SHR-${String(1000 + this.list().length + 1)}`,
      studyId: dto.studyId ?? 'UNKNOWN',
      patientName: dto.patientName ?? '未知',
      fromDept: '放射科',
      toDept: dto.toDept ?? '',
      status: 'pending',
      protocol: dto.protocol ?? 'dicom-tls',
      password: dto.password ?? '',
      expiresAt: dto.expiresAt ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      sizeMb: dto.sizeMb ?? 0,
      url: `/dicom-share/link/${randomUUID()}`,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    }
    memShares.unshift(record)
    return record
  }

  remove(id: string): { id: string; deleted: boolean } {
    const idx = memShares.findIndex((s) => s.id === id)
    if (idx >= 0) memShares.splice(idx, 1)
    return { id, deleted: true }
  }

  copyLink(id: string): ShareLinkResult {
    const found = this.get(id)
    return { id: found.id, url: found.url ?? `/share/${found.id}`, password: found.password }
  }

  getStats(): ShareStats {
    const all = this.list()
    const todayPrefix = new Date().toISOString().slice(0, 10)
    return {
      total: all.length,
      todayCount: all.filter((s) => s.createdAt.startsWith(todayPrefix)).length,
      pendingCount: all.filter((s) => s.status === 'pending').length,
      receivedCount: all.filter((s) => s.status === 'received').length,
      totalSizeMb: Number(all.reduce((sum, s) => sum + s.sizeMb, 0).toFixed(1)),
    }
  }
}

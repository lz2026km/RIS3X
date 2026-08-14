/**
 * [G005 Wave 10A] 眼科远程会诊桥接服务 spec
 * /eye/tele/*: turn / session CRUD / stream / consult / stats
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { TeleService } from '../src/modules/tele/tele.service'
import { EyeTeleService } from '../src/modules/eye-tele/eye-tele.service'

describe('EyeTeleService', () => {
  let svc: EyeTeleService

  beforeEach(() => {
    svc = new EyeTeleService(new TeleService())
  })

  describe('turn / 网络配置', () => {
    it('returns 5G edge + TURN config with latency metrics', () => {
      const turn = svc.getTurn()
      expect(turn).toBeDefined()
      expect((turn['5G'] as any).edgeNodeId).toMatch(/^edge-/)
      expect((turn['5G'] as any).slice).toBe('healthcare-mmtc')
      expect((turn.latency as any).p95).toBeGreaterThan(0)
      expect(Array.isArray(turn.turnServers)).toBe(true)
      expect((turn.turnServers as any[]).length).toBeGreaterThanOrEqual(2)
      expect((turn.turnServers as any[])[0].url).toContain('turn:')
    })

    it('returns deterministic config shape for frontend TeleConsultPage', () => {
      const a = svc.getTurn()
      const b = svc.getTurn()
      expect(JSON.stringify(a['5G'])).toBe(JSON.stringify(b['5G']))
      expect(a.refreshedAt).toBeDefined()
    })
  })

  describe('session CRUD (seed 派生 + 内存)', () => {
    it('seeds historical sessions derived from eye studies', () => {
      const sessions = svc.listSessions()
      expect(sessions.length).toBeGreaterThanOrEqual(5)
      const first = sessions[0]
      expect(first.sessionId).toMatch(/^SES-/)
      expect(first.patientId).toMatch(/^P\d+$/)
      expect(['video', 'screen', 'data']).toContain(first.mode)
      expect(first.participants.length).toBeGreaterThan(0)
      expect(['active', 'ended', 'waiting']).toContain(first.status)
    })

    it('creates a session reusing tele WebRTC signaling session', () => {
      const s = svc.createSession({ patientId: 'P000001', studyId: 'STU-X', participants: ['D001', 'D005'], mode: 'video' })
      expect(s.status).toBe('active')
      expect(s.patientId).toBe('P000001')
      expect(s.studyId).toBe('STU-X')
      expect(s.participants).toContain('D001')
      expect(s.signalingUrl).toContain('wss://')
      expect(s.iceServers.length).toBeGreaterThanOrEqual(2)
      const fetched = svc.getSession(s.sessionId)
      expect(fetched.sessionId).toBe(s.sessionId)
    })

    it('filters sessions by status', () => {
      const ended = svc.listSessions('ended')
      expect(ended.length).toBeGreaterThan(0)
      expect(ended.every((s) => s.status === 'ended')).toBe(true)
      expect(svc.listSessions('active').every((s) => s.status === 'active')).toBe(true)
    })

    it('throws NotFound for unknown session; ends active session', () => {
      expect(() => svc.getSession('SES-NOPE')).toThrow(NotFoundException)
      const s = svc.createSession({ patientId: 'P000001', participants: ['D001'] })
      const ended = svc.endSession(s.sessionId)
      expect(ended.status).toBe('ended')
      expect(svc.getSession(s.sessionId).status).toBe('ended')
    })

    it('rejects empty patientId when creating session', () => {
      expect(() => svc.createSession({ patientId: '' })).toThrow(BadRequestException)
    })
  })

  describe('远程流 / stream', () => {
    it('creates dicom-tls stream with AES key and endpoint', () => {
      const st = svc.createStream({ studyId: 'STU-20260620-00001', targetHospital: 'PUMC-眼科', protocol: 'dicom-tls' })
      expect(st.streamId).toMatch(/^STR-/)
      expect(st.endpoint).toContain('dicom://')
      expect(st.aesKey).toContain('AES256-GCM')
      expect(st.chunkSize).toBe(524288)
      expect(st.status).toBe('streaming')
      expect(svc.listStreams('streaming').some((x) => x.streamId === st.streamId)).toBe(true)
    })

    it('supports wado protocol and seeded historical streams', () => {
      const st = svc.createStream({ studyId: 'STU-Y', protocol: 'wado' })
      expect(st.endpoint).toContain('wado://')
      const seeded = svc.listStreams('ended')
      expect(seeded.length).toBeGreaterThanOrEqual(2)
      expect(seeded[0].bytesTransferred).toBeGreaterThan(0)
    })
  })

  describe('会诊意见 / consult 记录', () => {
    it('creates pending consult with SLA tied to session', () => {
      const s = svc.createSession({ patientId: 'P000001', studyId: 'STU-Z', participants: ['D001', 'D005'] })
      const c = svc.createConsult({ sessionId: s.sessionId, specialistId: 'D005', question: '请评估 DR 分级' })
      expect(c.consultId).toMatch(/^CON-/)
      expect(c.patientId).toBe('P000001')
      expect(c.studyId).toBe('STU-Z')
      expect(c.status).toBe('pending')
      expect(c.sla.responseTime).toBe('4 hours')
      expect(c.specialistName).toBeTruthy()
      expect(c.requestedAt).toBeTruthy()
    })

    it('lists seeded consults and filters by status/specialist', () => {
      const all = svc.listConsults()
      expect(all.length).toBeGreaterThanOrEqual(3)
      expect(all.some((c) => c.status === 'answered' && c.answer && c.reviewedBy)).toBe(true)
      const pending = svc.listConsults({ status: 'pending' })
      expect(pending.every((c) => c.status === 'pending')).toBe(true)
      const byDoc = svc.listConsults({ specialistId: 'D005' })
      expect(byDoc.every((c) => c.specialistId === 'D005')).toBe(true)
    })

    it('answers a pending consult once; rejects duplicates and missing fields', () => {
      const c = svc.createConsult({ specialistId: 'D003', question: '视野进展评估?', priority: 'urgent' })
      expect(c.sla.priority).toBe('urgent')
      expect(c.sla.responseTime).toBe('1 hour')
      const answered = svc.answerConsult(c.consultId, { answer: '建议调整用药', reviewedBy: 'D003' })
      expect(answered.status).toBe('answered')
      expect(answered.answeredAt).toBeTruthy()
      expect(() => svc.answerConsult(c.consultId, { answer: '再次答复' })).toThrow(ConflictException)
      expect(() => svc.createConsult({ specialistId: '', question: 'x' })).toThrow(BadRequestException)
      expect(() => svc.createConsult({ specialistId: 'D005', question: '' })).toThrow(BadRequestException)
      expect(() => svc.getConsult('CON-NOPE')).toThrow(NotFoundException)
    })

    it('aggregates deterministic stats', () => {
      const stats = svc.getStats()
      expect(stats.totalSessions).toBeGreaterThanOrEqual(5)
      expect(stats.totalConsults).toBeGreaterThanOrEqual(4)
      expect(stats.answeredConsults).toBeGreaterThan(0)
      expect(stats.avgResponseMinutes).toBeGreaterThan(0)
      expect(stats.hospitals.length).toBeGreaterThanOrEqual(3)
      expect(Object.keys(stats.byMode).length).toBeGreaterThanOrEqual(2)
    })
  })
})

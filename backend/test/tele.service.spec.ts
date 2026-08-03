import { ConflictException, NotFoundException } from '@nestjs/common'
import { TeleService } from '../src/modules/tele/tele.service'

describe('TeleService', () => {
  let svc: TeleService

  beforeEach(() => {
    svc = new TeleService()
  })

  describe('sessions', () => {
    it('creates a waiting session', () => {
      const s = svc.createSession('host1', 'Dr. Wang', ['stu-1', 'stu-2'])
      expect(s.status).toBe('waiting')
      expect(s.studyUids).toEqual(['stu-1', 'stu-2'])
      expect(s.id).toMatch(/^[0-9a-f]{8}$/)
      expect(svc.getSession(s.id)).toBe(s)
    })

    it('joins a session as guest', () => {
      const s = svc.createSession('host1', 'Dr. Wang', ['stu-1'])
      const joined = svc.joinSession(s.id, 'guest1', 'Dr. Li')
      expect(joined.status).toBe('connected')
      expect(joined.guestId).toBe('guest1')
    })

    it('throws when joining unknown or full session', () => {
      expect(() => svc.joinSession('nope', 'g', 'Dr. X')).toThrow(NotFoundException)
      const s = svc.createSession('h', 'Dr. A', [])
      svc.joinSession(s.id, 'g1', 'Dr. B')
      expect(() => svc.joinSession(s.id, 'g2', 'Dr. C')).toThrow(ConflictException)
    })

    it('ends a session and clears buffers', () => {
      const s = svc.createSession('h', 'Dr. A', [])
      svc.storeSignal(s.id, { type: 'offer', from: 'a', to: 'b', sessionId: s.id })
      expect(svc.endSession(s.id)).toBe(true)
      expect(svc.getSession(s.id)).toBeUndefined()
      expect(() => svc.endSession(s.id)).toThrow(NotFoundException)
    })
  })

  describe('signals / chat / cursors', () => {
    it('stores and drains pending signals per peer', () => {
      const s = svc.createSession('h', 'Dr. A', [])
      svc.storeSignal(s.id, { type: 'offer', from: 'a', to: 'b', sessionId: s.id })
      svc.storeSignal(s.id, { type: 'answer', from: 'b', to: 'a', sessionId: s.id })
      const forB = svc.getPendingSignals(s.id, 'b')
      expect(forB).toHaveLength(1)
      expect(forB[0].type).toBe('offer')
      expect(svc.getPendingSignals(s.id, 'b')).toHaveLength(0)
    })

    it('adds and retrieves chat messages with since filter', () => {
      const s = svc.createSession('h', 'Dr. A', [])
      svc.addChatMessage({ sessionId: s.id, userId: 'u1', userName: '张三', text: 'hello', timestamp: '2026-07-01T00:00:00Z' })
      svc.addChatMessage({ sessionId: s.id, userId: 'u2', userName: '李四', text: 'world', timestamp: '2026-07-02T00:00:00Z' })
      expect(svc.getChatMessages(s.id)).toHaveLength(2)
      expect(svc.getChatMessages(s.id, '2026-07-01T00:00:00Z')).toHaveLength(1)
    })

    it('updates cursor position per user and caps the list', () => {
      const s = svc.createSession('h', 'Dr. A', [])
      for (let i = 0; i < 25; i++) {
        svc.updateCursor({ sessionId: s.id, userId: `u${i}`, userName: `U${i}`, x: i, y: i, color: '#fff', timestamp: Date.now() })
      }
      svc.updateCursor({ sessionId: s.id, userId: 'u0', userName: 'U0', x: 99, y: 99, color: '#000', timestamp: Date.now() })
      const cursors = svc.getCursors(s.id)
      expect(cursors.length).toBeLessThanOrEqual(20)
      expect(cursors.find((c) => c.userId === 'u0')?.x).toBe(99)
    })
  })
})

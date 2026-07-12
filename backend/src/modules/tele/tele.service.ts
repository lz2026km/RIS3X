import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

interface Session {
  id: string
  hostId: string
  hostName: string
  guestId?: string
  guestName?: string
  studyUids: string[]
  status: 'waiting' | 'connected' | 'disconnected'
  createdAt: Date
}

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate'
  from: string
  to: string
  sessionId: string
  payload?: unknown
}

interface ChatMessage {
  id: string
  sessionId: string
  userId: string
  userName: string
  text: string
  timestamp: string
}

interface CursorPosition {
  sessionId: string
  userId: string
  userName: string
  x: number
  y: number
  color: string
  timestamp: number
}

@Injectable()
export class TeleService {
  private readonly sessions = new Map<string, Session>()
  private readonly signalBuffer = new Map<string, SignalMessage[]>()
  private readonly chatBuffer = new Map<string, ChatMessage[]>()
  private readonly cursorBuffer = new Map<string, CursorPosition[]>()

  createSession(hostId: string, hostName: string, studyUids: string[]): Session {
    const session: Session = {
      id: uuid().slice(0, 8),
      hostId,
      hostName,
      studyUids,
      status: 'waiting',
      createdAt: new Date(),
    }
    this.sessions.set(session.id, session)
    return session
  }

  joinSession(sessionId: string, guestId: string, guestName: string): Session {
    const session = this.sessions.get(sessionId)
    if (!session) throw new NotFoundException('Session not found')
    if (session.guestId) throw new ConflictException('Session already has a guest')
    session.guestId = guestId
    session.guestName = guestName
    session.status = 'connected'
    return session
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) throw new NotFoundException('Session not found')
    session.status = 'disconnected'
    this.signalBuffer.delete(sessionId)
    this.chatBuffer.delete(sessionId)
    this.cursorBuffer.delete(sessionId)
    return this.sessions.delete(sessionId)
  }

  storeSignal(sessionId: string, msg: SignalMessage): void {
    if (!this.signalBuffer.has(sessionId)) {
      this.signalBuffer.set(sessionId, [])
    }
    this.signalBuffer.get(sessionId)!.push(msg)
  }

  getPendingSignals(sessionId: string, forPeer: string): SignalMessage[] {
    const all = this.signalBuffer.get(sessionId) ?? []
    const filtered = all.filter(m => m.to === forPeer)
    this.signalBuffer.set(sessionId, all.filter(m => m.to !== forPeer))
    return filtered
  }

  addChatMessage(msg: Omit<ChatMessage, 'id'>): ChatMessage {
    const full: ChatMessage = { id: uuid().slice(0, 8), ...msg }
    if (!this.chatBuffer.has(msg.sessionId)) {
      this.chatBuffer.set(msg.sessionId, [])
    }
    this.chatBuffer.get(msg.sessionId)!.push(full)
    return full
  }

  getChatMessages(sessionId: string, since?: string): ChatMessage[] {
    const all = this.chatBuffer.get(sessionId) ?? []
    if (!since) return all.slice(-50)
    return all.filter(m => m.timestamp > since)
  }

  updateCursor(pos: CursorPosition): void {
    if (!this.cursorBuffer.has(pos.sessionId)) {
      this.cursorBuffer.set(pos.sessionId, [])
    }
    const list = this.cursorBuffer.get(pos.sessionId)!
    const idx = list.findIndex(c => c.userId === pos.userId)
    if (idx >= 0) list[idx] = pos
    else list.push(pos)
    if (list.length > 20) list.splice(0, list.length - 20)
  }

  getCursors(sessionId: string): CursorPosition[] {
    const now = Date.now()
    const all = this.cursorBuffer.get(sessionId) ?? []
    return all.filter(c => now - c.timestamp < 5000)
  }
}

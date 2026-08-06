// [G005 W1-1] 检查室占用 MSW handlers: /api/v1/occupancy/*
// 与后端 backend/src/modules/occupancy 返回结构一致 (rooms/queue/trends/status)
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

type RoomStatus = 'idle' | 'occupied' | 'disinfecting' | 'fault'

interface MockRoom {
  id: string
  roomNo: string
  status: RoomStatus
  currentPatient?: string
  examItem?: string
  startTime?: string
  expectedEnd?: string
}

const ROOM_NAMES = ['CT-01', 'CT-02', 'MR-01', 'MR-02', 'DR-01', 'DR-02', 'DR-03', 'MG-01', 'DSA-01', 'US-01']
const PATIENTS = [
  { name: '张志刚', item: '冠脉CTA' },
  { name: '李秀英', item: '头颅MR平扫' },
  { name: '王建国', item: '胸部DR正侧位' },
  { name: '赵晓敏', item: '腹部CT增强' },
  { name: '孙伟', item: '腰椎MR平扫' },
  { name: '吴婷', item: '乳腺钼靶' },
  { name: '郑丽', item: '胸部CT平扫' },
  { name: '钱伟明', item: '冠脉CTA' },
]

function iso(offsetMin: number): string {
  return new Date(Date.now() + offsetMin * 60000).toISOString()
}

function buildRooms(): MockRoom[] {
  return ROOM_NAMES.map((roomNo, i) => {
    if (i % 3 === 1) {
      const p = PATIENTS[i % PATIENTS.length]!
      return {
        id: `room-${i + 1}`,
        roomNo,
        status: 'occupied' as RoomStatus,
        currentPatient: p.name,
        examItem: p.item,
        startTime: iso(-40 - i * 7),
        expectedEnd: i % 2 === 0 ? iso(5) : iso(-20 - i * 5),
      }
    }
    if (i % 4 === 2) {
      return { id: `room-${i + 1}`, roomNo, status: 'disinfecting' as RoomStatus, startTime: iso(-6) }
    }
    if (i === 6) {
      return { id: `room-${i + 1}`, roomNo, status: 'fault' as RoomStatus }
    }
    return { id: `room-${i + 1}`, roomNo, status: 'idle' as RoomStatus }
  })
}

const state: { rooms: MockRoom[] } = { rooms: buildRooms() }

function toDto(r: MockRoom) {
  const now = Date.now()
  const overdue =
    r.status === 'occupied' && r.expectedEnd
      ? now - new Date(r.expectedEnd).getTime() > 15 * 60 * 1000
      : false
  return {
    id: r.id,
    roomNo: r.roomNo,
    status: r.status,
    currentPatient: r.currentPatient,
    examItem: r.examItem,
    startTime: r.startTime,
    expectedEnd: r.expectedEnd,
    overdue,
  }
}

export const occupancyHandlers = [
  http.get(`${API_BASE}/occupancy/rooms`, async () => {
    await delay(80)
    return HttpResponse.json(state.rooms.map(toDto))
  }),

  http.get(`${API_BASE}/occupancy/queue/:roomId`, async ({ params }) => {
    await delay(80)
    const roomId = params.roomId as string
    const room = state.rooms.find((r) => r.id === roomId)
    if (!room) return HttpResponse.json({ message: `Room ${roomId} not found` }, { status: 404 })
    const count = room.status === 'occupied' ? 3 + Math.abs(hash(roomId) % 6) : hash(roomId) % 4
    const queue = Array.from({ length: count }, (_, i) => {
      const p = PATIENTS[(hash(roomId) + i) % PATIENTS.length]!
      return {
        position: i + 1,
        patientName: p.name,
        examItem: p.item,
        estimatedWaitMin: (i + 1) * 15,
      }
    })
    return HttpResponse.json({ roomId, queue })
  }),

  http.get(`${API_BASE}/occupancy/trends`, async () => {
    await delay(80)
    const total = state.rooms.length
    const rand = mulberry32(daySeed())
    const points = Array.from({ length: 24 }, (_, i) => {
      const t = new Date(Date.now() - (23 - i) * 3600000)
      const occupied = Math.floor(rand() * (total + 1))
      return {
        time: `${String(t.getHours()).padStart(2, '0')}:00`,
        occupied,
        total,
        rate: Math.round((occupied / total) * 100),
      }
    })
    return HttpResponse.json(points)
  }),

  http.post(`${API_BASE}/occupancy/room/:roomId/status`, async ({ params, request }) => {
    await delay(100)
    const roomId = params.roomId as string
    const body = (await request.json()) as { status?: string }
    const valid = ['idle', 'occupied', 'disinfecting', 'fault']
    const room = state.rooms.find((r) => r.id === roomId)
    if (!room) return HttpResponse.json({ message: `Room ${roomId} not found` }, { status: 404 })
    if (!body.status || !valid.includes(body.status)) {
      return HttpResponse.json({ message: `Invalid status: ${body.status}` }, { status: 404 })
    }
    room.status = body.status as RoomStatus
    if (body.status === 'idle') {
      delete room.currentPatient
      delete room.examItem
      delete room.startTime
      delete room.expectedEnd
    }
    return HttpResponse.json(toDto(room))
  }),
]

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function daySeed(): number {
  const now = new Date()
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}

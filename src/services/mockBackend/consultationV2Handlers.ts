// [G005 Wave 7C v3.0.6.11-101] /api/v1/consultation-v2 MSW handlers
// 对齐后端 consultation-v2.module + consultationV2Api (委员会会诊: 会诊室/发言时序/投票汇总/结论签名/记录导出)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/consultation-v2`

type RoomStatus = 'open' | 'in_progress' | 'voting' | 'concluded' | 'cancelled'
type VoteOpinion = 'approve' | 'reject' | 'modify'

interface RoomMember { id: string; name: string; title: string; department: string; role: 'chair' | 'member'; status: 'pending' | 'joined' | 'absent'; joinedAt?: string }
interface RoomMessage { id: string; seq: number; roomId: string; memberId: string; memberName: string; role: 'chair' | 'member'; content: string; at: string }
interface RoomVote { id: string; roomId: string; memberId: string; memberName: string; opinion: VoteOpinion; comment: string; at: string }
interface SignatureEntry { memberId: string; name: string; title: string; signedAt: string }

interface Room {
  id: string
  reportId: string
  reportTitle: string
  patientName: string
  modality: string
  status: RoomStatus
  members: RoomMember[]
  messages: RoomMessage[]
  votes: RoomVote[]
  conclusion?: { finalOpinion: string; signatures: SignatureEntry[]; generatedBy: string; generatedAt: string }
  createdBy: string
  createdAt: string
}

const MEMBER_POOL: Array<{ id: string; name: string; title: string; department: string }> = [
  { id: 'm-001', name: '张主任', title: '主任医师', department: '放射科' },
  { id: 'm-002', name: '李医生', title: '副主任医师', department: '放射科' },
  { id: 'm-003', name: '王医生', title: '主治医师', department: '放射科' },
  { id: 'm-004', name: '赵主任', title: '主任医师', department: '神经外科' },
  { id: 'm-005', name: '陈主任', title: '主任医师', department: '胸外科' },
  { id: 'm-006', name: '刘医生', title: '主治医师', department: '肿瘤科' },
]

const ROOMS: Room[] = [
  {
    id: 'cons-001', reportId: 'RPT-A-0030', reportTitle: '颅内占位疑难病例会诊', patientName: '王德发', modality: 'CT',
    status: 'in_progress', createdBy: '张主任', createdAt: '2026-08-12T09:00:00.000Z',
    members: [
      { id: 'm-001', name: '张主任', title: '主任医师', department: '放射科', role: 'chair', status: 'joined', joinedAt: '2026-08-12T09:00:00.000Z' },
      { id: 'm-002', name: '李医生', title: '副主任医师', department: '放射科', role: 'member', status: 'joined', joinedAt: '2026-08-12T09:02:00.000Z' },
      { id: 'm-003', name: '王医生', title: '主治医师', department: '放射科', role: 'member', status: 'joined', joinedAt: '2026-08-12T09:05:00.000Z' },
      { id: 'm-004', name: '赵主任', title: '主任医师', department: '神经外科', role: 'member', status: 'pending' },
    ],
    messages: [
      { id: 'msg-001', seq: 1, roomId: 'cons-001', memberId: 'm-001', memberName: '张主任', role: 'chair', content: '各位专家好, 今天讨论王德发颅内占位的诊断与处理方案。', at: '2026-08-12T09:01:00.000Z' },
      { id: 'msg-002', seq: 2, roomId: 'cons-001', memberId: 'm-002', memberName: '李医生', role: 'member', content: '影像上看右侧基底节区占位, 强化明显, 建议神经外科评估手术。', at: '2026-08-12T09:03:00.000Z' },
      { id: 'msg-003', seq: 3, roomId: 'cons-001', memberId: 'm-003', memberName: '王医生', role: 'member', content: '同意, 建议加做 MR 增强进一步明确边界。', at: '2026-08-12T09:06:00.000Z' },
    ],
    votes: [],
  },
  {
    id: 'cons-002', reportId: 'RPT-A-0040', reportTitle: '肺占位 MDT 讨论', patientName: '张建国', modality: 'CT',
    status: 'concluded', createdBy: '张主任', createdAt: '2026-08-10T14:00:00.000Z',
    members: [
      { id: 'm-001', name: '张主任', title: '主任医师', department: '放射科', role: 'chair', status: 'joined', joinedAt: '2026-08-10T14:00:00.000Z' },
      { id: 'm-005', name: '陈主任', title: '主任医师', department: '胸外科', role: 'member', status: 'joined', joinedAt: '2026-08-10T14:01:00.000Z' },
      { id: 'm-006', name: '刘医生', title: '主治医师', department: '肿瘤科', role: 'member', status: 'joined', joinedAt: '2026-08-10T14:02:00.000Z' },
    ],
    messages: [
      { id: 'msg-010', seq: 1, roomId: 'cons-002', memberId: 'm-001', memberName: '张主任', role: 'chair', content: '开始讨论张建国肺占位病例。', at: '2026-08-10T14:00:30.000Z' },
      { id: 'msg-011', seq: 2, roomId: 'cons-002', memberId: 'm-005', memberName: '陈主任', role: 'member', content: '磨玻璃结节 8mm, 建议 6 个月随访。', at: '2026-08-10T14:02:00.000Z' },
    ],
    votes: [
      { id: 'vote-001', roomId: 'cons-002', memberId: 'm-001', memberName: '张主任', opinion: 'approve', comment: '同意随访方案', at: '2026-08-10T14:20:00.000Z' },
      { id: 'vote-002', roomId: 'cons-002', memberId: 'm-005', memberName: '陈主任', opinion: 'approve', comment: '同意', at: '2026-08-10T14:22:00.000Z' },
      { id: 'vote-003', roomId: 'cons-002', memberId: 'm-006', memberName: '刘医生', opinion: 'modify', comment: '建议同步肿瘤科门诊', at: '2026-08-10T14:25:00.000Z' },
    ],
    conclusion: {
      finalOpinion: '综合意见: 右肺上叶 8mm 磨玻璃结节, 建议 6 个月 CT 随访; 同步肿瘤科门诊评估。',
      signatures: [
        { memberId: 'm-001', name: '张主任', title: '主任医师', signedAt: '2026-08-10T14:30:00.000Z' },
        { memberId: 'm-005', name: '陈主任', title: '主任医师', signedAt: '2026-08-10T14:30:00.000Z' },
      ],
      generatedBy: '张主任',
      generatedAt: '2026-08-10T14:30:00.000Z',
    },
  },
]

let rooms: Room[] = [...ROOMS]
let roomSeq = 100
let msgSeq = 100
let voteSeq = 100

function makeRoom(input: Record<string, unknown>): Room {
  const now = new Date().toISOString()
  const memberCount = Math.max(2, Math.min(8, Number(input.memberCount ?? 3) || 3))
  const members: RoomMember[] = MEMBER_POOL.slice(0, memberCount).map((m, i) => ({
    id: m.id, name: m.name, title: m.title, department: m.department,
    role: i === 0 ? 'chair' as const : 'member' as const,
    status: 'pending' as const,
  }))
  return {
    id: `cons-${roomSeq++}`,
    reportId: String(input.reportId ?? 'RPT-UNKNOWN'),
    reportTitle: String(input.reportTitle ?? '委员会会诊'),
    patientName: String(input.patientName ?? '演示患者'),
    modality: String(input.modality ?? 'CT'),
    status: 'open',
    members,
    messages: [],
    votes: [],
    createdBy: String(input.createdBy ?? 'u-001'),
    createdAt: now,
  }
}

export const consultationV2Handlers = [
  http.post(`${API}/rooms`, async ({ request }) => {
    await delay(60)
    const input = (await request.json()) as Record<string, unknown>
    const room = makeRoom(input ?? {})
    rooms.unshift(room)
    return HttpResponse.json({ success: true, data: room })
  }),

  http.get(`${API}/rooms`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: rooms })
  }),

  http.get(`${API}/rooms/:id`, async ({ params }) => {
    await delay(40)
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: room })
  }),

  http.post(`${API}/rooms/:id/start`, async ({ params }) => {
    await delay(50)
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    room.status = 'in_progress'
    for (const m of room.members) {
      if (m.status === 'pending') m.status = 'joined'
      m.joinedAt = m.joinedAt ?? new Date().toISOString()
    }
    return HttpResponse.json({ success: true, data: room })
  }),

  http.post(`${API}/rooms/:id/messages`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { memberId?: string; content?: string }
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    const member = room.members.find((m) => m.id === body?.memberId)
    const now = new Date().toISOString()
    room.messages = [...room.messages, {
      id: `msg-${msgSeq++}`,
      seq: room.messages.length + 1,
      roomId: room.id,
      memberId: member?.id ?? 'm-001',
      memberName: member?.name ?? '主持人',
      role: member?.role ?? 'chair',
      content: String(body?.content ?? ''),
      at: now,
    }]
    return HttpResponse.json({ success: true, data: room })
  }),

  http.get(`${API}/rooms/:id/messages`, async ({ params }) => {
    await delay(40)
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: room.messages })
  }),

  http.post(`${API}/rooms/:id/votes`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { memberId?: string; opinion?: VoteOpinion; comment?: string }
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    const member = room.members.find((m) => m.id === body?.memberId) ?? room.members[0]!
    room.status = 'voting'
    room.votes = [...room.votes, {
      id: `vote-${voteSeq++}`,
      roomId: room.id,
      memberId: member.id,
      memberName: member.name,
      opinion: (body?.opinion ?? 'approve') as VoteOpinion,
      comment: String(body?.comment ?? ''),
      at: new Date().toISOString(),
    }]
    return HttpResponse.json({ success: true, data: room })
  }),

  http.get(`${API}/rooms/:id/summary`, async ({ params }) => {
    await delay(40)
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    const totalMembers = room.members.length
    const votedCount = room.votes.length
    const approveCount = room.votes.filter((v) => v.opinion === 'approve').length
    const rejectCount = room.votes.filter((v) => v.opinion === 'reject').length
    const modifyCount = room.votes.filter((v) => v.opinion === 'modify').length
    const pendingNames = room.members.filter((m) => !room.votes.some((v) => v.memberId === m.id)).map((m) => m.name)
    return HttpResponse.json({
      success: true,
      data: {
        totalMembers,
        votedCount,
        approveCount,
        rejectCount,
        modifyCount,
        pendingMembers: pendingNames,
        approveRate: Math.round(approveCount / Math.max(1, votedCount) * 1000) / 10,
        opinionLabel: { approve: '同意', reject: '不同意', modify: '建议修改' },
      },
    })
  }),

  http.post(`${API}/rooms/:id/conclude`, async ({ params, request }) => {
    await delay(60)
    const body = (await request.json()) as { finalOpinion?: string; generatedBy?: string }
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    room.status = 'concluded'
    room.conclusion = {
      finalOpinion: String(body?.finalOpinion ?? '综合多数意见形成会诊结论。'),
      signatures: room.members.filter((m) => m.status === 'joined').map((m) => ({ memberId: m.id, name: m.name, title: m.title, signedAt: now })),
      generatedBy: String(body?.generatedBy ?? room.createdBy),
      generatedAt: now,
    }
    return HttpResponse.json({ success: true, data: room })
  }),

  http.get(`${API}/rooms/:id/export`, async ({ params }) => {
    await delay(50)
    const room = rooms.find((r) => r.id === params.id)
    if (!room) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `room ${params.id} not found` } }, { status: 404 })
    const lines = [
      `会诊记录: ${room.reportTitle}`,
      `患者: ${room.patientName} (${room.modality})`,
      `状态: ${room.status}`,
      `主持人: ${room.members.find((m) => m.role === 'chair')?.name ?? '-'}`,
      '',
      '发言记录:',
      ...room.messages.map((msg) => `${msg.seq}. [${msg.memberName}] ${msg.content}`),
      '',
      '投票结果:',
      ...room.votes.map((v) => `${v.memberName}: ${v.opinion} ${v.comment}`),
      '',
      `结论: ${room.conclusion?.finalOpinion ?? '无'}`,
    ]
    return HttpResponse.json({
      success: true,
      data: {
        roomId: room.id,
        reportId: room.reportId,
        reportTitle: room.reportTitle,
        patientName: room.patientName,
        modality: room.modality,
        status: room.status,
        exportedAt: new Date().toISOString(),
        content: lines.join('\n'),
      },
    })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const byStatus: Record<RoomStatus, number> = { open: 0, in_progress: 0, voting: 0, concluded: 0, cancelled: 0 }
    for (const r of rooms) byStatus[r.status] += 1
    return HttpResponse.json({
      success: true,
      data: {
        totalRooms: rooms.length,
        byStatus,
        totalMessages: rooms.reduce((s, r) => s + r.messages.length, 0),
        totalVotes: rooms.reduce((s, r) => s + r.votes.length, 0),
        concludedCount: byStatus.concluded,
        avgMembersPerRoom: Math.round(rooms.reduce((s, r) => s + r.members.length, 0) / Math.max(1, rooms.length) * 10) / 10,
        avgMessagesPerRoom: Math.round(rooms.reduce((s, r) => s + r.messages.length, 0) / Math.max(1, rooms.length) * 10) / 10,
      },
    })
  }),
]

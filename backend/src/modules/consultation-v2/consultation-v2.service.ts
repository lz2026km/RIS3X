/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (consultation-v2) - 委员会会诊 V2 (F6)
 *
 * 孤儿模块 (纯内存 + seed 回退, 无 DB 依赖, 可无 DB 启动):
 *   1. 会诊室: 多人会话 (成员/角色/状态), 成员按 reportId 确定性选取 (无随机)
 *   2. 发言: 时序流 (seq 递增, 按 seq 有序), 成员校验
 *   3. 意见汇总: 投票 (通过 approve / 驳回 reject / 修改 modify) + 统计 (同意率等)
 *   4. 会诊结论: 最终意见 + 与会成员签名列表 + 会诊记录导出 (markdown)
 *   5. 统计: 会诊室状态分布 / 发言数 / 投票数 / 已结论数
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { hashString } from '../../common/utils/deterministic-hash'

// ================= 类型定义 =================

export type RoomMemberRole = 'chair' | 'member'
export type MemberStatus = 'pending' | 'joined' | 'absent'
export type RoomStatus = 'open' | 'in_progress' | 'voting' | 'concluded' | 'cancelled'
export type VoteOpinion = 'approve' | 'reject' | 'modify'

export interface RoomMember {
  id: string
  name: string
  title: string
  department: string
  role: RoomMemberRole
  status: MemberStatus
  joinedAt?: string
}

export interface RoomMessage {
  id: string
  seq: number
  roomId: string
  memberId: string
  memberName: string
  role: RoomMemberRole
  content: string
  at: string
}

export interface RoomVote {
  id: string
  roomId: string
  memberId: string
  memberName: string
  opinion: VoteOpinion
  comment: string
  at: string
}

export interface SignatureEntry {
  memberId: string
  name: string
  title: string
  signedAt: string
}

export interface RoomConclusion {
  finalOpinion: string
  signatures: SignatureEntry[]
  generatedBy: string
  generatedAt: string
}

export interface ConsultationRoomV2 {
  id: string
  reportId: string
  reportTitle: string
  patientName: string
  modality: string
  status: RoomStatus
  members: RoomMember[]
  messages: RoomMessage[]
  votes: RoomVote[]
  conclusion?: RoomConclusion
  createdBy: string
  createdAt: string
}

export interface VoteSummary {
  totalMembers: number
  votedCount: number
  approveCount: number
  rejectCount: number
  modifyCount: number
  pendingMembers: string[]
  approveRate: number
  opinionLabel: Record<VoteOpinion, string>
}

export interface ExportRecord {
  roomId: string
  reportId: string
  reportTitle: string
  patientName: string
  modality: string
  status: RoomStatus
  exportedAt: string
  content: string
}

export interface ConsultationV2Stats {
  totalRooms: number
  byStatus: Record<RoomStatus, number>
  totalMessages: number
  totalVotes: number
  concludedCount: number
  avgMembersPerRoom: number
  avgMessagesPerRoom: number
}

const MEMBER_POOL = [
  { id: 'D001', name: '张明远', title: '主任医师', department: '放射科' },
  { id: 'D002', name: '李慧敏', title: '副主任医师', department: '心内科' },
  { id: 'D003', name: '王海涛', title: '主任医师', department: '神经外科' },
  { id: 'D004', name: '陈雅芝', title: '主治医师', department: '肿瘤科' },
  { id: 'D005', name: '刘建国', title: '主任医师', department: '胸外科' },
  { id: 'D006', name: '赵秀兰', title: '副主任医师', department: '呼吸内科' },
  { id: 'D007', name: '孙志强', title: '主治医师', department: '骨科' },
  { id: 'D008', name: '周丽华', title: '副主任医师', department: '超声科' },
]

const OPINION_LABEL: Record<VoteOpinion, string> = {
  approve: '通过',
  reject: '驳回',
  modify: '修改',
}

const ROOM_STATUS_ORDER: RoomStatus[] = ['open', 'in_progress', 'voting', 'concluded', 'cancelled']

const now = () => new Date().toISOString()

function pickMembers(reportId: string, count: number): RoomMember[] {
  const h = hashString(`room:${reportId}`)
  const picked: RoomMember[] = []
  for (let i = 0; i < count; i += 1) {
    const poolIndex = (h + i * 3) % MEMBER_POOL.length
    const p = MEMBER_POOL[poolIndex]!
    if (!picked.some((m) => m.id === p.id)) {
      picked.push({
        id: p.id,
        name: p.name,
        title: p.title,
        department: p.department,
        role: picked.length === 0 ? 'chair' : 'member',
        status: 'joined',
      })
    }
  }
  return picked
}

// ================= 种子数据 (seed 回退) =================

function seedRooms(): ConsultationRoomV2[] {
  const base = Date.now()
  const rooms: ConsultationRoomV2[] = []
  const room1: ConsultationRoomV2 = {
    id: 'CV2-SEED-001',
    reportId: 'RPT-SEED-001',
    reportTitle: '胸部CT: 主动脉夹层可能',
    patientName: '张三',
    modality: 'CT',
    status: 'voting',
    members: pickMembers('RPT-SEED-001', 5),
    messages: [
      { id: 'CV2-SEED-001-M1', seq: 1, roomId: 'CV2-SEED-001', memberId: 'D001', memberName: '张明远', role: 'chair', content: 'CTA 见内膜片及真假腔, 支持主动脉夹层诊断, 请各位委员发表意见。', at: new Date(base - 3 * 3600_000).toISOString() },
      { id: 'CV2-SEED-001-M2', seq: 2, roomId: 'CV2-SEED-001', memberId: 'D002', memberName: '李慧敏', role: 'member', content: '同意夹层诊断, 建议急诊超声评估升主动脉受累范围。', at: new Date(base - 2.5 * 3600_000).toISOString() },
      { id: 'CV2-SEED-001-M3', seq: 3, roomId: 'CV2-SEED-001', memberId: 'D005', memberName: '刘建国', role: 'member', content: '支持, 建议心外科会诊评估手术时机。', at: new Date(base - 2 * 3600_000).toISOString() },
    ],
    votes: [
      { id: 'CV2-SEED-001-V1', roomId: 'CV2-SEED-001', memberId: 'D001', memberName: '张明远', opinion: 'approve', comment: 'CTA 表现典型, 同意诊断。', at: new Date(base - 1.8 * 3600_000).toISOString() },
      { id: 'CV2-SEED-001-V2', roomId: 'CV2-SEED-001', memberId: 'D002', memberName: '李慧敏', opinion: 'modify', comment: '建议补充升主动脉受累范围的表述。', at: new Date(base - 1.2 * 3600_000).toISOString() },
    ],
    createdBy: '张明远',
    createdAt: new Date(base - 4 * 3600_000).toISOString(),
  }
  rooms.push(room1)

  const members2 = pickMembers('RPT-SEED-002', 4)
  const room2: ConsultationRoomV2 = {
    id: 'CV2-SEED-002',
    reportId: 'RPT-SEED-002',
    reportTitle: '头颅MR: 基底节区异常信号',
    patientName: '李四',
    modality: 'MR',
    status: 'concluded',
    members: members2,
    messages: [
      { id: 'CV2-SEED-002-M1', seq: 1, roomId: 'CV2-SEED-002', memberId: members2[0]!.id, memberName: members2[0]!.name, role: members2[0]!.role, content: '基底节区异常信号, 请讨论定性。', at: new Date(base - 26 * 3600_000).toISOString() },
      { id: 'CV2-SEED-002-M2', seq: 2, roomId: 'CV2-SEED-002', memberId: members2[1]!.id, memberName: members2[1]!.name, role: members2[1]!.role, content: '考虑陈旧性腔隙性脑梗死可能, DWI 未见受限。', at: new Date(base - 25 * 3600_000).toISOString() },
      { id: 'CV2-SEED-002-M3', seq: 3, roomId: 'CV2-SEED-002', memberId: members2[2]!.id, memberName: members2[2]!.name, role: members2[2]!.role, content: '同意, 建议随访复查。', at: new Date(base - 24 * 3600_000).toISOString() },
    ],
    votes: [
      { id: 'CV2-SEED-002-V1', roomId: 'CV2-SEED-002', memberId: members2[0]!.id, memberName: members2[0]!.name, opinion: 'approve', comment: '考虑陈旧性腔梗。', at: new Date(base - 23.5 * 3600_000).toISOString() },
      { id: 'CV2-SEED-002-V2', roomId: 'CV2-SEED-002', memberId: members2[1]!.id, memberName: members2[1]!.name, opinion: 'approve', comment: '同意, 陈旧性病变可能性大。', at: new Date(base - 23.2 * 3600_000).toISOString() },
      { id: 'CV2-SEED-002-V3', roomId: 'CV2-SEED-002', memberId: members2[2]!.id, memberName: members2[2]!.name, opinion: 'approve', comment: '同意, 暂不考虑占位性病变。', at: new Date(base - 23 * 3600_000).toISOString() },
    ],
    conclusion: {
      finalOpinion: '委员会一致同意: 基底节区异常信号考虑陈旧性腔隙性脑梗死, 建议 6 个月随访复查头颅 MR。',
      signatures: members2.map((m) => ({ memberId: m.id, name: m.name, title: m.title, signedAt: new Date(base - 22.5 * 3600_000).toISOString() })),
      generatedBy: members2[0]!.name,
      generatedAt: new Date(base - 22.5 * 3600_000).toISOString(),
    },
    createdBy: members2[0]!.name,
    createdAt: new Date(base - 27 * 3600_000).toISOString(),
  }
  rooms.push(room2)
  return rooms
}

@Injectable()
export class ConsultationV2Service {
  private rooms: ConsultationRoomV2[] = []
  private seq = 0

  constructor() {
    this.rooms = seedRooms()
  }

  private nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${Date.now().toString(36)}-${this.seq}`
  }

  // ================= 会诊室 =================

  /** POST /consultation-v2/rooms — 创建会诊室 (成员确定性选取, 可指定) */
  createRoom(input: {
    reportId: string
    reportTitle?: string
    patientName?: string
    modality?: string
    createdBy?: string
    memberCount?: number
    memberIds?: string[]
  }): ConsultationRoomV2 {
    const reportId = (input.reportId ?? '').trim()
    if (!reportId) throw new BadRequestException('reportId 不能为空')
    let members: RoomMember[]
    if (input.memberIds && input.memberIds.length > 0) {
      members = input.memberIds.map((mid, i) => {
        const p = MEMBER_POOL.find((m) => m.id === mid)
        if (!p) throw new BadRequestException(`成员 ${mid} 不在成员池中`)
        return {
          id: p.id,
          name: p.name,
          title: p.title,
          department: p.department,
          role: i === 0 ? 'chair' : 'member',
          status: 'joined',
        }
      })
    } else {
      const count = Math.min(6, Math.max(3, input.memberCount ?? 3 + (hashString(reportId) % 3)))
      members = pickMembers(reportId, count)
    }
    const room: ConsultationRoomV2 = {
      id: this.nextId('CV2'),
      reportId,
      reportTitle: input.reportTitle?.trim() || reportId,
      patientName: input.patientName ?? '未知患者',
      modality: input.modality ?? 'CT',
      status: 'open',
      members,
      messages: [],
      votes: [],
      createdBy: input.createdBy ?? 'system',
      createdAt: now(),
    }
    this.rooms.unshift(room)
    return this.cloneRoom(room)
  }

  /** GET /consultation-v2/rooms — 会诊室列表 */
  listRooms(): ConsultationRoomV2[] {
    return this.rooms.map((r) => this.cloneRoom(r))
  }

  /** GET /consultation-v2/rooms/:id — 会诊室详情 */
  getRoom(id: string): ConsultationRoomV2 {
    return this.cloneRoom(this.findRoom(id))
  }

  /** POST /consultation-v2/rooms/:id/start — 开始会诊 (open → in_progress) */
  startRoom(id: string): ConsultationRoomV2 {
    const room = this.findRoom(id)
    if (room.status !== 'open') throw new BadRequestException(`当前状态 ${room.status} 不可开始`)
    room.status = 'in_progress'
    for (const m of room.members) {
      if (m.status === 'pending') {
        m.status = 'joined'
        m.joinedAt = now()
      }
    }
    return this.cloneRoom(room)
  }

  // ================= 发言 (时序) =================

  /** POST /consultation-v2/rooms/:id/messages — 发言 (seq 时序递增) */
  sendMessage(id: string, body: { memberId: string; content: string }): ConsultationRoomV2 {
    const room = this.findRoom(id)
    if (room.status === 'concluded' || room.status === 'cancelled') {
      throw new BadRequestException(`会诊室已${room.status === 'concluded' ? '结论' : '取消'}, 不可发言`)
    }
    const member = room.members.find((m) => m.id === body.memberId)
    if (!member) throw new NotFoundException(`成员 ${body.memberId} 不在会诊室中`)
    const content = (body.content ?? '').trim()
    if (!content) throw new BadRequestException('发言内容不能为空')
    const nextSeq = room.messages.reduce((max, m) => Math.max(max, m.seq), 0) + 1
    room.messages.push({
      id: this.nextId('MSG'),
      seq: nextSeq,
      roomId: room.id,
      memberId: member.id,
      memberName: member.name,
      role: member.role,
      content,
      at: now(),
    })
    if (room.status === 'open') room.status = 'in_progress'
    return this.cloneRoom(room)
  }

  /** GET /consultation-v2/rooms/:id/messages — 发言流 (按 seq 升序) */
  listMessages(id: string): RoomMessage[] {
    const room = this.findRoom(id)
    return [...room.messages].sort((a, b) => a.seq - b.seq).map((m) => ({ ...m }))
  }

  // ================= 投票 / 意见汇总 =================

  /** POST /consultation-v2/rooms/:id/votes — 委员投票 (通过/驳回/修改) */
  vote(id: string, body: { memberId: string; opinion: VoteOpinion; comment?: string }): ConsultationRoomV2 {
    const room = this.findRoom(id)
    if (room.status === 'concluded') throw new BadRequestException('会诊已结论, 不可投票')
    if (room.status === 'cancelled') throw new BadRequestException('会诊已取消, 不可投票')
    const member = room.members.find((m) => m.id === body.memberId)
    if (!member) throw new NotFoundException(`成员 ${body.memberId} 不在会诊室中`)
    const existed = room.votes.find((v) => v.memberId === body.memberId)
    if (existed) existed.opinion = body.opinion
    if (existed) existed.comment = body.comment ?? ''
    if (existed) existed.at = now()
    if (!existed) {
      room.votes.push({
        id: this.nextId('VOTE'),
        roomId: room.id,
        memberId: member.id,
        memberName: member.name,
        opinion: body.opinion,
        comment: body.comment ?? '',
        at: now(),
      })
    }
    if (room.status === 'open' || room.status === 'in_progress') room.status = 'voting'
    return this.cloneRoom(room)
  }

  /** GET /consultation-v2/rooms/:id/summary — 投票统计 */
  voteSummary(id: string): VoteSummary {
    const room = this.findRoom(id)
    const voted = room.votes
    const approveCount = voted.filter((v) => v.opinion === 'approve').length
    const rejectCount = voted.filter((v) => v.opinion === 'reject').length
    const modifyCount = voted.filter((v) => v.opinion === 'modify').length
    return {
      totalMembers: room.members.length,
      votedCount: voted.length,
      approveCount,
      rejectCount,
      modifyCount,
      pendingMembers: room.members.filter((m) => !voted.some((v) => v.memberId === m.id)).map((m) => m.name),
      approveRate: voted.length > 0 ? Math.round((approveCount / voted.length) * 100) : 0,
      opinionLabel: { ...OPINION_LABEL },
    }
  }

  // ================= 结论生成 / 导出 =================

  /** POST /consultation-v2/rooms/:id/conclude — 生成会诊结论 (最终意见 + 签名列表) */
  conclude(id: string, body: { finalOpinion?: string; generatedBy?: string }): ConsultationRoomV2 {
    const room = this.findRoom(id)
    if (room.status === 'concluded') throw new BadRequestException('会诊已结论')
    if (room.status === 'cancelled') throw new BadRequestException('会诊已取消')
    if (room.votes.length === 0) throw new BadRequestException('至少需要 1 位委员投票后才能生成结论')
    const finalOpinion = (body.finalOpinion ?? '').trim()
      || this.autoFinalOpinion(room)
    if (!finalOpinion) throw new BadRequestException('finalOpinion 不能为空 (无法自动归纳)')
    const votedMembers = room.votes
      .map((v) => room.members.find((m) => m.id === v.memberId))
      .filter((m): m is RoomMember => m !== undefined)
    const signatures: SignatureEntry[] = votedMembers.map((m) => ({
      memberId: m.id,
      name: m.name,
      title: m.title,
      signedAt: now(),
    }))
    room.conclusion = {
      finalOpinion,
      signatures,
      generatedBy: body.generatedBy?.trim() || room.createdBy,
      generatedAt: now(),
    }
    room.status = 'concluded'
    return this.cloneRoom(room)
  }

  private autoFinalOpinion(room: ConsultationRoomV2): string {
    const agree = room.votes.filter((v) => v.opinion === 'approve').length
    if (agree === room.votes.length && agree > 0) {
      return `委员会一致通过: 经 ${room.votes.length} 位委员投票一致同意 (通过), 结论详见会诊记录。`
    }
    if (agree >= room.votes.length / 2) {
      return `委员会多数通过 (${agree}/${room.votes.length}): 结论按多数意见形成, 详见会诊记录。`
    }
    return `委员会未达成多数一致 (通过 ${agree}/${room.votes.length}), 结论待进一步讨论。`
  }

  /** GET /consultation-v2/rooms/:id/export — 会诊记录导出 (markdown) */
  exportRecord(id: string): ExportRecord {
    const room = this.findRoom(id)
    const lines: string[] = [
      `# 委员会会诊记录`,
      ``,
      `- 会诊编号: ${room.id}`,
      `- 报告编号: ${room.reportId}`,
      `- 报告标题: ${room.reportTitle}`,
      `- 患者: ${room.patientName} (${room.modality})`,
      `- 会诊状态: ${room.status}`,
      `- 发起人: ${room.createdBy}`,
      `- 创建时间: ${room.createdAt}`,
      ``,
      `## 与会成员`,
      ``,
      room.members.map((m) => `- ${m.name} (${m.title}, ${m.department}, ${m.role === 'chair' ? '主持' : '委员'})`).join('\n'),
      ``,
      `## 发言记录 (${room.messages.length})`,
      ``,
      [...room.messages]
        .sort((a, b) => a.seq - b.seq)
        .map((m) => `[${m.seq}] ${m.memberName} (${m.role === 'chair' ? '主持' : '委员'}) ${m.at}\n> ${m.content}`)
        .join('\n\n'),
      ``,
      `## 投票汇总 (${room.votes.length})`,
      ``,
      room.votes.length > 0
        ? room.votes.map((v) => `- ${v.memberName}: ${OPINION_LABEL[v.opinion]}${v.comment ? ` — ${v.comment}` : ''}`).join('\n')
        : '- 尚未投票',
      ``,
      `## 会诊结论`,
      ``,
      room.conclusion
        ? [
            `最终意见: ${room.conclusion.finalOpinion}`,
            ``,
            `签名委员 (${room.conclusion.signatures.length}):`,
            ...room.conclusion.signatures.map((s) => `- ${s.name} (${s.title}) — ${s.signedAt}`),
            ``,
            `生成人: ${room.conclusion.generatedBy} — ${room.conclusion.generatedAt}`,
          ].join('\n')
        : '- 尚未生成结论',
    ]
    return {
      roomId: room.id,
      reportId: room.reportId,
      reportTitle: room.reportTitle,
      patientName: room.patientName,
      modality: room.modality,
      status: room.status,
      exportedAt: now(),
      content: lines.join('\n'),
    }
  }

  /** GET /consultation-v2/stats — 会诊统计 */
  getStats(): ConsultationV2Stats {
    const rooms = this.rooms
    const byStatus: Record<RoomStatus, number> = {
      open: 0,
      in_progress: 0,
      voting: 0,
      concluded: 0,
      cancelled: 0,
    }
    let totalMessages = 0
    let totalVotes = 0
    for (const r of rooms) {
      byStatus[r.status] += 1
      totalMessages += r.messages.length
      totalVotes += r.votes.length
    }
    return {
      totalRooms: rooms.length,
      byStatus,
      totalMessages,
      totalVotes,
      concludedCount: rooms.filter((r) => r.status === 'concluded').length,
      avgMembersPerRoom: rooms.length ? Math.round((rooms.reduce((a, r) => a + r.members.length, 0) / rooms.length) * 10) / 10 : 0,
      avgMessagesPerRoom: rooms.length ? Math.round((totalMessages / rooms.length) * 10) / 10 : 0,
    }
  }

  private findRoom(id: string): ConsultationRoomV2 {
    const room = this.rooms.find((r) => r.id === id)
    if (!room) throw new NotFoundException(`会诊室 ${id} 不存在`)
    return room
  }

  private cloneRoom(r: ConsultationRoomV2): ConsultationRoomV2 {
    return {
      ...r,
      members: r.members.map((m) => ({ ...m })),
      messages: r.messages.map((m) => ({ ...m })),
      votes: r.votes.map((v) => ({ ...v })),
      conclusion: r.conclusion ? { ...r.conclusion, signatures: r.conclusion.signatures.map((s) => ({ ...s })) } : undefined,
    }
  }
}

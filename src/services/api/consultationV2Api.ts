import { api, invalidateApiCache } from './client'

// [v3.0.6.11-101 Wave 7C F6] 委员会会诊 V2 (consultation-v2) API
// 后端: backend/src/modules/consultation-v2/ (孤儿模块: 会诊室/发言时序/投票汇总/结论签名/记录导出)

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

export interface CreateRoomInput {
  reportId: string
  reportTitle?: string
  patientName?: string
  modality?: string
  createdBy?: string
  memberCount?: number
  memberIds?: string[]
}

const PREFIX = '/consultation-v2'

export const consultationV2Api = {
  createRoom: async (input: CreateRoomInput) => {
    const res = await api.post<ConsultationRoomV2>(`${PREFIX}/rooms`, input)
    await invalidateApiCache(`${PREFIX}/rooms`)
    return res
  },

  listRooms: () => api.get<ConsultationRoomV2[]>(`${PREFIX}/rooms`),

  getRoom: (id: string) => api.get<ConsultationRoomV2>(`${PREFIX}/rooms/${id}`),

  startRoom: async (id: string) => {
    const res = await api.post<ConsultationRoomV2>(`${PREFIX}/rooms/${id}/start`)
    await invalidateApiCache(`${PREFIX}/rooms`)
    return res
  },

  sendMessage: async (id: string, body: { memberId: string; content: string }) => {
    const res = await api.post<ConsultationRoomV2>(`${PREFIX}/rooms/${id}/messages`, body)
    await invalidateApiCache(`${PREFIX}/rooms`)
    return res
  },

  listMessages: (id: string) => api.get<RoomMessage[]>(`${PREFIX}/rooms/${id}/messages`),

  vote: async (id: string, body: { memberId: string; opinion: VoteOpinion; comment?: string }) => {
    const res = await api.post<ConsultationRoomV2>(`${PREFIX}/rooms/${id}/votes`, body)
    await invalidateApiCache(`${PREFIX}/rooms`)
    return res
  },

  voteSummary: (id: string) => api.get<VoteSummary>(`${PREFIX}/rooms/${id}/summary`),

  conclude: async (id: string, body: { finalOpinion?: string; generatedBy?: string }) => {
    const res = await api.post<ConsultationRoomV2>(`${PREFIX}/rooms/${id}/conclude`, body)
    await invalidateApiCache(`${PREFIX}/rooms`)
    return res
  },

  exportRecord: (id: string) => api.get<ExportRecord>(`${PREFIX}/rooms/${id}/export`),

  getStats: () => api.get<ConsultationV2Stats>(`${PREFIX}/stats`),
}

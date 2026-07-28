import { api, invalidateApiCache } from './client'

// Tele (远程会诊) API
// Backend: /tele/*

export interface TeleSession {
  id: string
  title: string
  patientName: string
  patientId: string
  studyId: string
  modality: string
  hostDoctorId: string
  hostDoctorName: string
  participants: TeleParticipant[]
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled'
  startedAt?: string
  endedAt?: string
  createdAt: string
}

export interface TeleParticipant {
  id: string
  doctorId: string
  doctorName: string
  department: string
  role: 'host' | 'guest' | 'observer'
  joinedAt?: string
  leftAt?: string
}

export interface CreateTeleSessionDto {
  title: string
  patientId: string
  studyId: string
  participantIds: string[]
}

export interface TeleMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'annotation' | 'measurement'
  createdAt: string
}

export interface TeleStats {
  totalSessions: number
  completedSessions: number
  avgDurationMinutes: number
  activeSessions: number
  departmentDistribution: { department: string; count: number }[]
}

export const teleApi = {
  listSessions: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get<TeleSession[]>(`/tele/sessions?${new URLSearchParams(params ?? {}).toString()}`),

  getSession: (id: string) =>
    api.get<TeleSession>(`/tele/sessions/${id}`),

  createSession: async (data: CreateTeleSessionDto) => {
    const res = await api.post<TeleSession>('/tele/sessions', data)
    await invalidateApiCache('/tele/sessions')
    return res
  },

  joinSession: (id: string) =>
    api.post<TeleSession>(`/tele/sessions/${id}/join`, {}),

  leaveSession: (id: string) =>
    api.post<TeleSession>(`/tele/sessions/${id}/leave`, {}),

  endSession: async (id: string) => {
    const res = await api.post<TeleSession>(`/tele/sessions/${id}/end`, {})
    await invalidateApiCache('/tele/sessions')
    return res
  },

  sendMessage: (sessionId: string, content: string) =>
    api.post<TeleMessage>(`/tele/sessions/${sessionId}/messages`, { content }),

  listMessages: (sessionId: string) =>
    api.get<TeleMessage[]>(`/tele/sessions/${sessionId}/messages`),

  getStats: () =>
    api.get<TeleStats>('/tele/stats'),
}

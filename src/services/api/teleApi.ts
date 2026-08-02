import { api } from "./client";

// Tele (远程会诊) API
// [v3.0.6.11-50] 路径统一: 前端 /tele/sessions/* → 后端 /tele/* (modules/tele.controller)
//   后端实际端点: session / join / signal / chat / cursor

export interface TeleSession {
  id: string;
  title: string;
  patientName: string;
  patientId: string;
  studyId: string;
  modality: string;
  hostDoctorId: string;
  hostDoctorName: string;
  participants: TeleParticipant[];
  status: "waiting" | "in_progress" | "completed" | "cancelled";
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface TeleParticipant {
  id: string;
  doctorId: string;
  doctorName: string;
  department: string;
  role: "host" | "guest" | "observer";
  joinedAt?: string;
  leftAt?: string;
}

export interface CreateTeleSessionDto {
  hostId: string;
  hostName: string;
  studyUids?: string[];
}

export interface JoinTeleSessionDto {
  sessionId: string;
  guestId: string;
  guestName: string;
}

export interface TeleSignalMessage {
  type: "offer" | "answer" | "ice-candidate";
  from: string;
  to: string;
  sessionId: string;
  payload: unknown;
}

export interface TeleChatMessageDto {
  sessionId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface TeleCursorDto {
  sessionId: string;
  userId: string;
  userName: string;
  x: number;
  y: number;
  color?: string;
}

export interface TeleMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: "text" | "annotation" | "measurement";
  createdAt: string;
}

export interface TeleStats {
  totalSessions: number;
  completedSessions: number;
  avgDurationMinutes: number;
  activeSessions: number;
  departmentDistribution: { department: string; count: number }[];
}

export const teleApi = {
  createSession: (data: CreateTeleSessionDto) =>
    api.post<TeleSession>("/tele/session", data),

  joinSession: (data: JoinTeleSessionDto) =>
    api.post<TeleSession>("/tele/join", data),

  getSession: (id: string) => api.get<TeleSession>(`/tele/session/${id}`),

  endSession: (id: string) => api.delete(`/tele/session/${id}`),

  sendSignal: (data: TeleSignalMessage) =>
    api.post<{ ok: boolean }>("/tele/signal", data),

  getPendingSignals: (sessionId: string, peer?: string) =>
    api.get<TeleSignalMessage[]>(
      `/tele/signal/${sessionId}?${peer ? `peer=${encodeURIComponent(peer)}` : ""}`,
    ),

  sendMessage: (data: TeleChatMessageDto) =>
    api.post<TeleMessage>("/tele/chat", data),

  listMessages: (sessionId: string, since?: string) =>
    api.get<TeleMessage[]>(
      `/tele/chat/${sessionId}?${since ? `since=${encodeURIComponent(since)}` : ""}`,
    ),

  updateCursor: (data: TeleCursorDto) =>
    api.post<{ ok: boolean }>("/tele/cursor", data),

  getCursors: (sessionId: string) =>
    api.get<TeleCursorDto[]>(`/tele/cursor/${sessionId}`),
};

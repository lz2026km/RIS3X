import { api } from './client'

export interface TranscribeResult {
  id: string
  text: string
  confidence: number
  segments: { start: number; end: number; text: string; confidence: number }[]
  engine: string
  duration: number
}

export interface FeedbackRequest {
  transcriptionId: string
  correctedText: string
  originalText: string
}

export const asrApi = {
  transcribe: (audioBase64?: string, duration?: number) =>
    api.post<TranscribeResult>('/asr/transcribe', { audioBase64, duration }),

  feedback: (data: FeedbackRequest) =>
    api.post<{ success: boolean }>('/asr/feedback', data),
}

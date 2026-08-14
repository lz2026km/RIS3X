// [Wave 6A v3.0.6.11-99] 语音工作站 API 封装: 医学词库 / 听写会话 / 转写校正 / 纠正反馈 / 统计
import { api, invalidateApiCacheByPrefix } from './client'

export type LexiconCategory = '解剖' | '影像' | '疾病' | '药物' | '单位' | '操作'

export interface LexiconEntry {
  id: string
  term: string
  category: LexiconCategory
  priority: number
  aliases: string[]
  createdAt: string
  updatedAt: string
}

export interface CorrectionItem {
  original: string
  corrected: string
  term: string
  category: LexiconCategory
}

export interface WorkstationTranscribeResult {
  id: string
  text: string
  correctedText: string
  corrections: CorrectionItem[]
  segments: { start: number; end: number; text: string; confidence: number }[]
  confidence: number
  engine: string
  duration: number
}

export interface SessionRecord {
  id: string
  reportId: string
  doctorId: string
  duration: number
  status: 'completed' | 'processing' | 'error'
  correctionCount: number
  createdAt: string
}

export interface CorrectionFeedback {
  id: string
  original: string
  corrected: string
  source: 'feedback' | 'auto'
  createdAt: string
}

export interface WorkstationStats {
  sessions: { total: number; today: number; avgDurationSec: number }
  lexiconSize: number
  corrections: { total: number }
  categoryCounts: { category: LexiconCategory; count: number }[]
}

// 统一解包: 失败抛错, 调用方 try/catch 降级
async function unwrap<T>(promise: Promise<{ success: boolean; data: T; error?: { message?: string } | null }>): Promise<T> {
  const res = await promise
  if (!res.success) {
    throw new Error(res.error?.message ?? '请求失败')
  }
  return res.data
}

export const voiceWorkstationApi = {
  listLexicon: async (): Promise<LexiconEntry[]> => {
    const res = await api.getList<LexiconEntry>('/voice-workstation/lexicon')
    return res.success ? res.data.data : []
  },

  searchLexicon: async (q: string): Promise<LexiconEntry[]> => {
    const res = await api.getList<LexiconEntry>(`/voice-workstation/lexicon/search?q=${encodeURIComponent(q)}`)
    return res.success ? res.data.data : []
  },

  createLexicon: async (data: { term: string; category: LexiconCategory; priority?: number; aliases?: string[] }) => {
    const entry = await unwrap(api.post<LexiconEntry>('/voice-workstation/lexicon', data))
    void invalidateApiCacheByPrefix('/voice-workstation')
    return entry
  },

  updateLexicon: async (id: string, data: Partial<{ term: string; category: LexiconCategory; priority: number; aliases: string[] }>) => {
    const entry = await unwrap(api.patch<LexiconEntry>(`/voice-workstation/lexicon/${id}`, data))
    void invalidateApiCacheByPrefix('/voice-workstation')
    return entry
  },

  deleteLexicon: async (id: string) => {
    const res = await unwrap(api.delete<{ success: boolean; deletedId: string }>(`/voice-workstation/lexicon/${id}`))
    void invalidateApiCacheByPrefix('/voice-workstation')
    return res
  },

  listSessions: async (): Promise<SessionRecord[]> => {
    const res = await api.getList<SessionRecord>('/voice-workstation/sessions')
    return res.success ? res.data.data : []
  },

  transcribe: (body: { audioBase64?: string; text?: string; reportId?: string; duration?: number }) =>
    unwrap(api.post<WorkstationTranscribeResult>('/voice-workstation/transcribe', body)),

  submitCorrection: (data: { original: string; corrected: string }) =>
    unwrap(api.post<CorrectionFeedback>('/voice-workstation/corrections', data)),

  listCorrections: async (): Promise<CorrectionFeedback[]> => {
    const res = await api.getList<CorrectionFeedback>('/voice-workstation/corrections')
    return res.success ? res.data.data : []
  },

  getStats: () => unwrap(api.get<WorkstationStats>('/voice-workstation/stats')),
}

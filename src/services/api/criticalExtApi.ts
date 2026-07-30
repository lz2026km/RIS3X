import { api } from './client'

export interface CriticalExtRuleDto {
  id: string; name: string; condition: string; action: string; severity: string; enabled: boolean; createdAt?: string; updatedAt?: string
}

export interface CriticalExtStatsDto { total: number; pending: number; notified: number; acknowledged: number; resolved: number; escalated: number }
export interface CriticalExtSummaryDto { todayCount: number; weeklyCount: number; monthlyCount: number; avgResponseTime: number }
export interface CriticalExtTimelineDto { date: string; count: number; resolved: number; escalated: number }
export interface CriticalExtCenterDto { id: string; patientName: string; finding: string; severity: string; status: string; triggeredAt: string; department: string }

export const criticalExtApi = {
  list: (params?: { skip?: number; take?: number; state?: string; severity?: string; dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    const qs = sp.toString()
    return api.get(`/critical-ext${qs ? '?' + qs : ''}`)
  },
  getById: (id: string) => api.get(`/critical-ext/${id}`),
  create: (data: { examId?: string; description: string; severity?: string; method?: string }) => api.post('/critical-ext', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/critical-ext/${id}`, data),
  delete: (id: string) => api.delete(`/critical-ext/${id}`),
  voiceCall: (id: string, data: { calledBy: string; phoneNumber: string; note?: string }) => api.post(`/critical-ext/${id}/voice-call`, data),
  clinicalReceipt: (id: string, data: { confirmedBy: string; signature?: string; comment?: string }) => api.post(`/critical-ext/${id}/clinical-receipt`, data),
  acknowledge: (id: string) => api.patch(`/critical-ext/${id}`, { state: 'ACKNOWLEDGED' }),
  resolve: (id: string) => api.patch(`/critical-ext/${id}`, { state: 'RESOLVED' }),
  notify: (id: string, method?: string) => api.post('/critical-ext/notify', { criticalId: id, channels: method ? [method] : ['SYSTEM'] }),
  escalate: (id: string, to: string, reason: string) => api.post('/critical-ext/escalate', { criticalId: id, reason, newRecipients: [{ name: to, dept: '', phone: '' }] }),
  listHistory: (criticalId: string) => api.get(`/critical-ext/${criticalId}/history`),
  runEscalationChain: (eventId: string) => api.post(`/critical-ext/${eventId}/escalation-chain`, {}),
  listRules: () => api.get('/critical-ext/rules'),
  createRule: (data: Partial<CriticalExtRuleDto>) => api.post('/critical-ext/rules', data),
  updateRule: (id: string, data: Partial<CriticalExtRuleDto>) => api.put(`/critical-ext/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/critical-ext/rules/${id}`),
  getStats: () => api.get('/critical-ext/stats'),
  getSummary: () => api.get('/critical-ext/stats/summary'),
  getTimeline: () => api.get('/critical-ext/stats/timeline'),
  listCenter: () => api.get('/critical-ext/center'),
  autoDetect: (data: { examId: string; finding: string }) => api.post('/critical-ext/auto-detect', data),
  closeLoop: (data: { criticalId: string; note: string }) => api.post('/critical-ext/close-loop', data),
}

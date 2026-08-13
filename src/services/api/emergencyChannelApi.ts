import { api, type ListData } from './client'

export type EmergencyChannelType = 'sms' | 'phone' | 'in-app' | 'wechat' | 'email' | 'pager'

export interface EmergencyChannelConfigItem {
  type: EmergencyChannelType
  label: string
  enabled: boolean
  priority: number
  targetRole: string
}

export interface EmergencyChannelConfig {
  channels: EmergencyChannelConfigItem[]
  autoTrigger: { enabled: boolean; keywords: string[] }
  updatedAt?: string
}

export interface EmergencyNotification {
  channel: EmergencyChannelType
  targetRole: string
  deliveredAt: string
  simulated: boolean
}

export interface EmergencyTriggerRecord {
  id: string
  patientId: string
  patientName?: string
  type: string
  reason: string
  channels: EmergencyChannelType[]
  triggeredBy: string
  triggeredAt: string
  status: 'sent' | 'acknowledged' | 'completed'
  notifications: EmergencyNotification[]
}

// [G005 Wave3A P2] PACS 急诊通道: 配置 GET/PUT + 触发记录 + 模拟通知
export const emergencyChannelApi = {
  getConfig: () => api.get<EmergencyChannelConfig>('/emergency-channel/config'),
  saveConfig: (data: {
    channels?: Array<{ type: EmergencyChannelType; enabled?: boolean; priority?: number; targetRole?: string }>
    autoTrigger?: { enabled?: boolean; keywords?: string[] }
  }) => api.put<EmergencyChannelConfig>('/emergency-channel/config', data),
  listRecords: (query?: { patientId?: string; status?: string }) =>
    api.get<ListData<EmergencyTriggerRecord>>(
      `/emergency-channel/records${query ? '?' + new URLSearchParams(
        Object.entries(query).filter(([, v]) => v != null && v !== '') as [string, string][],
      ).toString() : ''}`,
    ),
  trigger: (data: { patientId: string; patientName?: string; type: string; reason: string; triggeredBy?: string }) =>
    api.post<EmergencyTriggerRecord>('/emergency-channel/trigger', data),
  acknowledge: (id: string) => api.post<EmergencyTriggerRecord>(`/emergency-channel/records/${id}/acknowledge`),
}

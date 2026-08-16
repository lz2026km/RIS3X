import { api, invalidateApiCache } from './client'

// [G005 v3.0.6.11-101 Wave 6A F8] 水印签章 V2 API
// 后端: backend/src/modules/report-sign-v2/ (水印 preview/verify + 电子签名申请/审批/记录)

export type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile'

export interface TextWatermarkParams {
  content: string
  position: WatermarkPosition
  rotation: number
  opacity: number
  spacing: number
  fontSize: number
}

export interface ImageWatermarkParams {
  enabled: boolean
  logoKey: string
  logoName: string
  scale: number
  position: WatermarkPosition
  opacity: number
}

export interface WatermarkConfig {
  version: 2
  text: TextWatermarkParams
  image: ImageWatermarkParams
}

export interface WatermarkTile {
  x: number
  y: number
  rotation: number
}

export interface WatermarkPreview {
  source: 'database' | 'demo'
  generatedAt: string
  config: WatermarkConfig
  contentHash: string
  tamperCode: string
  tiles: WatermarkTile[]
}

export interface WatermarkVerifyResult {
  valid: boolean
  contentHashOk: boolean
  tamperOk: boolean
  computedContentHash: string
  computedTamperCode: string
}

export type SignKind = 'doctor' | 'reviewer' | 'co-signer'
export type SignStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface SignRecord {
  id: string
  action: 'apply' | 'approve' | 'reject' | 'cancel' | 'sign'
  actorId: string
  actorName: string
  note: string
  at: string
}

export interface SignRequest {
  id: string
  reportId: string
  reportTitle: string
  kind: SignKind
  applicantId: string
  applicantName: string
  signerId: string
  signerName: string
  reason: string
  status: SignStatus
  reportHash: string
  signedAt?: string
  signedById?: string
  signedByName?: string
  approveNote?: string
  rejectReason?: string
  createdAt: string
  updatedAt: string
  records: SignRecord[]
}

export interface SignStats {
  total: number
  byStatus: Record<string, number>
  pending: number
  approved: number
  rejected: number
  cancelled: number
  signedToday: number
}

export interface SignEnvelope<T> {
  source: 'database' | 'demo'
  generatedAt: string
  data: T
}

export const WATERMARK_POSITION_LABELS: Record<WatermarkPosition, string> = {
  center: '居中',
  'top-left': '左上',
  'top-right': '右上',
  'bottom-left': '左下',
  'bottom-right': '右下',
  tile: '平铺',
}

export const SIGN_KIND_LABELS: Record<SignKind, string> = {
  doctor: '医生签名',
  reviewer: '审核签名',
  'co-signer': '双签名',
}

export const SIGN_STATUS_LABELS: Record<SignStatus, string> = {
  pending: '待审批',
  approved: '已签署',
  rejected: '已驳回',
  cancelled: '已撤销',
}

export const SIGNER_OPTIONS = [
  { value: 'u-001', label: '张主任' },
  { value: 'u-002', label: '李医生' },
  { value: 'u-003', label: '王技师' },
  { value: 'u-004', label: '赵审核' },
]

export const SIGN_REPORT_OPTIONS = [
  { value: 'RPT-1001', label: 'RPT-1001 胸部 CT 平扫增强' },
  { value: 'RPT-1002', label: 'RPT-1002 头颅 MRI 平扫' },
  { value: 'RPT-1003', label: 'RPT-1003 腹部超声' },
  { value: 'RPT-1004', label: 'RPT-1004 乳腺钼靶' },
]

export const reportSignV2Api = {
  getWatermarkConfig: () => api.get<SignEnvelope<WatermarkConfig>>('/report-sign-v2/watermark/config'),

  previewWatermark: async (data: { reportId?: string; text?: string; config?: Partial<WatermarkConfig> }) => {
    const res = await api.post<WatermarkPreview>('/report-sign-v2/watermark/preview', data)
    return res
  },

  verifyWatermark: async (data: { reportId?: string; text?: string; config?: Partial<WatermarkConfig>; contentHash?: string; tamperCode?: string }) => {
    const res = await api.post<WatermarkVerifyResult>('/report-sign-v2/watermark/verify', data)
    return res
  },

  listSigns: (reportId?: string) =>
    api.get<SignEnvelope<SignRequest[]>>(`/report-sign-v2/signs${reportId ? `?reportId=${encodeURIComponent(reportId)}` : ''}`),

  applySign: async (data: { reportId: string; reportTitle?: string; kind: SignKind; signerId: string; applicantId?: string; reason?: string; reportText?: string }) => {
    const res = await api.post<SignRequest>('/report-sign-v2/signs', data)
    await invalidateApiCache('/report-sign-v2/signs')
    return res
  },

  getSign: (id: string) => api.get<SignRequest>(`/report-sign-v2/signs/${id}`),

  approveSign: async (id: string, data: { note?: string; actorId?: string }) => {
    const res = await api.post<SignRequest>(`/report-sign-v2/signs/${id}/approve`, data)
    await invalidateApiCache('/report-sign-v2/signs')
    return res
  },

  rejectSign: async (id: string, data: { reason: string; actorId?: string }) => {
    const res = await api.post<SignRequest>(`/report-sign-v2/signs/${id}/reject`, data)
    await invalidateApiCache('/report-sign-v2/signs')
    return res
  },

  cancelSign: async (id: string, data: { reason?: string; actorId?: string }) => {
    const res = await api.post<SignRequest>(`/report-sign-v2/signs/${id}/cancel`, data)
    await invalidateApiCache('/report-sign-v2/signs')
    return res
  },

  getSignStats: () => api.get<SignEnvelope<SignStats>>('/report-sign-v2/signs/stats'),
}

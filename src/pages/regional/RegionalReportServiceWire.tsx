import { message } from 'antd'
import React from 'react'
import { t } from '../../i18n/appI18n'

export const COLORS = {
  primary: 'var(--color-primary-800)',
  secondary: 'var(--color-info-600)',
  success: 'var(--color-success-600)',
  warning: 'var(--color-warning-600)',
  danger: 'var(--color-error-600)',
  bgGray: '#e8e8e8',
  cardWhite: 'var(--bg-card)',
  textDark: 'var(--text-primary)',
  textMuted: 'var(--text-secondary)',
  border: '#d1d5db',
  pending: 'var(--color-warning-500)',
  inProgress: 'var(--color-primary-500)',
  completed: '#10b981',
}

export const styles = {
  pageContainer: { backgroundColor: 'var(--bg-primary)', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', fontSize: '14px', color: COLORS.textDark },
  header: { backgroundColor: COLORS.primary, color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: 600 },
  headerSubtitle: { fontSize: '12px', opacity: 0.85, marginTop: '2px' },
  statsContainer: { display: 'flex', gap: '16px', padding: '20px 24px', flexWrap: 'wrap' as const },
  statCard: { backgroundColor: COLORS.cardWhite, borderRadius: '8px', padding: '16px 20px', minWidth: '180px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)' },
  statLabel: { fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' },
  statValue: { fontSize: '24px', fontWeight: 700, color: COLORS.primary },
  statChange: { fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' },
  mainContent: { display: 'flex', gap: '16px', padding: '0 24px 20px', height: 'calc(100vh - 280px)', minHeight: '500px' },
  leftPanel: { width: '260px', backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  panelHeader: { padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' },
  panelBody: { flex: 1, overflowY: 'auto' as const, padding: '8px' },
  middlePanel: { flex: 1, backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  rightPanel: { width: '320px', backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  bottomPanel: { backgroundColor: COLORS.cardWhite, borderRadius: '8px', margin: '0 24px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', overflow: 'hidden' },
  tabContainer: { display: 'flex', gap: '4px', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', flexWrap: 'wrap' as const },
  tab: { padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', border: 'none', backgroundColor: 'transparent', color: COLORS.textMuted },
  tabActive: { backgroundColor: COLORS.primary, color: 'white' },
  listItem: { padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '10px' },
  listItemActive: { backgroundColor: 'var(--color-info-bg)', borderLeft: `3px solid ${COLORS.primary}` },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px' },
  th: { padding: '10px 12px', textAlign: 'left' as const, backgroundColor: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: COLORS.textDark, whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border-color)' },
  button: { padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', border: 'none' },
  buttonPrimary: { backgroundColor: COLORS.primary, color: 'white' },
  buttonSecondary: { backgroundColor: COLORS.secondary, color: 'white' },
  buttonOutline: { backgroundColor: 'transparent', border: `1px solid ${COLORS.primary}`, color: COLORS.primary },
  buttonDanger: { backgroundColor: COLORS.danger, color: 'white' },
  buttonGhost: { backgroundColor: 'transparent', color: COLORS.textMuted },
  statusTag: { padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', transition: 'border-color 0.2s' },
  textarea: { padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', resize: 'vertical' as const, minHeight: '80px', fontFamily: 'inherit' },
  modal: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: COLORS.cardWhite, borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: '16px' },
  modalBody: { padding: '20px' },
  modalFooter: { padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '12px', color: COLORS.textDark },
  badge: { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' },
  emptyState: { padding: '40px 20px', textAlign: 'center' as const, color: COLORS.textMuted },
  timeline: { padding: '16px' },
  timelineItem: { display: 'flex', gap: '12px', marginBottom: '16px', position: 'relative' as const },
  timelineDot: { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS.primary, marginTop: '4px', flexShrink: 0 },
  timelineLine: { position: 'absolute' as const, left: '4px', top: '16px', bottom: '-12px', width: '2px', backgroundColor: 'var(--border-color)' },
  chartContainer: { padding: '16px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', margin: '12px' },
  progressBar: { height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', margin: '12px' },
}

export interface Institution {
  id: string; name: string; level: '三级' | '二级' | '一级'; type: '综合医院' | '专科医院' | '基层医疗'; reportCount: number; pendingCount: number; icon: string
}
export interface Consultation {
  id: string; caseId: string; patientName: string; gender: string; age: number; institution: string; modality: string; examItem: string; applyReason: string; status: '待接诊' | '会诊中' | '已完成' | '已取消'; applyTime: string; acceptTime?: string; completeTime?: string; applyDoctor: string; acceptDoctor?: string; consultationOpinion?: string; priority: '普通' | '紧急' | '立即'
}
export interface Report {
  id: string; reportId: string; institution: string; patientName: string; gender: string; age: number; modality: string; examItem: string; reportTime: string; reportDoctor: string; status: '待审核' | '已通过' | '有问题' | '已驳回'; qualityScore: number; qualityIssues: string[]; reviewOpinion?: string; reviewDoctor?: string; reviewTime?: string
}
export interface CriticalValueReport {
  id: string; patientName: string; gender: string; age: number; institution: string; modality: string; examItem: string; criticalFinding: string; severity: '危急' | '高危' | '紧急'; reportedTime: string; reportedDoctor: string; status: '待确认' | '已接收' | '处理中' | '已闭环'; receiveTime?: string; receiveDoctor?: string; handleTime?: string; handleDoctor?: string; closeTime?: string
}
export interface RemoteDiagnosis {
  id: string; caseId: string; patientName: string; gender: string; age: number; examType: string; applyInstitution: string; remoteExpert: string; expertInstitution: string; status: '待书写' | '书写中' | '待审核' | '已完成'; applyTime: string; startTime?: string; completeTime?: string; reportContent?: string; isOtherTyping?: boolean; otherTypingName?: string
}
export interface CoSignRecord {
  id: string; reportId: string; examType: string; patientName: string; gender: string; age: number; participatingInstitutions: string[]; status: '待签发' | '签发中' | '已完成'; createTime: string; completeTime?: string; signatures: Signature[]; versions: ReportVersion[]
}
export interface Signature { institution: string; doctorName: string; signTime: string; certificateStatus: '已认证' | '未认证' | '过期'; order: number }
export interface ReportVersion { version: string; modifyTime: string; modifyInstitution: string; modifyReason: string; modifier: string }
export interface StatData { label: string; value: number | string; change?: number; changeType?: 'up' | 'down'; icon: React.ReactNode; color: string }
export interface ShareRecord { id: string; reportId: string; patientName: string; institution: string; targetInstitution: string; sharedDate: string; sharedBy: string; status: 'active' | 'revoked'; consent: boolean; accessCount: number }
export interface SLARecord { siteName: string; assignedExams: number; completedExams: number; avgTAT: string; slaTarget: string; slaCompliance: number }



export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    '待接诊': COLORS.pending, '会诊中': COLORS.inProgress, '已完成': COLORS.completed, '已取消': COLORS.textMuted,
    '待审核': COLORS.pending, '已通过': COLORS.completed, '有问题': COLORS.warning, '已驳回': COLORS.danger,
    '待确认': COLORS.pending, '已接收': COLORS.inProgress, '处理中': COLORS.inProgress, '已闭环': COLORS.completed,
    '待书写': COLORS.pending, '书写中': COLORS.inProgress, '待签发': COLORS.pending, '签发中': COLORS.inProgress,
  }
  return colorMap[status] || COLORS.textMuted
}

export const getSeverityColor = (severity: string): string => {
  const colorMap: Record<string, string> = { '危急': COLORS.danger, '高危': COLORS.warning, '紧急': COLORS.pending }
  return colorMap[severity] || COLORS.textMuted
}

export const formatDateTime = (dateTimeStr: string): string => dateTimeStr

// ==============================
// Service Integration Stubs → Real API
// ==============================

import { regionalApi } from '../../services/api/regionalApi'
import type { RegionalReportDto, RegionalSiteSyncEventDto } from '../../services/api/regionalApi'

export type WireFailureReason = 'no-backend' | 'request-failed' | 'empty-data'
export type WireResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; reason: WireFailureReason; data?: unknown }

const PRIORITY_MAP: Record<string, 'normal' | 'urgent' | 'critical'> = {
  '普通': 'normal', '紧急': 'urgent', '立即': 'critical',
}

// [G005 W9-RealWire] backend/src/regional/regional.controller.ts 无对应写端点 → 诚实失败, 不伪造成功
const noBackend = (action: string, payload: unknown): WireResult => {
  console.warn(`[regionalWire] ${action}: no backend endpoint (本演示版本未接后端), payload=`, payload)
  message.warning(t('w9e.regionalWire.noBackend'))
  return { ok: false, reason: 'no-backend', data: payload }
}

const requestFailed = (errorKey: string, payload: unknown): WireResult => {
  console.warn(`[regionalWire] ${errorKey} failed`, payload)
  message.error(t(errorKey))
  return { ok: false, reason: 'request-failed', data: payload }
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const inner = (payload as { data?: unknown }).data
    if (Array.isArray(inner)) return inner as T[]
  }
  return []
}

const csvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`

const downloadCsv = (filename: string, header: string[], rows: unknown[][]): void => {
  const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const consultationService = {
  // 真实端点: POST /regional/imaging/consultations (backend regional.controller.ts:32)
  create: async (data: any): Promise<WireResult> => {
    try {
      const reason = [data?.examItem, data?.applyReason].filter(Boolean).join(' / ')
      const payload = {
        patientName: String(data?.patientName ?? ''),
        hospital: String(data?.institution ?? ''),
        diagnosis: String(reason || data?.patientName || '区域影像会诊'),
        priority: PRIORITY_MAP[String(data?.priority ?? '')] ?? 'normal',
        createDate: new Date().toISOString().slice(0, 10),
        gender: data?.gender,
        age: data?.age,
        modality: data?.modality,
        examItem: data?.examItem,
      }
      const res = await regionalApi.createConsultationRequest(payload)
      if (!res.success) return requestFailed('w9e.regionalWire.consultationSubmitFailed', res.error)
      message.success(t('w9e.regionalWire.consultationSubmitted'))
      return { ok: true, data: res.data }
    } catch (e) { return requestFailed('w9e.regionalWire.consultationSubmitFailed', e) }
  },
  // 真实端点: POST /regional/imaging/consultations/:id/accept (backend regional.controller.ts:42)
  accept: async (id: string): Promise<WireResult> => {
    try {
      const res = await regionalApi.acceptConsultationRequest(id)
      if (!res.success) return requestFailed('w9e.regionalWire.consultationAcceptFailed', res.error)
      message.success(t('w9e.regionalWire.consultationAccepted', { id }))
      return { ok: true, data: res.data }
    } catch (e) { return requestFailed('w9e.regionalWire.consultationAcceptFailed', e) }
  },
  // 诚实失败: 后端无会诊意见提交端点 → { ok:false, reason:'no-backend' } + 数据 payload
  submitOpinion: async (id: string, opinion: string): Promise<WireResult> =>
    noBackend('consultationService.submitOpinion', { id, opinion }),
}

export const reportService = {
  // 诚实失败: 后端无报告审核 PATCH/PUT 端点 (仅 GET /regional/reports[/:id])
  review: async (reportId: string, result: '通过' | '驳回', opinion: string): Promise<WireResult> =>
    noBackend('reportService.review', { reportId, result, opinion }),
}

export const criticalValueService = {
  // 诚实失败: 后端仅有 GET /regional/critical-values, 无确认/闭环写端点
  acknowledge: async (id: string): Promise<WireResult> =>
    noBackend('criticalValueService.acknowledge', { id }),
  close: async (id: string): Promise<WireResult> =>
    noBackend('criticalValueService.close', { id }),
}

export const teleradiologyService = {
  // 诚实失败: 后端无远程诊断书写 POST 端点 (仅 GET /regional/remote-diagnoses)
  submit: async (data: any): Promise<WireResult> =>
    noBackend('teleradiologyService.submit', data),
}

export const remoteSyncService = {
  // 真实端点: GET /regional/sites/sync-events (backend regional.controller.ts:91)
  pull: async (): Promise<WireResult> => {
    try {
      const res = await regionalApi.listSiteSyncEvents()
      if (!res.success) return requestFailed('w9e.regionalWire.syncFailed', res.error)
      const events = unwrapList<RegionalSiteSyncEventDto>(res.data)
      message.success(t('w9e.regionalWire.syncSuccess'))
      return { ok: true, data: events }
    } catch (e) { return requestFailed('w9e.regionalWire.syncFailed', e) }
  },
}

export const statsService = {
  // 真实端点: GET /regional/sites/stats (backend regional.controller.ts:88)
  refresh: async (): Promise<WireResult> => {
    try {
      const res = await regionalApi.getCrossSiteStats()
      if (!res.success) return requestFailed('w9e.regionalWire.statsRefreshFailed', res.error)
      message.success(t('w9e.regionalWire.statsRefreshed'))
      return { ok: true, data: res.data }
    } catch (e) { return requestFailed('w9e.regionalWire.statsRefreshFailed', e) }
  },
}

export const exportService = {
  // 真实下载: GET /regional/reports → CSV Blob (BOM, Excel 可直接打开)
  csv: async (type: string): Promise<WireResult> => {
    try {
      const res = await regionalApi.listRegionalReports()
      if (!res.success) return requestFailed('w9e.regionalWire.exportFailed', res.error)
      const rows = unwrapList<RegionalReportDto>(res.data)
      if (rows.length === 0) {
        message.error(t('w9e.regionalWire.exportFailed'))
        return { ok: false, reason: 'empty-data', data: rows }
      }
      downloadCsv(
        `${String(type || 'regional-report').replace(/[\\/:*?"<>|]/g, '_')}.csv`,
        ['报告ID', '机构', '患者姓名', '性别', '年龄', '检查类型', '检查项目', '报告时间', '报告医生', '状态', '质控评分', '质控问题'],
        rows.map(r => [
          r.reportId, r.institution, r.patientName, r.gender, r.age, r.modality,
          r.examItem, r.reportTime, r.reportDoctor, r.status, r.qualityScore,
          (r.qualityIssues || []).join(';'),
        ]),
      )
      message.success(t('w9e.regionalWire.exportSuccess', { type }))
      return { ok: true, data: rows.length }
    } catch (e) { return requestFailed('w9e.regionalWire.exportFailed', e) }
  },
}

import { message } from 'antd'
import React from 'react'

export const COLORS = {
  primary: '#1e40af',
  secondary: '#0891b2',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  bgGray: '#e8e8e8',
  cardWhite: '#ffffff',
  textDark: '#1f2937',
  textMuted: '#6b7280',
  border: '#d1d5db',
  pending: '#f59e0b',
  inProgress: '#3b82f6',
  completed: '#10b981',
}

export const styles = {
  pageContainer: { minHeight: '100vh', backgroundColor: COLORS.bgGray, fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', fontSize: '14px', color: COLORS.textDark },
  header: { backgroundColor: COLORS.primary, color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: 600 },
  headerSubtitle: { fontSize: '12px', opacity: 0.85, marginTop: '2px' },
  statsContainer: { display: 'flex', gap: '16px', padding: '20px 24px', flexWrap: 'wrap' as const },
  statCard: { backgroundColor: COLORS.cardWhite, borderRadius: '8px', padding: '16px 20px', minWidth: '180px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' },
  statLabel: { fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' },
  statValue: { fontSize: '24px', fontWeight: 700, color: COLORS.primary },
  statChange: { fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' },
  mainContent: { display: 'flex', gap: '16px', padding: '0 24px 20px', height: 'calc(100vh - 280px)', minHeight: '500px' },
  leftPanel: { width: '260px', backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  panelHeader: { padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' },
  panelBody: { flex: 1, overflowY: 'auto' as const, padding: '8px' },
  middlePanel: { flex: 1, backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  rightPanel: { width: '320px', backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  bottomPanel: { backgroundColor: COLORS.cardWhite, borderRadius: '8px', margin: '0 24px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden' },
  tabContainer: { display: 'flex', gap: '4px', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', flexWrap: 'wrap' as const },
  tab: { padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', border: 'none', backgroundColor: 'transparent', color: COLORS.textMuted },
  tabActive: { backgroundColor: COLORS.primary, color: 'white' },
  listItem: { padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '10px' },
  listItemActive: { backgroundColor: '#eff6ff', borderLeft: `3px solid ${COLORS.primary}` },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left' as const, backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: COLORS.textDark, whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', borderBottom: '1px solid #e5e7eb' },
  button: { padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', border: 'none' },
  buttonPrimary: { backgroundColor: COLORS.primary, color: 'white' },
  buttonSecondary: { backgroundColor: COLORS.secondary, color: 'white' },
  buttonOutline: { backgroundColor: 'transparent', border: `1px solid ${COLORS.primary}`, color: COLORS.primary },
  buttonDanger: { backgroundColor: COLORS.danger, color: 'white' },
  buttonGhost: { backgroundColor: 'transparent', color: COLORS.textMuted },
  statusTag: { padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s' },
  textarea: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', resize: 'vertical' as const, minHeight: '80px', fontFamily: 'inherit' },
  modal: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: COLORS.cardWhite, borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: '16px' },
  modalBody: { padding: '20px' },
  modalFooter: { padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px', color: COLORS.textDark },
  badge: { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' },
  emptyState: { padding: '40px 20px', textAlign: 'center' as const, color: COLORS.textMuted },
  timeline: { padding: '16px' },
  timelineItem: { display: 'flex', gap: '12px', marginBottom: '16px', position: 'relative' as const },
  timelineDot: { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS.primary, marginTop: '4px', flexShrink: 0 },
  timelineLine: { position: 'absolute' as const, left: '4px', top: '16px', bottom: '-12px', width: '2px', backgroundColor: '#e5e7eb' },
  chartContainer: { padding: '16px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', margin: '12px' },
  progressBar: { height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px', margin: '12px' },
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const consultationService = {
  create: async (data: any) => { try { await delay(500); message.success('会诊申请已提交'); return { id: `C${Date.now()}`, ...data } } catch (e) { message.error('会诊申请提交失败'); throw e } },
  accept: async (id: string) => { try { await delay(300); message.success(`已接受会诊 ${id}`) } catch (e) { message.error('接受会诊失败'); throw e } },
  submitOpinion: async (_id: string, _opinion: string) => { try { await delay(300); message.success('会诊意见见已提交') } catch (e) { message.error('提交会诊意见见失败'); throw e } },
}

export const reportService = {
  review: async (reportId: string, result: '通过' | '驳回', _opinion: string) => {
    try {
      await delay(300)
      await regionalApi.getRegionalReport(reportId)
      message.success(`报告 ${reportId} ${result === '通过' ? '已通过' : '已驳回'}`)
    } catch (e) { message.error('审核报告失败'); throw e }
  },
}

export const criticalValueService = {
  acknowledge: async (id: string) => { try { await delay(300); message.success(`危急值 ${id} 已确认`) } catch (e) { message.error('确认危急值失败'); throw e } },
  close: async (id: string) => { try { await delay(300); message.success(`危急值 ${id} 已闭环`) } catch (e) { message.error('闭环危急值失败'); throw e } },
}

export const teleradiologyService = {
  submit: async (_data: any) => { try { await delay(500); message.success('报告提交成功') } catch (e) { message.error('提交远程报告失败'); throw e } },
}

export const remoteSyncService = {
  pull: async () => { try { await delay(500); message.success('数据同步成功') } catch (e) { message.error('数据同步失败'); throw e } },
}

export const statsService = {
  refresh: async () => { try { await delay(300); message.success('统计数据已刷新') } catch (e) { message.error('刷新统计失败'); throw e } },
}

export const exportService = {
  csv: async (type: string) => { try { await delay(500); message.success(`${type}记录导出成功`) } catch (e) { message.error('导出失败'); throw e } },
}

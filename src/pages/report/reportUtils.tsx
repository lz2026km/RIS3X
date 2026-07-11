import React from 'react'
import { initialRadiologyExams, initialUsers } from '../../data/initialData'
import type { RadiologyReport } from '../../types'
import { REPORT_STATUS_META, REPORT_STATUS_ORDER } from '../../components/report'

export const PRIMARY = '#1e3a5f'
export const PRIMARY_LIGHT = '#2c5282'
export const ACCENT = '#3182ce'
export const SUCCESS = '#059669'
export const WARNING = '#d97706'
export const DANGER = '#dc2626'
export const PURPLE = '#7c3aed'
export const GRAY = '#64748b'
export const BG = '#f8fafc'
export const WHITE = '#ffffff'

export const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  待审核: { label: '待审核', bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  已审核: { label: '已审核', bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
  已发布: { label: '已发布', bg: '#d1fae5', color: '#047857', border: '#6ee7b7' },
  已修改: { label: '已修改', bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  已退回: { label: '已退回', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  待分配: REPORT_STATUS_META['待分配'],
  已分配: REPORT_STATUS_META['已分配'],
  书写中: REPORT_STATUS_META['书写中'],
  已提交: REPORT_STATUS_META['已提交'],
  初审中: REPORT_STATUS_META['初审中'],
  初审通过: REPORT_STATUS_META['初审通过'],
  终审中: REPORT_STATUS_META['终审中'],
  签发中: REPORT_STATUS_META['签发中'],
  已签发: REPORT_STATUS_META['已签发'],
  修订中: REPORT_STATUS_META['修订中'],
  已修订: REPORT_STATUS_META['已修订'],
  已撤回: REPORT_STATUS_META['已撤回'],
  已归档: REPORT_STATUS_META['已归档'],
}

export const MODALITIES = ['全部', 'CT', 'MR', 'DR', 'DSA', 'MG']
export const STATUSES = ['全部', '待分配', '已分配', '书写中', '已提交', '初审中', '初审通过', '终审中', '已审核', '签发中', '已签发', '已发布', '修订中', '已修订', '已撤回', '已驳回', '已归档']
export const PRIORITIES = ['全部', '紧急', '危重', '普通']
export const DOCTORS = initialUsers.filter((u) => u.role === 'radiologist')

export const ANOMALY_KEYWORDS = ['结节', '血肿', '占位', '狭窄', '肿块', '转移', '骨折', '渗出', '积水', '压迫', '突出', '钙化', '增粗', '模糊', '不张', '增厚']

export function formatDate(dt: string) {
  if (!dt) return '-'
  return dt.length >= 16 ? dt.slice(0, 16) : dt
}

export function formatDateFull(dt: string) {
  if (!dt) return ''
  const d = new Date(dt)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function isToday(dt: string) {
  if (!dt) return false
  return dt.startsWith(new Date().toISOString().slice(0, 10))
}

export function highlightAnomalies(text: string | undefined): React.ReactNode {
  if (!text) return text
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  const regex = new RegExp(`(${ANOMALY_KEYWORDS.join('|')})`, 'g')
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index))
    parts.push(<span key={match.index} style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700, borderRadius: 2, padding: '0 2px' }}>{match[0]}</span>)
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts.length > 0 ? parts : text
}

export function genMockReports(): RadiologyReport[] {
  const statuses: RadiologyReport['status'][] = ['已提交', '已审核', '已发布', '已修订', '已驳回']
  const findings = ['右肺中叶见约1.2cm结节影，边缘毛糙。', '左侧额颞顶部硬膜下血肿，厚约8mm，中线右偏约5mm。', '肝右叶见约3.5cm低密度影，边界欠清，增强扫描呈不均匀强化。', 'L4/5椎间盘向左后突出，神经根受压。', '冠脉左主干开口狭窄约85%，前降支近段狭窄约90%。', '左侧乳腺外上象限见约2.1cm肿块影，边缘毛刺状。', '颅内未见明显异常密度影，脑室系统正常，中线结构居中。', '双肺纹理增粗，右肺下叶见斑片状密度增高影。']
  const impressions = ['右肺中叶结节，建议随访。', '左侧额颞顶部硬膜下血肿。', '肝右叶占位，建议进一步检查。', 'L4/5椎间盘突出。', '冠脉多支病变，狭窄严重。', '左侧乳腺肿块，BI-RADS 4C类。', '颅内CT平扫未见明显异常。', '右肺下叶炎症。']
  return initialRadiologyExams.map((exam, i) => ({
    id: `RAD-RPT${String(i + 1).padStart(3, '0')}`,
    reportId: `RAD-RPT${String(i + 1).padStart(3, '0')}`,
    examId: exam.id,
    accessionNumber: exam.accessionNumber,
    patientId: exam.patientId,
    patientName: exam.patientName,
    gender: exam.gender,
    age: exam.age,
    patientType: exam.patientType,
    examItemName: exam.examItemName,
    modality: exam.modality,
    bodyPart: exam.bodyPart,
    examDate: exam.examDate,
    deviceName: exam.deviceName,
    clinicalHistory: exam.clinicalHistory,
    examFindings: findings[i % findings.length],
    diagnosis: impressions[i % impressions.length],
    impression: impressions[i % impressions.length],
    recommendations: i % 2 === 0 ? '建议3个月后复查' : undefined,
    criticalFinding: [true, false, false, true, false, true, false, false][i % 8],
    criticalFindingDetails: [true, false, false, true, false, true, false, false][i % 8] ? findings[i % findings.length] : undefined,
    qualityScore: 78 + ((i * 3) % 23),
    templateId: undefined,
    templateName: undefined,
    reportDoctorId: DOCTORS[i % DOCTORS.length].id,
    reportDoctorName: DOCTORS[i % DOCTORS.length].name,
    signedTime: '2026-05-01 10:00',
    reportVerificationCode: '123456',
    auditorId: i % 2 === 0 ? DOCTORS[(i + 1) % DOCTORS.length].id : undefined,
    auditorName: i % 2 === 0 ? DOCTORS[(i + 1) % DOCTORS.length].name : undefined,
    approvedTime: i % 2 === 0 ? '2026-05-01 11:30' : undefined,
    auditVerificationCode: i % 2 === 0 ? '654321' : undefined,
    auditSuggestion: i % 2 === 0 ? '报告书写规范，同意发布。' : undefined,
    status: statuses[i % statuses.length],
    isPreliminary: false,
    isAddendum: false,
    addendumReportId: undefined,
    publishedTime: i % 3 === 0 ? '2026-05-01 14:00' : undefined,
    publishedBy: i % 3 === 0 ? DOCTORS[(i + 2) % DOCTORS.length].name : undefined,
    createdTime: exam.createdTime,
    updatedTime: exam.updatedTime,
  }))
}

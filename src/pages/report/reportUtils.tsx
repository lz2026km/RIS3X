import React from 'react'

import { REPORT_STATUS_META } from '../../components/report'
import { toEnState } from '../../components/report/statusMeta'

export const PRIMARY = 'var(--color-primary-800)'
export const PRIMARY_LIGHT = '#2c5282'
export const ACCENT = '#3182ce'
export const SUCCESS = '#059669'
export const WARNING = 'var(--color-warning-600)'
export const DANGER = 'var(--color-error-600)'
export const PURPLE = '#7c3aed'
export const GRAY = 'var(--text-secondary, #475569)'
export const BG = 'var(--bg-primary)'
export const WHITE = 'var(--bg-card, #ffffff)'

export const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  待审核: { label: '待审核', bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  已审核: { label: '已审核', bg: '#dbeafe', color: 'var(--color-primary-600)', border: '#93c5fd' },
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

// [v3.0.6.11-92 Wave1B P0] 报告特殊态按钮启用条件 (对齐 backend REPORT_TRANSITIONS)
// [v3.0.6.11-95 Wave2A P0] 改比较英文枚举 (真实后端英文 state), 调用方先用 toEnState 归一
export const CAN_SUPPLEMENT = ['SIGNED', 'PUBLISHED'] // SIGNED/PUBLISHED → SUPPLEMENTING
export const CAN_RECTIFY = ['SIGNED'] // SIGNED → RECTIFYING
export const CAN_REDISTRIBUTE = ['ASSIGNED'] // ASSIGNED → REDISTRIBUTING
export const CAN_ESCALATE = ['SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW', 'REVIEWED'] // 审核链 → ESCALATED

export const ANOMALY_KEYWORDS = ['结节', '血肿', '占位', '狭窄', '肿块', '转移', '骨折', '渗出', '积水', '压迫', '突出', '钙化', '增粗', '模糊', '不张', '增厚']

// [v3.0.6.11-95 Wave2B P1] 报告书写页入口可用状态 (经 toEnState 归一后比较英文枚举, 中英双兼容)
export const WRITABLE_EN_STATES = ['DRAFT', 'WRITING', 'ASSIGNED', 'PENDING_ASSIGNMENT', 'REJECTED']
export function isReportWritable(status?: string): boolean {
  if (!status) return false
  return WRITABLE_EN_STATES.includes(toEnState(status))
}
// [v3.0.6.11-95 Wave2B P1] 草稿超时提醒 (默认 24h 可配)
export const DRAFT_TIMEOUT_HOURS = 24
export function isDraftOverdue(status?: string, updatedTime?: string, hours = DRAFT_TIMEOUT_HOURS): boolean {
  if (!isReportWritable(status) || !updatedTime) return false
  const t = new Date(updatedTime).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t > hours * 3600 * 1000
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
    parts.push(<span key={match.index} style={{ background: '#fee2e2', color: 'var(--color-error-600)', fontWeight: 700, borderRadius: 2, padding: '0 2px' }}>{match[0]}</span>)
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts.length > 0 ? parts : text
}

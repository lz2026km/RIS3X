import React from 'react'

import { REPORT_STATUS_META } from '../../components/report'

export const PRIMARY = '#1e40af'
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

export const ANOMALY_KEYWORDS = ['结节', '血肿', '占位', '狭窄', '肿块', '转移', '骨折', '渗出', '积水', '压迫', '突出', '钙化', '增粗', '模糊', '不张', '增厚']



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

import type { ReactNode } from 'react'
import { Edit3, CheckCircle, AlertCircle, LogIn, LogOut, Download, Settings, MonitorSmartphone, Monitor, Server, Zap, Wrench, CheckSquare, Printer, Upload } from 'lucide-react'

export const PRIMARY = '#1e40af'
export const PRIMARY_LIGHT = '#2c5282'
export const ACCENT = '#3182ce'
export const SUCCESS = '#059669'
export const WARNING = '#d97706'
export const DANGER = '#dc2626'
export const PURPLE = '#7c3aed'
export const GRAY = 'var(--text-secondary, #475569)'
export const BG = 'var(--bg-primary, #f8fafc)'
export const WHITE = 'var(--bg-card, #ffffff)'

export const ACTION_TYPES = ['全部', '修改报告', '审核通过', '审核驳回', '登录', '登出', '导出数据', '修改设置', '批量审核', '打印报告', '数据导入', '系统维护']
export const MODULES = ['全部', '报告管理', '检查管理', '患者管理', '设备管理', '系统设置', '统计报表', '预约管理']
export const PAGE_SIZES = [10, 20, 50, 100]
export const LOG_SOURCES = ['全部', 'Web端', '移动端', 'API接口', '系统自动']
export const QUICK_TIME_FILTERS = [
  { label: '今日', value: 'today' as const },
  { label: '本周', value: 'week' as const },
  { label: '本月', value: 'month' as const },
  { label: '自定义', value: 'custom' as const },
]

export const ACTION_COLORS: Record<string, string> = {
  '修改报告': '#3b82f6',
  '审核通过': '#059669',
  '审核驳回': '#dc2626',
  '登录': '#8b5cf6',
  '登出': '#6b7280',
  '导出数据': '#f59e0b',
  '修改设置': '#14b8a6',
  '批量审核': '#ec4899',
  '打印报告': '#06b6d4',
  '数据导入': '#84cc16',
  '系统维护': '#f97316',
}

export const ACTION_ICONS: Record<string, ReactNode> = {
  '修改报告': <Edit3 size={14} />,
  '审核通过': <CheckCircle size={14} />,
  '审核驳回': <AlertCircle size={14} />,
  '登录': <LogIn size={14} />,
  '登出': <LogOut size={14} />,
  '导出数据': <Download size={14} />,
  '修改设置': <Settings size={14} />,
  '批量审核': <CheckSquare size={14} />,
  '打印报告': <Printer size={14} />,
  '数据导入': <Upload size={14} />,
  '系统维护': <Wrench size={14} />,
}

export const SOURCE_COLORS: Record<string, string> = {
  'Web端': '#3b82f6',
  '移动端': '#10b981',
  'API接口': '#8b5cf6',
  '系统自动': '#f59e0b',
}

export const SOURCE_ICONS: Record<string, ReactNode> = {
  'Web端': <MonitorSmartphone size={12} />,
  '移动端': <Monitor size={12} />,
  'API接口': <Server size={12} />,
  '系统自动': <Zap size={12} />,
}

export const HIPAA_ACTION_CATEGORIES = {
  view: ['查看报告', '查看影像', '查看患者信息'],
  modify: ['修改报告', '修改患者信息'],
  print: ['打印报告', '打印胶片'],
  export: ['导出数据', '批量导出'],
  delete: ['删除报告', '删除影像'],
}

export const HIPAA_ACTION_TYPES = ['全部', ...Object.values(HIPAA_ACTION_CATEGORIES).flat()]

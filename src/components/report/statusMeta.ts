// ============================================================
// G005 放射科RIS系统 v1.0.1 - 报告状态元数据
// Phase R0：14 态状态机的颜色/图标/分组/顺序集中管理
// ============================================================

import type { ReportStatus, ReportStatusGroup } from '../../types';
import {
  Inbox, UserCheck, Edit3, Send,
  Eye, CheckCircle, Shield, CheckCheck,
  Pen, Signature, Globe,
  RefreshCw, FileEdit, Undo2, XCircle, Archive,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';

export interface ReportStatusMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: LucideIcon;
  order: number;
  group: ReportStatusGroup;
  description: string;
}

export const REPORT_STATUS_META: Record<ReportStatus, ReportStatusMeta> = {
  '待分配': {
    label: '待分配', color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db',
    icon: Inbox, order: 1, group: 'draft',
    description: '检查已完成，待分配报告医生',
  },
  '已分配': {
    label: '已分配', color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc',
    icon: UserCheck, order: 2, group: 'draft',
    description: '已分派给报告医生，等待书写',
  },
  '书写中': {
    label: '书写中', color: 'var(--color-primary-800)', bg: '#dbeafe', border: '#93c5fd',
    icon: Edit3, order: 3, group: 'draft',
    description: '医生正在书写报告',
  },
  '已提交': {
    label: '已提交', color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd',
    icon: Send, order: 4, group: 'review',
    description: '已提交，等待初审',
  },
  '初审中': {
    label: '初审中', color: '#7c2d12', bg: '#fed7aa', border: '#fdba74',
    icon: Eye, order: 5, group: 'review',
    description: '高年资主治医师正在初审',
  },
  '初审通过': {
    label: '初审通过', color: '#15803d', bg: '#dcfce7', border: '#86efac',
    icon: CheckCircle, order: 6, group: 'review',
    description: '初审通过，待终审',
  },
  '终审中': {
    label: '终审中', color: '#a16207', bg: '#fef3c7', border: '#fcd34d',
    icon: Shield, order: 7, group: 'review',
    description: '副主任以上医师终审中',
  },
  '已审核': {
    label: '已审核', color: 'var(--color-info-600)', bg: '#cffafe', border: '#67e8f9',
    icon: CheckCheck, order: 8, group: 'review',
    description: '终审通过，待签发',
  },
  '签发中': {
    label: '签发中', color: '#be185d', bg: '#fce7f3', border: '#f9a8d4',
    icon: Pen, order: 9, group: 'sign',
    description: '医生正在电子签发（CA 签名）',
  },
  '已签发': {
    label: '已签发', color: '#047857', bg: '#d1fae5', border: '#6ee7b7',
    icon: Signature, order: 10, group: 'sign',
    description: '报告已签发，待发布',
  },
  '已发布': {
    label: '已发布', color: '#059669', bg: '#d1fae5', border: '#6ee7b7',
    icon: Globe, order: 11, group: 'published',
    description: '已发布给临床/患者',
  },
  '修订中': {
    label: '修订中', color: 'var(--color-warning-600)', bg: '#fef3c7', border: '#fcd34d',
    icon: RefreshCw, order: 12, group: 'special',
    description: '已发布报告正在补充/勘误',
  },
  '已修订': {
    label: '已修订', color: 'var(--color-info-600)', bg: '#cffafe', border: '#67e8f9',
    icon: FileEdit, order: 13, group: 'special',
    description: '报告已修订完成',
  },
  '已撤回': {
    label: '已撤回', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1',
    icon: Undo2, order: 14, group: 'special',
    description: '已发布报告被撤回',
  },
  '已驳回': {
    label: '已驳回', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5',
    icon: XCircle, order: 15, group: 'special',
    description: '审核未通过，报告退回',
  },
  '已归档': {
    label: '已归档', color: '#374151', bg: '#e5e7eb', border: '#9ca3af',
    icon: Archive, order: 16, group: 'special',
    description: '报告已归档到长期存储',
  },
  '已暂停': {
    label: '已暂停', color: 'var(--color-warning-500)', bg: '#fef3c7', border: '#fcd34d',
    icon: RefreshCw, order: 17, group: 'special',
    description: '检查流程已暂停',
  },
  '质控退回': {
    label: '质控退回', color: 'var(--color-error-500)', bg: '#fee2e2', border: '#fca5a5',
    icon: XCircle, order: 18, group: 'special',
    description: '质控审核未通过，已退回',
  },
  // [v3.0.6.11-95 Wave2A P0] 21 态映射层补充: 后端英文/机器态/MSW 归一后的展示元数据
  '草稿': {
    label: '草稿', color: '#78716c', bg: '#f5f5f4', border: '#d6d3d1',
    icon: Edit3, order: 19, group: 'draft',
    description: '报告草稿（WRITING/DRAFT）',
  },
  'CoSign双签': {
    label: '双签', color: '#0f766e', bg: '#ccfbf1', border: '#5eead4',
    icon: CheckCheck, order: 20, group: 'review',
    description: '待双签复核（CO_SIGN_REVIEW）',
  },
  '已升级': {
    label: '已升级', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5',
    icon: AlertCircle, order: 21, group: 'special',
    description: '审核争议已升级处理（ESCALATED）',
  },
  '整改中': {
    label: '整改中', color: 'var(--color-warning-600)', bg: '#fef3c7', border: '#fcd34d',
    icon: RefreshCw, order: 22, group: 'special',
    description: '质控整改中（RECTIFYING）',
  },
  '补充中': {
    label: '补充中', color: 'var(--color-info-600)', bg: '#cffafe', border: '#67e8f9',
    icon: FileEdit, order: 23, group: 'special',
    description: '补充报告撰写中（SUPPLEMENTING）',
  },
  '已补充': {
    label: '已补充', color: '#047857', bg: '#d1fae5', border: '#6ee7b7',
    icon: CheckCircle, order: 24, group: 'special',
    description: '补充报告已完成（SUPPLEMENTED）',
  },
  '跨院区重分配': {
    label: '跨院区重分配', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd',
    icon: RefreshCw, order: 25, group: 'special',
    description: '跨院区重分配中（REDISTRIBUTING）',
  },
};

// 状态显示顺序（按状态机推进顺序）
export const REPORT_STATUS_ORDER: ReportStatus[] = [
  '待分配', '已分配', '书写中', '草稿', '已提交',
  '初审中', '初审通过', '终审中', '已审核', 'CoSign双签',
  '签发中', '已签发', '已发布',
  '修订中', '已修订', '已撤回', '已驳回', '已归档',
  '已暂停', '质控退回', '已升级', '整改中', '补充中', '已补充', '跨院区重分配',
];

// 状态分组（用于 UI Tab/筛选）
export const REPORT_STATUS_GROUPS: Record<ReportStatusGroup, {
  label: string;
  statuses: ReportStatus[];
}> = {
  draft:     { label: '草稿',     statuses: ['待分配', '已分配', '书写中', '草稿'] },
  review:    { label: '审核',     statuses: ['已提交', '初审中', '初审通过', '终审中', '已审核', 'CoSign双签'] },
  sign:      { label: '签发',     statuses: ['签发中', '已签发'] },
  published: { label: '已发布',   statuses: ['已发布'] },
  special:   { label: '特殊',     statuses: ['修订中', '已修订', '已撤回', '已驳回', '已归档', '已暂停', '质控退回', '已升级', '整改中', '补充中', '已补充', '跨院区重分配'] },
};

// [v3.0.6.11-95 Wave2A P0] 统一中英文映射层:
//   后端英文 state (Prisma enum ReportState) / reportMachine 状态名 / MSW 状态 → 规范中文
// 原则: 内部逻辑比较用 toEnState (英文枚举), 展示用 displayStatus/normalizeReportStatus (中文)
export const REPORT_EN_STATES = [
  'PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING', 'DRAFT', 'SUBMITTED',
  'INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW', 'REVIEWED', 'SIGNING',
  'SIGNED', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'AMENDING', 'AMENDED',
  'SUPPLEMENTING', 'SUPPLEMENTED', 'RECTIFYING', 'REDISTRIBUTING',
  'ESCALATED', 'ARCHIVED',
];

// 后端英文 → 规范中文 (21+1 态, 以 reportMachine REPORT_STATE_LABEL 为准)
export const EN_STATE_TO_CN: Record<string, string> = {
  PENDING_ASSIGNMENT: '待分配',
  ASSIGNED: '已分配',
  WRITING: '书写中',
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  INITIAL_REVIEW: '初审中',
  FINAL_REVIEW: '终审中',
  CO_SIGN_REVIEW: 'CoSign双签',
  REVIEWED: '已审核',
  SIGNING: '签发中',
  SIGNED: '已签发',
  PUBLISHED: '已发布',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  AMENDING: '修订中',
  AMENDED: '已修订',
  SUPPLEMENTING: '补充中',
  SUPPLEMENTED: '已补充',
  RECTIFYING: '整改中',
  REDISTRIBUTING: '跨院区重分配',
  ESCALATED: '已升级',
  ARCHIVED: '已归档',
};

// reportMachine 状态名 (camelCase) → 规范中文
const MACHINE_STATE_TO_CN: Record<string, string> = {
  pendingAssignment: '待分配', assigned: '已分配', writing: '书写中',
  submitted: '已提交', initialReview: '初审中', finalReview: '终审中',
  coSignReview: 'CoSign双签', reviewed: '已审核', signing: '签发中',
  signed: '已签发', published: '已发布', amending: '修订中', amended: '已修订',
  withdrawn: '已撤回', rejected: '已驳回', escalated: '已升级', archived: '已归档',
  rectifying: '整改中', supplementing: '补充中', supplemented: '已补充',
  redistributing: '跨院区重分配',
};

// MSW 小写状态 → 规范中文 (双兼容: MSW 中文 + 后端英文)
const MSW_STATUS_TO_CN: Record<string, string> = {
  draft: '草稿', submitted: '已提交', inreview: '初审中', reviewed: '已审核',
  signed: '已签发', published: '已发布', rejected: '已驳回', cosigned: 'CoSign双签',
  amended: '已修订', withdrawn: '已撤回', revised: '已修订', pending: '已提交',
};

// 中文别名 → 规范中文 (旧系统称呼 / 任务口径)
const CN_ALIAS_TO_CN: Record<string, string> = {
  '初核': '初审中', '终核': '终审中', '双签': 'CoSign双签', '双签审核': 'CoSign双签',
  '已双签': 'CoSign双签', '已签署': '已签发', '重分配中': '跨院区重分配',
  '重新分配中': '跨院区重分配', '待签署': '签发中', '审核中': '初审中',
  '待审': '初审中', '审核': '初审中',
};

// 兼容旧 5 态别名（用于平滑迁移）
export const LEGACY_STATUS_ALIAS: Record<string, ReportStatus> = {
  '未开始':  '待分配',
  '书写中':  '书写中',
  '待审核':  '已提交',
  '已审核':  '已审核',
  '已发布':  '已发布',
  '已驳回':  '已驳回',
  '已修改':  '已修订',
  '已退回':  '已驳回',
  '已暂停':  '已暂停',
  '质控退回': '质控退回',
};

// ============================================================
// [W14-UX] 统一状态色工具 (供工作列表/检查/报告/审核等高流页面复用)
//   通过 normalizeReportStatus 归一后查 REPORT_STATUS_META, 消除各页重复的色值映射
// ============================================================
export interface SharedStatusColor {
  label: string;
  color: string;
  bg: string;
  border: string;
  order: number;
}

/** 任一状态输入 (英文枚举/机器态/MSW/中文别名) → 统一显示色 (含描边) */
export function getReportStatusColor(status: string | null | undefined): SharedStatusColor {
  const key = normalizeReportStatus(String(status ?? ''));
  const meta = REPORT_STATUS_META[key as ReportStatus];
  if (!meta) {
    return { label: key, color: 'var(--text-secondary, #475569)', bg: 'var(--bg-deep, #f1f5f9)', border: 'var(--border-color, #e2e8f0)', order: 99 };
  }
  return { label: meta.label, color: meta.color, bg: meta.bg, border: meta.border, order: meta.order };
}

/** 带透明度背景的紧凑徽标样式 (如 #3b82f622), 用于列表状态标签 */
export function getReportStatusBadge(status: string | null | undefined): { label: string; color: string; bg: string; order: number } {
  const c = getReportStatusColor(status);
  return { label: c.label, color: c.color, bg: c.bg, order: c.order };
}

// 规范中文 → 后端英文 (toEnState 反查)
const CN_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_STATE_TO_CN).map(([en, cn]) => [cn, en]),
);

// 兼容性别名转换 [v3.0.6.11-95 Wave2A P0]: 先查英文→中文, 再查中文别名 (双兼容)
export function normalizeReportStatus(status: string): ReportStatus {
  const key = String(status ?? '').trim();
  if (!key) return '待分配';
  if (EN_STATE_TO_CN[key]) return EN_STATE_TO_CN[key] as ReportStatus;
  const upper = key.toUpperCase();
  if (EN_STATE_TO_CN[upper]) return EN_STATE_TO_CN[upper] as ReportStatus;
  if (MACHINE_STATE_TO_CN[key]) return MACHINE_STATE_TO_CN[key] as ReportStatus;
  if (MSW_STATUS_TO_CN[key.toLowerCase()]) return MSW_STATUS_TO_CN[key.toLowerCase()] as ReportStatus;
  if (CN_ALIAS_TO_CN[key]) return CN_ALIAS_TO_CN[key] as ReportStatus;
  return (LEGACY_STATUS_ALIAS[key] || key) as ReportStatus;
}

// 显示中文 (经映射层, 任一输入形态 → 规范中文)
export function displayStatus(status: string | null | undefined): string {
  const n = normalizeReportStatus(String(status ?? ''));
  return REPORT_STATUS_META[n]?.label ?? n;
}

// 规范英文枚举 (任一输入形态 → 大写英文, 供 CAN_* 等逻辑判断)
export function toEnState(status: string | null | undefined): string {
  const key = String(status ?? '').trim();
  if (!key) return 'PENDING_ASSIGNMENT';
  const upper = key.toUpperCase();
  if (REPORT_EN_STATES.includes(upper)) return upper;
  const cn = normalizeReportStatus(key);
  if (CN_TO_EN[cn]) return CN_TO_EN[cn];
  if (MSW_STATUS_TO_CN[key.toLowerCase()]) return CN_TO_EN[MSW_STATUS_TO_CN[key.toLowerCase()] ?? ''] ?? upper;
  return upper;
}

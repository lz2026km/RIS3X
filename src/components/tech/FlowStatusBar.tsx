// [v3.0.6.11-103 Wave 11] 技师工作站 - 流程状态条 (FlowStatusBar)
// 展示检查状态机: 已预约→已报到→检查中→已完成→已审核→已发布→已归档 (7 态 Steps)
// 当前状态高亮 + 下一步操作按钮 (一键流转), 供 TechWorkbenchPage / ExamDetailView 复用。
import { Steps, Tag } from 'antd'
import { ArrowRight, CheckCircle2, ClipboardCheck, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { normalizeExamStatus, displayExamStatus } from '../../utils/statusMaps'
import { t } from '../../i18n/appI18n'

// ============================================================
// 7 态流程 (与后端 WORKLIST_STATES + 报告终态对齐)
// ============================================================
export const FLOW_STEPS = [
  { key: 'SCHEDULED', labelKey: 'flowStatus.stepScheduled' },
  { key: 'ARRIVED', labelKey: 'flowStatus.stepArrived' },
  { key: 'IN_PROGRESS', labelKey: 'flowStatus.stepInProgress' },
  { key: 'COMPLETED', labelKey: 'flowStatus.stepCompleted' },
  { key: 'REVIEWED', labelKey: 'flowStatus.stepReviewed' },
  { key: 'PUBLISHED', labelKey: 'flowStatus.stepPublished' },
  { key: 'ARCHIVED', labelKey: 'flowStatus.stepArchived' },
] as const

// 实际 exam 状态 → 流程步骤下标 (QC 扩展态归并)
export function examStatusToStep(status: string): number {
  const s = normalizeExamStatus(status)
  switch (s) {
    case 'SCHEDULED': return 0
    case 'ARRIVED': return 1
    case 'IN_PROGRESS':
    case 'PAUSED': return 2
    case 'COMPLETED':
    case 'IMAGE_READY':
    case 'QC_REJECT': return 3
    case 'QC_PASS':
    case 'PENDING_REPORT': return 4
    case 'PUBLISHED': return 5
    case 'ARCHIVED': return 6
    default: return 0
  }
}

export type FlowAction = 'checkin' | 'start' | 'complete' | 'resume' | 'retake'

export interface FlowStatusBarProps {
  /** 归一化前的 exam 状态 (兼容中英文) */
  status: string
  /** 一键流转回调 (由宿主页触发确认/强制检查) */
  onAction?: (action: FlowAction) => void
  /** 操作进行中 (按钮 loading/禁用) */
  busy?: boolean
  /** 是否展示下一步操作按钮 */
  showAction?: boolean
}

const ACTION_META: Record<FlowAction, { icon: React.ReactNode; labelKey: string; color: string; bg: string }> = {
  checkin: { icon: <ClipboardCheck size={13} />, labelKey: 'flowStatus.actionCheckin', color: 'var(--color-primary-600)', bg: '#dbeafe' },
  start: { icon: <Play size={13} />, labelKey: 'flowStatus.actionStart', color: '#7c3aed', bg: '#ede9fe' },
  complete: { icon: <CheckCircle2 size={13} />, labelKey: 'flowStatus.actionComplete', color: '#059669', bg: '#d1fae5' },
  resume: { icon: <RotateCcw size={13} />, labelKey: 'flowStatus.actionResume', color: 'var(--color-success-600)', bg: '#dcfce7' },
  retake: { icon: <RefreshCw size={13} />, labelKey: 'flowStatus.actionRetake', color: 'var(--color-error-600)', bg: '#fee2e2' },
}

/** 当前状态 → 下一步动作 (无动作返回 null) */
export function nextFlowAction(status: string): FlowAction | null {
  const s = normalizeExamStatus(status)
  switch (s) {
    case 'SCHEDULED': return 'checkin'
    case 'ARRIVED': return 'start'
    case 'IN_PROGRESS': return 'complete'
    case 'PAUSED': return 'resume'
    case 'QC_REJECT': return 'retake'
    default: return null
  }
}

export default function FlowStatusBar({ status, onAction, busy = false, showAction = true }: FlowStatusBarProps) {
  const normalized = normalizeExamStatus(status)
  const step = examStatusToStep(normalized)
  const next = showAction ? nextFlowAction(normalized) : null

  return (
    <div
      data-testid="flow-status-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        background: 'var(--content-bg, #f8fafc)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: 10,
        padding: '10px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', whiteSpace: 'nowrap' }}>
        <ArrowRight size={13} />
        {t('techWorkbench.flowTitle')}
        <Tag
          style={{ marginLeft: 2, fontSize: 11, fontWeight: 700 }}
          color={step >= 3 ? 'green' : step === 2 ? 'pink' : step === 1 ? 'purple' : 'blue'}
        >
          {displayExamStatus(normalized)}
        </Tag>
      </div>

      <Steps
        size="small"
        current={step}
        items={FLOW_STEPS.map(s => ({ title: t(s.labelKey) }))}
        style={{ flex: 1, minWidth: 480 }}
      />

      {next && (
        <button
          type="button"
          onClick={() => onAction?.(next)}
          disabled={busy}
          data-testid={`flow-action-${next}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 700,
            color: ACTION_META[next].color, background: ACTION_META[next].bg,
            opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          {ACTION_META[next].icon}
          {t(ACTION_META[next].labelKey)}
        </button>
      )}
      {!next && (
        <span style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', whiteSpace: 'nowrap' }}>
          {step >= 6 ? t('flowStatus.hintNoAction') : t('flowStatus.hintWaitReview')}
        </span>
      )}
    </div>
  )
}

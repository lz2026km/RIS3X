import { useMemo, useState, type ReactNode } from 'react'
import { Button, Empty, Skeleton, Tag, Dropdown, Popconfirm } from 'antd'
import { Eye, Printer, Download, User, Zap, ShieldCheck, ChevronDown, ChevronRight, Search, MoreHorizontal, Edit3, Send, GitCompare, RotateCcw, FileCheck2, Trash2, History, Activity, RefreshCw, ArrowLeftRight, ArrowUp, PenLine, AlertTriangle, Radar, Save } from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge, StatusTimeline, REPORT_STATUS_META } from '../../components/report'
// [v3.0.6.11-103 Wave 6] 表格统一: ProTable → DataTable (斑马纹/行高/列头/分页统一)
import { DataTable } from '../../components/common/DataTable'
// [W14-UX] 右键上下文菜单项类型
import type { ContextMenuItem } from '../../components/common/ContextMenu'
import type { ProColumn } from '../../components/data/ProTable'
import type { TableColumnsType } from 'antd'
import { formatDateTime } from '../../utils/date';
import { usePagination } from '../../hooks/usePagination';
import { CAN_SUPPLEMENT, CAN_RECTIFY, CAN_REDISTRIBUTE, CAN_ESCALATE, isReportWritable, isDraftOverdue } from './reportUtils';
import { normalizeReportStatus, toEnState } from '../../components/report/statusMeta';
import { t } from '../../i18n/appI18n';

const PRIMARY = 'var(--color-primary-800)'
const DANGER = 'var(--color-error-600)'

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string }> = {
  待审核: { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '#c4b5fd' },
  已修改: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: 'var(--color-warning-border)' },
  已退回: { bg: 'var(--color-error-bg)', color: 'var(--color-error)', border: 'var(--color-error-border)' },
  ...REPORT_STATUS_META,
}

const ANOMALY_KEYWORDS = [
  '结节', '血肿', '占位', '狭窄', '肿块', '转移', '骨折', '渗出',
  '积水', '压迫', '突出', '钙化', '增粗', '模糊', '不张', '增厚',
]

function highlightAnomalies(text: string | undefined): ReactNode {
  if (!text) return text
  const parts: ReactNode[] = []
  let lastIndex = 0
  const regex = new RegExp(`(${ANOMALY_KEYWORDS.join('|')})`, 'g')
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(<span key={match.index} style={{ background: 'var(--color-error-bg)', color: DANGER, fontWeight: 700, borderRadius: 2, padding: '0 2px' }}>{match[0]}</span>)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : text
}



function QualityBadge({ score }: { score?: number }) {
  const [showTooltip, setShowTooltip] = useState(false)
  if (score === undefined || score === null) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>-</span>
  const color = score >= 80 ? '#059669' : score >= 60 ? 'var(--color-warning-600)' : 'var(--color-error-600)'
  const background = score >= 80 ? 'var(--color-success-bg)' : score >= 60 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)'
  const label = score >= 80 ? t('rptTable.quality.excellent') : score >= 60 ? t('rptTable.quality.good') : t('rptTable.quality.improve')
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 12, fontWeight: 700, background, color, cursor: 'help' }}>{score}</span>
      {showTooltip && <span style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 'var(--space-1, 4px)', background: '#1e293b', color: '#fff', fontSize: 12, borderRadius: 4, padding: '4px 8px', whiteSpace: 'nowrap', zIndex: 10 }}>{t('rptTable.qualityTooltip', { label, score })}</span>}
    </span>
  )
}

export interface ReportTableViewProps {
  reports: RadiologyReport[]
  expandedId: string | null
  onToggleExpand: (id: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onView: (report: RadiologyReport) => void
  onReview: (report: RadiologyReport) => void
  onPrint: (report: RadiologyReport) => void
  onReject: (report: RadiologyReport) => void
  onExportPDF: (report: RadiologyReport) => void
  // [W2-3] 增强行操作
  onRevise?: (report: RadiologyReport) => void
  onRepublish?: (report: RadiologyReport) => void
  onRequestApproval?: (report: RadiologyReport) => void
  onDeliver?: (report: RadiologyReport) => void
  onCritical?: (report: RadiologyReport) => void
  onCompare?: (report: RadiologyReport) => void
  // [G005 W2-C] 行删除 (Popconfirm) / 审计轨迹
  onDelete?: (report: RadiologyReport) => void
  onAudit?: (report: RadiologyReport) => void
  // [v3.0.6.11-92 Wave1B P0] 创建随访 / 报告特殊态
  onCreateFollowUp?: (report: RadiologyReport) => void
  onSupplement?: (report: RadiologyReport) => void
  onRectify?: (report: RadiologyReport) => void
  onRedistribute?: (report: RadiologyReport) => void
  onEscalate?: (report: RadiologyReport) => void
  // [v3.0.6.11-95 Wave2B P1] 报告列表 → 书写页入口
  onWrite?: (report: RadiologyReport) => void
  // [v3.0.6.11-95 Wave3B P1] 患者画像入口 → /patients/:id/360
  onOpen360?: (report: RadiologyReport) => void
  // [v3.0.6.11-99 Wave7B] 离线报告包: 行操作「离线保存」(保存 HTML 快照到 IndexedDB)
  onOfflineSave?: (report: RadiologyReport) => void
  deletingIds?: Set<string>
  loading?: boolean
}

export default function ReportTableView({
  reports,
  expandedId,
  onToggleExpand,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onView,
  onReview,
  onPrint,
  onExportPDF,
  onRevise,
  onRepublish,
  onRequestApproval,
  onDeliver,
  onCritical,
  onCompare,
  onDelete,
  onAudit,
  onCreateFollowUp,
  onSupplement,
  onRectify,
  onRedistribute,
  onEscalate,
  onWrite,
  onOpen360,
  onOfflineSave,
  deletingIds,
  loading = false,
}: ReportTableViewProps) {
  // [W3-C] 受控分页: 报告列表 (全量数据前端切片)
  const listPagination = usePagination(reports, 10);
  // [W14-UX] 右键行操作 (查看/打印/导出/审核/危急值/删除)
  const buildReportContextItems = (report: RadiologyReport): ContextMenuItem[] => {
    const isPending = ['SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW'].includes(toEnState(report.status));
    return [
      { key: 'view', label: t('w14Ux.contextMenu.view'), onSelect: () => onView(report) },
      { key: 'print', label: t('w14Ux.contextMenu.print'), onSelect: () => onPrint(report) },
      { key: 'export', label: t('w14Ux.contextMenu.export'), onSelect: () => onExportPDF(report) },
      ...(isPending
        ? [{ key: 'review', label: t('w14Ux.contextMenu.approve'), dividerBefore: true, onSelect: () => onReview(report) }]
        : []),
      ...(onCritical
        ? [{ key: 'critical', label: t('w14Ux.contextMenu.markCritical'), onSelect: () => onCritical(report) }]
        : []),
      ...(onDelete
        ? [
            {
              key: 'delete',
              label: t('rptTable.delete'),
              danger: true,
              confirm: t('w14Ux.contextMenu.confirmDelete'),
              dividerBefore: true,
              onSelect: () => onDelete(report),
            } as ContextMenuItem,
          ]
        : []),
    ];
  };
  const columns = useMemo<ProColumn<RadiologyReport>[]>(() => [
    {
      title: t('rptTable.col.patient'),
      dataIndex: 'patientName',
      key: 'patientName',
      width: 180,
      searchable: true,
      sorter: (a, b) => a.patientName.localeCompare(b.patientName, 'zh-CN'),
      render: (value, report) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-info-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><User size={14} color={PRIMARY} /></span>
          <span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)' }}>{String(value)} {report.criticalFinding && <Zap size={11} color={DANGER} />}</span>
            <span style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>{report.gender} · {report.age}{t('rptTable.yearsOld')} · {report.patientType}</span>
          </span>
        </span>
      ),
    },
    {
      title: t('rptTable.col.examItem'),
      dataIndex: 'examItemName',
      key: 'examItemName',
      width: 180,
      searchable: true,
      sorter: (a, b) => a.examItemName.localeCompare(b.examItemName, 'zh-CN'),
      render: (value, report) => <span><span style={{ display: 'block', fontWeight: 500, color: 'var(--text-secondary)' }}>{String(value)}</span><span style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>{report.modality} · {report.bodyPart}</span></span>,
    },
    {
      title: t('rptTable.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: Object.keys(STATUS_CONFIG).map((value) => ({ text: value, value })),
      onFilter: (value, report) => normalizeReportStatus(report.status) === value,
      sorter: (a, b) => String(a.status).localeCompare(String(b.status), 'zh-CN'),
      render: (value, report) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
          <StatusBadge status={String(value)} size="sm" />
          {/* [v3.0.6.11-95 Wave2B P1] 草稿超时角标: DRAFT/WRITING 且 updatedTime 超 24h */}
          {isDraftOverdue(report.status, report.updatedTime) && (
            <Tag color="orange" icon={<AlertTriangle size={10} />} style={{ fontSize: 11, margin: 0 }}>{t('rptTable.draftOverdue')}</Tag>
          )}
        </span>
      ),
    },
    { title: t('rptTable.col.reportDoctor'), dataIndex: 'reportDoctorName', key: 'reportDoctorName', width: 110, searchable: true, render: (value) => String(value || '-') },
    { title: t('rptTable.col.auditor'), dataIndex: 'auditorName', key: 'auditorName', width: 110, searchable: true, render: (value) => String(value || '-') },
    { title: t('rptTable.col.createdTime'), dataIndex: 'createdTime', key: 'createdTime', width: 150, sorter: (a, b) => String(a.createdTime).localeCompare(String(b.createdTime)), defaultSortOrder: 'descend', render: (value) => formatDateTime(String(value)) },
    { title: t('rptTable.col.quality'), dataIndex: 'qualityScore', key: 'qualityScore', width: 80, sorter: (a, b) => (a.qualityScore ?? 0) - (b.qualityScore ?? 0), render: (value) => <QualityBadge score={typeof value === 'number' ? value : undefined} /> },
    {
      title: t('rptTable.col.actions'),
      dataIndex: 'id',
      key: 'actions',
      fixed: 'right',
      width: 320,
      render: (_value, report) => {
        const isPending = ['SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW'].includes(toEnState(report.status))
        const menuItems = [
          // [v3.0.6.11-95 Wave2B P1] 报告列表 → 书写页入口 (可写态: 继续书写; 已发布/已签署: 查看)
          ...(onWrite ? [{ key: 'write', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PenLine size={12} /> {isReportWritable(report.status) ? t('rptTable.menu.write') : t('rptTable.menu.view')}</span> }] : []),
          // [v3.0.6.11-95 Wave3B P1] 患者画像入口
          ...(onOpen360 ? [{ key: 'open360', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Radar size={12} /> {t('rptTable.menu.open360')}</span> }] : []),
          ...(onRevise ? [{ key: 'revise', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Edit3 size={12} /> {t('rptTable.menu.revise')}</span> }] : []),
          ...(onRepublish ? [{ key: 'republish', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RotateCcw size={12} /> {t('rptTable.menu.republish')}</span> }] : []),
          ...(onRequestApproval ? [{ key: 'approval', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileCheck2 size={12} /> {t('rptTable.menu.approval')}</span> }] : []),
          ...(onDeliver ? [{ key: 'deliver', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Send size={12} /> {t('rptTable.menu.deliver')}</span> }] : []),
          ...(onCritical ? [{ key: 'critical', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={12} /> {t('rptTable.menu.critical')}</span> }] : []),
          ...(onCompare ? [{ key: 'compare', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GitCompare size={12} /> {t('rptTable.menu.compare')}</span> }] : []),
          ...(onAudit ? [{ key: 'audit', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><History size={12} /> {t('rptTable.menu.audit')}</span> }] : []),
          ...(onCreateFollowUp ? [{ key: 'followup', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={12} /> {t('rptTable.menu.followup')}</span> }] : []),
          // [v3.0.6.11-92 Wave1B P0] 报告特殊态 (按状态启用, 对齐 backend REPORT_TRANSITIONS)
          ...(onSupplement && CAN_SUPPLEMENT.includes(toEnState(report.status)) ? [{ key: 'supplement', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileCheck2 size={12} /> {t('rptTable.menu.supplement')}</span> }] : []),
          ...(onRectify && CAN_RECTIFY.includes(toEnState(report.status)) ? [{ key: 'rectify', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={12} /> {t('rptTable.menu.rectify')}</span> }] : []),
          ...(onRedistribute && CAN_REDISTRIBUTE.includes(toEnState(report.status)) ? [{ key: 'redistribute', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ArrowLeftRight size={12} /> {t('rptTable.menu.redistribute')}</span> }] : []),
          ...(onEscalate && CAN_ESCALATE.includes(toEnState(report.status)) ? [{ key: 'escalate', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ArrowUp size={12} /> {t('rptTable.menu.escalate')}</span> }] : []),
        ]
        return (
          <span style={{ display: 'flex', gap: 'var(--space-1, 4px)', alignItems: 'center' }}>
            <Button size="small" icon={<Eye size={12} />} onClick={(event) => { event.stopPropagation(); onView(report) }} title={t('rptTable.tip.view')} />
            <Button size="small" icon={<Printer size={12} />} onClick={(event) => { event.stopPropagation(); onPrint(report) }} title={t('rptTable.tip.print')} />
            <Button size="small" icon={<Download size={12} />} onClick={(event) => { event.stopPropagation(); onExportPDF(report) }} title={t('rptTable.tip.exportPdf')} />
            {/* [v3.0.6.11-99 Wave7B] 离线报告包: 保存 HTML 快照到 IndexedDB */}
            {onOfflineSave && (
              <Button size="small" icon={<Save size={12} />} onClick={(event) => { event.stopPropagation(); onOfflineSave(report) }} title={t('rptTable.tip.offlineSave')} />
            )}
            {isPending && <Button size="small" type="primary" icon={<ShieldCheck size={12} />} onClick={(event) => { event.stopPropagation(); onReview(report) }}>{t('rptTable.review')}</Button>}
            {menuItems.length > 0 && (
              <Dropdown
                menu={{
                  items: menuItems,
                  onClick: ({ key, domEvent }) => {
                    domEvent.stopPropagation()
                    if (key === 'write') onWrite?.(report)
                    else if (key === 'open360') onOpen360?.(report)
                    else if (key === 'revise') onRevise?.(report)
                    else if (key === 'republish') onRepublish?.(report)
                    else if (key === 'approval') onRequestApproval?.(report)
                    else if (key === 'deliver') onDeliver?.(report)
                    else if (key === 'critical') onCritical?.(report)
                    else if (key === 'compare') onCompare?.(report)
                    else if (key === 'audit') onAudit?.(report)
                    else if (key === 'followup') onCreateFollowUp?.(report)
                    else if (key === 'supplement') onSupplement?.(report)
                    else if (key === 'rectify') onRectify?.(report)
                    else if (key === 'redistribute') onRedistribute?.(report)
                    else if (key === 'escalate') onEscalate?.(report)
                  },
                }}
                trigger={['click']}
              >
                <Button size="small" icon={<MoreHorizontal size={12} />} title={t('rptTable.moreActions')} onClick={(e) => e.stopPropagation()} />
              </Dropdown>
            )}
            {onDelete && (
              <Popconfirm
                title={t('rptTable.deleteReport')}
                description={`确认删除报告 ${report.reportId}？(状态将置为已撤回)`}
                okText={t('rptTable.delete')}
                okButtonProps={{ danger: true }}
                cancelText={t('rptTable.cancel')}
                onConfirm={(event) => { event?.stopPropagation(); onDelete(report) }}
                onCancel={(event) => event?.stopPropagation()}
              >
                <Button
                  size="small"
                  danger
                  loading={deletingIds?.has(report.id)}
                  icon={<Trash2 size={12} />}
                  title={t('rptTable.tip.delete')}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            )}
            <Button size="small" icon={expandedId === report.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />} onClick={(event) => { event.stopPropagation(); onToggleExpand(report.id) }} title={t('rptTable.tip.more')} />
          </span>
        )
      },
    },
  ], [expandedId, onExportPDF, onPrint, onReview, onRevise, onRepublish, onRequestApproval, onDeliver, onCritical, onCompare, onAudit, onDelete, deletingIds, onToggleExpand, onView, onCreateFollowUp, onSupplement, onRectify, onRedistribute, onEscalate, onWrite, onOpen360, onOfflineSave]);

  return (
    <DataTable<RadiologyReport>
      columns={columns as unknown as TableColumnsType<RadiologyReport>}
      dataSource={listPagination.pageData}
      rowKey="id"
      loading={{ spinning: loading, indicator: <div style={{ padding: 'var(--space-6, 24px)' }}><Skeleton active title={false} paragraph={{ rows: 8 }} /></div> }}
      pagination={listPagination.pagination}
      scroll={{ x: 1250 }}
      columnConfigKey="report-table"
      alwaysVisibleColumns={["actions"]}
      contextMenuTestId="report-context-menu"
      contextMenuItems={buildReportContextItems}
      rowSelection={{
        preserveSelectedRowKeys: true,
        selectedRowKeys: [...selectedIds],
        onSelect: (report) => onToggleSelect(report.id),
        onSelectAll: (selected) => { if (selected) onSelectAll(); else onDeselectAll() },
      }}
      expandable={{
        expandedRowKeys: expandedId ? [expandedId] : [],
        onExpand: (expanded, report) => {
          if (expanded !== (expandedId === report.id)) onToggleExpand(report.id)
        },
        expandedRowRender: (report) => (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 'var(--space-3, 12px)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('rptTable.findings')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, background: 'var(--bg-card)', borderRadius: 6, padding: '6px 10px', border: '1px solid var(--border-color)', maxHeight: 80, overflow: 'auto' }}>{highlightAnomalies(report.examFindings) || t('rptTable.notFilled')}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('rptTable.diagnosis')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, background: 'var(--bg-card)', borderRadius: 6, padding: '6px 10px', border: '1px solid var(--border-color)', maxHeight: 80, overflow: 'auto' }}>{highlightAnomalies(report.diagnosis) || t('rptTable.notFilled')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center', fontSize: 12, color: '#64748b' }}>
              <StatusTimeline report={report} />
              <span style={{ marginLeft: 'auto' }}>{t('rptTable.reportLabel')} {report.reportDoctorName || '-'}</span>
              {report.auditorName && <span>{t('rptTable.auditorLabel')} {report.auditorName}</span>}
              {report.qualityScore !== undefined && <Tag>{t('rptTable.scoreLabel', { score: report.qualityScore })}</Tag>}
            </div>
          </div>
        ),
      }}
      locale={{ emptyText: <Empty image={<Search size={32} style={{ color: "#94a3b8" }} />} description={<span style={{ fontSize: 12, color: "#94a3b8" }}>{t('rptTable.empty')}</span>} /> }}
      onRow={(report) => ({ onClick: () => onView(report), style: { cursor: 'pointer' } })}
    />
  )
}

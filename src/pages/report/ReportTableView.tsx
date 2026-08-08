import { useMemo, useState, type ReactNode } from 'react'
import { Button, Empty, Skeleton, Tag, Dropdown, Popconfirm } from 'antd'
import { Eye, Printer, Download, User, Zap, ShieldCheck, ChevronDown, ChevronRight, Search, MoreHorizontal, Edit3, Send, GitCompare, RotateCcw, FileCheck2, Trash2, History } from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge, StatusTimeline, REPORT_STATUS_META } from '../../components/report'
import { ProTable, type ProColumn } from '../../components/data/ProTable'
import { formatDateTime } from '../../utils/date';
import { usePagination } from '../../hooks/usePagination';

const PRIMARY = '#1e40af'
const DANGER = '#dc2626'

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string }> = {
  待审核: { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  已审核: { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
  已发布: { bg: '#d1fae5', color: '#047857', border: '#6ee7b7' },
  已修改: { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  已退回: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
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
    parts.push(<span key={match.index} style={{ background: '#fee2e2', color: DANGER, fontWeight: 700, borderRadius: 2, padding: '0 2px' }}>{match[0]}</span>)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : text
}



function QualityBadge({ score }: { score?: number }) {
  const [showTooltip, setShowTooltip] = useState(false)
  if (score === undefined || score === null) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>-</span>
  const color = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626'
  const background = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : '#fee2e2'
  const label = score >= 80 ? '优秀' : score >= 60 ? '良好' : '待改进'
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 12, fontWeight: 700, background, color, cursor: 'help' }}>{score}</span>
      {showTooltip && <span style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: '#1e293b', color: '#fff', fontSize: 12, borderRadius: 4, padding: '4px 8px', whiteSpace: 'nowrap', zIndex: 10 }}>{label} · 评分: {score}/100</span>}
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
  deletingIds,
  loading = false,
}: ReportTableViewProps) {
  // [W3-C] 受控分页: 报告列表 (全量数据前端切片)
  const listPagination = usePagination(reports, 10);
  const columns = useMemo<ProColumn<RadiologyReport>[]>(() => [
    {
      title: '患者信息',
      dataIndex: 'patientName',
      key: 'patientName',
      width: 180,
      searchable: true,
      sorter: (a, b) => a.patientName.localeCompare(b.patientName, 'zh-CN'),
      render: (value, report) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><User size={14} color={PRIMARY} /></span>
          <span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#1e293b' }}>{String(value)} {report.criticalFinding && <Zap size={11} color={DANGER} />}</span>
            <span style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>{report.gender} · {report.age}岁 · {report.patientType}</span>
          </span>
        </span>
      ),
    },
    {
      title: '检查项目',
      dataIndex: 'examItemName',
      key: 'examItemName',
      width: 180,
      searchable: true,
      sorter: (a, b) => a.examItemName.localeCompare(b.examItemName, 'zh-CN'),
      render: (value, report) => <span><span style={{ display: 'block', fontWeight: 500, color: '#334155' }}>{String(value)}</span><span style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>{report.modality} · {report.bodyPart}</span></span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: Object.keys(STATUS_CONFIG).map((value) => ({ text: value, value })),
      onFilter: (value, report) => report.status === value,
      sorter: (a, b) => String(a.status).localeCompare(String(b.status), 'zh-CN'),
      render: (value) => <StatusBadge status={String(value)} size="sm" />,
    },
    { title: '报告医生', dataIndex: 'reportDoctorName', key: 'reportDoctorName', width: 110, searchable: true, render: (value) => String(value || '-') },
    { title: '审核医生', dataIndex: 'auditorName', key: 'auditorName', width: 110, searchable: true, render: (value) => String(value || '-') },
    { title: '创建时间', dataIndex: 'createdTime', key: 'createdTime', width: 150, sorter: (a, b) => String(a.createdTime).localeCompare(String(b.createdTime)), defaultSortOrder: 'descend', render: (value) => formatDateTime(String(value)) },
    { title: '质量', dataIndex: 'qualityScore', key: 'qualityScore', width: 80, sorter: (a, b) => (a.qualityScore ?? 0) - (b.qualityScore ?? 0), render: (value) => <QualityBadge score={typeof value === 'number' ? value : undefined} /> },
    {
      title: '操作',
      dataIndex: 'id',
      key: 'actions',
      fixed: 'right',
      width: 320,
      render: (_value, report) => {
        const isPending = report.status === '待审核'
        const menuItems = [
          ...(onRevise ? [{ key: 'revise', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Edit3 size={12} /> 修订</span> }] : []),
          ...(onRepublish ? [{ key: 'republish', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RotateCcw size={12} /> 补发（重新发布）</span> }] : []),
          ...(onRequestApproval ? [{ key: 'approval', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileCheck2 size={12} /> 申请审批导出</span> }] : []),
          ...(onDeliver ? [{ key: 'deliver', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Send size={12} /> 分发 / 推送</span> }] : []),
          ...(onCritical ? [{ key: 'critical', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={12} /> 转危急值</span> }] : []),
          ...(onCompare ? [{ key: 'compare', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GitCompare size={12} /> 版本对比</span> }] : []),
          ...(onAudit ? [{ key: 'audit', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><History size={12} /> 审计轨迹</span> }] : []),
        ]
        return (
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Button size="small" icon={<Eye size={12} />} onClick={(event) => { event.stopPropagation(); onView(report) }} title="查看" />
            <Button size="small" icon={<Printer size={12} />} onClick={(event) => { event.stopPropagation(); onPrint(report) }} title="打印" />
            <Button size="small" icon={<Download size={12} />} onClick={(event) => { event.stopPropagation(); onExportPDF(report) }} title="导出PDF" />
            {isPending && <Button size="small" type="primary" icon={<ShieldCheck size={12} />} onClick={(event) => { event.stopPropagation(); onReview(report) }}>审核</Button>}
            {menuItems.length > 0 && (
              <Dropdown
                menu={{
                  items: menuItems,
                  onClick: ({ key, domEvent }) => {
                    domEvent.stopPropagation()
                    if (key === 'revise') onRevise?.(report)
                    else if (key === 'republish') onRepublish?.(report)
                    else if (key === 'approval') onRequestApproval?.(report)
                    else if (key === 'deliver') onDeliver?.(report)
                    else if (key === 'critical') onCritical?.(report)
                    else if (key === 'compare') onCompare?.(report)
                    else if (key === 'audit') onAudit?.(report)
                  },
                }}
                trigger={['click']}
              >
                <Button size="small" icon={<MoreHorizontal size={12} />} title="更多操作" onClick={(e) => e.stopPropagation()} />
              </Dropdown>
            )}
            {onDelete && (
              <Popconfirm
                title="删除报告"
                description={`确认删除报告 ${report.reportId}？(状态将置为已撤回)`}
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={(event) => { event?.stopPropagation(); onDelete(report) }}
                onCancel={(event) => event?.stopPropagation()}
              >
                <Button
                  size="small"
                  danger
                  loading={deletingIds?.has(report.id)}
                  icon={<Trash2 size={12} />}
                  title="删除"
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            )}
            <Button size="small" icon={expandedId === report.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />} onClick={(event) => { event.stopPropagation(); onToggleExpand(report.id) }} title="更多" />
          </span>
        )
      },
    },
  ], [expandedId, onExportPDF, onPrint, onReview, onRevise, onRepublish, onRequestApproval, onDeliver, onCritical, onCompare, onAudit, onDelete, deletingIds, onToggleExpand, onView]);

  return (
    <ProTable<RadiologyReport>
      columns={columns}
      dataSource={listPagination.pageData}
      rowKey="id"
      loading={{ spinning: loading, indicator: <div style={{ padding: 24 }}><Skeleton active title={false} paragraph={{ rows: 8 }} /></div> }}
      showToolbar={false}
      size="small"
      pagination={listPagination.pagination}
      scroll={{ x: 1250 }}
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
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#fafbfc' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>检查所见</div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, background: '#fff', borderRadius: 6, padding: '6px 10px', border: '1px solid #e2e8f0', maxHeight: 80, overflow: 'auto' }}>{highlightAnomalies(report.examFindings) || '(未填写)'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>诊断意见</div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, background: '#fff', borderRadius: 6, padding: '6px 10px', border: '1px solid #e2e8f0', maxHeight: 80, overflow: 'auto' }}>{highlightAnomalies(report.diagnosis) || '(未填写)'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#64748b' }}>
              <StatusTimeline report={report} />
              <span style={{ marginLeft: 'auto' }}>报告: {report.reportDoctorName || '-'}</span>
              {report.auditorName && <span>审核: {report.auditorName}</span>}
              {report.qualityScore !== undefined && <Tag>评分: {report.qualityScore}</Tag>}
            </div>
          </div>
        ),
      }}
      locale={{ emptyText: <Empty image={<Search size={32} style={{ color: "#94a3b8" }} />} description={<span style={{ fontSize: 13, color: "#94a3b8" }}>未找到符合条件的报告</span>} /> }}
      onRow={(report) => ({ onClick: () => onView(report), style: { cursor: 'pointer' } })}
    />
  )
}

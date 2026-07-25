import { useMemo, useState, type ReactNode } from 'react'
import { Button, Empty, Tag } from 'antd'
import { Eye, Printer, Download, User, Zap, ShieldCheck, ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge, StatusTimeline, REPORT_STATUS_META } from '../../components/report'
import { ProTable, type ProColumn } from '../../components/data/ProTable'

const PRIMARY = '#1e3a5f'
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

function formatDate(value: string) {
  if (!value) return '-'
  return value.length >= 16 ? value.slice(0, 16) : value
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
  loading = false,
}: ReportTableViewProps) {
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
    { title: '创建时间', dataIndex: 'createdTime', key: 'createdTime', width: 150, sorter: (a, b) => String(a.createdTime).localeCompare(String(b.createdTime)), defaultSortOrder: 'descend', render: (value) => formatDate(String(value)) },
    { title: '质量', dataIndex: 'qualityScore', key: 'qualityScore', width: 80, sorter: (a, b) => (a.qualityScore ?? 0) - (b.qualityScore ?? 0), render: (value) => <QualityBadge score={typeof value === 'number' ? value : undefined} /> },
    {
      title: '操作',
      dataIndex: 'id',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_value, report) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <Button size="small" icon={<Eye size={12} />} onClick={(event) => { event.stopPropagation(); onView(report) }} title="查看" />
          <Button size="small" icon={<Printer size={12} />} onClick={(event) => { event.stopPropagation(); onPrint(report) }} title="打印" />
          <Button size="small" icon={<Download size={12} />} onClick={(event) => { event.stopPropagation(); onExportPDF(report) }} title="导出PDF" />
          {report.status === '待审核' && <Button size="small" type="primary" icon={<ShieldCheck size={12} />} onClick={(event) => { event.stopPropagation(); onReview(report) }}>审核</Button>}
          <Button size="small" icon={expandedId === report.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />} onClick={(event) => { event.stopPropagation(); onToggleExpand(report.id) }} title="更多" />
        </span>
      ),
    },
  ], [expandedId, onExportPDF, onPrint, onReview, onToggleExpand, onView]);

  return (
    <ProTable<RadiologyReport>
      columns={columns}
      dataSource={reports}
      rowKey="id"
      loading={loading}
      showToolbar={false}
      size="small"
      pagination={{ pageSize: 20 }}
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
      locale={{ emptyText: <Empty image={<Search size={32} />} description="未找到符合条件的报告" /> }}
      onRow={(report) => ({ onClick: () => onView(report), style: { cursor: 'pointer' } })}
    />
  )
}

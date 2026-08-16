/**
 * [G005 v3.0.6.11-101 Wave 7B F15] 报告导出中心 V2 面板
 * 能力: 格式选择 (PDF/DOCX 概念 + HTML/CSV/DICOM SR) + 报告多选 + 导出任务
 *      (创建/进度/流转/下载) + 批量导出 (权限校验) + 导出历史 + 统计
 * 数据源: reportExportCenterV2Api (后端孤儿模块 + seed 回退)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, Table, Tag, Space, Row, Col, Statistic, Button, Select, Radio, Input,
  message, Empty, Tooltip, Segmented, Progress,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FileDown, Download, RefreshCw, Play, XCircle, History, FileText,
  Layers, FileSpreadsheet, FileCode2, FileArchive, Zap, CheckCircle2, ShieldCheck,
} from 'lucide-react'
import {
  reportExportCenterV2Api,
  FORMAT_OPTIONS_V2,
  type ExportTaskSummaryV2,
  type ExportTaskV2,
  type ExportFormatV2,
  type ExportTaskStateV2,
  type ExportCenterStatsV2,
  type ReportRecordV2,
} from '../../../services/api/reportExportCenterV2Api'

const STATE_META: Record<ExportTaskStateV2, { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待处理' },
  PROCESSING: { color: 'processing', label: '处理中' },
  COMPLETED: { color: 'success', label: '已完成' },
  FAILED: { color: 'error', label: '失败' },
  CANCELED: { color: 'warning', label: '已取消' },
}

const FORMAT_ICON: Record<ExportFormatV2, React.ReactNode> = {
  PDF: <FileArchive size={13} color="#dc2626" />,
  DOCX: <FileText size={13} color="#2563eb" />,
  HTML: <FileCode2 size={13} color="#7c3aed" />,
  CSV: <FileSpreadsheet size={13} color="#059669" />,
  DICOM_SR: <Layers size={13} color="#0e7490" />,
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatSize(n?: number): string {
  if (!n) return '-'
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

function downloadContent(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface ReportExportCenterPanelV2Props {
  compact?: boolean
  defaultTab?: string
}

const ReportExportCenterPanelV2: React.FC<ReportExportCenterPanelV2Props> = ({ compact = false, defaultTab = 'export' }) => {
  const [tab, setTab] = useState(defaultTab)
  const [format, setFormat] = useState<ExportFormatV2>('HTML')
  const [reports, setReports] = useState<ReportRecordV2[]>([])
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  const [tasks, setTasks] = useState<ExportTaskSummaryV2[]>([])
  const [history, setHistory] = useState<ExportTaskSummaryV2[]>([])
  const [stats, setStats] = useState<ExportCenterStatsV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [examFilter, setExamFilter] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('DOCTOR')
  const [detail, setDetail] = useState<ExportTaskV2 | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, t, h, s] = await Promise.allSettled([
        reportExportCenterV2Api.listReports(),
        reportExportCenterV2Api.listTasks({ pageSize: 30 }),
        reportExportCenterV2Api.history(),
        reportExportCenterV2Api.stats(),
      ])
      if (r.status === 'fulfilled' && r.value.success) setReports(r.value.data ?? [])
      if (t.status === 'fulfilled' && t.value.success) setTasks(t.value.data?.items ?? [])
      if (h.status === 'fulfilled' && h.value.success) setHistory(h.value.data ?? [])
      if (s.status === 'fulfilled' && s.value.success) setStats(s.value.data)
    } catch {
      message.error('加载导出中心数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const filteredReports = useMemo(() => {
    let list = reports
    if (examFilter) list = list.filter((r) => r.examType === examFilter)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter((r) => r.title.toLowerCase().includes(q) || r.patientName.toLowerCase().includes(q))
    }
    return list
  }, [reports, examFilter, keyword])

  const createTask = async (reportIds: string[], batch = false) => {
    if (reportIds.length === 0) {
      message.warning('请至少选择一份报告')
      return
    }
    setBusy(true)
    try {
      const res = batch
        ? await reportExportCenterV2Api.batchExport({ format, reportIds, requestedBy: '当前用户', requestedByRole: role })
        : await reportExportCenterV2Api.createTask({ format, reportIds, requestedBy: '当前用户', requestedByRole: role })
      if (res.success && res.data) {
        if (batch) {
          message.success(`批量导出完成: ${res.data.reportIds.length} 份报告 (${FORMAT_OPTIONS_V2.find((f) => f.value === format)?.label})`)
        } else {
          message.success(`任务已创建: ${res.data.id} (待处理)`)
        }
        await loadAll()
      } else {
        message.error(res.error?.message ?? (batch ? '批量导出失败 (可能无权限)' : '创建任务失败 (可能无权限)'))
      }
    } finally {
      setBusy(false)
    }
  }

  const processTask = async (id: string) => {
    setBusy(true)
    try {
      const res = await reportExportCenterV2Api.processTask(id)
      if (res.success) {
        message.success(`任务已完成: ${res.data?.fileName}`)
        await loadAll()
      } else {
        message.error(res.error?.message ?? '处理失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const cancelTask = async (id: string) => {
    const res = await reportExportCenterV2Api.cancelTask(id)
    if (res.success) {
      message.success('任务已取消')
      await loadAll()
    } else {
      message.error(res.error?.message ?? '取消失败')
    }
  }

  const handleDownload = async (id: string) => {
    const res = await reportExportCenterV2Api.download(id)
    if (res.success && res.data) {
      downloadContent(res.data.fileName, res.data.content, res.data.mimeType)
      message.success(`已下载: ${res.data.fileName} (${formatSize(res.data.fileSize)})`)
    } else {
      message.error(res.error?.message ?? '下载失败 (任务可能未完成)')
    }
  }

  const openDetail = async (id: string) => {
    const res = await reportExportCenterV2Api.getTask(id)
    if (res.success) setDetail(res.data)
    else message.error(res.error?.message ?? '加载任务详情失败')
  }

  const taskColumns: ColumnsType<ExportTaskSummaryV2> = [
    { title: '任务', dataIndex: 'id', width: 110, render: (v: string, t) => (
        <Space size={4}>
          {FORMAT_ICON[t.format]}
          <a onClick={() => void openDetail(t.id)}>{v}</a>
        </Space>
      ) },
    { title: '格式', dataIndex: 'format', width: 90, render: (v: ExportFormatV2) => <Tag>{FORMAT_OPTIONS_V2.find((f) => f.value === v)?.label}</Tag> },
    { title: '报告数', dataIndex: 'reportCount', width: 70, align: 'center' as const },
    { title: '状态', dataIndex: 'state', width: 90, render: (v: ExportTaskStateV2) => {
        const m = STATE_META[v]
        return <Tag color={m.color}>{m.label}</Tag>
      } },
    { title: '进度', dataIndex: 'progress', width: 130, render: (v: number, t) => t.state === 'CANCELED' ? <Tag color="warning">已取消</Tag> : (
        <Progress percent={Math.max(0, v)} size="small" status={t.state === 'COMPLETED' ? 'success' : 'active'} />
      ) },
    { title: '文件', dataIndex: 'fileName', ellipsis: true, render: (v: string | undefined, t) => v ? (
        <Space size={4}><CheckCircle2 size={12} color="#10b981" /><span>{v}</span><span style={{ color: '#94a3b8' }}>({formatSize(t.fileSize)})</span></Space>
      ) : '-' },
    { title: '发起人', width: 100, render: (_, t) => `${t.requestedBy} (${t.requestedByRole})` },
    { title: '创建时间', width: 110, render: (_, t) => formatDateTime(t.createdAt) },
    { title: '操作', width: 190, render: (_, t) => (
        <Space size={4}>
          {t.state === 'PENDING' && (
            <Button size="small" type="primary" icon={<Play size={11} />} onClick={() => void processTask(t.id)}>处理</Button>
          )}
          {(t.state === 'PENDING' || t.state === 'PROCESSING') && (
            <Button size="small" danger icon={<XCircle size={11} />} onClick={() => void cancelTask(t.id)}>取消</Button>
          )}
          {t.state === 'COMPLETED' && (
            <Button size="small" type="primary" icon={<Download size={11} />} onClick={() => void handleDownload(t.id)}>下载</Button>
          )}
          <Button size="small" icon={<FileText size={11} />} onClick={() => void openDetail(t.id)}>详情</Button>
        </Space>
      ) },
  ]

  const historyColumns: ColumnsType<ExportTaskSummaryV2> = [
    { title: '任务', dataIndex: 'id', width: 110, render: (v: string, t) => (
        <Space size={4}>{FORMAT_ICON[t.format]}<a onClick={() => void openDetail(t.id)}>{v}</a></Space>
      ) },
    { title: '格式', dataIndex: 'format', width: 90, render: (v: ExportFormatV2) => <Tag>{FORMAT_OPTIONS_V2.find((f) => f.value === v)?.label}</Tag> },
    { title: '报告数', dataIndex: 'reportCount', width: 70, align: 'center' as const },
    { title: '状态', dataIndex: 'state', width: 90, render: (v: ExportTaskStateV2) => <Tag color={STATE_META[v].color}>{STATE_META[v].label}</Tag> },
    { title: '文件名', dataIndex: 'fileName', ellipsis: true, render: (v: string | undefined, t) => v ? `${v} (${formatSize(t.fileSize)})` : '-' },
    { title: '完成时间', width: 110, render: (_, t) => formatDateTime(t.completedAt ?? t.updatedAt) },
    { title: '发起人', width: 110, render: (_, t) => `${t.requestedBy} (${t.requestedByRole})` },
    { title: '操作', width: 90, render: (_, t) => t.state === 'COMPLETED' ? (
        <Button size="small" type="primary" icon={<Download size={11} />} onClick={() => void handleDownload(t.id)}>下载</Button>
      ) : '-' },
  ]

  const headerItems = [
    { title: '任务总数', value: stats?.total ?? '-', prefix: <Layers size={14} /> },
    { title: '已完成', value: stats?.completed ?? '-', prefix: <CheckCircle2 size={14} /> },
    { title: '处理中', value: stats?.active ?? '-', prefix: <Play size={14} /> },
    { title: '导出报告数', value: stats?.totalReportsExported ?? '-', prefix: <FileText size={14} /> },
    ...(compact ? [] : [
      { title: '导出字节数', value: stats ? formatSize(stats.totalExportedBytes) : '-', prefix: <FileDown size={14} /> },
      { title: '已取消', value: stats?.canceled ?? '-', prefix: <XCircle size={14} /> },
    ]),
  ]

  return (
    <div data-testid="report-export-center-panel-v2" role="region" aria-label="报告导出中心 V2 面板">
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <FileDown size={18} />
            <strong style={{ fontSize: 16 }}>报告导出中心 V2</strong>
            <Tag color="purple">Wave 7B · F15</Tag>
            <Tag color="cyan">任务流 + 批量 + 权限</Tag>
          </Space>
          <Space>
            <Tooltip title="刷新">
              <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
                刷新
              </Button>
            </Tooltip>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          {headerItems.map((s) => (
            <Col span={compact ? 6 : 24 / headerItems.length} key={s.title}>
              <Statistic title={<span style={{ color: '#fff' }}>{s.title}</span>} value={s.value} prefix={s.prefix} styles={{ content: { color: '#fff', fontSize: 18 } }} />
            </Col>
          ))}
        </Row>
      </div>

      <Segmented
        block value={tab}
        onChange={(v) => setTab(String(v))}
        options={[
          { label: '导出任务', value: 'export' },
          { label: '导出历史', value: 'history' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'export' && (
        <Row gutter={12}>
          <Col span={compact ? 24 : 11}>
            <Card size="small" title={<Space><FileText size={14} color="#7c3aed" />报告选择 ({selectedReportIds.length} 已选)</Space>} extra={<Tag color="blue">{filteredReports.length} 份</Tag>}>
              <Space wrap style={{ marginBottom: 12 }}>
                <Input.Search allowClear placeholder="搜索标题/患者" style={{ width: 180 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <Select allowClear placeholder="检查类型" style={{ width: 110 }} value={examFilter} onChange={(v) => setExamFilter(v)} options={Array.from(new Set(reports.map((r) => r.examType))).map((m) => ({ value: m, label: m }))} />
              </Space>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={filteredReports}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                scroll={{ y: 300 }}
                rowSelection={{
                  selectedRowKeys: selectedReportIds,
                  onChange: (keys) => setSelectedReportIds(keys.map(String)),
                }}
                columns={[
                  { title: '报告', dataIndex: 'title', ellipsis: true },
                  { title: '患者', dataIndex: 'patientName', width: 80 },
                  { title: '类型', dataIndex: 'examType', width: 55, render: (v: string) => <Tag>{v}</Tag> },
                  { title: '日期', dataIndex: 'examDate', width: 90 },
                ]}
                locale={{ emptyText: <Empty description="暂无报告" /> }}
              />
            </Card>
          </Col>
          <Col span={compact ? 24 : 13}>
            <Card size="small" title={<Space><FileDown size={14} color="#7c3aed" />导出设置</Space>}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>导出格式</div>
              <Radio.Group
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                options={FORMAT_OPTIONS_V2.map((f) => ({
                  value: f.value,
                  label: (
                    <Tooltip title={f.desc} key={f.value}>
                      <Space size={4}>{FORMAT_ICON[f.value]}<span>{f.label}</span></Space>
                    </Tooltip>
                  ),
                }))}
                optionType="button"
                buttonStyle="solid"
                style={{ marginBottom: 12 }}
              />
              <div style={{ fontSize: 12, marginBottom: 6 }}>当前角色 (权限校验)</div>
              <Select
                style={{ width: 220, marginBottom: 12 }}
                value={role}
                onChange={(v) => setRole(v)}
                options={[
                  { value: 'DOCTOR', label: '医生 (单份导出)' },
                  { value: 'DIRECTOR', label: '主任 (单份+批量)' },
                  { value: 'ADMIN', label: '管理员 (单份+批量)' },
                  { value: 'TECH', label: '技师 (无权限演示)' },
                ]}
              />
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> 批量导出 (≥2 份) 需主任/管理员权限; TECH 角色一律禁止。
              </div>
              <Space wrap>
                <Button
                  type="primary" loading={busy} icon={<Zap size={12} />}
                  onClick={() => void createTask(selectedReportIds.length > 0 ? selectedReportIds : (reports[0] ? [reports[0].id] : []), false)}
                >
                  创建导出任务
                </Button>
                <Button
                  danger loading={busy} icon={<Layers size={12} />}
                  onClick={() => void createTask(selectedReportIds, true)}
                >
                  批量导出 ({selectedReportIds.length})
                </Button>
                <Button onClick={() => setSelectedReportIds(reports.map((r) => r.id))}>全选</Button>
                <Button onClick={() => setSelectedReportIds([])}>清空</Button>
              </Space>
            </Card>
            <Card size="small" title={<Space><Play size={14} color="#7c3aed" />任务列表 ({tasks.length})</Space>} style={{ marginTop: 12 }}>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={tasks} columns={taskColumns}
                pagination={{ pageSize: 5, showSizeChanger: false }}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description="暂无导出任务" /> }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {tab === 'history' && (
        <Card size="small" title={<Space><History size={14} color="#7c3aed" />导出历史 ({history.length})</Space>}>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={history} columns={historyColumns}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description="暂无导出历史" /> }}
          />
        </Card>
      )}

      {detail && (
        <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 12, marginTop: 12, background: 'var(--bg-secondary, #f8fafc)' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} >
            <Space>
              {FORMAT_ICON[detail.format]}
              <strong>任务 {detail.id} 详情</strong>
              <Tag color={STATE_META[detail.state].color}>{STATE_META[detail.state].label}</Tag>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatSize(detail.fileSize)} · {detail.requestedBy} ({detail.requestedByRole})</span>
            </Space>
            <Button size="small" onClick={() => setDetail(null)}>关闭</Button>
          </Space>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace' }}>
            {detail.content ?? '任务尚未处理, 无导出内容'}
          </div>
          {detail.state === 'COMPLETED' && (
            <Button size="small" type="primary" style={{ marginTop: 8 }} icon={<Download size={11} />} onClick={() => void handleDownload(detail.id)}>
              下载 {detail.fileName}
            </Button>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
        导出格式: PDF/DOCX 为概念导出 (确定性占位内容) · HTML/CSV/DICOM SR 生成完整内容 · 所有格式均包含报告全文 · 任务流转 PENDING → PROCESSING → COMPLETED
      </div>
    </div>
  )
}

export default ReportExportCenterPanelV2

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
import { t } from '../../../i18n/appI18n'

const STATE_META: Record<ExportTaskStateV2, { color: string; label: string }> = {
  PENDING: { color: 'default', label: t('reportExport.state.pending') },
  PROCESSING: { color: 'processing', label: t('reportExport.state.processing') },
  COMPLETED: { color: 'success', label: t('reportExport.state.completed') },
  FAILED: { color: 'error', label: t('reportExport.state.failed') },
  CANCELED: { color: 'warning', label: t('reportExport.state.canceled') },
}

const FORMAT_ICON: Record<ExportFormatV2, React.ReactNode> = {
  PDF: <FileArchive size={13} color="var(--color-error-600)" />,
  DOCX: <FileText size={13} color="var(--color-primary-600)" />,
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
      message.error(t('reportExport.loadFailed'))
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
      message.warning(t('reportExport.selectAtLeastOne'))
      return
    }
    setBusy(true)
    try {
      const res = batch
        ? await reportExportCenterV2Api.batchExport({ format, reportIds, requestedBy: '当前用户', requestedByRole: role })
        : await reportExportCenterV2Api.createTask({ format, reportIds, requestedBy: '当前用户', requestedByRole: role })
      if (res.success && res.data) {
        if (batch) {
          message.success(t('reportExport.batchDone', { count: res.data.reportIds.length, format: FORMAT_OPTIONS_V2.find((f) => f.value === format)?.label }))
        } else {
          message.success(t('reportExport.taskCreated', { id: res.data.id }))
        }
        await loadAll()
      } else {
        message.error(res.error?.message ?? (batch ? t('reportExport.batchFailed') : t('reportExport.createFailed')))
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
        message.success(t('reportExport.taskDone', { name: res.data?.fileName }))
        await loadAll()
      } else {
        message.error(res.error?.message ?? t('reportExport.processFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  const cancelTask = async (id: string) => {
    const res = await reportExportCenterV2Api.cancelTask(id)
    if (res.success) {
      message.success(t('reportExport.taskCanceled'))
      await loadAll()
    } else {
      message.error(res.error?.message ?? t('reportExport.cancelFailed'))
    }
  }

  const handleDownload = async (id: string) => {
    const res = await reportExportCenterV2Api.download(id)
    if (res.success && res.data) {
      downloadContent(res.data.fileName, res.data.content, res.data.mimeType)
      message.success(t('reportExport.downloaded', { name: res.data.fileName, size: formatSize(res.data.fileSize) }))
    } else {
      message.error(res.error?.message ?? t('reportExport.downloadFailed'))
    }
  }

  const openDetail = async (id: string) => {
    const res = await reportExportCenterV2Api.getTask(id)
    if (res.success) setDetail(res.data)
    else message.error(res.error?.message ?? t('reportExport.loadDetailFailed'))
  }

  const taskColumns: ColumnsType<ExportTaskSummaryV2> = [
    { title: t('reportExport.col.task'), dataIndex: 'id', width: 110, render: (v: string, row) => (
        <Space size={4}>
          {FORMAT_ICON[row.format]}
          <a onClick={() => void openDetail(row.id)}>{v}</a>
        </Space>
      ) },
    { title: t('reportExport.col.format'), dataIndex: 'format', width: 90, render: (v: ExportFormatV2) => <Tag>{FORMAT_OPTIONS_V2.find((f) => f.value === v)?.label}</Tag> },
    { title: t('reportExport.col.reportCount'), dataIndex: 'reportCount', width: 70, align: 'center' as const },
    { title: t('reportExport.col.status'), dataIndex: 'state', width: 90, render: (v: ExportTaskStateV2) => {
        const m = STATE_META[v]
        return <Tag color={m.color}>{m.label}</Tag>
      } },
    { title: t('reportExport.col.progress'), dataIndex: 'progress', width: 130, render: (v: number, row) => row.state === 'CANCELED' ? <Tag color="warning">{t('reportExport.state.canceled')}</Tag> : (
        <Progress percent={Math.max(0, v)} size="small" status={row.state === 'COMPLETED' ? 'success' : 'active'} />
      ) },
    { title: t('reportExport.col.file'), dataIndex: 'fileName', ellipsis: true, render: (v: string | undefined, row) => v ? (
        <Space size={4}><CheckCircle2 size={12} color="#10b981" /><span>{v}</span><span style={{ color: '#94a3b8' }}>({formatSize(row.fileSize)})</span></Space>
      ) : '-' },
    { title: t('reportExport.col.requestedBy'), width: 100, render: (_, row) => `${row.requestedBy} (${row.requestedByRole})` },
    { title: t('reportExport.col.createdAt'), width: 110, render: (_, row) => formatDateTime(row.createdAt) },
    { title: t('reportExport.col.action'), width: 190, render: (_, row) => (
        <Space size={4}>
          {row.state === 'PENDING' && (
            <Button size="small" type="primary" icon={<Play size={11} />} onClick={() => void processTask(row.id)}>{t('reportExport.process')}</Button>
          )}
          {(row.state === 'PENDING' || row.state === 'PROCESSING') && (
            <Button size="small" danger icon={<XCircle size={11} />} onClick={() => void cancelTask(row.id)}>{t('reportExport.cancel')}</Button>
          )}
          {row.state === 'COMPLETED' && (
            <Button size="small" type="primary" icon={<Download size={11} />} onClick={() => void handleDownload(row.id)}>{t('reportExport.download')}</Button>
          )}
          <Button size="small" icon={<FileText size={11} />} onClick={() => void openDetail(row.id)}>{t('reportExport.detail')}</Button>
        </Space>
      ) },
  ]

  const historyColumns: ColumnsType<ExportTaskSummaryV2> = [
    { title: t('reportExport.col.task'), dataIndex: 'id', width: 110, render: (v: string, row) => (
        <Space size={4}>{FORMAT_ICON[row.format]}<a onClick={() => void openDetail(row.id)}>{v}</a></Space>
      ) },
    { title: t('reportExport.col.format'), dataIndex: 'format', width: 90, render: (v: ExportFormatV2) => <Tag>{FORMAT_OPTIONS_V2.find((f) => f.value === v)?.label}</Tag> },
    { title: t('reportExport.col.reportCount'), dataIndex: 'reportCount', width: 70, align: 'center' as const },
    { title: t('reportExport.col.status'), dataIndex: 'state', width: 90, render: (v: ExportTaskStateV2) => <Tag color={STATE_META[v].color}>{STATE_META[v].label}</Tag> },
    { title: t('reportExport.col.fileName'), dataIndex: 'fileName', ellipsis: true, render: (v: string | undefined, row) => v ? `${v} (${formatSize(row.fileSize)})` : '-' },
    { title: t('reportExport.col.completedAt'), width: 110, render: (_, row) => formatDateTime(row.completedAt ?? row.updatedAt) },
    { title: t('reportExport.col.requestedBy'), width: 110, render: (_, row) => `${row.requestedBy} (${row.requestedByRole})` },
    { title: t('reportExport.col.action'), width: 90, render: (_, row) => row.state === 'COMPLETED' ? (
        <Button size="small" type="primary" icon={<Download size={11} />} onClick={() => void handleDownload(row.id)}>{t('reportExport.download')}</Button>
      ) : '-' },
  ]

  const headerItems = [
    { title: t('reportExport.header.totalTasks'), value: stats?.total ?? '-', prefix: <Layers size={14} /> },
    { title: t('reportExport.header.completed'), value: stats?.completed ?? '-', prefix: <CheckCircle2 size={14} /> },
    { title: t('reportExport.header.processing'), value: stats?.active ?? '-', prefix: <Play size={14} /> },
    { title: t('reportExport.header.reportsExported'), value: stats?.totalReportsExported ?? '-', prefix: <FileText size={14} /> },
    ...(compact ? [] : [
      { title: t('reportExport.header.bytesExported'), value: stats ? formatSize(stats.totalExportedBytes) : '-', prefix: <FileDown size={14} /> },
      { title: t('reportExport.header.canceled'), value: stats?.canceled ?? '-', prefix: <XCircle size={14} /> },
    ]),
  ]

  return (
    <div data-testid="report-export-center-panel-v2" role="region" aria-label={t('reportExport.panelAria')}>
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <FileDown size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportExport.title')}</strong>
            <Tag color="purple">Wave 7B · F15</Tag>
            <Tag color="cyan">{t('reportExport.subtitle')}</Tag>
          </Space>
          <Space>
            <Tooltip title={t('reportExport.refresh')}>
              <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
                {t('reportExport.refresh')}
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
          { label: t('reportExport.tab.export'), value: 'export' },
          { label: t('reportExport.tab.history'), value: 'history' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'export' && (
        <Row gutter={12}>
          <Col span={compact ? 24 : 11}>
            <Card size="small" title={<Space><FileText size={14} color="#7c3aed" />{t('reportExport.reportSelection', { count: selectedReportIds.length })}</Space>} extra={<Tag color="blue">{t('reportExport.reportCountSuffix', { count: filteredReports.length })}</Tag>}>
              <Space wrap style={{ marginBottom: 12 }}>
                <Input.Search allowClear placeholder={t('reportExport.searchPlaceholder')} style={{ width: 180 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <Select allowClear placeholder={t('reportExport.examTypePlaceholder')} style={{ width: 110 }} value={examFilter} onChange={(v) => setExamFilter(v)} options={Array.from(new Set(reports.map((r) => r.examType))).map((m) => ({ value: m, label: m }))} />
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
                  { title: t('reportExport.col.report'), dataIndex: 'title', ellipsis: true },
                  { title: t('reportExport.col.patient'), dataIndex: 'patientName', width: 80 },
                  { title: t('reportExport.col.type'), dataIndex: 'examType', width: 55, render: (v: string) => <Tag>{v}</Tag> },
                  { title: t('reportExport.col.date'), dataIndex: 'examDate', width: 90 },
                ]}
                locale={{ emptyText: <Empty description={t('reportExport.noReports')} /> }}
              />
            </Card>
          </Col>
          <Col span={compact ? 24 : 13}>
            <Card size="small" title={<Space><FileDown size={14} color="#7c3aed" />{t('reportExport.exportSettings')}</Space>}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>{t('reportExport.exportFormat')}</div>
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
              <div style={{ fontSize: 12, marginBottom: 6 }}>{t('reportExport.currentRole')}</div>
              <Select
                style={{ width: 220, marginBottom: 12 }}
                value={role}
                onChange={(v) => setRole(v)}
                options={[
                  { value: 'DOCTOR', label: t('reportExport.role.doctor') },
                  { value: 'DIRECTOR', label: t('reportExport.role.director') },
                  { value: 'ADMIN', label: t('reportExport.role.admin') },
                  { value: 'TECH', label: t('reportExport.role.tech') },
                ]}
              />
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> {t('reportExport.roleNote')}
              </div>
              <Space wrap>
                <Button
                  type="primary" loading={busy} icon={<Zap size={12} />}
                  onClick={() => void createTask(selectedReportIds.length > 0 ? selectedReportIds : (reports[0] ? [reports[0].id] : []), false)}
                >
                  {t('reportExport.createTask')}
                </Button>
                <Button
                  danger loading={busy} icon={<Layers size={12} />}
                  onClick={() => void createTask(selectedReportIds, true)}
                >
                  {t('reportExport.batchExport', { count: selectedReportIds.length })}
                </Button>
                <Button onClick={() => setSelectedReportIds(reports.map((r) => r.id))}>{t('reportExport.selectAll')}</Button>
                <Button onClick={() => setSelectedReportIds([])}>{t('reportExport.clear')}</Button>
              </Space>
            </Card>
            <Card size="small" title={<Space><Play size={14} color="#7c3aed" />{t('reportExport.taskList', { count: tasks.length })}</Space>} style={{ marginTop: 12 }}>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={tasks} columns={taskColumns}
                pagination={{ pageSize: 5, showSizeChanger: false }}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description={t('reportExport.noTasks')} /> }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {tab === 'history' && (
        <Card size="small" title={<Space><History size={14} color="#7c3aed" />{t('reportExport.historyTitle', { count: history.length })}</Space>}>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={history} columns={historyColumns}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description={t('reportExport.noHistory')} /> }}
          />
        </Card>
      )}

      {detail && (
        <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 12, marginTop: 12, background: 'var(--bg-secondary, #f8fafc)' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} >
            <Space>
              {FORMAT_ICON[detail.format]}
              <strong>{t('reportExport.taskDetail', { id: detail.id })}</strong>
              <Tag color={STATE_META[detail.state].color}>{STATE_META[detail.state].label}</Tag>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatSize(detail.fileSize)} · {detail.requestedBy} ({detail.requestedByRole})</span>
            </Space>
            <Button size="small" onClick={() => setDetail(null)}>{t('reportExport.close')}</Button>
          </Space>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace' }}>
            {detail.content ?? t('reportExport.noContent')}
          </div>
          {detail.state === 'COMPLETED' && (
            <Button size="small" type="primary" style={{ marginTop: 8 }} icon={<Download size={11} />} onClick={() => void handleDownload(detail.id)}>
              {t('reportExport.downloadFile', { name: detail.fileName })}
            </Button>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
        {t('reportExport.footer')}
      </div>
    </div>
  )
}

export default ReportExportCenterPanelV2

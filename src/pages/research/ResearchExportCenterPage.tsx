/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 18 - 科研数据导出中心页面 (PACS 科研深功能)
 * 覆盖后端 ResearchExportService 全部端点:
 *   POST /research/datasets/build   数据集构建 (模态/病种/时间/医生筛选)
 *   GET  /research/datasets         数据集列表
 *   GET  /research/export-fields    导出字段定义 (分组)
 *   POST /research/export/tasks     创建导出任务 (CSV/JSON/Excel)
 *   GET  /research/export/tasks     任务历史
 *   GET  /research/export/tasks/:id/content  内容预览/下载 (概念)
 *   GET  /research/export/stats     导出统计
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  Card, Button, Input, Select, DatePicker, Checkbox, Radio, Tag, message,
  Space, Row, Col, Modal, Empty, Spin, Progress, Divider,
} from 'antd'
import { Database, Download, FileJson, FileSpreadsheet, FileText, History, RefreshCw, Settings2, BarChart3 } from 'lucide-react'
import {
  researchExportApi,
  type DatasetInfoDto,
  type ExportFieldDto,
  type ExportTaskDto,
  type ExportStatsDto,
  type DatasetCriteriaDto,
  type ExportFormat,
  type ExportTaskContentDto,
} from '../../services/api/researchExportApi'
import { DataTable } from '../../components/common/DataTable'
import { StatCard, StatCardGrid } from '../../components/common'

const { RangePicker } = DatePicker

const MODALITIES = ['全部', 'CT', 'MR', 'DR', 'DSA', 'XR', 'MG']
const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'CSV', label: 'CSV' },
  { value: 'JSON', label: 'JSON' },
  { value: 'EXCEL', label: 'Excel (概念)' },
]

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '排队中' },
  running: { color: 'blue', label: '生成中' },
  done: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
}

const GROUP_COLORS: Record<string, string> = {
  患者: '#1677ff',
  检查: '#52c41a',
  报告: '#722ed1',
  影像: '#eb2f96',
  测量: '#fa8c16',
}

export default function ResearchExportCenterPage() {
  const { t } = useTranslation('v3researchExport')
  const [activeTab, setActiveTab] = useState('build')

  // ── 数据集构建 ──
  const [criteria, setCriteria] = useState<DatasetCriteriaDto>({ modality: '全部' })
  const [dataset, setDataset] = useState<DatasetInfoDto | null>(null)
  const [datasets, setDatasets] = useState<DatasetInfoDto[]>([])
  const [building, setBuilding] = useState(false)

  // ── 字段/格式 ──
  const [fields, setFields] = useState<ExportFieldDto[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [format, setFormat] = useState<ExportFormat>('CSV')
  const [taskName, setTaskName] = useState('')

  // ── 任务历史/统计 ──
  const [tasks, setTasks] = useState<ExportTaskDto[]>([])
  const [stats, setStats] = useState<ExportStatsDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ExportTaskContentDto | null>(null)

  const fetchFields = useCallback(async () => {
    try {
      const res = await researchExportApi.listFields()
      if (res.success && Array.isArray(res.data)) {
        const list = res.data as ExportFieldDto[]
        setFields(list)
        setSelectedFields(list.filter((f) => f.selected).map((f) => f.key))
      }
    } catch { /* 字段不可用 */ }
  }, [])

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await researchExportApi.listTasks()
      if (res.success && Array.isArray(res.data)) setTasks(res.data as ExportTaskDto[])
    } catch { /* 任务不可用 */ }
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await researchExportApi.stats()
      if (res.success && res.data) setStats(res.data as ExportStatsDto)
    } catch { /* 统计不可用 */ }
  }, [])

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await researchExportApi.listDatasets()
      if (res.success && Array.isArray(res.data)) setDatasets(res.data as DatasetInfoDto[])
    } catch { /* 数据集不可用 */ }
  }, [])

  useEffect(() => {
    void fetchFields()
    void fetchTasks()
    void fetchStats()
    void fetchDatasets()
  }, [fetchFields, fetchTasks, fetchStats, fetchDatasets])

  // ── 数据集构建 ──
  const handleBuild = async () => {
    setBuilding(true)
    try {
      const res = await researchExportApi.buildDataset(criteria, dataset?.name)
      if (res.success && res.data) {
        setDataset(res.data as DatasetInfoDto)
        message.success(t('buildSuccess', '数据集构建完成'))
        void fetchDatasets()
      } else {
        message.error(res.error?.message ?? t('buildFailed', '数据集构建失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('buildFailed', '数据集构建失败')) }
    setBuilding(false)
  }

  const handleSelectDataset = (d: DatasetInfoDto) => {
    setDataset(d)
    setCriteria({ ...d.criteria })
  }

  // ── 创建导出任务 ──
  const handleCreateTask = async () => {
    if (!dataset) {
      message.warning(t('needDataset', '请先构建数据集'))
      return
    }
    setLoading(true)
    try {
      const res = await researchExportApi.createTask({
        name: taskName || `${dataset.name}-${new Date().toISOString().slice(0, 10)}`,
        datasetId: dataset.id,
        format,
        fields: selectedFields,
      })
      if (res.success && res.data) {
        message.success(t('taskCreated', '导出任务已创建'))
        setTaskName('')
        void fetchTasks()
        void fetchStats()
      } else {
        message.error(res.error?.message ?? t('taskFailed', '任务创建失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('taskFailed', '任务创建失败')) }
    setLoading(false)
  }

  const handlePreview = async (id: string) => {
    try {
      const res = await researchExportApi.getTaskContent(id)
      if (res.success && res.data) setPreview(res.data as ExportTaskContentDto)
      else message.error(res.error?.message ?? t('previewFailed', '预览失败'))
    } catch { message.error(t('previewFailed', '预览失败')) }
  }

  // [W1] 下载: 有 downloadUrl 直接下载; 否则拉取内容生成 Blob 本地下载
  const handleDownload = async (task: ExportTaskDto) => {
    if (task.downloadUrl) {
      const a = document.createElement('a')
      a.href = task.downloadUrl
      a.download = ''
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
      message.success(t('downloadStarted', '已开始下载'))
      return
    }
    try {
      const res = await researchExportApi.getTaskContent(task.id)
      if (res.success && res.data) {
        const content = res.data.content ?? ''
        const mime = task.format === 'JSON' ? 'application/json' : task.format === 'CSV' ? 'text/csv' : 'application/vnd.ms-excel'
        const ext = task.format === 'JSON' ? 'json' : task.format === 'CSV' ? 'csv' : 'xls'
        const payload = task.format === 'CSV' ? '\ufeff' + content : content
        const blob = new Blob([payload], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${task.name || task.id}.${ext}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        message.success(t('downloadStarted', '已开始下载'))
      } else {
        message.error(res.error?.message ?? t('downloadFailed', '下载失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('downloadFailed', '下载失败')) }
  }

  const groupedFields = useMemo(() => {
    const groups: Array<{ group: string; items: ExportFieldDto[] }> = []
    for (const f of fields) {
      const g = groups.find((x) => x.group === f.group)
      if (g) g.items.push(f)
      else groups.push({ group: f.group, items: [f] })
    }
    return groups
  }, [fields])

  const tabButton = (key: string, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', background: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: activeTab === key ? 600 : 400,
        color: activeTab === key ? '#1677ff' : 'var(--text-secondary, #475569)',
        borderBottom: activeTab === key ? '2px solid #1677ff' : '2px solid transparent',
      }}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={20} color="#1677ff" />
            {t('title', '科研数据导出中心')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginTop: 2 }}>{t('subtitle', '数据集构建 / 字段选择 / CSV·JSON·Excel 导出 / 任务历史与统计')}</div>
        </div>
        <Button icon={<RefreshCw size={14} />} onClick={() => { void fetchTasks(); void fetchStats(); void fetchDatasets() }}>
          {t('refresh', '刷新')}
        </Button>
      </div>

      {/* 统计 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {[
          { icon: <FileText size={18} />, label: t('statTotal', '导出任务'), value: stats?.totalTasks ?? 0, color: '#1677ff', bg: '#e6f4ff' },
          { icon: <BarChart3 size={18} />, label: t('statRecords', '累计导出记录'), value: stats?.totalRecords ?? 0, color: '#52c41a', bg: '#f6ffed' },
          { icon: <FileJson size={18} />, label: t('statJson', 'JSON'), value: stats?.byFormat.JSON ?? 0, color: '#722ed1', bg: '#f9f0ff' },
          { icon: <FileSpreadsheet size={18} />, label: t('statExcel', 'Excel'), value: stats?.byFormat.EXCEL ?? 0, color: '#fa8c16', bg: '#fff7e6' },
        ].map((s) => (
          <Col xs={12} md={6} key={s.label}>
            <Card size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 10 } }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>{s.label}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" styles={{ body: { padding: 12 } }}>
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))', marginBottom: 12 }}>
          {tabButton('build', t('tabBuild', '数据集构建'), <Settings2 size={14} />)}
          {tabButton('tasks', t('tabTasks', '导出任务'), <History size={14} />)}
          {tabButton('stats', t('tabStats', '统计'), <BarChart3 size={14} />)}
        </div>

        {/* ═══ 数据集构建 ═══ */}
        {activeTab === 'build' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={9}>
              <Card size="small" title={<span style={{ fontSize: 13 }}>{t('criteria', '筛选条件')}</span>}>
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>{t('modality', '检查模态')}</div>
                    <Select
                      style={{ width: '100%' }}
                      value={criteria.modality}
                      onChange={(v) => setCriteria((prev) => ({ ...prev, modality: v }))}
                      options={MODALITIES.map((m) => ({ value: m, label: m }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>{t('disease', '病种')}</div>
                    <Input
                      placeholder={t('diseasePlaceholder', '如: 肺结节 / 脑梗死')}
                      value={criteria.disease}
                      onChange={(e) => setCriteria((prev) => ({ ...prev, disease: e.target.value || undefined }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>{t('dateRange', '检查时间范围')}</div>
                    <RangePicker
                      style={{ width: '100%' }}
                      value={criteria.dateFrom && criteria.dateTo ? [dayjs(criteria.dateFrom), dayjs(criteria.dateTo)] : null}
                      onChange={(range) =>
                        setCriteria((prev) => ({
                          ...prev,
                          dateFrom: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
                          dateTo: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>{t('doctor', '检查医生')}</div>
                    <Input
                      placeholder={t('doctorPlaceholder', '如: 李明辉')}
                      value={criteria.doctor}
                      onChange={(e) => setCriteria((prev) => ({ ...prev, doctor: e.target.value || undefined }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 4 }}>{t('result', '检查结果')}</div>
                    <Radio.Group
                      value={criteria.result ?? '全部'}
                      onChange={(e) => setCriteria((prev) => ({ ...prev, result: e.target.value }))}
                      options={['全部', '阳性', '阴性'].map((r) => ({ value: r, label: r }))}
                    />
                  </div>
                  <Button type="primary" block loading={building} icon={<Database size={14} />} onClick={() => void handleBuild()}>
                    {t('buildDataset', '构建数据集')}
                  </Button>
                </Space>
                {datasets.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>{t('recentDatasets', '历史数据集')}</div>
                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                      {datasets.slice(0, 5).map((d) => (
                        <Button key={d.id} size="small" block type={dataset?.id === d.id ? 'primary' : 'default'} onClick={() => handleSelectDataset(d)}>
                          {d.name} ({d.recordCount})
                        </Button>
                      ))}
                    </Space>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={15}>
              <Card
                size="small"
                title={<span style={{ fontSize: 13 }}>{t('datasetResult', '数据集结果')}</span>}
                extra={<span style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>{t('matched', '匹配记录')}: <b>{dataset?.recordCount ?? 0}</b></span>}
              >
                {!dataset ? (
                  <Empty description={t('buildFirst', '设置筛选条件后点击「构建数据集」')} />
                ) : (
                  <Spin spinning={building}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            {['患者', '性别', '年龄', '模态', '部位', '检查日期', '病种', '诊断'].map((h) => (
                              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid var(--border-default, rgba(0,0,0,0.12))', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataset.preview.map((r) => (
                            <tr key={r.id}>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>{r.patientNameMasked}</td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>{r.gender}</td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>{r.age}</td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}><Tag style={{ fontSize: 11 }}>{r.modality}</Tag></td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>{r.bodyPart}</td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>{r.examDate}</td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>{r.disease}</td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.diagnosis}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                      {t('selectFields', '选择导出字段 (按组)')}:
                      <span style={{ marginLeft: 6, color: '#1677ff' }}>{selectedFields.length}/{fields.length}</span>
                    </div>
                    <Row gutter={[12, 8]}>
                      {groupedFields.map((g) => (
                        <Col xs={24} md={12} key={g.group}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: GROUP_COLORS[g.group] ?? '#334155', marginBottom: 4 }}>{g.group}</div>
                          <Checkbox.Group
                            value={selectedFields}
                            onChange={(vals) => setSelectedFields(vals as string[])}
                            options={g.items.map((f) => ({ value: f.key, label: f.label }))}
                          />
                        </Col>
                      ))}
                    </Row>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>{t('format', '导出格式')}</span>
                      <Radio.Group value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
                        {FORMATS.map((f) => (
                          <Radio key={f.value} value={f.value} style={{ fontSize: 12 }}>{f.label}</Radio>
                        ))}
                      </Radio.Group>
                      <Input
                        style={{ width: 220 }}
                        placeholder={t('taskNamePlaceholder', '任务名称 (可选)')}
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                      />
                      <Button type="primary" loading={loading} icon={<Download size={14} />} onClick={() => void handleCreateTask()}>
                        {t('createTask', '创建导出任务')}
                      </Button>
                    </div>
                  </Spin>
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ═══ 导出任务 ═══ */}
        {activeTab === 'tasks' && (
          <DataTable<ExportTaskDto>
            rowKey="id"
            loading={loading}
            dataSource={tasks}
            columns={[
              {
                title: t('taskName', '任务名称'),
                dataIndex: 'name',
                key: 'name',
                ellipsis: true,
                render: (v: string, r) => (
                  <span>
                    {v}
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{r.datasetName}</div>
                  </span>
                ),
              },
              {
                title: t('format', '格式'),
                dataIndex: 'format',
                key: 'format',
                width: 90,
                render: (v: ExportFormat) => (
                  <Tag color={v === 'CSV' ? 'green' : v === 'JSON' ? 'purple' : 'orange'} style={{ fontSize: 11 }}>
                    {v === 'EXCEL' ? 'Excel' : v}
                  </Tag>
                ),
              },
              { title: t('recordCount', '记录数'), dataIndex: 'recordCount', key: 'recordCount', width: 90 },
              {
                title: t('status', '状态'),
                dataIndex: 'status',
                key: 'status',
                width: 90,
                render: (v: string) => <Tag color={STATUS_META[v]?.color ?? 'default'} style={{ fontSize: 11 }}>{STATUS_META[v]?.label ?? v}</Tag>,
              },
              { title: t('createdAt', '创建时间'), dataIndex: 'createdAt', key: 'createdAt', width: 150 },
              { title: t('createdBy', '创建人'), dataIndex: 'createdBy', key: 'createdBy', width: 110 },
              {
                title: t('actions', '操作'),
                key: 'actions',
                width: 140,
                render: (_, r) => (
                  <Space size={4}>
                    <Button size="small" icon={<FileText size={12} />} onClick={() => void handlePreview(r.id)}>
                      {t('preview', '预览')}
                    </Button>
                    <Button size="small" type="link" icon={<Download size={12} />} disabled={r.status === 'failed'} title={r.status === 'failed' ? t('downloadUnavailable', '任务失败，无可用导出文件') : undefined} onClick={() => void handleDownload(r)}>
                      {t('download', '下载')}
                    </Button>
                  </Space>
                ),
              },
            ]}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        )}

        {/* ═══ 统计 ═══ */}
        {activeTab === 'stats' && (
          <div>
            <StatCardGrid style={{ marginBottom: 12 }}>
              {stats && (
                <>
                  <StatCard title={t('statTotal', '导出任务')} value={stats.totalTasks} />
                  <StatCard title={t('statDone', '已完成')} value={stats.doneTasks} />
                  <StatCard title={t('statRecords', '累计导出记录')} value={stats.totalRecords} />
                  <StatCard title={t('statRunning', '生成中')} value={stats.byStatus.running} />
                </>
              )}
            </StatCardGrid>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={10}>
                <Card size="small" title={<span style={{ fontSize: 13 }}>{t('formatDistribution', '格式分布')}</span>}>
                  {['CSV', 'JSON', 'EXCEL'].map((f) => {
                    const count = stats?.byFormat[f as ExportFormat] ?? 0
                    const max = Math.max(1, stats?.byFormat.CSV ?? 0, stats?.byFormat.JSON ?? 0, stats?.byFormat.EXCEL ?? 0)
                    return (
                      <div key={f} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span>{f === 'EXCEL' ? 'Excel' : f}</span>
                          <span style={{ color: 'var(--text-secondary, #475569)' }}>{count}</span>
                        </div>
                        <Progress percent={Math.round((count / max) * 100)} showInfo={false} size="small" strokeColor={f === 'CSV' ? '#52c41a' : f === 'JSON' ? '#722ed1' : '#fa8c16'} />
                      </div>
                    )
                  })}
                </Card>
              </Col>
              <Col xs={24} md={14}>
                <Card size="small" title={<span style={{ fontSize: 13 }}>{t('last7Days', '近 7 天导出趋势')}</span>}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                    {stats?.last7Days.map((d) => {
                      const max = Math.max(1, ...stats.last7Days.map((x) => x.count))
                      return (
                        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary, #475569)' }}>{d.count}</span>
                          <div style={{ width: '70%', background: d.count > 0 ? '#1677ff' : 'var(--border-default, rgba(0,0,0,0.12))', borderRadius: '4px 4px 0 0', height: `${(d.count / max) * 90}px` }} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)' }}>{d.date.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 8 }}>
                    {t('last7DaysRecords', '近 7 天共导出记录数')}: <b>{stats?.last7Days.reduce((s, d) => s + d.records, 0) ?? 0}</b>
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {/* 内容预览 Modal */}
      <Modal
        title={preview ? `${preview.task.name} (${preview.task.format})` : ''}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={null}
        width={720}
      >
        {preview && (
          <div>
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-secondary, #475569)' }}>
              {t('previewHint', '内容预览 (前 100 条, 实际下载将包含全部')} {preview.task.recordCount} {t('recordsUnit', '条记录)')}
            </div>
            <pre style={{ maxHeight: 380, overflow: 'auto', background: 'var(--bg-primary, #f8fafc)', padding: 12, borderRadius: 6, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {preview.content.slice(0, 4000)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Select, Button, Tag, Space, Typography, Row, Col, Statistic,
  Progress, Table, Alert, Divider, Empty, message, Tooltip,
} from 'antd'
import {
  GitCompare, RefreshCw, FileText, User, Calendar, CheckCircle2,
  PencilLine, PlusCircle, MinusCircle, Star,
} from 'lucide-react'
import {
  reportCompareV2Api,
  TYPE_LABEL,
  type ReportCompareResult,
  type ComparePreset,
  type CompareType,
  type ReportSummary,
  type CompareV2Stats,
  type LineDiffOp,
} from '../../services/api/reportCompareV2Api'

const { Text } = Typography

/** 解包后端 { success, data } 包装 (兼容裸数据) */
function unwrap<T>(res: { success: boolean; data?: unknown }): T | null {
  if (!res.success) return null
  const d = res.data as { data?: T } | T | null
  if (d && typeof d === 'object' && 'data' in d && (d as { data?: unknown }).data !== undefined) {
    return (d as { data: T }).data
  }
  return d as T
}

const TYPE_COLOR: Record<CompareType, string> = {
  'patient-history': 'blue',
  'dual-read': 'purple',
  'doctor-ai': 'cyan',
}

const diffTypeMeta: Record<string, { color: string; label: string; bg: string }> = {
  same: { color: '#94a3b8', label: '相同', bg: 'transparent' },
  modified: { color: '#b45309', label: '修改', bg: '#fef3c7' },
  added: { color: '#15803d', label: '新增', bg: '#dcfce7' },
  removed: { color: '#b91c1c', label: '删除', bg: '#fee2e2' },
}

const DEFAULT_DIFF_META = { color: '#94a3b8', label: '相同', bg: 'transparent' }

/** 行级 diff 渲染: 红绿标注 (删除红 / 新增绿 / 修改琥珀) */
function DiffLineRow({ op }: { op: LineDiffOp }) {
  const meta = diffTypeMeta[op.type] ?? DEFAULT_DIFF_META
  return (
    <div style={{ background: meta.bg, padding: '4px 8px', borderRadius: 4, marginBottom: 2 }}>
      <Space size={8} align="start">
        <Tag style={{ marginInlineEnd: 0, flexShrink: 0 }} color={op.type === 'same' ? 'default' : undefined}>
          {meta.label}
        </Tag>
        {op.type === 'removed' && (
          <Text type="danger" delete style={{ margin: 0 }}>{op.original ?? op.line}</Text>
        )}
        {op.type === 'added' && (
          <Text style={{ margin: 0, color: '#15803d' }}>{op.line}</Text>
        )}
        {op.type === 'modified' && (
          <Space direction="vertical" size={0}>
            <Text type="danger" delete style={{ margin: 0 }}>{op.original}</Text>
            <Text style={{ margin: 0, color: '#b45309' }}>{op.line}</Text>
          </Space>
        )}
        {op.type === 'same' && <Text type="secondary" style={{ margin: 0 }}>{op.line}</Text>}
      </Space>
    </div>
  )
}

function SummaryTag({ report }: { report: ReportSummary }) {
  return (
    <Space size={6} wrap>
      <Text strong>{report.patientName}</Text>
      <Tag style={{ marginInlineEnd: 0 }}>{report.modality || '-'}</Tag>
      <Tag style={{ marginInlineEnd: 0 }}>{report.examDate || '-'}</Tag>
      <Tag color={report.isAiGenerated ? 'cyan' : 'geekblue'} style={{ marginInlineEnd: 0 }}>
        {report.source === 'ai' ? 'AI' : report.source === 'prior' ? '既往' : '医生'}
      </Tag>
      <Text type="secondary">{report.doctorName}</Text>
    </Space>
  )
}

/** [Wave 8A F16] 报告对比 V2 面板: 选择两报告 → 逐段 diff 视图 + 关键字段表 + 相似度 */
const ReportComparePanel: React.FC = () => {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [presets, setPresets] = useState<ComparePreset[]>([])
  const [stats, setStats] = useState<CompareV2Stats | null>(null)
  const [reportAId, setReportAId] = useState<string>()
  const [reportBId, setReportBId] = useState<string>()
  const [result, setResult] = useState<ReportCompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [compareLoading, setCompareLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, p, s] = await Promise.all([
        reportCompareV2Api.listReports(),
        reportCompareV2Api.listPresets(),
        reportCompareV2Api.getStats(),
      ])
      const list = unwrap<ReportSummary[]>(r)
      const presetList = unwrap<ComparePreset[]>(p)
      const st = unwrap<CompareV2Stats>(s)
      if (list) setReports(list)
      if (presetList) setPresets(presetList)
      if (st) setStats(st)
      if (!r.success) setError(r.error?.message ?? '加载目录失败')
    } catch (e) {
      setError((e as Error)?.message ?? '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const runCompare = useCallback(async (aId: string, bId: string) => {
    setCompareLoading(true)
    setError('')
    try {
      const res = await reportCompareV2Api.compare({ reportAId: aId, reportBId: bId })
      const data = unwrap<ReportCompareResult>(res)
      if (data) {
        setResult(data)
        setReportAId(aId)
        setReportBId(bId)
      } else {
        message.error(res.error?.message ?? '对比失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '对比失败')
    } finally {
      setCompareLoading(false)
    }
  }, [])

  const handleCompare = () => {
    if (!reportAId || !reportBId) { message.warning('请选择两份报告'); return }
    if (reportAId === reportBId) { message.warning('两份报告不能相同'); return }
    void runCompare(reportAId, reportBId)
  }

  const applyPreset = (preset: ComparePreset) => {
    setReportAId(preset.reportAId)
    setReportBId(preset.reportBId)
    void runCompare(preset.reportAId, preset.reportBId)
  }

  const reportOptions = reports.map((r) => ({
    value: r.id,
    label: `${r.patientName} | ${r.modality} ${r.bodyPart} | ${r.examDate} | ${r.doctorName}${r.isAiGenerated ? ' (AI)' : ''}`,
  }))

  const keyFieldColumns = [
    {
      title: '关键字段', dataIndex: 'label', key: 'label', width: 110,
      render: (v: string, f: { field: string; change: string }) => (
        <Space size={6}>
          <Text strong>{v}</Text>
          <Tag color={f.change === 'same' ? 'default' : f.change === 'added' ? 'green' : f.change === 'removed' ? 'red' : 'orange'} style={{ marginInlineEnd: 0 }}>
            {f.change === 'same' ? '一致' : f.change === 'added' ? '新增' : f.change === 'removed' ? '删除' : '修改'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '报告 A (原)', dataIndex: 'original', key: 'original',
      render: (v: string, f: { equal: boolean }) => (
        <Text style={f.equal ? { color: '#94a3b8' } : { color: '#b91c1c' }}>{v || '—'}</Text>
      ),
    },
    {
      title: '报告 B (新)', dataIndex: 'updated', key: 'updated',
      render: (v: string, f: { equal: boolean }) => (
        <Text style={f.equal ? { color: '#94a3b8' } : { color: '#15803d' }}>{v || '—'}</Text>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={<Space><GitCompare size={16} color="#2563eb" /><span>报告对比 V2</span><Tag color="blue">逐段 diff · 关键字段 · 相似度</Tag></Space>}
        extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadData()} loading={loading}>刷新</Button>}
      >
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

        <Row gutter={12} align="middle" style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary">报告 A (原)</Text>
              <Select
                showSearch optionFilterProp="label" allowClear placeholder="选择报告 A"
                style={{ width: '100%' }} value={reportAId} onChange={setReportAId}
                options={reportOptions} loading={loading}
              />
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary">报告 B (新)</Text>
              <Select
                showSearch optionFilterProp="label" allowClear placeholder="选择报告 B"
                style={{ width: '100%' }} value={reportBId} onChange={setReportBId}
                options={reportOptions} loading={loading}
              />
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">预设场景 (一键对比)</Text>
              <Space wrap>
                {presets.map((p) => (
                  <Tooltip key={p.id} title={p.description}>
                    <Button size="small" type={p.type === 'patient-history' ? 'primary' : 'default'}
                      icon={<Star size={12} />} onClick={() => applyPreset(p)}>
                      {TYPE_LABEL[p.type]}
                    </Button>
                  </Tooltip>
                ))}
              </Space>
            </Space>
          </Col>
        </Row>

        <Button type="primary" icon={<GitCompare size={14} />} onClick={handleCompare} loading={compareLoading}>
          开始对比
        </Button>

        {result && (
          <>
            <Divider style={{ margin: '16px 0 12px' }} />
            <Space style={{ marginBottom: 12 }} wrap>
              <Tag color={TYPE_COLOR[result.type]}>{TYPE_LABEL[result.type]}</Tag>
              <Space size={4}><FileText size={13} color="#64748b" /><Text type="secondary">A:</Text><SummaryTag report={result.reportA} /></Space>
              <Space size={4}><FileText size={13} color="#64748b" /><Text type="secondary">B:</Text><SummaryTag report={result.reportB} /></Space>
              <Tag color="green" icon={<CheckCircle2 size={12} />}>确定性对比</Tag>
            </Space>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <Card size="small">
                  <Statistic title="相似度" value={result.statistics.similarity} suffix="/ 100" valueStyle={{ color: '#2563eb' }} />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Space align="center">
                    <Progress type="circle" size={72} percent={result.statistics.similarity} strokeColor="#2563eb" format={(p) => `${p}%`} />
                  </Space>
                </Card>
              </Col>
              <Col span={4}><Card size="small"><Statistic title="相同行" value={result.statistics.same} valueStyle={{ color: '#94a3b8' }} /></Card></Col>
              <Col span={4}><Card size="small"><Statistic title="修改行" value={result.statistics.modified} valueStyle={{ color: '#b45309' }} /></Card></Col>
              <Col span={4}><Card size="small"><Statistic title="新增 / 删除" value={`${result.statistics.added} / ${result.statistics.removed}`} valueStyle={{ color: result.statistics.added + result.statistics.removed > 0 ? '#ef4444' : undefined }} /></Card></Col>
              <Col span={4}><Card size="small"><Statistic title="关键字段变更" value={result.statistics.keyFieldChanges} valueStyle={{ color: result.statistics.keyFieldChanges > 0 ? '#f59e0b' : undefined }} /></Card></Col>
            </Row>

            <Space style={{ marginBottom: 8 }}>
              <PencilLine size={14} color="#2563eb" />
              <Text strong>逐段差异 ({result.sectionDiffs.length} 段)</Text>
              <Text type="secondary">变更率 {result.statistics.changeRate}%</Text>
            </Space>
            {result.sectionDiffs.map((section) => (
              <Card key={section.section} size="small" style={{ marginBottom: 8 }}
                title={
                  <Space size={8}>
                    <Text strong>{section.label}</Text>
                    <Tag color={section.type === 'same' ? 'default' : section.type === 'added' ? 'green' : section.type === 'removed' ? 'red' : 'orange'} style={{ marginInlineEnd: 0 }}>
                      {diffTypeMeta[section.type]?.label ?? section.type}
                    </Tag>
                    {section.originalLineCount !== section.updatedLineCount && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {section.originalLineCount} 行 → {section.updatedLineCount} 行
                      </Text>
                    )}
                  </Space>
                }>
                {section.ops.length === 0
                  ? <Empty description="该段落无内容" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '8px 0' }} />
                  : section.ops.map((op, idx) => <DiffLineRow key={`${section.section}-${idx}`} op={op} />)}
              </Card>
            ))}

            <Space style={{ margin: '12px 0 8px' }}>
              <MinusCircle size={14} color="#2563eb" />
              <Text strong>关键字段对比</Text>
            </Space>
            <Table
              rowKey="field" size="small" columns={keyFieldColumns}
              dataSource={result.keyFields} pagination={false} scroll={{ x: 'max-content' }}
            />

            <Space style={{ margin: '12px 0 8px' }}>
              <PlusCircle size={14} color="#2563eb" />
              <Text strong>行级差异明细 ({result.lineDiffs.length})</Text>
              <Text type="secondary">红=删除 · 绿=新增 · 琥珀=修改</Text>
            </Space>
            <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8 }}>
              {result.lineDiffs.filter((op) => op.type !== 'same').map((op, idx) => (
                <DiffLineRow key={`detail-${idx}`} op={op} />
              ))}
              {result.lineDiffs.filter((op) => op.type !== 'same').length === 0 && (
                <Empty description="两份报告完全一致" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '8px 0' }} />
              )}
            </div>
          </>
        )}
      </Card>

      {stats && (
        <Card size="small" style={{ marginTop: 12 }}
          title={<Space><User size={14} /><span>对比语料统计</span></Space>}>
          <Space split={<Divider type="vertical" style={{ margin: 0 }} />} wrap>
            <Text>报告总数 <Text strong>{stats.totalReports}</Text></Text>
            <Text>预设组合 <Text strong>{stats.presetCount}</Text></Text>
            <Text>机构数 <Text strong>{stats.organizationCount}</Text></Text>
            <Text>预设平均相似度 <Text strong style={{ color: '#2563eb' }}>{stats.avgSimilarity}</Text></Text>
            <Space size={4}>
              <Calendar size={12} />
              {(['patient-history', 'dual-read', 'doctor-ai'] as CompareType[]).map((t) => (
                <Tag key={t} color={TYPE_COLOR[t]} style={{ marginInlineEnd: 0 }}>{TYPE_LABEL[t]} × {stats.byType[t]}</Tag>
              ))}
            </Space>
          </Space>
        </Card>
      )}
    </div>
  )
}

export default ReportComparePanel

import React, { useState, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import {
  Card, Input, Select, Button, Tag, Space, Typography, Row, Col, Statistic,
  Table, Progress, Alert, Divider, Empty, message, DatePicker,
} from 'antd'
import {
  Search, Sparkles, Filter, RefreshCw, Building2, Stethoscope, Activity, FileSearch,
} from 'lucide-react'
import {
  reportSearchV2Api,
  type SearchHit,
  type SearchResult,
  type SearchCondition,
  type SearchMeta,
  type NaturalLanguageResult,
  type HighlightSnippet,
} from '../../services/api/reportSearchV2Api'

const { Text } = Typography
const { RangePicker } = DatePicker

/** 解包后端 { success, data } 包装 (兼容裸数据) */
function unwrap<T>(res: { success: boolean; data?: unknown }): T | null {
  if (!res.success) return null
  const d = res.data as { data?: T } | T | null
  if (d && typeof d === 'object' && 'data' in d && (d as { data?: unknown }).data !== undefined) {
    return (d as { data: T }).data
  }
  return d as T
}

/** 高亮片段渲染: 按 ranges 切 <mark> */
function HighlightText({ snippet }: { snippet: HighlightSnippet }) {
  const { text, ranges } = snippet
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start < cursor) continue
    parts.push(text.slice(cursor, r.start))
    parts.push(<mark key={`m-${r.start}`} style={{ background: '#fde68a', color: '#92400e', padding: '0 2px', borderRadius: 2 }}>{text.slice(r.start, r.end)}</mark>)
    cursor = r.end
  }
  parts.push(text.slice(cursor))
  return <span>{parts}</span>
}

/** 结论高亮: 对 matchedKeywords 直接命中标记 */
function ConclusionHighlight({ hit }: { hit: SearchHit }) {
  const text = hit.conclusion || ''
  const keywords = hit.matchedKeywords.filter((k) => k && text.toLowerCase().includes(k.toLowerCase()))
  if (keywords.length === 0) return <Text type="secondary">{text || '—'}</Text>
  let nodes: React.ReactNode[] = [text]
  for (const kw of keywords) {
    const next: React.ReactNode[] = []
    for (const node of nodes) {
      if (typeof node !== 'string') {
        next.push(node)
        continue
      }
      const lower = node.toLowerCase()
      const pos = lower.indexOf(kw.toLowerCase())
      if (pos < 0) {
        next.push(node)
        continue
      }
      if (pos > 0) next.push(node.slice(0, pos))
      next.push(
        <mark key={`${kw}-${next.length}`} style={{ background: '#fde68a', color: '#92400e', padding: '0 2px', borderRadius: 2 }}>
          {node.slice(pos, pos + kw.length)}
        </mark>,
      )
      const rest = node.slice(pos + kw.length)
      if (rest) next.push(rest)
    }
    nodes = next
  }
  return <span>{nodes}</span>
}

const EMPTY_RESULT: SearchResult = {
  items: [],
  total: 0,
  aggregations: { total: 0, byModality: [], byOrganization: [], byDoctor: [], byDiagnosis: [], dateRange: { from: null, to: null } },
  source: 'seed',
}

/** [Wave 8A] 报告检索 V2 面板: 关键词 + 结构化条件 + 自然语言输入 + 结果高亮 + 聚合 */
const ReportSearchV2Panel: React.FC = () => {
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [phrase, setPhrase] = useState('')
  const [parsed, setParsed] = useState<NaturalLanguageResult['parsed']>([])
  const [conditions, setConditions] = useState<SearchCondition>({})
  const [filters, setFilters] = useState<SearchCondition>({})
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT)
  const [loading, setLoading] = useState(false)
  const [nlpLoading, setNlpLoading] = useState(false)
  const [error, setError] = useState('')

  const loadMeta = useCallback(async () => {
    try {
      const res = await reportSearchV2Api.getMeta()
      const m = unwrap<SearchMeta>(res)
      if (m) setMeta(m)
    } catch { /* 元数据加载失败不阻塞检索 */ }
  }, [])

  useEffect(() => { void loadMeta() }, [loadMeta])

  const doSearch = useCallback(async (cond: SearchCondition, source: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await reportSearchV2Api.search(cond)
      const data = unwrap<SearchResult>(res)
      if (data) {
        setResult(data)
      } else if (source === 'structured') {
        message.error(res.error?.message ?? '检索失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '检索失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleStructuredSearch = () => {
    const cond: SearchCondition = { ...filters }
    if (dateRange) {
      cond.dateFrom = dateRange[0]
      cond.dateTo = dateRange[1]
    }
    setConditions(cond)
    setParsed([])
    void doSearch(cond, 'structured')
  }

  const handleNlp = async () => {
    const p = phrase.trim()
    if (!p) { message.warning('请输入自然语言查询, 如: 近 3 个月肺结节阳性 CT 报告'); return }
    setNlpLoading(true)
    setError('')
    try {
      const res = await reportSearchV2Api.naturalLanguage(p)
      const data = unwrap<NaturalLanguageResult>(res)
      if (data) {
        setParsed(data.parsed)
        setConditions(data.conditions)
        setResult({ items: data.items, total: data.total, aggregations: data.aggregations, source: data.source })
        if (data.conditions.organization) setFilters((f) => ({ ...f, organization: data.conditions.organization }))
      } else {
        message.error(res.error?.message ?? '解析失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '解析失败')
    } finally {
      setNlpLoading(false)
    }
  }

  const handleNlpSearch = async () => {
    await handleNlp()
  }

  const clearAll = () => {
    setFilters({})
    setDateRange(null)
    setPhrase('')
    setParsed([])
    setConditions({})
    setResult(EMPTY_RESULT)
  }

  const aggCols = [
    { key: 'modality', label: '检查类型', icon: <Activity size={13} />, data: result.aggregations.byModality, color: '#2563eb' },
    { key: 'organization', label: '机构 (跨机构)', icon: <Building2 size={13} />, data: result.aggregations.byOrganization, color: '#7c3aed' },
    { key: 'doctor', label: '医生', icon: <Stethoscope size={13} />, data: result.aggregations.byDoctor, color: '#059669' },
    { key: 'diagnosis', label: '诊断词', icon: <FileSearch size={13} />, data: result.aggregations.byDiagnosis, color: '#d97706' },
  ]

  const columns = [
    {
      title: '相关性', dataIndex: 'relevance', key: 'relevance', width: 130,
      sorter: (a: SearchHit, b: SearchHit) => a.relevance - b.relevance,
      render: (v: number) => (
        <Space size={6}>
          <Text strong style={{ color: v >= 60 ? '#16a34a' : v >= 30 ? '#d97706' : '#94a3b8', width: 28, display: 'inline-block' }}>{v}</Text>
          <Progress percent={v} showInfo={false} size="small" strokeColor={v >= 60 ? '#16a34a' : v >= 30 ? '#d97706' : '#94a3b8'} style={{ width: 64 }} />
        </Space>
      ),
    },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 100 },
    {
      title: '检查', dataIndex: 'modality', key: 'modality', width: 90,
      render: (v: string, r: SearchHit) => <Space size={4}><Tag style={{ marginInlineEnd: 0 }}>{v}</Tag><Text type="secondary">{r.bodyPart}</Text></Space>,
    },
    { title: '日期', dataIndex: 'examDate', key: 'examDate', width: 100 },
    { title: '医生', dataIndex: 'doctorName', key: 'doctorName', width: 100 },
    { title: '机构', dataIndex: 'organization', key: 'organization', width: 110 },
    {
      title: '命中词', dataIndex: 'matchedKeywords', key: 'matchedKeywords', width: 160,
      render: (v: string[]) => (
        <Space size={4} wrap>
          {(v ?? []).map((k) => <Tag key={k} color="gold" style={{ marginInlineEnd: 0 }}>{k}</Tag>)}
        </Space>
      ),
    },
    {
      title: '诊断结论 (高亮)', dataIndex: 'conclusion', key: 'conclusion',
      render: (_: unknown, r: SearchHit) => <ConclusionHighlight hit={r} />,
    },
  ]

  return (
    <div>
      <Card
        title={<Space><Search size={16} color="#2563eb" /><span>报告检索 V2</span><Tag color="blue">自然语言 · 跨机构 · 高亮</Tag></Space>}
        extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => { void loadMeta(); void doSearch(conditions, 'structured') }} loading={loading}>刷新</Button>}
      >
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

        {/* 自然语言查询 */}
        <Card size="small" style={{ marginBottom: 12 }}
          title={<Space><Sparkles size={14} color="#7c3aed" /><Text strong>自然语言查询</Text><Text type="secondary" style={{ fontSize: 12 }}>例: "近 3 个月肺结节阳性 CT 报告" / "2026年6月脑梗死 MR" / "东城分院 骨折"</Text></Space>}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={phrase} onChange={(e) => setPhrase(e.target.value)}
              placeholder="输入自然语言, 自动解析 时间范围 + 检查类型 + 诊断关键词 + 机构 + 医生"
              onPressEnter={() => void handleNlpSearch()}
            />
            <Button type="primary" icon={<Sparkles size={14} />} loading={nlpLoading} onClick={() => void handleNlpSearch()}>
              解析并检索
            </Button>
          </Space.Compact>
          {parsed.length > 0 && (
            <Space size={6} wrap style={{ marginTop: 8 }}>
              <Text type="secondary">解析条件:</Text>
              {parsed.map((p) => (
                <TooltipTag key={p.key} label={p.label} value={p.value} />
              ))}
            </Space>
          )}
        </Card>

        {/* 结构化条件 */}
        <Card size="small" style={{ marginBottom: 12 }}
          title={<Space><Filter size={14} color="#2563eb" /><Text strong>结构化条件</Text></Space>}>
          <Row gutter={12}>
            <Col span={5}>
              <Input
                placeholder="全文关键词 (空格多词 AND)" value={filters.keyword ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              />
            </Col>
            <Col span={3}>
              <Select
                allowClear placeholder="检查类型" style={{ width: '100%' }}
                value={filters.modality} onChange={(v) => setFilters((f) => ({ ...f, modality: v }))}
                options={(meta?.modalities ?? []).map((m) => ({ value: m, label: m }))}
              />
            </Col>
            <Col span={3}>
              <Select
                allowClear placeholder="机构 (跨机构)" style={{ width: '100%' }}
                value={filters.organization} onChange={(v) => setFilters((f) => ({ ...f, organization: v }))}
                options={(meta?.organizations ?? []).map((o) => ({ value: o.name, label: `${o.name} (${o.count})` }))}
              />
            </Col>
            <Col span={3}>
              <Select
                allowClear placeholder="医生" style={{ width: '100%' }}
                value={filters.doctor} onChange={(v) => setFilters((f) => ({ ...f, doctor: v }))}
                options={(meta?.doctors ?? []).map((d) => ({ value: d.name, label: `${d.name} (${d.count})` }))}
              />
            </Col>
            <Col span={4}>
              <RangePicker
                style={{ width: '100%' }}
                value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
                onChange={(v) => setDateRange(v && v[0] && v[1] ? [v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')] : null)}
              />
            </Col>
            <Col span={4}>
              <Input
                placeholder="诊断关键词 (如: 肺结节)" value={filters.diagnosisKeyword ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, diagnosisKeyword: e.target.value }))}
              />
            </Col>
            <Col span={2}>
              <Button type="primary" icon={<Search size={13} />} onClick={handleStructuredSearch} loading={loading} style={{ width: '100%' }}>
                检索
              </Button>
            </Col>
          </Row>
          <Space style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {Object.keys(conditions).length > 0 ? `当前生效条件: ${JSON.stringify(conditions)}` : '未生效条件: 留空 = 全部'}
            </Text>
            <Button size="small" type="link" onClick={clearAll} style={{ padding: 0 }}>清空</Button>
          </Space>
        </Card>

        {/* 聚合统计 */}
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={3}><Card size="small"><Statistic title="命中总数" value={result.total} valueStyle={{ color: '#2563eb' }} /></Card></Col>
          {aggCols.map((agg) => (
            <Col span={5} key={agg.key}>
              <Card size="small" title={<Space size={6}>{agg.icon}<Text style={{ fontSize: 12 }}>{agg.label}</Text></Space>}>
                <Space size={4} wrap>
                  {agg.data.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>—</Text>}
                  {agg.data.slice(0, 4).map((d) => (
                    <Tag key={d.key} color={agg.color} style={{ marginInlineEnd: 0 }}>{d.key} × {d.count}</Tag>
                  ))}
                </Space>
              </Card>
            </Col>
          ))}
          <Col span={2}>
            <Card size="small" title={<Text style={{ fontSize: 12 }}>日期范围</Text>}>
              <Text style={{ fontSize: 12 }}>{result.aggregations.dateRange.from ?? '—'}</Text>
              <Divider style={{ margin: '2px 0' }} />
              <Text style={{ fontSize: 12 }}>{result.aggregations.dateRange.to ?? '—'}</Text>
            </Card>
          </Col>
        </Row>

        {/* 结果列表 */}
        <Table
          rowKey="reportId" size="small" loading={loading}
          dataSource={result.items} columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowRender: (r: SearchHit) => (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {r.snippets.length === 0 && <Empty description="无高亮片段" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 0 }} />}
                {r.snippets.map((s) => (
                  <div key={`${s.field}-${s.text.slice(0, 12)}`} style={{ background: '#f8fafc', borderRadius: 4, padding: '4px 8px' }}>
                    <Tag style={{ marginInlineEnd: 8 }}>{s.label}</Tag>
                    <HighlightText snippet={s} />
                  </div>
                ))}
                <Text type="secondary" style={{ fontSize: 12 }}>报告号: {r.reportId} · 患者: {r.patientId}{r.isCritical ? ' · 危急' : ''}</Text>
              </Space>
            ),
          }}
        />
        {result.total === 0 && !loading && (
          <Empty description="暂无命中, 调整关键词或条件后重试" style={{ marginTop: 24 }} />
        )}
      </Card>
    </div>
  )
}

/** 解析条件 Tag (自动换行提示) */
function TooltipTag({ label, value }: { label: string; value: string }) {
  return (
    <Tag color="purple" style={{ marginInlineEnd: 0 }}>
      <Text style={{ color: '#7c3aed', fontSize: 12 }}>{label}: </Text>
      {value}
    </Tag>
  )
}

export default ReportSearchV2Panel

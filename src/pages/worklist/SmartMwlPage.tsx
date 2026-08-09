import { usePagination } from '../../hooks/usePagination'
import { smartMwlApi, toSmartScoreInput, type SmartMwlItem } from '../../services/api/smartMwlApi'
import {
  worklistSmartApi,
  type SmartScoreResult,
  type SmartFactorDetail,
  type SmartPriorityCounts,
  type SmartWeightConfig,
  type SmartScoreInput,
} from '../../services/api/worklistSmartApi'
import { Card, Table, Button, Tag, Space, Input, Row, Col, Statistic, Slider, Form, Modal, message, Alert, Progress, Tooltip } from 'antd'
import { Search, ArrowUpDown, Settings, RefreshCw, Clock, AlertTriangle, FileText, BarChart3, Eye, Info } from 'lucide-react'

import React, { useState, useEffect, useCallback } from 'react'

const levelMeta: Record<string, { label: string; color: string }> = {
  critical: { label: '危急', color: 'red' },
  urgent: { label: '紧急', color: 'orange' },
  normal: { label: '常规', color: 'blue' },
  low: { label: '低', color: 'green' },
}
const groupMeta: Record<keyof SmartPriorityCounts, { label: string; color: string }> = {
  critical: { label: '危急', color: '#cf1322' },
  high: { label: '高优先级', color: '#fa8c16' },
  medium: { label: '中优先级', color: '#d4b106' },
  low: { label: '低优先级', color: '#52c41a' },
}

interface SmartRow {
  item: SmartMwlItem
  input: SmartScoreInput
  result: SmartScoreResult | null
  rank: number
}

const factorCell = (f: SmartFactorDetail | undefined, raw: React.ReactNode) => (
  <span>
    <span style={{ fontWeight: 500 }}>{raw ?? '—'}</span>
    {f && (
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
        {(f.score * 100).toFixed(0)}分 × {(f.weight * 100).toFixed(0)}%权重
        {f.source && <div style={{ color: f.source === '真实分检记录' ? '#16a34a' : undefined }}>{f.source}</div>}
      </div>
    )}
  </span>
)

const SmartMwlPage: React.FC = () => {
  const [rows, setRows] = useState<SmartRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [priorities, setPriorities] = useState<SmartPriorityCounts>({ critical: 0, high: 0, medium: 0, low: 0 })
  const [weights, setWeights] = useState<SmartWeightConfig | null>(null)
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [savingWeights, setSavingWeights] = useState(false)
  const [detail, setDetail] = useState<SmartRow | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const wl = await smartMwlApi.getWorklist()
      if (!wl.success) throw new Error((wl.error as { message?: string })?.message || '工作列表加载失败')
      const inputs = wl.data.map(toSmartScoreInput)
      const scored = await Promise.all(inputs.map((input) => worklistSmartApi.score(input)))
      const merged = wl.data
        .map((item, i) => {
          const input = inputs[i]
          const s = scored[i]
          if (!input || !s) return null
          return { item, input, result: s.success ? s.data : null, rank: 0 }
        })
        .filter((r): r is SmartRow & { result: SmartScoreResult } => r !== null && r.result !== null)
        .sort((a, b) => b.result.score - a.result.score)
      setRows(merged)
      const [wRes, pRes] = await Promise.all([worklistSmartApi.getWeights(), worklistSmartApi.getPriorities()])
      if (wRes.success) setWeights(wRes.data)
      if (pRes.success) setPriorities(pRes.data)
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleReorder = async () => {
    setLoading(true)
    try {
      const res = await worklistSmartApi.reorder(rows.map((r) => r.input))
      if (!res.success) throw new Error('排序失败')
      const rankMap = new Map(res.data.map((r) => [r.id, r.rank]))
      setRows((prev) =>
        [...prev].sort((a, b) => (rankMap.get(a.item.id) ?? 0) - (rankMap.get(b.item.id) ?? 0)).map((r) => ({ ...r, rank: rankMap.get(r.item.id) ?? 0 })),
      )
      message.success('智能排序完成')
    } catch {
      message.error('排序失败')
    } finally {
      setLoading(false)
    }
  }

  const openWeights = async () => {
    setWeightsOpen(true)
    const res = await worklistSmartApi.getWeights()
    if (res.success) setWeights(res.data)
  }

  const saveWeights = async () => {
    if (!weights) return
    setSavingWeights(true)
    try {
      const res = await worklistSmartApi.setWeights(weights)
      if (!res.success) throw new Error('保存失败')
      setWeights(res.data)
      message.success('权重已保存,重新计算评分')
      setWeightsOpen(false)
      await fetchAll()
    } catch {
      message.error('保存失败')
    } finally {
      setSavingWeights(false)
    }
  }

  const weightSum = weights ? weights.urgencyWeight + weights.waitWeight + weights.ageWeight + weights.examTypeWeight : 0
  const total = rows.length

  const filteredRows = rows.filter(
    (r) =>
      !search ||
      r.item.patientName.toLowerCase().includes(search.toLowerCase()) ||
      r.item.examItem.toLowerCase().includes(search.toLowerCase()) ||
      r.item.id.toLowerCase().includes(search.toLowerCase()),
  )
  // [W3-C] 受控分页: 智能排序列表 (基于过滤后的行)
  const rowPagination = usePagination(filteredRows, 10)

  const columns = [
    {
      title: '排名',
      key: 'rank',
      width: 70,
      render: (_: unknown, r: SmartRow) =>
        r.rank > 0 ? <Tag color={r.rank <= 3 ? 'red' : 'default'}>{r.rank}</Tag> : <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: '优先级',
      key: 'level',
      width: 80,
      render: (_: unknown, r: SmartRow) => {
        const m = levelMeta[r.result?.level ?? 'low'] ?? { label: '低', color: 'green' }
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '患者',
      key: 'patient',
      render: (_: unknown, r: SmartRow) => (
        <Space orientation="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{r.item.patientName}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {r.item.gender ?? '-'} / {r.item.age ?? '-'}岁
          </span>
        </Space>
      ),
    },
    {
      title: '检查项目',
      key: 'exam',
      render: (_: unknown, r: SmartRow) => (
        <Space orientation="vertical" size={0}>
          <span>{r.item.examItem || r.item.modality}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {r.item.modality} · {r.item.bodyPart}
          </span>
        </Space>
      ),
    },
    { title: '患者类型', dataIndex: 'item.patientType', key: 'patientType', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: unknown, r: SmartRow) => <Tag color={r.item.status === '待检查' ? 'blue' : 'default'}>{r.item.status}</Tag>,
    },
    {
      title: '等待时长',
      key: 'wait',
      width: 130,
      render: (_: unknown, r: SmartRow) => {
        const f = r.result?.factors.find((x) => x.key === 'wait')
        const minutes = r.input.waitingMinutes
        return factorCell(f, <span style={{ color: minutes > 120 ? '#ff4d4f' : undefined }}>{minutes}min</span>)
      },
    },
    {
      title: '紧急度',
      key: 'urgency',
      width: 130,
      render: (_: unknown, r: SmartRow) => {
        const f = r.result?.factors.find((x) => x.key === 'urgency')
        return factorCell(f, `${r.input.urgency >= 0 ? '+' : ''}${r.input.urgency}`)
      },
    },
    {
      title: (
        <Tooltip title="AI 分检因子得分来源：优先聚合 /triage 真实分检记录(患者最近分检得分)，无记录时回退检查优先级/危急标志">
          <Space size={4}>AI 分检 <Info size={12} style={{ color: 'var(--text-secondary)' }} /></Space>
        </Tooltip>
      ),
      key: 'aiTriage',
      width: 150,
      render: (_: unknown, r: SmartRow) => {
        const f = r.result?.factors.find((x) => x.key === 'aiTriage')
        const isHigh = (f?.score ?? 0) >= 0.5
        return factorCell(f, <Tag color={isHigh ? 'red' : 'default'}>{r.item.priority || '普通'}</Tag>)
      },
    },
    {
      title: '综合评分',
      key: 'score',
      width: 140,
      render: (_: unknown, r: SmartRow) => {
        const score = r.result?.score ?? 0
        return (
          <Space size={8}>
            <strong style={{ color: score >= 70 ? '#cf1322' : score >= 45 ? '#fa8c16' : '#2563eb' }}>{score}</strong>
            <Progress percent={Math.min(100, score)} size="small" style={{ width: 70 }} showInfo={false} strokeColor={score >= 70 ? '#cf1322' : score >= 45 ? '#fa8c16' : '#2563eb'} />
          </Space>
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_: unknown, r: SmartRow) => (
        <Button size="small" icon={<Eye size={14} />} onClick={() => setDetail(r)}>
          明细
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BarChart3 size={20} color="#2563eb" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>智能 MWL 排序</h1>
        <Tag color="blue">多因子评分</Tag>
        <Tag color="purple">权重可配置</Tag>
        <Tag color="green">AI 分检因子 = /triage 真实记录</Tag>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<Info size={16} />}
        style={{ marginBottom: 16 }}
        message="AI 分检因子得分来源"
        description="AI 分检因子优先聚合后端 /triage/score 写入的真实分检记录（患者最近分检得分 0-1 映射），无记录或 DB 不可用时回退检查 priority / criticalFinding 关键字推断；因子明细中可查看每行得分来源。"
      />

      {error && <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={fetchAll}><RefreshCw size={14} /> 重试</Button>} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="总检查数" value={total} prefix={<FileText size={16} />} /></Card></Col>
        {(Object.keys(groupMeta) as Array<keyof SmartPriorityCounts>).map((k) => (
          <Col span={5} key={k}>
            <Card size="small">
              <Statistic
                title={groupMeta[k].label}
                value={priorities[k]}
                styles={{ content: { color: groupMeta[k].color } }}
                prefix={k === 'critical' ? <AlertTriangle size={16} /> : k === 'high' ? <Clock size={16} /> : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="检查列表"
        extra={
          <Space>
            <Input placeholder="搜索患者/检查/ID" prefix={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} allowClear />
            <Button icon={<ArrowUpDown size={14} />} onClick={handleReorder} disabled={rows.length === 0}>
              智能排序
            </Button>
            <Button icon={<Settings size={14} />} onClick={openWeights}>
              权重配置
            </Button>
            <Button icon={<RefreshCw size={14} />} onClick={fetchAll} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table dataSource={rowPagination.pageData} columns={columns} rowKey={(r) => r.item.id} loading={loading} pagination={rowPagination.pagination} size="small" scroll={{ x: 'max-content' }}/>
      </Card>

      <Modal
        title={`因子明细 - ${detail?.item.patientName ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={640}
      >
        {detail?.result && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="综合评分" value={detail.result.score} styles={{ content: { color: detail.result.score >= 70 ? '#cf1322' : '#2563eb' } }} />
                </Col>
                <Col span={8}>
                  <Statistic title="优先级" value={levelMeta[detail.result.level]?.label ?? '-'} styles={{ content: { color: levelMeta[detail.result.level]?.color ?? '#2563eb' } }} />
                </Col>
                <Col span={8}>
                  <Statistic title="等待时长" value={detail.input.waitingMinutes} suffix="min" />
                </Col>
              </Row>
            </Card>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px' }}>评分因子(得分 × 权重 = 贡献)</h4>
              {detail.result.factors.map((f) => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <Tooltip title={f.label}>
                    <span style={{ width: 80 }}>{f.label}</span>
                  </Tooltip>
                  <Slider style={{ flex: 1 }} value={f.score * 100} disabled tooltip={{ formatter: () => `${f.label}得分 ${(f.score * 100).toFixed(0)}分` }} />
                  <span style={{ width: 200, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {(f.score * 100).toFixed(0)}分 × {(f.weight * 100).toFixed(0)}% = {(f.contribution * 100).toFixed(1)}
                    {f.source && <div style={{ color: f.source === '真实分检记录' ? '#16a34a' : undefined }}>{f.source}</div>}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px' }}>评估理由</h4>
              <Space wrap>{detail.result.reasons.map((r, i) => <Tag key={i}>{r}</Tag>)}</Space>
            </div>
          </>
        )}
      </Modal>

      <Modal
        title="权重配置"
        open={weightsOpen}
        onOk={saveWeights}
        onCancel={() => setWeightsOpen(false)}
        confirmLoading={savingWeights}
        okText="保存并重算"
      >
        <Alert
          style={{ marginBottom: 16 }}
          type={weights?.persisted === false ? 'warning' : 'success'}
          showIcon
          message={weights?.persisted === false ? '运行时生效' : '已持久化'}
          description={
            weights?.persisted === false
              ? '后端 system_config 不可用，权重仅本次进程运行时生效（重启恢复默认值）。'
              : '权重已保存至后端 system_config 表，跨进程/重启后依然生效。'
          }
        />
        <Form layout="vertical">
          <Form.Item label={`紧急度权重 (${(weights?.urgencyWeight ?? 0) * 100}%)`}>
            <Slider min={0} max={1} step={0.05} value={weights?.urgencyWeight ?? 0} onChange={(v) => setWeights((p) => ({ ...p!, urgencyWeight: v }))} />
          </Form.Item>
          <Form.Item label={`等待时长权重 (${(weights?.waitWeight ?? 0) * 100}%)`}>
            <Slider min={0} max={1} step={0.05} value={weights?.waitWeight ?? 0} onChange={(v) => setWeights((p) => ({ ...p!, waitWeight: v }))} />
          </Form.Item>
          <Form.Item label={`年龄权重 (${(weights?.ageWeight ?? 0) * 100}%)`}>
            <Slider min={0} max={1} step={0.05} value={weights?.ageWeight ?? 0} onChange={(v) => setWeights((p) => ({ ...p!, ageWeight: v }))} />
          </Form.Item>
          <Form.Item label={`检查类型权重 (${(weights?.examTypeWeight ?? 0) * 100}%)`}>
            <Slider min={0} max={1} step={0.05} value={weights?.examTypeWeight ?? 0} onChange={(v) => setWeights((p) => ({ ...p!, examTypeWeight: v }))} />
          </Form.Item>
          <div style={{ color: weightSum > 1.05 || weightSum < 0.95 ? '#ff4d4f' : '#8c8c8c', fontSize: 12 }}>
            权重合计: {(weightSum * 100).toFixed(0)}% {weightSum !== 1 ? '(建议合计 100%)' : ''}
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartMwlPage

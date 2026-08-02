/**
 * G005 放射RIS系统 v3.0.6.1 - GE Centricity 危急值闭环管理入口
 * 对标:GE Critical Results Workflow - 发现 → 通知 → 确认 → 处置 → 追踪 全流程
 */
import React, { useState, useEffect } from 'react'
import { Card, Table, Statistic, Row, Col, Tag, Progress, Empty } from 'antd'

interface CriticalEvent {
  id: string
  patientName: string
  patientId: string
  finding: string
  severity: 'LIFE_THREATENING' | 'URGENT' | 'IMPORTANT'
  triggeredAt: string
  stage: 'DISCOVERED' | 'NOTIFIED' | 'ACKNOWLEDGED' | 'TREATED' | 'TRACKED'
  notifier: string
  acker: string
  notifMethod: string
  slaMin: number
  ackMin: number
  closedMin: number
}

const MOCK_EVENTS: CriticalEvent[] = [
  { id: 'C001', patientName: '王建国', patientId: 'P20240618001', finding: '颅内大动脉闭塞(LVO)', severity: 'LIFE_THREATENING', triggeredAt: '2024-06-18 09:05', stage: 'TRACKED', notifier: 'AI 引擎', acker: '陈医师', notifMethod: '电话+APP', slaMin: 30, ackMin: 1, closedMin: 30 },
  { id: 'C002', patientName: '李美芳', patientId: 'P20240618002', finding: '肺动脉主干栓塞', severity: 'LIFE_THREATENING', triggeredAt: '2024-06-18 09:20', stage: 'TREATED', notifier: 'AI 引擎', acker: '林医师', notifMethod: '电话', slaMin: 30, ackMin: 2, closedMin: 24 },
  { id: 'C003', patientName: '张伟', patientId: 'P20240618003', finding: '脾破裂伴活动性出血', severity: 'URGENT', triggeredAt: '2024-06-18 09:35', stage: 'ACKNOWLEDGED', notifier: 'AI 引擎', acker: '黄医师', notifMethod: 'APP+短信', slaMin: 15, ackMin: 3, closedMin: 0 },
  { id: 'C004', patientName: '陈晓敏', patientId: 'P20240618004', finding: '张力性气胸', severity: 'URGENT', triggeredAt: '2024-06-18 09:45', stage: 'NOTIFIED', notifier: '陈医师', acker: '未确认', notifMethod: 'APP', slaMin: 15, ackMin: 0, closedMin: 0 },
  { id: 'C005', patientName: '刘强', patientId: 'P20240618005', finding: '急性主动脉夹层(Stanford A)', severity: 'LIFE_THREATENING', triggeredAt: '2024-06-18 10:00', stage: 'DISCOVERED', notifier: 'AI 引擎', acker: '未通知', notifMethod: '未通知', slaMin: 30, ackMin: 0, closedMin: 0 },
  { id: 'C006', patientName: '赵丽华', patientId: 'P20240618006', finding: '消化道穿孔伴游离气体', severity: 'URGENT', triggeredAt: '2024-06-18 10:12', stage: 'TRACKED', notifier: 'AI 引擎', acker: '林医师', notifMethod: '电话+APP', slaMin: 15, ackMin: 1, closedMin: 14 },
]

const SEVERITY_META: Record<CriticalEvent['severity'], { color: string; label: string }> = {
  LIFE_THREATENING: { color: 'red', label: '危及生命' },
  URGENT: { color: 'orange', label: '紧急' },
  IMPORTANT: { color: 'gold', label: '重要' },
}

const STAGE_META: Record<CriticalEvent['stage'], { color: string; label: string; order: number }> = {
  DISCOVERED: { color: 'default', label: '① 发现', order: 0 },
  NOTIFIED: { color: 'blue', label: '② 通知', order: 1 },
  ACKNOWLEDGED: { color: 'cyan', label: '③ 确认', order: 2 },
  TREATED: { color: 'orange', label: '④ 处置', order: 3 },
  TRACKED: { color: 'green', label: '⑤ 追踪', order: 4 },
}

const Critical: React.FC = () => {
  const [tick, setTick] = useState<number>(0)

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 15000)
    return () => window.clearInterval(t)
  }, [])

  const total = MOCK_EVENTS.length
  const discovered = MOCK_EVENTS.filter((e) => e.stage === 'DISCOVERED').length
  const acked = MOCK_EVENTS.filter((e) => STAGE_META[e.stage].order >= 2).length
  const tracked = MOCK_EVENTS.filter((e) => e.stage === 'TRACKED').length
  const overdueAck = MOCK_EVENTS.filter((e) => e.ackMin === 0 && STAGE_META[e.stage].order < 2).length
  const ackedEvents = MOCK_EVENTS.filter((e) => e.ackMin > 0)
  const avgAck = ackedEvents.length ? Math.round(ackedEvents.reduce((s, e) => s + e.ackMin, 0) / ackedEvents.length) : 0

  const slaCompliance = (() => {
    const slaTotal = MOCK_EVENTS.filter((e) => e.ackMin > 0).length
    if (!slaTotal) return 0
    const within = MOCK_EVENTS.filter((e) => e.ackMin > 0 && e.ackMin <= e.slaMin).length
    return Math.round((within / slaTotal) * 100)
  })()

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: '患者',
      key: 'patient',
      width: 130,
      render: (_: unknown, r: CriticalEvent) => (
        <span>
          <strong>{r.patientName}</strong>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.patientId}</div>
        </span>
      ),
    },
    { title: '危急所见', dataIndex: 'finding', key: 'finding', width: 200 },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s: CriticalEvent['severity']) => <Tag color={SEVERITY_META[s].color}>{SEVERITY_META[s].label}</Tag>,
    },
    {
      title: '当前阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 220,
      render: (s: CriticalEvent['stage']) => (
        <div>
          <Tag color={STAGE_META[s].color}>{STAGE_META[s].label}</Tag>
          <Progress
            percent={((STAGE_META[s].order + 1) / 5) * 100}
            size="small"
            showInfo={false}
            style={{ marginTop: 2 }}
          />
        </div>
      ),
    },
    { title: '通知方式', dataIndex: 'notifMethod', key: 'notifMethod', width: 110 },
    { title: '通知人', dataIndex: 'notifier', key: 'notifier', width: 90 },
    {
      title: 'SLA',
      dataIndex: 'slaMin',
      key: 'slaMin',
      width: 80,
      render: (sla: number, r: CriticalEvent) => {
        const onTime = r.ackMin > 0 && r.ackMin <= sla
        const inProgress = r.ackMin === 0
        return (
          <Tag color={inProgress ? 'default' : onTime ? 'green' : 'red'}>
            {r.ackMin}/{sla} 分
          </Tag>
        )
      },
    },
    {
      title: '确认人',
      dataIndex: 'acker',
      key: 'acker',
      width: 90,
      render: (v: string) => (v === '未通知' || v === '未确认' ? <Tag color="red">{v}</Tag> : v),
    },
    { title: '触发时间', dataIndex: 'triggeredAt', key: 'triggeredAt', width: 140 },
  ]

  return (
    <div data-testid="critical-root">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="危急值总数" value={total} styles={{ content: {  color: '#3b82f6'  } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="待通知" value={discovered} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="超期未确认" value={overdueAck} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已确认" value={acked} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已闭环" value={tracked} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="平均确认(分)" value={avgAck} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card size="small" title="SLA 合规率">
            <Progress
              type="circle"
              percent={slaCompliance}
              strokeColor={slaCompliance >= 90 ? '#16a34a' : slaCompliance >= 70 ? '#f59e0b' : '#dc2626'}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              {slaCompliance >= 90 ? '优秀:危急值通知及时' : slaCompliance >= 70 ? '合格:有进一步优化空间' : '告警:存在超时风险'}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="流程阶段分布">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['DISCOVERED', 'NOTIFIED', 'ACKNOWLEDGED', 'TREATED', 'TRACKED'] as const).map((stg) => {
                const count = MOCK_EVENTS.filter((e) => e.stage === stg).length
                const pct = total ? Math.round((count / total) * 100) : 0
                return (
                  <div key={stg}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span>{STAGE_META[stg].label}</span>
                      <span style={{ color: '#64748b' }}>{count} 例 ({pct}%)</span>
                    </div>
                    <Progress percent={pct} size="small" showInfo={false} strokeColor="#3b82f6" />
                  </div>
                )
              })}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="严重程度分布">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['LIFE_THREATENING', 'URGENT', 'IMPORTANT'] as const).map((sev) => {
                const count = MOCK_EVENTS.filter((e) => e.severity === sev).length
                const pct = total ? Math.round((count / total) * 100) : 0
                return (
                  <div key={sev}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span>
                        <Tag color={SEVERITY_META[sev].color} style={{ marginRight: 4 }}>
                          {SEVERITY_META[sev].label}
                        </Tag>
                      </span>
                      <span style={{ color: '#64748b' }}>{count} 例</span>
                    </div>
                    <Progress
                      percent={pct}
                      size="small"
                      showInfo={false}
                      strokeColor={sev === 'LIFE_THREATENING' ? '#dc2626' : sev === 'URGENT' ? '#f59e0b' : '#3b82f6'}
                    />
                  </div>
                )
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" title={`危急值全流程列表 (自动刷新 tick=${tick})`}>
        <Table<CriticalEvent>
          rowKey="id"
          size="small"
          dataSource={MOCK_EVENTS}
          columns={columns}
          pagination={false}
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="暂无危急值" /> }}
        />
      </Card>
    </div>
  )
}

export default Critical
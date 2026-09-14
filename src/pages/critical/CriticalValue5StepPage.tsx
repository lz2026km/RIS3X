/**
 * @deprecated [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: 本页面已内嵌为 `/critical-value` 的 "5步闭环" Tab。
 * 旧路由 `/critical-value-5step` 保留 redirect → `/critical-value?tab=5step`。请勿新增直接引用。
 */
/**
 * G005 RIS v3.0.6 - 危急值5步工作流页面
 * 5节点闭环: 发现 → 电话通知 → 临床确认 → 临床回执 → 闭环完成
 * [G005-P0] 各步骤动作接真 API,闭环统一走 PATCH /criticals/:id state=CLOSED_LOOP
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Card, Steps, Button, Tag, Row, Col, Statistic, Alert, Descriptions, Modal, Input, message, Table, Spin, Empty } from 'antd'
import { ShieldAlert, Phone, CheckCircle, FileCheck, Archive, AlertTriangle, RefreshCw, Inbox } from 'lucide-react'
import { criticalApi } from '../../services/api/criticalApi'

const { TextArea } = Input

interface CriticalValue5Step {
  id: string
  patientName: string
  finding: string
  severity: string
  currentStep: number
  steps: {
    discovered: { done: boolean; time?: string; user?: string }
    voiceCall: { done: boolean; time?: string; user?: string; phone?: string }
    acknowledged: { done: boolean; time?: string; user?: string }
    receipted: { done: boolean; time?: string; user?: string; comment?: string }
    closed: { done: boolean; time?: string; user?: string }
  }
}

const STEP_CONFIG = [
  { title: '发现', icon: AlertTriangle, color: '#dc2626', description: '危急值被检测或上报' },
  { title: '电话通知', icon: Phone, color: '#ea580c', description: '电话通知临床医生' },
  { title: '临床确认', icon: CheckCircle, color: '#ca8a04', description: '临床医生确认接收' },
  { title: '临床回执', icon: FileCheck, color: '#16a34a', description: '临床医生签字回传' },
  { title: '闭环完成', icon: Archive, color: '#2563eb', description: '危急值处理完成' },
]

export default function CriticalValue5StepPage() {
  const [data, setData] = useState<CriticalValue5Step[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CriticalValue5Step | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<string>('')
  const [actionNote, setActionNote] = useState('')
  const [actionPhone, setActionPhone] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    return criticalApi.getValue5StepList()
      .then(res => {
        if (res.success && res.data && Array.isArray(res.data.items)) {
          setData(res.data.items as CriticalValue5Step[])
        }
      })
      .catch((err: Error) => { console.error('[F04]', err); })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    criticalApi.getValue5StepList()
      .then(res => {
        if (!cancelled && res.success && res.data && Array.isArray(res.data.items)) {
          setData(res.data.items as CriticalValue5Step[])
        }
      })
      .catch((err: Error) => { console.error('[F04]', err); })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const stats = {
    total: data.length,
    step1: data.filter(d => d.currentStep === 0).length,
    step2: data.filter(d => d.currentStep === 1).length,
    step3: data.filter(d => d.currentStep === 2).length,
    step4: data.filter(d => d.currentStep === 3).length,
    step5: data.filter(d => d.currentStep === 4).length,
  }

  const handleAction = (item: CriticalValue5Step, type: string) => {
    setSelected(item)
    setActionType(type)
    setActionNote('')
    setActionPhone('')
    setShowActionModal(true)
  }

  // [G005-P0] 各步骤动作接真 API (PATCH /criticals/:id 等),闭环统一走 CLOSED_LOOP
  const confirmAction = async () => {
    if (!selected) return
    setActionLoading(true)
    try {
      let res
      if (actionType === 'voiceCall') {
        res = await criticalApi.voiceCall(selected.id, { calledBy: '当前用户', phoneNumber: actionPhone })
      } else if (actionType === 'acknowledge') {
        res = await criticalApi.acknowledge(selected.id)
      } else if (actionType === 'receipt') {
        res = await criticalApi.clinicalReceipt(selected.id, { confirmedBy: actionNote || '临床医生' })
      } else if (actionType === 'close') {
        // 闭环: PATCH /criticals/:id state=CLOSED_LOOP (criticalApi.closeLoop)
        res = await criticalApi.closeLoop(selected.id, '系统')
      }
      if (res?.success) {
        message.success('操作成功')
        setShowActionModal(false)
        await loadData()
      } else {
        message.error(res?.error?.message ?? '操作失败')
      }
    } catch (err) {
      message.error((err as Error)?.message ?? '操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      title: '危急值ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: '患者',
      dataIndex: 'patientName',
      key: 'patientName',
    },
    {
      title: '危急发现',
      dataIndex: 'finding',
      key: 'finding',
      render: (f: string) => <span style={{ fontWeight: 600, color: '#dc2626' }}>{f}</span>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string) => (
        <Tag color={s === '危及生命' ? 'red' : s === '危急' ? 'orange' : 'gold'}>{s}</Tag>
      ),
    },
    {
      title: '当前步骤',
      key: 'step',
      render: (_: unknown, record: CriticalValue5Step) => (
        <Tag color={STEP_CONFIG[record.currentStep]?.color || '#94a3b8'}>
          {STEP_CONFIG[record.currentStep]?.title || '未知'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: CriticalValue5Step) => {
        if (record.currentStep === 1) {
          return <Button size="small" type="primary" icon={<Phone size={12} />} onClick={() => handleAction(record, 'voiceCall')}>电话通知</Button>
        }
        if (record.currentStep === 2) {
          return <Button size="small" type="primary" icon={<CheckCircle size={12} />} onClick={() => handleAction(record, 'acknowledge')}>确认接收</Button>
        }
        if (record.currentStep === 3) {
          return <Button size="small" type="primary" icon={<FileCheck size={12} />} onClick={() => handleAction(record, 'receipt')}>临床回执</Button>
        }
        if (record.currentStep === 4) {
          return <Button size="small" type="primary" icon={<Archive size={12} />} onClick={() => handleAction(record, 'close')}>闭环完成</Button>
        }
        return <Tag color="green">已完成</Tag>
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldAlert size={22} style={{ color: '#dc2626' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>危急值5步工作流</h1>
        <Tag color="red">5节点闭环</Tag>
      </div>

      {/* 5步流程图 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          {STEP_CONFIG.map((step, idx) => {
            const Icon = step.icon
            return (
              <React.Fragment key={step.title}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `${step.color}15`,
                    border: `2px solid ${step.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} style={{ color: step.color }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: step.color }}>{step.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 80 }}>{step.description}</div>
                </div>
                {idx < STEP_CONFIG.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: 'var(--border-color)', margin: '0 4px', marginBottom: 40 }} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </Card>

      {/* 统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small"><Statistic title="总数" value={stats.total} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="待通知" value={stats.step2} styles={{ content: {  color: '#dc2626'  } }} prefix={<Phone size={14} />} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="待确认" value={stats.step3} styles={{ content: {  color: '#ca8a04'  } }} prefix={<CheckCircle size={14} />} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="待回执" value={stats.step4} styles={{ content: {  color: '#16a34a'  } }} prefix={<FileCheck size={14} />} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="待闭环" value={stats.step5} styles={{ content: {  color: '#2563eb'  } }} prefix={<Archive size={14} />} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="已完成" value={stats.step5} styles={{ content: {  color: '#059669'  } }} prefix={<CheckCircle size={14} />} /></Card>
        </Col>
      </Row>

      {/* 列表 */}
      <Card title="危急值工作流列表" extra={<Button icon={<RefreshCw size={14} />} onClick={loadData} loading={loading}>刷新</Button>}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : data.length === 0 ? (
          <Empty description="暂无危急值数据" image={<Inbox size={48} color="#94a3b8" />} />
        ) : (
          <Table dataSource={data} columns={columns} rowKey="id" size="small" pagination={false} scroll={{ x: 'max-content' }}/>
        )}
      </Card>

      {/* 详情侧边栏 */}
      {selected && (
        <Card title={`详情 - ${selected.id}`} style={{ marginTop: 16 }}>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="患者">{selected.patientName}</Descriptions.Item>
            <Descriptions.Item label="严重程度"><Tag color={selected.severity === '危及生命' ? 'red' : 'orange'}>{selected.severity}</Tag></Descriptions.Item>
            <Descriptions.Item label="危急发现" span={2}>{selected.finding}</Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16 }}>
            <h4>5步进度</h4>
            <Steps
              current={selected.currentStep}
              orientation="vertical"
              size="small"
              items={STEP_CONFIG.map((step, idx) => {
                const stepData = Object.values(selected.steps)[idx]
                return {
                  title: <span style={{ fontWeight: 600 }}>{step.title}</span>,
                  description: stepData?.done ? (
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {stepData.time && <div>时间: {stepData.time}</div>}
                      {stepData.user && <div>操作人: {stepData.user}</div>}
                      {'phone' in stepData && stepData.phone && <div>电话: {stepData.phone}</div>}
                      {'comment' in stepData && stepData.comment && <div>备注: {stepData.comment}</div>}
                    </div>
                  ) : (
                    <span style={{ color: '#999', fontSize: 12 }}>待处理</span>
                  ),
                  status: stepData?.done ? 'finish' : idx === selected.currentStep ? 'process' : 'wait',
                  icon: stepData?.done ? <CheckCircle size={14} /> : undefined,
                }
              })}
            />
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            {selected.currentStep === 1 && (
              <Button type="primary" icon={<Phone size={14} />} onClick={() => handleAction(selected, 'voiceCall')}>电话通知</Button>
            )}
            {selected.currentStep === 2 && (
              <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => handleAction(selected, 'acknowledge')}>确认接收</Button>
            )}
            {selected.currentStep === 3 && (
              <Button type="primary" icon={<FileCheck size={14} />} onClick={() => handleAction(selected, 'receipt')}>临床回执</Button>
            )}
            {selected.currentStep === 4 && (
              <Button type="primary" icon={<Archive size={14} />} onClick={() => handleAction(selected, 'close')}>闭环完成</Button>
            )}
            <Button onClick={() => setSelected(null)}>关闭</Button>
          </div>
        </Card>
      )}

      {/* 操作模态框 */}
      <Modal
        title={actionType === 'voiceCall' ? '电话通知' : actionType === 'acknowledge' ? '临床确认' : actionType === 'receipt' ? '临床回执' : '闭环完成'}
        open={showActionModal}
        onOk={() => void confirmAction()}
        onCancel={() => setShowActionModal(false)}
        confirmLoading={actionLoading}
      >
        {actionType === 'voiceCall' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>联系电话</div>
              <Input value={actionPhone} onChange={e => setActionPhone(e.target.value)} placeholder="请输入联系电话" />
            </div>
            <Alert title="电话通知后将自动记录通知时间及操作人" type="info" showIcon />
          </div>
        )}
        {actionType === 'acknowledge' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>确认医生</div>
              <Input value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="请输入确认医生姓名" />
            </div>
          </div>
        )}
        {actionType === 'receipt' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>临床意见/备注</div>
              <TextArea rows={3} value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="请输入临床处理意见" />
            </div>
          </div>
        )}
        {actionType === 'close' && (
          <Alert title="确认闭环后，该危急值将标记为已完成 (CLOSED_LOOP)" type="warning" showIcon />
        )}
      </Modal>
    </div>
  )
}

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
import { Card, Steps, Button, Tag, Alert, Descriptions, Modal, Input, message, Table, Spin, Empty } from 'antd'
import { StatCard, StatCardGrid, PageContainer } from '../../components/common'
import { ShieldAlert, Phone, CheckCircle, FileCheck, Archive, AlertTriangle, RefreshCw, Inbox } from 'lucide-react'
import { criticalApi } from '../../services/api/criticalApi'
import { t } from '../../i18n/appI18n'

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
  { titleKey: 'cv5.stepDiscovered', icon: AlertTriangle, color: '#dc2626', descKey: 'cv5.stepDiscoveredDesc' },
  { titleKey: 'cv5.stepNotified', icon: Phone, color: '#ea580c', descKey: 'cv5.stepNotifiedDesc' },
  { titleKey: 'cv5.stepConfirmed', icon: CheckCircle, color: '#ca8a04', descKey: 'cv5.stepConfirmedDesc' },
  { titleKey: 'cv5.stepReceipt', icon: FileCheck, color: '#16a34a', descKey: 'cv5.stepReceiptDesc' },
  { titleKey: 'cv5.stepClosed', icon: Archive, color: '#2563eb', descKey: 'cv5.stepClosedDesc' },
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
        message.success(t('cv5.actionSuccess'))
        setShowActionModal(false)
        await loadData()
      } else {
        message.error(res?.error?.message ?? t('cv5.actionFailed'))
      }
    } catch (err) {
      message.error((err as Error)?.message ?? t('cv5.actionFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      title: t('cv5.colId'),
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: t('cv5.colPatient'),
      dataIndex: 'patientName',
      key: 'patientName',
    },
    {
      title: t('cv5.colFinding'),
      dataIndex: 'finding',
      key: 'finding',
      render: (f: string) => <span style={{ fontWeight: 600, color: '#dc2626' }}>{f}</span>,
    },
    {
      title: t('cv5.colSeverity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string) => (
        <Tag color={s === '危及生命' ? 'red' : s === '危急' ? 'orange' : 'gold'}>{s}</Tag>
      ),
    },
    {
      title: t('cv5.colStep'),
      key: 'step',
      render: (_: unknown, record: CriticalValue5Step) => (
        <Tag color={STEP_CONFIG[record.currentStep]?.color || '#94a3b8'}>
          {t(STEP_CONFIG[record.currentStep]?.titleKey ?? 'cv5.unknown')}
        </Tag>
      ),
    },
    {
      title: t('cv5.colActions'),
      key: 'actions',
      render: (_: unknown, record: CriticalValue5Step) => {
        if (record.currentStep === 1) {
          return <Button size="small" type="primary" icon={<Phone size={12} />} onClick={() => handleAction(record, 'voiceCall')}>{t('cv5.notify')}</Button>
        }
        if (record.currentStep === 2) {
          return <Button size="small" type="primary" icon={<CheckCircle size={12} />} onClick={() => handleAction(record, 'acknowledge')}>{t('cv5.acknowledge')}</Button>
        }
        if (record.currentStep === 3) {
          return <Button size="small" type="primary" icon={<FileCheck size={12} />} onClick={() => handleAction(record, 'receipt')}>{t('cv5.receipt')}</Button>
        }
        if (record.currentStep === 4) {
          return <Button size="small" type="primary" icon={<Archive size={12} />} onClick={() => handleAction(record, 'close')}>{t('cv5.close')}</Button>
        }
        return <Tag color="green">{t('cv5.done')}</Tag>
      },
    },
  ]

  return (
    <PageContainer padding={24}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldAlert size={22} style={{ color: '#dc2626' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('cv5.title')}</h1>
        <Tag color="red">{t('cv5.loopTag')}</Tag>
      </div>

      {/* 5步流程图 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          {STEP_CONFIG.map((step, idx) => {
            const Icon = step.icon
            return (
              <React.Fragment key={step.titleKey}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `${step.color}15`,
                    border: `2px solid ${step.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} style={{ color: step.color }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: step.color }}>{t(step.titleKey)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 80 }}>{t(step.descKey)}</div>
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
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('cv5.statTotal')} value={stats.total} />
        <StatCard title={t('cv5.statToNotify')} value={stats.step2} color="error" icon={<Phone size={14} />} />
        <StatCard title={t('cv5.statToConfirm')} value={stats.step3} color="warning" icon={<CheckCircle size={14} />} />
        <StatCard title={t('cv5.statToReceipt')} value={stats.step4} color="success" icon={<FileCheck size={14} />} />
        <StatCard title={t('cv5.statToClose')} value={stats.step5} color="primary" icon={<Archive size={14} />} />
        <StatCard title={t('cv5.statDone')} value={stats.step5} color="success" icon={<CheckCircle size={14} />} />
      </StatCardGrid>

      {/* 列表 */}
      <Card title={t('cv5.listTitle')} extra={<Button icon={<RefreshCw size={14} />} onClick={loadData} loading={loading}>{t('cv5.refresh')}</Button>}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : data.length === 0 ? (
          <Empty description={t('cv5.empty')} image={<Inbox size={48} color="#94a3b8" />} />
        ) : (
          <Table dataSource={data} columns={columns} rowKey="id" size="small" pagination={false} scroll={{ x: 'max-content' }}/>
        )}
      </Card>

      {/* 详情侧边栏 */}
      {selected && (
        <Card title={`${t('cv5.detail')} - ${selected.id}`} style={{ marginTop: 16 }}>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label={t('cv5.colPatient')}>{selected.patientName}</Descriptions.Item>
            <Descriptions.Item label={t('cv5.colSeverity')}><Tag color={selected.severity === '危及生命' ? 'red' : 'orange'}>{selected.severity}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('cv5.colFinding')} span={2}>{selected.finding}</Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16 }}>
            <h4>{t('cv5.progress')}</h4>
            <Steps
              current={selected.currentStep}
              orientation="vertical"
              size="small"
              items={STEP_CONFIG.map((step, idx) => {
                const stepData = Object.values(selected.steps)[idx]
                return {
                  title: <span style={{ fontWeight: 600 }}>{t(step.titleKey)}</span>,
                  description: stepData?.done ? (
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {stepData.time && <div>{t('cv5.time')}: {stepData.time}</div>}
                      {stepData.user && <div>{t('cv5.operator')}: {stepData.user}</div>}
                      {'phone' in stepData && stepData.phone && <div>{t('cv5.phone')}: {stepData.phone}</div>}
                      {'comment' in stepData && stepData.comment && <div>{t('cv5.note')}: {stepData.comment}</div>}
                    </div>
                  ) : (
                    <span style={{ color: '#999', fontSize: 12 }}>{t('cv5.pending')}</span>
                  ),
                  status: stepData?.done ? 'finish' : idx === selected.currentStep ? 'process' : 'wait',
                  icon: stepData?.done ? <CheckCircle size={14} /> : undefined,
                }
              })}
            />
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            {selected.currentStep === 1 && (
              <Button type="primary" icon={<Phone size={14} />} onClick={() => handleAction(selected, 'voiceCall')}>{t('cv5.notify')}</Button>
            )}
            {selected.currentStep === 2 && (
              <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => handleAction(selected, 'acknowledge')}>{t('cv5.acknowledge')}</Button>
            )}
            {selected.currentStep === 3 && (
              <Button type="primary" icon={<FileCheck size={14} />} onClick={() => handleAction(selected, 'receipt')}>{t('cv5.receipt')}</Button>
            )}
            {selected.currentStep === 4 && (
              <Button type="primary" icon={<Archive size={14} />} onClick={() => handleAction(selected, 'close')}>{t('cv5.close')}</Button>
            )}
            <Button onClick={() => setSelected(null)}>{t('cv5.cancel')}</Button>
          </div>
        </Card>
      )}

      {/* 操作模态框 */}
      <Modal
        title={actionType === 'voiceCall' ? t('cv5.notify') : actionType === 'acknowledge' ? t('cv5.confirmClinical') : actionType === 'receipt' ? t('cv5.receipt') : t('cv5.close')}
        open={showActionModal}
        onOk={() => void confirmAction()}
        onCancel={() => setShowActionModal(false)}
        confirmLoading={actionLoading}
      >
        {actionType === 'voiceCall' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('cv5.contactPhone')}</div>
              <Input value={actionPhone} onChange={e => setActionPhone(e.target.value)} placeholder={t('cv5.contactPhonePlaceholder')} />
            </div>
            <Alert title={t('cv5.notifyAlert')} type="info" showIcon />
          </div>
        )}
        {actionType === 'acknowledge' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('cv5.confirmDoctor')}</div>
              <Input value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder={t('cv5.confirmDoctorPlaceholder')} />
            </div>
          </div>
        )}
        {actionType === 'receipt' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('cv5.clinicalNote')}</div>
              <TextArea rows={3} value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder={t('cv5.clinicalNotePlaceholder')} />
            </div>
          </div>
        )}
        {actionType === 'close' && (
          <Alert title={t('cv5.closeAlert')} type="warning" showIcon />
        )}
      </Modal>
    </PageContainer>
  )
}

// [v3.0.6.11-60] Batch 3: 危急值页面 (独立实现, 嵌入 critical 组件, criticalApi 数据 + 5 步流程入口)
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Modal, Input, message, Space, Tag, Statistic, Row, Col, Steps, Descriptions, Alert, Empty } from 'antd'
import { ShieldAlert, Phone, CheckCircle, FileCheck, Archive, Search, RefreshCw, AlertTriangle, FileText, Bell, Send } from 'lucide-react'
import { criticalApi, type CriticalStatsDto } from '../services/api/criticalApi'
import { CriticalValueList, ClosedLoopTracker5Nodes, TransferToFollowUpModal } from './critical'
import type { CriticalValue } from './critical'
import { LoadingBanner, ErrorBanner } from '../components/feedback'

const { TextArea } = Input

const STEP_CONFIG = [
  { title: '发现', icon: AlertTriangle, color: '#dc2626' },
  { title: '电话通知', icon: Phone, color: '#ea580c' },
  { title: '临床确认', icon: CheckCircle, color: '#ca8a04' },
  { title: '临床回执', icon: FileCheck, color: '#16a34a' },
  { title: '闭环完成', icon: Archive, color: '#2563eb' },
]

const CriticalValuePage: React.FC = () => {
  const navigate = useNavigate()
  const [values, setValues] = useState<CriticalValue[]>([])
  const [stats, setStats] = useState<CriticalStatsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<CriticalValue | null>(null)

  const [voiceCV, setVoiceCV] = useState<CriticalValue | null>(null)
  const [voicePhone, setVoicePhone] = useState('')
  const [receiptCV, setReceiptCV] = useState<CriticalValue | null>(null)
  const [receiptDoctor, setReceiptDoctor] = useState('')
  const [receiptComment, setReceiptComment] = useState('')
  const [notifyCV, setNotifyCV] = useState<CriticalValue | null>(null)
  const [transferCV, setTransferCV] = useState<CriticalValue | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.all([
        criticalApi.list({ take: 100 }),
        criticalApi.getStats(),
      ])
      if (listRes.success && Array.isArray(listRes.data)) {
        setValues(listRes.data as unknown as CriticalValue[])
      } else {
        setError(listRes.error?.message ?? '危急值加载失败')
      }
      if (statsRes.success && statsRes.data) setStats(statsRes.data as CriticalStatsDto)
    } catch (e) {
      setError((e as Error)?.message ?? '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const filtered = values.filter((cv) => {
    if (!search) return true
    const s = search.toLowerCase()
    return cv.patientName.toLowerCase().includes(s) || cv.id.toLowerCase().includes(s) || (cv.accessionNumber ?? '').toLowerCase().includes(s)
  })

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((c) => c.id)))
  }

  const reload = () => { void fetchData() }

  const handleProcess = (cv: CriticalValue) => {
    Modal.confirm({
      title: '标记处理',
      content: `确认将危急值 ${cv.id} (${cv.patientName}) 标记为已处理？`,
      okText: '确认处理',
      onOk: async () => {
        const res = await criticalApi.resolve(cv.id)
        if (res.success) { message.success('已处理'); reload() }
        else message.error(res.error?.message ?? '操作失败')
      },
    })
  }

  const handleAcknowledge = async (cv: CriticalValue) => {
    const res = await criticalApi.acknowledge(cv.id)
    if (res.success) { message.success('已确认接收'); reload() }
    else message.error(res.error?.message ?? '操作失败')
  }

  const handleVoiceCall = (cv: CriticalValue) => { setVoiceCV(cv); setVoicePhone(cv.phone ?? '') }

  const confirmVoiceCall = async () => {
    if (!voiceCV) return
    const res = await criticalApi.voiceCall(voiceCV.id, { calledBy: '当前用户', phoneNumber: voicePhone })
    if (res.success) { message.success('电话通知已记录'); reload() }
    else message.error(res.error?.message ?? '操作失败')
    setVoiceCV(null)
  }

  const handleClinicalReceipt = (cv: CriticalValue) => { setReceiptCV(cv); setReceiptDoctor(''); setReceiptComment('') }

  const confirmReceipt = async () => {
    if (!receiptCV || !receiptDoctor) { message.warning('请填写确认医生'); return }
    const res = await criticalApi.clinicalReceipt(receiptCV.id, { confirmedBy: receiptDoctor, comment: receiptComment })
    if (res.success) { message.success('临床回执已记录'); reload() }
    else message.error(res.error?.message ?? '操作失败')
    setReceiptCV(null)
  }

  const handleContactClinical = (cv: CriticalValue) => { setNotifyCV(cv) }

  const confirmNotify = async () => {
    if (!notifyCV) return
    const res = await criticalApi.notify(notifyCV.id, 'PHONE')
    if (res.success) { message.success('已发送通知'); reload() }
    else message.error(res.error?.message ?? '操作失败')
    setNotifyCV(null)
  }

  const handleTransfer = (cv: CriticalValue) => { setTransferCV(cv) }

  const confirmTransfer = (followUpDate: string) => {
    if (!transferCV) return
    setValues((prev) => prev.map((c) => c.id === transferCV.id ? { ...c, transferredToFollowUp: true, followUpId: `FU-${Date.now()}`, followUpDate } : c))
    message.success(`转随访成功：${followUpDate}`)
    setTransferCV(null)
  }

  const statsCards = [
    { title: '总数', value: stats?.total ?? values.length, color: '#1e3a5f', icon: ShieldAlert },
    { title: '待处理', value: stats?.pending ?? 0, color: '#dc2626', icon: Bell },
    { title: '已通知', value: stats?.notified ?? 0, color: '#ea580c', icon: Send },
    { title: '已接收', value: stats?.acknowledged ?? 0, color: '#2563eb', icon: CheckCircle },
    { title: '已处理', value: stats?.resolved ?? 0, color: '#059669', icon: FileCheck },
  ]

  return (
    <div data-testid="critical-value-page" style={{ padding: 24, background: '#f1f5f9', minHeight: '100vh' }}>
      {loading && <LoadingBanner message="正在从 API 加载危急值数据..." />}
      {error && !loading && <ErrorBanner message={error} />}

      <Space style={{ marginBottom: 12 }} wrap>
        <ShieldAlert size={22} color="#dc2626" />
        <span style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>危急值管理</span>
        <Tag color="red">v3.0.6.11-60</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={reload} loading={loading}>刷新</Button>
        <Button type="primary" size="small" onClick={() => navigate('/critical-value-5step')}>5 步流程入口</Button>
      </Space>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        {statsCards.map((s) => (
          <Col span={4} key={s.title} xs={12} md={4}>
            <Card size="small">
              <Statistic title={s.title} value={s.value} prefix={<s.icon size={14} />} styles={{ content: { color: s.color } }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        size="small"
        style={{ marginBottom: 12 }}
        title={<Space><FileText size={14} />5 步闭环工作流</Space>}
        extra={<Button type="primary" icon={<Archive size={12} />} onClick={() => navigate('/critical-value-5step')}>进入 5 步流程</Button>}
      >
        <Steps
          size="small"
          current={0}
          items={STEP_CONFIG.map((s) => ({
            title: s.title,
            icon: <s.icon size={14} color={s.color} />,
            description: undefined,
          }))}
        />
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="发现 → 电话通知 → 临床确认 → 临床回执 → 闭环完成。超时未闭环将自动升级。"
        />
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <Search size={14} />
            危急值列表
            <Tag>共 {filtered.length} 条</Tag>
          </Space>
        }
        extra={
          <Input
            size="small"
            allowClear
            placeholder="搜索患者/ID/检查号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
        }
      >
        {!loading && values.length === 0 && !error ? (
          <Empty description="暂无危急值数据" image={<ShieldAlert size={48} color="#cbd5e1" />} />
        ) : (
          <CriticalValueList
            filtered={filtered}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onProcess={handleProcess}
            onViewDetail={setDetail}
            onContactClinical={handleContactClinical}
            onVoiceCall={handleVoiceCall}
            onClinicalReceipt={handleClinicalReceipt}
            onAcknowledge={handleAcknowledge}
            onTransferToFollowUp={handleTransfer}
            criticalValues={values}
          />
        )}
      </Card>

      {detail && (
        <Card
          size="small"
          style={{ marginTop: 12 }}
          title={`详情 - ${detail.id} · ${detail.patientName}`}
          extra={<Button size="small" onClick={() => setDetail(null)}>关闭</Button>}
        >
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="检查项目">{detail.examItemName}</Descriptions.Item>
            <Descriptions.Item label="设备">{detail.deviceName ?? detail.modality}</Descriptions.Item>
            <Descriptions.Item label="检查结果">{detail.resultValue} {detail.resultUnit}</Descriptions.Item>
            <Descriptions.Item label="危急范围">{detail.criticalRange ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="上报医生">{detail.reportedByName}</Descriptions.Item>
            <Descriptions.Item label="上报时间">{detail.reportedTime}</Descriptions.Item>
            <Descriptions.Item label="危急发现" span={2}>{detail.findingDetails}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 16 }}>
            <ClosedLoopTracker5Nodes cv={detail} />
          </div>
        </Card>
      )}

      <Modal title="电话通知" open={!!voiceCV} onOk={() => void confirmVoiceCall()} onCancel={() => setVoiceCV(null)} okText="确认通知">
        <p style={{ marginBottom: 8 }}>危急值 {voiceCV?.id} · {voiceCV?.patientName}</p>
        <Input value={voicePhone} onChange={(e) => setVoicePhone(e.target.value)} placeholder="请输入联系电话" />
      </Modal>

      <Modal title="临床回执" open={!!receiptCV} onOk={() => void confirmReceipt()} onCancel={() => setReceiptCV(null)} okText="提交回执">
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>确认医生</div>
          <Input value={receiptDoctor} onChange={(e) => setReceiptDoctor(e.target.value)} placeholder="请输入确认医生姓名" />
        </div>
        <TextArea rows={3} value={receiptComment} onChange={(e) => setReceiptComment(e.target.value)} placeholder="临床处理意见" />
      </Modal>

      <Modal title="联系临床" open={!!notifyCV} onOk={() => void confirmNotify()} onCancel={() => setNotifyCV(null)} okText="发送通知">
        <p>将向 {notifyCV?.patientName} 的危急值 {notifyCV?.id} 发送电话通知。</p>
      </Modal>

      {transferCV && (
        <TransferToFollowUpModal cv={transferCV} onClose={() => setTransferCV(null)} onConfirm={confirmTransfer} />
      )}
    </div>
  )
}

export default CriticalValuePage

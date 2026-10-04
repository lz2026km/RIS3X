import React, { useEffect, useState, useCallback } from 'react'
import {
  Table, Button, Tag, Modal, Select, message, Card, Row, Col,
  Space, Descriptions, Progress, Typography, Tooltip, Badge, Input, InputNumber, Alert,
} from 'antd'
import { Siren, UserCheck, Clock, AlertTriangle, RefreshCw, Filter, Activity } from 'lucide-react'
import { triageApi, type TriagePendingItem, type TriageScoreResult, type TriageFactor, type VitalSigns } from '../../services/api/triageApi'
import { StatCard, StatCardGrid, PageContainer } from '../../components/common'
import { usePagination } from '../../hooks/usePagination'
import { t } from '../../i18n/appI18n'

// [G005 W6] ESI 五级标签与颜色
const esiLabel = (level?: number): string => (level ? t(`w6Reg.triage.esi${level}`) : '-')
const esiColor = (esi?: number) => (esi === 1 ? 'red' : esi === 2 ? 'volcano' : esi === 3 ? 'orange' : esi === 4 ? 'blue' : 'green')
const levelToEsi = (lvl: string) => (lvl === 'CRITICAL' ? 2 : lvl === 'URGENT' ? 3 : lvl === 'SEMI_URGENT' ? 4 : 5)

const { Text, Title } = Typography

const levelColor: Record<string, string> = {
  CRITICAL: 'red',
  URGENT: 'orange',
  SEMI_URGENT: 'gold',
  ROUTINE: 'green',
}

const levelLabel: Record<string, string> = {
  CRITICAL: 'triage.levelCritical',
  URGENT: 'triage.levelUrgent',
  SEMI_URGENT: 'triage.levelSemiUrgent',
  ROUTINE: 'triage.levelRoutine',
}

const TriageDashboardPage: React.FC = () => {
  const [items, setItems] = useState<TriagePendingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TriagePendingItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newDoctor, setNewDoctor] = useState('')
  const [newStatus, setNewStatus] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [scoreResult, setScoreResult] = useState<TriageScoreResult | null>(null)
  const [scoring, setScoring] = useState(false)
  // [G005 W6] 复评 (vitals + ESI)
  const [reTriageItem, setReTriageItem] = useState<TriagePendingItem | null>(null)
  const [vitals, setVitals] = useState<VitalSigns>({})
  const [reTriageResult, setReTriageResult] = useState<TriageScoreResult | null>(null)
  const [reTriaging, setReTriaging] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await triageApi.getPending()
      if (res.success) {
        setItems(res.data ?? [])
      } else {
        message.error(res.error?.message || t('triage.loadFailed'))
      }
    } catch {
      message.error(t('triage.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const handleAssign = async (item: TriagePendingItem) => {
    setScoring(true)
    try {
      const res = await triageApi.assign({
        examId: item.examId,
        patientId: item.patientId,
        patientName: item.patientName,
        examType: item.examType,
      })
      if (res.success) {
        message.success(`已分配给 ${res.data.assignedDoctor}`)
        fetchPending()
      } else {
        message.error(res.error?.message || t('triage.assignFailed'))
      }
    } catch {
      message.error(t('triage.assignFailed'))
    } finally {
      setScoring(false)
    }
  }

  const handleScore = async (item: TriagePendingItem) => {
    setScoring(true)
    try {
      const res = await triageApi.score({
        examId: item.examId,
        patientId: item.patientId,
        patientName: item.patientName,
        examType: item.examType,
      })
      if (res.success) {
        setScoreResult(res.data)
        message.info(`评分: ${res.data.score} - ${t(levelLabel[res.data.level] ?? res.data.level)}`)
      } else {
        message.error(res.error?.message || t('triage.scoreFailed'))
      }
    } catch {
      message.error(t('triage.scoreFailed'))
    } finally {
      setScoring(false)
    }
  }

  // [G005 W6] 复评: 生命体征 → 重算 ESI / 队列优先级
  const handleReTriage = async () => {
    if (!reTriageItem) return
    setReTriaging(true)
    try {
      const res = await triageApi.reTriage({
        examId: reTriageItem.examId,
        patientId: reTriageItem.patientId,
        patientName: reTriageItem.patientName,
        examType: reTriageItem.examType,
        vitals,
      })
      if (res.success) {
        setReTriageResult(res.data)
        message.success(t('w6Reg.triage.success'))
        fetchPending()
      } else {
        message.error(res.error?.message || t('w6Reg.loadFailed'))
      }
    } catch {
      message.error(t('w6Reg.loadFailed'))
    } finally {
      setReTriaging(false)
    }
  }

  const handleConfirm = async (item: TriagePendingItem) => {
    try {
      const res = await triageApi.update(item.id, { status: 'COMPLETED' })
      if (res.success) {
        message.success(t('triage.confirmed'))
        fetchPending()
      } else {
        message.error(res.error?.message || t('triage.confirmFailed'))
      }
    } catch {
      message.error(t('triage.confirmFailed'))
    }
  }

  const handleManualUpdate = async () => {
    if (!selectedItem) return
    try {
      const res = await triageApi.update(selectedItem.id, {
        assignedDoctor: newDoctor || undefined,
        status: (newStatus || undefined) as 'ASSIGNED' | 'PENDING' | 'COMPLETED' | undefined,
      })
      if (res.success) {
        message.success(t('triage.updateSuccess'))
        setDetailOpen(false)
        fetchPending()
      } else {
        message.error(res.error?.message || t('triage.updateFailed'))
      }
    } catch {
      message.error(t('triage.updateFailed'))
    }
  }

  const filteredItems = items.filter(item => {
    const matchStatus = !statusFilter || item.status === statusFilter
    const matchSearch = !searchText ||
      item.patientName.includes(searchText) ||
      item.examType.includes(searchText) ||
      (item.assignedDoctor ?? '').includes(searchText)
    return matchStatus && matchSearch
  })
  const { pageData: queuePageData, pagination: queuePagination } = usePagination(filteredItems, 10)

  const scoreColor = (score: number) => {
    if (score >= 16) return 'red'
    if (score >= 11) return 'orange'
    if (score >= 6) return 'gold'
    return 'green'
  }
  const statColor = (c: string) => (c === 'red' ? 'error' : c === 'orange' || c === 'gold' ? 'warning' : 'success')

  const columns = [
    {
      title: t('triage.colPatientName'),
      dataIndex: 'patientName',
      key: 'patientName',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('triage.colExamType'),
      dataIndex: 'examType',
      key: 'examType',
    },
    {
      title: t('triage.colScore'),
      dataIndex: 'score',
      key: 'score',
      sorter: (a: TriagePendingItem, b: TriagePendingItem) => b.score - a.score,
      render: (s: number) => <Tag color={scoreColor(s)}>{s}</Tag>,
    },
    {
      title: t('triage.colLevel'),
      dataIndex: 'level',
      key: 'level',
      render: (lvl: string) => (
        <Tag color={levelColor[lvl] ?? 'default'}>{t(levelLabel[lvl] ?? lvl)}</Tag>
      ),
    },
    {
      // [G005 W6] ESI 五级
      title: t('w6Reg.triage.esi'),
      dataIndex: 'esiLevel',
      key: 'esiLevel',
      render: (_: unknown, r: TriagePendingItem) => {
        const esi = r.esiLevel ?? levelToEsi(r.level)
        return (
          <Space size={4}>
            <Tag color={esiColor(esi)}>{esiLabel(esi)}</Tag>
            {r.reTriageRecommended && <Tag color="red">{t('w6Reg.triage.reTriage')}</Tag>}
          </Space>
        )
      },
    },
    {
      // [G005 W6] 队列优先级
      title: t('w6Reg.triage.queuePriority'),
      dataIndex: 'queuePriority',
      key: 'queuePriority',
      render: (p: string | undefined) => (
        <Tag color={p === '危重' ? 'red' : p === '紧急' ? 'orange' : 'default'}>{p ?? '-'}</Tag>
      ),
    },
    {
      title: t('triage.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Badge
          status={s === 'COMPLETED' ? 'success' : s === 'ASSIGNED' ? 'processing' : 'default'}
          text={s === 'ASSIGNED' ? t('triage.statusAssigned') : s === 'COMPLETED' ? t('triage.statusCompleted') : s === 'PENDING' ? t('triage.statusPending') : s}
        />
      ),
    },
    {
      title: t('triage.colAssignedDoctor'),
      dataIndex: 'assignedDoctor',
      key: 'assignedDoctor',
      render: (d: string | undefined) => d ?? '-',
    },
    {
      title: t('triage.colActions'),
      key: 'actions',
      render: (_: unknown, record: TriagePendingItem) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <>
              <Tooltip title={t('triage.autoAssign')}>
                <Button size="small" type="primary" icon={<UserCheck size={12} />} onClick={() => handleAssign(record)} loading={scoring}>
                  {t('triage.assign')}
                </Button>
              </Tooltip>
              <Tooltip title={t('triage.aiScore')}>
                <Button size="small" icon={<AlertTriangle size={12} />} onClick={() => handleScore(record)} loading={scoring}>
                  {t('triage.score')}
                </Button>
              </Tooltip>
            </>
          )}
          <Tooltip title={t('triage.detailAdjust')}>
            <Button size="small" onClick={() => {
              setSelectedItem(record)
              setNewDoctor(record.assignedDoctor ?? '')
              setNewStatus(record.status)
              setDetailOpen(true)
            }}>
              {t('triage.detail')}
            </Button>
          </Tooltip>
          <Tooltip title={t('w6Reg.triage.autoSuggested')}>
            <Button size="small" icon={<Activity size={12} />} onClick={() => { setReTriageItem(record); setVitals({ ...(record.vitals ?? {}) }); setReTriageResult(null) }} data-testid={`re-triage-${record.id}`}>
              {t('w6Reg.triage.reTriage')}
            </Button>
          </Tooltip>
          {record.status !== 'COMPLETED' && (
            <Tooltip title={t('triage.confirmComplete')}>
              <Button size="small" type="default" onClick={() => handleConfirm(record)}>
                {t('triage.complete')}
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const criticalCount = items.filter(i => i.level === 'CRITICAL').length
  const urgentCount = items.filter(i => i.level === 'URGENT').length
  const pendingCount = items.filter(i => i.status === 'PENDING').length
  const completedCount = items.filter(i => i.status === 'COMPLETED').length

  return (
    <PageContainer padding={24} data-testid="triage-dashboard-page">
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Siren size={24} color="#ef4444" />
          <Title level={4} style={{ margin: 0 }}>{t('triage.title')}</Title>
          <Tag color="red">P0</Tag>
        </Space>
        <Text type="secondary">{t('triage.subtitle')}</Text>
      </Card>

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('triage.statPending')} value={pendingCount} icon={<Clock size={18} />} color="primary" />
        <StatCard title={t('triage.levelCritical')} value={criticalCount} icon={<AlertTriangle size={18} />} color="error" />
        <StatCard title={t('triage.levelUrgent')} value={urgentCount} icon={<Siren size={18} />} color="warning" />
        <StatCard title={t('triage.statusCompleted')} value={completedCount} icon={<UserCheck size={18} />} color="success" />
      </StatCardGrid>

      <Card
        title={
          <Space>
            <Filter size={14} />
            <span>{t('triage.queue')}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>({filteredItems.length} {t('triage.itemsUnit')})</Text>
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder={t('triage.searchPlaceholder')}
              prefix={<Filter size={12} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder={t('triage.statusFilter')}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: 120 }}
              options={[
                { value: 'PENDING', label: t('triage.statusPending') },
                { value: 'ASSIGNED', label: t('triage.statusAssigned') },
                { value: 'COMPLETED', label: t('triage.statusCompleted') },
              ]}
            />
            <Button icon={<RefreshCw size={14} />} onClick={fetchPending} loading={loading}>
              {t('triage.refresh')}
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={queuePageData}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={queuePagination}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      {scoreResult && (
        <Card title={t('triage.scoreResultTitle')} style={{ marginTop: 16 }}>
          <StatCardGrid minWidth={180} gap={16} style={{ marginBottom: 12 }}>
            <StatCard title={t('triage.totalScore')} value={scoreResult.score} color={statColor(scoreColor(scoreResult.score))} />
            <StatCard title={t('triage.grade')} value={t(levelLabel[scoreResult.level] ?? scoreResult.level)} color={statColor(levelColor[scoreResult.level] ?? 'green')} />
          </StatCardGrid>
          <Text strong>{t('triage.scoreFactors')}</Text>
          {scoreResult.factors.map((f: TriageFactor) => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Text style={{ width: 100, fontSize: 13 }}>{f.name}</Text>
              <Progress percent={Math.min((f.contribution / 10) * 100, 100)} size="small" style={{ flex: 1, margin: 0 }} />
              <Tag color={scoreColor(f.contribution)}>{f.contribution}</Tag>
            </div>
          ))}
        </Card>
      )}

      <Modal
        title={t('triage.detailTitle')}
        open={detailOpen}
        onOk={handleManualUpdate}
        onCancel={() => setDetailOpen(false)}
        width={500}
      >
        {selectedItem && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('triage.colPatientName')}>{selectedItem.patientName}</Descriptions.Item>
              <Descriptions.Item label={t('triage.colExamType')}>{selectedItem.examType}</Descriptions.Item>
              <Descriptions.Item label={t('triage.colScore')}>
                <Tag color={scoreColor(selectedItem.score)}>{selectedItem.score}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('triage.grade')}>
                <Tag color={levelColor[selectedItem.level]}>{t(levelLabel[selectedItem.level] ?? selectedItem.level)}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>{t('triage.colAssignedDoctor')}</div>
              <Select
                style={{ width: '100%' }}
                value={newDoctor}
                onChange={setNewDoctor}
                allowClear
                placeholder={t('triage.selectDoctor')}
                options={[
                  { value: '张主任', label: '张主任' },
                  { value: '李主任', label: '李主任' },
                  { value: '王主任', label: '王主任' },
                  { value: '陈医生', label: '陈医生' },
                  { value: '赵医生', label: '赵医生' },
                  { value: '周医生', label: '周医生' },
                  { value: '吴医生', label: '吴医生' },
                ]}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>{t('triage.colStatus')}</div>
              <Select
                style={{ width: '100%' }}
                value={newStatus}
                onChange={setNewStatus}
                options={[
                  { value: 'PENDING', label: t('triage.statusPending') },
                  { value: 'ASSIGNED', label: t('triage.statusAssigned') },
                  { value: 'COMPLETED', label: t('triage.statusCompleted') },
                ]}
              />
            </div>
          </>
        )}
      </Modal>

      {/* [G005 W6] 复评: 生命体征录入 + ESI 自动建议 */}
      <Modal
        title={`${t('w6Reg.triage.reTriage')} · ${reTriageItem?.patientName ?? ''}`}
        open={!!reTriageItem}
        confirmLoading={reTriaging}
        okText={t('w6Reg.triage.reTriage')}
        cancelText={t('w6Reg.cancel')}
        onOk={handleReTriage}
        onCancel={() => setReTriageItem(null)}
        width={560}
      >
        <Row gutter={[8, 8]}>
          {([
            ['systolicBp', t('w6Reg.safety.bp')],
            ['diastolicBp', t('w6Reg.safety.bp') + ' (舒张)'],
            ['heartRate', t('w6Reg.safety.hr')],
            ['temperature', t('w6Reg.safety.temp')],
            ['spo2', t('w6Reg.safety.spo2')],
            ['respiratoryRate', t('w6Reg.safety.rr')],
          ] as Array<[keyof VitalSigns, string]>).map(([key, label]) => (
            <Col span={8} key={key}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
              <InputNumber
                style={{ width: '100%' }}
                value={vitals[key]}
                onChange={(v) => setVitals((prev) => ({ ...prev, [key]: v ?? undefined }))}
              />
            </Col>
          ))}
        </Row>
        {reTriageResult && (
          <div style={{ marginTop: 12 }}>
            <Space>
              <span>{t('w6Reg.triage.esi')}:</span>
              <Tag color={esiColor(reTriageResult.esiLevel)}>{esiLabel(reTriageResult.esiLevel)}</Tag>
              <span>{t('w6Reg.triage.queuePriority')}:</span>
              <Tag color="volcano">{reTriageResult.queuePriority ?? '-'}</Tag>
            </Space>
            {reTriageResult.vitalsBreaches && reTriageResult.vitalsBreaches.length > 0 && (
              <Alert style={{ marginTop: 8 }} type="warning" showIcon message={t('w6Reg.triage.breach')} description={reTriageResult.vitalsBreaches.join('；')} />
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}

export default TriageDashboardPage

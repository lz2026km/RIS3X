/**
 * G005 RIS v3.0.6.11-99 Wave 3A - PDCA 质控闭环看板 (/qc/pdca)
 * Plan/Do/Check/Act 阶段流转 + 周期 CRUD + 阶段条目 + 缺陷关联
 * 数据源: qcPdcaApi (后端 /qc-pdca 或 MSW 演示回退, 响应带 source 徽标)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  RefreshCw,
  Plus,
  Eye,
  ArrowRight,
  Pencil,
  Trash2,
  CheckCircle2,
  Target,
  CalendarClock,
  User,
  GitBranch,
  Bug,
  Database,
  HardDrive,
  History,
} from 'lucide-react'
import {
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Drawer,
  Popconfirm,
  message,
  Timeline,
  Empty,
} from "antd";
import type { ColumnsType } from 'antd/es/table'
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { ErrorBanner } from "../../components/feedback"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"
import {
  qcPdcaApi,
  type PdcaCycle,
  type PdcaCycleDetail,
  type PdcaPhaseEntry,
  type PdcaDefectRef,
  type PdcaCategory,
  type PdcaStats,
} from '../../services/api/qcPdcaApi'
import { t } from '../../i18n/appI18n'
import { toneToAntd } from '../../theme/statusTokens'

const PHASE_META: Record<string, { label: string; color: string; next: string }> = {
  plan: { label: t('qcPdca.phase.plan'), color: 'blue', next: t('qcPdca.phase.do') },
  do: { label: t('qcPdca.phase.do'), color: 'gold', next: t('qcPdca.phase.check') },
  check: { label: t('qcPdca.phase.check'), color: 'purple', next: t('qcPdca.phase.act') },
  act: { label: t('qcPdca.phase.act'), color: 'cyan', next: t('qcPdca.phase.completed') },
  completed: { label: t('qcPdca.phase.completed'), color: 'green', next: '' },
}

const CATEGORY_COLORS: Record<string, string> = {
  报告质控: 'magenta',
  图像质控: 'geekblue',
  流程质控: 'orange',
  服务质控: 'cyan',
}

const CATEGORY_LABELS: Record<string, string> = {
  报告质控: t('qcPdca.category.report'),
  图像质控: t('qcPdca.category.image'),
  流程质控: t('qcPdca.category.process'),
  服务质控: t('qcPdca.category.service'),
}

const CATEGORY_OPTIONS = ['报告质控', '图像质控', '流程质控', '服务质控']
const OWNER_OPTIONS = [
  { value: 'u-001', label: '张主任' },
  { value: 'u-002', label: '李医生' },
  { value: 'u-003', label: '王技师' },
]

const STATUS_COLORS: Record<string, string> = {
  open: toneToAntd('open'),
  in_progress: toneToAntd('in_progress'),
  resolved: toneToAntd('resolved'),
}

const STATUS_LABELS: Record<string, string> = {
  open: t('qcPdca.status.open'),
  in_progress: t('qcPdca.status.inProgress'),
  resolved: t('qcPdca.status.resolved'),
}

const fmtDate = (s?: string) => (s ? s.slice(0, 10) : '-')

export default function QcPdcaPage() {
  const [params] = useSearchParams()
  const pendingDefectId = params.get('defectId')

  const [cycles, setCycles] = useState<PdcaCycle[]>([])
  const [stats, setStats] = useState<PdcaStats | null>(null)
  const [source, setSource] = useState<'database' | 'demo' | 'offline'>('demo')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 新建/编辑
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PdcaCycle | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // 详情抽屉
  const [detail, setDetail] = useState<PdcaCycleDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [phases, setPhases] = useState<PdcaPhaseEntry[]>([])
  const [defects, setDefects] = useState<PdcaDefectRef[]>([])
  const [allDefects, setAllDefects] = useState<PdcaDefectRef[]>([])
  const [linkedDefectId, setLinkedDefectId] = useState<string>()

  // 阶段条目编辑
  const [phaseEditing, setPhaseEditing] = useState<PdcaPhaseEntry | null>(null)
  const [phaseModalOpen, setPhaseModalOpen] = useState(false)
  const [phaseForm] = Form.useForm()

  // 完成周期
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completing, setCompleting] = useState<PdcaCycle | null>(null)
  const [completeForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [cyclesRes, statsRes] = await Promise.all([
      qcPdcaApi.listCycles().catch(() => ({ success: false as const, data: null as unknown as { source: 'database' | 'demo'; generatedAt: string; data: PdcaCycle[] } })),
      qcPdcaApi.getStats().catch(() => ({ success: false as const, data: null as unknown as { source: 'database' | 'demo'; generatedAt: string; data: PdcaStats } })),
    ])
    if (cyclesRes.success && cyclesRes.data?.data) {
      setCycles(cyclesRes.data.data)
      setSource(cyclesRes.data.source)
    } else {
      setCycles([])
      setSource('offline')
      setLoadError(t('w9.states.error'))
      message.warning(t('qcPdca.cyclesLoadFailed'))
      const demo = demoFallbackCycles()
      setCycles(demo)
      setStats(demoStats(demo))
      setLoading(false)
      return
    }
    if (statsRes.success && statsRes.data?.data) setStats(statsRes.data.data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setCreateOpen(true)
  }

  const openEdit = (c: PdcaCycle) => {
    setEditing(c)
    form.setFieldsValue({
      title: c.title,
      category: c.category,
      description: c.description,
      target: c.target,
      ownerId: c.ownerId,
      dueDate: c.dueDate.slice(0, 10),
    })
    setCreateOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        const res = await qcPdcaApi.updateCycle(editing.id, {
          title: values.title,
          category: values.category,
          description: values.description ?? '',
          target: values.target ?? '',
          ownerId: values.ownerId,
          dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        })
        if (!res.success) throw new Error(res.error?.message ?? t('qcPdca.editFailed'))
        message.success(t('qcPdca.cycleUpdated'))
      } else {
        const res = await qcPdcaApi.createCycle({
          title: values.title,
          category: values.category,
          description: values.description ?? '',
          target: values.target ?? '',
          ownerId: values.ownerId,
        })
        if (!res.success) throw new Error(res.error?.message ?? t('qcPdca.createFailed'))
        message.success(t('qcPdca.cycleCreated'))
        if (pendingDefectId) {
          const linkRes = await qcPdcaApi.linkDefect(res.data.id, { defectId: pendingDefectId }).catch(() => ({ success: false as const }))
          if (linkRes.success) message.success(t('qcPdca.autoLinkedDefect', { id: pendingDefectId }))
        }
      }
      setCreateOpen(false)
      void load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('qcPdca.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleAdvance = async (c: PdcaCycle) => {
    const res = await qcPdcaApi.advanceCycle(c.id)
    if (!res.success) {
      message.error(res.error?.message ?? t('qcPdca.advanceFailed'))
      return
    }
    message.success(t('qcPdca.advancedTo', { phase: PHASE_META[res.data.phase]?.label ?? res.data.phase }))
    void load()
  }

  const handleDelete = async (id: string) => {
    const res = await qcPdcaApi.deleteCycle(id)
    if (!res.success) {
      message.error(res.error?.message ?? t('qcPdca.deleteFailed'))
      return
    }
    message.success(t('qcPdca.cycleDeleted'))
    setDetailOpen(false)
    void load()
  }

  const openDetail = async (c: PdcaCycle) => {
    setDetailOpen(true)
    setDetail({ ...c, phases: [] })
    setDetailLoading(true)
    const [detailRes, phaseRes, defectRes, allRes] = await Promise.all([
      qcPdcaApi.getCycle(c.id).catch(() => ({ success: false as const })),
      qcPdcaApi.listPhases(c.id).catch(() => ({ success: false as const })),
      qcPdcaApi.listCycleDefects(c.id).catch(() => ({ success: false as const })),
      qcPdcaApi.listAllDefects().catch(() => ({ success: false as const })),
    ])
    if (detailRes.success && 'phases' in (detailRes.data ?? {})) setDetail(detailRes.data as PdcaCycleDetail)
    setPhases(phaseRes.success ? (phaseRes.data?.data ?? []) : [])
    setDefects(defectRes.success ? (defectRes.data?.data ?? []) : [])
    setAllDefects(allRes.success ? (allRes.data?.data ?? []) : [])
    setDetailLoading(false)
  }

  const handleAddPhase = async (values: { phase: PdcaPhaseEntry['phase']; content: string }) => {
    if (!detail) return
    const res = await qcPdcaApi.addPhase(detail.id, values)
    if (!res.success) {
      message.error(res.error?.message ?? t('qcPdca.addFailed'))
      return
    }
    message.success(t('qcPdca.phaseAdded'))
    setPhases((prev) => [...prev, res.data])
    setPhaseModalOpen(false)
  }

  const handleUpdatePhase = async (values: { phase?: PdcaPhaseEntry['phase']; content?: string }) => {
    if (!phaseEditing) return
    const res = await qcPdcaApi.updatePhase(phaseEditing.id, values)
    if (!res.success) {
      message.error(res.error?.message ?? t('qcPdca.updateFailed'))
      return
    }
    message.success(t('qcPdca.phaseUpdated'))
    setPhases((prev) => prev.map((p) => (p.id === phaseEditing.id ? res.data : p)))
    setPhaseEditing(null)
    setPhaseModalOpen(false)
  }

  const handleLinkDefect = async () => {
    if (!detail || !linkedDefectId) return
    const res = await qcPdcaApi.linkDefect(detail.id, { defectId: linkedDefectId })
    if (!res.success) {
      message.error(res.error?.message ?? t('qcPdca.linkFailed'))
      return
    }
    message.success(t('qcPdca.defectLinked'))
    const ref = allDefects.find((d) => d.id === linkedDefectId)
    if (ref && !defects.some((d) => d.id === ref.id)) setDefects((prev) => [...prev, ref])
    setLinkedDefectId(undefined)
  }

  const openComplete = (c: PdcaCycle) => {
    setCompleting(c)
    completeForm.resetFields()
    setCompleteOpen(true)
  }

  const handleComplete = async () => {
    if (!completing) return
    const values = await completeForm.validateFields()
    const res = await qcPdcaApi.completeCycle(completing.id, { summary: values.summary ?? '' })
    if (!res.success) {
      message.error(res.error?.message ?? t('qcPdca.completeFailed'))
      return
    }
    message.success(t('qcPdca.cycleCompleted'))
    setCompleteOpen(false)
    void load()
  }

  const columns: ColumnsType<PdcaCycle> = [
    {
      title: t('qcPdca.cycle'),
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600 }}>{v}</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{r.id}</span>
        </Space>
      ),
    },
    {
      title: t('qcPdca.phase'),
      dataIndex: 'phase',
      key: 'phase',
      width: 110,
      render: (v: PdcaCycle['phase']) => {
        const meta = PHASE_META[v]
        return <Tag color={meta?.color ?? 'default'}>{meta?.label ?? v}</Tag>
      },
    },
    {
      title: t('qcPdca.category'),
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (v: PdcaCategory) => <Tag color={CATEGORY_COLORS[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: t('qcPdca.target'),
      dataIndex: 'target',
      key: 'target',
      ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#cbd5e1' }}>-</span>,
    },
    {
      title: t('qcPdca.owner'),
      dataIndex: 'ownerName',
      key: 'ownerName',
      width: 100,
      render: (v: string) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <User size={12} color="#64748b" /> {v}
        </span>
      ),
    },
    {
      title: t('qcPdca.dueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (v: string, r) => (
        <Space direction="vertical" size={2}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CalendarClock size={12} color="#64748b" /> {fmtDate(v)}
          </span>
          {r.completedAt && <span style={{ color: '#10b981', fontSize: 12 }}>{t('qcPdca.closedAt')} {fmtDate(r.completedAt)}</span>}
        </Space>
      ),
    },
    {
      title: t('qcPdca.linkedDefects'),
      dataIndex: 'defectIds',
      key: 'defectIds',
      width: 100,
      render: (v: string[]) => <Tag icon={<Bug size={11} />}>{v.length} {t('qcPdca.itemsUnit')}</Tag>,
    },
    {
      title: t('qcPdca.actions'),
      key: 'actions',
      width: 260,
      render: (_, r) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Eye size={12} />} onClick={() => void openDetail(r)}>{t('qcPdca.detail')}</Button>
          {r.phase !== 'completed' ? (
            <Popconfirm
              title={t('qcPdca.advancePhase')}
              description={t('qcPdca.confirmAdvanceTo', { phase: PHASE_META[r.phase]?.next ?? '' })}
              onConfirm={() => void handleAdvance(r)}
              okText={t('qcPdca.advance')}
              cancelText={t('qcPdca.cancel')}
            >
              <Button size="small" icon={<ArrowRight size={12} />}>{t('qcPdca.advance')}</Button>
            </Popconfirm>
          ) : (
            <Button size="small" icon={<CheckCircle2 size={12} />} disabled>{t('qcPdca.completed')}</Button>
          )}
          <Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(r)}>{t('qcPdca.edit')}</Button>
          {r.phase !== 'completed' && (
            <Button size="small" type="primary" ghost icon={<CheckCircle2 size={12} />} onClick={() => openComplete(r)}>{t('qcPdca.complete')}</Button>
          )}
          <Popconfirm title={t('qcPdca.deleteCycle')} description={t('qcPdca.deleteConfirm')} onConfirm={() => void handleDelete(r.id)} okText={t('qcPdca.delete')} cancelText={t('qcPdca.cancel')} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const statCards = useMemo(() => {
    const byPhase = stats?.byPhase ?? {}
    return [
      { label: t('qcPdca.statTotalCycles'), value: stats?.total ?? cycles.length, icon: <GitBranch size={20} />, color: 'var(--color-primary-500)', sub: `进行中 ${stats?.inProgress ?? 0} 个` },
      { label: t('qcPdca.statPlan'), value: byPhase.plan ?? 0, icon: <Target size={20} />, color: '#8b5cf6', sub: 'Plan' },
      { label: t('qcPdca.statDo'), value: byPhase.do ?? 0, icon: <History size={20} />, color: 'var(--color-warning-500)', sub: 'Do' },
      { label: t('qcPdca.statCheck'), value: byPhase.check ?? 0, icon: <Eye size={20} />, color: 'var(--color-info-500)', sub: 'Check' },
      { label: t('qcPdca.statAct'), value: byPhase.act ?? 0, icon: <RefreshCw size={20} />, color: '#ec4899', sub: 'Act' },
      { label: t('qcPdca.statCompleted'), value: byPhase.completed ?? 0, icon: <CheckCircle2 size={20} />, color: '#10b981', sub: `完成率 ${stats?.completionRate ?? 0}%` },
    ]
  }, [stats, cycles.length])

  const sourceBadge = source === 'database'
    ? <Tag icon={<Database size={12} />} color="green">{t('qcPdca.sourceDatabase')}</Tag>
    : source === 'demo'
      ? <Tag icon={<HardDrive size={12} />} color="orange">{t('qcPdca.sourceDemo')}</Tag>
      : <Tag color="red">{t('qcPdca.sourceOffline')}</Tag>

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<GitBranch size={20} color="var(--color-primary-500)" />}
        title={t('qcPdca.title')}
        subtitle={t('qcPdca.subtitle')}
        actions={
          <Space>
            {sourceBadge}
            <Button size="small" icon={<RefreshCw size={12} />} loading={loading} onClick={() => void load()}>{t('qcPdca.refresh')}</Button>
            <Button size="small" type="primary" icon={<Plus size={14} />} onClick={openCreate}>{t('qcPdca.createCycle')}</Button>
          </Space>
        }
      />

      {loadError && <ErrorBanner message={loadError} onRetry={() => void load()} retryLabel={t('w9.states.retry')} />}

      <div style={{ padding: 24 }}>
        <StatCardGrid gap={12}>
          {statCards.map((s, i) => (
            <StatCard key={i} title={s.label} value={s.value} icon={s.icon} color={s.color} sub={s.sub} />
          ))}
        </StatCardGrid>

        {pendingDefectId && (
          <div style={{ margin: '16px 0', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--color-primary-800)', fontSize: 12 }}>
            <Bug size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            {t('qcPdca.defectBannerPrefix')} {pendingDefectId} {t('qcPdca.defectBannerSuffix')}
          </div>
        )}

        <DataTable<PdcaCycle>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={cycles}
          pagination={{ pageSize: 8, showTotal: (total) => t('qcPdca.totalCycles', { total }) }}
          scroll={{ x: 1080 }}
          locale={{ emptyText: <Empty description={t('qcPdca.emptyCycles')} /> }}
        />
      </div>

      {/* 新建 / 编辑 Modal */}
      <Modal
        title={editing ? t('qcPdca.editCycle') : t('qcPdca.newCycle')}
        open={createOpen}
        onOk={() => void handleSave()}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={saving}
        okText={editing ? t('qcPdca.save') : t('qcPdca.create')}
        cancelText={t('qcPdca.cancel')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ category: '报告质控', ownerId: 'u-001' }}>
          <Form.Item name="title" label={t('qcPdca.formTitle')} rules={[{ required: true, message: t('qcPdca.requiredTitle') }]}>
            <Input placeholder={t('qcPdca.placeholderTitle')} maxLength={60} />
          </Form.Item>
          <Form.Item name="category" label={t('qcPdca.formCategory')} rules={[{ required: true }]}>
                <Select options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))} />
          </Form.Item>
          <Form.Item name="description" label={t('qcPdca.formDescription')}>
            <Input.TextArea rows={2} placeholder={t('qcPdca.placeholderDescription')} maxLength={200} />
          </Form.Item>
          <Form.Item name="target" label={t('qcPdca.formTarget')}>
            <Input placeholder={t('qcPdca.placeholderTarget')} maxLength={80} />
          </Form.Item>
          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item name="ownerId" label={t('qcPdca.formOwner')} style={{ flex: 1 }}>
              <Select options={OWNER_OPTIONS} />
            </Form.Item>
            <Form.Item name="dueDate" label={t('qcPdca.formDueDate')} style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
          </Space>
          {pendingDefectId && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--color-primary-800)' }}>
              {t('qcPdca.autoLinkPrefix')} {pendingDefectId}
            </div>
          )}
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={detail ? `${detail.title} — ${PHASE_META[detail.phase]?.label ?? detail.phase}` : t('qcPdca.cycleDetail')}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
        extra={sourceBadge}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>{t('qcPdca.loading')}</div>
        ) : detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
              <Space size={8} wrap>
                <Tag color={CATEGORY_COLORS[detail.category]}>{CATEGORY_LABELS[detail.category] ?? detail.category}</Tag>
                <Tag color={PHASE_META[detail.phase]?.color}>{PHASE_META[detail.phase]?.label}</Tag>
                <Tag color={detail.status === '已完成' ? 'green' : 'blue'}>{detail.status}</Tag>
              </Space>
              <div style={{ marginTop: 10, color: '#475569', fontSize: 12, lineHeight: 1.7 }}>
                <div><b>{t('qcPdca.detailDescription')}</b> {detail.description || '-'}</div>
                <div><b>{t('qcPdca.detailTarget')}</b> {detail.target || '-'}</div>
                <div><b>{t('qcPdca.detailOwner')}</b> {detail.ownerName} · <b>{t('qcPdca.detailStart')}</b> {fmtDate(detail.startDate)} · <b>{t('qcPdca.detailDue')}</b> {fmtDate(detail.dueDate)}</div>
                {detail.summary && <div style={{ color: '#10b981' }}><b>{t('qcPdca.detailSummary')}</b> {detail.summary}</div>}
              </div>
            </div>

            {/* 阶段时间线 + 条目 CRUD */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <b>{t('qcPdca.phasePlanResult')}</b>
                <Button
                  size="small"
                  icon={<Plus size={12} />}
                  disabled={detail.phase === 'completed'}
                  onClick={() => {
                    phaseForm.resetFields()
                    setPhaseEditing(null)
                    setPhaseModalOpen(true)
                  }}
                >
                  {t('qcPdca.addEntry')}
                </Button>
              </div>
              {phases.length === 0 ? (
                <Empty description={t('qcPdca.emptyPhases')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  items={phases.map((p) => ({
                    color: PHASE_META[p.phase]?.color,
                    children: (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <Tag color={PHASE_META[p.phase]?.color} style={{ marginTop: 1, flexShrink: 0 }}>{PHASE_META[p.phase]?.label}</Tag>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12 }}>{p.content}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                            {fmtDate(p.createdAt)}{p.updatedAt !== p.createdAt ? ` · ${t('qcPdca.updatedAt', { date: fmtDate(p.updatedAt) })}` : ''}
                          </div>
                        </div>
                        <Button
                          size="small"
                          type="text"
                          icon={<Pencil size={12} />}
                          onClick={() => {
                            setPhaseEditing(p)
                            phaseForm.setFieldsValue({ phase: p.phase, content: p.content })
                            setPhaseModalOpen(true)
                          }}
                        />
                      </div>
                    ),
                  }))}
                />
              )}
            </div>

            {/* 缺陷关联 */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <b>{t('qcPdca.linkedDefects')} ({defects.length})</b>
                <Space size={6}>
                  <Select
                    size="small"
                    style={{ width: 220 }}
                    placeholder={t('qcPdca.selectDefect')}
                    value={linkedDefectId}
                    onChange={setLinkedDefectId}
                    options={allDefects.filter((d) => !defects.some((x) => x.id === d.id)).map((d) => ({
                      value: d.id,
                      label: `${d.defectType}: ${d.description.slice(0, 20)}`,
                    }))}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Button size="small" type="primary" icon={<Plus size={12} />} disabled={!linkedDefectId} onClick={() => void handleLinkDefect()}>{t('qcPdca.link')}</Button>
                </Space>
              </div>
              {defects.length === 0 ? (
                <Empty description={t('qcPdca.emptyLinkedDefects')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  {defects.map((d) => (
                    <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                      <Tag color={CATEGORY_COLORS[d.defectType] ?? 'default'} style={{ flexShrink: 0 }}>{CATEGORY_LABELS[d.defectType] ?? d.defectType}</Tag>
                      <span style={{ flex: 1, color: '#475569' }}>{d.description}</span>
                      <Tag color={STATUS_COLORS[d.status] ?? 'default'}>{STATUS_LABELS[d.status] ?? d.status}</Tag>
                      <span style={{ color: '#94a3b8' }}>{d.reportedBy}</span>
                    </div>
                  ))}
                </Space>
              )}
            </div>

            {detail.phase !== 'completed' && (
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button icon={<ArrowRight size={14} />} onClick={() => void handleAdvance(detail)}>{t('qcPdca.advancePhase')}</Button>
                <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => openComplete(detail)}>{t('qcPdca.completeCycle')}</Button>
              </Space>
            )}
          </Space>
        ) : null}
      </Drawer>

      {/* 阶段条目编辑 Modal */}
      <Modal
        title={phaseEditing ? t('qcPdca.editPhaseEntry') : t('qcPdca.addPhaseEntry')}
        open={phaseModalOpen}
        onOk={() => void (phaseEditing ? handleUpdatePhase(phaseForm.getFieldsValue()) : handleAddPhase(phaseForm.getFieldsValue()))}
        onCancel={() => { setPhaseModalOpen(false); setPhaseEditing(null) }}
        okText={phaseEditing ? t('qcPdca.save') : t('qcPdca.add')}
        cancelText={t('qcPdca.cancel')}
        width={480}
        destroyOnClose
      >
        <Form form={phaseForm} layout="vertical" preserve={false} initialValues={{ phase: 'plan' }}>
          <Form.Item name="phase" label={t('qcPdca.formPhase')} rules={[{ required: true }]}>
            <Select options={['plan', 'do', 'check', 'act'].map((p) => ({ value: p, label: `${PHASE_META[p]?.label} (${p})` }))} />
          </Form.Item>
          <Form.Item name="content" label={t('qcPdca.formContent')} rules={[{ required: true, message: t('qcPdca.requiredContent') }]}>
            <Input.TextArea rows={3} placeholder={t('qcPdca.placeholderContent')} maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 完成周期 Modal */}
      <Modal
        title={t('qcPdca.completeCycle')}
        open={completeOpen}
        onOk={() => void handleComplete()}
        onCancel={() => setCompleteOpen(false)}
        okText={t('qcPdca.confirmComplete')}
        cancelText={t('qcPdca.cancel')}
        destroyOnClose
      >
        <Form form={completeForm} layout="vertical" preserve={false}>
          <Form.Item name="summary" label={t('qcPdca.formSummary')} rules={[{ required: true, message: t('qcPdca.requiredSummary') }]}>
            <Input.TextArea rows={4} placeholder={t('qcPdca.placeholderSummary')} maxLength={300} />
          </Form.Item>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {t('qcPdca.completeHint')}
          </div>
        </Form>
      </Modal>
    </PageContainer>
  )
}

// ── 离线回退: 确定性演示数据 (后端与 MSW 均不可达时兜底) ──────────────────
const demoFallbackCycles = (): PdcaCycle[] => [
  { id: 'pdca-d-001', title: '报告术语规范专项', category: '报告质控', description: '降低模糊表述占比', target: '模糊表述率 ≤ 5%', ownerId: 'u-001', ownerName: '张主任', phase: 'completed', status: '已完成', startDate: '2026-05-06T00:00:00.000Z', dueDate: '2026-06-30T00:00:00.000Z', completedAt: '2026-06-28T00:00:00.000Z', summary: '术语规范化培训完成', defectIds: ['df-001'], createdAt: '2026-05-06T00:00:00.000Z', updatedAt: '2026-06-28T00:00:00.000Z' },
  { id: 'pdca-d-002', title: '危急值报告复核流程再造', category: '流程质控', description: '电话复核闭环', target: '复核率 ≥ 98%', ownerId: 'u-001', ownerName: '张主任', phase: 'check', status: '进行中', startDate: '2026-06-20T00:00:00.000Z', dueDate: '2026-08-31T00:00:00.000Z', defectIds: ['df-005'], createdAt: '2026-06-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z' },
  { id: 'pdca-d-003', title: 'DR 胸片曝光参数校准', category: '图像质控', description: '曝光不足整改', target: '曝光合格率 ≥ 95%', ownerId: 'u-003', ownerName: '王技师', phase: 'do', status: '进行中', startDate: '2026-07-01T00:00:00.000Z', dueDate: '2026-09-10T00:00:00.000Z', defectIds: ['df-006'], createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z' },
  { id: 'pdca-d-004', title: '报告排版模板统一', category: '报告质控', description: '模板字段统一', target: '模板统一率 100%', ownerId: 'u-003', ownerName: '王技师', phase: 'plan', status: '进行中', startDate: '2026-07-15T00:00:00.000Z', dueDate: '2026-09-30T00:00:00.000Z', defectIds: ['df-004'], createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z' },
]

const demoStats = (cycles: PdcaCycle[]): PdcaStats => {
  const byPhase: Record<string, number> = { plan: 0, do: 0, check: 0, act: 0, completed: 0 }
  const byCategory: Record<string, number> = { 报告质控: 0, 图像质控: 0, 流程质控: 0, 服务质控: 0 }
  let completed = 0
  for (const c of cycles) {
    byPhase[c.phase] = (byPhase[c.phase] ?? 0) + 1
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1
    if (c.phase === 'completed') completed += 1
  }
  return { total: cycles.length, byPhase, byCategory, completionRate: Math.round((completed / cycles.length) * 1000) / 10, avgDurationDays: 45, inProgress: cycles.length - completed }
}

import { DataTable } from "../../components/common";
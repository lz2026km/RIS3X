/**
 * G005 RIS v3.0.6.11-60 - VNA 厂商中立归档仪表板 (对标 Agfa / Sectra / GE Datalogue)
 * 归档统计卡 + 对象列表 (类型筛选/搜索/WORM 标记/下载/删除/锁定)
 * 上传非 DICOM 内容 Modal + 对象详情 Drawer + 患者归档视图 (全生命周期时间线)
 */
import { usePagination } from '../hooks/usePagination'
import { invalidateApiCache } from '../services/api/client'
import {
  vnaApi, type VnaObject, type VnaObjectType, type VnaStats, type VnaStudy, type PatientArchive,
  type VnaLifecycleTier, type LifecyclePolicy, type LifecycleEvent, TIER_LABEL,
  type VnaOverview, type VnaStorageTrendPoint, type VnaTierStat, type VnaVerification,
  type DuplicateAnalysis,
} from '../services/api/vnaApi'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from "antd";
import {
  Archive,
  Download,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Upload as UploadIcon,
  Database as DatabaseIcon,
  Layers as LayersIcon,
} from 'lucide-react'
import { Inbox, Trash2, ArrowRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts'
import { ChartContainer } from '../components/charts'
import { DataTable, StatCard, StatCardGrid } from "../components/common"
import { t } from '../i18n/appI18n'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const { Text } = Typography

const TYPE_LABEL: Record<VnaObjectType, string> = { document: 'vnaPage.document', image: 'vnaPage.image' }

// [G-26] ILM 分层标签
const TIER_TAG: Record<VnaLifecycleTier, { color: string; label: string }> = {
  hot: { color: 'red', label: 'vnaPage.tierHot' },
  warm: { color: 'orange', label: 'vnaPage.tierWarm' },
  cold: { color: 'blue', label: 'vnaPage.tierCold' },
}

const TIER_ORDER: VnaLifecycleTier[] = ['hot', 'warm', 'cold']

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

const VNADashboardPage: React.FC = () => {
  const [stats, setStats] = useState<VnaStats | null>(null)
  const [objects, setObjects] = useState<VnaObject[]>([])
  const [studies, setStudies] = useState<VnaStudy[]>([])
  const { pageData: objectPageData, pagination: objectPagination } = usePagination(objects, 10)
  const { pageData: studyPageData, pagination: studyPagination } = usePagination(studies, 10)
  const [loading, setLoading] = useState(false)
  const [studiesLoading, setStudiesLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<VnaObjectType | ''>('')
  const [search, setSearch] = useState('')
  const [statsLoading, setStatsLoading] = useState(false)

  // 上传 Modal
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadForm] = Form.useForm()

  // 详情 Drawer
  const [detail, setDetail] = useState<VnaObject | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // 患者归档视图
  const [patientInput, setPatientInput] = useState('')
  const [patientArchive, setPatientArchive] = useState<PatientArchive | null>(null)
  const [patientLoading, setPatientLoading] = useState(false)

  // [G-26] ILM 生命周期
const [policies, setPolicies] = useState<LifecyclePolicy[]>([])
const [events, setEvents] = useState<LifecycleEvent[]>([])
// [v3.0.6.11-99 Wave8A P1] 生命周期事件表分页受控化
const { pageData: eventPageData, pagination: eventPagination } = usePagination(events, 8)
  const [lifecycleLoading, setLifecycleLoading] = useState(false)
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<LifecyclePolicy | null>(null)
  const [policySaving, setPolicySaving] = useState(false)
  const [policyForm] = Form.useForm()
  const [migrateTarget, setMigrateTarget] = useState<{ object: VnaObject; tier: VnaLifecycleTier } | null>(null)
  const [migrating, setMigrating] = useState(false)

  // [W10E-3] 存储分析 (总览/趋势/分层/重复) + 完整性校验
  const [overview, setOverview] = useState<VnaOverview | null>(null)
  const [trend, setTrend] = useState<VnaStorageTrendPoint[]>([])
  const [byTier, setByTier] = useState<VnaTierStat[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateAnalysis | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [trendDays, setTrendDays] = useState(30)
  const [verifyResult, setVerifyResult] = useState<VnaVerification | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const previewRevoked = useRef<Set<string>>(new Set())

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await vnaApi.getStats()
      if (res.success) setStats(res.data)
      else message.error(res.error?.message || t('vnaPage.statsLoadFailed'))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadObjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await vnaApi.getObjects({ type: typeFilter, search })
      if (res.success) setObjects(res.data)
      else message.error(res.error?.message || t('vnaPage.objectsLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [typeFilter, search])

  const loadStudies = useCallback(async () => {
    setStudiesLoading(true)
    try {
      const res = await vnaApi.getStudies()
      if (res.success) setStudies(res.data)
      else message.error(res.error?.message || t('vnaPage.studiesLoadFailed'))
    } finally {
      setStudiesLoading(false)
    }
  }, [])

  // [G-26] 生命周期数据
  const loadLifecycle = useCallback(async () => {
    setLifecycleLoading(true)
    try {
      const [pRes, eRes] = await Promise.all([vnaApi.getLifecyclePolicies(), vnaApi.getLifecycleEvents(100)])
      if (pRes.success) setPolicies(pRes.data)
      else message.error(pRes.error?.message || t('vnaPage.lifecycleLoadFailed'))
      if (eRes.success) setEvents(eRes.data)
    } finally {
      setLifecycleLoading(false)
    }
  }, [])

  // [W10E-3] 存储分析数据 (overview / storage-trend / by-tier / duplicate-analysis)
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const [oRes, tRes, bRes, dRes] = await Promise.all([
        vnaApi.getOverview(),
        vnaApi.getStorageTrend(trendDays),
        vnaApi.getByTier(),
        vnaApi.getDuplicateAnalysis(),
      ])
      if (oRes.success) setOverview(oRes.data)
      else message.error(oRes.error?.message || t('vnaPage.overviewLoadFailed'))
      if (tRes.success && Array.isArray(tRes.data)) setTrend(tRes.data)
      if (bRes.success && Array.isArray(bRes.data)) setByTier(bRes.data)
      if (dRes.success) setDuplicates(dRes.data)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [trendDays])

  const refreshArchive = useCallback(async () => {
    await invalidateApiCache('/vna/objects')
    await invalidateApiCache('/vna/stats')
    await invalidateApiCache('/vna/studies')
    void loadObjects()
    void loadStats()
    void loadStudies()
    void loadLifecycle()
    void loadAnalytics()
  }, [loadObjects, loadStats, loadStudies, loadLifecycle, loadAnalytics])

  useEffect(() => {
    document.title = t('vnaPage.title')
    void loadStats()
    void loadObjects()
    void loadStudies()
    void loadLifecycle()
    void loadAnalytics()
  }, [loadStats, loadObjects, loadStudies, loadLifecycle, loadAnalytics])

  const revokePreview = useCallback((url: string | null) => {
    if (url && !previewRevoked.current.has(url)) {
      previewRevoked.current.add(url)
      URL.revokeObjectURL(url)
    }
  }, [])

  // ─────────────────────── 上传 ───────────────────────

  const openUpload = useCallback(() => {
    uploadForm.resetFields()
    uploadForm.setFieldsValue({ objectType: 'document' })
    setUploadFile(null)
    setUploadOpen(true)
  }, [uploadForm])

  const handleUploadSubmit = useCallback(async () => {
    const values = await uploadForm.validateFields()
    if (!uploadFile && !values.name) {
      message.warning(t('vnaPage.selectFileOrName'))
      return
    }
    const form = new FormData()
    form.set('patientId', values.patientId ?? '')
    form.set('studyUid', values.studyUid ?? '')
    form.set('objectType', values.objectType ?? 'document')
    form.set('name', values.name ?? uploadFile?.name ?? '')
    form.set('description', values.description ?? '')
    if (uploadFile) form.set('file', uploadFile, uploadFile.name)
    setUploading(true)
    try {
      const res = await vnaApi.createObject(form)
      if (res.success) {
        message.success(`对象 ${res.data.name} 已归档`)
        setUploadOpen(false)
        setUploadFile(null)
        void refreshArchive()
      } else {
        message.error(res.error?.message || t('vnaPage.archiveFailed'))
      }
    } finally {
      setUploading(false)
    }
  }, [uploadForm, uploadFile, refreshArchive])

  // ─────────────────────── 下载 / 详情 ───────────────────────

  const handleDownload = useCallback(async (obj: VnaObject) => {
    const blob = await vnaApi.downloadObject(obj.id)
    if (!blob) {
      message.error(t('vnaPage.downloadFailed'))
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = obj.name || `${obj.id}.bin`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [])

  const openDetail = useCallback(async (obj: VnaObject) => {
    setDetail(obj)
    setPreviewUrl(null)
    setDrawerOpen(true)
    const isImage = obj.mimeType.startsWith('image/')
    if (isImage) {
      setPreviewLoading(true)
      try {
        const blob = await vnaApi.downloadObject(obj.id)
        if (blob) {
          revokePreview(previewUrl)
          setPreviewUrl(URL.createObjectURL(blob))
        }
      } finally {
        setPreviewLoading(false)
      }
    }
  }, [previewUrl, revokePreview])

  const closeDetail = useCallback(() => {
    setDrawerOpen(false)
    revokePreview(previewUrl)
    setPreviewUrl(null)
    setDetail(null)
  }, [previewUrl, revokePreview])

  const handleLock = useCallback(async (obj: VnaObject) => {
    const res = await vnaApi.wormLock(obj.id)
    if (res.success) {
      message.success(`对象 ${obj.name} 已 WORM 锁定 (不可删除)`)
      void refreshArchive()
      setDetail(res.data)
    } else {
      message.error(res.error?.message || t('vnaPage.lockFailed'))
    }
  }, [refreshArchive])

  const handleDelete = useCallback(async (obj: VnaObject) => {
    const res = await vnaApi.deleteObject(obj.id)
    if (res.success) {
      message.success(`对象 ${obj.name} 已删除`)
      void refreshArchive()
    } else {
      message.error(res.error?.message || t('vnaPage.deleteFailed'))
    }
  }, [refreshArchive])

  // ─────────────────────── [G-26] ILM 生命周期 ───────────────────────

  const openPolicyModal = useCallback((policy: LifecyclePolicy | null) => {
    setEditingPolicy(policy)
    if (policy) {
      policyForm.setFieldsValue({ tier: policy.tier, retentionDays: policy.retentionDays, description: policy.description })
    } else {
      policyForm.resetFields()
      policyForm.setFieldsValue({ tier: 'warm', retentionDays: 90 })
    }
    setPolicyModalOpen(true)
  }, [policyForm])

  const handlePolicySave = useCallback(async () => {
    const values = await policyForm.validateFields()
    setPolicySaving(true)
    try {
      const payload = { tier: values.tier as VnaLifecycleTier, retentionDays: Number(values.retentionDays), description: values.description }
      const res = editingPolicy
        ? await vnaApi.updateLifecyclePolicy(editingPolicy.id, payload)
        : await vnaApi.createLifecyclePolicy(payload)
      if (res.success) {
        message.success(editingPolicy ? `策略 ${res.data.tier} 已更新` : `策略 ${res.data.tier} 已创建`)
        setPolicyModalOpen(false)
        void loadLifecycle()
      } else {
        message.error(res.error?.message || t('vnaPage.policySaveFailed'))
      }
    } finally {
      setPolicySaving(false)
    }
  }, [policyForm, editingPolicy, loadLifecycle])

  const handlePolicyDelete = useCallback(async (policy: LifecyclePolicy) => {
    const res = await vnaApi.deleteLifecyclePolicy(policy.id)
    if (res.success) {
      message.success(`策略 ${policy.tier} 已删除`)
      void loadLifecycle()
    } else {
      message.error(res.error?.message || t('vnaPage.policyDeleteFailed'))
    }
  }, [loadLifecycle])

  const handleMigrate = useCallback(async () => {
    if (!migrateTarget) return
    setMigrating(true)
    try {
      const res = await vnaApi.migrateObject(migrateTarget.object.id, migrateTarget.tier, '手动迁移 (G-26 ILM)')
      if (res.success) {
        message.success(`${migrateTarget.object.name} → ${TIER_LABEL[migrateTarget.tier]}`)
        setMigrateTarget(null)
        void refreshArchive()
      } else {
        message.error(res.error?.message || t('vnaPage.migrateFailed'))
      }
    } finally {
      setMigrating(false)
    }
  }, [migrateTarget, refreshArchive])

  // [W10E-3] 对象完整性校验 (POST /vna/objects/:id/verify)
  const handleVerify = useCallback(async (obj: VnaObject) => {
    setVerifyingId(obj.id)
    try {
      const res = await vnaApi.verifyObject(obj.id)
      if (res.success) {
        setVerifyResult(res.data)
        message.success(res.data.status === 'integrity-ok' ? `校验通过: ${obj.name}` : `校验异常: ${obj.name}`)
      } else {
        message.error(res.error?.message || t('vnaPage.verifyFailed'))
      }
    } catch {
      message.error(t('vnaPage.verifyRequestFailed'))
    } finally {
      setVerifyingId(null)
    }
  }, [])

  // ─────────────────────── 患者归档视图 ───────────────────────

  const handleQueryPatient = useCallback(async () => {
    const patientId = patientInput.trim()
    if (!patientId) {
      message.warning(t('vnaPage.enterPatientId'))
      return
    }
    setPatientLoading(true)
    try {
      const res = await vnaApi.getPatientArchive(patientId)
      if (res.success) setPatientArchive(res.data)
      else message.error(res.error?.message || t('vnaPage.patientArchiveLoadFailed'))
    } finally {
      setPatientLoading(false)
    }
  }, [patientInput])

  const timelineItems = useMemo<{
    key: string
    color: 'blue' | 'green' | 'orange'
    time: string
    title: string
    description: string
    object?: VnaObject
  }[]>(() => {
    if (!patientArchive) return []
    const studyEvents = patientArchive.studies.map((s) => ({
      key: `study-${s.studyUid}`,
      color: 'blue' as const,
      time: s.createdAt,
      title: `DICOM 检查归档 · ${s.modality} (${s.instanceCount} 实例 / ${s.seriesCount} 序列)`,
      description: s.studyDescription,
    }))
    const objectEvents = patientArchive.objects.map((o) => ({
      key: `obj-${o.id}`,
      color: (o.objectType === 'image' ? 'green' : 'orange') as 'green' | 'orange',
      time: o.createdAt,
      title: `${t(TYPE_LABEL[o.objectType])}${t('vnaPage.archive')} · ${o.name}${o.wormLocked ? t('vnaPage.wormLockedSuffix') : ''}`,
      description: o.description || o.mimeType,
      object: o,
    }))
    return [...studyEvents, ...objectEvents].sort((a, b) => (a.time < b.time ? 1 : -1))
  }, [patientArchive])

  const actionRender = (obj: VnaObject) => (
    <Space size={4}>
      <Button size="small" type="link" onClick={() => void openDetail(obj)}>{t('vnaPage.view')}</Button>
      <Button size="small" type="link" icon={<Download size={14} />} onClick={() => void handleDownload(obj)}>{t('vnaPage.download')}</Button>
      {!obj.wormLocked && (
        <Popconfirm
          title={t('vnaPage.wormLockTitle')}
          description={`确认锁定 ${obj.name} ? (一次性不可逆)`}
          okText={t('vnaPage.lock')}
          cancelText={t('vnaPage.cancel')}
          onConfirm={() => void handleLock(obj)}
        >
          <Button size="small" type="link" icon={<Lock size={14} />}>{t('vnaPage.lock')}</Button>
        </Popconfirm>
      )}
      {!obj.wormLocked && (
        <Popconfirm
          title={t('vnaPage.deleteArchiveObject')}
          description={`确认删除 ${obj.name} ?`}
          okText={t('vnaPage.delete')}
          cancelText={t('vnaPage.cancel')}
          okButtonProps={{ danger: true }}
          onConfirm={() => void handleDelete(obj)}
        >
          <Button size="small" type="link" danger icon={<Trash2 size={12} />}>{t('vnaPage.delete')}</Button>
        </Popconfirm>
      )}
    </Space>
  )

  const objectColumns = [
    { title: t('vnaPage.name'), dataIndex: 'name', key: 'name', width: 260, ellipsis: true, render: (v: string, r: VnaObject) => (
      <Space>
        {r.objectType === 'image' ? <ImageIcon size={15} color="#0ea5e9" /> : <FileText size={15} color="var(--color-warning-500)" />}
        <Text ellipsis style={{ maxWidth: 220 }}>{v}</Text>
      </Space>
    ) },
    { title: t('vnaPage.type'), dataIndex: 'objectType', key: 'type', width: 80, render: (v: VnaObjectType) => (
      <Tag color={v === 'image' ? 'cyan' : 'orange'}>{t(TYPE_LABEL[v])}</Tag>
    ) },
    { title: t('vnaPage.patientId'), dataIndex: 'patientId', key: 'patientId', width: 100, render: (v: string | null) => v ?? <Text type="secondary">-</Text> },
    { title: t('vnaPage.mimeType'), dataIndex: 'mimeType', key: 'mime', width: 150, ellipsis: true },
    { title: t('vnaPage.size'), dataIndex: 'size', key: 'size', width: 90, render: (v: number) => formatSize(v) },
    { title: t('vnaPage.archivedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => formatDate(v) },
    { title: 'WORM', dataIndex: 'wormLocked', key: 'worm', width: 90, render: (v: boolean) => v
      ? <Tag color="purple" icon={<Lock size={12} />}>{t('vnaPage.locked')}</Tag>
      : <Tag icon={<LockOpen size={12} />}>{t('vnaPage.unlocked')}</Tag> },
    // [G-26] ILM 分层
    { title: t('vnaPage.storageTier'), dataIndex: 'tier', key: 'tier', width: 90, render: (v: VnaLifecycleTier | undefined, r: VnaObject) => {
      const tier = (v ?? r.tier ?? 'hot') as VnaLifecycleTier
      const conf = TIER_TAG[tier]
      return <Tag color={conf.color}>{t(conf.label)}</Tag>
    } },
    { title: t('vnaPage.actions'), key: 'actions', width: 340, render: (_: unknown, r: VnaObject) => (
      <Space size={4}>
        {actionRender(r)}
        <Button
          size="small"
          type="link"
          icon={<LayersIcon size={13} />}
          onClick={() => setMigrateTarget({ object: r, tier: 'warm' })}
        >
          {t('vnaPage.migrate')}
        </Button>
        <Button
          size="small"
          type="link"
          icon={<ShieldCheck size={13} />}
          loading={verifyingId === r.id}
          onClick={() => void handleVerify(r)}
        >
          {t('vnaPage.verify')}
        </Button>
      </Space>
    ) },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: 'calc(100vh - 56px)' }}>
      <Card style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)', color: '#fff', border: 'none', marginBottom: 16 }}>
        <Space size={16}>
          <Archive size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{t('vnaPage.pageTitle')}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {t('vnaPage.pageDesc')}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <Space>
              <Button icon={<RefreshCw size={14} />} onClick={() => { void loadStats(); void loadObjects(); void loadStudies() }}>{t('vnaPage.refresh')}</Button>
              <Button type="primary" ghost icon={<Plus size={14} />} onClick={openUpload}>{t('vnaPage.uploadArchive')}</Button>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 归档统计卡 */}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard loading={statsLoading} title={t('vnaPage.totalObjects')} value={stats?.totalObjects ?? 0} icon={<FileText size={16} />} color="#7c3aed" />
        <StatCard loading={statsLoading} title={t('vnaPage.totalCapacity')} value={stats ? formatSize(stats.totalSizeBytes) : '-'} icon={<HardDrive size={16} />} color="error" />
        <StatCard loading={statsLoading} title={t('vnaPage.dicomInstances')} value={stats?.dicomCount ?? 0} icon={<DatabaseIcon size={16} />} color="var(--color-info-600)" />
        <StatCard loading={statsLoading} title={t('vnaPage.nonDicomObjects')} value={stats?.nonDicomCount ?? 0} icon={<FileText size={16} />} color="var(--color-warning-500)" />
        <StatCard loading={statsLoading} title={t('vnaPage.wormLocked')} value={stats?.wormLockedCount ?? 0} icon={<ShieldCheck size={16} />} color="#10b981" />
      </StatCardGrid>

      <Card>
        <Tabs
          defaultActiveKey="objects"
          items={[
            {
              key: 'objects',
              label: t('vnaPage.objectsTab', { count: objects.length }),
              children: (
                <>
                  <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
                    <Space>
                      <Select
                        style={{ width: 140 }}
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v)}
                        placeholder={t('vnaPage.typeFilter')}
                        options={[
                          { value: '', label: t('vnaPage.allTypes') },
                          { value: 'document', label: t('vnaPage.document') },
                          { value: 'image', label: t('vnaPage.image') },
                        ]}
                      />
                      <Input
                        style={{ width: 240 }}
                        allowClear
                        prefix={<Search size={14} />}
                        placeholder={t('vnaPage.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onPressEnter={() => void loadObjects()}
                      />
                      <Button type="primary" icon={<Search size={14} />} onClick={() => void loadObjects()}>{t('vnaPage.query')}</Button>
                    </Space>
                    <Text type="secondary" data-testid="vna-objects-count">{t('vnaPage.objectsCount', { count: objects.length })}</Text>
                  </Space>
                  <DataTable scroll={{ x: 'max-content' }}
                    data-testid="vna-objects-table"
                    dataSource={objectPageData}
                    rowKey="id"
                    loading={loading}
                    columns={objectColumns}
                    pagination={objectPagination}
                 
                  />
                </>
              ),
            },
            {
              key: 'studies',
              label: t('vnaPage.studiesTab', { count: studies.length }),
              children: (
                <DataTable scroll={{ x: 'max-content' }}
                  data-testid="vna-studies-table"
                  dataSource={studyPageData}
                  rowKey="studyUid"
                  loading={studiesLoading}
                  pagination={studyPagination}
                  columns={[
                    { title: t('vnaPage.studyUid'), dataIndex: 'studyUid', key: 'uid', width: 260, ellipsis: true },
                    { title: t('vnaPage.modality'), dataIndex: 'modality', key: 'mod', width: 80, render: (v: string) => <Tag color="blue">{v}</Tag> },
                    { title: t('vnaPage.description'), dataIndex: 'studyDescription', key: 'desc', ellipsis: true },
                    { title: t('vnaPage.seriesCount'), dataIndex: 'seriesCount', key: 'series', width: 90 },
                    { title: t('vnaPage.instanceCount'), dataIndex: 'instanceCount', key: 'inst', width: 90 },
                    { title: t('vnaPage.archivedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => formatDate(v) },
                  ]}
               
                />
              ),
            },
            {
              key: 'patient',
              label: t('vnaPage.patientArchiveView'),
              children: (
                <div data-testid="vna-patient-archive">
                  <Space style={{ marginBottom: 16 }}>
                    <Input
                      style={{ width: 260 }}
                      prefix={<User size={14} />}
                      placeholder={t('vnaPage.patientIdPlaceholder')}
                      value={patientInput}
                      onChange={(e) => setPatientInput(e.target.value)}
                      onPressEnter={() => void handleQueryPatient()}
                    />
                    <Button type="primary" loading={patientLoading} onClick={() => void handleQueryPatient()}>{t('vnaPage.viewFullLifecycle')}</Button>
                  </Space>
                  {!patientArchive ? (
                    <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('vnaPage.patientArchiveEmpty')} style={{ padding: 32 }} />
                  ) : (
                    <>
                      <Alert
                        style={{ marginBottom: 16 }}
                        type="info"
                        showIcon
                        title={`患者 ${patientArchive.patientId} 归档汇总`}
                        description={`${patientArchive.studies.length} 个 DICOM 检查 · ${patientArchive.objects.length} 个非 DICOM 对象 · 归档容量 ${formatSize(patientArchive.totalSizeBytes)}`}
                      />
                      <Row gutter={16}>
                        <Col span={14}>
                          <Card size="small" title={t('vnaPage.objectList')}>
                            <DataTable scroll={{ x: 'max-content' }}
                              dataSource={patientArchive.objects}
                              rowKey="id"
                              pagination={false}
                              columns={[
                                { title: t('vnaPage.name'), dataIndex: 'name', key: 'name', ellipsis: true },
                                { title: t('vnaPage.type'), dataIndex: 'objectType', key: 'type', width: 70, render: (v: VnaObjectType) => <Tag color={v === 'image' ? 'cyan' : 'orange'}>{t(TYPE_LABEL[v])}</Tag> },
                                { title: t('vnaPage.size'), dataIndex: 'size', key: 'size', width: 80, render: (v: number) => formatSize(v) },
                                { title: t('vnaPage.archivedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (v: string) => formatDate(v) },
                                { title: t('vnaPage.actions'), key: 'ops', width: 180, render: (_: unknown, r: VnaObject) => actionRender(r) },
                              ]}
                           
                            />
                          </Card>
                        </Col>
                        <Col span={10}>
                          <Card size="small" title={t('vnaPage.lifecycleTimeline')} data-testid="vna-patient-timeline">
                            <Timeline
                              items={timelineItems.map((item) => ({
                                key: item.key,
                                color: item.color,
                                content: (
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.description}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{formatDate(item.time)}</div>
                                    {item.object && (
                                      <Space size={4} style={{ marginTop: 4 }}>
                                        <Button size="small" type="link" onClick={() => void openDetail(item.object!)}>{t('vnaPage.view')}</Button>
                                        <Button size="small" type="link" onClick={() => void handleDownload(item.object!)}>{t('vnaPage.download')}</Button>
                                      </Space>
                                    )}
                                  </div>
                                ),
                              }))}
                            />
                          </Card>
                        </Col>
                      </Row>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'lifecycle',
              label: t('vnaPage.lifecycleTab', { count: policies.length }),
              children: (
                <div data-testid="vna-lifecycle-panel">
                  <Alert
                    style={{ marginBottom: 16 }}
                    type="info"
                    showIcon
                    title={t('vnaPage.lifecycleAlertTitle')}
                    description={t('vnaPage.lifecycleAlertDesc')}
                  />
                  <Space style={{ marginBottom: 12 }} wrap>
                    <Button type="primary" icon={<Plus size={14} />} onClick={() => openPolicyModal(null)}>{t('vnaPage.newPolicy')}</Button>
                    <Button icon={<RefreshCw size={14} />} loading={lifecycleLoading} onClick={() => void loadLifecycle()}>{t('vnaPage.refresh')}</Button>
                    <Text type="secondary">{t('vnaPage.policyEventCount', { policies: policies.length, events: events.length })}</Text>
                  </Space>
                  <Card size="small" title={t('vnaPage.tierPolicies')} style={{ marginBottom: 16 }}>
                    <DataTable
                      data-testid="vna-lifecycle-policies"
                      rowKey="id"
                      scroll={{ x: 'max-content' }}
                      loading={lifecycleLoading}
                      dataSource={policies}
                      pagination={false}
                      columns={[
                        { title: t('vnaPage.storageTier'), dataIndex: 'tier', key: 'tier', width: 100, render: (v: VnaLifecycleTier) => <Tag color={TIER_TAG[v]?.color}>{t(TIER_TAG[v]?.label ?? '')}</Tag> },
                        { title: t('vnaPage.retentionDays'), dataIndex: 'retentionDays', key: 'retentionDays', width: 110, render: (v: number) => v === 0 ? t('vnaPage.retentionInstant') : `${v} 天` },
                        { title: t('vnaPage.note'), dataIndex: 'description', key: 'desc', ellipsis: true },
                        { title: t('vnaPage.objectCount'), dataIndex: 'objectCount', key: 'count', width: 80 },
                        { title: t('vnaPage.actions'), key: 'ops', width: 150, render: (_: unknown, r: LifecyclePolicy) => (
                          <Space size={4}>
                            <Button size="small" type="link" onClick={() => openPolicyModal(r)}>{t('vnaPage.edit')}</Button>
                            <Popconfirm title={t('vnaPage.deletePolicyTitle')} okText={t('vnaPage.delete')} cancelText={t('vnaPage.cancel')} okButtonProps={{ danger: true }} onConfirm={() => void handlePolicyDelete(r)}>
                              <Button size="small" type="link" danger>{t('vnaPage.delete')}</Button>
                            </Popconfirm>
                          </Space>
                        ) },
                      ]}
                    />
                  </Card>
                  <Card size="small" title={t('vnaPage.migrateEventsLog')}>
                    <DataTable
                      data-testid="vna-lifecycle-events"
                      rowKey="id"
                      scroll={{ x: 'max-content' }}
                      dataSource={eventPageData}
                      pagination={eventPagination}
                      columns={[
                        { title: t('vnaPage.time'), dataIndex: 'createdAt', key: 'at', width: 160, render: (v: string) => formatDate(v) },
                        { title: t('vnaPage.object'), dataIndex: 'objectName', key: 'name', ellipsis: true },
                        { title: t('vnaPage.action'), dataIndex: 'action', key: 'action', width: 110, render: (v: LifecycleEvent['action']) => (
                          <Tag color={v === 'migrate' ? 'geekblue' : v === 'expire' ? 'red' : 'cyan'}>
                            {v === 'migrate' ? t('vnaPage.migrate') : v === 'expire' ? t('vnaPage.actionExpire') : t('vnaPage.actionPolicyApply')}
                          </Tag>
                        ) },
                        { title: t('vnaPage.tierChange'), key: 'tiers', width: 160, render: (_: unknown, r: LifecycleEvent) => (
                          <Space size={4}>
                            <Tag color={TIER_TAG[r.fromTier]?.color}>{t(TIER_TAG[r.fromTier]?.label ?? '')}</Tag>
                            <ArrowRight size={12} />
                            {r.toTier ? <Tag color={TIER_TAG[r.toTier]?.color}>{t(TIER_TAG[r.toTier]?.label ?? '')}</Tag> : <Tag>{t('vnaPage.expired')}</Tag>}
                          </Space>
                        ) },
                        { title: t('vnaPage.reason'), dataIndex: 'reason', key: 'reason', ellipsis: true },
                      ]}
                    />
                  </Card>
                </div>
              ),
            },
            {
              // [W10E-3] 存储分析: overview / storage-trend / by-tier / duplicate-analysis / verify
              key: 'analytics',
              label: <span><HardDrive size={13} /> {t('vnaPage.analytics')}</span>,
              children: (
                <div data-testid="vna-analytics-panel">
                  <Alert
                    style={{ marginBottom: 16 }}
                    type="info"
                    showIcon
                    title={t('vnaOps.analyticsTitle')}
                    description={t('vnaOps.analyticsDesc')}
                  />
                  <Space style={{ marginBottom: 12 }} wrap>
                    <Button icon={<RefreshCw size={14} />} loading={analyticsLoading} onClick={() => void loadAnalytics()}>{t('vnaOps.refresh')}</Button>
                    <Select
                      style={{ width: 140 }}
                      value={trendDays}
                      onChange={(v: number) => setTrendDays(v)}
                      options={[
                        { value: 7, label: t('vnaOps.days7') },
                        { value: 30, label: t('vnaOps.days30') },
                        { value: 60, label: t('vnaOps.days60') },
                      ]}
                    />
                  </Space>

                  <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
                    <StatCard loading={analyticsLoading} title={t('vnaOps.totalObjects')} value={overview?.totalObjects ?? 0} icon={<FileText size={16} />} />
                    <StatCard loading={analyticsLoading} title={t('vnaOps.totalCapacity')} value={overview ? formatSize(overview.totalSizeBytes) : '-'} icon={<HardDrive size={16} />} />
                    <StatCard loading={analyticsLoading} title={t('vnaOps.wormLocked')} value={overview?.wormLockedCount ?? 0} icon={<ShieldCheck size={16} />} />
                    <StatCard loading={analyticsLoading} title={t('vnaOps.last30dNew')} value={overview?.last30dNewObjects ?? 0} icon={<Plus size={16} />} />
                    <StatCard loading={analyticsLoading} title={t('vnaOps.growthRate')} value={overview?.growthRate ?? 0} suffix="%" icon={<RefreshCw size={16} />} />
                    <StatCard loading={analyticsLoading} title={t('vnaOps.studies')} value={overview?.studyCount ?? 0} icon={<DatabaseIcon size={16} />} />
                  </StatCardGrid>

                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={14}>
                      <Card size="small" title={t('vnaOps.trendTitle')}>
                        {trend.length > 0 ? (
                          <ChartContainer height={260} testId="vna-storage-trend">
                            <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1024 / 1024).toFixed(0)}MB`} width={72} />
                              <RechartsTooltip
                                formatter={(value: number, name: string) => [formatSize(value), name === 'totalSizeBytes' ? t('vnaOps.cumulativeCapacity') : t('vnaOps.addedBytes')]}
                              />
                              <Line type="monotone" dataKey="totalSizeBytes" stroke="#7c3aed" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="addedBytes" stroke="var(--color-info-600)" strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ChartContainer>
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('vnaOps.noTrendData')} style={{ padding: 24 }} />
                        )}
                      </Card>
                    </Col>
                    <Col span={10}>
                      <Card size="small" title={t('vnaOps.byTierTitle')}>
                        <DataTable
                          data-testid="vna-by-tier"
                          rowKey="tier"
                          pagination={false}
                          loading={analyticsLoading}
                          dataSource={byTier}
                          columns={[
                            { title: t('vnaOps.tier'), dataIndex: 'tierZh', key: 'tierZh', width: 80, render: (v: string, r: VnaTierStat) => <Tag color={TIER_TAG[r.tier]?.color}>{v}</Tag> },
                            { title: t('vnaOps.objectCount'), dataIndex: 'count', key: 'count', width: 90, render: (v: number, r: VnaTierStat) => `${v} (${r.percent}%)` },
                            { title: t('vnaOps.capacity'), dataIndex: 'sizeBytes', key: 'size', render: (v: number) => formatSize(v) },
                            { title: t('vnaOps.types'), key: 'types', width: 110, render: (_: unknown, r: VnaTierStat) => `${t('vnaOps.documents')} ${r.documents} / ${t('vnaOps.images')} ${r.images}` },
                          ]}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card size="small" title={t('vnaOps.duplicateTitle')} extra={duplicates ? <Tag color="red">{t('vnaOps.wasted')} {formatSize(duplicates.wastedBytes)}</Tag> : undefined}>
                    {duplicates && duplicates.totalDuplicates > 0 ? (
                      <DataTable
                        data-testid="vna-duplicate-analysis"
                        rowKey={(r) => `${r.name}-${r.size}`}
                        scroll={{ x: 'max-content' }}
                        dataSource={duplicates.groups}
                        pagination={{ pageSize: 5 }}
                        columns={[
                          { title: t('vnaOps.objectName'), dataIndex: 'name', key: 'name', ellipsis: true },
                          { title: t('vnaOps.singleSize'), dataIndex: 'size', key: 'size', width: 110, render: (v: number) => formatSize(v) },
                          { title: t('vnaOps.dupCount'), dataIndex: 'count', key: 'count', width: 80, render: (v: number) => <Tag color="orange">× {v}</Tag> },
                          { title: t('vnaOps.wasted'), dataIndex: 'wastedBytes', key: 'wasted', width: 120, render: (v: number) => <span style={{ color: 'var(--color-error-600)' }}>{formatSize(v)}</span> },
                          { title: t('vnaOps.firstCreated'), dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => formatDate(v) },
                        ]}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('vnaOps.noDuplicates')} style={{ padding: 16 }} />
                    )}
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 上传 Modal */}
      <Modal
        title={t('vnaPage.uploadNonDicomTitle')}
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => void handleUploadSubmit()}
        confirmLoading={uploading}
        okText={t('vnaPage.archive')}
        cancelText={t('vnaPage.cancel')}
        destroyOnHidden
      >
        <Form form={uploadForm} layout="vertical" initialValues={{ objectType: 'document' }}>
          <Form.Item name="patientId" label={t('vnaPage.patientId')} rules={[{ required: true, message: t('vnaPage.patientIdRequired') }]}>
            <Input placeholder={t('vnaPage.patientIdExample')} />
          </Form.Item>
          <Form.Item name="objectType" label={t('vnaPage.objectType')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'document', label: t('vnaPage.docOption') },
                { value: 'image', label: t('vnaPage.imageOption') },
              ]}
            />
          </Form.Item>
          <Form.Item name="studyUid" label={t('vnaPage.studyUidOptional')}>
            <Input placeholder={t('vnaPage.studyUidPlaceholder')} />
          </Form.Item>
          <Form.Item name="name" label={t('vnaPage.objectNameOptional')}>
            <Input placeholder={t('vnaPage.objectName')} />
          </Form.Item>
          <Form.Item name="description" label={t('vnaPage.descriptionOptional')}>
            <Input.TextArea rows={2} placeholder={t('vnaPage.objectDescription')} />
          </Form.Item>
          <Form.Item label={t('vnaPage.file')}>
            <Upload
              beforeUpload={(file) => {
                setUploadFile(file)
                return false
              }}
              maxCount={1}
              onRemove={() => setUploadFile(null)}
            >
              <Button icon={<UploadIcon />}>{t('vnaPage.selectFile')}</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* 对象详情 Drawer */}
      <Drawer
        title={detail ? `对象详情 · ${detail.name}` : t('vnaPage.objectDetail')}
        width={480}
        open={drawerOpen}
        onClose={closeDetail}
        extra={detail && (
          <Space>
            {!detail.wormLocked && (
              <Popconfirm title={t('vnaPage.wormLockTitle')} okText={t('vnaPage.lock')} cancelText={t('vnaPage.cancel')} onConfirm={() => detail && void handleLock(detail)}>
                <Button icon={<Lock size={14} />}>{t('vnaPage.wormLock')}</Button>
              </Popconfirm>
            )}
            <Button type="primary" icon={<Download size={14} />} onClick={() => detail && void handleDownload(detail)}>{t('vnaPage.download')}</Button>
          </Space>
        )}
      >
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered data-testid="vna-object-detail">
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.type')}>
                <Tag color={detail.objectType === 'image' ? 'cyan' : 'orange'}>{t(TYPE_LABEL[detail.objectType])}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.patientId')}>{detail.patientId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.studyUid')}>{detail.studyUid ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.mimeType')}>{detail.mimeType}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.size')}>{formatSize(detail.size)}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.description')}>{detail.description || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.wormStatus')}>
                {detail.wormLocked
                  ? <Tag color="purple" icon={<Lock size={12} />}>{t('vnaPage.lockedNoDelete')}</Tag>
                  : <Tag icon={<LockOpen size={12} />}>{t('vnaPage.unlocked')}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.archivedAt')}>{formatDate(detail.createdAt)}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.storageSource')}>
                <Tag color={detail.storageSource === 'database' ? 'green' : 'default'}>
                  {detail.storageSource === 'database' ? t('vnaPage.database') : t('vnaPage.memoryFallback')}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Text strong>{t('vnaPage.contentPreview')}</Text>
              <div
                style={{
                  marginTop: 8, border: '1px dashed var(--border-color)', borderRadius: 8, padding: 12,
                  minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-card)',
                }}
                data-testid="vna-object-preview"
              >
                {detail.objectType === 'image' ? (
                  previewLoading ? <Text type="secondary">{t('vnaPage.previewLoading')}</Text>
                    : previewUrl ? <img src={previewUrl} alt={detail.name} style={{ maxWidth: '100%', maxHeight: 320 }} />
                    : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('vnaPage.cannotPreview')} />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('vnaPage.nonImagePreview')} />
                )}
              </div>
            </div>
          </>
        )}
      </Drawer>

      {/* [G-26] 分层策略 Modal */}
      <Modal
        title={editingPolicy ? `编辑策略 · ${TIER_LABEL[editingPolicy.tier]}` : t('vnaPage.newTierPolicy')}
        open={policyModalOpen}
        onCancel={() => setPolicyModalOpen(false)}
        onOk={() => void handlePolicySave()}
        confirmLoading={policySaving}
        okText={t('vnaPage.save')}
        cancelText={t('vnaPage.cancel')}
        destroyOnHidden
      >
        <Form form={policyForm} layout="vertical">
          <Form.Item name="tier" label={t('vnaPage.storageTier')} rules={[{ required: true, message: t('vnaPage.tierRequired') }]}>
            <Select
              options={TIER_ORDER.map((tier) => ({ value: tier, label: `${t(TIER_TAG[tier].label)} · ${TIER_LABEL[tier]}` }))}
            />
          </Form.Item>
          <Form.Item name="retentionDays" label={t('vnaPage.retentionDaysLabel')} rules={[{ required: true, message: t('vnaPage.retentionDaysRequired') }]}>
            <InputNumber style={{ width: '100%' }} min={0} max={36500} />
          </Form.Item>
          <Form.Item name="description" label={t('vnaPage.note')}>
            <Input.TextArea rows={2} maxLength={300} placeholder={t('vnaPage.policyDescription')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* [G-26] 对象迁移 Modal */}
      <Modal
        title={t('vnaPage.objectTierMigrate')}
        open={migrateTarget != null}
        onCancel={() => setMigrateTarget(null)}
        onOk={() => void handleMigrate()}
        confirmLoading={migrating}
        okText={t('vnaPage.migrate')}
        cancelText={t('vnaPage.cancel')}
        destroyOnHidden
      >
        {migrateTarget && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('vnaPage.object')}>{migrateTarget.object.name}</Descriptions.Item>
              <Descriptions.Item label={t('vnaPage.currentTier')}>
                <Tag color={TIER_TAG[migrateTarget.object.tier ?? 'hot'].color}>{t(TIER_TAG[migrateTarget.object.tier ?? 'hot'].label)}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <Text>{t('vnaPage.targetTier')}</Text>
            <Select
              style={{ width: '100%' }}
              value={migrateTarget.tier}
              onChange={(tier: VnaLifecycleTier) => setMigrateTarget({ ...migrateTarget, tier })}
              options={TIER_ORDER.map((tier) => ({ value: tier, label: `${t(TIER_TAG[tier].label)} · ${TIER_LABEL[tier]}` }))}
            />
          </Space>
        )}
      </Modal>

      {/* [W10E-3] 完整性校验结果 Modal */}
      <Modal
        title={t('vnaOps.verifyTitle')}
        open={verifyResult != null}
        onCancel={() => setVerifyResult(null)}
        footer={<Button type="primary" onClick={() => setVerifyResult(null)}>{t('vnaOps.close')}</Button>}
        destroyOnHidden
      >
        {verifyResult && (
          <>
            <Alert
              style={{ marginBottom: 16 }}
              type={verifyResult.status === 'integrity-ok' ? 'success' : verifyResult.status === 'size-mismatch' ? 'warning' : 'error'}
              showIcon
              message={verifyResult.status === 'integrity-ok' ? t('vnaOps.verifyOk') : verifyResult.status === 'size-mismatch' ? t('vnaOps.verifyMismatch') : t('vnaOps.verifyMissing')}
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('vnaOps.object')}>{verifyResult.object.name}</Descriptions.Item>
              <Descriptions.Item label={t('vnaOps.checksum')}>
                <Typography.Text code style={{ fontSize: 12 }}>{verifyResult.checksum || '-'}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('vnaOps.actualSize')}>{formatSize(verifyResult.sizeBytes)}</Descriptions.Item>
              <Descriptions.Item label={t('vnaOps.expectedSize')}>{formatSize(verifyResult.expectedSizeBytes)}</Descriptions.Item>
              <Descriptions.Item label={t('vnaOps.verifiedAt')}>{formatDate(verifyResult.verifiedAt)}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  )
}

export default VNADashboardPage

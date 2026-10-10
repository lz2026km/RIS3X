/**
 * [G005 W11-DeviceOps] 设备运维中心
 * Tabs: 工单 / 校准认证 / 资产折旧 / OEE停机 / 成本;DRG
 * 数据源: /device-ops/* (后端内存模块; MSW 确定性兜底)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  Activity, AlertTriangle, CheckCircle, ClipboardList, DollarSign, Gauge,
  Package, RefreshCw, ShieldCheck, Wrench,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, chartDefaults } from '../../components/charts'
import { DataTable, ExportButton, StatCard, StatCardGrid } from "../../components/common"
import { deviceOpsApi } from '../../services/api/deviceOpsApi'
import type {
  Asset, CalibrationRecord, CalibrationStats, CostSummary, DepreciationResult, DrgGroups,
  DowntimeLossRow, OeeDeviceLoss, OeeOverview, OeeTrendPoint,
  WorkOrder, WorkOrderStats,
} from '../../services/api/deviceOpsApi'
import { t } from '../../i18n/appI18n'
import { severityToAntd, toneToAntd } from '../../theme/statusTokens'

const { Text } = Typography

const WO_STATUS_COLOR: Record<string, string> = {
  new: toneToAntd('new'), open: toneToAntd('open'), assigned: toneToAntd('assigned'), in_progress: toneToAntd('in_progress'),
  waiting_parts: toneToAntd('on_hold'), completed: toneToAntd('completed'), closed: toneToAntd('closed'),
}
const WO_STATUS_LABEL: Record<string, string> = {
  new: 'w11Device.wo.statusNew', open: 'w11Device.wo.statusOpen', assigned: 'w11Device.wo.statusAssigned',
  in_progress: 'w11Device.wo.statusInProgress', waiting_parts: 'w11Device.wo.statusWaitingParts',
  completed: 'w11Device.wo.statusCompleted', closed: 'w11Device.wo.statusClosed',
}
const WO_PRI_COLOR: Record<string, string> = { critical: severityToAntd('critical'), high: severityToAntd('high'), medium: severityToAntd('warning'), low: severityToAntd('low') }
const WO_PRI_LABEL: Record<string, string> = {
  critical: 'w11Device.wo.priCritical', high: 'w11Device.wo.priHigh', medium: 'w11Device.wo.priMedium', low: 'w11Device.wo.priLow',
}
const SLA_COLOR: Record<string, string> = { on_track: severityToAntd('success'), at_risk: severityToAntd('warning'), breached: severityToAntd('critical'), met: severityToAntd('success') }
const SLA_LABEL: Record<string, string> = {
  on_track: 'w11Device.wo.slaOnTrack', at_risk: 'w11Device.wo.slaAtRisk', breached: 'w11Device.wo.slaBreached', met: 'w11Device.wo.slaMet',
}
const CAL_DUE_COLOR: Record<string, string> = { overdue: severityToAntd('critical'), due_soon: severityToAntd('warning'), valid: severityToAntd('success'), none: severityToAntd('neutral') }
const CAL_DUE_LABEL: Record<string, string> = {
  overdue: 'w11Device.cal.dueOverdue', due_soon: 'w11Device.cal.dueSoonState', valid: 'w11Device.cal.dueValid', none: 'w11Device.dash',
}
const ASSET_STATUS_COLOR: Record<string, string> = { in_use: severityToAntd('success'), maintenance: severityToAntd('warning'), retired: severityToAntd('neutral'), scrapped: severityToAntd('critical') }
const ASSET_STATUS_LABEL: Record<string, string> = {
  in_use: 'w11Device.asset.statusInUse', maintenance: 'w11Device.asset.statusMaintenance',
  retired: 'w11Device.asset.statusRetired', scrapped: 'w11Device.asset.statusScrapped',
}
const DEVICE_OPTIONS = ['CT-01', 'CT-02', 'MR-01', 'MR-02', 'DR-01', 'DR-02', 'MG-01', 'DSA-01'].map((id) => ({ value: id, label: id }))

const fmtDate = (v?: string) => (v ? String(v).replace('T', ' ').slice(0, 16) : t('w11Device.dash'))
const fmtMoney = (v?: number) => (typeof v === 'number' ? `¥${v.toLocaleString()}` : t('w11Device.dash'))

export default function DeviceOpsCenterPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'api' | 'demo'>('api')

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [woStats, setWoStats] = useState<WorkOrderStats | null>(null)
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([])
  const [calStats, setCalStats] = useState<CalibrationStats | null>(null)
  const [calDue, setCalDue] = useState<CalibrationRecord[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [oeeOverview, setOeeOverview] = useState<OeeOverview | null>(null)
  const [oeeList, setOeeList] = useState<OeeDeviceLoss[]>([])
  const [oeeTrend, setOeeTrend] = useState<OeeTrendPoint[]>([])
  const [downtimeLoss, setDowntimeLoss] = useState<DowntimeLossRow[]>([])
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [drg, setDrg] = useState<DrgGroups | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [advanceWo, setAdvanceWo] = useState<WorkOrder | null>(null)
  const [advanceTo, setAdvanceTo] = useState<string>('')
  const [scheduleAsset, setScheduleAsset] = useState<Asset | null>(null)
  const [schedule, setSchedule] = useState<DepreciationResult | null>(null)
  const [retireAsset, setRetireAsset] = useState<Asset | null>(null)
  const [retireForm] = Form.useForm()

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const [wo, wos, cal, cals, cald, ast, oeeOv, oeeL, oeeT, dtl, cost, drgRes] = await Promise.allSettled([
      deviceOpsApi.listWorkOrders(), deviceOpsApi.getWorkOrderStats(), deviceOpsApi.listCalibrations(),
      deviceOpsApi.getCalibrationStats(), deviceOpsApi.calibrationDue(30), deviceOpsApi.listAssets(),
      deviceOpsApi.getOeeOverview(), deviceOpsApi.listOee(), deviceOpsApi.getOeeTrend(7),
      deviceOpsApi.getDowntimeLoss(), deviceOpsApi.getCostSummary(), deviceOpsApi.listDrg(),
    ])
    const anyReal = [wo, wos, cal, ast, oeeOv, cost, drgRes].some((r) => r.status === 'fulfilled' && r.value.success)
    setSource(anyReal ? 'api' : 'demo')
    if (wo.status === 'fulfilled' && wo.value.success) setWorkOrders(wo.value.data?.items ?? [])
    if (wos.status === 'fulfilled' && wos.value.success) setWoStats(wos.value.data ?? null)
    if (cal.status === 'fulfilled' && cal.value.success) setCalibrations(cal.value.data?.items ?? [])
    if (cals.status === 'fulfilled' && cals.value.success) setCalStats(cals.value.data ?? null)
    if (cald.status === 'fulfilled' && cald.value.success) setCalDue(cald.value.data?.items ?? [])
    if (ast.status === 'fulfilled' && ast.value.success) setAssets(ast.value.data?.items ?? [])
    if (oeeOv.status === 'fulfilled' && oeeOv.value.success) setOeeOverview(oeeOv.value.data ?? null)
    if (oeeL.status === 'fulfilled' && oeeL.value.success) setOeeList(oeeL.value.data?.items ?? [])
    if (oeeT.status === 'fulfilled' && oeeT.value.success) setOeeTrend(oeeT.value.data?.items ?? [])
    if (dtl.status === 'fulfilled' && dtl.value.success) setDowntimeLoss(dtl.value.data?.items ?? [])
    if (cost.status === 'fulfilled' && cost.value.success) setCostSummary(cost.value.data ?? null)
    if (drgRes.status === 'fulfilled' && drgRes.value.success) setDrg(drgRes.value.data ?? null)
    if (!anyReal) setError(t('w11Device.loadFailed'))
    setLoading(false)
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields()
      const res = await deviceOpsApi.createWorkOrder(values)
      if (res.success) {
        message.success(t('w11Device.wo.created'))
        setCreateOpen(false)
        createForm.resetFields()
        void loadAll()
      } else {
        message.error(res.error?.message ?? t('w11Device.wo.createFailed'))
      }
    } catch {
      /* validation */
    }
  }

  const handleAdvance = async () => {
    if (!advanceWo || !advanceTo) return
    const res = await deviceOpsApi.advanceWorkOrder(advanceWo.id, { to: advanceTo as WorkOrder['status'] })
    if (res.success) {
      message.success(t('w11Device.wo.advanced'))
      setAdvanceWo(null)
      setAdvanceTo('')
      void loadAll()
    } else {
      message.error(res.error?.message ?? t('w11Device.wo.advanceFailed'))
    }
  }

  const openSchedule = async (asset: Asset) => {
    setScheduleAsset(asset)
    setSchedule(null)
    const res = await deviceOpsApi.getDepreciation(asset.id)
    if (res.success) setSchedule(res.data ?? null)
  }

  const handleRetire = async () => {
    if (!retireAsset) return
    try {
      const values = await retireForm.validateFields()
      const res = await deviceOpsApi.requestRetirement(retireAsset.id, { type: values.type, reason: values.reason })
      if (res.success) {
        message.success(t('w11Device.asset.retireSubmitted'))
        setRetireAsset(null)
        retireForm.resetFields()
        void loadAll()
      } else {
        message.error(res.error?.message ?? t('w11Device.loadFailed'))
      }
    } catch {
      /* validation */
    }
  }

  const woColumns = [
    { title: t('w11Device.wo.id'), dataIndex: 'id', key: 'id', width: 100 },
    { title: t('w11Device.wo.titleCol'), dataIndex: 'title', key: 'title', ellipsis: true },
    { title: t('w11Device.wo.device'), dataIndex: 'deviceName', key: 'device', width: 200, ellipsis: true },
    { title: t('w11Device.wo.kind'), dataIndex: 'kind', key: 'kind', width: 90, render: (v: string) => <Tag>{t(v === 'fault' ? 'w11Device.wo.kindFault' : 'w11Device.wo.kindMaintenance')}</Tag> },
    { title: t('w11Device.wo.priority'), dataIndex: 'priority', key: 'priority', width: 80, render: (v: string) => <Tag color={WO_PRI_COLOR[v] ?? 'default'}>{t(WO_PRI_LABEL[v] ?? v)}</Tag> },
    { title: t('w11Device.wo.status'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={WO_STATUS_COLOR[v] ?? 'default'}>{t(WO_STATUS_LABEL[v] ?? v)}</Tag> },
    { title: t('w11Device.wo.assignee'), dataIndex: 'assignee', key: 'assignee', width: 90, render: (v: string) => v || t('w11Device.dash') },
    { title: t('w11Device.wo.sla'), dataIndex: 'slaState', key: 'sla', width: 100, render: (v: string) => <Tag color={SLA_COLOR[v] ?? 'default'}>{t(SLA_LABEL[v] ?? v)}</Tag> },
    { title: t('w11Device.wo.dueAt'), dataIndex: 'dueAt', key: 'dueAt', width: 140, render: fmtDate },
    {
      title: t('w11Device.wo.actions'), key: 'actions', width: 100,
      render: (_: unknown, r: WorkOrder) => (
        <Button size="small" type="link" disabled={r.nextStatuses.length === 0} onClick={() => { setAdvanceWo(r); setAdvanceTo(r.nextStatuses[0] ?? '') }}>{t('w11Device.wo.advance')}</Button>
      ),
    },
  ]

  const calColumns = [
    { title: t('w11Device.cal.device'), dataIndex: 'deviceName', key: 'device', ellipsis: true },
    { title: t('w11Device.cal.kind'), dataIndex: 'kind', key: 'kind', width: 100, render: (v: string) => <Tag color={v === 'certification' ? 'purple' : 'blue'}>{t(v === 'certification' ? 'w11Device.cal.kindCertification' : 'w11Device.cal.kindCalibration')}</Tag> },
    { title: t('w11Device.cal.standard'), dataIndex: 'standard', key: 'standard', ellipsis: true },
    { title: t('w11Device.cal.nextDue'), dataIndex: 'nextDue', key: 'nextDue', width: 120, render: (v: string) => String(v).slice(0, 10) },
    { title: t('w11Device.cal.result'), dataIndex: 'result', key: 'result', width: 100, render: (v: string) => {
      const color = v === 'fail' ? 'red' : v === 'pass' ? 'green' : 'orange'
      const label = v === 'fail' ? 'w11Device.cal.resultFail' : v === 'pass' ? 'w11Device.cal.resultPass' : 'w11Device.cal.resultPending'
      return <Tag color={color}>{t(label)}</Tag>
    } },
    { title: t('w11Device.cal.dueState'), dataIndex: 'dueState', key: 'dueState', width: 110, render: (v: string) => <Tag color={CAL_DUE_COLOR[v] ?? 'default'}>{t(CAL_DUE_LABEL[v] ?? v)}</Tag> },
    { title: t('w11Device.cal.daysRemaining'), dataIndex: 'daysRemaining', key: 'days', width: 90, render: (v: number) => <span style={{ color: v < 0 ? 'var(--color-error-600)' : v <= 30 ? 'var(--color-warning-600)' : undefined }}>{v}</span> },
    { title: t('w11Device.cal.certNo'), dataIndex: 'certNo', key: 'certNo', width: 150 },
    { title: t('w11Device.cal.lab'), dataIndex: 'lab', key: 'lab', width: 120 },
  ]

  const assetColumns = [
    { title: t('w11Device.asset.device'), dataIndex: 'deviceName', key: 'device', ellipsis: true },
    { title: t('w11Device.asset.vendor'), dataIndex: 'vendor', key: 'vendor', width: 150 },
    { title: t('w11Device.asset.cost'), dataIndex: 'procurementCost', key: 'cost', width: 130, render: fmtMoney, sorter: (a: Asset, b: Asset) => a.procurementCost - b.procurementCost },
    { title: t('w11Device.asset.bookValue'), dataIndex: 'bookValue', key: 'bookValue', width: 130, render: fmtMoney },
    { title: t('w11Device.asset.accumulated'), dataIndex: 'accumulatedDepreciation', key: 'accumulated', width: 130, render: fmtMoney },
    { title: t('w11Device.asset.method'), dataIndex: 'method', key: 'method', width: 130, render: (v: string) => <Tag>{t(v === 'declining' ? 'w11Device.asset.declining' : 'w11Device.asset.straightLine')}</Tag> },
    { title: t('w11Device.asset.warrantyEnd'), dataIndex: 'warrantyEnd', key: 'warrantyEnd', width: 120, render: (v: string, r: Asset) => <span style={{ color: r.warrantyDaysRemaining < 0 ? 'var(--color-error-600)' : r.warrantyDaysRemaining <= 90 ? 'var(--color-warning-600)' : undefined }}>{String(v).slice(0, 10)}</span> },
    { title: t('w11Device.asset.status'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={ASSET_STATUS_COLOR[v] ?? 'default'}>{t(ASSET_STATUS_LABEL[v] ?? v)}</Tag> },
    {
      title: t('w11Device.asset.actions'), key: 'actions', width: 160,
      render: (_: unknown, r: Asset) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => void openSchedule(r)}>{t('w11Device.asset.viewSchedule')}</Button>
          <Button size="small" type="link" danger disabled={r.status === 'scrapped' || r.retirementStatus === 'pending'} onClick={() => { setRetireAsset(r); retireForm.setFieldsValue({ type: 'retire', reason: '' }) }}>{t('w11Device.asset.requestRetire')}</Button>
        </Space>
      ),
    },
  ]

  const oeeColumns = [
    { title: t('w11Device.oee.device'), dataIndex: 'deviceName', key: 'device', ellipsis: true },
    { title: 'Modality', dataIndex: 'modality', key: 'modality', width: 90 },
    { title: t('w11Device.oee.availability'), dataIndex: 'availability', key: 'availability', width: 120, render: (v: number) => <Progress percent={v} size="small" strokeColor={v < 70 ? 'var(--color-error-600)' : 'var(--color-primary-600)'} /> },
    { title: t('w11Device.oee.performance'), dataIndex: 'performance', key: 'performance', width: 120, render: (v: number) => <Progress percent={v} size="small" strokeColor="var(--color-info-600)" /> },
    { title: t('w11Device.oee.quality'), dataIndex: 'quality', key: 'quality', width: 120, render: (v: number) => <Progress percent={v} size="small" strokeColor="var(--color-success-600)" /> },
    { title: t('w11Device.oee.oee'), dataIndex: 'oee', key: 'oee', width: 90, sorter: (a: OeeDeviceLoss, b: OeeDeviceLoss) => a.oee - b.oee, render: (v: number) => <span style={{ fontWeight: 700, color: v >= 70 ? 'var(--color-success-600)' : v >= 50 ? 'var(--color-warning-600)' : 'var(--color-error-600)' }}>{v}%</span> },
    { title: t('w11Device.oee.loss'), dataIndex: 'downtimeMinutes', key: 'downtime', width: 110, render: (v: number) => `${v} min` },
  ]

  const trendData = useMemo(() => oeeTrend.map((p) => ({ ...p, label: p.date.slice(5) })), [oeeTrend])
  const lossData = useMemo(() => downtimeLoss.map((d) => ({
    name: (d.deviceName.split('(')[0] ?? d.deviceName).trim(),
    planned: d.loss.planned, unplanned: d.loss.unplanned, changeover: d.loss.changeover, idle: d.loss.idle, smallStop: d.loss.smallStop,
  })), [downtimeLoss])

  const costColumns = [
    { title: t('w11Device.cost.modality'), dataIndex: 'modality', key: 'modality', width: 100 },
    { title: t('w11Device.cost.volume'), dataIndex: 'volume', key: 'volume', width: 100, render: (v: number) => v.toLocaleString() },
    { title: t('w11Device.cost.revenue'), dataIndex: 'revenue', key: 'revenue', width: 130, render: fmtMoney },
    { title: t('w11Device.cost.cost'), dataIndex: 'cost', key: 'cost', width: 130, render: fmtMoney },
    { title: t('w11Device.cost.margin'), dataIndex: 'margin', key: 'margin', width: 130, render: (v: number) => <span style={{ color: v >= 0 ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>{fmtMoney(v)}</span> },
    { title: t('w11Device.cost.marginPct'), dataIndex: 'marginPct', key: 'marginPct', width: 100, render: (v: number) => `${v}%` },
    { title: t('w11Device.cost.unitCost'), dataIndex: 'unitCost', key: 'unitCost', width: 110, render: fmtMoney },
  ]

  const drgColumns = [
    { title: t('w11Device.drg.code'), dataIndex: 'drgCode', key: 'code', width: 90 },
    { title: t('w11Device.drg.name'), dataIndex: 'name', key: 'name', ellipsis: true },
    { title: t('w11Device.drg.mdc'), dataIndex: 'mdc', key: 'mdc', width: 100 },
    { title: t('w11Device.drg.weight'), dataIndex: 'weight', key: 'weight', width: 80 },
    { title: t('w11Device.drg.cases'), dataIndex: 'cases', key: 'cases', width: 80 },
    { title: t('w11Device.drg.totalWeight'), dataIndex: 'totalWeight', key: 'tw', width: 100, render: (v: number) => v.toLocaleString() },
    { title: t('w11Device.drg.payment'), dataIndex: 'payment', key: 'payment', width: 130, render: fmtMoney },
    { title: t('w11Device.cost.margin'), dataIndex: 'margin', key: 'margin', width: 130, render: (v: number) => <span style={{ color: v >= 0 ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>{fmtMoney(v)}</span> },
    { title: t('w11Device.cost.marginPct'), dataIndex: 'marginPct', key: 'marginPct', width: 100, render: (v: number) => `${v}%` },
  ]

  const workOrderTab = (
    <>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('w11Device.wo.total')} value={woStats?.total ?? 0} loading={loading} color="primary" icon={<ClipboardList size={18} />} />
        <StatCard title={t('w11Device.wo.active')} value={woStats?.active ?? 0} loading={loading} color="primary" icon={<Activity size={18} />} />
        <StatCard title={t('w11Device.wo.overdue')} value={woStats?.overdue ?? 0} loading={loading} color="error" icon={<AlertTriangle size={18} />} />
        <StatCard title={t('w11Device.wo.slaCompliance')} value={woStats?.slaCompliancePct ?? 0} suffix="%" loading={loading} color="success" icon={<CheckCircle size={18} />} />
        <StatCard title={t('w11Device.wo.avgResolution')} value={woStats?.avgResolutionHours ?? 0} suffix="h" loading={loading} color="primary" />
        <StatCard title={t('w11Device.wo.partsCost')} value={woStats?.partsCost ?? 0} prefix="¥" loading={loading} color="warning" icon={<DollarSign size={18} />} />
      </StatCardGrid>
      <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
        <Button type="primary" icon={<ClipboardList size={14} />} onClick={() => setCreateOpen(true)}>{t('w11Device.wo.newWorkOrder')}</Button>
      </div>
      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={workOrders}
        columns={woColumns}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        expandable={{
          expandedRowRender: (r: WorkOrder) => (
            <Space orientation="vertical" size={2} style={{ fontSize: 12 }}>
              <Text type="secondary">{r.description}</Text>
              <Text type="secondary">{t('w11Device.wo.timeline')}: {r.timeline.map((e) => `${String(e.at).slice(5, 16)} ${t(WO_STATUS_LABEL[e.status] ?? '') || e.status}`).join(' → ')}</Text>
            </Space>
          ),
        }}
      />
    </>
  )

  const calibrationTab = (
    <>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('w11Device.cal.total')} value={calStats?.total ?? 0} loading={loading} color="primary" icon={<ShieldCheck size={18} />} />
        <StatCard title={t('w11Device.cal.overdue')} value={calStats?.overdue ?? 0} loading={loading} color="error" icon={<AlertTriangle size={18} />} />
        <StatCard title={t('w11Device.cal.dueSoon')} value={calStats?.dueSoon ?? 0} loading={loading} color="warning" />
        <StatCard title={t('w11Device.cal.failureRate')} value={calStats?.failureRatePct ?? 0} suffix="%" loading={loading} color="primary" icon={<Gauge size={18} />} />
        <StatCard title={t('w11Device.cal.due')} value={calDue.length} loading={loading} color="primary" />
      </StatCardGrid>
      {calDue.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 'var(--space-3, 12px)' }}
          message={`${t('w11Device.cal.due')}: ${calDue.length}`}
          description={calDue.slice(0, 4).map((c) => `${c.deviceName} · ${c.standard}`).join('；')}
        />
      )}
      <DataTable rowKey="id" loading={loading} dataSource={calibrations} columns={calColumns} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: false }} />
    </>
  )

  const assetTab = (
    <>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('w11Device.asset.total')} value={assets.length} loading={loading} color="primary" icon={<Package size={18} />} />
        <StatCard title={t('w11Device.asset.procurement')} value={assets.reduce((s, a) => s + a.procurementCost, 0)} prefix="¥" loading={loading} color="primary" icon={<DollarSign size={18} />} />
        <StatCard title={t('w11Device.asset.bookValue')} value={assets.reduce((s, a) => s + a.bookValue, 0)} prefix="¥" loading={loading} color="success" icon={<DollarSign size={18} />} />
        <StatCard title={t('w11Device.asset.accumulated')} value={assets.reduce((s, a) => s + a.accumulatedDepreciation, 0)} prefix="¥" loading={loading} color="warning" icon={<DollarSign size={18} />} />
        <StatCard title={t('w11Device.asset.warrantyExpiring')} value={assets.filter((a) => a.warrantyDaysRemaining >= 0 && a.warrantyDaysRemaining <= 90).length} loading={loading} color="error" icon={<AlertTriangle size={18} />} />
      </StatCardGrid>
      <DataTable rowKey="id" loading={loading} dataSource={assets} columns={assetColumns} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: false }} />
    </>
  )

  const oeeTab = (
    <>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('w11Device.oee.avgOee')} value={oeeOverview?.avgOee ?? 0} suffix="%" loading={loading} color="primary" icon={<Gauge size={18} />} />
        <StatCard title={t('w11Device.oee.availability')} value={oeeOverview?.avgAvailability ?? 0} suffix="%" loading={loading} color="primary" icon={<Activity size={18} />} />
        <StatCard title={t('w11Device.oee.performance')} value={oeeOverview?.avgPerformance ?? 0} suffix="%" loading={loading} color="primary" icon={<Gauge size={18} />} />
        <StatCard title={t('w11Device.oee.quality')} value={oeeOverview?.avgQuality ?? 0} suffix="%" loading={loading} color="success" icon={<CheckCircle size={18} />} />
        <StatCard title={t('w11Device.oee.downtimeHours')} value={oeeOverview?.totalDowntimeHours ?? 0} suffix="h" loading={loading} color="error" icon={<AlertTriangle size={18} />} />
        <StatCard title={t('w11Device.oee.best')} value={oeeOverview?.bestDevice?.name ?? t('w11Device.dash')} loading={loading} color="success" />
      </StatCardGrid>
      <Row gutter={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Col span={12}>
          <Card size="small" title={t('w11Device.oee.trend')}>
            {trendData.length > 0 ? (
              <ChartContainer type="line" height={240}>
                <LineChart data={trendData} margin={chartDefaults.margin}>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis dataKey="label" {...chartDefaults.axis} />
                  <YAxis domain={[0, 100]} {...chartDefaults.axis} />
                  <RTooltip {...chartDefaults.tooltip} />
                  <Legend />
                  <Line type="monotone" dataKey="oee" name="OEE" stroke="var(--color-primary-600)" strokeWidth={2} />
                  <Line type="monotone" dataKey="availability" name={t('w11Device.oee.availability')} stroke="var(--color-success-600)" dot={false} />
                  <Line type="monotone" dataKey="performance" name={t('w11Device.oee.performance')} stroke="var(--color-info-600)" dot={false} />
                  <Line type="monotone" dataKey="quality" name={t('w11Device.oee.quality')} stroke="var(--color-warning-600)" dot={false} />
                </LineChart>
              </ChartContainer>
            ) : <Text type="secondary">{t('w11Device.noData')}</Text>}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={t('w11Device.oee.lossBreakdown')}>
            {lossData.length > 0 ? (
              <ChartContainer type="bar" height={240}>
                <BarChart data={lossData} margin={chartDefaults.margin}>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis dataKey="name" {...chartDefaults.axis} />
                  <YAxis {...chartDefaults.axis} />
                  <RTooltip {...chartDefaults.tooltip} />
                  <Legend />
                  <Bar dataKey="planned" stackId="a" name={t('w11Device.oee.planned')} fill="#93c5fd" />
                  <Bar dataKey="unplanned" stackId="a" name={t('w11Device.oee.unplanned')} fill="var(--color-error-500)" />
                  <Bar dataKey="changeover" stackId="a" name={t('w11Device.oee.changeover')} fill="var(--color-warning-500)" />
                  <Bar dataKey="idle" stackId="a" name={t('w11Device.oee.idle')} fill="#a3a3a3" />
                  <Bar dataKey="smallStop" stackId="a" name={t('w11Device.oee.smallStop')} fill="#8b5cf6" />
                </BarChart>
              </ChartContainer>
            ) : <Text type="secondary">{t('w11Device.noData')}</Text>}
          </Card>
        </Col>
      </Row>
      <DataTable rowKey="deviceId" loading={loading} dataSource={oeeList} columns={oeeColumns} scroll={{ x: 'max-content' }} pagination={false} />
    </>
  )

  const costTab = (
    <>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('w11Device.cost.totalRevenue')} value={costSummary?.totalRevenue ?? 0} prefix="¥" loading={loading} color="primary" icon={<DollarSign size={18} />} />
        <StatCard title={t('w11Device.cost.totalCost')} value={costSummary?.totalCost ?? 0} prefix="¥" loading={loading} color="warning" icon={<DollarSign size={18} />} />
        <StatCard title={t('w11Device.cost.totalMargin')} value={costSummary?.margin.margin ?? 0} prefix="¥" loading={loading} color="success" icon={<DollarSign size={18} />} />
        <StatCard title={t('w11Device.cost.marginPct')} value={costSummary?.margin.marginPct ?? 0} suffix="%" loading={loading} color="primary" icon={<Gauge size={18} />} />
      </StatCardGrid>
      <Card size="small" title={t('w11Device.cost.byModality')} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <DataTable rowKey="modality" loading={loading} dataSource={costSummary?.byModality ?? []} columns={costColumns} pagination={false} scroll={{ x: 'max-content' }} />
      </Card>
      <Card size="small" title={t('w11Device.drg.title')} extra={<Text type="secondary">{t('w11Device.drg.baseRate')}: ¥{drg?.baseRate ?? 0}</Text>}>
        <DataTable rowKey="drgCode" loading={loading} dataSource={drg?.items ?? []} columns={drgColumns} pagination={false} scroll={{ x: 'max-content' }} />
      </Card>
    </>
  )

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-card)', minHeight: 'calc(100vh - 56px)' }}>
      <Card style={{ background: 'linear-gradient(135deg,#0f766e 0%,var(--color-primary-600) 100%)', color: '#fff', border: 'none', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={16}>
            <Wrench size={34} color="#fff" />
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{t('w11Device.title')}</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 'var(--space-1, 4px)' }}>{t('w11Device.subtitle')}</div>
            </div>
          </Space>
          <Space>
            <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('w11Device.sourceApi') : t('w11Device.sourceDemo')}</Tag>
            <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void loadAll()}>{t('w11Device.refresh')}</Button>
            <ExportButton data={() => workOrders} filename="device-ops-work-orders" label={t('w11Device.export')} size="small" formats={['csv', 'json']} />
          </Space>
        </div>
      </Card>

      {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 'var(--space-3, 12px)' }} action={<Button size="small" onClick={() => void loadAll()}>{t('w11Device.retry')}</Button>} />}

      <Card>
        <Tabs
          items={[
            { key: 'workOrders', label: <><ClipboardList size={14} /> {t('w11Device.tabWorkOrders')}</>, children: workOrderTab },
            { key: 'calibration', label: <><ShieldCheck size={14} /> {t('w11Device.tabCalibration')}</>, children: calibrationTab },
            { key: 'assets', label: <><Package size={14} /> {t('w11Device.tabAssets')}</>, children: assetTab },
            { key: 'oee', label: <><Gauge size={14} /> {t('w11Device.tabOee')}</>, children: oeeTab },
            { key: 'cost', label: <><DollarSign size={14} /> {t('w11Device.tabCost')}</>, children: costTab },
          ]}
        />
      </Card>

      <Modal title={t('w11Device.wo.newWorkOrder')} open={createOpen} onOk={() => void handleCreate()} onCancel={() => setCreateOpen(false)} okText={t('w11Device.wo.submit')} cancelText={t('w11Device.wo.cancel')} destroyOnHidden>
        <Form form={createForm} layout="vertical" initialValues={{ kind: 'fault', priority: 'medium', deviceId: 'CT-01' }}>
          <Form.Item name="kind" label={t('w11Device.wo.kind')} rules={[{ required: true }]}>
            <Select options={[{ value: 'fault', label: t('w11Device.wo.kindFault') }, { value: 'maintenance', label: t('w11Device.wo.kindMaintenance') }]} />
          </Form.Item>
          <Form.Item name="title" label={t('w11Device.wo.titleCol')} rules={[{ required: true, message: t('w11Device.wo.titleCol') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="deviceId" label={t('w11Device.wo.device')} rules={[{ required: true }]}>
            <Select showSearch options={DEVICE_OPTIONS} />
          </Form.Item>
          <Form.Item name="priority" label={t('w11Device.wo.priority')}>
            <Select options={['critical', 'high', 'medium', 'low'].map((v) => ({ value: v, label: t(WO_PRI_LABEL[v] ?? v) }))} />
          </Form.Item>
          <Form.Item name="assignee" label={t('w11Device.wo.assignee')}>
            <Input placeholder={t('w11Device.wo.assigneePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('w11Device.wo.titleCol')}>
            <Input.TextArea rows={3} placeholder={t('w11Device.wo.descPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${t('w11Device.wo.advance')} · ${advanceWo?.id ?? ''}`} open={!!advanceWo} onOk={() => void handleAdvance()} onCancel={() => { setAdvanceWo(null); setAdvanceTo('') }} okText={t('w11Device.wo.advance')} cancelText={t('w11Device.wo.cancel')}>
        <Descriptions column={1} size="small" style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <Descriptions.Item label={t('w11Device.wo.titleCol')}>{advanceWo?.title}</Descriptions.Item>
          <Descriptions.Item label={t('w11Device.wo.status')}>{advanceWo ? t(WO_STATUS_LABEL[advanceWo.status] ?? advanceWo.status) : ''}</Descriptions.Item>
        </Descriptions>
        <Select style={{ width: '100%' }} value={advanceTo || undefined} onChange={setAdvanceTo}
          placeholder={t('w11Device.wo.advanceTo')}
          options={(advanceWo?.nextStatuses ?? []).map((s) => ({ value: s, label: t(WO_STATUS_LABEL[s] ?? s) }))} />
      </Modal>

      <Drawer title={t('w11Device.asset.scheduleTitle', { name: scheduleAsset?.deviceName ?? '' })} open={!!scheduleAsset} onClose={() => { setScheduleAsset(null); setSchedule(null) }} width={720}>
        {schedule && (
          <>
            <Row gutter={16} style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Col span={8}><Statistic title={t('w11Device.asset.cost')} value={schedule.cost} prefix="¥" /></Col>
              <Col span={8}><Statistic title={t('w11Device.asset.currentBookValue')} value={schedule.currentBookValue} prefix="¥" styles={{ content: { color: 'var(--color-success-600)' } }} /></Col>
              <Col span={8}><Statistic title={t('w11Device.asset.residual')} value={schedule.residualValue} prefix="¥" /></Col>
            </Row>
            <Text type="secondary">{t('w11Device.asset.method')}: {t(schedule.method === 'declining' ? 'w11Device.asset.declining' : 'w11Device.asset.straightLine')} · {schedule.usefulLifeMonths} 月 · 首月 {fmtMoney(schedule.firstMonthDepreciation)}</Text>
            <DataTable
              rowKey="month" style={{ marginTop: 'var(--space-3, 12px)' }} pagination={{ pageSize: 12, showSizeChanger: false }}
              dataSource={schedule.schedule}
              columns={[
                { title: t('w11Device.asset.month'), dataIndex: 'month', key: 'month', width: 90 },
                { title: t('w11Device.asset.opening'), dataIndex: 'openingValue', key: 'opening', render: fmtMoney },
                { title: t('w11Device.asset.depreciation'), dataIndex: 'depreciation', key: 'depreciation', render: fmtMoney },
                { title: t('w11Device.asset.accumulatedCol'), dataIndex: 'accumulated', key: 'accumulated', render: fmtMoney },
                { title: t('w11Device.asset.closing'), dataIndex: 'closingValue', key: 'closing', render: fmtMoney },
              ]}
            />
          </>
        )}
        {!schedule && <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)' }}><Activity className="spin" /><Text type="secondary"> {t('w11Device.loading')}</Text></div>}
      </Drawer>

      <Modal title={`${t('w11Device.asset.requestRetire')} · ${retireAsset?.deviceName ?? ''}`} open={!!retireAsset} onOk={() => void handleRetire()} onCancel={() => setRetireAsset(null)} okText={t('w11Device.asset.submitRetire')} cancelText={t('w11Device.wo.cancel')} destroyOnHidden>
        <Form form={retireForm} layout="vertical" initialValues={{ type: 'retire' }}>
          <Form.Item name="type" label={t('w11Device.wo.kind')}>
            <Select options={[{ value: 'retire', label: t('w11Device.asset.statusRetired') }, { value: 'scrap', label: t('w11Device.asset.statusScrapped') }]} />
          </Form.Item>
          <Form.Item name="reason" label={t('w11Device.asset.retireReason')} rules={[{ required: true, message: t('w11Device.asset.retireReason') }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <div style={{ marginTop: 'var(--space-4, 16px)', fontSize: 12, color: '#94a3b8' }}>
        <Space><CheckCircle size={12} />{t('w11Device.subtitle')}</Space>
        <span style={{ marginLeft: 'var(--space-4, 16px)' }}><AlertTriangle size={12} /> {t('w11Device.wo.slaBreached')}: {workOrders.filter((w) => w.slaState === 'breached').length}</span>
      </div>
    </div>
  )
}

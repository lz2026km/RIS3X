import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Monitor, Wrench, AlertTriangle, Search, Plus,
  X, Trash2, CheckCircle, Clock, Save,
  ClipboardList, Edit3, Eye, DollarSign,
} from 'lucide-react'
import { deviceMgmtApi, type EquipmentLifecycle } from '../services/api/deviceMgmtApi'
import { oeeApi } from '../services/api/oeeApi'
import { Card, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { PageHeader } from '../components/common/PageHeader'
import { DataTable } from '../components/common'
import { ChartContainer } from '../components/charts'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { t } from '../i18n/appI18n'
import { uniqueId } from '../utils/uniqueId'

// ===== 演示数据：放射科设备全生命周期数据 =====
const mockDevices = [
  { id: 'CT001', name: 'CT SOMATOM Force', model: 'SOMATOM Force', serial: 'SN2021CTF001', vendor: '西门子', purchaseDate: '2021-06-15', dept: 'CT室', status: '在用', useCount: 12840, lastUse: '2026-04-30', nextMaint: '2026-05-20', lifeMonth: 58, deptRate: 92, totalCost: 1680000, maintCost: 125000, spareCost: 32000 },
  { id: 'CT002', name: 'CT SOMATOM Spark', model: 'SOMATOM Spark', serial: 'SN2022CTS002', vendor: '西门子', purchaseDate: '2022-11-10', dept: 'CT室', status: '在用', useCount: 8650, lastUse: '2026-04-30', nextMaint: '2026-06-15', lifeMonth: 42, deptRate: 78, totalCost: 1450000, maintCost: 68000, spareCost: 18000 },
  { id: 'MR001', name: 'MRI Prisma 3T', model: 'Prisma 3T', serial: 'SN2020MRP001', vendor: '西门子', purchaseDate: '2020-09-20', dept: 'MRI室', status: '在用', useCount: 9820, lastUse: '2026-04-30', nextMaint: '2026-05-10', lifeMonth: 67, deptRate: 88, totalCost: 3200000, maintCost: 186000, spareCost: 56000 },
  { id: 'MR002', name: 'MRI Signa Premier', model: 'Signa Premier', serial: 'SN2021MSG001', vendor: 'GE', purchaseDate: '2021-03-25', dept: 'MRI室', status: '维保中', useCount: 7540, lastUse: '2026-04-28', nextMaint: '2026-05-05', lifeMonth: 61, deptRate: 72, totalCost: 2980000, maintCost: 95000, spareCost: 28000 },
  { id: 'DS001', name: 'DSA Artis Zee', model: 'Artis Zee', serial: 'SN2019DSA001', vendor: '西门子', purchaseDate: '2019-07-08', dept: '导管室', status: '在用', useCount: 4280, lastUse: '2026-04-30', nextMaint: '2026-05-25', lifeMonth: 82, deptRate: 85, totalCost: 2450000, maintCost: 168000, spareCost: 72000 },
  { id: 'DS002', name: 'DSA Azurion', model: 'Azurion 7M20', serial: 'SN2022AZU001', vendor: '飞利浦', purchaseDate: '2022-04-18', dept: '导管室', status: '在用', useCount: 3120, lastUse: '2026-04-30', nextMaint: '2026-07-01', lifeMonth: 48, deptRate: 65, totalCost: 2680000, maintCost: 42000, spareCost: 12000 },
  { id: 'DR001', name: 'DR/CR 系统', model: 'DigitalDiagnost', serial: 'SN2020DR001', vendor: '飞利浦', purchaseDate: '2020-12-01', dept: '放射科', status: '在用', useCount: 18650, lastUse: '2026-04-30', nextMaint: '2026-06-20', lifeMonth: 64, deptRate: 95, totalCost: 890000, maintCost: 48000, spareCost: 15000 },
  { id: 'DR002', name: '移动DR', model: 'Optima XR240', serial: 'SN2021DR002', vendor: 'GE', purchaseDate: '2021-08-14', dept: '急诊科', status: '空闲', useCount: 5680, lastUse: '2026-04-25', nextMaint: '2026-08-01', lifeMonth: 56, deptRate: 48, totalCost: 720000, maintCost: 22000, spareCost: 8000 },
  { id: 'MG001', name: '乳腺钼靶 Pristina', model: 'Senographe Pristina', serial: 'SN2021MG001', vendor: 'GE', purchaseDate: '2021-05-22', dept: '乳腺科', status: '在用', useCount: 3890, lastUse: '2026-04-30', nextMaint: '2026-05-30', lifeMonth: 59, deptRate: 68, totalCost: 1180000, maintCost: 56000, spareCost: 18000 },
  { id: 'MG002', name: '乳腺钼靶 Nuance', model: 'Senographe Nuance', serial: 'SN2019MG002', vendor: 'GE', purchaseDate: '2019-11-30', dept: '乳腺科', status: '在用', useCount: 6240, lastUse: '2026-04-29', nextMaint: '2026-05-08', lifeMonth: 77, deptRate: 82, totalCost: 980000, maintCost: 82000, spareCost: 35000 },
  { id: 'CT003', name: 'CT 大孔径', model: 'SOMATOM Drive', serial: 'SN2018CTD001', vendor: '西门子', purchaseDate: '2018-03-15', dept: 'CT室', status: '已报废', useCount: 18260, lastUse: '2024-12-31', nextMaint: '-', lifeMonth: 98, deptRate: 100, totalCost: 2200000, maintCost: 420000, spareCost: 185000 },
  { id: 'MR003', name: 'MRI 1.5T', model: 'Optima MR360', serial: 'SN2022MR001', vendor: 'GE', purchaseDate: '2022-09-10', dept: 'MRI室', status: '在用', useCount: 4200, lastUse: '2026-04-30', nextMaint: '2026-09-15', lifeMonth: 43, deptRate: 55, totalCost: 1680000, maintCost: 28000, spareCost: 9000 },
]

const maintenanceRecords = [
  { date: '2026-04-15', device: 'MR002', type: '故障维修', cost: 45000, vendor: 'GE维修站', result: '已修复' },
  { date: '2026-04-10', device: 'CT001', type: '常规保养', cost: 28000, vendor: '西门子维修站', result: '合格' },
  { date: '2026-03-28', device: 'MR001', type: '常规保养', cost: 32000, vendor: '西门子维修站', result: '合格' },
  { date: '2026-03-20', device: 'DS001', type: '配件更换', cost: 68000, vendor: '西门子维修站', result: '已修复' },
  { date: '2026-03-05', device: 'MG002', type: '常规保养', cost: 18000, vendor: 'GE维修站', result: '合格' },
  { date: '2026-02-25', device: 'CT003', type: '评估报告', cost: 0, vendor: '设备科', result: '建议报废' },
  { date: '2026-02-10', device: 'DR001', type: '常规保养', cost: 12000, vendor: '飞利浦维修站', result: '合格' },
  { date: '2026-01-28', device: 'DS002', type: '故障维修', cost: 22000, vendor: '飞利浦维修站', result: '已修复' },
]

// [G005 Wave4A P1] 维保计划回退数据 (真实 API 不可用时展示)
const mockMaintPlans = [
  { id: 'MP-M1', deviceId: 'MR001', deviceName: 'MRI Prisma 3T', type: '故障维修', maintenanceDate: '2026-05-05', assignee: '西门子维修站', estimatedCost: 32000, status: 'PENDING', content: '故障维修' },
  { id: 'MP-M2', deviceId: 'MR002', deviceName: 'MRI Signa Premier', type: '故障维修', maintenanceDate: '2026-05-05', assignee: 'GE维修站', estimatedCost: 45000, status: 'PENDING', content: '故障维修' },
  { id: 'MP-M3', deviceId: 'CT001', deviceName: 'CT SOMATOM Force', type: '常规保养', maintenanceDate: '2026-05-20', assignee: '西门子维修站', estimatedCost: 28000, status: 'PENDING', content: '常规保养' },
  { id: 'MP-M4', deviceId: 'MG002', deviceName: '乳腺钼靶 Nuance', type: '常规保养', maintenanceDate: '2026-05-08', assignee: 'GE维修站', estimatedCost: 18000, status: 'PENDING', content: '常规保养' },
  { id: 'MP-M5', deviceId: 'DS001', deviceName: 'DSA Artis Zee', type: '常规保养', maintenanceDate: '2026-05-25', assignee: '西门子维修站', estimatedCost: 35000, status: 'PENDING', content: '常规保养' },
  { id: 'MP-M6', deviceId: 'CT002', deviceName: 'CT SOMATOM Spark', type: '常规保养', maintenanceDate: '2026-06-15', assignee: '西门子维修站', estimatedCost: 22000, status: 'PENDING', content: '常规保养' },
  { id: 'MP-M7', deviceId: 'DR001', deviceName: 'DR/CR 系统', type: '常规保养', maintenanceDate: '2026-06-20', assignee: '飞利浦维修站', estimatedCost: 12000, status: 'PENDING', content: '常规保养' },
  { id: 'MP-M8', deviceId: 'MG001', deviceName: '乳腺钼靶 Pristina', type: '常规保养', maintenanceDate: '2026-05-30', assignee: 'GE维修站', estimatedCost: 16000, status: 'PENDING', content: '常规保养' },
]

// ===== 样式 =====
const s = {
  root: { padding: 'var(--space-8, 32px)' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-6, 24px)' },
  // 统计卡片区
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)' },
  statCard: { background: 'var(--bg-card)', borderRadius: 10, padding: 'var(--space-5, 20px)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)' },
  statValue: { fontSize: 30, fontWeight: 700, color: 'var(--color-primary-800)' },
  statSub: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' },
  statGreen: { color: 'var(--color-success-600)' },
  statOrange: { color: 'var(--color-warning-600)' },
  statRed: { color: 'var(--color-error-600)' },
  statBlue: { color: 'var(--color-primary-600)' },
  // 操作区
  toolbar: { display: 'flex', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)', flexWrap: 'wrap' as const, alignItems: 'center' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 14px', flex: '0 0 280px' },
  searchInput: { border: 'none', fontSize: 14, flex: 1, background: 'transparent' },
  select: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', fontSize: 14,},
  btn: { padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', minHeight: 44 },
  btnPrimary: { background: 'var(--color-primary-700)', color: '#fff' },
  btnSuccess: { background: 'var(--color-success-600)', color: '#fff' },
  btnWarning: { background: 'var(--color-warning-600)', color: '#fff' },
  btnDanger: { background: 'var(--color-error-600)', color: '#fff' },
  btnGhost: { background: 'var(--bg-card)', color: 'var(--text-secondary)' },
  // 表格
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  th: { background: 'var(--bg-card)', padding: '12px 16px', textAlign: 'left' as const, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' },
  td: { padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' },
  // 状态标签
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  badgeGreen: { background: 'var(--color-success-bg)', color: 'var(--color-success-600)' },
  badgeBlue: { background: 'var(--color-info-bg)', color: 'var(--color-primary-600)' },
  badgeOrange: { background: 'var(--color-warning-bg)', color: 'var(--color-warning-600)' },
  badgeGray: { background: 'var(--bg-card)', color: 'var(--text-secondary)' },
  badgeRed: { background: 'var(--color-error-bg)', color: 'var(--color-error-600)' },
  // 详情弹窗
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalContent: { background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: 700, maxHeight: '85vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-5, 20px)' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' },
  detailItem: { padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8 },
  detailLabel: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' },
  detailValue: { fontSize: 14, fontWeight: 600, color: 'var(--color-primary-800)' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginTop: 'var(--space-5, 20px)', marginBottom: 'var(--space-3, 12px)', paddingBottom: 'var(--space-2, 8px)', borderBottom: '2px solid var(--border-color)' },
  progressBar: { height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s' },
  costRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 14 },
  // 维保计划
  maintAlert: { background: 'var(--bg-card)', borderRadius: 10, padding: 'var(--space-5, 20px)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 'var(--space-6, 24px)' },
  alertTitle: { fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' },
  alertGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)' },
  alertCard: { padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  alertName: { fontSize: 14, fontWeight: 600, color: 'var(--color-primary-800)' },
  alertDate: { fontSize: 12, color: 'var(--color-error-600)', fontWeight: 600, marginTop: 'var(--space-1, 4px)' },
  // 标签页
  tabs: { display: 'flex', gap: 0, marginBottom: 'var(--space-5, 20px)', borderBottom: '2px solid var(--border-color)' },
  tab: { padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '3px solid transparent', transition: 'all 0.2s' },
  tabActive: { color: 'var(--color-primary-800)', borderBottomColor: 'var(--color-primary-800)' },
  empty: { textAlign: 'center' as const, padding: 'var(--space-10, 40px)', color: 'var(--text-secondary)', fontSize: 14 },
} as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { style: React.CSSProperties; label: string }> = {
    '在用': { style: s.badgeGreen, label: t('equipLifecycle.statusActive') },
    '空闲': { style: s.badgeBlue, label: t('equipLifecycle.statusIdle') },
    '维保中': { style: s.badgeOrange, label: t('equipLifecycle.statusMaint') },
    '已报废': { style: s.badgeGray, label: t('equipLifecycle.statusRetired') },
  }
  const b = map[status] || { style: s.badgeGray, label: status }
  return <span style={{ ...s.badge, ...b.style }}>{b.label}</span>
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={s.progressBar}>
      <div style={{ ...s.progressFill, width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  )
}

// [v3.0.6.11-104 Wave 2A] 设备状态 → i18n key
const LIFECYCLE_STATE_KEYS: Record<string, string> = {
  IDLE: 'deviceMgmtBoard.stateIdle',
  IN_USE: 'deviceMgmtBoard.stateInUse',
  MAINTENANCE: 'deviceMgmtBoard.stateMaintenance',
  BROKEN: 'deviceMgmtBoard.stateBroken',
  OFFLINE: 'deviceMgmtBoard.stateOffline',
}

export default function EquipmentLifecyclePage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [activeTab, setActiveTab] = useState('设备列表')
  const [selectedDevice, setSelectedDevice] = useState<typeof mockDevices[0] | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showScrap, setShowScrap] = useState(false)
  const [deviceToScrap, setDeviceToScrap] = useState<typeof mockDevices[0] | null>(null)
  const [showMaintPlanModal, setShowMaintPlanModal] = useState(false)
  const [selectedMaintRecord, setSelectedMaintRecord] = useState<typeof maintenanceRecords[0] | null>(null)
  const [apiLifecycleData, setApiLifecycleData] = useState<EquipmentLifecycle[]>([])
  // [v3.0.6.11-104 Wave 2A] GET /device-mgmt/equipment-lifecycle/:id — 单设备生命周期详情
  const [lifecycleDetail, setLifecycleDetail] = useState<any | null>(null)
  const [lifecycleDetailLoading, setLifecycleDetailLoading] = useState(false)

  // [G005 Wave2A P1] 本地设备/计划列表 (API 创建失败时的回退展示源)
  const [localDevices, setLocalDevices] = useState<typeof mockDevices>(mockDevices)
  const [localPlans, setLocalPlans] = useState<any[]>([])
  // [G005 Wave2A P1] 保存设备表单 (受控)
  const emptyDeviceForm = { name: '', model: '', dept: '', modality: 'CT', status: '在用' }
  const [deviceForm, setDeviceForm] = useState(emptyDeviceForm)
  // [G005 Wave2A P1] 报废原因 (受控)
  const [scrapReason, setScrapReason] = useState('')
  // [G005 Wave2A P1] 维保计划表单 (受控)
  const emptyMaintPlanForm = { deviceName: '', type: '常规保养', maintenanceDate: '', assignee: '', estimatedCost: '', owner: '', content: '' }
  const [maintPlanForm, setMaintPlanForm] = useState(emptyMaintPlanForm)

  // [G005 Wave4A P1] 维保计划/记录真实化: deviceMgmtApi 优先, 失败回退 mock (演示徽标)
  const [maintPlans, setMaintPlans] = useState<any[]>([])
  const [maintPlansReal, setMaintPlansReal] = useState(false)
  const [maintRecords, setMaintRecords] = useState<any[]>([])
  const [maintRecordsReal, setMaintRecordsReal] = useState(false)
  const [maintEditForm, setMaintEditForm] = useState<{ id: string; deviceName: string; type: string; maintenanceDate: string; assignee: string; estimatedCost: number } | null>(null)

  const loadMaintPlans = useCallback(async () => {
    try {
      const res = await deviceMgmtApi.listMaintenancePlans()
      if (res.success && res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setMaintPlans(res.data.data)
        setMaintPlansReal(true)
        return
      }
      setMaintPlansReal(false)
      setMaintPlans([])
    } catch {
      setMaintPlansReal(false)
      setMaintPlans([])
    }
  }, [])

  // 维保记录 = 已完成(COMPLETED)的维保计划 + 兜底 mock 记录
  const loadMaintRecords = useCallback(async () => {
    try {
      const res = await deviceMgmtApi.listMaintenancePlans({ status: 'COMPLETED' })
      if (res.success && res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setMaintRecords(res.data.data)
        setMaintRecordsReal(true)
        return
      }
      setMaintRecordsReal(false)
      setMaintRecords([])
    } catch {
      setMaintRecordsReal(false)
      setMaintRecords([])
    }
  }, [])

  useEffect(() => {
    deviceMgmtApi.listEquipmentLifecycle().then(res => {
      if (res.success && res.data) setApiLifecycleData(res.data.items ?? []);
    }).catch((err) => { console.error('[F04]', err); });
    void loadMaintPlans()
    void loadMaintRecords()
  }, [loadMaintPlans, loadMaintRecords]);

  // [v3.0.6.11-104 Wave 2A] 选择设备 → 拉取 /device-mgmt/equipment-lifecycle/:id
  useEffect(() => {
    let cancelled = false
    if (!selectedDevice?.id) { setLifecycleDetail(null); return }
    setLifecycleDetailLoading(true)
    void deviceMgmtApi.getEquipmentLifecycle(String(selectedDevice.id))
      .then(res => { if (!cancelled) setLifecycleDetail(res.success ? res.data : null) })
      .catch(() => { if (!cancelled) setLifecycleDetail(null) })
      .finally(() => { if (!cancelled) setLifecycleDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedDevice])

  // [G005 Wave2A P1] 刷新设备列表 (真实 API)
  const loadLifecycle = useCallback(async () => {
    try {
      const res = await deviceMgmtApi.listEquipmentLifecycle()
      if (res.success && res.data) setApiLifecycleData(res.data.items ?? [])
    } catch { /* 保持现有数据 */ }
  }, [])

  // [G005 Wave2A P1] 保存设备: deviceMgmtApi 真实创建 → 失败回退本地列表
  const handleSaveDevice = async () => {
    if (!deviceForm.name || !deviceForm.model) {
      message.warning(t('equipLifecycle.needNameModel'))
      return
    }
    try {
      const res = await deviceMgmtApi.create({
        code: uniqueId('LC'),
        name: deviceForm.name,
        modality: deviceForm.modality,
        location: deviceForm.dept || '放射科',
        manufacturer: deviceForm.model,
      })
      if (res.success) {
        await loadLifecycle()
        message.success(t('equipLifecycle.deviceAdded', { name: deviceForm.name }))
        setShowAdd(false)
        setDeviceForm(emptyDeviceForm)
        return
      }
    } catch { /* 回退本地 */ }
    setLocalDevices(prev => [{
      id: uniqueId('LC'), name: deviceForm.name, model: deviceForm.model,
      serial: '-', vendor: '-', purchaseDate: new Date().toISOString().slice(0, 10), dept: deviceForm.dept || '放射科',
      status: deviceForm.status, useCount: 0, lastUse: '-', nextMaint: '-', lifeMonth: 0, deptRate: 0,
      totalCost: 0, maintCost: 0, spareCost: 0,
    }, ...prev])
    message.success(t('equipLifecycle.deviceAddedDemo', { name: deviceForm.name }))
    setShowAdd(false)
    setDeviceForm(emptyDeviceForm)
  }

  // [G005 Wave2A P1] 确认报废: updateEquipmentLifecycle 状态流转 → 失败回退本地
  const handleConfirmScrap = async () => {
    if (!deviceToScrap) return
    try {
      const res = await deviceMgmtApi.updateEquipmentLifecycle(deviceToScrap.id, { status: 'RETIRED', notes: scrapReason })
      if (res.success) {
        await loadLifecycle()
        message.success(t('equipLifecycle.deviceRetired', { name: deviceToScrap.name }))
        setShowScrap(false)
        setScrapReason('')
        return
      }
    } catch { /* 回退本地 */ }
    if (isApiData) {
      setApiLifecycleData(prev => prev.map(d => (d.id === deviceToScrap.id ? { ...d, status: 'RETIRED' } : d)))
    } else {
      setLocalDevices(prev => prev.map(d => (d.id === deviceToScrap.id ? { ...d, status: '已报废' } : d)))
    }
    message.success(t('equipLifecycle.deviceRetiredDemo', { name: deviceToScrap.name }))
    setShowScrap(false)
    setScrapReason('')
  }

  // [G005 Wave2A P1] 保存维保计划: createMaintenancePlan → 失败回退本地
  const handleSaveMaintPlan = async () => {
    if (!maintPlanForm.deviceName || !maintPlanForm.maintenanceDate) {
      message.warning(t('equipLifecycle.needNameDate'))
      return
    }
    const dto = {
      deviceId: maintPlanForm.deviceName,
      deviceName: maintPlanForm.deviceName,
      type: maintPlanForm.type || '常规保养',
      maintenanceDate: maintPlanForm.maintenanceDate,
      assignee: maintPlanForm.assignee,
      estimatedCost: Number(maintPlanForm.estimatedCost) || 0,
      content: maintPlanForm.content,
    }
    try {
      const res = await deviceMgmtApi.createMaintenancePlan(dto)
      if (res.success) {
        await loadMaintPlans()
        message.success(t('equipLifecycle.planCreated', { name: maintPlanForm.deviceName }))
        setShowMaintPlanModal(false)
        setMaintPlanForm(emptyMaintPlanForm)
        return
      }
    } catch { /* 回退本地 */ }
    setLocalPlans(prev => [{ id: `MP-${Date.now()}`, ...dto, status: 'PENDING' }, ...prev])
    message.success(t('equipLifecycle.planCreatedDemo', { name: maintPlanForm.deviceName }))
    setShowMaintPlanModal(false)
    setMaintPlanForm(emptyMaintPlanForm)
  }

  // 维保计划操作: 确认完成 / 编辑 / 删除 (真实 API 优先, 失败回退本地)
  const markPlanCompleted = async (id: string) => {
    try {
      const res = await deviceMgmtApi.updateMaintenancePlan(id, { status: 'COMPLETED' })
      if (res.success) {
        await loadMaintPlans()
        await loadMaintRecords()
        return
      }
    } catch { }
    setMaintPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'COMPLETED' } : p))
  }
  const deleteMaintPlan = async (id: string) => {
    try {
      const res = await deviceMgmtApi.deleteMaintenancePlan(id)
      if (res.success) {
        await loadMaintPlans()
        return
      }
    } catch { }
    setMaintPlans(prev => prev.filter(p => p.id !== id))
  }
  const saveMaintPlanEdit = async () => {
    if (!maintEditForm) return
    try {
      const res = await deviceMgmtApi.updateMaintenancePlan(maintEditForm.id, {
        deviceName: maintEditForm.deviceName,
        type: maintEditForm.type,
        maintenanceDate: maintEditForm.maintenanceDate,
        assignee: maintEditForm.assignee,
        estimatedCost: maintEditForm.estimatedCost,
      })
      if (res.success) {
        await loadMaintPlans()
        setMaintEditForm(null)
        return
      }
    } catch { }
    setMaintPlans(prev => prev.map(p => p.id === maintEditForm.id ? { ...p, ...maintEditForm } : p))
    setMaintEditForm(null)
  }

  const daysUntil = (dateStr: string) => {
    const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.ceil(diff))
  }

  // 维保计划展示行 (真实计划 / 本地新增 / mock 计划)
  const planSource: any[] = maintPlansReal && maintPlans.length > 0
    ? maintPlans
    : (localPlans.length > 0 ? localPlans : mockMaintPlans)
  const planRows: any[] = planSource.map((m: any) => ({
    id: m.id,
    deviceId: m.deviceId,
    name: m.deviceName ?? m.deviceId,
    model: m.deviceName ?? m.deviceId,
    type: m.type ?? '定期保养',
    date: String(m.maintenanceDate).slice(0, 10),
    days: daysUntil(String(m.maintenanceDate)),
    vendor: m.assignee ?? '',
    cost: typeof m.estimatedCost === 'number' ? m.estimatedCost : 0,
    status: m.status ?? 'PENDING',
    content: m.content ?? '',
  }))

  // 维保记录展示行 (已完成计划 / mock 记录)
  const recordRows: any[] = maintRecordsReal && maintRecords.length > 0
    ? maintRecords.map((r: any) => ({
        id: r.id,
        device: r.deviceId,
        name: r.deviceName ?? r.deviceId,
        type: r.type ?? '常规保养',
        cost: typeof r.estimatedCost === 'number' ? r.estimatedCost : 0,
        vendor: r.assignee ?? '',
        result: r.status === 'COMPLETED' ? '已完成' : '处理中',
        date: String(r.completedAt ?? r.maintenanceDate).slice(0, 10),
      }))
    : maintenanceRecords.map((r) => ({ id: r.device + r.date, ...r }))

  // [G005 Wave2A P1] 真实数据优先: apiLifecycleData → 回退 mockDevices (演示徽标)
  const isApiData = apiLifecycleData.length > 0
  const lifecycleRows: any[] = isApiData
    ? apiLifecycleData.map((d: any) => ({
        id: d.id,
        name: d.name,
        model: d.model,
        serial: d.serialNumber ?? '-',
        vendor: d.manufacturer ?? '-',
        dept: d.location ?? '-',
        status: d.status === 'ACTIVE' ? '在用' : d.status === 'MAINTENANCE' ? '维保中' : '已报废',
        useCount: 0,
        lastUse: '-',
        nextMaint: d.nextMaintenanceDate ?? '-',
        lifeMonth: 0,
        deptRate: 0,
        totalCost: 0,
        maintCost: 0,
        spareCost: 0,
      }))
    : localDevices

  const filtered = lifecycleRows.filter(d => {
    const matchSearch = (d.name?.includes(search) || d.model?.includes(search) || d.id?.includes(search))
    const matchStatus = statusFilter === '全部' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const soonExpire = lifecycleRows.filter(d => {
    if (d.status === '已报废') return false
    const next = new Date(d.nextMaint)
    const now = new Date('2026-04-30')
    const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 30
  })

  const totalValue = lifecycleRows.filter(d => d.status !== '已报废').reduce((sum, d) => sum + (d.totalCost ?? 0), 0)

  // ============================================================
  // [G005 v3.0.6.11-99 Wave 10E-1] 深度分析区块
  //   E1. 设备状态时间线 (购置→在用→维护→报废)
  //   E2. 费用分析卡 (购置/维护/折旧)
  //   E3. 维保到期预警面板 (7天/30天/已过期)
  //   E4. 设备使用率趋势 (oeeApi → 失败回退派生)
  // ============================================================
  const [oeeList, setOeeList] = useState<any[]>([])
  const [oeeTrendMap, setOeeTrendMap] = useState<Record<string, any[]>>({})
  const [oeeReal, setOeeReal] = useState(false)
  const [oeeLoading, setOeeLoading] = useState(false)

  // E4. 加载 OEE 数据: oeeApi.list + getTrend 并行, 失败回退
  const loadOee = useCallback(async () => {
    setOeeLoading(true)
    try {
      const listRes = await oeeApi.list()
      if (listRes.success && Array.isArray(listRes.data) && listRes.data.length > 0) {
        const devices = listRes.data as any[]
        setOeeList(devices)
        setOeeReal(true)
        const map: Record<string, any[]> = {}
        await Promise.all(devices.slice(0, 6).map(async (d) => {
          try {
            const tRes = await oeeApi.getTrend(d.id)
            if (tRes.success && Array.isArray(tRes.data)) map[d.id] = tRes.data
          } catch { /* 单设备趋势失败忽略 */ }
        }))
        setOeeTrendMap(map)
        return
      }
      setOeeReal(false)
      // 回退: 从 lifecycleRows 派生
      setOeeList(lifecycleRows.slice(0, 6).map((d: any, i: number) => ({
        id: d.id,
        name: d.name,
        modality: d.model?.startsWith('MR') ? 'MR' : d.model?.startsWith('CT') ? 'CT' : 'DR',
        oee: 58 + ((i * 11) % 36),
        availability: 82 + ((i * 5) % 16),
        performance: 72 + ((i * 7) % 22),
        quality: 90 + ((i * 3) % 9),
        trend: 'stable',
        source: 'derived' as const,
      })))
    } catch {
      setOeeReal(false)
      setOeeList(lifecycleRows.slice(0, 6).map((d: any, i: number) => ({
        id: d.id, name: d.name, modality: 'CT',
        oee: 58 + ((i * 11) % 36), availability: 82 + ((i * 5) % 16),
        performance: 72 + ((i * 7) % 22), quality: 90 + ((i * 3) % 9),
        trend: 'stable', source: 'derived' as const,
      })))
    } finally {
      setOeeLoading(false)
    }
  }, [lifecycleRows])

  // E1. 状态时间线数据: 每个设备 4 个阶段节点 (购置/在用/维护/报废)
  const lifecycleTimeline = useMemo(() => {
    return lifecycleRows.map((d: any) => {
      const purchaseDate = d.purchaseDate || '2021-01-01'
      const isRetired = d.status === '已报废'
      const isMaint = d.status === '维保中'
      const monthsInUse = d.lifeMonth || Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 2592000000) || 30
      const maintAt = new Date(new Date(purchaseDate).getTime() + monthsInUse * 2592000000 * 0.7).toISOString().slice(0, 10)
      const retireAt = isRetired ? new Date(new Date(purchaseDate).getTime() + (monthsInUse + 24) * 2592000000).toISOString().slice(0, 10) : null
      const nextMaint = d.nextMaint && d.nextMaint !== '-' ? d.nextMaint : maintAt
      return {
        id: d.id,
        name: d.name,
        purchaseDate,
        status: d.status,
        isRetired,
        isMaint,
        nextMaint,
        retireAt,
        maintCount: isMaint ? 3 : (d.maintCost ? Math.max(1, Math.round(Number(d.maintCost) / 30000)) : 2),
        useCount: d.useCount || 0,
        daysLeft: nextMaint ? Math.round((new Date(nextMaint).getTime() - Date.now()) / 86400000) : 999,
      }
    })
  }, [lifecycleRows])

  // E2. 费用分析: 按模态聚合 购置/维护/折旧
  const costAnalysis = useMemo(() => {
    const rows = isApiData ? apiLifecycleData : localDevices
    const byModality: Record<string, { name: string; purchase: number; maint: number; depreciation: number }> = {}
    rows.forEach((d: any) => {
      const mod = String(d.modality ?? d.model ?? '其他').slice(0, 2).toUpperCase()
      const slot = byModality[mod] ?? { name: mod, purchase: 0, maint: 0, depreciation: 0 }
      const totalCost = Number(d.totalCost ?? 0)
      const maintCost = Number(d.maintCost ?? 0)
      const annualDep = Math.round(totalCost * 0.08)
      slot.purchase += totalCost
      slot.maint += maintCost
      slot.depreciation += annualDep
      byModality[mod] = slot
    })
    const list = Object.values(byModality).sort((a, b) => b.purchase - a.purchase)
    const totals = list.reduce((acc, x) => ({
      purchase: acc.purchase + x.purchase,
      maint: acc.maint + x.maint,
      depreciation: acc.depreciation + x.depreciation,
    }), { purchase: 0, maint: 0, depreciation: 0 })
    return { list, totals }
  }, [isApiData, apiLifecycleData, localDevices])

  // E3. 维保到期预警分级
  const maintWarnings = useMemo(() => {
    const now = Date.now()
    const day = 86400000
    const groups = { overdue: [] as any[], soon7: [] as any[], soon30: [] as any[] }
    lifecycleRows.forEach((d: any) => {
      if (d.status === '已报废') return
      const nm = d.nextMaint && d.nextMaint !== '-' ? d.nextMaint : ''
      if (!nm) return
      const diff = Math.round((new Date(nm).getTime() - now) / day)
      const item = { ...d, daysLeft: diff }
      if (diff < 0) groups.overdue.push(item)
      else if (diff <= 7) groups.soon7.push(item)
      else if (diff <= 30) groups.soon30.push(item)
    })
    return { ...groups, total: groups.overdue.length + groups.soon7.length + groups.soon30.length }
  }, [lifecycleRows])

  // OEE 趋势图数据 (选择设备)
  const [oeeSelectedDevice, setOeeSelectedDevice] = useState<string>('')
  const oeeChartData = useMemo(() => {
    const dev = oeeList.find((d: any) => d.id === oeeSelectedDevice) ?? oeeList[0]
    if (!dev) return []
    const trend = oeeTrendMap[dev.id]
    if (Array.isArray(trend) && trend.length > 0) {
      return trend.map((p: any) => ({
        day: String(p.date ?? '').slice(5, 10) || '—',
        OEE: Number(p.oee ?? 0),
        可用性: Number(p.availability ?? 0),
        性能: Number(p.performance ?? 0),
        质量: Number(p.quality ?? 0),
      }))
    }
    // 回退派生 14 天趋势
    return Array.from({ length: 14 }, (_, i) => {
      const wave = Math.sin((i + 1) / 3) * 4
      return {
        day: `${Math.floor(i / 2) + 1}日`,
        OEE: Math.round(dev.oee + wave),
        可用性: Math.round(dev.availability + wave * 0.5),
        性能: Math.round(dev.performance - wave * 0.6),
        质量: Math.round(dev.quality + 2),
      }
    })
  }, [oeeList, oeeTrendMap, oeeSelectedDevice])

  // 使用率排行 (OEE 榜)
  const oeeRank = useMemo(() => [...oeeList].sort((a: any, b: any) => b.oee - a.oee), [oeeList])

  // E5. 设备年龄分布 (按购置年份分组)
  const ageDistribution = useMemo(() => {
    const map: Record<string, number> = {}
    lifecycleRows.forEach((d: any) => {
      const year = String(d.purchaseDate ?? '').slice(0, 4) || '未知'
      map[year] = (map[year] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, count]) => ({ year, count, pct: Math.round((count / Math.max(1, lifecycleRows.length)) * 100) }))
  }, [lifecycleRows])

  // E6. 维保费用月度趋势 (从 recordRows 派生)
  const maintCostTrend = useMemo(() => {
    const map: Record<string, number> = {}
    recordRows.forEach((r: any) => {
      const month = String(r.date ?? '').slice(0, 7)
      if (month) map[month] = (map[month] || 0) + Number(r.cost ?? 0)
    })
    const months = Object.keys(map).sort()
    if (months.length === 0) {
      return ['2026-01', '2026-02', '2026-03', '2026-04'].map(m => ({ month: m, cost: 0 }))
    }
    return months.map(m => ({ month: m, cost: map[m] ?? 0 }))
  }, [recordRows])

  // E7. 状态构成
  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    lifecycleRows.forEach((d: any) => { map[d.status] = (map[d.status] || 0) + 1 })
    return Object.entries(map).map(([status, count]) => ({
      status,
      count,
      color: status === '在用' ? 'var(--color-success-600)' : status === '维保中' ? 'var(--color-warning-600)' : status === '空闲' ? 'var(--color-primary-600)' : '#94a3b8',
    }))
  }, [lifecycleRows])

  const deviceColumns: TableColumnsType<any> = [
    { title: t('equipLifecycle.thDeviceId'), dataIndex: 'id', key: 'id', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: t('equipLifecycle.thDeviceName'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('equipLifecycle.thModel'), dataIndex: 'model', key: 'model' },
    { title: t('equipLifecycle.thDept'), dataIndex: 'dept', key: 'dept' },
    { title: t('equipLifecycle.thStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <StatusBadge status={v} /> },
    { title: t('equipLifecycle.thUseCount'), dataIndex: 'useCount', key: 'useCount', render: (v: number) => v > 0 ? v.toLocaleString() : '-' },
    {
      title: t('equipLifecycle.thNextMaint'), dataIndex: 'nextMaint', key: 'nextMaint',
      render: (v: string, d: any) => v === '-' ? '-' : (
        <span style={{ color: soonExpire.includes(d) ? 'var(--color-error-600)' : '#334155', fontWeight: soonExpire.includes(d) ? 600 : 400 }}>
          {v}
        </span>
      ),
    },
    {
      title: t('equipLifecycle.thUsageRate'), dataIndex: 'deptRate', key: 'deptRate',
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <div style={{ width: 80 }}>
            <ProgressBar value={v} color={v >= 80 ? 'var(--color-success-600)' : v >= 50 ? 'var(--color-warning-600)' : '#94a3b8'} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}%</span>
        </div>
      ),
    },
    {
      title: t('equipLifecycle.thActions'), key: 'actions',
      render: (_v: unknown, d: any) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={() => setSelectedDevice(d)}><Eye size={14} />{t('equipLifecycle.detail')}</button>
          {d.status !== '已报废' && (
            <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={() => { setDeviceToScrap(d); setShowScrap(true) }}>{t('equipLifecycle.retire')}</button>
          )}
        </div>
      ),
    },
  ]

  const planColumns: TableColumnsType<any> = [
    { title: t('equipLifecycle.thPlanName'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('equipLifecycle.thPlanModel'), dataIndex: 'model', key: 'model' },
    { title: t('equipLifecycle.thPlanType'), dataIndex: 'type', key: 'type', render: (v: string) => <StatusBadge status={v === '故障维修' ? '维保中' : '在用'} /> },
    { title: t('equipLifecycle.thPlanDate'), dataIndex: 'date', key: 'date' },
    {
      title: t('equipLifecycle.thDaysLeft'), dataIndex: 'days', key: 'days',
      render: (v: number) => (
        <span style={{ color: v <= 7 ? 'var(--color-error-600)' : v <= 30 ? 'var(--color-warning-600)' : '#334155', fontWeight: v <= 7 ? 700 : 400 }}>
          {v <= 7 ? t('equipLifecycle.daysAfterWarn', { n: v }) : t('equipLifecycle.daysAfter', { n: v })}
        </span>
      ),
    },
    { title: t('equipLifecycle.thVendor'), dataIndex: 'vendor', key: 'vendor', render: (v: string) => v || '-' },
    { title: t('equipLifecycle.thCost'), dataIndex: 'cost', key: 'cost', render: (v: number) => v > 0 ? `¥${Number(v).toLocaleString()}` : '-' },
    { title: t('equipLifecycle.thPlanStatus'), dataIndex: 'status', key: 'planStatus', render: (v: string) => <StatusBadge status={v === 'COMPLETED' ? '已报废' : v === 'CANCELLED' ? '已报废' : '在用'} /> },
    {
      title: t('equipLifecycle.thActions'), key: 'actions',
      render: (_v: unknown, m: any) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px' }}
            onClick={() => void markPlanCompleted(m.id)}><CheckCircle size={14} />{t('equipLifecycle.confirm')}</button>
          <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px' }}
            onClick={() => setMaintEditForm({ id: m.id, deviceName: m.name, type: m.type, maintenanceDate: m.date, assignee: m.vendor, estimatedCost: m.cost })}><Edit3 size={14} />{t('equipLifecycle.edit')}</button>
          <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px', color: 'var(--color-error-600)' }}
            onClick={() => void deleteMaintPlan(m.id)}><Trash2 size={14} />{t('equipLifecycle.delete')}</button>
        </div>
      ),
    },
  ]

  const recordColumns: TableColumnsType<any> = [
    { title: t('equipLifecycle.thRecordDate'), dataIndex: 'date', key: 'date' },
    { title: t('equipLifecycle.thRecordDeviceId'), dataIndex: 'device', key: 'device', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: t('equipLifecycle.thRecordDeviceName'), key: 'deviceName', render: (_v: unknown, r: any) => r.name || mockDevices.find(d => d.id === r.device)?.name || r.device },
    { title: t('equipLifecycle.thRecordType'), dataIndex: 'type', key: 'type', render: (v: string) => <StatusBadge status={v === '故障维修' ? '维保中' : '在用'} /> },
    { title: t('equipLifecycle.thRecordCost'), dataIndex: 'cost', key: 'cost', render: (v: number) => v > 0 ? `¥${Number(v).toLocaleString()}` : '-' },
    { title: t('equipLifecycle.thRecordVendor'), dataIndex: 'vendor', key: 'vendor' },
    {
      title: t('equipLifecycle.thRecordResult'), dataIndex: 'result', key: 'result',
      render: (v: string) => (
        <span style={{ ...s.badge, ...(v === '合格' || v === '已修复' || v === '已完成' ? s.badgeGreen : v === '建议报废' ? s.badgeRed : s.badgeOrange) }}>
          {v}
        </span>
      ),
    },
    {
      title: t('equipLifecycle.thActions'), key: 'actions',
      render: (_v: unknown, r: any) => (
        <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={() => { setSelectedMaintRecord(r); setSelectedDevice(mockDevices.find(d => d.id === r.device) || null); }}><Eye size={14} />{t('equipLifecycle.detail')}</button>
      ),
    },
  ]

  const costColumns: TableColumnsType<any> = [
    { title: t('equipLifecycle.thModality'), dataIndex: 'name', key: 'name', render: (v: string) => <b style={{ color: 'var(--color-primary-800)' }}>{v}</b> },
    { title: t('equipLifecycle.thPurchaseTotal'), dataIndex: 'purchase', key: 'purchase', render: (v: number) => `¥${v.toLocaleString()}` },
    { title: t('equipLifecycle.thMaintTotal'), dataIndex: 'maint', key: 'maint', render: (v: number) => `¥${v.toLocaleString()}` },
    { title: t('equipLifecycle.thDeprec'), dataIndex: 'depreciation', key: 'depreciation', render: (v: number) => `¥${v.toLocaleString()}` },
    {
      title: t('equipLifecycle.thMaintRatio'), key: 'ratio',
      render: (_v: unknown, m: any) => {
        const ratio = m.purchase > 0 ? Math.round((m.maint / m.purchase) * 100) : 0
        return <span style={{ color: ratio > 12 ? 'var(--color-error-600)' : '#059669', fontWeight: 700 }}>{ratio}%</span>
      },
    },
    {
      title: t('equipLifecycle.thShare'), key: 'share', width: 180,
      render: (_v: unknown, m: any) => {
        const pct = costAnalysis.totals.purchase > 0 ? Math.round((m.purchase / costAnalysis.totals.purchase) * 100) : 0
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary-800)', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 40, textAlign: 'right' }}>{pct}%</span>
          </div>
        )
      },
    },
  ]

  useEffect(() => {
    void loadOee()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={s.root}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
        <PageHeader title={t('equipLifecycle.pageTitle')} style={{ marginBottom: 'var(--space-6, 24px)' }} />
        {/* [G005 Wave4A P1] 数据来源徽标 (按当前 Tab 数据源动态显示, 修复"顶部真实/Tab mock"矛盾) */}
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10, marginBottom: 'var(--space-6, 24px)',
          background: (activeTab === '设备列表' ? isApiData : activeTab === '维保计划' ? maintPlansReal : maintRecordsReal)
            ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
          color: (activeTab === '设备列表' ? isApiData : activeTab === '维保计划' ? maintPlansReal : maintRecordsReal)
            ? '#15803d' : '#92400e'
        }}>
          {(activeTab === '设备列表' ? isApiData : activeTab === '维保计划' ? maintPlansReal : maintRecordsReal)
            ? t('equipLifecycle.realData') : t('equipLifecycle.demoData')}
        </span>
      </div>

      {/* 标签页 */}
      <div style={s.tabs}>
        {[{ key: '设备列表', label: t('equipLifecycle.tabDevices') }, { key: '维保计划', label: t('equipLifecycle.tabMaintPlans') }, { key: '维保记录', label: t('equipLifecycle.tabMaintRecords') }, { key: '深度分析', label: t('equipLifecycle.tabDeepAnalysis') }].map(tab => (
          <div
            key={tab.key}
            role="button"
            tabIndex={0}
            style={{ ...s.tab, ...(activeTab === tab.key ? s.tabActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(tab.key) } }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {activeTab === '设备列表' && (
        <>
          {/* 统计卡片 */}
          <div style={s.statsGrid}>
            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={s.statLabel}>{t('equipLifecycle.statTotalDevices')}</div>
              <div style={s.statValue}>{lifecycleRows.length}</div>
              <div style={s.statSub}>{t('equipLifecycle.statActiveCount', { n: lifecycleRows.filter(d => d.status === '在用').length })}</div>
            </Card>
            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={s.statLabel}>{t('equipLifecycle.statActive')}</div>
              <div style={{ ...s.statValue, ...s.statGreen }}>{lifecycleRows.filter(d => d.status === '在用').length}</div>
              <div style={s.statSub}>{t('equipLifecycle.statUsageRate')}</div>
            </Card>
            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={s.statLabel}>{t('equipLifecycle.statMaint')}</div>
              <div style={{ ...s.statValue, ...s.statOrange }}>{lifecycleRows.filter(d => d.status === '维保中').length}</div>
              <div style={s.statSub}>{t('equipLifecycle.statMaintSub')}</div>
            </Card>
            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={s.statLabel}>{t('equipLifecycle.statExpiring')}</div>
              <div style={{ ...s.statValue, ...s.statRed }}>{soonExpire.length}</div>
              <div style={s.statSub}>{t('equipLifecycle.statExpiringSub')}</div>
            </Card>
            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={s.statLabel}>{t('equipLifecycle.statAssetValue')}</div>
              <div style={s.statValue}>{Math.round(totalValue / 10000)}{t('equipLifecycle.tenThousand')}</div>
              <div style={s.statSub}>{t('equipLifecycle.statDeprecSub')}</div>
            </Card>
          </div>

          {/* 维保到期提醒 */}
          {soonExpire.length > 0 && (
            <Card bordered={false} style={s.maintAlert} styles={{ body: { padding: 0 } }}>
              <div style={s.alertTitle}>
                <AlertTriangle size={18} color="var(--color-warning-600)" />
                {t('equipLifecycle.maintAlertTitle', { n: soonExpire.length })}
              </div>
              <div style={s.alertGrid}>
                {soonExpire.map(d => {
                  const next = new Date(d.nextMaint)
                  const now = new Date('2026-04-30')
                  const days = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={d.id} style={s.alertCard}>
                      <div>
                        <div style={s.alertName}>{d.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.id} · {d.dept}</div>
                        <div style={s.alertDate}>{t('equipLifecycle.daysLeft', { n: days })}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={() => setShowMaintPlanModal(true)}><Plus size={14} />{t('equipLifecycle.bookMaint')}</button>
                        <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={() => { setSelectedDevice(d); setActiveTab('维保记录') }}><ClipboardList size={14} />{t('equipLifecycle.recordsBtn')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* 工具栏 */}
          <div style={s.toolbar}>
            <div style={s.searchBox}>
              <Search size={16} color="var(--text-secondary)" />
              <input style={s.searchInput} placeholder={t('equipLifecycle.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select style={s.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="全部">{t('equipLifecycle.filterAllStatus')}</option>
              <option value="在用">{t('equipLifecycle.statusActive')}</option>
              <option value="空闲">{t('equipLifecycle.statusIdle')}</option>
              <option value="维保中">{t('equipLifecycle.statusMaint')}</option>
              <option value="已报废">{t('equipLifecycle.statusRetired')}</option>
            </select>
            <div style={{ flex: 1 }} />
            <button style={{ ...s.btn, ...s.btnSuccess }} onClick={() => setShowAdd(true)}>
              <Plus size={16} /> {t('equipLifecycle.addDevice')}
            </button>
          </div>

          {/* 表格 */}
          <DataTable<any>
            columns={deviceColumns}
            dataSource={filtered}
            rowKey="id"
            emptyText={t('equipLifecycle.noDevices')}
          />
        </>
      )}

      {activeTab === '维保计划' && (
        <div>
          <div style={s.toolbar}>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setShowMaintPlanModal(true)}>
              <Plus size={16} /> {t('equipLifecycle.newMaintPlan')}
            </button>
            {!maintPlansReal && (
              <span style={{ ...s.badge, ...s.badgeOrange }}>{t('equipLifecycle.demoMaintPlanBadge')}</span>
            )}
          </div>
          <Card bordered={false} style={{ ...s.maintAlert, marginTop: 0 }} styles={{ body: { padding: 0 } }}>
            <div style={s.alertTitle}>
              <Clock size={18} color="var(--color-primary-600)" />
              {t('equipLifecycle.maintCalendarTitle')}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--space-3, 12px)' }}>
              {maintPlansReal
                ? t('equipLifecycle.maintPlansCountReal', { n: planRows.length })
                : t('equipLifecycle.maintPlansCountMock', { n: mockDevices.filter(d => d.status !== '已报废').length })}
            </div>
            <DataTable<any>
              columns={planColumns}
              dataSource={planRows}
              rowKey={(r: any, i) => String(r.id ?? i)}
              emptyText={t('equipLifecycle.noMaintPlans')}
            />
          </Card>
        </div>
      )}

      {activeTab === '维保记录' && (
        <div>
          <div style={s.toolbar}>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setShowAdd(true)}>
              <Plus size={16} /> {t('equipLifecycle.recordMaint')}
            </button>
            {!maintRecordsReal && (
              <span style={{ ...s.badge, ...s.badgeOrange }}>{t('equipLifecycle.demoMaintRecordBadge')}</span>
            )}
          </div>
          <DataTable<any>
            columns={recordColumns}
            dataSource={recordRows}
            rowKey={(r: any, i) => String(r.id ?? i)}
            emptyText={t('equipLifecycle.noMaintRecords')}
          />
          {/* 成本汇总 */}
          <Card bordered={false} style={{ marginTop: 'var(--space-6, 24px)', background: 'var(--bg-card)', borderRadius: 10, padding: 'var(--space-6, 24px)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-4, 16px)' }}>{t('equipLifecycle.costSummaryTitle')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4, 16px)' }}>
              {[
                { label: t('equipLifecycle.costTotalMaint'), value: `¥${recordRows.filter(r => Number(r.cost) > 0).reduce((s, r) => s + Number(r.cost), 0).toLocaleString()}`, color: 'var(--color-primary-800)' },
                { label: t('equipLifecycle.costTotalSpare'), value: `¥${mockDevices.reduce((s, d) => s + d.spareCost, 0).toLocaleString()}`, color: 'var(--color-primary-800)' },
                { label: t('equipLifecycle.costTotalValue'), value: `¥${totalValue.toLocaleString()}`, color: 'var(--color-primary-800)' },
                { label: t('equipLifecycle.costMaintRatio'), value: `${totalValue > 0 ? Math.round(recordRows.reduce((s, r) => s + Number(r.cost), 0) / totalValue * 100) : 0}%`, color: 'var(--color-warning-600)' },
              ].map(item => (
                <div key={item.label} style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, textAlign: 'center' as const }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)' }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === '深度分析' && (
        <>
          {/* 数据源徽标 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)', fontSize: 12, padding: '8px 14px', borderRadius: 8, background: oeeReal ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: oeeReal ? '#15803d' : '#92400e', border: `1px solid ${oeeReal ? '#bbf7d0' : '#fde68a'}` }} data-testid="equipment-deep-source">
            {oeeLoading ? t('equipLifecycle.oeeLoading') : oeeReal
              ? t('equipLifecycle.oeeSourceReal')
              : t('equipLifecycle.oeeSourceFallback')}
            <span style={{ marginLeft: 'auto', opacity: 0.75 }}>{t('equipLifecycle.updatedAt', { time: new Date().toLocaleTimeString('zh-CN') })}</span>
          </div>

          {/* E4. 设备使用率趋势 (OEE) */}
          <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <Monitor size={16} /> {t('equipLifecycle.oeeTitle')}
              <select style={{ ...s.select, marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }} value={oeeSelectedDevice} onChange={e => setOeeSelectedDevice(e.target.value)}>
                {oeeList.map((d: any) => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
              </select>
            </div>
            {oeeChartData.length === 0 ? (
              <div style={s.empty}>{t('equipLifecycle.noOee')}</div>
            ) : (
              <div>
                <ChartContainer height={260} state="ready">
                  <LineChart data={oeeChartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="OEE" stroke="var(--color-primary-800)" strokeWidth={2.2} dot={false} />
                    <Line type="monotone" dataKey="可用性" name={t('equipLifecycle.oeeAvailability')} stroke="#059669" strokeWidth={1.6} dot={false} />
                    <Line type="monotone" dataKey="性能" name={t('equipLifecycle.oeePerformance')} stroke="var(--color-warning-600)" strokeWidth={1.6} dot={false} />
                    <Line type="monotone" dataKey="质量" name={t('equipLifecycle.oeeQuality')} stroke="#7c3aed" strokeWidth={1.6} dot={false} />
                  </LineChart>
                </ChartContainer>
                {/* OEE 排行条 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 'var(--space-3, 12px)' }}>
                  {oeeRank.slice(0, 6).map((d: any, i: number) => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--color-warning-600)' : '#94a3b8', minWidth: 22 }}>#{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${Math.min(100, d.oee)}%`, height: '100%', background: d.oee >= 85 ? 'var(--color-success-600)' : d.oee >= 65 ? 'var(--color-warning-500)' : 'var(--color-error-600)', borderRadius: 3 }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: d.oee >= 85 ? 'var(--color-success-600)' : d.oee >= 65 ? 'var(--color-warning-600)' : 'var(--color-error-600)' }}>{Math.round(d.oee)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* E1. 设备状态时间线 */}
          <Card bordered={false} style={{ ...s.statCard, marginTop: 'var(--space-5, 20px)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <Clock size={16} /> {t('equipLifecycle.timelineTitle')}
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{t('equipLifecycle.timelineCount', { n: lifecycleTimeline.length })}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {lifecycleTimeline.slice(0, 8).map((d: any) => {
                const phases = [
                  { label: t('equipLifecycle.phasePurchase'), date: d.purchaseDate, done: true, color: 'var(--color-primary-800)' },
                  { label: t('equipLifecycle.phaseActive'), date: d.purchaseDate, done: !d.isRetired, color: '#059669' },
                  { label: t('equipLifecycle.phaseMaint'), date: d.nextMaint, done: d.isMaint || true, color: 'var(--color-warning-600)', highlight: d.isMaint },
                  { label: t('equipLifecycle.phaseRetired'), date: d.retireAt ?? '—', done: d.isRetired, color: '#94a3b8' },
                ]
                return (
                  <div key={d.id} style={{ padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary-800)', fontSize: 12 }}>{d.name}</span>
                      <code style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{d.id}</code>
                      <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: d.isRetired ? 'var(--bg-card)' : d.isMaint ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', color: d.isRetired ? 'var(--text-secondary)' : d.isMaint ? '#92400e' : '#15803d' }}>
                        {d.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      {phases.map((p, i) => (
                        <div key={p.label} style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1, 4px)', position: 'relative', zIndex: 2 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: p.done ? p.color : '#fff',
                              border: `2px solid ${p.done ? p.color : '#cbd5e1'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {p.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}></span>}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: p.done ? p.color : 'var(--text-secondary)' }}>{p.label}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.date}</span>
                          </div>
                          {i < phases.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: p.done ? p.color : '#e2e8f0', marginBottom: 34 }} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span dangerouslySetInnerHTML={{ __html: t('equipLifecycle.usedCount', { n: d.useCount }) }} />
                      <span dangerouslySetInnerHTML={{ __html: t('equipLifecycle.maintCount', { n: d.maintCount }) }} />
                      <span dangerouslySetInnerHTML={{ __html: t('equipLifecycle.nextMaintLabel', { date: d.nextMaint }) }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* E3. 维保到期预警面板 */}
          <Card bordered={false} style={{ ...s.statCard, marginTop: 'var(--space-5, 20px)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <AlertTriangle size={16} /> {t('equipLifecycle.maintWarnTitle')}
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{t('equipLifecycle.warnCount', { n: maintWarnings.total })}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)' }}>
              {[
                { key: 'overdue', label: t('equipLifecycle.warnOverdue'), color: 'var(--color-error-600)', bg: 'var(--color-error-bg)', items: maintWarnings.overdue },
                { key: 'soon7', label: t('equipLifecycle.warn7d'), color: 'var(--color-warning-600)', bg: 'var(--color-warning-bg)', items: maintWarnings.soon7 },
                { key: 'soon30', label: t('equipLifecycle.warn30d'), color: 'var(--color-primary-600)', bg: 'var(--color-info-bg)', items: maintWarnings.soon30 },
              ].map(g => (
                <div key={g.key} style={{ padding: 'var(--space-3, 12px)', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: g.bg, color: g.color }}>{g.label}</span>
                    <b style={{ fontSize: 16, color: g.color }}>{g.items.length}</b>
                  </div>
                  {g.items.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('equipLifecycle.none')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {g.items.slice(0, 4).map((d: any) => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '7px 10px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-light)', fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-primary-800)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.nextMaint}</span>
                          <b style={{ color: g.color, fontSize: 12 }}>{t('equipLifecycle.daysShort', { n: Math.abs(d.daysLeft) })}</b>
                        </div>
                      ))}
                      {g.items.length > 4 && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('equipLifecycle.andMore', { n: g.items.length })}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* E2. 费用分析卡 */}
          <Card bordered={false} style={{ ...s.statCard, marginTop: 'var(--space-5, 20px)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <DollarSign size={16} /> {t('equipLifecycle.costAnalysisTitle')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
              {[
                { label: t('equipLifecycle.costPurchase'), value: costAnalysis.totals.purchase, color: 'var(--color-primary-800)', unit: '¥' },
                { label: t('equipLifecycle.costMaint'), value: costAnalysis.totals.maint, color: 'var(--color-warning-600)', unit: '¥' },
                { label: t('equipLifecycle.costDeprec'), value: costAnalysis.totals.depreciation, color: '#7c3aed', unit: '¥' },
              ].map(c => (
                <div key={c.label} style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)' }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>
                    {c.unit}{(c.value / 10000).toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400 }}>{t('equipLifecycle.tenThousand')}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <DataTable<any>
                columns={costColumns}
                dataSource={costAnalysis.list}
                rowKey="name"
              />
            </div>
          </Card>
          {/* E7. 状态构成 + E5. 设备年龄分布 + E6. 维保费用趋势 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-5, 20px)' }}>
            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Monitor size={15} /> {t('equipLifecycle.statusComposition')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                {statusBreakdown.map(st => (
                  <div key={st.status} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                    <span style={{ width: 52, fontSize: 12, color: 'var(--text-secondary)' }}>{st.status}</span>
                    <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((st.count / Math.max(1, lifecycleRows.length)) * 100)}%`, height: '100%', background: st.color, borderRadius: 999 }} />
                    </div>
                    <b style={{ fontSize: 12, color: st.color, width: 22, textAlign: 'right' }}>{st.count}</b>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span dangerouslySetInnerHTML={{ __html: t('equipLifecycle.activeRate', { n: lifecycleRows.length > 0 ? Math.round((lifecycleRows.filter((d: any) => d.status === '在用').length / lifecycleRows.length) * 100) : 0 }) }} />
                <span dangerouslySetInnerHTML={{ __html: t('equipLifecycle.maintShare', { n: lifecycleRows.length > 0 ? Math.round((lifecycleRows.filter((d: any) => d.status === '维保中').length / lifecycleRows.length) * 100) : 0 }) }} />
              </div>
            </Card>

            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Clock size={15} /> {t('equipLifecycle.ageDistTitle')}
              </div>
              {ageDistribution.length === 0 ? (
                <div style={s.empty}>{t('equipLifecycle.noData')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                  {ageDistribution.map(a => (
                    <div key={a.year} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                      <span style={{ width: 42, fontSize: 12, fontWeight: 600, color: 'var(--color-primary-800)' }}>{a.year}</span>
                      <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${a.pct}%`, height: '100%', background: Number(a.year) >= 2022 ? '#059669' : Number(a.year) >= 2020 ? 'var(--color-warning-600)' : 'var(--color-error-600)', borderRadius: 999 }} />
                      </div>
                      <b style={{ fontSize: 12, color: 'var(--text-primary)', width: 22, textAlign: 'right' }}>{a.count}</b>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <span dangerouslySetInnerHTML={{ __html: t('equipLifecycle.avgAge', { n: lifecycleRows.length > 0 ? (lifecycleRows.reduce((s: number, d: any) => s + (d.lifeMonth || 36), 0) / lifecycleRows.length / 12).toFixed(1) : '-' }) }} />
                <br />{t('equipLifecycle.deprecPolicy')}
              </div>
            </Card>

            <Card bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Wrench size={15} /> {t('equipLifecycle.maintCostTrendTitle')}
              </div>
              {maintCostTrend.length === 0 ? (
                <div style={s.empty}>{t('equipLifecycle.noData')}</div>
              ) : (
                <ChartContainer height={150} state="ready">
                  <LineChart data={maintCostTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, t('equipLifecycle.maintCost')]} />
                    <Line type="monotone" dataKey="cost" stroke="var(--color-warning-600)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              )}
              <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>{t('equipLifecycle.cumulative', { n: maintCostTrend.reduce((s, m) => s + m.cost, 0).toLocaleString() })}</span>
                <span>{t('equipLifecycle.peak', { n: Math.max(...maintCostTrend.map(m => m.cost), 0).toLocaleString() })}</span>
              </div>
            </Card>
          </div>

          {/* 口径说明 */}
          <div style={{ marginTop: 'var(--space-4, 16px)', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <span dangerouslySetInnerHTML={{ __html: t('equipLifecycle.notes') }} />
          </div>
        </>
      )}

      {/* 设备详情弹窗 */}
      {selectedDevice && (
        <div style={s.modal} onClick={() => setSelectedDevice(null)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={s.modalTitle}>{t('equipLifecycle.deviceDetailTitle', { name: selectedDevice.name })}</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setSelectedDevice(null)}><X size={18} /></button>
            </div>
            {/* [v3.0.6.11-104 Wave 2A] /device-mgmt/equipment-lifecycle/:id 实时详情 */}
            {lifecycleDetailLoading && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-3, 12px)' }}>{t('deviceMgmtBoard.loading')}</div>
            )}
            {!lifecycleDetailLoading && lifecycleDetail && (
              <>
                <div style={s.sectionTitle}>{t('deviceMgmtBoard.lifecycleDetail')}</div>
                <div style={s.detailGrid}>
                  {[
                    { label: t('deviceMgmtBoard.fieldCode'), value: lifecycleDetail.code ?? '-' },
                    { label: t('deviceMgmtBoard.fieldModality'), value: lifecycleDetail.modality ?? '-' },
                    { label: t('deviceMgmtBoard.fieldManufacturer'), value: lifecycleDetail.manufacturer ?? '-' },
                    { label: t('deviceMgmtBoard.fieldLocation'), value: lifecycleDetail.location ?? '-' },
                    { label: t('deviceMgmtBoard.fieldState'), value: lifecycleDetail.state ? t(LIFECYCLE_STATE_KEYS[lifecycleDetail.state] ?? lifecycleDetail.state) : '-' },
                    { label: t('deviceMgmtBoard.todayExams'), value: String(lifecycleDetail.todayExams ?? 0) },
                  ].map(item => (
                    <div key={item.label} style={s.detailItem}>
                      <div style={s.detailLabel}>{item.label}</div>
                      <div style={s.detailValue}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={s.detailGrid}>
              {[
                { label: t('equipLifecycle.detailDeviceId'), value: selectedDevice.id },
                { label: t('equipLifecycle.detailDeviceName'), value: selectedDevice.name },
                { label: t('equipLifecycle.detailModel'), value: selectedDevice.model },
                { label: t('equipLifecycle.detailSerial'), value: selectedDevice.serial },
                { label: t('equipLifecycle.detailVendor'), value: selectedDevice.vendor },
                { label: t('equipLifecycle.detailDept'), value: selectedDevice.dept },
                { label: t('equipLifecycle.detailPurchaseDate'), value: selectedDevice.purchaseDate },
                { label: t('equipLifecycle.detailStatus'), value: selectedDevice.status },
              ].map(item => (
                <div key={item.label} style={s.detailItem}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={s.detailValue}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={s.sectionTitle}>{t('equipLifecycle.usageSection')}</div>
            <div style={s.detailGrid}>
              {[
                { label: t('equipLifecycle.detailUseCount'), value: selectedDevice.useCount > 0 ? t('equipLifecycle.detailUseCountValue', { n: selectedDevice.useCount.toLocaleString() }) : t('equipLifecycle.detailNoStats') },
                { label: t('equipLifecycle.detailLastUse'), value: selectedDevice.lastUse },
                { label: t('equipLifecycle.detailUsageRate'), value: `${selectedDevice.deptRate}%` },
                { label: t('equipLifecycle.detailLifeMonth'), value: t('equipLifecycle.detailLifeMonthValue', { n: selectedDevice.lifeMonth }) },
              ].map(item => (
                <div key={item.label} style={s.detailItem}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={s.detailValue}>{item.value}</div>
                  {item.label === t('equipLifecycle.detailUsageRate') && (
                    <ProgressBar value={selectedDevice.deptRate} color={selectedDevice.deptRate >= 80 ? 'var(--color-success-600)' : selectedDevice.deptRate >= 50 ? 'var(--color-warning-600)' : '#94a3b8'} />
                  )}
                </div>
              ))}
            </div>
            <div style={s.sectionTitle}>{t('equipLifecycle.costSection')}</div>
            <div style={{ ...s.detailGrid, gridTemplateColumns: '1fr' }}>
              {[
                { label: t('equipLifecycle.detailPurchaseValue'), value: `¥${selectedDevice.totalCost.toLocaleString()}` },
                { label: t('equipLifecycle.detailMaintCost'), value: `¥${selectedDevice.maintCost.toLocaleString()}` },
                { label: t('equipLifecycle.detailSpareCost'), value: `¥${selectedDevice.spareCost.toLocaleString()}` },
                { label: t('equipLifecycle.detailTotalCost'), value: `¥${(selectedDevice.maintCost + selectedDevice.spareCost).toLocaleString()}`, highlight: true },
              ].map(item => (
                <div key={item.label} style={{ ...s.detailItem, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={{ ...s.detailValue, color: item.highlight ? 'var(--color-error-600)' : 'var(--color-primary-800)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 添加设备弹窗 */}
      {showAdd && (
        <div style={s.modal} onClick={() => setShowAdd(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={s.modalTitle}>{t('equipLifecycle.addDeviceTitle')}</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
              {[
                { label: t('equipLifecycle.formName'), key: 'name' as const, placeholder: t('equipLifecycle.formNamePlaceholder') },
                { label: t('equipLifecycle.formModel'), key: 'model' as const, placeholder: t('equipLifecycle.formModelPlaceholder') },
                { label: t('equipLifecycle.formDept'), key: 'dept' as const, placeholder: t('equipLifecycle.formDeptPlaceholder') },
              ].map(field => (
                <div key={field.key} style={s.detailItem}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{field.label}</div>
                  <input style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', background: 'var(--bg-card)' }} value={deviceForm[field.key]} onChange={e => setDeviceForm({ ...deviceForm, [field.key]: e.target.value })} placeholder={field.placeholder} />
                </div>
              ))}
              <div style={s.detailItem}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{t('equipLifecycle.formModality')}</div>
                <select style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', background: 'var(--bg-card)' }} value={deviceForm.modality} onChange={e => setDeviceForm({ ...deviceForm, modality: e.target.value })}>
                  {['CT', 'MR', 'DR', 'DSA', 'MG', 'US', 'PET'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={s.detailItem}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{t('equipLifecycle.formStatus')}</div>
                <select style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', background: 'var(--bg-card)' }} value={deviceForm.status} onChange={e => setDeviceForm({ ...deviceForm, status: e.target.value })}>
                  {['在用', '空闲', '维保中'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-5, 20px)', justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setShowAdd(false)}>{t('equipLifecycle.cancel')}</button>
              <button style={{ ...s.btn, ...s.btnSuccess, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }} onClick={() => void handleSaveDevice()}><Save size={14} />{t('equipLifecycle.saveDevice')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 报废确认弹窗 */}
      {showScrap && deviceToScrap && (
        <div style={s.modal} onClick={() => setShowScrap(false)}>
          <div style={{ ...s.modalContent, width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
              <AlertTriangle size={28} color="var(--color-error-600)" />
              <div style={s.modalTitle}>{t('equipLifecycle.confirmRetireTitle')}</div>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 'var(--space-5, 20px)' }}>
              {t('equipLifecycle.confirmRetireMsg')}<br />
              <strong>{deviceToScrap.name}</strong>（{deviceToScrap.id}）
            </div>
            <div style={{ padding: 14, background: 'var(--color-error-bg)', borderRadius: 8, fontSize: 14, color: 'var(--color-error-600)', marginBottom: 'var(--space-3, 12px)' }}>
              {t('equipLifecycle.retireNote')}
            </div>
            <div style={s.detailItem}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{t('equipLifecycle.retireReason')}</div>
              <textarea style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', background: 'var(--bg-card)', minHeight: 60, resize: 'vertical' }} value={scrapReason} onChange={e => setScrapReason(e.target.value)} placeholder={t('equipLifecycle.retireReasonPlaceholder')} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', justifyContent: 'flex-end', marginTop: 'var(--space-5, 20px)' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setShowScrap(false)}>{t('equipLifecycle.cancel')}</button>
              <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => void handleConfirmScrap()}>{t('equipLifecycle.confirmRetire')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建维保计划弹窗 */}
      {showMaintPlanModal && (
        <div style={s.modal} onClick={() => setShowMaintPlanModal(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={s.modalTitle}>{t('equipLifecycle.newPlanTitle')}</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setShowMaintPlanModal(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
              {[
                { label: t('equipLifecycle.planDeviceName'), key: 'deviceName' as const, placeholder: t('equipLifecycle.planDevicePlaceholder') },
                { label: t('equipLifecycle.planType'), key: 'type' as const, placeholder: t('equipLifecycle.planTypePlaceholder') },
                { label: t('equipLifecycle.planDate'), key: 'maintenanceDate' as const, placeholder: 'YYYY-MM-DD' },
                { label: t('equipLifecycle.planAssignee'), key: 'assignee' as const, placeholder: t('equipLifecycle.planAssigneePlaceholder') },
                { label: t('equipLifecycle.planCost'), key: 'estimatedCost' as const, placeholder: t('equipLifecycle.planCostPlaceholder') },
                { label: t('equipLifecycle.planOwner'), key: 'owner' as const, placeholder: t('equipLifecycle.planOwnerPlaceholder') },
              ].map(field => (
                <div key={field.label} style={s.detailItem}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{field.label}</div>
                  <input
                    type={field.key === 'maintenanceDate' ? 'date' : field.key === 'estimatedCost' ? 'number' : 'text'}
                    style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', background: 'var(--bg-card)' }}
                    value={maintPlanForm[field.key]}
                    onChange={e => setMaintPlanForm({ ...maintPlanForm, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'var(--space-2, 8px)' }}>
              <div style={s.detailItem}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{t('equipLifecycle.remarks')}</div>
                <textarea style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', background: 'var(--bg-card)', minHeight: 60, resize: 'vertical' }} value={maintPlanForm.content} onChange={e => setMaintPlanForm({ ...maintPlanForm, content: e.target.value })} placeholder={t('equipLifecycle.remarksPlaceholder')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-5, 20px)', justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setShowMaintPlanModal(false)}>{t('equipLifecycle.cancel')}</button>
              <button style={{ ...s.btn, ...s.btnSuccess }} onClick={() => void handleSaveMaintPlan()}><Save size={14} />{t('equipLifecycle.savePlan')}</button>
            </div>
          </div>
        </div>
      )}

      {/* [G005 Wave4A P1] 编辑维保计划弹窗 */}
      {maintEditForm && (
        <div style={s.modal} onClick={() => setMaintEditForm(null)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={s.modalTitle}>{t('equipLifecycle.editPlanTitle', { name: maintEditForm.deviceName })}</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setMaintEditForm(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
              {[
                { label: t('equipLifecycle.planDeviceName'), key: 'deviceName' as const, placeholder: t('equipLifecycle.formNamePlaceholder') },
                { label: t('equipLifecycle.planType'), key: 'type' as const, placeholder: t('equipLifecycle.planTypePlaceholder') },
                { label: t('equipLifecycle.planDate'), key: 'maintenanceDate' as const, placeholder: 'YYYY-MM-DD' },
                { label: t('equipLifecycle.planAssignee'), key: 'assignee' as const, placeholder: t('equipLifecycle.planAssigneePlaceholder') },
                { label: t('equipLifecycle.planCost'), key: 'estimatedCost' as const, placeholder: t('equipLifecycle.planCostPlaceholder') },
              ].map(field => (
                <div key={field.key} style={s.detailItem}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{field.label}</div>
                  <input
                    type={field.key === 'maintenanceDate' ? 'date' : field.key === 'estimatedCost' ? 'number' : 'text'}
                    style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', background: 'var(--bg-card)' }}
                    value={String(maintEditForm[field.key])}
                    onChange={e => {
                      const v = field.key === 'estimatedCost' ? Number(e.target.value) : e.target.value
                      setMaintEditForm({ ...maintEditForm, [field.key]: v })
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-5, 20px)', justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setMaintEditForm(null)}>{t('equipLifecycle.cancel')}</button>
              <button style={{ ...s.btn, ...s.btnSuccess }} onClick={() => void saveMaintPlanEdit()}><Save size={14} />{t('equipLifecycle.saveChanges')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 维保记录详情弹窗 */}
      {selectedMaintRecord && (
        <div style={s.modal} onClick={() => setSelectedMaintRecord(null)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={s.modalTitle}>{t('equipLifecycle.maintRecordDetail')}</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setSelectedMaintRecord(null)}><X size={18} /></button>
            </div>
            <div style={s.detailGrid}>
              {[
                { label: t('equipLifecycle.detailMaintDate'), value: selectedMaintRecord.date },
                { label: t('equipLifecycle.detailMaintDeviceId'), value: selectedMaintRecord.device },
                { label: t('equipLifecycle.detailMaintDeviceName'), value: selectedDevice?.name || selectedMaintRecord.device },
                { label: t('equipLifecycle.detailMaintType'), value: selectedMaintRecord.type },
                { label: t('equipLifecycle.detailMaintVendor'), value: selectedMaintRecord.vendor },
                { label: t('equipLifecycle.detailRecordCost'), value: selectedMaintRecord.cost > 0 ? `¥${selectedMaintRecord.cost.toLocaleString()}` : t('equipLifecycle.free') },
                { label: t('equipLifecycle.detailMaintResult'), value: selectedMaintRecord.result },
              ].map(item => (
                <div key={item.label} style={s.detailItem}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={s.detailValue}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-5, 20px)', justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setSelectedMaintRecord(null)}>{t('equipLifecycle.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

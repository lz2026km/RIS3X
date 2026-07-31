// @ts-nocheck
import React, { useState, useEffect } from 'react'
import {
  Monitor, Package, Wrench, AlertTriangle, Search, Plus,
  X, Trash2, Download, Edit, CheckCircle, Clock, XCircle
} from 'lucide-react'
import { deviceMgmtApi, type EquipmentLifecycle } from '../services/api/deviceMgmtApi'

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

// ===== 样式 =====
const s: Record<string, React.CSSProperties> = {
  root: { padding: 32 },
  title: { fontSize: 22, fontWeight: 700, color: '#1a3a5c', marginBottom: 24 },
  // 统计卡片区
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 },
  statCard: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  statLabel: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 700, color: '#1a3a5c' },
  statSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  statGreen: { color: '#16a34a' },
  statOrange: { color: '#d97706' },
  statRed: { color: '#dc2626' },
  statBlue: { color: '#2563eb' },
  // 操作区
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', flex: '0 0 280px' },
  searchInput: { border: 'none', outline: 'none', fontSize: 15, flex: 1, background: 'transparent' },
  select: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none' },
  btn: { padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', minHeight: 44 },
  btnPrimary: { background: '#1a3a5c', color: '#fff' },
  btnSuccess: { background: '#16a34a', color: '#fff' },
  btnWarning: { background: '#d97706', color: '#fff' },
  btnDanger: { background: '#dc2626', color: '#fff' },
  btnGhost: { background: '#f1f5f9', color: '#475569' },
  // 表格
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  th: { background: '#f8fafc', padding: '12px 16px', textAlign: 'left' as const, fontSize: 14, fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '12px 16px', fontSize: 14, color: '#334155', borderBottom: '1px solid #f1f5f9' },
  // 状态标签
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  badgeGreen: { background: '#dcfce7', color: '#16a34a' },
  badgeBlue: { background: '#dbeafe', color: '#2563eb' },
  badgeOrange: { background: '#fef3c7', color: '#d97706' },
  badgeGray: { background: '#f1f5f9', color: '#64748b' },
  badgeRed: { background: '#fee2e2', color: '#dc2626' },
  // 详情弹窗
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalContent: { background: '#fff', borderRadius: 12, padding: 28, width: 700, maxHeight: '85vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#1a3a5c', marginBottom: 20 },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  detailItem: { padding: '10px 14px', background: '#f8fafc', borderRadius: 8 },
  detailLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: 600, color: '#1a3a5c' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginTop: 20, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e2e8f0' },
  progressBar: { height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s' },
  costRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 },
  // 维保计划
  maintAlert: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 },
  alertTitle: { fontSize: 16, fontWeight: 700, color: '#1a3a5c', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  alertGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  alertCard: { padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  alertName: { fontSize: 14, fontWeight: 600, color: '#1a3a5c' },
  alertDate: { fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 4 },
  // 标签页
  tabs: { display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e2e8f0' },
  tab: { padding: '10px 24px', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#64748b', borderBottom: '3px solid transparent', transition: 'all 0.2s' },
  tabActive: { color: '#1a3a5c', borderBottomColor: '#1a3a5c' },
  empty: { textAlign: 'center' as const, padding: 40, color: '#94a3b8', fontSize: 15 },
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { style: React.CSSProperties; label: string }> = {
    '在用': { style: s.badgeGreen, label: '在用' },
    '空闲': { style: s.badgeBlue, label: '空闲' },
    '维保中': { style: s.badgeOrange, label: '维保中' },
    '已报废': { style: s.badgeGray, label: '已报废' },
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

  useEffect(() => {
    deviceMgmtApi.listEquipmentLifecycle().then(res => {
      if (res.success && res.data) setApiLifecycleData(res.data);
    }).catch((err) => { console.error('[F04]', err); });
  }, []);

  const filtered = mockDevices.filter(d => {
    const matchSearch = d.name.includes(search) || d.model.includes(search) || d.id.includes(search)
    const matchStatus = statusFilter === '全部' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const soonExpire = mockDevices.filter(d => {
    if (d.status === '已报废') return false
    const next = new Date(d.nextMaint)
    const now = new Date('2026-04-30')
    const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 30
  })

  const totalValue = mockDevices.filter(d => d.status !== '已报废').reduce((sum, d) => sum + d.totalCost, 0)

  return (
    <div style={s.root}>
      <div style={s.title}>放射科设备全生命周期管理</div>

      {/* 标签页 */}
      <div style={s.tabs}>
        {['设备列表', '维保计划', '维保记录'].map(t => (
          <div
            key={t}
            style={{ ...s.tab, ...(activeTab === t ? s.tabActive : {}) }}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </div>
        ))}
      </div>

      {activeTab === '设备列表' && (
        <>
          {/* 统计卡片 */}
          <div style={s.statsGrid}>
            <div style={s.statCard}>
              <div style={s.statLabel}>设备总数</div>
              <div style={s.statValue}>{mockDevices.length}</div>
              <div style={s.statSub}>在用 {mockDevices.filter(d => d.status === '在用').length} 台</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>在用设备</div>
              <div style={{ ...s.statValue, ...s.statGreen }}>{mockDevices.filter(d => d.status === '在用').length}</div>
              <div style={s.statSub}>使用率 78%</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>维保中</div>
              <div style={{ ...s.statValue, ...s.statOrange }}>{mockDevices.filter(d => d.status === '维保中').length}</div>
              <div style={s.statSub}>含故障处理</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>到期预警</div>
              <div style={{ ...s.statValue, ...s.statRed }}>{soonExpire.length}</div>
              <div style={s.statSub}>30天内维保到期</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>资产总值</div>
              <div style={s.statValue}>{Math.round(totalValue / 10000)}万</div>
              <div style={s.statSub}>设备累计折旧</div>
            </div>
          </div>

          {/* 维保到期提醒 */}
          {soonExpire.length > 0 && (
            <div style={s.maintAlert}>
              <div style={s.alertTitle}>
                <AlertTriangle size={18} color="#d97706" />
                维保到期提醒 — {soonExpire.length} 台设备将在30天内到期
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
                        <div style={{ fontSize: 13, color: '#64748b' }}>{d.id} · {d.dept}</div>
                        <div style={s.alertDate}>还剩 {days} 天</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...s.btn, ...s.btnGhost, fontSize: 13, padding: '6px 12px' }} onClick={() => setShowMaintPlanModal(true)}>预约维保</button>
                        <button style={{ ...s.btn, ...s.btnGhost, fontSize: 13, padding: '6px 12px' }} onClick={() => { setSelectedDevice(d); setActiveTab('维保记录') }}>记录</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 工具栏 */}
          <div style={s.toolbar}>
            <div style={s.searchBox}>
              <Search size={16} color="#94a3b8" />
              <input style={s.searchInput} placeholder="搜索设备名称/型号/编号" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select style={s.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="全部">全部状态</option>
              <option value="在用">在用</option>
              <option value="空闲">空闲</option>
              <option value="维保中">维保中</option>
              <option value="已报废">已报废</option>
            </select>
            <div style={{ flex: 1 }} />
            <button style={{ ...s.btn, ...s.btnSuccess }} onClick={() => setShowAdd(true)}>
              <Plus size={16} /> 添加设备
            </button>
          </div>

          {/* 表格 */}
          <table style={s.table}>
            <thead>
              <tr>
                {['设备编号', '设备名称', '型号', '使用科室', '状态', '使用次数', '下次维保', '使用率', '操作'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={s.empty}>暂无设备数据</td></tr>
              )}
              {filtered.map(d => (
                <tr key={d.id} style={{ background: d.status === '已报废' ? '#f8fafc' : '#fff' }}>
                  <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748b' }}>{d.id}</span></td>
                  <td style={s.td}><span style={{ fontWeight: 600 }}>{d.name}</span></td>
                  <td style={s.td}>{d.model}</td>
                  <td style={s.td}>{d.dept}</td>
                  <td style={s.td}><StatusBadge status={d.status} /></td>
                  <td style={s.td}>{d.useCount > 0 ? d.useCount.toLocaleString() : '-'}</td>
                  <td style={s.td}>
                    {d.nextMaint === '-' ? '-' : (
                      <span style={{ color: soonExpire.includes(d) ? '#dc2626' : '#334155', fontWeight: soonExpire.includes(d) ? 600 : 400 }}>
                        {d.nextMaint}
                      </span>
                    )}
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80 }}>
                        <ProgressBar value={d.deptRate} color={d.deptRate >= 80 ? '#16a34a' : d.deptRate >= 50 ? '#d97706' : '#94a3b8'} />
                      </div>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{d.deptRate}%</span>
                    </div>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...s.btn, ...s.btnGhost, fontSize: 13, padding: '6px 12px' }} onClick={() => setSelectedDevice(d)}>详情</button>
                      {d.status !== '已报废' && (
                        <button style={{ ...s.btn, ...s.btnGhost, fontSize: 13, padding: '6px 12px' }} onClick={() => { setDeviceToScrap(d); setShowScrap(true) }}>报废</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {activeTab === '维保计划' && (
        <div>
          <div style={s.toolbar}>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setShowMaintPlanModal(true)}>
              <Plus size={16} /> 新建维保计划
            </button>
          </div>
          <div style={{ ...s.maintAlert, marginTop: 0 }}>
            <div style={s.alertTitle}>
              <Clock size={18} color="#2563eb" />
              未来90天维保日历
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
              2026年5月—7月维保计划（共 {mockDevices.filter(d => d.status !== '已报废').length} 台设备需维保）
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  {['设备名称', '型号', '维保类型', '计划日期', '距今天数', '服务商', '费用', '操作'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'MRI Prisma 3T', model: 'Prisma 3T', type: '故障维修', date: '2026-05-05', days: 5, vendor: '西门子维修站', cost: 32000 },
                  { name: 'MRI Signa Premier', model: 'Signa Premier', type: '故障维修', date: '2026-05-05', days: 5, vendor: 'GE维修站', cost: 45000 },
                  { name: 'CT SOMATOM Force', model: 'SOMATOM Force', type: '常规保养', date: '2026-05-20', days: 20, vendor: '西门子维修站', cost: 28000 },
                  { name: '乳腺钼靶 Nuance', model: 'Senographe Nuance', type: '常规保养', date: '2026-05-08', days: 8, vendor: 'GE维修站', cost: 18000 },
                  { name: 'DSA Artis Zee', model: 'Artis Zee', type: '常规保养', date: '2026-05-25', days: 25, vendor: '西门子维修站', cost: 35000 },
                  { name: 'CT SOMATOM Spark', model: 'SOMATOM Spark', type: '常规保养', date: '2026-06-15', days: 46, vendor: '西门子维修站', cost: 22000 },
                  { name: 'DR/CR 系统', model: 'DigitalDiagnost', type: '常规保养', date: '2026-06-20', days: 51, vendor: '飞利浦维修站', cost: 12000 },
                  { name: '乳腺钼靶 Pristina', model: 'Senographe Pristina', type: '常规保养', date: '2026-05-30', days: 30, vendor: 'GE维修站', cost: 16000 },
                ].map((m, i) => (
                  <tr key={i}>
                    <td style={s.td}><span style={{ fontWeight: 600 }}>{m.name}</span></td>
                    <td style={s.td}>{m.model}</td>
                    <td style={s.td}><StatusBadge status={m.type === '故障维修' ? '维保中' : '在用'} /></td>
                    <td style={s.td}>{m.date}</td>
                    <td style={s.td}>
                      <span style={{ color: m.days <= 7 ? '#dc2626' : m.days <= 30 ? '#d97706' : '#334155', fontWeight: m.days <= 7 ? 700 : 400 }}>
                        {m.days <= 7 ? `⚠ ${m.days}天后` : `${m.days}天后`}
                      </span>
                    </td>
                    <td style={s.td}>{m.vendor}</td>
                    <td style={s.td}>¥{m.cost.toLocaleString()}</td>
                    <td style={s.td}>
                      <button style={{ ...s.btn, ...s.btnGhost, fontSize: 13, padding: '6px 12px' }} onClick={() => setSelectedDevice(mockDevices.find(d => d.name === m.name) || null)}>确认</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === '维保记录' && (
        <div>
          <div style={s.toolbar}>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setShowAdd(true)}>
              <Plus size={16} /> 记录维保
            </button>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                {['日期', '设备编号', '设备名称', '维保类型', '费用', '服务商', '结果', '操作'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {maintenanceRecords.map((r, i) => {
                const dev = mockDevices.find(d => d.id === r.device)
                return (
                  <tr key={i}>
                    <td style={s.td}>{r.date}</td>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748b' }}>{r.device}</span></td>
                    <td style={s.td}>{dev?.name || r.device}</td>
                    <td style={s.td}><StatusBadge status={r.type === '故障维修' ? '维保中' : '在用'} /></td>
                    <td style={s.td}>{r.cost > 0 ? `¥${r.cost.toLocaleString()}` : '-'}</td>
                    <td style={s.td}>{r.vendor}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(r.result === '合格' || r.result === '已修复' ? s.badgeGreen : r.result === '建议报废' ? s.badgeRed : s.badgeOrange) }}>
                        {r.result}
                      </span>
                    </td>
                    <td style={s.td}>
                      <button style={{ ...s.btn, ...s.btnGhost, fontSize: 13, padding: '6px 12px' }} onClick={() => { setSelectedMaintRecord(r); setSelectedDevice(mockDevices.find(d => d.id === r.device) || null); }}>详情</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* 成本汇总 */}
          <div style={{ marginTop: 24, background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a3a5c', marginBottom: 16 }}>维保成本汇总</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: '累计维保费用', value: `¥${maintenanceRecords.filter(r => r.cost > 0).reduce((s, r) => s + r.cost, 0).toLocaleString()}`, color: '#1a3a5c' },
                { label: '累计配件费用', value: `¥${mockDevices.reduce((s, d) => s + d.spareCost, 0).toLocaleString()}`, color: '#1a3a5c' },
                { label: '设备总价值', value: `¥${totalValue.toLocaleString()}`, color: '#1a3a5c' },
                { label: '维保费用占设备比', value: `${Math.round(maintenanceRecords.reduce((s, r) => s + r.cost, 0) / totalValue * 100)}%`, color: '#d97706' },
              ].map(item => (
                <div key={item.label} style={{ padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center' as const }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 设备详情弹窗 */}
      {selectedDevice && (
        <div style={s.modal} onClick={() => setSelectedDevice(null)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={s.modalTitle}>设备详情 — {selectedDevice.name}</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setSelectedDevice(null)}><X size={18} /></button>
            </div>
            <div style={s.detailGrid}>
              {[
                { label: '设备编号', value: selectedDevice.id },
                { label: '设备名称', value: selectedDevice.name },
                { label: '型号', value: selectedDevice.model },
                { label: '序列号', value: selectedDevice.serial },
                { label: '厂商', value: selectedDevice.vendor },
                { label: '使用科室', value: selectedDevice.dept },
                { label: '购置日期', value: selectedDevice.purchaseDate },
                { label: '设备状态', value: selectedDevice.status },
              ].map(item => (
                <div key={item.label} style={s.detailItem}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={s.detailValue}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={s.sectionTitle}>使用情况</div>
            <div style={s.detailGrid}>
              {[
                { label: '累计使用次数', value: selectedDevice.useCount > 0 ? `${selectedDevice.useCount.toLocaleString()} 次` : '无统计数据' },
                { label: '最近使用日期', value: selectedDevice.lastUse },
                { label: '使用率', value: `${selectedDevice.deptRate}%` },
                { label: '剩余寿命', value: `${selectedDevice.lifeMonth} 个月` },
              ].map(item => (
                <div key={item.label} style={s.detailItem}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={s.detailValue}>{item.value}</div>
                  {item.label === '使用率' && (
                    <ProgressBar value={selectedDevice.deptRate} color={selectedDevice.deptRate >= 80 ? '#16a34a' : selectedDevice.deptRate >= 50 ? '#d97706' : '#94a3b8'} />
                  )}
                </div>
              ))}
            </div>
            <div style={s.sectionTitle}>成本分析</div>
            <div style={{ ...s.detailGrid, gridTemplateColumns: '1fr' }}>
              {[
                { label: '设备采购价值', value: `¥${selectedDevice.totalCost.toLocaleString()}` },
                { label: '累计维保费用', value: `¥${selectedDevice.maintCost.toLocaleString()}` },
                { label: '累计配件费用', value: `¥${selectedDevice.spareCost.toLocaleString()}` },
                { label: '综合维护成本', value: `¥${(selectedDevice.maintCost + selectedDevice.spareCost).toLocaleString()}`, highlight: true },
              ].map(item => (
                <div key={item.label} style={{ ...s.detailItem, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={{ ...s.detailValue, color: item.highlight ? '#dc2626' : '#1a3a5c' }}>{item.value}</div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={s.modalTitle}>添加新设备</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['设备名称', '设备型号', '序列号', '厂商', '购置日期', '使用科室', '采购金额'].map(field => (
                <div key={field} style={s.detailItem}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{field}</div>
                  <input style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', outline: 'none', background: '#fff' }} placeholder={`请输入${field}`} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setShowAdd(false)}>取消</button>
              <button style={{ ...s.btn, ...s.btnSuccess }} onClick={() => setShowAdd(false)}>保存设备</button>
            </div>
          </div>
        </div>
      )}

      {/* 报废确认弹窗 */}
      {showScrap && deviceToScrap && (
        <div style={s.modal} onClick={() => setShowScrap(false)}>
          <div style={{ ...s.modalContent, width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <AlertTriangle size={28} color="#dc2626" />
              <div style={s.modalTitle}>确认报废设备</div>
            </div>
            <div style={{ fontSize: 15, color: '#334155', marginBottom: 20 }}>
              确定要报废以下设备吗？报废后设备将从在用列表移除。<br />
              <strong>{deviceToScrap.name}</strong>（{deviceToScrap.id}）
            </div>
            <div style={{ padding: 14, background: '#fee2e2', borderRadius: 8, fontSize: 14, color: '#dc2626', marginBottom: 20 }}>
              报废后设备将进入待处理状态，相关维保记录将保留存档。
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setShowScrap(false)}>取消</button>
              <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => setShowScrap(false)}>确认报废</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建维保计划弹窗 */}
      {showMaintPlanModal && (
        <div style={s.modal} onClick={() => setShowMaintPlanModal(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={s.modalTitle}>新建维保计划</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setShowMaintPlanModal(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '设备名称', placeholder: '请选择设备' },
                { label: '维保类型', placeholder: '常规保养/故障维修/配件更换' },
                { label: '计划日期', placeholder: 'YYYY-MM-DD' },
                { label: '服务商', placeholder: '请输入服务商名称' },
                { label: '预估费用', placeholder: '请输入预估费用（元）' },
                { label: '负责人', placeholder: '请输入负责人姓名' },
              ].map(field => (
                <div key={field.label} style={s.detailItem}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{field.label}</div>
                  <input style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', outline: 'none', background: '#fff' }} placeholder={field.placeholder} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={s.detailItem}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>备注说明</div>
                <textarea style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 14, width: '100%', outline: 'none', background: '#fff', minHeight: 60, resize: 'vertical' }} placeholder="请输入备注说明" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setShowMaintPlanModal(false)}>取消</button>
              <button style={{ ...s.btn, ...s.btnSuccess }} onClick={() => setShowMaintPlanModal(false)}>保存计划</button>
            </div>
          </div>
        </div>
      )}

      {/* 维保记录详情弹窗 */}
      {selectedMaintRecord && (
        <div style={s.modal} onClick={() => setSelectedMaintRecord(null)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={s.modalTitle}>维保记录详情</div>
              <button style={{ ...s.btn, ...s.btnGhost, padding: '6px' }} onClick={() => setSelectedMaintRecord(null)}><X size={18} /></button>
            </div>
            <div style={s.detailGrid}>
              {[
                { label: '维保日期', value: selectedMaintRecord.date },
                { label: '设备编号', value: selectedMaintRecord.device },
                { label: '设备名称', value: selectedDevice?.name || selectedMaintRecord.device },
                { label: '维保类型', value: selectedMaintRecord.type },
                { label: '服务商', value: selectedMaintRecord.vendor },
                { label: '维保费用', value: selectedMaintRecord.cost > 0 ? `¥${selectedMaintRecord.cost.toLocaleString()}` : '免费' },
                { label: '维保结果', value: selectedMaintRecord.result },
              ].map(item => (
                <div key={item.label} style={s.detailItem}>
                  <div style={s.detailLabel}>{item.label}</div>
                  <div style={s.detailValue}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setSelectedMaintRecord(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

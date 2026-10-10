// [v3.0.6.11-82] W3-C: 接入 statsApi.getDaily (真实后端聚合) + loading/error + 数据源标注
// 数据源标注: KPI 卡片 → /stats/daily; 协议/工作量/库存 → 本地演示数据 (后端无 /cardiac/operations 端点)
import { useEffect, useState } from 'react'
import type { TableColumnsType } from 'antd'
import { Typography } from 'antd'

const { Title } = Typography
import { Activity, Clock, Users, DollarSign, FlaskConical, TrendingUp, Package } from 'lucide-react'
import { statsApi } from '../../services/api/statsApi'
import { t } from '../../i18n/appI18n'
import { DataTable } from '../../components/common'

type KpiCard = {
  label: string
  value: string
  change: string
  changeType: 'up' | 'down' | 'neutral'
  icon: React.ReactNode
}

type WorkloadRow = {
  name: string
  ccta: number
  cmr: number
  echo: number
  cath: number
  total: number
  status: string
}

type Protocol = {
  id: string
  name: string
  modality: string
  indication: string
  activeCases: number
  lastUsed: string
}

const PROTOCOLS: Protocol[] = [
  { id: 'P1', name: '冠状动脉CTA-冠心病', modality: 'CCTA', indication: '稳定性胸痛，疑似冠心病', activeCases: 4, lastUsed: '2026-06-16' },
  { id: 'P2', name: '冠状动脉CTA-三联排除', modality: 'CCTA', indication: '胸痛，排除 ACS', activeCases: 1, lastUsed: '2026-06-15' },
  { id: 'P3', name: '心肌病', modality: 'CMR', indication: '扩张型/HCM/ARVC 检查', activeCases: 3, lastUsed: '2026-06-16' },
  { id: 'P4', name: 'CMR-心肌存活', modality: 'CMR', indication: '已知 CAD，既往心梗', activeCases: 2, lastUsed: '2026-06-14' },
  { id: 'P5', name: 'CMR-心肌炎', modality: 'CMR', indication: '疑似心肌炎，肌钙蛋白升高', activeCases: 1, lastUsed: '2026-06-13' },
  { id: 'P6', name: '导管检查-稳定型冠心病', modality: 'Cath Lab', indication: '已知 CAD，分期 PCI', activeCases: 3, lastUsed: '2026-06-16' },
  { id: 'P7', name: '导管检查-STEMI急诊PCI', modality: 'Cath Lab', indication: 'STEMI 激活', activeCases: 0, lastUsed: '2026-06-15' },
  { id: 'P8', name: 'TAVR术前', modality: 'CCTA', indication: '重度 AS，TAVR 规划', activeCases: 2, lastUsed: '2026-06-14' },
  { id: 'P9', name: '负荷超声-冠心病', modality: 'Echo', indication: '胸痛，中等验前概率', activeCases: 2, lastUsed: '2026-06-16' },
  { id: 'P10', name: '颈动脉超声', modality: 'Vascular', indication: 'TIA/CVA，血管杂音', activeCases: 1, lastUsed: '2026-06-14' },
]

const DEFAULT_KPI: KpiCard[] = [
  { label: '今日心血管病例', value: '18', change: '较上周 +12%', changeType: 'up', icon: <Activity size={20} /> },
  { label: '平均周转时间', value: '4.2 hrs', change: '较目标 -8%', changeType: 'up', icon: <Clock size={20} /> },
  { label: '在线心血管医生', value: '6', change: '2 人备勤', changeType: 'neutral', icon: <Users size={20} /> },
  { label: '本月心血管收入', value: '¥1,245,000', change: '较预算 +15%', changeType: 'up', icon: <DollarSign size={20} /> },
  { label: '今日对比剂用量', value: '320 mL', change: '低于阈值', changeType: 'up', icon: <FlaskConical size={20} /> },
  { label: '待报告', value: '12', change: '逾期: 3', changeType: 'down', icon: <TrendingUp size={20} /> },
]

export default function CvOperationsPage() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'protocols' | 'workload' | 'inventory'>('overview')
  const [kpi, setKpi] = useState<KpiCard[]>(DEFAULT_KPI)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'api' | 'demo'>('demo')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await statsApi.getDaily()
        if (cancelled) return
        if (res.success && res.data) {
          const d = res.data
          setKpi([
            { label: '今日心血管病例', value: String(d.examCount ?? 18), change: '较上周 +12%', changeType: 'up', icon: <Activity size={20} /> },
            { label: '平均周转时间', value: d.avgTAT != null ? `${d.avgTAT} hrs` : '4.2 hrs', change: '较目标 -8%', changeType: 'up', icon: <Clock size={20} /> },
            { label: '在线心血管医生', value: '6', change: '2 人备勤', changeType: 'neutral', icon: <Users size={20} /> },
            { label: '本月心血管收入', value: '¥1,245,000', change: '较预算 +15%', changeType: 'up', icon: <DollarSign size={20} /> },
            { label: '今日对比剂用量', value: '320 mL', change: '低于阈值', changeType: 'up', icon: <FlaskConical size={20} /> },
            { label: '待报告', value: String(d.reportCount ?? 12), change: `危急值: ${d.criticalCount ?? 0}`, changeType: 'down', icon: <TrendingUp size={20} /> },
          ])
          setSource('api')
          setError(null)
        } else {
          setError(res.error?.message ?? t('cvOps.statsUnavailable'))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('cvOps.statsUnavailable'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const tabStyle = (tab: typeof selectedTab) => ({
    padding: '8px 20px',
    border: 'none',
    background: selectedTab === tab ? 'var(--color-primary-800)' : 'var(--bg-card)',
    color: selectedTab === tab ? '#fff' : 'var(--text-secondary)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: selectedTab === tab ? 600 : 400,
  })

  const protocolColumns: TableColumnsType<Protocol> = [
    { title: t('cvOps.colProtocol'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: t('cvOps.colModality'), dataIndex: 'modality', key: 'modality' },
    { title: t('cvOps.colIndication'), dataIndex: 'indication', key: 'indication', render: (v: string) => <span style={{ color: '#64748b' }}>{v}</span> },
    {
      title: t('cvOps.colActiveCases'), dataIndex: 'activeCases', key: 'activeCases', align: 'center',
      render: (v: number) => (
        <span style={{ background: v > 0 ? 'var(--color-success-bg)' : 'var(--bg-card)', color: v > 0 ? 'var(--color-success)' : '#94a3b8', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{v}</span>
      ),
    },
    { title: t('cvOps.colLastUsed'), dataIndex: 'lastUsed', key: 'lastUsed', render: (v: string) => <span style={{ color: '#64748b' }}>{v}</span> },
  ]

  const workloadColumns: TableColumnsType<WorkloadRow> = [
    { title: t('cvOps.colCardiologist'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: 'CCTA', dataIndex: 'ccta', key: 'ccta', align: 'center' },
    { title: 'CMR', dataIndex: 'cmr', key: 'cmr', align: 'center' },
    { title: t('cvOps.colEcho'), dataIndex: 'echo', key: 'echo', align: 'center' },
    { title: t('cvOps.colCath'), dataIndex: 'cath', key: 'cath', align: 'center' },
    { title: t('cvOps.colTotal'), dataIndex: 'total', key: 'total', align: 'center', render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: t('cvOps.colStatus'), dataIndex: 'status', key: 'status', align: 'center',
      render: (v: string) => (
        <span style={{
          padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
          background: v === 'on-duty' ? 'var(--color-success-bg)' : v === 'on-call' ? 'var(--color-warning-bg)' : 'var(--bg-card)',
          color: v === 'on-duty' ? 'var(--color-success)' : v === 'on-call' ? 'var(--color-warning)' : '#94a3b8',
        }}>
          {v === 'on-duty' ? t('cvOps.statusOnDuty') : v === 'on-call' ? t('cvOps.statusOnCall') : v === 'cath-lab' ? t('cvOps.statusCathLab') : v === 'echo-lab' ? t('cvOps.statusEchoLab') : t('cvOps.statusOffDuty')}
        </span>
      ),
    },
  ]

  const contrastColumns: TableColumnsType<{ agent: string; stock: number; reorder: number }> = [
    { title: t('cvOps.colOperator'), dataIndex: 'agent', key: 'agent' },
    { title: t('cvOps.colStock'), dataIndex: 'stock', key: 'stock', align: 'center', render: (v: number, r) => <span style={{ color: v < r.reorder ? 'var(--color-error-600)' : 'var(--color-success-600)', fontWeight: 600 }}>{v}</span> },
    { title: t('cvOps.colReorder'), dataIndex: 'reorder', key: 'reorder', align: 'center', render: (v: number) => <span style={{ color: '#64748b' }}>{v}</span> },
  ]

  const stressColumns: TableColumnsType<{ agent: string; doses: number; expiry: string }> = [
    { title: t('cvOps.colOperator'), dataIndex: 'agent', key: 'agent' },
    { title: t('cvOps.colDose'), dataIndex: 'doses', key: 'doses', align: 'center', render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('cvOps.colExpiry'), dataIndex: 'expiry', key: 'expiry', align: 'center', render: (v: string) => <span style={{ color: '#64748b' }}>{v}</span> },
  ]

  return (
    <div style={{ padding: 'var(--space-6, 24px)' }}>
      <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', margin: '0 0 16px' }}>
        <Activity size={24} /> {t('cvOps.title')}
        <span style={{ fontSize: 12, fontWeight: 400, background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: source === 'api' ? 'var(--color-success)' : 'var(--color-warning)', padding: '2px 8px', borderRadius: 10 }}>
          {source === 'api' ? t('cvOps.dataSourceApi') : t('cvOps.demoDataUnavailable')}
        </span>
      </Title>

      {error && <div style={{ marginBottom: 'var(--space-3, 12px)', padding: '8px 12px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 6, fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-5, 20px)' }}>
        <button style={tabStyle('overview')} onClick={() => setSelectedTab('overview')}>{t('cvOps.tabOverview')}</button>
        <button style={tabStyle('protocols')} onClick={() => setSelectedTab('protocols')}>{t('cvOps.tabProtocols')}</button>
        <button style={tabStyle('workload')} onClick={() => setSelectedTab('workload')}>{t('cvOps.tabWorkload')}</button>
        <button style={tabStyle('inventory')} onClick={() => setSelectedTab('inventory')}>{t('cvOps.tabInventory')}</button>
      </div>

      {selectedTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)', opacity: loading ? 0.6 : 1 }}>
            {kpi.map(k => (
              <div key={k.label} style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2, 8px)' }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</span>
                  <span style={{ color: '#64748b' }}>{k.icon}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>{k.value}</div>
                <div style={{ fontSize: 12, color: k.changeType === 'up' ? 'var(--color-success-600)' : k.changeType === 'down' ? 'var(--color-error-600)' : '#64748b', marginTop: 'var(--space-1, 4px)' }}>{k.change}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 'var(--space-4, 16px)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('cvOps.timelineToday')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{t('cvOps.demoData')}</span></h3>
            <div style={{ fontSize: 14, color: '#64748b' }}>
              {['08:00 — CCTA: 三联排除 (患者 #P1023)', '08:30 — CMR: 心肌病 (患者 #P1045)', '09:00 — 导管室: STEMI急诊PCI (患者 #P1067)', '10:00 — 超声: 负荷超声 (患者 #P1082)', '11:30 — 血管超声: 颈动脉超声 (患者 #P1095)', '13:00 — CMR: 心肌存活 (患者 #P1101)', '14:00 — CCTA: TAVR规划 (患者 #P1118)', '15:00 — 导管室: 分期PCI (患者 #P1132)'].map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '6px 0', borderBottom: i < 7 ? '1px solid var(--border-color)' : 'none' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary-800)', flexShrink: 0 }} />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'protocols' && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', fontSize: 12, color: '#94a3b8' }}>{t('cvOps.protocolsSource')}</div>
          <DataTable<Protocol>
            columns={protocolColumns}
            dataSource={PROTOCOLS}
            rowKey="id"
          />
        </div>
      )}

      {selectedTab === 'workload' && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 'var(--space-4, 16px)', background: 'var(--bg-card)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{t('cvOps.workloadToday')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{t('cvOps.demoData')}</span></h3>
          <DataTable<WorkloadRow>
            columns={workloadColumns}
            dataSource={[
              { name: 'Dr. Liu Qiang', ccta: 3, cmr: 2, echo: 4, cath: 1, total: 10, status: 'on-duty' },
              { name: 'Dr. Zhao Min', ccta: 1, cmr: 3, echo: 2, cath: 0, total: 6, status: 'on-duty' },
              { name: 'Dr. Sun Hong', ccta: 0, cmr: 0, echo: 0, cath: 0, total: 0, status: 'off-duty' },
              { name: 'Dr. Zhou Li', ccta: 2, cmr: 1, echo: 1, cath: 2, total: 6, status: 'on-call' },
              { name: 'Dr. Wu Jing', ccta: 0, cmr: 0, echo: 0, cath: 3, total: 3, status: 'cath-lab' },
              { name: 'Dr. Xu Yue', ccta: 0, cmr: 0, echo: 4, cath: 0, total: 4, status: 'echo-lab' },
            ]}
            rowKey="name"
          />
        </div>
      )}

      {selectedTab === 'inventory' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)' }}>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 'var(--space-4, 16px)', background: 'var(--bg-card)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FlaskConical size={16} /> {t('cvOps.contrastInventory')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{t('cvOps.demoData')}</span>
            </h3>
            <DataTable<{ agent: string; stock: number; reorder: number }>
              columns={contrastColumns}
              dataSource={[
                { agent: 'Iopamidol 370 (100mL)', stock: 24, reorder: 30 },
                { agent: 'Iopamidol 370 (200mL)', stock: 15, reorder: 20 },
                { agent: 'Gadobutrol (15mL)', stock: 8, reorder: 10 },
                { agent: 'Gadoterate meglumine (20mL)', stock: 12, reorder: 10 },
              ]}
              rowKey="agent"
            />
          </div>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 'var(--space-4, 16px)', background: 'var(--bg-card)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={16} /> {t('cvOps.stressDrugInventory')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{t('cvOps.demoData')}</span>
            </h3>
            <DataTable<{ agent: string; doses: number; expiry: string }>
              columns={stressColumns}
              dataSource={[
                { agent: 'Dobutamine (250mg/20mL)', doses: 5, expiry: '2026-08' },
                { agent: 'Regadenoson (0.4mg/5mL)', doses: 8, expiry: '2026-09' },
                { agent: 'Dipyridamole (50mg/10mL)', doses: 3, expiry: '2026-07' },
                { agent: 'Adenosine (6mg/2mL)', doses: 10, expiry: '2026-10' },
              ]}
              rowKey="agent"
            />
          </div>
        </div>
      )}
    </div>
  )
}

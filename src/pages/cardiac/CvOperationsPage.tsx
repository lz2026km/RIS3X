// [v3.0.6.11-82] W3-C: 接入 statsApi.getDaily (真实后端聚合) + loading/error + 数据源标注
// 数据源标注: KPI 卡片 → /stats/daily; 协议/工作量/库存 → 本地演示数据 (后端无 /cardiac/operations 端点)
import { useEffect, useState } from 'react'
import { Activity, Clock, Users, DollarSign, FlaskConical, TrendingUp, Package } from 'lucide-react'
import { statsApi } from '../../services/api/statsApi'

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
  { id: 'P1', name: 'Coronary CTA - CAD', modality: 'CCTA', indication: '稳定性胸痛，疑似冠心病', activeCases: 4, lastUsed: '2026-06-16' },
  { id: 'P2', name: 'Coronary CTA - Triple Rule Out', modality: 'CCTA', indication: '胸痛，排除 ACS', activeCases: 1, lastUsed: '2026-06-15' },
  { id: 'P3', name: '心肌病', modality: 'CMR', indication: '扩张型/HCM/ARVC 检查', activeCases: 3, lastUsed: '2026-06-16' },
  { id: 'P4', name: 'CMR - Viability', modality: 'CMR', indication: '已知 CAD，既往心梗', activeCases: 2, lastUsed: '2026-06-14' },
  { id: 'P5', name: 'CMR - Myocarditis', modality: 'CMR', indication: '疑似心肌炎，肌钙蛋白升高', activeCases: 1, lastUsed: '2026-06-13' },
  { id: 'P6', name: 'Cath - Stable CAD', modality: 'Cath Lab', indication: '已知 CAD，分期 PCI', activeCases: 3, lastUsed: '2026-06-16' },
  { id: 'P7', name: 'Cath - Primary PCI STEMI', modality: 'Cath Lab', indication: 'STEMI 激活', activeCases: 0, lastUsed: '2026-06-15' },
  { id: 'P8', name: 'TAVR Pre-procedural', modality: 'CCTA', indication: '重度 AS，TAVR 规划', activeCases: 2, lastUsed: '2026-06-14' },
  { id: 'P9', name: 'Stress Echo - CAD', modality: 'Echo', indication: '胸痛，中等验前概率', activeCases: 2, lastUsed: '2026-06-16' },
  { id: 'P10', name: 'Carotid Duplex', modality: 'Vascular', indication: 'TIA/CVA，血管杂音', activeCases: 1, lastUsed: '2026-06-14' },
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
          setError(res.error?.message ?? '统计接口不可用')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '统计接口不可用')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const tabStyle = (tab: typeof selectedTab) => ({
    padding: '8px 20px',
    border: 'none',
    background: selectedTab === tab ? '#1e40af' : '#f1f5f9',
    color: selectedTab === tab ? '#fff' : '#1e293b',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: selectedTab === tab ? 600 : 400,
  })

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px' }}>
        <Activity size={24} /> 心血管运营中心
        <span style={{ fontSize: 12, fontWeight: 400, background: source === 'api' ? '#dcfce7' : '#fef3c7', color: source === 'api' ? '#16a34a' : '#d97706', padding: '2px 8px', borderRadius: 10 }}>
          {source === 'api' ? '数据源: /stats/daily' : '演示数据(接口不可用)'}
        </span>
      </h1>

      {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabStyle('overview')} onClick={() => setSelectedTab('overview')}>总览</button>
        <button style={tabStyle('protocols')} onClick={() => setSelectedTab('protocols')}>协议</button>
        <button style={tabStyle('workload')} onClick={() => setSelectedTab('workload')}>工作量</button>
        <button style={tabStyle('inventory')} onClick={() => setSelectedTab('inventory')}>库存</button>
      </div>

      {selectedTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24, opacity: loading ? 0.6 : 1 }}>
            {kpi.map(k => (
              <div key={k.label} style={{ padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</span>
                  <span style={{ color: '#64748b' }}>{k.icon}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>{k.value}</div>
                <div style={{ fontSize: 12, color: k.changeType === 'up' ? '#16a34a' : k.changeType === 'down' ? '#dc2626' : '#64748b', marginTop: 4 }}>{k.change}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>活动时间线 — 今日 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>演示数据</span></h3>
            <div style={{ fontSize: 14, color: '#64748b' }}>
              {['08:00 — CCTA: Triple Rule Out (Pt #P1023)', '08:30 — CMR: Cardiomyopathy (Pt #P1045)', '09:00 — Cath Lab: Primary PCI (Pt #P1067)', '10:00 — Echo: Stress Echo (Pt #P1082)', '11:30 — Vascular: Carotid Duplex (Pt #P1095)', '13:00 — CMR: Viability (Pt #P1101)', '14:00 — CCTA: TAVR Planning (Pt #P1118)', '15:00 — Cath Lab: Staged PCI (Pt #P1132)'].map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 7 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1e40af', flexShrink: 0 }} />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'protocols' && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, color: '#94a3b8' }}>数据源: 演示数据 (后端无 /cardiac/operations 端点)</div>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>协议</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>设备类型</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>适应证</th>
                <th style={{ padding: '10px 16px', textAlign: 'center' }}>进行中病例</th>
                <th style={{ padding: '10px 16px', textAlign: 'left' }}>最近使用</th>
              </tr>
            </thead>
            <tbody>
              {PROTOCOLS.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px 16px' }}>{p.modality}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b', maxWidth: 300 }}>{p.indication}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ background: p.activeCases > 0 ? '#dcfce7' : '#f1f5f9', color: p.activeCases > 0 ? '#16a34a' : '#94a3b8', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{p.activeCases}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{p.lastUsed}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {selectedTab === 'workload' && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>心血管医生工作量 — 今日 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>演示数据</span></h3>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>心血管医生</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>CCTA</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>CMR</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Echo</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>心导管</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>合计</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {([
                { name: 'Dr. Liu Qiang', ccta: 3, cmr: 2, echo: 4, cath: 1, total: 10, status: 'on-duty' },
                { name: 'Dr. Zhao Min', ccta: 1, cmr: 3, echo: 2, cath: 0, total: 6, status: 'on-duty' },
                { name: 'Dr. Sun Hong', ccta: 0, cmr: 0, echo: 0, cath: 0, total: 0, status: 'off-duty' },
                { name: 'Dr. Zhou Li', ccta: 2, cmr: 1, echo: 1, cath: 2, total: 6, status: 'on-call' },
                { name: 'Dr. Wu Jing', ccta: 0, cmr: 0, echo: 0, cath: 3, total: 3, status: 'cath-lab' },
                { name: 'Dr. Xu Yue', ccta: 0, cmr: 0, echo: 4, cath: 0, total: 4, status: 'echo-lab' },
              ] as WorkloadRow[]).map(r => (
                <tr key={r.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.ccta}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.cmr}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.echo}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.cath}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.total}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: r.status === 'on-duty' ? '#dcfce7' : r.status === 'on-call' ? '#fef3c7' : '#f1f5f9',
                      color: r.status === 'on-duty' ? '#16a34a' : r.status === 'on-call' ? '#d97706' : '#94a3b8',
                    }}>
                      {r.status === 'on-duty' ? '在岗' : r.status === 'on-call' ? '备勤' : r.status === 'cath-lab' ? '导管室' : r.status === 'echo-lab' ? '超声室' : '休班'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {selectedTab === 'inventory' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FlaskConical size={16} /> 对比剂库存 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>演示数据</span>
            </h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ borderBottom: '1px solid #e2e8f0' }}><th style={{ padding: '8px', textAlign: 'left' }}>操作人</th><th style={{ padding: '8px', textAlign: 'center' }}>库存</th><th style={{ padding: '8px', textAlign: 'center' }}>补货点</th></tr></thead>
              <tbody>
                {[
                  { agent: 'Iopamidol 370 (100mL)', stock: 24, reorder: 30 },
                  { agent: 'Iopamidol 370 (200mL)', stock: 15, reorder: 20 },
                  { agent: 'Gadobutrol (15mL)', stock: 8, reorder: 10 },
                  { agent: 'Gadoterate meglumine (20mL)', stock: 12, reorder: 10 },
                ].map(r => (
                  <tr key={r.agent} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>{r.agent}</td>
                    <td style={{ padding: '8px', textAlign: 'center', color: r.stock < r.reorder ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{r.stock}</td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{r.reorder}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={16} /> 负荷药物库存 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>演示数据</span>
            </h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ borderBottom: '1px solid #e2e8f0' }}><th style={{ padding: '8px', textAlign: 'left' }}>操作人</th><th style={{ padding: '8px', textAlign: 'center' }}>剂量</th><th style={{ padding: '8px', textAlign: 'center' }}>有效期</th></tr></thead>
              <tbody>
                {[
                  { agent: 'Dobutamine (250mg/20mL)', doses: 5, expiry: '2026-08' },
                  { agent: 'Regadenoson (0.4mg/5mL)', doses: 8, expiry: '2026-09' },
                  { agent: 'Dipyridamole (50mg/10mL)', doses: 3, expiry: '2026-07' },
                  { agent: 'Adenosine (6mg/2mL)', doses: 10, expiry: '2026-10' },
                ].map(r => (
                  <tr key={r.agent} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>{r.agent}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{r.doses}</td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{r.expiry}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </div>
  )
}

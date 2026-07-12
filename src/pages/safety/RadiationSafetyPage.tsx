import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Activity, CheckCircle, AlertTriangle, Shield, BarChart3, Download, Zap } from 'lucide-react'
import {
  getDoseRecords, checkAlaraCompliance, getProtocolOptimizationSuggestions,
  type DoseRecord, type AlaraComplianceStatus, type ProtocolOptimizationSuggestion,
} from '../../services/api/safetyApi'

const MODALITY_COLORS: Record<string, string> = { CT: '#3b82f6', MR: '#8b5cf6', DR: '#22c55e', DSA: '#f59e0b', MG: '#ef4444' }

export default function RadiationSafetyPage() {
  const [doseRecords, setDoseRecords] = useState<DoseRecord[]>([])
  const [compliance, setCompliance] = useState<AlaraComplianceStatus[]>([])
  const [optimizations, setOptimizations] = useState<ProtocolOptimizationSuggestion[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'alerts' | 'optimize'>('overview')

  useEffect(() => {
    getDoseRecords().then(setDoseRecords)
    checkAlaraCompliance().then(setCompliance)
    getProtocolOptimizationSuggestions().then(setOptimizations)
  }, [])

  const dlpData = doseRecords.filter(r => r.dlp).map(r => ({ name: r.patientName, dlp: r.dlp, ctDoseIndex: r.ctDoseIndex }))
  const complianceData = compliance.map(c => ({ name: c.modality, rate: c.complianceRate, avgDose: c.avgDose }))
  const doseByModality = doseRecords.reduce<Record<string, number>>((acc, r) => {
    acc[r.modality] = (acc[r.modality] ?? 0) + (r.dlp ?? r.kap ?? 0)
    return acc
  }, {})
  const modalityData = Object.entries(doseByModality).map(([k, v]) => ({ modality: k, dose: Math.round(v) }))

  const complianceRate = compliance.length > 0 ? Math.round(compliance.reduce((s, c) => s + c.complianceRate, 0) / compliance.length) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#059669,#065f46)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>辐射安全与防护</span>
        </div>
        <button style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Download size={14} />导出报告
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: 'ALARA合规率', value: `${complianceRate}%`, icon: CheckCircle, color: complianceRate >= 90 ? '#22c55e' : '#f59e0b' },
            { title: '本月检查量', value: doseRecords.length, icon: Activity, color: '#3b82f6' },
            { title: '设备数量', value: new Set(doseRecords.map(r => r.deviceId)).size, icon: BarChart3, color: '#8b5cf6' },
            { title: '优化建议', value: optimizations.length, icon: Zap, color: '#f59e0b' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['overview', 'records', 'alerts', 'optimize'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: activeTab === t ? '#059669' : '#161b22', color: activeTab === t ? '#fff' : '#8b949e', cursor: 'pointer', fontSize: 13 }}>
              {{ overview: '总览', records: '剂量记录', alerts: '阈值告警', optimize: '优化建议' }[t]}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={16} color="#3b82f6" />各设备剂量对比 (DLP)
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dlpData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="dlp" fill="#3b82f6" radius={[4, 4, 0, 0]} name="DLP" />
                  <Bar dataKey="ctDoseIndex" fill="#22c55e" radius={[4, 4, 0, 0]} name="CTDI" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="#22c55e" />ALARA合规率
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={complianceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                  <Bar dataKey="rate" fill="#22c55e" radius={[4, 4, 0, 0]} name="合规率(%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="#f59e0b" />各设备类型总剂量
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={modalityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="modality" tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                  <Bar dataKey="dose" fill="#f59e0b" radius={[4, 4, 0, 0]} name="总剂量" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>合规详情</div>
              {compliance.map(c => (
                <div key={c.modality} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #21262d', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#f0f6fc' }}>{c.modality}</div>
                    <div style={{ fontSize: 12, color: '#6e7681' }}>{c.totalExams}次检查 · {c.avgDose}平均剂量</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: c.status === 'compliant' ? '#22c55e20' : c.status === 'warning' ? '#f59e0b20' : '#ef444420', color: c.status === 'compliant' ? '#22c55e' : c.status === 'warning' ? '#f59e0b' : '#ef4444' }}>
                    {c.complianceRate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>检查ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>患者</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>设备</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>CTDI</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>DLP</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>KAP</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>日期</th>
                </tr>
              </thead>
              <tbody>
                {doseRecords.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#6e7681', fontSize: 12 }}>{r.examId}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.patientName}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{r.deviceName}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.ctDoseIndex ?? '-'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.dlp ?? '-'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.kap ?? '-'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: 12 }}>{r.examDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'optimize' && (
          <div>
            {optimizations.map((opt, i) => (
              <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${MODALITY_COLORS[opt.modality]}20`, color: MODALITY_COLORS[opt.modality], marginRight: 8 }}>{opt.modality}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.procedureName}</span>
                  </div>
                  <span style={{ color: '#22c55e', fontSize: 13 }}>预计降低 {opt.estimatedReduction}%</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: '#8b949e' }}>
                  <span>当前平均: <b style={{ color: '#f0f6fc' }}>{opt.currentAvgDose}</b></span>
                  <span>目标值: <b style={{ color: '#22c55e' }}>{opt.recommendedTarget}</b></span>
                </div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>
                  措施: {opt.actionItems.map((a, j) => (
                    <span key={j} style={{ display: 'inline-block', padding: '2px 8px', background: '#0d1117', borderRadius: 4, margin: '2px 4px 2px 0', color: '#f0f6fc' }}>{a}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20, textAlign: 'center', color: '#8b949e' }}>
            <AlertTriangle size={32} style={{ marginBottom: 8 }} />
            <div>阈值告警配置功能 - 可配置各设备类型的剂量阈值和通知规则</div>
          </div>
        )}
      </div>
    </div>
  )
}

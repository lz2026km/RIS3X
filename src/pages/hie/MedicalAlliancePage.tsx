import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { regionalApi } from '../../services/api/regionalApi'

interface AllianceMember {
  id: string
  name: string
  code: string
  level: string
  type: string
  region: string
  contactPerson: string
  contactPhone: string
  status: 'active' | 'inactive' | 'pending'
  joinedAt: string
  resourceContribution: string[]
}

interface AllianceReferral {
  id: string
  patientName: string
  patientId: string
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  diagnosis: string
  priority: 'normal' | 'urgent'
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
  createdAt: string
  completedAt?: string
}

function generateId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }

const MedicalAlliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'referrals' | 'dashboard'>('members')
  const [allianceMembers, setAllianceMembers] = useState<AllianceMember[]>([])
  const [allianceReferrals, setAllianceReferrals] = useState<AllianceReferral[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listMedicalAlliance()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setAllianceMembers(res.data.map((m: any) => ({
            id: m.id || generateId(),
            name: m.name || '',
            code: m.code || '',
            level: m.level || '',
            type: m.type || '',
            region: m.region || '',
            contactPerson: m.contactPerson || '',
            contactPhone: m.contactPhone || '',
            status: m.status || 'active',
            joinedAt: m.joinedAt || '',
            resourceContribution: m.resourceContribution || [],
          })))
        }
      } catch { /* keep empty */ }
      try {
        const res = await fetch('/api/v1/regional/alliance-referrals').then(r => r.json())
        if (!cancelled && res.data && Array.isArray(res.data)) {
          setAllianceReferrals(res.data)
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  const handleCreateReferral = () => {
    const newRef: AllianceReferral = {
      id: generateId(), patientName: '新患者', patientId: 'P-NEW',
      fromMemberId: '', fromMemberName: '',
      toMemberId: '', toMemberName: '',
      diagnosis: '转诊诊断', priority: 'normal', status: 'pending',
      createdAt: new Date().toISOString(),
    }
    setAllianceReferrals(prev => [...prev, newRef])
  }

  const handleAcceptReferral = (id: string) => {
    setAllianceReferrals(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' as const } : r))
  }

  const handleCompleteReferral = (id: string) => {
    setAllianceReferrals(prev => prev.map(r => r.id === id ? { ...r, status: 'completed' as const, completedAt: new Date().toISOString() } : r))
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>医疗联合体管理</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>医联体成员管理、资源共享与转诊协作</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>
        {(['members', 'referrals', 'dashboard'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 16px', border: 'none', background: activeTab === tab ? '#3b82f6' : 'transparent', color: activeTab === tab ? '#fff' : '#374151', borderRadius: 6, cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400 }}>
            {tab === 'members' ? '成员管理' : tab === 'referrals' ? '转诊管理' : '联盟看板'}
          </button>
        ))}
      </div>

      {activeTab === 'members' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>医联体成员 ({allianceMembers.length})</h2>
          </div>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={thStyle}>机构名称</th>
                <th style={thStyle}>等级/类型</th>
                <th style={thStyle}>区域</th>
                <th style={thStyle}>联系人</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>加入时间</th>
              </tr>
            </thead>
            <tbody>
              {allianceMembers.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{m.name}</td>
                  <td style={tdStyle}>{m.level} / {m.type}</td>
                  <td style={tdStyle}>{m.region}</td>
                  <td style={tdStyle}>{m.contactPerson}<br /><small>{m.contactPhone}</small></td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: m.status === 'active' ? 'var(--color-success-bg)' : m.status === 'pending' ? 'var(--color-warning-bg)' : 'var(--bg-card)', color: m.status === 'active' ? 'var(--color-success)' : m.status === 'pending' ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
                      {m.status === 'active' ? '已加入' : m.status === 'pending' ? '待审批' : '已停用'}
                    </span>
                  </td>
                  <td style={tdStyle}>{m.joinedAt}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, padding: 16, background: 'var(--color-info-bg)', borderRadius: 8, border: '1px solid var(--color-info-border)' }}>
              <div style={{ fontSize: 13, color: '#1e40af' }}>共享资源</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1e40af' }}>CT, MR, PET-CT, 超声, X光</div>
            </div>
            <div style={{ flex: 1, padding: 16, background: 'var(--color-success-bg)', borderRadius: 8, border: '1px solid var(--color-success-border)' }}>
              <div style={{ fontSize: 13, color: '#166534' }}>覆盖区域</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#166534' }}>广州市越秀区、天河区</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>转诊记录 ({allianceReferrals.length})</h2>
                <button onClick={handleCreateReferral} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14} />新建转诊</button>
          </div>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={thStyle}>患者</th>
                <th style={thStyle}>转出机构</th>
                <th style={thStyle}>转入机构</th>
                <th style={thStyle}>诊断</th>
                <th style={thStyle}>优先级</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {allianceReferrals.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}><strong>{r.patientName}</strong><br /><small>{r.patientId}</small></td>
                  <td style={tdStyle}>{r.fromMemberName}</td>
                  <td style={tdStyle}>{r.toMemberName}</td>
                  <td style={tdStyle}>{r.diagnosis}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: r.priority === 'urgent' ? 'var(--color-error-bg)' : 'var(--bg-card)', color: r.priority === 'urgent' ? 'var(--color-error)' : 'var(--text-secondary)' }}>
                      {r.priority === 'urgent' ? '紧急' : '普通'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: r.status === 'completed' ? 'var(--color-success-bg)' : r.status === 'accepted' ? 'var(--color-info-bg)' : r.status === 'cancelled' ? 'var(--bg-card)' : 'var(--color-warning-bg)', color: r.status === 'completed' ? 'var(--color-success)' : r.status === 'accepted' ? 'var(--color-info)' : r.status === 'cancelled' ? 'var(--text-secondary)' : 'var(--color-warning)' }}>
                      {r.status === 'pending' ? '待接诊' : r.status === 'accepted' ? '已接诊' : r.status === 'completed' ? '已完成' : '已取消'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {r.status === 'pending' && <button onClick={() => handleAcceptReferral(r.id)} style={{ padding: '4px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 4 }}>接诊</button>}
                    {r.status === 'accepted' && <button onClick={() => handleCompleteReferral(r.id)} style={{ padding: '4px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>完成</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>联盟运营看板</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: '成员机构', value: allianceMembers.filter(m => m.status === 'active').length, color: '#3b82f6' },
              { label: '本月转诊数', value: 8, color: '#10b981' },
              { label: '资源共享量', value: '1,256', color: '#8b5cf6' },
              { label: '转诊完成率', value: '87.5%', color: '#f59e0b' },
            ].map((card, i) => (
              <div key={i} style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>资源贡献分布</h3>
              {['CT', 'MR', '超声', 'X光', 'PET-CT'].map((res, i) => (
                <div key={i} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 80, fontSize: 13 }}>{res}</span>
                  <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4 }}>
                    <div style={{ width: `${60 + i * 8}%`, height: 8, background: '#3b82f6', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{2 + i * 2}家</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>近期转诊趋势</h3>
              {[{ month: '2026-03', count: 5 }, { month: '2026-04', count: 7 }, { month: '2026-05', count: 8 }].map((item, i) => (
                <div key={i} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 80, fontSize: 13 }}>{item.month}</span>
                  <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4 }}>
                    <div style={{ width: `${(item.count / 10) * 100}%`, height: 8, background: '#10b981', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{item.count}例</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151' }
const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#374151' }

export default MedicalAlliancePage

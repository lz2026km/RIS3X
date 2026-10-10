import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Wifi, WifiOff, RefreshCw, ArrowRight, Activity, ShieldCheck, Image as ImageIcon, AlertTriangle, Clock } from 'lucide-react'
import { Pagination, Typography } from 'antd'
import { DataTable } from '../../components/common'
import { regionalApi } from '../../services/api/regionalApi'
import { usePagination } from '../../hooks/usePagination'
import { t } from '../../i18n/appI18n'

const { Title } = Typography

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
  const [activeTab, setActiveTab] = useState<'members' | 'referrals' | 'dashboard' | 'ops'>('members')
  const [allianceMembers, setAllianceMembers] = useState<AllianceMember[]>([])
  const [allianceReferrals, setAllianceReferrals] = useState<AllianceReferral[]>([])
  // [G005 Wave2B P2] 成员/转诊表受控分页 (usePagination, pageSize 10)
  const memberPager = usePagination(allianceMembers, 10)
  const referralPager = usePagination(allianceReferrals, 10)

  // ============================================================
  // [G005 v3.0.6.11-99 Wave 10E-1] 医联体深化区块 (运行看板)
  //   F1. 成员机构状态看板 (在线/离线/同步滞后)
  //   F2. 转诊流向图 (机构间)
  //   F3. 共享检查统计
  //   F4. SLA 达成率卡
  // ============================================================
  const [sites, setSites] = useState<any[]>([])
  const [sitesReal, setSitesReal] = useState(false)
  const [sitesLoading, setSitesLoading] = useState(true)
  const [opsRefreshKey, setOpsRefreshKey] = useState(0)

  const demoInstitutions = useMemo(() => {
    const names = ['总院 (三甲)', '市二医院', '区人民医院', '社区卫生服务中心A', '社区卫生服务中心B', '县中医院']
    return names.map((n, i) => ({
      id: `SITE-${i + 1}`,
      name: n,
      code: `S0${i + 1}`,
      status: i === 1 ? 'offline' : i === 3 ? 'syncing' : 'active',
      studies: 1200 + i * 860,
      patients: 800 + i * 540,
      users: 12 + i * 9,
      storage: 2.4 + i * 1.1,
      lastSync: new Date(Date.now() - (i === 1 ? 86400000 * 3 : i === 3 ? 3600000 * 26 : i * 1800000)).toISOString(),
      latencyMs: 18 + i * 21,
      uptimePct: i === 1 ? 86.4 : 98.2 + (i % 3) * 0.5,
      version: 'v3.0.6.11',
      primary: i === 0,
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    setSitesLoading(true)
    void (async () => {
      try {
        const res = await regionalApi.listSites()
        if (!cancelled && res.success && Array.isArray(res.data?.data ?? res.data)) {
          const list = Array.isArray(res.data) ? res.data : res.data!.data
          if (list.length > 0) {
            setSites(list)
            setSitesReal(true)
            setSitesLoading(false)
            return
          }
        }
      } catch { /* 回退演示 */ }
      if (!cancelled) {
        setSites(demoInstitutions)
        setSitesReal(false)
        setSitesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [opsRefreshKey, demoInstitutions])

  // 状态汇总
  const siteSummary = useMemo(() => {
    const byStatus: Record<string, number> = {}
    let syncLag = 0
    sites.forEach((s: any) => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1
      const lag = Date.now() - new Date(s.lastSync ?? Date.now()).getTime()
      if (s.status !== 'offline' && lag > 3600000 * 6) syncLag += 1
    })
    const avgUptime = sites.length > 0 ? Math.round(sites.reduce((sum, s: any) => sum + Number(s.uptimePct ?? 0), 0) / sites.length) : 0
    const totalStudies = sites.reduce((sum, s: any) => sum + Number(s.studies ?? 0), 0)
    const avgLatency = sites.length > 0 ? Math.round(sites.reduce((sum, s: any) => sum + Number(s.latencyMs ?? 0), 0) / sites.length) : 0
    return { byStatus, syncLag, avgUptime, totalStudies, avgLatency }
  }, [sites])

  // 转诊流向: 聚合 fromMember → toMember 计数
  const referralFlow = useMemo(() => {
    const map = new Map<string, { from: string; to: string; count: number; completed: number }>()
    allianceReferrals.forEach(r => {
      const key = `${r.fromMemberName}→${r.toMemberName}`
      const item = map.get(key) ?? { from: r.fromMemberName || t('medicalAlliance.unknownInstitution'), to: r.toMemberName || t('medicalAlliance.unknownInstitution'), count: 0, completed: 0 }
      item.count += 1
      if (r.status === 'completed') item.completed += 1
      map.set(key, item)
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [allianceReferrals])

  // SLA 达成率 (转诊闭环率 + 在线率加权)
  const slaMetrics = useMemo(() => {
    const total = allianceReferrals.length
    const completed = allianceReferrals.filter(r => r.status === 'completed').length
    const referralSla = total > 0 ? Math.round((completed / total) * 100) : 87
    const onlineRate = sites.length > 0 ? Math.round((sites.filter((s: any) => s.status === 'active' || s.status === 'syncing').length / sites.length) * 100) : 0
    const compliance = Math.round((referralSla * 0.6 + onlineRate * 0.4))
    const urgentTotal = allianceReferrals.filter(r => r.priority === 'urgent').length
    const urgentCompleted = allianceReferrals.filter(r => r.priority === 'urgent' && r.status === 'completed').length
    const urgentSla = urgentTotal > 0 ? Math.round((urgentCompleted / urgentTotal) * 100) : 94
    return { referralSla, onlineRate, compliance, urgentSla }
  }, [allianceReferrals, sites])

  // 共享检查统计 (按模态)
  const sharedStats = useMemo(() => {
    const modalities = ['CT', 'MR', 'DR', 'US', 'DSA', '乳腺钼靶']
    const base = [186, 128, 342, 205, 64, 58]
    return modalities.map((m, i) => {
      const factor = sites.length > 0 ? 1 + sites.length * 0.12 : 1
      const count = Math.round((base[i] ?? 0) * factor)
      return { modality: m, count, pct: 0, color: ['var(--color-primary-500)', '#8b5cf6', 'var(--color-success-500)', '#14b8a6', 'var(--color-warning-500)', '#ec4899'][i] }
    }).map(d => ({ ...d }))
  }, [sites.length])

  const sharedTotal = sharedStats.reduce((s, d) => s + d.count, 0)

  // F5. 同步事件流 (regionalApi.listSiteSyncEvents, 失败回退派生)
  const [syncEvents, setSyncEvents] = useState<any[]>([])
  const [syncEventsReal, setSyncEventsReal] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listSiteSyncEvents()
        if (!cancelled && res.success && Array.isArray(res.data?.data ?? res.data)) {
          const list = Array.isArray(res.data) ? res.data : res.data!.data
          if (list.length > 0) {
            setSyncEvents(list)
            setSyncEventsReal(true)
            return
          }
        }
      } catch { /* 回退演示 */ }
      if (!cancelled) {
        setSyncEventsReal(false)
        setSyncEvents(Array.from({ length: 12 }, (_, i) => {
          const types = ['study_pushed', 'study_pulled', 'user_sync', 'config_sync']
          const statuses = ['success', 'success', 'success', 'failed']
          return {
            id: `EV-${i + 1}`,
            siteId: `SITE-${(i % 6) + 1}`,
            type: types[i % 4],
            status: statuses[i % 4],
            count: 10 + ((i * 37) % 240),
            bytes: 40 + ((i * 53) % 900),
            duration: 2 + ((i * 7) % 40),
            timestamp: new Date(Date.now() - i * 3600000 * 3).toISOString(),
          }
        }))
      }
    })()
    return () => { cancelled = true }
  }, [])

  // F6. 月度转诊趋势 (近 6 月)
  const referralTrend = useMemo(() => {
    const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
    const base = [5, 7, 8, 11, 13, 0]
    return months.map((m, i) => {
      const monthPrefix = m.slice(0, 7)
      const real = allianceReferrals.filter(r => (r.createdAt ?? '').slice(0, 7) === monthPrefix).length
      const count = i === months.length - 1 ? allianceReferrals.length + 4 : (real > 0 ? real : (base[i] ?? 0))
      return { month: m.slice(5), count, completed: Math.round(count * 0.82) }
    })
  }, [allianceReferrals])

  const trendPeak = referralTrend.reduce((b, pt) => (pt.count > b.count ? pt : b), referralTrend[0] ?? { month: '-', count: 0, completed: 0 })

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
      <Title level={4} style={{ marginBottom: 'var(--space-2, 8px)' }}>{t('medicalAlliance.title')}</Title>
      <p style={{ color: 'var(--text-secondary, #475569)', marginBottom: 'var(--space-6, 24px)' }}>{t('medicalAlliance.subtitle')}
        {/* [v3.0.6.11-88 Round10] /regional/alliance-referrals 后端未实现, MSW 演示数据 */}
        <span style={{ marginLeft: 'var(--space-3, 12px)', fontSize: 12, padding: '2px 8px', background: '#fef3c7', color: 'var(--color-warning-600)', borderRadius: 10 }}>{t('medicalAlliance.mswDemoTag')}</span>
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-6, 24px)', borderBottom: '2px solid var(--border-default, rgba(0,0,0,0.12))', paddingBottom: 'var(--space-2, 8px)' }}>
        {(['members', 'referrals', 'dashboard', 'ops'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 16px', border: 'none', background: activeTab === tab ? 'var(--color-primary-500)' : 'transparent', color: activeTab === tab ? '#fff' : '#374151', borderRadius: 6, cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400 }}>
            {tab === 'members' ? t('medicalAlliance.membersTab') : tab === 'referrals' ? t('medicalAlliance.referralsTab') : tab === 'dashboard' ? t('medicalAlliance.dashboardTab') : t('medicalAlliance.opsTab')}
          </button>
        ))}
      </div>

      {activeTab === 'members' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <Title level={5} style={{ margin: 0 }}>{t('medicalAlliance.membersTitle', { count: allianceMembers.length })}</Title>
          </div>
          <div style={{ overflowX: "auto" }}>
            <DataTable
              dataSource={memberPager.pageData}
              rowKey="id"
              pagination={false}
              columns={[
                { title: t('medicalAlliance.orgName'), dataIndex: 'name' },
                { title: t('medicalAlliance.levelType'), key: 'levelType', render: (_: unknown, m: AllianceMember) => `${m.level} / ${m.type}` },
                { title: t('medicalAlliance.region'), dataIndex: 'region' },
                {
                  title: t('medicalAlliance.contact'), key: 'contact',
                  render: (_: unknown, m: AllianceMember) => <>{m.contactPerson}<br /><small>{m.contactPhone}</small></>,
                },
                {
                  title: t('medicalAlliance.status'), dataIndex: 'status',
                  render: (v: AllianceMember['status']) => (
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: v === 'active' ? 'var(--color-success-bg)' : v === 'pending' ? 'var(--color-warning-bg)' : 'var(--bg-card)', color: v === 'active' ? 'var(--color-success)' : v === 'pending' ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
                      {v === 'active' ? t('medicalAlliance.joined') : v === 'pending' ? t('medicalAlliance.pendingApproval') : t('medicalAlliance.inactive')}
                    </span>
                  ),
                },
                { title: t('medicalAlliance.joinedAt'), dataIndex: 'joinedAt' },
              ]}
            />
          </div>
          <div style={{ marginTop: 'var(--space-3, 12px)', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination size="small" {...memberPager.pagination} />
          </div>
          <div style={{ marginTop: 'var(--space-4, 16px)', display: 'flex', gap: 'var(--space-3, 12px)' }}>
            <div style={{ flex: 1, padding: 'var(--space-4, 16px)', background: 'var(--color-info-bg)', borderRadius: 8, border: '1px solid var(--color-info-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-primary-800)' }}>{t('medicalAlliance.sharedResources')}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-primary-800)' }}>{t('medicalAlliance.sharedResourcesValue')}</div>
            </div>
            <div style={{ flex: 1, padding: 'var(--space-4, 16px)', background: 'var(--color-success-bg)', borderRadius: 8, border: '1px solid var(--color-success-border)' }}>
              <div style={{ fontSize: 12, color: '#166534' }}>{t('medicalAlliance.coverageArea')}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#166534' }}>{t('medicalAlliance.coverageAreaValue')}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <Title level={5} style={{ margin: 0 }}>{t('medicalAlliance.referralsTitle', { count: allianceReferrals.length })}</Title>
                <button onClick={handleCreateReferral} style={{ padding: '8px 16px', background: 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><Plus size={14} />{t('medicalAlliance.newReferral')}</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <DataTable
              dataSource={referralPager.pageData}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: t('medicalAlliance.patient'), key: 'patient',
                  render: (_: unknown, r: AllianceReferral) => <><strong>{r.patientName}</strong><br /><small>{r.patientId}</small></>,
                },
                { title: t('medicalAlliance.fromOrg'), dataIndex: 'fromMemberName' },
                { title: t('medicalAlliance.toOrg'), dataIndex: 'toMemberName' },
                { title: t('medicalAlliance.diagnosis'), dataIndex: 'diagnosis' },
                {
                  title: t('medicalAlliance.priority'), dataIndex: 'priority',
                  render: (v: AllianceReferral['priority']) => (
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: v === 'urgent' ? 'var(--color-error-bg)' : 'var(--bg-card)', color: v === 'urgent' ? 'var(--color-error)' : 'var(--text-secondary)' }}>
                      {v === 'urgent' ? t('medicalAlliance.urgent') : t('medicalAlliance.normal')}
                    </span>
                  ),
                },
                {
                  title: t('medicalAlliance.status'), dataIndex: 'status',
                  render: (v: AllianceReferral['status']) => (
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: v === 'completed' ? 'var(--color-success-bg)' : v === 'accepted' ? 'var(--color-info-bg)' : v === 'cancelled' ? 'var(--bg-card)' : 'var(--color-warning-bg)', color: v === 'completed' ? 'var(--color-success)' : v === 'accepted' ? 'var(--color-info)' : v === 'cancelled' ? 'var(--text-secondary)' : 'var(--color-warning)' }}>
                      {v === 'pending' ? t('medicalAlliance.pendingAccept') : v === 'accepted' ? t('medicalAlliance.accepted') : v === 'completed' ? t('medicalAlliance.completed') : t('medicalAlliance.cancelled')}
                    </span>
                  ),
                },
                {
                  title: t('medicalAlliance.actions'), key: 'actions',
                  render: (_: unknown, r: AllianceReferral) => (
                    <>
                      {r.status === 'pending' && <button onClick={() => handleAcceptReferral(r.id)} style={{ padding: '4px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 'var(--space-1, 4px)' }}>{t('medicalAlliance.accept')}</button>}
                      {r.status === 'accepted' && <button onClick={() => handleCompleteReferral(r.id)} style={{ padding: '4px 12px', background: 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{t('medicalAlliance.complete')}</button>}
                    </>
                  ),
                },
              ]}
            />
          </div>
          <div style={{ marginTop: 'var(--space-3, 12px)', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination size="small" {...referralPager.pagination} />
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div>
          <Title level={5} style={{ marginBottom: 'var(--space-4, 16px)' }}>{t('medicalAlliance.dashboardTitle')}</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)' }}>
            {[
              { label: t('medicalAlliance.memberOrgs'), value: allianceMembers.filter(m => m.status === 'active').length, color: 'var(--color-primary-500)' },
              { label: t('medicalAlliance.monthReferrals'), value: 8, color: '#10b981' },
              { label: t('medicalAlliance.resourceShared'), value: '1,256', color: '#8b5cf6' },
              { label: t('medicalAlliance.referralCompletion'), value: '87.5%', color: 'var(--color-warning-500)' },
            ].map((card, i) => (
              <div key={i} style={{ padding: 'var(--space-5, 20px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 'var(--space-1, 4px)' }}>{card.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)' }}>
            <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 'var(--space-3, 12px)' }}>{t('medicalAlliance.resourceDistributionTitle')}</h3>
              {['CT', 'MR', t('medicalAlliance.ultrasound'), t('medicalAlliance.xray'), 'PET-CT'].map((res, i) => (
                <div key={i} style={{ marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                  <span style={{ width: 80, fontSize: 12 }}>{res}</span>
                  <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4 }}>
                    <div style={{ width: `${60 + i * 8}%`, height: 8, background: 'var(--color-primary-500)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{t('medicalAlliance.orgCount', { count: 2 + i * 2 })}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 'var(--space-3, 12px)' }}>{t('medicalAlliance.recentTrendTitle')}</h3>
              {[{ month: '2026-03', count: 5 }, { month: '2026-04', count: 7 }, { month: '2026-05', count: 8 }].map((item, i) => (
                <div key={i} style={{ marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                  <span style={{ width: 80, fontSize: 12 }}>{item.month}</span>
                  <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4 }}>
                    <div style={{ width: `${(item.count / 10) * 100}%`, height: 8, background: '#10b981', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{t('medicalAlliance.caseCount', { count: item.count })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ops' && (
        <div data-testid="medical-alliance-ops">
          {/* 数据源徽标 + 刷新 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12, padding: '8px 14px', borderRadius: 8,
              background: sitesReal ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              border: `1px solid ${sitesReal ? '#bbf7d0' : '#fde68a'}`,
              color: sitesReal ? '#15803d' : '#92400e',
            }} data-testid="alliance-ops-source">
              {sitesLoading ? t('medicalAlliance.loadingSiteStatus') : sitesReal
                ? t('medicalAlliance.sourceReal')
                : t('medicalAlliance.sourceFallback')}
            </div>
            <button onClick={() => setOpsRefreshKey(k => k + 1)} style={{
              padding: '8px 14px', background: 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
            }}><RefreshCw size={13} /> {t('medicalAlliance.refresh')}</button>
          </div>

          {/* F1. 成员机构状态看板 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
            {[
              { label: t('medicalAlliance.onlineOrgs'), value: siteSummary.byStatus['active'] ?? 0, color: 'var(--color-success-600)', bg: 'var(--color-success-bg)' },
              { label: t('medicalAlliance.offlineOrgs'), value: siteSummary.byStatus['offline'] ?? 0, color: 'var(--color-error-600)', bg: 'var(--color-error-bg)' },
              { label: t('medicalAlliance.syncLagOrgs'), value: siteSummary.syncLag, color: 'var(--color-warning-600)', bg: 'var(--color-warning-bg)' },
            ].map(c => (
              <div key={c.label} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
            {sites.map((s: any) => {
              const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                active: { label: t('medicalAlliance.online'), color: 'var(--color-success-600)', bg: 'var(--color-success-bg)' },
                offline: { label: t('medicalAlliance.offline'), color: 'var(--color-error-600)', bg: 'var(--color-error-bg)' },
                syncing: { label: t('medicalAlliance.syncing'), color: 'var(--color-warning-600)', bg: 'var(--color-warning-bg)' },
                maintenance: { label: t('medicalAlliance.maintenance'), color: '#64748b', bg: 'var(--bg-card)' },
              }
              const st = statusMap[s.status] ?? statusMap.offline ?? { label: t('medicalAlliance.offline'), color: 'var(--color-error-600)', bg: 'var(--color-error-bg)' }
              const lagHours = s.lastSync ? Math.floor((Date.now() - new Date(s.lastSync).getTime()) / 3600000) : -1
              const lag = s.status !== 'offline' && lagHours > 6
              return (
                <div key={s.id} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${st.color}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 10 }}>
                    {s.status === 'offline' ? <WifiOff size={15} color="var(--color-error-600)" /> : <Wifi size={15} color="var(--color-success-600)" />}
                    <b style={{ fontSize: 12, color: 'var(--text-primary, #1e293b)' }}>{s.name}</b>
                    {s.primary && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#dbeafe', color: 'var(--color-primary-800)', fontWeight: 700 }}>{t('medicalAlliance.mainSite')}</span>}
                    <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: '#6b7280' }}>
                    <span>{t('medicalAlliance.studiesLabel')} <b style={{ color: 'var(--text-primary, #1e293b)' }}>{Number(s.studies ?? 0).toLocaleString()}</b></span>
                    <span>{t('medicalAlliance.storageLabel')} <b style={{ color: 'var(--text-primary, #1e293b)' }}>{s.storage ?? '-'} TB</b></span>
                    <span>{t('medicalAlliance.uptimeLabel')} <b style={{ color: Number(s.uptimePct ?? 0) >= 95 ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>{s.uptimePct ?? '-'}%</b></span>
                    <span>{t('medicalAlliance.latencyLabel')} <b style={{ color: 'var(--text-primary, #1e293b)' }}>{s.latencyMs ?? '-'} ms</b></span>
                  </div>
                  <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: lag ? 'var(--color-warning-600)' : 'var(--text-secondary)' }}>
                    <Clock size={11} />
                    {t('medicalAlliance.lastSyncLabel')} {s.lastSync ? new Date(s.lastSync).toLocaleString('zh-CN') : t('medicalAlliance.unknown')}
                    {lag && <b style={{ color: 'var(--color-warning-600)' }}>{t('medicalAlliance.lagSuffix', { hours: lagHours })}</b>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* F2. 转诊流向图 (机构间) */}
          <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 'var(--space-4, 16px)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowRight size={15} color="var(--color-primary-500)" /> {t('medicalAlliance.referralFlowTitle')}
            </h3>
            {referralFlow.length === 0 ? (
              <div style={{ padding: 'var(--space-5, 20px)', textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
                {t('medicalAlliance.noFlowData')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {referralFlow.slice(0, 8).map((f, i) => {
                  const max = referralFlow[0]?.count || 1
                  const rate = f.count > 0 ? Math.round((f.completed / f.count) * 100) : 0
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 130, fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.from}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <div style={{ width: `${(f.count / max) * 90}%`, height: 10, background: 'var(--color-primary-500)', borderRadius: '4px 0 0 4px', opacity: 0.5 + (f.count / max) * 0.5 }} />
                        </div>
                        <ArrowRight size={13} color="var(--text-muted, #94a3b8)" />
                        <div style={{ flex: 1 }}>
                          <div style={{ width: `${(f.count / max) * 90}%`, height: 10, background: '#10b981', borderRadius: '0 4px 4px 0' }} />
                        </div>
                      </div>
                      <span style={{ width: 130, fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.to}</span>
                      <b style={{ width: 46, fontSize: 12, color: 'var(--color-primary-800)', textAlign: 'right' }}>{t('medicalAlliance.caseCount', { count: f.count })}</b>
                      <span style={{ width: 52, fontSize: 11, color: rate >= 80 ? 'var(--color-success-600)' : 'var(--color-warning-600)', textAlign: 'right' }}>{t('medicalAlliance.closureRate', { rate })}</span>
                    </div>
                  )
                })}
                {referralFlow.length > 8 && <div style={{ fontSize: 11, color: '#6b7280' }}>{t('medicalAlliance.moreFlows', { count: referralFlow.length })}</div>}
              </div>
            )}
          </div>

          {/* F3. 共享检查统计 + F4. SLA 达成率卡 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--space-4, 16px)' }}>
            <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ImageIcon size={15} color="#8b5cf6" /> {t('medicalAlliance.sharedStatsTitle')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sharedStats.map((d: any) => (
                  <div key={d.modality} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                    <span style={{ width: 64, fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{d.modality}</span>
                    <div style={{ flex: 1, height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${(d.count / sharedTotal) * 100}%`, height: '100%', background: d.color, borderRadius: 5 }} />
                    </div>
                    <b style={{ width: 56, fontSize: 12, textAlign: 'right', color: 'var(--text-primary, #1e293b)' }}>{d.count}</b>
                    <span style={{ width: 44, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>{Math.round((d.count / sharedTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-3, 12px)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                <span>{t('medicalAlliance.sharedTotalLabel')} <b style={{ color: 'var(--color-primary-800)' }}>{sharedTotal.toLocaleString()}</b></span>
                <span>{t('medicalAlliance.coverageOrgs', { count: sites.length })}</span>
              </div>
            </div>

            <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={15} color="var(--color-success-600)" /> {t('medicalAlliance.slaTitle')}
              </h3>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke={slaMetrics.compliance >= 90 ? 'var(--color-success-600)' : slaMetrics.compliance >= 75 ? 'var(--color-warning-500)' : 'var(--color-error-600)'} strokeWidth="12"
                      strokeDasharray={`${(slaMetrics.compliance / 100) * 326.7} 326.7`} strokeLinecap="round" transform="rotate(-90 60 60)" />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <b style={{ fontSize: 24, color: slaMetrics.compliance >= 90 ? 'var(--color-success-600)' : 'var(--color-warning-600)' }}>{slaMetrics.compliance}%</b>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{t('medicalAlliance.overallCompliance')}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>{t('medicalAlliance.referralClosure')}</span>
                  <b style={{ color: 'var(--text-primary, #1e293b)' }}>{slaMetrics.referralSla}%</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>{t('medicalAlliance.orgOnlineRate')}</span>
                  <b style={{ color: 'var(--text-primary, #1e293b)' }}>{slaMetrics.onlineRate}%</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>{t('medicalAlliance.urgentCompliance')}</span>
                  <b style={{ color: 'var(--text-primary, #1e293b)' }}>{slaMetrics.urgentSla}%</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>{t('medicalAlliance.avgSyncLatency')}</span>
                  <b style={{ color: 'var(--text-primary, #1e293b)' }}>{siteSummary.avgLatency} ms</b>
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-3, 12px)', padding: '8px 10px', background: slaMetrics.compliance >= 90 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', borderRadius: 6, fontSize: 11, color: slaMetrics.compliance >= 90 ? '#15803d' : '#92400e', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Activity size={12} />
                {slaMetrics.compliance >= 90 ? t('medicalAlliance.slaPass') : t('medicalAlliance.slaWarn')}
              </div>
            </div>
          </div>

          {/* 在线率总览 */}
          <div style={{ marginTop: 'var(--space-4, 16px)', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 11, color: '#6b7280', lineHeight: 1.7 }}>
            <b style={{ color: 'var(--color-primary-800)' }}>{t('medicalAlliance.metricsNote')}</b> {t('medicalAlliance.metricsNoteBody', { uptime: siteSummary.avgUptime, studies: siteSummary.totalStudies.toLocaleString(), lag: siteSummary.syncLag })}
          </div>

          {/* F6. 月度转诊趋势 */}
          <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: 'var(--space-4, 16px)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={15} color="#10b981" /> {t('medicalAlliance.monthlyTrendTitle')}
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: '#6b7280' }}>
                {t('medicalAlliance.peakLabel')} <b style={{ color: 'var(--color-warning-600)' }}>{trendPeak.month}</b> {t('medicalAlliance.caseCount', { count: trendPeak.count })}
              </span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, padding: '0 8px' }}>
              {referralTrend.map(pt => {
                const max = trendPeak.count || 1
                const hgt = pt.count > 0 ? Math.max(10, Math.round((pt.count / max) * 110)) : 4
                const isPeak = pt.month === trendPeak.month && pt.count > 0
                return (
                  <div key={pt.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isPeak ? 'var(--color-warning-600)' : 'var(--color-primary-800)' }}>{pt.count}</span>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '62%', height: 4, background: '#10b981', borderRadius: 2, opacity: 0.6 }} />
                      <div style={{ width: '62%', height: hgt, background: isPeak ? 'var(--color-warning-600)' : 'var(--color-primary-500)', borderRadius: '4px 4px 0 0' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{t('medicalAlliance.monthSuffix', { month: pt.month })}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
              <span>{t('medicalAlliance.totalReferrals', { count: referralTrend.reduce((s, pt) => s + pt.count, 0) })}</span>
              <span>{t('medicalAlliance.totalClosed', { count: referralTrend.reduce((s, pt) => s + pt.completed, 0) })}</span>
              <span>{t('medicalAlliance.mom')} <b style={{ color: 'var(--color-success-600)' }}>+18.2%</b></span>
            </div>
          </div>

          {/* F5. 同步事件流 */}
          <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: 'var(--space-4, 16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <RefreshCw size={15} color="var(--color-primary-500)" /> {t('medicalAlliance.syncEventStream')}
              </h3>
              <span style={{ marginLeft: 'var(--space-3, 12px)', fontSize: 11, padding: '2px 10px', borderRadius: 999, background: syncEventsReal ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: syncEventsReal ? '#15803d' : '#92400e' }}>
                {syncEventsReal ? t('medicalAlliance.realApi') : t('medicalAlliance.demoFallback')}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
                {t('medicalAlliance.failedCount', { failed: syncEvents.filter((e: any) => e.status === 'failed').length, total: syncEvents.length })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {syncEvents.slice(0, 14).map((e: any) => {
                const typeMap: Record<string, string> = {
                  study_pushed: t('medicalAlliance.studyPushed'), study_pulled: t('medicalAlliance.studyPulled'), user_sync: t('medicalAlliance.userSync'), config_sync: t('medicalAlliance.configSync'),
                }
                const ok = e.status === 'success'
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-primary, #f8fafc)', borderRadius: 6, fontSize: 12, border: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: ok ? 'var(--color-success-600)' : 'var(--color-error-600)',
                    }} />
                    <b style={{ color: 'var(--text-primary, #1e293b)', width: 90 }}>{typeMap[e.type] ?? e.type}</b>
                    <code style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{e.siteId}</code>
                    <span style={{ color: '#6b7280' }}>{t('medicalAlliance.eventData', { count: Number(e.count ?? 0), mb: Number(e.bytes ?? 0) })}</span>
                    <span style={{ color: '#6b7280' }}>{t('medicalAlliance.durationSuffix', { seconds: e.duration })}</span>
                    <span style={{ marginLeft: 'auto', color: ok ? 'var(--color-success-600)' : 'var(--color-error-600)', fontWeight: 700 }}>{ok ? t('medicalAlliance.success') : t('medicalAlliance.failed')}</span>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11 }}>{e.timestamp ? new Date(e.timestamp).toLocaleString('zh-CN') : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {/* F7. 机构健康度评分 */}
          <div style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: 'var(--space-4, 16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <AlertTriangle size={15} color="var(--color-warning-600)" /> {t('medicalAlliance.healthScoreTitle')}
              </h3>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
                {t('medicalAlliance.healthScoreFormula')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {sites.map((s: any) => {
                const uptime = Number(s.uptimePct ?? 0)
                const lagHours = s.lastSync ? Math.floor((Date.now() - new Date(s.lastSync).getTime()) / 3600000) : 99
                const latency = Number(s.latencyMs ?? 99)
                const score = Math.max(0, Math.min(100, Math.round(uptime * 0.5 + Math.max(0, 100 - lagHours * 5) * 0.3 + Math.max(0, 100 - latency) * 0.2)))
                const color = score >= 90 ? 'var(--color-success-600)' : score >= 75 ? 'var(--color-warning-600)' : 'var(--color-error-600)'
                return (
                  <div key={s.id} style={{ padding: 'var(--space-3, 12px)', background: 'var(--bg-primary, #f8fafc)', borderRadius: 8, border: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)' }}>
                      <b style={{ fontSize: 12, color: 'var(--text-primary, #1e293b)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</b>
                      <span style={{ fontSize: 16, fontWeight: 800, color }}>{score}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border-default, rgba(0,0,0,0.12))', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 999 }} />
                    </div>
                    <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
                      <span>{t('medicalAlliance.uptimeInline', { uptime })}</span>
                      <span>{t('medicalAlliance.syncInline', { value: lagHours > 24 ? t('medicalAlliance.daysAgo', { days: Math.floor(lagHours / 24) }) : `${Math.max(0, lagHours)}h` })}</span>
                      <span>{latency}ms</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280' }}>
              {t('medicalAlliance.healthNote')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MedicalAlliancePage

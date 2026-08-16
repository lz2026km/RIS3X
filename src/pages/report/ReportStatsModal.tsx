/**
 * [v3.0.6.11-103 Wave 2A] 报告统计报表 Modal
 * 数据源: reportApi.getOverview / getByDoctor / getDailyTrend (后端 GET /reports/overview, /reports/by-doctor, /reports/daily-trend)
 * 三个区块: 总览 (状态分布/今日/平均时效) + 医生维度 + 近 30 日趋势
 */
import React, { useEffect, useState } from 'react'
import { Modal, Tag, Spin, Empty, Space } from 'antd'
import { BarChart3, FileText, Clock, Zap, UserCheck, CalendarDays, TrendingUp } from 'lucide-react'
import { reportApi } from '../../services/api/reportApi'
import { t } from '../../i18n/appI18n'

interface OverviewData {
  total: number
  todayCreated: number
  todayCompleted: number
  todaySigned: number
  todayPublished: number
  criticalCount: number
  pendingCount: number
  overdueCount: number
  avgTurnaroundHours: number
  byStatus: Record<string, number>
}

interface DoctorStat {
  id: string
  name: string
  total: number
  published: number
  pending: number
  avgTurnaroundHours: number
}

interface TrendItem {
  date: string
  created: number
  published: number
  signed: number
}

const STATUS_ZH: Record<string, string> = {
  PENDING_ASSIGNMENT: '待分配',
  ASSIGNED: '已分配',
  WRITING: '书写中',
  SUBMITTED: '已提交',
  INITIAL_REVIEW: '初审中',
  FINAL_REVIEW: '终审中',
  CO_SIGN_REVIEW: '双签中',
  REVIEWED: '已审核',
  SIGNING: '签发中',
  SIGNED: '已签发',
  PUBLISHED: '已发布',
  AMENDING: '修订中',
  AMENDED: '已修订',
  WITHDRAWN: '已撤回',
  REJECTED: '已驳回',
  ESCALATED: '已升级',
  ARCHIVED: '已归档',
  RECTIFYING: '整改中',
  SUPPLEMENTING: '补充中',
  SUPPLEMENTED: '已补充',
  REDISTRIBUTING: '重分配中',
}

export interface ReportStatsModalProps {
  open: boolean
  onClose: () => void
}

export default function ReportStatsModal({ open, onClose }: ReportStatsModalProps) {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [doctors, setDoctors] = useState<DoctorStat[]>([])
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(false)
  const [section, setSection] = useState<'overview' | 'doctors' | 'trend'>('overview')
  const [live, setLive] = useState<'api' | 'fallback'>('api')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const [ov, bd, dt] = await Promise.all([
        reportApi.getOverview(),
        reportApi.getByDoctor(),
        reportApi.getDailyTrend(30),
      ])
      if (cancelled) return
      const ok = [ov, bd, dt].some((r) => r.success)
      setLive(ok ? 'api' : 'fallback')
      if (ov.success && ov.data) setOverview(ov.data)
      if (bd.success && bd.data?.items) setDoctors(bd.data.items)
      if (dt.success && dt.data?.items) setTrend(dt.data.items)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open])

  const maxTrend = Math.max(1, ...trend.map((d) => Math.max(d.created, d.published, d.signed)))
  const maxDoctor = Math.max(1, ...doctors.map((d) => d.total))
  const statusEntries = overview?.byStatus ? Object.entries(overview.byStatus).sort((a, b) => b[1] - a[1]) : []

  const tabBtn = (key: 'overview' | 'doctors' | 'trend', label: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => setSection(key)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
        fontWeight: section === key ? 700 : 500, transition: 'all 0.15s',
        background: section === key ? '#1e40af' : 'transparent',
        color: section === key ? '#fff' : '#64748b',
      }}
    >
      {icon}{label}
    </button>
  )

  return (
    <Modal
      title={<Space><BarChart3 size={16} style={{ color: '#1e40af' }} />{t('reportStats.title')}{live === 'api' ? <Tag color="green">{t('reportStats.apiLive')}</Tag> : <Tag color="orange">{t('reportStats.demoFallback')}</Tag>}</Space>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={860}
      destroyOnHidden
    >
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {tabBtn('overview', t('reportStats.tabOverview'), <BarChart3 size={14} />)}
        {tabBtn('doctors', t('reportStats.tabDoctors'), <UserCheck size={14} />)}
        {tabBtn('trend', t('reportStats.tabTrend'), <CalendarDays size={14} />)}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /> <span style={{ marginLeft: 10, color: '#94a3b8', fontSize: 13 }}>{t('reportStats.loading')}</span></div>
      ) : section === 'overview' ? (
        <div>
          {overview ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: t('reportStats.total'), value: overview.total, color: '#1e40af', icon: <FileText size={16} /> },
                  { label: t('reportStats.todayCreated'), value: overview.todayCreated, color: '#0891b2', icon: <TrendingUp size={16} /> },
                  { label: t('reportStats.todayCompleted'), value: overview.todayCompleted, color: '#059669', icon: <Clock size={16} /> },
                  { label: t('reportStats.critical'), value: overview.criticalCount, color: '#dc2626', icon: <Zap size={16} /> },
                ].map((c) => (
                  <div key={c.label} style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.color, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{c.icon}{c.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: t('reportStats.pending'), value: overview.pendingCount, color: '#7c3aed' },
                  { label: t('reportStats.overdue'), value: overview.overdueCount, color: '#ea580c' },
                  { label: t('reportStats.todaySigned'), value: overview.todaySigned, color: '#0e7490' },
                  { label: t('reportStats.avgTurnaround'), value: `${overview.avgTurnaroundHours}h`, color: '#334155' },
                ].map((c) => (
                  <div key={c.label} style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 8 }}>{t('reportStats.byStatus')}</div>
              {statusEntries.length === 0 ? (
                <Empty description={t('reportStats.noData')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {statusEntries.map(([state, count]) => (
                    <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Tag style={{ width: 90, textAlign: 'center', margin: 0 }}>{STATUS_ZH[state] ?? state}</Tag>
                      <div style={{ flex: 1, height: 14, background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 7, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${overview.total > 0 ? (count / overview.total) * 100 : 0}%`, background: 'linear-gradient(90deg, #1e40af, #3b82f6)', borderRadius: 7 }} />
                      </div>
                      <span style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#334155' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Empty description={t('reportStats.noData')} />
          )}
        </div>
      ) : section === 'doctors' ? (
        <div>
          {doctors.length === 0 ? (
            <Empty description={t('reportStats.noData')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '0 4px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                <span>{t('reportStats.doctor')}</span><span>{t('reportStats.total')}</span><span>{t('reportStats.published')}</span><span>{t('reportStats.pending')}</span>
              </div>
              {doctors.map((d) => (
                <div key={d.id} style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{d.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{d.total}</span>
                    <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>{d.published}</span>
                    <span style={{ fontSize: 13, color: '#ea580c', fontWeight: 600 }}>{d.pending}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(d.total / maxDoctor) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{t('reportStats.avgTurnaround')} {d.avgTurnaroundHours}h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {trend.length === 0 ? (
            <Empty description={t('reportStats.noData')} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10, fontSize: 12, color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#1e40af', display: 'inline-block' }} />{t('reportStats.created')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#059669', display: 'inline-block' }} />{t('reportStats.published')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#7c3aed', display: 'inline-block' }} />{t('reportStats.signed')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 220, overflowX: 'auto', paddingBottom: 24 }}>
                {trend.map((d) => (
                  <div key={d.date} style={{ flex: 1, minWidth: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
                    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 190 }}>
                      <div style={{ width: 6, height: `${(d.created / maxTrend) * 180}px`, background: '#1e40af', borderRadius: '2px 2px 0 0' }} title={`${d.date} 新建 ${d.created}`} />
                      <div style={{ width: 6, height: `${(d.published / maxTrend) * 180}px`, background: '#059669', borderRadius: '2px 2px 0 0' }} title={`${d.date} 发布 ${d.published}`} />
                      <div style={{ width: 6, height: `${(d.signed / maxTrend) * 180}px`, background: '#7c3aed', borderRadius: '2px 2px 0 0' }} title={`${d.date} 签署 ${d.signed}`} />
                    </div>
                    <span style={{ fontSize: 9, color: '#94a3b8', transform: 'rotate(-60deg)', whiteSpace: 'nowrap', position: 'absolute', bottom: 0 }}>{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

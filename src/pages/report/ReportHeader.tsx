import React, { useState, useEffect } from 'react'
import { Search, Filter, X, Download, Printer } from 'lucide-react'
import { userApi } from '../../services/api/userApi'
import { LoadingBanner, ErrorBanner } from '../../components/feedback'
import { t } from '../../i18n/appI18n'

const WHITE = 'var(--bg-card)'
const GRAY = '#64748b'
const ACCENT = '#3182ce'

const MODALITIES = ['全部', 'CT', 'MR', 'DR', 'DSA', 'MG']
const STATUSES = [
  '全部', '待分配', '已分配', '书写中', '已提交', '初审中', '初审通过',
  '终审中', '已审核', '签发中', '已签发', '已发布', '修订中', '已修订',
  '已撤回', '已驳回', '已归档',
]

// [v3.0.6.11-95 Wave2B P1] 医生候选由 userApi.list 填充 (role: 医生/主任), 不再写死空数组
interface DoctorOption { id: string; name: string; title?: string }
let cachedDoctors: DoctorOption[] | null = null

export interface ReportHeaderProps {
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  modalityFilter: string
  setModalityFilter: (v: string) => void
  reportDoctorFilter: string
  setReportDoctorFilter: (v: string) => void
  auditorFilter: string
  setAuditorFilter: (v: string) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  criticalOnly: boolean
  setCriticalOnly: (v: boolean) => void
  positiveOnly: boolean
  setPositiveOnly: (v: boolean) => void
  onReset: () => void
  onExport: () => void
  onPrint: () => void
}

export default function ReportHeader({
  search, setSearch, statusFilter, setStatusFilter, modalityFilter, setModalityFilter,
  reportDoctorFilter, setReportDoctorFilter, auditorFilter, setAuditorFilter,
  dateFrom, setDateFrom, dateTo, setDateTo, criticalOnly, setCriticalOnly,
  positiveOnly, setPositiveOnly, onReset, onExport, onPrint,
}: ReportHeaderProps) {
  // [v3.0.6.11-95 Wave2B P1] 医生下拉真实化: userApi.list → role 为 DOCTOR/DIRECTOR (医生/主任)
  const [doctors, setDoctors] = useState<DoctorOption[]>(cachedDoctors ?? [])
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [doctorError, setDoctorError] = useState<string | null>(null)
  useEffect(() => {
    if (cachedDoctors) return
    let cancelled = false
    setLoadingDoctors(true)
    ;(async () => {
      try {
        const res = await userApi.list(0, 200)
        if (cancelled) return
        const raw = res.data as unknown
        const items = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] } | null)?.items ?? [])
        const list: DoctorOption[] = (items as Array<{ id: string; fullName?: string; role?: string; name?: string }>)
          // MSW toUserDto 将 role 映射为中文职称 (主任医师/副主任医师/主治医师/住院医师等), 后端为 DOCTOR/DIRECTOR 枚举
          .filter(u => {
            const r = String(u.role ?? '');
            const up = r.toUpperCase();
            return up.includes('DOCTOR') || up.includes('DIRECTOR') || up.includes('主任') || up.includes('医师') || r === '医生';
          })
          .map(u => ({ id: u.id, name: u.fullName ?? u.name ?? u.id, title: String(u.role ?? '') }))
        if (list.length > 0) { cachedDoctors = list; setDoctors(list) }
        setDoctorError(null)
      } catch {
        /* 列表不可用时下拉为空, 不影响其他筛选 */
        if (!cancelled) setDoctorError(t('w9.states.error'))
      } finally {
        if (!cancelled) setLoadingDoctors(false)
      }
    })()
    return () => { cancelled = true }
  }, [])
  const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 6,
    border: `1px solid ${active ? color : 'var(--border-color)'}`,
    background: active ? `${color}18` : WHITE,
    color: active ? color : GRAY,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  })

  const dropStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: WHITE,
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer', }

  return (
    <div style={{
      background: WHITE, borderRadius: 10, padding: '14px 16px',
      border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 14,
    }}>
      {loadingDoctors && <LoadingBanner message={t('w9.states.loading')} />}
      {doctorError && !loadingDoctors && <ErrorBanner message={doctorError} />}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 12px', background: 'var(--bg-card)' }}>
          <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者姓名 / 检查号 / 报告ID / 检查号..."
            style={{ border: 'none', fontSize: 12, width: '100%', background: 'transparent' }} />
          {search && <X size={13} style={{ color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }} onClick={() => setSearch('')} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginRight: 2 }}>设备:</span>
          {MODALITIES.map(m => (
            <button key={m} onClick={() => setModalityFilter(m)} style={btnStyle(modalityFilter === m, ACCENT)}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginRight: 2 }}>状态:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={dropStyle}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginRight: 2 }}>报告医生:</span>
          <select value={reportDoctorFilter} onChange={e => setReportDoctorFilter(e.target.value)} style={dropStyle}>
            <option value="">全部</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.title ? ` (${d.title})` : ''}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginRight: 2 }}>审核医生:</span>
          <select value={auditorFilter} onChange={e => setAuditorFilter(e.target.value)} style={dropStyle}>
            <option value="">全部</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.title ? ` (${d.title})` : ''}</option>)}
          </select>
        </div>
      </div>

      {!loadingDoctors && !doctorError && doctors.length === 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>{t('w9.states.empty')}</div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 600 }}>日期:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12,}} />
          <span style={{ fontSize: 12, color: GRAY }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12,}} />
        </div>
        <button onClick={() => setCriticalOnly(!criticalOnly)} style={btnStyle(criticalOnly, 'var(--color-error-600)')}>
          {criticalOnly ? '' : ''} 仅危急值
        </button>
        <button onClick={() => setPositiveOnly(!positiveOnly)} style={btnStyle(positiveOnly, 'var(--color-warning-600)')}>
          {positiveOnly ? '' : ''} 仅阳性
        </button>
        <button onClick={onReset} style={{ ...btnStyle(false, GRAY), color: GRAY }}>
          <X size={12} /> 清空
        </button>
        <button onClick={onExport} style={{ ...btnStyle(false, ACCENT), marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Download size={12} /> 导出
        </button>
        <button onClick={onPrint} style={{ ...btnStyle(false, GRAY), display: 'flex', alignItems: 'center', gap: 4 }}>
          <Printer size={12} /> 打印
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#94a3b8', borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
        <Filter size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        提示: 使用高级筛选可进一步按质量评分过滤
      </div>
    </div>
  )
}

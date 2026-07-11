import React from 'react'
import { Search, Filter, X } from 'lucide-react'

const WHITE = '#ffffff'
const GRAY = '#64748b'
const ACCENT = '#3182ce'

const MODALITIES = ['全部', 'CT', 'MR', 'DR', 'DSA', 'MG']
const STATUSES = [
  '全部', '待分配', '已分配', '书写中', '已提交', '初审中', '初审通过',
  '终审中', '已审核', '签发中', '已签发', '已发布', '修订中', '已修订',
  '已撤回', '已驳回', '已归档',
]
const PRIORITIES = ['全部', '紧急', '危重', '普通']
const DOCTORS: { id: string; name: string }[] = []

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
  const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 6,
    border: `1px solid ${active ? color : '#e2e8f0'}`,
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
    border: '1px solid #e2e8f0',
    background: WHITE,
    color: '#334155',
    fontSize: 12,
    cursor: 'pointer',
    outline: 'none',
  }

  return (
    <div style={{
      background: WHITE, borderRadius: 10, padding: '14px 16px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', background: '#fafbfc' }}>
          <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者姓名 / 检查号 / 报告ID / Accession号..."
            style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', background: 'transparent' }} />
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
            {DOCTORS.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginRight: 2 }}>审核医生:</span>
          <select value={auditorFilter} onChange={e => setAuditorFilter(e.target.value)} style={dropStyle}>
            <option value="">全部</option>
            {DOCTORS.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 600 }}>日期:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
          <span style={{ fontSize: 12, color: GRAY }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        </div>
        <button onClick={() => setCriticalOnly(!criticalOnly)} style={btnStyle(criticalOnly, '#dc2626')}>
          {criticalOnly ? '✓' : ''} 仅危急值
        </button>
        <button onClick={() => setPositiveOnly(!positiveOnly)} style={btnStyle(positiveOnly, '#d97706')}>
          {positiveOnly ? '✓' : ''} 仅阳性
        </button>
        <button onClick={onReset} style={{ ...btnStyle(false, GRAY), color: GRAY }}>
          <X size={12} /> 清空
        </button>
        <button onClick={onExport} style={{ ...btnStyle(false, ACCENT), marginLeft: 'auto' }}>导出</button>
        <button onClick={onPrint} style={{ ...btnStyle(false, GRAY) }}>打印</button>
      </div>

      <div style={{ fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        <Filter size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        提示: 使用高级筛选可进一步按质量评分过滤
      </div>
    </div>
  )
}

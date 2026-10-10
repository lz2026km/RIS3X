import { useMemo } from 'react'
import { Search, X, Calendar, Settings, Filter, CheckCircle, Send, Edit3, Eye, Phone, CheckSquare, Square, Bell, ArrowUpRight, ShieldAlert, ArrowUp, Archive, Trash2 } from 'lucide-react'
import { Popconfirm } from 'antd'
import type { CriticalValue } from './types'
import { STATUS_CONFIG, SEVERITY_CONFIG, CN_STATUS_TO_STORE } from './types'
// v3.0.6.11: 导入 criticalStore 导出的 MACHINE_STATE_TO_STORE,
// 把状态机 state value (found/notified/acknowledged/...) 映射到 store status,
// 让 critical map 在 UI 层真正被消费。
import { MACHINE_STATE_TO_STORE, useCriticalStore } from '../../store/criticalStore'
import { t } from '../../i18n/appI18n'

const MODALITY_LIST = ['全部', 'CT', 'MR', 'DR', 'DSA', '超声']
// v3.0.6.11: STATUS_LIST 改为 criticalStore 英文状态 key + 中文 label,
// 与 store 中的 pending/notified/acknowledged/resolving/resolved/escalated/cancelled/closed_loop/overdue 对齐。
const STATUS_LIST = ['全部', 'pending', 'resolving', 'resolved', 'overdue']
const STATUS_LABEL: Record<string, string> = {
  pending: 'cvList.status.pending',
  notified: 'cvList.status.notified',
  acknowledged: 'cvList.status.acknowledged',
  resolving: 'cvList.status.resolving',
  resolved: 'cvList.status.resolved',
  closed_loop: 'cvList.status.closed_loop',
  escalated: 'cvList.status.escalated',
  cancelled: 'cvList.status.cancelled',
  overdue: 'cvList.status.overdue',
}
const SEVERITY_LIST = ['全部', '危及生命', '危急', '高危', '紧急', '警告']
const TIME_RANGE_LIST = ['全部', '30分钟内', '1小时内', '2小时内', '超时']
const MODALITY_I18N: Record<string, string> = { '全部': 'cvList.all', '超声': 'cvList.ultrasound' }
const SEVERITY_I18N: Record<string, string> = { '全部': 'cvList.all', '危及生命': 'cvList.sev.lifeThreatening', '危急': 'cvList.sev.critical', '高危': 'cvList.sev.high', '紧急': 'cvList.sev.urgent', '警告': 'cvList.sev.warning' }
const TIME_RANGE_I18N: Record<string, string> = { '全部': 'cvList.all', '30分钟内': 'cvList.time.30min', '1小时内': 'cvList.time.1h', '2小时内': 'cvList.time.2h', '超时': 'cvList.time.overdue' }

interface FilterBarProps {
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  modalityFilter: string
  setModalityFilter: (v: string) => void
  severityFilter: string
  setSeverityFilter: (v: string) => void
  timeRangeFilter: string
  setTimeRangeFilter: (v: string) => void
  dateRange: string
  setDateRange: (v: string) => void
  onBatchNotify: () => void
  onBatchProcess: () => void
  selectedCount: number
  onOpenSettings: () => void
}

const filterBtnStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: `1px solid ${isActive ? 'var(--color-primary-800)' : 'var(--border-color)'}`,
  background: isActive ? 'var(--color-primary-800)' : 'var(--bg-card)', color: isActive ? '#fff' : '#64748b',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
})

export const FilterBar = ({
  search, setSearch, statusFilter, setStatusFilter, modalityFilter, setModalityFilter,
  severityFilter, setSeverityFilter, timeRangeFilter, setTimeRangeFilter,
  dateRange, setDateRange, onBatchNotify, onBatchProcess, selectedCount, onOpenSettings,
}: FilterBarProps) => (
  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 20px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 'var(--space-4, 16px)' }}>
    <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flex: 1, background: 'var(--bg-card)', borderRadius: 8, padding: '8px 14px', border: '1px solid var(--border-color)' }}>
        <Search size={16} style={{ color: 'var(--text-muted, #94a3b8)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('cvList.searchPlaceholder')} style={{ border: 'none', fontSize: 12, width: '100%', background: 'transparent' }} />
        {search && <X size={14} style={{ color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={14} style={{ color: 'var(--text-muted, #64748b)' }} />
        <input type="date" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)',}} />
      </div>
      <button onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted, #64748b)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        <Settings size={14} />
        {t('cvList.rulesSettings')}
      </button>
    </div>
    <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'var(--space-2, 8px)' }}>
        <Filter size={14} style={{ color: 'var(--text-muted, #64748b)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{t('cvList.statusLabel')}</span>
      </div>
      {STATUS_LIST.map(s => (
        <button key={s} onClick={() => setStatusFilter(s)} style={filterBtnStyle(statusFilter === s)}>
          {s === '全部' ? t('cvList.all') : t(STATUS_LABEL[s] ?? s)}
        </button>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{t('cvList.modalityLabel')}</span>
        {MODALITY_LIST.map(m => (
          <button key={m} onClick={() => setModalityFilter(m)} style={filterBtnStyle(modalityFilter === m)}>{MODALITY_I18N[m] ? t(MODALITY_I18N[m]) : m}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{t('cvList.severityLabel')}</span>
        {SEVERITY_LIST.map(s => (
          <button key={s} onClick={() => setSeverityFilter(s)} style={filterBtnStyle(severityFilter === s)}>{t(SEVERITY_I18N[s] ?? s)}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{t('cvList.timeRangeLabel')}</span>
        {TIME_RANGE_LIST.map(tr => (
          <button key={tr} onClick={() => setTimeRangeFilter(tr)} style={filterBtnStyle(timeRangeFilter === tr)}>{t(TIME_RANGE_I18N[tr] ?? tr)}</button>
        ))}
      </div>
    </div>
    {selectedCount > 0 && (
      <div style={{ display: 'flex', gap: 10, marginTop: 'var(--space-3, 12px)', paddingTop: 'var(--space-3, 12px)', borderTop: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: 12, color: 'var(--color-primary-800)', fontWeight: 700 }}>{t('cvList.selectedCount', { count: selectedCount })}</span>
        <button onClick={onBatchNotify} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--color-warning-600)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Send size={13} />{t('cvList.batchNotify')}
        </button>
        <button onClick={onBatchProcess} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #059669', background: 'var(--color-success-bg)', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <CheckCircle size={13} />{t('cvList.batchProcess')}
        </button>
      </div>
    )}
  </div>
)

interface CriticalValueRowProps {
  cv: CriticalValue
  isSelected: boolean
  onSelect: () => void
  onProcess: () => void
  onViewDetail: () => void
  onContactClinical: () => void
  onVoiceCall: () => void
  onClinicalReceipt: () => void
  onAcknowledge: () => void
  onTransferToFollowUp: () => void
  onEscalate: () => void
  onCloseLoop: () => void
  onDelete: () => void
  onGo5Step: () => void
}

const CriticalValueRow = ({ cv, isSelected, onSelect, onProcess, onViewDetail, onContactClinical, onVoiceCall, onClinicalReceipt, onAcknowledge, onTransferToFollowUp, onEscalate, onCloseLoop, onDelete, onGo5Step }: CriticalValueRowProps) => {
  const statusCfg = STATUS_CONFIG[cv.status] || STATUS_CONFIG['pending']!
  const severityCfg = SEVERITY_CONFIG[cv.severity] || SEVERITY_CONFIG['高危']!
  const StatusIcon = Bell

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '40px 100px 90px 130px 60px 140px 100px 90px 120px 80px 90px 100px 60px',
      alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
      background: isSelected ? 'var(--color-info-bg)' : 'var(--bg-card)',
      borderLeft: `4px solid ${severityCfg.borderColor}`, transition: 'background 0.15s',
    }}
    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={onSelect} style={{ cursor: 'pointer', color: isSelected ? 'var(--color-primary-800)' : '#cbd5e1' }}>
          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>{cv.id}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{cv.patientName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{cv.gender}·{cv.age}岁</div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{cv.examItemName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{cv.modality}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{cv.deviceName?.split('（')[0] || cv.modality}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-error-600)' }}>{cv.resultValue} {cv.resultUnit}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{t('cvList.criticalPrefix')} {cv.criticalRange}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{cv.reportedByName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{(cv.reportedTime || '').split(' ')[1] || cv.reportedTime}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusIcon size={14} style={{ color: statusCfg.color }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color, background: statusCfg.bg, padding: '2px 10px', borderRadius: 10 }}>{t(STATUS_LABEL[cv.status] ?? cv.status)}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{cv.processingTime ? (cv.processingTime || '').split(' ')[1] || cv.processingTime : '-'}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{cv.processingDuration || '-'}</div>
      <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
        {(cv.status === '待处理' || cv.status === 'pending' || cv.status === 'notified' || cv.status === 'voice_called' || cv.status === 'acknowledged' || cv.status === 'receipted') && (
          <button onClick={onProcess} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #059669', background: 'var(--color-success-bg)', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Edit3 size={10} />{t('cvList.process')}
          </button>
        )}
        <button onClick={onViewDetail} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-primary-800)', background: 'var(--bg-card)', color: 'var(--color-primary-800)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Eye size={10} />{t('cvList.detail')}
        </button>
        {(cv.status === 'notified' || cv.status === '已通知') && (
          <button onClick={onVoiceCall} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #ea580c', background: 'var(--color-warning-bg)', color: '#ea580c', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Phone size={10} />{t('cvList.phone')}
          </button>
        )}
        {(cv.status === 'voice_called') && (
          <button onClick={onAcknowledge} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-primary-600)', background: 'var(--color-info-bg)', color: 'var(--color-primary-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <CheckCircle size={10} />{t('cvList.confirm')}
          </button>
        )}
        {(cv.status === 'acknowledged' || cv.status === '已接收') && (
          <button onClick={onClinicalReceipt} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-success-600)', background: 'var(--color-success-bg)', color: 'var(--color-success-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Edit3 size={10} />{t('cvList.receipt')}
          </button>
        )}
        <button onClick={onContactClinical} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-warning-600)', background: 'var(--bg-card)', color: 'var(--color-warning-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Phone size={10} />{t('cvList.contact')}
        </button>
        {cv.status !== 'closed_loop' && cv.status !== 'resolved' && cv.status !== '已处理' && (
          <button onClick={onCloseLoop} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #047857', background: 'var(--color-success-bg)', color: '#047857', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Archive size={10} />{t('cvList.closeLoop')}
          </button>
        )}
        {cv.status !== 'escalated' && cv.status !== '已升级' && (
          <button onClick={onEscalate} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #7c3aed', background: 'var(--color-info-bg)', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowUp size={10} />{t('cvList.escalate')}
          </button>
        )}
        <button onClick={onGo5Step} title={t('cvList.fiveStepWorkflow')} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-primary-600)', background: 'var(--color-info-bg)', color: 'var(--color-primary-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          <CheckCircle size={10} />{t('cvList.fiveStep')}
        </button>
        <Popconfirm title={t('cvList.deleteTitle')} description={t('cvList.deleteDesc')} onConfirm={onDelete} okText={t('cvList.deleteOk')} cancelText={t('cvList.deleteCancel')} okButtonProps={{ danger: true }}>
          <button style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-error-600)', background: 'var(--bg-card)', color: 'var(--color-error-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Trash2 size={10} />{t('cvList.delete')}
          </button>
        </Popconfirm>
      </div>
      <div>
        {cv.transferredToFollowUp ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)', padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'var(--color-success-bg)', color: '#059669', border: '1px solid var(--color-success-border)' }}>
            <CheckCircle size={11} />{t('cvList.transferred')}
          </span>
        ) : (
          <button onClick={onTransferToFollowUp} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #7c3aed', background: 'var(--color-info-bg)', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }} title={t('cvList.transferToFollowUp')}>
            <ArrowUpRight size={12} />
          </button>
        )}
      </div>
      <div />
    </div>
  )
}

interface CriticalValueListProps {
  filtered: CriticalValue[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onProcess: (cv: CriticalValue) => void
  onViewDetail: (cv: CriticalValue) => void
  onContactClinical: (cv: CriticalValue) => void
  onVoiceCall: (cv: CriticalValue) => void
  onClinicalReceipt: (cv: CriticalValue) => void
  onAcknowledge: (cv: CriticalValue) => void
  onTransferToFollowUp: (cv: CriticalValue) => void
  onEscalate: (cv: CriticalValue) => void
  onCloseLoop: (cv: CriticalValue) => void
  onDelete: (cv: CriticalValue) => void
  onGo5Step: (cv: CriticalValue) => void
  criticalValues: CriticalValue[]
}

export const CriticalValueList = ({
  filtered, selectedIds, onToggleSelect, onToggleSelectAll,
  onProcess, onViewDetail, onContactClinical, onVoiceCall, onClinicalReceipt, onAcknowledge, onTransferToFollowUp, onEscalate, onCloseLoop, onDelete, onGo5Step, criticalValues,
}: CriticalValueListProps) => {
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length

  // v3.0.6.11: 从 criticalStore 的 actor pool 读取实时 machine state value,
  // 用 MACHINE_STATE_TO_STORE 映射到 store status,使 map 在 UI 中真正被消费。
  const actors = useCriticalStore((s) => s.actors)
  const machineStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const actor of actors.values()) {
      const snap = actor.getSnapshot()
      const v = snap.value as string
      const storeStatus = MACHINE_STATE_TO_STORE[v] ?? 'pending'
      counts[storeStatus] = (counts[storeStatus] ?? 0) + 1
    }
    return counts
  }, [actors])

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #64748b)', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={onToggleSelectAll} style={{ cursor: 'pointer', color: allSelected ? 'var(--color-primary-800)' : '#cbd5e1' }}>
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          </div>
        </div>
        <div style={{ width: 100 }}>{t('cvList.colId')}</div>
        <div style={{ width: 90 }}>{t('cvList.colPatient')}</div>
        <div style={{ width: 130 }}>{t('cvList.colExamItem')}</div>
        <div style={{ width: 60 }}>{t('cvList.colDevice')}</div>
        <div style={{ width: 140 }}>{t('cvList.colResult')}</div>
        <div style={{ width: 90 }}>{t('cvList.colReporter')}</div>
        <div style={{ width: 80 }}>{t('cvList.colStatus')}</div>
        <div style={{ width: 90 }}>{t('cvList.colProcessTime')}</div>
        <div style={{ width: 90 }}>{t('cvList.colProcessDuration')}</div>
        <div style={{ flex: 1 }}>{t('cvList.colActions')}</div>
        <div style={{ width: 60 }}>{t('cvList.colTransfer')}</div>
        <div style={{ width: 60 }} />
      </div>

      {filtered.length > 0 ? (
        filtered.map(cv => (
          <CriticalValueRow
            key={cv.id}
            cv={cv}
            isSelected={selectedIds.has(cv.id)}
            onSelect={() => onToggleSelect(cv.id)}
            onProcess={() => onProcess(cv)}
            onViewDetail={() => onViewDetail(cv)}
            onContactClinical={() => onContactClinical(cv)}
            onVoiceCall={() => onVoiceCall(cv)}
            onClinicalReceipt={() => onClinicalReceipt(cv)}
            onAcknowledge={() => onAcknowledge(cv)}
            onTransferToFollowUp={() => onTransferToFollowUp(cv)}
            onEscalate={() => onEscalate(cv)}
            onCloseLoop={() => onCloseLoop(cv)}
            onDelete={() => onDelete(cv)}
            onGo5Step={() => onGo5Step(cv)}
          />
        ))
      ) : (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <ShieldAlert size={40} style={{ color: '#cbd5e1', marginBottom: 'var(--space-3, 12px)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>{t('cvList.emptyTitle')}</div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 'var(--space-1, 4px)' }}>{t('cvList.emptyDesc')}</div>
        </div>
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
          {t('cvList.totalRecordsPrefix')} <span style={{ fontWeight: 700, color: 'var(--color-primary-800)' }}>{filtered.length}</span> {t('cvList.totalRecordsMid')}
          {t('cvList.selectedPrefix')} <span style={{ fontWeight: 700, color: 'var(--color-primary-800)' }}>{selectedIds.size}</span> {t('cvList.selectedSuffix')}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          {/* v3.0.6.11: STATUS_CONFIG 中英文键(pending/...)优先显示 machine-derived counts */}
          {Object.entries(STATUS_CONFIG).filter(([key]) => !CN_STATUS_TO_STORE[key] && key !== '待处理' && key !== '处理中' && key !== '已处理' && key !== '超时').map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                {t(STATUS_LABEL[key] ?? key)}: {machineStatusCounts[key] ?? criticalValues.filter(c => c.status === key).length}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', marginLeft: 'var(--space-2, 8px)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{t('cvList.transferredLabel')} {criticalValues.filter(c => c.transferredToFollowUp).length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import {
  Search, Filter, RefreshCw, Clock, AlertTriangle, CheckCircle,
  X, Calendar, Check, ChevronDown, ChevronUp, Zap, User, Stethoscope,
  Monitor, Activity, BookmarkCheck, Barcode, FileSpreadsheet, CheckSquare,
  XCircle, LayoutList, Printer, ArrowRight, ListChecks, FileText, Save,
} from 'lucide-react'
import { initialUsers, initialExamRooms } from '../../data/initialData'
import { t } from '../../i18n/appI18n'

const patientTypeLabel = (v: string): string => ({
  '门诊': t('worklistToolbar.ptOutpatient'),
  '住院': t('worklistToolbar.ptInpatient'),
  '急诊': t('worklistToolbar.ptEmergency'),
  '体检': t('worklistToolbar.ptPhysical'),
}[v] ?? v)

const priorityLabel = (v: string): string => ({
  '普通': t('worklistToolbar.prNormal'),
  '紧急': t('worklistToolbar.prUrgent'),
  '危重': t('worklistToolbar.prCritical'),
  '会诊': t('worklistToolbar.prConsult'),
}[v] ?? v)

// ============================================================
// 常量
// ============================================================
const PRIORITY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '普通': { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: '普通' },
  '紧急': { bg: '#f59e0b22', color: 'var(--color-warning-500)', label: '紧急' },
  '危重': { bg: '#ef444422', color: 'var(--color-error-500)', label: '危重' },
  '会诊': { bg: '#8b5cf622', color: '#7c3aed', label: '会诊' },
}

const MODALITY_LIST = ['CT', 'MR', 'DR', 'DSA', 'MG', 'GI']
const PATIENT_TYPE_LIST = ['门诊', '住院', '急诊', '体检']
const PRIORITY_LIST = ['普通', '紧急', '危重', '会诊']
// 状态筛选: 显示中文, 过滤用英文规范值 (EXAM_STATUS_MAP)
const statusOptions = (): Array<{ label: string; value: string }> => [
  { label: t('worklistToolbar.stScheduled'), value: 'SCHEDULED' },
  { label: t('worklistToolbar.stArrived'), value: 'ARRIVED' },
  { label: t('worklistToolbar.stInProgress'), value: 'IN_PROGRESS' },
  // [v3.0.6.11-95 Wave 1A] 暂停/质控退回 状态筛选
  { label: t('worklistToolbar.stPaused'), value: 'PAUSED' },
  { label: t('worklistToolbar.stQcReject'), value: 'QC_REJECT' },
  { label: t('worklistToolbar.stCompleted'), value: 'COMPLETED' },
  { label: t('worklistToolbar.stCancelled'), value: 'CANCELLED' },
]

const getDoctorById = (doctorId: string) => initialUsers.find(u => u.id === doctorId)

// ============================================================
// 类型定义
// ============================================================
export interface FilterState {
  search: string
  dateStart: string
  dateEnd: string
  modalities: string[]
  patientTypes: string[]
  priorities: string[]
  statuses: string[]
  doctorId: string
}

export interface BatchState {
  selectedIds: Set<string>
  operation: 'priority' | 'room' | 'print' | 'export' | null
  priorityValue: string
  roomValue: string
}

// ============================================================
// FilterBar
// ============================================================
interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  onReset: () => void
  presets?: Array<{ name: string; filters: FilterState }>
  onApplyPreset?: (preset: { name: string; filters: FilterState }) => void
  onSavePreset?: () => void
  onDeletePreset?: (index: number) => void
  showSavePreset?: boolean
  savePresetName?: string
  onSavePresetNameChange?: (name: string) => void
}

export function FilterBar({ filters, onChange, onReset, presets, onApplyPreset, onSavePreset, onDeletePreset, showSavePreset, savePresetName, onSavePresetNameChange }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false)
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false)

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleArrayFilter = <T extends string>(key: 'modalities' | 'patientTypes' | 'priorities' | 'statuses', value: T) => {
    const arr = filters[key] as T[]
    const newArr = arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value]
    updateFilter(key, newArr)
  }

  const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        border: '1px solid',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderColor: active ? 'var(--color-primary-800)' : '#e2e8f0',
        background: active ? 'var(--color-primary-800)' : 'var(--bg-card)',
        color: active ? '#fff' : '#64748b',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1, 4px)',
      }}
    >
      {active && <Check size={14} />}
      {label}
    </button>
  )

  return (
    <div
      role="search"
      aria-label={t('worklistToolbar.searchFilter')}
      style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      border: '1px solid var(--border-color)',
      marginBottom: 'var(--space-4, 16px)',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        padding: '14px 16px',
        display: 'flex',
        gap: 'var(--space-3, 12px)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2, 8px)',
          flex: 1,
          minWidth: 240,
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: '8px 12px',
          border: '1px solid var(--border-color)',
        }}>
          <Search size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
            placeholder={t('worklistToolbar.searchPlaceholder')}
            style={{
              border: 'none', fontSize: 12,
              color: 'var(--text-primary)',
              width: '100%',
              background: 'transparent',
            }}
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('worklistToolbar.date')}</span>
          </div>
          <input
            type="date"
            value={filters.dateStart}
            onChange={e => updateFilter('dateStart', e.target.value)}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-primary)',
              background: 'var(--bg-card)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('worklistToolbar.to')}</span>
          <input
            type="date"
            value={filters.dateEnd}
            onChange={e => updateFilter('dateEnd', e.target.value)}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-primary)',
              background: 'var(--bg-card)',
            }}
          />
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1, 4px)',
          }}
        >
          <Filter size={14} />
          {t('worklistToolbar.advancedFilter')}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <button
          onClick={onReset}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1, 4px)',
          }}
        >
          <RefreshCw size={14} />
          {t('worklistToolbar.reset')}
        </button>
      </div>

      {expanded && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: '1px solid var(--border-light)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4, 16px)',
          paddingTop: 'var(--space-4, 16px)',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <Monitor size={14} />
              {t('worklistToolbar.modalityType')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MODALITY_LIST.map(m => (
                <FilterChip key={m} label={m} active={filters.modalities.includes(m)} onClick={() => toggleArrayFilter('modalities', m)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <User size={14} />
              {t('worklistToolbar.patientType')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PATIENT_TYPE_LIST.map(p => (
                <FilterChip key={p} label={patientTypeLabel(p)} active={filters.patientTypes.includes(p)} onClick={() => toggleArrayFilter('patientTypes', p)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <Zap size={14} />
              {t('worklistToolbar.priority')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRIORITY_LIST.map(p => (
                <FilterChip key={p} label={priorityLabel(p)} active={filters.priorities.includes(p)} onClick={() => toggleArrayFilter('priorities', p)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <Activity size={14} />
              {t('worklistToolbar.status')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {statusOptions().map(s => (
                <FilterChip key={s.value} label={s.label} active={filters.statuses.includes(s.value)} onClick={() => toggleArrayFilter('statuses', s.value)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <Stethoscope size={14} />
              {t('worklistToolbar.examDoctor')}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDoctorDropdown(!showDoctorDropdown)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: filters.doctorId ? 'var(--color-primary-800)' : '#94a3b8',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{filters.doctorId ? getDoctorById(filters.doctorId)?.name || filters.doctorId : t('worklistToolbar.allDoctors')}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
              {showDoctorDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  maxHeight: 200,
                  overflowY: 'auto',
                  marginTop: 'var(--space-1, 4px)',
                }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { updateFilter('doctorId', ''); setShowDoctorDropdown(false) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateFilter('doctorId', ''); setShowDoctorDropdown(false) } }}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: !filters.doctorId ? 'var(--color-primary-800)' : '#64748b',
                      background: !filters.doctorId ? '#f0f7ff' : 'transparent',
                    }}
                    onMouseEnter={e => { if (filters.doctorId) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (filters.doctorId) e.currentTarget.style.background = 'transparent' }}
                  >
                    {t('worklistToolbar.allDoctors')}
                  </div>
                  {initialUsers
                    .filter(u => u.role === '医生')
                    .map(doc => (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { updateFilter('doctorId', doc.id); setShowDoctorDropdown(false) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateFilter('doctorId', doc.id); setShowDoctorDropdown(false) } }}
                        style={{
                          padding: '8px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                          color: filters.doctorId === doc.id ? 'var(--color-primary-800)' : '#64748b',
                          background: filters.doctorId === doc.id ? '#f0f7ff' : 'transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={e => { if (filters.doctorId !== doc.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { if (filters.doctorId !== doc.id) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span>{doc.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{doc.title}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {expanded && showSavePreset && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-4, 16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)' }}>
            <BookmarkCheck size={14} color="var(--color-primary-800)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('worklistToolbar.filterPresets')}</span>
          </div>
          {presets && presets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-2, 8px)' }}>
              {presets.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', padding: '4px 10px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <button onClick={() => onApplyPreset?.(p)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, padding: 0, whiteSpace: 'nowrap' }}>
                    {p.name}
                  </button>
                  <button onClick={() => onDeletePreset?.(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-secondary)' }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
            <input value={savePresetName || ''} onChange={e => onSavePresetNameChange?.(e.target.value)} placeholder={t('worklistToolbar.presetNamePlaceholder')} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12,}} />
            <button onClick={onSavePreset} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--color-primary-800)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><Save size={14} />{t('worklistToolbar.saveCurrent')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// BatchToolbar
// ============================================================
interface BatchToolbarProps {
  batch: BatchState
  onChange: (batch: BatchState) => void
  onClear: () => void
  onExecute: () => void
  totalSelected: number
}

export function BatchToolbar({ batch, onChange, onClear, onExecute, totalSelected }: BatchToolbarProps) {
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [showRoomDropdown, setShowRoomDropdown] = useState(false)

  if (totalSelected === 0) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)',
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 'var(--space-3, 12px)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3, 12px)',
      boxShadow: '0 4px 12px rgba(30,58,95,0.3)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2, 8px)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
      }}>
        <CheckSquare size={16} style={{ color: '#4ade80' }} />
        {t('worklistToolbar.selectedPrefix')} <span style={{ fontSize: 18, fontWeight: 800 }}>{totalSelected}</span> {t('worklistToolbar.selectedSuffix')}
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 12,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Zap size={14} />
          {t('worklistToolbar.batchChangePriority')}
          <ChevronDown size={14} />
        </button>
        {showPriorityDropdown && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 100,
            marginTop: 6,
            minWidth: 140,
            overflow: 'hidden',
          }}>
            {PRIORITY_LIST.map(p => (
              <div
                key={p}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChange({ ...batch, priorityValue: p })
                  setShowPriorityDropdown(false)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ ...batch, priorityValue: p }); setShowPriorityDropdown(false) } }}
                style={{
                  padding: '10px 14px',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: batch.priorityValue === p ? 'var(--color-primary-800)' : 'var(--text-primary)',
                  background: batch.priorityValue === p ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2, 8px)',
                }}
                onMouseEnter={e => { if (batch.priorityValue !== p) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (batch.priorityValue !== p) e.currentTarget.style.background = 'var(--bg-card)' }}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: PRIORITY_CONFIG[p]?.color || '#64748b',
                }} />
                {priorityLabel(p)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowRoomDropdown(!showRoomDropdown)}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 12,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <LayoutList size={14} />
          {t('worklistToolbar.batchAssignRoom')}
          <ChevronDown size={14} />
        </button>
        {showRoomDropdown && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 100,
            marginTop: 6,
            minWidth: 160,
            overflow: 'hidden',
          }}>
            {initialExamRooms.map(room => (
              <div
                key={room.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChange({ ...batch, roomValue: room.id })
                  setShowRoomDropdown(false)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ ...batch, roomValue: room.id }); setShowRoomDropdown(false) } }}
                style={{
                  padding: '10px 14px',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: batch.roomValue === room.id ? 'var(--color-primary-800)' : 'var(--text-primary)',
                  background: batch.roomValue === room.id ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onMouseEnter={e => { if (batch.roomValue !== room.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (batch.roomValue !== room.id) e.currentTarget.style.background = 'var(--bg-card)' }}
              >
                <span>{room.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{room.modality.join(',')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => onChange({ ...batch, operation: 'print' })}
        style={{
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          fontSize: 12,
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Barcode size={14} />
        {t('worklistToolbar.batchPrintBarcodes')}
      </button>

      <button
        onClick={() => onChange({ ...batch, operation: 'export' })}
        style={{
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          fontSize: 12,
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <FileSpreadsheet size={14} />
        {t('worklistToolbar.batchExportExcel')}
      </button>

      <button
        onClick={onExecute}
        style={{
          marginLeft: 'auto',
          padding: '6px 16px',
          background: '#4ade80',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-primary-800)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Check size={14} />
        {t('worklistToolbar.confirmExecute')}
      </button>

      <button
        onClick={onClear}
        style={{
          padding: '6px 12px',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          fontSize: 12,
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <XCircle size={14} />
        {t('worklistToolbar.clear')}
      </button>
    </div>
  )
}

// ============================================================
// QuickFilters
// ============================================================
interface QuickFilterProps {
  currentFilters: FilterState
  onApply: (filters: Partial<FilterState>) => void
}

export function QuickFilters({ currentFilters, onApply }: QuickFilterProps) {
  const quickViews = [
    { label: t('worklistToolbar.qvAll'), icon: <ListChecks size={14} />, filter: {} },
    { label: t('worklistToolbar.qvPending'), icon: <Clock size={14} />, filter: { statuses: ['SCHEDULED', 'ARRIVED'] } },
    { label: t('worklistToolbar.qvInProgress'), icon: <Activity size={14} />, filter: { statuses: ['IN_PROGRESS'] } },
    { label: t('worklistToolbar.qvCompleted'), icon: <FileText size={14} />, filter: { statuses: ['COMPLETED'] } },
    { label: t('worklistToolbar.qvEmergency'), icon: <AlertTriangle size={14} />, filter: { priorities: ['危重', '紧急'] } },
    { label: t('worklistToolbar.qvToday'), icon: <Calendar size={14} />, filter: { dateStart: new Date().toISOString().split('T')[0] ?? '', dateEnd: new Date().toISOString().split('T')[0] ?? '' } },
  ]

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {quickViews.map((qv, i) => {
        const isActive = i === 0
          ? currentFilters.statuses.length === 0 && currentFilters.priorities.length === 0
          : (qv.filter.statuses && JSON.stringify(qv.filter.statuses) === JSON.stringify(currentFilters.statuses)) ||
            (qv.filter.priorities && JSON.stringify(qv.filter.priorities) === JSON.stringify(currentFilters.priorities)) ||
            (qv.filter.dateStart && currentFilters.dateStart === qv.filter.dateStart)
        return (
          <button
            key={i}
            onClick={() => onApply(qv.filter)}
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', transition: 'all 0.15s',
              borderColor: isActive ? 'var(--color-primary-800)' : '#e2e8f0',
              background: isActive ? 'var(--color-primary-800)' : 'var(--bg-card)',
              color: isActive ? '#fff' : '#64748b',
            }}
          >
            {qv.icon}
            {qv.label}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// CheckInBar
// ============================================================
interface CheckInBarProps {
  onCheckIn: (barcode: string) => void
  onPrintLabel: () => void
  lastScanned: string | null
  isProcessing: boolean
}

export function CheckInBar({ onCheckIn, onPrintLabel, lastScanned, isProcessing }: CheckInBarProps) {
  const [input, setInput] = useState('')

  const handleSubmit = () => {
    if (input.trim()) {
      onCheckIn(input.trim())
      setInput('')
    }
  }

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '12px 16px',
      marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <Barcode size={18} color="var(--color-primary-800)" />
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
        placeholder={t('worklistToolbar.scanPlaceholder')}
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
          fontSize: 12, background: 'var(--bg-card)', fontFamily: 'monospace',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={isProcessing || !input.trim()}
        style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: isProcessing || !input.trim() ? '#cbd5e1' : 'var(--color-primary-800)',
          color: '#fff', fontSize: 12, fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {isProcessing ? <RefreshCw size={14} /> : <ArrowRight size={14} />}
        {isProcessing ? t('worklistToolbar.processing') : t('worklistToolbar.checkIn')}
      </button>
      <button
        onClick={onPrintLabel}
        style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Printer size={14} />
        {t('worklistToolbar.printLabel')}
      </button>
      {lastScanned && (
        <div style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
          <CheckCircle size={14} />
          {t('worklistToolbar.lastCheckIn')} {lastScanned}
        </div>
      )}
    </div>
  )
}

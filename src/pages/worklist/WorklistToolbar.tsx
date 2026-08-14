import { useState } from 'react'
import {
  Search, Filter, RefreshCw, Clock, AlertTriangle, CheckCircle,
  X, Calendar, Check, ChevronDown, ChevronUp, Zap, User, Stethoscope,
  Monitor, Activity, BookmarkCheck, Barcode, FileSpreadsheet, CheckSquare,
  XCircle, LayoutList, Printer, ArrowRight, ListChecks, FileText, Save,
} from 'lucide-react'
import { initialUsers, initialExamRooms } from '../../data/initialData'

// ============================================================
// 常量
// ============================================================
const PRIORITY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '普通': { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: '普通' },
  '紧急': { bg: '#f59e0b22', color: '#f59e0b', label: '紧急' },
  '危重': { bg: '#ef444422', color: '#ef4444', label: '危重' },
  '会诊': { bg: '#8b5cf622', color: '#7c3aed', label: '会诊' },
}

const MODALITY_LIST = ['CT', 'MR', 'DR', 'DSA', 'MG', 'GI']
const PATIENT_TYPE_LIST = ['门诊', '住院', '急诊', '体检']
const PRIORITY_LIST = ['普通', '紧急', '危重', '会诊']
// 状态筛选: 显示中文, 过滤用英文规范值 (EXAM_STATUS_MAP)
const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '已登记', value: 'SCHEDULED' },
  { label: '已报到', value: 'ARRIVED' },
  { label: '检查中', value: 'IN_PROGRESS' },
  // [v3.0.6.11-95 Wave 1A] 暂停/质控退回 状态筛选
  { label: '已暂停', value: 'PAUSED' },
  { label: '质控退回', value: 'QC_REJECT' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
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
        borderColor: active ? '#1e40af' : '#e2e8f0',
        background: active ? '#1e40af' : 'var(--bg-card)',
        color: active ? '#fff' : '#64748b',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {active && <Check size={14} />}
      {label}
    </button>
  )

  return (
    <div
      role="search"
      aria-label="搜索过滤器"
      style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      border: '1px solid var(--border-color)',
      marginBottom: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
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
            placeholder="搜索患者姓名 / 检查号 / 检查项目..."
            style={{
              border: 'none',
              outline: 'none',
              fontSize: 13,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>日期</span>
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
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>至</span>
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
            gap: 4,
          }}
        >
          <Filter size={14} />
          高级筛选
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
            gap: 4,
          }}
        >
          <RefreshCw size={14} />
          重置
        </button>
      </div>

      {expanded && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: '1px solid var(--border-light)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          paddingTop: 16,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Monitor size={14} />
              设备类型
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MODALITY_LIST.map(m => (
                <FilterChip key={m} label={m} active={filters.modalities.includes(m)} onClick={() => toggleArrayFilter('modalities', m)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <User size={14} />
              患者类型
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PATIENT_TYPE_LIST.map(p => (
                <FilterChip key={p} label={p} active={filters.patientTypes.includes(p)} onClick={() => toggleArrayFilter('patientTypes', p)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={14} />
              优先级
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRIORITY_LIST.map(p => (
                <FilterChip key={p} label={p} active={filters.priorities.includes(p)} onClick={() => toggleArrayFilter('priorities', p)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity size={14} />
              状态
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUS_OPTIONS.map(s => (
                <FilterChip key={s.value} label={s.label} active={filters.statuses.includes(s.value)} onClick={() => toggleArrayFilter('statuses', s.value)} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Stethoscope size={14} />
              检查医生
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
                  color: filters.doctorId ? '#1e40af' : '#94a3b8',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{filters.doctorId ? getDoctorById(filters.doctorId)?.name || filters.doctorId : '全部医生'}</span>
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
                  marginTop: 4,
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
                      color: !filters.doctorId ? '#1e40af' : '#64748b',
                      background: !filters.doctorId ? '#f0f7ff' : 'transparent',
                    }}
                    onMouseEnter={e => { if (filters.doctorId) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (filters.doctorId) e.currentTarget.style.background = 'transparent' }}
                  >
                    全部医生
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
                          color: filters.doctorId === doc.id ? '#1e40af' : '#64748b',
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
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <BookmarkCheck size={14} color="#1e40af" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>筛选预设</span>
          </div>
          {presets && presets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {presets.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={savePresetName || ''} onChange={e => onSavePresetNameChange?.(e.target.value)} placeholder="预设名称..." style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, outline: 'none' }} />
            <button onClick={onSavePreset} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#1e40af', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Save size={14} />保存当前</button>
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
      background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 4px 12px rgba(30,58,95,0.3)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
      }}>
        <CheckSquare size={16} style={{ color: '#4ade80' }} />
        已选中 <span style={{ fontSize: 18, fontWeight: 800 }}>{totalSelected}</span> 项
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
          批量修改优先级
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
                  color: batch.priorityValue === p ? '#1e40af' : 'var(--text-primary)',
                  background: batch.priorityValue === p ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
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
                {p}
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
          批量分配检查室
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
                  color: batch.roomValue === room.id ? '#1e40af' : 'var(--text-primary)',
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
        批量打印条码
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
        批量导出Excel
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
          color: '#1e40af',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Check size={14} />
        确认执行
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
        清除
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
    { label: '全部', icon: <ListChecks size={14} />, filter: {} },
    { label: '待检查', icon: <Clock size={14} />, filter: { statuses: ['SCHEDULED', 'ARRIVED'] } },
    { label: '检查中', icon: <Activity size={14} />, filter: { statuses: ['IN_PROGRESS'] } },
    { label: '已完成', icon: <FileText size={14} />, filter: { statuses: ['COMPLETED'] } },
    { label: '急诊优先', icon: <AlertTriangle size={14} />, filter: { priorities: ['危重', '紧急'] } },
    { label: '今日', icon: <Calendar size={14} />, filter: { dateStart: new Date().toISOString().split('T')[0] ?? '', dateEnd: new Date().toISOString().split('T')[0] ?? '' } },
  ]

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {quickViews.map((qv, i) => {
        const isActive = qv.label === '全部'
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
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
              borderColor: isActive ? '#1e40af' : '#e2e8f0',
              background: isActive ? '#1e40af' : 'var(--bg-card)',
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
      marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <Barcode size={18} color="#1e40af" />
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
        placeholder="扫描或输入检查条码 / 检查号..."
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
          fontSize: 13, outline: 'none', background: 'var(--bg-card)', fontFamily: 'monospace',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={isProcessing || !input.trim()}
        style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: isProcessing || !input.trim() ? '#cbd5e1' : '#1e40af',
          color: '#fff', fontSize: 12, fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {isProcessing ? <RefreshCw size={14} /> : <ArrowRight size={14} />}
        {isProcessing ? '处理中...' : '签到'}
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
        打印标签
      </button>
      {lastScanned && (
        <div style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle size={14} />
          上次签到: {lastScanned}
        </div>
      )}
    </div>
  )
}

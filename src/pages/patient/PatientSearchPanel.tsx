import { Search, Filter, ChevronDown, ChevronUp, RefreshCw, Bookmark, BookmarkCheck, X, Save } from 'lucide-react'
import type { AdvancedFilters, GenderFilter, PatientTypeFilter } from './types'

interface AdvancedFilterPanelProps {
  filters: AdvancedFilters
  onChange: (filters: AdvancedFilters) => void
  onReset: () => void
  presets?: Array<{ name: string; filters: AdvancedFilters }>
  onApplyPreset?: (preset: { name: string; filters: AdvancedFilters }) => void
  onSavePreset?: () => void
  onDeletePreset?: (index: number) => void
  showSavePreset?: boolean
  savePresetName?: string
  onSavePresetNameChange?: (name: string) => void
  onToggleSavePreset?: () => void
}

function AdvancedFilterPanel({ filters, onChange, onReset, presets, onApplyPreset, onSavePreset, onDeletePreset, showSavePreset, savePresetName, onSavePresetNameChange, onToggleSavePreset }: AdvancedFilterPanelProps) {
  const modalities = ['全部', 'CT', 'MR', 'DR', 'DSA', 'MG', 'GI']
  const diagnosisCategories = ['全部', '呼吸系统', '消化系统', '骨骼肌肉', '神经系统', '心血管', '肿瘤', '其他']

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 10,
      border: '1px solid var(--border-color)',
      padding: 16,
      marginBottom: 16,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>性别</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['全部', '男', '女'] as GenderFilter[]).map(g => (
              <button
                key={g}
                onClick={() => onChange({ ...filters, gender: g })}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid',
                  borderColor: filters.gender === g ? '#1e40af' : 'var(--border-color)',
                  background: filters.gender === g ? '#1e40af' : 'var(--bg-card)',
                  color: filters.gender === g ? '#fff' : '#64748b',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>年龄范围</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" value={filters.ageMin} onChange={e => onChange({ ...filters, ageMin: e.target.value })} placeholder="最小"
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, width: '100%' }} />
            <span style={{ color: '#64748b', fontSize: 12 }}>-</span>
            <input type="number" value={filters.ageMax} onChange={e => onChange({ ...filters, ageMax: e.target.value })} placeholder="最大"
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, width: '100%' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>患者类型</label>
          <select value={filters.patientType} onChange={e => onChange({ ...filters, patientType: e.target.value as PatientTypeFilter })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' }}>
            {(['全部', '门诊', '住院', '体检', '急诊'] as PatientTypeFilter[]).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>检查设备</label>
          <select value={filters.modality} onChange={e => onChange({ ...filters, modality: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' }}>
            {modalities.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>建档日期从</label>
          <input type="date" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12,}} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>建档日期至</label>
          <input type="date" value={filters.dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12,}} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>诊断分类</label>
          <select value={filters.diagnosisCategory || '全部'} onChange={e => onChange({ ...filters, diagnosisCategory: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' }}>
            {diagnosisCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button onClick={onReset}
            style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <RefreshCw size={12} />重置
          </button>
          <button onClick={onToggleSavePreset}
            style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: showSavePreset ? 'var(--color-info-bg)' : 'var(--bg-card)', color: showSavePreset ? '#1e40af' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Bookmark size={12} />预设
          </button>
          <button onClick={() => { const event = new CustomEvent('apply-patient-filter'); window.dispatchEvent(event) }}
            style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#1e40af', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Search size={12} />筛选
          </button>
        </div>
      </div>

      {showSavePreset && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <BookmarkCheck size={14} color="#1e40af" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>筛选预设</span>
          </div>
          {presets && presets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {presets.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <button onClick={() => onApplyPreset?.(p)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, padding: 0 }}>{p.name}</button>
                  <button onClick={() => onDeletePreset?.(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94a3b8' }}><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={savePresetName || ''} onChange={e => onSavePresetNameChange?.(e.target.value)} placeholder="预设名称..."
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12,}} />
            <button onClick={onSavePreset} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#1e40af', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Save size={12} />保存当前</button>
          </div>
        </div>
      )}
    </div>
  )
}

export interface PatientSearchPanelProps {
  search: string
  onSearchChange: (value: string) => void
  showAdvanced: boolean
  onToggleAdvanced: () => void
  advancedFilters: AdvancedFilters
  onAdvancedFiltersChange: (filters: AdvancedFilters) => void
  onResetAdvancedFilters: () => void
  filterPresets: Array<{ name: string; filters: AdvancedFilters }>
  onApplyPreset: (preset: { name: string; filters: AdvancedFilters }) => void
  onSavePreset: () => void
  onDeletePreset: (index: number) => void
  showSavePreset: boolean
  savePresetName: string
  onSavePresetNameChange: (name: string) => void
  onToggleSavePreset: () => void
}

export function PatientSearchPanel(props: PatientSearchPanelProps) {
  return (
    <>
      {props.showAdvanced && (
        <AdvancedFilterPanel
          filters={props.advancedFilters}
          onChange={props.onAdvancedFiltersChange}
          onReset={props.onResetAdvancedFilters}
          presets={props.filterPresets}
          onApplyPreset={props.onApplyPreset}
          onSavePreset={props.onSavePreset}
          onDeletePreset={props.onDeletePreset}
          showSavePreset={props.showSavePreset}
          savePresetName={props.savePresetName}
          onSavePresetNameChange={props.onSavePresetNameChange}
          onToggleSavePreset={props.onToggleSavePreset}
        />
      )}

      <div style={{
        background: 'var(--bg-card)', borderRadius: 10, padding: '12px 16px',
        border: '1px solid var(--border-color)', marginBottom: 16,
        display: 'flex', gap: 12, alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <Search size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
        <input
          value={props.search}
          onChange={e => props.onSearchChange(e.target.value)}
          placeholder="综合搜索：姓名 / 身份证 / 就诊卡号 / 电话 / 检查号..."
          style={{ border: 'none', fontSize: 12, width: 400, background: 'transparent' }}
        />
        <button
          onClick={props.onToggleAdvanced}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
            border: '1px solid', borderColor: props.showAdvanced ? '#1e40af' : 'var(--border-color)',
            background: props.showAdvanced ? 'var(--color-info-bg)' : 'var(--bg-card)',
            color: props.showAdvanced ? '#1e40af' : '#64748b',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto',
          }}
        >
          <Filter size={14} />
          高级筛选
          {props.showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </>
  )
}

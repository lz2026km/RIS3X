import { Search, Filter, ChevronDown, ChevronUp, RefreshCw, Bookmark, BookmarkCheck, X, Save } from 'lucide-react'
import { DatePicker } from 'antd'
import dayjs from 'dayjs'
import type { AdvancedFilters } from './types'
const { RangePicker } = DatePicker

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
  const diagnosisCategories = ['全部', '呼吸系统', '消化系统', '骨骼肌肉', '神经系统', '心血管', '肿瘤', '其他']

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 10,
      border: '1px solid var(--border-color)',
      padding: 'var(--space-4, 16px)',
      marginBottom: 'var(--space-4, 16px)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3, 12px)' }}>
        <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', marginBottom: 6, display: 'block' }}>建档日期</label>
        {/* [v3.0.6.16-2] 两个裸 date 输入合并为 RangePicker (支持快捷区间/locale 跟随) */}
        <RangePicker
          size="small"
          style={{ width: '100%' }}
          value={[
            filters.dateFrom ? dayjs(filters.dateFrom) : null,
            filters.dateTo ? dayjs(filters.dateTo) : null,
          ]}
          onChange={(v) =>
            onChange({
              ...filters,
              dateFrom: v?.[0] ? v[0].format('YYYY-MM-DD') : '',
              dateTo: v?.[1] ? v[1].format('YYYY-MM-DD') : '',
            })
          }
        />
      </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', marginBottom: 6, display: 'block' }}>诊断分类</label>
          <select value={filters.diagnosisCategory || '全部'} onChange={e => onChange({ ...filters, diagnosisCategory: e.target.value })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' }}>
            {diagnosisCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2, 8px)' }}>
          <button onClick={onReset}
            style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted, #64748b)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1, 4px)' }}>
            <RefreshCw size={12} />重置
          </button>
          <button onClick={onToggleSavePreset}
            style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: showSavePreset ? 'var(--color-info-bg)' : 'var(--bg-card)', color: showSavePreset ? 'var(--color-primary-800)' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1, 4px)' }}>
            <Bookmark size={12} />预设
          </button>
          <button onClick={() => { const event = new CustomEvent('apply-patient-filter'); window.dispatchEvent(event) }}
            style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--color-primary-800)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1, 4px)' }}>
            <Search size={12} />筛选
          </button>
        </div>
      </div>

      {showSavePreset && (
        <div style={{ marginTop: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px)', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)' }}>
            <BookmarkCheck size={14} color="var(--color-primary-800)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>筛选预设</span>
          </div>
          {presets && presets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-2, 8px)' }}>
              {presets.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', padding: '4px 10px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <button onClick={() => onApplyPreset?.(p)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, padding: 0 }}>{p.name}</button>
                  <button aria-label="删除" onClick={() => onDeletePreset?.(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted, #94a3b8)' }}><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
            <input value={savePresetName || ''} onChange={e => onSavePresetNameChange?.(e.target.value)} placeholder="预设名称..."
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12,}} />
            <button onClick={onSavePreset} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--color-primary-800)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><Save size={12} />保存当前</button>
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
        border: '1px solid var(--border-color)', marginBottom: 'var(--space-4, 16px)',
        display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <Search size={16} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
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
            border: '1px solid', borderColor: props.showAdvanced ? 'var(--color-primary-800)' : 'var(--border-color)',
            background: props.showAdvanced ? 'var(--color-info-bg)' : 'var(--bg-card)',
            color: props.showAdvanced ? 'var(--color-primary-800)' : '#64748b',
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

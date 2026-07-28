/**
 * G005 放射RIS系统 v3.0.1 - 窗宽窗位自定义面板
 * 对标 GE Centricity / Siemens syngo / 岱嘉 / 锐科
 * 功能:7 色彩预设 + 自定义滑杆 + 数字输入
 */
import React, { useState, useCallback, useMemo } from 'react'
import { Slider, InputNumber, Button, Space, Tag, Tooltip, Divider } from 'antd'
import { Sun, RotateCcw, Save } from 'lucide-react'

export interface WLPreset {
  id: string
  name: string
  ww: number
  wl: number
  color: string
  organ: string
}

export const WL_PRESETS: WLPreset[] = [
  { id: 'lung', name: '肺窗', ww: 1500, wl: -600, color: '#10b981', organ: 'CT 肺' },
  { id: 'mediastinum', name: '纵隔窗', ww: 400, wl: 40, color: '#ec4899', organ: 'CT 纵隔' },
  { id: 'bone', name: '骨窗', ww: 2000, wl: 500, color: '#f59e0b', organ: 'CT 骨' },
  { id: 'brain', name: '脑窗', ww: 80, wl: 40, color: '#3b82f6', organ: 'CT/MR 脑' },
  { id: 'softTissue', name: '软组织', ww: 400, wl: 40, color: '#8b5cf6', organ: 'CT 软组织' },
  { id: 'liver', name: '肝窗', ww: 150, wl: 30, color: '#f97316', organ: 'CT 肝' },
  { id: 'liverContrast', name: '肝脏增强窗', ww: 200, wl: 60, color: '#ea580c', organ: 'CT 肝增强' },
  { id: 'abdomen', name: '腹窗', ww: 400, wl: 40, color: '#06b6d4', organ: 'CT 腹' },
  { id: 'cardiac', name: '心脏窗', ww: 350, wl: 50, color: '#e11d48', organ: 'CT 心脏' },
  { id: 'mammography', name: '乳腺窗', ww: 400, wl: 300, color: '#db2777', organ: 'MG 乳腺' },
  { id: 'orbit', name: '眼眶窗', ww: 300, wl: 50, color: '#7c3aed', organ: 'CT 眼眶' },
  { id: 'vascular', name: '血管窗', ww: 600, wl: 200, color: '#dc2626', organ: 'CTA 血管' },
]

export interface WLCustomPanelProps {
  defaultPreset?: string
  value?: { ww: number; wl: number }
  onChange?: (value: { ww: number; wl: number }) => void
  onApply?: (value: { ww: number; wl: number }) => void
  onReset?: () => void
  readOnly?: boolean
}

export const WLCustomPanel: React.FC<WLCustomPanelProps> = ({
  defaultPreset = 'lung',
  value,
  onChange,
  onApply,
  onReset,
  readOnly = false,
}) => {
  const [internal, setInternal] = useState({ ww: WL_PRESETS[0]!.ww, wl: WL_PRESETS[0]!.wl })
  const current = value ?? internal
  const [activePreset, setActivePreset] = useState(defaultPreset)

  const update = useCallback(
    (next: { ww: number; wl: number }) => {
      if (!readOnly) {
        if (!value) setInternal(next)
        onChange?.(next)
      }
    },
    [value, onChange, readOnly]
  )

  const applyPreset = useCallback(
    (preset: WLPreset) => {
      setActivePreset(preset.id)
      update({ ww: preset.ww, wl: preset.wl })
      onApply?.({ ww: preset.ww, wl: preset.wl })
    },
    [update, onApply]
  )

  const reset = useCallback(() => {
    const p = WL_PRESETS.find((x) => x.id === activePreset) ?? WL_PRESETS[0]!
    setActivePreset(p.id)
    update({ ww: p.ww, wl: p.wl })
    onReset?.()
  }, [activePreset, update, onReset])

  const presetTags = useMemo(
    () =>
      WL_PRESETS.map((p) => (
        <Tooltip key={p.id} title={`${p.organ} · WW=${p.ww} WL=${p.wl}`}>
          <Tag.CheckableTag
            checked={activePreset === p.id}
            onChange={(checked) => checked && applyPreset(p)}
            style={{
              background: activePreset === p.id ? p.color : 'transparent',
              color: activePreset === p.id ? '#fff' : p.color,
              borderColor: p.color,
              fontWeight: 600,
              padding: '2px 8px',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}
          >
            {p.name}
          </Tag.CheckableTag>
        </Tooltip>
      )),
    [activePreset, applyPreset, readOnly]
  )

  return (
    <div
      data-testid="wl-custom-panel"
      style={{
        background: '#1e293b',
        color: '#e2e8f0',
        padding: 12,
        borderRadius: 8,
        border: '1px solid #334155',
        minWidth: 320,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sun size={14} color="#fbbf24" />
        <span style={{ fontSize: 12, fontWeight: 700 }}>窗宽窗位自定义</span>
      </div>

      <Space size={4} wrap style={{ marginBottom: 10 }}>
        {presetTags}
      </Space>

      <Divider style={{ margin: '8px 0', borderColor: '#334155' }} />

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
          <span style={{ opacity: 0.65 }}>窗宽 (WW)</span>
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>{current.ww}</span>
        </div>
        <Slider
          min={1}
          max={4000}
          step={1}
          value={current.ww}
          onChange={(ww) => update({ ww: Number(ww), wl: current.wl })}
          disabled={readOnly}
          tooltip={{ formatter: (v) => `WW ${v}` }}
          data-testid="wl-slider-ww"
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
          <span style={{ opacity: 0.65 }}>窗位 (WL)</span>
          <span style={{ color: '#ec4899', fontWeight: 600 }}>{current.wl}</span>
        </div>
        <Slider
          min={-1000}
          max={1000}
          step={1}
          value={current.wl}
          onChange={(wl) => update({ ww: current.ww, wl: Number(wl) })}
          disabled={readOnly}
          tooltip={{ formatter: (v) => `WL ${v}` }}
          data-testid="wl-slider-wl"
        />
      </div>

      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <InputNumber
          addonBefore="WW"
          value={current.ww}
          onChange={(v) => v != null && update({ ww: v, wl: current.wl })}
          disabled={readOnly}
          style={{ width: '50%' }}
          data-testid="wl-input-ww"
        />
        <InputNumber
          addonBefore="WL"
          value={current.wl}
          onChange={(v) => v != null && update({ ww: current.ww, wl: v })}
          disabled={readOnly}
          style={{ width: '50%' }}
          data-testid="wl-input-wl"
        />
      </Space.Compact>

      <Space>
        <Button
          size="small"
          icon={<Save size={12} />}
          onClick={() => onApply?.(current)}
          disabled={readOnly}
          data-testid="wl-apply"
        >
          应用
        </Button>
        <Button size="small" icon={<RotateCcw size={12} />} onClick={reset} disabled={readOnly}>
          复位
        </Button>
      </Space>
    </div>
  )
}

export default WLCustomPanel

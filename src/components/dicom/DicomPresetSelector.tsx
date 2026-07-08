interface WindowPreset {
  name: string
  ww: number
  wl: number
}

interface DicomPresetSelectorProps {
  presets: WindowPreset[]
  activePresetIdx: number | null
  onSelect: (preset: WindowPreset, idx: number) => void
  modality: string
}

const PRIMARY = '#1e3a5f'

function getPresetsByModality(modality: string): WindowPreset[] {
  if (modality === 'CT') {
    return [
      { name: '肺窗', ww: 1500, wl: -600 },
      { name: '纵隔窗', ww: 400, wl: 40 },
      { name: '骨窗', ww: 2000, wl: 400 },
    ]
  }
  if (modality === 'MR') {
    return [
      { name: 'T1', ww: 400, wl: 40 },
      { name: 'T2', ww: 800, wl: 200 },
      { name: 'FLAIR', ww: 1000, wl: 400 },
    ]
  }
  return [
    { name: '骨窗', ww: 2000, wl: 400 },
    { name: '软组织', ww: 400, wl: 40 },
  ]
}

export default function DicomPresetSelector({
  presets: _presets, activePresetIdx, onSelect, modality,
}: DicomPresetSelectorProps) {
  const presets = _presets.length > 0 ? _presets : getPresetsByModality(modality)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>窗值</span>
      {presets.map((p, i) => (
        <button
          key={p.name}
          style={{
            padding: '4px 10px', borderRadius: 20,
            border: `1px solid ${activePresetIdx === i + 100 ? PRIMARY : '#cbd5e1'}`,
            background: activePresetIdx === i + 100 ? PRIMARY : '#fff',
            color: activePresetIdx === i + 100 ? '#fff' : '#475569',
            fontSize: 12, fontWeight: activePresetIdx === i + 100 ? 600 : 500,
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onClick={() => onSelect(p, i + 100)}
          title={`WW:${p.ww} WL:${p.wl}`}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}

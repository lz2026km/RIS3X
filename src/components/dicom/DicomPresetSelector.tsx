import { useEffect, useState, useCallback } from 'react';
import { WINDOW_PRESETS_LIST, WINDOW_PRESETS_DETAILED } from '../../services/dicomWeb';

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
  const list = WINDOW_PRESETS_LIST.filter(p => p.modality.includes(modality));
  if (list.length > 0) {
    return list.map(p => ({ name: p.description, ww: p.ww, wl: p.wc }));
  }
  if (modality === 'CT') {
    return [
      { name: '肺窗', ww: 1500, wl: -600 },
      { name: '纵隔窗', ww: 400, wl: 40 },
      { name: '骨窗', ww: 2000, wl: 400 },
    ]
  }
  if (modality === 'MR') {
    const t1 = WINDOW_PRESETS_DETAILED.MR_T1;
    const t2 = WINDOW_PRESETS_DETAILED.MR_T2;
    const flair = WINDOW_PRESETS_DETAILED.MR_FLAIR;
    return [
      { name: 'T1', ww: t1.ww, wl: t1.wc },
      { name: 'T2', ww: t2.ww, wl: t2.wc },
      { name: 'FLAIR', ww: flair.ww, wl: flair.wc },
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
  const [focusedIdx, setFocusedIdx] = useState<number>(0)

  useEffect(() => {
    setFocusedIdx(0)
  }, [modality])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % presets.length;
      setFocusedIdx(next);
      const el = document.querySelector<HTMLButtonElement>(`[data-preset-idx="${next}"]`);
      el?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + presets.length) % presets.length;
      setFocusedIdx(prev);
      const el = document.querySelector<HTMLButtonElement>(`[data-preset-idx="${prev}"]`);
      el?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(presets[idx]!, idx);
    }
  }, [presets, onSelect]);

  return (
    <div role="toolbar" aria-label="DICOM 窗位预设" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>窗值</span>
      {presets.map((p, i) => (
        <button
          key={p.name}
          data-preset-idx={i}
          data-testid={`dicom-preset-${i}`}
          aria-pressed={activePresetIdx === i}
          style={{
            padding: '4px 10px', borderRadius: 20,
            border: `1px solid ${activePresetIdx === i ? PRIMARY : '#cbd5e1'}`,
            background: activePresetIdx === i ? PRIMARY : '#fff',
            color: activePresetIdx === i ? '#fff' : '#475569',
            fontSize: 12, fontWeight: activePresetIdx === i ? 600 : 500,
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            outline: focusedIdx === i ? '2px solid #3b82f6' : 'none',
            outlineOffset: 2,
          }}
          onClick={() => onSelect(p, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onFocus={() => setFocusedIdx(i)}
          title={`WW:${p.ww} WL:${p.wl}`}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}

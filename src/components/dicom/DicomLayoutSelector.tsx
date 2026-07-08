import { Grid3x3 } from 'lucide-react'

type LayoutMode = '1x1' | '2x2' | '1x2' | '2x1'

interface DicomLayoutSelectorProps {
  value: LayoutMode
  onChange: (layout: LayoutMode) => void
}

const LAYOUTS: LayoutMode[] = ['1x1', '2x2', '1x2', '2x1']

const PRIMARY = '#1e3a5f'

export default function DicomLayoutSelector({ value, onChange }: DicomLayoutSelectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRight: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>布局</span>
      {LAYOUTS.map(l => (
        <button
          key={l}
          style={{
            width: 32, height: 32, borderRadius: 6,
            border: `1px solid ${value === l ? PRIMARY : '#cbd5e1'}`,
            background: value === l ? PRIMARY : '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 4, transition: 'all 0.15s',
          }}
          onClick={() => onChange(l)}
          title={l}
        >
          <Grid3x3 size={14} color={value === l ? '#fff' : '#64748b'} />
        </button>
      ))}
    </div>
  )
}

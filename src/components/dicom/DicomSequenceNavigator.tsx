import { Layers, ChevronLeft, ChevronRight } from 'lucide-react'

interface Series {
  id: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  imageCount: number
  thumbnail: string
}

interface DicomSequenceNavigatorProps {
  seriesList: Series[]
  activeSeriesIdx: number
  onSeriesSelect: (idx: number) => void
  modality: string
  bodyPart: string
  imageIndex: number
  totalImages: number
  onPrevImage: () => void
  onNextImage: () => void
}

const PRIMARY = '#1e3a5f'

const s = {
  strip: {
    height: 100, background: '#0d1117', borderTop: '1px solid #1e2533',
    display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
    overflowX: 'auto' as const, flexShrink: 0,
  },
  thumb: {
    width: 72, height: 72, borderRadius: 6, border: '2px solid #333',
    cursor: 'pointer', display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0,
    transition: 'all 0.2s', position: 'relative' as const, overflow: 'hidden',
  },
  thumbActive: { border: '2px solid #1e3a5f', boxShadow: '0 0 12px #1e3a5f' },
  thumbInner: {
    width: 48, height: 48, borderRadius: 4, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
    color: '#fff', fontWeight: 700,
  },
  layoutBtn: {
    width: 32, height: 32, borderRadius: 6, border: '1px solid #cbd5e1',
    background: '#fff', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 4,
    transition: 'all 0.15s',
  },
}

export default function DicomSequenceNavigator({
  seriesList, activeSeriesIdx, onSeriesSelect,
  modality, bodyPart, imageIndex, totalImages,
  onPrevImage, onNextImage,
}: DicomSequenceNavigatorProps) {
  return (
    <div style={s.strip}>
      {seriesList.map((sItem, idx) => (
        <div
          key={sItem.id}
          style={{
            ...s.thumb,
            ...(activeSeriesIdx === idx ? s.thumbActive : {}),
          }}
          onClick={() => onSeriesSelect(idx)}
          title={`${sItem.seriesDescription} (${sItem.imageCount}幅)`}
        >
          <div style={{
            ...s.thumbInner,
            background: sItem.thumbnail,
            opacity: activeSeriesIdx === idx ? 1 : 0.7,
          }}>
            <Layers size={16} />
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {sItem.seriesNumber}
          </span>
          <span style={{ fontSize: 8, color: '#6b7280' }}>
            {sItem.imageCount}幅
          </span>
        </div>
      ))}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {modality} · {bodyPart} · {imageIndex + 1}/{totalImages}
        </span>
        <button
          style={{ ...s.layoutBtn, background: PRIMARY, borderColor: PRIMARY }}
          onClick={onPrevImage}
          title="上一幅"
        >
          <ChevronLeft size={14} color="#fff" />
        </button>
        <button
          style={{ ...s.layoutBtn, background: PRIMARY, borderColor: PRIMARY }}
          onClick={onNextImage}
          title="下一幅"
        >
          <ChevronRight size={14} color="#fff" />
        </button>
      </div>
    </div>
  )
}

import { Ruler, Triangle, Circle as CircleIcon, Square, Circle, Activity, Trash2, EyeIcon, EyeOff, FileText, Bone, ScanLine } from 'lucide-react'
const RectIcon = Square
import type { Dispatch, SetStateAction } from 'react'
import type { MeasureSubMenu, Measurement, RightTab, Tool } from './DicomViewerTypes'

const PRIMARY = '#1e40af'

interface Props {
  rightTab: RightTab
  measureSubMenu: MeasureSubMenu
  setMeasureSubMenu: (m: MeasureSubMenu) => void
  setActiveTool: Dispatch<SetStateAction<Tool>>
  interactiveMeasures: Measurement[]
  showMeasurementsOverlay: boolean
  setShowMeasurementsOverlay: (v: boolean) => void
  deleteMeasure: (id: string) => void
  clearAllMeasures: () => void
  getMeasureTypeLabel: (type: string) => string
  measurements: { length: any[]; angle: any[]; ct: any[]; area: any[]; lines?: any[]; angles?: any[]; ellipses?: any[]; rectangles?: any[]; circles?: any[] }
  showToast: (msg: string) => void
}

const s = {
  infoSection: { marginBottom: 12 } as React.CSSProperties,
  infoSectionTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties,
  measureItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--border-color)' } as React.CSSProperties,
  measureItemColor: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 } as React.CSSProperties,
  measureItemInfo: { flex: 1, minWidth: 0 } as React.CSSProperties,
  measureItemValue: { fontSize: 13, fontWeight: 700, color: '#1e293b' } as React.CSSProperties,
  measureItemType: { fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' as const } as React.CSSProperties,
  measureListItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' } as React.CSSProperties,
  measureListItemLeft: { display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  measureListItemDot: { width: 8, height: 8, borderRadius: '50%' } as React.CSSProperties,
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' } as React.CSSProperties,
}

export default function MeasurementPanel(props: Props) {
  const { rightTab, measureSubMenu, setMeasureSubMenu, setActiveTool, interactiveMeasures, showMeasurementsOverlay, setShowMeasurementsOverlay, deleteMeasure, clearAllMeasures, getMeasureTypeLabel, measurements, showToast } = props

  if (rightTab !== 'measure') return null

  return (
    <>
      <div style={s.infoSection}>
        <div style={s.infoSectionTitle}>ROI测量工具</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['length', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue', 'cobb', 'polygon'] as MeasureSubMenu[]).map(type => (
            <button key={type} style={{
              flex: 1, minWidth: 60, padding: '6px 4px', borderRadius: 6, border: `1px solid ${measureSubMenu === type ? PRIMARY : '#e2e8f0'}`,
              background: measureSubMenu === type ? PRIMARY : '#fff', color: measureSubMenu === type ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2
            }} onClick={() => { setMeasureSubMenu(type); setActiveTool('measure') }}>
              {type === 'length' && <Ruler size={14} />}{type === 'angle' && <Triangle size={14} />}{type === 'ellipse' && <CircleIcon size={14} />}{type === 'rectangle' && <RectIcon size={14} />}{type === 'circle' && <Circle size={14} />}{type === 'ctvalue' && <Activity size={14} />}{type === 'cobb' && <Bone size={14} />}{type === 'polygon' && <ScanLine size={14} />}
              {type === 'length' ? '长度' : type === 'angle' ? '角度' : type === 'ellipse' ? '椭圆' : type === 'rectangle' ? '矩形' : type === 'circle' ? '圆形' : type === 'ctvalue' ? 'CT值' : type === 'cobb' ? 'Cobb角' : '多边形'}
            </button>
          ))}
        </div>
      </div>

      <div style={s.infoSection}>
        <div style={{ ...s.infoSectionTitle, justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>测量结果 ({interactiveMeasures.length})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: showMeasurementsOverlay ? PRIMARY : '#e2e8f0', color: showMeasurementsOverlay ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', gap: 3 }} onClick={() => setShowMeasurementsOverlay(!showMeasurementsOverlay)}>
              {showMeasurementsOverlay ? <EyeIcon size={10} /> : <EyeOff size={10} />}{showMeasurementsOverlay ? '显示' : '隐藏'}
            </button>
          </div>
        </div>
        {interactiveMeasures.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
            <Ruler size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>暂无测量数据</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>选择ROI工具后点击图像开始测量</div>
          </div>
        ) : (
          interactiveMeasures.map(measure => (
            <div key={measure.id} style={s.measureItem}>
              <div style={{ ...s.measureItemColor, background: (measure as any).color || '#22c55e' }} />
              <div style={s.measureItemInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={s.measureItemValue}>{measure.label || `${measure.value} ${measure.unit}`}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', whiteSpace: 'nowrap' }}>{getMeasureTypeLabel(measure.type)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{measure.value} {measure.unit}</span>
                  {measure.location && <span style={{ fontSize: 11, color: '#94a3b8' }}>· {measure.location}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => deleteMeasure(measure.id)}><Trash2 size={12} color="#ef4444" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={s.infoSection}>
        <div style={s.infoSectionTitle}>历史测量数据</div>
        <div style={s.infoSection}>
          <div style={s.infoSectionTitle}>长度测量</div>
          {measurements.length.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>暂无长度测量数据</div>
          ) : (
            measurements.length.map((m: any) => (
              <div key={m.id} style={s.measureListItem}>
                <div style={s.measureListItemLeft}>
                  <div style={{ ...s.measureListItemDot, background: '#22c55e' }} />
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{m.value} {m.unit}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{m.location}</div></div>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={s.infoSection}>
          <div style={s.infoSectionTitle}>CT值(HU)</div>
          {measurements.ct.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>暂无CT值测量数据</div>
          ) : (
            measurements.ct.map((m: any) => (
              <div key={m.id} style={s.measureListItem}>
                <div style={s.measureListItemLeft}>
                  <div style={{ ...s.measureListItemDot, background: '#3b82f6' }} />
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{m.value} {m.unit}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{m.location}</div></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button style={{ ...s.reportBtn, background: '#f0f4f8', color: '#475569', flex: 1 }} onClick={clearAllMeasures}><Trash2 size={14} />清除全部</button>
        <button style={{ ...s.reportBtn, background: '#22c55e', color: '#fff', flex: 1 }} onClick={() => {
          const allMeasures = [...interactiveMeasures]
          const reportText = allMeasures.length > 0 ? allMeasures.map(m => `${m.label}: ${m.value}${m.unit}`).join('\n') : '暂无测量数据'
          navigator.clipboard.writeText(reportText); showToast('测量报告已复制到剪贴板')
        }}><FileText size={14} />导出报告</button>
      </div>
    </>
  )
}

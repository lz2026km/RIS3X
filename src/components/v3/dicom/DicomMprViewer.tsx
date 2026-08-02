/**
 * G005 放射RIS系统 v3.0.2.2 - DICOM MPR 多平面重建
 * 对标:OsiriX/Horos MPR 视图
 * 三平面(轴位/矢状/冠状)同步查看
 */
import React, { useState, useCallback } from 'react'
import { Card, Tag, Space, Button, Slider, Statistic, Row, Col, Tooltip, Empty, Badge } from 'antd'
import { Grid3x3, Cross, Maximize2, RefreshCw } from 'lucide-react'

export type MprPlane = 'AXIAL' | 'SAGITTAL' | 'CORONAL'

export interface MprSlice {
  plane: MprPlane
  index: number
  total: number
  windowCenter: number
  windowWidth: number
  zoom: number
}

export interface DicomMprViewerProps {
  studyUid: string
  /** 三平面总切片数 */
  totalAxial: number
  totalSagittal: number
  totalCoronal: number
  /** 初始窗位/窗宽 */
  initialWindowCenter?: number
  initialWindowWidth?: number
  /** 切片变更回调 */
  onSliceChange?: (plane: MprPlane, index: number) => void
  /** 窗位/窗宽变更 */
  onWindowChange?: (wc: number, ww: number) => void
}

const PLANE_META: Record<MprPlane, { color: string; label: string; abbr: string }> = {
  AXIAL: { color: 'blue', label: '轴位', abbr: 'A' },
  SAGITTAL: { color: 'green', label: '矢状', abbr: 'S' },
  CORONAL: { color: 'purple', label: '冠状', abbr: 'C' },
}

const MprPlaneView: React.FC<{
  plane: MprPlane
  total: number
  index: number
  onIndexChange: (i: number) => void
  windowCenter: number
  windowWidth: number
  zoom: number
}> = ({ plane, total, index, onIndexChange, windowCenter, windowWidth, zoom }) => {
  const m = PLANE_META[plane]
  return (
    <div
      data-testid={`mpr-${plane}`}
      style={{
        border: `2px solid ${m.color === 'blue' ? '#3b82f6' : m.color === 'green' ? '#16a34a' : '#7c3aed'}`,
        borderRadius: 4,
        padding: 8,
        background: '#0f172a',
        minHeight: 220,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Badge.Ribbon text={m.abbr} color={m.color}>
        <div
          style={{
            width: '100%',
            height: 200,
            background: `radial-gradient(circle, hsl(0,0%,${Math.min(80, 40 + windowWidth / 10)}%), #000)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: 12,
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <Grid3x3 size={32} color="#475569" />
            <div style={{ marginTop: 4 }}>{m.label} 第 {index + 1} / {total} 层</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>WC: {windowCenter} WW: {windowWidth}</div>
          </div>
        </div>
      </Badge.Ribbon>
      <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4 }}>
        <Slider
          min={0}
          max={total - 1}
          value={index}
          onChange={onIndexChange}
          tooltip={{ formatter: (v) => `第 ${(v ?? 0) + 1} 层` }}
          data-testid={`mpr-slider-${plane}`}
        />
      </div>
    </div>
  )
}

export const DicomMprViewer: React.FC<DicomMprViewerProps> = ({
  studyUid,
  totalAxial = 100,
  totalSagittal = 100,
  totalCoronal = 100,
  initialWindowCenter = 40,
  initialWindowWidth = 400,
  onSliceChange,
  onWindowChange,
}) => {
  const [axialIdx, setAxialIdx] = useState(Math.floor(totalAxial / 2))
  const [sagittalIdx, setSagittalIdx] = useState(Math.floor(totalSagittal / 2))
  const [coronalIdx, setCoronalIdx] = useState(Math.floor(totalCoronal / 2))
  const [wc, setWc] = useState(initialWindowCenter)
  const [ww, setWw] = useState(initialWindowWidth)
  const [zoom, setZoom] = useState(1)
  const [crosshair, setCrosshair] = useState(true)

  const handleSlice = useCallback(
    (plane: MprPlane, i: number) => {
      if (plane === 'AXIAL') setAxialIdx(i)
      else if (plane === 'SAGITTAL') setSagittalIdx(i)
      else setCoronalIdx(i)
      onSliceChange?.(plane, i)
    },
    [onSliceChange]
  )

  const handleWindow = useCallback(
    (newWc: number, newWw: number) => {
      setWc(newWc)
      setWw(newWw)
      onWindowChange?.(newWc, newWw)
    },
    [onWindowChange]
  )

  const reset = useCallback(() => {
    setAxialIdx(Math.floor(totalAxial / 2))
    setSagittalIdx(Math.floor(totalSagittal / 2))
    setCoronalIdx(Math.floor(totalCoronal / 2))
    setWc(initialWindowCenter)
    setWw(initialWindowWidth)
    setZoom(1)
  }, [totalAxial, totalSagittal, totalCoronal, initialWindowCenter, initialWindowWidth])

  return (
    <Card
      data-testid="dicom-mpr-viewer"
      size="small"
      title={
        <Space>
          <Grid3x3 size={16} color="#1e3a5f" />
          <span>MPR 多平面重建</span>
          <Tag>Study:{studyUid.slice(-8)}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="同步三平面定位线">
            <Button
              size="small"
              icon={<Cross size={12} />}
              type={crosshair ? 'primary' : 'default'}
              onClick={() => setCrosshair((c) => !c)}
              data-testid="mpr-crosshair"
            >
              定位线
            </Button>
          </Tooltip>
          <Tooltip title="重置">
            <Button size="small" icon={<RefreshCw size={12} />} onClick={reset} data-testid="mpr-reset">
              重置
            </Button>
          </Tooltip>
        </Space>
      }
    >
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic
            title="窗位 WC"
            value={wc}
            styles={{ content: {  fontSize: 14  } }}
            prefix={<Maximize2 size={12} />}
          />
        </Col>
        <Col span={6}>
          <Statistic title="窗宽 WW" value={ww} styles={{ content: {  fontSize: 14  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="缩放" value={zoom.toFixed(1)} suffix="x" styles={{ content: {  fontSize: 14  } }} />
        </Col>
        <Col span={6}>
          <Statistic
            title="三平面"
            valueRender={() => <Tag color="blue">A / S / C</Tag>}
          />
        </Col>
      </Row>

      <Row gutter={8} style={{ marginBottom: 12 }} data-testid="mpr-controls">
        <Col span={12}>
          <div style={{ fontSize: 12, marginBottom: 2 }}>窗位</div>
          <Slider min={-1000} max={1000} value={wc} onChange={(v) => handleWindow(v ?? 0, ww)} />
        </Col>
        <Col span={12}>
          <div style={{ fontSize: 12, marginBottom: 2 }}>窗宽</div>
          <Slider min={1} max={2000} value={ww} onChange={(v) => handleWindow(wc, v ?? 1)} />
        </Col>
        <Col span={24}>
          <div style={{ fontSize: 12, marginBottom: 2 }}>缩放</div>
          <Slider min={0.5} max={3} step={0.1} value={zoom} onChange={setZoom} />
        </Col>
      </Row>

      {totalAxial + totalSagittal + totalCoronal === 0 ? (
        <Empty description="无切片" />
      ) : (
        <Row gutter={8}>
          <Col span={8}>
            <MprPlaneView plane="AXIAL" total={totalAxial} index={axialIdx} onIndexChange={(i) => handleSlice('AXIAL', i)} windowCenter={wc} windowWidth={ww} zoom={zoom} />
          </Col>
          <Col span={8}>
            <MprPlaneView plane="SAGITTAL" total={totalSagittal} index={sagittalIdx} onIndexChange={(i) => handleSlice('SAGITTAL', i)} windowCenter={wc} windowWidth={ww} zoom={zoom} />
          </Col>
          <Col span={8}>
            <MprPlaneView plane="CORONAL" total={totalCoronal} index={coronalIdx} onIndexChange={(i) => handleSlice('CORONAL', i)} windowCenter={wc} windowWidth={ww} zoom={zoom} />
          </Col>
        </Row>
      )}
    </Card>
  )
}

export default DicomMprViewer

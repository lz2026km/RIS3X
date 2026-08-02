/**
 * G005 放射RIS系统 v3.0.6.1 - 三维控制 (旋转/缩放/平移/裁剪)
 */
import React from 'react'
import { Space, Button, Slider, Row, Col } from 'antd'
import { RotateCw, ZoomIn, Move, Crop, Sun } from 'lucide-react'

export interface ThreeDControlsProps {
  rotation: number
  onRotate: (v: number) => void
  onZoom?: (v: number) => void
  onCrop?: () => void
}

export const ThreeDControls: React.FC<ThreeDControlsProps> = ({ rotation, onRotate, onZoom, onCrop }) => {
  const [zoom, setZoom] = React.useState(100)
  return (
    <div data-testid="threed-controls">
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Row gutter={6}>
          <Col span={12}>
            <Button block size="small" icon={<RotateCw size={12} />}>旋转</Button>
          </Col>
          <Col span={12}>
            <Button block size="small" icon={<ZoomIn size={12} />} onClick={() => onZoom?.(zoom)}>缩放</Button>
          </Col>
          <Col span={12}>
            <Button block size="small" icon={<Move size={12} />}>平移</Button>
          </Col>
          <Col span={12}>
            <Button block size="small" icon={<Crop size={12} />} onClick={onCrop}>裁剪</Button>
          </Col>
        </Row>
        <div>
          <span style={{ fontSize: 12 }}>旋转:{rotation}°</span>
          <Slider min={0} max={360} value={rotation} onChange={onRotate} />
        </div>
        <div>
          <span style={{ fontSize: 12 }}>缩放:{zoom}%</span>
          <Slider min={20} max={400} value={zoom} onChange={(v) => { setZoom(v); onZoom?.(v) }} />
        </div>
        <Space>
          <Sun size={12} />
          <span style={{ fontSize: 12 }}>预设视角</span>
        </Space>
        <Row gutter={4}>
          {['前', '后', '左', '右', '上', '下'].map((d) => (
            <Col span={8} key={d}>
              <Button block size="small">{d}</Button>
            </Col>
          ))}
        </Row>
      </Space>
    </div>
  )
}

export default ThreeDControls
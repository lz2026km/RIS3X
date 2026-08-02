/**
 * G005 放射RIS系统 v3.0.6.1 - 标注工具 (箭头/矩形/椭圆/文字/自由笔)
 */
import React, { useState } from 'react'
import { Card, Space, Button, Radio, Tag, Slider, Switch } from 'antd'
import { ArrowRight, Square, Circle, Type, Pencil, Trash2 } from 'lucide-react'

export type AnnotationToolType = 'arrow' | 'rect' | 'ellipse' | 'text' | 'pen' | 'measure'

export interface AnnotationItem {
  id: string
  type: AnnotationToolType
  x: number
  y: number
  w?: number
  h?: number
  text?: string
  color: string
}

export interface AnnotationToolProps {
  imageSrc?: string
  onAdd?: (a: AnnotationItem) => void
}

const COLORS = ['#dc2626', '#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6']

export const AnnotationTool: React.FC<AnnotationToolProps> = ({ onAdd }) => {
  const [tool, setTool] = useState<AnnotationToolType>('arrow')
  const [color, setColor] = useState<string>(COLORS[0]!)
  const [thickness, setThickness] = useState(2)
  const [showLabels, setShowLabels] = useState(true)
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([
    { id: 'a1', type: 'arrow', x: 30, y: 30, w: 80, h: 50, text: '病灶', color: '#dc2626' },
    { id: 'a2', type: 'rect', x: 120, y: 80, w: 60, h: 40, color: '#3b82f6' },
  ])

  const addSample = () => {
    const a: AnnotationItem = {
      id: `a${Date.now()}`,
      type: tool,
      x: Math.random() * 200 + 20,
      y: Math.random() * 100 + 20,
      w: 60,
      h: 40,
      text: tool === 'text' ? '标注' : undefined,
      color,
    }
    setAnnotations([...annotations, a])
    onAdd?.(a)
  }

  return (
    <Card size="small" title="标注工具" data-testid="annotation-tool">
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Space wrap>
          <Radio.Group value={tool} onChange={(e) => setTool(e.target.value)} size="small">
            <Radio.Button value="arrow"><ArrowRight size={12} /></Radio.Button>
            <Radio.Button value="rect"><Square size={12} /></Radio.Button>
            <Radio.Button value="ellipse"><Circle size={12} /></Radio.Button>
            <Radio.Button value="text"><Type size={12} /></Radio.Button>
            <Radio.Button value="pen"><Pencil size={12} /></Radio.Button>
            <Radio.Button value="measure">测量</Radio.Button>
          </Radio.Group>
        </Space>
        <Space wrap>
          <span style={{ fontSize: 12 }}>颜色:</span>
          {COLORS.map((c) => (
            <Tag
              key={c}
              color={c === color ? c : undefined}
              style={{
                cursor: 'pointer',
                background: c,
                color: '#fff',
                border: c === color ? '2px solid #0f172a' : 'none',
              }}
              onClick={() => setColor(c)}
            >
              {c}
            </Tag>
          ))}
        </Space>
        <Space>
          <span style={{ fontSize: 12 }}>线宽:{thickness}</span>
          <Slider min={1} max={6} value={thickness} onChange={setThickness} style={{ width: 120 }} />
        </Space>
        <Space>
          <Switch size="small" checked={showLabels} onChange={setShowLabels} />
          <span style={{ fontSize: 12 }}>显示标签</span>
        </Space>
        <Space>
          <Button type="primary" size="small" onClick={addSample}>添加</Button>
          <Button size="small" icon={<Trash2 size={12} />} onClick={() => setAnnotations([])}>清空</Button>
          <Tag>已添加 {annotations.length}</Tag>
        </Space>
        <div
          data-testid="annotation-canvas"
          style={{
            position: 'relative',
            height: 220,
            background: '#0f172a',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {annotations.map((a) => (
            <div
              key={a.id}
              style={{
                position: 'absolute',
                left: a.x,
                top: a.y,
                width: a.w ?? 60,
                height: a.h ?? 30,
                border: a.type === 'rect' ? `2px solid ${a.color}` : 'none',
                borderRadius: a.type === 'ellipse' ? '50%' : 0,
                color: a.color,
                fontSize: 12,
              }}
            >
              {a.type === 'arrow' && (
                <div style={{ width: 60, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  → {showLabels && a.text}
                </div>
              )}
              {a.type === 'text' && <span>{a.text}</span>}
            </div>
          ))}
        </div>
      </Space>
    </Card>
  )
}

export default AnnotationTool
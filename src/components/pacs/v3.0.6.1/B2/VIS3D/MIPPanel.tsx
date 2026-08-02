/**
 * G005 放射RIS系统 v3.0.6.1 - MIP 最大密度投影
 */
import React from 'react'
import { Tag, Space, Slider } from 'antd'

export interface MIPPanelProps {
  thickness?: number
}

export const MIPPanel: React.FC<MIPPanelProps> = () => {
  const [thickness, setThickness] = React.useState(10)
  return (
    <div data-testid="mip-panel">
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <Space>
          <Tag color="blue">Slab 厚度: {thickness} mm</Tag>
        </Space>
        <Slider min={1} max={50} value={thickness} onChange={setThickness} />
        <div style={{
          height: 180,
          background: 'linear-gradient(180deg, #1e293b 0%, #020617 100%)',
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 200,
            height: 120,
            background: 'repeating-linear-gradient(45deg, #dc2626 0 6px, #f59e0b 6px 12px)',
            opacity: 0.8,
            borderRadius: 4,
          }} />
        </div>
        <Space wrap>
          <Tag>平面:轴位</Tag>
          <Tag>旋转:0°</Tag>
          <Tag>模式:MIP</Tag>
        </Space>
      </Space>
    </div>
  )
}

export default MIPPanel
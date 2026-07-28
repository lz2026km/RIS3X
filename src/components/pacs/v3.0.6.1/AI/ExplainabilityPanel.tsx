/**
 * G005 放射RIS系统 v3.0.6.1 - AI 可解释性面板 (Grad-CAM/特征图)
 */
import React, { useState } from 'react'
import { Card, Tabs, Space, Tag, Slider, Switch, Empty } from 'antd'
import { Eye } from 'lucide-react'

export interface ExplainabilityPanelProps {
  algorithm?: string
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({ algorithm = 'CT-Lung-Nodule' }) => {
  const [opacity, setOpacity] = useState(0.6)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [tab, setTab] = useState('gradcam')

  return (
    <div data-testid="explainability-panel">
      <Card size="small" title={<Space><Eye size={14} />AI 可解释性 - {algorithm}</Space>}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'gradcam', label: 'Grad-CAM 热力图', children: (
              <div>
                <Space wrap>
                  <span style={{ fontSize: 12 }}>热力图:</span>
                  <Switch size="small" checked={showHeatmap} onChange={setShowHeatmap} />
                  <span style={{ fontSize: 12 }}>透明度:</span>
                  <Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} style={{ width: 120 }} />
                  <Tag color="blue">{Math.round(opacity * 100)}%</Tag>
                </Space>
                <div style={{
                  height: 280,
                  marginTop: 8,
                  background: '#0f172a',
                  borderRadius: 4,
                  position: 'relative',
                  backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 80%)',
                }}>
                  <div style={{
                    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                    width: 120, height: 90, background: '#475569', borderRadius: 8,
                  }} />
                  {showHeatmap && (
                    <div style={{
                      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                      width: 60, height: 60, borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(220,38,38,0.9) 0%, rgba(245,158,11,0.5) 40%, transparent 70%)',
                      opacity,
                      filter: 'blur(4px)',
                    }} />
                  )}
                </div>
              </div>
            ) },
            { key: 'features', label: '特征贡献', children: (
              <Space wrap>
                {[
                  { name: '形状', val: 0.32 },
                  { name: '边缘', val: 0.28 },
                  { name: '密度', val: 0.18 },
                  { name: '位置', val: 0.12 },
                  { name: '纹理', val: 0.10 },
                ].map((f) => (
                  <Tag key={f.name} color="blue">
                    {f.name}: {(f.val * 100).toFixed(0)}%
                  </Tag>
                ))}
              </Space>
            ) },
            { key: 'similar', label: '相似病例', children: (
              <Empty description="数据待接入" />
            ) },
          ]}
        />
      </Card>
    </div>
  )
}

export default ExplainabilityPanel
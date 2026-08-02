/**
 * G005 放射RIS系统 v3.0.6.1 - VR 工具 (预设/裁剪/分割)
 */
import React from 'react'
import { Radio, Space, Tag } from 'antd'
import type { VRPreset } from './VolumeRenderer'

export interface VRToolsProps {
  preset: VRPreset
  onChange: (p: VRPreset) => void
}

const PRESETS: { value: VRPreset; label: string; color: string; huRange: string }[] = [
  { value: 'BONE', label: '骨骼', color: 'white', huRange: '150-3000' },
  { value: 'SOFT_TISSUE', label: '软组织', color: 'orange', huRange: '30-100' },
  { value: 'VESSEL', label: '血管', color: 'red', huRange: '100-500' },
  { value: 'AIRWAY', label: '气道', color: 'blue', huRange: '-1000~-500' },
  { value: 'CUSTOM', label: '自定义', color: 'purple', huRange: '—' },
]

export const VRTools: React.FC<VRToolsProps> = ({ preset, onChange }) => {
  return (
    <div data-testid="vr-tools">
      <Radio.Group
        value={preset}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          {PRESETS.map((p) => (
            <Radio key={p.value} value={p.value} style={{ width: '100%' }}>
              <Space>
                <span>{p.label}</span>
                <Tag color={p.color}>{p.huRange}</Tag>
              </Space>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </div>
  )
}

export default VRTools
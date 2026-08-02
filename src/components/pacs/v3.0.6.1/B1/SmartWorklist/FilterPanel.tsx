/**
 * G005 放射RIS系统 v3.0.6.1 - 工作列表筛选面板
 */
import React from 'react'
import { Card, Checkbox, Input, Space, Tag, Select } from 'antd'
import { Search } from 'lucide-react'

export interface WorklistFilter {
  modality?: string[]
  priority?: string[]
  state?: string[]
  keyword?: string
  radiologist?: string[]
}

export interface FilterPanelProps {
  value: WorklistFilter
  onChange: (v: WorklistFilter) => void
}

const MODALITY = ['CT', 'MR', 'DR', 'CR', 'US', 'MG']
const PRIORITY = ['STAT', 'URGENT', 'ROUTINE']
const STATE = ['WAITING', 'IN_READING', 'PRELIM', 'FINAL']

export const FilterPanel: React.FC<FilterPanelProps> = ({ value, onChange }) => {
  const update = (patch: Partial<WorklistFilter>) => onChange({ ...value, ...patch })

  return (
    <Card size="small" title="筛选器" data-testid="filter-panel">
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Input
          size="small"
          prefix={<Search size={12} />}
          placeholder="姓名/ID"
          value={value.keyword}
          onChange={(e) => update({ keyword: e.target.value })}
          data-testid="filter-keyword"
        />
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>设备</div>
          <Checkbox.Group
            value={value.modality ?? []}
            onChange={(v) => update({ modality: v as string[] })}
            options={MODALITY.map((m) => ({ label: m, value: m }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>优先级</div>
          <Checkbox.Group
            value={value.priority ?? []}
            onChange={(v) => update({ priority: v as string[] })}
            options={PRIORITY.map((p) => ({ label: p, value: p }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>状态</div>
          <Checkbox.Group
            value={value.state ?? []}
            onChange={(v) => update({ state: v as string[] })}
            options={STATE.map((s) => ({ label: s, value: s }))}
          />
        </div>
        <Select
          size="small"
          mode="multiple"
          placeholder="医师"
          style={{ width: '100%' }}
          value={value.radiologist ?? []}
          onChange={(v) => update({ radiologist: v })}
          options={[
            { value: '陈医师', label: '陈医师' },
            { value: '林医师', label: '林医师' },
            { value: '黄医师', label: '黄医师' },
          ]}
        />
        <div>
          <Tag color="blue">共 {(value.modality?.length ?? 0) + (value.priority?.length ?? 0) + (value.state?.length ?? 0)} 项</Tag>
        </div>
      </Space>
    </Card>
  )
}

export default FilterPanel
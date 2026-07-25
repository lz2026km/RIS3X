/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens 扫描协议管理 (Protocol Manager)
 */
import React, { useState } from 'react'
import { Card, Table, Tag, Space, Button, Input, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Search, Settings } from 'lucide-react'
import { ScanProtocol, type ScanProtocolConfig } from './ScanProtocol'

const MOCK: ScanProtocolConfig[] = [
  { id: 'P-CT-CHEST-ROUTE', name: '胸部 CT 平扫 (常规)', modality: 'CT', bodyPart: '胸部', kv: 120, mas: 150, pitch: 1.0, dose: '低', contrast: false },
  { id: 'P-CT-CHEST-CONT', name: '胸部 CT 增强', modality: 'CT', bodyPart: '胸部', kv: 100, mas: 200, pitch: 1.2, dose: '中', contrast: true },
  { id: 'P-CT-CORO-CTA', name: '冠脉 CTA', modality: 'CT', bodyPart: '心脏', kv: 100, mas: 350, pitch: 0.2, dose: '中', contrast: true },
  { id: 'P-MR-HEAD-ROUT', name: '头颅 MR 平扫', modality: 'MR', bodyPart: '头颅', kv: 0, mas: 0, pitch: 0, dose: '—', contrast: false },
]

export interface ProtocolManagerProps {
  protocols?: ScanProtocolConfig[]
}

export const ProtocolManager: React.FC<ProtocolManagerProps> = ({ protocols = MOCK }) => {
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<ScanProtocolConfig | null>(protocols[0] ?? null)

  const filtered = protocols.filter((p) =>
    p.name.toLowerCase().includes(keyword.toLowerCase()) ||
    p.bodyPart.toLowerCase().includes(keyword.toLowerCase())
  )

  const columns: ColumnsType<ScanProtocolConfig> = [
    { title: '名称', dataIndex: 'name', render: (n: string) => <strong>{n}</strong> },
    { title: '设备', dataIndex: 'modality', width: 80, render: (m: string) => <Tag color="blue">{m}</Tag> },
    { title: '部位', dataIndex: 'bodyPart', width: 100 },
    { title: 'kV', dataIndex: 'kv', width: 60 },
    { title: 'mAs', dataIndex: 'mas', width: 60 },
    { title: '螺距', dataIndex: 'pitch', width: 60 },
    { title: '剂量', dataIndex: 'dose', width: 60 },
    { title: '增强', dataIndex: 'contrast', width: 70, render: (c: boolean) => c ? <Tag color="purple">是</Tag> : <Tag>否</Tag> },
    {
      title: '操作', width: 100,
      render: (_, r) => <Button size="small" onClick={() => setSelected(r)}>详情</Button>,
    },
  ]

  return (
    <div data-testid="protocol-manager">
      <Card
        size="small"
        title={<Space><Settings size={14} />扫描协议管理</Space>}
        extra={
          <Space>
            <Input
              size="small"
              prefix={<Search size={12} />}
              placeholder="搜索协议"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Button type="primary" size="small" icon={<Plus size={12} />}>新增</Button>
          </Space>
        }
      >
        <Table<ScanProtocolConfig>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={false}
          locale={{ emptyText: <Empty description="无匹配协议" /> }}
        />
      </Card>
      <div style={{ height: 12 }} />
      {selected && <ScanProtocol protocol={selected} />}
    </div>
  )
}

export default ProtocolManager
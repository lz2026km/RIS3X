/**
 * G005 放射RIS系统 v3.0.6.1 - 扫描协议选择器
 */
import React, { useMemo } from 'react'
import { Select, Table, Tag, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DoseRecord } from './DoseTracker'

export interface ProtocolSelectorProps {
  records: DoseRecord[]
  onSelect?: (protocol: string) => void
}

export const ProtocolSelector: React.FC<ProtocolSelectorProps> = ({ records, onSelect }) => {
  const protocols = useMemo(() => {
    const map = new Map<string, { protocol: string; count: number; avgDose: number; sum: number }>()
    records.forEach((r) => {
      const e = map.get(r.protocol) ?? { protocol: r.protocol, count: 0, avgDose: 0, sum: 0 }
      e.count += 1
      e.sum += r.effectiveDose_mSv
      map.set(r.protocol, e)
    })
    return Array.from(map.values()).map((m) => ({ ...m, avgDose: Math.round((m.sum / m.count) * 100) / 100 }))
  }, [records])

  const columns: ColumnsType<typeof protocols[number]> = [
    { title: '协议', dataIndex: 'protocol', render: (p: string) => <Tag color="blue">{p}</Tag> },
    { title: '使用次数', dataIndex: 'count', width: 90 },
    { title: '平均有效剂量 (mSv)', dataIndex: 'avgDose', width: 160 },
  ]

  return (
    <div data-testid="protocol-selector">
      <Select
        showSearch
        size="small"
        style={{ width: '100%', marginBottom: 8 }}
        placeholder="选择协议"
        onChange={(v) => onSelect?.(v)}
        options={protocols.map((p) => ({ value: p.protocol, label: p.protocol }))}
      />
      <Table size="small" rowKey="protocol" columns={columns} dataSource={protocols} pagination={false} locale={{ emptyText: <Empty description="暂无协议" /> }} />
    </div>
  )
}

export default ProtocolSelector
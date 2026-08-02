/**
 * G005 放射RIS系统 v3.0.6.1 - 剂量超阈值告警
 */
import React from 'react'
import { Alert, Tag, Space, Button } from 'antd'
import { AlertTriangle } from 'lucide-react'
import type { DoseRecord } from './DoseTracker'

export interface DoseAlertProps {
  records: DoseRecord[]
  onAction?: (id: string) => void
}

export const DoseAlert: React.FC<DoseAlertProps> = ({ records, onAction }) => {
  if (records.length === 0) {
    return <Alert type="success" title="无超阈值记录" showIcon />
  }
  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }} data-testid="dose-alert">
      {records.map((r) => (
        <Alert
          key={r.id}
          type="error"
          showIcon
          icon={<AlertTriangle size={14} />}
          message={
            <Space>
              <span>{r.patientName} ({r.patientId})</span>
              <Tag color="blue">{r.modality} {r.bodyPart}</Tag>
              <Tag color="red">有效剂量 {r.effectiveDose_mSv} mSv</Tag>
            </Space>
          }
          description={
            <Space>
              <span style={{ fontSize: 12 }}>协议: {r.protocol}</span>
              <Button size="small" type="link" onClick={() => onAction?.(r.id)}>查看详情</Button>
            </Space>
          }
        />
      ))}
    </Space>
  )
}

export default DoseAlert
import React, { useState } from 'react'
import { Card, Space, Tag, Input, Typography } from 'antd'
import { Cpu } from 'lucide-react'
import CADOverlay from '../../components/ai/CADOverlay'

const { Text } = Typography

const AiCadPage: React.FC = () => {
  const [instanceId, setInstanceId] = useState('1.2.840.113654.2.123.456789')

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Cpu size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>AI 阅片助手 V2</span>
        <Tag color="cyan">肺结节/钙化自动检测</Tag>
      </Space>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>SOP Instance UID:</Text>
          <Input
            style={{ width: 400 }}
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
          />
        </Space>
      </Card>
      <CADOverlay instanceId={instanceId} />
    </div>
  )
}

export default AiCadPage

import React, { useState } from 'react'
import { Card, Input, Button, Table, Tag, Typography, Alert, Space, Statistic, Row, Col, Divider, Empty, Tooltip, Progress } from 'antd'
import { Shield, Search, AlertTriangle, Eye, EyeOff, FileText, CheckCircle } from 'lucide-react'
import { phiDetector, deIdService } from '../../services/security'
import type { PhiMatch, PhiCategory, DeIdResult } from '../../types/security'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const categoryLabels: Record<PhiCategory, string> = {
  name: '姓名', address: '地址', phone: '电话', email: '邮箱', 'id-card': '身份证',
  'medical-record': '病历号', account: '账号', certificate: '证书', 'vehicle-plate': '车牌',
  biometric: '生物特征', photo: '照片', 'date-of-birth': '出生日期', 'date-of-death': '死亡日期',
  'age-over-89': '90+年龄', 'geo-location': '地理位置',
}

const categoryColors: Record<PhiCategory, string> = {
  name: 'blue', address: 'orange', phone: 'green', email: 'purple', 'id-card': 'red',
  'medical-record': 'volcano', account: 'magenta', certificate: 'cyan', 'vehicle-plate': 'gold',
  biometric: 'lime', photo: 'geekblue', 'date-of-birth': 'blue', 'date-of-death': 'red',
  'age-over-89': 'orange', 'geo-location': 'default',
}

const DEMO_TEXT = `患者姓名: 张三
身份证号: 110101199003078888
联系电话: 13800138000
电子邮箱: zhangsan@example.com
家庭地址: 北京市朝阳区建国路88号
病历号: MRN-2026-0042
出生日期: 1990-03-07
临床诊断: 右肺上叶占位性病变,建议CT引导下穿刺活检`

export default function PhiScanner() {
  const [text, setText] = useState(DEMO_TEXT)
  const [result, setResult] = useState<DeIdResult | null>(null)
  const [showDeId, setShowDeId] = useState(false)

  const handleScan = () => {
    const r = deIdService.deidentify(text, 'safe-harbor')
    setResult(r)
    setShowDeId(false)
  }

  const matches = result?.matches ?? []
  const assessment = result ? phiDetector.assess(matches) : null

  const columns = [
    { title: '类别', dataIndex: 'category', key: 'category', width: 100, render: (c: PhiCategory) => <Tag color={categoryColors[c]}>{categoryLabels[c]}</Tag> },
    { title: '原始值', dataIndex: 'originalValue', key: 'originalValue', width: 200 },
    { title: '位置', key: 'position', width: 80, render: (_: unknown, r: PhiMatch) => <Text type="secondary">{r.startIndex}-{r.endIndex}</Text> },
    { title: '置信度', dataIndex: 'confidence', key: 'confidence', width: 80, render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" format={p => `${p}%`} /> },
    { title: '规则', dataIndex: 'rule', key: 'rule', width: 120 },
  ]

  return (
    <Card title={<><Shield size={16} style={{ marginRight: 8 }} />PHI 扫描与去标识化</>}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <TextArea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="粘贴包含 PHI 的文本..." />
        <Space>
          <Button type="primary" icon={<Search size={14} />} onClick={handleScan}>扫描 PHI</Button>
          <Button onClick={() => setText('')}>清空</Button>
        </Space>
      </Space>

      {result && (
        <>
          <Divider />
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="检测类别" value={result.categories.length} prefix={<FileText size={14} />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="匹配项" value={matches.length} prefix={<AlertTriangle size={14} />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="风险等级" value={assessment?.riskLevel ?? '-'} styles={{ content: {  color: assessment?.riskLevel === 'critical' ? '#f5222d' : assessment?.riskLevel === 'high' ? '#fa8c16' : '#52c41a'  } }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="信息保留" value={Math.round(result.retentionRatio * 100)} suffix="%" prefix={<CheckCircle size={14} />} /></Card></Col>
          </Row>

          <Alert type={assessment?.riskLevel === 'critical' ? 'error' : assessment?.riskLevel === 'high' ? 'warning' : 'info'}
            title={`风险评估: ${assessment?.riskLevel?.toUpperCase() ?? '未知'} (${assessment?.score ?? 0}/100)`}
            description={matches.length > 0 ? `发现 ${matches.length} 项 PHI, 建议使用 Safe Harbor 去标识化` : '未检测到 PHI'}
            showIcon style={{ marginBottom: 16 }} />

          <Table dataSource={matches} columns={columns} rowKey={(r, i) => `${r.startIndex}-${i}`} size="small" pagination={false} locale={{ emptyText: <Empty description="未检测到 PHI" /> }} />

          <Divider />
          <Space style={{ marginBottom: 8 }}>
            <Button icon={showDeId ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setShowDeId(!showDeId)}>
              {showDeId ? '隐藏脱敏结果' : '显示脱敏结果'}
            </Button>
            {showDeId && (
              <Button icon={<FileText size={14} />} onClick={() => { navigator.clipboard.writeText(result.deIdentifiedText) }}>复制脱敏文本</Button>
            )}
          </Space>
          {showDeId && (
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 300, overflow: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{result.deIdentifiedText}</pre>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

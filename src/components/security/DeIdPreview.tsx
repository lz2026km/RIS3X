import React, { useState } from 'react'
import { Card, Button, Typography, Space, Tag, Alert, Row, Col, Statistic, Divider, Select, Empty, Tooltip } from 'antd'
import { Shield, Eye, EyeOff, Copy, FileText, CheckCircle, AlertTriangle, Upload } from 'lucide-react'
import { deIdService, phiDetector } from '../../services/security'
import type { DeIdResult, PhiCategory } from '../../types/security'

const { Title, Text, Paragraph } = Typography

const DEMO_REPORT = `患者姓名: 张三, 性别: 男, 年龄: 45岁
住院号: MRN-2026-0042, 身份证号: 110101199003078888
联系电话: 13800138000
入院日期: 2026-06-15
主诉: 咳嗽、咳痰 2 周, 胸痛 1 天
既往史: 高血压病史 5 年, 2 型糖尿病
CT 检查: 右肺上叶可见一大小约 3.2cm × 2.8cm 结节影, 边缘毛糙
影像号: STUDY-2026-7777
报告医生: 李医生, 审核: 张主任
诊断: 右肺上叶占位性病变, 建议 CT 引导下穿刺活检`

export default function DeIdPreview() {
  const [text, setText] = useState(DEMO_REPORT)
  const [result, setResult] = useState<DeIdResult | null>(null)
  const [method, setMethod] = useState<'safe-harbor' | 'pseudonymization'>('safe-harbor')
  const [showOriginal, setShowOriginal] = useState(false)

  const handleDeId = () => {
    const r = deIdService.deidentify(text, method)
    setResult(r)
  }

  const handleCopyDeId = () => {
    if (result) navigator.clipboard.writeText(result.deIdentifiedText)
  }

  return (
    <Card title={<><Shield size={16} style={{ marginRight: 8 }} />去标识化预览</>}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Alert title="基于 HIPAA Safe Harbor 18 项标识符规则, 自动检测并脱敏 PHI" type="info" showIcon style={{ marginBottom: 16 }} />

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Text strong>原始文本</Text>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, minHeight: 180, maxHeight: 300, overflow: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{text}</pre>
            </div>
            <Space style={{ marginTop: 8 }}>
              <Select value={method} onChange={v => setMethod(v as 'safe-harbor' | 'pseudonymization')} style={{ width: 160 }}>
                <Select.Option value="safe-harbor">Safe Harbor</Select.Option>
                <Select.Option value="pseudonymization">假名化</Select.Option>
              </Select>
              <Button type="primary" icon={<Shield size={14} />} onClick={handleDeId}>去标识化</Button>
            </Space>
          </div>
          {result && (
            <div style={{ flex: 1 }}>
              <Text strong>去标识化结果</Text>
              <div style={{ background: '#f6ffed', padding: 12, borderRadius: 4, minHeight: 180, maxHeight: 300, overflow: 'auto', border: '1px solid #b7eb8f' }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{result.deIdentifiedText}</pre>
              </div>
              <Space style={{ marginTop: 8 }}>
                <Button icon={<Copy size={14} />} onClick={handleCopyDeId}>复制</Button>
                <Button icon={showOriginal ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setShowOriginal(!showOriginal)}>
                  {showOriginal ? '隐藏对比' : '高亮对比'}
                </Button>
              </Space>
            </div>
          )}
        </div>

        {result && (
          <>
            <Divider />
            <Row gutter={16}>
              <Col span={6}><Statistic title="PHI 类别数" value={result.categories.length} prefix={<FileText size={14} />} /></Col>
              <Col span={6}><Statistic title="匹配项" value={result.matches.length} prefix={<AlertTriangle size={14} />} /></Col>
              <Col span={6}><Statistic title="信息保留" value={Math.round(result.retentionRatio * 100)} suffix="%" prefix={<CheckCircle size={14} />} /></Col>
              <Col span={6}><Statistic title="可逆" value={result.reversible ? '是' : '否'} prefix={<Shield size={14} />} /></Col>
            </Row>
            <Divider />
            <Text strong>检测到的 PHI 类别:</Text>
            <Space wrap style={{ marginTop: 8 }}>
              {result.categories.length === 0 && <Empty description="未检测到 PHI" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              {result.matches.map((m, i) => (
                <Tooltip key={i} title={`${m.originalValue}`}>
                  <Tag color="red">{m.category}: {m.originalValue.slice(0, 20)}</Tag>
                </Tooltip>
              ))}
            </Space>
          </>
        )}
      </Space>
    </Card>
  )
}

import React, { useState, useCallback } from 'react'
import {
  Card, Input, Button, Table, Tag, Space, Typography, Tooltip, message,
  Row, Col, Statistic, Divider, Empty,
} from 'antd'
import { Code, Search, CheckCircle, AlertTriangle, FileText, BookOpen, ThumbsUp, Clipboard } from 'lucide-react'
import { snomedApi, type SnomedCode } from '../../services/api/snomedApi'

const { Text, Title, TextArea: AntTextArea } = Typography

const SnomedEncoderPage: React.FC = () => {
  const [text, setText] = useState('')
  const [codes, setCodes] = useState<SnomedCode[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<SnomedCode[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const handleEncode = useCallback(async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await snomedApi.encode(text)
      if (res.success) {
        setCodes(res.data?.codes ?? [])
        if (res.data?.codes?.length === 0) {
          message.info('未匹配到 SNOMED CT 编码')
        }
      } else {
        message.error(res.error?.message || '编码失败')
      }
    } catch {
      message.error('编码请求失败')
    } finally {
      setLoading(false)
    }
  }, [text])

  const handleSearch = useCallback(async () => {
    if (!searchQ.trim()) return
    setSearchLoading(true)
    try {
      const res = await snomedApi.search(searchQ)
      if (res.success) {
        setSearchResults(res.data ?? [])
      } else {
        message.error(res.error?.message || '搜索失败')
      }
    } catch {
      message.error('搜索请求失败')
    } finally {
      setSearchLoading(false)
    }
  }, [searchQ])

  const toggleConfirm = (conceptId: string) => {
    setConfirmed(prev => {
      const next = new Set(prev)
      if (next.has(conceptId)) next.delete(conceptId)
      else next.add(conceptId)
      return next
    })
  }

  const confirmAll = () => {
    setConfirmed(new Set(codes.map(c => c.conceptId)))
    message.success(`已确认 ${codes.length} 个编码`)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制'))
  }

  const columns = [
    {
      title: '确认',
      key: 'confirmed',
      width: 60,
      render: (_: unknown, record: SnomedCode) => (
        <input
          type="checkbox"
          checked={confirmed.has(record.conceptId)}
          onChange={() => toggleConfirm(record.conceptId)}
          style={{ cursor: 'pointer', width: 16, height: 16 }}
        />
      ),
    },
    {
      title: '首选术语 (PT)',
      dataIndex: 'pt',
      key: 'pt',
      render: (pt: string, record: SnomedCode) => (
        <Space>
          <Text strong>{pt}</Text>
          <Tooltip title="复制">
            <Button size="small" type="text" icon={<Clipboard size={12} />} onClick={() => copyToClipboard(pt)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Concept ID',
      dataIndex: 'conceptId',
      key: 'conceptId',
      render: (id: string) => (
        <Space>
          <Text code style={{ fontSize: 12 }}>{id}</Text>
          <Tooltip title="复制">
            <Button size="small" type="text" icon={<Clipboard size={12} />} onClick={() => copyToClipboard(id)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '完整名称 (FSN)',
      dataIndex: 'fsn',
      key: 'fsn',
      render: (fsn: string) => <Text type="secondary" style={{ fontSize: 12 }}>{fsn}</Text>,
    },
    {
      title: '语义标签',
      dataIndex: 'semanticTag',
      key: 'semanticTag',
      render: (tag: string) => <Tag>{tag}</Tag>,
    },
    {
      title: '匹配类型',
      dataIndex: 'matchType',
      key: 'matchType',
      render: (type: string) => (
        <Tag color={type === 'exact' ? 'green' : type === 'partial' ? 'orange' : 'blue'}>
          {type === 'exact' ? '精确' : type === 'partial' ? '部分' : '建议'}
        </Tag>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      sorter: (a: SnomedCode, b: SnomedCode) => a.confidence - b.confidence,
      render: (c: number) => (
        <Tag color={c > 0.9 ? 'green' : c > 0.7 ? 'orange' : 'red'}>
          {(c * 100).toFixed(0)}%
        </Tag>
      ),
    },
  ]

  const exactCount = codes.filter(c => c.matchType === 'exact').length
  const partialCount = codes.filter(c => c.matchType === 'partial').length
  const avgConfidence = codes.length > 0
    ? codes.reduce((sum, c) => sum + c.confidence, 0) / codes.length
    : 0

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Code size={24} color="#3b82f6" />
          <Title level={4} style={{ margin: 0 }}>SNOMED CT 智能编码器</Title>
        </Space>
        <Text type="secondary">将放射报告文本自动映射到 SNOMED CT 标准术语编码，支持精确/部分匹配和置信度评分</Text>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="匹配编码" value={codes.length} styles={{ content: {  color: '#1677ff'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="精确匹配" value={exactCount} styles={{ content: {  color: '#52c41a'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="部分匹配" value={partialCount} styles={{ content: {  color: '#fa8c16'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均置信度" value={avgConfidence > 0 ? `${(avgConfidence * 100).toFixed(0)}%` : '-'} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={<Space><FileText size={14} color="#3b82f6" />报告文本输入</Space>}
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<Code size={14} />}
                  onClick={handleEncode}
                  loading={loading}
                  disabled={!text.trim()}
                >
                  {loading ? '编码中...' : 'SNOMED 编码'}
                </Button>
                {codes.length > 0 && (
                  <Button icon={<ThumbsUp size={14} />} onClick={confirmAll}>
                    全部确认 ({codes.length})
                  </Button>
                )}
              </Space>
            }
          >
            <Input.TextArea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder="输入放射科报告文本，例如：&#10;右肺上叶可见一大小约8mm磨玻璃结节，边界清晰，密度均匀。左肺未见明显异常。"
              style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {text.length} 字符 | 支持中英文放射报告
              </Text>
              {confirmed.size > 0 && (
                <Tag color="green">
                  <CheckCircle size={12} /> 已确认 {confirmed.size}/{codes.length}
                </Tag>
              )}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card
            title={<Space><Search size={14} color="#8b5cf6" />SNOMED CT 术语搜索</Space>}
          >
            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onPressEnter={handleSearch}
                placeholder="搜索 SNOMED CT 术语，如: nodule, fracture, 肺炎"
              />
              <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={searchLoading}>
                搜索
              </Button>
            </Space.Compact>

            {searchResults.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {searchResults.map(c => (
                  <div
                    key={c.conceptId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
                      borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (!codes.some(code => code.conceptId === c.conceptId)) {
                        setCodes(prev => [...prev, c])
                        message.success(`已添加: ${c.pt}`)
                      }
                    }}
                  >
                    <BookOpen size={14} color="#8b5cf6" />
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 13 }}>{c.pt}</Text>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {c.conceptId} | {c.semanticTag}
                      </div>
                    </div>
                    <Tag color={c.confidence > 0.9 ? 'green' : 'orange'}>
                      {(c.confidence * 100).toFixed(0)}%
                    </Tag>
                  </div>
                ))}
              </div>
            ) : searchQ && !searchLoading ? (
              <Empty description="未找到匹配的 SNOMED CT 术语" style={{ padding: 24 }} />
            ) : null}
          </Card>
        </Col>
      </Row>

      {codes.length > 0 && (
        <Card
          title={
            <Space>
              <AlertTriangle size={14} color="#3b82f6" />
              编码结果
              <Tag>{codes.length} 个编码</Tag>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          <Table
            dataSource={codes}
            columns={columns}
            rowKey="conceptId"
            size="small"
            pagination={false}
          />
        </Card>
      )}

      {codes.length === 0 && !loading && text && (
        <Card style={{ marginTop: 16, textAlign: 'center', padding: 40 }}>
          <Empty description="未匹配到 SNOMED CT 编码" />
        </Card>
      )}
    </div>
  )
}

export default SnomedEncoderPage

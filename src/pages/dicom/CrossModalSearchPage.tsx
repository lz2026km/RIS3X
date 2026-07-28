import React, { useState, useEffect } from 'react'
import { Card, Input, Row, Col, Typography, Space, Tag, Button, Empty, Image, Spin } from 'antd'
import { Search, ImageIcon, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { crossModalSearchApi, type CrossModalSearchResult } from '../../services/api'

const { Text, Title } = Typography

const CrossModalSearchPage: React.FC = () => {
  const { t } = useTranslation('dicom')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CrossModalSearchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await crossModalSearchApi.search({ query: '' })
        if (!cancelled && res.success && Array.isArray(res.data)) setResults(res.data)
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const res = await crossModalSearchApi.search({ query: query.trim() })
      if (res.success && Array.isArray(res.data)) setResults(res.data)
    } catch { /* keep current results */ }
    setLoading(false)
  }

  const handleSimilar = async (id: string) => {
    setLoading(true)
    try {
      const res = await crossModalSearchApi.findSimilar(id)
      if (res.success && Array.isArray(res.data)) setResults(res.data)
    } catch { /* keep current results */ }
    setLoading(false)
  }

  const modalityColors: Record<string, string> = { CT: 'cyan', MR: 'purple', DX: 'orange', MG: 'pink', US: 'blue' }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <ImageIcon size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>跨模态检索</span>
      </Space>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%' }}>
          <Input.Search
            placeholder="搜索患者姓名、ID、模态、描述..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 500 }}
            enterButton={<><Search size={14} /> 搜索</>}
          />
          <Text type="secondary">支持文本和影像特征混合搜索</Text>
        </Space>
      </Card>
      {loading ? <Spin size="large" style={{ display: 'block', margin: '40px auto' }} /> : results.length === 0 ? <Empty description="未找到匹配结果" /> : (
        <Row gutter={[16, 16]}>
          {results.map(r => (
            <Col key={r.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                cover={
                  r.thumbnail
                    ? <Image alt={r.description} src={r.thumbnail} style={{ height: 160, objectFit: 'cover' }} fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
                    : <div style={{ height: 160, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={32} color="#bbb" /></div>
                }
                actions={[<Button type="link" size="small" onClick={() => handleSimilar(r.id)}>更多相似</Button>]}
              >
                <Card.Meta
                  title={<Space>{r.patientName}<Tag color={modalityColors[r.modality]}>{r.modality}</Tag></Space>}
                  description={<div><Text type="secondary">{r.description}</Text><br /><Text type="secondary">{r.studyDate}</Text><br /><Text strong>相似度: {(r.similarity * 100).toFixed(0)}%</Text></div>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}

export default CrossModalSearchPage

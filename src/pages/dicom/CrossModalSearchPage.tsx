import React, { useState } from 'react'
import { Card, Input, Row, Col, Typography, Space, Tag, Button, Empty, Image } from 'antd'
import { Search, ImageIcon, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const { Text, Title } = Typography

interface SearchResult {
  id: string
  patientName: string
  patientId: string
  modality: string
  studyDate: string
  description: string
  similarity: number
  thumbnail?: string
}

const mockResults: SearchResult[] = [
  { id: 'img-001', patientName: 'Zhang San', patientId: 'P001', modality: 'CT', studyDate: '2026-07-10', description: 'Chest CT with nodule', similarity: 0.95, thumbnail: '/mock-images/ct-001.png' },
  { id: 'img-002', patientName: 'Li Si', patientId: 'P002', modality: 'MR', studyDate: '2026-07-11', description: 'Brain MRI tumor', similarity: 0.88, thumbnail: '/mock-images/mr-001.png' },
  { id: 'img-003', patientName: 'Wang Wu', patientId: 'P003', modality: 'CT', studyDate: '2026-07-12', description: 'Chest CT follow-up', similarity: 0.82, thumbnail: '/mock-images/ct-002.png' },
  { id: 'img-004', patientName: 'Zhao Liu', patientId: 'P004', modality: 'DX', studyDate: '2026-07-09', description: 'Chest X-ray pneumonia', similarity: 0.79 },
  { id: 'img-005', patientName: 'Chen Qi', patientId: 'P005', modality: 'MR', studyDate: '2026-07-08', description: 'Knee MRI meniscus tear', similarity: 0.91, thumbnail: '/mock-images/mr-001.png' },
]

const CrossModalSearchPage: React.FC = () => {
  const { t } = useTranslation('dicom')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>(mockResults)

  const handleSearch = () => {
    if (!query.trim()) { setResults(mockResults); return }
    const q = query.toLowerCase()
    setResults(mockResults.filter(r =>
      r.patientName.toLowerCase().includes(q) ||
      r.patientId.toLowerCase().includes(q) ||
      r.modality.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    ))
  }

  const handleSimilar = (id: string) => {
    const source = mockResults.find(r => r.id === id)
    if (!source) return
    const similar = mockResults.filter(r => r.id !== id).sort((a, b) => b.similarity - a.similarity).slice(0, 5)
    setResults(similar)
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
      {results.length === 0 ? <Empty description="未找到匹配结果" /> : (
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

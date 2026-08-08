/**
 * G005 v3.0.6.11-75 W3-1 - 跨模态检索页
 * 搜索表单(关键词/患者/模态/日期) → crossModalApi → 结果分组(exam/report/dicom) → 跳转详情
 */
import React, { useState } from 'react'
import {
  Card, Input, Row, Col, Typography, Space, Tag, Button, Empty, Spin, Alert, Select, Tabs, Statistic, message,
} from 'antd'
import { Search, ImageIcon, FileText, ScanSearch, ExternalLink, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { crossModalApi } from '../../services/api'
import type { CrossModalSearchResult, CrossModalSimilarResult } from '../../services/api/crossModalApi'

const { Text } = Typography

const MODALITY_OPTIONS = ['CT', 'MR', 'DX', 'MG', 'US', 'DSA'].map((m) => ({ label: m, value: m }))
type ResultType = 'exam' | 'report' | 'dicom'
const TYPE_META: Record<ResultType, { label: string; color: string }> = {
  exam: { label: '检查', color: 'blue' },
  report: { label: '报告', color: 'green' },
  dicom: { label: '影像', color: 'purple' },
}

const CrossModalSearchPage: React.FC = () => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [modalities, setModalities] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [results, setResults] = useState<CrossModalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [indexStatus, setIndexStatus] = useState<{ totalDocuments: number; lastIndexedAt?: string; status: string } | null>(null)

  const classify = (r: CrossModalSearchResult): ResultType => {
    const m = (r.matchedField ?? 'study').toLowerCase()
    if (m.includes('report') || m.includes('reportid')) return 'report'
    if (m.includes('dicom') || m.includes('instance') || m.includes('similar')) return 'dicom'
    return 'exam'
  }

  const loadIndexStatus = async () => {
    const res = await crossModalApi.getIndexStatus()
    if (res.success && res.data) setIndexStatus(res.data as typeof indexStatus)
  }

  const handleSearch = async () => {
    const combined = [query.trim(), patientQuery.trim()].filter(Boolean).join(' ')
    if (!combined) {
      message.warning('请输入搜索关键词或患者信息')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await crossModalApi.search({
        query: combined,
        modalities: modalities.length > 0 ? modalities : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 60,
      })
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data)
        setSearched(true)
      } else {
        setError(res.error?.message ?? '搜索失败')
        setResults([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜索失败,请稍后重试')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const toResult = (r: CrossModalSimilarResult): CrossModalSearchResult => ({
    id: r.id,
    score: r.similarity,
    modality: r.modality,
    studyUid: r.id,
    patientName: r.patientName,
    patientId: r.patientId,
    studyDescription: r.description,
    studyDate: r.studyDate,
    thumbnail: r.thumbnail,
    matchedField: 'similar',
  })

  // [G005 W3] 相似检索: 调后端 POST /cross-modal/similar (imageId), 失败回退保持当前结果
  const handleSimilar = async (id: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await crossModalApi.similar(id)
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data.map(toResult))
        setSearched(true)
        setActiveTab('all')
      } else {
        setError(res.error?.message ?? '相似检索失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '相似检索失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSimilarButton = () => {
    const seed = results[0]
    if (!seed) {
      message.warning('请先搜索后再进行相似检索')
      return
    }
    void handleSimilar(seed.id)
  }

  const goDetail = (r: CrossModalSearchResult) => {
    navigate(`/dicom-viewer?studyUid=${encodeURIComponent(r.studyUid)}`)
  }

  const groups = {
    all: results,
    exam: results.filter((r) => classify(r) === 'exam'),
    report: results.filter((r) => classify(r) === 'report'),
    dicom: results.filter((r) => classify(r) === 'dicom'),
  }

  const modalityColors: Record<string, string> = { CT: 'cyan', MR: 'purple', DX: 'orange', MG: 'pink', US: 'blue', DSA: 'red' }

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <ScanSearch size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>跨模态检索</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        {indexStatus && (
          <Tag color={indexStatus.status === 'ready' ? 'success' : 'warning'}>
            索引 {indexStatus.totalDocuments} 份文档
          </Tag>
        )}
      </Space>

      <Card size="small" style={{ marginBottom: 16 }} title="检索条件">
        <Row gutter={[12, 12]}>
          <Col xs={24} md={10}>
            <Input
              prefix={<Search size={14} style={{ color: '#999' }} />}
              placeholder="关键词: 肺结节 / 脑白质 / 肺炎..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} md={6}>
            <Input
              placeholder="患者姓名 / ID"
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              mode="multiple"
              allowClear
              placeholder="模态筛选"
              style={{ width: '100%' }}
              options={MODALITY_OPTIONS}
              value={modalities}
              onChange={setModalities}
              maxTagCount={3}
            />
          </Col>
          <Col xs={12} md={5}>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Col>
          <Col xs={12} md={5}>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Col>
          <Col xs={24} md={14}>
            <Space>
              <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={loading}>搜索</Button>
              <Button icon={<ScanSearch size={14} />} onClick={handleSimilarButton} disabled={results.length === 0}>相似检索</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => void loadIndexStatus()}>索引状态</Button>
              <Text type="secondary" style={{ fontSize: 12 }}>支持文本 + 患者 + 模态混合检索</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="error" showIcon message="检索失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={handleSearch}>重试</Button>} />
      )}

      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />
      ) : !searched ? (
        <Empty description="输入检索条件开始搜索" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 48 }} />
      ) : results.length === 0 ? (
        <Empty description="未找到匹配结果" style={{ marginTop: 48 }} />
      ) : (
        <Card size="small">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'all', label: `全部 (${groups.all.length})` },
              { key: 'exam', label: `检查 (${groups.exam.length})` },
              { key: 'report', label: `报告 (${groups.report.length})` },
              { key: 'dicom', label: `影像 (${groups.dicom.length})` },
            ]}
          />
          <Row gutter={[12, 12]}>
            {groups[activeTab as keyof typeof groups].map((r) => {
              const type = classify(r)
              return (
                <Col key={r.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    size="small"
                    cover={
                      r.thumbnail
                        ? <img alt={r.studyDescription} src={r.thumbnail} style={{ height: 120, objectFit: 'cover', borderTopLeftRadius: 8, borderTopRightRadius: 8 }} />
                        : <div style={{ height: 120, background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {type === 'dicom' ? <ImageIcon size={28} color="#a78bfa" /> : <FileText size={28} color="#93c5fd" />}
                          </div>
                    }
                    actions={[
                      <Button key="detail" size="small" type="link" icon={<ExternalLink size={12} />} onClick={() => goDetail(r)}>查看详情</Button>,
                      <Button key="similar" size="small" type="link" onClick={() => handleSimilar(r.id)}>相似</Button>,
                    ]}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Space size={4}>
                        <Tag color={modalityColors[r.modality]}>{r.modality}</Tag>
                        <Tag color={TYPE_META[type].color}>{TYPE_META[type].label}</Tag>
                      </Space>
                      <Text strong style={{ color: '#7c3aed' }}>{Math.round((r.score ?? 0) * 100)}%</Text>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.patientName} <Text type="secondary" style={{ fontSize: 11 }}>{r.patientId}</Text></div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.studyDescription}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.studyDate}</Text>
                  </Card>
                </Col>
              )
            })}
          </Row>
          <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
            <Statistic title="命中结果" value={results.length} />
            <Statistic title="涉及模态" value={new Set(results.map((r) => r.modality)).size} />
            <Statistic title="涉及患者" value={new Set(results.map((r) => r.patientId)).size} />
          </div>
        </Card>
      )}
    </div>
  )
}

export default CrossModalSearchPage

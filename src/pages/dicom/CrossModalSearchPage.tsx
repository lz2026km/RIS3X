/**
 * G005 v3.0.6.11-75 W3-1 - 跨模态检索页
 * 搜索表单(关键词/患者/模态/日期) → crossModalApi → 结果分组(exam/report/dicom) → 跳转详情
 */
import { crossModalApi } from '../../services/api'
import type { CrossModalSearchResult, CrossModalSimilarResult } from '../../services/api/crossModalApi'
import {
  Card, Input, Row, Col, Typography, Space, Tag, Button, Empty, Spin, Alert, Select, Tabs, message,
} from 'antd'
import { EmptyState } from '../../components/common/EmptyState'
import { PageContainer, StatCard, StatCardGrid } from '../../components/common'
import { Search, ImageIcon, FileText, ScanSearch, ExternalLink, RefreshCw, DatabaseZap } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const { Text } = Typography

const MODALITY_OPTIONS = ['CT', 'MR', 'DX', 'MG', 'US', 'DSA'].map((m) => ({ label: m, value: m }))
type ResultType = 'exam' | 'report' | 'dicom'
const TYPE_META: Record<ResultType, { labelKey: string; color: string }> = {
  exam: { labelKey: 'w9d.crossModal.exam', color: 'blue' },
  report: { labelKey: 'w9d.crossModal.report', color: 'green' },
  dicom: { labelKey: 'w9d.crossModal.dicom', color: 'purple' },
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
  // [G005 v3.0.6.11-91 W1-B P1 第12轮] 重建索引 + 搜索建议 (crossModalApi.reindex / getSuggestions)
  const [reindexing, setReindexing] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionLoading, setSuggestionLoading] = useState(false)

  useEffect(() => {
    void loadIndexStatus()
  }, [])

  // 搜索建议: 输入 ≥2 字符后 300ms 防抖调用 getSuggestions
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setSuggestions([]); return }
    setSuggestionLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await crossModalApi.getSuggestions(q)
        if (res.success && Array.isArray(res.data)) setSuggestions(res.data.slice(0, 6))
        else setSuggestions([])
      } catch { setSuggestions([]) }
      finally { setSuggestionLoading(false) }
    }, 300)
    return () => { clearTimeout(timer) }
  }, [query])

  const handleReindex = async () => {
    setReindexing(true)
    try {
      const res = await crossModalApi.reindex()
      if (res.success) {
        message.success(t('crossModal.reindexTriggered'))
        await loadIndexStatus()
      } else {
        message.error(res.error?.message ?? t('crossModal.reindexFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('crossModal.reindexFailed'))
    } finally {
      setReindexing(false)
    }
  }

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
      message.warning(t('crossModal.enterQuery'))
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
        setError(res.error?.message ?? t('crossModal.searchFailed'))
        setResults([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crossModal.searchFailedRetry'))
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
        setError(res.error?.message ?? t('crossModal.similarFailed'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crossModal.similarFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSimilarButton = () => {
    const seed = results[0]
    if (!seed) {
      message.warning(t('crossModal.searchFirst'))
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
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }} wrap>
        <ScanSearch size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('crossModal.title')}</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        {indexStatus && (
          <Tag color={indexStatus.status === 'ready' ? 'success' : 'warning'}>
            {t('crossModal.indexPrefix')} {indexStatus.totalDocuments} {t('crossModal.docUnit')}
          </Tag>
        )}
      </Space>

      <Card size="small" style={{ marginBottom: 16 }} title={t('crossModal.searchConditions')}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={10}>
            <Input
              prefix={<Search size={14} style={{ color: '#999' }} />}
              placeholder={t('crossModal.keywordPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} md={6}>
            <Input
              placeholder={t('crossModal.patientPlaceholder')}
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              mode="multiple"
              allowClear
              placeholder={t('crossModal.modalityFilter')}
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
              <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={loading}>{t('crossModal.search')}</Button>
              <Button icon={<ScanSearch size={14} />} onClick={handleSimilarButton} disabled={results.length === 0}>{t('crossModal.similarSearch')}</Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => void loadIndexStatus()}>{t('crossModal.indexStatus')}</Button>
              <Button icon={<DatabaseZap size={14} />} loading={reindexing} onClick={() => void handleReindex()}>{t('crossModal.reindex')}</Button>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('crossModal.searchHint')}</Text>
            </Space>
          </Col>
          <Col span={24}>
            {suggestionLoading ? (
              <Spin size="small" />
            ) : suggestions.length > 0 ? (
              <Space size={6} wrap>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('crossModal.suggestions')}</Text>
                {suggestions.map((s) => (
                  <Tag key={s} color="blue" style={{ cursor: 'pointer' }} onClick={() => setQuery(s)}>{s}</Tag>
                ))}
              </Space>
            ) : null}
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert type="error" showIcon message={t('crossModal.searchFailedTitle')} description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={handleSearch}><RefreshCw size={14} /> {t('crossModal.retry')}</Button>} />
      )}

      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />
      ) : !searched ? (
        <EmptyState description={t('crossModal.enterSearchHint')} style={{ marginTop: 48 }} />
      ) : results.length === 0 ? (
        <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description={t('crossModal.noResults')} style={{ marginTop: 48 }} />
      ) : (
        <Card size="small">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'all', label: t('crossModal.tabAll', { count: groups.all.length }) },
              { key: 'exam', label: t('crossModal.tabExam', { count: groups.exam.length }) },
              { key: 'report', label: t('crossModal.tabReport', { count: groups.report.length }) },
              { key: 'dicom', label: t('crossModal.tabDicom', { count: groups.dicom.length }) },
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
                      <Button key="detail" size="small" type="link" icon={<ExternalLink size={12} />} onClick={() => goDetail(r)}>{t('crossModal.viewDetail')}</Button>,
                      <Button key="similar" size="small" type="link" onClick={() => handleSimilar(r.id)}>{t('crossModal.similar')}</Button>,
                    ]}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Space size={4}>
                        <Tag color={modalityColors[r.modality]}>{r.modality}</Tag>
                        <Tag color={TYPE_META[type].color}>{t(TYPE_META[type].labelKey)}</Tag>
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
          <StatCardGrid minWidth={200} gap={16} style={{ marginTop: 16 }}>
            <StatCard title={t('crossModal.hitResults')} value={results.length} />
            <StatCard title={t('crossModal.modalitiesInvolved')} value={new Set(results.map((r) => r.modality)).size} />
            <StatCard title={t('crossModal.patientsInvolved')} value={new Set(results.map((r) => r.patientId)).size} />
          </StatCardGrid>
        </Card>
      )}
    </PageContainer>
  )
}

export default CrossModalSearchPage

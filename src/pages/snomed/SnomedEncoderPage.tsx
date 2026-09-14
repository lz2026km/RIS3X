// @deprecated [v3.0.6.11-104 Wave 5C] 已嵌入 SnomedPage (/snomed/encode 宿主) 作为 Tab; 旧路由 /snomed/encoder redirect 兼容。文件保留供回滚参考。
import { snomedApi, type SnomedCode } from '../../services/api/snomedApi'
import { Card, Input, Button, Table, Tag, Space, Typography, Tooltip, message, Row, Col, Statistic, Empty } from 'antd'
import { Code, Search, CheckCircle, AlertTriangle, FileText, BookOpen, ThumbsUp, Clipboard } from 'lucide-react'
import React, { useState, useCallback } from 'react'
import { SearchX } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const { Text, Title, TextArea: _AntTextArea } = Typography

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
          message.info(t('snomedEncoder.noMatch'))
        }
      } else {
        message.error(res.error?.message || t('snomedEncoder.encodeFailed'))
      }
    } catch {
      message.error(t('snomedEncoder.encodeRequestFailed'))
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
        message.error(res.error?.message || t('snomedEncoder.searchFailed'))
      }
    } catch {
      message.error(t('snomedEncoder.searchRequestFailed'))
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
    message.success(t('snomedEncoder.confirmedCount', { count: codes.length }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success(t('snomedEncoder.copied')))
  }

  const columns = [
    {
      title: t('snomedEncoder.colConfirmed'),
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
      title: t('snomedEncoder.colPt'),
      dataIndex: 'pt',
      key: 'pt',
      render: (pt: string, _record: SnomedCode) => (
        <Space>
          <Text strong>{pt}</Text>
          <Tooltip title="复制">
            <Button size="small" type="text" icon={<Clipboard size={12} />} onClick={() => copyToClipboard(pt)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: t('snomedEncoder.colConceptId'),
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
      title: t('snomedEncoder.colFsn'),
      dataIndex: 'fsn',
      key: 'fsn',
      render: (fsn: string) => <Text type="secondary" style={{ fontSize: 12 }}>{fsn}</Text>,
    },
    {
      title: t('snomedEncoder.colSemanticTag'),
      dataIndex: 'semanticTag',
      key: 'semanticTag',
      render: (tag: string) => <Tag>{tag}</Tag>,
    },
    {
      title: t('snomedEncoder.colMatchType'),
      dataIndex: 'matchType',
      key: 'matchType',
      render: (type: string) => (
        <Tag color={type === 'exact' ? 'green' : type === 'partial' ? 'orange' : 'blue'}>
          {type === 'exact' ? t('snomedEncoder.matchExact') : type === 'partial' ? t('snomedEncoder.matchPartial') : t('snomedEncoder.matchSuggested')}
        </Tag>
      ),
    },
    {
      title: t('snomedEncoder.colConfidence'),
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
          <Title level={4} style={{ margin: 0 }}>{t('snomedEncoder.title')}</Title>
        </Space>
        <Text type="secondary">{t('snomedEncoder.subtitle')}</Text>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t('snomedEncoder.statMatched')} value={codes.length} styles={{ content: {  color: '#2563eb'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('snomedEncoder.statExact')} value={exactCount} styles={{ content: {  color: '#52c41a'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('snomedEncoder.statPartial')} value={partialCount} styles={{ content: {  color: '#fa8c16'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('snomedEncoder.statAvgConfidence')} value={avgConfidence > 0 ? `${(avgConfidence * 100).toFixed(0)}%` : '-'} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={<Space><FileText size={14} color="#3b82f6" />{t('snomedEncoder.reportInput')}</Space>}
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<Code size={14} />}
                  onClick={handleEncode}
                  loading={loading}
                  disabled={!text.trim()}
                >
                  {loading ? t('snomedEncoder.encoding') : t('snomedEncoder.encode')}
                </Button>
                {codes.length > 0 && (
                  <Button icon={<ThumbsUp size={14} />} onClick={confirmAll}>
                    {t('snomedEncoder.confirmAllCount', { count: codes.length })}
                  </Button>
                )}
              </Space>
            }
          >
            <Input.TextArea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder={t('snomedEncoder.textPlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('snomedEncoder.charCount', { count: text.length })}
              </Text>
              {confirmed.size > 0 && (
                <Tag color="green">
                  <CheckCircle size={12} /> {t('snomedEncoder.confirmedCountLabel', { confirmed: confirmed.size, total: codes.length })}
                </Tag>
              )}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card
            title={<Space><Search size={14} color="#8b5cf6" />{t('snomedEncoder.searchTitle')}</Space>}
          >
            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onPressEnter={handleSearch}
                placeholder={t('snomedEncoder.searchPlaceholder')}
              />
              <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={searchLoading}>
                {t('snomedEncoder.search')}
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
                        message.success(t('snomedEncoder.added', { name: c.pt }))
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
              <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description={t('snomedEncoder.noTermMatch')} style={{ padding: 24 }} />
            ) : null}
          </Card>
        </Col>
      </Row>

      {codes.length > 0 && (
        <Card
          title={
            <Space>
              <AlertTriangle size={14} color="#3b82f6" />
              {t('snomedEncoder.results')}
              <Tag>{t('snomedEncoder.codeCount', { count: codes.length })}</Tag>
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
          scroll={{ x: 'max-content' }}
          />
        </Card>
      )}

      {codes.length === 0 && !loading && text && (
        <Card style={{ marginTop: 16, textAlign: 'center', padding: 40 }}>
          <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description={t('snomedEncoder.noMatch')} />
        </Card>
      )}
    </div>
  )
}

export default SnomedEncoderPage

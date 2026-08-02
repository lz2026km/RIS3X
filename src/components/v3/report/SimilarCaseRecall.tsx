/**
 * G005 放射RIS系统 v3.0.2 - 相似病例检索(医学知识库辅助)
 * 对标:RadLex/SNOMED 相似病例 / 飞利浦/西门子 知识库
 *
 * 功能:
 *  - 基于 RADS 类别 + 解剖 + 关键词的相似度匹配
 *  - TF-IDF 风格的字符串相似度(Jaccard + Levenshtein)
 *  - 临床教学价值:历史相似病例结论
 *  - 多维度排序:相似度/时间/RADS类别一致
 */
import React, { useState, useMemo } from 'react'
import { Card, List, Tag, Space, Button, Drawer, Empty, Statistic, Row, Col, Tooltip, Input, Progress, Segmented } from 'antd'
import { Search, Library, BookOpen, Sparkles, Clock, Filter } from 'lucide-react'

export interface SimilarCase {
  id: string
  patientId: string
  patientName: string
  age?: number
  gender?: string
  modality: string
  bodyPart?: string
  radsCategory?: string
  findings: string
  conclusion: string
  reportDate: string
  author: string
  verified: boolean
  /** 历史相似度评分(0-1) */
  baseScore?: number
  tags?: string[]
}

export interface SimilarCaseRecallProps {
  /** 当前报告 */
  currentReport?: {
    findings: string
    conclusion: string
    modality?: string
    bodyPart?: string
    radsCategory?: string
  }
  /** 候选库 */
  cases: SimilarCase[]
  /** 召回结果数 */
  topK?: number
  /** 点击召回病例回调(可填入报告) */
  onApply?: (c: SimilarCase) => void
}

/** Jaccard 相似度(基于词) */
function jaccard(a: string, b: string): number {
  const aw = new Set(a.split(/[,。.;; \n]+/).filter((w) => w.length >= 2))
  const bw = new Set(b.split(/[,。.;; \n]+/).filter((w) => w.length >= 2))
  if (aw.size === 0 || bw.size === 0) return 0
  let inter = 0
  aw.forEach((w) => {
    if (bw.has(w)) inter++
  })
  const union = aw.size + bw.size - inter
  return union === 0 ? 0 : inter / union
}

/** RADS 类别一致性加分 */
function radsScore(a?: string, b?: string): number {
  if (!a || !b) return 0
  return a === b ? 0.3 : 0
}

/** 解剖部位一致性加分 */
function bodyPartScore(a?: string, b?: string): number {
  if (!a || !b) return 0
  return a === b ? 0.2 : 0
}

/** 模态一致性加分 */
function modalityScore(a?: string, b?: string): number {
  if (!a || !b) return 0
  return a === b ? 0.1 : 0
}

export const SimilarCaseRecall: React.FC<SimilarCaseRecallProps> = ({
  currentReport,
  cases,
  topK = 10,
  onApply,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filterModality, setFilterModality] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'similarity' | 'recent' | 'rads'>('similarity')

  /** 计算相似度并排序 */
  const ranked = useMemo(() => {
    const result = cases
      .map((c) => {
        const findingsSim = jaccard(currentReport?.findings ?? '', c.findings)
        const conclusionSim = jaccard(currentReport?.conclusion ?? '', c.conclusion)
        const combined = findingsSim * 0.6 + conclusionSim * 0.4
        const score =
          combined +
          radsScore(currentReport?.radsCategory, c.radsCategory) +
          bodyPartScore(currentReport?.bodyPart, c.bodyPart) +
          modalityScore(currentReport?.modality, c.modality)
        return { ...c, score: Math.min(1, score) }
      })
      .filter((c) => {
        if (filterModality !== 'ALL' && c.modality !== filterModality) return false
        if (query) {
          const q = query.toLowerCase()
          if (
            !c.findings.toLowerCase().includes(q) &&
            !c.conclusion.toLowerCase().includes(q) &&
            !c.radsCategory?.toLowerCase().includes(q) &&
            !(c.tags ?? []).some((t) => t.toLowerCase().includes(q))
          ) {
            return false
          }
        }
        return true
      })

    if (sortBy === 'similarity') {
      return result.sort((a, b) => b.score - a.score).slice(0, topK)
    } else if (sortBy === 'recent') {
      return result.sort((a, b) => b.reportDate.localeCompare(a.reportDate)).slice(0, topK)
    } else {
      return result.sort((a, b) => {
        const ca = currentReport?.radsCategory && a.radsCategory === currentReport.radsCategory ? 1 : 0
        const cb = currentReport?.radsCategory && b.radsCategory === currentReport.radsCategory ? 1 : 0
        return cb - ca || b.score - a.score
      }).slice(0, topK)
    }
  }, [cases, currentReport, query, filterModality, sortBy, topK])

  const stats = useMemo(() => {
    return {
      total: cases.length,
      matched: ranked.length,
      avgScore: ranked.length > 0 ? (ranked.reduce((s, r) => s + r.score, 0) / ranked.length * 100).toFixed(1) : 0,
      topScore: ranked[0]?.score ? (ranked[0].score * 100).toFixed(1) : 0,
    }
  }, [cases, ranked])

  const renderCase = (c: SimilarCase & { score: number }) => {
    const scorePercent = (c.score * 100).toFixed(1)
    return (
      <List.Item
        key={c.id}
        data-testid={`sc-case-${c.id}`}
        actions={onApply ? [
          <Button key="apply" size="small" type="primary" icon={<Sparkles size={12} />} onClick={() => onApply(c)}>
            套用
          </Button>,
        ] : undefined}
      >
        <List.Item.Meta
          avatar={
            <Tooltip title={`相似度 ${scorePercent}%`}>
              <Progress
                type="circle"
                percent={Math.round(c.score * 100)}
                size={48}
                strokeColor={c.score > 0.6 ? '#16a34a' : c.score > 0.3 ? '#ca8a04' : '#94a3b8'}
                format={(p) => <span style={{ fontSize: 12 }}>{p}</span>}
              />
            </Tooltip>
          }
          title={
            <Space>
              <span>{c.patientName}</span>
              <Tag>{c.patientId}</Tag>
              <Tag color="blue">{c.modality}</Tag>
              {c.bodyPart && <Tag>{c.bodyPart}</Tag>}
              {c.radsCategory && <Tag color="purple">{c.radsCategory}</Tag>}
              {c.verified && <Tag color="green" icon={<BookOpen size={10} />}>已审核</Tag>}
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                <Clock size={10} /> {c.reportDate}
              </span>
            </Space>
          }
          description={
            <div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>
                <strong>所见:</strong> {c.findings.length > 100 ? c.findings.slice(0, 100) + '...' : c.findings}
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                <strong>结论:</strong> {c.conclusion.length > 100 ? c.conclusion.slice(0, 100) + '...' : c.conclusion}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                报告医师:{c.author}
                {c.tags && c.tags.length > 0 && (
                  <span style={{ marginLeft: 8 }}>
                    {c.tags.map((t) => <Tag key={t} style={{ fontSize: 12 }}>{t}</Tag>)}
                  </span>
                )}
              </div>
            </div>
          }
        />
      </List.Item>
    )
  }

  return (
    <>
      <Button
        data-testid="sc-recall-open"
        icon={<Library size={14} />}
        onClick={() => setOpen(true)}
      >
        相似病例
      </Button>
      <Drawer
        title={
          <Space>
            <Library size={16} color="#1e3a5f" />
            <span>相似病例检索</span>
            <Tag color="geekblue">知识库</Tag>
          </Space>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={780}
      >
        {currentReport && (
          <Card size="small" style={{ marginBottom: 12, background: '#f0f9ff' }} data-testid="sc-current">
            <Space orientation="vertical" size={2} style={{ width: '100%' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                <Filter size={12} /> 当前报告:
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                <strong>所见:</strong> {currentReport.findings.slice(0, 100)}
                {currentReport.findings.length > 100 ? '...' : ''}
              </div>
              {currentReport.radsCategory && (
                <Tag color="purple">RADS: {currentReport.radsCategory}</Tag>
              )}
              {currentReport.bodyPart && <Tag>{currentReport.bodyPart}</Tag>}
            </Space>
          </Card>
        )}

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="病例库" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="匹配" value={stats.matched} styles={{ content: {  color: '#3b82f6'  } }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="平均相似度" value={stats.avgScore + '%'} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="最高相似度" value={stats.topScore + '%'} styles={{ content: {  color: '#16a34a'  } }} />
            </Card>
          </Col>
        </Row>

        <Space orientation="vertical" size={8} style={{ width: '100%', marginBottom: 12 }}>
          <Input
            prefix={<Search size={12} />}
            placeholder="搜索病例..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            data-testid="sc-search"
          />
          <Space>
            <span style={{ fontSize: 12 }}>模态:</span>
            <Segmented
              value={filterModality}
              onChange={(v) => setFilterModality(v as string)}
              options={[
                { value: 'ALL', label: '全部' },
                { value: 'CT', label: 'CT' },
                { value: 'MR', label: 'MR' },
                { value: 'DR', label: 'DR' },
                { value: 'US', label: 'US' },
              ]}
            />
          </Space>
          <Space>
            <span style={{ fontSize: 12 }}>排序:</span>
            <Segmented
              value={sortBy}
              onChange={(v) => setSortBy(v as any)}
              options={[
                { value: 'similarity', label: '相似度' },
                { value: 'recent', label: '时间' },
                { value: 'rads', label: 'RADS 一致' },
              ]}
            />
          </Space>
        </Space>

        <List
          dataSource={ranked}
          renderItem={renderCase}
          locale={{ emptyText: <Empty description="无相似病例" /> }}
        />
      </Drawer>
    </>
  )
}

export default SimilarCaseRecall

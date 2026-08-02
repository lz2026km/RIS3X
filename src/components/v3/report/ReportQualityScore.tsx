/**
 * G005 放射RIS系统 v3.0.2.2 - 报告质量评分
 * 对标:ACR RadPeer / RSNA 报告质量标准
 *
 * 评分维度(100 分):
 *  - 结构化字段完整度(20)
 *  - 关键术语命中(20)
 *  - RADS 类别完整(15)
 *  - 结论清晰度(15)
 *  - 长度合理性(10)
 *  - 黑名单规避(10)
 *  - 危急值标注(5)
 *  - 审核完成(5)
 */
import React, { useState, useMemo, useCallback } from 'react'
import { Card, Tag, Space, Statistic, Row, Col, Progress, List, Tooltip, Button, Badge } from 'antd'
import { Award, TrendingUp, AlertTriangle, CheckCircle, Sparkles, FileCheck, BarChart3 } from 'lucide-react'

export interface QualityDimension {
  key: string
  label: string
  score: number
  max: number
  weight: number
  issues: string[]
}

export interface QualityEvaluation {
  id: string
  totalScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: QualityDimension[]
  evaluatedAt: string
  suggestions: string[]
}

export interface ReportQualityScoreProps {
  /** 报告内容(所见/结论/建议) */
  findings: string
  conclusion: string
  suggestion?: string
  /** RADS 类别(可选) */
  radsCategory?: string
  /** 是否包含危急值 */
  hasCritical?: boolean
  /** 是否已审核 */
  verified?: boolean
  /** 结构化字段完成度(0-1) */
  structuredCompletion?: number
  /** 自定义评分函数(可选) */
  customEvaluator?: (input: {
    findings: string
    conclusion: string
    suggestion: string
    radsCategory: string
    hasCritical: boolean
    verified: boolean
    structuredCompletion: number
  }) => QualityEvaluation
  /** 评估回调 */
  onEvaluate?: (result: QualityEvaluation) => void
}

const DEFAULT_KEYWORDS = ['正常', '未见', '清晰', '对称', '规则', '均匀']
const BLACKLIST = ['TODO', 'xxx', '...', '?', '待补充']

function defaultEvaluate(input: {
  findings: string
  conclusion: string
  suggestion: string
  radsCategory: string
  hasCritical: boolean
  verified: boolean
  structuredCompletion: number
}): QualityEvaluation {
  const dimensions: QualityDimension[] = []
  let total = 0

  // 1. 结构化字段完整度(20 分)
  const structScore = Math.round(input.structuredCompletion * 20)
  total += structScore
  dimensions.push({
    key: 'structured',
    label: '结构化字段完整度',
    score: structScore,
    max: 20,
    weight: 0.2,
    issues: input.structuredCompletion < 0.5 ? ['结构化字段缺失较多'] : input.structuredCompletion < 0.8 ? ['部分必填字段未填'] : [],
  })

  // 2. 关键术语命中(20 分)
  const hit = DEFAULT_KEYWORDS.filter((kw) => input.findings.includes(kw) || input.conclusion.includes(kw)).length
  const kwScore = Math.min(20, Math.round((hit / DEFAULT_KEYWORDS.length) * 25))
  total += kwScore
  dimensions.push({
    key: 'keywords',
    label: '关键术语命中',
    score: kwScore,
    max: 20,
    weight: 0.2,
    issues: hit < 3 ? ['关键术语过少,影响标准化'] : [],
  })

  // 3. RADS 类别完整(15 分)
  const radsScore = input.radsCategory ? 15 : 0
  total += radsScore
  dimensions.push({
    key: 'rads',
    label: 'RADS 类别标注',
    score: radsScore,
    max: 15,
    weight: 0.15,
    issues: input.radsCategory ? [] : ['建议补充 RADS 分类评估'],
  })

  // 4. 结论清晰度(15 分)— 基于结论长度与术语
  let clarityScore = 0
  if (input.conclusion.length > 10) clarityScore += 5
  if (input.conclusion.length > 30) clarityScore += 5
  if (/[。，.;；]/.test(input.conclusion)) clarityScore += 5
  total += clarityScore
  dimensions.push({
    key: 'clarity',
    label: '结论清晰度',
    score: clarityScore,
    max: 15,
    weight: 0.15,
    issues: clarityScore < 10 ? ['结论过于简短,可能不完整'] : [],
  })

  // 5. 长度合理性(10 分)
  const findingsLen = input.findings.length
  const lenScore = findingsLen < 20 ? 3 : findingsLen < 100 ? 7 : 10
  total += lenScore
  dimensions.push({
    key: 'length',
    label: '长度合理性',
    score: lenScore,
    max: 10,
    weight: 0.1,
    issues: findingsLen < 20 ? ['所见过短'] : findingsLen > 1000 ? ['所见过长'] : [],
  })

  // 6. 黑名单规避(10 分)
  const blackHit = BLACKLIST.filter((w) => input.findings.includes(w) || input.conclusion.includes(w))
  const blackScore = Math.max(0, 10 - blackHit.length * 5)
  total += blackScore
  dimensions.push({
    key: 'blacklist',
    label: '黑名单规避',
    score: blackScore,
    max: 10,
    weight: 0.1,
    issues: blackHit.length > 0 ? [`存在禁用词:${blackHit.join(',')}`] : [],
  })

  // 7. 危急值标注(5 分)
  const criticalScore = input.hasCritical ? 0 : 5 // 有危急值不扣分,但需在系统中明示
  total += criticalScore
  dimensions.push({
    key: 'critical',
    label: '危急值标注',
    score: criticalScore,
    max: 5,
    weight: 0.05,
    issues: [],
  })

  // 8. 审核完成(5 分)
  const verifyScore = input.verified ? 5 : 0
  total += verifyScore
  dimensions.push({
    key: 'verified',
    label: '审核完成',
    score: verifyScore,
    max: 5,
    weight: 0.05,
    issues: input.verified ? [] : ['报告未审核'],
  })

  // 等级
  const grade: QualityEvaluation['grade'] = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F'

  // 建议
  const suggestions: string[] = []
  dimensions.forEach((d) => {
    d.issues.forEach((i) => suggestions.push(`${d.label}:${i}`))
  })
  if (total < 70) suggestions.push('报告质量未达 C 级,建议重新撰写')

  return {
    id: 'eval-' + Date.now(),
    totalScore: total,
    grade,
    dimensions,
    evaluatedAt: new Date().toISOString(),
    suggestions,
  }
}

const GRADE_META: Record<QualityEvaluation['grade'], { color: string; label: string; icon: React.ReactNode }> = {
  A: { color: 'green', label: '优秀', icon: <Award size={14} /> },
  B: { color: 'cyan', label: '良好', icon: <FileCheck size={14} /> },
  C: { color: 'blue', label: '合格', icon: <CheckCircle size={14} /> },
  D: { color: 'orange', label: '欠佳', icon: <AlertTriangle size={14} /> },
  F: { color: 'red', label: '不合格', icon: <AlertTriangle size={14} /> },
}

export const ReportQualityScore: React.FC<ReportQualityScoreProps> = (props) => {
  const {
    findings,
    conclusion,
    suggestion = '',
    radsCategory = '',
    hasCritical = false,
    verified = false,
    structuredCompletion = 0.5,
    customEvaluator,
    onEvaluate,
  } = props

  const [history, setHistory] = useState<QualityEvaluation[]>([])

  const result = useMemo(() => {
    const evaluator = customEvaluator ?? defaultEvaluate
    return evaluator({ findings, conclusion, suggestion, radsCategory, hasCritical, verified, structuredCompletion })
  }, [findings, conclusion, suggestion, radsCategory, hasCritical, verified, structuredCompletion, customEvaluator])

  const handleEvaluate = useCallback(() => {
    setHistory((h) => [result, ...h].slice(0, 20))
    onEvaluate?.(result)
  }, [result, onEvaluate])

  const gradeMeta = GRADE_META[result.grade]

  return (
    <Card
      data-testid="report-quality-score"
      size="small"
      title={
        <Space>
          <BarChart3 size={16} color="#1e3a5f" />
          <span>报告质量评分</span>
          {history.length > 0 && <Badge count={history.length} style={{ backgroundColor: '#3b82f6' }} />}
        </Space>
      }
      extra={
        <Tooltip title="手动触发评估并记录到历史">
          <Button size="small" icon={<Sparkles size={12} />} onClick={handleEvaluate} data-testid="rqs-evaluate">
            评估
          </Button>
        </Tooltip>
      }
    >
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card size="small" style={{ background: '#f8fafc' }}>
            <Statistic
              title="总分"
              value={result.totalScore}
              suffix="/100"
              prefix={<TrendingUp size={14} color="#3b82f6" />}
              styles={{ content: {  color: result.totalScore >= 80 ? '#16a34a' : result.totalScore >= 60 ? '#ca8a04' : '#dc2626'  } }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ background: '#f8fafc' }}>
            <Statistic
              title="等级"
              valueRender={() => (
                <Tag color={gradeMeta.color} icon={gradeMeta.icon} data-testid="rqs-grade">
                  {result.grade} · {gradeMeta.label}
                </Tag>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ background: '#f8fafc' }}>
            <Statistic
              title="维度"
              value={result.dimensions.length}
              suffix="项"
              prefix={<CheckCircle size={14} />}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 12 }} data-testid="rqs-dimensions">
        {result.dimensions.map((d) => (
          <div key={d.key} style={{ marginBottom: 8 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12 }}>
                {d.label}
                <Tag style={{ marginLeft: 4, fontSize: 12 }}>{Math.round(d.weight * 100)}%</Tag>
              </span>
              <span style={{ fontSize: 12, color: d.score === d.max ? '#16a34a' : d.score >= d.max * 0.7 ? '#3b82f6' : '#dc2626' }}>
                {d.score}/{d.max}
              </span>
            </Space>
            <Progress
              percent={Math.round((d.score / d.max) * 100)}
              size="small"
              showInfo={false}
              strokeColor={d.score === d.max ? '#16a34a' : d.score >= d.max * 0.7 ? '#3b82f6' : '#dc2626'}
            />
            {d.issues.length > 0 && (
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>⚠ {d.issues.join(';')}</div>
            )}
          </div>
        ))}
      </div>

      {result.suggestions.length > 0 && (
        <div
          data-testid="rqs-suggestions"
          style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: 8 }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>改进建议:</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {result.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 12 }} data-testid="rqs-history">
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>评估历史({history.length})</div>
          <List
            size="small"
            dataSource={history.slice(0, 5)}
            renderItem={(h) => (
              <List.Item>
                <Space>
                  <Tag color={GRADE_META[h.grade].color}>{h.grade}</Tag>
                  <span style={{ fontSize: 12 }}>{h.totalScore} 分</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(h.evaluatedAt).toLocaleString()}</span>
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}
    </Card>
  )
}

export default ReportQualityScore

/**
 * G005 放射RIS系统 v3.0.2.2 - 智能报告模板选择
 * 基于模态/部位/年龄/性别/临床史 智能推荐模板
 */
import React, { useState, useMemo } from 'react'
import { Card, Tag, Space, Button, List, Empty, Statistic, Row, Col, Progress, Alert, Input } from 'antd'
import { Wand2, Sparkles, FileText, User, Target, CheckCircle, Filter, BookOpen } from 'lucide-react'
import { REPORT_TEMPLATES, getInheritanceChain, type ReportTemplate } from '@data/reportTemplates'

export interface PatientContext {
  age?: number
  gender?: 'M' | 'F' | 'O' | ''
  /** 临床史 */
  clinicalHistory?: string
  /** 影像所见关键词 */
  findingsKeywords?: string[]
}

export interface ReportTemplatedGeneratorProps {
  modality: string
  bodyPart?: string
  patient?: PatientContext
  /** 当前已选模板 id */
  selectedTemplateId?: string
  onSelect?: (template: ReportTemplate, chain: ReportTemplate[]) => void
  /** Top-K 候选 */
  topK?: number
}

interface ScoredTemplate {
  template: ReportTemplate
  score: number
  reasons: string[]
  chain: ReportTemplate[]
}

function scoreTemplate(t: ReportTemplate, modality: string, bodyPart: string, patient: PatientContext): ScoredTemplate {
  let score = 0
  const reasons: string[] = []

  // 模态匹配(40 分)
  if (t.category === modality) {
    score += 40
    reasons.push(`模态匹配:${modality}`)
  } else if (t.tags.includes(modality)) {
    score += 30
    reasons.push(`标签匹配:${modality}`)
  }

  // 部位匹配(30 分)
  if (bodyPart && t.bodyPart === bodyPart) {
    score += 30
    reasons.push(`部位匹配:${bodyPart}`)
  }

  // 关键术语命中(20 分)
  if (patient.findingsKeywords) {
    const hit = t.tags.filter((tag) => patient.findingsKeywords!.some((k) => tag.includes(k) || k.includes(tag))).length
    if (hit > 0) {
      score += Math.min(20, hit * 7)
      reasons.push(`术语命中:${hit} 个`)
    }
  }

  // 临床史(10 分)
  if (patient.clinicalHistory) {
    const lower = patient.clinicalHistory.toLowerCase()
    if (lower.includes('routine') || lower.includes('常规')) {
      // 常规检查
      if (t.tags.includes('common') || t.tags.includes('routine')) {
        score += 5
      }
    }
  }

  // 年龄/性别特殊模板
  if (patient.age !== undefined && patient.age < 18 && t.tags.includes('pediatric')) {
    score += 5
    reasons.push('儿童专用')
  }

  return { template: t, score, reasons, chain: getInheritanceChain(t.id) }
}

export const ReportTemplatedGenerator: React.FC<ReportTemplatedGeneratorProps> = ({
  modality,
  bodyPart = '',
  patient = {},
  selectedTemplateId,
  onSelect,
  topK = 5,
}) => {
  const [filterKw, setFilterKw] = useState('')

  const candidates = useMemo<ScoredTemplate[]>(() => {
    const all = REPORT_TEMPLATES.map((t) => scoreTemplate(t, modality, bodyPart, patient))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
    if (filterKw) {
      const q = filterKw.toLowerCase()
      return all.filter(
        (s) => s.template.name.toLowerCase().includes(q) || s.template.body.toLowerCase().includes(q)
      )
    }
    return all
  }, [modality, bodyPart, patient, filterKw, topK])

  const top = candidates[0]

  return (
    <Card
      data-testid="report-templated-generator"
      size="small"
      title={
        <Space>
          <Wand2 size={16} color="#722ed1" />
          <span>智能模板推荐</span>
          <Tag color="geekblue">{modality}</Tag>
          {bodyPart && <Tag>{bodyPart}</Tag>}
        </Space>
      }
    >
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic
            title="候选模板"
            value={candidates.length}
            prefix={<FileText size={14} />}
            styles={{ content: {  fontSize: 16  } }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="最佳匹配分"
            value={top ? top.score : 0}
            suffix="/100"
            prefix={<Sparkles size={14} color="#722ed1" />}
            styles={{ content: {  fontSize: 16, color: top && top.score >= 70 ? '#16a34a' : '#ca8a04'  } }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="部位"
            value={bodyPart || '未指定'}
            prefix={<Target size={14} />}
            styles={{ content: {  fontSize: 16  } }}
          />
        </Col>
      </Row>

      <Input
        prefix={<Filter size={12} />}
        placeholder="过滤模板名/正文..."
        value={filterKw}
        onChange={(e) => setFilterKw(e.target.value)}
        allowClear
        style={{ marginBottom: 8 }}
        data-testid="rtg-filter"
      />

      {patient.age !== undefined && (
        <Alert
          type="info"
          showIcon
          icon={<User size={12} />}
          message={`患者:${patient.gender === 'M' ? '男' : patient.gender === 'F' ? '女' : '其他'}/${patient.age}岁`}
          style={{ marginBottom: 8 }}
        />
      )}

      {candidates.length === 0 ? (
        <Empty description="无候选模板" />
      ) : (
        <List
          size="small"
          dataSource={candidates}
          renderItem={(c) => {
            const isTop = top?.template.id === c.template.id
            const isSelected = selectedTemplateId === c.template.id
            return (
              <List.Item
                key={c.template.id}
                data-testid={`rtg-item-${c.template.id}`}
                actions={[
                  <Button
                    key="select"
                    size="small"
                    type={isSelected ? 'primary' : 'default'}
                    icon={isSelected ? <CheckCircle size={12} /> : <Wand2 size={12} />}
                    onClick={() => onSelect?.(c.template, c.chain)}
                    data-testid={`rtg-select-${c.template.id}`}
                  >
                    {isSelected ? '已选' : '选用'}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {isTop && <Tag color="magenta" icon={<Sparkles size={10} />}>Top</Tag>}
                      <span style={{ fontSize: 13 }}>{c.template.name}</span>
                      <Tag color="blue">{c.template.category}</Tag>
                      {c.template.bodyPart && <Tag>{c.template.bodyPart}</Tag>}
                      {c.template.radsCategory && <Tag color="purple">{c.template.radsCategory}</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <Progress
                        percent={c.score}
                        size="small"
                        showInfo={false}
                        strokeColor={c.score >= 70 ? '#16a34a' : c.score >= 50 ? '#3b82f6' : '#ca8a04'}
                      />
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                        {c.reasons.map((r, i) => <Tag key={i} style={{ fontSize: 12 }}>{r}</Tag>)}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        父模板链:{c.chain.map((p) => p.name).join(' → ')}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}

      {top && (
        <div
          data-testid="rtg-top-preview"
          style={{ marginTop: 12, padding: 8, background: '#f0f9ff', borderRadius: 4 }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            <BookOpen size={12} /> 最佳预览:{top.template.name}
          </div>
          <div style={{ fontSize: 12, color: '#475569', maxHeight: 100, overflow: 'auto' }}>
            {top.template.body.slice(0, 200)}
            {top.template.body.length > 200 ? '...' : ''}
          </div>
        </div>
      )}
    </Card>
  )
}

export default ReportTemplatedGenerator

/**
 * G005 放射RIS系统 v3.0.2 - 患者合并 / MPI 匹配
 * 对标:HIS MPI 重复患者检测
 */
import { Card, Tag, Space, Button, Input, Modal, Empty, Statistic, Row, Col, Progress, Alert, Radio } from 'antd'
import { UserCheck, UserMinus, Search, GitMerge, Phone, IdCard, Calendar, GitCompare } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { Inbox } from 'lucide-react'

export interface PatientCandidate {
  id: string
  name: string
  gender: 'M' | 'F' | 'O'
  birthDate: string
  age: number
  idCard?: string
  phone?: string
  address?: string
  lastVisit?: string
  visitCount: number
}

export interface PatientDuplicateMatch {
  /** 候选 1(通常是新患者) */
  source: PatientCandidate
  /** 候选 2(疑似重复) */
  match: PatientCandidate
  /** 综合匹配度 0-100 */
  score: number
  /** 各项指标 */
  nameScore: number
  idCardScore: number
  phoneScore: number
  birthDateScore: number
  genderScore: number
  addressScore: number
  /** 匹配因素 */
  matchedFields: string[]
}

export interface PatientMergeToolProps {
  duplicates: PatientDuplicateMatch[]
  onMerge?: (keepId: string, removeId: string) => void
  onDismiss?: (sourceId: string, matchId: string) => void
  threshold?: number
}

(a: string, b: string): number => {
  if (a === b) return 100
  if (a.length === 0 || b.length === 0) return 0
  // Levenshtein 简化
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  const dist = dp[a.length][b.length]
  return Math.max(0, 100 - Math.floor((dist / Math.max(a.length, b.length)) * 100))
};







export const PatientMergeTool: React.FC<PatientMergeToolProps> = ({
  duplicates,
  onMerge,
  onDismiss,
  threshold = 70,
}) => {
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<PatientDuplicateMatch | null>(null)
  const [keepId, setKeepId] = useState<string>('')

  const filtered = useMemo(() => {
    if (!search) return duplicates.filter((d) => d.score >= threshold)
    const q = search.toLowerCase()
    return duplicates.filter(
      (d) =>
        (d.score >= threshold && (d.source.name.toLowerCase().includes(q) || d.match.name.toLowerCase().includes(q) || d.source.id.includes(q) || d.match.id.includes(q)))
    )
  }, [duplicates, search, threshold])

  const stats = useMemo(() => {
    return {
      total: duplicates.length,
      highRisk: duplicates.filter((d) => d.score >= 80).length,
      mediumRisk: duplicates.filter((d) => d.score >= 60 && d.score < 80).length,
      lowRisk: duplicates.filter((d) => d.score < 60).length,
    }
  }, [duplicates])

  const renderCandidate = (c: PatientCandidate, role: 'source' | 'match') => (
    <Card
      size="small"
      title={
        <Space>
          {role === 'source' ? <GitMerge size={14} /> : <GitCompare size={14} />}
          <span>{c.name}</span>
          <Tag color={c.gender === 'M' ? 'blue' : c.gender === 'F' ? 'pink' : 'default'}>{c.gender === 'M' ? '男' : c.gender === 'F' ? '女' : '其他'}</Tag>
          <Tag>{c.age}岁</Tag>
        </Space>
      }
      style={{ background: role === 'source' ? '#eff6ff' : '#fef3c7' }}
      data-testid={`merge-${role}-${c.id}`}
    >
      <Space orientation="vertical" size={2} style={{ width: '100%' }}>
        <div style={{ fontSize: 12 }}><IdCard size={10} /> {c.idCard ?? '-'}</div>
        <div style={{ fontSize: 12 }}><Phone size={10} /> {c.phone ?? '-'}</div>
        <div style={{ fontSize: 12 }}><Calendar size={10} /> {c.birthDate}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>就诊 {c.visitCount} 次 · 最近 {c.lastVisit ?? '-'}</div>
      </Space>
    </Card>
  )

  return (
    <div data-testid="patient-merge-tool">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic title="重复候选" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="高风险(≥80)" value={stats.highRisk} styles={{ content: {  color: '#dc2626'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="中风险(60-79)" value={stats.mediumRisk} styles={{ content: {  color: '#ca8a04'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="低风险(<60)" value={stats.lowRisk} />
          </Card>
        </Col>
      </Row>

      <Input
        prefix={<Search size={12} />}
        placeholder="搜索患者姓名 / ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
        data-testid="merge-search"
      />

      {filtered.length === 0 ? (
        <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无重复患者" />
      ) : (
        filtered.map((d, idx) => (
          <Card
            key={idx}
            size="small"
            style={{ marginBottom: 12, borderColor: d.score >= 80 ? '#dc2626' : '#fcd34d' }}
            data-testid={`merge-row-${idx}`}
            title={
              <Space>
                <Tag color={d.score >= 80 ? 'red' : 'orange'} data-testid={`merge-score-${idx}`}>
                  匹配度 {d.score}%
                </Tag>
                <Progress percent={d.score} size="small" showInfo={false} style={{ width: 100 }} strokeColor={d.score >= 80 ? '#dc2626' : '#ca8a04'} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  匹配项:{d.matchedFields.join('、')}
                </span>
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  type="text"
                  onClick={() => {
                    setConfirm(d)
                    setKeepId(d.source.id)
                  }}
                  icon={<UserCheck size={12} />}
                  data-testid={`merge-confirm-${idx}`}
                >
                  合并
                </Button>
                <Button
                  size="small"
                  type="text"
                  danger
                  onClick={() => onDismiss?.(d.source.id, d.match.id)}
                  icon={<UserMinus size={12} />}
                  data-testid={`merge-dismiss-${idx}`}
                >
                  忽略
                </Button>
              </Space>
            }
          >
            <Row gutter={12}>
              <Col span={11}>{renderCandidate(d.source, 'source')}</Col>
              <Col span={2} style={{ textAlign: 'center', alignSelf: 'center' }}>
                <Tag color="blue" style={{ fontSize: 16 }}>VS</Tag>
              </Col>
              <Col span={11}>{renderCandidate(d.match, 'match')}</Col>
            </Row>
            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
              姓名 {d.nameScore}% · 身份证 {d.idCardScore}% · 电话 {d.phoneScore}% · 出生 {d.birthDateScore}% · 性别 {d.genderScore}% · 地址 {d.addressScore}%
            </div>
          </Card>
        ))
      )}

      <Modal
        title="确认合并"
        open={!!confirm}
        onCancel={() => setConfirm(null)}
        onOk={() => {
          if (confirm && keepId) {
            const removeId = keepId === confirm.source.id ? confirm.match.id : confirm.source.id
            onMerge?.(keepId, removeId)
            setConfirm(null)
          }
        }}
        data-testid="merge-confirm-modal"
      >
        {confirm && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              title={`合并将保留 1 位患者档案,另 1 位 ${keepId === confirm.source.id ? '匹配' : '源'}将被归档。所有检查/报告将迁移到保留档案。`}
            />
            <div>
              <strong>保留档案:</strong>
              <Radio.Group value={keepId} onChange={(e) => setKeepId(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <Radio value={confirm.source.id}>
                  {confirm.source.name} ({confirm.source.id}) - {confirm.source.visitCount} 次就诊
                </Radio>
                <Radio value={confirm.match.id}>
                  {confirm.match.name} ({confirm.match.id}) - {confirm.match.visitCount} 次就诊
                </Radio>
              </Radio.Group>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default PatientMergeTool

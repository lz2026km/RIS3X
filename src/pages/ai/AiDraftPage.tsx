import React, { useState, useCallback, useEffect } from 'react'
import { Card, Select, Button, Space, Tag, Typography, Input, message, Spin, Tooltip, Empty } from 'antd'
import { Brain, Check, X, Edit3, FileText, RefreshCw, Plus, User, Activity, Layout } from 'lucide-react'
import { v3AiDraftApi, type AiDraftMeta, type AiDraftParagraph, type AiDraftResult, type DraftTemplate } from '../../services/api/v3Api'
import { patientExamApi, type PatientInfo, type ExamInfo } from '../../services/api/patientExamApi'

const { Text, Title } = Typography
const { TextArea } = Input

const AiDraftPage: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [selectedExam, setSelectedExam] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [draftResult, setDraftResult] = useState<AiDraftResult | null>(null)
  const [editingParagraph, setEditingParagraph] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [continuePrompt, setContinuePrompt] = useState('')
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriteTarget, setRewriteTarget] = useState<string | null>(null)
  const [templates, setTemplates] = useState<DraftTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [patients, setPatients] = useState<PatientInfo[]>([])
  const [exams, setExams] = useState<ExamInfo[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [examsLoading, setExamsLoading] = useState(false)

  const currentExam = exams.find(e => e.id === selectedExam)
  const currentPatient = patients.find(p => p.id === selectedPatient)
  const patientExams = exams.filter(e => e.patientId === selectedPatient)

  useEffect(() => {
    setPatientsLoading(true)
    patientExamApi.getPatients().then(res => {
      if (res.success && Array.isArray(res.data)) {
        setPatients(res.data)
      }
    }).finally(() => setPatientsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedPatient) {
      setExams([])
      return
    }
    setExamsLoading(true)
    patientExamApi.getExams(selectedPatient).then(res => {
      if (res.success && Array.isArray(res.data)) {
        setExams(res.data)
      }
    }).finally(() => setExamsLoading(false))
  }, [selectedPatient])

  useEffect(() => {
    setTemplatesLoading(true)
    v3AiDraftApi.getTemplates(currentExam?.modality).then(res => {
      if (res.success && res.data?.templates) {
        setTemplates(res.data.templates)
      }
    }).finally(() => setTemplatesLoading(false))
  }, [currentExam?.modality])

  const buildMeta = useCallback((): AiDraftMeta => ({
    patientId: selectedPatient ?? '',
    patientName: currentPatient?.name,
    modality: currentExam?.modality ?? 'CT',
    bodyPart: currentExam?.bodyPart ?? '胸部',
  }), [selectedPatient, currentPatient, currentExam])

  const handleGenerate = useCallback(async () => {
    if (!selectedExam) { message.warning('请选择检查'); return }
    setGenerating(true)
    setDraftResult(null)
    try {
      const res = await v3AiDraftApi.draft(buildMeta())
      if (res.success && res.data) {
        setDraftResult(res.data)
      } else {
        message.error(res.error?.message || '生成失败')
      }
    } catch {
      message.error('生成请求失败')
    } finally {
      setGenerating(false)
    }
  }, [selectedExam, buildMeta])

  const handleContinue = useCallback(async () => {
    if (!continuePrompt.trim()) { message.warning('请输入续写提示'); return }
    setGenerating(true)
    try {
      const existingContent = draftResult?.paragraphs.map(p => `## ${p.heading}\n${p.content}`).join('\n\n') ?? ''
      const res = await v3AiDraftApi.continueDraft(buildMeta(), existingContent + '\n\n' + continuePrompt)
      if (res.success && res.data && draftResult) {
        setDraftResult({
          ...res.data,
          paragraphs: [...draftResult.paragraphs, ...res.data.paragraphs],
        })
      } else {
        message.error(res.error?.message || '续写失败')
      }
    } catch {
      message.error('续写请求失败')
    } finally {
      setContinuePrompt('')
      setGenerating(false)
    }
  }, [continuePrompt, draftResult, buildMeta])

  const handleRewrite = useCallback(async () => {
    if (!rewriteTarget || !rewriteInstruction.trim()) { message.warning('请选择要改写的段落并输入指令'); return }
    setGenerating(true)
    try {
      const targetParagraph = draftResult?.paragraphs.find(p => p.id === rewriteTarget)
      const res = await v3AiDraftApi.rewriteDraft(buildMeta(), targetParagraph?.content ?? '', rewriteInstruction)
      if (res.success && res.data && draftResult) {
        const rewritten = res.data.paragraphs[0] ?? { content: '', confidence: 0 }
        const newParagraphs = draftResult.paragraphs.map(p =>
          p.id === rewriteTarget
            ? { ...p, content: rewritten.content, confidence: rewritten.confidence }
            : p,
        )
        setDraftResult({ ...draftResult, paragraphs: newParagraphs })
      } else {
        message.error(res.error?.message || '改写失败')
      }
    } catch {
      message.error('改写请求失败')
    } finally {
      setRewriteInstruction('')
      setRewriteTarget(null)
      setGenerating(false)
    }
  }, [rewriteTarget, rewriteInstruction, draftResult, buildMeta])

  const handleAccept = (id: string) => {
    message.success(`已接受段落`)
  }

  const handleReject = (id: string) => {
    if (draftResult) {
      setDraftResult({ ...draftResult, paragraphs: draftResult.paragraphs.filter(p => p.id !== id) })
      message.info('已拒绝段落')
    }
  }

  const handleEdit = (paragraph: AiDraftParagraph) => {
    setEditingParagraph(paragraph.id)
    setEditContent(paragraph.content)
  }

  const handleSaveEdit = () => {
    if (draftResult && editingParagraph) {
      const newParagraphs = draftResult.paragraphs.map(p =>
        p.id === editingParagraph ? { ...p, content: editContent } : p,
      )
      setDraftResult({ ...draftResult, paragraphs: newParagraphs })
      setEditingParagraph(null)
      message.success('已保存修改')
    }
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Brain size={24} color="#7c3aed" />
          <Title level={4} style={{ margin: 0 }}>AI 报告草稿（多模态段落生成）</Title>
          {draftResult && <Tag color="purple">置信度 {(draftResult.overallConfidence * 100).toFixed(0)}%</Tag>}
        </Space>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}><User size={12} /> 患者</Text>
            <Select
              style={{ width: 220 }}
              placeholder="选择患者"
              value={selectedPatient}
              onChange={v => { setSelectedPatient(v); setSelectedExam(null); setDraftResult(null) }}
              options={patients.map(p => ({ label: `${p.name} (${p.gender}/${p.age})`, value: p.id }))}
              loading={patientsLoading}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}><Activity size={12} /> 检查</Text>
            <Select
              style={{ width: 300 }}
              placeholder="选择检查"
              value={selectedExam}
              onChange={v => { setSelectedExam(v); setDraftResult(null) }}
              options={patientExams.map(e => ({ label: `${e.description} · ${e.date}`, value: e.id }))}
              disabled={!selectedPatient}
              loading={examsLoading}
            />
          </div>
          {currentExam && (
            <div style={{ padding: '4px 12px', background: '#f0f5ff', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={14} color="#1677ff" />
              <span style={{ fontSize: 13 }}>{currentExam.modality} · {currentExam.bodyPart}</span>
            </div>
          )}
        </div>

        <Space>
          <Button type="primary" icon={<Brain size={14} />} onClick={handleGenerate} loading={generating} disabled={!selectedExam}>
            生成 AI 草稿
          </Button>
        </Space>
      </Card>

      {templates.length > 0 && (
        <Card
          title={<Space><Layout size={14} color="#7c3aed" />草稿模板</Space>}
          size="small"
          style={{ marginBottom: 16 }}
          loading={templatesLoading}
        >
          <Space wrap>
            {templates.map(t => (
              <Tag key={t.id} color="purple" style={{ cursor: 'pointer', padding: '4px 8px' }}>
                {t.name} ({t.modality})
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {generating && (
        <Card style={{ marginBottom: 16, textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#7c3aed', fontWeight: 600 }}>AI 正在生成报告段落...</div>
        </Card>
      )}

      {draftResult && !generating && (
        <Card
          title={<Space><Brain size={16} color="#7c3aed" />AI 生成的段落</Space>}
          extra={
            <Space>
              <Tag color="default">模型: {draftResult.modelVersion}</Tag>
              <Button size="small" icon={<RefreshCw size={12} />} onClick={handleGenerate}>重新生成</Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {draftResult.paragraphs.map((p, idx) => (
            <div key={p.id} style={{
              marginBottom: 12, padding: 12, border: '1px solid #e8e8e8', borderRadius: 6,
              background: editingParagraph === p.id ? '#fffbe6' : '#fafafa',
              borderLeft: `3px solid ${idx === 0 ? '#1677ff' : idx === 1 ? '#52c41a' : idx === 2 ? '#faad14' : '#722ed1'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Space>
                  <Text strong style={{ fontSize: 13 }}>{p.heading}</Text>
                  <Tag color="purple" style={{ fontSize: 11 }}>{(p.confidence * 100).toFixed(0)}%</Tag>
                </Space>
                <Space>
                  <Tooltip title="接受"><Button size="small" type="text" icon={<Check size={14} color="#52c41a" />} onClick={() => handleAccept(p.id)} /></Tooltip>
                  <Tooltip title="修改"><Button size="small" type="text" icon={<Edit3 size={14} color="#1677ff" />} onClick={() => handleEdit(p)} /></Tooltip>
                  <Tooltip title="拒绝"><Button size="small" type="text" icon={<X size={14} color="#ff4d4f" />} onClick={() => handleReject(p.id)} /></Tooltip>
                </Space>
              </div>
              {editingParagraph === p.id ? (
                <div>
                  <TextArea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} style={{ fontSize: 13 }} />
                  <Space style={{ marginTop: 6 }}>
                    <Button size="small" type="primary" onClick={handleSaveEdit}>保存</Button>
                    <Button size="small" onClick={() => setEditingParagraph(null)}>取消</Button>
                  </Space>
                </div>
              ) : (
                <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{p.content}</Text>
              )}
            </div>
          ))}
        </Card>
      )}

      {draftResult && !generating && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Card size="small" title={<Space><Plus size={14} />续写</Space>} style={{ flex: 1, minWidth: 300 }}>
            <TextArea value={continuePrompt} onChange={e => setContinuePrompt(e.target.value)} placeholder="输入续写提示，如：补充与既往对比" rows={2} style={{ marginBottom: 8 }} />
            <Button size="small" type="primary" icon={<Plus size={12} />} onClick={handleContinue} loading={generating}>续写</Button>
          </Card>
          <Card size="small" title={<Space><Edit3 size={14} />改写</Space>} style={{ flex: 1, minWidth: 300 }}>
            <Select
              style={{ width: '100%', marginBottom: 8 }}
              placeholder="选择要改写的段落"
              value={rewriteTarget}
              onChange={setRewriteTarget}
              options={draftResult.paragraphs.map(p => ({ label: p.heading, value: p.id }))}
            />
            <TextArea value={rewriteInstruction} onChange={e => setRewriteInstruction(e.target.value)} placeholder="改写指令，如：改用更专业的描述" rows={2} style={{ marginBottom: 8 }} />
            <Button size="small" type="primary" icon={<RefreshCw size={12} />} onClick={handleRewrite} loading={generating}>改写</Button>
          </Card>
        </div>
      )}

      {draftResult && !generating && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button icon={<Check size={14} />} type="primary" onClick={() => message.warning('功能建设中')}>
            全部接受并提交
          </Button>
          <Button icon={<X size={14} />} onClick={() => { setDraftResult(null); message.info('已清空') }}>
            全部拒绝
          </Button>
        </div>
      )}
    </div>
  )
}

export default AiDraftPage

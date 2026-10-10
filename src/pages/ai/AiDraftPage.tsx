import React, { useState, useCallback, useEffect } from 'react'
import { Card, Select, Button, Space, Tag, Typography, Input, message, Spin, Tooltip } from 'antd'
import { Brain, Check, X, Edit3, FileText, RefreshCw, Plus, User, Activity, Layout, Save } from 'lucide-react'
import { v3AiDraftApi, type AiDraftMeta, type AiDraftParagraph, type AiDraftResult, type DraftTemplate } from '../../services/api/v3Api'
import { patientExamApi, type PatientInfo, type ExamInfo } from '../../services/api/patientExamApi'
import { reportApi } from '../../services/api/reportApi'
import { t } from '../../i18n/appI18n'
import { PageContainer } from '../../components/common'

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
  const [acceptedIds, setAcceptedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

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
    if (!selectedExam) { message.warning(t('aiDraft.selectExam')); return }
    setGenerating(true)
    setDraftResult(null)
    try {
      const res = await v3AiDraftApi.draft(buildMeta())
      if (res.success && res.data) {
        setDraftResult(res.data)
      } else {
        message.error(res.error?.message || t('aiDraft.generateFailed'))
      }
    } catch (err) { console.error('[AiDraft] generate failed:', err); message.error(t('aiDraft.generateRequestFailed')) } finally {
      setGenerating(false)
    }
  }, [selectedExam, buildMeta])

  const handleContinue = useCallback(async () => {
    if (!continuePrompt.trim()) { message.warning(t('aiDraft.enterContinuePrompt')); return }
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
        message.error(res.error?.message || t('aiDraft.continueFailed'))
      }
    } catch (err) { console.error('[AiDraft] continue failed:', err); message.error(t('aiDraft.continueRequestFailed')) } finally {
      setContinuePrompt('')
      setGenerating(false)
    }
  }, [continuePrompt, draftResult, buildMeta])

  const handleRewrite = useCallback(async () => {
    if (!rewriteTarget || !rewriteInstruction.trim()) { message.warning(t('aiDraft.selectRewrite')); return }
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
        message.error(res.error?.message || t('aiDraft.rewriteFailed'))
      }
    } catch (err) { console.error('[AiDraft] rewrite failed:', err); message.error(t('aiDraft.rewriteRequestFailed')) } finally {
      setRewriteInstruction('')
      setRewriteTarget(null)
      setGenerating(false)
    }
  }, [rewriteTarget, rewriteInstruction, draftResult, buildMeta])

  const handleAccept = (id: string) => {
    setAcceptedIds(prev => prev.includes(id) ? prev : [...prev, id])
    message.success(t('w9d.aiDraft.paragraphAccepted'))
  }

  const handleReject = (id: string) => {
    if (draftResult) {
      setDraftResult({ ...draftResult, paragraphs: draftResult.paragraphs.filter(p => p.id !== id) })
      setAcceptedIds(prev => prev.filter(x => x !== id))
      message.info(t('aiDraft.rejected'))
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
      message.success(t('aiDraft.saved'))
    }
  }

  // 全部接受并提交：接受所有段落 → 生成报告文本 → 写入报告（POST /reports）→ 提交过渡
  const handleAcceptAll = useCallback(async () => {
    if (!draftResult || draftResult.paragraphs.length === 0) return
    if (!selectedExam) { message.warning(t('aiDraft.selectExam')); return }
    const paragraphs = draftResult.paragraphs
    setAcceptedIds(paragraphs.map(p => p.id))
    const reportText = paragraphs.map(p => `## ${p.heading}\n${p.content}`).join('\n\n')
    setSubmitting(true)
    try {
      const res = await reportApi.create({
        reportId: `RPT-AI-${Date.now()}`,
        patientId: selectedPatient ?? '',
        patientName: currentPatient?.name,
        examId: selectedExam,
        modality: currentExam?.modality,
        bodyPart: currentExam?.bodyPart,
        findings: reportText,
        impression: paragraphs.find(p => p.heading.includes('结论') || p.heading.includes('印象'))?.content ?? '',
        radiologistId: 'AI 辅助',
      })
      if (res.success) {
        message.success(t('w9d.aiDraft.reportSubmitted', { count: reportText.length }))
        setDraftResult(null)
        setAcceptedIds([])
      } else {
        message.error(res.error?.message || t('aiDraft.submitFailed'))
      }
    } catch (err) {
      console.error('[AiDraft] submit failed:', err)
      message.error(t('aiDraft.submitRequestFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [draftResult, selectedExam, selectedPatient, currentExam])

  return (
    <PageContainer padding={24}>
      <Card style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <Brain size={24} color="#7c3aed" />
          <Title level={4} style={{ margin: 0 }}>{t('aiDraft.title')}</Title>
          {draftResult && <Tag color="purple">{t('aiDraft.confidence')} {(draftResult.overallConfidence * 100).toFixed(0)}%</Tag>}
        </Space>

        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap', marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--space-1, 4px)' }}><User size={12} /> {t('aiDraft.patient')}</Text>
            <Select
              style={{ width: 220 }}
              placeholder={t('aiDraft.selectPatient')}
              value={selectedPatient}
              onChange={v => { setSelectedPatient(v); setSelectedExam(null); setDraftResult(null) }}
              options={patients.map(p => ({ label: `${p.name} (${p.gender}/${p.age})`, value: p.id }))}
              loading={patientsLoading}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--space-1, 4px)' }}><Activity size={12} /> {t('aiDraft.exam')}</Text>
            <Select
              style={{ width: 300 }}
              placeholder={t('aiDraft.selectExamPlaceholder')}
              value={selectedExam}
              onChange={v => { setSelectedExam(v); setDraftResult(null) }}
              options={patientExams.map(e => ({ label: `${e.description} · ${e.date}`, value: e.id }))}
              disabled={!selectedPatient}
              loading={examsLoading}
            />
          </div>
          {currentExam && (
            <div style={{ padding: '4px 12px', background: '#f0f5ff', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <FileText size={14} color="var(--color-primary-600)" />
              <span style={{ fontSize: 12 }}>{currentExam.modality} · {currentExam.bodyPart}</span>
            </div>
          )}
        </div>

        <Space>
          <Button type="primary" icon={<Brain size={14} />} onClick={handleGenerate} loading={generating} disabled={!selectedExam}>
            {t('aiDraft.generate')}
          </Button>
        </Space>
      </Card>

      {templates.length > 0 && (
        <Card
          title={<Space><Layout size={14} color="#7c3aed" />{t('aiDraft.templates')}</Space>}
          size="small"
          style={{ marginBottom: 'var(--space-4, 16px)' }}
          loading={templatesLoading}
        >
          <Space wrap>
            {templates.map(tpl => (
              <Tag key={tpl.id} color="purple" style={{ cursor: 'pointer', padding: '4px 8px' }}>
                {tpl.name} ({tpl.modality})
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {generating && (
        <Card style={{ marginBottom: 'var(--space-4, 16px)', textAlign: 'center', padding: 'var(--space-10, 40px)' }}>
          <Spin size="large" />
          <div style={{ marginTop: 'var(--space-3, 12px)', color: '#7c3aed', fontWeight: 600 }}>{t('aiDraft.generating')}</div>
        </Card>
      )}

      {draftResult && !generating && (
        <Card
          title={<Space><Brain size={16} color="#7c3aed" />{t('aiDraft.generatedParagraphs')}</Space>}
          extra={
            <Space>
              <Tag color="default">{t('aiDraft.model')}: {draftResult.modelVersion}</Tag>
              <Button size="small" icon={<RefreshCw size={12} />} onClick={handleGenerate}>{t('aiDraft.regenerate')}</Button>
            </Space>
          }
          style={{ marginBottom: 'var(--space-4, 16px)' }}
        >
          {draftResult.paragraphs.map((p, idx) => (
            <div key={p.id} style={{
              marginBottom: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)', borderRadius: 6,
              background: editingParagraph === p.id ? 'var(--color-warning-bg)' : 'var(--bg-card)',
              borderLeft: `3px solid ${idx === 0 ? 'var(--color-primary-600)' : idx === 1 ? '#52c41a' : idx === 2 ? '#faad14' : '#722ed1'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Space>
                  <Text strong style={{ fontSize: 12 }}>{p.heading}</Text>
                  <Tag color="purple" style={{ fontSize: 11 }}>{(p.confidence * 100).toFixed(0)}%</Tag>
                </Space>
                <Space>
                  <Tooltip title={t('aiDraft.accept')}><Button aria-label="确认" size="small" type={acceptedIds.includes(p.id) ? 'primary' : 'text'} icon={<Check size={14} color={acceptedIds.includes(p.id) ? '#fff' : '#52c41a'} />} onClick={() => handleAccept(p.id)} /></Tooltip>
                  <Tooltip title={t('aiDraft.edit')}><Button aria-label="编辑" size="small" type="text" icon={<Edit3 size={14} color="var(--color-primary-600)" />} onClick={() => handleEdit(p)} /></Tooltip>
                  <Tooltip title={t('aiDraft.reject')}><Button aria-label="关闭" size="small" type="text" icon={<X size={14} color="#ff4d4f" />} onClick={() => handleReject(p.id)} /></Tooltip>
                </Space>
              </div>
              {editingParagraph === p.id ? (
                <div>
                  <TextArea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} style={{ fontSize: 12 }} />
                  <Space style={{ marginTop: 6 }}>
                    <Button size="small" type="primary" icon={<Save size={12} />} onClick={handleSaveEdit}>{t('aiDraft.save')}</Button>
                    <Button size="small" onClick={() => setEditingParagraph(null)}>{t('aiDraft.cancel')}</Button>
                  </Space>
                </div>
              ) : (
                <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{p.content}</Text>
              )}
            </div>
          ))}
        </Card>
      )}

      {draftResult && !generating && (
        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap' }}>
          <Card size="small" title={<Space><Plus size={14} />{t('aiDraft.continue')}</Space>} style={{ flex: 1, minWidth: 300 }}>
            <TextArea value={continuePrompt} onChange={e => setContinuePrompt(e.target.value)} placeholder={t('aiDraft.continuePlaceholder')} rows={2} style={{ marginBottom: 'var(--space-2, 8px)' }} />
            <Button size="small" type="primary" icon={<Plus size={12} />} onClick={handleContinue} loading={generating}>{t('aiDraft.continue')}</Button>
          </Card>
          <Card size="small" title={<Space><Edit3 size={14} />{t('aiDraft.rewrite')}</Space>} style={{ flex: 1, minWidth: 300 }}>
            <Select
              style={{ width: '100%', marginBottom: 'var(--space-2, 8px)' }}
              placeholder={t('aiDraft.selectRewritePlaceholder')}
              value={rewriteTarget}
              onChange={setRewriteTarget}
              options={draftResult.paragraphs.map(p => ({ label: p.heading, value: p.id }))}
            />
            <TextArea value={rewriteInstruction} onChange={e => setRewriteInstruction(e.target.value)} placeholder={t('aiDraft.rewritePlaceholder')} rows={2} style={{ marginBottom: 'var(--space-2, 8px)' }} />
            <Button size="small" type="primary" icon={<RefreshCw size={12} />} onClick={handleRewrite} loading={generating}>{t('aiDraft.rewrite')}</Button>
          </Card>
        </div>
      )}

      {draftResult && !generating && (
        <div style={{ marginTop: 'var(--space-4, 16px)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2, 8px)' }}>
          <Button icon={<Check size={14} />} type="primary" onClick={() => void handleAcceptAll()} loading={submitting}>
            {t('aiDraft.acceptAll')}
          </Button>
          <Button icon={<X size={14} />} onClick={() => { setDraftResult(null); setAcceptedIds([]); message.info(t('aiDraft.cleared')) }}>
            {t('aiDraft.rejectAll')}
          </Button>
        </div>
      )}
    </PageContainer>
  )
}

export default AiDraftPage

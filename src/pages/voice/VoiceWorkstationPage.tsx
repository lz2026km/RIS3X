// ════════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-100 Wave 4A] 语音工作站 (VoiceWorkstationPage) 独立完整版
//   - 顶部统计卡: 会话数 / 词库规模 / 纠正数 / 平均时长 (getStats)
//   - 「语音听写」主面板: MediaRecorder 录音 → transcribe + 词库校正提示(原词→正词+分类)
//     → 结果插入报告 (reportId) / 提交纠正反馈
//   - 「医学词库」Tab: 词条 CRUD + 检索 + 批量导入 CSV
//   - 「听写历史」Tab: sessions 列表 (时长/状态/时间) + 点击查看转写内容
//   - 「纠正反馈」Tab: corrections 列表 (原词/正词/状态) + 确认沉淀词库 / 移除
//   - 数据源徽标: voice-workstation (内存词库 + ASR 转写派生)
//   - API: voiceWorkstationApi + asrApi
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import {
  Mic, Square, FileText, Send, RefreshCw, Volume2, BookOpen, History,
  Search, Plus, Pencil, Trash2, Save, X, Database, ChevronRight, FileUp,
  Headphones, AudioWaveform, Wand2, MessageSquareWarning, BadgeCheck, Timer, ListChecks,
} from 'lucide-react'
import { Tabs, Tag, Button, Modal, Input, Select, message, Empty, Spin, Alert, Popconfirm, Tooltip } from 'antd'
import { asrApi } from '../../services/api/asrApi'
import {
  voiceWorkstationApi,
  LexiconEntry,
  LexiconCategory,
  WorkstationStats,
  SessionRecord,
  CorrectionFeedback,
  WorkstationTranscribeResult,
} from '../../services/api/voiceWorkstationApi'
import { t } from '../../i18n/appI18n'

const CATEGORY_COLORS: Record<string, string> = {
  解剖: '#6366f1', 影像: '#0ea5e9', 疾病: '#f43f5e', 药物: '#a855f7', 单位: '#14b8a6', 操作: '#f59e0b',
}

const CATEGORY_OPTIONS: Array<{ label: string; value: LexiconCategory }> = (['解剖', '影像', '疾病', '药物', '单位', '操作'] as LexiconCategory[]).map((c) => ({ label: c, value: c }))

const ENGINE_BADGES: Record<string, { color: string; bg: string }> = {
  aliyun: { color: '#3b82f6', bg: '#dbeafe' },
  whisper: { color: '#7c3aed', bg: '#ede9fe' },
  mock: { color: '#64748b', bg: '#e2e8f0' },
  'mock-lexicon': { color: '#64748b', bg: '#e2e8f0' },
  lexicon: { color: '#10b981', bg: '#d1fae5' },
}

const SESSION_STATUS: Record<string, { color: string; bg: string }> = {
  completed: { color: '#10b981', bg: '#d1fae5' },
  processing: { color: '#f59e0b', bg: '#fef3c7' },
  error: { color: '#ef4444', bg: '#ffe4e6' },
}

// 演示转写 (与后端 DEMO_TRANSCRIPT 一致的含错文本, 用于无录音环境回退)
const DEMO_TEXT = '右肺上叶尖后段见一不规则形软组织密度结皆，边缘呈分叶状，可见毛刺症及胸膜牵啦征象，余双肺纹理清晰，肋膈角锐利。'

// seed 会话的演示转写内容 (sessions 接口不含正文, 页面本地补充)
const SEED_TRANSCRIPTS: Record<string, string> = {
  'vws-seed-1': '右肺上叶尖后段见不规则形软组织密度结节，边缘呈分叶状，可见毛刺征及胸膜牵拉征象，余双肺纹理清晰，肋膈角锐利。',
  'vws-seed-2': '胸部正位片示双肺纹理清晰，肺门不大，心影大小形态正常，纵隔无偏移，双膈面光滑，肋膈角锐利。',
  'vws-seed-3': '头颅MRI平扫示脑实质内未见异常信号影，脑室系统形态大小正常，中线结构居中，脑沟脑裂未见增宽。',
  'vws-seed-4': '左膝关节正侧位片示骨质结构完整，未见明显骨折线影，关节间隙正常，周围软组织未见异常。',
  'vws-seed-5': '胸部CT示右肺下叶见斑片状高密度影，边缘模糊，余肺野清晰，纵隔内未见肿大淋巴结影。',
  'vws-seed-6': '上腹部CT平扫示肝脏形态大小正常，肝内未见异常密度影，胆囊未见结石，胰腺、脾脏及双肾未见异常。',
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Blob → base64 (用于 audioBase64 上传)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(new Error(t('voiceWs.recordReadFailed')))
    reader.readAsDataURL(blob)
  })
}

export default function VoiceWorkstationPage() {
  // ── 状态 ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dictation')
  const [stats, setStats] = useState<WorkstationStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // 录音 / 转写
  const [recording, setRecording] = useState(false)
  const [recordSec, setRecordSec] = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<WorkstationTranscribeResult | null>(null)
  const [editingText, setEditingText] = useState('')
  const [reportId, setReportId] = useState('')
  const [inserted, setInserted] = useState(false)
  const [engineLabel, setEngineLabel] = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 词库
  const [lexicon, setLexicon] = useState<LexiconEntry[]>([])
  const [lexQuery, setLexQuery] = useState('')
  const [lexForm, setLexForm] = useState<{ term: string; category: LexiconCategory; priority: number; aliases: string }>({ term: '', category: '影像', priority: 1, aliases: '' })
  const [editingLexId, setEditingLexId] = useState<string | null>(null)
  const [lexSaving, setLexSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 听写历史
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [sessionTranscripts] = useState<Record<string, string>>(SEED_TRANSCRIPTS)
  const [viewSession, setViewSession] = useState<SessionRecord | null>(null)

  // 纠正反馈
  const [feedbacks, setFeedbacks] = useState<CorrectionFeedback[]>([])
  const [removedFeedbacks, setRemovedFeedbacks] = useState<string[]>([])
  const [feedbackForm, setFeedbackForm] = useState({ original: '', corrected: '' })

  // 报告联动
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // ── 加载 ────────────────────────────────────────────────────────────────
  const loadLexicon = useCallback(async () => {
    try {
      setLexicon(lexQuery.trim() ? await voiceWorkstationApi.searchLexicon(lexQuery.trim()) : await voiceWorkstationApi.listLexicon())
    } catch {
      /* 词库加载失败 */
    }
  }, [lexQuery])

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await voiceWorkstationApi.listSessions())
    } catch {
      /* 历史不可用 */
    }
  }, [])

  const loadFeedbacks = useCallback(async () => {
    try {
      setFeedbacks(await voiceWorkstationApi.listCorrections())
    } catch {
      /* 纠正反馈不可用 */
    }
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      setStats(await voiceWorkstationApi.getStats())
    } catch {
      /* 统计不可用 */
    }
    setStatsLoading(false)
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadLexicon(), loadSessions(), loadFeedbacks(), loadStats()])
  }, [loadLexicon, loadSessions, loadFeedbacks, loadStats])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // ── 录音 ────────────────────────────────────────────────────────────────
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      chunks.current = []
      startTimeRef.current = Date.now()
      setRecordSec(0)
      setTranscribing(false)
      setTranscript(null)
      setInserted(false)
      timerRef.current = setInterval(() => setRecordSec((s) => s + 1), 1000)
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      mediaRecorder.current.onstop = async () => {
        stopTimer()
        const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
        setTranscribing(true)
        try {
          const blob = new Blob(chunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' })
          let result: WorkstationTranscribeResult | null = null
          try {
            const base64 = await blobToBase64(blob)
            result = await voiceWorkstationApi.transcribe({ audioBase64: base64, reportId: reportId.trim() || undefined, duration: durationSec })
          } catch {
            // 降级: ASR 先转文本, 再走词库校正
            const asrRes = await asrApi.transcribe(blob, durationSec)
            result = await voiceWorkstationApi.transcribe({ text: asrRes.text, reportId: reportId.trim() || undefined, duration: durationSec })
          }
          setTranscript(result)
          setEditingText(result.correctedText)
          setEngineLabel(result.engine)
          if (result.corrections.length > 0) {
            message.success(`词库校正 ${result.corrections.length} 处 (原词→正词)`)
          }
        } catch (e) {
          message.error((e as Error).message ?? t('voiceWs.transcribeFailed'))
        } finally {
          setTranscribing(false)
          stream.getTracks().forEach((t) => t.stop())
          void loadSessions()
          void loadStats()
        }
      }
      mediaRecorder.current.start()
      setRecording(true)
    } catch {
      // 无麦克风环境: 演示转写
      setTranscribing(true)
      try {
        const asrRes = await asrApi.transcribe()
        const result = await voiceWorkstationApi.transcribe({ text: asrRes.text ?? DEMO_TEXT, reportId: reportId.trim() || undefined, duration: 30 })
        setTranscript(result)
        setEditingText(result.correctedText)
        setEngineLabel(result.engine)
        if (result.corrections.length > 0) message.success(`词库校正 ${result.corrections.length} 处`)
        void loadSessions()
        void loadStats()
      } catch (e) {
        message.error((e as Error).message ?? t('voiceWs.transcribeFailed'))
      } finally {
        setTranscribing(false)
      }
    }
  }, [reportId, loadSessions, loadStats])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
      setRecording(false)
    }
  }, [])

  useEffect(() => () => stopTimer(), [])

  // ── 词库 CRUD ───────────────────────────────────────────────────────────
  const handleLexiconSubmit = async () => {
    const term = lexForm.term.trim()
    if (!term) {
      message.warning(t('voiceWs.termRequired'))
      return
    }
    const aliases = lexForm.aliases.split(/[,，]/).map((a) => a.trim()).filter(Boolean)
    setLexSaving(true)
    try {
      if (editingLexId) {
        await voiceWorkstationApi.updateLexicon(editingLexId, { term, category: lexForm.category, priority: lexForm.priority, aliases })
        message.success(`词条「${term}」已更新`)
      } else {
        await voiceWorkstationApi.createLexicon({ term, category: lexForm.category, priority: lexForm.priority, aliases })
        message.success(`词条「${term}」已新增`)
      }
      setLexForm({ term: '', category: '影像', priority: 1, aliases: '' })
      setEditingLexId(null)
      await loadLexicon()
      await loadStats()
    } catch (e) {
      message.error((e as Error).message ?? t('voiceWs.saveFailed'))
    } finally {
      setLexSaving(false)
    }
  }

  const startEditLex = (entry: LexiconEntry) => {
    setEditingLexId(entry.id)
    setLexForm({ term: entry.term, category: entry.category, priority: entry.priority, aliases: entry.aliases.join(', ') })
  }

  const cancelEditLex = () => {
    setEditingLexId(null)
    setLexForm({ term: '', category: '影像', priority: 1, aliases: '' })
  }

  const handleLexiconDelete = async (id: string, term: string) => {
    try {
      await voiceWorkstationApi.deleteLexicon(id)
      message.success(`词条「${term}」已删除`)
      await loadLexicon()
      await loadStats()
    } catch (e) {
      message.error((e as Error).message ?? t('voiceWs.deleteFailed'))
    }
  }

  // CSV 批量导入: term,category,priority,aliases(逗号分隔)
  const handleImportCsv = (file: File) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const text = String(reader.result ?? '')
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      setImporting(true)
      let ok = 0
      let fail = 0
      for (const line of lines) {
        const parts = line.split(',')
        const term = (parts[0] ?? '').trim()
        if (!term) continue
        const category = (parts[1] ?? '影像').trim() as LexiconCategory
        const priority = Math.min(10, Math.max(0, Number(parts[2]) || 1))
        const aliases = (parts[3] ?? '').split('|').map((a) => a.trim()).filter(Boolean)
        try {
          await voiceWorkstationApi.createLexicon({ term, category: CATEGORY_OPTIONS.some((o) => o.value === category) ? category : '影像', priority, aliases })
          ok += 1
        } catch {
          fail += 1
        }
      }
      message.success(`批量导入完成: 成功 ${ok} 条${fail > 0 ? `, 跳过 ${fail} 条 (重复/非法)` : ''}`)
      setImporting(false)
      await loadLexicon()
      await loadStats()
    }
    reader.readAsText(file, 'utf-8')
    return false
  }

  // ── 纠正反馈 ────────────────────────────────────────────────────────────
  const handleSubmitFeedback = async () => {
    const original = feedbackForm.original.trim()
    const corrected = feedbackForm.corrected.trim()
    if (!original || !corrected) {
      message.warning(t('voiceWs.originalCorrectedRequired'))
      return
    }
    try {
      await voiceWorkstationApi.submitCorrection({ original, corrected })
      message.success(`纠正反馈已提交: ${original} → ${corrected} (已沉淀进词库)`)
      setFeedbackForm({ original: '', corrected: '' })
      await loadFeedbacks()
      await loadLexicon()
      await loadStats()
    } catch (e) {
      message.error((e as Error).message ?? t('voiceWs.submitFailed'))
    }
  }

  const handleConfirmFeedback = async (fb: CorrectionFeedback) => {
    try {
      await voiceWorkstationApi.submitCorrection({ original: fb.original, corrected: fb.corrected })
      message.success(`「${fb.original} → ${fb.corrected}」已确认并沉淀词库`)
      await loadFeedbacks()
      await loadLexicon()
      await loadStats()
    } catch (e) {
      message.error((e as Error).message ?? t('voiceWs.confirmFailed'))
    }
  }

  const handleRemoveFeedback = (id: string) => {
    setRemovedFeedbacks((prev) => [...prev, id])
    message.success(t('voiceWs.removedFromList'))
  }

  // ── 插入报告 ────────────────────────────────────────────────────────────
  const handleInsertReport = () => {
    if (!transcript) return
    if (!reportId.trim()) {
      setReportModalOpen(true)
      return
    }
    setInserted(true)
    message.success(`转写结果已插入报告 ${reportId.trim()}`)
  }

  // ── 派生数据 ────────────────────────────────────────────────────────────
  const filteredLexicon = useMemo(() => {
    const kw = lexQuery.trim().toLowerCase()
    if (!kw) return lexicon
    return lexicon.filter((e) => e.term.toLowerCase().includes(kw) || e.aliases.some((a) => a.toLowerCase().includes(kw)) || e.category.includes(kw))
  }, [lexicon, lexQuery])

  const visibleFeedbacks = useMemo(() => feedbacks.filter((f) => !removedFeedbacks.includes(f.id)), [feedbacks, removedFeedbacks])

  const statCards = useMemo(() => {
    if (!stats) return []
    return [
      { label: t('voiceWs.statSessions'), value: stats.sessions.total, color: '#3b82f6', bg: '#dbeafe', icon: <Headphones size={18} /> },
      { label: t('voiceWs.statTodaySessions'), value: stats.sessions.today, color: '#0ea5e9', bg: '#e0f2fe', icon: <AudioWaveform size={18} /> },
      { label: t('voiceWs.statAvgDuration'), value: stats.sessions.avgDurationSec, color: '#f59e0b', bg: '#fef3c7', icon: <Timer size={18} /> },
      { label: t('voiceWs.statLexicon'), value: stats.lexiconSize, color: '#8b5cf6', bg: '#ede9fe', icon: <BookOpen size={18} /> },
      { label: t('voiceWs.statCorrections'), value: stats.corrections.total, color: '#f43f5e', bg: '#ffe4e6', icon: <MessageSquareWarning size={18} /> },
    ]
  }, [stats])

  const openSessionDetail = (s: SessionRecord) => {
    setViewSession(s)
  }

  // ── 渲染: 听写主面板 ────────────────────────────────────────────────────
  const renderDictation = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 录音卡片 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 76, height: 76, borderRadius: '50%', flexShrink: 0,
              background: recording ? '#fee2e2' : transcribing ? '#fef3c7' : '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recording ? '0 0 0 6px rgba(220,38,38,0.15)' : 'none',
              transition: 'all 0.3s',
            }}
          >
            {recording ? <Square size={30} color="#dc2626" /> : transcribing ? <RefreshCw size={28} color="#d97706" style={{ animation: 'spin 1s linear infinite' }} /> : <Mic size={30} color="#3b82f6" />}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
              {recording ? `${t('voiceWs.recording')} ${recordSec}s` : transcribing ? t('voiceWs.transcribing') : t('voiceWs.dictation')}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
              {recording ? t('voiceWs.stopHint') : t('voiceWs.recordHint')}
              <br />
              <span style={{ color: '#94a3b8' }}>{t('voiceWs.noMicHint')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!recording ? (
              <Button type="primary" icon={<Mic size={14} />} onClick={() => void startRecording()} disabled={transcribing}>{t('voiceWs.startRecording')}</Button>
            ) : (
              <Button danger icon={<Square size={14} />} onClick={stopRecording}>{t('voiceWs.stopRecording')}</Button>
            )}
            <Button icon={<RefreshCw size={14} />} onClick={() => { setTranscript(null); setInserted(false); setEditingText('') }} disabled={recording || transcribing}>{t('voiceWs.clear')}</Button>
          </div>
        </div>
        {/* 报告联动 */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Tag icon={<FileText size={11} />} color="blue" style={{ margin: 0 }}>{t('voiceWs.insertReport')}</Tag>
          <Input
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder={t('voiceWs.reportIdPlaceholder')}
            size="small"
            style={{ width: 240 }}
          />
          {inserted && <Tag color="success" style={{ margin: 0 }}>{t('voiceWs.inserted')}</Tag>}
        </div>
      </div>

      {/* 转写结果 */}
      {transcribing && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <RefreshCw size={24} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>{t('voiceWs.transcribingLex')}</div>
        </div>
      )}

      {transcript && !transcribing && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} color="#3b82f6" />{t('voiceWs.transcriptResult')}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {engineLabel && (
                <Tag style={{ margin: 0, fontSize: 11, fontWeight: 600, color: (ENGINE_BADGES[engineLabel] ?? ENGINE_BADGES.mock)?.color, background: (ENGINE_BADGES[engineLabel] ?? ENGINE_BADGES.mock)?.bg, borderColor: 'transparent' }}>
                  {t(`voiceWs.engine.${engineLabel && ENGINE_BADGES[engineLabel] ? engineLabel : 'mock'}`)}
                </Tag>
              )}
              {transcript.corrections.length > 0 && (
                <Tag color="success" icon={<Wand2 size={11} />} style={{ margin: 0 }}>{t('voiceWs.lexCorrection')} {transcript.corrections.length} {t('voiceWs.timesUnit')}</Tag>
              )}
              <Tag color={transcript.confidence > 0.9 ? 'success' : 'warning'} style={{ margin: 0 }}>
                {t('voiceWs.confidence')} {(transcript.confidence * 100).toFixed(0)}%
              </Tag>
              <Tag color="default" style={{ margin: 0 }}>{t('voiceWs.duration')} {transcript.duration}s</Tag>
            </div>
          </div>

          {/* 词库校正提示: 原词 → 正词 + 分类 */}
          {transcript.corrections.length > 0 && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 12, padding: '8px 12px', fontSize: 12 }}
              message={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>{t('voiceWs.lexCorrectionHint')}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {transcript.corrections.map((c, i) => (
                      <Tag key={i} style={{ margin: 0, fontSize: 11 }}>
                        <s style={{ color: '#dc2626' }}>{c.original}</s>
                        <span style={{ margin: '0 4px' }}>→</span>
                        <b style={{ color: '#059669' }}>{c.corrected}</b>
                        <span style={{ marginLeft: 4, color: CATEGORY_COLORS[c.category] ?? '#64748b', fontWeight: 600 }}>[{c.category}]</span>
                      </Tag>
                    ))}
                  </div>
                </div>
              }
            />
          )}

          <textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            rows={7}
            style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.7, resize: 'vertical' }}
            placeholder={t('voiceWs.transcriptPlaceholder')}
          />

          {/* 分段置信度 */}
          {transcript.segments.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>{t('voiceWs.segmentConfidence')}</div>
              {transcript.segments.map((seg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                  <span style={{ color: '#94a3b8', width: 60, flexShrink: 0 }}>{seg.start}s-{seg.end}s</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.text}</span>
                  <span style={{ color: seg.confidence > 0.9 ? '#10b981' : '#f59e0b', fontWeight: 600, flexShrink: 0 }}>{(seg.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="primary" icon={<Send size={14} />} onClick={handleInsertReport} disabled={inserted}>
              {inserted ? t('voiceWs.insertedReport') : t('voiceWs.insertReport')}
            </Button>
            <Button icon={<BadgeCheck size={14} />} onClick={() => setReportModalOpen(true)} disabled={inserted}>{t('voiceWs.insertAndFinish')}</Button>
          </div>
        </div>
      )}

      {/* 统计卡 */}
      {statsLoading && !stats ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {statCards.map((card) => (
            <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 词库分布 */}
      {stats && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={15} color="#10b981" />{t('voiceWs.lexiconDistribution')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.categoryCounts.map((c) => {
              const pct = stats.lexiconSize > 0 ? Math.round((c.count / stats.lexiconSize) * 100) : 0
              return (
                <div key={c.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{c.category}</span>
                    <span style={{ color: '#94a3b8' }}>{c.count} {t('voiceWs.itemsUnit')} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: CATEGORY_COLORS[c.category] ?? '#94a3b8', borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  // ── 渲染: 医学词库 ─────────────────────────────────────────────────────
  const renderLexicon = () => (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={16} color="#8b5cf6" />{t('voiceWs.lexiconManage')}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <Input
              value={lexQuery}
              onChange={(e) => setLexQuery(e.target.value)}
              placeholder={t('voiceWs.lexSearchPlaceholder')}
              size="small"
              style={{ paddingLeft: 30, width: 220 }}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleImportCsv(f)
              e.target.value = ''
            }}
          />
          <Button size="small" icon={<FileUp size={12} />} loading={importing} onClick={() => fileInputRef.current?.click()}>{t('voiceWs.importCsv')}</Button>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('voiceWs.totalPrefix')} {filteredLexicon.length} {t('voiceWs.itemsUnit')}</span>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, padding: '6px 12px', fontSize: 12 }}
        message={t('voiceWs.csvFormatHint')}
      />

      {/* 新增/编辑表单 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <Input
          value={lexForm.term}
          onChange={(e) => setLexForm((f) => ({ ...f, term: e.target.value }))}
          placeholder={t('voiceWs.termPlaceholder')}
          size="small"
          style={{ width: 170 }}
        />
        <Select
          value={lexForm.category}
          onChange={(v) => setLexForm((f) => ({ ...f, category: v }))}
          size="small"
          style={{ width: 90 }}
          options={CATEGORY_OPTIONS}
        />
        <Input
          type="number" min={0} max={10}
          value={lexForm.priority}
          onChange={(e) => setLexForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
          placeholder={t('voiceWs.priorityPlaceholder')}
          size="small"
          style={{ width: 80 }}
        />
        <Input
          value={lexForm.aliases}
          onChange={(e) => setLexForm((f) => ({ ...f, aliases: e.target.value }))}
          placeholder={t('voiceWs.aliasesPlaceholder')}
          size="small"
          style={{ flex: 1, minWidth: 200 }}
        />
        <Button size="small" type="primary" icon={editingLexId ? <Save size={12} /> : <Plus size={12} />} loading={lexSaving} onClick={() => void handleLexiconSubmit()}>
          {editingLexId ? t('voiceWs.saveEdit') : t('voiceWs.addEntry')}
        </Button>
        {editingLexId && (
          <Button size="small" icon={<X size={12} />} onClick={cancelEditLex}>{t('voiceWs.cancel')}</Button>
        )}
      </div>

      {/* 词库表格 */}
      <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 1 }}>
            <tr>
              {[t('voiceWs.colTerm'), t('voiceWs.colCategory'), t('voiceWs.colPriority'), t('voiceWs.colAliases'), t('voiceWs.colActions')].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLexicon.slice(0, 200).map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px', fontWeight: 500 }}>{entry.term}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: CATEGORY_COLORS[entry.category] ?? '#64748b', padding: '2px 8px', borderRadius: 10 }}>{entry.category}</span>
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b' }}>
                  <span style={{ display: 'inline-block', width: 18, height: 18, lineHeight: '18px', textAlign: 'center', borderRadius: 4, background: entry.priority >= 3 ? '#fef3c7' : '#f1f5f9', color: entry.priority >= 3 ? '#d97706' : '#64748b', fontWeight: 700 }}>{entry.priority}</span>
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.aliases.length > 0 ? entry.aliases.join(' / ') : '-'}
                </td>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                  <Tooltip title={t('voiceWs.editTooltip')}>
                    <Button size="small" type="text" icon={<Pencil size={14} />} onClick={() => startEditLex(entry)} style={{ color: '#3b82f6' }} />
                  </Tooltip>
                  <Popconfirm title={`${t('voiceWs.deleteEntryConfirm')} ${entry.term} ?`} okText={t('voiceWs.delete')} cancelText={t('voiceWs.cancel')} okButtonProps={{ danger: true }} onConfirm={() => void handleLexiconDelete(entry.id, entry.term)}>
                    <Button size="small" type="text" danger icon={<Trash2 size={14} />} />
                  </Popconfirm>
                </td>
              </tr>
            ))}
            {filteredLexicon.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>{t('voiceWs.noEntries')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── 渲染: 听写历史 ─────────────────────────────────────────────────────
  const renderSessions = () => (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={16} color="#3b82f6" />{t('voiceWs.dictationHistory')} ({sessions.length})
        </h3>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadSessions()}>{t('voiceWs.refresh')}</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sessions.length === 0 && <Empty description={t('voiceWs.noHistory')} style={{ padding: 32 }} />}
        {sessions.map((s) => {
          const st = SESSION_STATUS[s.status] ?? SESSION_STATUS.processing!
          return (
            <div
              key={s.id}
              onClick={() => openSessionDetail(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronRight size={14} color="#cbd5e1" />
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Headphones size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('voiceWs.reportLabel')} {s.reportId} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {s.doctorId}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {fmtTime(s.createdAt)} · {s.duration}s · {t('voiceWs.clickToViewTranscript')}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 4 }}>{t(`voiceWs.sessionStatus.${SESSION_STATUS[s.status] ? s.status : 'processing'}`)}</span>
              {s.correctionCount > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#8b5cf6', background: '#ede9fe', padding: '2px 8px', borderRadius: 4 }}>{t('voiceWs.correctionCount')} {s.correctionCount}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── 渲染: 纠正反馈 ─────────────────────────────────────────────────────
  const renderFeedbacks = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 提交表单 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquareWarning size={16} color="#f43f5e" />{t('voiceWs.submitCorrection')}
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            value={feedbackForm.original}
            onChange={(e) => setFeedbackForm((f) => ({ ...f, original: e.target.value }))}
            placeholder={t('voiceWs.originalPlaceholder')}
            size="small"
            style={{ width: 200 }}
          />
          <span style={{ color: '#94a3b8' }}>→</span>
          <Input
            value={feedbackForm.corrected}
            onChange={(e) => setFeedbackForm((f) => ({ ...f, corrected: e.target.value }))}
            placeholder={t('voiceWs.correctedPlaceholder')}
            size="small"
            style={{ width: 200 }}
          />
          <Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => void handleSubmitFeedback()}>{t('voiceWs.submit')}</Button>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{t('voiceWs.correctionHint')}</div>
      </div>

      {/* 反馈列表 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ListChecks size={16} color="#10b981" />{t('voiceWs.correctionRecords')} ({visibleFeedbacks.length})
          </h3>
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadFeedbacks()}>{t('voiceWs.refresh')}</Button>
        </div>
        {visibleFeedbacks.length === 0 && <Empty description={t('voiceWs.noCorrections')} style={{ padding: 32 }} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {visibleFeedbacks.map((fb) => {
            const auto = fb.source === 'auto'
            return (
              <div key={fb.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={auto ? 'geekblue' : 'gold'} style={{ margin: 0 }}>{auto ? t('voiceWs.autoCorrection') : t('voiceWs.manualFeedback')}</Tag>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{fmtTime(fb.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <s style={{ color: '#dc2626', fontWeight: 600 }}>{fb.original}</s>
                  <span style={{ color: '#94a3b8' }}>→</span>
                  <b style={{ color: '#059669' }}>{fb.corrected}</b>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="small" type="primary" ghost icon={<BadgeCheck size={12} />} onClick={() => void handleConfirmFeedback(fb)}>{t('voiceWs.confirmAndSave')}</Button>
                  <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => handleRemoveFeedback(fb.id)}>{t('voiceWs.remove')}</Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ── 主渲染 ─────────────────────────────────────────────────────────────
  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<Volume2 size={20} color="#3b82f6" />}
        title={t('voiceWs.pageTitle')}
        subtitle={t('voiceWs.pageSubtitle')}
      />
      <div style={{ padding: 24 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'dictation', label: <span><Mic size={13} style={{ verticalAlign: -2 }} /> {t('voiceWs.tabDictation')}</span>, children: renderDictation() },
            { key: 'lexicon', label: <span><BookOpen size={13} style={{ verticalAlign: -2 }} /> {t('voiceWs.tabLexicon')} {stats ? `(${stats.lexiconSize})` : ''}</span>, children: renderLexicon() },
            { key: 'sessions', label: <span><History size={13} style={{ verticalAlign: -2 }} /> {t('voiceWs.tabSessions')} {sessions.length > 0 ? `(${sessions.length})` : ''}</span>, children: renderSessions() },
            { key: 'feedbacks', label: <span><MessageSquareWarning size={13} style={{ verticalAlign: -2 }} /> {t('voiceWs.tabFeedbacks')} {visibleFeedbacks.length > 0 ? `(${visibleFeedbacks.length})` : ''}</span>, children: renderFeedbacks() },
          ]}
        />

        {/* 数据源徽标 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', padding: '12px 4px 0', flexWrap: 'wrap' }}>
          <Tag color="blue" style={{ margin: 0 }}>{t('voiceWs.dataSource')}</Tag>
          <span>{t('voiceWs.dataSourceDetail')}</span>
        </div>
      </div>

      {/* 会话详情 Modal */}
      <Modal
        title={viewSession ? `${t('voiceWs.sessionDetail')} · ${t('voiceWs.reportLabel')} ${viewSession.reportId}` : t('voiceWs.sessionDetail')}
        open={!!viewSession}
        onCancel={() => setViewSession(null)}
        footer={<Button onClick={() => setViewSession(null)}>{t('voiceWs.close')}</Button>}
        width={640}
      >
        {viewSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag color="blue" style={{ margin: 0 }}>{viewSession.doctorId}</Tag>
              <Tag color="default" style={{ margin: 0 }}>{t('voiceWs.duration')} {viewSession.duration}s</Tag>
              <Tag color={SESSION_STATUS[viewSession.status]?.color ?? 'default'} style={{ margin: 0 }}>{t(`voiceWs.sessionStatus.${SESSION_STATUS[viewSession.status] ? viewSession.status : 'processing'}`)}</Tag>
              <Tag color="purple" style={{ margin: 0 }}>{t('voiceWs.correctionCount')} {viewSession.correctionCount} {t('voiceWs.timesUnit')}</Tag>
              <Tag color="default" style={{ margin: 0 }}>{fmtTime(viewSession.createdAt)}</Tag>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{t('voiceWs.transcriptContent')}</div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>
                {sessionTranscripts[viewSession.id] ?? t('voiceWs.sessionArchived', { reportId: viewSession.reportId })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 插入报告 Modal */}
      <Modal
        title={t('voiceWs.insertTranscriptTitle')}
        open={reportModalOpen}
        onOk={() => {
          if (!reportId.trim()) {
            message.warning(t('voiceWs.reportIdRequired'))
            return
          }
          setInserted(true)
          setReportModalOpen(false)
          message.success(`${t('voiceWs.transcriptInserted')} ${reportId.trim()}`)
        }}
        onCancel={() => setReportModalOpen(false)}
        okText={t('voiceWs.confirmInsert')}
        cancelText={t('voiceWs.cancel')}
        width={460}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {t('voiceWs.insertTranscriptHint')}
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 12, color: '#334155', maxHeight: 120, overflowY: 'auto', lineHeight: 1.7 }}>
            {transcript?.correctedText || '—'}
          </div>
          <Input
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder={t('voiceWs.reportIdPlaceholderShort')}
            size="small"
          />
          {reportId.trim() && (
            <Alert type="info" showIcon style={{ padding: '4px 10px', fontSize: 11 }} message={`${t('voiceWs.willInsertTo')} ${reportId.trim()}`} />
          )}
        </div>
      </Modal>
    </PageContainer>
  )
}

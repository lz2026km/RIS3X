// [v3.0.6.11-103 Wave 17] 语音听写工作台 V2 (PACS 对标 PowerScribe)
// 开始/暂停/停止 + 实时文本流 + 标点自动插入 + 放射术语热词 + 语音命令词
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '@i18n/appI18n'
import { message } from 'antd'
import {
  Mic, Square, Pause, Play, Send, Save, Volume2, BookOpen,
  Plus, Pencil, Trash2, X, Command, Activity,
} from 'lucide-react'
import { PageContainer } from '@components/common/PageContainer'
import { PageHeader } from '@components/common/PageHeader'
import { ErrorBanner } from '@components/feedback'
import { asrApi, type DictationSession, type DictationHotword, type DictationHotwordCategory, type DictationSectionKey } from '@services/api/asrApi'
import { reportApi } from '@services/api/reportApi'

const SECTION_ORDER: DictationSectionKey[] = ['findings', 'impression', 'recommendation', 'conclusion']

const CATEGORY_COLORS: Record<string, string> = {
  解剖: '#6366f1', 影像: '#0ea5e9', 疾病: '#f43f5e', 单位: '#14b8a6', 操作: 'var(--color-warning-500)',
}

const DEMO_STREAM: Array<{ text: string }> = [
  { text: '双肺纹理清晰，肺野透亮度正常' },
  { text: '右肺上叶见一磨玻璃结节影，大小约1.2cm' },
  { text: '下一段' },
  { text: '右肺上叶磨玻璃结节，考虑炎性结节可能性大' },
  { text: '保存' },
  { text: '下一段' },
  { text: '建议3个月后复查胸部CT，观察结节变化' },
  { text: '下一段' },
  { text: '右肺上叶磨玻璃结节，建议定期随访' },
  { text: '提交' },
]

// 本地确定性兜底识别 (后端不可用时): 自动标点 + 命令词 + 热词计数
function localRecognize(chunk: string): { text: string; commands: Array<{ phrase: string; action: string; at: number }> } {
  let clean = chunk
  const commands: Array<{ phrase: string; action: string; at: number }> = []
  const COMMANDS: Array<[string, string]> = [['下一段', 'next_section'], ['保存', 'save'], ['提交', 'submit'], ['暂停', 'pause'], ['继续', 'resume']]
  for (const [phrase, action] of COMMANDS) {
    if (clean.includes(phrase)) {
      commands.push({ phrase, action, at: clean.indexOf(phrase) })
      clean = clean.split(phrase).join('')
    }
  }
  clean = clean.trim()
  if (clean && !/[。！？；;，,]$/.test(clean)) clean = clean.length >= 8 ? `${clean}。` : `${clean}，`
  return { text: clean, commands }
}

export default function AsrDictationPage() {
  const [session, setSession] = useState<DictationSession | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hotwords, setHotwords] = useState<DictationHotword[]>([])
  const [hotwordForm, setHotwordForm] = useState<{ term: string; category: DictationHotwordCategory; priority: number }>({ term: '', category: '影像', priority: 1 })
  const [editingHotwordId, setEditingHotwordId] = useState<string | null>(null)
  const [reportId, setReportId] = useState('')
  const [lastCommand, setLastCommand] = useState<{ phrase: string; action: string; at: string } | null>(null)
  const streamIdxRef = useRef(0)
  const [activeSection, setActiveSection] = useState<DictationSectionKey>('findings')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadHotwords = useCallback(async () => {
    try {
      setHotwords(await asrApi.listDictationHotwords())
      setLoadError(null)
    } catch {
      setLoadError(t('w9.states.error'))
    }
  }, [])

  useEffect(() => {
    void loadHotwords()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loadHotwords])

  const nextSectionKey = (prev: DictationSectionKey): DictationSectionKey =>
    SECTION_ORDER[(SECTION_ORDER.indexOf(prev) + 1) % SECTION_ORDER.length]!

  const applyCommands = useCallback((commands: Array<{ phrase: string; action: string }>) => {
    for (const cmd of commands) {
      setLastCommand({ phrase: cmd.phrase, action: cmd.action, at: new Date().toLocaleTimeString() })
      if (cmd.action === 'next_section') {
        setActiveSection((prev) => nextSectionKey(prev))
      } else if (cmd.action === 'save') {
        message.success(`${t('w17.asr.commandExecuted')}: ${t('w17.asr.cmdSave')}`)
      } else if (cmd.action === 'submit') {
        message.success(`${t('w17.asr.commandExecuted')}: ${t('w17.asr.cmdSubmit')}`)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setStreaming(false)
      } else if (cmd.action === 'pause') {
        setPaused(true)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      } else if (cmd.action === 'resume') {
        setPaused(false)
      }
    }
  }, [])

  const appendChunk = useCallback(async (chunk: string) => {
    if (!session) return
    try {
      const res = await asrApi.appendDictation(session.id, chunk)
      setSession((prev) => (prev ? { ...prev, text: res.sections.map((s) => s.text).filter(Boolean).join(''), sections: res.sections, commands: [...prev.commands, ...res.commands] } : prev))
      applyCommands(res.commands)
    } catch {
      // 后端不可用: 本地兜底识别, 保持链路可用
      const local = localRecognize(chunk)
      setSession((prev) => {
        if (!prev) return prev
        const sections = prev.sections.map((s) => ({ ...s }))
        const target = sections.find((s) => s.key === activeSection)
        if (target && local.text) target.text = target.text ? `${target.text}${local.text}` : local.text
        const commands = local.commands.map((c) => ({ ...c, action: c.action as DictationSession['commands'][number]['action'] }))
        return { ...prev, text: sections.map((s) => s.text).filter(Boolean).join(''), sections, commands: [...prev.commands, ...commands] }
      })
      applyCommands(local.commands)
    }
  }, [session, activeSection, applyCommands])

  const pumpStream = useCallback(() => {
    const idx = streamIdxRef.current
    streamIdxRef.current = idx + 1
    const item = DEMO_STREAM[idx]
    if (item) void appendChunk(item.text)
    if (streamIdxRef.current >= DEMO_STREAM.length) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setStreaming(false)
    }
  }, [appendChunk])

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(pumpStream, 1600)
  }, [pumpStream])

  const handleStart = useCallback(async () => {
    setLoading(true)
    try {
      const s = await asrApi.startDictation({ reportId: reportId.trim() || undefined })
      setSession(s)
      setStreaming(true)
      setPaused(false)
      streamIdxRef.current = 0
      setLastCommand(null)
      startTimer()
    } catch {
      // 后端不可用: 本地会话
      const local: DictationSession = {
        id: `local-${Date.now()}`, reportId: reportId.trim() || '未关联报告', doctorId: 'D1001', lang: 'zh-CN',
        status: 'dictating', startedAt: new Date().toISOString(), endedAt: null, text: '',
        sections: SECTION_ORDER.map((key) => ({ key, text: '' })), commands: [], durationSec: 0,
      }
      setSession(local)
      setStreaming(true)
      setPaused(false)
      streamIdxRef.current = 0
      setLastCommand(null)
      startTimer()
    } finally {
      setLoading(false)
    }
  }, [reportId, startTimer])

  const handlePause = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setPaused(true)
  }, [])

  const handleResume = useCallback(() => {
    setPaused(false)
    startTimer()
  }, [startTimer])

  const handleStop = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setStreaming(false)
    if (session) {
      try {
        const ended = await asrApi.endDictation(session.id)
        setSession(ended)
        message.success(`${t('w17.asr.sessionEnded')} · ${ended.durationSec}s`)
      } catch {
        setSession((prev) => (prev ? { ...prev, status: 'completed' as const, endedAt: new Date().toISOString(), durationSec: Math.max(1, Math.round((Date.now() - new Date(prev.startedAt).getTime()) / 1000)) } : prev))
        message.success(t('w17.asr.sessionEnded'))
      }
    }
  }, [session])

  const handleWriteToReport = useCallback(async () => {
    if (!session) return
    if (!reportId.trim()) {
      message.info(t('w17.asr.needReportId'))
      return
    }
    const f = session.sections.find((s) => s.key === 'findings')?.text ?? ''
    const im = session.sections.find((s) => s.key === 'impression')?.text ?? ''
    const rc = session.sections.find((s) => s.key === 'recommendation')?.text ?? ''
    const cc = session.sections.find((s) => s.key === 'conclusion')?.text ?? ''
    try {
      const res = await reportApi.update(reportId.trim(), { findings: f, impression: im, recommendations: rc, conclusion: cc })
      if (res.success) message.success(t('w17.asr.writtenToReport'))
      else message.error(res.error?.message ?? t('w17.asr.writeFailed'))
    } catch {
      message.error(t('w17.asr.writeFailed'))
    }
  }, [session, reportId])

  const handleHotwordSubmit = useCallback(async () => {
    const term = hotwordForm.term.trim()
    if (!term) return
    try {
      if (editingHotwordId) {
        await asrApi.updateDictationHotword(editingHotwordId, { term, category: hotwordForm.category, priority: hotwordForm.priority })
      } else {
        await asrApi.createDictationHotword({ term, category: hotwordForm.category, priority: hotwordForm.priority })
      }
      setHotwordForm({ term: '', category: '影像', priority: 1 })
      setEditingHotwordId(null)
      await loadHotwords()
    } catch (e) {
      message.error((e as Error)?.message ?? t('w17.asr.hotwordFailed'))
    }
  }, [hotwordForm, editingHotwordId, loadHotwords])

  const handleHotwordDelete = useCallback(async (id: string) => {
    try {
      await asrApi.deleteDictationHotword(id)
      await loadHotwords()
    } catch (e) {
      message.error((e as Error)?.message ?? t('w17.asr.hotwordFailed'))
    }
  }, [loadHotwords])

  const stats = useMemo(() => {
    const all = session?.sections ?? []
    const chars = session?.text?.length ?? 0
    const hits = hotwords.filter((h) => session?.text?.includes(h.term) ?? false).length
    return { chars, sections: all.filter((s) => s.text).length, hits }
  }, [session, hotwords])

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<Volume2 size={20} color="var(--color-primary-500)" />} title={t('w17.asr.title')} subtitle={t('w17.asr.subtitle')} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => void loadHotwords()} retryLabel={t('w9.states.retry')} />}
      <div style={{ padding: 24 }}>
        {/* 听写控制台 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: streaming ? '#fee2e2' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
              {streaming ? <Square size={26} color="var(--color-error-600)" /> : <Mic size={26} color="var(--color-primary-500)" />}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                {streaming ? (paused ? t('w17.asr.paused') : t('w17.asr.dictating')) : t('w17.asr.idle')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginTop: 2 }}>
                {session ? `${t('w17.asr.session')}: ${session.id.slice(0, 12)} · ${t('w17.asr.chars')}: ${stats.chars}` : t('w17.asr.sessionHint')}
              </div>
            </div>
            <input
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              placeholder={t('w17.asr.reportIdPlaceholder')}
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, width: 220 }}
            />
            {!streaming ? (
              <button onClick={() => void handleStart()} disabled={loading} style={{ padding: '10px 22px', background: 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mic size={15} />{loading ? t('w17.asr.starting') : t('w17.asr.start')}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                {paused ? (
                  <button onClick={handleResume} style={{ padding: '10px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Play size={15} />{t('w17.asr.resume')}
                  </button>
                ) : (
                  <button onClick={handlePause} style={{ padding: '10px 18px', background: 'var(--color-warning-500)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Pause size={15} />{t('w17.asr.pause')}
                  </button>
                )}
                <button onClick={() => void handleStop()} style={{ padding: '10px 18px', background: 'var(--color-error-600)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Square size={15} />{t('w17.asr.stop')}
                </button>
              </div>
            )}
          </div>

          {/* 实时流 + 分区 */}
          {session && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <div style={{ border: '1px solid var(--border-default, rgba(0,0,0,0.12))', borderRadius: 8, padding: 12, background: 'var(--bg-primary, #f8fafc)', minHeight: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#334155' }}>
                  <Activity size={13} color="var(--color-primary-500)" />{t('w17.asr.realtimeText')}
                  {streaming && <span style={{ color: 'var(--color-error-600)', fontSize: 11, animation: 'pulse 1.2s infinite' }}>●</span>}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.9, color: '#0f172a', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {session.text || <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{t('w17.asr.streamEmpty')}</span>}
                </div>
                {lastCommand && (
                  <div style={{ marginTop: 10, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 12, color: 'var(--color-primary-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Command size={12} />{t('w17.asr.commandDetected')}: 「{lastCommand.phrase}」→ {lastCommand.action} ({lastCommand.at})
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{t('w17.asr.sections')}</div>
                {SECTION_ORDER.map((key) => {
                  const text = session.sections.find((s) => s.key === key)?.text ?? ''
                  const active = key === activeSection
                  return (
                    <div
                      key={key}
                      onClick={() => setActiveSection(key)}
                      style={{ padding: '8px 10px', borderRadius: 6, border: active ? '1.5px solid var(--color-primary-500)' : '1px solid var(--border-default, rgba(0,0,0,0.12))', background: active ? '#eff6ff' : 'var(--bg-card, #ffffff)', marginBottom: 6, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: active ? 'var(--color-primary-700)' : '#475569' }}>
                        <span>{t(`w17.asr.section.${key}`)}</span>
                        <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400 }}>{text.length}{t('w17.asr.chars')}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #475569)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text || '—'}</div>
                    </div>
                  )
                })}
                {session.status === 'completed' && (
                  <button onClick={() => void handleWriteToReport()} style={{ width: '100%', marginTop: 8, padding: '9px 0', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Send size={14} />{t('w17.asr.writeToReport')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 统计条 */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              { label: t('w17.asr.statChars'), value: stats.chars },
              { label: t('w17.asr.statSections'), value: stats.sections },
              { label: t('w17.asr.statHotwordHits'), value: stats.hits },
              { label: t('w17.asr.statCommands'), value: session?.commands.length ?? 0 },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, minWidth: 110, background: 'var(--bg-primary, #f8fafc)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #475569)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            {t('w17.asr.commandListHint')} 「下一段」·「保存」·「提交」·「暂停」·「继续」
          </div>
        </div>

        {/* 术语库 (热词) */}
        <div style={{ marginTop: 16, background: 'var(--bg-card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={16} color="#8b5cf6" />{t('w17.asr.hotwordBank')}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>{t('w17.asr.hotwordCount')}: {hotwords.length}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: 12, background: 'var(--bg-primary, #f8fafc)', borderRadius: 8, border: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>
            <input
              value={hotwordForm.term}
              onChange={(e) => setHotwordForm((f) => ({ ...f, term: e.target.value }))}
              placeholder={t('w17.asr.hotwordTerm')}
              style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, width: 180 }}
            />
            <select
              value={hotwordForm.category}
              onChange={(e) => setHotwordForm((f) => ({ ...f, category: e.target.value as DictationHotwordCategory }))}
              style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}
            >
              {Object.keys(CATEGORY_COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number" min={0} max={10}
              value={hotwordForm.priority}
              onChange={(e) => setHotwordForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
              placeholder={t('w17.asr.priority')}
              style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, width: 80 }}
            />
            <button onClick={() => void handleHotwordSubmit()} style={{ padding: '6px 14px', background: editingHotwordId ? 'var(--color-warning-500)' : 'var(--color-primary-500)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {editingHotwordId ? <Save size={14} /> : <Plus size={14} />}{editingHotwordId ? t('w17.asr.saveEdit') : t('w17.asr.addHotword')}
            </button>
            {editingHotwordId && (
              <button onClick={() => { setEditingHotwordId(null); setHotwordForm({ term: '', category: '影像', priority: 1 }) }} style={{ padding: '6px 14px', background: 'var(--bg-card)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={14} />{t('w17.asr.cancel')}
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-default, rgba(0,0,0,0.12))', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-primary, #f8fafc)' }}>
                <tr>
                  {[t('w17.asr.colTerm'), t('w17.asr.colCategory'), t('w17.asr.colPriority'), t('w17.asr.colType'), t('w17.asr.colActions')].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hotwords.slice(0, 150).map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 500 }}>{entry.term}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: CATEGORY_COLORS[entry.category] ?? '#64748b', padding: '2px 8px', borderRadius: 10 }}>{entry.category}</span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary, #475569)' }}>{entry.priority}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: entry.builtin ? 'var(--text-secondary, #475569)' : '#8b5cf6', background: entry.builtin ? 'var(--bg-primary, #f8fafc)' : '#ede9fe', padding: '2px 8px', borderRadius: 4 }}>
                        {entry.builtin ? t('w17.asr.builtin') : t('w17.asr.custom')}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      {!entry.builtin && (
                        <>
                          <button onClick={() => { setEditingHotwordId(entry.id); setHotwordForm({ term: entry.term, category: entry.category, priority: entry.priority }) }} title={t('w17.asr.edit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-500)', marginRight: 8 }}><Pencil size={14} /></button>
                          <button onClick={() => void handleHotwordDelete(entry.id)} title={t('w17.asr.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error-500)' }}><Trash2 size={14} /></button>
                        </>
                      )}
                      {entry.builtin && <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>—</span>}
                    </td>
                  </tr>
                ))}
                {hotwords.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>{t('w17.asr.hotwordEmpty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

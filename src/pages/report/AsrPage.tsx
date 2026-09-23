import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Mic, Square, FileText, Send, CheckCircle, RefreshCw, Volume2, BookOpen, History, Search, Plus, Pencil, Trash2, Save, X, Database, ChevronRight } from 'lucide-react'
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { ErrorBanner } from "../../components/feedback"
import { asrApi } from "../../services/api/asrApi"
import { voiceWorkstationApi } from "../../services/api/voiceWorkstationApi"
import type { LexiconEntry, WorkstationStats, SessionRecord } from "../../services/api/voiceWorkstationApi"
import { t } from "../../i18n/appI18n"

const CATEGORY_COLORS: Record<string, string> = {
  解剖: "#6366f1", 影像: "#0ea5e9", 疾病: "#f43f5e", 药物: "#a855f7", 单位: "#14b8a6", 操作: "#f59e0b",
}

const ENGINE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  aliyun: { label: t("asrPage.engineAliyun"), color: "#3b82f6", bg: "#dbeafe" },
  whisper: { label: t("asrPage.engineWhisper"), color: "#7c3aed", bg: "#ede9fe" },
  mock: { label: t("asrPage.engineMock"), color: "#64748b", bg: "#e2e8f0" },
  "mock-lexicon": { label: t("asrPage.engineMockLexicon"), color: "#64748b", bg: "#e2e8f0" },
  lexicon: { label: t("asrPage.engineLexicon"), color: "#10b981", bg: "#d1fae5" },
}

export default function AsrPage() {
  const { t: rt } = useTranslation("asr")
  const [recording, setRecording] = useState(false)
  const [transcribed, setTranscribed] = useState("")
  const [editing, setEditing] = useState("")
  const [confidence, setConfidence] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [engineInfo, setEngineInfo] = useState<{ engine: string; corrections: number } | null>(null)
  const [stats, setStats] = useState<WorkstationStats | null>(null)
  const [lexicon, setLexicon] = useState<LexiconEntry[]>([])
  const [lexQuery, setLexQuery] = useState("")
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [lexForm, setLexForm] = useState<{ term: string; category: LexiconEntry["category"]; priority: number; aliases: string }>({ term: "", category: "影像", priority: 1, aliases: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)

  const loadLexicon = useCallback(async () => {
    try {
      setLexicon(lexQuery.trim() ? await voiceWorkstationApi.searchLexicon(lexQuery.trim()) : await voiceWorkstationApi.listLexicon())
      setLoadError(null)
    } catch { setLoadError(t('w9.states.error')) }
  }, [lexQuery])

  const refreshStatsAndSessions = useCallback(async () => {
    try { setStats(await voiceWorkstationApi.getStats()) } catch { setLoadError(t('w9.states.error')) }
    try { setSessions(await voiceWorkstationApi.listSessions()) } catch { /* 历史不可用 */ }
  }, [])

  useEffect(() => {
    void loadLexicon()
    void refreshStatsAndSessions()
  }, [loadLexicon, refreshStatsAndSessions])

  const handleSearch = useCallback((q: string) => {
    setLexQuery(q)
  }, [])

  const handleLexiconSubmit = useCallback(async () => {
    const term = lexForm.term.trim()
    if (!term) return
    const aliases = lexForm.aliases.split(/[,，]/).map((a) => a.trim()).filter(Boolean)
    try {
      if (editingId) {
        await voiceWorkstationApi.updateLexicon(editingId, { term, category: lexForm.category, priority: lexForm.priority, aliases })
      } else {
        await voiceWorkstationApi.createLexicon({ term, category: lexForm.category, priority: lexForm.priority, aliases })
      }
      setLexForm({ term: "", category: "影像", priority: 1, aliases: "" })
      setEditingId(null)
      await loadLexicon()
      await refreshStatsAndSessions()
    } catch { /* 校验失败由后端提示 */ }
  }, [lexForm, editingId, loadLexicon, refreshStatsAndSessions])

  const handleLexiconDelete = useCallback(async (id: string) => {
    try {
      await voiceWorkstationApi.deleteLexicon(id)
      await loadLexicon()
      await refreshStatsAndSessions()
    } catch { /* 删除失败 */ }
  }, [loadLexicon, refreshStatsAndSessions])

  const startEdit = useCallback((entry: LexiconEntry) => {
    setEditingId(entry.id)
    setLexForm({ term: entry.term, category: entry.category, priority: entry.priority, aliases: entry.aliases.join(", ") })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setLexForm({ term: "", category: "影像", priority: 1, aliases: "" })
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      chunks.current = []
      startTimeRef.current = Date.now()
      mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data) }
      mediaRecorder.current.onstop = async () => {
        setLoading(true)
        try {
          const blob = new Blob(chunks.current, { type: mediaRecorder.current?.mimeType || "audio/webm" })
          const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
          const res = await asrApi.transcribe(blob, durationSec)
          let finalText = res.text
          let correctionCount = 0
          try {
            const wsRes = await voiceWorkstationApi.transcribe({ text: res.text, reportId: "asr-page" })
            finalText = wsRes.correctedText
            correctionCount = wsRes.corrections.length
          } catch { /* 词库校正不可用,使用原始文本 */ }
          setEngineInfo({ engine: res.engine, corrections: correctionCount })
          setTranscribed(finalText)
          setEditing(finalText)
          setConfidence(res.confidence)
          stream.getTracks().forEach(t => t.stop())
          void refreshStatsAndSessions()
        } finally {
          setLoading(false)
        }
      }
      mediaRecorder.current.start()
      setRecording(true)
    } catch {
      setLoading(true)
      try {
        const res = await asrApi.transcribe()
        let finalText = res.text
        let correctionCount = 0
        try {
          const wsRes = await voiceWorkstationApi.transcribe({ text: res.text, reportId: "asr-page" })
          finalText = wsRes.correctedText
          correctionCount = wsRes.corrections.length
        } catch { /* 词库校正不可用 */ }
        setEngineInfo({ engine: res.engine, corrections: correctionCount })
        setTranscribed(finalText)
        setEditing(finalText)
        setConfidence(res.confidence)
        void refreshStatsAndSessions()
      } finally {
        setLoading(false)
      }
    }
  }, [refreshStatsAndSessions])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop()
      setRecording(false)
    }
  }, [])

  const handleSubmit = () => {
    setSubmitted(true)
  }

  const handleReset = () => {
    setTranscribed("")
    setEditing("")
    setConfidence(0)
    setSubmitted(false)
    setEngineInfo(null)
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<Volume2 size={20} color="#3b82f6" />} title={rt("title")} subtitle={rt("subtitle")} />
      {loadError && <ErrorBanner message={loadError} onRetry={() => { void loadLexicon(); void refreshStatsAndSessions(); }} retryLabel={t('w9.states.retry')} />}
      <div style={{ padding: 24 }}>
        <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: recording ? "#fee2e2" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", transition: "all 0.3s" }}>
              {recording ? <Square size={32} color="#dc2626" /> : <Mic size={32} color="#3b82f6" />}
            </div>
          </div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
            {recording ? rt("recordingHint") : loading ? rt("processing") : rt("clickToRecord")}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            {!recording ? (
              <button onClick={startRecording} disabled={loading} style={{ padding: "10px 24px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <Mic size={16} />{rt("startRecording")}
              </button>
            ) : (
              <button onClick={stopRecording} style={{ padding: "10px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <Square size={16} />{rt("stopRecording")}
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <RefreshCw size={24} color="#3b82f6" style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{rt("transcribing")}</div>
          </div>
        )}

        {transcribed && !loading && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={16} color="#3b82f6" />{rt("transcriptionResult")}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {engineInfo && (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: (ENGINE_BADGES[engineInfo.engine] ?? ENGINE_BADGES.mock)?.color, background: (ENGINE_BADGES[engineInfo.engine] ?? ENGINE_BADGES.mock)?.bg, padding: "2px 8px", borderRadius: 4 }}>
                      {(ENGINE_BADGES[engineInfo.engine] ?? ENGINE_BADGES.mock)?.label}
                    </span>
                    {engineInfo.corrections > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981", background: "#d1fae5", padding: "2px 8px", borderRadius: 4 }}>
                        {t("asrPage.lexiconCorrection", { count: engineInfo.corrections })}
                      </span>
                    )}
                  </>
                )}
                <span style={{ fontSize: 12, color: confidence > 0.9 ? "#10b981" : "#f59e0b", fontWeight: 600, background: confidence > 0.9 ? "#d1fae5" : "#fef3c7", padding: "2px 8px", borderRadius: 4 }}>
                  {rt("confidence")}: {(confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <textarea
              value={editing}
              onChange={e => setEditing(e.target.value)}
              rows={6}
              style={{ width: "100%", padding: 12, border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical" }}
            />
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              {!submitted ? (
                <button onClick={handleSubmit} style={{ padding: "8px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Send size={14} />{rt("submitToReport")}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#10b981", fontWeight: 600, fontSize: 13 }}>
                  <CheckCircle size={16} />{rt("submitted")}
                </div>
              )}
              <button onClick={handleReset} style={{ padding: "8px 20px", background: "var(--bg-card)", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={14} />{rt("reset")}
              </button>
            </div>
          </div>
        )}

        {/* 语音工作站统计卡 */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 16 }}>
            {[
              { label: t("asrPage.statSessions"), value: stats.sessions.total, color: "#3b82f6", bg: "#dbeafe" },
              { label: t("asrPage.statTodaySessions"), value: stats.sessions.today, color: "#10b981", bg: "#d1fae5" },
              { label: t("asrPage.statAvgDuration"), value: stats.sessions.avgDurationSec, color: "#f59e0b", bg: "#fef3c7" },
              { label: t("asrPage.statLexicon"), value: stats.lexiconSize, color: "#8b5cf6", bg: "#ede9fe" },
              { label: t("asrPage.statCorrections"), value: stats.corrections.total, color: "#f43f5e", bg: "#ffe4e6" },
            ].map((card) => (
              <div key={card.label} style={{ background: "var(--bg-card)", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* 词库管理 (CRUD + 检索) */}
        <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={16} color="#8b5cf6" />{t("asrPage.lexiconManagement")}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={lexQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={t("asrPage.searchPlaceholder")}
                  style={{ padding: "6px 10px 6px 30px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, width: 200 }}
                />
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>{t("asrPage.totalEntries", { count: lexicon.length })}</span>
            </div>
          </div>

          {/* 新增/编辑表单 */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <input
              value={lexForm.term}
              onChange={(e) => setLexForm((f) => ({ ...f, term: e.target.value }))}
              placeholder={t("asrPage.termPlaceholder")}
              style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, width: 160 }}
            />
            <select
              value={lexForm.category}
              onChange={(e) => setLexForm((f) => ({ ...f, category: e.target.value as LexiconEntry["category"] }))}
              style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
            >
              {Object.keys(CATEGORY_COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number" min={0} max={10}
              value={lexForm.priority}
              onChange={(e) => setLexForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
              placeholder={t("asrPage.priorityPlaceholder")}
              style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, width: 80 }}
            />
            <input
              value={lexForm.aliases}
              onChange={(e) => setLexForm((f) => ({ ...f, aliases: e.target.value }))}
              placeholder={t("asrPage.aliasesPlaceholder")}
              style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, flex: 1, minWidth: 200 }}
            />
            <button onClick={handleLexiconSubmit} style={{ padding: "6px 14px", background: editingId ? "#f59e0b" : "#3b82f6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {editingId ? <Save size={14} /> : <Plus size={14} />}{editingId ? t("asrPage.saveEdit") : t("asrPage.addEntry")}
            </button>
            {editingId && (
              <button onClick={cancelEdit} style={{ padding: "6px 14px", background: "var(--bg-card)", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <X size={14} />{t("common.action.cancel")}
              </button>
            )}
          </div>

          {/* 词库表格 */}
          <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: "#f1f5f9" }}>
                <tr>
                  {[t("asrPage.colTerm"), t("asrPage.colCategory"), t("asrPage.colPriority"), t("asrPage.colAliases"), t("asrPage.colActions")].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#475569", whiteSpace: "nowrap", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lexicon.slice(0, 100).map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{entry.term}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: CATEGORY_COLORS[entry.category] ?? "#64748b", padding: "2px 8px", borderRadius: 10 }}>{entry.category}</span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{entry.priority}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.aliases.length > 0 ? entry.aliases.join(" / ") : "-"}</td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <button onClick={() => startEdit(entry)} title={t("asrPage.edit")} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", marginRight: 8 }}><Pencil size={14} /></button>
                      <button onClick={() => handleLexiconDelete(entry.id)} title={t("asrPage.delete")} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {lexicon.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>{t("asrPage.emptyLexicon")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 听写历史 + 数据源 */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <History size={16} color="#3b82f6" />{t("asrPage.dictationHistory", { count: sessions.length })}
            </h3>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid #f1f5f9" }}>
                  <ChevronRight size={14} color="#cbd5e1" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t("asrPage.report")} {s.reportId} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· {s.doctorId}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{new Date(s.createdAt).toLocaleString()} · {s.duration}s</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.status === "completed" ? "#10b981" : s.status === "error" ? "#ef4444" : "#f59e0b", background: s.status === "completed" ? "#d1fae5" : s.status === "error" ? "#ffe4e6" : "#fef3c7", padding: "2px 8px", borderRadius: 4 }}>
                    {{ completed: t("asrPage.statusCompleted"), processing: t("asrPage.statusProcessing"), error: t("asrPage.statusError") }[s.status] ?? s.status}
                  </span>
                  {s.correctionCount > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#8b5cf6", background: "#ede9fe", padding: "2px 8px", borderRadius: 4 }}>{t("asrPage.correction")} {s.correctionCount}</span>
                  )}
                </div>
              ))}
              {sessions.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>{t("asrPage.noHistory")}</div>}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Database size={16} color="#10b981" />{t("asrPage.lexiconDistribution")}
            </h3>
            {stats && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stats.categoryCounts.map((c) => {
                  const pct = stats.lexiconSize > 0 ? Math.round((c.count / stats.lexiconSize) * 100) : 0
                  return (
                    <div key={c.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{c.category}</span>
                        <span style={{ color: "#94a3b8" }}>{c.count} {t("asrPage.entriesUnit")} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: CATEGORY_COLORS[c.category] ?? "#94a3b8", borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", lineHeight: 1.8 }}>
              {t("asrPage.dataSource")}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

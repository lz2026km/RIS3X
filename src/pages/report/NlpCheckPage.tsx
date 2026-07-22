import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SpellCheck, BookOpen, Replace, AlertTriangle, CheckCircle, FileText } from "lucide-react"
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { nlpApi, type SpellCheckResult, type TerminologyResult } from "../../services/api/nlpApi"

export default function NlpCheckPage() {
  const { t } = useTranslation("nlp")
  const [text, setText] = useState("")
  const [spellResult, setSpellResult] = useState<SpellCheckResult | null>(null)
  const [termResult, setTermResult] = useState<TerminologyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"spell" | "term">("spell")

  const handleCheck = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      if (activeTab === "spell") {
        const res = await nlpApi.spellcheck(text)
        setSpellResult(res)
      } else {
        const res = await nlpApi.terminology(text)
        setTermResult(res)
      }
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = (offset: number, length: number, replacement: string) => {
    const newText = text.slice(0, offset) + replacement + text.slice(offset + length)
    setText(newText)
    setSpellResult(null)
  }

  const applyTerminology = (offset: number, length: number, preferred: string) => {
    const newText = text.slice(0, offset) + preferred + text.slice(offset + length)
    setText(newText)
    setTermResult(null)
  }

  const applyAll = () => {
    let newText = text
    if (spellResult) {
      for (const s of spellResult.suggestions) {
        if (s.candidates.length > 0) {
          newText = newText.slice(0, s.offset) + s.candidates[0] + newText.slice(s.offset + s.length)
        }
      }
    }
    if (termResult) {
      for (const n of termResult.normalized) {
        newText = newText.slice(0, n.offset) + n.preferred + newText.slice(n.offset + n.length)
      }
    }
    setText(newText)
    setSpellResult(null)
    setTermResult(null)
  }

  const renderHighlighted = () => {
    if (!spellResult && !termResult) return null
    const markers: { offset: number; length: number; color: string; title: string }[] = []
    if (spellResult) {
      for (const s of spellResult.suggestions) {
        markers.push({ offset: s.offset, length: s.length, color: "#f59e0b", title: s.word })
      }
    }
    if (termResult) {
      for (const n of termResult.normalized) {
        markers.push({ offset: n.offset, length: n.term.length, color: "#3b82f6", title: n.term })
      }
    }
    markers.sort((a, b) => a.offset - b.offset)
    if (markers.length === 0) return null

    const parts: { text: string; highlight?: boolean; color?: string; title?: string }[] = []
    let last = 0
    for (const m of markers) {
      if (m.offset > last) parts.push({ text: text.slice(last, m.offset) })
      parts.push({ text: text.slice(m.offset, m.offset + m.length), highlight: true, color: m.color, title: m.title })
      last = m.offset + m.length
    }
    if (last < text.length) parts.push({ text: text.slice(last) })

    return (
      <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>{t("highlightedText")}</div>
        <div style={{ lineHeight: 1.8 }}>
          {parts.map((p, i) =>
            p.highlight ? (
              <span key={i} style={{ background: p.color + "30", borderBottom: `2px solid ${p.color}`, padding: "1px 4px", borderRadius: 3, fontWeight: 600 }} title={p.title}>
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader title={<><FileText size={20} color="#3b82f6" /> {t("title")}</>} subtitle={t("subtitle")} />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setActiveTab("spell")} style={{ padding: "6px 16px", background: activeTab === "spell" ? "#1e40af" : "#fff", color: activeTab === "spell" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "spell" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <SpellCheck size={14} />{t("spellCheck")}
          </button>
          <button onClick={() => setActiveTab("term")} style={{ padding: "6px 16px", background: activeTab === "term" ? "#1e40af" : "#fff", color: activeTab === "term" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "term" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <BookOpen size={14} />{t("terminology")}
          </button>
        </div>

        <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8, display: "block" }}>{t("inputText")}</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            style={{ width: "100%", padding: 12, border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, resize: "vertical", fontFamily: "monospace", lineHeight: 1.6 }}
            placeholder={t("inputPlaceholder")}
          />
          {renderHighlighted()}
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={handleCheck} disabled={loading || !text.trim()} style={{ padding: "8px 20px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={14} />{loading ? t("checking") : t("check")}
            </button>
            {(spellResult || termResult) && (
              <button onClick={applyAll} style={{ padding: "8px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Replace size={14} />{t("replaceAll")}
              </button>
            )}
          </div>
        </div>

        {spellResult && spellResult.suggestions.length > 0 && (
          <div style={{ marginTop: 16, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={16} color="#f59e0b" />{t("suggestions")} ({spellResult.suggestions.length})</h3>
            {spellResult.suggestions.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{s.word}</span>
                <span style={{ color: "#64748b", fontSize: 12 }}>→</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {s.candidates.map((c, ci) => (
                    <button key={ci} onClick={() => applySuggestion(s.offset, s.length, c)} style={{ padding: "2px 10px", background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      <Replace size={10} style={{ marginRight: 4 }} />{c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {spellResult && spellResult.suggestions.length === 0 && (
          <div style={{ marginTop: 16, padding: 16, background: "#d1fae5", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, color: "#065f46" }}>
            <CheckCircle size={16} color="#10b981" />{t("noIssues")}
          </div>
        )}

        {termResult && termResult.normalized.length > 0 && (
          <div style={{ marginTop: 16, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><BookOpen size={16} color="#3b82f6" />{t("termNormalization")} ({termResult.normalized.length})</h3>
            {termResult.normalized.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{n.term}</span>
                <span style={{ color: "#64748b", fontSize: 12 }}>→</span>
                <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{n.preferred}</span>
                <button onClick={() => applyTerminology(n.offset, n.length, n.preferred)} style={{ marginLeft: "auto", padding: "2px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  <Replace size={10} style={{ marginRight: 4 }} />{t("replace")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

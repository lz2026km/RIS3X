import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Code, Search, CheckCircle, AlertTriangle, FileText, BookOpen, ThumbsUp } from "lucide-react"
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { snomedApi, type SnomedCode } from "../../services/api/snomedApi"

export default function SnomedPage() {
  const { t } = useTranslation("snomed")
  const [text, setText] = useState("")
  const [codes, setCodes] = useState<SnomedCode[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [searchQ, setSearchQ] = useState("")
  const [searchResults, setSearchResults] = useState<SnomedCode[]>([])

  const handleEncode = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await snomedApi.encode(text)
      setCodes(res.codes)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQ.trim()) return
    const res = await snomedApi.search(searchQ)
    setSearchResults(res)
  }

  const toggleConfirm = (conceptId: string) => {
    setConfirmed(prev => {
      const next = new Set(prev)
      if (next.has(conceptId)) next.delete(conceptId)
      else next.add(conceptId)
      return next
    })
  }

  const confirmAll = () => {
    setConfirmed(new Set(codes.map(c => c.conceptId)))
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader title={<><Code size={20} color="#3b82f6" /> {t("title")}</>} subtitle={t("subtitle")} />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={16} color="#3b82f6" />{t("reportInput")}
            </h3>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: 12, border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical" }}
              placeholder={t("inputPlaceholder")}
            />
            <div style={{ marginTop: 12 }}>
              <button onClick={handleEncode} disabled={loading || !text.trim()} style={{ padding: "8px 20px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Code size={14} />{loading ? t("encoding") : t("encode")}
              </button>
            </div>

            {codes.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{t("encodedCodes")} ({codes.length})</span>
                  <button onClick={confirmAll} style={{ padding: "4px 12px", background: "#d1fae5", color: "#065f46", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <ThumbsUp size={12} />{t("confirmAll")}
                  </button>
                </div>
                {codes.map((c, i) => (
                  <div key={c.conceptId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <input type="checkbox" checked={confirmed.has(c.conceptId)} onChange={() => toggleConfirm(c.conceptId)} style={{ cursor: "pointer" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{c.pt}</div>
                      <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{c.conceptId} | {c.fsn}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{c.semanticTag}</span>
                    <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: c.confidence > 0.9 ? "#d1fae5" : "#fef3c7", color: c.confidence > 0.9 ? "#065f46" : "#92400e", fontWeight: 600 }}>{(c.confidence * 100).toFixed(0)}%</span>
                    {confirmed.has(c.conceptId) && <CheckCircle size={14} color="#10b981" />}
                  </div>
                ))}
              </div>
            )}

            {codes.length === 0 && !loading && text && (
              <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 6, color: "#94a3b8", fontSize: 12, textAlign: "center" }}>
                {t("noCodesFound")}
              </div>
            )}
          </div>

          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Search size={16} color="#8b5cf6" />{t("searchCodes")}
            </h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder={t("searchPlaceholder")}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
              />
              <button onClick={handleSearch} style={{ padding: "8px 16px", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <Search size={14} />
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              {searchResults.map((c, i) => (
                <div key={c.conceptId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <BookOpen size={14} color="#8b5cf6" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{c.pt}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{c.conceptId} | {c.semanticTag}</div>
                  </div>
                </div>
              ))}
              {searchResults.length === 0 && searchQ && (
                <div style={{ padding: 12, color: "#94a3b8", fontSize: 12, textAlign: "center" }}>{t("noSearchResults")}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

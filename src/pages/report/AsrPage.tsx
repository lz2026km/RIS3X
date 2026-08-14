import { useState, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Mic, Square, FileText, Send, CheckCircle, RefreshCw, Volume2 } from 'lucide-react'
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { asrApi } from "../../services/api/asrApi"

export default function AsrPage() {
  const { t } = useTranslation("asr")
  const [recording, setRecording] = useState(false)
  const [transcribed, setTranscribed] = useState("")
  const [editing, setEditing] = useState("")
  const [confidence, setConfidence] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)

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
          setTranscribed(res.text)
          setEditing(res.text)
          setConfidence(res.confidence)
          stream.getTracks().forEach(t => t.stop())
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
        setTranscribed(res.text)
        setEditing(res.text)
        setConfidence(res.confidence)
      } finally {
        setLoading(false)
      }
    }
  }, [])

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
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<Volume2 size={20} color="#3b82f6" />} title={t("title")} subtitle={t("subtitle")} />
      <div style={{ padding: 24 }}>
        <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: recording ? "#fee2e2" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", transition: "all 0.3s" }}>
              {recording ? <Square size={32} color="#dc2626" /> : <Mic size={32} color="#3b82f6" />}
            </div>
          </div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
            {recording ? t("recordingHint") : loading ? t("processing") : t("clickToRecord")}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            {!recording ? (
              <button onClick={startRecording} disabled={loading} style={{ padding: "10px 24px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <Mic size={16} />{t("startRecording")}
              </button>
            ) : (
              <button onClick={stopRecording} style={{ padding: "10px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <Square size={16} />{t("stopRecording")}
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <RefreshCw size={24} color="#3b82f6" style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{t("transcribing")}</div>
          </div>
        )}

        {transcribed && !loading && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={16} color="#3b82f6" />{t("transcriptionResult")}
              </h3>
              <span style={{ fontSize: 12, color: confidence > 0.9 ? "#10b981" : "#f59e0b", fontWeight: 600, background: confidence > 0.9 ? "#d1fae5" : "#fef3c7", padding: "2px 8px", borderRadius: 4 }}>
                {t("confidence")}: {(confidence * 100).toFixed(0)}%
              </span>
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
                  <Send size={14} />{t("submitToReport")}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#10b981", fontWeight: 600, fontSize: 13 }}>
                  <CheckCircle size={16} />{t("submitted")}
                </div>
              )}
              <button onClick={handleReset} style={{ padding: "8px 20px", background: "var(--bg-card)", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={14} />{t("reset")}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}

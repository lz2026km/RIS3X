import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Camera, Activity, TrendingUp, BarChart3, Calendar, AlertTriangle, CheckCircle } from "lucide-react"
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"

interface AiScoreRecord {
  id: string
  instanceId: string
  modality: string
  motionArtifact: number
  metalArtifact: number
  ringArtifact: number
  exposureLow: number
  exposureNormal: number
  exposureOver: number
  positioningCorrect: number
  positioningMildRotation: number
  positioningSevereOffset: number
  overall: number
  operatorId?: string
  createdAt: string
}

const MOCK_DATA: AiScoreRecord[] = Array.from({ length: 24 }, (_, i) => {
  const modalities = ["CT", "MR", "DR", "CBCT"]
  const mod = modalities[i % 4]
  return {
    id: `ai-${i}`,
    instanceId: `inst-${1000 + i}`,
    modality: mod,
    motionArtifact: +(2 + Math.random() * 3).toFixed(1),
    metalArtifact: +(2 + Math.random() * 3).toFixed(1),
    ringArtifact: +(2 + Math.random() * 3).toFixed(1),
    exposureLow: +(2 + Math.random() * 3).toFixed(1),
    exposureNormal: +(2 + Math.random() * 3).toFixed(1),
    exposureOver: +(2 + Math.random() * 3).toFixed(1),
    positioningCorrect: +(2 + Math.random() * 3).toFixed(1),
    positioningMildRotation: +(2 + Math.random() * 3).toFixed(1),
    positioningSevereOffset: +(2 + Math.random() * 3).toFixed(1),
    overall: +(2 + Math.random() * 3).toFixed(1),
    operatorId: `op-${(i % 3) + 1}`,
    createdAt: new Date(2026, 6, 1 + Math.floor(i / 2)).toISOString(),
  }
})

const artifactAvg = (r: AiScoreRecord) => (r.motionArtifact + r.metalArtifact + r.ringArtifact) / 3
const exposureAvg = (r: AiScoreRecord) => (r.exposureLow + r.exposureNormal + r.exposureOver) / 3
const positioningAvg = (r: AiScoreRecord) => (r.positioningCorrect + r.positioningMildRotation + r.positioningSevereOffset) / 3

const MODALITY_OPTIONS = ["all", "CT", "MR", "DR", "CBCT"]

export default function QcImageAiPage() {
  const { t } = useTranslation("v3qcai")
  const [modality, setModality] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const filtered = useMemo(() => {
    return MOCK_DATA.filter(r => {
      if (modality !== "all" && r.modality !== modality) return false
      if (dateFrom && r.createdAt.slice(0, 10) < dateFrom) return false
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [modality, dateFrom, dateTo])

  const stats = useMemo(() => {
    const total = filtered.length
    if (total === 0) return { total, avgArtifact: 0, avgExposure: 0, avgPositioning: 0, avgOverall: 0, excellent: 0, good: 0, poor: 0 }
    const avgArtifact = filtered.reduce((s, r) => s + artifactAvg(r), 0) / total
    const avgExposure = filtered.reduce((s, r) => s + exposureAvg(r), 0) / total
    const avgPositioning = filtered.reduce((s, r) => s + positioningAvg(r), 0) / total
    const avgOverall = filtered.reduce((s, r) => s + r.overall, 0) / total
    const excellent = filtered.filter(r => r.overall >= 4).length
    const good = filtered.filter(r => r.overall >= 3 && r.overall < 4).length
    const poor = filtered.filter(r => r.overall < 3).length
    return { total, avgArtifact, avgExposure, avgPositioning, avgOverall, excellent, good, poor }
  }, [filtered])

  const chartBarMax = 5

  const trendData = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const r of filtered) {
      const d = r.createdAt.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(r.overall)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, scores]) => ({
      date,
      avgOverall: scores.reduce((s, x) => s + x, 0) / scores.length,
    }))
  }, [filtered])

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader title={<><Camera size={20} color="#3b82f6" /> {t("title")}</>} subtitle={t("subtitle")} />

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {MODALITY_OPTIONS.map(m => (
            <button key={m} onClick={() => setModality(m)} style={{ padding: "6px 14px", background: modality === m ? "#1e40af" : "#fff", color: modality === m ? "#fff" : "#475569", border: "1px solid " + (modality === m ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {m === "all" ? t("all") : m}
            </button>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
            <Calendar size={14} color="#64748b" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
            <span style={{ color: "#94a3b8" }}>~</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
          </div>
        </div>

        <StatCardGrid columns={4} gap={12}>
          <StatCard label={t("totalScores")} value={stats.total} icon={<Activity size={20} />} color="#3b82f6" />
          <StatCard label={t("avgArtifact")} value={stats.avgArtifact.toFixed(1)} icon={<AlertTriangle size={20} />} color="#f59e0b" subValue={artifactLabel(stats.avgArtifact)} />
          <StatCard label={t("avgExposure")} value={stats.avgExposure.toFixed(1)} icon={<BarChart3 size={20} />} color="#10b981" subValue={artifactLabel(stats.avgExposure)} />
          <StatCard label={t("avgPositioning")} value={stats.avgPositioning.toFixed(1)} icon={<CheckCircle size={20} />} color="#8b5cf6" subValue={artifactLabel(stats.avgPositioning)} />
        </StatCardGrid>

        <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>{t("artifactScore")}</h3>
            <BarChart data={filtered} getValue={artifactAvg} color="#f59e0b" max={chartBarMax} />
          </div>
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>{t("exposureScore")}</h3>
            <BarChart data={filtered} getValue={exposureAvg} color="#10b981" max={chartBarMax} />
          </div>
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>{t("positioningScore")}</h3>
            <BarChart data={filtered} getValue={positioningAvg} color="#8b5cf6" max={chartBarMax} />
          </div>
        </div>

        <div style={{ marginTop: 24, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>{t("overallTrend")}</h3>
          {trendData.length > 0 ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "0 8px" }}>
              {trendData.map((p, i) => {
                const h = (p.avgOverall / chartBarMax) * 100
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{p.avgOverall.toFixed(1)}</span>
                    <div style={{ width: "100%", maxWidth: 32, height: 100, background: "#f1f5f9", borderRadius: "4px 4px 0 0", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${h}%`, background: "#3b82f6", borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 9, color: "#94a3b8", transform: "rotate(-45deg)", whiteSpace: "nowrap" }}>{p.date.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{t("noData")}</div>
          )}
        </div>

        <div style={{ marginTop: 24, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>{t("scoreTable")}</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[t("instanceId"), t("modality"), t("artifactScore"), t("exposureScore"), t("positioningScore"), t("overallScore"), t("scoreDate")].map(h => (
                    <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(r => {
                  const a = artifactAvg(r)
                  const e = exposureAvg(r)
                  const p = positioningAvg(r)
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 10, fontFamily: "monospace", fontSize: 11 }}>{r.instanceId}</td>
                      <td style={{ padding: 10 }}><span style={{ background: modalityColor(r.modality), color: "#fff", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{r.modality}</span></td>
                      <td style={{ padding: 10 }}>{scoreBadge(a)}</td>
                      <td style={{ padding: 10 }}>{scoreBadge(e)}</td>
                      <td style={{ padding: 10 }}>{scoreBadge(p)}</td>
                      <td style={{ padding: 10 }}>{scoreBadge(r.overall)}</td>
                      <td style={{ padding: 10, color: "#64748b" }}>{r.createdAt.slice(0, 10)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

function BarChart({ data, getValue, color, max }: { data: AiScoreRecord[]; getValue: (r: AiScoreRecord) => number; color: string; max: number }) {
  const items = data.slice(0, 20)
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100, padding: "0 4px" }}>
      {items.map((r, i) => {
        const h = (getValue(r) / max) * 100
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: "100%", maxWidth: 20, height: 80, background: "#f1f5f9", borderRadius: "3px 3px 0 0", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${h}%`, background: color, borderRadius: "3px 3px 0 0", transition: "height 0.3s" }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function artifactLabel(score: number): string {
  if (score >= 4.5) return "优秀"
  if (score >= 3.5) return "良好"
  return score >= 2.5 ? "一般" : "较差"
}

function scoreBadge(score: number) {
  const color = score >= 4 ? "#10b981" : score >= 3 ? "#f59e0b" : "#dc2626"
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: score >= 4 ? "#d1fae5" : score >= 3 ? "#fef3c7" : "#fee2e2", color }}>{score.toFixed(1)}</span>
}

function modalityColor(mod: string): string {
  const map: Record<string, string> = { CT: "#3b82f6", MR: "#8b5cf6", DR: "#10b981", CBCT: "#f59e0b" }
  return map[mod] ?? "#64748b"
}

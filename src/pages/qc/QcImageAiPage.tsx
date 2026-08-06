import { useMemo, useState } from 'react'
import { useTranslation } from "react-i18next"
import { Camera, Activity, TrendingUp, BarChart3, Calendar, AlertTriangle, Zap, Target, Eye } from 'lucide-react'
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"

interface ArtifactScores {
  motion: number
  metal: number
  ring: number
}

interface PositioningScores {
  setup: number
  rotation: number
  offset: number
}

interface ExposureScore {
  value: string
  score: number
}

interface AiScoreRecordV2 {
  id: string
  instanceId: string
  modality: string
  artifactScores: ArtifactScores
  positioningScores: PositioningScores
  exposure: ExposureScore
  overall: number
  operatorId?: string
  createdAt: string
}

const MODALITIES = ["CT", "MR", "DR", "CBCT"]
const EXPOSURE_VALUES = ["不足", "正常", "过度"]

const MOCK_DATA_V2: AiScoreRecordV2[] = Array.from({ length: 24 }, (_, i) => {
  const mod = MODALITIES[i % 4]
  const ev = EXPOSURE_VALUES[i % 3]
  return {
    id: `v2-${i}`,
    instanceId: `inst-${2000 + i}`,
    modality: mod,
    artifactScores: {
      motion: +(2 + Math.random() * 3).toFixed(1),
      metal: +(2 + Math.random() * 3).toFixed(1),
      ring: +(2 + Math.random() * 3).toFixed(1),
    },
    positioningScores: {
      setup: +(2 + Math.random() * 3).toFixed(1),
      rotation: +(2 + Math.random() * 3).toFixed(1),
      offset: +(2 + Math.random() * 3).toFixed(1),
    },
    exposure: { value: ev, score: +(2 + Math.random() * 3).toFixed(1) },
    overall: +(2 + Math.random() * 3).toFixed(1),
    operatorId: `op-${(i % 3) + 1}`,
    createdAt: new Date(2026, 6, 1 + Math.floor(i / 2)).toISOString(),
  }
})

const MODALITY_OPTIONS = ["all", "CT", "MR", "DR", "CBCT"]

export default function QcImageAiPage() {
  const { t } = useTranslation("v3qcai")
  const [modality, setModality] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeTab, setActiveTab] = useState<"v1" | "v2">("v2")

  const filtered = useMemo(() => {
    return MOCK_DATA_V2.filter(r => {
      if (modality !== "all" && r.modality !== modality) return false
      if (dateFrom && r.createdAt.slice(0, 10) < dateFrom) return false
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false
      return true
    })
  }, [modality, dateFrom, dateTo])

  const stats = useMemo(() => {
    const total = filtered.length
    if (total === 0) return { total, avgArtifactOverall: 0, avgPositioningOverall: 0, avgExposure: 0, avgOverall: 0, excellent: 0, good: 0, poor: 0 }
    const avgArtifactOverall = filtered.reduce((s, r) => s + (r.artifactScores.motion + r.artifactScores.metal + r.artifactScores.ring) / 3, 0) / total
    const avgPositioningOverall = filtered.reduce((s, r) => s + (r.positioningScores.setup + r.positioningScores.rotation + r.positioningScores.offset) / 3, 0) / total
    const avgExposure = filtered.reduce((s, r) => s + r.exposure.score, 0) / total
    const avgOverall = filtered.reduce((s, r) => s + r.overall, 0) / total
    const excellent = filtered.filter(r => r.overall >= 4).length
    const good = filtered.filter(r => r.overall >= 3 && r.overall < 4).length
    const poor = filtered.filter(r => r.overall < 3).length
    return { total, avgArtifactOverall, avgPositioningOverall, avgExposure, avgOverall, excellent, good, poor }
  }, [filtered])

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

        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          <button onClick={() => setActiveTab("v1")} style={{ padding: "6px 16px", background: activeTab === "v1" ? "#1e40af" : "#fff", color: activeTab === "v1" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "v1" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            V1
          </button>
          <button onClick={() => setActiveTab("v2")} style={{ padding: "6px 16px", background: activeTab === "v2" ? "#1e40af" : "#fff", color: activeTab === "v2" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "v2" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            V2 {t("detailed")}
          </button>
        </div>

        <StatCardGrid columns={4} gap={12}>
          <StatCard label={t("totalScores")} value={stats.total} icon={<Activity size={20} />} color="#3b82f6" />
          <StatCard label={t("artifactScore")} value={stats.avgArtifactOverall.toFixed(1)} icon={<AlertTriangle size={20} />} color="#f59e0b" subValue={artifactLabel(stats.avgArtifactOverall)} />
          <StatCard label={t("positioningScore")} value={stats.avgPositioningOverall.toFixed(1)} icon={<Target size={20} />} color="#8b5cf6" subValue={artifactLabel(stats.avgPositioningOverall)} />
          <StatCard label={t("exposureScore")} value={stats.avgExposure.toFixed(1)} icon={<BarChart3 size={20} />} color="#10b981" subValue={artifactLabel(stats.avgExposure)} />
        </StatCardGrid>

        {activeTab === "v2" && (
          <>
            <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
              <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><Zap size={16} color="#f59e0b" /> {t("artifactDetail")}</h3>
                <SubBarChart data={filtered} getValues={r => [r.artifactScores.motion, r.artifactScores.metal, r.artifactScores.ring]} colors={["#f59e0b", "#ef4444", "#8b5cf6"]} labels={[t("motion"), t("metal"), t("ring")]} max={5} />
              </div>
              <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><Eye size={16} color="#8b5cf6" /> {t("positioningDetail")}</h3>
                <SubBarChart data={filtered} getValues={r => [r.positioningScores.setup, r.positioningScores.rotation, r.positioningScores.offset]} colors={["#8b5cf6", "#3b82f6", "#06b6d4"]} labels={[t("setup"), t("rotation"), t("offset")]} max={5} />
              </div>
              <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><Activity size={16} color="#10b981" /> {t("exposureDetail")}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
                  {EXPOSURE_VALUES.map(ev => {
                    const items = filtered.filter(r => r.exposure.value === ev)
                    const avg = items.length ? items.reduce((s, r) => s + r.exposure.score, 0) / items.length : 0
                    const color = ev === "正常" ? "#10b981" : ev === "不足" ? "#f59e0b" : "#ef4444"
                    return (
                      <div key={ev} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 40, fontSize: 12, fontWeight: 600, color }}>{ev}</span>
                        <div style={{ flex: 1, height: 12, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ width: `${(avg / 5) * 100}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ width: 30, fontSize: 11, fontWeight: 700, color: "#475569", textAlign: "right" }}>{avg.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={18} color="#3b82f6" /> {t("overallTrend")}</h3>
              {trendData.length > 0 ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "0 8px" }}>
                  {trendData.map((p, i) => {
                    const h = (p.avgOverall / 5) * 100
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{p.avgOverall.toFixed(1)}</span>
                        <div style={{ width: "100%", maxWidth: 32, height: 100, background: "#f1f5f9", borderRadius: "4px 4px 0 0", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${h}%`, background: "linear-gradient(to top, #3b82f6, #60a5fa)", borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
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
          </>
        )}

        <div style={{ marginTop: 24, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>{t("scoreTable")}</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[t("instanceId"), t("modality"), t("artifactScore"), t("positioningScore"), t("exposureScore"), t("overallScore"), t("scoreDate")].map(h => (
                    <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(r => {
                  const a = (r.artifactScores.motion + r.artifactScores.metal + r.artifactScores.ring) / 3
                  const p = (r.positioningScores.setup + r.positioningScores.rotation + r.positioningScores.offset) / 3
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 10, fontFamily: "monospace", fontSize: 11 }}>{r.instanceId}</td>
                      <td style={{ padding: 10 }}><span style={{ background: modalityColor(r.modality), color: "#fff", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{r.modality}</span></td>
                      <td style={{ padding: 10 }}>{scoreBadge(a)}</td>
                      <td style={{ padding: 10 }}>{scoreBadge(p)}</td>
                      <td style={{ padding: 10 }}>{scoreBadge(r.exposure.score)}</td>
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

function SubBarChart({ data, getValues, colors, labels, max }: {
  data: AiScoreRecordV2[]
  getValues: (r: AiScoreRecordV2) => number[]
  colors: string[]
  labels: string[]
  max: number
}) {
  const items = data.slice(0, 20)
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {labels.map((l, i) => (
          <span key={l} style={{ fontSize: 11, fontWeight: 600, color: colors[i], display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[i], display: "inline-block" }} />{l}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
        {items.map((r, i) => {
          const vals = getValues(r)
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <div style={{ width: "100%", maxWidth: 24, height: 70, background: "#f1f5f9", borderRadius: "2px", position: "relative", overflow: "hidden" }}>
                {vals.map((v, vi) => {
                  const bottom = vals.slice(0, vi).reduce((s, x) => s + (x / max) * 70, 0)
                  return <div key={vi} style={{ position: "absolute", bottom: bottom, left: 0, right: 0, height: `${(v / max) * 70}px`, background: colors[vi], borderRadius: "2px 2px 0 0", transition: "height 0.3s" }} />
                })}
              </div>
            </div>
          )
        })}
      </div>
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
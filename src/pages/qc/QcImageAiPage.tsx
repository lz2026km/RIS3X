import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"
import { DataTable } from "../../components/common"
import { qcImageAiApi } from "../../services/api/qcImageAiApi"
import { QcImageAiScoreV2Result, QcImageAiScoreV1Result, QcImageAiStatsV2 } from '../../services/api/qcImageAiApi'
import { t as tr } from "../../i18n/appI18n"
// [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-IIA-01 图像伪影率
import { RqiIndicatorLink } from "../../components/qc/RqiIndicatorLink"
import { Button, Input, Select, Space, Alert, Spin, Tag } from 'antd'
import { Camera, Activity, TrendingUp, BarChart3, Calendar, AlertTriangle, Zap, Target, Eye, Sparkles, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from "react-i18next"

// [v3.0.6.11-75] W1-2: QcImageAiPage 接入真实 qcImageAiApi
//   后端 backend/src/modules/qc/image-ai.controller.ts:
//     POST /qc/image-ai/score-v2, GET /qc/image-ai/result-v2/:instanceId, GET /qc/image-ai/stats-v2

const MODALITIES = ["CT", "MR", "DR", "CBCT"]
const EXPOSURE_VALUES = ["不足", "正常", "过度"]
const SAMPLE_INSTANCES = ['inst-2000', 'inst-2001', 'inst-2002', 'inst-2003', 'inst-2004']
const MODALITY_OPTIONS = ["all", ...MODALITIES]

const DEFAULT_ARTIFACT = { motion: 4, metal: 4, ring: 4 }
const DEFAULT_POSITIONING = { setup: 4, rotation: 4, offset: 4 }

export default function QcImageAiPage() {
  const { t } = useTranslation("v3qcai")
  const [modality, setModality] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeTab, setActiveTab] = useState<"v1" | "v2">("v2")

  // ── API 数据 ─────────────────────────────────────────────
  const [records, setRecords] = useState<QcImageAiScoreV2Result[]>([])
  const [stats, setStats] = useState<QcImageAiStatsV2 | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState("")

  // ── 评分表单 ─────────────────────────────────────────────
  const [instanceId, setInstanceId] = useState("")
  const [scoreModality, setScoreModality] = useState("CT")
  const [scoring, setScoring] = useState(false)
  const [scored, setScored] = useState<QcImageAiScoreV2Result | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<QcImageAiScoreV2Result | null>(null)

  // [v3.0.6.11-104 Wave 2C] V2 结果列表回读 (GET /qc/image-ai/result-v2) 三态
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState("")

  // [v3.0.6.11-104 Wave 2C] V1 结果按实例查询 (GET /qc/image-ai/result/:instanceId)
  const [lookupId, setLookupId] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<QcImageAiScoreV1Result | null>(null)
  const [lookupError, setLookupError] = useState("")

  const loadRecords = useCallback(async (m: string, from: string, to: string) => {
    setRecordsLoading(true)
    setRecordsError("")
    try {
      const params: { modality?: string; dateFrom?: string; dateTo?: string } = {}
      if (m !== "all") params.modality = m
      if (from) params.dateFrom = from
      if (to) params.dateTo = to
      const res = await qcImageAiApi.listV2Results(params)
      if (res.success && Array.isArray(res.data)) setRecords(res.data)
      else setRecordsError(res.error?.message ?? tr("qcai.resultList.loadFailed"))
    } catch (e) {
      setRecordsError((e as Error)?.message ?? tr("qcai.resultList.loadFailed"))
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecords(modality, dateFrom, dateTo)
  }, [modality, dateFrom, dateTo, loadRecords])

  const lookupByInstance = useCallback(async () => {
    const id = lookupId.trim()
    if (!id) {
      setLookupError(tr("qcai.lookup.required"))
      return
    }
    setLookupLoading(true)
    setLookupError("")
    setLookupResult(null)
    try {
      const res = await qcImageAiApi.getResultV1(id)
      if (res.success && res.data) setLookupResult(res.data)
      else setLookupError(res.error?.message ?? tr("qcai.lookup.notFound"))
    } catch (e) {
      setLookupError((e as Error)?.message ?? tr("qcai.lookup.notFound"))
    } finally {
      setLookupLoading(false)
    }
  }, [lookupId])

  const loadStats = useCallback(async (m: string, from: string, to: string) => {
    setLoadingStats(true)
    setError("")
    try {
      const params: { modality?: string; dateFrom?: string; dateTo?: string } = {}
      if (m !== "all") params.modality = m
      if (from) params.dateFrom = from
      if (to) params.dateTo = to
      const res = await qcImageAiApi.getStatsV2(params)
      if (res.success) setStats(res.data)
      else setError(res.error?.message ?? "统计加载失败")
    } catch (e) {
      setError((e as Error)?.message ?? "统计加载失败")
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    void loadStats(modality, dateFrom, dateTo)
  }, [modality, dateFrom, dateTo, loadStats])

  const runScore = useCallback(async () => {
    const target = instanceId.trim()
    if (!target) {
      setError("请先输入影像实例 ID")
      return
    }
    setScoring(true)
    setError("")
    try {
      const res = await qcImageAiApi.scoreV2({
        instanceId: target,
        modality: scoreModality,
        artifactScores: DEFAULT_ARTIFACT,
        positioningScores: DEFAULT_POSITIONING,
        exposure: { value: "正常", score: 4 },
        overall: 4,
      })
      if (!res.success) {
        setError(res.error?.message ?? "AI 评分失败")
        return
      }
      setScored(res.data)
      setRecords((prev) => {
        const next = [res.data, ...prev.filter((r) => r.instanceId !== res.data.instanceId)]
        return next.slice(0, 100)
      })
      setDetail(res.data)
      void loadStats(modality, dateFrom, dateTo)
    } catch (e) {
      setError((e as Error)?.message ?? "AI 评分失败")
    } finally {
      setScoring(false)
    }
  }, [instanceId, scoreModality, modality, dateFrom, dateTo, loadStats])

  const viewResult = useCallback(async (id: string) => {
    setDetailLoading(true)
    setError("")
    try {
      const res = await qcImageAiApi.getResultV2(id)
      if (!res.success) {
        setError(res.error?.message ?? "结果查询失败")
        return
      }
      setDetail(res.data)
    } catch (e) {
      setError((e as Error)?.message ?? "结果查询失败")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const filtered = useMemo(() => records, [records])

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

  const statCards = [
    { label: t("totalScores"), value: stats?.totalScores ?? 0, icon: <Activity size={20} />, color: "#3b82f6", sub: "" },
    { label: t("artifactScore"), value: (stats?.avgArtifactOverall ?? 0).toFixed(1), icon: <AlertTriangle size={20} />, color: "#f59e0b", sub: artifactLabel(stats?.avgArtifactOverall ?? 0) },
    { label: t("positioningScore"), value: (stats?.avgPositioningOverall ?? 0).toFixed(1), icon: <Target size={20} />, color: "#8b5cf6", sub: artifactLabel(stats?.avgPositioningOverall ?? 0) },
    { label: t("exposureScore"), value: (stats?.avgExposureScore ?? 0).toFixed(1), icon: <BarChart3 size={20} />, color: "#10b981", sub: artifactLabel(stats?.avgExposureScore ?? 0) },
  ]

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<Camera size={20} color="#3b82f6" />} title={t("title")} subtitle={t("subtitle")}
        actions={<Button size="small" icon={<RefreshCw size={12} />} loading={loadingStats} onClick={() => void loadStats(modality, dateFrom, dateTo)}>刷新统计</Button>} />

      <div style={{ padding: 24 }}>
        {/* [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-IIA-01 图像伪影率 */}
        <RqiIndicatorLink code="RQI-IIA-01" />
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {MODALITY_OPTIONS.map(m => (
            <button key={m} onClick={() => setModality(m)} style={{ padding: "6px 14px", background: modality === m ? "#1e40af" : "var(--bg-card)", color: modality === m ? "#fff" : "#475569", border: "1px solid " + (modality === m ? "#1e40af" : "var(--border-color)"), borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
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

        {error && (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error}
            action={<Button size="small" onClick={() => { setError(""); void loadStats(modality, dateFrom, dateTo) }}><RefreshCw size={14} /> 重试</Button>} />
        )}

        {stats && stats.totalScores === 0 && (
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Tag color="orange">{tr("w2Empty.demoData")}</Tag>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{tr("w2Empty.noDataHint")}</span>
          </div>
        )}

        <Spin spinning={loadingStats && !stats}>
          <StatCardGrid gap={12}>
            {statCards.map((s, i) => (
              <StatCard key={i} title={s.label} value={s.value} icon={s.icon} color={s.color} sub={s.sub} />
            ))}
          </StatCardGrid>
        </Spin>

        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          <button onClick={() => setActiveTab("v1")} style={{ padding: "6px 16px", background: activeTab === "v1" ? "#1e40af" : "var(--bg-card)", color: activeTab === "v1" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "v1" ? "#1e40af" : "var(--border-color)"), borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            V1
          </button>
          <button onClick={() => setActiveTab("v2")} style={{ padding: "6px 16px", background: activeTab === "v2" ? "#1e40af" : "var(--bg-card)", color: activeTab === "v2" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "v2" ? "#1e40af" : "var(--border-color)"), borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            V2 {t("detailed")}
          </button>
        </div>

        {/* AI 评分流程 (选影像 -> score-v2 -> 结果) */}
        <div style={{ marginBottom: 24, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={18} color="#8b5cf6" /> AI 影像质控评分
          </h3>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input placeholder="影像实例 ID" value={instanceId} onChange={e => setInstanceId(e.target.value)} onPressEnter={() => void runScore()} style={{ width: 300 }} allowClear />
            <Select value={scoreModality} onChange={setScoreModality} style={{ width: 110 }} options={MODALITIES.map(m => ({ value: m, label: m }))} />
            <Button type="primary" icon={<Zap size={14} />} loading={scoring} onClick={() => void runScore()}>开始 AI 评分</Button>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>示例:</span>
            {SAMPLE_INSTANCES.map(s => (
              <Button key={s} size="small" onClick={() => { setInstanceId(s); setScoreModality(MODALITIES[s.length % MODALITIES.length] ?? "CT") }}>{s}</Button>
            ))}
          </Space>
          {scored && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", background: "var(--bg-card)", borderRadius: 8, padding: 12 }}>
              <ScoreBlock title="伪影" scores={[scored.artifactScores.motion, scored.artifactScores.metal, scored.artifactScores.ring]} labels={["运动", "金属", "环状"]} colors={["#f59e0b", "#ef4444", "#8b5cf6"]} />
              <ScoreBlock title="摆位" scores={[scored.positioningScores.setup, scored.positioningScores.rotation, scored.positioningScores.offset]} labels={["摆位", "旋转", "偏移"]} colors={["#8b5cf6", "#3b82f6", "#06b6d4"]} />
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>曝光: {scored.exposure.value} ({scored.exposure.score})</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(scored.overall) }}>{scored.overall.toFixed(1)}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>综合评分 ({scored.instanceId})</div>
              </div>
            </div>
          )}
        </div>

        {/* [v3.0.6.11-104 Wave 2C] AI 质控结果回读: 按实例查询 (V1) + V2 结果列表 (三态) */}
        <div style={{ marginBottom: 24, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }} data-testid="qcai-result-readback">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <Eye size={18} color="#3b82f6" /> {tr("qcai.lookup.title")}
          </h3>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input placeholder={tr("qcai.lookup.placeholder")} value={lookupId} onChange={e => setLookupId(e.target.value)} onPressEnter={() => void lookupByInstance()} style={{ width: 300 }} allowClear />
            <Button type="primary" icon={<Search size={14} />} loading={lookupLoading} onClick={() => void lookupByInstance()}>{tr("qcai.lookup.button")}</Button>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>{tr("qcai.lookup.endpointHint")}</span>
          </Space>

          {lookupLoading ? (
            <div style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}><Spin /></div>
          ) : lookupError ? (
            <Alert type="warning" showIcon message={lookupError} />
          ) : lookupResult ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", background: "var(--bg-card)", borderRadius: 8, padding: 12 }} data-testid="qcai-v1-result">
              <ScoreBlock title={tr("qcai.lookup.artifact")} scores={[lookupResult.motionArtifact, lookupResult.metalArtifact, lookupResult.ringArtifact]} labels={[tr("qcai.motion"), tr("qcai.metal"), tr("qcai.ring")]} colors={["#f59e0b", "#ef4444", "#8b5cf6"]} />
              <ScoreBlock title={tr("qcai.lookup.positioning")} scores={[lookupResult.positioningCorrect, lookupResult.positioningMildRotation, lookupResult.positioningSevereOffset]} labels={[tr("qcai.setup"), tr("qcai.rotation"), tr("qcai.offset")]} colors={["#8b5cf6", "#3b82f6", "#06b6d4"]} />
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>{tr("qcai.lookup.overall")}: {lookupResult.overall.toFixed(1)}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(lookupResult.overall) }}>{lookupResult.overall.toFixed(1)}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{lookupResult.instanceId} · {lookupResult.modality}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>{tr("qcai.lookup.empty")}</div>
          )}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-color)", fontSize: 12, color: "#64748b" }}>
            {recordsLoading ? (
              <span><Spin size="small" /> {tr("qcai.resultList.loading")}</span>
            ) : recordsError ? (
              <span style={{ color: "#dc2626" }}>{tr("qcai.resultList.loadFailed")}: {recordsError}</span>
            ) : records.length === 0 ? (
              <span>{tr("qcai.resultList.empty")}</span>
            ) : (
              <span>{tr("qcai.resultList.summary", { count: records.length })}</span>
            )}
          </div>
        </div>

        {activeTab === "v2" && (
          <>
            <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
              <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><Zap size={16} color="#f59e0b" /> {t("artifactDetail")}</h3>
                <SubBarChart data={filtered} getValues={r => [r.artifactScores.motion, r.artifactScores.metal, r.artifactScores.ring]} colors={["#f59e0b", "#ef4444", "#8b5cf6"]} labels={[t("motion"), t("metal"), t("ring")]} max={5} />
              </div>
              <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><Eye size={16} color="#8b5cf6" /> {t("positioningDetail")}</h3>
                <SubBarChart data={filtered} getValues={r => [r.positioningScores.setup, r.positioningScores.rotation, r.positioningScores.offset]} colors={["#8b5cf6", "#3b82f6", "#06b6d4"]} labels={[t("setup"), t("rotation"), t("offset")]} max={5} />
              </div>
              <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><Activity size={16} color="#10b981" /> {t("exposureDetail")}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
                  {EXPOSURE_VALUES.map(ev => {
                    const items = filtered.filter(r => r.exposure.value === ev)
                    const avg = items.length ? items.reduce((s, r) => s + r.exposure.score, 0) / items.length : 0
                    const color = ev === "正常" ? "#10b981" : ev === "不足" ? "#f59e0b" : "#ef4444"
                    return (
                      <div key={ev} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 40, fontSize: 12, fontWeight: 600, color }}>{ev}</span>
                        <div style={{ flex: 1, height: 12, background: "var(--border-color)", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ width: `${(avg / 5) * 100}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ width: 30, fontSize: 11, fontWeight: 700, color: "#475569", textAlign: "right" }}>{avg.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={18} color="#3b82f6" /> {t("overallTrend")}</h3>
              {trendData.length > 0 ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "0 8px" }}>
                  {trendData.map((p, i) => {
                    const h = (p.avgOverall / 5) * 100
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{p.avgOverall.toFixed(1)}</span>
                        <div style={{ width: "100%", maxWidth: 32, height: 100, background: "var(--border-color)", borderRadius: "4px 4px 0 0", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${h}%`, background: "linear-gradient(to top, #3b82f6, #60a5fa)", borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "#94a3b8", transform: "rotate(-45deg)", whiteSpace: "nowrap" }}>{p.date.slice(5)}</span>
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

        <div style={{ marginTop: 24, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>{t("scoreTable")}</h3>
          <Spin spinning={detailLoading || recordsLoading}>
            <div style={{ overflowX: "auto" }}>
              <DataTable
                rowKey="id"
                dataSource={filtered.slice(0, 50)}
                showPagination={false}
                showExport={false}
                showDensity={false}
                emptyText={`${t("noData")} - 在上方输入实例 ID 执行 AI 评分后展示真实结果`}
                columns={[
                  { title: t("instanceId"), dataIndex: "instanceId", key: "instanceId", render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: 11 }}>{v}</span> },
                  {
                    title: t("modality"), dataIndex: "modality", key: "modality",
                    render: (v: string) => <span style={{ background: modalityColor(v), color: "#fff", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{v}</span>,
                  },
                  { title: t("artifactScore"), key: "artifactScore", render: (_: unknown, r: QcImageAiScoreV2Result) => scoreBadge((r.artifactScores.motion + r.artifactScores.metal + r.artifactScores.ring) / 3) },
                  { title: t("positioningScore"), key: "positioningScore", render: (_: unknown, r: QcImageAiScoreV2Result) => scoreBadge((r.positioningScores.setup + r.positioningScores.rotation + r.positioningScores.offset) / 3) },
                  { title: t("exposureScore"), key: "exposureScore", render: (_: unknown, r: QcImageAiScoreV2Result) => scoreBadge(r.exposure.score) },
                  { title: t("overallScore"), dataIndex: "overall", key: "overall", render: (v: number) => scoreBadge(v) },
                  { title: t("scoreDate"), dataIndex: "createdAt", key: "createdAt", render: (v: string) => <span style={{ color: "#64748b" }}>{v.slice(0, 10)}</span> },
                  {
                    title: "操作", key: "actions",
                    render: (_: unknown, r: QcImageAiScoreV2Result) => (
                      <Button size="small" type="link" icon={<Eye size={12} />} onClick={() => void viewResult(r.instanceId)}>结果详情</Button>
                    ),
                  },
                ]}
              />
            </div>
          </Spin>
          {detail && (
            <div style={{ marginTop: 12, background: "var(--color-info-bg)", borderRadius: 8, padding: 12, fontSize: 12, color: "var(--text-primary)" }}>
              <b>详情</b> - {detail.instanceId} [{detail.modality}]
              <span style={{ marginLeft: 12 }}>伪影: {detail.artifactScores.motion}/{detail.artifactScores.metal}/{detail.artifactScores.ring}</span>
              <span style={{ marginLeft: 12 }}>摆位: {detail.positioningScores.setup}/{detail.positioningScores.rotation}/{detail.positioningScores.offset}</span>
              <span style={{ marginLeft: 12 }}>曝光: {detail.exposure.value} {detail.exposure.score}</span>
              <span style={{ marginLeft: 12 }}>综合: <b>{detail.overall}</b></span>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

function ScoreBlock({ title, scores, labels, colors }: { title: string; scores: number[]; labels: string[]; colors: string[] }) {
  return (
    <div style={{ flex: "1 1 220px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {scores.map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(s) }}>{s.toFixed(1)}</div>
            <div style={{ fontSize: 11, color: colors[i] }}>{labels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubBarChart({ data, getValues, colors, labels, max }: {
  data: QcImageAiScoreV2Result[]
  getValues: (r: QcImageAiScoreV2Result) => number[]
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
              <div style={{ width: "100%", maxWidth: 24, height: 70, background: "var(--border-color)", borderRadius: "2px", position: "relative", overflow: "hidden" }}>
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

function scoreColor(score: number): string {
  return score >= 4 ? "#10b981" : score >= 3 ? "#f59e0b" : "#dc2626"
}

function scoreBadge(score: number) {
  const color = scoreColor(score)
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: score >= 4 ? "var(--color-success-bg)" : score >= 3 ? "var(--color-warning-bg)" : "var(--color-error-bg)", color }}>{score.toFixed(1)}</span>
}

function modalityColor(mod: string): string {
  const map: Record<string, string> = { CT: "#3b82f6", MR: "#8b5cf6", DR: "#10b981", CBCT: "#f59e0b" }
  return map[mod] ?? "#64748b"
}

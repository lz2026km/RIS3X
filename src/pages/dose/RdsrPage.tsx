import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Upload, Activity, AlertTriangle, AlertCircle, TrendingUp, BarChart3, Calculator, Zap, Radio } from "lucide-react"
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"
import { rdsrApi, type RdsrResult, type DrlEntry, type RdsrStats } from "../../services/api/rdsrApi"

export default function RdsrPage() {
  const { t } = useTranslation("rdsr")
  const [rdsrResult, setRdsrResult] = useState<RdsrResult | null>(null)
  const [drls, setDrls] = useState<DrlEntry[]>([])
  const [stats, setStats] = useState<RdsrStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"parse" | "drls" | "stats">("parse")

  const handleParse = async () => {
    setLoading(true)
    try {
      const res = await rdsrApi.parse(undefined, "CT")
      setRdsrResult(res)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadDrls = async () => {
    const res = await rdsrApi.getDrls()
    setDrls(res)
    setActiveTab("drls")
  }

  const handleLoadStats = async () => {
    const res = await rdsrApi.getStats()
    setStats(res)
    setActiveTab("stats")
  }

  const alertColor = (level: string) => {
    switch (level) {
      case "critical": return { bg: "#fee2e2", text: "#dc2626", icon: <AlertCircle size={14} color="#dc2626" /> }
      case "warning": return { bg: "#fef3c7", text: "#f59e0b", icon: <AlertTriangle size={14} color="#f59e0b" /> }
      default: return { bg: "#d1fae5", text: "#10b981", icon: <Activity size={14} color="#10b981" /> }
    }
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader title={<><Radio size={20} color="#3b82f6" /> {t("title")}</>} subtitle={t("subtitle")} />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setActiveTab("parse")} style={{ padding: "6px 16px", background: activeTab === "parse" ? "#1e40af" : "#fff", color: activeTab === "parse" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "parse" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} />{t("parse")}
          </button>
          <button onClick={handleLoadDrls} style={{ padding: "6px 16px", background: activeTab === "drls" ? "#1e40af" : "#fff", color: activeTab === "drls" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "drls" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart3 size={14} />{t("drls")}
          </button>
          <button onClick={handleLoadStats} style={{ padding: "6px 16px", background: activeTab === "stats" ? "#1e40af" : "#fff", color: activeTab === "stats" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "stats" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={14} />{t("stats")}
          </button>
        </div>

        {activeTab === "parse" && (
          <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Upload size={28} color="#3b82f6" />
              </div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>{t("uploadHint")}</div>
              <button onClick={handleParse} disabled={loading} style={{ padding: "10px 28px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} />{loading ? t("parsing") : t("parseRdsr")}
              </button>
            </div>

            {rdsrResult && (
              <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px" }}>{t("parseResult")}</h3>
                <StatCardGrid columns={4} gap={12}>
                  <StatCard label="CTDIvol" value={`${rdsrResult.ctdivol} mGy`} icon={<Activity size={20} />} color={rdsrResult.alertLevel === "critical" ? "#dc2626" : rdsrResult.alertLevel === "warning" ? "#f59e0b" : "#10b981"} />
                  <StatCard label="DLP" value={`${rdsrResult.dlp} mGy·cm`} icon={<BarChart3 size={20} />} color="#3b82f6" />
                  <StatCard label="SSDE" value={rdsrResult.ssde ? `${rdsrResult.ssde} mGy` : "N/A"} icon={<Calculator size={20} />} color="#8b5cf6" />
                  <StatCard label={t("alertLevel")} value={<span style={{ display: "flex", alignItems: "center", gap: 4 }}>{alertColor(rdsrResult.alertLevel).icon}{t(rdsrResult.alertLevel)}</span>} icon={<AlertTriangle size={20} />} color={rdsrResult.alertLevel === "critical" ? "#dc2626" : rdsrResult.alertLevel === "warning" ? "#f59e0b" : "#10b981"} />
                </StatCardGrid>
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "#475569" }}>
                  <div><strong>{t("modality")}:</strong> {rdsrResult.modality}</div>
                  <div><strong>{t("bodyPart")}:</strong> {rdsrResult.bodyPart}</div>
                  <div><strong>{t("events")}:</strong> {rdsrResult.numberOfEvents}</div>
                  <div><strong>{t("totalExposure")}:</strong> {rdsrResult.totalExposure} mAs</div>
                  <div><strong>{t("studyUid")}:</strong> <code style={{ fontSize: 11 }}>{rdsrResult.studyInstanceUid}</code></div>
                  <div><strong>{t("examDate")}:</strong> {rdsrResult.examDate}</div>
                </div>

                {rdsrResult.alertLevel !== "normal" && (
                  <div style={{ marginTop: 12, padding: 12, background: rdsrResult.alertLevel === "critical" ? "#fee2e2" : "#fef3c7", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    {alertColor(rdsrResult.alertLevel).icon}
                    <span style={{ fontSize: 13, fontWeight: 600, color: rdsrResult.alertLevel === "critical" ? "#dc2626" : "#92400e" }}>
                      {t(rdsrResult.alertLevel === "critical" ? "alertCritical" : "alertWarning")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "drls" && (
          <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart3 size={16} color="#10b981" />{t("drlComparison")}
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[t("modality"), t("bodyPart"), "CTDIvol DRL", "DLP DRL", t("source")].map(h => (
                      <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drls.map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 10 }}><span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{d.modality}</span></td>
                      <td style={{ padding: 10, fontWeight: 600 }}>{d.bodyPart}</td>
                      <td style={{ padding: 10 }}>{d.ctdivolDrl} mGy</td>
                      <td style={{ padding: 10 }}>{d.dlpDrl} mGy·cm</td>
                      <td style={{ padding: 10, color: "#64748b" }}>{d.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rdsrResult && (
              <div style={{ marginTop: 16, padding: 12, background: "#f0fdf4", borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46", marginBottom: 8 }}>{t("currentComparison")}</div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  <div>CTDIvol: {rdsrResult.ctdivol} mGy vs DRL {drls.find(d => d.bodyPart === rdsrResult.bodyPart)?.ctdivolDrl ?? "?"} mGy</div>
                  <div>DLP: {rdsrResult.dlp} mGy·cm vs DRL {drls.find(d => d.bodyPart === rdsrResult.bodyPart)?.dlpDrl ?? "?"} mGy·cm</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={16} color="#8b5cf6" />{t("doseStats")}
            </h3>
            {stats ? (
              <>
                <StatCardGrid columns={4} gap={12}>
                  <StatCard label={t("totalExams")} value={stats.totalExams} icon={<Activity size={20} />} color="#3b82f6" />
                  <StatCard label={t("avgCtdivol")} value={`${stats.avgCtdivol.toFixed(1)} mGy`} icon={<Calculator size={20} />} color="#10b981" />
                  <StatCard label={t("avgDlp")} value={`${stats.avgDlp.toFixed(0)} mGy·cm`} icon={<BarChart3 size={20} />} color="#8b5cf6" />
                  <StatCard label={t("alerts")} value={stats.warningCount + stats.criticalCount} icon={<AlertTriangle size={20} />} color={stats.criticalCount > 0 ? "#dc2626" : "#f59e0b"} subValue={`${t("warning")} ${stats.warningCount} / ${t("critical")} ${stats.criticalCount}`} />
                </StatCardGrid>

                {stats.trend.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>{t("trend")}</h4>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, padding: "0 8px" }}>
                      {stats.trend.map((p, i) => {
                        const h = (p.avgCtdivol / (stats.maxCtdivol || 1)) * 80
                        const h2 = (p.avgDlp / (stats.maxDlp || 1)) * 80
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ width: "100%", maxWidth: 28, height: 80, background: "#f1f5f9", borderRadius: "3px 3px 0 0", position: "relative", overflow: "hidden" }}>
                              <div style={{ position: "absolute", bottom: 0, left: 0, width: "50%", height: `${h}%`, background: "#3b82f6", borderRadius: "3px 0 0 0", transition: "height 0.3s" }} />
                              <div style={{ position: "absolute", bottom: 0, right: 0, width: "50%", height: `${h2}%`, background: "#10b981", borderRadius: "0 3px 0 0", transition: "height 0.3s" }} />
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <span style={{ fontSize: 8, color: "#3b82f6" }}>{p.avgCtdivol.toFixed(0)}</span>
                              <span style={{ fontSize: 8, color: "#10b981" }}>{p.avgDlp.toFixed(0)}</span>
                            </div>
                            <span style={{ fontSize: 8, color: "#94a3b8" }}>{p.date.slice(5)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 10, color: "#64748b" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#3b82f6", borderRadius: 2, display: "inline-block" }} />CTDIvol</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#10b981", borderRadius: 2, display: "inline-block" }} />DLP</span>
                    </div>
                  </div>
                )}

                {stats.warningCount + stats.criticalCount > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: stats.criticalCount > 0 ? "#fee2e2" : "#fef3c7", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={16} color={stats.criticalCount > 0 ? "#dc2626" : "#f59e0b"} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: stats.criticalCount > 0 ? "#dc2626" : "#92400e" }}>
                      {t("overThreshold")}: {t("warning")} {stats.warningCount}, {t("critical")} {stats.criticalCount}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{t("noStatsData")}</div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

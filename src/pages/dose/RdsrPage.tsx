import { useState } from 'react'
import { useTranslation } from "react-i18next"
import { Upload, Activity, AlertTriangle, AlertCircle, TrendingUp, BarChart3, Calculator, Zap, Radio, Users, ShieldAlert, CheckCircle } from "lucide-react"
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"
import { rdsrApi, type RdsrResult, type DrlEntry, type RdsrStats, type PatientDoseSummary, type DoseAlert } from "../../services/api/rdsrApi"
import { t as tApp } from "../../i18n/appI18n"

export default function RdsrPage() {
  const { t } = useTranslation("rdsr")
  const [rdsrResult, setRdsrResult] = useState<RdsrResult | null>(null)
  const [drls, setDrls] = useState<DrlEntry[]>([])
  const [stats, setStats] = useState<RdsrStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"parse" | "drls" | "stats" | "patients" | "alerts">("parse")
  // [v3.0.6.11-104 Wave 2A] 患者累积剂量 (/rdsr/patients) + 超阈值告警 (/rdsr/alerts)
  const [patients, setPatients] = useState<PatientDoseSummary[]>([])
  const [patientSearch, setPatientSearch] = useState("")
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [alerts, setAlerts] = useState<DoseAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  const handleParse = async () => {
    setLoading(true)
    try {
      const res = await rdsrApi.parse(undefined, "CT")
      if (res.success && res.data) setRdsrResult(res.data as RdsrResult)
      else setRdsrResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadDrls = async () => {
    const res = await rdsrApi.getDrls()
    setDrls(Array.isArray(res.data) ? (res.data as DrlEntry[]) : [])
    setActiveTab("drls")
  }

  const handleLoadStats = async () => {
    const res = await rdsrApi.getStats()
    if (res.success && res.data) setStats(res.data as RdsrStats)
    else setStats(null)
    setActiveTab("stats")
  }

  // [v3.0.6.11-104 Wave 2A] GET /rdsr/patients — 患者累积剂量列表
  const handleLoadPatients = async () => {
    setPatientsLoading(true)
    try {
      const res = await rdsrApi.searchPatients(patientSearch || undefined)
      setPatients(res.success && Array.isArray(res.data) ? res.data : [])
    } catch {
      setPatients([])
    } finally {
      setPatientsLoading(false)
      setActiveTab("patients")
    }
  }

  // [v3.0.6.11-104 Wave 2A] GET /rdsr/alerts — 超阈值告警
  const handleLoadAlerts = async () => {
    setAlertsLoading(true)
    try {
      const res = await rdsrApi.getAlerts()
      setAlerts(res.success && Array.isArray(res.data) ? res.data : [])
    } catch {
      setAlerts([])
    } finally {
      setAlertsLoading(false)
      setActiveTab("alerts")
    }
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
      <PageHeader icon={<Radio size={20} color="#3b82f6" />} title={t("title")} subtitle={t("subtitle")} />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setActiveTab("parse")} style={{ padding: "6px 16px", background: activeTab === "parse" ? "#1e40af" : "var(--bg-card)", color: activeTab === "parse" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "parse" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} />{t("parse")}
          </button>
          <button onClick={handleLoadDrls} style={{ padding: "6px 16px", background: activeTab === "drls" ? "#1e40af" : "var(--bg-card)", color: activeTab === "drls" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "drls" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart3 size={14} />{t("drls")}
          </button>
          <button onClick={handleLoadStats} style={{ padding: "6px 16px", background: activeTab === "stats" ? "#1e40af" : "var(--bg-card)", color: activeTab === "stats" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "stats" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={14} />{t("stats")}
          </button>
          <button onClick={handleLoadPatients} style={{ padding: "6px 16px", background: activeTab === "patients" ? "#1e40af" : "var(--bg-card)", color: activeTab === "patients" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "patients" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={14} />{tApp("rdsr.patients")}
          </button>
          <button onClick={handleLoadAlerts} style={{ padding: "6px 16px", background: activeTab === "alerts" ? "#1e40af" : "var(--bg-card)", color: activeTab === "alerts" ? "#fff" : "#475569", border: "1px solid " + (activeTab === "alerts" ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldAlert size={14} />{tApp("rdsr.alertsTab")}
          </button>
        </div>

        {activeTab === "parse" && (
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
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
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 12px" }}>{t("parseResult")}</h3>
                <StatCardGrid minWidth={190} gap={12}>
                  <StatCard title="CTDIvol" value={`${rdsrResult.ctdivol} mGy`} icon={<Activity size={20} />} color={rdsrResult.alertLevel === "critical" ? "#dc2626" : rdsrResult.alertLevel === "warning" ? "#f59e0b" : "#10b981"} />
                  <StatCard title="DLP" value={`${rdsrResult.dlp} mGy·cm`} icon={<BarChart3 size={20} />} color="#3b82f6" />
                  <StatCard title="SSDE" value={rdsrResult.ssde ? `${rdsrResult.ssde} mGy` : "—"} icon={<Calculator size={20} />} color="#8b5cf6" />
                  <StatCard title={t("alertLevel")} value={<span style={{ display: "flex", alignItems: "center", gap: 4 }}>{alertColor(rdsrResult.alertLevel).icon}{t(rdsrResult.alertLevel)}</span>} icon={<AlertTriangle size={20} />} color={rdsrResult.alertLevel === "critical" ? "#dc2626" : rdsrResult.alertLevel === "warning" ? "#f59e0b" : "#10b981"} />
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
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart3 size={16} color="#10b981" />{t("drlComparison")}
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-primary)" }}>
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
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={16} color="#8b5cf6" />{t("doseStats")}
            </h3>
            {stats ? (
              <>
                <StatCardGrid minWidth={190} gap={12}>
                  <StatCard title={t("totalExams")} value={stats.totalExams ?? 0} icon={<Activity size={20} />} color="#3b82f6" />
                  <StatCard title={t("avgCtdivol")} value={`${Number(stats.avgCtdivol ?? 0).toFixed(1)} mGy`} icon={<Calculator size={20} />} color="#10b981" />
                  <StatCard title={t("avgDlp")} value={`${Number(stats.avgDlp ?? 0).toFixed(0)} mGy·cm`} icon={<BarChart3 size={20} />} color="#8b5cf6" />
                  <StatCard title={t("alerts")} value={(stats.warningCount ?? 0) + (stats.criticalCount ?? 0)} icon={<AlertTriangle size={20} />} color={(stats.criticalCount ?? 0) > 0 ? "#dc2626" : "#f59e0b"} sub={`${t("warning")} ${stats.warningCount ?? 0} / ${t("critical")} ${stats.criticalCount ?? 0}`} />
                </StatCardGrid>

                {Array.isArray(stats.trend) && stats.trend.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>{t("trend")}</h4>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, padding: "0 8px" }}>
                      {stats.trend.map((p, i) => {
                        const h = (Number(p.avgCtdivol ?? 0) / (Number(stats.maxCtdivol) || 1)) * 80
                        const h2 = (Number(p.avgDlp ?? 0) / (Number(stats.maxDlp) || 1)) * 80
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ width: "100%", maxWidth: 28, height: 80, background: "var(--bg-primary)", borderRadius: "3px 3px 0 0", position: "relative", overflow: "hidden" }}>
                              <div style={{ position: "absolute", bottom: 0, left: 0, width: "50%", height: `${h}%`, background: "#3b82f6", borderRadius: "3px 0 0 0", transition: "height 0.3s" }} />
                              <div style={{ position: "absolute", bottom: 0, right: 0, width: "50%", height: `${h2}%`, background: "#10b981", borderRadius: "0 3px 0 0", transition: "height 0.3s" }} />
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <span style={{ fontSize: 8, color: "#3b82f6" }}>{Number(p.avgCtdivol ?? 0).toFixed(0)}</span>
                              <span style={{ fontSize: 8, color: "#10b981" }}>{Number(p.avgDlp ?? 0).toFixed(0)}</span>
                            </div>
                            <span style={{ fontSize: 8, color: "#94a3b8" }}>{String(p.date ?? "").slice(5)}</span>
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

                {(stats.warningCount ?? 0) + (stats.criticalCount ?? 0) > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: (stats.criticalCount ?? 0) > 0 ? "#fee2e2" : "#fef3c7", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={16} color={(stats.criticalCount ?? 0) > 0 ? "#dc2626" : "#f59e0b"} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: (stats.criticalCount ?? 0) > 0 ? "#dc2626" : "#92400e" }}>
                      {t("overThreshold")}: {t("warning")} {stats.warningCount ?? 0}, {t("critical")} {stats.criticalCount ?? 0}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{t("noStatsData")}</div>
            )}
          </div>
        )}

        {/* [v3.0.6.11-104 Wave 2A] GET /rdsr/patients — 患者累积剂量列表 */}
        {activeTab === "patients" && (
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={16} color="#3b82f6" />{tApp("rdsr.patients")}
            </h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleLoadPatients() }}
                placeholder={tApp("rdsr.patientSearchPlaceholder")}
                style={{ flex: 1, maxWidth: 320, padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, background: "var(--bg-card)", color: "var(--text-primary)" }}
              />
              <button onClick={() => void handleLoadPatients()} disabled={patientsLoading} style={{ padding: "7px 18px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {tApp("rdsr.search")}
              </button>
            </div>
            {patientsLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>{tApp("rdsr.loading")}</div>
            ) : patients.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>{tApp("rdsr.noData")}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-primary)" }}>
                      {[tApp("rdsr.patientName"), tApp("rdsr.patientId"), tApp("rdsr.examCount"), tApp("rdsr.dlp30d"), tApp("rdsr.dlp1y"), tApp("rdsr.overDrl"), tApp("rdsr.lastExam")].map(h => (
                        <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p) => (
                      <tr key={`${p.patientId}-${p.patientName}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 10, fontWeight: 600 }}>{p.patientName}</td>
                        <td style={{ padding: 10, color: "#64748b" }}>{p.patientId}</td>
                        <td style={{ padding: 10 }}>{p.examCount}</td>
                        <td style={{ padding: 10 }}>{Number(p.totalDlp30d ?? 0).toFixed(0)}</td>
                        <td style={{ padding: 10 }}>{Number(p.totalDlp1y ?? 0).toFixed(0)}</td>
                        <td style={{ padding: 10, fontWeight: 700, color: (p.overDrlCount ?? 0) > 0 ? "#dc2626" : "#16a34a" }}>{p.overDrlCount ?? 0}</td>
                        <td style={{ padding: 10, color: "#64748b" }}>{p.lastExamDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* [v3.0.6.11-104 Wave 2A] GET /rdsr/alerts — 超阈值告警 */}
        {activeTab === "alerts" && (
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldAlert size={16} color="#dc2626" />{tApp("rdsr.alertsTab")}
              {alerts.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: 8 }}>{alerts.length}</span>
              )}
            </h3>
            {alertsLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>{tApp("rdsr.loading")}</div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CheckCircle size={16} color="#16a34a" />{tApp("rdsr.noData")}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-primary)" }}>
                      {[tApp("rdsr.patientName"), tApp("rdsr.modalityShort"), tApp("rdsr.bodyPartShort"), "CTDIvol", "DLP", tApp("rdsr.date"), tApp("rdsr.level"), tApp("rdsr.status")].map(h => (
                        <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 10, fontWeight: 600 }}>{a.patientName}</td>
                        <td style={{ padding: 10 }}>{a.modality}</td>
                        <td style={{ padding: 10 }}>{a.bodyPart}</td>
                        <td style={{ padding: 10 }}>{a.ctdivol}<span style={{ color: "#94a3b8" }}>/{a.ctdivolDrl}</span></td>
                        <td style={{ padding: 10 }}>{a.dlp}<span style={{ color: "#94a3b8" }}>/{a.dlpDrl}</span></td>
                        <td style={{ padding: 10, color: "#64748b" }}>{a.date}</td>
                        <td style={{ padding: 10 }}>
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontWeight: 600, color: a.level === "critical" ? "#dc2626" : "#d97706", background: a.level === "critical" ? "#fee2e2" : "#fef3c7" }}>
                            {a.level === "critical" ? t("critical") : t("warning")}
                          </span>
                        </td>
                        <td style={{ padding: 10 }}>
                          <span style={{ color: a.acknowledged ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                            {a.acknowledged ? tApp("rdsr.acked") : tApp("rdsr.pending")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

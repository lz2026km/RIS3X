import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Sliders, AlertTriangle, Info, AlertCircle, ArrowUpDown, BrainCircuit, FlaskConical, Route, Pill } from 'lucide-react'
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { cdsApi, type RuleEvaluateRequest, type RuleEvaluateResult } from "../../services/api/cdsApi"

const RULE_TEMPLATES = [
  { ruleId: "contrast-001", ruleName: "造影剂适应症检查", type: "contrast", priority: 1 },
  { ruleId: "dose-001", ruleName: "辐射剂量优化", type: "appropriateness", priority: 2 },
  { ruleId: "protocol-001", ruleName: "检查协议匹配", type: "pathway", priority: 3 },
  { ruleId: "drug-001", ruleName: "药物交互检查", type: "drug", priority: 4 },
]

const TYPE_ICONS: Record<string, typeof BrainCircuit> = {
  appropriateness: BrainCircuit,
  pathway: Route,
  contrast: FlaskConical,
  drug: Pill,
}

export default function RuleConfigPanel() {
  const { t } = useTranslation("cds")
  const [rules, setRules] = useState(RULE_TEMPLATES)
  const [results, setResults] = useState<RuleEvaluateResult[]>([])
  const [loading, setLoading] = useState(false)
  const [evalParams, setEvalParams] = useState<RuleEvaluateRequest>({
    examType: "CT 增强",
    modality: "CT",
    age: 45,
    gender: "男",
    clinicalInfo: "腹痛待查",
  })

  const handleEvaluate = async () => {
    setLoading(true)
    try {
      const res = await cdsApi.evaluateRule(evalParams)
      setResults(res.results)
    } finally {
      setLoading(false)
    }
  }

  const handlePriorityChange = async (ruleId: string, delta: number) => {
    const updated = rules.map(r => {
      if (r.ruleId === ruleId) {
        const newP = Math.max(1, Math.min(10, r.priority + delta))
        cdsApi.updateRulePriority(ruleId, newP)
        return { ...r, priority: newP }
      }
      return r
    })
    setRules(updated)
  }

  const sortedRules = useMemo(() => [...rules].sort((a, b) => a.priority - b.priority), [rules])

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertCircle size={14} color="#dc2626" />
      case "warning": return <AlertTriangle size={14} color="#f59e0b" />
      default: return <Info size={14} color="#3b82f6" />
    }
  }

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<Sliders size={20} color="#3b82f6" />} title={t("ruleConfigTitle")} subtitle={t("ruleConfigSubtitle")} />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>{t("evalParams")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{t("examType")}</label>
                <input value={evalParams.examType ?? ""} onChange={e => setEvalParams(p => ({ ...p, examType: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{t("modality")}</label>
                <input value={evalParams.modality ?? ""} onChange={e => setEvalParams(p => ({ ...p, modality: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{t("age")}</label>
                <input type="number" value={evalParams.age ?? ""} onChange={e => setEvalParams(p => ({ ...p, age: parseInt(e.target.value) || 0 }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{t("gender")}</label>
                <select value={evalParams.gender ?? ""} onChange={e => setEvalParams(p => ({ ...p, gender: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }}>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{t("clinicalInfo")}</label>
                <input value={evalParams.clinicalInfo ?? ""} onChange={e => setEvalParams(p => ({ ...p, clinicalInfo: e.target.value }))} style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }} />
              </div>
            </div>
            <button onClick={handleEvaluate} disabled={loading} style={{ marginTop: 12, padding: "8px 20px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {loading ? t("evaluating") : t("evaluate")}
            </button>

            {results.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>{t("evalResults")}</h4>
                {results.map((r, _i) => (
                  <div key={r.ruleId} style={{ padding: "10px 12px", marginBottom: 8, background: r.triggered ? "var(--color-warning-bg)" : "var(--bg-card)", borderRadius: 6, border: "1px solid " + (r.triggered ? "var(--color-warning-border)" : "var(--border-color)") }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {severityIcon(r.severity)}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.ruleName}</span>
                      <span style={{ fontSize: 11, color: "#64748b", marginLeft: "auto" }}>{r.source}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>{r.message}</div>
                    {r.suggestions.length > 0 && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        {r.suggestions.map((s, si) => <span key={si} style={{ display: "inline-block", padding: "1px 6px", background: "var(--bg-card)", borderRadius: 3, margin: "1px 2px" }}>{s}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowUpDown size={16} color="#8b5cf6" />{t("rulePriority")}
            </h3>
            {sortedRules.map((r, _i) => {
              const Icon = TYPE_ICONS[r.type] ?? BrainCircuit
              return (
                <div key={r.ruleId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                  <Icon size={16} color="#8b5cf6" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.ruleName}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>ID: {r.ruleId}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => handlePriorityChange(r.ruleId, -1)} style={{ padding: "2px 6px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>-</button>
                    <span style={{ width: 24, textAlign: "center", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{r.priority}</span>
                    <button onClick={() => handlePriorityChange(r.ruleId, 1)} style={{ padding: "2px 6px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

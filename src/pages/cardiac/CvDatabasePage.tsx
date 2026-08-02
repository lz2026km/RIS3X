import { useState, useEffect, useCallback } from "react";
import { message, Spin, Alert, Button } from "antd";
import { Search, Download, Database, Eye, RefreshCw } from "lucide-react";
import { cardiacSpecialtyApi } from "../../services/api/cardiacSpecialtyApi";
import type { CardiacAnalysis } from "../../services/api/cardiacSpecialtyApi";

type CvModality = "CCTA" | "CMR" | "Echo" | "Cath" | "Vascular";
type CvAnatomy =
  "coronary" | "ventricle" | "valve" | "aorta" | "peripheral" | "carotid";

interface CvCase {
  id: string;
  patientId: string;
  patientName: string;
  age?: number;
  gender?: string;
  modality: CvModality;
  anatomy: CvAnatomy;
  studyDate: string;
  accessionNumber: string;
  diagnosis: string;
  cadRads?: string;
  efPercent?: number;
  lesionCount: number;
  keyFindings: string;
  hasSrReport: boolean;
}

const FILTER_MODALITIES: CvModality[] = [
  "CCTA",
  "CMR",
  "Echo",
  "Cath",
  "Vascular",
];
const FILTER_ANATOMIES: CvAnatomy[] = [
  "coronary",
  "ventricle",
  "valve",
  "aorta",
  "peripheral",
  "carotid",
];

const COLORS: Record<string, string> = {
  CCTA: "#1e40af",
  CMR: "#7c3aed",
  Echo: "#0891b2",
  Cath: "#d97706",
  Vascular: "#dc2626",
};

function mapAnalysisToCase(a: CardiacAnalysis): CvCase {
  const lesions =
    a.coronarySegments?.filter((s) => s.stenosisPercent > 0) ?? [];
  const anatomy: CvAnatomy =
    lesions.length > 0
      ? "coronary"
      : a.lvFunction
        ? "ventricle"
        : a.valves && a.valves.length > 0
          ? "valve"
          : "coronary";
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: a.patientName,
    modality: a.modality as CvModality,
    anatomy,
    studyDate: a.studyDate,
    accessionNumber: "",
    diagnosis:
      a.cadRads != null && a.cadRads !== "N"
        ? `CAD-RADS ${a.cadRads}`
        : a.status,
    cadRads: a.cadRads != null ? String(a.cadRads) : undefined,
    efPercent: a.lvFunction?.efPercent,
    lesionCount: lesions.length,
    keyFindings:
      lesions.length > 0
        ? lesions.map((s) => `${s.segment} ${s.stenosisPercent}%`).join(", ")
        : a.valves && a.valves.length > 0
          ? a.valves.map((v) => `${v.valve} ${v.severity}`).join(", ")
          : "No significant findings",
    hasSrReport: false,
  };
}

export default function CvDatabasePage() {
  const [search, setSearch] = useState("");
  const [modalityFilter, setModalityFilter] = useState<CvModality | "">("");
  const [anatomyFilter, setAnatomyFilter] = useState<CvAnatomy | "">("");
  const [selectedCase, setSelectedCase] = useState<CvCase | null>(null);
  const [cases, setCases] = useState<CvCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await cardiacSpecialtyApi.getAnalyses();
      if (res.success) {
        const mapped = (Array.isArray(res.data) ? res.data : []).map(
          mapAnalysisToCase,
        );
        setCases(mapped);
      } else {
        setError(res.error?.message ?? "加载失败");
        setCases([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = cases.filter((c) => {
    if (search && !c.patientName.includes(search) && !c.id.includes(search))
      return false;
    if (modalityFilter && c.modality !== modalityFilter) return false;
    if (anatomyFilter && c.anatomy !== anatomyFilter) return false;
    return true;
  });

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h1
          style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}
        >
          <Database size={24} /> CV Imaging Database
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small"
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
          <button
            disabled
            style={{
              padding: "6px 16px",
              background: "#94a3b8",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#f1f5f9",
            borderRadius: 8,
            padding: "4px 12px",
            flex: "0 0 280px",
          }}
        >
          <Search size={18} color="#64748b" />
          <input
            placeholder="Search by patient name or case ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              marginLeft: 8,
              flex: 1,
              fontSize: 14,
            }}
          />
        </div>
        <select
          value={modalityFilter}
          onChange={(e) => setModalityFilter(e.target.value as CvModality | "")}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#fff",
            fontSize: 14,
          }}
        >
          <option value="">All Modalities</option>
          {FILTER_MODALITIES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={anatomyFilter}
          onChange={(e) => setAnatomyFilter(e.target.value as CvAnatomy | "")}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#fff",
            fontSize: 14,
          }}
        >
          <option value="">All Anatomy</option>
          {FILTER_ANATOMIES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      )}

      <Spin spinning={loading}>
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "2px solid #e2e8f0",
                }}
              >
                <th style={{ padding: "10px 12px", textAlign: "left" }}>
                  Case ID
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>
                  Patient
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>
                  Modality
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>
                  Anatomy
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>
                  Date
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>
                  Diagnosis
                </th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>
                  Lesions
                </th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>
                  SR
                </th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                    {c.id}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {c.patientName}
                    <br />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {c.patientId}
                      {c.age ? ` | ${c.age}y ${c.gender ?? ""}` : ""}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        background: COLORS[c.modality] ?? "#64748b",
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {c.modality}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textTransform: "capitalize",
                    }}
                  >
                    {c.anatomy}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>
                    {c.studyDate}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.diagnosis}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {c.lesionCount}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {c.hasSrReport ? (
                      <span style={{ color: "#16a34a" }}>✓</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <button
                      onClick={() => setSelectedCase(c)}
                      style={{
                        padding: "4px 10px",
                        background: "#eff6ff",
                        color: "#1e40af",
                        border: "1px solid #bfdbfe",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    No cases found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Spin>

      {selectedCase && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedCase(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px" }}>
              {selectedCase.id} — {selectedCase.patientName}
            </h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "8px 16px",
                fontSize: 14,
              }}
            >
              <dt style={{ color: "#64748b", fontWeight: 500 }}>Patient ID</dt>
              <dd>{selectedCase.patientId}</dd>
              <dt style={{ color: "#64748b", fontWeight: 500 }}>Modality</dt>
              <dd>{selectedCase.modality}</dd>
              <dt style={{ color: "#64748b", fontWeight: 500 }}>Anatomy</dt>
              <dd>{selectedCase.anatomy}</dd>
              <dt style={{ color: "#64748b", fontWeight: 500 }}>Study Date</dt>
              <dd>{selectedCase.studyDate}</dd>
              <dt style={{ color: "#64748b", fontWeight: 500 }}>Diagnosis</dt>
              <dd>{selectedCase.diagnosis}</dd>
              {selectedCase.cadRads && (
                <>
                  <dt style={{ color: "#64748b", fontWeight: 500 }}>
                    CAD-RADS
                  </dt>
                  <dd>{selectedCase.cadRads}</dd>
                </>
              )}
              {selectedCase.efPercent !== undefined && (
                <>
                  <dt style={{ color: "#64748b", fontWeight: 500 }}>EF</dt>
                  <dd>{selectedCase.efPercent}%</dd>
                </>
              )}
              <dt style={{ color: "#64748b", fontWeight: 500 }}>
                Key Findings
              </dt>
              <dd>{selectedCase.keyFindings}</dd>
            </dl>
            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  const url = `/api/v1/cardiac/visualizer/${selectedCase.id}`;
                  window.open(url, "_blank");
                  message.info("Visualizer 正在新标签页打开");
                }}
                style={{
                  padding: "8px 20px",
                  background: "#1e40af",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Eye size={16} /> Open Visualizer
              </button>
              <button
                style={{
                  padding: "8px 20px",
                  background: "#f8fafc",
                  color: "#1e293b",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedCase(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

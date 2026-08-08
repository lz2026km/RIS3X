import { t } from "../../i18n/appI18n";
import { Info, User } from "lucide-react";
import type { PatientDoseRecord } from "./types";
import { getAlertBadge } from "./utils";

interface DoseTrackingTableProps {
  filteredPatientRecords: PatientDoseRecord[];
  selectedPatient: PatientDoseRecord | null;
  setSelectedPatient: (patient: PatientDoseRecord | null) => void;
}

export default function DoseTrackingTable({
  filteredPatientRecords,
  selectedPatient,
  setSelectedPatient,
}: DoseTrackingTableProps) {
  // [v3.0.6.8-31] t() from appI18n
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
            {t("doseTrack.table.title")}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#94a3b8",
            }}
          >
            <Info size={12} />
            <span>{t("doseTrack.table.info")}</span>
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc" }}>
              <tr>
                {[t("doseTrack.table.patientName"), t("doseTrack.table.gender"), t("doseTrack.table.age"), t("doseTrack.table.modality"), t("doseTrack.table.examItem"), t("doseTrack.table.examDate"), t("doseTrack.table.doseValue"), t("doseTrack.table.alertLevel"), t("doseTrack.table.actions")].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748b",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPatientRecords.map((r, i) => {
                const badge = getAlertBadge(r.alertLevel);
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: "1px solid #f8fafc",
                      background: i % 2 === 0 ? "#fff" : "#fafbfc",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedPatient(r)}
                  >
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#1e40af" }}>
                      {r.patientName}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#334155" }}>
                      {r.gender}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#334155" }}>
                      {r.age}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#334155" }}>
                      <span style={{ padding: "2px 8px", background: "#eff6ff", color: "#2563eb", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                        {r.modality}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#334155" }}>
                      {r.examItem}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>
                      {r.examDate}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: r.alertLevel === "critical" ? "#dc2626" : r.alertLevel === "warning" ? "#d97706" : "#1e40af" }}>
                      {r.doseValue}{" "}
                      <span style={{ fontSize: 12, fontWeight: 400 }}>{r.doseUnit}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ padding: "2px 8px", background: badge.bg, color: badge.color, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                        {badge.label}?                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPatient(r); }}
                        style={{ padding: "4px 10px", background: "#eff6ff", color: "#2563eb", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                      >
                         {t("doseTrack.table.details")}
                        </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        {selectedPatient ? (
          <PatientDetailCard patient={selectedPatient} />
        ) : (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: 40,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <User size={48} color="#e2e8f0" />
            <div style={{ fontSize: 14, color: "#94a3b8" }}>
               {t("doseTrack.table.noSelection")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PatientDetailCard({ patient }: { patient: PatientDoseRecord }) {
  const badge = getAlertBadge(patient.alertLevel);
  const doseRatio = patient.doseValue / patient.threshold;

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${badge.border}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: badge.bg, borderBottom: `1px solid ${badge.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={18} color={badge.color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>{patient.patientName}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{patient.gender} · {patient.age}?· ID: {patient.patientId}</div>
          </div>
        </div>
        <span style={{ padding: "4px 10px", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          {badge.label}级预?        </span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>设备:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>{patient.device}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>日期:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>{patient.examDate}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>本次剂量</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: badge.color }}>{patient.doseValue}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{patient.doseUnit}</div>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>法规阈值</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1e40af" }}>{patient.threshold}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{patient.doseUnit}</div>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>占比</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: doseRatio > 1 ? "#dc2626" : "#16a34a" }}>
              {Math.round(doseRatio * 100)}%
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>阈值比</div>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>剂量安全指标</span>
            <span style={{ fontSize: 12, color: doseRatio > 1 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
              {doseRatio > 1 ? "超出" : "在控"}{Math.round(Math.abs(doseRatio - 1) * 100)}%
            </span>
          </div>
          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(doseRatio * 100, 100)}%`, background: doseRatio > 1 ? "#dc2626" : doseRatio > 0.8 ? "#d97706" : "#16a34a", borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </div>
  );
}



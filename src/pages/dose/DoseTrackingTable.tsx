import { t } from "../../i18n/appI18n";
import { Info, User } from "lucide-react";
import type { PatientDoseRecord } from "./types";
import { getAlertBadge } from "./utils";
import { DataTable } from "../../components/common";

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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--space-4, 16px)' }}>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          border: "1px solid var(--border-color, #e2e8f0)",
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)" }}>
            {t("doseTrack.table.title")}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 'var(--space-1, 4px)',
              fontSize: 12,
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            <Info size={12} />
            <span>{t("doseTrack.table.info")}</span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <DataTable
            rowKey="id"
            dataSource={filteredPatientRecords}
            showPagination={false}
            showExport={false}
            showDensity={false}
            fixedHeader={500}
            onRow={(r) => ({ onClick: () => setSelectedPatient(r), style: { cursor: "pointer" } })}
            columns={[
              { title: t("doseTrack.table.patientName"), dataIndex: "patientName", key: "patientName", render: (v: string) => <span style={{ fontWeight: 600, color: "var(--color-primary-800)" }}>{v}</span> },
              { title: t("doseTrack.table.gender"), dataIndex: "gender", key: "gender", render: (v: string) => <span style={{ color: 'var(--text-primary, #334155)' }}>{v}</span> },
              { title: t("doseTrack.table.age"), dataIndex: "age", key: "age", render: (v: number) => <span style={{ color: 'var(--text-primary, #334155)' }}>{v}</span> },
              {
                title: t("doseTrack.table.modality"), dataIndex: "modality", key: "modality",
                render: (v: string) => <span style={{ padding: "2px 8px", background: "#eff6ff", color: "var(--color-primary-600)", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{v}</span>,
              },
              { title: t("doseTrack.table.examItem"), dataIndex: "examItem", key: "examItem", render: (v: string) => <span style={{ color: 'var(--text-primary, #334155)' }}>{v}</span> },
              { title: t("doseTrack.table.examDate"), dataIndex: "examDate", key: "examDate", render: (v: string) => <span style={{ color: 'var(--text-muted, #64748b)' }}>{v}</span> },
              {
                title: t("doseTrack.table.doseValue"), key: "doseValue",
                render: (_: unknown, r: PatientDoseRecord) => (
                  <span style={{ fontWeight: 700, color: r.alertLevel === "critical" ? "var(--color-error-600)" : r.alertLevel === "warning" ? "var(--color-warning-600)" : "var(--color-primary-800)" }}>
                    {r.doseValue} <span style={{ fontSize: 12, fontWeight: 400 }}>{r.doseUnit}</span>
                  </span>
                ),
              },
              {
                title: t("doseTrack.table.alertLevel"), dataIndex: "alertLevel", key: "alertLevel",
                render: (v: PatientDoseRecord["alertLevel"]) => {
                  const badge = getAlertBadge(v);
                  return <span style={{ padding: "2px 8px", background: badge.bg, color: badge.color, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{badge.label}级</span>;
                },
              },
              {
                title: t("doseTrack.table.actions"), key: "actions",
                render: (_: unknown, r: PatientDoseRecord) => (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedPatient(r); }}
                    style={{ padding: "4px 10px", background: "#eff6ff", color: "var(--color-primary-600)", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                  >
                    {t("doseTrack.table.details")}
                  </button>
                ),
              },
            ]}
          />
        </div>
      </div>

      <div>
        {selectedPatient ? (
          <PatientDetailCard patient={selectedPatient} />
        ) : (
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 12,
              border: "1px solid var(--border-color, #e2e8f0)",
              padding: 'var(--space-10, 40px)',
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 'var(--space-3, 12px)',
            }}
          >
            <User size={48} color="#e2e8f0" />
            <div style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)' }}>
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
    <div style={{ background: "var(--bg-card)", borderRadius: 12, border: `1px solid ${badge.border}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: badge.bg, borderBottom: `1px solid ${badge.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={18} color={badge.color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary-800)" }}>{patient.patientName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{patient.gender} · {patient.age}?· ID: {patient.patientId}</div>
          </div>
        </div>
        <span style={{ padding: "4px 10px", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          {badge.label}级预?        </span>
      </div>
      <div style={{ padding: 'var(--space-4, 16px)' }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>设备:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary-800)" }}>{patient.device}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>日期:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary-800)" }}>{patient.examDate}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: 'var(--space-3, 12px)', textAlign: "center" }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>本次剂量</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: badge.color }}>{patient.doseValue}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{patient.doseUnit}</div>
          </div>
          <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: 'var(--space-3, 12px)', textAlign: "center" }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>法规阈值</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary-800)" }}>{patient.threshold}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{patient.doseUnit}</div>
          </div>
          <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: 'var(--space-3, 12px)', textAlign: "center" }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>占比</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: doseRatio > 1 ? "var(--color-error-600)" : "var(--color-success-600)" }}>
              {Math.round(doseRatio * 100)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>阈值比</div>
          </div>
        </div>
        <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>剂量安全指标</span>
            <span style={{ fontSize: 12, color: doseRatio > 1 ? "var(--color-error-600)" : "var(--color-success-600)", fontWeight: 600 }}>
              {doseRatio > 1 ? "超出" : "在控"}{Math.round(Math.abs(doseRatio - 1) * 100)}%
            </span>
          </div>
          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(doseRatio * 100, 100)}%`, background: doseRatio > 1 ? "var(--color-error-600)" : doseRatio > 0.8 ? "var(--color-warning-600)" : "var(--color-success-600)", borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </div>
  );
}



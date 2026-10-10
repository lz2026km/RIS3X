import { User, Monitor, Calendar, Eye, FileText } from "lucide-react";
import { message } from "antd";
import { getAlertBadge, exportDoseDataToCSV } from "./utils";
import type { PatientDoseRecord } from "./types";
import { REGULATORY_THRESHOLDS } from "./constants";

interface Props {
  patient: PatientDoseRecord;
  onViewDetails: (patient: PatientDoseRecord) => void;
}

export default function PatientDoseProfileCard({ patient, onViewDetails }: Props) {
  const badge = getAlertBadge(patient.alertLevel);
  const doseRatio = patient.threshold ? patient.doseValue / patient.threshold : 0;
  const modalityThresholds =
    REGULATORY_THRESHOLDS[
      patient.modality as keyof typeof REGULATORY_THRESHOLDS
    ];
  const examThreshold = modalityThresholds?.[
    patient.examItem as keyof typeof modalityThresholds
  ] as { DLP?: number; DAP?: number; AGD?: number } | undefined;
  const referenceValue =
    examThreshold?.DLP || examThreshold?.DAP || examThreshold?.AGD || "-";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: `1px solid ${badge.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          background: badge.bg,
          borderBottom: `1px solid ${badge.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--bg-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User size={18} color={badge.color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary-800)" }}>
              {patient.patientName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
              {patient.gender} · {patient.age}岁 · ID: {patient.patientId}
            </div>
          </div>
        </div>
        <span
          style={{
            padding: "4px 10px",
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {badge.label}级预警
        </span>
      </div>

      <div style={{ padding: 'var(--space-4, 16px)' }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 'var(--space-3, 12px)',
            marginBottom: 'var(--space-4, 16px)',
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <Monitor size={14} color="#64748b" />
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>设备:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary-800)" }}>
              {patient.device}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <Calendar size={14} color="#64748b" />
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>日期:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary-800)" }}>
              {patient.examDate}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
          <span style={modalityTag("#eff6ff", "var(--color-primary-600)")}>{patient.modality}</span>
          <span style={modalityTag("#f5f3ff", "#7c3aed")}>{patient.examItem}</span>
          {patient.isPediatric && (
            <span style={modalityTag("#fef2f2", "var(--color-error-600)")}>
              儿童({patient.pediatricAgeGroup})
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 'var(--space-4, 16px)',
          }}
        >
          <div style={doseBox}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>
              本次剂量
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: badge.color }}>
              {patient.doseValue}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{patient.doseUnit}</div>
          </div>
          <div style={doseBox}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>
              法规阈值
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary-800)" }}>
              {patient.threshold}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{patient.doseUnit}</div>
          </div>
          <div style={doseBox}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>占比</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: doseRatio > 1 ? "var(--color-error-600)" : "var(--color-success-600)",
              }}
            >
              {Math.round(doseRatio * 100)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>阈值比</div>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>剂量安全指标</span>
            <span
              style={{
                fontSize: 12,
                color: doseRatio > 1 ? "var(--color-error-600)" : "var(--color-success-600)",
                fontWeight: 600,
              }}
            >
              {doseRatio > 1 ? "超出" : "在控"}
              {Math.round((doseRatio - 1) * 100)}%
            </span>
          </div>
          <div
            style={{
              height: 8,
              background: "#e2e8f0",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(doseRatio * 100, 100)}%`,
                background:
                  doseRatio > 1 ? "var(--color-error-600)" : doseRatio > 0.8 ? "var(--color-warning-600)" : "var(--color-success-600)",
                borderRadius: 4,
                transition: "width 0.3s",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 'var(--space-1, 4px)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>0%</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>80%</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>100%</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 'var(--space-2, 8px)',
            padding: 'var(--space-3, 12px)',
            background: "var(--bg-primary)",
            borderRadius: 8,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary-800)" }}>
              {patient.examCount}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>累计检查</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary-800)" }}>
              {patient.cumulativeDLP}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>累计DLP</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary-800)" }}>
              {referenceValue}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>参考值</div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          gap: 'var(--space-2, 8px)',
        }}
      >
        <button
          onClick={() => onViewDetails(patient)}
          style={actionBtn("#eff6ff", "var(--color-primary-600)")}
        >
          <Eye size={13} /> 查看详情
        </button>
        <button
          onClick={() => {
            exportDoseDataToCSV([patient], `剂量记录_${patient.patientId}_${patient.patientName}.csv`);
            message.success('已导出该患者剂量记录 CSV');
          }}
          style={actionBtn("var(--bg-primary)", "#334155")}
        >
          <FileText size={13} /> 导出 CSV
        </button>
      </div>
    </div>
  );
}

const modalityTag = (bg: string, color: string): React.CSSProperties => ({
  padding: "3px 10px",
  background: bg,
  color,
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
});

const doseBox: React.CSSProperties = {
  background: "var(--bg-primary)",
  borderRadius: 8,
  padding: 'var(--space-3, 12px)',
  textAlign: "center",
};

const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1,
  padding: "8px 12px",
  background: bg,
  color,
  border: "none",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
});
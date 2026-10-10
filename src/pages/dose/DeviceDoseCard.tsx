import { Monitor, AlertTriangle, Clock, FileText } from "lucide-react";
import type { DeviceDoseData } from "./types";

interface Props {
  device: DeviceDoseData;
  onShowHistory: () => void;
}

export default function DeviceDoseCard({ device: d, onShowHistory }: Props) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 'var(--space-5, 20px)',
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#eff6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Monitor size={18} color="var(--color-primary-500)" />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-primary-800)",
              }}
            >
              {d.device}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 'var(--space-1, 4px)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: d.status === "warning" ? "var(--color-warning-600)" : "var(--color-success-600)",
                  }}
                />
                {d.status === "warning" ? "警告" : "正常"}
              </span>
            </div>
          </div>
        </div>
        {d.alertCount > 0 && (
          <span
            style={{
              padding: "4px 10px",
              background: "#fef2f2",
              color: "var(--color-error-600)",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 'var(--space-1, 4px)',
            }}
          >
            <AlertTriangle size={12} /> {d.alertCount}起预警
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 'var(--space-3, 12px)',
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        <Metric label="今日DLP" value={d.todayDLP} unit="mGy·cm" />
        <Metric label="今日CTDI" value={d.todayCTDI} unit="mGy" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 'var(--space-2, 8px)',
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        <MicroStat label="检查人数" value={d.examCount} />
        <MicroStat label="利用率" value={`${d.utilizationRate}%`} />
        <MicroStat label="平均CTDI" value={d.avgCTDI} />
      </div>

      <div
        style={{
          marginBottom: 'var(--space-3, 12px)',
          padding: 10,
          background: "var(--bg-primary)",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: "#64748b" }}>CTDI范围</span>
          <span style={{ fontSize: 12, color: "var(--color-primary-800)", fontWeight: 600 }}>
            {d.avgCTDI} - {d.maxCTDI} mGy
          </span>
        </div>
        <div
          style={{
            height: 4,
            background: "#e2e8f0",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(d.maxCTDI / 60) * 100}%`,
              background: d.maxCTDI > 50 ? "var(--color-error-600)" : "var(--color-primary-500)",
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
        <button onClick={onShowHistory} style={cardBtn("#eff6ff", "var(--color-primary-600)")}>
          <Clock size={13} /> 历史
        </button>
        <button
          onClick={() =>
            window.open(`/api/device/${d.device}/qc-report`, "_blank")
          }
          style={cardBtn("var(--bg-primary)", "#334155")}
        >
          <FileText size={13} /> QC报告
        </button>
      </div>
    </div>
  );
}

const Metric = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) => (
  <div
    style={{
      background: "var(--bg-primary)",
      borderRadius: 8,
      padding: 'var(--space-3, 12px)',
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 'var(--space-1, 4px)' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary-800)" }}>{value}</div>
    <div style={{ fontSize: 12, color: "#94a3b8" }}>{unit}</div>
  </div>
);

const MicroStat = ({ label, value }: { label: string; value: string | number }) => (
  <div
    style={{
      textAlign: "center",
      padding: 'var(--space-2, 8px)',
      background: "var(--bg-primary)",
      borderRadius: 6,
    }}
  >
    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary-800)" }}>{value}</div>
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
  </div>
);

const cardBtn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1,
  padding: 'var(--space-2, 8px)',
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
  gap: 'var(--space-1, 4px)',
});
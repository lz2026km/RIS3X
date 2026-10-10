import { t } from "../../i18n/appI18n";
import { AlertTriangle, CheckCircle, ShieldAlert, Eye } from "lucide-react";
import type { DoseAlert, CumulativeStats } from "./types";

interface DoseAlertConfigProps {
  doseAlerts: DoseAlert[];
  cumulativeStats: CumulativeStats;
  filteredAlerts: DoseAlert[];
  onAcknowledgeAlert: (alertId: string) => void;
  onViewPatient: (patientName: string) => void;
}

export default function DoseAlertConfig({
  doseAlerts,
  cumulativeStats,
  filteredAlerts,
  onAcknowledgeAlert,
  onViewPatient,
}: DoseAlertConfigProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--space-4, 16px)' }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 'var(--space-5, 20px)', border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)", marginBottom: 'var(--space-4, 16px)', display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
          <AlertTriangle size={16} color="var(--color-error-600)" />
          {t("doseTrack.alert.pending")}
          <span style={{ padding: "2px 8px", background: "#fef2f2", color: "var(--color-error-600)", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
            {doseAlerts.filter((a) => a.status === "pending").length}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-3, 12px)' }}>
          {filteredAlerts
            .filter((a) => a.status === "pending")
            .map((alert) => {
              const badge = alert.alertLevel === "critical"
                ? { bg: "#fef2f2", color: "var(--color-error-600)", border: "#fecaca" }
                : { bg: "#fffbeb", color: "var(--color-warning-600)", border: "#fde68a" };
              const exceedPercent = Math.round((alert.doseValue / alert.threshold - 1) * 100);
              return (
                <div key={alert.id} style={{ padding: 14, border: `1px solid ${badge.border}`, borderRadius: 10, background: badge.bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 'var(--space-2, 8px)' }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)" }}>{alert.patientName}</span>
                      <span style={{ padding: "2px 6px", background: "#eff6ff", color: "var(--color-primary-600)", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{alert.modality}</span>
                      <span style={{ padding: "2px 6px", background: badge.bg, color: badge.color, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                        {alert.alertLevel === "critical" ? "危" : "警"}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{alert.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                    {alert.examItem} · 设备：{alert.device}
                  </div>
                  <div style={{ fontSize: 12, color: badge.color, fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>
                    实测剂量：{alert.doseValue} mGy·cm（阈值：{alert.threshold}）
                    <span style={{ marginLeft: 'var(--space-2, 8px)' }}>超出 {exceedPercent}%</span>
                  </div>
                  <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{ height: "100%", width: `${Math.min((alert.doseValue / alert.threshold) * 100, 100)}%`, background: alert.alertLevel === "critical" ? "var(--color-error-600)" : "var(--color-warning-600)", borderRadius: 3 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)', marginBottom: 10, padding: "6px 10px", background: "var(--bg-card)", borderRadius: 4, fontSize: 12 }}>
                    <ShieldAlert size={12} color="var(--color-warning-600)" />
                    <span style={{ color: "#64748b" }}>
                      依据GBZ 130-2020，{alert.modality === "CT" ? "CT头颅平扫DLP参考值800mGy·cm" : alert.modality === "DSA" ? "DSA冠脉造影DAP参考值3000mGy·m²" : "该检查类型参考值"}，当前剂量超出指导水平
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
                    <button
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      style={{
                        flex: 1, padding: "6px 12px", background: "var(--color-error-600)", color: "#fff", border: "none",
                        borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 'var(--space-1, 4px)',
                      }}
                    >
                      <CheckCircle size={12} /> {t("doseTrack.alert.confirm")}
                    </button>
                    <button
                      onClick={() => onViewPatient(alert.patientName)}
                      style={{
                        flex: 1, padding: "6px 12px", background: "var(--bg-card)", color: "#334155",
                        border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 'var(--space-1, 4px)',
                      }}
                    >
                      <Eye size={12} /> {t("doseTrack.alert.viewDetails")}
                    </button>
                  </div>
                </div>
              );
            })}
          {filteredAlerts.filter((a) => a.status === "pending").length === 0 && (
            <div style={{ textAlign: "center", padding: 'var(--space-10, 40px)', color: "#94a3b8" }}>
              <CheckCircle size={48} color="#e2e8f0" style={{ marginBottom: 'var(--space-3, 12px)' }} />
              <div style={{ fontSize: 14 }}>{t("doseTrack.alert.noPending")}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 'var(--space-5, 20px)', border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)", marginBottom: 'var(--space-4, 16px)', display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
          <ShieldAlert size={16} color="var(--color-success-600)" />
          {t("doseTrack.alert.acknowledged")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {doseAlerts
            .filter((a) => a.status === "acknowledged")
            .map((alert) => (
              <div key={alert.id} style={{ padding: 'var(--space-3, 12px)', background: "var(--bg-primary)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-1, 4px)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary-800)" }}>{alert.patientName}</span>
                    <span style={{ padding: "2px 6px", background: "#f0fdf4", color: "var(--color-success-600)", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>已确认</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{alert.examItem} · {alert.time}</div>
                  {alert.notes && <div style={{ fontSize: 12, color: "#64748b", marginTop: 'var(--space-1, 4px)' }}>备注: {alert.notes}</div>}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
                  <div>超出 {Math.round((alert.doseValue / alert.threshold - 1) * 100)}%</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{alert.doseValue}/{alert.threshold}</div>
                </div>
              </div>
            ))}
        </div>

        <div style={{ marginTop: 'var(--space-5, 20px)', padding: 'var(--space-4, 16px)', background: "var(--bg-primary)", borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)", marginBottom: 'var(--space-3, 12px)' }}>          {t("doseTrack.alert.monthlyStats")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 'var(--space-3, 12px)' }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-error-600)" }}>{cumulativeStats.criticalAlerts}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>              {t("doseTrack.alert.critical")}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-warning-600)" }}>{cumulativeStats.warningAlerts}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>              {t("doseTrack.alert.warning")}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-success-600)" }}>0</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>              {t("doseTrack.alert.overdue")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

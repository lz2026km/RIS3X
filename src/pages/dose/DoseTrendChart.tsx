import { t } from "../../i18n/appI18n";
import { Monitor, Clock } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import type { DeviceDoseData } from "./types";
import { ChartContainer } from "../../components/charts";

interface DoseTrendChartProps {
  doseHistoryData: { date: string; CT: number; MR: number; DR: number; DSA: number; MG: number }[];
  ctdivolTrendData: { date: string; CT1: number; CT2: number; threshold: number }[];
  deviceDAPComparison: { device: string; DAP: number; threshold: number; avgDAP: number }[];
  deviceDoseData: DeviceDoseData[];
  onViewDeviceHistory: (device: string) => void;
}

export default function DoseTrendChart({
  doseHistoryData,
  ctdivolTrendData,
  deviceDAPComparison,
  deviceDoseData,
  onViewDeviceHistory,
}: DoseTrendChartProps) {
  // [v3.0.6.8-31] t() from appI18n
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 16 }}>
            {t("doseTrack.trend.overview") || "各类设备剂量趋势（本周DLP合计）"}
          </div>
          <ChartContainer height={220} state={doseHistoryData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无剂量趋势数据">
            <BarChart data={doseHistoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => `${v}`} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} mGy·cm`, "DLP"]} />
              <Legend iconSize={10} />
              <Bar dataKey="CT" fill="#3b82f6" name="CT" radius={[4, 4, 0, 0]} />
              <Bar dataKey="DR" fill="#22c55e" name="DR" radius={[4, 4, 0, 0]} />
              <Bar dataKey="DSA" fill="#f59e0b" name="DSA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 16 }}>
            {t("doseTrack.ctdiTrend.title")}
          </div>
          <ChartContainer height={220} state={ctdivolTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无CTDI趋势数据">
            <LineChart data={ctdivolTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 60]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="CT1" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} name="CT-1" />
              <Line type="monotone" dataKey="CT2" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} name="CT-2" />
              <Line type="monotone" dataKey="threshold" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" dot={false} name={t("doseTrack.ctdiTrend.threshold")} />
            </LineChart>
          </ChartContainer>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>{t("doseTrack.deviceDap.title")}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{t("doseTrack.deviceDap.subtitle")}</div>
          </div>
        </div>
        <ChartContainer height={240} state={deviceDAPComparison.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备DAP对比数据">
          <BarChart data={deviceDAPComparison} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="device" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="DAP" fill="#3b82f6" radius={[4, 4, 0, 0]} name="今日DAP" />
            <Bar dataKey="avgDAP" fill="#94a3b8" radius={[4, 4, 0, 0]} name="平均DAP" />
          </BarChart>
        </ChartContainer>
      </div>

      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 16 }}>
          {t("doseTrack.device.statusLabel") || "设备今日剂量状态"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deviceDoseData.map((d) => {
            const badge = d.status === "warning"
              ? { bg: "#fffbeb", color: "#d97706" }
              : { bg: "#f0fdf4", color: "#16a34a" };
            return (
              <div key={d.device} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-primary)", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Monitor size={14} color="#64748b" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>{d.device}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>DLP: {d.todayDLP} mGy·cm · CTDI: {d.todayCTDI} mGy</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {d.alertCount > 0 && (
                    <span style={{ padding: "2px 6px", background: "#fef2f2", color: "#dc2626", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                      {d.alertCount}
                    </span>
                  )}
                  <span style={{ padding: "2px 8px", background: badge.bg, color: badge.color, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                    {d.status === "warning" ? t("doseTrack.device.statusWarning") : t("doseTrack.device.statusNormal")}
                  </span>
                  <button
                    onClick={() => onViewDeviceHistory(d.device)}
                    style={{ padding: "4px 8px", background: "#eff6ff", color: "#2563eb", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}
                  >
                    <Clock size={10} /> {t("doseTrack.device.history")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



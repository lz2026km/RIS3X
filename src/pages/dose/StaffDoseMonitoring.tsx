import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { staffDoseRecords } from "./mockData";
import type { StaffDoseRecord } from "./types";
import { rdsrApi } from "../../services/api/rdsrApi";
import { DataTable } from "../../components/common";
import { LoadingBanner, ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import ChartContainer from "../../components/charts/ChartContainer";

const STAFF_COLORS = ["#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b", "#6366f1"];

// [G005 W8-Dose] 工作人员剂量: 优先取 /rdsr/staff, 端点不可用/返回空时回退内置演示数据。
export default function StaffDoseMonitoring() {
  const [records, setRecords] = useState<StaffDoseRecord[]>(staffDoseRecords);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "demo">("demo");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const res = await rdsrApi.getStaffDose();
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setRecords(res.data as StaffDoseRecord[]);
          setDataSource("api");
        } else if (!cancelled && !res.success) {
          setLoadError(t("w9.states.error"));
        }
      } catch {
        setLoadError(t("w9.states.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const first = records[0];
  if (!first) return null;

  const monthlyChartData = first.readings.map((r, idx) => ({
    month: r.month,
    ...Object.fromEntries(
      records.map((s: StaffDoseRecord) => [
        s.staffName,
        s.readings[idx]?.dose ?? 0,
      ]),
    ),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loading && <LoadingBanner message={t("w9.states.loading")} />}
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}
      {dataSource === "demo" && (
      <div
        style={{
          padding: "8px 12px",
          background: "#fef3c7",
          color: "#d97706",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertTriangle size={14} /> {t("w8Dose.staffDemo")}
      </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>监测人数</div>
          <div style={kpiVal("#1e40af")}>{records.length}</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>最高年剂量</div>
          <div
            style={kpiVal(
              Math.max(...records.map((s: StaffDoseRecord) => s.annualDose)) >
                10
                ? "#dc2626"
                : "#1e40af",
            )}
          >
            {Math.max(...records.map((s: StaffDoseRecord) => s.annualDose))}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>mSv</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>平均合规率</div>
          <div style={kpiVal("#16a34a")}>
            {Math.round(
              records.reduce(
                (s: number, r: StaffDoseRecord) => s + r.complianceRate,
                0,
              ) / records.length,
            )}
            %
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>高风险人员</div>
          <div
            style={kpiVal(
              records.filter(
                (s: StaffDoseRecord) => s.complianceRate < 60,
              ).length > 0
                ? "#dc2626"
                : "#16a34a",
            )}
          >
            {records.filter(
              (s: StaffDoseRecord) => s.complianceRate < 60,
            ).length}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 16,
          }}
        >
          月度人员剂量对比
        </div>
        <ChartContainer height={220} state={monthlyChartData.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <BarChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={0.5}
              stroke="#d97706"
              strokeDasharray="3 3"
              label={{
                value: "关注线",
                position: "right",
                fontSize: 12,
                fill: "#d97706",
              }}
            />
            {records.map((s: StaffDoseRecord, idx: number) => (
              <Bar
                key={s.id}
                dataKey={s.staffName}
                fill={STAFF_COLORS[idx % STAFF_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 16,
          }}
        >
          个人剂量监测记录
        </div>
        <div style={{ overflowX: "auto" }}>
          <DataTable
            rowKey="id"
            dataSource={records}
            showPagination={false}
            showExport={false}
            showDensity={false}
            columns={[
              { title: "姓名", dataIndex: "staffName", key: "staffName", align: "center", render: (v: string) => <span style={{ fontWeight: 600, color: "#1e40af" }}>{v}</span> },
              { title: "科室", dataIndex: "department", key: "department", align: "center", render: (v: string) => <span style={{ color: "#334155" }}>{v}</span> },
              { title: "岗位", dataIndex: "role", key: "role", align: "center", render: (v: string) => <span style={{ color: "#64748b" }}>{v}</span> },
              { title: "本月剂量(mSv)", dataIndex: "monthlyDose", key: "monthlyDose", align: "center", render: (v: number) => <span style={{ fontWeight: 700, color: "#1e40af" }}>{v}</span> },
              {
                title: "年累计(mSv)", dataIndex: "annualDose", key: "annualDose", align: "center",
                render: (v: number) => <span style={{ color: v > 15 ? "#dc2626" : "#334155", fontWeight: 600 }}>{v}</span>,
              },
              { title: "年限值(mSv)", dataIndex: "annualLimit", key: "annualLimit", align: "center", render: (v: number) => <span style={{ color: "#64748b" }}>{v}</span> },
              {
                title: "合规率", dataIndex: "complianceRate", key: "complianceRate", align: "center",
                render: (v: number) => {
                  const isHighRisk = v < 60;
                  const badgeBg = isHighRisk ? "#fef2f2" : v < 80 ? "#fffbeb" : "#f0fdf4";
                  const badgeColor = isHighRisk ? "#dc2626" : v < 80 ? "#d97706" : "#16a34a";
                  return (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: badgeBg, color: badgeColor, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                      {v}%
                    </div>
                  );
                },
              },
              {
                title: "状态", dataIndex: "complianceRate", key: "status", align: "center",
                render: (v: number) => {
                  const isHighRisk = v < 60;
                  return (
                    <span style={{ padding: "2px 8px", background: isHighRisk ? "#fef2f2" : "#f0fdf4", color: isHighRisk ? "#dc2626" : "#16a34a", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                      {isHighRisk ? "高风险" : "正常"}
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

const kpiBox: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 10,
  padding: "14px 16px",
  border: "1px solid #e2e8f0",
  textAlign: "center",
};

const kpiVal = (color: string): React.CSSProperties => ({
  fontSize: 24,
  fontWeight: 800,
  color,
  marginTop: 4,
});
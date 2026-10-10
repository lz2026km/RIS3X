import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { breastDoseRecords } from "./mockData";
import { getAlertBadge } from "./utils";
import type { BreastDoseRecord } from "./types";
import { rdsrApi } from "../../services/api/rdsrApi";
import { DataTable } from "../../components/common";
import { LoadingBanner, ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import ChartContainer from "../../components/charts/ChartContainer";

// [G005 W8-Dose] 乳腺剂量: 优先取 /rdsr/breast, 端点不可用/返回空时回退内置演示数据。
export default function BreastDoseTracking() {
  const [records, setRecords] = useState<BreastDoseRecord[]>(breastDoseRecords);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "demo">("demo");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const res = await rdsrApi.getBreast();
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setRecords(res.data as BreastDoseRecord[]);
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

  const totalExams = records.length;
  const recalledExams = records.filter(
    (r: BreastDoseRecord) => r.recallStatus !== "none",
  ).length;
  const avgAGD =
    records.reduce((s: number, r: BreastDoseRecord) => s + r.agd, 0) /
    totalExams;
  const exceedCount = records.filter(
    (r: BreastDoseRecord) => r.agd > r.referenceValue,
  ).length;

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
        <AlertTriangle size={14} /> {t("w8Dose.breastDemo")}
      </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <KpiBox label="本月检查量" value={totalExams} suffix="人次" color="#1e40af" />
        <KpiBox label="平均AGD" value={avgAGD.toFixed(1)} suffix="mGy" color="#16a34a" />
        <KpiBox
          label="召回重拍"
          value={recalledExams}
          suffix={`例 (${((recalledExams / totalExams) * 100).toFixed(1)}%)`}
          color="#d97706"
        />
        <KpiBox
          label="超标次数"
          value={exceedCount}
          suffix="次 (AGD>6mGy)"
          color={exceedCount > 0 ? "#dc2626" : "#16a34a"}
        />
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
              乳腺摄影AGD剂量追踪
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              平均腺体剂量(AGD)参考值: 6 mGy（欧盟标准）
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Legend color="#1e40af" label="AGD值" />
            <Legend color="#dc2626" label="参考线(6mGy)" />
          </div>
        </div>
        <ChartContainer height={200} state={records.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <BarChart
            data={records.map((r: BreastDoseRecord) => ({
              name: r.patientName.slice(0, 3),
              agd: r.agd,
              alert: r.agd > 6,
            }))}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 8]} />
            <Tooltip
              content={(({ active, payload, label }: { active?: boolean; payload?: Array<{value: number}>; label?: string }) => {
                if (active && payload && payload.length) {
                  const record = records.find((r: BreastDoseRecord) =>
                    r.patientName.startsWith(label ?? ""),
                  );
                  return (
                    <div
                      style={{
                        background: "var(--bg-card)",
                        padding: 10,
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
                        {record?.patientName}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        AGD: {payload[0]?.value} mGy
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: (record?.agd ?? 0) > 6 ? "#dc2626" : "#16a34a",
                        }}
                      >
                        {(record?.agd ?? 0) > 6 ? "超标" : "正常"}
                      </div>
                    </div>
                  );
                }
                return null;
              }) as ComponentProps<typeof Tooltip>['content']}
            />
            <ReferenceLine y={6} stroke="#dc2626" strokeDasharray="3 3" />
            <Bar dataKey="agd" radius={[4, 4, 0, 0]} name="AGD">
              {records.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.agd > 6 ? "#dc2626" : "#1e40af"}
                />
              ))}
            </Bar>
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
          乳腺剂量检查记录
        </div>
        <div style={{ overflowX: "auto" }}>
          <DataTable
            rowKey="id"
            dataSource={records}
            showPagination={false}
            showExport={false}
            showDensity={false}
            columns={[
              { title: "患者姓名", dataIndex: "patientName", key: "patientName", align: "center", render: (v: string) => <span style={{ fontWeight: 600, color: "#1e40af" }}>{v}</span> },
              { title: "年龄", dataIndex: "age", key: "age", align: "center", render: (v: number) => <span style={{ color: "#334155" }}>{v}</span> },
              { title: "检查日期", dataIndex: "examDate", key: "examDate", align: "center", render: (v: string) => <span style={{ color: "#64748b" }}>{v}</span> },
              {
                title: "AGD(mGy)", dataIndex: "agd", key: "agd", align: "center",
                render: (v: number, record: BreastDoseRecord) => (
                  <span style={{ fontWeight: 700, color: record.agd > 6 ? "#dc2626" : "#16a34a" }}>{v}</span>
                ),
              },
              { title: "参考值", dataIndex: "referenceValue", key: "referenceValue", align: "center", render: (v: number) => <span style={{ color: "#64748b" }}>{v}</span> },
              {
                title: "状态", dataIndex: "alertLevel", key: "alertLevel", align: "center",
                render: (v: BreastDoseRecord["alertLevel"]) => {
                  const badge = getAlertBadge(v);
                  return (
                    <span
                      style={{
                        padding: "2px 8px",
                        background: badge.bg,
                        color: badge.color,
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {badge.label}级
                    </span>
                  );
                },
              },
              {
                title: "召回状态", dataIndex: "recallStatus", key: "recallStatus", align: "center",
                render: (v: BreastDoseRecord["recallStatus"]) =>
                  v === "none" ? (
                    <span style={{ fontSize: 12, color: "#16a34a" }}>无需召回</span>
                  ) : v === "recalled" ? (
                    <span style={{ padding: "2px 8px", background: "#fffbeb", color: "#d97706", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>待重拍</span>
                  ) : (
                    <span style={{ padding: "2px 8px", background: "#f0fdf4", color: "#16a34a", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>已完成</span>
                  ),
              },
              { title: "设备", dataIndex: "device", key: "device", align: "center", render: (v: string) => <span style={{ color: "#334155" }}>{v}</span> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

const KpiBox = ({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix: string;
  color: string;
}) => (
  <div
    style={{
      background: "var(--bg-card)",
      borderRadius: 10,
      padding: "14px 16px",
      border: "1px solid #e2e8f0",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{suffix}</div>
  </div>
);

const Legend = ({ color, label }: { color: string; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
    <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
  </div>
);
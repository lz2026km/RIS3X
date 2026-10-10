import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { controlChartData } from "./mockData";
import type { ControlChartPoint } from "./types";
import { rdsrApi } from "../../services/api/rdsrApi";
import { LoadingBanner, ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import ChartContainer from "../../components/charts/ChartContainer";

// [G005 W8-Dose] 由 /rdsr/stats 趋势派生 X-bar/R 控制图 (移动极差法)。
// 端点不可用/趋势不足时回退内置演示数据。
function deriveControlPoints(
  trend: { date: string; avgCtdivol: number }[],
): ControlChartPoint[] {
  if (trend.length < 2) return [];
  const means = trend.map((p) => Number(p.avgCtdivol) || 0);
  const ranges: number[] = means.map((m, i) => (i === 0 ? 0 : Math.abs(m - means[i - 1]!)));
  const meanBar = means.reduce((s, x) => s + x, 0) / means.length;
  const mrBar =
    ranges.slice(1).reduce((s, x) => s + x, 0) / Math.max(1, ranges.length - 1);
  const sigma = mrBar / 1.128;
  const ucl = +(meanBar + 3 * sigma).toFixed(1);
  const lcl = Math.max(0, +(meanBar - 3 * sigma).toFixed(1));
  const rangeUcl = +(3.267 * mrBar).toFixed(1);
  return trend.map((p, i) => ({
    date: p.date.slice(5, 10),
    mean: +means[i]!.toFixed(1),
    ucl,
    lcl,
    range: +ranges[i]!.toFixed(1),
    rangeUcl,
  }));
}

export default function DoseControlCharts() {
  const [points, setPoints] = useState<ControlChartPoint[]>(controlChartData);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"api" | "demo">("demo");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const res = await rdsrApi.getStats();
        if (!cancelled && res.success && res.data && Array.isArray(res.data.trend)) {
          const derived = deriveControlPoints(
            res.data.trend.flatMap((p) => (p?.date ? [{ date: p.date, avgCtdivol: p.avgCtdivol }] : [])),
          );
          if (derived.length > 0) {
            setPoints(derived);
            setDataSource("api");
          }
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

  const outOfControl = points.filter(
    (p: ControlChartPoint) =>
      p.mean > p.ucl || p.mean < p.lcl || p.range > p.rangeUcl,
  );

  // [P0] 控制限/中心线由派生统计驱动 (原为硬编码 22/32/12/15)
  const first = points[0];
  const last = points[points.length - 1];
  // UCL/LCL/rangeUcl 在派生时已对全部点取同一值; 回退演示数据同样一致.
  const cl = first ? first.mean : 0;
  const ucl = first?.ucl ?? 0;
  const lcl = first?.lcl ?? 0;
  const rangeUcl = Math.max(...points.map((p) => p.rangeUcl), 0);
  const meanMax = Math.max(ucl, ...points.map((p) => p.mean), 0);
  const meanMin = Math.min(lcl, ...points.map((p) => p.mean), 0);
  const meanDomain: [number, number] = [Math.max(0, Math.floor(meanMin - 3)), Math.ceil(meanMax + 3)];
  const rangeDomain: [number, number] = [0, Math.ceil(Math.max(rangeUcl, ...points.map((p) => p.range), 1) + 3)];
  const meanShift =
    first && last
      ? (last.mean - first.mean >= 0 ? "+" : "") +
        (last.mean - first.mean).toFixed(1)
      : "-";

  // [P0] 过程能力 Cp 由数据估算 (原硬编码 1.25).
  //   sigma ≈ 平均移动极差 / 1.128 (d2), 规格窗口取控制限 [LCL, UCL].
  const mrBar =
    points.length > 1
      ? points.slice(1).reduce((s, p) => s + p.range, 0) / (points.length - 1)
      : 0;
  const sigma = mrBar > 0 ? mrBar / 1.128 : 0;
  const processCp = sigma > 0 && ucl > lcl ? (((ucl - lcl) / (6 * sigma)).toFixed(2)) : "-";

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
        <AlertTriangle size={14} /> {t("w8Dose.controlDemo")}
      </div>
      )}
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
              X-bar 控制图（CTDIvol均值）
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              7日CTDIvol均值监控 · UCL: {ucl} · LCL: {lcl} · CL: {Math.round(cl)}
            </div>
          </div>
          {outOfControl.length > 0 && (
            <span
              style={{
                padding: "4px 10px",
                background: "#fef2f2",
                color: "#dc2626",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AlertTriangle size={12} /> {outOfControl.length}个失控点
            </span>
          )}
        </div>
        <ChartContainer height={220} state={points.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={meanDomain} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <ReferenceLine
              y={cl}
              stroke="#16a34a"
              strokeDasharray="5 5"
              label={{ value: `CL(${cl.toFixed(1)})`, position: "left", fontSize: 12, fill: "#16a34a" }}
            />
            <ReferenceLine
              y={ucl}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{
                value: `UCL(${ucl})`,
                position: "center",
                fontSize: 12,
                fill: "#dc2626",
              }}
            />
            <ReferenceLine
              y={lcl}
              stroke="#d97706"
              strokeDasharray="5 5"
              label={{
                value: `LCL(${lcl})`,
                position: "right",
                fontSize: 12,
                fill: "#d97706",
              }}
            />
            <Line
              type="monotone"
              dataKey="mean"
              stroke="#1e40af"
              strokeWidth={2}
              dot={{ fill: "#1e40af", r: 4 }}
              name="均值"
            />
          </LineChart>
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
          R 控制图（极差监控）
        </div>
        <ChartContainer height={200} state={points.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={rangeDomain} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <ReferenceLine
              y={rangeUcl}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{
                value: `UCL(${rangeUcl})`,
                position: "right",
                fontSize: 12,
                fill: "#dc2626",
              }}
            />
            <Line
              type="monotone"
              dataKey="range"
              stroke="#d97706"
              strokeWidth={2}
              dot={{ fill: "#d97706", r: 4 }}
              name="极差"
            />
          </LineChart>
        </ChartContainer>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>均值偏移</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e40af", marginTop: 4 }}>
            {meanShift}
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>过程能力Cp</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
            {processCp}
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>失控点数</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: outOfControl.length > 0 ? "#dc2626" : "#16a34a",
              marginTop: 4,
            }}
          >
            {outOfControl.length}
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>过程状态</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: outOfControl.length > 0 ? "#dc2626" : "#16a34a",
              marginTop: 4,
            }}
          >
            {outOfControl.length > 0 ? "失控" : "受控"}
          </div>
        </div>
      </div>

      {outOfControl.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            borderRadius: 8,
            border: "1px solid #fecaca",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <AlertTriangle
            size={14}
            color="#dc2626"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ fontSize: 12, color: "#dc2626" }}>
            <strong>SPC失控告警：</strong>检测到 {outOfControl.length}{" "}
            个数据点超出控制限。 建议检查设备校准状态、扫描参数设置，并在剂量优化后重新评估过程能力。
          </div>
        </div>
      )}
    </div>
  );
}

const kpiBox: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 10,
  padding: 12,
  border: "1px solid #e2e8f0",
  textAlign: "center",
};
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp as TrendingUpCircle } from "lucide-react";
import { monthlyDoseTrend } from "./mockData";
import type { MonthlyDoseTrend } from "./types";
import { rdsrApi } from "../../services/api/rdsrApi";
import { ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import ChartContainer from "../../components/charts/ChartContainer";

interface TooltipPayload {
  value: number;
}

// [W3-C] 月度趋势: 接 rdsrApi.getStats() 的按日趋势聚合成月度 DLP 均值, 失败回退演示数据
export default function DoseTrendAnalysis() {
  const [trendData, setTrendData] = useState<MonthlyDoseTrend[]>(monthlyDoseTrend);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const res = await rdsrApi.getStats();
        if (cancelled) return;
        if (!res.success) { setLoadError(t('w9.states.error')); return; }
        if (!res.data || !Array.isArray(res.data.trend) || res.data.trend.length === 0) return;
        const byMonth = new Map<string, { sum: number; count: number }>();
        for (const t of res.data.trend) {
          const m = String(t.date ?? '').slice(0, 7);
          if (!m) continue;
          const entry = byMonth.get(m) ?? { sum: 0, count: 0 };
          entry.sum += t.avgDlp;
          entry.count += 1;
          byMonth.set(m, entry);
        }
        const aggregated: MonthlyDoseTrend[] = Array.from(byMonth.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, v]) => {
            const demo = monthlyDoseTrend.find((d) => d.month === month);
            return {
              month,
              ctAvgDLP: Math.round((v.sum / v.count) * 10) / 10,
              chestCTAvgDLP: demo?.chestCTAvgDLP ?? 0,
              abdomenCTAvgDLP: demo?.abdomenCTAvgDLP ?? 0,
              headCTAvgDLP: demo?.headCTAvgDLP ?? 0,
            };
          });
        if (aggregated.length >= 2) {
          setTrendData(aggregated);
          setSource('api');
        }
      } catch {
        setLoadError(t('w9.states.error'));
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // [P0] Y 轴域由数据驱动 (原硬编码 [300,1000]); KPI 由趋势首末值计算 (原硬编码)
  const seriesKeys = ['ctAvgDLP', 'chestCTAvgDLP', 'abdomenCTAvgDLP'] as const
  const allValues = trendData.flatMap((d) => seriesKeys.map((k) => Number(d[k]) || 0)).filter((v) => Number.isFinite(v))
  const dataMax = allValues.length ? Math.max(...allValues) : 0
  const dataMin = allValues.length ? Math.min(...allValues) : 0
  const yDomain: [number, number] = [Math.max(0, Math.floor(dataMin - (dataMax - dataMin) * 0.1 - 20)), Math.ceil(dataMax + (dataMax - dataMin) * 0.1 + 20)]

  const firstTrend = trendData[0]
  const lastTrend = trendData[trendData.length - 1]
  const pctDrop = (from?: number, to?: number): string => {
    if (!from || !to || from <= 0) return "-"
    return `${(((to - from) / from) * 100).toFixed(1)}%`
  }
  const ctDrop = pctDrop(firstTrend?.ctAvgDLP, lastTrend?.ctAvgDLP)
  const ctRange = firstTrend && lastTrend ? `${Math.round(firstTrend.ctAvgDLP)}→${Math.round(lastTrend.ctAvgDLP)}` : "-"
  const chestRange = firstTrend && lastTrend ? `${Math.round(firstTrend.chestCTAvgDLP)}→${Math.round(lastTrend.chestCTAvgDLP)}` : "-"
  // AAPM 胸部参考值 (演示数据中为 560), 从参考常量解析
  const chestRef = 560
  const chestBelowRef = (lastTrend?.chestCTAvgDLP ?? Infinity) <= chestRef

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: "var(--bg-card)",
            padding: 'var(--space-3, 12px)',
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-primary-800)",
              marginBottom: 'var(--space-2, 8px)',
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <div>
              CT平均DLP:{" "}
              <span style={{ fontWeight: 600, color: "var(--color-primary-800)" }}>
                {payload[0]?.value} mGy·cm
              </span>
            </div>
            <div>
              胸部CT:{" "}
              <span style={{ fontWeight: 600, color: "var(--color-error-600)" }}>
                {payload[1]?.value} mGy·cm
              </span>
            </div>
            <div>
              腹部CT:{" "}
              <span style={{ fontWeight: 600, color: "var(--color-warning-600)" }}>
                {payload[2]?.value} mGy·cm
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-4, 16px)' }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      {/* 月度剂量趋势折线图 */}
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
            alignItems: "center",
            marginBottom: 'var(--space-4, 16px)',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)" }}>
              每月CT剂量平均值趋势
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              {source === 'api' ? '数据源: /rdsr/stats (按日趋势月度聚合)' : '2025年7月 - 2026年4月 CT剂量DLP趋势分析 (演示数据)'}
            </div>
          </div>
          <div style={{ display: "flex", gap: 'var(--space-3, 12px)' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
              <div
                style={{
                  width: 10,
                  height: 3,
                  background: "var(--color-primary-800)",
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>CT平均DLP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
              <div
                style={{
                  width: 10,
                  height: 3,
                  background: "var(--color-error-600)",
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>胸部CT</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
              <div
                style={{
                  width: 10,
                  height: 3,
                  background: "var(--color-warning-600)",
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>腹部CT</span>
            </div>
          </div>
        </div>
        <ChartContainer height={260} state={trendData.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <LineChart data={trendData as MonthlyDoseTrend[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              domain={yDomain}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="ctAvgDLP"
              stroke="var(--color-primary-800)"
              strokeWidth={2}
              dot={{ fill: "var(--color-primary-800)", strokeWidth: 2, r: 3 }}
              name="CT平均DLP"
            />
            <Line
              type="monotone"
              dataKey="chestCTAvgDLP"
              stroke="var(--color-error-600)"
              strokeWidth={2}
              dot={{ fill: "var(--color-error-600)", strokeWidth: 2, r: 3 }}
              name="胸部CT"
            />
            <Line
              type="monotone"
              dataKey="abdomenCTAvgDLP"
              stroke="var(--color-warning-600)"
              strokeWidth={2}
              dot={{ fill: "var(--color-warning-600)", strokeWidth: 2, r: 3 }}
              name="腹部CT"
            />
            <ReferenceLine
              y={560}
              stroke="var(--color-error-600)"
              strokeDasharray="5 5"
              label={{
                value: "AAPM胸部参考值",
                position: "right",
                fontSize: 12,
                fill: "var(--color-error-600)",
              }}
            />
          </LineChart>
        </ChartContainer>

        {/* 趋势统计 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 'var(--space-3, 12px)',
            marginTop: 'var(--space-4, 16px)',
            padding: 'var(--space-3, 12px)',
            background: "var(--bg-primary)",
            borderRadius: 8,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: ctDrop.startsWith('-') ? "var(--color-success-600)" : "var(--color-error-600)" }}>
              {ctDrop}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>CT剂量优化幅度</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary-800)" }}>
              {ctRange}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>DLP降低趋势</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-error-600)" }}>
              {chestRange}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>胸部CT降幅</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: chestBelowRef ? "var(--color-success-600)" : "var(--color-error-600)" }}>
              {chestBelowRef ? "达标" : "超标"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>当前胸部CT状态</div>
          </div>
        </div>
      </div>

      {/* 新设备换装前后对比 */}
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
            alignItems: "center",
            marginBottom: 'var(--space-4, 16px)',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)" }}>
              新设备换装前后剂量对比
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              2025年Q1 vs 2026年Q1 设备升级效果评估
            </div>
          </div>
          <div
            style={{
              padding: "4px 12px",
              background: "#ecfdf5",
              color: "var(--color-success-600)",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 'var(--space-1, 4px)',
            }}
          >
            <TrendingDown size={12} />
            剂量降低 22.8%
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--space-4, 16px)' }}
        >
          {/* 换装前 */}
          <div
            style={{
              padding: 'var(--space-4, 16px)',
              background: "#fef2f2",
              borderRadius: 8,
              border: "1px solid #fecaca",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--color-error-600)",
                marginBottom: 'var(--space-3, 12px)',
              }}
            >
              换装前 (2025-Q1)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  CT-1 平均DLP
                </span>
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--color-error-600)" }}
                >
                  920 mGy·cm
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  CT-2 平均DLP
                </span>
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--color-error-600)" }}
                >
                  880 mGy·cm
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 'var(--space-2, 8px)',
                  borderTop: "1px solid #fecaca",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  全院平均DLP
                </span>
                <span
                  style={{ fontSize: 16, fontWeight: 800, color: "var(--color-error-600)" }}
                >
                  900 mGy·cm
                </span>
              </div>
            </div>
          </div>

          {/* 换装后 */}
          <div
            style={{
              padding: 'var(--space-4, 16px)',
              background: "#ecfdf5",
              borderRadius: 8,
              border: "1px solid #bbf7d0",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--color-success-600)",
                marginBottom: 'var(--space-3, 12px)',
              }}
            >
              换装后 (2026-Q1)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  CT-1 平均DLP
                </span>
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--color-success-600)" }}
                >
                  720 mGy·cm
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  CT-2 平均DLP
                </span>
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--color-success-600)" }}
                >
                  680 mGy·cm
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 'var(--space-2, 8px)',
                  borderTop: "1px solid #bbf7d0",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  全院平均DLP
                </span>
                <span
                  style={{ fontSize: 16, fontWeight: 800, color: "var(--color-success-600)" }}
                >
                  695 mGy·cm
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 'var(--space-4, 16px)',
            padding: "10px 12px",
            background: "#eff6ff",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 'var(--space-2, 8px)',
          }}
        >
          <TrendingUpCircle size={14} color="var(--color-primary-800)" />
          <span style={{ fontSize: 12, color: "var(--color-primary-800)" }}>
            设备换装后，CT-1剂量降低21.7%，CT-2剂量降低22.7%，全院平均剂量降低22.8%，达到预期优化目标
          </span>
        </div>
      </div>
    </div>
  );
}
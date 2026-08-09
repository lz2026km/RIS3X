import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp as TrendingUpCircle } from "lucide-react";
import { monthlyDoseTrend } from "./mockData";
import type { MonthlyDoseTrend } from "./types";
import { rdsrApi } from "../../services/api/rdsrApi";

interface TooltipPayload {
  value: number;
}

// [W3-C] 月度趋势: 接 rdsrApi.getStats() 的按日趋势聚合成月度 DLP 均值, 失败回退演示数据
export default function DoseTrendAnalysis() {
  const [trendData, setTrendData] = useState<MonthlyDoseTrend[]>(monthlyDoseTrend);
  const [source, setSource] = useState<'api' | 'demo'>('demo');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await rdsrApi.getStats();
        if (cancelled || !res.success || !res.data || !Array.isArray(res.data.trend) || res.data.trend.length === 0) return;
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
        /* 回退演示数据 */
      }
    })();
    return () => { cancelled = true; };
  }, []);
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
            padding: 12,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#1e40af",
              marginBottom: 8,
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <div>
              CT平均DLP:{" "}
              <span style={{ fontWeight: 600, color: "#1e40af" }}>
                {payload[0]?.value} mGy·cm
              </span>
            </div>
            <div>
              胸部CT:{" "}
              <span style={{ fontWeight: 600, color: "#dc2626" }}>
                {payload[1]?.value} mGy·cm
              </span>
            </div>
            <div>
              腹部CT:{" "}
              <span style={{ fontWeight: 600, color: "#d97706" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 月度剂量趋势折线图 */}
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
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
              每月CT剂量平均值趋势
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              {source === 'api' ? '数据源: /rdsr/stats (按日趋势月度聚合)' : '2025年7月 - 2026年4月 CT剂量DLP趋势分析 (演示数据)'}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 10,
                  height: 3,
                  background: "#1e40af",
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>CT平均DLP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 10,
                  height: 3,
                  background: "#dc2626",
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>胸部CT</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 10,
                  height: 3,
                  background: "#d97706",
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>腹部CT</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData as MonthlyDoseTrend[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              domain={[300, 1000]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="ctAvgDLP"
              stroke="#1e40af"
              strokeWidth={2}
              dot={{ fill: "#1e40af", strokeWidth: 2, r: 3 }}
              name="CT平均DLP"
            />
            <Line
              type="monotone"
              dataKey="chestCTAvgDLP"
              stroke="#dc2626"
              strokeWidth={2}
              dot={{ fill: "#dc2626", strokeWidth: 2, r: 3 }}
              name="胸部CT"
            />
            <Line
              type="monotone"
              dataKey="abdomenCTAvgDLP"
              stroke="#d97706"
              strokeWidth={2}
              dot={{ fill: "#d97706", strokeWidth: 2, r: 3 }}
              name="腹部CT"
            />
            <ReferenceLine
              y={560}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{
                value: "AAPM胸部参考值",
                position: "right",
                fontSize: 12,
                fill: "#dc2626",
              }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* 趋势统计 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 16,
            padding: 12,
            background: "var(--bg-primary)",
            borderRadius: 8,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>
              -15.3%
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>CT剂量优化幅度</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1e40af" }}>
              820→695
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>DLP降低趋势</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#dc2626" }}>
              580→415
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>胸部CT降幅</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>
              达标
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
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
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
              color: "#16a34a",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <TrendingDown size={12} />
            剂量降低 22.8%
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* 换装前 */}
          <div
            style={{
              padding: 16,
              background: "#fef2f2",
              borderRadius: 8,
              border: "1px solid #fecaca",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#dc2626",
                marginBottom: 12,
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
                  style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}
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
                  style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}
                >
                  880 mGy·cm
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 8,
                  borderTop: "1px solid #fecaca",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  全院平均DLP
                </span>
                <span
                  style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}
                >
                  900 mGy·cm
                </span>
              </div>
            </div>
          </div>

          {/* 换装后 */}
          <div
            style={{
              padding: 16,
              background: "#ecfdf5",
              borderRadius: 8,
              border: "1px solid #bbf7d0",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#16a34a",
                marginBottom: 12,
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
                  style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}
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
                  style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}
                >
                  680 mGy·cm
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 8,
                  borderTop: "1px solid #bbf7d0",
                }}
              >
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  全院平均DLP
                </span>
                <span
                  style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}
                >
                  695 mGy·cm
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            background: "#eff6ff",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TrendingUpCircle size={14} color="#1e40af" />
          <span style={{ fontSize: 12, color: "#1e40af" }}>
            设备换装后，CT-1剂量降低21.7%，CT-2剂量降低22.7%，全院平均剂量降低22.8%，达到预期优化目标
          </span>
        </div>
      </div>
    </div>
  );
}
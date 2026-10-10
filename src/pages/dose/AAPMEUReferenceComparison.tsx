import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import ChartContainer from "../../components/charts/ChartContainer";
import { DataTable } from "../../components/common";
import { ErrorBanner } from "../../components/feedback";
import { AAPM_EU_REFERENCES } from "./mockData";
import { rdsrApi } from "../../services/api/rdsrApi";
import { t } from "../../i18n/appI18n";
import type { AAPMReference } from "./types";

export default function AAPMEUReferenceComparison() {
  // [W10-B] AAPM/欧盟参考值为静态规范值; 本院平均值优先取 /rdsr/today 的
  //         按部位平均 CTDIvol, 端点不可用/无数据时回退内置演示值。
  const [refs, setRefs] = useState<AAPMReference[]>(AAPM_EU_REFERENCES);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const res = await rdsrApi.getToday();
        if (cancelled) return;
        if (!res.success) { setLoadError(t('w9.states.error')); return; }
        if (!res.data) return;
        const dist = res.data.bodyPartDistribution ?? [];
        if (dist.length === 0) return;
        setRefs(
          AAPM_EU_REFERENCES.map((r) => {
            const hit = dist.find((d) => r.examType.includes(d.bodyPart));
            if (!hit) return r;
            const hospitalAvg = Number(hit.avgCtdiVol.toFixed(1));
            const exceedRate =
              r.aapmRef > 0 && hospitalAvg > r.aapmRef
                ? +((hospitalAvg - r.aapmRef) / r.aapmRef).toFixed(2)
                : 0;
            return { ...r, hospitalAvg, exceedRate };
          }),
        );
      } catch {
        setLoadError(t('w9.states.error'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const chartData = refs.map((ref: AAPMReference) => ({
    name: ref.examType,
    aapm: ref.aapmRef,
    eu: ref.euRef,
    hospital: ref.hospitalAvg,
  }));

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const ref = refs.find((r) => r.examType === label);
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
              AAPM参考值:{" "}
              <span style={{ fontWeight: 600, color: "#1e40af" }}>
                {payload[0]?.value} mGy
              </span>
            </div>
            <div>
              欧盟参考值:{" "}
              <span style={{ fontWeight: 600, color: "#7c3aed" }}>
                {payload[1]?.value} mGy
              </span>
            </div>
            <div>
              本院平均值:{" "}
              <span style={{ fontWeight: 600, color: "#dc2626" }}>
                {payload[2]?.value} mGy
              </span>
            </div>
            {ref && (
              <div>
                超标比例:{" "}
                <span
                  style={{
                    fontWeight: 600,
                    color: ref.exceedRate > 0.5 ? "#dc2626" : "#16a34a",
                  }}
                >
                  {(ref.exceedRate * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      <div
        style={{
          padding: "8px 12px",
          background: "#eff6ff",
          color: "#1e40af",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertTriangle size={14} /> 静态参考数据：AAPM / 欧盟 CTDIvol 参考值来自公开规范文档（非接口数据）；院内平均值部分为演示
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
            AAPM/欧盟 CT剂量参考值对比
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            本院CT剂量 vs 国际参考值（单位: CTDIvol mGy）
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#1e40af",
              }}
            />
            <span style={{ fontSize: 12, color: "#64748b" }}>AAPM参考值</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#7c3aed",
              }}
            />
            <span style={{ fontSize: 12, color: "#64748b" }}>欧盟参考值</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "#dc2626",
              }}
            />
            <span style={{ fontSize: 12, color: "#64748b" }}>本院平均值</span>
          </div>
        </div>
      </div>

      <ChartContainer height={280} state={chartData.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
        <BarChart data={chartData} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 70]} />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="aapm"
            fill="#1e40af"
            radius={[4, 4, 0, 0]}
            name="AAPM参考值"
          />
          <Bar
            dataKey="eu"
            fill="#7c3aed"
            radius={[4, 4, 0, 0]}
            name="欧盟参考值"
          />
          <Bar
            dataKey="hospital"
            fill="#dc2626"
            radius={[4, 4, 0, 0]}
            name="本院平均值"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.hospital > entry.aapm ? "#dc2626" : "#16a34a"}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* 超标告警表格 */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 12,
          }}
        >
          CT剂量参考值对比表
        </div>
        <DataTable
          rowKey="examType"
          dataSource={refs}
          showPagination={false}
          showExport={false}
          showDensity={false}
          columns={[
            { title: "检查类型", dataIndex: "examType", key: "examType", align: "center", render: (v: string) => <span style={{ fontWeight: 600, color: "#1e40af" }}>{v}</span> },
            { title: "AAPM参考值", dataIndex: "aapmRef", key: "aapmRef", align: "center", render: (v: number) => <span style={{ color: "#334155" }}>{v} mGy</span> },
            { title: "欧盟参考值", dataIndex: "euRef", key: "euRef", align: "center", render: (v: number) => <span style={{ color: "#334155" }}>{v} mGy</span> },
            {
              title: "本院平均值", dataIndex: "hospitalAvg", key: "hospitalAvg", align: "center",
              render: (v: number, ref: AAPMReference) => (
                <span style={{ fontWeight: 700, color: ref.exceedRate > 0 ? "#dc2626" : "#16a34a" }}>{v} mGy</span>
              ),
            },
            {
              title: "超标比例", dataIndex: "exceedRate", key: "exceedRate", align: "center",
              render: (_v: number, ref: AAPMReference) => {
                const isExceed = ref.exceedRate > 0;
                return (
                  <span
                    style={{
                      padding: "3px 8px",
                      background: isExceed ? "#fef2f2" : "#f0fdf4",
                      color: isExceed ? "#dc2626" : "#16a34a",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {isExceed ? `${(ref.exceedRate * 100).toFixed(0)}%` : "0%"}
                  </span>
                );
              },
            },
          ]}
        />
      </div>

      {/* 告警说明 */}
      {refs.some((r) => r.exceedRate > 0.5) && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <AlertTriangle
            size={16}
            color="#dc2626"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ fontSize: 12, color: "#dc2626" }}>
            <strong>超标告警：</strong>
            胸部CT和腹部CT的本院平均值超过AAPM参考值，需要进行剂量优化分析。建议检查扫描参数设置，考虑降低剂量配置。
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
import { AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AAPM_EU_REFERENCES } from "./mockData";
import type { AAPMReference } from "./types";

export default function AAPMEUReferenceComparison() {
  const chartData = AAPM_EU_REFERENCES.map((ref: AAPMReference) => ({
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
      const ref = AAPM_EU_REFERENCES.find((r) => r.examType === label);
      return (
        <div
          style={{
            background: "#fff",
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
          background: "#fff",
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

      <ResponsiveContainer width="100%" height={280}>
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
      </ResponsiveContainer>

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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {[
                "检查类型",
                "AAPM参考值",
                "欧盟参考值",
                "本院平均值",
                "超标比例",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AAPM_EU_REFERENCES.map((ref, i) => {
              const isExceed = ref.exceedRate > 0;
              return (
                <tr
                  key={ref.examType}
                  style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}
                >
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1e40af",
                      textAlign: "center",
                    }}
                  >
                    {ref.examType}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#334155",
                      textAlign: "center",
                    }}
                  >
                    {ref.aapmRef} mGy
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#334155",
                      textAlign: "center",
                    }}
                  >
                    {ref.euRef} mGy
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: isExceed ? "#dc2626" : "#16a34a",
                      textAlign: "center",
                    }}
                  >
                    {ref.hospitalAvg} mGy
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
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
                      {isExceed
                        ? `${(ref.exceedRate * 100).toFixed(0)}%`
                        : "0%"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 告警说明 */}
      {AAPM_EU_REFERENCES.some((r) => r.exceedRate > 0.5) && (
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
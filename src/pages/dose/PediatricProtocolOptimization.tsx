import { useState } from "react";
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
import { Info } from "lucide-react";
import { pediatricProtocols } from "./mockData";
import type { PediatricProtocol } from "./types";

const AGE_GROUPS = ["0-5岁", "5-10岁", "10-15岁"];

const ADULT_VS_PED = [
  { name: "成人(>15岁)", dose: 720, fill: "#3b82f6" },
  { name: "10-15岁", dose: 504, fill: "#8b5cf6" },
  { name: "5-10岁", dose: 432, fill: "#f59e0b" },
  { name: "0-5岁", dose: 288, fill: "#ef4444" },
];

export default function PediatricProtocolOptimization() {
  const [selectedAge, setSelectedAge] = useState("0-5岁");
  const filteredProtocols = pediatricProtocols.filter(
    (p: PediatricProtocol) => p.ageGroup === selectedAge,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
        <Info size={14} /> 演示数据：儿科协议优化建议基于 AAPM 指南模板，rdsrApi 无儿科专项端点，参数为本地模拟
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
            fontSize: 13,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 16,
          }}
        >
          儿科协议优化建议
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {AGE_GROUPS.map((ag) => (
            <button
              key={ag}
              onClick={() => setSelectedAge(ag)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: selectedAge === ag ? "#1e40af" : "#f1f5f9",
                color: selectedAge === ag ? "#fff" : "#64748b",
              }}
            >
              {ag}
            </button>
          ))}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-primary)" }}>
              {[
                "协议名称",
                "年龄组",
                "体重范围(kg)",
                "推荐KVP",
                "推荐mAs",
                "剂量折扣",
                "说明",
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
            {filteredProtocols.map((p: PediatricProtocol, i: number) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-primary)" }}
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
                  {p.protocolName}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#334155",
                    textAlign: "center",
                  }}
                >
                  {p.ageGroup}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#334155",
                    textAlign: "center",
                  }}
                >
                  {p.weightMin}-{p.weightMax}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1e40af",
                    textAlign: "center",
                  }}
                >
                  {p.recommendedKVP} kVp
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#7c3aed",
                    textAlign: "center",
                  }}
                >
                  {p.recommendedMAS} mAs
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      background: "#eff6ff",
                      color: "#1e40af",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    ×{p.doseReductionFactor}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#64748b",
                    textAlign: "center",
                  }}
                >
                  成人剂量×{p.doseReductionFactor}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            fontSize: 13,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 16,
          }}
        >
          成人 vs 儿童剂量对比（CT头部）
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ADULT_VS_PED} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v} mGy·cm`, "DLP"]}
            />
            <Bar dataKey="dose" radius={[4, 4, 0, 0]}>
              {ADULT_VS_PED.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
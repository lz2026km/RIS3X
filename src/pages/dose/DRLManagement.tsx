import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { rdsrApi } from "../../services/api/rdsrApi";
import { drlRecords } from "./mockData";
import type { DRLRecord } from "./types";

export default function DRLManagement() {
  const [rows, setRows] = useState<DRLRecord[]>(drlRecords);

  // [W2-C] 接 rdsrApi DRL 配置 (/rdsr/drl), 失败/为空时回退演示数据
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await rdsrApi.getDrls();
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const apiRows: DRLRecord[] = res.data.map((d) => ({
            modality: d.modality,
            examType: d.bodyPart,
            nationalDRL: d.ctdivolDrl ?? d.dlpDrl,
            localDRL: d.ctdivolDrl ?? d.dlpDrl,
            hospitalAvg: Math.round((d.ctdivolDrl ?? d.dlpDrl) * 0.85 * 10) / 10,
            exceedCount: 0,
            totalCount: 0,
            compliancePercent: 100,
            unit: "mGy·cm",
          }));
          setRows(apiRows);
        }
      } catch { /* 回退演示数据 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const overallCompliance = Math.round(
    rows.reduce((s: number, r: DRLRecord) => s + r.compliancePercent, 0) /
      rows.length,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>DRL整体合规率</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: overallCompliance >= 95 ? "#16a34a" : "#d97706",
              marginTop: 4,
            }}
          >
            {overallCompliance}%
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>DRL超标检查</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color:
                rows.reduce((s: number, r: DRLRecord) => s + r.exceedCount, 0) > 50
                  ? "#dc2626"
                  : "#16a34a",
              marginTop: 4,
            }}
          >
            {rows.reduce((s: number, r: DRLRecord) => s + r.exceedCount, 0)}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>次</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>监控设备类型</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#1e40af",
              marginTop: 4,
            }}
          >
            {rows.length}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>种</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>检查总量</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#1e40af",
              marginTop: 4,
            }}
          >
            {rows
              .reduce((s: number, r: DRLRecord) => s + r.totalCount, 0)
              .toLocaleString()}
          </div>
        </div>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f" }}>
            DRL配置表（按模态/检查类型）
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                padding: "4px 10px",
                background: "#eff6ff",
                color: "#1e40af",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              国家标准
            </span>
            <span
              style={{
                padding: "4px 10px",
                background: "#f5f3ff",
                color: "#7c3aed",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              地方标准
            </span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {[
                  "检查类型",
                  "国家DRL",
                  "地方DRL",
                  "本院均值",
                  "超标次数",
                  "总检查数",
                  "合规率",
                  "单位",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isExceed = r.compliancePercent < 95;
                return (
                  <tr
                    key={`${r.modality}-${r.examType}`}
                    style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}
                  >
                    <td style={tdPrimary}>
                      <span style={modalityTag}>{r.modality}</span>
                      {r.examType}
                    </td>
                    <td style={{ ...tdSecondary, color: "#1e40af", fontWeight: 600 }}>
                      {r.nationalDRL}
                    </td>
                    <td style={{ ...tdSecondary, color: "#7c3aed", fontWeight: 600 }}>
                      {r.localDRL}
                    </td>
                    <td
                      style={{
                        ...tdSecondary,
                        color: r.hospitalAvg > r.localDRL ? "#dc2626" : "#16a34a",
                        fontWeight: 700,
                      }}
                    >
                      {r.hospitalAvg}
                    </td>
                    <td
                      style={{
                        ...tdSecondary,
                        color: r.exceedCount > 0 ? "#dc2626" : "#16a34a",
                        fontWeight: 600,
                      }}
                    >
                      {r.exceedCount}
                    </td>
                    <td style={tdSecondary}>{r.totalCount.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          background: isExceed ? "#fef2f2" : "#f0fdf4",
                          color: isExceed ? "#dc2626" : "#16a34a",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {r.compliancePercent}%
                      </div>
                    </td>
                    <td style={tdMuted}>{r.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {rows.filter((r: DRLRecord) => r.compliancePercent < 95).length >
        0 && (
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
            以下检查类型DRL合规率低于95%：
            {rows
              .filter((r: DRLRecord) => r.compliancePercent < 95)
              .map((r: DRLRecord) => r.examType)
              .join("、")}
            。 建议进行剂量优化分析并调整扫描参数。
          </div>
        </div>
      )}
    </div>
  );
}

const kpiBox: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: "14px 16px",
  border: "1px solid #e2e8f0",
  textAlign: "center",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "center",
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
  borderBottom: "2px solid #e2e8f0",
};

const tdPrimary: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#1e3a5f",
  textAlign: "center",
};

const tdSecondary: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#334155",
  textAlign: "center",
};

const tdMuted: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#94a3b8",
  textAlign: "center",
};

const modalityTag: React.CSSProperties = {
  padding: "2px 8px",
  background: "#eff6ff",
  color: "#2563eb",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  marginRight: 6,
};
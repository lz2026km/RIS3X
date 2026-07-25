import { useState } from "react";
import { FileText, CheckCircle } from "lucide-react";
import { dicomSRRecords } from "./mockData";

export default function DICOMSRParser() {
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  const handleImportSR = () => {
    setShowUploadSuccess(true);
    setTimeout(() => setShowUploadSuccess(false), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f" }}>
              DICOM SR RDSR 解析
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              导入结构化剂量报告并提取关键参数
            </div>
          </div>
          <button
            onClick={handleImportSR}
            style={{
              padding: "8px 16px",
              background: "#1e40af",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileText size={14} /> 导入DICOM SR
          </button>
        </div>
        {showUploadSuccess && (
          <div
            style={{
              padding: "10px 14px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              color: "#16a34a",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <CheckCircle size={14} /> DICOM SR导入成功，已解析{" "}
            {dicomSRRecords.length} 条剂量记录
          </div>
        )}
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
            fontSize: 13,
            fontWeight: 700,
            color: "#1e3a5f",
            marginBottom: 16,
          }}
        >
          RDSR 解析结果
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {[
                  "患者",
                  "检查日期",
                  "设备",
                  "检查项目",
                  "CTDIvol",
                  "DLP",
                  "总剂量",
                  "DRL参考值",
                  "DRL合规",
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
              {dicomSRRecords.map((r, i) => (
                <tr
                  key={r.id}
                  style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}
                >
                  <td style={cellPrimary}>{r.patientName}</td>
                  <td style={cellMuted}>{r.studyDate}</td>
                  <td style={cellSecondary}>{r.device}</td>
                  <td style={cellSecondary}>{r.examItem}</td>
                  <td style={cellBold}>{r.ctdivol || "-"}</td>
                  <td style={cellBold}>{r.dlp || "-"}</td>
                  <td style={cellSecondary}>
                    {r.totalDose} {r.doseUnit}
                  </td>
                  <td style={cellMuted}>{r.drlReference}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: r.drlCompliant ? "#f0fdf4" : "#fef2f2",
                        color: r.drlCompliant ? "#16a34a" : "#dc2626",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {r.drlCompliant ? "合格" : "超标"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const cellPrimary: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#1e3a5f",
  textAlign: "center",
};
const cellSecondary: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#334155",
  textAlign: "center",
};
const cellMuted: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#94a3b8",
  textAlign: "center",
};
const cellBold: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#1e3a5f",
  textAlign: "center",
};
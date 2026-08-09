import { useRef, useState } from "react";
import { FileText, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { dicomSRRecords } from "./mockData";
import type { DICOMSRRecord } from "./types";
import { rdsrApi, type RdsrResult } from "../../services/api/rdsrApi";

// [W3-C] 接 rdsrApi.parse (/rdsr/parse): 选择 DICOM JSON 文件 → 真实解析并追加结果; 表格基准数据仍为演示
export default function DICOMSRParser() {
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<RdsrResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const mapResult = (r: RdsrResult): DICOMSRRecord => ({
    id: r.id,
    patientName: r.patientName ?? '未知患者',
    patientId: r.patientId ?? '',
    studyDate: r.examDate,
    modality: r.modality,
    examItem: r.bodyPart,
    ctdivol: r.ctdivol,
    dlp: r.dlp,
    totalDose: r.dlp,
    doseUnit: 'mGy·cm',
    drlReference: 0,
    drlCompliant: r.alertLevel === 'normal',
    device: r.modality,
  });

  const handleImportSR = async (file: File) => {
    setUploadError(null);
    try {
      const text = await file.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text);
      } catch {
        setUploadError(`文件 ${file.name} 不是有效的 JSON (DICOM JSON 格式)`);
        return;
      }
      setParsing(true);
      const res = await rdsrApi.parse(json, undefined);
      if (res.success && res.data) {
        setParsed((prev) => [res.data, ...prev]);
        setShowUploadSuccess(true);
        setTimeout(() => setShowUploadSuccess(false), 3000);
      } else {
        setUploadError(res.error?.message ?? '解析失败');
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '解析失败');
    } finally {
      setParsing(false);
    }
  };

  const rows = [...parsed.map(mapResult), ...dicomSRRecords];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              DICOM SR RDSR 解析
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              导入 DICOM JSON 文件, 调用 /rdsr/parse 真实解析并提取关键参数
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.dcm,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportSR(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            style={{
              padding: "8px 16px",
              background: "#1e40af",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: parsing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {parsing ? <Loader2 size={14} /> : <FileText size={14} />} {parsing ? '解析中...' : '导入DICOM SR'}
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
            <CheckCircle size={14} /> DICOM SR解析成功，已提取 1 条剂量记录 (CTDIvol/DLP)
          </div>
        )}
        {uploadError && (
          <div
            style={{
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#dc2626",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {uploadError}
          </div>
        )}
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
          <AlertTriangle size={14} /> 演示数据：表格内既有记录为本地模拟；选择 DICOM JSON 文件可触发真实 /rdsr/parse 解析
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
            fontSize: 13,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 16,
          }}
        >
          RDSR 解析结果 {parsed.length > 0 ? `(新解析 ${parsed.length} 条)` : ''}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-primary)" }}>
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
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-primary)" }}
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
                  <td style={cellMuted}>{r.drlReference || "-"}</td>
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
  color: "#1e40af",
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
  color: "#1e40af",
  textAlign: "center",
};

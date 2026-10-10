import { useRef, useState } from "react";
import { FileText, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { dicomSRRecords } from "./mockData";
import type { DICOMSRRecord } from "./types";
import { rdsrApi, type RdsrResult } from "../../services/api/rdsrApi";
import { DataTable } from "../../components/common";
import { t } from "../../i18n/appI18n";

const pickNumber = (json: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = json[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  }
  return undefined;
};

// 本地兜底解析: 接口不可用时仅从 DICOM JSON 文件内读取 CTDIvol/DLP 等既有字段
const localParse = (json: Record<string, unknown>): RdsrResult => {
  const now = Date.now();
  const examDate = typeof json.StudyDate === "string" && json.StudyDate !== ""
    ? json.StudyDate
    : new Date(now).toISOString().slice(0, 10);
  return {
    id: `local-${now}`,
    studyInstanceUid: typeof json.StudyInstanceUID === "string" && json.StudyInstanceUID !== ""
      ? json.StudyInstanceUID
      : `1.2.840.local.${now}`,
    modality: typeof json.Modality === "string" && json.Modality !== "" ? json.Modality : "CT",
    bodyPart: typeof json.BodyPartExamined === "string" && json.BodyPartExamined !== "" ? json.BodyPartExamined : "胸部",
    ctdivol: pickNumber(json, ["CTDIvol", "ctdivol"]) ?? 0,
    dlp: pickNumber(json, ["DLP", "dlp", "TotalDose"]) ?? 0,
    totalExposure: 0,
    numberOfEvents: 0,
    examDate,
    alertLevel: "normal",
    patientId: typeof json.PatientID === "string" ? json.PatientID : null,
    patientName: typeof json.PatientName === "string" ? json.PatientName : "未知患者",
  };
};

// [W3-C] 接 rdsrApi.parse (/rdsr/parse): 选择 DICOM JSON 文件 → 真实解析并追加结果; 表格基准数据仍为演示
export default function DICOMSRParser() {
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<RdsrResult[]>([]);
  const [localFallback, setLocalFallback] = useState(false);
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
    setLocalFallback(false);
    let json: Record<string, unknown> = {};
    try {
      const text = await file.text();
      try {
        json = JSON.parse(text) as Record<string, unknown>;
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
        // 接口不可用/返回失败时回退本地解析, 保留离线可用性
        setParsed((prev) => [localParse(json), ...prev]);
        setLocalFallback(true);
        setShowUploadSuccess(true);
        setTimeout(() => setShowUploadSuccess(false), 3000);
      }
    } catch {
      setParsed((prev) => [localParse(json), ...prev]);
      setLocalFallback(true);
      setShowUploadSuccess(true);
      setTimeout(() => setShowUploadSuccess(false), 3000);
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
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)" }}>
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
              background: "var(--color-primary-800)",
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
              color: "var(--color-success-600)",
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
              color: "var(--color-error-600)",
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
        {localFallback && (
          <div
            style={{
              padding: "10px 14px",
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: 8,
              color: "var(--color-warning-600)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {t('w8Dose.dicomLocalParse')}
          </div>
        )}
        <div
          style={{
            padding: "8px 12px",
            background: "#fef3c7",
            color: "var(--color-warning-600)",
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
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-primary-800)",
            marginBottom: 16,
          }}
        >
          RDSR 解析结果 {parsed.length > 0 ? `(新解析 ${parsed.length} 条)` : ''}
        </div>
        <div style={{ overflowX: "auto" }}>
          <DataTable
            rowKey="id"
            dataSource={rows}
            showPagination={false}
            showExport={false}
            showDensity={false}
            columns={[
              { title: "患者", dataIndex: "patientName", key: "patientName", align: "center", render: (v: string) => <span style={{ fontWeight: 600, color: "var(--color-primary-800)" }}>{v}</span> },
              { title: "检查日期", dataIndex: "studyDate", key: "studyDate", align: "center", render: (v: string) => <span style={{ color: "#94a3b8" }}>{v}</span> },
              { title: "设备", dataIndex: "device", key: "device", align: "center", render: (v: string) => <span style={{ color: "#334155" }}>{v}</span> },
              { title: "检查项目", dataIndex: "examItem", key: "examItem", align: "center", render: (v: string) => <span style={{ color: "#334155" }}>{v}</span> },
              { title: "CTDIvol", dataIndex: "ctdivol", key: "ctdivol", align: "center", render: (v: number) => <span style={{ fontWeight: 700, color: "var(--color-primary-800)" }}>{v || "-"}</span> },
              { title: "DLP", dataIndex: "dlp", key: "dlp", align: "center", render: (v: number) => <span style={{ fontWeight: 700, color: "var(--color-primary-800)" }}>{v || "-"}</span> },
              { title: "总剂量", key: "totalDose", align: "center", render: (_: unknown, r: DICOMSRRecord) => <span style={{ color: "#334155" }}>{r.totalDose} {r.doseUnit}</span> },
              { title: "DRL参考值", dataIndex: "drlReference", key: "drlReference", align: "center", render: (v: number) => <span style={{ color: "#94a3b8" }}>{v || "-"}</span> },
              {
                title: "DRL合规", dataIndex: "drlCompliant", key: "drlCompliant", align: "center",
                render: (v: boolean) => (
                  <span
                    style={{
                      padding: "2px 8px",
                      background: v ? "#f0fdf4" : "#fef2f2",
                      color: v ? "var(--color-success-600)" : "var(--color-error-600)",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {v ? "合格" : "超标"}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

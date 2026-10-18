/**
 * G005 放射RIS系统 v3.0.6.5 - DICOM SR 集成 Service
 * v3.0.6.5: 增加 TID 1500 / 1501 / De-ID 桥接
 */

import type {
  DicomSrDocument,
  DicomSrTemplateId,
  DicomContentSequence,
  DicomContentItem,
  DicomDataElement,
  DicomVrType,
} from "../../types/R3/R3.INTEGRATION";
import {
  DICOM_SR_MOCK,
  DICOM_SR_DOCUMENTS_MOCK,
} from "../../data/reportIntegrationMock";
import type { TrackedLesion, DeIdentifyConfig } from "../../types/measurement";
import { generateTid1500 as generateTid1500Report } from "../measurement/export/DicomSrTid1500";
import {
  generateTid1501 as generateTid1501Report,
  type ProcedureLogEntry,
} from "../measurement/export/DicomSrTid1501";
import { applyDeIdentify as applyDeId, defaultDeIdConfig } from "./dicomDeId";
import {
  srDocumentApi,
  type SrDocument,
  type SrContentItem,
} from "../api/srReportApi";
import { dicomDimseApi } from "../api/dicomApi";

// [v3.0.6.16-7] SR 文档真实化: 读写走 /dicom-sr, C-STORE 走 /dicom-dimse/store

// ============================================================
// 1. DICOM 二进制数据集构造
// ============================================================
function encodeElement(
  tag: string,
  vr: DicomVrType,
  value: string | number | string[] | number[],
): {
  tag: string;
  vr: DicomVrType;
  value: string | number | string[] | number[];
  length: number;
} {
  const v = Array.isArray(value) ? value.join("\\") : value;
  return { tag, vr, value: v, length: String(v).length };
}

export function buildDicomSrDataset(input: {
  sopInstanceUID: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  contentSequence: DicomContentSequence[];
  patientName?: string;
  patientId?: string;
  patientBirthDate?: string;
  modality?: string;
}): DicomDataElement[] {
  const elements: DicomDataElement[] = [
    encodeElement("00080005", "CS", "ISO_IR 100") as DicomDataElement,
    {
      ...encodeElement("00080016", "UI", "1.2.840.10008.5.1.4.1.1.88.11"),
      name: "SOPClassUID",
      nameEn: "SOP Class UID",
    },
    {
      ...encodeElement("00080018", "UI", input.sopInstanceUID),
      name: "SOPInstanceUID",
      nameEn: "SOP Instance UID",
    },
    {
      ...encodeElement("00080020", "DA", "20260915"),
      name: "StudyDate",
      nameEn: "Study Date",
    },
    {
      ...encodeElement("00080030", "TM", "110000"),
      name: "StudyTime",
      nameEn: "Study Time",
    },
    {
      ...encodeElement(
        "00080050",
        "SH",
        `ACC${input.studyInstanceUID.slice(-10)}`,
      ),
      name: "AccessionNumber",
      nameEn: "Accession Number",
    },
    {
      ...encodeElement("00080060", "CS", input.modality ?? "SR"),
      name: "Modality",
      nameEn: "Modality",
    },
    {
      ...encodeElement("00080090", "PN", "王医师^"),
      name: "ReferringPhysicianName",
      nameEn: "Referring Physician",
    },
    {
      ...encodeElement("00100010", "PN", input.patientName ?? "张三^"),
      name: "PatientName",
      nameEn: "Patient Name",
    },
    {
      ...encodeElement("00100020", "LO", input.patientId ?? "p-038"),
      name: "PatientID",
      nameEn: "Patient ID",
    },
    {
      ...encodeElement("00100030", "DA", input.patientBirthDate ?? "19680101"),
      name: "PatientBirthDate",
      nameEn: "Patient Birth Date",
    },
    {
      ...encodeElement("00100040", "CS", "M"),
      name: "PatientSex",
      nameEn: "Patient Sex",
    },
    {
      ...encodeElement("0020000D", "UI", input.studyInstanceUID),
      name: "StudyInstanceUID",
      nameEn: "Study Instance UID",
    },
    {
      ...encodeElement("0020000E", "UI", input.seriesInstanceUID),
      name: "SeriesInstanceUID",
      nameEn: "Series Instance UID",
    },
    {
      ...encodeElement("00200013", "IS", 1),
      name: "InstanceNumber",
      nameEn: "Instance Number",
    },
    {
      ...encodeElement("0040A040", "CS", "VERIFIED"),
      name: "VerificationFlag",
      nameEn: "Verification Flag",
    },
    {
      ...encodeElement("0040A491", "CS", "COMPLETE"),
      name: "CompletionFlag",
      nameEn: "Completion Flag",
    },
    {
      ...encodeElement("0040A043", "SQ", []),
      name: "ConceptNameCodeSequence",
      nameEn: "Concept Name Code Sequence",
    },
    {
      ...encodeElement("0040A730", "SQ", []),
      name: "ContentSequence",
      nameEn: "Content Sequence",
    },
  ];
  return elements;
}

// ============================================================
// 2. SR 内容项构造
// ============================================================
export function buildContentItem(
  conceptCode: string,
  codeMeaning: string,
  codeMeaningEn: string,
  valueType: DicomContentItem["valueType"],
  payload: {
    text?: string;
    num?: number;
    unit?: string;
    code?: string;
    codeMeaning?: string;
  } = {},
): DicomContentItem {
  return {
    relationshipType: "CONTAINS",
    conceptCode: {
      code: conceptCode,
      codeSchemeDesignator: "DCM",
      codeMeaning,
      codeMeaningEn,
    },
    valueType,
    textValue: payload.text,
    numValue: payload.num,
    unitCode: payload.unit
      ? {
          code: payload.unit,
          codeSchemeDesignator: "UCUM",
          codeMeaning: payload.unit,
          codeMeaningEn: payload.unit,
        }
      : undefined,
    codeValue: payload.code
      ? {
          code: payload.code,
          codeSchemeDesignator: "DCM",
          codeMeaning: payload.codeMeaning ?? "",
          codeMeaningEn: payload.codeMeaning ?? "",
        }
      : undefined,
  };
}

// ============================================================
// 3. SR 文本格式输出
// ============================================================
export function dumpDicomSr(sr: DicomSrDocument): string {
  const head = `# DICOM SR Document
# DICOM Standard: PS 3.3-2024
# Transfer Syntax: ${sr.transferSyntaxUID}
# SOP Class UID: ${sr.sopClassUID}
# SOP Instance UID: ${sr.sopInstanceUID}
# Study Instance UID: ${sr.studyInstanceUID}
# Series Instance UID: ${sr.seriesInstanceUID}
# Instance Number: ${sr.instanceNumber}
# Template: ${sr.templateId}
# Completion: ${sr.completionFlag}
# Verification: ${sr.verificationFlag}
# Generated: ${sr.generatedAt} by ${sr.generator}
# Size: ${sr.size} bytes

# ===== Data Elements =====
`;
  const elements = sr.dataElements
    .map(
      (d) =>
        `(${d.tag}) ${d.vr} [${d.length}] ${d.name} (${d.nameEn}) = ${Array.isArray(d.value) ? d.value.join("\\") : d.value}`,
    )
    .join("\n");
  const content = sr.contentSequence
    .map(
      (seq) =>
        `\n# ===== Content Sequence: ${seq.conceptCode.codeMeaning} (${seq.conceptCode.codeMeaningEn}) =====\n${seq.items.map((it) => `  >> [${it.relationshipType}] ${it.valueType} | ${it.conceptCode.code} (${it.conceptCode.codeMeaning}) ${it.textValue ?? it.numValue ?? it.codeValue?.code ?? ""}`).join("\n")}`,
    )
    .join("\n");
  return `${head}${elements}${content}\n\n# ===== Referenced SOP Instances =====\n${sr.referencedInstances.map((r) => `  -- ${r.purpose}: ${r.sopInstanceUID}`).join("\n")}\n`;
}

// ============================================================
// 4. DICOM SR 验证
// ============================================================
export function validateDicomSr(sr: DicomSrDocument): {
  passed: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!sr.sopClassUID.startsWith("1.2.840.10008.5.1.4.1.1.88"))
    errors.push("SOP Class UID 不属于 SR 家族");
  if (!sr.sopInstanceUID) errors.push("缺少 SOP Instance UID");
  if (!sr.studyInstanceUID) errors.push("缺少 Study Instance UID");
  if (!sr.seriesInstanceUID) errors.push("缺少 Series Instance UID");
  if (sr.completionFlag === "PARTIAL") warnings.push("SR 标记为部分完成");
  if (sr.contentSequence.length === 0) errors.push("Content Sequence 为空");
  return { passed: errors.length === 0, errors, warnings };
}

// ============================================================
// 5. Service 接口 (真实后端 /dicom-sr)
// ============================================================
const SR_VALUE_TYPE_MAP: Record<string, DicomContentItem["valueType"]> = {
  TEXT: "TEXT",
  CODE: "CODE",
  NUM: "NUM",
  DATE: "DATE",
  UIDREF: "UIDREF",
};

function mapContentItem(it: SrContentItem): DicomContentItem {
  return {
    relationshipType: "CONTAINS",
    conceptCode: {
      code: it.conceptName?.code ?? "",
      codeSchemeDesignator: it.conceptName?.scheme ?? "DCM",
      codeMeaning: it.conceptName?.meaning ?? "",
      codeMeaningEn: it.conceptName?.meaning ?? "",
    },
    valueType: SR_VALUE_TYPE_MAP[it.valueType] ?? "TEXT",
    textValue:
      it.valueType === "TEXT" || it.valueType === "UIDREF"
        ? it.value
        : undefined,
    numValue:
      it.valueType === "NUM" && it.value != null && it.value !== ""
        ? Number(it.value)
        : undefined,
    codeValue:
      it.valueType === "CODE" && it.code
        ? {
            code: it.code.code,
            codeSchemeDesignator: it.code.scheme,
            codeMeaning: it.code.meaning,
            codeMeaningEn: it.code.meaning,
          }
        : undefined,
  };
}

function mapSrDocument(doc: SrDocument): DicomSrDocument {
  const contentSequence: DicomContentSequence[] = (
    doc.content?.sections ?? []
  ).map((sec) => ({
    conceptCode: {
      code: sec.conceptName?.code ?? "",
      codeSchemeDesignator: sec.conceptName?.scheme ?? "DCM",
      codeMeaning: sec.title || sec.conceptName?.meaning || "",
      codeMeaningEn: sec.title || sec.conceptName?.meaning || "",
    },
    continuity: "SEPARATE",
    items: (sec.items ?? []).map(mapContentItem),
  }));
  const dataElements = buildDicomSrDataset({
    sopInstanceUID: doc.sopInstanceUid,
    studyInstanceUID: doc.studyInstanceUid,
    seriesInstanceUID: doc.seriesInstanceUid,
    contentSequence,
    patientId: doc.patientId,
    patientName: doc.patientName,
    modality: doc.modality,
  });
  const templateId: DicomSrTemplateId =
    doc.templateId === "tid2000"
      ? "TID2000"
      : doc.templateId === "tid1500"
        ? "TID1500"
        : "TID2000";
  const sr: DicomSrDocument = {
    id: doc.id,
    sopClassUID: doc.sopClassUid,
    sopInstanceUID: doc.sopInstanceUid,
    studyInstanceUID: doc.studyInstanceUid,
    seriesInstanceUID: doc.seriesInstanceUid,
    instanceNumber: 1,
    templateId,
    completionFlag:
      doc.status === "finalized" || doc.status === "pushed"
        ? "COMPLETE"
        : "PARTIAL",
    verificationFlag: doc.status === "pushed" ? "VERIFIED" : "UNVERIFIED",
    contentSequence,
    dataElements,
    referencedInstances: [],
    transferSyntaxUID: "1.2.840.10008.1.2.1",
    mediaStorageSOPInstanceUID: doc.sopInstanceUid,
    generatedAt: doc.createdAt,
    generator: "G005-DICOM-SR-Builder",
    size: new Blob([doc.rawContent ?? ""]).size,
    validation: { passed: true, errors: [], warnings: [] },
    source: "live",
  };
  sr.validation = validateDicomSr(sr);
  return sr;
}

export async function listDicomSr(): Promise<DicomSrDocument[]> {
  try {
    const res = await srDocumentApi.listDocuments();
    if (!res.success) throw new Error(res.error?.message ?? "获取 SR 列表失败");
    const docs = Array.isArray(res.data) ? res.data : [];
    if (docs.length === 0) throw new Error("empty");
    return docs.map(mapSrDocument);
  } catch {
    return DICOM_SR_DOCUMENTS_MOCK.map((d) => ({
      ...d,
      source: "demo" as const,
    }));
  }
}

export async function getDicomSr(id: string): Promise<DicomSrDocument | null> {
  try {
    const res = await srDocumentApi.getDocument(id);
    if (!res.success || !res.data)
      throw new Error(res.error?.message ?? "获取 SR 失败");
    return mapSrDocument(res.data);
  } catch {
    const demo = DICOM_SR_DOCUMENTS_MOCK.find((s) => s.id === id) ?? null;
    return demo ? { ...demo, source: "demo" } : null;
  }
}

export async function generateDicomSr(input: {
  reportId: string;
  findings: string;
  impression: string;
  recommendation: string;
  patientId?: string;
  patientName?: string;
}): Promise<DicomSrDocument> {
  // [v3.0.6.16-7] 走真实后端生成 (TID 2000 / tid2000), 失败即失败, 不伪造本地成功
  const res = await srDocumentApi.generateByReport({
    reportId: input.reportId,
    templateId: "tid2000",
    findings: [
      input.findings,
      input.recommendation && `建议: ${input.recommendation}`,
    ]
      .filter(Boolean)
      .join("\n"),
    impression: input.impression,
  });
  if (!res.success || !res.data) {
    throw new Error(
      `生成 DICOM SR 失败: ${res.error?.message ?? "后端未返回文档"}`,
    );
  }
  return mapSrDocument(res.data);
}

export async function downloadDicomSr(
  id: string,
): Promise<{ filename: string; content: string; mime: string } | null> {
  const dl = await srDocumentApi.downloadDocument(id);
  if (dl) {
    const buf = new Uint8Array(await dl.blob.arrayBuffer());
    const isDicm =
      buf.length > 132 &&
      buf[128] === 0x44 &&
      buf[129] === 0x49 &&
      buf[130] === 0x43 &&
      buf[131] === 0x4d;
    if (isDicm) {
      return {
        filename: dl.filename.endsWith(".dcm") ? dl.filename : `${id}.dcm`,
        content: new TextDecoder("latin1").decode(buf),
        mime: "application/dicom",
      };
    }
    // 后端 /dicom-sr/:id/download 返回文本表示 (rawContent) -> 诚实标注 text/plain, 绝不冒充 DICOM
    const base = dl.filename.replace(/\.(dcm|sr)$/i, "");
    return {
      filename: `${base}.sr.txt`,
      content: new TextDecoder("utf-8").decode(buf),
      mime: "text/plain",
    };
  }
  const demo = DICOM_SR_DOCUMENTS_MOCK.find((s) => s.id === id);
  if (!demo) return null;
  return {
    filename: `${id}.sr.txt`,
    content: dumpDicomSr(demo),
    mime: "text/plain",
  };
}

export async function sendDicomSr(
  id: string,
  destination: { aeTitle: string; host: string; port: number },
): Promise<{
  success: boolean;
  status: "Success" | "Failure";
  statusCode: number;
  durationMs: number;
  error?: string;
}> {
  // [v3.0.6.16-7] 真实 C-STORE (POST /dicom-dimse/store), 失败不伪造 statusCode 0x0000
  const docRes = await srDocumentApi.getDocument(id);
  if (!docRes.success || !docRes.data) {
    return {
      success: false,
      status: "Failure",
      statusCode: 0xa700,
      durationMs: 0,
      error: docRes.error?.message ?? `SR 文档 ${id} 不存在`,
    };
  }
  const doc = docRes.data;
  const started = Date.now();
  const res = await dicomDimseApi.cStore({
    sopClassUid: doc.sopClassUid,
    sopInstanceUid: doc.sopInstanceUid,
    studyInstanceUid: doc.studyInstanceUid,
    seriesInstanceUid: doc.seriesInstanceUid,
    modality: doc.modality || "SR",
    patientId: doc.patientId,
    patientName: doc.patientName,
    calledAeTitle: destination.aeTitle,
  });
  const durationMs = Date.now() - started;
  if (!res.success) {
    return {
      success: false,
      status: "Failure",
      statusCode: 0xa700,
      durationMs,
      error: res.error?.message ?? "C-STORE 发送失败",
    };
  }
  const status = res.data?.status;
  const ok = status === undefined || status === "SUCCESS";
  return {
    success: ok,
    status: ok ? "Success" : "Failure",
    statusCode: ok ? 0x0000 : 0xa700,
    durationMs,
    error: ok ? undefined : res.data?.message,
  };
}

export const DICOM_SR_MOCK_REF = DICOM_SR_MOCK;

// ============================================================
// 6. TID 1500 - Imaging Measurement Report(v3.0.6.5)
// ============================================================
export interface GenerateTid1500Input {
  lesions: TrackedLesion[];
  patientId?: string;
  patientName?: string;
  patientBirthDate?: string;
  observer?: string;
  deIdentifyConfig?: DeIdentifyConfig;
}

export async function generateTid1500(
  input: GenerateTid1500Input,
): Promise<DicomSrDocument> {
  return generateTid1500Report(input);
}

// ============================================================
// 7. TID 1501 - Procedure Log(v3.0.6.5)
// ============================================================
export interface GenerateTid1501Input {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  entries: ProcedureLogEntry[];
  observer?: string;
  patientId?: string;
  patientName?: string;
}

export async function generateTid1501(
  input: GenerateTid1501Input,
): Promise<DicomSrDocument> {
  return generateTid1501Report(input);
}

// ============================================================
// 8. De-identification 桥接(v3.0.6.5)
// ============================================================
export function deIdentifyDataset(
  elements: DicomDataElement[],
  config: DeIdentifyConfig = defaultDeIdConfig,
): DicomDataElement[] {
  return applyDeId(elements, config);
}

export { defaultDeIdConfig };

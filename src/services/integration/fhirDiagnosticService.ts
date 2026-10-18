/**
 * G005 放射RIS系统 v3.0.5.1 - FHIR R4 DiagnosticReport Service
 */

import type {
  FhirDiagnosticReport,
  FhirAttachment,
  FhirAnnotation,
  FhirReference,
  FhirIdentifier,
  FhirCodeableConcept,
} from "../../types/R3/R3.INTEGRATION";
import {
  FHIR_DR_MOCK,
  FHIR_DR_DOCUMENTS_MOCK,
} from "../../data/reportIntegrationMock";
import { fhirApi } from "../api/fhirApi";

// [v3.0.6.16-8] 移除 100ms 伪延迟; 读走 fhirApi (真后端), 失败回退 demo 并标记 source

// ============================================================
// 1. FHIR R4 DiagnosticReport 构造器
// ============================================================
export function buildFhirDiagnosticReport(input: {
  id: string;
  status: FhirDiagnosticReport["status"];
  patientId: string;
  patientName: string;
  conclusion: string;
  modalityCode: string;
  modalityDisplay: string;
  loincCode: string;
  loincDisplay: string;
  performerId: string;
  performerName: string;
  effectiveDateTime: string;
  issuedAt: string;
  notes?: string;
}): FhirDiagnosticReport {
  const status = input.status;
  const code: FhirCodeableConcept = {
    coding: [
      {
        system: "http://loinc.org",
        code: input.loincCode,
        display: input.loincDisplay,
        displayEn: input.loincDisplay,
      },
    ],
    text: input.loincDisplay,
    textEn: input.loincDisplay,
  };
  const category: FhirCodeableConcept[] = [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v2-0074",
          code: input.modalityCode,
          display: "Radiology",
          displayEn: "Radiology",
        },
      ],
      text: "放射报告",
      textEn: "Radiology",
    },
  ];
  const identifier: FhirIdentifier[] = [
    {
      use: "official",
      system: "urn:oid:2.16.840.1.113883.4.1",
      value: `RP${input.id}`,
    },
  ];
  const subject: FhirReference = {
    reference: `Patient/${input.patientId}`,
    type: "Patient",
    display: input.patientName,
  };
  const performer: FhirReference[] = [
    {
      reference: `Practitioner/${input.performerId}`,
      type: "Practitioner",
      display: input.performerName,
    },
  ];
  const presentedForm: FhirAttachment[] = [
    {
      contentType: "application/pdf",
      url: `/api/v1/dist/fhir/dr/${input.id}.pdf`,
      size: 256000,
      title: "报告 PDF",
      creation: input.issuedAt,
    },
  ];
  const note: FhirAnnotation[] = input.notes
    ? [
        {
          authorString: input.performerName,
          time: input.issuedAt,
          text: input.notes,
        },
      ]
    : [];
  const dr: FhirDiagnosticReport = {
    resourceType: "DiagnosticReport",
    id: input.id,
    meta: {
      versionId: "1",
      lastUpdated: new Date().toISOString(),
      profile: ["http://hl7.org/fhir/StructureDefinition/DiagnosticReport"],
      tag: [],
    },
    identifier,
    basedOn: [],
    status,
    category,
    code,
    subject,
    encounter: { reference: `Encounter/enc-${input.id}`, type: "Encounter" },
    effectiveDateTime: input.effectiveDateTime,
    issued: input.issuedAt,
    performer,
    resultsInterpreter: performer,
    specimen: [],
    result: [],
    imagingStudy: [],
    media: [
      {
        comment: "Key image",
        link: { reference: `Media/m-${input.id}`, type: "Media" },
      },
    ],
    conclusion: input.conclusion,
    presentedForm,
    note,
    json: "",
    generatedAt: new Date().toISOString(),
    generator: "G005-FHIR-Builder",
    validation: { passed: true, errors: [], warnings: [] },
  };
  dr.json = JSON.stringify(dr, null, 2);
  return dr;
}

// ============================================================
// 2. FHIR Bundle 构造(transaction / collection)
// ============================================================
export function buildFhirBundle(
  resources: FhirDiagnosticReport[],
  type: "transaction" | "collection" = "collection",
): { resourceType: "Bundle"; type: string; entry: unknown[]; total: number } {
  return {
    resourceType: "Bundle",
    type,
    total: resources.length,
    entry: resources.map((r) => ({
      resource: r,
      fullUrl: `DiagnosticReport/${r.id}`,
    })),
  };
}

// ============================================================
// 3. FHIR 资源映射
// ============================================================
export function mapReportToFhir(report: {
  reportId: string;
  patientId: string;
  modality: string;
  bodyPart: string;
  findings: string;
  impression: string;
}): FhirDiagnosticReport {
  const loincMap: Record<string, { code: string; display: string }> = {
    CT: { code: "30746-2", display: "CT Chest" },
    MR: { code: "18748-4", display: "MR Brain" },
    DR: { code: "30746-2", display: "XR Chest" },
    MG: { code: "46372-6", display: "Mammography" },
  };
  const def = loincMap[report.modality] ?? {
    code: "18748-4",
    display: "Diagnostic imaging study",
  };
  return buildFhirDiagnosticReport({
    id: `fhir-${report.reportId}`,
    status: "final",
    patientId: report.patientId,
    patientName: "Patient",
    conclusion: report.impression,
    modalityCode: report.modality,
    modalityDisplay: "Radiology",
    loincCode: def.code,
    loincDisplay: def.display,
    performerId: "u-001",
    performerName: "陈医师",
    effectiveDateTime: new Date().toISOString(),
    issuedAt: new Date().toISOString(),
    notes: report.findings,
  });
}

// ============================================================
// 4. FHIR 验证
// ============================================================
export function validateFhir(dr: FhirDiagnosticReport): {
  passed: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (dr.resourceType !== "DiagnosticReport")
    errors.push("resourceType 必须为 DiagnosticReport");
  if (!dr.status) errors.push("缺少 status");
  if (!dr.code) errors.push("缺少 code");
  if (!dr.subject) errors.push("缺少 subject");
  if (!dr.effectiveDateTime && !dr.effectivePeriod)
    errors.push("缺少 effective[x]");
  if (dr.status === "final" && !dr.issued)
    warnings.push("final 状态建议设置 issued 时间");
  return { passed: errors.length === 0, errors, warnings };
}

// ============================================================
// 5. 后端 FHIR 资源 → 本地富模型
// ============================================================
type RawFhirResource = Record<string, unknown>;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** 将后端 /fhir/r4/DiagnosticReport 返回的裸资源规整为页面富模型 */
function normalizeFhirDr(
  raw: RawFhirResource,
  source: "demo" | "database",
): FhirDiagnosticReport {
  const code = asRecord(raw.code);
  const coding = Array.isArray(code.coding)
    ? (code.coding as RawFhirResource[])
    : [];
  const code0 = asRecord(coding[0]);
  const subject = asRecord(raw.subject);
  const patientRef =
    typeof subject.reference === "string" ? subject.reference : "";
  const performerList = Array.isArray(raw.performer)
    ? (raw.performer as RawFhirResource[])
    : [];
  const performer0 = asRecord(performerList[0]);
  const performerRef =
    typeof performer0.reference === "string"
      ? performer0.reference
      : "Practitioner/u-001";
  const status = String(
    raw.status ?? "final",
  ) as FhirDiagnosticReport["status"];
  const built = buildFhirDiagnosticReport({
    id: String(raw.id ?? `fhir-${Date.now()}`),
    status: [
      "registered",
      "partial",
      "preliminary",
      "final",
      "amended",
      "corrected",
      "appended",
      "cancelled",
      "entered-in-error",
      "unknown",
    ].includes(status)
      ? status
      : "final",
    patientId: patientRef.replace(/^Patient\//, "") || "unknown",
    patientName:
      typeof subject.display === "string" ? subject.display : "Patient",
    conclusion: typeof raw.conclusion === "string" ? raw.conclusion : "",
    modalityCode: String(code0.system ?? "RAD"),
    modalityDisplay: "Radiology",
    loincCode: String(code0.code ?? "18748-4"),
    loincDisplay:
      typeof code0.display === "string"
        ? code0.display
        : "Diagnostic imaging study",
    performerId: performerRef.replace(/^Practitioner\//, ""),
    performerName:
      typeof performer0.display === "string" ? performer0.display : "医师",
    effectiveDateTime:
      typeof raw.effectiveDateTime === "string"
        ? raw.effectiveDateTime
        : new Date().toISOString(),
    issuedAt:
      typeof raw.issued === "string" ? raw.issued : new Date().toISOString(),
  });
  built.source = source;
  return built;
}

function demoDr(id?: string): FhirDiagnosticReport | null {
  const found = id
    ? FHIR_DR_DOCUMENTS_MOCK.find((d) => d.id === id)
    : undefined;
  if (id && !found) return null;
  const list = id ? [found!] : FHIR_DR_DOCUMENTS_MOCK;
  return list.map((d) => ({ ...d, source: "demo" as const }))[0]!;
}

// ============================================================
// 6. Service 接口
// ============================================================
export async function listFhirDiagnosticReports(): Promise<
  FhirDiagnosticReport[]
> {
  const res = await fhirApi.searchDiagnosticReport({ _count: "50" });
  if (res.success && res.data) {
    const entries = Array.isArray(res.data.entry) ? res.data.entry : [];
    const docs = entries
      .map((e) => asRecord(e.resource))
      .filter((r) => r.resourceType === "DiagnosticReport");
    if (docs.length > 0) return docs.map((r) => normalizeFhirDr(r, "database"));
  }
  return FHIR_DR_DOCUMENTS_MOCK.map((d) => ({ ...d, source: "demo" as const }));
}

export async function getFhirDiagnosticReport(
  id: string,
): Promise<FhirDiagnosticReport | null> {
  const res = await fhirApi.readDiagnosticReport(id);
  if (
    res.success &&
    res.data &&
    (res.data as unknown as RawFhirResource).resourceType === "DiagnosticReport"
  ) {
    return normalizeFhirDr(res.data as unknown as RawFhirResource, "database");
  }
  return demoDr(id);
}

export async function generateFhirDr(input: {
  reportId: string;
  patientId: string;
  modality: string;
  bodyPart: string;
  findings: string;
  impression: string;
}): Promise<FhirDiagnosticReport> {
  const dr = mapReportToFhir(input);
  dr.id = `fhir-${input.reportId}-${Date.now()}`;
  dr.json = JSON.stringify(dr, null, 2);
  dr.validation = validateFhir(dr);
  return dr;
}

export async function downloadFhirDr(
  id: string,
): Promise<{ filename: string; content: string; mime: string } | null> {
  const dr = await getFhirDiagnosticReport(id);
  if (!dr) return null;
  return {
    filename: `${id}.json`,
    content: dr.json,
    mime: "application/fhir+json",
  };
}

/**
 * 推送到 FHIR 服务器: 通过统一 client POST 到应用 FHIR 端点, 回报真实结果;
 * 目标服务器地址随资源 extension 一并提交, 不再伪造 201。
 */
export async function sendFhirDr(
  id: string,
  fhirServerUrl: string,
): Promise<{
  success: boolean;
  statusCode: number;
  response: string;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const dr = await getFhirDiagnosticReport(id);
  if (!dr) {
    return {
      success: false,
      statusCode: 404,
      response: "DiagnosticReport 不存在",
      durationMs: Date.now() - startedAt,
    };
  }
  const resource: Record<string, unknown> = {
    resourceType: "DiagnosticReport",
    id: dr.id,
    status: dr.status,
    category: dr.category,
    code: dr.code,
    subject: dr.subject,
    effectiveDateTime: dr.effectiveDateTime,
    issued: dr.issued,
    performer: dr.performer,
    conclusion: dr.conclusion,
    presentedForm: dr.presentedForm,
    note: dr.note,
  };
  if (fhirServerUrl) {
    resource.extension = [
      { url: "http://g005.ris/fhir-server-url", valueString: fhirServerUrl },
    ];
  }
  const res = await fhirApi.createResource("DiagnosticReport", resource);
  const durationMs = Date.now() - startedAt;
  if (res.success) {
    return {
      success: true,
      statusCode: 201,
      response:
        typeof res.data === "object" && res.data
          ? JSON.stringify(res.data)
          : "Created",
      durationMs,
    };
  }
  const code = res.error?.code ?? "";
  const matched = /^HTTP_(\d{3})$/.exec(code);
  const statusCode = matched
    ? Number(matched[1])
    : code === "TIMEOUT" || code === "NETWORK_ERROR"
      ? 0
      : 400;
  return {
    success: false,
    statusCode,
    response: res.error?.message ?? "FHIR 推送失败",
    durationMs,
  };
}

export const FHIR_DR_MOCK_REF = FHIR_DR_MOCK;

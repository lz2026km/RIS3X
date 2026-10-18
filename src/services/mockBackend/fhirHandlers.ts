// [G005 P1] /api/v1/fhir/r4 MSW handlers — 与 backend fhir.controller.ts / smart-auth.controller.ts 对齐 (22 端点)
// 页面: /fhir/* (FhirPatientPage / FhirObservationPage / FhirDiagnosticReportPage / FhirImagingStudyPage / FhirSubscriptionPage)
//       /integration/fhir-bulk-export (FhirBulkExportPage)
// [G005 demo-data] 30 例真实演示队列: Patient ← PATIENT_MASTER, examId/reportId ← store.list('exams')
//   (空则回落 EXAM_REPORT_PRE / PATIENT_MASTER); Observation/DiagnosticReport/ImagingStudy
//   subject.reference = Patient/{id} 全部可解析; + 5 条 Subscription (webhook) + $export 任务历史
import { http, HttpResponse, delay } from "msw";
import { list, create, update, remove } from "./store";
import { v4 as uuidv4 } from "uuid";
import {
  PATIENT_MASTER,
  PATIENT_BY_ID,
  DOCTOR_MASTER,
  type PatientMaster,
} from "../../data/master";
import { EXAM_REPORT_PRE } from "../../data/_generators";

const API = "/api/v1/fhir/r4";

let delayTick = 0;
const delayMs = (min = 30, max = 120) =>
  min + ((delayTick++ * 37) % Math.max(1, max - min));

function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const COHORT_SIZE = 30;

const toFhirGender = (g: string): string =>
  g === "男" ? "male" : g === "女" ? "female" : "other";

function splitName(name: string): { family: string; given: string[] } {
  const family = name.slice(0, 1);
  const given = name.slice(1);
  return { family, given: given ? [given] : [] };
}

const MODALITY_SNOMED: Record<string, { code: string; display: string }> = {
  CT: { code: "408719007", display: "Computed tomography" },
  MR: { code: "77477000", display: "Magnetic resonance imaging" },
  DR: { code: "30717003", display: "Radiographic examination" },
  US: { code: "333621004", display: "Ultrasonography" },
  MG: { code: "241410002", display: "Mammography" },
  DSA: { code: "77343004", display: "Angiography" },
  "PET-CT": { code: "422035007", display: "PET-CT whole body" },
};

const dicomModality = (modality: string): string =>
  modality === "PET-CT" ? "PT" : modality;

const REPORT_STATUS_MAP: Record<string, string> = {
  draft: "registered",
  submitted: "preliminary",
  reviewed: "final",
  cosigned: "final",
  published: "final",
  已检查: "preliminary",
  报告生成: "preliminary",
  已审核: "final",
  已签发: "final",
  已发布: "final",
  已完成: "final",
};

interface VitalRecipe {
  code: string;
  display: string;
  unit: string;
  ucum: string;
  low: number;
  high: number;
  base: number;
  decimals: number;
  category: "laboratory" | "vital-signs";
}

const VITAL_RECIPES: VitalRecipe[] = [
  {
    code: "8480-6",
    display: "Systolic blood pressure",
    unit: "mmHg",
    ucum: "mm[Hg]",
    low: 90,
    high: 140,
    base: 122,
    decimals: 0,
    category: "vital-signs",
  },
  {
    code: "8867-4",
    display: "Heart rate",
    unit: "beats/min",
    ucum: "/min",
    low: 60,
    high: 100,
    base: 76,
    decimals: 0,
    category: "vital-signs",
  },
  {
    code: "8310-5",
    display: "Body temperature",
    unit: "Cel",
    ucum: "Cel",
    low: 36,
    high: 37.3,
    base: 36.6,
    decimals: 1,
    category: "vital-signs",
  },
  {
    code: "2339-0",
    display: "Glucose [Mass/volume] in Blood",
    unit: "mg/dL",
    ucum: "mg/dL",
    low: 70,
    high: 110,
    base: 93,
    decimals: 0,
    category: "laboratory",
  },
  {
    code: "718-7",
    display: "Hemoglobin [Mass/volume] in Blood",
    unit: "g/dL",
    ucum: "g/dL",
    low: 12,
    high: 16,
    base: 13.8,
    decimals: 1,
    category: "laboratory",
  },
  {
    code: "2160-0",
    display: "Creatinine [Mass/volume] in Serum or Plasma",
    unit: "mg/dL",
    ucum: "mg/dL",
    low: 0.6,
    high: 1.3,
    base: 0.9,
    decimals: 2,
    category: "laboratory",
  },
  {
    code: "29463-7",
    display: "Body weight",
    unit: "kg",
    ucum: "kg",
    low: 45,
    high: 90,
    base: 64,
    decimals: 1,
    category: "vital-signs",
  },
  {
    code: "8302-2",
    display: "Body height",
    unit: "cm",
    ucum: "cm",
    low: 150,
    high: 185,
    base: 168,
    decimals: 0,
    category: "vital-signs",
  },
];

interface SeedExamRef {
  examId: string;
  reportId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  examItem: string;
  examAt: string;
  reportAt: string;
  status: string;
  reportDoctorId: string;
  reviewDoctorId: string | null;
  accessionNumber: string | null;
}

function normalizeSeedExam(row: unknown): SeedExamRef | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const patientId = String(r.patientId ?? "");
  const patient = PATIENT_BY_ID[patientId];
  if (!patient) return null;
  const reportId = String(r.reportId ?? r.id ?? "");
  if (!reportId) return null;
  const modality = String(r.modality ?? "CT");
  return {
    examId: String(r.id ?? reportId),
    reportId,
    patientId,
    patientName: String(r.patientName ?? patient.name),
    modality,
    bodyPart: String(r.bodyPart ?? patient.bodyPart),
    examItem: String(r.examItem ?? r.examItemName ?? patient.examItem),
    examAt: String(r.examAt ?? ""),
    reportAt: String(r.reportAt ?? r.examAt ?? ""),
    status: String(r.status ?? "published"),
    reportDoctorId: String(r.reportDoctorId ?? r.technologistId ?? "D001"),
    reviewDoctorId: r.reviewDoctorId ? String(r.reviewDoctorId) : null,
    accessionNumber: r.accessionNumber ? String(r.accessionNumber) : null,
  };
}

function pickSeedExams(count: number): SeedExamRef[] {
  const out: SeedExamRef[] = [];
  const usedReports = new Set<string>();
  const usedPatients = new Set<string>();
  const push = (row: unknown): void => {
    const n = normalizeSeedExam(row);
    if (!n || usedReports.has(n.reportId) || usedPatients.has(n.patientId))
      return;
    usedReports.add(n.reportId);
    usedPatients.add(n.patientId);
    out.push(n);
  };
  let raw: unknown[] = [];
  try {
    raw = list<unknown>("exams");
  } catch {
    raw = [];
  }
  if (raw.length > 0) {
    const strideCount = Math.min(count, raw.length);
    const step = raw.length / strideCount;
    for (let i = 0; i < strideCount && out.length < count; i++)
      push(raw[Math.floor(i * step)]);
  }
  if (out.length < count) {
    for (const row of EXAM_REPORT_PRE) {
      if (out.length >= count) break;
      push(row);
    }
  }
  if (out.length < count) {
    PATIENT_MASTER.forEach((p, i) => {
      if (out.length >= count) return;
      if (usedPatients.has(p.id)) return;
      usedPatients.add(p.id);
      const seq = String(i + 1).padStart(5, "0");
      out.push({
        examId: `EXAM-FALLBACK-${seq}`,
        reportId: `RPT-FALLBACK-${seq}`,
        patientId: p.id,
        patientName: p.name,
        modality: p.modality,
        bodyPart: p.bodyPart,
        examItem: p.examItem,
        examAt: p.examDate,
        reportAt: p.examDate,
        status: "published",
        reportDoctorId: "D001",
        reviewDoctorId: "D002",
        accessionNumber: `ACC-FALLBACK-${seq}`,
      });
    });
  }
  return out;
}

interface FhirCohort {
  patients: any[];
  observations: any[];
  reports: any[];
  studies: any[];
}

function buildCohort(): FhirCohort {
  const rng = makeRng(0x46484952);
  const exams = pickSeedExams(COHORT_SIZE);
  const patients: any[] = [];
  const observations: any[] = [];
  const reports: any[] = [];
  const studies: any[] = [];

  exams.forEach((exam, i) => {
    const fallback: PatientMaster | undefined =
      PATIENT_MASTER[i % PATIENT_MASTER.length];
    const p: PatientMaster = PATIENT_BY_ID[exam.patientId] ?? fallback!;
    const { family, given } = splitName(p.name);
    const ref = `Patient/${p.id}`;

    patients.push({
      resourceType: "Patient",
      id: p.id,
      active: true,
      identifier: [
        {
          use: "usual",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                code: "MR",
                display: "Medical record number",
              },
            ],
          },
          system: "http://ris.local/mrn",
          value: p.id,
        },
        {
          use: "official",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                code: "SS",
                display: "Social Security Number",
              },
            ],
          },
          system: "urn:oid:1.2.36.146.595.217.0.1",
          value: p.idCard,
        },
      ],
      name: [{ use: "official", family, given }],
      gender: toFhirGender(p.gender),
      birthDate: p.birthDate,
      telecom: p.phone
        ? [{ system: "phone", value: p.phone, use: "mobile" }]
        : [],
      ...(p.deceased ? { deceasedBoolean: true } : {}),
      meta: { lastUpdated: p.registeredAt },
    });

    const recipe = VITAL_RECIPES[i % VITAL_RECIPES.length]!;
    let value = Number(
      (recipe.base * (0.88 + rng() * 0.24)).toFixed(recipe.decimals),
    );
    let interp = "N";
    const roll = rng();
    if (roll < 0.1) {
      value = Number(
        (recipe.high * (1.05 + rng() * 0.15)).toFixed(recipe.decimals),
      );
      interp = "H";
    } else if (roll < 0.18) {
      value = Number(
        (recipe.low * (0.78 + rng() * 0.12)).toFixed(recipe.decimals),
      );
      interp = "L";
    }
    const obsId = `OBS-${exam.reportId}`;
    observations.push({
      resourceType: "Observation",
      id: obsId,
      status: "final",
      category: [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/observation-category",
              code: recipe.category,
              display:
                recipe.category === "laboratory" ? "Laboratory" : "Vital Signs",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: recipe.code,
            display: recipe.display,
          },
        ],
        text: recipe.display,
      },
      subject: { reference: ref, display: p.name },
      ...(exam.examAt ? { effectiveDateTime: exam.examAt } : {}),
      ...(exam.reportAt ? { issued: exam.reportAt } : {}),
      valueQuantity: {
        value,
        unit: recipe.unit,
        system: "http://unitsofmeasure.org",
        code: recipe.ucum,
      },
      interpretation: [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: interp,
              display:
                interp === "N" ? "Normal" : interp === "H" ? "High" : "Low",
            },
          ],
        },
      ],
      referenceRange: [
        {
          low: { value: recipe.low, unit: recipe.unit },
          high: { value: recipe.high, unit: recipe.unit },
          type: { text: "正常参考范围" },
        },
      ],
      performer: [{ reference: `Practitioner/${exam.reportDoctorId}` }],
    });

    const snomed = MODALITY_SNOMED[exam.modality] ?? MODALITY_SNOMED.CT!;
    reports.push({
      resourceType: "DiagnosticReport",
      id: exam.reportId,
      status: REPORT_STATUS_MAP[exam.status] ?? "final",
      category: [
        {
          coding: [
            {
              system: "http://dicom.nema.org/resources/ontology/DCM",
              code: dicomModality(exam.modality),
              display: exam.modality,
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: snomed.code,
            display: snomed.display,
          },
        ],
        text: `${exam.modality} ${exam.bodyPart}`,
      },
      subject: { reference: ref, display: p.name },
      ...(exam.examAt ? { effectiveDateTime: exam.examAt } : {}),
      ...(exam.reportAt ? { issued: exam.reportAt } : {}),
      performer: [{ reference: `Practitioner/${exam.reportDoctorId}` }],
      ...(exam.reviewDoctorId
        ? {
            resultsInterpreter: [
              { reference: `Practitioner/${exam.reviewDoctorId}` },
            ],
          }
        : {}),
      result: [{ reference: `Observation/${obsId}` }],
      imagingStudy: [{ reference: `ImagingStudy/${exam.examId}` }],
    });

    const seriesCount = exam.modality === "PET-CT" ? 2 : 1;
    const series = Array.from({ length: seriesCount }, (_, s) => ({
      uid: `1.2.826.0.1.3680043.8.498.${fnv1a32(`${exam.examId}#${s}`)}.${s + 1}`,
      number: s + 1,
      modality: {
        coding: [
          {
            system: "http://dicom.nema.org/resources/ontology/DCM",
            code: dicomModality(exam.modality),
          },
        ],
      },
      description: `${exam.modality} ${exam.bodyPart}`,
      numberOfInstances: 40 + Math.floor(rng() * 260),
      bodySite: { text: exam.bodyPart },
    }));
    studies.push({
      resourceType: "ImagingStudy",
      id: exam.examId,
      identifier: [
        {
          system: "http://ris.local/accession",
          value: exam.accessionNumber ?? exam.reportId,
        },
        { system: "http://ris.local/report", value: exam.reportId },
      ],
      status: "available",
      subject: { reference: ref, display: p.name },
      ...(exam.examAt ? { started: exam.examAt } : {}),
      numberOfSeries: seriesCount,
      numberOfInstances: series.reduce(
        (sum, ser) => sum + ser.numberOfInstances,
        0,
      ),
      procedureCode: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: snomed.code,
              display: snomed.display,
            },
          ],
          text: exam.examItem,
        },
      ],
      series,
    });
  });

  return { patients, observations, reports, studies };
}

let cohortSeeded = false;

function seedCollection(key: string, items: any[]): void {
  try {
    if (list<any>(key as any).length === 0) {
      for (const item of items) create(key as any, { ...item });
    }
  } catch {}
}

function ensureCohortSeeded(): void {
  if (cohortSeeded) return;
  cohortSeeded = true;
  const cohort = buildCohort();
  seedCollection("fhirPatients", cohort.patients);
  seedCollection("fhirObservations", cohort.observations);
  seedCollection("fhirReports", cohort.reports);
  seedCollection("fhirStudies", cohort.studies);
}

// ── Subscription 种子 (5 条: webhook 端点 + 状态配比) ──
const SEED_SUBSCRIPTIONS: any[] = [
  {
    resourceType: "Subscription",
    id: "SUB-001",
    status: "active",
    reason: "监控新签发报告并推送外部 EMR",
    criteria: "DiagnosticReport?status=final",
    channel: {
      type: "rest-hook",
      endpoint: "https://webhook.example.com/ris/fhir/reports",
      payload: "id-only",
    },
    meta: { lastUpdated: "2026-08-01T08:00:00Z" },
  },
  {
    resourceType: "Subscription",
    id: "SUB-002",
    status: "active",
    reason: "实验室危急值全量资源推送",
    criteria: "Observation?category=laboratory",
    channel: {
      type: "rest-hook",
      endpoint: "https://webhook.example.com/ris/fhir/observations",
      payload: "full-resource",
    },
    meta: { lastUpdated: "2026-08-01T08:05:00Z" },
  },
  {
    resourceType: "Subscription",
    id: "SUB-003",
    status: "inactive",
    reason: "患者主索引变更同步 (停用维护中)",
    criteria: "Patient?identifier=http://ris.local/mrn",
    channel: {
      type: "rest-hook",
      endpoint: "https://webhook.example.com/ris/fhir/patients",
      payload: "id-only",
    },
    meta: { lastUpdated: "2026-07-15T02:00:00Z" },
  },
  {
    resourceType: "Subscription",
    id: "SUB-004",
    status: "error",
    reason: "PACS 影像检查完成通知 (对端 503)",
    criteria: "ImagingStudy?modality=CT",
    channel: {
      type: "rest-hook",
      endpoint: "https://pacs.example.com/fhir/hooks/studies",
      payload: "id-only",
    },
    meta: { lastUpdated: "2026-07-28T11:20:00Z" },
  },
  {
    resourceType: "Subscription",
    id: "SUB-005",
    status: "active",
    reason: "区域平台放射报告上报",
    criteria: "DiagnosticReport?category=RAD",
    channel: {
      type: "rest-hook",
      endpoint: "https://region.example.com/fhir/hooks/reports",
      payload: "full-resource",
    },
    meta: { lastUpdated: "2026-08-02T09:30:00Z" },
  },
];

const SEED_PRACTITIONERS: any[] = DOCTOR_MASTER.slice(0, 12).map((d) => {
  const { family, given } = splitName(d.name);
  return {
    resourceType: "Practitioner",
    id: d.id,
    active: d.active,
    name: [{ use: "official", family, given }],
    qualification: [{ code: { text: d.title } }],
  };
});

// ── $export 任务历史 (4 条种子: 2 completed / 1 failed / 1 running) ──
interface ExportJobRecord {
  jobId: string;
  status: "running" | "completed" | "failed";
  requestTime: string;
  transactionTime?: string;
  output?: Array<{ type: string; url: string; count: number }>;
  error?: string;
}

const staticExportOutput = (): Array<{
  type: string;
  url: string;
  count: number;
}> => [
  { type: "Patient", url: `${API}/Patient`, count: COHORT_SIZE },
  { type: "Observation", url: `${API}/Observation`, count: COHORT_SIZE },
  {
    type: "DiagnosticReport",
    url: `${API}/DiagnosticReport`,
    count: COHORT_SIZE,
  },
  { type: "ImagingStudy", url: `${API}/ImagingStudy`, count: COHORT_SIZE },
  {
    type: "Subscription",
    url: `${API}/Subscription`,
    count: SEED_SUBSCRIPTIONS.length,
  },
];

const EXPORT_JOBS: ExportJobRecord[] = [
  {
    jobId: "bulk-2026-001",
    status: "completed",
    requestTime: "2026-08-01T10:00:00Z",
    transactionTime: "2026-08-01T10:01:12Z",
    output: staticExportOutput(),
  },
  {
    jobId: "bulk-2026-002",
    status: "completed",
    requestTime: "2026-08-01T14:30:00Z",
    transactionTime: "2026-08-01T14:31:05Z",
    output: staticExportOutput(),
  },
  {
    jobId: "bulk-2026-003",
    status: "failed",
    requestTime: "2026-08-01T18:45:00Z",
    transactionTime: "2026-08-01T18:47:30Z",
    error: "源系统超时 (504), 导出任务终止",
  },
  {
    jobId: "bulk-2026-004",
    status: "running",
    requestTime: "2026-08-02T09:00:00Z",
  },
];
let exportSeq = 5;

function liveExportOutput(): Array<{
  type: string;
  url: string;
  count: number;
}> {
  const countOf = (key: string): number => {
    try {
      return list<any>(key as any).length;
    } catch {
      return 0;
    }
  };
  return [
    { type: "Patient", url: `${API}/Patient`, count: countOf("fhirPatients") },
    {
      type: "Observation",
      url: `${API}/Observation`,
      count: countOf("fhirObservations"),
    },
    {
      type: "DiagnosticReport",
      url: `${API}/DiagnosticReport`,
      count: countOf("fhirReports"),
    },
    {
      type: "ImagingStudy",
      url: `${API}/ImagingStudy`,
      count: countOf("fhirStudies"),
    },
    {
      type: "Subscription",
      url: `${API}/Subscription`,
      count: countOf("fhirSubscriptions"),
    },
  ];
}

// [W2-B-3] 兼容 /integration/fhir-server 页面直调 (FhirServerPage 用 raw fetch 调
//   /api/v1/fhir/{Patient|Observation|DiagnosticReport|Practitioner|ImagingStudy|Bundle})
//   后端真实路径为 /fhir/r4/*, 此处为 demo 模式下的无 /r4 前缀兜底。
const API_NO_R4 = "/api/v1/fhir";

function genericResourceItems(type: string): any[] {
  if (type === "Practitioner") return SEED_PRACTITIONERS;
  if (type === "Bundle") return [];
  ensureCohortSeeded();
  const colMap: Record<string, string> = {
    Patient: "fhirPatients",
    Observation: "fhirObservations",
    DiagnosticReport: "fhirReports",
    ImagingStudy: "fhirStudies",
  };
  const col = colMap[type];
  if (!col) return [];
  try {
    return list<any>(col as any);
  } catch {
    return [];
  }
}

const bundle = (entries: any[]) => ({
  resourceType: "Bundle",
  type: "searchset",
  total: entries.length,
  entry: entries.map((e) => ({
    resource: e,
    fullUrl: `${API}/${e.resourceType}/${e.id}`,
  })),
});

/** [v3.0.6.16-0] 后端 fhir.controller.ts 真实支持的资源类型 (不多报一个) */
const SUPPORTED_TYPES = [
  "Patient",
  "Observation",
  "DiagnosticReport",
  "ImagingStudy",
  "Subscription",
  "Bundle",
];

/** 与后端 fhir-capability.service.ts 同源的演示态 CapabilityStatement (含诚实的能力缺口) */
function capabilityStatement() {
  const resource = [
    {
      type: "Patient",
      interaction: [
        { code: "read" },
        { code: "search-type" },
        { code: "vread" },
        { code: "create" },
        { code: "update" },
        { code: "delete" },
      ],
    },
    {
      type: "Observation",
      interaction: [
        { code: "read" },
        { code: "search-type" },
        { code: "vread" },
      ],
    },
    {
      type: "DiagnosticReport",
      interaction: [
        { code: "read" },
        { code: "search-type" },
        { code: "vread" },
      ],
    },
    {
      type: "ImagingStudy",
      interaction: [
        { code: "read" },
        { code: "search-type" },
        { code: "vread" },
      ],
    },
    {
      type: "Subscription",
      interaction: [
        { code: "read" },
        { code: "search-type" },
        { code: "vread" },
        { code: "create" },
        { code: "delete" },
      ],
    },
    { type: "Bundle", interaction: [{ code: "read" }] },
  ];
  const interaction = Array.from(
    new Set(resource.flatMap((r) => r.interaction.map((i: any) => i.code))),
  ).map((code) => ({ code }));
  return {
    resourceType: "CapabilityStatement",
    id: "g005-ris-fhir-r4",
    status: "active",
    date: new Date().toISOString(),
    publisher: "G005 Radiology RIS",
    kind: "instance",
    fhirVersion: "4.0.1",
    format: ["application/fhir+json", "json"],
    rest: [
      {
        mode: "server",
        security: {
          cors: true,
          service: [
            {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/restful-security-service",
                  code: "SMART on FHIR",
                },
              ],
            },
          ],
        },
        resource,
        interaction,
      },
    ],
    supportedResourceTypes: SUPPORTED_TYPES,
    gaps: [
      { code: "transaction", reason: "批量事务未实现" },
      { code: "batch", reason: "批量事务未实现" },
      { code: "conditional-create", reason: "条件创建未实现" },
      { code: "conditional-update", reason: "条件更新未实现" },
      { code: "conditional-delete", reason: "条件删除未实现" },
      { code: "patch", reason: "PATCH 未实现" },
      {
        code: "Practitioner 资源",
        reason: "未实现 (前端资源类型下拉中不应出现该选项)",
      },
      {
        code: "Bundle 写事务",
        reason: "仅支持只读 Bundle, 不支持 transaction/batch 写入",
      },
    ],
  };
}

const ensureSeeded = (key: string, seed: any[]) => {
  try {
    const existing = list<any>(key as any);
    if (!existing.length) {
      for (const item of seed) create(key as any, { ...item });
    }
  } catch {}
};

const urlParams = (request: Request) => new URL(request.url).searchParams;

export const fhirHandlers = [
  // ── Patient ──
  http.get(`${API}/Patient/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const found = list<any>("fhirPatients" as any).find(
      (p) => p.id === params.id,
    );
    if (!found)
      return HttpResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/Patient`, async ({ request }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const sp = urlParams(request);
    const name = sp.get("name")?.toLowerCase();
    const identifier = sp.get("identifier");
    let items = list<any>("fhirPatients" as any);
    if (name)
      items = items.filter((p) =>
        JSON.stringify(p.name).toLowerCase().includes(name),
      );
    if (identifier)
      items = items.filter((p) =>
        p.identifier?.some((i: any) => String(i.value).includes(identifier)),
      );
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  http.post(`${API}/Patient`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const resource = { resourceType: "Patient", id: uuidv4(), ...body };
    try {
      create("fhirPatients" as any, resource);
    } catch {}
    return HttpResponse.json(
      { success: true, data: resource },
      { status: 201 },
    );
  }),

  http.put(`${API}/Patient/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const existing = list<any>("fhirPatients" as any).find(
      (p) => p.id === params.id,
    ) ?? { id: params.id, resourceType: "Patient" };
    const updated = { ...existing, ...body, id: params.id };
    try {
      update("fhirPatients" as any, params.id as string, updated);
    } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.delete(`${API}/Patient/:id`, async ({ params }) => {
    await delay(delayMs());
    try {
      remove("fhirPatients" as any, params.id as string);
    } catch {}
    return HttpResponse.json({
      success: true,
      data: {
        resourceType: "OperationOutcome",
        issue: [{ severity: "information", code: "deleted" }],
      },
    });
  }),

  http.get(`${API}/Patient/:id/$everything`, async ({ params }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const patient = list<any>("fhirPatients" as any).find(
      (p) => p.id === params.id,
    );
    if (!patient)
      return HttpResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    const related = [
      ...list<any>("fhirObservations" as any).filter(
        (o) => o.subject?.reference === `Patient/${params.id}`,
      ),
      ...list<any>("fhirReports" as any).filter(
        (r) => r.subject?.reference === `Patient/${params.id}`,
      ),
      ...list<any>("fhirStudies" as any).filter(
        (s) => s.subject?.reference === `Patient/${params.id}`,
      ),
    ];
    return HttpResponse.json({
      success: true,
      data: bundle([patient, ...related]),
    });
  }),

  // ── Observation ──
  http.get(`${API}/Observation/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const found = list<any>("fhirObservations" as any).find(
      (o) => o.id === params.id,
    );
    if (!found)
      return HttpResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/Observation`, async ({ request }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const patient = urlParams(request).get("patient");
    let items = list<any>("fhirObservations" as any);
    if (patient)
      items = items.filter(
        (o) => o.subject?.reference === `Patient/${patient}`,
      );
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  // ── DiagnosticReport ──
  http.get(`${API}/DiagnosticReport/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const found = list<any>("fhirReports" as any).find(
      (r) => r.id === params.id,
    );
    if (!found)
      return HttpResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/DiagnosticReport`, async ({ request }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const sp = urlParams(request);
    const patient = sp.get("patient");
    const status = sp.get("status");
    let items = list<any>("fhirReports" as any);
    if (patient)
      items = items.filter(
        (r) => r.subject?.reference === `Patient/${patient}`,
      );
    if (status) items = items.filter((r) => r.status === status);
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  // ── ImagingStudy ──
  http.get(`${API}/ImagingStudy/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const found = list<any>("fhirStudies" as any).find(
      (s) => s.id === params.id,
    );
    if (!found)
      return HttpResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/ImagingStudy`, async ({ request }) => {
    await delay(delayMs());
    ensureCohortSeeded();
    const sp = urlParams(request);
    const patient = sp.get("patient");
    const modality = sp.get("modality");
    let items = list<any>("fhirStudies" as any);
    if (patient)
      items = items.filter(
        (s) => s.subject?.reference === `Patient/${patient}`,
      );
    if (modality)
      items = items.filter((s) =>
        s.series?.some(
          (ser: any) => ser.modality?.coding?.[0]?.code === modality,
        ),
      );
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  // ── Subscription ──
  http.post(`${API}/Subscription`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const resource = { resourceType: "Subscription", id: uuidv4(), ...body };
    try {
      create("fhirSubscriptions" as any, resource);
    } catch {}
    return HttpResponse.json(
      { success: true, data: resource },
      { status: 201 },
    );
  }),

  http.get(`${API}/Subscription/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded("fhirSubscriptions", SEED_SUBSCRIPTIONS);
    const found = list<any>("fhirSubscriptions" as any).find(
      (s) => s.id === params.id,
    );
    if (!found)
      return HttpResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    return HttpResponse.json({ success: true, data: found });
  }),

  // 页面期望裸数组 (FhirSubscriptionPage: Array.isArray(res.data))
  http.get(`${API}/Subscription`, async () => {
    await delay(delayMs());
    ensureSeeded("fhirSubscriptions", SEED_SUBSCRIPTIONS);
    return HttpResponse.json({
      success: true,
      data: list<any>("fhirSubscriptions" as any),
    });
  }),

  http.delete(`${API}/Subscription/:id`, async ({ params }) => {
    await delay(delayMs());
    try {
      remove("fhirSubscriptions" as any, params.id as string);
    } catch {}
    return HttpResponse.json({
      success: true,
      data: {
        resourceType: "OperationOutcome",
        issue: [{ severity: "information", code: "deleted" }],
      },
    });
  }),

  // ── 通用资源创建 (POST /fhir/r4/{type}) —— fhirApi.createResource / 报告推送到 FHIR 端点 ──
  // 必须排在 Patient/Subscription 之后, 否则会吞掉既有字面量路由。
  http.post(`${API}/:type`, async ({ params, request }) => {
    await delay(delayMs());
    const type = String(params.type ?? "Patient");
    if (!SUPPORTED_TYPES.includes(type)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: "NOT_SUPPORTED",
            message: `${type} create not supported`,
          },
        },
        { status: 400 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const resource = { resourceType: type, id: uuidv4(), ...body };
    return HttpResponse.json(
      { success: true, data: resource },
      { status: 201 },
    );
  }),

  // ── Bulk Export ($export / $export-status / $export-jobs) ──
  http.get(`${API}/$export`, async () => {
    await delay(delayMs(60, 150));
    ensureCohortSeeded();
    const jobId = `bulk-2026-${String(exportSeq++).padStart(3, "0")}`;
    EXPORT_JOBS.push({
      jobId,
      status: "running",
      requestTime: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: { jobId } });
  }),

  http.get(`${API}/$export-status/:jobId`, async ({ params }) => {
    await delay(delayMs(60, 150));
    ensureCohortSeeded();
    const job = EXPORT_JOBS.find((j) => j.jobId === params.jobId);
    if (job) {
      if (job.status === "running") {
        job.status = "completed";
        job.transactionTime = new Date().toISOString();
        job.output = liveExportOutput();
      }
      return HttpResponse.json({ success: true, data: job });
    }
    return HttpResponse.json({
      success: true,
      data: {
        status: "completed",
        transactionTime: new Date().toISOString(),
        output: liveExportOutput(),
      },
    });
  }),

  http.get(`${API}/$export-jobs`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: EXPORT_JOBS });
  }),

  // ── SMART on FHIR ──
  http.get(`${API}/.well-known/smart-configuration`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        authorization_endpoint: `${API}/auth/authorize`,
        token_endpoint: `${API}/auth/token`,
        capabilities: [
          "launch-standalone",
          "client-public",
          "context-standalone-patient",
        ],
      },
    });
  }),

  http.get(`${API}/auth/authorize`, async ({ request }) => {
    await delay(delayMs());
    const sp = urlParams(request);
    return HttpResponse.json({
      success: true,
      data: {
        redirectUrl: `${sp.get("redirect_uri") ?? "https://app.local/callback"}?code=mock-auth-code&state=${sp.get("state") ?? ""}`,
      },
    });
  }),

  http.post(`${API}/auth/token`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: {
        access_token: `mock-${uuidv4().replace(/-/g, "")}`,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid fhirUser patient/*.read",
        patient: body?.patient ?? "P000001",
        need_patient_banner: true,
      },
    });
  }),

  // [G005 W2] SMART 授权流程: introspect 校验 / revoke 吊销
  http.post(`${API}/auth/introspect`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const token = String(body?.token ?? "");
    if (!token) {
      return HttpResponse.json({ success: true, data: { active: false } });
    }
    return HttpResponse.json({
      success: true,
      data: {
        active: true,
        scope: "openid fhirUser patient/*.read",
        sub: token.startsWith("mock-") ? "anonymous" : "anonymous",
        exp: Math.floor(Date.now() / 1000) + 3600,
        token_type: "Bearer",
      },
    });
  }),

  http.post(`${API}/auth/revoke`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { success: true } });
  }),

  // [v3.0.6.16-0] 无 /r4 前缀的 CapabilityStatement —— 必须注册在 `${API_NO_R4}/:type`
  // 之前, 否则会被通配路由当成"名为 metadata 的资源类型"吞掉。
  http.get(`${API_NO_R4}/metadata`, async () => {
    await delay(delayMs());
    return HttpResponse.json(capabilityStatement());
  }),

  // [W2-B-3] 无 /r4 前缀的资源浏览 (FhirServerPage raw fetch, 直接返回 Bundle 本体)
  http.get(`${API_NO_R4}/:type`, async ({ params, request }) => {
    await delay(delayMs());
    const type = String(params.type ?? "Patient");
    // 未实现的资源类型返回空 Bundle, 而不是编造数据
    if (!SUPPORTED_TYPES.includes(type)) {
      return HttpResponse.json(bundle([]));
    }
    const items = genericResourceItems(type);
    const sp = urlParams(request);
    const name = sp.get("name")?.toLowerCase();
    let result = items;
    if (name)
      result = items.filter((r) =>
        JSON.stringify(r).toLowerCase().includes(name),
      );
    return HttpResponse.json(bundle(result));
  }),
  http.post(`${API_NO_R4}/:type`, async ({ params, request }) => {
    await delay(delayMs());
    const type = String(params.type ?? "Patient");
    // 仅 Patient 支持创建 (与后端 fhir.controller.ts 一致)
    if (type !== "Patient") {
      return HttpResponse.json(
        {
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-supported",
              details: { text: `${type} create not supported` },
            },
          ],
        },
        { status: 400 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as any;
    const resource = { resourceType: type, id: uuidv4(), ...body };
    return HttpResponse.json(resource, { status: 201 });
  }),
];

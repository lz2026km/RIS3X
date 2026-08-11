// [G005 P1] /api/v1/fhir/r4 MSW handlers — 与 backend fhir.controller.ts / smart-auth.controller.ts 对齐 (21 端点)
// 页面: /fhir/* (FhirPatientPage / FhirObservationPage / FhirDiagnosticReportPage / FhirImagingStudyPage / FhirSubscriptionPage)
//       /integration/fhir-bulk-export (FhirBulkExportPage)
import { http, HttpResponse, delay } from "msw";
import { list, create, update, remove } from "./store";
import { v4 as uuidv4 } from "uuid";

const API = "/api/v1/fhir/r4";

const delayMs = (min = 30, max = 120) =>
  Math.floor(Math.random() * (max - min) + min);

// ── 种子数据 (与后端 toFhir* builder 形状一致) ──
const SEED_PATIENTS: any[] = [
  {
    resourceType: "Patient",
    id: "P000001",
    identifier: [{ system: "urn:oid:1.2.36.146.595.217.0.1", value: "110101199001011234" }],
    name: [{ family: "张明远", given: ["张明远"] }],
    gender: "male",
    birthDate: "1985-06-15",
    telecom: [{ system: "phone", value: "13800138001" }],
    meta: { lastUpdated: "2026-08-01T08:00:00Z" },
  },
  {
    resourceType: "Patient",
    id: "P000002",
    identifier: [{ system: "urn:oid:1.2.36.146.595.217.0.1", value: "110101199503024567" }],
    name: [{ family: "李静", given: ["李静"] }],
    gender: "female",
    birthDate: "1995-03-22",
    telecom: [{ system: "phone", value: "13800138002" }],
    meta: { lastUpdated: "2026-08-01T08:05:00Z" },
  },
  {
    resourceType: "Patient",
    id: "P000003",
    identifier: [{ system: "urn:oid:1.2.36.146.595.217.0.1", value: "110101196802153456" }],
    name: [{ family: "王强", given: ["王强"] }],
    gender: "male",
    birthDate: "1968-02-15",
    telecom: [{ system: "phone", value: "13800138003" }],
    meta: { lastUpdated: "2026-08-01T08:10:00Z" },
  },
];

const SEED_OBSERVATIONS: any[] = [
  {
    resourceType: "Observation",
    id: "OBS-001",
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: "24627-2", display: "Chest CT" }], text: "胸部CT所见" },
    subject: { reference: "Patient/P000001" },
    effectiveDateTime: "2026-08-01T09:00:00Z",
    valueQuantity: { value: 1, unit: "报告" },
  },
];

const SEED_REPORTS: any[] = [
  {
    resourceType: "DiagnosticReport",
    id: "RPT-001",
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: "55115-0", display: "Chest CT" }], text: "胸部CT平扫报告" },
    subject: { reference: "Patient/P000001" },
    effectiveDateTime: "2026-08-01T10:00:00Z",
    issued: "2026-08-01T10:30:00Z",
    performer: [{ reference: "Practitioner/DR-001" }],
    result: [{ reference: "Observation/OBS-001" }],
  },
];

const SEED_STUDIES: any[] = [
  {
    resourceType: "ImagingStudy",
    id: "STU-001",
    status: "available",
    subject: { reference: "Patient/P000001" },
    started: "2026-08-01T09:00:00Z",
    numberOfSeries: 1,
    numberOfInstances: 150,
    procedureCode: [{ coding: [{ system: "http://snomed.info/sct", code: "408719007", display: "CT" }] }],
    series: [
      {
        uid: "1.2.826.0.1.3680043.8.498.20260718120000.001",
        number: 1,
        modality: { coding: [{ system: "http://dicom.nema.org/resources/ontology/DCM", code: "CT" }] },
        description: "Chest CT",
        numberOfInstances: 150,
      },
    ],
  },
];

const SEED_SUBSCRIPTIONS: any[] = [
  {
    resourceType: "Subscription",
    id: "SUB-001",
    status: "active",
    reason: "监控新检查报告",
    criteria: "DiagnosticReport?status=final",
    channel: { type: "rest-hook", endpoint: "https://example.com/hook", payload: "id-only" },
  },
];

// [W2-B-3] 兼容 /integration/fhir-server 页面直调 (FhirServerPage 用 raw fetch 调
//   /api/v1/fhir/{Patient|Observation|DiagnosticReport|Practitioner|ImagingStudy|Bundle})
//   后端真实路径为 /fhir/r4/*, 此处为 demo 模式下的无 /r4 前缀兜底。
const API_NO_R4 = "/api/v1/fhir";
const SEED_GENERIC_RESOURCES: Record<string, any[]> = {
  Patient: SEED_PATIENTS,
  Observation: SEED_OBSERVATIONS,
  DiagnosticReport: SEED_REPORTS,
  Practitioner: [
    { resourceType: "Practitioner", id: "PR-001", name: [{ family: "张明远", given: ["张明远"] }], telecom: [{ system: "phone", value: "13800138001" }] },
    { resourceType: "Practitioner", id: "PR-002", name: [{ family: "李慧敏", given: ["李慧敏"] }], telecom: [{ system: "phone", value: "13800138002" }] },
  ],
  ImagingStudy: SEED_STUDIES,
  Bundle: [],
};

const bundle = (entries: any[]) => ({
  resourceType: "Bundle",
  type: "searchset",
  total: entries.length,
  entry: entries.map((e) => ({ resource: e, fullUrl: `${API}/${e.resourceType}/${e.id}` })),
});

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
    ensureSeeded("fhirPatients", SEED_PATIENTS);
    const found = list<any>("fhirPatients" as any).find((p) => p.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/Patient`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded("fhirPatients", SEED_PATIENTS);
    const sp = urlParams(request);
    const name = sp.get("name")?.toLowerCase();
    const identifier = sp.get("identifier");
    let items = list<any>("fhirPatients" as any);
    if (name) items = items.filter((p) => JSON.stringify(p.name).toLowerCase().includes(name));
    if (identifier) items = items.filter((p) => p.identifier?.some((i: any) => String(i.value).includes(identifier)));
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  http.post(`${API}/Patient`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const resource = { resourceType: "Patient", id: uuidv4(), ...body };
    try { create("fhirPatients" as any, resource); } catch {}
    return HttpResponse.json({ success: true, data: resource }, { status: 201 });
  }),

  http.put(`${API}/Patient/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const existing = list<any>("fhirPatients" as any).find((p) => p.id === params.id) ?? { id: params.id, resourceType: "Patient" };
    const updated = { ...existing, ...body, id: params.id };
    try { update("fhirPatients" as any, params.id as string, updated); } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.delete(`${API}/Patient/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove("fhirPatients" as any, params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: { resourceType: "OperationOutcome", issue: [{ severity: "information", code: "deleted" }] } });
  }),

  http.get(`${API}/Patient/:id/$everything`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded("fhirPatients", SEED_PATIENTS);
    const patient = list<any>("fhirPatients" as any).find((p) => p.id === params.id) ?? SEED_PATIENTS[0];
    const related = [
      ...list<any>("fhirReports" as any).filter((r) => r.subject?.reference === `Patient/${params.id}`),
      ...list<any>("fhirStudies" as any).filter((s) => s.subject?.reference === `Patient/${params.id}`),
    ];
    return HttpResponse.json({ success: true, data: bundle([patient, ...related]) });
  }),

  // ── Observation ──
  http.get(`${API}/Observation/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded("fhirObservations", SEED_OBSERVATIONS);
    const found = list<any>("fhirObservations" as any).find((o) => o.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/Observation`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded("fhirObservations", SEED_OBSERVATIONS);
    const patient = urlParams(request).get("patient");
    let items = list<any>("fhirObservations" as any);
    if (patient) items = items.filter((o) => o.subject?.reference === `Patient/${patient}`);
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  // ── DiagnosticReport ──
  http.get(`${API}/DiagnosticReport/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded("fhirReports", SEED_REPORTS);
    const found = list<any>("fhirReports" as any).find((r) => r.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/DiagnosticReport`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded("fhirReports", SEED_REPORTS);
    const sp = urlParams(request);
    const patient = sp.get("patient");
    const status = sp.get("status");
    let items = list<any>("fhirReports" as any);
    if (patient) items = items.filter((r) => r.subject?.reference === `Patient/${patient}`);
    if (status) items = items.filter((r) => r.status === status);
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  // ── ImagingStudy ──
  http.get(`${API}/ImagingStudy/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded("fhirStudies", SEED_STUDIES);
    const found = list<any>("fhirStudies" as any).find((s) => s.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: found });
  }),

  http.get(`${API}/ImagingStudy`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded("fhirStudies", SEED_STUDIES);
    const sp = urlParams(request);
    const patient = sp.get("patient");
    const modality = sp.get("modality");
    let items = list<any>("fhirStudies" as any);
    if (patient) items = items.filter((s) => s.subject?.reference === `Patient/${patient}`);
    if (modality) items = items.filter((s) => s.series?.some((ser: any) => ser.modality?.coding?.[0]?.code === modality));
    return HttpResponse.json({ success: true, data: bundle(items) });
  }),

  // ── Subscription ──
  http.post(`${API}/Subscription`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const resource = { resourceType: "Subscription", id: uuidv4(), ...body };
    try { create("fhirSubscriptions" as any, resource); } catch {}
    return HttpResponse.json({ success: true, data: resource }, { status: 201 });
  }),

  http.get(`${API}/Subscription/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded("fhirSubscriptions", SEED_SUBSCRIPTIONS);
    const found = list<any>("fhirSubscriptions" as any).find((s) => s.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: found });
  }),

  // 页面期望裸数组 (FhirSubscriptionPage: Array.isArray(res.data))
  http.get(`${API}/Subscription`, async () => {
    await delay(delayMs());
    ensureSeeded("fhirSubscriptions", SEED_SUBSCRIPTIONS);
    return HttpResponse.json({ success: true, data: list<any>("fhirSubscriptions" as any) });
  }),

  http.delete(`${API}/Subscription/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove("fhirSubscriptions" as any, params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: { resourceType: "OperationOutcome", issue: [{ severity: "information", code: "deleted" }] } });
  }),

  // ── Bulk Export ($export / $export-status) ──
  http.get(`${API}/$export`, async () => {
    await delay(delayMs(60, 150));
    return HttpResponse.json({ success: true, data: { jobId: `bulk-${Date.now()}` } });
  }),

  http.get(`${API}/$export-status/:jobId`, async () => {
    await delay(delayMs(60, 150));
    return HttpResponse.json({
      success: true,
      data: {
        status: "completed",
        transactionTime: new Date().toISOString(),
        output: [
          { type: "Patient", url: `${API}/Patient`, count: 3 },
          { type: "DiagnosticReport", url: `${API}/DiagnosticReport`, count: 1 },
        ],
      },
    });
  }),

  // ── SMART on FHIR ──
  http.get(`${API}/.well-known/smart-configuration`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        authorization_endpoint: `${API}/auth/authorize`,
        token_endpoint: `${API}/auth/token`,
        capabilities: ["launch-standalone", "client-public", "context-standalone-patient"],
      },
    });
  }),

  http.get(`${API}/auth/authorize`, async ({ request }) => {
    await delay(delayMs());
    const sp = urlParams(request);
    return HttpResponse.json({
      success: true,
      data: { redirectUrl: `${sp.get("redirect_uri") ?? "https://app.local/callback"}?code=mock-auth-code&state=${sp.get("state") ?? ""}` },
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

  // [W2-B-3] 无 /r4 前缀的资源浏览 (FhirServerPage raw fetch, 直接返回 Bundle 本体)
  http.get(`${API_NO_R4}/:type`, async ({ params, request }) => {
    await delay(delayMs());
    const type = String(params.type ?? 'Patient');
    const items = SEED_GENERIC_RESOURCES[type] ?? [];
    const sp = urlParams(request);
    const name = sp.get("name")?.toLowerCase();
    let result = items;
    if (name) result = items.filter((r) => JSON.stringify(r).toLowerCase().includes(name));
    return HttpResponse.json(bundle(result));
  }),
  http.post(`${API_NO_R4}/:type`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const type = String(params.type ?? 'Patient');
    const resource = { resourceType: type, id: uuidv4(), ...body };
    return HttpResponse.json(resource, { status: 201 });
  }),
];

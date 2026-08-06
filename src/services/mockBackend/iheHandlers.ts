// [G005 P1] /api/v1/ihe MSW handlers — 与 backend ihe.controller.ts / ihe.service.ts 对齐
// 页面: /ihe/manager (IheManagerPage) /ihe/pix (PixPage) /ihe/pam (PamPage) /ihe/visit (VisitPage) /ihe/visit-detail (VisitDetailPage)
//       /integration/ihe (IheIntegrationPage)
import { http, HttpResponse, delay } from "msw";

const API = "/api/v1/ihe";

const delayMs = (min = 40, max = 150) =>
  Math.floor(Math.random() * (max - min) + min);

const DEFAULT_DOMAIN = {
  homeCommunityId: "1.2.3.4.5.6.7.8.9",
  name: "G005 医疗联盟",
  nameEn: "G005 Medical Alliance",
  repositoryUniqueIds: ["1.2.3.4.5.6.7.8.9.1"],
  assigningAuthorityId: "G005",
  registryEndpoint: "https://registry.g005.local:8443",
  repositoryEndpoint: "https://repository.g005.local:8443",
  pixManagerEndpoint: "https://pix.g005.local:8443",
  pdqSupplierEndpoint: "https://pdq.g005.local:8443",
};

let pamLog: any[] = [
  {
    ts: new Date(Date.now() - 3600_000).toISOString(),
    message: { messageType: "ADT^A04", patientId: "P000001", assigningAuthority: "G005", visitNumber: "VN-001" },
    ack: "AA",
    messageId: "PAM-001",
  },
  {
    ts: new Date(Date.now() - 7200_000).toISOString(),
    message: { messageType: "ADT^A01", patientId: "P000002", assigningAuthority: "G005", visitNumber: "VN-002" },
    ack: "AA",
    messageId: "PAM-002",
  },
];

let visits: any[] = [
  {
    patientId: "P000001",
    visitNumber: "VN-001",
    status: "ADMITTED",
    classCode: "I",
    assignedLocation: { type: "WARD", room: "301", bed: "A" },
    admitDateTime: new Date(Date.now() - 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    patientId: "P000002",
    visitNumber: "VN-002",
    status: "IN_PROGRESS",
    classCode: "O",
    assignedLocation: { type: "RAD", room: "CT-1" },
    admitDateTime: new Date(Date.now() - 7200_000).toISOString(),
    updatedAt: new Date(Date.now() - 7200_000).toISOString(),
  },
];

const seedPix = [
  { patientId: "P000001", assigningAuthority: "G005", identifiers: [{ domain: "G005", value: "P000001" }], name: { family: "张明远", given: ["张明远"] } },
  { patientId: "P000002", assigningAuthority: "G005", identifiers: [{ domain: "G005", value: "P000002" }], name: { family: "李静", given: ["李静"] } },
];

const visitTimeline = (patientId: string, visitNumber: string) => [
  { event: "PAM-ADT", timestamp: new Date(Date.now() - 3600_000).toISOString(), description: `A04 登记: ${visitNumber}` },
  { event: "CHECK-IN", timestamp: new Date(Date.now() - 1800_000).toISOString(), description: `患者 ${patientId} 到达科室` },
];

const visitAdt = (patientId: string, visitNumber: string) => [
  { id: `ADT-${Date.now()}`, messageType: "ADT^A04", timestamp: new Date(Date.now() - 3600_000).toISOString(), content: `MSH|^~\\&|RIS|G005|||...ADT^A04...PID|1||${patientId}||${visitNumber}` },
];

export const iheHandlers = [
  http.get(`${API}/status`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        profile: "PAM/PIX/PDQ",
        affinityDomain: DEFAULT_DOMAIN,
        metrics: { pixRecords: 12345, pdqCache: 892, pamLogSize: pamLog.length },
        transactions: ["ITI-8", "ITI-9", "ITI-10", "ITI-21", "ITI-22", "ITI-30", "ITI-31"],
      },
    });
  }),

  http.get(`${API}/affinity-domain`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: DEFAULT_DOMAIN });
  }),

  http.put(`${API}/affinity-domain`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { ...DEFAULT_DOMAIN, ...body } });
  }),

  http.delete(`${API}/affinity-domain`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: DEFAULT_DOMAIN });
  }),

  // ── PIX (ITI-8 / ITI-9 / ITI-10) ──
  http.post(`${API}/pix/feed`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const messageId = `PIX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const errors: string[] = [];
    if (!body?.patientId) errors.push("缺少 patientId");
    if (!body?.assigningAuthority) errors.push("缺少 assigningAuthority");
    if (errors.length > 0) return HttpResponse.json({ success: true, data: { ack: "AE", messageId, errors } });
    return HttpResponse.json({ success: true, data: { ack: "AA", messageId, storedPid: body.patientId } });
  }),

  http.post(`${API}/pix/query`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const targetDomains = body?.targetDomains ?? ["G005"];
    const sourceKey = `${body?.sourceDomain ?? "G005"}^${body?.patientId ?? ""}`;
    const record = seedPix.find((r) => `G005^${r.patientId}` === sourceKey || r.patientId === body?.patientId);
    return HttpResponse.json({
      success: true,
      data: {
        transaction: "ITI-9",
        count: targetDomains.length,
        patientId: body?.patientId,
        sourceDomain: body?.sourceDomain ?? "G005",
        targetDomains,
        results: targetDomains.map((domain: string) => ({
          patientId: record?.patientId ?? body?.patientId,
          assigningAuthority: domain,
          identifiers: record?.identifiers ?? [],
          name: record?.name ?? { family: "未知", given: ["未知"] },
        })),
      },
    });
  }),

  http.post(`${API}/pix/update-notification`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { transaction: "ITI-10", ack: "AA", messageId: `PIX-UP-${Date.now()}`, storedPid: body?.patientId } });
  }),

  // ── PDQ (ITI-21 / ITI-22) ──
  http.post(`${API}/pdq/query`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    let results = seedPix;
    if (body?.patientId) results = results.filter((r) => r.patientId === body.patientId || r.identifiers.some((i) => i.value === body.patientId));
    if (body?.familyName) results = results.filter((r) => r.name.family.toLowerCase().includes(String(body.familyName).toLowerCase()));
    return HttpResponse.json({
      success: true,
      data: {
        transaction: "ITI-21",
        count: results.length,
        results: results.map((r) => ({
          patientId: r.patientId,
          assigningAuthority: r.assigningAuthority,
          identifiers: r.identifiers,
          name: r.name,
          birthDate: "1990-01-01",
          gender: "M",
          confidence: 0.95,
        })),
      },
    });
  }),

  // ── PAM (ITI-30 / ITI-31) ──
  http.post(`${API}/pam/message`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const messageId = `PAM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const errors: string[] = [];
    if (!body?.patientId) errors.push("缺少 patientId");
    if (!body?.assigningAuthority) errors.push("缺少 assigningAuthority");
    if (errors.length > 0) {
      pamLog = [{ ts: timestamp, message: body, ack: "AE", messageId }, ...pamLog];
      return HttpResponse.json({ success: true, data: { transaction: "ITI-30", success: false, ack: "AE", messageId, errors, timestamp } });
    }
    const visitNumber = body?.visitNumber ?? `VN-${Date.now()}`;
    pamLog = [{ ts: timestamp, message: body, ack: "AA", messageId }, ...pamLog];
    const status = body?.messageType?.includes("A01") || body?.messageType?.includes("A04") ? "ADMITTED" : "IN_PROGRESS";
    visits = [{ patientId: body.patientId, visitNumber, status, classCode: "I", assignedLocation: { type: "WARD", room: "301", bed: "A" }, admitDateTime: timestamp, updatedAt: timestamp }, ...visits.filter((v) => !(v.patientId === body.patientId && v.visitNumber === visitNumber))];
    return HttpResponse.json({ success: true, data: { transaction: "ITI-30", success: true, ack: "AA", messageId, visitNumber, timestamp } });
  }),

  http.get(`${API}/pam/messages`, async ({ request }) => {
    await delay(delayMs());
    const sp = new URL(request.url).searchParams;
    const limit = Number(sp.get("limit") ?? 100);
    const messageType = sp.get("messageType");
    const patientId = sp.get("patientId");
    let items = [...pamLog];
    if (messageType) items = items.filter((e) => e.message?.messageType === messageType);
    if (patientId) items = items.filter((e) => e.message?.patientId === patientId);
    return HttpResponse.json({ success: true, data: { total: items.length, entries: items.slice(0, limit) } });
  }),

  http.get(`${API}/pam/visit`, async ({ request }) => {
    await delay(delayMs());
    const sp = new URL(request.url).searchParams;
    const patientId = sp.get("patientId") ?? "";
    const visitNumber = sp.get("visitNumber");
    const found = visits.find((v) => v.patientId === patientId && (!visitNumber || v.visitNumber === visitNumber));
    return HttpResponse.json({ success: true, data: found ?? null });
  }),

  http.get(`${API}/pam/visit-detail`, async ({ request }) => {
    await delay(delayMs());
    const sp = new URL(request.url).searchParams;
    const patientId = sp.get("patientId") ?? "";
    const visitNumber = sp.get("visitNumber") ?? "";
    const found = visits.find((v) => v.patientId === patientId && v.visitNumber === visitNumber);
    if (!found) return HttpResponse.json({ success: true, data: null });
    return HttpResponse.json({
      success: true,
      data: {
        ...found,
        timeline: visitTimeline(patientId, visitNumber),
        adtMessages: visitAdt(patientId, visitNumber),
      },
    });
  }),

  // ── Mock / 演示端点 ──
  http.get(`${API}/mock/register-document`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { documentId: `doc-${Date.now()}`, patientId: "P000001", repository: "1.2.3.4.5.6.7.8.9.1" } });
  }),

  http.get(`${API}/mock/documents`, async ({ request }) => {
    await delay(delayMs());
    const patientId = new URL(request.url).searchParams.get("patientId") ?? "";
    return HttpResponse.json({
      success: true,
      data: {
        patientId,
        domain: "G005",
        documents: [
          { documentId: `doc-${patientId}-001`, patientId, repositoryUniqueId: "1.2.840.113556.1.8000.2554.1.100", classCode: "RAD", formatCode: "urn:ihe:rad:1", mimeType: "application/dicom", size: 1024 },
          { documentId: `doc-${patientId}-002`, patientId, repositoryUniqueId: "1.2.840.113556.1.8000.2554.1.101", classCode: "RAD", formatCode: "urn:ihe:rad:2", mimeType: "application/pdf", size: 512 },
        ],
      },
    });
  }),

  http.get(`${API}/mock/pdq`, async ({ request }) => {
    await delay(delayMs());
    const patientId = new URL(request.url).searchParams.get("patientId") ?? "";
    const found = seedPix.find((r) => r.patientId === patientId);
    return HttpResponse.json({
      success: true,
      data: {
        patientId,
        assigningAuthority: "G005",
        identifiers: found?.identifiers ?? [],
        name: found?.name ?? { family: "未知", given: ["未知"] },
        birthDate: "1990-01-01",
        gender: "M",
        confidence: 0.95,
      },
    });
  }),

  http.post(`${API}/mock/cross-reference`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { localId: body?.localId, remoteDomain: body?.remoteDomain, remoteId: `${body?.remoteDomain}-${body?.localId}` } });
  }),
];

export const __iheTestReset = () => {
  pamLog = [];
  visits = [];
};

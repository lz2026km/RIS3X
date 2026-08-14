// [G005 P1] /api/v1/dicom-dimse MSW handlers — 与 backend dicom-dimse.controller.ts 对齐
// 页面: /dicom-dimse (DicomDimsePage: echo/find/store/move) /integration/dimse-upload (DimseUploadPage: upload)
import { http, HttpResponse, delay } from "msw";
import { v4 as uuidv4 } from "uuid";
import { list } from "./store";

const API = "/api/v1/dicom-dimse";

const delayMs = (min = 60, max = 250) =>
  Math.floor(Math.random() * (max - min) + min);

const MWL_ITEMS = [
  {
    patientName: "张明远",
    patientId: "P000001",
    accessionNumber: "AC-20260801-001",
    modality: "CT",
    bodyPart: "CHEST",
    scheduledDateTime: new Date().toISOString(),
    studyInstanceUid: "1.2.826.0.1.3680043.8.498.20260801090000.001",
    examId: "EX001",
    deviceId: "DEV001",
    deviceName: "CT-01",
    scheduledProcedureStepSequence: [
      { scheduledProcedureStepId: "SPS-001", scheduledStationAeTitle: "CT_SCANNER_01", scheduledProcedureStepStartDate: new Date().toISOString().slice(0, 10), scheduledProcedureStepStartTime: "09:00:00", modality: "CT" },
    ],
  },
  {
    patientName: "李静",
    patientId: "P000002",
    accessionNumber: "AC-20260801-002",
    modality: "MR",
    bodyPart: "BRAIN",
    scheduledDateTime: new Date().toISOString(),
    studyInstanceUid: "1.2.826.0.1.3680043.8.498.20260801100000.002",
    examId: "EX002",
    deviceId: "DEV002",
    deviceName: "MR-01",
    scheduledProcedureStepSequence: [
      { scheduledProcedureStepId: "SPS-002", scheduledStationAeTitle: "MR_SCANNER_02", scheduledProcedureStepStartDate: new Date().toISOString().slice(0, 10), scheduledProcedureStepStartTime: "10:00:00", modality: "MR" },
    ],
  },
];

const delayForDevice = (aeTitle: string) => {
  const seed = (aeTitle ?? "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return 80 + (seed % 5) * 40;
};

// [G005 v3.0.6.11-86 Wave 4B (G-03/G-05)] TLS 配置 + 节点开关 + MPPS 内存态 (与 backend dicom-dimse.service 对齐)
let mockTlsConfig: any = {
  enabled: false,
  certificate: "",
  caCert: "",
  port: 2762,
  verifyPeer: false,
};
const mockNodeTls = new Map<string, boolean>();
const mockMpps = new Map<string, any>();

// [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] C-STORE 传输队列内存态 (与 backend seed 对齐)
// [G005 v3.0.6.11-96 Wave 2B (D)] 传输记录支持 examId/accessionNumber (worklist 联动)
let transferSeq = 0;
const makeTransfer = (partial: Partial<any> = {}): any => {
  const now = new Date().toISOString();
  const total = partial.totalInstances ?? 12;
  const progress = partial.progress ?? 0;
  return {
    id: `TR-${String(++transferSeq).padStart(4, "0")}`,
    studyUid: partial.studyUid ?? `1.2.840.114350.1.1.${Date.now()}`,
    targetAe: partial.targetAe ?? "PACS_ARCHIVE",
    status: partial.status ?? "queued",
    progress,
    totalInstances: total,
    completedInstances: partial.completedInstances ?? Math.round((progress / 100) * total),
    priority: partial.priority ?? "NORMAL",
    createdAt: now,
    updatedAt: now,
    source: partial.source ?? "queue",
    error: partial.status === "failed" ? "DICOM Association 超时 (MSW)" : undefined,
    examId: partial.examId,
    accessionNumber: partial.accessionNumber,
  };
};
let mockTransfers: any[] = [
  makeTransfer({ studyUid: "1.2.840.114350.1.1.20260801.001", targetAe: "CT_SCANNER_01", status: "sending", progress: 42, source: "seed" }),
  makeTransfer({ studyUid: "1.2.840.114350.1.1.20260801.002", targetAe: "MR_SCANNER_02", status: "queued", progress: 0, source: "seed" }),
  makeTransfer({ studyUid: "1.2.840.114350.1.1.20260731.003", targetAe: "XA_LAB_01", status: "completed", progress: 100, source: "seed" }),
  makeTransfer({ studyUid: "1.2.840.114350.1.1.20260730.004", targetAe: "US_UNIT_01", status: "failed", progress: 35, source: "seed" }),
];

const transferStats = () => {
  const count = (s: string) => mockTransfers.filter((t) => t.status === s).length;
  const done = mockTransfers.filter((t) => ["completed", "failed", "canceled"].includes(t.status));
  const inFlight = mockTransfers.filter((t) => !["completed", "canceled"].includes(t.status));
  return {
    total: mockTransfers.length,
    queued: count("queued"),
    sending: count("sending"),
    paused: count("paused"),
    failed: count("failed"),
    completed: count("completed"),
    canceled: count("canceled"),
    activeCount: count("queued") + count("sending") + count("paused"),
    successRate: done.length ? Math.round((count("completed") / done.length) * 100) : 0,
    avgProgress: inFlight.length ? Math.round(inFlight.reduce((s, t) => s + t.progress, 0) / inFlight.length) : 0,
  };
};

export const dicomDimseHandlers = [
  http.post(`${API}/echo`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(delayForDevice(body?.calledAeTitle), delayForDevice(body?.calledAeTitle) + 80));
    return HttpResponse.json({
      success: true,
      data: {
        statusCode: 0x0000,
        affectedSopClassUid: "1.2.840.10008.1.1",
        message: "C-ECHO-RSP: Success",
        calledAeTitle: body?.calledAeTitle,
        callingAeTitle: body?.callingAeTitle,
        pingMs: delayForDevice(body?.calledAeTitle),
      },
    });
  }),

  http.post(`${API}/find`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(100, 300));
    let items = MWL_ITEMS;
    if (body?.patientName) items = items.filter((i) => i.patientName.includes(body.patientName));
    if (body?.patientId) items = items.filter((i) => i.patientId === body.patientId);
    if (body?.accessionNumber) items = items.filter((i) => i.accessionNumber === body.accessionNumber);
    if (body?.modality) items = items.filter((i) => i.modality === body.modality);
    return HttpResponse.json({ success: true, data: { matches: items.length, items } });
  }),

  http.post(`${API}/store`, async () => {
    await delay(delayMs(150, 400));
    return HttpResponse.json({ success: true, data: { sopInstanceUid: `1.2.826.0.1.3680043.8.498.${Date.now()}`, storagePath: "mock/store.dcm", sizeBytes: 128 } }, { status: 200 });
  }),

  http.post(`${API}/move`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(150, 400));
    return HttpResponse.json({
      success: true,
      data: {
        statusCode: 0x0000,
        destinationAe: body?.destinationAe,
        numberOfCompletedSubOperations: body?.studyInstanceUid ? 3 : 0,
        numberOfFailedSubOperations: 0,
        numberOfRemainingSubOperations: 0,
        message: `C-MOVE to ${body?.destinationAe}`,
      },
    });
  }),

  http.post(`${API}/upload`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(150, 400));
    return HttpResponse.json({
      success: true,
      data: {
        status: "success",
        url: `https://s3.mock.local/dicom/${body?.sopInstanceUid ?? uuidv4()}.dcm`,
        fileName: body?.fileName,
        fileSize: body?.fileSize,
        destination: body?.destination ?? "s3",
        storedAt: new Date().toISOString(),
      },
    });
  }),

  // [G005 v3.0.6.11-86 Wave 4B (G-03)] TLS 全局配置
  http.get(`${API}/tls-config`, async () => {
    await delay(delayMs(40, 120));
    return HttpResponse.json({ success: true, data: mockTlsConfig });
  }),

  http.put(`${API}/tls-config`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(60, 180));
    mockTlsConfig = {
      ...mockTlsConfig,
      ...body,
      certificate: body?.certificate === "" ? undefined : (body?.certificate ?? mockTlsConfig.certificate),
      caCert: body?.caCert === "" ? undefined : (body?.caCert ?? mockTlsConfig.caCert),
    };
    return HttpResponse.json({ success: true, data: mockTlsConfig });
  }),

  // [G005 v3.0.6.11-86 Wave 4B (G-03)] 节点级 TLS 开关
  http.get(`${API}/nodes/:id/tls`, async ({ params }) => {
    await delay(delayMs(40, 120));
    const id = String(params.id);
    return HttpResponse.json({ success: true, data: { id, tlsEnabled: mockNodeTls.get(id) ?? false, supported: true } });
  }),

  http.put(`${API}/nodes/:id/tls`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(60, 180));
    const id = String(params.id);
    mockNodeTls.set(id, body?.enabled === true);
    return HttpResponse.json({ success: true, data: { id, tlsEnabled: mockNodeTls.get(id), supported: true } });
  }),

  // [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度
  http.post(`${API}/mpps`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(60, 180));
    const now = new Date().toISOString();
    const existing = mockMpps.get(body?.studyUid);
    const record = {
      studyUid: body?.studyUid,
      status: body?.status ?? "IN_PROGRESS",
      startedAt: existing?.startedAt ?? now,
      completedAt: body?.status === "COMPLETED" || body?.status === "DISCONTINUED" ? now : existing?.completedAt,
      performedSteps: body?.performedSteps ?? existing?.performedSteps ?? [],
      updatedAt: now,
      source: existing?.source ?? "mpps",
      patientName: existing?.patientName,
      patientId: existing?.patientId,
      modality: existing?.modality,
    };
    mockMpps.set(body?.studyUid, record);
    return HttpResponse.json({ success: true, data: record });
  }),

  http.get(`${API}/mpps`, async () => {
    await delay(delayMs(40, 120));
    const list = [...mockMpps.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return HttpResponse.json({ success: true, data: list });
  }),

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] C-STORE 传输队列
  http.get(`${API}/transfers`, async () => {
    await delay(delayMs(40, 120));
    return HttpResponse.json({ success: true, data: [...mockTransfers].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) });
  }),

  http.post(`${API}/transfers`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    await delay(delayMs(60, 180));
    if (!body?.studyUid || !body?.targetAe) {
      return HttpResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "studyUid / targetAe 必填" } }, { status: 400 });
    }
    // [v3.0.6.11-96 Wave 2B (D)] 关联检查透传 (examId/accessionNumber, worklist 联动);
    // 未传 examId 时从 studyUid 反查 exams 集合 (对齐后端 deriveExamFromStudyUid)
    const linked = (() => {
      if (body.examId) {
        return list<any>('exams').find((e: any) => String(e.id ?? e.reportId ?? e.examId) === String(body.examId)) ?? { reportId: String(body.examId) };
      }
      return list<any>('exams').find((e: any) =>
        String(e.id ?? e.reportId ?? e.examId) === String(body.studyUid) ||
        String(e.accessionNumber ?? '') === String(body.studyUid));
    })();
    const record = makeTransfer({
      studyUid: body.studyUid,
      targetAe: body.targetAe,
      priority: body.priority,
      examId: body.examId ?? linked?.reportId ?? linked?.id ?? linked?.examId,
      accessionNumber: body.accessionNumber ?? linked?.accessionNumber,
    });
    mockTransfers.push(record);
    return HttpResponse.json({ success: true, data: record });
  }),

  http.get(`${API}/transfers/stats`, async () => {
    await delay(delayMs(40, 120));
    return HttpResponse.json({ success: true, data: transferStats() });
  }),

  http.post(`${API}/transfers/:id/retry`, async ({ params }) => {
    await delay(delayMs(60, 180));
    const id = String(params.id);
    const t = mockTransfers.find((x) => x.id === id);
    if (!t) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: `Transfer ${id} not found` } }, { status: 404 });
    if (t.status === "sending") return HttpResponse.json({ success: false, error: { code: "BAD_REQUEST", message: `传输 ${id} 正在进行中` } }, { status: 400 });
    t.status = "sending";
    if (t.status === "failed") { t.progress = 0; t.completedInstances = 0; }
    t.error = undefined;
    t.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: t });
  }),

  http.post(`${API}/transfers/:id/pause`, async ({ params }) => {
    await delay(delayMs(60, 180));
    const id = String(params.id);
    const t = mockTransfers.find((x) => x.id === id);
    if (!t) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: `Transfer ${id} not found` } }, { status: 404 });
    if (!["sending", "queued"].includes(t.status)) return HttpResponse.json({ success: false, error: { code: "BAD_REQUEST", message: `仅 queued/sending 状态可暂停, 当前: ${t.status}` } }, { status: 400 });
    t.status = "paused";
    t.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: t });
  }),

  http.post(`${API}/transfers/:id/resume`, async ({ params }) => {
    await delay(delayMs(60, 180));
    const id = String(params.id);
    const t = mockTransfers.find((x) => x.id === id);
    if (!t) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: `Transfer ${id} not found` } }, { status: 404 });
    if (t.status !== "paused") return HttpResponse.json({ success: false, error: { code: "BAD_REQUEST", message: `仅 paused 状态可恢复, 当前: ${t.status}` } }, { status: 400 });
    t.status = "sending";
    t.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: t });
  }),

  http.post(`${API}/transfers/:id/cancel`, async ({ params }) => {
    await delay(delayMs(60, 180));
    const id = String(params.id);
    const t = mockTransfers.find((x) => x.id === id);
    if (!t) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: `Transfer ${id} not found` } }, { status: 404 });
    if (t.status === "completed") return HttpResponse.json({ success: false, error: { code: "BAD_REQUEST", message: `传输 ${id} 已完成, 不可取消` } }, { status: 400 });
    t.status = "canceled";
    t.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: t });
  }),
];

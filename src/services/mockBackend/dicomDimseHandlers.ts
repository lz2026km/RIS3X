// [G005 P1] /api/v1/dicom-dimse MSW handlers — 与 backend dicom-dimse.controller.ts 对齐
// 页面: /dicom-dimse (DicomDimsePage: echo/find/store/move) /integration/dimse-upload (DimseUploadPage: upload)
import { http, HttpResponse, delay } from "msw";
import { v4 as uuidv4 } from "uuid";

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
];

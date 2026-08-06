// [G005 W1] /api/v1/hl7 MSW handlers — 与 backend hl7.controller.ts / hl7.service.ts 对齐
// 页面: /integration/hl7-builder (Hl7BuilderPage) /integration/hl7-archive (Hl7ArchivePage)
//       /hl7/manager (Hl7ManagerPage) /integration/mllp-monitor (MllpMonitorPage) /integration/mllp-config (MllpConfigPage)
// 注: /hl7/siu 与 /hl7/siu/parse 由 v3ReportHandlers.ts integrationHandlers 提供, 此处不重复注册
import { http, HttpResponse, delay } from "msw";

const API = "/api/v1/hl7";

const delayMs = (min = 40, max = 150) =>
  Math.floor(Math.random() * (max - min) + min);

const nowHL7 = () =>
  new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

// ── 内存归档 (与 backend prisma.hl7MessageArchive 形状对齐) ──
interface ArchiveEntry {
  id: number;
  messageType: string;
  controlId: string;
  direction: "INBOUND" | "OUTBOUND" | "ACK";
  ackStatus: "SUCCESS" | "FAILED" | "PENDING";
  retryCount: number;
  rawMessage: string;
  createdAt: string;
}

let archive: ArchiveEntry[] = [
  {
    id: 1,
    messageType: "ORU^R01",
    controlId: "G005-RPT-001-202608010900",
    direction: "OUTBOUND",
    ackStatus: "SUCCESS",
    retryCount: 0,
    rawMessage: "MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_RECEIVER|HIS|20260801090000||ORU^R01|G005-RPT-001-202608010900|P|2.5.1\rPID|1||P000001^^^G005^MR||张明远^张明远||19850615|M",
    createdAt: "2026-08-01T09:00:00.000Z",
  },
  {
    id: 2,
    messageType: "ORM^O01",
    controlId: "ORM-G005-ACC20260001-202608010800",
    direction: "OUTBOUND",
    ackStatus: "SUCCESS",
    retryCount: 0,
    rawMessage: "MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_ORDER|HIS|20260801080000||ORM^O01|ORM-G005-ACC20260001-202608010800|P|2.5.1\rPID|1||P000001^^^G005^MR||张明远^张明远||19850615|M",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: 3,
    messageType: "SIU^S12",
    controlId: "SIU-G005-P000001-202608010700",
    direction: "OUTBOUND",
    ackStatus: "PENDING",
    retryCount: 1,
    rawMessage: "MSH|^~\\&|G005_RIS|G005|HIS|HOSPITAL|20260801070000||SIU^S12|SIU-G005-P000001-202608010700|P|2.5.1\rPID|1||P000001^^^G005^MR||张明远^张明远||M",
    createdAt: "2026-08-01T07:00:00.000Z",
  },
];

let archiveSeq = archive.length;

const pushArchive = (entry: Omit<ArchiveEntry, "id">) => {
  archive = [{ id: ++archiveSeq, ...entry }, ...archive];
  return archive[0];
};

// ── MLLP 状态 (与 backend MllpStatus 形状对齐) ──
let mllpRunning = false;
let mllpTls = false;
let mllpWhitelist = ["127.0.0.1/32", "10.0.0.0/8"];
let mllpConnections = 0;
let mllpMessages = 0;
let mllpLogs: Array<{ id: number; peer: string; event: string; timestamp: string; detail?: string }> = [];
let logSeq = 0;

const pushLog = (peer: string, event: string, detail?: string) => {
  mllpLogs = [
    { id: ++logSeq, peer, event, timestamp: new Date().toISOString(), detail },
    ...mllpLogs,
  ];
};

const buildORU = (r: any): string => {
  const ts = nowHL7();
  const ctrlId = `G005-${r.reportId ?? "REPORT"}-${ts}`;
  const msh = `MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_RECEIVER|HIS|${ts}||ORU^R01|${ctrlId}|P|2.5.1`;
  const pid = `PID|1||${r.patientId ?? ""}^^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^MR||${r.patientName ?? ""}^${r.patientName ?? ""}||${(r.patientBirthDate ?? "").replace(/-/g, "")}|${r.patientSex === "F" ? "F" : r.patientSex === "M" ? "M" : "O"}`;
  const pv1 = `PV1|1|O||||||||||||${r.accessionNumber ?? ""}^^G005^ACC`;
  const obr = `OBR|1|${r.accessionNumber ?? ""}^^G005^FILL|${r.accessionNumber ?? ""}^^G005^FILL|${r.modality ?? ""}^${r.modality ?? ""}^DCM||||${(r.studyDate ?? "").replace(/-/g, "")}${(r.studyTime ?? "").replace(/:/g, "")}|||||||||${r.authorId ?? ""}^${r.authorName ?? ""}^^^G005^DOC`;
  const obx1 = `OBX|1|TX|18782-3^Radiology study observation^LN||${r.findings ?? ""}`;
  const obx2 = `OBX|2|TX|19005-8^Radiology study conclusion^LN||${r.conclusion ?? ""}`;
  const obx3 = r.radsCategory ? `OBX|3|CE|RADS^RADS Category^DCM||${r.radsCategory}` : "";
  return [msh, pid, pv1, obr, obx1, obx2, obx3].filter(Boolean).join("\r");
};

const buildORM = (o: any): string => {
  const ts = nowHL7();
  const ctrlId = `ORM-G005-${o.accessionNumber ?? "ACC"}-${ts}`;
  const msh = `MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_ORDER|HIS|${ts}||ORM^O01|${ctrlId}|P|2.5.1`;
  const pid = `PID|1||${o.patientId ?? ""}^^^G005^MR||${o.patientName ?? ""}^${o.patientName ?? ""}||${(o.patientBirthDate ?? "").replace(/-/g, "")}|${o.patientSex === "F" ? "F" : o.patientSex === "M" ? "M" : "O"}`;
  const orc = `ORC|NW|${o.orderNumber ?? ""}^^G005^ORDER||||||${ts}||||||||||${o.orderingDoctor ?? ""}`;
  const obr = `OBR|1|${o.accessionNumber ?? ""}^^G005^FILL|${o.accessionNumber ?? ""}^^G005^FILL|${o.modality ?? ""}^${o.modality ?? ""}^DCM||||${(o.studyDate ?? "").replace(/-/g, "")}${(o.studyTime ?? "").replace(/:/g, "")}||||||||||||${o.bodyPart ?? ""}`;
  return [msh, pid, orc, obr].join("\r");
};

const buildDFT = (d: any): string => {
  const ts = nowHL7();
  const ctrlId = `DFT-G005-${d.invoiceNumber ?? "INV"}-${ts}`;
  const msh = `MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_FINANCE|HIS|${ts}||DFT^P03|${ctrlId}|P|2.5.1`;
  const pid = `PID|1||${d.patientId ?? ""}^^^G005^MR||${d.patientName ?? ""}^${d.patientName ?? ""}|||${d.patientSex === "F" ? "F" : d.patientSex === "M" ? "M" : "O"}`;
  const ft1 = `FT1|1|${(d.transactionDate ?? ts).replace(/-/g, "").replace(/:/g, "")}|${d.chargeCode ?? ""}|${d.chargeName ?? ""}|${d.invoiceNumber ?? ""}|||||${d.totalAmount ?? "0"}||${d.paidAmount ?? ""}`;
  return [msh, pid, ft1].join("\r");
};

const response = (data: unknown) => HttpResponse.json({ success: true, data });

export const hl7Handlers = [
  // ── 消息构建 ──
  http.post(`${API}/oru`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const message = buildORU(body);
    const controlId = `G005-${body?.reportId ?? "REPORT"}-${nowHL7()}`;
    pushArchive({ messageType: "ORU^R01", controlId, direction: "OUTBOUND", ackStatus: "SUCCESS", retryCount: 0, rawMessage: message, createdAt: new Date().toISOString() });
    return response({ message, controlId, messageType: "ORU^R01", generatedAt: new Date().toISOString(), bytes: message.length });
  }),

  http.post(`${API}/orm`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const message = buildORM(body);
    const controlId = `ORM-G005-${body?.accessionNumber ?? "ACC"}-${nowHL7()}`;
    pushArchive({ messageType: "ORM^O01", controlId, direction: "OUTBOUND", ackStatus: "SUCCESS", retryCount: 0, rawMessage: message, createdAt: new Date().toISOString() });
    return response({ message, controlId, messageType: "ORM^O01", generatedAt: new Date().toISOString(), bytes: message.length });
  }),

  http.post(`${API}/dft`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const message = buildDFT(body);
    const controlId = `DFT-G005-${body?.invoiceNumber ?? "INV"}-${nowHL7()}`;
    pushArchive({ messageType: "DFT^P03", controlId, direction: "OUTBOUND", ackStatus: "SUCCESS", retryCount: 0, rawMessage: message, createdAt: new Date().toISOString() });
    return response({ message, controlId, messageType: "DFT^P03", generatedAt: new Date().toISOString(), bytes: message.length });
  }),

  // batch 双重用途: { reports: [] } 批量构建 / { ids: [] } 重发归档
  http.post(`${API}/batch`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    if (Array.isArray(body?.ids)) {
      const count = body.ids.length;
      archive = archive.map((a) =>
        body.ids.includes(a.id)
          ? { ...a, ackStatus: "SUCCESS" as const, retryCount: a.retryCount + 1 }
          : a,
      );
      return response({ success: true, retried: count });
    }
    const reports: any[] = Array.isArray(body?.reports) ? body.reports : [];
    const messages = reports.map((r) => ({ reportId: r.reportId, message: buildORU(r) }));
    return response({ count: messages.length, messages });
  }),

  http.post(`${API}/push-oru`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    mllpMessages += 1;
    pushLog("RIS→HIS", "message", `push-oru exam=${body?.examId} report=${body?.reportId}`);
    const message = `MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_RECEIVER|HIS|${nowHL7()}||ORU^R01|G005-${body?.reportId ?? "R"}-${nowHL7()}|P|2.5.1`;
    pushArchive({ messageType: "ORU^R01", controlId: `G005-${body?.reportId ?? "R"}-${nowHL7()}`, direction: "OUTBOUND", ackStatus: "SUCCESS", retryCount: 0, rawMessage: message, createdAt: new Date().toISOString() });
    return response({ pushed: true, examId: body?.examId ?? "", reportId: body?.reportId ?? "" });
  }),

  // ── 归档 ──
  http.get(`${API}/archive`, async ({ request }) => {
    await delay(delayMs());
    const sp = new URL(request.url).searchParams;
    let items = [...archive];
    const messageType = sp.get("messageType");
    const direction = sp.get("direction");
    const ackStatus = sp.get("ackStatus");
    const from = sp.get("from");
    const to = sp.get("to");
    if (messageType) items = items.filter((a) => a.messageType === messageType);
    if (direction) items = items.filter((a) => a.direction === direction);
    if (ackStatus) items = items.filter((a) => a.ackStatus === ackStatus);
    if (from) items = items.filter((a) => a.createdAt >= from);
    if (to) items = items.filter((a) => a.createdAt <= to);
    return response(items);
  }),

  // ── MLLP ──
  http.get(`${API}/mllp/status`, async () => {
    await delay(delayMs());
    return response({
      running: mllpRunning,
      port: 2575,
      tlsEnabled: mllpTls,
      tlsPort: mllpTls ? 2576 : undefined,
      whitelist: mllpWhitelist,
      uptimeMs: mllpRunning ? Date.now() % 86400000 : 0,
      totalConnections: mllpConnections,
      totalMessages: mllpMessages,
    });
  }),

  http.get(`${API}/mllp/logs`, async ({ request }) => {
    await delay(delayMs());
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    return response(mllpLogs.slice(0, limit));
  }),

  http.post(`${API}/mllp/start`, async () => {
    await delay(delayMs());
    mllpRunning = true;
    pushLog("127.0.0.1", "connect", "MLLP listener started on port 2575");
    return response({ success: true });
  }),

  http.post(`${API}/mllp/stop`, async () => {
    await delay(delayMs());
    mllpRunning = false;
    pushLog("127.0.0.1", "disconnect", "MLLP listener stopped");
    return response({ success: true });
  }),

  http.post(`${API}/mllp/whitelist/add`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    if (body?.cidr && !mllpWhitelist.includes(body.cidr)) mllpWhitelist = [...mllpWhitelist, body.cidr];
    return response({ success: true });
  }),

  http.post(`${API}/mllp/whitelist/remove`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    mllpWhitelist = mllpWhitelist.filter((c) => c !== body?.cidr);
    return response({ success: true });
  }),

  http.post(`${API}/mllp/tls`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    mllpTls = Boolean(body?.enabled);
    return response({ success: true });
  }),
];

export const __hl7TestReset = () => {
  archive = [];
  archiveSeq = 0;
  mllpLogs = [];
  logSeq = 0;
  mllpRunning = false;
  mllpTls = false;
  mllpWhitelist = ["127.0.0.1/32", "10.0.0.0/8"];
  mllpConnections = 0;
  mllpMessages = 0;
};

/**
 * G005 放射RIS系统 v3.0.6.16-7 - R3.DIST 分发模块 Service
 * 多通道送达(微信/短信/钉钉/邮件) / 送达回执 / 患者端
 *
 * [v3.0.6.16-7] 真实化改写:
 *   - 读写走统一 client (distApi / hl7Api), 失败回退演示数据并标记 source:'demo'
 *   - 消除 4 处伪造: 回执签名验证永真 / 撤销链接永真 / 硬编码 HL7 PID / MLLP 永返 AA
 *   - 后端无对应端点的能力 (回执验签 / 链接撤销 / 策略 / 患者端视图) 显式标注 not_implemented 或 demo
 */
import QRCode from "qrcode";
import type {
  DeliveryChannel,
  DeliveryChannelConfig,
  DeliveryTask,
  DeliveryStatus,
  DeliveryQueue,
  DeliveryReceipt,
  DeliveryEvent,
  DeliveryHistoryFilter,
  PatientPortalLink,
  PatientPortalStatus,
  PatientReportView,
  PatientPortalLang,
  DeliveryPolicy,
  DeliveryKpi,
  DeliveryMonitor,
  DeliveryError,
  ReceiptSignatureVerification,
} from "../../types/R3/R3.DIST";
import {
  DELIVERY_CHANNELS_CONFIG,
  DELIVERY_TASKS_MOCK,
  DELIVERY_QUEUE_MOCK,
  DELIVERY_KPI_HISTORY,
  DELIVERY_MONITOR_MOCK,
  DELIVERY_RECEIPTS_MOCK,
  DELIVERY_POLICIES_MOCK,
  PATIENT_PORTAL_LINKS_MOCK,
  PATIENT_REPORT_VIEWS_MOCK,
  DELIVERY_ERROR_CODES,
} from "../../data/reportDistributionMock";
import { distApi } from "../api/distApi";
import { hl7Api, type Hl7Report } from "../api/integrationApi";
import { reportApi } from "../api/reportApi";
import type { ApiResponse } from "../api/types";

const CHANNEL_ALIASES: Record<string, DeliveryChannel> = {
  wechat: "wechat",
  sms: "sms",
  dingtalk: "dingtalk",
  email: "email",
  inapp: "inApp",
  inApp: "inApp",
  dicom: "dicom",
  paper: "paper",
  print: "paper",
  cloud: "cloud",
  film: "film",
};

function normalizeChannel(raw: string | undefined): DeliveryChannel {
  if (!raw) return "inApp";
  return CHANNEL_ALIASES[raw] ?? CHANNEL_ALIASES[raw.toLowerCase()] ?? "inApp";
}

function normalizeStatus(raw: string | undefined): DeliveryStatus {
  const s = (raw ?? "").toLowerCase();
  const allowed: DeliveryStatus[] = [
    "pending",
    "queued",
    "sending",
    "sent",
    "delivered",
    "read",
    "failed",
    "cancelled",
    "expired",
  ];
  return (allowed as string[]).includes(s) ? (s as DeliveryStatus) : "pending";
}

/** 兼容 MSW 裸数组 与 后端 { data: [...] } / { data, meta } 包装 */
function unwrapArray<T>(res: ApiResponse<unknown>): T[] {
  const raw = res.data as unknown;
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

function unwrapObject<T>(res: ApiResponse<unknown>): T | null {
  const raw = res.data as unknown;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object") return obj.data as T;
  return raw as T;
}

function mapDistTask(
  d: {
    id: string;
    reportId: string;
    channel: string;
    target?: string;
    recipient?: string | null;
    status: string;
    error?: string | null;
    retryCount?: number;
    sentAt?: string | null;
    createdAt?: string;
  },
  source: "live" | "demo",
): DeliveryTask {
  return {
    id: d.id,
    reportId: d.reportId,
    patientId: "",
    patientName: d.recipient ?? d.target ?? "患者",
    channel: normalizeChannel(d.channel),
    recipient: d.recipient ?? d.target ?? "",
    template: "",
    subject: "",
    body: "",
    attachments: [],
    status: normalizeStatus(d.status),
    priority: "normal",
    retryCount: d.retryCount ?? 0,
    maxRetries: 3,
    sentAt: d.sentAt ?? undefined,
    errorMessage: d.error ?? undefined,
    durationMs: 0,
    cost: 0,
    traceId: d.id,
    ackReceived: false,
    metadata: {},
    source,
  };
}

// ============================================================
// 1. 通道配置
// ============================================================
export async function listChannels(): Promise<DeliveryChannelConfig[]> {
  try {
    const res = await distApi.listChannels();
    if (!res.success) throw new Error(res.error?.message ?? "获取渠道失败");
    const live = unwrapArray<{
      id: string;
      name: string;
      type: string;
      status: string;
      taskCount?: number;
    }>(res);
    const byChannel = new Map<DeliveryChannel, { status: string }>();
    for (const c of live) byChannel.set(normalizeChannel(c.id || c.type), c);
    return DELIVERY_CHANNELS_CONFIG.map((cfg) => {
      const liveCfg = byChannel.get(cfg.channel);
      if (!liveCfg) return { ...cfg, source: "demo" as const };
      const enabled = liveCfg.status
        ? liveCfg.status === "active"
        : cfg.enabled;
      return { ...cfg, enabled, source: "live" as const };
    });
  } catch {
    return DELIVERY_CHANNELS_CONFIG.map((c) => ({
      ...c,
      source: "demo" as const,
    }));
  }
}

export async function getChannelConfig(
  channel: DeliveryChannel,
): Promise<DeliveryChannelConfig | null> {
  const all = await listChannels();
  return all.find((c) => c.channel === channel) ?? null;
}

export async function updateChannelConfig(
  channel: DeliveryChannel,
  patch: Partial<DeliveryChannelConfig>,
): Promise<DeliveryChannelConfig | null> {
  // 后端无 PUT /dist/channels/:channel 端点 -> 演示态本地更新 (显式标记 demo, 不落库)
  const idx = DELIVERY_CHANNELS_CONFIG.findIndex((c) => c.channel === channel);
  if (idx < 0) return null;
  Object.assign(DELIVERY_CHANNELS_CONFIG[idx]!, patch);
  return { ...DELIVERY_CHANNELS_CONFIG[idx]!, source: "demo" };
}

// ============================================================
// 2. 推送任务
// ============================================================
export async function listDeliveryTasks(
  filter: DeliveryHistoryFilter = {},
): Promise<DeliveryTask[]> {
  let tasks: DeliveryTask[];
  try {
    const res = await distApi.listTasks({
      status: filter.status,
      channel: filter.channel,
      reportId: filter.reportId,
    });
    if (!res.success) throw new Error(res.error?.message ?? "获取分发任务失败");
    tasks = unwrapArray<Parameters<typeof mapDistTask>[0]>(res).map((d) =>
      mapDistTask(d, "live"),
    );
  } catch {
    tasks = DELIVERY_TASKS_MOCK.map((t) => ({ ...t, source: "demo" as const }));
  }
  return tasks.filter((t) => {
    if (filter.channel && t.channel !== filter.channel) return false;
    if (filter.status && t.status !== filter.status) return false;
    if (filter.reportId && t.reportId !== filter.reportId) return false;
    if (filter.patientId && t.patientId !== filter.patientId) return false;
    if (filter.recipient && !t.recipient.includes(filter.recipient))
      return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (
        !t.recipient.toLowerCase().includes(q) &&
        !t.patientName.toLowerCase().includes(q) &&
        !t.reportId.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}

export async function getDeliveryQueue(): Promise<DeliveryQueue> {
  // 后端无独立队列端点 -> 从任务列表推导, 推导失败回退演示队列
  try {
    const tasks = await listDeliveryTasks();
    if (tasks.length === 0) throw new Error("empty");
    const count = (s: DeliveryStatus) =>
      tasks.filter((t) => t.status === s).length;
    const delivered = count("delivered") + count("read");
    const byChannel = {} as DeliveryQueue["byChannel"];
    for (const c of DELIVERY_CHANNELS_CONFIG) {
      const list = tasks.filter((t) => t.channel === c.channel);
      const done = list.filter(
        (t) =>
          t.status === "delivered" ||
          t.status === "read" ||
          t.status === "sent",
      ).length;
      byChannel[c.channel] = {
        queued: list.filter(
          (t) => t.status === "queued" || t.status === "pending",
        ).length,
        sent: list.filter((t) => t.status === "sent").length,
        failed: list.filter((t) => t.status === "failed").length,
        successRate: list.length > 0 ? done / list.length : 0,
      };
    }
    return {
      pending: count("pending"),
      sending: count("sending"),
      failed: count("failed"),
      delivered,
      read: count("read"),
      totalToday: tasks.length,
      successRate: tasks.length > 0 ? delivered / tasks.length : 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      byChannel,
      source: "live",
    };
  } catch {
    return { ...DELIVERY_QUEUE_MOCK, source: "demo" };
  }
}

export async function getDeliveryTask(
  id: string,
): Promise<DeliveryTask | null> {
  try {
    const res = await distApi.getTask(id);
    if (!res.success) throw new Error(res.error?.message ?? "获取任务失败");
    const dto = unwrapObject<Parameters<typeof mapDistTask>[0]>(res);
    return dto ? mapDistTask(dto, "live") : null;
  } catch {
    const demo = DELIVERY_TASKS_MOCK.find((t) => t.id === id) ?? null;
    return demo ? { ...demo, source: "demo" } : null;
  }
}

export async function retryDeliveryTask(
  id: string,
): Promise<{
  success: boolean;
  newStatus: DeliveryStatus;
  retriedAt: string;
  error?: string;
}> {
  const retriedAt = new Date().toISOString();
  const res = await distApi.retryTask(id);
  if (!res.success) {
    return {
      success: false,
      newStatus: "failed",
      retriedAt,
      error: res.error?.message ?? "重试失败",
    };
  }
  return { success: true, newStatus: "queued", retriedAt };
}

export async function cancelDeliveryTask(
  _id: string,
  _reason: string,
): Promise<{ success: boolean; cancelledAt: string; reason?: string }> {
  // 后端无取消分发任务端点 -> 明确失败, 绝不伪造成功
  return {
    success: false,
    cancelledAt: new Date().toISOString(),
    reason: "not_implemented",
  };
}

export async function createDeliveryTask(input: {
  reportId: string;
  patientId: string;
  channel: DeliveryChannel;
  recipient: string;
  template: string;
  priority?: DeliveryTask["priority"];
}): Promise<DeliveryTask> {
  const res = await distApi.createTask({
    reportId: input.reportId,
    channel: input.channel,
    target: input.recipient,
    recipient: input.recipient,
  });
  if (!res.success) throw new Error(res.error?.message ?? "创建分发任务失败");
  const dto = unwrapObject<Parameters<typeof mapDistTask>[0]>(res);
  if (!dto) throw new Error("创建分发任务失败: 响应为空");
  const task = mapDistTask(dto, "live");
  task.patientId = input.patientId;
  task.template = input.template;
  task.priority = input.priority ?? "normal";
  return task;
}

export async function sendMultiChannel(input: {
  reportId: string;
  patientId: string;
  channels: DeliveryChannel[];
  recipients: string[];
}): Promise<{ taskIds: string[]; sent: number; failed: number }> {
  const results = await Promise.allSettled(
    input.channels.map((channel, i) =>
      createDeliveryTask({
        reportId: input.reportId,
        patientId: input.patientId,
        channel,
        recipient: input.recipients[i] ?? "",
        template: "standard-v1",
      }),
    ),
  );
  const taskIds: string[] = results.map((r) =>
    r.status === "fulfilled" ? r.value.id : "",
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { taskIds, sent, failed: input.channels.length - sent };
}

// ============================================================
// 3. 送达回执
// ============================================================
export async function listDeliveryReceipts(
  reportId?: string,
): Promise<DeliveryReceipt[]> {
  // 后端无 /dist/receipts 端点 -> 演示数据, 显式标记 demo
  const list = reportId
    ? DELIVERY_RECEIPTS_MOCK.filter((r) => r.reportId === reportId)
    : DELIVERY_RECEIPTS_MOCK;
  return list.map((r) => ({ ...r, source: "demo" as const }));
}

export async function getDeliveryReceipt(
  taskId: string,
): Promise<DeliveryReceipt | null> {
  const demo = DELIVERY_RECEIPTS_MOCK.find((r) => r.taskId === taskId) ?? null;
  return demo ? { ...demo, source: "demo" } : null;
}

export async function addDeliveryEvent(
  taskId: string,
  event: Omit<DeliveryEvent, "id" | "taskId">,
): Promise<DeliveryEvent> {
  return { ...event, id: `e-${Date.now()}`, taskId };
}

export async function verifyReceiptSignature(
  taskId: string,
): Promise<ReceiptSignatureVerification> {
  // [v3.0.6.16-7] 后端无回执签名验证端点 -> 不得伪造 verified:true
  return {
    verified: false,
    details: `无法验证回执 ${taskId} 的签名: 后端未提供回执签名验证接口`,
    reason: "not_implemented",
    source: "demo",
  };
}

// ============================================================
// 4. 患者端
// ============================================================
export async function listPatientLinks(
  status?: PatientPortalStatus,
): Promise<PatientPortalLink[]> {
  const list = status
    ? PATIENT_PORTAL_LINKS_MOCK.filter((l) => l.status === status)
    : PATIENT_PORTAL_LINKS_MOCK;
  return list.map((l) => ({ ...l, source: "demo" as const }));
}

export async function getPatientLink(
  id: string,
): Promise<PatientPortalLink | null> {
  const demo = PATIENT_PORTAL_LINKS_MOCK.find((l) => l.id === id) ?? null;
  return demo ? { ...demo, source: "demo" } : null;
}

export async function createPatientLink(input: {
  reportId: string;
  patientId: string;
  language: PatientPortalLang;
  expireDays: number;
  requirePhone: boolean;
  requireIdCard: boolean;
  channels: DeliveryChannel[];
  watermark: string;
}): Promise<PatientPortalLink> {
  // 后端无患者端链接端点 -> 演示态本地生成; 短链确定化 + 真实二维码 (非 data:... 占位)
  const now = new Date();
  const expires = new Date(now.getTime() + input.expireDays * 86400000);
  const shortCode =
    `${input.reportId}${input.patientId}`
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(-8)
      .toUpperCase() || `PL${now.getTime().toString(36).toUpperCase()}`;
  const shortUrl = `https://r.hospital.cn/r/${shortCode}`;
  let qrCode: string;
  try {
    qrCode = await QRCode.toDataURL(shortUrl, {
      width: 192,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    qrCode = "";
  }
  return {
    id: `pl-${now.getTime()}`,
    reportId: input.reportId,
    patientId: input.patientId,
    shortCode,
    shortUrl,
    qrCode,
    language: input.language,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    maxViews: 5,
    viewCount: 0,
    watermark: input.watermark,
    requirePhone: input.requirePhone,
    requireIdCard: input.requireIdCard,
    channels: input.channels,
    notifyOnView: true,
    source: "demo",
  };
}

export async function revokePatientLink(
  _id: string,
): Promise<{ success: boolean; reason?: string }> {
  // [v3.0.6.16-7] 后端无撤销端点 -> 明确失败, 绝不伪造 {success:true}
  return { success: false, reason: "not_implemented" };
}

export async function listPatientViews(
  linkId: string,
): Promise<PatientReportView[]> {
  return PATIENT_REPORT_VIEWS_MOCK.filter((v) => v.linkId === linkId).map(
    (v) => ({ ...v, source: "demo" as const }),
  );
}

// ============================================================
// 5. 监控 / 策略 / KPI
// ============================================================
export async function getDeliveryMonitor(): Promise<DeliveryMonitor> {
  return { ...DELIVERY_MONITOR_MOCK, source: "demo" };
}

export async function getDeliveryKpi(days = 30): Promise<DeliveryKpi[]> {
  return DELIVERY_KPI_HISTORY.slice(0, days).map((k) => ({
    ...k,
    source: "demo" as const,
  }));
}

export async function listDeliveryPolicies(): Promise<DeliveryPolicy[]> {
  return DELIVERY_POLICIES_MOCK.map((p) => ({ ...p, source: "demo" as const }));
}

export async function getDeliveryPolicy(
  id: string,
): Promise<DeliveryPolicy | null> {
  const demo = DELIVERY_POLICIES_MOCK.find((p) => p.id === id) ?? null;
  return demo ? { ...demo, source: "demo" } : null;
}

export async function upsertDeliveryPolicy(
  policy: DeliveryPolicy,
): Promise<DeliveryPolicy> {
  const idx = DELIVERY_POLICIES_MOCK.findIndex((p) => p.id === policy.id);
  if (idx >= 0) DELIVERY_POLICIES_MOCK[idx] = policy;
  else DELIVERY_POLICIES_MOCK.push(policy);
  return { ...policy, source: "demo" };
}

export async function getDeliveryError(
  code: keyof typeof DELIVERY_ERROR_CODES,
): Promise<DeliveryError> {
  return DELIVERY_ERROR_CODES[code];
}

// ============================================================
// 6. HL7 ORU^R01 / MLLP
// ============================================================
export async function buildHL7ORU(reportId: string): Promise<string> {
  // [v3.0.6.16-7] 由真实报告构建 ORU, 不再硬编码患者 (张三/右肺上叶周围型肺癌)
  const res = await reportApi.getById(reportId);
  if (!res.success || !res.data) {
    throw new Error(
      `无法构建 HL7 ORU: 报告 ${reportId} 不存在 (${res.error?.message ?? "未知错误"})`,
    );
  }
  const r = res.data;
  const created = r.createdTime ? new Date(r.createdTime) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const build: Hl7Report = {
    accessionNumber: r.examId ?? r.reportId ?? reportId,
    patientName: r.patientName ?? "",
    patientId: r.patientId ?? "",
    patientSex: "",
    modality: r.modality ?? "",
    studyDate: Number.isNaN(created.getTime())
      ? ""
      : `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())}`,
    studyTime: Number.isNaN(created.getTime())
      ? ""
      : `${pad(created.getHours())}:${pad(created.getMinutes())}:${pad(created.getSeconds())}`,
    findings: r.findings ?? "",
    conclusion: r.impression ?? r.diagnosis ?? "",
    authorName: r.doctorId ?? "",
    authorId: r.doctorId ?? "",
    reportId,
  };
  const oru = await hl7Api.buildOru(build);
  if (!oru.success || !oru.data?.message) {
    throw new Error(
      `构建 HL7 ORU 失败: ${oru.error?.message ?? "后端未返回消息"}`,
    );
  }
  return oru.data.message;
}

export async function sendViaMLLP(
  _message: string,
  _host: string,
  _port: number,
): Promise<{
  ack: "AA" | "AE" | "AR";
  ackMessage: string;
  durationMs: number;
  implemented?: boolean;
}> {
  // [v3.0.6.16-7] 后端无"原始报文 MLLP 发送"端点 -> 返回 AE 失败, 绝不伪造 AA
  return {
    ack: "AE",
    ackMessage:
      "MLLP 直连发送未实现: 后端未提供原始 HL7 报文发送端点 (请使用 /hl7/oru/publish 按报告投递)",
    durationMs: 0,
    implemented: false,
  };
}

// ============================================================
// 7. 二维码 (确定性短链, 非占位)
// ============================================================
export function buildReportQRCode(reportId: string, patientId: string): string {
  const code = `${reportId}${patientId}`
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase();
  return `https://r.hospital.cn/r/${code || reportId}`;
}

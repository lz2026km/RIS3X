/**
 * G005 放射RIS系统 v3.0.5.1 - R3.DIST 分发模块 Service
 * 多通道送达(微信/短信/钉钉/邮件) / 送达回执 / 患者端
 */

import type {
  DeliveryChannel, DeliveryChannelConfig, DeliveryTask, DeliveryStatus,
  DeliveryQueue, DeliveryReceipt, DeliveryEvent, DeliveryHistoryFilter,
  PatientPortalLink, PatientPortalStatus, PatientReportView, PatientPortalLang,
  DeliveryPolicy, DeliveryKpi, DeliveryMonitor, DeliveryError,
} from '../../types/R3/R3.DIST';
import {
  DELIVERY_CHANNELS_CONFIG, DELIVERY_TASKS_MOCK, DELIVERY_QUEUE_MOCK, DELIVERY_KPI_HISTORY,
  DELIVERY_MONITOR_MOCK, DELIVERY_RECEIPTS_MOCK, DELIVERY_POLICIES_MOCK,
  PATIENT_PORTAL_LINKS_MOCK, PATIENT_REPORT_VIEWS_MOCK, DELIVERY_ERROR_CODES,
} from '../../data/reportDistributionMock';

const SIM_LATENCY_MS = 100;

// ============================================================
// 1. 通道配置
// ============================================================
export async function listChannels(): Promise<DeliveryChannelConfig[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_CHANNELS_CONFIG;
}

export async function getChannelConfig(channel: DeliveryChannel): Promise<DeliveryChannelConfig | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_CHANNELS_CONFIG.find((c) => c.channel === channel) ?? null;
}

export async function updateChannelConfig(channel: DeliveryChannel, patch: Partial<DeliveryChannelConfig>): Promise<DeliveryChannelConfig | null> {
  await new Promise((r) => setTimeout(r, 200));
  const idx = DELIVERY_CHANNELS_CONFIG.findIndex((c) => c.channel === channel);
  if (idx < 0) return null;
  Object.assign(DELIVERY_CHANNELS_CONFIG[idx]!, patch);
  return DELIVERY_CHANNELS_CONFIG[idx]!;
}

// ============================================================
// 2. 推送任务
// ============================================================
export async function listDeliveryTasks(filter: DeliveryHistoryFilter = {}): Promise<DeliveryTask[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_TASKS_MOCK.filter((t) => {
    if (filter.channel && t.channel !== filter.channel) return false;
    if (filter.status && t.status !== filter.status) return false;
    if (filter.reportId && t.reportId !== filter.reportId) return false;
    if (filter.patientId && t.patientId !== filter.patientId) return false;
    if (filter.recipient && !t.recipient.includes(filter.recipient)) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!t.recipient.toLowerCase().includes(q) && !t.patientName.toLowerCase().includes(q) && !t.reportId.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export async function getDeliveryQueue(): Promise<DeliveryQueue> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_QUEUE_MOCK;
}

export async function getDeliveryTask(id: string): Promise<DeliveryTask | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_TASKS_MOCK.find((t) => t.id === id) ?? null;
}

export async function retryDeliveryTask(id: string): Promise<{ success: boolean; newStatus: DeliveryStatus; retriedAt: string }> {
  await new Promise((r) => setTimeout(r, 500));
  return { success: true, newStatus: 'queued', retriedAt: new Date().toISOString() };
}

export async function cancelDeliveryTask(id: string, reason: string): Promise<{ success: boolean; cancelledAt: string }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true, cancelledAt: new Date().toISOString() };
}

export async function createDeliveryTask(input: { reportId: string; patientId: string; channel: DeliveryChannel; recipient: string; template: string; priority?: DeliveryTask['priority'] }): Promise<DeliveryTask> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    id: `dt-${Date.now()}`,
    reportId: input.reportId, patientId: input.patientId, patientName: '患者',
    channel: input.channel, recipient: input.recipient,
    template: input.template, subject: '通知', body: '内容',
    attachments: [],
    status: 'queued', priority: input.priority ?? 'normal', retryCount: 0, maxRetries: 3,
    durationMs: 0, cost: 0, traceId: `trace-${Date.now()}`, ackReceived: false, metadata: {},
  };
}

export async function sendMultiChannel(input: { reportId: string; patientId: string; channels: DeliveryChannel[]; recipients: string[] }): Promise<{ taskIds: string[]; sent: number; failed: number }> {
  await new Promise((r) => setTimeout(r, 1000));
  const taskIds = input.channels.map((_, i) => `dt-multi-${Date.now()}-${i}`);
  return { taskIds, sent: input.channels.length, failed: 0 };
}

// ============================================================
// 3. 送达回执
// ============================================================
export async function listDeliveryReceipts(reportId?: string): Promise<DeliveryReceipt[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return reportId ? DELIVERY_RECEIPTS_MOCK.filter((r) => r.reportId === reportId) : DELIVERY_RECEIPTS_MOCK;
}

export async function getDeliveryReceipt(taskId: string): Promise<DeliveryReceipt | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_RECEIPTS_MOCK.find((r) => r.taskId === taskId) ?? null;
}

export async function addDeliveryEvent(taskId: string, event: Omit<DeliveryEvent, 'id' | 'taskId'>): Promise<DeliveryEvent> {
  await new Promise((r) => setTimeout(r, 50));
  return { ...event, id: `e-${Date.now()}`, taskId };
}

export async function verifyReceiptSignature(taskId: string): Promise<{ verified: boolean; details: string }> {
  await new Promise((r) => setTimeout(r, 200));
  return { verified: true, details: 'SHA-256 签名验证通过' };
}

// ============================================================
// 4. 患者端
// ============================================================
export async function listPatientLinks(status?: PatientPortalStatus): Promise<PatientPortalLink[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return status ? PATIENT_PORTAL_LINKS_MOCK.filter((l) => l.status === status) : PATIENT_PORTAL_LINKS_MOCK;
}

export async function getPatientLink(id: string): Promise<PatientPortalLink | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return PATIENT_PORTAL_LINKS_MOCK.find((l) => l.id === id) ?? null;
}

export async function createPatientLink(input: { reportId: string; patientId: string; language: PatientPortalLang; expireDays: number; requirePhone: boolean; requireIdCard: boolean; channels: DeliveryChannel[]; watermark: string }): Promise<PatientPortalLink> {
  await new Promise((r) => setTimeout(r, 300));
  const now = new Date();
  const expires = new Date(now.getTime() + input.expireDays * 86400000);
  return {
    id: `pl-${Date.now()}`,
    reportId: input.reportId, patientId: input.patientId,
    shortCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    shortUrl: `https://r.hospital.cn/r/${Math.random().toString(36).slice(2, 8)}`,
    qrCode: 'data:image/png;base64,...',
    language: input.language, status: 'active',
    createdAt: now.toISOString(), expiresAt: expires.toISOString(),
    maxViews: 5, viewCount: 0,
    watermark: input.watermark,
    requirePhone: input.requirePhone, requireIdCard: input.requireIdCard,
    channels: input.channels, notifyOnView: true,
  };
}

export async function revokePatientLink(id: string): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 200));
  return { success: true };
}

export async function listPatientViews(linkId: string): Promise<PatientReportView[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return PATIENT_REPORT_VIEWS_MOCK.filter((v) => v.linkId === linkId);
}

// ============================================================
// 5. 监控 / 策略 / KPI
// ============================================================
export async function getDeliveryMonitor(): Promise<DeliveryMonitor> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_MONITOR_MOCK;
}

export async function getDeliveryKpi(days = 30): Promise<DeliveryKpi[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_KPI_HISTORY.slice(0, days);
}

export async function listDeliveryPolicies(): Promise<DeliveryPolicy[]> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_POLICIES_MOCK;
}

export async function getDeliveryPolicy(id: string): Promise<DeliveryPolicy | null> {
  await new Promise((r) => setTimeout(r, SIM_LATENCY_MS));
  return DELIVERY_POLICIES_MOCK.find((p) => p.id === id) ?? null;
}

export async function upsertDeliveryPolicy(policy: DeliveryPolicy): Promise<DeliveryPolicy> {
  await new Promise((r) => setTimeout(r, 200));
  const idx = DELIVERY_POLICIES_MOCK.findIndex((p) => p.id === policy.id);
  if (idx >= 0) DELIVERY_POLICIES_MOCK[idx] = policy;
  else DELIVERY_POLICIES_MOCK.push(policy);
  return policy;
}

export async function getDeliveryError(code: keyof typeof DELIVERY_ERROR_CODES): Promise<DeliveryError> {
  await new Promise((r) => setTimeout(r, 30));
  return DELIVERY_ERROR_CODES[code];
}

// ============================================================
// 6. HL7 ORU^R01 / MLLP 模拟
// ============================================================
export async function buildHL7ORU(reportId: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 200));
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12);
  return [
    `MSH|^~\\&|G005-RIS|G005|RECEIVER|FACILITY|${ts}||ORU^R01|${reportId}|P|2.5`,
    `PID|1||p-038^^^HOSPITAL^MR||张三||19680101|M`,
    `OBR|1|||CT^胸部 CT 增强^L|||20260915100000|||||||||陈医师`,
    `OBX|1|TX|11502-2^Lab report^LN||右肺上叶周围型肺癌可能性大,建议穿刺活检。||||||F|||20260915110000`,
  ].join('\r');
}

export async function sendViaMLLP(message: string, host: string, port: number): Promise<{ ack: 'AA' | 'AE' | 'AR'; ackMessage: string; durationMs: number }> {
  await new Promise((r) => setTimeout(r, 500));
  return { ack: 'AA', ackMessage: 'Message accepted', durationMs: 450 };
}

// ============================================================
// 7. 二维码生成占位
// ============================================================
export function buildReportQRCode(reportId: string, patientId: string): string {
  return `https://r.hospital.cn/r/${reportId}/${patientId}`;
}

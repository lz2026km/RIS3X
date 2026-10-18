/**
 * G005 放射RIS系统 v3.0.5.1 - R3.DIST 分发模块类型定义
 * A5-REPORT 报告子系统 50 升级点
 *
 * 状态机路径:published -> HL7 ORU^R01 / DICOM SR / FHIR DiagnosticReport
 * 涵盖多通道送达(微信/短信/钉钉/邮件)、送达回执、患者端
 */

// ---------- 1. 通道 ----------
export type DeliveryChannel =
  | "wechat"
  | "sms"
  | "dingtalk"
  | "email"
  | "inApp"
  | "dicom"
  | "paper"
  | "cloud"
  | "film";

export type DeliveryStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled"
  | "expired";

export interface DeliveryChannelConfig {
  channel: DeliveryChannel;
  enabled: boolean;
  displayName: string;
  displayNameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  color: string;
  bg: string;
  host?: string;
  port?: number;
  template: string;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    backoffStrategy: "fixed" | "exponential";
  };
  rateLimitPerMin: number;
  requireAck: boolean;
  ackTimeoutSec: number;
  supportedFormats: (
    "pdf" | "html" | "text" | "dicom-sr" | "fhir-json" | "hl7"
  )[];
  credentialConfigured: boolean;
  // [v3.0.6.16-7] 数据来源 (additive): 'live' = 后端真实返回, 'demo' = 接口失败回退演示数据
  source?: "live" | "demo";
}

// ---------- 2. 推送任务 ----------
export interface DeliveryTask {
  id: string;
  reportId: string;
  patientId: string;
  patientName: string;
  channel: DeliveryChannel;
  recipient: string;
  recipientName?: string;
  recipientRole?: string;
  template: string;
  subject: string;
  body: string;
  attachments: { name: string; size: number; format: string; url: string }[];
  status: DeliveryStatus;
  priority: "low" | "normal" | "high" | "urgent";
  retryCount: number;
  maxRetries: number;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
  cost: number;
  externalId?: string;
  traceId: string;
  ackReceived: boolean;
  ackCode?: "AA" | "AE" | "AR";
  ackMessage?: string;
  metadata: Record<string, string>;
  source?: "live" | "demo";
}

// ---------- 3. 队列 / 历史 ----------
export interface DeliveryQueue {
  pending: number;
  sending: number;
  failed: number;
  delivered: number;
  read: number;
  totalToday: number;
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  byChannel: Record<
    DeliveryChannel,
    { queued: number; sent: number; failed: number; successRate: number }
  >;
  source?: "live" | "demo";
}

export interface DeliveryHistoryFilter {
  channel?: DeliveryChannel;
  status?: DeliveryStatus;
  dateFrom?: string;
  dateTo?: string;
  patientId?: string;
  reportId?: string;
  recipient?: string;
  search?: string;
}

// ---------- 4. 送达回执 ----------
export interface DeliveryReceipt {
  id: string;
  taskId: string;
  reportId: string;
  channel: DeliveryChannel;
  recipient: string;
  recipientName?: string;
  status: DeliveryStatus;
  statusLabel: string;
  statusLabelEn: string;
  events: DeliveryEvent[];
  retryCount: number;
  finalAt: string;
  cost: number;
  throughputKb: number;
  signature?: string;
  verified: boolean;
  source?: "live" | "demo";
}
export interface DeliveryEvent {
  id: string;
  taskId: string;
  type:
    | "created"
    | "queued"
    | "sending"
    | "sent"
    | "delivered"
    | "read"
    | "failed"
    | "retry"
    | "cancelled"
    | "expired";
  occurredAt: string;
  operator?: string;
  detail: string;
  detailEn: string;
  code?: string;
  source: "system" | "user" | "remote" | "webhook";
  payload?: Record<string, unknown>;
}

// 回执签名验证结果 (additive: reason 说明为何无法验证)
export interface ReceiptSignatureVerification {
  verified: boolean;
  details: string;
  reason?: "not_implemented" | string;
  source?: "live" | "demo";
}

// ---------- 5. 患者端 ----------
export type PatientPortalLang = "zh-CN" | "en-US";
export type PatientPortalStatus = "active" | "expired" | "revoked" | "viewed";

export interface PatientPortalLink {
  id: string;
  reportId: string;
  patientId: string;
  shortCode: string;
  shortUrl: string;
  qrCode: string;
  language: PatientPortalLang;
  status: PatientPortalStatus;
  createdAt: string;
  expiresAt: string;
  maxViews: number;
  viewCount: number;
  lastViewedAt?: string;
  lastViewedIp?: string;
  watermark: string;
  requirePhone: boolean;
  requireIdCard: boolean;
  channels: DeliveryChannel[];
  notifyOnView: boolean;
  source?: "live" | "demo";
}

export interface PatientReportView {
  id: string;
  linkId: string;
  reportId: string;
  patientId: string;
  viewedAt: string;
  ip: string;
  device: "mobile" | "tablet" | "desktop";
  userAgent: string;
  durationSec: number;
  pageCount: number;
  language: PatientPortalLang;
  source?: "live" | "demo";
}

// ---------- 6. 监控 / 策略 / KPI ----------
export interface DeliveryPolicy {
  id: string;
  name: string;
  nameEn: string;
  modality: string[];
  priority: ("low" | "normal" | "high" | "urgent")[];
  channels: DeliveryChannel[];
  template: string;
  enabled: boolean;
  retryOnFail: boolean;
  requirePatientConsent: boolean;
  scheduleCron?: string;
  dndStartHour?: number;
  dndEndHour?: number;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  source?: "live" | "demo";
}

export interface DeliveryKpi {
  date: string;
  total: number;
  delivered: number;
  read: number;
  failed: number;
  successRate: number;
  onTimeRate: number;
  avgDurationMs: number;
  byChannel: Record<
    DeliveryChannel,
    { count: number; successRate: number; avgDurationMs: number }
  >;
  source?: "live" | "demo";
}

export interface DeliveryMonitor {
  online: boolean;
  workers: number;
  queueDepth: number;
  processing: number;
  lagSec: number;
  errorRate: number;
  lastHeartbeat: string;
  alerts: {
    id: string;
    severity: "info" | "warn" | "error" | "critical";
    message: string;
    messageEn: string;
    raisedAt: string;
  }[];
  source?: "live" | "demo";
}

// ---------- 7. 错误码 ----------
export type DeliveryErrorCode =
  | "INVALID_RECIPIENT"
  | "RATE_LIMITED"
  | "TEMPLATE_NOT_FOUND"
  | "CHANNEL_DISABLED"
  | "AUTH_FAILED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "CONTENT_REJECTED"
  | "POLICY_VIOLATION"
  | "QUOTA_EXCEEDED"
  | "EXTERNAL_ERROR"
  | "UNKNOWN";

export interface DeliveryError {
  code: DeliveryErrorCode;
  message: string;
  messageEn: string;
  retryable: boolean;
  suggestion: string;
  suggestionEn: string;
}

// ---------- 8. 单元测试桩 ----------
export type DeliveryTestId = "D001" | "D015" | "D025" | "D035" | "D050";

export const DELIVERY_CHANNELS: DeliveryChannel[] = [
  "wechat",
  "sms",
  "dingtalk",
  "email",
  "inApp",
  "dicom",
  "paper",
  "cloud",
  "film",
];
export const DELIVERY_STATUSES: DeliveryStatus[] = [
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

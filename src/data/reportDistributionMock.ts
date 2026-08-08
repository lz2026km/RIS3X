/**
 * G005 放射RIS系统 v3.0.5.1 - R3.DIST 分发模块 Mock 数据
 * 50 升级点 mock:多通道送达 / 送达回执 / 患者端
 */

import type {
  DeliveryChannel, DeliveryChannelConfig, DeliveryTask,
  DeliveryQueue, DeliveryStatus, DeliveryReceipt, DeliveryEvent,
  PatientPortalLink, PatientReportView, PatientPortalStatus,
  DeliveryPolicy, DeliveryKpi, DeliveryMonitor, DeliveryErrorCode, DeliveryError,
} from '../types/R3/R3.DIST';

// ============================================================
// 1. 通道配置
// ============================================================
export const DELIVERY_CHANNELS_CONFIG: DeliveryChannelConfig[] = [
  {
    channel: 'wechat', enabled: true,
    displayName: '微信公众号', displayNameEn: 'WeChat',
    description: '微信公众号/小程序推送,支持图文卡片 + 报告链接',
    descriptionEn: 'WeChat OA/miniapp push, supports image+text + report link',
    icon: 'MessageSquare', color: '#07c160', bg: '#e6f9ed',
    host: 'api.weixin.qq.com', port: 443,
    template: 'tpl-medical-report-v2',
    retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffStrategy: 'exponential' },
    rateLimitPerMin: 60, requireAck: true, ackTimeoutSec: 60,
    supportedFormats: ['pdf', 'html', 'text'], credentialConfigured: true,
  },
  {
    channel: 'sms', enabled: true,
    displayName: '短信', displayNameEn: 'SMS',
    description: '短信推送(包含报告短链),适用于所有手机',
    descriptionEn: 'SMS push with short link, suitable for all phones',
    icon: 'Smartphone', color: '#3b82f6', bg: '#dbeafe',
    host: 'sms.provider.com', port: 443,
    template: 'sms-medical-v3',
    retryPolicy: { maxRetries: 3, backoffMs: 2000, backoffStrategy: 'exponential' },
    rateLimitPerMin: 100, requireAck: false, ackTimeoutSec: 0,
    supportedFormats: ['text'], credentialConfigured: true,
  },
  {
    channel: 'dingtalk', enabled: true,
    displayName: '钉钉', displayNameEn: 'DingTalk',
    description: '钉钉工作通知,推送给医生/护士',
    descriptionEn: 'DingTalk work notice to doctors/nurses',
    icon: 'Bell', color: '#2563eb', bg: '#e6f4ff',
    host: 'oapi.dingtalk.com', port: 443,
    template: 'msg_report_arrival',
    retryPolicy: { maxRetries: 3, backoffMs: 1500, backoffStrategy: 'exponential' },
    rateLimitPerMin: 80, requireAck: true, ackTimeoutSec: 120,
    supportedFormats: ['pdf', 'html', 'text'], credentialConfigured: true,
  },
  {
    channel: 'email', enabled: true,
    displayName: '邮件', displayNameEn: 'Email',
    description: 'SMTP 邮件,带 PDF 附件',
    descriptionEn: 'SMTP email with PDF attachment',
    icon: 'Mail', color: '#ea580c', bg: '#fed7aa',
    host: 'smtp.hospital.com', port: 465,
    template: 'email-medical-v2',
    retryPolicy: { maxRetries: 3, backoffMs: 2000, backoffStrategy: 'exponential' },
    rateLimitPerMin: 200, requireAck: false, ackTimeoutSec: 0,
    supportedFormats: ['pdf', 'html'], credentialConfigured: true,
  },
  {
    channel: 'inApp', enabled: true,
    displayName: '站内信', displayNameEn: 'In-App',
    description: '患者/医生 App 消息中心',
    descriptionEn: 'Patient/Doctor App message center',
    icon: 'Inbox', color: '#7c3aed', bg: '#ede9fe',
    template: 'inapp-arrival-v1',
    retryPolicy: { maxRetries: 2, backoffMs: 500, backoffStrategy: 'fixed' },
    rateLimitPerMin: 1000, requireAck: true, ackTimeoutSec: 30,
    supportedFormats: ['pdf', 'html', 'text'], credentialConfigured: true,
  },
  {
    channel: 'dicom', enabled: true,
    displayName: 'DICOM SR', displayNameEn: 'DICOM SR',
    description: 'DICOM C-STORE 推送到 PACS',
    descriptionEn: 'DICOM C-STORE push to PACS',
    icon: 'Database', color: '#0891b2', bg: '#cffafe',
    host: 'pacs.hospital.com', port: 11112,
    template: 'dicom-sr-tid-2000',
    retryPolicy: { maxRetries: 3, backoffMs: 5000, backoffStrategy: 'exponential' },
    rateLimitPerMin: 30, requireAck: true, ackTimeoutSec: 30,
    supportedFormats: ['dicom-sr'], credentialConfigured: true,
  },
  {
    channel: 'paper', enabled: true,
    displayName: '纸质打印', displayNameEn: 'Paper Print',
    description: '实体报告打印 + 病案室归档',
    descriptionEn: 'Paper printing + medical record archive',
    icon: 'Printer', color: '#475569', bg: '#f1f5f9',
    host: 'print-srv.hospital.com', port: 9100,
    template: 'paper-a4-standard',
    retryPolicy: { maxRetries: 2, backoffMs: 3000, backoffStrategy: 'fixed' },
    rateLimitPerMin: 30, requireAck: false, ackTimeoutSec: 0,
    supportedFormats: ['pdf'], credentialConfigured: true,
  },
  {
    channel: 'cloud', enabled: true,
    displayName: '云盘分享', displayNameEn: 'Cloud Share',
    description: 'OSS 短链分享 + 密码保护',
    descriptionEn: 'OSS short link with password protection',
    icon: 'Cloud', color: '#0ea5e9', bg: '#e0f2fe',
    host: 'oss.hospital.com', port: 443,
    template: 'cloud-report-share',
    retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffStrategy: 'exponential' },
    rateLimitPerMin: 60, requireAck: false, ackTimeoutSec: 0,
    supportedFormats: ['pdf', 'html'], credentialConfigured: true,
  },
  {
    channel: 'film', enabled: false,
    displayName: '胶片打印', displayNameEn: 'Film Print',
    description: 'DICOM 胶片打印',
    descriptionEn: 'DICOM film printing',
    icon: 'Film', color: '#059669', bg: '#d1fae5',
    host: 'film-srv.hospital.com', port: 9101,
    template: 'film-14x17',
    retryPolicy: { maxRetries: 2, backoffMs: 3000, backoffStrategy: 'fixed' },
    rateLimitPerMin: 15, requireAck: false, ackTimeoutSec: 0,
    supportedFormats: ['dicom-sr'], credentialConfigured: false,
  },
];

// ============================================================
// 2. 推送任务(60+)
// ============================================================
const RECIPIENTS = [
  { name: '李医生(主诊)', phone: '13800138001', email: 'li.dr@hospital.com', wechat: 'wx_doctor_li', dingtalk: 'ding_li' },
  { name: '王护士', phone: '13800138002', email: 'wang.ns@hospital.com', wechat: 'wx_ns_wang', dingtalk: 'ding_wang' },
  { name: '张主任', phone: '13800138003', email: 'zhang.dr@hospital.com', wechat: 'wx_dr_zhang', dingtalk: 'ding_zhang' },
  { name: '刘技师', phone: '13800138004', email: 'liu.tech@hospital.com', wechat: 'wx_tech_liu', dingtalk: 'ding_liu' },
  { name: '陈会诊医师', phone: '13800138005', email: 'chen.consult@hospital.com', wechat: 'wx_consult_chen', dingtalk: 'ding_chen' },
];

const CHANNELS_CYCLE: DeliveryChannel[] = ['wechat', 'sms', 'dingtalk', 'email', 'inApp', 'dicom', 'paper', 'cloud'];
const STATUSES_CYCLE: DeliveryStatus[] = ['delivered', 'delivered', 'read', 'pending', 'failed', 'sent', 'cancelled'];
const REPORT_IDS = Array.from({ length: 30 }, (_, i) => `rpt-${(38 + i).toString()}`);

export const DELIVERY_TASKS_MOCK: DeliveryTask[] = Array.from({ length: 60 }, (_, i) => {
  const channel = CHANNELS_CYCLE[i % CHANNELS_CYCLE.length] ?? 'inApp';
  const status = STATUSES_CYCLE[i % STATUSES_CYCLE.length] ?? 'pending';
  const recipient = RECIPIENTS[i % RECIPIENTS.length] ?? RECIPIENTS[0]!;
  const sentAt = new Date(Date.now() - i * 600000 - Math.random() * 600000).toISOString();
  const deliveredAt = status === 'delivered' || status === 'read' ? new Date(new Date(sentAt).getTime() + 5000).toISOString() : undefined;
  const readAt = status === 'read' ? new Date(new Date(sentAt).getTime() + 60000).toISOString() : undefined;
  const failedAt = status === 'failed' ? new Date(new Date(sentAt).getTime() + 3000).toISOString() : undefined;
  const ackReceived = status === 'delivered' || status === 'read';
  return {
    id: `dt-${(i + 1).toString().padStart(4, '0')}`,
    reportId: REPORT_IDS[i % REPORT_IDS.length] ?? 'rpt-038',
    patientId: `p-${(38 + i).toString()}`,
    patientName: `患者${(38 + i).toString()}`,
    channel,
    recipient: channel === 'wechat' ? recipient.wechat : channel === 'sms' ? recipient.phone : channel === 'email' ? recipient.email : channel === 'dingtalk' ? recipient.dingtalk : `inapp-${i}`,
    recipientName: recipient.name,
    recipientRole: channel === 'inApp' ? 'patient' : 'doctor',
    template: `${channel}-template-v1`,
    subject: `[${channel.toUpperCase()}] 您的检查报告已发布`,
    body: `您本次检查报告已由陈医师审核发布,请查阅。`,
    attachments: [{ name: 'report.pdf', size: 256000, format: 'pdf', url: `/api/v1/dist/${i}/report.pdf` }],
    status,
    priority: (['low', 'normal', 'high', 'urgent'] as const)[i % 4] ?? 'normal',
    retryCount: status === 'failed' ? 3 : 0,
    maxRetries: 3,
    scheduledAt: sentAt,
    sentAt,
    deliveredAt,
    readAt,
    failedAt,
    errorCode: status === 'failed' ? (['INVALID_RECIPIENT', 'NETWORK_ERROR', 'RATE_LIMITED', 'TIMEOUT'] as const)[i % 4] : undefined,
    errorMessage: status === 'failed' ? '网络超时,已重试 3 次' : undefined,
    durationMs: 5000 + (i * 137 % 3000),
    cost: 0.01 + (i * 0.003),
    externalId: `${channel}-${i.toString().padStart(6, '0')}`,
    traceId: `trace-${uuid()}`,
    ackReceived,
    ackCode: ackReceived ? 'AA' : undefined,
    ackMessage: ackReceived ? 'Message accepted' : undefined,
    metadata: { 'X-Correlation-Id': `corr-${i}` },
  };
});

// ============================================================
// 3. 队列 / KPI
// ============================================================
export const DELIVERY_QUEUE_MOCK: DeliveryQueue = {
  pending: 24,
  sending: 8,
  failed: 3,
  delivered: 156,
  read: 142,
  totalToday: 187,
  successRate: 0.978,
  avgDurationMs: 5240,
  p95DurationMs: 9800,
  byChannel: {
    wechat: { queued: 8, sent: 56, failed: 0, successRate: 1.0 },
    sms: { queued: 4, sent: 24, failed: 0, successRate: 1.0 },
    dingtalk: { queued: 3, sent: 18, failed: 0, successRate: 1.0 },
    email: { queued: 2, sent: 22, failed: 1, successRate: 0.96 },
    inApp: { queued: 5, sent: 28, failed: 0, successRate: 1.0 },
    dicom: { queued: 1, sent: 6, failed: 1, successRate: 0.86 },
    paper: { queued: 0, sent: 2, failed: 1, successRate: 0.67 },
    cloud: { queued: 1, sent: 0, failed: 0, successRate: 1.0 },
    film: { queued: 0, sent: 0, failed: 0, successRate: 1.0 },
  },
};

export const DELIVERY_KPI_HISTORY: DeliveryKpi[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.now() - i * 86400000);
  const total = 150 + ((i * 13) % 80);
  return {
    date: d.toISOString().slice(0, 10),
    total,
    delivered: Math.round(total * 0.97),
    read: Math.round(total * 0.88),
    failed: Math.round(total * 0.03),
    successRate: 0.97,
    onTimeRate: 0.95,
    avgDurationMs: 4500 + (i * 47 % 2000),
    byChannel: {
      wechat: { count: Math.round(total * 0.3), successRate: 0.99, avgDurationMs: 1200 },
      sms: { count: Math.round(total * 0.15), successRate: 0.99, avgDurationMs: 800 },
      dingtalk: { count: Math.round(total * 0.1), successRate: 0.98, avgDurationMs: 1500 },
      email: { count: Math.round(total * 0.12), successRate: 0.95, avgDurationMs: 3500 },
      inApp: { count: Math.round(total * 0.15), successRate: 0.99, avgDurationMs: 200 },
      dicom: { count: Math.round(total * 0.05), successRate: 0.92, avgDurationMs: 4500 },
      paper: { count: Math.round(total * 0.08), successRate: 0.85, avgDurationMs: 30000 },
      cloud: { count: Math.round(total * 0.04), successRate: 0.99, avgDurationMs: 2000 },
      film: { count: 0, successRate: 1.0, avgDurationMs: 0 },
    },
  };
});

export const DELIVERY_MONITOR_MOCK: DeliveryMonitor = {
  online: true,
  workers: 12,
  queueDepth: 24,
  processing: 8,
  lagSec: 0.8,
  errorRate: 0.022,
  lastHeartbeat: new Date().toISOString(),
  alerts: [
    { id: 'a-1', severity: 'warn', message: '纸质打印通道成功率低于 80%', messageEn: 'Paper print channel success rate below 80%', raisedAt: new Date(Date.now() - 1800000).toISOString() },
    { id: 'a-2', severity: 'info', message: '钉钉通道模板升级 v3.2 已生效', messageEn: 'DingTalk template upgrade v3.2 in effect', raisedAt: new Date(Date.now() - 3600000).toISOString() },
  ],
};

// ============================================================
// 4. 送达回执
// ============================================================
export const DELIVERY_RECEIPTS_MOCK: DeliveryReceipt[] = DELIVERY_TASKS_MOCK.slice(0, 30).map((task, i) => {
  const events: DeliveryEvent[] = [
    { id: `e-${i}-1`, taskId: task.id, type: 'created', occurredAt: task.scheduledAt ?? new Date().toISOString(), detail: '任务创建', detailEn: 'Task created', source: 'system' },
  ];
  if (task.sentAt) events.push({ id: `e-${i}-2`, taskId: task.id, type: 'sent', occurredAt: task.sentAt, detail: '已发送到下游', detailEn: 'Sent to downstream', source: 'system' });
  if (task.deliveredAt) events.push({ id: `e-${i}-3`, taskId: task.id, type: 'delivered', occurredAt: task.deliveredAt, detail: '下游已确认收到', detailEn: 'Downstream acknowledged', source: 'remote', code: task.ackCode });
  if (task.readAt) events.push({ id: `e-${i}-4`, taskId: task.id, type: 'read', occurredAt: task.readAt, detail: '收件人已读', detailEn: 'Recipient read', source: 'webhook' });
  if (task.failedAt) events.push({ id: `e-${i}-5`, taskId: task.id, type: 'failed', occurredAt: task.failedAt, detail: task.errorMessage ?? '失败', detailEn: task.errorMessage ?? 'Failed', source: 'system' });
  if (task.retryCount > 0) events.push({ id: `e-${i}-6`, taskId: task.id, type: 'retry', occurredAt: new Date(new Date(task.sentAt ?? Date.now()).getTime() + 1000).toISOString(), detail: `重试 ${task.retryCount}/${task.maxRetries}`, detailEn: `Retry ${task.retryCount}/${task.maxRetries}`, source: 'system' });

  return {
    id: `rcp-${task.id}`,
    taskId: task.id,
    reportId: task.reportId,
    channel: task.channel,
    recipient: task.recipient,
    recipientName: task.recipientName,
    status: task.status,
    statusLabel: statusLabel(task.status),
    statusLabelEn: statusLabelEn(task.status),
    events,
    retryCount: task.retryCount,
    finalAt: task.readAt ?? task.deliveredAt ?? task.failedAt ?? task.sentAt ?? new Date().toISOString(),
    cost: task.cost,
    throughputKb: 32 + (i % 8) * 16,
    signature: `sig-${uuid()}`,
    verified: task.status === 'delivered' || task.status === 'read',
  };
});

// ============================================================
// 5. 患者端
// ============================================================
const PATIENT_LINKS_STATUSES: PatientPortalStatus[] = ['active', 'active', 'active', 'viewed', 'expired', 'revoked', 'active', 'viewed', 'active', 'active'];

export const PATIENT_PORTAL_LINKS_MOCK: PatientPortalLink[] = Array.from({ length: 30 }, (_, i) => {
  const status = PATIENT_LINKS_STATUSES[i % PATIENT_LINKS_STATUSES.length] ?? 'active';
  const createdAt = new Date(Date.now() - i * 86400000).toISOString();
  const expiresAt = new Date(Date.now() + (30 - i) * 86400000).toISOString();
  return {
    id: `pl-${(i + 1).toString().padStart(4, '0')}`,
    reportId: REPORT_IDS[i % REPORT_IDS.length] ?? 'rpt-038',
    patientId: `p-${(38 + i).toString()}`,
    shortCode: `${(100000 + i * 137).toString(36).toUpperCase()}`,
    shortUrl: `https://r.hospital.cn/r/${(100000 + i * 137).toString(36)}`,
    qrCode: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=`,
    language: i % 2 === 0 ? 'zh-CN' : 'en-US',
    status,
    createdAt,
    expiresAt,
    maxViews: 5,
    viewCount: status === 'viewed' ? 1 + (i % 3) : 0,
    lastViewedAt: status === 'viewed' ? new Date(new Date(createdAt).getTime() + 86400000).toISOString() : undefined,
    lastViewedIp: status === 'viewed' ? `192.168.${(i % 254) + 1}.${((i * 7) % 254) + 1}` : undefined,
    watermark: `患者:${1000 + i}  报告:${REPORT_IDS[i % REPORT_IDS.length] ?? 'rpt-038'}`,
    requirePhone: i % 3 === 0,
    requireIdCard: i % 5 === 0,
    channels: (['wechat', 'sms'] as const),
    notifyOnView: true,
  };
});

export const PATIENT_REPORT_VIEWS_MOCK: PatientReportView[] = PATIENT_PORTAL_LINKS_MOCK
  .filter((l) => l.status === 'viewed')
  .map((l, i) => ({
    id: `prv-${i + 1}`,
    linkId: l.id,
    reportId: l.reportId,
    patientId: l.patientId,
    viewedAt: l.lastViewedAt ?? new Date().toISOString(),
    ip: l.lastViewedIp ?? '127.0.0.1',
    device: (['mobile', 'mobile', 'desktop'] as const)[i % 3] ?? 'mobile',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    durationSec: 30 + (i * 17 % 120),
    pageCount: 1 + (i % 2),
    language: l.language,
  }));

// ============================================================
// 6. 策略 / 错误码
// ============================================================
export const DELIVERY_POLICIES_MOCK: DeliveryPolicy[] = [
  {
    id: 'dp-1', name: '急诊/危急值多通道推送', nameEn: 'STAT/Critical Multi-Channel',
    modality: ['CT', 'MR', 'DR'],
    priority: ['high', 'urgent'],
    channels: ['wechat', 'sms', 'dingtalk', 'inApp'],
    template: 'critical-v2',
    enabled: true, retryOnFail: true, requirePatientConsent: false,
    dndStartHour: 22, dndEndHour: 8,
    authorId: 'u-001', authorName: '系统管理员',
    createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'dp-2', name: '常规报告患者推送', nameEn: 'Standard Patient Push',
    modality: ['CT', 'MR', 'DR', 'US', 'MG'],
    priority: ['low', 'normal'],
    channels: ['wechat', 'sms', 'inApp', 'cloud'],
    template: 'patient-v1',
    enabled: true, retryOnFail: true, requirePatientConsent: true,
    dndStartHour: 22, dndEndHour: 7,
    authorId: 'u-001', authorName: '系统管理员',
    createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'dp-3', name: 'PACS 报告回写', nameEn: 'PACS Report Back',
    modality: ['CT', 'MR', 'DR', 'US', 'MG', 'DSA', 'PET-CT'],
    priority: ['low', 'normal', 'high', 'urgent'],
    channels: ['dicom'],
    template: 'dicom-sr-tid-2000',
    enabled: true, retryOnFail: true, requirePatientConsent: false,
    authorId: 'u-001', authorName: '系统管理员',
    createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  },
];

export const DELIVERY_ERROR_CODES: Record<DeliveryErrorCode, DeliveryError> = {
  INVALID_RECIPIENT: { code: 'INVALID_RECIPIENT', message: '收件人地址无效', messageEn: 'Invalid recipient', retryable: false, suggestion: '请检查收件人地址格式', suggestionEn: 'Check recipient format' },
  RATE_LIMITED: { code: 'RATE_LIMITED', message: '通道限流', messageEn: 'Rate limited', retryable: true, suggestion: '请稍后重试', suggestionEn: 'Retry later' },
  TEMPLATE_NOT_FOUND: { code: 'TEMPLATE_NOT_FOUND', message: '模板不存在', messageEn: 'Template not found', retryable: false, suggestion: '联系管理员配置模板', suggestionEn: 'Contact admin' },
  CHANNEL_DISABLED: { code: 'CHANNEL_DISABLED', message: '通道已禁用', messageEn: 'Channel disabled', retryable: false, suggestion: '请使用其他通道', suggestionEn: 'Use another channel' },
  AUTH_FAILED: { code: 'AUTH_FAILED', message: '认证失败', messageEn: 'Auth failed', retryable: false, suggestion: '更新凭据', suggestionEn: 'Update credentials' },
  NETWORK_ERROR: { code: 'NETWORK_ERROR', message: '网络错误', messageEn: 'Network error', retryable: true, suggestion: '系统将自动重试', suggestionEn: 'Auto retry' },
  TIMEOUT: { code: 'TIMEOUT', message: '请求超时', messageEn: 'Timeout', retryable: true, suggestion: '系统将自动重试', suggestionEn: 'Auto retry' },
  CONTENT_REJECTED: { code: 'CONTENT_REJECTED', message: '内容被拒绝', messageEn: 'Content rejected', retryable: false, suggestion: '检查内容合规', suggestionEn: 'Check content compliance' },
  POLICY_VIOLATION: { code: 'POLICY_VIOLATION', message: '违反策略', messageEn: 'Policy violation', retryable: false, suggestion: '请检查发送策略', suggestionEn: 'Check policy' },
  QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', message: '配额超限', messageEn: 'Quota exceeded', retryable: false, suggestion: '联系管理员增加配额', suggestionEn: 'Contact admin for quota' },
  EXTERNAL_ERROR: { code: 'EXTERNAL_ERROR', message: '外部服务错误', messageEn: 'External error', retryable: true, suggestion: '系统将自动重试', suggestionEn: 'Auto retry' },
  UNKNOWN: { code: 'UNKNOWN', message: '未知错误', messageEn: 'Unknown', retryable: true, suggestion: '请联系技术支持', suggestionEn: 'Contact support' },
};

// ============================================================
// Helpers
// ============================================================
function uuid(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}
function statusLabel(s: DeliveryStatus): string {
  return { pending: '待发送', queued: '队列中', sending: '发送中', sent: '已发送', delivered: '已送达', read: '已阅读', failed: '失败', cancelled: '已取消', expired: '已过期' }[s];
}
function statusLabelEn(s: DeliveryStatus): string {
  return { pending: 'Pending', queued: 'Queued', sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed', cancelled: 'Cancelled', expired: 'Expired' }[s];
}

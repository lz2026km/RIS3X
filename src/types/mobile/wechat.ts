/**
 * [P0-12 v3.0.7] 微信小程序 API 类型定义
 */

export interface WechatSession {
  /** 患者 openid (G5 患者主索引绑定) */
  openid: string;
  /** 微信 session_key (服务端持有,客户端不应见) */
  sessionKey: string;
  /** 联合 id (一个微信账号绑定多患者时) */
  unionid?: string;
  /** 关联的 G5 患者 ID */
  patientId: string;
  /** 患者姓名 (脱敏) */
  patientNameMasked: string;
  /** 头像 URL (微信) */
  avatarUrl?: string;
  /** Token (用于后续请求) */
  token: string;
  /** Token 过期时间 (秒) */
  expiresIn: number;
}

export interface PatientReportSummary {
  id: string;
  studyId: string;
  modality: string;
  bodyPart: string;
  examDescription: string;
  status: "preliminary" | "published" | "amended" | "cancelled";
  reportDate: string;
  radiologist: string;
  hasCriticalFinding: boolean;
  pdfAvailable: boolean;
  thumbnailUrl?: string;
}

export interface ReportPdfResponse {
  reportId: string;
  /** 临时 URL,30 分钟有效 */
  url: string;
  /** 过期时间 (ISO 字符串) */
  expiresAt: string;
  /** 文件大小 (bytes) */
  size: number;
  /** SHA-256 指纹 (用于验证完整性) */
  sha256: string;
}

export interface WechatNotificationPayload {
  openid: string;
  patientId: string;
  type: "exam_complete" | "critical_value" | "reschedule" | "report_ready" | "appointment_reminder";
  title: string;
  body: string;
  /** 跳转路径 (小程序内页面) */
  page?: string;
  /** 关联资源 ID (报告 / 检查 / 预约) */
  resourceId?: string;
  /** 优先级 (高优先级会触发 push) */
  priority?: "low" | "normal" | "high";
}

export interface WechatNotificationResult {
  ok: boolean;
  messageId: string;
  deliveredAt: string;
  channel: "wechat_subscribe" | "wechat_uniform" | "sms" | "email";
  cost: number;
}

export interface ExamStatusInfo {
  examId: string;
  patientId: string;
  status:
    | "scheduled"
    | "arrived"
    | "in_progress"
    | "image_acquired"
    | "report_draft"
    | "report_review"
    | "report_published"
    | "cancelled";
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  reportedAt?: string;
  modality: string;
  room?: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  radiologist?: string;
  hasCriticalFinding: boolean;
  /** 7 步流程时间线 */
  timeline: { step: string; at: string; operator?: string }[];
}

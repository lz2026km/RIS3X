/**
 * [P0-12 v3.0.7] 微信小程序 API 服务
 *
 * 为微信小程序提供:
 * - jscode2session: 微信 code 换 openid
 * - getPatientReports: 患者报告列表
 * - getReportPDF: 报告 PDF 临时 URL (30 分钟)
 * - sendNotification: 微信通知
 * - getExamStatus: 检查状态
 *
 * 安全:
 * - 微信 code 一次性,5 分钟过期
 * - openid 在服务端,客户端只持 session_key
 * - PDF URL 临时,30 分钟失效
 * - 鉴权: 微信 openid 必须在 G5 患者主索引里有绑定
 */
import type {
  WechatSession,
  PatientReportSummary,
  ReportPdfResponse,
  WechatNotificationPayload,
  WechatNotificationResult,
  ExamStatusInfo,
} from "../../types/mobile/wechat";

const API_BASE = "/api/v1/mobile/wechat";

/** 标准 fetch 包装: 失败抛错 + 超时 15s */
async function api<T>(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`wechat api ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** 微信 code 换 openid + session_key */
export async function jscode2session(jsCode: string): Promise<WechatSession> {
  return api<WechatSession>("/session", {
    method: "POST",
    body: JSON.stringify({ jsCode }),
  });
}

/** 获取患者报告列表 (openid 由 cookie/session 自动带) */
export async function getPatientReports(
  patientId: string,
  options: { page?: number; pageSize?: number; status?: "all" | "published" | "preliminary" } = {}
): Promise<{ items: PatientReportSummary[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  if (options.status) params.set("status", options.status);
  return api(`/patients/${encodeURIComponent(patientId)}/reports?${params}`);
}

/** 获取报告 PDF 临时 URL (30 分钟有效) */
export async function getReportPDF(reportId: string): Promise<ReportPdfResponse> {
  return api<ReportPdfResponse>(`/reports/${encodeURIComponent(reportId)}/pdf`);
}

/** 发送微信通知 (检查完成 / 危急值 / 改约) */
export async function sendNotification(
  payload: WechatNotificationPayload
): Promise<WechatNotificationResult> {
  return api<WechatNotificationResult>("/notifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** 查询检查实时状态 (排队 / 检查中 / 报告完成 / 危急值) */
export async function getExamStatus(examId: string): Promise<ExamStatusInfo> {
  return api<ExamStatusInfo>(`/exams/${encodeURIComponent(examId)}/status`);
}

/** 改约 (取消 + 重新预约) */
export async function rescheduleAppointment(
  appointmentId: string,
  newSlot: { startAt: string; modality: string }
): Promise<{ ok: boolean; newAppointmentId: string }> {
  return api(`/appointments/${encodeURIComponent(appointmentId)}/reschedule`, {
    method: "POST",
    body: JSON.stringify(newSlot),
  });
}

/** 取消预约 */
export async function cancelAppointment(
  appointmentId: string,
  reason: string
): Promise<{ ok: boolean; refunded: boolean }> {
  return api(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** 危急值一键 ACK (患者或家属) */
export async function acknowledgeCritical(
  notificationId: string
): Promise<{ ok: boolean; acknowledgedAt: string }> {
  return api(`/notifications/${encodeURIComponent(notificationId)}/ack`, {
    method: "POST",
  });
}

export const wechatApi = {
  jscode2session,
  getPatientReports,
  getReportPDF,
  sendNotification,
  getExamStatus,
  rescheduleAppointment,
  cancelAppointment,
  acknowledgeCritical,
};

export default wechatApi;

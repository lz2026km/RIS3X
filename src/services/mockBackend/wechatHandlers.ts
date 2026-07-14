/**
 * [P0-12 v3.0.7] 微信小程序 MSW Handlers
 * 8 端点,挂载到 /api/v1/mobile/wechat/*
 */
import { http, HttpResponse, delay } from "msw";

const getBase = () =>
  (typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost:5191") + "/api/v1";

import { MOCK_OPENID_PREFIX, MOCK_PATIENT_REPORTS, MOCK_EXAM_STATUS } from './data/index';

export const wechatHandlers = [
  // 1. jscode2session
  http.post(`${getBase()}/mobile/wechat/session`, async ({ request }) => {
    await delay(80);
    const body = (await request.json().catch(() => ({}))) as { jsCode?: string };
    const jsCode = body.jsCode || "default_jscode";
    return HttpResponse.json({
      success: true,
      data: {
        openid: MOCK_OPENID_PREFIX + jsCode.substring(0, 8),
        sessionKey: "mock_session_key_" + Date.now(),
        patientId: "P100001",
        patientNameMasked: "张*",
        token: "mock_jwt_" + Math.random().toString(36).slice(2, 12),
        expiresIn: 7200,
      },
    });
  }),

  // 2. getPatientReports
  http.get(`${getBase()}/mobile/wechat/patients/:patientId/reports`, async ({ params, request }) => {
    await delay(80);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    return HttpResponse.json({
      success: true,
      data: { items: MOCK_PATIENT_REPORTS, total: MOCK_PATIENT_REPORTS.length, page, pageSize },
    });
  }),

  // 3. getReportPDF
  http.get(`${getBase()}/mobile/wechat/reports/:reportId/pdf`, async ({ params }) => {
    await delay(80);
    const reportId = params["reportId"] as string;
    return HttpResponse.json({
      success: true,
      data: {
        reportId,
        url: `/g005-radiology-ris/api/v1/mobile/wechat/reports/${reportId}/download?t=${Date.now()}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        size: 1024 * 256,
        sha256: "mock_sha256_abcdef_" + reportId,
      },
    });
  }),

  // 4. sendNotification
  http.post(`${getBase()}/mobile/wechat/notifications`, async () => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: { ok: true, messageId: "msg_" + Date.now(), deliveredAt: new Date().toISOString(), channel: "wechat_subscribe", cost: 0 },
    });
  }),

  // 5. getExamStatus
  http.get(`${getBase()}/mobile/wechat/exams/:examId/status`, async ({ params }) => {
    await delay(80);
    const examId = params["examId"] as string;
    const info = MOCK_EXAM_STATUS[examId] || { examId, patientId: "P100001", status: "scheduled", scheduledAt: new Date().toISOString(), modality: "CT", hasCriticalFinding: false, timeline: [] };
    return HttpResponse.json({ success: true, data: info });
  }),

  // 6. rescheduleAppointment
  http.post(`${getBase()}/mobile/wechat/appointments/:appointmentId/reschedule`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { ok: true, newAppointmentId: "APT-" + Date.now() } });
  }),

  // 7. cancelAppointment
  http.post(`${getBase()}/mobile/wechat/appointments/:appointmentId/cancel`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { ok: true, refunded: false } });
  }),

  // 8. acknowledgeCritical
  http.post(`${getBase()}/mobile/wechat/notifications/:notificationId/ack`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { ok: true, acknowledgedAt: new Date().toISOString() } });
  }),
];

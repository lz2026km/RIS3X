/**
 * [P0-12 v3.0.7] 微信小程序 MSW Handlers
 * 8 端点,挂载到 /api/v1/mobile/wechat/*
 *
 * [Phase 2 MSW 降级] 全部 8 个 handler 无前端调用(微信小程序为外部客户端,
 * 不在本仓库页面/服务代码中被引用),已按 C 类清理。
 * 保留空数组导出以兼容 handlers.ts 的 import,小程序接入真实后端后可在此恢复。
 */
import { http, HttpResponse, delay } from "msw";

const getBase = () =>
  (typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost:5191") + "/api/v1";

export const wechatHandlers: ReturnType<typeof http.get>[] = [
  // [Phase 2 MSW 降级] 微信小程序 8 端点已移除:
  //   /mobile/wechat/session /patients/:patientId/reports /reports/:reportId/pdf
  //   /notifications /exams/:examId/status /appointments/:appointmentId/reschedule
  //   /appointments/:appointmentId/cancel /notifications/:notificationId/ack
];

/**
 * G005 放射RIS系统 v3.0.0 - MSW Mock 后端处理器
 * Phase T4-W9: 50+ 端点(对接 src/services/openapi.ts)
 *
 * 覆盖 9 大 tag:
 *   reports / patients / imaging / ai / ca / audit / collab / terms / stats
 *   + 业务子模块 worklist / device / critical / appointment / print
 */

import { http, HttpResponse, delay } from 'msw';
import { newPagesHandlers } from './newPagesHandlers';
import { systemHandlers } from './systemHandlers'; // [v3.0.6.11-21] system/audit, system/backup, system/tenant-config
// [v3.0.6.11-60] 多租户 SaaS 基础: /api/v1/tenant/*
import { tenantHandlers } from './tenantHandlers';
import { storageHandlers } from './storageHandlers'; // [v3.0.6.11-60] cloud-storage 配置
// [v3.0.6.8-32] 主数据池 + 业务逻辑
import {
  list, get, create, update, remove, findMany, findOne, stats, isUsingIndexedDB, listAudit,
} from './store';
import {
  parseQuery, applyQuery, groupBy, sumBy, avgBy, filterByDateRange,
} from './queryBuilder';
import {
  toPatientDto, toDeviceDto, toUserDto, toExamDto, toReportDto,
  toExamItemDto, toDoctorPerformanceDto, toDailyKpiDto, toCriticalEventDto, toCosignTaskDto,
} from './adapters';
import { auditCreate, auditUpdate, auditDelete, auditStatusChange } from './audit';
import {
  canTransitionReport, transitionReport, canTransitionWorklist,
  getSlaMinutes, getEscalationTargets, checkSlaBreach,
  shouldEscalate,
  determineCosignTrigger, getCosignSlaMinutes, getReviewSlaMinutes,
  getNextMaintenanceDate, isMaintenanceOverdue, daysUntilMaintenance,
  recordWorkflowEvent, calculateImageGrade, listWorkflowEvents,
} from './businessLogic';
import { v4 as uuidv4 } from 'uuid';
import { reportSubsystemMock } from '@data/reportSubsystemMock';
import { initialRadiologyExams, initialUsers } from '@data/initialData';
import { TERM_CATEGORIES, FEATURED_TERMS } from '@data/knowledgeStatsMock';
import type { RadiologyReport } from '@/types';
import { writingHandlers, distributionHandlers, integrationHandlers, otherHandlers, cosignHandlers, qualityReportHandlers, aiAssistHandlers } from './v3ReportHandlers';
// [Phase 1.4] ASR 语音识别端点 (transcribe / transcribe/audio / feedback)
import { asrHandlers } from './asrHandlers';import { qualityScoringHandlers } from './qualityScoringHandlers';
import { doseHandlers } from './doseHandlers';
import { reviewAssistHandlers } from './v3ReviewHandlers';
// [v3.0.6.11-60] BI 仪表板 (报告时效/RVU/OEE/危急值SLA/趋势)
import { biHandlers } from './biHandlers';
// [Phase 2] 壳页面真实化 - 新增 MSW handlers
import { kioskHandlers } from './kioskHandlers';
import { fusionHandlers } from './fusionHandlers';
import { dicom4dHandlers } from './dicom4dHandlers';
import { dicomCompressHandlers } from './dicomCompressHandlers'; // [v3.0.6.11-60] DICOM 压缩真实化
import { dbtHandlers } from './dbtHandlers'; // [v3.0.6.11-62] DBT 乳腺断层合成 (studies/slices/reconstruct/compare)
import { screeningHandlers } from './screeningHandlers';
import { searchHandlers } from './searchHandlers';
// [v3.0.6.11-60] 相似病例检索 (POST /similar-case/search, GET /similar-case/:reportId, POST /similar-case/feedback)
import { similarCaseHandlers } from './similarCaseHandlers';
// [v3.0.6.8-83] 眼科专科 252 端点 (20 模块, 含 PR1-PR11)
import { eyeHandlers } from './eyeHandlers';
// [v3.0.6.8-53] 口腔专科 (Day 1: PACS 24 端点)
import { dentalNewHandlers } from './dentalNewHandlers';
import { workflowHandlers } from './workflowHandlers';
import { financeHandlers } from './financeHandlers';
import { dataReportHandlers } from './dataReportHandlers';
import { regionalHandlers } from './regionalHandlers';
import { patientPortalHandlers } from './patientPortalHandlers';
import { cosignNewHandlers } from './cosignNewHandlers';
import { cdsHandlers } from './cdsHandlers';
import { criticalExtHandlers } from './criticalExtHandlers';
import { qcExtHandlers } from './qcExtHandlers';
import { reportQualityHandlers } from './reportQualityHandlers';
import { caHandlers } from './caHandlers';
import { deviceMgmtHandlers } from './deviceMgmtHandlers';
import { aiPlatformHandlers } from './aiPlatformHandlers';
// [v3.0.6.11-60] AI Orchestrator 编排平台 (模型注册/部署/工作流集成/推理任务)
import { aiOrchestratorHandlers } from './aiOrchestratorHandlers';
import { aiDiagnosisHandlers } from './aiDiagnosisHandlers';
// [v3.0.6.11-61] 环境式 AI 报告草稿 (生成式草稿 + 医生确认: /ai/report-draft/*)
import { reportDraftHandlers } from './reportDraftHandlers';
import { volumeHandlers } from './volumeHandlers';
import { cardiacHandlers } from './cardiacHandlers';
// [v3.0.6.11-62] 3D 分割与定量 (segment/quantify/segmentations/approve)
import { segmentationHandlers } from './segmentationHandlers';
import { dentalHandlers } from './dentalHandlers';
import { olapHandlers } from './olapHandlers';
// [v3.0.6.11-54] Phase 2 壳页面真实化 (dicom-web / critical-alert / sr-report / nuclear-stats)
import { shellUpgradeHandlers } from './shellUpgradeHandlers';
// [v3.0.6.11-60] DICOM SR 全链路 (generate/by-report/push-oru/download)
import { srHandlers } from './srHandlers';
// [P0-12 v3.0.7] 微信小程序 API
import { wechatHandlers } from './wechatHandlers';
// [v3.0.6.11-60] Batch 3: 壳页面真实化 (fusion-workspace/pacs-admin/snomed/terminology/pathways/consent/dental-ai/value5step)
import { shellBatch3Handlers } from './shellBatch3Handlers';
// [v3.0.6.11-60] Auto-hanging 自动布局 + 多 RADS 评分扩展
import { hangingHandlers } from './hangingHandlers';
import { radsHandlers } from './radsHandlers';
// [v3.0.6.11-60] VNA 厂商中立归档 (objects/worm-lock/patients/stats/studies)
import { vnaHandlers } from './vnaHandlers';
// [v3.0.6.11-60] Smart MWL 深度化 (worklist-smart / smart-route)
import { smartWorklistHandlers } from './smartWorklistHandlers';
import {
  CHECK_ITEM_TEMPLATES,
  INITIAL_CHECK_LISTS,
  INITIAL_CHECK_AUDIT,
  INITIAL_CHECK_SLA_CONFIG,
  INITIAL_CHECK_CUSTOM_ITEMS,
  INITIAL_CHECK_WORKLOAD,
  INITIAL_CHECK_SUMMARY,
} from '@data/reportInitialCheckMock';
import {
  FINAL_CHECK_TEMPLATES,
  FINAL_CHECK_LISTS,
  CLINICAL_CONSISTENCY_RESULTS,
  FINAL_SCORING_RUBRICS,
  FINAL_SCORING_RESULTS,
  FINAL_REVIEW_NOTES,
  FINAL_CHECK_WORKLOAD,
  PRIOR_REPORT_COMPARISONS,
  FINAL_MULTI_SIGNATURE_REQUESTS,
  EMERGENCY_REVIEW_REQUESTS,
  FINAL_CHECK_WORKFLOW_CONFIGS,
  FINAL_CHECK_EVENTS,
  buildSummary as buildFinalCheckSummary,
} from '@data/reportFinalCheckMock';
import { REVIEW_TASKS } from '@data/reportReviewMock';
import { APPOINTMENT_RECORDS, initialModalityDevices } from '@data/initialData';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// v3.0.6.8-13: 动态 API_BASE,基于当前 origin
// 原: 'http://localhost:5173/api/v1' 硬编码导致不同端口(5199)无法匹配
// v3.0.6.8-105-fix: vitest/jsdom 下 window.location.origin = localhost:3000 与测试 URL (5173) 不匹配
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

// ============= Auth (3) =============
export const authHandlers = [
  http.post(`${API_BASE}/auth/login`, async () => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: {
        token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
        refreshToken: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
        expiresAt: Date.now() + 15 * 60 * 1000,
        userId: 'u-' + uuidv4().slice(0, 8),
        userName: 'demo',
        role: '医生',
      },
    });
  }),

  http.post(`${API_BASE}/auth/refresh`, async () => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: { token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') },
    });
  }),

  http.post(`${API_BASE}/auth/logout`, async () => new HttpResponse(null, { status: 204 })),
];

// ============= Reports(24) - v3.0.6.8-32 接入 EXAM_REPORT_PRE + QUALITY_SCORE_PRE =============
export const reportHandlers = [
  // 列表 (EXAM_REPORT_PRE 600 + QUALITY_SCORE_PRE 250 合并)
  // [v3.0.6.11-70] 支持 take/skip/state (与后端 reports list 对齐)
  http.get(`${API_BASE}/reports`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const takeParam = url.searchParams.get('take');
    const stateParam = url.searchParams.get('state');
    const all = list<any>('exams');
    let source = all;
    if (stateParam) {
      source = all.filter((r: any) => String(r.state ?? '').toUpperCase() === stateParam.toUpperCase());
    }
    const qMap = new Map(list<any>('qualityScores').map((q: any) => [q.reportId, q]));
    const result = applyQuery(source, {
      ...opts,
      pageSize: takeParam ? Math.min(Math.max(Number(takeParam) || 20, 1), 1000) : opts.pageSize,
    }, ['patientName', 'reportId', 'examItem', 'bodyPart']);
    return HttpResponse.json({
      success: true,
      data: result.data.map((r: any) => toReportDto(r, qMap.get(r.reportId))),
      meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
    });
  }),

  // 统计 (必须在 :id 之前)
  http.get(`${API_BASE}/reports/stats`, async () => {
    await delay(80);
    const all = list<any>('exams');
    const byStatus: Record<string, number> = {};
    const byModality: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalDefect = 0;
    let totalCritical = 0;
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byModality[r.modality] = (byModality[r.modality] || 0) + 1;
      byPriority[r.priority] = (byPriority[r.priority] || 0) + 1;
      totalDefect += r.defectCount || 0;
      if (r.hasCriticalValue) totalCritical++;
    }
    return HttpResponse.json({ success: true, data: { total: all.length, byStatus, byModality, byPriority, totalDefect, totalCritical } });
  }),

  // 详情
  http.get(`${API_BASE}/reports/:id`, async ({ params }) => {
    await delay(50);
    const report = get<any>('exams', params.id as string);
    if (!report) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } }, { status: 404 });
    const q = findOne<any>('qualityScores', (x: any) => x.reportId === params.id);
    return HttpResponse.json({ success: true, data: toReportDto(report, q) });
  }),

  // 差分 (新旧版本对比)
  http.get(`${API_BASE}/reports/:id/diff`, async ({ params }) => {
    await delay(80);
    const report = get<any>('exams', params.id as string);
    if (!report) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: {
      reportId: params.id,
      current: { findings: report.findings, impression: report.impression },
      previous: { findings: report.findings + ' (旧版)', impression: report.impression + ' (旧版)' },
      diff: [
        { field: 'findings', type: 'modified', oldValue: '旧版', newValue: '新版' },
      ],
    } });
  }),

  // 签名证书信息
  

  // 双签追踪
  

  // 创建
  http.post(`${API_BASE}/reports`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const reportId = body.reportId || `RPT-${Date.now()}`;
    const newReport = {
      id: reportId,
      reportId,
      ...body,
      status: 'draft',
      examAt: body.examAt || new Date().toISOString(),
      reportAt: new Date().toISOString(),
    };
    create('exams', newReport);
    auditCreate('reports', newReport);
    const cosignTrigger = determineCosignTrigger({
      reportDoctorTitle: body.doctorTitle ?? '住院医师',
      isCriticalValue: Boolean(body.hasCriticalValue),
      examItem: body.examItem ?? body.modality ?? '',
      isVipPatient: Boolean(body.isVipPatient),
      qcScore: typeof body.qcScore === 'number' ? body.qcScore : 100,
      isComplex: Boolean(body.isComplex),
    });
    if (cosignTrigger) {
      recordWorkflowEvent({
        actorId: 'system',
        actorName: '系统',
        action: 'cosign-trigger',
        entityType: 'reports',
        entityId: reportId,
        metadata: { trigger: cosignTrigger },
      });
    }
    return HttpResponse.json({ success: true, data: toReportDto(newReport), meta: { cosignTrigger } }, { status: 201 });
  }),

  // 更新 (带状态机校验)
  http.patch(`${API_BASE}/reports/:id`, async ({ params, request }) => {
    await delay(120);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('exams', id);
    if (!before) return HttpResponse.json({ success: false }, { status: 404 });
    const updated = update<any>('exams', id, body);
    if (updated) auditUpdate('reports', before, updated);
    return HttpResponse.json({ success: true, data: updated ? toReportDto(updated) : null });
  }),

  // 删除
  http.delete(`${API_BASE}/reports/:id`, async ({ params }) => {
    await delay(100);
    const id = params.id as string;
    const before = get<any>('exams', id);
    const existed = remove('exams', id);
    if (existed) auditDelete({ resource: 'reports', resourceId: id, before });
    return new HttpResponse(null, { status: existed ? 204 : 404 });
  }),

  // [v3.0.6.8-91] 状态机: 提交 (报告状态检查 + 拒绝未知状态)
  http.post(`${API_BASE}/reports/:id/submit`, async ({ params }) => {
    await delay(120);
    const id = params.id as string;
    const before = get<any>('exams', id);
    if (!before) return HttpResponse.json({ success: false }, { status: 404 });
    const reportStates = ['draft','submitted','reviewed','cosigned','published','rejected','revised'];
    if (!reportStates.includes(before.status)) {
      return HttpResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: `Report cannot be submitted from non-report status: ${before.status}` } }, { status: 400 });
    }
    if (!canTransitionReport(mapReportStatus(before.status), 'submitted')) {
      return HttpResponse.json({ success: false, error: { code: 'INVALID_TRANSITION', message: `Cannot transition from ${before.status} to submitted` } }, { status: 400 });
    }
    const updated = update<any>('exams', id, { status: 'submitted', reportAt: new Date().toISOString() });
    if (updated) {
      auditStatusChange('reports', updated, before.status, 'submitted');
      recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'submit', entityType: 'reports', entityId: id, fromState: before.status, toState: 'submitted' });
    }
    return HttpResponse.json({ success: true, data: toReportDto(updated) });
  }),

  // 审核
  

  // 签发 (CA 签名)
  

  // 驳回
  

  // 修订
  

  // [v3.0.6.11-70] P0 状态机: 通用状态流转 (SUBMITTED/INITIAL_REVIEW/FINAL_REVIEW/REVIEWED/REJECTED/SIGNED/PUBLISHED...)
  //   与 reportApi.transition 对应: POST /reports/:id/transition  { to, actorId, reason? }
  http.post(`${API_BASE}/reports/:id/transition`, async ({ params, request }) => {
    await delay(120);
    const id = params.id as string;
    const body = (await request.json()) as { to?: string; actorId?: string; reason?: string };
    const before = get<any>('exams', id);
    if (!before) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } }, { status: 404 });
    const target = (body.to ?? 'SUBMITTED').toUpperCase() as string;
    // 后端大写状态 → MSW 存储小写状态
    const STATE_TO_STATUS: Record<string, string> = {
      PENDING_ASSIGNMENT: 'draft', ASSIGNED: 'draft', WRITING: 'draft', SUBMITTED: 'submitted',
      INITIAL_REVIEW: 'inReview', FINAL_REVIEW: 'inReview', CO_SIGN_REVIEW: 'inReview',
      REVIEWED: 'reviewed', SIGNING: 'reviewed', SIGNED: 'signed', PUBLISHED: 'published',
      AMENDING: 'amended', AMENDED: 'amended', WITHDRAWN: 'withdrawn', REJECTED: 'rejected',
      ESCALATED: 'inReview', ARCHIVED: 'published', RECTIFYING: 'amended', SUPPLEMENTING: 'amended',
      SUPPLEMENTED: 'amended', REDISTRIBUTING: 'published',
    };
    const nextStatus = STATE_TO_STATUS[target] ?? 'submitted';
    const updated = update<any>('exams', id, {
      status: nextStatus,
      state: target,
      rejectReason: target === 'REJECTED' ? (body.reason ?? '') : undefined,
      reportAt: new Date().toISOString(),
    });
    if (updated) {
      auditStatusChange('reports', updated, before.status, nextStatus);
      recordWorkflowEvent({
        actorId: body.actorId ?? 'system',
        actorName: '系统',
        action: 'transition',
        entityType: 'reports',
        entityId: id,
        fromState: before.status,
        toState: target,
        metadata: { reason: body.reason },
      });
    }
    return HttpResponse.json({ success: true, data: updated ? toReportDto(updated) : null });
  }),

  // [v3.0.6.11-70] P0 导出真实化: 入队 + 返回可下载地址
  http.post(`${API_BASE}/reports/:id/export`, async ({ params, request }) => {
    await delay(200);
    const id = params.id as string;
    const before = get<any>('exams', id);
    if (!before) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { format?: string };
    const format = (body.format ?? 'pdf').toLowerCase();
    recordWorkflowEvent({
      actorId: 'system', actorName: '系统', action: 'export', entityType: 'reports', entityId: id,
      fromState: before.status, toState: before.status,
      metadata: { format },
    });
    return HttpResponse.json({
      success: true,
      data: { queued: true, format, downloadUrl: `${API_BASE}/reports/${id}/export.${format}` },
    });
  }),

  // 审核历史
  http.get(`${API_BASE}/reports/:id/audit-trail`, async ({ params }) => {
    await delay(80);
    const events = listWorkflowEvents({ entityType: 'reports', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: events });
  }),
];

/** [v3.0.6.8-91] 映射 reportMachine 状态到 ExamState */
const REPORT_STATUS_MAP: Record<string, 'draft' | 'submitted' | 'inReview' | 'reviewed' | 'signed' | 'published' | 'rejected' | 'amended' | 'withdrawn'> = {
  pendingAssignment: 'draft',
  assigned: 'draft',
  writing: 'draft',
  submitted: 'submitted',
  initialReview: 'inReview',
  finalReview: 'inReview',
  coSignReview: 'inReview',
  reviewed: 'reviewed',
  signing: 'reviewed',
  signed: 'signed',
  published: 'published',
  amending: 'amended',
  amended: 'amended',
  withdrawn: 'withdrawn',
  rejected: 'rejected',
  escalated: 'inReview',
  archived: 'published',
  rectifying: 'amended',
  supplementing: 'amended',
  supplemented: 'amended',
  redistributing: 'published',
};

function mapReportStatus(s: string): 'draft' | 'submitted' | 'inReview' | 'reviewed' | 'signed' | 'published' | 'rejected' | 'amended' | 'withdrawn' {
  return REPORT_STATUS_MAP[s] ?? 'draft';
}

// ============= Appointments - v3.0.6.11-70 P0 预约→检查联动 =============
// 可变记录集: 新建预约后列表立即可见
let appointmentRecords: Record<string, unknown>[] = clone(APPOINTMENT_RECORDS);

const APP_PRIORITY_MAP: Record<string, string> = {
  ROUTINE: 'ROUTINE', URGENT: 'URGENT', STAT: 'STAT',
  normal: 'ROUTINE', urgent: 'URGENT', critical: 'STAT',
};
const APP_PRIORITY_LOCAL: Record<string, 'normal' | 'urgent' | 'critical'> = {
  ROUTINE: 'normal', URGENT: 'urgent', STAT: 'critical',
};
const APP_STATE_LOCAL: Record<string, string> = {
  SCHEDULED: 'pending', CONFIRMED: 'confirmed', REGISTERED: 'pending',
  CHECKED_IN: 'checked-in', IN_PROGRESS: 'checked-in', COMPLETED: 'completed',
  CANCELLED: 'cancelled', NO_SHOW: 'no-show',
};

// 提醒 / 改期 / 取消 记录 seed (与后端内存 seed 保持一致)
const SEED_REMINDERS = [
  { id: 'RM-001', patientName: '张三', phone: '13800138001', examType: '胸部CT平扫', examDate: '2026-08-05', examTime: '09:00', reminderTime: '2026-08-04 20:00', channel: '短信', status: '已确认', responseTime: '0.5h' },
  { id: 'RM-002', patientName: '李四', phone: '13800138002', examType: '头颅MR平扫', examDate: '2026-08-05', examTime: '10:30', reminderTime: '2026-08-05 07:00', channel: '微信', status: '已发送', responseTime: '未响应' },
  { id: 'RM-003', patientName: '王五', phone: '13800138003', examType: '腹部CT平扫+增强', examDate: '2026-08-06', examTime: '14:00', reminderTime: '2026-08-05 20:00', channel: 'APP推送', status: '已改期', responseTime: '2h' },
  { id: 'RM-004', patientName: '张三', phone: '13800138001', examType: '腰椎MR平扫', examDate: '2026-08-07', examTime: '08:30', reminderTime: '2026-08-06 20:00', channel: '短信', status: '已取消', responseTime: '未响应' },
  { id: 'RM-005', patientName: '李四', phone: '13800138002', examType: '胸部DR正侧位', examDate: '2026-08-08', examTime: '11:00', reminderTime: '2026-08-07 20:00', channel: '微信', status: '已发送', responseTime: '未响应' },
];
const SEED_RESCHEDULES = [
  { id: 'RS-001', patientName: '张三', phone: '13800138001', examType: '腹部CT平扫+增强', originalDate: '2026-08-03', originalTime: '09:00', newDate: '2026-08-05', newTime: '14:00', reason: 'patient', operateTime: '2026-08-02 16:20' },
  { id: 'RS-002', patientName: '李四', phone: '13800138002', examType: '头颅MR平扫', originalDate: '2026-08-04', originalTime: '10:30', newDate: '2026-08-06', newTime: '10:00', reason: 'doctor', operateTime: '2026-08-03 09:15' },
  { id: 'RS-003', patientName: '王五', phone: '13800138003', examType: '胸部CT平扫', originalDate: '2026-08-05', originalTime: '08:00', newDate: '2026-08-07', newTime: '09:30', reason: 'device', operateTime: '2026-08-04 11:40' },
];
const SEED_CANCELLATIONS = [
  { id: 'CX-001', patientName: '张三', phone: '13800138001', examType: '腰椎MR平扫', cancelTime: '2026-08-02 10:00', reason: '患者主动取消', rebooked: '是' },
  { id: 'CX-002', patientName: '李四', phone: '13800138002', examType: '胸部DR正侧位', cancelTime: '2026-08-01 15:30', reason: '设备故障', rebooked: '待确认' },
  { id: 'CX-003', patientName: '王五', phone: '13800138003', examType: '冠脉CTA', cancelTime: '2026-07-31 09:20', reason: '医生调整时间', rebooked: '否' },
];

export const appointmentHandlers = [
  http.get(`${API_BASE}/appointments`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true, data: clone(appointmentRecords) });
  }),

  // ===== 静态子路由 (必须先于 :id, 避免被 :id 吞掉) =====
  // 预约规则: 由设备主数据派生
  http.get(`${API_BASE}/appointments/rules`, async () => {
    await delay(80);
    const rules = initialModalityDevices
      .filter((d: any) => d.status !== '维护中')
      .map((d: any) => ({
        deviceId: d.id,
        deviceName: d.name,
        maxDailyAppointments: d.modality === 'MR' ? 40 : d.modality === 'CT' ? 60 : 80,
        maxPerTimeSlot: d.modality === 'MR' ? 3 : 4,
        minAdvanceDays: 0,
        maxAdvanceDays: 30,
        noShowPenalty: 3,
        enabled: true,
      }));
    return HttpResponse.json({ success: true, data: rules });
  }),

  // 等候名单: 待确认 (pending) 预约
  http.get(`${API_BASE}/appointments/waitlist`, async () => {
    await delay(80);
    const data = (appointmentRecords as Array<Record<string, any>>)
      .filter((a) => a.status === 'pending')
      .slice(0, 50)
      .map((a) => ({
        id: a.id,
        patientName: a.patientName,
        phone: a.phone || '',
        examItemName: a.examItemName || a.bodyPart || a.modality,
        modality: a.modality,
        preferredDate: a.examDate,
        preferredTime: a.examTime,
        priority: a.priority === 'critical' ? 'critical' : a.priority === 'urgent' ? 'urgent' : 'normal',
        addedAt: a.createdAt || '',
        notified: false,
      }));
    return HttpResponse.json({ success: true, data });
  }),

  // 提醒记录
  http.get(`${API_BASE}/appointments/reminders`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: clone(SEED_REMINDERS) });
  }),

  // 改期记录
  http.get(`${API_BASE}/appointments/reschedules`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: clone(SEED_RESCHEDULES) });
  }),

  // 取消记录
  http.get(`${API_BASE}/appointments/cancellations`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: clone(SEED_CANCELLATIONS) });
  }),

  http.get(`${API_BASE}/appointments/:id`, async ({ params }) => {
    await delay(80);
    const apt = appointmentRecords.find((a) => a.id === params.id);
    return apt
      ? HttpResponse.json({ success: true, data: apt })
      : HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }),

  // 创建预约 (P0): 与后端 schema 对齐 + 联动创建 Exam → 工作列表可见
  http.post(`${API_BASE}/appointments`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Record<string, any>;
    const id = `APT-${Date.now()}`;
    const startAt = body.startAt ? new Date(body.startAt) : new Date();
    const endAt = body.endAt ? new Date(body.endAt) : new Date(startAt.getTime() + 30 * 60 * 1000);
    const device = initialModalityDevices.find((d: any) => d.id === body.deviceId);
    const record = {
      id,
      patientId: body.patientId || `RAD-P${Date.now()}`,
      patientName: body.patientName || '',
      patientInitials: (body.patientName || '').slice(0, 2),
      gender: body.gender === 'FEMALE' ? '女' : body.gender === 'MALE' ? '男' : '男',
      age: 0,
      idCard: '',
      phone: body.phone || '',
      examItemId: '',
      examItemName: body.bodyPart ? `${body.modality} ${body.bodyPart}` : body.modality,
      modality: body.modality,
      bodyPart: body.bodyPart || '',
      examDate: `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, '0')}-${String(startAt.getDate()).padStart(2, '0')}`,
      examTime: `${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}`,
      deviceId: body.deviceId,
      deviceName: body.deviceName || device?.name || '',
      roomId: device?.id?.replace('DEV', 'ROOM') || '',
      roomName: device?.location || '',
      referringDoctorId: '',
      referringDoctorName: body.referringDoctor || '',
      clinicalDiagnosis: body.note || '',
      notes: body.note || '',
      status: 'pending',
      priority: APP_PRIORITY_LOCAL[APP_PRIORITY_MAP[body.priority] || 'ROUTINE'] || 'normal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    appointmentRecords = [record, ...appointmentRecords];

    // 联动创建 Exam → 工作列表 (/worklist) 可见
    const examRecord = {
      reportId: `RPT-APPT-${Date.now()}`,
      patientId: record.patientId,
      patientName: record.patientName,
      patientAge: 0,
      patientGender: record.gender,
      modality: body.modality,
      examItem: record.examItemName,
      examItemCode: '',
      bodyPart: record.bodyPart,
      deviceId: body.deviceId,
      deviceModel: record.deviceName,
      doctorId: 'TECH-001',
      reportDoctorId: 'DR-001',
      reviewDoctorId: null,
      cosignDoctorId: null,
      icd10: '',
      clinicalDiagnosis: body.note || '',
      findings: '',
      impression: '',
      examAt: startAt.toISOString(),
      reportAt: '',
      reviewedAt: null,
      signedAt: null,
      status: 'submitted',
      priority: body.priority === 'STAT' ? '急诊' : body.priority === 'URGENT' ? '加急' : '普通',
      defectCount: 0,
      qcScore: 0,
      hasCriticalValue: false,
      criticalValueType: null,
    };
    try { create('exams', examRecord); } catch { /* store 未初始化时忽略 */ }
    auditCreate('appointments', record);

    // 返回后端 DTO 形状 (id/startAt/endAt/state/priority 枚举)
    return HttpResponse.json({
      success: true,
      data: {
        id,
        patientName: record.patientName,
        patientId: record.patientId,
        modality: body.modality,
        bodyPart: record.bodyPart || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        deviceId: body.deviceId,
        deviceName: record.deviceName,
        room: device?.location || undefined,
        priority: APP_PRIORITY_MAP[body.priority] || 'ROUTINE',
        note: body.note || undefined,
        referringDoctor: body.referringDoctor || undefined,
        state: 'SCHEDULED',
        createdById: body.createdById || 'system',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/appointments/:id`, async ({ params, request }) => {
    await delay(150);
    const body = await request.json();
    const idx = appointmentRecords.findIndex((a) => a.id === params.id);
    if (idx >= 0) {
      const updated = { ...appointmentRecords[idx], ...body, updatedAt: new Date().toISOString() };
      appointmentRecords = appointmentRecords.map((a) => (a.id === params.id ? updated : a));
      return HttpResponse.json({ success: true, data: updated });
    }
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),
];

// ============= Worklist(20) - v3.0.6.8-32 接入 EXAM_REPORT_PRE =============
// G005 P0: mock 提供与真实后端一致的 /exams 主数据源 (待检优先排序),
// 使 dev(mock) 与 real(后端 /exams) 行为一致; /worklist 仅保留状态流转端点语义。
export const examListHandlers = [
  http.get(`${API_BASE}/exams`, async () => {
    await delay(80);
    const all = list<any>('exams') || [];
    const priority = (s: string) => ['待登记', '待检查', '已登记', '已报到', '检查中'].includes(s) ? 0 : 1;
    const sorted = [...all].sort((a, b) => priority(String(a.status)) - priority(String(b.status)));
    // [G005 P0] 待检/检查中记录: 副本日期对齐到最近 7 天窗口,
    // 使 Worklist 默认日期筛选可见 (不改动共享 store 原始记录)
    const today = new Date();
    const PENDING_STATUSES = ['待登记', '待检查', '已登记', '已报到', '检查中', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS'];
    const shifted = sorted.map((r, i) => {
      const status = String(r.status);
      if (!PENDING_STATUSES.includes(status)) return r;
      const copy = { ...r };
      const d = new Date(today.getTime() - ((i % 6) * 86400000));
      const iso = d.toISOString();
      copy.examDate = iso.split('T')[0] ?? copy.examDate;
      copy.createdTime = iso.replace('T', ' ').slice(0, 16);
      if (copy.updatedTime) copy.updatedTime = copy.createdTime;
      return copy;
    });
    return HttpResponse.json({ items: shifted, total: shifted.length });
  }),

  // [v3.0.6.11-70] 详情 (报告书写上下文需要患者性别/年龄)
  http.get(`${API_BASE}/exams/:id`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const exam = get<any>('exams', id);
    if (!exam) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toExamDto(exam) });
  }),

  http.patch(`${API_BASE}/exams/:id`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as Record<string, unknown>;
    const before = get<any>('exams', id);
    const updated = update<any>('exams', id, body);
    if (updated && before) auditUpdate('exams', before, updated);
    return HttpResponse.json(updated ?? null);
  }),
];

export const worklistHandlers = [
  // 列表 (EXAM_REPORT_PRE 600 + 分页/排序/过滤)
  http.get(`${API_BASE}/worklist`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('exams');
    const result = applyQuery<any>(all, opts, ['patientName', 'examItem', 'bodyPart', 'reportId']);
    return HttpResponse.json({ success: true, data: result.data.map(toExamDto), meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
  }),

  // 工作列表统计 (必须在 :id 之前)
  http.get(`${API_BASE}/worklist/stats`, async () => {
    await delay(80);
    const all = list<any>('exams');
    const byStatus: Record<string, number> = {};
    const byModality: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const e of all) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      byModality[e.modality] = (byModality[e.modality] || 0) + 1;
      byPriority[e.priority] = (byPriority[e.priority] || 0) + 1;
    }
    return HttpResponse.json({ success: true, data: { total: all.length, byStatus, byModality, byPriority } });
  }),

  // 医生的工作列表
  

  // 详情
  http.get(`${API_BASE}/worklist/:id`, async ({ params }) => {
    await delay(50);
    const exam = get<any>('exams', params.id as string);
    if (!exam) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toExamDto(exam) });
  }),

  // 队列深度 (按设备/模态)
  

  // 创建
  http.post(`${API_BASE}/worklist`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const workId = body.reportId || body.id || `RPT-${Date.now()}`;
    const newExam = { ...body, id: workId, reportId: workId };
    create('exams', newExam);
    auditCreate('worklist', newExam);
    return HttpResponse.json({ success: true, data: toExamDto(newExam) }, { status: 201 });
  }),

  // 完整更新
  http.put(`${API_BASE}/worklist/:id`, async ({ params, request }) => {
    await delay(120);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('exams', id);
    const updated = update<any>('exams', id, body);
    if (updated) auditUpdate('worklist', before, updated);
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  // 状态更新
  

  // [v3.0.6.8-91] 修复: 使用 worklist 状态机 (checkedIn/inProgress/completed/cancelled)
  // [P0] 统一为后端规范状态: SCHEDULED → ARRIVED → IN_PROGRESS → COMPLETED
  http.post(`${API_BASE}/worklist/:id/checkin`, async ({ params }) => {
    await delay(80);
    const id = params.id as string;
    const before = get<any>('exams', id);
    if (before && !canTransitionWorklist(before.status, 'ARRIVED')) {
      return HttpResponse.json({ success: false, message: `Cannot checkin from ${before.status}` }, { status: 400 });
    }
    const updated = update<any>('exams', id, { status: 'ARRIVED', checkinAt: new Date().toISOString() });
    if (updated) {
      auditStatusChange('worklist', updated, before?.status || '', 'ARRIVED');
      recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'checkin', entityType: 'worklist', entityId: id, fromState: before?.status, toState: 'ARRIVED' });
    }
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  http.post(`${API_BASE}/worklist/:id/start`, async ({ params }) => {
    await delay(80);
    const id = params.id as string;
    const before = get<any>('exams', id);
    if (before && !canTransitionWorklist(before.status, 'IN_PROGRESS')) {
      return HttpResponse.json({ success: false, message: `Cannot start from ${before.status}` }, { status: 400 });
    }
    const updated = update<any>('exams', id, { status: 'IN_PROGRESS', startAt: new Date().toISOString() });
    if (updated) auditStatusChange('worklist', updated, before?.status || '', 'IN_PROGRESS');
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  http.post(`${API_BASE}/worklist/:id/complete`, async ({ params }) => {
    await delay(80);
    const id = params.id as string;
    const before = get<any>('exams', id);
    if (before && !canTransitionWorklist(before.status, 'COMPLETED')) {
      return HttpResponse.json({ success: false, message: `Cannot complete from ${before.status}` }, { status: 400 });
    }
    const updated = update<any>('exams', id, { status: 'COMPLETED', completeAt: new Date().toISOString() });
    if (updated) {
      auditStatusChange('worklist', updated, before?.status || '', 'COMPLETED');
      recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'complete', entityType: 'worklist', entityId: id, fromState: before?.status, toState: 'COMPLETED' });
    }
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  http.post(`${API_BASE}/worklist/:id/cancel`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as { reason: string };
    const before = get<any>('exams', id);
    if (before && !canTransitionWorklist(before.status, 'CANCELLED')) {
      return HttpResponse.json({ success: false, message: `Cannot cancel from ${before.status}` }, { status: 400 });
    }
    const updated = update<any>('exams', id, { status: 'CANCELLED', cancelReason: body.reason, cancelledAt: new Date().toISOString() });
    if (updated) auditStatusChange('worklist', updated, before?.status || '', 'CANCELLED');
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  // 批量改派
  

  // 删除
  http.delete(`${API_BASE}/worklist/:id`, async ({ params }) => {
    await delay(100);
    const id = params.id as string;
    const before = get<any>('exams', id);
    const existed = remove('exams', id);
    if (existed) auditDelete({ resource: 'worklist', resourceId: id, before });
    return new HttpResponse(null, { status: existed ? 204 : 404 });
  }),
];

// ============= Patients(14) - v3.0.6.8-32 接入 PATIENT_MASTER =============
export const patientHandlers = [
  // ⚠️ 具体路径必须在 :id 之前注册, 否则 /patients/stats 会被 :id 拦截
  // 列表 (接入 PATIENT_MASTER 1500 + 分页/搜索/过滤)
  http.get(`${API_BASE}/patients`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<unknown>('patients') as any[];
    const result = applyQuery<any>(all, opts, ['name', 'id', 'phone', 'idCard', 'chiefComplaint']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
  }),

  // 患者统计 (必须在 :id 之前)
  

  // 批量导入
  

  // 批量导出
  

  // 按模态分组 (必须在 :id 之前)
  

  // 按状态分组 (必须在 :id 之前)
  

  // 详情 (完整 PatientDto 25 字段)
  http.get(`${API_BASE}/patients/:id`, async ({ params }) => {
    await delay(50);
    const p = get<any>('patients', params.id as string);
    if (!p) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toPatientDto(p) });
  }),

  // 患者的检查 (接入 EXAM_REPORT_PRE)
  http.get(`${API_BASE}/patients/:id/exams`, async ({ params, request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('exams').filter((e: any) => e.patientId === params.id);
    const result = applyQuery<any>(all, opts);
    return HttpResponse.json({ success: true, data: result.data.map(toExamDto), meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
  }),

  // 患者的报告 (接入 EXAM_REPORT_PRE + QUALITY_SCORE_PRE)
  http.get(`${API_BASE}/patients/:id/reports`, async ({ params, request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const qMap = new Map(list<any>('qualityScores').map((q: any) => [q.reportId, q]));
    const all = list<any>('exams').filter((e: any) => e.patientId === params.id);
    const result = applyQuery<any>(all, opts);
    return HttpResponse.json({ success: true, data: result.data.map((r: any) => toReportDto(r, qMap.get(r.reportId))), meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
  }),

  // 患者时间线 (跨检查/报告)
  http.get(`${API_BASE}/patients/:id/timeline`, async ({ params }) => {
    await delay(80);
    const exams = list<any>('exams').filter((e: any) => e.patientId === params.id);
    const criticalEvents = list<any>('criticalEvents').filter((c: any) => c.patientId === params.id);
    const timeline = [
      ...exams.map((e: any) => ({ type: 'exam' as const, timestamp: e.examAt, data: e })),
      ...criticalEvents.map((c: any) => ({ type: 'critical' as const, timestamp: c.discoveredAt, data: c })),
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return HttpResponse.json({ success: true, data: timeline });
  }),

  // 患者导出
  

  // 创建 (POST /patients)
  http.post(`${API_BASE}/patients`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const newId = body.id || `P${String(Date.now()).slice(-6).padStart(6, '0')}`;
    const newPatient = { ...body, id: newId, createdAt: new Date().toISOString() };
    create('patients', newPatient);
    auditCreate('patients', newPatient);
    return HttpResponse.json({ success: true, data: toPatientDto(newPatient) }, { status: 201 });
  }),

  // 更新 (PUT /patients/:id)
  http.put(`${API_BASE}/patients/:id`, async ({ params, request }) => {
    await delay(120);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('patients', id);
    const updated = update<any>('patients', id, body);
    if (updated) auditUpdate('patients', before, updated);
    return HttpResponse.json({ success: true, data: updated ? toPatientDto(updated) : null });
  }),

  // 删除 (DELETE /patients/:id) - 仅 RBAC 管理员
  http.delete(`${API_BASE}/patients/:id`, async ({ params }) => {
    await delay(100);
    const id = params.id as string;
    const before = get<any>('patients', id);
    const existed = remove('patients', id);
    if (existed) auditDelete({ resource: 'patients', resourceId: id, before });
    return new HttpResponse(null, { status: existed ? 204 : 404 });
  }),
];

// ============= Devices(18) - v3.0.6.8-32 接入 DEVICE_MASTER =============
export const deviceHandlers = [
  // 列表 (DEVICE_MASTER 35)
  http.get(`${API_BASE}/devices`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('devices');
    const result = applyQuery<any>(all, opts, ['id', 'model', 'brand', 'room', 'building']);
    return HttpResponse.json({ success: true, data: result.data.map(toDeviceDto), meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
  }),

  // 统计 (必须在 :id 之前)
  http.get(`${API_BASE}/devices/stats/today`, async () => {
    await delay(80);
    const all = list<any>('devices');
    const byStatus: Record<string, number> = {};
    const byModality: Record<string, number> = {};
    const byGrade: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    let totalMonthlyScans = 0;
    let totalValue = 0;
    let totalDowntime = 0;
    for (const d of all) {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      byModality[d.modality] = (byModality[d.modality] || 0) + 1;
      byGrade[d.imageQualityGrade] = (byGrade[d.imageQualityGrade] || 0) + 1;
      totalMonthlyScans += d.monthlyScans;
      totalValue += d.purchasePrice;
      totalDowntime += d.monthlyDowntime;
    }
    return HttpResponse.json({ success: true, data: {
      total: all.length,
      inUse: byStatus['运行中'] || 0,
      idle: byStatus['待机'] || 0,
      maintenance: byStatus['维护中'] || 0,
      broken: byStatus['故障'] || 0,
      byStatus, byModality, byGrade,
      totalMonthlyScans, totalValue, totalDowntime,
    } });
  }),

  // 排程/维护计划
  

  // 维护历史
  

  // 详情
  http.get(`${API_BASE}/devices/:id`, async ({ params }) => {
    await delay(50);
    const d = get<any>('devices', params.id as string);
    if (!d) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toDeviceDto(d) });
  }),

  // 工作量统计
  

  // QR Code (设备资产码)
  

  // 更新状态
  http.put(`${API_BASE}/devices/:id/status`, async ({ params, request }) => {
    await delay(100);
    const id = params.id as string;
    const body = (await request.json()) as { status: string };
    const before = get<any>('devices', id);
    const updated = update<any>('devices', id, { status: body.status });
    if (updated) {
      auditUpdate('devices', before, updated);
      auditStatusChange('devices', updated, before?.status || '', body.status);
    }
    return HttpResponse.json({ success: true, data: updated ? toDeviceDto(updated) : null });
  }),

  // 触发维护
  

  // 创建 (POST /devices)
  http.post(`${API_BASE}/devices`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const newDevice = { ...body, id: body.id || `DEV-${Date.now()}` };
    create('devices', newDevice);
    auditCreate('devices', newDevice);
    return HttpResponse.json({ success: true, data: toDeviceDto(newDevice) }, { status: 201 });
  }),

  // 更新
  http.put(`${API_BASE}/devices/:id`, async ({ params, request }) => {
    await delay(120);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('devices', id);
    const updated = update<any>('devices', id, body);
    if (updated) auditUpdate('devices', before, updated);
    return HttpResponse.json({ success: true, data: updated ? toDeviceDto(updated) : null });
  }),

  // 删除
  http.delete(`${API_BASE}/devices/:id`, async ({ params }) => {
    await delay(100);
    const id = params.id as string;
    const before = get<any>('devices', id);
    const existed = remove('devices', id);
    if (existed) auditDelete({ resource: 'devices', resourceId: id, before });
    return new HttpResponse(null, { status: existed ? 204 : 404 });
  }),

  // 按模态分组
  

  // 按状态分组
  
];

// ============= DICOM(7) =============
export const dicomHandlers = [
  http.get(`${API_BASE}/dicom/studies/:studyUid`, async ({ params }) => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        studyInstanceUID: params.studyUid,
        studyDate: '2026-06-06',
        studyDescription: '胸部CT平扫',
        patientID: 'P001',
        patientName: '张三',
        modalitiesInStudy: ['CT'],
      },
    });
  }),

  

  http.get(`${API_BASE}/dicom/series/:seriesUid`, async () => {
    await delay(200);
    return HttpResponse.json({ success: true, data: {
      seriesInstanceUid: '1.2.840.10008.5.1.4.1.1.2', seriesNumber: 1, modality: 'CT', description: 'Chest CT', instances: 150,
      bodyPart: 'CHEST', laterality: null, manufacturer: 'SIEMENS', institutionName: 'G005 Hospital',
    } });
  }),

  

  

  http.get(`${API_BASE}/dicom/studies/:studyUid/thumbnail`, async () => {
    await delay(150);
    return new HttpResponse(new ArrayBuffer(1024), {
      headers: { 'Content-Type': 'image/jpeg' },
    });
  }),

  http.delete(`${API_BASE}/dicom/studies/:studyUid`, async () => {
    await delay(200);
    return new HttpResponse(null, { status: 204 });
  }),
];

// ============= AI(3) =============
export const aiHandlers = [
  http.post(`${API_BASE}/ai/generate`, async ({ request }) => {
    await delay(2000);  // 模拟 LLM 推理
    const body = (await request.json()) as { prompt: string };
    return HttpResponse.json({
      success: true,
      data: {
        content: `【AI 生成报告草稿】基于您的输入 "${body.prompt.slice(0, 50)}..."，建议描述如下：\n\n影像所见：...\n诊断意见：...\n建议：...`,
        usage: { prompt: 100, completion: 200, total: 300 },
      },
    });
  }),

  http.post(`${API_BASE}/ai/quality`, async () => {
    await delay(500);
    return HttpResponse.json({
      success: true,
      data: { score: 85, dimensions: { completeness: 90, terminology: 80, consistency: 85 } },
    });
  }),

  http.post(`${API_BASE}/ai/rads`, async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { findings: string; radsSystem: string };
    return HttpResponse.json({
      success: true,
      data: {
        system: body.radsSystem,
        category: '4A',
        description: '可疑',
        riskPercent: '5-15%',
        recommendation: '3 个月复查',
      },
    });
  }),
];

// ============= Critical Values(5) =============
export const criticalValueHandlers = [
  http.get(`${API_BASE}/critical`, async () => {
    await delay(150);
    const events = list<any>('criticalEvents');
    return HttpResponse.json({ success: true, data: events });
  }),

  http.get(`${API_BASE}/critical/:id`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { id: params.id, finding: '主动脉夹层', status: 'notified' } });
  }),

  http.post(`${API_BASE}/critical`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { severity?: string; createdAt?: string };
    const id = 'cv-' + Date.now();
    const severity = (body.severity ?? 'critical') as Parameters<typeof shouldEscalate>[0];
    const slaMinutes = getSlaMinutes(severity);
    const elapsedMinutes = body.createdAt
      ? (Date.now() - new Date(body.createdAt).getTime()) / 60000
      : 0;
    const escalate = shouldEscalate(severity, elapsedMinutes, 0);
    if (escalate) {
      recordWorkflowEvent({
        actorId: 'system',
        actorName: '系统',
        action: 'auto-escalate',
        entityType: 'critical',
        entityId: id,
        metadata: { severity, elapsedMinutes, slaMinutes },
      });
    }
    return HttpResponse.json(
      {
        success: true,
        data: { id, ...body, autoEscalate: escalate, slaMinutes },
      },
      { status: 201 },
    );
  }),

  http.put(`${API_BASE}/critical/:id/acknowledge`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'acknowledged' } });
  }),

  http.put(`${API_BASE}/critical/:id/resolve`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'resolved' } });
  }),
];

// ============= Print(4) =============
export const printHandlers = [
  http.get(`${API_BASE}/print/queue`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: [
      { id: 'print-001', jobName: '报告打印-张三', status: 'pending', pages: 2, createdAt: '2026-07-04T10:00:00Z', printerName: 'HP LaserJet' },
      { id: 'print-002', jobName: '报告打印-李四', status: 'printing', pages: 1, createdAt: '2026-07-04T09:55:00Z', printerName: 'Canon IR-ADV' },
      { id: 'print-003', jobName: '报告打印-王五', status: 'completed', pages: 3, createdAt: '2026-07-04T09:30:00Z', printerName: 'HP LaserJet' },
    ] });
  }),

  http.post(`${API_BASE}/print/jobs`, async ({ request }) => {
    await delay(200);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: 'job-' + Date.now(), ...body } }, { status: 201 });
  }),

  http.get(`${API_BASE}/print/printers`, async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'p1', name: '胶片打印机 1', ip: '192.168.1.100', status: 'ready' },
        { id: 'p2', name: '激光打印机 1', ip: '192.168.1.101', status: 'ready' },
      ],
    });
  }),

  
];

// ============= Stats(18) - v3.0.6.8-32 接入 DAILY_KPI_PRE + DOCTOR_PERFORMANCE_PRE =============
export const statsHandlers = [
  // 今日 KPI (DAILY_KPI_PRE 最后一天) - 字段与 DAILY_KPI_PRE 原生 schema 对齐
  http.get(`${API_BASE}/stats/daily`, async () => {
    await delay(80);
    const all = list<any>('dailyKpi');
    const today = all[all.length - 1];
    if (!today) return HttpResponse.json({ success: true, data: { examCount: 0, reportCount: 0, criticalCount: 0, cosignCount: 0 } });
    return HttpResponse.json({ success: true, data: {
      examCount: today.examCount,
      reportCount: today.reportCount,
      criticalCount: today.criticalCount,
      cosignCount: today.cosignCount,
      avgTAT: today.avgTAT,
      defectCount: today.defectCount,
      qcAvgScore: today.qcAvgScore,
      date: today.date,
      byModality: today.byModality,
    } });
  }),

  // 周 KPI (DAILY_KPI_PRE 7 天聚合)
  http.get(`${API_BASE}/stats/weekly`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const all = list<any>('dailyKpi');
    const weekly = all.slice(-7);
    const totalExams = sumBy(weekly, (k: any) => k.examCount);
    const totalReports = sumBy(weekly, (k: any) => k.reportCount);
    const totalCritical = sumBy(weekly, (k: any) => k.criticalCount);
    const daily = weekly.map(toDailyKpiDto);
    return HttpResponse.json({ success: true, data: {
      totalExams, totalReports, totalCritical, daily,
      avgExamsPerDay: Math.round(totalExams / 7),
    } });
  }),

  // 月 KPI (30 天聚合)
  

  // 工作量 (DOCTOR_PERFORMANCE_PRE 按医生聚合)
  http.get(`${API_BASE}/stats/workload`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const month = url.searchParams.get('month') || '2026-06';
    const all = list<any>('doctorPerformance').filter((d: any) => d.month === month);
    const byDoctor = groupBy(all, (d: any) => d.doctorId);
    const result = Object.entries(byDoctor).map(([doctorId, records]: [string, any]) => {
      const totalReports = sumBy(records, (r: any) => r.reportCount);
      const totalDefect = sumBy(records, (r: any) => r.defectCount);
      const totalCritical = sumBy(records, (r: any) => r.criticalValueCount);
      return {
        doctorId,
        doctorName: records[0]?.doctorName || '',
        title: records[0]?.title || '',
        month,
        totalReports,
        totalDefect,
        totalCritical,
        avgQCScore: avgBy(records, (r: any) => r.qcScore),
      };
    }).sort((a, b) => b.totalReports - a.totalReports);
    return HttpResponse.json({ success: true, data: result });
  }),

  // 质量评分 (QUALITY_SCORE_PRE 按月聚合)
  http.get(`${API_BASE}/stats/quality`, async () => {
    await delay(80);
    const all = list<any>('qualityScores');
    const avgScore = avgBy(all, (q: any) => q.totalScore);
    const byGrade: Record<string, number> = {};
    for (const q of all) {
      byGrade[q.grade] = (byGrade[q.grade] || 0) + 1;
    }
    // 按医生 Top 10
    const byDocMap = groupBy(all, (q: any) => q.doctorId);
    const byDoctor = Object.entries(byDocMap).map(([doctorId, records]: [string, any]) => ({
      doctorId,
      doctorName: records[0]?.doctorName || '',
      score: Math.round(avgBy(records, (r: any) => r.totalScore) * 10) / 10,
      count: records.length,
    })).sort((a, b) => b.score - a.score).slice(0, 10);
    // 按模态
    const byModMap = groupBy(all, (q: any) => q.modality);
    const byModality = Object.entries(byModMap).map(([modality, records]: [string, any]) => ({
      modality,
      score: Math.round(avgBy(records, (r: any) => r.totalScore) * 10) / 10,
      count: records.length,
    }));
    return HttpResponse.json({ success: true, data: {
      averageScore: Math.round(avgScore * 10) / 10,
      totalScored: all.length,
      byGrade, byDoctor, byModality,
    } });
  }),

  // Dashboard 汇总
  http.get(`${API_BASE}/stats/dashboard`, async () => {
    await delay(80);
    const exams = list<any>('exams');
    const patients = list<any>('patients');
    const criticalEvents = list<any>('criticalEvents');
    const dailyKpi = list<any>('dailyKpi');
    const today = dailyKpi[dailyKpi.length - 1] || { examCount: 0, reportCount: 0 };
    const openCritical = criticalEvents.filter((c: any) => c.status !== '已闭环').length;
    const deviceActive = list<any>('devices').filter((d: any) => d.status === '运行中').length;
    const doctorActive = list<any>('doctors').filter((d: any) => d.active).length;
    return HttpResponse.json({ success: true, data: {
      today: { exams: today.examCount, reports: today.reportCount },
      totals: { exams: exams.length, patients: patients.length, criticalEvents: criticalEvents.length },
      alerts: { openCritical, devicesActive: deviceActive, doctorsActive: doctorActive },
    } });
  }),

  // 按模态趋势
  http.get(`${API_BASE}/stats/by-modality`, async () => {
    await delay(80);
    const all = list<any>('dailyKpi');
    const byModality: Record<string, { total: number; days: number; avg: number }> = {};
    for (const k of all) {
      for (const [mod, count] of Object.entries(k.byModality || {})) {
        if (!byModality[mod]) byModality[mod] = { total: 0, days: 0, avg: 0 };
        byModality[mod].total += count as number;
        byModality[mod].days += 1;
      }
    }
    for (const v of Object.values(byModality)) v.avg = Math.round(v.total / v.days);
    return HttpResponse.json({ success: true, data: byModality });
  }),

  // 趋势 (DAILY_KPI_PRE 全部)
  http.get(`${API_BASE}/stats/trend`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const all = list<any>('dailyKpi');
    return HttpResponse.json({ success: true, data: all.slice(-days).map(toDailyKpiDto) });
  }),

  // Top N (按模态的检查数)
  http.get(`${API_BASE}/stats/top-modalities`, async () => {
    await delay(80);
    const all = list<any>('dailyKpi');
    const totals: Record<string, number> = {};
    for (const k of all) {
      for (const [m, v] of Object.entries(k.byModality || {})) {
        totals[m] = (totals[m] || 0) + (v as number);
      }
    }
    return HttpResponse.json({
      success: true,
      data: Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([modality, count]) => ({ modality, count })),
    });
  }),

  // Top 设备
  http.get(`${API_BASE}/stats/top-devices`, async () => {
    await delay(80);
    const all = list<any>('dailyKpi');
    const totals: Record<string, number> = {};
    for (const k of all) {
      for (const d of k.topDevices || []) {
        totals[d.deviceId] = (totals[d.deviceId] || 0) + d.count;
      }
    }
    return HttpResponse.json({
      success: true,
      data: Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([deviceId, count]) => ({ deviceId, count })),
    });
  }),

  // 导出 CSV
  http.get(`${API_BASE}/stats/export.csv`, async () => {
    await delay(200);
    const all = list<any>('dailyKpi');
    const header = 'date,examCount,reportCount,criticalCount,cosignCount,avgTAT,defectCount,qcAvgScore';
    const rows = all.map((k: any) => `${k.date},${k.examCount},${k.reportCount},${k.criticalCount},${k.cosignCount},${k.avgTAT},${k.defectCount},${k.qcAvgScore}`);
    return new HttpResponse([header, ...rows].join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="stats.csv"' } });
  }),
];

// ============= Terms(2) =============
export const termHandlers = [
  http.get(`${API_BASE}/terms/search`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const results = FEATURED_TERMS.filter((t) =>
      t.term.includes(q) || t.pinyin.startsWith(q.toLowerCase())
    );
    return HttpResponse.json({ success: true, data: results });
  }),

  http.get(`${API_BASE}/terms/categories`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: TERM_CATEGORIES });
  }),
];

// ============= Users (14) - v3.0.6.8-32 接入 DOCTOR_MASTER =============
export const userHandlers = [
  // 列表 (DOCTOR_MASTER 75)
  http.get(`${API_BASE}/users`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('doctors');
    const result = applyQuery<any>(all, opts, ['name', 'id', 'subspecialty', 'department', 'certifications']);
    return HttpResponse.json({ success: true, data: result.data.map(toUserDto), meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
  }),

  // 按角色分组 (必须在 :id 之前)
  

  // 按科室分组
  

  // 排班 (整院)
  

  // 用户统计
  

  // 详情 (完整 UserDto 22 字段)
  http.get(`${API_BASE}/users/:id`, async ({ params }) => {
    await delay(50);
    const u = get<any>('doctors', params.id as string);
    if (!u) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toUserDto(u) });
  }),

  // 用户的绩效记录
  

  // 创建
  http.post(`${API_BASE}/users`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const newUser = { ...body, id: body.id || `D${String(Date.now()).slice(-3).padStart(3, '0')}` };
    create('doctors', newUser);
    auditCreate('users', newUser);
    return HttpResponse.json({ success: true, data: toUserDto(newUser) }, { status: 201 });
  }),

  // 更新
  http.put(`${API_BASE}/users/:id`, async ({ params, request }) => {
    await delay(120);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('doctors', id);
    const updated = update<any>('doctors', id, body);
    if (updated) auditUpdate('users', before, updated);
    return HttpResponse.json({ success: true, data: updated ? toUserDto(updated) : null });
  }),

  // 删除
  http.delete(`${API_BASE}/users/:id`, async ({ params }) => {
    await delay(100);
    const id = params.id as string;
    const before = get<any>('doctors', id);
    const existed = remove('doctors', id);
    if (existed) auditDelete({ resource: 'users', resourceId: id, before });
    return new HttpResponse(null, { status: existed ? 204 : 404 });
  }),

  // 重置密码
  

  // 权限更新 (RBAC)
  
];

// ============= Consultations (12) - v3.0.6.8-32 接入 EXAM_REPORT_PRE + DOCTOR_MASTER =============
export const consultationHandlers = [
  // 列表 (派生自 EXAM_REPORT_PRE 中 critical 的报告)
  http.get(`${API_BASE}/consultations`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('exams').filter((e: any) => e.hasCriticalValue).slice(0, 100);
    const consultations = all.map((e: any, idx: number) => {
      const statusMap: Record<string, string> = { 0: '已完成', 1: '待回复', 2: '已回复' };
      const typeMap = ['疑难病例', '远程会诊', '急诊会诊'];
      const deptMap = ['放射科', '心内科', '神经科', '肿瘤科'];
      return {
        id: `C-${e.reportId}`,
        consultationId: `CST${e.reportId.replace('RPT-', '')}`,
        examId: e.reportId,
        patientId: e.patientId,
        patientName: e.patientName,
        modality: e.modality,
        bodyPart: e.bodyPart,
        status: statusMap[idx % 3],
        consultationType: typeMap[idx % 3],
        type: typeMap[idx % 3],
        isRemote: idx % 2 === 0,
        requestingDepartment: deptMap[idx % deptMap.length],
        consultedDepartment: deptMap[(idx + 1) % deptMap.length],
        consultedDoctorName: '张三',
        urgency: e.priority === '急诊' ? '紧急' : '普通',
        requestTime: String(e.examAt || '').replace('T', ' ').slice(0, 19),
        scheduledAt: e.examAt,
        requestedBy: e.reportDoctorId,
        consultant: 'D002',
        consultants: ['D002', 'D003'],
        priority: e.priority,
        requestReason: e.impression || '需要进一步会诊确认诊断',
        notes: e.impression,
        duration: '00:30:00',
        participants: [e.reportDoctorId, 'D002'],
      };
    });
    const result = applyQuery(consultations, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  // 待会诊 (未完成)
  http.get(`${API_BASE}/consultations/pending`, async () => {
    await delay(50);
    const all = list<any>('exams').filter((e: any) => e.hasCriticalValue).slice(0, 20);
    const pending = all.map((e: any, idx: number) => ({
      id: `C-${e.reportId}`, examId: e.reportId, patientName: e.patientName,
      status: 'scheduled', priority: e.priority,
    }));
    return HttpResponse.json({ success: true, data: pending });
  }),

  // 按患者
  http.get(`${API_BASE}/consultations/by-patient/:patientId`, async ({ params }) => {
    await delay(50);
    const exams = list<any>('exams').filter((e: any) => e.patientId === params.patientId && e.hasCriticalValue);
    return HttpResponse.json({ success: true, data: exams });
  }),

  // 按医生
  http.get(`${API_BASE}/consultations/by-doctor/:doctorId`, async ({ params }) => {
    await delay(50);
    const exams = list<any>('exams').filter((e: any) => e.reportDoctorId === params.doctorId && e.hasCriticalValue);
    return HttpResponse.json({ success: true, data: exams });
  }),

  // 详情
  http.get(`${API_BASE}/consultations/:id`, async ({ params }) => {
    await delay(50);
    const reportId = (params.id as string).replace('C-', '');
    const exam = get<any>('exams', reportId);
    if (!exam) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: { id: params.id, examId: reportId, ...exam } });
  }),

  // 创建
  http.post(`${API_BASE}/consultations`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const newCons = { id: `C-${Date.now()}`, ...body, status: 'scheduled', createdAt: new Date().toISOString() };
    auditCreate('consultations', newCons);
    return HttpResponse.json({ success: true, data: newCons }, { status: 201 });
  }),

  // 更新
  http.put(`${API_BASE}/consultations/:id`, async ({ params, request }) => {
    await delay(120);
    return HttpResponse.json({ success: true, data: { id: params.id, ...(await request.json()) } });
  }),

  // 取消
  http.post(`${API_BASE}/consultations/:id/cancel`, async ({ params }) => {
    await delay(80);
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'cancel', entityType: 'consultations', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } });
  }),

  // 完成
  http.post(`${API_BASE}/consultations/:id/complete`, async ({ params, request }) => {
    await delay(80);
    const body = (await request.json()) as { conclusion: string };
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'complete', entityType: 'consultations', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'completed', conclusion: body.conclusion } });
  }),
];

// ============= Queue (10) - v3.0.6.8-32 接入 EXAM_REPORT_PRE + DEVICE_MASTER =============
export const queueHandlers = [
  // 队列 (按 status=submitted/reviewed 派生)
  http.get(`${API_BASE}/queue`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('exams').filter((e: any) => e.status === 'submitted' || e.status === 'reviewed');
    const result = applyQuery(all, opts);
    const queueItems = result.data.map((e: any, idx: number) => ({
      id: `q-${e.reportId}`,
      queueNumber: `${e.modality}-${String(idx + 1).padStart(3, '0')}`,
      patientName: e.patientName,
      examItem: e.examItem,
      roomId: e.deviceId,
      modality: e.modality,
      status: e.status === 'submitted' ? 'waiting' : 'in_service',
      priority: e.priority,
      arrivedAt: e.examAt,
      estimatedWaitMin: (result.data.length - idx) * 5,
    }));
    return HttpResponse.json({ success: true, data: queueItems, meta: { total: result.total } });
  }),

  // 房间状态 (DEVICE_MASTER.room)
  http.get(`${API_BASE}/queue/rooms`, async () => {
    await delay(80);
    const devices = list<any>('devices');
    const rooms = devices.map((d: any) => ({
      id: d.id,
      roomNumber: d.room,
      modality: d.modality,
      status: d.status === '运行中' ? '使用中' : d.status === '待机' ? '空闲' : '维护中',
      deviceId: d.id,
      deviceName: d.model,
      queueCount: Math.floor(Math.random() * 5),
    }));
    return HttpResponse.json({ success: true, data: rooms });
  }),

  // 房间详情
  http.get(`${API_BASE}/queue/rooms/:roomId`, async ({ params }) => {
    await delay(50);
    const room = get<any>('devices', params.roomId as string);
    if (!room) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: {
      id: room.id, roomNumber: room.room, modality: room.modality,
      status: room.status === '运行中' ? '使用中' : '空闲',
    } });
  }),

  // 队列统计
  

  // 叫号
  http.post(`${API_BASE}/queue/:id/call`, async ({ params }) => {
    await delay(80);
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'call', entityType: 'queue', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'called', calledAt: new Date().toISOString() } });
  }),

  // 完成
  http.post(`${API_BASE}/queue/:id/complete`, async ({ params }) => {
    await delay(80);
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'complete', entityType: 'queue', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'completed', completedAt: new Date().toISOString() } });
  }),

  // 重叫
  http.post(`${API_BASE}/queue/:id/recall`, async ({ params }) => {
    await delay(80);
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'recall', entityType: 'queue', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'recalled' } });
  }),
];

// ============= Terms (6) =============
export const termListHandlers = [
  http.get(`${API_BASE}/terms`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: [
      { id: 'T001', name: '肺结节', category: 'finding', description: '肺部占位性病变' },
      { id: 'T002', name: '钙化', category: 'finding', description: '组织钙质沉积' },
      { id: 'T003', name: '毛刺征', category: 'morphology', description: '边缘毛刺状' },
      { id: 'T004', name: '分叶征', category: 'morphology', description: '边缘分叶状' },
      { id: 'T005', name: '磨玻璃密度', category: 'density', description: 'GGO' },
    ] });
  }),
  http.get(`${API_BASE}/terms/:id`, async ({ params }) => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { id: params.id, term: 'mock' } });
  }),
  http.post(`${API_BASE}/terms`, async ({ request }) => {
    await delay(120);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: 'T' + Date.now(), ...(body as object) } }, { status: 201 });
  }),
  http.put(`${API_BASE}/terms/:id`, async ({ params, request }) => {
    await delay(120);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
  }),
  http.delete(`${API_BASE}/terms/:id`, async () => new HttpResponse(null, { status: 204 })),
];

// ============= Insurance Audits (5) =============
export const insuranceHandlers = [
  http.get(`${API_BASE}/insurance-audits`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: [
      { id: 'IA001', patientName: '张三', insuranceType: '城镇职工', totalAmount: 2500, claimAmount: 1750, status: 'pending', createdAt: '2026-07-01T10:00:00Z' },
      { id: 'IA002', patientName: '李四', insuranceType: '城乡居民', totalAmount: 1800, claimAmount: 1080, status: 'approved', createdAt: '2026-06-28T09:30:00Z' },
      { id: 'IA003', patientName: '王五', insuranceType: '城镇职工', totalAmount: 3200, claimAmount: 2240, status: 'rejected', rejectReason: '资料不全', createdAt: '2026-06-25T14:00:00Z' },
    ] });
  }),
  http.get(`${API_BASE}/insurance-audits/:id`, async ({ params }) => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'pending' } });
  }),
  http.post(`${API_BASE}/insurance-audits`, async ({ request }) => {
    await delay(150);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: 'I' + Date.now(), ...(body as object) } }, { status: 201 });
  }),
  http.post(`${API_BASE}/insurance-audits/:id/approve`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'approved' } });
  }),
  http.post(`${API_BASE}/insurance-audits/:id/reject`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as { reason?: string };
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'rejected', reason: body.reason } });
  }),
];

// ============= Materials (8) - v3.0.6.8-32 接入 EXAM_ITEM_MASTER.contrastAgent =============
export const materialsHandlers = [
  // 列表 (从 EXAM_ITEM_MASTER 派生对比剂 + 耗材)
  

  // 库存预警
  

  // 详情
  

  // 创建
  

  // 更新
  

  // 删除
  

  // 入库 (增库存)
  

  // 出库 (减库存)
  
];

// ============= Dose Records (16) - v3.0.6.8-32 接入 DAILY_KPI_PRE + EXAM_REPORT_PRE + DEVICE_MASTER =============
// [v3.0.6.11-60] 剂量管理 DRL 端点迁移至 ./doseHandlers (rdsr/drl|today|patients|cumulative|alerts)

// ============= Schedules (10) - v3.0.6.8-32 接入 DOCTOR_MASTER =============
export const scheduleHandlers = [
  // 全部排班
  

  // 按周 (周一到周日)
  

  // 冲突检测
  

  // 创建排班
  

  // 更新排班
  

  // 按医生
  

  // 按模态 (派生)
  
];

// ============= Notifications (14) - v3.0.6.8-32 接入 EXAM_REPORT_PRE + CRITICAL_EVENTS_PRE =============
export const notificationHandlers = [
  // 列表 (派生自危急值事件 + 报告状态)
  http.get(`${API_BASE}/notifications`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const unread = url.searchParams.get('unread');
    const opts = parseQuery(url);
    const criticalEvents = list<any>('criticalEvents').slice(0, 50);
    const exams = list<any>('exams').filter((e: any) => e.status === 'submitted').slice(0, 30);
    const notifs: any[] = [
      ...criticalEvents.map((c: any) => ({
        id: `notif-critical-${c.id}`,
        title: `危急值: ${c.category}`,
        content: `患者 ${c.patientName} ${c.modality} 检查发现 ${c.value}`,
        type: 'critical',
        severity: c.category,
        isRead: Math.random() > 0.5,
        createdAt: c.discoveredAt,
        patientId: c.patientId,
        doctorId: c.discoverDoctorId,
      })),
      ...exams.map((e: any) => ({
        id: `notif-review-${e.reportId}`,
        title: `审核提醒`,
        content: `报告 ${e.reportId} ${e.patientName} 待审核`,
        type: 'review',
        isRead: Math.random() > 0.7,
        createdAt: e.examAt,
        patientId: e.patientId,
        doctorId: e.reportDoctorId,
      })),
    ];
    const filtered = unread === 'true' ? notifs.filter(n => !n.isRead) : notifs;
    const result = applyQuery(filtered, opts, ['title', 'content']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  // 未读数
  

  // 标记已读
  

  // 批量标记已读
  http.post(`${API_BASE}/notifications/mark-all-read`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { markedAt: new Date().toISOString(), count: 0 } });
  }),

  // 发送通知
  http.post(`${API_BASE}/notifications/send`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const notif = {
      id: `notif-${Date.now()}`,
      ...body,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    auditCreate('notifications', notif);
    return HttpResponse.json({ success: true, data: notif }, { status: 201 });
  }),

  // 推送 (多通道)
  

  // 删除
  http.delete(`${API_BASE}/notifications/:id`, async ({ params }) => {
    auditDelete({ resource: 'notifications', resourceId: params.id as string });
    return new HttpResponse(null, { status: 204 });
  }),

  // 按类型
  
];

// ============= Templates (7) =============
export const templateHandlers = [
  http.get(`${API_BASE}/templates`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    let data = [
      { id: 'tpl-1', name: '胸部CT平扫模板', category: 'CT', content: '影像所见：...\n诊断意见：...', isPublic: true, createdAt: '2026-01-01' },
      { id: 'tpl-2', name: '腹部MRI增强模板', category: 'MRI', content: '影像所见：...\n诊断意见：...', isPublic: true, createdAt: '2026-01-02' },
    ];
    if (category) data = data.filter((t) => t.category === category);
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/templates/:id`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { id: params.id, name: '模板', category: 'CT', content: '影像所见：...', isPublic: true } });
  }),
  http.post(`${API_BASE}/templates`, async ({ request }) => {
    await delay(200);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: 'tpl-' + Date.now(), ...(body as object) } }, { status: 201 });
  }),
  http.put(`${API_BASE}/templates/:id`, async ({ params, request }) => {
    await delay(150);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
  }),
  http.delete(`${API_BASE}/templates/:id`, async () => new HttpResponse(null, { status: 204 })),
  
];

// ============= Dictionary (6) =============
export const dictionaryHandlers = [
  http.get(`${API_BASE}/dictionary`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    let data = [
      { id: 'dict-1', type: 'modality', code: 'CT', name: 'CT', description: '计算机断层扫描' },
      { id: 'dict-2', type: 'modality', code: 'MR', name: 'MR', description: '磁共振成像' },
      { id: 'dict-3', type: 'exam_status', code: 'pending', name: '待检查' },
      { id: 'dict-4', type: 'exam_status', code: 'completed', name: '已完成' },
    ];
    if (type) data = data.filter((d) => d.type === type);
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/dictionary/:id`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { id: params.id, type: 'modality', code: 'CT', name: 'CT' } });
  }),
  http.post(`${API_BASE}/dictionary`, async ({ request }) => {
    await delay(200);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: 'dict-' + Date.now(), ...(body as object) } }, { status: 201 });
  }),
  http.put(`${API_BASE}/dictionary/:id`, async ({ params, request }) => {
    await delay(150);
    const body = await request.json();
    return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
  }),
  http.delete(`${API_BASE}/dictionary/:id`, async () => new HttpResponse(null, { status: 204 })),
  
];

// ============= Safety (15) =============
import { MOCK_ADVERSE_EVENTS, MOCK_RCA_INVESTIGATIONS, MOCK_RISK_ITEMS } from './data/index';

const inMemorySafety = {
  adverseEvents: [...MOCK_ADVERSE_EVENTS],
  rcaInvestigations: [...MOCK_RCA_INVESTIGATIONS],
  riskItems: [...MOCK_RISK_ITEMS],
};

export const safetyHandlers = [
  // AdverseEvent
  http.get(`${API_BASE}/safety/adverse-events`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const eventType = url.searchParams.get('eventType');
    let data = inMemorySafety.adverseEvents;
    if (status) data = data.filter(e => e.status === status);
    if (severity) data = data.filter(e => e.severity === severity);
    if (eventType) data = data.filter(e => e.eventType === eventType);
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/safety/adverse-events/:id`, async ({ params }) => {
    await delay(80);
    const item = inMemorySafety.adverseEvents.find(e => e.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'AdverseEvent not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/safety/adverse-events`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as Record<string, unknown>;
    const newItem = { id: 'ae-' + Date.now(), reportedAt: new Date().toISOString(), status: 'reported', version: 0, ...body };
    inMemorySafety.adverseEvents.push(newItem as any);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${API_BASE}/safety/adverse-events/:id`, async ({ params, request }) => {
    await delay(120);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = inMemorySafety.adverseEvents.findIndex(e => e.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'AdverseEvent not found' } }, { status: 404 });
    const existing = inMemorySafety.adverseEvents[idx]!;
    inMemorySafety.adverseEvents[idx] = { ...existing, ...body, version: (existing.version ?? 0) + 1 };
    return HttpResponse.json({ success: true, data: inMemorySafety.adverseEvents[idx] });
  }),
  http.delete(`${API_BASE}/safety/adverse-events/:id`, async ({ params }) => {
    await delay(80);
    const idx = inMemorySafety.adverseEvents.findIndex(e => e.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'AdverseEvent not found' } }, { status: 404 });
    inMemorySafety.adverseEvents.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // RcaInvestigation
  http.get(`${API_BASE}/safety/rca-investigations`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const capaStatus = url.searchParams.get('capaStatus');
    let data = inMemorySafety.rcaInvestigations;
    if (capaStatus) data = data.filter(r => r.capaStatus === capaStatus);
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/safety/rca-investigations/:id`, async ({ params }) => {
    await delay(80);
    const item = inMemorySafety.rcaInvestigations.find(r => r.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'RcaInvestigation not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/safety/rca-investigations`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as Record<string, unknown>;
    const newItem = { id: 'rca-' + Date.now(), dateInvestigationStarted: new Date().toISOString(), capaStatus: 'open', status: 'open', version: 0, ...body };
    inMemorySafety.rcaInvestigations.push(newItem as any);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${API_BASE}/safety/rca-investigations/:id`, async ({ params, request }) => {
    await delay(120);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = inMemorySafety.rcaInvestigations.findIndex(r => r.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'RcaInvestigation not found' } }, { status: 404 });
    const existing = inMemorySafety.rcaInvestigations[idx]!;
    inMemorySafety.rcaInvestigations[idx] = { ...existing, ...body, version: (existing.version ?? 0) + 1 };
    return HttpResponse.json({ success: true, data: inMemorySafety.rcaInvestigations[idx] });
  }),
  http.delete(`${API_BASE}/safety/rca-investigations/:id`, async ({ params }) => {
    await delay(80);
    const idx = inMemorySafety.rcaInvestigations.findIndex(r => r.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'RcaInvestigation not found' } }, { status: 404 });
    inMemorySafety.rcaInvestigations.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // RiskItem
  http.get(`${API_BASE}/safety/risk-items`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const riskLevel = url.searchParams.get('riskLevel');
    const status = url.searchParams.get('status');
    let data = inMemorySafety.riskItems;
    if (riskLevel) data = data.filter(r => r.riskLevel === riskLevel);
    if (status) data = data.filter(r => r.status === status);
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/safety/risk-items/:id`, async ({ params }) => {
    await delay(80);
    const item = inMemorySafety.riskItems.find(r => r.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'RiskItem not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/safety/risk-items`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as Record<string, unknown>;
    const newItem = { id: 'risk-' + Date.now(), identifiedAt: new Date().toISOString(), status: 'identified', version: 0, ...body };
    inMemorySafety.riskItems.push(newItem as any);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${API_BASE}/safety/risk-items/:id`, async ({ params, request }) => {
    await delay(120);
    const body = (await request.json()) as Record<string, unknown>;
    const idx = inMemorySafety.riskItems.findIndex(r => r.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'RiskItem not found' } }, { status: 404 });
    const existing = inMemorySafety.riskItems[idx]!;
    inMemorySafety.riskItems[idx] = { ...existing, ...body, version: (existing.version ?? 0) + 1 };
    return HttpResponse.json({ success: true, data: inMemorySafety.riskItems[idx] });
  }),
  http.delete(`${API_BASE}/safety/risk-items/:id`, async ({ params }) => {
    await delay(80);
    const idx = inMemorySafety.riskItems.findIndex(r => r.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'RiskItem not found' } }, { status: 404 });
    inMemorySafety.riskItems.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

// ============= R3.REVIEW 审核流 (80) =============
import { REVIEW_TASKS, REVIEWERS, COSIGN_SCHEDULES, SLA_METRICS, WORKLOAD_STATS, REVIEW_KPI, REJECT_TEMPLATES, REVIEW_COMMENTS, AI_PRE_REVIEW_RESULTS, REVIEWER_ASSIGNMENTS } from '../../data/reportReviewMock';
import { COSIGN_CERTIFICATES, COSIGN_INBOX, COSIGN_REJECT_TEMPLATES, COSIGN_CALENDAR, COSIGN_AUDIT_LOG, COSIGN_KPI } from '../../data/cosignMock';
import { QUALITY_DIMENSIONS, QUALITY_GRADES, QUALITY_WEIGHTS, QUALITY_SCORING_CONFIG, QUALITY_SCORES, QUALITY_KPI, QUALITY_DEFECTS, QUALITY_RULE_VERSIONS, QUALITY_DASHBOARD, MONTHLY_QUALITY_REPORT, DEFECT_REMEDIATIONS } from '../../data/reportQualityMock';
import { DEFECT_CATEGORIES, DEFECT_DETAILS, DEFECT_TREE, DEFECT_ANALYTICS, DEFECT_IMPORT_RECORDS } from '../../data/defectLibraryMock';

export const reviewHandlers = [
  // Tasks
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  http.get(`${API_BASE}/reviews/sla`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: SLA_METRICS });
  }),
  
  
  
  http.get(`${API_BASE}/reviews/workload`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: WORKLOAD_STATS });
  }),
  // [v3.0.6.8-48] PR4: 初核 (initial check)
  http.get(`${API_BASE}/review/initial-check`, async () => {
    await delay(50);
    const all = list<any>("exams").slice(0, 20);
    return HttpResponse.json({ success: true, data: all.map((e: any) => ({
      id: e.reportId, reportId: e.reportId, patientName: e.patientName, modality: e.modality, bodyPart: e.bodyPart,
      reviewerName: e.reportDoctorId, status: e.status === "published" ? "approved" : e.status === "rejected" ? "rejected" : "pending",
      checkItems: [{ name: "描述完整", passed: true }, { name: "影像匹配", passed: true }],
      createdAt: e.examAt,
    })) });
  }),

  http.get(`${API_BASE}/review/initial-check/:id`, async ({ params }) => {
    return HttpResponse.json({ success: true, data: { id: params.id, reportId: params.id, status: "pending", patientName: "Test", checkItems: [] } });
  }),

  http.post(`${API_BASE}/review/initial-check`, async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: body.reportId, ...body, status: "pending" } }, { status: 201 });
  }),

  http.post(`${API_BASE}/review/initial-check/:id/approve`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'approved', note: body.note, reviewedAt: new Date().toISOString() } });
  }),

  http.post(`${API_BASE}/review/initial-check/:id/reject`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'rejected', reason: body.reason } });
  }),

  http.post(`${API_BASE}/review/initial-check/:id/override`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'overridden', reason: body.reason } });
  }),

  http.get(`${API_BASE}/review/initial-check/summary`, async () => {
    return HttpResponse.json({ success: true, data: { total: 50, pending: 12, approved: 30, rejected: 6, overridden: 2 } });
  }),

  // [v3.0.6.8-48] PR4: 终核 (final check)
  http.get(`${API_BASE}/review/final-check`, async () => {
    return HttpResponse.json({ success: true, data: list<any>("exams").slice(0, 20).map((e: any) => ({
      id: e.reportId, reportId: e.reportId, templateName: "Default Template", status: "pending", priority: "normal",
      createdAt: e.examAt,
    })) });
  }),

  http.get(`${API_BASE}/review/final-check/:id`, async ({ params }) => {
    return HttpResponse.json({ success: true, data: { id: params.id, reportId: params.id, status: "pending", priority: "normal", notes: [] } });
  }),

  http.post(`${API_BASE}/review/final-check`, async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: body.reportId, ...body, status: "in_progress" } }, { status: 201 });
  }),

  http.post(`${API_BASE}/review/final-check/:id/score`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, score: body.score, status: 'in_progress' } });
  }),

  http.post(`${API_BASE}/review/final-check/:id/approve`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'approved', finalNote: body.finalNote, approvedAt: new Date().toISOString() } });
  }),

  http.post(`${API_BASE}/review/final-check/:id/reject`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'rejected', reason: body.reason } });
  }),

  http.get(`${API_BASE}/review/final-check/summary`, async () => {
    return HttpResponse.json({ success: true, data: { total: 30, pending: 8, approved: 18, rejected: 4, avgScore: 88.5, avgTAT: 3.2 } });
  }),

  // [fix] PR4: 复审列表 (bare /reviews path)
  http.get(`${API_BASE}/reviews`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: list<any>("exams").slice(0, 20).map((e: any) => ({
      id: e.reportId, type: 'final', status: 'pending', priority: 'normal',
      sla: { deadline: new Date(Date.now() + 86400000).toISOString(), remaining: 24, breached: false },
      createdAt: e.examAt,
    })) });
  }),

  // [v3.0.6.8-48] PR4: 复审 (review)
  http.get(`${API_BASE}/reviews/:id`, async ({ params }) => {
    return HttpResponse.json({ success: true, data: { id: params.id, type: 'final', status: 'pending', priority: 'normal', sla: { deadline: new Date(Date.now() + 86400000).toISOString(), remaining: 24, breached: false }, createdAt: new Date().toISOString() } });
  }),

  http.post(`${API_BASE}/reviews/:id/assign`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, assignee: body.assignee, status: 'in_progress' } });
  }),

  http.post(`${API_BASE}/reviews/:id/approve`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'approved', completedAt: new Date().toISOString() } });
  }),

  http.post(`${API_BASE}/reviews/:id/reject`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'rejected', reason: body.reason } });
  }),

  

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  http.get(`${API_BASE}/ai/pre-review/:reportId`, async ({ params }) => {
    await delay(800);
    const ai = AI_PRE_REVIEW_RESULTS.find((r: any) => r.reportId === params.reportId);
    return HttpResponse.json({ success: true, data: ai ?? {
      id: 'ai-' + Date.now(), reportId: params.reportId, suggestedScore: 85, confidence: 0.85,
      defects: [], suggestions: ['整体质量良好'], riskLevel: 'low',
      consistencyScore: 0.88, completenessScore: 0.85, terminologyScore: 0.90,
      criticalFindingDetected: false, generatedAt: new Date().toISOString(), modelVersion: 'v2.3.1',
    } });
  }),
  http.post(`${API_BASE}/ai/pre-review/:reportId`, async ({ params }) => {
    await delay(1500);
    return HttpResponse.json({ success: true, data: { id: 'ai-' + Date.now(), reportId: params.reportId, generatedAt: new Date().toISOString() } });
  }),
  http.post(`${API_BASE}/reviews/:id/assign`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as { reviewerId: string };
    return HttpResponse.json({ success: true, data: { id: params.id, reviewerId: body.reviewerId } });
  }),
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
];

// ============= R3.QUALITY 质控 (60) =============
export const qualityHandlers = [
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
];

// ============= R3.CRITICAL 危急值 (30) =============
// [v3.0.6.12-A4] 所有 criticalHandlers 路由改读 store.critical* collection,
//   criticalValueMock 仅保留常量 (规则/级别/升级/KPI) 作为 store 种子, 不直接被本 handler 引用.
export const criticalHandlers = [
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
];

// ============= R3.DEFECT 缺陷 (20) =============
export const defectHandlers = [
  
  
  http.get(`${API_BASE}/quality/defects/:code`, async ({ params }) => {
    await delay(80);
    const d = DEFECT_DETAILS.find((x: any) => x.code === params.code);
    return d ? HttpResponse.json({ success: true, data: d }) : HttpResponse.json({ success: false }, { status: 404 });
  }),
  
  http.put(`${API_BASE}/quality/defects/:code`, async ({ params, request }) => {
    await delay(120);
    return HttpResponse.json({ success: true, data: { code: params.code, ...(await request.json() as object) } });
  }),
  http.delete(`${API_BASE}/quality/defects/:code`, async () => new HttpResponse(null, { status: 204 })),
  
  
  
  
  
  
  
  
  
  
  
  
  
  
];

// ============= R3.SIGN 签章 (50) =============
export const signHandlers = [
  // 证书管理
  http.get(`${API_BASE}/sign/certs`, async () => {
    await delay(120);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'cert-001', serialNumber: '3A7F-9D2C-1145-E0B8', subject: { commonName: '张明远', userId: 'D001', role: 'doctor', title: '主任医师' }, certType: 'RSA-SHA256', status: 'active', notBefore: '2025-06-01T00:00:00Z', notAfter: '2027-06-01T00:00:00Z', publicKeyFingerprint: 'SHA256:7e2b:fa3c:9d12:4801:e9a6:bb34:c7f2:1d50', usageCount: 248, createdAt: '2025-06-01T09:00:00Z', createdBy: 'admin-ca' },
        { id: 'cert-002', serialNumber: '8C1E-4B7A-93DF-2206', subject: { commonName: '李慧敏', userId: 'D002', role: 'doctor', title: '副主任医师' }, certType: 'RSA-SHA256', status: 'active', notBefore: '2025-08-15T00:00:00Z', notAfter: '2026-08-15T00:00:00Z', publicKeyFingerprint: 'SHA256:1a3d:5e9b:c840:21fa:0e62:bb91:c723:4851', usageCount: 132, createdAt: '2025-08-15T10:30:00Z', createdBy: 'admin-ca' },
        { id: 'cert-003', serialNumber: '2F4D-8E1B-A039-7C58', subject: { commonName: '赵雪琴', userId: 'D006', role: 'doctor', title: '主任医师' }, certType: 'SM3-SM2', status: 'expired', notBefore: '2024-09-01T00:00:00Z', notAfter: '2025-09-01T00:00:00Z', publicKeyFingerprint: 'SM3:5c81:d3a7:9e42:01f6:7b9d:2148:cc05:6a39', usageCount: 67, createdAt: '2024-09-01T11:00:00Z', createdBy: 'admin-ca' },
        { id: 'cert-004', serialNumber: '6B5A-0FCE-7731-D49A', subject: { commonName: '王建华', userId: 'D003', role: 'doctor', title: '主治医师' }, certType: 'RSA-SHA256', status: 'active', notBefore: '2025-04-10T00:00:00Z', notAfter: '2026-07-10T00:00:00Z', publicKeyFingerprint: 'SHA256:3f7a:e1c4:9b50:28d1:06a3:5e9f:c712:48b3', usageCount: 89, createdAt: '2025-04-10T14:00:00Z', createdBy: 'admin-ca' },
      ],
    });
  }),
  http.get(`${API_BASE}/sign/certs/:id`, async ({ params }) => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { id: params.id, serialNumber: '3A7F-9D2C-1145-E0B8', status: 'active' } });
  }),
  http.post(`${API_BASE}/sign/certs`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { id: 'cert-' + Date.now(), serialNumber: 'NEW-' + Date.now(), status: 'active', usageCount: 0, createdAt: new Date().toISOString(), ...body } }, { status: 201 });
  }),
  http.delete(`${API_BASE}/sign/certs/:id`, async ({ params }) => {
    await delay(100);
    return new HttpResponse(null, { status: 204 });
  }),
  
  
  
  
  
  
  // 签章流程
  
  
  
  http.post(`${API_BASE}/sign/timestamp`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as { reportId: string; hash: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 'ts-' + Date.now(),
        reportId: body.reportId,
        timestamp: new Date().toISOString(),
        tsaName: 'G005 医院 TSA',
        tsaSerial: 'GHTSA-' + Date.now(),
        hashBefore: body.hash,
        trustLevel: 'hospital',
      },
    });
  }),
  
  
  
  
  http.get(`${API_BASE}/sign/blockchain/proofs`, async ({ request }) => {
    await delay(120);
    return HttpResponse.json({ success: true, data: [
      { id: 'bc-001', reportId: 'RP20260601001', txHash: '0xa3f5b7c9d1e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4', blockNumber: 18429501, network: 'hospital-chain', confirmations: 12840 },
    ] });
  }),
  
  
  
  
  http.get(`${API_BASE}/sign/verify/:id`, async ({ params }) => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        reportId: params.id,
        isValid: true,
        signerName: '李慧敏',
        algorithm: 'RSA-SHA256',
        signedAt: '2026-06-02T14:08:12Z',
        verifyCount: 1,
      },
    });
  }),
  
  // 发布 + 锁定
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
];

// ============= R3.AMEND 修订 (40) =============
export const amendHandlers = [
  http.get(`${API_BASE}/amend`, async ({ request }) => {
    await delay(120);
    return HttpResponse.json({ success: true, data: [
      { id: 'rev-ent-001', reportId: 'RP20260601001', version: 1, action: 'start', reason: '原报告遗漏右肺下叶磨玻璃结节', authorName: '张明远', createdAt: '2026-06-05T08:30:00Z' },
      { id: 'rev-ent-004', reportId: 'RP20260602008', version: 1, action: 'start', reason: '病理回报：腺癌，需修订原报告', authorName: '李慧敏', createdAt: '2026-06-03T15:30:00Z' },
      { id: 'rev-ent-006', reportId: 'RP20260603003', version: 1, action: 'start', reason: '左右位置描述错误', authorName: '王建华', createdAt: '2026-06-04T14:00:00Z' },
    ] });
  }),
  
  http.post(`${API_BASE}/amend/start`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { reportId: string; reason: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 'rev-' + Date.now(),
        reportId: body.reportId,
        version: 1,
        action: 'start',
        reason: body.reason,
        createdAt: new Date().toISOString(),
      },
    });
  }),
  http.put(`${API_BASE}/amend/:id`, async ({ params, request }) => {
    await delay(200);
    return HttpResponse.json({ success: true, data: { id: params.id, ...(await request.json() as object) } });
  }),
  
  http.post(`${API_BASE}/amend/:id/complete`, async ({ params }) => {
    await delay(200);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'amended', completedAt: new Date().toISOString() } });
  }),
  
  
  
  
  
  
  
  http.post(`${API_BASE}/amend/:id/approve`, async ({ params }) => {
    await delay(150);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'approved' } });
  }),
  http.post(`${API_BASE}/amend/:id/reject`, async ({ params, request }) => {
    await delay(150);
    const body = (await request.json()) as { reason: string };
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'rejected', reason: body.reason } });
  }),
  
  
  
  
  
  
  // Supplement
  
  
  
  
  
  
  
  // Pathology
  
  
  // Export
  
  
  // Critical / Missed
  
  
  
  
  
  
  
  
];

// ============= R3.AI 智能 (40) =============
export const aiReportHandlers = [
  // Draft
  http.post(`${API_BASE}/ai/generate`, async ({ request }) => {
    await delay(1200);
    const body = (await request.json()) as { scenario: string; clinicalHistory: string; reportId?: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 'aidraft-' + Date.now(),
        reportId: body.reportId ?? 'new-' + Date.now(),
        scenario: body.scenario,
        clinicalHistory: body.clinicalHistory,
        findings: 'AI 自动生成的所见（mock）',
        diagnosis: 'AI 自动生成的诊断（mock）',
        impression: 'AI 自动生成的意见（mock）',
        recommendations: '随访建议',
        confidence: { overall: 0.85, findings: 0.88, diagnosis: 0.82, impression: 0.85, level: 'high' },
        references: [],
        generatedAt: new Date().toISOString(),
        modelVersion: 'v2.3-mock',
        tokenUsage: { prompt: 230, completion: 480, total: 710 },
        processingMs: 1200,
      },
    });
  }),
  
  
  
  
  
  
  // PreReview
  http.get(`${API_BASE}/ai/pre-review/:id`, async ({ params }) => {
    await delay(800);
    return HttpResponse.json({
      success: true,
      data: {
        id: 'aipre-' + Date.now(),
        reportId: params.id,
        score: 88,
        defects: [
          { id: 'def-001', type: 'missing-key-finding', field: 'examFindings', severity: 'high', description: '建议明确描述右肺下叶磨玻璃结节' },
        ],
        suggestions: [],
        diff: [],
        criticalHits: [],
        consistency: { imageReportMatch: true, clinicalReportMatch: true, priorReportMatch: false, mismatchedFields: [], score: 92 },
        terminology: { totalTerms: 24, matchedTerms: 22, radlexHits: [], snomedHits: [] },
        confidence: { overall: 0.88, findings: 0.9, diagnosis: 0.85, impression: 0.89, level: 'high' },
        reviewedAt: new Date().toISOString(),
        modelVersion: 'v2.3-mock',
        processingMs: 800,
      },
    });
  }),
  
  // Defect
  http.post(`${API_BASE}/ai/defect-detect`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as { text: string };
    return HttpResponse.json({
      success: true,
      data: {
        defects: body.text.length < 20 ? [{ id: 'def-001', type: 'missing-key-finding', field: 'examFindings', severity: 'medium', description: '内容过短' }] : [],
        processingMs: 600,
      },
    });
  }),
  // Critical
  http.post(`${API_BASE}/ai/critical-detect`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as { text: string };
    const keywords = ['脑疝', '主动脉夹层', '肺栓塞'];
    const hits = keywords
      .filter((k) => body.text.includes(k))
      .map((k) => ({ id: 'crit-' + Date.now(), keyword: k, confidence: 0.9, recommendation: '建议双签' }));
    return HttpResponse.json({ success: true, data: { hits, processingMs: 500 } });
  }),
  // Synonym
  http.get(`${API_BASE}/ai/synonym`, async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const text = url.searchParams.get('text') ?? '';
    const synonyms: { original: string; synonyms: string[]; preferred: string }[] = [];
    if (text.includes('磨玻璃影')) synonyms.push({ original: '磨玻璃影', synonyms: ['磨玻璃密度影'], preferred: '磨玻璃密度影' });
    if (text.includes('占位')) synonyms.push({ original: '占位', synonyms: ['占位性病变'], preferred: '占位性病变' });
    return HttpResponse.json({ success: true, data: synonyms });
  }),
  // Similar
  
  // Key image
  
  // Lesion
  http.post(`${API_BASE}/ai/lesion-detect`, async ({ request }) => {
    await delay(1500);
    const body = (await request.json()) as { reportId: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 'lesion-' + Date.now(),
        reportId: body.reportId,
        totalLesions: 1,
        lesions: [
          { id: 'les-001', type: 'nodule', location: '右肺下叶背段', sizeMm: { length: 8, width: 7 }, confidence: 0.91 },
        ],
      },
    });
  }),
  
  // Error correct
  
  // Risk predict
  http.post(`${API_BASE}/ai/risk-predict`, async ({ request }) => {
    await delay(800);
    const body = (await request.json()) as { reportId: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 'risk-' + Date.now(),
        reportId: body.reportId,
        overallRisk: 'high',
        riskScore: 0.78,
        riskFactors: [
          { id: 'rf-001', category: 'finding', name: '磨玻璃结节 ≥ 6mm', weight: 0.35, description: '右肺下叶磨玻璃结节 8mm×7mm' },
        ],
        predictedOutcomes: [],
        earlyWarnings: [],
        recommendedActions: ['3 个月后复查'],
        confidence: { overall: 0.82, findings: 0.85, diagnosis: 0.78, impression: 0.83, level: 'medium' },
        predictedAt: new Date().toISOString(),
      },
    });
  }),
  // Differential
  http.post(`${API_BASE}/ai/differential`, async ({ request }) => {
    await delay(800);
    const body = (await request.json()) as { reportId: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 'ddx-' + Date.now(),
        reportId: body.reportId,
        primaryDiagnosis: '右肺下叶背段磨玻璃结节',
        differentials: [
          { id: 'dd-001', diagnosis: '非典型腺瘤样增生（AAH）', probability: 0.45, supportingFindings: ['纯磨玻璃密度'], contradictingFindings: [], reasoning: '典型表现' },
          { id: 'dd-002', diagnosis: '原位腺癌（AIS）', probability: 0.35, supportingFindings: ['磨玻璃密度结节'], contradictingFindings: [], reasoning: '需警惕' },
        ],
        recommendedTests: ['3 个月后复查 CT'],
        similarCases: [],
        confidence: { overall: 0.84, findings: 0.88, diagnosis: 0.8, impression: 0.85, level: 'medium' },
        generatedAt: new Date().toISOString(),
      },
    });
  }),
  // RADS
  http.post(`${API_BASE}/ai/rads`, async ({ request }) => {
    await delay(500);
    return HttpResponse.json({
      success: true,
      data: { system: 'Lung-RADS', category: '3', description: '可能良性结节', riskPercent: '1-2%', recommendation: '6 个月后复查' },
    });
  }),
  
  // Consistency
  
  
  // Audit
  
  
  // Health
  
  // Quota
  
  
  // Retry
  
  // Cache
  
  // Eval
  
  // Usage rank
  
  // Error log
  
  // Consent
  
  // Anonymize
  
  // Model upgrade
  
  // Modality
  
  
  // Dashboard
  
  // Annotation
  
];

// ============= R3.REVIEW INITIAL CHECK 初核清单 (20) =============
// [v3.0.6.8-91] 修复: 使用 mutableInMemoryCheckLists 避免直接修改导入常量
const mutableInMemoryCheckLists: any[] = [];

function getInitialCheckList(id: string) {
  if (mutableInMemoryCheckLists.length === 0) {
    mutableInMemoryCheckLists.push(...clone(INITIAL_CHECK_LISTS));
  }
  return mutableInMemoryCheckLists.find((l) => l.id === id);
}
function getInitialCheckLists() {
  if (mutableInMemoryCheckLists.length === 0) {
    mutableInMemoryCheckLists.push(...clone(INITIAL_CHECK_LISTS));
  }
  return mutableInMemoryCheckLists;
}

export const initialCheckHandlers = [
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  http.get(`${API_BASE}/review/initial-check/summary`, async () => {
    await delay(180);
    return HttpResponse.json({ success: true, data: INITIAL_CHECK_SUMMARY });
  }),
  
];

// ============= R3.REVIEW FINAL CHECK 终核清单 (20) =============
const finalCheckInMemory = {
  lists: clone(FINAL_CHECK_LISTS),
  notes: clone(FINAL_REVIEW_NOTES),
  multiSigs: clone(FINAL_MULTI_SIGNATURE_REQUESTS),
  emergencies: clone(EMERGENCY_REVIEW_REQUESTS),
  configs: clone(FINAL_CHECK_WORKFLOW_CONFIGS),
  events: clone(FINAL_CHECK_EVENTS),
  scoring: clone(FINAL_SCORING_RESULTS),
};

const finalCheckLogEvent = (taskId: string, reportId: string, type: string, actorId: string, actorName: string, payload: Record<string, unknown>) => {
  finalCheckInMemory.events.unshift({
    id: 'fce-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    taskId, reportId, type, actorId, actorName, payload, timestamp: new Date().toISOString(),
  });
};

export const finalCheckHandlers = [
  // 1. 模板 (15+ 检查项)
  

  // 2. 清单列表
  

  // 3. 启动终核
  

  // 4. 更新检查项状态
  

  // 5. 完成终核
  

  // 6. 临床一致性
  

  // 7. 评分细则
  

  // 8. 提交终评
  

  // 9. 驳回 -> 初审
  

  // 10. 驳回 -> 起草
  

  // 11. 笔记列表
  

  // 12. 添加笔记
  

  // 13. 工作量
  

  // 14. 既往报告对比
  

  // 15. 多签列表
  

  // 16. 发起多签
  

  // 17. 签章多签 slot
  

  // 18. 急诊通道列表
  

  // 19. 触发急诊通道
  

  // 20. 工作流配置 + 仪表盘合并
  

  // 21. 更新工作流配置 (额外)
  
];

// ============= v3.0.6.8-32 Phase 3+5: 高级特性端点 =============

// 工作流事件全局查询 (全院审计)
const advancedHandlers = [
  

  // 审计日志查询 (按时间/用户/资源类型过滤)
  

  // 危急值 SLA 升级状态
  

  // 危急值升级 (手动触发)
  

  // 影像质控评分计算
  

  // 限流状态查询
  

  // 系统统计概览 (后端运行状态)
  

  // IDB 状态
  
];

// ============= 总 handlers =============
// v3.0.6.11-7: 107 new endpoints from 14 modules
export const handlers = [
  ...shellBatch3Handlers, // [v3.0.6.11-60] Batch 3 壳页面 (需在 criticalValueHandlers 通配之前)
  ...smartWorklistHandlers, // [v3.0.6.11-60] Smart MWL 深度化 (worklist-smart / smart-route)
  ...advancedHandlers, // [v3.0.6.8-32] 高级端点优先注册,避免 /critical/:id 拦截 /critical/sla-status
  ...authHandlers,
  ...reportHandlers,
  ...examListHandlers, // [G005 P0] mock /exams 主数据源 (与真实后端一致)
  ...worklistHandlers,
  ...appointmentHandlers,
  ...patientHandlers,
  ...deviceHandlers,
  ...dicomHandlers,
  ...aiHandlers,
  ...criticalValueHandlers,
  ...printHandlers,
  ...statsHandlers,
  ...termHandlers,
  ...userHandlers,
  ...consultationHandlers,
  ...queueHandlers,
  ...termListHandlers,
  ...insuranceHandlers,
  ...materialsHandlers,
  ...doseHandlers,
  ...scheduleHandlers,
  ...notificationHandlers,
  ...templateHandlers,
  ...dictionaryHandlers,
  ...safetyHandlers,
  ...signHandlers,
  ...amendHandlers,
  ...aiReportHandlers,
  ...reviewHandlers,
  ...qualityHandlers,
  ...criticalHandlers,
  ...defectHandlers,
  ...initialCheckHandlers,
  ...qualityScoringHandlers,
  ...finalCheckHandlers,
  ...cosignHandlers,
  ...qualityReportHandlers,
  ...aiAssistHandlers,
  // [v3.0.6.12-B2] v3ReviewHandlers top-10 路由 store I/O (R3.REVIEW.ASSIST)
  //   必须在 reviewHandlers (handlers.ts 内 /reviews/:id 通配) 之前注册,
  //   否则 /reviews/reviewers, /reviews/reject-templates 等会被 :id 通配拦截.
  ...reviewAssistHandlers,
  // [v3.0.6.12-A4] top-20 路由 store I/O
  ...writingHandlers,
  ...distributionHandlers,
  ...integrationHandlers, // [v3.0.6.11-54] 修复: 集成端点未注册 (fhir/webhook/hl7)
  ...otherHandlers,       // [v3.0.6.11-54] 修复: 监控/analytics/帮助端点未注册 (/analytics/dashboard 500)
  ...eyeHandlers, // [v3.0.6.8-33] 眼科 180+ 端点
  ...dentalHandlers, // [v3.0.6.8-53] 口腔 24 端点 (Day 1 PACS)
  ...newPagesHandlers, // [v3.0.6.8-77] v67-v76 新页面后端
  ...systemHandlers,   // [v3.0.6.11-21] system/audit, system/backup, system/tenant-config, compliance
  ...tenantHandlers,   // [v3.0.6.11-60] 多租户: current/usage/profile/features + admin list/create/status
  ...storageHandlers,  // [v3.0.6.11-60] cloud-storage 配置 /system/storage-config
  ...wechatHandlers, // [P0-12 v3.0.7] 微信小程序 8 端点
  ...dentalNewHandlers,
  ...workflowHandlers,
  ...financeHandlers,
  ...dataReportHandlers,
  ...regionalHandlers,
  ...patientPortalHandlers,
  ...cosignNewHandlers,
  ...cdsHandlers,
  ...criticalExtHandlers,
  ...qcExtHandlers,
  ...reportQualityHandlers,
  ...caHandlers,
  ...deviceMgmtHandlers,
  // [v3.0.6.11-60] AI Orchestrator (模型/集成/任务) 需在 aiPlatformHandlers 之前注册,
  //   避免旧 GET /models /models/:id 通配先匹配
  ...aiOrchestratorHandlers,
  ...aiPlatformHandlers,
  ...aiDiagnosisHandlers, // [v3.0.6.11-53] AI CAD 端点 (lung/breast/fracture/cardiac + stats/accuracy)
  ...reportDraftHandlers, // [v3.0.6.11-61] 环境式 AI 报告草稿 (/ai/report-draft/*)
  // [v3.0.6.11-62] 3D 分割与定量必须在 volumeHandlers 之前注册:
  //   volumeHandlers 的 GET /volume/:studyUid 会吞掉 GET /volume/segmentations/:seriesUID
  ...segmentationHandlers,
  ...volumeHandlers, // [v3.0.6.11-53] 3D 体数据端点 (series/reconstruct/mpr/mip/vr)
  ...cardiacHandlers, // [v3.0.6.11-71] 心脏专科分析 (analyses CRUD)
  ...asrHandlers, // [Phase 1.4] ASR 语音识别端点
  ...olapHandlers,
  ...biHandlers, // [v3.0.6.11-60] BI 仪表板 (kpi/timeliness/rvu/oee/sla/trend)
  // [Phase 2] 壳页面真实化 - 新端点 (kiosk/fusion/4d/screening/search)
  ...searchHandlers, // 全局搜索 /search, /search/suggest
  ...similarCaseHandlers, // [v3.0.6.11-60] 相似病例检索 (Jaccard + 特征 + SNOMED)
  ...kioskHandlers,  // 自助签到机
  ...fusionHandlers, // 多模态融合
  ...dicom4dHandlers, // 4D 动态影像
  ...dbtHandlers, // [v3.0.6.11-62] DBT 乳腺断层合成
  ...dicomCompressHandlers, // [v3.0.6.11-60] DICOM 压缩真实化 (RLE/predictive 估算, 确定性)
  ...screeningHandlers, // 早癌筛查
  ...shellUpgradeHandlers, // [v3.0.6.11-54] Phase 2 壳页面真实化 (dicom-web/critical-alert/sr-report/nuclear-stats)
  ...hangingHandlers, // [v3.0.6.11-60] Auto-hanging 自动布局
  ...radsHandlers, // [v3.0.6.11-60] 多 RADS 评分 (pi-rads/li-rads/ti-rads)
  ...srHandlers, // [v3.0.6.11-60] DICOM SR 全链路 (generate/by-report/push-oru/download)
  ...vnaHandlers, // [v3.0.6.11-60] VNA 厂商中立归档 (objects/worm-lock/patients/stats/studies)
];

// 总计: 56 + 6 + 5 + 5 + 6 + 5 = 83 端点

// 总计:11 + 9 + 6 + 5 + 7 + 3 + 5 + 4 + 4 + 2 = 56 端点

// v3.0.5.1 R3.SIGN+R3.AMEND+R3.AI = 50 + 40 + 40 = 130 端点增量

// v3.0.5.1 R3.WRITING+R3.DIST+R3.INTEGRATION+R3.OTHER(本批次)= 40 + 30 + 50 + 20 = 140 端点

// v3.0.5.1 R3.REVIEW INITIAL CHECK = 20 端点增量(80 点)

// v3.0.5.1 R3.REVIEW FINAL CHECK = 20 端点增量(80 点)


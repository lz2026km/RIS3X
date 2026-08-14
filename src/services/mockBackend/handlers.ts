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
// [G005 Wave3A P2] 急诊通道管理 + 科室公告/值班管理
import { emergencyChannelHandlers } from './emergencyChannelHandlers';
import { deptHandlers } from './deptHandlers';
// [v3.0.6.11-79] W1-A 文件管理 (upload-url / upload / upload-complete / download)
import { filesHandlers } from './filesHandlers';
import { systemHandlers } from './systemHandlers'; // [v3.0.6.11-21] system/audit, system/backup, system/tenant-config
// [G005 Wave1A P0-验证] 通知中心 handlers (unread/:userId 等) — 已接入 handlers 数组
import { notificationsHandlers } from './notificationsHandlers';
// [v3.0.6.11-79 W1-C] 合规文档库 7 端点 (CRUD + publish/archive)
import { complianceDocsHandlers } from './complianceDocsHandlers';
// [v3.0.6.11-60] 多租户 SaaS 基础: /api/v1/tenant/*
import { tenantHandlers } from './tenantHandlers';
import { storageHandlers } from './storageHandlers'; // [v3.0.6.11-60] cloud-storage 配置
// [v3.0.6.8-32] 主数据池 + 业务逻辑
import {
  list, get, create, update, remove, findOne,
} from './store';
import {
  parseQuery, applyQuery, groupBy, sumBy, avgBy,
} from './queryBuilder';
import {
  toPatientDto, toDeviceDto, toUserDto, toExamDto, toReportDto,
  toDailyKpiDto,
} from './adapters';
import { auditCreate, auditUpdate, auditDelete, auditStatusChange } from './audit';
import {
  canTransitionReport, canTransitionWorklist,
  getSlaMinutes,
  shouldEscalate,
  determineCosignTrigger,
  recordWorkflowEvent, listWorkflowEvents,
  markPendingAssignmentOnComplete,
  type ReportStatus,
} from './businessLogic';
import { v4 as uuidv4 } from 'uuid';
import { TERM_CATEGORIES, FEATURED_TERMS } from '@data/knowledgeStatsMock';
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
// [W1-5] 导出审批中心 (GET/POST /export-approval, POST /export-approval/:id/approve|reject)
import { exportApprovalHandlers } from './exportApprovalHandlers';
import { dataReportHandlers } from './dataReportHandlers';
import { teleSignHandlers } from './teleSignHandlers';
import { regionalHandlers } from './regionalHandlers';
import { patientPortalHandlers } from './patientPortalHandlers';
import { cosignNewHandlers } from './cosignNewHandlers';
import { cdsHandlers } from './cdsHandlers';
import { criticalExtHandlers } from './criticalExtHandlers';
// [G005-P0] 对标分析 (GET /api/v1/benchmark/list|stats, POST /api/v1/benchmark/compare|cross-site)
import { benchmarkHandlers } from './benchmarkHandlers';
// [G005 P1 W2-C] 示教录制 (POST /teach/lecture, GET /teach/lectures, blob 上传/播放/删除)
import { teachHandlers } from './teachHandlers';
// [W3-B] 典型病例库 (GET /typical-cases, /typical-cases/stats)
import { typicalCaseHandlers } from './typicalCaseHandlers';
// [G005 P1 W2-C] 远程会诊 (session/join/signal/chat/cursor)
import { teleHandlers } from './teleHandlers';
import { qcExtHandlers } from './qcExtHandlers';
import { reportQualityHandlers } from './reportQualityHandlers';
import { caHandlers } from './caHandlers';
import { deviceMgmtHandlers } from './deviceMgmtHandlers';
import { aiPlatformHandlers } from './aiPlatformHandlers';
// [v3.0.6.11-60] AI Orchestrator 编排平台 (模型注册/部署/工作流集成/推理任务)
import { aiOrchestratorHandlers } from './aiOrchestratorHandlers';
// [v3.0.6.11-88 W2B-2] 交互回归缺失 AI 端点 (providers / draft patients+templates)
import { aiWave2BHandlers } from './aiWave2BHandlers';
// [v3.0.6.11-98 Wave2B (报告 P1)] 征象库后端化 MSW 兜底 (finding-library)
import { findingLibraryHandlers } from './findingLibraryHandlers';
import { orchestratorHandlers } from './orchestratorHandlers';
import { aiDiagnosisHandlers } from './aiDiagnosisHandlers';
// [v3.0.6.11-61] 环境式 AI 报告草稿 (生成式草稿 + 医生确认: /ai/report-draft/*)
import { reportDraftHandlers } from './reportDraftHandlers';
import { volumeHandlers } from './volumeHandlers';
import { cardiacHandlers } from './cardiacHandlers';
// [v3.0.6.11-81 W2-B] 神经专科分析 (studies/stats/tumor-grades/stroke-windows)
import { neuroHandlers } from './neuroHandlers';
import { mobileHandlers } from './mobileHandlers';
// [v3.0.6.11-62] 3D 分割与定量 (segment/quantify/segmentations/approve)
import { segmentationHandlers } from './segmentationHandlers';
import { dentalHandlers } from './dentalHandlers';
import { olapHandlers } from './olapHandlers';
import { oeeHandlers } from './oeeHandlers';
import { occupancyHandlers } from './occupancyHandlers';// [v3.0.6.11-54] Phase 2 壳页面真实化 (dicom-web / critical-alert / sr-report / nuclear-stats)
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
// [G005 P1] FHIR R4 21 端点 (fhirApi: /fhir/r4/*)
import { fhirHandlers } from './fhirHandlers';
// [G005 P1] IHE 引擎 (iheApi: /ihe/*)
import { iheHandlers } from './iheHandlers';
// [G005 P1] DICOM DIMSE (dicomDimseApi: /dicom-dimse/*)
import { dicomDimseHandlers } from './dicomDimseHandlers';
// [W2-B-3] Rad-Path 一致性追踪 (radpathApi: /radpath/*)
import { radpathHandlers } from './radpathHandlers';
// [W2-B-3] 科研平台 (researchApi: /research/*)
import { researchHandlers } from './researchHandlers';
// [W2-B-3] 双阅片 (dualReadApi: /dual-read/*)
import { dualReadHandlers } from './dualReadHandlers';
// [W2-B-3] AI 模型市场 (aiMarketplaceApi: /ai-marketplace/*)
import { aiMarketplaceHandlers } from './aiMarketplaceHandlers';
// [G005 P1] 影像组学 (radiomicsApi: /radiomics/*)
import { radiomicsHandlers } from './radiomicsHandlers';
// [v3.0.6.11-75 W3-1] HL7 端点 (hl7Api: oru/orm/dft/batch/archive/mllp)
import { hl7Handlers } from './hl7Handlers';
// [v3.0.6.11-75 W3-1] 影像 AI 质控 (qcImageAiApi: score/score-v2/results/stats)
import { imageAiHandlers } from './imageAiHandlers';
// [W3-2] AI 分检 (aiTriageApi: /triage/* [G005 Wave1A 路径对齐]) + 跨科室治疗计划 (/treatment-plans/*)
import { aiTriageHandlers } from './aiTriageHandlers';
import { treatmentPlanHandlers } from './treatmentPlanHandlers';
// [v3.0.6.11-75 W3-1] 远程阅片 (remoteReadingApi: /remote-reading/*)
import { remoteReadingHandlers } from './remoteReadingHandlers';
// [W4-B] 随访计划 (followupApi: /followups/*)
import { followupHandlers } from './followupHandlers';// [v3.0.6.11-75 W3-1] 跨模态检索 (crossModalApi / crossModalSearchApi)
import { crossModalHandlers } from './crossModalHandlers';
// [v3.0.6.11-75 W3-1] DICOM 跨科室共享 (shareApi: /dicom-share/*)
import { dicomShareHandlers } from './dicomShareHandlers';
// [v3.0.6.11-60] Smart MWL 深度化 (worklist-smart / smart-route)
import { smartWorklistHandlers } from './smartWorklistHandlers';
// [W3-A] 自动采集 (auto-collectionApi, 后端 auto-collection.controller 已实现 → MSW 仅 dev 兜底)
import { autoCollectionHandlers } from './autoCollectionHandlers';
// [W3-A] 诊断符合率 (diagnosisAccuracyApi) + 乳腺影像质量管理 (mammoQcApi)
import { diagnosisAccuracyHandlers } from './diagnosisAccuracyHandlers';
import { mammoQcHandlers } from './mammoQcHandlers';
import {
  INITIAL_CHECK_SUMMARY,
} from '@data/reportInitialCheckMock';
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
// v3.0.6.11-73: MSW login 返回英文角色枚举 (与后端 Prisma UserRole 一致),
// 按用户名映射 (admin→ADMIN, director→DIRECTOR ...), 未知名默认 DOCTOR
const MOCK_ROLE_BY_USERNAME: Record<string, string> = {
  admin: 'ADMIN',
  director: 'DIRECTOR',
  doctor: 'DOCTOR',
  technician: 'TECHNICIAN',
  nurse: 'NURSE',
};

// [v3.0.6.11-79] W1-B 用户中心: 最近一次 mock 登录会话 (GET /auth/me 依据)
let mockSession: { userId: string; username: string; role: string } | null = null;

export const authHandlers = [
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(150);
    let username = '';
    try {
      username = String(((await request.json()) as { username?: string })?.username ?? '').toLowerCase();
    } catch {
      username = '';
    }
    const role = MOCK_ROLE_BY_USERNAME[username] ?? 'DOCTOR';
    const userId = 'u-' + uuidv4().slice(0, 8);
    mockSession = { userId, username: username || 'demo', role };
    return HttpResponse.json({
      success: true,
      data: {
        token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
        refreshToken: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
        expiresAt: Date.now() + 15 * 60 * 1000,
        userId,
        userName: username || 'demo',
        role,
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

  // [v3.0.6.11-79] W1-B 用户中心: GET /auth/me
  http.get(`${API_BASE}/auth/me`, async () => {
    await delay(80);
    const s = mockSession;
    if (!s) {
      // [W2-B-3] 演示模式回退: 未走 login 会话时返回默认演示用户
      // (dev mock 下页面直接可用, 避免 /user/center 401 死循环)
      return HttpResponse.json({
        success: true,
        data: {
          id: 'A001',
          username: 'admin',
          role: 'ADMIN',
          fullName: '系统管理员',
          totpEnabled: false,
          department: '放射科',
        },
      });
    }
    const role = s.role ?? 'DOCTOR';
    return HttpResponse.json({
      success: true,
      data: {
        id: s.userId,
        username: s.username,
        role,
        fullName:
          { ADMIN: '系统管理员', DIRECTOR: '张主任', DOCTOR: '李医生', TECHNICIAN: '王技师', NURSE: '赵护士' }[
            role as string
          ] ?? s.username,
        totpEnabled: false,
      },
    });
  }),

  http.post(`${API_BASE}/auth/logout`, async () => new HttpResponse(null, { status: 204 })),

  // [v3.0.6.11-79] W1-B 用户中心: POST /auth/change-password
  http.post(`${API_BASE}/auth/change-password`, async ({ request }) => {
    await delay(100);
    let body: { oldPassword?: unknown; newPassword?: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }
    if (typeof body.oldPassword !== 'string' || body.oldPassword.length < 6) {
      return HttpResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '原密码错误' } },
        { status: 400 },
      );
    }
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
      return HttpResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '新密码长度至少 8 位' } },
        { status: 400 },
      );
    }
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),
];

// ============= Reports(24) - v3.0.6.8-32 接入 EXAM_REPORT_PRE + QUALITY_SCORE_PRE =============
// [W4-B] 批量报告导出任务 (内存态, 模拟 2s 内完成)
const batchExportTasks = new Map<string, {
  taskId: string
  status: 'pending' | 'running' | 'completed'
  progress: number
  total: number
  format: string
  ids: string[]
  createdAt: number
}>();

export const reportHandlers = [
  // 列表 (EXAM_REPORT_PRE 600 + QUALITY_SCORE_PRE 250 合并)
  // [v3.0.6.11-70] 支持 take/skip/state (与后端 reports list 对齐)
  // [v3.0.6.11-81 W2-B] state 无直接匹配时按 status 派生虚拟 state, 保证审核/质控列表有数据
  http.get(`${API_BASE}/reports`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const takeParam = url.searchParams.get('take');
    // [v3.0.6.11-95 Wave3B P1] state/status 双参数兼容 (状态筛选同义)
    const stateParam = url.searchParams.get('state') ?? url.searchParams.get('status');
    const all = list<any>('exams');
    let source = all;
    if (stateParam) {
      const stateKey = stateParam.toUpperCase();
      const direct = all.filter((r: any) => String(r.state ?? '').toUpperCase() === stateKey);
      if (direct.length > 0) {
        source = direct;
      } else {
        const STATUS_TO_STATE: Record<string, string[]> = {
          INITIAL_REVIEW: ['submitted', 'draft', 'pending'],
          FINAL_REVIEW: ['reviewed'],
          CO_SIGN_REVIEW: ['cosigned'],
          PUBLISHED: ['published', 'final'],
          SIGNED: ['signed', 'reviewed'],
          REVIEWED: ['reviewed'],
          AMENDING: ['amended'],
          WITHDRAWN: ['withdrawn', 'cancelled'],
        };
        const matching = all.filter((r: any) =>
          (STATUS_TO_STATE[stateKey] ?? []).includes(String(r.status ?? r.state ?? '').toLowerCase()),
        );
        source = matching.slice(0, 30).map((r: any) => ({ ...r, state: stateKey }));
      }
    }
    const qMap = new Map(list<any>('qualityScores').map((q: any) => [q.reportId, q]));
    // [v3.0.6.11-95 Wave3B P1] list 筛选: patientId / doctorId / keyword (与后端对齐)
    const patientIdParam = url.searchParams.get('patientId');
    const doctorIdParam = url.searchParams.get('doctorId');
    const keywordParam = url.searchParams.get('keyword');
    // 显式消费的筛选参数移出通用 filters (记录无这些字段, 通用过滤会误杀全部)
    if (opts.filters) {
      delete opts.filters['status'];
      delete opts.filters['patientId'];
      delete opts.filters['doctorId'];
      delete opts.filters['keyword'];
    }
    if (patientIdParam) source = source.filter((r: any) => String(r.patientId ?? '') === patientIdParam);
    if (doctorIdParam) source = source.filter((r: any) =>
      String(r.doctorId ?? r.reportDoctorId ?? r.radiologistId ?? '') === doctorIdParam);
    if (keywordParam) {
      const kw = keywordParam.toLowerCase();
      source = source.filter((r: any) =>
        String(r.patientName ?? '').toLowerCase().includes(kw) ||
        String(r.accessionNumber ?? r.reportId ?? '').toLowerCase().includes(kw));
    }
    const result = applyQuery(source, {
      ...opts,
      pageSize: takeParam ? Math.min(Math.max(Number(takeParam) || 20, 1), 1000) : opts.pageSize,
    }, ['patientName', 'reportId', 'examItem', 'bodyPart']);
    // [v3.0.6.11-96 Wave 2B (A)] 完成 → 待报告闭环: state=PENDING_ASSIGNMENT 行以待分配态呈现 (对齐后端报告实体)
    const withPendingAssignment = result.data.map((r: any) => {
      if (String(r.state ?? '').toUpperCase() === 'PENDING_ASSIGNMENT') return { ...r, status: 'PENDING_ASSIGNMENT' };
      return r;
    });
    // [v3.0.6.11-98 Wave1B P0-3] 报告正文合并: exams 集合为检查行(无正文), 按 reportId/examId 从
    //   reports 集合 (unified-reports.json, 含 findings/impression) 补齐正文, 供「上一例复制」/历史报告使用
    const reportBodyIndex = new Map<string, any>();
    try {
      list<any>('reports').forEach((rp: any) => {
        if (rp?.examId) reportBodyIndex.set(String(rp.examId), rp);
        if (rp?.reportId) reportBodyIndex.set(String(rp.reportId), rp);
      });
    } catch { /* 集合未就绪时跳过合并 */ }
    const enrichReport = (r: any) => {
      const rp = reportBodyIndex.get(String(r.reportId ?? r.id ?? '')) ?? reportBodyIndex.get(String(r.examId ?? ''));
      if (!rp) return r;
      return {
        ...r,
        findings: rp.findings ?? r.findings ?? '',
        impression: rp.impression ?? r.diagnosis ?? r.impression ?? '',
        diagnosis: rp.diagnosis ?? r.diagnosis ?? '',
        conclusion: rp.conclusion ?? r.conclusion ?? '',
        recommendations: rp.recommendations ?? r.recommendations ?? '',
        reportDoctorName: rp.reportDoctorName ?? r.reportDoctorName ?? r.radiologistName ?? '',
        doctorName: rp.reportDoctorName ?? r.reportDoctorName ?? '',
      };
    };
    return HttpResponse.json({
      success: true,
      data: withPendingAssignment.map((r: any) => toReportDto(enrichReport(r), qMap.get(r.reportId))),
      meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
    });
  }),

  // [v3.0.6.11-95 Wave3B P1] 批量状态流转: POST /reports/batch-transition (逐条校验, 失败不阻断)
  http.post(`${API_BASE}/reports/batch-transition`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { ids?: string[]; to?: string; actorId?: string; reason?: string };
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
    const target = (body?.to ?? '').toUpperCase();
    if (ids.length === 0 || !target) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'ids and to are required' } }, { status: 400 });
    }
    const STATE_TO_STATUS: Record<string, string> = {
      PENDING_ASSIGNMENT: 'draft', ASSIGNED: 'draft', WRITING: 'draft', SUBMITTED: 'submitted',
      INITIAL_REVIEW: 'inReview', FINAL_REVIEW: 'inReview', CO_SIGN_REVIEW: 'inReview',
      REVIEWED: 'reviewed', SIGNING: 'reviewed', SIGNED: 'signed', PUBLISHED: 'published',
      AMENDING: 'amended', AMENDED: 'amended', WITHDRAWN: 'withdrawn', REJECTED: 'rejected',
      ESCALATED: 'inReview', ARCHIVED: 'published', RECTIFYING: 'amended', SUPPLEMENTING: 'amended',
      SUPPLEMENTED: 'amended', REDISTRIBUTING: 'published',
    };
    const succeeded: { id: string; state: string }[] = [];
    const failed: { id: string; message: string }[] = [];
    // 记录侧无 state 字段 (seed 仅 status 小写英文) → 由 status 归一化出后端态
    const STATUS_TO_EN_STATE: Record<string, string> = {
      draft: 'WRITING', submitted: 'SUBMITTED', inreview: 'INITIAL_REVIEW', in_review: 'INITIAL_REVIEW',
      reviewed: 'REVIEWED', cosigned: 'CO_SIGN_REVIEW', signed: 'SIGNED', published: 'PUBLISHED',
      amended: 'AMENDED', rejected: 'REJECTED', withdrawn: 'WITHDRAWN', cancelled: 'WITHDRAWN',
      final: 'PUBLISHED', pending: 'PENDING_ASSIGNMENT',
    };
    for (const id of ids) {
      const before = get<any>('exams', id);
      if (!before) { failed.push({ id, message: '报告不存在' }); continue; }
      const fromState = String(before.state ?? '').toUpperCase()
        || STATUS_TO_EN_STATE[String(before.status ?? '').toLowerCase()]
        || String(before.status ?? '').toUpperCase();
      const ALLOWED: Record<string, string[]> = {
        PENDING_ASSIGNMENT: ['ASSIGNED', 'WRITING'], ASSIGNED: ['WRITING', 'REDISTRIBUTING'],
        WRITING: ['SUBMITTED', 'INITIAL_REVIEW', 'REJECTED'], SUBMITTED: ['INITIAL_REVIEW', 'REVIEWED', 'REJECTED', 'ESCALATED'],
        INITIAL_REVIEW: ['FINAL_REVIEW', 'REVIEWED', 'REJECTED', 'ESCALATED'], FINAL_REVIEW: ['CO_SIGN_REVIEW', 'REVIEWED', 'REJECTED', 'ESCALATED'],
        CO_SIGN_REVIEW: ['REVIEWED', 'REJECTED', 'ESCALATED'], REVIEWED: ['SIGNING', 'SIGNED', 'REJECTED', 'ESCALATED'],
        SIGNING: ['SIGNED', 'REJECTED'], SIGNED: ['PUBLISHED', 'AMENDING', 'AMENDED', 'RECTIFYING', 'SUPPLEMENTING'],
        PUBLISHED: ['AMENDING', 'AMENDED', 'SUPPLEMENTING', 'ARCHIVED', 'PUBLISHED'],
        AMENDING: ['AMENDED', 'REJECTED'], AMENDED: ['SIGNED', 'REJECTED'], REJECTED: ['WRITING'],
        ESCALATED: ['REVIEWED', 'REJECTED'], RECTIFYING: ['REVIEWED', 'REJECTED'],
        SUPPLEMENTING: ['SUPPLEMENTED', 'REJECTED'], SUPPLEMENTED: ['PUBLISHED', 'REJECTED'], REDISTRIBUTING: ['ASSIGNED'],
      };
      if (!(ALLOWED[fromState] ?? []).includes(target)) {
        failed.push({ id, message: `INVALID_TRANSITION: ${fromState} → ${target} 不允许` });
        continue;
      }
      if (target === 'REJECTED' && !body?.reason?.trim()) {
        failed.push({ id, message: 'INVALID_TRANSITION: REJECTED 必须提供 reason' });
        continue;
      }
      const updated = update<any>('exams', id, {
        status: STATE_TO_STATUS[target] ?? 'submitted',
        state: target,
        rejectReason: target === 'REJECTED' ? (body?.reason ?? '') : undefined,
      });
      if (updated) {
        auditStatusChange('reports', updated, before.status, STATE_TO_STATUS[target] ?? 'submitted');
        recordWorkflowEvent({ actorId: body?.actorId ?? 'system', actorName: '系统', action: 'batch-transition', entityType: 'reports', entityId: id, fromState: before.status, toState: target, metadata: { reason: body?.reason } });
        succeeded.push({ id, state: target });
      } else {
        failed.push({ id, message: '流转失败' });
      }
    }
    return HttpResponse.json({ success: true, data: { succeeded, failed } });
  }),

  // [W4-B] 批量报告导出: 创建任务 + 轮询状态 (模拟 2s 内完成)
  http.post(`${API_BASE}/reports/batch-export`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { ids?: string[]; format?: string };
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'ids is required' } }, { status: 400 });
    const taskId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    batchExportTasks.set(taskId, { taskId, status: 'pending', progress: 0, total: ids.length, format: (body.format ?? 'pdf').toLowerCase(), ids, createdAt: Date.now() });
    return HttpResponse.json({ success: true, data: { taskId, status: 'pending', total: ids.length, format: (body.format ?? 'pdf').toLowerCase() } }, { status: 201 });
  }),

  http.get(`${API_BASE}/reports/batch-export/:taskId`, async ({ params }) => {
    await delay(80);
    const task = batchExportTasks.get(params.taskId as string);
    if (!task) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Batch export task not found' } }, { status: 404 });
    const elapsed = Date.now() - task.createdAt;
    const progress = Math.min(100, Math.round((elapsed / 1800) * 100));
    const status = progress >= 100 ? 'completed' : progress > 0 ? 'running' : 'pending';
    const done = Math.min(task.total, Math.ceil((progress / 100) * task.total));
    const downloads = status === 'completed'
      ? task.ids.map((id) => ({
          reportId: id,
          fileName: `${id}.${task.format}`,
          filePath: `/exports/reports/${id}.${task.format}`,
          sizeBytes: 256000,
          format: task.format,
          // [v3.0.6.11-88 P0] 下载路径对齐后端 /reports/export-files/:fileName
          downloadUrl: `${API_BASE}/reports/export-files/${id}.${task.format}`,
        }))
      : [];
    return HttpResponse.json({
      success: true,
      data: { taskId: task.taskId, status, progress, total: task.total, done, failedCount: 0, format: task.format, downloads, createdAt: new Date(task.createdAt).toISOString(), updatedAt: new Date().toISOString() },
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
    // [v3.0.6.11-98 Wave1B P0-3] 按 examId/reportId 从 reports 集合补齐正文 (findings/impression)
    let enriched = report;
    try {
      const rp = (list<any>('reports') || []).find((x: any) =>
        String(x?.examId ?? '') === String(params.id) || String(x?.reportId ?? '') === String(params.id));
      if (rp) {
        enriched = {
          ...report,
          findings: rp.findings ?? report.findings ?? '',
          impression: rp.impression ?? rp.diagnosis ?? report.impression ?? '',
          diagnosis: rp.diagnosis ?? rp.diagnosis ?? '',
          conclusion: rp.conclusion ?? rp.conclusion ?? '',
          recommendations: rp.recommendations ?? rp.recommendations ?? '',
          reportDoctorName: rp.reportDoctorName ?? report.reportDoctorName ?? '',
        };
      }
    } catch { /* 集合未就绪时保持原样 */ }
    const q = findOne<any>('qualityScores', (x: any) => x.reportId === params.id);
    return HttpResponse.json({ success: true, data: toReportDto(enriched, q) });
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

  // [W2-3] 导出真实化: 任务状态轮询 (ReportPage 导出后轮询, 对齐后端入队+生成语义)
  // [v3.0.6.11-88 P0] 形状对齐后端: { status: 'completed'|'processing', exportedAt?, fileUrl? } (保留 downloadUrl 兼容旧调用)
  http.get(`${API_BASE}/reports/:id/export-status`, async ({ params }) => {
    await delay(60);
    const report = get<any>('exams', params.id as string);
    if (!report) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } }, { status: 404 });
    const fileUrl = `${API_BASE}/reports/export-files/report-${params.id}.html`;
    return HttpResponse.json({
      success: true,
      data: { status: 'completed', format: 'pdf', fileUrl, downloadUrl: fileUrl, exportedAt: new Date().toISOString(), queuedAt: report.reportAt ?? new Date().toISOString() },
    });
  }),

  // [v3.0.6.11-88 P0] 导出文件下载 (reportApi.downloadExportFile → GET /reports/export-files/:fileName)
  http.get(`${API_BASE}/reports/export-files/:fileName`, async ({ params }) => {
    await delay(80);
    const raw = decodeURIComponent(params.fileName as string ?? '');
    const id = raw.startsWith('report-') ? raw.replace(/^report-/, '').replace(/-\d+\.\w+$/, '') : raw.replace(/\.\w+$/, '');
    const report = get<any>('exams', id);
    if (!report) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Export file not found' } }, { status: 404 });
    const patient = report.patientName ?? '患者';
    const findings = report.findings ?? report.examFindings ?? '—';
    const impression = report.impression ?? report.diagnosis ?? '—';
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${patient} 放射诊断报告</title></head><body style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;padding:32px;color:#1e293b"><h1 style="color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px">放射诊断报告</h1><p><strong>报告编号:</strong> ${id}</p><p><strong>患者:</strong> ${patient}</p><h3>检查所见</h3><pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:6px">${findings}</pre><h3>诊断意见</h3><pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:6px">${impression}</pre><p style="margin-top:24px;color:#94a3b8;font-size:12px">Generated by G005 RIS · ${new Date().toLocaleString('zh-CN')}</p></body></html>`;
    return new HttpResponse(new TextEncoder().encode(html), { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Content-Disposition': `attachment; filename="${raw}"` } });
  }),

  // [W2-3] 导出真实化: 下载文件本体 (GET downloadUrl → 真实 PDF/文档字节)
  http.get(`${API_BASE}/reports/:id/export.:format`, async ({ params }) => {
    await delay(80);
    const id = params.id as string;
    const report = get<any>('exams', id);
    if (!report) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } }, { status: 404 });
    const format = (params.format as string ?? 'pdf').toLowerCase();
    const patient = report.patientName ?? '患者';
    const findings = report.findings ?? report.examFindings ?? '—';
    const impression = report.impression ?? report.diagnosis ?? '—';
    if (format === 'html' || format === 'htm') {
      const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${patient} 放射诊断报告</title></head><body style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;padding:32px;color:#1e293b"><h1 style="color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px">放射诊断报告</h1><p><strong>报告编号:</strong> ${id}</p><p><strong>患者:</strong> ${patient}</p><h3>检查所见</h3><pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:6px">${findings}</pre><h3>诊断意见</h3><pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:6px">${impression}</pre><p style="margin-top:24px;color:#94a3b8;font-size:12px">Generated by G005 RIS · ${new Date().toLocaleString('zh-CN')}</p></body></html>`;
      return new HttpResponse(new TextEncoder().encode(html), { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Content-Disposition': `attachment; filename="${id}.html"` } });
    }
    if (format === 'csv') {
      const csv = `报告编号,患者,检查所见,诊断意见\n"${id}","${patient}","${findings.replace(/"/g, '""')}","${impression.replace(/"/g, '""')}"\n`;
      return new HttpResponse(new TextEncoder().encode(csv), { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="${id}.csv"` } });
    }
    // 伪 PDF (最小合法头 + 文本) — 前端下载为 .pdf 文件, 内容可被查看
    const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 14 Tf 50 780 Td (${patient} - ${id}) Tj ET\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
    return new HttpResponse(new TextEncoder().encode(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${id}.pdf"` },
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

function mapReportStatus(s: string): ReportStatus {
  return (REPORT_STATUS_MAP[s] ?? 'draft') as ReportStatus;
}

// ============= Appointments - v3.0.6.11-70 P0 预约→检查联动 =============
// 可变记录集: 新建预约后列表立即可见
let appointmentRecords: any[] = clone(APPOINTMENT_RECORDS);

const APP_PRIORITY_MAP: Record<string, string> = {
  ROUTINE: 'ROUTINE', URGENT: 'URGENT', STAT: 'STAT',
  normal: 'ROUTINE', urgent: 'URGENT', critical: 'STAT',
};
const APP_PRIORITY_LOCAL: Record<string, 'normal' | 'urgent' | 'critical'> = {
  ROUTINE: 'normal', URGENT: 'urgent', STAT: 'critical',
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
  http.get(`${API_BASE}/appointments`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    const data = patientId
      ? appointmentRecords.filter((a: any) => a.patientId === patientId)
      : appointmentRecords;
    return HttpResponse.json({ success: true, data: clone(data) });
  }),

  // ===== 静态子路由 (必须先于 :id, 避免被 :id 吞掉) =====
  // [G005 Wave1B P1] 标注更新: 后端 appointments.controller 已补 5 子资源, 此处仅 mock 兜底
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
    try { create('exams', examRecord as any); } catch { /* store 未初始化时忽略 */ }
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
    const body = (await request.json()) as any;
    const idx = appointmentRecords.findIndex((a) => a.id === params.id);
    if (idx >= 0) {
      const updated = { ...appointmentRecords[idx]!, ...body, updatedAt: new Date().toISOString() };
      appointmentRecords = appointmentRecords.map((a) => (a.id === params.id ? updated : a));
      return HttpResponse.json({ success: true, data: updated });
    }
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),

  // [G005 Wave4A P1] 改约 (appointmentApi.update → PATCH, 后端 UpdateSchema) / 取消 (appointmentApi.cancel → DELETE)
  http.patch(`${API_BASE}/appointments/:id`, async ({ params, request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const idx = appointmentRecords.findIndex((a) => a.id === params.id);
    if (idx >= 0) {
      const updated: any = { ...appointmentRecords[idx]!, updatedAt: new Date().toISOString() };
      if (body.startAt) {
        const startAt = new Date(body.startAt);
        updated.examDate = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, '0')}-${String(startAt.getDate()).padStart(2, '0')}`;
        updated.examTime = `${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}`;
      }
      if (body.note !== undefined) updated.note = body.note;
      if (body.state !== undefined) {
        const stateMap: Record<string, string> = { SCHEDULED: 'pending', CONFIRMED: 'confirmed', CHECKED_IN: 'checked-in', IN_PROGRESS: 'checked-in', COMPLETED: 'completed', CANCELLED: 'cancelled', NO_SHOW: 'cancelled' };
        updated.status = stateMap[String(body.state)] ?? updated.status;
      }
      appointmentRecords = appointmentRecords.map((a) => (a.id === params.id ? updated : a));
      return HttpResponse.json({ success: true, data: updated });
    }
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),

  http.delete(`${API_BASE}/appointments/:id`, async ({ params }) => {
    await delay(150);
    const idx = appointmentRecords.findIndex((a) => a.id === params.id);
    if (idx >= 0) {
      appointmentRecords = appointmentRecords.map((a) => (a.id === params.id ? { ...a, status: 'cancelled', updatedAt: new Date().toISOString() } : a));
      return HttpResponse.json({ success: true, data: { ok: true, id: params.id } });
    }
    return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } }, { status: 404 });
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

  // [W4-A] CSV 导出 (必须在 /exams/:id 之前)
  http.get(`${API_BASE}/exams/export`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const modality = url.searchParams.get('modality') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const all = list<any>('exams') || [];
    const rows = all.filter((e: any) =>
      (!modality || String(e.modality ?? '') === modality) &&
      (!state || String(e.status ?? '') === state || String(e.state ?? '') === state),
    );
    const header = ['id', 'accessionNumber', 'patientId', 'patientName', 'modality', 'bodyPart', 'status', 'scheduledAt'];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const e of rows) {
      const row = { id: e.id, accessionNumber: e.accessionNumber ?? e.reportId, patientId: e.patientId, patientName: e.patientName, modality: e.modality, bodyPart: e.bodyPart, status: e.status ?? e.state, scheduledAt: e.examDate ?? e.scheduledAt ?? '' };
      lines.push(header.map((h) => esc((row as any)[h])).join(','));
    }
    return HttpResponse.json({
      success: true,
      data: { filename: `exams_${new Date().toISOString().slice(0, 10)}.csv`, content: '\ufeff' + lines.join('\n'), count: rows.length },
    });
  }),

  // [W4-A] 批量导入 (JSON 数组或 { items }, 无患者则报错列出, accession 重复跳过)
  http.post(`${API_BASE}/exams/import`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as any;
    const rows: any[] = Array.isArray(body) ? body : (body?.items ?? []);
    const patients = list<any>('patients') as any[];
    const exams = list<any>('exams') as any[];
    const errors: { index: number; message: string }[] = [];
    let imported = 0;
    let skipped = 0;
    rows.forEach((row: any, i: number) => {
      if (!row || typeof row !== 'object' || !row.patientId || !String(row.accessionNumber ?? '').trim() || !String(row.modality ?? '').trim() || !String(row.bodyPart ?? '').trim()) {
        errors.push({ index: i, message: `第 ${i + 1} 行: patientId/accessionNumber/modality/bodyPart 为必填` });
        return;
      }
      const patient = patients.find((p: any) => p.id === row.patientId);
      if (!patient) {
        errors.push({ index: i, message: `第 ${i + 1} 行: 患者不存在 ${row.patientId}` });
        return;
      }
      if (exams.some((e: any) => String(e.accessionNumber ?? e.reportId ?? '') === String(row.accessionNumber).trim())) {
        skipped++;
        return;
      }
      const newId = row.id || `EX-${String(Date.now()).slice(-6)}${i}`;
      const rec = {
        ...row,
        id: newId,
        reportId: newId,
        accessionNumber: String(row.accessionNumber).trim(),
        patientName: patient.name,
        patientId: row.patientId,
        status: row.state ?? '待检查',
        state: row.state ?? '待检查',
        examDate: row.scheduledAt ? String(row.scheduledAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
        scheduledAt: row.scheduledAt ?? '',
        priority: row.priority ?? '普通',
        createdAt: new Date().toISOString(),
      };
      create('exams', rec);
      imported++;
    });
    return HttpResponse.json({ success: true, data: { imported, skipped, errors } });
  }),

  // [v3.0.6.11-70] 详情 (报告书写上下文需要患者性别/年龄)
  http.get(`${API_BASE}/exams/:id`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    let exam = get<any>('exams', id);
    // [v3.0.6.11-96 Wave 3A P1] 演示检查 TMP001 兜底 (/exam/TMP001 独立详情路由 e2e/演示)
    if (!exam && id === 'TMP001') {
      const demo = {
        reportId: 'TMP001',
        patientId: 'TMP001',
        patientName: '演示患者',
        patientAge: 45,
        patientGender: '男',
        modality: 'CT',
        examItem: '胸部CT平扫',
        examItemCode: 'CT-CHEST',
        bodyPart: '胸部',
        deviceId: 'DEV-CT-01',
        deviceModel: 'GE Revolution CT',
        doctorId: 'TECH01',
        reportDoctorId: 'DR01',
        reviewDoctorId: null,
        cosignDoctorId: null,
        icd10: 'R91.1',
        clinicalDiagnosis: '肺结节待查',
        findings: '',
        impression: '',
        examAt: '2026-07-02T09:30:00Z',
        reportAt: '2026-07-02T09:30:00Z',
        reviewedAt: null,
        signedAt: null,
        status: 'submitted',
        priority: '普通',
        defectCount: 0,
        qcScore: 96,
        hasCriticalValue: false,
        criticalValueType: null,
      } as any;
      create<any>('exams', demo);
      exam = demo;
    }
    if (!exam) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toExamDto(exam) });
  }),

  // [G005 Wave4B] G-18 检查合并: 同患者多检查 → 目标检查 (报告/影像引用迁移)
  http.post(`${API_BASE}/exams/merge`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { targetId: string; sourceIds: string[] };
    const ids = [body.targetId, ...(body.sourceIds ?? [])];
    if (!body.targetId || !Array.isArray(body.sourceIds) || body.sourceIds.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'targetId 与 sourceIds 为必填' } }, { status: 400 });
    }
    if (new Set(ids).size !== ids.length) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '目标检查不能同时作为源检查' } }, { status: 400 });
    }
    const exams = list<any>('exams') || [];
    const found = ids.map((id) => exams.find((e: any) => e.id === id)).filter(Boolean) as any[];
    if (found.length !== ids.length) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '存在不存在的检查' } }, { status: 404 });
    }
    const patientIds = new Set(found.map((e: any) => e.patientId ?? e.patientID ?? ''));
    if (patientIds.size > 1) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '仅同一患者的多个检查可以合并' } }, { status: 400 });
    }
    const sources = found.filter((e: any) => e.id !== body.targetId);
    for (const src of sources) remove('exams', src.id);
    return HttpResponse.json({
      success: true,
      data: {
        targetId: body.targetId,
        patientId: found[0].patientId ?? found[0].patientID,
        mergedSourceCount: sources.length,
        removedSourceIds: sources.map((s: any) => s.id),
        retainedSourceIds: [],
        movedReports: sources.length,
        mergedAt: new Date().toISOString(),
      },
    }, { status: 200 });
  }),

  // [G005 Wave4B] G-18 检查拆分: 按报告归属拆分 (每份报告独立成新检查)
  http.post(`${API_BASE}/exams/:id/split`, async ({ params, request }) => {
    await delay(200);
    const id = params.id as string;
    const exam = get<any>('exams', id);
    if (!exam) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
    const body = (await request.json()) as { reportIds: string[] };
    const reportIds = Array.from(new Set(body.reportIds ?? []));
    if (reportIds.length < 2) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '至少选择 2 份报告才能拆分' } }, { status: 400 });
    }
    const created: { id: string; accessionNumber: string; reportCount: number }[] = [];
    const stamp = Date.now().toString(36);
    reportIds.forEach((reportId, i) => {
      const newId = `EX-${stamp}-${i + 1}`;
      const rec = {
        ...exam,
        id: newId,
        reportId,
        accessionNumber: `${exam.accessionNumber}-S${stamp}-${i + 1}`,
        examDate: new Date().toISOString().slice(0, 10),
        createdTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        updatedTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        createdAt: new Date().toISOString(),
      };
      create('exams', rec);
      created.push({ id: newId, accessionNumber: rec.accessionNumber, reportCount: 1 });
    });
    return HttpResponse.json({
      success: true,
      data: { sourceExamId: exam.id, patientId: exam.patientId ?? exam.patientID, created, splitAt: new Date().toISOString() },
    }, { status: 201 });
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

// [v3.0.6.11-95 Wave1B] 批量状态流转公共逻辑 (POST /worklist/batch-checkin|start|complete)
const handleBatchTransition = async (body: { ids?: string[] }, action: 'checkin' | 'start' | 'complete') => {
  await delay(120);
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) return HttpResponse.json({ success: false, message: 'ids is required' }, { status: 400 });
  const req: Record<'checkin' | 'start' | 'complete', string> = { checkin: 'ARRIVED', start: 'IN_PROGRESS', complete: 'COMPLETED' };
  const target = req[action];
  const label = action === 'checkin' ? '签到' : action === 'start' ? '开始' : '完成';
  const succeeded: { id: string; state: string }[] = [];
  const failed: { id: string; message: string }[] = [];
  for (const id of ids) {
    const before = get<any>('exams', id);
    if (!before) { failed.push({ id, message: '检查不存在' }); continue; }
    if (!canTransitionWorklist(String(before.status ?? 'SCHEDULED'), target)) {
      failed.push({ id, message: `当前状态 ${String(before.status)} 不允许批量${label}` });
      continue;
    }
    const patch: Record<string, unknown> = { status: target };
    if (action === 'checkin') patch.checkinAt = new Date().toISOString();
    if (action === 'complete') patch.completeAt = new Date().toISOString();
    update<any>('exams', id, patch);
    // [v3.0.6.11-96 Wave 2B (A)] 完成 → 待报告闭环: 无报告实体时标记 PENDING_ASSIGNMENT (对齐后端 complete)
    if (action === 'complete' && markPendingAssignmentOnComplete(before)) {
      update<any>('exams', id, { state: 'PENDING_ASSIGNMENT', pendingReportAt: new Date().toISOString() });
    }
    auditStatusChange('worklist', { ...before, status: target }, String(before.status ?? 'SCHEDULED'), target);
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action, entityType: 'worklist', entityId: id, fromState: String(before.status ?? 'SCHEDULED'), toState: target });
    succeeded.push({ id, state: target });
  }
  return HttpResponse.json({ success: true, data: { succeeded, failed } });
};

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
    // [v3.0.6.11-95 Wave1B] 扩展: 当日完成/平均时长/技师维度 (对齐后端 /worklist/stats)
    const today = new Date().toISOString().slice(0, 10);
    const completedToday = all.filter((e) => String(e.completeAt ?? e.completedAt ?? e.createdAt ?? '').slice(0, 10) === today).length;
    const avgDurationMin = 28;
    const byTechnician = [
      { id: 'tech-seed-1', name: '王技师', completedCount: 9, avgDurationMin },
      { id: 'tech-seed-2', name: '李技师', completedCount: 6, avgDurationMin: Math.max(10, avgDurationMin - 5) },
      { id: 'tech-seed-3', name: '张技师', completedCount: 4, avgDurationMin: avgDurationMin + 4 },
    ];
    return HttpResponse.json({ success: true, data: { total: all.length, byStatus, byModality, byPriority, completedToday, avgDurationMin, byTechnician } });
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

  // 部分更新 (状态/设备/备注等普通字段; 与状态机端点区分)
  http.patch(`${API_BASE}/worklist/:id`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('exams', id);
    if (!before) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
    const updated = update<any>('exams', id, { ...before, ...body });
    if (updated) auditUpdate('worklist', before, updated);
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  // 批量分配 (医生/设备/检查室) - 必须在 /worklist/:id/assign 之前注册
  http.post(`${API_BASE}/worklist/batch-assign`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { ids?: string[]; doctorId?: string; deviceId?: string; roomId?: string };
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) return HttpResponse.json({ success: false, message: 'ids is required' }, { status: 400 });
    let updatedCount = 0;
    for (const id of ids) {
      const before = get<any>('exams', id);
      if (!before) continue;
      const patch: Record<string, unknown> = {};
      if (body.doctorId) { patch.doctorId = body.doctorId; patch.reportDoctorId = body.doctorId; }
      if (body.deviceId) patch.deviceId = body.deviceId;
      if (body.roomId) patch.roomId = body.roomId;
      const updated = update<any>('exams', id, patch);
      if (updated) { auditUpdate('worklist', before, updated); updatedCount += 1; }
    }
    return HttpResponse.json({ success: true, data: { ok: true, updated: updatedCount } });
  }),

  // [v3.0.6.11-95 Wave1B] 批量状态流转 (签到/开始/完成) - 必须在 :id/checkin 等之前注册
  http.post(`${API_BASE}/worklist/batch-checkin`, async ({ request }) => handleBatchTransition(await request.json() as { ids?: string[] }, 'checkin')),
  http.post(`${API_BASE}/worklist/batch-start`, async ({ request }) => handleBatchTransition(await request.json() as { ids?: string[] }, 'start')),
  http.post(`${API_BASE}/worklist/batch-complete`, async ({ request }) => handleBatchTransition(await request.json() as { ids?: string[] }, 'complete')),

  // 分配医生/设备/检查室
  http.post(`${API_BASE}/worklist/:id/assign`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as { doctorId?: string; deviceId?: string; roomId?: string };
    const before = get<any>('exams', id);
    if (!before) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
    if (!body?.doctorId && !body?.deviceId && !body?.roomId) return HttpResponse.json({ success: false, message: 'doctorId or deviceId or roomId is required' }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (body.doctorId) { patch.doctorId = body.doctorId; patch.reportDoctorId = body.doctorId; }
    if (body.deviceId) patch.deviceId = body.deviceId;
    if (body.roomId) patch.roomId = body.roomId;
    const updated = update<any>('exams', id, patch);
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
      // [v3.0.6.11-96 Wave 2B (A)] 完成 → 待报告闭环: 无报告实体时标记 PENDING_ASSIGNMENT (对齐后端 complete)
      if (markPendingAssignmentOnComplete(before)) {
        update<any>('exams', id, { state: 'PENDING_ASSIGNMENT', pendingReportAt: new Date().toISOString() });
      }
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

  // [v3.0.6.11-95 Wave 1A P1] 暂停/继续 (对齐后端 POST /worklist/:id/pause|resume)
  http.post(`${API_BASE}/worklist/:id/pause`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as { reason?: string };
    const before = get<any>('exams', id);
    if (before && !canTransitionWorklist(before.status, 'PAUSED')) {
      return HttpResponse.json({ success: false, message: `Cannot pause from ${before.status}` }, { status: 400 });
    }
    const updated = update<any>('exams', id, { status: 'PAUSED', state: 'PAUSED', pausedAt: new Date().toISOString(), pauseReason: body?.reason ?? '' });
    if (updated) auditStatusChange('worklist', updated, before?.status || '', 'PAUSED');
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  http.post(`${API_BASE}/worklist/:id/resume`, async ({ params }) => {
    await delay(80);
    const id = params.id as string;
    const before = get<any>('exams', id);
    if (before && !canTransitionWorklist(before.status, 'IN_PROGRESS')) {
      return HttpResponse.json({ success: false, message: `Cannot resume from ${before.status}` }, { status: 400 });
    }
    const updated = update<any>('exams', id, { status: 'IN_PROGRESS', state: 'IN_PROGRESS', pausedAt: null });
    if (updated) auditStatusChange('worklist', updated, before?.status || '', 'IN_PROGRESS');
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

  // 批量改派
  

  // [v3.0.6.11-92 Wave1B P0] 影像质控回写: PATCH /worklist/:id/state { state: IMAGE_READY|QC_REJECT|QC_PASS, note? }
  // [v3.0.6.11-95 Wave 1A P1] + IN_PROGRESS 重拍登记 (QC_REJECT → IN_PROGRESS, retakeCount+1, 备注"重拍第 N 次") + rating/qcNote 落库
  http.patch(`${API_BASE}/worklist/:id/state`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as { state?: string; note?: string; rating?: string; techNote?: string; qcNote?: string };
    const state = String(body.state ?? '').toUpperCase();
    if (!['IMAGE_READY', 'QC_REJECT', 'QC_PASS', 'IN_PROGRESS'].includes(state)) {
      return HttpResponse.json({ success: false, message: `Invalid qc state: ${body.state}` }, { status: 400 });
    }
    let before = get<any>('exams', id);
    if (!before) {
      before = list<any>('exams').find((e) => String(e.accessionNumber ?? e.studyId ?? '') === id) ?? null;
    }
    if (!before) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
    const target = state === 'QC_PASS' ? 'PENDING_REPORT' : state;
    if (!canTransitionWorklist(before.status, target)) {
      return HttpResponse.json({ success: false, message: `Cannot qc-transition from ${before.status} to ${target}` }, { status: 400 });
    }
    const patch: Record<string, unknown> = { status: target, state: target, qcAt: new Date().toISOString() };
    if (body.rating) patch.qualityRating = body.rating;
    if (body.techNote) patch.techNotes = body.techNote;
    if (body.qcNote) patch.qcNotes = body.qcNote;
    else if (body.note) patch.qcNotes = body.note;
    if (state === 'IN_PROGRESS') {
      const retakeCount = Number(before.retakeCount ?? 0) + 1;
      const appendNote = `重拍登记 第 ${retakeCount} 次${body.note ? `: ${body.note}` : ''}`;
      patch.retakeCount = retakeCount;
      patch.qcNotes = [String(before.qcNotes ?? ''), appendNote].filter(Boolean).join('\n');
    }
    const updated = update<any>('exams', id, patch);
    if (updated) {
      auditStatusChange('worklist', updated, before.status, target);
      recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: state === 'IN_PROGRESS' ? 'retake' : 'qc', entityType: 'worklist', entityId: id, fromState: before.status, toState: target, metadata: { note: body.note } });
    }
    return HttpResponse.json({ success: true, data: updated ? toExamDto(updated) : null });
  }),

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
  

  // [W4-A] 批量导入 (JSON 数组或 { items }, 逐条创建 + idCard/name+phone 冲突跳过)
  http.post(`${API_BASE}/patients/import`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as any;
    const rows: any[] = Array.isArray(body) ? body : (body?.items ?? []);
    const all = list<any>('patients') as any[];
    const errors: { index: number; message: string }[] = [];
    let imported = 0;
    let skipped = 0;
    rows.forEach((row: any, i: number) => {
      if (!row || typeof row !== 'object' || !String(row.name ?? '').trim()) {
        errors.push({ index: i, message: `第 ${i + 1} 行: 姓名不能为空` });
        return;
      }
      const dup = all.find((p: any) =>
        (row.idCard && String(p.idCard ?? '') === String(row.idCard)) ||
        (String(row.name ?? '').trim() === String(p.name ?? '') && (row.phone ?? '') !== '' && String(row.phone ?? '') === String(p.phone ?? '')),
      );
      if (dup) { skipped++; return; }
      const newId = row.id || `P${String(Date.now()).slice(-6)}${i}`;
      const rec = {
        ...row,
        id: newId,
        gender: row.gender === '男' || row.gender === 'MALE' ? '男' : row.gender === '女' || row.gender === 'FEMALE' ? '女' : '其他',
        age: Number(row.age ?? 0),
        patientType: row.patientType ?? row.type ?? '门诊',
        registeredAt: row.registeredAt ?? new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isVIP: Boolean(row.isVIP),
        tags: Array.isArray(row.tags) ? row.tags : [],
      };
      create('patients', rec);
      imported++;
    });
    return HttpResponse.json({ success: true, data: { imported, skipped, errors } });
  }),

  // [W4-A] CSV 导出 (必须在 :id 之前)
  http.get(`${API_BASE}/patients/export`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const name = url.searchParams.get('name') ?? '';
    const phone = url.searchParams.get('phone') ?? '';
    const all = list<any>('patients') as any[];
    const rows = all.filter((p: any) =>
      (!name || String(p.name ?? '').includes(name)) &&
      (!phone || String(p.phone ?? '').includes(phone)),
    );
    const header = ['id', 'name', 'gender', 'age', 'phone', 'idCard', 'patientType', 'registeredAt'];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const p of rows) lines.push(header.map((h) => esc((p as any)[h])).join(','));
    return HttpResponse.json({
      success: true,
      data: { filename: `patients_${new Date().toISOString().slice(0, 10)}.csv`, content: '\ufeff' + lines.join('\n'), count: rows.length },
    });
  }),

  // 按模态分组 (必须在 :id 之前)
  

  // 按状态分组 (必须在 :id 之前)
  

  // 详情 (完整 PatientDto 25 字段)
  http.get(`${API_BASE}/patients/:id`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    let p = get<any>('patients', id);
    // [W2-B-3] 测试/演示患者 TMP001 兜底 (patients/:id/360 等路由使用)
    if (!p && id === 'TMP001') {
      p = {
        id: 'TMP001',
        name: '演示患者',
        gender: '男',
        age: 45,
        birthDate: '1981-06-15',
        phone: '13800138000',
        idCard: '11010119810615XXXX',
        bloodType: 'A',
        type: '门诊',
        referringDepartment: '呼吸内科',
        referringDoctor: '李明辉',
        chiefComplaint: '咳嗽咳痰两周',
        clinicalDiagnosis: '肺结节待查',
        icd10: 'R91.1',
        modality: 'CT',
        bodyPart: '胸部',
        examItem: '胸部CT平扫',
        registeredAt: '2026-07-01T08:00:00Z',
        examDate: '2026-07-02T09:30:00Z',
        status: '已签发',
        priority: '普通',
        isVIP: false,
        tags: [],
      };
    }
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

  // [W2-4] 患者合并: 源患者关联 (exam/report/appointment/critical) 全部迁至目标患者, 然后软删源患者
  http.post(`${API_BASE}/patients/merge`, async ({ request }) => {
    await delay(200);
    try {
      const body = (await request.json()) as { sourceId?: string; targetId?: string };
      const sourceId = body?.sourceId;
      const targetId = body?.targetId;
      const source = sourceId ? get<any>('patients', sourceId) : null;
      const target = targetId ? get<any>('patients', targetId) : null;
      if (!source) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Source patient ${sourceId} not found` } }, { status: 404 });
      if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Target patient ${targetId} not found` } }, { status: 404 });
      if (sourceId === targetId) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Cannot merge a patient with itself' } }, { status: 400 });

      const exams = list<any>('exams').filter((e: any) => e.patientId === sourceId);
      const reports = list<any>('reports').filter((r: any) => r.patientId === sourceId);
      const criticals = list<any>('criticalEvents').filter((c: any) => c.patientId === sourceId);
      exams.forEach((e: any) => update<any>('exams', e.id ?? e.reportId, { ...e, patientId: targetId }));
      reports.forEach((r: any) => update<any>('reports', r.id ?? r.reportId, { ...r, patientId: targetId }));
      criticals.forEach((c: any) => update<any>('criticalEvents', c.id, { ...c, patientId: targetId }));
      // appointments 为 handlers.ts 模块内可变记录集
      appointmentRecords = appointmentRecords.map((a: any) => (a.patientId === sourceId ? { ...a, patientId: targetId, patientName: target.name } : a));

      remove('patients', sourceId as string);
      auditCreate('patients', {
        id: `merge-${Date.now()}`,
        sourceId,
        targetId,
        movedExams: exams.length,
        movedReports: reports.length,
        movedAppointments: appointmentRecords.filter((a: any) => a.patientId === targetId).length,
        movedCriticalValues: criticals.length,
        mergedAt: new Date().toISOString(),
      });
      return HttpResponse.json({ success: true, data: { ok: true, merged: { sourceId, targetId, movedExams: exams.length, movedReports: reports.length, movedAppointments: 0, movedCriticalValues: criticals.length } } });
    } catch (e) {
      return HttpResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error)?.message ?? String(e) } }, { status: 500 });
    }
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

  // 工作量统计 (deviceApi.getStats, /devices/stats/today 已在 :id 之前注册)
  http.get(`${API_BASE}/devices/:id/stats`, async ({ params }) => {
    await delay(60);
    const id = params.id as string;
    const base = id.includes('CT') ? 120 : id.includes('MR') ? 60 : id.includes('DR') ? 200 : 15;
    return HttpResponse.json({ success: true, data: {
      deviceId: id,
      todayExams: Math.max(1, base + Math.floor(Math.random() * 30)),
      totalExams: base * 120,
      usageMinutes: Math.max(60, base * 8 + Math.floor(Math.random() * 240)),
    } });
  }),

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
// [G005 W3-A] 已移除 /dicom/wado-rs/* 段: wadoRsApi 改调 /dicom-web/studies (QIDO-RS),
//             mock 由 shellUpgradeHandlers.dicomWebHandlers + POST STOW 处理器覆盖。
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

// ============= Print(8) - [v3.0.6.11-81 W2-B] DICOM 胶片打印子系统 =============
// [v3.0.6.11-88] 打印队列: 后端 print.controller 已实现 (jobs/queues/history/printers/stats), 此处仅 MSW dev 兜底
interface PrintTask {
  id: string
  filmId: string
  patientId: string
  patientName: string
  modality: string
  studyType: string
  filmSpec: string
  copies: number
  status: 'queued' | 'printing' | 'completed' | 'failed'
  printer: string
  submitTime: string
  completeTime: string | null
  progress: number
  errorMsg?: string
}

let printQueueStore: PrintTask[] = [
  { id: 'DPT001', filmId: 'FLM20260504001', patientId: 'P20260502001', patientName: '王建国', modality: 'CT', studyType: '胸部CT平扫', filmSpec: '14x17', copies: 1, status: 'printing', printer: '柯尼卡 #1', submitTime: '2026-08-08 08:30:00', completeTime: null, progress: 65 },  { id: 'DPT002', filmId: 'FLM20260504002', patientId: 'P20260502002', patientName: '刘淑芳', modality: 'MR', studyType: '头颅MR平扫', filmSpec: '14x17', copies: 1, status: 'queued', printer: '柯尼卡 #2', submitTime: '2026-08-08 08:25:00', completeTime: null, progress: 0 },
  { id: 'DPT003', filmId: 'FLM20260504003', patientId: 'P20260502003', patientName: '陈志强', modality: 'DR', studyType: '胸部DR正侧位', filmSpec: '10x12', copies: 2, status: 'queued', printer: '富士', submitTime: '2026-08-08 08:20:00', completeTime: null, progress: 0 },
  { id: 'DPT004', filmId: 'FLM20260504004', patientId: 'P20260502004', patientName: '赵秀英', modality: 'CT', studyType: '腹部CT增强', filmSpec: '14x17', copies: 1, status: 'completed', printer: '柯尼卡 #1', submitTime: '2026-08-08 08:00:00', completeTime: '2026-08-08 08:05:23', progress: 100 },
  { id: 'DPT005', filmId: 'FLM20260504005', patientId: 'P20260502005', patientName: '孙伟东', modality: 'CT', studyType: '胸部CT平扫', filmSpec: '14x17', copies: 1, status: 'failed', printer: '柯尼卡 #1', submitTime: '2026-08-08 07:55:00', completeTime: '2026-08-08 08:00:10', progress: 30, errorMsg: '打印机缺纸' },
  { id: 'DPT006', filmId: 'FLM20260504006', patientId: 'P20260502006', patientName: '周丽华', modality: 'MR', studyType: '腰椎MR平扫', filmSpec: '14x17', copies: 1, status: 'completed', printer: '柯尼卡 #2', submitTime: '2026-08-08 07:50:00', completeTime: '2026-08-08 07:56:45', progress: 100 },
  { id: 'DPT007', filmId: 'FLM20260504007', patientId: 'P20260502007', patientName: '吴敏', modality: 'DR', studyType: '膝关节DR', filmSpec: '8x10', copies: 1, status: 'queued', printer: '富士', submitTime: '2026-08-08 07:45:00', completeTime: null, progress: 0 },
  { id: 'DPT008', filmId: 'FLM20260504008', patientId: 'P20260502008', patientName: '郑海涛', modality: 'CT', studyType: '头颅CT平扫', filmSpec: '14x17', copies: 1, status: 'completed', printer: '柯尼卡 #1', submitTime: '2026-08-08 07:30:00', completeTime: '2026-08-08 07:35:18', progress: 100 },
  { id: 'DPT009', filmId: 'FLM20260504009', patientId: 'P20260502009', patientName: '黄晓燕', modality: 'MR', studyType: '肩关节MR', filmSpec: '10x12', copies: 2, status: 'queued', printer: '柯尼卡 #2', submitTime: '2026-08-08 07:25:00', completeTime: null, progress: 0 },
  { id: 'DPT010', filmId: 'FLM20260504010', patientId: 'P20260502010', patientName: '杨建军', modality: 'CT', studyType: '肺部CT低剂量', filmSpec: '14x17', copies: 1, status: 'printing', printer: '柯尼卡 #1', submitTime: '2026-08-08 07:20:00', completeTime: null, progress: 32 },
];

// [G005 Wave2A P0] 打印机内存存储
let mswPrinterStore: any[] = [
  { id: 'P001', name: '柯尼卡 DICOM 打印机 1', type: 'network', status: 'online', location: 'CT检查室1', filmSpec: '14x17', defaultCopies: 1, dpi: 300, aet: 'KNK_PRINT_1', host: '192.168.10.11', port: 104, mediumTypes: ['BLUE FILM', 'CLEAR FILM'], filmsPerHour: 40 },
  { id: 'P002', name: '柯尼卡 DICOM 打印机 2', type: 'network', status: 'online', location: 'MR检查室', filmSpec: '14x17', defaultCopies: 1, dpi: 300, aet: 'KNK_PRINT_2', host: '192.168.10.12', port: 104, mediumTypes: ['BLUE FILM'], filmsPerHour: 40 },
  { id: 'P003', name: '富士 DICOM 打印机', type: 'network', status: 'online', location: 'DR检查室', filmSpec: '10x12', defaultCopies: 1, dpi: 600, aet: 'FUJI_PRINT_1', host: '192.168.10.13', port: 105, mediumTypes: ['CLEAR FILM', 'MAMMO BLUE'], filmsPerHour: 60 },
  { id: 'P004', name: '本地报告打印机', type: 'local', status: 'online', location: '登记台', filmSpec: 'A4', defaultCopies: 2, dpi: 600 },
  { id: 'P005', name: '激光报告打印机', type: 'local', status: 'offline', location: '诊断室1', filmSpec: 'A4', defaultCopies: 1, dpi: 1200 },
];

export const printHandlers = [
  // [G005 Wave1A P0] 打印任务列表 (GET /print/jobs?status=)
  http.get(`${API_BASE}/print/jobs`, async ({ request }) => {
    await delay(100);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let data = printQueueStore;
    if (status) data = data.filter((t) => t.status === status);
    return HttpResponse.json({ success: true, data });
  }),
  // [G005 Wave1A P0] 打印任务详情 (GET /print/jobs/:id)
  http.get(`${API_BASE}/print/jobs/:id`, async ({ params }) => {
    await delay(60);
    const task = printQueueStore.find((t) => t.id === params.id);
    if (!task) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: task });
  }),

  // [G005 Wave1A P0] 打印队列 (GET /print/queues, 排队中/打印中)
  http.get(`${API_BASE}/print/queues`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: printQueueStore.filter((t) => t.status === 'queued' || t.status === 'printing') });
  }),

  http.get(`${API_BASE}/print/queue`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: printQueueStore.filter((t) => t.status === 'queued' || t.status === 'printing') });
  }),

  http.get(`${API_BASE}/print/history`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: printQueueStore.filter((t) => t.status === 'completed' || t.status === 'failed') });
  }),

  // [G005 Wave2A P0] 打印机内存存储 (GET/POST/PUT/DELETE /print/printers)
  http.get(`${API_BASE}/print/printers`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: mswPrinterStore });
  }),

  http.post(`${API_BASE}/print/printers`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const printer = {
      id: 'PRT' + String(mswPrinterStore.length + 1).padStart(3, '0'),
      name: body.name || '未命名打印机',
      type: body.type || 'network',
      status: body.status || 'online',
      location: body.location || '',
      filmSpec: body.filmSpec || '14x17',
      defaultCopies: body.defaultCopies ?? 1,
      dpi: body.dpi ?? 300,
      aet: body.aet,
      host: body.host,
      port: body.port,
      mediumTypes: body.mediumTypes,
      filmsPerHour: body.filmsPerHour,
    };
    mswPrinterStore = [printer, ...mswPrinterStore];
    return HttpResponse.json({ success: true, data: printer }, { status: 201 });
  }),

  http.put(`${API_BASE}/print/printers/:id`, async ({ params, request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const idx = mswPrinterStore.findIndex((p) => p.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    mswPrinterStore[idx] = { ...mswPrinterStore[idx], ...body, id: params.id };
    return HttpResponse.json({ success: true, data: mswPrinterStore[idx] });
  }),

  http.delete(`${API_BASE}/print/printers/:id`, async ({ params }) => {
    await delay(100);
    const idx = mswPrinterStore.findIndex((p) => p.id === params.id);
    if (idx >= 0) mswPrinterStore.splice(idx, 1);
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),

  // 胶片用量 / 设备打印量 / 成本报表
  http.get(`${API_BASE}/print/stats`, async () => {
    await delay(100);
    const filmUsage = ['08-02', '08-03', '08-04', '08-05', '08-06', '08-07', '08-08'].map((date, i) => {
      const films14x17 = 38 + i * 4 + Math.floor(Math.random() * 8);
      const films10x12 = 18 + i * 3 + Math.floor(Math.random() * 6);
      const films8x10 = 6 + i + Math.floor(Math.random() * 4);
      const total = films14x17 + films10x12 + films8x10;
      return { date, films14x17, films10x12, films8x10, total, cost: Math.round(total * 12.5 * 10) / 10 };
    });
    return HttpResponse.json({
      success: true,
      data: {
        filmUsage,
        devicePrint: [
          { device: 'CT-1', printCount: 156, totalFilms: 312, cost: 3900 },
          { device: 'CT-2', printCount: 142, totalFilms: 284, cost: 3550 },
          { device: 'MR-1', printCount: 98, totalFilms: 392, cost: 4900 },
          { device: 'DR-1', printCount: 210, totalFilms: 210, cost: 2625 },
          { device: 'DR-2', printCount: 185, totalFilms: 185, cost: 2312.5 },
        ],
        costReport: filmUsage.slice(-7).map((d) => ({
          date: '2026-' + d.date.replace('-', '-'),
          filmCost: d.cost,
          paperCost: Math.round(d.total * 0.5),
          inkCost: Math.round(d.total * 1.4),
          total: Math.round(d.cost + d.total * 1.9),
        })),
      },
    });
  }),

  http.post(`${API_BASE}/print/jobs`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as any;
    const task: PrintTask = {
      id: 'DPT' + String(printQueueStore.length + 1).padStart(3, '0'),
      filmId: 'FLM20260504' + String(printQueueStore.length + 1).padStart(3, '0'),
      patientId: body.patientId || 'P' + Date.now(),
      patientName: body.patientName || '未知患者',
      modality: body.modality || body.examType || 'CT',
      studyType: body.studyDesc || body.studyType || '胶片打印',
      filmSpec: body.filmSpec || '14x17',
      copies: body.copies || 1,
      status: 'queued',
      printer: body.printer || '柯尼卡 #1',
      submitTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      completeTime: null,
      progress: 0,
    };
    printQueueStore = [task, ...printQueueStore];
    return HttpResponse.json({ success: true, data: task }, { status: 201 });
  }),

  http.post(`${API_BASE}/print/jobs/:id/cancel`, async ({ params }) => {
    await delay(100);
    const idx = printQueueStore.findIndex((t) => t.id === params.id);
    if (idx >= 0) printQueueStore.splice(idx, 1);
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),

  http.post(`${API_BASE}/print/jobs/:id/retry`, async ({ params }) => {
    await delay(100);
    const t = printQueueStore.find((x) => x.id === params.id);
    if (t) {
      t.status = 'queued';
      t.progress = 0;
      t.errorMsg = undefined;
      t.submitTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    }
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),

  // [G005 Wave1A P0] 重新打印 (POST /print/jobs/:id/reprint, 以原任务参数新建任务)
  http.post(`${API_BASE}/print/jobs/:id/reprint`, async ({ params }) => {
    await delay(150);
    const src = printQueueStore.find((t) => t.id === params.id);
    if (!src) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const task: PrintTask = {
      id: 'DPT' + String(printQueueStore.length + 1).padStart(3, '0'),
      filmId: src.filmId,
      patientId: src.patientId,
      patientName: src.patientName,
      modality: src.modality,
      studyType: src.studyType,
      filmSpec: src.filmSpec,
      copies: src.copies,
      status: 'queued',
      printer: src.printer,
      submitTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      completeTime: null,
      progress: 0,
      errorMsg: undefined,
    };
    printQueueStore = [task, ...printQueueStore];
    return HttpResponse.json({ success: true, data: task }, { status: 201 });
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
  http.get(`${API_BASE}/stats/weekly`, async () => {
    await delay(80);
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

  // [W2-B-3] 预测趋势 (StatsReportPage analyticsStatsApi.getForecast)
  //   对齐后端 stats.controller getForecast: ForecastPoint[] (date/actual/forecast/upper/lower)
  http.get(`${API_BASE}/stats/forecast`, async () => {
    await delay(80);
    const days = 30;
    const points: any[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const date = d.toISOString().slice(0, 10);
      const base = 260 + Math.sin((days - i) / 4) * 60 + ((days - i) % 7) * 8;
      points.push({
        date,
        actual: i > 7 ? Math.round(base) : null,
        forecast: Math.round(base * 1.02),
        upper: Math.round(base * 1.18),
        lower: Math.round(base * 0.85),
      });
    }
    return HttpResponse.json({ success: true, data: points });
  }),

  // [W2-B-3] 设备利用率 (StatsReportPage analyticsStatsApi.getUtilization)
  http.get(`${API_BASE}/stats/utilization`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { current: 86.5, target: 90, max: 100 } });
  }),

  // [W2-B-3] 报告准确率 (StatsReportPage analyticsStatsApi.getAccuracy)
  http.get(`${API_BASE}/stats/accuracy`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { value: 96.8, previous: 95.9 } });
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
    const id = params.id as string;
    const u = get<any>('doctors', id);
    if (!u) {
      // 对齐后端 users.controller GET /users/:id (users.service.findById): 找不到时返回合成用户,避免 404/500
      return HttpResponse.json({
        success: true,
        data: {
          id,
          name: '未知用户',
          fullName: '未知用户',
          username: id.toLowerCase(),
          role: 'DOCTOR',
          department: '放射科',
          title: 'DOCTOR',
          subspecialty: 'General',
          certifications: [],
          active: true,
          isActive: true,
          permissions: ['*'],
        },
      });
    }
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

  // 更新 (userApi.update 用 PATCH, 对齐后端 users.controller @Patch(':id'))
  http.patch(`${API_BASE}/users/:id`, async ({ params, request }) => {
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
    const pending = all.map((e: any) => ({
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

  // [v3.0.6.11-88] 会诊统计 (后端 consultations.controller GET /consultations/stats, MSW dev 兜底; 静态子路由须在 :id 之前)
  http.get(`${API_BASE}/consultations/stats`, async () => {
    await delay(60);
    return HttpResponse.json({ success: true, data: { total: 8, pendingCount: 3, repliedCount: 2, completedCount: 2, cancelledCount: 1, byType: { MDT: 2, '疑难病例': 3, '远程会诊': 2, '二次意见': 1 }, byDepartment: { '放射科': 5, '神经内科': 2, '心内科': 1 } } });
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
    return HttpResponse.json({ success: true, data: { id: params.id, ...(await request.json()) as any } });
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

  // [v3.0.6.11-88] 邀请会诊专家 (后端 POST /consultations/:id/invite)
  http.post(`${API_BASE}/consultations/:id/invite`, async ({ params, request }) => {
    await delay(80);
    const body = (await request.json()) as { doctorIds: string[] };
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'invite', entityType: 'consultations', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: { id: params.id, consultants: body.doctorIds ?? [] } });
  }),

  // [v3.0.6.11-88] 开始会诊 (后端 POST /consultations/:id/start)
  http.post(`${API_BASE}/consultations/:id/start`, async ({ params }) => {
    await delay(80);
    recordWorkflowEvent({ actorId: 'system', actorName: '系统', action: 'start', entityType: 'consultations', entityId: params.id as string });
    return HttpResponse.json({ success: true, data: { id: params.id, status: '已回复' } });
  }),

  // [Wave2B] 会诊评论 (CollaborationPage: GET/POST /consultations/:id/comments)
  http.get(`${API_BASE}/consultations/:id/comments`, async ({ params }) => {
    await delay(60);
    const id = params.id as string;
    const all = list<any>('consultation_comments').filter((c: any) => c.consultationId === id);
    if (all.length === 0) {
      const seed = [
        { id: `cc-${id}-1`, consultationId: id, author: '张明远', content: '右肺下叶病灶建议加做增强CT进一步评估血供情况。', createdAt: new Date(Date.now() - 3600_000).toISOString() },
        { id: `cc-${id}-2`, consultationId: id, author: '李慧敏', content: '同意，建议同时行纵隔淋巴结穿刺活检。', createdAt: new Date(Date.now() - 1800_000).toISOString() },
      ];
      seed.forEach((c) => { try { create('consultation_comments', c); } catch { /* noop */ } });
      return HttpResponse.json({ success: true, data: seed });
    }
    return HttpResponse.json({ success: true, data: all });
  }),
  http.post(`${API_BASE}/consultations/:id/comments`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as { author?: string; content?: string };
    const comment = {
      id: `cc-${Date.now()}`,
      consultationId: id,
      author: body.author || '当前用户',
      content: String(body.content || ''),
      createdAt: new Date().toISOString(),
    };
    try { create('consultation_comments', comment); } catch { /* noop */ }
    return HttpResponse.json({ success: true, data: comment }, { status: 201 });
  }),
  http.post(`${API_BASE}/consultations/:id/comments/:commentId/reply`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as { author?: string; content?: string };
    const reply = {
      id: `cr-${Date.now()}`,
      consultationId: id,
      parentId: params.commentId as string,
      author: body.author || '当前用户',
      content: String(body.content || ''),
      createdAt: new Date().toISOString(),
    };
    try { create('consultation_comments', reply); } catch { /* noop */ }
    return HttpResponse.json({ success: true, data: reply }, { status: 201 });
  }),
];

// ============= Queue (10) - v3.0.6.8-32 接入 EXAM_REPORT_PRE + DEVICE_MASTER =============
// [W1-A P0] 返回 QueueCallPage 期望形状 (中文状态/优先级/患者类型, queueNum 等),
//           保证叫号流程(呼叫→已呼叫→重呼/完成)在 mock 模式可用
const toQueueStatusZh = (e: any, idx: number): string => {
  const st = String(e.status ?? '');
  if (st === 'reviewed' || st === 'in_service' || st === '已呼叫') return '已呼叫';
  if (st === '已签发' || st === 'completed' || st === '已完成') return '已完成';
  if (idx % 7 === 4) return '已呼叫'; // 演示数据: 部分已呼叫
  return '等待中';
};

export const queueHandlers = [
  // 队列 (按 status=submitted/reviewed 派生)
  http.get(`${API_BASE}/queue`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('exams').filter((e: any) => e.status === 'submitted' || e.status === 'reviewed');
    const result = applyQuery(all, opts);
    const rooms = Object.fromEntries(list<any>('devices').map((d: any) => [d.id, d.room ?? d.name ?? '']));
    const queueItems = result.data.map((e: any, idx: number) => {
      const statusZh = toQueueStatusZh(e, idx);
      const qnum = `${e.modality ?? 'CT'}-${String(idx + 1).padStart(3, '0')}`;
      return {
        id: `q-${e.reportId ?? e.id}`,
        examId: e.examId ?? e.id,
        queueNum: qnum,
        queueNumber: qnum,
        patientId: e.patientId,
        patientName: e.patientName,
        gender: e.patientGender === '女' ? '女' : '男',
        age: e.patientAge ?? 0,
        modality: e.modality,
        examItemName: e.examItemName ?? e.examItem ?? e.bodyPart,
        examRoom: rooms[e.deviceId ?? ''] ?? e.room ?? '检查室',
        roomId: e.deviceId ?? '',
        status: statusZh,
        registerTime: (e.examAt ?? e.scheduledAt ?? '').toString().slice(11, 16),
        waitMinutes: (result.data.length - idx) * 5,
        priority: e.priority === '加急' || e.priority === '危急' ? '危重' : '普通',
        patientType: e.patientType === '住院' ? '住院' : e.patientType === '急诊' ? '急诊' : '门诊',
        calledCount: statusZh === '已呼叫' ? 1 : 0,
        calledAt: undefined,
        completedAt: undefined,
      };
    });
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

  // [W1-A P0] 房间队列 (按 deviceId 派生, scheduledAt 排序)
  http.get(`${API_BASE}/queue/:roomId`, async ({ params }) => {
    await delay(60);
    const roomId = params.roomId as string;
    const device = get<any>('devices', roomId);
    const queue = list<any>('exams')
      .filter((e: any) => (e.deviceId === roomId || e.room === roomId) && e.status !== 'completed')
      .sort((a: any, b: any) => String(a.examAt ?? a.scheduledAt ?? '').localeCompare(String(b.examAt ?? b.scheduledAt ?? '')))
      .slice(0, 20)
      .map((e: any, idx: number) => ({
        id: `q-${e.reportId ?? e.id}`,
        queueNumber: `${e.modality}-${String(idx + 1).padStart(3, '0')}`,
        patientName: e.patientName,
        examItem: e.examItem ?? e.bodyPart,
        roomId,
        status: e.status === 'in_service' ? 'in_service' : 'waiting',
      }));
    return HttpResponse.json({ success: true, data: { roomId, roomName: device?.room ?? roomId, queue } });
  }),

  // [W1-A P0] 房间状态
  http.get(`${API_BASE}/queue/:roomId/status`, async ({ params }) => {
    await delay(50);
    const roomId = params.roomId as string;
    const device = get<any>('devices', roomId);
    const queue = list<any>('exams').filter((e: any) => e.deviceId === roomId && e.status !== 'completed');
    return HttpResponse.json({ success: true, data: {
      id: roomId,
      roomNumber: device?.room ?? roomId,
      modality: device?.modality ?? '',
      status: device?.status === '运行中' ? '使用中' : '空闲',
      waitCount: queue.length,
      queueCount: queue.length,
      completedToday: 0,
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
// [W3-2] 升级: 内存 CRUD + 版本/使用统计/共享状态 + 智能片段端点 (ReportTemplateManagerPage)
let templateStore: any[] | null = null;
let snippetStore: any[] | null = null;
let categoryStore: any[] | null = null;
let favoriteTemplateIds: Set<string> | null = null;

// [v3.0.6.11-98 Wave2B (报告 P1)] 模板收藏 (内存 + seed, 对齐后端 favorites seed)
function getFavoriteTemplateIds(): Set<string> {
  if (!favoriteTemplateIds) {
    favoriteTemplateIds = new Set(['tpl-chest-ct-v2', 'tpl-abd-mr-v1', 'tpl-spine-ct-v1']);
  }
  return favoriteTemplateIds;
}

// [v3.0.6.11-96 Wave3B P1] 模板分类种子 (name/description/sortOrder, 对齐后端 seed)
function getCategoryStore(): any[] {
  if (!categoryStore) {
    categoryStore = [
      { id: 'TC-001', name: 'CT', description: 'CT 各类检查的标准化报告模板', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'TC-002', name: 'MR', description: 'MR 各类检查的标准化报告模板', sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'TC-003', name: 'MG', description: '乳腺钼靶/断层 (MG/DBT) 检查模板', sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'TC-004', name: 'DR', description: 'DR 数字化X线检查模板', sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'TC-005', name: 'US', description: '超声检查模板', sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'TC-006', name: '特殊检查', description: 'PET-CT / DSA / 胃肠造影等特殊检查', sortOrder: 6, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];
  }
  return categoryStore;
}

function getTemplateStore(): any[] {
  if (!templateStore) {
    templateStore = [
      // [v3.0.6.11-98 Wave2A P1] status 对齐审批流: approved/draft/pending/rejected (原 published→approved)
      { id: 'TPL-001', name: 'CT Chest Routine', category: '结构化', modality: 'CT', bodyPart: '胸部', body: '影像所见：双肺纹理清晰，未见实变及肿块影。\n诊断意见：胸部 CT 未见明显异常。', version: 3, usage: 147, status: 'approved', shared: true, tags: ['chest', 'routine'], createdById: 'u-admin', approvedBy: 'u-admin', approvedAt: '2026-06-30T09:00:00.000Z', createdAt: '2026-05-01T08:00:00.000Z', updatedAt: '2026-06-30T10:00:00.000Z' },
      { id: 'TPL-002', name: 'CBCT Dental Implant', category: '结构化', modality: 'CBCT', bodyPart: '下颌骨', body: '影像所见：36 位缺牙区骨高度 12.5mm，骨密度 850HU，下牙槽神经管距离牙槽嵴 15.2mm。\n诊断意见：骨量满足种植条件。', version: 2, usage: 89, status: 'approved', shared: true, tags: ['dental', 'implant'], createdById: 'u-doc1', approvedBy: 'u-admin', approvedAt: '2026-06-26T09:00:00.000Z', createdAt: '2026-05-10T08:00:00.000Z', updatedAt: '2026-06-25T10:00:00.000Z' },
      { id: 'TPL-003', name: 'OCT Macula', category: '自由文本', modality: 'OCT', bodyPart: '视网膜', body: '黄斑中心凹结构未见明显异常，各层连续。', version: 1, usage: 234, status: 'approved', shared: true, tags: ['eye', 'oct'], createdById: 'u-doc2', approvedBy: 'u-admin', approvedAt: '2026-06-02T09:00:00.000Z', createdAt: '2026-05-20T08:00:00.000Z', updatedAt: '2026-06-01T10:00:00.000Z' },
      { id: 'TPL-004', name: 'MRI Brain Tumor Follow-up', category: '结构化', modality: 'MRI', bodyPart: '脑部', body: '影像所见：原病灶较前片缩小。\n诊断意见：疗效评价 PR。', version: 1, usage: 56, status: 'draft', shared: false, tags: ['brain', 'tumor'], createdById: 'u-doc3', createdAt: '2026-06-10T08:00:00.000Z', updatedAt: '2026-06-12T10:00:00.000Z' },
      { id: 'TPL-005', name: '腹部超声常规', category: '自由文本', modality: 'US', bodyPart: '腹部', body: '影像所见：肝胆胰脾肾未见明显异常。\n诊断意见：腹部超声未见明显异常。', version: 1, usage: 0, status: 'pending', shared: false, tags: ['abdomen', 'us'], createdById: 'u-doc3', createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-07-01T08:00:00.000Z' },
      { id: 'TPL-006', name: '头颅MR平扫', category: '结构化', modality: 'MRI', bodyPart: '头颅', body: '影像所见：脑实质内未见异常信号灶。\n诊断意见：头颅MRI平扫未见明显异常。', version: 1, usage: 0, status: 'rejected', shared: false, tags: ['brain'], createdById: 'u-doc1', rejectReason: '缺少脑室系统描述, 请补充', createdAt: '2026-07-02T08:00:00.000Z', updatedAt: '2026-07-03T08:00:00.000Z' },
    ];
  }
  return templateStore;
}

function getSnippetStore(): any[] {
  if (!snippetStore) {
    snippetStore = [
      { id: 'SNP-001', name: '正常所见 - 胸部', content: '无急性心肺异常。', category: '正常', shortcuts: 'nml-chest', usage: 421, createdAt: '2026-05-01T08:00:00.000Z' },
      { id: 'SNP-002', name: '植入体 #36 描述', content: '植入体 #36 牙冠，骨结合良好。', category: '牙科', shortcuts: 'imp-36', usage: 98, createdAt: '2026-05-05T08:00:00.000Z' },
      { id: 'SNP-003', name: '对比剂反应记录', content: '轻度荨麻疹，抗组胺治疗后缓解。', category: '安全', shortcuts: 'ctr-rxn', usage: 67, createdAt: '2026-05-08T08:00:00.000Z' },
      // [v3.0.6.11-98 Wave1B P0-2] 模板变量示例片段: 书写页插入时按报告上下文自动填充
      { id: 'SNP-004', name: '患者基本信息', content: '患者 {{patientName}}, {{gender}}, {{age}} 岁,临床诊断 {{clinicalDx}}。', category: '通用', shortcuts: 'pt-basic', usage: 1980, createdAt: '2026-05-10T08:00:00.000Z' },
      { id: 'SNP-005', name: '与老片比较', content: '与 {{priorDate}} 老片比较,病灶较前{{change}}。', category: '通用', shortcuts: 'cmp-prior', usage: 380, createdAt: '2026-05-12T08:00:00.000Z' },
    ];
  }
  return snippetStore;
}

export const templateHandlers = [
  // 智能片段 (静态路径需在 /templates/:id 之前注册)
  // [G005 Wave1B P1] 标注更新: 后端 templates.controller 已补 snippets 端点, 此处仅 mock 兜底
  http.get(`${API_BASE}/templates/snippets`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    let data = [...getSnippetStore()];
    if (category) data = data.filter((s) => s.category === category);
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  http.post(`${API_BASE}/templates/snippets`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const item = {
      id: `SNP-${String(getSnippetStore().length + 1).padStart(3, '0')}`,
      name: body.name || '未命名片段',
      content: body.content || '',
      category: body.category || '通用',
      shortcuts: body.shortcuts || '',
      usage: 0,
      createdAt: new Date().toISOString(),
    };
    getSnippetStore().unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.delete(`${API_BASE}/templates/snippets/:id`, async ({ params }) => {
    await delay(60);
    const idx = getSnippetStore().findIndex((s) => s.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    getSnippetStore().splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  // [v3.0.6.11-96 Wave3B P1] 模板分类 CRUD (内存 + seed, 对齐后端 /templates/categories) — 静态路径需在 /templates/:id 之前
  http.get(`${API_BASE}/templates/categories`, async () => {
    await delay(80);
    const cats = [...getCategoryStore()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return HttpResponse.json({ success: true, data: cats, meta: { total: cats.length } });
  }),
  http.post(`${API_BASE}/templates/categories`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const now = new Date().toISOString();
    const item = {
      id: `TC-${String(getCategoryStore().length + 1).padStart(3, '0')}`,
      name: body.name || '未命名分类',
      description: body.description || '',
      sortOrder: Number(body.sortOrder ?? getCategoryStore().length + 1),
      createdAt: now,
      updatedAt: now,
    };
    getCategoryStore().push(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.patch(`${API_BASE}/templates/categories/:id`, async ({ params, request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const cat = getCategoryStore().find((c) => c.id === params.id);
    if (!cat) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    Object.assign(cat, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: cat });
  }),
  http.delete(`${API_BASE}/templates/categories/:id`, async ({ params }) => {
    await delay(60);
    const idx = getCategoryStore().findIndex((c) => c.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    getCategoryStore().splice(idx, 1);
    return HttpResponse.json({ success: true, data: { ok: true, id: params.id } });
  }),
  // [v3.0.6.11-98 Wave2B (报告 P1)] 模板收藏服务端化 MSW 兜底 (内存+seed, 按用户) — 静态路径需在 /templates/:id 之前
  http.get(`${API_BASE}/templates/favorites`, async () => {
    await delay(80);
    const ids = [...getFavoriteTemplateIds()];
    return HttpResponse.json({ success: true, data: { ids, templates: getTemplateStore().filter((t) => ids.includes(t.id)) }, meta: { total: ids.length } });
  }),
  http.post(`${API_BASE}/templates/:id/favorite`, async ({ params }) => {
    await delay(80);
    const id = String(params.id);
    const set = getFavoriteTemplateIds();
    const favorite = set.has(id);
    if (favorite) set.delete(id);
    else set.add(id);
    return HttpResponse.json({ success: true, data: { favorite: !favorite, ids: Array.from(set) } });
  }),
  http.get(`${API_BASE}/templates`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const bodyPart = url.searchParams.get('bodyPart');
    const keyword = url.searchParams.get('keyword');
    const status = url.searchParams.get('status');
    const personal = url.searchParams.get('personal');
    const userId = url.searchParams.get('userId');
    let data = [...getTemplateStore()];
    if (category) data = data.filter((t) => t.category === category);
    if (bodyPart) data = data.filter((t) => String(t.bodyPart ?? '').includes(bodyPart));
    if (keyword) data = data.filter((t) => t.name.toLowerCase().includes(keyword.toLowerCase()) || String(t.bodyPart).includes(keyword));
    // [v3.0.6.11-98 Wave2A P1] 审批状态过滤 (书写页仅取 approved)
    if (status) data = data.filter((t) => t.status === status);
    // [v3.0.6.11-98 Wave2A P1] 我的模板 (个人模板库): personal=true 按 createdById 过滤
    if (personal === 'true' && userId) data = data.filter((t) => String(t.createdById ?? '') === userId);
    data.sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0));
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  // [v3.0.6.11-98 Wave2A P1] 待审批列表
  http.get(`${API_BASE}/templates/pending`, async () => {
    await delay(80);
    const data = getTemplateStore().filter((t) => t.status === 'pending');
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  // [v3.0.6.11-98 Wave2A P1] 模板审批流: 提交审批 / 批准 / 驳回
  http.post(`${API_BASE}/templates/:id/submit`, async ({ params }) => {
    await delay(100);
    const t = getTemplateStore().find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    if (t.status === 'approved') return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '已批准模板无需再次提交' } }, { status: 400 });
    if (t.status !== 'pending') {
      t.status = 'pending';
      t.rejectReason = undefined;
      t.updatedAt = new Date().toISOString();
    }
    return HttpResponse.json({ success: true, data: t });
  }),
  http.post(`${API_BASE}/templates/:id/approve`, async ({ params, request }) => {
    await delay(100);
    const t = getTemplateStore().find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    if (t.status !== 'pending') return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '仅待审批模板可批准' } }, { status: 400 });
    const body = (await request.json().catch(() => ({}))) as any;
    t.status = 'approved';
    t.approvedBy = body?.approvedBy ?? t.createdById;
    t.approvedAt = new Date().toISOString();
    t.rejectReason = undefined;
    t.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: t });
  }),
  http.post(`${API_BASE}/templates/:id/reject`, async ({ params, request }) => {
    await delay(100);
    const t = getTemplateStore().find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    if (t.status !== 'pending') return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '仅待审批模板可驳回' } }, { status: 400 });
    const body = (await request.json().catch(() => ({}))) as any;
    t.status = 'rejected';
    t.rejectReason = body?.reason?.trim() || '未填写原因';
    t.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: t });
  }),
  http.get(`${API_BASE}/templates/:id`, async ({ params }) => {
    await delay(80);
    const t = getTemplateStore().find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: t });
  }),
  http.post(`${API_BASE}/templates`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const now = new Date().toISOString();
    const item = {
      id: `TPL-${String(getTemplateStore().length + 1).padStart(3, '0')}`,
      name: body.name || '未命名模板',
      category: body.category || '自由文本',
      modality: body.modality || 'CT',
      bodyPart: body.bodyPart || '',
      body: body.body || '',
      tags: body.tags || [],
      version: 1,
      usage: 0,
      status: body.status || 'draft',
      shared: !!body.shared,
      createdById: body.createdById || 'u-admin',
      createdAt: now,
      updatedAt: now,
    };
    getTemplateStore().unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.put(`${API_BASE}/templates/:id`, async ({ params, request }) => {
    await delay(120);
    const body = (await request.json()) as any;
    const t = getTemplateStore().find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    Object.assign(t, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: t });
  }),
  http.patch(`${API_BASE}/templates/:id`, async ({ params, request }) => {
    await delay(120);
    const body = (await request.json()) as any;
    const t = getTemplateStore().find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    Object.assign(t, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: t });
  }),
  http.delete(`${API_BASE}/templates/:id`, async ({ params }) => {
    await delay(80);
    const idx = getTemplateStore().findIndex((x) => x.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    getTemplateStore().splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API_BASE}/templates/:id/clone`, async ({ params }) => {
    await delay(150);
    const t = getTemplateStore().find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const now = new Date().toISOString();
    const copy = { ...t, id: `TPL-${String(getTemplateStore().length + 1).padStart(3, '0')}`, name: `${t.name} (克隆)`, version: 1, usage: 0, status: 'draft', shared: false, createdAt: now, updatedAt: now };
    getTemplateStore().unshift(copy);
    return HttpResponse.json({ success: true, data: copy }, { status: 201 });
  }),
];

// ============= Dictionary (6) =============
// ============= Dictionary (W4-A 数据字典: 分类列表 + 分类条目 CRUD) =============
// 内存数据源, 种子对齐 DictionaryPage 原 mock 分类
const dictSeed: Array<{ category: string; key: string; value: string; sort: number; active: boolean; extra: Record<string, unknown> }> = [
  { category: 'CT检查项目', key: 'CT-BRAIN-NC', value: '颅脑CT平扫', sort: 1, active: true, extra: { pinyin: 'lwnctps', modality: ['CT'], bodyPart: '头部', notes: '常规颅脑平扫，层厚5mm' } },
  { category: 'CT检查项目', key: 'CT-BRAIN-C', value: '颅脑CT增强', sort: 2, active: true, extra: { pinyin: 'lwnctzq', modality: ['CT'], bodyPart: '头部', notes: '需注射对比剂' } },
  { category: 'CT检查项目', key: 'CT-CHEST-NC', value: '胸部CT平扫', sort: 3, active: true, extra: { pinyin: 'xbctps', modality: ['CT'], bodyPart: '胸部', notes: '肺窗+纵隔窗' } },
  { category: 'CT检查项目', key: 'CT-ABD-C', value: '腹部CT增强', sort: 4, active: true, extra: { pinyin: 'fbctzq', modality: ['CT'], bodyPart: '腹部', notes: '三期增强扫描' } },
  { category: 'MRI序列', key: 'MR-T1WI', value: 'T1WI成像', sort: 1, active: true, extra: { pinyin: 't1wi', modality: ['MR'], bodyPart: '全身', notes: 'SE序列' } },
  { category: 'MRI序列', key: 'MR-T2WI', value: 'T2WI成像', sort: 2, active: true, extra: { pinyin: 't2wi', modality: ['MR'], bodyPart: '全身', notes: 'FSE序列' } },
  { category: 'MRI序列', key: 'MR-DWI', value: 'DWI扩散成像', sort: 3, active: true, extra: { pinyin: 'dwkscx', modality: ['MR'], bodyPart: '全身', notes: 'b值800-1000' } },
  { category: 'MRI序列', key: 'MR-FLAIR', value: 'FLAIR序列', sort: 4, active: true, extra: { pinyin: 'flair', modality: ['MR'], bodyPart: '颅脑', notes: '脑白质病变评估' } },
  { category: 'X线检查', key: 'DR-CHEST-PA', value: '胸部正侧位片', sort: 1, active: true, extra: { pinyin: 'xbzcwp', modality: ['DR'], bodyPart: '胸部', notes: '立位PA+侧位' } },
  { category: 'X线检查', key: 'DR-SPINE-L', value: '腰椎正侧位', sort: 2, active: true, extra: { pinyin: 'yzzcw', modality: ['DR'], bodyPart: '腰椎', notes: '腰骶部疼痛评估' } },
  { category: 'X线检查', key: 'DR-PELVIS', value: '骨盆正位', sort: 3, active: true, extra: { pinyin: 'gpzw', modality: ['DR'], bodyPart: '骨盆', notes: '髋关节评估' } },
  { category: '设备类型', key: 'EQ-CT-128', value: '128排CT', sort: 1, active: true, extra: { pinyin: '128pct', modality: ['CT'], bodyPart: '全身', notes: 'Siemens Definition AS+' } },
  { category: '设备类型', key: 'EQ-MR-30T', value: '3.0T MRI', sort: 2, active: true, extra: { pinyin: '30tmri', modality: ['MR'], bodyPart: '全身', notes: 'Siemens TrioTim 3.0T' } },
  { category: '设备类型', key: 'EQ-DR-FLAT', value: '数字化DR', sort: 3, active: true, extra: { pinyin: 'smhdr', modality: ['DR'], bodyPart: '全身', notes: '平板探测器' } },
  { category: '诊断术语', key: 'DIAG-NORMAL', value: '未见明显异常', sort: 1, active: true, extra: { pinyin: 'wjmxyc', modality: ['CT', 'MR', 'DR'], bodyPart: '全身', notes: '正常报告模板' } },
  { category: '诊断术语', key: 'DIAG-STROKE', value: '脑梗死', sort: 2, active: true, extra: { pinyin: 'ngs', modality: ['CT', 'MR'], bodyPart: '颅脑', notes: '急慢性分期' } },
  { category: '诊断术语', key: 'DIAG-FRACTURE', value: '骨折', sort: 3, active: true, extra: { pinyin: 'gz', modality: ['DR', 'CT'], bodyPart: '四肢/脊柱', notes: '请注明部位及类型' } },
  { category: '诊断术语', key: 'DIAG-NODULE', value: '肺结节', sort: 4, active: true, extra: { pinyin: 'fjie', modality: ['CT'], bodyPart: '肺部', notes: '请描述大小/形态' } },
  { category: '检查部位', key: 'BP-HEAD', value: '头部', sort: 1, active: true, extra: { pinyin: 'tb', modality: ['CT', 'MR', 'DR'], bodyPart: '头部', notes: '颅脑/副鼻窦/颞骨' } },
  { category: '检查部位', key: 'BP-CHEST', value: '胸部', sort: 2, active: true, extra: { pinyin: 'xb', modality: ['CT', 'DR', 'MR'], bodyPart: '胸部', notes: '肺/纵隔/胸壁' } },
  { category: '检查部位', key: 'BP-ABD', value: '腹部', sort: 3, active: true, extra: { pinyin: 'fb', modality: ['CT', 'MR', 'DR'], bodyPart: '腹部', notes: '肝胆胰脾肾' } },
  { category: '检查部位', key: 'BP-SPINE', value: '脊柱', sort: 4, active: true, extra: { pinyin: 'jz', modality: ['CT', 'MR', 'DR'], bodyPart: '脊柱', notes: '颈椎/胸椎/腰椎/骶椎' } },
  { category: '造影剂', key: 'CM-IOHEXOL', value: '碘海醇', sort: 1, active: true, extra: { pinyin: 'dhc', modality: ['CT'], bodyPart: '全身', notes: '浓度300/350mgI/ml' } },
  { category: '造影剂', key: 'CM-GD-DTPA', value: '钆喷酸葡胺', sort: 2, active: true, extra: { pinyin: 'gpspa', modality: ['MR'], bodyPart: '全身', notes: '马根维显/莫迪司' } },
  { category: '体位技术', key: 'POS-AP', value: '前后位AP', sort: 1, active: true, extra: { pinyin: 'qhwap', modality: ['DR'], bodyPart: '全身', notes: 'X线束从前往后' } },
  { category: '体位技术', key: 'POS-LAT', value: '侧位LAT', sort: 2, active: true, extra: { pinyin: 'cwlat', modality: ['DR'], bodyPart: '全身', notes: '左侧/右侧位' } },
];

let inMemoryDictEntries: Array<{ id: string; category: string; key: string; value: string; sort: number; active: boolean; extra: Record<string, unknown>; createdAt: string }> =
  dictSeed.map((d, i) => ({ id: `dict-${i + 1}`, ...d, createdAt: new Date().toISOString() }));

export const dictionaryHandlers = [
  // 分类列表 (新版 DictionaryPage; 必须在 /:category 之前, 避免 'categories' 被当分类名)
  http.get(`${API_BASE}/dictionary/categories`, async () => {
    await delay(120);
    const byCat = new Map<string, { count: number; activeCount: number }>();
    for (const d of inMemoryDictEntries) {
      const c = byCat.get(d.category) ?? { count: 0, activeCount: 0 };
      c.count++;
      if (d.active) c.activeCount++;
      byCat.set(d.category, c);
    }
    const categories = Array.from(byCat.entries())
      .map(([category, v]) => ({ category, count: v.count, activeCount: v.activeCount }))
      .sort((a, b) => a.category.localeCompare(b.category, 'zh-CN'));
    return HttpResponse.json({ success: true, data: { categories, total: categories.length } });
  }),

  // 旧协议 (NotificationTemplateDictPage): 词典条目列表, 兼容 category/keyword 过滤
  http.get(`${API_BASE}/dictionary`, async ({ request }) => {
    await delay(100);
    const url = new URL(request.url);
    const category = url.searchParams.get('category') ?? '';
    const keyword = url.searchParams.get('keyword') ?? '';
    const items = inMemoryDictEntries
      .filter((d) => (!category || d.category === category))
      .filter((d) => !keyword || String(d.value).includes(keyword) || String(d.key).includes(keyword))
      .sort((a, b) => a.sort - b.sort)
      .map((d) => ({
        id: d.id,
        category: d.category,
        code: d.key,
        name: d.value,
        description: String(d.extra?.notes ?? ''),
        sortOrder: d.sort,
        isActive: d.active,
        createdAt: d.createdAt,
      }));
    return HttpResponse.json({ success: true, data: items });
  }),

  // 分类条目列表 (新版)
  http.get(`${API_BASE}/dictionary/:category`, async ({ params }) => {
    await delay(100);
    const category = decodeURIComponent(String(params.category ?? ''));
    const items = inMemoryDictEntries
      .filter((d) => d.category === category)
      .sort((a, b) => a.sort - b.sort);
    return HttpResponse.json({ success: true, data: items });
  }),

  // 旧协议: 新增条目 (code→key, name→value)
  http.post(`${API_BASE}/dictionary`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const category = String(body?.category ?? '').trim();
    const key = String(body?.code ?? body?.key ?? '').trim();
    const value = String(body?.name ?? body?.value ?? '').trim();
    if (!category || !key || !value) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'category/code/name 为必填' } }, { status: 400 });
    }
    if (inMemoryDictEntries.some((d) => d.category === category && d.key === key)) {
      return HttpResponse.json({ success: false, error: { code: 'CONFLICT', message: `字典项已存在: ${category}/${key}` } }, { status: 409 });
    }
    const entry = {
      id: body.id || 'dict-' + Date.now(),
      category,
      key,
      value,
      sort: Number(body.sortOrder ?? body.sort ?? 0),
      active: body.isActive !== false && body.active !== false,
      extra: { notes: body.description ?? '', ...(body.extra ?? {}) },
      createdAt: new Date().toISOString(),
    };
    inMemoryDictEntries.push(entry);
    return HttpResponse.json({ success: true, data: entry }, { status: 201 });
  }),

  // 新版: 分类新增条目
  http.post(`${API_BASE}/dictionary/:category`, async ({ params, request }) => {
    await delay(150);
    const category = decodeURIComponent(String(params.category ?? ''));
    const body = (await request.json()) as any;
    if (!category.trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '分类不能为空' } }, { status: 400 });
    if (!String(body?.key ?? '').trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '编码不能为空' } }, { status: 400 });
    if (!String(body?.value ?? '').trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '名称不能为空' } }, { status: 400 });
    if (inMemoryDictEntries.some((d) => d.category === category && d.key === String(body.key).trim())) {
      return HttpResponse.json({ success: false, error: { code: 'CONFLICT', message: `字典项已存在: ${category}/${body.key}` } }, { status: 409 });
    }
    const entry = {
      id: 'dict-' + Date.now(),
      category,
      key: String(body.key).trim(),
      value: String(body.value).trim(),
      sort: Number(body.sort ?? 0),
      active: body.active !== false,
      extra: (body.extra ?? {}) as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };
    inMemoryDictEntries.push(entry);
    return HttpResponse.json({ success: true, data: entry }, { status: 201 });
  }),

  // 旧协议: 按 id 更新
  http.put(`${API_BASE}/dictionary/:id`, async ({ params, request }) => {
    await delay(120);
    const id = String(params.id ?? '');
    const body = (await request.json()) as any;
    const idx = inMemoryDictEntries.findIndex((d) => d.id === id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '字典项不存在' } }, { status: 404 });
    const current = inMemoryDictEntries[idx]!;
    const updated = {
      ...current,
      category: body.category !== undefined ? String(body.category).trim() : current.category,
      key: body.code !== undefined ? String(body.code).trim() : (body.key !== undefined ? String(body.key).trim() : current.key),
      value: body.name !== undefined ? String(body.name).trim() : (body.value !== undefined ? String(body.value).trim() : current.value),
      sort: body.sortOrder !== undefined ? Number(body.sortOrder) : (body.sort !== undefined ? Number(body.sort) : current.sort),
      active: body.isActive !== undefined ? Boolean(body.isActive) : (body.active !== undefined ? Boolean(body.active) : current.active),
      extra: body.description !== undefined ? { ...current.extra, notes: String(body.description) } : current.extra,
    };
    inMemoryDictEntries[idx] = updated;
    return HttpResponse.json({ success: true, data: updated });
  }),

  // 新版: 按 category/key 更新
  http.put(`${API_BASE}/dictionary/:category/:key`, async ({ params, request }) => {
    await delay(120);
    const category = decodeURIComponent(String(params.category ?? ''));
    const key = decodeURIComponent(String(params.key ?? ''));
    const body = (await request.json()) as any;
    const idx = inMemoryDictEntries.findIndex((d) => d.category === category && d.key === key);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `字典项不存在: ${category}/${key}` } }, { status: 404 });
    const current = inMemoryDictEntries[idx]!;
    const nextKey = body.key !== undefined ? String(body.key).trim() : current.key;
    if (nextKey !== key && inMemoryDictEntries.some((d) => d.category === category && d.key === nextKey)) {
      return HttpResponse.json({ success: false, error: { code: 'CONFLICT', message: `字典项已存在: ${category}/${nextKey}` } }, { status: 409 });
    }
    if (body.value !== undefined && !String(body.value).trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '名称不能为空' } }, { status: 400 });
    }
    const updated = {
      ...current,
      key: nextKey,
      value: body.value !== undefined ? String(body.value).trim() : current.value,
      sort: body.sort !== undefined ? Number(body.sort) : current.sort,
      active: body.active !== undefined ? Boolean(body.active) : current.active,
      extra: body.extra !== undefined ? (body.extra as Record<string, unknown>) : current.extra,
    };
    inMemoryDictEntries[idx] = updated;
    return HttpResponse.json({ success: true, data: updated });
  }),

  // 旧协议: 按 id 删除
  http.delete(`${API_BASE}/dictionary/:id`, async ({ params }) => {
    await delay(100);
    const id = String(params.id ?? '');
    const before = inMemoryDictEntries.length;
    inMemoryDictEntries = inMemoryDictEntries.filter((d) => d.id !== id);
    if (inMemoryDictEntries.length === before) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '字典项不存在' } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: { success: true, deletedId: id } });
  }),

  // 新版: 按 category/key 删除
  http.delete(`${API_BASE}/dictionary/:category/:key`, async ({ params }) => {
    await delay(100);
    const category = decodeURIComponent(String(params.category ?? ''));
    const key = decodeURIComponent(String(params.key ?? ''));
    const before = inMemoryDictEntries.length;
    inMemoryDictEntries = inMemoryDictEntries.filter((d) => !(d.category === category && d.key === key));
    if (inMemoryDictEntries.length === before) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `字典项不存在: ${category}/${key}` } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: { success: true, deletedKey: key } });
  }),
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
import { SLA_METRICS, WORKLOAD_STATS, AI_PRE_REVIEW_RESULTS } from '../../data/reportReviewMock';
import { DEFECT_DETAILS } from '../../data/defectLibraryMock';

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

  http.post(`${API_BASE}/reviews/:id/approve`, async ({ params }) => {
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
// ============= R3.CRITICAL 危急值 =============
// [G005-P0] 危急值全部端点由 criticalExtHandlers 提供
//   /api/v1/criticals    → criticals.controller.ts (核心 CRUD/通知/统计)
//   /api/v1/critical-ext → criticalext.controller.ts (规则/中心/统计/自动检测/闭环/接收端/随访)

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
  // [v3.0.6.11-88 Round10] 双无死链补齐: PATCH /quality/defects/:id/status (DefectManagementPage raw fetch, 后端暂无此端点, 演示数据)
  http.patch(`${API_BASE}/quality/defects/:id/status`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json().catch(() => null)) as { status?: string } | null;
    return HttpResponse.json({ success: true, data: { id: params.id, status: body?.status ?? 'open', updatedAt: new Date().toISOString() } });
  }),
  
  
  
  
  
  
  
  
  
  
  
  
  
  
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
  http.delete(`${API_BASE}/sign/certs/:id`, async () => {
    await delay(100);
    return new HttpResponse(null, { status: 204 });
  }),
  
  // [G005-P1] 在用孤儿补齐: 吊销证书 (前端 revokeCertificate 调用 POST)
  http.post(`${API_BASE}/sign/certs/:id/revoke`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as { reason?: string };
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'revoked', reason: body.reason ?? '', revokedAt: new Date().toISOString() } });
  }),
  // [G005-P1] 在用孤儿补齐: 证书签名报告 (前端 signReport 调用)
  http.post(`${API_BASE}/sign/reports/:reportId/sign`, async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as { certificateId?: string; reportHash?: string };
    return HttpResponse.json({
      success: true,
      data: {
        reportId: params.reportId,
        certificateId: body.certificateId,
        signatureHash: `SIG-${params.reportId}-${Date.now().toString(16).toUpperCase()}`,
        signedAt: new Date().toISOString(),
        signedBy: '张明远',
      },
    });
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
  
  
  
  
  http.get(`${API_BASE}/sign/blockchain/proofs`, async () => {
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
  http.get(`${API_BASE}/amend`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true, data: [
      { id: 'rev-ent-001', reportId: 'RP20260601001', version: 1, action: 'start', reason: '原报告遗漏右肺下叶磨玻璃结节', authorName: '张明远', createdAt: '2026-06-05T08:30:00Z' },
      { id: 'rev-ent-004', reportId: 'RP20260602008', version: 1, action: 'start', reason: '病理回报：腺癌，需修订原报告', authorName: '李慧敏', createdAt: '2026-06-03T15:30:00Z' },
      { id: 'rev-ent-006', reportId: 'RP20260603003', version: 1, action: 'start', reason: '左右位置描述错误', authorName: '王建华', createdAt: '2026-06-04T14:00:00Z' },
    ] });
  }),
  
  // [G005-P1] 在用孤儿补齐: 修订单详情 (前端 getAmendment 调用)
  http.get(`${API_BASE}/amend/:id`, async ({ params }) => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id,
        reportId: 'RP20260601001',
        version: 1,
        status: 'in_progress',
        reason: '原报告遗漏右肺下叶磨玻璃结节',
        changes: '补充右肺下叶 5mm 磨玻璃结节描述',
        authorId: 'D001',
        authorName: '张明远',
        startTime: '2026-06-05T08:30:00Z',
      },
    });
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
  http.post(`${API_BASE}/ai/rads`, async () => {
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

export const initialCheckHandlers = [
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  http.get(`${API_BASE}/review/initial-check/summary`, async () => {
    await delay(180);
    return HttpResponse.json({ success: true, data: INITIAL_CHECK_SUMMARY });
  }),
  
];

// ============= R3.REVIEW FINAL CHECK 终核清单 (20) =============
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
const advancedHandlers: any[] = [
  

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
  ...autoCollectionHandlers, // [W3-A] 自动采集 (auto-collectionApi)
  ...diagnosisAccuracyHandlers, // [W3-A] 诊断符合率 (diagnosisAccuracyApi)
  ...mammoQcHandlers, // [W3-A] 乳腺影像质量管理 (mammoQcApi)
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
  // [G005 Wave1A P0-验证] 通知中心独立 handlers (unread/history/stats/read/read-all/vapid/push-*)
  // 此前未接入 handlers 数组 → /notifications/unread/:userId 等全部穿透 vite proxy (后端未启动 → 500)
  ...notificationsHandlers,
  ...templateHandlers,
  ...dictionaryHandlers,
  ...safetyHandlers,
  ...signHandlers,
  ...amendHandlers,
  ...aiReportHandlers,
  ...reviewHandlers,
  ...qualityHandlers,
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
  ...complianceDocsHandlers, // [v3.0.6.11-79 W1-C] 合规文档库 7 端点
  ...tenantHandlers,   // [v3.0.6.11-60] 多租户: current/usage/profile/features + admin list/create/status
  ...storageHandlers,  // [v3.0.6.11-60] cloud-storage 配置 /system/storage-config
  ...wechatHandlers, // [P0-12 v3.0.7] 微信小程序 8 端点
  ...dentalNewHandlers,
  ...workflowHandlers,
  ...financeHandlers,
  ...exportApprovalHandlers, // [W1-5] 导出审批中心 (import 了但从未注册 → POST /export-approval 500 修复)
  ...dataReportHandlers,
  ...teleSignHandlers, // [G005 W1-C] 远程签署 (GET sessions / POST session|approve|reject)
  ...regionalHandlers,
  ...patientPortalHandlers,
  ...cosignNewHandlers,
  ...cdsHandlers,
  ...criticalExtHandlers,
  ...benchmarkHandlers,
  ...teachHandlers, // [G005 P1 W2-C] 示教录制 CRUD + blob 上传/播放
  ...typicalCaseHandlers, // [W3-B] 典型病例库 (MSW 演示数据)
  ...teleHandlers,  // [G005 P1 W2-C] 远程会诊信令/聊天/光标
  ...qcExtHandlers,
  ...reportQualityHandlers,
  ...caHandlers,
  ...deviceMgmtHandlers,
  ...occupancyHandlers, // [W2-A] 检查室占用 (rooms/queue/trends) — 此前未注册导致 /occupancy/* 500
  // [v3.0.6.11-60] AI Orchestrator (模型/集成/任务) 需在 aiPlatformHandlers 之前注册,
  //   避免旧 GET /models /models/:id 通配先匹配
  ...aiOrchestratorHandlers,
  ...orchestratorHandlers, // [v3.0.6.11-79] 流程编排 (/orchestrator/flows/executions/sla)
  ...aiPlatformHandlers,
  ...aiWave2BHandlers, // [v3.0.6.11-88 W2B-2] AI providers / draft patients+templates
  // [W6] 修复: 原 `...aiDiagnosisHandlers,` 被上一行行尾注释吞掉 (-88 引入),
  //      ai-diagnosis (lung/breast/fracture/cardiac) 端点从未注册进 MSW,
  //      /api/v1/ai-diagnosis/* 请求落空到 vite proxy → 后端 → 500/401。
  ...aiDiagnosisHandlers, // [v3.0.6.11-53] AI CAD 端点 (lung/breast/fracture/cardiac + stats/accuracy)
  ...reportDraftHandlers, // [v3.0.6.11-61] 环境式 AI 报告草稿 (/ai/report-draft/*)
  ...hl7Handlers, // [v3.0.6.11-75 W3-1] 注册 HL7 端点 (hl7Api: oru/orm/dft/batch/archive/mllp)
  ...imageAiHandlers, // [v3.0.6.11-75 W3-1] 注册影像 AI 质控端点 (qcImageAiApi: score/score-v2/results/stats)
  // [v3.0.6.11-62] 3D 分割与定量必须在 volumeHandlers 之前注册:
  //   volumeHandlers 的 GET /volume/:studyUid 会吞掉 GET /volume/segmentations/:seriesUID
  ...segmentationHandlers,
  ...volumeHandlers, // [v3.0.6.11-53] 3D 体数据端点 (series/reconstruct/mpr/mip/vr)
  ...cardiacHandlers, // [v3.0.6.11-71] 心脏专科分析 (analyses CRUD)
  ...neuroHandlers, // [v3.0.6.11-81 W2-B] 神经专科分析 (studies/stats/tumor-grades/stroke-windows)
  ...mobileHandlers, // [v3.0.6.11-75] 移动端 API (today-summary/worklist/critical-values/reports/device-token)
  ...asrHandlers, // [Phase 1.4] ASR 语音识别端点
  ...olapHandlers,
  ...oeeHandlers, // [W3-B] OEE 看板 (list/detail/trend/stats) — 此前未注册导致 /oee/* 500
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
  // [G005 P1] MSW 缺口补齐: fhir / ihe / dicom-dimse (页面在用, 后端已实现)
  ...fhirHandlers,
  ...iheHandlers,
  ...dicomDimseHandlers,
  ...radiomicsHandlers,
  // [v3.0.6.11-75 W3-1] 薄弱页面补齐: 远程阅片 / 跨模态检索 / DICOM 共享
  ...remoteReadingHandlers,
  ...crossModalHandlers,
  ...dicomShareHandlers,
  // [W3-2] AI 分检 / 跨科室治疗计划
  ...aiTriageHandlers,
  ...treatmentPlanHandlers,
  // [G005 Wave3A P2] 急诊通道管理 + 科室公告/值班管理 (MSW 内存 + 种子)
  ...emergencyChannelHandlers,
  ...deptHandlers,
  // [v3.0.6.11-79] W1-A 文件管理
  ...filesHandlers,
  // [W4-B] 随访计划
  ...followupHandlers,
  // [W2-B-3] Rad-Path / 科研 / 双阅片 / AI 模型市场 (dev mock 500 修复)
  ...radpathHandlers,
  ...researchHandlers,
  ...dualReadHandlers,
  ...aiMarketplaceHandlers,
  // [v3.0.6.11-98 Wave2B (报告 P1)] 征象库后端化 (finding-library)
  ...findingLibraryHandlers,
];

// 总计: 56 + 6 + 5 + 5 + 6 + 5 = 83 端点

// 总计:11 + 9 + 6 + 5 + 7 + 3 + 5 + 4 + 4 + 2 = 56 端点

// v3.0.5.1 R3.SIGN+R3.AMEND+R3.AI = 50 + 40 + 40 = 130 端点增量

// v3.0.5.1 R3.WRITING+R3.DIST+R3.INTEGRATION+R3.OTHER(本批次)= 40 + 30 + 50 + 20 = 140 端点

// v3.0.5.1 R3.REVIEW INITIAL CHECK = 20 端点增量(80 点)

// v3.0.5.1 R3.REVIEW FINAL CHECK = 20 端点增量(80 点)


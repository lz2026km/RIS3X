// [v3.0.6.8-83] 眼科 API client (统一封装)
// 对标: Topcon Synergy + Medisoft mediSIGHT + Zeiss FORUM + Heidelberg Eye Suite
// v3.0.6.11: 路径已对齐 mockBackend/eyeHandlers.ts (pacs / emr / ai / report)
// v3.0.6.11-21 P0: 移除冗余 `/api/v1` 前缀(由 client.ts API_BASE 在 mock 模式提供)。
//   修复前: client BASE=/api/v1 + path=/api/v1/eye/... => /api/v1/api/v1/eye/... 不匹配 MSW
//   修复后: client BASE=/api/v1 + path=/eye/...        => /api/v1/eye/... 匹配 MSW
// v3.0.6.11-50 确认: EYE_API='/eye' 正确,无需修改。
//   - mock 模式:  BASE='/api/v1' + '/eye/...' => /api/v1/eye/... 匹配 eyeHandlers.ts
//   - real 模式:  BASE='.../api' + '/eye/...' => /api/eye/...  匹配后端 @Controller('api/eye')
//     后端 controller 自带 '/api' 前缀,恰好与 client.ts 的 API_BASE('/api') 拼接互补,无双重前缀。
// [v3.0.6.11-96 Wave 2B (C)] 清理 64 个无后端端点且 0 页面引用的方法 (grep 确认):
//   PACS 13 (by-modality/by-laterality/series/instances/wado/annotations/montage/key-images)
//   RIS 10 (appointments CRUD/checkin 派生/complete/cancel/surgeries detail/referrals create/schedules/workflow-status)
//   EMR 6 (createEmr/ophthalmic-exams/preop/anes/convert-vision)
//   AI 11 (models detail/toggle/register/compare/inference override/feedback/train/audit/heatmap detail+create)
//   报告 20 (reports detail/update/sign/export/trigger-critical/cosign/history/drafts detail+delete/templates detail+create/ai 4/prompts/asr/nlp/voice/print-records)
//   journey 4 (getJourney/getEducation/getInsurance/getJourneyNotifications, 无后端无 MSW)
//   保留方法均为后端 eye.controller / eye-subspecialty / eye-edu 已实现端点。
import { api } from "./client";

const EYE_API = "/eye";

export interface EyeStudy {
  id: string;
  patientId: string;
  patientName: string;
  modality:
    "OCT" | "Fundus" | "FA" | "ICG" | "SlitLamp" | "VisualField" | "Biometry";
  eye: "OD" | "OS" | "OU";
  acquisitionDate: string;
  deviceModel: string;
  status: "acquired" | "reviewed" | "reported" | "archived";
  indications?: string;
}

export interface EyeAiDiagnosis {
  id: string;
  studyId: string;
  modelName: string;
  diagnosis: string;
  confidence: number;
  severity: "mild" | "moderate" | "severe";
  timestamp: string;
  confirmed: boolean;
}

export interface IolConstant {
  model: string;
  aConst: number;
  pACD: number;
  surgeonFactor: number;
  haigisA: number;
  haigisB: number;
}

export interface IolCalculationResult {
  formula:
    | "SRK-T"
    | "BarrettUniversalII"
    | "Holladay2"
    | "HofferQ"
    | "HillRBF"
    | "Kane";
  targetRefraction: number;
  predictedPower: number;
  predictedRefraction: number;
  astigmatism: number;
  axis: number;
}

export interface SubspecialtyExam {
  id: string;
  subspecialty:
    | "strabismus"
    | "neuro"
    | "oncology"
    | "cornea"
    | "cataract"
    | "refractive"
    | "contact-lens"
    | "low-vision";
  patientId: string;
  diagnosis: string;
  examDate: string;
  findings: Record<string, any>;
}

function buildQuery(
  params?: Record<string, string | number | boolean | undefined>,
): string {
  if (!params) return "";
  const filtered = Object.entries(params).filter(
    ([_, v]) => v !== undefined && v !== "",
  );
  if (filtered.length === 0) return "";
  return "?" + new URLSearchParams(filtered as [string, string][]).toString();
}

export const eyeApi = {
  // ===== Studies / PACS =====
  // [G005 W3-A] 路径对齐: /eye/pacs/studies -> /eye/studies (后端 @Get('studies'))
  getStudies: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/studies${buildQuery(params)}`),
  getStudy: (id: string) => api.get(`${EYE_API}/studies/${id}`),
  // [v3.0.6.11-88 P0] eye studies CRUD (后端 eye.controller: POST /eye/studies, PUT/DELETE /eye/studies/:id,
  //   GET /eye/patients/:patientId/studies) — 替换原指向不存在的 /eye/pacs/studies/by-patient/*
  createStudy: (data: any) => api.post(`${EYE_API}/studies`, data),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  updateStudy: (id: string, data: any) => api.put(`${EYE_API}/studies/${encodeURIComponent(id)}`, data),
  deleteStudy: (id: string) => api.delete(`${EYE_API}/studies/${encodeURIComponent(id)}`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getStudiesByPatient: (patientId: string) =>
    api.get(`${EYE_API}/patients/${encodeURIComponent(patientId)}/studies`),
  // [G005 W1-A] 危急值 (FfaViewerPage 在用) / 视野检查 (VisualFieldPage 在用)
  getCriticalValues: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/critical-values${buildQuery(params)}`),
  getVisualFields: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/visual-fields${buildQuery(params)}`),
  getComparison: (studyIds: string[]) =>
    api.post(`${EYE_API}/pacs/compare`, { studyIds }),
  getMeasurements: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/measurements${buildQuery(params)}`),

  // ===== RIS =====
  getAppointments: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/appointments${buildQuery(params)}`),
  getTodayAppointments: () => api.get(`${EYE_API}/ris/appointments/today`),
  checkinAppointment: (id: string) =>
    api.post(`${EYE_API}/ris/appointments/${id}/checkin`),
  startAppointment: (id: string) =>
    api.post(`${EYE_API}/ris/appointments/${id}/start`),
  getFollowups: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/follow-ups${buildQuery(params)}`),
  getSurgeries: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/surgeries${buildQuery(params)}`),
  scheduleSurgery: (data: any) => api.post(`${EYE_API}/ris/surgeries`, data),
  deleteSurgery: (id: string) => api.delete(`${EYE_API}/ris/surgeries/${id}`),
  getReferrals: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/referrals${buildQuery(params)}`),
  acceptReferral: (id: string) =>
    api.post(`${EYE_API}/ris/referrals/${id}/accept`),

  // ===== RIS 检查记录 (视力 / 眼压) =====
  // [W3-2] VisionExamPage / IntraocularPressurePage 真实化
  listVisionRecords: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/vision-records${buildQuery(params)}`),
  createVisionRecord: (data: any) =>
    api.post(`${EYE_API}/ris/vision-records`, data),
  // [W3-C] 视力记录删除端点 (与 deleteIopRecord 对齐)
  deleteVisionRecord: (id: string) =>
    api.delete(`${EYE_API}/ris/vision-records/${id}`),
  listIopRecords: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/iop-records${buildQuery(params)}`),
  createIopRecord: (data: any) =>
    api.post(`${EYE_API}/ris/iop-records`, data),
  deleteIopRecord: (id: string) =>
    api.delete(`${EYE_API}/ris/iop-records/${id}`),
  // 兼容旧页面调用的别名
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getIopRecords: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/iop-records${buildQuery(params)}`),

  // ===== EMR =====
  // [G005 W3-A] 路径对齐: /eye/emr/records* -> /eye/emr/:patientId (后端 @Get/@Put('emr/:patientId'))
  //   无 patientId 时回退 /eye/emr/records (后端 @Get('emr/records') 列表, EyeEmrPage 在用)
  getEmr: (params?: Record<string, any>) =>
    params?.patientId
      ? api.get(`${EYE_API}/emr/${encodeURIComponent(String(params.patientId))}`)
      : api.get(`${EYE_API}/emr/records${buildQuery(params)}`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getEmrById: (id: string) => api.get(`${EYE_API}/emr/${encodeURIComponent(id)}`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getEmrByPatient: (patientId: string) =>
    api.get(`${EYE_API}/emr/${encodeURIComponent(patientId)}`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  updateEmr: (id: string, data: any) =>
    api.put(`${EYE_API}/emr/${encodeURIComponent(id)}`, data),

  // ===== AI =====
  listModels: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ai/models${buildQuery(params)}`),
  // Note: legacy POST /eye/ai/inference has no equivalent handler. Use POST /eye/ai/inferences below.
  runInference: (data: {
    studyId: string;
    modelId: string;
    [k: string]: any;
  }) => api.post(`${EYE_API}/ai/inferences`, data),
  listInferences: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ai/inferences${buildQuery(params)}`),
  listPendingInferences: () => api.get(`${EYE_API}/ai/inferences/pending`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getInference: (id: string) => api.get(`${EYE_API}/ai/inferences/${id}`),
  getDiagnoses: (id: string) => api.get(`${EYE_API}/ai/inferences/${id}`),
  getHeatmaps: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ai/heatmaps${buildQuery(params)}`),
  getRocCurve: (modelId: string) => api.get(`${EYE_API}/ai/roc/${modelId}`),
  getDiseaseDistribution: () =>
    api.get(`${EYE_API}/ai/stats/disease-distribution`),

  // ===== IOL Calculator =====
  // [G005 W3-A] 路径对齐: iol/constant/* -> /eye/iol/lenses; iol/calculate -> /eye/iol/calculate/barrett|kane
  //   (后端 @Get('iol/lenses') / @Post('iol/calculate/barrett|kane'); 旧 iol/constant、泛化 calculate 后端无对应)
  getIolConstants: (_model: string) =>
    api.get(`${EYE_API}/iol/lenses`),
  calculateIol: (data: {
    model: string;
    formula: string;
    axialLength: number;
    k1: number;
    k2: number;
    acd?: number;
    targetRefraction?: number;
  }) => {
    const body = {
      lensId: data.model,
      axialLength: data.axialLength,
      keratometry: (data.k1 + data.k2) / 2,
      acd: data.acd,
      // [G005 Wave1B] 别名字段: MSW eyeHandlers 计算端点读取 AL/K1/K2, 后端 Zod 校验允许多余字段
      AL: data.axialLength,
      K1: data.k1,
      K2: data.k2,
    }
    return String(data.formula).toLowerCase().includes('kane')
      ? api.post(`${EYE_API}/iol/calculate/kane`, body)
      : api.post(`${EYE_API}/iol/calculate/barrett`, body)
  },
  // [v3.0.6.11-88 P0] IOL 计算记录 (IolCalculatorPage 提交到病历; 后端 POST /eye/iol/calculations 内存+seed)
  saveIolCalculation: (data: Record<string, any>) =>
    api.post(`${EYE_API}/iol/calculations`, data),
  listIolCalculations: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/iol/calculations${buildQuery(params)}`),
  // ===== IOL 库存 (后端 eye.controller: /eye/iol/inventory*) =====
  // [G005 Wave1A P0] 低库存 / 即将过期 / 出库 / 调拨 / 调整 (MaterialsPage 在用)
  getIolInventory: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/iol/inventory${buildQuery(params)}`),
  getIolInventoryById: (id: string) =>
    api.get(`${EYE_API}/iol/inventory/${encodeURIComponent(id)}`),
  getIolLowStock: (threshold?: number) =>
    api.get(`${EYE_API}/iol/inventory/low-stock${threshold ? `?threshold=${threshold}` : ''}`),
  getIolExpiring: (days = 90) =>
    api.get(`${EYE_API}/iol/inventory/expiring?days=${days}`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  iolOutStock: (id: string, data: { reason: string; patientId?: string; surgeon?: string }) =>
    api.post(`${EYE_API}/iol/inventory/${encodeURIComponent(id)}/out`, data),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  iolTransfer: (id: string, data: { fromLocation: string; toLocation: string }) =>
    api.post(`${EYE_API}/iol/inventory/${encodeURIComponent(id)}/transfer`, data),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  iolAdjust: (id: string, data: { deltaQty: number; reason: string }) =>
    api.post(`${EYE_API}/iol/inventory/${encodeURIComponent(id)}/adjust`, data),

  // ===== Reports (handler 路径前缀是 /report/ 单数) =====
  // [G005 W3-A] 路径对齐: getReports /eye/report/reports -> /eye/reports (后端 @Get('reports'))
  getReports: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/reports${buildQuery(params)}`),
  // [v3.0.6.11-88 P0] createReport 路径错位修复: 原 /eye/report/reports (仅 MSW 有)
  //   → 后端真实 POST /eye/reports (eye.controller generateReport, GenerateReportSchema: { studyId, template? })
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  createReport: (data: { studyId: string; template?: string }) =>
    api.post(`${EYE_API}/reports`, data),
  submitReport: (id: string) =>
    api.post(`${EYE_API}/report/reports/${id}/submit`),
  getDrafts: () => api.get(`${EYE_API}/report/drafts`),
  createDraft: (data: any) => api.post(`${EYE_API}/report/drafts`, data),
  getTemplates: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/report/templates${buildQuery(params)}`),

  // ===== Subspecialty =====
  // [v3.0.6.11-103 Wave 3A] 亚专科检查记录 CRUD (SubspecialtyExamsPage 检查记录 UI 在用)
  getSubspecialtyRecords: (sub: string, params?: Record<string, any>) =>
    api.get(`${EYE_API}/subspecialty/${sub}/records${buildQuery(params)}`),
  createSubspecialtyRecord: (sub: string, data: any) =>
    api.post(`${EYE_API}/subspecialty/${sub}/records`, data),
  // [G005 Wave1A P0] 亚专科检查动作 (SubspecialtyExamsPage 真实化, 后端 eye-subspecialty 模块)
  strabismusSynoptophore: (data: any) =>
    api.post(`${EYE_API}/subspecialty/strabismus/synoptophore`, data),
  neuroColorVision: (data: any) =>
    api.post(`${EYE_API}/subspecialty/neuro/color-vision`, data),
  neuroPvep: (data: any) =>
    api.post(`${EYE_API}/subspecialty/neuro/pvep`, data),
  oncologyExophthalmometry: (data: any) =>
    api.post(`${EYE_API}/subspecialty/oncology/exophthalmometry`, data),
  corneaPentacam: (data: any) =>
    api.post(`${EYE_API}/subspecialty/cornea/pentacam`, data),
  cataractLensOpacity: (data: any) =>
    api.post(`${EYE_API}/subspecialty/cataract/lens-opacity`, data),
  // 屈光手术处方 (GET=最近记录 / POST=开具)
  // [v3.0.6.11-103 Wave 3A] RefractivePage 加载最近处方 UI 在用
  getRefractivePrescription: () =>
    api.get(`${EYE_API}/subspecialty/refractive/prescription`),
  refractivePrescription: (data: any) =>
    api.post(`${EYE_API}/subspecialty/refractive/prescription`, data),
  // 低视力助视器处方 (GET=最近记录 / POST=开具)
  // [v3.0.6.11-103 Wave 3A] LowVisionPage 加载最近处方 UI 在用
  getLowVisionPrescription: () =>
    api.get(`${EYE_API}/low-vision/prescription`),

  // ===== Edu 教学病例库 (CaseLibraryPage, 后端 eye-edu 模块) =====
  // [G005 Wave1A P0] /eye/edu/* MSW-only → 真实后端 (Report 派生 + seed + 内存标注)
  getEduCases: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/edu/cases${buildQuery(params)}`),
  getEduCase: (id: string) =>
    api.get(`${EYE_API}/edu/cases/${encodeURIComponent(id)}`),
  createEduCase: (data: any) =>
    api.post(`${EYE_API}/edu/cases`, data),
  annotateEduCase: (caseId: string, data: any) =>
    api.post(`${EYE_API}/edu/cases/${encodeURIComponent(caseId)}/annotate`, data),
  listEduAnnotationProjects: () =>
    api.get(`${EYE_API}/edu/annotation-projects`),
  // [v3.0.6.11-103 Wave 3A] 创建标注项目 (CaseLibraryPage 标注项目 tab 在用)
  createEduAnnotationProject: (data: any) =>
    api.post(`${EYE_API}/edu/annotation-projects`, data),
  eduCohort: (data: any) =>
    api.post(`${EYE_API}/edu/cohort`, data),
  eduDeidentify: (data: any) =>
    api.post(`${EYE_API}/edu/deidentify`, data),
  eduExportSr: (data: any) =>
    api.post(`${EYE_API}/edu/export-sr`, data),
  eduStats: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/edu/stats${buildQuery(params)}`),

  // ===== Contact Lens (实际 handler 路径) =====
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getContactLensInventory: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/contact-lens/inventory${buildQuery(params)}`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getContactLens: (id: string) =>
    api.get(`${EYE_API}/contact-lens/inventory/${encodeURIComponent(id)}`),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  createContactLens: (data: any) =>
    api.post(`${EYE_API}/contact-lens/inventory`, data),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  updateContactLens: (id: string, data: any) =>
    api.put(`${EYE_API}/contact-lens/inventory/${encodeURIComponent(id)}`, data),
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  deleteContactLens: (id: string) =>
    api.delete(`${EYE_API}/contact-lens/inventory/${encodeURIComponent(id)}`),
  contactLensFitting: (data: any) =>
    api.post(`${EYE_API}/contact-lens/fitting`, data),

  // [G005 Wave1A P0] OK 镜设计 (后端 POST /eye/optometry/ok-lens/design)
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  okLensDesign: (data: any) =>
    api.post(`${EYE_API}/optometry/ok-lens/design`, data),

  // ===== [G005 Wave1B] IOL Toric 散光规划 (ToricPlannerPage 真实化, 后端 /eye/iol/*) =====
  getIolConstant: (model: string) =>
    api.get<any>(`${EYE_API}/iol/constant/${encodeURIComponent(model)}`),
  calculateIolFormula: (formula: string, data: Record<string, any>) =>
    api.post<any>(`${EYE_API}/iol/calculate/${encodeURIComponent(formula)}`, data),
  planToricIol: (data: any) => api.post<any>(`${EYE_API}/iol/toric/plan`, data),
  getToricCandidates: (params: { cornealAst: number; sia: number }) =>
    api.get<any>(`${EYE_API}/iol/toric/candidate?cornealAst=${params.cornealAst}&sia=${params.sia}`),
  predictPostopIol: (data: any) =>
    api.post<any>(`${EYE_API}/iol/predict/postop`, data),

  // ===== [G005 Wave1B] 远程眼科 tele (TeleConsultPage, MSW eyeTeleModule 对齐) =====
  // [G005 Wave10A] /eye/tele/* 后端真实 (eye-tele 桥接 tele 模块): session CRUD + turn/stream/consult/stats
  getTeleTurn: () => api.get<any>(`${EYE_API}/tele/turn`),
  createTeleSession: (data: any) => api.post<any>(`${EYE_API}/tele/session`, data),
  createTeleStream: (data: any) => api.post<any>(`${EYE_API}/tele/stream`, data),
  createTeleConsult: (data: any) => api.post<any>(`${EYE_API}/tele/consult`, data),
  listTeleSessions: (params?: Record<string, any>) =>
    api.get<any>(`${EYE_API}/tele/sessions${buildQuery(params)}`),
  // [v3.0.6.11-103 Wave 3A] 会话详情/结束 (TeleConsultPage 远程阅片 tab)
  getTeleSession: (sessionId: string) =>
    api.get<any>(`${EYE_API}/tele/session/${encodeURIComponent(sessionId)}`),
  endTeleSession: (sessionId: string) =>
    api.delete<any>(`${EYE_API}/tele/session/${encodeURIComponent(sessionId)}`),
  // [v3.0.6.11-103 Wave 3A] 流状态列表 (TeleConsultPage 远程阅片 tab)
  listTeleStreams: (params?: Record<string, any>) =>
    api.get<any>(`${EYE_API}/tele/streams${buildQuery(params)}`),
  listTeleConsults: (params?: Record<string, any>) =>
    api.get<any>(`${EYE_API}/tele/consults${buildQuery(params)}`),
  // [v3.0.6.11-103 Wave 3A] 会诊详情/答复 (TeleConsultPage 远程阅片 tab)
  getTeleConsult: (consultId: string) =>
    api.get<any>(`${EYE_API}/tele/consult/${encodeURIComponent(consultId)}`),
  answerTeleConsult: (consultId: string, data: any) =>
    api.post<any>(`${EYE_API}/tele/consult/${encodeURIComponent(consultId)}/answer`, data),
  getTeleStats: () => api.get<any>(`${EYE_API}/tele/stats`),

  // ===== [G005 Wave1B] 像素级图像处理 pixel (RealDicomViewerPage, MSW eyePixelModule 对齐) =====
  getPixelInstance: (instanceId: string) =>
    api.get<any>(`${EYE_API}/pixel/instance/${encodeURIComponent(instanceId)}`),
  // [v3.0.6.11-103 Wave 3A] 可选 frame 查询参数 (后端 GET /eye/pixel/histogram/:instanceId?frame=)
  getPixelHistogram: (instanceId: string, frame?: number) =>
    api.get<any>(`${EYE_API}/pixel/histogram/${encodeURIComponent(instanceId)}${frame ? `?frame=${frame}` : ""}`),
  getPixelColormap: (modality: string) =>
    api.get<any>(`${EYE_API}/pixel/colormap/${encodeURIComponent(modality)}`),
  // [G005 Wave 4B] 全部 colormap 目录 (EyePixelPage, 后端 GET /eye/pixel/colormaps)
  listPixelColormaps: () => api.get<any>(`${EYE_API}/pixel/colormaps`),
  analyzePixelSharpness: (data: any) => api.post<any>(`${EYE_API}/pixel/sharpness`, data),
  reconstructPixelMpr: (data: any) => api.post<any>(`${EYE_API}/pixel/mpr`, data),
  detectPixelArtifact: (data: any) => api.post<any>(`${EYE_API}/pixel/detect-artifact`, data),

  // ===== [G005 Wave1B] PACS 测量 (RealDicomViewerPage, MSW eyeHandlers 对齐) =====
  // [v3.0.6.11-104 Wave 1A] 路径对齐后端: /eye/pacs/measurement (单数) → /eye/pacs/measurements (复数)
  //   后端 eye.controller.ts 仅 @Get('pacs/measurements') (见 getMeasurements); 单数路径不存在 (404)。
  // MOCK-ONLY: 后端未实现以下测量写端点 (eye.controller 无 POST/DELETE/export-sr), 目前仅 MSW eyeHandlers 兜底。
  savePacsMeasurement: (data: any) => api.post<any>(`${EYE_API}/pacs/measurements`, data),
  // MOCK-ONLY: 后端未实现
  deletePacsMeasurement: (id: string) =>
    api.delete<any>(`${EYE_API}/pacs/measurements/${encodeURIComponent(id)}`),
  // MOCK-ONLY: 后端未实现
  exportPacsMeasurementSr: (data: any) =>
    api.post<any>(`${EYE_API}/pacs/measurements/export-sr`, data),

  // ===== Optometry 视光中心闭环 (后端 /eye/optometry/*, MSW 仅 dev 兜底) =====
  // [G005 Wave1A 17] OptometryClosedLoopPage / TeleConsultPage 裸 fetch → eyeApi 封装
  getOptometryStats: () => api.get(`${EYE_API}/optometry/stats`),
  optometryScreening: (data: any) =>
    api.post(`${EYE_API}/optometry/screening`, data),
  getRefractionCurve: (patientId: string) =>
    api.get(`${EYE_API}/optometry/refraction-curve/${encodeURIComponent(patientId)}`),
  okTrial: (data: any) => api.post(`${EYE_API}/optometry/ok-trial`, data),
  orthoKOrder: (data: any) =>
    api.post(`${EYE_API}/optometry/ortho-k-order`, data),
  defocusOrder: (data: any) =>
    api.post(`${EYE_API}/optometry/defocus-order`, data),
  // 屈光检查记录 (与 vision-records 兼容)
  // [v3.0.6.11-103 Wave 3A] 验光档案 UI 在用 (OptometryClosedLoopPage)
  listRefractionRecords: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/optometry/refraction${buildQuery(params)}`),
  createRefractionRecord: (data: any) =>
    api.post(`${EYE_API}/optometry/refraction`, data),
  // OK 镜档案
  // [v3.0.6.11-103 Wave 3A] 验光档案 UI 在用 (OptometryClosedLoopPage)
  listOkLens: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/optometry/ok-lens${buildQuery(params)}`),
  createOkLens: (data: any) => api.post(`${EYE_API}/optometry/ok-lens`, data),
  // 视力记录序列
  getOptometryVisionRecord: (patientId: string) =>
    api.get(`${EYE_API}/optometry/vision-record/${encodeURIComponent(patientId)}`),
  // [v3.0.6.11-103 Wave 3A] 视光订单详情 (后端 GET /eye/optometry/orders/:id)
  getOptometryOrder: (id: string) =>
    api.get(`${EYE_API}/optometry/orders/${encodeURIComponent(id)}`),
  // 低视力助视器处方 POST (原有, 保留兼容); GET 见 Subspecialty 区块
  lowVisionPrescription: (data: any) =>
    api.post(`${EYE_API}/low-vision/prescription`, data),

  // ===== KPI 看板 (EyeKpiDashboardPage, /eye/kpi/*) =====
  getKpiSummary: () => api.get(`${EYE_API}/kpi/summary`),
  getQualityMetrics: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/kpi/quality-metrics${buildQuery(params)}`),
  getPatientSatisfaction: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/kpi/satisfaction${buildQuery(params)}`),
};

export default eyeApi;

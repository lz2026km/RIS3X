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
  updateStudy: (id: string, data: any) => api.put(`${EYE_API}/studies/${encodeURIComponent(id)}`, data),
  deleteStudy: (id: string) => api.delete(`${EYE_API}/studies/${encodeURIComponent(id)}`),
  getStudiesByPatient: (patientId: string) =>
    api.get(`${EYE_API}/patients/${encodeURIComponent(patientId)}/studies`),
  // [G005 W1-A] 危急值 (FfaViewerPage 在用) / 视野检查 (VisualFieldPage 在用)
  getCriticalValues: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/critical-values${buildQuery(params)}`),
  getVisualFields: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/visual-fields${buildQuery(params)}`),
  getStudiesByModality: (modality: string) =>
    api.get(`${EYE_API}/pacs/studies/by-modality/${modality}`),
  getStudiesByLaterality: (side: "OD" | "OS" | "OU") =>
    api.get(`${EYE_API}/pacs/studies/by-laterality/${side}`),
  getSeries: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/series${buildQuery(params)}`),
  getSeriesById: (id: string) => api.get(`${EYE_API}/pacs/series/${id}`),
  getInstance: (id: string) => api.get(`${EYE_API}/pacs/instances/${id}`),
  getDicomPaths: (studyId: string) =>
    api.get(`${EYE_API}/pacs/wado/${studyId}`),
  getAnnotations: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/annotations${buildQuery(params)}`),
  getAnnotationsByStudy: (studyId: string) =>
    api.get(
      `${EYE_API}/pacs/annotations?studyId=${encodeURIComponent(studyId)}`,
    ),
  createAnnotation: (data: any) =>
    api.post(`${EYE_API}/pacs/annotations`, data),
  deleteAnnotation: (id: string) =>
    api.delete(`${EYE_API}/pacs/annotations/${id}`),
  getMosaic: (studyIds: string[]) =>
    api.post(`${EYE_API}/pacs/montage`, { studyIds }),
  getComparison: (studyIds: string[]) =>
    api.post(`${EYE_API}/pacs/compare`, { studyIds }),
  getKeyImages: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/key-images${buildQuery(params)}`),
  getKeyImagesByStudy: (studyId: string) =>
    api.get(
      `${EYE_API}/pacs/key-images?studyId=${encodeURIComponent(studyId)}`,
    ),
  getMeasurements: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/pacs/measurements${buildQuery(params)}`),

  // ===== RIS =====
  getAppointments: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/appointments${buildQuery(params)}`),
  getAppointment: (id: string) => api.get(`${EYE_API}/ris/appointments/${id}`),
  getTodayAppointments: () => api.get(`${EYE_API}/ris/appointments/today`),
  createAppointment: (data: any) =>
    api.post(`${EYE_API}/ris/appointments`, data),
  updateAppointment: (id: string, data: any) =>
    api.put(`${EYE_API}/ris/appointments/${id}`, data),
  cancelAppointment: (id: string) =>
    api.delete(`${EYE_API}/ris/appointments/${id}`),
  checkinAppointment: (id: string) =>
    api.post(`${EYE_API}/ris/appointments/${id}/checkin`),
  startAppointment: (id: string) =>
    api.post(`${EYE_API}/ris/appointments/${id}/start`),
  completeAppointment: (id: string) =>
    api.post(`${EYE_API}/ris/appointments/${id}/complete`),
  cancelAppointmentRequest: (id: string) =>
    api.post(`${EYE_API}/ris/appointments/${id}/cancel`),
  getFollowups: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/follow-ups${buildQuery(params)}`),
  getSurgeries: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/surgeries${buildQuery(params)}`),
  getSurgery: (id: string) => api.get(`${EYE_API}/ris/surgeries/${id}`),
  scheduleSurgery: (data: any) => api.post(`${EYE_API}/ris/surgeries`, data),
  deleteSurgery: (id: string) => api.delete(`${EYE_API}/ris/surgeries/${id}`),
  getReferrals: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/referrals${buildQuery(params)}`),
  createReferral: (data: any) => api.post(`${EYE_API}/ris/referrals`, data),
  acceptReferral: (id: string) =>
    api.post(`${EYE_API}/ris/referrals/${id}/accept`),
  getSchedules: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/schedules${buildQuery(params)}`),
  getWorkflowStatus: () => api.get(`${EYE_API}/ris/workflow-status`),

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
  getIopRecords: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ris/iop-records${buildQuery(params)}`),

  // ===== EMR =====
  // [G005 W3-A] 路径对齐: /eye/emr/records* -> /eye/emr/:patientId (后端 @Get/@Put('emr/:patientId'))
  //   无 patientId 时回退 /eye/emr/records (后端 @Get('emr/records') 列表, EyeEmrPage 在用)
  getEmr: (params?: Record<string, any>) =>
    params?.patientId
      ? api.get(`${EYE_API}/emr/${encodeURIComponent(String(params.patientId))}`)
      : api.get(`${EYE_API}/emr/records${buildQuery(params)}`),
  getEmrById: (id: string) => api.get(`${EYE_API}/emr/${encodeURIComponent(id)}`),
  getEmrByPatient: (patientId: string) =>
    api.get(`${EYE_API}/emr/${encodeURIComponent(patientId)}`),
  createEmr: (data: any) => api.post(`${EYE_API}/emr/records`, data),
  updateEmr: (id: string, data: any) =>
    api.put(`${EYE_API}/emr/${encodeURIComponent(id)}`, data),
  getOcularExam: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/emr/ophthalmic-exams${buildQuery(params)}`),
  getOcularExamByPatient: (patientId: string) =>
    api.get(`${EYE_API}/emr/ophthalmic-exams/by-patient/${patientId}`),
  getPreop: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/emr/preop-assessments${buildQuery(params)}`),
  getAnesthesia: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/emr/anes-assessments${buildQuery(params)}`),
  convertVision: (data: any) => api.post(`${EYE_API}/emr/convert-vision`, data),

  // ===== AI =====
  listModels: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ai/models${buildQuery(params)}`),
  getModel: (id: string) => api.get(`${EYE_API}/ai/models/${id}`),
  toggleModel: (id: string) => api.put(`${EYE_API}/ai/models/${id}/toggle`),
  registerModel: (data: any) => api.post(`${EYE_API}/ai/models`, data),
  // Note: legacy POST /eye/ai/inference has no equivalent handler. Use POST /eye/ai/inferences below.
  runInference: (data: {
    studyId: string;
    modelId: string;
    [k: string]: any;
  }) => api.post(`${EYE_API}/ai/inferences`, data),
  listInferences: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ai/inferences${buildQuery(params)}`),
  listPendingInferences: () => api.get(`${EYE_API}/ai/inferences/pending`),
  getInference: (id: string) => api.get(`${EYE_API}/ai/inferences/${id}`),
  getDiagnoses: (id: string) => api.get(`${EYE_API}/ai/inferences/${id}`),
  overrideInference: (id: string, data: any) =>
    api.post(`${EYE_API}/ai/inferences/${id}/override`, data),
  submitFeedback: (data: any) => api.post(`${EYE_API}/ai/feedback`, data),
  getAiFeedback: () => api.get(`${EYE_API}/ai/feedback`),
  trainModel: (data: any) => api.post(`${EYE_API}/ai/train`, data),
  getAiAudit: () => api.get(`${EYE_API}/ai/audit`),
  getHeatmaps: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/ai/heatmaps${buildQuery(params)}`),
  getHeatmap: (id: string) => api.get(`${EYE_API}/ai/heatmaps/${id}`),
  createHeatmap: (data: any) => api.post(`${EYE_API}/ai/heatmaps`, data),
  getRocCurve: (modelId: string) => api.get(`${EYE_API}/ai/roc/${modelId}`),
  getDiseaseDistribution: () =>
    api.get(`${EYE_API}/ai/stats/disease-distribution`),
  compareModels: () => api.get(`${EYE_API}/ai/models/compare`),

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
  iolOutStock: (id: string, data: { reason: string; patientId?: string; surgeon?: string }) =>
    api.post(`${EYE_API}/iol/inventory/${encodeURIComponent(id)}/out`, data),
  iolTransfer: (id: string, data: { fromLocation: string; toLocation: string }) =>
    api.post(`${EYE_API}/iol/inventory/${encodeURIComponent(id)}/transfer`, data),
  iolAdjust: (id: string, data: { deltaQty: number; reason: string }) =>
    api.post(`${EYE_API}/iol/inventory/${encodeURIComponent(id)}/adjust`, data),

  // ===== Reports (handler 路径前缀是 /report/ 单数) =====
  // [G005 W3-A] 路径对齐: getReports /eye/report/reports -> /eye/reports (后端 @Get('reports'))
  getReports: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/reports${buildQuery(params)}`),
  getReport: (id: string) => api.get(`${EYE_API}/report/reports/${id}`),
  // [v3.0.6.11-88 P0] createReport 路径错位修复: 原 /eye/report/reports (仅 MSW 有)
  //   → 后端真实 POST /eye/reports (eye.controller generateReport, GenerateReportSchema: { studyId, template? })
  createReport: (data: { studyId: string; template?: string }) =>
    api.post(`${EYE_API}/reports`, data),
  updateReport: (id: string, data: any) =>
    api.put(`${EYE_API}/report/reports/${id}`, data),
  submitReport: (id: string) =>
    api.post(`${EYE_API}/report/reports/${id}/submit`),
  signReport: (id: string, signature: string) =>
    api.post(`${EYE_API}/report/reports/${id}/sign`, { signature }),
  printReport: (id: string) =>
    api.post(`${EYE_API}/report/reports/${id}/export`),
  triggerCriticalReport: (id: string, data: any) =>
    api.post(`${EYE_API}/report/reports/${id}/trigger-critical`, data),
  cosignReport: (id: string, data: any) =>
    api.post(`${EYE_API}/report/reports/${id}/cosign`, data),
  getReportHistory: (patientId: string) =>
    api.get(`${EYE_API}/report/reports/history/${patientId}`),
  getDrafts: () => api.get(`${EYE_API}/report/drafts`),
  createDraft: (data: any) => api.post(`${EYE_API}/report/drafts`, data),
  getDraft: (id: string) => api.get(`${EYE_API}/report/drafts/${id}`),
  deleteDraft: (id: string) => api.delete(`${EYE_API}/report/drafts/${id}`),
  getTemplates: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/report/templates${buildQuery(params)}`),
  getTemplate: (id: string) => api.get(`${EYE_API}/report/templates/${id}`),
  createTemplate: (data: any) => api.post(`${EYE_API}/report/templates`, data),
  aiAssistReport: (data: {
    studyId: string;
    prompt: string;
    [k: string]: any;
  }) => api.post(`${EYE_API}/report/ai/continue`, data),
  aiRewriteReport: (data: any) =>
    api.post(`${EYE_API}/report/ai/rewrite`, data),
  aiReportHistory: () => api.get(`${EYE_API}/report/ai/history`),
  aiReportFeedback: (data: any) =>
    api.post(`${EYE_API}/report/ai/feedback`, data),
  getPrompts: (condition: string) =>
    api.get(`${EYE_API}/report/prompts/${condition}`),
  asrFeedback: (data: any) => api.post(`${EYE_API}/report/asr/feedback`, data),
  nlpExtract: (data: any) => api.post(`${EYE_API}/report/nlp/extract`, data),
  voiceTranscribe: (data: any) =>
    api.post(`${EYE_API}/report/voice/transcribe`, data),
  getPrintRecords: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/report/print-records${buildQuery(params)}`),

  // ===== Subspecialty =====
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
  getRefractivePrescription: () =>
    api.get(`${EYE_API}/subspecialty/refractive/prescription`),
  refractivePrescription: (data: any) =>
    api.post(`${EYE_API}/subspecialty/refractive/prescription`, data),
  // 低视力助视器处方 (GET=最近记录 / POST=开具)
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

  // ===== Patient Journey =====
  getJourney: (patientId: string) => api.get(`${EYE_API}/journey/${patientId}`),
  getEducation: (patientId: string) =>
    api.get(`${EYE_API}/journey/${patientId}/education`),
  getInsurance: (patientId: string) =>
    api.get(`${EYE_API}/journey/${patientId}/insurance`),
  getJourneyNotifications: (patientId: string) =>
    api.get(`${EYE_API}/journey/${patientId}/notifications`),

  // ===== Contact Lens (实际 handler 路径) =====
  getContactLensInventory: (params?: Record<string, any>) =>
    api.get(`${EYE_API}/contact-lens/inventory${buildQuery(params)}`),
  getContactLens: (id: string) =>
    api.get(`${EYE_API}/contact-lens/inventory/${encodeURIComponent(id)}`),
  createContactLens: (data: any) =>
    api.post(`${EYE_API}/contact-lens/inventory`, data),
  updateContactLens: (id: string, data: any) =>
    api.put(`${EYE_API}/contact-lens/inventory/${encodeURIComponent(id)}`, data),
  deleteContactLens: (id: string) =>
    api.delete(`${EYE_API}/contact-lens/inventory/${encodeURIComponent(id)}`),
  contactLensFitting: (data: any) =>
    api.post(`${EYE_API}/contact-lens/fitting`, data),

  // [G005 Wave1A P0] OK 镜设计 (后端 POST /eye/optometry/ok-lens/design)
  okLensDesign: (data: any) =>
    api.post(`${EYE_API}/optometry/ok-lens/design`, data),
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

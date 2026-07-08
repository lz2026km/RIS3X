// [v3.0.6.8-83] 眼科 API client (统一封装)
// 对标: Topcon Synergy + Medisoft mediSIGHT + Zeiss FORUM + Heidelberg Eye Suite
// v3.0.6.11: 路径已对齐 mockBackend/eyeHandlers.ts (pacs / emr / ai / report)
import { api } from './client';

const EYE_API = '/api/v1/eye';

export interface EyeStudy {
  id: string;
  patientId: string;
  patientName: string;
  modality: 'OCT' | 'Fundus' | 'FA' | 'ICG' | 'SlitLamp' | 'VisualField' | 'Biometry';
  eye: 'OD' | 'OS' | 'OU';
  acquisitionDate: string;
  deviceModel: string;
  status: 'acquired' | 'reviewed' | 'reported' | 'archived';
  indications?: string;
}

export interface EyeAiDiagnosis {
  id: string;
  studyId: string;
  modelName: string;
  diagnosis: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe';
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
  formula: 'SRK-T' | 'BarrettUniversalII' | 'Holladay2' | 'HofferQ' | 'HillRBF' | 'Kane';
  targetRefraction: number;
  predictedPower: number;
  predictedRefraction: number;
  astigmatism: number;
  axis: number;
}

export interface SubspecialtyExam {
  id: string;
  subspecialty: 'strabismus' | 'neuro' | 'oncology' | 'cornea' | 'cataract' | 'refractive' | 'contact-lens' | 'low-vision';
  patientId: string;
  diagnosis: string;
  examDate: string;
  findings: Record<string, any>;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return '';
  return '?' + new URLSearchParams(filtered as [string, string][]).toString();
}

export const eyeApi = {
  // ===== Studies / PACS =====
  getStudies: (params?: Record<string, any>) => api.get(`${EYE_API}/pacs/studies${buildQuery(params)}`),
  getStudy: (id: string) => api.get(`${EYE_API}/pacs/studies/${id}`),
  getStudiesByModality: (modality: string) => api.get(`${EYE_API}/pacs/studies/by-modality/${modality}`),
  getStudiesByLaterality: (side: 'OD' | 'OS' | 'OU') => api.get(`${EYE_API}/pacs/studies/by-laterality/${side}`),
  getStudiesByPatient: (patientId: string) => api.get(`${EYE_API}/pacs/studies/by-patient/${patientId}`),
  getSeries: (params?: Record<string, any>) => api.get(`${EYE_API}/pacs/series${buildQuery(params)}`),
  getSeriesById: (id: string) => api.get(`${EYE_API}/pacs/series/${id}`),
  getInstance: (id: string) => api.get(`${EYE_API}/pacs/instances/${id}`),
  getDicomPaths: (studyId: string) => api.get(`${EYE_API}/pacs/wado/${studyId}`),
  getAnnotations: (params?: Record<string, any>) => api.get(`${EYE_API}/pacs/annotations${buildQuery(params)}`),
  getAnnotationsByStudy: (studyId: string) => api.get(`${EYE_API}/pacs/annotations?studyId=${encodeURIComponent(studyId)}`),
  createAnnotation: (data: any) => api.post(`${EYE_API}/pacs/annotations`, data),
  deleteAnnotation: (id: string) => api.delete(`${EYE_API}/pacs/annotations/${id}`),
  getMosaic: (studyIds: string[]) => api.post(`${EYE_API}/pacs/montage`, { studyIds }),
  getComparison: (studyIds: string[]) => api.post(`${EYE_API}/pacs/compare`, { studyIds }),
  getKeyImages: (params?: Record<string, any>) => api.get(`${EYE_API}/pacs/key-images${buildQuery(params)}`),
  getKeyImagesByStudy: (studyId: string) => api.get(`${EYE_API}/pacs/key-images?studyId=${encodeURIComponent(studyId)}`),
  getMeasurements: (params?: Record<string, any>) => api.get(`${EYE_API}/pacs/measurements${buildQuery(params)}`),

  // ===== RIS =====
  getAppointments: (params?: Record<string, any>) => api.get(`${EYE_API}/ris/appointments${buildQuery(params)}`),
  getAppointment: (id: string) => api.get(`${EYE_API}/ris/appointments/${id}`),
  getTodayAppointments: () => api.get(`${EYE_API}/ris/appointments/today`),
  createAppointment: (data: any) => api.post(`${EYE_API}/ris/appointments`, data),
  updateAppointment: (id: string, data: any) => api.put(`${EYE_API}/ris/appointments/${id}`, data),
  cancelAppointment: (id: string) => api.delete(`${EYE_API}/ris/appointments/${id}`),
  checkinAppointment: (id: string) => api.post(`${EYE_API}/ris/appointments/${id}/checkin`),
  startAppointment: (id: string) => api.post(`${EYE_API}/ris/appointments/${id}/start`),
  completeAppointment: (id: string) => api.post(`${EYE_API}/ris/appointments/${id}/complete`),
  cancelAppointmentRequest: (id: string) => api.post(`${EYE_API}/ris/appointments/${id}/cancel`),
  getFollowups: (params?: Record<string, any>) => api.get(`${EYE_API}/ris/follow-ups${buildQuery(params)}`),
  getSurgeries: (params?: Record<string, any>) => api.get(`${EYE_API}/ris/surgeries${buildQuery(params)}`),
  getSurgery: (id: string) => api.get(`${EYE_API}/ris/surgeries/${id}`),
  scheduleSurgery: (data: any) => api.post(`${EYE_API}/ris/surgeries`, data),
  deleteSurgery: (id: string) => api.delete(`${EYE_API}/ris/surgeries/${id}`),
  getReferrals: (params?: Record<string, any>) => api.get(`${EYE_API}/ris/referrals${buildQuery(params)}`),
  createReferral: (data: any) => api.post(`${EYE_API}/ris/referrals`, data),
  acceptReferral: (id: string) => api.post(`${EYE_API}/ris/referrals/${id}/accept`),
  getSchedules: (params?: Record<string, any>) => api.get(`${EYE_API}/ris/schedules${buildQuery(params)}`),
  getWorkflowStatus: () => api.get(`${EYE_API}/ris/workflow-status`),

  // ===== EMR =====
  getEmr: (params?: Record<string, any>) => api.get(`${EYE_API}/emr/records${buildQuery(params)}`),
  getEmrById: (id: string) => api.get(`${EYE_API}/emr/records/${id}`),
  getEmrByPatient: (patientId: string) => api.get(`${EYE_API}/emr/records/by-patient/${patientId}`),
  createEmr: (data: any) => api.post(`${EYE_API}/emr/records`, data),
  updateEmr: (id: string, data: any) => api.put(`${EYE_API}/emr/records/${id}`, data),
  getOcularExam: (params?: Record<string, any>) => api.get(`${EYE_API}/emr/ophthalmic-exams${buildQuery(params)}`),
  getOcularExamByPatient: (patientId: string) => api.get(`${EYE_API}/emr/ophthalmic-exams/by-patient/${patientId}`),
  getPreop: (params?: Record<string, any>) => api.get(`${EYE_API}/emr/preop-assessments${buildQuery(params)}`),
  getAnesthesia: (params?: Record<string, any>) => api.get(`${EYE_API}/emr/anes-assessments${buildQuery(params)}`),
  convertVision: (data: any) => api.post(`${EYE_API}/emr/convert-vision`, data),

  // ===== AI =====
  listModels: (params?: Record<string, any>) => api.get(`${EYE_API}/ai/models${buildQuery(params)}`),
  getModel: (id: string) => api.get(`${EYE_API}/ai/models/${id}`),
  toggleModel: (id: string) => api.put(`${EYE_API}/ai/models/${id}/toggle`),
  registerModel: (data: any) => api.post(`${EYE_API}/ai/models`, data),
  // Note: legacy POST /eye/ai/inference has no equivalent handler. Use POST /eye/ai/inferences below.
  runInference: (data: { studyId: string; modelId: string; [k: string]: any }) => api.post(`${EYE_API}/ai/inferences`, data),
  listInferences: (params?: Record<string, any>) => api.get(`${EYE_API}/ai/inferences${buildQuery(params)}`),
  listPendingInferences: () => api.get(`${EYE_API}/ai/inferences/pending`),
  getInference: (id: string) => api.get(`${EYE_API}/ai/inferences/${id}`),
  getDiagnoses: (id: string) => api.get(`${EYE_API}/ai/inferences/${id}`),
  overrideInference: (id: string, data: any) => api.post(`${EYE_API}/ai/inferences/${id}/override`, data),
  submitFeedback: (data: any) => api.post(`${EYE_API}/ai/feedback`, data),
  getAiFeedback: () => api.get(`${EYE_API}/ai/feedback`),
  trainModel: (data: any) => api.post(`${EYE_API}/ai/train`, data),
  getAiAudit: () => api.get(`${EYE_API}/ai/audit`),
  getHeatmaps: (params?: Record<string, any>) => api.get(`${EYE_API}/ai/heatmaps${buildQuery(params)}`),
  getHeatmap: (id: string) => api.get(`${EYE_API}/ai/heatmaps/${id}`),
  createHeatmap: (data: any) => api.post(`${EYE_API}/ai/heatmaps`, data),
  getRocCurve: (modelId: string) => api.get(`${EYE_API}/ai/roc/${modelId}`),
  getDiseaseDistribution: () => api.get(`${EYE_API}/ai/stats/disease-distribution`),
  compareModels: () => api.get(`${EYE_API}/ai/models/compare`),

  // ===== IOL Calculator =====
  // Eyehandlers 没有 iol/constant/* 与 iol/calculate,保留旧调用并附 TODO
  getIolConstants: (model: string) => api.get(`${EYE_API}/iol/constant/${model}`),
  calculateIol: (data: {
    model: string;
    formula: string;
    axialLength: number;
    k1: number;
    k2: number;
    acd?: number;
    targetRefraction?: number;
  }) => api.post(`${EYE_API}/iol/calculate`, data),
  // 实际眼科 IOL 库存 (存在 handler /eye/iol/inventory)
  getIolInventory: () => api.get(`${EYE_API}/iol/inventory`),

  // ===== Reports (handler 路径前缀是 /report/ 单数) =====
  getReports: (params?: Record<string, any>) => api.get(`${EYE_API}/report/reports${buildQuery(params)}`),
  getReport: (id: string) => api.get(`${EYE_API}/report/reports/${id}`),
  createReport: (data: any) => api.post(`${EYE_API}/report/reports`, data),
  updateReport: (id: string, data: any) => api.put(`${EYE_API}/report/reports/${id}`, data),
  submitReport: (id: string) => api.post(`${EYE_API}/report/reports/${id}/submit`),
  signReport: (id: string, signature: string) => api.post(`${EYE_API}/report/reports/${id}/sign`, { signature }),
  printReport: (id: string) => api.post(`${EYE_API}/report/reports/${id}/export`),
  triggerCriticalReport: (id: string, data: any) => api.post(`${EYE_API}/report/reports/${id}/trigger-critical`, data),
  cosignReport: (id: string, data: any) => api.post(`${EYE_API}/report/reports/${id}/cosign`, data),
  getReportHistory: (patientId: string) => api.get(`${EYE_API}/report/reports/history/${patientId}`),
  getDrafts: () => api.get(`${EYE_API}/report/drafts`),
  createDraft: (data: any) => api.post(`${EYE_API}/report/drafts`, data),
  getDraft: (id: string) => api.get(`${EYE_API}/report/drafts/${id}`),
  deleteDraft: (id: string) => api.delete(`${EYE_API}/report/drafts/${id}`),
  getTemplates: (params?: Record<string, any>) => api.get(`${EYE_API}/report/templates${buildQuery(params)}`),
  getTemplate: (id: string) => api.get(`${EYE_API}/report/templates/${id}`),
  createTemplate: (data: any) => api.post(`${EYE_API}/report/templates`, data),
  aiAssistReport: (data: { studyId: string; prompt: string; [k: string]: any }) => api.post(`${EYE_API}/report/ai/continue`, data),
  aiRewriteReport: (data: any) => api.post(`${EYE_API}/report/ai/rewrite`, data),
  aiReportHistory: () => api.get(`${EYE_API}/report/ai/history`),
  aiReportFeedback: (data: any) => api.post(`${EYE_API}/report/ai/feedback`, data),
  getPrompts: (condition: string) => api.get(`${EYE_API}/report/prompts/${condition}`),
  asrFeedback: (data: any) => api.post(`${EYE_API}/report/asr/feedback`, data),
  nlpExtract: (data: any) => api.post(`${EYE_API}/report/nlp/extract`, data),
  voiceTranscribe: (data: any) => api.post(`${EYE_API}/report/voice/transcribe`, data),
  getPrintRecords: (params?: Record<string, any>) => api.get(`${EYE_API}/report/print-records${buildQuery(params)}`),

  // ===== Subspecialty =====
  getSubspecialtyRecords: (sub: string, params?: Record<string, any>) =>
    api.get(`${EYE_API}/subspecialty/${sub}/records${buildQuery(params)}`),
  getSubspecialtyRecord: (sub: string, id: string) =>
    api.get(`${EYE_API}/subspecialty/${sub}/records/${id}`),
  createSubspecialtyRecord: (sub: string, data: any) =>
    api.post(`${EYE_API}/subspecialty/${sub}/records`, data),

  // ===== Patient Journey =====
  getJourney: (patientId: string) => api.get(`${EYE_API}/journey/${patientId}`),
  getEducation: (patientId: string) => api.get(`${EYE_API}/journey/${patientId}/education`),
  getInsurance: (patientId: string) => api.get(`${EYE_API}/journey/${patientId}/insurance`),
  getJourneyNotifications: (patientId: string) => api.get(`${EYE_API}/journey/${patientId}/notifications`),

  // ===== Contact Lens (实际 handler 路径) =====
  getContactLensInventory: () => api.get(`${EYE_API}/contact-lens/inventory`),
  contactLensFitting: (data: any) => api.post(`${EYE_API}/contact-lens/fitting`, data),
  lowVisionPrescription: (data: any) => api.post(`${EYE_API}/low-vision/prescription`, data),
};

export default eyeApi;

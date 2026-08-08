// [v3.0.6.8-53] PR 口腔: 口腔 API client (Day 1: 24 个方法)
// 对标: 3Shape / Sirona / Planmeca / Carestream
import { api } from './client';

// 后端 NestJS 路由前缀: @Controller('dental') + globalPrefix 'api' = /api/dental
// API_BASE(client.ts) 已提供 /api/v1(mock) 或 http://host/api(real)
// 所以此处只需写 /dental
const DENTAL_API = '/dental';

export interface DentalStudy {
  id: string;
  patientId: string;
  patientName: string;
  modality: 'CBCT' | 'Panoramic' | 'Periapical' | 'Scan' | 'Bitewing';
  region: string;
  scanType?: 'Upper' | 'Lower' | 'Bite' | 'Pre-Ortho' | 'Implant';
  acquisitionDate: string;
  deviceModel: string;
  fieldOfView: string;
  voxelSize: number;
  radiationDose?: number;
  fileSize: number;
  imageCount: number;
  quality: 'Diagnostic' | 'Acceptable' | 'Suboptimal' | 'Reject';
  indications: string;
  referringDentist: string;
  status: 'acquired' | 'reviewed' | 'reported' | 'archived';
  thumbnail: string;
  dicomPath: string;
  segments?: Array<{ id: string; type: string; label: string; volume: number; color: string }>;
  measurements?: Array<{ id: string; type: string; label: string; value: number; unit: string }>;
  aiAnalysis?: {
    cariesDetected: number;
    boneLossLevel: string;
    periapicalLesions: number;
    confidence: number;
    modelVersion: string;
  };
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const dentalApi = {
  // 影像 CRUD (5 端点)
  listStudies: (params?: { modality?: string; patientId?: string; pageSize?: number }) =>
    api.get<DentalStudy[]>(`${DENTAL_API}/studies?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),
  getStudy: (id: string) => api.get<DentalStudy>(`${DENTAL_API}/studies/${id}`),
  createStudy: (data: Partial<DentalStudy>) => api.post<DentalStudy>(`${DENTAL_API}/studies`, data),
  updateStudy: (id: string, data: Partial<DentalStudy>) => api.put<DentalStudy>(`${DENTAL_API}/studies/${id}`, data),
  deleteStudy: (id: string) => api.delete(`${DENTAL_API}/studies/${id}`),

  // 影像路径 (1)
  getDicomPaths: (id: string) => api.get<{ series: Array<{ path: string; modality: string; instanceCount: number }> }>(`${DENTAL_API}/studies/${id}/dicom-paths`),

  // 分割 (2)
  getSegments: (id: string) => api.get<{ segments: any[] }>(`${DENTAL_API}/studies/${id}/segments`),
  triggerSegment: (id: string, data: { model?: string }) => api.post<any>(`${DENTAL_API}/studies/${id}/segment`, data),

  // MPR (1)
  getMpr: (id: string) => api.get<{ axes: string[]; sliceCount: number; resolution: string }>(`${DENTAL_API}/studies/${id}/mpr`),

  // 3D 模型 (1)
  get3dModel: (id: string) => api.get<{ modelUrl: string; format: string; triangleCount: number }>(`${DENTAL_API}/studies/${id}/3d-model`),

  // CBCT 专项 (4 端点)
  listCbct: () => api.get<DentalStudy[]>(`${DENTAL_API}/cbct/list`),
  getNerveCanal: (id: string) => api.get<any>(`${DENTAL_API}/cbct/${id}/nerve-canal`),
  getBoneDensity: (id: string) => api.get<any>(`${DENTAL_API}/cbct/${id}/bone-density`),
  getCbctMeasure: (id: string) => api.get<any>(`${DENTAL_API}/cbct/${id}/measure`),

  // 全景片 (2 端点)
  listPanoramic: () => api.get<DentalStudy[]>(`${DENTAL_API}/panoramic/list`),
  getPanoramic: (id: string) => api.get<DentalStudy>(`${DENTAL_API}/panoramic/${id}`),

  // 根尖片 (2 端点)
  listPeriapical: () => api.get<DentalStudy[]>(`${DENTAL_API}/periapical/list`),
  getPeriapical: (id: string) => api.get<DentalStudy>(`${DENTAL_API}/periapical/${id}`),

  // 口扫 (4 端点)
  listScan: () => api.get<DentalStudy[]>(`${DENTAL_API}/scan/list`),
  getScanModel: (id: string) => api.get<{ modelUrl: string; format: string }>(`${DENTAL_API}/scan/${id}/model`),
  compareScan: (id: string) => api.get<any>(`${DENTAL_API}/scan/${id}/compare`),
  alignScan: (id: string, targetScanId: string) => api.post<{ aligned: boolean }>(`${DENTAL_API}/scan/${id}/align`, { targetScanId }),

  // 咬合翼片 (1)
  listBitewing: () => api.get<DentalStudy[]>(`${DENTAL_API}/bitewing/list`),

  // 影像对比 (1)
  compareStudies: (idA: string, idB: string) => api.get<any>(`${DENTAL_API}/compare/${idA}/${idB}`),

  // 龋齿 on-image (1)
  detectCariesOnImage: (data: { imageBase64?: string; toothArea?: string }) => api.post<{
    detections: Array<{ id: string; toothNo: string; surface: string; bbox: number[]; confidence: number; severity: string }>;
    modelVersion: string;
    method: string;
  }>(`${DENTAL_API}/ai/caries-onimage`, data),

  // [v3.0.6.8-87] Phase 1: 修复 CAD/CAM (15 方法)
  getCadMaterials: () => api.get<any[]>(`${DENTAL_API}/cad/materials`),
  getCadShades: () => api.get<any>(`${DENTAL_API}/cad/shades`),
  getCadMillingUnits: () => api.get<any[]>(`${DENTAL_API}/cad/milling-units`),
  createCadDesign: (data: any) => api.post<any>(`${DENTAL_API}/cad/design`, data),
  getCadDesign: (id: string) => api.get<any>(`${DENTAL_API}/cad/design/${id}`),
  listCadDesigns: (patientId?: string) =>
    api.get<any[]>(`${DENTAL_API}/cad/designs${patientId ? '?patientId=' + patientId : ''}`),
  saveMarginLine: (id: string, marginLine: number[][]) =>
    api.put<any>(`${DENTAL_API}/cad/design/${id}/margin-line`, { marginLine }),
  saveAnatomy: (id: string, data: any) => api.put<any>(`${DENTAL_API}/cad/design/${id}/anatomy`, data),
  previewCadDesign: (id: string) => api.post<any>(`${DENTAL_API}/cad/design/${id}/preview`),
  exportCadStl: (id: string) => api.post<any>(`${DENTAL_API}/cad/design/${id}/export-stl`),
  updateCadStatus: (id: string, status: string) =>
    api.put<any>(`${DENTAL_API}/cad/design/${id}/status`, { status }),
  submitMill: (id: string, millingUnit: string) =>
    api.post<any>(`${DENTAL_API}/cad/design/${id}/submit-mill`, { millingUnit }),
  getMillingStatus: (id: string) => api.get<any>(`${DENTAL_API}/cad/milling-status/${id}`),
  getCadTemplates: () => api.get<any[]>(`${DENTAL_API}/cad/templates`),

  // [v3.0.6.8-88] Phase 1: 种植 3D 规划 (12 方法)
  getImplantBrands: () => api.get<any[]>(`${DENTAL_API}/implant/inventory/brands`),
  getImplantModels: (brandId?: string, toothNo?: number) => {
    let q = '';
    if (brandId) q += '?brandId=' + brandId;
    if (toothNo) q += (q ? '&' : '?') + 'toothNo=' + toothNo;
    return api.get<any[]>(`${DENTAL_API}/implant/inventory/models${q}`);
  },
  createImplantPlan3d: (data: any) => api.post<any>(`${DENTAL_API}/implant/plan-3d`, data),
  getImplantPlan3d: (id: string) => api.get<any>(`${DENTAL_API}/implant/plan-3d/${id}`),
  listImplantPlans3d: () => api.get<any[]>(`${DENTAL_API}/implant/plan-3d`),
  updateImplantPlacement: (id: string, placement: any) =>
    api.put<any>(`${DENTAL_API}/implant/plan-3d/${id}/placement`, placement),
  updateImplantModel: (id: string, brand: string, model: string) =>
    api.put<any>(`${DENTAL_API}/implant/plan-3d/${id}/implant`, { brand, model }),
  getImplantNerveDistance: (id: string) => api.get<any>(`${DENTAL_API}/implant/plan-3d/${id}/nerve-distance`),
  getImplantBoneDensityRoi: (id: string) => api.post<any>(`${DENTAL_API}/implant/plan-3d/${id}/bone-density-roi`, {}),
  markImplantNerve: (id: string, points: any[]) =>
    api.post<any>(`${DENTAL_API}/implant/plan-3d/${id}/nerve-mark`, { points }),
  validateImplantPlan: (id: string) => api.post<any>(`${DENTAL_API}/implant/plan-3d/${id}/validate`),
  approveImplantPlan: (id: string) => api.post<any>(`${DENTAL_API}/implant/plan-3d/${id}/approve`),

  // [v3.0.6.8-89] Phase 1: 导板 + 上部 + 种植体库 (8 方法)
  getGuideSleeves: (brand?: string) => api.get<any[]>(`${DENTAL_API}/implant/inventory/sleeves${brand ? '?brand=' + brand : ''}`),
  getAbutments: (brand?: string) => api.get<any[]>(`${DENTAL_API}/implant/abutments${brand ? '?brand=' + brand : ''}`),
  getGuideMaterials: () => api.get<any[]>(`${DENTAL_API}/guide/materials`),
  listSurgicalGuides: () => api.get<any[]>(`${DENTAL_API}/guide/list`),
  createSurgicalGuide: (data: any) => api.post<any>(`${DENTAL_API}/guide`, data),
  updateGuideSleeve: (id: string, sleeveType: string) => api.put<any>(`${DENTAL_API}/guide/${id}/sleeve`, { sleeveType }),
  exportSurgicalGuide: (id: string) => api.post<any>(`${DENTAL_API}/guide/${id}/export`),
  checkImplantPrices: (brand: string, models: string[]) =>
    api.get<any[]>(`${DENTAL_API}/implant/inventory/price-check?brand=${brand}&models=${models.join(',')}`),

  // ===== [v3.0.6.11-20] 后端真实端点 18 个对齐 =====
  // AI 发现 (2)
  listAiFindings: () => api.get<any[]>(`${DENTAL_API}/ai-findings`),
  createAiFinding: (data: any) => api.post<any>(`${DENTAL_API}/ai-findings`, data),

  // 种植体 CRUD (3)
  listImplants: () => api.get<any[]>(`${DENTAL_API}/implants`),
  createImplant: (data: any) => api.post<any>(`${DENTAL_API}/implants`, data),
  updateImplant: (id: string, data: any) => api.put<any>(`${DENTAL_API}/implants/${id}`, data),

  // 预约 CRUD (3)
  listAppointments: () => api.get<any[]>(`${DENTAL_API}/appointments`),
  createAppointment: (data: any) => api.post<any>(`${DENTAL_API}/appointments`, data),
  updateAppointment: (id: string, data: any) => api.put<any>(`${DENTAL_API}/appointments/${id}`, data),

  // 发票 CRUD (2)
  listInvoices: () => api.get<any[]>(`${DENTAL_API}/invoices`),
  createInvoice: (data: any) => api.post<any>(`${DENTAL_API}/invoices`, data),

  // 库存 CRUD (3)
  listInventory: () => api.get<any[]>(`${DENTAL_API}/inventory`),
  addInventoryItem: (data: any) => api.post<any>(`${DENTAL_API}/inventory`, data),
  updateInventoryItem: (id: string, data: any) => api.put<any>(`${DENTAL_API}/inventory/${id}`, data),

  // [v3.0.6.11-54] Phase 2: 治疗计划 (dentalHandlers 已有端点)
  listTreatments: (params?: { status?: string; patientId?: string; pageSize?: number }) =>
    api.get<any[]>(`${DENTAL_API}/treatments?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),
  getTreatment: (id: string) => api.get<any>(`${DENTAL_API}/treatments/${id}`),
  createTreatment: (data: any) => api.post<any>(`${DENTAL_API}/treatments`, data),
  updateTreatment: (id: string, data: any) => api.put<any>(`${DENTAL_API}/treatments/${id}`, data),
  startTreatment: (id: string) => api.post<any>(`${DENTAL_API}/treatments/${id}/start`, {}),
  completeTreatment: (id: string) => api.post<any>(`${DENTAL_API}/treatments/${id}/complete`, {}),
  listTreatmentTypes: () => api.get<any[]>(`${DENTAL_API}/treatments/types`),

  // [v3.0.6.11-54] Phase 2: 工作台统计
  getStats: () => api.get<any>(`${DENTAL_API}/stats`),
  getTodayAppointments: () => api.get<any[]>(`${DENTAL_API}/appointments?date=today`),

  // [v3.0.6.11-60] Batch 3: 口腔 AI 检测 (dentalHandlers 已支持端点)
  detectCaries: (data: { imageBase64?: string; modality?: string }) =>
    api.post<{
      detections: Array<{ toothNo: string; surface: string; confidence: number; severity: string; bbox: number[] }>;
      model: string; method: string;
    }>(`${DENTAL_API}/ai/caries-detection`, data),
  gradePeriapical: (data: { imageBase64?: string }) =>
    api.post<{ periapicalIndex: number; rcpScore: number; lesions: any[]; confidence: number }>(`${DENTAL_API}/ai/periapical-grading`, data),
  measureBoneLoss: (data: { imageBase64?: string }) =>
    api.post<{ boneLoss: { maxilla: number; mandible: number; unit: string }; furcationInvolvements: string[]; confidence: number }>(`${DENTAL_API}/ai/bone-loss`, data),
  detectRootCanal: (data: { imageBase64?: string }) =>
    api.post<{ canals: Array<{ toothNo: string; canalCount: number; filled: number; missed: string | null; difficulty: string }> }>(`${DENTAL_API}/ai/root-canal-detection`, data),
  screenOralCavity: (data: { imageBase64?: string }) =>
    api.post<{ findings: Array<{ location: string; type: string; probability: number; risk: string }> }>(`${DENTAL_API}/ai/oral-cavity-screening`, data),

  // [W3-2] 跨科室转诊 (DentalRadFusionPages / CrossSpecialtyReferralPage)
  listReferrals: () =>
    api.get<any[]>(`${DENTAL_API}/referrals`),
  createReferral: (data: any) =>
    api.post<any>(`${DENTAL_API}/referrals`, data),
  acceptReferral: (id: string) =>
    api.post<any>(`${DENTAL_API}/referrals/${id}/accept`, {}),

  // [W3-2] 远程口腔会诊 (DentalTelePage)
  listTeleSessions: () =>
    api.get<any[]>(`${DENTAL_API}/tele/sessions`),
  createTeleSession: (data: any) =>
    api.post<any>(`${DENTAL_API}/tele/sessions`, data),
  endTeleSession: (id: string) =>
    api.delete<any>(`${DENTAL_API}/tele/sessions/${id}`),

  // [G005 W1-A] 牙椅排班 / 患者 / 医生 (DentalSchedulePage 在用, 对齐 dentalHandlers)
  getScheduleChairs: () => api.get<any[]>(`${DENTAL_API}/schedule/chairs`),
  getScheduleAppointments: (date?: string) =>
    api.get<any[]>(`${DENTAL_API}/schedule/appointments${date ? '?date=' + date : ''}`),
  getScheduleStats: () => api.get<any>(`${DENTAL_API}/schedule/stats`),
  listPatients: () => api.get<any[]>(`${DENTAL_API}/patients`),
  listDentists: () => api.get<any[]>(`${DENTAL_API}/dentists`),
};

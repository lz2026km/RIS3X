// Neuro Specialty API — 神经影像分析 · 脑卒中 · 脑肿瘤 · 癫痫
import { api } from './client';

const NEURO_API = '/neuro';

// ─── Types ───
export type BrainRegion = 'frontal' | 'parietal' | 'temporal' | 'occipital' | 'basal-ganglia' | 'thalamus' | 'brainstem' | 'cerebellum' | 'corpus-callosum' | 'ventricles';
export type StrokeType = 'ischemic' | 'hemorrhagic' | 'tia' | 'subarachnoid';
export type IschemicSubtype = 'large-vessel' | 'small-vessel' | 'cardioembolic' | 'cryptogenic' | 'other';
export type HemorrhageType = 'intraparenchymal' | 'subdural' | 'epidural' | 'intraventricular' | 'subarachnoid';
export type TumorGrade = 'I' | 'II' | 'III' | 'IV';
export type TumorType = 'glioma' | 'meningioma' | 'metastasis' | 'schwannoma' | 'pituitary' | 'craniopharyngioma' | 'other';
export type TumorLocation = 'supratentorial' | 'infratentorial' | 'intra-axial' | 'extra-axial';
export type WhiteMatterLesion = 'none' | 'mild' | 'moderate' | 'severe';
export type Hydrocephalus = 'none' | 'mild' | 'moderate' | 'severe';
export type MidlineShift = 'none' | 'mild' | 'moderate' | 'severe';
export type EpilepsyFocus = 'mesial-temporal' | 'lateral-temporal' | 'frontal' | 'parietal' | 'occipital' | 'multifocal' | 'none-identified';

export interface BrainTumor {
  id: string;
  type: TumorType;
  grade: TumorGrade;
  location: BrainRegion;
  tumorLocation: TumorLocation;
  sizeMm: { ap: number; ml: number; cc: number };
  volumeCm3: number;
  edemaPresent: boolean;
  edemaVolumeCm3?: number;
  enhancementPattern: 'none' | 'homogeneous' | 'heterogeneous' | 'ring' | 'nodular';
  necrosisPresent: boolean;
  midlineShiftMm: number;
  massEffect: boolean;
  calcification: boolean;
  hemorrhage: boolean;
  diffusionRestriction: boolean;
  spectroscopy?: {
    cholineNaaRatio: number;
    cholineCreatineRatio: number;
    necrosisPresent: boolean;
  };
}

export interface StrokeAssessment {
  id: string;
  type: StrokeType;
  ischemicSubtype?: IschemicSubtype;
  hemorrhageType?: HemorrhageType;
  location: BrainRegion;
  vessel?: string;
  territoryVolumeMl: number;
  coreVolumeMl: number;
  penumbraVolumeMl: number;
  mismatchRatio: number;
  ncctScore: number; // ASPECTS
  nihssEstimate: number;
  timeWindow: string;
  largeVesselOcclusion: boolean;
  hemorrhagicTransformation?: boolean;
  treatmentRecommendation: 'iv-tpa' | 'mechanical-thrombectomy' | 'both' | 'conservative' | 'surgical-evacuation';
}

export interface NeuroExam {
  id: string;
  patientId: string;
  patientName: string;
  modality: 'CT' | 'MRI' | 'MRA' | 'CTA' | 'PET';
  studyDate: string;
  indications: string;
  tumors?: BrainTumor[];
  stroke?: StrokeAssessment;
  whiteMatterLesions: WhiteMatterLesion;
  hydrocephalus: Hydrocephalus;
  midlineShift: MidlineShift;
  atrophy: 'none' | 'mild' | 'moderate' | 'severe';
  extraAxialCollection?: { type: string; volumeMl: number };
  aiFindings?: {
    tumorDetection: boolean;
    hemorrhageDetection: boolean;
    strokeDetection: boolean;
    confidence: number;
    modelVersion: string;
  };
  status: 'scheduled' | 'acquired' | 'analyzing' | 'reviewed' | 'reported';
  radiologist?: string;
}

export interface EpilepsyStudy {
  id: string;
  patientId: string;
  patientName: string;
  focus: EpilepsyFocus;
  mesialTemporalSclerosis: boolean;
  corticalDysplasia: boolean;
  hippocampalVolumeLeft: number;
  hippocampalVolumeRight: number;
  hippocampalAsymmetry: number;
  petHypometabolism: boolean;
  petRegions: string[];
  ictalSpect?: { regions: string[]; lateralization: string };
  eegCorrelation: string;
}

export interface AneurysmAssessment {
  id: string;
  location: string;
  vessel: string;
  sizeMm: number;
  neckMm: number;
  domeToNeckRatio: number;
  morphology: 'saccular' | 'fusiform' | 'blister';
  ruptureRisk: 'low' | 'moderate' | 'high';
  treatmentRecommendation: 'observation' | 'coiling' | 'clipping' | 'flow-diverter';
  followUpInterval: string;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return '';
  return '?' + new URLSearchParams(filtered as [string, string][]).toString();
}

export const neuroSpecialtyApi = {
  // ─── Neuro Exams ───
  getExams: (params?: Record<string, any>) =>
    api.get<NeuroExam[]>(`${NEURO_API}/exams${buildQuery(params)}`),
  getExam: (id: string) =>
    api.get<NeuroExam>(`${NEURO_API}/exams/${id}`),
  createExam: (data: Partial<NeuroExam>) =>
    api.post<NeuroExam>(`${NEURO_API}/exams`, data),
  updateExam: (id: string, data: Partial<NeuroExam>) =>
    api.put<NeuroExam>(`${NEURO_API}/exams/${id}`, data),

  // ─── Stroke ───
  getStrokeStudies: (params?: Record<string, any>) =>
    api.get<NeuroExam[]>(`${NEURO_API}/stroke${buildQuery(params)}`),
  assessStroke: (studyId: string) =>
    api.post<StrokeAssessment>(`${NEURO_API}/stroke/${studyId}/assess`, {}),
  computeAspects: (studyId: string) =>
    api.post<{ score: number; regions: Record<string, number> }>(
      `${NEURO_API}/stroke/${studyId}/aspects`, {},
    ),
  detectLvo: (studyId: string) =>
    api.post<{ detected: boolean; vessel: string; location: string }>(
      `${NEURO_API}/stroke/${studyId}/lvo`, {},
    ),
  calculatePenumbraMismatch: (studyId: string) =>
    api.post<{ coreMl: number; penumbraMl: number; mismatch: number }>(
      `${NEURO_API}/stroke/${studyId}/mismatch`, {},
    ),

  // ─── Brain Tumor ───
  getTumorStudies: (params?: Record<string, any>) =>
    api.get<NeuroExam[]>(`${NEURO_API}/tumor${buildQuery(params)}`),
  analyzeTumor: (studyId: string) =>
    api.post<{ tumors: BrainTumor[]; summary: string }>(
      `${NEURO_API}/tumor/${studyId}/analyze`, {},
    ),
  segmentTumor: (studyId: string) =>
    api.post<{ volumeCm3: number; edemaCm3: number; necrosisCm3: number }>(
      `${NEURO_API}/tumor/${studyId}/segment`, {},
    ),
  gradeTumor: (studyId: string) =>
    api.post<{ grade: TumorGrade; confidence: number; features: string[] }>(
      `${NEURO_API}/tumor/${studyId}/grade`, {},
    ),
  trackTumorGrowth: (patientId: string) =>
    api.get<{ volumes: Array<{ date: string; volumeCm3: number }>; growthRate: number }>(
      `${NEURO_API}/tumor/growth/${patientId}`,
    ),

  // ─── Epilepsy ───
  getEpilepsyStudies: (params?: Record<string, any>) =>
    api.get<EpilepsyStudy[]>(`${NEURO_API}/epilepsy${buildQuery(params)}`),
  analyzeEpilepsy: (studyId: string) =>
    api.post<EpilepsyStudy>(`${NEURO_API}/epilepsy/${studyId}/analyze`, {}),
  measureHippocampalVolume: (studyId: string) =>
    api.get<{ left: number; right: number; asymmetry: number }>(
      `${NEURO_API}/epilepsy/${studyId}/hippocampus`,
    ),

  // ─── Aneurysm ───
  getAneurysmStudies: (params?: Record<string, any>) =>
    api.get<AneurysmAssessment[]>(`${NEURO_API}/aneurysm${buildQuery(params)}`),
  assessAneurysm: (studyId: string) =>
    api.post<AneurysmAssessment>(`${NEURO_API}/aneurysm/${studyId}/assess`, {}),
  assessRuptureRisk: (aneurysmId: string) =>
    api.post<{ risk: string; score: number; factors: string[] }>(
      `${NEURO_API}/aneurysm/${aneurysmId}/risk`, {},
    ),

  // ─── Volumetrics ───
  getVolumetrics: (studyId: string) =>
    api.get<{ brainVolumeCm3: number; ventricleVolumeCm3: number; evr: number; atrophyIndex: number }>(
      `${NEURO_API}/volumetrics/${studyId}`,
    ),

  // ─── Statistics ───
  getNeuroStats: (params?: Record<string, any>) =>
    api.get<any>(`${NEURO_API}/stats${buildQuery(params)}`),
  getStrokeStats: (params?: Record<string, any>) =>
    api.get<any>(`${NEURO_API}/stats/stroke${buildQuery(params)}`),
};

export default neuroSpecialtyApi;

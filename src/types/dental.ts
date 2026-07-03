/**
 * G005 牙科共享类型定义
 * 阶段 1: 从各 mock 文件抽出的共享类型，统一出口
 * 阶段 2+ 可继续从 dentalChartMock / dentalImagingMock / ... 抽取
 *
 * 注意：现有 mock 文件保留类型定义（通过 import/export 形式共享），
 * 这样不需要修改所有调用方。后续可逐个 mock 改为 import 这些类型。
 */

// ===== 影像 =====

/** 牙科设备模态（CBCT / 全景 / 根尖 / 咬合片 / 口扫） */
export type DentalModality = "CBCT" | "Panoramic" | "Periapical" | "Bitewing" | "Scan" | "Photo";

/** 牙科影像解剖区域 */
export type DentalRegion =
  | "Maxilla-Anterior"
  | "Maxilla-Premolar"
  | "Maxilla-Molar"
  | "Mandible-Anterior"
  | "Mandible-Premolar"
  | "Mandible-Molar"
  | "Full-Arch"
  | "TMJ"
  | "Sinus";

/** 牙科影像扫描类型 */
export type ScanType = "Upper" | "Lower" | "Bite" | "Pre-Ortho" | "Implant";

/** 影像质量分级（放射科常用） */
export type ImageQuality = "Diagnostic" | "Acceptable" | "Suboptimal" | "Reject";

/** 牙科研究状态 */
export type DentalStudyStatus = "acquired" | "reviewed" | "reported" | "archived";

/** 单个 segmentation 节点 */
export interface DentalSegment {
  id: string;
  type: "tooth" | "nerve" | "bone" | "soft-tissue";
  label: string;
  /** mm^3 */
  volume: number;
  color: string;
  toothNumbers?: number[];
}

/** 单个影像测量 */
export interface DentalMeasurement {
  id: string;
  type: "distance" | "angle" | "area" | "volume";
  label: string;
  value: number;
  unit: string;
}

/** AI 分析结果 */
export interface DentalAiAnalysis {
  cariesDetected: number;
  boneLossLevel: "None" | "Mild" | "Moderate" | "Severe";
  periapicalLesions: number;
  /** 0-1 */
  confidence: number;
  modelVersion: string;
}

/** 牙科研究（影像检查） */
export interface DentalStudy {
  id: string;
  patientId: string;
  patientName: string;
  modality: DentalModality;
  region: DentalRegion;
  scanType?: ScanType;
  acquisitionDate: string;
  deviceModel: string;
  fieldOfView: string;
  /** mm */
  voxelSize: number;
  /** mGy */
  radiationDose?: number;
  /** bytes */
  fileSize: number;
  imageCount: number;
  quality: ImageQuality;
  indications: string;
  referringDentist: string;
  status: DentalStudyStatus;
  /** data URL or color */
  thumbnail: string;
  dicomPath: string;
  segments?: DentalSegment[];
  measurements?: DentalMeasurement[];
  aiAnalysis?: DentalAiAnalysis;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ===== 牙位图 / 牙科图表 =====

/** 牙位表面：Occlusal / Mesial / Distal / Buccal / Lingual */
export type ToothSurface = "O" | "M" | "D" | "B" | "L";

/** 牙位表面状态 */
export type SurfaceStatus =
  | "Healthy"
  | "Caries-Mild"
  | "Caries-Moderate"
  | "Caries-Severe"
  | "Restored"
  | "Filling"
  | "Sealant";

/** 牙齿状态 */
export type ToothStatus =
  | "Healthy"
  | "Caries"
  | "Missing"
  | "Restored"
  | "Implant"
  | "RootCanal"
  | "Crown"
  | "Bridge"
  | "Partial";

/** ICDAS 龋齿分级 (International Caries Detection and Assessment System) */
export type IcdasGrade = "ICDAS-0" | "ICDAS-1" | "ICDAS-2" | "ICDAS-3" | "ICDAS-4" | "ICDAS-5" | "ICDAS-6";

/** 牙周评估 */
export interface PeriodontalRecord {
  /** 牙周袋深度 (mm) */
  pd: number;
  /** 临床附着丧失 (mm) */
  cal: number;
  /** 探诊出血 */
  bop: boolean;
  /** 牙齿松动度 0-3 */
  mob: number;
  /** 分叉病变 0-3 */
  furcation: number;
}

/** 单颗牙齿状态 */
export interface ToothState {
  /** FDI 11-48 (恒牙) / 51-85 (乳牙) */
  toothNo: number;
  status: ToothStatus;
  surfaces: Record<ToothSurface, SurfaceStatus>;
  cariesGrade?: IcdasGrade;
  periodontal?: PeriodontalRecord;
  notes: string;
}

/** 牙位编号系统 */
export type NumberingSystem = "FDI" | "Universal" | "Palmer";

/** 牙位图（完整牙科图表） */
export interface DentalChart {
  patientId: string;
  patientName: string;
  age: number;
  teeth: Record<number, ToothState>;
  numberingSystem: NumberingSystem;
  createdAt: string;
  updatedAt: string;
}

// ===== 牙科治疗 =====

/** 治疗类型 */
export type TreatmentType =
  | "Restorative"
  | "Endodontic"
  | "Periodontal"
  | "Implant"
  | "Orthodontic"
  | "Extraction"
  | "Surgery"
  | "Pediatric";
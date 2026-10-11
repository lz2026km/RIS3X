// [v3.0.6.8-53] PR 口腔: 口腔影像 mock 数据 (600 影像 = 20 患者 × 30)
// [G005 dental-demo-fill] patientId/patientName 全部指向 dentalEmrMock 患者池 (无孤儿 ID);
//   studyId ↔ patientId ↔ chartId ↔ treatmentId 交叉关联; 确定性 mulberry32, 无模块级 Math.random()。
import { mulberry32, hashSeed } from '../../utils/seededRandom';
import {
  MOCK_DENTAL_PATIENTS,
  DENTAL_STUDIES_PER_PATIENT,
  dentalStudyIdFor,
  dentalTreatmentIdFor,
} from './dentalEmrMock';
import { getPrimaryChartId } from './dentalChartMock';

export type DentalModality = 'CBCT' | 'Panoramic' | 'Periapical' | 'Scan' | 'Bitewing';
export type DentalRegion =
  | 'Maxilla-Anterior' | 'Maxilla-Premolar' | 'Maxilla-Molar'
  | 'Mandible-Anterior' | 'Mandible-Premolar' | 'Mandible-Molar'
  | 'Full-Arch' | 'TMJ' | 'Sinus';
export type ImageQuality = 'Diagnostic' | 'Acceptable' | 'Suboptimal' | 'Reject';
export type ScanType = 'Upper' | 'Lower' | 'Bite' | 'Pre-Ortho' | 'Implant';

export interface DentalStudyDto {
  id: string;
  patientId: string;
  patientName: string;
  chartId?: string; // 关联牙位图 (dentalChartMock 主图)
  treatmentIds?: string[]; // 关联治疗 (dentalTreatmentMock, 反向引用)
  modality: DentalModality;
  region: DentalRegion;
  scanType?: ScanType;
  acquisitionDate: string;
  deviceModel: string;
  fieldOfView: string;
  voxelSize: number; // mm
  radiationDose?: number; // mGy
  fileSize: number; // bytes
  imageCount: number;
  quality: ImageQuality;
  indications: string;
  referringDentist: string;
  status: 'acquired' | 'reviewed' | 'reported' | 'archived';
  thumbnail: string; // data URL or color
  dicomPath: string;
  segments?: Array<{
    id: string;
    type: 'tooth' | 'nerve' | 'bone' | 'soft-tissue';
    label: string;
    volume: number; // mm³
    color: string;
    toothNumbers?: number[];
  }>;
  measurements?: Array<{
    id: string;
    type: 'distance' | 'angle' | 'area' | 'volume';
    label: string;
    value: number;
    unit: string;
  }>;
  aiAnalysis?: {
    cariesDetected: number;
    boneLossLevel: 'None' | 'Mild' | 'Moderate' | 'Severe';
    periapicalLesions: number;
    confidence: number;
    modelVersion: string;
  };
  notes: string;
  toothNumbers?: number[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const PANORAMIC_DEVICES = ['Sirona Orthophos XG 3D', 'Planmeca ProMax 2D', 'Carestream CS 8100', 'Vatech PaX-i', 'Gendex GXDP-700'];
const CBCT_DEVICES = ['Planmeca ProMax 3D Classic', 'NewTom VGi evo', 'Sirona Orthophos SL 3D', 'Carestream CS 9300', 'Vatech PaX-i3D'];
const PERIAPICAL_DEVICES = ['DEXcowin MyRay', 'Carestream CS 2200', 'Gendex GXS-700', 'Sirona Xios AE', '3Shape Trios 5'];
const SCAN_DEVICES = ['3Shape TRIOS 5', 'iTero Element 5D Plus', 'Medit i700', 'Shining 3D Aoralscan Elite', 'Align iTero Lumina'];
const BITEWING_DEVICES = ['Carestream CS 2200', 'DEXcowin MyRay', 'Gendex GXS-700'];

const REGIONS: DentalRegion[] = ['Maxilla-Anterior', 'Maxilla-Premolar', 'Maxilla-Molar', 'Mandible-Anterior', 'Mandible-Premolar', 'Mandible-Molar', 'Full-Arch', 'TMJ', 'Sinus'];
const SCAN_TYPES: ScanType[] = ['Upper', 'Lower', 'Bite', 'Pre-Ortho', 'Implant'];
const QUALITIES: ImageQuality[] = ['Diagnostic', 'Diagnostic', 'Acceptable', 'Suboptimal', 'Reject'];
const STATUSES = ['acquired', 'reviewed', 'reported', 'archived'];

const REFERRING = ['王主任 (修复科)', '李主任 (口腔外科)', '张主任 (牙周科)', '刘主任 (种植科)', '陈主任 (正畸科)', '黄主任 (牙体牙髓科)'];
const INDICATIONS = [
  '右下后牙疼痛 1 周', '上颌前牙外伤 2 天', '牙龈出血伴松动', '牙髓炎急性发作', '阻生智齿冠周炎',
  '种植术前评估', '正畸治疗前 CBCT 评估', '根管治疗前评估', '牙周炎评估', '颌骨囊肿随访',
  '颞下颌关节疼痛', '正畸后保持期随访', '上颌窦提升术前评估', '口腔修复前评估', '龋齿筛查',
];

// 固定锚点时间 → 数据刷新后不抖动
const ANCHOR_MS = Date.parse('2026-09-28T09:00:00.000Z');
const DAY_MS = 24 * 3600 * 1000;
const STUDY_COUNT = MOCK_DENTAL_PATIENTS.length * DENTAL_STUDIES_PER_PATIENT; // 600

function rf(r: () => number, min: number, max: number, decimals = 2): number {
  return parseFloat((r() * (max - min) + min).toFixed(decimals));
}

function ri(r: () => number, min: number, max: number): number {
  return Math.floor(r() * (max - min + 1)) + min;
}

function pickBy<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)]!;
}

export const MOCK_DENTAL_STUDIES: DentalStudyDto[] = (() => {
  const out: DentalStudyDto[] = [];
  const modalities: DentalModality[] = ['CBCT', 'Panoramic', 'Periapical', 'Scan', 'Bitewing'];
  const modalityWeights = [15, 25, 30, 20, 10]; // weights summing to 100

  for (let i = 0; i < STUDY_COUNT; i++) {
    const patientIdx = Math.floor(i / DENTAL_STUDIES_PER_PATIENT) % MOCK_DENTAL_PATIENTS.length; // 20 × 30
    const k = i % DENTAL_STUDIES_PER_PATIENT;
    const patient = MOCK_DENTAL_PATIENTS[patientIdx]!;
    const r = mulberry32(hashSeed(`dental-study-STU${100000 + i}`));

    // weighted random modality
    let wr = r() * 100;
    let modality: DentalModality = 'Panoramic';
    for (let j = 0; j < modalities.length; j++) {
      wr -= modalityWeights[j]!;
      if (wr <= 0) {
        modality = modalities[j]!;
        break;
      }
    }

    const region = pickBy(r, REGIONS);
    const quality = pickBy(r, QUALITIES);
    const status = pickBy(r, STATUSES) as DentalStudyDto['status'];
    const patientId = patient.id;

    const acquisitionMs = ANCHOR_MS - r() * 170 * DAY_MS;
    const acquisitionDate = new Date(acquisitionMs);
    const acquisitionIso = acquisitionDate.toISOString();
    const deviceModel = pickBy(r,
      modality === 'CBCT' ? CBCT_DEVICES :
      modality === 'Panoramic' ? PANORAMIC_DEVICES :
      modality === 'Periapical' ? PERIAPICAL_DEVICES :
      modality === 'Scan' ? SCAN_DEVICES :
      BITEWING_DEVICES
    );

    const fov = modality === 'CBCT' ? (pickBy(r, ['5x5 cm', '8x8 cm', '10x10 cm', '16x8 cm', '17x11 cm'])) :
               modality === 'Periapical' ? (pickBy(r, ['2x3 cm', '3x4 cm'])) :
               modality === 'Panoramic' ? '全景' :
               modality === 'Scan' ? (pickBy(r, ['上颌', '下颌', '咬合'])) : '咬合翼片';

    const voxelSize = modality === 'CBCT' ? rf(r, 0.08, 0.30) :
                      modality === 'Periapical' ? rf(r, 0.02, 0.05) :
                      modality === 'Scan' ? rf(r, 0.02, 0.08) :
                      modality === 'Panoramic' ? 0.1 :
                      0.05;

    const radiationDose = modality === 'CBCT' ? rf(r, 50, 800) :
                          modality === 'Panoramic' ? rf(r, 5, 25) :
                          modality === 'Periapical' ? rf(r, 0.5, 3) :
                          undefined;

    const imageCount = modality === 'CBCT' ? ri(r, 300, 800) : 1;

    const fileSize = modality === 'CBCT' ? ri(r, 30, 200) * 1024 * 1024 :
                     modality === 'Panoramic' ? ri(r, 5, 30) * 1024 * 1024 :
                     modality === 'Periapical' ? ri(r, 1, 3) * 1024 * 1024 :
                     modality === 'Scan' ? ri(r, 10, 80) * 1024 * 1024 :
                     ri(r, 1, 5) * 1024 * 1024;

    // Segments (mainly CBCT)
    const segments: DentalStudyDto['segments'] = [];
    if (modality === 'CBCT' && r() > 0.3) {
      segments.push({ id: 'seg-1', type: 'nerve', label: '下牙槽神经 (左)', volume: rf(r, 80, 200), color: '#ff7a00' });
      if (r() > 0.5) segments.push({ id: 'seg-2', type: 'nerve', label: '下牙槽神经 (右)', volume: rf(r, 80, 200), color: '#ff7a00' });
      if (r() > 0.4) segments.push({ id: 'seg-3', type: 'tooth', label: '36 牙根', volume: rf(r, 200, 500), color: '#f0f0f0' });
      if (r() > 0.5) segments.push({ id: 'seg-4', type: 'bone', label: '下颌骨', volume: rf(r, 30000, 60000), color: '#fff5e6' });
    }

    // Measurements
    const measurements: DentalStudyDto['measurements'] = [];
    if (modality === 'CBCT' && r() > 0.4) {
      measurements.push({ id: 'm-1', type: 'distance', label: '36 至下牙槽神经管距离', value: rf(r, 6, 15, 1), unit: 'mm' });
      if (r() > 0.5) {
        measurements.push({ id: 'm-2', type: 'distance', label: '种植体可用骨高度', value: rf(r, 8, 18, 1), unit: 'mm' });
      }
    }

    // AI Analysis
    let aiAnalysis: DentalStudyDto['aiAnalysis'] = undefined;
    if (modality === 'Bitewing' || modality === 'Periapical' || (modality === 'CBCT' && r() > 0.3)) {
      aiAnalysis = {
        cariesDetected: ri(r, 0, 4),
        boneLossLevel: pickBy(r, ['None', 'None', 'Mild', 'Moderate', 'Severe']) as any,
        periapicalLesions: ri(r, 0, 2),
        confidence: rf(r, 0.7, 0.95),
        modelVersion: 'YOLOv8n-dental-v1.2',
      };
    }

    // 治疗反向引用: dentalTreatmentMock 中 studyId 指向前 3 条治疗 → 此处回链
    const treatmentIds = k < 3
      ? [dentalTreatmentIdFor(patientIdx, k)]
      : undefined;

    out.push({
      id: dentalStudyIdFor(patientIdx, k),
      patientId,
      patientName: patient.name,
      chartId: getPrimaryChartId(patientId),
      treatmentIds,
      modality,
      region,
      scanType: modality === 'Scan' ? pickBy(r, SCAN_TYPES) : undefined,
      acquisitionDate: acquisitionIso.slice(0, 10),
      deviceModel,
      fieldOfView: fov,
      voxelSize: parseFloat(voxelSize.toFixed(2)),
      radiationDose: radiationDose ? parseFloat(radiationDose.toFixed(1)) : undefined,
      fileSize,
      imageCount,
      quality,
      indications: pickBy(r, INDICATIONS),
      referringDentist: pickBy(r, REFERRING),
      status,
      thumbnail: '#' + (ri(r, 0, 16777215)).toString(16).padStart(6, '0'),
      dicomPath: `/dicom/dental/${patientId}/${dentalStudyIdFor(patientIdx, k)}.dcm`,
      segments: segments.length > 0 ? segments : undefined,
      measurements: measurements.length > 0 ? measurements : undefined,
      aiAnalysis,
      notes: '',
      toothNumbers: r() > 0.5 ? [pickBy(r, [11,16,21,26,31,36,41,46,13,23,33,43,17,27,37,47])] : [],
      tags: modality === 'CBCT' ? ['CBCT', '三维'] : modality === 'Scan' ? ['口扫', '3D'] : [],
      createdAt: acquisitionIso,
      updatedAt: new Date(acquisitionMs + 3600 * 1000).toISOString(),
    });
  }
  return out;
})();

export function getDentalStudiesByModality(modality: DentalModality): DentalStudyDto[] {
  return MOCK_DENTAL_STUDIES.filter(s => s.modality === modality);
}

export function getDentalStudiesByPatient(patientId: string): DentalStudyDto[] {
  return MOCK_DENTAL_STUDIES.filter(s => s.patientId === patientId);
}

export function getDentalStudyById(id: string): DentalStudyDto | undefined {
  return MOCK_DENTAL_STUDIES.find(s => s.id === id);
}

// [v3.0.6.8-53] PR 口腔: 口腔影像 mock 数据 (1200 行, 600 影像)
import { randInt, pick, seedRandom } from '../_generators';

function randFloat(min: any, max: any, decimals?: any) {
  if (decimals === undefined) decimals = 2;
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

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

const FIRST_NAMES = ['张', '王', '李', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '林', '何', '高', '罗', '郑'];
const GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '建国', '海燕'];
const REFERRING = ['王主任 (修复科)', '李主任 (口腔外科)', '张主任 (牙周科)', '刘主任 (种植科)', '陈主任 (正畸科)', '黄主任 (牙体牙髓科)'];
const INDICATIONS = [
  '右下后牙疼痛 1 周', '上颌前牙外伤 2 天', '牙龈出血伴松动', '牙髓炎急性发作', '阻生智齿冠周炎',
  '种植术前评估', '正畸治疗前 CBCT 评估', '根管治疗前评估', '牙周炎评估', '颌骨囊肿随访',
  '颞下颌关节疼痛', '正畸后保持期随访', '上颌窦提升术前评估', '口腔修复前评估', '龋齿筛查',
];



function randomDate(daysBack: number): string {
  const d = new Date(Date.now() - Math.random() * daysBack * 24 * 3600 * 1000);
  return d.toISOString();
}

export const MOCK_DENTAL_STUDIES: DentalStudyDto[] = (() => {
  seedRandom(42);
  const out: DentalStudyDto[] = [];
  const modalities: DentalModality[] = ['CBCT', 'Panoramic', 'Periapical', 'Scan', 'Bitewing'];
  const modalityWeights = [15, 25, 30, 20, 10]; // weights summing to 100

  for (let i = 0; i < 600; i++) {
    // weighted random modality
    let r = Math.random() * 100;
    let modality: DentalModality = 'Panoramic';
    for (let j = 0; j < modalities.length; j++) {
      r -= modalityWeights[j]!;
      if (r <= 0) {
        modality = modalities[j]!;
        break;
      }
    }

    const region = pick(REGIONS);
    const quality = pick(QUALITIES);
    const status = pick(STATUSES) as DentalStudyDto['status'];
    const firstName = pick(FIRST_NAMES);
    const givenName = pick(GIVEN_NAMES);
    const patientName = firstName + givenName + randInt(8, 82);
    const patientId = 'P' + String(100000 + i);

    const acquisitionDate = randomDate(180);
    const deviceModel = pick(
      modality === 'CBCT' ? CBCT_DEVICES :
      modality === 'Panoramic' ? PANORAMIC_DEVICES :
      modality === 'Periapical' ? PERIAPICAL_DEVICES :
      modality === 'Scan' ? SCAN_DEVICES :
      BITEWING_DEVICES
    );

    const fov = modality === 'CBCT' ? (pick(['5x5 cm', '8x8 cm', '10x10 cm', '16x8 cm', '17x11 cm'])) :
               modality === 'Periapical' ? (pick(['2x3 cm', '3x4 cm'])) :
               modality === 'Panoramic' ? '全景' :
               modality === 'Scan' ? (pick(['上颌', '下颌', '咬合'])) : '咬合翼片';

    const voxelSize = modality === 'CBCT' ? randFloat(0.08, 0.30) :
                      modality === 'Periapical' ? randFloat(0.02, 0.05) :
                      modality === 'Scan' ? randFloat(0.02, 0.08) :
                      modality === 'Panoramic' ? 0.1 :
                      0.05;

    const radiationDose = modality === 'CBCT' ? randFloat(50, 800) :
                          modality === 'Panoramic' ? randFloat(5, 25) :
                          modality === 'Periapical' ? randFloat(0.5, 3) :
                          undefined;

    const imageCount = modality === 'CBCT' ? randInt(300, 800) :
                       modality === 'Panoramic' ? 1 :
                       modality === 'Periapical' ? 1 :
                       modality === 'Scan' ? 1 :
                       modality === 'Bitewing' ? 1 : 1;

    const fileSize = modality === 'CBCT' ? randInt(30, 200) * 1024 * 1024 :
                     modality === 'Panoramic' ? randInt(5, 30) * 1024 * 1024 :
                     modality === 'Periapical' ? randInt(0.5, 3) * 1024 * 1024 :
                     modality === 'Scan' ? randInt(10, 80) * 1024 * 1024 :
                     randInt(1, 5) * 1024 * 1024;

    // Segments (mainly CBCT)
    const segments: DentalStudyDto['segments'] = [];
    if (modality === 'CBCT' && Math.random() > 0.3) {
      segments.push({ id: 'seg-1', type: 'nerve', label: '下牙槽神经 (左)', volume: randFloat(80, 200), color: '#ff7a00' });
      if (Math.random() > 0.5) segments.push({ id: 'seg-2', type: 'nerve', label: '下牙槽神经 (右)', volume: randFloat(80, 200), color: '#ff7a00' });
      if (Math.random() > 0.4) segments.push({ id: 'seg-3', type: 'tooth', label: '36 牙根', volume: randFloat(200, 500), color: '#f0f0f0' });
      if (Math.random() > 0.5) segments.push({ id: 'seg-4', type: 'bone', label: '下颌骨', volume: randFloat(30000, 60000), color: '#fff5e6' });
    }

    // Measurements
    const measurements: DentalStudyDto['measurements'] = [];
    if (modality === 'CBCT' && Math.random() > 0.4) {
      measurements.push({ id: 'm-1', type: 'distance', label: '36 至下牙槽神经管距离', value: parseFloat(randFloat(6, 15).toFixed(1)), unit: 'mm' });
      if (Math.random() > 0.5) {
        measurements.push({ id: 'm-2', type: 'distance', label: '种植体可用骨高度', value: parseFloat(randFloat(8, 18).toFixed(1)), unit: 'mm' });
      }
    }

    // AI Analysis
    let aiAnalysis: DentalStudyDto['aiAnalysis'] = undefined;
    if (modality === 'Bitewing' || modality === 'Periapical' || (modality === 'CBCT' && Math.random() > 0.3)) {
      aiAnalysis = {
        cariesDetected: randInt(0, 4),
        boneLossLevel: pick(['None', 'None', 'Mild', 'Moderate', 'Severe']) as any,
        periapicalLesions: randInt(0, 2),
        confidence: randFloat(0.7, 0.95),
        modelVersion: 'YOLOv8n-dental-v1.2',
      };
    }

    out.push({
      id: 'STU' + String(100000 + i),
      patientId,
      patientName,
      modality,
      region,
      scanType: modality === 'Scan' ? pick(SCAN_TYPES) : undefined,
      acquisitionDate: acquisitionDate.slice(0, 10),
      deviceModel,
      fieldOfView: fov,
      voxelSize: parseFloat(voxelSize.toFixed(2)),
      radiationDose: radiationDose ? parseFloat(radiationDose.toFixed(1)) : undefined,
      fileSize,
      imageCount,
      quality,
      indications: pick(INDICATIONS),
      referringDentist: pick(REFERRING),
      status,
      thumbnail: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      dicomPath: `/dicom/dental/${patientId}/${Date.now()}.dcm`,
      segments: segments.length > 0 ? segments : undefined,
      measurements: measurements.length > 0 ? measurements : undefined,
      aiAnalysis,
      notes: '',
      toothNumbers: Math.random() > 0.5 ? [pick([11,16,21,26,31,36,41,46,13,23,33,43,17,27,37,47])] : [],
      tags: modality === 'CBCT' ? ['CBCT', '三维'] : modality === 'Scan' ? ['口扫', '3D'] : [],
      createdAt: acquisitionDate,
      updatedAt: new Date().toISOString(),
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

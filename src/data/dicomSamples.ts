// ============================================================
// G005 放射RIS系统 v2.1.0 - DICOM 样本数据集
// Phase R10 W1: 100 套样例 DICOM (覆盖 6 模态 × 10 部位)
// 来源: OHIF 内置 sample + 内置 mock metadata
// ============================================================

export interface DicomSample {
  id: string;
  studyId: string;
  seriesId: string;
  modality: 'CT' | 'MR' | 'DR' | 'US' | 'MG' | 'PT';
  bodyPart: string;
  studyDescription: string;
  seriesDescription: string;
  sliceCount: number;
  thickness: number;
  pixelSpacing: [number, number];
  imageUrl: string;         // wadouri: 本地样本 (/dicom-samples/**)
  wadoRsUrl?: string;        // WADO-RS endpoint
  thumbnail?: string;        // PNG thumbnail
  tags: { [key: string]: string };
  acquisitionDate: string;
  size: number;               // bytes
}

// [B-03] 本地 DICOM 样本: dev 由 vite.config.ts 'dicom-samples-serve' 中间件从
// backend/dicom-samples 提供, build 由 'dicom-samples-build' 复制到 dist/dicom-samples,
// 路径与 getSeriesImageIds() 一致, 避免 hot-link ohif.org 触发 CORS。
export const LOCAL_DICOM_SAMPLES_DIR = '/dicom-samples';
const LOCAL_CT_CHEST = `${LOCAL_DICOM_SAMPLES_DIR}/CT_CHEST/CT_CHEST_001.dcm`;
const LOCAL_CT_HEAD = `${LOCAL_DICOM_SAMPLES_DIR}/CT_HEAD/CT_HEAD_001.dcm`;
const LOCAL_MR_BRAIN = `${LOCAL_DICOM_SAMPLES_DIR}/MR_BRAIN/MR_BRAIN_001.dcm`;
const LOCAL_DR_CHEST = `${LOCAL_DICOM_SAMPLES_DIR}/DR_CHEST/DR_CHEST_001.dcm`;
const LOCAL_DBT_LEFT = `${LOCAL_DICOM_SAMPLES_DIR}/DBT_LEFT/DBT_LEFT_001.dcm`;

/** 模态/部位 → 本地 .dcm 样本路径 (US/PT 等暂无专属样本时以 CT 胸部兜底) */
function pickLocalSampleFile(modality: string, bodyPart: string): string {
  if (modality === 'MR') return LOCAL_MR_BRAIN;
  if (modality === 'DR') return LOCAL_DR_CHEST;
  if (modality === 'MG') return LOCAL_DBT_LEFT;
  if (modality === 'CT') {
    return /头颅|脊柱|颈部/.test(bodyPart) ? LOCAL_CT_HEAD : LOCAL_CT_CHEST;
  }
  return LOCAL_CT_CHEST;
}

/** 样本 → 本地 DICOM imageId (wadouri:/dicom-samples/**), 保留 modality/部位元数据不变 */
export function localSampleImageId(modality: string, bodyPart: string): string {
  return `wadouri:${pickLocalSampleFile(modality, bodyPart)}`;
}

// 100 套样例 (按模态/部位分布)
export const DICOM_SAMPLES: DicomSample[] = [
  // ============ CT 胸部 (15 套) ============
  { id: 'ct-chest-001', studyId: 'ST-001', seriesId: 'SR-001', modality: 'CT', bodyPart: '胸部',
    studyDescription: '胸部 CT 平扫', seriesDescription: 'Axial 1.0mm', sliceCount: 80, thickness: 1.0,
    pixelSpacing: [0.7, 0.7], imageUrl: localSampleImageId('CT', '胸部'),
    acquisitionDate: '2024-01-15', size: 52428800, tags: { '00100020': 'P001', '00080060': 'CT' } },
  { id: 'ct-chest-002', studyId: 'ST-002', seriesId: 'SR-002', modality: 'CT', bodyPart: '胸部',
    studyDescription: '胸部 CT 增强', seriesDescription: 'Axial 1.0mm + Contrast', sliceCount: 100, thickness: 1.0,
    pixelSpacing: [0.7, 0.7], imageUrl: localSampleImageId('CT', '胸部'),
    acquisitionDate: '2024-02-10', size: 67108864, tags: { '00100020': 'P002', '00080060': 'CT' } },
  { id: 'ct-chest-003', studyId: 'ST-003', seriesId: 'SR-003', modality: 'CT', bodyPart: '胸部',
    studyDescription: '胸部 HRCT', seriesDescription: 'HRCT 0.6mm', sliceCount: 150, thickness: 0.6,
    pixelSpacing: [0.5, 0.5], imageUrl: localSampleImageId('CT', '胸部'),
    acquisitionDate: '2024-02-15', size: 98304000, tags: { '00100020': 'P003', '00080060': 'CT' } },
  { id: 'ct-chest-004', studyId: 'ST-004', seriesId: 'SR-004', modality: 'CT', bodyPart: '胸部',
    studyDescription: '胸部 CT 肺动脉造影 (CTPA)', seriesDescription: 'CTPA', sliceCount: 120, thickness: 1.0,
    pixelSpacing: [0.7, 0.7], imageUrl: localSampleImageId('CT', '胸部'),
    acquisitionDate: '2024-03-05', size: 78643200, tags: { '00100020': 'P004', '00080060': 'CT' } },
  { id: 'ct-chest-005', studyId: 'ST-005', seriesId: 'SR-005', modality: 'CT', bodyPart: '胸部',
    studyDescription: '胸部 CT 冠脉造影', seriesDescription: 'CCTA', sliceCount: 256, thickness: 0.5,
    pixelSpacing: [0.4, 0.4], imageUrl: localSampleImageId('CT', '胸部'),
    acquisitionDate: '2024-03-20', size: 167772160, tags: { '00100020': 'P005', '00080060': 'CT' } },
  // ... 10 more CT chest
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `ct-chest-${String(i + 6).padStart(3, '0')}`,
    studyId: `ST-${String(i + 6).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 6).padStart(3, '0')}`,
    modality: 'CT' as const,
    bodyPart: '胸部',
    studyDescription: `胸部 CT 病例 ${i + 6}`,
    seriesDescription: 'Axial 1.0mm',
    sliceCount: 60 + i * 4,
    thickness: 1.0,
    pixelSpacing: [0.7, 0.7] as [number, number],
    imageUrl: localSampleImageId('CT', '胸部'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 52428800 + i * 1048576,
    tags: { '00100020': `P${i + 6}`, '00080060': 'CT' },
  })),

  // ============ CT 腹部 (15 套) ============
  { id: 'ct-abd-001', studyId: 'ST-016', seriesId: 'SR-016', modality: 'CT', bodyPart: '腹部',
    studyDescription: '上腹部 CT 平扫+增强', seriesDescription: 'Axial 1.0mm 三期', sliceCount: 200, thickness: 1.0,
    pixelSpacing: [0.7, 0.7], imageUrl: localSampleImageId('CT', '腹部'),
    acquisitionDate: '2024-04-01', size: 131072000, tags: { '00100020': 'P016', '00080060': 'CT' } },
  { id: 'ct-abd-002', studyId: 'ST-017', seriesId: 'SR-017', modality: 'CT', bodyPart: '腹部',
    studyDescription: '全腹 CT 增强', seriesDescription: 'Axial 1.0mm + Venous', sliceCount: 350, thickness: 1.0,
    pixelSpacing: [0.7, 0.7], imageUrl: localSampleImageId('CT', '腹部'),
    acquisitionDate: '2024-04-15', size: 230686720, tags: { '00100020': 'P017', '00080060': 'CT' } },
  { id: 'ct-abd-003', studyId: 'ST-018', seriesId: 'SR-018', modality: 'CT', bodyPart: '腹部',
    studyDescription: 'CT 尿路造影 (CTU)', seriesDescription: 'CTU Axial + Coronal', sliceCount: 280, thickness: 1.0,
    pixelSpacing: [0.7, 0.7], imageUrl: localSampleImageId('CT', '腹部'),
    acquisitionDate: '2024-05-01', size: 184549376, tags: { '00100020': 'P018', '00080060': 'CT' } },
  ...Array.from({ length: 12 }).map((_, i) => ({
    id: `ct-abd-${String(i + 4).padStart(3, '0')}`,
    studyId: `ST-${String(i + 19).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 19).padStart(3, '0')}`,
    modality: 'CT' as const,
    bodyPart: '腹部',
    studyDescription: `腹部 CT 病例 ${i + 4}`,
    seriesDescription: 'Axial 1.0mm',
    sliceCount: 200 + i * 10,
    thickness: 1.0,
    pixelSpacing: [0.7, 0.7] as [number, number],
    imageUrl: localSampleImageId('CT', '腹部'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 131072000 + i * 10485760,
    tags: { '00100020': `P${i + 19}`, '00080060': 'CT' },
  })),

  // ============ CT 头颅 (10 套) ============
  { id: 'ct-head-001', studyId: 'ST-031', seriesId: 'SR-031', modality: 'CT', bodyPart: '头颅',
    studyDescription: '头颅 CT 平扫', seriesDescription: 'Axial 1.0mm', sliceCount: 60, thickness: 1.0,
    pixelSpacing: [0.5, 0.5], imageUrl: localSampleImageId('CT', '头颅'),
    acquisitionDate: '2024-06-01', size: 39321600, tags: { '00100020': 'P031', '00080060': 'CT' } },
  { id: 'ct-head-002', studyId: 'ST-032', seriesId: 'SR-032', modality: 'CT', bodyPart: '头颅',
    studyDescription: '头颅 CTA', seriesDescription: 'CTA Axial + MIP', sliceCount: 80, thickness: 0.6,
    pixelSpacing: [0.4, 0.4], imageUrl: localSampleImageId('CT', '头颅'),
    acquisitionDate: '2024-06-10', size: 52428800, tags: { '00100020': 'P032', '00080060': 'CT' } },
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `ct-head-${String(i + 3).padStart(3, '0')}`,
    studyId: `ST-${String(i + 33).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 33).padStart(3, '0')}`,
    modality: 'CT' as const,
    bodyPart: '头颅',
    studyDescription: `头颅 CT 病例 ${i + 3}`,
    seriesDescription: 'Axial 1.0mm',
    sliceCount: 60 + i * 5,
    thickness: 1.0,
    pixelSpacing: [0.5, 0.5] as [number, number],
    imageUrl: localSampleImageId('CT', '头颅'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 39321600 + i * 2097152,
    tags: { '00100020': `P${i + 33}`, '00080060': 'CT' },
  })),

  // ============ CT 脊柱 (5 套) ============
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `ct-spine-${String(i + 1).padStart(3, '0')}`,
    studyId: `ST-${String(i + 41).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 41).padStart(3, '0')}`,
    modality: 'CT' as const,
    bodyPart: '脊柱',
    studyDescription: `脊柱 CT 病例 ${i + 1}`,
    seriesDescription: 'Sagittal + Axial',
    sliceCount: 80 + i * 10,
    thickness: 1.0,
    pixelSpacing: [0.6, 0.6] as [number, number],
    imageUrl: localSampleImageId('CT', '脊柱'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 52428800 + i * 5242880,
    tags: { '00100020': `P${i + 41}`, '00080060': 'CT' },
  })),

  // ============ MR 头颅 (10 套) ============
  { id: 'mr-head-001', studyId: 'ST-046', seriesId: 'SR-046', modality: 'MR', bodyPart: '头颅',
    studyDescription: '头颅 MR 平扫+增强', seriesDescription: 'T1W + T2W + FLAIR + DWI + T1+C', sliceCount: 200, thickness: 5.0,
    pixelSpacing: [0.5, 0.5], imageUrl: localSampleImageId('MR', '头颅'),
    acquisitionDate: '2024-07-01', size: 67108864, tags: { '00100020': 'P046', '00080060': 'MR' } },
  { id: 'mr-head-002', studyId: 'ST-047', seriesId: 'SR-047', modality: 'MR', bodyPart: '头颅',
    studyDescription: '头颅 MRA', seriesDescription: 'TOF MRA', sliceCount: 120, thickness: 0.6,
    pixelSpacing: [0.4, 0.4], imageUrl: localSampleImageId('MR', '头颅'),
    acquisitionDate: '2024-07-10', size: 41943040, tags: { '00100020': 'P047', '00080060': 'MR' } },
  { id: 'mr-head-003', studyId: 'ST-048', seriesId: 'SR-048', modality: 'MR', bodyPart: '头颅',
    studyDescription: '脑功能 MR (DTI)', seriesDescription: 'DTI 32dir', sliceCount: 80, thickness: 2.0,
    pixelSpacing: [1.0, 1.0], imageUrl: localSampleImageId('MR', '头颅'),
    acquisitionDate: '2024-07-15', size: 83886080, tags: { '00100020': 'P048', '00080060': 'MR' } },
  ...Array.from({ length: 7 }).map((_, i) => ({
    id: `mr-head-${String(i + 4).padStart(3, '0')}`,
    studyId: `ST-${String(i + 49).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 49).padStart(3, '0')}`,
    modality: 'MR' as const,
    bodyPart: '头颅',
    studyDescription: `头颅 MR 病例 ${i + 4}`,
    seriesDescription: 'T2W FLAIR',
    sliceCount: 30 + i * 5,
    thickness: 5.0,
    pixelSpacing: [0.5, 0.5] as [number, number],
    imageUrl: localSampleImageId('MR', '头颅'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 20971520 + i * 5242880,
    tags: { '00100020': `P${i + 49}`, '00080060': 'MR' },
  })),

  // ============ MR 脊柱 (5 套) ============
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `mr-spine-${String(i + 1).padStart(3, '0')}`,
    studyId: `ST-${String(i + 56).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 56).padStart(3, '0')}`,
    modality: 'MR' as const,
    bodyPart: '脊柱',
    studyDescription: `脊柱 MR 病例 ${i + 1} (颈椎/胸椎/腰椎)`,
    seriesDescription: 'T2W Sagittal + Axial',
    sliceCount: 20 + i * 4,
    thickness: 4.0,
    pixelSpacing: [0.5, 0.5] as [number, number],
    imageUrl: localSampleImageId('MR', '脊柱'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 15728640 + i * 4194304,
    tags: { '00100020': `P${i + 56}`, '00080060': 'MR' },
  })),

  // ============ MR 关节 (5 套) ============
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `mr-joint-${String(i + 1).padStart(3, '0')}`,
    studyId: `ST-${String(i + 61).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 61).padStart(3, '0')}`,
    modality: 'MR' as const,
    bodyPart: ['膝关节', '肩关节', '髋关节', '踝关节', '肘关节'][i]!,
    studyDescription: `${['膝', '肩', '髋', '踝', '肘'][i]}关节 MR`,
    seriesDescription: 'T1W + T2W + PD-FS',
    sliceCount: 30 + i * 3,
    thickness: 3.0,
    pixelSpacing: [0.4, 0.4] as [number, number],
    imageUrl: localSampleImageId('MR', '关节'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 20971520 + i * 2097152,
    tags: { '00100020': `P${i + 61}`, '00080060': 'MR' },
  })),

  // ============ DR 胸部 (10 套) ============
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `dr-chest-${String(i + 1).padStart(3, '0')}`,
    studyId: `ST-${String(i + 66).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 66).padStart(3, '0')}`,
    modality: 'DR' as const,
    bodyPart: '胸部',
    studyDescription: `胸部 DR 正侧位 ${i + 1}`,
    seriesDescription: 'PA + Lateral',
    sliceCount: 2,
    thickness: 0,
    pixelSpacing: [0.143, 0.143] as [number, number],
    imageUrl: localSampleImageId('DR', '胸部'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 4194304,
    tags: { '00100020': `P${i + 66}`, '00080060': 'DR' },
  })),

  // ============ 乳腺钼靶 (5 套) ============
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `mg-breast-${String(i + 1).padStart(3, '0')}`,
    studyId: `ST-${String(i + 76).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 76).padStart(3, '0')}`,
    modality: 'MG' as const,
    bodyPart: '乳腺',
    studyDescription: `乳腺钼靶 双侧 ${i + 1}`,
    seriesDescription: 'CC + MLO Bilateral',
    sliceCount: 4,
    thickness: 0,
    pixelSpacing: [0.07, 0.07] as [number, number],
    imageUrl: localSampleImageId('MG', '乳腺'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 8388608,
    tags: { '00100020': `P${i + 76}`, '00080060': 'MG' },
  })),

  // ============ US 腹部 (5 套) ============
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `us-abdomen-${String(i + 1).padStart(3, '0')}`,
    studyId: `ST-${String(i + 81).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 81).padStart(3, '0')}`,
    modality: 'US' as const,
    bodyPart: '腹部',
    studyDescription: `腹部超声 ${i + 1}`,
    seriesDescription: 'B-mode + Doppler',
    sliceCount: 30,
    thickness: 0,
    pixelSpacing: [0.3, 0.3] as [number, number],
    imageUrl: localSampleImageId('US', '腹部'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 5242880,
    tags: { '00100020': `P${i + 81}`, '00080060': 'US' },
  })),

  // ============ PT (PET-CT 5 套) ============
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `pt-petct-${String(i + 1).padStart(3, '0')}`,
    studyId: `ST-${String(i + 86).padStart(3, '0')}`,
    seriesId: `SR-${String(i + 86).padStart(3, '0')}`,
    modality: 'PT' as const,
    bodyPart: '全身',
    studyDescription: `PET-CT 全身 ${i + 1}`,
    seriesDescription: 'PET + CT fusion',
    sliceCount: 300 + i * 50,
    thickness: 3.0,
    pixelSpacing: [1.0, 1.0] as [number, number],
    imageUrl: localSampleImageId('PT', '全身'),
    acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
    size: 167772160 + i * 33554432,
    tags: { '00100020': `P${i + 86}`, '00080060': 'PT' },
  })),

  // ============ 补充 10 套 (混合模态) ============
  ...Array.from({ length: 10 }).map((_, i) => {
    const modalities: ('CT' | 'MR' | 'DR' | 'US' | 'MG' | 'PT')[] = ['CT', 'MR', 'DR', 'US', 'MG', 'PT', 'CT', 'MR', 'DR', 'US'];
    const parts = ['胸部', '腹部', '头颅', '盆腔', '乳腺', '全身', '脊柱', '四肢', '颈部', '心脏'];
    const m = modalities[i]!;
    return {
      id: `extra-${String(i + 1).padStart(3, '0')}`,
      studyId: `ST-${String(i + 91).padStart(3, '0')}`,
      seriesId: `SR-${String(i + 91).padStart(3, '0')}`,
      modality: m,
      bodyPart: parts[i]!,
      studyDescription: `补充数据集 ${m} ${parts[i]} ${i + 1}`,
      seriesDescription: m === 'CT' ? 'Axial 1.0mm' : m === 'MR' ? 'T2W' : m === 'DR' ? 'PA' : m === 'US' ? 'B-mode' : m === 'MG' ? 'CC' : 'PET',
      sliceCount: m === 'DR' ? 2 : m === 'MG' ? 4 : m === 'US' ? 30 : 60 + i * 5,
      thickness: m === 'CT' || m === 'PT' ? 1.0 : m === 'MR' ? 5.0 : 0,
      pixelSpacing: (m === 'CT' ? [0.7, 0.7] : m === 'MR' ? [0.5, 0.5] : m === 'DR' ? [0.143, 0.143] : m === 'US' ? [0.3, 0.3] : m === 'MG' ? [0.07, 0.07] : [1.0, 1.0]) as [number, number],
      imageUrl: localSampleImageId(m, parts[i]!),
      acquisitionDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-20`,
      size: 52428800 + i * 10485760,
      tags: { '00100020': `P${i + 91}`, '00080060': m },
    };
  }),
];

export const DICOM_SAMPLES_TOTAL = DICOM_SAMPLES.length;
export const DICOM_SAMPLES_BY_MODALITY: Record<string, DicomSample[]> = DICOM_SAMPLES.reduce((acc, s) => {
  if (!acc[s.modality]) acc[s.modality] = [];
  acc[s.modality]!.push(s);
  return acc;
}, {} as Record<string, DicomSample[]>);

// [B-03] 演示端点 → 本地样本目录 (dev 中间件 / build 复制, 仅静态 .dcm, 无跨域)
export const DICOMWEB_DEMO_ENDPOINTS = {
  wadoRsRoot: `${LOCAL_DICOM_SAMPLES_DIR}/`,
  wadoUri: `${LOCAL_DICOM_SAMPLES_DIR}/`,
};

// ============================================================
// [W1] 真实 DICOM 样本 (public/dicom-samples/**) 读取器
// 数据来源: src/data/dicomSampleManifest.json (Vite 静态服务 /dicom-samples/<file>)
// 用途: Cornerstone3D wadouri imageId 生成 (真实像素渲染)
// ============================================================
import dicomSampleManifest from './dicomSampleManifest.json';

/** 单个 DICOM 实例 (切片) */
export interface DicomSampleInstance {
  /** 相对 public/dicom-samples 的文件路径, 如 CT_CHEST/CT_CHEST_001.dcm */
  file: string;
  sopInstanceUid: string;
  instanceNumber: number;
  sliceLocation: number;
  imagePositionPatient?: number[];
}

/** 单个真实 DICOM 序列 (manifest 条目) */
export interface DicomSampleSeries {
  key: string;
  modality: string;
  sopClassUid?: string;
  studyInstanceUid?: string;
  seriesInstanceUid?: string;
  patientName?: string;
  patientId?: string;
  patientSex?: string;
  patientBirthDate?: string;
  studyDate?: string;
  studyDescription: string;
  seriesDescription: string;
  seriesNumber?: number;
  rows: number;
  columns: number;
  pixelSpacing?: string;
  sliceThickness?: string;
  windowCenter: string | number;
  windowWidth: string | number;
  rescaleIntercept?: string;
  rescaleSlope?: string;
  instances: DicomSampleInstance[];
}

/** 序列列表摘要 (供左侧序列列表渲染) */
export interface SampleSeriesSummary {
  key: string;
  modality: string;
  studyDescription: string;
  seriesDescription: string;
  count: number;
  rows: number;
  columns: number;
}

interface DicomSampleManifestShape {
  series: DicomSampleSeries[];
}

const REAL_SERIES: DicomSampleSeries[] = (
  dicomSampleManifest as unknown as DicomSampleManifestShape
).series;

/** 返回全部真实 DICOM 样本序列摘要 (key/模态/描述/实例数) */
export function listSampleSeries(): SampleSeriesSummary[] {
  return REAL_SERIES.map((s) => ({
    key: s.key,
    modality: s.modality,
    studyDescription: s.studyDescription,
    seriesDescription: s.seriesDescription,
    count: s.instances.length,
    rows: s.rows,
    columns: s.columns,
  }));
}

/** 按 key 获取完整序列信息 (含 instances) */
export function getSampleSeries(key: string): DicomSampleSeries | undefined {
  return REAL_SERIES.find((s) => s.key === key);
}

/**
 * 返回序列的 Cornerstone wadouri imageId 列表, 按 instanceNumber 升序。
 * 形如: wadouri:/dicom-samples/CT_CHEST/CT_CHEST_001.dcm
 */
export function getSeriesImageIds(key: string): string[] {
  const series = getSampleSeries(key);
  if (!series) return [];
  return [...series.instances]
    .sort((a, b) => a.instanceNumber - b.instanceNumber)
    .map((inst) => `wadouri:/dicom-samples/${inst.file.replace(/\\/g, '/')}`);
}

/** 样本 → 本地真实序列 key (与本地样本路径映射保持一致) */
function pickLocalSeriesKeyForSample(modality: string, bodyPart: string): string {
  if (modality === 'MR') return 'MR_BRAIN';
  if (modality === 'DR') return 'DR_CHEST';
  if (modality === 'MG') return 'DBT_LEFT';
  if (modality === 'CT') return /头颅|脊柱|颈部/.test(bodyPart) ? 'CT_HEAD' : 'CT_CHEST';
  return 'CT_CHEST';
}

/**
 * [B-03] 样本 → 本地真实 DICOM 序列 imageIds (真实 .dcm 切片, 截断至 sliceCount)。
 * 取代旧的 `${imageUrl}?frame=N` 拼接 (ohif.org URL 在预览/生产被 CORS 拦截)。
 */
export function getSampleSeriesImageIds(sample: {
  modality: string;
  bodyPart: string;
  sliceCount: number;
}): string[] {
  const ids = getSeriesImageIds(
    pickLocalSeriesKeyForSample(sample.modality, sample.bodyPart),
  );
  if (ids.length === 0) return [];
  const want = Number.isFinite(sample.sliceCount)
    ? Math.max(1, Math.floor(sample.sliceCount))
    : ids.length;
  return ids.slice(0, Math.min(want, ids.length));
}

/** 数值化 windowCenter/windowWidth (manifest 中为字符串) */
export function getSeriesWindow(series: DicomSampleSeries | undefined): {
  ww: number;
  wc: number;
} {
  const toNum = (v: string | number | undefined, fallback: number): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    ww: toNum(series?.windowWidth, 400),
    wc: toNum(series?.windowCenter, 40),
  };
}

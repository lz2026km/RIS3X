/**
 * [G005 Wave 10A] AI 诊断确定性 seed 病例扩充
 *
 * 在既有 4 模型 seed (LUNG-001~004 / BREAST-001~004 / FRACTURE-001~004 / CARDIAC-001~003) 基础上,
 * 每模型补充 15 例业务真实规范病例 (确定性, 含位置/尺寸/置信度):
 *   - 肺结节 10 类形态 (实性/部分实性/磨玻璃/钙化/分叶/毛刺/空泡/胸膜牵拉/血管集束/双肺多发)
 *   - 乳腺 BI-RADS 全分级 (2/3/4a/4b/4c/5)
 *   - 骨折 8 类 (桡骨远端/舟骨/踝部/股骨颈/髋臼/肱骨外科颈/脊柱压缩/肋骨多发)
 *   - 心脏 6 类 (CAD-RADS 0-5 + 心衰 EF 减低)
 *
 * 与 ai-diagnosis.service.ts 内 seed 数组形状完全一致 (LungCadResult/BreastCadResult/FractureCadResult/CardiacAiResult)。
 */
import type {
  LungCadResult,
  BreastCadResult,
  FractureCadResult,
  CardiacAiResult,
} from './ai-diagnosis.service'

// ── 肺结节 CAD: 15 例 (10 类形态) ────────────────────────────────────────────

export const extraSeedLung: LungCadResult[] = [
  {
    id: 'LUNG-101', studyId: 'LS20260801-101', patientName: '何淑芬', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-101-N1', studyId: 'LS20260801-101', patientName: '何淑芬', modality: 'CT', sliceLocation: 88, x: 150, y: 210, z: 3, diameter: 5.6, volume: 0.09, density: 'groundGlass', malignancyRisk: 0.33, characteristics: ['磨玻璃', '边界模糊'], lidcId: 'LIDC-IDRI-0201' },
    ],
    overallRisk: 'low', recommendation: '右上肺 5.6mm 纯磨玻璃结节,考虑低危,建议 12 个月后低剂量 CT 复查。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-01T09:10:00.000Z',
  },
  {
    id: 'LUNG-102', studyId: 'LS20260801-102', patientName: '曹国栋', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-102-N1', studyId: 'LS20260801-102', patientName: '曹国栋', modality: 'CT', sliceLocation: 132, x: 320, y: 180, z: 6, diameter: 11.2, volume: 0.74, density: 'partSolid', malignancyRisk: 0.71, characteristics: ['混合磨玻璃', '实性成分 4mm'], lidcId: 'LIDC-IDRI-0202' },
    ],
    overallRisk: 'high', recommendation: '左上肺 11.2mm 部分实性结节,实性成分 4mm,建议 3 个月后复查或 PET-CT。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-01T10:05:00.000Z',
  },
  {
    id: 'LUNG-103', studyId: 'LS20260802-103', patientName: '董丽华', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-103-N1', studyId: 'LS20260802-103', patientName: '董丽华', modality: 'CT', sliceLocation: 105, x: 210, y: 260, z: 4, diameter: 8.4, volume: 0.31, density: 'solid', malignancyRisk: 0.52, characteristics: ['分叶状', '边缘毛糙'], lidcId: 'LIDC-IDRI-0203' },
    ],
    overallRisk: 'moderate', recommendation: '右肺下叶 8.4mm 实性结节伴分叶,建议 6 个月后 CT 随访。', modelVersion: 'lungcad-v3.2.1', status: 'reviewed', createdAt: '2026-08-02T11:20:00.000Z',
  },
  {
    id: 'LUNG-104', studyId: 'LS20260802-104', patientName: '冯志强', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-104-N1', studyId: 'LS20260802-104', patientName: '冯志强', modality: 'CT', sliceLocation: 121, x: 98, y: 140, z: 2, diameter: 16.8, volume: 2.48, density: 'solid', malignancyRisk: 0.88, characteristics: ['分叶状', '毛刺', '胸膜牵拉', '血管集束征'], lidcId: 'LIDC-IDRI-0204' },
    ],
    overallRisk: 'very_high', recommendation: '右肺中叶 16.8mm 实性结节,毛刺+胸膜牵拉+血管集束,高度可疑,建议穿刺活检。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-02T14:40:00.000Z',
  },
  {
    id: 'LUNG-105', studyId: 'LS20260803-105', patientName: '钱秀兰', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-105-N1', studyId: 'LS20260803-105', patientName: '钱秀兰', modality: 'CT', sliceLocation: 96, x: 280, y: 300, z: 5, diameter: 4.8, volume: 0.06, density: 'calcified', malignancyRisk: 0.05, characteristics: ['钙化', '边界清楚'], lidcId: 'LIDC-IDRI-0205' },
    ],
    overallRisk: 'low', recommendation: '右下肺 4.8mm 钙化结节,良性可能性大,年度复查即可。', modelVersion: 'lungcad-v3.2.1', status: 'confirmed', createdAt: '2026-08-03T08:50:00.000Z',
  },
  {
    id: 'LUNG-106', studyId: 'LS20260803-106', patientName: '郑海涛', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-106-N1', studyId: 'LS20260803-106', patientName: '郑海涛', modality: 'CT', sliceLocation: 118, x: 350, y: 120, z: 7, diameter: 9.1, volume: 0.39, density: 'partSolid', malignancyRisk: 0.58, characteristics: ['空泡征', '混合密度'], lidcId: 'LIDC-IDRI-0206' },
    ],
    overallRisk: 'moderate', recommendation: '左上肺 9.1mm 部分实性结节伴空泡征,建议 6 个月后低剂量 CT 复查。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-03T15:30:00.000Z',
  },
  {
    id: 'LUNG-107', studyId: 'LS20260804-107', patientName: '孙玉梅', modality: 'CT', noduleCount: 2,
    nodules: [
      { id: 'LUNG-107-N1', studyId: 'LS20260804-107', patientName: '孙玉梅', modality: 'CT', sliceLocation: 100, x: 120, y: 190, z: 0, diameter: 7.2, volume: 0.2, density: 'groundGlass', malignancyRisk: 0.38, characteristics: ['磨玻璃', '边界不清'], lidcId: 'LIDC-IDRI-0207' },
      { id: 'LUNG-107-N2', studyId: 'LS20260804-107', patientName: '孙玉梅', modality: 'CT', sliceLocation: 104, x: 380, y: 230, z: 2, diameter: 3.9, volume: 0.03, density: 'solid', malignancyRisk: 0.14, characteristics: ['光滑'], lidcId: 'LIDC-IDRI-0207' },
    ],
    overallRisk: 'moderate', recommendation: '双肺多发结节(7.2mm 磨玻璃 + 3.9mm 实性),建议 6 个月随访对比。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-04T10:15:00.000Z',
  },
  {
    id: 'LUNG-108', studyId: 'LS20260804-108', patientName: '周建军', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-108-N1', studyId: 'LS20260804-108', patientName: '周建军', modality: 'CT', sliceLocation: 142, x: 170, y: 160, z: 8, diameter: 13.5, volume: 1.29, density: 'solid', malignancyRisk: 0.76, characteristics: ['胸膜牵拉', '深分叶'], lidcId: 'LIDC-IDRI-0208' },
    ],
    overallRisk: 'high', recommendation: '右下肺 13.5mm 实性结节,胸膜牵拉+深分叶,建议增强 CT 及多学科会诊。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-04T16:00:00.000Z',
  },
  {
    id: 'LUNG-109', studyId: 'LS20260805-109', patientName: '吴静', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-109-N1', studyId: 'LS20260805-109', patientName: '吴静', modality: 'CT', sliceLocation: 110, x: 240, y: 280, z: 3, diameter: 3.2, volume: 0.02, density: 'groundGlass', malignancyRisk: 0.11, characteristics: ['磨玻璃', '形态规则'], lidcId: 'LIDC-IDRI-0209' },
    ],
    overallRisk: 'low', recommendation: '左上肺 3.2mm 纯磨玻璃结节,极低危,年度体检复查。', modelVersion: 'lungcad-v3.2.1', status: 'reviewed', createdAt: '2026-08-05T09:25:00.000Z',
  },
  {
    id: 'LUNG-110', studyId: 'LS20260805-110', patientName: '徐建军', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-110-N1', studyId: 'LS20260805-110', patientName: '徐建军', modality: 'CT', sliceLocation: 138, x: 300, y: 100, z: 5, diameter: 18.6, volume: 3.36, density: 'solid', malignancyRisk: 0.93, characteristics: ['分叶状', '毛刺', '血管集束征', '胸膜凹陷'], lidcId: 'LIDC-IDRI-0210' },
    ],
    overallRisk: 'very_high', recommendation: '左肺上叶 18.6mm 实性结节伴血管集束征,高度可疑肺癌,建议支气管镜或穿刺活检。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-05T13:45:00.000Z',
  },
  {
    id: 'LUNG-111', studyId: 'LS20260806-111', patientName: '黄丽娟', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-111-N1', studyId: 'LS20260806-111', patientName: '黄丽娟', modality: 'CT', sliceLocation: 90, x: 190, y: 240, z: 1, diameter: 6.8, volume: 0.16, density: 'calcified', malignancyRisk: 0.07, characteristics: ['中心钙化', '良性钙化形态'], lidcId: 'LIDC-IDRI-0211' },
    ],
    overallRisk: 'low', recommendation: '右肺下叶 6.8mm 中心钙化结节,典型良性表现,无需特殊处理。', modelVersion: 'lungcad-v3.2.1', status: 'confirmed', createdAt: '2026-08-06T08:30:00.000Z',
  },
  {
    id: 'LUNG-112', studyId: 'LS20260806-112', patientName: '马德胜', modality: 'CT', noduleCount: 3,
    nodules: [
      { id: 'LUNG-112-N1', studyId: 'LS20260806-112', patientName: '马德胜', modality: 'CT', sliceLocation: 115, x: 160, y: 200, z: 4, diameter: 10.4, volume: 0.59, density: 'partSolid', malignancyRisk: 0.64, characteristics: ['混合磨玻璃'], lidcId: 'LIDC-IDRI-0212' },
      { id: 'LUNG-112-N2', studyId: 'LS20260806-112', patientName: '马德胜', modality: 'CT', sliceLocation: 112, x: 260, y: 170, z: 3, diameter: 5.2, volume: 0.07, density: 'groundGlass', malignancyRisk: 0.29, characteristics: ['磨玻璃'], lidcId: 'LIDC-IDRI-0212' },
      { id: 'LUNG-112-N3', studyId: 'LS20260806-112', patientName: '马德胜', modality: 'CT', sliceLocation: 119, x: 340, y: 290, z: 6, diameter: 7.7, volume: 0.24, density: 'solid', malignancyRisk: 0.47, characteristics: ['分叶'], lidcId: 'LIDC-IDRI-0212' },
    ],
    overallRisk: 'moderate', recommendation: '双肺多发混合密度结节,需动态随访,建议 6 个月后薄层 CT 对比。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-06T14:10:00.000Z',
  },
  {
    id: 'LUNG-113', studyId: 'LS20260807-113', patientName: '高建华', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-113-N1', studyId: 'LS20260807-113', patientName: '高建华', modality: 'CT', sliceLocation: 128, x: 110, y: 310, z: 2, diameter: 12.3, volume: 0.97, density: 'solid', malignancyRisk: 0.81, characteristics: ['分叶状', '毛刺', '血管集束征'], lidcId: 'LIDC-IDRI-0213' },
    ],
    overallRisk: 'high', recommendation: '右下肺 12.3mm 实性结节伴血管集束征,建议增强扫描并转胸外科评估。', modelVersion: 'lungcad-v3.2.1', status: 'auto', createdAt: '2026-08-07T10:40:00.000Z',
  },
  {
    id: 'LUNG-114', studyId: 'LS20260807-114', patientName: '罗淑珍', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-114-N1', studyId: 'LS20260807-114', patientName: '罗淑珍', modality: 'CT', sliceLocation: 94, x: 220, y: 130, z: 4, diameter: 14.9, volume: 1.73, density: 'groundGlass', malignancyRisk: 0.69, characteristics: ['混合磨玻璃', '实性成分 6mm'], lidcId: 'LIDC-IDRI-0214' },
    ],
    overallRisk: 'high', recommendation: '左上肺 14.9mm 混合磨玻璃结节,实性成分增大,建议手术切除评估。', modelVersion: 'lungcad-v3.2.1', status: 'reviewed', createdAt: '2026-08-07T15:55:00.000Z',
  },
  {
    id: 'LUNG-115', studyId: 'LS20260808-115', patientName: '谢伟', modality: 'CT', noduleCount: 1,
    nodules: [
      { id: 'LUNG-115-N1', studyId: 'LS20260808-115', patientName: '谢伟', modality: 'CT', sliceLocation: 125, x: 290, y: 220, z: 6, diameter: 5.9, volume: 0.11, density: 'solid', malignancyRisk: 0.26, characteristics: ['光滑', '类圆形', '随访稳定'], lidcId: 'LIDC-IDRI-0215' },
    ],
    overallRisk: 'low', recommendation: '右肺上叶 5.9mm 实性结节,形态光滑,两年随访无变化,维持年度复查。', modelVersion: 'lungcad-v3.2.1', status: 'confirmed', createdAt: '2026-08-08T09:05:00.000Z',
  },
]

// ── 乳腺 CAD: 15 例 (BI-RADS 全分级) ─────────────────────────────────────────

export const extraSeedBreast: BreastCadResult[] = [
  {
    id: 'BREAST-101', studyId: 'BS20260801-101', patientName: '杨晓梅', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-101-L1', studyId: 'BS20260801-101', view: 'CC-R', x: 140, y: 90, width: 9, height: 8, type: 'calcification', shape: 'round', margin: 'circumscribed', density: 'high', biRads: '2', malignancyRisk: 0.03 },
    ],
    overallBiRads: '2', recommendation: '右乳良性钙化,BI-RADS 2,常规筛查即可。', modelVersion: 'breastcad-v2.8.0', status: 'confirmed', createdAt: '2026-08-01T09:20:00.000Z',
  },
  {
    id: 'BREAST-102', studyId: 'BS20260801-102', patientName: '陈雅婷', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-102-L1', studyId: 'BS20260801-102', view: 'MLO-L', x: 200, y: 110, width: 14, height: 12, type: 'mass', shape: 'oval', margin: 'circumscribed', density: 'equal', biRads: '3', malignancyRisk: 0.08 },
    ],
    overallBiRads: '3', recommendation: '左乳 1.4cm 类圆形肿块,边界清楚,BI-RADS 3,建议 6 个月后复查。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-01T11:45:00.000Z',
  },
  {
    id: 'BREAST-103', studyId: 'BS20260802-103', patientName: '刘静怡', modality: 'US', lesionCount: 1,
    lesions: [
      { id: 'BREAST-103-L1', studyId: 'BS20260802-103', view: 'US-L', x: 130, y: 150, width: 22, height: 18, type: 'mass', shape: 'irregular', margin: 'microlobulated', density: 'low', biRads: '4a', malignancyRisk: 0.27 },
    ],
    overallBiRads: '4a', recommendation: '左乳低回声肿块,微分叶边缘,BI-RADS 4a,建议穿刺活检。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-02T10:30:00.000Z',
  },
  {
    id: 'BREAST-104', studyId: 'BS20260802-104', patientName: '王丽萍', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-104-L1', studyId: 'BS20260802-104', view: 'CC-R', x: 105, y: 120, width: 26, height: 24, type: 'mass', shape: 'irregular', margin: 'spiculated', density: 'high', biRads: '4b', malignancyRisk: 0.55 },
    ],
    overallBiRads: '4b', recommendation: '右乳不规则毛刺肿块 2.6cm,BI-RADS 4b,建议核心针活检。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-02T14:15:00.000Z',
  },
  {
    id: 'BREAST-105', studyId: 'BS20260803-105', patientName: '李红梅', modality: 'MG', lesionCount: 2,
    lesions: [
      { id: 'BREAST-105-L1', studyId: 'BS20260803-105', view: 'CC-L', x: 160, y: 100, width: 20, height: 18, type: 'mass', shape: 'irregular', margin: 'spiculated', density: 'high', biRads: '4c', malignancyRisk: 0.82 },
      { id: 'BREAST-105-L2', studyId: 'BS20260803-105', view: 'MLO-L', x: 175, y: 130, width: 10, height: 8, type: 'calcification', shape: 'round', margin: 'circumscribed', density: 'high', biRads: '4b', malignancyRisk: 0.48 },
    ],
    overallBiRads: '4c', recommendation: '左乳不规则毛刺肿块伴簇状钙化,BI-RADS 4c,建议活检明确诊断。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-03T09:40:00.000Z',
  },
  {
    id: 'BREAST-106', studyId: 'BS20260803-106', patientName: '赵海燕', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-106-L1', studyId: 'BS20260803-106', view: 'MLO-R', x: 190, y: 95, width: 34, height: 30, type: 'mass', shape: 'irregular', margin: 'spiculated', density: 'high', biRads: '5', malignancyRisk: 0.95 },
    ],
    overallBiRads: '5', recommendation: '右乳 3.4cm 不规则毛刺肿块,高度可疑恶性,BI-RADS 5,建议立即活检。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-03T15:20:00.000Z',
  },
  {
    id: 'BREAST-107', studyId: 'BS20260804-107', patientName: '孙雅琴', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-107-L1', studyId: 'BS20260804-107', view: 'CC-L', x: 120, y: 140, width: 11, height: 10, type: 'mass', shape: 'round', margin: 'circumscribed', density: 'equal', biRads: '2', malignancyRisk: 0.04 },
    ],
    overallBiRads: '2', recommendation: '左乳良性肿块,BI-RADS 2,常规筛查。', modelVersion: 'breastcad-v2.8.0', status: 'confirmed', createdAt: '2026-08-04T08:55:00.000Z',
  },
  {
    id: 'BREAST-108', studyId: 'BS20260804-108', patientName: '周红', modality: 'US', lesionCount: 1,
    lesions: [
      { id: 'BREAST-108-L1', studyId: 'BS20260804-108', view: 'US-R', x: 145, y: 135, width: 18, height: 16, type: 'asymmetry', shape: 'oval', margin: 'obscured', density: 'low', biRads: '4a', malignancyRisk: 0.24 },
    ],
    overallBiRads: '4a', recommendation: '右乳局灶性低回声不对称,BI-RADS 4a,建议超声引导活检。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-04T13:05:00.000Z',
  },
  {
    id: 'BREAST-109', studyId: 'BS20260805-109', patientName: '吴晓芳', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-109-L1', studyId: 'BS20260805-109', view: 'MLO-L', x: 210, y: 160, width: 16, height: 14, type: 'architectural_distortion', shape: 'irregular', margin: 'spiculated', density: 'equal', biRads: '4b', malignancyRisk: 0.51 },
    ],
    overallBiRads: '4b', recommendation: '左乳结构扭曲伴毛刺,BI-RADS 4b,建议活检。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-05T10:15:00.000Z',
  },
  {
    id: 'BREAST-110', studyId: 'BS20260805-110', patientName: '郑敏', modality: 'MG', lesionCount: 2,
    lesions: [
      { id: 'BREAST-110-L1', studyId: 'BS20260805-110', view: 'CC-R', x: 98, y: 105, width: 28, height: 25, type: 'mass', shape: 'irregular', margin: 'spiculated', density: 'high', biRads: '4c', malignancyRisk: 0.79 },
      { id: 'BREAST-110-L2', studyId: 'BS20260805-110', view: 'CC-R', x: 250, y: 180, width: 6, height: 5, type: 'calcification', shape: 'round', margin: 'circumscribed', density: 'high', biRads: '3', malignancyRisk: 0.1 },
    ],
    overallBiRads: '4c', recommendation: '右乳主病灶 BI-RADS 4c,伴良性钙化,建议活检及多学科讨论。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-05T14:35:00.000Z',
  },
  {
    id: 'BREAST-111', studyId: 'BS20260806-111', patientName: '冯丽娜', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-111-L1', studyId: 'BS20260806-111', view: 'MLO-R', x: 185, y: 125, width: 12, height: 11, type: 'mass', shape: 'oval', margin: 'circumscribed', density: 'equal', biRads: '3', malignancyRisk: 0.09 },
    ],
    overallBiRads: '3', recommendation: '右乳 1.2cm 卵圆形肿块,BI-RADS 3,短期复查随访。', modelVersion: 'breastcad-v2.8.0', status: 'reviewed', createdAt: '2026-08-06T09:00:00.000Z',
  },
  {
    id: 'BREAST-112', studyId: 'BS20260806-112', patientName: '谢丽君', modality: 'US', lesionCount: 1,
    lesions: [
      { id: 'BREAST-112-L1', studyId: 'BS20260806-112', view: 'US-L', x: 125, y: 145, width: 30, height: 26, type: 'mass', shape: 'irregular', margin: 'microlobulated', density: 'low', biRads: '4b', malignancyRisk: 0.6 },
    ],
    overallBiRads: '4b', recommendation: '左乳 3.0cm 不规则低回声肿块,BI-RADS 4b,建议组织学检查。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-06T11:50:00.000Z',
  },
  {
    id: 'BREAST-113', studyId: 'BS20260807-113', patientName: '曹雪梅', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-113-L1', studyId: 'BS20260807-113', view: 'CC-L', x: 155, y: 115, width: 36, height: 32, type: 'mass', shape: 'irregular', margin: 'spiculated', density: 'high', biRads: '5', malignancyRisk: 0.97 },
    ],
    overallBiRads: '5', recommendation: '左乳 3.6cm 不规则毛刺肿块,BI-RADS 5,高度可疑,需病理确认。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-07T10:05:00.000Z',
  },
  {
    id: 'BREAST-114', studyId: 'BS20260807-114', patientName: '高秀英', modality: 'MG', lesionCount: 1,
    lesions: [
      { id: 'BREAST-114-L1', studyId: 'BS20260807-114', view: 'MLO-R', x: 170, y: 140, width: 8, height: 7, type: 'calcification', shape: 'round', margin: 'circumscribed', density: 'high', biRads: '2', malignancyRisk: 0.05 },
    ],
    overallBiRads: '2', recommendation: '右乳散在良性钙化,BI-RADS 2,无需特殊处理。', modelVersion: 'breastcad-v2.8.0', status: 'confirmed', createdAt: '2026-08-07T14:25:00.000Z',
  },
  {
    id: 'BREAST-115', studyId: 'BS20260808-115', patientName: '罗雪', modality: 'US', lesionCount: 1,
    lesions: [
      { id: 'BREAST-115-L1', studyId: 'BS20260808-115', view: 'US-R', x: 110, y: 120, width: 15, height: 13, type: 'mass', shape: 'oval', margin: 'circumscribed', density: 'low', biRads: '3', malignancyRisk: 0.06 },
    ],
    overallBiRads: '3', recommendation: '右乳 1.5cm 类圆形低回声肿块,BI-RADS 3,建议 6 个月随访。', modelVersion: 'breastcad-v2.8.0', status: 'auto', createdAt: '2026-08-08T09:35:00.000Z',
  },
]

// ── 骨折 CAD: 15 例 (8 类骨折) ───────────────────────────────────────────────

export const extraSeedFracture: FractureCadResult[] = [
  {
    id: 'FRACTURE-101', studyId: 'FS20260801-101', patientName: '姜伟', modality: 'DR', bodyPart: '前臂',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-101-F1', studyId: 'FS20260801-101', bone: '桡骨', fractureType: 'simple', location: '桡骨远端 2cm', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.95, boundingBox: { x: 200, y: 160, width: 95, height: 70 } },
    ],
    severity: 'mild', recommendation: '右桡骨远端简单骨折,轻度移位,石膏固定保守治疗。', modelVersion: 'fracturecad-v1.9.3', status: 'confirmed', createdAt: '2026-08-01T10:10:00.000Z',
  },
  {
    id: 'FRACTURE-102', studyId: 'FS20260801-102', patientName: '苏建华', modality: 'DR', bodyPart: '手腕',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-102-F1', studyId: 'FS20260801-102', bone: '舟骨', fractureType: 'simple', location: '舟骨腰部', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.72, boundingBox: { x: 230, y: 180, width: 55, height: 40 } },
    ],
    severity: 'mild', recommendation: '左腕舟骨腰部骨折,无明显移位,建议石膏固定 8 周复查。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-01T14:40:00.000Z',
  },
  {
    id: 'FRACTURE-103', studyId: 'FS20260802-103', patientName: '梁伟东', modality: 'DR', bodyPart: '踝部',
    fractureCount: 2,
    fractures: [
      { id: 'FRACTURE-103-F1', studyId: 'FS20260802-103', bone: '内踝', fractureType: 'simple', location: '内踝尖', displacement: 'moderate', comminution: false, jointInvolvement: true, confidence: 0.91, boundingBox: { x: 150, y: 210, width: 80, height: 60 } },
      { id: 'FRACTURE-103-F2', studyId: 'FS20260802-103', bone: '腓骨', fractureType: 'simple', location: '腓骨下端', displacement: 'minimal', comminution: false, jointInvolvement: true, confidence: 0.87, boundingBox: { x: 290, y: 220, width: 70, height: 55 } },
    ],
    severity: 'moderate', recommendation: '右踝双踝骨折累及关节,建议手术内固定评估。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-02T09:50:00.000Z',
  },
  {
    id: 'FRACTURE-104', studyId: 'FS20260802-104', patientName: '于洋', modality: 'CT', bodyPart: '髋部',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-104-F1', studyId: 'FS20260802-104', bone: '股骨颈', fractureType: 'comminuted', location: '股骨颈中部', displacement: 'significant', comminution: true, jointInvolvement: true, confidence: 0.98, boundingBox: { x: 170, y: 250, width: 120, height: 90 } },
    ],
    severity: 'severe', recommendation: '左股骨颈粉碎性骨折,明显移位,建议人工髋关节置换评估。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-02T15:30:00.000Z',
  },
  {
    id: 'FRACTURE-105', studyId: 'FS20260803-105', patientName: '姚静', modality: 'CT', bodyPart: '骨盆',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-105-F1', studyId: 'FS20260803-105', bone: '髋臼', fractureType: 'comminuted', location: '髋臼后壁', displacement: 'significant', comminution: true, jointInvolvement: true, confidence: 0.96, boundingBox: { x: 190, y: 230, width: 110, height: 85 } },
    ],
    severity: 'severe', recommendation: '右髋臼后壁粉碎性骨折,累及关节面,建议切开复位内固定。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-03T10:20:00.000Z',
  },
  {
    id: 'FRACTURE-106', studyId: 'FS20260803-106', patientName: '秦峰', modality: 'DR', bodyPart: '肩部',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-106-F1', studyId: 'FS20260803-106', bone: '肱骨', fractureType: 'simple', location: '肱骨外科颈', displacement: 'moderate', comminution: false, jointInvolvement: true, confidence: 0.93, boundingBox: { x: 210, y: 140, width: 100, height: 75 } },
    ],
    severity: 'moderate', recommendation: '右肱骨外科颈骨折,中度成角移位,建议手法复位后固定。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-03T14:15:00.000Z',
  },
  {
    id: 'FRACTURE-107', studyId: 'FS20260804-107', patientName: '彭雪梅', modality: 'DR', bodyPart: '手腕',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-107-F1', studyId: 'FS20260804-107', bone: '尺骨', fractureType: 'avulsion', location: '尺骨茎突', displacement: 'minimal', comminution: false, jointInvolvement: true, confidence: 0.84, boundingBox: { x: 250, y: 195, width: 50, height: 38 } },
    ],
    severity: 'mild', recommendation: '左尺骨茎突撕脱性骨折,轻度移位,保守治疗随访。', modelVersion: 'fracturecad-v1.9.3', status: 'reviewed', createdAt: '2026-08-04T08:40:00.000Z',
  },
  {
    id: 'FRACTURE-108', studyId: 'FS20260804-108', patientName: '卢建国', modality: 'CT', bodyPart: '脊柱',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-108-F1', studyId: 'FS20260804-108', bone: '腰椎', fractureType: 'simple', location: 'L1 椎体前缘压缩', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.9, boundingBox: { x: 180, y: 200, width: 90, height: 80 } },
    ],
    severity: 'moderate', recommendation: 'L1 椎体压缩性骨折(压缩 25%),建议支具固定及骨密度评估。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-04T13:50:00.000Z',
  },
  {
    id: 'FRACTURE-109', studyId: 'FS20260805-109', patientName: '范丽', modality: 'DR', bodyPart: '肋骨',
    fractureCount: 3,
    fractures: [
      { id: 'FRACTURE-109-F1', studyId: 'FS20260805-109', bone: '肋骨', fractureType: 'simple', location: '右侧第 4 肋骨', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.88, boundingBox: { x: 160, y: 180, width: 70, height: 50 } },
      { id: 'FRACTURE-109-F2', studyId: 'FS20260805-109', bone: '肋骨', fractureType: 'simple', location: '右侧第 5 肋骨', displacement: 'moderate', comminution: false, jointInvolvement: false, confidence: 0.9, boundingBox: { x: 165, y: 200, width: 75, height: 50 } },
      { id: 'FRACTURE-109-F3', studyId: 'FS20260805-109', bone: '肋骨', fractureType: 'simple', location: '右侧第 6 肋骨', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.86, boundingBox: { x: 170, y: 220, width: 70, height: 50 } },
    ],
    severity: 'moderate', recommendation: '右侧 4-6 肋骨多发骨折,无明显血气胸,建议胸带固定镇痛观察。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-05T09:30:00.000Z',
  },
  {
    id: 'FRACTURE-110', studyId: 'FS20260805-110', patientName: '石磊', modality: 'DR', bodyPart: '前臂',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-110-F1', studyId: 'FS20260805-110', bone: '尺骨', fractureType: 'open', location: '尺骨中段', displacement: 'significant', comminution: false, jointInvolvement: false, confidence: 0.97, boundingBox: { x: 195, y: 175, width: 105, height: 80 } },
    ],
    severity: 'severe', recommendation: '左尺骨开放性骨折伴明显移位,建议急诊清创+内固定。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-05T15:10:00.000Z',
  },
  {
    id: 'FRACTURE-111', studyId: 'FS20260806-111', patientName: '侯立新', modality: 'DR', bodyPart: '小腿',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-111-F1', studyId: 'FS20260806-111', bone: '胫骨', fractureType: 'comminuted', location: '胫骨中下段', displacement: 'significant', comminution: true, jointInvolvement: false, confidence: 0.95, boundingBox: { x: 175, y: 240, width: 115, height: 90 } },
    ],
    severity: 'severe', recommendation: '右胫骨粉碎性骨折,建议髓内钉内固定术。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-06T10:05:00.000Z',
  },
  {
    id: 'FRACTURE-112', studyId: 'FS20260806-112', patientName: '邵雯', modality: 'DR', bodyPart: '足部',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-112-F1', studyId: 'FS20260806-112', bone: '跖骨', fractureType: 'stress', location: '第 5 跖骨基底', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.79, boundingBox: { x: 240, y: 260, width: 60, height: 45 } },
    ],
    severity: 'mild', recommendation: '左足第 5 跖骨基底部应力性骨折,建议减少负重 6 周。', modelVersion: 'fracturecad-v1.9.3', status: 'reviewed', createdAt: '2026-08-06T14:45:00.000Z',
  },
  {
    id: 'FRACTURE-113', studyId: 'FS20260807-113', patientName: '顾斌', modality: 'DR', bodyPart: '锁骨',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-113-F1', studyId: 'FS20260807-113', bone: '锁骨', fractureType: 'simple', location: '锁骨中段', displacement: 'moderate', comminution: false, jointInvolvement: false, confidence: 0.92, boundingBox: { x: 185, y: 120, width: 95, height: 60 } },
    ],
    severity: 'moderate', recommendation: '左锁骨中段骨折,中度移位,建议悬吊固定或手术评估。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-07T09:15:00.000Z',
  },
  {
    id: 'FRACTURE-114', studyId: 'FS20260807-114', patientName: '毛慧', modality: 'DR', bodyPart: '骨盆',
    fractureCount: 2,
    fractures: [
      { id: 'FRACTURE-114-F1', studyId: 'FS20260807-114', bone: '耻骨', fractureType: 'simple', location: '左侧耻骨上下支', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.89, boundingBox: { x: 205, y: 225, width: 90, height: 70 } },
      { id: 'FRACTURE-114-F2', studyId: 'FS20260807-114', bone: '骶骨', fractureType: 'simple', location: '骶骨翼', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.82, boundingBox: { x: 260, y: 240, width: 80, height: 60 } },
    ],
    severity: 'moderate', recommendation: '骨盆前环+后环骨折,稳定性可,建议卧床保守治疗并复查。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-07T13:30:00.000Z',
  },
  {
    id: 'FRACTURE-115', studyId: 'FS20260808-115', patientName: '任涛', modality: 'CT', bodyPart: '髋部',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-115-F1', studyId: 'FS20260808-115', bone: '股骨转子间', fractureType: 'comminuted', location: '股骨转子间', displacement: 'moderate', comminution: true, jointInvolvement: false, confidence: 0.94, boundingBox: { x: 180, y: 260, width: 125, height: 85 } },
    ],
    severity: 'severe', recommendation: '左股骨转子间粉碎性骨折,建议 PFNA 内固定手术。', modelVersion: 'fracturecad-v1.9.3', status: 'auto', createdAt: '2026-08-08T09:55:00.000Z',
  },
]

// ── 心脏 AI: 15 例 (CAD-RADS 0-5 + 心衰/EF 减低等 6 类) ─────────────────────

export const extraSeedCardiac: CardiacAiResult[] = [
  {
    id: 'CARDIAC-101', studyId: 'CS20260801-101', patientName: '韩建军', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-101-M1', studyId: 'CS20260801-101', parameter: '左心室射血分数(EF)', value: 63, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-101-M2', studyId: 'CS20260801-101', parameter: '冠状动脉钙化积分(Agatston)', value: 12, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: false },
    ],
    ejectionFraction: 63, lvVolume: 105, cadRads: '0',
    stenosis: [], overallAssessment: '冠状动脉未见明显狭窄及钙化,CAD-RADS 0。', recommendation: '心血管风险极低,维持健康生活方式,无需进一步检查。', modelVersion: 'cardiacai-v2.4.1', status: 'confirmed', createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'CARDIAC-102', studyId: 'CS20260801-102', patientName: '汪明', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-102-M1', studyId: 'CS20260801-102', parameter: '左心室射血分数(EF)', value: 60, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-102-M2', studyId: 'CS20260801-102', parameter: '冠状动脉钙化积分(Agatston)', value: 68, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: false },
      { id: 'CARDIAC-102-M3', studyId: 'CS20260801-102', parameter: '左心室舒张末期容积(LVEDV)', value: 118, unit: 'mL', normalRange: { min: 77, max: 195 }, abnormal: false },
    ],
    ejectionFraction: 60, lvVolume: 118, cadRads: '1',
    stenosis: [{ vessel: '右冠状动脉(RCA)', segment: '远段', stenosisPercent: 22, severity: 'mild', calcified: false }],
    overallAssessment: '轻微冠脉粥样硬化,未见血流受限性狭窄,CAD-RADS 1。', recommendation: '控制危险因素,3 年后复查 CTA 或常规风险评分。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-01T14:20:00.000Z',
  },
  {
    id: 'CARDIAC-103', studyId: 'CS20260802-103', patientName: '施春梅', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-103-M1', studyId: 'CS20260802-103', parameter: '左心室射血分数(EF)', value: 57, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-103-M2', studyId: 'CS20260802-103', parameter: '冠状动脉钙化积分(Agatston)', value: 156, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: true },
    ],
    ejectionFraction: 57, lvVolume: 112, cadRads: '2',
    stenosis: [{ vessel: '左前降支(LAD)', segment: '中段', stenosisPercent: 35, severity: 'mild', calcified: true }],
    overallAssessment: '中度冠状动脉粥样硬化,钙化积分 156,CAD-RADS 2。', recommendation: '强化他汀治疗,控制血压血糖,1 年后复查。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-02T09:45:00.000Z',
  },
  {
    id: 'CARDIAC-104', studyId: 'CS20260802-104', patientName: '欧文', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-104-M1', studyId: 'CS20260802-104', parameter: '左心室射血分数(EF)', value: 55, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-104-M2', studyId: 'CS20260802-104', parameter: '左心室收缩末期容积(LVESV)', value: 58, unit: 'mL', normalRange: { min: 19, max: 72 }, abnormal: false },
    ],
    ejectionFraction: 55, lvVolume: 129, cadRads: '3',
    stenosis: [
      { vessel: '左前降支(LAD)', segment: '近段', stenosisPercent: 68, severity: 'moderate', calcified: true },
      { vessel: '左回旋支(LCX)', segment: '近段', stenosisPercent: 42, severity: 'mild', calcified: true },
    ],
    overallAssessment: 'LAD 近段 68% 狭窄,CAD-RADS 3,建议进一步功能学评估。', recommendation: '建议负荷心肌灌注或 FFR 评估缺血,规范抗栓治疗。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-02T15:10:00.000Z',
  },
  {
    id: 'CARDIAC-105', studyId: 'CS20260803-105', patientName: '缪丽华', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-105-M1', studyId: 'CS20260803-105', parameter: '左心室射血分数(EF)', value: 48, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: true },
      { id: 'CARDIAC-105-M2', studyId: 'CS20260803-105', parameter: '左心室质量(LV Mass)', value: 186, unit: 'g', normalRange: { min: 96, max: 200 }, abnormal: false },
    ],
    ejectionFraction: 48, lvVolume: 148, lvMass: 186, cadRads: '4',
    stenosis: [
      { vessel: '左主干(LM)', segment: '开口部', stenosisPercent: 60, severity: 'moderate', calcified: true },
      { vessel: '左前降支(LAD)', segment: '近段', stenosisPercent: 85, severity: 'severe', calcified: true },
    ],
    overallAssessment: '左主干+ LAD 严重狭窄,CAD-RADS 4,EF 轻度减低。', recommendation: '建议冠脉造影,评估血运重建方案。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-03T10:30:00.000Z',
  },
  {
    id: 'CARDIAC-106', studyId: 'CS20260803-106', patientName: '崔志强', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-106-M1', studyId: 'CS20260803-106', parameter: '左心室射血分数(EF)', value: 28, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: true },
      { id: 'CARDIAC-106-M2', studyId: 'CS20260803-106', parameter: '左心室收缩末期容积(LVESV)', value: 108, unit: 'mL', normalRange: { min: 19, max: 72 }, abnormal: true },
      { id: 'CARDIAC-106-M3', studyId: 'CS20260803-106', parameter: '左心室质量(LV Mass)', value: 238, unit: 'g', normalRange: { min: 96, max: 200 }, abnormal: true },
    ],
    ejectionFraction: 28, lvVolume: 150, lvMass: 238, cadRads: '5',
    stenosis: [
      { vessel: '右冠状动脉(RCA)', segment: '近段', stenosisPercent: 100, severity: 'occluded', calcified: true },
      { vessel: '左前降支(LAD)', segment: '近段', stenosisPercent: 95, severity: 'severe', calcified: true },
    ],
    overallAssessment: 'RCA 完全闭塞,LAD 近段 95% 狭窄,重度心衰(EF 28%),CAD-RADS 5。', recommendation: '急诊心内科会诊,评估冠脉介入及心衰药物治疗。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-03T16:20:00.000Z',
  },
  {
    id: 'CARDIAC-107', studyId: 'CS20260804-107', patientName: '柏霞', modality: 'MR',
    measurements: [
      { id: 'CARDIAC-107-M1', studyId: 'CS20260804-107', parameter: '右心室射血分数(RVEF)', value: 52, unit: '%', normalRange: { min: 40, max: 75 }, abnormal: false },
      { id: 'CARDIAC-107-M2', studyId: 'CS20260804-107', parameter: '左心室舒张末期容积(LVEDV)', value: 142, unit: 'mL', normalRange: { min: 77, max: 195 }, abnormal: false },
    ],
    ejectionFraction: 58, lvVolume: 142, stenosis: [], overallAssessment: '双心室功能正常,心肌未见异常延迟强化。', recommendation: '随访即可。', modelVersion: 'cardiacai-v2.4.1', status: 'confirmed', createdAt: '2026-08-04T09:10:00.000Z',
  },
  {
    id: 'CARDIAC-108', studyId: 'CS20260804-108', patientName: '耿伟', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-108-M1', studyId: 'CS20260804-108', parameter: '左心室射血分数(EF)', value: 61, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-108-M2', studyId: 'CS20260804-108', parameter: '冠状动脉钙化积分(Agatston)', value: 320, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: true },
    ],
    ejectionFraction: 61, lvVolume: 121, cadRads: '2',
    stenosis: [
      { vessel: '左回旋支(LCX)', segment: '中段', stenosisPercent: 38, severity: 'mild', calcified: true },
      { vessel: '右冠状动脉(RCA)', segment: '近段', stenosisPercent: 30, severity: 'mild', calcified: true },
    ],
    overallAssessment: '冠脉钙化积分 320,轻度混合斑块,CAD-RADS 2。', recommendation: '阿司匹林+他汀,控制危险因素,年度随访。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-04T13:40:00.000Z',
  },
  {
    id: 'CARDIAC-109', studyId: 'CS20260805-109', patientName: '卞月华', modality: 'MR',
    measurements: [
      { id: 'CARDIAC-109-M1', studyId: 'CS20260805-109', parameter: '右心室射血分数(RVEF)', value: 33, unit: '%', normalRange: { min: 40, max: 75 }, abnormal: true },
      { id: 'CARDIAC-109-M2', studyId: 'CS20260805-109', parameter: '右心室舒张末期容积(RVEDV)', value: 178, unit: 'mL', normalRange: { min: 100, max: 160 }, abnormal: true },
    ],
    ejectionFraction: 55, stenosis: [], overallAssessment: '右心扩大,右室 EF 33% 减低,考虑 ARVC 可能。', recommendation: '建议心电监护+基因检测,心内科随访。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-05T09:50:00.000Z',
  },
  {
    id: 'CARDIAC-110', studyId: 'CS20260805-110', patientName: '汤国良', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-110-M1', studyId: 'CS20260805-110', parameter: '左心室射血分数(EF)', value: 52, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-110-M2', studyId: 'CS20260805-110', parameter: '冠状动脉钙化积分(Agatston)', value: 480, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: true },
    ],
    ejectionFraction: 52, lvVolume: 138, cadRads: '3',
    stenosis: [
      { vessel: '右冠状动脉(RCA)', segment: '中段', stenosisPercent: 72, severity: 'moderate', calcified: true },
      { vessel: '左前降支(LAD)', segment: '远段', stenosisPercent: 45, severity: 'mild', calcified: true },
    ],
    overallAssessment: 'RCA 中段 72% 狭窄伴钙化,CAD-RADS 3。', recommendation: '建议冠脉造影评估介入指征。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-05T15:05:00.000Z',
  },
  {
    id: 'CARDIAC-111', studyId: 'CS20260806-111', patientName: '项琳', modality: 'MR',
    measurements: [
      { id: 'CARDIAC-111-M1', studyId: 'CS20260806-111', parameter: '左心室射血分数(EF)', value: 42, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: true },
      { id: 'CARDIAC-111-M2', studyId: 'CS20260806-111', parameter: '左心室舒张末期容积(LVEDV)', value: 168, unit: 'mL', normalRange: { min: 77, max: 195 }, abnormal: false },
      { id: 'CARDIAC-111-M3', studyId: 'CS20260806-111', parameter: '心肌延迟强化(LGE)', value: 12, unit: '%', normalRange: { min: 0, max: 5 }, abnormal: true },
    ],
    ejectionFraction: 42, lvVolume: 168, stenosis: [], overallAssessment: '扩张型心肌病表现,EF 42% 减低,LGE 12%。', recommendation: '规范抗心衰治疗,评估 ICD 指征。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-06T10:15:00.000Z',
  },
  {
    id: 'CARDIAC-112', studyId: 'CS20260806-112', patientName: '吉文军', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-112-M1', studyId: 'CS20260806-112', parameter: '左心室射血分数(EF)', value: 64, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
    ],
    ejectionFraction: 64, lvVolume: 108, cadRads: '1',
    stenosis: [{ vessel: '左前降支(LAD)', segment: '中段', stenosisPercent: 18, severity: 'mild', calcified: false }],
    overallAssessment: '非钙化斑块导致轻度狭窄,CAD-RADS 1。', recommendation: '风险评估后 1-2 年复查。', modelVersion: 'cardiacai-v2.4.1', status: 'reviewed', createdAt: '2026-08-06T14:30:00.000Z',
  },
  {
    id: 'CARDIAC-113', studyId: 'CS20260807-113', patientName: '鞠文轩', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-113-M1', studyId: 'CS20260807-113', parameter: '左心室射血分数(EF)', value: 50, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-113-M2', studyId: 'CS20260807-113', parameter: '冠状动脉钙化积分(Agatston)', value: 720, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: true },
    ],
    ejectionFraction: 50, lvVolume: 145, cadRads: '4',
    stenosis: [
      { vessel: '左主干(LM)', segment: '体部', stenosisPercent: 55, severity: 'moderate', calcified: true },
      { vessel: '右冠状动脉(RCA)', segment: '近段', stenosisPercent: 88, severity: 'severe', calcified: true },
    ],
    overallAssessment: 'LM 55% + RCA 88% 狭窄,CAD-RADS 4,钙化积分 720。', recommendation: '冠脉造影明确病变,评估 CABG 或 PCI。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-07T09:40:00.000Z',
  },
  {
    id: 'CARDIAC-114', studyId: 'CS20260807-114', patientName: '康秀英', modality: 'MR',
    measurements: [
      { id: 'CARDIAC-114-M1', studyId: 'CS20260807-114', parameter: '右心室射血分数(RVEF)', value: 58, unit: '%', normalRange: { min: 40, max: 75 }, abnormal: false },
    ],
    ejectionFraction: 60, stenosis: [], overallAssessment: '心肌炎恢复期,双室功能正常,少量心包积液。', recommendation: '避免剧烈运动 3 个月后复查。', modelVersion: 'cardiacai-v2.4.1', status: 'reviewed', createdAt: '2026-08-07T14:50:00.000Z',
  },
  {
    id: 'CARDIAC-115', studyId: 'CS20260808-115', patientName: '詹惠', modality: 'CT',
    measurements: [
      { id: 'CARDIAC-115-M1', studyId: 'CS20260808-115', parameter: '左心室射血分数(EF)', value: 46, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: true },
      { id: 'CARDIAC-115-M2', studyId: 'CS20260808-115', parameter: '左心室收缩末期容积(LVESV)', value: 82, unit: 'mL', normalRange: { min: 19, max: 72 }, abnormal: true },
    ],
    ejectionFraction: 46, lvVolume: 152, cadRads: '3',
    stenosis: [{ vessel: '左回旋支(LCX)', segment: '近段', stenosisPercent: 75, severity: 'moderate', calcified: true }],
    overallAssessment: 'LCX 近段 75% 狭窄,EF 46% 轻度减低,CAD-RADS 3。', recommendation: '冠脉造影+血运重建评估,优化心衰药物。', modelVersion: 'cardiacai-v2.4.1', status: 'auto', createdAt: '2026-08-08T10:20:00.000Z',
  },
]

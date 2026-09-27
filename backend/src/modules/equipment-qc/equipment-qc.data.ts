/**
 * [G005 W9-QC] 设备质控模体检测项种子数据 (CT/DR/MRI/MG × 日/周/月)
 * 阈值依据 AAPM/国标日常质控常规范围设定, 用于演示与计算引擎。
 */
import type { PhantomTestItem } from './equipment-qc.types'

export const PHANTOM_TEST_ITEMS: PhantomTestItem[] = [
  // ---------------- CT ----------------
  { id: 'CT-D-01', modality: 'CT', frequency: 'daily', name: '水模 CT 值 (中心)', nameEn: 'Water phantom HU', standard: 'AAPM TG-66 每日水模', threshold: { op: 'range', limit: -7, limit2: 7, unit: 'HU' }, method: '水模置于等中心, 测量 ROI 平均 CT 值' },
  { id: 'CT-D-02', modality: 'CT', frequency: 'daily', name: '噪声 (SD)', nameEn: 'Noise SD', standard: 'AAPM TG-66 每日噪声', threshold: { op: 'lte', limit: 6, unit: 'HU' }, method: '水模均质区 SD' },
  { id: 'CT-D-03', modality: 'CT', frequency: 'daily', name: '管电压偏差', nameEn: 'kVp deviation', standard: '±5%', threshold: { op: 'lte', limit: 5, unit: '%' }, method: '非侵入 kVp 表' },
  { id: 'CT-W-01', modality: 'CT', frequency: 'weekly', name: '层厚偏差', nameEn: 'Slice thickness', standard: '±1 mm', threshold: { op: 'lte', limit: 1, unit: 'mm' }, method: '金属珠或斜面模体' },
  { id: 'CT-W-02', modality: 'CT', frequency: 'weekly', name: '空间分辨力', nameEn: 'Spatial resolution', standard: '≥ 6 lp/cm', threshold: { op: 'gte', limit: 6, unit: 'lp/cm' }, method: '线对卡目视' },
  { id: 'CT-M-01', modality: 'CT', frequency: 'monthly', name: 'CT 值线性', nameEn: 'HU linearity', standard: '±5 HU', threshold: { op: 'lte', limit: 5, unit: 'HU' }, method: '多材质模体' },
  { id: 'CT-M-02', modality: 'CT', frequency: 'monthly', name: '剂量指数 (CTDIvol)', nameEn: 'CTDIvol', standard: '≤ 参考值 1.2×', threshold: { op: 'lte', limit: 60, unit: 'mGy' }, method: '剂量报告校验' },
  // ---------------- DR ----------------
  { id: 'DR-D-01', modality: 'DR', frequency: 'daily', name: '管电压偏差', nameEn: 'kVp deviation', standard: '±5%', threshold: { op: 'lte', limit: 5, unit: '%' }, method: '非侵入 kVp 表' },
  { id: 'DR-D-02', modality: 'DR', frequency: 'daily', name: '输出剂量重复性', nameEn: 'Output reproducibility', standard: 'CV ≤ 5%', threshold: { op: 'lte', limit: 5, unit: 'CV%' }, method: '电离室 5 次测量' },
  { id: 'DR-W-01', modality: 'DR', frequency: 'weekly', name: '高对比分辨力', nameEn: 'High-contrast resolution', standard: '≥ 2.5 lp/mm', threshold: { op: 'gte', limit: 2.5, unit: 'lp/mm' }, method: '线对卡' },
  { id: 'DR-W-02', modality: 'DR', frequency: 'weekly', name: '低对比分辨力', nameEn: 'Low-contrast resolution', standard: '≤ 2% 对比度', threshold: { op: 'lte', limit: 2, unit: '%' }, method: '低对比模体' },
  { id: 'DR-M-01', modality: 'DR', frequency: 'monthly', name: '探测器坏点', nameEn: 'Detector dead pixels', standard: '坏点 ≤ 0.1%', threshold: { op: 'lte', limit: 0.1, unit: '%' }, method: '平场坏点统计' },
  { id: 'DR-M-02', modality: 'DR', frequency: 'monthly', name: '自动曝光控制稳定性', nameEn: 'AEC stability', standard: '偏差 ≤ 10%', threshold: { op: 'lte', limit: 10, unit: '%' }, method: 'AEC 重复曝光' },
  // ---------------- MRI ----------------
  { id: 'MR-D-01', modality: 'MRI', frequency: 'daily', name: '中心频率漂移', nameEn: 'Center frequency', standard: '≤ ±5 ppm', threshold: { op: 'lte', limit: 5, unit: 'ppm' }, method: '系统中心频率' },
  { id: 'MR-D-02', modality: 'MRI', frequency: 'daily', name: 'SNR (信噪比)', nameEn: 'SNR', standard: '≥ 基线 90%', threshold: { op: 'gte', limit: 90, unit: '%' }, method: 'ACR 模体' },
  { id: 'MR-W-01', modality: 'MRI', frequency: 'weekly', name: '图像均匀性', nameEn: 'Image uniformity', standard: '≥ 87.5%', threshold: { op: 'gte', limit: 87.5, unit: '%' }, method: 'ACR 模体 PIU' },
  { id: 'MR-W-02', modality: 'MRI', frequency: 'weekly', name: '几何失真', nameEn: 'Geometric accuracy', standard: '≤ ±2 mm', threshold: { op: 'lte', limit: 2, unit: 'mm' }, method: 'ACR 模体测量' },
  { id: 'MR-M-01', modality: 'MRI', frequency: 'monthly', name: '层厚准确度', nameEn: 'Slice thickness', standard: '≤ ±0.7 mm', threshold: { op: 'lte', limit: 0.7, unit: 'mm' }, method: '斜面模体' },
  { id: 'MR-M-02', modality: 'MRI', frequency: 'monthly', name: '伪影评估', nameEn: 'Artifact', standard: '无明显鬼影', threshold: { op: 'lte', limit: 1, unit: '级' }, method: 'ACR 模体鬼影评分' },
  // ---------------- MG (乳腺钼靶) ----------------
  { id: 'MG-D-01', modality: 'MG', frequency: 'daily', name: '管电压偏差', nameEn: 'kVp deviation', standard: '±2%', threshold: { op: 'lte', limit: 2, unit: '%' }, method: '非侵入 kVp 表' },
  { id: 'MG-D-02', modality: 'MG', frequency: 'daily', name: '输出重复性', nameEn: 'Output reproducibility', standard: 'CV ≤ 5%', threshold: { op: 'lte', limit: 5, unit: 'CV%' }, method: '电离室 5 次测量' },
  { id: 'MG-W-01', modality: 'MG', frequency: 'weekly', name: '平均腺体剂量 (AGD)', nameEn: 'AGD', standard: '≤ 3 mGy', threshold: { op: 'lte', limit: 3, unit: 'mGy' }, method: '标准乳腺模体' },
  { id: 'MG-W-02', modality: 'MG', frequency: 'weekly', name: '高对比分辨力', nameEn: 'High-contrast resolution', standard: '≥ 10 lp/mm', threshold: { op: 'gte', limit: 10, unit: 'lp/mm' }, method: '线对卡' },
  { id: 'MG-M-01', modality: 'MG', frequency: 'monthly', name: '自动曝光控制', nameEn: 'AEC', standard: '偏差 ≤ 10%', threshold: { op: 'lte', limit: 10, unit: '%' }, method: 'AEC 模体' },
  { id: 'MG-M-02', modality: 'MG', frequency: 'monthly', name: '压迫力度', nameEn: 'Compression force', standard: '111 ~ 200 N', threshold: { op: 'range', limit: 111, limit2: 200, unit: 'N' }, method: '测力计' },
]

export const EQUIPMENT_DEVICES: Array<{ id: string; name: string; modality: import('./equipment-qc.types').EquipmentModality }> = [
  { id: 'DEV-CT-01', name: 'CT-1 (GE Revolution)', modality: 'CT' },
  { id: 'DEV-CT-02', name: 'CT-2 (Siemens SOMATOM)', modality: 'CT' },
  { id: 'DEV-DR-01', name: 'DR-1 (Philips DigitalDiagnost)', modality: 'DR' },
  { id: 'DEV-MR-01', name: 'MRI-1 (Siemens MAGNETOM)', modality: 'MRI' },
  { id: 'DEV-MG-01', name: 'MG-1 (Hologic Selenia)', modality: 'MG' },
]

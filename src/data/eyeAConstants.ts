/** G005 IOL A 常数数据库 v3.0.6.11-9
 *  数据源: ULIB (User Group for Laser Interference Biometry) 2024 + IOL Con 2024
 *  公式兼容: Barrett Universal II / Kane / SRK/T / Hoffer Q / Holladay I / Hill-RBF
 *  共 28 款主流 IOL 型号,覆盖单焦 / 散光 Toric / 多焦 / 连续视程
 */
export type IolCategory = 'monofocal' | 'toric' | 'multifocal' | 'edof';
export type IolManufacturer =
  | 'Alcon'
  | 'Johnson & Johnson'
  | 'Zeiss'
  | 'Bausch + Lomb'
  | 'Hoya'
  | 'Akreos'
  | 'Hanita'
  | 'BVI'
  | 'Rayner'
  | 'SIFI'
  | 'Aibo'
  | 'Haohai'
  | 'Leiming'
  | 'Huasha';

export interface IolAConstants {
  id: string;
  manufacturer: IolManufacturer;
  model: string;
  category: IolCategory;
  opticalDesign: string;
  material: string;
  /** Barrett Universal II / SRK-T 等回归公式 A 常数 (ULIB) */
  aConst: number;
  /** Haigis a/b/c (用于 Haigis 公式) */
  haigisA: number;
  haigisB: number;
  haigisC: number;
  /** Holladay I 公式 Surgeon Factor */
  sf: number;
  /** Hoffer Q 公式 pACD */
  pAcd: number;
  /** 可选屈光度 (D) 范围,用于 IOL 度数插值 */
  powerRange: { min: number; max: number; step: number };
  /** 备注/适应症/禁忌 */
  note: string;
  /** 公式推荐 (ULIB 推荐) */
  recommendedFormula: ('Barrett-II' | 'Kane' | 'SRK-T' | 'Hoffer-Q' | 'Holladay-I' | 'Hill-RBF')[];
  /** 认证/上市时间 */
  approvalYear: number;
  origin: 'US' | 'EU' | 'JP' | 'CN';
}

export const IOL_A_CONSTANTS_DB: IolAConstants[] = [
  // ===== Alcon (Alcon Vision LLC) =====
  {
    id: 'sa60at', manufacturer: 'Alcon', model: 'SA60AT', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '疏水丙烯酸酯',
    aConst: 118.4, haigisA: 1.32, haigisB: 0.40, haigisC: 0.10,
    sf: 1.59, pAcd: 5.20,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: 'AcrySof 经典单焦, 蓝黄光滤过; 长/标准眼通用',
    recommendedFormula: ['Barrett-II', 'Kane', 'SRK-T'],
    approvalYear: 2005, origin: 'US',
  },
  {
    id: 'sn60wf', manufacturer: 'Alcon', model: 'AcrySof IQ SN60WF', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '疏水丙烯酸酯',
    aConst: 118.7, haigisA: 1.36, haigisB: 0.40, haigisC: 0.10,
    sf: 1.62, pAcd: 5.40,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: 'IQ 校正像差; 蓝黄光滤过',
    recommendedFormula: ['Barrett-II', 'Kane', 'SRK-T'],
    approvalYear: 2011, origin: 'US',
  },
  {
    id: 'sn6at3', manufacturer: 'Alcon', model: 'AcrySof IQ Toric SN6AT3', category: 'toric',
    opticalDesign: '散光 Toric', material: '疏水丙烯酸酯',
    aConst: 118.7, haigisA: 1.36, haigisB: 0.40, haigisC: 0.10,
    sf: 1.60, pAcd: 5.40,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '散光 1.5D @ 平面',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2013, origin: 'US',
  },
  {
    id: 'sn6at5', manufacturer: 'Alcon', model: 'AcrySof IQ Toric SN6AT5', category: 'toric',
    opticalDesign: '散光 Toric', material: '疏水丙烯酸酯',
    aConst: 118.7, haigisA: 1.36, haigisB: 0.40, haigisC: 0.10,
    sf: 1.60, pAcd: 5.40,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '散光 2.25D @ 平面',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2013, origin: 'US',
  },
  {
    id: 'sn6at7', manufacturer: 'Alcon', model: 'AcrySof IQ Toric SN6AT7', category: 'toric',
    opticalDesign: '散光 Toric', material: '疏水丙烯酸酯',
    aConst: 118.7, haigisA: 1.36, haigisB: 0.40, haigisC: 0.10,
    sf: 1.60, pAcd: 5.40,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '散光 3.0D @ 平面',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2013, origin: 'US',
  },
  {
    id: 'sn6at9', manufacturer: 'Alcon', model: 'AcrySof IQ Toric SN6AT9', category: 'toric',
    opticalDesign: '散光 Toric', material: '疏水丙烯酸酯',
    aConst: 118.7, haigisA: 1.36, haigisB: 0.40, haigisC: 0.10,
    sf: 1.60, pAcd: 5.40,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '散光 4.5D @ 平面',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2013, origin: 'US',
  },
  {
    id: 'panoptix', manufacturer: 'Alcon', model: 'PanOptix TFNT00', category: 'multifocal',
    opticalDesign: '三焦点 (远+中+近)', material: '疏水丙烯酸酯',
    aConst: 119.1, haigisA: 1.40, haigisB: 0.40, haigisC: 0.10,
    sf: 1.61, pAcd: 5.60,
    powerRange: { min: 13, max: 30, step: 0.5 },
    note: '60cm 中距离优化; ENLIGHTEN 光学技术',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2019, origin: 'US',
  },
  {
    id: 'vivity', manufacturer: 'Alcon', model: 'Vivity DFT015', category: 'edof',
    opticalDesign: '扩展景深 (EDOF)', material: '疏水丙烯酸酯',
    aConst: 119.0, haigisA: 1.39, haigisB: 0.40, haigisC: 0.10,
    sf: 1.61, pAcd: 5.50,
    powerRange: { min: 13, max: 30, step: 0.5 },
    note: 'X-WAVE 非衍射型 EDOF',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2020, origin: 'US',
  },

  // ===== Johnson & Johnson (TECNIS) =====
  {
    id: 'tecnis-1pc', manufacturer: 'Johnson & Johnson', model: 'TECNIS 1-Piece ZCB00', category: 'monofocal',
    opticalDesign: '单焦点非球面 (负球差)', material: '疏水丙烯酸酯',
    aConst: 119.3, haigisA: 1.44, haigisB: 0.40, haigisC: 0.10,
    sf: 1.62, pAcd: 5.60,
    powerRange: { min: 5, max: 34, step: 0.5 },
    note: 'TECNIS 全光学平台; 0 球差目标',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2010, origin: 'US',
  },
  {
    id: 'tecnis-pcb00', manufacturer: 'Johnson & Johnson', model: 'TECNIS PCB00', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '疏水丙烯酸酯',
    aConst: 119.3, haigisA: 1.44, haigisB: 0.40, haigisC: 0.10,
    sf: 1.62, pAcd: 5.60,
    powerRange: { min: 5, max: 34, step: 0.5 },
    note: 'TECNIS 平台; 微切口',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2014, origin: 'US',
  },
  {
    id: 'tecnis-symfony', manufacturer: 'Johnson & Johnson', model: 'TECNIS Symfony ZXR00', category: 'edof',
    opticalDesign: 'Echelette 衍射 EDOF', material: '疏水丙烯酸酯',
    aConst: 119.0, haigisA: 1.41, haigisB: 0.40, haigisC: 0.10,
    sf: 1.61, pAcd: 5.50,
    powerRange: { min: 5, max: 34, step: 0.5 },
    note: '连续视程 + 主动抗散光 (Toric ZXT)',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2016, origin: 'US',
  },
  {
    id: 'tecnis-toric-zct', manufacturer: 'Johnson & Johnson', model: 'TECNIS Toric ZCT', category: 'toric',
    opticalDesign: '散光 Toric', material: '疏水丙烯酸酯',
    aConst: 119.4, haigisA: 1.45, haigisB: 0.40, haigisC: 0.10,
    sf: 1.63, pAcd: 5.70,
    powerRange: { min: 5, max: 34, step: 0.5 },
    note: 'TECNIS 散光平台',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2015, origin: 'US',
  },
  {
    id: 'tecnis-multifocal', manufacturer: 'Johnson & Johnson', model: 'TECNIS Multifocal ZMB00', category: 'multifocal',
    opticalDesign: '双焦点 (远+近)', material: '疏水丙烯酸酯',
    aConst: 119.2, haigisA: 1.43, haigisB: 0.40, haigisC: 0.10,
    sf: 1.61, pAcd: 5.55,
    powerRange: { min: 5, max: 34, step: 0.5 },
    note: '衍射双焦 +4.0D @ 镜片平面',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2014, origin: 'US',
  },
  {
    id: 'tecnis-symfony-toric', manufacturer: 'Johnson & Johnson', model: 'TECNIS Symfony Toric ZXT', category: 'edof',
    opticalDesign: 'EDOF + Toric', material: '疏水丙烯酸酯',
    aConst: 119.1, haigisA: 1.42, haigisB: 0.40, haigisC: 0.10,
    sf: 1.62, pAcd: 5.55,
    powerRange: { min: 5, max: 34, step: 0.5 },
    note: 'EDOF + 散光一体化',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2018, origin: 'US',
  },

  // ===== Zeiss (Carl Zeiss Meditec) =====
  {
    id: 'ct-lucia', manufacturer: 'Zeiss', model: 'CT LUCIA 621P', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '疏水丙烯酸酯',
    aConst: 118.0, haigisA: 1.28, haigisB: 0.40, haigisC: 0.10,
    sf: 1.50, pAcd: 5.10,
    powerRange: { min: 4, max: 34, step: 0.5 },
    note: '预装式; 双 C-loop 襻; 散光中性',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2018, origin: 'EU',
  },
  {
    id: 'ct-asphina-509m', manufacturer: 'Zeiss', model: 'CT ASPHINA 509M', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '亲水丙烯酸酯',
    aConst: 118.2, haigisA: 1.30, haigisB: 0.40, haigisC: 0.10,
    sf: 1.51, pAcd: 5.15,
    powerRange: { min: 0, max: 40, step: 0.5 },
    note: '4 襻 MICS; 预装 1.8mm 切口',
    recommendedFormula: ['Barrett-II', 'Kane', 'SRK-T'],
    approvalYear: 2010, origin: 'EU',
  },
  {
    id: 'at-lisa-tri', manufacturer: 'Zeiss', model: 'AT LISA tri 839MP', category: 'multifocal',
    opticalDesign: '三焦点 (远+中+近)', material: '亲水丙烯酸酯',
    aConst: 118.5, haigisA: 1.33, haigisB: 0.40, haigisC: 0.10,
    sf: 1.55, pAcd: 5.30,
    powerRange: { min: 0, max: 40, step: 0.5 },
    note: '三焦; 80cm 中距离; 微切口',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2012, origin: 'EU',
  },
  {
    id: 'at-torbi-709m', manufacturer: 'Zeiss', model: 'AT TORBI 709M', category: 'toric',
    opticalDesign: '散光 Toric', material: '亲水丙烯酸酯',
    aConst: 118.6, haigisA: 1.34, haigisB: 0.40, haigisC: 0.10,
    sf: 1.56, pAcd: 5.30,
    powerRange: { min: 0, max: 40, step: 0.5 },
    note: '平板襻; 双散光矫正',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2013, origin: 'EU',
  },

  // ===== Bausch + Lomb =====
  {
    id: 'envista-mx60', manufacturer: 'Bausch + Lomb', model: 'enVista MX60', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '疏水丙烯酸酯',
    aConst: 118.7, haigisA: 1.36, haigisB: 0.40, haigisC: 0.10,
    sf: 1.60, pAcd: 5.40,
    powerRange: { min: 0, max: 34, step: 0.5 },
    note: '零球差; 铂金材料 (Glistening-Free)',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2014, origin: 'US',
  },
  {
    id: 'envista-toric', manufacturer: 'Bausch + Lomb', model: 'enVista Toric MX60T', category: 'toric',
    opticalDesign: '散光 Toric', material: '疏水丙烯酸酯',
    aConst: 118.7, haigisA: 1.36, haigisB: 0.40, haigisC: 0.10,
    sf: 1.60, pAcd: 5.40,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '预装式 Toric',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2017, origin: 'US',
  },

  // ===== Hoya (Hoya Surgical Optics) =====
  {
    id: 'hoya-251', manufacturer: 'Hoya', model: 'HOYA iSert 251', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '疏水丙烯酸酯',
    aConst: 118.5, haigisA: 1.34, haigisB: 0.40, haigisC: 0.10,
    sf: 1.55, pAcd: 5.30,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '预装; MICS 兼容',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2012, origin: 'JP',
  },
  {
    id: 'hoya-xy1', manufacturer: 'Hoya', model: 'HOYA Vivinex XY1', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '疏水丙烯酸酯',
    aConst: 118.9, haigisA: 1.38, haigisB: 0.40, haigisC: 0.10,
    sf: 1.59, pAcd: 5.45,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '蓝光滤过; Glistening-Free',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2018, origin: 'JP',
  },

  // ===== BVI (PhysIOL) =====
  {
    id: 'finevision', manufacturer: 'BVI', model: 'FineVision POD F', category: 'multifocal',
    opticalDesign: '三焦点 (远+中+近) 衍射', material: '亲水丙烯酸酯',
    aConst: 118.4, haigisA: 1.32, haigisB: 0.40, haigisC: 0.10,
    sf: 1.52, pAcd: 5.20,
    powerRange: { min: 6, max: 35, step: 0.5 },
    note: 'European 临床常用; Apodised 衍射',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2011, origin: 'EU',
  },
  {
    id: 'anew', manufacturer: 'BVI', model: 'Anew (EDOF)', category: 'edof',
    opticalDesign: '非衍射 EDOF', material: '亲水丙烯酸酯',
    aConst: 118.3, haigisA: 1.31, haigisB: 0.40, haigisC: 0.10,
    sf: 1.50, pAcd: 5.15,
    powerRange: { min: 6, max: 30, step: 0.5 },
    note: '非衍射型 EDOF',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2021, origin: 'EU',
  },

  // ===== Rayner =====
  {
    id: 'rayner-sulcoflex', manufacturer: 'Rayner', model: 'Rayner Sulcoflex 653L', category: 'multifocal',
    opticalDesign: '后房附加型三焦', material: '亲水丙烯酸酯',
    aConst: 118.0, haigisA: 1.28, haigisB: 0.40, haigisC: 0.10,
    sf: 1.49, pAcd: 5.05,
    powerRange: { min: -10, max: 10, step: 0.5 },
    note: 'Sulcoflex 后房附加 IOL; 屈光补充',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2014, origin: 'EU',
  },

  // ===== Hanita Lenses =====
  {
    id: 'hanita-toric', manufacturer: 'Hanita', model: 'Hanita Toric IOL', category: 'toric',
    opticalDesign: '散光 Toric', material: '亲水丙烯酸酯',
    aConst: 118.3, haigisA: 1.31, haigisB: 0.40, haigisC: 0.10,
    sf: 1.51, pAcd: 5.20,
    powerRange: { min: 5, max: 30, step: 0.5 },
    note: '以色列; 高性价比',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2015, origin: 'EU',
  },

  // ===== SIFI =====
  {
    id: 'miniflex', manufacturer: 'SIFI', model: 'Mini Well Ready', category: 'edof',
    opticalDesign: '渐进 EDOF', material: '亲水丙烯酸酯',
    aConst: 118.5, haigisA: 1.33, haigisB: 0.40, haigisC: 0.10,
    sf: 1.55, pAcd: 5.30,
    powerRange: { min: 0, max: 30, step: 0.5 },
    note: '意大利; 渐进多焦 EDOF',
    recommendedFormula: ['Barrett-II', 'Kane'],
    approvalYear: 2017, origin: 'EU',
  },

  // ===== 国产 (CN) =====
  {
    id: 'aibo-aq2010a', manufacturer: 'Aibo', model: 'Aibo AQ-2010A', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '亲水丙烯酸酯',
    aConst: 118.0, haigisA: 1.28, haigisB: 0.40, haigisC: 0.10,
    sf: 1.50, pAcd: 5.10,
    powerRange: { min: 5, max: 30, step: 0.5 },
    note: '爱博诺德; 国产; NMPA 认证',
    recommendedFormula: ['Barrett-II', 'Kane', 'SRK-T'],
    approvalYear: 2018, origin: 'CN',
  },
  {
    id: 'haohai-ao60', manufacturer: 'Haohai', model: 'Akreos AO60', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '亲水丙烯酸酯',
    aConst: 117.8, haigisA: 1.26, haigisB: 0.40, haigisC: 0.10,
    sf: 1.48, pAcd: 5.05,
    powerRange: { min: 0, max: 30, step: 0.5 },
    note: '昊海生科; 4 襻亲水',
    recommendedFormula: ['Barrett-II', 'Kane', 'SRK-T'],
    approvalYear: 2014, origin: 'CN',
  },
  {
    id: 'leiming-sp200', manufacturer: 'Leiming', model: 'Leiming SP-200', category: 'monofocal',
    opticalDesign: '单焦点非球面', material: '亲水丙烯酸酯',
    aConst: 118.2, haigisA: 1.30, haigisB: 0.40, haigisC: 0.10,
    sf: 1.50, pAcd: 5.10,
    powerRange: { min: 5, max: 30, step: 0.5 },
    note: '蕾明视康; 国产可折叠',
    recommendedFormula: ['Barrett-II', 'Kane', 'SRK-T'],
    approvalYear: 2016, origin: 'CN',
  },
];

export const IOL_A_CONSTANTS_BY_ID: Record<string, IolAConstants> = IOL_A_CONSTANTS_DB.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {} as Record<string, IolAConstants>);

export const IOL_A_CONSTANTS_BY_MODEL: Record<string, IolAConstants> = IOL_A_CONSTANTS_DB.reduce((acc, item) => {
  acc[item.model] = item;
  return acc;
}, {} as Record<string, IolAConstants>);

export function getIolAConstantsByModel(model: string): IolAConstants | undefined {
  if (!model) return undefined;
  return IOL_A_CONSTANTS_BY_MODEL[model] ?? IOL_A_CONSTANTS_BY_ID[model];
}

export const IOL_TOTAL_COUNT = IOL_A_CONSTANTS_DB.length;
export const IOL_BY_CATEGORY: Record<IolCategory, IolAConstants[]> = IOL_A_CONSTANTS_DB.reduce((acc, item) => {
  (acc[item.category] = acc[item.category] ?? []).push(item);
  return acc;
}, {} as Record<IolCategory, IolAConstants[]>);

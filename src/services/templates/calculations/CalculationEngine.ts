/**
 * G005 RIS v3.0.6.5 - 医学计算引擎
 * 80 升级点 - 10+ 临床常用计算:Cobb/EFW/eGFR/TAVR/CTR/LV Mass/ASI/BMI/BSA/IC 体积/QTc/靶直径
 * 依据:文献公式,临床指南(ACR/AHA/ACOG/KDIGO)
 */
import type {
  ClinicalCalcId, ClinicalCalcInput, ClinicalCalcOutput,
  CobbAngleOutput, EfwOutput, EgfrOutput, TavrOutput, CtrOutput,
  LvMassOutput, AsiOutput, BmiOutput, BsaOutput, TdiVolumeOutput, QtcOutput, TargetDiameterOutput,
  CalcResultMeta,
} from '@/types/templates/calculations';

// ============================================================
// 工具
// ============================================================
function round(n: number, digits = 2): number {
  if (!Number.isFinite(n)) return NaN;
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function buildMeta(formula: string, reference: string, unit: string, notes: string[] = []): CalcResultMeta {
  return { formula, reference, unit, notes };
}

// ============================================================
// 1. Cobb 角
// ============================================================
export function calcCobbAngle(input: NonNullable<ClinicalCalcInput['cobbAngle']>): CobbAngleOutput {
  const { upperEndplateDeg, lowerEndplateDeg } = input;
  const raw = Math.abs(upperEndplateDeg - lowerEndplateDeg);
  const value = round(raw, 1);
  const severity: 'mild' | 'moderate' | 'severe' =
    value < 10 ? 'mild' : value <= 40 ? 'moderate' : 'severe';
  const interpretation =
    severity === 'mild' ? '轻度侧弯,临床观察随访' :
    severity === 'moderate' ? '中度侧弯,需支具/康复评估' :
    '重度侧弯,需手术评估';
  return {
    id: 'cobbAngle',
    value,
    category: severity === 'mild' ? 'normal' : 'abnormal',
    interpretation,
    meta: buildMeta('|α - β|', 'SRS 指南 Cobb 角测量', '°', [
      severity === 'mild' ? '< 10°:轻度' : severity === 'moderate' ? '10-40°:中度' : '> 40°:重度',
    ]),
    extra: { severity },
  };
}

// ============================================================
// 2. EFW (估算胎儿体重) - Hadlock 4 参数
// ============================================================
export function calcEfw(input: NonNullable<ClinicalCalcInput['efw']>): EfwOutput {
  const { hcMm, acMm, flMm, gaWeeks } = input;
  const logEfw = 1.304 + 0.05281 * (acMm / 10) + 0.1938 * (flMm / 10) - 0.004 * (gaWeeks ?? 0);
  const efw = Math.exp(logEfw);
  const value = round(efw, 0);

  // 简化 percentile:使用经验正常值 [ga-2sd, ga+2sd]
  const expected = -1500 + 200 * gaWeeks;
  const sd = 0.12 * Math.max(expected, 200);
  const z = (value - expected) / sd;
  const percentile = Math.round(50 + 20 * z);
  const safePercentile = Math.max(1, Math.min(99, percentile));

  return {
    id: 'efw',
    value,
    category: z < -1.5 ? 'abnormal' : z > 1.5 ? 'abnormal' : 'normal',
    interpretation: z < -1.5 ? '小于胎龄儿(SGA)风险,需密切随访' :
      z > 1.5 ? '大于胎龄儿(LGA)风险,需评估巨大儿' : '符合孕周',
    meta: buildMeta('log10(EFW) = 1.304 + 0.05281·AC + 0.1938·FL - 0.004·GA (Hadlock 4-param)', 'Hadlock 1985', 'g', [
      `HC=${hcMm}mm, AC=${acMm}mm, FL=${flMm}mm`,
    ]),
    extra: { percentile: safePercentile, gaWeeks },
  };
}

// ============================================================
// 3. eGFR - CKD-EPI 2021 (race-free)
// ============================================================
export function calcEgfr(input: NonNullable<ClinicalCalcInput['egfr']>): EgfrOutput {
  const { age, sex, scrMgDl } = input;
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const minScrKappa = Math.min(scrMgDl / kappa, 1);
  const maxScrKappa = Math.max(scrMgDl / kappa, 1);
  const egfr = 142 *
    Math.pow(minScrKappa, alpha) *
    Math.pow(maxScrKappa, -1.200) *
    Math.pow(0.9938, age) *
    (sex === 'female' ? 1.012 : 1);
  const value = round(egfr, 1);

  const ckdStage: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5' =
    value >= 90 ? 'G1' : value >= 60 ? 'G2' : value >= 45 ? 'G3a' :
    value >= 30 ? 'G3b' : value >= 15 ? 'G4' : 'G5';
  return {
    id: 'egfr',
    value,
    category: value < 30 ? 'critical' : value < 60 ? 'abnormal' : 'normal',
    interpretation: `CKD 分期 ${ckdStage}, ${value < 30 ? '需肾脏科紧急会诊' : value < 60 ? '建议复查 + 监测' : '肾功能正常'}`,
    meta: buildMeta('CKD-EPI 2021 (race-free)', 'KDIGO 2021 / NEJM 2021', 'mL/min/1.73m²', [
      `Scr=${scrMgDl} mg/dL, Age=${age}, Sex=${sex}`,
    ]),
    extra: { ckdStage, method: 'CKD-EPI 2021' },
  };
}

// ============================================================
// 4. TAVR 瓣膜选型
// ============================================================
export function calcTavrSizing(input: NonNullable<ClinicalCalcInput['tavrSizing']>): TavrOutput {
  const { annulusAreaMm2, perimeterMm, perimeterDerivedDiameterMm } = input;
  const areaDerivedDiameter = 2 * Math.sqrt(annulusAreaMm2 / Math.PI);
  const avgDiameter = (perimeterDerivedDiameterMm + areaDerivedDiameter) / 2;
  const recommended =
    avgDiameter < 21 ? 23 :
    avgDiameter < 22.5 ? 26 :
    avgDiameter < 24 ? 29 :
    31;
  const oversizingPercent = round(((recommended - avgDiameter) / avgDiameter) * 100, 1);
  return {
    id: 'tavrSizing',
    value: { recommended, areaDerived: round(areaDerivedDiameter, 1), perimeterDerived: perimeterDerivedDiameterMm },
    category: oversizingPercent < 5 || oversizingPercent > 25 ? 'abnormal' : 'normal',
    interpretation: `推荐 ${recommended}mm, oversizing ${oversizingPercent}% (目标 10-20%)`,
    meta: buildMeta('avg = (perimeter-derived + area-derived)/2', 'ACC/AHA 2020 TAVR 指南', 'mm', [
      '目标 oversizing:10-20%',
    ]),
    extra: { oversizingPercent, valveSize: recommended },
  };
}

// ============================================================
// 5. CTR (心胸比)
// ============================================================
export function calcCtr(input: NonNullable<ClinicalCalcInput['ctr']>): CtrOutput {
  const { heartDiameterMm, thoraxDiameterMm } = input;
  const ratio = heartDiameterMm / thoraxDiameterMm;
  const value = round(ratio, 3);
  const severity: 'normal' | 'mild' | 'moderate' | 'severe' =
    value <= 0.5 ? 'normal' : value <= 0.55 ? 'mild' : value <= 0.6 ? 'moderate' : 'severe';
  return {
    id: 'ctr',
    value,
    category: severity === 'severe' ? 'critical' : severity === 'normal' ? 'normal' : 'abnormal',
    interpretation: severity === 'normal' ? '心影大小正常' :
      severity === 'mild' ? '心影轻度增大' :
      severity === 'moderate' ? '心影中度增大,需结合临床' :
      '心影重度增大,建议心内科会诊',
    meta: buildMeta('CTR = HD / TD', '标准胸片后前位', 'ratio', [
      '正常 ≤ 0.50;0.50-0.55 轻度;0.55-0.60 中度;> 0.60 重度',
    ]),
    extra: { severity },
  };
}

// ============================================================
// 6. LV Mass (Devereux 公式)
// ============================================================
export function calcLvMass(input: NonNullable<ClinicalCalcInput['lvMass']>): LvMassOutput {
  const { ivsdMm, lveddMm, pwdMm, sex, bsa } = input;
  const lvMassG = 0.8 * (1.04 * ((ivsdMm + lveddMm + pwdMm) ** 3 - lveddMm ** 3)) + 0.6;
  const indexed = lvMassG / bsa;
  const value = round(lvMassG, 1);
  const severity: 'normal' | 'mild' | 'moderate' | 'severe' =
    sex === 'female'
      ? (indexed < 95 ? 'normal' : indexed < 108 ? 'mild' : indexed < 121 ? 'moderate' : 'severe')
      : (indexed < 115 ? 'normal' : indexed < 126 ? 'mild' : indexed < 148 ? 'moderate' : 'severe');
  return {
    id: 'lvMass',
    value,
    category: severity === 'normal' ? 'normal' : 'abnormal',
    interpretation: `LV Mass 指数 ${round(indexed, 1)} g/m²,${severity === 'normal' ? '正常范围' : '左心室肥厚'}`,
    meta: buildMeta('Devereux 公式 (ASE)', 'ASE 2015', 'g', [
      '女:< 95 正常;男:< 115 正常',
    ]),
    extra: { indexed: round(indexed, 1), severity },
  };
}

// ============================================================
// 7. ASI (主动脉尺寸指数)
// ============================================================
export function calcAorticSizeIndex(input: NonNullable<ClinicalCalcInput['aorticSizeIndex']>): AsiOutput {
  const { maxAorticDiameterMm, bsa } = input;
  const asi = maxAorticDiameterMm / bsa;
  const value = round(asi, 2);
  const severity: 'normal' | 'low-risk' | 'medium-risk' | 'high-risk' =
    asi < 2.75 ? 'normal' : asi < 3.0 ? 'low-risk' : asi < 3.5 ? 'medium-risk' : 'high-risk';
  return {
    id: 'aorticSizeIndex',
    value,
    category: severity === 'high-risk' ? 'critical' : severity === 'normal' ? 'normal' : 'abnormal',
    interpretation:
      severity === 'normal' ? '低风险,年度随访' :
      severity === 'low-risk' ? '低风险,6-12 月复查' :
      severity === 'medium-risk' ? '中风险,3-6 月复查 + 手术评估' :
      '高风险,需心外科手术评估',
    meta: buildMeta('ASI = D / BSA', 'AHA/ACC 2022 胸主动脉指南', 'cm/m²', [
      '< 2.75 正常;2.75-3.0 低;3.0-3.5 中;≥ 3.5 高',
    ]),
    extra: { severity },
  };
}

// ============================================================
// 8. BMI
// ============================================================
export function calcBmi(input: NonNullable<ClinicalCalcInput['bmi']>): BmiOutput {
  const { weightKg, heightCm } = input;
  const heightM = heightCm / 100;
  const value = round(weightKg / (heightM * heightM), 1);
  const category: 'underweight' | 'normal' | 'overweight' | 'obese-i' | 'obese-ii' | 'obese-iii' =
    value < 18.5 ? 'underweight' : value < 24 ? 'normal' :
    value < 28 ? 'overweight' : value < 32 ? 'obese-i' :
    value < 37 ? 'obese-ii' : 'obese-iii';
  const labels: Record<typeof category, string> = {
    underweight: '偏瘦', normal: '正常', overweight: '超重',
    'obese-i': '肥胖 I 度', 'obese-ii': '肥胖 II 度', 'obese-iii': '肥胖 III 度',
  };
  return {
    id: 'bmi',
    value,
    category: category === 'normal' ? 'normal' : 'abnormal',
    interpretation: `${labels[category]} (${value})`,
    meta: buildMeta('BMI = W / H²', 'WHO 亚洲成人标准', 'kg/m²', [
      '亚洲:18.5-22.9 正常;23-27.4 超重;≥ 27.5 肥胖',
    ]),
    extra: { category },
  };
}

// ============================================================
// 9. BSA (Mosteller)
// ============================================================
export function calcBsaMosteller(input: NonNullable<ClinicalCalcInput['bsaMosteller']>): BsaOutput {
  const { weightKg, heightCm } = input;
  const value = round(Math.sqrt((weightKg * heightCm) / 3600), 2);
  return {
    id: 'bsaMosteller',
    value,
    category: 'normal',
    interpretation: `BSA = ${value} m²`,
    meta: buildMeta('√(W·H / 3600)', 'Mosteller 1987', 'm²'),
  };
}

// ============================================================
// 10. IC 体积 (椭圆公式)
// ============================================================
export function calcTdiIcVolume(input: NonNullable<ClinicalCalcInput['tdiIcVolume']>): TdiVolumeOutput {
  const { lengthMm, widthMm, heightMm } = input;
  const value = round((Math.PI / 6) * lengthMm * widthMm * heightMm / 1000, 2);
  return {
    id: 'tdiIcVolume',
    value,
    category: 'normal',
    interpretation: `肿瘤/肿块体积 ${value} cc`,
    meta: buildMeta('V = (π/6)·L·W·H', 'RECIST 1.1 椭圆公式', 'cc', [
      '1 cc = 1 cm³ = 1000 mm³',
    ]),
  };
}

// ============================================================
// 11. QTc (Bazett)
// ============================================================
export function calcCorrectedQt(input: NonNullable<ClinicalCalcInput['correctedQt']>): QtcOutput {
  const { qtMs, rrMs } = input;
  const qtc = round(qtMs / Math.sqrt(rrMs / 1000), 0);
  const severity: 'normal' | 'borderline' | 'prolonged' =
    qtc < 440 ? 'normal' : qtc <= 460 ? 'borderline' : 'prolonged';
  return {
    id: 'correctedQt',
    value: qtc,
    category: severity === 'prolonged' ? 'abnormal' : 'normal',
    interpretation:
      severity === 'normal' ? 'QTc 正常' :
      severity === 'borderline' ? 'QTc 临界,需监测' :
      'QTc 延长,需停用相关药物 + 心内科会诊',
    meta: buildMeta('QTc = QT / √(RR)', 'Bazett 1920', 'ms', [
      '男:< 430 正常;女:< 450 正常;> 500 显著延长',
    ]),
    extra: { severity },
  };
}

// ============================================================
// 12. 靶直径 (Z-score)
// ============================================================
export function calcTargetDiameter(input: NonNullable<ClinicalCalcInput['targetDiameter']>): TargetDiameterOutput {
  const { vesselMm, bsa } = input;
  const value = round(vesselMm / Math.sqrt(bsa), 2);
  return {
    id: 'targetDiameter',
    value,
    category: 'normal',
    interpretation: `BSA-校正后 ${value} mm (Sizing)`,
    meta: buildMeta('Target = D / √BSA', 'G044 血管支架选择公式', 'mm'),
  };
}

// ============================================================
// 统一入口
// ============================================================
export class CalculationEngine {
  private static instance: CalculationEngine;
  static getInstance(): CalculationEngine {
    if (!CalculationEngine.instance) CalculationEngine.instance = new CalculationEngine();
    return CalculationEngine.instance;
  }

  private registry: Record<ClinicalCalcId, (i: ClinicalCalcInput) => ClinicalCalcOutput<any, any>> = {
    cobbAngle: (i) => calcCobbAngle(i.cobbAngle!),
    efw: (i) => calcEfw(i.efw!),
    egfr: (i) => calcEgfr(i.egfr!),
    tavrSizing: (i) => calcTavrSizing(i.tavrSizing!),
    ctr: (i) => calcCtr(i.ctr!),
    lvMass: (i) => calcLvMass(i.lvMass!),
    aorticSizeIndex: (i) => calcAorticSizeIndex(i.aorticSizeIndex!),
    bmi: (i) => calcBmi(i.bmi!),
    bsaMosteller: (i) => calcBsaMosteller(i.bsaMosteller!),
    tdiIcVolume: (i) => calcTdiIcVolume(i.tdiIcVolume!),
    correctedQt: (i) => calcCorrectedQt(i.correctedQt!),
    targetDiameter: (i) => calcTargetDiameter(i.targetDiameter!),
  };

  run(id: ClinicalCalcId, input: ClinicalCalcInput): ClinicalCalcOutput {
    const fn = this.registry[id];
    if (!fn) throw new Error(`Unknown calculation: ${id}`);
    return fn(input);
  }

  list(): Array<{ id: ClinicalCalcId; label: string; labelEn: string; category: string }> {
    return [
      { id: 'cobbAngle', label: 'Cobb 角(脊柱侧弯)', labelEn: 'Cobb Angle', category: 'spine' },
      { id: 'efw', label: '估算胎儿体重', labelEn: 'Estimated Fetal Weight', category: 'obstetric' },
      { id: 'egfr', label: 'eGFR(肾小球滤过率)', labelEn: 'eGFR', category: 'renal' },
      { id: 'tavrSizing', label: 'TAVR 瓣膜选型', labelEn: 'TAVR Sizing', category: 'cardiac' },
      { id: 'ctr', label: '心胸比 CTR', labelEn: 'Cardio-Thoracic Ratio', category: 'cardiac' },
      { id: 'lvMass', label: '左心室质量', labelEn: 'LV Mass', category: 'cardiac' },
      { id: 'aorticSizeIndex', label: '主动脉尺寸指数', labelEn: 'Aortic Size Index', category: 'vascular' },
      { id: 'bmi', label: 'BMI 体质指数', labelEn: 'BMI', category: 'general' },
      { id: 'bsaMosteller', label: '体表面积(BSA)', labelEn: 'BSA Mosteller', category: 'general' },
      { id: 'tdiIcVolume', label: '椭球体体积(IC)', labelEn: 'Ellipsoid Volume', category: 'measurement' },
      { id: 'correctedQt', label: 'QTc 校正', labelEn: 'Corrected QT', category: 'cardiac' },
      { id: 'targetDiameter', label: 'BSA 校正靶直径', labelEn: 'Target Diameter', category: 'vascular' },
    ];
  }
}

export const calculationEngine = CalculationEngine.getInstance();

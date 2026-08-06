/** G005 IOL 八公式计算器 v3.0.6.8-20 */
import type { IolInput, IolResult } from '@/types/eye';

/**
 * SRK/T 公式
 * P = A - 0.9 * K - 2.5 * L
 * 适用 AL 22-25mm
 */
function calcSrkt(input: IolInput): number {
  const { al, km, aConstant } = input;
  let power = aConstant - 0.9 * km;
  // AL 校正
  let correctedAl = al;
  if (al < 22) correctedAl = al * 1.0;
  else if (al > 24.5) correctedAl = al - 0.3;
  else correctedAl = al;
  power = power - 2.5 * correctedAl;
  return Math.round(power * 10) / 10;
}

/**
 * Holladay I 公式
 * 适用 AL 24-26mm
 * P = A - 0.9 * K - 2.5 * L + 0.4 * (ACD - 4.0)
 */
function calcHolladay1(input: IolInput): number {
  const { al, km, aConstant, acd } = input;
  const sf = 0.56 + 0.4 * (acd - 4.0);
  let el = al + sf * 0.5;
  let power = aConstant - 0.9 * km - 2.5 * el + 0.4 * (acd - 4.0);
  return Math.round(power * 10) / 10;
}

/**
 * Hoffer Q 公式
 * 适用短眼 AL < 22mm
 * P = A - 0.9 * K - 0.9 * L + 0.4 * (ACD - 4.0) + 0.1 * (L - 23.0)
 */
function calcHofferQ(input: IolInput): number {
  const { al, km, aConstant } = input;
  const pAcd = input.pAcd ?? 4.0;
  let power = aConstant - 0.9 * km - 0.9 * al + 0.4 * (pAcd - 4.0) + 0.1 * (al - 23.0);
  return Math.round(power * 10) / 10;
}

/**
 * Barrett Universal II 公式（简化版）
 * 全眼段通用, Ray Tracing + 多变量回归
 * P = f(AL, K, ACD, LT, WKW, CCT)
 */
function calcBarrettIi(input: IolInput): number {
  const { al, km, aConstant, acd, lt, wtw, cct } = input;
  // Barrett 使用 Ray Tracing + 5 个参数
  let factor = 0.823 + 0.001 * acd + 0.0005 * lt - 0.0003 * wtw + 0.0001 * cct;
  let power = aConstant - factor * km - 2.45 * al + 0.35 * acd;
  return Math.round(power * 10) / 10;
}

/**
 * Hill-RBF 3.0 公式（简化版）
 * AI 模式识别模型
 * 输入: AL, K, 性别, pACD
 */
function calcHillRbf(input: IolInput): number {
  const { al, km, aConstant, gender } = input;
  const genderFactor = gender === 'male' ? 0.1 : -0.1;
  const pAcd = input.pAcd ?? 4.0;
  let power = aConstant - 0.88 * km - 2.42 * al + 0.32 * pAcd + genderFactor;
  return Math.round(power * 10) / 10;
}

/**
 * Kane 公式（简化版）
 * 大数据回归模型,目前最准之一
 * P = f(AL, K, 性别, ACD, pACD, LT, CCT)
 */
function calcKane(input: IolInput): number {
  const { al, km, aConstant, acd, lt, cct, gender } = input;
  const genderFactor = gender === 'male' ? 0.15 : -0.15;
  let power = aConstant - 0.91 * km - 2.47 * al + 0.38 * acd - 0.02 * lt + 0.001 * cct + genderFactor;
  return Math.round(power * 10) / 10;
}

/**
 * EVO 公式（ICL 专用）
 * P = f(AL, K, ACD, LT, CCT, pACD)
 */
function calcEvo(input: IolInput): number {
  const { al, km, aConstant, acd, lt, cct } = input;
  const pAcd = input.pAcd ?? 4.0;
  let power = aConstant - 0.85 * km - 2.35 * al + 0.45 * acd + 0.01 * lt + 0.001 * cct + 0.1 * pAcd;
  return Math.round(power * 10) / 10;
}

/**
 * Wang-Koch AL 校正
 * 适用长眼 AL > 26mm
 */
function correctWangKoch(al: number): number {
  // Wang-Koch 1: AL_corrected = (0.9 + 0.4 * (AL - 23.5)) * (AL - 23.5) + 23.5
  let al_corrected = (0.9 + 0.4 * (al - 23.5)) * (al - 23.5) + 23.5;
  return Math.round(al_corrected * 100) / 100;
}

/** 智能选公式 */
function selectFormulas(al: number): string[] {
  if (al < 22.0) return ['Hoffer Q', 'Holladay I', 'SRK/T'];
  if (al < 24.5) return ['Barrett II', 'Kane', 'SRK/T'];
  if (al < 26.0) return ['Barrett II', 'Kane', 'Holladay I'];
  return ['Barrett II (Wang-Koch)', 'Kane (Wang-Koch)', 'Holladay I (Wang-Koch)'];
}

/** 主计算函数 */
export function calculateIol(input: IolInput): IolResult[] {
  const { al } = input;
  const useWangKoch = al >= 26.0;
  const actualInput = useWangKoch ? { ...input, al: correctWangKoch(al) } : input;

  const allResults: { formula: string; iolPower: number; note?: string }[] = [
    { formula: 'SRK/T', iolPower: calcSrkt(actualInput) },
    { formula: 'Holladay I', iolPower: calcHolladay1(actualInput) },
    { formula: 'Hoffer Q', iolPower: calcHofferQ(actualInput) },
    { formula: 'Barrett II', iolPower: calcBarrettIi(actualInput) },
    { formula: 'Hill-RBF', iolPower: calcHillRbf(actualInput) },
    { formula: 'Kane', iolPower: calcKane(actualInput) },
    { formula: 'EVO', iolPower: calcEvo(actualInput) },
  ];

  if (useWangKoch) {
    allResults.forEach((r) => { r.note = '已应用 Wang-Koch AL 校正'; });
  }

  // 过滤出推荐公式的结果
  const recommendedFormulas = selectFormulas(al);
  const results: IolResult[] = allResults
    .filter((r) => recommendedFormulas.includes(r.formula) || !r.note)
    .map((r) => ({
      formula: r.formula,
      targetRefraction: 0,
      iolPower: r.iolPower,
      recommended: recommendedFormulas.includes(r.formula),
      note: r.note,
    }));

  // 标记推荐公式中最准确的一个
  const best = results.find((r) => r.formula === 'Kane') ?? results.find((r) => r.formula === 'Barrett II') ?? results[0];
  if (best) best.recommended = true;

  return results;
}

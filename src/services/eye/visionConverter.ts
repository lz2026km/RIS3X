/** G005 视力换算 - 支持 4 种记法 v3.0.6.8-20 */

type Notation = 'snellen' | 'decimal' | 'five' | 'logmar';

/** Snellen 分数 → 小数 */
function snellenToDecimal(snellen: string): number {
  const parts = snellen.split('/');
  if (parts.length !== 2) return 0;
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}

/** 小数 → Snellen */
function decimalToSnellen(decimal: number): string {
  if (decimal <= 0) return 'NLP';
  if (decimal < 0.02) return 'LP';
  if (decimal < 0.05) return 'HM';
  if (decimal < 0.1) return 'FC';
  // Snellen 20/x = 1/(decimal) * 20
  const denominator = Math.round(20 / decimal);
  return `20/${Math.max(20, denominator)}`;
}

/** 小数 → 5 分记录 */
function decimalToFive(decimal: number): number {
  if (decimal <= 0) return 0;
  // 5 分记录 = 5 - log10(1/decimal)
  const logMar = decimalToLogmar(decimal);
  return Math.round((5 - logMar) * 10) / 10;
}

/** 5 分记录 → 小数 */
function fiveToDecimal(five: number): number {
  const logMar = 5 - five;
  return logmarToDecimal(logMar);
}

/** 小数 → LogMAR */
function decimalToLogmar(decimal: number): number {
  if (decimal <= 0) return 3.0;
  if (decimal < 0.01) return 2.0;
  return Math.round(-Math.log10(decimal) * 100) / 100;
}

/** LogMAR → 小数 */
function logmarToDecimal(logmar: number): number {
  return Math.round(Math.pow(10, -logmar) * 1000) / 1000;
}

/** 任意记法 → 小数 */
export function toDecimal(value: number, fromNotation: Notation): number {
  switch (fromNotation) {
    case 'decimal': return value;
    case 'snellen': return snellenToDecimal(decimalToSnellen(value)); // 近似
    case 'five': return fiveToDecimal(value);
    case 'logmar': return logmarToDecimal(value);
    default: return value;
  }
}

/** 小数 → 任意记法 */
export function fromDecimal(decimal: number, toNotation: Notation): number {
  switch (toNotation) {
    case 'decimal': return decimal;
    case 'snellen': return parseFloat(decimalToSnellen(decimal).split('/')[0] ?? '20') / parseFloat(decimalToSnellen(decimal).split('/')[1] || '20');
    case 'five': return decimalToFive(decimal);
    case 'logmar': return decimalToLogmar(decimal);
    default: return decimal;
  }
}

/** 全部 4 记法同时输出 */
export function toAllNotations(decimal: number): Record<Notation, number | string> {
  return {
    decimal: decimal,
    snellen: decimalToSnellen(decimal),
    five: decimalToFive(decimal),
    logmar: decimalToLogmar(decimal),
  };
}

/** 视力等级判定（WHO 标准） */
export function visionGrade(decimal: number): string {
  if (decimal >= 1.0) return '正常';
  if (decimal >= 0.5) return '轻度低下';
  if (decimal >= 0.3) return '中度低下';
  if (decimal >= 0.1) return '重度低下';
  if (decimal >= 0.02) return '盲(低视力)';
  return '盲';
}

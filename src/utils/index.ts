/**
 * Utils 统一导出 + date-fns + Intl.NumberFormat
 * G005 Radiology RIS System
 */
import { formatDate, formatDateTime, formatDateTimeFull, formatRelativeTime } from './date';
import { formatCurrency, parseCurrency } from './currency';
import { sanitize, validateInput } from './security';
import { debounce, throttle } from './performance';
import { format, parseISO, formatDistanceToNow, addDays, subDays, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// ============= date-fns 统一导出 =============
export {
  format,
  parseISO,
  formatDistanceToNow,
  addDays,
  subDays,
  isValid,
  zhCN,
};

// ============= 日期格式化 (基于 date-fns) =============
/**
 * 格式化日期 - 使用 date-fns
 */
export function formatDateFns(date: Date | string | number, formatStr: string = 'yyyy-MM-dd'): string {
  const d = new Date(date);
  if (!isValid(d)) return '';
  return format(d, formatStr);
}

/**
 * 格式化日期时间
 */
export function formatDateTimeFns(date: Date | string | number): string {
  return formatDateFns(date, 'yyyy-MM-dd HH:mm');
}

/**
 * 相对时间（如"3分钟前"）
 */
export function formatRelativeTimeFns(date: Date | string | number): string {
  const d = new Date(date);
  if (!isValid(d)) return '';
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN });
}

// ============= Intl.NumberFormat 货币格式化 =============
/**
 * 使用 Intl.NumberFormat 格式化货币
 */
export function formatCurrencyIntl(
  amount: number,
  options: {
    currency?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const {
    currency = 'CNY',
    locale = 'zh-CN',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

/**
 * 格式化数字
 */
export function formatNumber(
  value: number,
  options: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {}
): string {
  const {
    locale = 'zh-CN',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useGrouping = true,
  } = options;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  }).format(value);
}

// ============= 原有工具函数重新导出 =============
export {
  formatDate,
  formatDateTime,
  formatDateTimeFull,
  formatRelativeTime,
  formatCurrency,
  parseCurrency,
  sanitize,
  validateInput,
  debounce,
  throttle,
};

// ============= 图表工具 (v3.0.6.8-23c) =============
export {
  CHART_COLORS,
  CHART_PALETTE,
  CHART_SEMANTIC,
  getChartColor,
  chartColorWithAlpha,
} from './chartColors'
export type { ChartColorKey } from './chartColors'

export {
  getSemanticColor,
  getSemanticBg,
  getSemanticTone,
  getSemanticLabel,
} from './getSemanticColor'
export type { SemanticType, SemanticTone, SemanticOptions, SemanticThreshold } from './getSemanticColor'

export { getPresetsForModality, CT_DEFAULT_WW, CT_DEFAULT_WL, FUSION_CT_WW, FUSION_CT_WL, FUSION_PET_WW, FUSION_PET_WL, MR_DEFAULT_WW, MR_DEFAULT_WL } from './modalityPresets'
export type { SimpleWindowPreset } from './modalityPresets'
export { DEFAULT_WINDOWING, loadWindowingState, saveWindowingState, useWindowingState } from './windowingStorage'
export type { WindowingState } from './windowingStorage'
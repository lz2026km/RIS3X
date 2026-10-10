/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 5 - ThemeTokens
 * UI 组件化: 放射专业主题 token 常量 + useThemeColors hook (70+ token)
 *
 * 对应 design-system.css 语义变量 + radiologyTheme 专业 Token:
 *   颜色 (语义/主色/模态/危急)/ 间距 / 字号 / 字重 / 圆角 / 阴影 / 密度 / 动效
 *
 * 供内联样式使用: const colors = useThemeColors(); background: colors.bgCard
 */

export interface ThemeTokens {
  /* === 背景层级 (页面/卡片/悬浮/深层) === */
  bgCard: string;
  bgPage: string;
  bgPrimary: string;
  bgElevated: string;
  bgHover: string;
  bgDeep: string;

  /* === 文字层级 === */
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  /* === 边框层级 === */
  border: string;
  borderLight: string;
  borderStrong: string;

  /* === 品牌主色 === */
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryBg: string;

  /* === 功能色 === */
  success: string;
  error: string;
  warning: string;
  info: string;
  critical: string;
  pending: string;

  /* === 模态设备色 === */
  modalityCt: string;
  modalityMr: string;
  modalityDr: string;
  modalityUs: string;
  modalityMg: string;
  modalityDsa: string;
  modalityPet: string;
  modalityNm: string;
  modalityCr: string;
  modalityRf: string;

  /* === 危急分层 (RADS) === */
  radsLow: string;
  radsMid: string;
  radsHigh: string;

  /* === 间距 (4px 网格) === */
  space1: string;
  space2: string;
  space3: string;
  space4: string;
  space5: string;
  space6: string;
  space8: string;
  space12: string;

  /* === 字号规范 (12/13/14/16/20/24) === */
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontSizeXxl: string;

  /* === 字重 === */
  weightNormal: string;
  weightMedium: string;
  weightSemibold: string;
  weightBold: string;

  /* === 圆角 === */
  radiusSm: string;
  radiusMd: string;
  radius: string;
  radiusLg: string;
  radiusXl: string;

  /* === 阴影层级 === */
  shadowXs: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;

  /* === 密度 (紧凑模式) === */
  controlHeightSm: string;
  controlHeightMd: string;
  controlHeightLg: string;
  tableRowSm: string;
  tableRowMd: string;

  /* === 动效 === */
  durationFast: string;
  durationNormal: string;
  durationSlow: string;
}

export const THEME_TOKENS: ThemeTokens = {
  /* 背景层级 */
  bgCard: "var(--bg-card, #ffffff)",
  bgPage: "var(--bg-primary, #f8fafc)",
  bgPrimary: "var(--bg-primary, #f8fafc)",
  bgElevated: "var(--bg-elevated, #ffffff)",
  bgHover: "var(--bg-hover, rgba(0,0,0,0.04))",
  bgDeep: "var(--bg-deep, #f1f5f9)",

  /* 文字层级 */
  textPrimary: "var(--text-primary, #1e293b)",
  textSecondary: "var(--text-secondary, #475569)",
  textMuted: "var(--text-muted, #94a3b8)",
  textInverse: "var(--text-inverse, #ffffff)",

  /* 边框层级 */
  border: "var(--border-color, #e2e8f0)",
  borderLight: "var(--border-light, #f1f5f9)",
  borderStrong: "var(--border-strong, rgba(0,0,0,0.16))",

  /* 品牌主色 (医疗蓝) */
  primary: "var(--color-primary-600, var(--color-primary-600))",
  primaryLight: "var(--color-primary-500, var(--color-primary-500))",
  primaryDark: "var(--color-primary-800, var(--color-primary-800))",
  primaryBg: "var(--color-primary-50, #eff6ff)",

  /* 功能色 */
  success: "var(--color-success, var(--color-success-600))",
  error: "var(--color-error, var(--color-error-600))",
  warning: "var(--color-warning, var(--color-warning-600))",
  info: "var(--color-info, var(--color-primary-600))",
  critical: "var(--color-critical-500, var(--color-error-500))",
  pending: "var(--color-pending, var(--color-primary-600))",

  /* 模态设备色 */
  modalityCt: "var(--color-modality-ct, var(--color-primary-500))",
  modalityMr: "var(--color-modality-mr, #8b5cf6)",
  modalityDr: "var(--color-modality-dr, var(--color-success-500))",
  modalityUs: "var(--color-modality-us, var(--color-info-500))",
  modalityMg: "var(--color-modality-mg, #ec4899)",
  modalityDsa: "var(--color-modality-dsa, var(--color-warning-500))",
  modalityPet: "#f97316",
  modalityNm: "var(--color-warning-500)",
  modalityCr: "#14b8a6",
  modalityRf: "#64748b",

  /* 危急分层 (RADS) */
  radsLow: "var(--color-rads-low, var(--color-success-500))",
  radsMid: "var(--color-rads-mid, var(--color-warning-500))",
  radsHigh: "var(--color-rads-high, var(--color-error-600))",

  /* 间距 (4px 网格) */
  space1: "var(--space-1, 4px)",
  space2: "var(--space-2, 8px)",
  space3: "var(--space-3, 12px)",
  space4: "var(--space-4, 16px)",
  space5: "var(--space-5, 20px)",
  space6: "var(--space-6, 24px)",
  space8: "var(--space-8, 32px)",
  space12: "var(--space-12, 48px)",

  /* 字号规范 (12/13/14/16/20/24) */
  fontSizeXs: "var(--font-size-sm, 12px)",
  fontSizeSm: "13px",
  fontSizeMd: "var(--font-size-base, 14px)",
  fontSizeLg: "var(--font-size-lg, 16px)",
  fontSizeXl: "var(--font-size-2xl, 20px)",
  fontSizeXxl: "var(--font-size-3xl, 24px)",

  /* 字重 */
  weightNormal: "var(--font-weight-normal, 400)",
  weightMedium: "var(--font-weight-medium, 500)",
  weightSemibold: "var(--font-weight-semibold, 600)",
  weightBold: "var(--font-weight-bold, 700)",

  /* 圆角 */
  radiusSm: "var(--radius-sm, 4px)",
  radiusMd: "var(--radius-md, 8px)",
  radius: "var(--radius-md, 8px)",
  radiusLg: "var(--radius-lg, 12px)",
  radiusXl: "var(--radius-xl, 16px)",

  /* 阴影层级 */
  shadowXs: "var(--shadow-xs, 0 1px 2px 0 rgb(0 0 0 / 0.05))",
  shadowSm: "var(--shadow-sm, 0 1px 3px 0 rgb(0 0 0 / 0.08))",
  shadowMd: "var(--shadow-md, 0 4px 8px 0 rgb(0 0 0 / 0.1))",
  shadowLg: "var(--shadow-lg, 0 8px 16px 0 rgb(0 0 0 / 0.12))",
  shadowXl: "var(--shadow-xl, 0 16px 32px 0 rgb(0 0 0 / 0.14))",

  /* 密度 (紧凑模式) */
  controlHeightSm: "var(--size-control-sm, 24px)",
  controlHeightMd: "var(--size-control-md, 32px)",
  controlHeightLg: "var(--size-control-lg, 40px)",
  tableRowSm: "var(--size-table-row-sm, 36px)",
  tableRowMd: "var(--size-table-row-md, 48px)",

  /* 动效 */
  durationFast: "var(--duration-fast, 150ms)",
  durationNormal: "var(--duration-normal, 200ms)",
  durationSlow: "var(--duration-slow, 300ms)",
};

/**
 * 返回当前主题颜色 token (内联样式使用)
 */
export function useThemeColors(): ThemeTokens {
  return THEME_TOKENS;
}

export default THEME_TOKENS;

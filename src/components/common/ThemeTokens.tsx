/**
 * G005 放射RIS系统 v3.0.6.11-100 Wave 5A - ThemeTokens
 * UI 组件化: 主题 token 常量 + useThemeColors hook
 *
 * 对应 design-system.css 中的语义变量:
 *   --bg-card / --bg-primary / --text-primary / --text-secondary /
 *   --text-muted / --border-color / --color-success / --color-error /
 *   --color-warning / --color-info
 *
 * 供内联样式使用: const colors = useThemeColors(); background: colors.bgCard
 */

export interface ThemeTokens {
  bgCard: string;
  bgPrimary: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  radius: string;
  shadowSm: string;
}

export const THEME_TOKENS: ThemeTokens = {
  bgCard: "var(--bg-card, #ffffff)",
  bgPrimary: "var(--bg-primary, #f8fafc)",
  bgHover: "var(--bg-hover, rgba(0,0,0,0.04))",
  textPrimary: "var(--text-primary, #1e293b)",
  textSecondary: "var(--text-secondary, #475569)",
  textMuted: "var(--text-muted, #94a3b8)",
  border: "var(--border-color, #e2e8f0)",
  success: "var(--color-success, #16a34a)",
  error: "var(--color-error, #dc2626)",
  warning: "var(--color-warning, #d97706)",
  info: "var(--color-info, #2563eb)",
  radius: "var(--radius-lg, 12px)",
  shadowSm: "var(--shadow-sm, 0 1px 3px 0 rgb(0 0 0 / 0.08))",
};

/**
 * 返回当前主题颜色 token (内联样式使用)
 */
export function useThemeColors(): ThemeTokens {
  return THEME_TOKENS;
}

export default THEME_TOKENS;

/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 5 - 放射专业主题包
 *
 * 对标 GE / Siemens PACS 工作站视觉品质:
 *   - 医疗蓝主色 + 放射专业功能色 (危急红 / 警告橙 / 成功绿 / 信息蓝)
 *   - 背景层级 (页面 / 卡片 / 悬浮) + 深色模式完整适配
 *   - 专业 Token: 卡片圆角 8px / 阴影层级 / 紧凑密度 / 字号规范 (12/13/14/16/20/24)
 *
 * 用法 (antd ConfigProvider 直接消费):
 *   import { getRadiologyTheme } from "@/theme/radiologyTheme";
 *   <ConfigProvider theme={getRadiologyTheme("dark")} />
 * 或在 Provider.tsx 中合并: theme={{ ...getRadiologyTheme(mode) }}
 */

/** 放射专业色板 (浅色) */
export const RADIOLOGY_PALETTE_LIGHT = {
  /** 主色: 医疗蓝 */
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  primaryActive: "#1e40af",
  primaryBg: "#eff6ff",
  /** 功能色 */
  critical: "#dc2626",
  criticalBg: "#fef2f2",
  warning: "#f59e0b",
  warningBg: "#fffbeb",
  success: "#16a34a",
  successBg: "#f0fdf4",
  info: "#0891b2",
  infoBg: "#ecfeff",
  /** 背景层级: 页面 / 卡片 / 悬浮 */
  bgPage: "#f1f5f9",
  bgCard: "#ffffff",
  bgElevated: "#ffffff",
  bgHover: "rgba(0, 0, 0, 0.04)",
  bgDeep: "#f8fafc",
  /** 文字层级 */
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  /** 边框 */
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
} as const;

/** 放射专业色板 (深色 - 强化对比度与专业感) */
export const RADIOLOGY_PALETTE_DARK = {
  primary: "#3b82f6",
  primaryHover: "#60a5fa",
  primaryActive: "#2563eb",
  primaryBg: "rgba(59, 130, 246, 0.14)",
  critical: "#f87171",
  criticalBg: "rgba(248, 113, 113, 0.12)",
  warning: "#fbbf24",
  warningBg: "rgba(251, 191, 36, 0.12)",
  success: "#4ade80",
  successBg: "rgba(74, 222, 128, 0.12)",
  info: "#60a5fa",
  infoBg: "rgba(96, 165, 250, 0.12)",
  bgPage: "#0f172a",
  bgCard: "#1e293b",
  bgElevated: "#334155",
  bgHover: "rgba(255, 255, 255, 0.06)",
  bgDeep: "#020617",
  textPrimary: "#f1f5f9",
  textSecondary: "#cbd5e1",
  textMuted: "#64748b",
  border: "#334155",
  borderStrong: "#475569",
} as const;

export type RadiologyPalette = typeof RADIOLOGY_PALETTE_LIGHT;

/** 放射专业 Token: 圆角 / 阴影 / 字号 / 间距 / 密度 */
export const RADIOLOGY_TOKENS = {
  /** 卡片圆角 8px (专业工作站规范) */
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  /** 阴影层级 */
  shadow: {
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px 0 rgb(0 0 0 / 0.04)",
    md: "0 4px 8px 0 rgb(0 0 0 / 0.1), 0 2px 4px 0 rgb(0 0 0 / 0.05)",
    lg: "0 8px 16px 0 rgb(0 0 0 / 0.12), 0 4px 8px 0 rgb(0 0 0 / 0.05)",
    xl: "0 16px 32px 0 rgb(0 0 0 / 0.14), 0 8px 16px 0 rgb(0 0 0 / 0.06)",
  },
  /** 深色模式阴影 (更重, 契合夜间阅片) */
  shadowDark: {
    xs: "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.3)",
    md: "0 4px 8px 0 rgb(0 0 0 / 0.4)",
    lg: "0 8px 16px 0 rgb(0 0 0 / 0.5)",
    xl: "0 16px 32px 0 rgb(0 0 0 / 0.6)",
  },
  /** 字号规范 (放射工作站密度) */
  fontSize: {
    xs: 12,
    sm: 13,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  /** 间距 (4px 网格) */
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },
  /** 紧凑密度 */
  density: {
    controlSm: 24,
    controlMd: 32,
    controlLg: 40,
    tableRowSm: 36,
    tableRowMd: 48,
    compactPadding: 12,
  },
  /** 动效 */
  motion: {
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
  },
} as const;

/** 模态设备色 (PACS 工作站习惯色) */
export const RADIOLOGY_MODALITY_COLORS: Record<string, string> = {
  CT: "#3b82f6",
  MR: "#8b5cf6",
  DR: "#22c55e",
  CR: "#14b8a6",
  US: "#06b6d4",
  MG: "#ec4899",
  NM: "#f59e0b",
  PET: "#f97316",
  DSA: "#eab308",
  RF: "#64748b",
  XA: "#eab308",
  DX: "#22c55e",
  OT: "#94a3b8",
};

/** 状态色 (危急值体系) */
export const RADIOLOGY_STATUS_COLORS = {
  critical: "#dc2626",
  warning: "#f59e0b",
  success: "#16a34a",
  pending: "#2563eb",
  expired: "#64748b",
  abnormal: "#b91c1c",
} as const;

/** antd 组件级 token (浅色) */
export const RADIOLOGY_COMPONENT_TOKENS = {
  Layout: {
    headerBg: "#ffffff",
    siderBg: "#0f172a",
    bodyBg: "#f1f5f9",
  },
  Menu: {
    darkItemBg: "#0f172a",
    darkSubMenuItemBg: "#0f172a",
    darkItemSelectedBg: "#1e40af",
    darkItemColor: "#cbd5e1",
  },
  Card: {
    borderRadiusLG: 8,
    boxShadowTertiary: "0 1px 3px 0 rgb(0 0 0 / 0.08)",
  },
  Table: {
    headerBg: "#f8fafc",
    headerColor: "#334155",
    rowHoverBg: "rgba(37, 99, 235, 0.04)",
    borderRadius: 8,
  },
  Button: {
    borderRadius: 6,
    controlHeight: 32,
  },
  Tag: {
    borderRadiusSM: 4,
  },
  Input: {
    borderRadius: 6,
  },
  Select: {
    borderRadius: 6,
  },
} as const;

/** antd 组件级 token (深色) */
export const RADIOLOGY_COMPONENT_TOKENS_DARK = {
  Layout: {
    headerBg: "#1e293b",
    siderBg: "#0f172a",
    bodyBg: "#0f172a",
  },
  Menu: {
    darkItemBg: "#0f172a",
    darkSubMenuItemBg: "#0f172a",
    darkItemSelectedBg: "#2563eb",
    darkItemColor: "#cbd5e1",
  },
  Card: {
    borderRadiusLG: 8,
    boxShadowTertiary: "0 1px 3px 0 rgb(0 0 0 / 0.3)",
  },
  Table: {
    headerBg: "#1e293b",
    headerColor: "#cbd5e1",
    rowHoverBg: "rgba(59, 130, 246, 0.08)",
    borderRadius: 8,
  },
  Button: {
    borderRadius: 6,
    controlHeight: 32,
  },
  Tag: {
    borderRadiusSM: 4,
  },
  Input: {
    borderRadius: 6,
  },
  Select: {
    borderRadius: 6,
  },
} as const;

/** 由色板生成 antd seed token (接受任一色板) */
type PaletteLike = Record<keyof RadiologyPalette, string>;

function toAntdToken(p: PaletteLike) {
  return {
    colorPrimary: p.primary,
    colorInfo: p.primary,
    colorSuccess: p.success,
    colorWarning: p.warning,
    colorError: p.critical,
    colorBgLayout: p.bgPage,
    colorBgContainer: p.bgCard,
    colorBgElevated: p.bgElevated,
    colorTextBase: p.textPrimary,
    colorTextSecondary: p.textSecondary,
    colorBorder: p.border,
    colorBorderSecondary: p.border,
    borderRadius: 6,
    borderRadiusLG: 8,
    fontSize: 14,
    controlHeight: 32,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Roboto, sans-serif",
  };
}

export interface RadiologyThemeResult {
  token: ReturnType<typeof toAntdToken>;
  components: Record<string, unknown>;
}

/**
 * 获取放射专业主题 (浅色/深色), 可直接挂载到 antd ConfigProvider theme。
 * 用法: <ConfigProvider theme={getRadiologyTheme(mode)}>
 */
export function getRadiologyTheme(mode: "light" | "dark"): RadiologyThemeResult {
  const palette = mode === "dark" ? RADIOLOGY_PALETTE_DARK : RADIOLOGY_PALETTE_LIGHT;
  return {
    token: toAntdToken(palette),
    components: mode === "dark" ? RADIOLOGY_COMPONENT_TOKENS_DARK : RADIOLOGY_COMPONENT_TOKENS,
  };
}

export default RADIOLOGY_TOKENS;

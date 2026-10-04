/**
 * G005 放射RIS系统 v3.0.0 - Provider 组合
 * v3.0.6.8-23c: 主题 + 响应式 + a11y 系统重构
 *
 * 组合:
 *   - ErrorBoundary(全局错误兜底)
 *   - antd ConfigProvider(主题 + 中文 locale)
 *   - antd App(全局 message/notification)
 *   - SkipLink + useScreenReaderAnnouncer(a11y)
 *   - Sentry 错误监控
 *   - Web Vitals 性能监控
 *   - CSP + Security Meta 注入
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ConfigProvider, App as AntdApp, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import { I18nextProvider, useTranslation } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { initSentry, captureError } from "@/observability/sentry";
import { reportWebVitals, performanceMarks } from "@/observability/webVitals";
import { injectCSP, injectSecurityMetaTags } from "@/security/csp";
import { useScreenReaderAnnouncer } from "@/a11y/SkipLink";
import { THEME_TOKENS } from "./common/ThemeTokens";
import {
  RADIOLOGY_COMPONENT_TOKENS,
  RADIOLOGY_COMPONENT_TOKENS_DARK,
} from "@/theme/radiologyTheme";

export type ThemeMode = "light" | "dark" | "high-contrast";
export const THEME_STORAGE_KEY = "g005-ris-theme";
export const THEME_MODES: readonly ThemeMode[] = [
  "light",
  "dark",
  "high-contrast",
] as const;

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "high-contrast";
}

export interface AppThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  cycleTheme: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

/**
 * U1-B: 主题切换 hook — 在 <Provider> 内部消费 theme + setTheme。
 * 与 antd ConfigProvider / data-theme / localStorage 三向同步。
 */
export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme 必须在 <Provider> 内部使用");
  }
  return ctx;
}

function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(v) ? v : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (err) {
    console.warn("[Provider] writeStoredTheme failed", err);
  }
}

function applyThemeToDom(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.style.colorScheme =
    mode === "light" ? "light" : "dark";
}

function detectInitialTheme(): ThemeMode {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches)
      return "dark";
    if (window.matchMedia("(prefers-contrast: more)").matches)
      return "high-contrast";
  }
  return "light";
}

export function initTheme(): ThemeMode {
  const mode = detectInitialTheme();
  applyThemeToDom(mode);
  writeStoredTheme(mode);
  return mode;
}

function useThemeMode(): [ThemeMode, (m: ThemeMode) => void, () => void] {
  const [mode, setMode] = useState<ThemeMode>(detectInitialTheme);
  useEffect(() => {
    applyThemeToDom(mode);
    writeStoredTheme(mode);
  }, [mode]);
  const cycle = () => {
    setMode((prev) => {
      const idx = THEME_MODES.indexOf(prev);
      return THEME_MODES[(idx + 1) % THEME_MODES.length]!;
    });
  };
  return [mode, setMode, cycle];
}

/** UI-1: system-first UI stack — Inter + Noto Sans SC + system-ui (no webfont). */
const FONT_FAMILY =
  'Inter, "Noto Sans SC", "Source Han Sans SC", system-ui, -apple-system, ' +
  'BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", ' +
  '"Helvetica Neue", Arial, sans-serif';

const LIGHT_TOKENS = {
  colorPrimary: "#1d4ed8",
  colorPrimaryHover: "#2563eb",
  colorPrimaryActive: "#1e40af",
  colorSuccess: "#059669",
  colorWarning: "#d97706",
  colorError: "#dc2626",
  colorInfo: "#2563eb",
  colorBgLayout: "#f1f5f9",
  colorTextBase: "#0f172a",
  borderRadius: 8,
  fontFamily: FONT_FAMILY,
  fontSize: 14,
};

// antd token 覆盖: 浅色基 token + 各模式可选的深色/高对比 token
type ThemeTokens = typeof LIGHT_TOKENS & {
  colorBgBase?: string;
  colorBgContainer?: string;
  colorText?: string;
  colorTextSecondary?: string;
  colorBorder?: string;
};

const DARK_TOKENS: ThemeTokens = {
  ...LIGHT_TOKENS,
  colorBgBase: "#0f172a",
  colorBgContainer: "#1e293b",
  colorBgLayout: "#0f172a",
  colorTextBase: "#f1f5f9",
  colorText: "#f1f5f9",
  colorTextSecondary: "#cbd5e1",
  colorBorder: "#334155",
};

// U1-B 修复: 高对比度 = darkAlgorithm(深色基底) + 高对比 token,
// 与 themes.css [data-theme='high-contrast'] 的 CSS 变量保持一致
const HIGH_CONTRAST_TOKENS: ThemeTokens = {
  ...LIGHT_TOKENS,
  colorPrimary: "#ffff00",
  colorSuccess: "#00ff00",
  colorWarning: "#ffcc00",
  colorError: "#ff4444",
  colorInfo: "#66ccff",
  colorBgBase: "#000000",
  colorBgContainer: "#1a1a1a",
  colorBgLayout: "#000000",
  colorTextBase: "#ffffff",
  colorText: "#ffffff",
  colorTextSecondary: "#f0f0f0",
  colorBorder: "#ffffff",
  borderRadius: 6,
};

/**
 * UI-1: enterprise high-density component tokens.
 * Wires the shared semantic palette + radiology component tokens (previously
 * dead) into antd for light / dark / high-contrast. Kept as a plain inferred
 * object so component-token keys stay decoupled from antd's mapped type.
 */
function buildThemeComponents(isDark: boolean, isHighContrast: boolean) {
  const rad = isDark ? RADIOLOGY_COMPONENT_TOKENS_DARK : RADIOLOGY_COMPONENT_TOKENS;
  const primary = isHighContrast ? "#ffff00" : "#1d4ed8";
  const border = isHighContrast ? "#ffffff" : isDark ? "#334155" : "#e2e8f0";
  const text = isHighContrast ? "#ffffff" : isDark ? "#f1f5f9" : "#0f172a";
  const textSecondary = isHighContrast ? "#f0f0f0" : isDark ? "#cbd5e1" : "#475569";
  const containerBg = isHighContrast ? "#1a1a1a" : isDark ? "#1e293b" : "#ffffff";
  const layoutBg = isHighContrast ? "#000000" : isDark ? "#0f172a" : "#f1f5f9";
  const headerBg = isHighContrast ? "#0a0a0a" : isDark ? "#1e293b" : "#ffffff";
  const selectedBg = isHighContrast
    ? "#333300"
    : isDark
      ? "rgba(29, 78, 216, 0.28)"
      : "#eff6ff";

  return {
    Layout: {
      headerBg,
      siderBg: isHighContrast ? "#000000" : isDark ? "#0f172a" : "#1e40af",
      bodyBg: layoutBg,
      footerBg: isHighContrast ? "#0a0a0a" : isDark ? "#1e293b" : "#f8fafc",
      headerHeight: 56,
      headerPadding: "0 16px",
    },
    Menu: {
      darkItemBg: rad.Menu.darkItemBg,
      darkSubMenuItemBg: rad.Menu.darkSubMenuItemBg,
      darkItemSelectedBg: isHighContrast ? "#ffff00" : rad.Menu.darkItemSelectedBg,
      darkItemColor: rad.Menu.darkItemColor,
      itemHeight: 36,
      itemMarginBlock: 2,
      itemMarginInline: 8,
      itemBorderRadius: 6,
      itemSelectedBg: selectedBg,
      itemSelectedColor: text,
      itemColor: textSecondary,
    },
    Button: {
      borderRadius: rad.Button.borderRadius,
      controlHeight: rad.Button.controlHeight,
      controlHeightSM: 24,
      controlHeightLG: 40,
      contentFontSize: 13,
      contentFontSizeSM: 12,
      contentFontSizeLG: 14,
      fontWeight: 600,
      defaultBorderColor: border,
      defaultColor: text,
    },
    Card: {
      borderRadiusLG: rad.Card.borderRadiusLG,
      boxShadowTertiary: rad.Card.boxShadowTertiary,
      headerBg: isDark ? "#1e293b" : "#ffffff",
      headerFontSize: 14,
      bodyPadding: 16,
      colorBorderSecondary: border,
    },
    Table: {
      headerBg: isHighContrast ? "#000000" : rad.Table.headerBg,
      headerColor: isHighContrast ? "#ffffff" : rad.Table.headerColor,
      rowHoverBg: rad.Table.rowHoverBg,
      borderRadius: rad.Table.borderRadius,
      headerBorderRadius: rad.Table.borderRadius,
      cellPaddingBlock: 8,
      cellPaddingInline: 12,
      cellFontSize: 13,
      fontSize: 13,
      borderColor: border,
    },
    Form: {
      labelFontSize: 13,
      itemMarginBottom: 16,
      verticalLabelPadding: "0 0 4px",
      labelColor: textSecondary,
      labelRequiredMarkColor: "#dc2626",
    },
    Input: {
      borderRadius: rad.Input.borderRadius,
      paddingBlock: 5,
      paddingInline: 10,
      fontSize: 13,
      controlHeight: 32,
      colorBgContainer: containerBg,
      colorBorder: border,
    },
    Select: {
      borderRadius: rad.Select.borderRadius,
      optionSelectedBg: selectedBg,
      optionSelectedColor: text,
      optionHeight: 30,
      fontSize: 13,
      controlHeight: 32,
      colorBgContainer: containerBg,
      colorBorder: border,
    },
    Tabs: {
      titleFontSize: 13,
      horizontalItemPadding: "10px 0",
      horizontalMargin: "0 0 12px 0",
      itemSelectedColor: primary,
      inkBarColor: primary,
      cardBg: containerBg,
      colorBorderSecondary: border,
    },
    Tag: {
      borderRadiusSM: rad.Tag.borderRadiusSM,
      defaultBg: isDark ? "rgba(148, 163, 184, 0.14)" : "#f8fafc",
      defaultColor: textSecondary,
      fontSizeSM: 12,
      lineHeightSM: 18,
    },
    Badge: {
      textFontSize: 12,
      indicatorHeight: 18,
      dotSize: 8,
      colorBorderBg: containerBg,
    },
    Pagination: {
      itemSize: 30,
      itemSizeSM: 24,
      borderRadius: 6,
      itemActiveBg: selectedBg,
      fontSize: 13,
    },
    Tooltip: {
      borderRadius: 6,
      colorBgSpotlight: isDark ? "#334155" : "#1e293b",
      colorTextLightSolid: "#ffffff",
      fontSize: 12,
    },
    Typography: {
      fontSize: 14,
      titleMarginBottom: 8,
      fontWeightStrong: 600,
      colorText: text,
      colorTextSecondary: textSecondary,
      colorTextDescription: textSecondary,
    },
    Segmented: {
      itemSelectedBg: containerBg,
      itemSelectedColor: primary,
      itemColor: textSecondary,
      itemHoverColor: text,
      trackBg: isDark ? "#0f172a" : "#f1f5f9",
      trackPadding: 2,
      controlHeight: 30,
      borderRadius: 6,
    },
  };
}

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}): JSX.Element {
  useEffect(() => {
    captureError(error, { source: "ErrorBoundary" });
  }, [error]);
  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--color-error-bg, #fef2f2)",
        color: "var(--text-primary, #0f172a)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ color: "var(--color-error, #dc2626)", fontSize: 24, marginBottom: 16 }}>
        出现错误
      </h1>
      <pre
        style={{
          background: THEME_TOKENS.bgCard,
          padding: 16,
          borderRadius: 8,
          maxWidth: 800,
          overflow: "auto",
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        {error.message}
      </pre>
      <button
        type="button"
        onClick={resetErrorBoundary}
        style={{
          padding: "8px 16px",
          background: "var(--color-primary-700, #1e40af)",
          color: "var(--color-gray-0, #fff)",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        重试
      </button>
    </div>
  );
}

function useAntLocale(): typeof zhCN {
  const { i18n } = useTranslation();
  const lang = i18n.language as SupportedLanguage;
  return lang === "en_US" ? enUS : zhCN;
}

export interface ProviderProps {
  children: ReactNode;
}

export function Provider({ children }: ProviderProps): JSX.Element {
  useEffect(() => {
    if (typeof document === "undefined") return;
    injectCSP();
    injectSecurityMetaTags();
  }, []);
  useEffect(() => {
    initSentry();
  }, []);
  useEffect(() => {
    performanceMarks.mark("g005.appMount");
    reportWebVitals();
  }, []);

  const [themeMode, setThemeMode] = useThemeMode();
  const { announce, Announcement } = useScreenReaderAnnouncer();
  const antLocale = useAntLocale();
  const isDark = themeMode === "dark";
  const isHighContrast = themeMode === "high-contrast";
  const appThemeContextValue: AppThemeContextValue = {
    theme: themeMode,
    setTheme: setThemeMode,
    cycleTheme: () => {
      const idx = THEME_MODES.indexOf(themeMode);
      setThemeMode(THEME_MODES[(idx + 1) % THEME_MODES.length]!);
    },
  };

  useEffect(() => {
    const label = isHighContrast
      ? "高对比度模式"
      : isDark
        ? "深色模式"
        : "浅色模式";
    announce(`已切换到${label}`, "polite");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  useEffect(() => {
    (
      window as unknown as { __setG005Theme?: (m: ThemeMode) => void }
    ).__setG005Theme = setThemeMode;
  }, [setThemeMode]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => captureError(error, { source: "ErrorBoundary" })}
      onReset={() => {}}
    >
      <I18nextProvider i18n={i18n}>
        <ConfigProvider
          locale={antLocale}
          theme={{
            // UI-1: CSS variable mode + single-version hashed=false (safe)
            cssVar: { key: "g005-ris" },
            hashed: false,
            // UI-1: enterprise high-density = compact + (dark|default) algorithm
            algorithm: [
              theme.compactAlgorithm,
              isDark || isHighContrast
                ? theme.darkAlgorithm
                : theme.defaultAlgorithm,
            ],
            token: isHighContrast
              ? HIGH_CONTRAST_TOKENS
              : isDark
                ? DARK_TOKENS
                : LIGHT_TOKENS,
            components: buildThemeComponents(isDark, isHighContrast),
          }}
        >
          <AntdApp
            notification={{ placement: "topRight", duration: 4 }}
            message={{ duration: 3 }}
          >
            <AppThemeContext.Provider value={appThemeContextValue}>
              <Announcement />
              {children}
            </AppThemeContext.Provider>
          </AntdApp>
        </ConfigProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export { SUPPORTED_LANGUAGES, type SupportedLanguage };

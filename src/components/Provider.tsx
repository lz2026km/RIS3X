/**
 * G005 鏀惧皠RIS绯荤粺 v3.0.0 - Provider 缁勫悎
 * v3.0.6.8-23c: 涓婚 + 鍝嶅簲寮?+ a11y 绯荤粺閲嶆瀯
 *
 * 缁勫悎:
 *   - ErrorBoundary(鍏ㄥ眬閿欒鍏滃簳)
 *   - antd ConfigProvider(涓婚 + 涓枃 locale)
 *   - antd App(鍏ㄥ眬 message/notification)
 *   - SkipLink + useScreenReaderAnnouncer(a11y)
 *   - Sentry 閿欒鐩戞帶
 *   - Web Vitals 鎬ц兘鐩戞帶
 *   - CSP + Security Meta 娉ㄥ叆
 */

import { useEffect, useState, type ReactNode } from "react";
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
    mode === "dark" ? "dark" : "light";
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

const LIGHT_TOKENS = {
  colorPrimary: "#1e40af",
  colorSuccess: "#059669",
  colorWarning: "#d97706",
  colorError: "#dc2626",
  colorInfo: "#2563eb",
  colorBgLayout: "#f1f5f9",
  colorTextBase: "#0f172a",
  borderRadius: 8,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Roboto, sans-serif",
  fontSize: 14,
};

const DARK_TOKENS: typeof LIGHT_TOKENS = {
  ...LIGHT_TOKENS,
  colorBgBase: "#0f172a",
  colorBgContainer: "#1e293b",
  colorBgLayout: "#0f172a",
  colorTextBase: "#f1f5f9",
  colorText: "#f1f5f9",
  colorTextSecondary: "#cbd5e1",
  colorBorder: "#334155",
};

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
        background: "#fef2f2",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ color: "#dc2626", fontSize: 24, marginBottom: 16 }}>
        鈿狅笍 鍑虹幇閿欒
      </h1>
      <pre
        style={{
          background: "#fff",
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
          background: "#1e40af",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        閲嶈瘯
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

  useEffect(() => {
    const label = isHighContrast
      ? "楂樺姣斿害妯″紡"
      : isDark
        ? "娣辫壊妯″紡"
        : "娴呰壊妯″紡";
    announce(`宸插垏鎹㈠埌${label}`, "polite");
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
            algorithm: isHighContrast
              ? theme.defaultAlgorithm
              : isDark
                ? theme.darkAlgorithm
                : theme.defaultAlgorithm,
            token: isDark ? DARK_TOKENS : LIGHT_TOKENS,
            components: {
              Layout: {
                headerBg: isDark ? "#1e293b" : "#ffffff",
                siderBg: isDark ? "#0f172a" : "#1e40af",
                bodyBg: isDark ? "#0f172a" : "#f1f5f9",
              },
              Menu: {
                darkItemBg: "#0f172a",
                darkSubMenuItemBg: "#0f172a",
                darkItemSelectedBg: "#1e40af",
              },
            },
          }}
        >
          <AntdApp
            notification={{ placement: "topRight", duration: 4 }}
            message={{ duration: 3 }}
          >
            <Announcement />
            {children}
          </AntdApp>
        </ConfigProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export { SUPPORTED_LANGUAGES, type SupportedLanguage };

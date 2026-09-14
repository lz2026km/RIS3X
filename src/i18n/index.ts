/**
 * G005 放射RIS系统 v3.0.6.8-105+ - i18n 国际化基础设施 (v3.0.6.8-106 重构)
 * 简化: 移除 HttpBackend / LanguageDetector / partialBundledLanguages 模式.
 *       直接静态 import 聚合 zh_CN.json + en_US.json, 通过 resources 字段一次性加载.
 *       useTranslation("v3stats") 立即可用, 无需 loadNamespaces.
 *
 * 文件结构:
 *   src/i18n/locales/zh_CN.json  ← 聚合(zh_CN 语言, 74 命名空间)
 *   src/i18n/locales/en_US.json  ← 聚合(en_US 语言, 74 命名空间)
 *   src/i18n/locales/zh-CN/<ns>.json ← 按 namespace 拆分(保留, 用于审计/手动翻译)
 *   src/i18n/locales/en-US/<ns>.json
 */

import i18nLib from "i18next";
import { initReactI18next } from "react-i18next";
import { z } from "zod";
import zhCN from "./locales/zh_CN.json";
import enUS from "./locales/en_US.json";

const isTestEnv =
  typeof process !== "undefined" && process.env.NODE_ENV === "test";

export const SUPPORTED_LANGUAGES = ["zh_CN", "en_US"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const NAMESPACES = [
  "common",
  "nav",
  "status",
  "role",
  "exam",
  "report",
  "patient",
  "device",
  "critical",
  "dashboard",
  "error",
  "auth",
  "template",
  "review",
  "collab",
  // [G005 Wave 1A] 会诊模块 (ConsultationPage 登记/查询)
  "consultation",
  "ai",
  "dicom",
  "worklist",
  "v3dicom",
  "v3report",
  "v3worklist",
  "v3collab",
  "v3patient",
  "v3exam",
  "v3admin",
  "v3stats",
  "v3mobile",
  "v3a11y",
  "v3security",
  "v3ui",
  "v3form",
  "v3chart",
  "v3error",
  "v3time",
  "v3notify",
  "v3keyword",
  "v3hl7",
  "phraseBank",
  "aiReview",
  "keywordHighlight",
  "voice",
  "revision",
  "audit",
  "similarCase",
  "sr",
  "qcimage",
  "reportV2",
  "regional",
  "v3quality",
  "v3cosign",
  "v3ai",
  "v3pwa",
  "v3statsV2",
  "v3sign",
  "v3amend",
  "v3ge",
  "v3siemens",
  "v3philips",
  "v3canon",
  "v3061ai",
  "v3061perf",
  "v3061security",
  "v3061workflow",
  "app",
  "materials",
  "print",
  "benchmark",
  "v3qcai",
  "oee",
  "rads",
  "dicomCompress",
  "radiomics",
  "orchestrator",
  "worklistSmart",
  "dicomSr",
  "dicom4d",
  "dlDenoise",
  // [v3.0.6.11-103 Wave 4B] 急诊通道管理
  "v3emergency",
  // [G005 v3.0.6.11-103 Wave 18] PACS 对标新增 (第二批)
  "v3teachCase",
  "v3researchExport",
  "v3deviceGantt",
  // [v3.0.6.11-104 Wave 3C] 知情同意落库绑定 + 临床反馈闭环
  "v3consentFeedback",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { nativeName: string; englishName: string; flag: string }
> = {
  zh_CN: {
    nativeName: "简体中文",
    englishName: "Simplified Chinese",
    flag: "🇨🇳",
  },
  en_US: { nativeName: "English", englishName: "English (US)", flag: "🇺🇸" },
};

const i18n = i18nLib.createInstance();

// 测试环境(jsdom) 跳过 initReactI18next 避免 hooks 警告
type I18nPlugin = Parameters<typeof i18n.use>[0];
const plugins: I18nPlugin[] = isTestEnv ? [] : [initReactI18next];
let instance = i18n;
for (const p of plugins) instance = instance.use(p);

const initConfig: Record<string, unknown> = {
  // 静态聚合资源: zh_CN.json / en_US.json 顶层是 {v3stats: {...}, common: {...}, ...}
  // resources 字段格式: {lng: {ns: data}} → 我们直接把整个聚合 JSON 喂进去, key 就是 namespace
  resources: {
    zh_CN: zhCN as Record<string, unknown>,
    en_US: enUS as Record<string, unknown>,
  },
  ns: NAMESPACES as unknown as string[],
  defaultNS: "common",
  fallbackNS: NAMESPACES as unknown as string[],
  lng: "zh_CN",
  fallbackLng: "zh_CN",
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  // 关闭 partial: 我们已经 bundle 了所有 namespace, 不需要再走 backend
  partialBundledLanguages: false,
  // 关闭 backend 懒加载 (无 HttpBackend 类实例, 显式禁用)
  load: "currentOnly",
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (lng: string, _ns: string, key: string) => {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing key: ${key} (${lng})`);
    }
  },
};

export const initPromise = instance.init(
  initConfig as unknown as Parameters<typeof instance.init>[0],
);

export default i18n;

export type TranslationKeys = typeof zhCN;

export const changeLanguage = (lang: SupportedLanguage): Promise<unknown> =>
  i18n.changeLanguage(lang);

export const getCurrentLanguage = (): SupportedLanguage =>
  (i18n.language as SupportedLanguage) ?? "zh_CN";

/**
 * 兼容旧 API: 命名空间加载
 * 当前所有 namespace 已在 resources 中预加载, 此函数变为 no-op 并立即 resolve.
 * 保留 export 以便既有调用方不报 undefined.
 */
export const ensureNamespaces = (
  _namespaces: string | string[],
): Promise<unknown> => Promise.resolve();

export const LanguageSchema = z.enum(SUPPORTED_LANGUAGES);

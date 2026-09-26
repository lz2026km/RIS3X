/**
 * G005 放射RIS系统 v3.0.0 - Sentry 错误监控
 * Phase T4-W10: 错误监控
 *
 * 用法:
 *   import { initSentry, captureError } from '@observability/sentry';
 *   initSentry();
 *   captureError(new Error('something went wrong'));
 *
 * ⚠️ 医疗数据合规:
 *   - 严禁上报患者姓名 / 身份证 / 诊断内容
 *   - 用 beforeSend 过滤敏感字段
 *   - DSN 应使用国内 Sentry 替代品(阿里云 ARMS / 听云)
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
const ENVIRONMENT = import.meta.env.MODE;
const RELEASE = import.meta.env['VITE_RELEASE'] as string | undefined;

/** 敏感字段(Sentry 上报前过滤) */
const SENSITIVE_FIELDS = [
  'patientName',
  'name',
  'idCard',
  'phone',
  'address',
  'email',
  'diagnosis',
  'impression',
  'findings',
  'clinicalHistory',
  'allergies',
  'pregnancyStatus',
  'token',
  'password',
  'cookie',
];

/** 递归过滤敏感数据 */
function scrubSensitive<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map((item) => scrubSensitive(item)) as unknown as T;

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      scrubbed[key] = '[REDACTED]';
    } else {
      scrubbed[key] = scrubSensitive(value);
    }
  }
  return scrubbed as T;
}

/** 初始化 Sentry */
let sentryInitialized = false;
export function initSentry(): void {
  if (sentryInitialized) return;
  if (!SENTRY_DSN || SENTRY_DSN.includes('your-sentry-dsn')) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] DSN not configured, skipping init');
    }
    return;
  }

  sentryInitialized = true;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration({
        // 跟踪路由变化
        enableInp: true,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // 过滤敏感数据
    beforeSend(event) {
      if (event.request) {
        event.request.cookies = {} as typeof event.request.cookies;
        if (event.request.headers) {
          event.request.headers = scrubSensitive(event.request.headers);
        }
        if (event.request.data) {
          event.request.data = scrubSensitive(event.request.data);
        }
      }
      if (event.extra) {
        event.extra = scrubSensitive(event.extra);
      }
      if (event.contexts) {
        event.contexts = scrubSensitive(event.contexts);
      }
      return event;
    },
    // 忽略业务预期错误
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Network request failed',
      'AbortError',
      'Loading chunk',
    ],
    denyUrls: [
      // 浏览器扩展
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });

  if (import.meta.env.DEV) {
    console.info('[Sentry] Initialized for', ENVIRONMENT);
  }
}

/** 手动捕获错误 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: scrubSensitive(context ?? {}) });
  } else if (import.meta.env.DEV) {
    console.error('[Manual capture]', error, context);
  }
}

/** 手动捕获消息 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  } else if (import.meta.env.DEV) {
    console.info(`[Manual message][${level}]`, message);
  }
}

/** 设置用户上下文(去标识化) */
export function setUserContext(user: { id: string; role: string }): void {
  if (SENTRY_DSN) {
    Sentry.setUser({
      id: user.id,
      // 不设置 username / email
    });
    Sentry.setTag('user_role', user.role);
  }
}

/** 清除用户上下文 */
export function clearUserContext(): void {
  if (SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

/** 设置面包屑(去标识化) */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category,
      message,
      data: data ? scrubSensitive(data) : undefined,
      level: 'info',
    });
  }
}

export { Sentry };

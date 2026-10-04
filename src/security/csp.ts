/**
 * G005 放射RIS系统 v3.0.0 - CSP / 安全 Headers
 * Phase T4-W10: 内容安全策略
 *
 * CSP 策略:
 *   - default-src 'self'           默认仅同源
 *   - script-src 允许自签 + 内联(用于 Vite HMR / 业务代码)
 *   - style-src 允许自签 + 内联(antd 大量内联样式)
 *   - img-src 允许 data: / blob: / https: (DICOM thumbnails)
 *   - connect-src 允许 Sentry / DeepSeek / MSW
 *   - frame-ancestors 'none'       防 clickjacking
 *   - base-uri 'self'              防 base 标签劫持
 *   - form-action 'self'           防表单劫持
 *   - object-src 'none'            防 Flash / Java
 *   - upgrade-insecure-requests    HTTP → HTTPS
 *
 * 开发模式需要 'unsafe-eval' 用于 Vite,生产禁用
 */

import type { MetaTagDescriptor } from './types';

/** CSP 头(HTML meta 形式) */
export const CSP_HEADER = (isDev: boolean): string => {
  const scriptSrc = [
    "'self'",
    isDev ? "'unsafe-inline'" : '',  // antd inline only in dev
    isDev ? "'unsafe-eval'" : '',  // Vite dev
    'https://*.sentry.io',
    'https://*.deepseek.com',
  ].filter(Boolean).join(' ');

  const styleSrc = [
    "'self'",
    "'unsafe-inline'",  // antd / 业务大量内联
  ].join(' ');

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https:',
  ].join(' ');

  const connectSrc = [
    "'self'",
    'https://*.sentry.io',
    'https://*.deepseek.com',
    'wss:',  // Yjs y-webrtc
    'https:',  // DICOM WADO
  ].join(' ');

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src ${imgSrc}`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    isDev ? '' : 'upgrade-insecure-requests',
  ].filter(Boolean).join('; ');
};

/** 注入 CSP meta 标签 */
export function injectCSP(): void {
  if (typeof document === 'undefined') return;
  const csp = CSP_HEADER(import.meta.env.DEV);
  let meta = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    document.head.appendChild(meta);
  }
  meta.content = csp;
}

/** 其他安全 meta 标签 */
export const SECURITY_META_TAGS: MetaTagDescriptor[] = [
  { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' },
  { httpEquiv: 'X-Frame-Options', content: 'DENY' },
  { httpEquiv: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
  { httpEquiv: 'Permissions-Policy', content: 'camera=(), microphone=(self), geolocation=()' },
  { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
];

/** 注入所有安全 meta */
export function injectSecurityMetaTags(): void {
  if (typeof document === 'undefined') return;
  for (const tag of SECURITY_META_TAGS) {
    const selector = tag.httpEquiv
      ? `meta[http-equiv="${tag.httpEquiv}"]`
      : `meta[name="${tag.name}"]`;
    let meta = document.querySelector<HTMLMetaElement>(selector);
    if (!meta) {
      meta = document.createElement('meta');
      if (tag.httpEquiv) meta.httpEquiv = tag.httpEquiv;
      if (tag.name) meta.name = tag.name;
      document.head.appendChild(meta);
    }
    meta.content = tag.content;
  }
}

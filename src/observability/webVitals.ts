/**
 * G005 放射RIS系统 v3.0.0 - Web Vitals 性能监控
 * Phase T4-W10: Core Web Vitals 监控
 *
 * 核心指标:
 *   - LCP (Largest Contentful Paint) - 主内容绘制
 *   - FID (First Input Delay) - 首次输入延迟
 *   - CLS (Cumulative Layout Shift) - 累积布局偏移
 *   - INP (Interaction to Next Paint) - 交互到下次绘制
 *   - TTFB (Time to First Byte) - 首字节时间
 *   - FCP (First Contentful Paint) - 首次内容绘制
 *
 * 用法:
 *   import { reportWebVitals } from '@observability/webVitals';
 *   reportWebVitals((metric) => sendToAnalytics(metric));
 */

import {
  onLCP,
  onFID,
  onCLS,
  onINP,
  onTTFB,
  onFCP,
  type Metric,
} from "web-vitals";

export type WebVitalReporter = (metric: Metric) => void;

const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  TTFB: { good: 800, needsImprovement: 1800 },
  FCP: { good: 1800, needsImprovement: 3000 },
} as const;

/** 评级 */
export function getVitalRating(
  name: keyof typeof THRESHOLDS,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

/** 上报到 Sentry(如果可用) */
function reportToSentry(metric: Metric): void {
  // 动态导入避免循环依赖
  import("./sentry")
    .then(({ Sentry }) => {
      if (Sentry.getCurrentHub().getClient()) {
        const rating = getVitalRating(
          metric.name as keyof typeof THRESHOLDS,
          metric.value,
        );
        Sentry.setMeasurement(metric.name, metric.value, "millisecond");
        Sentry.setTag(`vital_${metric.name.toLowerCase()}_rating`, rating);
      }
    })
    .catch(() => {
      // Sentry 未配置,忽略
    });
}

/** 上报到分析端点(可对接自建 Prometheus / GA) */
function reportToAnalytics(metric: Metric): void {
  const endpoint = import.meta.env["VITE_ANALYTICS_ENDPOINT"] as
    | string
    | undefined;
  if (!endpoint) return;

  // 使用 sendBeacon 而非 fetch(避免影响卸载)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: getVitalRating(
        metric.name as keyof typeof THRESHOLDS,
        metric.value,
      ),
      id: metric.id,
      page: window.location.pathname,
      timestamp: Date.now(),
    });
    navigator.sendBeacon(endpoint, body);
  }
}

/** 上报到控制台(开发模式) */
function reportToConsole(metric: Metric): void {
  if (!import.meta.env.DEV) return;
  const rating = getVitalRating(
    metric.name as keyof typeof THRESHOLDS,
    metric.value,
  );
  const emoji =
    rating === "good" ? "" : rating === "needs-improvement" ? "" : "";
  console.info(
    `${emoji} ${metric.name}: ${metric.value.toFixed(1)} (${rating})`,
    { id: metric.id, page: window.location.pathname },
  );
}

/** 启动 Web Vitals 监控 */
export function reportWebVitals(reporter?: WebVitalReporter): void {
  const callback: WebVitalReporter = (metric) => {
    reporter?.(metric);
    reportToConsole(metric);
    reportToSentry(metric);
    reportToAnalytics(metric);
  };

  onLCP(callback);
  onFID(callback);
  onCLS(callback);
  onINP(callback);
  onTTFB(callback);
  onFCP(callback);
}

/** 性能标记工具 */
export const performanceMarks = {
  /** 标记 */
  mark(name: string): void {
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark(name);
    }
  },
  /** 测量两点 */
  measure(name: string, startMark: string, endMark?: string): number | null {
    if (typeof performance === "undefined" || !performance.measure) return null;
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, "measure");
      return entries[entries.length - 1]?.duration ?? null;
    } catch {
      return null;
    }
  },
  /** 获取导航计时 */
  getNavigationTiming(): {
    ttfb: number;
    domContentLoaded: number;
    load: number;
  } | null {
    if (typeof performance === "undefined") return null;
    const [entry] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (!entry) return null;
    return {
      ttfb: entry.responseStart - entry.requestStart,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
      load: entry.loadEventEnd - entry.startTime,
    };
  },
  /** 清除标记 */
  clear(name?: string): void {
    if (typeof performance === "undefined") return;
    if (name) {
      performance.clearMarks(name);
      performance.clearMeasures(name);
    } else {
      performance.clearMarks();
      performance.clearMeasures();
    }
  },
};

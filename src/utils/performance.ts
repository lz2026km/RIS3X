/**
 * G005 放射RIS系统 v3.0.0 - 性能优化工具
 * Phase T4-W9: 性能基线
 *
 * 提供:
 *   - useDebounce / useThrottle(高频事件)
 *   - useIntersection(懒加载)
 *   - prefetchRoute / preloadImage(预加载)
 *   - runWhenIdle(空闲调度)
 *   - getMemoryUsage(内存监控)
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

/** 性能标记集合 - 用于 PerformanceObserver 追踪 */
export const performanceMarks = {
  mark: (name: string): void => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name)
    }
  },
  measure: (name: string, start: string, end?: string): number => {
    if (typeof performance === 'undefined' || !performance.measure) return 0
    try {
      performance.measure(name, start, end)
      const entries = performance.getEntriesByName(name)
      return entries[entries.length - 1]?.duration ?? 0
    } catch {
      return 0
    }
  },
  clear: (name?: string): void => {
    if (typeof performance === 'undefined') return
    if (name) {
      performance.clearMeasures(name)
      performance.clearMarks(name)
    } else {
      performance.clearMeasures()
      performance.clearMarks()
    }
  },
}

/** 防抖 hook(用于 resize / scroll / search) */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** 节流 hook(用于高频事件) */
export function useThrottle<T>(value: T, interval = 100): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdate = useRef(Date.now());
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdate.current >= interval) {
      lastUpdate.current = now;
      setThrottled(value);
      return
    }
    const timer = setTimeout(() => {
      lastUpdate.current = Date.now();
      setThrottled(value);
    }, interval - (now - lastUpdate.current));
    return () => clearTimeout(timer);
  }, [value, interval]);
  return throttled;
}

/** IntersectionObserver hook(用于懒加载 / 无限滚动) */
export function useIntersection(
  options: IntersectionObserverInit = { threshold: 0.1 }
): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry?.isIntersecting ?? false);
    }, options);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}

/** 预加载下一页(路由 prefetch) */
export function prefetchRoute(path: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  link.as = 'document';
  document.head.appendChild(link);
}

/** 预加载图片 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/** 批量 DOM 更新(requestAnimationFrame) */
export function batchUpdates(callback: () => void): void {
  requestAnimationFrame(() => {
    callback();
  });
}

/** 空闲时执行 */
export function runWhenIdle(callback: () => void, timeout = 5000): void {
  if (typeof window === 'undefined' || !('requestIdleCallback' in window)) {
    setTimeout(callback, 1);
    return;
  }
  (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => void })
    .requestIdleCallback(callback, { timeout });
}

/** 内存使用估算 */
export function getMemoryUsage(): { used: number; limit: number } | null {
  if (typeof performance === 'undefined') return null;
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!memory) return null;
  return { used: memory.usedJSHeapSize, limit: memory.jsHeapSizeLimit };
}

/** 性能标记 */
export function mark(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/** 测量两点 */
export function measure(name: string, startMark: string, endMark?: string): number | null {
  if (typeof performance === 'undefined' || !performance.measure) return null;
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, 'measure');
    return entries[entries.length - 1]?.duration ?? null;
  } catch {
    return null;
  }
}

/** 导航计时 */
export function getNavigationTiming(): { ttfb: number; domContentLoaded: number; load: number } | null {
  if (typeof performance === 'undefined') return null;
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (!entry) return null;
  return {
    ttfb: entry.responseStart - entry.requestStart,
    domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
    load: entry.loadEventEnd - entry.startTime,
  };
}

// @ts-expect-error - stub
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void { let timer: any; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
// @ts-expect-error - stub
export function throttle<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void { let last = 0; return (...args) => { const now = Date.now(); if (now - last >= delay) { last = now; fn(...args); } }; }

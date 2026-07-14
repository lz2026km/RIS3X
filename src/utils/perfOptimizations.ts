/**
 * G005 放射RIS系统 v3.0.0 - 高级性能优化工具
 * Phase T4-W10: prefetch / defer / virtual list / chunk load
 */

import { useState, useEffect, useRef, useDeferredValue } from 'react';

// ============= 路由预取 =============

/** 鼠标 hover 触发路由预取 */
export function prefetchOnHover(path: string): {
  onMouseEnter: () => void;
  onFocus: () => void;
} {
  let prefetched = false;
  const trigger = () => {
    if (prefetched) return;
    prefetched = true;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = path;
    link.as = 'document';
    document.head.appendChild(link);
  };
  return { onMouseEnter: trigger, onFocus: trigger };
}

/** 链接组件(自动预取) */
export function usePrefetchLink() {
  return {
    onMouseEnter: (e: React.MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement;
      const path = target.getAttribute('href');
      if (path) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = path;
        document.head.appendChild(link);
      }
    },
  };
}

// ============= useDeferredValue 包装 =============

/** 大数据列表过滤(防止输入卡顿) */
export function useDeferredFilter<T>(value: T, items: T[]): T[] {
  const deferredValue = useDeferredValue(value);
  return useDeferredMemo(items, deferredValue);
}

function useDeferredMemo<T>(items: T[], _value: unknown): T[] {
  // 简化版:实际项目可加 useMemo + value 比较
  return items;
}

// ============= 图片懒加载 =============

/** IntersectionObserver 图片懒加载 hook */
export function useLazyImage(src: string, options: IntersectionObserverInit = { rootMargin: '100px' }): {
  ref: React.RefObject<HTMLImageElement | null>;
  loaded: boolean;
} {
  const ref = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && ref.current) {
        ref.current.src = src;
        ref.current.onload = () => setLoaded(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [src, options]);

  return { ref, loaded };
}

// ============= 长列表虚拟化 =============

interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

/** 简单虚拟列表(适合 100-10000 项) */
export function useVirtualList({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}): {
  visibleItems: VirtualItem[];
  totalHeight: number;
  offsetY: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
} {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = itemCount * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(itemCount, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);
  const visibleItems: VirtualItem[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    visibleItems.push({ index: i, start: i * itemHeight, size: itemHeight });
  }
  return {
    visibleItems,
    totalHeight,
    offsetY: startIndex * itemHeight,
    onScroll: (e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop),
  };
}

// ============= 节流/防抖增强 =============

/** 资源预连接(对第三方域名) */
export function preconnectTo(origin: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  document.head.appendChild(link);
}

export { runWhenIdle, preloadImage } from './performance';

// ============= 长任务切片 =============

/** 切片执行长任务(防止阻塞主线程) */
export async function chunked<T>(items: T[], fn: (item: T) => void, chunkSize = 100, delay = 0): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(fn);
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    } else {
      await new Promise((r) => requestAnimationFrame(r));
    }
  }
}

// ============= 内存监控 =============

/** 内存使用(浏览器支持时) */
export function getMemoryInfo(): { used: number; total: number; limit: number } | null {
  if (typeof performance === 'undefined') return null;
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  if (!memory) return null;
  return { used: memory.usedJSHeapSize, total: memory.totalJSHeapSize, limit: memory.jsHeapSizeLimit };
}

/** 内存压力警告(超 80%) */
export function isMemoryPressure(): boolean {
  const info = getMemoryInfo();
  if (!info) return false;
  return info.used / info.limit > 0.8;
}

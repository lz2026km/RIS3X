/**
 * useApiQuery - 通用 API 查询 hook (含超时/重试/安全 fallback)
 *
 * v3.0.6.10-1: 加入 timeoutMs/retry/retryDelayMs 配置,
 * 自动安全 fallback (data 为 null 时回退到 options.fallback).
 * 失败写入 error, 调用方可读出后展示 <ErrorBanner />.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { ApiResponse } from "../services/api/types";

export interface UseApiQueryOptions<T> {
  fallback?: T;
  immediate?: boolean;
  /** 请求超时 (ms), 默认 15000 */
  timeoutMs?: number;
  /** 失败重试次数, 默认 1 */
  retries?: number;
  /** 重试退避基准 (ms), 实际延迟 = retryDelayMs * 2^attempt, 默认 500 */
  retryDelayMs?: number;
}

export interface UseApiQueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY = 500;

/** 给 Promise 包一层超时, 超时 reject REQUEST_TIMEOUT */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** 简单的指数退避 sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useApiQuery<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  options: UseApiQueryOptions<T> = {}
): UseApiQueryResult<T> {
  const {
    fallback,
    immediate = true,
    timeoutMs = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
  } = options;

  const [data, setData] = useState<T | undefined>(fallback);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);

  // 用 ref 持有最新 fetcher, 避免依赖变更导致 effect 循环
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    let lastError: string | null = null;
    const totalAttempts = retries + 1;
    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        const res = await withTimeout(fetcherRef.current(), timeoutMs);
        if (res.success) {
          setData(res.data);
          setError(null);
          setLoading(false);
          return;
        }
        lastError = res.error?.message ?? "API 调用失败";
      } catch (err) {
        lastError =
          err instanceof Error && err.message === "REQUEST_TIMEOUT"
            ? "请求超时"
            : err instanceof Error
              ? err.message
              : "网络错误";
      }
      // 失败, 若还有重试机会则等待退避后重试
      if (attempt < totalAttempts - 1) {
        await sleep(retryDelayMs * Math.pow(2, attempt));
      }
    }
    // 所有尝试都失败
    setError(lastError ?? "请求失败");
    if (fallback !== undefined) {
      setData(fallback);
    }
    setLoading(false);
  }, [timeoutMs, retries, retryDelayMs, fallback]);

  useEffect(() => {
    if (immediate) {
      void refetch();
    }
  }, [immediate, refetch]);

  return { data, loading, error, refetch };
}

export default useApiQuery;
/**
 * useSafePagination - 防止分页越界的稳定分页 hook
 *
 * 行为:
 *  - total <= 0 → showPagination = false (UI 隐藏分页器)
 *  - setPage(x) 若 x 越界自动回退到最后一页并通过 onPageChange 回调
 *  - setPageSize(s) → page 重置为 1
 *  - setTotal(t) 若新 totalPages < currentPage 自动回退
 *
 * 用于: 列表页删除最后一页数据后, 避免 current 越界导致白屏
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

export interface SafePaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  /** total > 0 才显示分页器 */
  showPagination: boolean;
  totalPages: number;
}

export interface UseSafePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  /** 当 page 因 total 变化自动回退时触发, 业务侧应在此 refetch */
  onPageChange?: (page: number, pageSize: number) => void;
}

export interface UseSafePaginationReturn {
  config: SafePaginationConfig;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotal: (total: number) => void;
  reset: () => void;
}

export function useSafePagination(
  options: UseSafePaginationOptions = {}
): UseSafePaginationReturn {
  const { initialPage = 1, initialPageSize = 20, onPageChange } = options;
  const [page, setPageState] = useState<number>(initialPage);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);
  const [total, setTotalState] = useState<number>(0);

  // 用 ref 持有最新回调, 避免依赖变更导致 effect 循环
  const onChangeRef = useRef(onPageChange);
  useEffect(() => {
    onChangeRef.current = onPageChange;
  }, [onPageChange]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize))),
    [total, pageSize]
  );

  const showPagination = total > 0;

  // total 变化时自动回退越界 page (仅 total > 0 时)
  useEffect(() => {
    if (total > 0 && page > totalPages) {
      const safe = totalPages;
      setPageState(safe);
      onChangeRef.current?.(safe, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, pageSize, totalPages]);

  const setPage = useCallback(
    (next: number) => {
      if (next < 1) next = 1;
      if (total === 0) next = 1;
      else if (next > totalPages) next = totalPages;
      setPageState(next);
      onChangeRef.current?.(next, pageSize);
    },
    [pageSize, total, totalPages]
  );

  const setPageSize = useCallback(
    (size: number) => {
      if (size < 1) size = 1;
      setPageSizeState(size);
      setPageState(1);
      onChangeRef.current?.(1, size);
    },
    []
  );

  const setTotal = useCallback((t: number) => {
    setTotalState(Math.max(0, t));
  }, []);

  const reset = useCallback(() => {
    setPageState(initialPage);
    setPageSizeState(initialPageSize);
    setTotalState(0);
  }, [initialPage, initialPageSize]);

  return {
    config: { current: page, pageSize, total, showPagination, totalPages },
    setPage,
    setPageSize,
    setTotal,
    reset,
  };
}

export default useSafePagination;
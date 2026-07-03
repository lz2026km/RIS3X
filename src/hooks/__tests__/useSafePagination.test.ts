/**
 * useSafePagination 单元测试
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSafePagination } from "../useSafePagination";

describe("useSafePagination", () => {
  it("initial: total=0 → showPagination=false", () => {
    const { result } = renderHook(() => useSafePagination());
    expect(result.current.config.total).toBe(0);
    expect(result.current.config.showPagination).toBe(false);
  });

  it("setTotal(100) → showPagination=true, totalPages=5", () => {
    const { result } = renderHook(() => useSafePagination({ initialPageSize: 20 }));
    act(() => result.current.setTotal(100));
    expect(result.current.config.total).toBe(100);
    expect(result.current.config.showPagination).toBe(true);
    expect(result.current.config.totalPages).toBe(5);
  });

  it("setPage(100) when total=50 pageSize=20 → 自动回退到 totalPages (3)", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSafePagination({ initialPageSize: 20, onPageChange: onChange }));
    act(() => result.current.setTotal(50));
    act(() => result.current.setPage(100));
    expect(result.current.config.current).toBe(3); // ceil(50/20) = 3
    expect(onChange).toHaveBeenCalledWith(3, 20);
  });

  it("setPageSize(50) → page 重置为 1", () => {
    const { result } = renderHook(() => useSafePagination());
    act(() => result.current.setPage(5));
    act(() => result.current.setPageSize(50));
    expect(result.current.config.pageSize).toBe(50);
    expect(result.current.config.current).toBe(1);
  });

  it("setTotal(0) → showPagination=false", () => {
    const { result } = renderHook(() => useSafePagination());
    act(() => result.current.setPage(3));
    act(() => result.current.setTotal(0));
    expect(result.current.config.showPagination).toBe(false);
  });
  it("setPage(x) when total=0 → 回到 1", () => {
    const { result } = renderHook(() => useSafePagination());
    act(() => result.current.setPage(3));
    act(() => result.current.setTotal(0));
    act(() => result.current.setPage(5));
    expect(result.current.config.current).toBe(1);
  });

  it("reset → 回到 initial 状态", () => {
    const { result } = renderHook(() =>
      useSafePagination({ initialPage: 2, initialPageSize: 30 })
    );
    act(() => result.current.setPage(10));
    act(() => result.current.setPageSize(50));
    act(() => result.current.reset());
    expect(result.current.config.current).toBe(2);
    expect(result.current.config.pageSize).toBe(30);
    expect(result.current.config.total).toBe(0);
  });
});
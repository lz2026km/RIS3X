/**
 * useApiQuery 单元测试
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiQuery } from "../useApiQuery";

function okResponse<T>(data: T) {
  return Promise.resolve({ success: true, data } as never);
}

function errResponse(message: string) {
  return Promise.resolve({
    success: false,
    data: undefined,
    error: { code: "E", message },
  } as never);
}

describe("useApiQuery", () => {
  it("resolves: data 写入, error 清空", async () => {
    const fetcher = vi.fn(() => okResponse([{ id: 1 }]));
    const { result } = renderHook(() =>
      useApiQuery(fetcher, { fallback: [], immediate: false })
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("resolves success=false: error 写入, fallback 生效", async () => {
    const fetcher = vi.fn(() => errResponse("权限不足"));
    const { result } = renderHook(() =>
      useApiQuery<unknown[]>(fetcher, { fallback: [], immediate: false })
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toBe("权限不足");
    expect(result.current.data).toEqual([]);
  });

  it("rejects (网络错): 1 次重试仍失败 → error 写入", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("ECONNREFUSED")));
    const { result } = renderHook(() =>
      useApiQuery<unknown[]>(fetcher, { fallback: [], immediate: false, retryDelayMs: 10 })
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(2); // 1 次 + 1 次重试
    expect(result.current.error).toBe("ECONNREFUSED");
  });

  it("rejects 第一次, 第二次 resolve → data 写入 (重试成功)", async () => {
    let count = 0;
    const fetcher = vi.fn(() => {
      count++;
      if (count === 1) return Promise.reject(new Error("TRANSIENT"));
      return okResponse([{ id: 99 }]);
    });
    const { result } = renderHook(() =>
      useApiQuery(fetcher, { fallback: [], immediate: false, retryDelayMs: 10 })
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual([{ id: 99 }]);
    expect(result.current.error).toBeNull();
  });
});
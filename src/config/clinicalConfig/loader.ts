// [ClinicalConfig] 启动时校验 + 加载配置
// 失败时让应用不渲染（Epic 风格）
import type { z } from "zod";

export type ConfigLayer = "default" | "override" | "patch";

export interface LoadResult<T> {
  ok: boolean;
  data?: T;
  errors?: z.ZodError[];
  source?: string;
}

export interface MergeLayers {
  defaults: unknown;
  override?: unknown;
  patch?: unknown;
}

/** 合并三层：defaults <- override <- patch (后者覆盖前者) */
export function mergeLayers<T>(layers: MergeLayers): T {
  // Deep merge: arrays are replaced (not concatenated); objects are merged recursively
  return deepMerge(layers.defaults, layers.override, layers.patch) as T;
}

function deepMerge(...sources: unknown[]): unknown {
  let result: unknown = undefined;
  for (const src of sources) {
    if (src === undefined || src === null) continue;
    if (result === undefined) { result = clone(src); continue; }
    if (isPlainObject(result) && isPlainObject(src)) {
      const out: Record<string, unknown> = { ...(result as Record<string, unknown>) };
      for (const key of Object.keys(src as Record<string, unknown>)) {
        const sv = (src as Record<string, unknown>)[key];
        const rv = out[key];
        if (isPlainObject(sv) && isPlainObject(rv)) {
          out[key] = deepMerge(rv, sv);
        } else if (sv !== undefined) {
          out[key] = clone(sv);
        }
      }
      result = out;
    } else {
      result = clone(src);
    }
  }
  return result;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export interface ValidateResult<T> {
  ok: boolean;
  data?: T;
  error?: z.ZodError;
}

/** 用 zod schema 校验（顶层，简单的错误格式） */
export function validate<S extends z.ZodTypeAny>(schema: S, input: unknown): ValidateResult<z.infer<S>> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data as z.infer<S> };
  return { ok: false, error: r.error };
}
/**
 * [G005 v3.0.6.16-0] 数据字典消费 Hook
 *
 * 背景: 后端 `DictEntry` 字典表**早已上线** (Prisma 模型 + migration 种子 8 分类
 * 20 条, `extra.pinyin` 拼音字段齐备, controller/service/前端 dictionaryApi 全有),
 * 但**业务页消费者为 0** —— 723 个 `<Select>` 各自硬编码 options, 导致:
 *   - 33 处硬编码 modality 出现 19 个不同版本 (MR/MRI, DR/DX, PETCT/PET-CT…)
 *   - ≈25 个医生/护士下拉写死, 机构新增人员后永远看不到
 *   - 4 处 Select 完全没有 label, 界面直接渲染英文枚举
 *
 * 本 Hook 把字典接进业务页, 并提供:
 *  - module 级缓存 (同一分类多组件共享一次请求)
 *  - 订阅机制 (数据到位后已挂载组件自动刷新)
 *  - `extra.pinyin` 驱动的拼音搜索过滤 (中文名按拼音首字母可搜)
 *  - 加载中 / 失败态, 避免"接口失败 -> 静默空下拉"
 */
import { useEffect, useMemo, useState } from 'react';
import { dictionaryApi, type DictEntryDto } from '../services/api/dictionaryApi';

export interface DictOption {
  value: string;
  label: string;
  /** 拼音, 用于 showSearch 的 filterOption */
  pinyin?: string;
  /** 原始条目, 需要 extra 时自行读取 */
  raw: DictEntryDto;
}

interface DictState {
  items: DictEntryDto[];
  loading: boolean;
  error: string | null;
  updatedAt: number;
}

const cache = new Map<string, DictState>();
const subscribers = new Map<string, Set<() => void>>();

function notify(category: string) {
  subscribers.get(category)?.forEach((fn) => fn());
}

function subscribe(category: string, fn: () => void): () => void {
  if (!subscribers.has(category)) subscribers.set(category, new Set());
  subscribers.get(category)!.add(fn);
  return () => {
    subscribers.get(category)?.delete(fn);
  };
}

function toOptions(items: DictEntryDto[]): DictOption[] {
  return items
    .filter((e) => e.active !== false)
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((e) => ({
      value: e.key,
      label: e.value,
      pinyin: typeof (e.extra as { pinyin?: unknown })?.pinyin === 'string'
        ? String((e.extra as { pinyin?: string }).pinyin)
        : undefined,
      raw: e,
    }));
}

/** 拉取指定分类 (带缓存 + 去重并发) */
export function loadDict(category: string, force = false): Promise<DictOption[]> {
  const cached = cache.get(category);
  if (!force && cached && !cached.loading) return Promise.resolve(toOptions(cached.items));
  const set: DictState = { items: cached?.items ?? [], loading: true, error: null, updatedAt: Date.now() };
  cache.set(category, set);

  return dictionaryApi
    .listEntries(category)
    .then((res) => {
      // listEntries 返回 ApiResponse<DictEntryDto[]>
      const payload = Array.isArray(res?.data) ? res.data : [];
      const items = Array.isArray(payload) ? payload : [];
      cache.set(category, { items, loading: false, error: null, updatedAt: Date.now() });
      notify(category);
      return toOptions(items);
    })
    .catch((err: unknown) => {
      const message = (err as Error)?.message ?? 'unknown';
      cache.set(category, { items: set.items, loading: false, error: message, updatedAt: Date.now() });
      notify(category);
      // 不 throw: 调用方通过 error 状态展示错误提示, 而不是让整页崩
      return toOptions(set.items);
    });
}

/**
 * 消费字典分类。
 * @param category 字典分类 (如 'CT检查项目' / 'MRI序列' / '设备类型' / '检查部位' / '造影剂')
 */
export function useDict(category: string | null | undefined) {
  const state = cache.get(category ?? '') ?? { items: [], loading: false, error: null, updatedAt: 0 };
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!category) return;
    void loadDict(category);
    return subscribe(category, () => forceUpdate((n) => n + 1));
  }, [category]);

  const options = useMemo(() => toOptions(state.items), [state.items, state.updatedAt]);

  return {
    options,
    loading: state.loading,
    error: state.error,
    reload: () => void loadDict(category ?? '', true),
  };
}

/**
 * 拼音/中文/编码 三态搜索过滤 —— 直接给 antd Select 的 `filterOption`。
 * 无拼音数据时退化为普通包含匹配, 行为不变。
 */
export function dictFilter(input: string, option?: unknown): boolean {
  const q = input.trim().toLowerCase();
  if (!q) return true;
  const opt = option as DictOption | undefined;
  if (!opt) return false;
  if (String(opt.label).toLowerCase().includes(q)) return true;
  if (String(opt.value).toLowerCase().includes(q)) return true;
  if (opt.pinyin && opt.pinyin.toLowerCase().includes(q)) return true;
  // 支持首字母缩写 (如 "cts" 匹配"胸部CT")
  const initials = String(opt.pinyin ?? '')
    .split(/[\s,]+/)
    .map((s) => s.charAt(0))
    .join('');
  return initials.length > 0 && initials.includes(q);
}

/** 字典分类常量 (与后端 migration 11_dictionary 的种子分类严格对应) */
export const DICT_CATEGORY = {
  ctExam: 'CT检查项目',
  mrSequence: 'MRI序列',
  xrayExam: 'X线检查',
  deviceType: '设备类型',
  diagnosisTerm: '诊断术语',
  bodyPart: '检查部位',
  contrastAgent: '造影剂',
  positionTech: '体位技术',
} as const;

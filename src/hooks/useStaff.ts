/**
 * [G005 v3.0.6.16-1] 人员 (医生/护士/技师/科室) 选择 Hook
 *
 * 背景: 审查发现全站 **12 个文件 / ≈25 个下拉把医生、护士、技师、责任医生
 * 写死** (如 `[{value:'u-001',label:'张主任'}, {value:'u-002',label:'李医生'}]`)。
 * 后果: 机构新增医生/轮岗/离职后, 这些下拉**永远看不到新人**, 提交的 ownerId
 * 也是不存在的假 ID —— 质控 PDCA 责任人、AI 分诊指派等业务数据直接失真。
 *
 * 本 Hook 消费后端 `GET /users` (UserDto 含 role / department), 提供:
 *  - 按角色过滤 (DOCTOR / TECHNICIAN / NURSE / ...)
 *  - 远程搜索 (按姓名 / 用户名 / 科室), 配合 AppSelectField
 *  - module 级缓存, 同一角色集合多组件共享一次请求
 *  - 失败时返回空列表并暴露 error, 由调用方决定是否禁用 (不伪造人员)
 */
import { useEffect, useMemo, useState } from 'react';
import { userApi } from '../services/api/userApi';
import type { UserDto } from '../types/dto';

export type StaffRole = UserDto['role'] | 'ALL';

export interface StaffOption {
  value: string;
  label: string;
  /** 姓名 (中文) */
  name: string;
  username: string;
  role: UserDto['role'];
  department?: string;
  raw: UserDto;
}

interface StaffCacheEntry {
  items: StaffOption[];
  loading: boolean;
  error: string | null;
  updatedAt: number;
}

const cache = new Map<string, StaffCacheEntry>();
const subscribers = new Map<string, Set<() => void>>();

const ROLE_LABELS: Record<UserDto['role'], string> = {
  ADMIN: '管理员',
  DIRECTOR: '主任',
  DOCTOR: '医生',
  TECHNICIAN: '技师',
  NURSE: '护士',
};

export function staffRoleLabel(role: UserDto['role']): string {
  return ROLE_LABELS[role] ?? role;
}

function toOption(u: UserDto): StaffOption {
  const name = (u.fullName || u.username || '').trim();
  const dept = (u.department ?? '').trim();
  return {
    // 用 id 作 value: 与后端主键一致, 提交的数据可直接落库
    value: u.id,
    label: dept ? `${name} · ${dept}` : name,
    name,
    username: u.username,
    role: u.role,
    department: u.department,
    raw: u,
  };
}

/** 拉取人员列表 (带缓存, 按角色缓存) */
export function loadStaff(role: StaffRole = 'ALL', force = false): Promise<StaffOption[]> {
  const key = role;
  const cached = cache.get(key);
  if (!force && cached && !cached.loading) return Promise.resolve(cached.items);

  const prev = cached?.items ?? [];
  cache.set(key, { items: prev, loading: true, error: null, updatedAt: Date.now() });

  return userApi
    .list(0, 500)
    .then((res) => {
      const all = Array.isArray(res?.data) ? res.data : [];
      const filtered = role === 'ALL' ? all : all.filter((u) => u.role === role);
      const items = filtered
        .filter((u) => u.active !== false)
        .map(toOption)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
      cache.set(key, { items, loading: false, error: null, updatedAt: Date.now() });
      subscribers.get(key)?.forEach((fn) => fn());
      return items;
    })
    .catch((err: unknown) => {
      cache.set(key, {
        items: prev,
        loading: false,
        error: (err as Error)?.message ?? 'unknown',
        updatedAt: Date.now(),
      });
      subscribers.get(key)?.forEach((fn) => fn());
      return prev;
    });
}

/** 消费人员列表 */
export function useStaff(role: StaffRole = 'ALL') {
  const entry = cache.get(role) ?? { items: [], loading: false, error: null as string | null, updatedAt: 0 };
  const [, force] = useState(0);

  useEffect(() => {
    void loadStaff(role);
    if (!subscribers.has(role)) subscribers.set(role, new Set());
    const set = subscribers.get(role)!;
    const fn = () => force((n) => n + 1);
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }, [role]);

  const options = useMemo(() => entry.items, [entry.items, entry.updatedAt]);

  return {
    options,
    loading: entry.loading,
    error: entry.error,
    reload: () => void loadStaff(role, true),
  };
}

/** 姓名 / 用户名 / 科室 三态搜索过滤 */
export function staffFilter(input: string, option?: unknown): boolean {
  const q = input.trim().toLowerCase();
  if (!q) return true;
  const o = option as StaffOption | undefined;
  if (!o) return false;
  return (
    o.name.toLowerCase().includes(q) ||
    o.username.toLowerCase().includes(q) ||
    (o.department ?? '').toLowerCase().includes(q)
  );
}

/** 科室去重列表 (由已加载的人员派生, 不再硬编码) */
export function useDepartments(role: StaffRole = 'ALL') {
  const { options } = useStaff(role);
  return useMemo(() => {
    const set = new Set<string>();
    for (const o of options) if (o.department) set.add(o.department);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [options]);
}

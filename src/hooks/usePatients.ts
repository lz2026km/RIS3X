/**
 * [G005 v3.0.6.16-1] 患者选择 Hook (远程搜索)
 *
 * 背景: 预约/登记等表单此前把患者写死 6 个中文姓名
 * (`['张伟','李娜','王芳','赵敏','陈杰','刘洋']`), 且 value 直接用中文姓名作主键 ——
 * 真实患者超过 6 人就选不到, 预约单里的"患者"还不是合法 patientId。
 *
 * 本 Hook 走 `GET /patients?search=` 远程搜索, value 使用真实 patientId。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { patientApi } from '../services/api/patientApi';

export interface PatientOption {
  value: string;
  label: string;
  raw: unknown;
}

interface PatientQueryState {
  options: PatientOption[];
  loading: boolean;
  error: string | null;
}

/** 最近一次查询结果的短时缓存 (键 = 搜索词), 避免来回切换反复请求 */
const recentCache = new Map<string, PatientOption[]>();
const RECENT_LIMIT = 20;
const CACHE_TTL_MS = 60_000;
const cacheStamp = new Map<string, number>();

function toOption(p: Record<string, unknown>): PatientOption {
  const id = String(p['patientId'] ?? p['id'] ?? p['empiId'] ?? '');
  const name = String(p['name'] ?? p['patientName'] ?? '');
  const gender = String(p['gender'] ?? '');
  const age = p['age'] !== undefined && p['age'] !== null ? String(p['age']) : '';
  const bits = [name, gender, age ? `${age}岁` : ''].filter(Boolean);
  return { value: id, label: bits.length > 1 ? `${name} · ${[gender, age ? `${age}岁` : ''].filter(Boolean).join(' ')} (${id})` : `${name || id} (${id})`, raw: p };
}

/**
 * 患者远程搜索。
 * @param enabled 是否启用 (配合 Modal 打开时再加载)
 */
export function usePatients(enabled = true) {
  const [state, setState] = useState<PatientQueryState>({ options: [], loading: false, error: null });
  const seq = useRef(0);

  const search = useMemo(
    () => async (keyword: string) => {
      const q = keyword.trim();
      if (!enabled) return;
      const cached = recentCache.get(q);
      if (cached && Date.now() - (cacheStamp.get(q) ?? 0) < CACHE_TTL_MS) {
        setState({ options: cached, loading: false, error: null });
        return;
      }
      const my = ++seq.current;
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await patientApi.list({ search: q, pageSize: 30 });
        const list = Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
        const options = list.map(toOption).filter((o) => o.value);
        if (my !== seq.current) return; // 丢弃过期响应
        recentCache.set(q, options);
      cacheStamp.set(q, Date.now());
        if (recentCache.size > RECENT_LIMIT) {
          const oldest = recentCache.keys().next().value;
          if (oldest !== undefined) {
            recentCache.delete(oldest);
            cacheStamp.delete(oldest);
          }
        }
        setState({ options, loading: false, error: null });
      } catch (err) {
        if (my !== seq.current) return;
        // 失败时清空并暴露错误, 不保留上一次结果冒充"搜不到"
        setState({ options: [], loading: false, error: (err as Error)?.message ?? 'unknown' });
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (enabled) void search('');
  }, [enabled, search]);

  return { ...state, search };
}

/**
 * [G005 v3.0.6.16-0] 检查模态 (modality) 单一真源
 *
 * 审查发现: 全站 **33 处硬编码 modality 数组, 出现 19 个不同版本** ——
 *   MR / MRI、DR / DX、CBCT / PETCT / PET-CT 拼写不一致,
 * 导致跨页统计口径分裂 (StatisticsPage 甚至用了 'GI')。
 *
 * 本文件收敛为唯一来源, 新增模态必须在此登记:
 *   - `MODALITIES`      展示用 label + 英文 value (值保持英文以兼容后端/历史数据)
 *   - `MODALITY_VALUES` 便于 map 生成 options
 *   - `normalizeModality()` 兼容历史拼写, 用于统计/筛选口径归一
 */
export interface ModalityDef {
  /** 英文值 (后端 / DICOM / 历史数据统一使用) */
  value: string;
  /** 中文展示名 */
  label: string;
  /** 历史别名: 归一到 value */
  aliases: string[];
}

export const MODALITIES: readonly ModalityDef[] = [
  { value: 'CT', label: 'CT', aliases: [] },
  { value: 'MR', label: 'MR', aliases: ['MRI'] },
  { value: 'DR', label: 'DR', aliases: ['DX', 'X-ray', 'Xray'] },
  { value: 'US', label: '超声', aliases: ['USG'] },
  { value: 'MG', label: '乳腺钼靶', aliases: ['MG', 'MMG'] },
  { value: 'DSA', label: 'DSA', aliases: [] },
  { value: 'CBCT', label: 'CBCT', aliases: [] },
  { value: 'PETCT', label: 'PET-CT', aliases: ['PET-CT', 'PETCT'] },
  { value: 'RF', label: '射频', aliases: [] },
  { value: 'CR', label: 'CR', aliases: [] },
  { value: 'XA', label: 'XA', aliases: [] },
] as const;

/** 便于 `MODALITIES.map(...)` 的值数组 */
export const MODALITY_VALUES: readonly string[] = MODALITIES.map((m) => m.value);

/** 便于直接生成 antd options (带 label, 不再出现裸 value)。
 * 刻意声明为可变数组: antd SelectProps.options 是可变数组类型。 */
export const MODALITY_OPTIONS: Array<{ value: string; label: string }> = MODALITIES.map((m) => ({
  value: m.value,
  label: m.label,
}));

const ALIAS_MAP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const m of MODALITIES) {
    map.set(m.value.toUpperCase(), m.value);
    for (const a of m.aliases) map.set(a.toUpperCase(), m.value);
  }
  return map;
})();

/** 把历史/别名写法归一到标准 value; 未知值原样返回 (不丢数据) */
export function normalizeModality(input: unknown): string {
  const s = String(input ?? '').trim();
  if (!s) return s;
  return ALIAS_MAP.get(s.toUpperCase()) ?? s;
}

/** 取展示名; 未知值回落为原值 */
export function modalityLabel(value: unknown): string {
  const s = String(value ?? '').trim();
  const canonical = normalizeModality(s);
  return MODALITIES.find((m) => m.value === canonical)?.label ?? s;
}

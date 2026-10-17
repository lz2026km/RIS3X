/**
 * [G005 v3.0.6.16-0] 统一下拉封装 AppSelectField
 *
 * 背景: 设计文档 `docs/v3.0.0-DESIGN-SYSTEM.md:138` 承诺了
 * `AppSelectField / AppCascaderField / AppTreeSelectField / AppAutoCompleteField`,
 * 但**代码里从未实现** (全仓检索 0 命中) —— 723 个 `<Select>` 各自手写 options,
 * 因此反复出现: 无 label 显示英文枚举 / 枚举硬编码 / showSearch 无拼音过滤 /
 * 接口失败静默空下拉。
 *
 * 本组件一次性收口:
 *  - **label 兜底**: value 缺失时回落为 value, 杜绝"界面直接显示 stat/urgent"
 *  - **字典接入**: 传 `dictCategory` 即自动消费后端 DictEntry (含拼音搜索)
 *  - **统一空/错/载态**: loading / error / notFoundContent 全站一致
 *    (接口失败不再静默变成空下拉)
 *  - **搜索修正**: showSearch 默认带 filterOption, 按 value/label/pinyin 匹配
 */
import { Select, Alert } from 'antd';
import type { SelectProps } from 'antd';
import { useDict, dictFilter, type DictOption } from '../../hooks/useDict';

export interface AppSelectFieldProps<T = unknown>
  extends Omit<SelectProps<T>, 'options' | 'filterOption'> {
  /** 静态选项 (与 dictCategory 二选一) */
  options?: Array<{ value: string; label: string; [k: string]: unknown }>;
  /** 字典分类: 传入后自动从后端加载, 优先级高于 options */
  dictCategory?: string;
  /** 是否开启搜索 (默认跟随字典/静态选项规模) */
  searchable?: boolean;
  /**
   * 自定义搜索过滤。传入后覆盖内部默认实现 ——
   * 供 AppStaffField 等按业务字段(姓名/用户名/科室)过滤的下拉使用。
   */
  filterOption?: (input: string, option?: unknown) => boolean;
  /** 便于 E2E 定位 (Select 不透传任意 data-* 属性) */
  'data-testid'?: string;
}

/**
 * 关键行为: 无论静态还是字典, 都保证每个 option 有 label。
 * 审查发现 4 处 Select 写成 `options={['CT','MR'].map(v => ({ value: v }))}`,
 * antd 会直接回退显示裸 value, 中文用户看到的是 "stat" / "urgent"。
 */
function withLabelFallback(
  options: Array<{ value: string; label: string; [k: string]: unknown }>,
): Array<{ value: string; label: string; [k: string]: unknown }> {
  return options.map((o) => ({
    ...o,
    label: typeof o.label === 'string' && o.label.trim().length > 0 ? o.label : String(o.value),
  }));
}

export function AppSelectField<T = unknown>({
  options,
  dictCategory,
  searchable,
  placeholder,
  filterOption,
  ...rest
}: AppSelectFieldProps<T>) {
  const dict = useDict(dictCategory);

  const finalOptions = dictCategory
    ? (dict.options as unknown as Array<{ value: string; label: string; [k: string]: unknown }>)
    : withLabelFallback(options ?? []);

  const shouldSearch = searchable ?? (dictCategory ? true : finalOptions.length > 7);

  // 字典加载失败 -> 显式告警, 而不是让用户面对一个"永远打不开的空下拉"
  if (dictCategory && dict.error && finalOptions.length === 0) {
    return (
      <Alert
        type="warning"
        showIcon
        message={`字典「${dictCategory}」加载失败`}
        description={`${dict.error} — 请检查字典服务, 或稍后重试。`}
        action={
          <a onClick={dict.reload} role="button">
            重试
          </a>
        }
      />
    );
  }

  return (
    <Select<T>
      {...rest}
      placeholder={placeholder}
      loading={dictCategory ? dict.loading : undefined}
      showSearch={shouldSearch}
      options={finalOptions}
      // 显式传入的 filterOption 优先; 否则字典走拼音过滤, 静态列表至少保证按 label 可搜
      filterOption={
        filterOption ??
        (dictCategory
          ? (input, option) => dictFilter(input, option)
          : shouldSearch
            ? (input, option) => {
                const q = input.trim().toLowerCase();
                if (!q) return true;
                const o = option as DictOption | { value?: string; label?: string } | undefined;
                return (
                  String(o?.label ?? '').toLowerCase().includes(q) ||
                  String(o?.value ?? '').toLowerCase().includes(q)
                );
              }
            : undefined)
      }
      notFoundContent={
        dictCategory && dict.loading ? undefined : finalOptions.length === 0 ? '暂无可选项' : undefined
      }
    />
  );
}

export default AppSelectField;

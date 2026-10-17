/**
 * [G005 v3.0.6.16-1] 人员选择下拉 (医生 / 技师 / 护士 / 责任人)
 *
 * 供各业务页替换写死的人员下拉 (审查发现 12 文件 / ≈25 处)。
 * 与 `AppSelectField` 共用统一空态 / 错误态 / 搜索体验。
 */
import { AppSelectField } from './AppSelectField';
import { useStaff, staffFilter, staffRoleLabel, type StaffRole, type StaffOption } from '../../hooks/useStaff';

export interface AppStaffFieldProps {
  /** 人员角色; 不传表示全部角色 */
  role?: StaffRole;
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  id?: string;
  'data-testid'?: string;
}

export function AppStaffField({
  role = 'DOCTOR',
  value,
  onChange,
  placeholder,
  allowClear = true,
  disabled,
  style,
  className,
  id,
  'data-testid': testId,
}: AppStaffFieldProps) {
  const { options, loading, error } = useStaff(role);

  return (
    <AppSelectField
      id={id}
      data-testid={testId}
      className={className}
      style={style}
      disabled={disabled}
      allowClear={allowClear}
      showSearch
      value={value}
      placeholder={placeholder ?? (error ? '人员清单加载失败' : `选择${staffRoleLabel(role === 'ALL' ? 'DOCTOR' : role)}`)}
      loading={loading}
      // 加载失败且无数据时, 不展示空下拉冒充"没有这个人"
      notFoundContent={
        error && options.length === 0
          ? '人员清单加载失败，请检查用户服务后重试'
          : options.length === 0
            ? loading
              ? undefined
              : '暂无可选人员'
            : undefined
      }
      filterOption={(input: string, option?: unknown) => staffFilter(input, option as StaffOption)}
      onChange={(v) => onChange?.(v as string | undefined)}
      options={options as unknown as Array<{ value: string; label: string }>}
    />
  );
}

export default AppStaffField;

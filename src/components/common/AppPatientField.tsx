/**
 * [G005 v3.0.6.16-1] 患者选择下拉 (远程搜索)
 *
 * 供预约/登记等表单替换写死的患者姓名数组。value 为真实 patientId。
 */
import { AppSelectField } from './AppSelectField';
import { usePatients, type PatientOption } from '../../hooks/usePatients';

export interface AppPatientFieldProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  id?: string;
  'data-testid'?: string;
  /** 是否启用远程加载 (Modal 打开时再启用可省一次请求) */
  enabled?: boolean;
}

export function AppPatientField({
  value,
  onChange,
  placeholder,
  disabled,
  style,
  className,
  id,
  'data-testid': testId,
  enabled = true,
}: AppPatientFieldProps) {
  const { options, loading, error, search } = usePatients(enabled);

  return (
    <AppSelectField
      id={id}
      data-testid={testId}
      className={className}
      style={style}
      disabled={disabled}
      showSearch
      // 按需远程搜索: 输入即查, 不用一次性拉全量患者
      onSearch={search}
      filterOption={false}
      value={value}
      placeholder={placeholder ?? (error ? '患者检索失败' : '搜索患者姓名 / 病历号')}
      loading={loading}
      notFoundContent={
        error && options.length === 0
          ? '患者检索失败，请检查患者服务后重试'
          : options.length === 0
            ? loading
              ? undefined
              : '未匹配到患者（可尝试病历号）'
            : undefined
      }
      onChange={(v) => onChange?.(v as string | undefined)}
      options={options as unknown as Array<{ value: string; label: string }>}
    />
  );
}

export default AppPatientField;
export type { PatientOption };

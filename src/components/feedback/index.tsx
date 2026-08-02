/**
 * G005 放射RIS系统 v3.0.0 - EmptyState 业务组件
 * Phase T2-W4
 * v3.0.6.8-23c (A9): AppEmpty 窄屏 minHeight 调整 + 1 套空态图标
 */

import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Progress, Result } from 'antd';
import { InboxOutlined, FileSearchOutlined, WarningOutlined } from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export interface AppEmptyProps {
  /** 场景 */
  variant?: 'no-data' | 'no-results' | 'no-permission' | 'error';
  /** 自定义描述 */
  description?: ReactNode;
  /** 操作 */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** 图片(可选自定义) */
  image?: ReactNode;
  /** 图片样式 */
  imageStyle?: CSSProperties;
  /** 自定义最小高度（默认移动端 200px / 桌面端 300px） */
  minHeight?: number;
}

const VARIANT_ICONS: Record<NonNullable<AppEmptyProps['variant']>, ReactNode> = {
  'no-data': <InboxOutlined style={{ fontSize: 64, color: '#94a3b8' }} />,
  'no-results': <FileSearchOutlined style={{ fontSize: 64, color: '#94a3b8' }} />,
  'no-permission': <WarningOutlined style={{ fontSize: 64, color: '#f59e0b' }} />,
  'error': <WarningOutlined style={{ fontSize: 64, color: '#dc2626' }} />,
};

const VARIANT_DEFAULTS: Record<NonNullable<AppEmptyProps['variant']>, string> = {
  'no-data': 'noData',
  'no-results': 'noResults',
  'no-permission': 'error:forbidden',
  'error': 'error:serverError',
};

export function AppEmpty({
  variant = 'no-data',
  description,
  action,
  image,
  imageStyle,
  minHeight,
}: AppEmptyProps) {
  const { t } = useTranslation();
  const defaultDesc = t(VARIANT_DEFAULTS[variant]);
  const icon = image ?? VARIANT_ICONS[variant];

  // A9-P1-4/5: 窄屏 minHeight 调整
  const bp = useBreakpoint();
  const isNarrow = bp === 'xs' || bp === 'sm';
  const defaultMinHeight = isNarrow ? 200 : 300;
  const resolvedMinHeight = minHeight ?? defaultMinHeight;

  return (
    <div
      className="app-empty"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12) var(--space-6)',
        minHeight: resolvedMinHeight,
        textAlign: 'center',
      }}
      role="status"
    >
      <Empty
        image={icon}
        imageStyle={{ height: isNarrow ? 56 : 80, ...imageStyle }}
        description={
          <span style={{ color: 'var(--color-gray-500)', fontSize: 14 }}>
            {description ?? defaultDesc}
          </span>
        }
      />
      {action && (
        <Button
          type="primary"
          onClick={action.onClick}
          style={{ marginTop: 16 }}
          aria-label={action.label}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============= Progress 业务封装 =============
export interface AppProgressProps {
  /** 0-100 */
  percent: number;
  /** 状态 */
  status?: 'normal' | 'success' | 'error' | 'active';
  /** 显示文字 */
  showInfo?: boolean;
  /** 大小 */
  size?: 'default' | 'small';
  /** 颜色 */
  strokeColor?: string | { from: string; to: string };
  /** aria-label */
  ariaLabel?: string;
}


export function AppProgress({
  percent,
  status = 'normal',
  showInfo = true,
  size = 'default',
  strokeColor,
  ariaLabel,
}: AppProgressProps) {
  // 限制 0-100
  const safePercent = Math.max(0, Math.min(100, percent));

  // 自动根据 percent 推断 status
  let computedStatus: 'normal' | 'success' | 'error' | 'active' = status;
  if (status === 'normal') {
    if (safePercent >= 100) computedStatus = 'success';
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={safePercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div aria-hidden="true">
        <Progress
          percent={safePercent}
          status={computedStatus}
          showInfo={showInfo}
          size={size}
          strokeColor={strokeColor}
        />
      </div>
    </div>
  );
}

// ============= Alert 业务封装 =============
export interface AppAlertProps {
  /** 类型 */
  type?: 'success' | 'info' | 'warning' | 'error';
  /** 标题 */
  message: ReactNode;
  /** 描述 */
  description?: ReactNode;
  /** 可关闭 */
  closable?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 是否显示图标 */
  showIcon?: boolean;
}


export function AppAlert({
  type = 'info',
  message,
  description,
  closable = false,
  onClose,
  showIcon = true,
}: AppAlertProps) {
  return (
    <Alert
      type={type}
      title={message}
      description={description}
      closable={closable}
      onClose={onClose}
      showIcon={showIcon}
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
    />
  );
}

// ============= Result 业务封装 =============
export interface AppResultProps {
  status: 'success' | 'error' | 'info' | 'warning' | '404' | '403' | '500';
  title: ReactNode;
  subTitle?: ReactNode;
  extra?: ReactNode;
}


export function AppResult({ status, title, subTitle, extra }: AppResultProps) {
  return (
    <Result
      status={status}
      title={title}
      subTitle={subTitle}
      extra={extra ?? <Button type="primary">返回</Button>}
    />
  );
}

// 重新导出 v3.0.2.7 新增的 API 状态横幅组件
export { LoadingBanner } from './LoadingBanner';
export { ErrorBanner } from './ErrorBanner';
export { NetworkOfflineBanner } from './NetworkOfflineBanner';

// Command Palette
export { CommandPalette } from './CommandPalette';

// Settings Panel
export { SettingsPanel } from './SettingsPanel';

// Export Dialog
export { ExportDialog } from './ExportDialog';


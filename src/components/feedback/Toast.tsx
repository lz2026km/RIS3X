/**
 * G005 放射RIS系统 v3.0.0 - Feedback 业务组件
 * Phase T2-W4: Toast / Modal / Notification / Confirm 封装
 *
 * 统一 antd 5 App.useApp() 模式,避免静态方法警告
 * 支持 i18n + a11y + 主题
 */

import { useTranslation } from 'react-i18next';
import { App, Modal, type ModalFuncProps } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined, InfoCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useEffect, type ReactNode } from 'react';

// ============= Toast 业务封装 =============
export function useToast() {
  const { message } = App.useApp();
  const { t } = useTranslation();

  return {
    success: (content: string, duration = 3) => {
      message.success({ content, duration, icon: <CheckCircleOutlined /> });
    },
    error: (content: string, duration = 4) => {
      message.error({ content, duration, icon: <CloseCircleOutlined /> });
    },
    warning: (content: string, duration = 4) => {
      message.warning({ content, duration, icon: <ExclamationCircleOutlined /> });
    },
    info: (content: string, duration = 3) => {
      message.info({ content, duration, icon: <InfoCircleOutlined /> });
    },
    loading: (content: string) => message.loading({ content, duration: 0 }),
    // 业务语义
    saved: () => message.success({ content: t('common.success'), duration: 2 }),
    deleted: () => message.success({ content: t('common.delete'), duration: 2 }),
    failed: () => message.error({ content: t('common.error'), duration: 3 }),
  };
}

// ============= Notification 业务封装 =============
export function useNotification() {
  const { notification } = App.useApp();
  const { t } = useTranslation();

  return {
    success: (title: string, description?: ReactNode) => {
      notification.success({
        message: title,
        description,
        placement: 'topRight',
        duration: 4,
      });
    },
    error: (title: string, description?: ReactNode) => {
      notification.error({
        message: title,
        description,
        placement: 'topRight',
        duration: 6,
      });
    },
    warning: (title: string, description?: ReactNode) => {
      notification.warning({
        message: title,
        description,
        placement: 'topRight',
        duration: 5,
      });
    },
    info: (title: string, description?: ReactNode) => {
      notification.info({
        message: title,
        description,
        placement: 'topRight',
        duration: 4,
      });
    },
    open: (config: Parameters<typeof notification.open>[0]) => notification.open(config),
    // 业务:危急值通知
    criticalValue: (patientName: string, finding: string) => {
      notification.error({
        message: `🚨 ${t('critical.title')}: ${patientName}`,
        description: finding,
        placement: 'topRight',
        duration: 0,  // 不自动关闭
        icon: <CloseCircleOutlined style={{ color: '#dc2626' }} />,
      });
    },
  };
}

// ============= Confirm 业务封装(中文化) =============
export function useConfirm() {
  const { modal } = App.useApp();
  const { t } = useTranslation();

  const confirm = (config: Omit<ModalFuncProps, 'okText' | 'cancelText'> & { okText?: string; cancelText?: string }) => {
    return modal.confirm({
      ...config,
      okText: config.okText ?? t('common.confirm'),
      cancelText: config.cancelText ?? t('common.cancel'),
      okButtonProps: { danger: config.type === 'error', ...config.okButtonProps },
    });
  };

  return {
    confirm,
    warning: (config: Omit<ModalFuncProps, 'okText' | 'cancelText'>) =>
      modal.warning({
        ...config,
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        icon: <ExclamationCircleOutlined />,
      }),
    info: (config: Omit<ModalFuncProps, 'okText' | 'cancelText'>) =>
      modal.info({
        ...config,
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        icon: <InfoCircleOutlined />,
      }),
    error: (config: Omit<ModalFuncProps, 'okText' | 'cancelText'>) =>
      modal.error({
        ...config,
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        icon: <CloseCircleOutlined />,
      }),
    // 业务:危险操作
    delete: (name: string, onOk: () => void | Promise<void>) => {
      modal.confirm({
        title: t('common.confirm'),
        content: `${t('common.delete')} "${name}" ?`,
        okText: t('common.delete'),
        cancelText: t('common.cancel'),
        okButtonProps: { danger: true },
        onOk,
        icon: <ExclamationCircleOutlined style={{ color: '#dc2626' }} />,
      });
    },
    // 业务:提交确认
    submit: (name: string, onOk: () => void | Promise<void>) => {
      modal.confirm({
        title: t('common.confirm'),
        content: `${t('common.submit')} "${name}" ?`,
        okText: t('common.submit'),
        cancelText: t('common.cancel'),
        onOk,
      });
    },
  };
}

// ============= Modal 业务封装 =============
export interface AppModalProps {
  open: boolean;
  title?: ReactNode;
  children?: ReactNode;
  onCancel?: () => void;
  onOk?: () => void | Promise<void>;
  okText?: string;
  cancelText?: string;
  width?: number;
  confirmLoading?: boolean;
  /** ESC 关闭 */
  keyboard?: boolean;
  /** 点击遮罩关闭 */
  maskClosable?: boolean;
  /** 销毁内部(关闭后不保留) */
  destroyOnHidden?: boolean;
  /** a11y: aria-describedby */
  description?: ReactNode;
}

export function AppModal({
  open,
  title,
  children,
  onCancel,
  onOk,
  okText,
  cancelText,
  width = 600,
  confirmLoading = false,
  keyboard = true,
  maskClosable = true,
  destroyOnHidden = true,
  description,
}: AppModalProps) {
  const { t } = useTranslation();
  const { SkipLink: _SkipLink } = { SkipLink: null };  // 避免警告
  useEffect(() => { _SkipLink; }, [_SkipLink]);

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onOk}
      okText={okText ?? t('common.confirm')}
      cancelText={cancelText ?? t('common.cancel')}
      width={width}
      confirmLoading={confirmLoading}
      keyboard={keyboard}
      maskClosable={maskClosable}
      destroyOnHidden={destroyOnHidden}
      // a11y (v3.0.3.31: 修复 dangling aria-labelledby 引用 - AntD Modal 自动管理 id)
      aria-describedby={description ? 'app-modal-desc' : undefined}
    >
      {description && (
        <div id="app-modal-desc" style={{ marginBottom: 12 }}>
          {description}
        </div>
      )}
      {children}
    </Modal>
  );
}

// ============= Skeleton 业务封装 =============
export interface AppSkeletonProps {
  rows?: number;
  columns?: number;
  active?: boolean;
  rounded?: boolean;
}

export function AppSkeleton({ rows = 5, columns = 4, active = true, rounded = true }: AppSkeletonProps) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 16,
            marginBottom: 12,
          }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="ant-skeleton ant-skeleton-active"
              style={{
                height: 16,
                background: 'var(--color-gray-200)',
                borderRadius: rounded ? 4 : 0,
                animation: active ? 'ant-skeleton-loading 1.4s ease-in-out infinite' : 'none',
              }}
              aria-label={t('common.loading') || '加载中'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

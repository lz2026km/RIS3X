/**
 * 状态颜色统一映射 - G005 收敛 (P2)
 * 收敛 R3.DIST 等重复定义的 STATUS_COLORS
 */

import type { DeliveryStatus } from '@types/R3/R3.DIST';

/** 报告分发状态 → antd Tag color */
export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending: 'default',
  queued: 'blue',
  sending: 'processing',
  sent: 'cyan',
  delivered: 'green',
  read: 'success',
  failed: 'error',
  cancelled: 'default',
  expired: 'warning',
};

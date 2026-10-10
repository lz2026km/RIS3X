// ============================================================
// G005 放射科RIS系统 v1.0.1 - 报告状态徽标
// Phase R0：14 态状态机的统一展示徽标
// ============================================================

import React from 'react';
import type { ReportStatus } from '../../types';
import { REPORT_STATUS_META, normalizeReportStatus } from './statusMeta';

export interface StatusBadgeProps {
  status: ReportStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg', { padding: string; fontSize: number; iconSize: number }> = {
  sm: { padding: '2px 6px', fontSize: 12, iconSize: 10 },
  md: { padding: '3px 8px', fontSize: 12, iconSize: 12 },
  lg: { padding: '5px 12px', fontSize: 12, iconSize: 14 },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  style,
}) => {
  const normalized = normalizeReportStatus(status);
  const meta = REPORT_STATUS_META[normalized] || REPORT_STATUS_META['待分配'];
  const sizeMeta = SIZE_MAP[size];
  const Icon = meta.icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1, 4px)',
        padding: sizeMeta.padding,
        fontSize: sizeMeta.fontSize,
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: 4,
        whiteSpace: 'nowrap',
        ...style,
      }}
      title={meta.description}
    >
      {showIcon && <Icon size={sizeMeta.iconSize} />}
      {meta.label}
    </span>
  );
};

export default StatusBadge;

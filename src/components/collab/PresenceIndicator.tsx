/**
 * G005 RIS v3.0.7 - 在线状态指示器 (Presence Indicator)
 *
 *  - 头像堆叠
 *  - 状态色点 (viewing/editing/speaking/away/offline)
 *  - 悬浮显示详情
 *  - 可点击触发 @ 提及
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Tooltip, Tag } from 'antd';
import { Users, Eye, Edit3, Mic, Clock, WifiOff } from 'lucide-react';
import { presenceService } from '../../services/collab/PresenceService';
import type { CollabUser, CollabUserStatus } from '../../types/collab';

export interface PresenceIndicatorProps {
  roomId?: string;
  reportId?: string;
  /** 最大显示头像数 */
  maxVisible?: number;
  /** 紧凑模式 */
  compact?: boolean;
  /** 是否显示离线用户 */
  showOffline?: boolean;
  onUserClick?: (user: CollabUser) => void;
  /** 测试 ID 前缀 */
  testIdPrefix?: string;
}

const STATUS_META: Record<CollabUserStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  viewing: { label: '正在查看', color: '#10b981', bg: 'var(--color-success-bg)', Icon: Eye },
  editing: { label: '正在编辑', color: 'var(--color-primary-500)', bg: 'var(--color-info-bg)', Icon: Edit3 },
  idle: { label: '空闲', color: '#94a3b8', bg: 'var(--border-color)', Icon: Clock },
  speaking: { label: '发言中', color: 'var(--color-warning-500)', bg: 'var(--color-warning-bg)', Icon: Mic },
  away: { label: '离开', color: '#f97316', bg: 'var(--color-warning-bg)', Icon: Clock },
  offline: { label: '离线', color: '#64748b', bg: 'var(--border-color)', Icon: WifiOff },
};

const ROLE_LABEL: Record<string, string> = {
  doctor: '医生',
  resident: '住院医',
  attending: '副主任',
  chief: '主任',
  associateChief: '副主任',
  tech: '技师',
  reviewer: '审核',
  admin: '管理员',
};

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  roomId,
  reportId,
  maxVisible = 5,
  compact = false,
  showOffline = false,
  onUserClick,
  testIdPrefix = 'presence',
}) => {
  const [users, setUsers] = useState<CollabUser[]>([]);

  useEffect(() => {
    const update = () => {
      const targetRoom = roomId ?? reportId ?? '';
      setUsers(presenceService.getActive({ roomId: targetRoom }));
    };
    update();
    const unsub = presenceService.subscribe(() => update());
    const timer = window.setInterval(update, 15_000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [roomId, reportId]);

  const visible = useMemo(() => {
    if (showOffline) return users;
    return users.filter((u) => u.status !== 'offline');
  }, [users, showOffline]);

  const overflow = Math.max(0, visible.length - maxVisible);
  const summary = useMemo(() => {
    const editing = visible.filter((u) => u.status === 'editing').length;
    const viewing = visible.filter((u) => u.status === 'viewing').length;
    return { editing, viewing, total: visible.length };
  }, [visible]);

  if (visible.length === 0) {
    return (
      <div
        data-testid={`${testIdPrefix}-empty`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          background: 'var(--bg-primary)',
          borderRadius: 12,
          color: '#64748b',
          fontSize: 12,
        }}
      >
        <Users size={14} />
        <span>暂无人在线</span>
      </div>
    );
  }

  return (
    <div
      data-testid={`${testIdPrefix}-indicator`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {visible.slice(0, maxVisible).map((u, idx) => {
          const meta = STATUS_META[u.status];
          const initials = (u.name || '?').charAt(0);
          return (
            <Tooltip
              key={u.id}
              title={
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ color: '#cbd5e1' }}>{ROLE_LABEL[u.role] ?? u.role} · {u.title ?? ''}</div>
                  <div style={{ marginTop: 2 }}>
                    <Tag color={meta.color === '#10b981' ? 'green' : meta.color === 'var(--color-primary-500)' ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
                      {meta.label}
                    </Tag>
                  </div>
                </div>
              }
            >
              <button
                type="button"
                data-testid={`${testIdPrefix}-user-${u.id}`}
                onClick={() => onUserClick?.(u)}
                title={`${u.name} (${ROLE_LABEL[u.role] ?? u.role})`}
                style={{
                  width: compact ? 24 : 30,
                  height: compact ? 24 : 30,
                  borderRadius: '50%',
                  background: u.color,
                  color: 'white',
                  border: '2px solid white',
                  marginLeft: idx === 0 ? 0 : -8,
                  fontWeight: 600,
                  fontSize: compact ? 10 : 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: onUserClick ? 'pointer' : 'default',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.2)',
                  position: 'relative',
                }}
              >
                {initials}
                <span
                  data-testid={`${testIdPrefix}-dot-${u.id}`}
                  aria-label={meta.label}
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: meta.color,
                    border: '2px solid white',
                  }}
                />
              </button>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <div
            data-testid={`${testIdPrefix}-overflow`}
            title={`还有 ${overflow} 人`}
            style={{
              width: compact ? 24 : 30,
              height: compact ? 24 : 30,
              borderRadius: '50%',
              background: '#475569',
              color: 'white',
              border: '2px solid white',
              marginLeft: -8,
              fontSize: compact ? 9 : 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#475569' }}>
        <span data-testid={`${testIdPrefix}-count`}>{summary.total} 人在线</span>
        {!compact && (
          <span style={{ marginLeft: 8, color: '#64748b' }}>
            ({summary.editing} 编辑中 / {summary.viewing} 查看中)
          </span>
        )}
      </div>
    </div>
  );
};

export default PresenceIndicator;

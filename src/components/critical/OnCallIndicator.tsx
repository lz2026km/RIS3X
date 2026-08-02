/**
 * G005 RIS v3.0.6.6 - 当前值班指示器
 * 用于工作站侧边栏/状态栏
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tag, Space, Avatar, Tooltip, Button, Badge, Empty } from 'antd';
import { Stethoscope, Phone, MessageSquare, RefreshCw, Clock, User, ChevronRight } from 'lucide-react';
import type { OnCallDoctor, OnCallRole } from '../../data/oncallMock';
import { onCallResolver } from '../../services/critical/oncall/OnCallResolver';

const ROLE_META: Record<OnCallRole, { label: string; color: string; bg: string }> = {
  attending: { label: '首诊医师', color: '#10b981', bg: '#d1fae5' },
  associateChief: { label: '主诊医师', color: '#3b82f6', bg: '#dbeafe' },
  chief: { label: '科主任', color: '#7c3aed', bg: '#ede9fe' },
  director: { label: '医务处主任', color: '#dc2626', bg: '#fee2e2' },
  medicalAffairs: { label: '医务', color: '#dc2626', bg: '#fee2e2' },
};

export interface OnCallIndicatorProps {
  /** 仅显示指定角色 */
  roles?: OnCallRole[];
  /** 显示科室 */
  department?: string;
  /** 点击医生回调(发起拨号等) */
  onSelect?: (doctor: OnCallDoctor) => void;
  /** 紧凑模式 */
  compact?: boolean;
  /** 刷新间隔(秒) */
  refreshSec?: number;
}

function DoctorRow({ doctor, role, onSelect, compact }: { doctor: OnCallDoctor; role: OnCallRole; onSelect?: (d: OnCallDoctor) => void; compact?: boolean }) {
  const meta = ROLE_META[role];
  return (
    <div
      onClick={() => onSelect?.(doctor)}
      style={{
        padding: compact ? '4px 8px' : '8px 10px',
        borderRadius: 6,
        background: meta.bg,
        cursor: onSelect ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderLeft: `3px solid ${meta.color}`,
      }}
      data-testid={`oncall-${role}`}
    >
      <Avatar size={compact ? 24 : 32} style={{ background: meta.color, flex: '0 0 auto' }}>
        {doctor.name.charAt(0)}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size={4}>
          <strong style={{ fontSize: compact ? 12 : 13 }}>{doctor.name}</strong>
          <Tag color={meta.color} style={{ fontSize: 12, margin: 0 }}>{meta.label}</Tag>
        </Space>
        {!compact && (
          <div style={{ fontSize: 12, color: '#475569' }}>
            {doctor.title} · {doctor.department}
          </div>
        )}
      </div>
      <Space size={2}>
        <Tooltip title={doctor.phone}>
          <Button size="small" type="text" icon={<Phone size={12} />} onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${doctor.phone}`; }} />
        </Tooltip>
        <Tooltip title="短信">
          <Button size="small" type="text" icon={<MessageSquare size={12} />} onClick={(e) => { e.stopPropagation(); }} />
        </Tooltip>
      </Space>
    </div>
  );
}

export const OnCallIndicator: React.FC<OnCallIndicatorProps> = ({
  roles = ['attending', 'associateChief', 'chief', 'director'],
  department,
  onSelect,
  compact = false,
  refreshSec = 60,
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (refreshSec > 0) {
      const t = setInterval(() => setTick((n) => n + 1), refreshSec * 1000);
      return () => clearInterval(t);
    }
  }, [refreshSec]);

  const snapshot = useMemo(() => {
    // tick 触发重新计算
    void tick;
    return onCallResolver.snapshot({ department });
  }, [tick, department]);

  const list = roles
    .map((r) => ({ role: r, doctor: snapshot.primaryByRole[r] }))
    .filter((x) => !!x.doctor);

  return (
    <Card
      size="small"
      data-testid="on-call-indicator"
      title={
        <Space>
          <Stethoscope size={14} color="#7c3aed" />
          <strong>当前值班</strong>
          <Tag color="cyan"><Clock size={10} /> {new Date(snapshot.queryTime).toLocaleTimeString()}</Tag>
        </Space>
      }
      extra={
        <Button size="small" icon={<RefreshCw size={10} />} onClick={() => setTick((n) => n + 1)} />
      }
    >
      {list.length === 0 ? (
        <Empty description="当前无值班信息" />
      ) : (
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          {list.map(({ role, doctor }) => (
            <DoctorRow key={role} doctor={doctor!} role={role} onSelect={onSelect} compact={compact} />
          ))}
        </Space>
      )}
      {!compact && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
          <Badge status="success" /> {snapshot.shifts.length} 个班次进行中
          <Button size="small" type="link" icon={<ChevronRight size={10} />} style={{ padding: 0, marginLeft: 4 }}>
            排班表
          </Button>
        </div>
      )}
    </Card>
  );
};

export default OnCallIndicator;
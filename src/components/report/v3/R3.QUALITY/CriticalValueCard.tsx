/**
 * G005 RIS v3.0.6.11-100 Wave 2A — CriticalValueCard
 * 报告书写页顶部危急值卡片: 红边 + 闪烁呼吸灯 + 一键电话通知/发送短信/记录已通知
 * 数据源: criticalAlertApi (POST /critical-alert/alerts/:id/auto-call | auto-sms | communication-log)
 */
import React, { useState } from 'react';
import { Tag, Space, Button, Input, Modal, message, Tooltip, Badge } from 'antd';
import { Phone, MessageSquare, CheckCircle2, AlertOctagon, BellRing, Clock, RefreshCw } from 'lucide-react';
import { criticalAlertApi, type CriticalAlert } from '../../../../services/api/criticalAlertApi';
import AutoCallSmsLog from './AutoCallSmsLog';

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  info: { color: '#3b82f6', label: '提示' },
  warning: { color: '#f59e0b', label: '警告' },
  critical: { color: '#dc2626', label: '危急' },
  emergency: { color: '#7f1d1d', label: '紧急' },
};

function timeAgo(iso?: string): string {
  if (!iso) return '-';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export interface CriticalValueCardProps {
  alert: CriticalAlert;
  /** 已通知确认回调 (调用方更新本地状态) */
  onNotified?: (alert: CriticalAlert) => void;
  /** 紧凑模式 (报告页顶部嵌入) */
  compact?: boolean;
}

export const CriticalValueCard: React.FC<CriticalValueCardProps> = ({ alert, onNotified, compact }) => {
  const [smsModal, setSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsContent, setSmsContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [logRefresh, setLogRefresh] = useState(0);

  const sev = SEVERITY_META[alert.severity] ?? { color: '#3b82f6', label: '提示' };

  const handleCall = async () => {
    setBusy(true);
    try {
      const res = await criticalAlertApi.autoCall(alert.id);
      if (res.success) {
        const call = res.data;
        message.success(
          call.status === 'failed'
            ? `呼叫失败 (${call.phone}): 对方未接听`
            : `电话呼叫已接通 ${call.phone} · 通话 ${call.durationSec}s (录音已保存)`,
        );
        setLogRefresh((v) => v + 1);
      } else {
        message.error(`呼叫失败:${res.error?.message ?? '未知错误'}`);
      }
    } catch {
      message.error('呼叫失败:网络错误');
    } finally {
      setBusy(false);
    }
  };

  const submitSms = async () => {
    if (!smsPhone.trim()) {
      message.warning('请填写接收手机号');
      return;
    }
    setBusy(true);
    try {
      const res = await criticalAlertApi.autoSms(alert.id, { phone: smsPhone.trim(), content: smsContent.trim() || undefined });
      if (res.success) {
        const sms = res.data;
        message.success(sms.status === 'failed' ? `短信发送失败 (${sms.phone})` : `短信已发送至 ${sms.phone}`);
        setSmsModal(false);
        setSmsContent('');
        setLogRefresh((v) => v + 1);
      } else {
        message.error(`短信发送失败:${res.error?.message ?? '未知错误'}`);
      }
    } catch {
      message.error('短信发送失败:网络错误');
    } finally {
      setBusy(false);
    }
  };

  const handleNotified = async () => {
    setBusy(true);
    try {
      const res = await criticalAlertApi.acknowledge(alert.id, { comment: '已电话/短信通知临床' });
      if (res.success) {
        message.success('已记录通知,危急值状态更新为已确认');
        onNotified?.(res.data);
      } else {
        message.error(`记录失败:${res.error?.message ?? '未知错误'}`);
      }
    } catch {
      message.error('记录失败:网络错误');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="critical-value-card"
      role="region"
      aria-label="危急值通知卡片"
      className="no-print"
      style={{
        border: '2px solid #dc2626',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)',
        padding: compact ? '10px 14px' : '14px 18px',
        animation: 'cvCardPulse 2.4s ease-in-out infinite',
        marginBottom: 10,
      }}
    >
      <style>{`@keyframes cvCardPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.45); } 50% { box-shadow: 0 0 0 7px rgba(220,38,38,0); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        {/* 呼吸灯 */}
        <div
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#dc2626',
            marginTop: 4,
            animation: 'cvBreathLight 1.2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <style>{`@keyframes cvBreathLight { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AlertOctagon size={16} color="#dc2626" />
            <strong style={{ color: '#7f1d1d', fontSize: 14 }}>危急值告警</strong>
            <Tag color={sev.color} style={{ marginRight: 0 }}>{sev.label}</Tag>
            <Tag color="red" icon={<BellRing size={10} />}>待通知</Tag>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              <Clock size={10} style={{ verticalAlign: -1 }} /> {timeAgo(alert.createdAt)}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>
            <strong>{alert.patientName}</strong>
            {alert.studyId ? <span style={{ color: '#94a3b8' }}> · {alert.studyId}</span> : null}
            {alert.modality ? <Tag color="blue" style={{ marginLeft: 6 }}>{alert.modality}</Tag> : null}
          </div>
          <div style={{ marginTop: 4, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>
            {alert.title}
          </div>
          {alert.description && (
            <div style={{ marginTop: 2, color: '#7f1d1d', fontSize: 12, lineHeight: 1.6 }}>
              {alert.description}
            </div>
          )}
        </div>

        <Space wrap style={{ flexShrink: 0 }}>
          <Tooltip title="自动呼叫临床值班电话">
            <Button
              size="small"
              type="primary"
              danger
              icon={<Phone size={12} />}
              loading={busy}
              onClick={handleCall}
              data-testid="cv-auto-call"
            >
              电话通知
            </Button>
          </Tooltip>
          <Button
            size="small"
            icon={<MessageSquare size={12} />}
            loading={busy}
            onClick={() => setSmsModal(true)}
            data-testid="cv-auto-sms"
          >
            发送短信
          </Button>
          {alert.status === 'active' && (
            <Button
              size="small"
              type="default"
              icon={<CheckCircle2 size={12} />}
              loading={busy}
              onClick={handleNotified}
              data-testid="cv-mark-notified"
            >
              记录已通知
            </Button>
          )}
          {!compact && (
            <Tooltip title="刷新通话/短信记录">
              <Button size="small" icon={<RefreshCw size={12} />} onClick={() => setLogRefresh((v) => v + 1)} />
            </Tooltip>
          )}
        </Space>
      </div>

      {!compact && (
        <div style={{ marginTop: 12, borderTop: '1px dashed #fecaca', paddingTop: 10 }}>
          <AutoCallSmsLog alertId={alert.id} refreshKey={logRefresh} />
        </div>
      )}

      <Modal
        title={<Space><MessageSquare size={14} color="#3b82f6" />发送危急值短信</Space>}
        open={smsModal}
        onCancel={() => setSmsModal(false)}
        onOk={submitSms}
        okText="发送"
        cancelText="取消"
        okButtonProps={{ loading: busy }}
        width={480}
        destroyOnHidden
      >
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
          <Badge color="#dc2626" /> {alert.patientName} · {alert.title}
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>接收手机号</div>
          <Input
            placeholder="如: 13800000001"
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            data-testid="cv-sms-phone"
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>短信内容(留空使用默认模板)</div>
          <Input.TextArea
            rows={3}
            value={smsContent}
            onChange={(e) => setSmsContent(e.target.value)}
            placeholder={`【危急值通知】${alert.patientName}: ${alert.title}, 请及时查看处理。`}
            data-testid="cv-sms-content"
          />
        </div>
      </Modal>
    </div>
  );
};

export default CriticalValueCard;

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
import { t } from '../../../../i18n/appI18n';

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  info: { color: 'var(--color-primary-500)', label: t('criticalValue.level.info') },
  warning: { color: 'var(--color-warning-500)', label: t('criticalValue.level.warning') },
  critical: { color: 'var(--color-error-600)', label: t('criticalValue.level.critical') },
  emergency: { color: '#7f1d1d', label: t('criticalValue.level.urgent') },
};

function timeAgo(iso?: string): string {
  if (!iso) return '-';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('criticalValue.justNow');
  if (m < 60) return t('w9e.criticalValueCard.timeMinutesAgo', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('w9e.criticalValueCard.timeHoursAgo', { count: h });
  return t('w9e.criticalValueCard.timeDaysAgo', { count: Math.floor(h / 24) });
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

  const sev = SEVERITY_META[alert.severity] ?? { color: 'var(--color-primary-500)', label: t('criticalValue.level.info') };

  const handleCall = async () => {
    setBusy(true);
    try {
      const res = await criticalAlertApi.autoCall(alert.id);
      if (res.success) {
        const call = res.data;
        message.success(
          call.status === 'failed'
            ? t('w9e.criticalValueCard.callNoAnswer', { phone: call.phone })
            : t('w9e.criticalValueCard.callConnected', { phone: call.phone, duration: call.durationSec }),
        );
        setLogRefresh((v) => v + 1);
      } else {
        message.error(t('w9e.criticalValueCard.callFailed', { msg: res.error?.message ?? t('w9e.criticalValueCard.unknownError') }));
      }
    } catch {
      message.error(t('criticalValueCard.callNetworkError'));
    } finally {
      setBusy(false);
    }
  };

  const submitSms = async () => {
    if (!smsPhone.trim()) {
      message.warning(t('criticalValueCard.enterPhone'));
      return;
    }
    setBusy(true);
    try {
      const res = await criticalAlertApi.autoSms(alert.id, { phone: smsPhone.trim(), content: smsContent.trim() || undefined });
      if (res.success) {
        const sms = res.data;
        message.success(sms.status === 'failed' ? t('w9e.criticalValueCard.smsFailed', { phone: sms.phone }) : t('w9e.criticalValueCard.smsSent', { phone: sms.phone }));
        setSmsModal(false);
        setSmsContent('');
        setLogRefresh((v) => v + 1);
      } else {
        message.error(t('w9e.criticalValueCard.smsFailedMsg', { msg: res.error?.message ?? t('w9e.criticalValueCard.unknownError') }));
      }
    } catch {
      message.error(t('criticalValueCard.smsNetworkError'));
    } finally {
      setBusy(false);
    }
  };

  const handleNotified = async () => {
    setBusy(true);
    try {
      const res = await criticalAlertApi.acknowledge(alert.id, { comment: '已电话/短信通知临床' });
      if (res.success) {
        message.success(t('criticalValueCard.notifiedRecorded'));
        onNotified?.(res.data);
      } else {
        message.error(t('w9e.criticalValueCard.recordFailed', { msg: res.error?.message ?? t('w9e.criticalValueCard.unknownError') }));
      }
    } catch {
      message.error(t('criticalValueCard.recordNetworkError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="critical-value-card"
      role="region"
      aria-label={t('criticalValueCard.ariaLabel')}
      className="no-print"
      style={{
        border: '2px solid var(--color-error-600)',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)',
        padding: compact ? '10px 14px' : '14px 18px',
        animation: 'cvCardPulse 2.4s ease-in-out infinite',
        marginBottom: 10,
      }}
    >
      <style>{`@keyframes cvCardPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.45); } 50% { box-shadow: 0 0 0 7px rgba(220,38,38,0); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
        {/* 呼吸灯 */}
        <div
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--color-error-600)',
            marginTop: 'var(--space-1, 4px)',
            animation: 'cvBreathLight 1.2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <style>{`@keyframes cvBreathLight { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
            <AlertOctagon size={16} color="var(--color-error-600)" />
            <strong style={{ color: '#7f1d1d', fontSize: 14 }}>{t('criticalValueCard.alertTitle')}</strong>
            <Tag color={sev.color} style={{ marginRight: 0 }}>{sev.label}</Tag>
            <Tag color="red" icon={<BellRing size={10} />}>{t('criticalValueCard.pendingNotify')}</Tag>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              <Clock size={10} style={{ verticalAlign: -1 }} /> {timeAgo(alert.createdAt)}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>
            <strong>{alert.patientName}</strong>
            {alert.studyId ? <span style={{ color: '#94a3b8' }}> · {alert.studyId}</span> : null}
            {alert.modality ? <Tag color="blue" style={{ marginLeft: 6 }}>{alert.modality}</Tag> : null}
          </div>
          <div style={{ marginTop: 'var(--space-1, 4px)', color: '#b91c1c', fontWeight: 600, fontSize: 12 }}>
            {alert.title}
          </div>
          {alert.description && (
            <div style={{ marginTop: 2, color: '#7f1d1d', fontSize: 12, lineHeight: 1.6 }}>
              {alert.description}
            </div>
          )}
        </div>

        <Space wrap style={{ flexShrink: 0 }}>
          <Tooltip title={t('criticalValueCard.autoCallTooltip')}>
            <Button
              size="small"
              type="primary"
              danger
              icon={<Phone size={12} />}
              loading={busy}
              onClick={handleCall}
              data-testid="cv-auto-call"
            >
              {t('criticalValueCard.phoneNotify')}
            </Button>
          </Tooltip>
          <Button
            size="small"
            icon={<MessageSquare size={12} />}
            loading={busy}
            onClick={() => setSmsModal(true)}
            data-testid="cv-auto-sms"
          >
            {t('criticalValueCard.sendSms')}
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
              {t('criticalValueCard.markNotified')}
            </Button>
          )}
          {!compact && (
            <Tooltip title={t('criticalValueCard.refreshLogTooltip')}>
              <Button aria-label="刷新" size="small" icon={<RefreshCw size={12} />} onClick={() => setLogRefresh((v) => v + 1)} />
            </Tooltip>
          )}
        </Space>
      </div>

      {!compact && (
        <div style={{ marginTop: 'var(--space-3, 12px)', borderTop: '1px dashed #fecaca', paddingTop: 10 }}>
          <AutoCallSmsLog alertId={alert.id} refreshKey={logRefresh} />
        </div>
      )}

      <Modal
        title={<Space><MessageSquare size={14} color="var(--color-primary-500)" />{t('criticalValueCard.smsModalTitle')}</Space>}
        open={smsModal}
        onCancel={() => setSmsModal(false)}
        onOk={submitSms}
        okText={t('criticalValueCard.send')}
        cancelText={t('criticalValueCard.cancel')}
        okButtonProps={{ loading: busy }}
        width={480}
        destroyOnHidden
      >
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
          <Badge color="var(--color-error-600)" /> {alert.patientName} · {alert.title}
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('criticalValueCard.receivingPhone')}</div>
          <Input
            placeholder={t('criticalValueCard.phonePlaceholder')}
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            data-testid="cv-sms-phone"
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('criticalValueCard.smsContentLabel')}</div>
          <Input.TextArea
            rows={3}
            value={smsContent}
            onChange={(e) => setSmsContent(e.target.value)}
            placeholder={t('w9e.criticalValueCard.smsPlaceholder', { patient: alert.patientName, title: alert.title })}
            data-testid="cv-sms-content"
          />
        </div>
      </Modal>
    </div>
  );
};

export default CriticalValueCard;

// [v3.0.6.11-104 Wave 2D] 通知偏好设置区块
// 接入 GET /notifications/preferences/:id · PUT /notifications/preferences/:id
import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Input, Space, Switch, message } from 'antd';
import { BellRing, RefreshCw, Save } from 'lucide-react';
import {
  notificationsApi,
  type NotificationPreferencesDto,
  type NotificationSubscriptionType,
} from '../services/api/notificationsApi';
import { DashboardCard } from '../components/dashboard/DashboardCard';
import { StateView } from '../components/common/StateView';
import { getCurrentUser } from '../utils/auth';
import { t } from '../i18n/appI18n';

const TYPE_OPTIONS: NotificationSubscriptionType[] = ['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM'];
const CHANNEL_OPTIONS = ['SMS', 'WECHAT', 'APP', 'SYSTEM', 'EMAIL', 'PHONE'];

export function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<NotificationPreferencesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<NotificationSubscriptionType[]>([]);
  const [channels, setChannels] = useState<Record<string, boolean>>({});
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietFrom, setQuietFrom] = useState('22:00');
  const [quietTo, setQuietTo] = useState('07:00');

  const userId = getCurrentUser()?.id ?? 'u-001';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await notificationsApi.getPreferences(userId);
    if (res.success && res.data) {
      const p = res.data;
      setPrefs(p);
      setTypes(p.types ?? []);
      setChannels(p.channels ?? {});
      setQuietEnabled(p.quietHours?.enabled ?? false);
      setQuietFrom(p.quietHours?.from ?? '22:00');
      setQuietTo(p.quietHours?.to ?? '07:00');
    } else {
      setError(res.error?.message ?? t('w2d.loadFailed'));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    const res = await notificationsApi.updatePreferences(userId, {
      types,
      channels,
      quietHours: { enabled: quietEnabled, from: quietFrom, to: quietTo },
    });
    setSaving(false);
    if (res.success && res.data) {
      setPrefs(res.data);
      message.success(t('notifExt.saved'));
    } else {
      message.error(res.error?.message ?? t('w2d.loadFailed'));
    }
  };

  if (loading) {
    return <StateView loading skeletonRows={4} />;
  }
  if (error) {
    return <StateView error={error} onRetry={() => void load()} />;
  }
  if (!prefs) {
    return <StateView empty emptyDescription={t('w2d.empty')} />;
  }

  return (
    <DashboardCard
      title={t('notifExt.preferences')}
      icon={<BellRing size={15} />}
      extra={
        <Space>
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>
            {t('w2d.refresh')}
          </Button>
          <Button size="small" type="primary" icon={<Save size={12} />} loading={saving} onClick={() => void handleSave()}>
            {t('w2d.save')}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('notifExt.types')}</div>
          <Checkbox.Group
            value={types}
            onChange={(v) => setTypes(v as NotificationSubscriptionType[])}
            options={TYPE_OPTIONS.map((tp) => ({ label: t(`notifExt.type.${tp}`), value: tp }))}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('notifExt.channels')}</div>
          <Space wrap size={16}>
            {CHANNEL_OPTIONS.map((c) => (
              <Space key={c} size={6}>
                <Switch
                  size="small"
                  checked={channels[c] ?? false}
                  onChange={(checked) => setChannels((prev) => ({ ...prev, [c]: checked }))}
                />
                <span style={{ fontSize: 12 }}>{t(`notifExt.channel.${c}`)}</span>
              </Space>
            ))}
          </Space>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('notifExt.quietHours')}</div>
          <Space wrap>
            <Switch checked={quietEnabled} onChange={setQuietEnabled} />
            <span style={{ fontSize: 12 }}>{t('notifExt.enabled')}</span>
            <span style={{ fontSize: 12 }}>{t('notifExt.from')}</span>
            <Input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} style={{ width: 120 }} disabled={!quietEnabled} />
            <span style={{ fontSize: 12 }}>{t('notifExt.to')}</span>
            <Input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} style={{ width: 120 }} disabled={!quietEnabled} />
          </Space>
        </div>
      </Space>
    </DashboardCard>
  );
}

export default NotificationPreferencesSection;

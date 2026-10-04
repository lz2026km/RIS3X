// [v3.0.6.11-54] Phase 2: 口腔工作台 (今日预约/检查概览 + 快捷入口)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Card, Alert, Spin, Button, Space, Tag, Typography,
} from 'antd';
import { EmptyState } from '../../components/common/EmptyState';
import { ExportButton, StatCard, StatCardGrid } from '../../components/common';
import {
  Calendar, ScanLine, Activity, ArrowRight, RefreshCw, Stethoscope, Microscope, Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DentalPageLayout } from './DentalShared';
import { dentalApi, type DentalStudy } from '../../services/api/dentalApi';
import { t } from '../../i18n/appI18n';

const QUICK_LINKS = [
  { key: 'studies', titleKey: 'dental.quick.studies.title', descKey: 'dental.quick.studies.desc', icon: Layers, color: '#2563eb', href: '/dental/studies' },
  { key: 'viewer', titleKey: 'dental.quick.viewer.title', descKey: 'dental.quick.viewer.desc', icon: ScanLine, color: '#10b981', href: '/dental/viewer' },
  { key: 'schedule', titleKey: 'dental.quick.schedule.title', descKey: 'dental.quick.schedule.desc', icon: Calendar, color: '#f59e0b', href: '/dental/schedule' },
  { key: 'ai', titleKey: 'dental.quick.ai.title', descKey: 'dental.quick.ai.desc', icon: Microscope, color: '#8b5cf6', href: '/dental/ai' },
  { key: 'treatment', titleKey: 'dental.quick.treatment.title', descKey: 'dental.quick.treatment.desc', icon: Stethoscope, color: '#06b6d4', href: '/dental/treatment' },
  { key: 'implant', titleKey: 'dental.quick.implant.title', descKey: 'dental.quick.implant.desc', icon: Activity, color: '#ec4899', href: '/dental/implant-3d' },
];

export const DentalWorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [recentStudies, setRecentStudies] = useState<DentalStudy[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, aptRes, studiesRes] = await Promise.allSettled([
        dentalApi.getStats(),
        dentalApi.listAppointments(),
        dentalApi.listStudies({ pageSize: 5 }),
      ]);
      if (statsRes.status === 'fulfilled' && statsRes.value.success) setStats(statsRes.value.data);
      if (aptRes.status === 'fulfilled' && aptRes.value.success) {
        const list = aptRes.value.data ?? [];
        setAppointments(list.filter((a) => (a.status ?? '') !== 'completed').slice(0, 6));
      }
      if (studiesRes.status === 'fulfilled' && studiesRes.value.success) {
        setRecentStudies((studiesRes.value.data ?? []).slice(0, 5));
      }
      if (statsRes.status === 'fulfilled' && !statsRes.value.success) {
        setError(statsRes.value.error?.message ?? '');
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('dental.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => (stats ? (stats.todayPatients ?? 0) : 0),
    [stats],
  );

  return (
    <DentalPageLayout
      header={{
        title: t('dental.workspace.title'),
        version: 'v3.0.6.11-54',
        extra: (
          <>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>{t('dental.action.refresh')}</Button>
            <ExportButton
              data={() => [...appointments, ...recentStudies]}
              filename="dental-workspace"
              label={t('w45.actions.export')}
              size="small"
              formats={["csv", "json"]}
            />
          </>
        ),
      }}
      alert={error ? { message: error, type: 'error' } : undefined}
    >
      <Spin spinning={loading}>
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
          <StatCard title={t('dental.stat.todayPatients')} value={stats?.todayPatients ?? 0} icon={<Calendar size={14} />} />
          <StatCard title={t('dental.stat.weekPatients')} value={stats?.thisWeek ?? 0} icon={<Activity size={14} />} color="primary" />
          <StatCard title={t('dental.stat.todayRevenue')} prefix="¥" value={stats?.revenueToday ?? 0} color="success" />
          <StatCard title={t('dental.stat.pendingAppointments')} value={appointments.length} color="warning" />
        </StatCardGrid>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {QUICK_LINKS.map((q) => (
            <Col span={8} key={q.key}>
              <Card size="small" hoverable onClick={() => navigate(q.href)} style={{ cursor: 'pointer' }}>
                <Space>
                  <q.icon color={q.color} size={18} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t(q.titleKey)}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>{t(q.descKey)}</Typography.Text>
                  </div>
                  <ArrowRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }} />
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Card size="small" title={<Space><Calendar size={14} />{t('dental.card.todayAppointments')}</Space>}
              extra={<a onClick={() => navigate('/dental/schedule')} style={{ fontSize: 12 }}>{t('dental.link.scheduleMgmt')} <ArrowRight size={12} /></a>}>
              {appointments.length === 0 ? (
                <EmptyState description={t('dental.empty.noAppointments')} />
              ) : (
                <div>
                  {appointments.map((a) => (
                    <div key={a.id ?? a.patientId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13 }}>{a.patientName ?? a.patientId}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.type ?? a.modality ?? ''} · {a.time ?? a.date ?? ''}</div>
                      </div>
                      <Tag color={(a.status === 'completed' ? 'green' : a.status === 'cancelled' ? 'red' : 'blue')}>{a.status ?? '-'}</Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title={<Space><ScanLine size={14} />{t('dental.card.recentStudies')}</Space>}
              extra={<a onClick={() => navigate('/dental/studies')} style={{ fontSize: 12 }}>{t('dental.link.all')} <ArrowRight size={12} /></a>}>
              {recentStudies.length === 0 ? (
                <EmptyState description={t('dental.empty.noStudies')} />
              ) : (
                <div>
                  {recentStudies.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13 }}>{s.patientName} <Tag style={{ marginLeft: 6 }}>{s.modality}</Tag></span>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.region} · {s.acquisitionDate?.slice(0, 10)}</div>
                      </div>
                      <Tag color={s.quality === 'Diagnostic' ? 'green' : s.quality === 'Acceptable' ? 'blue' : 'orange'}>{s.quality}</Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
        <Alert style={{ marginTop: 16 }} title={t('w9d.dentalWorkspace.ready', { count: pendingCount + appointments.length })} type="success" showIcon />
      </Spin>
    </DentalPageLayout>
  );
};

export default DentalWorkspacePage;

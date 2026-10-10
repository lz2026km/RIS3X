// [v3.0.6.11-60] Batch 3: 口腔运营仪表板 (dentalApi 真实数据 + loading/error)
import { dentalApi } from '../../services/api/dentalApi';
import { DentalPageLayout, EmptyState } from './DentalShared';
import { t } from '../../i18n/appI18n';
import {
  Card,
  Button,
  Row,
  Col,
  Statistic,
  Space,
  Alert,
  Tag,
  Spin,
  Empty,
  List,
  message,
} from "antd";
import { DataTable, StatCard, StatCardGrid } from "../../components/common";
import { RefreshCw, Calendar, Users, Scan, TrendingUp, Activity, Stethoscope } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface DentalStats {
  todayPatients?: number;
  thisWeek?: number;
  avgPerDay?: number;
  revenueToday?: number;
  topTreatments?: Record<string, number>;
  examCount?: number;
  deviceCount?: number;
}
export const DentalDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DentalStats | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshAt, setRefreshAt] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, aptRes, treatRes] = await Promise.all([
        dentalApi.getStats(),
        dentalApi.getTodayAppointments(),
        dentalApi.listTreatments({ pageSize: 50 }),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      else setError(statsRes.error?.message ?? t('dentalDash.statsLoadFailed'));
      if (aptRes.success && Array.isArray(aptRes.data)) setAppointments(aptRes.data);
      if (treatRes.success && Array.isArray(treatRes.data)) setTreatments(treatRes.data);
      setRefreshAt(new Date());
    } catch {
      setError(t('dentalDash.networkError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) {
    return (<DentalPageLayout header={{ title: t('dentalDash.title') }}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}><Spin /> {t('dentalDash.loading')}</div></DentalPageLayout>);
  }
  if (!stats && !loading) {
    return (<DentalPageLayout header={{ title: t('dentalDash.title') }}><EmptyState tip={t('dentalDash.noStats')} onCreate={() => void load()} createLabel={t('dentalDash.reload')} /></DentalPageLayout>);
  }
  const topTreat = stats?.topTreatments || {};
  const todayDone = appointments.filter((a: any) => a.state === 'DONE' || a.state === 'completed' || a.status === 'completed').length;

  return (
    <DentalPageLayout
      header={{
        title: t('dentalDash.title'),
        extra: (
          <Space>
            <Tag color="cyan">v3.0.6.11-60</Tag>
            <Button size="small" icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>{t('dentalDash.refresh')}</Button>
          </Space>
        ),
      }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('dentalDash.retry')}</Button>} />}

      <Spin spinning={loading}>
        <StatCardGrid minWidth={200} gap={12} style={{ marginBottom: 16 }}>
          <StatCard title={t('dentalDash.todayPatients')} value={stats?.todayPatients ?? 0} icon={<Users size={14} />} />
          <StatCard title={t('dentalDash.weekPatients')} value={stats?.thisWeek ?? 0} icon={<TrendingUp size={14} />} />
          <StatCard title={t('dentalDash.revenueToday')} prefix="¥" value={stats?.revenueToday ?? 0} />
          <StatCard title={t('dentalDash.inTreatment')} value={treatments.length} icon={<Stethoscope size={14} />} />
          <StatCard title={t('dentalDash.todayAppointments')} value={appointments.length} icon={<Calendar size={14} />} />
          <StatCard title={t('dentalDash.completed')} value={todayDone} icon={<Activity size={14} />} color="success" />
          <StatCard title={t('dentalDash.todayExams')} value={stats?.examCount ?? '-'} icon={<Scan size={14} />} />
          <StatCard title={t('dentalDash.devices')} value={stats?.deviceCount ?? '-'} icon={<Activity size={14} />} />
        </StatCardGrid>
      </Spin>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" title={t('dentalDash.topTreatments')} extra={<Tag>{t('dentalDash.caseCount', { count: Object.values(topTreat).reduce((a, b) => a + (b ?? 0), 0) })}</Tag>}>
            <Row gutter={8}>
              {Object.entries(topTreat).map(([key, value]) => (
                <Col span={8} key={key} style={{ marginBottom: 8 }}>
                  <Statistic title={key} value={value ?? 0} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title={t('dentalDash.todaySchedule')} extra={<Tag>{t('dentalDash.recordCount', { count: appointments.length })}</Tag>}>
            {appointments.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalDash.noAppointmentsToday')} />
            ) : (
              <List
                size="small"
                dataSource={appointments.slice(0, 8)}
                renderItem={(a: any) => (
                  <List.Item>
                    <Space>
                      <Tag color="blue">{a.dentistName ?? a.dentist ?? t('dentalDash.doctor')}</Tag>
                      <span>{a.patientName ?? a.patient ?? t('dentalDash.patient')}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.scheduledAt ?? a.time ?? ''}</span>
                    </Space>
                    <Tag color={a.state === 'SCHEDULED' ? 'processing' : 'success'}>{a.state ?? a.status ?? 'SCHEDULED'}</Tag>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={t('dentalDash.treatmentPlanOverview')}
        extra={
          <Button size="small" onClick={() => {
            void load();
            message.info(t('dentalDash.treatmentDataRefreshed'));
          }}>{t('dentalDash.refresh')}</Button>
        }
      >
        <DataTable
          dataSource={treatments.slice(0, 8)}
          rowKey="id"
          pagination={false}
          columns={[
            { title: t('dentalShared.patient'), dataIndex: 'patientName' },
            { title: t('dentalShared.diagnosis'), dataIndex: 'diagnosis' },
            { title: t('dentalShared.plan'), dataIndex: 'plan' },
            { title: t('dentalShared.cost'), dataIndex: 'cost', render: (v: number) => `¥${v ?? '-'}` },
            { title: t('dentalShared.status'), dataIndex: 'status', render: (s: string) => <Tag color={s === 'Completed' ? 'green' : s === 'InProgress' ? 'orange' : 'default'}>{s === 'Completed' ? t('dentalShared.statusCompleted') : s === 'InProgress' ? t('dentalShared.statusInProgress') : s ?? '-'}</Tag> },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Alert title={t('dentalDash.dataUpdatedAt', { time: refreshAt.toLocaleTimeString('zh-CN') })} type="success" showIcon style={{ marginTop: 16 }} />
    </DentalPageLayout>
  );
};

export default DentalDashboardPage;

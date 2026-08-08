// [v3.0.6.11-60] Batch 3: 口腔运营仪表板 (dentalApi 真实数据 + loading/error)
import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button, Row, Col, Statistic, Space, Alert, Tag, Spin, Empty, List, Table, message } from 'antd';
import { RefreshCw, Calendar, Users, Scan, TrendingUp, Activity, Stethoscope } from 'lucide-react';
import { DentalPageLayout, EmptyState } from './DentalShared';
import { dentalApi } from '../../services/api/dentalApi';

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
      else setError(statsRes.error?.message ?? '统计数据加载失败');
      if (aptRes.success && Array.isArray(aptRes.data)) setAppointments(aptRes.data);
      if (treatRes.success && Array.isArray(treatRes.data)) setTreatments(treatRes.data);
      setRefreshAt(new Date());
    } catch {
      setError('网络错误，统计加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) {
    return (<DentalPageLayout header={{ title: '口腔运营仪表板' }}><div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}><Spin /> 加载中...</div></DentalPageLayout>);
  }
  if (!stats && !loading) {
    return (<DentalPageLayout header={{ title: '口腔运营仪表板' }}><EmptyState tip="暂无统计数据" onCreate={() => void load()} createLabel="重新加载" /></DentalPageLayout>);
  }
  const topTreat = stats?.topTreatments || {};
  const todayDone = appointments.filter((a: any) => a.state === 'DONE' || a.state === 'completed' || a.status === 'completed').length;

  return (
    <DentalPageLayout
      header={{
        title: '口腔运营仪表板',
        extra: (
          <Space>
            <Tag color="cyan">v3.0.6.11-60</Tag>
            <Button size="small" icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>刷新</Button>
          </Space>
        ),
      }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}

      <Spin spinning={loading}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="今日患者" value={stats?.todayPatients ?? 0} prefix={<Users size={14} />} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="本周患者" value={stats?.thisWeek ?? 0} prefix={<TrendingUp size={14} />} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="今日收入" prefix="¥" value={stats?.revenueToday ?? 0} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="在治病例" value={treatments.length} prefix={<Stethoscope size={14} />} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="今日预约" value={appointments.length} prefix={<Calendar size={14} />} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="已完成" value={todayDone} prefix={<Activity size={14} />} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="今日影像" value={stats?.examCount ?? '-'} prefix={<Scan size={14} />} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="设备数" value={stats?.deviceCount ?? '-'} prefix={<Activity size={14} />} /></Card></Col>
        </Row>
      </Spin>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" title="热门治疗分布" extra={<Tag>{Object.values(topTreat).reduce((a, b) => a + (b ?? 0), 0)} 例</Tag>}>
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
          <Card size="small" title="今日安排" extra={<Tag>{appointments.length} 条</Tag>}>
            {appointments.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="今日暂无预约" />
            ) : (
              <List
                size="small"
                dataSource={appointments.slice(0, 8)}
                renderItem={(a: any) => (
                  <List.Item>
                    <Space>
                      <Tag color="blue">{a.dentistName ?? a.dentist ?? '医生'}</Tag>
                      <span>{a.patientName ?? a.patient ?? '患者'}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.scheduledAt ?? a.time ?? ''}</span>
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
        title="治疗计划一览"
        extra={
          <Button size="small" onClick={() => {
            void load();
            message.info('治疗数据已刷新');
          }}>刷新</Button>
        }
      >
        <Table
          dataSource={treatments.slice(0, 8)}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '患者', dataIndex: 'patientName' },
            { title: '诊断', dataIndex: 'diagnosis' },
            { title: '计划', dataIndex: 'plan' },
            { title: '费用', dataIndex: 'cost', render: (v: number) => `¥${v ?? '-'}` },
            { title: '状态', dataIndex: 'status', render: (s: string) => <Tag color={s === 'Completed' ? 'green' : s === 'InProgress' ? 'orange' : 'default'}>{s === 'Completed' ? '已完成' : s === 'InProgress' ? '进行中' : s ?? '-'}</Tag> },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Alert title={`数据更新于 ${refreshAt.toLocaleTimeString('zh-CN')}`} type="success" showIcon style={{ marginTop: 16 }} />
    </DentalPageLayout>
  );
};

export default DentalDashboardPage;

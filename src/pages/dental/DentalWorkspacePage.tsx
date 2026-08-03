// [v3.0.6.11-54] Phase 2: 口腔工作台 (今日预约/检查概览 + 快捷入口)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Card, Statistic, Alert, Spin, Button, Space, Tag, Empty, Typography,
} from 'antd';
import {
  Calendar, ScanLine, Activity, ArrowRight, RefreshCw, Stethoscope, Microscope, Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DentalPageLayout } from './DentalShared';
import { dentalApi, type DentalStudy } from '../../services/api/dentalApi';

const QUICK_LINKS = [
  { key: 'studies', title: '影像管理', desc: 'CBCT / 全景 / 根尖 / 口扫', icon: Layers, color: '#1677ff', href: '/dental/studies' },
  { key: 'viewer', title: '影像阅片', desc: '2D/3D 浏览 · MPR', icon: ScanLine, color: '#10b981', href: '/dental/viewer' },
  { key: 'schedule', title: '排班预约', desc: '椅位排班 · PSR', icon: Calendar, color: '#f59e0b', href: '/dental/schedule' },
  { key: 'ai', title: 'AI 辅助', desc: '龋齿检测 · ONNX', icon: Microscope, color: '#8b5cf6', href: '/dental/ai' },
  { key: 'treatment', title: '治疗中心', desc: '治疗计划 · 随访', icon: Stethoscope, color: '#06b6d4', href: '/dental/treatment' },
  { key: 'implant', title: '种植规划', desc: '3D 种植 · 导板', icon: Activity, color: '#ec4899', href: '/dental/implant-3d' },
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
      setError((e as Error)?.message ?? '加载失败');
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
        title: '口腔工作台',
        version: 'v3.0.6.11-54',
        extra: (
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>刷新</Button>
        ),
      }}
      alert={error ? { message: error, type: 'error' } : undefined}
    >
      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card hoverable><Statistic title="今日患者" value={stats?.todayPatients ?? 0} prefix={<Calendar size={14} />} /></Card></Col>
          <Col span={6}><Card hoverable><Statistic title="本周患者" value={stats?.thisWeek ?? 0} prefix={<Activity size={14} />} styles={{ content: { color: '#1677ff' } }} /></Card></Col>
          <Col span={6}><Card hoverable><Statistic title="今日收入" prefix="¥" value={stats?.revenueToday ?? 0} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col span={6}><Card hoverable><Statistic title="待处理预约" value={appointments.length} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        </Row>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {QUICK_LINKS.map((q) => (
            <Col span={8} key={q.key}>
              <Card size="small" hoverable onClick={() => navigate(q.href)} style={{ cursor: 'pointer' }}>
                <Space>
                  <q.icon color={q.color} size={18} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{q.title}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>{q.desc}</Typography.Text>
                  </div>
                  <ArrowRight size={12} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Card size="small" title={<Space><Calendar size={14} />今日预约</Space>}
              extra={<a onClick={() => navigate('/dental/schedule')} style={{ fontSize: 12 }}>排班管理 <ArrowRight size={12} /></a>}>
              {appointments.length === 0 ? (
                <Empty description="暂无待处理预约" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div>
                  {appointments.map((a) => (
                    <div key={a.id ?? a.patientId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13 }}>{a.patientName ?? a.patientId}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>{a.type ?? a.modality ?? ''} · {a.time ?? a.date ?? ''}</div>
                      </div>
                      <Tag color={(a.status === 'completed' ? 'green' : a.status === 'cancelled' ? 'red' : 'blue')}>{a.status ?? '-'}</Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title={<Space><ScanLine size={14} />最近检查</Space>}
              extra={<a onClick={() => navigate('/dental/studies')} style={{ fontSize: 12 }}>全部 <ArrowRight size={12} /></a>}>
              {recentStudies.length === 0 ? (
                <Empty description="暂无检查记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div>
                  {recentStudies.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13 }}>{s.patientName} <Tag style={{ marginLeft: 6 }}>{s.modality}</Tag></span>
                        <div style={{ fontSize: 11, color: '#999' }}>{s.region} · {s.acquisitionDate?.slice(0, 10)}</div>
                      </div>
                      <Tag color={s.quality === 'Diagnostic' ? 'green' : s.quality === 'Acceptable' ? 'blue' : 'orange'}>{s.quality}</Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
        <Alert style={{ marginTop: 16 }} title={`工作台已就绪 · 今日待办 ${pendingCount + appointments.length} 项`} type="success" showIcon />
      </Spin>
    </DentalPageLayout>
  );
};

export default DentalWorkspacePage;

// Split into individual files for proper code splitting:
export { DentalWorkspacePage } from './DentalWorkspacePage';
export { DentalTreatmentPage } from './DentalTreatmentPage';
export { DentalImplantPlanPage } from './DentalImplantPlanPage';
export { DentalOrthoPage } from './DentalOrthoPage';
export { DentalEndoPage } from './DentalEndoPage';
export { DentalPerioPage } from './DentalPerioPage';
export { DentalRestorativePage } from './DentalRestorativePage';
export { DentalSurgeryPage } from './DentalSurgeryPage';
export { DentalPediatricPage } from './DentalPediatricPage';
export { DentalTelePage } from './DentalTelePage';
export { DentalInventoryPage } from './DentalInventoryPage';
export { DentalDashboardPage } from './DentalDashboardPage';

// [v3.0.6.11-60] Batch 3: 默认导出 = 口腔总览页 (今日预约/检查统计 + 子模块快捷卡片)
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Space, Tag, Button, Alert, Spin, Empty, List } from 'antd'
import { Smile, CalendarClock, Activity, Users, Stethoscope, Brain, Archive, ShieldPlus, Scan, RefreshCw } from 'lucide-react'
import { dentalApi } from '../../services/api/dentalApi'
import { DentalPageLayout } from './DentalShared'

interface DentalStats {
  todayPatients?: number
  thisWeek?: number
  avgPerDay?: number
  revenueToday?: number
  topTreatments?: Record<string, number>
}

const MODULES: { path: string; title: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { path: '/dental/dashboard', title: '运营仪表盘', desc: '患者 / 收入 / 治疗统计', icon: <Activity size={16} />, color: '#1677ff' },
  { path: '/dental/studies', title: '影像浏览', desc: 'CBCT / 全景 / 口扫', icon: <Scan size={16} />, color: '#13c2c2' },
  { path: '/dental/treatment', title: '治疗计划', desc: '治疗全流程管理', icon: <Stethoscope size={16} />, color: '#52c41a' },
  { path: '/dental/ortho', title: '正畸管理', desc: '病例 / 阶段 / 矫治器', icon: <Smile size={16} />, color: '#eb2f96' },
  { path: '/dental/implant', title: '种植规划', desc: 'CBCT 三维种植', icon: <ShieldPlus size={16} />, color: '#fa8c16' },
  { path: '/dental/ai', title: '口腔 AI', desc: '龋齿 / 根尖 / 骨丧失检测', icon: <Brain size={16} />, color: '#722ed1' },
  { path: '/dental/inventory', title: '耗材库存', desc: '材料出入库管理', icon: <Archive size={16} />, color: '#2f54eb' },
  { path: '/dental/schedule', title: '排班与预约', desc: '牙椅排班 / 患者预约', icon: <CalendarClock size={16} />, color: '#a0d911' },
]

export const DentalOverviewPage: React.FC = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DentalStats | null>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [studies, setStudies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, aptRes, studyRes] = await Promise.all([
        dentalApi.getStats(),
        dentalApi.getTodayAppointments(),
        dentalApi.listStudies({ pageSize: 10 }),
      ])
      if (statsRes.success) setStats(statsRes.data)
      if (aptRes.success && Array.isArray(aptRes.data)) setAppointments(aptRes.data)
      if (studyRes.success && Array.isArray(studyRes.data)) setStudies(studyRes.data)
    } catch (e) {
      setError((e as Error)?.message ?? '数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <DentalPageLayout
      header={{
        title: '口腔专科总览',
        extra: <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>刷新</Button>,
      }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}
      <Spin spinning={loading && !stats}>
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="今日患者" value={stats?.todayPatients ?? '-'} prefix={<Users size={14} />} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="本周患者" value={stats?.thisWeek ?? '-'} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="今日收入" prefix="¥" value={stats?.revenueToday ?? '-'} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="今日影像" value={studies.length ?? '-'} prefix={<Activity size={14} />} /></Card></Col>
        </Row>

        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={24} md={12}>
            <Card size="small" title={<Space><CalendarClock size={14} />今日预约</Space>} extra={<Tag>{appointments.length} 条</Tag>}>
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
          <Col xs={24} md={12}>
            <Card size="small" title={<Space><Activity size={14} />今日检查</Space>} extra={<Tag>{studies.length} 例</Tag>}>
              {studies.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无检查记录" />
              ) : (
                <List
                  size="small"
                  dataSource={studies.slice(0, 8)}
                  renderItem={(s: any) => (
                    <List.Item>
                      <Space>
                        <Tag color={s.modality === 'CBCT' ? 'purple' : 'cyan'}>{s.modality ?? 'X-Ray'}</Tag>
                        <span>{s.patientName ?? s.patient ?? '患者'}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.region ?? s.acquisitionDate ?? ''}</span>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>

        <Card size="small" title="子模块快捷入口">
          <Row gutter={[12, 12]}>
            {MODULES.map((m) => (
              <Col xs={12} md={6} key={m.path}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(m.path)}
                  styles={{ body: { padding: 12 } }}
                >
                  <Space>
                    <span style={{ color: m.color }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.desc}</div>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Spin>
    </DentalPageLayout>
  )
}

const DentalAllPages = DentalOverviewPage
export default DentalAllPages

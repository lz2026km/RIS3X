import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Empty, Typography, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Calendar,
  Activity,
  FileText,
  AlertTriangle,
  Microscope,
  Stethoscope,
  UserPlus,
  ArrowRight,
  ScanLine,
  Pill,
} from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { eyeApi } from '@/services/api/eyeApi';

const { Text } = Typography;

interface KpiCard {
  key: string;
  title: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  href: string;
}

interface QuickLink {
  key: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; color?: string }>;
  color: string;
  href: string;
}

const KPI_CARDS: KpiCard[] = [
  { key: 'appt', title: '今日预约', Icon: Calendar, color: '#1677ff', href: '/eye/ris/appointments' },
  { key: 'exam', title: '今日检查', Icon: ScanLine, color: '#10b981', href: '/eye/pacs/studies' },
  { key: 'rpt', title: '待写报告', Icon: FileText, color: '#f59e0b', href: '/eye/report/drafts' },
  { key: 'crit', title: '危急值', Icon: AlertTriangle, color: '#ef4444', href: '/eye/ris/emergency' },
];

const QUICK_LINKS: QuickLink[] = [
  { key: 'pacs', title: 'PACS 检查', description: 'OCT / 眼底 / 视野 / FA / ICG', Icon: Activity, color: '#1677ff', href: '/eye/pacs/studies' },
  { key: 'ai', title: 'AI 辅助诊断', description: '多模型 · 智能预筛', Icon: Microscope, color: '#8b5cf6', href: '/eye/ai' },
  { key: 'emr', title: '眼科 EMR', description: '电子病历 · 视力量表', Icon: Stethoscope, color: '#06b6d4', href: '/eye/emr' },
  { key: 'iol', title: 'IOL 计算器', description: '8 公式 · 在线测算', Icon: Pill, color: '#10b981', href: '/eye/ris/iol-calculator' },
];

const EyeWorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const breakpoint = useBreakpoint();

  const today = useMemo(
    () => new Date().toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    }),
    [],
  );

  // Responsive grid: fewer columns on small screens
  const kpiColSpan = useMemo(() => {
    switch (breakpoint) {
      case 'xs': return 12;
      case 'sm': return 12;
      case 'md': return 12;
      case 'lg': return 6;
      default: return 6;
    }
  }, [breakpoint]);

  const linkColSpan = useMemo(() => {
    switch (breakpoint) {
      case 'xs': return 24;
      case 'sm': return 12;
      case 'md': return 12;
      case 'lg': return 6;
      default: return 6;
    }
  }, [breakpoint]);

  // Live KPIs from API; derived via useMemo from useState.
  const [appointmentCount, setAppointmentCount] = useState<number>(0);
  const [examCount, setExamCount] = useState<number>(0);
  const [draftCount, setDraftCount] = useState<number>(0);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [quickLinkMeta, setQuickLinkMeta] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [todayApptRes, studyRes, draftsRes, aiModelsRes] = await Promise.allSettled([
          eyeApi.getTodayAppointments(),
          eyeApi.getStudies({ limit: 1 }),
          eyeApi.getDrafts(),
          eyeApi.listModels({}),
        ]);
        if (cancelled) return;
        const todayAppts = todayApptRes.status === 'fulfilled' && Array.isArray(todayApptRes.value.data)
          ? todayApptRes.value.data.length
          : 0;
        const studies = studyRes.status === 'fulfilled' && Array.isArray(studyRes.value.data)
          ? studyRes.value.data.length
          : 0;
        const drafts = draftsRes.status === 'fulfilled' && Array.isArray(draftsRes.value.data)
          ? draftsRes.value.data.length
          : 0;
        const aiCount = aiModelsRes.status === 'fulfilled' && Array.isArray(aiModelsRes.value.data)
          ? aiModelsRes.value.data.length
          : 0;
        setAppointmentCount(todayAppts);
        setExamCount(studies);
        setDraftCount(drafts);
        setCriticalCount(0);
        setQuickLinkMeta({
          ai: aiCount > 0 ? `${aiCount} 模型 · 智能预筛` : '智能预筛',
          iol: '8 公式 · 在线测算',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const kpiValues = useMemo(() => ({
    appt: appointmentCount,
    exam: examCount,
    rpt: draftCount,
    crit: criticalCount,
  }), [appointmentCount, examCount, draftCount, criticalCount]);

  const displayName = user?.name ?? '医生';

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-workspace-page">
      <PageHeader
        title={`眼科工作台 · 欢迎,${displayName}`}
        subtitle={today}
        icon={<Eye className="v4-icon" style={{ width: 28, height: 28, color: '#1677ff' }} />}
        variant="inline"
        actions={
          <button
            type="button"
            onClick={() => navigate('/eye/ris/appointments?action=new')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: '#1677ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <UserPlus size={14} />
            新建预约
          </button>
        }
      />

      <Spin spinning={loading}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {KPI_CARDS.map((k) => (
            <Col xs={12} sm={12} md={kpiColSpan} key={k.key}>
              <Card
                size="small"
                hoverable
                onClick={() => navigate(k.href)}
                style={{ cursor: 'pointer' }}
                styles={{ body: { padding: 12 } }}
              >
                <Statistic
                  title={
                    <span style={{ fontSize: 12, color: '#64748b' }}>{k.title}</span>
                  }
                  value={kpiValues[k.key as keyof typeof kpiValues]}
                  prefix={<k.Icon className="v4-icon" style={{ color: k.color }} />}
                  valueStyle={{ fontSize: 22, color: k.color }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {QUICK_LINKS.map((q) => (
          <Col xs={24} sm={12} md={linkColSpan} key={q.key}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate(q.href)}
              data-testid={`eye-quicklink-${q.key}`}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <q.Icon color={q.color} style={{ width: 32, height: 32, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{q.title}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {quickLinkMeta[q.key] ?? q.description}
                  </Text>
                </div>
                <ArrowRight size={14} className="v4-icon" style={{ color: '#94a3b8' }} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title="今日手术安排"
            extra={
              <a onClick={() => navigate('/eye/ris/surgeries')} style={{ fontSize: 12 }}>
                查看全部 <ArrowRight size={12} className="v4-icon" />
              </a>
            }
          >
            <Empty
              description="暂无手术安排"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Tag color="blue">对接 /api/v1/eye/ris/surgeries</Tag>
            </Empty>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title="待办事项"
            extra={
              <a onClick={() => navigate('/worklist/inbox')} style={{ fontSize: 12 }}>
                工作清单 <ArrowRight size={12} className="v4-icon" />
              </a>
            }
          >
            <Empty
              description="暂无待办"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Tag color="processing">对接 /api/v1/eye/ris/appointments</Tag>
            </Empty>
          </Card>
        </Col>
      </Row>

      <style>{`
        .v4-icon { display: inline-block; vertical-align: middle; }
      `}</style>
    </PageContainer>
  );
};

export default EyeWorkspacePage;
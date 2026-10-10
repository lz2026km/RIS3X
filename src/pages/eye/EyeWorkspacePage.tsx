import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Empty, Typography, Spin, Space } from 'antd';
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
  Box,
  Package,
} from 'lucide-react';
import { PageContainer, PageHeader, ActionButton, ExportButton, StatCard, StatCardGrid } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { eyeApi } from '@/services/api/eyeApi';
import { ErrorBanner } from '@/components/feedback';
import { t } from '../../i18n/appI18n';

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
  { key: 'appt', title: 'eyeWs.kpi.appt', Icon: Calendar, color: '#2563eb', href: '/appointments' },
  { key: 'exam', title: 'eyeWs.kpi.exam', Icon: ScanLine, color: '#10b981', href: '/eye/pacs/studies' },
  { key: 'rpt', title: 'eyeWs.kpi.rpt', Icon: FileText, color: '#f59e0b', href: '/eye/report/drafts' },
  { key: 'crit', title: 'eyeWs.kpi.crit', Icon: AlertTriangle, color: '#ef4444', href: '/eye/ris/emergency' },
];

const QUICK_LINKS: QuickLink[] = [
  { key: 'pacs', title: 'eyeWs.quick.pacsTitle', description: 'eyeWs.quick.pacsDesc', Icon: Activity, color: '#2563eb', href: '/eye/pacs/studies' },
  { key: 'ai', title: 'eyeWs.quick.aiTitle', description: 'eyeWs.quick.aiDesc', Icon: Microscope, color: '#8b5cf6', href: '/eye/ai' },
  { key: 'emr', title: 'eyeWs.quick.emrTitle', description: 'eyeWs.quick.emrDesc', Icon: Stethoscope, color: '#06b6d4', href: '/eye/emr' },
  { key: 'iol', title: 'eyeWs.quick.iolTitle', description: 'eyeWs.quick.iolDesc', Icon: Pill, color: '#10b981', href: '/eye/ris/iol-calculator' },
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // [G005 Wave1A P0] IOL 库存摘要: GET /eye/iol/inventory + low-stock + expiring
  const [iolSummary, setIolSummary] = useState<{ total: number; lowStock: number; expiring: number }>({ total: 0, lowStock: 0, expiring: 0 });
  // [Wave1B P2] IOL 计算记录: GET /eye/iol/calculations (listIolCalculations)
  const [iolRecords, setIolRecords] = useState<any[]>([]);
  const [iolRecordsLoading, setIolRecordsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIolRecordsLoading(true);
      try {
        const res = await eyeApi.listIolCalculations({ limit: 10 });
        if (!cancelled && res.success && Array.isArray(res.data)) setIolRecords(res.data as any[]);
      } catch { setLoadError(t('w9.states.error')); } finally {
        if (!cancelled) setIolRecordsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [inv, low, exp] = await Promise.allSettled([
          eyeApi.getIolInventory(),
          eyeApi.getIolLowStock(),
          eyeApi.getIolExpiring(90),
        ]);
        if (cancelled) return;
        setIolSummary({
          total: inv.status === 'fulfilled' && Array.isArray(inv.value.data) ? inv.value.data.length : 0,
          lowStock: low.status === 'fulfilled' && Array.isArray(low.value.data) ? low.value.data.length : 0,
          expiring: exp.status === 'fulfilled' && Array.isArray(exp.value.data) ? exp.value.data.length : 0,
        });
      } catch { setLoadError(t('w9.states.error')); }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

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
          ai: aiCount > 0 ? t('eyeWs.aiModelCount', { count: aiCount }) : t('eyeWs.smartPrescreen'),
          iol: t('eyeWs.iolFormulaDesc'),
        });
        const allRejected = [todayApptRes, studyRes, draftsRes, aiModelsRes].every((r) => r.status === 'rejected');
        if (allRejected) setLoadError(t('w9.states.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const kpiValues = useMemo(() => ({
    appt: appointmentCount,
    exam: examCount,
    rpt: draftCount,
    crit: criticalCount,
  }), [appointmentCount, examCount, draftCount, criticalCount]);

  const displayName = user?.name ?? t('eyeWs.doctorFallback');

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-workspace-page">
      <PageHeader
        title={t('eyeWs.welcomeTitle', { name: displayName })}
        subtitle={today}
        icon={<Eye className="v4-icon" style={{ width: 28, height: 28, color: '#2563eb' }} />}
        variant="inline"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/appointments?action=new')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={14} />
              {t('eyeWs.newAppointment')}
            </button>
            <ActionButton action="refresh" loading={loading} onClick={() => setReloadTick((n) => n + 1)}>{t('w45.actions.refresh')}</ActionButton>
            <ExportButton
              data={() => iolRecords}
              filename="eye-workspace-iol"
              label={t('w45.actions.export')}
              size="small"
              formats={["csv", "json"]}
            />
          </>
        }
      />

      {loadError && !loading && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}

      <Spin spinning={loading}>
        <StatCardGrid minWidth={200} gap={12} style={{ marginBottom: 16 }}>
          {KPI_CARDS.map((k) => (
            <StatCard
              key={k.key}
              title={t(k.title)}
              value={kpiValues[k.key as keyof typeof kpiValues]}
              icon={<k.Icon className="v4-icon" style={{ color: k.color }} />}
              color={k.color}
              onClick={() => navigate(k.href)}
            />
          ))}
        </StatCardGrid>
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
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t(q.title)}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {quickLinkMeta[q.key] ?? t(q.description)}
                  </Text>
                </div>
                <ArrowRight size={14} className="v4-icon" style={{ color: 'var(--text-secondary)' }} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* [G005 Wave1A P0] IOL 库存区块: GET /eye/iol/inventory + low-stock + expiring (MaterialsPage /materials 明细) */}
      <Card
        size="small"
        title={<Space><Box size={15} color="#10b981" />{t('eyeWs.iolInventory')}</Space>}
        style={{ marginBottom: 16 }}
        extra={
          <a onClick={() => navigate('/materials')} style={{ fontSize: 12 }}>
            {t('eyeWs.inventoryDetail')} <ArrowRight size={12} className="v4-icon" />
          </a>
        }
      >
        <Row gutter={12}>
          <Col xs={8} md={4}>
            <Statistic title={t('eyeWs.inventoryTotal')} value={iolSummary.total} prefix={<Package size={14} />} valueStyle={{ fontSize: 20 }} />
          </Col>
          <Col xs={8} md={4}>
            <Statistic title={t('eyeWs.lowStock')} value={iolSummary.lowStock} valueStyle={{ color: iolSummary.lowStock > 0 ? '#faad14' : undefined, fontSize: 20 }} />
          </Col>
          <Col xs={8} md={4}>
            <Statistic title={t('eyeWs.expiring90')} value={iolSummary.expiring} valueStyle={{ color: iolSummary.expiring > 0 ? '#ff4d4f' : undefined, fontSize: 20 }} />
          </Col>
          <Col xs={24} md={12} style={{ display: 'flex', alignItems: 'center' }}>
            <Space size={6} wrap>
              {iolSummary.lowStock > 0 && <Tag color="warning">{t('eyeWs.lowStockTag', { count: iolSummary.lowStock })}</Tag>}
              {iolSummary.expiring > 0 && <Tag color="error">{t('eyeWs.expiringTag', { count: iolSummary.expiring })}</Tag>}
              {iolSummary.total === 0 && iolSummary.lowStock === 0 && <Tag>{t('eyeWs.offlineNoData')}</Tag>}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* [Wave1B P2] IOL 计算记录: GET /eye/iol/calculations (eyeApi.listIolCalculations) */}
      <Card
        size="small"
        title={<Space><FileText size={15} color="#10b981" />{t('eyeWs.iolRecords')}</Space>}
        style={{ marginBottom: 16 }}
        extra={
          <a onClick={() => navigate('/eye/ris/iol-calculator')} style={{ fontSize: 12 }}>
            {t('eyeWs.iolCalculator')} <ArrowRight size={12} className="v4-icon" />
          </a>
        }
      >
        <Spin spinning={iolRecordsLoading}>
          {iolRecords.length === 0 ? (
            <Empty
              description={t('eyeWs.noCalcRecords')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '8px 0' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {iolRecords.slice(0, 10).map((r: any, i: number) => (
                <div
                  key={r.id ?? i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    background: 'var(--bg-primary)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <Tag color="green">{r.formula ?? r.method ?? 'IOL'}</Tag>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.iolPower != null ? `${r.iolPower}D` : (r.power != null ? `${r.power}D` : '-')}
                  </span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.patientName || r.patientId || t('eyeWs.unboundPatient')}
                    {r.eyeSide ? ` · ${r.eyeSide}` : ''}
                  </Text>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Spin>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={t('eyeWs.todaySurgeries')}
            extra={
              <a onClick={() => navigate('/eye/ris')} style={{ fontSize: 12 }}>
                {t('eyeWs.viewAll')} <ArrowRight size={12} className="v4-icon" />
              </a>
            }
          >
            <Empty
              description={t('eyeWs.noSurgeries')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Tag color="blue">{t('eyeWs.surgeriesEndpoint')}</Tag>
            </Empty>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={t('eyeWs.todoItems')}
            extra={
              <a onClick={() => navigate('/worklist')} style={{ fontSize: 12 }}>
                {t('eyeWs.worklist')} <ArrowRight size={12} className="v4-icon" />
              </a>
            }
          >
            <Empty
              description={t('eyeWs.noTodos')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Tag color="processing">{t('eyeWs.appointmentsEndpoint')}</Tag>
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
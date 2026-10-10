// [v3.0.6.8-50] PR6: v3 报告全栈综合页面
// @deprecated [v3.0.6.11-104 Wave 5A] 报告书写入口已收敛至 ReportWritePage; 旧路由 /v3-report-hub redirect → /write-report。
//   其可复用能力(模板/草稿/AI/质控)已由 ReportWritePage 侧栏 Tab 覆盖，本文件保留仅作参考/回退。
import { reportApi } from '@/services/api/reportApi';
import {
  v3WritingApi, v3DistApi, v3IntegrationApi, v3AiAssistApi,
  v3QualityReportApi, v3PacsApi, v3AnalyticsApi,
} from '@/services/api/v3Api';
import type { ReportDto } from '@/types/dto';
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  message,
  Tabs,
  List,
  Empty,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import {
  Edit3,
  Send,
  BarChart3,
  RefreshCw,
  Sparkles,
  ClipboardList,
  Layers,
  Database,
  Network,
} from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n/appI18n';

export const V3ReportHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  // 概览
  const [dash, setDash] = useState<any>(null);
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // 写作
  const [templates, setTemplates] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);

  // 分发
  const [tasks, setTasks] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);

  // 集成
  const [fhirList, setFhirList] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);

  // AI
  const [aiDrafts, setAiDrafts] = useState<any[]>([]);

  // 质控
  const [qcReports, setQcReports] = useState<any[]>([]);

  // PACS
  const [studies, setStudies] = useState<any[]>([]);

  // 加载
  const loadAll = useCallback(async () => {
    try {
      const d = await v3AnalyticsApi.getDashboard({ period: 'month' });
      if (d.success) setDash(d.data);      const tplRes = await v3WritingApi.listTemplates();
      if (tplRes.success) {
        const arr = Array.isArray(tplRes.data) ? tplRes.data : ((tplRes.data as any)?.items ?? []);
        setTemplates(arr.slice(0, 20));
      }
      const dr = await v3WritingApi.listDrafts();
      if (dr.success) {
        const arr = Array.isArray(dr.data) ? dr.data : ((dr.data as any)?.items ?? []);
        setDrafts(arr.slice(0, 20));
      }
      const t2 = await v3DistApi.listTasks();
      if (t2.success) setTasks((t2.data || []).slice(0, 20));
      const ch = await v3DistApi.listChannels();
      if (ch.success) setChannels((ch.data || []).slice(0, 10));
      const fh = await v3IntegrationApi.listFHIR();
      if (fh.success) setFhirList((fh.data || []).slice(0, 10));
      const wh = await v3IntegrationApi.listWebhooks();
      if (wh.success) setWebhooks(wh.data || []);
      const aid = await v3AiAssistApi.listDrafts();
      if (aid.success) setAiDrafts((aid.data || []).slice(0, 20));
      const qcr = await v3QualityReportApi.listReports();
      if (qcr.success) setQcReports((qcr.data || []).slice(0, 20));
      const st = await v3PacsApi.listStudies();
      if (st.success) setStudies((st.data || []).slice(0, 20));
    } catch (e: any) { message.error(e.message); }
  }, []);
  useEffect(() => { void loadAll(); }, [loadAll]);

  // [v3.0.6.11-54] Phase 2: 接入 reportApi 真实报告列表
  const [reportPage, setReportPage] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);
  const REPORT_PAGE_SIZE = 10;
  const loadReports = useCallback(async (p: number = reportPage) => {
    setReportsLoading(true);
    try {
      const res = await reportApi.list({ page: p, pageSize: REPORT_PAGE_SIZE });
      if (res.success) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
        setReports(list);
        setReportTotal(res.meta?.total ?? list.length ?? 0);
      }
    } catch {
      setReports([]);
      setReportTotal(0);
    } finally {
      setReportsLoading(false);
    }
  }, [reportPage]);
  useEffect(() => { void loadReports(reportPage); }, [loadReports, reportPage]);

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('v3Hub.title')}</span>
        <Tag color="cyan">PR6 (v3.0.6.8-50)</Tag>
        <Tag color="purple">{t('v3Hub.tagUpgrade')}</Tag>
        <Tag color="green">{t('v3Hub.tagClients')}</Tag>
      </Space>

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('v3Hub.statTemplates')} value={templates.length} color="primary" />
        <StatCard title={t('v3Hub.statTasks')} value={tasks.length} color="success" />
        <StatCard title={t('v3Hub.statFhir')} value={fhirList.length} />
        <StatCard title={t('v3Hub.statAiDrafts')} value={aiDrafts.length} color="#722ed1" />
        <StatCard title={t('v3Hub.statWebhooks')} value={webhooks.length} />
        <StatCard title={t('v3Hub.statQcReports')} value={qcReports.length} />
      </StatCardGrid>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'overview',
            label: <span><BarChart3 size={14} /> {t('v3Hub.tabOverview')}</span>,
            children: (
              <>
                <Card title={t('v3Hub.analyticsDash')} size="small">
                  {dash ? (
                    <StatCardGrid minWidth={200} gap={16}>
                      <StatCard title={t('v3Hub.statTotalReports')} value={dash.totalReports || 0} />
                      <StatCard title={t('v3Hub.statReviewed')} value={dash.reviewed || 0} color="success" />
                      <StatCard title={t('v3Hub.statAvgTat')} value={dash.avgTAT || 0} suffix="h" />
                      <StatCard title={t('v3Hub.statSignedRate')} value={dash.signedRate || 0} suffix="%" />
                      <StatCard title={t('v3Hub.statAiAdoption')} value={dash.aiAdoption || 0} suffix="%" color="#722ed1" />
                      <StatCard title={t('v3Hub.statDistSuccess')} value={dash.distSuccess || 0} suffix="%" />
                    </StatCardGrid>
                  ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('v3Hub.loading')} />}
                </Card>
                <Card
                  size="small"
                  title={t('v3Hub.recentReports')}
                  style={{ marginTop: 16 }}
                  extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadReports(reportPage)}>{t('v3Hub.refresh')}</Button>}
                >
                  <DataTable
                    rowKey={(r) => r.id ?? r.reportId ?? ''}
                    loading={reportsLoading}
                    dataSource={reports}
                    pagination={{ current: reportPage, pageSize: REPORT_PAGE_SIZE, total: reportTotal, onChange: setReportPage, showSizeChanger: false }}
                    columns={[
                      { title: t('v3Hub.colReportNo'), key: 'no', render: (_: unknown, r: any) => r.reportId ?? r.id },
                      { title: t('v3Hub.colPatient'), key: 'patient', render: (_: unknown, r: any) => r.patientName ?? '-' },
                      { title: t('v3Hub.colItem'), key: 'item', render: (_: unknown, r: any) => r.examItem ?? r.modality ?? '-' },
                      { title: t('v3Hub.colStatus'), key: 'status', render: (_: unknown, r: any) => <Tag color={String(r.status ?? '').startsWith('signed') ? 'green' : 'blue'}>{r.status ?? '-'}</Tag> },
                      { title: t('v3Hub.colTime'), key: 'at', render: (_: unknown, r: any) => r.reportAt ? new Date(r.reportAt).toLocaleDateString() : '-' },
                    ]}
                  scroll={{ x: 'max-content' }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'writing',
            label: <span><Edit3 size={14} /> {t('v3Hub.tabWriting')}</span>,
            children: (
              <Card
                title={t('v3Hub.writingTitle')}
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>{t('v3Hub.refresh')}</Button>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={t('v3Hub.reportTemplates')}>
                      <List size="small" dataSource={templates} renderItem={tpl => (
                        <List.Item>
                          <List.Item.Meta
                            title={<span>{tpl.name || tpl.id}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{tpl.modality || ''} · {tpl.bodyPart || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={t('v3Hub.drafts')}>
                      <List size="small" dataSource={drafts} renderItem={d => (
                        <List.Item>
                          <List.Item.Meta
                            title={<span>{d.id || d.reportId}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{d.status || ''} · {d.patientName || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'dist',
            label: <span><Send size={14} /> {t('v3Hub.tabDist')}</span>,
            children: (
              <Card
                title={t('v3Hub.distTitle')}
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>{t('v3Hub.refresh')}</Button>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={t('v3Hub.distTasks')}>
                      <List size="small" dataSource={tasks} renderItem={task => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Tag color="blue">{task.channel || '-'}</Tag>}
                            title={<span>{task.id || task.reportId}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{task.status || ''} · {task.recipient || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={t('v3Hub.distChannels')}>
                      <List size="small" dataSource={channels} renderItem={c => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Tag color="green">{c.type || '-'}</Tag>}
                            title={<span>{c.name}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{c.status || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'integration',
            label: <span><Network size={14} /> {t('v3Hub.tabIntegration')}</span>,
            children: (
              <Card
                title={t('v3Hub.integrationTitle')}
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>{t('v3Hub.refresh')}</Button>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={t('v3Hub.fhirResources')}>
                      <List size="small" dataSource={fhirList} renderItem={f => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Tag color="purple">{f.resourceType || '-'}</Tag>}
                            title={<span>{f.id || f.resourceId}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{f.status || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={t('v3Hub.webhooks')}>
                      <List size="small" dataSource={webhooks} renderItem={w => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Tag color="cyan">{w.event || '-'}</Tag>}
                            title={<span>{w.url || w.endpoint}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{w.status || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'ai',
            label: <span><Sparkles size={14} /> {t('v3Hub.tabAi')}</span>,
            children: (
              <Card
                title={t('v3Hub.aiTitle')}
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>{t('v3Hub.refresh')}</Button>}
              >
                <List size="small" dataSource={aiDrafts} renderItem={a => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Space><Tag color="purple">{a.riskLevel || 'low'}</Tag><span>{a.id || a.reportId}</span></Space>}
                      description={<span style={{ fontSize: 11, color: '#999' }}>{t('v3Hub.ddx')} {a.differential?.slice(0, 3)?.join(', ') || '-'}</span>}
                    />
                  </List.Item>
                )} />
              </Card>
            ),
          },
          {
            key: 'quality',
            label: <span><ClipboardList size={14} /> {t('v3Hub.tabQuality')}</span>,
            children: (
              <Card
                title={t('v3Hub.qualityTitle')}
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>{t('v3Hub.refresh')}</Button>}
              >
                <List size="small" dataSource={qcReports} renderItem={q => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Space><Tag color="orange">{q.period || 'month'}</Tag><span>{q.id}</span></Space>}
                      description={<span style={{ fontSize: 11, color: '#999' }}>{t('v3Hub.totalScore')} {q.score || '-'} · {t('v3Hub.published')} {q.publishedAt?.slice(0, 10) || '-'}</span>}
                    />
                  </List.Item>
                )} />
              </Card>
            ),
          },
          {
            key: 'pacs',
            label: <span><Database size={14} /> {t('v3Hub.tabPacs')}</span>,
            children: (
              <Card
                title={t('v3Hub.pacsTitle')}
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>{t('v3Hub.refresh')}</Button>}
              >
                <List size="small" dataSource={studies} renderItem={s => (
                  <List.Item>
                    <List.Item.Meta
                      title={<span>{s.studyInstanceUID || s.uid}</span>}
                      description={<span style={{ fontSize: 11, color: '#999' }}>{s.modality || ''} · {s.patientID || ''}</span>}
                    />
                  </List.Item>
                )} />
              </Card>
            ),
          },
        ]}
      />
    </PageContainer>
  );
};

export default V3ReportHubPage;

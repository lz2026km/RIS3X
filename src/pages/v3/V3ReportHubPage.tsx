// [v3.0.6.8-50] PR6: v3 报告全栈综合页面
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Space, Tag, Button, Input, Row, Col, message,
  Tabs, List, Empty, Statistic, Table,
} from 'antd';
import {
  Edit3, Send, BarChart3, RefreshCw, Sparkles, ClipboardList, Layers,
  Database, Network,
} from 'lucide-react';
import {
  v3WritingApi, v3DistApi, v3IntegrationApi, v3AiAssistApi,
  v3QualityReportApi, v3PacsApi, v3AnalyticsApi,
} from '@/services/api/v3Api';
import { reportApi } from '@/services/api/reportApi';
import type { ReportDto } from '@/types/dto';

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
      if (d.success) setDash(d.data);      const t = await v3WritingApi.listTemplates();
      if (t.success) setTemplates((t.data || []).slice(0, 20));
      const dr = await v3WritingApi.listDrafts();
      if (dr.success) setDrafts((dr.data || []).slice(0, 20));
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
  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await reportApi.list({ page: 1, pageSize: 10 });
      if (res.success) setReports((res.data ?? []).slice(0, 10));
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);
  useEffect(() => { void loadReports(); }, [loadReports]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>v3 报告全栈</span>
        <Tag color="cyan">PR6 (v3.0.6.8-50)</Tag>
        <Tag color="purple">Medisoft mediSIGHT 升级</Tag>
        <Tag color="green">40 client + 194 端点</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="报告模板" value={templates.length} styles={{ content: {  color: '#1677ff'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="分发任务" value={tasks.length} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="FHIR 资源" value={fhirList.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="AI 草稿" value={aiDrafts.length} styles={{ content: {  color: '#722ed1'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Webhooks" value={webhooks.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="质控报告" value={qcReports.length} /></Card></Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'overview',
            label: <span><BarChart3 size={14} /> 概览</span>,
            children: (
              <>
                <Card title="v3 Analytics 仪表盘" size="small">
                  {dash ? (
                    <Row gutter={[16, 16]}>
                      <Col span={8}><Statistic title="总报告" value={dash.totalReports || 0} /></Col>
                      <Col span={8}><Statistic title="已审" value={dash.reviewed || 0} styles={{ content: {  color: '#52c41a'  } }} /></Col>
                      <Col span={8}><Statistic title="平均 TAT" value={dash.avgTAT || 0} suffix="h" /></Col>
                      <Col span={8}><Statistic title="签名率" value={dash.signedRate || 0} suffix="%" /></Col>
                      <Col span={8}><Statistic title="AI 采纳" value={dash.aiAdoption || 0} suffix="%" styles={{ content: {  color: '#722ed1'  } }} /></Col>
                      <Col span={8}><Statistic title="分发成功率" value={dash.distSuccess || 0} suffix="%" /></Col>
                    </Row>
                  ) : <Empty description="加载中" />}
                </Card>
                <Card
                  size="small"
                  title="最近报告 (reportApi)"
                  style={{ marginTop: 16 }}
                  extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadReports()}>刷新</Button>}
                >
                  <Table
                    rowKey={(r) => r.id ?? r.reportId ?? ''}
                    size="small"
                    loading={reportsLoading}
                    dataSource={reports}
                    pagination={false}
                    columns={[
                      { title: '报告号', key: 'no', render: (_: unknown, r: any) => r.reportId ?? r.id },
                      { title: '患者', key: 'patient', render: (_: unknown, r: any) => r.patientName ?? '-' },
                      { title: '项目', key: 'item', render: (_: unknown, r: any) => r.examItem ?? r.modality ?? '-' },
                      { title: '状态', key: 'status', render: (_: unknown, r: any) => <Tag color={String(r.status ?? '').startsWith('signed') ? 'green' : 'blue'}>{r.status ?? '-'}</Tag> },
                      { title: '时间', key: 'at', render: (_: unknown, r: any) => r.reportAt ? new Date(r.reportAt).toLocaleDateString() : '-' },
                    ]}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'writing',
            label: <span><Edit3 size={14} /> 写作</span>,
            children: (
              <Card
                title="v3 写作 (40 端点)"
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>刷新</Button>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title="报告模板">
                      <List size="small" dataSource={templates} renderItem={t => (
                        <List.Item>
                          <List.Item.Meta
                            title={<span>{t.name || t.id}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{t.modality || ''} · {t.bodyPart || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="草稿">
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
            label: <span><Send size={14} /> 分发 (30 端点)</span>,
            children: (
              <Card
                title="v3 分发"
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>刷新</Button>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title="分发任务">
                      <List size="small" dataSource={tasks} renderItem={t => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Tag color="blue">{t.channel || '-'}</Tag>}
                            title={<span>{t.id || t.reportId}</span>}
                            description={<span style={{ fontSize: 11, color: '#999' }}>{t.status || ''} · {t.recipient || ''}</span>}
                          />
                        </List.Item>
                      )} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="分发渠道">
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
            label: <span><Network size={14} /> 集成 (44 端点)</span>,
            children: (
              <Card
                title="v3 集成 (HL7/FHIR/IHE XDS/HIS/Webhook)"
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>刷新</Button>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title="FHIR 资源">
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
                    <Card size="small" title="Webhooks">
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
            label: <span><Sparkles size={14} /> AI 协助 (15 端点)</span>,
            children: (
              <Card
                title="v3 AI 协助 (预审/风险/DDX/同意)"
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>刷新</Button>}
              >
                <List size="small" dataSource={aiDrafts} renderItem={a => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Space><Tag color="purple">{a.riskLevel || 'low'}</Tag><span>{a.id || a.reportId}</span></Space>}
                      description={<span style={{ fontSize: 11, color: '#999' }}>DDx: {a.differential?.slice(0, 3)?.join(', ') || '-'}</span>}
                    />
                  </List.Item>
                )} />
              </Card>
            ),
          },
          {
            key: 'quality',
            label: <span><ClipboardList size={14} /> 质控 (15 端点)</span>,
            children: (
              <Card
                title="v3 质控报告 (月/季/年)"
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>刷新</Button>}
              >
                <List size="small" dataSource={qcReports} renderItem={q => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Space><Tag color="orange">{q.period || 'month'}</Tag><span>{q.id}</span></Space>}
                      description={<span style={{ fontSize: 11, color: '#999' }}>总分: {q.score || '-'} · 发布: {q.publishedAt?.slice(0, 10) || '-'}</span>}
                    />
                  </List.Item>
                )} />
              </Card>
            ),
          },
          {
            key: 'pacs',
            label: <span><Database size={14} /> PACS (6 端点)</span>,
            children: (
              <Card
                title="v3 PACS 研究 (studies/uid/verify/wado/qido/stow)"
                size="small"
                extra={<Button icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>刷新</Button>}
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
    </div>
  );
};

export default V3ReportHubPage;

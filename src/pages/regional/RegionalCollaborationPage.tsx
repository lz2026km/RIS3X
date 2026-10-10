/**
 * [G005 Wave 4B] 区域医联体协同中心 (RegionalCollaborationPage) — /regional/collaboration
 * 对标: 区域影像中心 (Regional Imaging Center) / 医联体协同平台
 * 端点: regionalApi 11+ (institutions / cross-query / access-records / consultations /
 *       document-registry / audit-trail / sites / sync-events / routing-rules)
 *   - 后端 regional.controller 已实现, MSW regionalHandlers 兜底
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card,
  Col,
  Row,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Spin,
  Modal,
  Form,
  message,
  Timeline,
  Badge,
  Empty,
  List,
  Typography,
} from "antd";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
} from "recharts";
import { ChartContainer, chartDefaults } from "@/components/charts";
import {
  Building2, Network, Share2, MessageSquare, Activity, Globe, Database,
  Search, BookOpenCheck, ShieldCheck, RefreshCw, Video, PhoneIncoming, CheckCircle2,
} from "lucide-react";
import { regionalApi, type InstitutionDto, type CrossInstitutionStudyDto, type AccessRecordDto, type ConsultationRequestDto, type RegionalSiteDto, type RegionalSiteSyncEventDto, type RegionalSiteRoutingRuleDto } from "@/services/api/regionalApi";
import { DataTable, StatCard, StatCardGrid } from "../../components/common";
import { t } from "../../i18n/appI18n";

const { Text } = Typography;

const INST_STATUS_MAP: Record<string, { color: string; label: string }> = {
  online: { color: "green", label: "regionalCollab.instStatus.online" },
  offline: { color: "red", label: "regionalCollab.instStatus.offline" },
  busy: { color: "orange", label: "regionalCollab.instStatus.busy" },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  normal: { color: "blue", label: "regionalCollab.priority.normal" },
  urgent: { color: "orange", label: "regionalCollab.priority.urgent" },
  critical: { color: "red", label: "regionalCollab.priority.critical" },
};

const REQ_STATUS_MAP: Record<string, { color: string; label: string }> = {
  open: { color: "orange", label: "regionalCollab.reqStatus.open" },
  "in-progress": { color: "blue", label: "regionalCollab.reqStatus.inProgress" },
  completed: { color: "green", label: "regionalCollab.reqStatus.completed" },
};

const SITE_STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: "green", label: "regionalCollab.siteStatus.active" },
  offline: { color: "red", label: "regionalCollab.siteStatus.offline" },
  syncing: { color: "blue", label: "regionalCollab.siteStatus.syncing" },
  maintenance: { color: "orange", label: "regionalCollab.siteStatus.maintenance" },
};

const SYNC_TYPE_MAP: Record<string, { color: string; label: string }> = {
  study_pushed: { color: "blue", label: "regionalCollab.syncType.studyPushed" },
  study_pulled: { color: "cyan", label: "regionalCollab.syncType.studyPulled" },
  user_sync: { color: "purple", label: "regionalCollab.syncType.userSync" },
  config_sync: { color: "geekblue", label: "regionalCollab.syncType.configSync" },
};

const RegionalCollaborationPage: React.FC = () => {
  // 数据
  const [institutions, setInstitutions] = useState<InstitutionDto[]>([]);
  const [accessRecords, setAccessRecords] = useState<AccessRecordDto[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRequestDto[]>([]);
  const [sites, setSites] = useState<RegionalSiteDto[]>([]);
  const [syncEvents, setSyncEvents] = useState<RegionalSiteSyncEventDto[]>([]);
  const [routingRules, setRoutingRules] = useState<RegionalSiteRoutingRuleDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "demo">("api");

  // 跨院调阅检索
  const [instId, setInstId] = useState<string>("");
  const [queryType, setQueryType] = useState<string>("name");
  const [queryValue, setQueryValue] = useState<string>("");
  const [crossResults, setCrossResults] = useState<CrossInstitutionStudyDto[]>([]);
  const [crossLoading, setCrossLoading] = useState(false);
  const [searchRan, setSearchRan] = useState(false);

  // 会诊发起
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm] = Form.useForm();
  const [applying, setApplying] = useState(false);

  const [auditTrail, setAuditTrail] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, accRes, regRes, conRes, sitesRes, evtRes, ruleRes, auditRes] = await Promise.all([
        regionalApi.listInstitutions(),
        regionalApi.listAccessRecords(),
        regionalApi.listDocumentRegistry(),
        regionalApi.listConsultationRequests(),
        regionalApi.listSites(),
        regionalApi.listSiteSyncEvents(),
        regionalApi.listSiteRoutingRules(),
        regionalApi.listAuditTrail(),
      ]);
      let ok = true;
      if (instRes.success && Array.isArray(instRes.data)) setInstitutions(instRes.data); else ok = false;
      if (accRes.success && Array.isArray(accRes.data)) setAccessRecords(accRes.data); else ok = false;
      if (regRes.success && Array.isArray(regRes.data)) setRegistry(regRes.data); else ok = false;
      if (conRes.success && Array.isArray(conRes.data)) setConsultations(conRes.data); else ok = false;
      if (sitesRes.success && Array.isArray(sitesRes.data?.data)) setSites(sitesRes.data.data); else ok = false;
      if (evtRes.success && Array.isArray(evtRes.data?.data)) setSyncEvents(evtRes.data.data); else ok = false;
      if (ruleRes.success && Array.isArray(ruleRes.data?.data)) setRoutingRules(ruleRes.data.data); else ok = false;
      if (auditRes.success && Array.isArray(auditRes.data)) setAuditTrail(auditRes.data); else ok = false;
      setSource(ok ? "api" : "demo");
    } catch {
      setSource("demo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ── 跨院调阅检索 ──
  const handleCrossQuery = async () => {
    setCrossLoading(true);
    setSearchRan(true);
    try {
      const res = await regionalApi.crossInstitutionQuery({ institutionId: instId, queryType, queryValue });
      if (res.success && Array.isArray(res.data)) {
        setCrossResults(res.data);
        setSource("api");
        message.success(t('w9e.regionalCollab.crossQueryFound', { count: res.data.length }));
      } else {
        setCrossResults([]);
      }
    } catch {
      message.error(t('regionalCollab.crossQueryFailed'));
      setCrossResults([]);
    } finally {
      setCrossLoading(false);
    }
  };

  // ── 调阅 (记录 + 提示) ──
  const handleAccess = async (study: CrossInstitutionStudyDto) => {
    try {
      const res = await regionalApi.createAccessRecord({
        patientName: study.patientName,
        patientId: study.patientId,
        studyType: `${study.modality} ${study.studyDescription}`,
        hospital: study.institution,
        purpose: t('regionalCollab.purposeCrossAccess'),
        accessor: t('regionalCollab.currentUser'),
      });
      if (res.success && res.data) {
        setAccessRecords((prev) => [res.data, ...prev]);
        message.success(t('w9e.regionalCollab.accessRecorded', { patient: study.patientName, institution: study.institution }));
      } else {
        throw new Error(t('regionalCollab.recordFailed'));
      }
    } catch {
      message.warning(t('regionalCollab.accessRecordOffline'));
      const local: AccessRecordDto = {
        id: `ARC-${Date.now()}`, patientName: study.patientName, patientId: study.patientId,
        studyType: `${study.modality} ${study.studyDescription}`, hospital: study.institution,
        accessTime: new Date().toISOString().slice(0, 16).replace("T", " "), accessor: t('regionalCollab.currentUser'), purpose: t('regionalCollab.purposeCrossAccess'),
      };
      setAccessRecords((prev) => [local, ...prev]);
    }
    message.info(t('w9e.regionalCollab.accessInfo', { institution: study.institution, uid: study.studyUid }));
  };

  // ── 发起远程会诊 ──
  const handleApply = async () => {
    try {
      const values = await applyForm.validateFields();
      setApplying(true);
      const res = await regionalApi.createConsultationRequest({
        patientName: values.patientName,
        hospital: values.hospital,
        diagnosis: values.diagnosis,
        priority: values.priority ?? "normal",
      });
      if (res.success && res.data) {
        setConsultations((prev) => [res.data, ...prev]);
        message.success(t('regionalCollab.consultSubmitted'));
        setApplyOpen(false);
        applyForm.resetFields();
      } else {
        throw new Error(t('regionalCollab.submitFailed'));
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(t('w9e.regionalCollab.applyFailed', { msg: e?.message ?? t('w9e.regionalCollab.unknownError') }));
    } finally {
      setApplying(false);
    }
  };

  // ── 参与会诊 ──
  const handleAccept = async (req: ConsultationRequestDto) => {
    try {
      const res = await regionalApi.acceptConsultationRequest(req.id);
      if (res.success && res.data) {
        setConsultations((prev) => prev.map((c) => (c.id === req.id ? { ...c, ...res.data } : c)));
        message.success(t('w9e.regionalCollab.accepted', { patient: req.patientName, hospital: req.hospital }));
      } else {
        message.warning(t('regionalCollab.acceptOffline'));
      }
    } catch {
      message.error(t('regionalCollab.acceptFailed'));
    }
  };

  // ── 共享统计 (access-records + document-registry 派生) ──
  const shareStats = useMemo(() => {
    const accessCount = new Map<string, number>();
    for (const r of accessRecords) accessCount.set(r.hospital, (accessCount.get(r.hospital) ?? 0) + 1);
    const registryCount = new Map<string, number>();
    for (const d of registry) registryCount.set(d.institution, (registryCount.get(d.institution) ?? 0) + 1);
    const names = new Set([...accessCount.keys(), ...registryCount.keys()]);
    return Array.from(names).map((name) => ({
      institution: name,
      共享检查: registryCount.get(name) ?? 0,
      调阅次数: accessCount.get(name) ?? 0,
    })).sort((a, b) => b.调阅次数 - a.调阅次数);
  }, [accessRecords, registry]);

  const totalShared = useMemo(() => shareStats.reduce((s, x) => s + x.共享检查, 0), [shareStats]);
  const totalAccess = useMemo(() => shareStats.reduce((s, x) => s + x.调阅次数, 0), [shareStats]);

  const instColumns = [
    { title: t('regionalCollab.instName'), dataIndex: "name", key: "name", render: (n: string, r: InstitutionDto) => (
      <Space>
        <Building2 size={15} color="var(--color-primary-800)" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>{n}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.aeTitle}</Text>
        </div>
      </Space>
    ) },
    { title: t('regionalCollab.address'), dataIndex: "address", key: "address", width: 220 },
    { title: t('regionalCollab.sharedStudies'), key: "shared", width: 90, render: (_: any, r: InstitutionDto) => {
      const n = registry.filter((d) => d.institution === r.name).length;
      return <Tag color={n > 0 ? "cyan" : "default"}>{n}</Tag>;
    } },
    { title: t('regionalCollab.accessCount'), key: "access", width: 90, render: (_: any, r: InstitutionDto) => {
      const n = accessRecords.filter((a) => a.hospital === r.name).length;
      return <Tag color={n > 0 ? "blue" : "default"}>{n}</Tag>;
    } },
    { title: t('regionalCollab.status'), dataIndex: "status", key: "status", width: 100, render: (s: string) => {
      const m = INST_STATUS_MAP[s] ?? { color: "default", label: s };
      return <Tag color={m.color}><Badge status={s === "online" ? "success" : s === "busy" ? "processing" : "error"} />{t(m.label)}</Tag>;
    } },
  ];

  const crossColumns = [
    { title: t('regionalCollab.studyUid'), dataIndex: "studyUid", key: "studyUid", width: 200, render: (v: string) => <Text style={{ fontSize: 11 }} copyable>{String(v).slice(0, 30)}…</Text> },
    { title: t('regionalCollab.patient'), dataIndex: "patientName", key: "patientName", width: 90 },
    { title: t('regionalCollab.description'), dataIndex: "studyDescription", key: "studyDescription" },
    { title: t('regionalCollab.modality'), dataIndex: "modality", key: "modality", width: 70, render: (m: string) => <Tag color="geekblue">{m}</Tag> },
    { title: t('regionalCollab.institution'), dataIndex: "institution", key: "institution", width: 140 },
    { title: t('regionalCollab.examDate'), dataIndex: "date", key: "date", width: 110 },
    { title: t('regionalCollab.available'), dataIndex: "status", key: "status", width: 90, render: (s: string) => (
      <Tag color={s === "COMPLETE" ? "green" : "orange"}>{s === "COMPLETE" ? t('regionalCollab.available') : s}</Tag>
    ) },
    { title: t('regionalCollab.actions'), key: "action", width: 90, render: (_: any, r: CrossInstitutionStudyDto) => (
      <Button size="small" type="primary" data-testid="regional-cross-access-btn" icon={<BookOpenCheck size={13} />} onClick={() => void handleAccess(r)}>{t('regionalCollab.access')}</Button>
    ) },
  ];

  const syncTimeline = useMemo(() => {
    const sorted = [...syncEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return sorted.slice(0, 10).map((e) => {
      const site = sites.find((s) => s.id === e.siteId);
      const type = SYNC_TYPE_MAP[e.type] ?? { color: "default", label: e.type };
      return {
        color: e.status === "success" ? "green" : e.status === "failed" ? "red" : "orange",
        children: (
          <div style={{ fontSize: 12 }}>
            <Space wrap>
              <Tag color={type.color}>{t(type.label)}</Tag>
              <span style={{ fontWeight: 600 }}>{site?.name ?? e.siteId}</span>
              <Tag color={e.status === "success" ? "green" : e.status === "failed" ? "red" : "orange"}>
                {e.status === "success" ? t('regionalCollab.success') : e.status === "failed" ? t('regionalCollab.failed') : t('regionalCollab.inProgress')}
              </Tag>
              <span style={{ color: "var(--text-secondary)" }}>{e.count} {t('regionalCollab.itemsUnit')} · {(e.bytes / 1024 / 1024).toFixed(1)} MB · {(e.duration / 1000).toFixed(1)}s</span>
              <span style={{ color: "var(--text-secondary)" }}>{String(e.timestamp).slice(11, 19)}</span>
            </Space>
            {e.message && <div style={{ color: "var(--color-error-600)", marginTop: 2 }}>{e.message}</div>}
          </div>
        ),
      };
    });
  }, [syncEvents, sites]);

  return (
    <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
      {/* 页头 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Network size={18} color="var(--color-info-600)" />
        <span style={{ fontSize: 16, fontWeight: 700 }}>{t('regionalCollab.title')}</span>
        <Tag color="cyan">G005 Wave 4B</Tag>
        <Tag color="geekblue">Regional Collaboration</Tag>
        <Tag color="blue">{t('regionalCollab.tagScope')}</Tag>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
          {t('regionalCollab.membersSummary')} {institutions.length} {t('regionalCollab.membersUnit')} · {t('regionalCollab.sitesLabel')} {sites.length} {t('regionalCollab.sitesUnit')} · {t('regionalCollab.sharedChecksLabel')} {totalShared}
        </span>
      </div>

      {/* 数据源徽标 */}
      <div
        data-testid="regional-collab-data-source-badge"
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12,
          padding: "6px 12px", borderRadius: 8,
          background: source === "api" ? "var(--color-success-bg)" : "var(--color-warning-bg)",
          color: source === "api" ? "#059669" : "var(--color-warning-600)",
          border: `1px solid ${source === "api" ? "#bbf7d0" : "#fde68a"}`,
        }}
      >
        <Database size={12} />
        {source === "api"
          ? t('regionalCollab.dataSourceApi')
          : t('regionalCollab.dataSourceDemo')}
      </div>

      {/* KPI */}
      <StatCardGrid minWidth={200} gap={12} style={{ marginBottom: 12 }}>
        <StatCard title={t('regionalCollab.statInstitutions')} value={institutions.length} suffix={t('regionalCollab.unitInstitutions')} icon={<Building2 size={15} color="var(--color-primary-800)" />} />
        <StatCard title={t('regionalCollab.statSharedStudies')} value={totalShared} suffix={t('regionalCollab.unitItems')} icon={<Share2 size={15} color="var(--color-info-600)" />} />
        <StatCard title={t('regionalCollab.statTotalAccess')} value={totalAccess} suffix={t('regionalCollab.unitTimes')} icon={<BookOpenCheck size={15} color="#7c3aed" />} />
        <StatCard title={t('regionalCollab.statOnlineInstitutions')} value={institutions.filter((i) => i.status === "online").length} suffix={`/ ${institutions.length}`} icon={<CheckCircle2 size={15} color="#10b981" />} />
      </StatCardGrid>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin description={t('regionalCollab.loading')} /></div>
      ) : (
        <>
          {/* 机构成员卡 */}
          <Card
            size="small"
            title={<Space><Building2 size={15} color="var(--color-primary-800)" />{t('regionalCollab.memberInstitutions')}</Space>}
            extra={<Button size="small" icon={<RefreshCw size={13} />} onClick={() => void loadAll()}>{t('regionalCollab.refresh')}</Button>}
            style={{ marginBottom: 12 }}
          >
            <DataTable
              rowKey="id"
              columns={instColumns}
              dataSource={institutions}
              pagination={false}
              data-testid="regional-institutions-table"
            />
          </Card>

          {/* 跨院调阅 */}
          <Card
            size="small"
            title={<Space><Search size={15} color="var(--color-primary-600)" />{t('regionalCollab.crossAccess')}</Space>}
            style={{ marginBottom: 12 }}
          >
            <Space wrap style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12 }}>{t('regionalCollab.institutionLabel')}</span>
              <Select
                data-testid="regional-cross-inst"
                style={{ width: 190 }}
                placeholder={t('regionalCollab.allInstitutions')}
                allowClear
                value={instId || undefined}
                onChange={(v) => setInstId(v ?? "")}
                options={institutions.map((i) => ({ value: i.id, label: i.name }))}
              />
              <span style={{ fontSize: 12 }}>{t('regionalCollab.typeLabel')}</span>
              <Select
                data-testid="regional-cross-type"
                style={{ width: 120 }}
                value={queryType}
                onChange={setQueryType}
                options={[
                  { value: "name", label: t('regionalCollab.queryByName') },
                  { value: "patientId", label: t('regionalCollab.queryByPatientId') },
                  { value: "description", label: t('regionalCollab.queryByDescription') },
                ]}
              />
              <Input
                data-testid="regional-cross-value"
                style={{ width: 200 }}
                placeholder={t('regionalCollab.inputQueryValue')}
                value={queryValue}
                onChange={(e) => setQueryValue(e.target.value)}
                onPressEnter={() => void handleCrossQuery()}
              />
              <Button type="primary" data-testid="regional-cross-search-btn" icon={<Search size={13} />} loading={crossLoading} onClick={() => void handleCrossQuery()}>{t('regionalCollab.search')}</Button>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {t('regionalCollab.crossSearchHint')}
              </span>
            </Space>
            {!searchRan ? (
              <Empty description={t('regionalCollab.emptyCross')} style={{ padding: 16 }} />
            ) : crossResults.length === 0 ? (
              <Empty description={t('regionalCollab.emptyCrossResult')} style={{ padding: 16 }} />
            ) : (
              <DataTable
                rowKey="id"
                columns={crossColumns}
                dataSource={crossResults}
                pagination={{ pageSize: 5, size: "small" }}
                data-testid="regional-cross-table"
              />
            )}
          </Card>

          <Row gutter={12}>
            {/* 远程会诊 */}
            <Col xs={24} lg={12}>
              <Card
                size="small"
                title={<Space><MessageSquare size={15} color="#7c3aed" />{t('regionalCollab.remoteConsult')}</Space>}
                extra={<Button size="small" type="primary" data-testid="regional-consult-create-btn" icon={<Video size={13} />} onClick={() => setApplyOpen(true)}>{t('regionalCollab.startConsult')}</Button>}
                style={{ marginBottom: 12 }}
              >
                {consultations.length === 0 ? (
                  <Empty description={t('regionalCollab.emptyConsult')} style={{ padding: 16 }} />
                ) : (
                  <List
                    size="small"
                    dataSource={consultations}
                    renderItem={(item) => {
                      const pri = PRIORITY_MAP[item.priority] ?? { color: "default", label: item.priority };
                      const st = REQ_STATUS_MAP[item.status] ?? { color: "default", label: item.status };
                      return (
                        <List.Item
                          data-testid="regional-consult-item"
                          actions={item.status === "open" || item.status === "in-progress" ? [
                            <Button key="join" size="small" type="primary" data-testid="regional-consult-accept-btn" icon={<PhoneIncoming size={13} />} onClick={() => void handleAccept(item)}>
                              {item.status === "in-progress" ? t('regionalCollab.joinConsult') : t('regionalCollab.acceptConsult')}
                            </Button>,
                          ] : []}
                        >
                          <List.Item.Meta
                            avatar={<MessageSquare size={16} color="#7c3aed" />}
                            title={
                              <Space wrap>
                                <span>{item.patientName}</span>
                                <Tag color={pri.color}>{t(pri.label)}</Tag>
                                <Tag color={st.color}>{t(st.label)}</Tag>
                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.hospital} · {item.createDate}</span>
                              </Space>
                            }
                            description={
                              <Space wrap size={6}>
                                <span style={{ fontSize: 12 }}>{t('regionalCollab.diagnosisLabel')} {item.diagnosis}</span>
                                {item.expert && <Tag color="purple">{t('regionalCollab.expertLabel')} {item.expert}</Tag>}
                              </Space>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                )}
              </Card>
            </Col>

            {/* 共享统计 */}
            <Col xs={24} lg={12}>
              <Card
                size="small"
                title={<Space><Activity size={15} color="#059669" />{t('regionalCollab.shareStats')}</Space>}
                extra={<span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t('regionalCollab.shareStatsHint')}</span>}
                style={{ marginBottom: 12 }}
              >
                {shareStats.length === 0 ? (
                  <Empty description={t('regionalCollab.emptyStats')} style={{ padding: 16 }} />
                ) : (
                  <>
                    <ChartContainer type="bar" height={210}>
                      <BarChart data={shareStats} margin={chartDefaults.margin}>
                        <CartesianGrid {...chartDefaults.grid} stroke="#e5e7eb" />
                        <XAxis dataKey="institution" {...chartDefaults.axis} />
                        <YAxis {...chartDefaults.axis} />
                        <ReTooltip {...chartDefaults.tooltip} />
                        <Bar dataKey="共享检查" fill="var(--color-info-600)" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="调阅次数" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                      {t('regionalCollab.totalSharedLabel')} {totalShared} {t('regionalCollab.unitItems')} · {t('regionalCollab.totalAccessLabel')} {totalAccess} {t('regionalCollab.unitTimes')}
                    </div>
                  </>
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={12}>
            {/* 同步状态 */}
            <Col xs={24} lg={14}>
              <Card
                size="small"
                title={<Space><Globe size={15} color="var(--color-info-600)" />{t('regionalCollab.syncStatus')}</Space>}
                style={{ marginBottom: 12 }}
              >
                <Row gutter={8} style={{ marginBottom: 8 }}>
                  {sites.slice(0, 4).map((s) => (
                    <Col span={6} key={s.id}>
                      <div style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <Tag color={SITE_STATUS_MAP[s.status]?.color} style={{ marginTop: 4 }}>{t(SITE_STATUS_MAP[s.status]?.label ?? s.status)}</Tag>
                        <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>{s.studies.toLocaleString()} {t('regionalCollab.studiesUnit')} · {s.latencyMs}ms · {t('regionalCollab.onlineRateLabel')} {s.uptimePct}%</div>
                        <div style={{ color: "var(--text-secondary)" }}>{t('regionalCollab.lastSyncLabel')} {String(s.lastSync).slice(11, 19)}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
                <DividerMini />
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>{t('regionalCollab.syncTimeline')}</div>
                {syncTimeline.length === 0 ? (
                  <Empty description={t('regionalCollab.emptySyncEvents')} style={{ padding: 12 }} />
                ) : (
                  <Timeline items={syncTimeline} style={{ maxHeight: 260, overflowY: "auto", paddingRight: 4 }} />
                )}
              </Card>
            </Col>

            {/* 路由规则 + 审计 */}
            <Col xs={24} lg={10}>
              <Card
                size="small"
                title={<Space><ShieldCheck size={15} color="var(--color-primary-700)" />{t('regionalCollab.routingAudit')}</Space>}
                style={{ marginBottom: 12 }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>{t('regionalCollab.interSiteRouting')}</div>
                {routingRules.length === 0 ? (
                  <Empty description={t('regionalCollab.emptyRouting')} style={{ padding: 12 }} />
                ) : (
                  <Space direction="vertical" style={{ width: "100%" }} size={4}>
                    {routingRules.slice(0, 5).map((r) => {
                      const src = sites.find((s) => s.id === r.sourceSite)?.name ?? r.sourceSite;
                      const dst = sites.find((s) => s.id === r.destSite)?.name ?? r.destSite;
                      return (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 6px", background: "var(--bg-card-secondary)", borderRadius: 6 }}>
                          <Share2 size={12} color="var(--color-primary-700)" />
                          <span>{src} → {dst}</span>
                          <Tag color="blue">{r.modality}</Tag>
                          <Tag color={r.active ? "green" : "default"}>{r.active ? t('regionalCollab.enabled') : t('regionalCollab.disabled')}</Tag>
                          <span style={{ color: "var(--text-secondary)", marginLeft: "auto" }}>{r.matchedCount} {t('regionalCollab.timesUnit')}</span>
                        </div>
                      );
                    })}
                  </Space>
                )}
                <DividerMini />
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>{t('regionalCollab.recentAudit')}</div>
                {auditTrail.length === 0 ? (
                  <Empty description={t('regionalCollab.emptyAudit')} style={{ padding: 12 }} />
                ) : (
                  <Space direction="vertical" style={{ width: "100%" }} size={4}>
                    {auditTrail.slice(0, 5).map((a) => (
                      <div key={a.id} style={{ fontSize: 11, padding: "4px 6px", background: "var(--bg-card-secondary)", borderRadius: 6 }}>
                        <Space wrap>
                          <Tag color="cyan">{a.action}</Tag>
                          <span>{a.user} @ {a.institution}</span>
                          <span style={{ color: "var(--text-secondary)", marginLeft: "auto" }}>{a.time}</span>
                        </Space>
                        <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{a.details}</div>
                      </div>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* 发起会诊 Modal */}
      <Modal
        title={<Space><Video size={15} color="#7c3aed" />{t('regionalCollab.applyConsultTitle')}</Space>}
        open={applyOpen}
        onOk={() => void handleApply()}
        confirmLoading={applying}
        onCancel={() => setApplyOpen(false)}
        okText={t('regionalCollab.submitConsult')}
        cancelText={t('regionalCollab.cancel')}
        width={480}
        data-testid="regional-consult-modal"
      >
        <Form form={applyForm} layout="vertical" size="small" style={{ marginTop: 8 }}>
          <Form.Item name="patientName" label={t('regionalCollab.patientName')} rules={[{ required: true, message: t('regionalCollab.requiredPatientName') }]}>
            <Input placeholder={t('regionalCollab.placeholderPatientName')} />
          </Form.Item>
          <Form.Item name="hospital" label={t('regionalCollab.applyInstitution')} rules={[{ required: true, message: t('regionalCollab.requiredInstitution') }]}>
            <Select placeholder={t('regionalCollab.selectInstitution')} options={institutions.map((i) => ({ value: i.name, label: i.name }))} />
          </Form.Item>
          <Form.Item name="diagnosis" label={t('regionalCollab.consultDiagnosis')} rules={[{ required: true, message: t('regionalCollab.requiredDiagnosis') }]}>
            <Input.TextArea rows={3} placeholder={t('regionalCollab.placeholderDiagnosis')} />
          </Form.Item>
          <Form.Item name="priority" label={t('regionalCollab.priority')} initialValue="normal">
            <Select options={[
              { value: "normal", label: t('regionalCollab.priorityNormal') },
              { value: "urgent", label: t('regionalCollab.priorityUrgent') },
              { value: "critical", label: t('regionalCollab.priorityCritical') },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const DividerMini = () => <div style={{ borderTop: "1px solid var(--border-color)", margin: "8px 0" }} />;

export default RegionalCollaborationPage;

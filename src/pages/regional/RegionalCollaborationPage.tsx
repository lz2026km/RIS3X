/**
 * [G005 Wave 4B] 区域医联体协同中心 (RegionalCollaborationPage) — /regional/collaboration
 * 对标: 区域影像中心 (Regional Imaging Center) / 医联体协同平台
 * 端点: regionalApi 11+ (institutions / cross-query / access-records / consultations /
 *       document-registry / audit-trail / sites / sync-events / routing-rules)
 *   - 后端 regional.controller 已实现, MSW regionalHandlers 兜底
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card, Col, Row, Tag, Space, Button, Select, Input, Table, Spin,
  Modal, Form, message, Timeline, Badge, Empty, Statistic, List, Typography,
} from "antd";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
} from "recharts";
import {
  Building2, Network, Share2, MessageSquare, Activity, Globe, Database,
  Search, BookOpenCheck, ShieldCheck, RefreshCw, Video, PhoneIncoming, CheckCircle2,
} from "lucide-react";
import { regionalApi, type InstitutionDto, type CrossInstitutionStudyDto, type AccessRecordDto, type ConsultationRequestDto, type RegionalSiteDto, type RegionalSiteSyncEventDto, type RegionalSiteRoutingRuleDto } from "@/services/api/regionalApi";

const { Text } = Typography;

const INST_STATUS_MAP: Record<string, { color: string; label: string }> = {
  online: { color: "green", label: "在线" },
  offline: { color: "red", label: "离线" },
  busy: { color: "orange", label: "繁忙" },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  normal: { color: "blue", label: "普通" },
  urgent: { color: "orange", label: "紧急" },
  critical: { color: "red", label: "危急" },
};

const REQ_STATUS_MAP: Record<string, { color: string; label: string }> = {
  open: { color: "orange", label: "待接诊" },
  "in-progress": { color: "blue", label: "会诊中" },
  completed: { color: "green", label: "已完成" },
};

const SITE_STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: "green", label: "在线" },
  offline: { color: "red", label: "离线" },
  syncing: { color: "blue", label: "同步中" },
  maintenance: { color: "orange", label: "维护" },
};

const SYNC_TYPE_MAP: Record<string, { color: string; label: string }> = {
  study_pushed: { color: "blue", label: "检查推送" },
  study_pulled: { color: "cyan", label: "检查拉取" },
  user_sync: { color: "purple", label: "用户同步" },
  config_sync: { color: "geekblue", label: "配置同步" },
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
        message.success(`检索到 ${res.data.length} 条跨院检查`);
      } else {
        setCrossResults([]);
      }
    } catch {
      message.error("跨院检索失败");
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
        purpose: "跨院调阅阅片",
        accessor: "当前用户",
      });
      if (res.success && res.data) {
        setAccessRecords((prev) => [res.data, ...prev]);
        message.success(`已记录调阅 ${study.patientName} 的检查 (${study.institution})`);
      } else {
        throw new Error("记录失败");
      }
    } catch {
      message.warning("调阅记录接口不可达, 已在本会话记录");
      const local: AccessRecordDto = {
        id: `ARC-${Date.now()}`, patientName: study.patientName, patientId: study.patientId,
        studyType: `${study.modality} ${study.studyDescription}`, hospital: study.institution,
        accessTime: new Date().toISOString().slice(0, 16).replace("T", " "), accessor: "当前用户", purpose: "跨院调阅阅片",
      };
      setAccessRecords((prev) => [local, ...prev]);
    }
    message.info(`跨院影像已记录调阅。原始 DICOM 位于 ${study.institution}, 可进入阅片器按 Study UID ${study.studyUid} 检索渲染。`);
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
        message.success("会诊请求已提交, 等待专家接诊");
        setApplyOpen(false);
        applyForm.resetFields();
      } else {
        throw new Error("提交失败");
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(`发起会诊失败: ${e?.message ?? "未知错误"}`);
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
        message.success(`已参与会诊 ${req.patientName} (${req.hospital})`);
      } else {
        message.warning("参与接口不可达, 请稍后重试");
      }
    } catch {
      message.error("参与会诊失败");
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
    { title: "机构名称", dataIndex: "name", key: "name", render: (n: string, r: InstitutionDto) => (
      <Space>
        <Building2 size={15} color="#1e40af" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.aeTitle}</Text>
        </div>
      </Space>
    ) },
    { title: "地址", dataIndex: "address", key: "address", width: 220 },
    { title: "共享检查", key: "shared", width: 90, render: (_: any, r: InstitutionDto) => {
      const n = registry.filter((d) => d.institution === r.name).length;
      return <Tag color={n > 0 ? "cyan" : "default"}>{n}</Tag>;
    } },
    { title: "调阅次数", key: "access", width: 90, render: (_: any, r: InstitutionDto) => {
      const n = accessRecords.filter((a) => a.hospital === r.name).length;
      return <Tag color={n > 0 ? "blue" : "default"}>{n}</Tag>;
    } },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (s: string) => {
      const m = INST_STATUS_MAP[s] ?? { color: "default", label: s };
      return <Tag color={m.color}><Badge status={s === "online" ? "success" : s === "busy" ? "processing" : "error"} />{m.label}</Tag>;
    } },
  ];

  const crossColumns = [
    { title: "检查号", dataIndex: "studyUid", key: "studyUid", width: 200, render: (v: string) => <Text style={{ fontSize: 11 }} copyable>{String(v).slice(0, 30)}…</Text> },
    { title: "患者", dataIndex: "patientName", key: "patientName", width: 90 },
    { title: "描述", dataIndex: "studyDescription", key: "studyDescription" },
    { title: "模态", dataIndex: "modality", key: "modality", width: 70, render: (m: string) => <Tag color="geekblue">{m}</Tag> },
    { title: "所属机构", dataIndex: "institution", key: "institution", width: 140 },
    { title: "检查日期", dataIndex: "date", key: "date", width: 110 },
    { title: "可调阅", dataIndex: "status", key: "status", width: 90, render: (s: string) => (
      <Tag color={s === "COMPLETE" ? "green" : "orange"}>{s === "COMPLETE" ? "可调阅" : s}</Tag>
    ) },
    { title: "操作", key: "action", width: 90, render: (_: any, r: CrossInstitutionStudyDto) => (
      <Button size="small" type="primary" data-testid="regional-cross-access-btn" icon={<BookOpenCheck size={13} />} onClick={() => void handleAccess(r)}>调阅</Button>
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
              <Tag color={type.color}>{type.label}</Tag>
              <span style={{ fontWeight: 600 }}>{site?.name ?? e.siteId}</span>
              <Tag color={e.status === "success" ? "green" : e.status === "failed" ? "red" : "orange"}>
                {e.status === "success" ? "成功" : e.status === "failed" ? "失败" : "进行中"}
              </Tag>
              <span style={{ color: "var(--text-secondary)" }}>{e.count} 项 · {(e.bytes / 1024 / 1024).toFixed(1)} MB · {(e.duration / 1000).toFixed(1)}s</span>
              <span style={{ color: "var(--text-secondary)" }}>{String(e.timestamp).slice(11, 19)}</span>
            </Space>
            {e.message && <div style={{ color: "#dc2626", marginTop: 2 }}>{e.message}</div>}
          </div>
        ),
      };
    });
  }, [syncEvents, sites]);

  return (
    <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
      {/* 页头 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Network size={18} color="#0891b2" />
        <span style={{ fontSize: 16, fontWeight: 700 }}>区域协同中心</span>
        <Tag color="cyan">G005 Wave 4B</Tag>
        <Tag color="geekblue">Regional Collaboration</Tag>
        <Tag color="blue">区域医联体 · 跨院调阅 · 远程会诊</Tag>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
          医联体成员 {institutions.length} 家 · 站点 {sites.length} 个 · 共享检查 {totalShared}
        </span>
      </div>

      {/* 数据源徽标 */}
      <div
        data-testid="regional-collab-data-source-badge"
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12,
          padding: "6px 12px", borderRadius: 8,
          background: source === "api" ? "var(--color-success-bg)" : "var(--color-warning-bg)",
          color: source === "api" ? "#059669" : "#d97706",
          border: `1px solid ${source === "api" ? "#bbf7d0" : "#fde68a"}`,
        }}
      >
        <Database size={12} />
        {source === "api"
          ? "数据源: 后端 /regional/* (seed + 站点派生) · MSW 兜底"
          : "数据源: 本地 demo 回退 (后端不可达)"}
      </div>

      {/* KPI */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Card size="small"><Statistic title="医联体机构" value={institutions.length} suffix="家" prefix={<Building2 size={15} color="#1e40af" />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="共享检查数" value={totalShared} suffix="项" prefix={<Share2 size={15} color="#0891b2" />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="累计调阅" value={totalAccess} suffix="次" prefix={<BookOpenCheck size={15} color="#7c3aed" />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="在线机构" value={institutions.filter((i) => i.status === "online").length} suffix={`/ ${institutions.length}`} prefix={<CheckCircle2 size={15} color="#10b981" />} /></Card></Col>
      </Row>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin description="加载中…" /></div>
      ) : (
        <>
          {/* 机构成员卡 */}
          <Card
            size="small"
            title={<Space><Building2 size={15} color="#1e40af" />机构成员</Space>}
            extra={<Button size="small" icon={<RefreshCw size={13} />} onClick={() => void loadAll()}>刷新</Button>}
            style={{ marginBottom: 12 }}
          >
            <Table
              size="small"
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
            title={<Space><Search size={15} color="#2563eb" />跨院调阅</Space>}
            style={{ marginBottom: 12 }}
          >
            <Space wrap style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12 }}>机构:</span>
              <Select
                data-testid="regional-cross-inst"
                style={{ width: 190 }}
                placeholder="全部机构"
                allowClear
                value={instId || undefined}
                onChange={(v) => setInstId(v ?? "")}
                options={institutions.map((i) => ({ value: i.id, label: i.name }))}
              />
              <span style={{ fontSize: 12 }}>类型:</span>
              <Select
                data-testid="regional-cross-type"
                style={{ width: 120 }}
                value={queryType}
                onChange={setQueryType}
                options={[
                  { value: "name", label: "患者姓名" },
                  { value: "patientId", label: "患者 ID" },
                  { value: "description", label: "检查描述" },
                ]}
              />
              <Input
                data-testid="regional-cross-value"
                style={{ width: 200 }}
                placeholder="输入检索值"
                value={queryValue}
                onChange={(e) => setQueryValue(e.target.value)}
                onPressEnter={() => void handleCrossQuery()}
              />
              <Button type="primary" data-testid="regional-cross-search-btn" icon={<Search size={13} />} loading={crossLoading} onClick={() => void handleCrossQuery()}>检索</Button>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                通过 DICOM Query/Retrieve 跨机构检索检查, 命中后记录调阅并进入阅片
              </span>
            </Space>
            {!searchRan ? (
              <Empty description="选择机构/检索条件后点击「检索」" style={{ padding: 16 }} />
            ) : crossResults.length === 0 ? (
              <Empty description="未检索到匹配的跨院检查" style={{ padding: 16 }} />
            ) : (
              <Table
                size="small"
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
                title={<Space><MessageSquare size={15} color="#7c3aed" />远程会诊</Space>}
                extra={<Button size="small" type="primary" data-testid="regional-consult-create-btn" icon={<Video size={13} />} onClick={() => setApplyOpen(true)}>发起会诊</Button>}
                style={{ marginBottom: 12 }}
              >
                {consultations.length === 0 ? (
                  <Empty description="暂无会诊请求" style={{ padding: 16 }} />
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
                              {item.status === "in-progress" ? "加入会诊" : "接诊"}
                            </Button>,
                          ] : []}
                        >
                          <List.Item.Meta
                            avatar={<MessageSquare size={16} color="#7c3aed" />}
                            title={
                              <Space wrap>
                                <span>{item.patientName}</span>
                                <Tag color={pri.color}>{pri.label}</Tag>
                                <Tag color={st.color}>{st.label}</Tag>
                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.hospital} · {item.createDate}</span>
                              </Space>
                            }
                            description={
                              <Space wrap size={6}>
                                <span style={{ fontSize: 12 }}>诊断: {item.diagnosis}</span>
                                {item.expert && <Tag color="purple">专家: {item.expert}</Tag>}
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
                title={<Space><Activity size={15} color="#059669" />共享统计</Space>}
                extra={<span style={{ fontSize: 11, color: "var(--text-secondary)" }}>由调阅记录与文档注册派生</span>}
                style={{ marginBottom: 12 }}
              >
                {shareStats.length === 0 ? (
                  <Empty description="暂无统计数据" style={{ padding: 16 }} />
                ) : (
                  <>
                    <div style={{ height: 210 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={shareStats} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="institution" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <ReTooltip />
                          <Bar dataKey="共享检查" fill="#0891b2" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="调阅次数" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                      总共享 {totalShared} 项 · 总调阅 {totalAccess} 次
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
                title={<Space><Globe size={15} color="#0891b2" />同步状态</Space>}
                style={{ marginBottom: 12 }}
              >
                <Row gutter={8} style={{ marginBottom: 8 }}>
                  {sites.slice(0, 4).map((s) => (
                    <Col span={6} key={s.id}>
                      <div style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <Tag color={SITE_STATUS_MAP[s.status]?.color} style={{ marginTop: 4 }}>{SITE_STATUS_MAP[s.status]?.label ?? s.status}</Tag>
                        <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>{s.studies.toLocaleString()} 检查 · {s.latencyMs}ms · 在线率 {s.uptimePct}%</div>
                        <div style={{ color: "var(--text-secondary)" }}>最近同步 {String(s.lastSync).slice(11, 19)}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
                <DividerMini />
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>同步事件时间线</div>
                {syncTimeline.length === 0 ? (
                  <Empty description="暂无同步事件" style={{ padding: 12 }} />
                ) : (
                  <Timeline items={syncTimeline} style={{ maxHeight: 260, overflowY: "auto", paddingRight: 4 }} />
                )}
              </Card>
            </Col>

            {/* 路由规则 + 审计 */}
            <Col xs={24} lg={10}>
              <Card
                size="small"
                title={<Space><ShieldCheck size={15} color="#1d4ed8" />路由规则与审计</Space>}
                style={{ marginBottom: 12 }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>站点间影像路由规则</div>
                {routingRules.length === 0 ? (
                  <Empty description="暂无路由规则" style={{ padding: 12 }} />
                ) : (
                  <Space direction="vertical" style={{ width: "100%" }} size={4}>
                    {routingRules.slice(0, 5).map((r) => {
                      const src = sites.find((s) => s.id === r.sourceSite)?.name ?? r.sourceSite;
                      const dst = sites.find((s) => s.id === r.destSite)?.name ?? r.destSite;
                      return (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 6px", background: "var(--bg-card-secondary)", borderRadius: 6 }}>
                          <Share2 size={12} color="#1d4ed8" />
                          <span>{src} → {dst}</span>
                          <Tag color="blue">{r.modality}</Tag>
                          <Tag color={r.active ? "green" : "default"}>{r.active ? "启用" : "停用"}</Tag>
                          <span style={{ color: "var(--text-secondary)", marginLeft: "auto" }}>{r.matchedCount} 次</span>
                        </div>
                      );
                    })}
                  </Space>
                )}
                <DividerMini />
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>最近审计</div>
                {auditTrail.length === 0 ? (
                  <Empty description="暂无审计记录" style={{ padding: 12 }} />
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
        title={<Space><Video size={15} color="#7c3aed" />发起远程会诊</Space>}
        open={applyOpen}
        onOk={() => void handleApply()}
        confirmLoading={applying}
        onCancel={() => setApplyOpen(false)}
        okText="提交会诊请求"
        cancelText="取消"
        width={480}
        data-testid="regional-consult-modal"
      >
        <Form form={applyForm} layout="vertical" size="small" style={{ marginTop: 8 }}>
          <Form.Item name="patientName" label="患者姓名" rules={[{ required: true, message: "请输入患者姓名" }]}>
            <Input placeholder="如: 张伟" />
          </Form.Item>
          <Form.Item name="hospital" label="申请机构" rules={[{ required: true, message: "请选择申请机构" }]}>
            <Select placeholder="选择机构" options={institutions.map((i) => ({ value: i.name, label: i.name }))} />
          </Form.Item>
          <Form.Item name="diagnosis" label="会诊诊断/问题" rules={[{ required: true, message: "请输入会诊问题" }]}>
            <Input.TextArea rows={3} placeholder="如: 颅内占位性质待定, 申请院级专家会诊" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="normal">
            <Select options={[
              { value: "normal", label: "普通" },
              { value: "urgent", label: "紧急" },
              { value: "critical", label: "危急" },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const DividerMini = () => <div style={{ borderTop: "1px solid var(--border-color)", margin: "8px 0" }} />;

export default RegionalCollaborationPage;

/**
 * Multi-Site / Multi-Campus Dashboard - 多站点 / 多院区管理
 * 阶段 1.5 修复: 之前是 3 KPI + 占位文字
 * [W3-A] 数据源改为 regionalApi (/regional/sites*, MSW 演示数据, 后端待实现), 失败时回退 site.ts 静态数据
 */
import { useMemo, useEffect, useState, useCallback } from "react";
import { Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Badge, Space, Typography, Alert, Button } from "antd";
import { Building2, MapPin, Activity, Database, Globe, Network, CheckCircle, AlertTriangle, XCircle, RefreshCw, Shield } from "lucide-react";
import { regionalApi, type RegionalSiteDto, type RegionalSiteSyncEventDto, type RegionalSiteRoutingRuleDto } from "../services/api/regionalApi";
import { SITES, SYNC_EVENTS, ROUTING_RULES, type Site, type SyncEvent, type RoutingRule } from "../services/site";
import { usePagination } from "../hooks/usePagination";

const {  Text } = Typography;

const STATUS_MAP: Record<string, { color: string; label: string; icon: any }> = {
  active: { color: "green", label: "在线", icon: <CheckCircle size={14} /> },
  syncing: { color: "blue", label: "同步中", icon: <RefreshCw size={14} /> },
  offline: { color: "red", label: "离线", icon: <XCircle size={14} /> },
  maintenance: { color: "orange", label: "维护中", icon: <AlertTriangle size={14} /> },
};

const TYPE_MAP: Record<string, { color: string; label: string }> = {
  study_pushed: { color: "blue", label: "检查推送" },
  study_pulled: { color: "cyan", label: "检查拉取" },
  user_sync: { color: "purple", label: "用户同步" },
  config_sync: { color: "geekblue", label: "配置同步" },
};

const STATUS_SEV: Record<string, { color: string }> = {
  success: { color: "green" },
  failed: { color: "red" },
  pending: { color: "orange" },
};

const toSite = (d: RegionalSiteDto): Site => ({
  id: d.id, name: d.name, code: d.code, region: d.region, city: d.city, status: d.status,
  studies: d.studies, patients: d.patients, users: d.users, storage: d.storage,
  bandwidth: d.bandwidth, lastSync: d.lastSync, latencyMs: d.latencyMs,
  uptimePct: d.uptimePct, version: d.version, primary: d.primary,
});

const toEvent = (e: RegionalSiteSyncEventDto): SyncEvent => ({
  id: e.id, siteId: e.siteId, type: e.type, status: e.status, count: e.count,
  bytes: e.bytes, duration: e.duration, timestamp: e.timestamp, message: e.message,
});

const toRule = (r: RegionalSiteRoutingRuleDto): RoutingRule => ({
  id: r.id, name: r.name, sourceSite: r.sourceSite, destSite: r.destSite,
  modality: r.modality, condition: r.condition, active: r.active, matchedCount: r.matchedCount,
});

export default function MultiSiteDashboardPage() {
  const [sites, setSites] = useState<Site[]>(SITES);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>(SYNC_EVENTS);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(ROUTING_RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sitesRes, eventsRes, rulesRes] = await Promise.all([
        regionalApi.listSites(), regionalApi.listSiteSyncEvents(), regionalApi.listSiteRoutingRules(),
      ])
      if (!sitesRes.success) throw new Error((sitesRes.error as { message?: string })?.message || '站点数据加载失败')
      if (!eventsRes.success) throw new Error((eventsRes.error as { message?: string })?.message || '同步事件加载失败')
      if (!rulesRes.success) throw new Error((rulesRes.error as { message?: string })?.message || '路由规则加载失败')
      const siteList = (sitesRes.data?.data ?? []).map(toSite)
      if (siteList.length > 0) {
        setSites(siteList)
        setSyncEvents((eventsRes.data?.data ?? []).map(toEvent))
        setRoutingRules((rulesRes.data?.data ?? []).map(toRule))
        setUsingFallback(false)
      } else {
        throw new Error('接口返回空站点列表')
      }
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
      setSites(SITES)
      setSyncEvents(SYNC_EVENTS)
      setRoutingRules(ROUTING_RULES)
      setUsingFallback(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // [W3-C] 受控分页: 同步事件表
  const eventsPagination = usePagination(syncEvents, 10);

  const totalStudies = useMemo(() => sites.reduce((s, x) => s + x.studies, 0), [sites]);
  const totalPatients = useMemo(() => sites.reduce((s, x) => s + x.patients, 0), [sites]);
  const totalUsers = useMemo(() => sites.reduce((s, x) => s + x.users, 0), [sites]);
  const totalStorage = useMemo(() => sites.reduce((s, x) => s + x.storage, 0), [sites]);
  const activeCount = useMemo(() => sites.filter(x => x.status === "active").length, [sites]);
  const offlineCount = useMemo(() => sites.filter(x => x.status === "offline").length, [sites]);
  const syncRate = useMemo(() => {
    const last = sites.map(s => s.lastSync).sort().reverse()[0];
    const lastMin = last ? (Date.now() - new Date(last).getTime()) / 60000 : 0;
    return Math.max(0, 100 - lastMin);
  }, [sites]);

  const siteColumns = [
    { title: "站点", dataIndex: "name", key: "name", width: 240, render: (n: string, r: any) => (
      <Space>
        <Building2 size={16} color={r.primary ? "#1e40af" : "#64748b"} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.code}</Text>
        </div>
      </Space>
    ) },
    { title: "区域", dataIndex: "city", key: "city", width: 80, render: (c: string, r: any) => <><MapPin size={11} style={{ marginRight: 4 }} />{c} {r.region}</> },
    { title: "状态", dataIndex: "status", key: "status", width: 110, render: (s: string) => {
      const m = STATUS_MAP[s] || { color: "default", label: s, icon: <AlertTriangle size={14} /> }; return <Tag color={m.color} icon={m.icon}>{m.label}</Tag>;
    } },
    { title: "检查数", dataIndex: "studies", key: "studies", width: 90, render: (n: number) => n.toLocaleString(), sorter: (a: any, b: any) => a.studies - b.studies },
    { title: "患者数", dataIndex: "patients", key: "patients", width: 90, render: (n: number) => n.toLocaleString() },
    { title: "用户数", dataIndex: "users", key: "users", width: 80 },
    { title: "存储(GB)", dataIndex: "storage", key: "storage", width: 100, render: (n: number) => n.toLocaleString() },
    { title: "上行带宽", dataIndex: "bandwidth", key: "bandwidth", width: 100, render: (n: number) => n > 0 ? `${n} Mbps` : <Tag color="red">离线</Tag> },
    { title: "延迟", dataIndex: "latencyMs", key: "latencyMs", width: 80, render: (n: number) => n > 0 ? `${n} ms` : "-" },
    { title: "可用性", dataIndex: "uptimePct", key: "uptimePct", width: 130, render: (n: number) => (
      <Progress percent={n} size="small" status={n < 99 ? "exception" : "success"} format={(p) => `${(p ?? 0).toFixed(2)}%`} />
    ) },
    { title: "版本", dataIndex: "version", key: "version", width: 120, render: (v: string, r: any) => (
      <Tag color={r.primary ? "blue" : "default"}>{r.primary && <Database size={11} />} {v}</Tag>
    ) },
  ];

  return (
    <div style={{ padding: 24, background: "#f1f5f9", minHeight: "calc(100vh - 56px)" }}>
      <Card style={{ background: "linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)", color: "#fff", border: "none", marginBottom: 16 }}>
        <Space size={16}>
          <Globe size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>多站点 / 多院区管理平台</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {sites.length} 个院区 | 实时同步 | 跨院区路由 | DICOM 互联互通
            </div>
          </div>
        </Space>
      </Card>

      {error && <Alert type="warning" showIcon message="加载失败，已回退到本地静态数据" description={error} action={<Button size="small" onClick={fetchAll}>重试</Button>} style={{ marginBottom: 16 }} />}
      {!error && usingFallback && <Alert type="info" showIcon message="数据来源：演示数据（接口未返回站点，回退本地 site.ts）" style={{ marginBottom: 16 }} />}
      {!error && !usingFallback && !loading && <Alert type="success" showIcon message="数据来源：/regional/sites（MSW 演示数据，后端待实现）" style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="总站点" value={sites.length} prefix={<Building2 size={16} />} styles={{ content: {  color: "#1e40af"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="在线" value={activeCount} prefix={<CheckCircle size={16} color="#10b981" />} styles={{ content: {  color: "#10b981"  } }} suffix={`/ ${sites.length}`} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="总检查数" value={totalStudies} styles={{ content: {  color: "#0891b2"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="总患者数" value={totalPatients} styles={{ content: {  color: "#7c3aed"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="总用户数" value={totalUsers} styles={{ content: {  color: "#d97706"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title="总存储 (GB)" value={totalStorage.toLocaleString()} prefix={<Database size={16} />} styles={{ content: {  color: "#dc2626"  } }} loading={loading} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title={<Space><Network size={16} />站点列表 ({sites.length})<Tag color="green">{activeCount} 在线</Tag><Tag color="red">{offlineCount} 离线</Tag></Space>} extra={<Badge count={offlineCount} title="告警站点" />}>
            <Table dataSource={sites} columns={siteColumns} rowKey="id" size="small" pagination={false} loading={loading} scroll={{ x: 'max-content' }}/>
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<><Activity size={16} /> 同步状态</>} style={{ marginBottom: 16 }}>
            <Statistic title="最近同步延迟" value={syncRate.toFixed(1)} suffix="%" styles={{ content: {  color: syncRate > 90 ? "#10b981" : "#f59e0b"  } }} loading={loading} />
            <div style={{ marginTop: 12 }}>
              <Text>{sites.length} 个站点平均延迟 <strong>{(sites.reduce((s, x) => s + x.latencyMs, 0) / Math.max(1, sites.length)).toFixed(1)} ms</strong></Text>
              <Progress percent={Math.min(100, (sites.filter(s => s.status === "active").length / Math.max(1, sites.length)) * 100)} status="active" />
            </div>
          </Card>
          <Card title={<><Shield size={16} /> 高可用性</>}>
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <div>主库 <Tag color="green">正常</Tag></div>
              <div>异地容灾 <Tag color="green">已同步</Tag></div>
              <div>RPO 目标 <Tag color="blue">≤ 60s</Tag></div>
              <div>RTO 目标 <Tag color="blue">≤ 10min</Tag></div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: "events",
              label: <><Activity size={14} /> 同步事件 ({syncEvents.length})</>,
              children: (
                <Table
                  dataSource={eventsPagination.pageData}
                  rowKey="id"
                  size="small"
                  pagination={eventsPagination.pagination}
                  columns={[
                    { title: "时间", dataIndex: "timestamp", key: "ts", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
                    { title: "站点", dataIndex: "siteId", key: "siteId", width: 120, render: (id: string) => sites.find(s => s.id === id)?.name || id },
                    { title: "类型", dataIndex: "type", key: "type", width: 110, render: (t: string) => { const m = TYPE_MAP[t] || { color: "default", label: t }; return <Tag color={m.color}>{m.label}</Tag>; } },
                    { title: "数量", dataIndex: "count", key: "count", width: 70 },
                    { title: "字节", dataIndex: "bytes", key: "bytes", width: 90, render: (b: number) => `${(b / 1024).toFixed(1)} KB` },
                    { title: "耗时", dataIndex: "duration", key: "dur", width: 80, render: (d: number) => `${d} ms` },
                    { title: "状态", dataIndex: "status", key: "status", width: 90, render: (s: string) => { const m = STATUS_SEV[s] || { color: "default" }; return <Tag color={m.color}>{s === "success" ? "成功" : s === "failed" ? "失败" : "等待"}</Tag>; } },
                    { title: "消息", dataIndex: "message", key: "msg", render: (m?: string) => m || "-" },
                  ]}
                scroll={{ x: 'max-content' }}
                />
              ),
            },
            {
              key: "rules",
              label: <><Shield size={14} /> 路由规则 ({routingRules.length})</>,
              children: (
                <Table
                  dataSource={routingRules}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: "编号", dataIndex: "id", key: "id", width: 80 },
                    { title: "名称", dataIndex: "name", key: "name" },
                    { title: "源 AE", dataIndex: "sourceSite", key: "src", width: 110 },
                    { title: "目标 AE", dataIndex: "destSite", key: "dst", width: 110 },
                    { title: "模态", dataIndex: "modality", key: "mod", width: 80 },
                    { title: "匹配", dataIndex: "matchedCount", key: "mc", width: 100, render: (n: number) => n.toLocaleString() },
                    { title: "状态", dataIndex: "active", key: "act", width: 80, render: (a: boolean) => <Tag color={a ? "green" : "default"}>{a ? "启用" : "禁用"}</Tag> },
                  ]}
                scroll={{ x: 'max-content' }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

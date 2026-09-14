/**
 * Multi-Site / Multi-Campus Dashboard - 多站点 / 多院区管理
 * 阶段 1.5 修复: 之前是 3 KPI + 占位文字
 * [W3-A] 数据源改为 regionalApi (/regional/sites*, 后端 regional.service.listSites 已实现), 失败时回退 site.ts 静态数据
 */
import { usePagination } from "../hooks/usePagination";
import { regionalApi, type RegionalSiteDto, type RegionalSiteSyncEventDto, type RegionalSiteRoutingRuleDto } from "../services/api/regionalApi";
import { SITES, SYNC_EVENTS, ROUTING_RULES, type Site, type SyncEvent, type RoutingRule } from "../services/site";
import { Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Badge, Space, Typography, Alert, Button } from "antd";
import { Building2, MapPin, Activity, Database, Globe, Network, CheckCircle, AlertTriangle, XCircle, RefreshCw, Shield } from "lucide-react";
import { useMemo, useEffect, useState, useCallback } from "react";
import { t } from "../i18n/appI18n";

const {  Text } = Typography;

const STATUS_MAP: Record<string, { color: string; labelKey: string; icon: any }> = {
  active: { color: "green", labelKey: "multiSiteDashboard.statusActive", icon: <CheckCircle size={14} /> },
  syncing: { color: "blue", labelKey: "multiSiteDashboard.statusSyncing", icon: <RefreshCw size={14} /> },
  offline: { color: "red", labelKey: "multiSiteDashboard.statusOffline", icon: <XCircle size={14} /> },
  maintenance: { color: "orange", labelKey: "multiSiteDashboard.statusMaintenance", icon: <AlertTriangle size={14} /> },
};

const TYPE_MAP: Record<string, { color: string; labelKey: string }> = {
  study_pushed: { color: "blue", labelKey: "multiSiteDashboard.typeStudyPushed" },
  study_pulled: { color: "cyan", labelKey: "multiSiteDashboard.typeStudyPulled" },
  user_sync: { color: "purple", labelKey: "multiSiteDashboard.typeUserSync" },
  config_sync: { color: "geekblue", labelKey: "multiSiteDashboard.typeConfigSync" },
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
      if (!sitesRes.success) throw new Error((sitesRes.error as { message?: string })?.message || t('multiSiteDashboard.siteDataLoadFailed'))
      if (!eventsRes.success) throw new Error((eventsRes.error as { message?: string })?.message || t('multiSiteDashboard.syncEventLoadFailed'))
      if (!rulesRes.success) throw new Error((rulesRes.error as { message?: string })?.message || t('multiSiteDashboard.routingRuleLoadFailed'))
      const siteList = (sitesRes.data?.data ?? []).map(toSite)
      if (siteList.length > 0) {
        setSites(siteList)
        setSyncEvents((eventsRes.data?.data ?? []).map(toEvent))
        setRoutingRules((rulesRes.data?.data ?? []).map(toRule))
        setUsingFallback(false)
      } else {
        throw new Error(t('multiSiteDashboard.emptySiteList'))
      }
    } catch (e) {
      setError((e as Error)?.message || t('multiSiteDashboard.loadFailed'))
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
    { title: t('multiSiteDashboard.colSite'), dataIndex: "name", key: "name", width: 240, render: (n: string, r: any) => (
      <Space>
        <Building2 size={16} color={r.primary ? "#1e40af" : "#64748b"} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.code}</Text>
        </div>
      </Space>
    ) },
    { title: t('multiSiteDashboard.colRegion'), dataIndex: "city", key: "city", width: 80, render: (c: string, r: any) => <><MapPin size={11} style={{ marginRight: 4 }} />{c} {r.region}</> },
    { title: t('multiSiteDashboard.colStatus'), dataIndex: "status", key: "status", width: 110, render: (s: string) => {
      const m = STATUS_MAP[s] || { color: "default", labelKey: "", icon: <AlertTriangle size={14} /> }; return <Tag color={m.color} icon={m.icon}>{m.labelKey ? t(m.labelKey) : s}</Tag>;
    } },
    { title: t('multiSiteDashboard.colStudies'), dataIndex: "studies", key: "studies", width: 90, render: (n: number) => n.toLocaleString(), sorter: (a: any, b: any) => a.studies - b.studies },
    { title: t('multiSiteDashboard.colPatients'), dataIndex: "patients", key: "patients", width: 90, render: (n: number) => n.toLocaleString() },
    { title: t('multiSiteDashboard.colUsers'), dataIndex: "users", key: "users", width: 80 },
    { title: t('multiSiteDashboard.colStorage'), dataIndex: "storage", key: "storage", width: 100, render: (n: number) => n.toLocaleString() },
    { title: t('multiSiteDashboard.colBandwidth'), dataIndex: "bandwidth", key: "bandwidth", width: 100, render: (n: number) => n > 0 ? `${n} Mbps` : <Tag color="red">{t('multiSiteDashboard.statusOffline')}</Tag> },
    { title: t('multiSiteDashboard.colLatency'), dataIndex: "latencyMs", key: "latencyMs", width: 80, render: (n: number) => n > 0 ? `${n} ms` : "-" },
    { title: t('multiSiteDashboard.colUptime'), dataIndex: "uptimePct", key: "uptimePct", width: 130, render: (n: number) => (
      <Progress percent={n} size="small" status={n < 99 ? "exception" : "success"} format={(p) => `${(p ?? 0).toFixed(2)}%`} />
    ) },
    { title: t('multiSiteDashboard.colVersion'), dataIndex: "version", key: "version", width: 120, render: (v: string, r: any) => (
      <Tag color={r.primary ? "blue" : "default"}>{r.primary && <Database size={11} />} {v}</Tag>
    ) },
  ];

  return (
    <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
      <Card style={{ background: "linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)", color: "#fff", border: "none", marginBottom: 16 }}>
        <Space size={16}>
          <Globe size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{t('multiSiteDashboard.title')}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {t('multiSiteDashboard.subtitle', { count: sites.length })}
            </div>
          </div>
        </Space>
      </Card>

      {error && <Alert type="warning" showIcon message={t('multiSiteDashboard.fallbackWarning')} description={error} action={<Button size="small" onClick={fetchAll}><RefreshCw size={14} /> {t('multiSiteDashboard.retry')}</Button>} style={{ marginBottom: 16 }} />}
      {!error && usingFallback && <Alert type="info" showIcon message={t('multiSiteDashboard.dataSourceDemo')} style={{ marginBottom: 16 }} />}
      {!error && !usingFallback && !loading && <Alert type="success" showIcon message={t('multiSiteDashboard.dataSourceReal')} style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title={t('multiSiteDashboard.statTotalSites')} value={sites.length} prefix={<Building2 size={16} />} styles={{ content: {  color: "#1e40af"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title={t('multiSiteDashboard.statOnline')} value={activeCount} prefix={<CheckCircle size={16} color="#10b981" />} styles={{ content: {  color: "#10b981"  } }} suffix={`/ ${sites.length}`} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title={t('multiSiteDashboard.statTotalStudies')} value={totalStudies} styles={{ content: {  color: "#0891b2"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title={t('multiSiteDashboard.statTotalPatients')} value={totalPatients} styles={{ content: {  color: "#7c3aed"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title={t('multiSiteDashboard.statTotalUsers')} value={totalUsers} styles={{ content: {  color: "#d97706"  } }} loading={loading} /></Card></Col>
        <Col span={4}><Card><Statistic title={t('multiSiteDashboard.statTotalStorage')} value={totalStorage.toLocaleString()} prefix={<Database size={16} />} styles={{ content: {  color: "#dc2626"  } }} loading={loading} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title={<Space><Network size={16} />{t('multiSiteDashboard.siteListTitle', { count: sites.length })}<Tag color="green">{t('multiSiteDashboard.onlineTag', { count: activeCount })}</Tag><Tag color="red">{t('multiSiteDashboard.offlineTag', { count: offlineCount })}</Tag></Space>} extra={<Badge count={offlineCount} title={t('multiSiteDashboard.alertSites')} />}>
            <Table scroll={{ x: 'max-content' }} dataSource={sites} columns={siteColumns} rowKey="id" size="small" pagination={false} loading={loading}/>
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<><Activity size={16} /> {t('multiSiteDashboard.syncStatus')}</>} style={{ marginBottom: 16 }}>
            <Statistic title={t('multiSiteDashboard.lastSyncLatency')} value={syncRate.toFixed(1)} suffix="%" styles={{ content: {  color: syncRate > 90 ? "#10b981" : "#f59e0b"  } }} loading={loading} />
            <div style={{ marginTop: 12 }}>
              <Text>{t('multiSiteDashboard.avgLatencyText', { count: sites.length, latency: (sites.reduce((s, x) => s + x.latencyMs, 0) / Math.max(1, sites.length)).toFixed(1) })}</Text>
              <Progress percent={Math.min(100, (sites.filter(s => s.status === "active").length / Math.max(1, sites.length)) * 100)} status="active" />
            </div>
          </Card>
          <Card title={<><Shield size={16} /> {t('multiSiteDashboard.highAvailability')}</>}>
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <div>{t('multiSiteDashboard.primaryDb')} <Tag color="green">{t('multiSiteDashboard.normal')}</Tag></div>
              <div>{t('multiSiteDashboard.remoteDR')} <Tag color="green">{t('multiSiteDashboard.synced')}</Tag></div>
              <div>{t('multiSiteDashboard.rpoTarget')} <Tag color="blue">≤ 60s</Tag></div>
              <div>{t('multiSiteDashboard.rtoTarget')} <Tag color="blue">≤ 10min</Tag></div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: "events",
              label: <><Activity size={14} /> {t('multiSiteDashboard.syncEventsTab', { count: syncEvents.length })}</>,
              children: (
                <Table scroll={{ x: 'max-content' }}
                  dataSource={eventsPagination.pageData}
                  rowKey="id"
                  size="small"
                  pagination={eventsPagination.pagination}
                  columns={[
                    { title: t('multiSiteDashboard.colTime'), dataIndex: "timestamp", key: "ts", width: 160, render: (value: string) => new Date(value).toLocaleString("zh-CN") },
                    { title: t('multiSiteDashboard.colSite'), dataIndex: "siteId", key: "siteId", width: 120, render: (id: string) => sites.find(s => s.id === id)?.name || id },
                    { title: t('multiSiteDashboard.colType'), dataIndex: "type", key: "type", width: 110, render: (value: string) => { const m = TYPE_MAP[value]; return <Tag color={m?.color ?? "default"}>{m ? t(m.labelKey) : value}</Tag>; } },
                    { title: t('multiSiteDashboard.colCount'), dataIndex: "count", key: "count", width: 70 },
                    { title: t('multiSiteDashboard.colBytes'), dataIndex: "bytes", key: "bytes", width: 90, render: (b: number) => `${(b / 1024).toFixed(1)} KB` },
                    { title: t('multiSiteDashboard.colDuration'), dataIndex: "duration", key: "dur", width: 80, render: (d: number) => `${d} ms` },
                    { title: t('multiSiteDashboard.colStatus'), dataIndex: "status", key: "status", width: 90, render: (s: string) => { const m = STATUS_SEV[s] || { color: "default" }; return <Tag color={m.color}>{s === "success" ? t('multiSiteDashboard.eventSuccess') : s === "failed" ? t('multiSiteDashboard.eventFailed') : t('multiSiteDashboard.eventWaiting')}</Tag>; } },
                    { title: t('multiSiteDashboard.colMessage'), dataIndex: "message", key: "msg", render: (m?: string) => m || "-" },
                  ]}
               
                />
              ),
            },
            {
              key: "rules",
              label: <><Shield size={14} /> {t('multiSiteDashboard.routingRulesTab', { count: routingRules.length })}</>,
              children: (
                <Table scroll={{ x: 'max-content' }}
                  dataSource={routingRules}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: t('multiSiteDashboard.colId'), dataIndex: "id", key: "id", width: 80 },
                    { title: t('multiSiteDashboard.colName'), dataIndex: "name", key: "name" },
                    { title: t('multiSiteDashboard.colSourceAe'), dataIndex: "sourceSite", key: "src", width: 110 },
                    { title: t('multiSiteDashboard.colDestAe'), dataIndex: "destSite", key: "dst", width: 110 },
                    { title: t('multiSiteDashboard.colModality'), dataIndex: "modality", key: "mod", width: 80 },
                    { title: t('multiSiteDashboard.colMatched'), dataIndex: "matchedCount", key: "mc", width: 100, render: (n: number) => n.toLocaleString() },
                    { title: t('multiSiteDashboard.colStatus'), dataIndex: "active", key: "act", width: 80, render: (a: boolean) => <Tag color={a ? "green" : "default"}>{a ? t('multiSiteDashboard.enabled') : t('multiSiteDashboard.disabled')}</Tag> },
                  ]}
               
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

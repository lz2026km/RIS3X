/**
 * Multi-Site / Multi-Campus Dashboard - 多站点 / 多院区管理
 * 阶段 1.5 修复: 之前是 3 KPI + 占位文字
 */
import { useMemo } from "react";
import { Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Badge, Space, Typography } from "antd";
import { Building2, MapPin, Activity, Database, Globe, Network, CheckCircle, AlertTriangle, XCircle, RefreshCw, Shield } from "lucide-react";
import { SITES, SYNC_EVENTS, ROUTING_RULES, getActiveSiteCount, getOfflineSiteCount, getTotalStudies } from "../services/site";

const { Title, Text } = Typography;

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

export default function MultiSiteDashboardPage() {
  const sites = SITES;
  const totalStudies = useMemo(() => getTotalStudies(), []);
  const totalPatients = useMemo(() => sites.reduce((s, x) => s + x.patients, 0), [sites]);
  const totalUsers = useMemo(() => sites.reduce((s, x) => s + x.users, 0), [sites]);
  const totalStorage = useMemo(() => sites.reduce((s, x) => s + x.storage, 0), [sites]);
  const activeCount = useMemo(() => getActiveSiteCount(), []);
  const offlineCount = useMemo(() => getOfflineSiteCount(), []);
  const syncRate = useMemo(() => {
    const last = sites.map(s => s.lastSync).sort().reverse()[0];
    const lastMin = (Date.now() - new Date(last).getTime()) / 60000;
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
      const m = STATUS_MAP[s]; return <Tag color={m.color} icon={m.icon}>{m.label}</Tag>;
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
              8 个院区 | 实时同步 | 跨院区路由 | DICOM 互联互通
            </div>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="总站点" value={sites.length} prefix={<Building2 size={16} />} styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="在线" value={activeCount} prefix={<CheckCircle size={16} color="#10b981" />} styles={{ content: {  color: "#10b981"  } }} suffix={`/ ${sites.length}`} /></Card></Col>
        <Col span={4}><Card><Statistic title="总检查数" value={totalStudies} styles={{ content: {  color: "#0891b2"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="总患者数" value={totalPatients} styles={{ content: {  color: "#7c3aed"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="总用户数" value={totalUsers} styles={{ content: {  color: "#d97706"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="总存储 (GB)" value={totalStorage.toLocaleString()} prefix={<Database size={16} />} styles={{ content: {  color: "#dc2626"  } }} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title={<Space><Network size={16} />站点列表 ({sites.length})<Tag color="green">{activeCount} 在线</Tag><Tag color="red">{offlineCount} 离线</Tag></Space>} extra={<Badge count={offlineCount} title="告警站点" />}>
            <Table dataSource={sites} columns={siteColumns} rowKey="id" size="small" pagination={false} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<><Activity size={16} /> 同步状态</>} style={{ marginBottom: 16 }}>
            <Statistic title="最近同步延迟" value={syncRate.toFixed(1)} suffix="%" styles={{ content: {  color: syncRate > 90 ? "#10b981" : "#f59e0b"  } }} />
            <div style={{ marginTop: 12 }}>
              <Text>8 个站点平均延迟 <strong>{(sites.reduce((s, x) => s + x.latencyMs, 0) / sites.length).toFixed(1)} ms</strong></Text>
              <Progress percent={Math.min(100, (sites.filter(s => s.status === "active").length / sites.length) * 100)} status="active" />
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
              label: <><Activity size={14} /> 同步事件 ({SYNC_EVENTS.length})</>,
              children: (
                <Table
                  dataSource={SYNC_EVENTS}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "时间", dataIndex: "timestamp", key: "ts", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
                    { title: "站点", dataIndex: "siteId", key: "siteId", width: 120, render: (id: string) => sites.find(s => s.id === id)?.name || id },
                    { title: "类型", dataIndex: "type", key: "type", width: 110, render: (t: string) => <Tag color={TYPE_MAP[t].color}>{TYPE_MAP[t].label}</Tag> },
                    { title: "数量", dataIndex: "count", key: "count", width: 70 },
                    { title: "字节", dataIndex: "bytes", key: "bytes", width: 90, render: (b: number) => `${(b / 1024).toFixed(1)} KB` },
                    { title: "耗时", dataIndex: "duration", key: "dur", width: 80, render: (d: number) => `${d} ms` },
                    { title: "状态", dataIndex: "status", key: "status", width: 90, render: (s: string) => <Tag color={STATUS_SEV[s].color}>{s === "success" ? "成功" : s === "failed" ? "失败" : "等待"}</Tag> },
                    { title: "消息", dataIndex: "message", key: "msg", render: (m?: string) => m || "-" },
                  ]}
                />
              ),
            },
            {
              key: "rules",
              label: <><Shield size={14} /> 路由规则 ({ROUTING_RULES.length})</>,
              children: (
                <Table
                  dataSource={ROUTING_RULES}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: "ID", dataIndex: "id", key: "id", width: 80 },
                    { title: "名称", dataIndex: "name", key: "name" },
                    { title: "源 AE", dataIndex: "sourceSite", key: "src", width: 110 },
                    { title: "目标 AE", dataIndex: "destSite", key: "dst", width: 110 },
                    { title: "模态", dataIndex: "modality", key: "mod", width: 80 },
                    { title: "匹配", dataIndex: "matchedCount", key: "mc", width: 100, render: (n: number) => n.toLocaleString() },
                    { title: "状态", dataIndex: "active", key: "act", width: 80, render: (a: boolean) => <Tag color={a ? "green" : "default"}>{a ? "启用" : "禁用"}</Tag> },
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
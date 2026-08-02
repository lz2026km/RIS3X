/**
 * VNA Core Engine Dashboard
 * 阶段 1.5 修复: 之前是 4 KPI + 1 行版本号
 */
import { useEffect } from "react";
import { Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Space, Typography, Badge, Alert } from "antd";
import { Server, Database, Activity, HardDrive, Zap, Globe, CheckCircle, AlertTriangle, Network, TrendingUp, Clock } from "lucide-react";
import { VNA_NODES, CACHE_METRICS, ROUTING_RULES } from "../services/vna";

const { Title, Text } = Typography;

const ROLE_MAP: Record<string, { color: string; label: string }> = {
  primary: { color: "red", label: "主节点" },
  replica: { color: "blue", label: "副本" },
  cache: { color: "cyan", label: "缓存" },
  edge: { color: "purple", label: "边缘" },
};

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  online: { color: "green", label: "在线" },
  degraded: { color: "orange", label: "降级" },
  offline: { color: "red", label: "离线" },
};

export default function VNADashboardPage() {
  useEffect(() => { document.title = "VNA 核心引擎仪表板 - G005 RIS"; }, []);

  const totalCapacity = VNA_NODES.reduce((s, n) => s + n.storageTotal, 0);
  const totalUsed = VNA_NODES.reduce((s, n) => s + n.storageUsed, 0);
  const totalInstances = VNA_NODES.reduce((s, n) => s + n.instances, 0);
  const avgHitRate = CACHE_METRICS.hitRate;
  const onlineNodes = VNA_NODES.filter(n => n.status === "online").length;
  const degradedNodes = VNA_NODES.filter(n => n.status === "degraded").length;

  return (
    <div style={{ padding: 24, background: "#f1f5f9", minHeight: "calc(100vh - 56px)" }}>
      <Card style={{ background: "linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)", color: "#fff", border: "none", marginBottom: 16 }}>
        <Space size={16}>
          <Server size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>VNA 核心引擎仪表板</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {VNA_NODES.length} 个节点 | 1 主库 + 2 副本 + 2 缓存 + 1 边缘 | WORM + 跨院区同步
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>集群健康</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{degradedNodes > 0 ? "降级" : "健康"}</div>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="集群状态" value={onlineNodes === VNA_NODES.length ? "健康" : "降级"} styles={{ content: {  color: degradedNodes > 0 ? "#f59e0b" : "#10b981"  } }} prefix={onlineNodes === VNA_NODES.length ? <CheckCircle size={16} /> : <AlertTriangle size={16} />} /></Card></Col>
        <Col span={4}><Card><Statistic title="总实例数" value={totalInstances} prefix={<Database size={16} />} styles={{ content: {  color: "#7c3aed"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="总研究数" value="148,523" styles={{ content: {  color: "#0891b2"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="缓存命中率" value={(avgHitRate * 100).toFixed(1)} suffix="%" styles={{ content: {  color: "#10b981"  } }} prefix={<Zap size={16} />} /></Card></Col>
        <Col span={4}><Card><Statistic title="存储 (TB)" value={(totalCapacity / 1024).toFixed(1)} styles={{ content: {  color: "#dc2626"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="关联数 (DICOM)" value="124" styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
      </Row>

      {degradedNodes > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`检测到 ${degradedNodes} 个节点降级运行`}
          description="VNA-CACHE-QD (青岛) 节点 IO 负载过高 (85%)，缓存命中率下降至 78%。建议扩容或迁移负载。"
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title={<Space><HardDrive size={16} />VNA 节点集群 ({VNA_NODES.length})<Tag color="green">{onlineNodes} 在线</Tag>{degradedNodes > 0 && <Tag color="orange">{degradedNodes} 降级</Tag>}</Space>} extra={<Badge count={VNA_NODES.length} />}>
            <Table
              dataSource={VNA_NODES}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: "节点 ID", dataIndex: "id", key: "id", width: 90 },
                { title: "主机名", dataIndex: "hostname", key: "host", width: 240 },
                { title: "角色", dataIndex: "role", key: "role", width: 90, render: (r: string) => <Tag color={ROLE_MAP[r].color}>{ROLE_MAP[r].label}</Tag> },
                { title: "IP", dataIndex: "ip", key: "ip", width: 130 },
                { title: "状态", dataIndex: "status", key: "status", width: 90, render: (s: string) => <Tag color={STATUS_MAP[s].color}>{STATUS_MAP[s].label}</Tag> },
                { title: "存储使用", key: "usage", width: 160, render: (_: any, r: any) => {
                  const pct = (r.storageUsed / r.storageTotal) * 100;
                  return <Progress percent={pct} size="small" status={pct > 80 ? "exception" : "active"} format={(p) => `${(p ?? 0).toFixed(0)}%`} />;
                } },
                { title: "实例数", dataIndex: "instances", key: "inst", width: 90, render: (n: number) => n.toLocaleString() },
                { title: "缓存命中率", dataIndex: "cacheHitRate", key: "hit", width: 120, render: (r: number) => (
                  <Progress percent={r * 100} size="small" status={r < 0.8 ? "exception" : "success"} format={(p) => `${(p ?? 0).toFixed(0)}%`} />
                ) },
                { title: "IO 负载", dataIndex: "ioLoad", key: "io", width: 110, render: (l: number) => (
                  <Progress percent={l * 100} size="small" status={l > 0.8 ? "exception" : l > 0.6 ? "active" : "normal"} format={(p) => `${(p ?? 0).toFixed(0)}%`} />
                ) },
                { title: "运行", dataIndex: "uptime", key: "up", width: 90, render: (u: number) => `${Math.floor(u / 86400)}d` },
                { title: "版本", dataIndex: "version", key: "ver", width: 100 },
              ]}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><Zap size={16} />缓存指标</Space>} style={{ marginBottom: 16 }}>
            <Statistic title="总请求数" value={CACHE_METRICS.totalRequests.toLocaleString()} />
            <div style={{ marginTop: 8 }}>
              <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><Text>命中</Text><Text strong>{CACHE_METRICS.cacheHits.toLocaleString()}</Text></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><Text>未命中</Text><Text type="danger">{CACHE_METRICS.cacheMisses.toLocaleString()}</Text></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><Text>驱逐</Text><Text>{CACHE_METRICS.evictions.toLocaleString()}</Text></div>
              </Space>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text>命中率</Text>
              <Progress percent={CACHE_METRICS.hitRate * 100} strokeColor="#10b981" />
            </div>
          </Card>
          <Card title={<Space><Clock size={16} />延迟指标</Space>}>
            <Statistic title="平均延迟" value={CACHE_METRICS.avgLatencyMs} suffix="ms" />
            <div style={{ marginTop: 8 }}>
              <Text>P99 延迟</Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: CACHE_METRICS.p99LatencyMs > 100 ? "#dc2626" : "#10b981" }}>
                {CACHE_METRICS.p99LatencyMs} ms
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title={<Space><Network size={16} />DICOM 路由规则 ({ROUTING_RULES.length})</Space>}>
        <Table
          dataSource={ROUTING_RULES}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: "ID", dataIndex: "id", key: "id", width: 90 },
            { title: "名称", dataIndex: "name", key: "name" },
            { title: "源 AE", dataIndex: "sourceAe", key: "src", width: 100 },
            { title: "目标 AE", dataIndex: "destAe", key: "dst", width: 140 },
            { title: "模态", dataIndex: "modality", key: "mod", width: 80 },
            { title: "命中数", dataIndex: "matched", key: "m", width: 110, render: (n: number) => n.toLocaleString() },
            { title: "状态", dataIndex: "active", key: "a", width: 80, render: (a: boolean) => <Tag color={a ? "green" : "default"}>{a ? "启用" : "禁用"}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
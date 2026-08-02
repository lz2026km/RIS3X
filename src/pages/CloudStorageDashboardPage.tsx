/**
 * Cloud Storage & Archiving Dashboard
 * 阶段 1.5 修复: 之前是 4 KPI + 标题
 */
import { useMemo } from "react";
import { Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Typography, Space, Alert } from "antd";
import { Cloud, Database, Archive, HardDrive, Layers, Activity, Clock, TrendingUp, AlertCircle, CheckCircle, FileArchive, Repeat } from "lucide-react";
import { STORAGE_NODES, TIER_METRICS, ARCHIVE_JOBS, COMPRESSION, getStorageNodes } from "../services/storage";

const { Title, Text } = Typography;

const TIER_COLORS: Record<string, string> = { hot: "#dc2626", warm: "#f59e0b", cold: "#3b82f6" };
const TIER_LABELS: Record<string, string> = { hot: "热存", warm: "温存", cold: "冷归档" };

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  online: { color: "green", label: "在线" },
  syncing: { color: "blue", label: "同步中" },
  offline: { color: "red", label: "离线" },
  readonly: { color: "orange", label: "只读" },
};

const JOB_TYPE: Record<string, { color: string; label: string }> = {
  auto_archive: { color: "blue", label: "自动归档" },
  manual_archive: { color: "purple", label: "手动归档" },
  restore: { color: "green", label: "恢复" },
  purge: { color: "red", label: "清理" },
};

const JOB_STATUS: Record<string, { color: string }> = {
  success: { color: "green" },
  running: { color: "blue" },
  failed: { color: "red" },
  queued: { color: "orange" },
};

export default function CloudStorageDashboardPage() {
  const nodes = STORAGE_NODES;
  const totalCapacity = useMemo(() => nodes.reduce((s, n) => s + n.capacityGb, 0), [nodes]);
  const totalUsed = useMemo(() => nodes.reduce((s, n) => s + n.usedGb, 0), [nodes]);
  const totalObjects = useMemo(() => nodes.reduce((s, n) => s + n.objectsCount, 0), [nodes]);
  const usedPct = (totalUsed / totalCapacity) * 100;

  return (
    <div style={{ padding: 24, background: "#f1f5f9", minHeight: "calc(100vh - 56px)" }}>
      <Card style={{ background: "linear-gradient(135deg,#0ea5e9 0%,#06b6d4 100%)", color: "#fff", border: "none", marginBottom: 16 }}>
        <Space size={16}>
          <Cloud size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>云存储与归档平台</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {(totalCapacity / 1024).toFixed(1)} PB 总容量 | {nodes.length} 个存储节点 | 多级分层 (热/温/冷)
            </div>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="总对象数" value={totalObjects} styles={{ content: {  color: "#0ea5e9"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="总容量 (TB)" value={(totalCapacity / 1024).toFixed(1)} styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="已用 (TB)" value={(totalUsed / 1024).toFixed(1)} suffix={`${usedPct.toFixed(1)}%`} styles={{ content: {  color: "#dc2626"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="24h 写入" value="42.8 MB" styles={{ content: {  color: "#10b981"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="24h 读取" value="124.2 MB" styles={{ content: {  color: "#0891b2"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="压缩节省" value={`${COMPRESSION.savedGb} GB`} styles={{ content: {  color: "#7c3aed"  } }} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title={<Space><HardDrive size={16} />存储节点 ({nodes.length})<Tag color="green">{(nodes.filter(n => n.status === "online").length)} 在线</Tag></Space>}>
            <Table
              dataSource={nodes}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: "节点", dataIndex: "name", key: "name", width: 220, render: (n: string, r: any) => (
                  <Space>
                    <Layers size={14} color={TIER_COLORS[r.tier]} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{r.vendor}</Text>
                    </div>
                  </Space>
                ) },
                { title: "层级", dataIndex: "tier", key: "tier", width: 80, render: (t: string) => <Tag color={TIER_COLORS[t]}>{TIER_LABELS[t]}</Tag> },
                { title: "类型", dataIndex: "type", key: "type", width: 100, render: (t: string) => t },
                { title: "区域", dataIndex: "region", key: "region", width: 140 },
                { title: "容量使用", key: "usage", width: 180, render: (_: any, r: any) => {
                  const pct = (r.usedGb / r.capacityGb) * 100;
                  return <Progress percent={pct} size="small" status={pct > 80 ? "exception" : "active"} format={(p) => `${(p ?? 0).toFixed(1)}%`} />;
                } },
                { title: "对象数", dataIndex: "objectsCount", key: "obj", width: 110, render: (n: number) => n.toLocaleString() },
                { title: "读延迟", dataIndex: "readLatencyMs", key: "rl", width: 90, render: (n: number) => `${n} ms` },
                { title: "写延迟", dataIndex: "writeLatencyMs", key: "wl", width: 90, render: (n: number) => `${n} ms` },
                { title: "状态", dataIndex: "status", key: "status", width: 100, render: (s: string) => <Tag color={STATUS_MAP[s].color}>{STATUS_MAP[s].label}</Tag> },
              ]}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><Archive size={16} />分层存储</Space>} style={{ marginBottom: 16 }}>
            {TIER_METRICS.map(m => (
              <div key={m.tier} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Space>
                    <div style={{ width: 10, height: 10, background: TIER_COLORS[m.tier], borderRadius: 2 }} />
                    <Text strong>{TIER_LABELS[m.tier]}层</Text>
                  </Space>
                  <Text>{m.objects.toLocaleString()} obj | {(m.sizeGb / 1024).toFixed(1)} TB</Text>
                </div>
                <Progress percent={m.pctOfTotal} showInfo={false} strokeColor={TIER_COLORS[m.tier]} />
                <Text type="secondary" style={{ fontSize: 11 }}>保留 {m.retentionDays} 天 | ${m.monthlyCostUsd}/月</Text>
              </div>
            ))}
          </Card>
          <Card title={<Space><TrendingUp size={16} />压缩统计</Space>}>
            <Statistic title="原始大小" value={`${(COMPRESSION.rawBytes / 1e12).toFixed(2)} TB`} />
            <div style={{ marginTop: 8 }}>
              <Text>压缩后 {(COMPRESSION.compressedBytes / 1e12).toFixed(2)} TB</Text>
            </div>
            <Progress percent={COMPRESSION.ratio * 100} strokeColor="#7c3aed" format={(p) => `${((p ?? 0) / 100).toFixed(2)}x`} />
            <Alert type="success" showIcon title={`节省 ${COMPRESSION.savedGb} GB 存储空间`} style={{ marginTop: 8 }} />
          </Card>
        </Col>
      </Row>

      <Card title={<Space><Repeat size={16} />归档任务 ({ARCHIVE_JOBS.length})</Space>}>
        <Table
          dataSource={ARCHIVE_JOBS}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "任务", dataIndex: "id", key: "id", width: 110 },
            { title: "类型", dataIndex: "type", key: "type", width: 110, render: (t: string) => <Tag color={JOB_TYPE[t].color}>{JOB_TYPE[t].label}</Tag> },
            { title: "源", dataIndex: "source", key: "src", width: 130 },
            { title: "目标", dataIndex: "target", key: "dst", width: 130 },
            { title: "对象数", dataIndex: "objects", key: "o", width: 80 },
            { title: "大小", dataIndex: "bytes", key: "b", width: 100, render: (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB` },
            { title: "开始", dataIndex: "startedAt", key: "s", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
            { title: "耗时", dataIndex: "duration", key: "d", width: 80, render: (d: number) => `${d}s` },
            { title: "进度", dataIndex: "progress", key: "p", width: 140, render: (p: number) => <Progress percent={p} size="small" status={p === 100 ? "success" : "active"} /> },
            { title: "状态", dataIndex: "status", key: "st", width: 90, render: (s: string) => <Tag color={JOB_STATUS[s].color}>{s === "success" ? "成功" : s === "running" ? "进行中" : s === "failed" ? "失败" : "排队"}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
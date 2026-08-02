/**
 * Business Continuity - 业务连续性 / 灾备
 * 阶段 1.5 修复: 之前是 3 KPI + "DB Primary: failed" + 占位文字
 */
import { useEffect, useState } from "react";
import { Card, Col, Row, Table, Tag, Statistic, Tabs, Space, Typography, Alert, Progress, Timeline, Badge, Button } from "antd";
import { Shield, Database, Activity, RefreshCw, Globe, CheckCircle, AlertTriangle, XCircle, Cloud, Server, Clock, Zap } from "lucide-react";
import { syncEngine, type SyncQueueItem, type ConflictResolution } from "../services/offline";
import { REPLICAS } from "../services/failover";

const { Title, Text } = Typography;

const TYPE_MAP: Record<string, { color: string; label: string }> = {
  study: { color: "blue", label: "检查" },
  report: { color: "green", label: "报告" },
  user_action: { color: "purple", label: "用户操作" },
  config: { color: "cyan", label: "配置" },
  image: { color: "magenta", label: "影像" },
};

const OP_MAP: Record<string, { label: string; color: string }> = {
  create: { label: "新建", color: "green" },
  update: { label: "更新", color: "blue" },
  delete: { label: "删除", color: "red" },
};

const PRI_MAP: Record<string, { color: string; n: number }> = {
  critical: { color: "red", n: 5 },
  high: { color: "orange", n: 4 },
  normal: { color: "blue", n: 3 },
  low: { color: "default", n: 1 },
};

const QSTATUS: Record<string, { color: string; label: string }> = {
  pending: { color: "orange", label: "待同步" },
  syncing: { color: "blue", label: "同步中" },
  completed: { color: "green", label: "已完成" },
  failed: { color: "red", label: "失败" },
  conflict: { color: "purple", label: "冲突" },
};

const REPL_STATUS: Record<string, { color: string; label: string }> = {
  healthy: { color: "green", label: "健康" },
  lagging: { color: "orange", label: "延迟" },
  offline: { color: "red", label: "离线" },
  failed: { color: "red", label: "故障" },
};

const ROLE_LABEL: Record<string, string> = {
  primary: "主库", standby: "热备", read_replica: "只读副本", analytics: "分析库",
};

export default function BusinessContinuityPage() {
  const [status, setStatus] = useState<{ total: number; completed: number; failed: number; pending: number; syncing: number; conflicts: number } | null>(null);
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const s = await syncEngine.getSyncStatus();
      const q = await syncEngine.getQueue();
      const c = await syncEngine.getConflicts();
      if (!mounted) return;
      setStatus(s);
      setQueue(q);
      setConflicts(c);
    };
    refresh();
    const t = setInterval(refresh, 3000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  return (
    <div style={{ padding: 24, background: "#f1f5f9", minHeight: "calc(100vh - 56px)" }}>
      <Card style={{ background: "linear-gradient(135deg,#dc2626 0%,#f59e0b 100%)", color: "#fff", border: "none", marginBottom: 16 }}>
        <Space size={16}>
          <Shield size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>业务连续性 / 灾备中心</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              离线同步引擎 | 冲突解决 | RPO ≤ 60s / RTO ≤ 10min | 异地多活
            </div>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="同步队列" value={status?.total ?? 0} prefix={<RefreshCw size={16} />} styles={{ content: {  color: "#0ea5e9"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="待同步" value={status?.pending ?? 0} styles={{ content: {  color: "#f59e0b"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="已完成" value={status?.completed ?? 0} prefix={<CheckCircle size={16} />} styles={{ content: {  color: "#10b981"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="失败" value={status?.failed ?? 0} prefix={<XCircle size={16} />} styles={{ content: {  color: "#dc2626"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="冲突" value={status?.conflicts ?? 0} prefix={<AlertTriangle size={16} />} styles={{ content: {  color: "#7c3aed"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="平均延迟" value={(REPLICAS.reduce((s, r) => s + r.lagMs, 0) / REPLICAS.length).toFixed(0)} suffix="ms" styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title={<Space><Database size={16} />数据库副本 ({REPLICAS.length})<Badge count={REPLICAS.filter(r => r.status === "healthy").length} status="success" /></Space>}>
            <Table
              dataSource={REPLICAS}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: "副本 ID", dataIndex: "id", key: "id", width: 130 },
                { title: "主机名", dataIndex: "hostname", key: "host", width: 220 },
                { title: "区域", dataIndex: "region", key: "region", width: 130 },
                { title: "角色", dataIndex: "role", key: "role", width: 100, render: (r: string) => <Tag color="blue">{ROLE_LABEL[r]}</Tag> },
                { title: "状态", dataIndex: "status", key: "status", width: 90, render: (s: string) => <Tag color={REPL_STATUS[s].color}>{REPL_STATUS[s].label}</Tag> },
                { title: "延迟", dataIndex: "lagMs", key: "lag", width: 100, render: (n: number) => <Tag color={n < 100 ? "green" : n < 1000 ? "orange" : "red"}>{n} ms</Tag> },
                { title: "心跳", dataIndex: "lastHeartbeat", key: "hb", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
                { title: "RPO", dataIndex: "rpo", key: "rpo", width: 80, render: (n: number) => `${n}s` },
                { title: "RTO", dataIndex: "rto", key: "rto", width: 80, render: (n: number) => `${n}s` },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<Space><AlertTriangle size={16} />冲突解决 ({conflicts.length})</Space>}>
            <Timeline
              items={conflicts.map(c => ({
                color: c.status === "escalated" ? "red" : c.status === "pending" ? "orange" : "green",
                children: (
                  <Space orientation="vertical" size={2} style={{ width: "100%" }}>
                    <Space>
                      <Tag color={c.type === "version_conflict" ? "blue" : c.type === "data_conflict" ? "orange" : "purple"}>
                        {c.type === "version_conflict" ? "版本冲突" : c.type === "data_conflict" ? "数据冲突" : "结构冲突"}
                      </Tag>
                      <Text strong>{c.id}</Text>
                      <Tag color={c.status === "escalated" ? "red" : c.status === "pending" ? "orange" : "green"}>
                        {c.status === "manual_resolved" ? "已人工解决" : c.status === "auto_resolved" ? "已自动解决" : c.status === "escalated" ? "已升级" : "待处理"}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{c.description}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>本地: {c.localVersion} · 远程: {c.remoteVersion}</Text>
                    {c.resolvedAt && <Text type="secondary" style={{ fontSize: 11 }}>解决时间: {new Date(c.resolvedAt).toLocaleString("zh-CN")}</Text>}
                  </Space>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Card title={<Space><Activity size={16} />同步队列 ({queue.length})</Space>}>
        <Table
          dataSource={queue}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "ID", dataIndex: "id", key: "id", width: 100 },
            { title: "类型", dataIndex: "type", key: "t", width: 90, render: (t: string) => <Tag color={TYPE_MAP[t].color}>{TYPE_MAP[t].label}</Tag> },
            { title: "操作", dataIndex: "operation", key: "o", width: 80, render: (o: string) => <Tag color={OP_MAP[o].color}>{OP_MAP[o].label}</Tag> },
            { title: "负载", dataIndex: "payload", key: "p", width: 180 },
            { title: "优先级", dataIndex: "priority", key: "pr", width: 80, render: (p: string) => <Tag color={PRI_MAP[p].color}>{p.toUpperCase()}</Tag> },
            { title: "重试", dataIndex: "attempts", key: "a", width: 80, render: (n: number, r: any) => `${n} / ${r.maxAttempts}` },
            { title: "状态", dataIndex: "status", key: "s", width: 100, render: (s: string) => <Tag color={QSTATUS[s].color}>{QSTATUS[s].label}</Tag> },
            { title: "创建", dataIndex: "createdAt", key: "c", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
            { title: "大小", dataIndex: "bytes", key: "b", width: 90, render: (b: number) => `${(b / 1024).toFixed(1)} KB` },
          ]}
        />
      </Card>
    </div>
  );
}
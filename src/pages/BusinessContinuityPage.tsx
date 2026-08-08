/**
 * Business Continuity - 业务连续性 / 灾备
 * 阶段 1.5 修复: 之前是 3 KPI + "DB Primary: failed" + 占位文字
 * [W3-A] 影像设备状态接入 deviceApi 真实数据; 数据库副本 REPLICAS 仍为静态演示 (failover.ts)
 */
import { useEffect, useState } from "react";
import { Card, Col, Row, Table, Tag, Statistic, Space, Typography, Timeline, Badge, Alert } from 'antd';
import { Shield, Database, Activity, RefreshCw, CheckCircle, AlertTriangle, XCircle, Monitor } from 'lucide-react';
import { syncEngine, type SyncQueueItem, type ConflictResolution } from "../services/offline";
import { REPLICAS, type DbReplica } from "../services/failover";
import { deviceApi, type DeviceDto } from "./../services/api/deviceApi";
import { usePagination } from "../hooks/usePagination";

const {  Text } = Typography;

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

const DEV_STATUS: Record<string, { color: string; label: string }> = {
  "运行中": { color: "green", label: "运行中" },
  "待机": { color: "default", label: "待机" },
  "维护中": { color: "orange", label: "维护中" },
  "故障": { color: "red", label: "故障" },
};

interface DeviceTodayStats {
  total: number;
  inUse: number;
  idle: number;
  maintenance: number;
  broken?: number;
}

export default function BusinessContinuityPage() {
  const [status, setStatus] = useState<{ total: number; completed: number; failed: number; pending: number; syncing: number; conflicts: number } | null>(null);
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceTodayStats | null>(null);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;
    const refreshDevices = async () => {
      const [statsRes, listRes] = await Promise.all([deviceApi.getTodayStats(), deviceApi.list()]);
      if (!mounted) return;
      if (statsRes.success) setDeviceStats(statsRes.data as unknown as DeviceTodayStats);
      if (listRes.success && Array.isArray(listRes.data)) setDevices(listRes.data);
      if (!statsRes.success || !listRes.success) setDeviceError("影像设备状态加载失败");
    };
    refreshDevices();
    return () => { mounted = false; };
  }, []);

  const replicas: DbReplica[] = REPLICAS;

  // [W3-C] 受控分页: 设备表 + 同步队列表
  const devicePagination = usePagination(devices, 10);
  const queuePagination = usePagination(queue, 10);

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
        <Col span={4}><Card><Statistic title="平均延迟" value={(replicas.reduce((s, r) => s + r.lagMs, 0) / replicas.length).toFixed(0)} suffix="ms" styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
      </Row>

      {deviceError && <Alert type="warning" showIcon message="设备状态加载失败" description={deviceError} style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title={<Space><Database size={16} />数据库副本 ({replicas.length})<Badge count={replicas.filter(r => r.status === "healthy").length} status="success" /><Tag color="orange">静态演示数据 (failover.ts)</Tag></Space>}>
            <Table
              dataSource={replicas}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: "副本 ID", dataIndex: "id", key: "id", width: 130 },
                { title: "主机名", dataIndex: "hostname", key: "host", width: 220 },
                { title: "区域", dataIndex: "region", key: "region", width: 130 },
                { title: "角色", dataIndex: "role", key: "role", width: 100, render: (r: string) => <Tag color="blue">{ROLE_LABEL[r]}</Tag> },
                { title: "状态", dataIndex: "status", key: "status", width: 90, render: (s: string) => { const m = REPL_STATUS[s] || { color: "default", label: s }; return <Tag color={m.color}>{m.label}</Tag>; } },
                { title: "延迟", dataIndex: "lagMs", key: "lag", width: 100, render: (n: number) => <Tag color={n < 100 ? "green" : n < 1000 ? "orange" : "red"}>{n} ms</Tag> },
                { title: "心跳", dataIndex: "lastHeartbeat", key: "hb", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
                { title: "RPO", dataIndex: "rpo", key: "rpo", width: 80, render: (n: number) => `${n}s` },
                { title: "RTO", dataIndex: "rto", key: "rto", width: 80, render: (n: number) => `${n}s` },
              ]}
            scroll={{ x: 'max-content' }}
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

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}><Card><Statistic title="设备总数" value={deviceStats?.total ?? 0} prefix={<Monitor size={16} />} styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
        <Col span={5}><Card><Statistic title="运行中" value={deviceStats?.inUse ?? 0} prefix={<CheckCircle size={16} />} styles={{ content: {  color: "#10b981"  } }} /></Card></Col>
        <Col span={5}><Card><Statistic title="待机" value={deviceStats?.idle ?? 0} styles={{ content: {  color: "#64748b"  } }} /></Card></Col>
        <Col span={5}><Card><Statistic title="维护中" value={deviceStats?.maintenance ?? 0} prefix={<AlertTriangle size={16} />} styles={{ content: {  color: "#f59e0b"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="故障" value={deviceStats?.broken ?? 0} prefix={<XCircle size={16} />} styles={{ content: {  color: "#dc2626"  } }} /></Card></Col>
      </Row>

      <Card title={<Space><Monitor size={16} />影像设备状态 ({devices.length})<Tag color="green">数据来源：/devices 真实接口</Tag></Space>} style={{ marginBottom: 16 }}>
        <Table
          dataSource={devicePagination.pageData}
          rowKey="id"
          size="small"
          pagination={devicePagination.pagination}
          columns={[
            { title: "设备编码", dataIndex: "code", key: "code", width: 110 },
            { title: "设备名称", dataIndex: "name", key: "name" },
            { title: "模态", dataIndex: "modality", key: "modality", width: 80, render: (m: string) => <Tag>{m}</Tag> },
            { title: "型号", dataIndex: "model", key: "model", width: 140, render: (m?: string) => m || "-" },
            { title: "所在房间", dataIndex: "room", key: "room", width: 120, render: (r?: string) => r || "-" },
            { title: "状态", dataIndex: "status", key: "status", width: 100, render: (s: string) => { const m = DEV_STATUS[s] || { color: "default", label: s }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: "上次维护", dataIndex: "lastMaintenanceAt", key: "lm", width: 150, render: (t?: string) => t ? new Date(t).toLocaleDateString("zh-CN") : "-" },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Card title={<Space><Activity size={16} />同步队列 ({queue.length})</Space>}>
        <Table
          dataSource={queuePagination.pageData}
          rowKey="id"
          size="small"
          pagination={queuePagination.pagination}
          columns={[
            { title: "编号", dataIndex: "id", key: "id", width: 100 },
            { title: "类型", dataIndex: "type", key: "t", width: 90, render: (t: string) => { const m = TYPE_MAP[t] || { color: "default", label: t }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: "操作", dataIndex: "operation", key: "o", width: 80, render: (o: string) => { const m = OP_MAP[o] || { color: "default", label: o }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: "负载", dataIndex: "payload", key: "p", width: 180 },
            { title: "优先级", dataIndex: "priority", key: "pr", width: 80, render: (p: string) => { const m = PRI_MAP[p] || { color: "default", n: 3 }; return <Tag color={m.color}>{p.toUpperCase()}</Tag>; } },
            { title: "重试", dataIndex: "attempts", key: "a", width: 80, render: (n: number, r: any) => `${n} / ${r.maxAttempts}` },
            { title: "状态", dataIndex: "status", key: "s", width: 100, render: (s: string) => { const m = QSTATUS[s] || { color: "default", label: s }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: "创建", dataIndex: "createdAt", key: "c", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
            { title: "大小", dataIndex: "bytes", key: "b", width: 90, render: (b: number) => `${(b / 1024).toFixed(1)} KB` },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
}

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
import { t } from "../i18n/appI18n";

const {  Text } = Typography;

const TYPE_MAP: Record<string, { color: string; label: string }> = {
  study: { color: "blue", label: t("businessContinuity.typeStudy") },
  report: { color: "green", label: t("businessContinuity.typeReport") },
  user_action: { color: "purple", label: t("businessContinuity.typeUserAction") },
  config: { color: "cyan", label: t("businessContinuity.typeConfig") },
  image: { color: "magenta", label: t("businessContinuity.typeImage") },
};

const OP_MAP: Record<string, { label: string; color: string }> = {
  create: { label: t("businessContinuity.opCreate"), color: "green" },
  update: { label: t("businessContinuity.opUpdate"), color: "blue" },
  delete: { label: t("businessContinuity.opDelete"), color: "red" },
};

const PRI_MAP: Record<string, { color: string; n: number }> = {
  critical: { color: "red", n: 5 },
  high: { color: "orange", n: 4 },
  normal: { color: "blue", n: 3 },
  low: { color: "default", n: 1 },
};

const QSTATUS: Record<string, { color: string; label: string }> = {
  pending: { color: "orange", label: t("businessContinuity.qPending") },
  syncing: { color: "blue", label: t("businessContinuity.qSyncing") },
  completed: { color: "green", label: t("businessContinuity.qCompleted") },
  failed: { color: "red", label: t("businessContinuity.qFailed") },
  conflict: { color: "purple", label: t("businessContinuity.qConflict") },
};

const REPL_STATUS: Record<string, { color: string; label: string }> = {
  healthy: { color: "green", label: t("businessContinuity.replHealthy") },
  lagging: { color: "orange", label: t("businessContinuity.replLagging") },
  offline: { color: "red", label: t("businessContinuity.replOffline") },
  failed: { color: "red", label: t("businessContinuity.replFailed") },
};

const ROLE_LABEL: Record<string, string> = {
  primary: t("businessContinuity.rolePrimary"), standby: t("businessContinuity.roleStandby"), read_replica: t("businessContinuity.roleReadReplica"), analytics: t("businessContinuity.roleAnalytics"),
};

const DEV_STATUS: Record<string, { color: string; label: string }> = {
  "运行中": { color: "green", label: t("businessContinuity.devRunning") },
  "待机": { color: "default", label: t("businessContinuity.devIdle") },
  "维护中": { color: "orange", label: t("businessContinuity.devMaintenance") },
  "故障": { color: "red", label: t("businessContinuity.devFault") },
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
    const timer = setInterval(refresh, 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshDevices = async () => {
      const [statsRes, listRes] = await Promise.all([deviceApi.getTodayStats(), deviceApi.list()]);
      if (!mounted) return;
      if (statsRes.success) setDeviceStats(statsRes.data as unknown as DeviceTodayStats);
      if (listRes.success && Array.isArray(listRes.data)) setDevices(listRes.data);
      if (!statsRes.success || !listRes.success) setDeviceError(t("businessContinuity.deviceLoadFailed"));
    };
    refreshDevices();
    return () => { mounted = false; };
  }, []);

  const replicas: DbReplica[] = REPLICAS;

  // [W3-C] 受控分页: 设备表 + 同步队列表
  const devicePagination = usePagination(devices, 10);
  const queuePagination = usePagination(queue, 10);

  return (
    <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
      <Card style={{ background: "linear-gradient(135deg,#dc2626 0%,#f59e0b 100%)", color: "#fff", border: "none", marginBottom: 16 }}>
        <Space size={16}>
          <Shield size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{t("businessContinuity.title")}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {t("businessContinuity.subtitle")}
            </div>
          </div>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title={t("businessContinuity.syncQueue")} value={status?.total ?? 0} prefix={<RefreshCw size={16} />} styles={{ content: {  color: "#0ea5e9"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title={t("businessContinuity.qPending")} value={status?.pending ?? 0} styles={{ content: {  color: "#f59e0b"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title={t("businessContinuity.qCompleted")} value={status?.completed ?? 0} prefix={<CheckCircle size={16} />} styles={{ content: {  color: "#10b981"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title={t("businessContinuity.qFailed")} value={status?.failed ?? 0} prefix={<XCircle size={16} />} styles={{ content: {  color: "#dc2626"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title={t("businessContinuity.qConflict")} value={status?.conflicts ?? 0} prefix={<AlertTriangle size={16} />} styles={{ content: {  color: "#7c3aed"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title={t("businessContinuity.avgLag")} value={(replicas.reduce((s, r) => s + r.lagMs, 0) / replicas.length).toFixed(0)} suffix="ms" styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
      </Row>

      {deviceError && <Alert type="warning" showIcon message={t("businessContinuity.deviceLoadFailedAlert")} description={deviceError} style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title={<Space><Database size={16} />{t("businessContinuity.dbReplicas")} ({replicas.length})<Badge count={replicas.filter(r => r.status === "healthy").length} status="success" /><Tag color="orange">{t("businessContinuity.staticDemoData")}</Tag></Space>}>
            <Table scroll={{ x: 'max-content' }}
              dataSource={replicas}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: t("businessContinuity.replicaId"), dataIndex: "id", key: "id", width: 130 },
                { title: t("businessContinuity.hostname"), dataIndex: "hostname", key: "host", width: 220 },
                { title: t("businessContinuity.region"), dataIndex: "region", key: "region", width: 130 },
                { title: t("businessContinuity.role"), dataIndex: "role", key: "role", width: 100, render: (r: string) => <Tag color="blue">{ROLE_LABEL[r]}</Tag> },
                { title: t("businessContinuity.status"), dataIndex: "status", key: "status", width: 90, render: (s: string) => { const m = REPL_STATUS[s] || { color: "default", label: s }; return <Tag color={m.color}>{m.label}</Tag>; } },
                { title: t("businessContinuity.lag"), dataIndex: "lagMs", key: "lag", width: 100, render: (n: number) => <Tag color={n < 100 ? "green" : n < 1000 ? "orange" : "red"}>{n} ms</Tag> },
                { title: t("businessContinuity.heartbeat"), dataIndex: "lastHeartbeat", key: "hb", width: 160, render: (v: string) => new Date(v).toLocaleString("zh-CN") },
                { title: "RPO", dataIndex: "rpo", key: "rpo", width: 80, render: (n: number) => `${n}s` },
                { title: "RTO", dataIndex: "rto", key: "rto", width: 80, render: (n: number) => `${n}s` },
              ]}
           
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<Space><AlertTriangle size={16} />{t("businessContinuity.conflictResolution")} ({conflicts.length})</Space>}>
            <Timeline
              items={conflicts.map(c => ({
                color: c.status === "escalated" ? "red" : c.status === "pending" ? "orange" : "green",
                children: (
                  <Space orientation="vertical" size={2} style={{ width: "100%" }}>
                    <Space>
                      <Tag color={c.type === "version_conflict" ? "blue" : c.type === "data_conflict" ? "orange" : "purple"}>
                        {c.type === "version_conflict" ? t("businessContinuity.conflictVersion") : c.type === "data_conflict" ? t("businessContinuity.conflictData") : t("businessContinuity.conflictSchema")}
                      </Tag>
                      <Text strong>{c.id}</Text>
                      <Tag color={c.status === "escalated" ? "red" : c.status === "pending" ? "orange" : "green"}>
                        {c.status === "manual_resolved" ? t("businessContinuity.statusManualResolved") : c.status === "auto_resolved" ? t("businessContinuity.statusAutoResolved") : c.status === "escalated" ? t("businessContinuity.statusEscalated") : t("businessContinuity.statusPending")}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{c.description}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{t("businessContinuity.local")}{c.localVersion} · {t("businessContinuity.remote")}{c.remoteVersion}</Text>
                    {c.resolvedAt && <Text type="secondary" style={{ fontSize: 11 }}>{t("businessContinuity.resolvedAt")}{new Date(c.resolvedAt).toLocaleString("zh-CN")}</Text>}
                  </Space>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}><Card><Statistic title={t("businessContinuity.deviceTotal")} value={deviceStats?.total ?? 0} prefix={<Monitor size={16} />} styles={{ content: {  color: "#1e40af"  } }} /></Card></Col>
        <Col span={5}><Card><Statistic title={t("businessContinuity.devRunning")} value={deviceStats?.inUse ?? 0} prefix={<CheckCircle size={16} />} styles={{ content: {  color: "#10b981"  } }} /></Card></Col>
        <Col span={5}><Card><Statistic title={t("businessContinuity.devIdle")} value={deviceStats?.idle ?? 0} styles={{ content: {  color: "var(--text-secondary)"  } }} /></Card></Col>
        <Col span={5}><Card><Statistic title={t("businessContinuity.devMaintenance")} value={deviceStats?.maintenance ?? 0} prefix={<AlertTriangle size={16} />} styles={{ content: {  color: "#f59e0b"  } }} /></Card></Col>
        <Col span={4}><Card><Statistic title={t("businessContinuity.devFault")} value={deviceStats?.broken ?? 0} prefix={<XCircle size={16} />} styles={{ content: {  color: "#dc2626"  } }} /></Card></Col>
      </Row>

      <Card title={<Space><Monitor size={16} />{t("businessContinuity.imagingDeviceStatus")} ({devices.length})<Tag color="green">{t("businessContinuity.realDataSource")}</Tag></Space>} style={{ marginBottom: 16 }}>
        <Table scroll={{ x: 'max-content' }}
          dataSource={devicePagination.pageData}
          rowKey="id"
          size="small"
          pagination={devicePagination.pagination}
          columns={[
            { title: t("businessContinuity.deviceCode"), dataIndex: "code", key: "code", width: 110 },
            { title: t("businessContinuity.deviceName"), dataIndex: "name", key: "name" },
            { title: t("businessContinuity.modality"), dataIndex: "modality", key: "modality", width: 80, render: (m: string) => <Tag>{m}</Tag> },
            { title: t("businessContinuity.model"), dataIndex: "model", key: "model", width: 140, render: (m?: string) => m || "-" },
            { title: t("businessContinuity.room"), dataIndex: "room", key: "room", width: 120, render: (r?: string) => r || "-" },
            { title: t("businessContinuity.status"), dataIndex: "status", key: "status", width: 100, render: (s: string) => { const m = DEV_STATUS[s] || { color: "default", label: s }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: t("businessContinuity.lastMaintenance"), dataIndex: "lastMaintenanceAt", key: "lm", width: 150, render: (v?: string) => v ? new Date(v).toLocaleDateString("zh-CN") : "-" },
          ]}
       
        />
      </Card>

      <Card title={<Space><Activity size={16} />{t("businessContinuity.syncQueue")} ({queue.length})</Space>}>
        <Table scroll={{ x: 'max-content' }}
          dataSource={queuePagination.pageData}
          rowKey="id"
          size="small"
          pagination={queuePagination.pagination}
          columns={[
            { title: t("businessContinuity.queueId"), dataIndex: "id", key: "id", width: 100 },
            { title: t("businessContinuity.type"), dataIndex: "type", key: "t", width: 90, render: (v: string) => { const m = TYPE_MAP[v] || { color: "default", label: v }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: t("businessContinuity.operation"), dataIndex: "operation", key: "o", width: 80, render: (o: string) => { const m = OP_MAP[o] || { color: "default", label: o }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: t("businessContinuity.payload"), dataIndex: "payload", key: "p", width: 180 },
            { title: t("businessContinuity.priority"), dataIndex: "priority", key: "pr", width: 80, render: (p: string) => { const m = PRI_MAP[p] || { color: "default", n: 3 }; return <Tag color={m.color}>{p.toUpperCase()}</Tag>; } },
            { title: t("businessContinuity.retry"), dataIndex: "attempts", key: "a", width: 80, render: (n: number, r: any) => `${n} / ${r.maxAttempts}` },
            { title: t("businessContinuity.status"), dataIndex: "status", key: "s", width: 100, render: (s: string) => { const m = QSTATUS[s] || { color: "default", label: s }; return <Tag color={m.color}>{m.label}</Tag>; } },
            { title: t("businessContinuity.created"), dataIndex: "createdAt", key: "c", width: 160, render: (v: string) => new Date(v).toLocaleString("zh-CN") },
            { title: t("businessContinuity.size"), dataIndex: "bytes", key: "b", width: 90, render: (b: number) => `${(b / 1024).toFixed(1)} KB` },
          ]}
       
        />
      </Card>
    </div>
  );
}

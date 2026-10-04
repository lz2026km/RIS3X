/**
 * Cloud Storage & Archiving Dashboard
 * v3.0.6.11-60: 增加「存储配置」页签 — 驱动选择 (本地/S3) + 配置表单 + 连接测试 + 存储统计
 * v3.0.6.11-99 Wave 7A (G-28): 生命周期策略 Tab + 对象批量操作 (复制/批量删除) + 驱动/数据源徽标 + 多租户桶隔离
 */
import { useEffect, useMemo, useState } from "react";
import {
  Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Typography, Space, Alert,
  Radio, Form, Input, Button, message, InputNumber, Select, Modal, Upload, Tooltip, Popconfirm, Switch,
} from "antd";
import {
  Cloud, Database, Archive, HardDrive, Layers, Activity, Clock, TrendingUp, AlertCircle,
  CheckCircle, FileArchive, Repeat, Settings, PlugZap, Save, RefreshCw, BellRing,
  FolderPlus, Boxes, UploadCloud, Download, Eye, Trash2, FileJson, FileText, File as FileIcon, Inbox,
  Copy as CopyIcon, CalendarClock, ShieldCheck, Link2, Globe2, Gauge, ClipboardCopy,
} from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, BarChart, Bar,
} from "recharts";
import { ChartContainer, chartDefaults } from '../components/charts';
import { StatCard, StatCardGrid } from '../components/common';
import { autoInterval } from '../utils/chartUtils';
import { STORAGE_NODES, TIER_METRICS, ARCHIVE_JOBS, COMPRESSION } from "../services/storage";
import { usePagination } from "../hooks/usePagination";
import { t } from "../i18n/appI18n";
import {
  storageConfigApi,
  type StorageConfigDto,
  type StorageStatsDto,
  type StorageTestResponse,
  type StorageAlertsConfig,
  type StorageBucketDto,
  type StorageObjectDto,
  type BucketProvider,
  type LifecyclePolicyDto,
  type LifecyclePolicyInput,
  type LifecycleTransitionTier,
  type SignedUrlDto,
  type ReplicationTaskDto,
  type ReplicationStatusDto,
  type StorageMonitoringDto,
} from "../services/api/storageConfigApi";

const { Text } = Typography;

const NOTIFY_CHANNEL_LABELS: Record<string, string> = {
  email: "email",
  sms: "sms",
  wechat: "wechat",
  dingtalk: "dingtalk",
  app: "app",
};
const notifyChannelLabel = (k: string) => t(`cloudStorage.channel${k.charAt(0).toUpperCase()}${k.slice(1)}`);

const TIER_COLORS: Record<string, string> = { hot: "#dc2626", warm: "#f59e0b", cold: "#3b82f6" };
const tierLabel = (tier: string) => t(`cloudStorage.tier${tier.charAt(0).toUpperCase()}${tier.slice(1)}`);
const nodeTypeLabel = (tier: string) => t(`cloudStorage.node${tier.charAt(0).toUpperCase()}${tier.slice(1)}`);

const STATUS_COLORS: Record<string, string> = {
  online: "green",
  syncing: "blue",
  offline: "red",
  readonly: "orange",
};
const statusLabel = (s: string) => t(`cloudStorage.status${s.charAt(0).toUpperCase()}${s.slice(1)}`);

// [G005 v3.0.6.11-99 Wave 7A (G-28)] S3 驱动来源徽标映射
const DRIVER_SOURCE_META: Record<string, { color: string; descKey: string }> = {
  "aws-sigv4-native": { color: "geekblue", descKey: "cloudStorage.driverSigv4Desc" },
  simulated: { color: "gold", descKey: "cloudStorage.driverSimDesc" },
  "local-fs": { color: "green", descKey: "cloudStorage.driverLocalFsDesc" },
};
const driverSourceLabel = (k: string) => t(k === "aws-sigv4-native" ? "cloudStorage.driverSigv4" : k === "simulated" ? "cloudStorage.driverSim" : "cloudStorage.driverLocalFs");

// [G005 v3.0.6.11-99 Wave 7A (G-28)] 生命周期转存层徽标
const TIER_TRANSITION_META: Record<string, { color: string }> = {
  tier2: { color: "blue" },
  archive: { color: "purple" },
  backup: { color: "green" },
};
const transitionLabel = (tier: string) => t(`cloudStorage.trans${tier.charAt(0).toUpperCase()}${tier.slice(1)}`);

const JOB_TYPE: Record<string, { color: string }> = {
  auto_archive: { color: "blue" },
  manual_archive: { color: "purple" },
  restore: { color: "green" },
  purge: { color: "red" },
};
const jobTypeLabel = (type: string) => t(type === "auto_archive" ? "cloudStorage.jobAutoArchive" : type === "manual_archive" ? "cloudStorage.jobManualArchive" : type === "restore" ? "cloudStorage.jobRestore" : "cloudStorage.jobPurge");

const JOB_STATUS: Record<string, { color: string }> = {
  success: { color: "green" },
  running: { color: "blue" },
  failed: { color: "red" },
  queued: { color: "orange" },
};

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let v = bytes;
  let i = -1;
  do { v /= 1024; i += 1; } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(2)} ${units[i]}`;
}

/** 图表坐标轴短格式 */
function formatBytesShort(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(1)}G`;
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)}M`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(1)}K`;
  return `${bytes}B`;
}

// [G005 v3.0.6.11-100 Wave 3B (G-28)] 桶用量条形图配色
const BAR_PALETTE = ["#0ea5e9", "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

// [G005 v3.0.6.11-100 Wave 3B (G-28)] 复制任务状态徽标
const REP_STATUS_META: Record<string, { color: string }> = {
  queued: { color: "orange" },
  running: { color: "blue" },
  completed: { color: "green" },
  failed: { color: "red" },
};
const repStatusLabel = (s: string) => t(`cloudStorage.rep${s.charAt(0).toUpperCase()}${s.slice(1)}`);

// ─────────────────────────── 监控大盘 (原有) ───────────────────────────

function StorageMonitorTab() {
  const nodes = STORAGE_NODES;
  const totalCapacity = useMemo(() => nodes.reduce((s, n) => s + n.capacityGb, 0), [nodes]);
  const totalUsed = useMemo(() => nodes.reduce((s, n) => s + n.usedGb, 0), [nodes]);
  const totalObjects = useMemo(() => nodes.reduce((s, n) => s + n.objectsCount, 0), [nodes]);
  const usedPct = (totalUsed / totalCapacity) * 100;
  // [W3-C] 受控分页: 归档任务表
  const jobsPagination = usePagination(ARCHIVE_JOBS, 10);
  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 容量阈值预警配置
  const [alertsConfig, setAlertsConfig] = useState<StorageAlertsConfig | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [alertsForm] = Form.useForm<StorageAlertsConfig>();
  // [G005 v3.0.6.11-100 Wave 3B (G-28)] 存储监控大屏数据
  const [monitor, setMonitor] = useState<StorageMonitoringDto | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(true);
  const [repStatus, setRepStatus] = useState<ReplicationStatusDto | null>(null);
  const [repLoading, setRepLoading] = useState(false);

  const loadMonitor = async () => {
    setMonitorLoading(true);
    const res = await storageConfigApi.getMonitoring();
    if (res.success && res.data) setMonitor(res.data);
    setMonitorLoading(false);
  };

  const loadRepStatus = async () => {
    setRepLoading(true);
    const res = await storageConfigApi.replicationStatus();
    if (res.success && res.data) setRepStatus(res.data);
    setRepLoading(false);
  };
  // [v3.0.6.11-92] 24h 读写从真实存储统计派生(30 天日均近似), 无真实数据则标注示例值
  const [storageStats, setStorageStats] = useState<StorageStatsDto | null>(null);
  useEffect(() => {
    storageConfigApi.get().then(res => { if (res.success && res.data) setStorageStats(res.data.active); }).catch(() => {});
  }, []);
  const twentyFourH = useMemo(() => {
    const used = storageStats?.usedBytes;
    if (used && used > 0) {
      const write = used / 30;
      return { write, read: write * 3, derived: true };
    }
    return { write: 42.8 * 1024 * 1024, read: 124.2 * 1024 * 1024, derived: false };
  }, [storageStats]);

  const loadAlertsConfig = async () => {
    setAlertsLoading(true);
    const res = await storageConfigApi.getAlertsConfig();
    if (res.success && res.data) {
      setAlertsConfig(res.data);
      alertsForm.setFieldsValue(res.data);
    }
    setAlertsLoading(false);
  };

  useEffect(() => { void loadAlertsConfig(); }, []);

  useEffect(() => { void loadMonitor(); void loadRepStatus(); }, []);

  // [G005 v3.0.6.11-100 Wave 3B (G-28)] 监控大屏实时刷新: 复制队列 5s / 监控指标 15s 轮询
  useEffect(() => {
    const repTimer = setInterval(() => void loadRepStatus(), 5_000);
    const monTimer = setInterval(() => void loadMonitor(), 15_000);
    return () => { clearInterval(repTimer); clearInterval(monTimer); };
  }, []);

  const saveAlertsConfig = async () => {
    try {
      const values = await alertsForm.validateFields();
      setAlertsSaving(true);
      const res = await storageConfigApi.saveAlertsConfig(values);
      if (res.success && res.data) {
        setAlertsConfig(res.data);
        message.success(t("cloudStorage.monitor.alertsSaved", { warn: res.data.warnPercent, crit: res.data.criticalPercent }));
      } else {
        message.error(res.error?.message ?? t("cloudStorage.monitor.alertsSaveFailed"));
      }
    } catch {
      /* 校验失败忽略 */
    }
    setAlertsSaving(false);
  };

  const warnPct = alertsConfig?.warnPercent ?? 80;
  const criticalPct = alertsConfig?.criticalPercent ?? 90;
  const capacityLevel = usedPct >= criticalPct ? "critical" : usedPct >= warnPct ? "warn" : "ok";

  return (
    <>
      <Card
        size="small"
        title={<Space><BellRing size={16} />{t("cloudStorage.monitor.alertsTitle")}<Text type="secondary" style={{ fontSize: 12 }}>{t("cloudStorage.monitor.alertsSub")}</Text></Space>}
        extra={<Button size="small" type="primary" icon={<Save size={14} />} loading={alertsSaving} onClick={() => void saveAlertsConfig()}>{t("cloudStorage.monitor.save")}</Button>}
        style={{ marginBottom: 16 }}
        loading={alertsLoading}
      >
        <Form form={alertsForm} layout="inline" initialValues={{ warnPercent: 80, criticalPercent: 90, notifyChannels: ["email", "sms"] }}>
          <Form.Item name="warnPercent" label={t("cloudStorage.monitor.warnPercent")} rules={[{ required: true, message: t("cloudStorage.required") }]}>
            <InputNumber min={1} max={100} style={{ width: 90 }} />
          </Form.Item>
          <Form.Item name="criticalPercent" label={t("cloudStorage.monitor.criticalPercent")} rules={[{ required: true, message: t("cloudStorage.required") }]}>
            <InputNumber min={1} max={100} style={{ width: 90 }} />
          </Form.Item>
          <Form.Item name="notifyChannels" label={t("cloudStorage.monitor.channelsLabel")} rules={[{ required: true, message: t("cloudStorage.monitor.channelsRequired") }]}>
            <Select mode="multiple" placeholder={t("cloudStorage.monitor.channelsPlaceholder")} style={{ minWidth: 260 }} options={Object.keys(NOTIFY_CHANNEL_LABELS).map((value) => ({ value, label: notifyChannelLabel(value) }))} />
          </Form.Item>
        </Form>
      </Card>

      {/* [G005 v3.0.6.11-100 Wave 3B (G-28)] 监控大屏: 容量环形图 + 增长率趋势线 + 桶用量条形 + IO 计数 + 复制队列 */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        loading={monitorLoading}
        title={
          <Space>
            <Gauge size={16} />{t("cloudStorage.monitor.title")}
            <Text type="secondary" style={{ fontSize: 12 }}>{t("cloudStorage.monitor.sub")}</Text>
          </Space>
        }
        extra={
          <Space>
            <Tooltip title={monitor?.source === "derived" ? t("cloudStorage.monitor.sourceDerived") : t("cloudStorage.monitor.sourceFallback")}>
              <Tag color={monitor?.source === "derived" ? "blue" : "orange"} icon={<Database size={12} />}>
                {t("cloudStorage.monitor.dataSource", { source: monitor?.source === "derived" ? t("cloudStorage.monitor.sourceBucket") : t("cloudStorage.monitor.sourceSeed") })}
              </Tag>
            </Tooltip>
            <Button size="small" icon={<RefreshCw size={13} />} onClick={() => { void loadMonitor(); void loadRepStatus(); }}>
              {t("cloudStorage.refresh")}
            </Button>
          </Space>
        }
      >
        <Row gutter={12}>
          <Col span={7}>
            <div style={{ textAlign: "center" }}>
              <ChartContainer type="pie" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: t("cloudStorage.monitor.used"), value: monitor?.totalUsedBytes ?? totalUsed * 1024 ** 3 },
                      { name: t("cloudStorage.monitor.available"), value: Math.max(0, (monitor?.totalCapacityBytes ?? totalCapacity * 1024 ** 4) - (monitor?.totalUsedBytes ?? totalUsed * 1024 ** 3)) },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    <Cell fill={capacityLevel === "critical" ? "#dc2626" : capacityLevel === "warn" ? "#d97706" : "#0ea5e9"} />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                  <ChartTooltip {...chartDefaults.tooltip} formatter={(v: unknown) => formatBytes(Number(v))} />
                </PieChart>
              </ChartContainer>
              <div style={{ marginTop: -6 }}>
                <Text strong style={{ fontSize: 15 }}>{t("cloudStorage.monitor.usageRate", { level: capacityLevel === "critical" ? t("cloudStorage.monitor.levelCritical") : capacityLevel === "warn" ? t("cloudStorage.monitor.levelWarn") : t("cloudStorage.monitor.levelOk"), pct: monitor?.usedPercent ?? usedPct.toFixed(1) })}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t("cloudStorage.monitor.usedOfTotal", { used: formatBytes(monitor?.totalUsedBytes ?? totalUsed * 1024 ** 3), total: formatBytes(monitor?.totalCapacityBytes ?? totalCapacity * 1024 ** 4) })}
                  </Text>
                </div>
              </div>
            </div>
          </Col>
          <Col span={17}>
            <ChartContainer type="line" height={230}>
              <LineChart data={monitor?.history ?? []} margin={chartDefaults.margin}>
                <CartesianGrid {...chartDefaults.grid} stroke="#eef2f7" />
                <XAxis dataKey="date" interval={4} {...chartDefaults.axis} />
                <YAxis tickFormatter={(v: number) => formatBytesShort(v)} width={64} {...chartDefaults.axis} />
                <ChartTooltip {...chartDefaults.tooltip} formatter={(v: unknown) => formatBytes(Number(v))} labelFormatter={(l) => t("cloudStorage.monitor.datePrefix", { date: l })} />
                <Line type="monotone" dataKey="usedBytes" name={t("cloudStorage.monitor.usedCapacity")} stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <Tag color="geekblue" icon={<TrendingUp size={12} />}>{t("cloudStorage.monitor.growth30d", { rate: monitor?.growthRatePct30d ?? "—" })}</Tag>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small" title={<Space><Boxes size={15} />{t("cloudStorage.monitor.bucketUsage")}</Space>} style={{ height: "100%" }}>
            <ChartContainer type="bar" height={230}>
              <BarChart data={(monitor?.buckets ?? []).map((b) => ({ name: b.name, usedBytes: b.usedBytes, pct: b.percentOfTotal }))} margin={chartDefaults.margin}>
                <CartesianGrid {...chartDefaults.grid} stroke="#eef2f7" />
                <XAxis dataKey="name" interval={autoInterval((monitor?.buckets ?? []).length)} tickFormatter={(v: string) => (v && v.length > 8 ? `${v.slice(0, 8)}…` : v)} {...chartDefaults.axis} />
                <YAxis tickFormatter={(v: number) => formatBytesShort(v)} width={64} {...chartDefaults.axis} />
                <ChartTooltip {...chartDefaults.tooltip} formatter={(v: unknown, n: unknown) => [`${formatBytes(Number(v))}`, n === "pct" ? t("cloudStorage.monitor.pctShare") : t("cloudStorage.monitor.usedCapacity")]} />
                <Bar dataKey="usedBytes" name={t("cloudStorage.monitor.usedCapacity")} radius={[4, 4, 0, 0]}>
                  {(monitor?.buckets ?? []).map((b, i) => <Cell key={b.name} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
            {(monitor?.buckets ?? []).map((b) => (
              <Text type="secondary" key={b.name} style={{ fontSize: 11, marginRight: 12 }}>
                {b.name}: {b.percentOfTotal}%
              </Text>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <StatCardGrid minWidth={140} gap={12} style={{ marginBottom: 12 }}>
            <StatCard title={t("cloudStorage.monitor.ioRead")} value={monitor?.ioCounts.readPerMin ?? 0} precision={1} color="#0891b2" icon={<Eye size={14} />} />
            <StatCard title={t("cloudStorage.monitor.ioWrite")} value={monitor?.ioCounts.writePerMin ?? 0} precision={1} color="#10b981" icon={<UploadCloud size={14} />} />
            <StatCard title={t("cloudStorage.monitor.ioPut")} value={monitor?.ioCounts.putPerMin ?? 0} precision={1} color="#8b5cf6" icon={<Cloud size={14} />} />
            <StatCard title={t("cloudStorage.monitor.ioDelete")} value={monitor?.ioCounts.deletePerMin ?? 0} precision={1} color="error" icon={<Trash2 size={14} />} />
          </StatCardGrid>
          <Card
            size="small"
            loading={repLoading}
            title={
              <Space>
                <Repeat size={14} />{t("cloudStorage.monitor.repQueueTitle")}
                {monitor && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t("cloudStorage.monitor.queueDepth", { n: monitor.replication.pending + monitor.replication.running, size: formatBytes(monitor.replication.pendingBytes) })}
                  </Text>
                )}
              </Space>
            }
            extra={
              <Space size={4}>
                <Tag color="orange">{t("cloudStorage.monitor.repQueuedTag", { n: repStatus?.pending ?? 0 })}</Tag>
                <Tag color="blue">{t("cloudStorage.monitor.repRunningTag", { n: repStatus?.running ?? 0 })}</Tag>
                <Tag color="green">{t("cloudStorage.monitor.repCompletedTag", { n: repStatus?.completed ?? 0 })}</Tag>
                <Tag color="red">{t("cloudStorage.monitor.repFailedTag", { n: repStatus?.failed ?? 0 })}</Tag>
              </Space>
            }
          >
            {repStatus && repStatus.tasks.length > 0 ? (
              <Table
                size="small"
                rowKey="id"
                dataSource={repStatus.tasks.slice(0, 4)}
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: t("cloudStorage.monitor.thTask"), dataIndex: "id", key: "id", width: 90, render: (id: string) => <Text code>{id}</Text> },
                  { title: t("cloudStorage.monitor.thRoute"), key: "route", width: 210, render: (_: unknown, t: ReplicationTaskDto) => `${t.sourceBucket} → ${t.targetBucket} @ ${t.region}` },
                  { title: t("cloudStorage.monitor.thObjects"), key: "objs", width: 80, render: (_: unknown, t: ReplicationTaskDto) => `${t.objectsCopied}/${t.objectsTotal}` },
                  { title: t("cloudStorage.monitor.thProgress"), dataIndex: "progress", key: "progress", width: 110, render: (p: number, t: ReplicationTaskDto) => <Progress percent={p} size="small" status={t.status === "completed" ? "success" : "active"} /> },
                  { title: t("cloudStorage.monitor.thStatus"), dataIndex: "status", key: "status", width: 90, render: (s: string) => { const meta = REP_STATUS_META[s] ?? { color: "default" }; return <Tag color={meta.color}>{repStatusLabel(s)}</Tag>; } },
                ]}
              />
            ) : (
              <Alert type="info" showIcon icon={<Globe2 size={14} />} message={t("cloudStorage.monitor.noRepTasks")} />
            )}
          </Card>
        </Col>
      </Row>

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t("cloudStorage.monitor.totalObjects")} value={totalObjects} color="#0ea5e9" />
        <StatCard title={t("cloudStorage.monitor.totalCapacity")} value={(totalCapacity / 1024).toFixed(1)} color="#1e40af" />
        <StatCard
          title={t("cloudStorage.monitor.usedTb")}
          value={(totalUsed / 1024).toFixed(1)}
          suffix={`${usedPct.toFixed(1)}%`}
          color={capacityLevel === "critical" ? "error" : capacityLevel === "warn" ? "warning" : "success"}
          sub={capacityLevel !== "ok" ? (
            <Alert
              type={capacityLevel === "critical" ? "error" : "warning"}
              showIcon
              icon={<AlertCircle size={14} />}
              style={{ marginTop: 8, padding: "4px 8px" }}
              message={<span style={{ fontSize: 12 }}>{capacityLevel === "critical" ? t("cloudStorage.monitor.criticalMsg", { pct: criticalPct }) : t("cloudStorage.monitor.warnMsg", { pct: warnPct })}</span>}
            />
          ) : undefined}
        />
        <StatCard
          title={<Tooltip title={twentyFourH.derived ? t("cloudStorage.monitor.derivedTooltip") : t("cloudStorage.monitor.sampleTooltip")}><span>{t("cloudStorage.monitor.write24h")}</span></Tooltip>}
          prefix={twentyFourH.derived ? "≈ " : `${t("cloudStorage.monitor.samplePrefix")} `}
          value={formatBytes(twentyFourH.write)}
          color="#10b981"
        />
        <StatCard
          title={<Tooltip title={twentyFourH.derived ? t("cloudStorage.monitor.derivedTooltip") : t("cloudStorage.monitor.sampleTooltip")}><span>{t("cloudStorage.monitor.read24h")}</span></Tooltip>}
          prefix={twentyFourH.derived ? "≈ " : `${t("cloudStorage.monitor.samplePrefix")} `}
          value={formatBytes(twentyFourH.read)}
          color="#0891b2"
        />
        <StatCard title={t("cloudStorage.monitor.compressionSaved")} value={`${COMPRESSION.savedGb} GB`} color="#7c3aed" />
      </StatCardGrid>

      {/* [G005 v3.0.6.11-99 Wave 7A (G-28)] S3 驱动状态徽标 + 数据源徽标 */}
      <Card size="small" style={{ marginBottom: 16 }} title={<Space><ShieldCheck size={16} />{t("cloudStorage.monitor.driverStatusTitle")}</Space>}>
        <Space size={8} wrap>
          <Tag icon={<Cloud size={12} />} color={storageStats?.driver === "s3" ? "cyan" : "green"}>
            {storageStats?.driver === "s3" ? "S3 / MinIO" : t("cloudStorage.monitor.localStorage")}
          </Tag>
          {(() => {
            const meta: { color: string; descKey: string } =
              DRIVER_SOURCE_META[storageStats?.source ?? ""]
              ?? (storageStats?.driver === "s3" ? DRIVER_SOURCE_META["aws-sigv4-native"] : DRIVER_SOURCE_META["local-fs"])
              ?? { color: "default", descKey: "cloudStorage.monitor.sourceNotReported" };
            return (
              <Tooltip title={t(meta.descKey)}>
                <Tag color={meta.color} icon={storageStats?.source === "aws-sigv4-native" ? <CheckCircle size={12} /> : <HardDrive size={12} />}>
                  {driverSourceLabel(storageStats?.source === "aws-sigv4-native" ? "aws-sigv4-native" : storageStats?.source === "simulated" ? "simulated" : "local-fs")}
                </Tag>
              </Tooltip>
            );
          })()}
          <Tooltip title={storageStats?.source === "aws-sigv4-native" ? t("cloudStorage.monitor.realStatsTooltip") : t("cloudStorage.monitor.mockStatsTooltip")}>
            <Tag color={storageStats?.source === "aws-sigv4-native" ? "blue" : "orange"} icon={<Database size={12} />}>
              {t("cloudStorage.monitor.dataSource", { source: storageStats?.source === "aws-sigv4-native" ? t("cloudStorage.monitor.sourceReal") : storageStats ? t("cloudStorage.monitor.sourceMock") : t("cloudStorage.monitor.sourceSample") })}
            </Tag>
          </Tooltip>
          <Tooltip title={twentyFourH.derived ? t("cloudStorage.monitor.throughputTooltip") : t("cloudStorage.monitor.showSample")}>
            <Tag color={twentyFourH.derived ? "geekblue" : "default"} icon={<TrendingUp size={12} />}>
              {t("cloudStorage.monitor.throughput", { source: twentyFourH.derived ? t("cloudStorage.monitor.throughputDerived") : t("cloudStorage.monitor.samplePrefix") })}
            </Tag>
          </Tooltip>
          {storageStats?.latencyMs !== undefined && (
            <Tag color="purple" icon={<Activity size={12} />}>{t("cloudStorage.monitor.driverLatency", { ms: storageStats.latencyMs })}</Tag>
          )}
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title={<Space><HardDrive size={16} />{t("cloudStorage.monitor.nodesTitle", { n: nodes.length })}<Tag color="green">{t("cloudStorage.monitor.onlineTag", { n: nodes.filter(n => n.status === "online").length })}</Tag></Space>}>
            <Table scroll={{ x: 'max-content' }}
              dataSource={nodes}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: t("cloudStorage.monitor.thNode"), dataIndex: "name", key: "name", width: 220, render: (n: string, r: any) => (
                  <Space>
                    <Layers size={14} color={TIER_COLORS[r.tier]} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{r.vendor}</Text>
                    </div>
                  </Space>
                ) },
                { title: t("cloudStorage.monitor.thTier"), dataIndex: "tier", key: "tier", width: 80, render: (tier: string) => <Tag color={TIER_COLORS[tier]}>{tierLabel(tier)}</Tag> },
                { title: t("cloudStorage.monitor.thType"), dataIndex: "type", key: "type", width: 100, render: (t: string) => nodeTypeLabel(t) },
                { title: t("cloudStorage.monitor.thRegion"), dataIndex: "region", key: "region", width: 140 },
                { title: t("cloudStorage.monitor.thUsage"), key: "usage", width: 200, render: (_: any, r: any) => {
                  const pct = (r.usedGb / r.capacityGb) * 100;
                  return <Progress percent={pct} size="small" status={pct > 80 ? "exception" : "active"} format={(p) => `${(p ?? 0).toFixed(1)}%`} />;
                } },
                { title: t("cloudStorage.monitor.thOver"), key: "over", width: 90, render: (_: any, r: any) => {
                  const pct = (r.usedGb / r.capacityGb) * 100;
                  if (pct >= criticalPct) return <Tag color="red">{t("cloudStorage.monitor.levelCritical")}</Tag>;
                  if (pct >= warnPct) return <Tag color="orange">{t("cloudStorage.monitor.levelWarn")}</Tag>;
                  return <Tag>{t("cloudStorage.monitor.levelOk")}</Tag>;
                } },
                { title: t("cloudStorage.monitor.thObjectCount"), dataIndex: "objectsCount", key: "obj", width: 110, render: (n: number) => n.toLocaleString() },
                { title: t("cloudStorage.monitor.thReadLatency"), dataIndex: "readLatencyMs", key: "rl", width: 90, render: (n: number) => `${n} ms` },
                { title: t("cloudStorage.monitor.thWriteLatency"), dataIndex: "writeLatencyMs", key: "wl", width: 90, render: (n: number) => `${n} ms` },
                { title: t("cloudStorage.monitor.thStatus"), dataIndex: "status", key: "status", width: 100, render: (s: string) => <Tag color={STATUS_COLORS[s] ?? "gray"}>{statusLabel(s)}</Tag> },
              ]}
            
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><Archive size={16} />{t("cloudStorage.monitor.tieredStorage")}</Space>} style={{ marginBottom: 16 }}>
            {TIER_METRICS.map(m => (
              <div key={m.tier} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Space>
                    <div style={{ width: 10, height: 10, background: TIER_COLORS[m.tier], borderRadius: 2 }} />
                    <Text strong>{t("cloudStorage.monitor.tierLayer", { label: tierLabel(m.tier) })}</Text>
                  </Space>
                  <Text>{t("cloudStorage.monitor.objectsOf", { n: m.objects.toLocaleString(), size: (m.sizeGb / 1024).toFixed(1) })}</Text>
                </div>
                <Progress percent={m.pctOfTotal} showInfo={false} strokeColor={TIER_COLORS[m.tier]} />
                <Text type="secondary" style={{ fontSize: 11 }}>{t("cloudStorage.monitor.retention", { days: m.retentionDays, cost: m.monthlyCostUsd })}</Text>
              </div>
            ))}
          </Card>
          <Card title={<Space><TrendingUp size={16} />{t("cloudStorage.monitor.compressionTitle")}</Space>}>
            <Statistic title={t("cloudStorage.monitor.rawSize")} value={`${(COMPRESSION.rawBytes / 1e12).toFixed(2)} TB`} />
            <div style={{ marginTop: 8 }}>
              <Text>{t("cloudStorage.monitor.compressedAfter", { size: (COMPRESSION.compressedBytes / 1e12).toFixed(2) })}</Text>
            </div>
            <Progress percent={COMPRESSION.ratio * 100} strokeColor="#7c3aed" format={(p) => `${((p ?? 0) / 100).toFixed(2)}x`} />
            <Alert type="success" showIcon title={t("cloudStorage.monitor.savedSpace", { gb: COMPRESSION.savedGb })} style={{ marginTop: 8 }} />
          </Card>
        </Col>
      </Row>

      <Card title={<Space><Repeat size={16} />{t("cloudStorage.monitor.archiveJobs", { n: ARCHIVE_JOBS.length })}</Space>}>
        <Table scroll={{ x: 'max-content' }}
          dataSource={jobsPagination.pageData}
          rowKey="id"
          size="small"
          pagination={jobsPagination.pagination}
          columns={[
            { title: t("cloudStorage.monitor.thTask"), dataIndex: "id", key: "id", width: 110 },
            { title: t("cloudStorage.monitor.thType"), dataIndex: "type", key: "type", width: 110, render: (t: string) => { const jt = JOB_TYPE[t] ?? { color: "blue" }; return <Tag color={jt.color}>{jobTypeLabel(t)}</Tag> } },
            { title: t("cloudStorage.monitor.thSource"), dataIndex: "source", key: "src", width: 130 },
            { title: t("cloudStorage.monitor.thTarget"), dataIndex: "target", key: "dst", width: 130 },
            { title: t("cloudStorage.monitor.thObjectCount"), dataIndex: "objects", key: "o", width: 80 },
            { title: t("cloudStorage.monitor.thSize"), dataIndex: "bytes", key: "b", width: 100, render: (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB` },
            { title: t("cloudStorage.monitor.thStarted"), dataIndex: "startedAt", key: "s", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
            { title: t("cloudStorage.monitor.thDuration"), dataIndex: "duration", key: "d", width: 80, render: (d: number) => `${d}s` },
            { title: t("cloudStorage.monitor.thProgress"), dataIndex: "progress", key: "p", width: 140, render: (p: number) => <Progress percent={p} size="small" status={p === 100 ? "success" : "active"} /> },
            { title: t("cloudStorage.monitor.thStatus"), dataIndex: "status", key: "st", width: 90, render: (s: string) => <Tag color={JOB_STATUS[s]?.color}>{s === "success" ? t("cloudStorage.jobStatusSuccess") : s === "running" ? t("cloudStorage.jobStatusRunning") : s === "failed" ? t("cloudStorage.jobStatusFailed") : t("cloudStorage.jobStatusQueued")}</Tag> },
          ]}
       
        />
      </Card>
    </>
  );
}

// ─────────────────────────── 存储配置 (v3.0.6.11-60) ───────────────────────────

interface StorageConfigFormValues {
  driver: "local" | "s3";
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

function StorageConfigTab() {
  const [form] = Form.useForm<StorageConfigFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [stats, setStats] = useState<StorageStatsDto | null>(null);
  const [envDriver, setEnvDriver] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<StorageTestResponse | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await storageConfigApi.get();
    if (res.success && res.data) {
      const cfg = res.data.config;
      form.setFieldsValue({
        driver: cfg.driver,
        endpoint: cfg.endpoint ?? "http://localhost:9000",
        bucket: cfg.bucket ?? "",
        region: cfg.region ?? "us-east-1",
        accessKey: cfg.accessKey ?? "",
        secretKey: cfg.secretKey ?? "",
      });
      setStats(res.data.active);
      setEnvDriver(res.data.envDriver);
    } else {
      messageApi.error(res.error?.message ?? t("cloudStorage.config.loadFailed"));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const driver = Form.useWatch("driver", form);

  const onTest = async () => {
    const values = await form.validateFields();
    setTesting(true);
    setTestResult(null);
    const res = await storageConfigApi.test(values as StorageConfigDto);
    if (res.success && res.data) {
      setTestResult(res.data);
      if (res.data.status === "active") {
        messageApi.success(res.data.detail ?? t("cloudStorage.config.connSuccess"));
      } else {
        messageApi.warning(res.data.detail ?? t("cloudStorage.config.connFailed"));
      }
    } else {
      messageApi.error(res.error?.message ?? t("cloudStorage.config.testFailed"));
    }
    setTesting(false);
  };

  const onSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    const res = await storageConfigApi.save(values as StorageConfigDto);
    if (res.success && res.data) {
      messageApi.success(res.data.applied ? t("cloudStorage.config.savedApplied") : t("cloudStorage.config.savedEnvControlled"));
      void load();
    } else {
      messageApi.error(res.error?.message ?? t("cloudStorage.config.saveFailed"));
    }
    setSaving(false);
  };

  const driverLabel = driver === "s3" ? t("cloudStorage.config.driverS3") : t("cloudStorage.config.driverLocal");
  const activeColor = stats?.status === "active" ? "#16a34a" : "#dc2626";

  return (
    <>
      {contextHolder}
      <Row gutter={16}>
        <Col span={14}>
          <Card
            title={<Space><Settings size={16} />{t("cloudStorage.config.title")}<Text type="secondary" style={{ fontSize: 12 }}>{t("cloudStorage.config.benchmark")}</Text></Space>}
            extra={
              <Space>
                <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>{t("cloudStorage.refresh")}</Button>
                <Button type="primary" icon={<PlugZap size={14} />} onClick={() => void onTest()} loading={testing}>{t("cloudStorage.config.testConnection")}</Button>
                <Button icon={<Save size={14} />} onClick={() => void onSave()} loading={saving} disabled={testing}>{t("cloudStorage.config.saveConfig")}</Button>
              </Space>
            }
          >
            <Form form={form} layout="vertical" initialValues={{ driver: "local", endpoint: "http://localhost:9000", region: "us-east-1" }}>
              <Form.Item name="driver" label={t("cloudStorage.config.driverLabel")} rules={[{ required: true, message: t("cloudStorage.config.needDriver") }]}>
                <Radio.Group>
                  <Radio.Button value="local"><Database size={14} /> {t("cloudStorage.config.localRadio")}</Radio.Button>
                  <Radio.Button value="s3"><Cloud size={14} /> S3 / MinIO</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Alert
                type="info"
                showIcon
                icon={<AlertCircle size={14} />}
                style={{ marginBottom: 16 }}
                message={t("cloudStorage.config.currentChoice", { driver: driverLabel })}
                description={
                  driver === "s3"
                    ? t("cloudStorage.config.s3Desc")
                    : t("cloudStorage.config.localDesc")
                }
              />

              {driver === "s3" && (
                <>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="endpoint" label={t("cloudStorage.config.endpoint")} rules={[{ required: true, message: t("cloudStorage.config.endpointRequired") }]}>
                        <Input placeholder="http://localhost:9000" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="bucket" label={t("cloudStorage.config.bucket")} rules={[{ required: true, message: t("cloudStorage.config.bucketRequired") }]}>
                        <Input placeholder="g005" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="region" label={t("cloudStorage.config.region")} rules={[{ required: true, message: t("cloudStorage.config.regionRequired") }]}>
                        <Input placeholder="us-east-1" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="accessKey" label={t("cloudStorage.config.accessKey")} rules={[{ required: true, message: t("cloudStorage.config.accessKeyRequired") }]}>
                        <Input placeholder="minioadmin" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="secretKey" label={t("cloudStorage.config.secretKey")} rules={[{ required: true, message: t("cloudStorage.config.secretKeyRequired") }]}>
                        <Input.Password placeholder="••••••••" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}
            </Form>

            {testResult && (
              <Alert
                style={{ marginTop: 8 }}
                type={testResult.status === "active" ? "success" : "error"}
                showIcon
                icon={testResult.status === "active" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                message={testResult.detail ?? (testResult.status === "active" ? t("cloudStorage.config.connSuccess") : t("cloudStorage.config.connFailed"))}
                description={testResult.latencyMs !== undefined ? t("cloudStorage.config.latency", { ms: testResult.latencyMs }) : undefined}
              />
            )}
          </Card>
        </Col>

        <Col span={10}>
          <Card title={<Space><Activity size={16} />{t("cloudStorage.config.statsTitle")}</Space>} loading={loading}>
            <div style={{ marginBottom: 12 }}>
              <Space>
                <div style={{ width: 10, height: 10, background: activeColor, borderRadius: "50%" }} />
                <Text strong style={{ fontSize: 15 }}>
                  {t("cloudStorage.config.currentDriver", { driver: stats?.driver === "s3" ? "S3 / MinIO" : t("cloudStorage.monitor.localStorage") })}
                  <Tag color={stats?.status === "active" ? "green" : "red"} style={{ marginLeft: 8 }}>
                    {stats?.status === "active" ? t("cloudStorage.config.running") : t("cloudStorage.config.abnormal")}
                  </Tag>
                </Text>
              </Space>
            </div>
            {envDriver && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={t("cloudStorage.config.envDriverMsg", { env: envDriver })} />
            )}
            <StatCardGrid minWidth={140} gap={12} style={{ marginBottom: 12 }}>
              <StatCard title={t("cloudStorage.config.usedBytes")} value={formatBytes(stats?.usedBytes)} color="error" />
              <StatCard title={t("cloudStorage.config.objectCount")} value={stats?.objectCount ?? 0} color="#0ea5e9" />
            </StatCardGrid>
            {stats?.truncated && (
              <Alert type="info" showIcon message={t("cloudStorage.config.truncatedMsg")} style={{ marginBottom: 12 }} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Clock size={14} color="var(--text-secondary)" />
              <Text type="secondary" style={{ fontSize: 12 }}>{stats?.detail ?? t("cloudStorage.config.noStats")}</Text>
            </div>
            {stats?.latencyMs !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={14} color="var(--text-secondary)" />
                <Text type="secondary" style={{ fontSize: 12 }}>{t("cloudStorage.monitor.driverLatency", { ms: stats.latencyMs })}</Text>
              </div>
            )}
            <Alert type="success" showIcon icon={<CheckCircle size={14} />} style={{ marginTop: 12 }}
              message={t("cloudStorage.config.archiveReady")} description={t("cloudStorage.config.archiveReadyDesc")} />
          </Card>
        </Col>
      </Row>
    </>
  );
}

// ─────────────────────────── 桶管理 (G-28 v3.0.6.11-91) ───────────────────────────

const PROVIDER_LABELS: Record<string, { color: string }> = {
  s3: { color: "orange" },
  minio: { color: "geekblue" },
  local: { color: "green" },
};
const providerLabel = (p: string) => t(p === "s3" ? "cloudStorage.providerS3" : p === "minio" ? "cloudStorage.providerMinio" : "cloudStorage.providerLocal");

function objectIcon(key: string) {
  if (key.endsWith(".json")) return <FileJson size={14} />;
  if (key.endsWith(".pdf")) return <FileText size={14} />;
  if (key.endsWith(".png") || key.endsWith(".jpg") || key.endsWith(".dcm")) return <FileIcon size={14} />;
  return <Inbox size={14} />;
}

function BucketObjectsModal({
  bucket,
  buckets,
  visible,
  onClose,
  onChanged,
}: {
  bucket: StorageBucketDto | null;
  buckets: StorageBucketDto[];
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [objects, setObjects] = useState<StorageObjectDto[]>([]);
  const [loading, setLoading] = useState(false);
  // [v3.0.6.11-99 Wave8A P1] 对象表分页受控化 (usePagination)
  const { pageData: objectPageData, pagination: objectPagination } = usePagination(objects, 10);
  const [uploading, setUploading] = useState(false);
  // [G005 v3.0.6.11-99 Wave 7A (G-28)] 批量勾选 + 批量删除 / 单对象删除 / 复制到…
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [copyVisible, setCopyVisible] = useState(false);
  const [copyKey, setCopyKey] = useState<string | null>(null);
  const [copyTarget, setCopyTarget] = useState<string | undefined>(undefined);
  const [copying, setCopying] = useState(false);
  // [G005 v3.0.6.11-100 Wave 3B (G-28)] CDN 签名 URL
  const [signedUrlInfo, setSignedUrlInfo] = useState<SignedUrlDto | null>(null);
  const [signingKey, setSigningKey] = useState<string | null>(null);

  const load = async (name: string) => {
    setLoading(true);
    const res = await storageConfigApi.listBucketObjects(name);
    if (res.success && Array.isArray(res.data)) {
      setObjects(res.data);
      setSelectedKeys([]);
    } else message.error(res.error?.message ?? t("cloudStorage.objects.loadFailed"));
    setLoading(false);
  };

  useEffect(() => {
    if (visible && bucket) void load(bucket.name);
    else setObjects([]);
  }, [visible, bucket]);

  const download = async (obj: StorageObjectDto) => {
    if (!bucket) return;
    message.loading({ content: t("cloudStorage.objects.downloading", { key: obj.key }), key: "dl" });
    const res = await storageConfigApi.downloadObject(bucket.name, obj.key);
    if (res.success && res.data) {
      const d = res.data;
      const bytes = Uint8Array.from(atob(d.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: d.contentType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.filename || obj.key;
      a.click();
      URL.revokeObjectURL(url);
      message.success({ content: t("cloudStorage.objects.downloaded", { name: d.filename, size: formatBytes(d.size) }), key: "dl" });
    } else {
      message.error({ content: res.error?.message ?? t("cloudStorage.objects.downloadFailed"), key: "dl" });
    }
  };

  const deleteKeys = async (keys: string[]) => {
    if (!bucket || !keys.length) return;
    setBatchDeleting(true);
    const res = await storageConfigApi.batchDeleteObjects(bucket.name, keys);
    if (res.success && res.data) {
      message.success(t("cloudStorage.objects.deletedCount", { n: res.data.deleted.length }) + (res.data.missing.length ? `, ${t("cloudStorage.objects.missCount", { n: res.data.missing.length })}` : ""));
      void load(bucket.name);
      onChanged();
    } else {
      message.error(res.error?.message ?? t("cloudStorage.objects.batchDeleteFailed"));
    }
    setBatchDeleting(false);
  };

  const deleteOne = async (obj: StorageObjectDto) => {
    if (!bucket) return;
    setDeletingKey(obj.key);
    const res = await storageConfigApi.batchDeleteObjects(bucket.name, [obj.key]);
    if (res.success && res.data) {
      message.success(t("cloudStorage.objects.deletedKey", { key: obj.key }));
      void load(bucket.name);
      onChanged();
    } else {
      message.error(res.error?.message ?? t("cloudStorage.objects.deleteFailed"));
    }
    setDeletingKey(null);
  };

  const openCopy = (obj: StorageObjectDto) => {
    setCopyKey(obj.key);
    setCopyTarget(undefined);
    setCopyVisible(true);
  };

  const getSignedUrl = async (obj: StorageObjectDto) => {
    if (!bucket) return;
    setSigningKey(obj.key);
    const res = await storageConfigApi.signedUrl(bucket.name, obj.key, 3600);
    if (res.success && res.data) {
      setSignedUrlInfo(res.data);
    } else {
      message.error(res.error?.message ?? t("cloudStorage.objects.signUrlFailed"));
    }
    setSigningKey(null);
  };

  const copySignedUrl = async () => {
    if (!signedUrlInfo) return;
    try {
      await navigator.clipboard.writeText(signedUrlInfo.url);
      message.success(t("cloudStorage.objects.urlCopied"));
    } catch {
      message.error(t("cloudStorage.objects.copyFailedManual"));
    }
  };

  const doCopy = async () => {
    if (!bucket || !copyKey || !copyTarget) return;
    setCopying(true);
    const res = await storageConfigApi.copyObject(bucket.name, { key: copyKey, targetBucket: copyTarget });
    if (res.success && res.data) {
      message.success(t("cloudStorage.objects.copied", { key: copyKey, target: res.data.targetBucket, size: formatBytes(res.data.size) }));
      setCopyVisible(false);
      setCopyKey(null);
      void load(bucket.name);
      onChanged();
    } else {
      message.error(res.error?.message ?? t("cloudStorage.objects.copyFailed"));
    }
    setCopying(false);
  };

  const copyTargets = (buckets ?? []).filter((b) => b.name !== bucket?.name);

  return (
    <Modal
      title={
        <Space>
          <Boxes size={16} color="#0ea5e9" />
          {t("cloudStorage.objects.title", { bucket: bucket?.name, n: objects.length })}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={860}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={t("cloudStorage.objects.uploadInfo")}
      />
      <Space style={{ marginBottom: 12 }} wrap>
        <Upload
          accept="*"
          showUploadList={false}
          disabled={!bucket || uploading}
          beforeUpload={(file) => {
            if (!bucket) return false;
            setUploading(true);
            void storageConfigApi
              .uploadObject(bucket.name, { key: file.name, size: file.size })
              .then((res) => {
                if (res.success && res.data) {
                  message.success(t("cloudStorage.objects.uploadSuccess", { key: res.data.key, size: formatBytes(res.data.size) }));
                  void load(bucket.name);
                  onChanged();
                } else {
                  message.error(res.error?.message ?? t("cloudStorage.objects.uploadFailed"));
                }
              })
              .finally(() => setUploading(false));
            return false;
          }}
        >
          <Button type="primary" icon={<UploadCloud size={14} />} loading={uploading} disabled={!bucket}>
            {t("cloudStorage.objects.uploadObject")}
          </Button>
        </Upload>
        <Popconfirm
          title={t("cloudStorage.objects.confirmBatchDelete", { n: selectedKeys.length })}
          description={t("cloudStorage.objects.memoryDelete")}
          okText={t("cloudStorage.delete")}
          cancelText={t("cloudStorage.cancel")}
          disabled={selectedKeys.length === 0}
          onConfirm={() => void deleteKeys(selectedKeys as string[])}
        >
          <Button
            danger
            icon={<Trash2 size={14} />}
            disabled={selectedKeys.length === 0 || !bucket}
            loading={batchDeleting}
          >
            {t("cloudStorage.objects.batchDelete")}{selectedKeys.length ? ` (${selectedKeys.length})` : ""}
          </Button>
        </Popconfirm>
      </Space>
      <Table
        size="small"
        rowKey="key"
        loading={loading}
        dataSource={objectPageData}
        pagination={objectPagination}
        scroll={{ x: 'max-content' }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys),
        }}
        columns={[
          {
            title: t("cloudStorage.objects.thKey"),
            dataIndex: "key",
            key: "key",
            render: (k: string) => (
              <Space>
                {objectIcon(k)}
                <span style={{ fontWeight: 500 }}>{k}</span>
              </Space>
            ),
          },
          {
            title: t("cloudStorage.objects.thSize"),
            dataIndex: "size",
            key: "size",
            width: 120,
            render: (s: number) => formatBytes(s),
          },
          {
            title: t("cloudStorage.objects.thModified"),
            dataIndex: "modified",
            key: "modified",
            width: 180,
            render: (m: string) => new Date(m).toLocaleString("zh-CN"),
          },
          {
            title: t("cloudStorage.objects.thActions"),
            key: "action",
            width: 300,
            render: (_: unknown, obj: StorageObjectDto) => (
              <Space size={4}>
                <Button size="small" icon={<Download size={13} />} onClick={() => void download(obj)}>
                  {t("cloudStorage.objects.download")}
                </Button>
                <Tooltip title={t("cloudStorage.objects.signUrlTooltip")}>
                  <Button size="small" icon={<Link2 size={13} />} loading={signingKey === obj.key} onClick={() => void getSignedUrl(obj)}>
                    {t("cloudStorage.objects.signUrl")}
                  </Button>
                </Tooltip>
                <Button size="small" icon={<CopyIcon size={13} />} disabled={copyTargets.length === 0} onClick={() => openCopy(obj)}>
                  {t("cloudStorage.objects.copyTo")}
                </Button>
                <Popconfirm
                  title={t("cloudStorage.objects.confirmDeleteObject", { key: obj.key })}
                  okText={t("cloudStorage.delete")}
                  cancelText={t("cloudStorage.cancel")}
                  onConfirm={() => void deleteOne(obj)}
                >
                  <Button size="small" danger icon={<Trash2 size={13} />} loading={deletingKey === obj.key}>
                    {t("cloudStorage.delete")}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={<Space><CopyIcon size={16} color="#0ea5e9" />{t("cloudStorage.objects.copyModalTitle")}</Space>}
        open={copyVisible}
        onCancel={() => setCopyVisible(false)}
        onOk={() => void doCopy()}
        confirmLoading={copying}
        okText={t("cloudStorage.objects.copy")}
        cancelText={t("cloudStorage.cancel")}
        destroyOnHidden
      >
        <div style={{ marginBottom: 8 }}>
          <Text strong>{t("cloudStorage.objects.objectLabel", { key: copyKey })}</Text>
        </div>
        <Select
          style={{ width: "100%" }}
          placeholder={t("cloudStorage.objects.selectTarget")}
          value={copyTarget}
          onChange={setCopyTarget}
          options={copyTargets.map((b) => ({ value: b.name, label: `${b.name} (${providerLabel(b.provider)})` }))}
        />
        {copyTarget && (
          <Alert type="info" showIcon style={{ marginTop: 8 }} message={t("cloudStorage.objects.copyInfo", { key: copyKey, target: copyTarget })} />
        )}
      </Modal>

      {/* [G005 v3.0.6.11-100 Wave 3B (G-28)] CDN 签名 URL 弹窗 */}
      <Modal
        title={<Space><Link2 size={16} color="#0ea5e9" />{t("cloudStorage.objects.cdnTitle")}</Space>}
        open={!!signedUrlInfo}
        onCancel={() => setSignedUrlInfo(null)}
        footer={[
          <Button key="copy" type="primary" icon={<ClipboardCopy size={14} />} onClick={() => void copySignedUrl()}>{t("cloudStorage.objects.copyUrl")}</Button>,
          <Button key="close" onClick={() => setSignedUrlInfo(null)}>{t("cloudStorage.objects.close")}</Button>,
        ]}
        width={640}
        destroyOnHidden
      >
        {signedUrlInfo && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={t("cloudStorage.objects.objectLabel", { key: `${signedUrlInfo.bucket}/${signedUrlInfo.key}` })}
              description={
                <Space size={6} wrap>
                  <Tag color={signedUrlInfo.source === "aws-sigv4-native" ? "geekblue" : "gold"}>
                    {signedUrlInfo.source === "aws-sigv4-native" ? t("cloudStorage.objects.sigv4Presigned") : t("cloudStorage.objects.localSim")}
                  </Tag>
                  <Tag color="purple">{t("cloudStorage.objects.expiresIn", { sec: signedUrlInfo.expiresInSec })}</Tag>
                  <Tag color="orange">{t("cloudStorage.objects.expiresAt", { time: new Date(signedUrlInfo.expiresAt).toLocaleString("zh-CN") })}</Tag>
                </Space>
              }
            />
            <Input.TextArea value={signedUrlInfo.url} readOnly autoSize={{ minRows: 3, maxRows: 6 }} style={{ fontSize: 12, wordBreak: "break-all" }} />
          </>
        )}
      </Modal>
    </Modal>
  );
}

function StorageBucketsTab() {
  const [buckets, setBuckets] = useState<StorageBucketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ name: string; provider: BucketProvider; region: string }>();
  const [createVisible, setCreateVisible] = useState(false);
  const [objectsVisible, setObjectsVisible] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<StorageBucketDto | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制任务 (Modal + 状态追踪)
  const [replicateVisible, setReplicateVisible] = useState(false);
  const [replicateSrc, setReplicateSrc] = useState<StorageBucketDto | null>(null);
  const [replicateTarget, setReplicateTarget] = useState<string | undefined>(undefined);
  const [replicateRegion, setReplicateRegion] = useState<string>("us-east-1");
  const [replicating, setReplicating] = useState(false);
  const [repTask, setRepTask] = useState<ReplicationTaskDto | null>(null);
  const [repTasks, setRepTasks] = useState<ReplicationTaskDto[]>([]);
  const [repPolling, setRepPolling] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await storageConfigApi.listBuckets();
    if (res.success && Array.isArray(res.data)) setBuckets(res.data);
    else message.error(res.error?.message ?? t("cloudStorage.buckets.loadFailed"));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const totalObjects = useMemo(() => buckets.reduce((s, b) => s + b.objectCount, 0), [buckets]);
  const totalBytes = useMemo(() => buckets.reduce((s, b) => s + b.usedBytes, 0), [buckets]);

  const onCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const res = await storageConfigApi.createBucket({
        name: values.name.trim(),
        provider: values.provider ?? "s3",
        region: values.region.trim() || "us-east-1",
      });
      if (res.success && res.data) {
        message.success(t("cloudStorage.buckets.created", { name: res.data.name, provider: providerLabel(res.data.provider), region: res.data.region }));
        setCreateVisible(false);
        createForm.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? t("cloudStorage.buckets.createFailed"));
      }
    } catch {
      /* 校验失败忽略 */
    }
    setCreating(false);
  };

  const onDelete = async (bucket: StorageBucketDto) => {
    setDeleting(bucket.name);
    const res = await storageConfigApi.deleteBucket(bucket.name);
    if (res.success) {
      message.success(t("cloudStorage.buckets.deleted", { name: bucket.name }));
      void load();
    } else {
      message.error(res.error?.message ?? t("cloudStorage.buckets.deleteFailed"));
    }
    setDeleting(null);
  };

  const openObjects = (bucket: StorageBucketDto) => {
    setSelectedBucket(bucket);
    setObjectsVisible(true);
  };

  // [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制: Modal 提交 + 状态追踪轮询
  const openReplicate = (bucket: StorageBucketDto) => {
    setReplicateSrc(bucket);
    setReplicateTarget(undefined);
    setReplicateRegion("us-east-1");
    setRepTask(null);
    setReplicateVisible(true);
  };

  const pollRepStatus = async () => {
    setRepPolling(true);
    const res = await storageConfigApi.replicationStatus();
    if (res.success && res.data) setRepTasks(res.data.tasks);
    setRepPolling(false);
  };

  const doReplicate = async () => {
    if (!replicateSrc || !replicateTarget) return;
    setReplicating(true);
    setRepTask(null);
    const res = await storageConfigApi.replicateBucket(replicateSrc.name, {
      targetBucket: replicateTarget,
      region: replicateRegion.trim() || "us-east-1",
    });
    if (res.success && res.data) {
      message.success(t("cloudStorage.buckets.repTaskCreated", { id: res.data.id, src: res.data.sourceBucket, dst: res.data.targetBucket, region: res.data.region }));
      setRepTask(res.data);
      await pollRepStatus();
      void load();
    } else {
      message.error(res.error?.message ?? t("cloudStorage.buckets.repTaskFailed"));
    }
    setReplicating(false);
  };

  const repTargets = (buckets ?? []).filter((b) => b.name !== replicateSrc?.name);

  return (
    <>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t("cloudStorage.buckets.count")} value={buckets.length} color="#0ea5e9" icon={<Boxes size={14} />} />
        <StatCard title={t("cloudStorage.buckets.totalObjects")} value={totalObjects.toLocaleString()} color="#0891b2" icon={<Inbox size={14} />} />
        <StatCard title={t("cloudStorage.buckets.usedBytes")} value={formatBytes(totalBytes)} color="error" icon={<HardDrive size={14} />} />
      </StatCardGrid>

      <Card
        title={<Space><Boxes size={16} />{t("cloudStorage.buckets.title")} <Text type="secondary" style={{ fontSize: 12 }}>{t("cloudStorage.buckets.sub")}</Text><Tag color="gold" icon={<Database size={12} />}>{t("cloudStorage.buckets.dataSourceTag")}</Tag></Space>}
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>{t("cloudStorage.refresh")}</Button>
            <Button type="primary" icon={<FolderPlus size={14} />} onClick={() => setCreateVisible(true)}>{t("cloudStorage.buckets.newBucket")}</Button>
          </Space>
        }
      >
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="name"
          loading={loading}
          dataSource={buckets}
          size="small"
          pagination={false}
          columns={[
            {
              title: t("cloudStorage.buckets.thName"),
              dataIndex: "name",
              key: "name",
              width: 200,
              render: (n: string, r: StorageBucketDto) => (
                <Space>
                  <Cloud size={14} color={r.provider === "local" ? "#22c55e" : "#0ea5e9"} />
                  <span style={{ fontWeight: 600 }}>{n}</span>
                </Space>
              ),
            },
            {
              title: t("cloudStorage.buckets.thProvider"),
              dataIndex: "provider",
              key: "provider",
              width: 120,
              render: (p: BucketProvider) => {
                const cfg = PROVIDER_LABELS[p] ?? { color: "default" };
                return <Tag color={cfg.color}>{providerLabel(p)}</Tag>;
              },
            },
            {
              title: t("cloudStorage.buckets.thTenant"),
              dataIndex: "tenantId",
              key: "tenantId",
              width: 130,
              render: (tenantId: string) => (
                <Tooltip title={t("cloudStorage.buckets.tenantTooltip")}>
                  <Tag color={tenantId === "default" ? "default" : "volcano"} icon={<ShieldCheck size={12} />}>
                    {tenantId === "default" ? t("cloudStorage.buckets.defaultTenant") : tenantId}
                  </Tag>
                </Tooltip>
              ),
            },
            { title: t("cloudStorage.buckets.thRegion"), dataIndex: "region", key: "region", width: 140 },
            {
              title: t("cloudStorage.buckets.thObjectCount"),
              dataIndex: "objectCount",
              key: "objectCount",
              width: 100,
              render: (n: number) => n.toLocaleString(),
            },
            {
              title: t("cloudStorage.buckets.thUsed"),
              dataIndex: "usedBytes",
              key: "usedBytes",
              width: 120,
              render: (b: number) => formatBytes(b),
            },
            {
              title: t("cloudStorage.buckets.thCreatedAt"),
              dataIndex: "createdAt",
              key: "createdAt",
              width: 170,
              render: (c: string) => new Date(c).toLocaleString("zh-CN"),
            },
            {
              title: t("cloudStorage.buckets.thActions"),
              key: "action",
              width: 240,
              render: (_: unknown, r: StorageBucketDto) => (
                <Space size={4}>
                  <Tooltip title={t("cloudStorage.buckets.objectsTooltip")}>
                    <Button size="small" icon={<Eye size={13} />} onClick={() => openObjects(r)}>{t("cloudStorage.buckets.objects")}</Button>
                  </Tooltip>
                  <Tooltip title={t("cloudStorage.buckets.replicateTooltip")}>
                    <Button size="small" icon={<Globe2 size={13} />} disabled={r.objectCount === 0} onClick={() => openReplicate(r)}>{t("cloudStorage.buckets.replicateToRegion")}</Button>
                  </Tooltip>
                  <Popconfirm
                    title={t("cloudStorage.buckets.confirmDeleteBucket", { name: r.name })}
                    description={t("cloudStorage.buckets.deleteBucketDesc")}
                    okText={t("cloudStorage.delete")}
                    cancelText={t("cloudStorage.cancel")}
                    onConfirm={() => void onDelete(r)}
                  >
                    <Button size="small" danger icon={<Trash2 size={13} />} loading={deleting === r.name}>{t("cloudStorage.delete")}</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={<Space><FolderPlus size={16} color="#0ea5e9" />{t("cloudStorage.buckets.createTitle")}</Space>}
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => void onCreate()}
        confirmLoading={creating}
        okText={t("cloudStorage.buckets.create")}
        cancelText={t("cloudStorage.cancel")}
      >
        <Form form={createForm} layout="vertical" initialValues={{ provider: "s3", region: "us-east-1" }} style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label={t("cloudStorage.buckets.thName")}
            rules={[
              { required: true, message: t("cloudStorage.buckets.nameRequired") },
              { pattern: /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i, message: t("cloudStorage.buckets.namePattern") },
              { max: 63, message: t("cloudStorage.buckets.maxLength") },
            ]}
          >
            <Input placeholder="g005-backup" prefix={<Cloud size={13} />} />
          </Form.Item>
          <Form.Item name="provider" label={t("cloudStorage.buckets.thProvider")} rules={[{ required: true, message: t("cloudStorage.buckets.needProvider") }]}>
            <Select
              options={[
                { value: "s3", label: t("cloudStorage.providerS3") },
                { value: "minio", label: t("cloudStorage.providerMinio") },
                { value: "local", label: t("cloudStorage.config.driverLocal") },
              ]}
            />
          </Form.Item>
          <Form.Item name="region" label={t("cloudStorage.buckets.regionLabel")} rules={[{ required: true, message: t("cloudStorage.buckets.regionRequired") }]}>
            <Input placeholder="us-east-1 / cn-north-1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制任务 Modal + 状态追踪 */}
      <Modal
        title={<Space><Globe2 size={16} color="#0ea5e9" />{t("cloudStorage.buckets.replicateTitle", { name: replicateSrc?.name })}</Space>}
        open={replicateVisible}
        onCancel={() => setReplicateVisible(false)}
        onOk={() => void doReplicate()}
        confirmLoading={replicating}
        okText={t("cloudStorage.buckets.createRepTask")}
        cancelText={t("cloudStorage.cancel")}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("cloudStorage.buckets.replicateInfo", { name: replicateSrc?.name, count: replicateSrc?.objectCount ?? 0, size: formatBytes(replicateSrc?.usedBytes) })}
        />
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ display: "block", marginBottom: 6 }}>{t("cloudStorage.buckets.targetBucket")}</Text>
          <Select
            style={{ width: "100%" }}
            placeholder={t("cloudStorage.buckets.selectTargetHint")}
            value={replicateTarget}
            onChange={setReplicateTarget}
            options={repTargets.map((b) => ({ value: b.name, label: `${b.name} (${providerLabel(b.provider)} / ${b.region})` }))}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ display: "block", marginBottom: 6 }}>{t("cloudStorage.buckets.targetRegion")}</Text>
          <Select
            style={{ width: "100%" }}
            value={replicateRegion}
            onChange={setReplicateRegion}
            options={[
              { value: "us-east-1", label: t("cloudStorage.buckets.regionUsEast1") },
              { value: "us-west-2", label: t("cloudStorage.buckets.regionUsWest2") },
              { value: "eu-west-1", label: t("cloudStorage.buckets.regionEuWest1") },
              { value: "ap-southeast-1", label: t("cloudStorage.buckets.regionApSoutheast1") },
              { value: "cn-north-1", label: t("cloudStorage.buckets.regionCnNorth1") },
            ]}
          />
        </div>
        {repTask && (
          <Alert
            type={repTask.status === "completed" ? "success" : repTask.status === "failed" ? "error" : "info"}
            showIcon
            message={
              <Space wrap>
                <Text code>{repTask.id}</Text>
                <Tag color={REP_STATUS_META[repTask.status]?.color}>{repStatusLabel(repTask.status)}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t("cloudStorage.buckets.repProgress", { copied: repTask.objectsCopied, total: repTask.objectsTotal, bytes: formatBytes(repTask.bytesCopied), region: repTask.region })}
                </Text>
              </Space>
            }
            description={repTask.status === "completed" ? t("cloudStorage.buckets.repDoneDesc") : t("cloudStorage.buckets.repQueuedDesc")}
          />
        )}
        {repTasks.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Space style={{ marginBottom: 6 }}>
              <Text strong style={{ fontSize: 13 }}>{t("cloudStorage.buckets.recentRepTasks")}</Text>
              {repPolling && <Tag color="blue">{t("cloudStorage.buckets.refreshing")}</Tag>}
            </Space>
            <Table
              size="small"
              rowKey="id"
              dataSource={repTasks.slice(0, 4)}
              pagination={false}
              columns={[
                { title: t("cloudStorage.monitor.thTask"), dataIndex: "id", key: "id", width: 100, render: (id: string) => <Text code>{id}</Text> },
                { title: t("cloudStorage.buckets.thRoute"), key: "route", render: (_: unknown, t: ReplicationTaskDto) => `${t.sourceBucket} → ${t.targetBucket}` },
                { title: t("cloudStorage.buckets.thRegion"), dataIndex: "region", key: "region", width: 110 },
                { title: t("cloudStorage.monitor.thStatus"), dataIndex: "status", key: "status", width: 90, render: (s: string) => <Tag color={REP_STATUS_META[s]?.color}>{repStatusLabel(s)}</Tag> },
              ]}
            />
          </div>
        )}
      </Modal>

      <BucketObjectsModal bucket={selectedBucket} buckets={buckets} visible={objectsVisible} onClose={() => setObjectsVisible(false)} onChanged={() => void load()} />
    </>
  );
}

// ─────────────────────────── 生命周期策略 (G-28 v3.0.6.11-99) ───────────────────────────

function LifecyclePoliciesTab() {
  const [policies, setPolicies] = useState<LifecyclePolicyDto[]>([]);
  const [buckets, setBuckets] = useState<StorageBucketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<LifecyclePolicyDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [form] = Form.useForm<LifecyclePolicyInput>();

  const load = async () => {
    setLoading(true);
    const [pRes, bRes] = await Promise.all([
      storageConfigApi.listLifecyclePolicies(),
      storageConfigApi.listBuckets(),
    ]);
    if (pRes.success && Array.isArray(pRes.data)) setPolicies(pRes.data);
    else message.error(pRes.error?.message ?? t("cloudStorage.lifecycle.loadFailed"));
    if (bRes.success && Array.isArray(bRes.data)) setBuckets(bRes.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ transitionTo: "tier2", afterDays: 90, enabled: true });
    setModalVisible(true);
  };

  const openEdit = (p: LifecyclePolicyDto) => {
    setEditing(p);
    form.setFieldsValue({
      bucket: p.bucket,
      prefix: p.prefix,
      transitionTo: p.transitionTo,
      afterDays: p.afterDays,
      deleteAfterDays: p.deleteAfterDays ?? null,
      enabled: p.enabled,
    });
    setModalVisible(true);
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: LifecyclePolicyInput = {
        bucket: values.bucket,
        prefix: values.prefix ?? "",
        transitionTo: values.transitionTo,
        afterDays: values.afterDays,
        deleteAfterDays: values.deleteAfterDays ?? null,
        enabled: values.enabled ?? true,
      };
      if (payload.deleteAfterDays !== null && payload.deleteAfterDays !== undefined && payload.deleteAfterDays < payload.afterDays) {
        message.error(t("cloudStorage.lifecycle.deleteDaysRule"));
        setSaving(false);
        return;
      }
      const res = editing
        ? await storageConfigApi.updateLifecyclePolicy(editing.id, payload)
        : await storageConfigApi.createLifecyclePolicy(payload);
      if (res.success && res.data) {
        message.success(editing ? t("cloudStorage.lifecycle.updated", { id: res.data.id }) : t("cloudStorage.lifecycle.created", { id: res.data.id }));
        setModalVisible(false);
        void load();
      } else {
        message.error(res.error?.message ?? (editing ? t("cloudStorage.lifecycle.updateFailed") : t("cloudStorage.lifecycle.createFailed")));
      }
    } catch {
      /* 校验失败忽略 */
    }
    setSaving(false);
  };

  const onDelete = async (p: LifecyclePolicyDto) => {
    setDeleting(p.id);
    const res = await storageConfigApi.deleteLifecyclePolicy(p.id);
    if (res.success) {
      message.success(t("cloudStorage.lifecycle.deleted", { id: p.id }));
      void load();
    } else {
      message.error(res.error?.message ?? t("cloudStorage.lifecycle.deleteFailed"));
    }
    setDeleting(null);
  };

  const toggleEnabled = async (p: LifecyclePolicyDto, enabled: boolean) => {
    setToggling(p.id);
    const res = await storageConfigApi.updateLifecyclePolicy(p.id, { enabled });
    if (res.success && res.data) {
      message.success(enabled ? t("cloudStorage.lifecycle.toggledOn", { id: p.id }) : t("cloudStorage.lifecycle.toggledOff", { id: p.id }));
      setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, enabled: res.data!.enabled } : x)));
    } else {
      message.error(res.error?.message ?? t("cloudStorage.lifecycle.toggleFailed"));
    }
    setToggling(null);
  };

  const bucketNames = buckets.map((b) => b.name);

  return (
    <>
      <Card
        size="small"
        title={<Space><CalendarClock size={16} />{t("cloudStorage.lifecycle.title")}<Text type="secondary" style={{ fontSize: 12 }}>{t("cloudStorage.lifecycle.sub")}</Text></Space>}
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>{t("cloudStorage.refresh")}</Button>
            <Button type="primary" icon={<FolderPlus size={14} />} onClick={openCreate}>{t("cloudStorage.lifecycle.newPolicy")}</Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          loading={loading}
          dataSource={policies}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          columns={[
            {
              title: t("cloudStorage.lifecycle.thId"),
              dataIndex: "id",
              key: "id",
              width: 110,
              render: (id: string) => <Text code>{id}</Text>,
            },
            {
              title: t("cloudStorage.lifecycle.thBucket"),
              dataIndex: "bucket",
              key: "bucket",
              width: 180,
              render: (b: string) => (
                <Space>
                  <Cloud size={13} color="#0ea5e9" />
                  <span style={{ fontWeight: 600 }}>{b}</span>
                </Space>
              ),
            },
            {
              title: t("cloudStorage.lifecycle.thPrefix"),
              dataIndex: "prefix",
              key: "prefix",
              width: 180,
              render: (p: string) => (p ? <Tag>{p}</Tag> : <Tag color="default">{t("cloudStorage.lifecycle.allPrefix")}</Tag>),
            },
            {
              title: t("cloudStorage.lifecycle.thTransitionTier"),
              dataIndex: "transitionTo",
              key: "transitionTo",
              width: 120,
              render: (t: LifecycleTransitionTier) => {
                const meta = TIER_TRANSITION_META[t] ?? { color: "default" };
                return <Tag color={meta.color}>{transitionLabel(t)}</Tag>;
              },
            },
            {
              title: t("cloudStorage.lifecycle.thTransitionDays"),
              dataIndex: "afterDays",
              key: "afterDays",
              width: 110,
              render: (d: number) => t("cloudStorage.lifecycle.days", { d }),
            },
            {
              title: t("cloudStorage.lifecycle.thDeleteDays"),
              dataIndex: "deleteAfterDays",
              key: "deleteAfterDays",
              width: 110,
              render: (d?: number) => (d !== undefined && d !== null ? t("cloudStorage.lifecycle.days", { d }) : <Text type="secondary">—</Text>),
            },
            {
              title: t("cloudStorage.lifecycle.thEnabled"),
              dataIndex: "enabled",
              key: "enabled",
              width: 100,
              render: (enabled: boolean, p: LifecyclePolicyDto) => (
                <Switch size="small" checked={enabled} loading={toggling === p.id} onChange={(v) => void toggleEnabled(p, v)} />
              ),
            },
            {
              title: t("cloudStorage.lifecycle.thTenant"),
              dataIndex: "tenantId",
              key: "tenantId",
              width: 130,
              render: (tenantId: string) => (
                <Tag color={tenantId === "default" ? "default" : "volcano"} icon={<ShieldCheck size={12} />}>
                  {tenantId === "default" ? t("cloudStorage.buckets.defaultTenant") : tenantId}
                </Tag>
              ),
            },
            {
              title: t("cloudStorage.lifecycle.thUpdatedAt"),
              dataIndex: "updatedAt",
              key: "updatedAt",
              width: 170,
              render: (u: string) => new Date(u).toLocaleString("zh-CN"),
            },
            {
              title: t("cloudStorage.lifecycle.thActions"),
              key: "action",
              width: 130,
              render: (_: unknown, p: LifecyclePolicyDto) => (
                <Space size={4}>
                  <Button size="small" icon={<Settings size={13} />} onClick={() => openEdit(p)}>{t("cloudStorage.lifecycle.edit")}</Button>
                  <Popconfirm
                    title={t("cloudStorage.lifecycle.confirmDelete", { id: p.id })}
                    okText={t("cloudStorage.delete")}
                    cancelText={t("cloudStorage.cancel")}
                    onConfirm={() => void onDelete(p)}
                  >
                    <Button size="small" danger icon={<Trash2 size={13} />} loading={deleting === p.id}>{t("cloudStorage.delete")}</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={<Space><CalendarClock size={16} color="#0ea5e9" />{editing ? t("cloudStorage.lifecycle.editTitle", { id: editing.id }) : t("cloudStorage.lifecycle.createTitle")}</Space>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => void onSubmit()}
        confirmLoading={saving}
        okText={editing ? t("cloudStorage.lifecycle.save") : t("cloudStorage.lifecycle.create")}
        cancelText={t("cloudStorage.cancel")}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="bucket" label={t("cloudStorage.lifecycle.thBucket")} rules={[{ required: true, message: t("cloudStorage.lifecycle.needBucket") }]}>
            <Select
              placeholder={t("cloudStorage.lifecycle.selectBucketPlaceholder")}
              disabled={!!editing}
              options={bucketNames.map((n) => ({ value: n, label: n }))}
            />
          </Form.Item>
          <Form.Item name="prefix" label={t("cloudStorage.lifecycle.objectPrefix")} tooltip={t("cloudStorage.lifecycle.prefixTooltip")}>
            <Input placeholder={t("cloudStorage.lifecycle.prefixPlaceholder")} prefix={<Inbox size={13} />} />
          </Form.Item>
          <Form.Item name="transitionTo" label={t("cloudStorage.lifecycle.thTransitionTier")} rules={[{ required: true, message: t("cloudStorage.lifecycle.needTier") }]}>
            <Select
              options={Object.keys(TIER_TRANSITION_META).map((value) => ({ value, label: transitionLabel(value) }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="afterDays" label={t("cloudStorage.lifecycle.afterDaysLabel")} rules={[{ required: true, message: t("cloudStorage.required") }]}>
                <InputNumber min={1} max={3650} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deleteAfterDays" label={t("cloudStorage.lifecycle.deleteAfterDaysLabel")} tooltip={t("cloudStorage.lifecycle.deleteAfterTooltip")}>
                <InputNumber min={1} max={36500} style={{ width: "100%" }} placeholder={t("cloudStorage.lifecycle.noDelete")} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="enabled" label={t("cloudStorage.lifecycle.enabledLabel")} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ─────────────────────────── 页面 ───────────────────────────

export default function CloudStorageDashboardPage() {
  return (
    <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
      <Card style={{ background: "linear-gradient(135deg,#0ea5e9 0%,#06b6d4 100%)", color: "#fff", border: "none", marginBottom: 16 }}>
        <Space size={16}>
          <Cloud size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{t("cloudStorage.pageTitle")}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {t("cloudStorage.pageSub")}
            </div>
          </div>
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="monitor"
        items={[
          {
            key: "monitor",
            label: <Space><FileArchive size={14} />{t("cloudStorage.tabMonitor")}</Space>,
            children: <StorageMonitorTab />,
          },
          {
            key: "config",
            label: <Space><Settings size={14} />{t("cloudStorage.tabConfig")}</Space>,
            children: <StorageConfigTab />,
          },
          {
            key: "buckets",
            label: <Space><Boxes size={14} />{t("cloudStorage.tabBuckets")}</Space>,
            children: <StorageBucketsTab />,
          },
          {
            key: "lifecycle",
            label: <Space><CalendarClock size={14} />{t("cloudStorage.tabLifecycle")}</Space>,
            children: <LifecyclePoliciesTab />,
          },
        ]}
      />
    </div>
  );
}

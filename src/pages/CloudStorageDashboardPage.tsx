/**
 * Cloud Storage & Archiving Dashboard
 * v3.0.6.11-60: 增加「存储配置」页签 — 驱动选择 (本地/S3) + 配置表单 + 连接测试 + 存储统计
 */
import { useEffect, useMemo, useState } from "react";
import {
  Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Typography, Space, Alert,
  Radio, Form, Input, Button, message, InputNumber, Select, Modal, Upload, Tooltip, Popconfirm,
} from "antd";
import {
  Cloud, Database, Archive, HardDrive, Layers, Activity, Clock, TrendingUp, AlertCircle,
  CheckCircle, FileArchive, Repeat, Settings, PlugZap, Save, RefreshCw, BellRing,
  FolderPlus, Boxes, UploadCloud, Download, Eye, Trash2, FileJson, FileText, File as FileIcon, Inbox,
} from "lucide-react";
import { STORAGE_NODES, TIER_METRICS, ARCHIVE_JOBS, COMPRESSION } from "../services/storage";
import { usePagination } from "../hooks/usePagination";
import {
  storageConfigApi,
  type StorageConfigDto,
  type StorageStatsDto,
  type StorageTestResponse,
  type StorageAlertsConfig,
  type StorageBucketDto,
  type StorageObjectDto,
  type BucketProvider,
} from "../services/api/storageConfigApi";

const { Text } = Typography;

const NOTIFY_CHANNEL_LABELS: Record<string, string> = {
  email: "邮件",
  sms: "短信",
  wechat: "企业微信",
  dingtalk: "钉钉",
  app: "站内信",
};

const TIER_COLORS: Record<string, string> = { hot: "#dc2626", warm: "#f59e0b", cold: "#3b82f6" };
const TIER_LABELS: Record<string, string> = { hot: "热存", warm: "温存", cold: "冷归档" };
const NODE_TYPE_LABELS: Record<string, string> = { primary: "主存储", tier2: "二级", archive: "归档", backup: "备份" };

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

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let v = bytes;
  let i = -1;
  do { v /= 1024; i += 1; } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(2)} ${units[i]}`;
}

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

  const saveAlertsConfig = async () => {
    try {
      const values = await alertsForm.validateFields();
      setAlertsSaving(true);
      const res = await storageConfigApi.saveAlertsConfig(values);
      if (res.success && res.data) {
        setAlertsConfig(res.data);
        message.success(`容量预警配置已保存: 警告 ${res.data.warnPercent}% / 严重 ${res.data.criticalPercent}%`);
      } else {
        message.error(res.error?.message ?? "容量预警配置保存失败");
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
        title={<Space><BellRing size={16} />容量预警配置<Text type="secondary" style={{ fontSize: 12 }}>警告/严重阈值 · 超限通知渠道 (内存 + 环境 seed 回退)</Text></Space>}
        extra={<Button size="small" type="primary" icon={<Save size={14} />} loading={alertsSaving} onClick={() => void saveAlertsConfig()}>保存</Button>}
        style={{ marginBottom: 16 }}
        loading={alertsLoading}
      >
        <Form form={alertsForm} layout="inline" initialValues={{ warnPercent: 80, criticalPercent: 90, notifyChannels: ["email", "sms"] }}>
          <Form.Item name="warnPercent" label="警告阈值 (%)" rules={[{ required: true, message: "必填" }]}>
            <InputNumber min={1} max={100} style={{ width: 90 }} />
          </Form.Item>
          <Form.Item name="criticalPercent" label="严重阈值 (%)" rules={[{ required: true, message: "必填" }]}>
            <InputNumber min={1} max={100} style={{ width: 90 }} />
          </Form.Item>
          <Form.Item name="notifyChannels" label="通知渠道" rules={[{ required: true, message: "至少选择一个渠道" }]}>
            <Select mode="multiple" placeholder="选择通知渠道" style={{ minWidth: 260 }} options={Object.entries(NOTIFY_CHANNEL_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
        </Form>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="总对象数" value={totalObjects} styles={{ content: { color: "#0ea5e9" } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="总容量 (TB)" value={(totalCapacity / 1024).toFixed(1)} styles={{ content: { color: "#1e40af" } }} /></Card></Col>
        <Col span={4}>
          <Card>
            <Statistic title="已用 (TB)" value={(totalUsed / 1024).toFixed(1)} suffix={`${usedPct.toFixed(1)}%`} styles={{ content: { color: capacityLevel === "critical" ? "#dc2626" : capacityLevel === "warn" ? "#d97706" : "#059669" } }} />
            {capacityLevel !== "ok" && (
              <Alert
                type={capacityLevel === "critical" ? "error" : "warning"}
                showIcon
                icon={<AlertCircle size={14} />}
                style={{ marginTop: 8, padding: "4px 8px" }}
                message={<span style={{ fontSize: 12 }}>{capacityLevel === "critical" ? `严重: 已用容量超过严重阈值 ${criticalPct}%` : `警告: 已用容量超过警告阈值 ${warnPct}%`}</span>}
              />
            )}
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Tooltip title={twentyFourH.derived ? "由真实存储统计按 30 天日均近似 (读取≈写入×3)" : "后端无 24h 吞吐字段, 展示示例值"}>
              <Statistic title="24h 写入" prefix={twentyFourH.derived ? "≈ " : "示例值 "} value={formatBytes(twentyFourH.write)} styles={{ content: { color: "#10b981" } }} />
            </Tooltip>
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Tooltip title={twentyFourH.derived ? "由真实存储统计按 30 天日均近似 (读取≈写入×3)" : "后端无 24h 吞吐字段, 展示示例值"}>
              <Statistic title="24h 读取" prefix={twentyFourH.derived ? "≈ " : "示例值 "} value={formatBytes(twentyFourH.read)} styles={{ content: { color: "#0891b2" } }} />
            </Tooltip>
          </Card>
        </Col>
        <Col span={4}><Card><Statistic title="压缩节省" value={`${COMPRESSION.savedGb} GB`} styles={{ content: { color: "#7c3aed" } }} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title={<Space><HardDrive size={16} />存储节点 ({nodes.length})<Tag color="green">{(nodes.filter(n => n.status === "online").length)} 在线</Tag></Space>}>
            <Table scroll={{ x: 'max-content' }}
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
                { title: "类型", dataIndex: "type", key: "type", width: 100, render: (t: string) => NODE_TYPE_LABELS[t] ?? t },
                { title: "区域", dataIndex: "region", key: "region", width: 140 },
                { title: "容量使用", key: "usage", width: 200, render: (_: any, r: any) => {
                  const pct = (r.usedGb / r.capacityGb) * 100;
                  return <Progress percent={pct} size="small" status={pct > 80 ? "exception" : "active"} format={(p) => `${(p ?? 0).toFixed(1)}%`} />;
                } },
                { title: "超限标记", key: "over", width: 90, render: (_: any, r: any) => {
                  const pct = (r.usedGb / r.capacityGb) * 100;
                  if (pct >= criticalPct) return <Tag color="red">严重超限</Tag>;
                  if (pct >= warnPct) return <Tag color="orange">容量预警</Tag>;
                  return <Tag>正常</Tag>;
                } },
                { title: "对象数", dataIndex: "objectsCount", key: "obj", width: 110, render: (n: number) => n.toLocaleString() },
                { title: "读延迟", dataIndex: "readLatencyMs", key: "rl", width: 90, render: (n: number) => `${n} ms` },
                { title: "写延迟", dataIndex: "writeLatencyMs", key: "wl", width: 90, render: (n: number) => `${n} ms` },
                { title: "状态", dataIndex: "status", key: "status", width: 100, render: (s: string) => { const st = STATUS_MAP[s] ?? { color: "gray", label: s }; return <Tag color={st.color}>{st.label}</Tag> } },
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
                  <Text>{m.objects.toLocaleString()} 个对象 | {(m.sizeGb / 1024).toFixed(1)} TB</Text>
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
        <Table scroll={{ x: 'max-content' }}
          dataSource={jobsPagination.pageData}
          rowKey="id"
          size="small"
          pagination={jobsPagination.pagination}
          columns={[
            { title: "任务", dataIndex: "id", key: "id", width: 110 },
            { title: "类型", dataIndex: "type", key: "type", width: 110, render: (t: string) => { const jt = JOB_TYPE[t] ?? { color: "blue", label: t }; return <Tag color={jt.color}>{jt.label}</Tag> } },
            { title: "源", dataIndex: "source", key: "src", width: 130 },
            { title: "目标", dataIndex: "target", key: "dst", width: 130 },
            { title: "对象数", dataIndex: "objects", key: "o", width: 80 },
            { title: "大小", dataIndex: "bytes", key: "b", width: 100, render: (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB` },
            { title: "开始", dataIndex: "startedAt", key: "s", width: 160, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
            { title: "耗时", dataIndex: "duration", key: "d", width: 80, render: (d: number) => `${d}s` },
            { title: "进度", dataIndex: "progress", key: "p", width: 140, render: (p: number) => <Progress percent={p} size="small" status={p === 100 ? "success" : "active"} /> },
            { title: "状态", dataIndex: "status", key: "st", width: 90, render: (s: string) => <Tag color={JOB_STATUS[s]?.color}>{s === "success" ? "成功" : s === "running" ? "进行中" : s === "failed" ? "失败" : "排队"}</Tag> },
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
      messageApi.error(res.error?.message ?? "加载存储配置失败");
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
        messageApi.success(res.data.detail ?? "连接成功");
      } else {
        messageApi.warning(res.data.detail ?? "连接失败");
      }
    } else {
      messageApi.error(res.error?.message ?? "连接测试失败");
    }
    setTesting(false);
  };

  const onSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    const res = await storageConfigApi.save(values as StorageConfigDto);
    if (res.success && res.data) {
      messageApi.success(res.data.applied ? "配置已保存并生效" : "配置已保存 (运行时驱动由环境变量 STORAGE_DRIVER 控制)");
      void load();
    } else {
      messageApi.error(res.error?.message ?? "保存失败");
    }
    setSaving(false);
  };

  const driverLabel = driver === "s3" ? "S3 / MinIO 对象存储" : "本地文件系统";
  const activeColor = stats?.status === "active" ? "#16a34a" : "#dc2626";

  return (
    <>
      {contextHolder}
      <Row gutter={16}>
        <Col span={14}>
          <Card
            title={<Space><Settings size={16} />存储驱动配置<Text type="secondary" style={{ fontSize: 12 }}>对标 GE True PACS Cloud / Sectra One Cloud</Text></Space>}
            extra={
              <Space>
                <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>刷新</Button>
                <Button type="primary" icon={<PlugZap size={14} />} onClick={() => void onTest()} loading={testing}>连接测试</Button>
                <Button icon={<Save size={14} />} onClick={() => void onSave()} loading={saving} disabled={testing}>保存配置</Button>
              </Space>
            }
          >
            <Form form={form} layout="vertical" initialValues={{ driver: "local", endpoint: "http://localhost:9000", region: "us-east-1" }}>
              <Form.Item name="driver" label="存储驱动" rules={[{ required: true, message: "请选择存储驱动" }]}>
                <Radio.Group>
                  <Radio.Button value="local"><Database size={14} /> 本地存储</Radio.Button>
                  <Radio.Button value="s3"><Cloud size={14} /> S3 / MinIO</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Alert
                type="info"
                showIcon
                icon={<AlertCircle size={14} />}
                style={{ marginBottom: 16 }}
                message={`当前选择: ${driverLabel}`}
                description={
                  driver === "s3"
                    ? "DICOM / VNA / Files 对象将写入 S3/MinIO (AWS SigV4, 无需 AWS SDK)。bucket 需预先创建。"
                    : "数据存储于本机目录 (DICOM_STORAGE_DIR / VNA_STORAGE_DIR / FILES_STORAGE_DIR)。"
                }
              />

              {driver === "s3" && (
                <>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="endpoint" label="端点" rules={[{ required: true, message: "端点必填" }]}>
                        <Input placeholder="http://localhost:9000" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="bucket" label="存储桶" rules={[{ required: true, message: "存储桶必填" }]}>
                        <Input placeholder="g005" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="region" label="区域" rules={[{ required: true, message: "区域必填" }]}>
                        <Input placeholder="us-east-1" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="accessKey" label="访问密钥" rules={[{ required: true, message: "访问密钥必填" }]}>
                        <Input placeholder="minioadmin" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="secretKey" label="私有密钥" rules={[{ required: true, message: "私有密钥必填" }]}>
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
                message={testResult.detail ?? (testResult.status === "active" ? "连接成功" : "连接失败")}
                description={testResult.latencyMs !== undefined ? `延迟 ${testResult.latencyMs} ms` : undefined}
              />
            )}
          </Card>
        </Col>

        <Col span={10}>
          <Card title={<Space><Activity size={16} />驱动状态与存储统计</Space>} loading={loading}>
            <div style={{ marginBottom: 12 }}>
              <Space>
                <div style={{ width: 10, height: 10, background: activeColor, borderRadius: "50%" }} />
                <Text strong style={{ fontSize: 15 }}>
                  当前驱动: {stats?.driver === "s3" ? "S3 / MinIO" : "本地存储"}
                  <Tag color={stats?.status === "active" ? "green" : "red"} style={{ marginLeft: 8 }}>
                    {stats?.status === "active" ? "运行中" : "异常"}
                  </Tag>
                </Text>
              </Space>
            </div>
            {envDriver && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={`环境变量 STORAGE_DRIVER=${envDriver} 已固定运行时驱动, 页面保存的配置不覆盖环境变量。`} />
            )}
            <Row gutter={12}>
              <Col span={12}>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Statistic title="已用容量" value={formatBytes(stats?.usedBytes)} valueStyle={{ color: "#dc2626", fontSize: 20 }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Statistic title="对象数" value={stats?.objectCount ?? 0} valueStyle={{ color: "#0ea5e9", fontSize: 20 }} />
                </Card>
              </Col>
            </Row>
            {stats?.truncated && (
              <Alert type="info" showIcon message="对象数超过统计上限 (5000), 统计为抽样结果。" style={{ marginBottom: 12 }} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Clock size={14} color="var(--text-secondary)" />
              <Text type="secondary" style={{ fontSize: 12 }}>{stats?.detail ?? "暂无统计"}</Text>
            </div>
            {stats?.latencyMs !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={14} color="var(--text-secondary)" />
                <Text type="secondary" style={{ fontSize: 12 }}>驱动延迟 {stats.latencyMs} ms</Text>
              </div>
            )}
            <Alert type="success" showIcon icon={<CheckCircle size={14} />} style={{ marginTop: 12 }}
              message="归档链路已就绪" description="DICOM (C-STORE / STOW-RS) → VNA → Files 全部经过统一存储抽象层。" />
          </Card>
        </Col>
      </Row>
    </>
  );
}

// ─────────────────────────── 桶管理 (G-28 v3.0.6.11-91) ───────────────────────────

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  s3: { label: "AWS S3", color: "orange" },
  minio: { label: "MinIO", color: "geekblue" },
  local: { label: "本地", color: "green" },
};

function objectIcon(key: string) {
  if (key.endsWith(".json")) return <FileJson size={14} />;
  if (key.endsWith(".pdf")) return <FileText size={14} />;
  if (key.endsWith(".png") || key.endsWith(".jpg") || key.endsWith(".dcm")) return <FileIcon size={14} />;
  return <Inbox size={14} />;
}

function BucketObjectsModal({
  bucket,
  visible,
  onClose,
  onChanged,
}: {
  bucket: StorageBucketDto | null;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [objects, setObjects] = useState<StorageObjectDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async (name: string) => {
    setLoading(true);
    const res = await storageConfigApi.listBucketObjects(name);
    if (res.success && Array.isArray(res.data)) setObjects(res.data);
    else message.error(res.error?.message ?? "对象列表加载失败");
    setLoading(false);
  };

  useEffect(() => {
    if (visible && bucket) void load(bucket.name);
    else setObjects([]);
  }, [visible, bucket]);

  const download = async (obj: StorageObjectDto) => {
    if (!bucket) return;
    message.loading({ content: `正在生成 ${obj.key} 模拟下载…`, key: "dl" });
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
      message.success({ content: `已下载 ${d.filename} (${formatBytes(d.size)})`, key: "dl" });
    } else {
      message.error({ content: res.error?.message ?? "下载失败", key: "dl" });
    }
  };

  return (
    <Modal
      title={
        <Space>
          <Boxes size={16} color="#0ea5e9" />
          {bucket?.name} 对象列表 ({objects.length})
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={760}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="上传为本地模拟 (仅注册元数据)，下载生成 JSON/文本 Blob 模拟真实拉取。"
      />
      <div style={{ marginBottom: 12 }}>
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
                  message.success(`模拟上传成功: ${res.data.key} (${formatBytes(res.data.size)})`);
                  void load(bucket.name);
                  onChanged();
                } else {
                  message.error(res.error?.message ?? "上传失败");
                }
              })
              .finally(() => setUploading(false));
            return false;
          }}
        >
          <Button type="primary" icon={<UploadCloud size={14} />} loading={uploading} disabled={!bucket}>
            上传对象 (本地模拟)
          </Button>
        </Upload>
      </div>
      <Table
        size="small"
        rowKey="key"
        loading={loading}
        dataSource={objects}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: "对象键",
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
            title: "大小",
            dataIndex: "size",
            key: "size",
            width: 120,
            render: (s: number) => formatBytes(s),
          },
          {
            title: "修改时间",
            dataIndex: "modified",
            key: "modified",
            width: 180,
            render: (m: string) => new Date(m).toLocaleString("zh-CN"),
          },
          {
            title: "操作",
            key: "action",
            width: 120,
            render: (_: unknown, obj: StorageObjectDto) => (
              <Button size="small" icon={<Download size={13} />} onClick={() => void download(obj)}>
                下载
              </Button>
            ),
          },
        ]}
      />
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

  const load = async () => {
    setLoading(true);
    const res = await storageConfigApi.listBuckets();
    if (res.success && Array.isArray(res.data)) setBuckets(res.data);
    else message.error(res.error?.message ?? "桶列表加载失败");
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
        message.success(`桶已创建: ${res.data.name} (${res.data.provider}/${res.data.region})`);
        setCreateVisible(false);
        createForm.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? "桶创建失败");
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
      message.success(`桶 ${bucket.name} 已删除`);
      void load();
    } else {
      message.error(res.error?.message ?? "删除失败");
    }
    setDeleting(null);
  };

  const openObjects = (bucket: StorageBucketDto) => {
    setSelectedBucket(bucket);
    setObjectsVisible(true);
  };

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="桶数量" value={buckets.length} valueStyle={{ color: "#0ea5e9" }} prefix={<Boxes size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="对象总数" value={totalObjects.toLocaleString()} valueStyle={{ color: "#0891b2" }} prefix={<Inbox size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="占用容量" value={formatBytes(totalBytes)} valueStyle={{ color: "#dc2626" }} prefix={<HardDrive size={14} />} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Space><Boxes size={16} />云存储桶 <Text type="secondary" style={{ fontSize: 12 }}>S3 / MinIO / 本地 — 桶 CRUD + 对象列表 + 模拟上传下载</Text></Space>}
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>刷新</Button>
            <Button type="primary" icon={<FolderPlus size={14} />} onClick={() => setCreateVisible(true)}>新建桶</Button>
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
              title: "桶名称",
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
              title: "提供商",
              dataIndex: "provider",
              key: "provider",
              width: 120,
              render: (p: BucketProvider) => {
                const cfg = PROVIDER_LABELS[p] ?? { label: p, color: "default" };
                return <Tag color={cfg.color}>{cfg.label}</Tag>;
              },
            },
            { title: "区域", dataIndex: "region", key: "region", width: 140 },
            {
              title: "对象数",
              dataIndex: "objectCount",
              key: "objectCount",
              width: 100,
              render: (n: number) => n.toLocaleString(),
            },
            {
              title: "占用",
              dataIndex: "usedBytes",
              key: "usedBytes",
              width: 120,
              render: (b: number) => formatBytes(b),
            },
            {
              title: "创建时间",
              dataIndex: "createdAt",
              key: "createdAt",
              width: 170,
              render: (c: string) => new Date(c).toLocaleString("zh-CN"),
            },
            {
              title: "操作",
              key: "action",
              width: 240,
              render: (_: unknown, r: StorageBucketDto) => (
                <Space size={4}>
                  <Tooltip title="对象列表">
                    <Button size="small" icon={<Eye size={13} />} onClick={() => openObjects(r)}>对象</Button>
                  </Tooltip>
                  <Popconfirm
                    title={`确认删除桶 ${r.name}?`}
                    description="删除后桶内对象一并移除 (内存态)"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => void onDelete(r)}
                  >
                    <Button size="small" danger icon={<Trash2 size={13} />} loading={deleting === r.name}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={<Space><FolderPlus size={16} color="#0ea5e9" />新建存储桶</Space>}
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => void onCreate()}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical" initialValues={{ provider: "s3", region: "us-east-1" }} style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label="桶名称"
            rules={[
              { required: true, message: "桶名称必填" },
              { pattern: /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i, message: "仅允许字母/数字/点/中划线" },
              { max: 63, message: "最长 63 字符" },
            ]}
          >
            <Input placeholder="g005-backup" prefix={<Cloud size={13} />} />
          </Form.Item>
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: "请选择提供商" }]}>
            <Select
              options={[
                { value: "s3", label: "AWS S3" },
                { value: "minio", label: "MinIO" },
                { value: "local", label: "本地文件系统" },
              ]}
            />
          </Form.Item>
          <Form.Item name="region" label="区域" rules={[{ required: true, message: "区域必填" }]}>
            <Input placeholder="us-east-1 / cn-north-1" />
          </Form.Item>
        </Form>
      </Modal>

      <BucketObjectsModal bucket={selectedBucket} visible={objectsVisible} onClose={() => setObjectsVisible(false)} onChanged={() => void load()} />
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
            <div style={{ fontSize: 22, fontWeight: 800 }}>云存储与归档平台</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              存储抽象层: 本地 ↔ S3/MinIO 双驱动 | 对标 GE True PACS Cloud / Sectra One Cloud / Fujifilm 云原生
            </div>
          </div>
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="monitor"
        items={[
          {
            key: "monitor",
            label: <Space><FileArchive size={14} />监控大盘</Space>,
            children: <StorageMonitorTab />,
          },
          {
            key: "config",
            label: <Space><Settings size={14} />存储配置</Space>,
            children: <StorageConfigTab />,
          },
          {
            key: "buckets",
            label: <Space><Boxes size={14} />桶管理</Space>,
            children: <StorageBucketsTab />,
          },
        ]}
      />
    </div>
  );
}

/**
 * Cloud Storage & Archiving Dashboard
 * v3.0.6.11-60: 增加「存储配置」页签 — 驱动选择 (本地/S3) + 配置表单 + 连接测试 + 存储统计
 */
import { useEffect, useMemo, useState } from "react";
import {
  Card, Col, Row, Table, Tag, Statistic, Tabs, Progress, Typography, Space, Alert,
  Radio, Form, Input, Button, message,
} from "antd";
import {
  Cloud, Database, Archive, HardDrive, Layers, Activity, Clock, TrendingUp, AlertCircle,
  CheckCircle, FileArchive, Repeat, Settings, PlugZap, Save, RefreshCw,
} from "lucide-react";
import { STORAGE_NODES, TIER_METRICS, ARCHIVE_JOBS, COMPRESSION } from "../services/storage";
import {
  storageConfigApi,
  type StorageConfigDto,
  type StorageStatsDto,
  type StorageTestResponse,
} from "../services/api/storageConfigApi";

const { Text } = Typography;

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

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="总对象数" value={totalObjects} styles={{ content: { color: "#0ea5e9" } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="总容量 (TB)" value={(totalCapacity / 1024).toFixed(1)} styles={{ content: { color: "#1e40af" } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="已用 (TB)" value={(totalUsed / 1024).toFixed(1)} suffix={`${usedPct.toFixed(1)}%`} styles={{ content: { color: "#dc2626" } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="24h 写入" value="42.8 MB" styles={{ content: { color: "#10b981" } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="24h 读取" value="124.2 MB" styles={{ content: { color: "#0891b2" } }} /></Card></Col>
        <Col span={4}><Card><Statistic title="压缩节省" value={`${COMPRESSION.savedGb} GB`} styles={{ content: { color: "#7c3aed" } }} /></Card></Col>
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
                      <Form.Item name="endpoint" label="端点" rules={[{ required: true, message: "endpoint 必填" }]}>
                        <Input placeholder="http://localhost:9000" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="bucket" label="存储桶" rules={[{ required: true, message: "bucket 必填" }]}>
                        <Input placeholder="g005" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="region" label="区域" rules={[{ required: true, message: "region 必填" }]}>
                        <Input placeholder="us-east-1" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="accessKey" label="访问密钥" rules={[{ required: true, message: "accessKey 必填" }]}>
                        <Input placeholder="minioadmin" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="secretKey" label="私有密钥" rules={[{ required: true, message: "secretKey 必填" }]}>
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
              <Clock size={14} color="#6b7280" />
              <Text type="secondary" style={{ fontSize: 12 }}>{stats?.detail ?? "暂无统计"}</Text>
            </div>
            {stats?.latencyMs !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={14} color="#6b7280" />
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

// ─────────────────────────── 页面 ───────────────────────────

export default function CloudStorageDashboardPage() {
  return (
    <div style={{ padding: 24, background: "#f1f5f9", minHeight: "calc(100vh - 56px)" }}>
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
        ]}
      />
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import {
  Card, Table, Select, Button, Tag, Space, Typography, Alert, message,
  Row, Col, Statistic, Form, Input, InputNumber, Modal, Descriptions,
} from "antd";
import {
  Shield, RefreshCw, Key, Server, Wifi, WifiOff, Cpu, HardDrive,
  Activity, Plug, Link, Plus, Trash2,
} from "lucide-react";

const { Title, Text } = Typography;

interface HsmKey {
  id: string;
  label: string;
  algorithm: string;
  keyClass: string;
  usage: string[];
  sensitive: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface HsmConfig {
  provider: "local" | "cloud" | "network";
  vendor: string;
  algorithm: string;
  libraryPath: string;
  slotId: number;
  timeoutMs: number;
  fipsMode: boolean;
  enableAudit: boolean;
}

const PROVIDER_OPTIONS = [
  { value: "local", label: "本地 HSM (PKCS#11)", icon: HardDrive },
  { value: "cloud", label: "云端 HSM", icon: Cpu },
  { value: "network", label: "网络 HSM", icon: Server },
];

const ALGORITHM_OPTIONS = [
  { value: "RSA-2048", label: "RSA-2048" },
  { value: "RSA-4096", label: "RSA-4096" },
  { value: "EC-P256", label: "EC-P256" },
  { value: "EC-P384", label: "EC-P384" },
  { value: "SM2-256", label: "SM2-256" },
  { value: "SM4-128", label: "SM4-128" },
];

const MOCK_KEYS: HsmKey[] = [
  { id: "KEY-001", label: "签名密钥-主任", algorithm: "SM2-256", keyClass: "private", usage: ["sign", "verify"], sensitive: true, createdAt: "2026-01-15T08:00:00.000Z" },
  { id: "KEY-002", label: "加密密钥-系统", algorithm: "RSA-2048", keyClass: "private", usage: ["encrypt", "decrypt"], sensitive: true, createdAt: "2026-01-15T08:00:00.000Z" },
  { id: "KEY-003", label: "TLS 证书密钥", algorithm: "EC-P256", keyClass: "private", usage: ["sign"], sensitive: true, createdAt: "2026-02-20T08:00:00.000Z", expiresAt: "2027-02-20T08:00:00.000Z" },
  { id: "KEY-004", label: "时间戳密钥", algorithm: "RSA-4096", keyClass: "private", usage: ["sign", "verify"], sensitive: false, createdAt: "2026-03-01T08:00:00.000Z" },
  { id: "KEY-005", label: "数据加密密钥", algorithm: "SM4-128", keyClass: "secret", usage: ["encrypt", "decrypt", "wrap", "unwrap"], sensitive: false, createdAt: "2026-04-10T08:00:00.000Z" },
];

export default function HsmConfigPage() {
  const [config, setConfig] = useState<HsmConfig>({
    provider: "local",
    vendor: "Softhsm",
    algorithm: "SM2-256",
    libraryPath: "/usr/lib/softhsm/libsofthsm.so",
    slotId: 0,
    timeoutMs: 5000,
    fipsMode: true,
    enableAudit: true,
  });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configModal, setConfigModal] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [keys, setKeys] = useState<HsmKey[]>(MOCK_KEYS);
  const [statusLog, setStatusLog] = useState<string>("");
  const [form] = Form.useForm();
  const [keyForm] = Form.useForm();

  const slotCount = useMemo(() => (config.provider === "local" ? 3 : config.provider === "cloud" ? 1 : 2), [config.provider]);
  const activeSessions = useMemo(() => (connected ? 2 : 0), [connected]);

  useEffect(() => {
    if (connected && statusLog) {
      const timer = setTimeout(() => setStatusLog(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [connected, statusLog]);

  const handleConnect = async () => {
    setLoading(true);
    setTimeout(() => {
      setConnected(true);
      setLoading(false);
      setStatusLog("HSM 连接成功");
      message.success("HSM 连接成功");
    }, 800);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setStatusLog("HSM 已断开");
    message.info("HSM 已断开连接");
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      if (connected) {
        message.success("连接测试通过 - 延迟 2.3ms");
        setStatusLog("自检通过: RNG, Digest, Sign");
      } else {
        message.error("连接测试失败 - 请先连接 HSM");
      }
    }, 1200);
  };

  const handleUpdateConfig = async () => {
    try {
      const vals = await form.validateFields();
      setConfig({ ...config, ...vals });
      setConnected(false);
      setStatusLog("配置已更新，请重新连接");
      message.success("配置已更新");
      setConfigModal(false);
    } catch {
      // validation failed
    }
  };

  const handleGenerateKey = async () => {
    try {
      const vals = await keyForm.validateFields();
      const newKey: HsmKey = {
        id: `KEY-${String(keys.length + 1).padStart(3, "0")}`,
        label: vals.label,
        algorithm: vals.algorithm,
        keyClass: vals.keyClass,
        usage: [vals.usage],
        sensitive: vals.sensitive ?? true,
        createdAt: new Date().toISOString(),
      };
      setKeys([...keys, newKey]);
      setShowAddKey(false);
      keyForm.resetFields();
      message.success("密钥已生成");
    } catch {
      // validation failed
    }
  };

  const handleDeleteKey = (keyId: string) => {
    setKeys(keys.filter((k) => k.id !== keyId));
    message.success("密钥已删除");
  };

  const keyColumns = [
    { title: "标签", dataIndex: "label", key: "label", width: 160 },
    { title: "算法", dataIndex: "algorithm", key: "algorithm", width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: "类型", dataIndex: "keyClass", key: "keyClass", width: 80, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: "用途", dataIndex: "usage", key: "usage", width: 180,
      render: (u: string[]) => u.map((x) => <Tag key={x} color="green" style={{ marginRight: 4 }}>{x}</Tag>),
    },
    {
      title: "敏感", dataIndex: "sensitive", key: "sensitive", width: 60,
      render: (s: boolean) => s ? <Tag color="red">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 160,
      render: (t: string) => new Date(t).toLocaleString("zh-CN"),
    },
    {
      title: "操作", key: "action", width: 60,
      render: (_: unknown, record: HsmKey) => (
        <Button
          type="link"
          danger
          icon={<Trash2 size={14} />}
          onClick={() => handleDeleteKey(record.id)}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Shield size={22} /> HSM 配置
      </Title>

      {statusLog && (
        <Alert
          title={statusLog}
          type={connected ? "success" : "info"}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setStatusLog("")}
        />
      )}

      <Card
        style={{ borderRadius: 8, marginBottom: 16 }}
        bodyStyle={{ padding: "16px 24px" }}
      >
        <Row gutter={[24, 16]} align="middle">
          <Col flex="200px">
            <Text strong>连接状态</Text>
          </Col>
          <Col flex="auto">
            <Tag
              icon={connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              color={connected ? "green" : "red"}
              style={{ padding: "4px 12px", fontSize: 13 }}
            >
              {connected ? "已连接" : "未连接"}
            </Tag>
          </Col>
          <Col>
            <Space>
              {!connected ? (
                <Button type="primary" icon={<Plug size={14} />} onClick={handleConnect} loading={loading}>
                  连接 HSM
                </Button>
              ) : (
                <Button icon={<WifiOff size={14} />} onClick={handleDisconnect}>
                  断开
                </Button>
              )}
              <Button icon={<Activity size={14} />} onClick={handleTestConnection} loading={testing}>
                测试连接
              </Button>
              <Button icon={<RefreshCw size={14} />} onClick={() => { setStatusLog("已刷新"); message.success("状态已刷新"); }}>
                刷新
              </Button>
              <Button
                icon={<Link size={14} />}
                onClick={() => { form.setFieldsValue(config); setConfigModal(true); }}
              >
                配置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="提供商"
              value={PROVIDER_OPTIONS.find((p) => p.value === config.provider)?.label ?? config.provider}
              prefix={<Server size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="插槽数" value={slotCount} prefix={<Cpu size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="密钥数" value={keys.length} prefix={<Key size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="活跃会话"
              value={activeSessions}
              prefix={<Cpu size={14} />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <Key size={16} />
            <span>密钥管理</span>
            <Tag>{keys.length} 个密钥</Tag>
          </Space>
        }
        extra={
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setShowAddKey(true)} disabled={!connected}>
            生成密钥
          </Button>
        }
        style={{ borderRadius: 8, marginBottom: 16 }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={keys}
          columns={keyColumns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>

      <Card
        title={
          <Space>
            <HardDrive size={16} />
            <span>当前配置</span>
          </Space>
        }
        style={{ borderRadius: 8 }}
      >
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="提供商">{PROVIDER_OPTIONS.find((p) => p.value === config.provider)?.label}</Descriptions.Item>
          <Descriptions.Item label="算法">{config.algorithm}</Descriptions.Item>
          <Descriptions.Item label="厂商">{config.vendor}</Descriptions.Item>
          <Descriptions.Item label="插槽 ID">{config.slotId}</Descriptions.Item>
          <Descriptions.Item label="库路径"><Text code>{config.libraryPath}</Text></Descriptions.Item>
          <Descriptions.Item label="超时 (ms)">{config.timeoutMs}</Descriptions.Item>
          <Descriptions.Item label="FIPS 模式">
            {config.fipsMode ? <Tag color="blue">启用</Tag> : <Tag>禁用</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="审计日志">
            {config.enableAudit ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Modal
        title="HSM 配置"
        open={configModal}
        onOk={handleUpdateConfig}
        onCancel={() => setConfigModal(false)}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
            <Select
              options={PROVIDER_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
              onChange={(v) => setConfig({ ...config, provider: v })}
            />
          </Form.Item>
          <Form.Item name="vendor" label="厂商"><Input /></Form.Item>
          <Form.Item name="algorithm" label="算法" rules={[{ required: true }]}>
            <Select options={ALGORITHM_OPTIONS} />
          </Form.Item>
          <Form.Item name="libraryPath" label="库路径"><Input /></Form.Item>
          <Form.Item name="slotId" label="插槽 ID"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="timeoutMs" label="超时 (ms)">
            <InputNumber min={1000} max={120000} step={500} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="生成密钥"
        open={showAddKey}
        onOk={handleGenerateKey}
        onCancel={() => { setShowAddKey(false); keyForm.resetFields(); }}
        width={440}
      >
        <Form form={keyForm} layout="vertical">
          <Form.Item name="label" label="密钥标签" rules={[{ required: true }]}>
            <Input placeholder="例如：签名密钥-主任" />
          </Form.Item>
          <Form.Item name="algorithm" label="算法" rules={[{ required: true }]} initialValue="SM2-256">
            <Select options={ALGORITHM_OPTIONS} />
          </Form.Item>
          <Form.Item name="keyClass" label="密钥类型" rules={[{ required: true }]} initialValue="private">
            <Select options={[
              { value: "private", label: "私钥" },
              { value: "public", label: "公钥" },
              { value: "secret", label: "对称密钥" },
            ]} />
          </Form.Item>
          <Form.Item name="usage" label="用途" rules={[{ required: true }]} initialValue="sign">
            <Select options={[
              { value: "sign", label: "签名 (Sign)" },
              { value: "verify", label: "验签 (Verify)" },
              { value: "encrypt", label: "加密 (Encrypt)" },
              { value: "decrypt", label: "解密 (Decrypt)" },
              { value: "wrap", label: "密钥封装 (Wrap)" },
              { value: "unwrap", label: "密钥解封 (Unwrap)" },
            ]} />
          </Form.Item>
          <Form.Item name="sensitive" label="敏感密钥" valuePropName="checked" initialValue={true}>
            <Select options={[
              { value: true, label: "是 (不可导出)" },
              { value: false, label: "否 (可导出)" },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

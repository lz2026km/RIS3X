import { aiPlatformApi } from "../../services/api/aiPlatformApi";
import { AiPlatformModel, AiPlatformStats, AiPlatformTestResult } from '../../services/api/aiPlatformApi'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  message,
  Badge,
  Switch,
  Spin,
  Alert,
  Descriptions,
} from "antd";
import {
  Plug,
  Trash2,
  Plus,
  CheckCircle,
  Shield,
  Zap,
  RefreshCw,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { t } from "../../i18n/appI18n";

const statusLabel: Record<string, string> = {
  active: t("thirdAi.status.active"),
  inactive: t("thirdAi.status.inactive"),
  deprecated: t("thirdAi.status.deprecated"),
};
const statusBadge: Record<string, "success" | "default" | "error"> = {
  active: "success",
  inactive: "default",
  deprecated: "error",
};
const typeColor: Record<string, string> = {
  diagnosis: "blue",
  segmentation: "purple",
  detection: "cyan",
  classification: "geekblue",
  nlp: "orange",
};
const typeLabel: Record<string, string> = {
  diagnosis: t("thirdAi.type.diagnosis"),
  segmentation: t("thirdAi.type.segmentation"),
  detection: t("thirdAi.type.detection"),
  classification: t("thirdAi.type.classification"),
  nlp: t("thirdAi.type.nlp"),
};

const ThirdPartyAiPage: React.FC = () => {
  const [providers, setProviders] = useState<AiPlatformModel[]>([]);
  const [stats, setStats] = useState<AiPlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<AiPlatformModel | null>(null);
  // [v3.0.6.11-91 W1-B P1] 模型测试: 结果 Modal + 测试中状态
  const [testResult, setTestResult] = useState<AiPlatformTestResult | null>(null);
  const [testError, setTestError] = useState("");
  const [testBusyId, setTestBusyId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [modelsRes, statsRes] = await Promise.all([
        aiPlatformApi.listModels(),
        aiPlatformApi.getStats(),
      ]);
      if (modelsRes.success) setProviders(modelsRes.data ?? []);
      else setError(modelsRes.error?.message ?? t("thirdAi.loadFail"));
      if (statsRes.success) setStats(statsRes.data);
    } catch (e) {
      setError((e as Error)?.message ?? t("thirdAi.loadFail"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connected = providers.filter((p) => p.status === "active").length;
  const totalRequests = stats?.totalInferences ?? 0;
  const avgAccuracy =
    providers
      .filter((p) => (p.accuracy ?? 0) > 0)
      .reduce((s, p) => s + (p.accuracy ?? 0), 0) /
    (providers.filter((p) => (p.accuracy ?? 0) > 0).length || 1);

  const handleToggle = async (record: AiPlatformModel, checked: boolean) => {
    const res = await aiPlatformApi.updateModel(record.id, {
      status: checked ? "active" : "inactive",
    });
    if (res.success) {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === record.id
            ? { ...p, status: checked ? "active" : "inactive" }
            : p,
        ),
      );
      message.success(checked ? t("thirdAi.enabled") : t("thirdAi.disabled"));
    } else {
      message.error(res.error?.message ?? t("thirdAi.opFail"));
    }
  };

  const handleDelete = async (record: AiPlatformModel) => {
    const res = await aiPlatformApi.deleteModel(record.id);
    if (res.success) {
      setProviders((prev) => prev.filter((p) => p.id !== record.id));
      message.success(t("thirdAi.removed"));
    } else {
      message.error(res.error?.message ?? t("thirdAi.removeFail"));
    }
  };

  // [G005 v3.0.6.11-91 W1-B P1 第12轮] 模型连通性测试 → 结果 Modal (状态/延迟/输出预览)
  const handleTest = async (record: AiPlatformModel) => {
    setTestBusyId(record.id);
    setTestError("");
    setTestResult(null);
    try {
      const res = await aiPlatformApi.testModel(record.id);
      if (res.success && res.data) {
        setTestResult(res.data);
      } else {
        setTestError(res.error?.message ?? t("thirdAi.testFail"));
        setTestResult(null);
      }
    } catch (e) {
      setTestError((e as Error)?.message ?? t("thirdAi.testRequestFail"));
      setTestResult(null);
    } finally {
      setTestBusyId(null);
    }
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      const res = await aiPlatformApi.deployModel({
        name: values.name,
        type: values.type,
        endpoint: values.endpoint,
        version: values.model ?? "1.0",
        modality: [],
        description: "",
        status: "active",
      });
      if (res.success) {
        setProviders((prev) => [res.data!, ...prev]);
        setAddOpen(false);
        form.resetFields();
        message.success(t("thirdAi.added"));
      } else {
        message.error(res.error?.message ?? t("thirdAi.addFail"));
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const columns = [
    {
      title: t("thirdAi.col.name"),
      dataIndex: "name",
      key: "name",
      render: (v: string) => (
        <Space>
          <Plug size={14} color="#2563eb" />
          {v}
        </Space>
      ),
    },
    {
      title: t("thirdAi.col.type"),
      dataIndex: "type",
      key: "type",
      render: (v: string) => (
        <Tag color={typeColor[v]}>{typeLabel[v] || v}</Tag>
      ),
    },
    { title: t("thirdAi.col.model"), dataIndex: "version", key: "version" },
    {
      title: t("thirdAi.col.status"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Badge
          status={statusBadge[v] ?? "default"}
          text={statusLabel[v] || v}
        />
      ),
    },
    {
      title: t("thirdAi.col.accuracy"),
      dataIndex: "accuracy",
      key: "accuracy",
      render: (v?: number) =>
        (v ?? 0) > 0 ? `${((v ?? 0) * 100).toFixed(0)}%` : "-",
    },
    {
      title: t("thirdAi.col.enabled"),
      dataIndex: "status",
      key: "enabled",
      render: (v: string, r: AiPlatformModel) => (
        <Switch
          size="small"
          checked={v === "active"}
          onChange={(checked) => void handleToggle(r, checked)}
        />
      ),
    },
    {
      title: t("thirdAi.col.action"),
      key: "action",
      render: (_: unknown, r: AiPlatformModel) => (
        <Space>
          <Button size="small" type="primary" onClick={() => setDetail(r)}>
            {t("thirdAi.detail")}
          </Button>
          <Button
            size="small"
            icon={<Zap size={14} />}
            loading={testBusyId === r.id}
            onClick={() => void handleTest(r)}
          >
            {t("thirdAi.test")}
          </Button>
          <Button
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={() => void handleDelete(r)}
          >
            {t("thirdAi.remove")}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Plug size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("thirdAi.title")}</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("thirdAi.refresh")}
        </Button>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("thirdAi.statTotal")}
              value={providers.length}
              prefix={<Plug size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("thirdAi.statConnected")}
              value={connected}
              styles={{ content: {  color: "#52c41a"  } }}
              prefix={<CheckCircle size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("thirdAi.statRequests")}
              value={totalRequests}
              prefix={<Zap size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("thirdAi.statAvgAccuracy")}
              value={`${(avgAccuracy * 100).toFixed(1)}%`}
              prefix={<Shield size={16} />}
            />
          </Card>
        </Col>
      </Row>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
              {t("thirdAi.retry")}
            </Button>
          }
        />
      )}
      <Card
        extra={
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setAddOpen(true)}
          >
            {t("thirdAi.addProvider")}
          </Button>
        }
      >
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={providers}
            columns={columns}
            pagination={false}
            size="small"
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
      <Modal
        title={t("thirdAi.addModal")}
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t("thirdAi.form.name")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label={t("thirdAi.form.type")} rules={[{ required: true }]}>
            <Select
              options={[
                { value: "diagnosis", label: t("thirdAi.type.diagnosis") },
                { value: "segmentation", label: t("thirdAi.type.segmentation") },
                { value: "detection", label: t("thirdAi.type.detection") },
                { value: "classification", label: t("thirdAi.type.classification") },
                { value: "nlp", label: t("thirdAi.type.nlp") },
              ]}
            />
          </Form.Item>
          <Form.Item name="endpoint" label={t("thirdAi.form.endpoint")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="model" label={t("thirdAi.form.modelVersion")}>
            <Input placeholder="1.0" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`提供商详情 - ${detail?.name}`}
        open={detail != null}
        onCancel={() => setDetail(null)}
        footer={null}
      >
        {detail && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t("thirdAi.form.name")}>{detail.name}</Descriptions.Item>
            <Descriptions.Item label={t("thirdAi.form.type")}>
              {typeLabel[detail.type] || detail.type}
            </Descriptions.Item>
            <Descriptions.Item label={t("thirdAi.form.modelVersion")}>
              {detail.version}
            </Descriptions.Item>
            <Descriptions.Item label={t("thirdAi.form.endpoint")}>
              {detail.endpoint}
            </Descriptions.Item>
            <Descriptions.Item label={t("thirdAi.descriptions.status")}>
              {statusLabel[detail.status] || detail.status}
            </Descriptions.Item>
            <Descriptions.Item label={t("thirdAi.descriptions.accuracy")}>
              {detail.accuracy != null
                ? `${(detail.accuracy * 100).toFixed(0)}%`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("thirdAi.descriptions.createdAt")}>
              {detail.createdAt}
            </Descriptions.Item>
            <Descriptions.Item label={t("thirdAi.descriptions.description")}>
              {detail.description || "-"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
      <Modal
        title={`模型测试 - ${testResult?.id ?? testBusyId ?? ""}`}
        open={testResult != null || testError !== ""}
        onCancel={() => { setTestResult(null); setTestError(""); }}
        footer={null}
      >
        {testError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            title={t("thirdAi.testFailFallback")}
            description={testError}
          />
        )}
        {testResult && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Alert
              type={testResult.reachable ? "success" : "warning"}
              showIcon
              title={testResult.message}
              description={`端点: ${testResult.endpoint ?? "-"}`}
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t("thirdAi.connectStatus")}>
                <Badge status={testResult.reachable ? "success" : "error"} text={testResult.reachable ? t("thirdAi.normal") : t("thirdAi.timeout")} />
              </Descriptions.Item>
              <Descriptions.Item label={t("thirdAi.latency")}>{testResult.latencyMs} ms</Descriptions.Item>
              <Descriptions.Item label={t("thirdAi.timeoutThreshold")}>{testResult.timeoutMs} ms</Descriptions.Item>
              <Descriptions.Item label={t("thirdAi.testedAt")}>{testResult.testedAt}</Descriptions.Item>
              <Descriptions.Item label={t("thirdAi.outputPreview")}>
                <div style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg-primary)", padding: "8px 12px", borderRadius: 6 }}>
                  {JSON.stringify({ id: testResult.id, reachable: testResult.reachable, status: testResult.status, latencyMs: testResult.latencyMs }, null, 2)}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ThirdPartyAiPage;

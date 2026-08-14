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

const statusLabel: Record<string, string> = {
  active: "已连接",
  inactive: "已断开",
  deprecated: "异常",
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
  diagnosis: "诊断",
  segmentation: "分割",
  detection: "检测",
  classification: "分类",
  nlp: "NLP",
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
      else setError(modelsRes.error?.message ?? "加载失败");
      if (statsRes.success) setStats(statsRes.data);
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
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
      message.success(checked ? "已启用" : "已停用");
    } else {
      message.error(res.error?.message ?? "操作失败");
    }
  };

  const handleDelete = async (record: AiPlatformModel) => {
    const res = await aiPlatformApi.deleteModel(record.id);
    if (res.success) {
      setProviders((prev) => prev.filter((p) => p.id !== record.id));
      message.success("已移除");
    } else {
      message.error(res.error?.message ?? "移除失败");
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
        setTestError(res.error?.message ?? "测试失败");
        setTestResult(null);
      }
    } catch (e) {
      setTestError((e as Error)?.message ?? "测试请求失败");
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
        message.success("已添加");
      } else {
        message.error(res.error?.message ?? "添加失败");
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const columns = [
    {
      title: "名称",
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
      title: "类型",
      dataIndex: "type",
      key: "type",
      render: (v: string) => (
        <Tag color={typeColor[v]}>{typeLabel[v] || v}</Tag>
      ),
    },
    { title: "模型", dataIndex: "version", key: "version" },
    {
      title: "状态",
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
      title: "准确率",
      dataIndex: "accuracy",
      key: "accuracy",
      render: (v?: number) =>
        (v ?? 0) > 0 ? `${((v ?? 0) * 100).toFixed(0)}%` : "-",
    },
    {
      title: "启用",
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
      title: "操作",
      key: "action",
      render: (_: unknown, r: AiPlatformModel) => (
        <Space>
          <Button size="small" type="primary" onClick={() => setDetail(r)}>
            详情
          </Button>
          <Button
            size="small"
            icon={<Zap size={14} />}
            loading={testBusyId === r.id}
            onClick={() => void handleTest(r)}
          >
            测试
          </Button>
          <Button
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={() => void handleDelete(r)}
          >
            移除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Plug size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>第三方 AI 集成</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          刷新
        </Button>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="提供商总数"
              value={providers.length}
              prefix={<Plug size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已连接"
              value={connected}
              styles={{ content: {  color: "#52c41a"  } }}
              prefix={<CheckCircle size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求量"
              value={totalRequests}
              prefix={<Zap size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均准确率"
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
              重试
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
            添加提供商
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
        title="添加第三方 AI 提供商"
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "diagnosis", label: "诊断" },
                { value: "segmentation", label: "分割" },
                { value: "detection", label: "检测" },
                { value: "classification", label: "分类" },
                { value: "nlp", label: "NLP" },
              ]}
            />
          </Form.Item>
          <Form.Item name="endpoint" label="端点" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="model" label="模型版本">
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
            <Descriptions.Item label="名称">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="类型">
              {typeLabel[detail.type] || detail.type}
            </Descriptions.Item>
            <Descriptions.Item label="模型版本">
              {detail.version}
            </Descriptions.Item>
            <Descriptions.Item label="端点">
              {detail.endpoint}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {statusLabel[detail.status] || detail.status}
            </Descriptions.Item>
            <Descriptions.Item label="准确率">
              {detail.accuracy != null
                ? `${(detail.accuracy * 100).toFixed(0)}%`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {detail.createdAt}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
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
            title="测试失败（回退标注）"
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
              <Descriptions.Item label="连通状态">
                <Badge status={testResult.reachable ? "success" : "error"} text={testResult.reachable ? "正常" : "超时"} />
              </Descriptions.Item>
              <Descriptions.Item label="延迟">{testResult.latencyMs} ms</Descriptions.Item>
              <Descriptions.Item label="超时阈值">{testResult.timeoutMs} ms</Descriptions.Item>
              <Descriptions.Item label="测试时间">{testResult.testedAt}</Descriptions.Item>
              <Descriptions.Item label="输出预览">
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

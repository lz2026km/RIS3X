import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  Spin,
  Alert,
} from "antd";
import {
  Crosshair,
  CheckCircle,
  Activity,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { lungCadApi } from "../../services/api/lungCadApi";
import type { LungCadResult } from "../../services/api/lungCadApi";

const { Text } = Typography;

const riskColor: Record<string, string> = {
  low: "green",
  moderate: "orange",
  high: "red",
  very_high: "volcano",
};

const LungCadPage: React.FC = () => {
  const [results, setResults] = useState<LungCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<LungCadResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await lungCadApi.listResults();
      if (res.success) {
        setResults(res.data ?? []);
      } else {
        setError(res.error?.message ?? "加载失败");
        setResults([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = [
    { title: "检查号", dataIndex: "studyId", key: "studyId" },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "模态", dataIndex: "modality", key: "modality" },
    { title: "结节数", dataIndex: "noduleCount", key: "noduleCount" },
    {
      title: "整体风险",
      dataIndex: "overallRisk",
      key: "overallRisk",
      render: (v: string) => <Tag color={riskColor[v]}>{v}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag
          color={
            v === "confirmed" ? "green" : v === "reviewed" ? "blue" : "default"
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, r: LungCadResult) => (
        <Button
          size="small"
          type="primary"
          icon={<Crosshair size={14} />}
          onClick={() => {
            setSelected(r);
            setDetailOpen(true);
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Crosshair size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>肺结节 AI 检测</span>
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
              title="总检测"
              value={results.length}
              prefix={<Activity size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="高风险"
              value={
                results.filter(
                  (r) =>
                    r.overallRisk === "high" || r.overallRisk === "very_high",
                ).length
              }
              prefix={<AlertTriangle size={16} />}
              styles={{ content: {  color: "#ff4d4f"  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已复核"
              value={
                results.filter(
                  (r) => r.status === "reviewed" || r.status === "confirmed",
                ).length
              }
              prefix={<CheckCircle size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总结节数"
              value={results.reduce((s, r) => s + r.noduleCount, 0)}
              prefix={<Crosshair size={16} />}
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
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      )}
      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={results}
            columns={columns}
            pagination={false}
            size="small"
          />
        </Spin>
      </Card>
      <Modal
        title={`肺结节检测 - ${selected?.patientName}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={800}
        footer={null}
      >
        {selected && (
          <>
            <Table
              rowKey="id"
              dataSource={selected.nodules}
              size="small"
              pagination={false}
              columns={[
                {
                  title: "位置",
                  dataIndex: "sliceLocation",
                  key: "sliceLocation",
                  render: (
                    _: unknown,
                    n: {
                      sliceLocation: number;
                      x: number;
                      y: number;
                      z: number;
                    },
                  ) => `层面 ${n.sliceLocation} (${n.x}, ${n.y}, ${n.z})`,
                },
                { title: "直径(mm)", dataIndex: "diameter", key: "diameter" },
                { title: "密度", dataIndex: "density", key: "density" },
                {
                  title: "恶性风险",
                  dataIndex: "malignancyRisk",
                  key: "malignancyRisk",
                  render: (v: number) => `${(v * 100).toFixed(0)}%`,
                },
              ]}
            />
            <Card size="small" style={{ marginTop: 16 }}>
              <Text strong>建议: </Text>
              <Text>{selected.recommendation}</Text>
            </Card>
          </>
        )}
      </Modal>
    </div>
  );
};

export default LungCadPage;

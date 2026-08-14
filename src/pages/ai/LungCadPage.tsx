import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { LungCadResult } from "../../services/api/lungCadApi";
import { useNavigate } from "react-router-dom";
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
  message,
} from "antd";
import {
  Crosshair,
  CheckCircle,
  Activity,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Eye,
  Check,
  X,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { usePagination } from "../../hooks/usePagination";

const { Text } = Typography;

const riskColor: Record<string, string> = {
  low: "green",
  moderate: "orange",
  high: "red",
  very_high: "volcano",
};
const riskLabel: Record<string, string> = {
  low: "低",
  moderate: "中",
  high: "高",
  very_high: "很高",
};

const LungCadPage: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<LungCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<LungCadResult | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  // [v3.0.6.11-95] W4-B P2: 受控分页 (检测结果表 / 结节明细表)
  const resultPagination = usePagination(results, 10);
  const nodulePagination = usePagination(selected?.nodules ?? [], 10);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiDiagnosisApi.listResults<LungCadResult>("lung-cad");
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

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const modelVersion = results[0]?.modelVersion ?? "lungcad-v3.2.1";
      const res = await aiDiagnosisApi.retrainModel(modelVersion);
      if (res.success) {
        message.success(`模型重训已提交: ${res.data?.modelVersion} (${res.data?.status})`);
      } else {
        message.error(res.error?.message ?? "重训提交失败");
      }
    } catch (e) {
      message.error((e as Error)?.message ?? "重训提交失败");
    } finally {
      setRetraining(false);
    }
  };

  const handleBatch = async (status: "confirmed" | "rejected") => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const res = await aiDiagnosisApi.batchConfirm(
        selectedRowKeys.map(String),
        status,
        "lung-cad",
      );
      if (res.success) {
        message.success(`批量${status === "confirmed" ? "确认" : "驳回"} ${selectedRowKeys.length} 条`);
        setSelectedRowKeys([]);
        await load();
      } else {
        message.error(res.error?.message ?? `批量${status === "confirmed" ? "确认" : "驳回"}失败`);
      }
    } catch (e) {
      message.error((e as Error)?.message ?? `批量${status === "confirmed" ? "确认" : "驳回"}失败`);
    } finally {
      setBatchLoading(false);
    }
  };

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
      render: (v: string) => <Tag color={riskColor[v]}>{riskLabel[v] ?? v}</Tag>,
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
        <Space>
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
          <Button
            size="small"
            icon={<Eye size={14} />}
            data-testid={`goto-viewer-${r.id}`}
            onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(r.studyId)}&ai=1`)}
          >
            去阅片叠加
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Crosshair size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>肺结节 AI 检测</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          刷新
        </Button>
        <Button
          size="small"
          icon={<Cpu size={14} />}
          onClick={() => void handleRetrain()}
          loading={retraining}
        >
          重训模型
        </Button>
        {selectedRowKeys.length > 0 && (
          <>
            <Button
              size="small"
              type="primary"
              icon={<Check size={14} />}
              loading={batchLoading}
              onClick={() => void handleBatch("confirmed")}
            >
              批量确认 ({selectedRowKeys.length})
            </Button>
            <Button
              size="small"
              danger
              icon={<X size={14} />}
              loading={batchLoading}
              onClick={() => void handleBatch("rejected")}
            >
              批量驳回 ({selectedRowKeys.length})
            </Button>
          </>
        )}
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
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
              重试
            </Button>
          }
        />
      )}
      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={resultPagination.pageData}
            columns={columns}
            pagination={resultPagination.pagination}
            size="small"
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          scroll={{ x: 'max-content' }}
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
              dataSource={nodulePagination.pageData}
              size="small"
              scroll={{ x: 'max-content' }}
              pagination={nodulePagination.pagination}
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

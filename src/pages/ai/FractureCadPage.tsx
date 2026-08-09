import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { FractureCadResult } from "../../services/api/fractureCadApi";
import {
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Spin,
  Alert,
  Button,
  message,
} from "antd";
import { Activity, RefreshCw, Cpu } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

const severityColor: Record<string, string> = {
  mild: "green",
  moderate: "orange",
  severe: "red",
};

const FractureCadPage: React.FC = () => {
  const [results, setResults] = useState<FractureCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retraining, setRetraining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiDiagnosisApi.listResults<FractureCadResult>("fracture-cad");
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
      const modelVersion = results[0]?.modelVersion ?? "fracturecad-v1.9.3";
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

  useEffect(() => {
    void load();
  }, [load]);

  const columns = [
    { title: "检查号", dataIndex: "studyId", key: "studyId" },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "部位", dataIndex: "bodyPart", key: "bodyPart" },
    { title: "骨折数", dataIndex: "fractureCount", key: "fractureCount" },
    {
      title: "严重度",
      dataIndex: "severity",
      key: "severity",
      render: (v: string) => <Tag color={severityColor[v]}>{v}</Tag>,
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
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>骨折 AI 检测</span>
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
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总检测" value={results.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="严重骨折"
              value={results.filter((r) => r.severity === "severe").length}
              styles={{ content: {  color: "#ff4d4f"  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已复核"
              value={results.filter((r) => r.status !== "auto").length}
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
            dataSource={results}
            columns={columns}
            pagination={false}
            size="small"
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default FractureCadPage;

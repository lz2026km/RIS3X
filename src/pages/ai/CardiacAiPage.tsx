import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { CardiacAiResult } from "../../services/api/cardiacAiApi";
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
import { HeartPulse, RefreshCw, Cpu } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

const cadRadsColor: Record<string, string> = {
  "0": "green",
  "1": "green",
  "2": "blue",
  "3": "orange",
  "4": "red",
  "5": "volcano",
};

const CardiacAiPage: React.FC = () => {
  const [results, setResults] = useState<CardiacAiResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retraining, setRetraining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiDiagnosisApi.listResults<CardiacAiResult>("cardiac-ai");
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
      const modelVersion = results[0]?.modelVersion ?? "cardiacai-v2.4.1";
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

  const avgEf =
    results.filter((r) => r.ejectionFraction != null).length > 0
      ? results
          .filter((r) => r.ejectionFraction != null)
          .reduce((s, r) => s + (r.ejectionFraction ?? 0), 0) /
        results.filter((r) => r.ejectionFraction != null).length
      : 0;

  const columns = [
    { title: "检查号", dataIndex: "studyId", key: "studyId" },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    {
      title: "EF(%)",
      dataIndex: "ejectionFraction",
      key: "ef",
      render: (v?: number) => (v != null ? `${v}%` : "-"),
    },
    {
      title: "CAD-RADS",
      dataIndex: "cadRads",
      key: "cadRads",
      render: (v?: string) =>
        v != null ? <Tag color={cadRadsColor[v]}>{`CAD-RADS ${v}`}</Tag> : "-",
    },
    {
      title: "狭窄数",
      key: "stenosisCount",
      render: (_: unknown, r: CardiacAiResult) => r.stenosis?.length ?? 0,
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
        <HeartPulse size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>心脏 AI 分析</span>
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
            <Statistic title="总分析" value={results.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="CAD-RADS 3+"
              value={
                results.filter(
                  (r) => r.cadRads && ["3", "4", "5"].includes(r.cadRads),
                ).length
              }
              styles={{ content: {  color: "#ff4d4f"  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均EF" value={`${avgEf.toFixed(1)}%`} />
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

export default CardiacAiPage;

import React, { useState, useEffect, useCallback } from "react";
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
} from "antd";
import { Activity, RefreshCw } from "lucide-react";
import { breastCadApi } from "../../services/api/breastCadApi";
import type { BreastCadResult } from "../../services/api/breastCadApi";

const biRadsColor: Record<string, string> = {
  "2": "green",
  "3": "blue",
  "4a": "orange",
  "4b": "volcano",
  "4c": "red",
  "5": "red",
};

const BreastCadPage: React.FC = () => {
  const [results, setResults] = useState<BreastCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await breastCadApi.listResults();
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
    { title: "病灶数", dataIndex: "lesionCount", key: "lesionCount" },
    {
      title: "BI-RADS",
      dataIndex: "overallBiRads",
      key: "overallBiRads",
      render: (v: string) => <Tag color={biRadsColor[v]}>{`BI-RADS ${v}`}</Tag>,
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
        <Activity size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>乳腺 AI 检测</span>
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
            <Statistic title="总检测" value={results.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="BI-RADS 4+"
              value={
                results.filter((r) =>
                  ["4a", "4b", "4c", "5"].includes(r.overallBiRads),
                ).length
              }
              valueStyle={{ color: "#ff4d4f" }}
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
          message={error}
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
    </div>
  );
};

export default BreastCadPage;

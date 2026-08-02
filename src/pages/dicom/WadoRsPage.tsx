import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Button,
  Input,
  Spin,
  Alert,
  Typography,
} from "antd";
import { Globe, Search, Download, RefreshCw } from "lucide-react";
import { wadoRsApi } from "../../services/api/wadoRsApi";
import type { WadoRsStudy } from "../../services/api/wadoRsApi";

const { Text } = Typography;

const WadoRsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [studies, setStudies] = useState<WadoRsStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await wadoRsApi.queryStudies();
      if (res.success) {
        setStudies(res.data ?? []);
      } else {
        setError(res.error?.message ?? "加载失败");
        setStudies([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = studies.filter(
    (s) =>
      s.patientName.toLowerCase().includes(search.toLowerCase()) ||
      s.studyInstanceUid.includes(search),
  );

  const columns = [
    {
      title: "Study UID",
      dataIndex: "studyInstanceUid",
      key: "uid",
      render: (v: string) => (
        <Text copyable style={{ fontSize: 11, fontFamily: "monospace" }}>
          {v}
        </Text>
      ),
    },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "日期", dataIndex: "studyDate", key: "studyDate" },
    { title: "描述", dataIndex: "studyDescription", key: "desc" },
    {
      title: "模态",
      dataIndex: "modality",
      key: "modality",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: "序列", dataIndex: "seriesCount", key: "series" },
    { title: "实例", dataIndex: "instanceCount", key: "instances" },
    {
      title: "操作",
      key: "action",
      render: () => (
        <Button size="small" icon={<Download size={14} />}>
          Retrieve
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>WADO-RS 检索</span>
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
            <Statistic title="检查总数" value={studies.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="实例总数"
              value={studies.reduce((s, r) => s + r.instanceCount, 0)}
            />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input
            prefix={<Search size={14} />}
            placeholder="搜索患者名/Study UID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 400 }}
          />
        </Space>
      </Card>
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
            rowKey="studyInstanceUid"
            dataSource={filtered}
            columns={columns}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Spin>
      </Card>
    </div>
  );
};

export default WadoRsPage;

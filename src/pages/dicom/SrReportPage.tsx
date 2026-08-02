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
  Modal,
  Typography,
  Spin,
  Alert,
  Descriptions,
} from "antd";
import { FileText, CheckCircle, RefreshCw } from "lucide-react";
import { srReportApi } from "../../services/api/srReportApi";
import type { SrReport } from "../../services/api/srReportApi";

const { Text } = Typography;

const typeColor: Record<string, string> = {
  comprehensive: "blue",
  key_object: "purple",
  measurement: "cyan",
  textural: "green",
};

const SrReportPage: React.FC = () => {
  const [reports, setReports] = useState<SrReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<SrReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await srReportApi.listReports();
      if (res.success) {
        setReports(res.data ?? []);
      } else {
        setError(res.error?.message ?? "加载失败");
        setReports([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "标题", dataIndex: "title", key: "title" },
    {
      title: "类型",
      dataIndex: "reportType",
      key: "type",
      render: (v: string) => <Tag color={typeColor[v]}>{v}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag
          color={
            v === "final" ? "green" : v === "amended" ? "volcano" : "orange"
          }
        >
          {v}
        </Tag>
      ),
    },
    { title: "作者", dataIndex: "authorName", key: "author" },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, r: SrReport) => (
        <Button
          size="small"
          icon={<CheckCircle size={14} />}
          onClick={() => setDetail(r)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>SR 结构化报告</span>
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
            <Statistic title="总报告" value={reports.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已定稿"
              value={reports.filter((r) => r.status === "final").length}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="草稿"
              value={reports.filter((r) => r.status === "draft").length}
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
            dataSource={reports}
            columns={columns}
            pagination={false}
            size="small"
          />
        </Spin>
      </Card>
      <Modal
        title={`SR 报告详情 - ${detail?.title}`}
        open={detail != null}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
      >
        {detail && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="患者">
                {detail.patientName} ({detail.patientId})
              </Descriptions.Item>
              <Descriptions.Item label="模态">
                {detail.modality}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={detail.status === "final" ? "green" : "orange"}>
                  {detail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="作者">
                {detail.authorName}
              </Descriptions.Item>
              <Descriptions.Item label="Study UID">
                <Text style={{ fontSize: 11, fontFamily: "monospace" }}>
                  {detail.studyInstanceUid}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <Card size="small" title="影像所见" style={{ marginBottom: 16 }}>
              {detail.content?.findings?.length > 0 ? (
                detail.content.findings.map((f) => (
                  <div key={f.id} style={{ marginBottom: 8 }}>
                    <Tag color="blue">{f.category}</Tag>
                    {f.location && <Tag>{f.location}</Tag>}
                    <span style={{ fontSize: 13 }}>{f.description}</span>
                    {f.measurements && f.measurements.length > 0 && (
                      <div
                        style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}
                      >
                        {f.measurements
                          .map((m) => `${m.name}: ${m.value}${m.unit}`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <Text type="secondary">无发现</Text>
              )}
            </Card>
            <Card size="small" title="结论">
              <Text>{detail.content?.conclusion || "-"}</Text>
            </Card>
            {detail.content?.recommendations && (
              <Card size="small" title="建议" style={{ marginTop: 16 }}>
                <Text>{detail.content.recommendations}</Text>
              </Card>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default SrReportPage;

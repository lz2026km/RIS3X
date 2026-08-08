import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Row,
  Col,
  Statistic,
  Modal,
  Descriptions,
} from "antd";
import {
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
  Plus,
  FileText,
} from "lucide-react";
import {
  radpathApi as radPathApi,
  type RadPathRecord,
  type RadPathStats,
} from "../../services/api/radpathApi";
import { message } from "antd";

const consistencyColor: Record<string, string> = {
  concordant: "#10b981",
  discordant: "#ef4444",
  pending: "#94a3b8",
};
const consistencyLabel: Record<string, string> = {
  concordant: "一致",
  discordant: "不一致",
  pending: "待审",
};

const RadPathPage: React.FC = () => {
  const [records, setRecords] = useState<RadPathRecord[]>([]);
  const [stats, setStats] = useState<RadPathStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<RadPathRecord | null>(
    null,
  );
  const [showDetail, setShowDetail] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchReportId, setMatchReportId] = useState("");
  const [matchPathologyId, setMatchPathologyId] = useState("");
  // [W2-C] 受控分页
  const [recordPage, setRecordPage] = useState(1);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await radPathApi.getRecords();
      if (res.success) setRecords(res.data);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await radPathApi.getStats();
      if (res.success) setStats(res.data);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [fetchRecords, fetchStats]);

  const handleMatch = async () => {
    if (!matchReportId || !matchPathologyId) return;
    try {
      const res = await radPathApi.matchReport(matchReportId, matchPathologyId);
      if (res.success) {
        message.success("匹配成功");
        setShowMatchModal(false);
        fetchRecords();
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      !search ||
      r.reportId.toLowerCase().includes(search.toLowerCase()) ||
      r.report.patient.name.toLowerCase().includes(search.toLowerCase()),
  );

  const columns = [
    {
      title: "报告ID",
      dataIndex: "reportId",
      key: "reportId",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace" }}>{id}</span>
      ),
    },
    {
      title: "病理ID",
      dataIndex: "pathologyId",
      key: "pathologyId",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace" }}>{id}</span>
      ),
    },
    {
      title: "患者",
      key: "patient",
      render: (_: unknown, r: RadPathRecord) => r.report.patient.name,
    },
    {
      title: "检查",
      key: "exam",
      render: (_: unknown, r: RadPathRecord) =>
        r.report.exam
          ? `${r.report.exam.modality}/${r.report.exam.bodyPart}`
          : "-",
    },
    {
      title: "一致性",
      dataIndex: "consistency",
      key: "consistency",
      render: (c: string) => (
        <Tag color={consistencyColor[c]}>{consistencyLabel[c]}</Tag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, r: RadPathRecord) => (
        <Button
          size="small"
          onClick={() => {
            setSelectedRecord(r);
            setShowDetail(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Activity size={20} color="#8b5cf6" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Rad-Path 放射-病理联动</h1>
        <Tag color="purple">影像病理对照</Tag>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总对照数"
              value={stats?.total ?? records.length}
              prefix={<FileText size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="一致"
              value={stats?.concordant ?? 0}
              styles={{ content: {  color: "#52c41a"  } }}
              prefix={<CheckCircle2 size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="不一致"
              value={stats?.discordant ?? 0}
              styles={{ content: {  color: "#ff4d4f"  } }}
              prefix={<XCircle size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="一致率"
              value={stats?.positiveConsistency ?? 0}
              suffix="%"
              prefix={<TrendingUp size={16} />}
            />
          </Card>
        </Col>
      </Row>
      <Card
        extra={
          <Space>
            <Input
              placeholder="搜索"
              prefix={<Search size={14} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setShowMatchModal(true)}
            >
              手动匹配
            </Button>
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => {
                fetchRecords();
                fetchStats();
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredRecords}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: recordPage, pageSize: 10, total: filteredRecords.length, onChange: setRecordPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
          size="small"
        scroll={{ x: 'max-content' }}
        />
      </Card>
      <Modal
        title="Rad-Path 对照详情"
        open={showDetail}
        onCancel={() => {
          setShowDetail(false);
          setSelectedRecord(null);
        }}
        footer={null}
        width={700}
      >
        {selectedRecord && (
          <div>
            <Descriptions
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="报告ID">
                {selectedRecord.reportId}
              </Descriptions.Item>
              <Descriptions.Item label="病理ID">
                {selectedRecord.pathologyId}
              </Descriptions.Item>
              <Descriptions.Item label="一致性">
                <Tag color={consistencyColor[selectedRecord.consistency]}>
                  {consistencyLabel[selectedRecord.consistency]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedRecord.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="影像报告">
                  <div
                    style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}
                  >
                    所见
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      padding: 8,
                      background: "#f8fafc",
                      borderRadius: 4,
                      minHeight: 60,
                    }}
                  >
                    {selectedRecord.radFinding ||
                      selectedRecord.report.findings}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      margin: "12px 0 4px",
                    }}
                  >
                    结论
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      padding: 8,
                      background: "#f8fafc",
                      borderRadius: 4,
                    }}
                  >
                    {selectedRecord.report.conclusion}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="病理报告">
                  <div
                    style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}
                  >
                    病理结果
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      padding: 8,
                      background: "#f0fdf4",
                      borderRadius: 4,
                      minHeight: 100,
                    }}
                  >
                    {selectedRecord.pathResult}
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
      <Modal
        title="手动匹配"
        open={showMatchModal}
        onOk={handleMatch}
        onCancel={() => {
          setShowMatchModal(false);
          setMatchReportId("");
          setMatchPathologyId("");
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>报告ID</div>
          <Input
            value={matchReportId}
            onChange={(e) => setMatchReportId(e.target.value)}
            placeholder="输入影像报告ID"
          />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>病理ID</div>
          <Input
            value={matchPathologyId}
            onChange={(e) => setMatchPathologyId(e.target.value)}
            placeholder="输入病理报告ID"
          />
        </div>
      </Modal>
    </div>
  );
};

export default RadPathPage;

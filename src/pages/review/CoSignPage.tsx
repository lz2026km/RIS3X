import React, { useState, useEffect, useCallback } from "react";
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
  Input,
  message,
  Descriptions,
} from "antd";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  RefreshCw,
  User,
  Eye,
} from "lucide-react";
import {
  coSignApi,
  type CoSignItem,
  type CoSignStats,
} from "../../services/api/cosignApi";

const statusColor: Record<string, string> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
};
const statusLabel: Record<string, string> = {
  pending: "待处理",
  approved: "已通过",
  rejected: "已拒绝",
};

const CoSignPage: React.FC = () => {
  const [items, setItems] = useState<CoSignItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CoSignStats | null>(null);
  const [selectedItem, setSelectedItem] = useState<CoSignItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await coSignApi.getPending();
      if (res.success) setItems(res.data);
    } catch {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await coSignApi.getStats();
      if (res.success) setStats(res.data);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    fetchStats();
  }, [fetchPending, fetchStats]);

  const handleApprove = async (item: CoSignItem) => {
    setActionLoading(true);
    try {
      const res = await coSignApi.approve(item.id, { note: "" });
      if (res.success) {
        message.success("双签通过");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setShowDetail(false);
        fetchStats();
      }
    } catch {
      message.error("操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !rejectReason.trim()) {
      message.warning("请输入拒绝原因");
      return;
    }
    setActionLoading(true);
    try {
      const res = await coSignApi.reject(selectedItem.id, {
        reason: rejectReason,
      });
      if (res.success) {
        message.success("已拒绝");
        setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
        setShowDetail(false);
        setShowRejectModal(false);
        setRejectReason("");
        fetchStats();
      }
    } catch {
      message.error("操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      title: "报告ID",
      dataIndex: "reportId",
      key: "reportId",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace" }}>{id}</span>
      ),
    },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    {
      title: "检查",
      dataIndex: "modality",
      key: "modality",
      render: (m: string) => <Tag color="blue">{m}</Tag>,
    },
    { title: "部位", dataIndex: "bodyPart", key: "bodyPart" },
    {
      title: "提交医生",
      dataIndex: "authorName",
      key: "authorName",
      render: (n: string) => (
        <Space>
          <User size={14} />
          {n}
        </Space>
      ),
    },
    {
      title: "等待(h)",
      dataIndex: "waitingHours",
      key: "waitingHours",
      render: (h: number) => (
        <span style={{ color: h > 24 ? "#ff4d4f" : "#666" }}>{h}h</span>
      ),
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      render: (p: string) => (
        <Tag color={p === "stat" ? "red" : p === "urgent" ? "orange" : "blue"}>
          {p === "stat" ? "加急" : p === "urgent" ? "紧急" : "常规"}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      render: (_: unknown, r: CoSignItem) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          onClick={() => {
            setSelectedItem(r);
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
        <Users size={20} color="#722ed1" />
        <h1 style={{ fontSize: 20, margin: 0 }}>双签 Co-sign 审核</h1>
        <Tag color="purple">报告双签流程</Tag>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="待双签"
              value={
                stats?.pending ??
                items.filter((i) => i.status === "pending").length
              }
              valueStyle={{ color: "#faad14" }}
              prefix={<Clock size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已通过"
              value={stats?.approved ?? 0}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircle2 size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已拒绝"
              value={stats?.rejected ?? 0}
              valueStyle={{ color: "#ff4d4f" }}
              prefix={<XCircle size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="SLA达成率"
              value={stats?.onTimeRate ?? 0}
              suffix="%"
              prefix={<BarChart3 size={16} />}
            />
          </Card>
        </Col>
      </Row>
      <Card
        extra={
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => {
              fetchPending();
              fetchStats();
            }}
          >
            刷新
          </Button>
        }
      >
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
      <Modal
        title="双签详情"
        open={showDetail}
        onCancel={() => {
          setShowDetail(false);
          setSelectedItem(null);
        }}
        footer={
          selectedItem?.status === "pending" && (
            <Space>
              <Button
                onClick={() => {
                  setShowDetail(false);
                  setSelectedItem(null);
                }}
              >
                取消
              </Button>
              <Button
                danger
                onClick={() => setShowRejectModal(true)}
                loading={actionLoading}
              >
                拒绝
              </Button>
              <Button
                type="primary"
                onClick={() => selectedItem && handleApprove(selectedItem)}
                loading={actionLoading}
              >
                通过
              </Button>
            </Space>
          )
        }
        width={600}
      >
        {selectedItem && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="报告ID">
              {selectedItem.reportId}
            </Descriptions.Item>
            <Descriptions.Item label="患者">
              {selectedItem.patientName}
            </Descriptions.Item>
            <Descriptions.Item label="检查">
              {selectedItem.modality}
            </Descriptions.Item>
            <Descriptions.Item label="部位">
              {selectedItem.bodyPart}
            </Descriptions.Item>
            <Descriptions.Item label="提交医生">
              {selectedItem.authorName}
            </Descriptions.Item>
            <Descriptions.Item label="等待时间">
              {selectedItem.waitingHours}h
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
      <Modal
        title="拒绝原因"
        open={showRejectModal}
        onOk={handleReject}
        onCancel={() => {
          setShowRejectModal(false);
          setRejectReason("");
        }}
        confirmLoading={actionLoading}
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入拒绝原因..."
        />
      </Modal>
    </div>
  );
};

export default CoSignPage;

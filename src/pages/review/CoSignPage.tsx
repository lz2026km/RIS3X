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
  Form,
  Select,
  InputNumber,
  Switch,
  Popconfirm,
  Alert,
  Tabs,
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
  Settings2,
  Plus,
  Trash2,
  History,
} from "lucide-react";
import {
  coSignApi,
  type CoSignItem,
  type CoSignStats,
  type CoSignRule,
  type CoSignHistoryEntry,
} from "../../services/api/cosignApi";
import { useTranslation } from "react-i18next";

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
const thresholdLabel: Record<string, string> = {
  CRITICAL: "危急值",
  URGENT: "紧急",
  ALL: "全部",
};

const CoSignPage: React.FC = () => {
  const { t } = useTranslation("v3cosign");
  const [items, setItems] = useState<CoSignItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CoSignStats | null>(null);
  const [selectedItem, setSelectedItem] = useState<CoSignItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // [W2-C] 受控分页
  const [itemPage, setItemPage] = useState(1);
  // [G005 Wave1A] 双签历史 (GET /cosign/history)
  const [activePanel, setActivePanel] = useState("pending");
  const [history, setHistory] = useState<CoSignHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  // [Wave1B P2] 会签规则: 列表 / 新建 / 删除 (coSignApi.getRules·createRule·deleteRule)
  const [rules, setRules] = useState<CoSignRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [ruleCreateOpen, setRuleCreateOpen] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleDeletingKey, setRuleDeletingKey] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState("");
  const [ruleForm] = Form.useForm();

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await coSignApi.getRules();
      if (res.success) setRules(res.data);
    } catch {
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const handleCreateRule = async () => {
    const values = await ruleForm.validateFields();
    setRuleSaving(true);
    setRuleError("");
    try {
      const res = await coSignApi.createRule({
        name: values.name,
        modality: values.modality,
        threshold: values.threshold ?? "ALL",
        cosignerIds: String(values.cosignerIds ?? "")
          .split(/[,，\s]+/)
          .map((s: string) => s.trim())
          .filter(Boolean),
        minReviewers: Number(values.minReviewers) || 1,
        requireCoSign: values.requireCoSign !== false,
      });
      if (res.success) {
        message.success("会签规则已创建");
        setRuleCreateOpen(false);
        ruleForm.resetFields();
        await fetchRules();
      } else {
        setRuleError(res.error?.message ?? "创建失败");
      }
    } catch {
      setRuleError("创建失败");
    } finally {
      setRuleSaving(false);
    }
  };

  const handleDeleteRule = async (key: string) => {
    setRuleDeletingKey(key);
    try {
      const res = await coSignApi.deleteRule(key);
      if (res.success) {
        message.success("会签规则已删除");
        setRules((prev) => prev.filter((r) => r.key !== key));
      } else {
        message.error(res.error?.message ?? "删除失败");
      }
    } catch {
      message.error("删除失败");
    } finally {
      setRuleDeletingKey(null);
    }
  };

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

  // [G005 Wave1A] 双签历史 (GET /cosign/history)
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await coSignApi.getHistory();
      if (res.success) setHistory(res.data?.data ?? []);
      else setHistory([]);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // [G005 Wave1A] 详情: GET /cosign/pending/:id 拉取最新数据
  const openDetail = async (item: CoSignItem) => {
    setSelectedItem(item);
    setShowDetail(true);
    try {
      const res = await coSignApi.getPendingDetail(item.id);
      if (res.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
        setSelectedItem(res.data.data[0] as unknown as CoSignItem);
      }
    } catch {
      /* 详情接口不可用, 保持列表数据 */
    }
  };

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
        fetchPending();
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
        fetchPending();
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
      title: "等待(小时)",
      dataIndex: "waitingHours",
      key: "waitingHours",
      render: (h: number) => (
        <span style={{ color: h > 24 ? "#ff4d4f" : "#666" }}>{h} 小时</span>
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
          onClick={() => void openDetail(r)}
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
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>双签审核</h1>
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
              styles={{ content: {  color: "#faad14"  } }}
              prefix={<Clock size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已通过"
              value={stats?.approved ?? 0}
              styles={{ content: {  color: "#52c41a"  } }}
              prefix={<CheckCircle2 size={16} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已拒绝"
              value={stats?.rejected ?? 0}
              styles={{ content: {  color: "#ff4d4f"  } }}
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
          <Space>
            {/* [Wave1B P2] 会签规则配置入口 */}
            <Button
              icon={<Settings2 size={14} />}
              onClick={() => {
                setShowRulesModal(true);
                void fetchRules();
              }}
            >
              会签规则
            </Button>
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => {
                fetchPending();
                fetchStats();
                void fetchHistory();
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activePanel}
          onChange={(key) => {
            setActivePanel(key);
            if (key === "history") void fetchHistory();
          }}
          items={[
            {
              key: "pending",
              label: (
                <Space size={4}>
                  <Clock size={14} />
                  待双签
                </Space>
              ),
              children: (
                <Table
                  dataSource={items}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ current: itemPage, pageSize: 10, total: items.length, onChange: setItemPage, showSizeChanger: false, showTotal: (tt) => `共 ${tt} 条` }}
                  size="small"
                  scroll={{ x: "max-content" }}
                />
              ),
            },
            {
              key: "history",
              label: (
                <Space size={4}>
                  <History size={14} />
                  {t("historyTitle")}
                </Space>
              ),
              children: (
                <Table
                  dataSource={history}
                  rowKey="id"
                  loading={historyLoading}
                  pagination={{ current: historyPage, pageSize: 10, total: history.length, onChange: setHistoryPage, showSizeChanger: false, showTotal: (tt) => `共 ${tt} 条` }}
                  size="small"
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: t("historyEmpty") }}
                  columns={[
                    {
                      title: t("historyReportId"),
                      dataIndex: "reportId",
                      key: "reportId",
                      render: (id: string) => <span style={{ fontFamily: "monospace" }}>{id || "—"}</span>,
                    },
                    {
                      title: t("historyAction"),
                      dataIndex: "action",
                      key: "action",
                      render: (a: string) => (
                        <Tag color={a === "APPROVE" ? "green" : a === "REJECT" ? "red" : "default"}>
                          {a === "APPROVE" ? t("actionApprove") : a === "REJECT" ? t("actionReject") : a}
                        </Tag>
                      ),
                    },
                    {
                      title: t("historyActor"),
                      dataIndex: "actor",
                      key: "actor",
                      render: (a: string) => (
                        <Space size={4}>
                          <User size={12} />
                          {a || "—"}
                        </Space>
                      ),
                    },
                    {
                      title: t("historyTimestamp"),
                      dataIndex: "timestamp",
                      key: "timestamp",
                      render: (ts: string) => (ts ? new Date(ts).toLocaleString() : "—"),
                    },
                    { title: t("historyDetail"), dataIndex: "detail", key: "detail", ellipsis: true },
                  ]}
                />
              ),
            },
          ]}
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
        extra={
          selectedItem && (
            <Button
              size="small"
              icon={<RefreshCw size={12} />}
              onClick={() => void openDetail(selectedItem)}
            >
              {t("detailRefresh")}
            </Button>
          )
        }
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
            <Descriptions.Item label={t("detailClinicalInfo")} span={2}>
              {selectedItem.clinicalInfo || "—"}
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

      {/* [Wave1B P2] 会签规则管理: coSignApi.getRules / createRule / deleteRule */}
      <Modal
        title={<Space><Settings2 size={16} color="#722ed1" />会签规则</Space>}
        open={showRulesModal}
        onCancel={() => setShowRulesModal(false)}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => {
                setRuleError("");
                ruleForm.resetFields();
                setRuleCreateOpen(true);
              }}
            >
              新建规则
            </Button>
            <Button onClick={() => setShowRulesModal(false)}>关闭</Button>
          </Space>
        }
        width={720}
      >
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          showIcon
          message="规则保存于系统配置"
        />
        <Table
          rowKey="key"
          dataSource={rules}
          size="small"
          loading={rulesLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: "暂无会签规则" }}
          columns={[
            { title: "规则名", dataIndex: "name", key: "name" },
            { title: "模态", dataIndex: "modality", key: "modality", render: (m: string) => <Tag color="blue">{m}</Tag> },
            { title: "阈值", dataIndex: "threshold", key: "threshold", render: (t: string) => <Tag>{thresholdLabel[t] ?? t}</Tag> },
            { title: "会签医师", dataIndex: "cosignerIds", key: "cosignerIds", render: (ids: string[]) => (ids ?? []).join(", ") || "-" },
            { title: "最少复核", dataIndex: "minReviewers", key: "minReviewers", render: (v: number) => v ?? 1 },
            { title: "强制会签", dataIndex: "requireCoSign", key: "requireCoSign", render: (v: boolean) => (v === false ? "否" : "是") },
            {
              title: "操作",
              key: "actions",
              width: 90,
              render: (_: unknown, r: CoSignRule) => (
                <Popconfirm title="删除该规则?" onConfirm={() => void handleDeleteRule(r.key)}>
                  <Button size="small" danger icon={<Trash2 size={12} />} loading={ruleDeletingKey === r.key} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title="新建会签规则"
        open={ruleCreateOpen}
        onOk={() => void handleCreateRule()}
        onCancel={() => setRuleCreateOpen(false)}
        confirmLoading={ruleSaving}
        okText="创建"
        width={520}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          size="small"
          style={{ marginTop: 12 }}
          initialValues={{ modality: "CT", threshold: "ALL", minReviewers: 1, requireCoSign: true }}
        >
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input placeholder="如：危急报告强制双签" />
          </Form.Item>
          <Form.Item name="modality" label="模态" rules={[{ required: true }]}>
            <Select
              options={["CT", "MR", "DR", "DSA", "MG", "GI", "US"].map((m) => ({ value: m, label: m }))}
            />
          </Form.Item>
          <Form.Item name="threshold" label="触发阈值" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "CRITICAL", label: "危急值" },
                { value: "URGENT", label: "紧急" },
                { value: "ALL", label: "全部" },
              ]}
            />
          </Form.Item>
          <Form.Item name="cosignerIds" label="会签医师 ID (逗号分隔)" rules={[{ required: true, message: "至少 1 名会签医师" }]}>
            <Input placeholder="如：dr-005, dr-009" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="minReviewers" label="最少复核人数">
                <InputNumber min={1} max={10} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="requireCoSign" label="强制会签" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          {ruleError && <Alert type="error" showIcon message={ruleError} style={{ marginBottom: 8 }} />}
        </Form>
      </Modal>
    </div>
  );
};

export default CoSignPage;

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Tag,
  Space,
  Row,
  Col,
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
  Typography,
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
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { t } from "../../i18n/appI18n";

const statusColor: Record<string, string> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
};
const statusLabel: Record<string, string> = {
  pending: "coSign.statusPending",
  approved: "coSign.statusApproved",
  rejected: "coSign.statusRejected",
};
const thresholdLabel: Record<string, string> = {
  CRITICAL: "coSign.thresholdCritical",
  URGENT: "coSign.thresholdUrgent",
  ALL: "coSign.thresholdAll",
};

const CoSignPage: React.FC = () => {
  const { t: v3t } = useTranslation("v3cosign");
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
        message.success(t('coSign.ruleCreated'));
        setRuleCreateOpen(false);
        ruleForm.resetFields();
        await fetchRules();
      } else {
        setRuleError(res.error?.message ?? t('coSign.createFailed'));
      }
    } catch {
      setRuleError(t('coSign.createFailed'));
    } finally {
      setRuleSaving(false);
    }
  };

  const handleDeleteRule = async (key: string) => {
    setRuleDeletingKey(key);
    try {
      const res = await coSignApi.deleteRule(key);
      if (res.success) {
        message.success(t('coSign.ruleDeleted'));
        setRules((prev) => prev.filter((r) => r.key !== key));
      } else {
        message.error(res.error?.message ?? t('coSign.deleteFailed'));
      }
    } catch {
      message.error(t('coSign.deleteFailed'));
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
      message.error(t('coSign.loadFailed'));
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
        message.success(t('coSign.approved'));
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setShowDetail(false);
        fetchPending();
        fetchStats();
      }
    } catch {
      message.error(t('coSign.operationFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !rejectReason.trim()) {
      message.warning(t('coSign.rejectReasonRequired'));
      return;
    }
    setActionLoading(true);
    try {
      const res = await coSignApi.reject(selectedItem.id, {
        reason: rejectReason,
      });
      if (res.success) {
        message.success(t('coSign.rejected'));
        setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
        setShowDetail(false);
        setShowRejectModal(false);
        setRejectReason("");
        fetchPending();
        fetchStats();
      }
    } catch {
      message.error(t('coSign.operationFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      title: t('coSign.colReportId'),
      dataIndex: "reportId",
      key: "reportId",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace" }}>{id}</span>
      ),
    },
    { title: t('coSign.colPatient'), dataIndex: "patientName", key: "patientName" },
    {
      title: t('coSign.colModality'),
      dataIndex: "modality",
      key: "modality",
      render: (m: string) => <Tag color="blue">{m}</Tag>,
    },
    { title: t('coSign.colBodyPart'), dataIndex: "bodyPart", key: "bodyPart" },
    {
      title: t('coSign.colAuthor'),
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
      title: t('coSign.colWaitingHours'),
      dataIndex: "waitingHours",
      key: "waitingHours",
      render: (h: number) => (
        <span style={{ color: h > 24 ? "#ff4d4f" : "#666" }}>{h} {t('coSign.hours')}</span>
      ),
    },
    {
      title: t('coSign.colPriority'),
      dataIndex: "priority",
      key: "priority",
      render: (p: string) => (
        <Tag color={p === "stat" ? "red" : p === "urgent" ? "orange" : "blue"}>
          {p === "stat" ? t('coSign.priorityStat') : p === "urgent" ? t('coSign.priorityUrgent') : t('coSign.priorityRoutine')}
        </Tag>
      ),
    },
    {
      title: t('coSign.colStatus'),
      dataIndex: "status",
      key: "status",
      render: (s: string) => <Tag color={statusColor[s]}>{t(statusLabel[s] ?? s)}</Tag>,
    },
    {
      title: t('coSign.colActions'),
      key: "actions",
      render: (_: unknown, r: CoSignItem) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          onClick={() => void openDetail(r)}
        >
          {t('coSign.detail')}
        </Button>
      ),
    },
  ];

  return (
    <PageContainer padding={24}>
      <div
        style={{
          marginBottom: 'var(--space-4, 16px)',
          display: "flex",
          alignItems: "center",
          gap: 'var(--space-2, 8px)',
        }}
      >
        <Users size={20} color="#722ed1" />
        <Typography.Title level={4} style={{ margin: 0 }}>{t('coSign.title')}</Typography.Title>
        <Tag color="purple">{t('coSign.subtitle')}</Tag>
      </div>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard
          title={t('coSign.statPending')}
          value={
            stats?.pending ??
            items.filter((i) => i.status === "pending").length
          }
          color="warning"
          icon={<Clock size={16} />}
        />
        <StatCard
          title={t('coSign.statusApproved')}
          value={stats?.approved ?? 0}
          color="success"
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          title={t('coSign.statusRejected')}
          value={stats?.rejected ?? 0}
          color="error"
          icon={<XCircle size={16} />}
        />
        <StatCard
          title={t('coSign.statSla')}
          value={stats?.onTimeRate ?? 0}
          suffix="%"
          icon={<BarChart3 size={16} />}
        />
      </StatCardGrid>
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
              {t('coSign.rules')}
            </Button>
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => {
                fetchPending();
                fetchStats();
                void fetchHistory();
              }}
            >
              {t('coSign.refresh')}
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
                  {t('coSign.statPending')}
                </Space>
              ),
              children: (
                <DataTable
                  dataSource={items}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ current: itemPage, pageSize: 10, total: items.length, onChange: setItemPage, showSizeChanger: false, showTotal: (total) => t('coSign.totalCount', { total }) }}
                  scroll={{ x: "max-content" }}
                />
              ),
            },
            {
              key: "history",
              label: (
                <Space size={4}>
                  <History size={14} />
                  {v3t("historyTitle")}
                </Space>
              ),
              children: (
                <DataTable
                  dataSource={history}
                  rowKey="id"
                  loading={historyLoading}
                  pagination={{ current: historyPage, pageSize: 10, total: history.length, onChange: setHistoryPage, showSizeChanger: false, showTotal: (total) => t('coSign.totalCount', { total }) }}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: v3t("historyEmpty") }}
                  columns={[
                    {
                      title: v3t("historyReportId"),
                      dataIndex: "reportId",
                      key: "reportId",
                      render: (id: string) => <span style={{ fontFamily: "monospace" }}>{id || "—"}</span>,
                    },
                    {
                      title: v3t("historyAction"),
                      dataIndex: "action",
                      key: "action",
                      render: (a: string) => (
                        <Tag color={a === "APPROVE" ? "green" : a === "REJECT" ? "red" : "default"}>
                          {a === "APPROVE" ? v3t("actionApprove") : a === "REJECT" ? v3t("actionReject") : a}
                        </Tag>
                      ),
                    },
                    {
                      title: v3t("historyActor"),
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
                      title: v3t("historyTimestamp"),
                      dataIndex: "timestamp",
                      key: "timestamp",
                      render: (ts: string) => (ts ? new Date(ts).toLocaleString() : "—"),
                    },
                    { title: v3t("historyDetail"), dataIndex: "detail", key: "detail", ellipsis: true },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={t('coSign.detailTitle')}
        open={showDetail}
        onCancel={() => {
          setShowDetail(false);
          setSelectedItem(null);
        }}
        footer={
          selectedItem?.status === "pending" ? (
            <Space>
              <Button
                onClick={() => {
                  setShowDetail(false);
                  setSelectedItem(null);
                }}
              >
                {t('coSign.cancel')}
              </Button>
              <Button
                danger
                onClick={() => setShowRejectModal(true)}
                loading={actionLoading}
              >
                {t('coSign.reject')}
              </Button>
              <Button
                type="primary"
                onClick={() => selectedItem && handleApprove(selectedItem)}
                loading={actionLoading}
              >
                {t('coSign.approve')}
              </Button>
            </Space>
          ) : null
        }
        width={600}
      >
        {selectedItem && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label={t('coSign.colReportId')}>
              {selectedItem.reportId}
            </Descriptions.Item>
            <Descriptions.Item label={t('coSign.colPatient')}>
              {selectedItem.patientName}
            </Descriptions.Item>
            <Descriptions.Item label={t('coSign.colModality')}>
              {selectedItem.modality}
            </Descriptions.Item>
            <Descriptions.Item label={t('coSign.colBodyPart')}>
              {selectedItem.bodyPart}
            </Descriptions.Item>
            <Descriptions.Item label={t('coSign.colAuthor')}>
              {selectedItem.authorName}
            </Descriptions.Item>
            <Descriptions.Item label={t('coSign.waitingTime')}>
              {selectedItem.waitingHours}h
            </Descriptions.Item>
            <Descriptions.Item label={v3t("detailClinicalInfo")} span={2}>
              {selectedItem.clinicalInfo || "—"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
      <Modal
        title={t('coSign.rejectReasonTitle')}
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
          placeholder={t('coSign.rejectReasonPlaceholder')}
        />
      </Modal>

      {/* [Wave1B P2] 会签规则管理: coSignApi.getRules / createRule / deleteRule */}
      <Modal
        title={<Space><Settings2 size={16} color="#722ed1" />{t('coSign.rules')}</Space>}
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
              {t('coSign.createRule')}
            </Button>
            <Button onClick={() => setShowRulesModal(false)}>{t('coSign.close')}</Button>
          </Space>
        }
        width={720}
      >
        <Alert
          style={{ marginBottom: 'var(--space-3, 12px)' }}
          type="info"
          showIcon
          message={t('coSign.rulesHint')}
        />
        <DataTable
          rowKey="key"
          dataSource={rules}
          loading={rulesLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: t('coSign.noRules') }}
          columns={[
            { title: t('coSign.ruleName'), dataIndex: "name", key: "name" },
            { title: t('coSign.colModality'), dataIndex: "modality", key: "modality", render: (m: string) => <Tag color="blue">{m}</Tag> },
            { title: t('coSign.threshold'), dataIndex: "threshold", key: "threshold", render: (th: string) => <Tag>{t(thresholdLabel[th] ?? 'coSign.thresholdAll')}</Tag> },
            { title: t('coSign.cosigners'), dataIndex: "cosignerIds", key: "cosignerIds", render: (ids: string[]) => (ids ?? []).join(", ") || "-" },
            { title: t('coSign.minReviewers'), dataIndex: "minReviewers", key: "minReviewers", render: (v: number) => v ?? 1 },
            { title: t('coSign.requireCoSign'), dataIndex: "requireCoSign", key: "requireCoSign", render: (v: boolean) => (v === false ? t('coSign.no') : t('coSign.yes')) },
            {
              title: t('coSign.colActions'),
              key: "actions",
              width: 90,
              render: (_: unknown, r: CoSignRule) => (
                <Popconfirm title={t('coSign.confirmDeleteRule')} onConfirm={() => void handleDeleteRule(r.key)}>
                  <Button aria-label="删除" size="small" danger icon={<Trash2 size={12} />} loading={ruleDeletingKey === r.key} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={t('coSign.createRuleTitle')}
        open={ruleCreateOpen}
        onOk={() => void handleCreateRule()}
        onCancel={() => setRuleCreateOpen(false)}
        confirmLoading={ruleSaving}
        okText={t('coSign.create')}
        width={520}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          size="small"
          style={{ marginTop: 'var(--space-3, 12px)' }}
          initialValues={{ modality: "CT", threshold: "ALL", minReviewers: 1, requireCoSign: true }}
        >
          <Form.Item name="name" label={t('coSign.ruleNameField')} rules={[{ required: true, message: t('coSign.ruleNameRequired') }]}>
            <Input placeholder={t('coSign.ruleNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="modality" label={t('coSign.colModality')} rules={[{ required: true }]}>
            <Select
              options={["CT", "MR", "DR", "DSA", "MG", "GI", "US"].map((m) => ({ value: m, label: m }))}
            />
          </Form.Item>
          <Form.Item name="threshold" label={t('coSign.thresholdField')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: "CRITICAL", label: t('coSign.thresholdCritical') },
                { value: "URGENT", label: t('coSign.thresholdUrgent') },
                { value: "ALL", label: t('coSign.thresholdAll') },
              ]}
            />
          </Form.Item>
          <Form.Item name="cosignerIds" label={t('coSign.cosignerIdsLabel')} rules={[{ required: true, message: t('coSign.cosignerIdsRequired') }]}>
            <Input placeholder="如：dr-005, dr-009" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="minReviewers" label={t('coSign.minReviewersField')}>
                <InputNumber min={1} max={10} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="requireCoSign" label={t('coSign.requireCoSign')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          {ruleError && <Alert type="error" showIcon message={ruleError} style={{ marginBottom: 'var(--space-2, 8px)' }} />}
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default CoSignPage;

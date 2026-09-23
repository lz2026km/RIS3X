// [v3.0.6.8-45] PR1: 报告流程核心页面
// 报告全流程操? submit ?review ?sign ?publish + cosign + diff + auditTrail
// 对标: Nuance PowerScribe 360 / 3M CodeAssist / 国内一?RIS
import { reportApi } from "@/services/api/reportApi";
import { ErrorBanner } from "@/components/feedback";
import { REPORT_STATUS_MAP } from "@/utils/statusMaps";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Row,
  Col,
  message,
  Tabs,
  List,
  Empty,
  Statistic,
  Alert,
  InputNumber,
  Modal,
  Timeline,
  Steps,
  Descriptions,
} from "antd";
import {
  CheckCircle2,
  XCircle,
  Edit3,
  History,
  GitBranch,
  FileCheck,
  Shield,
  Send,
  RefreshCw,
  FileText,
  Activity,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const { TextArea } = Input;

// [v3.0.6.11-73] P0 21 态对齐: 后端真实枚举 (backend/prisma enum ReportState)
const REPORT_STATES = Object.keys(REPORT_STATUS_MAP);
const STATE_LABELS: Record<string, string> = REPORT_STATUS_MAP;
const STATE_COLORS: Record<string, string> = {
  PENDING_ASSIGNMENT: "default",
  ASSIGNED: "default",
  WRITING: "orange",
  SUBMITTED: "processing",
  INITIAL_REVIEW: "processing",
  FINAL_REVIEW: "processing",
  CO_SIGN_REVIEW: "cyan",
  REVIEWED: "cyan",
  SIGNING: "blue",
  SIGNED: "blue",
  PUBLISHED: "green",
  AMENDING: "orange",
  AMENDED: "orange",
  WITHDRAWN: "default",
  REJECTED: "red",
  ESCALATED: "purple",
  ARCHIVED: "default",
  RECTIFYING: "orange",
  SUPPLEMENTING: "orange",
  SUPPLEMENTED: "green",
  REDISTRIBUTING: "purple",
};

export const ReportWorkflowPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("workflow");
  // 报告列表
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ status: "", keyword: "" });

  // 当前选中报告
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [actionModal, setActionModal] = useState<{
    type: string;
    report: any;
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionQuality, setActionQuality] = useState(85);
  const [cosignerId, setCosignerId] = useState("D001");

  // 详情数据
  const [diffData, setDiffData] = useState<any>(null);
  const [auditTrail, setAuditTrail] = useState<any>(null);

  // 加载报告列表
  const loadReports = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await reportApi.list({ pageSize: 50 });
      if (r.success) setReports(r.data);
      else setLoadError(t('w9.states.error'));
    } catch (e: any) {
      setLoadError(t('w9.states.error'));
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // 选中报告 ?加载 diff + auditTrail
  const handleSelect = async (r: any) => {
    setSelectedReport(r);
    if (r.id) {
      try {
        const dR = await reportApi.diff(r.id);
        if (dR.success) setDiffData(dR.data);
        const aR = await reportApi.auditTrail(r.id);
        if (aR.success) setAuditTrail(aR.data);
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    }
  };

  // 操作
  const handleAction = async () => {
    if (!actionModal) return;
    const { type, report } = actionModal;
    setLoading(true);
    try {
      let r;
      if (type === "submitReview")
        r = await reportApi.submitForReview(report.id);
      else if (type === "review") r = await reportApi.review(report.id);
      else if (type === "cosign")
        r = await reportApi.cosign(report.id, cosignerId);
      else if (type === "sign") r = await reportApi.sign(report.id);
      else if (type === "reject")
        r = await reportApi.reject(report.id, actionReason);
      else if (type === "publish")
        r = await reportApi.publish(report.id, actionQuality);
      if (r?.success) {
        message.success(`${type} 成功`);
        setActionModal(null);
        setActionReason("");
        await loadReports();
        if (selectedReport?.id === report.id)
          await handleSelect({ ...report, status: r.data?.status });
      } else {
        message.error(`${type} 失败`);
      }
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = reports.filter((r) => {
    if (filter.status && r.status !== filter.status) return false;
    if (
      filter.keyword &&
      !r.patientName?.includes(filter.keyword) &&
      !r.id?.includes(filter.keyword)
    )
      return false;
    return true;
  });

  const stateStats = REPORT_STATES.reduce((acc: any, s) => {
    acc[s] = reports.filter((r) => r.status === s).length;
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, background: "var(--bg-primary)", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('reportWf.title')}</span>
        <Tag color="cyan">PR1 (v3.0.6.8-45)</Tag>
        <Tag color="purple">{t('reportWf.benchmark')}</Tag>
        <Tag color="green">{t('reportWf.endpointsTag')}</Tag>
      </Space>

      {loadError && <ErrorBanner message={loadError} onRetry={() => void loadReports()} retryLabel={t('w9.states.retry')} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {Object.entries(stateStats).map(([s, n]) => (
          <Col span={3} key={s}>
            <Card size="small" hoverable>
              <Statistic
                title={STATE_LABELS[s]}
                value={n as number}
                styles={{ content: { 
                  color:
                    STATE_COLORS[s] === "green"
                      ? "#52c41a"
                      : STATE_COLORS[s] === "red"
                        ? "#ff4d4f"
                        : "#2563eb",
                  fontSize: 20,
                 } }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 工作流操?*/}
        <Tabs.TabPane
          tab={
            <span>
              <GitBranch size={14} /> {t('reportWf.workflowOps')}
            </span>
          }
          key="workflow"
        >
          <Row gutter={16}>
            <Col span={10}>
              <Card
                title={t('reportWf.reportList')}
                size="small"
                extra={
                  <Space>
                    <Select
                      size="small"
                      placeholder={t('reportWf.statusPlaceholder')}
                      value={filter.status || undefined}
                      onChange={(v) => setFilter({ ...filter, status: v })}
                      allowClear
                      style={{ width: 120 }}
                      options={REPORT_STATES.map((s) => ({
                        value: s,
                        label: STATE_LABELS[s],
                      }))}
                    />
                    <Input.Search
                      size="small"
                      placeholder={t('reportWf.searchPatientId')}
                      value={filter.keyword}
                      onChange={(e) =>
                        setFilter({ ...filter, keyword: e.target.value })
                      }
                      style={{ width: 160 }}
                    />
                    <Button
                      icon={<RefreshCw size={12} />}
                      onClick={loadReports}
                    >
                      {t('reportWf.refresh')}
                    </Button>
                  </Space>
                }
              >
                <List
                  size="small"
                  loading={loading}
                  dataSource={filtered}
                  renderItem={(r) => (
                    <List.Item
                      className={
                        selectedReport?.id === r.id
                          ? "ant-list-item-selected"
                          : ""
                      }
                      onClick={() => handleSelect(r)}
                      style={{ cursor: "pointer" }}
                      actions={[
                        <Tag color={STATE_COLORS[r.status]} key="state">
                          {STATE_LABELS[r.status] || r.status}
                        </Tag>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <span>
                            {r.patientName} - {r.modality}
                          </span>
                        }
                        description={
                          <span style={{ fontSize: 11, color: "#999" }}>
                            {r.id} | {r.diagnosis || r.impression || t('reportWf.noDiagnosis')}
                          </span>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            <Col span={14}>
              {selectedReport ? (
                <>
                  <Card
                    title={
                      <Space>
                        <FileText size={16} color="#2563eb" />
                        {t('reportWf.reportDetail')}
                        <Tag color={STATE_COLORS[selectedReport.status]}>
                          {STATE_LABELS[selectedReport.status] ||
                            selectedReport.status}
                        </Tag>
                      </Space>
                    }
                    size="small"
                    extra={
                      <Space wrap>
                        {(selectedReport.status === "WRITING" ||
                          selectedReport.status === "SUBMITTED") && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<Send size={12} />}
                            onClick={() =>
                              setActionModal({
                                type: "submitReview",
                                report: selectedReport,
                              })
                            }
                          >
                            {t('reportWf.submitReview')}
                          </Button>
                        )}
                        {(selectedReport.status === "INITIAL_REVIEW" ||
                          selectedReport.status === "FINAL_REVIEW") && (
                          <>
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckCircle2 size={12} />}
                              onClick={() =>
                                setActionModal({
                                  type: "review",
                                  report: selectedReport,
                                })
                              }
                            >
                              {t('reportWf.approveReview')}
                            </Button>
                            {selectedReport.status === "FINAL_REVIEW" && (
                              <Button
                                size="small"
                                icon={<Edit3 size={12} />}
                                onClick={() =>
                                  setActionModal({
                                    type: "cosign",
                                    report: selectedReport,
                                  })
                                }
                              >
                                {t('reportWf.cosign')}
                              </Button>
                            )}
                            <Button
                              danger
                              size="small"
                              icon={<XCircle size={12} />}
                              onClick={() =>
                                setActionModal({
                                  type: "reject",
                                  report: selectedReport,
                                })
                              }
                            >
                              {t('reportWf.reject')}
                            </Button>
                          </>
                        )}
                        {selectedReport.status === "REVIEWED" && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<Shield size={12} />}
                            onClick={() =>
                              setActionModal({
                                type: "sign",
                                report: selectedReport,
                              })
                            }
                          >
                            {t('reportWf.sign')}
                          </Button>
                        )}
                        {selectedReport.status === "SIGNED" && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<FileCheck size={12} />}
                            onClick={() =>
                              setActionModal({
                                type: "publish",
                                report: selectedReport,
                              })
                            }
                          >
                            {t('reportWf.publish')}
                          </Button>
                        )}
                      </Space>
                    }
                  >
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label={t('reportWf.labelPatient')}>
                        {selectedReport.patientName}
                      </Descriptions.Item>
                      <Descriptions.Item label="ID">
                        {selectedReport.id}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('reportWf.labelModality')}>
                        {selectedReport.modality}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('reportWf.labelBodyPart')}>
                        {selectedReport.bodyPart}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('reportWf.labelDiagnosis')} span={2}>
                        {selectedReport.diagnosis ||
                          selectedReport.impression ||
                          "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('reportWf.labelRecommendation')} span={2}>
                        {selectedReport.recommendations || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('reportWf.labelCreated')}>
                        {selectedReport.createdTime}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('reportWf.labelUpdated')}>
                        {selectedReport.updatedTime}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>

                  <Tabs
                    size="small"
                    style={{ marginTop: 12 }}
                    items={[
                      {
                        key: "diff",
                        label: (
                          <span>
                            <GitBranch size={12} /> {t('reportWf.versionDiff')}
                          </span>
                        ),
                        children: diffData ? (
                          <Card size="small">
                            <pre
                              style={{
                                background: "var(--bg-card)",
                                padding: 12,
                                borderRadius: 4,
                                fontSize: 12,
                              }}
                            >
                              {JSON.stringify(diffData, null, 2)}
                            </pre>
                          </Card>
                        ) : (
                          <Empty description={t('reportWf.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />
                        ),
                      },
                      {
                        key: "audit",
                        label: (
                          <span>
                            <History size={12} /> {t('reportWf.auditTrail')}
                          </span>
                        ),
                        children: auditTrail?.events ? (
                          <Card size="small">
                            <Timeline
                              items={auditTrail.events.map((e: any) => ({
                                color:
                                  STATE_COLORS[e.toState] === "green"
                                    ? "green"
                                    : "red",
                                children: (
                                  <div>
                                    <div>
                                      <b>{e.actor}</b>: {e.action}
                                    </div>
                                    <div
                                      style={{ fontSize: 12, color: "#666" }}
                                    >
                                      {e.fromState} → <b>{e.toState}</b> ·{" "}
                                      {new Date(e.timestamp).toLocaleString(
                                        "zh-CN",
                                      )}
                                    </div>
                                    {e.reason && (
                                      <div
                                        style={{
                                          fontSize: 12,
                                          color: "#f5222d",
                                        }}
                                      >
                                        {t('reportWf.reason')}: {e.reason}
                                      </div>
                                    )}
                                  </div>
                                ),
                              }))}
                            />
                          </Card>
                        ) : (
                          <Empty description={t('reportWf.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />
                        ),
                      },
                    ]}
                  />
                </>
              ) : (
                <Card>
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportWf.selectReportHint')} />
                </Card>
              )}
            </Col>
          </Row>
        </Tabs.TabPane>

        {/* 状态机文档 */}
        <Tabs.TabPane
          tab={
            <span>
              <Activity size={14} /> {t('reportWf.stateMachine')}
            </span>
          }
          key="state"
        >
          <Card>
            <Steps
              orientation="vertical"
              current={REPORT_STATES.indexOf("PUBLISHED")}
              items={REPORT_STATES.map((s) => ({
                title: (
                  <Space>
                    <Tag color={STATE_COLORS[s]}>{STATE_LABELS[s]}</Tag>
                    <span style={{ fontSize: 11, color: "#999" }}>{s}</span>
                  </Space>
                ),
                description: (
                  <span style={{ fontSize: 12, color: "#666" }}>
                    {s === "PENDING_ASSIGNMENT" && t('reportWf.stateDesc.PENDING_ASSIGNMENT')}
                    {s === "ASSIGNED" && t('reportWf.stateDesc.ASSIGNED')}
                    {s === "WRITING" && t('reportWf.stateDesc.WRITING')}
                    {s === "SUBMITTED" && t('reportWf.stateDesc.SUBMITTED')}
                    {s === "INITIAL_REVIEW" && t('reportWf.stateDesc.INITIAL_REVIEW')}
                    {s === "FINAL_REVIEW" && t('reportWf.stateDesc.FINAL_REVIEW')}
                    {s === "CO_SIGN_REVIEW" && t('reportWf.stateDesc.CO_SIGN_REVIEW')}
                    {s === "REVIEWED" && t('reportWf.stateDesc.REVIEWED')}
                    {s === "SIGNING" && t('reportWf.stateDesc.SIGNING')}
                    {s === "SIGNED" && t('reportWf.stateDesc.SIGNED')}
                    {s === "PUBLISHED" && t('reportWf.stateDesc.PUBLISHED')}
                    {s === "AMENDING" && t('reportWf.stateDesc.AMENDING')}
                    {s === "AMENDED" && t('reportWf.stateDesc.AMENDED')}
                    {s === "REJECTED" && t('reportWf.stateDesc.REJECTED')}
                    {s === "RECTIFYING" && t('reportWf.stateDesc.RECTIFYING')}
                    {s === "SUPPLEMENTING" && t('reportWf.stateDesc.SUPPLEMENTING')}
                    {s === "SUPPLEMENTED" && t('reportWf.stateDesc.SUPPLEMENTED')}
                    {s === "WITHDRAWN" && t('reportWf.stateDesc.WITHDRAWN')}
                    {s === "ARCHIVED" && t('reportWf.stateDesc.ARCHIVED')}
                    {s === "ESCALATED" && t('reportWf.stateDesc.ESCALATED')}
                    {s === "REDISTRIBUTING" && t('reportWf.stateDesc.REDISTRIBUTING')}
                  </span>
                ),
                status:
                  STATE_COLORS[s] === "green"
                    ? "finish"
                    : STATE_COLORS[s] === "red"
                      ? "error"
                      : "process",
              }))}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* 操作 Modal */}
      <Modal
        title={
          actionModal
            ? `${actionModal.type} - ${actionModal.report.patientName}`
            : ""
        }
        open={!!actionModal}
        onCancel={() => setActionModal(null)}
        onOk={handleAction}
        confirmLoading={loading}
      >
        {actionModal?.type === "reject" && (
          <>
            <Alert
              title={t('reportWf.rejectReasonTitle')}
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
            />
            <TextArea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={t('reportWf.rejectReasonPlaceholder')}
            />
          </>
        )}
        {actionModal?.type === "publish" && (
          <>
            <Alert
              title={t('reportWf.qualityScoreTitle')}
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
            />
            <InputNumber
              min={0}
              max={100}
              value={actionQuality}
              onChange={(v) => setActionQuality(v || 85)}
              style={{ width: "100%" }}
            />
          </>
        )}
        {actionModal?.type === "cosign" && (
          <>
            <Alert
              title={t('reportWf.selectCosignerTitle')}
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
            />
            <Input
              value={cosignerId}
              onChange={(e) => setCosignerId(e.target.value)}
              placeholder="D001"
            />
          </>
        )}
        {["submitReview", "review", "sign"].includes(
          actionModal?.type || "",
        ) && (
          <Alert
            title={`确认执行 ${actionModal?.type} 操作?`}
            type="info"
            showIcon
          />
        )}
      </Modal>
    </div>
  );
};

export default ReportWorkflowPage;

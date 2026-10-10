/**
 * G005 RIS v3.0.6.11-100 Wave 2A — CommitteeRoomPage 委员会会诊室 (多医生合议)
 * 功能: 会诊列表(标题/报告/成员/状态) + 详情(成员卡片+投票/意见/实时汇总) + 决议生成(→追加报告段落) + 数据源徽标
 * 数据源: consultationApi (GET /consultations/committee · POST committee · committee-vote · committee-resolution · GET :id/committee)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
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
  Radio,
  Checkbox,
  Progress,
  Empty,
  Spin,
  Tooltip,
  Divider,
  Alert,
  Avatar,
} from "antd";
import {
  Users, CheckCircle2, XCircle, RefreshCw, FileText, Plus,
  Scale, MessageSquareQuote, BadgeCheck, Vote, Landmark, ShieldCheck, Eye,
} from "lucide-react";
import {
  consultationApi,
  type CommitteeDto,
  type CommitteeDetailDto,
  type CommitteeMemberDto,
} from "../../services/api/consultationApi";
import { t } from "../../i18n/appI18n";
import { DataTable } from "../../components/common";

const DOCTOR_POOL = [
  { value: "D001", label: "张明远 · 主任医师 · 放射科" },
  { value: "D002", label: "李慧敏 · 副主任医师 · 心内科" },
  { value: "D003", label: "王海涛 · 主任医师 · 神经外科" },
  { value: "D004", label: "陈雅芝 · 主治医师 · 肿瘤科" },
  { value: "D005", label: "刘建国 · 主任医师 · 胸外科" },
];

const STATUS_META: Record<string, { color: string }> = {
  voting: { color: "orange" },
  resolved: { color: "green" },
  cancelled: { color: "default" },
};

const statusLabel = (v: string): string =>
  v === "voting" ? t("committeeRoom.statusVoting")
    : v === "resolved" ? t("committeeRoom.statusResolved")
      : v === "cancelled" ? t("committeeRoom.statusCancelled")
        : v;

const CommitteeRoomPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reportIdParam = searchParams.get("reportId");

  const [committees, setCommittees] = useState<CommitteeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"api" | "mock">("api");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommitteeDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 新建
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // 投票
  const [voteTarget, setVoteTarget] = useState<CommitteeMemberDto | null>(null);
  const [voteOpinion, setVoteOpinion] = useState("");
  const [voteAgree, setVoteAgree] = useState(true);
  const [voteSuggestion, setVoteSuggestion] = useState("");
  const [voteLoading, setVoteLoading] = useState(false);

  // 决议
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [appendToReport, setAppendToReport] = useState(true);
  const [resolutionLoading, setResolutionLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await consultationApi.listCommittees();
      if (res.success && Array.isArray(res.data)) {
        setCommittees(res.data);
        setSource("api");
      } else {
        setCommittees([]);
        setSource("mock");
      }
    } catch {
      setCommittees([]);
      setSource("mock");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await consultationApi.getCommittee(id);
      if (res.success && res.data) {
        setDetail(res.data);
        setSource("api");
      } else {
        setDetail(null);
        setSource("mock");
      }
    } catch {
      setDetail(null);
      setSource("mock");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const selectCommittee = (id: string) => {
    setSelectedId(id);
    setDetail(null);
  };

  // ================= 新建委员会会诊 =================
  const openCreate = () => {
    createForm.setFieldsValue({ reportId: reportIdParam ?? "", title: "", members: [] });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      const res = await consultationApi.createCommittee({
        reportId: String(values.reportId).trim(),
        title: String(values.title).trim(),
        members: values.members as string[],
        createdBy: t("committeeRoom.currentUser"),
      });
      if (res.success && res.data) {
        message.success(`委员会会诊 ${res.data.id} 创建成功`);
        setCreateOpen(false);
        setCommittees((prev) => [res.data!, ...prev]);
        selectCommittee(res.data.id);
      } else {
        message.error(`创建失败:${res.error?.message ?? "未知错误"}`);
      }
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return; // 表单校验错误
      message.error(t("committeeRoom.createFailedNet"));
    } finally {
      setCreateLoading(false);
    }
  };

  // ================= 投票 =================
  const openVote = (member: CommitteeMemberDto) => {
    setVoteTarget(member);
    setVoteOpinion("");
    setVoteAgree(true);
    setVoteSuggestion("");
  };

  const submitVote = async () => {
    if (!detail || !voteTarget) return;
    if (!voteOpinion.trim()) {
      message.warning(t("committeeRoom.opinionRequired"));
      return;
    }
    setVoteLoading(true);
    try {
      const res = await consultationApi.committeeVote(detail.id, {
        memberId: voteTarget.memberId,
        opinion: voteOpinion.trim(),
        agree: voteAgree,
        suggestion: voteSuggestion.trim() || undefined,
      });
      if (res.success && res.data) {
        message.success(`委员 ${voteTarget.name} 已投票`);
        setVoteTarget(null);
        if (selectedId) void loadDetail(selectedId);
      } else {
        message.error(`投票失败:${res.error?.message ?? "未知错误"}`);
      }
    } catch {
      message.error(t("committeeRoom.voteFailedNet"));
    } finally {
      setVoteLoading(false);
    }
  };

  // ================= 决议生成 =================
  const openResolution = () => {
    setResolutionText("");
    setAppendToReport(true);
    setResolutionOpen(true);
  };

  const submitResolution = async () => {
    if (!detail) return;
    if (!resolutionText.trim()) {
      message.warning(t("committeeRoom.resolutionRequired"));
      return;
    }
    setResolutionLoading(true);
    try {
      const res = await consultationApi.committeeResolution(detail.id, {
        resolution: resolutionText.trim(),
        appendToReport,
      });
      if (res.success && res.data) {
        message.success(appendToReport ? t("committeeRoom.resolutionAppended") : t("committeeRoom.resolutionGenerated"));
        setResolutionOpen(false);
        if (selectedId) void loadDetail(selectedId);
        void loadList();
      } else {
        message.error(`生成失败:${res.error?.message ?? "未知错误"}`);
      }
    } catch {
      message.error(t("committeeRoom.resolutionFailedNet"));
    } finally {
      setResolutionLoading(false);
    }
  };

  const summary = detail?.summary;

  const columns = [
    {
      title: t("committeeRoom.colTitle"),
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (_: unknown, r: CommitteeDto) => (
        <Space size={4}>
          <FileText size={13} color="var(--color-primary-800)" />
          <span style={{ fontWeight: 600 }}>{r.title}</span>
        </Space>
      ),
    },
    { title: t("committeeRoom.colReport"), dataIndex: "reportId", key: "reportId", render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: t("committeeRoom.colMembers"),
      key: "members",
      render: (_: unknown, r: CommitteeDto) => (
        <Avatar.Group size="small" max={{ count: 4 }}>
          {r.members.map((m) => (
            <Tooltip key={m.memberId} title={m.name}>
              <Avatar style={{ background: "var(--color-primary-800)" }}>{m.name.slice(0, 1)}</Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: t("committeeRoom.colStatus"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={STATUS_META[v]?.color ?? "default"}>{statusLabel(v)}</Tag>,
    },
    {
      title: t("committeeRoom.colMeta"),
      key: "meta",
      render: (_: unknown, r: CommitteeDto) => (
        <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
          <div>{r.createdBy}</div>
          <div>{new Date(r.createdAt).toLocaleString()}</div>
        </div>
      ),
    },
    {
      title: "",
      key: "action",
      width: 90,
      render: (_: unknown, r: CommitteeDto) => (
        <Button size="small" type={selectedId === r.id ? "primary" : "default"} onClick={() => selectCommittee(r.id)}>
          {selectedId === r.id ? t("committeeRoom.viewing") : t("committeeRoom.viewBtn")}
        </Button>
      ),
    },
  ];

  const memberCards = useMemo(() => detail?.members ?? [], [detail]);

  return (
    <div data-testid="committee-room-page" role="region" aria-label={t("committeeRoom.pageTitle")} style={{ padding: 'var(--space-4, 16px)' }}>
      <style>{`@keyframes cmtBreath { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* ============ 顶栏 ============ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
        <Space size={10}>
          <Landmark size={20} color="#7c3aed" />
          <strong style={{ fontSize: 16 }}>{t("committeeRoom.pageTitle")}</strong>
          <Tag color="purple">{t("committeeRoom.multiDoctor")}</Tag>
          <Tag color={source === "api" ? "green" : "orange"} title={t("committeeRoom.dataSource")}>
            {source === "api" ? t("committeeRoom.liveData") : t("committeeRoom.demoFallback")}
          </Tag>
        </Space>
        <Space>
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => { void loadList(); if (selectedId) void loadDetail(selectedId); }}>
            {t("committeeRoom.refresh")}
          </Button>
          <Button size="small" type="primary" icon={<Plus size={12} />} onClick={openCreate} data-testid="committee-create">
            {t("committeeRoom.startCommittee")}
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<Scale size={14} />}
        message={t("committeeRoom.infoMessage")}
        style={{ marginBottom: 'var(--space-3, 12px)' }}
      />

      <Row gutter={12}>
        {/* ============ 左: 会诊列表 ============ */}
        <Col xs={24} lg={10} xl={9}>
          <Card
            size="small"
            title={<Space><Users size={14} color="#7c3aed" />{t("committeeRoom.listTitle")}<Tag color="purple">{committees.length}</Tag></Space>}
            extra={
              reportIdParam ? <Tag color="blue" icon={<Eye size={10} />}>reportId={reportIdParam}</Tag> : undefined
            }
          >
            <DataTable
              rowKey="id"
              loading={loading}
              dataSource={committees}
              columns={columns}
              pagination={false}
              scroll={{ y: 460 }}
              locale={{ emptyText: <Empty image={<Users size={48} style={{ opacity: 0.35 }} />} description={t("committeeRoom.noCommittees")} /> }}
              onRow={(r) => ({ onClick: () => selectCommittee(r.id), style: { cursor: "pointer" } })}
            />
          </Card>
        </Col>

        {/* ============ 右: 详情 ============ */}
        <Col xs={24} lg={14} xl={15}>
          {!selectedId ? (
            <Card size="small" style={{ minHeight: 520 }}>
              <Empty
                image={<Landmark size={64} style={{ opacity: 0.25 }} />}
                description={
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                    {t("committeeRoom.selectHint")}
                    {reportIdParam && (
                      <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12 }}>
                        {t("committeeRoom.carryReport")} <Tag color="blue">{reportIdParam}</Tag>, {t("committeeRoom.canStart")}
                        <Button size="small" type="link" onClick={openCreate}>{t("committeeRoom.startCommittee")}</Button>
                      </div>
                    )}
                  </div>
                }
              />
            </Card>
          ) : detailLoading ? (
            <Card size="small" style={{ minHeight: 520, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spin /> {t("committeeRoom.loadingDetail")}
            </Card>
          ) : detail ? (
            <Card
              size="small"
              title={
                <Space wrap>
                  <Landmark size={14} color="#7c3aed" />
                  <span>{detail.title}</span>
                  <Tag color={STATUS_META[detail.status]?.color ?? "default"}>{statusLabel(detail.status)}</Tag>
                  <Tag color="blue">{detail.reportId}</Tag>
                  {detail.resolution?.appendedToReport && <Tag color="green">{t("committeeRoom.appendedReport")}</Tag>}
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" icon={<RefreshCw size={11} />} onClick={() => selectedId && void loadDetail(selectedId)}>{t("committeeRoom.refresh")}</Button>
                  {detail.status === "voting" && (
                    <Button size="small" type="primary" icon={<BadgeCheck size={12} />} onClick={openResolution} data-testid="committee-resolve">
                      {t("committeeRoom.generateResolution")}
                    </Button>
                  )}
                </Space>
              }
            >
              {/* 汇总 */}
              {summary && (
                <Row gutter={12} style={{ marginBottom: 'var(--space-3, 12px)' }}>
                  <Col span={4}><Statistic title={t("committeeRoom.statMembers")} value={summary.totalMembers} prefix={<Users size={13} />} /></Col>
                  <Col span={5}><Statistic title={t("committeeRoom.statVoted")} value={summary.votedCount} prefix={<Vote size={13} />} valueStyle={{ color: summary.votedCount === summary.totalMembers ? "#10b981" : "var(--color-warning-500)" }} /></Col>
                  <Col span={5}><Statistic title={t("committeeRoom.statAgree")} value={summary.agreeCount} prefix={<CheckCircle2 size={13} />} valueStyle={{ color: "#10b981" }} /></Col>
                  <Col span={5}><Statistic title={t("committeeRoom.statDisagree")} value={summary.disagreeCount} prefix={<XCircle size={13} />} valueStyle={{ color: "var(--color-error-600)" }} /></Col>
                  <Col span={5}>
                    <Statistic
                      title={t("committeeRoom.statAgreeRate")}
                      value={summary.agreeRate}
                      suffix="%"
                      prefix={<ShieldCheck size={13} />}
                      valueStyle={{ color: summary.agreeRate >= 67 ? "#10b981" : "var(--color-warning-500)" }}
                    />
                  </Col>
                  <Col span={24} style={{ marginTop: 'var(--space-2, 8px)' }}>
                    <Progress
                      percent={summary.agreeRate}
                      success={{ percent: summary.agreeRate }}
                      strokeColor={summary.agreeRate >= 67 ? "#10b981" : "var(--color-warning-500)"}
                      size="small"
                    />
                    {summary.pendingMembers.length > 0 && (
                      <div style={{ fontSize: 12, color: "var(--color-warning-500)", marginTop: 'var(--space-1, 4px)' }}>
                        {t("committeeRoom.pendingVotes")} {summary.pendingMembers.join("、")}
                      </div>
                    )}
                  </Col>
                </Row>
              )}

              <Divider style={{ margin: "8px 0" }}>{t("committeeRoom.memberOpinions")}</Divider>

              {/* 成员卡片 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginBottom: 'var(--space-3, 12px)' }}>
                {memberCards.map((m) => {
                  const voted = !!m.votedAt;
                  return (
                    <div
                      key={m.memberId}
                      data-testid={`committee-member-${m.memberId}`}
                      style={{
                        border: `1px solid ${voted ? (m.agree ? "#10b981" : "var(--color-error-600)") : "var(--border-color)"}`,
                        borderRadius: 8,
                        padding: 10,
                        background: voted ? (m.agree ? "var(--color-success-bg)" : "var(--color-error-bg)") : "var(--bg-card)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
                        <Avatar size="small" style={{ background: "var(--color-primary-800)" }}>{m.name.slice(0, 1)}</Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                            {m.title ?? t("committeeRoom.doctor")} · {m.department ?? "—"}
                          </div>
                        </div>
                        {voted ? (
                          m.agree
                            ? <Tag color="green" icon={<CheckCircle2 size={10} />}>{t("committeeRoom.agree")}</Tag>
                            : <Tag color="red" icon={<XCircle size={10} />}>{t("committeeRoom.disagree")}</Tag>
                        ) : (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-warning-500)", animation: "cmtBreath 1.2s infinite" }} title={t("committeeRoom.pendingVote")} />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginTop: 'var(--space-2, 8px)', lineHeight: 1.6, minHeight: 36 }}>
                        {voted ? m.opinion : t("committeeRoom.notVoted")}
                      </div>
                      {m.suggestion && (
                        <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 'var(--space-1, 4px)', background: "rgba(124,58,237,0.08)", borderRadius: 4, padding: "4px 6px" }}>
                          {t("committeeRoom.suggestion")} {m.suggestion}
                        </div>
                      )}
                      {m.votedAt && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted, #94a3b8)', marginTop: 'var(--space-1, 4px)' }}>{t("committeeRoom.votedAt")} {new Date(m.votedAt).toLocaleString()}</div>
                      )}
                      <div style={{ marginTop: 'var(--space-2, 8px)', textAlign: "right" }}>
                        {detail.status === "voting" && !voted && (
                          <Button size="small" type="primary" ghost icon={<Vote size={11} />} onClick={() => openVote(m)} data-testid={`committee-vote-${m.memberId}`}>
                            {t("committeeRoom.voteAsSelf")}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 决议 */}
              <Divider style={{ margin: "8px 0" }}>{t("committeeRoom.committeeResolution")}</Divider>
              {detail.resolution ? (
                <div style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success-border)", borderRadius: 8, padding: 'var(--space-3, 12px)' }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)', marginBottom: 6 }}>
                    <BadgeCheck size={15} color="#10b981" />
                    <strong style={{ color: "#047857", fontSize: 12 }}>{t("committeeRoom.resolutionGeneratedLabel")}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                      {new Date(detail.resolution.generatedAt).toLocaleString()}
                      {detail.resolution.appendedToReport && (
                        <Tag color="green" style={{ marginLeft: 6 }}>{t("committeeRoom.appendedReportWith")} {detail.resolution.appendedToReport}</Tag>
                      )}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary, #334155)', lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{detail.resolution.resolution}</div>
                </div>
              ) : (
                <Empty
                  image={<MessageSquareQuote size={40} style={{ opacity: 0.3 }} />}
                  description={
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                      {detail.status === "voting" ? t("committeeRoom.resolutionHintVoting") : t("committeeRoom.resolutionHintNone")}
                    </span>
                  }
                  style={{ margin: "8px 0" }}
                />
              )}

              <Descriptions size="small" column={2} style={{ marginTop: 'var(--space-3, 12px)' }}>
                <Descriptions.Item label={t("committeeRoom.createdBy")}>{detail.createdBy}</Descriptions.Item>
                <Descriptions.Item label={t("committeeRoom.createdAt")}>{new Date(detail.createdAt).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label={t("committeeRoom.consultationId")}>{detail.id}</Descriptions.Item>
                <Descriptions.Item label={t("committeeRoom.reportId")}>
                  <Tag color="blue">{detail.reportId}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ) : (
            <Card size="small" style={{ minHeight: 520 }}>
              <Alert type="warning" showIcon message={t("committeeRoom.detailLoadFailed")} description={t("committeeRoom.detailLoadFailedDesc")} />
            </Card>
          )}
        </Col>
      </Row>

      {/* ============ 新建弹窗 ============ */}
      <Modal
        title={<Space><Plus size={14} color="#7c3aed" />{t("committeeRoom.createTitle")}</Space>}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        okText={t("committeeRoom.createOk")}
        cancelText={t("committeeRoom.cancel")}
        confirmLoading={createLoading}
        width={560}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 'var(--space-2, 8px)' }} initialValues={{ reportId: reportIdParam ?? "", title: "", members: [] }}>
          <Form.Item name="reportId" label={t("committeeRoom.formReportId")} rules={[{ required: true, message: t("committeeRoom.formReportIdRequired") }]}>
            <Input placeholder={t("committeeRoom.formReportIdPlaceholder")} data-testid="committee-create-reportid" />
          </Form.Item>
          <Form.Item name="title" label={t("committeeRoom.formTitle")} rules={[{ required: true, message: t("committeeRoom.formTitleRequired") }]}>
            <Input placeholder={t("committeeRoom.formTitlePlaceholder")} data-testid="committee-create-title" />
          </Form.Item>
          <Form.Item name="members" label={t("committeeRoom.formMembers")} rules={[{ required: true, message: t("committeeRoom.formMembersRequired") }]}>
            <Select
              mode="multiple"
              placeholder={t("committeeRoom.formMembersPlaceholder")}
              options={DOCTOR_POOL}
              data-testid="committee-create-members"
            />
          </Form.Item>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            {t("committeeRoom.noteText")}
          </div>
        </Form>
      </Modal>

      {/* ============ 投票弹窗 ============ */}
      <Modal
        title={<Space><Vote size={14} color="#7c3aed" />{t("committeeRoom.voteTitle")} — {voteTarget?.name}</Space>}
        open={!!voteTarget}
        onCancel={() => setVoteTarget(null)}
        onOk={submitVote}
        okText={t("committeeRoom.voteOk")}
        cancelText={t("committeeRoom.cancel")}
        confirmLoading={voteLoading}
        width={560}
        destroyOnHidden
      >
        {voteTarget && (
          <div style={{ marginTop: 'var(--space-2, 8px)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 6 }}>
              {t("committeeRoom.consultationLabel")} {detail?.title} · {t("committeeRoom.reportLabel")} {detail?.reportId}
            </div>
            <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t("committeeRoom.voteStance")}</div>
              <Radio.Group value={voteAgree} onChange={(e) => setVoteAgree(e.target.value)} data-testid="committee-vote-agree">
                <Radio.Button value={true} style={{ color: "#10b981" }}>{t("committeeRoom.agreeOption")}</Radio.Button>
                <Radio.Button value={false} style={{ color: "var(--color-error-600)" }}>{t("committeeRoom.disagreeOption")}</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t("committeeRoom.opinionRequiredLabel")}</div>
              <Input.TextArea
                rows={3}
                value={voteOpinion}
                onChange={(e) => setVoteOpinion(e.target.value)}
                placeholder={t("committeeRoom.opinionPlaceholder")}
                data-testid="committee-vote-opinion"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t("committeeRoom.suggestionOptional")}</div>
              <Input.TextArea
                rows={2}
                value={voteSuggestion}
                onChange={(e) => setVoteSuggestion(e.target.value)}
                placeholder={t("committeeRoom.suggestionPlaceholder")}
                data-testid="committee-vote-suggestion"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ============ 决议弹窗 ============ */}
      <Modal
        title={<Space><BadgeCheck size={14} color="#10b981" />{t("committeeRoom.resolutionTitle")}</Space>}
        open={resolutionOpen}
        onCancel={() => setResolutionOpen(false)}
        onOk={submitResolution}
        okText={t("committeeRoom.resolutionOk")}
        cancelText={t("committeeRoom.cancel")}
        confirmLoading={resolutionLoading}
        width={560}
        destroyOnHidden
      >
        <div style={{ marginTop: 'var(--space-2, 8px)' }}>
          <Alert
            type="info"
            showIcon
            message={`${summary?.votedCount ?? 0}/${summary?.totalMembers ?? 0} 名委员已投票`}
            style={{ marginBottom: 'var(--space-3, 12px)' }}
          />
          <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
            <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t("committeeRoom.resolutionContent")}</div>
            <Input.TextArea
              rows={4}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder={t("committeeRoom.resolutionPlaceholder")}
              data-testid="committee-resolution-text"
            />
          </div>
          <Checkbox
            checked={appendToReport}
            onChange={(e) => setAppendToReport(e.target.checked)}
            data-testid="committee-resolution-append"
          >
            {t("committeeRoom.appendParagraph")} (reportId: {detail?.reportId})
          </Checkbox>
        </div>
      </Modal>
    </div>
  );
};

export default CommitteeRoomPage;

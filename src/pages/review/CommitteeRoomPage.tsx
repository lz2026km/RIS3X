/**
 * G005 RIS v3.0.6.11-100 Wave 2A — CommitteeRoomPage 委员会会诊室 (多医生合议)
 * 功能: 会诊列表(标题/报告/成员/状态) + 详情(成员卡片+投票/意见/实时汇总) + 决议生成(→追加报告段落) + 数据源徽标
 * 数据源: consultationApi (GET /consultations/committee · POST committee · committee-vote · committee-resolution · GET :id/committee)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card, Table, Button, Tag, Space, Row, Col, Statistic, Modal, Input, message,
  Descriptions, Form, Select, Radio, Checkbox, Progress, Empty, Spin, Tooltip, Divider, Alert, Avatar,
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

const DOCTOR_POOL = [
  { value: "D001", label: "张明远 · 主任医师 · 放射科" },
  { value: "D002", label: "李慧敏 · 副主任医师 · 心内科" },
  { value: "D003", label: "王海涛 · 主任医师 · 神经外科" },
  { value: "D004", label: "陈雅芝 · 主治医师 · 肿瘤科" },
  { value: "D005", label: "刘建国 · 主任医师 · 胸外科" },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  voting: { label: "投票中", color: "orange" },
  resolved: { label: "已决议", color: "green" },
  cancelled: { label: "已取消", color: "default" },
};

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
        createdBy: "当前用户",
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
      message.error("创建失败:网络错误");
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
      message.warning("请填写会诊意见");
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
      message.error("投票失败:网络错误");
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
      message.warning("请填写决议内容");
      return;
    }
    setResolutionLoading(true);
    try {
      const res = await consultationApi.committeeResolution(detail.id, {
        resolution: resolutionText.trim(),
        appendToReport,
      });
      if (res.success && res.data) {
        message.success(appendToReport ? "决议已生成并追加到报告" : "决议已生成");
        setResolutionOpen(false);
        if (selectedId) void loadDetail(selectedId);
        void loadList();
      } else {
        message.error(`生成失败:${res.error?.message ?? "未知错误"}`);
      }
    } catch {
      message.error("生成失败:网络错误");
    } finally {
      setResolutionLoading(false);
    }
  };

  const summary = detail?.summary;

  const columns = [
    {
      title: "会诊标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (_: unknown, r: CommitteeDto) => (
        <Space size={4}>
          <FileText size={13} color="#1e40af" />
          <span style={{ fontWeight: 600 }}>{r.title}</span>
        </Space>
      ),
    },
    { title: "关联报告", dataIndex: "reportId", key: "reportId", render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: "成员",
      key: "members",
      render: (_: unknown, r: CommitteeDto) => (
        <Avatar.Group size="small" max={{ count: 4 }}>
          {r.members.map((m) => (
            <Tooltip key={m.memberId} title={m.name}>
              <Avatar style={{ background: "#1e40af" }}>{m.name.slice(0, 1)}</Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={STATUS_META[v]?.color ?? "default"}>{STATUS_META[v]?.label ?? v}</Tag>,
    },
    {
      title: "创建人/时间",
      key: "meta",
      render: (_: unknown, r: CommitteeDto) => (
        <div style={{ fontSize: 12, color: "#64748b" }}>
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
          {selectedId === r.id ? "查看中" : "查看"}
        </Button>
      ),
    },
  ];

  const memberCards = useMemo(() => detail?.members ?? [], [detail]);

  return (
    <div data-testid="committee-room-page" role="region" aria-label="委员会会诊室" style={{ padding: 16 }}>
      <style>{`@keyframes cmtBreath { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* ============ 顶栏 ============ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Space size={10}>
          <Landmark size={20} color="#7c3aed" />
          <strong style={{ fontSize: 16 }}>委员会会诊室</strong>
          <Tag color="purple">多医生合议</Tag>
          <Tag color={source === "api" ? "green" : "orange"} title="委员会数据源">
            {source === "api" ? "实时数据" : "演示回退"}
          </Tag>
        </Space>
        <Space>
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => { void loadList(); if (selectedId) void loadDetail(selectedId); }}>
            刷新
          </Button>
          <Button size="small" type="primary" icon={<Plus size={12} />} onClick={openCreate} data-testid="committee-create">
            发起委员会会诊
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<Scale size={14} />}
        message="委员会会诊: 由 ≥2 名高年资医师对疑难/危急报告独立投票合议, 全部投票后生成委员会决议, 可一键追加为报告「决议」段落。"
        style={{ marginBottom: 12 }}
      />

      <Row gutter={12}>
        {/* ============ 左: 会诊列表 ============ */}
        <Col xs={24} lg={10} xl={9}>
          <Card
            size="small"
            title={<Space><Users size={14} color="#7c3aed" />委员会会诊列表<Tag color="purple">{committees.length}</Tag></Space>}
            extra={
              reportIdParam ? <Tag color="blue" icon={<Eye size={10} />}>reportId={reportIdParam}</Tag> : undefined
            }
          >
            <Table
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={committees}
              columns={columns}
              pagination={false}
              scroll={{ y: 460 }}
              locale={{ emptyText: <Empty image={<Users size={48} style={{ opacity: 0.35 }} />} description="暂无委员会会诊" /> }}
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
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    从左侧选择委员会会诊查看详情
                    {reportIdParam && (
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        当前携带报告 <Tag color="blue">{reportIdParam}</Tag>, 可直接
                        <Button size="small" type="link" onClick={openCreate}>发起委员会会诊</Button>
                      </div>
                    )}
                  </div>
                }
              />
            </Card>
          ) : detailLoading ? (
            <Card size="small" style={{ minHeight: 520, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spin /> 加载会诊详情…
            </Card>
          ) : detail ? (
            <Card
              size="small"
              title={
                <Space wrap>
                  <Landmark size={14} color="#7c3aed" />
                  <span>{detail.title}</span>
                  <Tag color={STATUS_META[detail.status]?.color ?? "default"}>{STATUS_META[detail.status]?.label ?? detail.status}</Tag>
                  <Tag color="blue">{detail.reportId}</Tag>
                  {detail.resolution?.appendedToReport && <Tag color="green">已追加报告</Tag>}
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" icon={<RefreshCw size={11} />} onClick={() => selectedId && void loadDetail(selectedId)}>刷新</Button>
                  {detail.status === "voting" && (
                    <Button size="small" type="primary" icon={<BadgeCheck size={12} />} onClick={openResolution} data-testid="committee-resolve">
                      生成决议
                    </Button>
                  )}
                </Space>
              }
            >
              {/* 汇总 */}
              {summary && (
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col span={4}><Statistic title="成员数" value={summary.totalMembers} prefix={<Users size={13} />} /></Col>
                  <Col span={5}><Statistic title="已投票" value={summary.votedCount} prefix={<Vote size={13} />} valueStyle={{ color: summary.votedCount === summary.totalMembers ? "#10b981" : "#f59e0b" }} /></Col>
                  <Col span={5}><Statistic title="同意" value={summary.agreeCount} prefix={<CheckCircle2 size={13} />} valueStyle={{ color: "#10b981" }} /></Col>
                  <Col span={5}><Statistic title="反对" value={summary.disagreeCount} prefix={<XCircle size={13} />} valueStyle={{ color: "#dc2626" }} /></Col>
                  <Col span={5}>
                    <Statistic
                      title="同意率"
                      value={summary.agreeRate}
                      suffix="%"
                      prefix={<ShieldCheck size={13} />}
                      valueStyle={{ color: summary.agreeRate >= 67 ? "#10b981" : "#f59e0b" }}
                    />
                  </Col>
                  <Col span={24} style={{ marginTop: 8 }}>
                    <Progress
                      percent={summary.agreeRate}
                      success={{ percent: summary.agreeRate }}
                      strokeColor={summary.agreeRate >= 67 ? "#10b981" : "#f59e0b"}
                      size="small"
                    />
                    {summary.pendingMembers.length > 0 && (
                      <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 4 }}>
                        待投票: {summary.pendingMembers.join("、")}
                      </div>
                    )}
                  </Col>
                </Row>
              )}

              <Divider style={{ margin: "8px 0" }}>成员意见</Divider>

              {/* 成员卡片 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginBottom: 12 }}>
                {memberCards.map((m) => {
                  const voted = !!m.votedAt;
                  return (
                    <div
                      key={m.memberId}
                      data-testid={`committee-member-${m.memberId}`}
                      style={{
                        border: `1px solid ${voted ? (m.agree ? "#10b981" : "#dc2626") : "var(--border-color)"}`,
                        borderRadius: 8,
                        padding: 10,
                        background: voted ? (m.agree ? "var(--color-success-bg)" : "var(--color-error-bg)") : "var(--bg-card)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar size="small" style={{ background: "#1e40af" }}>{m.name.slice(0, 1)}</Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {m.title ?? "医师"} · {m.department ?? "—"}
                          </div>
                        </div>
                        {voted ? (
                          m.agree
                            ? <Tag color="green" icon={<CheckCircle2 size={10} />}>同意</Tag>
                            : <Tag color="red" icon={<XCircle size={10} />}>反对</Tag>
                        ) : (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", animation: "cmtBreath 1.2s infinite" }} title="待投票" />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 8, lineHeight: 1.6, minHeight: 36 }}>
                        {voted ? m.opinion : "尚未投票"}
                      </div>
                      {m.suggestion && (
                        <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 4, background: "rgba(124,58,237,0.08)", borderRadius: 4, padding: "4px 6px" }}>
                          建议: {m.suggestion}
                        </div>
                      )}
                      {m.votedAt && (
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>投票于 {new Date(m.votedAt).toLocaleString()}</div>
                      )}
                      <div style={{ marginTop: 8, textAlign: "right" }}>
                        {detail.status === "voting" && !voted && (
                          <Button size="small" type="primary" ghost icon={<Vote size={11} />} onClick={() => openVote(m)} data-testid={`committee-vote-${m.memberId}`}>
                            以本人身份投票
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 决议 */}
              <Divider style={{ margin: "8px 0" }}>委员会决议</Divider>
              {detail.resolution ? (
                <div style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success-border)", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <BadgeCheck size={15} color="#10b981" />
                    <strong style={{ color: "#047857", fontSize: 13 }}>决议已生成</strong>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      {new Date(detail.resolution.generatedAt).toLocaleString()}
                      {detail.resolution.appendedToReport && (
                        <Tag color="green" style={{ marginLeft: 6 }}>已追加报告 {detail.resolution.appendedToReport}</Tag>
                      )}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{detail.resolution.resolution}</div>
                </div>
              ) : (
                <Empty
                  image={<MessageSquareQuote size={40} style={{ opacity: 0.3 }} />}
                  description={
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {detail.status === "voting" ? "委员全部投票后可生成委员会决议 (可追加为报告段落)" : "该会诊尚未生成决议"}
                    </span>
                  }
                  style={{ margin: "8px 0" }}
                />
              )}

              <Descriptions size="small" column={2} style={{ marginTop: 12 }}>
                <Descriptions.Item label="创建人">{detail.createdBy}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{new Date(detail.createdAt).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="会诊 ID">{detail.id}</Descriptions.Item>
                <Descriptions.Item label="报告 ID">
                  <Tag color="blue">{detail.reportId}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ) : (
            <Card size="small" style={{ minHeight: 520 }}>
              <Alert type="warning" showIcon message="会诊详情加载失败" description="可能后端/MSW 未就绪, 请刷新重试" />
            </Card>
          )}
        </Col>
      </Row>

      {/* ============ 新建弹窗 ============ */}
      <Modal
        title={<Space><Plus size={14} color="#7c3aed" />发起委员会会诊</Space>}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        okText="创建并进入会诊室"
        cancelText="取消"
        confirmLoading={createLoading}
        width={560}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 8 }} initialValues={{ reportId: reportIdParam ?? "", title: "", members: [] }}>
          <Form.Item name="reportId" label="关联报告 ID" rules={[{ required: true, message: "请填写报告 ID" }]}>
            <Input placeholder="如: RPT-038 / rpt-038" data-testid="committee-create-reportid" />
          </Form.Item>
          <Form.Item name="title" label="会诊标题" rules={[{ required: true, message: "请填写会诊标题" }]}>
            <Input placeholder="如: 主动脉夹层影像学诊断委员会合议" data-testid="committee-create-title" />
          </Form.Item>
          <Form.Item name="members" label="会诊委员 (≥1 人)" rules={[{ required: true, message: "请至少选择 1 名委员" }]}>
            <Select
              mode="multiple"
              placeholder="选择高年资医师"
              options={DOCTOR_POOL}
              data-testid="committee-create-members"
            />
          </Form.Item>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            委员将独立投票 (同意/反对 + 书面意见), 全部投票后由发起人生成委员会决议。
          </div>
        </Form>
      </Modal>

      {/* ============ 投票弹窗 ============ */}
      <Modal
        title={<Space><Vote size={14} color="#7c3aed" />委员投票 — {voteTarget?.name}</Space>}
        open={!!voteTarget}
        onCancel={() => setVoteTarget(null)}
        onOk={submitVote}
        okText="提交投票"
        cancelText="取消"
        confirmLoading={voteLoading}
        width={520}
        destroyOnHidden
      >
        {voteTarget && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              会诊: {detail?.title} · 报告 {detail?.reportId}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>投票立场</div>
              <Radio.Group value={voteAgree} onChange={(e) => setVoteAgree(e.target.value)} data-testid="committee-vote-agree">
                <Radio.Button value={true} style={{ color: "#10b981" }}>同意</Radio.Button>
                <Radio.Button value={false} style={{ color: "#dc2626" }}>反对</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>会诊意见 (必填)</div>
              <Input.TextArea
                rows={3}
                value={voteOpinion}
                onChange={(e) => setVoteOpinion(e.target.value)}
                placeholder="如: CTA 见内膜片及真假腔, 支持主动脉夹层诊断。"
                data-testid="committee-vote-opinion"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>补充建议 (选填)</div>
              <Input.TextArea
                rows={2}
                value={voteSuggestion}
                onChange={(e) => setVoteSuggestion(e.target.value)}
                placeholder="如: 建议急诊超声进一步评估"
                data-testid="committee-vote-suggestion"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ============ 决议弹窗 ============ */}
      <Modal
        title={<Space><BadgeCheck size={14} color="#10b981" />生成委员会决议</Space>}
        open={resolutionOpen}
        onCancel={() => setResolutionOpen(false)}
        onOk={submitResolution}
        okText="生成决议"
        cancelText="取消"
        confirmLoading={resolutionLoading}
        width={560}
        destroyOnHidden
      >
        <div style={{ marginTop: 8 }}>
          <Alert
            type="info"
            showIcon
            message={`${summary?.votedCount ?? 0}/${summary?.totalMembers ?? 0} 名委员已投票`}
            style={{ marginBottom: 12 }}
          />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>决议内容 (综合委员意见)</div>
            <Input.TextArea
              rows={4}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="如: 委员会一致同意主动脉夹层诊断成立, 建议立即启动急诊手术评估。"
              data-testid="committee-resolution-text"
            />
          </div>
          <Checkbox
            checked={appendToReport}
            onChange={(e) => setAppendToReport(e.target.checked)}
            data-testid="committee-resolution-append"
          >
            追加为报告「决议」段落 (reportId: {detail?.reportId})
          </Checkbox>
        </div>
      </Modal>
    </div>
  );
};

export default CommitteeRoomPage;

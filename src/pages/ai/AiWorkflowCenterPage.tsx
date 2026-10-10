// [G005 W4-AI] AI 工作流中心 (概念 UI, 确定性模拟)
// 分诊队列 / 审核采纳统计 / 质量控制 / 多模态报告助手
// 数据来源: src/services/ai/aiPlatformData.ts (seeded by id, 无 Math.random)
import React, { useCallback, useMemo, useState } from "react";
import {
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  Hand,
  ListChecks,
  Pencil,
  Quote,
  RefreshCw,
  ShieldAlert,
  Siren,
  Sparkles,
} from "lucide-react";
import {
  ActionButton,
  PageContainer,
  PageHeader,
  StatCard,
  StatCardGrid,
} from "../../components/common";
import { DataTable } from "../../components/common/DataTable";
import { t } from "../../i18n/appI18n";
import { severityColor, severityToAntd, toneToAntd } from "../../theme/statusTokens";
import {
  getAiModelCatalog,
  getDriftAlerts,
  getErrorReviewQueue,
  getModelReviewStats,
  getQcImageChecks,
  getReportAssistantDraft,
  getTriageQueue,
  getWeeklyAdoptionTrend,
  type AiModelEntry,
  type DriftAlert,
  type ErrorReviewItem,
  type ReportGuardrailKey,
  type ReportSuggestion,
  type TriagePriority,
  type TriageQueueItem,
  type TriageStatus,
} from "../../services/ai/aiPlatformData";

const { Text, Paragraph } = Typography;

const PRIORITY_COLOR: Record<TriagePriority, string> = {
  CRITICAL: severityToAntd("critical"),
  URGENT: severityToAntd("urgent"),
  SEMI: severityToAntd("warning"),
  ROUTINE: severityToAntd("normal"),
};

const PRIORITY_BAR: Record<TriagePriority, string> = {
  CRITICAL: severityColor("critical"),
  URGENT: severityColor("urgent"),
  SEMI: severityColor("warning"),
  ROUTINE: severityColor("normal"),
};

const PRIORITY_I18N: Record<TriagePriority, string> = {
  CRITICAL: "w4ai.priority.CRITICAL",
  URGENT: "w4ai.priority.URGENT",
  SEMI: "w4ai.priority.SEMI",
  ROUTINE: "w4ai.priority.ROUTINE",
};

const TRIAGE_STATUS_COLOR: Record<TriageStatus, string> = {
  pending: toneToAntd("pending"),
  reviewing: toneToAntd("in_progress"),
  holded: toneToAntd("on_hold"),
  adopted: toneToAntd("approved"),
};

const TRIAGE_STATUS_I18N: Record<TriageStatus, string> = {
  pending: "w4ai.triageStatus.pending",
  reviewing: "w4ai.triageStatus.reviewing",
  holded: "w4ai.triageStatus.holded",
  adopted: "w4ai.triageStatus.adopted",
};

const SEVERITY_COLOR: Record<DriftAlert["severity"], string> = {
  high: severityToAntd("high"),
  medium: severityToAntd("warning"),
  low: severityToAntd("info"),
};

const SEVERITY_I18N: Record<DriftAlert["severity"], string> = {
  high: "w4ai.qc.severity.high",
  medium: "w4ai.qc.severity.medium",
  low: "w4ai.qc.severity.low",
};

const METRIC_I18N: Record<DriftAlert["metric"], string> = {
  accuracy: "w4ai.qc.metric.accuracy",
  sensitivity: "w4ai.qc.metric.sensitivity",
  specificity: "w4ai.qc.metric.specificity",
};

const DOCTORS: { value: string; label: string }[] = [
  { value: "D1008", label: "D1008 · 张医师" },
  { value: "D1012", label: "D1012 · 李医师" },
  { value: "D1015", label: "D1015 · 王医师" },
];

function scoreColor(score: number): string {
  if (score >= 70) return severityColor("critical");
  if (score >= 42) return severityColor("warning");
  return severityColor("success");
}

/* ------------------------------------------------------------------ */
/* Tab 1: AI 优先级分诊队列                                            */
/* ------------------------------------------------------------------ */

const TriageTab: React.FC = () => {
  const [queue, setQueue] = useState<TriageQueueItem[]>(() =>
    [...getTriageQueue()].sort((a, b) => b.aiScore - a.aiScore),
  );
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [doctor, setDoctor] = useState<string>("D1008");

  const move = useCallback((index: number, dir: -1 | 1) => {
    setQueue((prev) => {
      const next = [...prev];
      const target = index + dir;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }, []);

  const setStatus = useCallback((id: string, status: TriageStatus) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }, []);

  const handleAssign = useCallback(() => {
    if (selectedKeys.length === 0) {
      message.warning(t("w4ai.triage.selectFirst"));
      return;
    }
    const keySet = new Set(selectedKeys.map((k) => String(k)));
    setQueue((prev) =>
      prev.map((item) =>
        keySet.has(item.id)
          ? { ...item, assignedDoctor: doctor, status: "reviewing" as TriageStatus }
          : item,
      ),
    );
    message.success(
      t("w4ai.triage.assignOk", {
        count: selectedKeys.length,
        doctor: DOCTORS.find((d) => d.value === doctor)?.label ?? doctor,
      }),
    );
    setSelectedKeys([]);
  }, [selectedKeys, doctor]);

  const columns: TableColumnsType<TriageQueueItem> = useMemo(
    () => [
      {
        title: t("w4ai.triage.col.patient"),
        key: "patient",
        width: 130,
        fixed: "left",
        render: (_: unknown, r: TriageQueueItem) => (
          <div>
            <Text strong>{r.patientName}</Text>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>
              {r.sex} · {r.age}
            </div>
          </div>
        ),
      },
      {
        title: t("w4ai.triage.col.exam"),
        key: "exam",
        width: 200,
        render: (_: unknown, r: TriageQueueItem) => (
          <div>
            <div style={{ fontSize: 12 }}>{r.examNo}</div>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>{r.examItem}</div>
          </div>
        ),
      },
      {
        title: t("w4ai.triage.col.modalityBody"),
        key: "modalityBody",
        width: 120,
        render: (_: unknown, r: TriageQueueItem) => (
          <Space size={4}>
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {r.modality}
            </Tag>
            <Tag style={{ marginInlineEnd: 0 }}>{r.bodyPart}</Tag>
          </Space>
        ),
      },
      {
        title: t("w4ai.triage.col.aiScore"),
        dataIndex: "aiScore",
        key: "aiScore",
        width: 150,
        render: (score: number, r: TriageQueueItem) => (
          <Space size={6}>
            <Text strong style={{ width: 26, color: PRIORITY_BAR[r.priority] }}>
              {score}
            </Text>
            <div style={{ width: 72 }}>
              <Progress
                percent={score}
                showInfo={false}
                size="small"
                strokeColor={PRIORITY_BAR[r.priority]}
              />
            </div>
          </Space>
        ),
      },
      {
        title: t("w4ai.triage.col.priority"),
        dataIndex: "priority",
        key: "priority",
        width: 100,
        render: (p: TriagePriority) => <Tag color={PRIORITY_COLOR[p]}>{t(PRIORITY_I18N[p])}</Tag>,
      },
      {
        title: t("w4ai.triage.col.suggestion"),
        key: "suggestion",
        width: 170,
        render: (_: unknown, r: TriageQueueItem) =>
          r.suggestionPositive ? (
            <Tag color="red">{t(`w4ai.sug.${r.suggestion}`)}</Tag>
          ) : (
            <Tag>{t("w4ai.sug.none")}</Tag>
          ),
      },
      {
        title: t("w4ai.triage.col.confidence"),
        dataIndex: "confidence",
        key: "confidence",
        width: 90,
        render: (v: number) => `${v.toFixed(1)}%`,
      },
      {
        title: t("w4ai.triage.col.status"),
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (s: TriageStatus, r: TriageQueueItem) => (
          <Space size={4}>
            <Tag color={TRIAGE_STATUS_COLOR[s]}>{t(TRIAGE_STATUS_I18N[s])}</Tag>
            {r.assignedDoctor ? (
              <Tooltip title={`${t("w4ai.triage.assigned")}: ${r.assignedDoctor}`}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {r.assignedDoctor}
                </Text>
              </Tooltip>
            ) : null}
          </Space>
        ),
      },
      {
        title: t("w4ai.triage.col.actions"),
        key: "actions",
        width: 300,
        fixed: "right",
        render: (_: unknown, r: TriageQueueItem, index: number) => (
          <Space size={[4, 4]} wrap>
            <ActionButton
              action="refresh"
              size="compact"
              icon={<ArrowUp size={13} />}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              title={t("w4ai.triage.moveUp")}
              aria-label={t("w4ai.triage.moveUp")}
            />
            <ActionButton
              action="refresh"
              size="compact"
              icon={<ArrowDown size={13} />}
              disabled={index === queue.length - 1}
              onClick={() => move(index, 1)}
              title={t("w4ai.triage.moveDown")}
              aria-label={t("w4ai.triage.moveDown")}
            />
            <ActionButton
              action="edit"
              size="compact"
              icon={<Hand size={13} />}
              onClick={() => {
                setStatus(r.id, "holded");
                message.success(t("w4ai.triage.holdOk", { name: r.patientName }));
              }}
            >
              {t("w4ai.triage.hold")}
            </ActionButton>
            <ActionButton
              action="edit"
              size="compact"
              icon={<Gauge size={13} />}
              onClick={() => {
                setStatus(r.id, "reviewing");
                message.success(t("w4ai.triage.reviewOk", { name: r.patientName }));
              }}
            >
              {t("w4ai.triage.review")}
            </ActionButton>
            <ActionButton
              action="submit"
              size="compact"
              icon={<CheckCircle2 size={13} />}
              onClick={() => {
                setStatus(r.id, "adopted");
                message.success(t("w4ai.triage.adoptOk", { name: r.patientName }));
              }}
            >
              {t("w4ai.triage.adopt")}
            </ActionButton>
          </Space>
        ),
      },
    ],
    [move, queue.length, setStatus],
  );

  return (
    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
      <Card size="small">
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space size={8}>
            <Siren size={16} color="#dc2626" />
            <Text strong>{t("w4ai.triage.title")}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("w4ai.triage.hint")}
            </Text>
          </Space>
          <Space wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("w4ai.triage.selected", { count: selectedKeys.length })}
            </Text>
            <Select
              style={{ width: 160 }}
              value={doctor}
              onChange={setDoctor}
              options={DOCTORS}
              aria-label={t("w4ai.triage.assignDoctor")}
            />
            <ActionButton
              action="submit"
              icon={<ListChecks size={14} />}
              onClick={handleAssign}
              data-testid="wf-batch-assign"
            >
              {t("w4ai.triage.batchAssign")}
            </ActionButton>
          </Space>
        </Space>
      </Card>

      <DataTable<TriageQueueItem>
        rowKey="id"
        dataSource={queue}
        columns={columns}
        showPagination={false}
        scroll={{ x: "max-content" }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys),
        }}
      />
    </Space>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 2: 审核 / 采纳统计                                              */
/* ------------------------------------------------------------------ */

const ReviewTab: React.FC = () => {
  const stats = useMemo(() => getModelReviewStats(getAiModelCatalog()), []);
  const trend = useMemo(() => getWeeklyAdoptionTrend(), []);

  const overallAdopt = useMemo(
    () =>
      stats.length > 0
        ? Math.round((stats.reduce((s, m) => s + m.adoptRate, 0) / stats.length) * 10) / 10
        : 0,
    [stats],
  );
  const overallConsistency = useMemo(
    () =>
      stats.length > 0
        ? Math.round((stats.reduce((s, m) => s + m.doctorConsistency, 0) / stats.length) * 10) / 10
        : 0,
    [stats],
  );
  const totalReviewed = useMemo(() => stats.reduce((s, m) => s + m.reviewed, 0), [stats]);

  const columns: TableColumnsType<(typeof stats)[number]> = [
    {
      title: t("w4ai.review.col.model"),
      key: "model",
      render: (_: unknown, r) => <Text strong>{r.modelName}</Text>,
    },
    {
      title: t("w4ai.review.col.reviewed"),
      dataIndex: "reviewed",
      key: "reviewed",
      width: 100,
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: t("w4ai.review.col.adopt"),
      dataIndex: "adoptRate",
      key: "adoptRate",
      width: 160,
      render: (v: number) => (
        <Space size={6}>
          <span style={{ width: 44, fontWeight: 600, color: "#16a34a" }}>{v.toFixed(1)}%</span>
          <div style={{ width: 70 }}>
            <Progress percent={v} showInfo={false} size="small" strokeColor="#16a34a" />
          </div>
        </Space>
      ),
    },
    {
      title: t("w4ai.review.col.reject"),
      dataIndex: "rejectRate",
      key: "rejectRate",
      width: 100,
      render: (v: number) => <span style={{ color: "#dc2626" }}>{v.toFixed(1)}%</span>,
    },
    {
      title: t("w4ai.review.col.modify"),
      dataIndex: "modifyRate",
      key: "modifyRate",
      width: 100,
      render: (v: number) => <span style={{ color: "#d97706" }}>{v.toFixed(1)}%</span>,
    },
    {
      title: t("w4ai.review.col.consistency"),
      dataIndex: "doctorConsistency",
      key: "doctorConsistency",
      width: 140,
      render: (v: number) => (
        <Space size={6}>
          <span style={{ width: 44, fontWeight: 600 }}>{v.toFixed(1)}%</span>
          <div style={{ width: 60 }}>
            <Progress percent={v} showInfo={false} size="small" strokeColor="#2563eb" />
          </div>
        </Space>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
      <StatCardGrid minWidth={210}>
        <StatCard
          title={t("w4ai.review.col.reviewed")}
          value={totalReviewed.toLocaleString("en-US")}
          icon={<ClipboardCheck size={18} />}
          color="primary"
        />
        <StatCard
          title={t("w4ai.review.col.adopt")}
          value={overallAdopt.toFixed(1)}
          suffix="%"
          icon={<CheckCircle2 size={18} />}
          color="success"
        />
        <StatCard
          title={t("w4ai.review.col.consistency")}
          value={overallConsistency.toFixed(1)}
          suffix="%"
          icon={<Activity size={18} />}
          color="info"
        />
      </StatCardGrid>

      <Card size="small" title={t("w4ai.review.perModel")}>
        <DataTable
          rowKey="modelId"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={stats}
          columns={columns}
        />
      </Card>

      <Card size="small" title={t("w4ai.review.trend")}>
        <Space size={16} style={{ marginBottom: 12 }} wrap>
          <Space size={4}>
            <span style={{ width: 10, height: 10, background: "#16a34a", display: "inline-block" }} />
            <Text style={{ fontSize: 12 }}>{t("w4ai.review.legendAdopt")}</Text>
          </Space>
          <Space size={4}>
            <span style={{ width: 10, height: 10, background: "#d97706", display: "inline-block" }} />
            <Text style={{ fontSize: 12 }}>{t("w4ai.review.legendModify")}</Text>
          </Space>
          <Space size={4}>
            <span style={{ width: 10, height: 10, background: "#dc2626", display: "inline-block" }} />
            <Text style={{ fontSize: 12 }}>{t("w4ai.review.legendReject")}</Text>
          </Space>
        </Space>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 24,
            height: 180,
            padding: "0 8px",
            borderBottom: "1px solid #e2e8f0",
          }}
          data-testid="wf-trend-chart"
        >
          {trend.map((p) => (
            <div key={p.week} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 3,
                  height: 150,
                }}
              >
                <Tooltip title={`${t("w4ai.review.legendAdopt")} ${p.adopt.toFixed(1)}%`}>
                  <div style={{ width: 16, height: `${p.adopt}%`, background: "#16a34a", borderRadius: 3 }} />
                </Tooltip>
                <Tooltip title={`${t("w4ai.review.legendModify")} ${p.modify.toFixed(1)}%`}>
                  <div style={{ width: 16, height: `${p.modify}%`, background: "#d97706", borderRadius: 3 }} />
                </Tooltip>
                <Tooltip title={`${t("w4ai.review.legendReject")} ${p.reject.toFixed(1)}%`}>
                  <div style={{ width: 16, height: `${p.reject}%`, background: "#dc2626", borderRadius: 3 }} />
                </Tooltip>
              </div>
              <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 6 }}>{p.week}</div>
            </div>
          ))}
        </div>
      </Card>
    </Space>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 3: 质量控制                                                     */
/* ------------------------------------------------------------------ */

const QcTab: React.FC = () => {
  const checks = useMemo(() => getQcImageChecks(), []);
  const [catalog] = useState<AiModelEntry[]>(() => getAiModelCatalog());
  const drift = useMemo(() => getDriftAlerts(catalog), [catalog]);
  const [errors, setErrors] = useState<ErrorReviewItem[]>(() => getErrorReviewQueue(catalog));

  const verdictColor: Record<"pass" | "warn" | "fail", string> = {
    pass: toneToAntd('passed'),
    warn: toneToAntd('warning'),
    fail: toneToAntd('failed'),
  };
  const verdictI18n: Record<"pass" | "warn" | "fail", string> = {
    pass: "w4ai.qc.verdict.pass",
    warn: "w4ai.qc.verdict.warn",
    fail: "w4ai.qc.verdict.fail",
  };

  const setVerdict = useCallback((id: string, verdict: ErrorReviewItem["reviewerVerdict"]) => {
    setErrors((prev) => prev.map((e) => (e.id === id ? { ...e, reviewerVerdict: verdict } : e)));
  }, []);

  const checkColumns: TableColumnsType<(typeof checks)[number]> = [
    { title: t("w4ai.qc.col.study"), dataIndex: "studyId", key: "studyId", width: 150 },
    { title: t("w4ai.qc.col.patient"), dataIndex: "patientName", key: "patientName", width: 90 },
    {
      title: t("w4ai.qc.col.modality"),
      key: "modality",
      width: 110,
      render: (_: unknown, r) => (
        <Space size={4}>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {r.modality}
          </Tag>
          <Tag style={{ marginInlineEnd: 0 }}>{r.bodyPart}</Tag>
        </Space>
      ),
    },
    ...[
      { key: "artifact" as const, label: "w4ai.qc.col.artifact" },
      { key: "motion" as const, label: "w4ai.qc.col.motion" },
      { key: "exposure" as const, label: "w4ai.qc.col.exposure" },
    ].map((col) => ({
      title: t(col.label),
      dataIndex: col.key,
      key: col.key,
      width: 90,
      render: (v: number) => <span style={{ color: scoreColor(v), fontWeight: 600 }}>{v}</span>,
    })),
    {
      title: t("w4ai.qc.col.verdict"),
      dataIndex: "verdict",
      key: "verdict",
      width: 90,
      render: (v: "pass" | "warn" | "fail") => <Tag color={verdictColor[v]}>{t(verdictI18n[v])}</Tag>,
    },
    { title: t("w4ai.qc.col.note"), dataIndex: "note", key: "note", ellipsis: true },
  ];

  const driftColumns: TableColumnsType<DriftAlert> = [
    { title: t("w4ai.review.col.model"), dataIndex: "modelName", key: "modelName" },
    {
      title: t("w4ai.qc.col.metric"),
      key: "metric",
      width: 100,
      render: (_: unknown, r) => t(METRIC_I18N[r.metric]),
    },
    {
      title: t("w4ai.qc.col.baseline"),
      dataIndex: "baseline",
      key: "baseline",
      width: 90,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: t("w4ai.qc.col.current"),
      dataIndex: "current",
      key: "current",
      width: 90,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: t("w4ai.qc.col.delta"),
      dataIndex: "delta",
      key: "delta",
      width: 90,
      render: (v: number) => (
        <span style={{ color: "#dc2626", fontWeight: 600 }}>{v.toFixed(1)}%</span>
      ),
    },
    {
      title: t("w4ai.qc.col.severity"),
      dataIndex: "severity",
      key: "severity",
      width: 80,
      render: (s: DriftAlert["severity"]) => <Tag color={SEVERITY_COLOR[s]}>{t(SEVERITY_I18N[s])}</Tag>,
    },
    { title: t("w4ai.qc.col.detectedAt"), dataIndex: "detectedAt", key: "detectedAt", width: 110 },
    { title: t("w4ai.qc.col.advice"), dataIndex: "hint", key: "hint", ellipsis: true },
  ];

  const errorColumns: TableColumnsType<ErrorReviewItem> = [
    {
      title: t("w4ai.qc.col.kind"),
      dataIndex: "kind",
      key: "kind",
      width: 100,
      render: (k: "FP" | "FN") => (
        <Tag color={k === "FP" ? "orange" : "red"}>
          {k === "FP" ? t("w4ai.qc.kind.FP") : t("w4ai.qc.kind.FN")}
        </Tag>
      ),
    },
    { title: t("w4ai.review.col.model"), dataIndex: "modelName", key: "modelName", width: 190 },
    { title: t("w4ai.qc.col.study"), dataIndex: "studyId", key: "studyId", width: 150 },
    { title: t("w4ai.qc.col.patient"), dataIndex: "patientName", key: "patientName", width: 90 },
    { title: t("w4ai.qc.col.finding"), dataIndex: "finding", key: "finding", ellipsis: true },
    {
      title: t("w4ai.qc.col.confidence"),
      dataIndex: "confidence",
      key: "confidence",
      width: 90,
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: t("w4ai.qc.col.verdict"),
      dataIndex: "reviewerVerdict",
      key: "reviewerVerdict",
      width: 110,
      render: (v: ErrorReviewItem["reviewerVerdict"]) => {
        if (v === "confirmed") return <Tag color="red">{t("w4ai.qc.verdictConfirmed")}</Tag>;
        if (v === "dismissed") return <Tag color="green">{t("w4ai.qc.verdictDismissed")}</Tag>;
        return <Tag color="blue">{t("w4ai.qc.verdictPending")}</Tag>;
      },
    },
    {
      title: t("w4ai.col.actions"),
      key: "actions",
      width: 180,
      render: (_: unknown, r: ErrorReviewItem) => (
        <Space size={4}>
          <ActionButton
            action="submit"
            size="compact"
            disabled={r.reviewerVerdict !== "pending"}
            onClick={() => {
              setVerdict(r.id, "confirmed");
              message.success(t("w4ai.qc.confirmedOk", { id: r.id }));
            }}
          >
            {t("w4ai.qc.confirm")}
          </ActionButton>
          <ActionButton
            action="cancel"
            size="compact"
            disabled={r.reviewerVerdict !== "pending"}
            onClick={() => {
              setVerdict(r.id, "dismissed");
              message.success(t("w4ai.qc.dismissedOk", { id: r.id }));
            }}
          >
            {t("w4ai.qc.dismiss")}
          </ActionButton>
        </Space>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
      <Card
        size="small"
        title={
          <Space size={6}>
            <ShieldAlert size={16} color="#2563eb" />
            {t("w4ai.qc.imageTitle")}
          </Space>
        }
      >
        <DataTable
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={checks}
          columns={checkColumns}
        />
      </Card>

      <Card
        size="small"
        title={
          <Space size={6}>
            <AlertTriangle size={16} color="#d97706" />
            {t("w4ai.qc.driftTitle")}
          </Space>
        }
      >
        <DataTable
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={drift}
          columns={driftColumns}
        />
      </Card>

      <Card
        size="small"
        title={
          <Space size={6}>
            <ListChecks size={16} color="#dc2626" />
            {t("w4ai.qc.errorTitle")}
          </Space>
        }
      >
        <DataTable
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={errors}
          columns={errorColumns}
        />
      </Card>
    </Space>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 4: 多模态报告助手                                               */
/* ------------------------------------------------------------------ */

const GUARDRAIL_I18N: Record<ReportGuardrailKey, string> = {
  lowConfidence: "w4ai.guardrail.lowConfidence",
  needHumanReview: "w4ai.guardrail.needHumanReview",
  noEvidence: "w4ai.guardrail.noEvidence",
  criticalDiff: "w4ai.guardrail.criticalDiff",
  templateConflict: "w4ai.guardrail.templateConflict",
};

const ReportTab: React.FC = () => {
  const draft = useMemo(() => getReportAssistantDraft(), []);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Set<string>>(new Set());

  const onAdopt = useCallback((s: ReportSuggestion) => {
    setAccepted((prev) => new Set(prev).add(s.id));
    message.success(t("w4ai.report.adoptOk"));
  }, []);

  const onEdit = useCallback((s: ReportSuggestion) => {
    setEdited((prev) => new Set(prev).add(s.id));
    message.success(t("w4ai.report.editOk"));
  }, []);

  const suggestions = draft.suggestions;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <Card
          size="small"
          title={
            <Space size={6}>
              <FileText size={16} color="#2563eb" />
              {t("w4ai.report.draft")}
            </Space>
          }
          extra={
            <Space size={6}>
              <Tag color="purple">{t("w4ai.badge")}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t("w4ai.report.acceptedCount", {
                  count: accepted.size,
                  total: suggestions.length,
                })}
              </Text>
            </Space>
          }
        >
          <Space size={12} wrap style={{ marginBottom: 12 }}>
            <Text>
              <Text type="secondary">{t("w4ai.triage.col.patient")}: </Text>
              {draft.patientName}
            </Text>
            <Text>
              <Text type="secondary">{t("w4ai.qc.col.study")}: </Text>
              {draft.studyId}
            </Text>
            <Tag color="blue">{draft.modality}</Tag>
            <Tag>{draft.bodyPart}</Tag>
          </Space>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
            }}
            data-testid="wf-report-draft"
          >
            {draft.draftText}
          </div>
          <Space size={16} wrap style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("w4ai.report.generatedAt")}: {draft.generatedAt}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("w4ai.report.modelVersion")}: {draft.modelVersion}
            </Text>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={14}>
        <Card
          size="small"
          title={
            <Space size={6}>
              <Sparkles size={16} color="#2563eb" />
              {t("w4ai.report.suggestions")}
            </Space>
          }
        >
          {suggestions.length === 0 ? (
            <Empty description={t("w4ai.empty")} />
          ) : (
            <Space orientation="vertical" size={12} style={{ width: "100%" }}>
              {suggestions.map((s) => {
                const isAccepted = accepted.has(s.id);
                const isEdited = edited.has(s.id);
                return (
                  <Card key={s.id} size="small" type="inner" data-testid={`wf-sug-${s.id}`}>
                    <Space
                      size={8}
                      wrap
                      style={{ width: "100%", justifyContent: "space-between", marginBottom: 6 }}
                    >
                      <Space size={6}>
                        <Tag color={s.section === "findings" ? "blue" : "purple"}>
                          {t(`w4ai.report.section.${s.section}`)}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t("w4ai.report.confidence")}: {s.confidence.toFixed(1)}%
                        </Text>
                        {isAccepted ? (
                          <Tag color="green">{t("w4ai.report.adopted")}</Tag>
                        ) : null}
                        {isEdited ? <Tag color="orange">{t("w4ai.report.edited")}</Tag> : null}
                      </Space>
                      <Space size={4}>
                        <ActionButton
                          action="submit"
                          size="compact"
                          icon={<CheckCircle2 size={13} />}
                          disabled={isAccepted}
                          onClick={() => onAdopt(s)}
                        >
                          {t("w4ai.report.adopt")}
                        </ActionButton>
                        <ActionButton
                          action="edit"
                          size="compact"
                          icon={<Pencil size={13} />}
                          onClick={() => onEdit(s)}
                        >
                          {t("w4ai.report.edit")}
                        </ActionButton>
                      </Space>
                    </Space>

                    <Paragraph style={{ marginBottom: 8 }}>{s.text}</Paragraph>

                    {s.guardrails.length > 0 ? (
                      <Space size={[6, 4]} wrap style={{ marginBottom: 8 }}>
                        <Brain size={13} color="#d97706" />
                        {s.guardrails.map((g) => (
                          <Tag
                            key={g.key}
                            color={g.level === "warn" ? "orange" : "blue"}
                            icon={g.level === "warn" ? <AlertTriangle size={11} /> : undefined}
                          >
                            {t(GUARDRAIL_I18N[g.key])}
                          </Tag>
                        ))}
                      </Space>
                    ) : null}

                    <div>
                      <Space size={6} style={{ marginBottom: 4 }}>
                        <Quote size={13} color="#2563eb" />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t("w4ai.report.citations")}
                        </Text>
                      </Space>
                      {s.citations.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#bfbfbf" }}>
                          {t("w4ai.report.noCitation")}
                        </div>
                      ) : (
                        <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                          {s.citations.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                fontSize: 12,
                                color: "#595959",
                                borderLeft: "2px solid #bfbfbf",
                                paddingLeft: 8,
                              }}
                            >
                              <Tag color="cyan" style={{ marginInlineEnd: 6 }}>
                                {c.reportNo}
                              </Tag>
                              {c.date} · {c.snippet}
                              <Text type="secondary" style={{ marginLeft: 6 }}>
                                {t("w4ai.report.similarity")} {(c.similarity * 100).toFixed(0)}%
                              </Text>
                            </div>
                          ))}
                        </Space>
                      )}
                    </div>
                  </Card>
                );
              })}
            </Space>
          )}
        </Card>
      </Col>
    </Row>
  );
};

/* ------------------------------------------------------------------ */
/* 页面                                                               */
/* ------------------------------------------------------------------ */

const AiWorkflowCenterPage: React.FC = () => {
  const tabs = useMemo(
    () => [
      {
        key: "triage",
        label: (
          <span>
            <Siren size={14} /> {t("w4ai.tab.triage")}
          </span>
        ),
        children: <TriageTab />,
      },
      {
        key: "review",
        label: (
          <span>
            <ClipboardCheck size={14} /> {t("w4ai.tab.review")}
          </span>
        ),
        children: <ReviewTab />,
      },
      {
        key: "qc",
        label: (
          <span>
            <ShieldAlert size={14} /> {t("w4ai.tab.qc")}
          </span>
        ),
        children: <QcTab />,
      },
      {
        key: "report",
        label: (
          <span>
            <FileText size={14} /> {t("w4ai.tab.report")}
          </span>
        ),
        children: <ReportTab />,
      },
    ],
    [],
  );

  return (
    <PageContainer testId="ai-workflow-center">
      <PageHeader
        icon={<Brain size={22} color="#2563eb" />}
        title={t("w4ai.wf.title")}
        subtitle={t("w4ai.wf.subtitle")}
        actions={
          <Space>
            <Tag color="purple" data-testid="wf-badge">
              {t("w4ai.badge")}
            </Tag>
            <ActionButton
              action="refresh"
              icon={<RefreshCw size={14} />}
              onClick={() => window.location.reload()}
            >
              {t("w4ai.refresh")}
            </ActionButton>
          </Space>
        }
      />
      <Card size="small">
        <Tabs items={tabs} />
      </Card>
    </PageContainer>
  );
};

export default AiWorkflowCenterPage;

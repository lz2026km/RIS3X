import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Tag,
  Tabs,
  Space,
  Progress,
  Badge,
  Button,
  Input,
  Modal,
  message,
} from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Brain, Activity, AlertTriangle, CheckCircle, Clock, PlayCircle } from 'lucide-react';
import AiDiagnosisCard from "@/components/eye/AiDiagnosisCard";
import ChartContainer from "@/components/charts/ChartContainer";
import { PageContainer, PageHeader, ActionButton, ExportButton, StatCard, StatCardGrid } from "@/components/common";
import { AppEmpty, ErrorBanner } from "@/components/feedback";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { usePagination } from "@/hooks/usePagination";
import { eyeApi } from "@/services/api/eyeApi";
import { t } from "../../../i18n/appI18n";
import { DataTable } from "../../../components/common";

const DAY_KEYS = ['w9d.weekday.mon', 'w9d.weekday.tue', 'w9d.weekday.wed', 'w9d.weekday.thu', 'w9d.weekday.fri', 'w9d.weekday.sat', 'w9d.weekday.sun'];
const ACCEPTANCE_TREND_DATA = [
  { day: '周一', rate: 65, target: 80 },
  { day: '周二', rate: 68, target: 80 },
  { day: '周三', rate: 71, target: 80 },
  { day: '周四', rate: 70, target: 80 },
  { day: '周五', rate: 73, target: 80 },
  { day: '周六', rate: 75, target: 80 },
  { day: '周日', rate: 78, target: 80 },
].map((d, i) => ({ ...d, dayKey: DAY_KEYS[i]! }));

const ROC_CURVE_DATA = [
  { fpr: 0.0, auc_dr: 0.0, auc_glaucoma: 0.0, auc_amd: 0.0, random: 0.0 },
  { fpr: 0.1, auc_dr: 0.55, auc_glaucoma: 0.5, auc_amd: 0.45, random: 0.1 },
  { fpr: 0.2, auc_dr: 0.75, auc_glaucoma: 0.7, auc_amd: 0.65, random: 0.2 },
  { fpr: 0.3, auc_dr: 0.85, auc_glaucoma: 0.8, auc_amd: 0.78, random: 0.3 },
  { fpr: 0.4, auc_dr: 0.9, auc_glaucoma: 0.86, auc_amd: 0.85, random: 0.4 },
  { fpr: 0.5, auc_dr: 0.93, auc_glaucoma: 0.9, auc_amd: 0.89, random: 0.5 },
  { fpr: 0.6, auc_dr: 0.95, auc_glaucoma: 0.92, auc_amd: 0.92, random: 0.6 },
  { fpr: 0.7, auc_dr: 0.97, auc_glaucoma: 0.94, auc_amd: 0.94, random: 0.7 },
  { fpr: 0.8, auc_dr: 0.98, auc_glaucoma: 0.96, auc_amd: 0.95, random: 0.8 },
  { fpr: 0.9, auc_dr: 0.99, auc_glaucoma: 0.98, auc_amd: 0.96, random: 0.9 },
  { fpr: 1.0, auc_dr: 1.0, auc_glaucoma: 1.0, auc_amd: 1.0, random: 1.0 },
];

const MODALITY_LABELS: Record<string, string> = {
  oct_a: "w9d.modality.oct_a", corneal_endothelium: "w9d.modality.corneal_endothelium", tear_film: "w9d.modality.tear_film",
  fundus_autofluorescence: "w9d.modality.fundus_autofluorescence", fundus_photo: "w9d.modality.fundus_photo", oct: "w9d.modality.oct",
  ffa: "w9d.modality.ffa", icga: "w9d.modality.icga", visual_field: "w9d.modality.visual_field", topography: "w9d.modality.topography",
  pentacam: "w9d.modality.pentacam", iol_master: "w9d.modality.iol_master", ubm: "w9d.modality.ubm", slit_lamp: "w9d.modality.slit_lamp",
  borderline: "w9d.reportStatus.borderline", cup_to_disc_ratio: "w9d.reportStatus.cup_to_disc_ratio", rim_width: "w9d.reportStatus.rim_width",
  arteriovenous_ratio: "w9d.reportStatus.arteriovenous_ratio", abnormal: "w9d.reportStatus.abnormal", v6: "w9d.reportStatus.v6", text: "w9d.reportStatus.text",
  findings_multi: "w9d.reportStatus.findings_multi", images: "w9d.reportStatus.images", productivity: "w9d.reportStatus.productivity", clinical: "w9d.reportStatus.clinical",
  operational: "w9d.reportStatus.operational", financial: "w9d.reportStatus.financial", critical_value: "w9d.reportStatus.critical_value", pending_review: "w9d.reportStatus.pending_review",
};
const modalityLabel = (v: string) => (MODALITY_LABELS[v] ? t(MODALITY_LABELS[v]!) : v);

const EyeAiPage: React.FC = () => {
  const [tab, setTab] = useState("diagnoses");
  const bp = useBreakpoint();
  const isNarrow = bp === "xs" || bp === "sm";
  const [aiModels, setAiModels] = useState<any[]>([]);
  const [aiDiagnoses, setAiDiagnoses] = useState<any[]>([]);
  // [W3-C] 病种分布: 接 eyeApi.getDiseaseDistribution (/eye/ai/stats/disease-distribution)
  const [diseaseDistribution, setDiseaseDistribution] = useState<Array<{ condition: string; count: number }>>([]);
  const [distSource, setDistSource] = useState<'api' | 'demo'>('demo');
  const [_loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // [G005 Wave1B] 推理执行 / ROC 指标 / 热图 / 待推理 (eyeApi.runInference / getRocCurve / getHeatmaps / listPendingInferences)
  const [heatmapCount, setHeatmapCount] = useState(0);
  const [pendingInferenceCount, setPendingInferenceCount] = useState(0);
  const [rocMeta, setRocMeta] = useState<{ auc: number; sensitivity: number; specificity: number; modelId: string } | null>(null);
  const [inferModal, setInferModal] = useState<{ open: boolean; modelId: string; modelName: string; studyId: string; running: boolean }>({ open: false, modelId: '', modelName: '', studyId: 'ST001', running: false });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [modelsRes, diagRes, distRes, heatRes, pendingRes] = await Promise.all([
          eyeApi.listModels(),
          eyeApi.listInferences(),
          eyeApi.getDiseaseDistribution(),
          eyeApi.getHeatmaps().catch(() => ({ success: false, data: [] })),
          eyeApi.listPendingInferences().catch(() => ({ success: false, data: [] })),
        ]);
        if (!cancelled) {
          if (modelsRes.success && Array.isArray(modelsRes.data)) setAiModels(modelsRes.data);
          if (diagRes.success && Array.isArray(diagRes.data)) setAiDiagnoses(diagRes.data);
          if (heatRes.success && Array.isArray(heatRes.data)) setHeatmapCount(heatRes.data.length);
          if (pendingRes.success && Array.isArray(pendingRes.data)) setPendingInferenceCount(pendingRes.data.length);
          if (distRes.success && distRes.data && typeof distRes.data === "object") {
            const dist = distRes.data as Record<string, number>;
            const entries = Object.entries(dist)
              .filter(([, v]) => typeof v === "number" && v > 0)
              .map(([condition, count]) => ({ condition, count }))
              .sort((a, b) => b.count - a.count);
            if (entries.length > 0) {
              setDiseaseDistribution(entries);
              setDistSource('api');
            }
          }
          if (!modelsRes.success && !diagRes.success) setLoadError(t('w9.states.error'));
        }
      } catch { setLoadError(t('w9.states.error')); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const pendingDiag = aiDiagnoses.filter(
    (d) => d.reviewStatus === "pending",
  );
  const acceptedDiag = aiDiagnoses.filter(
    (d) => d.reviewStatus !== "pending",
  );

  // [G005 Wave1B] ROC 指标: eyeApi.getRocCurve(模型) 成功后展示 API AUC, 失败保留演示曲线
  useEffect(() => {
    if (aiModels.length === 0) return;
    const m = aiModels[0] as { id?: string; modelId?: string };
    if (!m?.id && !m?.modelId) return;
    const modelId = String(m.id ?? m.modelId);
    let cancelled = false;
    void eyeApi.getRocCurve(modelId).then((res) => {
      if (cancelled) return;
      const d = res.data as any;
      if (res.success && d && typeof d.auc === 'number') {
        setRocMeta({ auc: d.auc, sensitivity: d.sensitivity ?? 0, specificity: d.specificity ?? 0, modelId: String(d.modelId ?? modelId) });
      }
    }).catch(() => { /* 保留演示 ROC 曲线 */ });
    return () => { cancelled = true; };
  }, [aiModels]);

  // [G005 Wave1B] 运行推理: POST /eye/ai/inferences (runInference)
  const handleRunInference = async () => {
    if (!inferModal.studyId.trim()) { message.warning(t('eyeAi.studyIdRequired')); return; }
    setInferModal(prev => ({ ...prev, running: true }));
    try {
      const res = await eyeApi.runInference({ studyId: inferModal.studyId.trim(), modelId: inferModal.modelId });
      if (res.success) {
        message.success(t('w9d.eyeAi.inferDone', { model: inferModal.modelName, study: inferModal.studyId, confidence: ((res.data as any)?.confidence ?? 0).toFixed(2) }));
        setInferModal(prev => ({ ...prev, open: false, running: false }));
        const diagRes = await eyeApi.listInferences();
        if (diagRes.success && Array.isArray(diagRes.data)) setAiDiagnoses(diagRes.data);
      } else {
        message.error(res.error?.message ?? t('eyeAi.inferenceFailed'));
        setInferModal(prev => ({ ...prev, running: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? t('eyeAi.inferenceFailedUnavailable'));
      setInferModal(prev => ({ ...prev, running: false }));
    }
  };
  const totalDiag = aiDiagnoses.length;
  // [W3-C] AI 采纳率: 由真实诊断数据计算, 不再写死 72.3%
  const acceptanceRate = totalDiag > 0
    ? Math.round((acceptedDiag.length / totalDiag) * 1000) / 10
    : 0;
  // [W3-C] 分布表: API 数据优先, 空则回退演示分布
  const distData = distSource === 'api' && diseaseDistribution.length > 0
    ? diseaseDistribution
    : [
        { condition: "糖尿病视网膜病变", count: 8 },
        { condition: "青光眼", count: 4 },
        { condition: "AMD", count: 6 },
        { condition: "黄斑水肿", count: 3 },
        { condition: "高度近视", count: 2 },
      ];
  // [G005 2B] 受控分页: AI 模型表 / 病种分布表
  const modelsPagination = usePagination(aiModels, 10);
  const distPagination = usePagination(distData, 10);

  // [W3-C] 采纳率趋势: 由诊断记录按最近 7 天聚合 (reviewStatus=accepted 比例), 无数据回退演示曲线
  const acceptanceTrendData = useMemo(() => {
    const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    if (aiDiagnoses.length === 0) return ACCEPTANCE_TREND_DATA;
    const byDay: Record<string, { total: number; accepted: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      byDay[d.getDay()] = { total: 0, accepted: 0 };
    }
    for (const d of aiDiagnoses) {
      const ts = d.createdAt ?? d.timestamp;
      if (!ts) continue;
      const date = new Date(ts);
      if (isNaN(date.getTime())) continue;
      const day = date.getDay();
      if (!byDay[day]) continue;
      byDay[day]!.total += 1;
      if (d.reviewStatus !== "pending") byDay[day]!.accepted += 1;
    }
    const hasData = Object.values(byDay).some((v) => v.total > 0);
    if (!hasData) return ACCEPTANCE_TREND_DATA;
    // 以今天为终点按周排序
    const ordered = Array.from({ length: 7 }, (_, i) => (now.getDay() - 6 + i + 7) % 7);
    return ordered.map((day, i) => {
      const v = byDay[day] ?? { total: 0, accepted: 0 };
      return {
        day: days[i % 7]!,
        rate: v.total > 0 ? Math.round((v.accepted / v.total) * 100) : 0,
        target: 80,
      };
    });
  }, [aiDiagnoses]);

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-ai-page">
      <PageHeader
        title={t('eyeAi.title')}
        icon={<Brain size={24} color="#8b5cf6" />}
        variant="inline"
        actions={
          <>
            <Tag color="purple">{t('eyeAi.diagCount', { count: totalDiag })}</Tag>
            <Tag color="warning">{t('eyeAi.pendingReview', { count: Math.max(pendingDiag.length, pendingInferenceCount) })}</Tag>
            <Tag color="green">{t('eyeAi.acceptedCount', { count: acceptedDiag.length })}</Tag>
            <Tag color="cyan">{t('eyeAi.heatmapCount', { count: heatmapCount })}</Tag>
            <ActionButton action="refresh" loading={_loading} onClick={() => setReloadTick((n) => n + 1)}>{t('w45.actions.refresh')}</ActionButton>
            <ExportButton
              data={() => aiDiagnoses}
              filename="eye-ai-diagnoses"
              label={t('w45.actions.export')}
              size="small"
              formats={["csv", "json"]}
            />
          </>
        }
      />

      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}

      <StatCardGrid minWidth={200} gap={12} style={{ marginBottom: 'var(--space-3, 12px)' }}>
        <StatCard
          title={t('eyeAi.modelCount')}
          value={aiModels.length}
          icon={<Brain size={18} color="#8b5cf6" />}
        />
        <StatCard
          title={t('eyeAi.diagnosedStudies')}
          value={totalDiag}
          icon={<Activity size={18} color="var(--color-primary-600)" />}
        />
        <StatCard
          title={t('eyeAi.positiveFindings')}
          value={
            aiDiagnoses.filter((d) => d.severity !== "none").length
          }
          icon={<AlertTriangle size={18} color="var(--color-error-500)" />}
        />
        <StatCard
          title={t('eyeAi.acceptanceRate')}
          value={acceptanceRate}
          suffix="%"
          icon={<CheckCircle size={18} color="var(--color-success-500)" />}
        />
      </StatCardGrid>

      <Row gutter={12}>
        <Col span={24}>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            tabBarExtraContent={
              <Space size={6} wrap>
                <Badge
                  count={pendingDiag.length}
                  title={t('w9d.eyeAi.pendingTitle', { count: pendingDiag.length })}
                  style={{ backgroundColor: "var(--color-warning-500)" }}
                />
                <Tag color="purple">{t('eyeAi.totalCount', { count: totalDiag })}</Tag>
              </Space>
            }
            items={[
              {
                key: "diagnoses",
                label: t('w9d.eyeAi.diagListTab', { count: totalDiag }),
                children: (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Card
                        size="small"
                        title={
                          <>
                            <Clock size={14} /> {t('eyeAi.pendingDiagnoses')} ({pendingDiag.length}
                            )
                          </>
                        }
                      >
                        {pendingDiag.length === 0 ? (
                          <AppEmpty
                            variant="no-data"
                            description={t('eyeAi.allReviewed')}
                            minHeight={isNarrow ? 120 : 160}
                          />
                        ) : (
                          pendingDiag.map((d) => (
                            <AiDiagnosisCard key={d.id} diagnosis={d} />
                          ))
                        )}
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card
                        size="small"
                        title={
                          <>
                            <CheckCircle size={14} /> {t('eyeAi.reviewedDiagnoses')}
                          </>
                        }
                      >
                        {acceptedDiag.map((d) => (
                          <AiDiagnosisCard key={d.id} diagnosis={d} />
                        ))}
                      </Card>
                    </Col>
                  </Row>
                ),
              },
              {
                key: "models",
                label: t('w9d.eyeAi.modelMgmtTab', { count: aiModels.length }),
                children: (
                  <DataTable
                    dataSource={modelsPagination.pageData}
                    rowKey="id"
                    pagination={modelsPagination.pagination}
                    columns={[
                      {
                        title: t('eyeAi.colModelName'),
                        dataIndex: "name",
                        key: "name",
                        width: 140,
                      },
                      {
                        title: t('eyeAi.colVendor'),
                        dataIndex: "vendor",
                        key: "vendor",
                        width: 100,
                        render: (v: string) => <Tag>{modalityLabel(v)}</Tag>,
                      },
                      {
                        title: t('eyeAi.colConditions'),
                        dataIndex: "conditions",
                        key: "conditions",
                        width: 200,
                        render: (v: string[]) =>
                          v.map((c) => (
                            <Tag key={c} style={{ fontSize: 12 }}>
                              {c}
                            </Tag>
                          )),
                      },
                      {
                        title: t('eyeAi.colAccuracy'),
                        dataIndex: "accuracy",
                        key: "accuracy",
                        width: 80,
                        render: (v: number) => (
                          <Progress
                            percent={Math.round(v * 100)}
                            size="small"
                            style={{ margin: 0 }}
                          />
                        ),
                      },
                      {
                        title: t('eyeAi.colSensitivity'),
                        dataIndex: "sensitivity",
                        key: "sensitivity",
                        width: 70,
                        render: (v: number) => `${(v * 100).toFixed(1)}%`,
                      },
                      {
                        title: t('eyeAi.colSpecificity'),
                        dataIndex: "specificity",
                        key: "specificity",
                        width: 70,
                        render: (v: number) => `${(v * 100).toFixed(1)}%`,
                      },
                      {
                        title: t('eyeAi.colApproval'),
                        key: "approval",
                        width: 80,
                        render: () => (
                          <Space size={4}>
                            {["NMPA", "CE"].map((a) => (
                              <Tag key={a} color="green">
                                {a}
                              </Tag>
                            ))}
                          </Space>
                        ),
                      },
                      {
                        title: t('eyeAi.colActions'),
                        key: "actions",
                        width: 100,
                        render: (_: unknown, m: any) => (
                          <Button
                            size="small"
                            type="primary"
                            icon={<PlayCircle size={12} />}
                            onClick={() => setInferModal({ open: true, modelId: String(m.id ?? m.modelId ?? ''), modelName: String(m.name ?? m.id ?? t('eyeAi.defaultModel')), studyId: 'ST001', running: false })}
                          >
                            {t('eyeAi.runInference')}
                          </Button>
                        ),
                      },
                    ]}
                  scroll={{ x: 'max-content' }}
                  />
                ),
              },
              {
                key: "stats",
                label: t('eyeAi.tabStats'),
                children: (
                  <Row gutter={12}>
                    <Col span={8}>
                      <Card size="small" title={<span>{t('eyeAi.diseaseDistributionTitle')} <Tag color={distSource === 'api' ? 'green' : 'orange'} style={{ fontSize: 10 }}>{distSource === 'api' ? 'API' : t('eyeAi.demo')}</Tag></span>}>
                        <DataTable
                          scroll={{ x: 'max-content' }}
                          pagination={distPagination.pagination}
                          dataSource={distPagination.pageData}
                          rowKey="condition"
                          columns={[
                            { title: t('eyeAi.colDisease'), dataIndex: "condition" },
                            { title: t('eyeAi.colDiagCount'), dataIndex: "count" },
                          ]}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title={t('eyeAi.acceptanceTrend')}>
                          <ChartContainer height={180} state={acceptanceTrendData.length > 0 ? 'ready' : 'empty'} emptyDescription={t('eyeAi.noData')}>
                            <LineChart
                              data={acceptanceTrendData}
                              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="day"
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                                tickFormatter={(v: string) => t(`w9d.weekday.${v === '周一' ? 'mon' : v === '周二' ? 'tue' : v === '周三' ? 'wed' : v === '周四' ? 'thu' : v === '周五' ? 'fri' : v === '周六' ? 'sat' : 'sun'}`)}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                                domain={[40, 100]}
                                tickFormatter={(v: number) => `${v}%`}
                              />
                              <Tooltip
                                contentStyle={{
                                  fontSize: 12,
                                  borderRadius: 6,
                                  border: "1px solid var(--border-color)",
                                }}
                                formatter={(v: number) => [`${v}%`, t('eyeAi.acceptanceRate')]}
                              />
                              <Line
                                type="monotone"
                                dataKey="rate"
                                name={t('eyeAi.acceptanceRate')}
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={{ r: 3, fill: "#8b5cf6" }}
                                activeDot={{ r: 5 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="target"
                                name={t('eyeAi.target')}
                                stroke="#94a3b8"
                                strokeDasharray="4 4"
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </LineChart>
                          </ChartContainer>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title={<span>{t('eyeAi.rocComparison')} {rocMeta && <Tag color="green" style={{ fontSize: 10 }}>API AUC {rocMeta.auc.toFixed(3)}</Tag>}</span>}>
                          <ChartContainer height={180} state={ROC_CURVE_DATA.length > 0 ? 'ready' : 'empty'} emptyDescription={t('eyeAi.noData')}>
                            <LineChart
                              data={ROC_CURVE_DATA}
                              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="fpr"
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                                domain={[0, 1]}
                                tickFormatter={(v: number) => v.toFixed(1)}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                                domain={[0, 1]}
                                tickFormatter={(v: number) => v.toFixed(1)}
                              />
                              <Tooltip
                                contentStyle={{
                                  fontSize: 12,
                                  borderRadius: 6,
                                  border: "1px solid var(--border-color)",
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Line
                                type="monotone"
                                dataKey="auc_dr"
                                name={t('eyeAi.drGrade')}
                                stroke="var(--color-primary-600)"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="auc_glaucoma"
                                name={t('eyeAi.glaucoma')}
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="auc_amd"
                                name="AMD"
                                stroke="var(--color-warning-500)"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="random"
                                name={t('eyeAi.random')}
                                stroke="#94a3b8"
                                strokeDasharray="4 4"
                                strokeWidth={1}
                                dot={false}
                              />
                            </LineChart>
                          </ChartContainer>
                      </Card>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </Col>
      </Row>

      {/* [G005 Wave1B] 运行推理 Modal (POST /eye/ai/inferences) */}
      <Modal
        title={`${t('w9d.eyeAi.runInferTitle')} - ${inferModal.modelName}`}
        open={inferModal.open}
        onCancel={() => setInferModal(prev => ({ ...prev, open: false, running: false }))}
        onOk={() => void handleRunInference()}
        okText={t('eyeAi.startInference')}
        confirmLoading={inferModal.running}
        width={420}
      >
        <div style={{ marginTop: 'var(--space-2, 8px)' }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>{t('eyeAi.studyIdLabel')}</div>
          <Input
            value={inferModal.studyId}
            onChange={e => setInferModal(prev => ({ ...prev, studyId: e.target.value }))}
            placeholder={t('eyeAi.studyIdPlaceholder')}
          />
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 'var(--space-2, 8px)' }}>
            {t('eyeAi.modelPrefix')} <Tag color="purple">{inferModal.modelId}</Tag> · {t('eyeAi.inferenceResultHint')}
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
export default EyeAiPage;

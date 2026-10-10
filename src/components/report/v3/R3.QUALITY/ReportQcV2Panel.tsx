/**
 * G005 RIS v3.0.6.11-101 Wave 6B - R3.QUALITY.V2 ReportQcV2Panel
 * 报告质控 V2: 多维智能评分 (F4)
 * - 5 维度 (完整性/规范性/准确性/可读性/及时性) 评分面板 + 总分 0-100 + 等级 A/B/C/D
 * - 缺陷自动识别列表 + 维度子项明细
 * - 质控任务流: 创建/分配/一级复核/二次复核(双人)/关闭 + 复核历史
 * - 统计: 缺陷分布 / 月度趋势 / 等级分布
 * API 不可用 (mock 模式无 MSW handler) 时回退内置演示数据。
 */
import { reportQcV2Api, type QcScoreResult, type QcTask, type QcGrade, type QcStatsData, type QcTaskStatus, type ReviewOpinion, type QcDimensionMeta, type QcRecord } from '../../../../services/api/reportQcV2Api';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  Slider,
  Table,
  Progress,
  message,
  Spin,
  Alert,
  Descriptions,
  Modal,
  List,
  Empty,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileCheck2, Gauge, ListChecks, Users, Clock, Award, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { t } from '../../../../i18n/appI18n';

const GRADE_COLOR: Record<QcGrade, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#dc2626',
};

const TASK_STATUS_META: Record<QcTaskStatus, { label: string; color: string }> = {
  pending: { label: t('reportQcV2.taskStatus.pending'), color: 'default' },
  in_progress: { label: t('reportQcV2.taskStatus.inProgress'), color: 'blue' },
  reviewing: { label: t('reportQcV2.taskStatus.reviewing'), color: 'gold' },
  closed: { label: t('reportQcV2.taskStatus.closed'), color: 'green' },
};

// ================= 演示回退数据 (API 不可用) =================

const DEMO_DIMENSIONS: QcDimensionMeta[] = [
  { key: 'completeness', label: '完整性', labelEn: 'Completeness', max: 20, color: '#3b82f6', subItems: [
    { key: 'structure', name: '结构字段齐全', max: 8 },
    { key: 'technical', name: '技术参数/对比剂', max: 4 },
    { key: 'conclusion', name: '诊断结论', max: 4 },
    { key: 'followup', name: '随访建议', max: 4 },
  ]},
  { key: 'normativity', label: '规范性', labelEn: 'Normativity', max: 20, color: '#8b5cf6', subItems: [
    { key: 'template', name: '模板段落规范', max: 6 },
    { key: 'terminology', name: '术语严谨', max: 6 },
    { key: 'format', name: '标点排版', max: 4 },
    { key: 'spelling', name: '错别字', max: 4 },
  ]},
  { key: 'accuracy', label: '准确性', labelEn: 'Accuracy', max: 20, color: '#10b981', subItems: [
    { key: 'modalityMatch', name: '模态部位匹配', max: 5 },
    { key: 'rads', name: '规范分级', max: 5 },
    { key: 'critical', name: '危急提示', max: 5 },
    { key: 'consistency', name: '所见结论一致', max: 5 },
  ]},
  { key: 'readability', label: '可读性', labelEn: 'Readability', max: 20, color: '#f59e0b', subItems: [
    { key: 'sentenceLength', name: '语句长度', max: 7 },
    { key: 'paragraph', name: '段落结构', max: 5 },
    { key: 'redundancy', name: '冗余表达', max: 4 },
    { key: 'punctuation', name: '标点密度', max: 4 },
  ]},
  { key: 'timeliness', label: '及时性', labelEn: 'Timeliness', max: 20, color: '#ef4444', subItems: [
    { key: 'tat', name: '报告耗时', max: 20 },
  ]},
];

const DEMO_TASKS: QcTask[] = [
  {
    id: 'TQ-1',
    reportId: 'RPT-20260801001',
    patientName: '李明',
    modality: 'CT',
    scoreId: 'QS-1',
    totalScore: 95,
    grade: 'A',
    status: 'closed',
    assignee: 'u-102',
    assigneeName: '王质控员',
    createdAt: '2026-08-14T09:00:00.000Z',
    updatedAt: '2026-08-14T16:00:00.000Z',
    closedAt: '2026-08-14T16:00:00.000Z',
    reviews: [
      { id: 'RV-1', round: 1, reviewer: '张质控', opinion: 'pass', comment: '一级复核通过。', at: '2026-08-14T13:00:00.000Z' },
      { id: 'RV-2', round: 2, reviewer: '王主任', opinion: 'pass', comment: '双人复核一致通过, 质控闭环。', at: '2026-08-14T15:00:00.000Z' },
    ],
    history: [
      { at: '2026-08-14T09:00:00.000Z', action: 'created', actor: '系统', note: '质控任务创建' },
      { at: '2026-08-14T10:00:00.000Z', action: 'assigned', actor: '质控组长', note: '指派给 王质控员' },
      { at: '2026-08-14T13:00:00.000Z', action: 'reviewed', actor: '张质控', note: '一级复核通过' },
      { at: '2026-08-14T15:00:00.000Z', action: 'second_reviewed', actor: '王主任', note: '二次复核通过, 任务关闭' },
    ],
    defects: [],
  },
  {
    id: 'TQ-2',
    reportId: 'RPT-20260801003',
    patientName: '赵敏',
    modality: 'CT',
    scoreId: 'QS-3',
    totalScore: 72,
    grade: 'C',
    status: 'reviewing',
    assignee: 'u-102',
    assigneeName: '王质控员',
    createdAt: '2026-08-14T09:30:00.000Z',
    updatedAt: '2026-08-14T14:00:00.000Z',
    reviews: [
      { id: 'RV-3', round: 1, reviewer: '张质控', opinion: 'pass', comment: '危急处理流程合规, 一级通过。', at: '2026-08-14T14:00:00.000Z' },
    ],
    history: [
      { at: '2026-08-14T09:30:00.000Z', action: 'created', actor: '系统', note: '质控任务创建' },
      { at: '2026-08-14T10:00:00.000Z', action: 'assigned', actor: '质控组长', note: '指派给 王质控员' },
      { at: '2026-08-14T14:00:00.000Z', action: 'reviewed', actor: '张质控', note: '一级复核通过, 进入二次复核' },
    ],
    defects: [
      { code: 'QC-ACCURACY-RADS', dimension: 'accuracy', dimensionLabel: '准确性', name: '规范分级', severity: 'high', message: '缺少规范分级 (RADS) 表述', evidence: 'RPT-20260801003' },
    ],
  },
];

const DEMO_RECORDS: QcRecord[] = DEMO_TASKS.map((task) => ({
  id: task.id,
  reportId: task.reportId,
  patientName: task.patientName,
  modality: task.modality,
  totalScore: task.totalScore,
  grade: task.grade,
  status: task.status,
  assigneeName: task.assigneeName,
  defectCount: task.defects.length,
  reviewedRounds: task.reviews.length,
  createdAt: task.createdAt,
  closedAt: task.closedAt,
}));

const DEMO_STATS: QcStatsData = {
  totalTasks: 8,
  avgScore: 84.2,
  passRate: 75,
  gradeDistribution: [
    { grade: 'A', count: 4 },
    { grade: 'B', count: 2 },
    { grade: 'C', count: 1 },
    { grade: 'D', count: 1 },
  ],
  taskByStatus: { pending: 1, in_progress: 2, reviewing: 2, closed: 3 },
  defectDistribution: [
    { key: 'completeness', label: '完整性', count: 5, high: 2, medium: 2, low: 1 },
    { key: 'normativity', label: '规范性', count: 3, high: 0, medium: 2, low: 1 },
    { key: 'accuracy', label: '准确性', count: 4, high: 1, medium: 2, low: 1 },
    { key: 'readability', label: '可读性', count: 2, high: 0, medium: 1, low: 1 },
    { key: 'timeliness', label: '及时性', count: 3, high: 1, medium: 1, low: 1 },
  ],
  severityDistribution: [
    { severity: 'high', count: 4 },
    { severity: 'medium', count: 8 },
    { severity: 'low', count: 5 },
  ],
  monthlyTrend: [
    { month: '2026-05', count: 2, avgScore: 82.5 },
    { month: '2026-06', count: 2, avgScore: 83 },
    { month: '2026-07', count: 2, avgScore: 85.5 },
    { month: '2026-08', count: 2, avgScore: 86 },
  ],
};

// ================= 主组件 =================

export const ReportQcV2Panel: React.FC = () => {
  const [dimensions, setDimensions] = useState<QcDimensionMeta[]>(DEMO_DIMENSIONS);
  const [loadingDims, setLoadingDims] = useState(true);
  const [result, setResult] = useState<QcScoreResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [tasks, setTasks] = useState<QcTask[]>(DEMO_TASKS);
  const [stats, setStats] = useState<QcStatsData>(DEMO_STATS);
  const [records, setRecords] = useState<QcRecord[]>(DEMO_RECORDS);
  const [refreshing, setRefreshing] = useState(false);

  // ---- 评分输入 ----
  const [form, setForm] = useState({
    reportId: 'RPT-20260801001',
    modality: 'CT',
    findings: '影像所见：胸部CT平扫, 双肺纹理清晰, 未见实变影。主动脉未见增宽, 纵隔居中。',
    diagnosis: '诊断意见：双肺及纵隔未见明确异常。',
    conclusion: '结论：双肺及纵隔未见明确异常, 建议定期随访复查。',
    recommendations: '建议：1 年后随访复查胸部 CT。',
    techParams: 'CT 平扫, 层厚 5mm',
    radsCategory: 'RADS 不适用',
    isCritical: false,
    structuredCompletion: 90,
    reportTimeMinutes: 45,
  });

  const loadTasks = useCallback(async () => {
    const res = await reportQcV2Api.listTasks().catch(() => ({ success: false as const, data: null as unknown as QcTask[] }));
    if (res.success && res.data.length > 0) setTasks(res.data);
    else setTasks(DEMO_TASKS);
  }, []);

  const loadStats = useCallback(async () => {
    const res = await reportQcV2Api.getStats().catch(() => ({ success: false as const, data: null as unknown as QcStatsData }));
    if (res.success) setStats(res.data);
    else setStats(DEMO_STATS);
    const rec = await reportQcV2Api.listRecords().catch(() => ({ success: false as const, data: null as unknown as QcRecord[] }));
    if (rec.success && rec.data.length > 0) setRecords(rec.data);
    else setRecords(DEMO_RECORDS);
  }, []);

  useEffect(() => {
    reportQcV2Api
      .getDimensions()
      .catch(() => ({ success: false as const, data: null as unknown as QcDimensionMeta[] }))
      .then((res) => {
        if (res.success && res.data.length > 0) setDimensions(res.data);
      })
      .finally(() => setLoadingDims(false));
    void loadTasks();
    void loadStats();
  }, [loadTasks, loadStats]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTasks(), loadStats()]);
      message.success(t('reportQcV2.refreshed'));
    } finally {
      setRefreshing(false);
    }
  };

  const doScore = async () => {
    if (!form.reportId.trim()) {
      message.warning(t('reportQcV2.enterReportId'));
      return;
    }
    setScoring(true);
    try {
      const res = await reportQcV2Api.score(form).catch(() => ({ success: false as const, data: null as unknown as QcScoreResult }));
      if (res.success) {
        setResult(res.data);
      } else {
        setResult(demoScore(form.reportId));
      }
    } finally {
      setScoring(false);
    }
  };

  const createTask = async () => {
    const res = await reportQcV2Api
      .createTask({ reportId: form.reportId, patientName: '演示患者', modality: form.modality, scoreInput: form })
      .catch(() => ({ success: false as const, data: null as unknown as QcTask }));
    if (res.success) {
      setTasks((prev) => [res.data, ...prev]);
      message.success(t('w9e.reportQcV2.taskCreated', { id: res.data.id }));
    } else {
      message.warning(t('reportQcV2.taskCreateFailed'));
    }
    await loadTasks();
  };

  const runAction = async (task: QcTask, action: 'assign' | 'review' | 'second-review' | 'close', extra?: { reviewer?: string; opinion?: ReviewOpinion; comment?: string }) => {
    const reviewer = extra?.reviewer || '当前质控员';
    const res =
      action === 'assign'
        ? await reportQcV2Api.assignTask(task.id, { assignee: 'u-102', assigneeName: reviewer })
        : action === 'review'
          ? await reportQcV2Api.reviewTask(task.id, { reviewer, opinion: extra?.opinion ?? 'pass', comment: extra?.comment })
          : action === 'second-review'
            ? await reportQcV2Api.secondReviewTask(task.id, { reviewer, opinion: extra?.opinion ?? 'pass', comment: extra?.comment })
            : await reportQcV2Api.closeTask(task.id, { comment: extra?.comment });
    if (res.success) {
      message.success(t('reportQcV2.opSuccess'));
      await loadTasks();
      await loadStats();
    } else {
      message.error(res.error?.message ?? t('reportQcV2.opFailed'));
    }
  };

  return (
    <div data-testid="report-qc-v2-panel" role="region" aria-label={t('reportQcV2.ariaLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card size="small" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)', border: 'none' }} styles={{ body: { padding: 12 } }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <FileCheck2 size={18} color="#fff" />
            <strong style={{ color: '#fff', fontSize: 16 }}>{t('reportQcV2.title')}</strong>
            <Tag color="purple">{t('reportQcV2.tag5dim')}</Tag>
            <Tag color="cyan">F4</Tag>
          </Space>
          <Space>
            <Tag color="gold" icon={<Clock size={12} />}>{t('reportQcV2.totalGradeScope')}</Tag>
            <Button size="small" icon={<RefreshCw size={12} />} loading={refreshing} onClick={refresh}>
              {t('reportQcV2.refresh')}
            </Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={12}>
        {/* ============ 1. 多维评分 ============ */}
        <Col xs={24} xl={10}>
          <Card size="small" title={<Space><Gauge size={14} /> {t('reportQcV2.multiDimScore')}</Space>} extra={<Tag color="blue">{t('reportQcV2.scoreInput')}</Tag>}>
            {loadingDims ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ marginBottom: 4 }}>{t('reportQcV2.reportId')}</div>
                    <Input size="small" value={form.reportId} onChange={(e) => setForm({ ...form, reportId: e.target.value })} placeholder="RPT-xxx" />
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 4 }}>{t('reportQcV2.modality')}</div>
                    <Select size="small" style={{ width: '100%' }} value={form.modality} onChange={(v) => setForm({ ...form, modality: v })} options={['CT', 'MR', 'DR', 'MG', 'US'].map((m) => ({ value: m, label: m }))} />
                  </Col>
                </Row>
                <div style={{ marginBottom: 4 }}>{t('reportQcV2.findings')}</div>
                <Input.TextArea size="small" rows={3} value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} />
                <div style={{ marginBottom: 4 }}>{t('reportQcV2.diagnosis')}</div>
                <Input size="small" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
                <div style={{ marginBottom: 4 }}>{t('reportQcV2.conclusion')}</div>
                <Input size="small" value={form.conclusion} onChange={(e) => setForm({ ...form, conclusion: e.target.value })} />
                <div style={{ marginBottom: 4 }}>{t('reportQcV2.recommendations')}</div>
                <Input size="small" value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} />
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ marginBottom: 4 }}>{t('reportQcV2.techParams')}</div>
                    <Input size="small" value={form.techParams} onChange={(e) => setForm({ ...form, techParams: e.target.value })} />
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 4 }}>{t('reportQcV2.radsCategory')}</div>
                    <Select size="small" allowClear style={{ width: '100%' }} value={form.radsCategory} onChange={(v) => setForm({ ...form, radsCategory: v ?? '' })} options={['RADS 不适用', 'BI-RADS 5', 'PI-RADS 5', 'LI-RADS 4', 'TI-RADS 4'].map((v) => ({ value: v, label: v }))} />
                  </Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ marginBottom: 4 }}>{t('reportQcV2.reportTimeMinutes')}</div>
                    <InputNumber size="small" min={0} max={1440} style={{ width: '100%' }} value={form.reportTimeMinutes} onChange={(v) => setForm({ ...form, reportTimeMinutes: Number(v ?? 0) })} />
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 4 }}>{t('reportQcV2.structuredCompletion')}</div>
                    <Slider min={0} max={100} value={form.structuredCompletion} onChange={(v) => setForm({ ...form, structuredCompletion: v })} tooltip={{ formatter: (v) => `${v}%` }} />
                  </Col>
                </Row>
                <Space>
                  <Switch size="small" checked={form.isCritical} onChange={(v) => setForm({ ...form, isCritical: v })} />
                  <span style={{ fontSize: 12 }}>{t('reportQcV2.criticalReport')}</span>
                  <Button type="primary" size="small" icon={<Gauge size={12} />} loading={scoring} onClick={doScore}>
                    {t('reportQcV2.startScoring')}
                  </Button>
                  <Button size="small" onClick={createTask}>
                    {t('reportQcV2.scoreAndCreateTask')}
                  </Button>
                </Space>
                {result && (
                  <Alert
                    type={result.grade === 'A' || result.grade === 'B' ? 'success' : 'warning'}
                    showIcon
                    title={t('w9e.reportQcV2.scoreDone', { score: result.totalScore, grade: result.grade, model: result.modelVersion })}
                    description={result.suggestions.slice(0, 2).map((s) => <div key={s} style={{ fontSize: 12 }}>{s}</div>)}
                  />
                )}
              </Space>
            )}
          </Card>
        </Col>

        {/* ============ 2. 评分结果 ============ */}
        <Col xs={24} xl={14}>
          <Card
            size="small"
            title={<Space><Award size={14} /> {t('reportQcV2.scoreResult')}</Space>}
            extra={result ? <Tag color={GRADE_COLOR[result.grade]}>{result.grade}{t('reportQcV2.gradeSuffix')}</Tag> : undefined}
          >
            {!result ? (
              <Empty image={<Gauge size={48} style={{ opacity: 0.4 }} />} description={t('reportQcV2.emptyHint')} />
            ) : (
              <ScoreResultView result={result} dimensions={dimensions} />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        {/* ============ 3. 质控任务流 ============ */}
        <Col xs={24} xl={14}>
          <Card size="small" title={<Space><ListChecks size={14} /> {t('reportQcV2.taskFlow')}</Space>} extra={<Tag color="purple">{t('reportQcV2.dualReview')}</Tag>}>
            <TaskFlowTable tasks={tasks} onAction={runAction} />
          </Card>
        </Col>

        {/* ============ 4. 统计 ============ */}
        <Col xs={24} xl={10}>
          <Card size="small" title={<Space><BarChartIcon /> {t('reportQcV2.stats')}</Space>} extra={<Tag color="cyan">{stats.totalTasks} {t('reportQcV2.tasksSuffix')}</Tag>}>
            <StatsView stats={stats} records={records} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ================= 评分结果视图 =================

const ScoreResultView: React.FC<{ result: QcScoreResult; dimensions: QcDimensionMeta[] }> = ({ result, dimensions }) => {
  const dimColors = new Map(dimensions.map((d) => [d.key, d.color]));
  const defectColumns: ColumnsType<QcScoreResult['defects'][number]> = [
    { title: t('reportQcV2.defectCode'), dataIndex: 'code', key: 'code', width: 170, render: (v: string) => <Tag color="red">{v}</Tag> },
    { title: t('reportQcV2.dimension'), dataIndex: 'dimensionLabel', key: 'dimensionLabel', width: 70 },
    { title: t('reportQcV2.defectItem'), dataIndex: 'name', key: 'name', width: 110 },
    { title: t('reportQcV2.severity'), dataIndex: 'severity', key: 'severity', width: 70, render: (v: string) => <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'gold'}>{v === 'high' ? t('reportQcV2.sevHigh') : v === 'medium' ? t('reportQcV2.sevMedium') : t('reportQcV2.sevLow')}</Tag> },
    { title: t('reportQcV2.message'), dataIndex: 'message', key: 'message' },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Row gutter={12}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f8fafc' }}>
            <Statistic title={t('reportQcV2.totalScore')} value={result.totalScore} suffix="/100" valueStyle={{ color: GRADE_COLOR[result.grade], fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f8fafc' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('reportQcV2.grade')}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: GRADE_COLOR[result.grade] }}>{result.grade}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f8fafc' }}>
            <Statistic title={t('reportQcV2.defectCount')} value={result.defects.length} valueStyle={{ color: result.defects.length > 0 ? '#dc2626' : '#10b981' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f8fafc' }}>
            <Statistic title={t('reportQcV2.report')} value={result.reportId} valueStyle={{ fontSize: 12 }} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[8, 8]}>
        {result.dimensions.map((d) => (
          <Col xs={24} sm={12} key={d.key}>
            <Card size="small" style={{ borderLeft: `4px solid ${dimColors.get(d.key) ?? '#3b82f6'}` }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 12 }}>{d.label}</strong>
                <Tag color={d.score >= d.max * 0.85 ? 'green' : d.score >= d.max * 0.6 ? 'gold' : 'red'}>
                  {d.score}/{d.max}
                </Tag>
              </Space>
              <Progress percent={Math.round((d.score / d.max) * 100)} showInfo={false} size="small" strokeColor={dimColors.get(d.key) ?? '#3b82f6'} />
              <Space wrap size={4}>
                {d.subItems.map((s) => (
                  <Tooltip key={s.key} title={s.deducted ? t('reportQcV2.notFullScore') : t('reportQcV2.fullScore')}>
                    <Tag color={s.deducted ? 'default' : 'green'} style={{ fontSize: 11 }}>
                      {s.name} {s.score}/{s.max}
                    </Tag>
                  </Tooltip>
                ))}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      {result.defects.length > 0 && (
        <Table
          size="small"
          rowKey="code"
          columns={defectColumns}
          dataSource={result.defects}
          pagination={false}
          scroll={{ x: 'max-content' }}
          title={() => <strong style={{ fontSize: 12 }}>{t('reportQcV2.autoDefects')} ({result.defects.length})</strong>}
        />
      )}
    </Space>
  );
};

// ================= 任务流表格 =================

const TaskFlowTable: React.FC<{
  tasks: QcTask[];
  onAction: (task: QcTask, action: 'assign' | 'review' | 'second-review' | 'close', extra?: { reviewer?: string; opinion?: ReviewOpinion; comment?: string }) => void;
}> = ({ tasks, onAction }) => {
  const [detail, setDetail] = useState<QcTask | null>(null);
  const [reviewing, setReviewing] = useState<{ task: QcTask; round: 1 | 2 } | null>(null);
  const [reviewer, setReviewer] = useState('张质控');
  const [reviewComment, setReviewComment] = useState('');

  const submitReview = (opinion: ReviewOpinion) => {
    if (!reviewing) return;
    void onAction(reviewing.task, reviewing.round === 1 ? 'review' : 'second-review', {
      reviewer: reviewer.trim() || '当前质控员',
      opinion,
      comment: reviewComment.trim() || (opinion === 'pass' ? t('reportQcV2.reviewPassComment') : t('reportQcV2.reviewReturnComment')),
    });
    setReviewing(null);
    setReviewComment('');
  };

  const columns: ColumnsType<QcTask> = [
    { title: t('reportQcV2.task'), dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('reportQcV2.report'), dataIndex: 'reportId', key: 'reportId', width: 130 },
    { title: t('reportQcV2.patient'), dataIndex: 'patientName', key: 'patientName', width: 80 },
    { title: t('reportQcV2.score'), key: 'score', width: 100, render: (_, r) => (r.totalScore !== undefined ? <Space size={4}><strong style={{ color: GRADE_COLOR[gradeOf(r.grade)] }}>{r.totalScore}</strong><Tag color={GRADE_COLOR[gradeOf(r.grade)]}>{gradeOf(r.grade)}</Tag></Space> : <span style={{ color: '#94a3b8' }}>-</span>) },
    { title: t('reportQcV2.status'), dataIndex: 'status', key: 'status', width: 100, render: (v: QcTaskStatus) => <Tag color={TASK_STATUS_META[v]?.color}>{TASK_STATUS_META[v]?.label}</Tag> },
    { title: t('reportQcV2.assignee'), dataIndex: 'assigneeName', key: 'assigneeName', width: 90, render: (v?: string) => v ?? '-' },
    { title: t('reportQcV2.reviews'), key: 'reviews', width: 90, render: (_, r) => <Tag color={r.reviews.length >= 2 ? 'green' : 'default'}>{r.reviews.length}/2 {t('reportQcV2.peopleSuffix')}</Tag> },
    {
      title: t('reportQcV2.action'),
      key: 'action',
      width: 210,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status === 'pending' && (
            <Button size="small" type="primary" icon={<Users size={12} />} onClick={() => onAction(r, 'assign')}>{t('reportQcV2.assign')}</Button>
          )}
          {r.status === 'in_progress' && (
            <Button size="small" icon={<CheckCircle2 size={12} />} onClick={() => { setReviewer('张质控'); setReviewing({ task: r, round: 1 }); }}>{t('reportQcV2.firstReview')}</Button>
          )}
          {r.status === 'reviewing' && (
            <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => { setReviewer('王主任'); setReviewing({ task: r, round: 2 }); }}>{t('reportQcV2.secondReview')}</Button>
          )}
          {r.status !== 'closed' && (
            <Button size="small" danger icon={<XCircle size={12} />} onClick={() => onAction(r, 'close', { comment: t('reportQcV2.manualCloseComment') })}>{t('reportQcV2.close')}</Button>
          )}
          <Button size="small" onClick={() => setDetail(r)}>{t('reportQcV2.history')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Table size="small" rowKey="id" columns={columns} dataSource={tasks} pagination={{ pageSize: 5, showSizeChanger: false }} scroll={{ x: 'max-content' }} />
      <Modal title={t('w9e.reportQcV2.taskHistoryTitle', { id: detail?.id ?? '' })} open={!!detail} footer={null} onCancel={() => setDetail(null)} width={560}>
        {detail && (
          <List
            size="small"
            dataSource={[...detail.history].reverse()}
            renderItem={(h) => (
              <List.Item>
                <Space direction="vertical" size={0}>
                  <Space>
                    <Tag color="blue">{h.action}</Tag>
                    <strong style={{ fontSize: 12 }}>{h.actor}</strong>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(h.at).toLocaleString('zh-CN')}</span>
                  </Space>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{h.note}</span>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Modal>
      <Modal
        title={reviewing ? t('w9e.reportQcV2.reviewTitle', { round: reviewing.round === 1 ? t('w9e.reportQcV2.firstReviewRound') : t('w9e.reportQcV2.secondReviewRound'), id: reviewing.task.id }) : ''}
        open={!!reviewing}
        onCancel={() => setReviewing(null)}
        footer={null}
        width={420}
      >
        {reviewing && (
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('reportQcV2.report')}>{reviewing.task.reportId}</Descriptions.Item>
              <Descriptions.Item label={t('reportQcV2.patient')}>{reviewing.task.patientName}</Descriptions.Item>
              <Descriptions.Item label={t('reportQcV2.currentScore')}>{reviewing.task.totalScore ?? '-'} ({reviewing.task.grade ?? '-'})</Descriptions.Item>
              {reviewing.round === 2 && (
                <Descriptions.Item label={t('reportQcV2.dualReview')}>{t('reportQcV2.dualReviewHint')}</Descriptions.Item>
              )}
            </Descriptions>
            <div style={{ marginBottom: 4 }}>{t('reportQcV2.reviewer')}</div>
            <Select size="small" style={{ width: '100%' }} value={reviewer} onChange={setReviewer} options={['张质控', '李质控', '王主任'].map((v) => ({ value: v, label: v }))} />
            <div style={{ marginBottom: 4 }}>{t('reportQcV2.reviewOpinion')}</div>
            <Input.TextArea size="small" rows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder={t('reportQcV2.reviewCommentPlaceholder')} />
            <Space>
              <Button size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => submitReview('pass')}>
                {t('reportQcV2.pass')}
              </Button>
              <Button size="small" danger icon={<XCircle size={12} />} onClick={() => submitReview('return')}>
                {t('reportQcV2.return')}
              </Button>
            </Space>
          </Space>
        )}
      </Modal>
    </Space>
  );
};

const gradeOf = (g?: QcGrade): QcGrade => (g ?? 'D') as QcGrade;

// ================= 统计视图 =================

const BarChartIcon: React.FC = () => <FileCheck2 size={14} />;

const StatsView: React.FC<{ stats: QcStatsData; records: QcRecord[] }> = ({ stats, records }) => {
  const columns: ColumnsType<{ key: string; label: string; count: number; high: number; medium: number; low: number }> = [
    { title: t('reportQcV2.dimension'), dataIndex: 'label', key: 'label' },
    { title: t('reportQcV2.defectCount'), dataIndex: 'count', key: 'count', width: 70, render: (v: number) => <strong>{v}</strong> },
    { title: t('reportQcV2.sevHigh'), dataIndex: 'high', key: 'high', width: 50, render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : <span style={{ color: '#cbd5e1' }}>{v}</span>) },
    { title: t('reportQcV2.sevMedium'), dataIndex: 'medium', key: 'medium', width: 50, render: (v: number) => (v > 0 ? <Tag color="orange">{v}</Tag> : <span style={{ color: '#cbd5e1' }}>{v}</span>) },
    { title: t('reportQcV2.sevLow'), dataIndex: 'low', key: 'low', width: 50, render: (v: number) => (v > 0 ? <Tag color="gold">{v}</Tag> : <span style={{ color: '#cbd5e1' }}>{v}</span>) },
  ];
  const trendColumns: ColumnsType<{ month: string; count: number; avgScore: number }> = [
    { title: t('reportQcV2.month'), dataIndex: 'month', key: 'month' },
    { title: t('reportQcV2.taskCount'), dataIndex: 'count', key: 'count', width: 70 },
    { title: t('reportQcV2.avgScore'), dataIndex: 'avgScore', key: 'avgScore', width: 80, render: (v: number) => <strong style={{ color: v >= 85 ? '#10b981' : '#f59e0b' }}>{v}</strong> },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Row gutter={8}>
        <Col span={8}>
          <Card size="small"><Statistic title={t('reportQcV2.avgScore')} value={stats.avgScore} valueStyle={{ fontSize: 20, color: stats.avgScore >= 85 ? '#10b981' : '#f59e0b' }} /></Card>
        </Col>
        <Col span={8}>
          <Card size="small"><Statistic title={t('reportQcV2.passRate')} value={stats.passRate} suffix="%" valueStyle={{ fontSize: 20, color: '#3b82f6' }} /></Card>
        </Col>
        <Col span={8}>
          <Card size="small"><Statistic title={t('reportQcV2.totalDefects')} value={stats.defectDistribution.reduce((a, d) => a + d.count, 0)} valueStyle={{ fontSize: 20, color: '#dc2626' }} /></Card>
        </Col>
      </Row>
      <Space wrap>
        {(['A', 'B', 'C', 'D'] as QcGrade[]).map((g) => {
          const count = stats.gradeDistribution.find((x) => x.grade === g)?.count ?? 0;
          return (
            <Tag key={g} color={GRADE_COLOR[g]} style={{ fontSize: 12 }}>
              {g}{t('reportQcV2.gradeSuffix')} × {count}
            </Tag>
          );
        })}
        <Tag color="purple">{stats.taskByStatus.closed ?? 0} {t('reportQcV2.closedLoop')}</Tag>
      </Space>
      <Table size="small" rowKey="key" columns={columns} dataSource={stats.defectDistribution} pagination={false} title={() => <strong style={{ fontSize: 12 }}>{t('reportQcV2.defectDistribution')}</strong>} />
      <Table size="small" rowKey="month" columns={trendColumns} dataSource={stats.monthlyTrend} pagination={false} title={() => <strong style={{ fontSize: 12 }}>{t('reportQcV2.monthlyTrend')}</strong>} />
      <div style={{ fontSize: 12, color: '#94a3b8' }}>
        {t('reportQcV2.recentRecords')} {records.slice(0, 3).map((r) => r.id).join(' / ') || '-'}
      </div>
    </Space>
  );
};

// ================= 演示评分 (API 不可用时确定性回退) =================

function hashOf(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function demoScore(reportId: string): QcScoreResult {
  const h = hashOf(reportId)
  const totalScore = 88 + (h % 12)
  const grade: QcGrade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : 'C'
  return {
    id: `QS-DEMO-${reportId}`,
    reportId,
    modality: 'CT',
    totalScore,
    grade,
    modelVersion: 'qc-v2.1 (demo)',
    evaluatedAt: new Date().toISOString(),
    dimensions: DEMO_DIMENSIONS.map((d, i) => ({
      key: d.key,
      label: d.label,
      score: d.max - ((h >> i) % 4),
      max: d.max,
      subItems: d.subItems.map((s) => ({ key: s.key, name: s.name, score: s.max - ((h >> (i + s.key.length)) % 2), max: s.max, deducted: ((h >> (i + s.key.length)) % 2) === 1 })),
      issues: [],
    })),
    defects: [],
    suggestions: ['演示模式: API 不可用, 展示确定性回退评分。'],
  };
}

export default ReportQcV2Panel;

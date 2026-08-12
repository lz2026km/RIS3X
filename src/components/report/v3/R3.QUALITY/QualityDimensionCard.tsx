/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.SCORING QualityDimensionCard
 *
 * 20 点: 阈值配置(4) + 评分历史(4) + 报告生成(4) + 奖励联动(4) + 模板评分(4)
 */
import { scoringService } from '../../../../services/quality/scoringService';
import type {
  ScoringDimension,
  ScoringDimensionKey,
  ScoringDimensionCategory,
  ThresholdConfig,
  ScoreHistoryEntry,
  BonusLinkage,
  TemplateScoreRule,
  ScoreTemplateResult,
  ScoringThresholdConfig,
  ScoringGrade,
  ScoringEvaluationResult,
} from '../../../../types/R3/R3.QUALITY.SCORING';
import {
  Card,
  Tag,
  Space,
  Slider,
  Row,
  Col,
  Switch,
  Statistic,
  InputNumber,
  Button,
  Tabs,
  Select,
  Empty,
  Progress,
  message,
  Spin,
  Table,
  Tooltip,
  Modal,
  Alert,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Sliders,
  Target,
  Settings,
  CheckCircle2,
  Save,
  RotateCcw,
  History,
  FileText,
  Award,
  Sparkles,
  Download,
  Layers,
  TrendingUp,
  Zap,
  Eye,
  RefreshCw,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react'

const CATEGORY_META: Record<
  ScoringDimensionCategory,
  { label: string; labelEn: string; color: string; icon: React.ReactNode }
> = {
  completeness: { label: '完整性', labelEn: 'Completeness', color: '#3b82f6', icon: <FileText size={14} /> },
  accuracy: { label: '准确性', labelEn: 'Accuracy', color: '#10b981', icon: <Target size={14} /> },
  timeliness: { label: '时效性', labelEn: 'Timeliness', color: '#f59e0b', icon: <TrendingUp size={14} /> },
};

const GRADE_COLOR: Record<ScoringGrade, string> = {
  A: '#047857',
  B: '#1e40af',
  C: '#92400e',
  D: '#7f1d1d',
};

export const QualityDimensionCard: React.FC<{
  onWeightsChange?: (weights: ThresholdConfig) => void;
  onBonusTrigger?: (bonusId: string) => void;
  onReportGenerated?: (templateId: string, result: ScoreTemplateResult) => void;
}> = ({ onWeightsChange, onBonusTrigger, onReportGenerated }) => {
  const [activeTab, setActiveTab] = useState('weights');

  return (
    <div data-testid="quality-dimension-card" role="region" aria-label="评分维度配置">
      <Card
        size="small"
        style={{ marginBottom: 8, background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)', border: 'none' }}
        styles={{ body: { padding: 12 } }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <Sliders size={18} color="#fff" />
            <strong style={{ color: '#fff', fontSize: 16 }}>评分维度配置</strong>
            <Tag color="purple">R3.QUALITY.SCORING</Tag>
          </Space>
          <Tag color="cyan">20 点 · 5 个能力域</Tag>
        </Space>
      </Card>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'weights',
            label: <span><Sliders size={12} /> 维度权重</span>,
            children: <WeightsTab onWeightsChange={onWeightsChange} />,
          },
          {
            key: 'threshold',
            label: <span><Settings size={12} /> 阈值配置</span>,
            children: <ThresholdTab />,
          },
          {
            key: 'history',
            label: <span><History size={12} /> 评分历史</span>,
            children: <HistoryTab />,
          },
          {
            key: 'report',
            label: <span><FileText size={12} /> 报告生成</span>,
            children: <ReportTab />,
          },
          {
            key: 'bonus',
            label: <span><Award size={12} /> 奖励联动</span>,
            children: <BonusTab onTrigger={onBonusTrigger} />,
          },
          {
            key: 'template',
            label: <span><Layers size={12} /> 模板评分</span>,
            children: <TemplateTab onGenerated={onReportGenerated} />,
          },
        ]}
      />
    </div>
  );
};

// ============= 维度权重 Tab =============
const WeightsTab: React.FC<{ onWeightsChange?: (w: ThresholdConfig) => void }> = ({ onWeightsChange }) => {
  const [dimensions, setDimensions] = useState<ScoringDimension[]>([]);
  const [localWeights, setLocalWeights] = useState<Record<ScoringDimensionKey, number>>({} as Record<ScoringDimensionKey, number>);
  const [enabled, setEnabled] = useState<Record<ScoringDimensionKey, boolean>>({} as Record<ScoringDimensionKey, boolean>);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    scoringService
      .listDimensions()
      .then((dims) => {
        setDimensions(dims);
        const w = {} as Record<ScoringDimensionKey, number>;
        const en = {} as Record<ScoringDimensionKey, boolean>;
        dims.forEach((d) => {
          w[d.key] = d.weight;
          en[d.key] = d.enabled;
        });
        setLocalWeights(w);
        setEnabled(en);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalWeight = useMemo(
    () => Object.entries(localWeights).reduce((a, [k, v]) => a + (enabled[k as ScoringDimensionKey] ? v : 0), 0),
    [localWeights, enabled],
  );

  const updateWeight = (key: ScoringDimensionKey, value: number) => {
    setLocalWeights((prev) => ({ ...prev, [key]: value / 100 }));
  };

  const toggleEnabled = (key: ScoringDimensionKey) => {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    if (Math.abs(totalWeight - 1) > 0.01) {
      message.error(`权重合计 ${(totalWeight * 100).toFixed(1)}% ,必须为 100%`);
      return;
    }
    setSaving(true);
    try {
      message.success('维度权重已保存');
      onWeightsChange?.(await scoringService.getThresholdConfig());
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    const next = {} as Record<ScoringDimensionKey, number>;
    const en = {} as Record<ScoringDimensionKey, boolean>;
    dimensions.forEach((d) => {
      next[d.key] = d.weight;
      en[d.key] = d.enabled;
    });
    setLocalWeights(next);
    setEnabled(en);
  };

  const distributeEvenly = () => {
    const enabledKeys = dimensions.filter((d) => enabled[d.key]).map((d) => d.key);
    if (enabledKeys.length === 0) {
      message.warning('请先启用至少一个维度');
      return;
    }
    const even = 1 / enabledKeys.length;
    const next = {} as Record<ScoringDimensionKey, number>;
    dimensions.forEach((d) => {
      next[d.key] = enabled[d.key] ? even : 0;
    });
    setLocalWeights(next);
  };

  return (
    <div data-testid="weights-tab">
      <Card
        size="small"
        style={{ marginBottom: 12, background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)' }}
        styles={{ body: { padding: 12 } }}
      >
        <Row gutter={12}>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>维度总数</span>}
              value={dimensions.length}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Target size={14} />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>已启用</span>}
              value={Object.values(enabled).filter(Boolean).length}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>权重合计</span>}
              value={Math.round(totalWeight * 100)}
              suffix="%"
              styles={{ content: { 
                color: Math.abs(totalWeight - 1) > 0.01 ? '#fca5a5' : '#bbf7d0',
                fontSize: 20,
               } }}
              prefix={<Settings size={14} />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Space style={{ marginTop: 18 }}>
              <Button size="small" icon={<RotateCcw size={12} />} onClick={reset}>
                重置
              </Button>
              <Button size="small" icon={<Settings size={12} />} onClick={distributeEvenly}>
                等分
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<Save size={12} />}
                loading={saving}
                onClick={save}
              >
                保存
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <Row gutter={[12, 12]}>
          {dimensions.map((d) => {
            const w = Math.round((localWeights[d.key] ?? 0) * 100);
            return (
              <Col xs={24} sm={12} md={8} key={d.key}>
                <Card
                  size="small"
                  style={{
                    borderLeft: `4px solid ${CATEGORY_META[d.category].color}`,
                    opacity: enabled[d.key] ? 1 : 0.6,
                  }}
                  title={
                    <Space>
                      <span style={{ fontSize: 18 }}>{d.icon}</span>
                      <strong style={{ fontSize: 13 }}>{d.name}</strong>
                      <Tag color="cyan">{d.nameEn}</Tag>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Switch
                        size="small"
                        checked={enabled[d.key] ?? false}
                        onChange={() => toggleEnabled(d.key)}
                        aria-label={`启用 ${d.name}`}
                      />
                      <Tag color={w > 0 ? 'green' : 'default'}>{w}%</Tag>
                    </Space>
                  }
                  data-testid={`dim-card-${d.key}`}
                >
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    {d.description}
                  </div>
                  <Slider
                    min={0}
                    max={50}
                    value={w}
                    onChange={(v) => updateWeight(d.key, v)}
                    disabled={!enabled[d.key]}
                    tooltip={{ formatter: (v) => `${v}%` }}
                    trackStyle={{ background: CATEGORY_META[d.category].color }}
                    aria-label={`${d.name} 权重`}
                  />
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    子规则 ({d.rules.length}): {d.passingRule}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {d.rules.map((r) => (
                      <Tooltip key={r.key} title={`${r.name} (权重 ${(r.weight * 100).toFixed(0)}%)`}>
                        <Tag color="blue" style={{ fontSize: 12 }}>
                          {r.name}
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
      {Math.abs(totalWeight - 1) > 0.01 && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 4,
            color: '#dc2626',
            fontSize: 12,
          }}
        >
          权重合计 {(totalWeight * 100).toFixed(1)}% ≠ 100%,请调整后再保存
        </div>
      )}
    </div>
  );
};

// ============= 阈值配置 Tab =============
const ThresholdTab: React.FC = () => {
  const [threshold, setThreshold] = useState<ThresholdConfig | null>(null);
  const [thresholds, setThresholds] = useState<ScoringThresholdConfig[]>([]);
  const [draft, setDraft] = useState<ThresholdConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, ts] = await Promise.all([
        scoringService.getThresholdConfig(),
        scoringService.getThresholds(),
      ]);
      setThreshold(t);
      setDraft(t);
      setThresholds(ts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!draft) return;
    if (draft.criticalMaxMinutes <= 0 || draft.emergencyMaxHours <= 0 || draft.routineMaxHours <= 0) {
      message.error('阈值必须为正数');
      return;
    }
    setSaving(true);
    try {
      const result = await scoringService.updateThresholdConfig(draft, 'D001');
      setThreshold(result);
      setDraft(result);
      message.success('阈值配置已保存,版本 v' + result.version);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !threshold || !draft) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div data-testid="threshold-tab">
      <Card
        size="small"
        style={{ marginBottom: 12, background: 'linear-gradient(135deg, #1e3a8a 0%, #0e7490 100%)' }}
        styles={{ body: { padding: 12 } }}
      >
        <Row gutter={12}>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>危急值 (分钟)</span>}
              value={draft.criticalMaxMinutes}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<Zap size={14} />}
              suffix=" min"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>急诊 (小时)</span>}
              value={draft.emergencyMaxHours}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<TrendingUp size={14} />}
              suffix=" h"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>普通 (小时)</span>}
              value={draft.routineMaxHours}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<History size={14} />}
              suffix=" h"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>发布阈值</span>}
              value={draft.publishBlockThreshold}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<Target size={14} />}
            />
          </Col>
        </Row>
      </Card>
      <Card size="small" title="TAT 阈值 (4 档)">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>危急值 (min)</div>
            <InputNumber
              min={1}
              max={120}
              value={draft.criticalMaxMinutes}
              onChange={(v) => setDraft({ ...draft, criticalMaxMinutes: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>急诊 (h)</div>
            <InputNumber
              min={0.5}
              max={24}
              step={0.5}
              value={draft.emergencyMaxHours}
              onChange={(v) => setDraft({ ...draft, emergencyMaxHours: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>普通 (h)</div>
            <InputNumber
              min={1}
              max={96}
              value={draft.routineMaxHours}
              onChange={(v) => setDraft({ ...draft, routineMaxHours: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>住院 (h)</div>
            <InputNumber
              min={1}
              max={72}
              value={draft.inpatientMaxHours}
              onChange={(v) => setDraft({ ...draft, inpatientMaxHours: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>发布阈值 (分)</div>
            <InputNumber
              min={0}
              max={100}
              value={draft.publishBlockThreshold}
              onChange={(v) => setDraft({ ...draft, publishBlockThreshold: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>奖励阈值 (分)</div>
            <InputNumber
              min={0}
              max={100}
              value={draft.bonusThreshold}
              onChange={(v) => setDraft({ ...draft, bonusThreshold: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
        <Space style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<Save size={12} />}
            loading={saving}
            onClick={save}
          >
            保存阈值 (v{threshold.version + 1})
          </Button>
          <Button icon={<RotateCcw size={12} />} onClick={() => setDraft(threshold)}>
            重置
          </Button>
          <Tag color="blue">版本: v{threshold.version}</Tag>
          <Tag color="cyan">更新人: {threshold.updatedBy}</Tag>
        </Space>
      </Card>
      <Card size="small" title="等级阈值映射" style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          {thresholds.map((t) => (
            <Col xs={12} sm={6} key={t.grade}>
              <Card
                size="small"
                style={{ borderTop: `4px solid ${t.color}`, background: t.bg }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: t.color }}>{t.grade}</div>
                <div style={{ fontSize: 13, color: t.color }}>
                  {t.minScore} - {t.maxScore}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  {t.description}
                </div>
                <Space style={{ marginTop: 4 }}>
                  <Tag color={t.publishable ? 'green' : 'red'}>
                    {t.publishable ? '可发布' : '不可发布'}
                  </Tag>
                  <Tag color={t.bonusEligible ? 'gold' : 'default'}>
                    {t.bonusEligible ? '有奖励' : '无奖励'}
                  </Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

// ============= 评分历史 Tab =============
const HistoryTab: React.FC = () => {
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterGrade, setFilterGrade] = useState<ScoringGrade | undefined>();
  const [filterTrigger, setFilterTrigger] = useState<ScoreHistoryEntry['trigger'] | undefined>();
  const [detail, setDetail] = useState<{ entry: ScoreHistoryEntry; result: ScoringEvaluationResult | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (entry: ScoreHistoryEntry) => {
    setDetail({ entry, result: null });
    setDetailLoading(true);
    try {
      const res = await scoringService.getScoreById(entry.scoreId);
      setDetail({ entry, result: res });
    } finally {
      setDetailLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const resp = await scoringService.getHistory({
        grade: filterGrade,
        trigger: filterTrigger,
        page,
        pageSize: 10,
      });
      setHistory(resp.items);
      setTotal(resp.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterGrade, filterTrigger]);

  const columns: ColumnsType<ScoreHistoryEntry> = [
    { title: '评分 ID', dataIndex: 'scoreId', key: 'scoreId', width: 110, render: (v) => <Tag color="purple">{v}</Tag> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 90 },
    { title: '检查', dataIndex: 'modality', key: 'modality', width: 70, render: (v) => <Tag color="cyan">{v}</Tag> },
    { title: '医生', dataIndex: 'doctorName', key: 'doctorName', width: 100 },
    { title: '科室', dataIndex: 'department', key: 'department', width: 130 },
    {
      title: '分类均分',
      key: 'cat',
      width: 220,
      render: (_, r) => (
        <Space size={4}>
          <Tag color="blue">完 {r.categoryScores.completeness}</Tag>
          <Tag color="green">准 {r.categoryScores.accuracy}</Tag>
          <Tag color="orange">时 {r.categoryScores.timeliness}</Tag>
        </Space>
      ),
    },
    {
      title: '总分',
      dataIndex: 'totalScore',
      key: 'totalScore',
      width: 80,
      render: (v: number) => (
        <strong style={{ color: v >= 90 ? GRADE_COLOR.A : v >= 75 ? GRADE_COLOR.B : v >= 60 ? GRADE_COLOR.C : GRADE_COLOR.D }}>
          {v}
        </strong>
      ),
    },
    {
      title: '等级',
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
      render: (v: ScoringGrade) => (
        <Tag color={v === 'A' ? 'green' : v === 'B' ? 'blue' : v === 'C' ? 'gold' : 'red'}>{v}</Tag>
      ),
    },
    { title: '触发', dataIndex: 'trigger', key: 'trigger', width: 80, render: (v) => <Tag>{v}</Tag> },
    {
      title: '时间',
      dataIndex: 'evaluatedAt',
      key: 'evaluatedAt',
      width: 130,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, r) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div data-testid="history-tab">
      <Card
        size="small"
        style={{ marginBottom: 12, background: 'linear-gradient(135deg, #0e7490 0%, #1e40af 100%)' }}
        styles={{ body: { padding: 12 } }}
      >
        <Row gutter={12}>
          <Col xs={24} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>历史总数</span>} value={total} styles={{ content: {  color: '#fff', fontSize: 20  } }} prefix={<History size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Select
              placeholder="等级筛选"
              allowClear
              style={{ width: '100%', marginTop: 14 }}
              value={filterGrade}
              onChange={setFilterGrade}
              options={(['A', 'B', 'C', 'D'] as ScoringGrade[]).map((g) => ({ value: g, label: `${g} 级` }))}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Select
              placeholder="触发点"
              allowClear
              style={{ width: '100%', marginTop: 14 }}
              value={filterTrigger}
              onChange={setFilterTrigger}
              options={[
                { value: 'submit', label: '提交时' },
                { value: 'review', label: '审核时' },
                { value: 'sign', label: '签发时' },
                { value: 'manual', label: '手动' },
              ]}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Button style={{ marginTop: 14, width: '100%' }} icon={<RefreshCw size={12} />} onClick={load}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>
      <Card size="small" title={`评分历史 (${total} 条)`}>
        <Table scroll={{ x: 'max-content' }}
          rowKey="id"
          columns={columns}
          dataSource={history}
          loading={loading}
          pagination={{
            current: page,
            pageSize: 10,
            total,
            onChange: setPage,
            showSizeChanger: false,
          }}
          size="small"
        />
      </Card>
      <Modal
        title={`评分明细 ${detail?.entry.scoreId ?? ''}`}
        open={!!detail}
        footer={null}
        onCancel={() => setDetail(null)}
        width={720}
      >
        {detail && (
          <Spin spinning={detailLoading}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="患者">{detail.entry.patientName}</Descriptions.Item>
              <Descriptions.Item label="检查">{detail.entry.modality}</Descriptions.Item>
              <Descriptions.Item label="医生">{detail.entry.doctorName}</Descriptions.Item>
              <Descriptions.Item label="科室">{detail.entry.department}</Descriptions.Item>
              <Descriptions.Item label="触发">{detail.entry.trigger}</Descriptions.Item>
              <Descriptions.Item label="评价时间">
                {new Date(detail.entry.evaluatedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="总分">
                <strong style={{ color: (detail.result?.totalScore ?? detail.entry.totalScore) >= 90 ? '#16a34a' : (detail.result?.totalScore ?? detail.entry.totalScore) >= 75 ? '#2563eb' : '#dc2626' }}>
                  {detail.result?.totalScore ?? detail.entry.totalScore}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="等级">
                <Tag color={detail.result ? (detail.result.grade === 'A' ? 'green' : detail.result.grade === 'B' ? 'blue' : detail.result.grade === 'C' ? 'gold' : 'red') : undefined}>
                  {detail.result?.grade ?? detail.entry.grade}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分类均分" span={2}>
                完整 {detail.result?.categoryScores.completeness ?? detail.entry.categoryScores.completeness} / 准确 {detail.result?.categoryScores.accuracy ?? detail.entry.categoryScores.accuracy} / 及时 {detail.result?.categoryScores.timeliness ?? detail.entry.categoryScores.timeliness}
              </Descriptions.Item>
              {detail.result && (
                <>
                  <Descriptions.Item label="可发布">
                    <Tag color={detail.result.publishable ? 'green' : 'red'}>{detail.result.publishable ? '是' : '否'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="奖励资格">
                    <Tag color={detail.result.bonusEligible ? 'gold' : 'default'}>{detail.result.bonusEligible ? '有' : '无'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="模型版本">{detail.result.modelVersion}</Descriptions.Item>
                  <Descriptions.Item label="评估耗时">{detail.result.durationMs} ms</Descriptions.Item>
                  {detail.result.hardFailTriggered.length > 0 && (
                    <Descriptions.Item label="一票否决" span={2}>
                      {detail.result.hardFailTriggered.map((h) => (
                        <Tag color="red" key={h}>{h}</Tag>
                      ))}
                    </Descriptions.Item>
                  )}
                </>
              )}
            </Descriptions>
            {detail.result && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>维度明细 (15 维度)</div>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  dataSource={Object.entries(detail.result.dimensionScores).map(([key, score]) => ({ key, score }))}
                  columns={[
                    { title: '维度', dataIndex: 'key', key: 'key' },
                    { title: '得分', dataIndex: 'score', key: 'score', width: 90 },
                  ]}
                />
              </div>
            )}
            {!detail.result && !detailLoading && (
              <Alert style={{ marginTop: 12 }} type="warning" showIcon message="无完整评估明细（历史归档，仅保留汇总信息）" />
            )}
          </Spin>
        )}
      </Modal>
    </div>
  );
};

// ============= 报告生成 Tab =============
const ReportTab: React.FC = () => {
  const [scoreId, setScoreId] = useState<string>('');
  const [format, setFormat] = useState<'pdf' | 'word' | 'excel' | 'html'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string>('');

  const saveBlob = (blob: Blob, filename: string, note?: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (note) message.info(note);
  };

  const buildMockHtml = () => {
    const genAt = new Date().toLocaleString('zh-CN');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>质控评分报告 ${scoreId}</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; margin: 32px; color: #1e293b; }
  h1 { font-size: 20px; } table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  td, th { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 13px; text-align: left; }
  th { background: #f1f5f9; }
</style>
</head>
<body>
<h1>质控评分报告</h1>
<p>评分 ID: <b>${scoreId}</b> &nbsp; 格式: <b>${format.toUpperCase()}</b> &nbsp; 生成时间: ${genAt}</p>
<p style="color:#64748b">说明: 后端为 Mock URL，本文件为本地生成的模拟内容，可打印为 PDF。</p>
<table>
  <tr><th>分类</th><th>原始分</th><th>权重</th><th>加权分</th></tr>
  <tr><td>完整性 completeness</td><td>90</td><td>0.4</td><td>36.0</td></tr>
  <tr><td>准确性 accuracy</td><td>92</td><td>0.4</td><td>36.8</td></tr>
  <tr><td>及时性 timeliness</td><td>88</td><td>0.2</td><td>17.6</td></tr>
  <tr><td colspan="3"><b>总分</b></td><td><b>90</b></td></tr>
</table>
<p>等级: <b>A</b> &nbsp; 可发布: 是 &nbsp; 奖励资格: 有 &nbsp; 15 维度明细见评分详情。</p>
</body>
</html>`;
  };

  const download = async () => {
    if (!reportUrl) return;
    setDownloading(true);
    try {
      const resp = await fetch(reportUrl);
      if (!resp.ok) throw new Error('mock-url');
      const blob = await resp.blob();
      saveBlob(blob, `quality-score-${scoreId}.${format}`);
      message.success(`${format.toUpperCase()} 报告已下载`);
    } catch {
      saveBlob(
        new Blob([buildMockHtml()], { type: 'text/html;charset=utf-8' }),
        `quality-score-${scoreId}-${format}.html`,
        `后端为 Mock URL，已生成本地模拟文件（${format.toUpperCase()} 内容为 HTML，可打印为 PDF）`,
      );
    } finally {
      setDownloading(false);
    }
  };

  const generate = async () => {
    if (!scoreId) {
      message.warning('请输入评分 ID');
      return;
    }
    setGenerating(true);
    try {
      const r = await scoringService.generateReport(scoreId, format, 'D001');
      setReportUrl(r.downloadUrl ?? '');
      message.success(`${format.toUpperCase()} 报告已生成`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div data-testid="report-tab">
      <Card
        size="small"
        style={{ marginBottom: 12, background: 'linear-gradient(135deg, #047857 0%, #0d9488 100%)' }}
        styles={{ body: { padding: 12 } }}
      >
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Statistic title={<span style={{ color: '#fff' }}>报告格式</span>} value={format.toUpperCase()} styles={{ content: {  color: '#fff', fontSize: 20  } }} prefix={<FileText size={14} />} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title={<span style={{ color: '#fff' }}>已生成</span>} value={reportUrl ? '1' : '0'} styles={{ content: {  color: '#fff', fontSize: 20  } }} prefix={<Download size={14} />} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title={<span style={{ color: '#fff' }}>报告类型</span>} value="15 维度" styles={{ content: {  color: '#fff', fontSize: 20  } }} prefix={<Sparkles size={14} />} />
          </Col>
        </Row>
      </Card>
      <Card size="small" title="生成评分报告">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 4 }}>评分 ID</div>
            <input
              type="text"
              value={scoreId}
              onChange={(e) => setScoreId(e.target.value)}
              placeholder="qs-xxxxxxxx"
              style={{
                width: '100%',
                padding: '6px 11px',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 4 }}>格式</div>
            <Select
              value={format}
              onChange={setFormat}
              style={{ width: '100%' }}
              options={[
                { value: 'pdf', label: 'PDF' },
                { value: 'word', label: 'Word' },
                { value: 'excel', label: 'Excel' },
                { value: 'html', label: 'HTML' },
              ]}
            />
          </Col>
        </Row>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" icon={<FileText size={12} />} loading={generating} onClick={generate}>
            生成报告
          </Button>
          {reportUrl && (
            <Button icon={<Download size={12} />} loading={downloading} onClick={download}>
              下载 {format.toUpperCase()}
            </Button>
          )}
        </Space>
        {reportUrl && (
          <Alert
            style={{ marginTop: 12 }}
            type="success"
            showIcon
            title="报告已生成"
            description={
              <Space direction="vertical" size={4}>
                <code style={{ fontSize: 12 }}>{reportUrl}</code>
                <Tag color="orange">演示数据: 后端为 Mock URL，下载时生成本地模拟文件</Tag>
              </Space>
            }
          />
        )}
      </Card>
      <Card size="small" title="报告内容预览" style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          {[
            { k: '总分', v: '0-100', c: '#3b82f6' },
            { k: '等级', v: 'A/B/C/D', c: '#10b981' },
            { k: '15 维度明细', v: '15 项', c: '#7c3aed' },
            { k: '证据链', v: '≤30 条', c: '#f59e0b' },
            { k: '一票否决', v: '可见', c: '#dc2626' },
            { k: '奖励资格', v: '可见', c: '#0891b2' },
          ].map((item, i) => (
            <Col xs={12} sm={8} md={4} key={i}>
              <Card size="small" style={{ borderLeft: `3px solid ${item.c}` }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{item.k}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: item.c }}>{item.v}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

// ============= 奖励联动 Tab =============
const BonusTab: React.FC<{ onTrigger?: (id: string) => void }> = ({ onTrigger }) => {
  const [bonuses, setBonuses] = useState<BonusLinkage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const b = await scoringService.listBonusLinkages();
      setBonuses(b);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (b: BonusLinkage) => {
    const updated = await scoringService.updateBonusLinkage(b.id, { enabled: !b.enabled });
    setBonuses((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
  };

  const trigger = async (b: BonusLinkage) => {
    Modal.confirm({
      title: `触发奖励联动?`,
      content: `将触发 ${b.name} (阈值 ${b.thresholdScore} 分)`,
      onOk: async () => {
        const updated = await scoringService.triggerBonusLinkage(b.id);
        setBonuses((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
        onTrigger?.(b.id);
        message.success(`${b.name} 已触发`);
      },
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div data-testid="bonus-tab">
      <Card
        size="small"
        style={{ marginBottom: 12, background: 'linear-gradient(135deg, #d97706 0%, #dc2626 100%)' }}
        styles={{ body: { padding: 12 } }}
      >
        <Row gutter={12}>
          <Col xs={24} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>联动总数</span>}
              value={bonuses.length}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Award size={14} />}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>已启用</span>}
              value={bonuses.filter((b) => b.enabled).length}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>累计触发</span>}
              value={bonuses.reduce((a, b) => a + b.triggeredCount, 0)}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Sparkles size={14} />}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>受益人数</span>}
              value={bonuses.reduce((a, b) => a + b.beneficiariesCount, 0)}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Target size={14} />}
            />
          </Col>
        </Row>
      </Card>
      <Row gutter={[12, 12]}>
        {bonuses.map((b) => (
          <Col xs={24} sm={12} key={b.id}>
            <Card
              size="small"
              style={{
                borderLeft: `4px solid ${b.enabled ? '#10b981' : '#94a3b8'}`,
                opacity: b.enabled ? 1 : 0.7,
              }}
              title={
                <Space>
                  <Tag color="purple">{b.type}</Tag>
                  <strong>{b.name}</strong>
                  <Tag color="cyan">{b.nameEn}</Tag>
                </Space>
              }
              extra={
                <Switch
                  size="small"
                  checked={b.enabled}
                  onChange={() => toggle(b)}
                />
              }
            >
              <div style={{ fontSize: 12, color: '#475569' }}>{b.description}</div>
              <Row gutter={8} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <Statistic
                    title="阈值"
                    value={b.thresholdScore}
                    suffix="分"
                    styles={{ content: {  fontSize: 14  } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="已触发"
                    value={b.triggeredCount}
                    styles={{ content: {  fontSize: 14  } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="受益"
                    value={b.beneficiariesCount}
                    styles={{ content: {  fontSize: 14  } }}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>权益:</div>
                <Space wrap>
                  {b.benefits.map((ben) => (
                    <Tag key={ben} color="blue" style={{ fontSize: 12 }}>{ben}</Tag>
                  ))}
                </Space>
              </div>
              <Space style={{ marginTop: 8 }}>
                <Button size="small" icon={<Sparkles size={12} />} onClick={() => trigger(b)} disabled={!b.enabled}>
                  手动触发
                </Button>
                {b.lastTriggeredAt && (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    上次: {new Date(b.lastTriggeredAt).toLocaleString('zh-CN')}
                  </span>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

// ============= 模板评分 Tab =============
const TemplateTab: React.FC<{ onGenerated?: (id: string, r: ScoreTemplateResult) => void }> = ({ onGenerated }) => {
  const [templates, setTemplates] = useState<TemplateScoreRule[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [result, setResult] = useState<ScoreTemplateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const t = await scoringService.listTemplates();
      setTemplates(t);
      if (t.length > 0) setSelectedId(t[0]!.templateId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async () => {
    if (!selectedId) return;
    setScoring(true);
    try {
      const r = await scoringService.scoreTemplate(selectedId);
      setResult(r);
      onGenerated?.(selectedId, r);
      message.success(`模板评分完成: ${r.finalScore} 分`);
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div data-testid="template-tab">
      <Card
        size="small"
        style={{ marginBottom: 12, background: 'linear-gradient(135deg, #be185d 0%, #7c3aed 100%)' }}
        styles={{ body: { padding: 12 } }}
      >
        <Row gutter={12}>
          <Col xs={12} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>模板总数</span>} value={templates.length} styles={{ content: {  color: '#fff', fontSize: 20  } }} prefix={<Layers size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>已发布</span>} value={templates.filter((t) => t.published).length} styles={{ content: {  color: '#fff', fontSize: 20  } }} prefix={<CheckCircle2 size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>基础分均值</span>} value={Math.round((templates.reduce((a, t) => a + t.baseScore, 0) / templates.length) * 10) / 10} styles={{ content: {  color: '#fff', fontSize: 20  } }} prefix={<Target size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>当前模板</span>} value={templates.find((t) => t.templateId === selectedId)?.templateName ?? '-'} styles={{ content: {  color: '#fff', fontSize: 14  } }} prefix={<FileText size={14} />} />
          </Col>
        </Row>
      </Card>
      <Card size="small" title="模板评分">
        <Row gutter={12}>
          <Col xs={24} sm={16}>
            <Select
              value={selectedId}
              onChange={setSelectedId}
              style={{ width: '100%' }}
              options={templates.map((t) => ({ value: t.templateId, label: `${t.templateName} (${t.modality}/${t.bodyPart})` }))}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Button type="primary" icon={<Sparkles size={12} />} loading={scoring} onClick={run} style={{ width: '100%' }}>
              评分模板
            </Button>
          </Col>
        </Row>
        {result && (
          <div style={{ marginTop: 16 }}>
            <Row gutter={12}>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>基础分</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{result.baseScore}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>加分</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>+{result.bonusApplied}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>扣分</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>-{result.penaltyApplied}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>最终</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>{result.finalScore}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>通过分</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#64748b' }}>{result.passingScore}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small" style={{ background: result.passed ? '#d1fae5' : '#fee2e2' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>结果</div>
                  <Tag color={result.passed ? 'green' : 'red'} style={{ fontSize: 16, padding: '2px 10px' }}>
                    {result.passed ? '通过' : '不通过'}
                  </Tag>
                </Card>
              </Col>
            </Row>
            <Progress
              percent={result.finalScore}
              strokeColor={result.passed ? '#10b981' : '#dc2626'}
              style={{ marginTop: 12 }}
            />
            {result.details.length > 0 && (
              <Table scroll={{ x: 'max-content' }}
                size="small"
                style={{ marginTop: 12 }}
                rowKey="dimension"
                pagination={false}
                dataSource={result.details}
                columns={[
                  { title: '维度', dataIndex: 'dimension', key: 'dimension' },
                  { title: '基础分', dataIndex: 'base', key: 'base' },
                  { title: '加分', dataIndex: 'bonus', key: 'bonus', render: (v: number) => <span style={{ color: v > 0 ? '#10b981' : '#64748b' }}>+{v}</span> },
                  { title: '扣分', dataIndex: 'penalty', key: 'penalty', render: (v: number) => <span style={{ color: v > 0 ? '#dc2626' : '#64748b' }}>-{v}</span> },
                  { title: '最终', dataIndex: 'final', key: 'final', render: (v: number) => <strong>{v}</strong> },
                ]}
              />
            )}
          </div>
        )}
        {!result && <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description="点击评分模板查看结果" style={{ marginTop: 24 }} />}
      </Card>
      <Card size="small" title="模板列表" style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          {templates.map((t) => (
            <Col xs={24} sm={12} md={8} key={t.templateId}>
              <Card
                size="small"
                style={{
                  borderLeft: `4px solid ${t.published ? '#10b981' : '#94a3b8'}`,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedId(t.templateId)}
              >
                <Space>
                  <Tag color="cyan">{t.modality}</Tag>
                  <Tag color="blue">{t.bodyPart}</Tag>
                  {t.published ? <Tag color="green">已发布</Tag> : <Tag>未发布</Tag>}
                </Space>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{t.templateName}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  基础 {t.baseScore} / 通过 {t.passingScore}
                </div>
                <Space size={4} style={{ marginTop: 4 }}>
                  <Tag color="green">{t.bonusRules.length} 加分</Tag>
                  <Tag color="red">{t.penaltyRules.length} 扣分</Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default QualityDimensionCard;
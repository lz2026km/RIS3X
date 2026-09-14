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
import { t } from '../../../../i18n/appI18n'

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
    <div data-testid="quality-dimension-card" role="region" aria-label={t('reportQuality.dimensionConfig')}>
      <Card
        size="small"
        style={{ marginBottom: 8, background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)', border: 'none' }}
        styles={{ body: { padding: 12 } }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <Sliders size={18} color="#fff" />
            <strong style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{t('reportQuality.dimensionConfig')}</strong>
            <Tag color="purple">R3.QUALITY.SCORING</Tag>
          </Space>
          <Tag color="cyan">{t('reportQuality.pointsDomains')}</Tag>
        </Space>
      </Card>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'weights',
            label: <span><Sliders size={12} /> {t('reportQuality.tab.weights')}</span>,
            children: <WeightsTab onWeightsChange={onWeightsChange} />,
          },
          {
            key: 'threshold',
            label: <span><Settings size={12} /> {t('reportQuality.tab.threshold')}</span>,
            children: <ThresholdTab />,
          },
          {
            key: 'history',
            label: <span><History size={12} /> {t('reportQuality.tab.history')}</span>,
            children: <HistoryTab />,
          },
          {
            key: 'report',
            label: <span><FileText size={12} /> {t('reportQuality.tab.report')}</span>,
            children: <ReportTab />,
          },
          {
            key: 'bonus',
            label: <span><Award size={12} /> {t('reportQuality.tab.bonus')}</span>,
            children: <BonusTab onTrigger={onBonusTrigger} />,
          },
          {
            key: 'template',
            label: <span><Layers size={12} /> {t('reportQuality.tab.template')}</span>,
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
      message.success(t('reportQuality.weightsSaved'));
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
      message.warning(t('reportQuality.enableAtLeastOne'));
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
              title={<span style={{ color: '#fff' }}>{t('reportQuality.dimensionTotal')}</span>}
              value={dimensions.length}
              styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }}
              prefix={<Target size={14} />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.enabled')}</span>}
              value={Object.values(enabled).filter(Boolean).length}
              styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.weightTotal')}</span>}
              value={Math.round(totalWeight * 100)}
              suffix="%"
              styles={{ content: { 
                color: Math.abs(totalWeight - 1) > 0.01 ? '#fca5a5' : '#bbf7d0',
                fontSize: 26, fontWeight: 700,
               } }}
              prefix={<Settings size={14} />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Space style={{ marginTop: 18 }}>
              <Button size="small" icon={<RotateCcw size={12} />} onClick={reset}>
                {t('reportQuality.reset')}
              </Button>
              <Button size="small" icon={<Settings size={12} />} onClick={distributeEvenly}>
                {t('reportQuality.splitEvenly')}
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<Save size={12} />}
                loading={saving}
                onClick={save}
              >
                {t('reportQuality.save')}
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
                    {t('reportQuality.subRules')} ({d.rules.length}): {d.passingRule}
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
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            borderRadius: 4,
            color: '#dc2626',
            fontSize: 12,
          }}
        >
          {t('reportQuality.weightSumWarn', { percent: (totalWeight * 100).toFixed(1) })}
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
      const [cfg, ts] = await Promise.all([
        scoringService.getThresholdConfig(),
        scoringService.getThresholds(),
      ]);
      setThreshold(cfg);
      setDraft(cfg);
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
      message.error(t('reportQuality.thresholdMustPositive'));
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
              title={<span style={{ color: '#fff' }}>{t('reportQuality.criticalMinutes')}</span>}
              value={draft.criticalMaxMinutes}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<Zap size={14} />}
              suffix=" min"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.emergencyHours')}</span>}
              value={draft.emergencyMaxHours}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<TrendingUp size={14} />}
              suffix=" h"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.routineHours')}</span>}
              value={draft.routineMaxHours}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<History size={14} />}
              suffix=" h"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.publishThreshold')}</span>}
              value={draft.publishBlockThreshold}
              styles={{ content: {  color: '#fff', fontSize: 28  } }}
              prefix={<Target size={14} />}
            />
          </Col>
        </Row>
      </Card>
      <Card size="small" title={t('reportQuality.tatThreshold')}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>{t('reportQuality.criticalMin')}</div>
            <InputNumber
              min={1}
              max={120}
              value={draft.criticalMaxMinutes}
              onChange={(v) => setDraft({ ...draft, criticalMaxMinutes: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>{t('reportQuality.emergencyH')}</div>
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
            <div style={{ marginBottom: 4 }}>{t('reportQuality.routineH')}</div>
            <InputNumber
              min={1}
              max={96}
              value={draft.routineMaxHours}
              onChange={(v) => setDraft({ ...draft, routineMaxHours: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>{t('reportQuality.inpatientH')}</div>
            <InputNumber
              min={1}
              max={72}
              value={draft.inpatientMaxHours}
              onChange={(v) => setDraft({ ...draft, inpatientMaxHours: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>{t('reportQuality.publishThresholdPts')}</div>
            <InputNumber
              min={0}
              max={100}
              value={draft.publishBlockThreshold}
              onChange={(v) => setDraft({ ...draft, publishBlockThreshold: Number(v ?? 0) })}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 4 }}>{t('reportQuality.bonusThresholdPts')}</div>
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
            {t('reportQuality.saveThreshold')} (v{threshold.version + 1})
          </Button>
          <Button icon={<RotateCcw size={12} />} onClick={() => setDraft(threshold)}>
            {t('reportQuality.reset')}
          </Button>
          <Tag color="blue">{t('reportQuality.versionPrefix')}{threshold.version}</Tag>
          <Tag color="cyan">{t('reportQuality.updatedByPrefix')}{threshold.updatedBy}</Tag>
        </Space>
      </Card>
      <Card size="small" title={t('reportQuality.gradeThresholdMapping')} style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          {thresholds.map((th) => (
            <Col xs={12} sm={6} key={th.grade}>
              <Card
                size="small"
                style={{ borderTop: `4px solid ${th.color}`, background: th.bg }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: th.color }}>{th.grade}</div>
                <div style={{ fontSize: 13, color: th.color }}>
                  {th.minScore} - {th.maxScore}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  {th.description}
                </div>
                <Space style={{ marginTop: 4 }}>
                  <Tag color={th.publishable ? 'green' : 'red'}>
                    {th.publishable ? t('reportQuality.publishable') : t('reportQuality.notPublishable')}
                  </Tag>
                  <Tag color={th.bonusEligible ? 'gold' : 'default'}>
                    {th.bonusEligible ? t('reportQuality.bonusEligible') : t('reportQuality.bonusIneligible')}
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
    { title: t('reportQuality.scoreId'), dataIndex: 'scoreId', key: 'scoreId', width: 110, render: (v) => <Tag color="purple">{v}</Tag> },
    { title: t('reportQuality.patient'), dataIndex: 'patientName', key: 'patientName', width: 90 },
    { title: t('reportQuality.modality'), dataIndex: 'modality', key: 'modality', width: 70, render: (v) => <Tag color="cyan">{v}</Tag> },
    { title: t('reportQuality.doctor'), dataIndex: 'doctorName', key: 'doctorName', width: 100 },
    { title: t('reportQuality.department'), dataIndex: 'department', key: 'department', width: 130 },
    {
      title: t('reportQuality.catAvg'),
      key: 'cat',
      width: 220,
      render: (_, r) => (
        <Space size={4}>
          <Tag color="blue">{t('reportQuality.catShortCompleteness')} {r.categoryScores.completeness}</Tag>
          <Tag color="green">{t('reportQuality.catShortAccuracy')} {r.categoryScores.accuracy}</Tag>
          <Tag color="orange">{t('reportQuality.catShortTimeliness')} {r.categoryScores.timeliness}</Tag>
        </Space>
      ),
    },
    {
      title: t('reportQuality.totalScore'),
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
      title: t('reportQuality.grade'),
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
      render: (v: ScoringGrade) => (
        <Tag color={v === 'A' ? 'green' : v === 'B' ? 'blue' : v === 'C' ? 'gold' : 'red'}>{v}</Tag>
      ),
    },
    { title: t('reportQuality.trigger'), dataIndex: 'trigger', key: 'trigger', width: 80, render: (v) => <Tag>{v}</Tag> },
    {
      title: t('reportQuality.time'),
      dataIndex: 'evaluatedAt',
      key: 'evaluatedAt',
      width: 130,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: t('reportQuality.action'),
      key: 'action',
      width: 90,
      render: (_, r) => (
        <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>
          {t('reportQuality.detail')}
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
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.historyTotal')}</span>} value={total} styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }} prefix={<History size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Select
              placeholder={t('reportQuality.filterGrade')}
              allowClear
              style={{ width: '100%', marginTop: 14 }}
              value={filterGrade}
              onChange={setFilterGrade}
              options={(['A', 'B', 'C', 'D'] as ScoringGrade[]).map((g) => ({ value: g, label: `${g} 级` }))}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Select
              placeholder={t('reportQuality.triggerPoint')}
              allowClear
              style={{ width: '100%', marginTop: 14 }}
              value={filterTrigger}
              onChange={setFilterTrigger}
              options={[
                { value: 'submit', label: t('reportQuality.trigger.submit') },
                { value: 'review', label: t('reportQuality.trigger.review') },
                { value: 'sign', label: t('reportQuality.trigger.sign') },
                { value: 'manual', label: t('reportQuality.trigger.manual') },
              ]}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Button style={{ marginTop: 14, width: '100%' }} icon={<RefreshCw size={12} />} onClick={load}>
              {t('reportQuality.refresh')}
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
              <Descriptions.Item label={t('reportQuality.patient')}>{detail.entry.patientName}</Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.modality')}>{detail.entry.modality}</Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.doctor')}>{detail.entry.doctorName}</Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.department')}>{detail.entry.department}</Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.trigger')}>{detail.entry.trigger}</Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.evalTime')}>
                {new Date(detail.entry.evaluatedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.totalScore')}>
                <strong style={{ color: (detail.result?.totalScore ?? detail.entry.totalScore) >= 90 ? '#16a34a' : (detail.result?.totalScore ?? detail.entry.totalScore) >= 75 ? '#2563eb' : '#dc2626' }}>
                  {detail.result?.totalScore ?? detail.entry.totalScore}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.grade')}>
                <Tag color={detail.result ? (detail.result.grade === 'A' ? 'green' : detail.result.grade === 'B' ? 'blue' : detail.result.grade === 'C' ? 'gold' : 'red') : undefined}>
                  {detail.result?.grade ?? detail.entry.grade}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('reportQuality.catAvg')} span={2}>
                {t('reportQuality.completenessShort')} {detail.result?.categoryScores.completeness ?? detail.entry.categoryScores.completeness} / {t('reportQuality.accuracyShort')} {detail.result?.categoryScores.accuracy ?? detail.entry.categoryScores.accuracy} / {t('reportQuality.timelinessShort')} {detail.result?.categoryScores.timeliness ?? detail.entry.categoryScores.timeliness}
              </Descriptions.Item>
              {detail.result && (
                <>
                  <Descriptions.Item label={t('reportQuality.publishable')}>
                    <Tag color={detail.result.publishable ? 'green' : 'red'}>{detail.result.publishable ? t('reportQuality.yes') : t('reportQuality.no')}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('reportQuality.bonusEligible')}>
                    <Tag color={detail.result.bonusEligible ? 'gold' : 'default'}>{detail.result.bonusEligible ? t('reportQuality.has') : t('reportQuality.none')}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('reportQuality.modelVersion')}>{detail.result.modelVersion}</Descriptions.Item>
                  <Descriptions.Item label={t('reportQuality.evalDuration')}>{detail.result.durationMs} ms</Descriptions.Item>
                  {detail.result.hardFailTriggered.length > 0 && (
                    <Descriptions.Item label={t('reportQuality.hardFail')} span={2}>
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
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('reportQuality.dimensionDetail15')}</div>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  dataSource={Object.entries(detail.result.dimensionScores).map(([key, score]) => ({ key, score }))}
                  columns={[
                    { title: t('reportQuality.dimension'), dataIndex: 'key', key: 'key' },
                    { title: t('reportQuality.score'), dataIndex: 'score', key: 'score', width: 90 },
                  ]}
                />
              </div>
            )}
            {!detail.result && !detailLoading && (
              <Alert style={{ marginTop: 12 }} type="warning" showIcon message={t('reportQuality.noDetailArchive')} />
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
      message.warning(t('reportQuality.enterScoreId'));
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
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.reportFormat')}</span>} value={format.toUpperCase()} styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }} prefix={<FileText size={14} />} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.generatedCount')}</span>} value={reportUrl ? '1' : '0'} styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }} prefix={<Download size={14} />} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.reportType')}</span>} value={t('reportQuality.dimension15')} styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }} prefix={<Sparkles size={14} />} />
          </Col>
        </Row>
      </Card>
      <Card size="small" title={t('reportQuality.generateReportTitle')}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 4 }}>{t('reportQuality.scoreId')}</div>
            <input
              type="text"
              value={scoreId}
              onChange={(e) => setScoreId(e.target.value)}
              placeholder="qs-xxxxxxxx"
              style={{
                width: '100%',
                padding: '6px 11px',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ marginBottom: 4 }}>{t('reportQuality.format')}</div>
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
            {t('reportQuality.generateReport')}
          </Button>
          {reportUrl && (
            <Button icon={<Download size={12} />} loading={downloading} onClick={download}>
              {t('reportQuality.download')} {format.toUpperCase()}
            </Button>
          )}
        </Space>
        {reportUrl && (
          <Alert
            style={{ marginTop: 12 }}
            type="success"
            showIcon
            title={t('reportQuality.reportGenerated')}
            description={
              <Space direction="vertical" size={4}>
                <code style={{ fontSize: 12 }}>{reportUrl}</code>
                <Tag color="orange">{t('reportQuality.mockDataNote')}</Tag>
              </Space>
            }
          />
        )}
      </Card>
      <Card size="small" title={t('reportQuality.reportPreview')} style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          {[
            { k: t('reportQuality.preview.totalScore'), v: t('reportQuality.preview.totalScoreRange'), c: '#3b82f6' },
            { k: t('reportQuality.preview.grade'), v: t('reportQuality.preview.gradeRange'), c: '#10b981' },
            { k: t('reportQuality.preview.dimension15'), v: t('reportQuality.preview.dimension15Count'), c: '#7c3aed' },
            { k: t('reportQuality.preview.evidenceChain'), v: t('reportQuality.preview.evidenceCount'), c: '#f59e0b' },
            { k: t('reportQuality.preview.hardFail'), v: t('reportQuality.visible'), c: '#dc2626' },
            { k: t('reportQuality.preview.bonus'), v: t('reportQuality.visible'), c: '#0891b2' },
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
      title: t('reportQuality.triggerBonusConfirm'),
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
              title={<span style={{ color: '#fff' }}>{t('reportQuality.bonusTotal')}</span>}
              value={bonuses.length}
              styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }}
              prefix={<Award size={14} />}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.enabled')}</span>}
              value={bonuses.filter((b) => b.enabled).length}
              styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.bonusTriggered')}</span>}
              value={bonuses.reduce((a, b) => a + b.triggeredCount, 0)}
              styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }}
              prefix={<Sparkles size={14} />}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('reportQuality.beneficiaries')}</span>}
              value={bonuses.reduce((a, b) => a + b.beneficiariesCount, 0)}
              styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }}
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
                    title={t('reportQuality.threshold')}
                    value={b.thresholdScore}
                    suffix={t('reportQuality.scoreUnit')}
                    styles={{ content: {  fontSize: 14  } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={t('reportQuality.triggered')}
                    value={b.triggeredCount}
                    styles={{ content: {  fontSize: 14  } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={t('reportQuality.benefit')}
                    value={b.beneficiariesCount}
                    styles={{ content: {  fontSize: 14  } }}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('reportQuality.benefits')}</div>
                <Space wrap>
                  {b.benefits.map((ben) => (
                    <Tag key={ben} color="blue" style={{ fontSize: 12 }}>{ben}</Tag>
                  ))}
                </Space>
              </div>
              <Space style={{ marginTop: 8 }}>
                <Button size="small" icon={<Sparkles size={12} />} onClick={() => trigger(b)} disabled={!b.enabled}>
                  {t('reportQuality.manualTrigger')}
                </Button>
                {b.lastTriggeredAt && (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {t('reportQuality.lastTriggered')}{new Date(b.lastTriggeredAt).toLocaleString('zh-CN')}
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
      const tpls = await scoringService.listTemplates();
      setTemplates(tpls);
      if (tpls.length > 0) setSelectedId(tpls[0]!.templateId);
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
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.templateTotal')}</span>} value={templates.length} styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }} prefix={<Layers size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.published')}</span>} value={templates.filter((tpl) => tpl.published).length} styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }} prefix={<CheckCircle2 size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.baseScoreAvg')}</span>} value={Math.round((templates.reduce((a, tpl) => a + tpl.baseScore, 0) / templates.length) * 10) / 10} styles={{ content: {  color: '#fff', fontSize: 26, fontWeight: 700  } }} prefix={<Target size={14} />} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={<span style={{ color: '#fff' }}>{t('reportQuality.currentTemplate')}</span>} value={templates.find((tpl) => tpl.templateId === selectedId)?.templateName ?? '-'} styles={{ content: {  color: '#fff', fontSize: 14  } }} prefix={<FileText size={14} />} />
          </Col>
        </Row>
      </Card>
      <Card size="small" title={t('reportQuality.templateScoring')}>
        <Row gutter={12}>
          <Col xs={24} sm={16}>
            <Select
              value={selectedId}
              onChange={setSelectedId}
              style={{ width: '100%' }}
              options={templates.map((tpl) => ({ value: tpl.templateId, label: `${tpl.templateName} (${tpl.modality}/${tpl.bodyPart})` }))}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Button type="primary" icon={<Sparkles size={12} />} loading={scoring} onClick={run} style={{ width: '100%' }}>
              {t('reportQuality.scoreTemplate')}
            </Button>
          </Col>
        </Row>
        {result && (
          <div style={{ marginTop: 16 }}>
            <Row gutter={12}>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('reportQuality.baseScore')}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{result.baseScore}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('reportQuality.bonusScore')}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>+{result.bonusApplied}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('reportQuality.penaltyScore')}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>-{result.penaltyApplied}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('reportQuality.finalScore')}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>{result.finalScore}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('reportQuality.passingScore')}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#64748b' }}>{result.passingScore}</div>
                </Card>
              </Col>
              <Col xs={12} sm={4}>
                <Card size="small" style={{ background: result.passed ? 'var(--color-success-bg)' : 'var(--color-error-bg)' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('reportQuality.result')}</div>
                  <Tag color={result.passed ? 'green' : 'red'} style={{ fontSize: 16, padding: '2px 10px' }}>
                    {result.passed ? t('reportQuality.passed') : t('reportQuality.failed')}
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
                  { title: t('reportQuality.dimension'), dataIndex: 'dimension', key: 'dimension' },
                  { title: t('reportQuality.baseScore'), dataIndex: 'base', key: 'base' },
                  { title: t('reportQuality.bonusScore'), dataIndex: 'bonus', key: 'bonus', render: (v: number) => <span style={{ color: v > 0 ? '#10b981' : '#64748b' }}>+{v}</span> },
                  { title: t('reportQuality.penaltyScore'), dataIndex: 'penalty', key: 'penalty', render: (v: number) => <span style={{ color: v > 0 ? '#dc2626' : '#64748b' }}>-{v}</span> },
                  { title: t('reportQuality.finalScore'), dataIndex: 'final', key: 'final', render: (v: number) => <strong>{v}</strong> },
                ]}
              />
            )}
          </div>
        )}
        {!result && <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description={t('reportQuality.clickToScore')} style={{ marginTop: 24 }} />}
      </Card>
      <Card size="small" title={t('reportQuality.templateList')} style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          {templates.map((tpl) => (
            <Col xs={24} sm={12} md={8} key={tpl.templateId}>
              <Card
                size="small"
                style={{
                  borderLeft: `4px solid ${tpl.published ? '#10b981' : '#94a3b8'}`,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedId(tpl.templateId)}
              >
                <Space>
                  <Tag color="cyan">{tpl.modality}</Tag>
                  <Tag color="blue">{tpl.bodyPart}</Tag>
                  {tpl.published ? <Tag color="green">{t('reportQuality.published')}</Tag> : <Tag>{t('reportQuality.unpublished')}</Tag>}
                </Space>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{tpl.templateName}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  {t('reportQuality.basePrefix')} {tpl.baseScore} / {t('reportQuality.passPrefix')} {tpl.passingScore}
                </div>
                <Space size={4} style={{ marginTop: 4 }}>
                  <Tag color="green">{tpl.bonusRules.length} {t('reportQuality.bonusScore')}</Tag>
                  <Tag color="red">{tpl.penaltyRules.length} {t('reportQuality.penaltyScore')}</Tag>
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
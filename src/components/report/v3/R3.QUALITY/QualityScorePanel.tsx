/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.SCORING QualityScorePanel 15维评分
 *
 * 60 点: 5 完整 + 5 准确 + 5 时效 = 15 维度评分
 */
import { scoringService } from '../../../../services/quality/scoringService';
import type { ScoringDimension, ScoringEvaluationResult, ScoringThresholdConfig, ScoringDimensionCategory, QualityScoreReport } from '../../../../types/R3/R3.QUALITY.SCORING';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Progress,
  Statistic,
  Tabs,
  Button,
  Alert,
  Empty,
  Select,
  message,
  Spin,
} from 'antd';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  TrendingUp,
  Download,
  Sparkles,
  BarChart3,
  Activity,
  Clock,
  Target,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../../../../i18n/appI18n';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { ChartContainer } from '../../../charts';
import { Inbox } from 'lucide-react'

const CATEGORY_META: Record<
  ScoringDimensionCategory,
  { label: string; labelEn: string; color: string; icon: React.ReactNode }
> = {
  completeness: { label: t('qualityScore.category.completeness'), labelEn: 'Completeness', color: '#3b82f6', icon: <FileText size={14} /> },
  accuracy: { label: t('qualityScore.category.accuracy'), labelEn: 'Accuracy', color: '#10b981', icon: <Target size={14} /> },
  timeliness: { label: t('qualityScore.category.timeliness'), labelEn: 'Timeliness', color: '#f59e0b', icon: <Clock size={14} /> },
};

const GRADE_META: Record<
  ScoringThresholdConfig['grade'],
  { color: string; bg: string; border: string; label: string }
> = {
  A: { color: '#047857', bg: '#d1fae5', border: '#6ee7b7', label: t('qualityScore.grade.A') },
  B: { color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', label: t('qualityScore.grade.B') },
  C: { color: '#92400e', bg: '#fef3c7', border: '#fcd34d', label: t('qualityScore.grade.C') },
  D: { color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', label: t('qualityScore.grade.D') },
};

export const QualityScorePanel: React.FC<{
  score?: ScoringEvaluationResult | null;
  reportId?: string;
  onRescore?: () => void;
  onGenerateReport?: (report: QualityScoreReport) => void;
}> = ({ score: initialScore, reportId, onRescore, onGenerateReport }) => {
  const [dimensions, setDimensions] = useState<ScoringDimension[]>([]);
  const [thresholds, setThresholds] = useState<ScoringThresholdConfig[]>([]);
  const [score, setScore] = useState<ScoringEvaluationResult | null>(initialScore ?? null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ScoringDimensionCategory>('completeness');

  const load = async () => {
    setLoading(true);
    try {
      const [dims, ths] = await Promise.all([
        scoringService.listDimensions(),
        scoringService.getThresholds(),
      ]);
      setDimensions(dims);
      setThresholds(ths);
      if (!score) {
        const samples = await scoringService.listSampleSubmissions();
        if (samples.length > 0) {
          setSampleIndex(0);
          const ev = await scoringService.evaluate(samples[0]!);
          setScore(ev);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialScore) setScore(initialScore);
  }, [initialScore]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const samples = await scoringService.listSampleSubmissions();
      const idx = sampleIndex % samples.length;
      const ev = await scoringService.evaluate(samples[idx]!);
      setScore(ev);
      setSampleIndex(idx + 1);
      message.success(t('w9e.qualityScorePanel.scoreDone', { score: ev.totalScore, grade: ev.grade }));
    } finally {
      setEvaluating(false);
    }
  };

  const handleGenerateReport = async (format: QualityScoreReport['format']) => {
    if (!score) {
      message.warning(t('qualityScore.noScoreForReport'));
      return;
    }
    setGenerating(true);
    try {
      const report = await scoringService.generateReport(score.scoreId, format, 'D001');
      onGenerateReport?.(report);
      message.success(t('w9e.qualityScorePanel.reportGenerated', { format: format.toUpperCase() }));
    } finally {
      setGenerating(false);
    }
  };

  const radarData = useMemo(
    () =>
      dimensions
        .filter((d) => d.enabled)
        .map((d) => ({
          dimension: d.name,
          score: score?.dimensionScores[d.key] ?? 0,
          category: d.category,
          fullMark: 100,
        })),
    [dimensions, score],
  );

  const categoryRadar = useMemo(
    () =>
      (['completeness', 'accuracy', 'timeliness'] as ScoringDimensionCategory[]).map((cat) => ({
        category: CATEGORY_META[cat].label,
        score: score?.categoryScores[cat] ?? 0,
        fullMark: 100,
      })),
    [score],
  );

  const barData = useMemo(
    () =>
      dimensions
        .filter((d) => d.enabled)
        .map((d) => ({
          name: d.name,
          score: Math.round((score?.dimensionScores[d.key] ?? 0) * 10) / 10,
          weight: Math.round(d.weight * 100),
          category: d.category,
        })),
    [dimensions, score],
  );

  const categoryBarData = useMemo(
    () =>
      (['completeness', 'accuracy', 'timeliness'] as ScoringDimensionCategory[]).map((cat) => {
        const dims = dimensions.filter((d) => d.category === cat && d.enabled);
        const totalWeight = dims.reduce((a, d) => a + d.weight, 0);
        const weighted = dims.reduce((a, d) => a + (score?.dimensionScores[d.key] ?? 0) * d.weight, 0);
        return {
          category: CATEGORY_META[cat].label,
          score: totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : 0,
          fill: CATEGORY_META[cat].color,
        };
      }),
    [dimensions, score],
  );

  const filteredDimensions = useMemo(
    () => dimensions.filter((d) => d.category === activeCategory && d.enabled),
    [dimensions, activeCategory],
  );

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin /> <div style={{ marginTop: 12, color: '#64748b' }}>{t('qualityScore.loading')}</div>
        </div>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card data-testid="quality-score-panel" role="region" aria-label={t('qualityScore.ariaLabel')}>
        <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description={t('qualityScore.noScore')} />
      </Card>
    );
  }

  const gradeMeta = GRADE_META[score.grade];

  return (
    <div data-testid="quality-score-panel" role="region" aria-label={t('qualityScore.ariaLabel')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 50%, #db2777 100%)',
          color: '#fff',
          padding: '14px 18px',
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space size="middle" wrap>
            <Award size={20} />
            <strong style={{ fontSize: 16 }}>{t('qualityScore.title')}</strong>
            <Tag color="purple">R3.QUALITY.SCORING</Tag>
            <Tag color="cyan">{score.modelVersion}</Tag>
            {reportId && <Tag color="blue">{t('qualityScore.reportPrefix')}{reportId}</Tag>}
          </Space>
          <Space wrap>
            <Button
              size="small"
              icon={<RefreshCw size={12} />}
              onClick={onRescore ?? handleEvaluate}
              loading={evaluating}
            >
              {t('qualityScore.rescore')}
            </Button>
            <Select
              size="small"
              value={"report" as QualityScoreReport['format']}
              style={{ width: 110 }}
              onChange={(v: QualityScoreReport['format']) => handleGenerateReport(v)}
              loading={generating}
              options={[
                { value: 'pdf', label: t('qualityScore.reportFormat.pdf') },
                { value: 'word', label: t('qualityScore.reportFormat.word') },
                { value: 'excel', label: t('qualityScore.reportFormat.excel') },
                { value: 'html', label: t('qualityScore.reportFormat.html') },
              ]}
              suffixIcon={<Download size={12} />}
            />
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 14 }}>
          <Col xs={12} sm={6}>
            <div
              style={{
                background: 'rgba(255,255,255,0.18)',
                padding: 12,
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {score.totalScore}
              </div>
              <Tag
                style={{
                  marginTop: 6,
                  background: gradeMeta.bg,
                  color: gradeMeta.color,
                  border: `1px solid ${gradeMeta.border}`,
                  fontWeight: 600,
                }}
              >
                {gradeMeta.label}
              </Tag>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {t('qualityScore.fullScore100')}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityScore.completenessAvg')}</span>}
              value={score.categoryScores.completeness}
              precision={1}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<FileText size={14} />}
              suffix="/100"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityScore.accuracyAvg')}</span>}
              value={score.categoryScores.accuracy}
              precision={1}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Target size={14} />}
              suffix="/100"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityScore.timelinessAvg')}</span>}
              value={score.categoryScores.timeliness}
              precision={1}
              styles={{ content: {  color: '#fff', fontSize: 20  } }}
              prefix={<Clock size={14} />}
              suffix="/100"
            />
          </Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 8 }}>
          <Col xs={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityScore.publishable')}</span>}
              value={score.publishable ? t('qualityScore.yes') : t('qualityScore.no')}
              styles={{ content: { 
                color: score.publishable ? '#bbf7d0' : '#fca5a5',
                fontSize: 18,
               } }}
              prefix={score.publishable ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityScore.bonusEligible')}</span>}
              value={score.bonusEligible ? t('qualityScore.yes') : t('qualityScore.no')}
              styles={{ content: { 
                color: score.bonusEligible ? '#bbf7d0' : '#fcd34d',
                fontSize: 18,
               } }}
              prefix={score.bonusEligible ? <Sparkles size={14} /> : <Zap size={14} />}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('qualityScore.evalDuration')}</span>}
              value={score.durationMs}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Activity size={14} />}
              suffix="ms"
            />
          </Col>
        </Row>
      </div>

      {score.hardFailTriggered.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title={`${t('qualityScore.hardFailTriggered')} ${score.hardFailTriggered.join(', ')}`}
          description={t('qualityScore.hardFailDescription')}
        />
      )}

      <Tabs
        defaultActiveKey="radar"
        items={[
          {
            key: 'radar',
            label: <span><BarChart3 size={12} /> {t('qualityScore.tab.radar')}</span>,
            children: (
              <Card size="small" title={t('qualityScore.radarTitle')}>
                <Row gutter={12}>
                  <Col xs={24} md={14}>
                    <ChartContainer type="radar" height={320}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Radar
                          name={t('qualityScore.series.score')}
                          dataKey="score"
                          stroke="#7c3aed"
                          fill="#7c3aed"
                          fillOpacity={0.45}
                        />
                        <RTooltip />
                      </RadarChart>
                    </ChartContainer>
                  </Col>
                  <Col xs={24} md={10}>
                    <ChartContainer type="radar" height={320}>
                      <RadarChart data={categoryRadar}>
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Radar
                          name={t('qualityScore.series.categoryAvg')}
                          dataKey="score"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.4}
                        />
                        <RTooltip />
                      </RadarChart>
                    </ChartContainer>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'bar',
            label: <span><BarChart3 size={12} /> {t('qualityScore.tab.bar')}</span>,
            children: (
              <Card size="small" title={t('qualityScore.barTitle')}>
                <ChartContainer type="bar" height={360}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 16, bottom: 24, left: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={130} />
                    <RTooltip />
                    <Bar dataKey="score" name={t('qualityScore.series.score')}>
                      {barData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={CATEGORY_META[d.category as ScoringDimensionCategory].color}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <ChartContainer type="bar" height={220}>
                  <BarChart data={categoryBarData} margin={{ top: 8, right: 16, bottom: 24, left: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <RTooltip />
                    <Bar dataKey="score" name={t('qualityScore.series.categoryAvg')}>
                      {categoryBarData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </Card>
            ),
          },
          {
            key: 'category',
            label: <span><FileText size={12} /> {t('qualityScore.tab.category')}</span>,
            children: (
              <Card
                size="small"
                title={
                  <Space>
                    <span>{t('qualityScore.viewByCategory')}</span>
                    <Select
                      size="small"
                      value={activeCategory}
                      onChange={setActiveCategory}
                      style={{ width: 120 }}
                      options={(['completeness', 'accuracy', 'timeliness'] as ScoringDimensionCategory[]).map((c) => ({
                        value: c,
                        label: CATEGORY_META[c].label,
                      }))}
                    />
                  </Space>
                }
              >
                <Row gutter={[12, 12]}>
                  {filteredDimensions.map((d) => {
                    const s = score.dimensionScores[d.key] ?? 0;
                    const grade = thresholds.find(
                      (t) => s >= t.minScore && s <= t.maxScore,
                    );
                    return (
                      <Col xs={24} sm={12} md={8} key={d.key}>
                        <Card
                          size="small"
                          style={{ borderTop: `3px solid ${CATEGORY_META[d.category].color}` }}
                          data-testid={`dim-${d.key}`}
                        >
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Space>
                              <span style={{ fontSize: 20 }}>{d.icon}</span>
                              <strong style={{ fontSize: 12 }}>{d.name}</strong>
                            </Space>
                            {grade && (
                              <Tag
                                style={{
                                  background: grade.bg,
                                  color: grade.color,
                                  border: `1px solid ${grade.border}`,
                                }}
                              >
                                {grade.grade}
                              </Tag>
                            )}
                          </Space>
                          <Progress
                            percent={s}
                            strokeColor={CATEGORY_META[d.category].color}
                            style={{ marginTop: 8 }}
                          />
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            {t('qualityScore.weight')} {(d.weight * 100).toFixed(1)}% · {t('qualityScore.score')} {s.toFixed(1)}/100
                          </div>
                          <div style={{ fontSize: 12, color: '#0891b2', marginTop: 4 }}>
                            {t('qualityScore.rule')} {d.passingRule}
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            ),
          },
          {
            key: 'evidence',
            label: <span><Sparkles size={12} /> {t('qualityScore.tab.evidence')}</span>,
            children: (
              <Card size="small" title={t('w9e.qualityScorePanel.evidenceTitle', { count: score.evidence.length })}>
                {score.evidence.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('qualityScore.noEvidence')} />
                ) : (
                  score.evidence.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 8,
                        marginBottom: 4,
                        background: e.score >= 90 ? '#d1fae5' : e.score >= 75 ? '#dbeafe' : '#fef3c7',
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    >
                      <Space>
                        <Tag color="purple">{e.dimension}</Tag>
                        <Tag color="cyan">{e.rule}</Tag>
                        <strong>{e.score} {t('qualityScore.pointsUnit')}</strong>
                      </Space>
                      <div style={{ color: '#475569', marginTop: 4 }}>{e.explanation}</div>
                    </div>
                  ))
                )}
              </Card>
            ),
          },
          {
            key: 'threshold',
            label: <span><TrendingUp size={12} /> {t('qualityScore.tab.threshold')}</span>,
            children: (
              <Card size="small" title={t('qualityScore.thresholdTable')}>
                <Row gutter={[12, 12]}>
                  {thresholds.map((th) => (
                    <Col xs={12} sm={6} key={th.grade}>
                      <Card
                        size="small"
                        style={{
                          borderTop: `4px solid ${th.color}`,
                          background: th.bg,
                        }}
                      >
                        <div style={{ fontSize: 30, fontWeight: 800, color: th.color }}>
                          {th.grade}
                        </div>
                        <div style={{ fontSize: 12, color: th.color }}>
                          {th.minScore} - {th.maxScore} {t('qualityScore.pointsUnit')}
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                          {th.description}
                        </div>
                        <Space style={{ marginTop: 6 }}>
                          <Tag color={th.publishable ? 'green' : 'red'}>
                            {th.publishable ? t('qualityScore.publishable') : t('qualityScore.notPublishable')}
                          </Tag>
                          <Tag color={th.bonusEligible ? 'gold' : 'default'}>
                            {th.bonusEligible ? t('qualityScore.bonus') : t('qualityScore.noBonus')}
                          </Tag>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            ),
          },
        ]}
      />

      {score.evidence.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <Activity size={14} /> {t('qualityScore.trendPreview')}
            </Space>
          }
          style={{ marginTop: 12 }}
        >
          <ChartContainer type="line" height={160}>
            <LineChart
              data={Array.from({ length: 10 }, (_, i) => ({
                idx: i + 1,
                v: 80 + Math.round(Math.random() * 15),
              }))}
              margin={{ top: 8, right: 16, bottom: 24, left: 48 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="idx" tick={{ fontSize: 12 }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} />
              <RTooltip />
              <Line
                type="monotone"
                dataKey="v"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={{ r: 3 }}
                name={t('qualityScore.recent10Scores')}
              />
            </LineChart>
          </ChartContainer>
        </Card>
      )}
    </div>
  );
};

export default QualityScorePanel;
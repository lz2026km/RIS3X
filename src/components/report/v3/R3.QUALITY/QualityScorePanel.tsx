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
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { Inbox } from 'lucide-react'

const CATEGORY_META: Record<
  ScoringDimensionCategory,
  { label: string; labelEn: string; color: string; icon: React.ReactNode }
> = {
  completeness: { label: '完整性', labelEn: 'Completeness', color: '#3b82f6', icon: <FileText size={14} /> },
  accuracy: { label: '准确性', labelEn: 'Accuracy', color: '#10b981', icon: <Target size={14} /> },
  timeliness: { label: '时效性', labelEn: 'Timeliness', color: '#f59e0b', icon: <Clock size={14} /> },
};

const GRADE_META: Record<
  ScoringThresholdConfig['grade'],
  { color: string; bg: string; border: string; label: string }
> = {
  A: { color: '#047857', bg: '#d1fae5', border: '#6ee7b7', label: 'A 级 · 优秀' },
  B: { color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', label: 'B 级 · 良好' },
  C: { color: '#92400e', bg: '#fef3c7', border: '#fcd34d', label: 'C 级 · 合格' },
  D: { color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', label: 'D 级 · 不合格' },
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
      message.success(`评分完成: ${ev.totalScore} 分 (${ev.grade} 级)`);
    } finally {
      setEvaluating(false);
    }
  };

  const handleGenerateReport = async (format: QualityScoreReport['format']) => {
    if (!score) {
      message.warning('暂无评分可生成报告');
      return;
    }
    setGenerating(true);
    try {
      const report = await scoringService.generateReport(score.scoreId, format, 'D001');
      onGenerateReport?.(report);
      message.success(`${format.toUpperCase()} 评分报告已生成`);
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
          <Spin /> <div style={{ marginTop: 12, color: '#64748b' }}>加载 15 维度评分…</div>
        </div>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card data-testid="quality-score-panel" role="region" aria-label="15 维度评分">
        <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description="暂无评分,请点击重新评分" />
      </Card>
    );
  }

  const gradeMeta = GRADE_META[score.grade];

  return (
    <div data-testid="quality-score-panel" role="region" aria-label="15 维度评分">
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
            <strong style={{ fontSize: 17 }}>15 维度质量评分</strong>
            <Tag color="purple">R3.QUALITY.SCORING</Tag>
            <Tag color="cyan">{score.modelVersion}</Tag>
            {reportId && <Tag color="blue">报告: {reportId}</Tag>}
          </Space>
          <Space wrap>
            <Button
              size="small"
              icon={<RefreshCw size={12} />}
              onClick={onRescore ?? handleEvaluate}
              loading={evaluating}
            >
              重新评分
            </Button>
            <Select
              size="small"
              value="report"
              style={{ width: 110 }}
              onChange={(v: QualityScoreReport['format']) => handleGenerateReport(v)}
              loading={generating}
              options={[
                { value: 'pdf', label: 'PDF 报告' },
                { value: 'word', label: 'Word 报告' },
                { value: 'excel', label: 'Excel 报告' },
                { value: 'html', label: 'HTML 报告' },
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
              <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
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
                满分 100
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>完整性均分</span>}
              value={score.categoryScores.completeness}
              precision={1}
              styles={{ content: {  color: '#fff', fontSize: 22  } }}
              prefix={<FileText size={14} />}
              suffix="/100"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>准确性均分</span>}
              value={score.categoryScores.accuracy}
              precision={1}
              styles={{ content: {  color: '#fff', fontSize: 22  } }}
              prefix={<Target size={14} />}
              suffix="/100"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>时效性均分</span>}
              value={score.categoryScores.timeliness}
              precision={1}
              styles={{ content: {  color: '#fff', fontSize: 22  } }}
              prefix={<Clock size={14} />}
              suffix="/100"
            />
          </Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 8 }}>
          <Col xs={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>可发布</span>}
              value={score.publishable ? '是' : '否'}
              styles={{ content: { 
                color: score.publishable ? '#bbf7d0' : '#fca5a5',
                fontSize: 18,
               } }}
              prefix={score.publishable ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>奖励资格</span>}
              value={score.bonusEligible ? '是' : '否'}
              styles={{ content: { 
                color: score.bonusEligible ? '#bbf7d0' : '#fcd34d',
                fontSize: 18,
               } }}
              prefix={score.bonusEligible ? <Sparkles size={14} /> : <Zap size={14} />}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title={<span style={{ color: '#fff' }}>评估耗时</span>}
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
          title={`一票否决触发: ${score.hardFailTriggered.join(', ')}`}
          description="总分已置零或低于发布阈值,请立即整改"
        />
      )}

      <Tabs
        defaultActiveKey="radar"
        items={[
          {
            key: 'radar',
            label: <span><BarChart3 size={12} /> 维度雷达</span>,
            children: (
              <Card size="small" title="15 维度评分雷达图">
                <Row gutter={12}>
                  <Col xs={24} md={14}>
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Radar
                          name="评分"
                          dataKey="score"
                          stroke="#7c3aed"
                          fill="#7c3aed"
                          fillOpacity={0.45}
                        />
                        <RTooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Col>
                  <Col xs={24} md={10}>
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart data={categoryRadar}>
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Radar
                          name="分类均分"
                          dataKey="score"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.4}
                        />
                        <RTooltip />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'bar',
            label: <span><BarChart3 size={12} /> 维度柱状</span>,
            children: (
              <Card size="small" title="维度评分 (按类别着色)">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={130} />
                    <RTooltip />
                    <Bar dataKey="score" name="评分">
                      {barData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={CATEGORY_META[d.category as ScoringDimensionCategory].color}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <RTooltip />
                    <Bar dataKey="score" name="分类均分">
                      {categoryBarData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            ),
          },
          {
            key: 'category',
            label: <span><FileText size={12} /> 分类明细</span>,
            children: (
              <Card
                size="small"
                title={
                  <Space>
                    <span>按分类查看 15 维度</span>
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
                              <strong style={{ fontSize: 13 }}>{d.name}</strong>
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
                            权重 {(d.weight * 100).toFixed(1)}% · 得分 {s.toFixed(1)}/100
                          </div>
                          <div style={{ fontSize: 12, color: '#0891b2', marginTop: 4 }}>
                            规则: {d.passingRule}
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
            label: <span><Sparkles size={12} /> 评分证据</span>,
            children: (
              <Card size="small" title={`评分证据 (${score.evidence.length} 条)`}>
                {score.evidence.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无证据" />
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
                        <strong>{e.score} 分</strong>
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
            label: <span><TrendingUp size={12} /> 等级对照</span>,
            children: (
              <Card size="small" title="等级阈值表">
                <Row gutter={[12, 12]}>
                  {thresholds.map((t) => (
                    <Col xs={12} sm={6} key={t.grade}>
                      <Card
                        size="small"
                        style={{
                          borderTop: `4px solid ${t.color}`,
                          background: t.bg,
                        }}
                      >
                        <div style={{ fontSize: 28, fontWeight: 800, color: t.color }}>
                          {t.grade}
                        </div>
                        <div style={{ fontSize: 12, color: t.color }}>
                          {t.minScore} - {t.maxScore} 分
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                          {t.description}
                        </div>
                        <Space style={{ marginTop: 6 }}>
                          <Tag color={t.publishable ? 'green' : 'red'}>
                            {t.publishable ? '可发布' : '不可发布'}
                          </Tag>
                          <Tag color={t.bonusEligible ? 'gold' : 'default'}>
                            {t.bonusEligible ? '奖励' : '无奖励'}
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
              <Activity size={14} /> 趋势预览
            </Space>
          }
          style={{ marginTop: 12 }}
        >
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={Array.from({ length: 10 }, (_, i) => ({
                idx: i + 1,
                v: 80 + Math.round(Math.random() * 15),
              }))}
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
                name="近 10 次评分"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default QualityScorePanel;
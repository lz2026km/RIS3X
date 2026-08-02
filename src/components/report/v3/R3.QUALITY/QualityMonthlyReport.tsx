/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.152-156 质控月报
 * 月度质控报告:等级分布/趋势/缺陷分析/排名/15章节/导出
 */
import React, { useEffect, useState } from 'react';
import { Card, Tag, Space, Row, Col, Statistic, Button, Select, message, List, Tabs, Progress } from 'antd';
import { FileText, Download, TrendingUp, Award, Sparkles, Calendar, Users, BarChart3 } from 'lucide-react';
import { qualityService } from '../../../../services/quality/qualityService';
import type { MonthlyQualityReport, QualityGrade, QualityKPI } from '../../../../types/R3/R3.QUALITY';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
} from 'recharts';

const GRADE_COLOR: Record<QualityGrade, string> = {
  '甲': '#10b981',
  '乙': '#3b82f6',
  '丙': '#f59e0b',
  '丁': '#dc2626',
};

export const QualityMonthlyReport: React.FC<{ year?: number; month?: number }> = ({ year, month }) => {
  const [report, setReport] = useState<MonthlyQualityReport | null>(null);
  const [kpi, setKpi] = useState<QualityKPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [selYear, setSelYear] = useState<number>(year ?? 2026);
  const [selMonth, setSelMonth] = useState<number>(month ?? 6);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [data, kpiData] = await Promise.all([
        qualityService.getMonthlyReport(selYear, selMonth),
        qualityService.getKPI(),
      ]);
      setReport(data);
      setKpi(kpiData);
    } catch (e) {
      message.error('加载月报失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selYear, selMonth]);

  const exportReport = async (format: 'pdf' | 'word' | 'excel') => {
    setExporting(true);
    try {
      const result = await qualityService.exportMonthlyReport(selYear, selMonth, format);
      const blob = new Blob([result.data], { type: result.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${format.toUpperCase()}`);
    } catch (e) {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !report) {
    return (
      <div
        data-testid="quality-monthly-report"
        role="status"
        aria-label="加载质量月报"
        style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}
      >
        加载中...
      </div>
    );
  }

  const gradeData = (Object.keys(report.gradeDistribution) as QualityGrade[]).map((g) => ({
    grade: g,
    count: report.gradeDistribution[g],
    color: GRADE_COLOR[g],
  }));

  const trendData = report.trends.map((t) => ({
    date: t.date.slice(5),
    avgScore: t.avgScore,
    evaluated: t.evaluated,
    defects: t.defects,
  }));

  return (
    <div data-testid="quality-monthly-report" role="region" aria-label="质量月报">
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
          color: '#fff',
          padding: '14px 18px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <FileText size={18} />
            <strong style={{ fontSize: 16 }}>
              质控月报 · {report.year} 年 {report.month} 月
            </strong>
            <Tag color="purple">R3.QUALITY.152</Tag>
            <Tag color="cyan">v3.0.5.1</Tag>
          </Space>
          <Space wrap>
            <Calendar size={12} />
            <Select
              size="small"
              value={selYear}
              onChange={setSelYear}
              style={{ width: 100 }}
              options={Array.from({ length: 5 }, (_, i) => ({ value: 2022 + i, label: `${2022 + i} 年` }))}
            />
            <Select
              size="small"
              value={selMonth}
              onChange={setSelMonth}
              style={{ width: 80 }}
              options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1} 月` }))}
            />
            <Button
              size="small"
              icon={<Download size={12} />}
              loading={exporting}
              onClick={() => void exportReport('pdf')}
            >
              PDF
            </Button>
            <Button
              size="small"
              icon={<Download size={12} />}
              loading={exporting}
              onClick={() => void exportReport('word')}
            >
              Word
            </Button>
            <Button
              size="small"
              icon={<Download size={12} />}
              loading={exporting}
              onClick={() => void exportReport('excel')}
            >
              Excel
            </Button>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 14 }}>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>评估总数</span>}
              value={report.totalReports}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<FileText size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>平均分</span>}
              value={report.avgScore.toFixed(1)}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Award size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>环比</span>}
              value={report.monthOverMonth}
              suffix="%"
              styles={{ content: { 
                color: report.monthOverMonth > 0 ? '#bbf7d0' : '#fca5a5',
                fontSize: 18,
               } }}
              prefix={<TrendingUp size={14} />}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>修复率</span>}
              value={report.fixRate}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title={<span style={{ color: '#fff' }}>自动评估率</span>}
              value={report.autoRate}
              suffix="%"
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Sparkles size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Tabs
        items={[
          {
            key: 'overview',
            label: '总览',
            children: (
              <Row gutter={12}>
                <Col span={6}>
                  <Card size="small" title={<Space><BarChart3 size={14} />本月核心指标</Space>}>
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>甲级率</div>
                        <Progress
                          percent={Math.round(
                            ((report.gradeDistribution['甲'] ?? 0) / Math.max(1, report.totalReports)) * 100,
                          )}
                          strokeColor="#10b981"
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>乙级率</div>
                        <Progress
                          percent={Math.round(
                            ((report.gradeDistribution['乙'] ?? 0) / Math.max(1, report.totalReports)) * 100,
                          )}
                          strokeColor="#3b82f6"
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>丙级率</div>
                        <Progress
                          percent={Math.round(
                            ((report.gradeDistribution['丙'] ?? 0) / Math.max(1, report.totalReports)) * 100,
                          )}
                          strokeColor="#f59e0b"
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>丁级率</div>
                        <Progress
                          percent={Math.round(
                            ((report.gradeDistribution['丁'] ?? 0) / Math.max(1, report.totalReports)) * 100,
                          )}
                          strokeColor="#dc2626"
                        />
                      </div>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="质量趋势">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <RTooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line yAxisId="left" type="monotone" dataKey="avgScore" stroke="#3b82f6" strokeWidth={2} name="平均分" />
                        <Line yAxisId="right" type="monotone" dataKey="evaluated" stroke="#10b981" strokeWidth={2} name="评估数" />
                        <Line yAxisId="right" type="monotone" dataKey="defects" stroke="#dc2626" strokeWidth={2} name="缺陷数" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" title={<Space><Users size={14} />KPI 摘要</Space>}>
                    {kpi && (
                      <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                        <div>
                          <span style={{ color: '#64748b', fontSize: 12 }}>AI 采纳率: </span>
                          <strong style={{ color: '#7c3aed' }}>{(kpi.aiAcceptanceRate * 100).toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontSize: 12 }}>P50 评分: </span>
                          <strong>{kpi.p50Score}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontSize: 12 }}>P95 评分: </span>
                          <strong>{kpi.p95Score}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontSize: 12 }}>危急值漏报: </span>
                          <strong style={{ color: kpi.criticalMissedCount > 0 ? '#dc2626' : '#10b981' }}>
                            {kpi.criticalMissedCount}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontSize: 12 }}>需复训: </span>
                          <strong>{kpi.retrainingNeeded}</strong>
                        </div>
                      </Space>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'grade',
            label: '等级分布',
            children: (
              <Row gutter={12}>
                <Col span={12}>
                  <Card size="small" title="等级分布">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={gradeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <RTooltip />
                        <Bar dataKey="count" name="数量">
                          {gradeData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="等级占比">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={gradeData} dataKey="count" nameKey="grade" cx="50%" cy="50%" outerRadius={90} label>
                          {gradeData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'defect',
            label: '缺陷分析',
            children: (
              <Card size="small" title="Top 缺陷">
                <List
                  dataSource={report.defectStatistics}
                  renderItem={(d) => (
                    <List.Item key={d.code}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <Tag color="blue">{d.code}</Tag>
                          <strong>{d.name}</strong>
                          <Tag>{d.count} 次</Tag>
                        </Space>
                        <Tag color={d.changeRate > 0 ? 'red' : 'green'}>
                          {d.changeRate > 0 ? '↑' : '↓'} {Math.abs(d.changeRate).toFixed(1)}%
                        </Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
          {
            key: 'ranking',
            label: '排名',
            children: (
              <Row gutter={12}>
                <Col span={12}>
                  <Card size="small" title="医生排名">
                    <List
                      dataSource={report.doctorRanking}
                      renderItem={(d) => (
                        <List.Item key={d.doctorId}>
                          <Space>
                            <Tag color={d.rank === 1 ? 'gold' : d.rank <= 3 ? 'blue' : 'default'}>#{d.rank}</Tag>
                            <strong>{d.doctorName}</strong>
                            <span>
                              均分 <strong style={{ color: '#3b82f6' }}>{d.avgScore}</strong>
                            </span>
                            <Tag>{d.total} 例</Tag>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="科室排名">
                    <List
                      dataSource={report.departmentRanking}
                      renderItem={(d) => (
                        <List.Item key={d.department}>
                          <Space>
                            <Tag color={d.rank === 1 ? 'gold' : d.rank <= 3 ? 'blue' : 'default'}>#{d.rank}</Tag>
                            <strong>{d.department}</strong>
                            <span>
                              均分 <strong style={{ color: '#3b82f6' }}>{d.avgScore}</strong>
                            </span>
                            <Tag>{d.total} 例</Tag>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'sections',
            label: '报告章节',
            children: (
              <Card size="small">
                {report.sections.map((s) => (
                  <div key={s.key} style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', margin: 0 }}>
                      {s.title} · {s.titleEn}
                    </h3>
                    <p style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.6 }}>{s.content}</p>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                  生成于 {new Date(report.generatedAt).toLocaleString()} by {report.generatedBy}
                </div>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default QualityMonthlyReport;
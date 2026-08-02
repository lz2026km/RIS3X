/**
 * G005 放射RIS系统 v3.0.6.5 - RECIST 1.1 反应评估图表
 * A5-AI-ORCH / 30 点
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Card, Select, Tag, Space, Statistic, Row, Col, Empty, Button, message } from 'antd';
import { LineChart, TrendingDown, TrendingUp, Minus, Activity, GitCompare, RefreshCw } from 'lucide-react';
import { LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer, ReferenceLine, Scatter, ComposedChart } from 'recharts';
import { responseTracker } from '../../services/ai/oncology/ResponseTracker';
import type { AIRecistLesion, AIRecistComparison } from '../../types/ai/orchestrator';

const RESPONSE_COLORS: Record<string, string> = {
  CR: '#10b981',
  PR: '#3b82f6',
  SD: '#f59e0b',
  PD: '#ef4444',
  NE: '#94a3b8',
};

const RESPONSE_LABELS: Record<string, string> = {
  CR: '完全缓解',
  PR: '部分缓解',
  SD: '稳定',
  PD: '进展',
  NE: '无法评估',
};

export interface ResponseAssessmentChartProps {
  patientId: string;
}

export const ResponseAssessmentChart: React.FC<ResponseAssessmentChartProps> = ({ patientId }) => {
  const [lesions, setLesions] = useState<AIRecistLesion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<AIRecistComparison | null>(null);
  const [studyA, setStudyA] = useState<string | null>(null);
  const [studyB, setStudyB] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [patientId]);

  const load = async () => {
    const arr = await responseTracker.listLesions(patientId);
    setLesions(arr);
    setSelected(arr.slice(0, 2).map((l) => l.lesionId));
    if (arr.length > 0 && arr[0]!.followUps.length >= 2) {
      const a = arr[0]!.followUps[0]!.studyId;
      const b = arr[0]!.followUps[arr[0]!.followUps.length - 1]!.studyId;
      setStudyA(a);
      setStudyB(b);
      const c = await responseTracker.compareStudies(a, b);
      setComparison(c);
    }
  };

  const allStudies = useMemo(() => {
    const s = new Set<string>();
    lesions.forEach((l) => l.followUps.forEach((m) => s.add(m.studyId)));
    return Array.from(s);
  }, [lesions]);

  const chartData = useMemo(() => {
    if (lesions.length === 0 || selected.length === 0) return [];
    const dates = new Set<string>();
    lesions.forEach((l) => {
      if (selected.includes(l.lesionId)) l.followUps.forEach((m) => dates.add(m.date));
    });
    return Array.from(dates)
      .sort()
      .map((d) => {
        const point: Record<string, string | number> = { date: d.slice(0, 10) };
        lesions.forEach((l) => {
          if (selected.includes(l.lesionId)) {
            const m = l.followUps.find((x) => x.date === d);
            if (m) point[l.lesionId] = m.diameterMm;
          }
        });
        let total = 0;
        lesions.forEach((l) => {
          if (selected.includes(l.lesionId)) {
            const m = l.followUps.find((x) => x.date === d);
            if (m) total += m.diameterMm;
          }
        });
        point.sum = Math.round(total * 10) / 10;
        return point;
      });
  }, [lesions, selected]);

  const summary = useMemo(() => {
    if (lesions.length === 0 || selected.length === 0) return null;
    const baseline = selected.reduce((s, id) => {
      const l = lesions.find((x) => x.lesionId === id);
      return s + (l?.baseline.diameterMm ?? 0);
    }, 0);
    const current = selected.reduce((s, id) => {
      const l = lesions.find((x) => x.lesionId === id);
      return s + (l?.currentDiameter ?? 0);
    }, 0);
    const percent = baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
    let resp = 'SD';
    if (current === 0) resp = 'CR';
    else if (percent <= -30) resp = 'PR';
    else if (percent >= 20) resp = 'PD';
    return { baseline, current, percent, response: resp };
  }, [lesions, selected]);

  const handleCompare = async () => {
    if (!studyA || !studyB) {
      message.warning('请选择对比的两个 study');
      return;
    }
    const c = await responseTracker.compareStudies(studyA, studyB);
    setComparison(c);
  };

  return (
    <div data-testid="response-assessment-chart" style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <LineChart size={24} color="#10b981" />
        <h2 style={{ margin: 0 }}>RECIST 1.1 治疗反应评估</h2>
        <Tag>患者 {patientId}</Tag>
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>基线直径和</span>}
              value={summary?.baseline ?? 0}
              precision={1}
              suffix="mm"
              styles={{ content: {  color: '#f1f5f9'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>当前直径和</span>}
              value={summary?.current ?? 0}
              precision={1}
              suffix="mm"
              styles={{ content: {  color: '#f1f5f9'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>变化率</span>}
              value={summary?.percent ?? 0}
              precision={1}
              suffix="%"
              prefix={
                (summary?.percent ?? 0) < 0 ? <TrendingDown size={14} color="#10b981" /> :
                (summary?.percent ?? 0) > 0 ? <TrendingUp size={14} color="#ef4444" /> :
                <Minus size={14} color="#94a3b8" />
              }
              styles={{ content: {  color: (summary?.percent ?? 0) < 0 ? '#10b981' : (summary?.percent ?? 0) > 0 ? '#ef4444' : '#f1f5f9'  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic
              title={<span style={{ color: '#94a3b8' }}>总体反应</span>}
              value={summary ? RESPONSE_LABELS[summary.response]! : '-'}
              styles={{ content: {  color: summary ? RESPONSE_COLORS[summary.response] : '#94a3b8', fontSize: 20  } }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="病灶选择" style={{ marginBottom: 12, background: '#1e293b', borderColor: '#334155' }}>
        <Select
          mode="multiple"
          value={selected}
          onChange={setSelected}
          style={{ width: '100%' }}
          options={lesions.map((l) => ({
            value: l.lesionId,
            label: `${l.name} (${l.location}) - ${l.responseCategory}`,
          }))}
          placeholder="选择要跟踪的病灶"
        />
      </Card>

      <Card size="small" title="直径变化趋势" style={{ marginBottom: 12, background: '#1e293b', borderColor: '#334155' }}>
        {chartData.length === 0 ? (
          <Empty description="选择至少一个病灶" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" label={{ value: 'mm', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
              <RTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
              {selected.map((id, i) => {
                const lesion = lesions.find((l) => l.lesionId === id);
                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
                return (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={lesion?.name ?? id}
                    stroke={colors[i % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                );
              })}
              <Line type="monotone" dataKey="sum" name="总和" stroke="#fbbf24" strokeWidth={3} strokeDasharray="5 5" />
              <ReferenceLine y={0} stroke="#64748b" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <GitCompare size={14} />
            <span>Study 对比</span>
            {comparison && <Tag color={RESPONSE_COLORS[comparison.overallResponse]}>{RESPONSE_LABELS[comparison.overallResponse]}</Tag>}
          </Space>
        }
        extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={handleCompare}>重新对比</Button>}
        style={{ background: '#1e293b', borderColor: '#334155' }}
      >
        <Space wrap>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>A:</span>
          <Select value={studyA} onChange={setStudyA} style={{ width: 200 }} options={allStudies.map((s) => ({ value: s, label: s }))} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>B:</span>
          <Select value={studyB} onChange={setStudyB} style={{ width: 200 }} options={allStudies.map((s) => ({ value: s, label: s }))} />
        </Space>
        {comparison && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <Statistic title="新发病灶" value={comparison.newLesions} styles={{ content: {  color: '#ef4444'  } }} />
            <Statistic title="消失" value={comparison.disappearedLesions} styles={{ content: {  color: '#10b981'  } }} />
            <Statistic title="进展" value={comparison.progressed} styles={{ content: {  color: '#ef4444'  } }} />
            <Statistic title="缓解" value={comparison.responded} styles={{ content: {  color: '#10b981'  } }} />
            <Statistic title="稳定" value={comparison.stable} styles={{ content: {  color: '#f59e0b'  } }} />
          </div>
        )}
      </Card>
    </div>
  );
};

export default ResponseAssessmentChart;

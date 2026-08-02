/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AI AI 预审意见 (mock)
 * A5-REPORT / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Space, Typography, Tag, Progress, Alert, Row, Col, List, Statistic, Button, Empty, Spin, Radio, Divider } from 'antd';
import { ScanSearch, AlertCircle, CheckCircle2, Lightbulb, BarChart3, Hash } from 'lucide-react';
import { aiService } from '../../../../services/ai/aiService';
import type { AIPreReview } from '../../../../types/R3/R3.AI';

const { Title, Text, Paragraph } = Typography;

export interface AIPreReadProps {
  reportId: string;
  onApplySuggestion?: (suggestion: AIPreReview['suggestions'][number]) => void;
  autoLoad?: boolean;
}

const SEVERITY_META: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
};

const TYPE_LABEL: Record<string, string> = {
  'missing-key-finding': '缺关键所见',
  'terminology-error': '术语错误',
  inconsistency: '不一致',
  grammar: '语法问题',
  specification: '规范问题',
};

export const AIPreRead: React.FC<AIPreReadProps> = ({ reportId, onApplySuggestion, autoLoad = true }) => {
  const [review, setReview] = useState<AIPreReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'defects' | 'suggestions' | 'diff' | 'consistency' | 'terminology'>('defects');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiService.preReview(reportId);
      setReview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) void load();
  }, [reportId, autoLoad]);

  if (loading) {
    return (
      <Card>
        <Space orientation="vertical" align="center" style={{ width: '100%', padding: 24 }}>
          <Spin indicator={<ScanSearch size={32} className="spin" />} />
          <Text>AI 正在预审...</Text>
        </Space>
      </Card>
    );
  }

  if (error) {
    return <Alert type="error" showIcon title={error} />;
  }

  if (!review) {
    return (
      <Card>
        <Empty description="暂无 AI 预审结果">
          <Button type="primary" onClick={() => void load()}>立即预审</Button>
        </Empty>
      </Card>
    );
  }

  const grade = review.score >= 90 ? 'A' : review.score >= 80 ? 'B' : review.score >= 70 ? 'C' : 'D';
  const gradeColor = grade === 'A' ? 'green' : grade === 'B' ? 'blue' : grade === 'C' ? 'orange' : 'red';

  return (
    <Card
      title={
        <Space>
          <ScanSearch size={18} color="#7c3aed" />
          <span>AI 预审意见</span>
          <Tag color={gradeColor}>评分 {review.score} ({grade})</Tag>
          <Tag color="purple">v2.3 mock</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => void load()}>刷新</Button>
        </Space>
      }
      style={{ width: '100%' }}
    >
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic title="综合评分" value={review.score} suffix="/ 100" />
        </Col>
        <Col span={6}>
          <Statistic
            title="缺陷数"
            value={review.defects.length}
            prefix={<AlertCircle size={14} color="#f59e0b" />}
            styles={{ content: {  color: '#f59e0b'  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="建议数"
            value={review.suggestions.length}
            prefix={<Lightbulb size={14} color="#2563eb" />}
            styles={{ content: {  color: '#2563eb'  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="一致性"
            value={review.consistency.score}
            suffix="/ 100"
            prefix={<BarChart3 size={14} />}
          />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Text type="secondary">整体置信度</Text>
          <Progress
            percent={review.confidence.overall * 100}
            format={(p) => `${(p ?? 0).toFixed(0)}%`}
            strokeColor={
              review.confidence.overall >= 0.85
                ? '#10b981'
                : review.confidence.overall >= 0.6
                  ? '#2563eb'
                  : '#f59e0b'
            }
          />
        </Col>
        <Col span={12}>
          <Text type="secondary">术语规范率</Text>
          <Progress
            percent={(review.terminology.matchedTerms / Math.max(1, review.terminology.totalTerms)) * 100}
            format={() => `${review.terminology.matchedTerms}/${review.terminology.totalTerms}`}
            strokeColor="#7c3aed"
          />
        </Col>
      </Row>

      <Divider />

      <Radio.Group
        value={tab}
        onChange={(e) => setTab(e.target.value as typeof tab)}
        style={{ marginBottom: 12 }}
      >
        <Radio.Button value="defects">缺陷 ({review.defects.length})</Radio.Button>
        <Radio.Button value="suggestions">建议 ({review.suggestions.length})</Radio.Button>
        <Radio.Button value="diff">差异</Radio.Button>
        <Radio.Button value="consistency">一致性</Radio.Button>
        <Radio.Button value="terminology">术语</Radio.Button>
      </Radio.Group>

      {tab === 'defects' && (
        <List
          size="small"
          dataSource={review.defects}
          renderItem={(d) => {
            const sev = SEVERITY_META[d.severity];
            return (
              <List.Item>
                <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                  <Space>
                    <Tag color={sev.color}>{sev.label}</Tag>
                    <Tag>{TYPE_LABEL[d.type] ?? d.type}</Tag>
                    <Text strong>{d.field}</Text>
                  </Space>
                  <Text style={{ fontSize: 12 }}>{d.description}</Text>
                  {d.fixSuggestion && (
                    <Alert
                      type="success"
                      showIcon
                      style={{ marginTop: 4 }}
                      title={
                        <Space>
                          <Lightbulb size={12} />
                          <span>建议: {d.fixSuggestion}</span>
                        </Space>
                      }
                    />
                  )}
                </Space>
              </List.Item>
            );
          }}
          locale={{ emptyText: '未发现缺陷' }}
        />
      )}

      {tab === 'suggestions' && (
        <List
          size="small"
          dataSource={review.suggestions}
          renderItem={(s) => (
            <List.Item
              actions={[
                <Button key="apply" size="small" type="primary" onClick={() => onApplySuggestion?.(s)}>
                  应用
                </Button>,
              ]}
            >
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Tag color="blue">{s.category}</Tag>
                  <Text strong>{s.field}</Text>
                </Space>
                <div style={{ background: '#fef2f2', padding: 6, borderRadius: 4 }}>
                  <Text style={{ fontSize: 12, textDecoration: 'line-through' }}>{s.before}</Text>
                </div>
                <div style={{ background: '#ecfdf5', padding: 6, borderRadius: 4 }}>
                  <Text style={{ fontSize: 12 }}>{s.after}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{s.rationale}</Text>
              </Space>
            </List.Item>
          )}
          locale={{ emptyText: '无修改建议' }}
        />
      )}

      {tab === 'diff' && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          {review.diff.map((d) => (
            <Card key={d.field} size="small" title={`字段: ${d.field}`}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>一致率: {d.agreementPercent}%</Text>
                <div>
                  <Tag color="purple">AI</Tag>
                  <Paragraph style={{ fontSize: 12, marginBottom: 4, padding: 6, background: '#faf5ff', borderRadius: 4 }}>
                    {d.aiValue}
                  </Paragraph>
                </div>
                <div>
                  <Tag color="blue">医生</Tag>
                  <Paragraph style={{ fontSize: 12, marginBottom: 0, padding: 6, background: '#eff6ff', borderRadius: 4 }}>
                    {d.doctorValue}
                  </Paragraph>
                </div>
              </Space>
            </Card>
          ))}
        </Space>
      )}

      {tab === 'consistency' && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Space>
            <Tag color={review.consistency.imageReportMatch ? 'green' : 'red'}>
              影像-报告: {review.consistency.imageReportMatch ? '一致' : '不一致'}
            </Tag>
            <Tag color={review.consistency.clinicalReportMatch ? 'green' : 'red'}>
              临床-报告: {review.consistency.clinicalReportMatch ? '一致' : '不一致'}
            </Tag>
            <Tag color={review.consistency.priorReportMatch ? 'green' : 'red'}>
              既往-报告: {review.consistency.priorReportMatch ? '一致' : '不一致'}
            </Tag>
          </Space>
          {review.consistency.mismatchedFields.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={`不一致字段: ${review.consistency.mismatchedFields.join(', ')}`}
            />
          )}
        </Space>
      )}

      {tab === 'terminology' && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Space>
            <Hash size={14} />
            <Text>RadLex 术语: {review.terminology.radlexHits.length} 个</Text>
            <Text>SNOMED 术语: {review.terminology.snomedHits.length} 个</Text>
          </Space>
          <List
            size="small"
            dataSource={review.terminology.radlexHits}
            renderItem={(item) => (
              <List.Item>
                <Space>
                  <Text>{item.term}</Text>
                  <Tag color="purple">{item.radlexCode}</Tag>
                  {item.replaced && <Tag color="green">已替换</Tag>}
                </Space>
              </List.Item>
            )}
          />
        </Space>
      )}
    </Card>
  );
};

export default AIPreRead;
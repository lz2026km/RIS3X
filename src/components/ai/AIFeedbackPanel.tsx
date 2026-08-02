/**
 * G005 放射RIS系统 v3.0.6.5 - AI 反馈面板
 * A5-AI-ORCH / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Rate, Button, Radio, Input, Space, Tag, message, Progress, Empty, Statistic, Row, Col, Tabs, List, Badge } from 'antd';
import { ThumbsUp, ThumbsDown, Edit3, MessageSquare, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { feedbackCollector } from '../../services/ai/feedback/FeedbackCollector';
import type { AIFeedbackEntry, AIFeedbackAggregate } from '../../types/ai/orchestrator';

const VERDICT_LABELS = {
  accept: { label: '接受', color: 'green', icon: <ThumbsUp size={12} /> },
  reject: { label: '拒绝', color: 'red', icon: <XCircle size={12} /> },
  modify: { label: '修改', color: 'blue', icon: <Edit3 size={12} /> },
} as const;

export interface AIFeedbackPanelProps {
  algorithmId: string;
  algorithmName: string;
  studyId?: string;
  reportId?: string;
  originalOutput?: string;
  onSubmitted?: (e: AIFeedbackEntry) => void;
}

export const AIFeedbackPanel: React.FC<AIFeedbackPanelProps> = ({
  algorithmId,
  algorithmName,
  studyId,
  reportId,
  originalOutput,
  onSubmitted,
}) => {
  const [verdict, setVerdict] = useState<'accept' | 'reject' | 'modify'>('accept');
  const [rating, setRating] = useState(4);
  const [correction, setCorrection] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [aggregate, setAggregate] = useState<AIFeedbackAggregate | null>(null);
  const [recent, setRecent] = useState<AIFeedbackEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, [algorithmId]);

  const load = async () => {
    const [agg, list] = await Promise.all([feedbackCollector.aggregate(algorithmId), feedbackCollector.list(algorithmId)]);
    setAggregate(agg);
    setRecent(list.slice(-10).reverse());
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const e = await feedbackCollector.record({
        algorithmId,
        algorithmName,
        studyId,
        reportId,
        userId: 'current',
        userName: '当前用户',
        verdict,
        correction: verdict === 'modify' ? correction : undefined,
        originalOutput,
        rating,
        tags,
      });
      message.success('反馈已提交');
      onSubmitted?.(e);
      setCorrection('');
      setTags([]);
      void load();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  return (
    <div data-testid="ai-feedback-panel" style={{ padding: 12, background: '#1e293b', borderRadius: 6, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <MessageSquare size={16} color="#3b82f6" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{algorithmName} 反馈</span>
      </div>

      <Tabs
        size="small"
        defaultActiveKey="submit"
        tabBarExtraContent={
          <Badge
            count={2}
            title="反馈 2 项"
            style={{ backgroundColor: '#3b82f6' }}
          />
        }
        items={[
          {
            key: 'submit',
            label: '提交反馈',
            children: (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>判定</div>
                  <Radio.Group value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                    {Object.entries(VERDICT_LABELS).map(([k, v]) => (
                      <Radio.Button key={k} value={k}>
                        <Space size={4}>{v.icon} {v.label}</Space>
                      </Radio.Button>
                    ))}
                  </Radio.Group>
                </div>

                {verdict === 'modify' && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>修改建议</div>
                    <Input.TextArea value={correction} onChange={(e) => setCorrection(e.target.value)} rows={3} placeholder="请描述修改建议..." />
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>评分</div>
                  <Rate value={rating} onChange={setRating} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>标签</div>
                  <Space wrap>
                    {tags.map((t) => (
                      <Tag key={t} closable onClose={() => setTags(tags.filter((x) => x !== t))}>{t}</Tag>
                    ))}
                    <Input size="small" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onPressEnter={addTag} placeholder="输入后回车" style={{ width: 120 }} />
                  </Space>
                </div>

                <Button type="primary" onClick={handleSubmit} loading={submitting} icon={<CheckCircle2 size={14} />} block>
                  提交反馈
                </Button>
              </div>
            ),
          },
          {
            key: 'stats',
            label: '统计',
            children: aggregate && aggregate.total > 0 ? (
              <div>
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={8}><Statistic title="总数" value={aggregate.total} styles={{ content: {  fontSize: 16, color: '#f1f5f9'  } }} /></Col>
                  <Col span={8}><Statistic title="接受率" value={(aggregate.acceptRate * 100).toFixed(0)} suffix="%" styles={{ content: {  fontSize: 16, color: '#10b981'  } }} /></Col>
                  <Col span={8}><Statistic title="评分" value={aggregate.avgRating.toFixed(1)} suffix="/5" styles={{ content: {  fontSize: 16, color: '#fbbf24'  } }} /></Col>
                </Row>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>接受 {(aggregate.acceptRate * 100).toFixed(0)}%</div>
                  <Progress percent={aggregate.acceptRate * 100} strokeColor="#10b981" showInfo={false} size="small" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>拒绝 {(aggregate.rejectRate * 100).toFixed(0)}%</div>
                  <Progress percent={aggregate.rejectRate * 100} strokeColor="#ef4444" showInfo={false} size="small" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>修改 {(aggregate.modifyRate * 100).toFixed(0)}%</div>
                  <Progress percent={aggregate.modifyRate * 100} strokeColor="#3b82f6" showInfo={false} size="small" />
                </div>
                {aggregate.commonCorrections.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>常见修改</div>
                    <Space wrap>
                      {aggregate.commonCorrections.map((c) => (
                        <Tag key={c.tag} color="blue">{c.tag} ({c.count})</Tag>
                      ))}
                    </Space>
                  </div>
                )}
              </div>
            ) : (
              <Empty description="暂无统计" />
            ),
          },
          {
            key: 'recent',
            label: '最近反馈',
            children: recent.length === 0 ? (
              <Empty description="暂无反馈" />
            ) : (
              <List
                size="small"
                dataSource={recent}
                renderItem={(e) => {
                  const v = VERDICT_LABELS[e.verdict];
                  return (
                    <List.Item style={{ padding: '6px 0' }}>
                      <div style={{ width: '100%' }}>
                        <Space>
                          <Tag color={v.color} icon={v.icon}>{v.label}</Tag>
                          <Rate disabled value={e.rating} style={{ fontSize: 12 }} />
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{e.userName}</span>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(e.createdAt).toLocaleString()}</span>
                        </Space>
                        {e.correction && <div style={{ fontSize: 12, marginTop: 4, color: '#cbd5e1' }}>{e.correction}</div>}
                      </div>
                    </List.Item>
                  );
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default AIFeedbackPanel;

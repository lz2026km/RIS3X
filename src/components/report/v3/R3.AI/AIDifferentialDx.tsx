/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AI AI 鉴别诊断 (mock)
 * A5-REPORT / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Space, Typography, Tag, Progress, Alert, Row, Col, List, Statistic, Button, Empty, Spin, Divider, Avatar } from 'antd';
import { Diff, FlaskConical, FileText, CheckCircle2, AlertCircle, Hash } from 'lucide-react';
import { aiService } from '../../../../services/ai/aiService';
import type { AIDifferentialDx, AIDifferentialEntry } from '../../../../types/R3/R3.AI';

const { Title, Text, Paragraph } = Typography;

export interface AIDifferentialDxProps {
  reportId: string;
  autoLoad?: boolean;
}

export const AIDifferentialDxView: React.FC<AIDifferentialDxProps> = ({ reportId, autoLoad = true }) => {
  const [ddx, setDdx] = useState<AIDifferentialDx | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoLoad) return;
    setLoading(true);
    setError(null);
    aiService
      .differentialDx(reportId)
      .then(setDdx)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [reportId, autoLoad]);

  if (loading) {
    return (
      <Card>
        <Space orientation="vertical" align="center" style={{ width: '100%', padding: 24 }}>
          <Spin indicator={<Diff size={32} className="spin" />} />
          <Text>AI 正在分析鉴别诊断...</Text>
        </Space>
      </Card>
    );
  }

  if (error) {
    return <Alert type="error" showIcon title={error} />;
  }

  if (!ddx) {
    return (
      <Card>
        <Empty description="暂无鉴别诊断">
          <Button type="primary" onClick={() => void aiService.differentialDx(reportId).then(setDdx)}>
            立即分析
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <Diff size={18} color="#7c3aed" />
          <span>AI 鉴别诊断</span>
          <Tag color="purple">v2.3 mock</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => void aiService.differentialDx(reportId).then(setDdx)}>刷新</Button>
        </Space>
      }
      style={{ width: '100%' }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={
          <Space>
            <Text strong>主要诊断</Text>
            <Tag color="blue">{ddx.primaryDiagnosis}</Tag>
          </Space>
        }
      />

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic
            title="鉴别诊断数"
            value={ddx.differentials.length}
            prefix={<FlaskConical size={14} />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="相似病例"
            value={ddx.similarCases.length}
            prefix={<FileText size={14} />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="置信度"
            value={ddx.confidence.overall * 100}
            suffix="%"
            precision={0}
            styles={{ content: {  color: ddx.confidence.overall >= 0.85 ? '#10b981' : '#2563eb'  } }}
          />
        </Col>
      </Row>

      <Divider orientation="left" plain>
        <Text strong>鉴别诊断列表</Text>
      </Divider>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {ddx.differentials.map((d, idx) => (
          <DifferentialCard key={d.id} d={d} rank={idx + 1} />
        ))}
      </Space>

      <Divider orientation="left" plain>
        <Text strong>建议检查</Text>
      </Divider>
      <List
        size="small"
        dataSource={ddx.recommendedTests}
        renderItem={(test) => (
          <List.Item>
            <Space>
              <CheckCircle2 size={12} color="#10b981" />
              <Text style={{ fontSize: 12 }}>{test}</Text>
            </Space>
          </List.Item>
        )}
      />

      <Divider orientation="left" plain>
        <Text strong>相似病例</Text>
      </Divider>
      <List
        size="small"
        dataSource={ddx.similarCases}
        renderItem={(c) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar style={{ background: '#7c3aed' }}>{c.similarity >= 0.85 ? 'A' : 'B'}</Avatar>}
              title={
                <Space>
                  <Text strong>{c.diagnosis}</Text>
                  <Tag color="purple">{(c.similarity * 100).toFixed(0)}% 相似</Tag>
                </Space>
              }
              description={
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>{c.patientAge}岁 {c.patientGender}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{c.reportId}</Text>
                  {c.outcome && <Tag color="blue">{c.outcome}</Tag>}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

const DifferentialCard: React.FC<{ d: AIDifferentialEntry; rank: number }> = ({ d, rank }) => {
  const probPercent = Math.round(d.probability * 100);
  const probColor = probPercent >= 50 ? 'red' : probPercent >= 25 ? 'orange' : 'blue';
  return (
    <Card size="small" style={{ borderColor: probColor === 'red' ? '#dc2626' : '#e5e7eb' }}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space>
          <Tag color={probColor}>#{rank}</Tag>
          <Text strong>{d.diagnosis}</Text>
          {d.icd10Code && <Tag color="cyan" icon={<Hash size={10} />}>{d.icd10Code}</Tag>}
          <Tag color={probColor}>{probPercent}%</Tag>
        </Space>
        <Progress
          percent={probPercent}
          showInfo={false}
          strokeColor={probColor === 'red' ? '#dc2626' : probColor === 'orange' ? '#f59e0b' : '#2563eb'}
        />
        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 12 }}>支持证据</Text>
            <List
              size="small"
              dataSource={d.supportingFindings}
              renderItem={(f) => (
                <List.Item style={{ padding: '2px 0' }}>
                  <Space>
                    <CheckCircle2 size={10} color="#10b981" />
                    <Text style={{ fontSize: 12 }}>{f}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 12 }}>不支持证据</Text>
            <List
              size="small"
              dataSource={d.contradictingFindings}
              renderItem={(f) => (
                <List.Item style={{ padding: '2px 0' }}>
                  <Space>
                    <AlertCircle size={10} color="#ef4444" />
                    <Text style={{ fontSize: 12 }}>{f}</Text>
                  </Space>
                </List.Item>
              )}
              locale={{ emptyText: <Text type="secondary" style={{ fontSize: 12 }}>无</Text> }}
            />
          </Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>推理: {d.reasoning}</Text>
      </Space>
    </Card>
  );
};

export default AIDifferentialDxView;
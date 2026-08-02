/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AI AI 草稿生成器 (mock)
 * A5-REPORT / 20 点
 */

import React, { useState } from 'react';
import { Card, Button, Space, Typography, Select, Input, Progress, Alert, Row, Col, Tag, Empty, message, Divider, List } from 'antd';
import { Sparkles, FileText, Loader2, CheckCircle2, ArrowRight, Hash, Eye, Copy } from 'lucide-react';
import { aiService, type GenerateDraftProgress } from '../../../../services/ai/aiService';
import type { AIDraftResult, AIScenario } from '../../../../types/R3/R3.AI';
import { AI_SCENARIOS, AI_DRAFT_STAGE_LABEL } from '../../../../types/R3/R3.AI';

const { Title, Text, Paragraph } = Typography;

export interface AIDraftGeneratorProps {
  reportId?: string;
  defaultScenario?: AIScenario;
  onApply?: (draft: AIDraftResult) => void;
  onReject?: (draft: AIDraftResult) => void;
}

const STAGE_ORDER: GenerateDraftProgress['stage'][] = [
  'extracting-history',
  'analyzing-images',
  'generating-findings',
  'generating-diagnosis',
  'generating-impression',
  'post-processing',
  'done',
];

export const AIDraftGenerator: React.FC<AIDraftGeneratorProps> = ({
  reportId,
  defaultScenario = 'chest-ct',
  onApply,
  onReject,
}) => {
  const [scenario, setScenario] = useState<AIScenario>(defaultScenario);
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateDraftProgress[]>([]);
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<AIDraftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AIDraftResult[]>([]);

  React.useEffect(() => {
    void aiService.listDrafts().then(setDrafts);
  }, []);

  const handleGenerate = async () => {
    if (!clinicalHistory.trim()) {
      message.warning('请输入临床病史');
      return;
    }
    setError(null);
    setGenerating(true);
    setProgress([]);
    setPercent(0);
    setResult(null);
    try {
      const draft = await aiService.generateDraft(
        { scenario, clinicalHistory, ...(reportId ? { reportId } : {}) },
        (p) => {
          setProgress((prev) => [...prev, p]);
          setPercent(p.percent);
        }
      );
      setResult(draft);
      setDrafts((prev) => [draft, ...prev].slice(0, 10));
      message.success('AI 草稿生成完成');
    } catch (e) {
      setError((e as Error).message);
      message.error('生成失败：' + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply?.(result);
      message.success('已应用到报告');
    }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    message.success('已复制');
  };

  const confidenceLevel = result?.confidence.level ?? 'medium';

  return (
    <Card
      title={
        <Space>
          <Sparkles size={18} color="#7c3aed" />
          <span>AI 报告草稿</span>
          <Tag color="purple" icon={<Sparkles size={12} />}>v2.3 mock</Tag>
        </Space>
      }
      style={{ width: '100%' }}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary">场景</Text>
            <Select
              value={scenario}
              onChange={setScenario}
              style={{ width: '100%', marginTop: 4 }}
              options={AI_SCENARIOS.map((s) => ({
                value: s.id,
                label: `${s.label} (${s.modality}) - ${s.description}`,
              }))}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary">报告 ID</Text>
            <Input value={reportId ?? ''} disabled placeholder="新建报告" style={{ marginTop: 4 }} />
          </Col>
        </Row>

        <div>
          <Text type="secondary">临床病史 (必填)</Text>
          <Input.TextArea
            value={clinicalHistory}
            onChange={(e) => setClinicalHistory(e.target.value)}
            placeholder="例如：男性，65 岁，咳嗽咳痰 2 周，疑似肺部占位。"
            rows={3}
            style={{ marginTop: 4 }}
          />
        </div>

        <Button
          type="primary"
          icon={<Sparkles size={14} />}
          onClick={handleGenerate}
          loading={generating}
          block
          size="large"
        >
          {generating ? 'AI 正在生成...' : '一键生成 AI 草稿'}
        </Button>

        {error && <Alert type="error" showIcon title={error} />}

        {generating && (
          <Card size="small">
            <Progress percent={percent} status="active" />
            <Divider style={{ margin: '12px 0' }} />
            <List
              size="small"
              dataSource={progress}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <CheckCircle2 size={12} color="#10b981" />
                    <Text style={{ fontSize: 12 }}>{AI_DRAFT_STAGE_LABEL[item.stage]}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>
                    <Tag>{item.percent}%</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {result && !generating && (
          <Card size="small" title={
            <Space>
              <FileText size={14} />
              <span>AI 生成结果</span>
              <Tag color={confidenceLevel === 'high' ? 'green' : confidenceLevel === 'medium' ? 'blue' : 'orange'}>
                置信度 {(result.confidence.overall * 100).toFixed(1)}%
              </Tag>
            </Space>
          }>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">影像所见</Text>
                <Paragraph
                  style={{
                    padding: 8,
                    background: '#f8fafc',
                    borderRadius: 4,
                    marginTop: 4,
                    marginBottom: 0,
                    fontSize: 12,
                  }}
                >
                  {result.findings}
                </Paragraph>
                <Button size="small" icon={<Copy size={12} />} onClick={() => handleCopy(result.findings)} style={{ marginTop: 4 }}>
                  复制所见
                </Button>
              </div>
              <div>
                <Text type="secondary">诊断</Text>
                <Paragraph
                  style={{
                    padding: 8,
                    background: '#f8fafc',
                    borderRadius: 4,
                    marginTop: 4,
                    marginBottom: 0,
                    fontSize: 12,
                  }}
                >
                  {result.diagnosis}
                </Paragraph>
                <Button size="small" icon={<Copy size={12} />} onClick={() => handleCopy(result.diagnosis)} style={{ marginTop: 4 }}>
                  复制诊断
                </Button>
              </div>
              <div>
                <Text type="secondary">诊断意见</Text>
                <Paragraph
                  style={{
                    padding: 8,
                    background: '#f8fafc',
                    borderRadius: 4,
                    marginTop: 4,
                    marginBottom: 0,
                    fontSize: 12,
                  }}
                >
                  {result.impression}
                </Paragraph>
                <Button size="small" icon={<Copy size={12} />} onClick={() => handleCopy(result.impression)} style={{ marginTop: 4 }}>
                  复制意见
                </Button>
              </div>
              {result.recommendations && (
                <div>
                  <Text type="secondary">建议</Text>
                  <Paragraph style={{ fontSize: 12, marginBottom: 0 }}>{result.recommendations}</Paragraph>
                </div>
              )}
              <Divider style={{ margin: '8px 0' }} />
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <Hash size={11} /> Token: {result.tokenUsage.total} ({result.tokenUsage.prompt}+{result.tokenUsage.completion})
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  耗时: {result.processingMs} ms
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  模型: {result.modelVersion}
                </Text>
              </Space>
              <Space>
                <Button type="primary" icon={<ArrowRight size={12} />} onClick={handleApply}>
                  应用到报告
                </Button>
                <Button icon={<Eye size={12} />} onClick={() => onReject?.(result)}>
                  拒绝
                </Button>
              </Space>
            </Space>
          </Card>
        )}

        {drafts.length > 0 && (
          <Card size="small" title="最近生成">
            <List
              size="small"
              dataSource={drafts.slice(0, 5)}
              renderItem={(d) => (
                <List.Item>
                  <Space>
                    <Tag color="purple">{AI_SCENARIOS.find((s) => s.id === d.scenario)?.label}</Tag>
                    <Text style={{ fontSize: 12 }}>{d.reportId}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {(d.confidence.overall * 100).toFixed(0)}%
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        <Alert
          type="info"
          showIcon
          title="边界声明"
          description="AI 草稿仅供参考，最终诊断以执业医师为准。模型为 mock 实现，所有输出均为预设响应。"
        />
      </Space>
    </Card>
  );
};

export default AIDraftGenerator;
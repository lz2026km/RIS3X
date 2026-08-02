/**
 * G005 RIS v3.0.6.6 - 自动检测页面
 * 展示 PACS 自动识别的危急值
 */

import React from 'react';
import { Card, Tag, Space, Empty, Row, Col, Alert, Statistic } from 'antd';
import { Cpu, Zap, Activity, AlertOctagon, FlaskConical, BookOpen } from 'lucide-react';
import { AutoDetectPanel } from '../../components/critical/AutoDetectPanel';
import { autoDetector } from '../../services/critical/autoDetect/AutoDetector';

export const AutoDetectPage: React.FC = () => {
  const rules = autoDetector.defaultRules();

  return (
    <div className="p-4 space-y-3" data-testid="auto-detect-page">
      <div className="flex items-center gap-2">
        <Cpu size={24} color="#7c3aed" />
        <h1 className="text-xl font-bold">自动危急值检测</h1>
        <Tag color="purple">PACS 实时</Tag>
        <Tag color="cyan">SR TID 1500</Tag>
      </div>

      <Row gutter={12}>
        <Col span={6}>
          <Statistic title="自动检测规则" value={rules.length} prefix={<FlaskConical size={14} />} />
        </Col>
        <Col span={6}>
          <Statistic title="SR 命中规则" value={rules.filter((r) => r.source === 'sr' || r.source === 'both').length} prefix={<Zap size={14} />} />
        </Col>
        <Col span={6}>
          <Statistic title="NLP 文本规则" value={rules.filter((r) => r.source === 'text' || r.source === 'both').length} prefix={<BookOpen size={14} />} />
        </Col>
        <Col span={6}>
          <Statistic title="识别时延" value="<1" suffix="s" prefix={<Activity size={14} />} styles={{ content: {  color: '#10b981'  } }} />
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        icon={<AlertOctagon size={14} />}
        message="PACS 实时监听 DICOM Structured Report(TID 1500)与报告文本关键字,命中规则立即生成建议危急值事件"
      />

      <AutoDetectPanel />

      <Card size="small" title={<Space><BookOpen size={14} /><strong>内置规则</strong></Space>}>
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          {rules.map((r) => (
            <div key={r.id} style={{ padding: 8, borderRadius: 6, background: '#f8fafc', borderLeft: `3px solid ${r.severity === 'critical' ? '#dc2626' : r.severity === 'urgent' ? '#f59e0b' : '#3b82f6'}` }}>
              <Space wrap>
                <Tag color={r.severity === 'critical' ? 'red' : r.severity === 'urgent' ? 'orange' : 'blue'}>
                  {r.code}
                </Tag>
                <strong>{r.name}</strong>
                <Tag>{r.source}</Tag>
                {r.path && <Tag color="cyan">path: {r.path}</Tag>}
                {r.operator && r.threshold !== undefined && (
                  <Tag color="purple">{r.operator} {r.threshold}</Tag>
                )}
                {r.keywords && r.keywords.map((kw) => (
                  <Tag key={kw}>{kw}</Tag>
                ))}
              </Space>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{r.description}</div>
            </div>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default AutoDetectPage;
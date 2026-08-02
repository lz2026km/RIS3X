/**
 * G005 RIS v3.0.6.5 - 自动报告预览
 * 30 升级点 - 实时预览 / HTML 输出 / 引用 / 置信度可视化
 */
import React, { useState, useCallback } from 'react';
import {
  Card, Tabs, Button, Space, Tag, Statistic, Row, Col, Tooltip, Empty,
  message, Switch, Input,
} from 'antd';
import {
  Eye, FileText, Code, ChevronRight, Save, ClipboardCopy, Sparkles,
  Database, FileEdit,
} from 'lucide-react';
import type { RadsSystem } from '@data/rads/radsCommon';
import type { AutoReportDraft, AutoReportSection } from '@/types/templates/calculations';
import { AutoReportComposer } from '@services/templates/autoReport/AutoReportComposer';

const { TextArea } = Input;

interface Props {
  reportId: string;
  templateId: string;
  modality: string;
  bodyPart: string;
  radsType?: RadsSystem;
  radsValues?: Record<string, unknown>;
  fields: Record<string, unknown>;
  findings?: string;
  impression?: string;
  onApply?: (draft: AutoReportDraft) => void;
}

export const AutoReportPreview: React.FC<Props> = (props) => {
  const [view, setView] = useState<'preview' | 'html' | 'sections'>('preview');
  const [draft, setDraft] = useState<AutoReportDraft | null>(null);
  const [auto, setAuto] = useState(true);
  const [text, setText] = useState('');

  const compose = useCallback(() => {
    const d = AutoReportComposer.getInstance().compose({
      reportId: props.reportId,
      templateId: props.templateId,
      modality: props.modality,
      bodyPart: props.bodyPart,
      radsType: props.radsType,
      radsValues: props.radsValues,
      fields: props.fields,
      findings: props.findings,
      impression: props.impression,
    });
    setDraft(d);
    setText(AutoReportComposer.getInstance().toText(d));
    message.success(`已生成 ${d.sections.length} 段报告,综合置信度 ${(d.totalConfidence * 100).toFixed(0)}%`);
  }, [props]);

  React.useEffect(() => {
    if (auto) compose();
  }, [auto, compose]);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(text).then(() => message.success('已复制'));
  }, [text]);

  return (
    <Card
      size="small"
      className="shadow-sm"
      title={
        <Space>
          <Sparkles className="w-4 h-4 text-purple-500" />
          自动报告预览
        </Space>
      }
      extra={
        <Space>
          <span className="text-xs text-slate-500">实时生成</span>
          <Switch size="small" checked={auto} onChange={setAuto} />
          <Button size="small" icon={<FileEdit className="w-4 h-4" />} onClick={compose}>重新生成</Button>
        </Space>
      }
    >
      {draft ? (
        <>
          <Row gutter={8} className="mb-2">
            <Col span={6}>
              <Statistic title="段落数" value={draft.sections.length} styles={{ content: {  fontSize: 18  } }} />
            </Col>
            <Col span={6}>
              <Statistic title="综合置信度" value={Math.round(draft.totalConfidence * 100)} suffix="%" styles={{ content: {  fontSize: 18, color: '#10b981'  } }} />
            </Col>
            <Col span={6}>
              <Statistic title="RADS 类型" value={draft.radsType ?? '无'} styles={{ content: {  fontSize: 14  } }} />
            </Col>
            <Col span={6}>
              <Statistic title="模型版本" value={draft.modelVersion} styles={{ content: {  fontSize: 12  } }} />
            </Col>
          </Row>

          <Tabs
            size="small"
            activeKey={view}
            onChange={(k) => setView(k as 'preview' | 'html' | 'sections')}
            items={[
              { key: 'preview', label: <span><Eye className="w-3 h-3 inline mr-1" />预览</span>, children: (
                <TextArea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoSize={{ minRows: 12, maxRows: 30 }}
                  style={{ fontFamily: 'KaiTi, serif', fontSize: 14 }}
                />
              ) },
              { key: 'html', label: <span><Code className="w-3 h-3 inline mr-1" />HTML</span>, children: (
                <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto" style={{ maxHeight: 400 }}>
                  {AutoReportComposer.getInstance().toHtml(draft)}
                </pre>
              ) },
              { key: 'sections', label: <span><Database className="w-3 h-3 inline mr-1" />分段 ({draft.sections.length})</span>, children: (
                <div className="space-y-1 max-h-96 overflow-auto">
                  {draft.sections.map((s: AutoReportSection) => <SectionRow key={s.key} section={s} />)}
                </div>
              ) },
            ]}
          />

          <div className="mt-2 flex justify-end">
            <Space>
              <Button icon={<ClipboardCopy className="w-4 h-4" />} onClick={handleCopy} size="small">复制文本</Button>
              <Button
                type="primary"
                icon={<Save className="w-4 h-4" />}
                onClick={() => { props.onApply?.(draft); message.success('已应用到报告编辑器'); }}
                size="small"
              >
                应用到报告
              </Button>
            </Space>
          </div>
        </>
      ) : (
        <Empty description="点击「重新生成」创建草稿" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );
};

const SectionRow: React.FC<{ section: AutoReportSection }> = ({ section }) => {
  const sourceColors: Record<AutoReportSection['source'], string> = {
    'fields': 'blue', 'findings': 'cyan', 'comparison': 'purple', 'rads': 'volcano',
    'calculation': 'green', 'phrase': 'orange', 'template': 'default',
  };
  return (
    <div className="border rounded p-2 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <Space>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-medium text-sm">{section.title}</span>
          <Tag color={sourceColors[section.source]}>{section.source}</Tag>
          <Tooltip title={`置信度:${Math.round(section.confidence * 100)}%`}>
            <Tag color={section.confidence >= 0.85 ? 'green' : section.confidence >= 0.6 ? 'gold' : 'orange'}>
              {Math.round(section.confidence * 100)}%
            </Tag>
          </Tooltip>
        </Space>
      </div>
      <div className="text-xs text-slate-600 mt-1 pl-4 whitespace-pre-line">{section.body}</div>
      {section.citations && section.citations.length > 0 && (
        <div className="text-xs text-slate-400 mt-1 pl-4">
          <FileText className="w-3 h-3 inline" /> 引用:{section.citations.join(', ')}
        </div>
      )}
    </div>
  );
};

export default AutoReportPreview;

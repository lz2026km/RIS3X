/**
 * G005 RIS v3.0.6.5 - 通用 RADS 计算器 UI 框架
 * 60 升级点 - 路由 / 动态字段 / 自动评分 / 风险仪表 / 报告片段
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  Card, Form, InputNumber, Switch, Select, Button, Space, Tag, Statistic,
  Row, Col, Divider, Alert, Tooltip, Input, Empty, Tabs, message,
} from 'antd';
import {
  Calculator, RotateCcw, Save, ClipboardCopy, Info, Sparkles, AlertTriangle,
  Heart, Brain, Activity, ListTree, FileText, Award, BookOpen, Zap,
} from 'lucide-react';
import type { RadsSystem } from '@data/rads/radsCommon';
import { RadsCalculatorEngine, RADS_SCHEMAS } from '@services/templates/rads/RadsCalculatorEngine';
import type { RadsCalculatorResult } from '@/types/templates/calculations';
import { RadsRiskGauge } from '../RadsRiskGauge';

interface Props {
  initialSystem?: RadsSystem;
  modality?: string;
  bodyPart?: string;
  onCommit?: (result: RadsCalculatorResult) => void;
  compact?: boolean;
}

const ICONS: Record<RadsSystem, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  'BI-RADS': Heart,
  'TI-RADS': ListTree,
  'Lung-RADS': Activity,
  'LI-RADS': Heart,
  'CAD-RADS': FileText,
  'PI-RADS': Brain,
  'C-RADS': Activity,
  'NI-RADS': FileText,
  'O-RADS': Heart,
  'VI-RADS': FileText,
  'Bone-RADS': Award,
};

const COLORS: Record<RadsSystem, string> = {
  'BI-RADS': '#ec4899',
  'TI-RADS': '#f59e0b',
  'Lung-RADS': '#10b981',
  'LI-RADS': '#7c3aed',
  'CAD-RADS': '#0891b2',
  'PI-RADS': '#8b5cf6',
  'C-RADS': '#14b8a6',
  'NI-RADS': '#6366f1',
  'O-RADS': '#f43f5e',
  'VI-RADS': '#0ea5e9',
  'Bone-RADS': '#a16207',
};

export const RadsCalculator: React.FC<Props> = ({
  initialSystem = 'Lung-RADS',
  modality: defaultModality = 'CT',
  bodyPart: defaultBodyPart = 'CHEST',
  onCommit,
  compact = false,
}) => {
  const engine = useMemo(() => RadsCalculatorEngine.getInstance(), []);
  const [system, setSystem] = useState<RadsSystem>(initialSystem);
  const [modality, setModality] = useState(defaultModality);
  const [bodyPart, setBodyPart] = useState(defaultBodyPart);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<RadsCalculatorResult | null>(null);

  const schema = RADS_SCHEMAS[system];
  const Icon = ICONS[system] ?? Calculator;
  const color = COLORS[system] ?? '#3b82f6';

  const handleValueChange = useCallback((key: string, v: unknown) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const handleCompute = useCallback(() => {
    try {
      const r = engine.calculate({ radsType: system, modality, bodyPart, values });
      setResult(r);
    } catch (e) {
      message.error(`计算失败:${(e as Error).message}`);
    }
  }, [engine, system, modality, bodyPart, values]);

  const handleReset = useCallback(() => {
    setValues({});
    setResult(null);
  }, []);

  const handleCopy = useCallback(() => {
    if (!result?.snippet) return;
    const text = `${result.radsType} ${result.category}\n所见:${result.snippet.finding}\n意见:${result.snippet.impression}\n建议:${result.snippet.recommendation}`;
    navigator.clipboard?.writeText(text).then(() => message.success('已复制到剪贴板'));
  }, [result]);

  const handleCommit = useCallback(() => {
    if (!result) return;
    onCommit?.(result);
    message.success('已应用 RADS 评估到报告');
  }, [result, onCommit]);

  return (
    <div className="space-y-3">
      {/* 顶部:系统选择 + 上下文 */}
      <Card size="small" className="shadow-sm">
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Space>
              <Icon className="w-5 h-5" style={{ color }} />
              <Select
                value={system}
                onChange={(v) => { setSystem(v); setValues({}); setResult(null); }}
                style={{ width: 200 }}
                options={engine.listSystems().map((s) => ({
                  value: s, label: RADS_SCHEMAS[s].label,
                }))}
              />
              <Select
                value={modality}
                onChange={setModality}
                style={{ width: 130 }}
                options={[
                  { value: 'CT', label: 'CT' },
                  { value: 'MR', label: 'MR' },
                  { value: 'US', label: '超声' },
                  { value: 'DR', label: 'X 线' },
                  { value: 'MG', label: '钼靶' },
                ]}
              />
              <Select
                value={bodyPart}
                onChange={setBodyPart}
                style={{ width: 150 }}
                options={[
                  { value: 'BREAST', label: '乳腺' },
                  { value: 'THYROID', label: '甲状腺' },
                  { value: 'CHEST', label: '胸部' },
                  { value: 'LIVER', label: '肝脏' },
                  { value: 'HEART', label: '心脏' },
                  { value: 'PROSTATE', label: '前列腺' },
                  { value: 'COLON', label: '结肠' },
                  { value: 'NECK', label: '头颈' },
                  { value: 'OVARY', label: '卵巢' },
                  { value: 'BLADDER', label: '膀胱' },
                  { value: 'BONE', label: '骨骼' },
                ]}
              />
              <Tag color={color}>{schema.version}</Tag>
              <Tag color="default">{schema.source}</Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<RotateCcw className="w-4 h-4" />} onClick={handleReset}>重置</Button>
              <Button type="primary" icon={<Calculator className="w-4 h-4" />} onClick={handleCompute}>计算</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={12}>
        {/* 左侧:字段表单 */}
        <Col span={compact ? 24 : 14}>
          <Card size="small" title={<><Zap className="w-4 h-4 inline mr-1" style={{ color }} />{schema.label} - 字段输入</>} className="shadow-sm">
            {schema.groups.map((g) => {
              const fields = schema.fields.filter((f) => f.group === g.key);
              if (fields.length === 0) return null;
              return (
                <div key={g.key} className="mb-4">
                  <Divider orientation="left" style={{ margin: '8px 0', fontSize: 13 }}>
                    {g.label}
                  </Divider>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    {fields.map((f) => {
                      const labelNode = (
                        <span>
                          {f.label}
                          {f.required && <span style={{ color: '#dc2626' }}> *</span>}
                          {f.unit && <Tag style={{ marginLeft: 4 }}>{f.unit}</Tag>}
                        </span>
                      );
                      let control: React.ReactNode = null;
                      switch (f.type) {
                        case 'number':
                          control = (
                            <InputNumber
                              value={values[f.key] as number | null}
                              min={f.min}
                              max={f.max}
                              onChange={(v) => handleValueChange(f.key, v)}
                              suffix={f.unit}
                              style={{ width: '100%' }}
                            />
                          );
                          break;
                        case 'boolean':
                          control = (
                            <Switch
                              checked={Boolean(values[f.key])}
                              onChange={(v) => handleValueChange(f.key, v)}
                              checkedChildren="是"
                              unCheckedChildren="否"
                            />
                          );
                          break;
                        case 'enum':
                          control = (
                            <Select
                              value={values[f.key] as string | undefined}
                              onChange={(v) => handleValueChange(f.key, v)}
                              options={f.options?.map((o) => ({ value: o.value, label: o.label }))}
                              style={{ width: '100%' }}
                              allowClear
                            />
                          );
                          break;
                        default:
                          control = <Input value={String(values[f.key] ?? '')} onChange={(e) => handleValueChange(f.key, e.target.value)} />;
                      }
                      return (
                        <Form.Item key={f.key} label={labelNode} style={{ marginBottom: 8 }}>
                          {control}
                        </Form.Item>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Card>
        </Col>

        {/* 右侧:结果 */}
        <Col span={compact ? 24 : 10}>
          {result ? (
            <Card size="small" className="shadow-sm" title={<><Sparkles className="w-4 h-4 inline mr-1" style={{ color }} />计算结果</>}>
              <div className="text-center mb-3">
                <RadsRiskGauge
                  data={{
                    radsType: result.radsType,
                    category: result.category,
                    score: result.score,
                    band: result.riskLevel,
                    recommendation: result.recommendation,
                    range: { min: 0, max: 100, optimal: 10 },
                  }}
                  size={compact ? 'small' : 'medium'}
                />
              </div>
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic
                    title="分类"
                    value={result.category}
                    styles={{ content: {  color, fontSize: 18  } }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic title="评分" value={result.score} suffix="/100" styles={{ content: {  fontSize: 18  } }} />
                </Col>
              </Row>
              <Divider style={{ margin: '8px 0' }} />
              <div className="text-sm mb-2">
                <Tag color={color}>{result.riskLevel}</Tag>
                <span className="text-slate-500 ml-1">风险等级</span>
              </div>
              <Alert
                type={result.riskLevel === 'very-high' ? 'error' : result.riskLevel === 'high' ? 'warning' : 'info'}
                showIcon
                title={result.recommendation}
                style={{ marginBottom: 8 }}
              />
              {result.warnings.length > 0 && (
                <Alert
                  type="warning" showIcon
                  title={`${result.warnings.length} 个必填项缺失`}
                  description={result.warnings.slice(0, 3).join(';')}
                  style={{ marginBottom: 8 }}
                />
              )}
              {result.snippet && (
                <Tabs
                  size="small"
                  items={[
                    { key: 'imp', label: '意见', children: <div className="text-xs">{result.snippet.impression}</div> },
                    { key: 'find', label: '所见', children: <div className="text-xs">{result.snippet.finding}</div> },
                    { key: 'rec', label: '建议', children: <div className="text-xs">{result.snippet.recommendation}</div> },
                  ]}
                />
              )}
              <Space>
                <Button icon={<ClipboardCopy className="w-4 h-4" />} onClick={handleCopy} size="small">复制</Button>
                {onCommit && (
                  <Button type="primary" icon={<Save className="w-4 h-4" />} onClick={handleCommit} size="small">
                    应用到报告
                  </Button>
                )}
              </Space>
            </Card>
          ) : (
            <Card size="small" className="shadow-sm">
              <Empty description="填写左侧字段后点击「计算」" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          )}

          {/* 分类速查 */}
          <Card size="small" className="shadow-sm mt-2" title={<><BookOpen className="w-4 h-4 inline mr-1" />分类速查</>}>
            <div className="grid grid-cols-2 gap-1">
              {schema.categories.map((c) => (
                <Tooltip key={c.value} title={c.recommendation}>
                  <Tag color={
                    c.riskBand === 'very-high' ? 'red' :
                    c.riskBand === 'high' ? 'volcano' :
                    c.riskBand === 'intermediate' ? 'orange' :
                    c.riskBand === 'low' ? 'gold' : 'green'
                  } style={{ width: '100%', textAlign: 'left', margin: 0 }}>
                    {c.value} - {c.label}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RadsCalculator;

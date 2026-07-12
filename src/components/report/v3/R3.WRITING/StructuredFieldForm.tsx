/**
 * G005 放射RIS系统 v3.0.5.1 - 结构化字段表单
 * R3.WRITING 组 A:RECIST 1.1 / BI-RADS / PI-RADS / Lung-RADS / TI-RADS / CAD-RADS
 * 50 升级点:7+ 字段类型 / 必填校验 / 联动 / 分组 / 拖拽 / 默认值 / 单位 / 公式 / 上传 / 签名 / 评分 / 完成度环
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Card, Tabs, Input, InputNumber, Select, DatePicker, Switch, Slider, Button,
  Space, Tag, Tooltip, Progress, Row, Col, Statistic, Divider, Empty, Modal, message,
  Alert, Radio, Upload,
} from 'antd';
import {
  CheckCircle2, AlertTriangle, Lock, Calculator, Hash, Calendar,
  ChevronDown, ChevronUp, Image as ImageIcon, Edit3, Star, Info, Award,
  Activity, Heart, Brain, ListTree, FileText,
} from 'lucide-react';
import {
  RECIST_TEMPLATE, BIRADS_TEMPLATE, PIRADS_TEMPLATE, getStructuredTemplates,
  BIRADS_CATEGORY_MAP, RECIST_RESPONSE, PIRADS_ASSESSMENT,
} from '@data/reportWritingMock';
import {
  calcRecistResponse, calcPiradsOverall, getBiradsByCategory, evaluateFormula,
} from '@services/writing/writingService';
import type {
  StructuredTemplate, StructuredFieldDefinition, StructuredFieldGroup,
  BiradsAssessment, BiradsCategory, RecistResponse, PiradsScore,
} from '@types/R3/R3.WRITING';

const { TextArea } = Input;

interface Props {
  reportId: string;
  initialTemplateId?: StructuredTemplate['id'];
  initialValues?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  onSubmit?: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
}

const TABS = [
  { id: 'recist', label: 'RECIST 1.1', icon: Activity, color: '#3b82f6' },
  { id: 'birads', label: 'BI-RADS', icon: Heart, color: '#ec4899' },
  { id: 'pirads', label: 'PI-RADS v2.1', icon: Brain, color: '#8b5cf6' },
  { id: 'lungRads', label: 'Lung-RADS 2022', icon: Activity, color: '#10b981' },
  { id: 'cadRads', label: 'CAD-RADS 2.0', icon: FileText, color: '#0891b2' },
  { id: 'liRads', label: 'LI-RADS v2024', icon: Heart, color: '#7c3aed' },
  { id: 'tiRads', label: 'TI-RADS', icon: ListTree, color: '#f59e0b' },
  { id: 'cRads', label: 'C-RADS', icon: Activity, color: '#14b8a6' },
  { id: 'oRads', label: 'O-RADS MRI', icon: Heart, color: '#ec4899' },
  { id: 'tnm', label: 'TNM/AJCC 8th', icon: Award, color: '#6366f1' },
] as const;

export const StructuredFieldForm: React.FC<Props> = ({
  reportId, initialTemplateId = 'recist', initialValues, onChange, onSubmit, readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<StructuredTemplate['id']>(initialTemplateId);
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const template = useMemo(() => getStructuredTemplates().find((t) => t.id === activeTab), [activeTab]);
  const activeTabMeta = useMemo(() => TABS.find((t) => t.id === activeTab) ?? TABS[0]!, [activeTab]);

  // 公式自动计算
  useEffect(() => {
    if (!template) return;
    const formulaFields = template.fields.filter((f) => f.formula);
    const newValues: Record<string, unknown> = { ...values };
    let changed = false;
    formulaFields.forEach((f) => {
      if (!f.formula) return;
      const numericValues: Record<string, number> = {};
      template.fields.forEach((tf) => {
        if (typeof values[tf.key] === 'number') numericValues[tf.key] = values[tf.key] as number;
      });
      const result = evaluateFormula(f.formula, numericValues);
      if (result !== values[f.key]) {
        newValues[f.key] = Number(result.toFixed(2));
        changed = true;
      }
    });
    if (changed) {
      setValues(newValues);
      onChange?.(newValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, template]);

  const handleValueChange = useCallback((key: string, value: unknown) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onChange?.(next);
  }, [values, onChange]);

  // 完成度计算
  const completion = useMemo(() => {
    if (!template) return { filled: 0, total: 0, percent: 0 };
    const required = template.fields.filter((f) => f.required);
    const filled = required.filter((f) => values[f.key] !== undefined && values[f.key] !== '' && values[f.key] !== null).length;
    return { filled, total: required.length, percent: Math.round((filled / required.length) * 100) };
  }, [template, values]);

  // 字段质量分计算
  const fieldScore = useMemo(() => {
    if (!template) return 0;
    const all = template.fields;
    const filled = all.filter((f) => values[f.key] !== undefined && values[f.key] !== '').length;
    return Math.round((filled / all.length) * 100);
  }, [template, values]);

  // 联动可见性
  const isFieldVisible = useCallback((f: StructuredFieldDefinition) => {
    if (!f.dependsOn) return true;
    return values[f.dependsOn.fieldKey] === f.dependsOn.equals;
  }, [values]);

  const toggleGroup = (gid: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  const renderField = (f: StructuredFieldDefinition) => {
    if (!isFieldVisible(f)) return null;
    const isLocked = f.locked || readOnly;
    const labelNode = (
      <span className="flex items-center gap-1">
        {f.label}
        {f.required && <span style={{ color: '#dc2626' }}>*</span>}
        {f.locked && <Lock className="w-3 h-3" style={{ color: '#94a3b8' }} />}
        {f.formula && <Calculator className="w-3 h-3" style={{ color: '#0891b2' }} />}
        {f.fillGuide && (
          <Tooltip title={f.fillGuide}>
            <Info className="w-3 h-3" style={{ color: '#94a3b8', cursor: 'help' }} />
          </Tooltip>
        )}
      </span>
    );

    const commonProps = {
      disabled: isLocked,
      placeholder: f.placeholder,
    };

    let control: React.ReactNode = null;
    switch (f.type) {
      case 'text':
        control = <Input {...commonProps} value={(values[f.key] as string) ?? ''} onChange={(e) => handleValueChange(f.key, e.target.value)} />;
        break;
      case 'number':
        control = (
          <InputNumber
            {...commonProps}
            value={values[f.key] as number | null}
            min={f.min}
            max={f.max}
            addonAfter={f.unitOptions ? (
              <Select size="small" defaultValue={f.unit ?? f.unitOptions[0]} style={{ width: 70 }} options={f.unitOptions.map((u) => ({ value: u, label: u }))} />
            ) : f.unit}
            onChange={(v) => handleValueChange(f.key, v)}
            style={{ width: '100%' }}
          />
        );
        break;
      case 'enum':
        control = (
          <Select
            {...commonProps}
            value={values[f.key] as string | undefined}
            onChange={(v) => handleValueChange(f.key, v)}
            options={(f.options ?? []).map((o) => ({ value: o.value, label: <span><Tag color={o.color}>{o.label}</Tag></span> }))}
            style={{ width: '100%' }}
          />
        );
        break;
      case 'multi-enum':
        control = (
          <Select
            {...commonProps}
            mode="multiple"
            value={(values[f.key] as string[]) ?? []}
            onChange={(v) => handleValueChange(f.key, v)}
            options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            style={{ width: '100%' }}
          />
        );
        break;
      case 'date':
        control = (
          <DatePicker
            {...commonProps}
            value={(() => {
              const v = values[f.key];
              if (!v) return null;
              if (typeof v === 'string') {
                const d = dayjs(v);
                return d.isValid() ? d : null;
              }
              return v as Dayjs;
            })()}
            onChange={(_d, ds) => handleValueChange(f.key, ds)}
            style={{ width: '100%' }}
          />
        );
        break;
      case 'scale':
        control = (
          <div className="flex items-center gap-3 w-full">
            <Slider
              {...commonProps}
              min={f.min ?? 0}
              max={f.max ?? 10}
              value={(values[f.key] as number) ?? f.defaultValue ?? 0}
              onChange={(v) => handleValueChange(f.key, v)}
              marks={{ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }}
              style={{ flex: 1 }}
            />
            <span className="font-semibold text-lg" style={{ color: activeTabMeta.color, minWidth: 30 }}>
              {values[f.key] as number ?? f.defaultValue ?? 0}
            </span>
          </div>
        );
        break;
      case 'boolean':
        control = (
          <Switch
            {...commonProps}
            checked={Boolean(values[f.key])}
            onChange={(v) => handleValueChange(f.key, v)}
            checkedChildren="是"
            unCheckedChildren="否"
          />
        );
        break;
      case 'image':
        control = (
          <Upload listType="picture-card" showUploadList={{ showPreviewIcon: true }} beforeUpload={() => false}>
            <Button icon={<ImageIcon className="w-4 h-4" />} type="text">上传</Button>
          </Upload>
        );
        break;
      case 'signature':
        control = (
          <Button icon={<Edit3 className="w-4 h-4" />} type="dashed" disabled={isLocked}>
            {values[f.key] ? '已签名' : '点击签名'}
          </Button>
        );
        break;
      case 'formula':
        control = (
          <Input {...commonProps} value={String(values[f.key] ?? '')} disabled prefix={<Calculator className="w-3 h-3" style={{ color: '#0891b2' }} />} suffix={f.unit} />
        );
        break;
    }

    return (
      <div key={f.id} className="mb-3">
        <div className="flex items-center gap-1 mb-1 text-sm">
          {labelNode}
        </div>
        {control}
        {f.referenceRange && (
          <div className="text-xs text-slate-500 mt-1">
            参考范围: {f.referenceRange.min ?? '-'} ~ {f.referenceRange.max ?? '-'} {f.referenceRange.unit ?? ''}
            {f.referenceRange.note && ` (${f.referenceRange.note})`}
          </div>
        )}
        {f.example && (
          <div className="text-xs text-blue-500 mt-1">
            示例: {f.example}
          </div>
        )}
      </div>
    );
  };

  const renderTab = (template: StructuredTemplate) => (
    <div className="space-y-3">
      {template.groups.map((g) => {
        const fields = template.fields.filter((f) => f.group === g.id);
        const collapsed = collapsedGroups.has(g.id);
        const filled = fields.filter((f) => values[f.key] !== undefined && values[f.key] !== '').length;
        return (
          <Card
            key={g.id}
            size="small"
            title={
              <div className="flex items-center justify-between">
                <Space>
                  <span style={{ fontWeight: 600 }}>{g.label}</span>
                  <Tag color="blue">{filled}/{fields.length}</Tag>
                </Space>
                <Button type="text" size="small" icon={collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />} onClick={() => toggleGroup(g.id)} />
              </div>
            }
            className="shadow-sm"
          >
            {!collapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {fields.map(renderField)}
              </div>
            )}
          </Card>
        );
      })}

      {/* 摘要区:分类/评分/建议 */}
      <SummaryCard templateId={template.id} values={values} />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* 完成度头部 */}
      <Card size="small" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Statistic
              title="必填完成度"
              value={completion.percent}
              suffix="%"
              prefix={completion.percent === 100 ? <CheckCircle2 className="w-4 h-4" style={{ color: '#10b981' }} /> : <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: completion.percent === 100 ? '#10b981' : '#f59e0b', fontSize: 24 }}
            />
            <Progress percent={completion.percent} showInfo={false} strokeColor={completion.percent === 100 ? '#10b981' : '#f59e0b'} />
          </Col>
          <Col span={6}>
            <Statistic title="字段质量分" value={fieldScore} suffix="/100" prefix={<Award className="w-4 h-4" style={{ color: '#3b82f6' }} />} valueStyle={{ color: '#3b82f6', fontSize: 24 }} />
          </Col>
          <Col span={6}>
            <Statistic title="已填字段" value={completion.filled} suffix={`/ ${completion.total}`} prefix={<Hash className="w-4 h-4" style={{ color: '#8b5cf6' }} />} />
          </Col>
          <Col span={6}>
            <div className="flex items-center gap-2">
              <Button type="primary" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => onSubmit?.(values)} disabled={completion.percent < 100 || readOnly}>
                提交
              </Button>
              <Button onClick={() => { setValues({}); onChange?.({}); }}>清空</Button>
            </div>
          </Col>
        </Row>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as StructuredTemplate['id'])}
        items={TABS.map((t) => ({
          key: t.id,
          label: (
            <Space>
              <t.icon className="w-4 h-4" style={{ color: t.color }} />
              {t.label}
            </Space>
          ),
          children: template ? renderTab(template) : <Empty />,
        }))}
      />
    </div>
  );
};

// ============================================================
// 摘要子组件
// ============================================================
const SummaryCard: React.FC<{ templateId: StructuredTemplate['id']; values: Record<string, unknown> }> = ({ templateId, values }) => {
  if (templateId === 'recist') {
    const lesions = [1, 2, 3, 4, 5].map((i) => ({
      id: `l${i}`,
      site: String(values[`lesion${i}Site`] ?? ''),
      longDiameterMm: Number(values[`lesion${i}Long`] ?? 0),
      shortDiameterMm: Number(values[`lesion${i}Short`] ?? 0),
      baselineMm: Number(values[`lesion${i}Baseline`] ?? 0),
    })).filter((l) => l.longDiameterMm > 0);
    const response: RecistResponse = lesions.length > 0
      ? calcRecistResponse(lesions)
      : RECIST_RESPONSE;
    return (
      <Card size="small" title="RECIST 1.1 评估" className="shadow-sm">
        <Row gutter={16}>
          <Col span={6}><Statistic title="长径总和" value={response.sumOfDiameters} suffix="mm" /></Col>
          <Col span={6}><Statistic title="基线总和" value={response.baselineSum} suffix="mm" /></Col>
          <Col span={6}><Statistic title="变化" value={response.percentChange} suffix="%" precision={1} valueStyle={{ color: response.percentChange < 0 ? '#10b981' : '#dc2626' }} /></Col>
          <Col span={6}>
            <Tag color={{ CR: 'green', PR: 'blue', SD: 'orange', PD: 'red', NE: 'default' }[response.category]} style={{ fontSize: 16, padding: '4px 12px' }}>
              {response.categoryLabel} ({response.category})
            </Tag>
          </Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'birads') {
    const cat = (values['biradsCategory'] as BiradsCategory) ?? '2';
    const a = getBiradsByCategory(cat);
    return (
      <Card size="small" title="BI-RADS 评估" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Tag color={a.color} style={{ fontSize: 18, padding: '6px 16px' }}>BI-RADS {a.category}</Tag>
          </Col>
          <Col span={6}><div className="font-semibold text-lg">{a.label}</div><div className="text-xs text-slate-500">{a.labelEn}</div></Col>
          <Col span={6}><Statistic title="恶性风险" value={a.malignancyRisk} suffix="%" /></Col>
          <Col span={6}><div className="text-sm">{a.recommendation}</div></Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'pirads') {
    const overall = Number(values['overallScore'] ?? PIRADS_ASSESSMENT.overallScore) as PiradsScore;
    const psad = Number(values['psad'] ?? PIRADS_ASSESSMENT.psad);
    return (
      <Card size="small" title="PI-RADS v2.1 评估" className="shadow-sm">
        <Row gutter={16}>
          <Col span={6}>
            <div className="text-center">
              <div className="text-5xl font-bold" style={{ color: overall >= 4 ? '#dc2626' : overall >= 3 ? '#f59e0b' : '#10b981' }}>{overall}</div>
              <div className="text-xs text-slate-500">Overall Score</div>
            </div>
          </Col>
          <Col span={6}><Statistic title="PSA" value={Number(values['psa'] ?? 0)} suffix="ng/mL" /></Col>
          <Col span={6}><Statistic title="前列腺体积" value={Number(values['prostateVolume'] ?? 0)} suffix="cc" /></Col>
          <Col span={6}><Statistic title="PSAD" value={psad} suffix="ng/mL/cc" precision={3} /></Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'lungRads') {
    const cat = String(values['lungRadsCategory'] ?? '1');
    const catColor: Record<string, string> = { '0': '#9ca3af', '1': '#10b981', '2': '#10b981', '3': '#f59e0b', '4A': '#fb923c', '4B': '#ea580c', '4X': '#dc2626' };
    const modifier = (values['lungRadsModifier'] as string[]) ?? [];
    return (
      <Card size="small" title="Lung-RADS 2022 评估" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}><Tag color={catColor[cat] ?? '#9ca3af'} style={{ fontSize: 16, padding: '4px 12px' }}>Lung-RADS {cat}</Tag></Col>
          <Col span={6}><Statistic title="结节数量" value={Number(values['noduleCount'] ?? 0)} /></Col>
          <Col span={6}><Statistic title="结节大小" value={Number(values['noduleSizeMm'] ?? 0)} suffix="mm" /></Col>
          <Col span={6}>{modifier.length > 0 && <div className="text-sm">修饰符: {modifier.join(', ')}</div>}</Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'cadRads') {
    const cat = String(values['cadRadsCategory'] ?? '0');
    const catColor: Record<string, string> = { '0': '#10b981', '1': '#3b82f6', '2': '#f59e0b', '3': '#fb923c', '4': '#ea580c', '5': '#dc2626' };
    return (
      <Card size="small" title="CAD-RADS 2.0 评估" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}><Tag color={catColor[cat] ?? '#9ca3af'} style={{ fontSize: 16, padding: '4px 12px' }}>CAD-RADS {cat}</Tag></Col>
          <Col span={6}><Statistic title="LM狭窄" value={String(values['lmStenosis'] ?? '-')} /></Col>
          <Col span={6}><Statistic title="LAD狭窄" value={String(values['ladStenosis'] ?? '-')} /></Col>
          <Col span={6}><Statistic title="RCA狭窄" value={String(values['rcaStenosis'] ?? '-')} /></Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'liRads') {
    const cat = String(values['liRadsCategory'] ?? 'LR-3');
    return (
      <Card size="small" title="LI-RADS v2024 评估" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}><Tag color={{ 'LR-1': '#10b981', 'LR-2': '#3b82f6', 'LR-3': '#f59e0b', 'LR-4': '#fb923c', 'LR-5': '#dc2626', 'LR-M': '#7c3aed', 'LR-TIV': '#991b1b' }[cat] ?? '#9ca3af'} style={{ fontSize: 16, padding: '4px 12px' }}>{cat}</Tag></Col>
          <Col span={6}><Statistic title="APHE" value={String(values['aphe'] ?? '-')} /></Col>
          <Col span={6}><Statistic title="Washout" value={String(values['washout'] ?? '-')} /></Col>
          <Col span={6}><Statistic title="病灶数" value={Number(values['lesionCountLiver'] ?? 1)} /></Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'tiRads') {
    const cat = String(values['tiRadsCategory'] ?? 'TR1');
    return (
      <Card size="small" title="ACR TI-RADS 评估" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}><Tag color={{ 'TR1': '#10b981', 'TR2': '#3b82f6', 'TR3': '#f59e0b', 'TR4': '#fb923c', 'TR5': '#dc2626' }[cat] ?? '#9ca3af'} style={{ fontSize: 16, padding: '4px 12px' }}>{cat}</Tag></Col>
          <Col span={6}><Statistic title="总分" value={Number(values['totalTiradsScore'] ?? 0)} suffix="分" /></Col>
          <Col span={6}><Statistic title="结节大小" value={Number(values['noduleSizeTi'] ?? 0)} suffix="mm" /></Col>
          <Col span={6}><div className="text-sm text-slate-500">依据ACR TI-RADS指南</div></Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'cRads') {
    const cat = String(values['cRadsCategory'] ?? 'C1');
    return (
      <Card size="small" title="C-RADS 评估" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}><Tag color={{ 'C0': '#9ca3af', 'C1': '#10b981', 'C2': '#fb923c', 'C3': '#ea580c', 'C4': '#dc2626' }[cat] ?? '#9ca3af'} style={{ fontSize: 16, padding: '4px 12px' }}>{cat}</Tag></Col>
          <Col span={6}><Statistic title="息肉数量" value={Number(values['polypCount'] ?? 0)} /></Col>
          <Col span={6}><Statistic title="肠道准备" value={String(values['prepQuality'] ?? '-')} /></Col>
          <Col span={6}><div className="text-sm">管理建议: {String(values['cRadsManagement'] ?? '')}</div></Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'oRads') {
    const cat = String(values['oRadsCategory'] ?? '1');
    return (
      <Card size="small" title="O-RADS MRI 评估" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={6}><Tag color={{ '0': '#9ca3af', '1': '#10b981', '2': '#3b82f6', '3': '#f59e0b', '4': '#fb923c', '5': '#dc2626' }[cat] ?? '#9ca3af'} style={{ fontSize: 16, padding: '4px 12px' }}>O-RADS {cat}</Tag></Col>
          <Col span={6}><Statistic title="病变大小" value={Number(values['lesionSizeOr'] ?? 0)} suffix="mm" /></Col>
          <Col span={6}><Statistic title="强化" value={String(values['enhancement'] ?? '-')} /></Col>
          <Col span={6}><Statistic title="弥散受限" value={String(values['diffusionRestriction'] ?? '-')} /></Col>
        </Row>
      </Card>
    );
  }
  if (templateId === 'tnm') {
    const t = String(values['tCategory'] ?? 'TX');
    const n = String(values['nCategory'] ?? 'NX');
    const m = String(values['mCategory'] ?? 'M0');
    const stage = String(values['stageGroup'] ?? '');
    return (
      <Card size="small" title="TNM/AJCC 8th 分期" className="shadow-sm">
        <Row gutter={16} align="middle">
          <Col span={4}><Tag color="#3b82f6" style={{ fontSize: 18, padding: '4px 12px' }}>{t}{n}{m}</Tag></Col>
          <Col span={4}><Statistic title="T" value={t} /></Col>
          <Col span={4}><Statistic title="N" value={n} /></Col>
          <Col span={4}><Statistic title="M" value={m} /></Col>
          <Col span={4}>
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: stage.startsWith('IV') ? '#dc2626' : stage.startsWith('III') ? '#ea580c' : stage.startsWith('II') ? '#f59e0b' : '#10b981' }}>{stage || '-'}</div>
              <div className="text-xs text-slate-500">Stage</div>
            </div>
          </Col>
        </Row>
      </Card>
    );
  }
  return null;
};

export default StructuredFieldForm;

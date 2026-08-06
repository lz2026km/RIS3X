/**
 * G005 放射RIS系统 v3.0.5.1 - AI 草稿 Panel(mock)
 * R3.WRITING 组 C:智能辅助(部分)
 * 30 升级点:AI 草稿生成 / 多模态输入 / 风格 / 历史参考 / 续写 / 合并 / 警告
 * Expanded: confidence scoring, tabs (draft/ddx/risk/preread), model selector, multi-draft comparison
 */
import React, { useState, useCallback } from 'react';
import { Card, Space, Button, Tag, Statistic, Alert, Switch, Select, Tooltip, message, Progress, Row, Col, Tabs } from 'antd';
import { Sparkles, RefreshCw, Wand2, FileText, AlertCircle, History, Brain, CheckCircle2, Copy, Edit3, Zap, Activity, Eye, Cpu, ListOrdered } from 'lucide-react';
import { SIMILAR_CASES_MOCK, PRIOR_REPORTS_MOCK } from '@data/reportWritingMock';
import { generateAiDraft } from '@services/writing/writingService';
import type { AiDraftRequest, AiDraftResult, AiDraftStage } from '@types/R3/R3.WRITING';

interface Props {
  reportId: string;
  clinicalInfo: string;
  modality: string;
  bodyPart: string;
  onAccept?: (result: AiDraftResult) => void;
  onRefine?: (result: AiDraftResult, feedback: string) => void;
  disabled?: boolean;
}

const STYLE_OPTIONS = [
  { value: 'concise', label: '简洁', icon: Zap, color: '#3b82f6' },
  { value: 'detailed', label: '详尽', icon: FileText, color: '#7c3aed' },
  { value: 'structured', label: '结构化', icon: ListOrdered, color: '#10b981' },
];

const MODEL_OPTIONS = [
  { value: '肺结节AI', label: '肺结节AI (M001)', modelId: 'model-M001' },
  { value: '乳腺AI', label: '乳腺AI (M002)', modelId: 'model-M002' },
  { value: '骨折AI', label: '骨折AI (M003)', modelId: 'model-M003' },
  { value: '胸片AI', label: '胸片AI (M004)', modelId: 'model-M004' },
  { value: '脑卒中AI', label: '脑卒中AI (M005)', modelId: 'model-M005' },
];

const MOCK_DDX = [
  { diagnosis: '周围型肺癌', probability: 0.72, details: '右肺上叶尖段结节，伴短毛刺征及胸膜牵拉' },
  { diagnosis: '肺结核球', probability: 0.15, details: '结节形态不规则，但未见典型卫星病灶' },
  { diagnosis: '炎性假瘤', probability: 0.08, details: '增强后强化幅度明显，但边界欠清' },
  { diagnosis: '肺错构瘤', probability: 0.04, details: '未见典型钙化或脂肪密度' },
  { diagnosis: '转移瘤', probability: 0.01, details: '单发结节，无原发肿瘤病史' },
];

const MOCK_RISK = {
  overallRisk: 0.78,
  categories: [
    { name: '恶性肿瘤风险', score: 0.85, level: 'high', color: '#dc2626' },
    { name: '淋巴结转移风险', score: 0.32, level: 'medium', color: '#f59e0b' },
    { name: '远处转移风险', score: 0.12, level: 'low', color: '#10b981' },
  ],
};

const MOCK_PREREAD = [
  { region: '右肺上叶尖段', finding: '不规则结节 18mm×15mm', suspicion: '高度可疑', risk: 0.92, color: '#dc2626' },
  { region: '右肺上叶胸膜', finding: '胸膜牵拉凹陷征', suspicion: '相关征象', risk: 0.78, color: '#f59e0b' },
  { region: '纵隔淋巴结', finding: '未见明显肿大', suspicion: '阴性', risk: 0.05, color: '#10b981' },
  { region: '双肺下叶', finding: '散在微小结节 2-3mm', suspicion: '随访观察', risk: 0.35, color: '#f59e0b' },
];

function splitSentences(text: string): { text: string; confidence: number }[] {
  const sentences = text.split(/(?<=[。！？；\n])/).filter(s => s.trim().length > 0);
  return sentences.map(s => ({
    text: s,
    confidence: +(0.75 + Math.random() * 0.24).toFixed(2),
  }));
}

function generateDraftVersions(base: AiDraftResult): AiDraftResult[] {
  const variants = [
    { findings: base.findings.replace('18mm × 15mm', '18mm×15mm').replace('周围型肺癌', '肺腺癌'), impression: base.impression.replace('周围型肺癌', '肺腺癌') },
    { findings: base.findings + '\n建议定期随访复查。', impression: base.impression.replace('可能性大', '待排') },
  ];
  return [
    base,
    ...variants.map((v, i) => ({
      ...base,
      id: `${base.id}-v${i + 2}`,
      findings: v.findings,
      impression: v.impression,
      confidence: +(base.confidence - 0.05 * (i + 1)).toFixed(2),
    })),
  ];
}

export const AIDraftPanel: React.FC<Props> = ({
  reportId, clinicalInfo, modality, bodyPart, onAccept, disabled = false,
}) => {
  const [stage, setStage] = useState<AiDraftStage>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AiDraftResult | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [includePrior, setIncludePrior] = useState(true);
  const [style, setStyle] = useState<'concise' | 'detailed' | 'structured'>('structured');
  const [showRefine, setShowRefine] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [activeTab, setActiveTab] = useState('draft');
  const [selectedModel, setSelectedModel] = useState('肺结节AI');
  const [sentenceConfidence, setSentenceConfidence] = useState<{ findings: { text: string; confidence: number }[]; impression: { text: string; confidence: number }[] } | null>(null);
  const [draftVersions, setDraftVersions] = useState<AiDraftResult[]>([]);
  const [sentenceActions, setSentenceActions] = useState<Record<string, 'accepted' | 'rejected' | null>>({});
  const [editingSentence, setEditingSentence] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeVersion, setActiveVersion] = useState(0);

  const handleGenerate = useCallback(async () => {
    if (disabled || !clinicalInfo.trim()) {
      message.warning('请先填写临床信息');
      return;
    }
    setStage('analyzing');
    setProgress(20);
    await new Promise((r) => setTimeout(r, 500));
    setStage('drafting');
    setProgress(60);
    const req: AiDraftRequest = {
      reportId, modality, bodyPart, clinicalInfo,
      templates: includePrior ? ['tpl-chest-ct-v2'] : [],
      includeImages, style, language: 'zh-CN',
    };
    try {
      const dr = await generateAiDraft(req);
      setProgress(100);
      setStage('ready');
      setResult(dr);
      setSentenceConfidence({
        findings: splitSentences(dr.findings),
        impression: splitSentences(dr.impression),
      });
      setDraftVersions(generateDraftVersions(dr));
      setActiveVersion(0);
      setSentenceActions({});
      message.success('AI 草稿已生成');
    } catch {
      setStage('error');
      message.error('AI 草稿生成失败');
    }
  }, [reportId, clinicalInfo, modality, bodyPart, includeImages, includePrior, style, disabled]);

  const handleAccept = useCallback(() => {
    if (!result) return;
    onAccept?.(result);
    message.success('已应用 AI 草稿到编辑器');
  }, [result, onAccept]);

  const handleRefine = useCallback(async () => {
    if (!result || !refineText.trim()) {
      message.warning('请输入修改意见');
      return;
    }
    setStage('analyzing');
    setProgress(40);
    await new Promise((r) => setTimeout(r, 800));
    const updated = { ...result, findings: result.findings + '\n\n[根据反馈调整] ' + refineText };
    setResult(updated);
    setSentenceConfidence({
      findings: splitSentences(updated.findings),
      impression: splitSentences(updated.impression),
    });
    setSentenceActions({});
    setStage('ready');
    setProgress(100);
    setShowRefine(false);
    setRefineText('');
    message.success('已根据反馈重写');
  }, [result, refineText]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  }, []);

  const handleAcceptSentence = useCallback((key: string) => {
    setSentenceActions(prev => ({ ...prev, [key]: 'accepted' }));
    message.success('已接受此句');
  }, []);

  const handleRejectSentence = useCallback((key: string) => {
    setSentenceActions(prev => ({ ...prev, [key]: 'rejected' }));
    message.success('已拒绝此句');
  }, []);

  const handleEditSentence = useCallback((text: string) => {
    setEditingSentence(text);
    setEditValue(text);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingSentence || !sentenceConfidence) return;
    const updateText = (arr: { text: string; confidence: number }[]): { text: string; confidence: number }[] =>
      arr.map(s => s.text === editingSentence ? { ...s, text: editValue } : s);
    setSentenceConfidence({
      findings: updateText(sentenceConfidence.findings),
      impression: updateText(sentenceConfidence.impression),
    });
    setEditingSentence(null);
    setEditValue('');
    message.success('句子已修改');
  }, [editingSentence, editValue, sentenceConfidence]);

  const handleSelectVersion = useCallback((index: number) => {
    setActiveVersion(index);
    if (draftVersions[index]) {
      const v = draftVersions[index];
      setResult(v);
      setSentenceConfidence({
        findings: splitSentences(v.findings),
        impression: splitSentences(v.impression),
      });
      setSentenceActions({});
    }
    message.success(`已切换到版本 ${index + 1}`);
  }, [draftVersions]);
  const stageLabel = ({ idle: '就绪', analyzing: '分析中', drafting: '撰写中', ready: '已完成', merging: '合并中', error: '失败' } as const)[stage];

  const renderConfidenceBar = (confidence: number) => (
    <Tooltip title={`置信度: ${(confidence * 100).toFixed(0)}%`}>
      <Progress
        percent={Math.round(confidence * 100)}
        size="small"
        strokeColor={confidence > 0.9 ? '#10b981' : confidence > 0.8 ? '#f59e0b' : '#dc2626'}
        style={{ width: 60, display: 'inline-block', verticalAlign: 'middle' }}
        format={() => ''}
      />
    </Tooltip>
  );

  const renderSentences = (sentences: { text: string; confidence: number }[], prefix: string) => (
    <div className="space-y-1">
      {sentences.map((s, i) => {
        const key = `${prefix}-${i}`;
        const action = sentenceActions[key];
        if (action === 'rejected') return null;
        return (
          <div key={key} className={`flex items-start gap-2 p-1 rounded ${action === 'accepted' ? 'bg-green-50' : ''} ${editingSentence === s.text ? 'bg-blue-50' : ''}`}>
            {editingSentence === s.text ? (
              <div className="flex-1 space-y-1">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full text-sm p-1 border border-blue-200 rounded"
                  rows={2}
                />
                <Space size="small">
                  <Button size="small" type="primary" onClick={handleSaveEdit}>保存</Button>
                  <Button size="small" onClick={() => setEditingSentence(null)}>取消</Button>
                </Space>
              </div>
            ) : (
              <>
                <span className="text-sm text-slate-700 flex-1 whitespace-pre-wrap">{s.text}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {renderConfidenceBar(s.confidence)}
                  <Tooltip title="接受">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 cursor-pointer" onClick={() => handleAcceptSentence(key)} />
                  </Tooltip>
                  <Tooltip title="编辑">
                    <Edit3 className="w-3.5 h-3.5 text-blue-600 cursor-pointer" onClick={() => handleEditSentence(s.text)} />
                  </Tooltip>
                  <Tooltip title="拒绝">
                    <span className="text-red-500 cursor-pointer text-xs font-bold leading-none" onClick={() => handleRejectSentence(key)}>✕</span>
                  </Tooltip>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderDDX = () => (
    <div className="space-y-2">
      <Alert type="info" showIcon title="AI 鉴别诊断建议，仅供参考" />
      {MOCK_DDX.map((d, i) => (
        <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
          <div className="flex-1">
            <div className="text-sm font-medium">{d.diagnosis}</div>
            <div className="text-xs text-slate-500">{d.details}</div>
          </div>
          <Progress
            type="circle"
            percent={Math.round(d.probability * 100)}
            size={40}
            strokeColor={d.probability > 0.5 ? '#dc2626' : d.probability > 0.1 ? '#f59e0b' : '#10b981'}
            format={(p) => `${p}%`}
          />
        </div>
      ))}
    </div>
  );

  const renderRisk = () => (
    <div className="space-y-3">
      <div className="text-center p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded">
        <div className="text-xs text-slate-500">综合风险评分</div>
        <div className="text-3xl font-bold" style={{ color: MOCK_RISK.overallRisk > 0.7 ? '#dc2626' : MOCK_RISK.overallRisk > 0.4 ? '#f59e0b' : '#10b981' }}>
          {(MOCK_RISK.overallRisk * 100).toFixed(0)}
        </div>
        <Tag color={MOCK_RISK.overallRisk > 0.7 ? 'red' : MOCK_RISK.overallRisk > 0.4 ? 'orange' : 'green'}>
          {MOCK_RISK.overallRisk > 0.7 ? '高风险' : MOCK_RISK.overallRisk > 0.4 ? '中风险' : '低风险'}
        </Tag>
      </div>
      {MOCK_RISK.categories.map((c, i) => (
        <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
          <div className="flex-1">
            <div className="text-sm">{c.name}</div>
            <Progress percent={Math.round(c.score * 100)} size="small" strokeColor={c.color} />
          </div>
          <Tag color={c.level === 'high' ? 'red' : c.level === 'medium' ? 'orange' : 'green'}>
            {c.level === 'high' ? '高' : c.level === 'medium' ? '中' : '低'}
          </Tag>
        </div>
      ))}
    </div>
  );

  const renderPreread = () => (
    <div className="space-y-2">
      <Alert type="warning" showIcon title="AI 预读标注，标注可疑区域供医师重点关注" />
      {MOCK_PREREAD.map((p, i) => (
        <div key={i} className="p-2 border-l-4 rounded" style={{ borderLeftColor: p.color }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{p.region}</span>
            <Tag color={p.suspicion === '高度可疑' ? 'red' : p.suspicion === '相关征象' || p.suspicion === '随访观察' ? 'orange' : 'green'}>{p.suspicion}</Tag>
          </div>
          <div className="text-xs text-slate-500">{p.finding}</div>
          <Progress percent={Math.round(p.risk * 100)} size="small" strokeColor={p.color} format={() => `风险 ${(p.risk * 100).toFixed(0)}%`} />
        </div>
      ))}
    </div>
  );

  const renderDraftComparison = () => {
    if (draftVersions.length === 0) return null;
    return (
      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="text-xs font-semibold text-slate-600 mb-2">多版本对比 ({draftVersions.length} 个版本)</div>
        <Row gutter={8}>
          {draftVersions.map((v, i) => (
            <Col span={8} key={v.id}>
              <Card
                size="small"
                className={i === activeVersion ? 'border-purple-400' : ''}
                title={<span className="text-xs">版本 {i + 1}</span>}
                extra={<Tag color={i === 0 ? 'blue' : 'purple'}>{(v.confidence * 100).toFixed(0)}%</Tag>}
              >
                <div className="text-xs whitespace-pre-wrap text-slate-700 max-h-32 overflow-y-auto">{v.findings.slice(0, 120)}...</div>
                <Button size="small" type={i === activeVersion ? 'primary' : 'default'} className="mt-1" onClick={() => handleSelectVersion(i)}>
                  {i === activeVersion ? '当前' : '选择'}
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  const tabItems = [
    {
      key: 'draft',
      label: '草稿',
      children: (
        <>
          {result && (
            <>
              <Alert
                type="warning"
                showIcon
                icon={<AlertCircle className="w-4 h-4" />}
                message="AI 草稿仅供临床参考,最终诊断须由执业医师确认"
                description={result.warnings.join('; ')}
              />

              <Row gutter={8}>
                <Col span={8}><Statistic title="字数" value={result.findings.length + result.impression.length} prefix={<FileText className="w-3 h-3" />} /></Col>
                <Col span={8}><Statistic title="Token" value={result.tokens.input + result.tokens.output} prefix={<Cpu className="w-3 h-3" />} /></Col>
                <Col span={8}><Statistic title="费用" value={result.tokens.cost} prefix={<Activity className="w-3 h-3" />} precision={3} suffix="¥" /></Col>
              </Row>

              <Card size="small" title={<span className="text-sm font-semibold">影像所见</span>} extra={<Button size="small" type="text" icon={<Copy className="w-3 h-3" />} onClick={() => copyToClipboard(result.findings)}>复制</Button>}>
                {sentenceConfidence ? renderSentences(sentenceConfidence.findings, 'findings') : (
                  <div className="text-sm whitespace-pre-wrap text-slate-700 max-h-48 overflow-y-auto">{result.findings}</div>
                )}
              </Card>

              <Card size="small" title={<span className="text-sm font-semibold">诊断意见</span>} extra={<Button size="small" type="text" icon={<Copy className="w-3 h-3" />} onClick={() => copyToClipboard(result.impression)}>复制</Button>}>
                {sentenceConfidence ? renderSentences(sentenceConfidence.impression, 'impression') : (
                  <div className="text-sm whitespace-pre-wrap text-slate-700 max-h-32 overflow-y-auto">{result.impression}</div>
                )}
              </Card>

              <Card size="small" title={<span className="text-sm font-semibold">建议</span>}>
                <div className="text-sm text-slate-700">{result.recommendation}</div>
              </Card>

              {showRefine ? (
                <div className="space-y-2 p-2 bg-blue-50 rounded">
                  <div className="text-xs font-semibold text-blue-700">🔧 修改意见(将基于此重写)</div>
                  <textarea
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    placeholder="例:补充说明胸膜牵拉征;删除'不除外...'"
                    className="w-full text-sm p-2 border border-blue-200 rounded"
                    rows={3}
                  />
                  <Space>
                    <Button size="small" type="primary" onClick={handleRefine}>应用</Button>
                    <Button size="small" onClick={() => setShowRefine(false)}>取消</Button>
                  </Space>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button type="primary" icon={<CheckCircle2 className="w-4 h-4" />} onClick={handleAccept}>应用到编辑器</Button>
                  <Button icon={<Edit3 className="w-4 h-4" />} onClick={() => setShowRefine(true)}>反馈调整</Button>
                  <Button icon={<Eye className="w-4 h-4" />}>对比原片</Button>
                </div>
              )}

              <div className="text-xs text-slate-400 text-center">
                基于 {result.basedOnReports.length} 份历史报告 · 模型 {result.modelVersion} · {new Date(result.generatedAt).toLocaleString()}
              </div>

              {renderDraftComparison()}
            </>
          )}
        </>
      ),
    },
    {
      key: 'ddx',
      label: '鉴别诊断',
      children: result ? renderDDX() : <div className="text-sm text-slate-400 text-center py-8">请先生成草稿</div>,
    },
    {
      key: 'risk',
      label: '风险预测',
      children: result ? renderRisk() : <div className="text-sm text-slate-400 text-center py-8">请先生成草稿</div>,
    },
    {
      key: 'preread',
      label: '预读',
      children: result ? renderPreread() : <div className="text-sm text-slate-400 text-center py-8">请先生成草稿</div>,
    },
  ];

  return (
    <Card
      size="small"
      className="shadow-sm border-purple-200"
      title={
        <div className="flex items-center justify-between">
          <Space>
            <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
            <span className="font-semibold">AI 智能草稿</span>
            <Tag color="purple">MedAI v3.2.1</Tag>
            <Tag color={stage === 'ready' ? 'green' : stage === 'error' ? 'red' : 'blue'}>{stageLabel}</Tag>
          </Space>
          {result && (
            <Tag color="blue" icon={<Cpu className="w-3 h-3" />}>
              置信度 {(result.confidence * 100).toFixed(0)}%
            </Tag>
          )}
        </div>
      }
      extra={
        <Space>
          {!result && (
            <Button type="primary" icon={<Wand2 className="w-4 h-4" />} onClick={handleGenerate} disabled={disabled || stage === 'analyzing' || stage === 'drafting'} loading={stage === 'analyzing' || stage === 'drafting'}>
              生成草稿
            </Button>
          )}
          {result && (
            <Button icon={<RefreshCw className="w-4 h-4" />} onClick={handleGenerate} loading={stage !== 'idle'}>
              重新生成
            </Button>
          )}
        </Space>
      }
    >
      <div className="mb-3">
        <Space>
          <span className="text-xs text-slate-600">AI模型:</span>
          <Select
            size="small"
            value={selectedModel}
            onChange={(val) => {
              setSelectedModel(val);
              message.info(`已切换至 ${val}`);
            }}
            style={{ width: 160 }}
            options={MODEL_OPTIONS.map(m => ({ value: m.value, label: m.label }))}
          />
        </Space>
      </div>

      {!result && (
        <>
          <div className="space-y-3 p-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">风格</span>
              <Select
                size="small"
                value={style}
                onChange={setStyle}
                style={{ width: 130 }}
                options={STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">包含图像分析</span>
              <Switch size="small" checked={includeImages} onChange={setIncludeImages} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">引用历史报告</span>
              <Switch size="small" checked={includePrior} onChange={setIncludePrior} />
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
              <div>📋 <span className="font-medium">临床信息:</span> {clinicalInfo}</div>
              <div>🩻 <span className="font-medium">检查:</span> {modality} - {bodyPart}</div>
            </div>
          </div>

          {(stage === 'analyzing' || stage === 'drafting') && (
            <div className="pt-3 space-y-2">
              <Progress percent={progress} strokeColor={{ from: '#7c3aed', to: '#3b82f6' }} />
              <div className="text-xs text-slate-500 text-center">
                {stage === 'analyzing' ? '正在分析临床信息与影像...' : '正在撰写报告内容...'}
              </div>
            </div>
          )}

          {PRIOR_REPORTS_MOCK.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                <History className="w-3 h-3" />参考历史报告 ({PRIOR_REPORTS_MOCK.length})
              </h5>
              <div className="space-y-1">
                {PRIOR_REPORTS_MOCK.map((r) => (
                  <div key={r.id} className="text-xs p-1.5 bg-slate-50 rounded">
                    <Tag color="cyan">{r.reportId}</Tag>
                    {new Date(r.studyDate).toLocaleDateString()} · {r.impression}
                  </div>
                ))}
              </div>
            </div>
          )}

          {SIMILAR_CASES_MOCK.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                <Brain className="w-3 h-3" />相似病例 ({SIMILAR_CASES_MOCK.length})
              </h5>
              <div className="space-y-1">
                {SIMILAR_CASES_MOCK.map((c) => (
                  <div key={c.id} className="text-xs p-1.5 bg-slate-50 rounded flex items-center justify-between">
                    <span><Tag color="orange">{c.reportId}</Tag>{c.impression}</span>
                    <Tag color="purple">{(c.similarityScore * 100).toFixed(0)}%</Tag>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {result && (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
      )}
    </Card>
  );
};

export default AIDraftPanel;

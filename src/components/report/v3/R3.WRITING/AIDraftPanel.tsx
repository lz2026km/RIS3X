/**
 * G005 放射RIS系统 v3.0.5.1 - AI 草稿 Panel(mock)
 * R3.WRITING 组 C:智能辅助(部分)
 * 30 升级点:AI 草稿生成 / 多模态输入 / 风格 / 历史参考 / 续写 / 合并 / 警告
 * Expanded: confidence scoring, tabs (draft/ddx/risk/preread), model selector, multi-draft comparison
 * [v3.0.6.11-100 Wave 3A (G-19)] 深化: LLM 多模型 (mock/deepseek/hunyuan) + RAG 增强 + 信心分 + 来源列表 + 结构化字段生成
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Card, Space, Button, Tag, Statistic, Alert, Switch, Select, Tooltip, message, Progress, Row, Col, Tabs, Modal } from 'antd';
import { Sparkles, RefreshCw, Wand2, FileText, AlertCircle, History, Brain, CheckCircle2, Copy, Edit3, Zap, Activity, Eye, Cpu, ListOrdered, Database, LayoutList, ChevronDown, ChevronRight } from 'lucide-react';
import { SIMILAR_CASES_MOCK, PRIOR_REPORTS_MOCK } from '@data/reportWritingMock';
import { generateAiDraft } from '@services/writing/writingService';
import { aiDraftApi, type LlmProviderId, type LlmProviderInfo, type AiDraftRagSource, type AiDraftRagContext, type AiDraftStructuredResult } from '@services/api/aiDraftApi';
import type { AiDraftRequest, AiDraftResult, AiDraftStage } from '@/types/R3/R3.WRITING';
import { t } from '../../../../i18n/appI18n';

interface Props {
  reportId: string;
  clinicalInfo: string;
  modality: string;
  bodyPart: string;
  onAccept?: (result: AiDraftResult) => void;
  onRefine?: (result: AiDraftResult, feedback: string) => void;
  onApplyStructured?: (sections: { heading: string; content: string }[]) => void;
  disabled?: boolean;
}

const STYLE_OPTIONS = [
  { value: 'concise', label: t('aiDraft.style.concise'), icon: Zap, color: '#3b82f6' },
  { value: 'detailed', label: t('aiDraft.style.detailed'), icon: FileText, color: '#7c3aed' },
  { value: 'structured', label: t('aiDraft.style.structured'), icon: ListOrdered, color: '#10b981' },
];

const MODEL_OPTIONS = [
  { value: '肺结节AI', label: '肺结节AI (M001)', modelId: 'model-M001' },
  { value: '乳腺AI', label: '乳腺AI (M002)', modelId: 'model-M002' },
  { value: '骨折AI', label: '骨折AI (M003)', modelId: 'model-M003' },
  { value: '胸片AI', label: '胸片AI (M004)', modelId: 'model-M004' },
  { value: '脑卒中AI', label: '脑卒中AI (M005)', modelId: 'model-M005' },
];

// [v3.0.6.11-100 Wave 3A (G-19)] 默认 LLM 提供方 (接口不可用时兜底)
const FALLBACK_PROVIDERS: LlmProviderInfo[] = [
  { id: 'mock', name: '确定性模板引擎', model: 'mock-nlg-1.0', kind: 'template', available: true, apiKeyConfigured: false, description: '本地模板 NLG, 确定性生成' },
  { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat', kind: 'llm', available: false, apiKeyConfigured: false, description: '需 DEEPSEEK_API_KEY' },
  { id: 'hunyuan', name: '腾讯混元', model: 'hunyuan-turbo', kind: 'llm', available: false, apiKeyConfigured: false, description: '需 HUNYUAN_API_KEY' },
];

const PROVIDER_LABEL: Record<LlmProviderId, string> = { mock: t('aiDraft.provider.mock'), deepseek: 'DeepSeek', hunyuan: t('aiDraft.provider.hunyuan') };

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
  reportId, clinicalInfo, modality, bodyPart, onAccept, onApplyStructured, disabled = false,
}) => {
  const [stage, setStage] = useState<AiDraftStage>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AiDraftResult | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [includePrior, setIncludePrior] = useState(true);
  // [v3.0.6.11-100 Wave 3A (G-19)] RAG 增强开关
  const [includeRag, setIncludeRag] = useState(true);
  const [style, setStyle] = useState<'concise' | 'detailed' | 'structured'>('structured');
  const [showRefine, setShowRefine] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [activeTab, setActiveTab] = useState('draft');
  const [selectedModel, setSelectedModel] = useState('肺结节AI');
  // [v3.0.6.11-100 Wave 3A (G-19)] LLM 提供方 (从 /ai-draft/providers 加载)
  const [providers, setProviders] = useState<LlmProviderInfo[]>(FALLBACK_PROVIDERS);
  const [selectedProvider, setSelectedProvider] = useState<LlmProviderId>('mock');
  const [ragContext, setRagContext] = useState<AiDraftRagContext | null>(null);
  const [ragSources, setRagSources] = useState<AiDraftRagSource[]>([]);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [structuredLoading, setStructuredLoading] = useState(false);
  const [structuredResult, setStructuredResult] = useState<AiDraftStructuredResult | null>(null);
  const [sentenceConfidence, setSentenceConfidence] = useState<{ findings: { text: string; confidence: number }[]; impression: { text: string; confidence: number }[] } | null>(null);
  const [draftVersions, setDraftVersions] = useState<AiDraftResult[]>([]);
  const [sentenceActions, setSentenceActions] = useState<Record<string, 'accepted' | 'rejected' | null>>({});
  const [editingSentence, setEditingSentence] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [activeVersion, setActiveVersion] = useState(0);
  // [v3.0.6.11-98 Wave3B P1] 对比原片: 当前检查无影像数据透出 → 对比面板 + 标注 (影像数据待 DICOM 通道)
  const [compareOpen, setCompareOpen] = useState(false);

  // [v3.0.6.11-100 Wave 3A (G-19)] 加载可用模型列表 (失败回退默认列表)
  useEffect(() => {
    let cancelled = false;
    aiDraftApi.listProviders().then((res) => {
      if (cancelled || !res.success) return;
      const list = Array.isArray(res.data) ? res.data : FALLBACK_PROVIDERS;
      setProviders(list);
      const mock = list.find((p) => p.id === 'mock') ?? list[0];
      if (mock) setSelectedProvider(mock.id);
    }).catch(() => { /* 回退默认列表 */ });
    return () => { cancelled = true; };
  }, []);

  // [v3.0.6.11-100 Wave 3A (G-19)] 生成: 优先 /ai-draft/generate-advanced (LLM 多模型 + RAG),
  //   失败回退本地模板生成 (generateAiDraft)
  const handleGenerate = useCallback(async () => {
    if (disabled || !clinicalInfo.trim()) {
      message.warning(t('aiDraft.msg.enterClinicalInfo'));
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
      let dr: AiDraftResult;
      try {
        const advanced = await aiDraftApi.generateAdvanced({ reportId, provider: selectedProvider, includeRag });
        if (advanced.success && advanced.data) {
          const a = advanced.data;
          const sections = Array.isArray(a.sections) ? a.sections : [];
          const pick = (keys: string[]) => sections.find((s) => keys.some((k) => (s?.heading ?? '').includes(k)))?.content ?? '';
          setRagSources(a.sources ?? []);
          dr = {
            id: a.id ?? `draft-${Date.now()}`,
            findings: pick(['影像所见', '所见']) || a.draftText,
            impression: pick(['影像诊断', '诊断意见', '意见']) || pick(['印象']),
            recommendation: pick(['建议']),
            confidence: a.confidenceScore ?? 0.9,
            modelVersion: `${a.provider} (${a.modelVersion})`,
            basedOnReports: (a.sources ?? []).map((s) => s.reportId),
            tokens: { input: (a.sources?.length ?? 0) * 300, output: 600, cost: 0.01 },
            warnings: a.fallbackToMock ? ['所选模型未配置 API Key, 已回退确定性模板生成'] : [],
            generatedAt: new Date(a.createdAt ?? Date.now()).toISOString(),
            styles: [style],
          } as AiDraftResult;
        } else {
          throw new Error(t('aiDraft.err.advancedFailed'));
        }
      } catch {
        dr = await generateAiDraft(req);
        setRagSources([]);
      }
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
      message.success(t('aiDraft.msg.draftReady'));
    } catch {
      setStage('error');
      message.error(t('aiDraft.msg.draftFailed'));
    }
  }, [reportId, clinicalInfo, modality, bodyPart, includeImages, includePrior, includeRag, style, selectedProvider, disabled]);

  const handleAccept = useCallback(() => {
    if (!result) return;
    onAccept?.(result);
    message.success(t('aiDraft.msg.appliedToEditor'));
  }, [result, onAccept]);

  // [v3.0.6.11-100 Wave 3A (G-19)] 加载 RAG 上下文 (既往报告摘要 + 匹配术语)
  const handleLoadRagContext = useCallback(async () => {
    if (!reportId) return;
    try {
      const res = await aiDraftApi.getRagContext(reportId);
      if (res.success && res.data) {
        setRagContext(res.data);
        message.success(t('aiDraft.rag.loaded', { reports: res.data.priorReports.length, terms: res.data.matchedTerms.length }));
      } else {
        message.warning(t('aiDraft.rag.notFound'));
      }
    } catch {
      message.warning(t('aiDraft.rag.loadFailed'));
    }
  }, [reportId]);

  // [v3.0.6.11-100 Wave 3A (G-19)] 生成结构化字段 → 预填编辑器对应段落
  const handleGenerateStructured = useCallback(async () => {
    if (!reportId) {
      message.warning(t('aiDraft.structured.missingReportId'));
      return;
    }
    setStructuredLoading(true);
    try {
      const res = await aiDraftApi.generateStructured(reportId);
      if (res.success && res.data) {
        setStructuredResult(res.data);
        onApplyStructured?.(res.data.sections ?? []);
        message.success(t('aiDraft.structured.generatedWithScore', { score: Math.round((res.data.confidenceScore ?? 0.9) * 100) }));
      } else {
        message.warning(t('w9e.aiDraftPanel.structFieldsFailed', { msg: res.error?.message ?? t('w9e.aiDraftPanel.unknownError') }));
      }
    } catch {
      message.error(t('aiDraft.structured.failedNetwork'));
    } finally {
      setStructuredLoading(false);
    }
  }, [reportId, onApplyStructured]);

  const handleRefine = useCallback(async () => {
    if (!result || !refineText.trim()) {
      message.warning(t('aiDraft.msg.enterRefine'));
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
    message.success(t('aiDraft.msg.refined'));
  }, [result, refineText]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    message.success(t('aiDraft.msg.copied'));
  }, []);

  const handleAcceptSentence = useCallback((key: string) => {
    setSentenceActions(prev => ({ ...prev, [key]: 'accepted' }));
    message.success(t('aiDraft.msg.sentenceAccepted'));
  }, []);

  const handleRejectSentence = useCallback((key: string) => {
    setSentenceActions(prev => ({ ...prev, [key]: 'rejected' }));
    message.success(t('aiDraft.msg.sentenceRejected'));
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
    message.success(t('aiDraft.msg.sentenceEdited'));
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
    message.success(t('aiDraft.msg.switchedVersion', { version: index + 1 }));
  }, [draftVersions]);
  const stageLabel = ({ idle: t('aiDraft.stage.idle'), analyzing: t('aiDraft.stage.analyzing'), drafting: t('aiDraft.stage.drafting'), ready: t('aiDraft.stage.ready'), merging: t('aiDraft.stage.merging'), error: t('aiDraft.stage.error') } as Record<string, string>)[stage] ?? '';

  const renderConfidenceBar = (confidence: number) => (
    <Tooltip title={t('aiDraft.confidenceTooltip', { value: (confidence * 100).toFixed(0) })}>
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
                  <Button size="small" type="primary" onClick={handleSaveEdit}>{t('aiDraft.save')}</Button>
                  <Button size="small" onClick={() => setEditingSentence(null)}>{t('aiDraft.cancel')}</Button>
                </Space>
              </div>
            ) : (
              <>
                <span className="text-sm text-slate-700 flex-1 whitespace-pre-wrap">{s.text}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {renderConfidenceBar(s.confidence)}
                  <Tooltip title={t('aiDraft.sentence.accept')}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 cursor-pointer" onClick={() => handleAcceptSentence(key)} />
                  </Tooltip>
                  <Tooltip title={t('aiDraft.sentence.edit')}>
                    <Edit3 className="w-3.5 h-3.5 text-blue-600 cursor-pointer" onClick={() => handleEditSentence(s.text)} />
                  </Tooltip>
                  <Tooltip title={t('aiDraft.sentence.reject')}>
                    <span className="text-red-500 cursor-pointer text-xs font-bold leading-none" onClick={() => handleRejectSentence(key)}></span>
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
      <Alert type="info" showIcon title={t('aiDraft.ddx.disclaimer')} />
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
        <div className="text-xs text-slate-500">{t('aiDraft.risk.overallScore')}</div>
        <div className="text-3xl font-bold" style={{ color: MOCK_RISK.overallRisk > 0.7 ? '#dc2626' : MOCK_RISK.overallRisk > 0.4 ? '#f59e0b' : '#10b981' }}>
          {(MOCK_RISK.overallRisk * 100).toFixed(0)}
        </div>
        <Tag color={MOCK_RISK.overallRisk > 0.7 ? 'red' : MOCK_RISK.overallRisk > 0.4 ? 'orange' : 'green'}>
          {MOCK_RISK.overallRisk > 0.7 ? t('aiDraft.risk.high') : MOCK_RISK.overallRisk > 0.4 ? t('aiDraft.risk.medium') : t('aiDraft.risk.low')}
        </Tag>
      </div>
      {MOCK_RISK.categories.map((c, i) => (
        <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
          <div className="flex-1">
            <div className="text-sm">{c.name}</div>
            <Progress percent={Math.round(c.score * 100)} size="small" strokeColor={c.color} />
          </div>
          <Tag color={c.level === 'high' ? 'red' : c.level === 'medium' ? 'orange' : 'green'}>
            {c.level === 'high' ? t('aiDraft.level.high') : c.level === 'medium' ? t('aiDraft.level.medium') : t('aiDraft.level.low')}
          </Tag>
        </div>
      ))}
    </div>
  );

  const renderPreread = () => (
    <div className="space-y-2">
      <Alert type="warning" showIcon title={t('aiDraft.preread.disclaimer')} />
      {MOCK_PREREAD.map((p, i) => (
        <div key={i} className="p-2 border-l-4 rounded" style={{ borderLeftColor: p.color }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{p.region}</span>
            <Tag color={p.suspicion === '高度可疑' ? 'red' : p.suspicion === '相关征象' || p.suspicion === '随访观察' ? 'orange' : 'green'}>{p.suspicion}</Tag>
          </div>
          <div className="text-xs text-slate-500">{p.finding}</div>
          <Progress percent={Math.round(p.risk * 100)} size="small" strokeColor={p.color} format={() => `${t('aiDraft.preread.risk')} ${(p.risk * 100).toFixed(0)}%`} />
        </div>
      ))}
    </div>
  );

  const renderDraftComparison = () => {
    if (draftVersions.length === 0) return null;
    return (
      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="text-xs font-semibold text-slate-600 mb-2">{t('aiDraft.compare.title', { count: draftVersions.length })}</div>
        <Row gutter={8}>
          {draftVersions.map((v, i) => (
            <Col span={8} key={v.id}>
              <Card
                size="small"
                className={i === activeVersion ? 'border-purple-400' : ''}
                title={<span className="text-xs">{t('aiDraft.compare.version', { version: i + 1 })}</span>}
                extra={<Tag color={i === 0 ? 'blue' : 'purple'}>{(v.confidence * 100).toFixed(0)}%</Tag>}
              >
                <div className="text-xs whitespace-pre-wrap text-slate-700 max-h-32 overflow-y-auto">{v.findings.slice(0, 120)}...</div>
                <Button size="small" type={i === activeVersion ? 'primary' : 'default'} className="mt-1" onClick={() => handleSelectVersion(i)}>
                  {i === activeVersion ? t('aiDraft.compare.current') : t('aiDraft.compare.select')}
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
      label: t('aiDraft.tab.draft'),
      children: (
        <>
          {result && (
            <>
              <Alert
                type="warning"
                showIcon
                icon={<AlertCircle className="w-4 h-4" />}
                message={t('aiDraft.draftDisclaimer')}
                description={result.warnings.join('; ')}
              />

              <Row gutter={8}>
                <Col span={8}><Statistic title={t('aiDraft.stat.words')} value={result.findings.length + result.impression.length} prefix={<FileText className="w-3 h-3" />} /></Col>
                <Col span={8}><Statistic title={t('aiDraft.stat.tokens')} value={result.tokens.input + result.tokens.output} prefix={<Cpu className="w-3 h-3" />} /></Col>
                <Col span={8}><Statistic title={t('aiDraft.stat.cost')} value={result.tokens.cost} prefix={<Activity className="w-3 h-3" />} precision={3} suffix="¥" /></Col>
              </Row>

              {/* [v3.0.6.11-100 Wave 3A (G-19)] 生成信心分 + 提供方 + RAG 标注 */}
              <div className="flex items-center gap-2 p-2 bg-purple-50/60 rounded">
                <span className="text-xs text-slate-600 shrink-0">{t('aiDraft.generationConfidence')}</span>
                <Progress
                  percent={Math.round((result.confidence ?? 0.9) * 100)}
                  size="small"
                  style={{ flex: 1, marginBottom: 0 }}
                  strokeColor={(result.confidence ?? 0.9) > 0.9 ? '#10b981' : (result.confidence ?? 0.9) > 0.8 ? '#f59e0b' : '#dc2626'}
                />
                <Tag color="purple">{(result.confidence ?? 0.9) * 100 > 90 ? t('aiDraft.level.high') : (result.confidence ?? 0.9) * 100 > 80 ? t('aiDraft.level.medium') : t('aiDraft.level.low')} {(Math.round((result.confidence ?? 0.9) * 100))}%</Tag>
                <Tag color="blue">{result.modelVersion}</Tag>
                {ragSources.length > 0 && <Tag color="cyan" icon={<Database className="w-3 h-3" />}>RAG {ragSources.length} {t('aiDraft.rag.sources')}</Tag>}
                {Array.isArray(result.warnings) && result.warnings.length > 0 && <Tag color="orange">{result.warnings[0]}</Tag>}
              </div>

              <Card size="small" title={<span className="text-sm font-semibold">{t('aiDraft.section.findings')}</span>} extra={<Button size="small" type="text" icon={<Copy className="w-3 h-3" />} onClick={() => copyToClipboard(result.findings)}>{t('aiDraft.copy')}</Button>}>
                {sentenceConfidence ? renderSentences(sentenceConfidence.findings, 'findings') : (
                  <div className="text-sm whitespace-pre-wrap text-slate-700 max-h-48 overflow-y-auto">{result.findings}</div>
                )}
              </Card>

              <Card size="small" title={<span className="text-sm font-semibold">{t('aiDraft.section.impression')}</span>} extra={<Button size="small" type="text" icon={<Copy className="w-3 h-3" />} onClick={() => copyToClipboard(result.impression)}>{t('aiDraft.copy')}</Button>}>
                {sentenceConfidence ? renderSentences(sentenceConfidence.impression, 'impression') : (
                  <div className="text-sm whitespace-pre-wrap text-slate-700 max-h-32 overflow-y-auto">{result.impression}</div>
                )}
              </Card>

              <Card size="small" title={<span className="text-sm font-semibold">{t('aiDraft.section.recommendation')}</span>}>
                <div className="text-sm text-slate-700">{result.recommendation}</div>
              </Card>

              {/* [v3.0.6.11-100 Wave 3A (G-19)] RAG 来源列表 (点击展开摘要片段) */}
              {ragSources.length > 0 && (
                <Card size="small" title={<span className="text-sm font-semibold flex items-center gap-1"><Database className="w-3 h-3 text-cyan-600" />RAG {t('aiDraft.rag.referenceSources')} ({ragSources.length})</span>}>
                  <div className="space-y-1">
                    {ragSources.map((s) => (
                      <div key={s.reportId} className="border border-slate-100 rounded p-1.5">
                        <div
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => setExpandedSource(expandedSource === s.reportId ? null : s.reportId)}
                        >
                          {expandedSource === s.reportId ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                          <Tag color="cyan">{s.reportId}</Tag>
                          <span className="text-xs text-slate-400">{s.date}</span>
                          <span className="text-[10px] text-slate-400 ml-auto">{t('aiDraft.rag.click')}{expandedSource === s.reportId ? t('aiDraft.rag.collapse') : t('aiDraft.rag.expand')}{t('aiDraft.rag.segment')}</span>
                        </div>
                        {expandedSource === s.reportId && (
                          <div className="mt-1 pl-5 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2">
                            {s.snippet}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* [v3.0.6.11-100 Wave 3A (G-19)] RAG 匹配术语 */}
              {ragContext && ragContext.matchedTerms.length > 0 && (
                <div className="text-xs text-slate-400">
                  {t('aiDraft.rag.matchedTerms')} {ragContext.matchedTerms.map((term) => <Tag key={term.code} color="geekblue" className="text-[10px]">{term.term} · {term.code.replace('SNOMED-CT:', '')}</Tag>)}
                </div>
              )}

              {showRefine ? (
                <div className="space-y-2 p-2 bg-blue-50 rounded">
                  <div className="text-xs font-semibold text-blue-700">{t('aiDraft.refine.title')}</div>
                  <textarea
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    placeholder={t('aiDraft.refine.placeholder')}
                    className="w-full text-sm p-2 border border-blue-200 rounded"
                    rows={3}
                  />
                  <Space>
                    <Button size="small" type="primary" onClick={handleRefine}>{t('aiDraft.apply')}</Button>
                    <Button size="small" onClick={() => setShowRefine(false)}>{t('aiDraft.cancel')}</Button>
                  </Space>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button type="primary" icon={<CheckCircle2 className="w-4 h-4" />} onClick={handleAccept}>{t('aiDraft.applyToEditor')}</Button>
                  <Button icon={<Edit3 className="w-4 h-4" />} onClick={() => setShowRefine(true)}>{t('aiDraft.feedback')}</Button>
                  <Button icon={<Eye className="w-4 h-4" />} onClick={() => setCompareOpen(true)}>{t('aiDraft.compare')}</Button>
                </div>
              )}

              <div className="text-xs text-slate-400 text-center">
                {t('aiDraft.basedOn', { count: result.basedOnReports.length, model: result.modelVersion })} · {new Date(result.generatedAt).toLocaleString()}
              </div>

              {renderDraftComparison()}
            </>
          )}
        </>
      ),
    },
    {
      key: 'ddx',
      label: t('aiDraft.tab.ddx'),
      children: result ? renderDDX() : <div className="text-sm text-slate-400 text-center py-8">{t('aiDraft.generateFirst')}</div>,
    },
    {
      key: 'risk',
      label: t('aiDraft.tab.risk'),
      children: result ? renderRisk() : <div className="text-sm text-slate-400 text-center py-8">{t('aiDraft.generateFirst')}</div>,
    },
    {
      key: 'preread',
      label: t('aiDraft.tab.preread'),
      children: result ? renderPreread() : <div className="text-sm text-slate-400 text-center py-8">{t('aiDraft.generateFirst')}</div>,
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
            <span className="font-semibold">{t('aiDraft.smartDraft')}</span>
            <Tag color="purple">MedAI v3.2.1</Tag>
            <Tag color={stage === 'ready' ? 'green' : stage === 'error' ? 'red' : 'blue'}>{stageLabel}</Tag>
          </Space>
          {result && (
            <Tag color="blue" icon={<Cpu className="w-3 h-3" />}>
              {t('aiDraft.confidenceLabel')} {(result.confidence * 100).toFixed(0)}%
            </Tag>
          )}
        </div>
      }
      extra={
        <Space>
          {!result && (
            <Button type="primary" icon={<Wand2 className="w-4 h-4" />} onClick={handleGenerate} disabled={disabled || stage === 'analyzing' || stage === 'drafting'} loading={stage === 'analyzing' || stage === 'drafting'}>
              {t('aiDraft.generateDraft')}
            </Button>
          )}
          {result && (
            <Button icon={<RefreshCw className="w-4 h-4" />} onClick={handleGenerate} loading={stage !== 'idle'}>
              {t('aiDraft.regenerate')}
            </Button>
          )}
        </Space>
      }
    >
      <div className="mb-3">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space>
            <span className="text-xs text-slate-600">{t('aiDraft.aiModel')}</span>
            <Select
              size="small"
              value={selectedModel}
              onChange={(val) => {
                setSelectedModel(val);
                message.info(t('aiDraft.msg.switchedModel', { model: val }));
              }}
              style={{ width: 160 }}
              options={MODEL_OPTIONS.map(m => ({ value: m.value, label: m.label }))}
            />
            {/* [v3.0.6.11-100 Wave 3A (G-19)] LLM 提供方 (mock/deepseek/hunyuan, 从 /ai-draft/providers 加载) */}
            <span className="text-xs text-slate-600">{t('aiDraft.llmProvider')}</span>
            <Select
              size="small"
              value={selectedProvider}
              onChange={(val) => {
                setSelectedProvider(val);
                message.info(t('aiDraft.msg.switchedProvider', { provider: PROVIDER_LABEL[val] }));
              }}
              style={{ width: 150 }}
              options={providers.map((p) => ({
                value: p.id,
                label: `${p.name}${p.available ? '' : ` ${t('aiDraft.notConfigured')}`}`,
                disabled: !p.available && p.id !== selectedProvider,
              }))}
            />
          </Space>
          {providers.find((p) => p.id === selectedProvider)?.description && (
            <div className="text-[10px] text-slate-400">
              {providers.find((p) => p.id === selectedProvider)?.description}
            </div>
          )}
          {!result && (
            <Space>
              <Button
                size="small"
                icon={<Database className="w-3 h-3" />}
                onClick={handleLoadRagContext}
              >
                {ragContext ? t('aiDraft.rag.contextLoaded', { reports: ragContext.priorReports.length, terms: ragContext.matchedTerms.length }) : t('aiDraft.rag.loadContext')}
              </Button>
              <Button
                size="small"
                type="dashed"
                icon={<LayoutList className="w-3 h-3" />}
                onClick={handleGenerateStructured}
                loading={structuredLoading}
              >
                {t('aiDraft.structured.generate')}
              </Button>
            </Space>
          )}
          {structuredResult && (
            <Alert
              type="success"
              showIcon
              style={{ fontSize: 11 }}
              message={
                <span>
                  {t('aiDraft.structured.generated')} {structuredResult.sections.map((s) => s.heading).join(' / ')} · {t('aiDraft.structured.confidenceScore')} {Math.round((structuredResult.confidenceScore ?? 0.9) * 100)}% · {t('aiDraft.structured.prefilled')}
                </span>
              }
            />
          )}
        </Space>
      </div>

      {!result && (
        <>
          <div className="space-y-3 p-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{t('aiDraft.style.label')}</span>
              <Select
                size="small"
                value={style}
                onChange={setStyle}
                style={{ width: 130 }}
                options={STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{t('aiDraft.includeImages')}</span>
              <Switch size="small" checked={includeImages} onChange={setIncludeImages} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{t('aiDraft.includePrior')}</span>
              <Switch size="small" checked={includePrior} onChange={setIncludePrior} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">
                {t('aiDraft.rag.enhance')}
                <Tooltip title={t('aiDraft.rag.enhanceTip')}>
                  <AlertCircle className="w-3 h-3 text-slate-400 ml-1 inline-block" />
                </Tooltip>
              </span>
              <Switch size="small" checked={includeRag} onChange={setIncludeRag} />
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
              <div><span className="font-medium">{t('aiDraft.clinicalInfo')}</span> {clinicalInfo}</div>
              <div><span className="font-medium">{t('aiDraft.exam')}</span> {modality} - {bodyPart}</div>
            </div>
          </div>

          {(stage === 'analyzing' || stage === 'drafting') && (
            <div className="pt-3 space-y-2">
              <Progress percent={progress} strokeColor={{ from: '#7c3aed', to: '#3b82f6' }} />
              <div className="text-xs text-slate-500 text-center">
                {stage === 'analyzing' ? t('aiDraft.stage.analyzingText') : t('aiDraft.stage.draftingText')}
              </div>
            </div>
          )}

          {PRIOR_REPORTS_MOCK.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                <History className="w-3 h-3" />{t('aiDraft.priorReports', { count: PRIOR_REPORTS_MOCK.length })}
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
                <Brain className="w-3 h-3" />{t('aiDraft.similarCases', { count: SIMILAR_CASES_MOCK.length })}
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

      {/* [v3.0.6.11-98 Wave3B P1] 对比原片 Modal: 原片影像数据未透出 → 标注待 DICOM 通道 */}
      <Modal
        title={<Space><Eye className="w-4 h-4 text-blue-500" /><span>{t('aiDraft.compareModal.title')}</span></Space>}
        open={compareOpen}
        onCancel={() => setCompareOpen(false)}
        footer={<Button onClick={() => setCompareOpen(false)}>{t('aiDraft.close')}</Button>}
        width={720}
      >
        {result && (
          <Row gutter={12}>
            <Col span={12}>
              <Card size="small" title={<span className="text-sm font-semibold">{t('aiDraft.compareModal.original')}</span>} styles={{ body: { padding: 12 } }}>
                <div style={{
                  height: 240, borderRadius: 8,
                  background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: '#94a3b8', fontSize: 12, gap: 8,
                }}>
                  <div style={{ fontSize: 30, opacity: 0.6 }}></div>
                  <div>{modality} · {bodyPart}</div>
                  <div style={{ fontSize: 11 }}>{t('aiDraft.compareModal.report')} {reportId}</div>
                  <Alert type="warning" showIcon style={{ fontSize: 11, maxWidth: 220 }} message={t('aiDraft.compareModal.noImage')} />
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={<span className="text-sm font-semibold">{t('aiDraft.compareModal.draftFindings')}</span>} styles={{ body: { padding: 12 } }}>
                <div style={{ height: 240, overflowY: 'auto', fontSize: 12, lineHeight: 1.9, color: '#334155', whiteSpace: 'pre-wrap' }}>
                  {result.findings || t('aiDraft.none')}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0', color: '#7c3aed', fontWeight: 600 }}>
                    {t('aiDraft.compareModal.impression')}{result.impression}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Modal>
    </Card>
  );
};

export default AIDraftPanel;

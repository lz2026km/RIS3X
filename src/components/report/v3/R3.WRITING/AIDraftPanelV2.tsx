/**
 * G005 RIS v3.0.6.11-101 Wave 7A (F1) — AI 报告助理 V2 面板
 * 1) 结构化字段提取: 字段标签 + 置信度 + 内联编辑 (调用 /ai-draft-v2/extract-fields)
 * 2) 多模态草稿生成: 一键生成 + 段落选择 + 溯源标注 (来源 hover 展示)
 * 3) 修改建议: 采纳/忽略 (调用 /ai-draft-v2/suggest)
 * 接口不可用时自动回退本地确定性引擎 (标注"演示回退"), 与后端规则保持一致语义。
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Card, Space, Button, Tag, Tooltip, Progress, Alert, message, Input, Checkbox, Popover, Empty, Divider } from 'antd';
import { Sparkles, Wand2, ScanSearch, ListChecks, CheckCircle2, XCircle, Edit3, Database, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  aiDraftV2Api,
  FIELD_CATEGORY_LABEL,
  type ExtractedField,
  type ExtractFieldsResult,
  type DraftSegment,
  type GenerateDraftV2Result,
  type DraftSuggestion,
  type SuggestResult,
  type TraceSource,
  type FieldCategory,
} from '@services/api/aiDraftV2Api';
import { t } from '../../../../i18n/appI18n';

interface Props {
  reportId?: string;
  patientId?: string;
  examId?: string;
  modality: string;
  bodyPart: string;
  clinicalInfo?: string;
  /** 影像所见文本 (来自编辑器, 可编辑后重新提取) */
  findingsText?: string;
  /** 应用所选草稿段落 */
  onApplyDraft?: (segments: DraftSegment[]) => void;
  /** 字段编辑保存后的回调 */
  onApplyFieldValue?: (field: ExtractedField) => void;
  disabled?: boolean;
}

const SOURCE_KIND_LABEL: Record<TraceSource['kind'], string> = {
  template: t('aiDraft.source.template'),
  rule: t('aiDraft.source.rule'),
  field: t('aiDraft.source.field'),
  clinicalHistory: t('aiDraft.source.clinicalHistory'),
  seed: 'seed',
};

const SOURCE_KIND_COLOR: Record<TraceSource['kind'], string> = {
  template: 'blue',
  rule: 'purple',
  field: 'green',
  clinicalHistory: 'orange',
  seed: 'default',
};

const SEVERITY_COLOR: Record<DraftSuggestion['severity'], string> = {
  info: 'blue',
  warning: 'orange',
  critical: 'red',
};

const FIELD_CATEGORY_COLOR: Record<FieldCategory, string> = {
  bodyPart: 'geekblue',
  finding: 'volcano',
  measurement: 'cyan',
  comparison: 'purple',
  conclusion: 'green',
};

const LOCAL_VERSION = 'local-fallback-v1';

// ────────────────────────────────────────────────────────────────────────────
// 本地确定性回退引擎 (接口不可用时使用, 规则与后端一致)
// ────────────────────────────────────────────────────────────────────────────

function localHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function localConfidence(seed: string, min: number, max: number): number {
  const h = localHash(seed);
  return Math.round((min + (h / 0xffffffff) * (max - min)) * 1000) / 1000;
}

const LOCAL_BODY_PARTS = ['右肺上叶', '左肺上叶', '右肺下叶', '左肺下叶', '右肺中叶', '双肺', '肝脏', '胆囊', '胰腺', '脾脏', '双肾', '甲状腺', '乳腺', '颅骨', '脊柱', '椎间盘', '股骨颈', '桡骨', '胫骨', '腓骨', '脑'];
const LOCAL_FINDING_TERMS = ['磨玻璃影', '占位性病变', '骨质破坏', '骨折线', '胸腔积液', '未见明显异常', '肿大淋巴结', '实变影', '结节', '肿块', '钙化', '狭窄', '囊肿', '出血'];

function localExtract(findings: string): ExtractedField[] {
  const text = (findings ?? '').trim();
  if (!text) return [];
  const fields: ExtractedField[] = [];
  for (const part of LOCAL_BODY_PARTS) {
    const idx = text.indexOf(part);
    if (idx >= 0) {
      fields.push({
        id: `fld-local-bp-${localHash(part).toString(16).slice(0, 8)}`,
        category: 'bodyPart',
        label: part,
        value: part,
        confidence: localConfidence(`bp:${part}`, 0.9, 0.96),
        source: 'dictionary',
        ruleId: 'local:bodyPart',
        evidence: part,
        start: idx,
        end: idx + part.length,
      });
      break;
    }
  }
  for (const term of LOCAL_FINDING_TERMS) {
    const idx = text.indexOf(term);
    if (idx >= 0) {
      fields.push({
        id: `fld-local-f-${localHash(term).toString(16).slice(0, 8)}`,
        category: 'finding',
        label: term,
        value: term,
        confidence: localConfidence(`f:${term}`, 0.88, 0.95),
        source: 'dictionary',
        ruleId: 'local:finding',
        evidence: term,
        start: idx,
        end: idx + term.length,
      });
    }
  }
  const sizeMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:mm|cm)?\s*[×xX]\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|cm)/);
  if (sizeMatch) {
    const start = sizeMatch.index ?? 0;
    fields.push({
      id: `fld-local-m1-${localHash(text).toString(16).slice(0, 8)}`,
      category: 'measurement',
      label: '病灶尺寸',
      value: `${sizeMatch[1]}×${sizeMatch[2]}${sizeMatch[3] ?? ''}`,
      confidence: localConfidence(`m1:${text}`, 0.93, 0.97),
      source: 'rule',
      ruleId: 'local:measurement:size-axb',
      evidence: sizeMatch[0],
      start,
      end: start + sizeMatch[0].length,
    });
  }
  const singleMatch = text.match(/(?:约|为)?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|HU)\b(?!\s*[×xX])/);
  if (singleMatch) {
    fields.push({
      id: `fld-local-m2-${localHash(`m2:${text}`).toString(16).slice(0, 8)}`,
      category: 'measurement',
      label: '测量值',
      value: `${singleMatch[1]}${singleMatch[2] ?? ''}`,
      confidence: localConfidence(`m2:${text}`, 0.9, 0.94),
      source: 'rule',
      ruleId: 'local:measurement:single',
      evidence: singleMatch[0],
      start: 0,
      end: 0,
    });
  }
  const cmpMatch = text.match(/与(?:前片|前次|既往|上次)(?:检查)?相比([^。；，,\n]{0,16})?/);
  if (cmpMatch) {
    fields.push({
      id: `fld-local-cmp-${localHash(text).toString(16).slice(0, 8)}`,
      category: 'comparison',
      label: '前后对比',
      value: `与既往相比${cmpMatch[1] ?? ''}`.trim(),
      confidence: localConfidence(`cmp:${text}`, 0.91, 0.95),
      source: 'rule',
      ruleId: 'local:comparison:with-prior',
      evidence: cmpMatch[0],
      start: 0,
      end: 0,
    });
  }
  const conclMatch = text.match(/(?:考虑|提示|符合|诊断)(?:为)?[：:]?([^。；\n]{2,40})/);
  if (conclMatch) {
    fields.push({
      id: `fld-local-c-${localHash(text).toString(16).slice(0, 8)}`,
      category: 'conclusion',
      label: '诊断意见',
      value: `考虑${conclMatch[1]}`,
      confidence: localConfidence(`c:${text}`, 0.88, 0.93),
      source: 'rule',
      ruleId: 'local:conclusion:diagnosis-cue',
      evidence: conclMatch[0],
      start: 0,
      end: 0,
    });
  } else if (text.includes('未见明显异常')) {
    fields.push({
      id: `fld-local-neg-${localHash(text).toString(16).slice(0, 8)}`,
      category: 'conclusion',
      label: '阴性结论',
      value: '未见明显异常',
      confidence: 0.92,
      source: 'rule',
      ruleId: 'local:conclusion:negative',
      evidence: '未见明显异常',
      start: text.indexOf('未见明显异常'),
      end: text.indexOf('未见明显异常') + 6,
    });
  }
  return fields;
}

function localGenerate(params: { modality: string; bodyPart: string; findings?: string; clinicalHistory?: string }): GenerateDraftV2Result {
  const { modality, bodyPart, findings, clinicalHistory } = params;
  const techniqueMap: Record<string, string> = {
    CT: `${bodyPart}CT平扫+增强扫描`,
    MR: `${bodyPart}MRI平扫 (T1WI/T2WI/FLAIR)`,
    DR: `${bodyPart}正侧位片`,
    US: `${bodyPart}超声检查`,
  };
  const technique = techniqueMap[modality] ?? `${modality} ${bodyPart}检查`;
  const fields = localExtract(findings ?? '');
  const hasPositive = fields.some((f) => f.category === 'finding' && f.value !== '未见明显异常');
  const seed = `${modality}:${bodyPart}:${findings ?? ''}`;
  const segments: DraftSegment[] = [
    {
      id: 'seg-local-0',
      paragraphType: 'technique',
      heading: '检查技术',
      content: technique,
      confidence: 0.96,
      sources: [{ kind: 'template', refId: 'local:tpl', description: `本地模板: ${modality} · ${bodyPart}`, confidence: 0.96 }],
    },
  ];
  if (clinicalHistory && clinicalHistory.trim()) {
    segments.push({
      id: 'seg-local-1',
      paragraphType: 'clinicalHistory',
      heading: '临床病史',
      content: clinicalHistory.trim(),
      confidence: 0.95,
      sources: [{ kind: 'clinicalHistory', refId: 'local:history', description: '临床病史原始输入', confidence: 0.95 }],
    });
  }
  let findingsContent = findings && findings.trim() ? findings.trim() : `${bodyPart}未见明显异常密度影及占位性病变，边界清晰，形态规则。`;
  const size = fields.find((f) => f.category === 'measurement' && f.ruleId === 'local:measurement:size-axb');
  if (size) findingsContent += `病灶大小约${size.value}。`;
  const cmp = fields.find((f) => f.category === 'comparison');
  if (cmp) findingsContent += `${cmp.value}。`;
  const fieldSources: TraceSource[] = fields
    .filter((f) => f.category === 'finding' || f.category === 'measurement' || f.category === 'bodyPart' || f.category === 'comparison')
    .map((f) => ({ kind: 'field' as const, refId: f.id, description: `字段[${f.label}]: ${f.value}`, confidence: f.confidence }));
  segments.push({
    id: 'seg-local-2',
    paragraphType: 'findings',
    heading: '影像所见',
    content: findingsContent,
    confidence: localConfidence(`findings:${seed}`, 0.86, 0.93),
    sources: [
      { kind: 'template', refId: 'local:tpl', description: `所见模板: ${modality}`, confidence: 0.9 },
      ...fieldSources,
    ],
  });
  const conclusionField = fields.find((f) => f.category === 'conclusion');
  const conclusionContent = conclusionField ? conclusionField.value : hasPositive ? `${bodyPart}所见阳性征象，建议结合临床随访复查。` : `${bodyPart}未见明显异常。`;
  segments.push({
    id: 'seg-local-3',
    paragraphType: 'conclusion',
    heading: '诊断意见',
    content: conclusionContent,
    confidence: conclusionField ? conclusionField.confidence : localConfidence(`conclusion:${seed}`, 0.88, 0.93),
    sources: conclusionField
      ? [{ kind: 'field', refId: conclusionField.id, description: `结论字段: ${conclusionField.value}`, confidence: conclusionField.confidence }]
      : [{ kind: 'rule', refId: hasPositive ? 'local:rule:positive-followup' : 'local:rule:negative-conclusion', description: '规则: 征象极性 → 结论', confidence: 0.9 }],
  });
  segments.push({
    id: 'seg-local-4',
    paragraphType: 'recommendation',
    heading: '建议',
    content: hasPositive ? '建议定期随访复查，必要时进一步检查明确。' : '建议定期随访观察。',
    confidence: 0.9,
    sources: [{ kind: 'rule', refId: 'local:rule:recommendation', description: '规则: 阳性征象 → 随访建议', confidence: 0.9 }],
  });
  const overallConfidence = Math.round((segments.reduce((s, seg) => s + seg.confidence, 0) / segments.length) * 1000) / 1000;
  return {
    id: `draft-local-${localHash(seed).toString(16).slice(0, 10)}`,
    segments,
    overallConfidence,
    modelVersion: LOCAL_VERSION,
    generatedAt: new Date().toISOString(),
    simulated: true,
  };
}

function localSuggest(paragraphs: Array<{ heading: string; content: string }>): SuggestResult {
  const suggestions: DraftSuggestion[] = [];
  const push = (s: Omit<DraftSuggestion, 'id' | 'confidence'>) => {
    suggestions.push({ ...s, id: `sug-local-${localHash(s.ruleId).toString(16).slice(0, 8)}`, confidence: localConfidence(s.ruleId, 0.86, 0.95) });
  };
  if (paragraphs.length === 0) {
    push({ paragraphIndex: 0, paragraphHeading: '(整篇)', severity: 'critical', title: '报告内容为空', description: '请先填写影像所见与诊断意见后再提交。', ruleId: 'local:suggest:empty-report' });
    return { suggestions, overallScore: 0, modelVersion: LOCAL_VERSION, generatedAt: new Date().toISOString() };
  }
  const text = paragraphs.map((p) => `${p.heading}${p.content}`).join('');
  if (!paragraphs.some((p) => /所见|影像表现/.test(p.heading))) {
    push({ paragraphIndex: -1, paragraphHeading: '(缺失)', severity: 'warning', title: '缺少「影像所见」段落', description: '报告应包含影像所见，请补充完整后再提交。', ruleId: 'local:suggest:missing-findings' });
  }
  if (!paragraphs.some((p) => /诊断|意见|结论/.test(p.heading))) {
    push({ paragraphIndex: -1, paragraphHeading: '(缺失)', severity: 'critical', title: '缺少「诊断意见」段落', description: '报告应包含诊断意见，请补充完整后再提交。', ruleId: 'local:suggest:missing-conclusion' });
  }
  const findingsText = paragraphs.find((p) => /所见/.test(p.heading))?.content ?? '';
  const conclusionText = paragraphs.find((p) => /诊断|意见|结论/.test(p.heading))?.content ?? '';
  const hasPositive = /(结节|肿块|磨玻璃|实变|占位|骨折|积液|钙化|结石|狭窄|囊肿)/.test(findingsText);
  if (hasPositive && /未见明显异常/.test(conclusionText)) {
    push({ paragraphIndex: Math.max(0, paragraphs.findIndex((p) => /诊断|意见|结论/.test(p.heading))), paragraphHeading: '诊断意见', severity: 'critical', title: '影像所见与诊断意见不一致', description: '影像所见描述阳性征象，但诊断意见为"未见明显异常"，请核对修正。', suggestedText: '请结合所见阳性征象重写诊断意见（如"所见符合…，建议…"）。', ruleId: 'local:suggest:impression-conflict' });
  }
  if (hasPositive && !/(建议|随访|复查|随诊)/.test(text)) {
    push({ paragraphIndex: paragraphs.length - 1, paragraphHeading: paragraphs[paragraphs.length - 1]?.heading ?? '', severity: 'warning', title: '阳性征象缺少随访建议', description: '检测到阳性征象描述，建议补充随访或复查建议。', suggestedText: '建议定期随访复查，必要时进一步检查明确。', ruleId: 'local:suggest:no-recommendation' });
  }
  if (/(不除外|可能|待排)/.test(conclusionText)) {
    push({ paragraphIndex: Math.max(0, paragraphs.findIndex((p) => /诊断|意见|结论/.test(p.heading))), paragraphHeading: '诊断意见', severity: 'info', title: '诊断意见存在不确定措辞', description: '检测到"不除外/可能/待排"等措辞，建议明确诊断倾向或注明随访观察。', ruleId: 'local:suggest:hedge' });
  }
  const score = Math.max(0, 100 - suggestions.reduce((s, su) => s + (su.severity === 'critical' ? 25 : su.severity === 'warning' ? 12 : 5), 0));
  return { suggestions, overallScore: score, modelVersion: LOCAL_VERSION, generatedAt: new Date().toISOString() };
}

// ────────────────────────────────────────────────────────────────────────────
// 面板组件
// ────────────────────────────────────────────────────────────────────────────

export const AIDraftPanelV2: React.FC<Props> = ({
  reportId, patientId, examId, modality, bodyPart, clinicalInfo, findingsText,
  onApplyDraft, onApplyFieldValue, disabled = false,
}) => {
  const [findings, setFindings] = useState(findingsText ?? '');
  const [extractResult, setExtractResult] = useState<ExtractFieldsResult | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draftResult, setDraftResult] = useState<GenerateDraftV2Result | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());
  const [suggestResult, setSuggestResult] = useState<SuggestResult | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestionActions, setSuggestionActions] = useState<Record<string, 'adopted' | 'ignored'>>({});
  const [dataSource, setDataSource] = useState<'api' | 'local'>('api');

  useEffect(() => {
    if (findingsText !== undefined) setFindings(findingsText);
  }, [findingsText]);

  const handleExtract = useCallback(async () => {
    if (disabled) return;
    if (!findings.trim()) {
      message.warning(t('aiDraft.msg.enterFindings'));
      return;
    }
    setExtractLoading(true);
    try {
      const res = await aiDraftV2Api.extractFields({ findings, modality, bodyPart, reportId });
      if (res.success && res.data) {
        setExtractResult(res.data);
        setDataSource('api');
        message.success(t('aiDraft.msg.extracted', { count: res.data.fields.length }));
        return;
      }
      throw new Error(res.error?.message ?? t('aiDraft.err.apiFailed'));
    } catch {
      const local: ExtractFieldsResult = {
        fields: localExtract(findings),
        categoriesFound: [],
        overallConfidence: 0,
        modelVersion: LOCAL_VERSION,
        generatedAt: new Date().toISOString(),
        simulated: true,
      };
      local.categoriesFound = Array.from(new Set(local.fields.map((f) => f.category)));
      local.overallConfidence = local.fields.length
        ? Math.round((local.fields.reduce((s, f) => s + f.confidence, 0) / local.fields.length) * 1000) / 1000
        : 0;
      setExtractResult(local);
      setDataSource('local');
      message.warning(t('aiDraft.msg.extractFallback'));
    } finally {
      setExtractLoading(false);
    }
  }, [findings, modality, bodyPart, reportId, disabled]);

  const handleSaveFieldEdit = useCallback((field: ExtractedField) => {
    if (!extractResult || !editingFieldId) return;
    setExtractResult({
      ...extractResult,
      fields: extractResult.fields.map((f) => (f.id === editingFieldId ? { ...f, value: editValue || f.value } : f)),
    });
    onApplyFieldValue?.({ ...field, value: editValue || field.value });
    setEditingFieldId(null);
    setEditValue('');
    message.success(t('aiDraft.msg.fieldUpdated'));
  }, [extractResult, editingFieldId, editValue, onApplyFieldValue]);

  const handleGenerate = useCallback(async () => {
    if (disabled) return;
    setDraftLoading(true);
    try {
      const res = await aiDraftV2Api.generate({
        patientId: patientId ?? reportId ?? 'P-UNKNOWN',
        examId: examId ?? reportId ?? 'EXAM-UNKNOWN',
        modality,
        bodyPart,
        findings,
        clinicalHistory: clinicalInfo,
      });
      if (res.success && res.data) {
        setDraftResult(res.data);
        setSelectedSegments(new Set(res.data.segments.map((s) => s.id)));
        setDataSource('api');
        message.success(t('aiDraft.msg.draftGenerated'));
        return;
      }
      throw new Error(res.error?.message ?? t('aiDraft.err.apiFailed'));
    } catch {
      const local = localGenerate({ modality, bodyPart, findings, clinicalHistory: clinicalInfo });
      setDraftResult(local);
      setSelectedSegments(new Set(local.segments.map((s) => s.id)));
      setDataSource('local');
      message.warning(t('aiDraft.msg.generateFallback'));
    } finally {
      setDraftLoading(false);
    }
  }, [patientId, reportId, examId, modality, bodyPart, findings, clinicalInfo, disabled]);

  const toggleSegment = useCallback((id: string) => {
    setSelectedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleApplyDraft = useCallback(() => {
    if (!draftResult) return;
    const picked = draftResult.segments.filter((s) => selectedSegments.has(s.id));
    if (picked.length === 0) {
      message.warning(t('aiDraft.msg.selectSegment'));
      return;
    }
    onApplyDraft?.(picked);
    message.success(t('aiDraft.msg.appliedSegments', { count: picked.length }));
  }, [draftResult, selectedSegments, onApplyDraft]);

  const handleSuggest = useCallback(async () => {
    if (disabled) return;
    setSuggestLoading(true);
    const paragraphs = draftResult?.segments.map((s) => ({ heading: s.heading, content: s.content })) ?? (findings.trim() ? [{ heading: '影像所见', content: findings }] : []);
    try {
      const res = await aiDraftV2Api.suggest({ paragraphs, modality, bodyPart });
      if (res.success && res.data) {
        setSuggestResult(res.data);
        setSuggestionActions({});
        setDataSource('api');
        message.success(t('aiDraft.msg.suggestDone', { count: res.data.suggestions.length }));
        return;
      }
      throw new Error(res.error?.message ?? t('aiDraft.err.apiFailed'));
    } catch {
      const local = localSuggest(paragraphs);
      setSuggestResult(local);
      setSuggestionActions({});
      setDataSource('local');
      message.warning(t('aiDraft.msg.suggestFallback'));
    } finally {
      setSuggestLoading(false);
    }
  }, [draftResult, findings, modality, bodyPart, disabled]);

  const handleAdoptSuggestion = useCallback((s: DraftSuggestion) => {
    setSuggestionActions((prev) => ({ ...prev, [s.id]: 'adopted' }));
    if (s.suggestedText && s.paragraphHeading && !s.paragraphHeading.startsWith('(')) {
      onApplyDraft?.([{
        id: `seg-sug-${s.id.slice(-8)}`,
        paragraphType: 'conclusion',
        heading: s.paragraphHeading,
        content: s.suggestedText,
        confidence: s.confidence,
        sources: [{ kind: 'rule', refId: s.ruleId, description: `修改建议: ${s.title}`, confidence: s.confidence }],
      }]);
    }
    message.success(t('aiDraft.msg.adopted'));
  }, [onApplyDraft]);

  const handleIgnoreSuggestion = useCallback((id: string) => {
    setSuggestionActions((prev) => ({ ...prev, [id]: 'ignored' }));
    message.info(t('aiDraft.msg.ignored'));
  }, []);

  const resetAll = useCallback(() => {
    setExtractResult(null);
    setDraftResult(null);
    setSuggestResult(null);
    setSuggestionActions({});
    setSelectedSegments(new Set());
    message.info(t('aiDraft.msg.reset'));
  }, []);

  const renderSourceContent = (sources: TraceSource[]) => (
    <div className="space-y-1" style={{ maxWidth: 320, fontSize: 11 }}>
      <div className="font-semibold mb-1" style={{ color: '#475569' }}>{t('aiDraft.traceTitle', { count: sources.length })}</div>
      {sources.map((src, i) => (
        <div key={`${src.refId}-${i}`} className="flex items-start gap-1.5" style={{ lineHeight: 1.5 }}>
          <Tag color={SOURCE_KIND_COLOR[src.kind]} style={{ marginRight: 'var(--space-1, 4px)' }}>{SOURCE_KIND_LABEL[src.kind]}</Tag>
          <div className="flex-1 min-w-0">
            <div className="text-slate-700 truncate" title={src.description}>{src.description}</div>
            <div className="text-slate-400">refId: {src.refId} · {t('aiDraft.traceConfidence')} {(src.confidence * 100).toFixed(0)}%</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderFieldEdit = (field: ExtractedField) => (
    <div className="space-y-1.5">
      <Input
        size="small"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        placeholder={t('aiDraft.fieldValuePlaceholder')}
      />
      <Space size={4}>
        <Button size="small" type="primary" onClick={() => handleSaveFieldEdit(field)}>{t('aiDraft.save')}</Button>
        <Button size="small" onClick={() => { setEditingFieldId(null); setEditValue(''); }}>{t('aiDraft.cancel')}</Button>
      </Space>
    </div>
  );

  const renderExtractSection = () => (
    <Card
      size="small"
      className="shadow-none"
      title={<Space size={6}><ScanSearch size={14} color="#4f46e5" /><span className="text-sm font-semibold">{t('aiDraft.extract.title')}</span><Tag color="geekblue">{t('aiDraft.extract.tag')}</Tag></Space>}
      extra={extractResult ? <Tag color="green">{(extractResult.overallConfidence * 100).toFixed(0)}% {t('aiDraft.extract.overallConfidence')}</Tag> : undefined}
      styles={{ body: { padding: 'var(--space-3, 12px)' } }}
    >
      <Space.Compact style={{ width: '100%', marginBottom: 'var(--space-2, 8px)' }}>
        <Input.TextArea
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder={t('aiDraft.extract.placeholder')}
          autoSize={{ minRows: 3, maxRows: 6 }}
          disabled={disabled}
        />
      </Space.Compact>
      <Space>
        <Button type="primary" size="small" icon={<Wand2 size={13} />} onClick={handleExtract} loading={extractLoading} disabled={disabled}>
          {t('aiDraft.extract.autoExtract')}
        </Button>
        {extractResult && extractResult.fields.length > 0 && (
          <span className="text-[10px] text-slate-400">
            {t('aiDraft.extract.categories')} {extractResult.categoriesFound.map((c) => FIELD_CATEGORY_LABEL[c]).join(' / ')}
          </span>
        )}
      </Space>
      {extractResult && (
        <div className="mt-3">
          {extractResult.fields.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('aiDraft.extract.empty')} style={{ margin: '8px 0' }} />
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {extractResult.fields.map((f) => (
                <div key={f.id} className="border border-slate-100 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Tag color={FIELD_CATEGORY_COLOR[f.category]} style={{ marginRight: 'var(--space-1, 4px)', fontSize: 10 }}>{f.label}</Tag>
                    <Tag className="text-[9px]" color={f.source === 'dictionary' ? 'default' : 'purple'}>{f.source === 'dictionary' ? t('aiDraft.fieldSource.dictionary') : t('aiDraft.fieldSource.rule')}</Tag>
                    {editingFieldId === f.id ? null : (
                      <Tooltip title={t('aiDraft.field.editTip')}>
                        <Edit3 size={12} className="ml-auto text-slate-400 cursor-pointer" onClick={() => { setEditingFieldId(f.id); setEditValue(f.value); }} />
                      </Tooltip>
                    )}
                  </div>
                  {editingFieldId === f.id ? renderFieldEdit(f) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700 flex-1 truncate" title={f.value}>{f.value}</span>
                      <Tooltip title={t('aiDraft.field.traceTip', { ruleId: f.ruleId, source: f.source })}>
                        <Progress
                          percent={Math.round(f.confidence * 100)}
                          size="small"
                          strokeColor={f.confidence > 0.92 ? '#10b981' : f.confidence > 0.85 ? 'var(--color-warning-500)' : 'var(--color-error-600)'}
                          style={{ width: 48, marginBottom: 0 }}
                          format={() => ''}
                        />
                      </Tooltip>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{(f.confidence * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );

  const renderDraftSection = () => (
    <Card
      size="small"
      className="shadow-none"
      title={<Space size={6}><FileText size={14} color="#7c3aed" /><span className="text-sm font-semibold">{t('aiDraft.draft.title')}</span><Tag color="purple">{t('aiDraft.draft.tag')}</Tag></Space>}
      extra={
        draftResult ? (
          <Space size={4}>
            <Tag color={draftResult.simulated ? 'orange' : 'green'}>{(draftResult.overallConfidence * 100).toFixed(0)}% {t('aiDraft.draft.confidence')}</Tag>
            <Tag className="text-[10px]">{draftResult.modelVersion}</Tag>
          </Space>
        ) : undefined
      }
      styles={{ body: { padding: 'var(--space-3, 12px)' } }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Button type="primary" size="small" icon={<Wand2 size={13} />} onClick={handleGenerate} loading={draftLoading} disabled={disabled}>
          {t('aiDraft.draft.generate')}
        </Button>
        <span className="text-xs text-slate-500">{modality} · {bodyPart}{clinicalInfo ? ` · ${clinicalInfo}` : ''}</span>
        {draftResult?.simulated && <Tag color="orange" className="text-[10px]" title={t('aiDraft.draft.fallbackTip')}>{t('aiDraft.demoFallback')}</Tag>}
      </div>
      {draftResult && draftResult.segments.length === 0 && <Empty description={t('aiDraft.draft.noSegments')} />}
      {draftResult && draftResult.segments.length > 0 && (
        <>
          <div className="space-y-1.5 mb-2">
            {draftResult.segments.map((seg, i) => (
              <div key={seg.id} className="border border-slate-100 rounded p-2">
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox
                    checked={selectedSegments.has(seg.id)}
                    onChange={() => toggleSegment(seg.id)}
                    disabled={disabled}
                  />
                  <span className="text-xs font-semibold text-slate-700">{i + 1}. {seg.heading}</span>
                  <Tooltip title={t('aiDraft.draft.segmentConfidence', { value: (seg.confidence * 100).toFixed(0) })}>
                    <Progress
                      percent={Math.round(seg.confidence * 100)}
                      size="small"
                      strokeColor={seg.confidence > 0.9 ? '#10b981' : seg.confidence > 0.8 ? 'var(--color-warning-500)' : 'var(--color-error-600)'}
                      style={{ width: 70, marginBottom: 0 }}
                      format={() => ''}
                    />
                  </Tooltip>
                  <Popover content={renderSourceContent(seg.sources)} title={null} trigger="hover" placement="right">
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-indigo-500 cursor-pointer hover:text-indigo-700">
                      <Database size={11} />{t('aiDraft.draft.trace')} {seg.sources.length}
                    </span>
                  </Popover>
                </div>
                <div className="text-xs text-slate-600 whitespace-pre-wrap pl-6">{seg.content}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <Button type="primary" size="small" icon={<CheckCircle2 size={13} />} onClick={handleApplyDraft} disabled={disabled}>
              {t('aiDraft.draft.applySelected', { count: selectedSegments.size })}
            </Button>
            <span className="text-[10px] text-slate-400">{t('aiDraft.draft.hint')}</span>
          </div>
        </>
      )}
    </Card>
  );

  const renderSuggestSection = () => (
    <Card
      size="small"
      className="shadow-none"
      title={<Space size={6}><ListChecks size={14} color="var(--color-info-600)" /><span className="text-sm font-semibold">{t('aiDraft.suggest.title')}</span><Tag color="cyan">{t('aiDraft.suggest.tag')}</Tag></Space>}
      extra={suggestResult ? <Tag color="blue">{t('aiDraft.suggest.score', { score: suggestResult.overallScore })}</Tag> : undefined}
      styles={{ body: { padding: 'var(--space-3, 12px)' } }}
    >
      <Button size="small" icon={<ShieldCheck size={13} />} onClick={handleSuggest} loading={suggestLoading} disabled={disabled}>
        {t('aiDraft.suggest.analyze')}
      </Button>
      {suggestResult && suggestResult.suggestions.length === 0 && (
        <Alert type="success" showIcon title={t('aiDraft.suggest.noIssues')} className="mt-2" />
      )}
      {suggestResult && suggestResult.suggestions.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {suggestResult.suggestions.map((s) => {
            const action = suggestionActions[s.id];
            if (action === 'ignored') return null;
            return (
              <div key={s.id} className={`border rounded p-2 ${action === 'adopted' ? 'border-green-200 bg-green-50/50' : 'border-slate-100'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag color={SEVERITY_COLOR[s.severity]} style={{ marginRight: 'var(--space-1, 4px)', fontSize: 10 }}>
                    {s.severity === 'critical' ? t('aiDraft.severity.critical') : s.severity === 'warning' ? t('aiDraft.severity.warning') : t('aiDraft.severity.info')}
                  </Tag>
                  <span className="text-xs font-semibold text-slate-700">{s.title}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{(s.confidence * 100).toFixed(0)}% · {s.ruleId}</span>
                </div>
                <div className="text-xs text-slate-600 mb-1">{s.description}</div>
                {s.suggestedText && (
                  <div className="text-[11px] text-indigo-600 bg-indigo-50/60 rounded px-2 py-1 mb-1.5">{t('aiDraft.suggest.suggestedText')} {s.suggestedText}</div>
                )}
                {action !== 'adopted' && (
                  <Space size={4}>
                    <Button size="small" type="primary" ghost icon={<CheckCircle2 size={12} />} onClick={() => handleAdoptSuggestion(s)} disabled={disabled}>{t('aiDraft.adopt')}</Button>
                    <Button size="small" icon={<XCircle size={12} />} onClick={() => handleIgnoreSuggestion(s.id)} disabled={disabled}>{t('aiDraft.ignore')}</Button>
                  </Space>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  return (
    <Card
      size="small"
      className="shadow-sm border-indigo-200"
      title={
        <div className="flex items-center gap-2">
          <Sparkles size={15} color="#4f46e5" />
          <span className="font-semibold">{t('aiDraft.panel.title')}</span>
          <Tag color="indigo">v2.0.0</Tag>
          <Tag color={dataSource === 'api' ? 'green' : 'orange'} title={dataSource === 'api' ? t('aiDraft.panel.engineTip') : t('aiDraft.draft.fallbackTip')}>
            {dataSource === 'api' ? t('aiDraft.panel.engine') : t('aiDraft.demoFallback')}
          </Tag>
        </div>
      }
      extra={
        <Button size="small" icon={<RefreshCw size={12} />} onClick={resetAll} disabled={disabled}>
          {t('aiDraft.reset')}
        </Button>
      }
    >
      <Alert
        type="warning"
        showIcon
        icon={<ShieldCheck size={14} />}
        title={t('aiDraft.disclaimer')}
        style={{ fontSize: 11, marginBottom: 'var(--space-2, 8px)' }}
      />
      {renderExtractSection()}
      <Divider style={{ margin: '8px 0' }} />
      {renderDraftSection()}
      <Divider style={{ margin: '8px 0' }} />
      {renderSuggestSection()}
    </Card>
  );
};

export default AIDraftPanelV2;

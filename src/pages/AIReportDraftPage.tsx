// ============================================================
// G005 放射科RIS系统 v1.0.4 - AI 一键自动初稿
// Phase R4：基于临床病史自动生成报告初稿
// [v3.0.6.11-100 Wave 3A (G-19)] 深化: LLM 多模型选择 (mock/deepseek/hunyuan)
//   + RAG 增强开关 + 生成信心分 + RAG 来源展示
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Typography } from 'antd';

const { Title } = Typography
import {
  Sparkles, Wand2, Brain, FileText,
  Save, RefreshCw, Loader2, CheckCircle2,
  Lightbulb, Layers, Stethoscope,
  Beaker, ArrowRight, Database, Cpu,
} from 'lucide-react';
import {
  AI_DRAFT_TEMPLATES,
  type AIDraftTemplate,
} from '../data/qualityScoreMock';
import { extendedReportMock } from '../data/reportSubsystemMock';
import { v3WritingApi } from '../services/api/v3Api';
// [v3.0.6.11-95 Wave3B P1] 真实化: 患者/检查下拉 + 草稿保存接真实 API
import { patientApi } from '../services/api/patientApi';
import { examApi } from '../services/api/examApi';
import { reportApi } from '../services/api/reportApi';
import { getCurrentUser } from '../utils/auth';
// [v3.0.6.11-100 Wave 3A (G-19)] 高级生成 (LLM 多模型 + RAG)
import { aiDraftApi, type LlmProviderId, type LlmProviderInfo, type AiDraftRagSource } from '../services/api/aiDraftApi';
import { t } from '../i18n/appI18n';

interface AiExamOption {
  examId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  examItemName: string;
  deviceName: string;
  examDate: string;
}

// ============================================================
// 主组件
// ============================================================
export default function AIReportDraftPage() {
  const navigate = useNavigate();

  // [v3.0.6.11-95 Wave3B P1] 真实化: 患者/检查下拉来自 patientApi.list + examApi.list (有检查记录的患者)
  const [examOptions, setExamOptions] = useState<AiExamOption[]>([]);
  const [patientSource, setPatientSource] = useState<'api' | 'demo'>('demo');
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<string>('rpt-013');
  const currentExam = examOptions.find(o => o.examId === selectedExamId) ?? examOptions[0] ?? null;

  // [v3.0.6.11-95 Wave3B P1] 真实化: AI 生成数据源标注 (api 真实 / demo 离线回退)
  const [draftSource, setDraftSource] = useState<'api' | 'demo'>('api');

  // 临床病史输入
  const [clinicalHistory, setClinicalHistory] = useState<string>('');

  // [v3.0.6.11-100 Wave 3A (G-19)] LLM 多模型选择 + RAG 开关
  const [providers, setProviders] = useState<LlmProviderInfo[]>([]);
  const [aiProvider, setAiProvider] = useState<LlmProviderId>('mock');
  const [includeRag, setIncludeRag] = useState(true);
  const [ragSources, setRagSources] = useState<AiDraftRagSource[]>([]);
  const [advancedConfidence, setAdvancedConfidence] = useState<number | null>(null);
  const [advancedFallback, setAdvancedFallback] = useState(false);

  const PROVIDER_LABEL: Record<LlmProviderId, string> = { mock: t('aiDraft.providerMock'), deepseek: 'DeepSeek', hunyuan: t('aiDraft.providerHunyuan') };

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStage, setGenStage] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState<AIDraftTemplate | null>(null);
  const [editedFindings, setEditedFindings] = useState('');
  const [editedDiagnosis, setEditedDiagnosis] = useState('');
  const [editedImpression, setEditedImpression] = useState('');

  // 选中的 AI 模板
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = AI_DRAFT_TEMPLATES.find(t => t.id === selectedTemplateId);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // [v3.0.6.11-100 Wave 3A (G-19)] 加载可用 LLM 提供方
  useEffect(() => {
    let cancelled = false;
    aiDraftApi.listProviders().then((res) => {
      if (cancelled || !res.success) return;
      const list = Array.isArray(res.data) ? res.data : [];
      setProviders(list);
      const mock = list.find((p) => p.id === 'mock');
      if (mock) setAiProvider(mock.id);
    }).catch(() => { /* 忽略 */ });
    return () => { cancelled = true; };
  }, []);

  // [v3.0.6.11-95 Wave3B P1] 真实化: 加载有检查记录的患者 (失败回退演示样本 + 标注)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setDataLoading(true);
      try {
        const [patientRes, examRes] = await Promise.all([
          patientApi.list({ pageSize: 200 }),
          examApi.list({ pageSize: 200 }),
        ]);
        if (cancelled) return;
        const toArr = (d: unknown): any[] => Array.isArray(d) ? d : ((d as { items?: unknown[] })?.items ?? []);
        const patients = toArr(patientRes.data).filter((p: any) => p?.id);
        const exams = toArr(examRes.data).filter((e: any) => e?.id && e?.patientId);
        const patientById = new Map(patients.map((p: any) => [p.id, p]));
        if (exams.length > 0) {
          const options: AiExamOption[] = exams.map((e: any) => {
            const p = patientById.get(e.patientId);
            return {
              examId: e.id ?? e.examId,
              patientId: e.patientId,
              patientName: p?.name ?? e.patientName ?? t('aiDraft.unknownPatient'),
              modality: e.modality ?? 'CT',
              bodyPart: e.bodyPart ?? t('aiDraft.chest'),
              examItemName: e.examItem ?? e.examItemName ?? t('aiDraft.imagingExam'),
              deviceName: e.deviceModel ?? e.deviceName ?? '—',
              examDate: e.scheduledAt ?? e.examAt ?? '',
            };
          });
          setExamOptions(options);
          setPatientSource('api');
          const first = options[0];
          setSelectedExamId(first?.examId ?? 'rpt-013');
          setClinicalHistory(t('aiDraft.clinicalHistoryTemplate', { patient: first?.patientName ?? '', modality: first?.modality ?? '', bodyPart: first?.bodyPart ?? '' }));
        } else {
          setExamOptions(extendedReportMock.slice(0, 20).map((r) => ({
            examId: r.id,
            patientId: r.patientId ?? r.id,
            patientName: r.patientName ?? t('aiDraft.demoPatient'),
            modality: r.modality ?? 'CT',
            bodyPart: r.bodyPart ?? t('aiDraft.chest'),
            examItemName: r.examItemName ?? t('aiDraft.imagingExam'),
            deviceName: r.deviceName ?? '—',
            examDate: r.examDate ?? '',
          })));
          setPatientSource('demo');
          setSelectedExamId('rpt-013');
          setClinicalHistory(extendedReportMock.find(r => r.id === 'rpt-013')?.clinicalHistory ?? '');
        }
      } catch {
        if (cancelled) return;
        setExamOptions(extendedReportMock.slice(0, 20).map((r) => ({
          examId: r.id,
          patientId: r.patientId ?? r.id,
          patientName: r.patientName ?? '演示患者',
          modality: r.modality ?? 'CT',
          bodyPart: r.bodyPart ?? '胸部',
          examItemName: r.examItemName ?? '影像检查',
          deviceName: r.deviceName ?? '—',
          examDate: r.examDate ?? '',
        })));
        setPatientSource('demo');
        setSelectedExamId('rpt-013');
        setClinicalHistory(extendedReportMock.find(r => r.id === 'rpt-013')?.clinicalHistory ?? '');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 生成草稿
  // [v3.0.6.11-95 Wave3B P1] 真实化: 调用 v3WritingApi.aiDraft → aiDraftApi.generateReportDraft (POST /ai/report-draft 真实端点)
  //   进度条仅为请求期间的视觉反馈, 内容与结果均来自真实响应; 失败回退模板 + 标注"离线模式"
  const handleGenerate = async () => {
    if (!clinicalHistory.trim() && !selectedTemplate) {
      message.warning(t('aiDraft.enterHistory'));
      return;
    }
    if (!currentExam && patientSource === 'api') {
      message.warning(t('aiDraft.noExamRecord'));
      return;
    }

    setGenerating(true);
    setGenProgress(0);
    setGenStage(t('aiDraft.callingAi'));
    setGeneratedDraft(null);
    setDraftSource('api');

    const stages = [
      { p: 25, s: t('aiDraft.stageAnalyze') },
      { p: 50, s: t('aiDraft.stageMatch') },
      { p: 75, s: t('aiDraft.stageGenerate') },
      { p: 95, s: t('aiDraft.stageTemplate') },
    ];

    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i < stages.length) {
        setGenProgress(stages[i]?.p ?? 0);
        setGenStage(stages[i]?.s ?? '');
        i++;
      }
    }, 500);

    try {
      // [v3.0.6.11-100 Wave 3A (G-19)] 优先高级生成 (LLM 多模型 + RAG): /ai-draft/generate-advanced
      let draft: AIDraftTemplate | null = null;
      try {
        const advanced = await aiDraftApi.generateAdvanced({
          reportId: currentExam?.examId ?? selectedExamId,
          provider: aiProvider,
          includeRag,
        });
        if (advanced.success && advanced.data) {
          const a = advanced.data;
          const sections = Array.isArray(a.sections) ? a.sections : [];
          const pick = (keys: string[]) => sections.find((s) => keys.some((k) => (s?.heading ?? '').includes(k)))?.content ?? '';
          const findings = pick(['影像所见', '所见']) || a.draftText;
          const impression = pick(['影像诊断', '诊断意见', '意见']) || pick(['印象']);
          const diagnosis = pick(['影像诊断', '诊断意见']);
          setRagSources(a.sources ?? []);
          setAdvancedConfidence(a.confidenceScore ?? 0.9);
          setAdvancedFallback(a.fallbackToMock ?? false);
          draft = {
            id: a.id ?? `draft-${Date.now()}`,
            scenario: t('aiDraft.scenarioLlm', { provider: PROVIDER_LABEL[a.provider] ?? a.provider }),
            modality: currentExam?.modality ?? 'CT',
            bodyPart: currentExam?.bodyPart ?? t('aiDraft.chest'),
            confidence: a.confidenceScore ?? 0.9,
            clinicalHistory,
            generatedFindings: findings,
            generatedDiagnosis: diagnosis,
            generatedImpression: impression,
            sources: (a.sources ?? []).map((s) => t('aiDraft.previousReport', { id: s.reportId })),
          };
        }
      } catch { draft = null; }

      if (!draft) {
        setRagSources([]);
        setAdvancedConfidence(null);
        const res = await v3WritingApi.aiDraft({
          templateId: selectedTemplate?.id ?? 'default',
          patientId: currentExam?.patientId ?? selectedExamId,
          findings: clinicalHistory,
          modality: currentExam?.modality ?? 'CT',
          bodyPart: currentExam?.bodyPart ?? '胸部',
          clinicalHistory,
        });
        if (res.success && res.data) {
          draft = {
            id: res.data.id ?? `draft-${Date.now()}`,
            scenario: selectedTemplate?.scenario ?? t('aiDraft.smartGenerate'),
            modality: currentExam?.modality ?? 'CT',
            bodyPart: currentExam?.bodyPart ?? t('aiDraft.chest'),
            confidence: res.data.confidence ?? 0.85,
            clinicalHistory,
            generatedFindings: res.data.findings ?? '',
            generatedDiagnosis: res.data.diagnosis ?? '',
            generatedImpression: res.data.impression ?? '',
            sources: res.data.sources ?? ['AI Model v2.3'],
          };
        } else {
          throw new Error(res.error?.message || t('aiDraft.aiGenerateFailed'));
        }
      }

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setGenProgress(100);
      setGenStage(t('aiDraft.generationComplete'));
      setGeneratedDraft(draft);
      setEditedFindings(draft.generatedFindings);
      setEditedDiagnosis(draft.generatedDiagnosis);
      setEditedImpression(draft.generatedImpression);
      setSelectedTemplateId(draft.id);
    } catch (e: any) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setGenerating(false);
      setDraftSource('demo');

      let draft = selectedTemplate;
      if (!draft) {
        const text = clinicalHistory.toLowerCase();
        if (text.includes('肺') || text.includes('胸')) {
          draft = AI_DRAFT_TEMPLATES.find(t => t.scenario.includes('肺'));
        } else if (text.includes('肝')) {
          draft = AI_DRAFT_TEMPLATES.find(t => t.scenario.includes('肝'));
        } else if (text.includes('脑') || text.includes('梗') || text.includes('中风')) {
          draft = AI_DRAFT_TEMPLATES.find(t => t.scenario.includes('脑'));
        } else if (text.includes('腰') || text.includes('椎')) {
          draft = AI_DRAFT_TEMPLATES.find(t => t.scenario.includes('腰椎'));
        } else if (text.includes('乳腺')) {
          draft = AI_DRAFT_TEMPLATES.find(t => t.scenario.includes('乳腺'));
        } else {
          draft = AI_DRAFT_TEMPLATES[0];
        }
      }

      if (draft) {
        setGeneratedDraft(draft);
        setEditedFindings(draft.generatedFindings);
        setEditedDiagnosis(draft.generatedDiagnosis);
        setEditedImpression(draft.generatedImpression);
        setSelectedTemplateId(draft.id);
        message.warning(t('aiDraft.serviceUnavailable', { message: e?.message || '' }));
      } else {
        message.error('AI 生成失败: ' + (e?.message || String(e)));
      }
    } finally {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setGenerating(false);
    }
  };

  // [v3.0.6.11-95 Wave3B P1] 真实化: 生成结果 → reportApi.create 保存真实草稿 → 跳转书写页
  const createDraftReport = async () => {
    if (!generatedDraft) return null;
    if (!currentExam) {
      message.error(t('aiDraft.missingExamRecord'));
      return null;
    }
    const user = getCurrentUser();
    try {
      const res = await reportApi.create({
        patientId: currentExam.patientId,
        examId: currentExam.examId,
        patientName: currentExam.patientName,
        modality: currentExam.modality,
        bodyPart: currentExam.bodyPart,
        radiologistId: user?.id,
        findings: editedFindings,
        impression: editedImpression,
        conclusion: editedImpression || editedDiagnosis,
      });
      if (res.success && res.data) {
        message.success(t('aiDraft.draftGenerated', { reportId: res.data.reportId ?? res.data.id }));
        return res.data.reportId ?? res.data.id;
      }
    } catch {
      message.error(t('aiDraft.createDraftFailed'));
      return null;
    }
    return null;
  };

  // 应用到报告书写
  const applyToReport = async () => {
    if (!generatedDraft) return;
    try {
      const reportId = await createDraftReport();
      if (reportId) {
        navigate(`/reports/v3-write?reportId=${encodeURIComponent(reportId)}`);
      } else {
        message.warning(t('aiDraft.jumpDraftFailed'));
        navigate(`/reports/v3-write`);
      }
    } catch (e: any) {
      message.error('应用到报告书写失败: ' + (e?.message || '网络异常'));
    }
  };

  // [v3.0.6.11-95 Wave3B P1] 真实化: 保存草稿走 reportApi.create (真实报告), 替代 mock saveDraft
  const saveAsDraft = async () => {
    if (!generatedDraft) {
      message.warning(t('aiDraft.generateFirst'));
      return;
    }
    try {
      const created = await createDraftReport();
      if (created) {
        message.success(t('aiDraft.draftSaved', { id: created }));
      } else {
        message.error(t('aiDraft.saveFailed'));
      }
    } catch (e: any) {
      message.error('保存失败: ' + (e?.message || String(e)));
    }
  };

  return (
    <div style={{ padding: 'var(--space-5, 20px)', maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, var(--color-primary-500) 100%)',
        borderRadius: 12, padding: 'var(--space-5, 20px)', marginBottom: 'var(--space-4, 16px)', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              {t('aiDraft.title')}
              <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R4</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 600 }}>
                {patientSource === 'api' ? t('aiDraft.realDataHint') : t('aiDraft.demoDataHint')}
              </span>
            </Title>
            <p style={{ fontSize: 12, margin: '4px 0 0', opacity: 0.9 }}>
              {t('aiDraft.subtitle')}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{t('aiDraft.llmModel')}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{PROVIDER_LABEL[aiProvider]}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--space-3, 12px)' }}>
        {/* 左：输入 + 模板 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {/* 报告选择 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} /> {t('aiDraft.selectPatientExam')}
              {dataLoading && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{t('aiDraft.loading')}</span>}
              {!dataLoading && patientSource === 'api' && (
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', color: '#059669', fontWeight: 600 }}>{t('aiDraft.realData')}</span>
              )}
              {!dataLoading && patientSource === 'demo' && (
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning-600)', fontWeight: 600 }}>{t('aiDraft.demoData')}</span>
              )}
            </div>
            <select
              value={selectedExamId}
              onChange={e => {
                setSelectedExamId(e.target.value);
                const opt = examOptions.find(o => o.examId === e.target.value);
                if (opt) setClinicalHistory(t('aiDraft.clinicalHistoryTemplate', { patient: opt.patientName, modality: opt.modality, bodyPart: opt.bodyPart }));
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}
            >
              {examOptions.map(o => (
                <option key={o.examId} value={o.examId}>{o.patientName} · {o.modality} {o.bodyPart}</option>
              ))}
            </select>
            {currentExam && (
              <div style={{ marginTop: 'var(--space-2, 8px)', padding: 'var(--space-2, 8px)', background: 'var(--bg-card)', borderRadius: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div><strong>{t('aiDraft.examLabel')}</strong>{currentExam.examItemName}</div>
                <div><strong>{t('aiDraft.deviceLabel')}</strong>{currentExam.deviceName || '—'}</div>
                <div><strong>{t('aiDraft.examDateLabel')}</strong>{currentExam.examDate ? new Date(currentExam.examDate).toLocaleDateString() : '—'}</div>
              </div>
            )}
          </div>

          {/* 临床病史输入 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Stethoscope size={13} /> {t('aiDraft.clinicalHistory')}
            </div>
            <textarea
              value={clinicalHistory}
              onChange={e => setClinicalHistory(e.target.value)}
              rows={5}
              placeholder={t('aiDraft.historyPlaceholder')}
              style={{
                width: '100%', padding: 'var(--space-2, 8px)', border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>{t('aiDraft.charCount', { count: clinicalHistory.length })}</div>
          </div>

          {/* [v3.0.6.11-100 Wave 3A (G-19)] LLM 模型选择 + RAG 增强 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={13} /> {t('aiDraft.llmAndRag')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)' }}>{t('aiDraft.llmProvider')}</div>
                <select
                  value={aiProvider}
                  onChange={e => setAiProvider(e.target.value as LlmProviderId)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}
                >
                  {(providers.length > 0 ? providers : [
                    { id: 'mock' as LlmProviderId, name: t('aiDraft.providerMockEngine'), available: true },
                    { id: 'deepseek' as LlmProviderId, name: t('aiDraft.providerDeepseek'), available: false },
                    { id: 'hunyuan' as LlmProviderId, name: t('aiDraft.providerHunyuan'), available: false },
                  ]).map((p: any) => (
                    <option key={p.id} value={p.id} disabled={!p.available && p.id !== aiProvider}>
                      {p.name}{p.available ? '' : t('aiDraft.notConfiguredKey')}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('aiDraft.ragEnhance')}</span>
                <input
                  type="checkbox"
                  checked={includeRag}
                  onChange={e => setIncludeRag(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#7c3aed' }}
                />
              </div>
              {advancedFallback && (
                <div style={{ fontSize: 11, color: 'var(--color-warning-600)', background: 'rgba(245,158,11,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                  {t('aiDraft.modelNotConfigured')}
                </div>
              )}
            </div>
          </div>

          {/* AI 场景模板 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={13} /> {t('aiDraft.scenarioTemplate')} ({AI_DRAFT_TEMPLATES.length})
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {AI_DRAFT_TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id === selectedTemplateId ? null : tpl.id)}
                  style={{
                    padding: 'var(--space-2, 8px)', marginBottom: 'var(--space-1, 4px)',
                    background: selectedTemplateId === tpl.id ? 'var(--color-info-bg)' : 'var(--bg-card)',
                    border: `1px solid ${selectedTemplateId === tpl.id ? 'var(--color-primary-500)' : 'var(--border-color, #e2e8f0)'}`,
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', marginBottom: 2 }}>
                    <Sparkles size={11} color="#7c3aed" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tpl.scenario}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                      {(tpl.confidence * 100).toFixed(0)}% {t('aiDraft.confidence')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tpl.modality} · {tpl.bodyPart}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: 14, border: 'none', borderRadius: 8,
              background: generating ? '#94a3b8' : 'linear-gradient(135deg, #7c3aed 0%, var(--color-primary-500) 100%)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2, 8px)',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={16} className="spin" />
                 {t('aiDraft.generating', { progress: genProgress })}
              </>
            ) : (
              <>
                <Wand2 size={16} />
                 {t('aiDraft.generateButton')}
              </>
            )}
          </button>

          {/* 进度 */}
          {generating && (
            <div style={{
              padding: 10, background: 'var(--bg-card)', borderRadius: 6,
              border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, marginBottom: 6 }}>{genStage}</div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${genProgress}%`, height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed, var(--color-primary-500))',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* 右：生成结果 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {!generatedDraft ? (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 8, padding: 60, textAlign: 'center',
              border: '1px dashed var(--border-color)',
            }}>
              <Brain size={48} style={{ color: '#cbd5e1', display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('aiDraft.emptyTitle')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{t('aiDraft.emptyHint')}</div>
            </div>
          ) : (
            <>
              {/* 来源信息 */}
              <div style={{
                background: 'linear-gradient(135deg, #8b5cf622 0%, var(--color-info-bg) 100%)',
                borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid #c4b5fd',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                  <Sparkles size={16} color="#7c3aed" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#5b21b6' }}>
                      {t('aiDraft.scenarioLabel')}{generatedDraft.scenario}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b21a8', marginTop: 2 }}>
                      {/* [v3.0.6.11-100 Wave 3A (G-19)] 信心分优先展示高级生成结果 */}
                      {t('aiDraft.confidenceLabel')} <strong>{((advancedConfidence ?? generatedDraft.confidence) * 100).toFixed(0)}%</strong> · {t('aiDraft.sourcesCount', { count: generatedDraft.sources.length })}
                      {advancedConfidence !== null && ragSources.length > 0 && (
                        <span> · <Database size={10} style={{ display: 'inline', verticalAlign: -1 }} /> RAG {t('aiDraft.ragReports', { count: ragSources.length })}</span>
                      )}
                      {' · '}
                      <span style={{ fontWeight: 700, color: draftSource === 'api' ? '#059669' : 'var(--color-warning-600)' }}>
                        {draftSource === 'api' ? (advancedConfidence !== null ? t('aiDraft.realAiGenerateWithProvider', { provider: PROVIDER_LABEL[aiProvider] }) : t('aiDraft.realAiGenerate')) : t('aiDraft.offlineFallback')}
                      </span>
                    </div>
                    {/* [v3.0.6.11-100 Wave 3A (G-19)] 信心分进度条 */}
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                      <div style={{ flex: 1, height: 6, background: '#e9d5ff', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${(advancedConfidence ?? generatedDraft.confidence) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>
                        {((advancedConfidence ?? generatedDraft.confidence) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {generatedDraft.sources.slice(0, 4).map((s, i) => (
                      <span key={i} style={{
                        fontSize: 12, padding: '1px 5px', borderRadius: 3,
                        background: 'var(--bg-card)', color: '#5b21b6', fontWeight: 600,
                      }}>{s}</span>
                    ))}
                    {ragSources.length > 0 && (
                      <span style={{
                        fontSize: 12, padding: '1px 5px', borderRadius: 3,
                        background: 'rgba(6,182,212,0.12)', color: 'var(--color-info-600)', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        <Database size={10} /> {t('aiDraft.ragReports', { count: ragSources.length })}
                      </span>
                    )}
                  </div>
                </div>

                {/* [v3.0.6.11-100 Wave 3A (G-19)] RAG 来源列表 */}
                {ragSources.length > 0 && (
                  <div style={{ marginTop: 'var(--space-2, 8px)', padding: 'var(--space-2, 8px)', background: 'rgba(6,182,212,0.06)', borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#0e7490', marginBottom: 'var(--space-1, 4px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                      <Database size={11} /> {t('aiDraft.ragSourcesTitle')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {ragSources.map((s) => (
                        <div key={s.reportId} style={{ color: 'var(--text-secondary)' }}>
                          <strong style={{ color: '#0e7490' }}>{s.reportId}</strong>
                          <span style={{ margin: '0 4px', color: 'var(--text-muted, #94a3b8)' }}>{s.date}</span>
                          <span>{s.snippet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 可编辑的所见 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                    <FileText size={13} /> {t('aiDraft.findings')}
                  </div>
                  <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CheckCircle2 size={10} /> {t('aiDraft.aiGenerated')}
                  </span>
                </div>
                <textarea
                  value={editedFindings}
                  onChange={e => setEditedFindings(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%', padding: 'var(--space-2, 8px)', border: '1px solid var(--border-color)', borderRadius: 4,
                    fontSize: 12, resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 诊断 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                  <Lightbulb size={13} /> {t('aiDraft.diagnosis')}
                </div>
                <textarea
                  value={editedDiagnosis}
                  onChange={e => setEditedDiagnosis(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: 'var(--space-2, 8px)', border: '1px solid var(--border-color)', borderRadius: 4,
                    fontSize: 12, resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 意见 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 'var(--space-3, 12px)', border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                  <Beaker size={13} /> {t('aiDraft.impressionAdvice')}
                </div>
                <textarea
                  value={editedImpression}
                  onChange={e => setEditedImpression(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: 'var(--space-2, 8px)', border: '1px solid var(--border-color)', borderRadius: 4,
                    fontSize: 12, resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', justifyContent: 'flex-end' }}>
                <button
                  onClick={saveAsDraft}
                  style={{
                    padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: 6,
                    background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                  }}
                >
                  <Save size={12} /> {t('aiDraft.saveDraft')}
                </button>
                <button
                  onClick={handleGenerate}
                  style={{
                    padding: '8px 16px', border: '1px solid #7c3aed', borderRadius: 6,
                    background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                  }}
                >
                  <RefreshCw size={12} /> {t('aiDraft.regenerate')}
                </button>
                <button
                  onClick={applyToReport}
                  style={{
                    padding: '8px 16px', border: 'none', borderRadius: 6,
                    background: 'linear-gradient(135deg, #7c3aed 0%, var(--color-primary-500) 100%)',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)',
                  }}
                >
                  <ArrowRight size={12} /> {t('aiDraft.applyToReport')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

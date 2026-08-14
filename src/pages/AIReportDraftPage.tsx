// ============================================================
// G005 放射科RIS系统 v1.0.4 - AI 一键自动初稿
// Phase R4：基于临床病史自动生成报告初稿
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import {
  Sparkles, Wand2, Brain, FileText,
  Save, RefreshCw, Loader2, CheckCircle2,
  Lightbulb, Layers, Stethoscope,
  Beaker, ArrowRight,
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
              patientName: p?.name ?? e.patientName ?? '未知患者',
              modality: e.modality ?? 'CT',
              bodyPart: e.bodyPart ?? '胸部',
              examItemName: e.examItem ?? e.examItemName ?? '影像检查',
              deviceName: e.deviceModel ?? e.deviceName ?? '—',
              examDate: e.scheduledAt ?? e.examAt ?? '',
            };
          });
          setExamOptions(options);
          setPatientSource('api');
          const first = options[0];
          setSelectedExamId(first?.examId ?? 'rpt-013');
          setClinicalHistory(`${first?.patientName ?? ''} ${first?.modality ?? ''}-${first?.bodyPart ?? ''} 检查,请结合影像所见生成报告初稿`);
        } else {
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
      message.warning('请输入临床病史或选择 AI 场景模板');
      return;
    }
    if (!currentExam && patientSource === 'api') {
      message.warning('未找到可生成初稿的检查记录,请先选择患者/检查');
      return;
    }

    setGenerating(true);
    setGenProgress(0);
    setGenStage('正在调用 AI 服务生成报告初稿...');
    setGeneratedDraft(null);
    setDraftSource('api');

    const stages = [
      { p: 25, s: '正在分析临床病史...' },
      { p: 50, s: '匹配历史相似病例与术语规范...' },
      { p: 75, s: 'AI 模型生成内容中...' },
      { p: 95, s: '应用科室模板结构...' },
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
      const res = await v3WritingApi.aiDraft({
        templateId: selectedTemplate?.id ?? 'default',
        patientId: currentExam?.patientId ?? selectedExamId,
        findings: clinicalHistory,
        modality: currentExam?.modality ?? 'CT',
        bodyPart: currentExam?.bodyPart ?? '胸部',
        clinicalHistory,
      });

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setGenProgress(100);
      setGenStage('生成完成！');

      if (res.success && res.data) {
        const draft: AIDraftTemplate = {
          id: res.data.id ?? `draft-${Date.now()}`,
          scenario: selectedTemplate?.scenario ?? '智能生成',
          modality: currentExam?.modality ?? 'CT',
          bodyPart: currentExam?.bodyPart ?? '胸部',
          confidence: res.data.confidence ?? 0.85,
          clinicalHistory,
          generatedFindings: res.data.findings ?? '',
          generatedDiagnosis: res.data.diagnosis ?? '',
          generatedImpression: res.data.impression ?? '',
          sources: res.data.sources ?? ['AI Model v2.3'],
        };
        setGeneratedDraft(draft);
        setEditedFindings(draft.generatedFindings);
        setEditedDiagnosis(draft.generatedDiagnosis);
        setEditedImpression(draft.generatedImpression);
        setSelectedTemplateId(draft.id);
      } else {
        throw new Error(res.error?.message || 'AI 生成失败');
      }
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
        message.warning(`AI 服务暂不可用，已回退离线模板: ${e?.message || ''}`);
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
      message.error('缺少检查记录,无法创建报告草稿');
      return null;
    }
    const user = getCurrentUser();
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
      message.success(`已生成报告草稿 · 报告号 ${res.data.reportId ?? res.data.id}`);
      return res.data.reportId ?? res.data.id;
    }
    return null;
  };

  // 应用到报告书写
  const applyToReport = async () => {
    if (!generatedDraft) return;
    const reportId = await createDraftReport();
    if (reportId) {
      navigate(`/reports/v3-write?reportId=${encodeURIComponent(reportId)}`);
    } else {
      message.warning(`已跳转到报告书写页 · 草稿创建失败`);
      navigate(`/reports/v3-write`);
    }
  };

  // [v3.0.6.11-95 Wave3B P1] 真实化: 保存草稿走 reportApi.create (真实报告), 替代 mock saveDraft
  const saveAsDraft = async () => {
    if (!generatedDraft) {
      message.warning('请先生成 AI 草稿');
      return;
    }
    try {
      const created = await createDraftReport();
      if (created) {
        message.success(`草稿已保存为真实报告 · ID ${created}`);
      } else {
        message.error('保存失败,请稍后重试');
      }
    } catch (e: any) {
      message.error('保存失败: ' + (e?.message || String(e)));
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
        borderRadius: 12, padding: 20, marginBottom: 16, color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              AI 一键自动初稿
              <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R4</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 600 }}>
                {patientSource === 'api' ? '真实数据 · 患者/检查来自 API' : '演示数据 · 患者下拉为演示样本'}
              </span>
            </h1>
            <p style={{ fontSize: 13, margin: '4px 0 0', opacity: 0.9 }}>
              基于临床病史 + 影像特征 + 历史相似病例 · 一键生成规范报告初稿
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>AI 模型</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>v2.3</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
        {/* 左：输入 + 模板 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 报告选择 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} /> 选择患者 / 检查
              {dataLoading && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>加载中…</span>}
              {!dataLoading && patientSource === 'api' && (
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', color: '#059669', fontWeight: 600 }}>真实数据</span>
              )}
              {!dataLoading && patientSource === 'demo' && (
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#d97706', fontWeight: 600 }}>演示数据</span>
              )}
            </div>
            <select
              value={selectedExamId}
              onChange={e => {
                setSelectedExamId(e.target.value);
                const opt = examOptions.find(o => o.examId === e.target.value);
                if (opt) setClinicalHistory(`${opt.patientName} ${opt.modality}-${opt.bodyPart} 检查,请结合影像所见生成报告初稿`);
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}
            >
              {examOptions.map(o => (
                <option key={o.examId} value={o.examId}>{o.patientName} · {o.modality} {o.bodyPart}</option>
              ))}
            </select>
            {currentExam && (
              <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div><strong>检查：</strong>{currentExam.examItemName}</div>
                <div><strong>设备：</strong>{currentExam.deviceName || '—'}</div>
                <div><strong>检查日期：</strong>{currentExam.examDate ? new Date(currentExam.examDate).toLocaleDateString() : '—'}</div>
              </div>
            )}
          </div>

          {/* 临床病史输入 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Stethoscope size={13} /> 临床病史
            </div>
            <textarea
              value={clinicalHistory}
              onChange={e => setClinicalHistory(e.target.value)}
              rows={5}
              placeholder="例：55 岁男性，体检发现右肺结节 1 周。无咳嗽咳痰，无胸痛，无发热..."
              style={{
                width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4,
                fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{clinicalHistory.length} 字</div>
          </div>

          {/* AI 场景模板 */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={13} /> AI 场景模板 ({AI_DRAFT_TEMPLATES.length})
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {AI_DRAFT_TEMPLATES.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id === selectedTemplateId ? null : t.id)}
                  style={{
                    padding: 8, marginBottom: 4,
                    background: selectedTemplateId === t.id ? 'var(--color-info-bg)' : 'var(--bg-card)',
                    border: `1px solid ${selectedTemplateId === t.id ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Sparkles size={11} color="#7c3aed" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t.scenario}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                      {(t.confidence * 100).toFixed(0)}% 置信
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.modality} · {t.bodyPart}</div>
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
              background: generating ? '#94a3b8' : 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={16} className="spin" />
                正在生成 {genProgress}%
              </>
            ) : (
              <>
                <Wand2 size={16} />
                一键生成 AI 报告初稿
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
                  background: 'linear-gradient(90deg, #7c3aed, #3b82f6)',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* 右：生成结果 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!generatedDraft ? (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 8, padding: 60, textAlign: 'center',
              border: '1px dashed var(--border-color)',
            }}>
              <Brain size={48} style={{ color: '#cbd5e1', display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>填写临床病史或选择 AI 场景模板</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>点击"一键生成"自动生成报告初稿</div>
            </div>
          ) : (
            <>
              {/* 来源信息 */}
              <div style={{
                background: 'linear-gradient(135deg, #8b5cf622 0%, var(--color-info-bg) 100%)',
                borderRadius: 8, padding: 12, border: '1px solid #c4b5fd',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} color="#7c3aed" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>
                      AI 场景：{generatedDraft.scenario}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b21a8', marginTop: 2 }}>
                      置信度 <strong>{(generatedDraft.confidence * 100).toFixed(0)}%</strong> · 参考 {generatedDraft.sources.length} 个来源
                      {' · '}
                      <span style={{ fontWeight: 700, color: draftSource === 'api' ? '#059669' : '#d97706' }}>
                        {draftSource === 'api' ? '真实 AI 生成' : '离线模板回退'}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {generatedDraft.sources.map((s, i) => (
                      <span key={i} style={{
                        fontSize: 12, padding: '1px 5px', borderRadius: 3,
                        background: 'var(--bg-card)', color: '#5b21b6', fontWeight: 600,
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 可编辑的所见 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText size={13} /> 检查所见
                  </div>
                  <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CheckCircle2 size={10} /> AI 生成
                  </span>
                </div>
                <textarea
                  value={editedFindings}
                  onChange={e => setEditedFindings(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4,
                    fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 诊断 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lightbulb size={13} /> 诊断
                </div>
                <textarea
                  value={editedDiagnosis}
                  onChange={e => setEditedDiagnosis(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4,
                    fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 意见 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Beaker size={13} /> 诊断意见 / 建议
                </div>
                <textarea
                  value={editedImpression}
                  onChange={e => setEditedImpression(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4,
                    fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={saveAsDraft}
                  style={{
                    padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: 6,
                    background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Save size={12} /> 保存草稿
                </button>
                <button
                  onClick={handleGenerate}
                  style={{
                    padding: '8px 16px', border: '1px solid #7c3aed', borderRadius: 6,
                    background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <RefreshCw size={12} /> 重新生成
                </button>
                <button
                  onClick={applyToReport}
                  style={{
                    padding: '8px 16px', border: 'none', borderRadius: 6,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)',
                  }}
                >
                  <ArrowRight size={12} /> 应用到报告书写
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

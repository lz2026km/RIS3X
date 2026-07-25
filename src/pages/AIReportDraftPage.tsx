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

// ============================================================
// 主组件
// ============================================================
export default function AIReportDraftPage() {
  const navigate = useNavigate();

  // 当前选中的报告
  const [selectedReportId, setSelectedReportId] = useState<string>('rpt-013');
  const currentReport = extendedReportMock.find(r => r.id === selectedReportId);

  // 临床病史输入
  const [clinicalHistory, setClinicalHistory] = useState<string>(currentReport?.clinicalHistory || '');

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

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 生成草稿
  const handleGenerate = async () => {
    if (!clinicalHistory.trim() && !selectedTemplate) {
      message.warning('请输入临床病史或选择 AI 场景模板');
      return;
    }

    setGenerating(true);
    setGenProgress(0);
    setGeneratedDraft(null);

    const stages = [
      { p: 15, s: '正在分析临床病史...' },
      { p: 30, s: '提取关键症状和体征...' },
      { p: 50, s: '匹配历史相似病例...' },
      { p: 70, s: '调用 AI 模型 v2.3 生成内容...' },
      { p: 85, s: '应用科室术语规范...' },
      { p: 100, s: '生成完成！' },
    ];

    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i < stages.length) {
        setGenProgress(stages[i].p);
        setGenStage(stages[i].s);
        i++;
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setGenerating(false);
      }
    }, 600);

    try {
      const res = await v3WritingApi.aiDraft({
        templateId: selectedTemplate?.id ?? 'default',
        patientId: selectedReportId,
        findings: clinicalHistory,
      });

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setGenProgress(100);
      setGenStage('生成完成！');

      if (res.success && res.data) {
        const draft: AIDraftTemplate = {
          id: res.data.id ?? `draft-${Date.now()}`,
          scenario: selectedTemplate?.scenario ?? '智能生成',
          modality: currentReport?.modality ?? 'CT',
          bodyPart: currentReport?.bodyPart ?? '胸部',
          confidence: res.data.confidence ?? 0.85,
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
        message.warning(`AI 服务暂不可用，使用离线模式: ${e?.message || ''}`);
      } else {
        message.error('AI 生成失败: ' + (e?.message || String(e)));
      }
    }
  };

  // 应用到报告书写
  const applyToReport = async () => {
    if (!generatedDraft) return;
    try {
      const res = await v3WritingApi.aiDraft({
        templateId: generatedDraft.id,
        patientId: currentReport?.patientId ?? selectedReportId,
        findings: `${editedFindings}\n\n诊断：${editedDiagnosis}\n意见：${editedImpression}`,
      });
      if (res.success) {
        message.success(`已应用 AI 初稿到报告书写页 · 诊断: ${editedDiagnosis}`);
      } else {
        message.warning(`已跳转到报告页 · ${res.error?.message || 'AI 服务暂不可用'}`);
      }
    } catch (e: any) {
      message.warning(`已跳转到报告页 · ${e?.message || String(e)}`);
    }
    navigate('/report-write-v2/' + selectedReportId);
  };

  // 保存为草稿
  const saveAsDraft = async () => {
    if (!generatedDraft) {
      message.warning('请先生成 AI 草稿');
      return;
    }
    try {
      const res = await v3WritingApi.saveDraft(selectedReportId, {
        templateId: generatedDraft.id,
        reportId: selectedReportId,
        patientName: currentReport?.patientName,
        modality: currentReport?.modality,
        bodyPart: currentReport?.bodyPart,
        clinicalHistory,
        findings: editedFindings,
        diagnosis: editedDiagnosis,
        impression: editedImpression,
        scenario: generatedDraft.scenario,
        confidence: generatedDraft.confidence,
        savedAt: new Date().toISOString(),
        status: 'draft',
      });
      if (res.success) {
        message.success(`草稿已保存 · ID ${(res.data as any)?.id ?? selectedReportId}`);
      } else {
        message.error(res.error?.message || '保存失败');
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
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              AI 一键自动初稿
              <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R4</span>
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
            background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} /> 选择报告
            </div>
            <select
              value={selectedReportId}
              onChange={e => {
                setSelectedReportId(e.target.value);
                const r = extendedReportMock.find(x => x.id === e.target.value);
                if (r) setClinicalHistory(r.clinicalHistory || '');
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}
            >
              {extendedReportMock.slice(0, 20).map(r => (
                <option key={r.id} value={r.id}>{r.patientName} · {r.modality} {r.bodyPart}</option>
              ))}
            </select>
            {currentReport && (
              <div style={{ marginTop: 8, padding: 8, background: '#f8fafc', borderRadius: 4, fontSize: 12, color: '#475569' }}>
                <div><strong>检查：</strong>{currentReport.examItemName}</div>
                <div><strong>设备：</strong>{currentReport.deviceName || '—'}</div>
                <div><strong>检查日期：</strong>{currentReport.examDate}</div>
              </div>
            )}
          </div>

          {/* 临床病史输入 */}
          <div style={{
            background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0',
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
                width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4,
                fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{clinicalHistory.length} 字</div>
          </div>

          {/* AI 场景模板 */}
          <div style={{
            background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0',
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
                    background: selectedTemplateId === t.id ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${selectedTemplateId === t.id ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Sparkles size={11} color="#7c3aed" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{t.scenario}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                      {(t.confidence * 100).toFixed(0)}% 置信
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t.modality} · {t.bodyPart}</div>
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
              padding: 10, background: '#fff', borderRadius: 6,
              border: '1px solid #e2e8f0', fontSize: 12, color: '#475569',
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
              background: '#fff', borderRadius: 8, padding: 60, textAlign: 'center',
              border: '1px dashed #cbd5e1',
            }}>
              <Brain size={48} style={{ color: '#cbd5e1', display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>填写临床病史或选择 AI 场景模板</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>点击"一键生成"自动生成报告初稿</div>
            </div>
          ) : (
            <>
              {/* 来源信息 */}
              <div style={{
                background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)',
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
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {generatedDraft.sources.map((s, i) => (
                      <span key={i} style={{
                        fontSize: 12, padding: '1px 5px', borderRadius: 3,
                        background: '#fff', color: '#5b21b6', fontWeight: 600,
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 可编辑的所见 */}
              <div style={{
                background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0',
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
                    width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4,
                    fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 诊断 */}
              <div style={{
                background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lightbulb size={13} /> 诊断
                </div>
                <textarea
                  value={editedDiagnosis}
                  onChange={e => setEditedDiagnosis(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4,
                    fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 意见 */}
              <div style={{
                background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Beaker size={13} /> 诊断意见 / 建议
                </div>
                <textarea
                  value={editedImpression}
                  onChange={e => setEditedImpression(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4,
                    fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={saveAsDraft}
                  style={{
                    padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 6,
                    background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Save size={12} /> 保存草稿
                </button>
                <button
                  onClick={handleGenerate}
                  style={{
                    padding: '8px 16px', border: '1px solid #7c3aed', borderRadius: 6,
                    background: '#fff', color: '#7c3aed', fontSize: 12, fontWeight: 600,
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

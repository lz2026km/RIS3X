/**
 * G005 放射RIS系统 v3.0.6.8-19 — 报告书写 V3（优化版）
 * 优化: 懒加载 sider tab / 精简工具条 / 自动保存模拟 / 响应式
 */
import { AIDraftPanel } from '@components/report/v3/R3.WRITING/AIDraftPanel';
import { ImageAnchorComponent } from '@components/report/v3/R3.WRITING/ImageAnchor';
import { ReportRichEditor } from '@components/report/v3/R3.WRITING/ReportRichEditor';
import { StructuredFieldForm } from '@components/report/v3/R3.WRITING/StructuredFieldForm';
import { VoiceDictation } from '@components/report/v3/R3.WRITING/VoiceDictation';
import {
  REPORT_WRITING_CONTEXT_MOCK, KEYWORD_HIGHLIGHTS_MOCK, PRE_SUBMIT_SCORE_MOCK, REPORT_TEMPLATES_MOCK, PHRASES_MOCK,
} from '@data/reportWritingMock';
import { type SimilarCaseResult } from '@services/api';
import { aiDraftApi, type AiReportDraft, type ReportDraftStyle } from '@services/api/aiDraftApi';
import { examApi } from '@services/api/examApi';
import { reportApi } from '@services/api/reportApi';
import { templatesApi } from '@services/api/templatesApi';
import { v3WritingApi } from '@services/api/v3Api';
import { detectConflicts } from '@services/keywordConflictDetector';
import { computeDiff, type DiffChunk } from '@services/reportDiffEngine';
import { getCurrentUser } from '@utils/auth';
import {
  Layout, Card, Space, Button, Tag, Tooltip, Tabs, Divider,
  Alert, message, Modal, Progress, Empty, Badge, Input, Select, Spin, Collapse,
} from 'antd';
import { Save, Send, FileText, Mic, Image as ImageIcon, Brain, History, Eye, ChevronLeft, Sparkles, Tag as TagIcon, BarChart3, StickyNote, RefreshCw, AlertCircle, ListChecks, CheckCircle2, PanelRightClose, PanelRightOpen, Edit3, Printer, FileDown, ChevronUp, ChevronDown, BookMarked, Lock, ExternalLink, BadgeCheck, MonitorPlay , Type} from 'lucide-react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, SearchX } from 'lucide-react'

const { Sider, Content } = Layout;

/* ---------- 右侧各 Tab 内容（懒加载） ---------- */
function AITab({ reportId, modality, bodyPart, onApplyToEditor }: { reportId: string; modality: string; bodyPart: string; onApplyToEditor: (text: string) => void }) {
  return (
    <AIDraftPanel
      reportId={reportId}
      modality={modality}
      bodyPart={bodyPart}
      clinicalInfo="女性 58 岁,体检发现右肺上叶结节 1 周,无明显症状。"
      onAccept={(result) => {
        const text = [result?.findings, result?.impression, result?.recommendations].filter(Boolean).join('\n\n');
        onApplyToEditor(text || result?.findings || '');
        message.success('已应用 AI 草稿到编辑器');
      }}
    />
  );
}

function VoiceTab({ reportId, onInsert, onTextChange }: { reportId: string; onInsert: (text: string) => void; onTextChange: (text: string) => void }) {
  return <VoiceDictation reportId={reportId} onInsert={onInsert} onTextChange={onTextChange} />;
}

function HistoryTab({ priorReports, onCompare }: { priorReports: any[]; currentText: string; onCompare: (oldText: string, label: string) => void }) {
  if (priorReports.length === 0) return <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无历史报告" />;
  return (
    <div className="space-y-2">
      {priorReports.map((p: any) => (
        <div key={p.id} className="p-2 border border-slate-200 rounded text-xs">
          <div className="flex items-center justify-between">
            <Tag color="cyan">{p.reportId}</Tag>
            <span className="text-slate-400">{new Date(p.studyDate).toLocaleDateString()}</span>
          </div>
          <div className="text-slate-700 mt-1 line-clamp-2">{p.findings}</div>
          <div className="flex items-center gap-2 mt-2">
            {p.comparisonDelta && <Tag color="orange" className="text-[10px]">{p.comparisonDelta.summary}</Tag>}
            <Button size="small" type="link" className="text-[10px] p-0 h-auto" onClick={() => onCompare(p.findings, `${p.reportId} (${new Date(p.studyDate).toLocaleDateString()})`)}>
              对比当前
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

type CaseRow = SimilarCaseResult & Partial<import('@services/api').HybridSearchResult>;

function SimilarTab({ reportText, modality, bodyPart }: { reportText: string; modality: string; bodyPart: string }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseRow | null>(null);
  const [seriesList, setSeriesList] = useState<import('@services/api').ImageSeriesItem[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string | undefined>();

  useEffect(() => {
    import('@services/api').then(({ similarCaseApi }) => {
      similarCaseApi.listImageSeries().then((res) => {
        if (res.success && Array.isArray(res.data)) setSeriesList(res.data);
      }).catch(() => { /* 忽略 */ });
    });
  }, []);

  const run = useCallback(async (text: string, seriesUid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { similarCaseApi } = await import('@services/api');
      if (seriesUid) {
        const res = await similarCaseApi.hybridSearch({ reportText: text.trim(), seriesUID: seriesUid, limit: 5 });
        if (res.success && Array.isArray(res.data)) setCases(res.data as CaseRow[]);
        else setError('融合检索服务返回异常');
      } else {
        const res = await similarCaseApi.search({ reportText: text.trim(), modality, bodyPart, limit: 5 });
        if (res.success && Array.isArray(res.data)) setCases(res.data);
        else setError('检索服务返回异常');
      }
    } catch {
      setError('相似病例检索失败');
    } finally {
      setLoading(false);
    }
  }, [modality, bodyPart]);

  useEffect(() => {
    if (reportText.trim()) void run(reportText, selectedSeries);
  }, [reportText, run, selectedSeries]);

  if (error) return <Alert type="error" showIcon message={error} />;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{cases.length > 0 ? `基于当前草稿文本 · Top ${cases.length}` : '输入报告文本后自动检索;可选关联检查启用影像特征融合'}</span>
        <Space size={4}>
          <Select
            size="small" allowClear showSearch placeholder="关联检查(影像特征)"
            style={{ width: 180 }} value={selectedSeries} onChange={setSelectedSeries}
            options={seriesList.map((s) => ({ label: `${s.modality}·${s.bodyPart}`, value: s.seriesUid }))}
          />
          <Button size="small" icon={<RefreshCw className="w-3 h-3" />} onClick={() => run(reportText, selectedSeries)}>刷新</Button>
        </Space>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /> 检索中…</div>
      ) : cases.length === 0 ? (
        <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description="输入报告文本后自动检索相似病例" />
      ) : (
        <>
      {cases.map((c) => (
        <div key={c.id} className="p-2 border border-slate-200 rounded text-xs cursor-pointer hover:bg-slate-50" onClick={() => setDetail(c)}>
          <div className="flex items-center justify-between">
            <Space size={4}>
              <Tag color="purple">{c.reportId}</Tag>
              <Tag color="cyan">{c.modality}</Tag>
              <Tag>{c.bodyPart}</Tag>
              {c.gender && <span className="text-slate-400">{c.gender}{c.age}岁</span>}
            </Space>
            <Tag color="blue">{c.similarity}%</Tag>
          </div>
          <div className="text-slate-700 mt-1 line-clamp-2">{c.impression}</div>
          {typeof c.imageScore === 'number' && typeof c.textScore === 'number' && (
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
              <span>文本 <b className="text-slate-600">{Math.round(c.textScore * 100)}%</b></span>
              <span>影像 <b className="text-slate-600">{Math.round(c.imageScore * 100)}%</b></span>
              {c.featureSummary != null && <span>平均 {c.featureSummary.mean}</span>}
            </div>
          )}
          <Progress percent={c.similarity} size="small" strokeColor={c.similarity >= 70 ? '#16a34a' : '#f59e0b'} showInfo={false} style={{ marginTop: 4 }} />
        </div>
      ))}
      </>
      )}
      <Modal
        open={!!detail}
        title={detail ? `相似病例 ${detail.reportId} (相似度 ${detail.similarity}%)` : ''}
        footer={null}
        width={560}
        onCancel={() => setDetail(null)}
      >
        {detail && (() => {
          const summary = detail.featureSummary ?? null;
          const imageScore = typeof detail.imageScore === 'number' ? detail.imageScore : null;
          const textScore = typeof detail.textScore === 'number' ? detail.textScore : null;
          return (
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500">模态:</span> <Tag color="cyan">{detail.modality}</Tag>
                <span className="text-slate-500 ml-2">部位:</span> <Tag>{detail.bodyPart}</Tag>
                {detail.gender ? (
                  <span className="text-slate-500 ml-2">性别/年龄: {detail.gender} / {detail.age}岁</span>
                ) : null}
                {imageScore !== null && textScore !== null && (
                  <span className="text-slate-500 ml-2">文本 {Math.round(textScore * 100)}% · 影像 {Math.round(imageScore * 100)}%</span>
                )}
              </div>
              <div className="font-semibold text-slate-700">影像所见</div>
              <div className="text-slate-700 leading-relaxed">{detail.findings}</div>
              <div className="font-semibold text-slate-700">诊断意见</div>
              <div className="text-slate-700 leading-relaxed">{detail.impression}</div>
              {detail.conclusion && <div><Tag color="purple">{detail.conclusion}</Tag></div>}
              {summary && (
                <div>
                  <div className="font-semibold text-slate-700 mt-2">影像特征 (强度直方图)</div>
                  <div className="flex items-end gap-px h-14 mt-1">
                    {summary.histogram.map((v: number, i: number) => {
                      const max = Math.max(...summary.histogram, 1);
                      return <div key={i} className="flex-1 rounded-sm bg-indigo-400" style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />;
                    })}
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-400 mt-1">
                    <span>平均 {summary.mean}</span>
                    <span>p50 {summary.percentiles[2]}</span>
                    <span>高密度 {(summary.highDensityRatio * 100).toFixed(1)}%</span>
                    <span>低密度 {(summary.lowDensityRatio * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}
              <div className="text-slate-400">报告已匿名化</div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function ScoreTab({ preScore }: { preScore: any }) {
  return (
    <>
      <div className="text-center mb-3">
        <Progress type="circle" percent={preScore.score} size={80} strokeColor={preScore.passed ? '#10b981' : '#f59e0b'} format={(p) => <span className="text-2xl font-bold">{p}</span>} />
        <div className="text-xs text-slate-500 mt-1">{preScore.passed ? '可提交' : '需完善'}</div>
      </div>
      <Divider className="my-2" />
      <h5 className="text-xs font-semibold mb-1">检查清单</h5>
      <div className="space-y-1">
        {preScore.checklist.map((c: any) => (
          <div key={c.id} className="flex items-center gap-1 text-xs">
            {c.passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
            <span className={c.passed ? 'text-slate-500' : 'text-slate-800'}>{c.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function DraftsTab({ drafts }: { drafts: any[] }) {
  return (
    <div className="space-y-1.5">
      {drafts.map((d: any) => (
        <div key={d.id} className="p-2 border border-slate-200 rounded text-xs">
          <div className="flex items-center justify-between">
            <Tag color={d.autoSaved ? 'green' : 'default'}>{d.versionLabel}</Tag>
            <span className="text-slate-400">{new Date(d.updatedAt).toLocaleString()}</span>
          </div>
          <div className="text-slate-700 mt-1">{d.wordCount} 字</div>
          {d.autoSaved && <Tag color="success" className="text-[10px] mt-1">自动保存</Tag>}
        </div>
      ))}
    </div>
  );
}

function KWTab({ keywords }: { keywords: any[] }) {
  return (
    <div className="space-y-1">
      {keywords.map((k: any) => (
        <div key={k.term} className="flex items-center gap-2 text-xs p-1.5 rounded" style={{ background: k.bg, color: k.color }}>
          <Tag color="default" className="m-0">{k.category}</Tag>
          <span className="font-semibold">{k.term}</span>
          <span className="text-slate-500">/ {k.termEn}</span>
          <Tag className="m-0 text-[10px]">w{k.weight}</Tag>
        </div>
      ))}
    </div>
  );
}

function ComplianceTab() {
  const items = [
    { id: 'c1', label: '患者姓名与检查号匹配', labelEn: 'Patient name matches ID', passed: true },
    { id: 'c2', label: '检查部位与申请单一致', labelEn: 'Body part matches order', passed: true },
    { id: 'c3', label: '影像所见覆盖全部检查部位', labelEn: 'Findings cover all body parts', passed: true },
    { id: 'c4', label: '诊断意见与影像所见逻辑一致', labelEn: 'Impression consistent with findings', passed: true },
    { id: 'c5', label: '危急值已标注并通知临床', labelEn: 'Critical values annotated & notified', passed: false },
    { id: 'c6', label: '术语符合 ICD 编码规范', labelEn: 'Terms follow ICD coding', passed: true },
    { id: 'c7', label: '测量数据与图像一致', labelEn: 'Measurements match images', passed: true },
  ];
  return (
    <div className="space-y-1">
      {items.map((c) => (
        <div key={c.id} className="flex items-center gap-1 text-xs">
          {c.passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
          <span className={c.passed ? 'text-slate-500' : 'text-slate-800'}>{c.label}</span>
          <span className="text-slate-400">/ {c.labelEn}</span>
        </div>
      ))}
    </div>
  );
}

function CollabTab() {
  const collaborators = [
    { name: '陈医师', role: '报告医师', status: 'online', lastActive: '当前编辑' },
    { name: '王医师', role: '审核医师', status: 'online', lastActive: '10 分钟前' },
    { name: '李主任', role: '终审医师', status: 'offline', lastActive: '2 小时前' },
  ];
  return (
    <div className="space-y-2">
      {collaborators.map((c) => (
        <div key={c.name} className="flex items-center justify-between p-2 border border-slate-200 rounded text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${c.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`} />
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-slate-400">{c.role}</div>
            </div>
          </div>
          <span className="text-slate-400">{c.lastActive}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 主页面 ---------- */
/* V3 优化专用样式 */
const V3_STYLES = `
.v3-root { min-height: 100vh; background: var(--bg-primary); }
.v3-root .ant-layout-sider { background: var(--bg-card) !important; }
.v3-topbar { display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 8px 16px; flex-wrap: wrap; gap: 8px; }
.v3-topbar-left, .v3-topbar-right { display: flex; align-items: center; gap: 8px; }
.v3-topbar-title { font-weight: 600; white-space: nowrap; }
.v3-topbar-stats { font-size: 12px; color: #64748b; white-space: nowrap; }
.v3-topbar-autosave { font-size: 11px; color: #22c55e; white-space: nowrap; }
.v3-content { padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: calc(100vh - 53px); background: var(--bg-primary); }
.v3-content .v3-card { box-shadow: 0 1px 2px rgba(0,0,0,0.04); border-radius: 8px; }
.v3-clinical-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 12px; }
.v3-clinical-item { padding: 6px; background: var(--bg-card); border-radius: 4px; }
.v3-clinical-label { color: #64748b; font-size: 10px; }
.v3-clinical-code { font-family: monospace; color: #3b82f6; }
.v3-clinical-full { grid-column: 1 / -1; font-size: 12px; line-height: 1.6; background: var(--bg-card); padding: 6px 8px; border-radius: 4px; }
.v3-sider { overflow-y: auto; max-height: calc(100vh - 53px); border-left: 1px solid #e2e8f0; }
.v3-sider .ant-tabs-nav { margin-bottom: 0 !important; padding-top: 4px; }
.v3-sider .ant-tabs-extra-content, .v3-sider .ant-tabs-extra-content .ant-badge { pointer-events: none; }
.v3-sider-body { padding: 8px; }
.v3-sider-body .ant-card { border: 1px solid #e2e8f0; box-shadow: none; border-radius: 6px; }
@media (max-width: 1024px) { .v3-topbar-hide-mobile { display: none; } .v3-sider { width: 300px !important; max-width: 300px !important; } }
@media (max-width: 768px) { .v3-sider { display: none; } .v3-topbar-stats { display: none; } }
@media print {
  .no-print, .v3-topbar, .v3-sider { display: none !important; }
  .v3-root { background: #fff !important; }
  .v3-content { max-height: none !important; overflow: visible !important; padding: 0 !important; gap: 0 !important; background: #fff !important; }
  .v3-content .v3-card, .v3-content .ant-card { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
}
`;

export default function ReportWritePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // [v3.0.6.11-70] P0 真实化: reportId 从路由参数 / 报告列表选择获取, 不再写死 'rpt-038'
  const [reportId, setReportId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [context, setContext] = useState<any>(REPORT_WRITING_CONTEXT_MOCK);
  const [preScore] = useState(PRE_SUBMIT_SCORE_MOCK);
  // [v3.0.6.11-70] P0 真实化: 草稿列表来自 reportApi.list
  const [drafts, setDrafts] = useState<any[]>([]);
  const [showSubmit, setShowSubmit] = useState(false);
  const [siderVisible, setSiderVisible] = useState(true);
  const [activeToolsTab, setActiveToolsTab] = useState('ai');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveTip, setAutoSaveTip] = useState('已保存');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [diffTarget, setDiffTarget] = useState<{ oldText: string; label: string } | null>(null);
  const [voiceInsert, setVoiceInsert] = useState<{ text: string; ts: number } | null>(null);
  // [v3.0.6.11-70] 自动保存节流: 正在保存 / 无变更时跳过
  const savingRef = useRef(false);
  const lastSavedRef = useRef('');
  // [v3.0.6.11-61] 环境式 AI 报告草稿 (生成式草稿 + 医生确认)
  const [aiUi, setAiUi] = useState<{ open: boolean; clinical: string; findings: string; style: ReportDraftStyle; loading: boolean; error: string | null }>({
    open: false, clinical: '女性 58 岁,体检发现右肺上叶结节 1 周,无明显症状。', findings: '', style: 'standard', loading: false, error: null,
  });
  const [aiDraft, setAiDraft] = useState<AiReportDraft | null>(null);
  const [aiConfirm, setAiConfirm] = useState(false);
  const [aiEditMode, setAiEditMode] = useState(false);
  const [aiEditText, setAiEditText] = useState('');
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [editorSet, setEditorSet] = useState<{ plainText: string; ts: number } | null>(null);

  // [W2-2] 报告模板选择器 (自由文本模板)
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [selectingTemplate, setSelectingTemplate] = useState(false);
  const templateListRef = useRef<any[]>([]);
  // [W2-2] 短语库
  const [phraseOpen, setPhraseOpen] = useState(false);
  const [phrases, setPhrases] = useState<any[]>([]);
  const [phraseLoading, setPhraseLoading] = useState(true);
  // [W2-2] 上下例导航 (reportApi.list 上下文)
  const [reportList, setReportList] = useState<any[]>([]);
  const [listIndex, setListIndex] = useState(0);
  // [W2-2] 报告锁 / 并发冲突提示
  const [lockConflict, setLockConflict] = useState(false);
  const lastKnownUpdatedAtRef = useRef<string | null>(null);
  // [W2-2] 打印 / 导出
  const [exporting, setExporting] = useState(false);

  // [v3.0.6.11-70] 挂载: 解析 reportId → 加载上下文(患者/检查/临床信息) → 草稿列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const queryId = searchParams.get('reportId');
      const presetExamId = searchParams.get('examId');
      const presetStudyUid = searchParams.get('studyUid');
      let target: string | null = queryId;
      // [G005 放射流程P0] 阅片→报告: 无 reportId 但有 examId → 查该检查已有报告, 无则从检查数据新建报告预填
      if (!target && presetExamId) {
        try {
          const listRes = await reportApi.list({ take: '100' });
          const arr = listRes.success
            ? (Array.isArray(listRes.data)
                ? listRes.data
                : ((listRes.data as { items?: unknown[] })?.items ?? []))
            : [];
          const byExam = arr.find((r) => String((r as any)?.examId ?? '') === presetExamId);
          if (byExam) {
            target = (byExam as any).reportId || (byExam as any).id;
          } else {
            const examRes = await examApi.getById(presetExamId);
            if (examRes.success && examRes.data) {
              const d = examRes.data;
              const user = getCurrentUser();
              const createRes = await reportApi.create({
                examId: presetExamId,
                patientId: d.patientId || d.examId,
                patientName: d.patientName,
                modality: d.modality,
                bodyPart: d.bodyPart,
                radiologistId: user?.id,
                findings: '',
                conclusion: '',
              });
              if (createRes.success && createRes.data) target = createRes.data.reportId || createRes.data.id;
            }
          }
        } catch {
          // 加载失败回退下方现有逻辑
        }
      }
      if (!target) {
        const listRes = await reportApi.list({ take: '20' });
        if (listRes.success && Array.isArray(listRes.data) && listRes.data.length > 0) {
          const prefer = listRes.data.find((r) => !/(已发布|已审核|已双签|published|reviewed|signed|REVIEWED|PUBLISHED|SIGNED)/i.test(r.status ?? '')) ?? listRes.data[0];
          if (prefer) target = prefer.reportId || prefer.id;
        }
      }
      if (!target) {
        const user = getCurrentUser();
        const createRes = await reportApi.create({
          patientId: REPORT_WRITING_CONTEXT_MOCK.patientId,
          radiologistId: user?.id,
          findings: REPORT_WRITING_CONTEXT_MOCK.document.plainText,
          conclusion: REPORT_WRITING_CONTEXT_MOCK.document.plainText,
        });
        if (createRes.success && createRes.data) target = createRes.data.reportId || createRes.data.id;
      }
      if (cancelled || !target) return;
      setReportId(target);
      lastSavedRef.current = '';
      const ctxRes = await reportApi.getById(target);
      if (ctxRes.success && ctxRes.data) {
        const d = ctxRes.data;
        lastKnownUpdatedAtRef.current = d.updatedTime ?? null;
        const plainText = [d.findings, d.impression, d.recommendations].filter(Boolean).join('\n\n');
        setContext((c: any) => ({
          ...c,
          reportId: d.reportId || d.id,
          patientId: d.patientId || c.patientId,
          examId: d.examId || c.examId,
          studyUid: presetStudyUid ?? c.studyUid,
          modality: d.modality || c.modality,
          bodyPart: d.bodyPart || c.bodyPart,
          patientName: d.patientName || '',
          clinicalDiagnosis: d.clinicalDiagnosis || '',
          status: d.status || '',
          document: {
            ...c.document,
            reportId: d.reportId || d.id,
            html: `<h2>影像所见</h2><p>${d.findings ?? ''}</p><h2>诊断意见</h2><p>${d.impression ?? ''}</p>`,
            plainText,
            wordCount: plainText.length || c.document.wordCount,
            lastEditedAt: d.updatedTime,
          },
        }));
        if (d.examId) {
          const examRes = await examApi.getById(d.examId);
          if (examRes.success && examRes.data) {
            setContext((c: any) => ({ ...c, gender: examRes.data!.gender, age: examRes.data!.age }));
          }
        }
      }
      const draftsRes = await reportApi.list({ take: '20' });
      if (draftsRes.success && Array.isArray(draftsRes.data)) {
        setDrafts(draftsRes.data.map((r, i) => ({
          id: `${r.reportId || r.id}-${i}`,
          reportId: r.reportId || r.id,
          versionLabel: `v${i + 1}`,
          updatedAt: r.updatedTime,
          wordCount: (r.findings ?? '').length,
          autoSaved: i > 0,
        })));
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  // [W2-2] 加载自由文本模板列表 (templatesApi → mock 兜底)
  useEffect(() => {
    let cancelled = false;
    templatesApi.list().then((res) => {
      if (cancelled) return;
      const arr = Array.isArray(res.data) ? res.data : ((res.data as any)?.items ?? []);
      setTemplateList(arr.length > 0 ? arr : REPORT_TEMPLATES_MOCK);
    }).catch(() => { if (!cancelled) setTemplateList(REPORT_TEMPLATES_MOCK); })
      .finally(() => { if (!cancelled) setTemplateLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { templateListRef.current = templateList; }, [templateList]);

  // [W2-2] 加载短语库 (v3WritingApi.listPhrases → mock 兜底)
  useEffect(() => {
    let cancelled = false;
    v3WritingApi.listPhrases().then((res) => {
      if (cancelled) return;
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setPhrases(res.data);
      else setPhrases(PHRASES_MOCK);
    }).catch(() => { if (!cancelled) setPhrases(PHRASES_MOCK); })
      .finally(() => { if (!cancelled) setPhraseLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // [W2-2] 上下例导航: 加载报告列表上下文 + 定位当前报告索引
  useEffect(() => {
    let cancelled = false;
    reportApi.list({ take: '100' }).then((res) => {
      if (cancelled || !res.success) return;
      const arr = Array.isArray(res.data) ? res.data : ((res.data as any)?.items ?? []);
      if (arr.length > 0) setReportList(arr);
    }).catch(() => { /* 列表加载失败时禁用上下例 */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!reportId || reportList.length === 0) return;
    const idx = reportList.findIndex((r) => (r.reportId || r.id) === reportId);
    setListIndex(idx >= 0 ? idx : 0);
  }, [reportId, reportList]);

  // [v3.0.6.11-70] P0 真实化: 保存当前编辑器内容 → POST /reports 或 PATCH /reports/:id
  const doSave = useCallback(async (silent: boolean): Promise<boolean> => {
    if (!reportId || savingRef.current) return false;
    savingRef.current = true;
    if (!silent) setSaving(true);
    try {
      const plainText = context.document.plainText ?? '';
      const conclusion = context.document.plainText ?? '';
      const existing = await reportApi.getById(reportId);
      // [W2-2] 报告锁: 无后端锁概念 → 本地并发冲突检测 (保存前对比 updatedAt)
      if (existing.success && existing.data && existing.data.updatedTime) {
        if (lastKnownUpdatedAtRef.current && existing.data.updatedTime !== lastKnownUpdatedAtRef.current) {
          setLockConflict(true);
        }
      }
      const res = existing.success && existing.data
        ? await reportApi.update(reportId, { findings: plainText, conclusion })
        : await reportApi.create({ patientId: context.patientId || reportId, examId: reportId, findings: plainText, conclusion });
      if (res.success) {
        if (res.data?.reportId && res.data.reportId !== reportId) setReportId(res.data.reportId);
        lastKnownUpdatedAtRef.current = res.data?.updatedTime ?? existing.data?.updatedTime ?? new Date().toISOString();
        lastSavedRef.current = `${plainText}|${context.document.html ?? ''}`;
        if (!silent) message.success(lockConflict ? '已保存 (检测到并发修改,已覆盖最新版本)' : '报告已保存');
        return true;
      }
      if (!silent) message.error(res.error?.message ?? '保存失败,请稍后重试');
      return false;
    } catch {
      if (!silent) message.error('保存失败,请检查网络后重试');
      return false;
    } finally {
      savingRef.current = false;
      if (!silent) setSaving(false);
    }
  }, [reportId, context, lockConflict]);

  // [v3.0.6.11-70] 自动保存: 30 秒定时真实保存(节流: 保存中/无变更跳过)
  useEffect(() => {
    const timer = setInterval(() => {
      if (savingRef.current || !reportId) return;
      const snapshot = `${context.document.plainText ?? ''}|${context.document.html ?? ''}`;
      if (snapshot === lastSavedRef.current) return;
      setAutoSaveTip('自动保存中…');
      void doSave(true).then((ok) => {
        setAutoSaveTip(ok ? `已自动保存 ${new Date().toLocaleTimeString()}` : '自动保存失败');
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [reportId, context.document.plainText, context.document.html, doSave]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    const r = await import('@services/writing/writingService').then((m) =>
      m.submitReport(reportId ?? '', {
        finalScore: preScore.score,
        structured: context.fields,
        html: context.document.html ?? '',
        plainText: context.document.plainText ?? '',
        conclusion: context.document.plainText ?? '',
      })
    );
    setSubmitting(false);
    if (r.success) {
      message.success('报告已提交审核');
      setShowSubmit(false);
      setTimeout(() => navigate('/report-review'), 1500);
    } else {
      message.error('提交失败:报告状态不可提交或网络异常,请先保存后重试');
    }
  }, [reportId, preScore, context, navigate]);

  // [W2-2] 签署 / 发布入口 (状态机: REVIEWED → SIGNED → PUBLISHED)
  // 兼容后端英文枚举 + MSW 中文状态
  const statusRaw = String(context.status ?? '').trim();
  const reportStatus = statusRaw.toUpperCase();
  const canSign = ['REVIEWED', 'SIGNING'].includes(reportStatus) || ['已审核', '待签署'].includes(statusRaw);
  const canPublish = reportStatus === 'SIGNED' || statusRaw === '已签署';
  const isPublished = reportStatus === 'PUBLISHED' || statusRaw === '已发布';
  const inFlight = ['SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW'].includes(reportStatus) || ['已提交', '审核中', '审核'].includes(statusRaw);
  const isLocked = isPublished;

  const handleSign = useCallback(async () => {
    if (!reportId) return;
    const res = await reportApi.sign(reportId);
    if (res.success) {
      message.success('报告已签署 (SIGNED)');
      setContext((c: any) => ({ ...c, status: 'SIGNED' }));
      setLockConflict(false);
    } else {
      message.error(res.error?.message ?? '签署失败,请稍后重试');
    }
  }, [reportId]);

  const handlePublish = useCallback(async () => {
    if (!reportId) return;
    const res = await reportApi.publish(reportId);
    if (res.success) {
      message.success('报告已发布 (PUBLISHED)');
      setContext((c: any) => ({ ...c, status: 'PUBLISHED' }));
      setLockConflict(false);
    } else {
      message.error(res.error?.message ?? '发布失败,请稍后重试');
    }
  }, [reportId]);

  // [W2-2] 打印 / 导出
  const handlePrint = useCallback(() => {
    if (!reportId) return;
    window.print();
  }, [reportId]);

  const handleExport = useCallback(async () => {
    if (!reportId) return;
    setExporting(true);
    try {
      const res = await reportApi.exportReport(reportId, 'pdf');
      if (!res.success) {
        message.error(res.error?.message ?? '导出失败,请稍后重试');
        return;
      }
      const url = res.data?.downloadUrl;
      if (url) {
        try {
          const r = await fetch(url);
          const type = r.headers.get('content-type') ?? '';
          if (r.ok && (type.includes('pdf') || type.includes('octet-stream'))) {
            const blob = await r.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${reportId}.pdf`;
            a.click();
            URL.revokeObjectURL(a.href);
            message.success('报告 PDF 已导出');
            return;
          }
        } catch { /* 后端异步生成时走下方提示 */ }
        console.info('[export] queued:', url);
        message.success('导出任务已入队,后端生成完成后可下载 PDF');
      } else {
        message.success('导出任务已入队');
      }
    } finally {
      setExporting(false);
    }
  }, [reportId]);

  // [W2-2] 报告模板选择: 加载模板内容到编辑器
  const handleSelectTemplate = useCallback(async (id: string) => {
    if (!id) return;
    setSelectingTemplate(true);
    try {
      let content = '';
      const cached = templateListRef.current.find((t) => t.id === id);
      if (cached && (cached.content || cached.body)) {
        content = cached.content || cached.body || '';
      } else {
        const res = await templatesApi.getById(id);
        if (res.success && res.data) content = (res.data as any).content ?? res.data.body ?? '';
      }
      if (content) {
        setEditorSet({ plainText: content, ts: Date.now() });
        message.success(`已应用模板「${cached?.name ?? id}」到编辑器`);
      } else {
        message.info('该模板为结构化模板(无自由文本),请使用下方结构化字段表单填写');
      }
    } catch {
      message.error('模板加载失败,请重试');
    } finally {
      setSelectingTemplate(false);
    }
  }, []);

  // [W2-2] 上下例导航
  const switchToReport = useCallback((r: any) => {
    const id = r?.reportId || r?.id;
    if (!id || id === reportId) return;
    navigate(`/write-report?reportId=${encodeURIComponent(id)}`);
  }, [reportId, navigate]);

  const goPrev = useCallback(() => {
    if (listIndex > 0) switchToReport(reportList[listIndex - 1]);
  }, [listIndex, reportList, switchToReport]);

  const goNext = useCallback(() => {
    if (listIndex < reportList.length - 1) switchToReport(reportList[listIndex + 1]);
  }, [listIndex, reportList, switchToReport]);

  // [W2-2] 短语库插入 (复用语音听写 externalInsert 通道,插入光标处)
  const insertPhrase = useCallback((p: any) => {
    const text = p?.content || p?.text || '';
    if (!text) return;
    setVoiceInsert({ text, ts: Date.now() });
    setPhraseOpen(false);
    message.success('短语已插入编辑器');
  }, []);

  // [W2-2] 影像视口: 跳转完整 DICOM 查看器
  const openViewer = useCallback((studyUid?: string) => {
    const params = new URLSearchParams();
    if (studyUid) params.set('studyUid', studyUid);
    if (context.examId) params.set('examId', context.examId);
    navigate(`/dicom-viewer?${params.toString()}`);
  }, [context.examId, navigate]);

  // [v3.0.6.11-61] 环境式 AI 草稿生成
  const handleAiGenerate = useCallback(async () => {
    setAiUi((u) => ({ ...u, loading: true, error: null }));
    const res = await aiDraftApi.generateReportDraft({
      reportId: context.reportId,
      patientId: context.patientId,
      modality: context.modality,
      bodyPart: context.bodyPart,
      clinicalInfo: aiUi.clinical,
      findings: aiUi.findings,
      style: aiUi.style,
    });
    if (res.success && res.data) {
      setAiDraft(res.data);
      setAiEditText(res.data.draftText);
      setAiEditMode(false);
      setAiConfirm(true);
      setAiUi((u) => ({ ...u, open: false, loading: false }));
    } else {
      setAiUi((u) => ({ ...u, loading: false, error: res.error?.message ?? 'AI 草稿生成失败' }));
    }
  }, [aiUi.clinical, aiUi.findings, aiUi.style, context.reportId, context.patientId, context.modality, context.bodyPart]);

  // 医生接受: 草稿 → 正式, 应用至编辑器
  const handleAiAccept = useCallback(async () => {
    if (!aiDraft) return;
    setAiActionLoading(true);
    const res = await aiDraftApi.acceptDraft(aiDraft.id);
    if (res.success && res.data) {
      setEditorSet({ plainText: res.data.draftText, ts: Date.now() });
      setAiConfirm(false);
      message.success('已接受 AI 草稿并应用至编辑器');
    } else {
      message.error(res.error?.message ?? '接受草稿失败');
    }
    setAiActionLoading(false);
  }, [aiDraft]);

  // 医生修改后保存
  const handleAiModifySave = useCallback(async () => {
    if (!aiDraft) return;
    setAiActionLoading(true);
    const res = await aiDraftApi.modifyDraft(aiDraft.id, aiEditText);
    if (res.success && res.data) {
      setEditorSet({ plainText: res.data.draftText, ts: Date.now() });
      setAiConfirm(false);
      message.success('已保存修改并应用至编辑器');
    } else {
      message.error(res.error?.message ?? '保存修改失败');
    }
    setAiActionLoading(false);
  }, [aiDraft, aiEditText]);

  const applyAiTextToEditor = useCallback((text: string) => {
    if (!text) return;
    setEditorSet({ plainText: text, ts: Date.now() });
  }, []);

  const siderTabs = useMemo(() => [
    { key: 'ai', label: <Space size={4}><Sparkles className="w-3 h-3" />AI 草稿</Space>, children: null },
    { key: 'voice', label: <Space size={4}><Mic className="w-3 h-3" />语音</Space>, children: null },
    { key: 'history', label: <Space size={4}><History className="w-3 h-3" />历史报告</Space>, children: null },
    { key: 'similar', label: <Space size={4}><Brain className="w-3 h-3" />相似病例</Space>, children: null },
    { key: 'score', label: <Space size={4}><BarChart3 className="w-3 h-3" />预评分</Space>, children: null },
    { key: 'drafts', label: <Space size={4}><Save className="w-3 h-3" />草稿</Space>, children: null },
    { key: 'kw', label: <Space size={4}><TagIcon className="w-3 h-3" />关键词</Space>, children: null },
    { key: 'compliance', label: <Space size={4}><ListChecks className="w-3 h-3" />合规</Space>, children: null },
    { key: 'collab', label: <Space size={4}><Eye className="w-3 h-3" />协作</Space>, children: null },
  ], []);

  const renderActiveTab = () => {
    switch (activeToolsTab) {
      case 'ai': return <AITab reportId={reportId ?? ''} modality={context.modality} bodyPart={context.bodyPart} onApplyToEditor={applyAiTextToEditor} />;
      case 'voice': return <VoiceTab reportId={reportId ?? ''} onInsert={(text) => setVoiceInsert({ text, ts: Date.now() })} onTextChange={() => { /* 实时文本由编辑器插入按钮统一处理 */ }} />;
      case 'history': return <HistoryTab priorReports={context.priorReports} currentText={context.document.plainText} onCompare={(oldText, label) => setDiffTarget({ oldText, label })} />;
      case 'similar': return <SimilarTab reportText={context.document.plainText} modality={context.modality} bodyPart={context.bodyPart} />;
      case 'score': return <ScoreTab preScore={preScore} />;
      case 'drafts': return <DraftsTab drafts={drafts} />;
      case 'kw': return <KWTab keywords={KEYWORD_HIGHLIGHTS_MOCK} />;
      case 'compliance': return <ComplianceTab />;
      case 'collab': return <CollabTab />;
      default: return null;
    }
  };

  const PASSED_COUNT = preScore.checklist.filter((c: any) => c.passed).length;

  return (
    <Layout className="v3-root">
      <style>{V3_STYLES}</style>
      {/* 顶部工具条 */}
      <div className="v3-topbar no-print">
        <div className="v3-topbar-left">
          <Button type="text" icon={<ChevronLeft className="w-4 h-4" />} onClick={() => navigate(-1)} />
          <span className="v3-topbar-title">报告书写</span>
          <Tag color="blue">{context.reportId}</Tag>
          <Tag color="purple">{context.modality} - {context.bodyPart}</Tag>
          <Tag color={preScore.passed ? 'success' : 'warning'}>
            {preScore.passed ? '可提交' : '需完善'}
          </Tag>
          {/* [W2-2] 报告模板选择器: 下拉选择自由文本模板 → 加载到编辑器 */}
          <Select
            size="small"
            style={{ minWidth: 190 }}
            placeholder="选择报告模板"
            loading={templateLoading || selectingTemplate}
            value={undefined}
            allowClear
            options={templateList.map((t: any) => ({ value: t.id, label: `${t.name}${t.category ? ` (${t.category})` : ''}` }))}
            onChange={(v) => { if (v) void handleSelectTemplate(String(v)); }}
            popupMatchSelectWidth={320}
          />
          {/* [W2-2] 上下例导航 */}
          <Tooltip title="上一例">
            <Button type="text" size="small" disabled={listIndex <= 0} icon={<ChevronUp className="w-4 h-4" />} onClick={goPrev} />
          </Tooltip>
          <Tooltip title="下一例">
            <Button type="text" size="small" disabled={listIndex >= reportList.length - 1} icon={<ChevronDown className="w-4 h-4" />} onClick={goNext} />
          </Tooltip>
          {reportList.length > 0 && (
            <span className="v3-topbar-stats v3-topbar-hide-mobile">{listIndex + 1} / {reportList.length}</span>
          )}
          {isLocked && <Tag icon={<Lock className="w-3 h-3" />} color="volcano">已锁定</Tag>}
        </div>
        <div className="v3-topbar-right">
          <Tooltip title="环境式 AI 生成报告草稿 (所见+结论+建议)">
            <Button icon={<Sparkles className="w-4 h-4" />} onClick={() => setAiUi((u) => ({ ...u, open: true }))}>AI 草稿</Button>
          </Tooltip>
          <Tooltip title="保存草稿">
            <Button icon={<Save className="w-4 h-4" />} loading={saving} onClick={() => void doSave(false)}>保存</Button>
          </Tooltip>
          {/* [W2-2] 打印 / PDF 导出 */}
          <Tooltip title="打印当前报告内容">
            <Button icon={<Printer className="w-4 h-4" />} onClick={handlePrint} disabled={!reportId}>打印</Button>
          </Tooltip>
          <Tooltip title="导出为 PDF (reportApi.exportReport)">
            <Button icon={<FileDown className="w-4 h-4" />} loading={exporting} onClick={() => void handleExport()} disabled={!reportId}>导出</Button>
          </Tooltip>
          {/* [W2-2] 短语库插入 */}
          <Tooltip title="从短语库选择常用语插入编辑器">
            <Button icon={<BookMarked className="w-4 h-4" />} onClick={() => setPhraseOpen(true)}>短语库</Button>
          </Tooltip>
          <span className="v3-topbar-stats v3-topbar-hide-mobile">
            {context.document.wordCount} 字 / {Math.round(context.document.writingDurationSec / 60)} 分
          </span>
          <span className="v3-topbar-autosave">{autoSaveTip}</span>
          {/* [W2-2] 签署 / 发布入口 (按状态机显示) */}
          {canSign ? (
            <Button type="primary" icon={<BadgeCheck className="w-4 h-4" />} onClick={() => void handleSign()}>
              签署 (SIGNED)
            </Button>
          ) : canPublish ? (
            <Button type="primary" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => void handlePublish()}>
              发布 (PUBLISHED)
            </Button>
          ) : !isLocked && !inFlight ? (
            <Button type="primary" icon={<Send className="w-4 h-4" />} onClick={() => {
              const found = detectConflicts(context.document.plainText);
              setConflicts(found);
              setShowSubmit(true);
            }}>
              提交审核
            </Button>
          ) : null}
          <Tooltip title={siderVisible ? '收起侧栏' : '展开侧栏'}>
            <Button type="text" icon={siderVisible ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />} onClick={() => setSiderVisible((v) => !v)} />
          </Tooltip>
        </div>
      </div>

      <Layout>
        {/* 主内容区 */}
        <Content className="v3-content">
          {/* [W2-2] 报告锁 / 并发冲突提示 */}
          {isLocked && (
            <Alert
              type="info"
              showIcon
              className="no-print"
              icon={<Lock className="w-4 h-4" />}
              message={`报告状态为 ${context.status},内容已锁定,仅供查看(如需修改请走修订流程)`}
            />
          )}
          {lockConflict && (
            <Alert
              type="warning"
              showIcon
              className="no-print"
              message="检测到并发修改:该报告已被其他医师更新(本地仍基于旧版本编辑),继续保存将覆盖最新内容"
            />
          )}
          <Card size="small" className="v3-card no-print" title={<Space><StickyNote className="w-4 h-4" /><span>临床信息</span></Space>}>
            <div className="v3-clinical-grid">
              <div className="v3-clinical-item"><div className="v3-clinical-label">患者</div><div className="font-semibold">{context.patientName || '张三'}</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">性别 / 年龄</div><div>{(context.gender || '男')} / {(context.age || 58)} 岁</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">检查号</div><div className="v3-clinical-code">{context.patientId}</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">临床诊断</div><div>{context.clinicalDiagnosis || '右肺占位性病变'}</div></div>
              <div className="v3-clinical-full">
                <b>报告状态:</b>{' '}
                {(() => {
                  const s = String(context.status ?? '');
                  return s ? s : '草稿';
                })()}<br />
                <b>主诉:</b>体检发现右肺结节 1 周<br />
                <b>现病史:</b>患者 1 周前体检发现右肺上叶结节<br />
                <b>既往史:</b>无肿瘤病史
              </div>
            </div>
          </Card>

          {/* [W2-2] 内嵌影像视口 (折叠面板: 缩略列表 + 跳转完整查看器) */}
          <Card size="small" className="v3-card no-print" title={<Space><MonitorPlay className="w-4 h-4 text-purple-500" /><span>影像视口</span></Space>}>
            <Collapse
              size="small"
              items={[{
                key: 'images',
                label: `当前检查影像 (${context.modality} · ${context.bodyPart}${context.examId ? ` · ${context.examId}` : ''})`,
                children: (
                  <div className="flex items-center gap-3 flex-wrap">
                    {(() => {
                      const mods = context.multiModality?.modalities ?? [];
                      if (mods.length > 0) {
                        return mods.map((m: any) => (
                          <div key={m.modality} className="flex flex-col items-center gap-1">
                            <img
                              src={m.thumbnail}
                              alt={m.modality}
                              loading="lazy"
                              className="w-36 h-28 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80"
                              onClick={() => openViewer(m.studyUID)}
                            />
                            <span className="text-xs text-slate-500">{m.modality} · {m.seriesCount} 序列</span>
                          </div>
                        ));
                      }
                      return (
                        <>
                          <div className="flex flex-col items-center gap-1">
                            <img src="/mock/thumb-ct-001.png" alt="CT-1" loading="lazy" className="w-36 h-28 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80" onClick={() => openViewer()} />
                            <span className="text-xs text-slate-500">CT 横断面</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <img src="/mock/thumb-ct-002.png" alt="CT-2" loading="lazy" className="w-36 h-28 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80" onClick={() => openViewer()} />
                            <span className="text-xs text-slate-500">CT 增强</span>
                          </div>
                        </>
                      );
                    })()}
                    <Button
                      icon={<ExternalLink className="w-3 h-3" />}
                      onClick={() => openViewer(context.multiModality?.modalities?.[0]?.studyUID)}
                    >
                      打开完整影像浏览器
                    </Button>
                  </div>
                ),
              }]}
            />
          </Card>

          <Card size="small" className="v3-card no-print" title={<Space><FileText className="w-4 h-4 text-blue-500" /><span>结构化字段</span><Tag color="blue">RECIST 1.1</Tag></Space>}>
            <StructuredFieldForm
              reportId={reportId ?? ''}
              initialTemplateId="recist"
              initialValues={context.fields}
              onChange={(values) => setContext((c: any) => ({ ...c, fields: values }))}
            />
          </Card>

          <Card size="small" className="v3-card print-area" title={<Space><Type className="w-4 h-4 text-cyan-500" /><span>所见 / 诊断 / 建议</span></Space>}>
            <ReportRichEditor
              reportId={reportId ?? ''}
              initialHtml={context.document.html}
              initialPlainText={context.document.plainText}
              readOnly={isLocked}
              onChange={(doc) => setContext((c: any) => ({ ...c, document: doc }))}
              externalInsert={voiceInsert}
              onExternalInsertConsumed={() => setVoiceInsert(null)}
              externalSet={editorSet}
              onExternalSetConsumed={() => setEditorSet(null)}
            />
          </Card>

          <Card size="small" className="v3-card no-print" title={<Space><ImageIcon className="w-4 h-4 text-purple-500" /><span>关键图像与影像锚定</span><Tag color="purple">{context.anchors.length}</Tag></Space>}>
            <ImageAnchorComponent reportId={reportId ?? ''} />
          </Card>
        </Content>

        {/* 右侧 Sider（懒加载内容） */}
        {siderVisible && (
          <Sider width={360} theme="light" className="v3-sider">
            <Tabs
              activeKey={activeToolsTab}
              onChange={setActiveToolsTab}
              size="small"
              tabBarStyle={{ margin: 0, paddingLeft: 8 }}
              tabBarExtraContent={
                <Badge
                  count={drafts.length}
                  title={`草稿 ${drafts.length} 个`}
                  style={{ backgroundColor: '#7c3aed' }}
                />
              }
              items={siderTabs}
            />
            <div className="v3-sider-body">
              {renderActiveTab()}
            </div>
          </Sider>
        )}
      </Layout>

      {/* 提交确认 Modal */}
      <Modal
        title={<Space><Send className="w-4 h-4" /><span>提交审核确认</span></Space>}
        open={showSubmit}
        onCancel={() => setShowSubmit(false)}
        footer={null}
        width={580}
        destroyOnHidden
      >
        {conflicts.length > 0 && (
          <Alert
            type="error"
            showIcon
            className="mb-3"
            title={
              <div>
                <div className="font-semibold">检测到 {conflicts.length} 项关键词冲突</div>
                {conflicts.map((c: any, i: number) => (
                  <div key={i} className="text-xs mt-1">• {c.message}</div>
                ))}
              </div>
            }
          />
        )}
        <Alert
          type={preScore.passed ? 'success' : 'warning'}
          showIcon
          className="mb-3"
          title={preScore.passed ? '所有检查项已通过,可以提交' : `部分检查项未通过 (${PASSED_COUNT}/${preScore.checklist.length})`}
        />
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold mb-1">检查清单 ({PASSED_COUNT}/{preScore.checklist.length})</div>
            <div className="space-y-1">
              {preScore.checklist.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  {c.passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
                  <span className={c.passed ? 'text-slate-500' : 'text-slate-800'}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <Divider className="my-2" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-slate-50 rounded text-center">
              <div className="text-slate-500">预评分</div>
              <div className="text-lg font-semibold" style={{ color: preScore.passed ? '#10b981' : '#f59e0b' }}>{preScore.score} / 100</div>
            </div>
            <div className="p-3 bg-slate-50 rounded text-center">
              <div className="text-slate-500">字数 / 时长</div>
              <div className="text-lg font-semibold">{context.document.wordCount} 字 / {Math.round(context.document.writingDurationSec / 60)} 分</div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowSubmit(false)}>取消</Button>
            <Button type="primary" icon={<Send className="w-3 h-3" />} onClick={handleSubmit} loading={submitting} disabled={conflicts.length > 0}>确认提交</Button>
          </div>
        </div>
      </Modal>
      {/* [v3.0.6.11-61] 环境式 AI 报告草稿: 输入弹窗 + 确认面板 */}
      <AiDraftInputModal
        open={aiUi.open}
        modality={context.modality}
        bodyPart={context.bodyPart}
        clinical={aiUi.clinical}
        findings={aiUi.findings}
        style={aiUi.style}
        loading={aiUi.loading}
        error={aiUi.error}
        onClinical={(v) => setAiUi((u) => ({ ...u, clinical: v }))}
        onFindings={(v) => setAiUi((u) => ({ ...u, findings: v }))}
        onStyle={(v) => setAiUi((u) => ({ ...u, style: v }))}
        onCancel={() => setAiUi((u) => ({ ...u, open: false, error: null }))}
        onGenerate={handleAiGenerate}
      />
      {aiConfirm && aiDraft && (
        <AiDraftConfirmModal
          draft={aiDraft}
          currentText={context.document.plainText}
          editMode={aiEditMode}
          editText={aiEditText}
          actionLoading={aiActionLoading}
          onEditMode={setAiEditMode}
          onEditText={setAiEditText}
          onAccept={handleAiAccept}
          onModifySave={handleAiModifySave}
          onDiscard={() => setAiConfirm(false)}
        />
      )}
      {/* 版本对比 Modal */}
      {diffTarget && (
        <DiffViewModal
          oldText={diffTarget.oldText}
          newText={context.document.plainText}
          label={diffTarget.label}
          onClose={() => setDiffTarget(null)}
        />
      )}
      {/* [W2-2] 短语库插入 Modal */}
      <PhraseLibraryModal
        open={phraseOpen}
        phrases={phrases}
        loading={phraseLoading}
        onClose={() => setPhraseOpen(false)}
        onPick={insertPhrase}
      />
    </Layout>
  );
}

/* ---------- [v3.0.6.11-61] 环境式 AI 报告草稿: 输入弹窗 + 确认面板 ---------- */

const AI_STYLE_OPTIONS = [
  { value: 'concise', label: '简洁', desc: '每段仅保留要点' },
  { value: 'standard', label: '标准', desc: '完整结构化模板' },
  { value: 'detailed', label: '详细', desc: '模板 + 补充描述' },
];

function AiDraftInputModal({ open, modality, bodyPart, clinical, findings, style, loading, error, onClinical, onFindings, onStyle, onCancel, onGenerate }: {
  open: boolean;
  modality: string;
  bodyPart: string;
  clinical: string;
  findings: string;
  style: ReportDraftStyle;
  loading: boolean;
  error: string | null;
  onClinical: (v: string) => void;
  onFindings: (v: string) => void;
  onStyle: (v: ReportDraftStyle) => void;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  return (
    <Modal
      title={<Space><Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} /><span>AI 生成报告草稿</span><Tag color="purple">{modality} - {bodyPart}</Tag></Space>}
      open={open}
      onCancel={onCancel}
      width={560}
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" icon={<Sparkles className="w-3 h-3" />} onClick={onGenerate} loading={loading} disabled={loading}>
            生成草稿
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pt-2">
        <Alert type="info" showIcon message="AI 草稿仅供临床参考,最终诊断须由执业医师确认" className="mb-2" />
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">临床信息</div>
          <Input.TextArea
            value={clinical}
            onChange={(e) => onClinical(e.target.value)}
            placeholder="请输入主诉/现病史/既往史等临床信息"
            rows={3}
          />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">发现关键词 (可选)</div>
          <Input
            value={findings}
            onChange={(e) => onFindings(e.target.value)}
            placeholder="例: 右肺上叶结节影 / 腰椎退行性变"
          />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">详细度</div>
          <Select
            value={style}
            onChange={onStyle}
            style={{ width: '100%' }}
            options={AI_STYLE_OPTIONS.map((s) => ({ value: s.value, label: `${s.label} (${s.desc})` }))}
          />
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-purple-600">
            <Spin size="small" />
            <span>正在按 {modality}-{bodyPart} 模板库生成报告草稿...</span>
          </div>
        )}
        {error && <Alert type="error" showIcon message={error} />}
      </div>
    </Modal>
  );
}

function AiDraftConfirmModal({ draft, currentText, editMode, editText, actionLoading, onEditMode, onEditText, onAccept, onModifySave, onDiscard }: {
  draft: AiReportDraft;
  currentText: string;
  editMode: boolean;
  editText: string;
  actionLoading: boolean;
  onEditMode: (v: boolean) => void;
  onEditText: (v: string) => void;
  onAccept: () => void;
  onModifySave: () => void;
  onDiscard: () => void;
}) {
  const chunks = useMemo(() => computeDiff(currentText, editMode ? editText : draft.draftText), [currentText, editMode, editText, draft.draftText]);
  const renderDiffPane = (showAdded: boolean, text: string) => (
    <div className="border border-slate-200 rounded p-3 text-xs max-h-[380px] overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
      {showAdded ? (
        chunks.map((chunk: DiffChunk, i: number) =>
          chunk.type === 'added' ? (
            <span key={i} className="bg-green-100 text-green-800">{chunk.text}</span>
          ) : chunk.type === 'removed' ? null : (
            <span key={i}>{chunk.text}</span>
          )
        )
      ) : (
        chunks.map((chunk: DiffChunk, i: number) =>
          chunk.type === 'removed' ? (
            <span key={i} className="bg-red-100 text-red-800 line-through">{chunk.text}</span>
          ) : chunk.type === 'added' ? null : (
            <span key={i}>{chunk.text}</span>
          )
        )
      )}
      {chunks.length === 0 && <span className="text-slate-400">(内容一致)</span>}
      <span className="hidden">{text}</span>
    </div>
  );
  return (
    <Modal
      title={<Space><Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} /><span>AI 草稿确认</span><Tag color="purple">{draft.style}</Tag><Tag color="blue">置信度 {(draft.confidence * 100).toFixed(0)}%</Tag></Space>}
      open
      onCancel={onDiscard}
      width={900}
      destroyOnHidden
      footer={
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">模型 {draft.modelVersion} · 生成于 {new Date(draft.createdAt).toLocaleString()}</span>
          <div className="flex gap-2">
            <Button onClick={onDiscard} disabled={actionLoading}>放弃</Button>
            {!editMode ? (
              <Button icon={<Edit3 className="w-3 h-3" />} onClick={() => onEditMode(true)} disabled={actionLoading}>修改</Button>
            ) : (
              <Button icon={<CheckCircle2 className="w-3 h-3" />} onClick={onModifySave} loading={actionLoading}>保存修改</Button>
            )}
            <Button type="primary" icon={<CheckCircle2 className="w-3 h-3" />} onClick={onAccept} loading={actionLoading} disabled={actionLoading}>
              接受并应用到编辑器
            </Button>
          </div>
        </div>
      }
    >
      <Alert type="warning" showIcon message="AI 草稿仅供临床参考,接受前请核对所见与诊断的准确性" className="mb-3" />
      {editMode ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600">编辑草稿内容 (保存后提交 /ai/report-draft/:id/modify)</div>
          <Input.TextArea value={editText} onChange={(e) => onEditText(e.target.value)} rows={12} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-2">当前编辑器内容 (删除高亮)</h4>
            {renderDiffPane(false, currentText)}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-2">AI 草稿 (新增高亮)</h4>
            {renderDiffPane(true, editText || draft.draftText)}
          </div>
        </div>
      )}
    </Modal>
  );
}

function DiffViewModal({ oldText, newText, label, onClose }: { oldText: string; newText: string; label: string; onClose: () => void }) {
  const chunks = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);
  return (
    <Modal
      title={<Space><History className="w-4 h-4" /><span>版本对比: {label}</span></Space>}
      open
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">旧版本</h4>
          <div className="border border-slate-200 rounded p-3 text-xs max-h-[500px] overflow-y-auto font-mono leading-relaxed">
            {chunks.map((chunk: DiffChunk, i: number) =>
              chunk.type === 'removed' ? (
                <span key={i} className="bg-red-100 text-red-800 line-through">{chunk.text}</span>
              ) : chunk.type === 'added' ? null : (
                <span key={i}>{chunk.text}</span>
              )
            )}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">新版本</h4>
          <div className="border border-slate-200 rounded p-3 text-xs max-h-[500px] overflow-y-auto font-mono leading-relaxed">
            {chunks.map((chunk: DiffChunk, i: number) =>
              chunk.type === 'added' ? (
                <span key={i} className="bg-green-100 text-green-800">{chunk.text}</span>
              ) : chunk.type === 'removed' ? null : (
                <span key={i}>{chunk.text}</span>
              )
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- [W2-2] 短语库插入 ---------- */
function PhraseLibraryModal({ open, phrases, loading, onClose, onPick }: {
  open: boolean;
  phrases: any[];
  loading: boolean;
  onClose: () => void;
  onPick: (phrase: any) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return phrases;
    return phrases.filter((p) => {
      const text = String(p?.content || p?.text || '');
      return text.toLowerCase().includes(kw) || String(p?.category ?? '').toLowerCase().includes(kw) || String(p?.subCategory ?? '').toLowerCase().includes(kw);
    });
  }, [phrases, q]);

  return (
    <Modal
      title={<Space><BookMarked className="w-4 h-4" style={{ color: '#0891b2' }} /><span>短语库</span><Tag color="cyan">{filtered.length} 条</Tag></Space>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnHidden
    >
      <div className="pt-2 space-y-3">
        <Input
          allowClear
          placeholder="搜索短语 / 分类 (如: 胸部、结节、随访)"
          prefix={<BookMarked className="w-3 h-3 text-slate-400" />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /> 短语加载中…</div>
        ) : filtered.length === 0 ? (
          <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description="无匹配短语" />
        ) : (
          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {filtered.map((p: any, i: number) => (
              <div
                key={p?.id ?? i}
                className="p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50 hover:border-sky-300 transition-colors"
                onClick={() => onPick(p)}
              >
                <div className="text-xs text-slate-800 leading-relaxed">{p?.content ?? p?.text}</div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <Tag className="m-0 text-[10px]">{p?.category ?? '通用'}</Tag>
                  {p?.subCategory && <Tag color="blue" className="m-0 text-[10px]">{p.subCategory}</Tag>}
                  {Array.isArray(p?.modality) && p.modality.length > 0 && <Tag color="cyan" className="m-0 text-[10px]">{p.modality.join('/')}</Tag>}
                  {p?.usageCount != null && <span className="text-[10px] text-slate-400">使用 {p.usageCount} 次</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

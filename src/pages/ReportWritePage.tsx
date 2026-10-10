/**
 * G005 放射RIS系统 v3.0.6.8-19 — 报告书写 V3（优化版）
 * 优化: 懒加载 sider tab / 精简工具条 / 自动保存模拟 / 响应式
 */
import { AIDraftPanel } from '@components/report/v3/R3.WRITING/AIDraftPanel';
import { ImageAnchorComponent } from '@components/report/v3/R3.WRITING/ImageAnchor';
import { ReportRichEditor, type ReportRichEditorHandle } from '@components/report/v3/R3.WRITING/ReportRichEditor';
import { StructuredFieldForm } from '@components/report/v3/R3.WRITING/StructuredFieldForm';
import { VoiceDictation } from '@components/report/v3/R3.WRITING/VoiceDictation';
// [v3.0.6.11-100 Wave2C P2] 段落树模板引擎 (按模态/部位匹配 → 段落树预览 → 一键填充)
import SectionTemplateEngine from '@components/report/v3/R3.WRITING/SectionTemplateEngine';
// [v3.0.6.11-100 Wave2C P3] 报告→随访自动触发: 书写页「建议随访」卡片 (命中关键词 + 一键创建)
import FollowupAutoBookPanel from '@components/report/v3/R3.WRITING/FollowupAutoBookPanel';
// [v3.0.6.11-100 Wave 6A (D-1)] AI 检出一键插入报告: 检出插入面板 (sessionStorage 通道)
import AiLesionAutoInjector from '@components/report/v3/R3.WRITING/AiLesionAutoInjector';
import { consumeAiFindingsForReport, type AiInsertItem } from '@pages/dicom/aiFindings';
// [v3.0.6.11-100 Wave 2B (报告工作站)] MIP 截图联动 + 影像标注双向同步
import MipScreenshotModal, { type MipScreenshotPayload } from '@components/report/v3/R3.WRITING/MipScreenshotModal';
import DicomAnnotationEmbed from '@components/report/v3/R3.WRITING/DicomAnnotationEmbed';
import {
  REPORT_WRITING_CONTEXT_MOCK, KEYWORD_HIGHLIGHTS_MOCK, PRE_SUBMIT_SCORE_MOCK, REPORT_TEMPLATES_MOCK, PHRASES_MOCK,
} from '@data/reportWritingMock';
import { type SimilarCaseResult } from '@services/api';
import { aiDraftApi, type AiReportDraft, type ReportDraftStyle } from '@services/api/aiDraftApi';
import { examApi } from '@services/api/examApi';
import { reportApi } from '@services/api/reportApi';
import { reportQualityApi, type QualityEvaluation } from '@services/api/reportQualityApi';
import { templatesApi } from '@services/api/templatesApi';
import { detectConflicts } from '@services/keywordConflictDetector';
// [v3.0.6.11-103 Wave 7] 按钮规范: 保存/提交/打印/导出 标准动作按钮
import { ActionButton } from '@components/common/ActionButton';
import { computeDiff, type DiffChunk } from '@services/reportDiffEngine';
import { sanitizeHtml } from '@utils/sanitization';
import { getCurrentUser } from '@utils/auth';
import { resolveTemplateVariables, describeTemplateVariables, collectTemplateVariables, variablesTooltipTitle } from '@utils/templateVariables';
// [v3.0.6.11-99 Wave 2A 报告批注] 书写页批注面板 (右侧抽屉 Tab)
import ReportAnnotationPanel from '@components/report/ReportAnnotationPanel';
// [v3.0.6.11-100 Wave 2A] 危急值电话/短信网关卡片 (报告关联危急值时显示)
import CriticalValueCard from '@components/report/v3/R3.QUALITY/CriticalValueCard';
import { criticalAlertApi, type CriticalAlert } from '@services/api/criticalAlertApi';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { buildGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { ShortcutHelpModal } from '@components/common/ShortcutHelpModal';
import { displayStatus, toEnState } from '@components/report/statusMeta';
// [v3.0.6.11-103 Wave 12] 报告流程状态条 (7 态状态机 + 下一步一键流转)
import ReportFlowBar from '@components/report/ReportFlowBar';
import { t } from '@i18n/appI18n';
import {
  Layout, Card, Space, Button, Tag, Tooltip, Tabs, Divider,
  Alert, message, Modal, Progress, Badge, Input, Select, Spin, Collapse, Checkbox, Radio,
} from 'antd';
import { Save, Send, FileText, Mic, Image as ImageIcon, Brain, History, Eye, ChevronLeft, Sparkles, Tag as TagIcon, BarChart3, StickyNote, RefreshCw, AlertCircle, ListChecks, CheckCircle2, PanelRightClose, PanelRightOpen, Edit3, Printer, ChevronUp, ChevronDown, BookMarked, Lock, ExternalLink, BadgeCheck, MonitorPlay , Type, Keyboard, XCircle, Radar, Star, Copy, MessageSquareText, Ruler, Plus, Trash2, Download, Camera, PenLine, ListTree } from 'lucide-react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchX } from 'lucide-react'
import { EmptyState } from '@components/common/EmptyState';

const { Sider, Content } = Layout;

/* ---------- 右侧各 Tab 内容（懒加载） ---------- */
function AITab({ reportId, modality, bodyPart, onApplyToEditor }: { reportId: string; modality: string; bodyPart: string; onApplyToEditor: (text: string) => void }) {
  return (
    <AIDraftPanel
      reportId={reportId}
      modality={modality}
      bodyPart={bodyPart}
      clinicalInfo={t("reportWrite.demoComplaint2")}
      onAccept={(result) => {
        const text = [result?.findings, result?.impression, result?.recommendations].filter(Boolean).join('\n\n');
        onApplyToEditor(text || result?.findings || '');
        message.success(t("reportWrite.aiDraftApplied"));
      }}
      // [v3.0.6.11-100 Wave 3A (G-19)] 结构化字段 → 预填编辑器 (现病史/检查所见/诊断意见)
      onApplyStructured={(sections) => {
        const text = (sections ?? []).map((s) => `【${s.heading}】\n${s.content}`).join('\n\n');
        if (text) onApplyToEditor(text);
        message.success(t("reportWrite.structuredPrefilled"));
      }}
    />
  );
}

function VoiceTab({ reportId, onInsert, onTextChange }: { reportId: string; onInsert: (text: string) => void; onTextChange: (text: string) => void }) {
  return <VoiceDictation reportId={reportId} onInsert={onInsert} onTextChange={onTextChange} />;
}

// [v3.0.6.11-95 Wave2B P1] 历史报告真实化: dataSource=api 渲染真实数据, mock 标注演示数据 (后端 patientId 筛选 Wave 3B 接入)
// [v3.0.6.11-100 Wave 6B (D-5)] 顶部「既往病史摘要」卡: prior-summary 上次报告日期/常见诊断标签/一键填充基础病史
function HistoryTab({ priorReports, onCompare, dataSource = 'mock', summary, onFillHistory }: { priorReports: any[]; currentText: string; onCompare: (oldText: string, label: string) => void; dataSource?: 'api' | 'mock'; summary?: import('@services/api/reportApi').ReportPriorSummaryDto | null; onFillHistory?: () => void }) {
  const summaryBlock = summary ? (
    <div className="mb-2 p-2 border border-emerald-200 rounded bg-emerald-50/70" data-testid="prior-summary-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-emerald-700">{t("reportWrite.historySummary")}</span>
        <span className="flex items-center gap-1">
          {summary.source === 'db' ? (
            <Tag color="green" className="text-[10px]">{t("reportWrite.realData")}</Tag>
          ) : (
            <Tag color="orange" className="text-[10px]" title={t("reportWrite.noRealPriorDemo")}>{t("reportWrite.demoData")}</Tag>
          )}
          <Button size="small" type="primary" className="text-[10px] h-6" onClick={onFillHistory} data-testid="fill-history-btn">
            {t("reportWrite.fillHistory")}
          </Button>
        </span>
      </div>
      <div className="text-[11px] text-slate-600">
        {t("reportWrite.lastReportDate")} {summary.lastReportDate ? new Date(summary.lastReportDate).toLocaleDateString('zh-CN') : '—'}
        <span className="mx-1 text-slate-300">|</span>{t("reportWrite.priorReports")} {summary.count} {t("reportWrite.reportUnit")}
      </div>
      <div className="text-[11px] text-slate-600 mt-1 flex items-center flex-wrap gap-1">
        {t("reportWrite.commonDiagnoses")}
        {summary.commonDiagnoses.length > 0
          ? summary.commonDiagnoses.map((d) => (
              <Tag key={d.keyword} color="cyan" className="text-[10px]">{d.keyword} ×{d.count}</Tag>
            ))
          : <span className="text-slate-400">{t("reportWrite.noRepeatKeywords")}</span>}
      </div>
      {summary.lastImpression && (
        <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{t("reportWrite.recentImpressionLabel")} {summary.lastImpression}</div>
      )}
    </div>
  ) : null;
  if (priorReports.length === 0) {
    return (
      <div className="space-y-2">
        {summaryBlock}
        {!summary && <EmptyState type="nodata" description={dataSource === 'api' ? t("reportWrite.noHistory") : t("reportWrite.noHistoryShort")} />}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {summaryBlock}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">{t("reportWrite.totalPrefix")} {priorReports.length} {t("reportWrite.historyCount")}</span>
        {dataSource === 'api' ? (
          <Tag color="green" className="text-[10px]">{t("reportWrite.realData")}</Tag>
        ) : (
          <Tag color="orange" className="text-[10px]" title={t("reportWrite.historyDemoNote")}>{t("reportWrite.demoData")}</Tag>
        )}
      </div>
      {priorReports.map((p: any) => (
        <div key={p.id} className="p-2 border border-slate-200 rounded text-xs">
          <div className="flex items-center justify-between">
            <Tag color="cyan">{p.reportId}</Tag>
            <span className="text-slate-400">{p.studyDate ? new Date(p.studyDate).toLocaleDateString() : ''} {p.authorName ? `· ${p.authorName}` : ''}</span>
          </div>
          <div className="text-slate-700 mt-1 line-clamp-2">{p.findings}</div>
          <div className="flex items-center gap-2 mt-2">
            {p.comparisonDelta && <Tag color="orange" className="text-[10px]">{p.comparisonDelta.summary}</Tag>}
            <Button size="small" type="link" className="text-[10px] p-0 h-auto" onClick={() => onCompare(p.findings, `${p.reportId} (${p.studyDate ? new Date(p.studyDate).toLocaleDateString() : ''})`)}>
              {t("reportWrite.compareCurrent")}
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
        else setError(t("reportWrite.fusionSearchError"));
      } else {
        const res = await similarCaseApi.search({ reportText: text.trim(), modality, bodyPart, limit: 5 });
        if (res.success && Array.isArray(res.data)) setCases(res.data);
        else setError(t("reportWrite.searchError"));
      }
    } catch {
      setError(t("reportWrite.similarSearchFailed"));
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
        <span className="text-xs text-slate-500">{cases.length > 0 ? t("w9a.reportWrite.basedOnDraft", { count: cases.length }) : t("reportWrite.searchHint2")}</span>
        <Space size={4}>
          <Select
            size="small" allowClear showSearch placeholder={t("reportWrite.linkExams")}
            style={{ width: 180 }} value={selectedSeries} onChange={setSelectedSeries}
            options={seriesList.map((s) => ({ label: `${s.modality}·${s.bodyPart}`, value: s.seriesUid }))}
          />
          <Button size="small" icon={<RefreshCw className="w-3 h-3" />} onClick={() => run(reportText, selectedSeries)}>{t("reportWrite.refresh")}</Button>
        </Space>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)' }}><Spin size="small" /> {t("reportWrite.searching2")}</div>
      ) : cases.length === 0 ? (
        <EmptyState type="noresult" description={t("reportWrite.searchHint")} />
      ) : (
        <>
      {cases.map((c) => (
        <div key={c.id} role="button" tabIndex={0} className="p-2 border border-slate-200 rounded text-xs cursor-pointer hover:bg-slate-50" onClick={() => setDetail(c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(c) } }}>
          <div className="flex items-center justify-between">
            <Space size={4}>
              <Tag color="purple">{c.reportId}</Tag>
              <Tag color="cyan">{c.modality}</Tag>
              <Tag>{c.bodyPart}</Tag>
              {c.gender && <span className="text-slate-400">{c.gender}{c.age}{t("reportWrite.yearsOld")}</span>}
            </Space>
            <Tag color="blue">{c.similarity}%</Tag>
          </div>
          <div className="text-slate-700 mt-1 line-clamp-2">{c.impression}</div>
          {typeof c.imageScore === 'number' && typeof c.textScore === 'number' && (
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
              <span>{t("reportWrite.text")} <b className="text-slate-600">{Math.round(c.textScore * 100)}%</b></span>
              <span>{t("reportWrite.image")} <b className="text-slate-600">{Math.round(c.imageScore * 100)}%</b></span>
              {c.featureSummary != null && <span>{t("reportWrite.average")} {c.featureSummary.mean}</span>}
            </div>
          )}
          <Progress percent={c.similarity} size="small" strokeColor={c.similarity >= 70 ? 'var(--color-success-600)' : 'var(--color-warning-500)'} showInfo={false} style={{ marginTop: 'var(--space-1, 4px)' }} />
        </div>
      ))}
      </>
      )}
      <Modal
        open={!!detail}
        title={detail ? t("w9a.reportWrite.similarCaseTitle", { id: detail.reportId, sim: detail.similarity }) : ''}
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
                <span className="text-slate-500">{t("reportWrite.modalityLabel")}</span> <Tag color="cyan">{detail.modality}</Tag>
                <span className="text-slate-500 ml-2">{t("reportWrite.bodyPartLabel")}</span> <Tag>{detail.bodyPart}</Tag>
                {detail.gender ? (
                  <span className="text-slate-500 ml-2">{t("reportWrite.genderAgeLabel")} {detail.gender} / {detail.age}{t("reportWrite.yearsOld")}</span>
                ) : null}
                {imageScore !== null && textScore !== null && (
                  <span className="text-slate-500 ml-2">{t("reportWrite.text")} {Math.round(textScore * 100)}{t("reportWrite.pctImage")} {Math.round(imageScore * 100)}%</span>
                )}
              </div>
              <div className="font-semibold text-slate-700">{t("reportWrite.findings")}</div>
              <div className="text-slate-700 leading-relaxed">{detail.findings}</div>
              <div className="font-semibold text-slate-700">{t("reportWrite.impression")}</div>
              <div className="text-slate-700 leading-relaxed">{detail.impression}</div>
              {detail.conclusion && <div><Tag color="purple">{detail.conclusion}</Tag></div>}
              {summary && (
                <div>
                  <div className="font-semibold text-slate-700 mt-2">{t("reportWrite.imageFeatures")}</div>
                  <div className="flex items-end gap-px h-14 mt-1">
                    {summary.histogram.map((v: number, i: number) => {
                      const max = Math.max(...summary.histogram, 1);
                      return <div key={i} className="flex-1 rounded-sm bg-indigo-400" style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />;
                    })}
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-400 mt-1">
                    <span>{t("reportWrite.average")} {summary.mean}</span>
                    <span>p50 {summary.percentiles[2]}</span>
                    <span>{t("reportWrite.highDensity")} {(summary.highDensityRatio * 100).toFixed(1)}%</span>
                    <span>{t("reportWrite.lowDensity")} {(summary.lowDensityRatio * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}
              <div className="text-slate-400">{t("reportWrite.anonymized")}</div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function ScoreTab({ preScore, source, loading }: { preScore: any; source: 'api' | 'mock'; loading?: boolean }) {
  return (
    <>
      <div className="text-center mb-3">
        <Progress type="circle" percent={preScore.score} size={80} strokeColor={preScore.passed ? '#10b981' : 'var(--color-warning-500)'} format={(p) => <span className="text-2xl font-bold">{p}</span>} />
        <div className="text-xs text-slate-500 mt-1">
          {preScore.passed ? t("reportWrite.submittable") : t("reportWrite.needsWork")}
          <span className="ml-1">{loading ? t("reportWrite.scoring2") : ''}</span>
        </div>
        <Tag color={source === 'api' ? 'green' : 'orange'} className="mt-1" title={t("reportWrite.scoreSourceNote")}>
          {source === 'api' ? t("reportWrite.realScore") : t("reportWrite.demoFallback")}
        </Tag>
      </div>
      <Divider className="my-2" />
      <h5 className="text-xs font-semibold mb-1">{t("reportWrite.scoreDims")}</h5>
      <div className="space-y-1">
        {(preScore.dimensions ?? []).map((d: any) => (
          <div key={d.key ?? d.name} className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{d.label ?? d.name}</span>
            <span className="text-slate-500">{d.score}/{d.max}</span>
          </div>
        ))}
      </div>
      <Divider className="my-2" />
      <h5 className="text-xs font-semibold mb-1">{t("reportWrite.checklist")}</h5>
      <div className="space-y-1">
        {preScore.checklist.map((c: any) => (
          <div key={c.id} className="flex items-center gap-1 text-xs">
            {c.passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
            <span className={c.passed ? 'text-slate-500' : 'text-slate-800'}>{c.label}</span>
          </div>
        ))}
      </div>
      {(preScore.suggestions ?? []).length > 0 && (
        <>
          <Divider className="my-2" />
          <h5 className="text-xs font-semibold mb-1">{t("reportWrite.improvements")}</h5>
          <div className="space-y-1">
            {(preScore.suggestions ?? []).map((s: string, i: number) => (
              <div key={i} className="text-xs text-amber-700">• {s}</div>
            ))}
          </div>
        </>
      )}
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
          <div className="text-slate-700 mt-1">{d.wordCount} {t("reportWrite.wordUnit")}</div>
          {d.autoSaved && <Tag color="success" className="text-[10px] mt-1">{t("reportWrite.autoSave")}</Tag>}
        </div>
      ))}
    </div>
  );
}

// [v3.0.6.11-96 Wave5A P2] 关键词高亮双源模式: source=api 渲染真实高亮 (从 /reports/quality/rules 关键字派生), mock 回退标注演示数据 (对齐 HistoryTab priorSource 模式)
function KWTab({ keywords, source = 'mock' }: { keywords: any[]; source?: 'api' | 'mock' }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">{t("reportWrite.totalPrefix")} {keywords.length} {t("reportWrite.keywordCount")}</span>
        {source === 'api' ? (
          <Tag color="green" className="text-[10px]">{t("reportWrite.realHighlight")}</Tag>
        ) : (
          <Tag color="orange" className="text-[10px]" title={t("reportWrite.highlightFallback")}>{t("reportWrite.demoData")}</Tag>
        )}
      </div>
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

// [v3.0.6.11-96 Wave2A P0] 合规 Tab: 用 evaluate 返回维度渲染通过/未通过列表; 失败回退静态数组并标注
const COMPLIANCE_FALLBACK_ITEMS = [
  { id: 'c1', label: t("reportWrite.checkPatientMatch"), labelEn: 'Patient name matches ID', passed: true },
  { id: 'c2', label: t("reportWrite.checkBodyPart"), labelEn: 'Body part matches order', passed: true },
  { id: 'c3', label: t("reportWrite.checkFindingsCoverage"), labelEn: 'Findings cover all body parts', passed: true },
  { id: 'c4', label: t("reportWrite.checkImpressionConsistent"), labelEn: 'Impression consistent with findings', passed: true },
  { id: 'c5', label: t("reportWrite.checkCriticalNotified"), labelEn: 'Critical values annotated & notified', passed: false },
  { id: 'c6', label: t("reportWrite.checkIcdTerms"), labelEn: 'Terms follow ICD coding', passed: true },
  { id: 'c7', label: t("reportWrite.checkMeasurements"), labelEn: 'Measurements match images', passed: true },
];

function ComplianceTab({ evaluation }: { evaluation: QualityEvaluation | null }) {
  const items = evaluation
    ? evaluation.dimensions.map((d) => ({
        id: d.key,
        label: d.label,
        labelEn: d.key,
        passed: d.issues.length === 0 && d.score >= d.max * 0.6,
      }))
    : COMPLIANCE_FALLBACK_ITEMS;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">{t("reportWrite.totalPrefix")} {items.length} {t("reportWrite.qcRuleCount")}</span>
        {evaluation ? (
          <Tag color="green" className="text-[10px]">{t("reportWrite.realRules")}</Tag>
        ) : (
          <Tag color="orange" className="text-[10px]" title={t("reportWrite.qcFallbackNote")}>{t("reportWrite.demoFallback")}</Tag>
        )}
      </div>
      {items.map((c) => (
        <div key={c.id} className="flex items-center gap-1 text-xs">
          {c.passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
          <span className={c.passed ? 'text-slate-500' : 'text-slate-800'}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function CollabTab() {
  // [v3.0.6.11-96 Wave5A P2] 协作列表为本地演示数据 (useCollaborativeYjs 为真实协同通道, 列表未接 API)
  const collaborators = [
    { name: '陈医师', role: t("reportWrite.reportDoctor"), status: 'online', lastActive: t("reportWrite.currentlyEditing") },
    { name: '王医师', role: t("reportWrite.reviewDoctor"), status: 'online', lastActive: t("reportWrite.tenMinAgo") },
    { name: '李主任', role: t("reportWrite.finalReviewDoctor"), status: 'offline', lastActive: t("reportWrite.twoHoursAgo") },
  ];
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Tag color="orange" className="text-[10px]" title={t("reportWrite.collabLocalNote")}>{t("reportWrite.collabDemoNote")}</Tag>
      </div>
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

// [v3.0.6.11-103 Wave 12] 常用模板面板: 模板智能匹配 (按检查模态/部位自动推荐) + 收藏夹 + 最近使用, 一键应用
function TemplateSmartPanel({ templates, loading, favIds, recentIds, modality, bodyPart, onApply, onToggleFav }: {
  templates: any[];
  loading: boolean;
  favIds: string[];
  recentIds: string[];
  modality: string;
  bodyPart: string;
  onApply: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  const recCtx = useMemo(() => {
    const mod = String(modality ?? '').trim().toUpperCase();
    const bp = String(bodyPart ?? '').trim();
    return { mod, bp, has: mod.length > 0 || bp.length > 0 };
  }, [modality, bodyPart]);

  const recMatchLevel = useCallback((tl: any): number => {
    if (!recCtx.has) return -1;
    const tMod = String(tl?.modality ?? tl?.category ?? '').trim().toUpperCase();
    const tBp = String(tl?.bodyPart ?? '').trim();
    const m = recCtx.mod && tMod && (tMod === recCtx.mod || tMod.includes(recCtx.mod) || recCtx.mod.includes(tMod));
    const b = recCtx.bp && tBp && (tBp === recCtx.bp || tBp.includes(recCtx.bp) || recCtx.bp.includes(tBp));
    if (m && b) return 0;
    if (m) return 1;
    if (b) return 2;
    return -1;
  }, [recCtx]);

  const recommended = useMemo(() => {
    const matched = templates.filter((tl: any) => recMatchLevel(tl) >= 0);
    return matched
      .sort((a: any, b: any) => recMatchLevel(a) - recMatchLevel(b) || String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'zh-CN'))
      .slice(0, 6);
  }, [templates, recMatchLevel]);

  const favSet = useMemo(() => new Set(favIds), [favIds]);
  const recentSet = useMemo(() => new Set(recentIds), [recentIds]);

  const favorites = useMemo(() => templates.filter((tl: any) => favSet.has(tl.id)), [templates, favSet]);
  const recents = useMemo(() => templates.filter((tl: any) => recentSet.has(tl.id) && !favSet.has(tl.id)), [templates, recentSet, favSet]);

  const renderRow = (tl: any, match?: number) => (
    <div key={`t-${tl.id}`} role="button" tabIndex={0} className="group p-2 border border-slate-200 rounded text-xs cursor-pointer hover:border-sky-300 hover:bg-sky-50/40 transition-colors"
      onClick={() => onApply(tl.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onApply(tl.id) } }} data-testid={`smart-template-${tl.id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 truncate flex items-center gap-1">
          {favSet.has(tl.id) && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
          {(tl?.templateType ?? 'SECTION') === 'FULL' && <Tag color="purple" className="m-0 text-[10px]">{t("reportWrite.fullText")}</Tag>}
          {tl.name}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {match != null && match >= 0 && (
            <Tag color={match === 0 ? 'volcano' : match === 1 ? 'cyan' : 'geekblue'} className="m-0 text-[10px]">
              {match === 0 ? t('w12.write.matchExact') : match === 1 ? t('w12.write.matchModality') : t('w12.write.matchBodyPart')}
            </Tag>
          )}
          <Button size="small" type="text" className="p-0 h-auto w-5"
            icon={<Star className={`w-3 h-3 ${favSet.has(tl.id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />}
            onClick={(e) => { e.stopPropagation(); onToggleFav(tl.id); }}
            title={favSet.has(tl.id) ? t("reportWrite.unfavorite") : t("reportWrite.favoriteTemplates")} />
          <Button size="small" type="text" className="p-0 h-auto text-[10px] text-blue-600" onClick={(e) => { e.stopPropagation(); onApply(tl.id); }}>
            {t('w12.write.applyTemplate')}
          </Button>
        </span>
      </div>
      <div className="text-slate-400 text-[11px] mt-0.5 truncate">{String(tl.body ?? '').slice(0, 60) || t("reportWrite.structuredTemplate")}</div>
    </div>
  );

  if (loading) return <div style={{ textAlign: 'center', padding: 'var(--space-5, 20px)' }}><Spin size="small" /> {t("reportWrite.templateLoading2")}</div>;

  return (
    <div className="space-y-3">
      <div className="rounded border border-purple-200 bg-purple-50/60 p-2 space-y-1">
        <div className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> {t('w12.write.smartTemplate')}
          <span className="font-normal text-purple-400">（{recCtx.mod || '—'}{recCtx.mod && recCtx.bp ? ' / ' : ''}{recCtx.bp || '—'}）</span>
        </div>
        <div className="text-[10px] text-slate-400">{t('w12.write.smartTemplateDesc')}</div>
        {recommended.length === 0 ? (
          <div className="text-[11px] text-slate-400 py-2">{t('w12.write.noMatchTemplate')}</div>
        ) : (
          <div className="space-y-1">{recommended.map((tl: any) => renderRow(tl, recMatchLevel(tl)))}</div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {t('w12.write.favorites')} ({favorites.length})
        </div>
        {favorites.length === 0 ? (
          <div className="text-[11px] text-slate-400 py-1">{t('w12.write.favoritesEmpty')}</div>
        ) : (
          <div className="space-y-1">{favorites.map((tl: any) => renderRow(tl))}</div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-semibold text-slate-600 mb-1">{t('w12.write.recent')} ({recents.length})</div>
        {recents.length === 0 ? (
          <div className="text-[11px] text-slate-400 py-1">{t('w12.write.recentEmpty')}</div>
        ) : (
          <div className="space-y-1">{recents.map((tl: any) => renderRow(tl))}</div>
        )}
      </div>
    </div>
  );
}

/* ---------- 主页面 ---------- */
/* V3 优化专用样式 */const V3_STYLES = `
.v3-root { min-height: 100vh; background: var(--bg-primary); }
.v3-root .ant-layout-sider { background: var(--bg-card) !important; }
.v3-topbar { display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 8px 16px; flex-wrap: wrap; gap: 8px; }
.v3-topbar-left, .v3-topbar-right { display: flex; align-items: center; gap: 8px; }
.v3-topbar-title { font-weight: 600; white-space: nowrap; }
.v3-topbar-stats { font-size: 12px; color: #64748b; white-space: nowrap; }
.v3-topbar-autosave { font-size: 11px; color: var(--color-success-500); white-space: nowrap; }
.v3-content { padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: calc(100vh - 53px); background: var(--bg-primary); }
.v3-content .v3-card { box-shadow: 0 1px 2px rgba(0,0,0,0.04); border-radius: 8px; }
.v3-clinical-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 12px; }
.v3-clinical-item { padding: 6px; background: var(--bg-card); border-radius: 4px; }
.v3-clinical-label { color: #64748b; font-size: 10px; }
.v3-clinical-code { font-family: monospace; color: var(--color-primary-500); }
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

// [v3.0.6.11-98 Wave2B (报告 P1)] 打印模板: 选定布局 → 生成打印 HTML (标准单栏/双栏对比/精简/带抬头)
//   注入 #report-print-layout-container 后 window.print; 布局获取失败回退现有 window.print
function buildPrintLayoutHtml(opts: {
  layout: { id: string; name: string; description: string; columns: 1 | 2 };
  reportId: string;
  patientName: string;
  gender: string;
  age: string;
  modality: string;
  bodyPart: string;
  patientId: string;
  clinicalDiagnosis: string;
  bodyHtml: string;
}): string {
  const { layout } = opts;
  const esc = (s: string) => String(s ?? '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
  const withLetterhead = layout.id === 'layout-4' || layout.id === 'layout-letterhead';
  const twoColumns = layout.columns === 2;
  const compact = layout.id === 'layout-3' || layout.id === 'layout-compact';
  const letterhead = withLetterhead
    ? t("reportWrite.letterheadHtml")
    : '';
  const metaRows = [
    [t("reportWrite.reportNo"), opts.reportId],
    [t("reportWrite.patient"), `${opts.patientName}`],
    [t("reportWrite.genderAge"), `${opts.gender} / ${opts.age}`],
    [t("reportWrite.exam"), `${opts.modality} · ${opts.bodyPart}`],
    [t("reportWrite.accessionNo"), opts.patientId],
    [t("reportWrite.clinicalDiagnosis"), opts.clinicalDiagnosis],
  ];
  return `<div class="lp-root">
<style>
  body * { visibility: hidden !important; }
  #report-print-layout-container, #report-print-layout-container * { visibility: visible !important; }
  #report-print-layout-container { position: absolute; left: 0; top: 0; width: 100%; padding: ${compact ? '16px' : '28px'}; background: #fff; color: #000; font-size: ${compact ? '12px' : '13px'}; line-height: 1.7; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
  @page { margin: 14mm; }
  .lp-letterhead { text-align: center; border-bottom: 3px double #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; }
  .lp-org { font-size: 22px; font-weight: 700; color: #1e3a8a; letter-spacing: 6px; }
  .lp-sub { font-size: 12px; color: #475569; margin-top: 2px; }
  .lp-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 12px; }
  .lp-title { font-size: 18px; font-weight: 700; }
  .lp-time { font-size: 11px; color: #475569; }
  .lp-meta { display: grid; grid-template-columns: repeat(${twoColumns ? 2 : 3}, 1fr); gap: 4px 16px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 14px; }
  .lp-meta div { display: flex; gap: 6px; }
  .lp-meta b { font-weight: 600; color: #475569; min-width: 52px; }
  .lp-body { margin-bottom: 12px; }
  .lp-body-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .lp-body h2, .lp-body h3 { font-size: 14px; margin: 10px 0 6px; }
  .lp-body table { border-collapse: collapse; width: 100%; margin: 6px 0; }
  .lp-body table td, .lp-body table th { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 12px; text-align: left; }
  .lp-body img { max-width: 100%; }
  .lp-footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
</style>
${letterhead}
<div class="lp-header">
  <div class="lp-title">${t("w9a.reportWrite.printTitle")}</div>
  <div class="lp-time">${t("w9a.reportWrite.printTime", { time: new Date().toLocaleString() })}</div>
</div>
<div class="lp-meta">
  ${metaRows.map(([k, val]) => `<div><b>${k}:</b><span>${esc(val ?? '') || '-'}</span></div>`).join('')}
</div>
<div class="lp-body ${twoColumns ? 'lp-body-2col' : ''}">
  ${opts.bodyHtml}
</div>
<div class="lp-footer">
  <span>${t("w9a.reportWrite.layout", { name: esc(layout.name) })}</span>
  <span>${t("w9a.reportWrite.footerDisclaimer")}</span>
</div>
</div>`;
}

// [v3.0.6.11-100 Wave 6B (D-2)] MIP/VR 截图图注 HTML 构建 (书写页 Modal 插入 + sessionStorage 自动插入共用)
function buildMipFigureHtml(payload: MipScreenshotPayload, imgCount: number): string {
  const safeLabel = String(payload.label ?? t("reportWrite.mipRecon")).replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
  const figNo = imgCount + 1;
  const sourceInfo = payload.studyUid ? `${payload.studyUid.slice(-8)}` : 'N/A';
  const dirLabel = payload.direction === 'axial' ? t("reportWrite.axial") : payload.direction === 'sagittal' ? t("reportWrite.sagittal") : t("reportWrite.coronal");
  const thicknessText = payload.kind === 'vr' ? '' : ` · ${dirLabel} ${payload.thickness}mm`;
  return [
    '<figure style="margin:10px 0;text-align:center;position:relative;">',
    `<img src="${payload.imageBase64}" alt="${safeLabel}" style="max-width:100%;border:1px solid #cbd5e1;border-radius:4px;" data-mip-source="${sourceInfo}" data-mip-direction="${payload.direction ?? 'axial'}" />`,
    `<div style="position:relative;margin-top:4px;"><span style="display:inline-block;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;border-radius:4px;padding:0 8px;font-size:11px;font-weight:600;">${t("w9a.reportWrite.watermark", { label: safeLabel })}${thicknessText} · ${t("w9a.reportWrite.sourceExam", { info: sourceInfo })} · ${payload.source === 'real' ? t("reportWrite.realDicom") : t("reportWrite.synthetic")}</span></div>`,
    `<figcaption style="font-size:12px;color:#475569;margin-top:4px;">${t("w9a.reportWrite.figureCaption", { no: figNo, label: safeLabel })}</figcaption>`,
    '</figure>',
  ].join('');
}

export default function ReportWritePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // [v3.0.6.11-70] P0 真实化: reportId 从路由参数 / 报告列表选择获取, 不再写死 'rpt-038'
  const [reportId, setReportId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [context, setContext] = useState<any>(REPORT_WRITING_CONTEXT_MOCK);
  // [v3.0.6.11-96 Wave2A P0] 预评分真实化: reportQualityApi.evaluate (POST /reports/quality/evaluate)
  //   提交前 + 内容变更防抖触发; 失败回退 PRE_SUBMIT_SCORE_MOCK 并标注演示回退
  const [qualityEval, setQualityEval] = useState<QualityEvaluation | null>(null);
  const [preScoreSource, setPreScoreSource] = useState<'api' | 'mock'>('mock');
  const [preScoreLoading, setPreScoreLoading] = useState(false);
  const qualityEvalRef = useRef<QualityEvaluation | null>(null);
  const preScoreSourceRef = useRef<'api' | 'mock'>('mock');

  // [v3.0.6.11-96 Wave5A P2] 关键词高亮双源: 真实 /reports/quality/rules 关键字命中报告文本 → api; 否则 mock 回退 (KWTab 标注演示数据)
  const [kwHighlights, setKwHighlights] = useState<any[]>(KEYWORD_HIGHLIGHTS_MOCK);
  const [kwSource, setKwSource] = useState<'api' | 'mock'>('mock');  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await reportQualityApi.getRules();
        const kws: string[] = Array.isArray(res.data?.keywords) ? res.data.keywords : [];
        if (cancelled || kws.length === 0) return;
        const text = context.document.plainText ?? '';
        const real = kws
          .filter((k) => text.includes(k))
          .slice(0, 20)
          .map((k, i) => ({
            term: k,
            termEn: '',
            category: 'finding',
            color: i % 2 ? 'var(--color-primary-500)' : 'var(--color-error-600)',
            bg: i % 2 ? '#dbeafe' : '#fee2e2',
            weight: 5,
          }));
        if (real.length > 0 && !cancelled) {
          setKwHighlights(real);
          setKwSource('api');
        }
      } catch {
        /* 保持 mock 回退 */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [v3.0.6.11-100 Wave 2A] 报告关联危急值 → 顶部展示电话/短信通知卡片
  //   匹配优先级: patientId/studyId 精确命中 → 演示报告 (rpt-038) 取紧急级 → 列表第一条
  const [criticalAlert, setCriticalAlert] = useState<CriticalAlert | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await criticalAlertApi.listAlerts({ status: 'active' });
        if (cancelled || !res.success || !Array.isArray(res.data)) return;
        const list = res.data;
        const pid = context.patientId;
        const sid = context.studyId ?? context.accessionNumber;
        const hit =
          list.find((a) => (pid && (a.patientId === pid || a.studyId === pid)) || (sid && a.studyId === sid)) ??
          (context.reportId === 'rpt-038' ? list.find((a) => a.severity === 'critical' || a.severity === 'emergency') : undefined) ??
          list[0] ??
          null;
        setCriticalAlert(hit);
      } catch {
        /* 后端不可用则不展示卡片 */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.reportId, context.patientId]);

  // [G005 v3.0.6.11-99 Wave 4B] 测量入报告 (SR 段落): 数据源 = 影像浏览器 sessionStorage 导出 + 手动添加
  type MeasureRow = { type: string; typeLabel: string; label: string; value: number | string; unit: string; location: string };
  const [measureRows, setMeasureRows] = useState<MeasureRow[]>([]);
  const [measureDraft, setMeasureDraft] = useState<{ type: string; location: string; value: string; unit: string }>({ type: 'line', location: '', value: '', unit: 'mm' });
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('g005_measurements_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMeasureRows(parsed.map((r: any) => ({ type: String(r.type ?? 'line'), typeLabel: String(r.typeLabel ?? r.type ?? t("reportWrite.length")), label: String(r.label ?? ''), value: r.value ?? '', unit: String(r.unit ?? 'mm'), location: String(r.location ?? '') })));
      }
    } catch { /* storage 不可用则忽略 */ }
  }, []);
  const importMeasureRows = useCallback(() => {
    try {
      const raw = sessionStorage.getItem('g005_measurements_v1');
      if (!raw) {
        message.info(t("reportWrite.noMeasurementsImport2"));
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMeasureRows(parsed.map((r: any) => ({ type: String(r.type ?? 'line'), typeLabel: String(r.typeLabel ?? r.type ?? t("reportWrite.length")), label: String(r.label ?? ''), value: r.value ?? '', unit: String(r.unit ?? 'mm'), location: String(r.location ?? '') })));
        message.success(t("w9a.reportWrite.importedMeasurements", { count: parsed.length }));
      } else {
        message.info(t("reportWrite.noMeasurementsManual"));
      }
    } catch {
      message.info(t("reportWrite.measurementsLoadFailed"));
    }
  }, []);
  const addMeasureRow = useCallback(() => {
    const typeMeta: Record<string, { label: string; unit: string }> = {
      line: { label: t("reportWrite.length"), unit: 'mm' }, angle: { label: t("reportWrite.angle"), unit: '°' }, cobb: { label: t("reportWrite.cobbAngle"), unit: '°' },
      ellipse: { label: t("reportWrite.ellipseArea"), unit: 'mm²' }, rectangle: { label: t("reportWrite.rectArea"), unit: 'mm²' }, circle: { label: t("reportWrite.circleArea"), unit: 'mm²' },
      polygon: { label: t("reportWrite.polygonArea"), unit: 'mm²' }, ctvalue: { label: t("reportWrite.ctValue"), unit: 'HU' }, volume: { label: t("reportWrite.volume"), unit: 'cm³' },
    };
    const meta = typeMeta[measureDraft.type] ?? typeMeta.line!;
    const val = Number(measureDraft.value);
    if (!Number.isFinite(val) || String(measureDraft.value).trim() === '') {
      message.warning(t("reportWrite.measurementValueRequired"));
      return;
    }
    const row: MeasureRow = {
      type: measureDraft.type,
      typeLabel: meta.label,
      label: measureDraft.location ? `${meta.label} · ${measureDraft.location}` : meta.label,
      value: val,
      unit: measureDraft.unit || meta.unit,
      location: measureDraft.location,
    };
    setMeasureRows((prev) => [...prev, row]);
    setMeasureDraft((d) => ({ ...d, value: '', location: '' }));
  }, [measureDraft]);
  const removeMeasureRow = useCallback((idx: number) => {
    setMeasureRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const escHtml = useCallback((v: unknown): string =>
    String(v ?? '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch), []);
  const buildMeasureTableHtml = useCallback((): string => {
    const TABLE_CSS = 'border-collapse:collapse;width:100%;margin:8px 0;';
    const TH_CSS = 'border:1px solid #cbd5e1;padding:6px 8px;background:#f1f5f9;font-weight:600;text-align:left;';
    const TD_CSS = 'border:1px solid #cbd5e1;padding:6px 8px;';
    const rows = measureRows.map((r, i) =>
      `<tr><td style="${TD_CSS}">${i + 1}</td><td style="${TD_CSS}">${escHtml(r.typeLabel)}</td><td style="${TD_CSS}">${escHtml(r.location || '-')}</td><td style="${TD_CSS}">${escHtml(r.label)}</td><td style="${TD_CSS}">${escHtml(r.value)}</td><td style="${TD_CSS}">${escHtml(r.unit)}</td></tr>`,
    ).join('');
    return [
      t("reportWrite.measurementsHtml"),
      `<table style="${TABLE_CSS}"><thead><tr><th style="${TH_CSS}">#</th><th style="${TH_CSS}">${t("w9a.reportWrite.thMeasureType")}</th><th style="${TH_CSS}">${t("w9a.reportWrite.thLocation")}</th><th style="${TH_CSS}">${t("w9a.reportWrite.thDescription")}</th><th style="${TH_CSS}">${t("w9a.reportWrite.thValue")}</th><th style="${TH_CSS}">${t("w9a.reportWrite.thUnit")}</th></tr></thead><tbody>${rows}</tbody></table>`,
    ].join('\n');
  }, [measureRows, escHtml]);
  const handleInsertMeasurement = useCallback(() => {
    if (measureRows.length === 0) {
      message.info(t("reportWrite.noMeasurementsHint"));
      return;
    }
    editorRef.current?.insertHtml(buildMeasureTableHtml());
    message.success(t("reportWrite.measurementsInserted"));
  }, [measureRows, buildMeasureTableHtml]);

  // [v3.0.6.11-103 Wave 12] 一键测量插入: 单条测量行直接插入报告光标处
  const handleInsertMeasureRow = useCallback((row: MeasureRow, idx: number) => {
    if (!row) return;
    const html = [
      '<p>',
      `<b>${escHtml(row.typeLabel)}</b>` + (row.location ? ` · ${escHtml(row.location)}` : ''),
      `: ${escHtml(row.label)} = <b>${escHtml(row.value)} ${escHtml(row.unit)}</b>`,
      '</p>',
    ].join('');
    editorRef.current?.insertHtml(html);
    message.success(t("w9a.reportWrite.insertedMeasurement", { type: row.typeLabel, value: row.value, unit: row.unit }));
    void idx;
  }, [escHtml]);

  const runQualityEvaluate = useCallback(async (opts?: { force?: boolean }) => {
    const rid = reportId ?? (context as any).reportId;
    if (!rid) return;
    if (!opts?.force && qualityEvalRef.current && preScoreSourceRef.current === 'api') return;
    setPreScoreLoading(true);
    try {
      const text = context.document.plainText ?? '';
      const res = await reportQualityApi.evaluate({
        reportId: rid,
        findings: text,
        conclusion: text,
        structuredCompletion: Object.keys(context.fields ?? {}).length > 0 ? 0.9 : 0.5,
        hasCritical: false,
        verified: false,
      });
      if (res.success && res.data) {
        qualityEvalRef.current = res.data;
        preScoreSourceRef.current = 'api';
        setQualityEval(res.data);
        setPreScoreSource('api');
      } else {
        qualityEvalRef.current = null;
        preScoreSourceRef.current = 'mock';
        setQualityEval(null);
        setPreScoreSource('mock');
      }
    } catch {
      qualityEvalRef.current = null;
      preScoreSourceRef.current = 'mock';
      setQualityEval(null);
      setPreScoreSource('mock');
    } finally {
      setPreScoreLoading(false);
    }
  }, [reportId, context.reportId, context.document.plainText, context.fields]);

  // 内容变更防抖 1.2s 后重新评分
  useEffect(() => {
    if (!reportId) return;
    const timer = setTimeout(() => { void runQualityEvaluate(); }, 1200);
    return () => clearTimeout(timer);
  }, [reportId, context.document.plainText, runQualityEvaluate]);

  // [v3.0.6.11-96 Wave2A P0] 真实评分 → 预评分形状 (维度明细 + 检查清单 + 建议); 失败回退本地 mock
  const preScore = useMemo(() => {
    const ev = qualityEval;
    if (ev) {
      return {
        reportId: ev.reportId,
        score: ev.totalScore,
        grade: ev.grade,
        passed: ev.totalScore >= 80,
        dimensions: ev.dimensions.map((d) => ({ key: d.key, label: d.label, name: d.label, score: d.score, max: d.max, weight: d.weight, issues: d.issues })),
        checklist: ev.dimensions.map((d, i) => ({
          id: `dim-${d.key ?? i}`,
          label: d.label,
          labelEn: d.key,
          passed: d.issues.length === 0 && d.score >= d.max * 0.6,
          weight: d.weight,
        })),
        suggestions: ev.suggestions ?? [],
        evaluatedAt: ev.evaluatedAt,
      };
    }
    return PRE_SUBMIT_SCORE_MOCK;
  }, [qualityEval]);
  // [v3.0.6.11-70] P0 真实化: 草稿列表来自 reportApi.list
  const [drafts, setDrafts] = useState<any[]>([]);
  const [showSubmit, setShowSubmit] = useState(false);
  const [siderVisible, setSiderVisible] = useState(true);
  const [activeToolsTab, setActiveToolsTab] = useState('ai');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveTip, setAutoSaveTip] = useState(t("w9a.reportWrite.savedTip"));
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [diffTarget, setDiffTarget] = useState<{ oldText: string; label: string } | null>(null);
  const [voiceInsert, setVoiceInsert] = useState<{ text: string; ts: number } | null>(null);
  // [v3.0.6.11-70] 自动保存节流: 正在保存 / 无变更时跳过
  const savingRef = useRef(false);
  const lastSavedRef = useRef('');
  // [v3.0.6.11-61] 环境式 AI 报告草稿 (生成式草稿 + 医生确认)
  const [aiUi, setAiUi] = useState<{ open: boolean; clinical: string; findings: string; style: ReportDraftStyle; loading: boolean; error: string | null }>({
    open: false, clinical: t("reportWrite.demoComplaint2"), findings: '', style: 'standard', loading: false, error: null,
  });
  const [aiDraft, setAiDraft] = useState<AiReportDraft | null>(null);
  const [aiConfirm, setAiConfirm] = useState(false);
  const [aiEditMode, setAiEditMode] = useState(false);
  const [aiEditText, setAiEditText] = useState('');
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [editorSet, setEditorSet] = useState<{ plainText: string; html?: string; ts: number } | null>(null);
  // [v3.0.6.11-98 Wave 1A P0] 编辑器程序化插入通道 (影像锚点 → 正文图片/占位符)
  const editorRef = useRef<ReportRichEditorHandle>(null);
  // [v3.0.6.11-98 Wave 1A P0] context 实时镜像 (延迟补读回调需读取最新编辑器内容判断是否被修改)
  const contextRef = useRef(context);
  useEffect(() => { contextRef.current = context; });

  // [v3.0.6.11-99 G-20] RADS 评分段落插入通道: AI 评分页等外部页面 dispatch report-insert-html → 编辑器
  //   跨页导航兜底: localStorage 待插入队列 (ris_rads_pending_insert), 报告加载完成后补插
  const radsPendingRef = useRef('');
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { html?: string } | undefined;
      if (!detail?.html) return;
      editorRef.current?.insertHtml(detail.html);
      message.success(t("reportWrite.aiRadsInserted"));
    };
    window.addEventListener('report-insert-html', handler);
    try {
      const pending = window.localStorage.getItem('ris_rads_pending_insert');
      if (pending) {
        window.localStorage.removeItem('ris_rads_pending_insert');
        if (pending.length > 0) radsPendingRef.current = pending;
      }
    } catch { /* 忽略 */ }
    return () => window.removeEventListener('report-insert-html', handler);
  }, []);
  // 报告内容异步加载可能多次整篇回填(首次 + IDB 延迟补读), 轮询等待编辑器内容稳定后再补插 RADS 段落
  useEffect(() => {
    if (!radsPendingRef.current) return;
    const html = radsPendingRef.current;
    let lastLen = -1;
    let stableCount = 0;
    const timer = window.setInterval(() => {
      const ed = document.querySelector('[contenteditable="true"]');
      const len = ed ? (ed as HTMLElement).innerHTML.length : 0;
      if (len > 0 && len === lastLen) {
        stableCount += 1;
        if (stableCount >= 2) {
          window.clearInterval(timer);
          editorRef.current?.insertHtml(html);
          radsPendingRef.current = '';
          message.success(t("reportWrite.aiRadsInsertedCrossPage"));
        }
      } else {
        stableCount = 0;
      }
      lastLen = len;
    }, 600);
    return () => window.clearInterval(timer);
  }, []);

  // ───────────────────────── D-1: AI 检出一键插入报告 ─────────────────────────
  // [G005 v3.0.6.11-100 Wave 6A] 挂载时检查 sessionStorage (ris_ai_findings_insert):
  //   目标报告匹配 → 编辑器稳定后自动插入全部 + 清理缓存 + toast; 不匹配 → 仅展示面板由医生决定
  const [aiPendingFindings, setAiPendingFindings] = useState<AiInsertItem[]>([]);
  const aiAutoInsertRef = useRef<AiInsertItem[]>([]);

  useEffect(() => {
    let consumed: ReturnType<typeof consumeAiFindingsForReport> = null;
    try { consumed = consumeAiFindingsForReport(); } catch { /* storage 不可用则忽略 */ }
    if (!consumed || consumed.findings.length === 0) return;
    setAiPendingFindings(consumed.findings);
    // 目标报告匹配 (未指定目标 / 与当前 URL reportId 一致) → 自动插入; 否则留给面板手动采纳
    const targetReportId = searchParams.get('reportId');
    const matches = !consumed.reportId || !targetReportId || String(consumed.reportId) === targetReportId;
    if (matches) aiAutoInsertRef.current = consumed.findings;
    // 兜底: 报告解析流程异常 (无报告可加载) 时 4s 后仍尝试合并 (编辑器初始内容之上)
    if (matches) {
      window.setTimeout(() => {
        const pending = aiAutoInsertRef.current;
        if (pending.length === 0) return;
        const cur = contextRef.current?.document ?? { html: '', plainText: '' };
        const mergedHtml = [cur.html, ...pending.map((f) => f.html)].filter(Boolean).join('\n');
        const aiText = pending.map((f) => t("w9a.reportWrite.aiFindingLine", { label: f.label, detail: f.detail ?? '', confidence: f.confidence })).join('\n');
        const mergedText = [cur.plainText, aiText].filter(Boolean).join('\n');
        aiAutoInsertRef.current = [];
        setAiPendingFindings([]);
        setContext((c: any) => ({ ...c, document: { ...c.document, html: mergedHtml, plainText: mergedText, wordCount: mergedText.length } }));
        setEditorSet({ plainText: '', html: mergedHtml, ts: Date.now() });
        lastSavedRef.current = `${mergedText}|${mergedHtml}`;
        message.success(t("w9a.reportWrite.insertedAiFindings", { count: pending.length }));
      }, 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [G005 v3.0.6.11-100 Wave 6A (D-1)] AI 检出一键插入: 在报告异步加载完成的时机合并 AI 段落
  //   (异步整篇回填会覆盖 insertHtml 结果, 故合并进 context.document.html + externalSet 整篇渲染;
  //    合并后 context html 与加载快照不一致 → 延迟补读 (IDB) 的"未被修改"校验自动跳过覆盖)
  const mergeAiFindingsIntoEditor = useCallback((currentHtml: string) => {
    const items = aiAutoInsertRef.current;
    if (items.length === 0) return;
    const aiHtml = items.map((f) => f.html).join('\n');
    const mergedHtml = [currentHtml, aiHtml].filter(Boolean).join('\n');
    const aiText = items.map((f) => t("w9a.reportWrite.aiFindingLine", { label: f.label, detail: f.detail ?? '', confidence: f.confidence })).join('\n');
    const mergedText = [contextRef.current?.document?.plainText ?? '', aiText].filter(Boolean).join('\n');
    aiAutoInsertRef.current = [];
    setAiPendingFindings([]);
    setContext((c: any) => ({ ...c, document: { ...c.document, html: mergedHtml, plainText: mergedText, wordCount: mergedText.length } }));
    setEditorSet({ plainText: '', html: mergedHtml, ts: Date.now() });
    lastSavedRef.current = `${mergedText}|${mergedHtml}`;
    message.success(t("w9a.reportWrite.insertedAiFindings", { count: items.length }));
  }, []);

  const handleAiInsertOne = useCallback((f: AiInsertItem) => {
    editorRef.current?.insertHtml(f.html);
    setAiPendingFindings((prev) => prev.filter((x) => x.id !== f.id));
  }, []);

  const handleAiIgnoreOne = useCallback((id: string) => {
    setAiPendingFindings((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const handleAiConsumed = useCallback((items: AiInsertItem[]) => {
    setAiPendingFindings(items);
    try { sessionStorage.removeItem('ris_ai_findings_insert'); } catch { /* 忽略 */ }
  }, []);

  // [v3.0.6.11-100 Wave 6B (D-2)] 阅片器「发送 MIP 到报告」→ sessionStorage ris_mip_insert:
  //   挂载时读取缓存 (DicomViewerPro/VrPage 跳转前写入), 编辑器内容稳定后自动插入图注并清理缓存。
  //   注: 书写页异步回填 (getById/IDB 延迟补读) 可能冲掉已插入图注 → 内容稳定后校验, 缺失则重插 (上限 3 次 + 30s 超时)
  const mipPendingRef = useRef<string>('');
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ris_mip_insert');
      if (!raw) return;
      sessionStorage.removeItem('ris_mip_insert');
      const parsed = JSON.parse(raw);
      if (parsed?.imageBase64) mipPendingRef.current = JSON.stringify(parsed);
    } catch { /* 忽略 */ }
  }, []);
  useEffect(() => {
    if (!mipPendingRef.current) return;
    const payload = JSON.parse(mipPendingRef.current) as MipScreenshotPayload;
    let lastLen = -1;
    let stableCount = 0;
    let attempts = 0;
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 600;
      const ed = document.querySelector('[contenteditable="true"]');
      const len = ed ? (ed as HTMLElement).innerHTML.length : 0;
      if (len > 0 && len === lastLen) {
        stableCount += 1;
        if (stableCount >= 2) {
          const html = (ed as HTMLElement).innerHTML;
          const hasFigure = html.includes('data-mip-source') || html.includes(String(payload.label ?? t("reportWrite.mipRecon")));
          if (hasFigure) {
            window.clearInterval(timer);
            mipPendingRef.current = '';
            message.success(t("w9a.reportWrite.autoInsertedFromViewer", { label: payload.label ?? t("reportWrite.mipScreenshot") }));
          } else if (attempts < 3) {
            attempts += 1;
            const imgCount = (html.match(/<img\b/gi) ?? []).length;
            editorRef.current?.insertHtml(buildMipFigureHtml(payload, imgCount));
            lastLen = -1;
          } else {
            window.clearInterval(timer);
            mipPendingRef.current = '';
            message.warning(t("reportWrite.mipCaptionIncomplete"));
          }
        }
      } else {
        stableCount = 0;
      }
      if (elapsed >= 30000) {
        window.clearInterval(timer);
        mipPendingRef.current = '';
      }
      lastLen = len;
    }, 600);
    return () => window.clearInterval(timer);
  }, []);

  // [W2-2] 报告模板选择器 (自由文本模板)
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const templateListRef = useRef<any[]>([]);
  // [v3.0.6.11-95 Wave3B P1] 模板库面板: 分类浏览 + 最近使用置顶 + 收藏星标 (localStorage)
  // [v3.0.6.11-98 Wave2B (报告 P1)] 收藏服务端化: POST /templates/:id/favorite + GET /templates/favorites; 失败回退 localStorage
  const [templateLibOpen, setTemplateLibOpen] = useState(false);
  // [v3.0.6.11-100 Wave2C P2] 段落树模板引擎弹窗 (工具栏「模板生成段落树」)
  const [sectionEngineOpen, setSectionEngineOpen] = useState(false);
  const [favSource, setFavSource] = useState<'api' | 'fallback'>('api');
  const [favTemplateIds, setFavTemplateIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('report-fav-templates') || '[]') } catch { return [] }
  });
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('report-recent-templates') || '[]') } catch { return [] }
  });
  // [v3.0.6.11-103 Wave 12] 短语收藏夹 (localStorage)
  const [favPhraseIds, setFavPhraseIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('report-fav-phrases') || '[]') } catch { return [] }
  });
  const toggleFavPhrase = useCallback((id: string) => {
    setFavPhraseIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem('report-fav-phrases', JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  }, []);
  // [v3.0.6.11-98 Wave2A P1] 当前登录用户 id (模板库「我的模板」筛选/个人模板 Tag)
  const currentUserId = useMemo(() => {
    const mem = getCurrentUser();
    if (mem?.id) return mem.id;
    try {
      const raw = localStorage.getItem('ris_current_user');
      if (raw) {
        const u = JSON.parse(raw);
        return String(u?.id ?? u?.userId ?? '');
      }
    } catch { /* 忽略 */ }
    return '';
  }, []);
  // [v3.0.6.11-99 Wave 2A 报告批注] 当前登录用户 (id+name) → 批注面板
  const annotationCurrentUser = useMemo(() => {
    const mem = getCurrentUser();
    if (mem?.id) return { id: mem.id, name: mem.name || t("reportWrite.currentUser") };
    try {
      const raw = localStorage.getItem('ris_current_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id) return { id: String(u.id), name: String(u.fullName ?? u.username ?? t("reportWrite.currentUser")) };
      }
    } catch { /* 忽略 */ }
    return { id: 'A001', name: t("reportWrite.currentUser") };
  }, []);
  // [W2-2] 短语库
  const [phraseOpen, setPhraseOpen] = useState(false);
  const [phrases, setPhrases] = useState<any[]>([]);
  const [phraseLoading, setPhraseLoading] = useState(true);
  // [v3.0.6.11-96 Wave 2B (E)] 短语库数据源: templatesApi.listSnippets 真实 → 失败回退 PHRASES_MOCK (演示回退)
  const [phraseSource, setPhraseSource] = useState<'api' | 'fallback'>('api');
  // [W2-2] 上下例导航 (reportApi.list 上下文)
  const [reportList, setReportList] = useState<any[]>([]);
  const [listIndex, setListIndex] = useState(0);
  // [W2-2] 报告锁 / 并发冲突提示
  const [lockConflict, setLockConflict] = useState(false);
  const lastKnownUpdatedAtRef = useRef<string | null>(null);
  // [v3.0.6.11-95 Wave2B P1] 历史报告真实化: getById 回填后按 patientId 拉全量本地过滤
  const [priorReports, setPriorReports] = useState<any[]>([]);
  const [priorSource, setPriorSource] = useState<'api' | 'mock'>('mock');
  // [v3.0.6.11-100 Wave 6B (D-5)] 同患者既往报告摘要 (历史报告→本次报告字段复用): 上次报告日期/常见诊断/一键填充
  const [priorSummary, setPriorSummary] = useState<import('@services/api/reportApi').ReportPriorSummaryDto | null>(null);
  // [W2-2] 打印 / 导出
  const [exporting, setExporting] = useState(false);
  // [v3.0.6.11-98 Wave2B (报告 P1)] 打印模板接线: getPrintLayouts → 选模板 Modal → preparePrint → 注入 print 容器
  const [printOpen, setPrintOpen] = useState(false);
  const [printLayouts, setPrintLayouts] = useState<Array<{ id: string; name: string; description: string; columns: 1 | 2 }>>([]);
  const [printLayoutId, setPrintLayoutId] = useState('layout-1');
  const [printLoading, setPrintLoading] = useState(false);

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
        // [v3.0.6.11-98 Wave 1A P0] 富文本 HTML 持久化: 优先 htmlContent (图片/表格/格式), 空时 findings 派生 (旧数据兼容)
        const loadedHtml = d.htmlContent && String(d.htmlContent).trim().length > 0
          ? d.htmlContent
          : `<h2>${t("w9a.reportWrite.findingsSection")}</h2><p>${d.findings ?? ''}</p><h2>${t("w9a.reportWrite.impressionSection")}</h2><p>${d.impression ?? ''}</p>`;
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
          rejectReason: (d as any).rejectReason ?? '',
          document: {
            ...c.document,
            reportId: d.reportId || d.id,
            html: loadedHtml,
            plainText,
            wordCount: plainText.length || c.document.wordCount,
            lastEditedAt: d.updatedTime,
          },
        }));
        // 回填编辑器 (编辑器挂载早于异步加载, externalSet.html 通道做整篇渲染)
        setEditorSet({ plainText: '', html: loadedHtml, ts: Date.now() });
        lastSavedRef.current = `${plainText}|${loadedHtml}`;
        // [G005 v3.0.6.11-100 Wave 6A (D-1)] AI 检出自动插入: 首轮加载完成后合并 (延迟补读会因 html 不一致自动跳过)
        mergeAiFindingsIntoEditor(loadedHtml);
        // [v3.0.6.11-98 Wave 1A P0] mock 模式 IDB 恢复可能晚于首次 getById:
        //   仅在首次读取无 htmlContent 时延迟补读一次, 且编辑器未被用户修改 (html 与加载快照一致) 才回填
        if (!(d.htmlContent && String(d.htmlContent).trim())) {
          setTimeout(async () => {
            if (cancelled || !target) return;
            const curHtml = contextRef.current?.document?.html ?? '';
            if (curHtml !== sanitizeHtml(loadedHtml)) return;
            const again = await reportApi.getById(target);
            if (!again.success || !again.data) return;
            const d2 = again.data;
            const html2 = d2.htmlContent && String(d2.htmlContent).trim().length > 0 ? d2.htmlContent : '';
            if (!html2) return;
            if ((contextRef.current?.document?.html ?? '') !== sanitizeHtml(loadedHtml)) return;
            const pt2 = [d2.findings, d2.impression, d2.recommendations].filter(Boolean).join('\n\n');
            setContext((c: any) => ({ ...c, document: { ...c.document, html: html2, plainText: pt2, wordCount: pt2.length } }));
            setEditorSet({ plainText: '', html: html2, ts: Date.now() });
            lastSavedRef.current = `${pt2}|${html2}`;
            // [G005 v3.0.6.11-100 Wave 6A (D-1)] AI 检出自动插入: IDB 延迟补读为最后一次整篇回填, 合并兜底
            mergeAiFindingsIntoEditor(html2);
          }, 1500);
        }
        if (d.examId) {
          const examRes = await examApi.getById(d.examId);
          if (examRes.success && examRes.data) {
            setContext((c: any) => ({ ...c, gender: examRes.data!.gender, age: examRes.data!.age }));
          }
        }
        // [v3.0.6.11-95 Wave2B P1] 历史报告真实化: 后端 GET /reports 暂不支持 patientId 筛选 (Wave 3B),
        //   先拉全量 (take=200) 本地按 patientId 过滤; 无匹配时保留演示数据并标注
        if (d.patientId) {
          try {
            const listRes = await reportApi.list({ take: '200' });
            const arr = listRes.success
              ? (Array.isArray(listRes.data)
                  ? listRes.data
                  : ((listRes.data as { items?: unknown[] })?.items ?? []))
              : [];
            const curId = String(d.reportId || d.id);
            const samePatient = (arr as any[]).filter((x: any) =>
              String(x?.patientId ?? '') === String(d.patientId) && String(x?.reportId || x?.id) !== curId);
            if (samePatient.length > 0) {
              setPriorReports(samePatient.map((x: any) => ({
                id: x.id,
                patientId: x.patientId,
                reportId: x.reportId || x.id,
                modality: x.modality,
                bodyPart: x.bodyPart,
                studyDate: x.createdTime ?? x.examDate ?? '',
                status: x.status ?? x.state ?? '',
                findings: x.findings ?? x.diagnosis ?? '',
                impression: x.impression ?? '',
                authorName: x.reportDoctorName ?? x.doctorName ?? '',
              })));
              setPriorSource('api');
            } else {
              setPriorSource('mock');
            }
          } catch {
            setPriorSource('mock');
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

  // [v3.0.6.11-100 Wave 6B (D-5)] 既往报告摘要加载: GET /reports/:id/prior-summary
  //   (历史报告 Tab 顶部卡片; 失败静默, 不阻塞书写)
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    reportApi.getPriorSummary(reportId).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      setPriorSummary(res.data);
    }).catch(() => { /* 摘要加载失败不阻塞 */ });
    return () => { cancelled = true; };
  }, [reportId]);

  // [v3.0.6.11-100 Wave 6B (D-5)] 一键填充基础病史: prior-summary → 「既往史」段落 insertHtml
  const handleFillHistory = useCallback(() => {
    if (!priorSummary) {
      message.info(t("reportWrite.historyNotLoaded"));
      return;
    }
    const esc = (v: unknown): string => String(v ?? '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
    const date = priorSummary.lastReportDate ? new Date(priorSummary.lastReportDate).toLocaleDateString('zh-CN') : '';
    const kws = priorSummary.commonDiagnoses.map((d) => d.keyword).join('、');
    const html = [
      t("reportWrite.historyHtml"),
      `<p>患者${date ? `于 ${date} ` : ''}行影像检查${priorSummary.count > 0 ? ` (既往共 ${priorSummary.count} 份报告)` : ''}${kws ? `, 曾诊断: ${esc(kws)}` : ''}${priorSummary.lastImpression ? `; 最近一次诊断意见: ${esc(priorSummary.lastImpression)}` : ''}。建议结合既往影像对比评估。</p>`,
    ].join('\n');
    editorRef.current?.insertHtml(html);
    message.success(t("reportWrite.historyInserted"));
  }, [priorSummary]);

  // [W2-2] 加载自由文本模板列表 (templatesApi → mock 兜底)
  // [v3.0.6.11-98 Wave2A P1] 仅加载已批准模板 (草稿/待审批/已驳回不展示)
  useEffect(() => {
    let cancelled = false;
    templatesApi.list({ status: 'approved' }).then((res) => {
      if (cancelled) return;
      const arr = Array.isArray(res.data) ? res.data : ((res.data as any)?.items ?? []);
      setTemplateList(arr.length > 0 ? arr : REPORT_TEMPLATES_MOCK);
    }).catch(() => { if (!cancelled) setTemplateList(REPORT_TEMPLATES_MOCK); })
      .finally(() => { if (!cancelled) setTemplateLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { templateListRef.current = templateList; }, [templateList]);

  // [v3.0.6.11-96 Wave3B P1] 模板库分类: 从真实 /templates/categories 加载, 失败静默 (回退模板数据派生)
  const [realCategories, setRealCategories] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    templatesApi.listCategories().then((res) => {
      if (cancelled) return;
      const arr = Array.isArray(res.data) ? res.data : [];
      if (arr.length > 0) setRealCategories(arr.map((c: any) => String(c?.name ?? '')).filter(Boolean));
    }).catch(() => { /* 静默: 模板库回退模板数据派生分类 */ });
    return () => { cancelled = true; };
  }, []);

  // [W2-2] 加载短语库
  // [v3.0.6.11-96 Wave 2B (E)] 数据源切换: v3WritingApi.listPhrases (mockOk) → templatesApi.listSnippets (后端 /templates/snippets 真实)
  //   snippets 形状 { id, name, content, category, shortcuts } → 短语形状 { id, name, content, category }; 失败回退 PHRASES_MOCK
  useEffect(() => {
    let cancelled = false;
    templatesApi.listSnippets().then((res) => {
      if (cancelled) return;
      const arr = Array.isArray(res.data) ? res.data : ((res.data as any)?.items ?? []);
      if (arr.length > 0) {
        setPhrases(arr.map((s: any) => ({
          id: s?.id,
          name: s?.name ?? '',
          content: s?.content ?? s?.text ?? '',
          category: s?.category ?? t("reportWrite.general"),
          subCategory: s?.subCategory,
          shortcuts: s?.shortcuts,
        })));
        setPhraseSource('api');
      } else {
        setPhrases(PHRASES_MOCK);
        setPhraseSource('fallback');
      }
    }).catch(() => { if (!cancelled) { setPhrases(PHRASES_MOCK); setPhraseSource('fallback'); } })
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
      // [v3.0.6.11-98 Wave 1A P0] 富文本 HTML 与 plainText 双写 (图片/表格/格式随正文持久化)
      const htmlContent = context.document.html ?? '';
      const existing = await reportApi.getById(reportId);
      // [W2-2] 报告锁: 无后端锁概念 → 本地并发冲突检测 (保存前对比 updatedAt)
      if (existing.success && existing.data && existing.data.updatedTime) {
        if (lastKnownUpdatedAtRef.current && existing.data.updatedTime !== lastKnownUpdatedAtRef.current) {
          setLockConflict(true);
        }
      }
      const res = existing.success && existing.data
        ? await reportApi.update(reportId, { findings: plainText, conclusion, htmlContent })
        : await reportApi.create({ patientId: context.patientId || reportId, examId: reportId, findings: plainText, conclusion, htmlContent });
      if (res.success) {
        if (res.data?.reportId && res.data.reportId !== reportId) setReportId(res.data.reportId);
        lastKnownUpdatedAtRef.current = res.data?.updatedTime ?? existing.data?.updatedTime ?? new Date().toISOString();
        lastSavedRef.current = `${plainText}|${context.document.html ?? ''}`;
        if (!silent) message.success(lockConflict ? t("reportWrite.savedWithOverwrite2") : t("reportWrite.reportSaved"));
        return true;
      }
      if (!silent) message.error(res.error?.message ?? t("reportWrite.saveFailed"));
      return false;
    } catch {
      if (!silent) message.error(t("reportWrite.saveFailedNetwork"));
      return false;
    } finally {
      savingRef.current = false;
      if (!silent) setSaving(false);
    }
  }, [reportId, context, lockConflict]);

  // [v3.0.6.11-98 Wave 1A P0] 影像锚定 → 报告正文接线: 锚点缩略图(dataURL)以 图X 图注插入,
  //   无真实缩略图时插入虚线占位符 (保留影像引用语义, 不显示破图)
  const handleInsertAnchor = useCallback((anchor: any) => {
    const thumb = typeof anchor?.thumbnail === 'string' && anchor.thumbnail.startsWith('data:image/') ? anchor.thumbnail : '';
    const label = String(anchor?.annotation?.[0]?.label ?? anchor?.id ?? t("reportWrite.imageAnchor"));
    const safeLabel = String(label).replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
    const existingImgs = (context.document.html?.match(/<img\b/gi) ?? []).length;
    const figNo = existingImgs + 1;
    const html = thumb
      ? `<figure style="margin:10px 0;text-align:center;"><img src="${thumb}" alt="${safeLabel}" style="max-width:100%;border:1px solid #cbd5e1;border-radius:4px;" /><figcaption style="font-size:12px;color:#475569;margin-top:4px;">${t("w9a.reportWrite.figureCaption", { no: figNo, label: safeLabel })}</figcaption></figure>`
      : `<div style="border:2px dashed var(--color-info-600);border-radius:8px;padding:12px;margin:8px 0;background:#f0f9ff;text-align:center;font-size:13px;color:var(--color-info-600);">${t("w9a.reportWrite.anchorPlaceholder", { label: safeLabel })}</div>`;
    editorRef.current?.insertHtml(html);
    message.success(t("reportWrite.anchorInserted"));
  }, [context.document.html]);

  // [v3.0.6.11-100 Wave 2B (报告工作站)] MIP 截图联动: Modal 生成 → 水印图注插入编辑器
  const [mipModalOpen, setMipModalOpen] = useState(false);

  // [v3.0.6.11-100 Wave 2B] MIP 截图插入: 复用 insertHtml 通道, 图中带「MIP 重建」水印 + 源检查信息
  const handleInsertMip = useCallback((payload: MipScreenshotPayload) => {
    if (!payload?.imageBase64) {
      message.warning(t("reportWrite.mipFailed"));
      return;
    }
    const existingImgs = (context.document.html?.match(/<img\b/gi) ?? []).length;
    editorRef.current?.insertHtml(buildMipFigureHtml(payload, existingImgs));
    setMipModalOpen(false);
    message.success(t("reportWrite.mipInserted"));
  }, [context.document.html]);

  // [v3.0.6.11-100 Wave 2B] 影像标注 → 阅片器定位
  const handleJumpAnnotation = useCallback((studyUid?: string, seriesUid?: string) => {
    const params = new URLSearchParams();
    if (studyUid) params.set('studyUid', studyUid);
    if (seriesUid) params.set('seriesUid', seriesUid);
    if (context.examId) params.set('examId', context.examId);
    navigate(`/dicom-viewer-pro?${params.toString()}`);
  }, [context.examId, navigate]);

  // [v3.0.6.11-70] 自动保存: 30 秒定时真实保存(节流: 保存中/无变更跳过)
  useEffect(() => {
    const timer = setInterval(() => {
      if (savingRef.current || !reportId) return;
      const snapshot = `${context.document.plainText ?? ''}|${context.document.html ?? ''}`;
      if (snapshot === lastSavedRef.current) return;
      setAutoSaveTip(t("reportWrite.autoSaving2"));
      void doSave(true).then((ok) => {
        setAutoSaveTip(ok ? t("w9a.reportWrite.autoSavedAt", { time: new Date().toLocaleTimeString() }) : t("reportWrite.autoSaveFailed"));
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [reportId, context.document.plainText, context.document.html, doSave]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const r = await import('@services/writing/writingService').then((m) =>
        m.submitReport(reportId ?? '', {
          finalScore: preScore.score,
          structured: context.fields,
          html: context.document.html ?? '',
          plainText: context.document.plainText ?? '',
          conclusion: context.document.plainText ?? '',
        })
      );
      if (r.success) {
        message.success(t("reportWrite.submitted"));
        setShowSubmit(false);
        setTimeout(() => navigate('/report-review'), 1500);
      } else {
        message.error(t("reportWrite.submitFailedState"));
      }
    } catch {
      message.error(t("reportWrite.submitFailedNetwork"));
    } finally {
      setSubmitting(false);
    }
  }, [reportId, preScore, context, navigate]);

  // [v3.0.6.11-95 Wave2A P0] 状态机统一走映射层: 兼容后端英文 (REJECTED/WRITING/INITIAL_REVIEW) + MSW 中文 (已驳回/书写中/初审中)
  const statusRaw = String(context.status ?? '').trim();
  const reportStatus = toEnState(statusRaw);
  const canSign = ['REVIEWED', 'SIGNING'].includes(reportStatus);
  const canPublish = reportStatus === 'SIGNED';
  const isPublished = reportStatus === 'PUBLISHED';
  const inFlight = ['SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW'].includes(reportStatus);
  const isRejected = reportStatus === 'REJECTED';
  const isLocked = isPublished;

  const handleSign = useCallback(async () => {
    if (!reportId) return;
    try {
      const res = await reportApi.sign(reportId);
      if (res.success) {
        message.success(t("reportWrite.signed"));
        setContext((c: any) => ({ ...c, status: 'SIGNED' }));
        setLockConflict(false);
      } else {
        message.error(res.error?.message ?? t("reportWrite.signFailed"));
      }
    } catch {
      message.error(t("reportWrite.signFailedNetwork"));
    }
  }, [reportId]);

  const handlePublish = useCallback(async () => {
    if (!reportId) return;
    try {
      const res = await reportApi.publish(reportId);
      if (res.success) {
        message.success(t("reportWrite.published"));
        setContext((c: any) => ({ ...c, status: 'PUBLISHED' }));
        setLockConflict(false);
      } else {
        message.error(res.error?.message ?? t("reportWrite.publishFailed"));
      }
    } catch {
      message.error(t("reportWrite.publishFailedNetwork"));
    }
  }, [reportId]);

  // [v3.0.6.11-95 Wave2A P0] 退回重写: REJECTED → WRITING (对齐 backend REPORT_TRANSITIONS.REJECTED: ['WRITING'])
  const [reworking, setReworking] = useState(false);
  const handleRework = useCallback(async () => {
    if (!reportId) return;
    setReworking(true);
    try {
      const res = await reportApi.rework(reportId, `退回重写:${String(context.rejectReason ?? (statusRaw || t("reportWrite.reviewRejected")))}`);
      if (res.success) {
        message.success(t("reportWrite.returnedToWriting2"));
        setContext((c: any) => ({ ...c, status: res.data?.status ?? res.data?.state ?? 'WRITING', rejectReason: res.data?.rejectReason ?? '' }));
        setLockConflict(false);
      } else {
        message.error(res.error?.message ?? t("reportWrite.returnFailed"));
      }
    } catch {
      message.error(t("reportWrite.returnFailedNetwork"));
    } finally {
      setReworking(false);
    }
  }, [reportId, context.rejectReason, statusRaw]);

  // [v3.0.6.11-98 Wave2B (报告 P1)] 打印模板接线: 先加载布局 → Modal 选择 → preparePrint → 注入 print 容器
  //   布局加载失败时回退现有 window.print
  const handlePrint = useCallback(async () => {
    if (!reportId) return;
    setPrintLoading(true);
    try {
      const { getPrintLayouts } = await import('@services/writing/writingService');
      const layouts = await getPrintLayouts();
      if (!layouts || layouts.length === 0) { window.print(); return; }
      const first = layouts[0];
      if (!first) { window.print(); return; }
      setPrintLayouts(layouts);
      setPrintLayoutId(first.id);
      setPrintOpen(true);
    } catch {
      window.print();
    } finally {
      setPrintLoading(false);
    }
  }, [reportId]);

  // 按选定布局生成打印 HTML → 注入 #report-print-layout-container → window.print → 清理
  const doPrintWithLayout = useCallback(async (layoutId: string) => {
    if (!reportId) return;
    setPrintOpen(false);
    const layout = printLayouts.find((l) => l.id === layoutId) ?? printLayouts[0];
    if (!layout) { window.print(); return; }
    try {
      const { preparePrint } = await import('@services/writing/writingService');
      await preparePrint(reportId, layout.id);
    } catch { /* 打印 HTML 由前端生成, preparePrint 失败不阻断 */ }
    const bodyHtml = context.document.html && String(context.document.html).trim().length > 0
      ? context.document.html
      : `<p>${String(context.document.plainText ?? '').replace(/</g, '&lt;')}</p>`;
    const container = document.createElement('div');
    container.id = 'report-print-layout-container';
    container.innerHTML = buildPrintLayoutHtml({
      layout,
      reportId: String(context.reportId ?? reportId),
      patientName: String(context.patientName ?? ''),
      gender: String(context.gender ?? ''),
      age: String(context.age ?? ''),
      modality: String(context.modality ?? ''),
      bodyPart: String(context.bodyPart ?? ''),
      patientId: String(context.patientId ?? ''),
      clinicalDiagnosis: String(context.clinicalDiagnosis ?? ''),
      bodyHtml,
    });
    document.body.appendChild(container);
    window.print();
    setTimeout(() => { container.remove(); }, 1000);
  }, [reportId, printLayouts, context.reportId, context.patientName, context.gender, context.age, context.modality, context.bodyPart, context.patientId, context.clinicalDiagnosis, context.document.html, context.document.plainText]);

  const handleExport = useCallback(async () => {
    if (!reportId) return;
    setExporting(true);
    try {
      const res = await reportApi.exportReport(reportId, 'pdf');
      if (!res.success) {
        message.error(res.error?.message ?? t("reportWrite.exportFailed"));
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
            message.success(t("reportWrite.pdfExported"));
            return;
          }
        } catch { /* 后端异步生成时走下方提示 */ }
        console.info('[export] queued:', url);
        message.success(t("reportWrite.exportQueued"));
      } else {
        message.success(t("reportWrite.exportQueuedShort"));
      }
    } finally {
      setExporting(false);
    }
  }, [reportId]);

  // [W2-2] 报告模板选择: 加载模板内容到编辑器
  const handleSelectTemplate = useCallback(async (id: string) => {
    if (!id) return;
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
        // [v3.0.6.11-98 Wave1B P0-2] 模板变量自动填充: 全文替换前先解析占位符
        const finalText = resolveTemplateVariables(content, context);
        const { resolved, unresolved } = describeTemplateVariables(content, context);
        setEditorSet({ plainText: finalText, ts: Date.now() });
        if (resolved.length > 0 || unresolved.length > 0) {
          message.info(
            `${t("w9a.reportWrite.varFillPrefix")}${resolved.length > 0 ? t("w9a.reportWrite.varFilled", { keys: resolved.map((k) => `{{${k}}}`).join(',') }) : ''}${unresolved.length > 0 ? `${resolved.length > 0 ? ';' : ''}${unresolved.map((k) => `{{${k}}}`).join(',')}${t("w9a.reportWrite.varUnresolvedSuffix")}` : ''}`,
            4,
          );
        }
        message.success(t("w9a.reportWrite.appliedTemplate", { name: cached?.name ?? id }));
      } else {
        message.info(t("reportWrite.structuredTemplateHint2"));
      }
    } catch {
      message.error(t("reportWrite.templateLoadFailed"));
    }
    // [v3.0.6.11-98 Wave1B P0-2] 依赖 context 供模板变量自动填充
  }, [context]);

  // [v3.0.6.11-95 Wave3B P1] 模板库: 最近使用置顶 (localStorage: report-recent-templates)
  const recordTemplateRecent = useCallback((id: string) => {
    setRecentTemplateIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8);
      localStorage.setItem('report-recent-templates', JSON.stringify(next));
      return next;
    });
  }, []);

  // [v3.0.6.11-95 Wave3B P1] 模板库: 点击插入光标处 (复用 externalInsert 通道)
  // [v3.0.6.11-98 Wave1B P0-2] 模板变量自动填充: 插入前先解析 {{patientName}} 等占位符
  const insertTemplateAtCursor = useCallback((tpl: any) => {
    const content = tpl?.content || tpl?.body || '';
    if (!content) {
      message.info(t('reportWrite.structuredTemplateHint'));
      return;
    }
    const { resolved, unresolved } = describeTemplateVariables(content, context);
    const finalText = resolveTemplateVariables(content, context);
    setVoiceInsert({ text: finalText, ts: Date.now() });
    recordTemplateRecent(tpl.id);
    if (resolved.length > 0 || unresolved.length > 0) {
      message.info(
        `${t("w9a.reportWrite.varFillPrefix")}${resolved.length > 0 ? t("w9a.reportWrite.varFilled", { keys: resolved.map((k) => `{{${k}}}`).join(',') }) : ''}${unresolved.length > 0 ? `${resolved.length > 0 ? ';' : ''}${unresolved.map((k) => `{{${k}}}`).join(',')}${t("w9a.reportWrite.varUnresolvedSuffix")}` : ''}`,
        4,
      );
    }
    message.success(t("w9a.reportWrite.insertedTemplate", { name: tpl?.name ?? tpl.id }));
  }, [recordTemplateRecent, context]);

  // [v3.0.6.11-95 Wave3B P1] 模板库: 收藏星标
  // [v3.0.6.11-98 Wave2B (报告 P1)] 收藏服务端化: 优先 POST /templates/:id/favorite, 失败回退 localStorage 并标注
  const toggleFavTemplate = useCallback(async (id: string) => {
    try {
      const res = await templatesApi.toggleFavorite(id);
      if (res.success && Array.isArray(res.data?.ids)) {
        setFavSource('api');
        setFavTemplateIds(res.data.ids);
        return;
      }
      throw new Error('favorite toggle failed');
    } catch {
      setFavSource('fallback');
      setFavTemplateIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        localStorage.setItem('report-fav-templates', JSON.stringify(next));
        return next;
      });
    }
  }, []);

  // [v3.0.6.11-98 Wave2B (报告 P1)] 挂载时同步服务端收藏 (GET /templates/favorites), 失败保留 localStorage
  useEffect(() => {
    let cancelled = false;
    templatesApi.listFavorites().then((res) => {
      if (cancelled || !res.success) return;
      const ids = Array.isArray(res.data?.ids) ? res.data.ids : [];
      if (ids.length > 0) {
        setFavTemplateIds((prev) => Array.from(new Set([...ids, ...prev])));
        setFavSource('api');
      }
    }).catch(() => { if (!cancelled) setFavSource('fallback'); });
    return () => { cancelled = true; };
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

  // [v3.0.6.11-98 Wave1B P0-3] 上一例复制: 同患者最近一份非当前报告 (同模态优先) 的所见/印象预览后插入
  const [prevCopyOpen, setPrevCopyOpen] = useState(false);
  const [prevCopyLoading, setPrevCopyLoading] = useState(false);
  const [prevReport, setPrevReport] = useState<any | null>(null);
  const [prevSameModality, setPrevSameModality] = useState(false);
  const [prevPick, setPrevPick] = useState<{ findings: boolean; impression: boolean }>({ findings: true, impression: true });

  const copyPreviousReport = useCallback(async () => {
    const pid = context.patientId;
    if (!pid) { message.warning(t("reportWrite.noPatientForPrior")); return; }
    setPrevCopyLoading(true);
    try {
      const res = await reportApi.list({ take: '50', patientId: pid });
      const arr = res.success
        ? (Array.isArray(res.data) ? res.data : ((res.data as { items?: unknown[] })?.items ?? []))
        : [];
      const curId = String(reportId ?? context.reportId ?? '');
      const curModality = String(context.modality ?? '');
      const others = (arr as any[]).filter((x) => {
        const id = String(x?.reportId || x?.id || '');
        return id !== curId && Boolean(x?.findings || x?.impression || x?.conclusion || x?.diagnosis);
      });
      if (others.length === 0) { message.info(t("reportWrite.noPriorToCopy")); return; }
      const sortByDate = (list: any[]) => [...list].sort((a, b) =>
        String(b?.createdTime ?? b?.examDate ?? b?.studyDate ?? '').localeCompare(String(a?.createdTime ?? a?.examDate ?? a?.studyDate ?? '')));
      const byMod = others.filter((x) => String(x?.modality ?? '') === curModality);
      const picked = byMod.length > 0 ? sortByDate(byMod)[0] : sortByDate(others)[0];
      setPrevReport(picked);
      setPrevSameModality(byMod.length > 0);
      setPrevPick({ findings: true, impression: true });
      setPrevCopyOpen(true);
    } catch {
      message.error(t("reportWrite.priorQueryFailed"));
    } finally {
      setPrevCopyLoading(false);
    }
  }, [context.patientId, context.reportId, context.modality, reportId]);

  // [v3.0.6.11-103 Wave 12] 既往对比: 同患者最近一份既往报告 → 打开 diff 对比 Modal
  const [priorCompareLoading, setPriorCompareLoading] = useState(false);
  const handlePriorCompare = useCallback(async () => {
    const pid = context.patientId;
    if (!pid) { message.warning(t("reportWrite.noPatientForPriorReport")); return; }
    setPriorCompareLoading(true);
    try {
      let arr: any[] = priorSource === 'api' ? priorReports : (context.priorReports ?? []);
      if (arr.length === 0) {
        const res = await reportApi.list({ take: '50', patientId: pid });
        const list = res.success
          ? (Array.isArray(res.data) ? res.data : ((res.data as { items?: unknown[] })?.items ?? []))
          : [];
        arr = (list as any[]).filter((x) => String(x?.reportId || x?.id) !== String(reportId ?? context.reportId ?? ''));
      }
      if (arr.length === 0) { message.info(t('w12.write.priorCompareEmpty')); return; }
      const sortByDate = (list: any[]) => [...list].sort((a, b) =>
        String(b?.createdTime ?? b?.examDate ?? b?.studyDate ?? '').localeCompare(String(a?.createdTime ?? a?.examDate ?? a?.studyDate ?? '')));
      const latest = sortByDate(arr)[0];
      const oldText = latest?.findings ?? latest?.impression ?? '';
      if (!oldText) { message.info(t('w12.write.priorCompareEmpty')); return; }
      const label = `${latest.reportId ?? latest.id} (${latest.studyDate ?? latest.createdTime ?? ''})`;
      setDiffTarget({ oldText, label });
      message.success(t("reportWrite.priorLoadedForCompare"));
    } catch {
      message.error(t("reportWrite.priorLoadFailed"));
    } finally {
      setPriorCompareLoading(false);
    }
  }, [context.patientId, context.priorReports, context.reportId, priorReports, priorSource, reportId]);

  // 插入上例内容: 所见 → 影像所见段, 印象 → 诊断意见段 (externalInsert 光标处)
  const applyPreviousCopy = useCallback(() => {    if (!prevReport) return;
    const parts: string[] = [];
    if (prevPick.findings && prevReport.findings) parts.push(`${t("w9a.reportWrite.findingsSection")}:\n${prevReport.findings}`);
    const impression = prevReport.impression ?? prevReport.conclusion ?? prevReport.diagnosis;
    if (prevPick.impression && impression) parts.push(`${t("w9a.reportWrite.impressionSection")}:\n${impression}`);
    if (parts.length === 0) { message.info(t("reportWrite.selectFindingOrImpression")); return; }
    setVoiceInsert({ text: parts.join('\n\n'), ts: Date.now() });
    setPrevCopyOpen(false);
    message.success(t("w9a.reportWrite.copiedPrev", { modality: prevReport.modality ?? '', date: prevReport.examDate ?? prevReport.createdTime ?? '' }));
  }, [prevReport, prevPick]);

  // [v3.0.6.11-95 Wave2B P1] 书写页快捷键: Ctrl+S 保存草稿 / Ctrl+Enter 提交 / Alt+↑↓ 上下例 / F2 语音 / F5 AI 草稿
  const handleShortcutSubmit = useCallback(() => {
    if (canSign) { void handleSign(); return; }
    if (canPublish) { void handlePublish(); return; }
    if (!isLocked && !inFlight && reportId) {
      const found = detectConflicts(context.document.plainText);
      setConflicts(found);
      // [v3.0.6.11-96 Wave2A P0] 提交前强制重新评分 (真实 reportQualityApi.evaluate)
      void runQualityEvaluate({ force: true });
      setShowSubmit(true);
    }
  }, [canSign, canPublish, isLocked, inFlight, reportId, context.document.plainText, handleSign, handlePublish, runQualityEvaluate]);

  useKeyboardShortcuts([
    { key: 's', ctrlKey: true, action: () => { void doSave(false); }, description: t("reportWrite.saveDraft") },
    { key: 'Enter', ctrlKey: true, action: handleShortcutSubmit, description: t("reportWrite.submitReview") },
    // [v3.0.6.11-103 Wave 12] Ctrl+T 打开模板库 (收藏夹/智能匹配)
    { key: 't', ctrlKey: true, action: () => { setTemplateLibOpen(true); }, description: t('w12.write.shortcutTemplateHint') },
    { key: 'ArrowUp', altKey: true, action: goPrev, description: t("reportWrite.prevCase") },
    { key: 'ArrowDown', altKey: true, action: goNext, description: t("reportWrite.nextCase") },
    { key: 'F2', action: () => { setSiderVisible(true); setActiveToolsTab('voice'); message.info(t("reportWrite.voiceOpened")); }, description: t("reportWrite.voiceInput") },
    { key: 'F5', action: () => { setAiUi((u) => ({ ...u, open: true })); }, description: t("reportWrite.aiDraft") },
  ]);

  // [G005] 快捷键帮助浮层: 顶栏键盘图标 → ShortcutHelpModal
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const globalShortcuts = useMemo(() => buildGlobalShortcuts({ navigate }), [navigate]);

  // [v3.0.6.11-95 Wave2B P1] 草稿超时提醒: 打开超过 24h 未更新的草稿显示提示条
  const staleHours = useMemo(() => {
    const lastEdited = context.document.lastEditedAt ?? context.document.updatedAt ?? '';
    if (!lastEdited) return 0;
    const ts = new Date(lastEdited).getTime();
    if (Number.isNaN(ts)) return 0;
    return (Date.now() - ts) / 3600000;
  }, [context.document.lastEditedAt, context.document.updatedAt]);
  const isDraftStale = ['WRITING', 'DRAFT', 'ASSIGNED', 'PENDING_ASSIGNMENT', 'REJECTED'].includes(reportStatus) && staleHours >= 24;

  // [W2-2] 短语库插入 (复用语音听写 externalInsert 通道,插入光标处)
  // [v3.0.6.11-98 Wave1B P0-2] 模板变量自动填充: 插入前先按报告上下文解析 {{patientName}} 等占位符
  const insertPhrase = useCallback((p: any) => {
    const text = p?.content || p?.text || '';
    if (!text) return;
    const { resolved, unresolved } = describeTemplateVariables(text, context);
    const finalText = resolveTemplateVariables(text, context);
    setVoiceInsert({ text: finalText, ts: Date.now() });
    setPhraseOpen(false);
    if (resolved.length > 0 || unresolved.length > 0) {
      message.info(
        `${t("w9a.reportWrite.varFillPrefix")}${resolved.length > 0 ? t("w9a.reportWrite.varFilled", { keys: resolved.map((k) => `{{${k}}}`).join(',') }) : ''}${unresolved.length > 0 ? `${resolved.length > 0 ? ';' : ''}${unresolved.map((k) => `{{${k}}}`).join(',')}${t("w9a.reportWrite.varUnresolvedSuffix")}` : ''}`,
        4,
      );
    }
    message.success(t("reportWrite.phraseInserted"));
  }, [context]);

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
    try {
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
        setAiUi((u) => ({ ...u, loading: false, error: res.error?.message ?? t("reportWrite.aiDraftFailed") }));
      }
    } catch {
      setAiUi((u) => ({ ...u, loading: false, error: t("reportWrite.aiDraftFailedNetwork") }));
    }
  }, [aiUi.clinical, aiUi.findings, aiUi.style, context.reportId, context.patientId, context.modality, context.bodyPart]);

  // 医生接受: 草稿 → 正式, 应用至编辑器
  const handleAiAccept = useCallback(async () => {
    if (!aiDraft) return;
    setAiActionLoading(true);
    try {
      const res = await aiDraftApi.acceptDraft(aiDraft.id);
      if (res.success && res.data) {
        setEditorSet({ plainText: res.data.draftText, ts: Date.now() });
        setAiConfirm(false);
        message.success(t("reportWrite.aiDraftAccepted"));
      } else {
        message.error(res.error?.message ?? t("reportWrite.acceptFailed"));
      }
    } catch {
      message.error(t("reportWrite.acceptFailedNetwork"));
    } finally {
      setAiActionLoading(false);
    }
  }, [aiDraft]);

  // 医生修改后保存
  const handleAiModifySave = useCallback(async () => {
    if (!aiDraft) return;
    setAiActionLoading(true);
    try {
      const res = await aiDraftApi.modifyDraft(aiDraft.id, aiEditText);
      if (res.success && res.data) {
        setEditorSet({ plainText: res.data.draftText, ts: Date.now() });
        setAiConfirm(false);
        message.success(t("reportWrite.modifySaved"));
      } else {
        message.error(res.error?.message ?? t("reportWrite.modifyFailed"));
      }
    } catch {
      message.error(t("reportWrite.modifyFailedNetwork"));
    } finally {
      setAiActionLoading(false);
    }
  }, [aiDraft, aiEditText]);

  const applyAiTextToEditor = useCallback((text: string) => {
    if (!text) return;
    setEditorSet({ plainText: text, ts: Date.now() });
  }, []);

  const siderTabs = useMemo(() => [
    { key: 'templates', label: <Space size={4}><BookMarked className="w-3 h-3" />{t('w12.write.templatesTab')}</Space>, children: null },
    { key: 'ai', label: <Space size={4}><Sparkles className="w-3 h-3" />{t("reportWrite.aiDraft")}</Space>, children: null },
    { key: 'voice', label: <Space size={4}><Mic className="w-3 h-3" />{t("reportWrite.voice")}</Space>, children: null },
    { key: 'history', label: <Space size={4}><History className="w-3 h-3" />{t("reportWrite.historyTab")}</Space>, children: null },
    { key: 'similar', label: <Space size={4}><Brain className="w-3 h-3" />{t("reportWrite.similarCases")}</Space>, children: null },
    { key: 'score', label: <Space size={4}><BarChart3 className="w-3 h-3" />{t("reportWrite.preScore")}</Space>, children: null },
    { key: 'drafts', label: <Space size={4}><Save className="w-3 h-3" />{t("reportWrite.draft")}</Space>, children: null },
    { key: 'kw', label: <Space size={4}><TagIcon className="w-3 h-3" />{t("reportWrite.keywords")}</Space>, children: null },
    { key: 'compliance', label: <Space size={4}><ListChecks className="w-3 h-3" />{t("reportWrite.compliance")}</Space>, children: null },
    { key: 'collab', label: <Space size={4}><Eye className="w-3 h-3" />{t("reportWrite.collaboration")}</Space>, children: null },
    // [v3.0.6.11-99 Wave 2A 报告批注] 书写页批注面板 (引用选中文本/定位正文)
    { key: 'annotations', label: <Space size={4}><MessageSquareText className="w-3 h-3" />{t("reportWrite.annotations")}</Space>, children: null },
  ], []);

  const renderActiveTab = () => {
    switch (activeToolsTab) {
      // [v3.0.6.11-103 Wave 12] 常用模板 Tab: 智能匹配推荐 + 收藏夹 + 最近使用 (一键应用)
      case 'templates': return (
        <TemplateSmartPanel
          templates={templateList}
          loading={templateLoading}
          favIds={favTemplateIds}
          recentIds={recentTemplateIds}
          modality={context.modality}
          bodyPart={context.bodyPart}
          onApply={(id) => { void handleSelectTemplate(String(id)); }}
          onToggleFav={(id) => { void toggleFavTemplate(String(id)); }}
        />
      );
      case 'ai': return <AITab reportId={reportId ?? ''} modality={context.modality} bodyPart={context.bodyPart} onApplyToEditor={applyAiTextToEditor} />;
      case 'voice': return <VoiceTab reportId={reportId ?? ''} onInsert={(text) => setVoiceInsert({ text, ts: Date.now() })} onTextChange={() => { /* 实时文本由编辑器插入按钮统一处理 */ }} />;
      case 'history': return <HistoryTab priorReports={priorSource === 'api' ? priorReports : context.priorReports} dataSource={priorSource} currentText={context.document.plainText} onCompare={(oldText, label) => setDiffTarget({ oldText, label })} summary={priorSummary} onFillHistory={handleFillHistory} />;
      case 'similar': return <SimilarTab reportText={context.document.plainText} modality={context.modality} bodyPart={context.bodyPart} />;
      case 'score': return <ScoreTab preScore={preScore} source={preScoreSource} loading={preScoreLoading} />;
      case 'drafts': return <DraftsTab drafts={drafts} />;
      case 'kw': return <KWTab keywords={kwSource === 'api' ? kwHighlights : KEYWORD_HIGHLIGHTS_MOCK} source={kwSource} />;
      case 'compliance': return <ComplianceTab evaluation={qualityEval} />;
      case 'collab': return <CollabTab />;
      // [v3.0.6.11-99 Wave 2A 报告批注] 书写页批注: editorSelector 指向富文本编辑器 (选区引用/定位)
      case 'annotations': return (
        <ReportAnnotationPanel
          reportId={reportId ?? ''}
          currentUser={annotationCurrentUser}
          compact
          maxHeight={560}
          testIdPrefix="write-annotations"
          editorSelector={'.v3-content [contenteditable="true"]'}
        />
      );
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
          <span className="v3-topbar-title">{t("reportWrite.pageTitle")}</span>
          <Tag color="blue">{context.reportId}</Tag>
          <Tag color="purple">{context.modality} - {context.bodyPart}</Tag>
          <Tag color={preScore.passed ? 'success' : 'warning'}>
            {preScore.passed ? t("reportWrite.submittable") : t("reportWrite.needsWork")}
          </Tag>
          {/* [v3.0.6.11-96 Wave2A P0] 预评分数据源标注: 真实 reportQualityApi.evaluate / 演示回退 */}
          <Tag color={preScoreSource === 'api' ? 'green' : 'orange'} title={t("reportWrite.preScoreSource")}>
            {preScoreSource === 'api' ? t("reportWrite.realScore") : t("reportWrite.demoFallback")}
          </Tag>
          {/* [v3.0.6.11-95 Wave3B P1] 模板库面板: 分类浏览 + 短语分区 + 点击插入光标处 (替代原下拉) */}
          <Tooltip title={t("reportWrite.templateLibraryHint")}>
            <Button
              size="small"
              loading={templateLoading}
              icon={<BookMarked className="w-3.5 h-3.5" />}
              onClick={() => setTemplateLibOpen(true)}
            >
              {t("reportWrite.templateLibrary")}
            </Button>
          </Tooltip>
          {/* [v3.0.6.11-100 Wave2C P2] 段落树模板引擎: 按当前模态/部位匹配段落模板 → 段落树预览 → 一键填充 */}
          <Tooltip title={t("reportWrite.templateSectionsHint")}>
            <Button
              size="small"
              icon={<ListTree className="w-3.5 h-3.5" />}
              onClick={() => setSectionEngineOpen(true)}
            >
              {t("reportWrite.sectionTree")}
            </Button>
          </Tooltip>
          {/* [v3.0.6.11-95 Wave3B P1] 患者画像入口 → /patients/:id/360 */}
          <Tooltip title={t("reportWrite.openPatient360")}>
            <Button
              size="small"
              icon={<Radar className="w-3.5 h-3.5" />}
              onClick={() => {
                if (context.patientId) navigate(`/patients/${encodeURIComponent(context.patientId)}/360`);
                else message.warning(t("reportWrite.noPatientProfile"));
              }}
            >
              {t("reportWrite.patientProfile")}
            </Button>
          </Tooltip>
          {/* [W2-2] 上下例导航 */}
          <Tooltip title={t("reportWrite.prevCase")}>
            <Button type="text" size="small" disabled={listIndex <= 0} icon={<ChevronUp className="w-4 h-4" />} onClick={goPrev} />
          </Tooltip>
          <Tooltip title={t("reportWrite.nextCase")}>
            <Button type="text" size="small" disabled={listIndex >= reportList.length - 1} icon={<ChevronDown className="w-4 h-4" />} onClick={goNext} />
          </Tooltip>
          {reportList.length > 0 && (
            <span className="v3-topbar-stats v3-topbar-hide-mobile">{listIndex + 1} / {reportList.length}</span>
          )}
          {/* [v3.0.6.11-98 Wave1B P0-3] 复制上例: 同患者最近报告(同模态优先)所见/印象 */}
          <Tooltip title={!context.patientId ? t("reportWrite.noPriorExam") : t("reportWrite.copyPriorHint")}>
            <Button
              size="small"
              icon={<Copy className="w-3.5 h-3.5" />}
              loading={prevCopyLoading}
              disabled={!context.patientId || isLocked}
              onClick={() => void copyPreviousReport()}
            >
              {t("reportWrite.copyPrior")}
            </Button>
          </Tooltip>
          {/* [v3.0.6.11-103 Wave 12] 既往对比: 同患者最近既往报告一键加载对比 */}
          <Tooltip title={t('w12.write.priorCompare')}>
            <Button
              size="small"
              icon={<History className="w-3.5 h-3.5" />}
              loading={priorCompareLoading}
              disabled={!context.patientId}
              onClick={() => void handlePriorCompare()}
            >
              {t('w12.write.priorCompare')}
            </Button>
          </Tooltip>
          {isLocked && <Tag icon={<Lock className="w-3 h-3" />} color="volcano">{t("reportWrite.locked")}</Tag>}
        </div>
        <div className="v3-topbar-right">
          <Tooltip title={t("reportWrite.aiEnvNote2")}>
            <Button icon={<Sparkles className="w-4 h-4" />} onClick={() => setAiUi((u) => ({ ...u, open: true }))}>{t("reportWrite.aiDraft")}</Button>
          </Tooltip>
          <Tooltip title={t("reportWrite.saveDraft")}>
            <ActionButton action="save" loading={saving} onClick={() => void doSave(false)}>{t("reportWrite.save")}</ActionButton>
          </Tooltip>
          {/* [W2-2] 打印 / PDF 导出 */}
          <Tooltip title={t("reportWrite.printHint")}>
            <ActionButton action="print" onClick={handlePrint} disabled={!reportId}>{t("reportWrite.print")}</ActionButton>
          </Tooltip>
          <Tooltip title={t("reportWrite.exportPdf")}>
            <ActionButton action="export" loading={exporting} onClick={() => void handleExport()} disabled={!reportId}>{t("reportWrite.export")}</ActionButton>
          </Tooltip>
          {/* [W2-2] 短语库插入 */}
          <Tooltip title={t("reportWrite.phraseLibraryHint")}>
            <Button icon={<BookMarked className="w-4 h-4" />} onClick={() => setPhraseOpen(true)}>{t("reportWrite.phraseLibrary")}</Button>
          </Tooltip>
          <span className="v3-topbar-stats v3-topbar-hide-mobile">
            {context.document.wordCount} {t("reportWrite.wordsPer")} {Math.round(context.document.writingDurationSec / 60)} {t("reportWrite.minUnit")}
          </span>
          {/* [v3.0.6.11-95 Wave2B P1] 快捷键提示 */}
          <Tooltip title={t("reportWrite.shortcuts2")}>
            <Button type="text" size="small" className="v3-topbar-hide-mobile" icon={<Keyboard className="w-3.5 h-3.5" />} onClick={() => setShortcutHelpOpen(true)} />
          </Tooltip>
          <span className="v3-topbar-autosave">{autoSaveTip}</span>
          {/* [W2-2] 签署 / 发布入口 (按状态机显示) */}
          {canSign ? (
            <Button type="primary" icon={<BadgeCheck className="w-4 h-4" />} onClick={() => void handleSign()}>
              {t("reportWrite.sign")}
            </Button>
          ) : canPublish ? (
            <Button type="primary" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => void handlePublish()}>
              {t("reportWrite.publish")}
            </Button>
          ) : isRejected ? (
            // [v3.0.6.11-95 Wave2A P0] 退回重写闭环: REJECTED → WRITING 后进入可提交态
            <Button type="primary" danger icon={<RefreshCw className="w-4 h-4" />} loading={reworking} onClick={() => void handleRework()}>
              {t("reportWrite.returnToRewrite")}
            </Button>
          ) : !isLocked && !inFlight ? (
            <ActionButton action="submit" onClick={() => {
              const found = detectConflicts(context.document.plainText);
              setConflicts(found);
              setShowSubmit(true);
            }}>
              {t("reportWrite.submitReview")}
            </ActionButton>
          ) : null}
          <Tooltip title={siderVisible ? t("reportWrite.collapseSidebar") : t("reportWrite.expandSidebar")}>
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
              message={t("w9a.reportWrite.lockedMessage", { status: displayStatus(context.status) })}
            />
          )}
          {/* [v3.0.6.11-95 Wave2A P0] 退回重写闭环: 展示驳回原因 + 引导重写 */}
          {isRejected && (
            <Alert
              type="error"
              showIcon
              className="no-print"
              icon={<XCircle className="w-4 h-4" />}
              message={t("w9a.reportWrite.rejectedMessage", { status: displayStatus(statusRaw) }) + (context.rejectReason ? t("w9a.reportWrite.rejectedReason", { reason: context.rejectReason }) : '')}
              description={t("reportWrite.rewriteHint")}
            />
          )}
          {lockConflict && (
            <Alert
              type="warning"
              showIcon
              className="no-print"
              message={t("reportWrite.concurrentEditWarn")}
            />
          )}
          {/* [v3.0.6.11-95 Wave2B P1] 草稿超时提醒 (打开超过 24h 未更新) */}
          {isDraftStale && (
            <Alert
              type="warning"
              showIcon
              className="no-print"
              message={t("w9a.reportWrite.staleDraft", { hours: Math.round(staleHours) })}
            />
          )}
          {/* [v3.0.6.11-100 Wave 2A] 危急值电话/短信网关卡片 (报告关联危急值时显示) */}
          {criticalAlert && (
            <CriticalValueCard
              alert={criticalAlert}
              compact
              onNotified={(updated) => setCriticalAlert((prev) => (prev?.id === updated.id ? { ...prev, status: updated.status } : prev))}
            />
          )}
          {/* [v3.0.6.11-103 Wave 12] 报告流程状态条: 7 态状态机 + 下一步一键流转 */}
          <ReportFlowBar
            status={statusRaw}
            reportId={reportId}
            onTransited={(to) => {
              setContext((c: any) => ({ ...c, status: to }));
              setLockConflict(false);
            }}
          />
          <Card size="small" className="v3-card no-print" title={<Space><StickyNote className="w-4 h-4" /><span>{t("reportWrite.clinicalInfo")}</span><Tag color="orange" className="text-[10px]" title={t("reportWrite.exampleDataNote")}>{t("reportWrite.exampleData")}</Tag></Space>}>
            <div className="v3-clinical-grid">
              <div className="v3-clinical-item"><div className="v3-clinical-label">{t("reportWrite.patient")}</div><div className="font-semibold">{context.patientName || '张三'}{!context.patientName && <span className="text-[10px] text-orange-500 ml-1">{t("reportWrite.exampleSuffix")}</span>}</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">{t("reportWrite.genderAge2")}</div><div>{(context.gender || t("reportWrite.male"))} / {(context.age || 58)} {t("reportWrite.yearsOld")}{!context.gender && <span className="text-[10px] text-orange-500 ml-1">{t("reportWrite.exampleSuffix")}</span>}</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">{t("reportWrite.accessionNo")}</div><div className="v3-clinical-code">{context.patientId}</div></div>
              {/* [v3.0.6.11-99 Wave8A P1] 临床信息 fallback 行级来源标注 */}
              <div className="v3-clinical-item"><div className="v3-clinical-label">{t("reportWrite.clinicalDiagnosis")}</div><div>{context.clinicalDiagnosis || t("reportWrite.demoClinicalDiagnosis")}{!context.clinicalDiagnosis && <span className="text-[10px] text-orange-500 ml-1">{t("reportWrite.exampleSuffix")}</span>}</div></div>
              <div className="v3-clinical-full">
                <b>{t("reportWrite.reportStatusLabel")}</b>{' '}
                {statusRaw ? displayStatus(statusRaw) : t("reportWrite.draft")}<br />
                <b>{t("reportWrite.complaintLabel")}</b>{t("reportWrite.demoComplaintShort2")} <span className="text-[10px] text-orange-500">{t("reportWrite.exampleSuffix")}</span><br />
                <b>{t("reportWrite.presentIllness")}</b>{t("reportWrite.demoPresentIllness")} <span className="text-[10px] text-orange-500">{t("reportWrite.exampleSuffix")}</span><br />
                <b>{t("reportWrite.pastHistory")}</b>{t("reportWrite.demoPastHistory")} <span className="text-[10px] text-orange-500">{t("reportWrite.exampleSuffix")}</span>
              </div>
            </div>
          </Card>

          {/* [W2-2] 内嵌影像视口 (折叠面板: 缩略列表 + 跳转完整查看器) */}
          <Card size="small" className="v3-card no-print" title={<Space><MonitorPlay className="w-4 h-4 text-purple-500" /><span>{t("reportWrite.imageViewport")}</span></Space>}>
            <Collapse
              size="small"
              items={[{
                key: 'images',
                label: t("w9a.reportWrite.currentExamImages", { modality: context.modality, bodyPart: context.bodyPart, examId: context.examId ? ` · ${context.examId}` : '' }),
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
                            <span className="text-xs text-slate-500">{m.modality} · {m.seriesCount} {t("reportWrite.series")}</span>
                          </div>
                        ));
                      }
                      return (
                        <>
                          {/* [v3.0.6.11-99 Wave8A P1] 无真实影像数据时保留 mock 缩略图渲染 + 「示例影像」标注 */}
                          <div className="flex flex-col items-center gap-1">
                            <img src="/mock/thumb-ct-001.png" alt="CT-1" loading="lazy" className="w-36 h-28 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80" onClick={() => openViewer()} />
                            <span className="text-xs text-slate-500">{t("reportWrite.ctAxialSeries2")} <Tag color="orange" className="text-[10px]">{t("reportWrite.exampleImage")}</Tag></span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <img src="/mock/thumb-ct-002.png" alt="CT-2" loading="lazy" className="w-36 h-28 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80" onClick={() => openViewer()} />
                            <span className="text-xs text-slate-500">{t("reportWrite.ctEnhanced")} <Tag color="orange" className="text-[10px]">{t("reportWrite.exampleImage")}</Tag></span>
                          </div>
                        </>
                      );
                    })()}
                    <Button
                      icon={<ExternalLink className="w-3 h-3" />}
                      onClick={() => openViewer(context.multiModality?.modalities?.[0]?.studyUID)}
                    >
                      {t("reportWrite.openViewer")}
                    </Button>
                  </div>
                ),
              }]}
            />
          </Card>

          {/* [G005 v3.0.6.11-99 Wave 4B] 测量入报告: 影像测量结果 (sessionStorage 导入) + 手动添加 → SR 测量表 */}
          <Card size="small" className="v3-card no-print" title={<Space><Ruler className="w-4 h-4 text-emerald-500" /><span>{t("reportWrite.imageMeasurements")}</span><Tag color="green">{t("reportWrite.srSection")}</Tag></Space>}
            extra={<Space>
              <Button size="small" icon={<Download className="w-3 h-3" />} onClick={importMeasureRows}>{t("reportWrite.importFromViewer")}</Button>
              <Button size="small" type="primary" icon={<FileText className="w-3 h-3" />} disabled={measureRows.length === 0} onClick={handleInsertMeasurement}>{t("reportWrite.insertMeasurements")}</Button>
            </Space>}>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Select size="small" style={{ width: 110 }} value={measureDraft.type}
                onChange={(v) => setMeasureDraft((d) => ({ ...d, type: String(v) }))}
                options={[
                  { value: 'line', label: t("reportWrite.measureLength") }, { value: 'angle', label: t("reportWrite.measureAngle") }, { value: 'cobb', label: t("reportWrite.measureCobb") },
                  { value: 'ellipse', label: t("reportWrite.ellipseArea") }, { value: 'rectangle', label: t("reportWrite.rectArea") }, { value: 'circle', label: t("reportWrite.circleArea") },
                  { value: 'polygon', label: t("reportWrite.polygonArea") }, { value: 'ctvalue', label: t("reportWrite.measureCt") }, { value: 'volume', label: t("reportWrite.measureVolume") },
                ]} />
              <Input size="small" style={{ width: 110 }} placeholder={t("reportWrite.measureLocation")} value={measureDraft.location}
                onChange={(e) => setMeasureDraft((d) => ({ ...d, location: e.target.value }))} />
              <Input size="small" style={{ width: 90 }} placeholder={t("reportWrite.measureValue")} value={measureDraft.value}
                onChange={(e) => setMeasureDraft((d) => ({ ...d, value: e.target.value }))} />
              <Select size="small" style={{ width: 80 }} value={measureDraft.unit}
                onChange={(v) => setMeasureDraft((d) => ({ ...d, unit: String(v) }))}
                options={[{ value: 'mm', label: 'mm' }, { value: '°', label: '°' }, { value: 'mm²', label: 'mm²' }, { value: 'HU', label: 'HU' }, { value: 'cm³', label: 'cm³' }]} />
              <Button size="small" icon={<Plus className="w-3 h-3" />} onClick={addMeasureRow}>{t("reportWrite.add")}</Button>
            </div>
            {measureRows.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">{t("reportWrite.noMeasurementsPrompt2")}</div>
            ) : (
              <div className="flex flex-col gap-1 max-h-56 overflow-auto">
                {measureRows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs border border-slate-100 rounded px-2 py-1.5">
                    <Tag color="green" className="w-20 text-center">{r.typeLabel}</Tag>
                    <span className="text-slate-500 w-24 truncate">{r.location || '-'}</span>
                    <span className="text-slate-700 flex-1 truncate">{r.label}</span>
                    <span className="font-bold text-emerald-600">{r.value} {r.unit}</span>
                    {/* [v3.0.6.11-103 Wave 12] 一键测量插入: 单条测量直接插入报告文本 */}
                    <Tooltip title={t('w12.write.insertRowHint')}>
                      <Button size="small" type="text" icon={<FileText className="w-3 h-3" />} className="text-emerald-600" onClick={() => handleInsertMeasureRow(r, i)}>
                        {t('w12.write.insertRow')}
                      </Button>
                    </Tooltip>
                    <Button size="small" type="text" danger icon={<Trash2 className="w-3 h-3" />} onClick={() => removeMeasureRow(i)} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card size="small" className="v3-card no-print" title={<Space><FileText className="w-4 h-4 text-blue-500" /><span>{t("reportWrite.structuredFields")}</span><Tag color="blue">RECIST 1.1</Tag></Space>}>
            <StructuredFieldForm
              reportId={reportId ?? ''}
              initialTemplateId="recist"
              initialValues={context.fields}
              onChange={(values) => setContext((c: any) => ({ ...c, fields: values }))}
              /* [v3.0.6.11-98 Wave2B (报告 P1)] 测量表生成 → insertHtml 通道插入编辑器 */
              onGenerateReportSection={(html) => {
                editorRef.current?.insertHtml(html);
                message.success(t("reportWrite.measurementsInsertedShort"));
              }}
            />
          </Card>

          <Card size="small" className="v3-card print-area" title={<Space><Type className="w-4 h-4 text-cyan-500" /><span>{t("reportWrite.sectionsLabel")}</span></Space>}>
            <ReportRichEditor
              ref={editorRef}
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

          <Card size="small" className="v3-card no-print" title={<Space><ImageIcon className="w-4 h-4 text-purple-500" /><span>{t("reportWrite.keyImagesAnchors")}</span><Tag color="purple">{context.anchors.length}</Tag></Space>}
            extra={
              <Button size="small" type="primary" icon={<Camera className="w-3 h-3" />} onClick={() => setMipModalOpen(true)} data-testid="open-mip-modal">
                {t("reportWrite.insertMip")}
              </Button>
            }>
            <ImageAnchorComponent reportId={reportId ?? ''} onInsertAnchor={handleInsertAnchor} />
          </Card>

          <Card size="small" className="v3-card no-print" title={<Space><PenLine className="w-4 h-4 text-purple-500" /><span>{t("reportWrite.imageAnnotations")}</span><Tag color="purple">{t("reportWrite.twoWaySync")}</Tag></Space>}>
            <DicomAnnotationEmbed
              reportId={reportId ?? ''}
              studyUid={searchParams.get('studyUid') ?? undefined}
              seriesUid={searchParams.get('seriesUid') ?? undefined}
              onJumpToViewer={handleJumpAnnotation}
            />
          </Card>
          {/* [v3.0.6.11-100 Wave2C P3] 报告→随访自动触发: 报告内容命中规则关键词时显示「建议随访」卡片 */}
          <FollowupAutoBookPanel
            reportText={context.document.plainText}
            patientId={context.patientId}
            patientName={context.patientName}
            reportId={reportId ?? ''}
            examId={context.examId}
          />
          {/* [G005 v3.0.6.11-100 Wave 6A (D-1)] AI 检出一键插入: 影像查看器缓存检出 → 面板 (采纳/忽略/插入全部) */}
          <AiLesionAutoInjector
            reportId={reportId ?? ''}
            items={aiPendingFindings}
            onInsertHtml={handleAiInsertOne}
            onIgnore={handleAiIgnoreOne}
            onConsumed={handleAiConsumed}
          />
        </Content>

        {/* 右侧 Sider（懒加载内容） */}
        {siderVisible && (
          <Sider width={360} theme="light" className="v3-sider">
            <Tabs
              activeKey={activeToolsTab}
              onChange={setActiveToolsTab}
              size="small"
              tabBarStyle={{ margin: 0, paddingLeft: 'var(--space-2, 8px)' }}
              tabBarExtraContent={
                <Badge
                  count={drafts.length}
                  title={t("w9a.reportWrite.draftsCount", { count: drafts.length })}
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

      {/* [v3.0.6.11-100 Wave 2B] MIP 截图生成 Modal → 插入报告正文 */}
      <MipScreenshotModal
        open={mipModalOpen}
        defaultStudyUid={searchParams.get('studyUid') ?? undefined}
        onClose={() => setMipModalOpen(false)}
        onInsert={handleInsertMip}
      />

      {/* 提交确认 Modal */}
      <Modal
        title={<Space><Send className="w-4 h-4" /><span>{t("reportWrite.submitConfirmTitle")}</span></Space>}
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
                <div className="font-semibold">{t("reportWrite.detected")} {conflicts.length} {t("reportWrite.keywordConflicts")}</div>
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
          title={preScore.passed ? t("reportWrite.allChecksPassed") : t("w9a.reportWrite.someChecksFailed", { passed: PASSED_COUNT, total: preScore.checklist.length })}
        />
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold mb-1">{t("reportWrite.checklistPrefix2")}{PASSED_COUNT}/{preScore.checklist.length})</div>
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
              <div className="text-slate-500">{t("reportWrite.preScore")}</div>
              <div className="text-lg font-semibold" style={{ color: preScore.passed ? '#10b981' : 'var(--color-warning-500)' }}>{preScore.score} / 100</div>
              <Tag color={preScoreSource === 'api' ? 'green' : 'orange'} className="mt-1 text-[10px]" title={t("reportWrite.preScoreSource")}>
                {preScoreSource === 'api' ? t("reportWrite.realScore") : t("reportWrite.demoFallback")}
              </Tag>
            </div>
            <div className="p-3 bg-slate-50 rounded text-center">
              <div className="text-slate-500">{t("reportWrite.wordCountDuration")}</div>
              <div className="text-lg font-semibold">{context.document.wordCount} {t("reportWrite.wordsPer")} {Math.round(context.document.writingDurationSec / 60)} {t("reportWrite.minUnit")}</div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton action="cancel" onClick={() => setShowSubmit(false)}>{t("reportWrite.cancel")}</ActionButton>
            <ActionButton action="submit" onClick={handleSubmit} loading={submitting} disabled={conflicts.length > 0}>{t("reportWrite.confirmSubmit")}</ActionButton>
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
        dataSource={phraseSource}
        favIds={favPhraseIds}
        onClose={() => setPhraseOpen(false)}
        onPick={insertPhrase}
        onToggleFav={toggleFavPhrase}
      />
      {/* [v3.0.6.11-98 Wave2B (报告 P1)] 打印模板选择 Modal: 标准/带抬头/双栏对比/精简 */}
      <Modal
        open={printOpen}
        title={<Space><Printer className="w-4 h-4" /><span>{t("reportWrite.selectPrintTemplate")}</span></Space>}
        onCancel={() => setPrintOpen(false)}
        width={520}
        destroyOnHidden
        footer={
          <div className="flex justify-end gap-2">
            <ActionButton action="cancel" onClick={() => setPrintOpen(false)}>{t("reportWrite.cancel")}</ActionButton>
            <ActionButton action="print" loading={printLoading} disabled={printLayouts.length === 0} onClick={() => { void doPrintWithLayout(printLayoutId); }}>
              {t("reportWrite.print")}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-2 pt-2">
          {printLayouts.map((l) => (
            <div
              key={l.id}
              role="button"
              tabIndex={0}
              className="p-3 border rounded cursor-pointer flex items-start gap-3 transition-colors"
              style={{ borderColor: printLayoutId === l.id ? 'var(--color-primary-600)' : '#e2e8f0', background: printLayoutId === l.id ? '#eff6ff' : '#fff' }}
              onClick={() => setPrintLayoutId(l.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPrintLayoutId(l.id) } }}
            >
              <Radio checked={printLayoutId === l.id} />
              <div className="text-xs">
                <div className="font-semibold">{l.name}</div>
                <div className="text-slate-500 mt-0.5">{l.description}</div>
              </div>
            </div>
          ))}
          <div className="text-[11px] text-slate-400">{t("reportWrite.printLayoutNote")}</div>
        </div>
      </Modal>
      {/* [v3.0.6.11-95 Wave3B P1] 模板库 Modal: 分类浏览 + 全文模板/短语分区 + 最近使用/收藏 */}
      <TemplateLibraryModal
        open={templateLibOpen}
        templates={templateList}
        phrases={phrases}
        loading={templateLoading || phraseLoading}
        favIds={favTemplateIds}
        recentIds={recentTemplateIds}
        phraseSource={phraseSource}
        realCategories={realCategories}
        favSource={favSource}
        examModality={context.modality}
        examBodyPart={context.bodyPart}
        currentUserId={currentUserId}
        onClose={() => setTemplateLibOpen(false)}
        onInsert={insertTemplateAtCursor}
        onReplace={(id) => { void handleSelectTemplate(String(id)); }}
        onToggleFav={(id) => { void toggleFavTemplate(String(id)); }}
        onPickPhrase={insertPhrase}
        // [v3.0.6.11-103 Wave 2A] 后端应用模板: POST /reports/:id/templates-apply (后端合并 append/overwrite)
        onApplyBackend={(templateId, mode) => {
          if (!reportId) { message.warning(t("reportWrite.noReportContext")); return; }
          const tpl = templateListRef.current.find((t) => t.id === templateId);
          const name = tpl?.name ?? templateId;
          void (async () => {
            try {
              const res = await reportApi.applyTemplate(reportId, templateId, mode);
              if (res.success) {
                const applied = res.data?.templateApplied as { name?: string; mode?: string } | undefined;
                message.success(t("w9a.reportWrite.templateAppliedToReport", { name: applied?.name ?? name, modeText: applied?.mode === 'overwrite' ? t("reportWrite.overwrite") : t("reportWrite.append"), modeKey: applied?.mode ?? mode }));
                // 同步刷新编辑器内容 (后端已合并 findings/htmlContent)
                const fresh = await reportApi.getById(reportId);
                if (fresh.success && fresh.data) {
                  const content = String(fresh.data.htmlContent ?? fresh.data.findings ?? '');
                  if (content) setEditorSet({ plainText: content, ts: Date.now() });
                }
              } else {
                message.error(res.error?.message ?? t("reportWrite.templateApplyFailed"));
              }
            } catch {
              message.error(t("reportWrite.templateApplyNetwork"));
            }
          })();
        }}
      />
      {/* [v3.0.6.11-100 Wave2C P2] 段落树模板引擎 Modal: 按模态/部位匹配 → 段落树预览 → 一键填充编辑器 */}
      <SectionTemplateEngine
        open={sectionEngineOpen}
        modality={context.modality}
        bodyPart={context.bodyPart}
        context={context}
        onClose={() => setSectionEngineOpen(false)}
        onApply={(text) => {
          setEditorSet({ plainText: text, ts: Date.now() });
          message.success(t("reportWrite.sectionTreeFilled"));
        }}
      />
      {/* [v3.0.6.11-98 Wave1B P0-3] 上一例复制预览 Modal: 勾选所见/印象 → 插入编辑器 */}
      <Modal
        open={prevCopyOpen}
        title={t("w9a.reportWrite.copyPrevTitle", { id: prevReport?.reportId ?? prevReport?.id ?? '', modality: prevReport?.modality ?? '', bodyPart: prevReport?.bodyPart ?? '' })}
        onCancel={() => setPrevCopyOpen(false)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        {prevReport && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {prevSameModality ? (
                <Tag color="green">{t("reportWrite.sameModalityMatch")}</Tag>
              ) : (
                <Tag color="orange" title={t("reportWrite.noSameModalityReport")}>{t("reportWrite.latestFallback")}</Tag>
              )}
              <span className="text-slate-400">{t("reportWrite.examDateLabel")} {prevReport.examDate ?? prevReport.createdTime ?? prevReport.studyDate ?? '—'}</span>
            </div>
            <div className="flex items-center gap-4 p-2 border border-slate-200 rounded bg-slate-50">
              <Checkbox
                checked={prevPick.findings}
                onChange={(e) => setPrevPick((p) => ({ ...p, findings: e.target.checked }))}
              >
                {t("reportWrite.findings")}
              </Checkbox>
              <Checkbox
                checked={prevPick.impression}
                onChange={(e) => setPrevPick((p) => ({ ...p, impression: e.target.checked }))}
              >
                {t("reportWrite.impression")}
              </Checkbox>
              <span className="text-slate-400">{t("reportWrite.insertToSectionHint")}</span>
            </div>
            {prevPick.findings && (
              <div>
                <div className="font-semibold text-slate-700 mb-1">{t("reportWrite.findings")}</div>
                <div className="border border-slate-200 rounded p-2 bg-white whitespace-pre-wrap max-h-40 overflow-y-auto text-slate-700">
                  {prevReport.findings || t("reportWrite.none")}
                </div>
              </div>
            )}
            {prevPick.impression && (
              <div>
                <div className="font-semibold text-slate-700 mb-1">{t("reportWrite.impression")}</div>
                <div className="border border-slate-200 rounded p-2 bg-white whitespace-pre-wrap max-h-40 overflow-y-auto text-slate-700">
                  {prevReport.impression ?? prevReport.conclusion ?? prevReport.diagnosis ?? t("reportWrite.none")}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setPrevCopyOpen(false)}>{t("reportWrite.cancel")}</Button>
              <Button type="primary" icon={<Copy className="w-3.5 h-3.5" />} onClick={applyPreviousCopy}>
                {t("reportWrite.insertFindingsImpression")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ShortcutHelpModal open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} shortcuts={globalShortcuts} />
    </Layout>
  );
}

/* ---------- [v3.0.6.11-61] 环境式 AI 报告草稿: 输入弹窗 + 确认面板 ---------- */

const AI_STYLE_OPTIONS = [
  { value: 'concise', label: t("reportWrite.concise"), desc: t("reportWrite.conciseHint") },
  { value: 'standard', label: t("reportWrite.standard"), desc: t("reportWrite.standardHint") },
  { value: 'detailed', label: t("reportWrite.detailed"), desc: t("reportWrite.detailedHint") },
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
      title={<Space><Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} /><span>{t("reportWrite.aiGenerateDraft")}</span><Tag color="purple">{modality} - {bodyPart}</Tag></Space>}
      open={open}
      onCancel={onCancel}
      width={560}
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>{t("reportWrite.cancel")}</Button>
          <Button type="primary" icon={<Sparkles className="w-3 h-3" />} onClick={onGenerate} loading={loading} disabled={loading}>
            {t("reportWrite.generateDraft")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pt-2">
        <Alert type="info" showIcon message={t("reportWrite.aiDisclaimer")} className="mb-2" />
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">{t("reportWrite.clinicalInfo")}</div>
          <Input.TextArea
            value={clinical}
            onChange={(e) => onClinical(e.target.value)}
            placeholder={t("reportWrite.clinicalInfoRequired")}
            rows={3}
          />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">{t("reportWrite.findingKeywords2")}</div>
          <Input
            value={findings}
            onChange={(e) => onFindings(e.target.value)}
            placeholder={t("reportWrite.keywordsExample2")}
          />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">{t("reportWrite.detailLevel")}</div>
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
            <span>{t("reportWrite.generatingBy")} {modality}-{bodyPart} {t("reportWrite.generatingFromTemplate")}</span>
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
      {chunks.length === 0 && <span className="text-slate-400">{t("reportWrite.contentIdentical")}</span>}
      <span className="hidden">{text}</span>
    </div>
  );
  return (
    <Modal
      title={<Space><Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} /><span>{t("reportWrite.aiDraftConfirm")}</span><Tag color="purple">{draft.style}</Tag><Tag color="blue">{t("reportWrite.confidence")} {(draft.confidence * 100).toFixed(0)}%</Tag></Space>}
      open
      onCancel={onDiscard}
      width={900}
      destroyOnHidden
      footer={
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">{t("reportWrite.model")} {draft.modelVersion} {t("reportWrite.generatedAt")} {new Date(draft.createdAt).toLocaleString()}</span>
          <div className="flex gap-2">
            <Button onClick={onDiscard} disabled={actionLoading}>{t("reportWrite.discard")}</Button>
            {!editMode ? (
              <Button icon={<Edit3 className="w-3 h-3" />} onClick={() => onEditMode(true)} disabled={actionLoading}>{t("reportWrite.modify")}</Button>
            ) : (
              <Button icon={<CheckCircle2 className="w-3 h-3" />} onClick={onModifySave} loading={actionLoading}>{t("reportWrite.saveChanges")}</Button>
            )}
            <Button type="primary" icon={<CheckCircle2 className="w-3 h-3" />} onClick={onAccept} loading={actionLoading} disabled={actionLoading}>
              {t("reportWrite.acceptApply")}
            </Button>
          </div>
        </div>
      }
    >
      <Alert type="warning" showIcon message={t("reportWrite.aiDraftNote")} className="mb-3" />
      {editMode ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600">{t("reportWrite.editDraftHint")}</div>
          <Input.TextArea value={editText} onChange={(e) => onEditText(e.target.value)} rows={12} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-2">{t("reportWrite.currentEditorContent2")}</h4>
            {renderDiffPane(false, currentText)}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-2">{t("reportWrite.aiDraftContent")}</h4>
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
      title={<Space><History className="w-4 h-4" /><span>{t("reportWrite.versionCompare")} {label}</span></Space>}
      open
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">{t("reportWrite.oldVersion")}</h4>
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
          <h4 className="text-xs font-semibold text-slate-500 mb-2">{t("reportWrite.newVersion")}</h4>
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
function PhraseLibraryModal({ open, phrases, loading, dataSource = 'api', favIds = [], onClose, onPick, onToggleFav }: {
  open: boolean;
  phrases: any[];
  loading: boolean;
  /** [v3.0.6.11-96 Wave 2B (E)] 数据源: api=templatesApi.listSnippets 真实 / fallback=演示回退 */
  dataSource?: 'api' | 'fallback';
  /** [v3.0.6.11-103 Wave 12] 收藏短语 id 列表 (localStorage) */
  favIds?: string[];
  onClose: () => void;
  onPick: (phrase: any) => void;
  /** [v3.0.6.11-103 Wave 12] 收藏切换 (回写 localStorage) */
  onToggleFav?: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  // [v3.0.6.11-103 Wave 12] 收藏夹: 只看收藏筛选
  const [favOnly, setFavOnly] = useState(false);
  const favSet = useMemo(() => new Set(favIds), [favIds]);
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = phrases;
    if (favOnly) list = list.filter((p) => favSet.has(String(p?.id ?? p?.name ?? '')));
    if (!kw) return list;
    return list.filter((p) => {
      const text = String(p?.content || p?.text || '');
      return text.toLowerCase().includes(kw) || String(p?.category ?? '').toLowerCase().includes(kw) || String(p?.subCategory ?? '').toLowerCase().includes(kw);
    });
  }, [phrases, q, favOnly, favSet]);

  return (
    <Modal
      title={<Space><BookMarked className="w-4 h-4" style={{ color: 'var(--color-info-600)' }} /><span>{t("reportWrite.phraseLibrary")}</span><Tag color="cyan">{filtered.length} {t("reportWrite.recordUnit")}</Tag>{favIds.length > 0 && <Tag color="amber" className="m-0 text-[10px]">{t("reportWrite.favorite")} {favIds.length}</Tag>}{dataSource === 'fallback' && <Tag color="orange" title={t("reportWrite.snippetsFallback")}>{t("reportWrite.demoFallback")}</Tag>}</Space>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnHidden
    >
      <div className="pt-2 space-y-3">
        <div className="flex items-center gap-2">
          <Input
            allowClear
            placeholder={t("reportWrite.searchPhrasePlaceholder")}
            prefix={<BookMarked className="w-3 h-3 text-slate-400" />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {/* [v3.0.6.11-103 Wave 12] 收藏夹: 只看收藏 */}
          <Checkbox checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="shrink-0 whitespace-nowrap text-xs">
            {t('w12.write.favPhrasesOnly')}
          </Checkbox>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)' }}><Spin /> {t("reportWrite.phraseLoading2")}</div>
        ) : filtered.length === 0 ? (
          <EmptyState type="noresult" description={favOnly ? t('w12.write.favoritesEmpty') : t("reportWrite.noMatchingPhrase")} style={{ padding: '16px 8px' }} />
        ) : (
          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {filtered.map((p: any, i: number) => {
              const pid = String(p?.id ?? p?.name ?? `p-${i}`);
              const isFav = favSet.has(pid);
              return (
              <div
                key={p?.id ?? i}
                role="button"
                tabIndex={0}
                className="p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50 hover:border-sky-300 transition-colors"
                onClick={() => onPick(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(p) } }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-800 leading-relaxed">{p?.content ?? p?.text}</div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <Tag className="m-0 text-[10px]">{p?.category ?? t("reportWrite.general")}</Tag>
                      {p?.subCategory && <Tag color="blue" className="m-0 text-[10px]">{p.subCategory}</Tag>}
                      {Array.isArray(p?.modality) && p.modality.length > 0 && <Tag color="cyan" className="m-0 text-[10px]">{p.modality.join('/')}</Tag>}
                      {/* [v3.0.6.11-98 Wave1B P0-2] 变量说明 tooltip: 含 {{占位符}} 时提示支持的变量 */}
                      {(() => {
                        const vars = collectTemplateVariables(p?.content ?? p?.text ?? '');
                        return vars.length > 0
                          ? (
                            <Tooltip title={variablesTooltipTitle(vars)}>
                              <Tag color="purple" className="m-0 text-[10px] cursor-help">{t("reportWrite.variableCount")}{vars.length}</Tag>
                            </Tooltip>
                          )
                          : null;
                      })()}
                      {p?.usageCount != null && <span className="text-[10px] text-slate-400">{t("reportWrite.use")} {p.usageCount} {t("reportWrite.timesUnit")}</span>}
                    </div>
                  </div>
                  {/* [v3.0.6.11-103 Wave 12] 短语收藏星标 */}
                  <Button size="small" type="text" className="p-0 h-auto w-5 shrink-0"
                    icon={<Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />}
                    onClick={(e) => { e.stopPropagation(); onToggleFav?.(pid); }}
                    title={isFav ? t("reportWrite.unfavoritePhrase") : t("reportWrite.favoritePhrase")}
                    data-testid={`phrase-fav-${pid}`}
                  />
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- [v3.0.6.11-95 Wave3B P1] 模板库: 分类浏览 + 全文模板/短语分区 + 最近使用/收藏 ---------- */
/* [v3.0.6.11-98 Wave2A P1] 推荐模板 (按当前检查模态/部位自动匹配) + 我的模板筛选 (个人模板库) */
function TemplateLibraryModal({ open, templates, phrases, loading, favIds, recentIds, phraseSource = 'api', realCategories = [], examModality = '', examBodyPart = '', currentUserId = '', favSource = 'api', onClose, onInsert, onReplace, onToggleFav, onPickPhrase, onApplyBackend }: {
  open: boolean;
  templates: any[];
  phrases: any[];
  loading: boolean;
  favIds: string[];
  recentIds: string[];
  /** [v3.0.6.11-96 Wave 2B (E)] 短语数据源: api=templatesApi.listSnippets / fallback=演示回退 */
  phraseSource?: 'api' | 'fallback';
  /** [v3.0.6.11-96 Wave3B P1] 真实分类 (/templates/categories), 与模板数据派生分类合并 */
  realCategories?: string[];
  /** [v3.0.6.11-98 Wave2A P1] 当前报告检查上下文 (模板自动匹配推荐) */
  examModality?: string;
  examBodyPart?: string;
  /** [v3.0.6.11-98 Wave2A P1] 当前登录用户 id (我的模板筛选/个人模板 Tag) */
  currentUserId?: string;
  /** [v3.0.6.11-98 Wave2B (报告 P1)] 收藏数据源: api=服务端同步 / fallback=localStorage */
  favSource?: 'api' | 'fallback';
  onClose: () => void;
  onInsert: (t: any) => void;
  onReplace: (id: string) => void;
  onToggleFav: (id: string) => void;
  onPickPhrase: (p: any) => void;
  /** [v3.0.6.11-103 Wave 2A] 后端应用模板: POST /reports/:id/templates-apply (append/overwrite) */
  onApplyBackend?: (templateId: string, mode: 'append' | 'overwrite') => void;
}) {
  const [catTab, setCatTab] = useState<string>('全部');
  const [q, setQ] = useState('');
  // [v3.0.6.11-98 Wave2A P1] 我的模板筛选: 全部 / 仅我创建
  const [scopeTab, setScopeTab] = useState<'all' | 'mine'>('all');
  // [v3.0.6.11-100 Wave2C P2] 模板类型 Tab: 全部 / 全文模板(FULL) / 段落模板(SECTION) / 短语模板(PHRASE)
  const [typeTab, setTypeTab] = useState<'all' | 'FULL' | 'SECTION' | 'PHRASE'>('all');
  // [v3.0.6.11-100 Wave2C P2] 全文模板插入方式: 追加(光标处) / 覆盖(替换全文)
  const [insertMode, setInsertMode] = useState<'append' | 'replace'>('append');

  // [v3.0.6.11-96 Wave3B P1] 分类 Tab: 真实 /templates/categories 优先, 与模板数据派生分类合并 (去重)
  const categories = useMemo(() => {
    const set = new Set<string>([t("reportWrite.all")]);
    realCategories.forEach((c) => { if (c) set.add(c); });
    templates.forEach((t: any) => { if (t?.category) set.add(String(t.category)); });
    return Array.from(set);
  }, [templates, realCategories]);

  const favIdsSet = useMemo(() => new Set(favIds), [favIds]);
  const recentIdsSet = useMemo(() => new Set(recentIds), [recentIds]);

  // [v3.0.6.11-98 Wave2A P1] 模板自动匹配推荐: 按当前检查模态/部位匹配, 双匹配 > 单匹配
  const recCtx = useMemo(() => {
    const mod = String(examModality ?? '').trim().toUpperCase();
    const bp = String(examBodyPart ?? '').trim();
    return { mod, bp, has: mod.length > 0 || bp.length > 0 };
  }, [examModality, examBodyPart]);

  const recMatchLevel = useCallback((t: any): number => {
    if (!recCtx.has) return -1;
    const tMod = String(t?.modality ?? t?.category ?? '').trim().toUpperCase();
    const tBp = String(t?.bodyPart ?? '').trim();
    const m = recCtx.mod && tMod && (tMod === recCtx.mod || tMod.includes(recCtx.mod) || recCtx.mod.includes(tMod));
    const b = recCtx.bp && tBp && (tBp === recCtx.bp || tBp.includes(recCtx.bp) || recCtx.bp.includes(tBp));
    if (m && b) return 0;
    if (m) return 1;
    if (b) return 2;
    return -1;
  }, [recCtx]);

  const recommended = useMemo(() => {
    const matched = templates.filter((t: any) => recMatchLevel(t) >= 0);
    return matched.sort((a: any, b: any) => recMatchLevel(a) - recMatchLevel(b) || String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'zh-CN')).slice(0, 6);
  }, [templates, recMatchLevel]);

  // [v3.0.6.11-98 Wave2A P1] 我的模板: 个人模板 Tag/分区 (createdById === 当前用户)
  const isMine = useCallback((t: any) => !!currentUserId && String(t?.createdById ?? '') === currentUserId, [currentUserId]);

  const filteredTemplates = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = templates;
    // [v3.0.6.11-100 Wave2C P2] 模板类型过滤 (FULL/SECTION/PHRASE, 旧数据无字段按 SECTION 处理)
    if (typeTab !== 'all') list = list.filter((t: any) => (t?.templateType ?? 'SECTION') === typeTab);
    if (catTab !== '全部') list = list.filter((t: any) => String(t?.category ?? '') === catTab);
    if (scopeTab === 'mine') list = list.filter((t: any) => isMine(t));
    if (kw) list = list.filter((t: any) => String(t?.name ?? '').toLowerCase().includes(kw) || String(t?.body ?? '').toLowerCase().includes(kw));
    // 排序: 收藏 > 最近使用 > 其余 (常用模板置顶)
    const rank = (t: any) => {
      if (favIdsSet.has(t.id)) return 0;
      if (recentIdsSet.has(t.id)) return 1;
      return 2;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'zh-CN'));
  }, [templates, catTab, typeTab, q, scopeTab, isMine, favIdsSet, recentIdsSet]);

  // [v3.0.6.11-100 Wave2C P2] 全文模板 (FULL) 独立计数: 分类 Tab 中区别于段落模板展示
  const fullTemplates = useMemo(() => templates.filter((t: any) => (t?.templateType ?? 'SECTION') === 'FULL'), [templates]);

  const filteredPhrases = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return phrases;
    return phrases.filter((p) =>
      String(p?.content || p?.text || '').toLowerCase().includes(kw) ||
      String(p?.category ?? '').toLowerCase().includes(kw));
  }, [phrases, q]);

  const phraseGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredPhrases.forEach((p) => {
      const key = p?.category || t("reportWrite.general");
      (groups[key] = groups[key] ?? []).push(p);
    });
    return groups;
  }, [filteredPhrases]);

  return (
    <Modal
      title={<Space><BookMarked className="w-4 h-4" style={{ color: 'var(--color-info-600)' }} /><span>{t("reportWrite.templateLibrary")}</span><Tag color="cyan">{filteredTemplates.length} {t("reportWrite.templateDot")} {filteredPhrases.length} 短语</Tag>{phraseSource === 'fallback' && <Tag color="orange" title={t("reportWrite.snippetsPhraseFallback")}>{t("reportWrite.demoFallback")}</Tag>}{favSource === 'api' ? <Tag color="green" title={t("reportWrite.favoriteServerNote2")}>{t("reportWrite.serverFavorite")}</Tag> : <Tag color="orange" title={t("reportWrite.favoriteFallbackNote")}>{t("reportWrite.localFavoriteFallback")}</Tag>}</Space>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnHidden
    >
      <div className="pt-2 space-y-3">
        <Input
          allowClear
          prefix={<SearchX className="w-3 h-3 text-slate-400" />}
          placeholder={t("reportWrite.searchTemplatePlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6, 24px)' }}><Spin /> {t("reportWrite.templateLoading2")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3" style={{ minHeight: 380, maxHeight: 560, overflow: 'hidden' }}>
            {/* 左: 全文模板 (分类 Tab + 最近使用/收藏置顶) */}
            <div className="flex flex-col gap-2" style={{ maxHeight: 560, minHeight: 380 }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1"><FileText className="w-3 h-3" />{t("reportWrite.fullTextTemplates")}{fullTemplates.length > 0 && <Tag color="purple" className="m-0 text-[10px]">{t("reportWrite.fullTextCount")}{fullTemplates.length}</Tag>}</span>
                <div className="flex items-center gap-2">
                  {/* [v3.0.6.11-100 Wave2C P2] 全文模板插入方式: 追加(光标处) / 覆盖(替换全文) */}
                  <div className="flex rounded border border-slate-200 overflow-hidden" title={t("reportWrite.fullTextInsertMode")}>
                    <button type="button"
                      className={`px-2 py-0.5 text-[11px] font-semibold cursor-pointer border-0 ${insertMode === 'append' ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      onClick={() => setInsertMode('append')}>{t("reportWrite.append")}</button>
                    <button type="button"
                      className={`px-2 py-0.5 text-[11px] font-semibold cursor-pointer border-0 border-l border-slate-200 ${insertMode === 'replace' ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      onClick={() => setInsertMode('replace')}>{t("reportWrite.overwrite")}</button>
                  </div>
                  {/* [v3.0.6.11-98 Wave2A P1] 我的模板筛选 (医生个人模板库) */}
                  <div className="flex rounded border border-slate-200 overflow-hidden">
                    <button type="button"
                      className={`px-2 py-0.5 text-[11px] font-semibold cursor-pointer border-0 ${scopeTab === 'all' ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      onClick={() => setScopeTab('all')}>{t("reportWrite.all")}</button>
                    <button type="button"
                      className={`px-2 py-0.5 text-[11px] font-semibold cursor-pointer border-0 border-l border-slate-200 ${scopeTab === 'mine' ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      onClick={() => setScopeTab('mine')}>{t("reportWrite.myTemplates")}</button>
                  </div>
                  <Tag color="blue" className="text-[10px] m-0">{typeTab === 'FULL' ? (insertMode === 'replace' ? t("reportWrite.clickToOverwrite") : t("reportWrite.clickToAppend")) : t("reportWrite.clickToInsert")}</Tag>
                </div>
              </div>
              {/* [v3.0.6.11-100 Wave2C P2] 模板类型 Tab: 全部 / 全文模板 / 段落模板 / 短语模板 */}
              <div className="flex gap-1 flex-wrap items-center">
                {([['all', t("reportWrite.all")], ['FULL', t("reportWrite.fullTextTemplates")], ['SECTION', t("reportWrite.sectionTemplates")], ['PHRASE', t("reportWrite.phraseTemplates")]] as const).map(([key, label]) => (
                  <Button key={key} size="small" type={typeTab === key ? 'primary' : 'default'} className="text-[11px]" onClick={() => setTypeTab(key)}>{label}</Button>
                ))}
              </div>
              {/* [v3.0.6.11-98 Wave2A P1] 推荐模板: 按当前检查 模态/部位 自动匹配 (双匹配 > 单匹配) */}
              <div className="rounded border border-purple-200 bg-purple-50/60 p-2 space-y-1">
                <div className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t("reportWrite.recommendedTemplates")}
                  {recCtx.has && (
                    <span className="font-normal text-purple-400">（{recCtx.mod || '—'}{recCtx.mod && recCtx.bp ? ' / ' : ''}{recCtx.bp || '—'}）</span>
                  )}
                </div>
                {recommended.length === 0 ? (
                  <div className="text-[11px] text-slate-400">{t("reportWrite.noRecommendations")}</div>
                ) : (
                  <div className="space-y-1">
                    {recommended.map((tpl: any) => (
                      <div key={`rec-${tpl.id}`} role="button" tabIndex={0} className="p-1.5 border border-purple-200 bg-white rounded text-xs cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center gap-1.5"
                        onClick={() => onInsert(tpl)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInsert(tpl) } }}>
                        <Tag color="purple" className="m-0 text-[10px] shrink-0">{t("reportWrite.tagRecommended")}</Tag>
                        <span className="text-slate-700 truncate flex-1">{tpl.name}</span>
                        <Tag color={recMatchLevel(tpl) === 0 ? 'volcano' : 'cyan'} className="m-0 text-[10px] shrink-0">{recMatchLevel(tpl) === 0 ? t("reportWrite.matchExact") : recMatchLevel(tpl) === 1 ? t("reportWrite.matchModality") : t("reportWrite.matchBodyPart")}</Tag>
                        <Button size="small" type="text" className="p-0 h-auto text-[10px] shrink-0" onClick={(e) => { e.stopPropagation(); onReplace(tpl.id); }}>{t("reportWrite.replace")}</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {categories.map((c) => (
                  <Button key={c} size="small" type={catTab === c ? 'primary' : 'default'} className="text-[11px]" onClick={() => setCatTab(c)}>{c}</Button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredTemplates.length === 0 ? (
                  <EmptyState type="noresult" description={t("reportWrite.noMatchingTemplate")} style={{ padding: '16px 8px' }} />
                ) : filteredTemplates.map((tpl: any) => {
                  const isFav = favIdsSet.has(tpl.id);
                  const isRecent = recentIdsSet.has(tpl.id);
                  return (
                    <div key={tpl.id} role="button" tabIndex={0} className="group p-2 border border-slate-200 rounded text-xs cursor-pointer hover:border-sky-300 hover:bg-sky-50/40 transition-colors"
                      onClick={() => {
                        // [v3.0.6.11-100 Wave2C P2] 全文模板: 按插入方式 (追加光标处 / 覆盖全文); 其余点击插入光标处
                        if ((tpl?.templateType ?? 'SECTION') === 'FULL' && insertMode === 'replace') onReplace(tpl.id);
                        else onInsert(tpl);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if ((tpl?.templateType ?? 'SECTION') === 'FULL' && insertMode === 'replace') onReplace(tpl.id);
                          else onInsert(tpl);
                        }
                      }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 truncate flex items-center gap-1">
                          {isFav && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                          {isRecent && !isFav && <Tag color="green" className="m-0 text-[10px]">{t("reportWrite.tagRecent")}</Tag>}
                          {/* [v3.0.6.11-98 Wave2A P1] 个人模板 Tag */}
                          {isMine(tpl) && <Tag color="cyan" className="m-0 text-[10px]">{t("reportWrite.tagMine")}</Tag>}
                          {/* [v3.0.6.11-100 Wave2C P2] 全文模板 Tag (区别于段落模板) */}
                          {(tpl?.templateType ?? 'SECTION') === 'FULL' && <Tag color="purple" className="m-0 text-[10px]">{t("reportWrite.tagFull")}</Tag>}
                          {(tpl?.templateType ?? 'SECTION') === 'PHRASE' && <Tag color="magenta" className="m-0 text-[10px]">{t("reportWrite.tagPhrase")}</Tag>}
                          {tpl.name}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Button size="small" type="text" className="p-0 h-auto w-5" icon={<Star className={`w-3 h-3 ${isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />}
                            onClick={(e) => { e.stopPropagation(); onToggleFav(tpl.id); }} title={isFav ? t("reportWrite.unfav") : t("reportWrite.fav")} />
                          <Button size="small" type="text" className="p-0 h-auto text-[10px]" onClick={(e) => { e.stopPropagation(); onReplace(tpl.id); }} title={t("reportWrite.replaceAllTitle")}>{t("reportWrite.replace")}</Button>
                          {/* [v3.0.6.11-103 Wave 2A] 后端应用模板: POST /reports/:id/templates-apply (合并到报告字段) */}
                          {onApplyBackend && (
                            <Button size="small" type="text" className="p-0 h-auto text-[10px] text-purple-600" onClick={(e) => { e.stopPropagation(); onApplyBackend(tpl.id, (tpl?.templateType ?? 'SECTION') === 'FULL' && insertMode === 'replace' ? 'overwrite' : 'append'); }} title={t("reportWrite.applyBackendTitle")}>{t("reportWrite.applyBackend")}</Button>
                          )}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 truncate">{String(tpl.body ?? '').slice(0, 60) || t("reportWrite.structuredTemplate")}</div>
                      {/* [v3.0.6.11-98 Wave1B P0-2] 变量说明 tooltip */}
                      {(() => {
                        const vars = collectTemplateVariables(tpl?.body ?? tpl?.content ?? '');
                        return vars.length > 0
                          ? (
                            <Tooltip title={variablesTooltipTitle(vars)}>
                              <Tag color="purple" className="m-0 text-[10px] cursor-help mt-1">{t("reportWrite.varsBadge", { count: vars.length })}</Tag>
                            </Tooltip>
                          )
                          : null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 右: 短语库 (按分类分组) */}
            <div className="flex flex-col gap-2" style={{ maxHeight: 560, minHeight: 380 }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1"><BookMarked className="w-3 h-3" />{t("reportWrite.phraseLibrary")}</span>
                <Button size="small" type="link" className="text-[11px] p-0 h-auto" onClick={() => onClose()}>{t("reportWrite.backToWriting")}</Button>
              </div>
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {Object.keys(phraseGroups).length === 0 ? (
                  <EmptyState type="noresult" description={t("reportWrite.noMatchingPhrase")} style={{ padding: '16px 8px' }} />
                ) : Object.entries(phraseGroups).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">{cat} ({items.length})</div>
                    <div className="space-y-1">
                      {items.map((p: any, i: number) => (
                        <div key={p?.id ?? i} role="button" tabIndex={0} className="p-1.5 border border-slate-200 rounded text-xs cursor-pointer hover:bg-slate-50 hover:border-sky-300 transition-colors" onClick={() => onPickPhrase(p)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickPhrase(p) } }}>
                          <div className="text-slate-700 line-clamp-2">{p?.content ?? p?.text}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <Tag className="m-0 text-[10px]">{p?.category ?? t("reportWrite.general")}</Tag>
                            {Array.isArray(p?.modality) && p.modality.length > 0 && <Tag color="cyan" className="m-0 text-[10px]">{p.modality.join('/')}</Tag>}
                            {(() => {
                              const vars = collectTemplateVariables(p?.content ?? p?.text ?? '');
                              return vars.length > 0
                                ? (
                                  <Tooltip title={variablesTooltipTitle(vars)}>
                                    <Tag color="purple" className="m-0 text-[10px] cursor-help">{t("reportWrite.variableCount")}{vars.length}</Tag>
                                  </Tooltip>
                                )
                                : null;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

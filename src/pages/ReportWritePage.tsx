/**
 * G005 放射RIS系统 v3.0.6.8-19 — 报告书写 V3（优化版）
 * 优化: 懒加载 sider tab / 精简工具条 / 自动保存模拟 / 响应式
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Layout, Card, Space, Button, Tag, Tooltip, Tabs, Divider,
  Alert, message, Modal, Progress, Empty, Badge,
} from 'antd';
import {
  Save, Send, FileText, Mic, Image as ImageIcon, Type,
  Brain, History, Eye, ChevronLeft, ChevronRight, Sparkles,
  Tag as TagIcon, BarChart3, StickyNote, RefreshCw, AlertCircle,
  ListChecks, FileCheck, CheckCircle2, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  REPORT_WRITING_CONTEXT_MOCK, REPORT_DRAFTS_MOCK, KEYWORD_HIGHLIGHTS_MOCK, PRE_SUBMIT_SCORE_MOCK,
} from '@data/reportWritingMock';
import { detectConflicts } from '@services/keywordConflictDetector';
import { computeDiff, type DiffChunk } from '@services/reportDiffEngine';
import { StructuredFieldForm } from '@components/report/v3/R3.WRITING/StructuredFieldForm';
import { ReportRichEditor } from '@components/report/v3/R3.WRITING/ReportRichEditor';
import { AIDraftPanel } from '@components/report/v3/R3.WRITING/AIDraftPanel';
import { VoiceDictation } from '@components/report/v3/R3.WRITING/VoiceDictation';
import { ImageAnchorComponent } from '@components/report/v3/R3.WRITING/ImageAnchor';

const { Sider, Content } = Layout;

/* ---------- 右侧各 Tab 内容（懒加载） ---------- */
function AITab({ reportId, modality, bodyPart }: { reportId: string; modality: string; bodyPart: string }) {
  return (
    <AIDraftPanel
      reportId={reportId}
      modality={modality}
      bodyPart={bodyPart}
      clinicalInfo="女性 58 岁,体检发现右肺上叶结节 1 周,无明显症状。"
      onAccept={() => message.success('已应用 AI 草稿到编辑器')}
    />
  );
}

function VoiceTab({ reportId }: { reportId: string }) {
  return <VoiceDictation reportId={reportId} />;
}

function HistoryTab({ priorReports, currentText, onCompare }: { priorReports: any[]; currentText: string; onCompare: (oldText: string, label: string) => void }) {
  if (priorReports.length === 0) return <Empty description="无历史报告" />;
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

function SimilarTab({ similarCases }: { similarCases: any[] }) {
  if (similarCases.length === 0) return <Empty description="无相似病例" />;
  return (
    <div className="space-y-2">
      {similarCases.map((c: any) => (
        <div key={c.id} className="p-2 border border-slate-200 rounded text-xs">
          <div className="flex items-center justify-between">
            <Tag color="purple">{c.reportId}</Tag>
            <Tag color="blue">{typeof c.similarityScore === 'number' ? (c.similarityScore * 100).toFixed(0) : '--'}%</Tag>
          </div>
          <div className="text-slate-700 mt-1 line-clamp-2">{c.impression}</div>
        </div>
      ))}
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
.v3-root { min-height: 100vh; background: #f8fafc; }
.v3-root .ant-layout-sider { background: #fff !important; }
.v3-topbar { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 8px 16px; flex-wrap: wrap; gap: 8px; }
.v3-topbar-left, .v3-topbar-right { display: flex; align-items: center; gap: 8px; }
.v3-topbar-title { font-weight: 600; white-space: nowrap; }
.v3-topbar-stats { font-size: 12px; color: #64748b; white-space: nowrap; }
.v3-topbar-autosave { font-size: 11px; color: #22c55e; white-space: nowrap; }
.v3-content { padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: calc(100vh - 53px); background: #f8fafc; }
.v3-content .v3-card { box-shadow: 0 1px 2px rgba(0,0,0,0.04); border-radius: 8px; }
.v3-clinical-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 12px; }
.v3-clinical-item { padding: 6px; background: #f8fafc; border-radius: 4px; }
.v3-clinical-label { color: #64748b; font-size: 10px; }
.v3-clinical-code { font-family: monospace; color: #3b82f6; }
.v3-clinical-full { grid-column: 1 / -1; font-size: 12px; line-height: 1.6; background: #f8fafc; padding: 6px 8px; border-radius: 4px; }
.v3-sider { overflow-y: auto; max-height: calc(100vh - 53px); border-left: 1px solid #e2e8f0; }
.v3-sider .ant-tabs-nav { margin-bottom: 0 !important; padding-top: 4px; }
.v3-sider-body { padding: 8px; }
.v3-sider-body .ant-card { border: 1px solid #e2e8f0; box-shadow: none; border-radius: 6px; }
@media (max-width: 1024px) { .v3-topbar-hide-mobile { display: none; } .v3-sider { width: 300px !important; max-width: 300px !important; } }
@media (max-width: 768px) { .v3-sider { display: none; } .v3-topbar-stats { display: none; } }
`;

export default function ReportWritePage() {
  const navigate = useNavigate();
  const [reportId] = useState('rpt-038');
  const [context, setContext] = useState(REPORT_WRITING_CONTEXT_MOCK);
  const [preScore] = useState(PRE_SUBMIT_SCORE_MOCK);
  const [drafts] = useState(REPORT_DRAFTS_MOCK);
  const [showSubmit, setShowSubmit] = useState(false);
  const [siderVisible, setSiderVisible] = useState(true);
  const [activeToolsTab, setActiveToolsTab] = useState('ai');
  const [submitting, setSubmitting] = useState(false);
  const [autoSaveTip, setAutoSaveTip] = useState('已保存');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [diffTarget, setDiffTarget] = useState<{ oldText: string; label: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toLocaleTimeString();
      setAutoSaveTip(`已保存 ${now}`);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    const r = await import('@services/writing/writingService').then((m) =>
      m.submitReport(reportId, {
        finalScore: preScore.score,
        structured: context.fields,
        html: context.document.html,
      })
    );
    setSubmitting(false);
    if (r.success) {
      message.success('报告已提交审核');
      setShowSubmit(false);
      setTimeout(() => navigate('/report-review'), 1500);
    }
  }, [reportId, preScore, context, navigate]);

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
      case 'ai': return <AITab reportId={reportId} modality={context.modality} bodyPart={context.bodyPart} />;
      case 'voice': return <VoiceTab reportId={reportId} />;
      case 'history': return <HistoryTab priorReports={context.priorReports} currentText={context.document.plainText} onCompare={(oldText, label) => setDiffTarget({ oldText, label })} />;
      case 'similar': return <SimilarTab similarCases={context.similarCases} />;
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
      <div className="v3-topbar">
        <div className="v3-topbar-left">
          <Button type="text" icon={<ChevronLeft className="w-4 h-4" />} onClick={() => navigate(-1)} />
          <span className="v3-topbar-title">报告书写</span>
          <Tag color="blue">{context.reportId}</Tag>
          <Tag color="purple">{context.modality} - {context.bodyPart}</Tag>
          <Tag color={preScore.passed ? 'success' : 'warning'}>
            {preScore.passed ? '可提交' : '需完善'}
          </Tag>
          <Tag color="cyan" className="v3-topbar-hide-mobile">{context.template?.name || 'RECIST 1.1'}</Tag>
        </div>
        <div className="v3-topbar-right">
          <Tooltip title="保存草稿"><Button icon={<Save className="w-4 h-4" />}>保存</Button></Tooltip>
          <span className="v3-topbar-stats v3-topbar-hide-mobile">
            {context.document.wordCount} 字 / {Math.round(context.document.writingDurationSec / 60)} 分
          </span>
          <span className="v3-topbar-autosave">{autoSaveTip}</span>
          <Button type="primary" icon={<Send className="w-4 h-4" />} onClick={() => {
            const found = detectConflicts(context.document.plainText);
            setConflicts(found);
            setShowSubmit(true);
          }}>
            提交审核
          </Button>
          <Tooltip title={siderVisible ? '收起侧栏' : '展开侧栏'}>
            <Button type="text" icon={siderVisible ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />} onClick={() => setSiderVisible((v) => !v)} />
          </Tooltip>
        </div>
      </div>

      <Layout>
        {/* 主内容区 */}
        <Content className="v3-content">
          <Card size="small" className="v3-card" title={<Space><StickyNote className="w-4 h-4" /><span>临床信息</span></Space>}>
            <div className="v3-clinical-grid">
              <div className="v3-clinical-item"><div className="v3-clinical-label">患者</div><div className="font-semibold">张三</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">性别 / 年龄</div><div>男 / 58 岁</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">检查号</div><div className="v3-clinical-code">{context.patientId}</div></div>
              <div className="v3-clinical-item"><div className="v3-clinical-label">临床诊断</div><div>右肺占位性病变</div></div>
              <div className="v3-clinical-full">
                <b>主诉:</b>体检发现右肺结节 1 周<br />
                <b>现病史:</b>患者 1 周前体检发现右肺上叶结节<br />
                <b>既往史:</b>无肿瘤病史
              </div>
            </div>
          </Card>

          <Card size="small" className="v3-card" title={<Space><FileText className="w-4 h-4 text-blue-500" /><span>结构化字段</span><Tag color="blue">RECIST 1.1</Tag></Space>}>
            <StructuredFieldForm
              reportId={reportId}
              initialTemplateId="recist"
              initialValues={context.fields}
              onChange={(values) => setContext((c) => ({ ...c, fields: values }))}
            />
          </Card>

          <Card size="small" className="v3-card" title={<Space><Type className="w-4 h-4 text-cyan-500" /><span>所见 / 诊断 / 建议</span></Space>}>
            <ReportRichEditor
              reportId={reportId}
              initialHtml={context.document.html}
              initialPlainText={context.document.plainText}
              onChange={(doc) => setContext((c) => ({ ...c, document: doc }))}
            />
          </Card>

          <Card size="small" className="v3-card" title={<Space><ImageIcon className="w-4 h-4 text-purple-500" /><span>关键图像与影像锚定</span><Tag color="purple">{context.anchors.length}</Tag></Space>}>
            <ImageAnchorComponent reportId={reportId} />
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
        destroyOnClose
      >
        {conflicts.length > 0 && (
          <Alert
            type="error"
            showIcon
            className="mb-3"
            message={
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
          message={preScore.passed ? '所有检查项已通过,可以提交' : `部分检查项未通过 (${PASSED_COUNT}/${preScore.checklist.length})`}
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
      {/* 版本对比 Modal */}
      {diffTarget && (
        <DiffViewModal
          oldText={diffTarget.oldText}
          newText={context.document.plainText}
          label={diffTarget.label}
          onClose={() => setDiffTarget(null)}
        />
      )}
    </Layout>
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
      destroyOnClose
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

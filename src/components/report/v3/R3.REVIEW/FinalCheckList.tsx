/**
 * G005 RIS v3.0.5.1 - R3.REVIEW FINAL CHECK 终核清单
 * 80 点 (15+ 检查项 / 临床一致性 / 终评 / 双驳回 / 笔记 / 工作量 / 既往 / 多签 / 急诊 / 工作流)
 */
import { finalCheckService } from '../../../../services/review/finalCheckService';
// [G005 Wave3A P2] PACS 急诊通道: 真实触发端点 + 配置/记录
import {
  emergencyChannelApi,
  type EmergencyChannelConfig,
  type EmergencyTriggerRecord,
} from '../../../../services/api/emergencyChannelApi';
import type { ReviewTask, ReviewFilter } from '../../../../types/R3/R3.REVIEW';
import type {
  FinalCheckList as FinalCheckListModel, FinalCheckStatus, FinalCheckCategory,
  ClinicalConsistencyCheck, FinalScoringResult, FinalScoringRubric, FinalReviewNote, FinalCheckWorkload,
  PriorReportComparison, FinalMultiSignatureRequest, EmergencyReviewRequest, FinalCheckWorkflowConfig,
  FinalRejectTarget, EmergencyChannel,
} from '../../../../types/R3/R3.REVIEW.FINAL';
import {
  Card, Tabs, Tag, Space, Button, Empty, Input, Select, Row, Col, Statistic, message,
  Modal, Progress, List, Descriptions, Timeline, Form, Switch, Alert, Divider, Avatar, Radio, Popconfirm,
} from 'antd';
import {
  ShieldCheck,
  Search,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Stethoscope,
  GitCompareArrows,
  PenLine,
  Award,
  Zap,
  Phone,
  Settings2,
  Activity,
  Bell,
  RotateCcw,
  ClipboardCheck,
  CircleSlash,
  Timer,
  BarChart3,
  MessageSquare,
  Pin,
  PinOff,
  ListChecks,
  Save,
  RefreshCw,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

const CATEGORY_META: Record<FinalCheckCategory, { color: string; label: string }> = {
  demographics: { color: 'blue', label: 'reportReview.final.cat.demographics' },
  'clinical-history': { color: 'cyan', label: 'reportReview.final.cat.clinicalHistory' },
  'image-quality': { color: 'geekblue', label: 'reportReview.final.cat.imageQuality' },
  'image-consistency': { color: 'purple', label: 'reportReview.final.cat.imageConsistency' },
  'findings-completeness': { color: 'magenta', label: 'reportReview.final.cat.findingsCompleteness' },
  'diagnosis-accuracy': { color: 'red', label: 'reportReview.final.cat.diagnosisAccuracy' },
  'critical-marking': { color: 'volcano', label: 'reportReview.final.cat.criticalMarking' },
  laterality: { color: 'orange', label: 'reportReview.final.cat.laterality' },
  'modality-consistency': { color: 'gold', label: 'reportReview.final.cat.modalityConsistency' },
  'icd-coding': { color: 'lime', label: 'reportReview.final.cat.icdCoding' },
  recommendation: { color: 'green', label: 'reportReview.final.cat.recommendation' },
  'prior-comparison': { color: 'blue', label: 'reportReview.final.cat.priorComparison' },
  signature: { color: 'purple', label: 'reportReview.final.cat.signature' },
  confidentiality: { color: 'magenta', label: 'reportReview.final.cat.confidentiality' },
  terminology: { color: 'cyan', label: 'reportReview.final.cat.terminology' },
  grammar: { color: 'default', label: 'reportReview.final.cat.grammar' },
  'quality-score': { color: 'red', label: 'reportReview.final.cat.qualityScore' },
  'audit-trail': { color: 'volcano', label: 'reportReview.final.cat.auditTrail' },
};

const STATUS_META: Record<FinalCheckStatus, { color: string; bg: string; label: string }> = {
  pending: { color: '#94a3b8', bg: 'var(--content-bg)', label: 'reportReview.final.status.pending' },
  passed: { color: '#10b981', bg: 'var(--color-success-bg)', label: 'reportReview.final.status.passed' },
  failed: { color: '#dc2626', bg: 'var(--color-error-bg)', label: 'reportReview.final.status.failed' },
  warning: { color: '#f59e0b', bg: 'var(--color-warning-bg)', label: 'reportReview.final.status.warning' },
  skipped: { color: '#64748b', bg: 'var(--content-bg)', label: 'reportReview.final.status.skipped' },
  'not-applicable': { color: '#94a3b8', bg: 'var(--content-bg)', label: 'reportReview.final.status.notApplicable' },
};

const SEVERITY_META: Record<string, { color: string; label: string; rank: number }> = {
  blocker: { color: '#dc2626', label: 'reportReview.severity.blocker', rank: 0 },
  critical: { color: '#dc2626', label: 'reportReview.severity.critical', rank: 1 },
  major: { color: '#f59e0b', label: 'reportReview.severity.major', rank: 2 },
  minor: { color: '#3b82f6', label: 'reportReview.severity.minor', rank: 3 },
  info: { color: '#64748b', label: 'reportReview.severity.info', rank: 4 },
};

const PRIORITY_META: Record<string, { color: string; label: string; rank: number }> = {
  stat: { color: 'red', label: 'reportReview.priority.stat', rank: 0 },
  critical: { color: 'volcano', label: 'reportReview.priority.critical', rank: 0 },
  urgent: { color: 'orange', label: 'reportReview.priority.urgent', rank: 1 },
  routine: { color: 'default', label: 'reportReview.priority.routine', rank: 2 },
};

const REJECT_TARGET_META: Record<FinalRejectTarget, { label: string; color: string; description: string }> = {
  initial: { label: 'reportReview.final.reject.initial', color: 'orange', description: 'reportReview.final.reject.initialDesc' },
  'direct-to-draft': { label: 'reportReview.final.reject.directToDraft', color: 'red', description: 'reportReview.final.reject.directToDraftDesc' },
  'previous-stage': { label: 'reportReview.final.reject.previousStage', color: 'gold', description: 'reportReview.final.reject.previousStageDesc' },
};

const CHANNEL_META: Record<EmergencyChannel, { label: string; color: string }> = {
  sms: { label: 'reportReview.final.channel.sms', color: 'blue' },
  phone: { label: 'reportReview.final.channel.phone', color: 'red' },
  'in-app': { label: 'reportReview.final.channel.inApp', color: 'cyan' },
  wechat: { label: 'reportReview.final.channel.wechat', color: 'green' },
  email: { label: 'reportReview.final.channel.email', color: 'gold' },
  pager: { label: 'reportReview.final.channel.pager', color: 'volcano' },
};

function timeAgo(iso?: string): string {
  if (!iso) return '-';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('reportReview.justNow');
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function fmtTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  onSelect?: (t: ReviewTask) => void;
  selectedId?: string | null;
  embeddedTaskId?: string;
}

export const FinalCheckList: React.FC<Props> = ({ onSelect, selectedId, embeddedTaskId }) => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [lists, setLists] = useState<FinalCheckListModel[]>([]);
  const [activeList, setActiveList] = useState<FinalCheckListModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>({ stage: 'final' });
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'checklist' | 'consistency' | 'scoring' | 'notes' | 'workload' | 'prior' | 'multisig' | 'emergency' | 'workflow'>('checklist');
  const [consistency, setConsistency] = useState<ClinicalConsistencyCheck | null>(null);
  const [scoring, setScoring] = useState<FinalScoringResult | null>(null);
  const [rubric, setRubric] = useState<FinalScoringRubric | null>(null);
  const [notes, setNotes] = useState<FinalReviewNote[]>([]);
  const [workload, setWorkload] = useState<FinalCheckWorkload[]>([]);
  const [prior, setPrior] = useState<PriorReportComparison | null>(null);
  const [multiSigs, setMultiSigs] = useState<FinalMultiSignatureRequest[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyReviewRequest[]>([]);
  // [G005 Wave3A P2] 急诊通道配置 + 触发记录 (真实端点)
  const [emConfig, setEmConfig] = useState<EmergencyChannelConfig | null>(null);
  const [emRecords, setEmRecords] = useState<EmergencyTriggerRecord[]>([]);
  const [emConfigSaving, setEmConfigSaving] = useState(false);
  const [emPatientFilter, setEmPatientFilter] = useState('');
  const [config, setConfig] = useState<FinalCheckWorkflowConfig | null>(null);
  const [rejectTarget, setRejectTarget] = useState<FinalRejectTarget>('initial');
  const [rejectReason, setRejectReason] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteForm] = Form.useForm();
  const [emOpen, setEmOpen] = useState(false);
  const [emForm] = Form.useForm();
  const [msOpen, setMsOpen] = useState(false);
  const [msReason, setMsReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [t, l, ms, em, cf, wl] = await Promise.all([
        import('../../../../services/review/reviewService').then((m) => m.reviewService.listTasks({ ...filter, search })),
        finalCheckService.listLists({ search }),
        finalCheckService.listMultiSignatures(),
        finalCheckService.listEmergencyRequests(),
        finalCheckService.listConfigs(),
        finalCheckService.getWorkload(),
      ]);
      const sorted = t.sort((a, b) => ((PRIORITY_META[a.priority]?.rank ?? 0) - (PRIORITY_META[b.priority]?.rank ?? 0)) || a.hoursToDeadline - b.hoursToDeadline);
      setTasks(sorted);
      setLists(l);
      setMultiSigs(ms);
      setEmergencies(em);
      setConfig(cf[0] ?? null);
      setWorkload(wl);
    } catch (e) {
      message.error(t('reportReview.final.loadFailed'));
    } finally {
      setLoading(false);
    }
    // [G005 Wave3A P2] 急诊通道配置 + 触发记录 (独立加载, 失败不影响主列表)
    emergencyChannelApi.getConfig().then((res) => { if (res.success) setEmConfig(res.data); });
    void loadEmRecords('');
  };

  const loadEmRecords = async (patientId: string) => {
    try {
      const res = await emergencyChannelApi.listRecords(patientId ? { patientId } : {});
      if (res.success) {
        const raw = (res as { data?: unknown }).data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: EmergencyTriggerRecord[] }).data
            : [];
        setEmRecords(list);
      }
    } catch { /* 通道服务不可用时保留旧数据 */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter.stage, filter.status, filter.priority]);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedId) ?? tasks.find((t) => t.id === embeddedTaskId), [tasks, selectedId, embeddedTaskId]);
  const listForTask = useMemo(() => lists.find((l) => l.taskId === selectedTask?.id) ?? lists[0] ?? null, [lists, selectedTask]);

  useEffect(() => {
    const l = listForTask;
    if (!l) {
      setActiveList(null);
      return;
    }
    setActiveList(l);
    finalCheckService.listNotes(l.taskId).then(setNotes).catch(() => setNotes([]));
    finalCheckService.checkConsistency(l.reportId).then(setConsistency).catch(() => setConsistency(null));
    finalCheckService.listScoringResults(l.taskId).then((r) => setScoring((Array.isArray(r) ? r : [])[0] ?? null)).catch(() => setScoring(null));
    finalCheckService.getDefaultRubric().then(setRubric).catch(() => setRubric(null));
    finalCheckService.compareWithPrior(l.reportId).then(setPrior).catch(() => setPrior(null));
    finalCheckService.listMultiSignatures(l.taskId).then((r) => setMultiSigs((prev) => [...(r ?? []), ...prev.filter((m) => m.taskId !== l.taskId)].slice(0, 20))).catch(() => { /* 多签加载失败保留旧数据 */ });
  }, [listForTask?.id]);

  const stats = useMemo(() => {
    return {
      total: lists.length,
      inProgress: lists.filter((l) => l.status === 'in-progress').length,
      completed: lists.filter((l) => l.status === 'completed').length,
      blocked: lists.filter((l) => l.summary.blockers > 0).length,
      avgScore: lists.length === 0 ? 0 : Math.round(lists.filter((l) => l.status === 'completed').reduce((a, l) => a + l.summary.percentage, 0) / Math.max(1, lists.filter((l) => l.status === 'completed').length)),
    };
  }, [lists]);

  const checklist = activeList?.items ?? [];
  const summary = activeList?.summary;

  const handleItemStatus = async (code: string, status: FinalCheckStatus) => {
    if (!activeList) return;
    try {
      const updated = await finalCheckService.updateItemStatus(activeList.taskId, code, status);
      setActiveList(updated);
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      message.success(t('reportReview.final.markedAs', { label: t(STATUS_META[status].label) }));
    } catch (e: unknown) {
      message.error('更新失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleComplete = async () => {
    if (!activeList) return;
    try {
      const updated = await finalCheckService.completeCheck(activeList.taskId);
      setActiveList(updated);
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      message.success(t('reportReview.final.completedScoring', { score: updated.summary.totalScore, max: updated.summary.maxScore, grade: updated.summary.grade }));
    } catch (e: unknown) {
      message.error('完成失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleReject = async () => {
    if (!activeList) return;
    try {
      const fn = rejectTarget === 'direct-to-draft' ? finalCheckService.rejectToDraft : finalCheckService.rejectToInitial;
      const updated = await fn({
        taskId: activeList.taskId, reviewerId: activeList.reviewerId, reviewerName: activeList.reviewerName,
        target: rejectTarget, reason: rejectReason, category: 'final-check-reject',
        preservePriorComment: true, notifyAuthor: true, reAuditRequired: rejectTarget === 'direct-to-draft',
      });
      setActiveList(updated);
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      message.success(t('reportReview.final.rejectedAs', { target: t(REJECT_TARGET_META[rejectTarget].label) }));
      setRejectReason('');
    } catch (e: unknown) {
      message.error('驳回失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleAddNote = async () => {
    if (!activeList) return;
    const v = await noteForm.validateFields();
    try {
      const created = await finalCheckService.addNote({
        taskId: activeList.taskId, reportId: activeList.reportId,
        authorId: 'D001', authorName: '当前医生', authorRole: 'chief',
        content: v.content, type: v.type, pinned: v.pinned ?? false,
        visibility: v.visibility ?? 'team', mentions: v.mentions ?? [], attachments: [],
      });
      setNotes((prev) => [created, ...prev]);
      setNoteOpen(false);
      noteForm.resetFields();
      message.success(t('reportReview.final.noteAdded'));
    } catch (e: unknown) {
      message.error('添加失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleTriggerEmergency = async () => {
    if (!activeList) return;
    const v = await emForm.validateFields();
    // [G005 Wave3A P2] 先走真实急诊通道端点 (创建触发记录 + 模拟通知), 失败回退本地 review 模拟
    let realOk = false;
    try {
      const real = await emergencyChannelApi.trigger({
        patientId: activeList.patientId,
        patientName: selectedTask?.patientName ?? '当前患者',
        type: v.trigger,
        reason: v.description,
        triggeredBy: 'D001',
      });
      if (real.success) {
        realOk = true;
        setEmRecords((prev) => [real.data, ...prev.filter((r) => r.id !== real.data.id)]);
      }
    } catch { /* 通道服务不可用 → 回退 */ }
    try {
      const created = await finalCheckService.triggerEmergencyReview(
        activeList.taskId, activeList.reportId, activeList.patientId, selectedTask?.patientName ?? '当前患者',
        'D001', '当前医生', v.trigger, v.severity, v.description, v.channels,
      );
      setEmergencies((prev) => [created, ...prev]);
    } catch (e: unknown) {
      message.error('触发失败: ' + (e instanceof Error ? e.message : '未知错误'));
      return;
    }
    setEmOpen(false);
    emForm.resetFields();
    message.success(realOk ? t('reportReview.final.emergencyTriggered') : t('reportReview.final.emergencyTriggeredLocal'));
  };

  const updateChannelConfig = (type: EmergencyChannelConfig['channels'][number]['type'], patch: Partial<EmergencyChannelConfig['channels'][number]>) => {
    setEmConfig((prev) => (prev ? { ...prev, channels: prev.channels.map((c) => (c.type === type ? { ...c, ...patch } : c)) } : prev));
  };

  const handleSaveChannelConfig = async () => {
    if (!emConfig) return;
    setEmConfigSaving(true);
    try {
      const res = await emergencyChannelApi.saveConfig(emConfig);
      if (res.success) {
        setEmConfig(res.data);
        message.success(t('reportReview.final.channelConfigSaved'));
      } else {
        message.error('保存失败: ' + (res.error?.message ?? '未知错误'));
      }
    } catch (e: unknown) {
      message.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setEmConfigSaving(false);
    }
  };

  const handleRequestMultiSig = async () => {
    if (!activeList) return;
    try {
      const created = await finalCheckService.requestMultiSignature(
        activeList.taskId, activeList.reportId, activeList.reviewerId, activeList.reviewerName,
        msReason || '终核完成后多签', 'manual',
      );
      setMultiSigs((prev) => [created, ...prev]);
      setMsOpen(false);
      setMsReason('');
      message.success(t('reportReview.final.multiSigStarted'));
    } catch (e: unknown) {
      message.error('发起失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleSignSlot = async (req: FinalMultiSignatureRequest, slotId: string) => {
    try {
      const updated = await finalCheckService.signMultiSignature(req.id, slotId, 'D001', '当前医生', 'cert-' + Date.now());
      setMultiSigs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      message.success(t('reportReview.final.signed'));
    } catch (e: unknown) {
      message.error('签章失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const renderChecklist = () => (
    <div data-testid="final-checklist-items" role="region" aria-label={t('reportReview.final.checkItems')}>
      {checklist.length === 0 ? (
        <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noCheckItems')} />
      ) : (
        <List
          dataSource={checklist}
          renderItem={(it) => {
            const cat = CATEGORY_META[it.category];
            const st = STATUS_META[it.status];
            const sv = SEVERITY_META[it.severity] ?? SEVERITY_META.minor!;
            return (
              <List.Item
                key={it.code}
                data-testid={`final-check-item-${it.code}`}
                style={{ padding: '10px 12px', borderRadius: 6, background: st.bg, marginBottom: 4, borderLeft: `3px solid ${st.color}` }}
                actions={[
                  <Select
                    key="status"
                    size="small"
                    value={it.status}
                    onChange={(v) => handleItemStatus(it.code, v)}
                    style={{ width: 100 }}
                    options={Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: t(v.label) }))}
                    aria-label={t('reportReview.final.setStatusAria', { code: it.code })}
                  />,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar style={{ background: cat.color, color: '#fff' }} size="small">
                      {it.code.slice(-2)}
                    </Avatar>
                  }
                  title={
                    <Space wrap>
                      <strong style={{ fontSize: 12 }}>{it.title}</strong>
                      <Tag color={cat.color}>{t(cat.label)}</Tag>
                      <Tag color={sv.color}>{t(sv.label)}</Tag>
                      {it.mandatory && <Tag color="red">{t('reportReview.final.mandatory')}</Tag>}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.code}</span>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{it.description}</div>
                      {it.evidence && (
                        <div style={{ fontSize: 12, color: 'var(--color-info)', background: 'var(--color-info-bg)', padding: 4, borderRadius: 4, marginTop: 4 }}>
                          🔍 {it.evidence}
                        </div>
                      )}
                      {it.remark && (
                        <div style={{ fontSize: 12, color: 'var(--color-warning)', background: 'var(--color-warning-bg)', padding: 4, borderRadius: 4, marginTop: 4 }}>
                          💬 {it.remark}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {t('reportReview.final.scoreLabel')} {it.score}/{it.maxScore} · {t('reportReview.final.weightLabel')} {it.weight} · {it.autoCheckable ? t('reportReview.final.auto') : t('reportReview.final.manual')} · {it.checkedBy ? `${t('reportReview.final.reviewedBy')} ${it.checkedBy} · ${timeAgo(it.checkedAt)}` : t('reportReview.final.notReviewed')}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  const renderConsistency = () => (
    <div data-testid="final-checklist-consistency" role="region" aria-label={t('reportReview.final.clinicalConsistency')}>
      {!consistency ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noConsistencyData')} /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Card size="small">
            <Row gutter={12}>
              <Col span={8}>
                <Statistic
                  title={t('reportReview.final.consistencyScore')}
                  value={Math.round(consistency.overallScore * 100)}
                  suffix="/100"
                  styles={{ content: {  color: consistency.overallScore >= 0.9 ? '#10b981' : consistency.overallScore >= 0.7 ? '#f59e0b' : '#dc2626'  } }}
                  prefix={<Activity size={14} />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={t('reportReview.final.aiConfidence')}
                  value={Math.round(consistency.aiConfidence * 100)}
                  suffix="%"
                  styles={{ content: {  color: '#3b82f6', fontSize: 16  } }}
                  prefix={<Zap size={14} />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={t('reportReview.final.consistencyLevel')}
                  value={consistency.consistencyLevel}
                  styles={{ content: {  color: '#7c3aed', fontSize: 16  } }}
                  prefix={<ShieldCheck size={14} />}
                />
              </Col>
            </Row>
          </Card>
          {consistency.contradictions.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={t('reportReview.final.contradictionsDetected', { n: consistency.contradictions.length })}
              description={
                <List
                  size="small"
                  dataSource={consistency.contradictions}
                  renderItem={(c) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Space>
                        <Tag color={c.severity === 'critical' ? 'red' : c.severity === 'major' ? 'orange' : 'blue'}>{c.severity}</Tag>
                        <span style={{ fontSize: 12 }}>{c.field}:</span>
                        <span style={{ fontSize: 12, color: '#dc2626' }}>{t('reportReview.final.reported')} "{c.reported}"</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
                        <span style={{ fontSize: 12, color: '#10b981' }}>{t('reportReview.final.expected')} "{c.expected}"</span>
                        {c.autoDetected && <Tag color="cyan" style={{ fontSize: 12 }}>{t('reportReview.final.autoDetected')}</Tag>}
                      </Space>
                    </List.Item>
                  )}
                />
              }
            />
          )}
          <Card size="small" title={t('reportReview.final.consistencyDimensions')}>
            {consistency.dimensions.map((d) => (
              <div key={d.code} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Tag color={d.status === 'consistent' ? 'green' : d.status === 'minor-deviation' ? 'orange' : 'red'}>{d.code}</Tag>
                    <strong>{d.name}</strong>
                  </Space>
                  <Space>
                    <Progress percent={Math.round(d.score * 100)} size="small" style={{ width: 120 }} />
                    <Tag color={d.status === 'consistent' ? 'success' : 'warning'}>{d.status}</Tag>
                  </Space>
                </Space>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {d.findings.join(' · ')}
                </div>
              </div>
            ))}
          </Card>
          <Card size="small" title={t('reportReview.final.crossReference')}>
            {consistency.crossReference.map((c) => (
              <Tag key={c.source} color={c.matched ? 'green' : 'red'} style={{ marginBottom: 4 }}>
                {c.source}: {c.detail}
              </Tag>
            ))}
          </Card>
        </Space>
      )}
    </div>
  );

  const renderScoring = () => (
    <div data-testid="final-checklist-scoring" role="region" aria-label={t('reportReview.final.scoring')}>
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        {scoring ? (
          <Card size="small" title={t('reportReview.final.scoringTitle', { grade: scoring.grade, score: scoring.totalScore })} extra={
            <Tag color={scoring.passed ? 'green' : 'red'}>{scoring.passed ? t('reportReview.final.status.passed') : scoring.blocked ? t('reportReview.severity.blocker') : t('reportReview.final.notReached')}</Tag>
          }>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={6}><Statistic title={t('reportReview.final.totalScore')} value={scoring.totalScore} suffix="/100" styles={{ content: {  color: '#7c3aed'  } }} /></Col>
              <Col span={6}><Statistic title={t('reportReview.final.status.passed')} value={scoring.passed ? t('reportReview.common.yes') : t('reportReview.common.no')} styles={{ content: {  color: scoring.passed ? '#10b981' : '#dc2626'  } }} /></Col>
              <Col span={6}><Statistic title={t('reportReview.severity.blocker')} value={scoring.blocked ? t('reportReview.common.yes') : t('reportReview.common.no')} styles={{ content: {  color: scoring.blocked ? '#dc2626' : '#10b981'  } }} /></Col>
              <Col span={6}><Statistic title={t('reportReview.final.deltaFromInitial')} value={scoring.deltaFromInitial ?? 0} styles={{ content: {  fontSize: 16, color: (scoring.deltaFromInitial ?? 0) >= 0 ? '#10b981' : '#dc2626'  } }} /></Col>
            </Row>
            {scoring.dimensionScores.map((d) => (
              <div key={d.code} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Tag color="blue">{d.code}</Tag>
                    <strong>{d.name}</strong>
                  </Space>
                  <Space>
                    <span style={{ fontSize: 12 }}>{t('reportReview.final.weightLabel')} {d.weight}%</span>
                    <Progress percent={d.score} size="small" style={{ width: 120 }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t('reportReview.final.weighted')} {d.weighted}</span>
                  </Space>
                </Space>
                {d.comment && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>💬 {d.comment}</div>}
              </div>
            ))}
            {scoring.hardFailures.length > 0 && (
              <Alert type="error" showIcon style={{ marginTop: 8 }} title={t('reportReview.final.hardFailures')} description={
                <Space wrap>{scoring.hardFailures.map((f) => <Tag key={f} color="red">{f}</Tag>)}</Space>
              } />
            )}
            {scoring.softWarnings.length > 0 && (
              <Alert type="warning" showIcon style={{ marginTop: 8 }} title={t('reportReview.final.softWarnings')} description={
                <Space wrap>{scoring.softWarnings.map((w) => <Tag key={w} color="orange">{w}</Tag>)}</Space>
              } />
            )}
          </Card>
        ) : (
          <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noScoring')} />
        )}
        {rubric && (
          <Card size="small" title={t('reportReview.final.rubricVersion', { version: rubric.version })}>
            <Row gutter={8}>
              {rubric.gradeBands.map((g) => (
                <Col span={4} key={g.grade}>
                  <div style={{ padding: 8, borderRadius: 4, background: g.color, color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{g.grade}</div>
                    <div style={{ fontSize: 12 }}>{g.minScore}-{g.maxScore}</div>
                    <div style={{ fontSize: 12 }}>{g.label}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </Space>
    </div>
  );

  const renderNotes = () => (
    <div data-testid="final-checklist-notes" role="region" aria-label={t('reportReview.final.notes')}>
      <Space style={{ marginBottom: 8 }}>
        <Button type="primary" size="small" icon={<PenLine size={12} />} onClick={() => setNoteOpen(true)}>{t('reportReview.final.addNote')}</Button>
      </Space>
      {notes.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noNotes')} /> : (
        <List
          dataSource={notes}
          renderItem={(n) => (
            <List.Item
              key={n.id}
              style={{ background: n.pinned ? 'var(--color-warning-bg)' : 'var(--bg-card)', padding: 10, borderRadius: 6, marginBottom: 6, border: '1px solid var(--border-color)' }}
              actions={[
                <Button key="pin" size="small" type="text" icon={n.pinned ? <PinOff size={12} /> : <Pin size={12} />} onClick={async () => {
                  const updated = await finalCheckService.pinNote(n.id, !n.pinned);
                  setNotes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                }} />,
                <Button key="resolve" size="small" type="text" disabled={!!n.resolvedAt} onClick={async () => {
                  const updated = await finalCheckService.resolveNote(n.id, 'D001', '当前医生');
                  setNotes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                }}>{t('reportReview.final.resolve')}</Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar style={{ background: n.pinned ? '#f59e0b' : '#3b82f6' }}>{n.authorName[0]}</Avatar>}
                title={
                  <Space wrap>
                    <strong>{n.authorName}</strong>
                    <Tag color={n.type === 'warning' ? 'red' : n.type === 'directive' ? 'purple' : n.type === 'suggestion' ? 'blue' : 'default'}>{n.type}</Tag>
                    <Tag>{n.visibility}</Tag>
                    {n.pinned && <Tag color="gold" icon={<Pin size={10} />}>{t('reportReview.final.pinned')}</Tag>}
                    {n.resolvedAt && <Tag color="green" icon={<CheckCircle2 size={10} />}>{t('reportReview.final.resolved')}</Tag>}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(n.createdAt)}</span>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12 }}>{n.content}</div>
                    {n.mentions.length > 0 && (
                      <div style={{ marginTop: 4 }}>{n.mentions.map((m) => <Tag key={m} color="cyan">@{m}</Tag>)}</div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const renderWorkload = () => (
    <div data-testid="final-checklist-workload" role="region" aria-label={t('reportReview.final.workload')}>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Statistic title={t('reportReview.final.groupTotalFinal')} value={workload.reduce((a, w) => a + w.totalFinalChecks, 0)} prefix={<ClipboardCheck size={14} />} /></Col>
        <Col span={6}><Statistic title={t('reportReview.final.groupRejected')} value={workload.reduce((a, w) => a + w.rejectedCount, 0)} prefix={<RotateCcw size={14} />} styles={{ content: {  color: '#dc2626'  } }} /></Col>
        <Col span={6}><Statistic title={t('reportReview.final.avgScore')} value={workload.length === 0 ? 0 : Math.round(workload.reduce((a, w) => a + w.averageScore, 0) / workload.length)} prefix={<Award size={14} />} /></Col>
        <Col span={6}><Statistic title={t('reportReview.final.avgDuration')} value={workload.length === 0 ? 0 : Math.round(workload.reduce((a, w) => a + w.averageDurationMin, 0) / workload.length)} suffix="min" prefix={<Timer size={14} />} /></Col>
      </Row>
      <List
        dataSource={workload}
        renderItem={(w) => (
          <List.Item key={w.reviewerId} style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border-color)' }}>
            <List.Item.Meta
              avatar={<Avatar style={{ background: w.reviewerTitle === 'chief' ? '#7c3aed' : '#3b82f6' }}>{w.reviewerName[0]}</Avatar>}
              title={
                <Space wrap>
                  <strong>{w.reviewerName}</strong>
                  <Tag color={w.reviewerTitle === 'chief' ? 'purple' : 'blue'}>{w.reviewerTitle}</Tag>
                  <Tag color={w.reviewerStatus === 'online' ? 'green' : w.reviewerStatus === 'away' ? 'orange' : 'default'}>{w.reviewerStatus}</Tag>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.date}</span>
                </Space>
              }
              description={
                <Row gutter={8} style={{ marginTop: 6 }}>
                  <Col span={4}><Statistic title={t('reportReview.final.totalCount')} value={w.totalFinalChecks} styles={{ content: {  fontSize: 14  } }} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.passedFirstTime')} value={w.passedFirstTime} styles={{ content: {  fontSize: 14, color: '#10b981'  } }} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.rejectedCount')} value={w.rejectedCount} styles={{ content: {  fontSize: 14, color: '#dc2626'  } }} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.avgScoreShort')} value={w.averageScore} styles={{ content: {  fontSize: 14, color: '#3b82f6'  } }} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.sla.onTimeRate')} value={`${w.onTimeRate}%`} styles={{ content: {  fontSize: 14, color: '#10b981'  } }} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.blockerRate')} value={`${w.blockerRate}%`} styles={{ content: {  fontSize: 14, color: w.blockerRate > 5 ? '#dc2626' : '#10b981'  } }} /></Col>
                </Row>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  const renderPrior = () => (
    <div data-testid="final-checklist-prior" role="region" aria-label={t('reportReview.final.priorComparison')}>
      {!prior ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noPriorReport')} /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Card size="small" title={
            <Space>
              <GitCompareArrows size={14} />
              <span>{t('reportReview.final.compareWith', { id: prior.priorReportId })}</span>
              <Tag color={prior.modalityMatch ? 'green' : 'red'}>{prior.modalityMatch ? t('reportReview.final.sameModality') : t('reportReview.final.diffModality')}</Tag>
              <Tag color={prior.bodyPartMatch ? 'green' : 'red'}>{prior.bodyPartMatch ? t('reportReview.final.sameBodyPart') : t('reportReview.final.diffBodyPart')}</Tag>
              <Tag color={prior.overallChange === 'worsened' ? 'red' : prior.overallChange === 'improved' ? 'green' : 'blue'}>{prior.overallChange}</Tag>
            </Space>
          }>
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t('reportReview.final.priorStudyDate')}>{prior.priorStudyDate}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.daysSince')}>{prior.daysSince} {t('reportReview.final.days')}</Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '8px 0' }} />
            <strong>{t('reportReview.final.aiSummary')}</strong>
            <div style={{ fontSize: 12, padding: 8, background: 'var(--color-info-bg)', borderRadius: 4, marginTop: 4 }}>{prior.aiSummary}</div>
            {prior.recommendedAction && (
              <Alert type="info" showIcon style={{ marginTop: 8 }} title={t('reportReview.final.recommendation')} description={prior.recommendedAction} />
            )}
          </Card>
          <Card size="small" title={t('reportReview.final.comparisonDetail')}>
            <List
              dataSource={prior.findings}
              renderItem={(f) => (
                <List.Item style={{ padding: '6px 0' }}>
                  <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                      <Tag color={f.significance === 'critical' ? 'red' : f.significance === 'major' ? 'orange' : f.significance === 'moderate' ? 'gold' : 'blue'}>{f.significance}</Tag>
                      <strong>{f.field}</strong>
                      <Tag color={f.change === 'new' ? 'red' : f.change === 'enlarged' ? 'orange' : f.change === 'stable' || f.change === 'unchanged' ? 'green' : 'blue'}>{f.change}</Tag>
                    </Space>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('reportReview.final.currentLabel')}</span> <span style={{ color: 'var(--color-info)' }}>{f.currentValue}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                      <span style={{ color: 'var(--text-muted)' }}>{t('reportReview.final.priorLabel')}</span> <span style={{ color: 'var(--color-warning)' }}>{f.priorValue}</span>
                    </div>
                    {f.detail && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📝 {f.detail}</div>}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Space>
      )}
    </div>
  );

  const renderMultiSig = () => (
    <div data-testid="final-checklist-multisig" role="region" aria-label={t('reportReview.final.multiSig')}>
      <Space style={{ marginBottom: 8 }}>
        <Button type="primary" size="small" icon={<Award size={12} />} onClick={() => setMsOpen(true)}>{t('reportReview.final.startMultiSig')}</Button>
      </Space>
      {multiSigs.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noMultiSig')} /> : (
        <List
          dataSource={multiSigs}
          renderItem={(m) => (
            <List.Item key={m.id} style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border-color)' }}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Tag color="purple">{m.id}</Tag>
                  <Tag color={m.trigger === 'critical' ? 'red' : m.trigger === 'special' ? 'purple' : 'blue'}>{m.trigger === 'critical' ? t('reportReview.priority.critical') : m.trigger === 'special' ? t('reportReview.final.special') : t('reportReview.priority.routine')}</Tag>
                  <Tag color={m.status === 'completed' ? 'green' : m.status === 'in-progress' ? 'blue' : 'default'}>{m.status === 'completed' ? t('reportReview.status.completed') : m.status === 'in-progress' ? t('reportReview.final.inProgress') : t('reportReview.final.pending')}</Tag>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.deadline')} {fmtTime(m.expiresAt)}</span>
                </Space>
                <div style={{ fontSize: 12 }}>📝 {m.reason}</div>
                <Timeline style={{ marginTop: 8 }}>
                  {m.slots.map((s) => (
                    <Timeline.Item key={s.id} color={s.status === 'signed' ? 'green' : s.status === 'rejected' ? 'red' : 'gray'} dot={
                      s.status === 'signed' ? <CheckCircle2 size={14} /> : s.status === 'rejected' ? <XCircle size={14} /> : <Clock size={14} />
                    }>
                      <Space>
                        <Tag color="blue">#{s.order} {s.role}</Tag>
                        {s.required && <Tag color="red">{t('reportReview.final.mustSign')}</Tag>}
                        {s.signerName ? <strong>{s.signerName}</strong> : <span style={{ color: 'var(--text-muted)' }}>{t('reportReview.final.toSign')}</span>}
                        {s.signedAt && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(s.signedAt)}</span>}
                        {s.certificateId && <Tag color="cyan">{s.certificateId}</Tag>}
                        {s.status === 'pending' && <Button size="small" type="primary" onClick={() => handleSignSlot(m, s.id)}>{t('reportReview.final.sign')}</Button>}
                      </Space>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const renderEmergency = () => (
    <div data-testid="final-checklist-emergency" role="region" aria-label={t('reportReview.final.emergencyChannel')}>
      <Space style={{ marginBottom: 8 }}>
        <Button danger size="small" icon={<Phone size={12} />} onClick={() => setEmOpen(true)}>{t('reportReview.final.triggerEmergency')}</Button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.emergencyHint')}</span>
      </Space>
      {/* [G005 Wave3A P2] 通道配置卡 */}
      {emConfig && (
        <Card size="small" style={{ marginBottom: 12 }} title={
          <Space><Settings2 size={14} /><span>{t('reportReview.final.channelConfig')}</span></Space>
        } extra={
          <Button type="primary" size="small" icon={<Save size={12} />} loading={emConfigSaving} onClick={handleSaveChannelConfig}>{t('reportReview.final.saveConfig')}</Button>
        }>
          <Row gutter={[12, 8]}>
            {emConfig.channels.map((c) => (
              <Col span={12} key={c.type} data-testid={`em-channel-${c.type}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <Tag color={CHANNEL_META[c.type].color} style={{ marginRight: 0 }}>{CHANNEL_META[c.type].label}</Tag>
                  <Switch size="small" checked={c.enabled} onChange={(v) => updateChannelConfig(c.type, { enabled: v })} />
                  <Select
                    size="small"
                    style={{ width: 90 }}
                    value={c.priority}
                    onChange={(v) => updateChannelConfig(c.type, { priority: v })}
                    options={[1, 2, 3, 4, 5, 6].map((p) => ({ value: p, label: t('reportReview.final.priorityN', { p }) }))}
                    aria-label={t('reportReview.final.channelPriorityAria', { type: c.type })}
                  />
                  <Input
                    size="small"
                    style={{ width: 130 }}
                    value={c.targetRole}
                    onChange={(e) => updateChannelConfig(c.type, { targetRole: e.target.value })}
                    placeholder={t('reportReview.final.targetRole')}
                    aria-label={t('reportReview.final.channelTargetRoleAria', { type: c.type })}
                  />
                </div>
              </Col>
            ))}
          </Row>
          <Divider style={{ margin: '10px 0' }} />
          <Space align="start" wrap>
            <Space>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.autoTrigger')}</span>
              <Switch size="small" checked={emConfig.autoTrigger.enabled} onChange={(v) => setEmConfig((prev) => (prev ? { ...prev, autoTrigger: { ...prev.autoTrigger, enabled: v } } : prev))} />
            </Space>
            <Input.TextArea
              rows={2}
              style={{ width: 320 }}
              value={emConfig.autoTrigger.keywords.join('\n')}
              onChange={(e) => setEmConfig((prev) => (prev ? { ...prev, autoTrigger: { ...prev.autoTrigger, keywords: e.target.value.split('\n').map((k) => k.trim()).filter(Boolean) } } : prev))}
              placeholder={t('reportReview.final.autoTriggerKeywordsPlaceholder')}
              aria-label={t('reportReview.final.autoTriggerKeywords')}
            />
          </Space>
        </Card>
      )}
      {/* [G005 Wave3A P2] 触发记录列表 (按患者查历史) */}
      <Card size="small" title={
        <Space><Activity size={14} /><span>{t('reportReview.final.triggerRecords')}</span></Space>
      } extra={
        <Space>
          <Input
            size="small"
            prefix={<Search size={12} />}
            placeholder={t('reportReview.final.searchByPatientPlaceholder')}
            value={emPatientFilter}
            onChange={(e) => setEmPatientFilter(e.target.value)}
            onPressEnter={() => void loadEmRecords(emPatientFilter.trim())}
            style={{ width: 180 }}
            allowClear
          />
          <Button size="small" icon={<Search size={12} />} onClick={() => void loadEmRecords(emPatientFilter.trim())}>{t('reportReview.final.search')}</Button>
        </Space>
      }>
        {emRecords.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noTriggerRecords')} /> : (
          <List
            size="small"
            dataSource={emRecords}
            renderItem={(r) => (
              <List.Item key={r.id} style={{ padding: '8px 4px', borderBottom: '1px solid var(--border-light)' }}>
                <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color={r.status === 'completed' ? 'green' : r.status === 'acknowledged' ? 'blue' : 'orange'}>{r.status === 'completed' ? t('reportReview.status.completed') : r.status === 'acknowledged' ? t('reportReview.final.acknowledged') : t('reportReview.final.pending')}</Tag>
                    <Tag>{r.id}</Tag>
                    <strong style={{ fontSize: 12 }}>{r.patientName || r.patientId}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtTime(r.triggeredAt)} · {r.triggeredBy}</span>
                  </Space>
                  <div style={{ fontSize: 12 }}>📝 {r.reason}</div>
                  <Space wrap>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.channelsLabel')}</span>
                    {(r.channels ?? []).map((c) => <Tag key={c} color={CHANNEL_META[c].color}>{t(CHANNEL_META[c].label)}</Tag>)}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.notifiedTimes', { n: (r.notifications ?? []).length })}</span>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
      {emergencies.length > 0 && (
        <Card size="small" title={<Space><Bell size={14} /><span>{t('reportReview.final.emergencyTasks')}</span></Space>} style={{ marginTop: 12 }}>
        <List
          dataSource={emergencies}
          renderItem={(e) => (
            <List.Item
              key={e.id}
              style={{ padding: 10, background: e.severity === 'life-threatening' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', borderRadius: 6, marginBottom: 6, border: `1px solid ${e.severity === 'life-threatening' ? 'var(--color-error-border)' : 'var(--color-warning-border)'}` }}
            >
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Space wrap>
                  <Bell size={14} color={e.severity === 'life-threatening' ? '#dc2626' : '#f59e0b'} />
                  <Tag color={e.severity === 'life-threatening' ? 'red' : e.severity === 'critical' ? 'volcano' : 'orange'}>{e.severity === 'life-threatening' ? t('reportReview.final.lifeThreatening') : e.severity === 'critical' ? t('reportReview.severity.critical') : t('reportReview.final.urgent')}</Tag>
                  <Tag color={e.status === 'completed' ? 'green' : e.status === 'in-review' ? 'blue' : 'default'}>{e.status === 'completed' ? t('reportReview.status.completed') : e.status === 'in-review' ? t('reportReview.status.inProgress') : t('reportReview.final.pending')}</Tag>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtTime(e.triggeredAt)} · SLA {e.slaMinutes}min</span>
                </Space>
                <div style={{ fontSize: 12 }}>{e.description}</div>
                <Space wrap>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.channelsLabel')}</span>
                  {(e.channels ?? []).map((c) => <Tag key={c} color={CHANNEL_META[c].color}>{t(CHANNEL_META[c].label)}</Tag>)}
                </Space>
                <Space wrap>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.targetsLabel')}</span>
                  {(e.targets ?? []).map((t) => (
                    <Tag key={t.reviewerId} color={t.acknowledgedAt ? 'green' : 'orange'}>
                      {t.reviewerName} {t.acknowledgedAt ? `✓ ${timeAgo(t.acknowledgedAt)}` : '⏳'}
                    </Tag>
                  ))}
                </Space>
              </Space>
            </List.Item>
          )}
        />
        </Card>
      )}
    </div>
  );

  const renderWorkflow = () => (
    <div data-testid="final-checklist-workflow" role="region" aria-label={t('reportReview.final.workflowConfig')}>
      {!config ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noWorkflow')} /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Card size="small" title={
            <Space>
              <Settings2 size={14} />
              <strong>{config.name}</strong>
              <Tag color="purple">{config.version}</Tag>
              {config.isDefault && <Tag color="blue">{t('reportReview.final.default')}</Tag>}
            </Space>
          } extra={
            <Switch
              checked={config.enabled}
              checkedChildren={t('reportReview.common.enabled')}
              unCheckedChildren={t('reportReview.common.disabled')}
              onChange={async (v) => {
                const updated = await finalCheckService.updateConfig(config.id, { enabled: v }, 'D001');
                setConfig(updated);
                message.success(v ? t('reportReview.common.enabled') : t('reportReview.common.disabled'));
              }}
            />
          }>
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t('reportReview.final.defaultRubric')}>{config.defaultRubricId}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.multiSig')}>{config.multiSignatureRequired ? t('reportReview.common.enabled') : t('reportReview.final.off')}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.emergencyChannel')}>{config.emergencyChannelEnabled ? t('reportReview.common.enabled') : t('reportReview.final.off')}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.rejectPaths')}>{t('reportReview.final.pathCount', { n: config.rejectTargets.length })}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.passingThreshold')}>{config.passingThreshold}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.blockingThreshold')}>{config.blockingThreshold}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.blockerAutoEscalate')}>{config.autoEscalateOnBlocker ? t('reportReview.common.yes') : t('reportReview.common.no')}</Descriptions.Item>
              <Descriptions.Item label={t('reportReview.final.notifyOnReject')}>{config.notifyOnReject ? t('reportReview.common.yes') : t('reportReview.common.no')}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" title={t('reportReview.final.workflowStages')}>
            <Timeline>
              {config.stages.sort((a, b) => a.order - b.order).map((s) => (
                <Timeline.Item key={s.id} color={s.required ? 'red' : 'blue'} dot={<div style={{ background: s.required ? '#dc2626' : '#3b82f6', color: '#fff', borderRadius: 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.order}</div>}>
                  <Space>
                    <strong>{s.name}</strong>
                    <Tag>{s.code}</Tag>
                    {s.required && <Tag color="red">{t('reportReview.final.requiredStage')}</Tag>}
                    {s.skippable && <Tag color="orange">{t('reportReview.final.skippable')}</Tag>}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportReview.final.slaMinutes', { n: s.slaMinutes })}</span>
                  </Space>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('reportReview.final.rolesAllowed')} {s.rolesAllowed.join(' / ')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t('reportReview.final.exitCriteria')} {s.exitCriteria.join(' · ')}</div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
          <Card size="small" title={t('reportReview.final.rejectPaths')}>
            {config.rejectTargets.map((target) => (
              <Alert
                key={target}
                type="info"
                showIcon
                style={{ marginBottom: 4 }}
                title={t(REJECT_TARGET_META[target].label)}
                description={t(REJECT_TARGET_META[target].description)}
              />
            ))}
          </Card>
        </Space>
      )}
    </div>
  );

  return (
    <div data-testid="final-check-list" role="region" aria-label={t('reportReview.final.title')}>
      <div style={{ background: 'linear-gradient(135deg, #7c2d12 0%, #be185d 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <ShieldCheck size={18} />
            <strong style={{ fontSize: 16 }}>{t('reportReview.final.titleV2')}</strong>
          </Space>
          <Space>
            <Input
              size="small"
              prefix={<Search size={12} />}
              placeholder={t('reportReview.final.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={load}
              style={{ width: 180 }}
              aria-label={t('reportReview.final.searchAria')}
            />
            <Button size="small" icon={<RefreshCw size={12} />} onClick={load}>{t('reportReview.common.refresh')}</Button>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.final.totalLists')}</span>} value={stats.total} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<FileText size={14} />} /></Col>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.final.inProgress')}</span>} value={stats.inProgress} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Activity size={14} />} /></Col>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.status.completed')}</span>} value={stats.completed} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<CheckCircle2 size={14} />} /></Col>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.severity.blocker')}</span>} value={stats.blocked} styles={{ content: {  color: '#fca5a5', fontSize: 18  } }} prefix={<AlertTriangle size={14} />} /></Col>
          <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>{t('reportReview.final.avgScore')}</span>} value={stats.avgScore} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Award size={14} />} /></Col>
        </Row>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, marginBottom: 8, border: '1px solid var(--border-color)' }}>
        <Space wrap>
          <Select size="small" value={filter.status || 'all'} onChange={(v) => setFilter({ ...filter, status: v })} style={{ width: 110 }} options={[
            { value: 'all', label: t('reportReview.initial.allStatus') },
            { value: 'pending', label: t('reportReview.status.pending') },
            { value: 'in-progress', label: t('reportReview.status.inProgress') },
            { value: 'completed', label: t('reportReview.status.completed') },
          ]} aria-label={t('reportReview.final.statusFilterAria')} />
          <Select size="small" value={filter.priority || 'all'} onChange={(v) => setFilter({ ...filter, priority: v })} style={{ width: 110 }} options={[
            { value: 'all', label: t('reportReview.initial.allPriority') },
            { value: 'stat', label: t('reportReview.priority.stat') },
            { value: 'critical', label: t('reportReview.priority.critical') },
            { value: 'urgent', label: t('reportReview.priority.urgent') },
            { value: 'routine', label: t('reportReview.priority.routine') },
          ]} aria-label={t('reportReview.final.priorityFilterAria')} />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('reportReview.final.showingTasks', { tasks: tasks.length, lists: lists.length })}</span>
        </Space>
      </div>

      <Row gutter={12}>
        <Col span={8} style={{ maxHeight: 600, overflowY: 'auto' }}>
          <List
            loading={loading}
            dataSource={tasks}
            locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.noFinalTasks')} /> }}
            style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 4 }}
            renderItem={(task) => {
              const priConf = PRIORITY_META[task.priority] ?? PRIORITY_META.routine!;
              const list = lists.find((l) => l.taskId === task.id);
              return (
                <List.Item
                  key={task.id}
                  onClick={() => onSelect?.(task)}
                  style={{
                    cursor: 'pointer', padding: '10px 12px', borderRadius: 6, marginBottom: 4,
                    background: task.id === selectedId ? 'var(--color-pending-bg)' : task.isOverdue ? 'var(--color-error-bg)' : 'transparent',
                    borderLeft: task.id === selectedId ? '3px solid #7c3aed' : task.isOverdue ? '3px solid #dc2626' : '3px solid transparent',
                  }}
                  data-testid={`final-check-item-${task.id}`}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: task.criticalFinding ? 'var(--color-error-bg)' : 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {task.criticalFinding ? <AlertTriangle size={18} color="#dc2626" /> : <ShieldCheck size={18} color="#7c3aed" />}
                      </div>
                    }
                    title={
                      <Space wrap>
                        <span style={{ fontWeight: 600 }}>{task.patientName}</span>
                        <Tag color="blue">{task.modality}</Tag>
                        <Tag>{task.bodyPart}</Tag>
                        <Tag color={priConf.color}>{t(priConf.label)}</Tag>
                        {task.needsCosign && <Tag color="purple">{t('reportReview.status.cosignRequired')}</Tag>}
                        {list && <Tag color={list.summary.isPublishable ? 'green' : list.summary.blockers > 0 ? 'red' : 'orange'}>{list.summary.percentage}%</Tag>}
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <User size={10} /> {task.authorTitle} {task.authorName} · {t('reportReview.final.initialScore')} <strong>{task.initialReviewScore ?? '-'}</strong>
                        <div style={{ fontSize: 12, color: task.isOverdue ? '#dc2626' : 'var(--text-muted)' }}>
                          <Clock size={10} /> {task.isOverdue ? `超时 ${Math.abs(task.hoursToDeadline)}h` : `${task.hoursToDeadline}h`} · {t('reportReview.final.submitted')} {timeAgo(task.submittedAt)}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Col>
        <Col span={16}>
          {!activeList ? (
            <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportReview.final.selectTaskHint')} style={{ marginTop: 80 }} />
          ) : (
            <Card
              size="small"
              title={
                <Space>
                  <ListChecks size={14} />
                  <span>{activeList.reportId} · {t('reportReview.final.title')}</span>
                  <Tag color={activeList.status === 'completed' ? 'green' : activeList.status === 'aborted' ? 'red' : 'blue'}>{activeList.status}</Tag>
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" icon={<GitCompareArrows size={12} />} onClick={() => setTab('prior')}>{t('reportReview.final.prior')}</Button>
                  <Button size="small" icon={<MessageSquare size={12} />} onClick={() => setTab('notes')}>{t('reportReview.final.notes')}</Button>
                  <Popconfirm
                    title={t('reportReview.final.confirmRejectReport')}
                    description={
                      <Space orientation="vertical" size={4}>
                        <Radio.Group value={rejectTarget} onChange={(e) => setRejectTarget(e.target.value)}>
                          {Object.entries(REJECT_TARGET_META).map(([k, v]) => (
                            <Radio key={k} value={k}>{v.label}</Radio>
                          ))}
                        </Radio.Group>
                        <Input.TextArea
                          rows={3}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t('reportReview.final.rejectReasonPlaceholder', { target: rejectTarget === 'direct-to-draft' ? t('reportReview.final.rejectDirect') : t('reportReview.final.reject') })}
                        />
                      </Space>
                    }
                    onConfirm={handleReject}
                    okText={t('reportReview.final.confirmReject')}
                    cancelText={t('reportReview.common.cancel')}
                    okButtonProps={{ disabled: rejectReason.trim().length < 5 }}
                  >
                    <Button danger size="small" icon={<RotateCcw size={12} />}>{t('reportReview.final.reject')}</Button>
                  </Popconfirm>
                  <Button type="primary" size="small" icon={<CheckCircle2 size={12} />} onClick={handleComplete} disabled={activeList.status === 'completed' || summary?.blockers! > 0}>{t('reportReview.final.completeFinal')}</Button>
                </Space>
              }
            >
              {summary && (
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col span={4}><Statistic title={t('reportReview.final.status.passed')} value={summary.passed} styles={{ content: {  fontSize: 14, color: '#10b981'  } }} prefix={<CheckCircle2 size={12} />} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.status.failed')} value={summary.failed} styles={{ content: {  fontSize: 14, color: '#dc2626'  } }} prefix={<XCircle size={12} />} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.status.warning')} value={summary.warning} styles={{ content: {  fontSize: 14, color: '#f59e0b'  } }} prefix={<AlertTriangle size={12} />} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.score')} value={summary.percentage} suffix="%" styles={{ content: {  fontSize: 14, color: '#3b82f6'  } }} prefix={<Award size={12} />} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.final.grade')} value={summary.grade} styles={{ content: {  fontSize: 14, color: '#7c3aed'  } }} prefix={<ShieldCheck size={12} />} /></Col>
                  <Col span={4}><Statistic title={t('reportReview.severity.blocker')} value={summary.blockers} styles={{ content: {  fontSize: 14, color: summary.blockers > 0 ? '#dc2626' : '#10b981'  } }} prefix={<CircleSlash size={12} />} /></Col>
                </Row>
              )}
              <Tabs
                size="small"
                activeKey={tab}
                onChange={(k) => setTab(k as typeof tab)}
                items={[
                  { key: 'checklist', label: <span><ClipboardCheck size={12} /> {t('reportReview.final.tabChecklist')} {checklist.length}</span>, children: renderChecklist() },
                  { key: 'consistency', label: <span><Stethoscope size={12} /> {t('reportReview.final.tabConsistency')}</span>, children: renderConsistency() },
                  { key: 'scoring', label: <span><Award size={12} /> {t('reportReview.final.tabScoring')}</span>, children: renderScoring() },
                  { key: 'notes', label: <span><MessageSquare size={12} /> {t('reportReview.final.tabNotes')} {notes.length}</span>, children: renderNotes() },
                  { key: 'workload', label: <span><BarChart3 size={12} /> {t('reportReview.final.tabWorkload')}</span>, children: renderWorkload() },
                  { key: 'prior', label: <span><GitCompareArrows size={12} /> {t('reportReview.final.tabPrior')}</span>, children: renderPrior() },
                  { key: 'multisig', label: <span><Award size={12} /> {t('reportReview.final.tabMultiSig')} {multiSigs.length}</span>, children: renderMultiSig() },
                  { key: 'emergency', label: <span><Phone size={12} /> {t('reportReview.final.tabEmergency')} {emergencies.length}</span>, children: renderEmergency() },
                  { key: 'workflow', label: <span><Settings2 size={12} /> {t('reportReview.final.tabWorkflow')}</span>, children: renderWorkflow() },
                ]}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={t('reportReview.final.addNoteTitle')}
        open={noteOpen}
        onCancel={() => setNoteOpen(false)}
        onOk={handleAddNote}
        okText={t('reportReview.final.add')}
        cancelText={t('reportReview.common.cancel')}
        destroyOnHidden
      >
        <Form form={noteForm} layout="vertical" initialValues={{ type: 'comment', visibility: 'team', pinned: false }}>
          <Form.Item name="type" label={t('reportReview.final.fieldType')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'comment', label: t('reportReview.final.noteType.comment') },
              { value: 'suggestion', label: t('reportReview.final.noteType.suggestion') },
              { value: 'instruction', label: t('reportReview.final.noteType.instruction') },
              { value: 'warning', label: t('reportReview.final.noteType.warning') },
              { value: 'directive', label: t('reportReview.final.noteType.directive') },
            ]} />
          </Form.Item>
          <Form.Item name="content" label={t('reportReview.final.fieldContent')} rules={[{ required: true, min: 5, message: t('reportReview.final.contentMin') }]}>
            <Input.TextArea rows={4} placeholder={t('reportReview.final.noteContentPlaceholder')} />
          </Form.Item>
          <Form.Item name="visibility" label={t('reportReview.final.fieldVisibility')}>
            <Select options={[
              { value: 'private', label: t('reportReview.final.visibility.private') },
              { value: 'team', label: t('reportReview.final.visibility.team') },
              { value: 'department', label: t('reportReview.final.visibility.department') },
              { value: 'all', label: t('reportReview.final.visibility.all') },
            ]} />
          </Form.Item>
          <Form.Item name="pinned" label={t('reportReview.final.pinned')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('reportReview.final.triggerEmergencyTitle')}
        open={emOpen}
        onCancel={() => setEmOpen(false)}
        onOk={handleTriggerEmergency}
        okText={t('reportReview.final.trigger')}
        cancelText={t('reportReview.common.cancel')}
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <Form form={emForm} layout="vertical" initialValues={{ trigger: 'critical-finding', severity: 'critical', channels: ['sms', 'in-app', 'phone'] }}>
          <Form.Item name="trigger" label={t('reportReview.final.fieldTriggerReason')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'critical-finding', label: t('reportReview.final.triggerReason.criticalFinding') },
              { value: 'stat-imaging', label: t('reportReview.final.triggerReason.statImaging') },
              { value: 'icu-request', label: t('reportReview.final.triggerReason.icuRequest') },
              { value: 'er-request', label: t('reportReview.final.triggerReason.erRequest') },
              { value: 'manual', label: t('reportReview.final.triggerReason.manual') },
            ]} />
          </Form.Item>
          <Form.Item name="severity" label={t('reportReview.final.fieldSeverity')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'urgent', label: t('reportReview.final.urgent') },
              { value: 'critical', label: t('reportReview.severity.critical') },
              { value: 'life-threatening', label: t('reportReview.final.lifeThreatening') },
            ]} />
          </Form.Item>
          <Form.Item name="channels" label={t('reportReview.final.fieldChannels')} rules={[{ required: true }]}>
            <Select mode="multiple" options={Object.entries(CHANNEL_META).map(([k, v]) => ({ value: k, label: t(v.label) }))} />
          </Form.Item>
          <Form.Item name="description" label={t('reportReview.final.fieldDescription')} rules={[{ required: true, min: 10 }]}>
            <Input.TextArea rows={3} placeholder={t('reportReview.final.emergencyDescPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('reportReview.final.startMultiSig')}
        open={msOpen}
        onCancel={() => setMsOpen(false)}
        onOk={handleRequestMultiSig}
        okText={t('reportReview.final.start')}
        cancelText={t('reportReview.common.cancel')}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label={t('reportReview.final.fieldReason')}>
            <Input.TextArea rows={3} value={msReason} onChange={(e) => setMsReason(e.target.value)} placeholder={t('reportReview.final.multiSigReasonPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FinalCheckList;

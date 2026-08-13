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
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react'

const CATEGORY_META: Record<FinalCheckCategory, { color: string; label: string }> = {
  demographics: { color: 'blue', label: '人口学' },
  'clinical-history': { color: 'cyan', label: '病史' },
  'image-quality': { color: 'geekblue', label: '图像质量' },
  'image-consistency': { color: 'purple', label: '图像一致' },
  'findings-completeness': { color: 'magenta', label: '所见完整' },
  'diagnosis-accuracy': { color: 'red', label: '诊断准确' },
  'critical-marking': { color: 'volcano', label: '危急值' },
  laterality: { color: 'orange', label: '左右侧' },
  'modality-consistency': { color: 'gold', label: '方式一致' },
  'icd-coding': { color: 'lime', label: 'ICD 编码' },
  recommendation: { color: 'green', label: '建议' },
  'prior-comparison': { color: 'blue', label: '既往对比' },
  signature: { color: 'purple', label: '签章' },
  confidentiality: { color: 'magenta', label: '隐私' },
  terminology: { color: 'cyan', label: '术语' },
  grammar: { color: 'default', label: '语法' },
  'quality-score': { color: 'red', label: '质量分' },
  'audit-trail': { color: 'volcano', label: '审计链' },
};

const STATUS_META: Record<FinalCheckStatus, { color: string; bg: string; label: string }> = {
  pending: { color: '#94a3b8', bg: 'var(--content-bg)', label: '待查' },
  passed: { color: '#10b981', bg: 'var(--color-success-bg)', label: '通过' },
  failed: { color: '#dc2626', bg: 'var(--color-error-bg)', label: '失败' },
  warning: { color: '#f59e0b', bg: 'var(--color-warning-bg)', label: '警告' },
  skipped: { color: '#64748b', bg: 'var(--content-bg)', label: '跳过' },
  'not-applicable': { color: '#94a3b8', bg: 'var(--content-bg)', label: '不适用' },
};

const SEVERITY_META: Record<string, { color: string; label: string; rank: number }> = {
  blocker: { color: '#dc2626', label: '阻塞', rank: 0 },
  critical: { color: '#dc2626', label: '严重', rank: 1 },
  major: { color: '#f59e0b', label: '主要', rank: 2 },
  minor: { color: '#3b82f6', label: '次要', rank: 3 },
  info: { color: '#64748b', label: '信息', rank: 4 },
};

const PRIORITY_META: Record<string, { color: string; label: string; rank: number }> = {
  stat: { color: 'red', label: '急诊', rank: 0 },
  critical: { color: 'volcano', label: '危急', rank: 0 },
  urgent: { color: 'orange', label: '加急', rank: 1 },
  routine: { color: 'default', label: '常规', rank: 2 },
};

const REJECT_TARGET_META: Record<FinalRejectTarget, { label: string; color: string; description: string }> = {
  initial: { label: '退回初审', color: 'orange', description: '退回到初审环节,保留初评意见' },
  'direct-to-draft': { label: '直接退回起草', color: 'red', description: '直接退回报告作者起草,质量重置' },
  'previous-stage': { label: '退回上一阶段', color: 'gold', description: '退回到上一处理阶段' },
};

const CHANNEL_META: Record<EmergencyChannel, { label: string; color: string }> = {
  sms: { label: '短信', color: 'blue' },
  phone: { label: '电话', color: 'red' },
  'in-app': { label: '应用内', color: 'cyan' },
  wechat: { label: '微信', color: 'green' },
  email: { label: '邮件', color: 'gold' },
  pager: { label: '呼叫器', color: 'volcano' },
};

function timeAgo(iso?: string): string {
  if (!iso) return '-';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
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
      const sorted = t.sort((a, b) => (PRIORITY_META[a.priority]!.rank - PRIORITY_META[b.priority]!.rank) || a.hoursToDeadline - b.hoursToDeadline);
      setTasks(sorted);
      setLists(l);
      setMultiSigs(ms);
      setEmergencies(em);
      setConfig(cf[0] ?? null);
      setWorkload(wl);
    } catch (e) {
      message.error('加载终核清单失败');
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
    finalCheckService.listNotes(l.taskId).then(setNotes);
    finalCheckService.checkConsistency(l.reportId).then(setConsistency);
    finalCheckService.listScoringResults(l.taskId).then((r) => setScoring(r[0] ?? null));
    finalCheckService.getDefaultRubric().then(setRubric);
    finalCheckService.compareWithPrior(l.reportId).then(setPrior);
    finalCheckService.listMultiSignatures(l.taskId).then((r) => setMultiSigs((prev) => [...r, ...prev.filter((m) => m.taskId !== l.taskId)].slice(0, 20)));
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
      message.success(`已标记 ${STATUS_META[status].label}`);
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
      message.success(`终核完成 · 评分 ${updated.summary.totalScore}/${updated.summary.maxScore} (${updated.summary.grade})`);
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
      message.success(`已${REJECT_TARGET_META[rejectTarget].label}`);
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
      message.success('已添加终审笔记');
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
    message.success(realOk ? '已触发急诊通道, 通知已模拟送达' : '已触发急诊审核通道(通道端点不可用, 已本地记录)');
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
        message.success('急诊通道配置已保存');
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
      message.success('已发起多签流程');
    } catch (e: unknown) {
      message.error('发起失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const handleSignSlot = async (req: FinalMultiSignatureRequest, slotId: string) => {
    try {
      const updated = await finalCheckService.signMultiSignature(req.id, slotId, 'D001', '当前医生', 'cert-' + Date.now());
      setMultiSigs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      message.success('已签');
    } catch (e: unknown) {
      message.error('签章失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const renderChecklist = () => (
    <div data-testid="final-checklist-items" role="region" aria-label="终核检查项">
      {checklist.length === 0 ? (
        <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无检查项" />
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
                    options={Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))}
                    aria-label={`设置 ${it.code} 状态`}
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
                      <Tag color={cat.color}>{cat.label}</Tag>
                      <Tag color={sv.color}>{sv.label}</Tag>
                      {it.mandatory && <Tag color="red">必查</Tag>}
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
                        分值 {it.score}/{it.maxScore} · 权重 {it.weight} · {it.autoCheckable ? '自动' : '人工'} · {it.checkedBy ? `复核 ${it.checkedBy} · ${timeAgo(it.checkedAt)}` : '未复核'}
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
    <div data-testid="final-checklist-consistency" role="region" aria-label="临床一致性">
      {!consistency ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无一致性数据" /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Card size="small">
            <Row gutter={12}>
              <Col span={8}>
                <Statistic
                  title="一致性评分"
                  value={Math.round(consistency.overallScore * 100)}
                  suffix="/100"
                  styles={{ content: {  color: consistency.overallScore >= 0.9 ? '#10b981' : consistency.overallScore >= 0.7 ? '#f59e0b' : '#dc2626'  } }}
                  prefix={<Activity size={14} />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="AI 置信度"
                  value={Math.round(consistency.aiConfidence * 100)}
                  suffix="%"
                  styles={{ content: {  color: '#3b82f6', fontSize: 16  } }}
                  prefix={<Zap size={14} />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="一致性等级"
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
              title={`检测到 ${consistency.contradictions.length} 处矛盾`}
              description={
                <List
                  size="small"
                  dataSource={consistency.contradictions}
                  renderItem={(c) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Space>
                        <Tag color={c.severity === 'critical' ? 'red' : c.severity === 'major' ? 'orange' : 'blue'}>{c.severity}</Tag>
                        <span style={{ fontSize: 12 }}>{c.field}:</span>
                        <span style={{ fontSize: 12, color: '#dc2626' }}>报告 "{c.reported}"</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
                        <span style={{ fontSize: 12, color: '#10b981' }}>期望 "{c.expected}"</span>
                        {c.autoDetected && <Tag color="cyan" style={{ fontSize: 12 }}>自动检测</Tag>}
                      </Space>
                    </List.Item>
                  )}
                />
              }
            />
          )}
          <Card size="small" title="一致性维度">
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
          <Card size="small" title="交叉引用">
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
    <div data-testid="final-checklist-scoring" role="region" aria-label="终评分">
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        {scoring ? (
          <Card size="small" title={`终评分 · ${scoring.grade} · ${scoring.totalScore}分`} extra={
            <Tag color={scoring.passed ? 'green' : 'red'}>{scoring.passed ? '通过' : scoring.blocked ? '阻塞' : '未达'}</Tag>
          }>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={6}><Statistic title="总分" value={scoring.totalScore} suffix="/100" styles={{ content: {  color: '#7c3aed'  } }} /></Col>
              <Col span={6}><Statistic title="通过" value={scoring.passed ? '是' : '否'} styles={{ content: {  color: scoring.passed ? '#10b981' : '#dc2626'  } }} /></Col>
              <Col span={6}><Statistic title="阻塞" value={scoring.blocked ? '是' : '否'} styles={{ content: {  color: scoring.blocked ? '#dc2626' : '#10b981'  } }} /></Col>
              <Col span={6}><Statistic title="与初评差" value={scoring.deltaFromInitial ?? 0} styles={{ content: {  fontSize: 16, color: (scoring.deltaFromInitial ?? 0) >= 0 ? '#10b981' : '#dc2626'  } }} /></Col>
            </Row>
            {scoring.dimensionScores.map((d) => (
              <div key={d.code} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Tag color="blue">{d.code}</Tag>
                    <strong>{d.name}</strong>
                  </Space>
                  <Space>
                    <span style={{ fontSize: 12 }}>权重 {d.weight}%</span>
                    <Progress percent={d.score} size="small" style={{ width: 120 }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>加权 {d.weighted}</span>
                  </Space>
                </Space>
                {d.comment && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>💬 {d.comment}</div>}
              </div>
            ))}
            {scoring.hardFailures.length > 0 && (
              <Alert type="error" showIcon style={{ marginTop: 8 }} title="硬性失败" description={
                <Space wrap>{scoring.hardFailures.map((f) => <Tag key={f} color="red">{f}</Tag>)}</Space>
              } />
            )}
            {scoring.softWarnings.length > 0 && (
              <Alert type="warning" showIcon style={{ marginTop: 8 }} title="软性警告" description={
                <Space wrap>{scoring.softWarnings.map((w) => <Tag key={w} color="orange">{w}</Tag>)}</Space>
              } />
            )}
          </Card>
        ) : (
          <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description="尚无评分,完成检查项后自动计分" />
        )}
        {rubric && (
          <Card size="small" title={`评分细则 ${rubric.version}`}>
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
    <div data-testid="final-checklist-notes" role="region" aria-label="终审笔记">
      <Space style={{ marginBottom: 8 }}>
        <Button type="primary" size="small" icon={<PenLine size={12} />} onClick={() => setNoteOpen(true)}>添加笔记</Button>
      </Space>
      {notes.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无终审笔记" /> : (
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
                }}>解决</Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar style={{ background: n.pinned ? '#f59e0b' : '#3b82f6' }}>{n.authorName[0]}</Avatar>}
                title={
                  <Space wrap>
                    <strong>{n.authorName}</strong>
                    <Tag color={n.type === 'warning' ? 'red' : n.type === 'directive' ? 'purple' : n.type === 'suggestion' ? 'blue' : 'default'}>{n.type}</Tag>
                    <Tag>{n.visibility}</Tag>
                    {n.pinned && <Tag color="gold" icon={<Pin size={10} />}>置顶</Tag>}
                    {n.resolvedAt && <Tag color="green" icon={<CheckCircle2 size={10} />}>已解决</Tag>}
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
    <div data-testid="final-checklist-workload" role="region" aria-label="终核工作量">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Statistic title="本组总终核" value={workload.reduce((a, w) => a + w.totalFinalChecks, 0)} prefix={<ClipboardCheck size={14} />} /></Col>
        <Col span={6}><Statistic title="本组驳回" value={workload.reduce((a, w) => a + w.rejectedCount, 0)} prefix={<RotateCcw size={14} />} styles={{ content: {  color: '#dc2626'  } }} /></Col>
        <Col span={6}><Statistic title="平均评分" value={workload.length === 0 ? 0 : Math.round(workload.reduce((a, w) => a + w.averageScore, 0) / workload.length)} prefix={<Award size={14} />} /></Col>
        <Col span={6}><Statistic title="平均耗时" value={workload.length === 0 ? 0 : Math.round(workload.reduce((a, w) => a + w.averageDurationMin, 0) / workload.length)} suffix="min" prefix={<Timer size={14} />} /></Col>
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
                  <Col span={4}><Statistic title="总数" value={w.totalFinalChecks} styles={{ content: {  fontSize: 14  } }} /></Col>
                  <Col span={4}><Statistic title="一次性通过" value={w.passedFirstTime} styles={{ content: {  fontSize: 14, color: '#10b981'  } }} /></Col>
                  <Col span={4}><Statistic title="驳回" value={w.rejectedCount} styles={{ content: {  fontSize: 14, color: '#dc2626'  } }} /></Col>
                  <Col span={4}><Statistic title="均分" value={w.averageScore} styles={{ content: {  fontSize: 14, color: '#3b82f6'  } }} /></Col>
                  <Col span={4}><Statistic title="按时率" value={`${w.onTimeRate}%`} styles={{ content: {  fontSize: 14, color: '#10b981'  } }} /></Col>
                  <Col span={4}><Statistic title="阻塞率" value={`${w.blockerRate}%`} styles={{ content: {  fontSize: 14, color: w.blockerRate > 5 ? '#dc2626' : '#10b981'  } }} /></Col>
                </Row>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  const renderPrior = () => (
    <div data-testid="final-checklist-prior" role="region" aria-label="既往报告对比">
      {!prior ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无既往同部位报告" /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Card size="small" title={
            <Space>
              <GitCompareArrows size={14} />
              <span>与 {prior.priorReportId} 对比</span>
              <Tag color={prior.modalityMatch ? 'green' : 'red'}>{prior.modalityMatch ? '同模态' : '不同模态'}</Tag>
              <Tag color={prior.bodyPartMatch ? 'green' : 'red'}>{prior.bodyPartMatch ? '同部位' : '不同部位'}</Tag>
              <Tag color={prior.overallChange === 'worsened' ? 'red' : prior.overallChange === 'improved' ? 'green' : 'blue'}>{prior.overallChange}</Tag>
            </Space>
          }>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="旧片日期">{prior.priorStudyDate}</Descriptions.Item>
              <Descriptions.Item label="间隔天数">{prior.daysSince} 天</Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '8px 0' }} />
            <strong>AI 摘要:</strong>
            <div style={{ fontSize: 12, padding: 8, background: 'var(--color-info-bg)', borderRadius: 4, marginTop: 4 }}>{prior.aiSummary}</div>
            {prior.recommendedAction && (
              <Alert type="info" showIcon style={{ marginTop: 8 }} title="建议" description={prior.recommendedAction} />
            )}
          </Card>
          <Card size="small" title="对比明细">
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
                      <span style={{ color: 'var(--text-muted)' }}>现:</span> <span style={{ color: 'var(--color-info)' }}>{f.currentValue}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                      <span style={{ color: 'var(--text-muted)' }}>旧:</span> <span style={{ color: 'var(--color-warning)' }}>{f.priorValue}</span>
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
    <div data-testid="final-checklist-multisig" role="region" aria-label="多签">
      <Space style={{ marginBottom: 8 }}>
        <Button type="primary" size="small" icon={<Award size={12} />} onClick={() => setMsOpen(true)}>发起多签</Button>
      </Space>
      {multiSigs.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无多签任务" /> : (
        <List
          dataSource={multiSigs}
          renderItem={(m) => (
            <List.Item key={m.id} style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border-color)' }}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Tag color="purple">{m.id}</Tag>
                  <Tag color={m.trigger === 'critical' ? 'red' : m.trigger === 'special' ? 'purple' : 'blue'}>{m.trigger}</Tag>
                  <Tag color={m.status === 'completed' ? 'green' : m.status === 'in-progress' ? 'blue' : 'default'}>{m.status}</Tag>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>截止 {fmtTime(m.expiresAt)}</span>
                </Space>
                <div style={{ fontSize: 12 }}>📝 {m.reason}</div>
                <Timeline style={{ marginTop: 8 }}>
                  {m.slots.map((s) => (
                    <Timeline.Item key={s.id} color={s.status === 'signed' ? 'green' : s.status === 'rejected' ? 'red' : 'gray'} dot={
                      s.status === 'signed' ? <CheckCircle2 size={14} /> : s.status === 'rejected' ? <XCircle size={14} /> : <Clock size={14} />
                    }>
                      <Space>
                        <Tag color="blue">#{s.order} {s.role}</Tag>
                        {s.required && <Tag color="red">必签</Tag>}
                        {s.signerName ? <strong>{s.signerName}</strong> : <span style={{ color: 'var(--text-muted)' }}>待签</span>}
                        {s.signedAt && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(s.signedAt)}</span>}
                        {s.certificateId && <Tag color="cyan">{s.certificateId}</Tag>}
                        {s.status === 'pending' && <Button size="small" type="primary" onClick={() => handleSignSlot(m, s.id)}>签</Button>}
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
    <div data-testid="final-checklist-emergency" role="region" aria-label="急诊审核通道">
      <Space style={{ marginBottom: 8 }}>
        <Button danger size="small" icon={<Phone size={12} />} onClick={() => setEmOpen(true)}>触发急诊通道</Button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>触发将走真实急诊通道端点并模拟通知</span>
      </Space>
      {/* [G005 Wave3A P2] 通道配置卡 */}
      {emConfig && (
        <Card size="small" style={{ marginBottom: 12 }} title={
          <Space><Settings2 size={14} /><span>急诊通道配置</span><Tag color="purple">emergency-channel/config</Tag></Space>
        } extra={
          <Button type="primary" size="small" loading={emConfigSaving} onClick={handleSaveChannelConfig}>保存配置</Button>
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
                    options={[1, 2, 3, 4, 5, 6].map((p) => ({ value: p, label: `优先${p}` }))}
                    aria-label={`${c.type} 优先级`}
                  />
                  <Input
                    size="small"
                    style={{ width: 130 }}
                    value={c.targetRole}
                    onChange={(e) => updateChannelConfig(c.type, { targetRole: e.target.value })}
                    placeholder="目标角色"
                    aria-label={`${c.type} 目标角色`}
                  />
                </div>
              </Col>
            ))}
          </Row>
          <Divider style={{ margin: '10px 0' }} />
          <Space align="start" wrap>
            <Space>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>自动触发</span>
              <Switch size="small" checked={emConfig.autoTrigger.enabled} onChange={(v) => setEmConfig((prev) => (prev ? { ...prev, autoTrigger: { ...prev.autoTrigger, enabled: v } } : prev))} />
            </Space>
            <Input.TextArea
              rows={2}
              style={{ width: 320 }}
              value={emConfig.autoTrigger.keywords.join('\n')}
              onChange={(e) => setEmConfig((prev) => (prev ? { ...prev, autoTrigger: { ...prev.autoTrigger, keywords: e.target.value.split('\n').map((k) => k.trim()).filter(Boolean) } } : prev))}
              placeholder="自动触发关键词 (每行一个)"
              aria-label="自动触发关键词"
            />
          </Space>
        </Card>
      )}
      {/* [G005 Wave3A P2] 触发记录列表 (按患者查历史) */}
      <Card size="small" title={
        <Space><Activity size={14} /><span>触发记录</span><Tag color="purple">emergency-channel/records</Tag></Space>
      } extra={
        <Space>
          <Input
            size="small"
            prefix={<Search size={12} />}
            placeholder="按患者ID查历史"
            value={emPatientFilter}
            onChange={(e) => setEmPatientFilter(e.target.value)}
            onPressEnter={() => void loadEmRecords(emPatientFilter.trim())}
            style={{ width: 180 }}
            allowClear
          />
          <Button size="small" onClick={() => void loadEmRecords(emPatientFilter.trim())}>查询</Button>
        </Space>
      }>
        {emRecords.length === 0 ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无触发记录" /> : (
          <List
            size="small"
            dataSource={emRecords}
            renderItem={(r) => (
              <List.Item key={r.id} style={{ padding: '8px 4px', borderBottom: '1px solid var(--border-light)' }}>
                <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color={r.status === 'completed' ? 'green' : r.status === 'acknowledged' ? 'blue' : 'orange'}>{r.status}</Tag>
                    <Tag>{r.id}</Tag>
                    <strong style={{ fontSize: 12 }}>{r.patientName || r.patientId}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtTime(r.triggeredAt)} · {r.triggeredBy}</span>
                  </Space>
                  <div style={{ fontSize: 12 }}>📝 {r.reason}</div>
                  <Space wrap>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>通道:</span>
                    {(r.channels ?? []).map((c) => <Tag key={c} color={CHANNEL_META[c].color}>{CHANNEL_META[c].label}</Tag>)}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>通知 {(r.notifications ?? []).length} 次 (模拟)</span>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
      {emergencies.length > 0 && (
        <Card size="small" title={<Space><Bell size={14} /><span>急诊审核任务</span></Space>} style={{ marginTop: 12 }}>
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
                  <Tag color={e.severity === 'life-threatening' ? 'red' : e.severity === 'critical' ? 'volcano' : 'orange'}>{e.severity}</Tag>
                  <Tag color={e.status === 'completed' ? 'green' : e.status === 'in-review' ? 'blue' : 'default'}>{e.status}</Tag>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtTime(e.triggeredAt)} · SLA {e.slaMinutes}min</span>
                </Space>
                <div style={{ fontSize: 12 }}>{e.description}</div>
                <Space wrap>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>通道:</span>
                  {(e.channels ?? []).map((c) => <Tag key={c} color={CHANNEL_META[c].color}>{CHANNEL_META[c].label}</Tag>)}
                </Space>
                <Space wrap>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>目标:</span>
                  {e.targets.map((t) => (
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
    <div data-testid="final-checklist-workflow" role="region" aria-label="工作流配置">
      {!config ? <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无工作流配置" /> : (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Card size="small" title={
            <Space>
              <Settings2 size={14} />
              <strong>{config.name}</strong>
              <Tag color="purple">{config.version}</Tag>
              {config.isDefault && <Tag color="blue">默认</Tag>}
            </Space>
          } extra={
            <Switch
              checked={config.enabled}
              checkedChildren="启用"
              unCheckedChildren="停用"
              onChange={async (v) => {
                const updated = await finalCheckService.updateConfig(config.id, { enabled: v }, 'D001');
                setConfig(updated);
                message.success(v ? '已启用' : '已停用');
              }}
            />
          }>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="默认评分细则">{config.defaultRubricId}</Descriptions.Item>
              <Descriptions.Item label="多签">{config.multiSignatureRequired ? '启用' : '关闭'}</Descriptions.Item>
              <Descriptions.Item label="急诊通道">{config.emergencyChannelEnabled ? '启用' : '关闭'}</Descriptions.Item>
              <Descriptions.Item label="驳回路径">{config.rejectTargets.length} 种</Descriptions.Item>
              <Descriptions.Item label="通过阈值">{config.passingThreshold}</Descriptions.Item>
              <Descriptions.Item label="阻塞阈值">{config.blockingThreshold}</Descriptions.Item>
              <Descriptions.Item label="阻塞自动升级">{config.autoEscalateOnBlocker ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="驳回通知">{config.notifyOnReject ? '是' : '否'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" title="工作流阶段">
            <Timeline>
              {config.stages.sort((a, b) => a.order - b.order).map((s) => (
                <Timeline.Item key={s.id} color={s.required ? 'red' : 'blue'} dot={<div style={{ background: s.required ? '#dc2626' : '#3b82f6', color: '#fff', borderRadius: 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.order}</div>}>
                  <Space>
                    <strong>{s.name}</strong>
                    <Tag>{s.code}</Tag>
                    {s.required && <Tag color="red">必走</Tag>}
                    {s.skippable && <Tag color="orange">可跳过</Tag>}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>SLA {s.slaMinutes} 分钟</span>
                  </Space>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>准入: {s.rolesAllowed.join(' / ')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>出口: {s.exitCriteria.join(' · ')}</div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
          <Card size="small" title="驳回路径">
            {config.rejectTargets.map((t) => (
              <Alert
                key={t}
                type="info"
                showIcon
                style={{ marginBottom: 4 }}
                title={REJECT_TARGET_META[t].label}
                description={REJECT_TARGET_META[t].description}
              />
            ))}
          </Card>
        </Space>
      )}
    </div>
  );

  return (
    <div data-testid="final-check-list" role="region" aria-label="终核清单">
      <div style={{ background: 'linear-gradient(135deg, #7c2d12 0%, #be185d 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            <ShieldCheck size={18} />
            <strong style={{ fontSize: 16 }}>终核清单</strong>
            <Tag color="purple">R3.REVIEW.201+</Tag>
            <Tag color="cyan">80 P</Tag>
          </Space>
          <Space>
            <Input
              size="small"
              prefix={<Search size={12} />}
              placeholder="搜索报告/任务"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={load}
              style={{ width: 180 }}
              aria-label="搜索终核任务"
            />
            <Button size="small" onClick={load}>刷新</Button>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>清单总数</span>} value={stats.total} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<FileText size={14} />} /></Col>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>进行中</span>} value={stats.inProgress} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Activity size={14} />} /></Col>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>已完成</span>} value={stats.completed} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<CheckCircle2 size={14} />} /></Col>
          <Col span={5}><Statistic title={<span style={{ color: '#fff' }}>阻塞</span>} value={stats.blocked} styles={{ content: {  color: '#fca5a5', fontSize: 18  } }} prefix={<AlertTriangle size={14} />} /></Col>
          <Col span={4}><Statistic title={<span style={{ color: '#fff' }}>平均分</span>} value={stats.avgScore} styles={{ content: {  color: '#fff', fontSize: 18  } }} prefix={<Award size={14} />} /></Col>
        </Row>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, marginBottom: 8, border: '1px solid var(--border-color)' }}>
        <Space wrap>
          <Select size="small" value={filter.status || 'all'} onChange={(v) => setFilter({ ...filter, status: v })} style={{ width: 110 }} options={[
            { value: 'all', label: '全部状态' },
            { value: 'pending', label: '待审' },
            { value: 'in-progress', label: '审核中' },
            { value: 'completed', label: '已完成' },
          ]} aria-label="状态筛" />
          <Select size="small" value={filter.priority || 'all'} onChange={(v) => setFilter({ ...filter, priority: v })} style={{ width: 110 }} options={[
            { value: 'all', label: '全部优先' },
            { value: 'stat', label: '急诊' },
            { value: 'critical', label: '危急' },
            { value: 'urgent', label: '加急' },
            { value: 'routine', label: '常规' },
          ]} aria-label="优先级筛" />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>显示 {tasks.length} · 清单 {lists.length}</span>
        </Space>
      </div>

      <Row gutter={12}>
        <Col span={8} style={{ maxHeight: 600, overflowY: 'auto' }}>
          <List
            loading={loading}
            dataSource={tasks}
            locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="无终核任务" /> }}
            style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 4 }}
            renderItem={(t) => {
              const priConf = PRIORITY_META[t.priority] ?? PRIORITY_META.routine!;
              const list = lists.find((l) => l.taskId === t.id);
              return (
                <List.Item
                  key={t.id}
                  onClick={() => onSelect?.(t)}
                  style={{
                    cursor: 'pointer', padding: '10px 12px', borderRadius: 6, marginBottom: 4,
                    background: t.id === selectedId ? 'var(--color-pending-bg)' : t.isOverdue ? 'var(--color-error-bg)' : 'transparent',
                    borderLeft: t.id === selectedId ? '3px solid #7c3aed' : t.isOverdue ? '3px solid #dc2626' : '3px solid transparent',
                  }}
                  data-testid={`final-check-item-${t.id}`}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: t.criticalFinding ? 'var(--color-error-bg)' : 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {t.criticalFinding ? <AlertTriangle size={18} color="#dc2626" /> : <ShieldCheck size={18} color="#7c3aed" />}
                      </div>
                    }
                    title={
                      <Space wrap>
                        <span style={{ fontWeight: 600 }}>{t.patientName}</span>
                        <Tag color="blue">{t.modality}</Tag>
                        <Tag>{t.bodyPart}</Tag>
                        <Tag color={priConf.color}>{priConf.label}</Tag>
                        {t.needsCosign && <Tag color="purple">需双签</Tag>}
                        {list && <Tag color={list.summary.isPublishable ? 'green' : list.summary.blockers > 0 ? 'red' : 'orange'}>{list.summary.percentage}%</Tag>}
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <User size={10} /> {t.authorTitle} {t.authorName} · 初评 <strong>{t.initialReviewScore ?? '-'}</strong>
                        <div style={{ fontSize: 12, color: t.isOverdue ? '#dc2626' : 'var(--text-muted)' }}>
                          <Clock size={10} /> {t.isOverdue ? `超时 ${Math.abs(t.hoursToDeadline)}h` : `${t.hoursToDeadline}h`} · 提交 {timeAgo(t.submittedAt)}
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
            <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="请选择左侧任务" style={{ marginTop: 80 }} />
          ) : (
            <Card
              size="small"
              title={
                <Space>
                  <ListChecks size={14} />
                  <span>{activeList.reportId} · 终核清单</span>
                  <Tag color={activeList.status === 'completed' ? 'green' : activeList.status === 'aborted' ? 'red' : 'blue'}>{activeList.status}</Tag>
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" icon={<GitCompareArrows size={12} />} onClick={() => setTab('prior')}>既往</Button>
                  <Button size="small" icon={<MessageSquare size={12} />} onClick={() => setTab('notes')}>笔记</Button>
                  <Popconfirm
                    title="驳回该报告"
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
                          placeholder={`请输入${rejectTarget === 'direct-to-draft' ? '直接退回' : '退回'}原因 (≥5字)`}
                        />
                      </Space>
                    }
                    onConfirm={handleReject}
                    okText="确认驳回"
                    cancelText="取消"
                    okButtonProps={{ disabled: rejectReason.trim().length < 5 }}
                  >
                    <Button danger size="small" icon={<RotateCcw size={12} />}>驳回</Button>
                  </Popconfirm>
                  <Button type="primary" size="small" icon={<CheckCircle2 size={12} />} onClick={handleComplete} disabled={activeList.status === 'completed' || summary?.blockers! > 0}>完成终核</Button>
                </Space>
              }
            >
              {summary && (
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col span={4}><Statistic title="通过" value={summary.passed} styles={{ content: {  fontSize: 14, color: '#10b981'  } }} prefix={<CheckCircle2 size={12} />} /></Col>
                  <Col span={4}><Statistic title="失败" value={summary.failed} styles={{ content: {  fontSize: 14, color: '#dc2626'  } }} prefix={<XCircle size={12} />} /></Col>
                  <Col span={4}><Statistic title="警告" value={summary.warning} styles={{ content: {  fontSize: 14, color: '#f59e0b'  } }} prefix={<AlertTriangle size={12} />} /></Col>
                  <Col span={4}><Statistic title="得分" value={summary.percentage} suffix="%" styles={{ content: {  fontSize: 14, color: '#3b82f6'  } }} prefix={<Award size={12} />} /></Col>
                  <Col span={4}><Statistic title="等级" value={summary.grade} styles={{ content: {  fontSize: 14, color: '#7c3aed'  } }} prefix={<ShieldCheck size={12} />} /></Col>
                  <Col span={4}><Statistic title="阻塞" value={summary.blockers} styles={{ content: {  fontSize: 14, color: summary.blockers > 0 ? '#dc2626' : '#10b981'  } }} prefix={<CircleSlash size={12} />} /></Col>
                </Row>
              )}
              <Tabs
                size="small"
                activeKey={tab}
                onChange={(k) => setTab(k as typeof tab)}
                items={[
                  { key: 'checklist', label: <span><ClipboardCheck size={12} /> 检查项 {checklist.length}</span>, children: renderChecklist() },
                  { key: 'consistency', label: <span><Stethoscope size={12} /> 一致性</span>, children: renderConsistency() },
                  { key: 'scoring', label: <span><Award size={12} /> 终评</span>, children: renderScoring() },
                  { key: 'notes', label: <span><MessageSquare size={12} /> 笔记 {notes.length}</span>, children: renderNotes() },
                  { key: 'workload', label: <span><BarChart3 size={12} /> 工作量</span>, children: renderWorkload() },
                  { key: 'prior', label: <span><GitCompareArrows size={12} /> 既往</span>, children: renderPrior() },
                  { key: 'multisig', label: <span><Award size={12} /> 多签 {multiSigs.length}</span>, children: renderMultiSig() },
                  { key: 'emergency', label: <span><Phone size={12} /> 急诊 {emergencies.length}</span>, children: renderEmergency() },
                  { key: 'workflow', label: <span><Settings2 size={12} /> 工作流</span>, children: renderWorkflow() },
                ]}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="添加终审笔记"
        open={noteOpen}
        onCancel={() => setNoteOpen(false)}
        onOk={handleAddNote}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={noteForm} layout="vertical" initialValues={{ type: 'comment', visibility: 'team', pinned: false }}>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'comment', label: '评论' },
              { value: 'suggestion', label: '建议' },
              { value: 'instruction', label: '指示' },
              { value: 'warning', label: '警告' },
              { value: 'directive', label: '指令' },
            ]} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, min: 5, message: '至少 5 字符' }]}>
            <Input.TextArea rows={4} placeholder="请输入终审笔记内容" />
          </Form.Item>
          <Form.Item name="visibility" label="可见性">
            <Select options={[
              { value: 'private', label: '仅自己' },
              { value: 'team', label: '团队' },
              { value: 'department', label: '科室' },
              { value: 'all', label: '全员' },
            ]} />
          </Form.Item>
          <Form.Item name="pinned" label="置顶" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="触发急诊审核通道"
        open={emOpen}
        onCancel={() => setEmOpen(false)}
        onOk={handleTriggerEmergency}
        okText="触发"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <Form form={emForm} layout="vertical" initialValues={{ trigger: 'critical-finding', severity: 'critical', channels: ['sms', 'in-app', 'phone'] }}>
          <Form.Item name="trigger" label="触发原因" rules={[{ required: true }]}>
            <Select options={[
              { value: 'critical-finding', label: '危急值' },
              { value: 'stat-imaging', label: '急诊影像' },
              { value: 'icu-request', label: 'ICU 请求' },
              { value: 'er-request', label: '急诊科请求' },
              { value: 'manual', label: '人工触发' },
            ]} />
          </Form.Item>
          <Form.Item name="severity" label="严重程度" rules={[{ required: true }]}>
            <Select options={[
              { value: 'urgent', label: '紧急' },
              { value: 'critical', label: '严重' },
              { value: 'life-threatening', label: '危及生命' },
            ]} />
          </Form.Item>
          <Form.Item name="channels" label="通知通道" rules={[{ required: true }]}>
            <Select mode="multiple" options={Object.entries(CHANNEL_META).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, min: 10 }]}>
            <Input.TextArea rows={3} placeholder="请描述急诊审核背景" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发起多签"
        open={msOpen}
        onCancel={() => setMsOpen(false)}
        onOk={handleRequestMultiSig}
        okText="发起"
        cancelText="取消"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="原因">
            <Input.TextArea rows={3} value={msReason} onChange={(e) => setMsReason(e.target.value)} placeholder="请输入多签原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FinalCheckList;

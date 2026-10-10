import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Save, CheckCircle, RotateCcw, BellRing, Loader2, AlertTriangle, Eye, Plus, Bell, UserX, Ban, LayoutTemplate, Pencil, Play, X, Calendar, FileText } from 'lucide-react';
import { followupApi, FOLLOWUP_RESULT_OPTIONS, type FollowUpPlan, type FollowUpStats, type FollowUpReminderQueue, type FollowUpResult } from '../services/api/followupApi';
import { DataTable } from '../components/common/DataTable';
import { Select } from 'antd';
import { followupTemplatesApi, type FollowUpTemplate } from '../services/api/followupTemplatesApi';
import { reportApi } from '../services/api/reportApi';
import { worklistApi } from '../services/api/worklistApi';
import { t } from '../i18n/appI18n';

interface FollowUpPatient {
  id: string;
  patientId: string;
  patientName: string;
  examType?: string;
  examDate: string;
  followUpType?: string;
  nextFollowUpDate: string;
  status: string;
  reaction?: '无反应' | '轻度' | '中度' | '重度';
  notes?: string;
  reminderEnabled?: boolean;
  intervalDays?: number;
  templateId?: string;
  examId?: string;
  reason?: string;
  // [v3.0.6.11-104 Wave 3D] 结构化随访结果
  result?: FollowUpResult;
  outcome?: string;
}

// [v3.0.6.11-99 Wave3B] 状态机全枚举 → 页面中文状态 (计划/已提醒/进行中/已完成/已失访/已取消/逾期)
const STATUS_MAP: Record<string, string> = {
  PENDING: '待随访',
  REMINDED: '已提醒',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  MISSED: '已失访',
  CANCELLED: '已取消',
  OVERDUE: '逾期',
};

const TERMINAL_STATUS = new Set(['已完成', '已失访', '已取消']);

// [v3.0.6.11-99 Wave3B] 演示回退种子 (列表接口不可用时兜底, 标注徽标)
const DEMO_FALLBACK_PLANS: Array<Partial<FollowUpPlan>> = [
  { id: 'demo-fu-1', patientId: 'P202400001', patientName: '李四', planDate: '2026-08-01', nextDate: '2026-08-31', status: 'PENDING', note: '演示数据: 肺癌术后复查', reminderEnabled: true, intervalDays: 30, completedAt: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'demo-fu-2', patientId: 'P202400002', patientName: '王五', planDate: '2026-07-01', nextDate: '2026-07-30', status: 'OVERDUE', note: '演示数据: 肺结节随访(逾期)', reminderEnabled: true, intervalDays: 30, completedAt: null, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' },
  { id: 'demo-fu-3', patientId: 'P202400003', patientName: '赵六', planDate: '2026-06-01', nextDate: '2026-08-31', status: 'COMPLETED', note: '演示数据: 肝癌介入随访', reminderEnabled: true, intervalDays: 90, completedAt: '2026-08-05T00:00:00Z', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-08-05T00:00:00Z' },
];

// [W4-B] 后端 FollowUpPlan → 页面行记录 (examType/followUpType 后端未持久化, 渲染 '—')
const mapPlan = (p: FollowUpPlan): FollowUpPatient => ({
  id: p.id,
  patientId: p.patientId,
  patientName: p.patientName,
  examDate: (p.planDate ?? '').slice(0, 10),
  nextFollowUpDate: (p.nextDate ?? '').slice(0, 10),
  status: STATUS_MAP[p.status] ?? '待随访',
  notes: p.note || undefined,
  reminderEnabled: p.reminderEnabled,
  intervalDays: p.intervalDays,
  templateId: p.templateId,
  examId: p.examId,
  reason: p.reason,
});

export default function FollowUpPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'overdue' | 'reminded' | 'inprogress' | 'completed' | 'missed' | 'cancelled'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<FollowUpPatient | null>(null);
  const [showModal, setShowModal] = useState(false);
  // [v3.0.6.11-104 Wave 3D] 随访完成前录入结构化结果
  const [resultModal, setResultModal] = useState<{ id: string; name: string } | null>(null);
  const [resultForm, setResultForm] = useState<{ result: FollowUpResult; outcome: string }>({ result: 'stable', outcome: '' });
  const [resultBusy, setResultBusy] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // [v3.0.6.11-99 Wave10B] 视图切换: list=列表 / calendar=日历 / grouped=按患者分组
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'grouped'>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  // [v3.0.6.11-99 Wave10B] 分组展开状态
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  // [W4-B] 真实 API 数据 (列表/到期提醒/loading/error)
  const [followUpList, setFollowUpList] = useState<FollowUpPatient[]>([]);
  const [dueList, setDueList] = useState<FollowUpPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // [v3.0.6.11-99 Wave3B] 数据源徽标: real=接口真实 / demo=演示回退
  const [dataSource, setDataSource] = useState<'real' | 'demo'>('real');
  // [v3.0.6.11-99 Wave3B] 统计 (GET /followups/stats, 失败回退本地派生)
  const [stats, setStats] = useState<FollowUpStats | null>(null);

  // [v3.0.6.11-103 Wave 1B] 报告→随访触发模式 (GET /followup-trigger-rules/mode)
  const [triggerMode, setTriggerMode] = useState<'auto' | 'hint' | null>(null);

  // [v3.0.6.11-103 Wave 1B] 检查联动 (POST /followups/from-exam): 检查完成 → 自动创建随访计划
  const [showFromExamModal, setShowFromExamModal] = useState(false);
  const [fromExamForm, setFromExamForm] = useState({ examId: '', templateId: '' });
  const [fromExamTemplates, setFromExamTemplates] = useState<FollowUpTemplate[]>([]);
  const [fromExamBusy, setFromExamBusy] = useState(false);

  // [v3.0.6.11-104 Wave 2C] 随访催办队列 (GET /followups/reminder-queue): 逾期/今日到期/未来 N 天
  const [reminderQueue, setReminderQueue] = useState<FollowUpReminderQueue | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  // [v3.0.6.11-104 Wave 2C] 报告→随访 (POST /followups/from-report): 关键词规则手动补建
  const [showFromReportModal, setShowFromReportModal] = useState(false);
  const [fromReportForm, setFromReportForm] = useState({ reportId: '', reason: '' });
  const [fromReportBusy, setFromReportBusy] = useState(false);

  // [v3.0.6.11-103 Wave 1B] 编辑随访计划 (PUT /followups/:id)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPlan, setEditPlan] = useState<FollowUpPatient | null>(null);
  const [editForm, setEditForm] = useState({ patientName: '', planDate: '', intervalDays: 30, note: '', reminderEnabled: true });
  const [editBusy, setEditBusy] = useState(false);

  const loadFollowUps = async (): Promise<boolean> => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await followupApi.list({ search: searchKeyword || undefined });
      if (res.success) {
        setFollowUpList(res.data.data.map(mapPlan));
        setDataSource('real');
        return true;
      } else {
        throw new Error(res.error?.message ?? t('followUp.loadFailed'));
      }
    } catch (err) {
      // [v3.0.6.11-99 Wave3B] 演示回退: 接口不可用 → 内置种子 + 徽标
      setFollowUpList(DEMO_FALLBACK_PLANS.map(p => mapPlan(p as FollowUpPlan)));
      setDataSource('demo');
      setLoadError(`随访服务暂不可用，当前展示演示数据 (${(err as Error)?.message ?? '网络错误'})`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFollowUps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void loadFollowUps(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword]);

  useEffect(() => {
    let cancelled = false;
    followupApi.due(7).then(res => {
      if (cancelled) return;
      if (res.success) setDueList(res.data?.items ?? []);
    }).catch(() => { /* 到期提醒失败不阻塞页面 */ });
    return () => { cancelled = true; };
  }, [followUpList.length]);

  // [v3.0.6.11-99 Wave3B] 统计卡: GET /followups/stats, 失败回退本地派生 (徽标已由列表加载状态体现)
  useEffect(() => {
    let cancelled = false;
    followupApi.getStats().then(res => {
      if (cancelled) return;
      if (res.success && res.data) setStats(res.data as FollowUpStats);
    }).catch(() => { /* 统计失败回退本地 */ });
    return () => { cancelled = true; };
  }, [followUpList.length, followUpList]);

  // [v3.0.6.11-103 Wave 1B] 报告→随访触发模式: GET /followup-trigger-rules/mode (auto/hint)
  useEffect(() => {
    let cancelled = false;
    followupApi.getTriggerMode().then(res => {
      if (cancelled || !res.success || !res.data) return;
      if (res.data.mode === 'auto' || res.data.mode === 'hint') setTriggerMode(res.data.mode);
    }).catch(() => { /* 触发模式不可用不阻塞 */ });
    return () => { cancelled = true; };
  }, []);

  // [v3.0.6.11-103 Wave 1B] 检查联动: 打开弹窗时加载模板列表 (POST /followups/from-exam)
  const openFromExam = async () => {
    setFromExamForm({ examId: '', templateId: '' });
    setShowFromExamModal(true);
    setFromExamTemplates([]);
    try {
      const res = await followupTemplatesApi.list();
      if (res.success) setFromExamTemplates(res.data.data);
    } catch { /* 模板不可用允许空 */ }
  };

  const handleFromExam = async () => {
    if (!fromExamForm.examId.trim()) {
      setLoadError(t('followUp.fillExamId'));
      return;
    }
    setFromExamBusy(true);
    setLoadError(null);
    try {
      const res = await followupApi.fromExam(fromExamForm.examId.trim(), fromExamForm.templateId || undefined);
      if (res.success && res.data) {
        window.alert(t('w9b.followUp.examLinkSuccess', { count: String((res.data as any)?.total ?? 0) }));
        setShowFromExamModal(false);
        void loadFollowUps();
      } else {
        setLoadError(res.error?.message ?? t('followUp.examLinkFail'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.examLinkFail'));
    } finally {
      setFromExamBusy(false);
    }
  };

  // [v3.0.6.11-104 Wave 2C] 催办队列加载: GET /followups/reminder-queue?days=7
  const loadReminderQueue = async () => {
    setReminderLoading(true);
    setReminderError(null);
    try {
      const res = await followupApi.reminderQueue(7);
      if (res.success && res.data) setReminderQueue(res.data);
      else setReminderError(res.error?.message ?? t('followup.reminderQueue.loadFailed'));
    } catch (err) {
      setReminderError((err as Error)?.message ?? t('followup.reminderQueue.loadFailed'));
    } finally {
      setReminderLoading(false);
    }
  };

  useEffect(() => {
    void loadReminderQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUpList.length]);

  // [v3.0.6.11-104 Wave 2C] 报告→随访入口 + 提交 (POST /followups/from-report)
  const openFromReport = () => {
    setFromReportForm({ reportId: '', reason: '' });
    setShowFromReportModal(true);
  };

  const handleFromReport = async () => {
    if (!fromReportForm.reportId.trim()) {
      setLoadError(t('followup.fromReport.required'));
      return;
    }
    setFromReportBusy(true);
    setLoadError(null);
    try {
      const res = await followupApi.fromReport(fromReportForm.reportId.trim(), fromReportForm.reason.trim() || undefined);
      if (res.success && res.data) {
        const d = res.data;
        window.alert(t('followup.fromReport.success', { created: d.created, matched: d.matched.join('、') || '—' }));
        setShowFromReportModal(false);
        void loadFollowUps();
        void loadReminderQueue();
      } else {
        setLoadError(res.error?.message ?? t('followup.fromReport.failed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followup.fromReport.failed'));
    } finally {
      setFromReportBusy(false);
    }
  };

  // [v3.0.6.11-104 Wave 2C] 催办队列按分组拆分 (逾期/今日到期/未来)
  const reminderGroups = useMemo(() => {
    const items = reminderQueue?.items ?? [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    const overdue: FollowUpPlan[] = []; const dueToday: FollowUpPlan[] = []; const upcoming: FollowUpPlan[] = [];
    for (const p of items) {
      const ts = new Date(p.nextDate).getTime();
      if (ts < todayStart.getTime()) overdue.push(p);
      else if (ts < todayEnd.getTime()) dueToday.push(p);
      else upcoming.push(p);
    }
    return { overdue, dueToday, upcoming };
  }, [reminderQueue]);

  // [v3.0.6.11-103 Wave 1B] 编辑随访计划 (PUT /followups/:id)
  const openEditPlan = (item: FollowUpPatient) => {
    setEditPlan(item);
    setEditForm({
      patientName: item.patientName,
      planDate: (item.examDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
      intervalDays: item.intervalDays ?? 30,
      note: item.notes ?? '',
      reminderEnabled: item.reminderEnabled ?? true,
    });
    setShowEditModal(true);
  };

  const handleEditPlan = async () => {
    if (!editPlan) return;
    if (!editForm.patientName.trim() || !editForm.planDate) {
      setLoadError(t('followUp.fillPatientInfo'));
      return;
    }
    setEditBusy(true);
    setLoadError(null);
    try {
      const res = await followupApi.update(editPlan.id, {
        patientName: editForm.patientName.trim(),
        planDate: editForm.planDate,
        intervalDays: Number(editForm.intervalDays) || 30,
        note: editForm.note,
        reminderEnabled: editForm.reminderEnabled,
      });
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === editPlan.id ? {
          ...p,
          patientName: editForm.patientName.trim(),
          examDate: editForm.planDate,
          notes: editForm.note || undefined,
          intervalDays: Number(editForm.intervalDays) || 30,
          reminderEnabled: editForm.reminderEnabled,
        } : p));
        setShowEditModal(false);
        setEditPlan(null);
        void loadFollowUps();
      } else {
        setLoadError(res.error?.message ?? t('followUp.saveFailed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.saveFailed'));
    } finally {
      setEditBusy(false);
    }
  };

  // [v3.0.6.11-99 Wave3B] 模板库 Modal 状态
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<FollowUpTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);
  const [tplForm, setTplForm] = useState<{ id?: string; name: string; category: string; intervals: string; items: string; active: boolean }>({
    name: '', category: '病种', intervals: '30,90,180', items: '', active: true,
  });
  const [tplEditing, setTplEditing] = useState(false);
  const [tplApply, setTplApply] = useState<FollowUpTemplate | null>(null);
  const [tplApplyForm, setTplApplyForm] = useState({ patientId: '', patientName: '', planDate: new Date().toISOString().slice(0, 10) });

  const loadTemplates = async () => {
    setTplLoading(true);
    setTplError(null);
    try {
      const res = await followupTemplatesApi.list();
      if (res.success) setTemplates(res.data.data);
      else setTplError(res.error?.message ?? t('followUp.templateLoadFailed'));
    } catch (err) {
      setTplError((err as Error)?.message ?? t('followUp.templateLoadFailed'));
    } finally {
      setTplLoading(false);
    }
  };

  const openTemplates = () => {
    setShowTemplateModal(true);
    void loadTemplates();
  };

  // [v3.0.6.11-99 Wave3B] 检查联动入口: /follow-up?examId=.. (Worklist 检查详情"创建随访计划")
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const examId = q.get('examId');
    const reportId = q.get('reportId');
    if (!examId || reportId) return;
    let cancelled = false;
    worklistApi.getById(examId).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const e = res.data as any;
      const patientId = String(e.patientId ?? q.get('patientId') ?? '');
      const patientName = String(e.patient?.name ?? e.patientName ?? '');
      setNewPlan(f => ({
        ...f,
        patientId,
        patientName,
        examId: String(e.id ?? examId),
        planDate: new Date().toISOString().slice(0, 10),
        note: `来源检查: ${String(e.accessionNumber ?? examId)} 创建随访`,
      }));
      if (patientId) setSearchKeyword(patientId);
      setShowCreateModal(true);
    }).catch(() => {
      // 检查加载失败: 仅带入 examId 占位
      if (cancelled) return;
      setNewPlan(f => ({ ...f, examId, planDate: new Date().toISOString().slice(0, 10) }));
      setShowCreateModal(true);
    });
    return () => { cancelled = true; };
  }, []);

  // [v3.0.6.11-92 Wave1B P0] reportId/examId: 报告→随访关联 (报告详情入口带入)
  const [newPlan, setNewPlan] = useState({ patientId: '', patientName: '', planDate: '', intervalDays: 30, note: '', reminderEnabled: true, reportId: undefined as string | undefined, examId: undefined as string | undefined });

  const filteredList = followUpList.filter(item => {
    const keywordMatch = searchKeyword === '' ||
      item.patientName.includes(searchKeyword) ||
      item.patientId.includes(searchKeyword);
    const tabMatch = activeTab === 'all' ||
      (activeTab === 'pending' && item.status === '待随访') ||
      (activeTab === 'overdue' && item.status === '逾期') ||
      (activeTab === 'reminded' && item.status === '已提醒') ||
      (activeTab === 'inprogress' && item.status === '进行中') ||
      (activeTab === 'completed' && item.status === '已完成') ||
      (activeTab === 'missed' && item.status === '已失访') ||
      (activeTab === 'cancelled' && item.status === '已取消');
    return keywordMatch && tabMatch;
  });

  // [v3.0.6.11-99 Wave10B] 患者维度分组 (按 patientId 聚合, 保留全部计划)
  const groupedByPatient = useMemo(() => {
    const groups: Array<{ patientId: string; patientName: string; items: FollowUpPatient[] }> = [];
    const map = new Map<string, FollowUpPatient[]>();
    filteredList.forEach(p => {
      const arr = map.get(p.patientId) || [];
      arr.push(p);
      map.set(p.patientId, arr);
    });
    map.forEach((items, patientId) => {
      groups.push({
        patientId,
        patientName: items[0]?.patientName || patientId,
        items: items.sort((a, b) => String(a.nextFollowUpDate).localeCompare(String(b.nextFollowUpDate))),
      });
    });
    return groups.sort((a, b) => a.patientName.localeCompare(b.patientName, 'zh-CN'));
  }, [filteredList]);

  // [v3.0.6.11-99 Wave10B] 日历视图数据: 按日聚合计划 (状态色点)
  const calendarDays = useMemo(() => {
    const byDay: Record<string, FollowUpPatient[]> = {};
    followUpList.forEach(p => {
      const day = String(p.nextFollowUpDate || p.examDate || '').slice(0, 10);
      if (!day) return;
      const arr = byDay[day] || [];
      arr.push(p);
      byDay[day] = arr;
    });
    return byDay;
  }, [followUpList]);

  const statusDotColor: Record<string, string> = {
    '待随访': '#faad14',
    '已提醒': '#1677ff',
    '进行中': '#1890ff',
    '已完成': '#52c41a',
    '已失访': '#ff4d4f',
    '已取消': '#8c8c8c',
    '逾期': '#ff4d4f',
  };

  // 展开/收起患者分组
  const togglePatient = (patientId: string) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  // [W2-4] 患者详情"随访"入口: /follow-up?patientId=xxx 自动定位该患者
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('patientId');
    if (pid) setSearchKeyword(pid);
  }, []);

  // [v3.0.6.11-92 Wave1B P0] 报告详情"创建随访"入口: /follow-up?patientId=..&reportId=..
  // 解析报告 → 预填创建弹窗 (患者/报告关联)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const reportId = q.get('reportId');
    const pid = q.get('patientId');
    if (!reportId) return;
    let cancelled = false;
    reportApi.getById(reportId).then(async (res) => {
      if (cancelled || !res.success || !res.data) return;
      const r = res.data as any;
      const patientId = String(r.patientId ?? pid ?? '');
      const patientName = String(r.patientName ?? '');
      setNewPlan(f => ({
        ...f,
        patientId,
        patientName,
        reportId: String(r.id ?? reportId),
        examId: r.examId ? String(r.examId) : undefined,
        planDate: new Date().toISOString().slice(0, 10),
        note: `来源报告: ${String(r.reportId ?? r.id ?? reportId)} 创建随访`,
      }));
      if (patientId) setSearchKeyword(patientId);
      setShowCreateModal(true);
    }).catch(() => { /* 报告加载失败不阻塞页面 */ });
    return () => { cancelled = true; };
  }, []);

  // [v3.0.6.11-99 Wave3B] 统计: 优先后端 /followups/stats, 失败回退本地派生
  const localStats = (() => {
    const total = followUpList.length;
    const completed = followUpList.filter(f => f.status === '已完成').length;
    const missed = followUpList.filter(f => f.status === '已失访').length;
    const cancelled = followUpList.filter(f => f.status === '已取消').length;
    const overdue = followUpList.filter(f => f.status === '逾期').length;
    const reminded = followUpList.filter(f => f.status === '已提醒').length;
    const inProgress = followUpList.filter(f => f.status === '进行中').length;
    const pending = followUpList.filter(f => f.status === '待随访').length;
    return {
      total, completed, missed, cancelled, overdue, reminded, inProgress, pending,
      completionRate: total - cancelled > 0 ? Math.round((completed / (total - cancelled)) * 1000) / 10 : 0,
      missRate: total > 0 ? Math.round((missed / total) * 1000) / 10 : 0,
      abnormalRate: total > 0 ? Math.round((overdue / total) * 1000) / 10 : 0,
      byCategory: [], byMonth: [],
    } as FollowUpStats;
  })();
  const displayStats: FollowUpStats = stats ?? localStats;

  const isTerminal = (status: string) => TERMINAL_STATUS.has(status);

  // [W4-B] 完成随访 → POST /followups/:id/complete
  // [v3.0.6.11-104 Wave 3D] + 完成前录入结构化结果 POST /followups/:id/result
  const handleComplete = async (id: string, result?: FollowUpResult, outcome?: string) => {
    try {
      if (result) {
        const rr = await followupApi.recordResult(id, { result, outcome: outcome?.trim() || undefined });
        if (!rr.success) {
          setLoadError(rr.error?.message ?? t('followUp.operationFailed'));
          return;
        }
      }
      const res = await followupApi.complete(id);
      if (res.success) {
        setFollowUpList(list => list.map(item =>
          item.id === id ? { ...item, status: '已完成' as const, result, outcome } : item
        ));
      } else {
        setLoadError(res.error?.message ?? t('followUp.operationFailed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.operationFailed'));
    }
    setShowModal(false);
    setSelectedPatient(null);
  };

  // [v3.0.6.11-104 Wave 3D] 打开随访结果录入弹窗 (完成前录入结果)
  const openResultModal = (id: string, name: string) => {
    setResultForm({ result: 'stable', outcome: '' });
    setResultModal({ id, name });
  };

  const confirmResult = async () => {
    if (!resultModal) return;
    setResultBusy(true);
    try {
      await handleComplete(resultModal.id, resultForm.result, resultForm.outcome);
      setResultModal(null);
      setShowModal(false);
      setSelectedPatient(null);
    } finally {
      setResultBusy(false);
    }
  };

  // [v3.0.6.11-99 Wave3B] 提醒 → POST /followups/:id/remind
  const handleRemind = async (item: FollowUpPatient) => {
    try {
      const res = await followupApi.remind(item.id);
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === item.id ? { ...p, status: '已提醒' as const } : p));
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? t('followUp.remindFailed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.remindFailed'));
    }
  };

  // [v3.0.6.11-99 Wave3B] 失访 → POST /followups/:id/miss {reason}
  const handleMiss = async (item: FollowUpPatient) => {
    const reason = window.prompt(`标记患者「${item.patientName}」失访，请填写失访原因：`, '电话无法接通');
    if (reason === null) return;
    if (!reason.trim()) { setLoadError(t('followUp.fillMissReason')); return; }
    try {
      const res = await followupApi.miss(item.id, reason.trim());
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === item.id ? { ...p, status: '已失访' as const, reason } : p));
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? t('followUp.missFailed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.missFailed'));
    }
  };

  // [v3.0.6.11-99 Wave3B] 取消 → POST /followups/:id/cancel {reason}
  const handleCancel = async (item: FollowUpPatient) => {
    const reason = window.prompt(`取消患者「${item.patientName}」的随访计划，请填写取消原因：`, '患者拒绝随访');
    if (reason === null) return;
    if (!reason.trim()) { setLoadError(t('followUp.fillCancelReason')); return; }
    try {
      const res = await followupApi.cancel(item.id, reason.trim());
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === item.id ? { ...p, status: '已取消' as const, reason } : p));
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? t('followUp.cancelFailed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.cancelFailed'));
    }
  };

  // [v3.0.6.11-99 Wave3B] 开始随访 → POST /followups/:id/in-progress
  const handleStart = async (item: FollowUpPatient) => {
    try {
      const res = await followupApi.markInProgress(item.id);
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === item.id ? { ...p, status: '进行中' as const } : p));
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? t('followUp.operationFailed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.operationFailed'));
    }
  };

  // [W4-B] 删除随访 → DELETE /followups/:id
  const handleDelete = async (item: FollowUpPatient) => {
    if (!window.confirm(t('w9b.followUp.confirmDeletePlan', { name: item.patientName }))) return;
    try {
      const res = await followupApi.remove(item.id);
      if (res.success) {
        setFollowUpList(list => list.filter(p => p.id !== item.id));
      } else {
        setLoadError(res.error?.message ?? t('followUp.deleteFailed'));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.deleteFailed'));
    }
  };

  // [W4-B] 新建随访计划 → POST /followups
  const handleCreate = async () => {
    if (!newPlan.patientId || !newPlan.patientName || !newPlan.planDate) {
      setLoadError(t('followUp.fillPatientFields'));
      return;
    }
    setSaving(true);
    try {
      const res = await followupApi.create({
        patientId: newPlan.patientId,
        patientName: newPlan.patientName,
        reportId: newPlan.reportId,
        examId: newPlan.examId,
        planDate: newPlan.planDate,
        intervalDays: Number(newPlan.intervalDays) || 30,
        note: newPlan.note,
        reminderEnabled: newPlan.reminderEnabled,
      });
      if (res.success && res.data) {
        setFollowUpList(list => [mapPlan(res.data as any), ...list]);
        setShowCreateModal(false);
        setNewPlan({ patientId: '', patientName: '', planDate: '', intervalDays: 30, note: '', reminderEnabled: true, reportId: undefined, examId: undefined });
        setLoadError(null);
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? t('followUp.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  // [v3.0.6.11-99 Wave3B] 模板 CRUD
  const saveTemplate = async () => {
    if (!tplForm.name.trim()) { setTplError(t('followUp.fillTemplateName')); return; }
    const intervals = tplForm.intervals.split(/[,，\s]+/).map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
    if (intervals.length === 0) { setTplError(t('followUp.fillIntervalDays')); return; }
    const items = tplForm.items.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
    setTplLoading(true);
    setTplError(null);
    try {
      if (tplEditing && tplForm.id) {
        const res = await followupTemplatesApi.update(tplForm.id, { name: tplForm.name.trim(), category: tplForm.category, intervals, items, active: tplForm.active });
        if (!res.success) { setTplError(res.error?.message ?? t('followUp.saveFailed')); setTplLoading(false); return; }
      } else {
        const res = await followupTemplatesApi.create({ name: tplForm.name.trim(), category: tplForm.category, intervals, items, active: tplForm.active });
        if (!res.success) { setTplError(res.error?.message ?? t('followUp.saveFailed')); setTplLoading(false); return; }
      }
      setTplForm({ name: '', category: '病种', intervals: '30,90,180', items: '', active: true });
      setTplEditing(false);
      await loadTemplates();
    } catch (err) {
      setTplError((err as Error)?.message ?? t('followUp.saveFailed'));
      setTplLoading(false);
    }
  };

  const editTemplate = (t: FollowUpTemplate) => {
    setTplForm({ id: t.id, name: t.name, category: t.category || '病种', intervals: (t.intervals ?? []).join(','), items: (t.items ?? []).join(','), active: t.active });
    setTplEditing(true);
  };

  const deleteTemplate = async (tpl: FollowUpTemplate) => {
    if (!window.confirm(t('w9b.followUp.confirmDeleteTemplate', { name: tpl.name }))) return;
    try {
      const res = await followupTemplatesApi.remove(tpl.id);
      if (res.success) {
        setTemplates(list => list.filter(x => x.id !== tpl.id));
        if (tplForm.id === tpl.id) { setTplForm({ name: '', category: '病种', intervals: '30,90,180', items: '', active: true }); setTplEditing(false); }
      } else {
        setTplError(res.error?.message ?? t('followUp.deleteFailed'));
      }
    } catch (err) {
      setTplError((err as Error)?.message ?? t('followUp.deleteFailed'));
    }
  };

  // [v3.0.6.11-99 Wave3B] 应用模板 → 按间隔批量生成随访计划
  const applyTemplate = async () => {
    if (!tplApply) return;
    if (!tplApplyForm.patientId || !tplApplyForm.patientName || !tplApplyForm.planDate) {
      setTplError(t('followUp.fillPatientFields'));
      return;
    }
    setTplLoading(true);
    setTplError(null);
    try {
      const res = await followupTemplatesApi.apply(tplApply.id, {
        patientId: tplApplyForm.patientId,
        patientName: tplApplyForm.patientName,
        planDate: tplApplyForm.planDate,
      });
      if (res.success && res.data) {
        window.alert(t('w9b.followUp.templateApplied', { name: tplApply.name, intervals: (tplApply.intervals ?? []).join('/'), total: res.data.total }));
        setTplApply(null);
        setTplApplyForm({ patientId: '', patientName: '', planDate: new Date().toISOString().slice(0, 10) });
        void loadFollowUps();
      } else {
        setTplError(res.error?.message ?? t('followUp.applyFailed'));
      }
    } catch (err) {
      setTplError((err as Error)?.message ?? t('followUp.applyFailed'));
    } finally {
      setTplLoading(false);
    }
  };

  const pageStyle: React.CSSProperties = { backgroundColor: 'var(--bg-card)',
    padding: '24px'
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px'
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-secondary)'
  };

  const statsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: '600',
    color: '#1890ff'
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px'
  };

  const searchBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 16px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    fontSize: '14px'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 24px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  };

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-color)'
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    borderBottom: isActive ? '2px solid #1890ff' : '2px solid transparent',
    color: isActive ? '#1890ff' : 'var(--text-secondary, #475569)',
    cursor: 'pointer',
    fontSize: '14px',
    background: 'none',
    border: 'none'
  });

  const tableStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const getStatusTagStyle = (status: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '4px 12px',
      borderRadius: '4px',
      fontSize: '12px'
    };
    switch (status) {
      case '待随访':
        return { ...baseStyle, backgroundColor: 'var(--color-warning-bg)', color: '#faad14' };
      case '已提醒':
        return { ...baseStyle, backgroundColor: '#e6f4ff', color: '#1677ff' };
      case '进行中':
        return { ...baseStyle, backgroundColor: 'var(--color-info-bg)', color: '#1890ff' };
      case '已完成':
        return { ...baseStyle, backgroundColor: 'var(--color-success-bg)', color: '#52c41a' };
      case '已失访':
        return { ...baseStyle, backgroundColor: '#fff1f0', color: '#ff4d4f' };
      case '已取消':
        return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#8c8c8c' };
      case '逾期':
        return { ...baseStyle, backgroundColor: 'var(--color-error-bg)', color: '#ff4d4f' };
      default:
        return baseStyle;
    }
  };

  const getExamTypeStyle = (type: string): React.CSSProperties => {
    const colors: Record<string, string> = {
      'CT增强': '#ff6b6b',
      'MRI增强': '#4ecdc4',
      'CT平扫': '#ffe66d',
      'MRI平扫': '#95e1d3'
    };
    return {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      backgroundColor: colors[type] || '#e8e8e8',
      color: 'var(--text-secondary)'
    };
  };

  const actionButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    padding: '24px',
    width: '500px',
    maxHeight: '80vh',
    overflow: 'auto'
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px'
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '16px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '6px'
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    fontSize: '14px'
  };

  const modalButtonContainer: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: '10px 24px',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  };

  const followUpColumns = [
    {
      title: t('followUp.patientInfo'), key: 'patient',
      render: (_: unknown, item: FollowUpPatient) => (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{item.patientName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.patientId}</div>
        </>
      ),
    },
    { title: t('followUp.examType'), key: 'examType', render: (_: unknown, item: FollowUpPatient) => <span style={getExamTypeStyle(item.examType ?? '')}>{item.examType || '—'}</span> },
    { title: t('followUp.followUpType'), dataIndex: 'followUpType', key: 'followUpType', render: (v: string) => <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{v || '—'}</span> },
    { title: t('followUp.examDate'), dataIndex: 'examDate', key: 'examDate', render: (v: string) => <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: t('followUp.followUpDate'), dataIndex: 'nextFollowUpDate', key: 'nextFollowUpDate', render: (v: string) => <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{v}</span> },
    {
      title: t('followUp.status'), key: 'status',
      render: (_: unknown, item: FollowUpPatient) => (
        <>
          <span style={getStatusTagStyle(item.status)}>{item.status}</span>
          {item.reason && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason}</div>
          )}
        </>
      ),
    },
    {
      title: t('followUp.actions'), key: 'actions',
      render: (_: unknown, item: FollowUpPatient) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <button style={{ ...actionButtonStyle, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => { setSelectedPatient(item); setShowModal(true); }}>
            <Eye size={12} /> {t('followUp.detail')}
          </button>
          {(item.status === '待随访' || item.status === '逾期') && (
            <button style={{ ...actionButtonStyle, marginLeft: 8, backgroundColor: '#1677ff', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleRemind(item)}>
              <Bell size={12} /> {t('followUp.remind')}
            </button>
          )}
          {!isTerminal(item.status) && item.status !== '进行中' && (
            <button style={{ ...actionButtonStyle, marginLeft: 8, backgroundColor: '#722ed1', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleStart(item)}>
              <Play size={12} /> {t('followUp.start')}
            </button>
          )}
          {!isTerminal(item.status) && (
            <button style={{ ...actionButtonStyle, marginLeft: 8, backgroundColor: '#52c41a', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => openResultModal(item.id, item.patientName)}>
              <CheckCircle size={12} /> {t('followUp.complete')}
            </button>
          )}
          {!isTerminal(item.status) && (
            <button style={{ ...actionButtonStyle, marginLeft: 8, backgroundColor: '#fa8c16', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleMiss(item)}>
              <UserX size={12} /> {t('followUp.miss')}
            </button>
          )}
          {!isTerminal(item.status) && (
            <button style={{ ...actionButtonStyle, marginLeft: 8, backgroundColor: '#1677ff', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => openEditPlan(item)}>
              <Pencil size={12} /> {t('followUp.edit')}
            </button>
          )}
          {!isTerminal(item.status) && (
            <button style={{ ...actionButtonStyle, marginLeft: 8, backgroundColor: '#ff4d4f', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleCancel(item)}>
              <Ban size={12} /> {t('followUp.cancel')}
            </button>
          )}
          <button style={{ ...actionButtonStyle, marginLeft: 8, backgroundColor: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleDelete(item)}>
            <Trash2 size={12} /> {t('followUp.delete')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>{t('followUp.title')}</h1>
          <p style={subtitleStyle}>{t('followUp.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* [v3.0.6.11-99 Wave3B] 数据源徽标 (真实/演示回退) */}
          <span style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
            background: dataSource === 'real' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: dataSource === 'real' ? '#059669' : '#d97706',
            border: `1px solid ${dataSource === 'real' ? '#bbf7d0' : '#fcd34d'}`,
          }}>
            {dataSource === 'real' ? t('followUp.realData') : t('followUp.demoFallback')}
          </span>
          {/* [v3.0.6.11-103 Wave 1B] 报告→随访触发模式 (GET /followup-trigger-rules/mode) */}
          <span style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
            background: triggerMode === 'auto' ? 'rgba(22,119,255,0.15)' : 'rgba(148,163,184,0.15)',
            color: triggerMode === 'auto' ? '#1677ff' : 'var(--text-secondary, #475569)',
            border: `1px solid ${triggerMode === 'auto' ? '#93c5fd' : 'var(--border-default, rgba(0,0,0,0.12))'}`,
          }} data-testid="followup-trigger-mode">
            {t('followUp.triggerMode')}: {triggerMode === 'auto' ? t('followUp.autoCreate') : triggerMode === 'hint' ? t('followUp.hintOnly') : '—'}
          </span>
          <button style={{ ...buttonStyle, backgroundColor: '#1677ff' }} onClick={() => void openFromExam()}>
            <Calendar size={14} /> {t('followUp.examLink')}
          </button>
          {/* [v3.0.6.11-104 Wave 2C] 报告→随访: 关键词规则手动补建 (POST /followups/from-report) */}
          <button style={{ ...buttonStyle, backgroundColor: '#eb2f96' }} onClick={openFromReport}>
            <FileText size={14} /> {t('followup.fromReport.button')}
          </button>
          <button style={{ ...buttonStyle, backgroundColor: '#722ed1' }} onClick={openTemplates}>
            <LayoutTemplate size={14} /> {t('followUp.templates')}
          </button>
        </div>
      </div>

      {/* [v3.0.6.11-99 Wave3B] 统计卡: 完成率/失访率/异常率 (GET /followups/stats, 失败回退本地派生) */}
      <div style={statsContainerStyle}>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{displayStats.total}</div>
          <div style={statLabelStyle}>{t('followUp.totalCount')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#52c41a' }}>{displayStats.completionRate}%</div>
          <div style={statLabelStyle}>{t('followUp.completionRate', { count: displayStats.completed })}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#ff4d4f' }}>{displayStats.missRate}%</div>
          <div style={statLabelStyle}>{t('followUp.missRate', { count: displayStats.missed })}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#ff4d4f' }}>{displayStats.abnormalRate}%</div>
          <div style={statLabelStyle}>{t('followUp.abnormalRate', { count: displayStats.overdue })}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#faad14' }}>{displayStats.pending}</div>
          <div style={statLabelStyle}>{t('followUp.statusPending')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#1677ff' }}>{displayStats.reminded}</div>
          <div style={statLabelStyle}>{t('followUp.statusReminded')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#1890ff' }}>{displayStats.inProgress}</div>
          <div style={statLabelStyle}>{t('followUp.statusInProgress')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#52c41a' }}>{displayStats.completed}</div>
          <div style={statLabelStyle}>{t('followUp.statusCompleted')}</div>
        </div>
      </div>

      {/* [v3.0.6.11-99 Wave10B] 随访趋势 / 类别分布 / 到期清单 深化面板 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* 近 6 月随访趋势 */}
        <div style={{ ...statCardStyle }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} /> {t('followUp.monthlyTrend')}
          </div>
          {(() => {
            const byMonth: Array<{ month: string; total: number; completed: number; missed: number }> = (displayStats.byMonth ?? []).length > 0
              ? displayStats.byMonth.slice(-6)
              : (() => {
                  const map = new Map<string, { total: number; completed: number; missed: number }>()
                  followUpList.forEach(p => {
                    const m = String(p.nextFollowUpDate || p.examDate || '').slice(0, 7)
                    if (!m) return
                    const cur = map.get(m) || { total: 0, completed: 0, missed: 0 }
                    cur.total += 1
                    if (p.status === '已完成') cur.completed += 1
                    if (p.status === '已失访') cur.missed += 1
                    map.set(m, cur)
                  })
                  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([month, v]) => ({ month, ...v }))
                })()
            const maxTotal = Math.max(1, ...byMonth.map(b => b.total))
            return byMonth.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>{t('followUp.noTrendData')}</div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
                  {byMonth.map(b => (
                    <div key={b.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 10, color: '#52c41a', fontWeight: 600 }}>{b.completed}</span>
                      <div style={{
                        width: '65%', borderRadius: '3px 3px 0 0',
                        height: `${(b.total / maxTotal) * 80}px`, minHeight: 5,
                        background: 'linear-gradient(180deg, #1890ff, #69c0ff)',
                      }} title={`${b.month}: 共 ${b.total} · 完成 ${b.completed}`} />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{b.month.slice(5)}{t('followUp.monthSuffix')}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                  {byMonth.map(b => `${b.month}: ${b.total}条`).join(' · ')}
                </div>
              </div>
            )
          })()}
        </div>

        {/* 类别分布 */}
        <div style={{ ...statCardStyle }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <LayoutTemplate size={14} /> {t('followUp.categoryDist')}
          </div>
          {(() => {
            const cats: Array<{ category: string; count: number }> = (displayStats.byCategory ?? []).length > 0
              ? displayStats.byCategory
              : (() => {
                  const map = new Map<string, number>()
                  followUpList.forEach(p => {
                    const cat = p.followUpType || '未分类'
                    map.set(cat, (map.get(cat) || 0) + 1)
                  })
                  return [...map.entries()].map(([category, count]) => ({ category, count }))
                })()
            const maxCat = Math.max(1, ...cats.map(c => c.count))
            const colors = ['#1890ff', '#722ed1', '#52c41a', '#fa8c16', '#eb2f96', '#13c2c2']
            return cats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>{t('followUp.noCategoryData')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cats.slice(0, 6).map((c, i) => (
                  <div key={c.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.category}</span>
                      <span style={{ color: colors[i % colors.length], fontWeight: 700 }}>{c.count}</span>
                    </div>
                    <div style={{ height: 7, background: 'var(--bg-primary, #f8fafc)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(c.count / maxCat) * 100}%`, height: '100%', borderRadius: 4,
                        background: colors[i % colors.length], transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* 即将到期清单 */}
        <div style={{ ...statCardStyle }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BellRing size={14} /> {t('followUp.dueSoon')}
          </div>
          {dueList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={26} color="#52c41a" />
              {t('followUp.noDueIn7Days')}
            </div>
          ) : (
            <div style={{ maxHeight: 190, overflowY: 'auto' }}>
              {dueList.slice(0, 8).map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
                  borderBottom: '1px solid var(--border-color)', fontSize: 12,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fa8c16', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.patientName}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{String(p.nextDate || '').slice(5)}</span>
                  <span style={{ fontSize: 11, color: p.status === 'OVERDUE' ? '#ff4d4f' : '#faad14', fontWeight: 600 }}>
                    {p.status === 'OVERDUE' ? t('followUp.statusOverdue') : t('followUp.statusPending')}
                  </span>
                </div>
              ))}
              {dueList.length > 8 && (
                <div style={{ textAlign: 'center', padding: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                  {t('followUp.moreItems', { count: dueList.length - 8 })}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <Bell size={11} style={{ verticalAlign: 'text-bottom' }} /> {t('followUp.dueHint')}
          </div>
        </div>
      </div>

      {/* [v3.0.6.11-104 Wave 2C] 催办队列面板: 逾期/今日到期/未来 N 天 (GET /followups/reminder-queue) */}
      <div style={{ ...statCardStyle, marginBottom: 24 }} data-testid="followup-reminder-queue">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BellRing size={14} /> {t('followup.reminderQueue.title')}
            {reminderQueue && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                {t('followup.reminderQueue.total', { count: reminderQueue.total })}
              </span>
            )}
          </div>
          <button style={{ ...cancelButtonStyle, padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => void loadReminderQueue()} disabled={reminderLoading}>
            <RotateCcw size={12} /> {t('followup.reminderQueue.refresh')}
          </button>
        </div>

        {reminderLoading && !reminderQueue ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
            <Loader2 size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('followup.reminderQueue.loading')}
          </div>
        ) : reminderError ? (
          <div style={{
            padding: '12px 16px', borderRadius: 8, backgroundColor: 'var(--color-error-bg)',
            border: '1px solid #ffa39e', fontSize: 13, color: '#cf1322',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={14} /> {reminderError}
            <button style={{ ...cancelButtonStyle, padding: '2px 10px', fontSize: 12 }} onClick={() => void loadReminderQueue()}>{t('followup.reminderQueue.retry')}</button>
          </div>
        ) : !reminderQueue || reminderQueue.total === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={26} color="#52c41a" />
            {t('followup.reminderQueue.empty')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {([
              { key: 'overdue', label: t('followup.reminderQueue.overdue'), count: reminderQueue.overdue, color: '#ff4d4f', list: reminderGroups.overdue },
              { key: 'dueToday', label: t('followup.reminderQueue.dueToday'), count: reminderQueue.dueToday, color: '#fa8c16', list: reminderGroups.dueToday },
              { key: 'upcoming', label: t('followup.reminderQueue.upcoming', { days: reminderQueue.days }), count: reminderQueue.upcoming, color: '#1677ff', list: reminderGroups.upcoming },
            ] as Array<{ key: string; label: string; count: number; color: string; list: FollowUpPlan[] }>).map(g => (
              <div key={g.key} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: g.color }}>{g.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: g.color }}>{g.count}</span>
                </div>
                {g.list.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>{t('followup.reminderQueue.none')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {g.list.slice(0, 6).map(p => (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setSelectedPatient(mapPlan(p)); setShowModal(true); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPatient(mapPlan(p)); setShowModal(true); } }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.patientName}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{String(p.nextDate || '').slice(5, 10)}</span>
                      </div>
                    ))}
                    {g.list.length > 6 && (
                      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>{t('followup.reminderQueue.more', { count: g.list.length - 6 })}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={searchBarStyle}>
        <input
          type="text"
          placeholder={t('followUp.searchPlaceholder')}
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          style={inputStyle}
        />
        <button style={buttonStyle} onClick={() => { setSearchKeyword(''); }}><RotateCcw size={14} /> {t('followUp.reset')}</button>
        <button style={{...buttonStyle, backgroundColor: '#52c41a'}} onClick={() => setShowCreateModal(true)}><Plus size={14} /> {t('followUp.create')}</button>
      </div>

      {/* [W4-B] 到期提醒横幅 (GET /followups/due?days=7) */}
      {dueList.length > 0 && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          backgroundColor: '#f9731622', border: '1px solid #ffd591',
          fontSize: '13px', color: '#ad6800'
        }}>
          <strong><BellRing size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('followUp.dueBanner', { count: dueList.length })}</strong>
          {dueList.slice(0, 5).map(p => `${p.patientName}(${p.nextDate.slice(0, 10)})`).join('、')}
          {dueList.length > 5 && ` 等${dueList.length}项`}
        </div>
      )}

      {/* [W4-B] loading / error */}
      {loading && (
        <div style={{ marginBottom: '16px', padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <Loader2 size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('followUp.loading')}
        </div>
      )}
      {loadError && !loading && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          backgroundColor: 'var(--color-error-bg)', border: '1px solid #ffa39e',
          fontSize: '13px', color: '#cf1322'
        }}>
          <AlertTriangle size={14} style={{ verticalAlign: 'text-bottom' }} /> {loadError}
        </div>
      )}

      {/* [v3.0.6.11-99 Wave10B] 状态筛选 Tab: 全部/待随访/逾期/已提醒/进行中/已完成/已失访/已取消 */}
      <div style={tabContainerStyle}>
        {([
          ['all', t('followUp.tabAll'), displayStats.total],
          ['pending', t('followUp.statusPending'), displayStats.pending],
          ['reminded', t('followUp.statusReminded'), displayStats.reminded],
          ['inprogress', t('followUp.statusInProgress'), displayStats.inProgress],
          ['completed', t('followUp.statusCompleted'), displayStats.completed],
          ['overdue', t('followUp.statusOverdue'), displayStats.overdue],
          ['missed', t('followUp.statusMissed'), displayStats.missed],
          ['cancelled', t('followUp.statusCancelled'), displayStats.cancelled],
        ] as Array<[typeof activeTab, string, number]>).map(([key, label, count]) => (
          <button key={key} style={tabStyle(activeTab === key)} onClick={() => setActiveTab(key)}>
            {label} ({count})
          </button>
        ))}
      </div>

      {/* [v3.0.6.11-99 Wave10B] 视图切换: 列表 / 日历 / 按患者分组 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {([
          ['list', t('followUp.viewList')],
          ['calendar', t('followUp.viewCalendar')],
          ['grouped', t('followUp.viewGrouped')],
        ] as Array<['list' | 'calendar' | 'grouped', string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            style={{
              padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: viewMode === key ? '#1890ff' : 'var(--bg-card)',
              color: viewMode === key ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${viewMode === key ? '#1890ff' : 'var(--border-color)'}`,
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {t('followUp.listSummary', { count: filteredList.length, patients: groupedByPatient.length })}
        </span>
      </div>

      {/* [v3.0.6.11-99 Wave10B] 日历视图 (计划日期分布) */}
      {viewMode === 'calendar' && (
        <div style={{ ...tableStyle, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{t('followUp.calendarTitle', { month: calendarMonth })}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={actionButtonStyle}
                onClick={() => {
                  const d = new Date(calendarMonth + '-01')
                  d.setMonth(d.getMonth() - 1)
                  setCalendarMonth(d.toISOString().slice(0, 7))
                }}
              >
                {t('followUp.prevMonth')}
              </button>
              <button
                style={actionButtonStyle}
                onClick={() => {
                  const d = new Date(calendarMonth + '-01')
                  d.setMonth(d.getMonth() + 1)
                  setCalendarMonth(d.toISOString().slice(0, 7))
                }}
              >
                {t('followUp.nextMonth')}
              </button>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
          }}>
            {['followUp.weekMon', 'followUp.weekTue', 'followUp.weekWed', 'followUp.weekThu', 'followUp.weekFri', 'followUp.weekSat', 'followUp.weekSun'].map(w => (
              <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', padding: '6px 0' }}>
                {t(w)}
              </div>
            ))}
            {(() => {
              const [y, m] = calendarMonth.split('-').map(Number)
              const first = new Date(y ?? 0, (m ?? 1) - 1, 1)
              const startPad = (first.getDay() + 6) % 7
              const daysInMonth = new Date(y ?? 0, m ?? 1, 0).getDate()
              const cells: Array<number | null> = [
                ...Array.from({ length: startPad }, () => null),
                ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
              ]
              return cells.map((day, i) => {
                const key = day ? `${calendarMonth}-${String(day).padStart(2, '0')}` : `pad-${i}`
                const plans = day ? calendarDays[key] || [] : []
                const isToday = key === new Date().toISOString().slice(0, 10)
                return (
                  <div key={key} style={{
                    minHeight: 74, borderRadius: 8, padding: 6,
                    background: isToday ? '#e6f4ff' : day ? 'var(--bg-card)' : 'transparent',
                    border: `1px solid ${isToday ? '#1890ff' : day ? 'var(--border-color)' : 'transparent'}`,
                    position: 'relative',
                  }}>
                    {day && (
                      <>
                        <span style={{
                          position: 'absolute', top: 4, right: 6, fontSize: 11, fontWeight: 600,
                          color: isToday ? '#1890ff' : 'var(--text-secondary)',
                        }}>
                          {day}
                        </span>
                        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {plans.slice(0, 3).map(p => (
                            <span
                              key={p.id}
                              role="button"
                              tabIndex={0}
                              aria-label={p.patientName}
                              title={`${p.patientName} · ${p.status} · ${p.notes || ''}`}
                              onClick={() => { setSelectedPatient(p); setShowModal(true) }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPatient(p); setShowModal(true) } }}
                              style={{
                                fontSize: 10, padding: '1px 4px', borderRadius: 3, cursor: 'pointer',
                                background: `${statusDotColor[p.status] || '#94a3b8'}22`,
                                color: statusDotColor[p.status] || 'var(--text-secondary, #475569)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}
                            >
                              {p.patientName.slice(0, 4)}
                            </span>
                          ))}
                          {plans.length > 3 && (
                            <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>+{plans.length - 3} {t('followUp.itemSuffix')}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            })()}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(statusDotColor).map(([status, color]) => {
              const count = followUpList.filter(p => p.status === status).length
              return (
                <span key={status} style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  {status} ({count})
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* [v3.0.6.11-99 Wave10B] 按患者分组视图 */}
      {viewMode === 'grouped' && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groupedByPatient.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 13 }}>{t('followUp.noMatchPlans')}</div>
          )}
          {groupedByPatient.map(g => {
            const expanded = expandedPatients.has(g.patientId)
            const latest = g.items[0]
            const completedCount = g.items.filter(i => i.status === '已完成').length
            return (
              <div key={g.patientId} style={{ ...tableStyle, overflow: 'hidden' }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePatient(g.patientId)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePatient(g.patientId) } }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer',
                    background: expanded ? '#e6f4ff' : 'var(--bg-card)',
                    borderBottom: expanded ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #1890ff, #36cfc9)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700,
                  }}>
                    {g.patientName.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {g.patientName}
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, fontWeight: 400 }}>
                        ID: {g.patientId}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {t('followUp.groupSummary', { count: g.items.length, completed: completedCount, recent: String(latest?.nextFollowUpDate || '').slice(0, 10) })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(['待随访', '逾期', '已提醒', '进行中'] as string[]).map(s => {
                      const c = g.items.filter(i => i.status === s).length
                      if (c === 0) return null
                      return (
                        <span key={s} style={{
                          padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: `${statusDotColor[s] || '#94a3b8'}1f`,
                          color: statusDotColor[s] || 'var(--text-secondary, #475569)',
                        }}>
                          {s} {c}
                        </span>
                      )
                    })}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none', fontSize: 12 }}>
                    ›
                  </span>
                </div>
                {expanded && (
                  <div style={{ padding: 8 }}>
                    {g.items.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {item.notes || item.followUpType || t('followUp.planLabel')}
                            {item.examType && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-secondary)' }}>{item.examType}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {t('followUp.examToFollowUp', { examDate: item.examDate, nextDate: item.nextFollowUpDate })}{item.intervalDays ? ` · 间隔 ${item.intervalDays} 天` : ''}
                          </div>
                        </div>
                        <span style={getStatusTagStyle(item.status)}>{item.status}</span>
                        <button
                          style={{ ...actionButtonStyle, backgroundColor: '#1890ff' }}
                          onClick={() => { setSelectedPatient(item); setShowModal(true) }}
                        >
                          <Eye size={12} /> {t('followUp.detail')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* [v3.0.6.11-99 Wave10B] 列表视图保持原样 */}
      {viewMode === 'list' && (
      <div style={tableStyle}>
        <DataTable
          rowKey="id"
          dataSource={filteredList}
          columns={followUpColumns as never}
          scroll={{ x: 'max-content' }}
        />
      </div>
      )}

      {showModal && selectedPatient && (
        <div style={modalOverlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('followUp.detailTitle')}</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.patientName')}</label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.patientName}</div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.patientId')}</label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.patientId}</div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.examType')}</label>
                <span style={getExamTypeStyle(selectedPatient.examType ?? '')}>{selectedPatient.examType || '—'}</span>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.followUpType')}</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.followUpType || '—'}</div>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.examDate')}</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.examDate}</div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.followUpDate')}</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.nextFollowUpDate}</div>
              </div>
            </div>

            {selectedPatient.reaction && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.contrastReaction')}</label>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: selectedPatient.reaction === '无反应' ? '#f6ffed' :
                                   selectedPatient.reaction === '轻度' ? '#fffbe6' :
                                   selectedPatient.reaction === '中度' ? '#fff7e6' : '#fff2f0',
                  color: selectedPatient.reaction === '无反应' ? '#52c41a' :
                         selectedPatient.reaction === '轻度' ? '#faad14' :
                         selectedPatient.reaction === '中度' ? '#fa8c16' : '#ff4d4f'
                }}>
                  {selectedPatient.reaction}
                </span>
              </div>
            )}

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.notes')}</label>
              <div style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                padding: '12px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '4px',
                minHeight: '60px'
              }}>
                {selectedPatient.notes || t('followUp.none')}
              </div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.updateStatus')}</label>
              <Select
                style={selectStyle}
                value={selectedPatient.status || undefined}
                placeholder={t('followUp.selectStatus')}
                onChange={async (v: string) => {
                  if (v === '已完成') { openResultModal(selectedPatient.id, selectedPatient.patientName); return; }
                  if (v === '进行中') { await handleStart(selectedPatient); return; }
                  if (v === '已失访') { await handleMiss(selectedPatient); return; }
                  if (v === '已取消') { await handleCancel(selectedPatient); return; }
                }}
                options={[
                  { value: '已完成', label: t('followUp.statusCompleted') },
                  { value: '进行中', label: t('followUp.statusInProgress') },
                  { value: '已失访', label: t('followUp.statusMissed') },
                  { value: '已取消', label: t('followUp.statusCancelled') },
                ]}
              />
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowModal(false)}>{t('followUp.cancel')}</button>
              <button
                style={buttonStyle}
                onClick={() => openResultModal(selectedPatient.id, selectedPatient.patientName)}
                disabled={isTerminal(selectedPatient.status)}
              >
                <CheckCircle size={14} /> {t('followUp.confirmComplete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [W4-B] 新建随访计划 (POST /followups) */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('followUp.createTitle')}</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.patientId')} *</label>
              <input
                type="text"
                value={newPlan.patientId}
                onChange={e => setNewPlan(f => ({ ...f, patientId: e.target.value }))}
                placeholder={t('followUp.patientIdExample')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.patientName')} *</label>
              <input
                type="text"
                value={newPlan.patientName}
                onChange={e => setNewPlan(f => ({ ...f, patientName: e.target.value }))}
                placeholder={t('followUp.patientName')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.followUpDate')} *</label>
                <input
                  type="date"
                  value={newPlan.planDate}
                  onChange={e => setNewPlan(f => ({ ...f, planDate: e.target.value }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.intervalDays')}</label>
                <input
                  type="number"
                  min={1}
                  value={newPlan.intervalDays}
                  onChange={e => setNewPlan(f => ({ ...f, intervalDays: Number(e.target.value) }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {newPlan.examId && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.sourceExam')}</label>
                <div style={{ fontSize: '13px', color: '#1677ff', background: '#e6f4ff', padding: '8px 12px', borderRadius: '4px' }}>
                  examId: {newPlan.examId}
                </div>
              </div>
            )}
            {newPlan.reportId && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.sourceReport')}</label>
                <div style={{ fontSize: '13px', color: '#1677ff', background: '#e6f4ff', padding: '8px 12px', borderRadius: '4px' }}>
                  reportId: {newPlan.reportId}
                </div>
              </div>
            )}

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.followUpNote')}</label>
              <textarea
                value={newPlan.note}
                onChange={e => setNewPlan(f => ({ ...f, note: e.target.value }))}
                placeholder={t('followUp.notePlaceholder')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box', minHeight: '60px', fontFamily: 'inherit' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newPlan.reminderEnabled}
                  onChange={e => setNewPlan(f => ({ ...f, reminderEnabled: e.target.checked }))}
                />
                {t('followUp.enableReminder')}
              </label>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowCreateModal(false)}>{t('followUp.cancel')}</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#52c41a' }}
                onClick={() => void handleCreate()}
                disabled={saving}
              >
                <Save size={14} /> {saving ? t('followUp.saving') : t('followUp.savePlan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-99 Wave3B] 随访模板库 Modal: 列表/新建/编辑/删除/应用(选患者) */}
      {showTemplateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowTemplateModal(false)}>
          <div style={{ ...modalStyle, width: '720px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('followUp.templateLibrary')}</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              {t('followUp.templateLibraryDesc')}
            </p>

            {tplError && (
              <div style={{
                marginBottom: '12px', padding: '10px 14px', borderRadius: '6px',
                backgroundColor: 'var(--color-error-bg)', border: '1px solid #ffa39e',
                fontSize: '13px', color: '#cf1322'
              }}>
                <AlertTriangle size={13} style={{ verticalAlign: 'text-bottom' }} /> {tplError}
              </div>
            )}

            {/* 模板编辑表单 */}
            <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {tplEditing ? t('followUp.editTemplate') : t('followUp.createTemplate')}
                {tplEditing && (
                  <button
                    style={{ ...cancelButtonStyle, padding: '4px 12px', fontSize: '12px' }}
                    onClick={() => { setTplEditing(false); setTplForm({ name: '', category: '病种', intervals: '30,90,180', items: '', active: true }); }}
                  >
                    <X size={12} /> {t('followUp.cancelEdit')}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>{t('followUp.templateName')} *</label>
                  <input
                    type="text"
                    value={tplForm.name}
                    onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={t('followUp.templateNameExample')}
                    style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>{t('followUp.category')}</label>
                  <Select
                    style={selectStyle}
                    value={tplForm.category}
                    onChange={(v) => setTplForm(f => ({ ...f, category: v }))}
                    options={[
                      { value: '病种', label: t('followUp.categoryDisease') },
                      { value: '术式', label: t('followUp.categorySurgery') },
                      { value: '检查类型', label: t('followUp.categoryExamType') },
                    ]}
                  />
                </div>
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.intervalDaysHint')} *</label>
                <input
                  type="text"
                  value={tplForm.intervals}
                  onChange={e => setTplForm(f => ({ ...f, intervals: e.target.value }))}
                  placeholder="30,90,180"
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.itemsHint')}</label>
                <input
                  type="text"
                  value={tplForm.items}
                  onChange={e => setTplForm(f => ({ ...f, items: e.target.value }))}
                  placeholder={t('followUp.itemsExample')}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={tplForm.active}
                    onChange={e => setTplForm(f => ({ ...f, active: e.target.checked }))}
                  />
                  {t('followUp.enableTemplate')}
                </label>
              </div>
              <div style={modalButtonContainer}>
                <button
                  style={{ ...buttonStyle, backgroundColor: '#722ed1', padding: '8px 20px' }}
                  onClick={() => void saveTemplate()}
                  disabled={tplLoading}
                >
                  <Save size={13} /> {tplEditing ? t('followUp.saveChanges') : t('followUp.createTemplate')}
                </button>
              </div>
            </div>

            {/* 模板列表 */}
            {tplLoading && !templates.length ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Loader2 size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('followUp.loadingTemplates')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflow: 'auto' }}>
                {templates.map(tpl => (
                  <div key={tpl.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {tpl.name}
                        <span style={{
                          fontSize: '11px', padding: '1px 8px', borderRadius: 10,
                          background: tpl.active ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.2)',
                          color: tpl.active ? '#059669' : 'var(--text-secondary, #475569)', fontWeight: 600
                        }}>
                          {tpl.active ? t('followUp.enabled') : t('followUp.disabled')}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {t('followUp.templateMeta', { category: tpl.category || t('followUp.uncategorized'), intervals: (tpl.intervals ?? []).join('/'), items: (tpl.items ?? []).join('、') || '—' })}
                      </div>
                    </div>
                    <button style={{ ...actionButtonStyle, backgroundColor: '#52c41a', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => { setTplApply(tpl); setTplApplyForm(f => ({ ...f, planDate: new Date().toISOString().slice(0, 10) })); }}>
                      <Play size={12} /> {t('followUp.apply')}
                    </button>
                    <button style={{ ...actionButtonStyle, backgroundColor: '#1677ff', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => editTemplate(tpl)}>
                      <Pencil size={12} /> {t('followUp.edit')}
                    </button>
                    <button style={{ ...actionButtonStyle, backgroundColor: '#ff4d4f', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => void deleteTemplate(tpl)}>
                      <Trash2 size={12} /> {t('followUp.delete')}
                    </button>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {t('followUp.noTemplates')}
                  </div>
                )}
              </div>
            )}

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowTemplateModal(false)}>{t('followUp.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-99 Wave3B] 模板应用弹窗: 选患者 → 按间隔批量生成 */}
      {tplApply && (
        <div style={modalOverlayStyle} onClick={() => setTplApply(null)}>
          <div style={{ ...modalStyle, width: '440px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('followUp.applyTemplateTitle', { name: tplApply.name })}</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              {t('followUp.applyTemplateDesc', { intervals: (tplApply.intervals ?? []).join('/'), count: tplApply.intervals?.length ?? 0 })}
            </p>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.patientId')} *</label>
              <input
                type="text"
                value={tplApplyForm.patientId}
                onChange={e => setTplApplyForm(f => ({ ...f, patientId: e.target.value }))}
                placeholder={t('followUp.patientIdExample')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.patientName')} *</label>
              <input
                type="text"
                value={tplApplyForm.patientName}
                onChange={e => setTplApplyForm(f => ({ ...f, patientName: e.target.value }))}
                placeholder={t('followUp.patientName')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.baseDate')} *</label>
              <input
                type="date"
                value={tplApplyForm.planDate}
                onChange={e => setTplApplyForm(f => ({ ...f, planDate: e.target.value }))}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setTplApply(null)}>{t('followUp.cancel')}</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#52c41a' }}
                onClick={() => void applyTemplate()}
                disabled={tplLoading}
              >
                <Play size={14} /> {tplLoading ? t('followUp.generating') : t('followUp.confirmApply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-103 Wave 1B] 检查联动: 检查完成 → 自动创建随访计划 (POST /followups/from-exam) */}
      {showFromExamModal && (
        <div style={modalOverlayStyle} onClick={() => setShowFromExamModal(false)}>
          <div style={{ ...modalStyle, width: '460px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('followUp.examLinkTitle')}</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              {t('followUp.examLinkDesc')}
            </p>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.examId')} *</label>
              <input
                type="text"
                value={fromExamForm.examId}
                onChange={e => setFromExamForm(f => ({ ...f, examId: e.target.value }))}
                placeholder={t('followUp.examIdExample')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.templateOptional')}</label>
              <Select
                style={selectStyle}
                value={fromExamForm.templateId || undefined}
                placeholder={t('followUp.noTemplateSpecified')}
                onChange={(v) => setFromExamForm(f => ({ ...f, templateId: v }))}
                options={fromExamTemplates.map(tmpl => ({
                  value: tmpl.id,
                  label: `${tmpl.name}（${(tmpl.intervals ?? []).join('/')}${t('followUp.day')}）`,
                }))}
              />
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowFromExamModal(false)}>{t('followUp.cancel')}</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#1677ff' }}
                onClick={() => void handleFromExam()}
                disabled={fromExamBusy}
              >
                <Play size={14} /> {fromExamBusy ? t('followUp.generating') : t('followUp.confirmLink')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-103 Wave 1B] 编辑随访计划 (PUT /followups/:id) */}
      {showEditModal && editPlan && (
        <div style={modalOverlayStyle} onClick={() => setShowEditModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('followUp.editTitle', { id: editPlan.patientId })}</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.patientName')} *</label>
              <input
                type="text"
                value={editForm.patientName}
                onChange={e => setEditForm(f => ({ ...f, patientName: e.target.value }))}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.followUpDate')} *</label>
                <input
                  type="date"
                  value={editForm.planDate}
                  onChange={e => setEditForm(f => ({ ...f, planDate: e.target.value }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>{t('followUp.intervalDays')}</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.intervalDays}
                  onChange={e => setEditForm(f => ({ ...f, intervalDays: Number(e.target.value) }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followUp.followUpNote')}</label>
              <textarea
                value={editForm.note}
                onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                placeholder={t('followUp.notePlaceholder')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box', minHeight: '60px', fontFamily: 'inherit' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.reminderEnabled}
                  onChange={e => setEditForm(f => ({ ...f, reminderEnabled: e.target.checked }))}
                />
                {t('followUp.enableReminder')}
              </label>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowEditModal(false)}>{t('followUp.cancel')}</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#1677ff' }}
                onClick={() => void handleEditPlan()}
                disabled={editBusy}
              >
                <Save size={14} /> {editBusy ? t('followUp.saving') : t('followUp.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-104 Wave 2C] 报告→随访: 手动补建 (POST /followups/from-report, 关键词规则触发) */}
      {showFromReportModal && (
        <div style={modalOverlayStyle} onClick={() => setShowFromReportModal(false)}>
          <div style={{ ...modalStyle, width: '460px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('followup.fromReport.title')}</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              {t('followup.fromReport.desc')}
            </p>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followup.fromReport.reportId')} *</label>
              <input
                type="text"
                value={fromReportForm.reportId}
                onChange={e => setFromReportForm(f => ({ ...f, reportId: e.target.value }))}
                placeholder={t('followup.fromReport.reportIdPlaceholder')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('followup.fromReport.reason')}</label>
              <textarea
                value={fromReportForm.reason}
                onChange={e => setFromReportForm(f => ({ ...f, reason: e.target.value }))}
                placeholder={t('followup.fromReport.reasonPlaceholder')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box', minHeight: '60px', fontFamily: 'inherit' }}
              />
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowFromReportModal(false)}>{t('followUp.cancel')}</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#eb2f96' }}
                onClick={() => void handleFromReport()}
                disabled={fromReportBusy}
              >
                <Play size={14} /> {fromReportBusy ? t('followup.fromReport.busy') : t('followup.fromReport.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-104 Wave 3D] 随访完成前录入结构化结果 (下拉 + 描述) */}
      {resultModal && (
        <div style={modalOverlayStyle} onClick={() => setResultModal(null)}>
          <div style={{ ...modalStyle, width: '460px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>{t('w3d.followup.resultTitle')}</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              {resultModal.name} · {t('w3d.followup.result')}
            </p>
            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('w3d.followup.result')} *</label>
              <Select
                value={resultForm.result}
                onChange={(v) => setResultForm(f => ({ ...f, result: v as FollowUpResult }))}
                style={{ width: '100%' }}
                options={FOLLOWUP_RESULT_OPTIONS.map(o => ({
                  value: o.value,
                  label: t(`w3d.followup.result.${o.value}`),
                }))}
              />
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>{t('w3d.followup.outcome')}</label>
              <textarea
                value={resultForm.outcome}
                onChange={e => setResultForm(f => ({ ...f, outcome: e.target.value }))}
                placeholder={t('w3d.followup.outcomePlaceholder')}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box', minHeight: '60px', fontFamily: 'inherit' }}
              />
            </div>
            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setResultModal(null)}>{t('followUp.cancel')}</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#52c41a' }}
                onClick={() => void confirmResult()}
                disabled={resultBusy}
              >
                <CheckCircle size={14} /> {resultBusy ? '...' : t('w3d.followup.completeWithResult')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

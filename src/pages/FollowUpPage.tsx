// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Save, CheckCircle, RotateCcw, BellRing, Loader2, AlertTriangle, Eye, Plus, Bell, UserX, Ban, LayoutTemplate, Pencil, Play, X, Calendar } from 'lucide-react';
import { followupApi, type FollowUpPlan, type FollowUpStats } from '../services/api/followupApi';
import { followupTemplatesApi, type FollowUpTemplate } from '../services/api/followupTemplatesApi';
import { reportApi } from '../services/api/reportApi';
import { worklistApi } from '../services/api/worklistApi';

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
        throw new Error(res.error?.message ?? '加载失败');
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
      setLoadError('请填写检查ID');
      return;
    }
    setFromExamBusy(true);
    setLoadError(null);
    try {
      const res = await followupApi.fromExam(fromExamForm.examId.trim(), fromExamForm.templateId || undefined);
      if (res.success && res.data) {
        window.alert(`检查联动成功: 为该检查生成 ${String((res.data as any)?.total ?? 0)} 条随访计划`);
        setShowFromExamModal(false);
        void loadFollowUps();
      } else {
        setLoadError(res.error?.message ?? '检查联动失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '检查联动失败');
    } finally {
      setFromExamBusy(false);
    }
  };

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
      setLoadError('请填写患者姓名与随访日期');
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
        setLoadError(res.error?.message ?? '保存失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '保存失败');
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
      else setTplError(res.error?.message ?? '模板加载失败');
    } catch (err) {
      setTplError((err as Error)?.message ?? '模板加载失败');
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
  const handleComplete = async (id: string) => {
    try {
      const res = await followupApi.complete(id);
      if (res.success) {
        setFollowUpList(list => list.map(item =>
          item.id === id ? { ...item, status: '已完成' as const } : item
        ));
      } else {
        setLoadError(res.error?.message ?? '操作失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '操作失败');
    }
    setShowModal(false);
    setSelectedPatient(null);
  };

  // [v3.0.6.11-99 Wave3B] 提醒 → POST /followups/:id/remind
  const handleRemind = async (item: FollowUpPatient) => {
    try {
      const res = await followupApi.remind(item.id);
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === item.id ? { ...p, status: '已提醒' as const } : p));
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? '提醒失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '提醒失败');
    }
  };

  // [v3.0.6.11-99 Wave3B] 失访 → POST /followups/:id/miss {reason}
  const handleMiss = async (item: FollowUpPatient) => {
    const reason = window.prompt(`标记患者「${item.patientName}」失访，请填写失访原因：`, '电话无法接通');
    if (reason === null) return;
    if (!reason.trim()) { setLoadError('请填写失访原因'); return; }
    try {
      const res = await followupApi.miss(item.id, reason.trim());
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === item.id ? { ...p, status: '已失访' as const, reason } : p));
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? '标记失访失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '标记失访失败');
    }
  };

  // [v3.0.6.11-99 Wave3B] 取消 → POST /followups/:id/cancel {reason}
  const handleCancel = async (item: FollowUpPatient) => {
    const reason = window.prompt(`取消患者「${item.patientName}」的随访计划，请填写取消原因：`, '患者拒绝随访');
    if (reason === null) return;
    if (!reason.trim()) { setLoadError('请填写取消原因'); return; }
    try {
      const res = await followupApi.cancel(item.id, reason.trim());
      if (res.success) {
        setFollowUpList(list => list.map(p => p.id === item.id ? { ...p, status: '已取消' as const, reason } : p));
        setLoadError(null);
      } else {
        setLoadError(res.error?.message ?? '取消失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '取消失败');
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
        setLoadError(res.error?.message ?? '操作失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '操作失败');
    }
  };

  // [W4-B] 删除随访 → DELETE /followups/:id
  const handleDelete = async (item: FollowUpPatient) => {
    if (!window.confirm(`确认删除患者「${item.patientName}」的随访计划？`)) return;
    try {
      const res = await followupApi.remove(item.id);
      if (res.success) {
        setFollowUpList(list => list.filter(p => p.id !== item.id));
      } else {
        setLoadError(res.error?.message ?? '删除失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '删除失败');
    }
  };

  // [W4-B] 新建随访计划 → POST /followups
  const handleCreate = async () => {
    if (!newPlan.patientId || !newPlan.patientName || !newPlan.planDate) {
      setLoadError('请填写患者ID、姓名与随访日期');
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
      setLoadError((err as Error)?.message ?? '创建失败');
    } finally {
      setSaving(false);
    }
  };

  // [v3.0.6.11-99 Wave3B] 模板 CRUD
  const saveTemplate = async () => {
    if (!tplForm.name.trim()) { setTplError('请填写模板名称'); return; }
    const intervals = tplForm.intervals.split(/[,，\s]+/).map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
    if (intervals.length === 0) { setTplError('请至少填写一个间隔天数'); return; }
    const items = tplForm.items.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
    setTplLoading(true);
    setTplError(null);
    try {
      if (tplEditing && tplForm.id) {
        const res = await followupTemplatesApi.update(tplForm.id, { name: tplForm.name.trim(), category: tplForm.category, intervals, items, active: tplForm.active });
        if (!res.success) { setTplError(res.error?.message ?? '保存失败'); setTplLoading(false); return; }
      } else {
        const res = await followupTemplatesApi.create({ name: tplForm.name.trim(), category: tplForm.category, intervals, items, active: tplForm.active });
        if (!res.success) { setTplError(res.error?.message ?? '保存失败'); setTplLoading(false); return; }
      }
      setTplForm({ name: '', category: '病种', intervals: '30,90,180', items: '', active: true });
      setTplEditing(false);
      await loadTemplates();
    } catch (err) {
      setTplError((err as Error)?.message ?? '保存失败');
      setTplLoading(false);
    }
  };

  const editTemplate = (t: FollowUpTemplate) => {
    setTplForm({ id: t.id, name: t.name, category: t.category || '病种', intervals: (t.intervals ?? []).join(','), items: (t.items ?? []).join(','), active: t.active });
    setTplEditing(true);
  };

  const deleteTemplate = async (t: FollowUpTemplate) => {
    if (!window.confirm(`确认删除模板「${t.name}」？`)) return;
    try {
      const res = await followupTemplatesApi.remove(t.id);
      if (res.success) {
        setTemplates(list => list.filter(x => x.id !== t.id));
        if (tplForm.id === t.id) { setTplForm({ name: '', category: '病种', intervals: '30,90,180', items: '', active: true }); setTplEditing(false); }
      } else {
        setTplError(res.error?.message ?? '删除失败');
      }
    } catch (err) {
      setTplError((err as Error)?.message ?? '删除失败');
    }
  };

  // [v3.0.6.11-99 Wave3B] 应用模板 → 按间隔批量生成随访计划
  const applyTemplate = async () => {
    if (!tplApply) return;
    if (!tplApplyForm.patientId || !tplApplyForm.patientName || !tplApplyForm.planDate) {
      setTplError('请填写患者ID、姓名与随访日期');
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
        window.alert(`模板「${tplApply.name}」已应用：按间隔 ${(tplApply.intervals ?? []).join('/')} 天批量生成 ${res.data.total} 条随访计划`);
        setTplApply(null);
        setTplApplyForm({ patientId: '', patientName: '', planDate: new Date().toISOString().slice(0, 10) });
        void loadFollowUps();
      } else {
        setTplError(res.error?.message ?? '应用失败');
      }
    } catch (err) {
      setTplError((err as Error)?.message ?? '应用失败');
    } finally {
      setTplLoading(false);
    }
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-card)',
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
    color: isActive ? '#1890ff' : '#666',
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

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>放射科随访管理</h1>
          <p style={subtitleStyle}>CT/MRI增强复查、对比剂反应随访、肿瘤影像跟踪 · 闭环状态机 + 模板库</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* [v3.0.6.11-99 Wave3B] 数据源徽标 (真实/演示回退) */}
          <span style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
            background: dataSource === 'real' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: dataSource === 'real' ? '#059669' : '#d97706',
            border: `1px solid ${dataSource === 'real' ? '#bbf7d0' : '#fcd34d'}`,
          }}>
            {dataSource === 'real' ? '真实数据' : '演示回退'}
          </span>
          {/* [v3.0.6.11-103 Wave 1B] 报告→随访触发模式 (GET /followup-trigger-rules/mode) */}
          <span style={{
            fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
            background: triggerMode === 'auto' ? 'rgba(22,119,255,0.15)' : 'rgba(148,163,184,0.15)',
            color: triggerMode === 'auto' ? '#1677ff' : '#64748b',
            border: `1px solid ${triggerMode === 'auto' ? '#93c5fd' : '#e2e8f0'}`,
          }} data-testid="followup-trigger-mode">
            触发模式: {triggerMode === 'auto' ? '自动创建' : triggerMode === 'hint' ? '仅提示' : '—'}
          </span>
          <button style={{ ...buttonStyle, backgroundColor: '#1677ff' }} onClick={() => void openFromExam()}>
            <Calendar size={14} /> 检查联动
          </button>
          <button style={{ ...buttonStyle, backgroundColor: '#722ed1' }} onClick={openTemplates}>
            <LayoutTemplate size={14} /> 随访模板
          </button>
        </div>
      </div>

      {/* [v3.0.6.11-99 Wave3B] 统计卡: 完成率/失访率/异常率 (GET /followups/stats, 失败回退本地派生) */}
      <div style={statsContainerStyle}>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{displayStats.total}</div>
          <div style={statLabelStyle}>总随访数</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#52c41a' }}>{displayStats.completionRate}%</div>
          <div style={statLabelStyle}>完成率 ({displayStats.completed})</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#ff4d4f' }}>{displayStats.missRate}%</div>
          <div style={statLabelStyle}>失访率 ({displayStats.missed})</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#ff4d4f' }}>{displayStats.abnormalRate}%</div>
          <div style={statLabelStyle}>异常率·逾期 ({displayStats.overdue})</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#faad14' }}>{displayStats.pending}</div>
          <div style={statLabelStyle}>待随访</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#1677ff' }}>{displayStats.reminded}</div>
          <div style={statLabelStyle}>已提醒</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#1890ff' }}>{displayStats.inProgress}</div>
          <div style={statLabelStyle}>进行中</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#52c41a' }}>{displayStats.completed}</div>
          <div style={statLabelStyle}>已完成</div>
        </div>
      </div>

      {/* [v3.0.6.11-99 Wave10B] 随访趋势 / 类别分布 / 到期清单 深化面板 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* 近 6 月随访趋势 */}
        <div style={{ ...statCardStyle }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} /> 随访月度趋势 (byMonth)
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
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>暂无趋势数据</div>
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
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{b.month.slice(5)}月</span>
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
            <LayoutTemplate size={14} /> 随访类别分布 (byCategory)
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
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>暂无分类数据</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cats.slice(0, 6).map((c, i) => (
                  <div key={c.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.category}</span>
                      <span style={{ color: colors[i % colors.length], fontWeight: 700 }}>{c.count}</span>
                    </div>
                    <div style={{ height: 7, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden' }}>
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
            <BellRing size={14} /> 即将到期 (7 日内)
          </div>
          {dueList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={26} color="#52c41a" />
              未来 7 天无到期随访
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
                    {p.status === 'OVERDUE' ? '已逾期' : '待随访'}
                  </span>
                </div>
              ))}
              {dueList.length > 8 && (
                <div style={{ textAlign: 'center', padding: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                  另有 {dueList.length - 8} 项…
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <Bell size={11} style={{ verticalAlign: 'text-bottom' }} /> 到期提醒由 followupApi.due(7) 实时获取
          </div>
        </div>
      </div>

      <div style={searchBarStyle}>
        <input
          type="text"
          placeholder="搜索患者姓名或ID..."
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          style={inputStyle}
        />
        <button style={buttonStyle} onClick={() => { setSearchKeyword(''); }}><RotateCcw size={14} /> 重置</button>
        <button style={{...buttonStyle, backgroundColor: '#52c41a'}} onClick={() => setShowCreateModal(true)}><Plus size={14} /> 新增随访</button>
      </div>

      {/* [W4-B] 到期提醒横幅 (GET /followups/due?days=7) */}
      {dueList.length > 0 && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          backgroundColor: '#f9731622', border: '1px solid #ffd591',
          fontSize: '13px', color: '#ad6800'
        }}>
          <strong><BellRing size={14} style={{ verticalAlign: 'text-bottom' }} /> 即将到期 ({dueList.length})：</strong>
          {dueList.slice(0, 5).map(p => `${p.patientName}(${p.nextDate.slice(0, 10)})`).join('、')}
          {dueList.length > 5 && ` 等${dueList.length}项`}
        </div>
      )}

      {/* [W4-B] loading / error */}
      {loading && (
        <div style={{ marginBottom: '16px', padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <Loader2 size={14} style={{ verticalAlign: 'text-bottom' }} /> 加载随访计划中...
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
          ['all', '全部', displayStats.total],
          ['pending', '待随访', displayStats.pending],
          ['reminded', '已提醒', displayStats.reminded],
          ['inprogress', '进行中', displayStats.inProgress],
          ['completed', '已完成', displayStats.completed],
          ['overdue', '逾期', displayStats.overdue],
          ['missed', '已失访', displayStats.missed],
          ['cancelled', '已取消', displayStats.cancelled],
        ] as Array<[typeof activeTab, string, number]>).map(([key, label, count]) => (
          <button key={key} style={tabStyle(activeTab === key)} onClick={() => setActiveTab(key)}>
            {label} ({count})
          </button>
        ))}
      </div>

      {/* [v3.0.6.11-99 Wave10B] 视图切换: 列表 / 日历 / 按患者分组 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {([
          ['list', '列表视图'],
          ['calendar', '日历视图'],
          ['grouped', '按患者分组'],
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
          共 {filteredList.length} 条 · 患者 {groupedByPatient.length} 人
        </span>
      </div>

      {/* [v3.0.6.11-99 Wave10B] 日历视图 (计划日期分布) */}
      {viewMode === 'calendar' && (
        <div style={{ ...tableStyle, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>随访计划日历 · {calendarMonth}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={actionButtonStyle}
                onClick={() => {
                  const d = new Date(calendarMonth + '-01')
                  d.setMonth(d.getMonth() - 1)
                  setCalendarMonth(d.toISOString().slice(0, 7))
                }}
              >
                上月
              </button>
              <button
                style={actionButtonStyle}
                onClick={() => {
                  const d = new Date(calendarMonth + '-01')
                  d.setMonth(d.getMonth() + 1)
                  setCalendarMonth(d.toISOString().slice(0, 7))
                }}
              >
                下月
              </button>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
          }}>
            {['一', '二', '三', '四', '五', '六', '日'].map(w => (
              <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', padding: '6px 0' }}>
                {w}
              </div>
            ))}
            {(() => {
              const [y, m] = calendarMonth.split('-').map(Number)
              const first = new Date(y, m - 1, 1)
              const startPad = (first.getDay() + 6) % 7
              const daysInMonth = new Date(y, m, 0).getDate()
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
                              title={`${p.patientName} · ${p.status} · ${p.notes || ''}`}
                              onClick={() => { setSelectedPatient(p); setShowModal(true) }}
                              style={{
                                fontSize: 10, padding: '1px 4px', borderRadius: 3, cursor: 'pointer',
                                background: `${statusDotColor[p.status] || '#94a3b8'}22`,
                                color: statusDotColor[p.status] || '#64748b',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}
                            >
                              {p.patientName.slice(0, 4)}
                            </span>
                          ))}
                          {plans.length > 3 && (
                            <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>+{plans.length - 3} 项</span>
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
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 13 }}>暂无匹配的随访计划</div>
          )}
          {groupedByPatient.map(g => {
            const expanded = expandedPatients.has(g.patientId)
            const latest = g.items[0]
            const completedCount = g.items.filter(i => i.status === '已完成').length
            return (
              <div key={g.patientId} style={{ ...tableStyle, overflow: 'hidden' }}>
                <div
                  onClick={() => togglePatient(g.patientId)}
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
                      {g.items.length} 条计划 · 已完成 {completedCount} · 最近随访 {String(latest?.nextFollowUpDate || '').slice(0, 10)}
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
                          color: statusDotColor[s] || '#64748b',
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
                            {item.notes || item.followUpType || '随访计划'}
                            {item.examType && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-secondary)' }}>{item.examType}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            检查 {item.examDate} → 随访 {item.nextFollowUpDate}{item.intervalDays ? ` · 间隔 ${item.intervalDays} 天` : ''}
                          </div>
                        </div>
                        <span style={getStatusTagStyle(item.status)}>{item.status}</span>
                        <button
                          style={{ ...actionButtonStyle, backgroundColor: '#1890ff' }}
                          onClick={() => { setSelectedPatient(item); setShowModal(true) }}
                        >
                          <Eye size={12} /> 详情
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>患者信息</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>检查类型</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>随访类型</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>检查日期</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>随访日期</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>{item.patientName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.patientId}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={getExamTypeStyle(item.examType)}>{item.examType || '—'}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.followUpType || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.examDate}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.nextFollowUpDate}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={getStatusTagStyle(item.status)}>{item.status}</span>
                  {item.reason && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.reason}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    style={{...actionButtonStyle, display: 'flex', alignItems: 'center', gap: 4}}
                    onClick={() => { setSelectedPatient(item); setShowModal(true); }}
                  >
                    <Eye size={12} /> 详情
                  </button>
                  {/* [v3.0.6.11-99 Wave3B] 状态机行操作: 提醒/开始/完成/失访/取消/删除 */}
                  {(item.status === '待随访' || item.status === '逾期') && (
                    <button
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#1677ff', display: 'flex', alignItems: 'center', gap: 4}}
                      onClick={() => handleRemind(item)}
                    >
                      <Bell size={12} /> 提醒
                    </button>
                  )}
                  {!isTerminal(item.status) && item.status !== '进行中' && (
                    <button
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#722ed1', display: 'flex', alignItems: 'center', gap: 4}}
                      onClick={() => handleStart(item)}
                    >
                      <Play size={12} /> 开始
                    </button>
                  )}
                  {!isTerminal(item.status) && (
                    <button
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#52c41a', display: 'flex', alignItems: 'center', gap: 4}}
                      onClick={() => handleComplete(item.id)}
                    >
                      <CheckCircle size={12} /> 完成
                    </button>
                  )}
                  {!isTerminal(item.status) && (
                    <button
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#fa8c16', display: 'flex', alignItems: 'center', gap: 4}}
                      onClick={() => handleMiss(item)}
                    >
                      <UserX size={12} /> 失访
                    </button>
                  )}
                  {!isTerminal(item.status) && (
                    <button
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#1677ff', display: 'flex', alignItems: 'center', gap: 4}}
                      onClick={() => openEditPlan(item)}
                    >
                      <Pencil size={12} /> 编辑
                    </button>
                  )}
                  {!isTerminal(item.status) && (
                    <button
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#ff4d4f', display: 'flex', alignItems: 'center', gap: 4}}
                      onClick={() => handleCancel(item)}
                    >
                      <Ban size={12} /> 取消
                    </button>
                  )}
                  <button
                    style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4}}
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={12} />
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {showModal && selectedPatient && (
        <div style={modalOverlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>随访详情</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者姓名</label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.patientName}</div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者ID</label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.patientId}</div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>检查类型</label>
                <span style={getExamTypeStyle(selectedPatient.examType)}>{selectedPatient.examType || '—'}</span>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>随访类型</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.followUpType || '—'}</div>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>检查日期</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.examDate}</div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>随访日期</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.nextFollowUpDate}</div>
              </div>
            </div>

            {selectedPatient.reaction && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>对比剂反应</label>
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
              <label style={labelStyle}>备注信息</label>
              <div style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                padding: '12px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '4px',
                minHeight: '60px'
              }}>
                {selectedPatient.notes || '无'}
              </div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>更新随访状态</label>
              <select
                style={selectStyle}
                value={selectedPatient.status}
                onChange={async e => {
                  const v = e.target.value;
                  if (v === '已完成') { await handleComplete(selectedPatient.id); return; }
                  if (v === '进行中') { await handleStart(selectedPatient); return; }
                  if (v === '已失访') { await handleMiss(selectedPatient); return; }
                  if (v === '已取消') { await handleCancel(selectedPatient); return; }
                }}
              >
                <option value="">选择状态</option>
                <option value="已完成">已完成</option>
                <option value="进行中">进行中</option>
                <option value="已失访">已失访</option>
                <option value="已取消">已取消</option>
              </select>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowModal(false)}>取消</button>
              <button
                style={buttonStyle}
                onClick={() => handleComplete(selectedPatient.id)}
                disabled={isTerminal(selectedPatient.status)}
              >
                <CheckCircle size={14} /> 确认完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [W4-B] 新建随访计划 (POST /followups) */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>新建随访计划</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者ID *</label>
              <input
                type="text"
                value={newPlan.patientId}
                onChange={e => setNewPlan(f => ({ ...f, patientId: e.target.value }))}
                placeholder="例如 P202400001"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者姓名 *</label>
              <input
                type="text"
                value={newPlan.patientName}
                onChange={e => setNewPlan(f => ({ ...f, patientName: e.target.value }))}
                placeholder="患者姓名"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访日期 *</label>
                <input
                  type="date"
                  value={newPlan.planDate}
                  onChange={e => setNewPlan(f => ({ ...f, planDate: e.target.value }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>间隔天数</label>
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
                <label style={labelStyle}>来源检查 (检查联动)</label>
                <div style={{ fontSize: '13px', color: '#1677ff', background: '#e6f4ff', padding: '8px 12px', borderRadius: '4px' }}>
                  examId: {newPlan.examId}
                </div>
              </div>
            )}
            {newPlan.reportId && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>来源报告</label>
                <div style={{ fontSize: '13px', color: '#1677ff', background: '#e6f4ff', padding: '8px 12px', borderRadius: '4px' }}>
                  reportId: {newPlan.reportId}
                </div>
              </div>
            )}

            <div style={formGroupStyle}>
              <label style={labelStyle}>随访备注</label>
              <textarea
                value={newPlan.note}
                onChange={e => setNewPlan(f => ({ ...f, note: e.target.value }))}
                placeholder="随访内容 / 注意事项"
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
                启用到期提醒
              </label>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowCreateModal(false)}>取消</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#52c41a' }}
                onClick={() => void handleCreate()}
                disabled={saving}
              >
                <Save size={14} /> {saving ? '保存中...' : '保存计划'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-99 Wave3B] 随访模板库 Modal: 列表/新建/编辑/删除/应用(选患者) */}
      {showTemplateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowTemplateModal(false)}>
          <div style={{ ...modalStyle, width: '720px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>随访模板库</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              按病种 / 术式 / 检查类型配置默认间隔与随访项目，一键应用到患者批量生成随访计划
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
                {tplEditing ? '编辑模板' : '新建模板'}
                {tplEditing && (
                  <button
                    style={{ ...cancelButtonStyle, padding: '4px 12px', fontSize: '12px' }}
                    onClick={() => { setTplEditing(false); setTplForm({ name: '', category: '病种', intervals: '30,90,180', items: '', active: true }); }}
                  >
                    <X size={12} /> 取消编辑
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>模板名称 *</label>
                  <input
                    type="text"
                    value={tplForm.name}
                    onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="例如: 肿瘤术后复查(CT)"
                    style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>分类</label>
                  <select style={selectStyle} value={tplForm.category} onChange={e => setTplForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="病种">病种</option>
                    <option value="术式">术式</option>
                    <option value="检查类型">检查类型</option>
                  </select>
                </div>
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>间隔天数（逗号分隔，例: 30,90,180）*</label>
                <input
                  type="text"
                  value={tplForm.intervals}
                  onChange={e => setTplForm(f => ({ ...f, intervals: e.target.value }))}
                  placeholder="30,90,180"
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访项目（逗号分隔，例: 影像学复查,肿瘤标志物）</label>
                <input
                  type="text"
                  value={tplForm.items}
                  onChange={e => setTplForm(f => ({ ...f, items: e.target.value }))}
                  placeholder="影像学复查,肿瘤标志物"
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
                  启用模板
                </label>
              </div>
              <div style={modalButtonContainer}>
                <button
                  style={{ ...buttonStyle, backgroundColor: '#722ed1', padding: '8px 20px' }}
                  onClick={() => void saveTemplate()}
                  disabled={tplLoading}
                >
                  <Save size={13} /> {tplEditing ? '保存修改' : '创建模板'}
                </button>
              </div>
            </div>

            {/* 模板列表 */}
            {tplLoading && !templates.length ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Loader2 size={14} style={{ verticalAlign: 'text-bottom' }} /> 加载模板中...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflow: 'auto' }}>
                {templates.map(t => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {t.name}
                        <span style={{
                          fontSize: '11px', padding: '1px 8px', borderRadius: 10,
                          background: t.active ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.2)',
                          color: t.active ? '#059669' : '#64748b', fontWeight: 600
                        }}>
                          {t.active ? '启用' : '停用'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        分类: {t.category || '未分类'} · 间隔: {(t.intervals ?? []).join('/')}天 · 项目: {(t.items ?? []).join('、') || '—'}
                      </div>
                    </div>
                    <button style={{ ...actionButtonStyle, backgroundColor: '#52c41a', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => { setTplApply(t); setTplApplyForm(f => ({ ...f, planDate: new Date().toISOString().slice(0, 10) })); }}>
                      <Play size={12} /> 应用
                    </button>
                    <button style={{ ...actionButtonStyle, backgroundColor: '#1677ff', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => editTemplate(t)}>
                      <Pencil size={12} /> 编辑
                    </button>
                    <button style={{ ...actionButtonStyle, backgroundColor: '#ff4d4f', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => void deleteTemplate(t)}>
                      <Trash2 size={12} /> 删除
                    </button>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    暂无模板，请在上方创建
                  </div>
                )}
              </div>
            )}

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowTemplateModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-99 Wave3B] 模板应用弹窗: 选患者 → 按间隔批量生成 */}
      {tplApply && (
        <div style={modalOverlayStyle} onClick={() => setTplApply(null)}>
          <div style={{ ...modalStyle, width: '440px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>应用模板「{tplApply.name}」</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              将按间隔 {(tplApply.intervals ?? []).join('/')} 天为患者批量生成 {tplApply.intervals?.length ?? 0} 条随访计划
            </p>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者ID *</label>
              <input
                type="text"
                value={tplApplyForm.patientId}
                onChange={e => setTplApplyForm(f => ({ ...f, patientId: e.target.value }))}
                placeholder="例如 P202400001"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者姓名 *</label>
              <input
                type="text"
                value={tplApplyForm.patientName}
                onChange={e => setTplApplyForm(f => ({ ...f, patientName: e.target.value }))}
                placeholder="患者姓名"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>随访基准日期 *</label>
              <input
                type="date"
                value={tplApplyForm.planDate}
                onChange={e => setTplApplyForm(f => ({ ...f, planDate: e.target.value }))}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setTplApply(null)}>取消</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#52c41a' }}
                onClick={() => void applyTemplate()}
                disabled={tplLoading}
              >
                <Play size={14} /> {tplLoading ? '生成中...' : '确认应用'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-103 Wave 1B] 检查联动: 检查完成 → 自动创建随访计划 (POST /followups/from-exam) */}
      {showFromExamModal && (
        <div style={modalOverlayStyle} onClick={() => setShowFromExamModal(false)}>
          <div style={{ ...modalStyle, width: '460px' }} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>检查联动 (from-exam)</h2>
            <p style={{ ...subtitleStyle, marginTop: '-12px', marginBottom: '16px' }}>
              检查完成后 → 按模板间隔自动批量创建随访计划 (POST /followups/from-exam)
            </p>

            <div style={formGroupStyle}>
              <label style={labelStyle}>检查ID *</label>
              <input
                type="text"
                value={fromExamForm.examId}
                onChange={e => setFromExamForm(f => ({ ...f, examId: e.target.value }))}
                placeholder="例如 exam-001 或检查号"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>随访模板 (可选)</label>
              <select
                style={selectStyle}
                value={fromExamForm.templateId}
                onChange={e => setFromExamForm(f => ({ ...f, templateId: e.target.value }))}
              >
                <option value="">不指定模板（按默认间隔）</option>
                {fromExamTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}（{(t.intervals ?? []).join('/')}天）</option>
                ))}
              </select>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowFromExamModal(false)}>取消</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#1677ff' }}
                onClick={() => void handleFromExam()}
                disabled={fromExamBusy}
              >
                <Play size={14} /> {fromExamBusy ? '生成中...' : '确认联动'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-103 Wave 1B] 编辑随访计划 (PUT /followups/:id) */}
      {showEditModal && editPlan && (
        <div style={modalOverlayStyle} onClick={() => setShowEditModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>编辑随访计划 · {editPlan.patientId}</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者姓名 *</label>
              <input
                type="text"
                value={editForm.patientName}
                onChange={e => setEditForm(f => ({ ...f, patientName: e.target.value }))}
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访日期 *</label>
                <input
                  type="date"
                  value={editForm.planDate}
                  onChange={e => setEditForm(f => ({ ...f, planDate: e.target.value }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>间隔天数</label>
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
              <label style={labelStyle}>随访备注</label>
              <textarea
                value={editForm.note}
                onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                placeholder="随访内容 / 注意事项"
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
                启用到期提醒
              </label>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowEditModal(false)}>取消</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#1677ff' }}
                onClick={() => void handleEditPlan()}
                disabled={editBusy}
              >
                <Save size={14} /> {editBusy ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

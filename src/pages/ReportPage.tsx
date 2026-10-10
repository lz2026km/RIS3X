// G005 Radiology RIS - Report List v1.0.0
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FileText, Clock, AlertTriangle,
  BarChart3,
  Zap, Bookmark,
} from "lucide-react";
import { message, Modal, Input, Tag } from "antd";
import type { RadiologyReport } from "../types";
import { PageTemplate } from "../components/common/PageTemplate";
import { Card } from "../components/common/Card";
import { ActionButton } from "../components/common/ActionButton";
import { LoadingBanner, ErrorBanner, AppEmpty } from "../components/feedback";
import { useNavigate } from "react-router-dom";
import { toEnState } from "../components/report/statusMeta";
import { reportApi } from "../services/api";
// [W2-3] 导出审批流 / 危急值转入
import { exportApprovalApi } from "../services/api/analyticsApi";
import { criticalApi } from "../services/api/criticalApi";
// [v3.0.6.11-99 Wave7B] 离线报告包 (IndexedDB)
import { offlineStorage } from "../services/pwa/offlineStorage";
// [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪自动建
import { lesionTrackingApi } from "../services/api/lesionTrackingApi";
import { useReportStore } from "../store";
import { useRBAC } from "../hooks/useRBAC";
import { useAuth } from "../hooks/useAuth";
import { canApprove } from "../services/auth/rbacService";
import { t } from "../i18n/appI18n";
import MfaVerifyModal from "../components/security/MfaVerifyModal";
import ReportHeader from './report/ReportHeader';
import ReportTableView from './report/ReportTableView';
import ReportKanbanView from './report/ReportKanbanView';
import ReportDetailDrawer from './report/ReportDetailDrawer';
import { StatCard } from './report/ReportStatsBar';
import ReportExportModal from './report/ReportExportModal';
import ReportToolbar from './report/ReportToolbar';
import ReportReviewModal from './report/ReportReviewModal';
import ReportPageHeader from './report/ReportPageHeader';
import ReportBanners from './report/ReportBanners';
import ReportToast from './report/ReportToast';
import ReportAdvancedFilter from './report/ReportAdvancedFilter';
import { ReviewResultModal, BatchResultModal, PrintModal, BulkActionModal } from './report/ReportResultModals';
import ReportDiffModal, { type ReportDiffData } from './report/ReportDiffModal'; // [W2-3] 多版本并排对比
import ReportAuditTrailDrawer from './report/ReportAuditTrailDrawer'; // [W2-C] 审计轨迹 Drawer
import ReportCriticalModal from './report/ReportCriticalModal'; // [W2-3] 危急值一键转入
// [v3.0.6.11-103 Wave 2A] 报告统计报表 (overview/by-doctor/daily-trend)
import ReportStatsModal from './report/ReportStatsModal';
import { ACCENT, WARNING, DANGER, PURPLE, GRAY, WHITE, isToday } from './report/reportUtils';

// [v3.0.6.11-95 Wave2B P1] 筛选预置 (localStorage: report-filter-presets)
interface ReportFilterPreset {
  name: string
  filters: {
    search: string
    statusFilter: string
    modalityFilter: string
    reportDoctorFilter: string
    auditorFilter: string
    dateFrom: string
    dateTo: string
    criticalOnly: boolean
    positiveOnly: boolean
    qualityScoreFrom: number
    qualityScoreTo: number
  }
}

const QUEUE_DEFS = [
  { key: 'todo', labelKey: 'reportPage.queue.todo', color: 'var(--color-primary-800)' },
  { key: 'pendingReview', labelKey: 'reportPage.queue.pendingReview', color: '#7c3aed' },
  { key: 'critical', labelKey: 'reportPage.queue.critical', color: 'var(--color-error-600)' },
  { key: 'mine', labelKey: 'reportPage.queue.mine', color: '#059669' },
] as const

export default function ReportPage() {
  const navigate = useNavigate();
  const { checkAccess } = useRBAC();
  const { user } = useAuth();
  const [allReports, setAllReports] = useState<RadiologyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true); setAccessDenied(false);
      const canRead = checkAccess({ resource: { type: "report" }, action: "read", environment: { time: new Date(), location: user?.department } });
      if (!canRead) { if (!cancelled) { setAccessDenied(true); setLoading(false); } return; }
      const res = await reportApi.list({});
      if (cancelled) return;
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setAllReports(res.data as RadiologyReport[]); setLoadError(null);
      } else { setAllReports([]); setLoadError(t("reportPage.apiUnavailable")); }
      setLoading(false);
      // [W2-4] 患者详情"查看报告"跳转: /reports?reportId=xxx 自动打开详情抽屉
      //   列表分页(20)可能不含目标报告, 优先按 ID 精确拉取
      const reportId = new URLSearchParams(window.location.search).get("reportId");
      if (reportId && !cancelled) {
        const list = Array.isArray(res.data) ? (res.data as RadiologyReport[]) : [];
        const target = list.find((r) => r.id === reportId || r.reportId === reportId);
        if (target) {
          setDetailReport(target);
        } else {
          void (async () => {
            const detail = await reportApi.getById(reportId);
            if (!cancelled && detail.success && detail.data) {
              setDetailReport(detail.data as unknown as RadiologyReport);
            }
          })();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [checkAccess, user?.department, reloadTick]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [modalityFilter, setModalityFilter] = useState("全部");
  const [reportDoctorFilter, setReportDoctorFilter] = useState("");
  const [auditorFilter, setAuditorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [positiveOnly, setPositiveOnly] = useState(false);
  const [qualityScoreFrom, setQualityScoreFrom] = useState<number>(0);
  const [qualityScoreTo, setQualityScoreTo] = useState<number>(100);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [bulkActionModal, setBulkActionModal] = useState<{ show: boolean; action: string; count: number; loading: boolean }>({ show: false, action: "", count: 0, loading: false });
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // [v3.0.6.11-95 Wave2B P1] 快捷队列 (我的待办/待审核/危急值/仅我的报告) + 筛选预置持久化
  const [quickQueue, setQuickQueue] = useState<string | null>(null);
  const [filterPresets, setFilterPresets] = useState<ReportFilterPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem('report-filter-presets') || '[]') }
    catch { return [] }
  });
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({ show: false, message: "", type: "success" });
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast(t => ({ ...t, show: false })), 3000); };
  // [v3.0.6.11-103 Wave 2A] 报告统计报表 (overview/by-doctor/daily-trend)
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [exportModal, setExportModal] = useState<{ show: boolean; title: string; message: string; complete: boolean }>({ show: false, title: "", message: "", complete: false });
  const [reviewResultModal, setReviewResultModal] = useState<{ show: boolean; reportId: string; result: string; suggestion: string }>({ show: false, reportId: "", result: "", suggestion: "" });
  const [batchResultModal, setBatchResultModal] = useState<{ show: boolean; title: string; message: string; type: "success" | "error" }>({ show: false, title: "", message: "", type: "success" });
  const [printModal, setPrintModal] = useState<{ show: boolean; title: string; message: string }>({ show: false, title: "", message: "" });
  const [detailReport, setDetailReport] = useState<RadiologyReport | null>(null);
  const [reviewReport, setReviewReport] = useState<RadiologyReport | null>(null);
  const [mfaReportId, setMfaReportId] = useState<string | null>(null);
  // [W2-3] 多版本并排对比 / 危急值一键转入 / 真实导出
  const [diffModal, setDiffModal] = useState<{ report: RadiologyReport | null; data: ReportDiffData | null; loading: boolean }>({ report: null, data: null, loading: false });
  const [criticalModal, setCriticalModal] = useState<{ report: RadiologyReport | null; submitting: boolean }>({ report: null, submitting: false });
  const [exporting, setExporting] = useState(false);
  // [W2-C] 行删除 (WITHDRAWN) / 审计轨迹 Drawer
  const [auditReport, setAuditReport] = useState<RadiologyReport | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const todayReports = allReports.filter(r => isToday(r.createdTime));
    const thisWeek = allReports.filter(r => { if (!r.createdTime) return false; const d = new Date(r.createdTime); const now = new Date(); const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); return d >= weekStart; });
    const published = allReports.filter(r => r.publishedTime && r.createdTime);
    let avgTurnaround = 0;
    if (published.length > 0) { const totalHours = published.reduce((sum, r) => { const created = new Date(r.createdTime).getTime(); const pubTime = new Date(r.publishedTime!).getTime(); return sum + (pubTime - created) / (1000 * 60 * 60); }, 0); avgTurnaround = Math.round(totalHours / published.length); }
    return { todayTotal: todayReports.length, thisWeekTotal: thisWeek.length, pendingReview: allReports.filter(r => ['SUBMITTED', 'INITIAL_REVIEW'].includes(toEnState(r.status))).length, criticalCount: allReports.filter(r => r.criticalFinding).length, positiveCount: allReports.filter(r => r.diagnosis && r.diagnosis !== "结论：未见明显异常。").length, avgTurnaround };
  }, [allReports]);

  const filteredReports = useMemo(() => {
    const myId = user?.id
    return allReports.filter(r => {
      if (search) { const q = search.toLowerCase(); if (!r.patientName.toLowerCase().includes(q) && !r.reportId.toLowerCase().includes(q) && !r.examItemName.toLowerCase().includes(q) && !r.accessionNumber.toLowerCase().includes(q)) return false; }
      if (statusFilter !== "全部" && r.status !== statusFilter) return false;
      if (modalityFilter !== "全部" && r.modality !== modalityFilter) return false;
      // [v3.0.6.11-95 Wave2B P1] 医生筛选改比对 radiologistId/doctorId (DTO), 兼容历史按姓名过滤
      if (reportDoctorFilter) {
        const fid = String(reportDoctorFilter);
        const docIds = [r.reportDoctorId, (r as unknown as { radiologistId?: string }).radiologistId, (r as unknown as { doctorId?: string }).doctorId].filter(Boolean);
        if (!docIds.includes(fid) && r.reportDoctorName !== fid) return false;
      }
      if (auditorFilter) {
        const fid = String(auditorFilter);
        const audIds = [r.auditorId, (r as unknown as { reviewerId?: string }).reviewerId].filter(Boolean);
        if (!audIds.includes(fid) && r.auditorName !== fid) return false;
      }
      if (dateFrom && r.createdTime < dateFrom) return false;
      if (dateTo && r.createdTime > dateTo + " 23:59") return false;
      if (criticalOnly && !r.criticalFinding) return false;
      if (positiveOnly && (!r.diagnosis || r.diagnosis === "结论：未见明显异常。")) return false;
      const score = r.qualityScore || 0;
      if (score < qualityScoreFrom || score > qualityScoreTo) return false;
      // [v3.0.6.11-95 Wave2B P1] 快捷队列: 我的待办/待审核/危急值/仅我的报告
      if (quickQueue) {
        const isMine = myId ? (r.reportDoctorId === myId || (r as unknown as { radiologistId?: string }).radiologistId === myId || (r as unknown as { doctorId?: string }).doctorId === myId) : false;
        if (quickQueue === 'mine' && !isMine) return false;
        if (quickQueue === 'todo' && (!isMine || !['DRAFT', 'WRITING', 'ASSIGNED', 'PENDING_ASSIGNMENT', 'REJECTED'].includes(toEnState(r.status)))) return false;
        if (quickQueue === 'pendingReview' && !['SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW'].includes(toEnState(r.status))) return false;
        if (quickQueue === 'critical' && !r.criticalFinding) return false;
      }
      return true;
    });
  }, [allReports, search, statusFilter, modalityFilter, reportDoctorFilter, auditorFilter, dateFrom, dateTo, criticalOnly, positiveOnly, qualityScoreFrom, qualityScoreTo, quickQueue, user?.id]);

  const avgQuality = useMemo(() => { if (filteredReports.length === 0) return 0; const total = filteredReports.reduce((sum, r) => sum + (r.qualityScore || 0), 0); return Math.round(total / filteredReports.length); }, [filteredReports]);
  const criticalCount = filteredReports.filter(r => r.criticalFinding).length;
  const filteredStats = useMemo(() => ({ critical: filteredReports.filter(r => r.criticalFinding).length, pending: filteredReports.filter(r => ['SUBMITTED', 'INITIAL_REVIEW'].includes(toEnState(r.status))).length, published: filteredReports.filter(r => toEnState(r.status) === 'PUBLISHED').length }), [filteredReports]);

  const handleReset = () => { setSearch(""); setStatusFilter("全部"); setModalityFilter("全部"); setReportDoctorFilter(""); setAuditorFilter(""); setDateFrom(""); setDateTo(""); setCriticalOnly(false); setPositiveOnly(false); setQualityScoreFrom(0); setQualityScoreTo(100); setQuickQueue(null); };

  // [v3.0.6.11-95 Wave2B P1] 筛选预置持久化 (参考 WorklistPage worklist-filter-presets 模式)
  const currentFilters: ReportFilterPreset['filters'] = { search, statusFilter, modalityFilter, reportDoctorFilter, auditorFilter, dateFrom, dateTo, criticalOnly, positiveOnly, qualityScoreFrom, qualityScoreTo };
  const applyPreset = (p: ReportFilterPreset) => {
    const f = p.filters;
    setSearch(f.search); setStatusFilter(f.statusFilter); setModalityFilter(f.modalityFilter);
    setReportDoctorFilter(f.reportDoctorFilter); setAuditorFilter(f.auditorFilter);
    setDateFrom(f.dateFrom); setDateTo(f.dateTo); setCriticalOnly(f.criticalOnly);
    setPositiveOnly(f.positiveOnly); setQualityScoreFrom(f.qualityScoreFrom); setQualityScoreTo(f.qualityScoreTo);
    setQuickQueue(null);
    showToast(t('w9c.reportPage.presetLoaded', { name: p.name }), 'info');
  };
  const saveCurrentPreset = () => {
    const name = savePresetName.trim();
    if (!name) return;
    const newPresets = [...filterPresets.filter(p => p.name !== name), { name, filters: currentFilters }];
    setFilterPresets(newPresets);
    localStorage.setItem('report-filter-presets', JSON.stringify(newPresets));
    setSavePresetName(''); setShowSavePreset(false);
    showToast(t('w9c.reportPage.presetSaved', { name }), 'success');
  };
  const deletePreset = (name: string) => {
    const newPresets = filterPresets.filter(p => p.name !== name);
    setFilterPresets(newPresets);
    localStorage.setItem('report-filter-presets', JSON.stringify(newPresets));
    showToast(t('w9c.reportPage.presetDeleted', { name }), 'info');
  };
  const toggleQueue = (key: string) => setQuickQueue(prev => (prev === key ? null : key));
  const activeQueue = QUEUE_DEFS.find(q => q.key === quickQueue) ?? null;

  // [v3.0.6.11-95 Wave2B P1] 报告列表 → 书写页入口
  const handleWriteReport = (r: RadiologyReport) => { navigate(`/reports/v3-write?reportId=${encodeURIComponent(r.id)}`); };

  // [W2-3] 导出真实化: 后端入队 → 轮询状态 → 下载 (不再 setTimeout 假完成)
  const runRealExport = async (list: RadiologyReport[], title: string) => {
    if (list.length === 0) { showToast(t("reportPage.noExportable"), "error"); return; }
    if (exporting) return;
    setExporting(true);
    setExportModal({ show: true, title, message: t('w9c.reportPage.exportQueued', { count: list.length }), complete: false });
    let done = 0; let failed = 0;
    for (const r of list) {
      try {
        const res = await reportApi.exportReport(r.id, 'pdf');
        if (!res.success) { failed++; continue; }
        let ready = false;
        for (let i = 0; i < 15; i++) {
          await new Promise(s => setTimeout(s, 300));
          try {
            const statusRes = await reportApi.exportStatus(r.id);
            if (statusRes.success && statusRes.data?.status && String(statusRes.data.status).toLowerCase() === 'completed') {
              // [v3.0.6.11-88 P0] 下载走 reportApi.downloadExportFile (Authorization 头),
              // 文件地址优先取后端 fileUrl, MSW 兼容旧 downloadUrl 字段
              const fileUrl = statusRes.data.fileUrl ?? statusRes.data.downloadUrl;
              if (fileUrl) {
                const fileName = decodeURIComponent(fileUrl.split('/').pop() ?? `${r.reportId || r.id}.pdf`);
                const blobRes = await reportApi.downloadExportFile(fileName);
                if (blobRes.success && blobRes.data) {
                  const blob = blobRes.data as unknown as Blob;
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${r.reportId || r.id}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  ready = true;
                }
              }
              if (ready) break;
            }
          } catch { /* 未就绪, 继续轮询 */ }
        }
        if (!ready) { failed++; continue; }
        done++;
      } catch { failed++; }
      setExportModal(m => ({ ...m, message: t('w9c.reportPage.exportInProgress', { done, failed }) }));
    }
    setExporting(false);
    setExportModal(m => ({ ...m, complete: true, message: t('w9c.reportPage.exportComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : "" }) }));
    showToast(t('w9c.reportPage.exportComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : "" }), failed > 0 ? "info" : "success");
    setTimeout(() => setExportModal(m => ({ ...m, show: false })), 2500);
  };

  const handleExport = () => { void runRealExport(filteredReports, t('w9c.reportPage.exportReport')); };

  // [W2-3] 修订: 调 reportApi.revise (AMENDING) → 跳转修订页
  const handleRevise = async (r: RadiologyReport) => {
    try {
      const res = await reportApi.revise(r.id);
      if (res.success) {
        setAllReports(prev => prev.map(x => (x.id === r.id ? { ...x, status: '修订中' } : x)));
        showToast(t('w9c.reportPage.reviseStarted', { id: r.reportId }), 'success');
        navigate(`/report-revisions?reportId=${r.id}`);
      } else {
        showToast(t('w9c.reportPage.reviseFailed', { msg: res.error?.message ?? t('w9c.reportPage.unknownError') }), 'error');
      }
    } catch { showToast(t('reportPage.reviseNetError'), 'error'); }
  };

  // [W2-3] 补发: transition → PUBLISHED 重新发布
  const handleRepublish = async (r: RadiologyReport) => {
    try {
      const res = await reportApi.publish(r.id);
      if (res.success) {
        setAllReports(prev => prev.map(x => (x.id === r.id ? { ...x, status: '已发布', publishedTime: new Date().toISOString(), publishedBy: user?.name ?? t('w9c.reportPage.currentUser') } : x)));
        showToast(t('w9c.reportPage.republishSuccess', { id: r.reportId }), 'success');
      } else {
        showToast(t('w9c.reportPage.republishFailed', { msg: res.error?.message ?? t('w9c.reportPage.unknownError') }), 'error');
      }
    } catch { showToast(t('reportPage.republishNetError'), 'error'); }
  };

  // [W2-3] 发布审批流: exportApprovalApi.request → 跳转导出审批中心
  const handleRequestApproval = async (r: RadiologyReport) => {
    try {
      const res = await exportApprovalApi.request({
        resource: 'REPORT',
        resourceId: r.id,
        reason: t('w9c.reportPage.approvalReason', { id: r.reportId, patient: r.patientName, exam: r.examItemName }),
      });
      if (res.success) {
        showToast(t('reportPage.approvalSubmitted'), 'success');
        navigate('/export/approval');
      } else {
        showToast(t('w9c.reportPage.approvalFailed', { msg: res.error?.message ?? t('w9c.reportPage.unknownError') }), 'error');
      }
    } catch { showToast(t('reportPage.approvalNetError'), 'error'); }
  };

  // [W2-3] 分发管理: 跳转推送中心并携带 reportId
  const handleDeliver = (r: RadiologyReport) => { navigate(`/report-delivery?reportId=${r.id}`); };

  // [W2-3] 危急值一键转入 ([G005 Wave 8] 携带 reportId → 报告详情反查关联危急值)
  const handleCriticalSubmit = async (r: RadiologyReport, severity: string, description: string, method: string) => {
    setCriticalModal(m => ({ ...m, submitting: true }));
    try {
      const res = await criticalApi.create({ examId: r.examId, severity, description, method, reportId: r.id });
      if (res.success) {
        setAllReports(prev => prev.map(x => (x.id === r.id ? { ...x, criticalFinding: true, criticalFindingDetails: description } : x)));
        setCriticalModal({ report: null, submitting: false });
        showToast(t('w9c.reportPage.criticalTransferred', { id: r.reportId }), 'success');
        navigate('/critical-value');
      } else {
        setCriticalModal(m => ({ ...m, submitting: false }));
        showToast(t('w9c.reportPage.criticalTransferFailed', { msg: res.error?.message ?? t('w9c.reportPage.unknownError') }), 'error');
      }
    } catch {
      setCriticalModal(m => ({ ...m, submitting: false }));
      showToast(t('reportPage.criticalTransferNetError'), 'error');
    }
  };

  // [W2-3] 多版本并排对比: reportApi.diff + computeDiff 高亮
  const handleCompare = async (r: RadiologyReport) => {
    setDiffModal({ report: r, data: null, loading: true });
    try {
      const res = await reportApi.diff(r.id);
      const d = (res.data ?? {}) as Record<string, unknown>;
      const oldVersion = (d.oldVersion ?? d.previous ?? {}) as Record<string, unknown>;
      const newVersion = (d.newVersion ?? d.current ?? {}) as Record<string, unknown>;
      const changes = (d.changes ?? d.diff ?? []) as ReportDiffData['changes'];
      // [G005 W8-Report] 内容版本快照真实字段差异 (后端 diff 返回 source=snapshot + fields)
      const fields = Array.isArray(d.fields) ? (d.fields as ReportDiffData['fields']) : undefined;
      const changedFields = Array.isArray(d.changedFields) ? (d.changedFields as string[]) : undefined;
      setDiffModal({ report: r, data: { oldVersion, newVersion, changes, fields, changedFields, source: String(d.source ?? '') }, loading: false });
    } catch {
      const { examFindings, diagnosis, impression } = r;
      setDiffModal({
        report: r,
        data: {
          oldVersion: { findings: examFindings ?? '', impression: impression || diagnosis || '' },
          newVersion: { findings: (examFindings ?? '') + '', impression: (impression || diagnosis || '') + '' },
          changes: [],
        },
        loading: false,
      });
    }
  };

  const handlePrint = () => { window.print(); };

  // [W2-C] 行删除: reportApi.remove (DELETE /reports/:id + reason → WITHDRAWN)
  const handleDeleteReport = async (r: RadiologyReport) => {
    if (deletingIds.has(r.id)) return;
    setDeletingIds(prev => new Set(prev).add(r.id));
    try {
      const res = await reportApi.remove(r.id, t('w9c.reportPage.deleteReason', { name: user?.name ?? t('w9c.reportPage.currentUser') }));
      if (res.success) {
        setAllReports(prev => prev.filter(x => x.id !== r.id));
        showToast(t('w9c.reportPage.deleteSuccess', { id: r.reportId }), 'success');
      } else {
        showToast(t('w9c.reportPage.deleteFailed', { msg: res.error?.message ?? t('w9c.reportPage.unknownError') }), 'error');
      }
    } catch {
      showToast(t('reportPage.deleteNetError'), 'error');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }
  };

  // [W2-C] 审计轨迹: reportApi.auditTrail → Drawer 展示修订历史
  const handleAuditTrail = (r: RadiologyReport) => { setAuditReport(r); };

  // [v3.0.6.11-95 Wave3B P1] 患者画像入口: /patients/:id/360 (Patient360Page 按 :id 参数拉取患者全景)
  const handleOpen360 = (r: RadiologyReport) => {
    if (!r.patientId) { showToast(t('reportPage.missingPatient'), 'error'); return; }
    navigate(`/patients/${encodeURIComponent(r.patientId)}/360`);
  };

  // [v3.0.6.11-92 Wave1B P0] 报告→随访入口: 携带 patientId + reportId
  const handleCreateFollowUp = (r: RadiologyReport) => {
    const q = new URLSearchParams()
    if (r.patientId) q.set('patientId', r.patientId)
    q.set('reportId', r.id)
    navigate(`/follow-up?${q.toString()}`);
  };

  // [v3.0.6.11-100 Wave 2A] 报告→委员会会诊室 (多医生合议): 携带 reportId 直达
  const handleCommittee = (r: RadiologyReport) => {
    navigate(`/committee-room?reportId=${encodeURIComponent(r.id)}`);
  };

  // [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪自动建: 从报告文本提取病灶关键词建档 → 跳转病灶追踪工作台
  const handleCreateLesionTracking = async (r: RadiologyReport) => {
    try {
      const res = await lesionTrackingApi.createFromReport(r.id);
      if (res.success && res.data) {
        const created = Array.isArray(res.data.created) ? res.data.created : [];
        if (created.length > 0) {
          showToast(t('w9c.reportPage.lesionCreated', { count: created.length }), 'success');
          const pid = created[0]?.patientId ?? r.patientId;
          navigate(`/dicom/lesion-tracking?patientId=${encodeURIComponent(pid ?? '')}`);
        } else {
          showToast(t('reportPage.noTrackableLesion'), 'info');
        }
      } else {
        showToast(res.error?.message ?? t('reportPage.lesionCreateFailed'), 'error');
      }
    } catch {
      showToast(t('reportPage.lesionCreateNetError'), 'error');
    }
  };

  // [v3.0.6.11-99 Wave7B] 离线报告包: 保存报告 HTML 快照 → IndexedDB (断网可离线浏览)
  const handleOfflineSave = async (r: RadiologyReport) => {
    try {
      const esc = (s?: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
      const html = [
        `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${t('w9c.reportPage.offlineTitle')}</title>`,
        '<style>body{font-family:-apple-system,sans-serif;max-width:760px;margin:0 auto;padding:24px;color:#1e293b;line-height:1.8}h1{font-size:20px;border-bottom:2px solid var(--color-primary-800);padding-bottom:8px;margin-bottom:8px}.meta{color:#64748b;font-size:12px;margin-bottom:16px}label{font-weight:600;color:var(--color-primary-800);display:block;margin:14px 0 4px;font-size:13px}section{white-space:pre-wrap;font-size:13px;background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0}</style>',
        `</head><body><h1>${t('w9c.reportPage.offlineHeading')}</h1><div class="meta">${t('w9c.reportPage.offlinePatientMeta', { patient: esc(r.patientName), modality: esc(r.modality), bodyPart: esc(r.bodyPart), reportId: esc(r.reportId), accession: esc(r.accessionNumber) })}<br/>${t('w9c.reportPage.offlineSavedAt', { time: new Date().toLocaleString('zh-CN') })}</div>`,
        `<label>${t('w9c.reportPage.offlineFindings')}</label><section>${esc(r.examFindings)}</section>`,
        `<label>${t('w9c.reportPage.offlineDiagnosis')}</label><section>${esc(r.diagnosis)}</section>`,
        `<label>${t('w9c.reportPage.offlineImpression')}</label><section>${esc(r.impression)}</section>`,
        `<p style="font-size:12px;color:#94a3b8;margin-top:20px">${t('w9c.reportPage.offlineDisclaimer')}</p></body></html>`,
      ].join('');
      await offlineStorage.saveReport({
        id: r.id,
        patientId: r.patientId ?? '',
        reportText: [r.examFindings, r.diagnosis, r.impression].filter(Boolean).join('\n'),
        findings: r.examFindings ?? '',
        conclusion: r.impression ?? r.diagnosis ?? '',
        synced: true,
        htmlContent: html,
        patientName: r.patientName,
        modality: r.modality,
        bodyPart: r.bodyPart,
        accessionNumber: r.accessionNumber,
        reportNo: r.reportId,
        state: toEnState(r.status),
        savedAt: Date.now(),
        updatedAt: Date.now(),
      });
      showToast(t('w9c.reportPage.offlineSaved', { id: r.reportId }), 'success');
    } catch {
      showToast(t('reportPage.offlineSaveFailed'), 'error');
    }
  };

  // [v3.0.6.11-92 Wave1B P0] 报告特殊态: 补充报告/整改/跨院区重分配/升级 (失败回退提示)
  const handleReportSpecial = async (r: RadiologyReport, action: 'supplement' | 'rectify' | 'redistribute' | 'escalate', reason?: string) => {
    try {
      const res =
        action === 'supplement'
          ? await reportApi.supplement(r.id, reason)
          : action === 'rectify'
            ? await reportApi.rectify(r.id, reason)
            : action === 'redistribute'
              ? await reportApi.redistribute(r.id, reason)
              : await reportApi.escalate(r.id, reason);
      if (res.success) {
        setAllReports(prev => prev.map(x => {
          if (x.id !== r.id) return x
          if (action === 'supplement') return { ...x, status: '补充中' }
          if (action === 'rectify') return { ...x, status: '整改中' }
          if (action === 'redistribute') return { ...x, status: '跨院区重分配' }
          return { ...x, status: '已升级' }
        }));
        showToast(t('w9c.reportPage.specialActionDone', { id: r.reportId, result: action === 'supplement' ? t('w9c.reportPage.specialSupplementStarted') : action === 'rectify' ? t('w9c.reportPage.specialRectifyStarted') : action === 'redistribute' ? t('w9c.reportPage.specialRedistributeStarted') : t('w9c.reportPage.specialEscalated') }), 'success');
      } else {
        showToast(t('w9c.reportPage.actionFailed', { action: actionLabel(action), msg: res.error?.message ?? t('w9c.reportPage.unknownError') }), 'error');
      }
    } catch (e) {
      showToast(t('w9c.reportPage.actionFailed', { action: actionLabel(action), msg: e instanceof Error ? e.message : t('w9c.reportPage.networkError') }), 'error');
    }
  };
  const actionLabel = (a: string) => a === 'supplement' ? t('w9c.reportPage.actionSupplement') : a === 'rectify' ? t('w9c.reportPage.actionRectify') : a === 'redistribute' ? t('w9c.reportPage.actionRedistribute') : t('w9c.reportPage.actionEscalate');
  const handleToggleSelect = useCallback((id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, []);
  const handleSelectAll = useCallback(() => { setSelectedIds(new Set(filteredReports.map(r => r.id))); }, [filteredReports]);
  const handleDeselectAll = useCallback(() => { setSelectedIds(new Set()); }, []);
  const handleReviewSubmit = async (reportId: string, result: "approved" | "rejected", suggestion: string, _password: string) => {
    try {
      if (result === "approved") {
        const report = allReports.find(r => r.id === reportId);
        if (report && !canApprove(user?.id ?? '', report.reportDoctorId ?? '')) {
          message.error(t('reportPage.selfReviewForbidden'));
          return;
        }
        await useReportStore.getState().review(reportId, 'initial', user?.id ?? '', user?.name ?? '', suggestion, 0);
        setMfaReportId(reportId);
      } else {
        await useReportStore.getState().reject(reportId, suggestion || '');
        setReviewReport(null);
        setReviewResultModal({ show: true, reportId, result: "已退回", suggestion: suggestion || "(无)" });
      }
    } catch {
      message.error(t('reportPage.reviewSubmitNetError'));
    }
  };

  const handleMfaVerified = async (_token: string) => {
    const reportId = mfaReportId;
    setMfaReportId(null);
    if (!reportId) return;
    try {
      await useReportStore.getState().sign(reportId);
      setReviewReport(null);
      setReviewResultModal({ show: true, reportId, result: "已审核", suggestion: "(MFA已验证)" });
    } catch {
      setReviewReport(null);
      message.error(t('reportPage.mfaSignNetError'));
    }
  };

  return (
    <PageTemplate background="slate" maxWidth="wide" padding={0} showHeader={false} testId="report-page">
      {accessDenied && <div style={{ padding: 'var(--space-6, 24px)', margin: 'var(--space-6, 24px)', background: "var(--color-error-bg)", border: "1px solid #fca5a5", color: "#7f1d1d", borderRadius: 8, fontSize: 14 }}>{t("reportPage.accessDenied")}</div>}
      {loading && <LoadingBanner message={t("reportPage.loading")} />}
      {loadError && !loading && <ErrorBanner message={loadError} onRetry={() => setReloadTick(n => n + 1)} retryLabel={t('w9.states.retry')} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.3); } } @keyframes criticalPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); } }`}</style>

      <ReportPageHeader selectedIds={selectedIds} allReports={allReports} setReviewReport={setReviewReport} showToast={showToast} />

      <div className="no-print" style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 24px" }}>
        <div className="report-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 'var(--space-3, 12px)', marginBottom: 14 }}>
          <StatCard label={t("reportPage.stat.todayReports")} value={stats.todayTotal} icon={<FileText size={20} />} color={ACCENT} sub={t('w9c.reportPage.weekTotalSub', { count: stats.thisWeekTotal })} />
          <StatCard label={t("reportPage.stat.pendingReview")} value={stats.pendingReview} icon={<Clock size={20} />} color={PURPLE} sub={t('w9c.reportPage.pendingShareSub', { pct: stats.pendingReview > 0 ? Math.round((stats.pendingReview / allReports.length) * 100) : 0 })} />
          <StatCard label={t("reportPage.stat.criticalReports")} value={stats.criticalCount} icon={<Zap size={20} />} color={DANGER} sub={t('w9c.reportPage.criticalPositiveSub', { count: filteredStats.critical })} />
          <StatCard label={t("reportPage.stat.positive")} value={stats.positiveCount} icon={<AlertTriangle size={20} />} color={WARNING} sub={t('w9c.reportPage.positiveRateSub', { pct: allReports.length > 0 ? Math.round((stats.positiveCount / allReports.length) * 100) : 0 })} />
          <StatCard label={t("reportPage.stat.avgTurnaround")} value={stats.avgTurnaround} icon={<Clock size={20} />} color="var(--color-info-600)" sub={t("reportPage.stat.hoursTip")} />
          <StatCard label={t("reportPage.stat.weekTotal")} value={stats.thisWeekTotal} icon={<BarChart3 size={20} />} color="#7c3aed" sub={t("reportPage.stat.weekTotalTip")} />
        </div>
        {/* [v3.0.6.11-103 Wave 2A] 报告统计报表入口: overview / by-doctor / daily-trend */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <ActionButton
            action="refresh"
            size="compact"
            icon={<BarChart3 size={13} />}
            testId="report-stats-open"
            onClick={() => setStatsModalOpen(true)}
          >
            {t("reportPage.statsReport")}
          </ActionButton>
        </div>

        <ReportBanners />

        {/* [v3.0.6.11-95 Wave2B P1] 快捷队列 + 筛选预置持久化 */}
        <Card padding="sm" testId="report-queues-card" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)', flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: GRAY, fontWeight: 700, marginRight: 'var(--space-1, 4px)' }}>{t("reportPage.quickQueue")}</span>
          {QUEUE_DEFS.map(q => (
            <button key={q.key} onClick={() => toggleQueue(q.key)} style={{
              padding: "4px 10px", borderRadius: 6, border: `1px solid ${quickQueue === q.key ? q.color : "var(--border-color)"}`,
              background: quickQueue === q.key ? `${q.color}18` : WHITE, color: quickQueue === q.key ? q.color : GRAY,
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{quickQueue === q.key ? "" : ""}{t(q.labelKey)}</button>
          ))}
          <span style={{ width: 1, height: 18, background: "var(--border-color)", margin: "0 6px" }} />
          <ActionButton
            action="save"
            size="compact"
            onClick={() => setShowSavePreset(true)}
          >
            {t("reportPage.saveFilter")}
          </ActionButton>
          {filterPresets.map(p => (
            <Tag key={p.name} color="geekblue" closable style={{ cursor: "pointer", margin: 0 }}
              onClick={(e) => { e.stopPropagation(); applyPreset(p); }}
              onClose={(e) => { e.preventDefault(); deletePreset(p.name); }}
              title={t('w9c.reportPage.presetTagTooltip', { name: p.name })}
            >{p.name}</Tag>
          ))}
          {activeQueue && <Tag color="blue" closable onClose={() => setQuickQueue(null)}>{t("reportPage.currentQueue")}: {t(activeQueue.labelKey)}</Tag>}
        </Card>

        <div className="report-filters"><ReportHeader search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} modalityFilter={modalityFilter} setModalityFilter={setModalityFilter} reportDoctorFilter={reportDoctorFilter} setReportDoctorFilter={setReportDoctorFilter} auditorFilter={auditorFilter} setAuditorFilter={setAuditorFilter} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} criticalOnly={criticalOnly} setCriticalOnly={setCriticalOnly} positiveOnly={positiveOnly} setPositiveOnly={setPositiveOnly} onReset={handleReset} onExport={handleExport} onPrint={handlePrint} /></div>

        <ReportAdvancedFilter showAdvancedFilter={showAdvancedFilter} setShowAdvancedFilter={setShowAdvancedFilter} qualityScoreFrom={qualityScoreFrom} setQualityScoreFrom={setQualityScoreFrom} qualityScoreTo={qualityScoreTo} setQualityScoreTo={setQualityScoreTo} />

        <ReportToolbar viewMode={viewMode} setViewMode={setViewMode} avgQuality={avgQuality} criticalCount={criticalCount} selectedIds={selectedIds} filteredStats={filteredStats} filteredReports={filteredReports} allReports={allReports} setDetailReport={setDetailReport} setReviewReport={setReviewReport} setExportModal={setExportModal} setPrintModal={setPrintModal} setBulkActionModal={setBulkActionModal} showToast={showToast} setStatusFilter={setStatusFilter} onBulkExport={(list) => void runRealExport(list, t('w9c.reportPage.bulkExport'))} />

        {!loading && !loadError && filteredReports.length === 0 && (
          <div className="no-print" style={{ background: WHITE, borderRadius: 10, border: "1px solid var(--border-color)" }}>
            <AppEmpty variant="no-results" description={t("w9.states.noResults")} />
          </div>
        )}

        <div className="no-print" style={{ display: !loading && !loadError && filteredReports.length === 0 ? "none" : undefined }}>
          {viewMode === "list" ? (
            <ReportTableView reports={filteredReports} loading={loading} expandedId={expandedId} onToggleExpand={id => setExpandedId(prev => (prev === id ? null : id))} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} onView={r => setDetailReport(r)} onReview={r => setReviewReport(r)} onPrint={r => { setDetailReport(r); }} onReject={r => { setDetailReport(r); }} onExportPDF={r => { void runRealExport([r], t('w9c.reportPage.exportPdf')); }} onRevise={handleRevise} onRepublish={handleRepublish} onRequestApproval={handleRequestApproval} onDeliver={handleDeliver} onCritical={r => setCriticalModal({ report: r, submitting: false })} onCompare={handleCompare} onDelete={handleDeleteReport} onAudit={handleAuditTrail} onCreateFollowUp={handleCreateFollowUp} onSupplement={r => void handleReportSpecial(r, 'supplement')} onRectify={r => void handleReportSpecial(r, 'rectify')} onRedistribute={r => void handleReportSpecial(r, 'redistribute')} onEscalate={r => void handleReportSpecial(r, 'escalate')} onWrite={handleWriteReport} onOpen360={handleOpen360} onOfflineSave={handleOfflineSave} deletingIds={deletingIds} />
          ) : (
            <ReportKanbanView reports={filteredReports} onView={r => setDetailReport(r)} onReview={r => setReviewReport(r)} />
          )}
        </div>
      </div>

      {detailReport && <ReportDetailDrawer report={detailReport} onClose={() => setDetailReport(null)} onReview={r => { setDetailReport(null); setReviewReport(r); }} onPrint={() => { setDetailReport(null); setTimeout(() => window.print(), 100); }} onExportPDF={r => { setDetailReport(null); void runRealExport([r], t('w9c.reportPage.exportPdf')); }} onGenerateSr={r => navigate(`/dicom/sr-report?reportId=${r.id}`)} onRevise={handleRevise} onRepublish={handleRepublish} onRequestApproval={handleRequestApproval} onDeliver={handleDeliver} onCritical={r => { setDetailReport(null); setCriticalModal({ report: r, submitting: false }); }} onCompare={r => { setDetailReport(null); void handleCompare(r); }} onCreateFollowUp={r => { setDetailReport(null); handleCreateFollowUp(r); }} onCreateLesionTracking={r => { setDetailReport(null); void handleCreateLesionTracking(r); }} onSupplement={r => void handleReportSpecial(r, 'supplement')} onRectify={r => void handleReportSpecial(r, 'rectify')} onRedistribute={r => void handleReportSpecial(r, 'redistribute')} onEscalate={r => void handleReportSpecial(r, 'escalate')} onWrite={r => { setDetailReport(null); handleWriteReport(r); }} onOpen360={r => { setDetailReport(null); handleOpen360(r); }} onOfflineSave={handleOfflineSave} onCommittee={r => { setDetailReport(null); handleCommittee(r); }} />}

      {reviewReport && <ReportReviewModal report={reviewReport} onClose={() => setReviewReport(null)} onSubmit={handleReviewSubmit} />}

      {mfaReportId && user?.id && (
        <MfaVerifyModal
          userId={user.id}
          onVerified={handleMfaVerified}
          onCancel={() => setMfaReportId(null)}
          operation="report.sign"
        />
      )}

      {/* [W2-3] 多版本并排对比 */}
      <ReportDiffModal report={diffModal.report} data={diffModal.data} loading={diffModal.loading} onClose={() => setDiffModal({ report: null, data: null, loading: false })} />

      {/* [W2-C] 审计轨迹 */}
      <ReportAuditTrailDrawer report={auditReport} onClose={() => setAuditReport(null)} />

      {/* [W2-3] 危急值一键转入 */}
      <ReportCriticalModal report={criticalModal.report} submitting={criticalModal.submitting} onClose={() => setCriticalModal({ report: null, submitting: false })} onSubmit={(severity, description, method) => { if (criticalModal.report) void handleCriticalSubmit(criticalModal.report, severity, description, method); }} />

      <ReportToast show={toast.show} message={toast.message} type={toast.type} />

      {/* [v3.0.6.11-103 Wave 2A] 报告统计报表 (overview/by-doctor/daily-trend) */}
      <ReportStatsModal open={statsModalOpen} onClose={() => setStatsModalOpen(false)} />

      {/* [v3.0.6.11-95 Wave2B P1] 保存当前筛选为快捷预置 */}
      <Modal title={<span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}><Bookmark size={15} style={{ color: 'var(--color-primary-800)' }} />{t("reportPage.savePresetTitle")}</span>} open={showSavePreset} onCancel={() => setShowSavePreset(false)} onOk={saveCurrentPreset} okText={t("reportPage.save")} cancelText={t("reportPage.cancel")} width={420} destroyOnHidden>
        <Input value={savePresetName} onChange={e => setSavePresetName(e.target.value)} onPressEnter={saveCurrentPreset} placeholder={t("reportPage.presetNamePlaceholder")} allowClear style={{ marginTop: 'var(--space-2, 8px)' }} />
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginTop: 'var(--space-2, 8px)' }}>{t("reportPage.presetHelp")}</div>
      </Modal>
      <ReportExportModal show={exportModal.show} title={exportModal.title} message={exportModal.message} complete={exportModal.complete} onClose={() => setExportModal(e => ({ ...e, show: false }))} />
      <ReviewResultModal show={reviewResultModal.show} reportId={reviewResultModal.reportId} result={reviewResultModal.result} suggestion={reviewResultModal.suggestion} onClose={() => setReviewResultModal(r => ({ ...r, show: false }))} />
      <BatchResultModal show={batchResultModal.show} title={batchResultModal.title} message={batchResultModal.message} type={batchResultModal.type} onClose={() => setBatchResultModal(b => ({ ...b, show: false }))} />
      <PrintModal show={printModal.show} title={printModal.title} message={printModal.message} onClose={() => setPrintModal(p => ({ ...p, show: false }))} onPrint={() => { setPrintModal(p => ({ ...p, show: false })); window.print(); }} />
      <BulkActionModal show={bulkActionModal.show} action={bulkActionModal.action} count={bulkActionModal.count} loading={bulkActionModal.loading} onClose={() => setBulkActionModal(b => ({ ...b, show: false }))} onConfirm={async () => { const action = bulkActionModal.action; setBulkActionModal(b => ({ ...b, loading: true })); if (action === 'publish') { let done = 0; let failed = 0; for (const id of selectedIds) { try { await useReportStore.getState().publish(id, 85); done++; } catch { failed++; } }           setAllReports(prev => prev.map(r => selectedIds.has(r.id) && ['SUBMITTED', 'INITIAL_REVIEW'].includes(toEnState(r.status)) ? { ...r, status: '已发布', publishedTime: new Date().toISOString(), publishedBy: t('w9c.reportPage.currentUser') } : r)); setSelectedIds(new Set()); setBulkActionModal(b => ({ ...b, show: false, loading: false })); showToast(t('w9c.reportPage.bulkPublishComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : '' }), failed > 0 ? 'error' : 'success'); return; } else if (action === 'delete') { // [W2-C] 批量删除接真实 API (DELETE /reports/:id + reason)
        let done = 0; let failed = 0;
        for (const id of selectedIds) {
          try {
            const res = await reportApi.remove(id, t('w9c.reportPage.bulkDeleteReason'));
            if (res.success) done++; else failed++;
          } catch { failed++; }
        }
        setAllReports(prev => prev.filter(r => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
        setBulkActionModal(b => ({ ...b, show: false, loading: false }));
        showToast(t('w9c.reportPage.bulkDeleteComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : '' }), failed > 0 ? 'error' : 'success');
        return;         } else if (action === 'submit') { // [v3.0.6.11-95 Wave3B P1] 批量提交审核: POST /reports/batch-transition → INITIAL_REVIEW
        const ids = Array.from(selectedIds).filter(id => {
          const r = allReports.find(x => x.id === id);
          return r && ['WRITING', 'DRAFT', 'ASSIGNED', 'PENDING_ASSIGNMENT', 'SUBMITTED', 'REJECTED'].includes(toEnState(r.status));
        });
        let done = 0; let failed = 0;
        try {
          const res = await reportApi.batchTransition(ids, 'INITIAL_REVIEW');
          if (res.success && res.data) {
            done = (res.data.succeeded ?? []).length;
            failed = (res.data.failed ?? []).length;
          }
        } catch { failed = ids.length - done; }
        if (done > 0) {
          setAllReports(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: '初审中' } : r));
        }
        setSelectedIds(new Set());
        setBulkActionModal(b => ({ ...b, show: false, loading: false }));
        showToast(t('w9c.reportPage.bulkSubmitComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : '' }), failed > 0 ? 'info' : 'success');
        return;
        } else if (action === 'review') { // [v3.0.6.11-96 Wave3B P1] 批量审核: 单次 POST /reports/batch-transition → REVIEWED (逐条校验, 失败计数保留)
        const ids = Array.from(selectedIds).filter(id => {
          const r = allReports.find(x => x.id === id);
          return r && ['SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW', 'RECTIFYING', 'ESCALATED'].includes(toEnState(r.status));
        });
        let done = 0; let failed = 0;
        try {
          const res = await reportApi.batchTransition(ids, 'REVIEWED');
          if (res.success && res.data) {
            done = (res.data.succeeded ?? []).length;
            failed = (res.data.failed ?? []).length;
          }
        } catch { failed = ids.length - done; }
        if (done > 0) {
          setAllReports(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: '已审核', auditorName: user?.name ?? r.auditorName, approvedTime: new Date().toISOString() } : r));
        }
        setSelectedIds(new Set());
        setBulkActionModal(b => ({ ...b, show: false, loading: false }));
        showToast(t('w9c.reportPage.bulkReviewComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : '' }), failed > 0 ? 'info' : 'success');
        return; } else if (action === 'sign') { // [v3.0.6.11-96 Wave3B P1] 批量签署: 单次 POST /reports/batch-transition → SIGNED
        const ids = Array.from(selectedIds).filter(id => {
          const r = allReports.find(x => x.id === id);
          return r && ['REVIEWED', 'SIGNING', 'AMENDED'].includes(toEnState(r.status));
        });
        let done = 0; let failed = 0;
        try {
          const res = await reportApi.batchTransition(ids, 'SIGNED');
          if (res.success && res.data) {
            done = (res.data.succeeded ?? []).length;
            failed = (res.data.failed ?? []).length;
          }
        } catch { failed = ids.length - done; }
        if (done > 0) {
          setAllReports(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: '已签发', signedTime: new Date().toISOString() } : r));
        }
        setSelectedIds(new Set());
        setBulkActionModal(b => ({ ...b, show: false, loading: false }));
        showToast(t('w9c.reportPage.bulkSignComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : '' }), failed > 0 ? 'info' : 'success');
        return; } else if (action === 'archive') { // [G005 Wave 8] 报告冷归档: 批量归档 (仅 PUBLISHED → ARCHIVED + 归档任务)
        const ids = Array.from(selectedIds).filter(id => {
          const r = allReports.find(x => x.id === id);
          return r && toEnState(r.status) === 'PUBLISHED';
        });
        let done = 0; let failed = 0;
        for (const id of ids) {
          try {
            const res = await reportApi.archiveReport(id);
            if (res.success) done++; else failed++;
          } catch { failed++; }
        }
        if (done > 0) {
          setAllReports(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: '已归档' } : r));
        }
        setSelectedIds(new Set());
        setBulkActionModal(b => ({ ...b, show: false, loading: false }));
        showToast(t('w9c.reportPage.bulkArchiveComplete', { done, failSuffix: failed > 0 ? t('w9c.reportPage.exportFailSuffix', { failed }) : '' }), failed > 0 ? 'info' : 'success');
        return; } setSelectedIds(new Set()); setBulkActionModal(b => ({ ...b, show: false, loading: false })); showToast(t('w9c.reportPage.actionSuccessGeneric', { action: action === 'publish' ? t('w9c.reportPage.actionNamePublish') : t('w9c.reportPage.actionNameDelete') }), 'success'); }} />
    </PageTemplate>
  );
}

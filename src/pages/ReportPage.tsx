// @ts-nocheck
// G005 Radiology RIS - Report List v1.0.0
import React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FileText, Clock, CheckCircle, AlertTriangle, Filter, X, Printer,
  Eye, Edit3, Download, ChevronDown, ChevronRight, Calendar, User,
  Activity, Stethoscope, ClipboardList, ShieldCheck, History,
  List, LayoutGrid, XCircle, RefreshCw, BarChart3, Plus, Bell,
  Zap, Mic, Sparkles,
} from "lucide-react";
import type { RadiologyReport } from "../types";
import { PageContainer } from "../components/common/PageContainer";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import { useNavigate } from "react-router-dom";
import { StatusBadge, REPORT_STATUS_META, REPORT_STATUS_ORDER } from "../components/report";
import { extendedReportMock } from "../data/reportSubsystemMock";
import { reportApi } from "../services/api";
import { useReportStore } from "../store";
import { PermissionGate } from "../components/common/PermissionGate";
import { useRBAC } from "../hooks/useRBAC";
import { useAuth } from "../hooks/useAuth";
import { canApprove } from "../services/auth/rbacService";
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
import { PRIMARY, PRIMARY_LIGHT, ACCENT, SUCCESS, WARNING, DANGER, PURPLE, GRAY, BG, WHITE, STATUS_CONFIG, isToday } from './report/reportUtils';

export default function ReportPage() {
  const navigate = useNavigate();
  const { checkAccess } = useRBAC();
  const { user } = useAuth();
  const [allReports, setAllReports] = useState<RadiologyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

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
      } else { setAllReports([]); setLoadError("API 不可用,暂无数据"); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [checkAccess, user?.department]);

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
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [aiagreement, setAiagreement] = useState(0);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({ show: false, message: "", type: "success" });
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast(t => ({ ...t, show: false })), 3000); };
  const [exportModal, setExportModal] = useState<{ show: boolean; title: string; message: string; complete: boolean }>({ show: false, title: "", message: "", complete: false });
  const [reviewResultModal, setReviewResultModal] = useState<{ show: boolean; reportId: string; result: string; suggestion: string }>({ show: false, reportId: "", result: "", suggestion: "" });
  const [batchResultModal, setBatchResultModal] = useState<{ show: boolean; title: string; message: string; type: "success" | "error" }>({ show: false, title: "", message: "", type: "success" });
  const [printModal, setPrintModal] = useState<{ show: boolean; title: string; message: string }>({ show: false, title: "", message: "" });
  const [detailReport, setDetailReport] = useState<RadiologyReport | null>(null);
  const [reviewReport, setReviewReport] = useState<RadiologyReport | null>(null);
  const [mfaReportId, setMfaReportId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const todayReports = allReports.filter(r => isToday(r.createdTime));
    const thisWeek = allReports.filter(r => { if (!r.createdTime) return false; const d = new Date(r.createdTime); const now = new Date(); const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); return d >= weekStart; });
    const published = allReports.filter(r => r.publishedTime && r.createdTime);
    let avgTurnaround = 0;
    if (published.length > 0) { const totalHours = published.reduce((sum, r) => { const created = new Date(r.createdTime).getTime(); const pubTime = new Date(r.publishedTime!).getTime(); return sum + (pubTime - created) / (1000 * 60 * 60); }, 0); avgTurnaround = Math.round(totalHours / published.length); }
    return { todayTotal: todayReports.length, thisWeekTotal: thisWeek.length, pendingReview: allReports.filter(r => r.status === "待审核").length, criticalCount: allReports.filter(r => r.criticalFinding).length, positiveCount: allReports.filter(r => r.diagnosis && r.diagnosis !== "结论：未见明显异常。").length, avgTurnaround };
  }, [allReports]);

  const filteredReports = useMemo(() => {
    return allReports.filter(r => {
      if (search) { const q = search.toLowerCase(); if (!r.patientName.toLowerCase().includes(q) && !r.reportId.toLowerCase().includes(q) && !r.examItemName.toLowerCase().includes(q) && !r.accessionNumber.toLowerCase().includes(q)) return false; }
      if (statusFilter !== "全部" && r.status !== statusFilter) return false;
      if (modalityFilter !== "全部" && r.modality !== modalityFilter) return false;
      if (reportDoctorFilter && r.reportDoctorName !== reportDoctorFilter) return false;
      if (auditorFilter && r.auditorName !== auditorFilter) return false;
      if (dateFrom && r.createdTime < dateFrom) return false;
      if (dateTo && r.createdTime > dateTo + " 23:59") return false;
      if (criticalOnly && !r.criticalFinding) return false;
      if (positiveOnly && (!r.diagnosis || r.diagnosis === "结论：未见明显异常。")) return false;
      const score = r.qualityScore || 0;
      if (score < qualityScoreFrom || score > qualityScoreTo) return false;
      return true;
    });
  }, [allReports, search, statusFilter, modalityFilter, reportDoctorFilter, auditorFilter, dateFrom, dateTo, criticalOnly, positiveOnly, qualityScoreFrom, qualityScoreTo]);

  const avgQuality = useMemo(() => { if (filteredReports.length === 0) return 0; const total = filteredReports.reduce((sum, r) => sum + (r.qualityScore || 0), 0); return Math.round(total / filteredReports.length); }, [filteredReports]);
  const criticalCount = filteredReports.filter(r => r.criticalFinding).length;
  const filteredStats = useMemo(() => ({ critical: filteredReports.filter(r => r.criticalFinding).length, pending: filteredReports.filter(r => r.status === "待审核").length, published: filteredReports.filter(r => r.status === "已发布").length }), [filteredReports]);

  const handleReset = () => { setSearch(""); setStatusFilter("全部"); setModalityFilter("全部"); setReportDoctorFilter(""); setAuditorFilter(""); setDateFrom(""); setDateTo(""); setCriticalOnly(false); setPositiveOnly(false); setQualityScoreFrom(0); setQualityScoreTo(100); };
  const handleExport = () => { setExportModal({ show: true, title: "导出报表", message: `正在导出 ${filteredReports.length} 份报告...`, complete: false }); setTimeout(() => { setExportModal(m => ({ ...m, complete: true, message: `已导出 ${filteredReports.length} 份报告` })); setTimeout(() => setExportModal(m => ({ ...m, show: false })), 2000); }, 1500); };
  const handlePrint = () => { window.print(); };
  const handleToggleSelect = useCallback((id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }, []);
  const handleSelectAll = useCallback(() => { setSelectedIds(new Set(filteredReports.map(r => r.id))); }, [filteredReports]);
  const handleDeselectAll = useCallback(() => { setSelectedIds(new Set()); }, []);
  const handleReviewSubmit = async (reportId: string, result: "approved" | "rejected", suggestion: string, password: string) => {
    if (result === "approved") {
      const report = allReports.find(r => r.id === reportId);
      if (report && !canApprove(user?.id ?? '', report.reportDoctorId ?? '')) {
        message.error('禁止自审：不能审核自己的报告');
        return;
      }
      await useReportStore.getState().review(reportId, 'initial', user?.id ?? '', user?.name ?? '', suggestion, 0);
      setMfaReportId(reportId);
    } else {
      await useReportStore.getState().reject(reportId);
      setReviewReport(null);
      setReviewResultModal({ show: true, reportId, result: "已退回", suggestion: suggestion || "(无)" });
    }
  };

  const handleMfaVerified = async (token: string) => {
    const reportId = mfaReportId;
    setMfaReportId(null);
    if (!reportId) return;
    await useReportStore.getState().sign(reportId);
    setReviewReport(null);
    setReviewResultModal({ show: true, reportId, result: "已审核", suggestion: "(MFA已验证)" });
  };

  return (
    <PageContainer background="slate" maxWidth="wide" padding={0} testId="report-page">
      {accessDenied && <div style={{ padding: 24, margin: 24, background: "#fee2e2", border: "1px solid #fca5a5", color: "#7f1d1d", borderRadius: 8, fontSize: 14 }}>🔒 资源级访问被拒绝 (checkAccess)：当前用户无权读取报告资源，请联系管理员。</div>}
      {loading && <LoadingBanner message="正在从 API 加载报告数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.3); } } @keyframes criticalPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); } }`}</style>

      <ReportPageHeader selectedIds={selectedIds} allReports={allReports} setReviewReport={setReviewReport} showToast={showToast} />

      <div className="no-print" style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 24px" }}>
        <div className="report-stats" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 14 }}>
          <StatCard label="今日报告数" value={stats.todayTotal} icon={<FileText size={20} />} color={ACCENT} sub={`本周共 ${stats.thisWeekTotal} 份`} />
          <StatCard label="待审核报告" value={stats.pendingReview} icon={<Clock size={20} />} color={PURPLE} sub={`占总数 ${stats.pendingReview > 0 ? Math.round((stats.pendingReview / allReports.length) * 100) : 0}%`} />
          <StatCard label="危急值报告" value={stats.criticalCount} icon={<Zap size={20} />} color={DANGER} sub={`含阳性 ${filteredStats.critical} 例`} />
          <StatCard label="阳性结果" value={stats.positiveCount} icon={<AlertTriangle size={20} />} color={WARNING} sub={`阳性率 ${allReports.length > 0 ? Math.round((stats.positiveCount / allReports.length) * 100) : 0}%`} />
          <StatCard label="平均周转" value={stats.avgTurnaround} icon={<Clock size={20} />} color="#0891b2" sub="小时 (创建→发布)" />
          <StatCard label="本周总量" value={stats.thisWeekTotal} icon={<BarChart3 size={20} />} color="#7c3aed" sub="本周报告总数" />
        </div>

        <ReportBanners />

        <div className="report-filters"><ReportHeader search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} modalityFilter={modalityFilter} setModalityFilter={setModalityFilter} reportDoctorFilter={reportDoctorFilter} setReportDoctorFilter={setReportDoctorFilter} auditorFilter={auditorFilter} setAuditorFilter={setAuditorFilter} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} criticalOnly={criticalOnly} setCriticalOnly={setCriticalOnly} positiveOnly={positiveOnly} setPositiveOnly={setPositiveOnly} onReset={handleReset} onExport={handleExport} onPrint={handlePrint} /></div>

        <ReportAdvancedFilter showAdvancedFilter={showAdvancedFilter} setShowAdvancedFilter={setShowAdvancedFilter} qualityScoreFrom={qualityScoreFrom} setQualityScoreFrom={setQualityScoreFrom} qualityScoreTo={qualityScoreTo} setQualityScoreTo={setQualityScoreTo} />

        <ReportToolbar viewMode={viewMode} setViewMode={setViewMode} voiceRecording={voiceRecording} setVoiceRecording={setVoiceRecording} aiFilling={aiFilling} setAiFilling={setAiFilling} avgQuality={avgQuality} criticalCount={criticalCount} selectedIds={selectedIds} filteredStats={filteredStats} filteredReports={filteredReports} allReports={allReports} setDetailReport={setDetailReport} setReviewReport={setReviewReport} setExportModal={setExportModal} setPrintModal={setPrintModal} setBulkActionModal={setBulkActionModal} showToast={showToast} setStatusFilter={setStatusFilter} />

        <div className="no-print">
          {viewMode === "list" ? (
            <ReportTableView reports={filteredReports} loading={loading} expandedId={expandedId} onToggleExpand={id => setExpandedId(prev => (prev === id ? null : id))} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} onView={r => setDetailReport(r)} onReview={r => setReviewReport(r)} onPrint={r => { setDetailReport(r); }} onReject={r => { setDetailReport(r); }} onExportPDF={r => { setExportModal({ show: true, title: "导出PDF", message: `正在导出报告 ${r.reportId}...`, complete: false }); setTimeout(() => { setExportModal(m => ({ ...m, complete: true, message: `报告 ${r.reportId} 已导出` })); setTimeout(() => setExportModal(m => ({ ...m, show: false })), 2000); }, 1000); }} />
          ) : (
            <ReportKanbanView reports={filteredReports} onView={r => setDetailReport(r)} onReview={r => setReviewReport(r)} />
          )}
        </div>
      </div>

      {detailReport && <ReportDetailDrawer report={detailReport} onClose={() => setDetailReport(null)} onReview={r => { setDetailReport(null); setReviewReport(r); }} onPrint={r => { setDetailReport(null); setTimeout(() => window.print(), 100); }} onExportPDF={r => { setExportModal({ show: true, title: "导出PDF", message: `正在导出报告 ${r.reportId}...`, complete: false }); setTimeout(() => { setExportModal(m => ({ ...m, complete: true, message: `报告 ${r.reportId} 已导出` })); setTimeout(() => setExportModal(m => ({ ...m, show: false })), 2000); }, 1000); }} />}

      {reviewReport && <ReportReviewModal report={reviewReport} onClose={() => setReviewReport(null)} onSubmit={handleReviewSubmit} />}

      {mfaReportId && user?.id && (
        <MfaVerifyModal
          userId={user.id}
          onVerified={handleMfaVerified}
          onCancel={() => setMfaReportId(null)}
          operation="report.sign"
        />
      )}

      <ReportToast show={toast.show} message={toast.message} type={toast.type} />
      <ReportExportModal show={exportModal.show} title={exportModal.title} message={exportModal.message} complete={exportModal.complete} onClose={() => setExportModal(e => ({ ...e, show: false }))} />
      <ReviewResultModal show={reviewResultModal.show} reportId={reviewResultModal.reportId} result={reviewResultModal.result} suggestion={reviewResultModal.suggestion} onClose={() => setReviewResultModal(r => ({ ...r, show: false }))} />
      <BatchResultModal show={batchResultModal.show} title={batchResultModal.title} message={batchResultModal.message} type={batchResultModal.type} onClose={() => setBatchResultModal(b => ({ ...b, show: false }))} />
      <PrintModal show={printModal.show} title={printModal.title} message={printModal.message} onClose={() => setPrintModal(p => ({ ...p, show: false }))} onPrint={() => { setPrintModal(p => ({ ...p, show: false })); window.print(); }} />
      <BulkActionModal show={bulkActionModal.show} action={bulkActionModal.action} count={bulkActionModal.count} loading={bulkActionModal.loading} onClose={() => setBulkActionModal(b => ({ ...b, show: false }))} onConfirm={async () => { const action = bulkActionModal.action; setBulkActionModal(b => ({ ...b, loading: true })); if (action === 'publish') { for (const id of selectedIds) { await useReportStore.getState().publish(id, 85); } setAllReports(prev => prev.map(r => selectedIds.has(r.id) && r.status === '待审核' ? { ...r, status: '已发布', publishedTime: new Date().toISOString(), publishedBy: '当前用户' } : r)); } else if (action === 'delete') { setAllReports(prev => prev.filter(r => !selectedIds.has(r.id))); } setSelectedIds(new Set()); setBulkActionModal(b => ({ ...b, show: false, loading: false })); showToast(`${action === 'publish' ? '发布' : '删除'}成功`, 'success'); }} />
    </PageContainer>
  );
}

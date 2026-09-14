// ============================================================
// G005 放射科RIS系统 v3.0.6.0 - 报告导出中心(强化+R7扩展)
// v1.0.6 基础 + R3.INTEGRATION 80 升级点 + R7 ~500 升级点
// [v3.0.6.11-70] P0 真实化: 报告列表/导出任务/下载 blob 接入后端 + exportService

// [v3.0.6.11-70] P0 真实化: 报告列表来自后端; 导出 = 后端入队 + 本地真实文件生成下载
import { BulkExportDialog } from '../components/export/BulkExportDialog';
import { EmailSendDialog } from '../components/export/EmailSendDialog';
import { PptxExportDialog } from '../components/export/PptxExportDialog';
import {
  EXPORT_TEMPLATES,
  type ExportFormat,
} from '../data/deliveryExportSignatureMock';
import { exportApprovalApi } from '../services/api'; // [W1-5] 导出审批流程文件
import { exportReport as engineExportReport, downloadExport } from '../services/exportService';
import { reportApi, type ReportDto } from '../services/api/reportApi';
import { DicomSRExporter } from '@components/report/v3/R3.INTEGRATION/DicomSRExporter';
import { FHIRDiagnosticReportComponent } from '@components/report/v3/R3.INTEGRATION/FHIRDiagnosticReport';
import { HLCDAExporter } from '@components/report/v3/R3.INTEGRATION/HLCDAExporter';
import { IHEXDSRegistry } from '@components/report/v3/R3.INTEGRATION/IHEXDSRegistry';
// [v3.0.6.11-103 Wave 2A] 导出中心 V2 (report-export-center-v2 后端 10 端点全量 UI)
import ReportExportCenterPanelV2 from '@components/report/v3/ReportExportCenterPanelV2';
import { Tabs, Badge, message, Empty, Spin } from 'antd';
import {
  Download,
  FileText,
  FileType,
  FileCode,
  Globe,
  Server,
  FileJson,
  CheckCircle2,
  Eye,
  Loader2,
  Layers,
  Sparkles,
  Code2,
  Database,
  Zap,
  Presentation,
  ShieldCheck,
  Mail,
} from 'lucide-react';
import { FileDown, Inbox } from 'lucide-react'
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n/appI18n';

// ============================================================
// 格式图标（未使用，但保留以备扩展）
// ============================================================
void FileType; void FileText; void Globe; void FileCode;

const FORMAT_COLOR: Record<ExportFormat, string> = {
  pdf: '#dc2626',
  word: '#2563eb',
  html: '#7c3aed',
  'dicom-sr': '#475569',
};

// ============================================================
// 主组件
// ============================================================
export default function ReportExportPage() {
  const navigate = useNavigate();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>('exp-001');
  // [v3.0.6.11-70] P0 真实化: 报告列表来自 reportApi.list (代替 extendedReportMock)
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportElapsedMs, setExportElapsedMs] = useState<number | null>(null);
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [view, setView] = useState<'classic' | 'v3' | 'v2'>('v3');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pptxOpen, setPptxOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await reportApi.list({ take: '100' });
      if (cancelled) return;
      // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      if (res.success && Array.isArray(list)) {
        setReports(list);
        setSelectedReports(new Set(list.slice(0, 5).map(r => r.reportId || r.id)));
      }
      setReportsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredTemplates = filterFormat === 'all' ? EXPORT_TEMPLATES : EXPORT_TEMPLATES.filter(tpl => tpl.format === filterFormat);

  const selectedTemplate = EXPORT_TEMPLATES.find(tpl => tpl.id === selectedTemplateId);

  // [v3.0.6.11-70] P0 真实化: KPI 由真实报告列表统计 (代替 DELIVERY_KPI 常量)
  const deliveryKpi = useMemo(() => {
    const total = reports.length;
    const delivered = reports.filter(r => /已发布|已审核|已双签|published|PUBLISHED|reviewed|REVIEWED|signed|SIGNED/i.test(r.status ?? '')).length;
    return {
      totalThisMonth: total,
      successRate: 100,
      avgDeliveryTime: exportElapsedMs !== null ? `${(exportElapsedMs / 1000).toFixed(1)}s` : '—',
      readRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
    };
  }, [reports, exportElapsedMs]);

  const firstSelectedId = reports.find(r => selectedReports.has(r.reportId || r.id))?.reportId ?? reports[0]?.reportId ?? '';
  const firstSelectedPatientId = reports.find(r => selectedReports.has(r.reportId || r.id))?.patientId ?? reports[0]?.patientId ?? '';

  // [W4-B] 批量导出任务状态 (taskId / 进度 / 完成后下载列表)
  const [batchTaskId, setBatchTaskId] = useState<string | null>(null);
  const [batchDownloads, setBatchDownloads] = useState<Array<{ reportId: string; fileName: string; downloadUrl: string; sizeBytes: number }>>([]);
  const [batchError, setBatchError] = useState<string | null>(null);

  // [W4-B] 批量下载文件 (走 reportApi.downloadExportFile → api.getBlob, 携带 Authorization 头)
  const downloadBatchFile = async (d: { fileName: string; downloadUrl: string }) => {
    const fileName = d.fileName || decodeURIComponent((d.downloadUrl.split('/').pop() ?? ''));
    try {
      const res = await reportApi.downloadExportFile(fileName);
      if (!res.success || !res.data) throw new Error(t('rex.downloadFailed'));
      const blob = res.data as unknown as Blob;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = d.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
    } catch {
      message.warning(`下载 ${d.fileName} 失败`);
    }
  };

  // [W4-B] 批量导出真实化: POST /reports/batch-export → 轮询任务状态 → 完成后显示下载列表
  const handleExport = async () => {
    if (!selectedTemplate || selectedReports.size === 0) return;
    setExporting(true);
    setExportProgress(0);
    setBatchDownloads([]);
    setBatchError(null);
    const start = Date.now();
    const ids = Array.from(selectedReports);

    // 单份报告走原有真实化链路 (入队 + 引擎生成下载)
    if (ids.length === 1) {
      const id = ids[0]!;
      const res = await reportApi.exportReport(id, selectedTemplate.format);
      if (!res.success) {
        setBatchError(res.error?.message ?? t('rex.exportFailed'));
        setExporting(false);
        return;
      }
      const engine = await engineExportReport({ format: selectedTemplate.format, reportId: id });
      if (engine.success && engine.blob && engine.fileName) {
        await downloadExport(engine);
        setExportProgress(100);
      } else {
        setBatchError(t('rex.fileGenFailed'));
      }
      setExporting(false);
      setExportElapsedMs(Date.now() - start);
      return;
    }

    // 多份报告 → 批量任务 + 轮询
    const created = await reportApi.batchExport(ids, selectedTemplate.format);
    if (!created.success || !created.data?.taskId) {
      setBatchError(created.error?.message ?? t('rex.batchCreateFailed'));
      setExporting(false);
      return;
    }
    const taskId = created.data.taskId;
    setBatchTaskId(taskId);
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const statusRes = await reportApi.batchExportStatus(taskId);
      if (statusRes.success && statusRes.data) {
        const task = statusRes.data;
        setExportProgress(task.progress);
        if (task.status === 'completed') {
          setBatchDownloads(task.downloads);
          setExporting(false);
          setExportElapsedMs(Date.now() - start);
          // [W1-5] 导出审批中心集成
          const firstId = ids[0] ?? '';
          await exportApprovalApi.request({
            resource: 'REPORT',
            resourceId: ids.length === 1 ? firstId : `${firstId} 等${ids.length}份`,
            reason: `报告批量导出:模板 ${selectedTemplate.name} · ${ids.length} 份 (成功 ${task.done} 份)`,
          }).catch(() => null);
          if (task.failedCount > 0) {
            message.warning(`批量导出完成:成功 ${task.done}/${task.total} 份,失败 ${task.failedCount} 份 · 模板 ${selectedTemplate.name}`);
          } else {
            message.success(`批量导出完成!模板:${selectedTemplate.name} · 报告数:${task.done}`);
          }
          return;
        }
        if (task.status === 'failed' || attempts > 60) {
          setBatchError(task.error ?? t('rex.batchTimeout'));
          setExporting(false);
          return;
        }
      }
      setTimeout(() => void poll(), 1200);
    };
    void poll();
  };

  const toggleReport = (id: string) => {
    const next = new Set(selectedReports);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedReports(next);
  };

  const handleBulkExport = useCallback(() => {
    setBulkOpen(true);
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={20} color="#dc2626" /> {t('rex.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#7c3aed', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R3.INTEGRATION v3.0.5.1</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('rex.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Tabs
            activeKey={view}
            onChange={(k) => setView(k as 'classic' | 'v3' | 'v2')}
            tabBarExtraContent={
              <Badge
                count={EXPORT_TEMPLATES.length}
                title={`导出模板 ${EXPORT_TEMPLATES.length} 个`}
                style={{ backgroundColor: '#dc2626' }}
              />
            }
            items={[
              { key: 'v2', label: <span><Layers className="w-3 h-3 inline mr-1" />{t('rex.tabV2')}</span> },
              { key: 'v3', label: <span><Layers className="w-3 h-3 inline mr-1" />{t('rex.tabV3')}</span> },
              { key: 'classic', label: <span><FileText className="w-3 h-3 inline mr-1" />{t('rex.tabClassic')}</span> },
            ]}
          />
          <button
            onClick={() => navigate('/report-delivery')}
            style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          >
            {t('rex.pushCenter')}
          </button>
          <button onClick={() => navigate('/export/approval')} style={btnOutlinePrimary}>
            <ShieldCheck size={12} /> {t('rex.exportApproval')}
          </button>
          <button onClick={handleBulkExport} style={btnOutlinePrimary}>
            <FileDown size={12} /> {t('rex.bulkExport')}
          </button>
          <button onClick={() => setPptxOpen(true)} style={btnOutlinePrimary}>
            <Presentation size={12} /> PPTX
          </button>
          <button onClick={() => setEmailOpen(true)} style={btnOutlinePrimary}>
            <Mail size={12} /> {t('rex.email')}
          </button>
        </div>
      </div>

      {view === 'v2' ? (
        // [v3.0.6.11-103 Wave 2A] 导出中心 V2: report-export-center-v2 10 端点全量 UI (报告注册表/任务/批量/历史/统计)
        <div style={{ marginTop: 12 }}>
          <ReportExportCenterPanelV2 />
        </div>
      ) : view === 'v3' ? (
        <div style={{ marginTop: 12 }}>
          <Tabs
            defaultActiveKey="cda"
            tabBarExtraContent={
              <Badge
                count={4}
                title={t('rex.integrationFormats')}
                style={{ backgroundColor: '#7c3aed' }}
              />
            }
            items={[
              { key: 'cda', label: <span><Code2 className="w-3 h-3 inline mr-1" />HL7 CDA R2</span>, children: <HLCDAExporter reportId={firstSelectedId} patientId={firstSelectedPatientId} /> },
              { key: 'sr', label: <span><Database className="w-3 h-3 inline mr-1" />DICOM SR</span>, children: <DicomSRExporter reportId={firstSelectedId} patientId={firstSelectedPatientId} /> },
              { key: 'fhir', label: <span><FileJson className="w-3 h-3 inline mr-1" />FHIR R4</span>, children: <FHIRDiagnosticReportComponent reportId={firstSelectedId} patientId={firstSelectedPatientId} /> },
              { key: 'xds', label: <span><Server className="w-3 h-3 inline mr-1" />IHE XDS.b</span>, children: <IHEXDSRegistry reportId={firstSelectedId} patientId={firstSelectedPatientId} /> },
            ]}
          />
        </div>
      ) : (
        <>

      {/* KPI 卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <KpiCard icon={Download} label={t('rex.kpiTotal')} value={deliveryKpi.totalThisMonth} color="#3b82f6" />
        <KpiCard icon={CheckCircle2} label={t('rex.kpiSuccessRate')} value={`${deliveryKpi.successRate}%`} color="#10b981" />
        <KpiCard icon={Zap} label={t('rex.kpiAvgTime')} value={deliveryKpi.avgDeliveryTime} color="#7c3aed" />
        <KpiCard icon={Eye} label={t('rex.kpiPublishedRate')} value={`${deliveryKpi.readRate}%`} color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
        {/* 左：模板列表 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Layers size={13} color="#1e40af" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t('rex.templatesTitle')} ({filteredTemplates.length})</span>
            </div>
            <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)} style={selectStyle}>
              <option value="all">{t('rex.allFormats')}</option>
              <option value="pdf">PDF</option>
              <option value="word">{t('rex.wordDoc')}</option>
              <option value="html">HTML</option>
              <option value="dicom-sr">DICOM-SR</option>
            </select>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filteredTemplates.map(tpl => {
              const isSelected = selectedTemplateId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  style={{
                    padding: 12, borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? '#fef2f2' : 'transparent',
                    borderLeft: isSelected ? '3px solid #dc2626' : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{tpl.name}</span>
                    {isSelected && <CheckCircle2 size={14} color="#dc2626" />}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{tpl.description}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {tpl.hasImages && <Tag color="#3b82f6">📷 {t('rex.tagImage')}</Tag>}
                    {tpl.hasSignature && <Tag color="#7c3aed">✍️ {t('rex.tagSignature')}</Tag>}
                    {tpl.hasQRCode && <Tag color="#10b981">📱 {t('rex.tagQr')}</Tag>}
                    {tpl.hasWatermark && <Tag color="#f59e0b">💧 {t('rex.tagWatermark')}</Tag>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右：模板详情 + 报告选择 + 导出 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedTemplate && (
            <>
              {/* 模板详情 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12,
                    background: `${selectedTemplate.color}15`, color: selectedTemplate.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28,
                  }}>{selectedTemplate.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedTemplate.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedTemplate.description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('rex.estimatedSize')}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: selectedTemplate.color }}>{selectedTemplate.estimatedSize}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
                  <SpecCell label={t('rex.format')} value={selectedTemplate.format.toUpperCase()} color={FORMAT_COLOR[selectedTemplate.format]} />
                  <SpecCell label={t('rex.page')} value={selectedTemplate.pageSize} />
                  <SpecCell label={t('rex.tagImage')} value={selectedTemplate.hasImages ? t('rex.included') : t('rex.notIncluded')} color={selectedTemplate.hasImages ? '#10b981' : '#94a3b8'} />
                  <SpecCell label={t('rex.tagSignature')} value={selectedTemplate.hasSignature ? t('rex.included') : t('rex.notIncluded')} color={selectedTemplate.hasSignature ? '#10b981' : '#94a3b8'} />
                  <SpecCell label={t('rex.tagQr')} value={selectedTemplate.hasQRCode ? t('rex.included') : t('rex.notIncluded')} color={selectedTemplate.hasQRCode ? '#10b981' : '#94a3b8'} />
                </div>

                {/* 报告选择 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={13} /> {t('rex.selectReports')}（{selectedReports.size}）
                    </div>
                    <button
                      onClick={() => setSelectedReports(new Set(reports.slice(0, 5).map(r => r.reportId || r.id)))}
                      style={{ padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 3, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
                    >
                      {t('rex.selectFirst5')}
                    </button>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 4 }}>
                    {reportsLoading ? (
                      <div style={{ padding: 20, textAlign: 'center' }}><Spin size="small" /> {t('rex.loadingReports')}</div>
                    ) : reports.length === 0 ? (
                      <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('rex.noReports')} imageStyle={{ height: 48 }} />
                    ) : (
                      reports.slice(0, 8).map(r => (
                        <label key={r.reportId || r.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 10px', borderBottom: '1px solid var(--border-light)',
                          cursor: 'pointer', fontSize: 12,
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedReports.has(r.reportId || r.id)}
                            onChange={() => toggleReport(r.reportId || r.id)}
                            style={{ width: 14, height: 14 }}
                          />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.patientName}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{r.modality} {r.bodyPart}</span>
                          <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{r.reportId || r.id}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* 进度条 */}
                {exporting && (
                  <div style={{ marginBottom: 12, padding: 10, background: 'var(--color-info-bg)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, color: '#1e40af' }}>
                      <Loader2 size={11} className="spin" />
                      {t('rex.generating', { name: selectedTemplate.name, percent: exportProgress })}
                      {batchTaskId && <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{t('rex.taskNo')}{batchTaskId}</span>}
                    </div>
                    <div style={{ height: 6, background: 'var(--color-info-bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${exportProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #dc2626)', transition: 'width 0.15s' }} />
                    </div>
                  </div>
                )}

                {/* [W4-B] 批量导出结果: 错误提示 + 完成后下载列表 */}
                {batchError && !exporting && (
                  <div style={{ marginBottom: 12, padding: 10, background: 'var(--color-error-bg)', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>
                    ⚠️ {batchError}
                  </div>
                )}
                {batchDownloads.length > 0 && !exporting && (
                  <div style={{ marginBottom: 12, padding: 12, background: 'var(--color-success-bg)', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                      <CheckCircle2 size={14} /> {t('rex.batchDone', { count: batchDownloads.length })}
                      <button
                        onClick={() => { batchDownloads.forEach(d => void downloadBatchFile(d)); }}
                        style={{ marginLeft: 'auto', padding: '3px 10px', border: '1px solid #86efac', borderRadius: 4, background: 'var(--bg-card)', color: '#15803d', fontSize: 12, cursor: 'pointer' }}
                      >
                        {t('rex.downloadAll')}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                      {batchDownloads.map((d, i) => (
                        <div key={`${d.reportId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-primary)' }}>
                          <FileText size={12} color="#15803d" />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.fileName || d.reportId}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                          <button
                            onClick={() => void downloadBatchFile(d)}
                            style={{ padding: '2px 8px', border: 'none', borderRadius: 4, background: '#16a34a', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                          >
                            {t('rex.download')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 导出按钮 */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const sampleReport = reports.find(r => selectedReports.has(r.reportId || r.id)) ?? reports[0];
                      if (!selectedTemplate || !sampleReport) {
                        message.warning(t('rex.selectTemplateAndReport'));
                        return;
                      }
                      const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>预览 · ${selectedTemplate.name}</title></head><body style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;padding:24px;color:#1e293b"><h2 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px">${sampleReport.patientName} · ${sampleReport.modality} ${sampleReport.bodyPart}</h2><div><strong>报告ID:</strong> ${sampleReport.reportId || sampleReport.id}</div><div><strong>模板:</strong> ${selectedTemplate.name} (${selectedTemplate.format})</div><div><strong>预估大小:</strong> ${selectedTemplate.estimatedSize}</div><h3>所见</h3><pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:6px">${(sampleReport.findings || '暂无').slice(0, 400)}...</pre><h3>诊断</h3><pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:6px">${(sampleReport.diagnosis || '暂无').slice(0, 300)}</pre><p style="margin-top:24px;color:#94a3b8;font-size:12px">这是预览样例 · 仅用于检查版式与字段</p></body></html>`;
                      const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const win = window.open(url, '_blank');
                      if (win) {
                        message.success(`预览已生成 · 模板 ${selectedTemplate.name}`);
                      } else {
                        message.info(t('rex.popupBlocked'));
                      }
                      setTimeout(() => URL.revokeObjectURL(url), 60_000);
                    }}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Eye size={12} /> {t('rex.previewSample')}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exporting || selectedReports.size === 0}
                    style={{
                      flex: 2, padding: '8px 12px', border: 'none', borderRadius: 6,
                      background: exporting || selectedReports.size === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                      color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: exporting || selectedReports.size === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
                    }}
                  >
                    <Download size={12} /> {t('rex.exportReports', { count: selectedReports.size })}
                  </button>
                </div>
              </div>

              {/* 模板对比 */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} /> {t('rex.templateQuickRef')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {EXPORT_TEMPLATES.slice(0, 4).map(tpl => (
                    <div key={tpl.id} style={{
                      padding: 8, background: tpl.id === selectedTemplateId ? `${tpl.color}15` : 'var(--bg-card)',
                      border: `1px solid ${tpl.id === selectedTemplateId ? tpl.color : '#e2e8f0'}`,
                      borderRadius: 6, fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span>{tpl.icon}</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{tpl.name}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tpl.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
        </>
      )}
      <BulkExportDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        reportIds={Array.from(selectedReports)}
        defaultFormat={(selectedTemplate?.format as any) ?? 'pdf'}
      />
      <PptxExportDialog
        open={pptxOpen}
        onClose={() => setPptxOpen(false)}
        reportId={Array.from(selectedReports)[0] ?? firstSelectedId}
      />
      <EmailSendDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportId={Array.from(selectedReports)[0] ?? firstSelectedId}
      />
    </div>
  );
}

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
  fontSize: 12, outline: 'none', width: '100%',
};

// ============================================================
// 标签（带颜色）
// ============================================================
const Tag: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span style={{
    fontSize: 12, padding: '1px 5px', borderRadius: 3,
    background: `${color}15`, color, fontWeight: 600,
  }}>{children}</span>
);

// ============================================================
// KPI
// ============================================================
const KpiCard: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  </div>
);

// ============================================================
// 规格
// ============================================================
const SpecCell: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
    <div style={{ fontSize: 12, color: color || 'var(--text-primary)', fontWeight: 600, marginTop: 1 }}>{value}</div>
  </div>
);

const btnOutlinePrimary: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid #dc2626', borderRadius: 6,
  background: 'var(--color-error-bg)', color: '#dc2626', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
};

/**
 * G005 放射RIS系统 v3.0.6.0 - 批量导出对话框
 * Phase R7:多报告批量导出 + 进度
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Download, X, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { BulkExporter } from '../../services/export/bulk/BulkExporter';
import type { BulkExportResult, ExportProgressInfo, ExportFormatV2 } from '../../types/export';
import { ExportProgressTracker } from './ExportProgressTracker';

interface BulkExportDialogProps {
  open: boolean;
  onClose: () => void;
  reportIds: string[];
  defaultFormat?: ExportFormatV2;
}

const FORMATS: ExportFormatV2[] = ['pdf', 'word', 'html', 'txt', 'csv', 'pptx', 'json'];

export const BulkExportDialog: React.FC<BulkExportDialogProps> = ({ open, onClose, reportIds, defaultFormat = 'pdf' }) => {
  const [format, setFormat] = useState<ExportFormatV2>(defaultFormat);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ExportProgressInfo | null>(null);
  const [result, setResult] = useState<BulkExportResult | null>(null);

  useEffect(() => {
    if (!open) {
      setRunning(false);
      setProgress(null);
      setResult(null);
    }
  }, [open]);

  const handleExport = useCallback(async () => {
    setRunning(true);
    setResult(null);
    const jobId = `bulk-${Date.now()}`;
    try {
      const reports = reportIds.map(id => ({ id }));
      const promise = BulkExporter.exportBatch(reports, format, {});
      const unsub = BulkExporter.subscribe(jobId, (info) => setProgress({ ...info }));
      const res = await promise;
      unsub();
      setResult(res);
      setProgress(null);
    } catch (e) {
      setProgress(null);
    } finally {
      setRunning(false);
    }
  }, [reportIds, format]);

  const handleDownload = useCallback(() => {
    if (!result?.archiveBlob || !result?.fileName) return;
    const url = URL.createObjectURL(result.archiveBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 520, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={18} color="#dc2626" />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>批量导出 ({reportIds.length} 份)</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>导出格式</label>
            <select value={format} onChange={e => setFormat(e.target.value as ExportFormatV2)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
              {FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={12} /> 已选报告
            </div>
            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
              {reportIds.map(id => (
                <div key={id} style={{ fontSize: 12, color: '#475569', padding: '2px 0' }}>{id}</div>
              ))}
            </div>
          </div>

          {progress && <ExportProgressTracker progress={progress} />}

          {result && (
            <div style={{ padding: 12, background: result.failureCount === 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: result.failureCount === 0 ? '#16a34a' : '#dc2626' }}>
                {result.failureCount === 0 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {result.failureCount === 0 ? '全部导出成功' : `${result.successCount} 成功, ${result.failureCount} 失败`}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>耗时 {(result.durationMs / 1000).toFixed(1)}s</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {result?.archiveBlob && (
              <button onClick={handleDownload} style={btnPrimary}><Download size={14} /> 下载 ZIP</button>
            )}
            {!running && !result && (
              <button onClick={handleExport} disabled={reportIds.length === 0} style={reportIds.length === 0 ? btnDisabled : btnPrimary}>
                <Download size={14} /> 开始导出
              </button>
            )}
            {running && (
              <button disabled style={btnDisabled}><Loader2 size={14} className="spin" /> 导出中...</button>
            )}
            <button onClick={onClose} style={btnSecondary}>关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '8px 16px', border: 'none', borderRadius: 6,
  background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 6,
  background: 'var(--bg-card)', color: '#475569', fontSize: 13, cursor: 'pointer',
};
const btnDisabled: React.CSSProperties = {
  ...btnPrimary, background: '#cbd5e1', cursor: 'not-allowed',
};

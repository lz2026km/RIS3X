import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, FileText, Microscope } from 'lucide-react';
import { radpathApi, type RadPathRecord } from '../../services/api/radpathApi';

const consistencyColor: Record<string, string> = { concordant: '#10b981', discordant: '#ef4444', pending: '#94a3b8' };
const consistencyLabel: Record<string, string> = { concordant: '一致', discordant: '不一致', pending: '待审' };

function diffFields(rad: string, path: string) {
  if (!rad || !path) return [];
  const radWords = new Set(rad.split(/[,，、\s]+/).filter(Boolean));
  const pathWords = new Set(path.split(/[,，、\s]+/).filter(Boolean));
  const diff: string[] = [];
  for (const w of radWords) { if (!pathWords.has(w)) diff.push(w) }
  for (const w of pathWords) { if (!radWords.has(w) && !diff.includes(w)) diff.push(w) }
  return diff;
}

export default function RadPathDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<RadPathRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);
    radpathApi.findByReport(reportId)
      .then(res => {
        if (res.success && res.data) setRecord(res.data);
        else throw new Error(res.error?.message || '未找到记录');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [reportId]);

  const handleMark = useCallback(async (consistency: 'concordant' | 'discordant' | 'pending') => {
    if (!record) return;
    setSaving(true);
    try {
      const res = await radpathApi.updateConsistency({ id: record.id, consistency });
      if (res.success && res.data) {
        setRecord(res.data);
      } else {
        throw new Error(res.error?.message || '标记失败');
      }
    } catch (e: any) { message.error(e.message || '标记失败') } finally { setSaving(false) }
  }, [record]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>加载中...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (!record) return null;

  const diffs = diffFields(record.radFinding, record.pathResult);

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, color: '#1e293b', margin: 0 }}>Rad-Path 对照详情</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            {record.report.patient.name} · {record.report.exam ? `${record.report.exam.modality}/${record.report.exam.bodyPart}` : ''} · 报告 {record.reportId.slice(0, 8)}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>当前状态:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: `${consistencyColor[record.consistency]}20`, color: consistencyColor[record.consistency] }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: consistencyColor[record.consistency] }} />
            {consistencyLabel[record.consistency]}
          </span>
        </div>
      </div>

      {/* 并排对比 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} /> 影像报告
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>所见 (Findings)</div>
          <div style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap', marginBottom: 12, padding: 8, background: '#f8fafc', borderRadius: 4, minHeight: 60 }}>{record.radFinding || record.report.findings}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>结论 (Conclusion)</div>
          <div style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap', padding: 8, background: '#f8fafc', borderRadius: 4, minHeight: 40 }}>{record.report.conclusion}</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Microscope size={14} /> 病理报告
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>病理结果</div>
          <div style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap', padding: 8, background: '#f0fdf4', borderRadius: 4, minHeight: 100 }}>{record.pathResult}</div>
          {record.notes && (
            <>
              <div style={{ fontSize: 12, color: '#64748b', margin: '12 0 4' }}>备注</div>
              <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'pre-wrap', padding: 8, background: '#fffbeb', borderRadius: 4 }}>{record.notes}</div>
            </>
          )}
        </div>
      </div>

      {/* 差异字段高亮 */}
      {diffs.length > 0 && (
        <div style={{ background: '#fffbeb', borderRadius: 8, border: '1px solid #f59e0b', padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#d97706', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> 差异字段 ({diffs.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {diffs.map(d => <span key={d} style={{ padding: '2px 8px', background: '#fef3c7', border: '1px solid #f59e0b40', borderRadius: 4, fontSize: 12, color: '#92400e' }}>{d}</span>)}
          </div>
        </div>
      )}

      {/* 人工标记 */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>人工标记一致性</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['concordant', 'discordant', 'pending'] as const).map(c => (
            <button key={c} onClick={() => handleMark(c)} disabled={saving || record.consistency === c}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: record.consistency === c ? `2px solid ${consistencyColor[c]}` : '1px solid #cbd5e1', background: record.consistency === c ? `${consistencyColor[c]}15` : '#fff', color: record.consistency === c ? consistencyColor[c] : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
              {c === 'concordant' && <CheckCircle2 size={16} />}
              {c === 'discordant' && <XCircle size={16} />}
              {c === 'pending' && <AlertTriangle size={16} />}
              {consistencyLabel[c]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

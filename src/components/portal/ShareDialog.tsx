import { useState } from 'react';
import { Share2, X, Link2, Shield } from 'lucide-react';
import { shareLinkService } from '../../services/portal/ShareLinkService';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  resourceIds: string[];
  resourceSummary: string;
  onCreated?: (url: string) => void;
}

export default function ShareDialog({
  open, onClose, patientId, patientName, doctorId, doctorName,
  resourceIds, resourceSummary, onCreated,
}: ShareDialogProps) {
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxOpens, setMaxOpens] = useState(5);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const link = await shareLinkService.createLink({
        scope: 'single-report',
        resourceIds,
        resourceSummary,
        patientId,
        patientName,
        doctorId,
        doctorName,
        expiresInHours,
        maxOpens,
        passwordProtected,
        requirePhone,
      });
      setResult(link.shortUrl);
      onCreated?.(link.shortUrl);
    } catch (e) {
      setError('创建分享链接失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, width: 400, maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <Share2 size={16} color="#0ea5e9" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>生成分享链接</span>
          </div>
          <button aria-label="关闭" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 'var(--space-1, 4px)' }}>
            <X size={16} color="#94a3b8" />
          </button>
        </div>

        <div style={{ padding: 'var(--space-4, 16px)' }}>
          {result ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Link2 size={24} color="#10b981" />
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 'var(--space-2, 8px)' }}>分享链接已生成</div>
              <div style={{
                padding: '8px 12px', background: '#f0fdf4', borderRadius: 6,
                fontSize: 12, color: '#047857', fontFamily: 'monospace', wordBreak: 'break-all',
              }}>
                {result}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(result); }}
                style={{ marginTop: 10, padding: '6px 16px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
              >
                复制链接
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>分享内容</div>
                <div style={{ fontSize: 12, color: '#1e293b' }}>{resourceSummary}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>有效时长（小时）</div>
                  <select
                    value={expiresInHours}
                    onChange={e => setExpiresInHours(Number(e.target.value))}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }}
                  >
                    <option value={1}>1 小时</option>
                    <option value={6}>6 小时</option>
                    <option value={24}>24 小时</option>
                    <option value={72}>3 天</option>
                    <option value={168}>7 天</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>最大打开次数</div>
                  <select
                    value={maxOpens}
                    onChange={e => setMaxOpens(Number(e.target.value))}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }}
                  >
                    {[1, 3, 5, 10, 0].map(v => (
                      <option key={v} value={v}>{v === 0 ? '不限' : `${v} 次`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>安全设置</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={passwordProtected} onChange={e => setPasswordProtected(e.target.checked)} />
                  <Shield size={12} /> 密码保护
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={requirePhone} onChange={e => setRequirePhone(e.target.checked)} />
                  <Shield size={12} /> 需手机号验证
                </label>
              </div>

              {error && (
                <div style={{ padding: '6px 10px', background: '#fef2f2', borderRadius: 4, fontSize: 12, color: 'var(--color-error-600)', marginBottom: 'var(--space-2, 8px)' }}>{error}</div>
              )}

              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  width: '100%', padding: '8px 0', border: 'none', borderRadius: 6,
                  background: creating ? '#94a3b8' : '#0ea5e9', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? '生成中...' : '生成分享链接'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

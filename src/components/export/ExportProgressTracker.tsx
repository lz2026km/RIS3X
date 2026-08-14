/**
 * G005 放射RIS系统 v3.0.6.0 - 导出进度跟踪组件
 * Phase R7:可视化导出进度条 + 统计
 */
import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, BarChart3 } from 'lucide-react';
import type { ExportProgressInfo } from '../../types/export';

interface ExportProgressTrackerProps {
  progress: ExportProgressInfo;
  compact?: boolean;
}

export const ExportProgressTracker: React.FC<ExportProgressTrackerProps> = ({ progress, compact }) => {
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const elapsed = (Date.now() - progress.startedAt) / 1000;
  const speed = elapsed > 0 ? progress.processed / elapsed : 0;

  const statusColor = (): string => {
    switch (progress.status) {
      case 'running': return '#3b82f6';
      case 'completed': return '#16a34a';
      case 'failed': case 'cancelled': return '#dc2626';
      case 'paused': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  const statusLabel = (): string => {
    switch (progress.status) {
      case 'idle': return '等待中';
      case 'queued': return '排队中';
      case 'running': return '导出中';
      case 'paused': return '已暂停';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'cancelled': return '已取消';
      default: return progress.status;
    }
  };

  const content = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {progress.status === 'running' ? (
            <Loader2 size={14} color={statusColor()} className="spin" />
          ) : progress.status === 'completed' ? (
            <CheckCircle2 size={14} color={statusColor()} />
          ) : progress.status === 'failed' || progress.status === 'cancelled' ? (
            <XCircle size={14} color={statusColor()} />
          ) : (
            <Clock size={14} color={statusColor()} />
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{statusLabel()}</span>
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>{pct}%</span>
      </div>

      {!compact && (
        <>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: `linear-gradient(90deg, #3b82f6, ${statusColor()})`,
              transition: 'width 0.3s ease',
              borderRadius: 4,
            }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontSize: 12, color: '#64748b' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{progress.processed}/{progress.total}</div>
              <div>已处理</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#dc2626' }}>{progress.failed}</div>
              <div>失败</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{elapsed.toFixed(1)}s</div>
              <div>耗时</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{speed.toFixed(1)}/s</div>
              <div>速度</div>
            </div>
          </div>

          {progress.currentItem && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
              当前: {progress.currentItem}
            </div>
          )}

          {progress.errorMessage && (
            <div style={{ marginTop: 6, padding: 6, background: '#fef2f2', borderRadius: 4, fontSize: 12, color: '#dc2626' }}>
              {progress.errorMessage}
            </div>
          )}

          {progress.history.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <BarChart3 size={10} /> 事件日志
              </div>
              <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 12, color: '#94a3b8' }}>
                {progress.history.slice(-10).map((ev, i) => (
                  <div key={i} style={{ padding: '1px 0' }}>
                    <span style={{ color: ev.level === 'error' ? '#dc2626' : ev.level === 'warn' ? '#d97706' : '#64748b' }}>
                      [{ev.level.toUpperCase()}]
                    </span>{' '}
                    {ev.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  if (compact) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{content}</div>;
  }

  return (
    <div style={{ padding: 14, background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
      {content}
    </div>
  );
};

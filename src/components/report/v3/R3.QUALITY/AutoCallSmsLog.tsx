/**
 * G005 RIS v3.0.6.11-100 Wave 2A — AutoCallSmsLog
 * 危急值电话/短信通知记录时间线 (GET /critical-alert/alerts/:id/communication-log)
 */
import React, { useEffect, useState } from 'react';
import { Timeline, Empty, Tag, Spin, Tooltip } from 'antd';
import { Phone, MessageSquare, CheckCircle2, XCircle, PlayCircle, FileAudio } from 'lucide-react';
import { criticalAlertApi, type CommunicationEntry } from '../../../../services/api/criticalAlertApi';

const STATUS_META: Record<string, { label: string; color: string }> = {
  connected: { label: '已接通', color: 'green' },
  initiated: { label: '呼叫中', color: 'blue' },
  failed: { label: '失败', color: 'red' },
  sent: { label: '已送达', color: 'green' },
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export interface AutoCallSmsLogProps {
  alertId: string;
  refreshKey?: number;
  maxHeight?: number;
  testIdPrefix?: string;
}

export const AutoCallSmsLog: React.FC<AutoCallSmsLogProps> = ({ alertId, refreshKey = 0, maxHeight = 260, testIdPrefix = 'cv-log' }) => {
  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'mock'>('api');

  const load = () => {
    setLoading(true);
    void criticalAlertApi
      .getCommunicationLog(alertId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setEntries(res.data);
          setSource('api');
        } else {
          setEntries([]);
          setSource('mock');
        }
      })
      .catch(() => {
        setEntries([]);
        setSource('mock');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId, refreshKey]);

  return (
    <div data-testid={testIdPrefix} role="region" aria-label="电话短信通知记录">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 12, color: '#334155' }}>通知记录</strong>
        <Tag color={source === 'api' ? 'green' : 'orange'} style={{ fontSize: 10 }} title="通信记录数据源">
          {source === 'api' ? '实时记录' : '无记录'}
        </Tag>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>共 {entries.length} 条</span>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <Spin size="small" /> 加载中…
        </div>
      ) : entries.length === 0 ? (
        <Empty
          image={<MessageSquare size={40} style={{ opacity: 0.3 }} />}
          description={<span style={{ fontSize: 12, color: '#94a3b8' }}>暂无电话/短信通知记录</span>}
          style={{ margin: '6px 0' }}
        />
      ) : (
        <div style={{ maxHeight, overflowY: 'auto', paddingRight: 4 }}>
          <Timeline
            items={entries.map((e) => {
              const isPhone = e.channel === 'phone';
              const meta = STATUS_META[e.status] ?? { label: e.status, color: 'default' };
              const ok = e.status === 'connected' || e.status === 'sent';
              return {
                color: ok ? 'green' : 'red',
                dot: isPhone ? <Phone size={12} color={ok ? '#10b981' : '#dc2626'} /> : <MessageSquare size={12} color={ok ? '#3b82f6' : '#dc2626'} />,
                children: (
                  <div key={e.id} style={{ fontSize: 12, lineHeight: 1.7 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {isPhone ? '电话呼叫' : '短信发送'}
                    </span>{' '}
                    <Tag color={meta.color} style={{ fontSize: 10 }}>{meta.label}</Tag>
                    <span style={{ color: '#475569' }}>{e.phone}</span>
                    <span style={{ color: '#94a3b8', marginLeft: 6 }}>{fmt(e.at)}</span>
                    {isPhone && typeof e.durationSec === 'number' && e.durationSec > 0 && (
                      <Tag icon={<PlayCircle size={10} />} color="blue" style={{ marginLeft: 6, fontSize: 10 }}>
                        {Math.floor(e.durationSec / 60)}分{e.durationSec % 60}秒
                      </Tag>
                    )}
                    {isPhone && e.recordingUrl && (
                      <Tooltip title="通话录音可回放">
                        <Tag icon={<FileAudio size={10} />} color="cyan" style={{ marginLeft: 4, fontSize: 10 }}>
                          录音
                        </Tag>
                      </Tooltip>
                    )}
                    {!isPhone && e.content && (
                      <div style={{ color: '#64748b', background: 'var(--bg-card)', borderRadius: 4, padding: '4px 8px', marginTop: 2, fontSize: 11 }}>
                        {e.content}
                      </div>
                    )}
                    <span style={{ marginLeft: 6, verticalAlign: -2 }}>
                      {ok ? <CheckCircle2 size={11} color="#10b981" /> : <XCircle size={11} color="#dc2626" />}
                    </span>
                  </div>
                ),
              };
            })}
          />
        </div>
      )}
    </div>
  );
};

export default AutoCallSmsLog;

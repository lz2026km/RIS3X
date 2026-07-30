import React, { useState, useMemo } from 'react';
import { Smartphone, Users, Link2, Bell, FileText, Activity, Download, Share2, Eye } from 'lucide-react';
import { message } from 'antd';
import { PORTAL_ACCESS_MOCK, PATIENT_REPORTS_MOCK, PATIENT_NOTIFICATIONS_MOCK, PATIENT_CONSENTS_MOCK, PORTAL_KPI_MOCK } from '../../data/portalMock';
import PatientPortalView from '../../components/portal/PatientPortalView';
import ReportViewer from '../../components/portal/ReportViewer';
import PatientConsentCard from '../../components/portal/PatientConsent';
import QrShareButton from '../../components/portal/QrShareButton';
import type { PatientPortalAccess, PatientReportItem, PatientConsent, PatientNotification } from '../../types/portal';

type Tab = 'overview' | 'access' | 'reports' | 'consents' | 'notifications';

export default function PatientPortalPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedAccess, setSelectedAccess] = useState<string | null>(PORTAL_ACCESS_MOCK[0]?.id ?? null);

  const accessMap = useMemo(() => {
    const m = new Map<string, PatientPortalAccess>();
    PORTAL_ACCESS_MOCK.forEach(a => m.set(a.id, a));
    return m;
  }, []);

  const selected = selectedAccess ? accessMap.get(selectedAccess) : undefined;

  const tabs: { key: Tab; icon: any; label: string }[] = [
    { key: 'overview', icon: Activity, label: '概览' },
    { key: 'access', icon: Users, label: '访问管理' },
    { key: 'reports', icon: FileText, label: '报告' },
    { key: 'consents', icon: FileText, label: '知情同意' },
    { key: 'notifications', icon: Bell, label: '通知' },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={20} color="#0ea5e9" /> 患者门户管理
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>PORTAL</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            患者端访问授权、分享链接、知情同意、通知推送管理
          </p>
        </div>
        <QrShareButton shortUrl="https://r.hospital.cn/portal" label="患者入口" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        <KpiCard icon={Users} label="活跃访问" value={PORTAL_KPI_MOCK.activeAccess} color="#0ea5e9" />
        <KpiCard icon={Link2} label="活跃链接" value={PORTAL_KPI_MOCK.activeShareLinks} color="#7c3aed" />
        <KpiCard icon={Bell} label="今日通知" value={PORTAL_KPI_MOCK.notificationsSentToday} color="#3b82f6" />
        <KpiCard icon={FileText} label="今日同意" value={PORTAL_KPI_MOCK.consentsSignedToday} color="#10b981" />
        <KpiCard icon={Users} label="患者总数" value={PORTAL_KPI_MOCK.totalPatients} color="#f59e0b" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', border: 'none', background: 'transparent',
              fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#0ea5e9' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #0ea5e9' : '2px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>访问列表</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PORTAL_ACCESS_MOCK.slice(0, 8).map(a => (
                <div
                  key={a.id}
                  onClick={() => setSelectedAccess(a.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                    background: selectedAccess === a.id ? '#eff6ff' : '#fff',
                    border: selectedAccess === a.id ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{a.patientName}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                    {a.reportIds.length} 报告 · {a.identityVerified ? '已实名' : '未实名'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            {selected && <PatientPortalView access={selected} />}
          </div>
        </div>
      )}

      {tab === 'access' && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>患者访问授权（{PORTAL_ACCESS_MOCK.length}）</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
            {PORTAL_ACCESS_MOCK.map(a => (
              <PatientPortalView key={a.id} access={a} />
            ))}
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>患者报告（{PATIENT_REPORTS_MOCK.length}）</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 8 }}>
            {PATIENT_REPORTS_MOCK.map(r => (
              <ReportViewer key={r.id} report={r} onDownload={(id) => message.info('下载功能暂不可用')} />
            ))}
          </div>
        </div>
      )}

      {tab === 'consents' && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>知情同意书（{PATIENT_CONSENTS_MOCK.length}）</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 8 }}>
            {PATIENT_CONSENTS_MOCK.map(c => (
              <PatientConsentCard
                key={c.id}
                consent={c}
                onSign={(id) => message.info('签署功能暂不可用')}
                onReject={(id) => message.info('拒绝功能暂不可用')}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>患者通知（{PATIENT_NOTIFICATIONS_MOCK.length}）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 600 }}>
            {PATIENT_NOTIFICATIONS_MOCK.slice(0, 15).map(n => (
              <div key={n.id} style={{ padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{n.title}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>· {n.channel}</span>
                  <StatusBadge status={n.status} />
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{n.patientName} · {n.sentAt ? new Date(n.sentAt).toLocaleString() : '-'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const KpiCard: React.FC<{ icon: any; label: string; value: number; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{value}</div>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { text: string; color: string; bg: string }> = {
    delivered: { text: '已送达', color: '#10b981', bg: '#d1fae5' },
    read: { text: '已读', color: '#3b82f6', bg: '#dbeafe' },
    failed: { text: '失败', color: '#ef4444', bg: '#fee2e2' },
    pending: { text: '待发送', color: '#f59e0b', bg: '#fef3c7' },
    sending: { text: '发送中', color: '#0ea5e9', bg: '#e0f2fe' },
  };
  const c = config[status] ?? config.pending;
  return <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 8, background: c.bg, color: c.color, fontWeight: 600 }}>{c.text}</span>;
};

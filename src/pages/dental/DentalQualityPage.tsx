// Dental Quality Management Page — 口腔质控管理 · ACR 合规 · 设备质控
import React, { useState, useEffect } from 'react';
import {
  Shield, Activity, CheckCircle, AlertTriangle, Clock,
  Search, ChevronRight, TrendingUp, Stethoscope,
  FileText, Settings, RefreshCw, BarChart3, Inbox,
} from 'lucide-react';
import { Spin, Empty } from 'antd';

// ─── Types ───
type QcCategory = 'cbct' | 'panoramic' | 'cad-cam' | 'implant' | 'ortho' | 'infection' | 'safety';
type QcStatus = 'pass' | 'fail' | 'review' | 'pending';

interface QcMetric {
  id: string;
  category: QcCategory;
  name: string;
  score: number;
  maxScore: number;
  status: QcStatus;
  lastAudit: string;
  trend: 'improving' | 'stable' | 'declining';
}

interface EquipmentRecord {
  id: string;
  name: string;
  type: string;
  lastCalibration: string;
  nextCalibration: string;
  status: 'normal' | 'due' | 'overdue';
  accuracy: number;
}

// ─── Constants ───
const CATEGORY_LABELS: Record<QcCategory, string> = {
  cbct: 'CBCT 质控',
  panoramic: '全景片质控',
  'cad-cam': 'CAD/CAM 质控',
  implant: '种植质控',
  ortho: '正畸质控',
  infection: '感染控制',
  safety: '患者安全',
};

const CATEGORY_COLORS: Record<QcCategory, string> = {
  cbct: '#1677ff',
  panoramic: '#7c3aed',
  'cad-cam': '#ea580c',
  implant: '#dc2626',
  ortho: '#16a34a',
  infection: '#0891b2',
  safety: '#ca8a04',
};

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  statCard: { background: '#fff', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: 800, color: '#1a3a5c', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  section: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1677ff', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 },
  td: { padding: '10px 8px', borderBottom: '1px solid #f8fafc', color: '#334155' },
  badge: (bg: string, text: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color: text, display: 'inline-block',
  }),
  scrollBox: { maxHeight: 360, overflowY: 'auto' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
};

const DentalQualityPage = () => {
  const [tab, setTab] = useState<'metrics' | 'equipment' | 'audit' | 'trend'>('metrics');
  const [metrics, setMetrics] = useState<QcMetric[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch('/api/v1/dental/quality/metrics').then(r => r.json()).catch(() => ({ success: false, data: [] })),
      fetch('/api/v1/dental/quality/equipment').then(r => r.json()).catch(() => ({ success: false, data: [] })),
    ]).then(([metricsRes, equipRes]) => {
      if (!cancelled) {
        if (metricsRes.success && Array.isArray(metricsRes.data)) setMetrics(metricsRes.data);
        if (equipRes.success && Array.isArray(equipRes.data)) setEquipment(equipRes.data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const passCount = metrics.filter(m => m.status === 'pass').length;
  const avgScore = metrics.length > 0 ? Math.round(metrics.reduce((a, b) => a + b.score, 0) / metrics.length) : 0;
  const overdueEquipment = equipment.filter(e => e.status === 'overdue' || e.status === 'due').length;

  if (loading) {
    return (
      <div style={{ padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (metrics.length === 0 && equipment.length === 0) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={24} color="#1677ff" /> 口腔质控管理</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Dental Quality Management · CBCT · CAD/CAM · 感染控制 · 设备校准</p>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <Empty description="暂无质控数据" image={<Inbox size={48} color="#94a3b8" />} />
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}><Shield size={24} color="#1677ff" /> 口腔质控管理</h1>
          <p style={s.subtitle}>Dental Quality Management · CBCT · CAD/CAM · 感染控制 · 设备校准</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn}><RefreshCw size={14} /> 刷新</button>
          <button style={s.btnPrimary}><FileText size={14} /> 导出报告</button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={s.statsRow}>
        {[
          { label: '总分均值', value: String(avgScore), unit: '分', icon: BarChart3, color: '#1677ff', bg: '#eff6ff' },
          { label: '合格项目', value: `${passCount}/${metrics.length}`, unit: '', icon: CheckCircle, color: '#16a34a', bg: '#f0fdf4' },
          { label: '设备异常', value: String(overdueEquipment), unit: '台', icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2' },
          { label: '审计周期', value: '30', unit: '天', icon: Clock, color: '#7c3aed', bg: '#f5f3ff' },
        ].map((k, i) => (
          <div key={i} style={s.statCard}>
            <div style={{ ...s.statIcon, background: k.bg }}><k.icon size={20} color={k.color} /></div>
            <div style={s.statValue}>{k.value}<span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>{k.unit}</span></div>
            <div style={s.statLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'metrics', label: '质量指标' },
          { key: 'equipment', label: '设备质控' },
          { key: 'audit', label: '审计记录' },
          { key: 'trend', label: '趋势分析' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.key ? '#1677ff' : '#f1f5f9', color: tab === t.key ? '#fff' : '#64748b' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && (
        <div style={s.grid2}>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const catMetrics = metrics.filter(m => m.category === cat);
            const catAvg = catMetrics.length > 0 ? Math.round(catMetrics.reduce((a, b) => a + b.score, 0) / catMetrics.length) : 0;
            return (
              <div key={cat} style={s.section}>
                <div style={{ ...s.sectionTitle, color: CATEGORY_COLORS[cat as QcCategory] }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[cat as QcCategory] }} />
                  {label}
                  <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>{catAvg}分</span>
                </div>
                {catMetrics.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{m.name}</span>
                    <div style={{ width: 120, height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${m.score}%`, background: m.score >= 95 ? '#16a34a' : m.score >= 85 ? '#ca8a04' : '#dc2626', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, width: 40, textAlign: 'right' }}>{m.score}</span>
                    <span style={s.badge(m.status === 'pass' ? '#f0fdf4' : m.status === 'review' ? '#fefce8' : '#fef2f2', m.status === 'pass' ? '合格' : m.status === 'review' ? '待审' : '不合格')}>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'equipment' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Settings size={16} color="#7c3aed" /> 设备校准状态</div>
          <div style={s.scrollBox}>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>编号</th><th style={s.th}>设备名称</th><th style={s.th}>型号</th>
                <th style={s.th}>上次校准</th><th style={s.th}>下次校准</th><th style={s.th}>精度</th>
                <th style={s.th}>状态</th><th style={s.th}>操作</th>
              </tr></thead>
              <tbody>
                {equipment.map(e => (
                  <tr key={e.id}>
                    <td style={s.td}>{e.id}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{e.name}</td>
                    <td style={s.td}>{e.type}</td>
                    <td style={{ ...s.td, color: '#64748b' }}>{e.lastCalibration}</td>
                    <td style={{ ...s.td, color: e.status === 'overdue' ? '#dc2626' : e.status === 'due' ? '#ea580c' : '#64748b' }}>{e.nextCalibration}</td>
                    <td style={s.td}>
                      <span style={{ color: e.accuracy >= 95 ? '#16a34a' : e.accuracy >= 90 ? '#ca8a04' : '#dc2626', fontWeight: 700 }}>{e.accuracy}%</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(e.status === 'normal' ? '#f0fdf4' : e.status === 'due' ? '#fefce8' : '#fef2f2', e.status === 'normal' ? '正常' : e.status === 'due' ? '即将到期' : '已过期')}>
                      </span>
                    </td>
                    <td style={s.td}>
                      <button style={{ padding: '4px 10px', background: '#eff6ff', color: '#1677ff', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                        校准 <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div style={s.section}>
          <div style={s.sectionTitle}><FileText size={16} color="#16a34a" /> 审计记录</div>
          {metrics.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.status === 'pass' ? '#16a34a' : '#dc2626' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{CATEGORY_LABELS[m.category]} · {m.lastAudit}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{m.score}/{m.maxScore}</span>
              <span style={{ fontSize: 12, color: m.trend === 'improving' ? '#16a34a' : m.trend === 'declining' ? '#dc2626' : '#64748b' }}>
                {m.trend === 'improving' ? '↑ 改善' : m.trend === 'declining' ? '↓ 下降' : '→ 稳定'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'trend' && (
        <div style={s.grid2}>
          <div style={s.section}>
            <div style={s.sectionTitle}><TrendingUp size={16} color="#1677ff" /> 月度质量趋势</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, textAlign: 'center' }}>
              {['1月', '2月', '3月', '4月', '5月', '6月'].map((m, i) => {
                const val = [91, 92, 93, 94, 95, 96][i];
                return (
                  <div key={m}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 120 }}>
                      <div style={{ width: '80%', height: `${(val - 85) * 6}px`, background: '#1677ff', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{m}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{val}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}><Activity size={16} color="#16a34a" /> 合格率趋势</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { month: '2026-07', rate: 96 },
                { month: '2026-06', rate: 94 },
                { month: '2026-05', rate: 93 },
                { month: '2026-04', rate: 91 },
              ].map(t => (
                <div key={t.month} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 80, fontSize: 12, color: '#64748b' }}>{t.month}</span>
                  <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${t.rate}%`, background: '#16a34a', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>{t.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`.v4-icon { display: inline-block; vertical-align: middle; }`}</style>
    </div>
  );
};

export default DentalQualityPage;

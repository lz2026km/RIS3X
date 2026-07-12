import { useMemo, useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { Spin } from 'antd';
import WorkloadHeatmap from '../components/worklist/WorkloadHeatmap';
import { WorkloadBalancer } from '../services/worklist/WorkloadBalancer';
import { HeatmapBuilder } from '../services/worklist/HeatmapBuilder';
import { workflowApi } from '../services/api/workflowApi';

const FALLBACK_SITES = [
  { siteId: 'SITE-MAIN', siteName: '总院', doctors: 28, activeStudies: 142, pendingReports: 86, completedToday: 168, averageReportMinutes: 18, utilizationPct: 92 },
  { siteId: 'SITE-EAST', siteName: '东院区', doctors: 14, activeStudies: 64, pendingReports: 38, completedToday: 78, averageReportMinutes: 20, utilizationPct: 78 },
  { siteId: 'SITE-WEST', siteName: '西院区', doctors: 12, activeStudies: 48, pendingReports: 28, completedToday: 62, averageReportMinutes: 22, utilizationPct: 68 },
  { siteId: 'SITE-SOUTH', siteName: '南院区', doctors: 10, activeStudies: 52, pendingReports: 32, completedToday: 58, averageReportMinutes: 19, utilizationPct: 72 },
  { siteId: 'SITE-NORTH', siteName: '北院区', doctors: 8, activeStudies: 38, pendingReports: 24, completedToday: 45, averageReportMinutes: 24, utilizationPct: 65 },
  { siteId: 'SITE-CHILD', siteName: '儿科分院', doctors: 6, activeStudies: 28, pendingReports: 14, completedToday: 35, averageReportMinutes: 16, utilizationPct: 58 },
  { siteId: 'SITE-EMERG', siteName: '急诊区', doctors: 4, activeStudies: 86, pendingReports: 12, completedToday: 92, averageReportMinutes: 12, utilizationPct: 95 },
  { siteId: 'SITE-IMAGE', siteName: '中央影像中心', doctors: 16, activeStudies: 72, pendingReports: 44, completedToday: 88, averageReportMinutes: 21, utilizationPct: 84 },
];

const KpiCard: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ width: 8, height: 36, background: color, borderRadius: 4 }} />
    <div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{value} <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{unit}</span></div>
    </div>
  </div>
);

export default function WorkloadHeatmapPage() {
  const balancer = useMemo(() => new WorkloadBalancer(), []);
  const builder = useMemo(() => new HeatmapBuilder(), []);
  const [siteData, setSiteData] = useState(FALLBACK_SITES);
  const [workflowMeta, setWorkflowMeta] = useState<{ definitions: number; slaPolicies: number; routingRules: number }>({ definitions: 0, slaPolicies: 0, routingRules: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflowMeta();
  }, []);

  const loadWorkflowMeta = async () => {
    setLoading(true);
    try {
      const [defRes, slaRes, ruleRes] = await Promise.all([
        workflowApi.listDefinitions(),
        workflowApi.listSlaPolicies(),
        workflowApi.listRoutingRules(),
      ]);
      setWorkflowMeta({
        definitions: (defRes.data as any[])?.length ?? 0,
        slaPolicies: (slaRes.data as any[])?.length ?? 0,
        routingRules: (ruleRes.data as any[])?.length ?? 0,
      });
    } catch { /* use fallback */ } finally {
      setLoading(false);
    }
  };

  const sites = useMemo(() => balancer.ingest(siteData), [balancer, siteData]);
  const cells = useMemo(() => builder.build({ sites }), [builder, sites]);

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ background: 'linear-gradient(135deg,#0891b2 0%,#06b6d4 100%)', color: '#fff', padding: '14px 24px', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={20} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>工作负载热力图</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>跨院区 24 小时负荷监控 · 工作流 {workflowMeta.definitions} 定义 · SLA {workflowMeta.slaPolicies} 策略</div>
          </div>
        </div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <KpiCard label="今日检查" value={sites.reduce((s, x) => s + x.completedToday, 0)} unit="例" color="#0891b2" />
        <KpiCard label="在岗医生" value={sites.reduce((s, x) => s + x.doctors, 0)} unit="人" color="#7c3aed" />
        <KpiCard label="待写报告" value={sites.reduce((s, x) => s + x.pendingReports, 0)} unit="份" color="#dc2626" />
        <KpiCard label="平均利用率" value={Math.round(sites.reduce((s, x) => s + x.utilizationPct, 0) / sites.length)} unit="%" color="#059669" />
      </div>
      <WorkloadHeatmap sites={sites} cells={cells} />
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {sites.map((s) => (
          <div key={s.siteId} style={{ background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 13 }}>{s.siteName}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>容量评分 {s.capacityScore}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
              利用率 {s.utilizationPct}% · 报告 {s.pendingReports} · 医生 {s.doctors}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
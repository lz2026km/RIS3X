import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { Select } from "antd";
import type { TableColumnsType } from "antd";
import { rdsrApi } from "../../services/api/rdsrApi";
import { ChartContainer } from "../../components/charts";
import { DataTable } from "../../components/common/DataTable";
import { ActionButton } from "../../components/common/ActionButton";
import { ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import type {
  DrlEntry,
  TodayDoseStats,
  DoseAlert,
  PatientDoseSummary,
  CumulativeDose,
  RdsrStats,
} from "../../services/api/rdsrApi";

const fmt = (n: number | undefined | null, digits = 1): string =>
  n === undefined || n === null || Number.isNaN(n) ? "-" : n.toFixed(digits);

const fmtDate = (d: string): string => {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${y}-${m}-${day}` : d;
};

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 12,
  padding: 18,
  border: "1px solid var(--border-color, #e2e8f0)",
};

const cardTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--color-primary-800)",
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
  gap: 'var(--space-2, 8px)',
};

const btn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid var(--border-color, #cbd5e1)",
  background: "var(--bg-card)",
  color: 'var(--text-primary, #334155)',
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "var(--color-primary-800)",
  borderColor: "var(--color-primary-800)",
  color: "#fff",
};

const input: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-color, #e2e8f0)",
  fontSize: 12,
  color: 'var(--text-primary, #334155)', width: "100%",
  boxSizing: "border-box",
};

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary-800)", marginTop: 'var(--space-1, 4px)', lineHeight: 1.2 }}>
          {value}
          {sub && <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', fontWeight: 400 }}> {sub}</span>}
        </div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}1a`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
    </div>
  );
}

const levelBadge: Record<string, React.CSSProperties> = {
  critical: { background: "#fee2e2", color: "var(--color-error-600)" },
  warning: { background: "#fef3c7", color: "#b45309" },
  normal: { background: "#d1fae5", color: "#047857" },
};

const levelText: Record<string, string> = {
  critical: "严重",
  warning: "警告",
  normal: "正常",
};

export default function DoseLiveMonitor() {
  const [today, setToday] = useState<TodayDoseStats | null>(null);
  const [drls, setDrls] = useState<DrlEntry[]>([]);
  const [editing, setEditing] = useState<Record<string, { ctdivolDrl: string; dlpDrl: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<DoseAlert[]>([]);
  const [alertFilter, setAlertFilter] = useState<"all" | "pending" | "acknowledged">("all");
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [patientResults, setPatientResults] = useState<PatientDoseSummary[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDoseSummary | null>(null);
  const [cumulative, setCumulative] = useState<CumulativeDose | null>(null);
  const [cumLoading, setCumLoading] = useState(false);
  // [W2-A] getStats: 剂量统计 (getStats) + 趋势
  const [stats, setStats] = useState<RdsrStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reloadToday = useCallback(async () => {
    const res = await rdsrApi.getToday();
    if (res.success && res.data) setToday(res.data);
  }, []);

  const reloadDrls = useCallback(async () => {
    const res = await rdsrApi.getDrls();
    if (res.success && res.data) {
      setDrls(res.data);
      setEditing((prev) => {
        const next: Record<string, { ctdivolDrl: string; dlpDrl: string }> = {};
        for (const d of res.data) {
          next[d.bodyPart] = prev[d.bodyPart] ?? { ctdivolDrl: String(d.ctdivolDrl), dlpDrl: String(d.dlpDrl) };
        }
        return next;
      });
    }
  }, []);

  const reloadAlerts = useCallback(async () => {
    const res = await rdsrApi.getAlerts();
    if (res.success && res.data) setAlerts(res.data);
  }, []);

  // [W2-A] GET /rdsr/stats: 按日期范围统计 + 每日平均 DLP/CTDIvol 趋势
  const loadStats = useCallback(
    async (from = dateFrom, to = dateTo) => {
      setStatsLoading(true);
      setStatsError("");
      try {
        const res = await rdsrApi.getStats(from || undefined, to || undefined);
        if (res.success && res.data) setStats(res.data);
        else setStatsError(res.error?.message ?? t('doseLive.statsLoadFailed'));
      } catch (e) {
        setStatsError((e as Error)?.message ?? t('doseLive.statsLoadFailed'));
      } finally {
        setStatsLoading(false);
      }
    },
    [dateFrom, dateTo],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadError(null);
      try {
        const [todayRes, d, a, s] = await Promise.all([rdsrApi.getToday(), rdsrApi.getDrls(), rdsrApi.getAlerts(), rdsrApi.getStats()]);
        if (!alive) return;
        if (todayRes.success && todayRes.data) setToday(todayRes.data);
        if (d.success && d.data) {
          setDrls(d.data);
          const init: Record<string, { ctdivolDrl: string; dlpDrl: string }> = {};
          for (const entry of d.data) init[entry.bodyPart] = { ctdivolDrl: String(entry.ctdivolDrl), dlpDrl: String(entry.dlpDrl) };
          setEditing(init);
        }
        if (a.success && a.data) setAlerts(a.data);
        if (s.success && s.data) setStats(s.data);
        if (!todayRes.success && !d.success && !a.success && !s.success) setLoadError(t('w9.states.error'));
      } catch {
        if (alive) setLoadError(t('w9.states.error'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadTick]);

  const handleRefresh = useCallback(() => {
    void reloadToday();
    void reloadDrls();
    void reloadAlerts();
  }, [reloadToday, reloadDrls, reloadAlerts]);

  const handleSaveDrl = useCallback(
    async (entry: DrlEntry) => {
      const values = editing[entry.bodyPart];
      if (!values) return;
      const ctdivolDrl = Number(values.ctdivolDrl);
      const dlpDrl = Number(values.dlpDrl);
      if (!Number.isFinite(ctdivolDrl) || ctdivolDrl <= 0 || !Number.isFinite(dlpDrl) || dlpDrl <= 0) return;
      setSaving(entry.bodyPart);
      const res = await rdsrApi.updateDrl({ bodyPart: entry.bodyPart, modality: entry.modality, ctdivolDrl, dlpDrl, source: "自定义" });
      setSaving(null);
      if (res.success && res.data) setDrls(res.data);
    },
    [editing],
  );

  const handleSearch = useCallback(async () => {
    setSearching(true);
    const res = await rdsrApi.searchPatients(searchText);
    setSearching(false);
    if (res.success && res.data) setPatientResults(res.data);
  }, [searchText]);

  const handleSelectPatient = useCallback(async (summary: PatientDoseSummary) => {
    setSelectedPatient(summary);
    setCumulative(null);
    setCumLoading(true);
    const res = await rdsrApi.getPatientCumulative(summary.patientId);
    setCumLoading(false);
    if (res.success && res.data) setCumulative(res.data);
  }, []);

  const handleAck = useCallback(
    async (id: string) => {
      const res = await rdsrApi.ackAlert(id);
      if (res.success && res.data) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? res.data! : a)));
      }
    },
    [],
  );

  const visibleAlerts = useMemo(() => {
    if (alertFilter === "pending") return alerts.filter((a) => !a.acknowledged);
    if (alertFilter === "acknowledged") return alerts.filter((a) => a.acknowledged);
    return alerts;
  }, [alerts, alertFilter]);

  const distributionData = useMemo(() => {
    if (!today) return [];
    const drlByPart: Record<string, number> = {};
    for (const d of drls) drlByPart[d.bodyPart] = d.dlpDrl;
    return today.bodyPartDistribution.map((bp) => ({
      bodyPart: bp.bodyPart,
      avgDlp: bp.avgDlp,
      drlDlp: drlByPart[bp.bodyPart] ?? 0,
      overDrlCount: bp.overDrlCount,
    }));
  }, [today, drls]);

  const trendData = useMemo(() => cumulative?.monthlyTrend ?? [], [cumulative]);

  // [W2-A] getStats.trend: { date, avgCtdivol, avgDlp }
  const statsTrendData = useMemo(() => stats?.trend ?? [], [stats]);

  type DoseExamRow = CumulativeDose["exams"][number];

  const badgeStyle = (bg: React.CSSProperties | undefined): React.CSSProperties => ({
    ...bg,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  });

  const doseColumns: TableColumnsType<DoseExamRow> = [
    { title: t('doseLive.colDate'), dataIndex: 'examDate', key: 'examDate', render: (v: string) => fmtDate(v) },
    { title: t('doseLive.colBodyPart'), dataIndex: 'bodyPart', key: 'bodyPart' },
    { title: 'CTDIvol', dataIndex: 'ctdivol', key: 'ctdivol', render: (v: number) => fmt(v) },
    { title: 'DLP', dataIndex: 'dlp', key: 'dlp', render: (v: number) => fmt(v) },
    { title: 'SSDE', dataIndex: 'ssde', key: 'ssde', render: (v: number) => fmt(v) },
    {
      title: t('doseLive.colLevel'), dataIndex: 'alertLevel', key: 'alertLevel',
      render: (v: string) => <span style={badgeStyle(levelBadge[v])}>{levelText[v]}</span>,
    },
  ];

  const alertColumns: TableColumnsType<DoseAlert> = [
    { title: t('doseLive.colDate'), dataIndex: 'date', key: 'date', render: (v: string) => fmtDate(v) },
    { title: t('doseLive.colPatient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('doseLive.colBodyPart'), dataIndex: 'bodyPart', key: 'bodyPart' },
    { title: 'CTDIvol', dataIndex: 'ctdivol', key: 'ctdivol', render: (v: number) => `${fmt(v)} mGy` },
    { title: 'DLP', dataIndex: 'dlp', key: 'dlp', render: (v: number) => fmt(v) },
    {
      title: t('doseLive.colDrlThreshold'), key: 'drl',
      render: (_: unknown, a: DoseAlert) => <span style={{ color: 'var(--text-muted, #64748b)' }}>{fmt(a.ctdivolDrl)} / {fmt(a.dlpDrl)}</span>,
    },
    {
      title: t('doseLive.colLevel'), dataIndex: 'level', key: 'level',
      render: (v: string) => <span style={badgeStyle(levelBadge[v])}>{v === "critical" ? t('doseLive.levelCritical') : t('doseLive.levelWarning')}</span>,
    },
    {
      title: t('doseLive.colStatus'), dataIndex: 'acknowledged', key: 'status',
      render: (v: boolean) => v ? (
        <span style={{ color: "#059669", display: "inline-flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
          <CheckCircle2 size={13} /> {t('doseLive.acknowledged')}
        </span>
      ) : (
        <span style={{ color: "#b45309", display: "inline-flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
          <AlertTriangle size={13} /> {t('doseLive.pending')}
        </span>
      ),
    },
    {
      title: t('doseLive.colActions'), key: 'actions', align: 'center' as const,
      render: (_: unknown, a: DoseAlert) => !a.acknowledged ? (
        <ActionButton action="submit" size="compact" icon={<CheckCircle2 size={12} />} onClick={() => void handleAck(a.id)}>
          {t('doseLive.acknowledge')}
        </ActionButton>
      ) : null,
    },
  ];

  const drlColumns: TableColumnsType<DrlEntry> = [
    { title: t('doseLive.colModality'), dataIndex: 'modality', key: 'modality' },
    { title: t('doseLive.colExamBodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: t('doseLive.colCtdiThreshold'), key: 'ctdivolDrl',
      render: (_: unknown, d: DrlEntry) => {
        const values = editing[d.bodyPart] ?? { ctdivolDrl: String(d.ctdivolDrl), dlpDrl: String(d.dlpDrl) };
        return (
          <input
            style={{ ...input, width: 90 }}
            type="number"
            min={1}
            value={values.ctdivolDrl}
            onChange={(e) => setEditing((prev) => ({ ...prev, [d.bodyPart]: { ...values, ctdivolDrl: e.target.value } }))}
          />
        );
      },
    },
    {
      title: t('doseLive.colDlpThreshold'), key: 'dlpDrl',
      render: (_: unknown, d: DrlEntry) => {
        const values = editing[d.bodyPart] ?? { ctdivolDrl: String(d.ctdivolDrl), dlpDrl: String(d.dlpDrl) };
        return (
          <input
            style={{ ...input, width: 100 }}
            type="number"
            min={1}
            value={values.dlpDrl}
            onChange={(e) => setEditing((prev) => ({ ...prev, [d.bodyPart]: { ...values, dlpDrl: e.target.value } }))}
          />
        );
      },
    },
    { title: t('doseLive.colSource'), dataIndex: 'source', key: 'source', render: (v: string) => <span style={{ color: 'var(--text-muted, #64748b)' }}>{v}</span> },
    {
      title: t('doseLive.colActions'), key: 'actions', align: 'center' as const,
      render: (_: unknown, d: DrlEntry) => (
        <ActionButton action="save" size="compact" loading={saving === d.bodyPart} onClick={() => void handleSaveDrl(d)}>
          {saving === d.bodyPart ? t('doseLive.saving') : t('doseLive.save')}
        </ActionButton>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 'var(--space-10, 40px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>
        {t('doseLive.loadingRealtime')}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-4, 16px)' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-primary-800)", display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
        <Activity size={18} /> {t('doseLive.title')}
      </div>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ActionButton action="refresh" size="compact" onClick={handleRefresh}>
          {t('doseLive.refresh')}
        </ActionButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 'var(--space-3, 12px)' }}>
        <StatCard label={t('doseLive.todayExams')} value={String(today?.totalExams ?? 0)} sub={t('doseLive.timesUnit')} icon={<Activity size={18} />} color="var(--color-primary-500)" />
        <StatCard label={t('doseLive.avgDlp')} value={fmt(today?.avgDlp)} sub="mGy·cm" icon={<TrendingUp size={18} />} color="#8b5cf6" />
        <StatCard label={t('doseLive.avgCtdiVol')} value={fmt(today?.avgCtdiVol)} sub="mGy" icon={<Activity size={18} />} color="#059669" />
        <StatCard label={t('doseLive.overDrl')} value={String(today?.overDrlCount ?? 0)} sub={`${today?.warningCount ?? 0}警 / ${today?.criticalCount ?? 0}危`} icon={<ShieldAlert size={18} />} color="var(--color-error-600)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--space-4, 16px)' }}>
        <div style={card}>
          <div style={cardTitle}>
            <BarChart3 size={14} /> {t('doseLive.distributionTitle')}
          </div>
          {distributionData.length === 0 ? (
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center", padding: 'var(--space-6, 24px)' }}>{t('doseLive.noExamToday')}</div>
          ) : (
          <ChartContainer height={240} state={distributionData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('doseLive.noDistribution')}>
            <BarChart data={distributionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="bodyPart" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number | string) => [`${v} mGy·cm`]} />
                <Legend iconSize={10} />
                <Bar dataKey="avgDlp" fill="var(--color-primary-500)" name={t('doseLive.avgDlpSeries')} radius={[4, 4, 0, 0]} />
                <Bar dataKey="drlDlp" fill="var(--color-warning-500)" name={t('doseLive.drlThreshold')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div style={card}>
          <div style={cardTitle}>
            <Users size={14} /> {t('doseLive.patientSearchTitle')}
          </div>
          <div style={{ display: "flex", gap: 'var(--space-2, 8px)', marginBottom: 10 }}>
            <input
              style={{ ...input, flex: 1 }}
              placeholder={t('doseLive.searchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
            />
            <button style={btnPrimary} onClick={handleSearch} disabled={searching}>
              <Search size={13} /> {t('doseLive.search')}
            </button>
          </div>
          {patientResults.length > 0 && (
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 8 }}>
              {patientResults.map((p) => (
                <div
                  key={p.patientId}
                  data-testid={`patient-row-${p.patientId}`}
                  onClick={() => void handleSelectPatient(p)}
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    background: selectedPatient?.patientId === p.patientId ? "#eff6ff" : "var(--bg-card)",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span style={{ color: 'var(--text-primary, #334155)' }}>
                    {p.patientName} <span style={{ color: 'var(--text-muted, #94a3b8)' }}>({p.patientId})</span>
                  </span>
                  <span style={{ color: p.overDrlCount > 0 ? "var(--color-error-600)" : "#64748b" }}>
                    {p.examCount} {t('doseLive.timesUnit')} · 30{t('doseLive.daysUnit')} {fmt(p.totalDlp30d)} · 1{t('doseLive.yearUnit')} {fmt(p.totalDlp1y)}
                    {p.overDrlCount > 0 ? ` · 超限${p.overDrlCount}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {selectedPatient && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
              {t('doseLive.selectedPatient')}<strong style={{ color: "var(--color-primary-800)" }}>{selectedPatient.patientName}</strong>（{selectedPatient.patientId}）
            </div>
          )}
        </div>
      </div>

      {selectedPatient && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--space-4, 16px)' }}>
          <div style={card}>
          <div style={cardTitle}>
            <TrendingUp size={14} /> {cumulative?.patientName ?? selectedPatient.patientName} {t('doseLive.annualTrend')}
          </div>
            {cumLoading ? (
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center", padding: 'var(--space-6, 24px)' }}>{t('doseLive.loading')}</div>
            ) : cumulative ? (
              <>
          <ChartContainer height={220} state={trendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('doseLive.noTrend')}>
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number | string) => [`${v} mGy·cm`, "月度DLP"]} />
                    <ReferenceLine y={cumulative.annualLimit / 12} stroke="var(--color-error-600)" strokeDasharray="5 5" label={{ value: t('doseLive.monthlyLimit'), fontSize: 11, fill: "var(--color-error-600)", position: "insideTopRight" }} />
                    <Line type="monotone" dataKey="totalDlp" stroke="var(--color-primary-500)" strokeWidth={2} dot={{ r: 3 }} name={t('doseLive.monthlyDlp')} />
                  </LineChart>
                </ChartContainer>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 'var(--space-2, 8px)', marginTop: 10 }}>
                  <MiniInfo label={t('doseLive.cum30dDlp')} value={`${fmt(cumulative.totalDlp30d)} mGy·cm`} />
                  <MiniInfo label={t('doseLive.cumYearDlp')} value={`${fmt(cumulative.totalDlp1y)} mGy·cm`} />
                  <MiniInfo label={t('doseLive.annualLimitPercent')} value={`${fmt(cumulative.percentOfLimit1y)}%`} warn={cumulative.percentOfLimit1y >= 80} />
                  <MiniInfo label={t('doseLive.totalExamCount')} value={`${cumulative.totalExams} 次`} />
                </div>
              </>
            ) : null}
          </div>

          <div style={card}>
          <div style={cardTitle}>
            <Users size={14} /> {t('doseLive.doseDetail')}
          </div>
            {cumLoading ? (
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center", padding: 'var(--space-6, 24px)' }}>{t('doseLive.loading')}</div>
            ) : cumulative && cumulative.exams.length > 0 ? (
              <DataTable<DoseExamRow>
                rowKey="id"
                dataSource={cumulative.exams}
                columns={doseColumns}
                showPagination={false}
                scroll={{ x: "max-content", y: 280 }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center", padding: 'var(--space-6, 24px)' }}>{t('doseLive.noRecords')}</div>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ ...cardTitle, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <Bell size={14} /> {t('doseLive.alertList')}
            <span style={{ background: "#fee2e2", color: "var(--color-error-600)", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              {alerts.filter((a) => !a.acknowledged).length} {t('doseLive.pendingCount')}
            </span>
          </span>
          <Select
            size="small"
            style={{ width: 110 }}
            value={alertFilter}
            onChange={(v) => setAlertFilter(v as "all" | "pending" | "acknowledged")}
            options={[
              { value: "all", label: t('doseLive.filterAll') },
              { value: "pending", label: t('doseLive.filterPending') },
              { value: "acknowledged", label: t('doseLive.filterAcknowledged') },
            ]}
          />
        </div>
        <DataTable<DoseAlert>
          rowKey="id"
          dataSource={visibleAlerts}
          columns={alertColumns}
          emptyText={t('doseLive.noAlerts')}
          scroll={{ x: "max-content" }}
        />
      </div>

      <div style={card}>
        <div style={{ ...cardTitle, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <BarChart3 size={14} /> {t('doseLive.statsTitle')}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)', fontWeight: 400 }}>
            <input
              type="date"
              style={{ ...input, width: 150 }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{t('doseLive.to')}</span>
            <input
              type="date"
              style={{ ...input, width: 150 }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <button style={btnPrimary} onClick={() => void loadStats()} disabled={statsLoading}>
              <BarChart3 size={13} /> {statsLoading ? t('doseLive.calculating') : t('doseLive.query')}
            </button>
          </span>
        </div>
        {statsError && <div style={{ color: "var(--color-error-600)", fontSize: 12, marginBottom: 10 }}>{statsError}</div>}
        {stats ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 'var(--space-2, 8px)', marginBottom: 14 }}>
              <MiniInfo label={t('doseLive.totalExamCount')} value={`${stats.totalExams} 次`} />
              <MiniInfo label={t('doseLive.avgCtdiVolLabel')} value={`${fmt(stats.avgCtdivol)} mGy`} />
              <MiniInfo label={t('doseLive.avgDlpLabel')} value={`${fmt(stats.avgDlp)} mGy·cm`} />
              <MiniInfo label={t('doseLive.maxCtdiVol')} value={`${fmt(stats.maxCtdivol)} mGy`} warn={stats.maxCtdivol > 40} />
              <MiniInfo label={t('doseLive.maxDlp')} value={`${fmt(stats.maxDlp)} mGy·cm`} warn={stats.maxDlp > 900} />
              <MiniInfo label={t('doseLive.alerts')} value={`${stats.warningCount} 警 / ${stats.criticalCount} 危`} warn={stats.criticalCount > 0} />
            </div>
            {statsTrendData.length > 0 ? (
          <ChartContainer height={200} state={statsTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('doseLive.noStatsTrend')}>
            <LineChart data={statsTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--color-primary-500)" }} unit=" mGy" width={60} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#8b5cf6" }} unit=" mGy·cm" width={70} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconSize={10} />
                  <Line yAxisId="left" type="monotone" dataKey="avgCtdivol" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} name={`${t('doseLive.avgCtdiVolLabel')} (mGy)`} />
                  <Line yAxisId="right" type="monotone" dataKey="avgDlp" stroke="var(--color-primary-500)" strokeWidth={2} dot={{ r: 2 }} name={`${t('doseLive.avgDlpLabel')} (mGy·cm)`} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center", padding: 'var(--space-5, 20px)' }}>
                {statsLoading ? t('doseLive.calculating') : t('doseLive.noRecordsInRange')}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center", padding: 'var(--space-6, 24px)' }}>
            {statsLoading ? t('doseLive.calculating') : t('doseLive.noStatsData')}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ ...cardTitle, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <ShieldAlert size={14} /> {t('doseLive.drlConfigTitle')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{t('doseLive.drlConfigHint')}</span>
        </div>
        <DataTable<DrlEntry>
          rowKey={(d) => `${d.modality}-${d.bodyPart}`}
          dataSource={drls}
          columns={drlColumns}
          showPagination={false}
          scroll={{ x: "max-content" }}
        />
      </div>
    </div>
  );
}

function MiniInfo({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "8px 10px", border: `1px solid ${warn ? "#fecaca" : "var(--border-color, #e2e8f0)"}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: warn ? "var(--color-error-600)" : "var(--color-primary-800)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

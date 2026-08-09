import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  RefreshCw,
  Save,
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
import { rdsrApi } from "../../services/api/rdsrApi";
import { ChartContainer } from "../../components/charts";
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
  border: "1px solid #e2e8f0",
};

const cardTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#1e40af",
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const btn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "var(--bg-card)",
  color: "#334155",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "#1e40af",
  borderColor: "#1e40af",
  color: "#fff",
};

const input: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  color: "#334155",
  outline: "none",
  width: "100%",
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
        <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1e40af", marginTop: 4, lineHeight: 1.2 }}>
          {value}
          {sub && <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}> {sub}</span>}
        </div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}1a`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "center" }) {
  return (
    <th style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "#64748b", textAlign: align ?? "left", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function Td({ children, align, style }: { children: React.ReactNode; align?: "center"; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "8px 10px", fontSize: 12, color: "#334155", borderBottom: "1px solid #f1f5f9", textAlign: align ?? "left", whiteSpace: "nowrap", ...style }}>
      {children}
    </td>
  );
}

const levelBadge: Record<string, React.CSSProperties> = {
  critical: { background: "#fee2e2", color: "#dc2626" },
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
        else setStatsError(res.error?.message ?? "剂量统计加载失败");
      } catch (e) {
        setStatsError((e as Error)?.message ?? "剂量统计加载失败");
      } finally {
        setStatsLoading(false);
      }
    },
    [dateFrom, dateTo],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [t, d, a, s] = await Promise.all([rdsrApi.getToday(), rdsrApi.getDrls(), rdsrApi.getAlerts(), rdsrApi.getStats()]);
      if (!alive) return;
      if (t.success && t.data) setToday(t.data);
      if (d.success && d.data) {
        setDrls(d.data);
        const init: Record<string, { ctdivolDrl: string; dlpDrl: string }> = {};
        for (const entry of d.data) init[entry.bodyPart] = { ctdivolDrl: String(entry.ctdivolDrl), dlpDrl: String(entry.dlpDrl) };
        setEditing(init);
      }
      if (a.success && a.data) setAlerts(a.data);
      if (s.success && s.data) setStats(s.data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  if (loading) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>
        实时剂量数据加载中...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#1e40af", display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={18} /> 剂量实时监测
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={btn} onClick={handleRefresh}>
          <RefreshCw size={13} /> 刷新
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <StatCard label="今日检查数" value={String(today?.totalExams ?? 0)} sub="次" icon={<Activity size={18} />} color="#3b82f6" />
        <StatCard label="今日平均 DLP" value={fmt(today?.avgDlp)} sub="mGy·cm" icon={<TrendingUp size={18} />} color="#8b5cf6" />
        <StatCard label="今日平均 CTDIvol" value={fmt(today?.avgCtdiVol)} sub="mGy" icon={<Activity size={18} />} color="#059669" />
        <StatCard label="超 DRL 阈值" value={String(today?.overDrlCount ?? 0)} sub={`${today?.warningCount ?? 0}警 / ${today?.criticalCount ?? 0}危`} icon={<ShieldAlert size={18} />} color="#dc2626" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={cardTitle}>
            <BarChart3 size={14} /> 今日各部位平均 DLP vs DRL 阈值
          </div>
          {distributionData.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 24 }}>今日暂无检查记录</div>
          ) : (
          <ChartContainer height={240} state={distributionData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无剂量分布数据">
            <BarChart data={distributionData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="bodyPart" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number | string) => [`${v} mGy·cm`]} />
                <Legend iconSize={10} />
                <Bar dataKey="avgDlp" fill="#3b82f6" name="平均DLP" radius={[4, 4, 0, 0]} />
                <Bar dataKey="drlDlp" fill="#f59e0b" name="DRL阈值" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div style={card}>
          <div style={cardTitle}>
            <Users size={14} /> 患者累计剂量搜索
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              style={{ ...input, flex: 1 }}
              placeholder="输入患者姓名 / ID 搜索"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
            />
            <button style={btnPrimary} onClick={handleSearch} disabled={searching}>
              <Search size={13} /> 搜索
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
                  <span style={{ color: "#334155" }}>
                    {p.patientName} <span style={{ color: "#94a3b8" }}>({p.patientId})</span>
                  </span>
                  <span style={{ color: p.overDrlCount > 0 ? "#dc2626" : "#64748b" }}>
                    {p.examCount} 次 · 30天 {fmt(p.totalDlp30d)} · 1年 {fmt(p.totalDlp1y)}
                    {p.overDrlCount > 0 ? ` · 超限${p.overDrlCount}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {selectedPatient && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
              已选患者：<strong style={{ color: "#1e40af" }}>{selectedPatient.patientName}</strong>（{selectedPatient.patientId}）
            </div>
          )}
        </div>
      </div>

      {selectedPatient && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
          <div style={cardTitle}>
            <TrendingUp size={14} /> {cumulative?.patientName ?? selectedPatient.patientName} 年度累计趋势（DLP）
          </div>
            {cumLoading ? (
              <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 24 }}>加载中...</div>
            ) : cumulative ? (
              <>
          <ChartContainer height={220} state={trendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无趋势数据">
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number | string) => [`${v} mGy·cm`, "月度DLP"]} />
                    <Legend iconSize={10} />
                    <ReferenceLine y={cumulative.annualLimit / 12} stroke="#dc2626" strokeDasharray="5 5" label={{ value: "月均限额", fontSize: 11, fill: "#dc2626", position: "insideTopRight" }} />
                    <Line type="monotone" dataKey="totalDlp" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="月度DLP" />
                  </LineChart>
                </ChartContainer>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 10 }}>
                  <MiniInfo label="30天累计 DLP" value={`${fmt(cumulative.totalDlp30d)} mGy·cm`} />
                  <MiniInfo label="年度累计 DLP" value={`${fmt(cumulative.totalDlp1y)} mGy·cm`} />
                  <MiniInfo label="年度限额占比" value={`${fmt(cumulative.percentOfLimit1y)}%`} warn={cumulative.percentOfLimit1y >= 80} />
                  <MiniInfo label="累计检查次数" value={`${cumulative.totalExams} 次`} />
                </div>
              </>
            ) : null}
          </div>

          <div style={card}>
          <div style={cardTitle}>
            <Users size={14} /> 剂量记录明细
          </div>
            {cumLoading ? (
              <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 24 }}>加载中...</div>
            ) : cumulative && cumulative.exams.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>日期</Th>
                      <Th>部位</Th>
                      <Th>CTDIvol</Th>
                      <Th>DLP</Th>
                      <Th>SSDE</Th>
                      <Th>等级</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {cumulative.exams.map((e) => (
                      <tr key={e.id}>
                        <Td>{fmtDate(e.examDate)}</Td>
                        <Td>{e.bodyPart}</Td>
                        <Td>{fmt(e.ctdivol)}</Td>
                        <Td>{fmt(e.dlp)}</Td>
                        <Td>{fmt(e.ssde)}</Td>
                        <Td>
                          <span style={{ ...levelBadge[e.alertLevel], padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                            {levelText[e.alertLevel]}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 24 }}>无记录</div>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ ...cardTitle, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={14} /> 超 DRL 告警列表
            <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              {alerts.filter((a) => !a.acknowledged).length} 待处理
            </span>
          </span>
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value as "all" | "pending" | "acknowledged")}
            style={{ ...input, width: 110 }}
          >
            <option value="all">全部</option>
            <option value="pending">待处理</option>
            <option value="acknowledged">已确认</option>
          </select>
        </div>
        {visibleAlerts.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 24 }}>暂无告警</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>日期</Th>
                  <Th>患者</Th>
                  <Th>部位</Th>
                  <Th>CTDIvol</Th>
                  <Th>DLP</Th>
                  <Th>DRL 阈值</Th>
                  <Th>等级</Th>
                  <Th>状态</Th>
                  <Th align="center">操作</Th>
                </tr>
              </thead>
              <tbody>
                {visibleAlerts.map((a) => (
                  <tr key={a.id}>
                    <Td>{fmtDate(a.date)}</Td>
                    <Td>{a.patientName}</Td>
                    <Td>{a.bodyPart}</Td>
                    <Td>{fmt(a.ctdivol)} mGy</Td>
                    <Td>{fmt(a.dlp)}</Td>
                    <Td style={{ color: "#64748b" }}>
                      {fmt(a.ctdivolDrl)} / {fmt(a.dlpDrl)}
                    </Td>
                    <Td>
                      <span style={{ ...levelBadge[a.level], padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                        {a.level === "critical" ? "严重" : "警告"}
                      </span>
                    </Td>
                    <Td>
                      {a.acknowledged ? (
                        <span style={{ color: "#059669", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={13} /> 已确认
                        </span>
                      ) : (
                        <span style={{ color: "#b45309", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <AlertTriangle size={13} /> 待处理
                        </span>
                      )}
                    </Td>
                    <Td align="center">
                      {!a.acknowledged && (
                        <button style={btnPrimary} onClick={() => void handleAck(a.id)}>
                          <CheckCircle2 size={12} /> 确认
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ ...cardTitle, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={14} /> 剂量统计 (GET /rdsr/stats)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
            <input
              type="date"
              style={{ ...input, width: 150 }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span style={{ color: "#94a3b8" }}>至</span>
            <input
              type="date"
              style={{ ...input, width: 150 }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <button style={btnPrimary} onClick={() => void loadStats()} disabled={statsLoading}>
              <BarChart3 size={13} /> {statsLoading ? "统计中..." : "查询"}
            </button>
          </span>
        </div>
        {statsError && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{statsError}</div>}
        {stats ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14 }}>
              <MiniInfo label="总检查数" value={`${stats.totalExams} 次`} />
              <MiniInfo label="平均 CTDIvol" value={`${fmt(stats.avgCtdivol)} mGy`} />
              <MiniInfo label="平均 DLP" value={`${fmt(stats.avgDlp)} mGy·cm`} />
              <MiniInfo label="最大 CTDIvol" value={`${fmt(stats.maxCtdivol)} mGy`} warn={stats.maxCtdivol > 40} />
              <MiniInfo label="最大 DLP" value={`${fmt(stats.maxDlp)} mGy·cm`} warn={stats.maxDlp > 900} />
              <MiniInfo label="告警" value={`${stats.warningCount} 警 / ${stats.criticalCount} 危`} warn={stats.criticalCount > 0} />
            </div>
            {statsTrendData.length > 0 ? (
          <ChartContainer height={200} state={statsTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无统计趋势数据">
            <LineChart data={statsTrendData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconSize={10} />
                  <Line type="monotone" dataKey="avgDlp" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="平均DLP" />
                  <Line type="monotone" dataKey="avgCtdivol" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} name="平均CTDIvol" />
                </LineChart>
              </ChartContainer>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 20 }}>
                {statsLoading ? "统计中..." : "所选范围内暂无检查记录"}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 24 }}>
            {statsLoading ? "统计中..." : "暂无统计数据"}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ ...cardTitle, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={14} /> DRL 阈值配置表
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>修改后点击保存，依据国家标准/自定义</span>
        </div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>模态</Th>
              <Th>检查部位</Th>
              <Th>CTDIvol 阈值 (mGy)</Th>
              <Th>DLP 阈值 (mGy·cm)</Th>
              <Th>来源</Th>
              <Th align="center">操作</Th>
            </tr>
          </thead>
          <tbody>
            {drls.map((d) => {
              const values = editing[d.bodyPart] ?? { ctdivolDrl: String(d.ctdivolDrl), dlpDrl: String(d.dlpDrl) };
              return (
                <tr key={`${d.modality}-${d.bodyPart}`}>
                  <Td>{d.modality}</Td>
                  <Td style={{ fontWeight: 600 }}>{d.bodyPart}</Td>
                  <Td>
                    <input
                      style={{ ...input, width: 90 }}
                      type="number"
                      min={1}
                      value={values.ctdivolDrl}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [d.bodyPart]: { ...values, ctdivolDrl: e.target.value },
                        }))
                      }
                    />
                  </Td>
                  <Td>
                    <input
                      style={{ ...input, width: 100 }}
                      type="number"
                      min={1}
                      value={values.dlpDrl}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [d.bodyPart]: { ...values, dlpDrl: e.target.value },
                        }))
                      }
                    />
                  </Td>
                  <Td style={{ color: "#64748b" }}>{d.source}</Td>
                  <Td align="center">
                    <button style={btnPrimary} disabled={saving === d.bodyPart} onClick={() => void handleSaveDrl(d)}>
                      <Save size={12} /> {saving === d.bodyPart ? "保存中..." : "保存"}
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "8px 10px", border: `1px solid ${warn ? "#fecaca" : "#e2e8f0"}` }}>
      <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: warn ? "#dc2626" : "#1e40af", marginTop: 2 }}>{value}</div>
    </div>
  );
}

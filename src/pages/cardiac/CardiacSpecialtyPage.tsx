// Cardiac Specialty Page — 心脏分析 · 冠脉评估 · 心功能
import { loadCardiacAiAnalyses } from "./cardiacAiAdapter";
import { cardiacSpecialtyApi } from "@/services/api/cardiacSpecialtyApi";
import { CardiacAnalysis } from '@/services/api/cardiacSpecialtyApi'
import { Spin, Alert, Button, Select, Empty } from "antd";
import { DataTable } from "../../components/common";
import {
  Heart,
  Activity,
  AlertTriangle,
  Search,
  TrendingUp,
  Stethoscope,
  Zap,
  BarChart3,
  FileText,
  Gauge,
  RefreshCw,
} from "lucide-react";
import { Inbox } from 'lucide-react'
import { useState, useEffect, useCallback, useMemo } from "react";
import { t } from "../../i18n/appI18n";

const CADRADS_COLORS: Record<string, string> = {
  0: "var(--color-success-600)",
  1: "var(--color-success-600)",
  2: "#ca8a04",
  3: "#ea580c",
  "4A": "var(--color-error-600)",
  "4B": "var(--color-error-600)",
  5: "#7f1d1d",
  N: "#94a3b8",
};
const CORONARY_SEGMENTS = [
  { key: "LM", name: "cardiacSpec.seg.lm" },
  { key: "LAD-p", name: "cardiacSpec.seg.ladP" },
  { key: "LAD-m", name: "cardiacSpec.seg.ladM" },
  { key: "LAD-d", name: "cardiacSpec.seg.ladD" },
  { key: "LCX-p", name: "cardiacSpec.seg.lcxP" },
  { key: "LCX-m", name: "cardiacSpec.seg.lcxM" },
  { key: "LCX-d", name: "cardiacSpec.seg.lcxD" },
  { key: "RCA-p", name: "cardiacSpec.seg.rcaP" },
  { key: "RCA-m", name: "cardiacSpec.seg.rcaM" },
  { key: "RCA-d", name: "cardiacSpec.seg.rcaD" },
];

const CadRadsTag = ({ v }: { v: string | number }) => {
  const color = CADRADS_COLORS[String(v)] ?? "#94a3b8";
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 700,
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      CAD-RADS {v}
    </span>
  );
};

const MODALITY_COLORS: Record<string, string> = {
  CCTA: "var(--color-primary-800)",
  CMR: "#7c3aed",
  Echo: "var(--color-info-600)",
  Cath: "var(--color-warning-600)",
};

const CardiacSpecialtyPage = () => {
  const [search, setSearch] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");
  const [tab, setTab] = useState<
    "coronary" | "function" | "analysis" | "stats"
  >("coronary");
  const [analyses, setAnalyses] = useState<CardiacAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  // [W1-B] 数据源标注: real=cardiacAiApi(/ai-diagnosis/cardiac-ai) / demo=cardiacSpecialtyApi 演示回退
  const [dataSource, setDataSource] = useState<"real" | "demo">("demo");
  const tabs = [
    { key: "coronary" as const, label: "cardiacSpec.tab.coronary" },
    { key: "function" as const, label: "cardiacSpec.tab.function" },
    { key: "analysis" as const, label: "cardiacSpec.tab.analysis" },
    { key: "stats" as const, label: "cardiacSpec.tab.stats" },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // [W1-B] 优先真实 cardiacAiApi, 空/失败回退演示 cardiacSpecialtyApi
      const real = await loadCardiacAiAnalyses();
      let list: CardiacAnalysis[] = [];
      if (real) {
        list = real;
        setDataSource("real");
      } else {
        const res = await cardiacSpecialtyApi.getAnalyses();
        if (res.success) {
          list = Array.isArray(res.data) ? res.data : [];
          setDataSource("demo");
        } else {
          setError(res.error?.message ?? t('cardiacSpec.loadFailed'));
          setDataSource("demo");
        }
      }
      setAnalyses(list);
      if (list.length > 0 && !list.some((a) => a.id === selectedId)) {
        setSelectedId(list[0]!.id);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('cardiacSpec.loadFailed'));
      setAnalyses([]);
      setDataSource("demo");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = analyses;
    if (search)
      list = list.filter(
        (r) => r.patientName.includes(search) || r.id.includes(search),
      );
    if (modalityFilter)
      list = list.filter((r) => r.modality === modalityFilter);
    return list;
  }, [analyses, search, modalityFilter]);

  // [v3.0.6.11-98 Wave3B P1] 导出: 当前病例列表 → 真实 CSV (BOM 支持 Excel 中文)
  const handleExport = () => {
    const header = ['病例ID', '患者', '患者ID', '设备', '检查日期', 'CAD-RADS', 'EF(%)', '高狭窄节段', '关键发现']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = filtered.map((a) => [
      a.id,
      a.patientName,
      a.patientId,
      a.modality,
      a.studyDate ?? '',
      a.cadRads ?? 'N',
      a.lvFunction?.efPercent != null ? String(a.lvFunction.efPercent) : '',
      (a.coronarySegments ?? []).filter((s) => s.stenosisPercent >= 70).length,
      (a.coronarySegments ?? []).filter((s) => s.stenosisPercent > 0).map((s) => `${s.segment} ${s.stenosisPercent}%`).join('; '),
    ])
    const csv = '\ufeff' + [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `心脏专科病例_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const highStenosis = analyses.filter((a) =>
    (a.coronarySegments ?? []).some((s) => s.stenosisPercent >= 70),
  ).length;
  const avgEf =
    analyses.filter((a) => a.lvFunction?.efPercent != null).length > 0
      ? Math.round(
          analyses
            .filter((a) => a.lvFunction?.efPercent != null)
            .reduce((s, a) => s + (a.lvFunction?.efPercent ?? 0), 0) /
            analyses.filter((a) => a.lvFunction?.efPercent != null).length,
        )
      : 0;
  const avgCalcium =
    analyses.filter((a) => a.calciumScore?.totalAgatston != null).length > 0
      ? Math.round(
          analyses
            .filter((a) => a.calciumScore?.totalAgatston != null)
            .reduce((s, a) => s + (a.calciumScore?.totalAgatston ?? 0), 0) /
            analyses.filter((a) => a.calciumScore?.totalAgatston != null)
              .length,
        )
      : 0;

  const selected = analyses.find((a) => a.id === selectedId) ?? analyses[0];

  const cadRadsDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    analyses.forEach((a) => {
      const key = String(a.cadRads ?? "N");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => {
      const order = ["0", "1", "2", "3", "4A", "4B", "5", "N"];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });
  }, [analyses]);

  const efTrend = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    analyses.forEach((a) => {
      if (a.lvFunction?.efPercent == null) return;
      const month = (a.studyDate ?? "").slice(0, 7);
      if (!month) return;
      const list = byMonth.get(month) ?? [];
      list.push(a.lvFunction.efPercent);
      byMonth.set(month, list);
    });
    return Array.from(byMonth.entries())
      .map(([month, list]) => ({
        month,
        avgEf:
          Math.round((list.reduce((s, v) => s + v, 0) / list.length) * 10) / 10,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [analyses]);

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--color-primary-800)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Heart size={24} color="var(--color-primary-800)" /> {t('cardiacSpec.title')} <span style={{           fontSize: 11,
          padding: '2px 8px', borderRadius: 10, background: dataSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
          color: dataSource === 'real' ? 'var(--color-success-600)' : 'var(--color-primary-800)', border: `1px solid ${dataSource === 'real' ? 'var(--color-success-border)' : 'var(--color-pending-border)'}`  }}>{dataSource === 'real' ? t('cardiacSpec.dataRealtime') : t('cardiacSpec.dataDemo')}</span>
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t('cardiacSpec.subtitle')}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small"
            icon={<RefreshCw size={14} />}
            loading={loading}
            onClick={() => void load()}
          >
            {t('cardiacSpec.refresh')}
          </Button>
          <button
            onClick={handleExport}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            <FileText size={14} /> {t('cardiacSpec.export')}
          </button>
        </div>
      </div>

      <Spin spinning={loading}>
        {error && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            title={error}
            action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
                {t('cardiacSpec.retry')}
              </Button>
            }
          />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            {
              label: "cardiacSpec.kpi.total",
              value: String(analyses.length),
              icon: Activity,
              color: "var(--color-primary-800)",
              bg: "var(--color-info-bg)",
            },
            {
              label: "cardiacSpec.kpi.severeStenosis",
              value: String(highStenosis),
              icon: AlertTriangle,
              color: "var(--color-error-600)",
              bg: "var(--color-error-bg)",
            },
            {
              label: "cardiacSpec.kpi.avgEf",
              value: `${avgEf}%`,
              icon: Gauge,
              color: "var(--color-success-600)",
              bg: "var(--color-success-bg)",
            },
            {
              label: "cardiacSpec.kpi.avgCalcium",
              value: String(avgCalcium),
              icon: BarChart3,
              color: "#ea580c",
              bg: "var(--color-warning-bg)",
            },
            {
              label: "cardiacSpec.kpi.pendingReport",
              value: String(
                analyses.filter(
                  (a) =>
                    a.status === "scheduled" ||
                    a.status === "acquired" ||
                    a.status === "analyzing",
                ).length,
              ),
              icon: FileText,
              color: "#7c3aed",
              bg: "var(--color-info-bg)",
            },
          ].map((k, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                padding: "18px 14px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                  background: k.bg,
                }}
              >
                <k.icon size={20} color={k.color} />
              </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-primary-800)" }}>
                {k.value}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {t(k.label)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                background: tab === tb.key ? "var(--color-primary-800)" : "var(--content-bg)",
                color: tab === tb.key ? "#fff" : "#64748b",
              }}
            >
              {t(tb.label)}
            </button>
          ))}
        </div>

        {tab === "coronary" && (
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Activity size={16} color="var(--color-primary-800)" /> {t('cardiacSpec.coronaryList')}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "var(--content-bg)",
                    borderRadius: 8,
                    padding: "4px 12px",
                  }}
                >
                  <Search size={16} color="#64748b" />
                  <input
                    placeholder={t('cardiacSpec.searchPatient')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      border: "none",
                      background: "transparent", marginLeft: 8,
                      fontSize: 12,
                      width: 160,
                    }}
                  />
                </div>
                <select
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                >
                  <option value="">{t('cardiacSpec.allModalities')}</option>
                  <option value="CCTA">CCTA</option>
                  <option value="CMR">CMR</option>
                  <option value="Echo">{t('cardiacSpec.modality.echo')}</option>
                  <option value="Cath">{t('cardiacSpec.modality.cath')}</option>
                </select>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <DataTable
                rowKey="id"
                dataSource={filtered}
                showPagination={false}
                showExport={false}
                showDensity={false}
                emptyText={<Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('cardiacSpec.noData')} />}
                columns={[
                  {
                    title: t('cardiacSpec.colId'),
                    dataIndex: 'id',
                    key: 'id',
                    render: (v: string) => <span style={{ padding: "10px 8px", display: "inline-block" }}>{v}</span>,
                  },
                  {
                    title: t('cardiacSpec.colPatient'),
                    key: 'patient',
                    render: (_: unknown, a: CardiacAnalysis) => (
                      <div style={{ fontWeight: 600 }}>
                        {a.patientName}
                        <br />
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{a.patientId}</span>
                      </div>
                    ),
                  },
                  {
                    title: t('cardiacSpec.colModality'),
                    dataIndex: 'modality',
                    key: 'modality',
                    render: (v: string) => (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          background: MODALITY_COLORS[v] ?? "#64748b",
                          color: "#fff",
                        }}
                      >
                        {v}
                      </span>
                    ),
                  },
                  {
                    title: 'CAD-RADS',
                    dataIndex: 'cadRads',
                    key: 'cadRads',
                    render: (v: string | number | undefined) => <CadRadsTag v={v ?? "N"} />,
                  },
                  {
                    title: 'EF%',
                    key: 'ef',
                    render: (_: unknown, a: CardiacAnalysis) => {
                      const ef = a.lvFunction?.efPercent;
                      return (
                        <span
                          style={{
                            color:
                              ef == null
                                ? "#94a3b8"
                                : ef < 40
                                  ? "var(--color-error-600)"
                                  : ef < 50
                                    ? "#ea580c"
                                    : "var(--color-success-600)",
                            fontWeight: 700,
                          }}
                        >
                          {ef != null ? `${ef}%` : "-"}
                        </span>
                      );
                    },
                  },
                  {
                    title: t('cardiacSpec.colCalcium'),
                    key: 'calcium',
                    render: (_: unknown, a: CardiacAnalysis) => {
                      const calcium = a.calciumScore?.totalAgatston;
                      return (
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              calcium == null
                                ? "#94a3b8"
                                : calcium > 400
                                  ? "var(--color-error-600)"
                                  : calcium > 100
                                    ? "#ea580c"
                                    : "#64748b",
                          }}
                        >
                          {calcium != null ? calcium : "-"}
                        </span>
                      );
                    },
                  },
                  {
                    title: t('cardiacSpec.colMaxStenosis'),
                    key: 'maxStenosis',
                    render: (_: unknown, a: CardiacAnalysis) => {
                      const maxStenosis = (a.coronarySegments ?? []).reduce(
                        (m, s) => Math.max(m, s.stenosisPercent),
                        0,
                      );
                      return (
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background:
                              maxStenosis >= 70
                                ? "var(--color-error-bg)"
                                : maxStenosis >= 50
                                  ? "var(--color-warning-bg)"
                                  : "var(--color-success-bg)",
                            color:
                              maxStenosis >= 70
                                ? "var(--color-error-600)"
                                : maxStenosis >= 50
                                  ? "#ea580c"
                                  : "var(--color-success-600)",
                          }}
                        >
                          {maxStenosis >= 70
                            ? `${maxStenosis}% 重度`
                            : maxStenosis >= 50
                              ? `${maxStenosis}% 中度`
                              : `${maxStenosis}%`}
                        </span>
                      );
                    },
                  },
                  {
                    title: t('cardiacSpec.colDate'),
                    dataIndex: 'studyDate',
                    key: 'studyDate',
                    render: (v: string) => <span style={{ color: "#64748b" }}>{v}</span>,
                  },
                ]}
              />
            </div>
          </div>
        )}

        {tab === "function" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                  marginBottom: 16,
                }}
              >
                <Gauge size={16} color="var(--color-primary-800)" /> {t('cardiacSpec.functionOverview')}
              </div>
              {analyses
                .filter((a) => a.lvFunction)
                .slice(0, 4)
                .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border-light)",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
            background: "var(--color-info-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
                        fontSize: 12,
                        color: "var(--color-primary-800)",
                      }}
                    >
                      {a.patientName[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {a.patientName}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {a.id} · {a.modality}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color:
                            (a.lvFunction?.efPercent ?? 100) < 40
                              ? "var(--color-error-600)"
                              : (a.lvFunction?.efPercent ?? 100) < 50
                                ? "#ea580c"
                                : "var(--color-success-600)",
                        }}
                      >
                        {a.lvFunction?.efPercent}%
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>LVEF</div>
                    </div>
                  </div>
                ))}
              {analyses.filter((a) => a.lvFunction).length === 0 && (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('cardiacSpec.noFunctionData')} />
              )}
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                  marginBottom: 16,
                }}
              >
                <Zap size={16} color="#ca8a04" /> {t('cardiacSpec.functionParams')}
              </div>
              {analyses
                .filter((a) => a.lvFunction)
                .slice(0, 4)
                .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border-light)",
                    }}
                  >
                    <div
                      style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}
                    >
                      {a.patientName} ({a.modality})
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 6,
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      <span>EDV {a.lvFunction?.edvMl ?? "-"} ml</span>
                      <span>ESV {a.lvFunction?.esvMl ?? "-"} ml</span>
                      <span>SV {a.lvFunction?.strokeVolumeMl ?? "-"} ml</span>
                    </div>
                  </div>
                ))}
              {analyses.filter((a) => a.lvFunction).length === 0 && (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('cardiacSpec.noFunctionParams')} />
              )}
            </div>
          </div>
        )}

        {tab === "analysis" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  <Stethoscope size={16} color="var(--color-primary-800)" /> {t('cardiacSpec.coronarySegments')}
                </span>
                <Select
                  size="small"
                  value={selected?.id}
                  onChange={setSelectedId}
                  style={{ width: 180 }}
                  options={analyses.map((a) => ({
                    value: a.id,
                    label: a.patientName,
                  }))}
                />
              </div>
              {selected?.coronarySegments?.length ? (
                CORONARY_SEGMENTS.map((seg) => {
                  const found = selected.coronarySegments.find(
                    (s) => s.segment === seg.key,
                  );
                  const stenosis = found?.stenosisPercent ?? 0;
                  const severity =
                    stenosis >= 70
                      ? "var(--color-error-600)"
                      : stenosis >= 50
                        ? "#ea580c"
                        : stenosis >= 25
                          ? "#ca8a04"
                          : "var(--color-success-600)";
                  return (
                    <div
                      key={seg.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <span
                        style={{ width: 140, fontSize: 12, fontWeight: 500 }}
                      >
                        {t(seg.name)}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          background: "var(--content-bg)",
                          borderRadius: 3,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${stenosis}%`,
                            background: severity,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: severity,
                          width: 50,
                          textAlign: "right",
                        }}
                      >
                        {stenosis > 0 ? `${stenosis}%` : "-"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('cardiacSpec.noSegmentData')} />
              )}
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                  marginBottom: 16,
                }}
              >
                <Heart size={16} color="var(--color-error-600)" /> {t('cardiacSpec.calciumDistribution')}
              </div>
              {selected?.calciumScore ? (
                <>
                  {[
                    { label: "cardiacSpec.seg.lm", score: selected.calciumScore.lm },
                    { label: "LAD", score: selected.calciumScore.lad },
                    { label: "LCX", score: selected.calciumScore.lcx },
                    { label: "RCA", score: selected.calciumScore.rca },
                  ].map((c) => {
                    const total = selected?.calciumScore?.totalAgatston || 1;
                    const pct = Math.round((c.score / total) * 100);
                    return (
                      <div key={c.label} style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <span>{t(c.label)}</span>
                          <span style={{ fontWeight: 700 }}>
                            {c.score} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            background: "var(--content-bg)",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: "#ea580c",
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      background: "var(--color-warning-bg)",
                      borderRadius: 8,
                      border: "1px solid var(--color-warning-border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#ea580c",
                        marginBottom: 4,
                      }}
                    >
                      {t('cardiacSpec.agatstonTotal', { score: selected.calciumScore.totalAgatston })}
                    </div>
                    <div style={{ fontSize: 12, color: "#9a3412" }}>
                      {t('cardiacSpec.percentile', { value: selected.calciumScore.percentile })}
                    </div>
                  </div>
                </>
              ) : (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('cardiacSpec.noCalciumData')} />
              )}
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                  marginBottom: 16,
                }}
              >
                <BarChart3 size={16} color="var(--color-primary-800)" /> {t('cardiacSpec.cadRadsDistribution')}
              </div>
              {cadRadsDistribution.length === 0 ? (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('cardiacSpec.noData')} />
              ) : (
                cadRadsDistribution.map(([c, count]) => {
                  const color = CADRADS_COLORS[c] ?? "#94a3b8";
                  const max = Math.max(
                    ...cadRadsDistribution.map(([, v]) => v),
                    1,
                  );
                  return (
                    <div
                      key={c}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 90,
                          fontSize: 12,
                          fontWeight: 600,
                          color,
                        }}
                      >
                        CAD-RADS {c}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "var(--content-bg)",
                          borderRadius: 4,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(count / max) * 100}%`,
                            background: color,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          width: 30,
                          textAlign: "right",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                  marginBottom: 16,
                }}
              >
                <TrendingUp size={16} color="var(--color-success-600)" /> {t('cardiacSpec.efTrend')}
              </div>
              {efTrend.length === 0 ? (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('cardiacSpec.noData')} />
              ) : (
                efTrend.map((tr) => (
                  <div
                    key={tr.month}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ width: 80, fontSize: 12, color: "#64748b" }}>
                      {tr.month}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "var(--content-bg)",
                        borderRadius: 3,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(tr.avgEf, 100)}%`,
                          background: "var(--color-success-600)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>
                      {tr.avgEf}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Spin>
    </div>
  );
};

export default CardiacSpecialtyPage;

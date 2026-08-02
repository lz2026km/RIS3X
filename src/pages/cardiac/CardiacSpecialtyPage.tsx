// Cardiac Specialty Page — 心脏分析 · 冠脉评估 · 心功能
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Spin, Alert, Button, Select, Empty } from "antd";
import { cardiacSpecialtyApi } from "@/services/api/cardiacSpecialtyApi";
import type { CardiacAnalysis } from "@/services/api/cardiacSpecialtyApi";

const CADRADS_COLORS: Record<string, string> = {
  0: "#16a34a",
  1: "#16a34a",
  2: "#ca8a04",
  3: "#ea580c",
  "4A": "#dc2626",
  "4B": "#dc2626",
  5: "#7f1d1d",
  N: "#94a3b8",
};
const CORONARY_SEGMENTS = [
  { key: "LM", name: "左主干 (LM)" },
  { key: "LAD-p", name: "LAD 近段" },
  { key: "LAD-m", name: "LAD 中段" },
  { key: "LAD-d", name: "LAD 远段" },
  { key: "LCX-p", name: "LCX 近段" },
  { key: "LCX-m", name: "LCX 中段" },
  { key: "LCX-d", name: "LCX 远段" },
  { key: "RCA-p", name: "RCA 近段" },
  { key: "RCA-m", name: "RCA 中段" },
  { key: "RCA-d", name: "RCA 远段" },
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
  CCTA: "#1e40af",
  CMR: "#7c3aed",
  Echo: "#0891b2",
  Cath: "#d97706",
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
  const tabs = [
    { key: "coronary" as const, label: "冠脉评估" },
    { key: "function" as const, label: "心功能分析" },
    { key: "analysis" as const, label: "心脏分析" },
    { key: "stats" as const, label: "统计分析" },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await cardiacSpecialtyApi.getAnalyses();
      if (res.success) {
        const list = Array.isArray(res.data) ? res.data : [];
        setAnalyses(list);
        if (list.length > 0 && !list.some((a) => a.id === selectedId)) {
          setSelectedId(list[0].id);
        }
      } else {
        setError(res.error?.message ?? "加载失败");
        setAnalyses([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
      setAnalyses([]);
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
              color: "#1a3a5c",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Heart size={24} color="#1e40af" /> 心脏专科
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Cardiac Imaging Specialty · 冠脉评估 · 心功能分析 · 血流动力学
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small"
            icon={<RefreshCw size={14} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
          <button
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <FileText size={14} /> 导出
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
            action={
              <Button size="small" onClick={() => void load()}>
                重试
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
              label: "分析总数",
              value: String(analyses.length),
              icon: Activity,
              color: "#1e40af",
              bg: "#eff6ff",
            },
            {
              label: "重度狭窄",
              value: String(highStenosis),
              icon: AlertTriangle,
              color: "#dc2626",
              bg: "#fef2f2",
            },
            {
              label: "平均 EF",
              value: `${avgEf}%`,
              icon: Gauge,
              color: "#16a34a",
              bg: "#f0fdf4",
            },
            {
              label: "平均钙化积分",
              value: String(avgCalcium),
              icon: BarChart3,
              color: "#ea580c",
              bg: "#fff7ed",
            },
            {
              label: "待报告",
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
              bg: "#f5f3ff",
            },
          ].map((k, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
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
              <div style={{ fontSize: 26, fontWeight: 800, color: "#1a3a5c" }}>
                {k.value}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: tab === t.key ? "#1e40af" : "#f1f5f9",
                color: tab === t.key ? "#fff" : "#64748b",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "coronary" && (
          <div
            style={{
              background: "#fff",
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
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a3a5c",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Activity size={16} color="#1e40af" /> 冠脉评估列表
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "#f1f5f9",
                    borderRadius: 8,
                    padding: "4px 12px",
                  }}
                >
                  <Search size={16} color="#64748b" />
                  <input
                    placeholder="搜索患者..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      marginLeft: 8,
                      fontSize: 13,
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
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                  }}
                >
                  <option value="">全部模态</option>
                  <option value="CCTA">CCTA</option>
                  <option value="CMR">CMR</option>
                  <option value="Echo">Echo</option>
                  <option value="Cath">Cath</option>
                </select>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <Empty description="暂无数据" />
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        编号
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        患者
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        模态
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        CAD-RADS
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        EF%
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        钙化积分
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        最大狭窄
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid #f1f5f9",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        日期
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const maxStenosis = (a.coronarySegments ?? []).reduce(
                        (m, s) => Math.max(m, s.stenosisPercent),
                        0,
                      );
                      const ef = a.lvFunction?.efPercent;
                      const calcium = a.calciumScore?.totalAgatston;
                      return (
                        <tr key={a.id}>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                            }}
                          >
                            {a.id}
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                              fontWeight: 600,
                            }}
                          >
                            {a.patientName}
                            <br />
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                              {a.patientId}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                            }}
                          >
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                background:
                                  MODALITY_COLORS[a.modality] ?? "#64748b",
                                color: "#fff",
                              }}
                            >
                              {a.modality}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                            }}
                          >
                            <CadRadsTag v={a.cadRads ?? "N"} />
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                              color:
                                ef == null
                                  ? "#94a3b8"
                                  : ef < 40
                                    ? "#dc2626"
                                    : ef < 50
                                      ? "#ea580c"
                                      : "#16a34a",
                              fontWeight: 700,
                            }}
                          >
                            {ef != null ? `${ef}%` : "-"}
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                              fontWeight: 600,
                              color:
                                calcium == null
                                  ? "#94a3b8"
                                  : calcium > 400
                                    ? "#dc2626"
                                    : calcium > 100
                                      ? "#ea580c"
                                      : "#64748b",
                            }}
                          >
                            {calcium != null ? calcium : "-"}
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                            }}
                          >
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                background:
                                  maxStenosis >= 70
                                    ? "#fef2f2"
                                    : maxStenosis >= 50
                                      ? "#fff7ed"
                                      : "#f0fdf4",
                                color:
                                  maxStenosis >= 70
                                    ? "#dc2626"
                                    : maxStenosis >= 50
                                      ? "#ea580c"
                                      : "#16a34a",
                              }}
                            >
                              {maxStenosis >= 70
                                ? `${maxStenosis}% 重度`
                                : maxStenosis >= 50
                                  ? `${maxStenosis}% 中度`
                                  : `${maxStenosis}%`}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 8px",
                              borderBottom: "1px solid #f8fafc",
                              color: "#64748b",
                            }}
                          >
                            {a.studyDate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "function" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a3a5c",
                  marginBottom: 16,
                }}
              >
                <Gauge size={16} color="#1e40af" /> 心功能概览
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
                      borderBottom: "1px solid #f8fafc",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "#eff6ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#1e40af",
                      }}
                    >
                      {a.patientName[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
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
                              ? "#dc2626"
                              : (a.lvFunction?.efPercent ?? 100) < 50
                                ? "#ea580c"
                                : "#16a34a",
                        }}
                      >
                        {a.lvFunction?.efPercent}%
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>LVEF</div>
                    </div>
                  </div>
                ))}
              {analyses.filter((a) => a.lvFunction).length === 0 && (
                <Empty description="暂无心功能数据" />
              )}
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a3a5c",
                  marginBottom: 16,
                }}
              >
                <Zap size={16} color="#ca8a04" /> 心功能参数
              </div>
              {analyses
                .filter((a) => a.lvFunction)
                .slice(0, 4)
                .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid #f8fafc",
                    }}
                  >
                    <div
                      style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}
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
                <Empty description="暂无心功能参数" />
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
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a3a5c",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  <Stethoscope size={16} color="#1e40af" /> 冠脉分段
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
                      ? "#dc2626"
                      : stenosis >= 50
                        ? "#ea580c"
                        : stenosis >= 25
                          ? "#ca8a04"
                          : "#16a34a";
                  return (
                    <div
                      key={seg.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 0",
                        borderBottom: "1px solid #f8fafc",
                      }}
                    >
                      <span
                        style={{ width: 140, fontSize: 13, fontWeight: 500 }}
                      >
                        {seg.name}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          background: "#f1f5f9",
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
                <Empty description="该分析暂无冠脉分段数据" />
              )}
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a3a5c",
                  marginBottom: 16,
                }}
              >
                <Heart size={16} color="#dc2626" /> 钙化积分分布
              </div>
              {selected?.calciumScore ? (
                <>
                  {[
                    { label: "左主干 (LM)", score: selected.calciumScore.lm },
                    { label: "LAD", score: selected.calciumScore.lad },
                    { label: "LCX", score: selected.calciumScore.lcx },
                    { label: "RCA", score: selected.calciumScore.rca },
                  ].map((c) => {
                    const total = selected.calciumScore.totalAgatston || 1;
                    const pct = Math.round((c.score / total) * 100);
                    return (
                      <div key={c.label} style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                            marginBottom: 4,
                          }}
                        >
                          <span>{c.label}</span>
                          <span style={{ fontWeight: 700 }}>
                            {c.score} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            background: "#f1f5f9",
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
                      background: "#fff7ed",
                      borderRadius: 8,
                      border: "1px solid #fed7aa",
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
                      Agatston 总分: {selected.calciumScore.totalAgatston}
                    </div>
                    <div style={{ fontSize: 12, color: "#9a3412" }}>
                      百分位: {selected.calciumScore.percentile}th
                    </div>
                  </div>
                </>
              ) : (
                <Empty description="该分析暂无钙化积分数据" />
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
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a3a5c",
                  marginBottom: 16,
                }}
              >
                <BarChart3 size={16} color="#1e40af" /> CAD-RADS 分布
              </div>
              {cadRadsDistribution.length === 0 ? (
                <Empty description="暂无数据" />
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
                          background: "#f1f5f9",
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
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1a3a5c",
                  marginBottom: 16,
                }}
              >
                <TrendingUp size={16} color="#16a34a" /> EF 趋势
              </div>
              {efTrend.length === 0 ? (
                <Empty description="暂无数据" />
              ) : (
                efTrend.map((t) => (
                  <div
                    key={t.month}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ width: 80, fontSize: 12, color: "#64748b" }}>
                      {t.month}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "#f1f5f9",
                        borderRadius: 3,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(t.avgEf, 100)}%`,
                          background: "#16a34a",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, width: 40 }}>
                      {t.avgEf}%
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

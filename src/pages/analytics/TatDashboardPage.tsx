import { olapApi } from "../../services/api";
import {
  Card,
  Row,
  Col,
  Select,
  Tag,
  Spin,
  Progress,
  Space,
  Button,
  Alert,
  Empty,
  message,
  Input,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Download,
  Activity,
  RefreshCw,
  Layers,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Inbox } from 'lucide-react'
import { t } from "../../i18n/appI18n";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const { Title } = Typography

interface ModalityTatRow {
  modality: string;
  examCount: number;
  reportCount: number;
  avgTatMinutes: number;
  timelyRate: number;
}

interface DoctorTatRow {
  doctor: string;
  count: number;
  avgTatMinutes: number;
  timelyRate: number;
}

const MODALITIES = ["CT", "MR", "DR", "DSA", "MG"];

type TatLevel = "excellent" | "normal" | "warning" | "critical";

const TAT_LEVEL_CONFIG: Record<
  TatLevel,
  { color: string; bg: string; label: string }
> = {
  excellent: { color: "#059669", bg: "#d1fae5", label: "优秀 (≤15min)" },
  normal: { color: "var(--color-primary-600)", bg: "#dbeafe", label: "正常 (15-30min)" },
  warning: { color: "var(--color-warning-600)", bg: "#fef3c7", label: "预警 (30-60min)" },
  critical: { color: "var(--color-error-600)", bg: "#fee2e2", label: "超时 (>60min)" },
};

function tatLevel(minutes: number): TatLevel {
  return minutes <= 15
    ? "excellent"
    : minutes <= 30
      ? "normal"
      : minutes <= 60
        ? "warning"
        : "critical";
}

export default function TatDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalityRows, setModalityRows] = useState<ModalityTatRow[]>([]);
  const [doctorRows, setDoctorRows] = useState<DoctorTatRow[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [selectedModality, setSelectedModality] = useState<string>("");
  // [Wave1B P2] 多维分析: olapApi.listCubes / drillDown / getChartData
  const [cubes, setCubes] = useState<{ id: string; name: string; dimensions: string[]; measures: string[] }[]>([]);
  const [selectedCube, setSelectedCube] = useState<string>("");
  const [drillDimension, setDrillDimension] = useState<string>("modality");
  const [drillValue, setDrillValue] = useState<string>("");
  const [drillMeasures, setDrillMeasures] = useState<string[]>(["exam_count"]);
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([]);
  const [drillColumns, setDrillColumns] = useState<Array<{ code: string; name: string }>>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState("");

  const loadCubes = useCallback(async () => {
    try {
      const res = await olapApi.listCubes();
      if (res.success && Array.isArray(res.data)) {
        setCubes(res.data);
        if (res.data.length > 0) setSelectedCube((prev) => prev || (res.data[0]?.id ?? ""));
      }
    } catch { /* 立方体不可用不阻断 */ }
  }, []);

  useEffect(() => {
    void loadCubes();
  }, [loadCubes]);

  const handleDrillDown = async () => {
    if (!selectedCube) {
      message.warning(t('tatDashboard.selectCube'));
      return;
    }
    if (!drillValue.trim()) {
      message.warning(t('tatDashboard.enterDrillValue'));
      return;
    }
    setDrillLoading(true);
    setDrillError("");
    try {
      const res = await olapApi.drillDown({
        cube: selectedCube,
        dimension: drillDimension,
        value: drillValue.trim(),
        measures: drillMeasures,
      });
      if (res.success && res.data && Array.isArray(res.data.rows)) {
        setDrillRows(res.data.rows);
        setDrillColumns(Array.isArray(res.data.columns) ? res.data.columns : []);
      } else {
        setDrillError(res.error?.message ?? t('tatDashboard.drillFailed'));
        setDrillRows([]);
        setDrillColumns([]);
      }
    } catch (e) {
      setDrillError((e as Error)?.message ?? t('tatDashboard.drillFailed'));
      setDrillRows([]);
      setDrillColumns([]);
    } finally {
      setDrillLoading(false);
    }
  };

  const selectedCubeMeta = cubes.find((c) => c.id === selectedCube);
  const chartMeasure = drillMeasures[0] ?? drillColumns[0]?.code ?? "exam_count";
  const drillChartMax = Math.max(...drillRows.map((r) => Number(r[chartMeasure]) || 0), 1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [aggRes, docRes] = await Promise.all([
        olapApi.query({
          dimensions: ["modality"],
          measures: [
            "exam_count",
            "report_count",
            "avg_report_time",
            "report_timely_rate",
          ],
        }),
        olapApi.query({
          dimensions: ["doctor"],
          measures: ["exam_count", "avg_report_time", "report_timely_rate"],
          limit: 50,
        }),
      ]);
      if (
        aggRes.success &&
        Array.isArray((aggRes.data as { rows?: unknown })?.rows)
      ) {
        const rows = (aggRes.data as { rows: Array<Record<string, unknown>> })
          .rows;
        setModalityRows(
          rows
            .filter((r) => r.modality)
            .map((r) => ({
              modality: String(r.modality),
              examCount: Number(r.exam_count) || 0,
              reportCount: Number(r.report_count) || 0,
              avgTatMinutes: Number(r.avg_report_time) || 0,
              timelyRate: Number(r.report_timely_rate) || 0,
            }))
            .sort((a, b) => b.examCount - a.examCount),
        );
      } else {
        setError(aggRes.error?.message ?? t('tatDashboard.summaryLoadFailed'));
      }
      if (
        docRes.success &&
        Array.isArray((docRes.data as { rows?: unknown })?.rows)
      ) {
        const rows = (docRes.data as { rows: Array<Record<string, unknown>> })
          .rows;
        setDoctorRows(
          rows
            .filter((r) => r.doctor)
            .map((r) => ({
              doctor: String(r.doctor),
              count: Number(r.exam_count) || 0,
              avgTatMinutes: Number(r.avg_report_time) || 0,
              timelyRate: Number(r.report_timely_rate) || 0,
            }))
            .sort((a, b) => a.avgTatMinutes - b.avgTatMinutes),
        );
      } else {
        setError(
          (prev) => prev || (docRes.error?.message ?? t('tatDashboard.doctorLoadFailed')),
        );
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('tatDashboard.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredModalityRows = useMemo(() => {
    return modalityRows.filter(
      (r) => !selectedModality || r.modality === selectedModality,
    );
  }, [modalityRows, selectedModality]);

  const filteredDoctorRows = useMemo(() => {
    return doctorRows.filter(
      (r) => !selectedDoctor || r.doctor === selectedDoctor,
    );
  }, [doctorRows, selectedDoctor]);

  const stats = useMemo(() => {
    const total = filteredModalityRows.reduce((s, r) => s + r.examCount, 0);
    const reported = filteredModalityRows.reduce(
      (s, r) => s + r.reportCount,
      0,
    );
    const weightedTat =
      total > 0
        ? Math.round(
            filteredModalityRows.reduce(
              (s, r) => s + r.avgTatMinutes * r.examCount,
              0,
            ) / total,
          )
        : 0;
    const weightedTimely =
      total > 0
        ? Math.round(
            filteredModalityRows.reduce(
              (s, r) => s + r.timelyRate * r.examCount,
              0,
            ) / total,
          )
        : 0;
    const completionRate = total > 0 ? Math.round((reported / total) * 100) : 0;
    return {
      total,
      reported,
      avgTat: weightedTat,
      onTimeRate: weightedTimely,
      completionRate,
      excellent: filteredModalityRows.filter(
        (r) => r.avgTatMinutes > 0 && r.avgTatMinutes <= 15,
      ).length,
      normal: filteredModalityRows.filter(
        (r) => r.avgTatMinutes > 15 && r.avgTatMinutes <= 30,
      ).length,
      warning: filteredModalityRows.filter(
        (r) => r.avgTatMinutes > 30 && r.avgTatMinutes <= 60,
      ).length,
      critical: filteredModalityRows.filter((r) => r.avgTatMinutes > 60).length,
    };
  }, [filteredModalityRows]);

  const maxCount = Math.max(...modalityRows.map((d) => d.examCount), 1);

  // 导出当前筛选表格数据: 优先 POST /olap/export/csv (后端真实生成), 失败回退本地 CSV blob
  const handleExport = async () => {
    const buildLocal = () => {
      const esc = (v: unknown) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines: string[] = ["设备,检查数,报告数,平均TAT(min),按时完成率(%)"];
      for (const r of filteredModalityRows) {
        lines.push([r.modality, r.examCount, r.reportCount, r.avgTatMinutes, r.timelyRate].map(esc).join(","));
      }
      lines.push("");
      lines.push("医生,检查数,平均TAT(min),按时完成率(%)");
      for (const r of filteredDoctorRows) {
        lines.push([r.doctor, r.count, r.avgTatMinutes, r.timelyRate].map(esc).join(","));
      }
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TAT报表_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${filteredModalityRows.length} 设备 + ${filteredDoctorRows.length} 医生 TAT 数据`);
    };
    try {
      const res = await olapApi.exportCsv({
        dimensions: ["modality", "doctor"],
        measures: ["exam_count", "report_count", "avg_report_time", "report_timely_rate"],
        limit: 500,
      });
      if (res.success && res.data && (res.data as Blob).size > 0) {
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TAT报表_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        message.success(`已通过 /olap/export/csv 导出 (${(blob.size / 1024).toFixed(1)} KB)`);
        return;
      }
      buildLocal();
    } catch {
      buildLocal();
    }
  };

  const columns: ColumnsType<ModalityTatRow> = [
    {
      title: t('tatDashboard.colModality'),
      dataIndex: "modality",
      key: "modality",
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('tatDashboard.colExamCount'),
      dataIndex: "examCount",
      key: "examCount",
      sorter: (a, b) => a.examCount - b.examCount,
    },
    { title: t('tatDashboard.colReportCount'), dataIndex: "reportCount", key: "reportCount" },
    {
      title: t('tatDashboard.colAvgTat'),
      dataIndex: "avgTatMinutes",
      key: "avgTatMinutes",
      width: 100,
      sorter: (a, b) => a.avgTatMinutes - b.avgTatMinutes,
      render: (v: number) => {
        const cfg = TAT_LEVEL_CONFIG[tatLevel(v)];
        return (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: cfg.bg,
              color: cfg.color,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {v > 0 ? `${v}min` : "-"}
          </span>
        );
      },
    },
    {
      title: t('tatDashboard.colTimelyRate'),
      dataIndex: "timelyRate",
      key: "timelyRate",
      width: 130,
      render: (v: number) =>
        v > 0 ? (
          <Progress
            percent={v}
            size="small"
            strokeColor={v >= 80 ? "#059669" : v >= 60 ? "var(--color-warning-600)" : "var(--color-error-600)"}
          />
        ) : (
          "-"
        ),
    },
  ];

  return (
    <PageContainer
      maxWidth="fluid"
      padding={0}
      style={{ paddingBottom: 'var(--space-6, 24px)' }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: 'var(--space-5, 20px)',
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <Title
              level={4}
              style={{
                margin: "0 0 6px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Clock size={24} />
              {t('tatDashboard.title')}
            </Title>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              Turnaround Time Analytics Dashboard · OLAP 实时统计
            </p>
          </div>
          <Space>
            <Select
              value={selectedDoctor || undefined}
              onChange={(v) => setSelectedDoctor(v || "")}
              placeholder={t('tatDashboard.allDoctors')}
              allowClear
              style={{ width: 140 }}
              options={doctorRows.map((d) => ({
                value: d.doctor,
                label: d.doctor,
              }))}
            />
            <Select
              value={selectedModality || undefined}
              onChange={(v) => setSelectedModality(v || "")}
              placeholder={t('tatDashboard.allModalities')}
              allowClear
              style={{ width: 120 }}
              options={MODALITIES.map((m) => ({ value: m, label: m }))}
            />
            <Button
              icon={<RefreshCw size={14} />}
              loading={loading}
              onClick={() => void load()}
            >
              {t('tatDashboard.refresh')}
            </Button>
            <Button icon={<Download size={14} />} onClick={handleExport}>{t('tatDashboard.export')}</Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: "0 24px" }}>
        {error && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 'var(--space-4, 16px)' }}
            title={error}
            action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
                {t('tatDashboard.retry')}
              </Button>
            }
          />
        )}
        <Spin spinning={loading}>
          <StatCardGrid style={{ marginBottom: 'var(--space-5, 20px)' }}>
            <StatCard
              title={t('tatDashboard.avgTat')}
              value={stats.avgTat}
              suffix="min"
              icon={stats.avgTat <= 30 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              color={stats.avgTat <= 30 ? "success" : stats.avgTat <= 60 ? "warning" : "error"}
            />
            <StatCard
              title={t('tatDashboard.onTimeRate')}
              value={stats.onTimeRate}
              suffix="%"
              icon={stats.onTimeRate >= 80 ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              color={stats.onTimeRate >= 80 ? "success" : stats.onTimeRate >= 60 ? "warning" : "error"}
            />
            <StatCard
              title={t('tatDashboard.completionRate')}
              value={stats.completionRate}
              suffix="%"
              icon={<Activity size={18} />}
              color="var(--color-primary-800)"
            />
            <StatCard
              title={t('tatDashboard.totalExams')}
              value={stats.total}
              icon={<BarChart3 size={18} />}
              color="var(--color-primary-800)"
            />
          </StatCardGrid>

          <Row gutter={16} style={{ marginBottom: 'var(--space-5, 20px)' }}>
            <Col span={12}>
              <Card
                title={t('tatDashboard.modalityDistribution')}
                size="small"
                style={{ borderRadius: 8 }}
                extra={
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    {t('tatDashboard.byModalityAvg')}
                  </span>
                }
              >
                {modalityRows.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('tatDashboard.noData')} />
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 'var(--space-2, 8px)' }}
                  >
                    {modalityRows.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            width: 44,
                            fontSize: 12,
                            color: "#64748b",
                            textAlign: "right",
                          }}
                        >
                          {d.modality}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 20,
                            background: "var(--bg-primary)",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${(d.examCount / maxCount) * 100}%`,
                              height: "100%",
                              background:
                                TAT_LEVEL_CONFIG[tatLevel(d.avgTatMinutes)]
                                  .color,
                              borderRadius: 4,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            width: 40,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#334155",
                          }}
                        >
                          {d.examCount}
                        </span>
                        <span
                          style={{ width: 60, fontSize: 12, color: "#64748b" }}
                        >
                          {d.avgTatMinutes > 0 ? `${d.avgTatMinutes}min` : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card
                title={t('tatDashboard.doctorRanking')}
                size="small"
                style={{ borderRadius: 8 }}
                extra={
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    {t('tatDashboard.lowerBetter')}
                  </span>
                }
              >
                {filteredDoctorRows.length === 0 ? (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('tatDashboard.noData')} />
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 'var(--space-2, 8px)' }}
                  >
                    {filteredDoctorRows.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            width: 80,
                            fontSize: 12,
                            color: "#334155",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.doctor}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 2,
                            }}
                          >
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              {d.count}{t('tatDashboard.caseUnit')} · {t('tatDashboard.timelyRateLabel')} {d.timelyRate}%
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color:
                                  d.avgTatMinutes <= 15
                                    ? "#059669"
                                    : d.avgTatMinutes <= 30
                                      ? "var(--color-primary-600)"
                                      : "var(--color-warning-600)",
                              }}
                            >
                              {d.avgTatMinutes > 0
                                ? `${d.avgTatMinutes}min`
                                : "-"}
                            </span>
                          </div>
                          <Progress
                            percent={d.timelyRate}
                            strokeColor={
                              d.timelyRate >= 80
                                ? "#059669"
                                : d.timelyRate >= 60
                                  ? "var(--color-warning-600)"
                                  : "var(--color-error-600)"
                            }
                            size="small"
                            showInfo={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <Card
            title={t('tatDashboard.modalityDetail')}
            size="small"
            style={{ borderRadius: 8 }}
            extra={
              <Space>
                <Tag color="green">{t('tatDashboard.excellent')}: {stats.excellent}</Tag>
                <Tag color="blue">{t('tatDashboard.normal')}: {stats.normal}</Tag>
                <Tag color="orange">{t('tatDashboard.warning')}: {stats.warning}</Tag>
                <Tag color="red">{t('tatDashboard.critical')}: {stats.critical}</Tag>
              </Space>
            }
          >
            <DataTable
              columns={columns}
              dataSource={filteredModalityRows}
              rowKey="modality"
              pagination={false}
              scroll={{ x: 700 }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('tatDashboard.noData')} /> }}
            />
          </Card>

          {/* [Wave1B P2] 多维分析: olapApi.listCubes + drillDown + 柱状图 (简化版) */}
          <Card
            title={<Space><Layers size={16} />{t('tatDashboard.olapTitle')}</Space>}
            size="small"
            style={{ borderRadius: 8, marginTop: 'var(--space-4, 16px)' }}
            extra={
              <Space>
                <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadCubes()}>{t('tatDashboard.refreshCubes')}</Button>
                <Button size="small" type="primary" icon={<BarChart3 size={12} />} loading={drillLoading} onClick={() => void handleDrillDown()}>{t('tatDashboard.drill')}</Button>
              </Space>
            }
          >
            <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Select
                style={{ width: 220 }}
                placeholder={t('tatDashboard.selectCubePlaceholder')}
                value={selectedCube || undefined}
                onChange={setSelectedCube}
                options={cubes.map((c) => ({ value: c.id, label: c.name || c.id }))}
              />
              <Select
                style={{ width: 160 }}
                value={drillDimension}
                onChange={setDrillDimension}
                options={(selectedCubeMeta?.dimensions ?? ["modality", "doctor", "department", "date"]).map((d) => ({ value: d, label: d }))}
              />
              <Input
                style={{ width: 140 }}
                placeholder={t('tatDashboard.dimensionValuePlaceholder')}
                value={drillValue}
                onChange={(e) => setDrillValue(e.target.value)}
                onPressEnter={() => void handleDrillDown()}
              />
              <Select
                style={{ width: 200 }}
                mode="multiple"
                placeholder={t('tatDashboard.measures')}
                value={drillMeasures}
                onChange={setDrillMeasures}
                options={(selectedCubeMeta?.measures ?? ["exam_count", "report_count", "avg_report_time", "report_timely_rate"]).map((m) => ({ value: m, label: m }))}
              />
            </Space>
            {drillError && <Alert type="error" showIcon style={{ marginBottom: 'var(--space-3, 12px)' }} message={drillError} />}
            {drillRows.length === 0 && !drillError ? (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('tatDashboard.drillHint')} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 'var(--space-4, 16px)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 'var(--space-2, 8px)' }}>{t('tatDashboard.barChart')}: {chartMeasure}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-2, 8px)' }}>
                    {drillRows.slice(0, 15).map((r, i) => {
                      const label = String(r[drillColumns[0]?.code ?? "dimension"] ?? r.dimension ?? `行${i + 1}`)
                      const val = Number(r[chartMeasure]) || 0
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
                          <span style={{ width: 90, fontSize: 12, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                          <div style={{ flex: 1, height: 16, background: "var(--bg-primary)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${(val / drillChartMax) * 100}%`, height: "100%", background: "var(--color-primary-600)", borderRadius: 4, transition: "width 0.3s" }} />
                          </div>
                          <span style={{ width: 60, fontSize: 12, fontWeight: 600, color: "#334155", textAlign: "right" }}>{val}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <DataTable
                    rowKey={(_, i) => String(i ?? 0)}
                    dataSource={drillRows}
                    pagination={false}
                    scroll={{ x: 560 }}
                    columns={[
                      ...(drillColumns.length > 0
                        ? drillColumns.map((c) => ({ title: c.name || c.code, key: c.code, dataIndex: c.code }))
                        : [{ title: t('tatDashboard.dimension'), key: "dimension", render: (_: unknown, r: Record<string, unknown>) => String(r.dimension ?? r[drillDimension] ?? "-") }]),
                      { title: chartMeasure, key: chartMeasure, render: (_: unknown, r: Record<string, unknown>) => Number(r[chartMeasure]) || 0 },
                    ]}
                  />
                </div>
              </div>
            )}
          </Card>
        </Spin>
      </div>
    </PageContainer>
  );
}

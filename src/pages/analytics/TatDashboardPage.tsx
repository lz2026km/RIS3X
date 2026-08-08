import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Select,
  Table,
  Statistic,
  Tag,
  Spin,
  Progress,
  Space,
  Button,
  Alert,
  Empty,
  message,
} from "antd";
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
} from "lucide-react";
import type { ColumnsType } from "antd/es/table";
import { olapApi } from "../../services/api";

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

const TAT_LEVEL_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  excellent: { color: "#059669", bg: "#d1fae5", label: "优秀 (≤15min)" },
  normal: { color: "#2563eb", bg: "#dbeafe", label: "正常 (15-30min)" },
  warning: { color: "#d97706", bg: "#fef3c7", label: "预警 (30-60min)" },
  critical: { color: "#dc2626", bg: "#fee2e2", label: "超时 (>60min)" },
};

function tatLevel(minutes: number): string {
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
        setError(aggRes.error?.message ?? "TAT 汇总数据加载失败");
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
          (prev) => prev || (docRes.error?.message ?? "医生 TAT 数据加载失败"),
        );
      }
    } catch (e) {
      setError((e as Error)?.message ?? "TAT 数据加载失败");
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

  // 导出当前筛选表格数据 (CSV blob)
  const handleExport = () => {
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

  const columns: ColumnsType<ModalityTatRow> = [
    {
      title: "设备",
      dataIndex: "modality",
      key: "modality",
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "检查数",
      dataIndex: "examCount",
      key: "examCount",
      sorter: (a, b) => a.examCount - b.examCount,
    },
    { title: "报告数", dataIndex: "reportCount", key: "reportCount" },
    {
      title: "平均TAT",
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
      title: "按时完成率",
      dataIndex: "timelyRate",
      key: "timelyRate",
      width: 130,
      render: (v: number) =>
        v > 0 ? (
          <Progress
            percent={v}
            size="small"
            strokeColor={v >= 80 ? "#059669" : v >= 60 ? "#d97706" : "#dc2626"}
          />
        ) : (
          "-"
        ),
    },
  ];

  return (
    <div
      style={{ padding: "0 0 24px", background: "#f0f2f5", minHeight: "100vh" }}
    >
      <div
        style={{
          background: "#fff",
          padding: "20px 24px",
          borderBottom: "1px solid #e2e8f0",
          marginBottom: 20,
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
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#1e40af",
                margin: "0 0 6px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Clock size={24} />
              报告完成率 TAT 统计
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Turnaround Time Analytics Dashboard · OLAP 实时统计
            </p>
          </div>
          <Space>
            <Select
              value={selectedDoctor || undefined}
              onChange={(v) => setSelectedDoctor(v || "")}
              placeholder="全部医生"
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
              placeholder="全部设备"
              allowClear
              style={{ width: 120 }}
              options={MODALITIES.map((m) => ({ value: m, label: m }))}
            />
            <Button
              icon={<RefreshCw size={14} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button icon={<Download size={14} />} onClick={handleExport}>导出</Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: "0 24px" }}>
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
        <Spin spinning={loading}>
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Statistic
                  title="平均 TAT"
                  value={stats.avgTat}
                  suffix="min"
                  styles={{ content: { 
                    color:
                      stats.avgTat <= 30
                        ? "#059669"
                        : stats.avgTat <= 60
                          ? "#d97706"
                          : "#dc2626",
                    fontSize: 28,
                    fontWeight: 800,
                   } }}
                  prefix={
                    stats.avgTat <= 30 ? (
                      <TrendingUp size={18} />
                    ) : (
                      <TrendingDown size={18} />
                    )
                  }
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Statistic
                  title="按时完成率"
                  value={stats.onTimeRate}
                  suffix="%"
                  styles={{ content: { 
                    color:
                      stats.onTimeRate >= 80
                        ? "#059669"
                        : stats.onTimeRate >= 60
                          ? "#d97706"
                          : "#dc2626",
                    fontSize: 28,
                    fontWeight: 800,
                   } }}
                  prefix={
                    stats.onTimeRate >= 80 ? (
                      <CheckCircle size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )
                  }
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Statistic
                  title="报告完成率"
                  value={stats.completionRate}
                  suffix="%"
                  styles={{ content: { 
                    color: "#1e40af",
                    fontSize: 28,
                    fontWeight: 800,
                   } }}
                  prefix={<Activity size={18} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Statistic
                  title="总检查数"
                  value={stats.total}
                  styles={{ content: { 
                    color: "#1e40af",
                    fontSize: 28,
                    fontWeight: 800,
                   } }}
                  prefix={<BarChart3 size={18} />}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={12}>
              <Card
                title="各设备 TAT 分布"
                size="small"
                style={{ borderRadius: 8 }}
                extra={
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    按设备平均报告时长
                  </span>
                }
              >
                {modalityRows.length === 0 ? (
                  <Empty description="暂无数据" />
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
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
                            background: "#f1f5f9",
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
                title="医生 TAT 排名"
                size="small"
                style={{ borderRadius: 8 }}
                extra={
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    平均 TAT 越低越好
                  </span>
                }
              >
                {filteredDoctorRows.length === 0 ? (
                  <Empty description="暂无数据" />
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
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
                              {d.count}例 · 按时率 {d.timelyRate}%
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color:
                                  d.avgTatMinutes <= 15
                                    ? "#059669"
                                    : d.avgTatMinutes <= 30
                                      ? "#2563eb"
                                      : "#d97706",
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
                                  ? "#d97706"
                                  : "#dc2626"
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
            title="设备 TAT 明细"
            size="small"
            style={{ borderRadius: 8 }}
            extra={
              <Space>
                <Tag color="green">优秀: {stats.excellent}</Tag>
                <Tag color="blue">正常: {stats.normal}</Tag>
                <Tag color="orange">预警: {stats.warning}</Tag>
                <Tag color="red">超时: {stats.critical}</Tag>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={filteredModalityRows}
              rowKey="modality"
              size="small"
              pagination={false}
              scroll={{ x: 700 }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </Spin>
      </div>
    </div>
  );
}

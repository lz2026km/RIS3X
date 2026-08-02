import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  DatePicker,
  Space,
  Tag,
  Statistic,
  message,
  Spin,
  Alert,
} from "antd";
import dayjs from "dayjs";
import {
  TrendingUp,
  Download,
  Calendar,
  Filter,
  BarChart3,
  Gauge,
  Target,
} from "lucide-react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  analyticsStatsApi,
  type UtilizationDto,
  type AccuracyDto,
} from "../../services/api";

const { RangePicker } = DatePicker;

interface ForecastPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
  upper: number | null;
  lower: number | null;
}

export default function PredictivePage() {
  const [department, setDepartment] = useState("放射科");
  const [dateRange, setDateRange] = useState<[string, string]>([
    "2026-04-03",
    "2026-06-02",
  ]);
  const [chartData, setChartData] = useState<ForecastPoint[]>([]);
  const [utilization, setUtilization] = useState<UtilizationDto>({
    current: 0,
    target: 85,
    max: 100,
  });
  const [accuracy, setAccuracy] = useState<AccuracyDto>({
    value: 0,
    previous: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [forecastRes, utilRes, accRes] = await Promise.allSettled([
        analyticsStatsApi.getForecast({
          department,
          startDate: dateRange[0],
          endDate: dateRange[1],
        }),
        analyticsStatsApi.getUtilization(),
        analyticsStatsApi.getAccuracy(),
      ]);
      if (
        forecastRes.status === "fulfilled" &&
        forecastRes.value.success &&
        Array.isArray(forecastRes.value.data)
      ) {
        setChartData(forecastRes.value.data);
      } else {
        const msg =
          forecastRes.status === "fulfilled"
            ? (forecastRes.value.error?.message ?? "预测数据加载失败")
            : "预测数据加载失败";
        setError((prev) => prev || msg);
      }
      if (
        utilRes.status === "fulfilled" &&
        utilRes.value.success &&
        utilRes.value.data
      ) {
        setUtilization(utilRes.value.data);
      } else {
        const msg =
          utilRes.status === "fulfilled"
            ? (utilRes.value.error?.message ?? "利用率数据加载失败")
            : "利用率数据加载失败";
        setError((prev) => prev || msg);
      }
      if (
        accRes.status === "fulfilled" &&
        accRes.value.success &&
        accRes.value.data
      ) {
        setAccuracy(accRes.value.data);
      } else {
        const msg =
          accRes.status === "fulfilled"
            ? (accRes.value.error?.message ?? "准确率数据加载失败")
            : "准确率数据加载失败";
        setError((prev) => prev || msg);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  }, [department, dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = () => {
    const csv =
      "日期,实际值,预测值,上限,下限\n" +
      chartData
        .map(
          (p) =>
            `${p.date},${p.actual ?? ""},${p.forecast ?? ""},${p.upper ?? ""},${p.lower ?? ""}`,
        )
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `预测分析_${department}_${dateRange[0]}_${dateRange[1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("导出成功");
  };

  const gaugeAngle = (utilization.current / utilization.max) * 180;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Space>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #dc2626, #f97316)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              预测分析
            </h2>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>
              工作量预测与资源利用率分析
            </span>
          </div>
        </Space>
        <Button icon={<Download size={14} />} onClick={handleExport}>
          导出报告
        </Button>
      </div>

      {loading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "48px 0",
          }}
        >
          <Spin size="large" tip="加载预测数据..." />
        </div>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      )}

      <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <Space>
              <Filter size={14} color="#94a3b8" />
              <Select
                value={department}
                onChange={setDepartment}
                style={{ width: 140 }}
                options={["放射科", "CT室", "MRI室", "超声科"].map((d) => ({
                  label: d,
                  value: d,
                }))}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Calendar size={14} color="#94a3b8" />
              <RangePicker
                value={
                  [
                    dateRange[0] ? dayjs(dateRange[0]) : null,
                    dateRange[1] ? dayjs(dateRange[1]) : null,
                  ] as any
                }
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([
                      dates[0].format("YYYY-MM-DD"),
                      dates[1].format("YYYY-MM-DD"),
                    ]);
                  }
                }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <BarChart3 size={16} /> 工作量预测
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={5} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="transparent"
                  fill="#f97316"
                  fillOpacity={0.08}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="transparent"
                  fill="#f97316"
                  fillOpacity={0.08}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="实际值"
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="预测值"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            <Card
              title={
                <Space>
                  <Gauge size={16} /> 资源利用率
                </Space>
              }
              variant="borderless"
              style={{ borderRadius: 12 }}
            >
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div
                  style={{
                    position: "relative",
                    width: 160,
                    height: 100,
                    margin: "0 auto",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: 160,
                      height: 80,
                      borderRadius: "160px 160px 0 0",
                      background: "#f0f0f0",
                      position: "absolute",
                      bottom: 0,
                    }}
                  />
                  <div
                    style={{
                      width: 160,
                      height: 80,
                      borderRadius: "160px 160px 0 0",
                      background: `conic-gradient(#f97316 ${gaugeAngle}deg, transparent ${gaugeAngle}deg)`,
                      position: "absolute",
                      bottom: 0,
                      transformOrigin: "bottom center",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#1e293b",
                    }}
                  >
                    {utilization.current}%
                  </div>
                </div>
                <Space style={{ marginTop: 8 }}>
                  <Tag color="orange">目标 {utilization.target}%</Tag>
                  <Tag color="blue">上限 {utilization.max}%</Tag>
                </Space>
              </div>
            </Card>

            <Card
              title={
                <Space>
                  <Target size={16} /> 预测准确率
                </Space>
              }
              variant="borderless"
              style={{ borderRadius: 12 }}
            >
              <Statistic
                value={accuracy.value}
                suffix="%"
                valueStyle={{ color: "#f97316", fontSize: 36, fontWeight: 700 }}
              />
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "#f0f0f0",
                  marginTop: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${accuracy.value}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: "linear-gradient(90deg, #f97316, #dc2626)",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                较上月提升 {(accuracy.value - accuracy.previous).toFixed(1)}%
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

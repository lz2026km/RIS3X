/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 6 - TrendChart
 * 通用趋势图 (基于 recharts, 无新依赖): 折线 / 柱状 / 面积
 */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { CSSProperties } from "react";

export type TrendChartType = "line" | "bar" | "area";

export interface TrendSeries {
  key: string;
  name: string;
  color: string;
  /** 面积图渐变 */
  gradient?: boolean;
}

export interface TrendChartProps {
  type?: TrendChartType;
  /** 数据源 */
  data: Array<Record<string, string | number>>;
  /** X 轴字段 */
  xKey: string;
  /** 序列配置 */
  series: TrendSeries[];
  height?: number;
  /** 加载态 (骨架占位) */
  loading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  /** 百分比坐标轴 (格式化 %) */
  percent?: boolean;
  /** 自定义 Y 轴格式化 */
  yTickFormatter?: (value: number) => string;
  style?: CSSProperties;
  testId?: string;
}

export function TrendChart({
  type = "line",
  data,
  xKey,
  series,
  height = 220,
  loading = false,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  percent = false,
  yTickFormatter,
  style,
  testId,
}: TrendChartProps) {
  if (loading) {
    return (
      <div
        data-testid={`${testId ?? "trend"}-loading`}
        style={{
          height,
          borderRadius: 8,
          background: "var(--skeleton-bg, #e2e8f0)",
          animation: "pulse 1.5s ease-in-out infinite",
          ...style,
        }}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        data-testid={`${testId ?? "trend"}-empty`}
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "var(--text-secondary, #475569)",
          ...style,
        }}
      >
        暂无趋势数据
      </div>
    );
  }

  const tickFormatter = (v: number) =>
    yTickFormatter ? yTickFormatter(v) : percent ? `${v}%` : String(v);

  const axisProps = {
    dataKey: xKey,
    tick: { fontSize: 11, fill: "var(--text-secondary, #64748b)" },
    axisLine: { stroke: "var(--border-color, #e2e8f0)" },
    tickLine: false,
  };

  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid var(--border-color)",
    boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
  };

  const renderLine = series.map((s) => (
    <Line
      key={s.key}
      type="monotone"
      dataKey={s.key}
      name={s.name}
      stroke={s.color}
      strokeWidth={2}
      dot={{ r: 2.5, fill: s.color }}
      activeDot={{ r: 4 }}
    />
  ));

  const renderArea = series.map((s) => (
    <Area
      key={s.key}
      type="monotone"
      dataKey={s.key}
      name={s.name}
      stroke={s.color}
      strokeWidth={2}
      fill={s.color}
      fillOpacity={s.gradient === false ? 0.08 : 0.18}
      dot={false}
      activeDot={{ r: 4 }}
    />
  ));

  const renderBar = series.map((s) => (
    <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
  ));

  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };

  return (
    <div data-testid={testId} style={{ width: "100%", height, ...style }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart {...common}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" vertical={false} />}
            <XAxis {...axisProps} />
            <YAxis tickFormatter={tickFormatter} width={percent ? 44 : 40} tick={{ fontSize: 11, fill: "var(--text-secondary, #64748b)" }} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} formatter={(v) => [tickFormatter(Number(v)), ""]} />}
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {renderBar}
          </BarChart>
        ) : type === "area" ? (
          <AreaChart {...common}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" vertical={false} />}
            <XAxis {...axisProps} />
            <YAxis tickFormatter={tickFormatter} width={percent ? 44 : 40} tick={{ fontSize: 11, fill: "var(--text-secondary, #64748b)" }} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} formatter={(v) => [tickFormatter(Number(v)), ""]} />}
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {renderArea}
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" vertical={false} />}
            <XAxis {...axisProps} />
            <YAxis tickFormatter={tickFormatter} width={percent ? 44 : 40} tick={{ fontSize: 11, fill: "var(--text-secondary, #64748b)" }} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} formatter={(v) => [tickFormatter(Number(v)), ""]} />}
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {renderLine}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default TrendChart;

/**
 * G005 放射RIS系统 v3.0.2 - 危急值升级统计仪表盘
 */
import { CHART_COLORS, CHART_PALETTE } from "../../../utils/chartColors";
import { ChartContainer } from "../../charts";
import type { CriticalValueV2 } from "./CriticalEscalationV2";
import { Card, Tag, Statistic, Row, Col, Progress, Empty } from "antd";
import { DataTable } from "../../common";
import { FilterBar } from "../../common/FilterBar";
import { AlertOctagon, CheckCircle2, Clock, User } from "lucide-react";
import React, { useMemo, useState } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Inbox } from "lucide-react";
import { t } from "../../../i18n/appI18n";

export interface CriticalStatsDashboardProps {
  values: CriticalValueV2[];
  days?: number;
}

export const CriticalStatsDashboard: React.FC<CriticalStatsDashboardProps> = ({
  values,
  days = 30,
}) => {
  // [v3.0.6.16-6] 仪表盘内部筛选 (关键词/类型/状态/人员/时间范围); 公共 props 不变
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const hasActiveFilters =
    keyword.trim().length > 0 ||
    Object.values(filterValues).some(Boolean) ||
    Boolean(dateRange && (dateRange[0] || dateRange[1]));

  const filteredValues = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return values.filter((v) => {
      const matchKw =
        !kw ||
        [v.recipient, v.id, v.category, v.notifyStatus].some((x) =>
          String(x ?? "")
            .toLowerCase()
            .includes(kw),
        );
      const matchCategory =
        !filterValues.category || v.category === filterValues.category;
      const matchStatus =
        !filterValues.notifyStatus ||
        v.notifyStatus === filterValues.notifyStatus;
      const matchRecipient =
        !filterValues.recipient || v.recipient === filterValues.recipient;
      let matchDate = true;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        const d = dayjs(v.triggeredAt);
        if (!d.isValid()) matchDate = false;
        else {
          if (dateRange[0] && d.isBefore(dateRange[0].startOf("day")))
            matchDate = false;
          if (dateRange[1] && d.isAfter(dateRange[1].endOf("day")))
            matchDate = false;
        }
      }
      return (
        matchKw && matchCategory && matchStatus && matchRecipient && matchDate
      );
    });
  }, [values, keyword, filterValues, dateRange]);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(values.map((v) => v.category)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [values],
  );
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(values.map((v) => v.notifyStatus)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [values],
  );
  const recipientOptions = useMemo(
    () =>
      Array.from(new Set(values.map((v) => v.recipient)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [values],
  );

  const data = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    const recent = filteredValues.filter(
      (v) => new Date(v.triggeredAt).getTime() > cutoff,
    );

    const byCategory = Object.entries(
      recent.reduce<Record<string, number>>((acc, v) => {
        acc[v.category] = (acc[v.category] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([k, v]) => ({ name: k, value: v }));

    const byStatus = Object.entries(
      recent.reduce<Record<string, number>>((acc, v) => {
        acc[v.notifyStatus] = (acc[v.notifyStatus] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([k, v]) => ({ name: k, value: v }));

    const byRecipient = Object.entries(
      recent.reduce<Record<string, number>>((acc, v) => {
        acc[v.recipient] = (acc[v.recipient] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([k, v]) => ({ name: k, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const dailyMap: Record<string, Record<string, number>> = {};
    const catKeys = ["LIFE_THREATENING", "URGENT", "IMPORTANT"];
    recent.forEach((v) => {
      const d = v.triggeredAt.split("T")[0] ?? "";
      if (!dailyMap[d])
        dailyMap[d] = Object.fromEntries(catKeys.map((c) => [c, 0])) as Record<
          string,
          number
        >;
      const bucket = dailyMap[d]!;
      bucket[v.category] = (bucket[v.category] ?? 0) + 1;
    });
    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, counts]) => ({ date: d.slice(5), ...counts }));

    const acked = recent.filter((v) => v.ackedAt);
    const avgResponseTime = acked.length
      ? Math.round(
          acked.reduce(
            (s, v) =>
              s +
              (new Date(v.ackedAt!).getTime() -
                new Date(v.triggeredAt).getTime()),
            0,
          ) /
            acked.length /
            1000,
        )
      : 0;

    const overdueRate = recent.length
      ? (recent.filter((v) => {
          const sla =
            v.category === "LIFE_THREATENING"
              ? 300
              : v.category === "URGENT"
                ? 1800
                : 3600;
          return (
            new Date(v.ackedAt ?? v.triggeredAt).getTime() -
              new Date(v.triggeredAt).getTime() >
            sla * 1000
          );
        }).length /
          recent.length) *
        100
      : 0;

    return {
      recent,
      byCategory,
      byStatus,
      byRecipient,
      daily,
      avgResponseTime,
      overdueRate,
      catKeys,
    };
  }, [filteredValues, days]);

  if (values.length === 0 || (data.recent.length === 0 && !hasActiveFilters))
    return (
      <Empty
        image={<Inbox size={48} style={{ opacity: 0.4 }} />}
        description={t("w9e.criticalStats.noDataDays", { days })}
      />
    );

  return (
    <div data-testid="critical-stats-dashboard">
      <FilterBar
        searchPlaceholder="搜索接收人/编号..."
        searchValue={keyword}
        onSearchChange={setKeyword}
        dateRange={{ value: dateRange, onChange: setDateRange }}
        filters={[
          { key: "category", label: "类型", options: categoryOptions },
          { key: "notifyStatus", label: "状态", options: statusOptions },
          { key: "recipient", label: "人员", options: recipientOptions },
        ]}
        filterValues={filterValues}
        onFilterChange={(k, v) =>
          setFilterValues((prev) => ({ ...prev, [k]: v }))
        }
        onReset={() => {
          setKeyword("");
          setFilterValues({});
          setDateRange(null);
        }}
        summary={`共 ${data.recent.length} 条`}
      />
      <Row gutter={12} style={{ marginBottom: "var(--space-3, 12px)" }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("w9e.criticalStats.recentDays", { days })}
              value={data.recent.length}
              prefix={<AlertOctagon size={14} color={CHART_COLORS.error} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("w9e.criticalStats.avgResponse")}
              value={t("w9e.criticalStats.seconds", {
                value: data.avgResponseTime,
              })}
              prefix={<Clock size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("w9e.criticalStats.overdueRate")}
              value={data.overdueRate.toFixed(1)}
              suffix="%"
              styles={{
                content: {
                  color:
                    data.overdueRate > 10
                      ? CHART_COLORS.error
                      : CHART_COLORS.success,
                },
              }}
            />
            <Progress
              percent={data.overdueRate}
              size="small"
              status={data.overdueRate > 10 ? "exception" : "normal"}
              showInfo={false}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("w9e.criticalStats.completedCount")}
              value={
                data.recent.filter(
                  (v) =>
                    v.notifyStatus === "COMPLETED" ||
                    v.notifyStatus === "ACKED",
                ).length
              }
              prefix={<CheckCircle2 size={14} color={CHART_COLORS.success} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: "var(--space-3, 12px)" }}>
        <Col span={12}>
          <Card
            size="small"
            title={t("w9e.criticalStats.byCategory")}
            data-testid="cv-stats-category"
          >
            <ChartContainer
              height={240}
              state={data.byCategory.length === 0 ? "empty" : "ready"}
              emptyDescription={t("w9e.criticalStats.noCategoryData")}
            >
              <PieChart>
                <Pie
                  data={data.byCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  labelLine={false}
                >
                  {data.byCategory.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <RTooltip />
                <Legend verticalAlign="bottom" align="center" />
              </PieChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title={t("w9e.criticalStats.byStatus")}
            data-testid="cv-stats-status"
          >
            <ChartContainer
              height={240}
              state={data.byStatus.length === 0 ? "empty" : "ready"}
              emptyDescription={t("w9e.criticalStats.noStatusData")}
            >
              <BarChart data={data.byStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RTooltip />
                <Bar dataKey="value" fill={CHART_COLORS.primary} />
              </BarChart>
            </ChartContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: "var(--space-3, 12px)" }}>
        <Col span={14}>
          <Card
            size="small"
            title={t("w9e.criticalStats.daily30")}
            data-testid="cv-stats-daily"
          >
            <ChartContainer
              height={240}
              state={data.daily.length === 0 ? "empty" : "ready"}
              emptyDescription={t("w9e.criticalStats.noDailyData")}
            >
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RTooltip />
                <Legend verticalAlign="bottom" align="center" />
                {data.catKeys.map((c, i) => (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stroke={CHART_PALETTE[i]}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card
            size="small"
            title={t("w9e.criticalStats.recipientTop10")}
            data-testid="cv-stats-recipient"
          >
            <DataTable
              dataSource={data.byRecipient.map((r, i) => ({ ...r, key: i }))}
              rowKey="key"
              pagination={false}
              scroll={{ x: "max-content" }}
              columns={[
                {
                  title: t("w9e.criticalStats.physician"),
                  dataIndex: "name",
                  render: (v) => (
                    <span>
                      <User size={10} /> {v}
                    </span>
                  ),
                },
                {
                  title: t("w9e.criticalStats.count"),
                  dataIndex: "value",
                  width: 60,
                  render: (v) => <Tag color="red">{v}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CriticalStatsDashboard;

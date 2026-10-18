import React, { useMemo, useState } from "react";
import { Card, Tag } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { DataTable } from "../common";
import { FilterBar } from "../common/FilterBar";
import type { EyeMeasurement } from "../../types/eye";

// [v3.0.6.16-6] 测量数据内部筛选 (关键词/眼别/解释/时间范围); 公共 props 不变
const MeasurementPanel: React.FC<{
  measurements: EyeMeasurement[];
  title?: string;
}> = ({ measurements, title }) => {
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  const filteredMeasurements = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return measurements.filter((m) => {
      const extra = m as EyeMeasurement & { measurementType?: string };
      const matchKw =
        !kw ||
        [m.type, extra.measurementType, m.measuredBy, m.device].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(kw),
        );
      const matchEye =
        !filterValues.eyeSide || m.eyeSide === filterValues.eyeSide;
      const matchInterpretation =
        !filterValues.interpretation ||
        m.interpretation === filterValues.interpretation;
      let matchDate = true;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        const d = dayjs(m.measuredAt);
        if (!d.isValid()) matchDate = false;
        else {
          if (dateRange[0] && d.isBefore(dateRange[0].startOf("day")))
            matchDate = false;
          if (dateRange[1] && d.isAfter(dateRange[1].endOf("day")))
            matchDate = false;
        }
      }
      return matchKw && matchEye && matchInterpretation && matchDate;
    });
  }, [measurements, keyword, filterValues, dateRange]);

  const eyeSideOptions = useMemo(
    () =>
      Array.from(new Set(measurements.map((m) => m.eyeSide)))
        .filter(Boolean)
        .map((v) => ({ value: String(v), label: String(v) })),
    [measurements],
  );

  const interpretationOptions = useMemo(() => {
    const labels: Record<string, string> = {
      normal: "正常",
      borderline: "临界",
      abnormal: "异常",
      critical: "危急",
    };
    return Array.from(new Set(measurements.map((m) => m.interpretation)))
      .filter(Boolean)
      .map((v) => ({
        value: String(v),
        label: labels[String(v)] || String(v),
      }));
  }, [measurements]);

  return (
    <Card
      size="small"
      title={title || `测量数据 (${measurements.length})`}
      style={{ marginBottom: "var(--space-2, 8px)" }}
    >
      <FilterBar
        searchPlaceholder="搜索参数/测量者..."
        searchValue={keyword}
        onSearchChange={setKeyword}
        dateRange={{ value: dateRange, onChange: setDateRange }}
        filters={[
          { key: "eyeSide", label: "眼别", options: eyeSideOptions },
          {
            key: "interpretation",
            label: "状态",
            options: interpretationOptions,
          },
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
        summary={`共 ${filteredMeasurements.length} 条`}
      />
      <DataTable
        dataSource={filteredMeasurements}
        rowKey="id"
        pagination={false}
        scroll={{ x: "max-content" }}
        columns={[
          { title: "参数", dataIndex: "type", key: "type", width: 100 },
          {
            title: "眼别",
            dataIndex: "eyeSide",
            key: "eyeSide",
            width: 50,
            render: (v: string) => (
              <Tag
                color={v === "OD" ? "blue" : v === "OS" ? "purple" : "green"}
              >
                {v}
              </Tag>
            ),
          },
          {
            title: "值",
            dataIndex: "value",
            key: "value",
            width: 80,
            render: (v: number, r: EyeMeasurement) => (
              <span style={{ fontWeight: 600 }}>
                {v}
                {r.unit}
              </span>
            ),
          },
          {
            title: "范围",
            key: "range",
            width: 100,
            render: (_, r) =>
              r.normalRange ? (
                <span style={{ fontSize: 12 }}>
                  {r.normalRange[0]}-{r.normalRange[1]}
                </span>
              ) : (
                "-"
              ),
          },
          {
            title: "解释",
            key: "interpretation",
            width: 80,
            render: (_, r) => (
              <Tag
                color={
                  r.interpretation === "critical"
                    ? "red"
                    : r.interpretation === "abnormal"
                      ? "orange"
                      : r.interpretation === "borderline"
                        ? "gold"
                        : "green"
                }
              >
                {((
                  {
                    normal: "正常",
                    borderline: "临界",
                    abnormal: "异常",
                    critical: "危急",
                  } as Record<string, string>
                )[String(r.interpretation)] ||
                  r.interpretation) ??
                  "-"}
              </Tag>
            ),
          },
          {
            title: "类型",
            dataIndex: "measurementType",
            key: "measurementType",
            width: 100,
          },
          {
            title: "测量者",
            dataIndex: "measuredBy",
            key: "measuredBy",
            width: 70,
          },
        ]}
      />
    </Card>
  );
};
export default MeasurementPanel;

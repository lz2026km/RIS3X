import React from "react";
import { Card, Tag, Table, Progress } from "antd";
import type { EyeMeasurement } from "../../types/eye";

const MeasurementPanel: React.FC<{
  measurements: EyeMeasurement[];
  title?: string;
}> = ({ measurements, title }) => (
  <Card
    size="small"
    title={title || `测量数据 (${measurements.length})`}
    style={{ marginBottom: 8 }}
  >
    <Table
      dataSource={measurements}
      rowKey="id"
      size="small"
      pagination={false}
      columns={[
        { title: "参数", dataIndex: "type", key: "type", width: 100 },
        {
          title: "眼别",
          dataIndex: "eyeSide",
          key: "eyeSide",
          width: 50,
          render: (v: string) => (
            <Tag color={v === "OD" ? "blue" : v === "OS" ? "purple" : "green"}>
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
              {({ normal: '正常', borderline: '临界', abnormal: '异常', critical: '危急' } as any)[r.interpretation] || r.interpretation}
            </Tag>
          ),
        },
        {
          title: "类型",
          dataIndex: "type",
          key: "type",
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
export default MeasurementPanel;

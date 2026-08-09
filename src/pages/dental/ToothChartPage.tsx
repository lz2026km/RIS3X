// [v3.0.6.8-53] 牙位图页?(FDI 编号 32 ?
import { Card, Space, Tag, Row, Col, Empty, Tooltip, Select } from "antd";
import { Activity, Stethoscope } from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from "react";
// [G005 Wave1B] 牙位图数据: dentalApi.getDentalChart (GET /dental/chart/:patientId)
import { dentalApi } from "../../services/api/dentalApi";

export const ToothChartPage: React.FC = () => {
  // [G005 2B] 写死 P100000 真实化: 患者下拉选择, 切换后重查牙位图
  const [patientId, setPatientId] = useState("P100000");
  const [patients, setPatients] = useState<any[]>([]);
  const [chart, setChart] = useState<any>(null);
  const [activeTooth, setActiveTooth] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await dentalApi.listPatients();
        if (r.success && Array.isArray(r.data) && r.data.length > 0) {
          setPatients(r.data);
          setPatientId(r.data[0].id || r.data[0].patientId);
        }
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await dentalApi.getDentalChart(patientId);
        if (r.success) setChart(r.data);
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
  }, [patientId]);

  const FDI_ROW_1 = [18, 17, 16, 15, 14, 13, 12, 11];
  const FDI_ROW_2 = [21, 22, 23, 24, 25, 26, 27, 28];
  const FDI_ROW_3 = [31, 32, 33, 34, 35, 36, 37, 38];
  const FDI_ROW_4 = [41, 42, 43, 44, 45, 46, 47, 48];

  const STATUS_COLORS: Record<string, string> = {
    Healthy: "#52c41a",
    Caries: "#faad14",
    Restored: "#1890ff",
    Missing: "#d9d9d9",
    Crown: "#722ed1",
    RootCanal: "#f5222d",
    Implant: "#13c2c2",
  };

  return (
    <div style={{ padding: 24, background: "var(--bg-card)" }}>
      <Space style={{ marginBottom: 16 }}>
        <Stethoscope size={20} color="#2563eb" />
        <Activity size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>牙位图 (FDI)</span>
        <Tag color="cyan">v3.0.6.8-53</Tag>
        <Tag color="blue">32 颗牙</Tag>
        <Select
          size="small"
          value={patientId}
          onChange={(v) => setPatientId(v)}
          style={{ width: 180 }}
          options={patients.map((p: any) => ({
            value: p.id || p.patientId,
            label: `${p.name} (${p.id || p.patientId})`,
          }))}
          notFoundContent="暂无患者"
        />
      </Space>
      <Row gutter={16}>
        <Col span={18}>
          <Card size="small" title="牙位图">
            {[FDI_ROW_1, FDI_ROW_2, FDI_ROW_3, FDI_ROW_4].map((row, ri) => (
              <div
                key={ri}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {ri === 0 && (
                  <div
                    style={{
                      writingMode: "vertical-lr",
                      marginRight: 8,
                      color: "var(--text-secondary)",
                    }}
                  >
                    上颌
                  </div>
                )}
                {ri === 3 && (
                  <div
                    style={{
                      writingMode: "vertical-lr",
                      marginRight: 8,
                      color: "var(--text-secondary)",
                    }}
                  >
                    下颌
                  </div>
                )}
                {row.map((t) => {
                  const tooth = chart?.teeth?.[t];
                  const color = STATUS_COLORS[tooth?.status || "Missing"];
                  const surfaces = tooth?.surfaces || {};
                  const hasCaries = Object.values(surfaces).some((s: any) =>
                    s?.includes("Caries"),
                  );
                  return (
                    <Tooltip
                      key={t}
                      title={`FDI ${t}: ${tooth?.status || "缺失"} ${hasCaries ? " (龋齿)" : ""}`}
                    >
                      <div
                        onClick={() =>
                          setActiveTooth(t === activeTooth ? null : t)
                        }
                        style={{
                          width: 40,
                          height: 48,
                          border: `2px solid ${activeTooth === t ? "#2563eb" : "#d9d9d9"}`,
                          borderRadius: 8,
                          background: color,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          color: tooth?.status === "Missing" ? "#999" : "#fff",
                        }}
                      >
                        <div>{t}</div>
                        {hasCaries && (
                          <div style={{ fontSize: 8, color: "#f5222d" }}>●</div>
                        )}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            title={activeTooth ? `FDI ${activeTooth}` : "牙齿详情"}
          >
            {activeTooth && chart?.teeth?.[activeTooth] ? (
              <div>
                <div>
                  状?{" "}
                  <Tag color={STATUS_COLORS[chart.teeth[activeTooth].status]}>
                    {chart.teeth[activeTooth].status}
                  </Tag>
                </div>
                <div>
                  牙面:{" "}
                  {["O", "M", "D", "B", "L"].map((s) => (
                    <Tag
                      key={s}
                      color={
                        chart.teeth[activeTooth].surfaces[s] === "Healthy"
                          ? "green"
                          : "orange"
                      }
                    >
                      {s}: {chart.teeth[activeTooth].surfaces[s]}
                    </Tag>
                  ))}
                </div>
                {chart.teeth[activeTooth].cariesGrade && (
                  <div>龋齿分级: {chart.teeth[activeTooth].cariesGrade}</div>
                )}
                {chart.teeth[activeTooth].periodontal && (
                  <Card size="small" title="牙周" style={{ marginTop: 8 }}>
                    <div>PD: {chart.teeth[activeTooth].periodontal.pd}mm</div>
                    <div>CAL: {chart.teeth[activeTooth].periodontal.cal}mm</div>
                    <div>
                      BOP:{" "}
                      {chart.teeth[activeTooth].periodontal.bop ? "+" : "-"}
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击牙位查看详情" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default ToothChartPage;

// [v3.0.6.8-53] 牙位图页?(FDI 编号 32 ?
import { Card, Space, Tag, Row, Col, Empty, Tooltip, Select } from "antd";
import { Activity, Stethoscope } from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from "react";
// [G005 Wave1B] 牙位图数据: dentalApi.getDentalChart (GET /dental/chart/:patientId)
import { dentalApi } from "../../services/api/dentalApi";
import { LoadingBanner, ErrorBanner, AppEmpty } from "../../components/feedback";
import { ActionButton, ExportButton } from "../../components/common";
import { t } from "../../i18n/appI18n";
import { severityColor, statusColor } from "../../theme/statusTokens";

export const ToothChartPage: React.FC = () => {
  // [G005 2B] 写死 P100000 真实化: 患者下拉选择, 切换后重查牙位图
  const [patientId, setPatientId] = useState("P100000");
  const [patients, setPatients] = useState<any[]>([]);
  const [chart, setChart] = useState<any>(null);
  const [activeTooth, setActiveTooth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

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
      setLoading(true);
      setLoadError(null);
      try {
        const r = await dentalApi.getDentalChart(patientId);
        if (r.success) setChart(r.data);
        else setLoadError(t('w9.states.error'));
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
        setLoadError(t('w9.states.error'));
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, refreshTick]);

  const FDI_ROW_1 = [18, 17, 16, 15, 14, 13, 12, 11];
  const FDI_ROW_2 = [21, 22, 23, 24, 25, 26, 27, 28];
  const FDI_ROW_3 = [31, 32, 33, 34, 35, 36, 37, 38];
  const FDI_ROW_4 = [41, 42, 43, 44, 45, 46, 47, 48];

  const STATUS_COLORS: Record<string, string> = {
    Healthy: severityColor("success"),
    Caries: severityColor("warning"),
    Restored: severityColor("info"),
    Missing: statusColor("neutral"),
    Crown: "#722ed1",
    RootCanal: severityColor("critical"),
    Implant: "#13c2c2",
  };

  // [G005 Wave5] 牙位状态中文化 (Healthy/Caries/Restored/Missing/Crown/RootCanal/Implant)
  const statusLabel = (k: string) => t(`w9d.tooth.status.${k}`);

  // [G005 Wave5] 牙面状态中文化 (Healthy/Caries-Mild/Caries-Moderate/Caries-Severe/Restored/Filling/Sealant)
  const surfaceLabel = (k: string) => t(`w9d.tooth.surface.${k}`);

  return (
    <div style={{ padding: 24, background: "var(--bg-card)" }}>
      <Space style={{ marginBottom: 16 }}>
        <Stethoscope size={20} color="#2563eb" />
        <Activity size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('w9d.tooth.title')}</span>
        <Tag color="cyan">v3.0.6.8-53</Tag>
        <Tag color="blue">{t('w9d.tooth.countTag')}</Tag>
        <Select
          size="small"
          value={patientId}
          onChange={(v) => setPatientId(v)}
          style={{ width: 180 }}
          options={patients.map((p: any) => ({
            value: p.id || p.patientId,
            label: `${p.name} (${p.id || p.patientId})`,
          }))}
          notFoundContent={t('w9d.tooth.noPatient')}
        />
        <ActionButton action="refresh" loading={loading} onClick={() => setRefreshTick((n) => n + 1)}>{t('w45.actions.refresh')}</ActionButton>
        <ExportButton
          data={() => chart ? Object.entries(chart.teeth ?? {}).map(([tooth, info]) => ({ tooth, ...(info as object) })) : []}
          filename={`tooth-chart-${patientId}`}
          label={t('w45.actions.export')}
          size="small"
          formats={["csv", "json"]}
        />
      </Space>
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {!loading && !loadError && !chart && <AppEmpty variant="no-data" />}
      <Row gutter={16}>
        <Col span={18}>
          <Card size="small" title={t('w9d.tooth.chartTitle')}>
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
                    {t('w9d.tooth.upperJaw')}
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
                    {t('w9d.tooth.lowerJaw')}
                  </div>
                )}
                {row.map((toothNo) => {
                  const tooth = chart?.teeth?.[toothNo];
                  const color = STATUS_COLORS[tooth?.status || "Missing"];
                  const surfaces = tooth?.surfaces || {};
                  const hasCaries = Object.values(surfaces).some((s: any) =>
                    s?.includes("Caries"),
                  );
                  return (
                    <Tooltip
                      key={toothNo}
                      title={`FDI ${toothNo}: ${statusLabel(tooth?.status || "Missing")}${hasCaries ? ` (${t('w9d.tooth.caries')})` : ""}`}
                    >
                      <div
                        onClick={() =>
                          setActiveTooth(toothNo === activeTooth ? null : toothNo)
                        }
                        style={{
                          width: 40,
                          height: 48,
                          border: `2px solid ${activeTooth === toothNo ? "#2563eb" : "#d9d9d9"}`,
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
                        <div>{toothNo}</div>
                        {hasCaries && (
                          <div style={{ fontSize: 10, color: "#f5222d" }}>●</div>
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
            title={activeTooth ? `FDI ${activeTooth}` : t('w9d.tooth.detailTitle')}
          >
            {activeTooth && chart?.teeth?.[activeTooth] ? (
              <div>
                <div>
                  {t('w9d.tooth.statusLabel')}{" "}
                  <Tag color={STATUS_COLORS[chart.teeth[activeTooth].status]}>
                    {statusLabel(chart.teeth[activeTooth].status)}
                  </Tag>
                </div>
                <div>
                  {t('w9d.tooth.surfacesLabel')}{" "}
                  {["O", "M", "D", "B", "L"].map((s) => (
                    <Tag
                      key={s}
                      color={
                        chart.teeth[activeTooth].surfaces[s] === "Healthy"
                          ? "green"
                          : "orange"
                      }
                    >
                      {s}: {surfaceLabel(chart.teeth[activeTooth].surfaces[s])}
                    </Tag>
                  ))}
                </div>
                {chart.teeth[activeTooth].cariesGrade && (
                  <div>{t('w9d.tooth.cariesGrade', { grade: chart.teeth[activeTooth].cariesGrade })}</div>
                )}
                {chart.teeth[activeTooth].periodontal && (
                  <Card size="small" title={t('w9d.tooth.periodontal')} style={{ marginTop: 8 }}>
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
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9d.tooth.clickHint')} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default ToothChartPage;

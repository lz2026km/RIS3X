import { useCallback, useEffect, useState } from "react";
import { Button, Card, Select, Space, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { Target, TimerReset } from "lucide-react";
import {
  criticalApi,
  type CriticalRqiDetailDto,
  type CriticalRqiStatsDto,
} from "../../../services/api/criticalApi";
import { DataTable } from "../../common/DataTable";
import { t } from "../../../i18n/appI18n";

const MONTH_OPTIONS = [1, 3, 6, 12].map((m) => ({
  value: m,
  label: t("criticalRqi.months", { count: m }),
}));

export interface CriticalRqiStatsPanelProps {
  months?: number;
  onLoaded?: (data: CriticalRqiStatsDto) => void;
}

export function CriticalRqiStatsPanel({
  months = 1,
  onLoaded,
}: CriticalRqiStatsPanelProps) {
  const [windowMonths, setWindowMonths] = useState(months);
  const [data, setData] = useState<CriticalRqiStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await criticalApi.getRqiStats(windowMonths);
      if (res.success && res.data) {
        setData(res.data);
        onLoaded?.(res.data);
      } else {
        setError(res.error?.message ?? t("criticalRqi.loadFailed"));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("criticalRqi.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [windowMonths, onLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumnsType<CriticalRqiDetailDto> = [
    {
      title: t("criticalRqi.patient"),
      dataIndex: "patientName",
      key: "patientName",
      render: (v: string | undefined, row) => v || row.patientId || "--",
    },
    {
      title: t("criticalRqi.diagnosis"),
      dataIndex: "diagnosisName",
      key: "diagnosisName",
    },
    {
      title: t("criticalRqi.foundAt"),
      dataIndex: "foundAt",
      key: "foundAt",
      render: (v: string) => (v ? new Date(v).toLocaleString() : "--"),
    },
    {
      title: t("criticalRqi.notifiedAt"),
      dataIndex: "notifiedAt",
      key: "notifiedAt",
      render: (v?: string) => (v ? new Date(v).toLocaleString() : "--"),
    },
    {
      title: t("criticalRqi.notifyMinutes"),
      dataIndex: "notifyMinutes",
      key: "notifyMinutes",
      render: (v?: number) => (v === undefined ? "--" : `${v}`),
    },
    {
      title: t("criticalRqi.within10Min"),
      dataIndex: "within10Min",
      key: "within10Min",
      render: (v: boolean) => (
        <Tag color={v ? "green" : "red"}>
          {v ? t("criticalRqi.yes") : t("criticalRqi.no")}
        </Tag>
      ),
    },
  ];

  const rate = data?.completionRate ?? 0;
  const within = data?.within10MinCount ?? 0;
  const total = data?.nationalTotal ?? 0;

  return (
    <Card
      size="small"
      data-testid="critical-rqi-stats-panel"
      title={
        <Space>
          <Target size={15} style={{ color: "var(--color-primary-800)" }} />
          <span>{t("criticalRqi.title")}</span>
        </Space>
      }
      extra={
        <Select
          size="small"
          value={windowMonths}
          options={MONTH_OPTIONS}
          onChange={(v) => setWindowMonths(v)}
          style={{ width: 120 }}
          aria-label={t("criticalRqi.windowMonths")}
        />
      }
      style={{ marginBottom: "var(--space-4, 16px)" }}
    >
      {loading ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-muted, #64748b)",
          }}
        >
          {t("criticalRqi.loading")}
        </div>
      ) : error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--color-error-bg)",
            border: "1px solid var(--color-error-border)",
            color: "var(--color-error-600)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{error}</span>
          <Button size="small" onClick={() => void load()}>
            {t("criticalRqi.retry")}
          </Button>
        </div>
      ) : data ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--color-success-bg)",
                border: "1px solid var(--color-success-border)",
              }}
            >
              <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                {t("criticalRqi.rate")}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#059669" }}>
                {rate}%
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted, #64748b)",
                  fontWeight: 600,
                }}
              >
                {t("criticalRqi.numerator")}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                }}
              >
                {within}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted, #64748b)",
                  fontWeight: 600,
                }}
              >
                {t("criticalRqi.denominator")}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--color-primary-800)",
                }}
              >
                {total}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted, #64748b)",
                  fontWeight: 600,
                }}
              >
                {t("criticalRqi.signatureComplete")}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#7c3aed" }}>
                {data.signatureIntegrity.completenessRate}%
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--color-info-bg)",
              border: "1px solid var(--color-info-border)",
              fontSize: 12,
              color: "var(--text-secondary, #475569)",
              lineHeight: 1.7,
              marginBottom: 12,
            }}
          >
            <div>
              <TimerReset
                size={12}
                style={{ verticalAlign: -2, marginRight: 4 }}
              />
              {t("criticalRqi.formula", {
                within,
                total,
                rate,
                min: data.deadlineMin,
              })}
            </div>
            <div>
              {t("criticalRqi.window", {
                months: data.months,
                start: data.windowStart
                  ? new Date(data.windowStart).toLocaleString()
                  : "--",
              })}
            </div>
            <div>
              {t("criticalRqi.standard", {
                standard: data.standard,
                source: data.source,
              })}
            </div>
          </div>
          <DataTable<CriticalRqiDetailDto>
            rowKey="criticalId"
            dataSource={data.details}
            columns={columns}
            pagination={{ pageSize: 6 }}
            paginationSize="small"
            scroll={{ x: "max-content" }}
          />
        </>
      ) : null}
    </Card>
  );
}

export default CriticalRqiStatsPanel;

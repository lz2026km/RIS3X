/**
 * G005 v3.0.6.11-75 W3-1 - 患者安全与质量指标看板
 * safetyApi 真实数据: adverse events 统计/风险项 + 图表 + 最新事件 + loading/error
 */
import {
  getAdverseEvents,
  getRiskItems,
  getAdverseEventTrend,
  type AdverseEvent,
  type RiskItem,
  type AdverseEventTrendItem,
} from "../../services/api/safetyApi";
import {
  Card,
  Space,
  Tag,
  Row,
  Col,
  Progress,
  Badge,
  List,
  Segmented,
  Alert,
  Button,
  Empty,
  Tabs,
} from "antd";
import {
  DataTable,
  PageContainer,
  StatCard,
  StatCardGrid,
} from "../../components/common";
import { FilterBar } from "../../components/common/FilterBar";
import {
  Shield,
  AlertTriangle,
  Activity,
  Heart,
  RefreshCw,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { Inbox } from "lucide-react";
import { t } from "../../i18n/appI18n";

const SEVERITY_LABELS: Record<string, string> = {
  "near-miss": t("psd.sev.nearMiss"),
  minor: t("psd.sev.minor"),
  moderate: t("psd.sev.moderate"),
  severe: t("psd.sev.severe"),
  catastrophic: t("psd.sev.catastrophic"),
};
const STATUS_LABELS: Record<string, string> = {
  reported: t("psd.status.reported"),
  investigating: t("psd.status.investigating"),
  resolved: t("psd.status.resolved"),
  closed: t("psd.status.closed"),
};
const RISK_LEVEL_META: Record<string, { color: string; label: string }> = {
  "very-high": {
    color: "var(--color-error-600)",
    label: t("psd.risk.veryHigh"),
  },
  high: { color: "var(--color-warning-500)", label: t("psd.risk.high") },
  medium: { color: "var(--color-primary-500)", label: t("psd.risk.medium") },
  low: { color: "#10b981", label: t("psd.risk.low") },
  "very-low": {
    color: "var(--text-muted, #94a3b8)",
    label: t("psd.risk.veryLow"),
  },
};

const PatientSafetyDashboardPage: React.FC = () => {
  const [range, setRange] = useState("today");
  const [events, setEvents] = useState<AdverseEvent[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [trend, setTrend] = useState<AdverseEventTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // [v3.0.6.16-6] 最新不良事件表筛选: 关键词/时间范围/类型/严重度/状态/科室
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [evtRes, riskRes, trendData] = await Promise.all([
        getAdverseEvents(),
        getRiskItems(),
        getAdverseEventTrend().catch(() => []),
      ]);
      setEvents(evtRes ?? []);
      setRisks(riskRes ?? []);
      setTrend(Array.isArray(trendData) ? trendData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("psd.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = events.filter(
    (e) => e.status === "reported" || e.status === "investigating",
  ).length;
  const closedCount = events.filter((e) => e.status === "closed").length;
  const highRiskCount = risks.filter(
    (r) => r.riskLevel === "high" || r.riskLevel === "very-high",
  ).length;
  const safetyScore =
    events.length > 0
      ? Math.max(60, Math.round(100 - openCount * 4 - highRiskCount * 3))
      : 96;

  const severityDist = (list: AdverseEvent[]) => {
    const out: Record<string, number> = {};
    for (const e of list) out[e.severity] = (out[e.severity] ?? 0) + 1;
    return Object.entries(out).map(([k, v]) => ({
      key: k,
      label: SEVERITY_LABELS[k] ?? k,
      count: v,
    }));
  };

  const categoryDist = (list: AdverseEvent[]) => {
    const out: Record<string, number> = {};
    for (const e of list) out[e.eventType] = (out[e.eventType] ?? 0) + 1;
    return Object.entries(out)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => ({ key: k, count: v }));
  };

  const trendWindow =
    range === "today"
      ? trend.slice(-1)
      : range === "week"
        ? trend.slice(-2)
        : trend;

  const filteredEvents = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return events.filter((e) => {
      const matchKw =
        !kw ||
        e.id.toLowerCase().includes(kw) ||
        (e.patientName ?? "").toLowerCase().includes(kw) ||
        (e.description ?? "").toLowerCase().includes(kw) ||
        (e.reportedBy ?? "").toLowerCase().includes(kw);
      const matchType =
        !filterValues.eventType || e.eventType === filterValues.eventType;
      const matchSeverity =
        !filterValues.severity || e.severity === filterValues.severity;
      const matchStatus =
        !filterValues.status || e.status === filterValues.status;
      const matchDept =
        !filterValues.department || e.department === filterValues.department;
      let matchDate = true;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        const d = dayjs(e.reportedAt);
        if (!d.isValid()) matchDate = false;
        else {
          if (dateRange[0] && d.isBefore(dateRange[0].startOf("day")))
            matchDate = false;
          if (dateRange[1] && d.isAfter(dateRange[1].endOf("day")))
            matchDate = false;
        }
      }
      return (
        matchKw &&
        matchType &&
        matchSeverity &&
        matchStatus &&
        matchDept &&
        matchDate
      );
    });
  }, [events, keyword, filterValues, dateRange]);

  const displayEvents = useMemo(
    () => filteredEvents.slice(0, 10),
    [filteredEvents],
  );

  const eventTypeOptions = useMemo(
    () =>
      Array.from(new Set(events.map((e) => e.eventType)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: CATEGORY_LABELS[v] ?? v })),
    [events],
  );
  const severityOptions = useMemo(
    () =>
      Array.from(new Set(events.map((e) => e.severity)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: SEVERITY_LABELS[v] ?? v })),
    [events],
  );
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(events.map((e) => e.status)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: STATUS_LABELS[v] ?? v })),
    [events],
  );
  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(events.map((e) => e.department)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [events],
  );

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: "var(--space-4, 16px)" }} wrap>
        <Shield size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("psd.title")}</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="red" icon={<AlertTriangle size={10} />}>
          {t("psd.realtime")}
        </Tag>
        <Segmented
          value={range}
          onChange={setRange as any}
          options={[
            { value: "today", label: t("psd.range.today") },
            { value: "week", label: t("psd.range.week") },
            { value: "month", label: t("psd.range.month") },
          ]}
        />
        <Button
          size="small"
          icon={<RefreshCw size={12} />}
          onClick={() => void load()}
        >
          {t("psd.refresh")}
        </Button>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t("psd.loadError")}
          description={error}
          style={{ marginBottom: "var(--space-4, 16px)" }}
          action={
            <Button size="small" onClick={() => void load()}>
              <RefreshCw size={14} /> {t("psd.retry")}
            </Button>
          }
        />
      )}

      <StatCardGrid
        minWidth={200}
        gap={16}
        style={{ marginBottom: "var(--space-4, 16px)" }}
      >
        <StatCard
          title={t("psd.kpiScore")}
          value={loading ? 0 : safetyScore}
          suffix="/100"
          icon={<Shield size={14} />}
          loading={loading}
          color={
            safetyScore >= 90
              ? "var(--color-success-500, var(--color-success-500))"
              : "var(--color-warning-500, var(--color-warning-500))"
          }
        />
        <StatCard
          title={t("psd.kpiOpen")}
          value={openCount}
          loading={loading}
          color="var(--color-warning-500, var(--color-warning-500))"
        />
        <StatCard
          title={t("psd.kpiClosed")}
          value={closedCount}
          loading={loading}
          color="var(--color-success-500, var(--color-success-500))"
        />
        <StatCard
          title={t("psd.kpiHighRisk")}
          value={highRiskCount}
          loading={loading}
          color="var(--color-error-500, var(--color-error-500))"
        />
      </StatCardGrid>

      <Row gutter={[12, 12]} style={{ marginBottom: "var(--space-4, 16px)" }}>
        <Col xs={24} lg={16}>
          <Card
            size="small"
            title={
              <Space>
                <Activity size={14} />
                {t("psd.distTrend")}
              </Space>
            }
            loading={loading}
          >
            <Tabs
              items={[
                {
                  key: "severity",
                  label: t("psd.tabSeverity"),
                  children: (
                    <Row gutter={[8, 8]}>
                      {severityDist(events).map((s) => (
                        <Col span={12} key={s.key}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-2, 8px)",
                            }}
                          >
                            <span style={{ fontSize: 12, width: 70 }}>
                              {s.label}
                            </span>
                            <Progress
                              percent={
                                events.length
                                  ? Math.round((s.count / events.length) * 100)
                                  : 0
                              }
                              size="small"
                              style={{ flex: 1, margin: 0 }}
                              strokeColor={
                                s.key === "severe" || s.key === "catastrophic"
                                  ? "var(--color-error-500, var(--color-error-500))"
                                  : "var(--color-primary-600, var(--color-primary-600))"
                              }
                            />
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted, #64748b)",
                                width: 30,
                              }}
                            >
                              {s.count}
                            </span>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  ),
                },
                {
                  key: "category",
                  label: t("psd.tabCategory"),
                  children: (
                    <Row gutter={[8, 8]}>
                      {categoryDist(events).map((c) => (
                        <Col span={12} key={c.key}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-2, 8px)",
                            }}
                          >
                            <span style={{ fontSize: 12, width: 110 }}>
                              {CATEGORY_LABELS[c.key] ?? c.key}
                            </span>
                            <Progress
                              percent={
                                events.length
                                  ? Math.round((c.count / events.length) * 100)
                                  : 0
                              }
                              size="small"
                              style={{ flex: 1, margin: 0 }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted, #64748b)",
                                width: 30,
                              }}
                            >
                              {c.count}
                            </span>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  ),
                },
                {
                  key: "trend",
                  label: t("psd.tabTrend"),
                  children: (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "var(--space-3, 12px)",
                        height: 120,
                        paddingTop: "var(--space-3, 12px)",
                      }}
                    >
                      {trendWindow.map((t) => (
                        <div
                          key={t.period}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {t.total}
                          </span>
                          <div
                            style={{
                              width: 32,
                              height: Math.max(4, t.total * 14),
                              background:
                                t.total > 5
                                  ? "var(--color-error-500, var(--color-error-500))"
                                  : "var(--color-primary-500, var(--color-primary-500))",
                              borderRadius: "4px 4px 0 0",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted, #64748b)",
                              marginTop: "var(--space-1, 4px)",
                            }}
                          >
                            {t.period}
                          </span>
                        </div>
                      ))}
                      {trendWindow.length === 0 && (
                        <Empty
                          description={t("psd.noTrend")}
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={
              <Space>
                <AlertTriangle size={14} />
                {t("psd.highRiskRpn")}
              </Space>
            }
            loading={loading}
            style={{ marginBottom: "var(--space-3, 12px)" }}
          >
            {risks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={risks.slice(0, 6)}
                renderItem={(r) => (
                  <List.Item style={{ padding: "6px 0" }}>
                    <Space
                      direction="vertical"
                      size={2}
                      style={{ width: "100%" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span style={{ fontSize: 12 }}>{r.title}</span>
                        <Tag
                          color={RISK_LEVEL_META[r.riskLevel]?.color}
                          style={{ marginInlineEnd: 0 }}
                        >
                          {RISK_LEVEL_META[r.riskLevel]?.label ?? r.riskLevel}
                        </Tag>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted, #64748b)",
                          }}
                        >
                          {r.category} · {r.status}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          RPN {r.rpn}
                        </span>
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Heart size={14} />
            {t("psd.latestEvents")}
          </Space>
        }
        loading={loading}
      >
        {events.length === 0 ? (
          <Empty
            image={<Inbox size={48} style={{ opacity: 0.4 }} />}
            description={t("psd.noEvents")}
          />
        ) : (
          <>
            <FilterBar
              searchPlaceholder="搜索患者 / 事件描述 / 报告人…"
              searchValue={keyword}
              onSearchChange={setKeyword}
              dateRange={{
                value: dateRange,
                onChange: setDateRange,
                placeholder: ["上报开始", "上报结束"],
              }}
              filters={[
                {
                  key: "eventType",
                  label: "事件类型",
                  options: eventTypeOptions,
                },
                { key: "severity", label: "严重度", options: severityOptions },
                { key: "status", label: "状态", options: statusOptions },
                {
                  key: "department",
                  label: "科室",
                  options: departmentOptions,
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
              summary={`共 ${filteredEvents.length} 条${filteredEvents.length > displayEvents.length ? ` / 显示前 ${displayEvents.length} 条` : ""}`}
            />
            <DataTable
              dataSource={displayEvents}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: t("psd.colTime"),
                  dataIndex: "reportedAt",
                  width: 150,
                  render: (v: string) => new Date(v).toLocaleString("zh-CN"),
                },
                {
                  title: t("psd.colType"),
                  dataIndex: "eventType",
                  render: (v: string) => (
                    <Tag color="blue">{CATEGORY_LABELS[v] ?? v}</Tag>
                  ),
                },
                {
                  title: t("psd.colPatient"),
                  dataIndex: "patientName",
                  width: 110,
                  render: (v?: string) => v ?? "-",
                },
                {
                  title: t("psd.tabSeverity"),
                  dataIndex: "severity",
                  width: 100,
                  render: (v: string) => (
                    <Tag
                      color={
                        v === "severe" || v === "catastrophic"
                          ? "red"
                          : v === "moderate"
                            ? "orange"
                            : "blue"
                      }
                    >
                      {SEVERITY_LABELS[v] ?? v}
                    </Tag>
                  ),
                },
                {
                  title: t("psd.colDepartment"),
                  dataIndex: "department",
                  width: 100,
                },
                {
                  title: t("psd.colDescription"),
                  dataIndex: "description",
                  ellipsis: true,
                },
                {
                  title: t("psd.colStatus"),
                  dataIndex: "status",
                  width: 90,
                  render: (v: string) => (
                    <Badge
                      status={
                        v === "closed"
                          ? "success"
                          : v === "investigating"
                            ? "processing"
                            : "warning"
                      }
                      text={STATUS_LABELS[v] ?? v}
                    />
                  ),
                },
              ]}
              scroll={{ x: "max-content" }}
            />
          </>
        )}
      </Card>
    </PageContainer>
  );
};

const CATEGORY_LABELS: Record<string, string> = {
  "medication-error": t("psd.cat.medicationError"),
  "patient-identification": t("psd.cat.patientId"),
  "contrast-reaction": t("psd.cat.contrastReaction"),
  "radiation-overdose": t("psd.cat.radiationOverdose"),
  fall: t("psd.cat.fall"),
  "specimen-error": t("psd.cat.specimenError"),
  "communication-failure": t("psd.cat.communicationFailure"),
  "equipment-malfunction": t("psd.cat.equipmentMalfunction"),
  "information-loss": t("psd.cat.informationLoss"),
  other: t("psd.cat.other"),
};

export default PatientSafetyDashboardPage;

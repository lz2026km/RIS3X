// [G005 W-D2] 报告语义检索 V2 (/report-search-v2)
// - 结构化: 关键词 + 过滤器构建器 (字段/运算符/取值 来自 GET /report-search-v2/meta)
// - 自然语言: POST /report-search-v2/natural-language (解析条件回显)
// - 结果 DataTable + 聚合 + KPI 卡片 (GET /report-search-v2/stats, 检索耗时前端实测)
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Button, Card, Input, Segmented, Select, Space, Tag, message } from "antd";
import {
  Clock,
  Database,
  Filter,
  Hourglass,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  DataTable,
  PageContainer,
  PageHeader,
  StatCard,
  StatCardGrid,
} from "../../components/common";
import { t } from "../../i18n/appI18n";
import { statusColor, toneToAntd } from "../../theme/statusTokens";
import {
  reportSearchV2Api,
  type NaturalLanguageResult,
  type SearchCondition,
  type SearchHit,
  type SearchMeta,
  type SearchResult,
  type SearchV2Stats,
} from "../../services/api/reportSearchV2Api";

type SearchMode = "structured" | "nl";
type FilterField = keyof SearchCondition;
type FilterOperator = "eq" | "contains" | "gte" | "lte";

interface FilterRow {
  id: string;
  field: FilterField;
  op: FilterOperator;
  value: string;
}

const FILTER_FIELDS: FilterField[] = [
  "keyword",
  "modality",
  "organization",
  "doctor",
  "diagnosisKeyword",
  "dateFrom",
  "dateTo",
];

const FIELD_LABEL_KEY: Record<FilterField, string> = {
  keyword: "wD2.search.field.keyword",
  modality: "wD2.search.field.modality",
  organization: "wD2.search.field.organization",
  doctor: "wD2.search.field.doctor",
  diagnosisKeyword: "wD2.search.field.diagnosisKeyword",
  dateFrom: "wD2.search.field.dateFrom",
  dateTo: "wD2.search.field.dateTo",
};

const OP_LABEL_KEY: Record<FilterOperator, string> = {
  eq: "wD2.search.op.eq",
  contains: "wD2.search.op.contains",
  gte: "wD2.search.op.gte",
  lte: "wD2.search.op.lte",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function operatorsFor(field: FilterField): FilterOperator[] {
  if (field === "dateFrom") return ["gte"];
  if (field === "dateTo") return ["lte"];
  if (field === "modality") return ["eq"];
  return ["eq", "contains"];
}

function valueOptions(
  field: FilterField,
  meta: SearchMeta | null,
): Array<{ value: string; label: string }> {
  if (!meta) return [];
  switch (field) {
    case "modality":
      return meta.modalities.map((m) => ({ value: m, label: m }));
    case "organization":
      return meta.organizations.map((o) => ({ value: o.name, label: `${o.name} (${o.count})` }));
    case "doctor":
      return meta.doctors.map((d) => ({ value: d.name, label: `${d.name} (${d.count})` }));
    default:
      return [];
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, keywords: string[]): ReactNode {
  if (!text) return "--";
  const kws = (keywords ?? []).filter((k) => typeof k === "string" && k.length > 0);
  if (kws.length === 0) return text;
  const parts = text.split(new RegExp(`(${kws.map(escapeRegExp).join("|")})`, "g"));
  return parts.map((part, idx) =>
    kws.includes(part) ? (
      <mark
        key={`hl-${idx}`}
        style={{
          background: "var(--color-warning-50, #fffbeb)",
          color: "var(--color-warning-700, #b45309)",
          borderRadius: 2,
        }}
      >
        {part}
      </mark>
    ) : (
      <span key={`tx-${idx}`}>{part}</span>
    ),
  );
}

function summarizeConditions(conditions: SearchCondition): string {
  return Object.entries(conditions)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${t(FIELD_LABEL_KEY[key as FilterField] ?? key)}=${String(value)}`)
    .join(" · ");
}

export default function ReportSearchV2Page() {
  const [mode, setMode] = useState<SearchMode>("structured");
  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [phrase, setPhrase] = useState("");

  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [stats, setStats] = useState<SearchV2Stats | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [nlResult, setNlResult] = useState<NaturalLanguageResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [lastSearch, setLastSearch] = useState<{ label: string; at: number } | null>(null);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [metaRes, statsRes] = await Promise.all([
        reportSearchV2Api.getMeta(),
        reportSearchV2Api.getStats(),
      ]);
      if (metaRes.success && metaRes.data) setMeta(metaRes.data);
      else setError(metaRes.error?.message ?? t("wD2.search.metaError"));
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
    } catch {
      setError(t("wD2.search.metaError"));
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const conditions = useMemo(() => {
    const built: SearchCondition = {};
    if (keyword.trim()) built.keyword = keyword.trim();
    for (const row of filters) {
      const value = row.value.trim();
      if (!value) continue;
      if (row.field === "dateFrom" || row.field === "dateTo") {
        if (DATE_RE.test(value)) built[row.field] = value;
        continue;
      }
      built[row.field] = value;
    }
    return built;
  }, [keyword, filters]);

  const recordSuccess = useCallback(
    (elapsed: number, label: string) => {
      setLatencies((prev) => [...prev, elapsed].slice(-10));
      setLastSearch({ label, at: Date.now() });
    },
    [],
  );

  const runStructured = useCallback(async () => {
    setLoading(true);
    setError(null);
    const startedAt = Date.now();
    try {
      const res = await reportSearchV2Api.search(conditions);
      const elapsed = Date.now() - startedAt;
      if (res.success && res.data) {
        setResult(res.data);
        setNlResult(null);
        const label = summarizeConditions(conditions);
        recordSuccess(elapsed, label || t("wD2.search.mode.structured"));
        message.success(t("wD2.search.done", { count: res.data.total }));
      } else {
        setError(res.error?.message ?? t("wD2.search.error"));
      }
    } catch {
      setError(t("wD2.search.error"));
    } finally {
      setLoading(false);
    }
  }, [conditions, recordSuccess]);

  const runNl = useCallback(async () => {
    const trimmed = phrase.trim();
    if (!trimmed) {
      message.warning(t("wD2.search.nl.required"));
      return;
    }
    setLoading(true);
    setError(null);
    const startedAt = Date.now();
    try {
      const res = await reportSearchV2Api.naturalLanguage(trimmed);
      const elapsed = Date.now() - startedAt;
      if (res.success && res.data) {
        setResult(res.data);
        setNlResult(res.data);
        recordSuccess(elapsed, trimmed);
        message.success(t("wD2.search.done", { count: res.data.total }));
      } else {
        setError(res.error?.message ?? t("wD2.search.error"));
      }
    } catch {
      setError(t("wD2.search.error"));
    } finally {
      setLoading(false);
    }
  }, [phrase, recordSuccess]);

  const addFilter = useCallback(() => {
    setFilters((prev) => [
      ...prev,
      {
        id: `f-${Date.now().toString(36)}-${prev.length}`,
        field: "modality",
        op: "eq",
        value: "",
      },
    ]);
  }, []);

  const updateFilter = useCallback((id: string, patch: Partial<FilterRow>) => {
    setFilters((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const changeField = useCallback(
    (id: string, field: FilterField) => {
      updateFilter(id, { field, op: operatorsFor(field)[0] ?? "eq", value: "" });
    },
    [updateFilter],
  );

  const resetAll = useCallback(() => {
    setKeyword("");
    setFilters([]);
    setPhrase("");
    setResult(null);
    setNlResult(null);
    setError(null);
  }, []);

  const avgLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, v) => sum + v, 0) / latencies.length)
      : null;
  const aggregations = result?.aggregations;
  const aggGroups = aggregations
    ? [
        { key: "modality", label: t("wD2.search.agg.modality"), items: aggregations.byModality },
        {
          key: "organization",
          label: t("wD2.search.agg.organization"),
          items: aggregations.byOrganization,
        },
        { key: "doctor", label: t("wD2.search.agg.doctor"), items: aggregations.byDoctor },
        { key: "diagnosis", label: t("wD2.search.agg.diagnosis"), items: aggregations.byDiagnosis },
      ]
    : [];

  return (
    <PageContainer
      testId="report-search-v2-page"
      padding="var(--space-4, 16px)"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}
    >
      <PageHeader
        title={t("wD2.search.title")}
        subtitle={t("wD2.search.subtitle")}
        icon={<Search size={20} color="var(--color-primary-600)" />}
        actions={
          <Space wrap>
            <Tag color="blue">/report-search-v2</Tag>
            <Button
              size="small"
              icon={<RefreshCw size={13} />}
              loading={metaLoading}
              onClick={() => void loadMeta()}
            >
              {t("wD2.search.refresh")}
            </Button>
          </Space>
        }
        testId="report-search-v2-header"
      />

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message={error}
          onClose={() => setError(null)}
          action={
            <Button size="small" onClick={() => void (mode === "nl" ? runNl() : runStructured())}>
              {t("wD2.search.run")}
            </Button>
          }
        />
      )}

      <StatCardGrid minWidth={200} gap={16}>
        <StatCard
          title={t("wD2.search.stats.totalIndexed")}
          value={stats?.totalReports ?? "--"}
          sub={t("wD2.search.stats.totalIndexedSub")}
          icon={<Database size={14} />}
          color="primary"
          loading={metaLoading}
          testId="report-search-v2-stat-indexed"
        />
        <StatCard
          title={t("wD2.search.stats.avgLatency")}
          value={avgLatency !== null ? `${avgLatency} ms` : t("wD2.search.stats.avgLatencyEmpty")}
          sub={
            latencies.length > 0
              ? t("wD2.search.stats.avgLatencySub", { count: latencies.length })
              : undefined
          }
          icon={<Hourglass size={14} />}
          color="info"
          testId="report-search-v2-stat-latency"
        />
        <StatCard
          title={t("wD2.search.stats.lastSearch")}
          value={
            lastSearch
              ? new Date(lastSearch.at).toLocaleTimeString()
              : t("wD2.search.stats.lastSearchEmpty")
          }
          sub={lastSearch?.label ?? undefined}
          icon={<Clock size={14} />}
          testId="report-search-v2-stat-last"
        />
        <StatCard
          title={t("wD2.search.stats.hits")}
          value={result?.total ?? 0}
          icon={<Target size={14} />}
          color="success"
          testId="report-search-v2-stat-hits"
        />
      </StatCardGrid>

      <Card
        size="small"
        title={
          <Space>
            <Search size={14} />
            {t("wD2.search.title")}
          </Space>
        }
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-2, 8px)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as SearchMode)}
            options={[
              { label: t("wD2.search.mode.structured"), value: "structured" },
              { label: t("wD2.search.mode.nl"), value: "nl" },
            ]}
            data-testid="report-search-v2-mode"
          />
          {mode === "structured" ? (
            <>
              <Input
                allowClear
                style={{ width: 280 }}
                prefix={<Search size={13} />}
                aria-label={t("wD2.search.keywordLabel")}
                placeholder={t("wD2.search.keywordPlaceholder")}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={() => void runStructured()}
                data-testid="report-search-v2-keyword"
              />
              <Button
                type="primary"
                icon={<Search size={14} />}
                loading={loading}
                onClick={() => void runStructured()}
                data-testid="report-search-v2-run"
              >
                {t("wD2.search.run")}
              </Button>
            </>
          ) : (
            <Input.Search
              style={{ width: 360 }}
              allowClear
              aria-label={t("wD2.search.nl.title")}
              placeholder={t("wD2.search.nl.placeholder")}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onSearch={() => void runNl()}
              loading={loading}
              enterButton={t("wD2.search.run")}
              data-testid="report-search-v2-nl"
            />
          )}
          <Button icon={<RotateCcw size={14} />} onClick={resetAll}>
            {t("wD2.search.reset")}
          </Button>
        </div>

        {mode === "nl" && nlResult && (
          <div style={{ marginTop: "var(--space-3, 12px)" }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: "var(--space-1, 4px)",
              }}
            >
              {t("wD2.search.nl.parsed")}
            </div>
            <Space wrap>
              <Tag color="blue">
                {t("wD2.search.nl.phrase")}: {nlResult.phrase}
              </Tag>
              {nlResult.parsed.map((item) => (
                <Tag key={`${item.key}-${item.value}`}>
                  {item.label}: {item.value}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>

      {mode === "structured" && (
        <Card
          size="small"
          title={
            <Space>
              <Filter size={14} />
              {t("wD2.search.structured.title")}
            </Space>
          }
          extra={
            <Button size="small" icon={<Plus size={12} />} onClick={addFilter}>
              {t("wD2.search.filter.add")}
            </Button>
          }
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: "var(--space-2, 8px)",
            }}
          >
            {t("wD2.search.structured.hint")}
          </div>
          {filters.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("wD2.search.filter.empty")}
            </div>
          ) : (
            filters.map((row) => {
              const options = valueOptions(row.field, meta);
              const isDate = row.field === "dateFrom" || row.field === "dateTo";
              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    gap: "var(--space-2, 8px)",
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginBottom: "var(--space-2, 8px)",
                  }}
                >
                  <Select
                    style={{ width: 150 }}
                    value={row.field}
                    aria-label={t("wD2.search.filter.field")}
                    options={FILTER_FIELDS.map((f) => ({
                      value: f,
                      label: t(FIELD_LABEL_KEY[f]),
                    }))}
                    onChange={(v) => changeField(row.id, v as FilterField)}
                  />
                  <Select
                    style={{ width: 120 }}
                    value={row.op}
                    aria-label={t("wD2.search.filter.operator")}
                    options={operatorsFor(row.field).map((op) => ({
                      value: op,
                      label: t(OP_LABEL_KEY[op]),
                    }))}
                    onChange={(v) => updateFilter(row.id, { op: v as FilterOperator })}
                  />
                  {options.length > 0 ? (
                    <Select
                      style={{ width: 190 }}
                      showSearch
                      allowClear
                      value={row.value || undefined}
                      placeholder={t("wD2.search.filter.valuePlaceholder")}
                      options={options}
                      onChange={(v) => updateFilter(row.id, { value: v ?? "" })}
                    />
                  ) : isDate ? (
                    <Input
                      type="date"
                      style={{ width: 170 }}
                      value={row.value}
                      aria-label={t("wD2.search.filter.value")}
                      onChange={(e) => updateFilter(row.id, { value: e.target.value })}
                    />
                  ) : (
                    <Input
                      allowClear
                      style={{ width: 200 }}
                      value={row.value}
                      aria-label={t("wD2.search.filter.value")}
                      placeholder={t("wD2.search.filter.valuePlaceholder")}
                      onChange={(e) => updateFilter(row.id, { value: e.target.value })}
                    />
                  )}
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={12} />}
                    aria-label={t("wD2.search.filter.remove")}
                    onClick={() => removeFilter(row.id)}
                  />
                </div>
              );
            })
          )}
        </Card>
      )}

      <Card
        size="small"
        title={
          <Space>
            <Target size={14} />
            {t("wD2.search.results.title")}
          </Space>
        }
        extra={
          result ? (
            <Tag>{t("wD2.search.source", { source: result.source })}</Tag>
          ) : undefined
        }
      >
        <DataTable<SearchHit>
          rowKey={(row) => row.reportId}
          loading={loading}
          dataSource={result?.items ?? []}
          emptyText={result ? t("wD2.search.results.empty") : t("wD2.search.results.pending")}
          scroll={{ x: "max-content" }}
          columnConfigKey="reportSearchV2"
          exportFileName="report-search-v2"
          columns={[
            {
              title: t("wD2.search.col.reportId"),
              dataIndex: "reportId",
              key: "reportId",
              width: 130,
              render: (v: string) => (
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v}</span>
              ),
            },
            {
              title: t("wD2.search.col.patient"),
              dataIndex: "patientName",
              key: "patientName",
              width: 170,
              render: (v: string, row: SearchHit) => (
                <span>
                  {v}{" "}
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.patientId}</span>
                  {row.isCritical && (
                    <Tag color={toneToAntd("critical")} style={{ marginInlineStart: 4 }}>
                      {t("wD2.search.tag.critical")}
                    </Tag>
                  )}
                </span>
              ),
            },
            {
              title: t("wD2.search.col.modality"),
              dataIndex: "modality",
              key: "modality",
              width: 100,
              render: (v: string) => <Tag>{v || "--"}</Tag>,
            },
            {
              title: t("wD2.search.col.findings"),
              dataIndex: "conclusion",
              key: "conclusion",
              width: 340,
              render: (v: string, row: SearchHit) => highlightText(v, row.matchedKeywords),
            },
            {
              title: t("wD2.search.col.date"),
              dataIndex: "examDate",
              key: "examDate",
              width: 120,
            },
            {
              title: t("wD2.search.col.score"),
              dataIndex: "relevance",
              key: "relevance",
              width: 100,
              align: "right",
              render: (v: number) => {
                const score = typeof v === "number" ? v : 0;
                return (
                  <span
                    style={{
                      color: statusColor(score >= 0.8 ? "success" : "neutral"),
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(score * 1000) / 10}%
                  </span>
                );
              },
            },
          ]}
        />
      </Card>

      {result && aggGroups.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <Sparkles size={14} />
              {t("wD2.search.agg.title")}
            </Space>
          }
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-2, 8px)" }}
          >
            {aggGroups.map((group) => (
              <div
                key={group.key}
                style={{
                  display: "flex",
                  gap: "var(--space-2, 8px)",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    minWidth: 88,
                  }}
                >
                  {group.label}
                </span>
                {group.items.length === 0 ? (
                  <Tag>--</Tag>
                ) : (
                  group.items.map((item) => (
                    <Tag key={`${group.key}-${item.key}`}>
                      {item.key} × {item.count}
                    </Tag>
                  ))
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}

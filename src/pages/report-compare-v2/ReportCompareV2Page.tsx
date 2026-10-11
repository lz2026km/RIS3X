// [G005 W-D2] 报告对比 V2 (/report-compare-v2)
// - 报告选择器 (GET /report-compare-v2/reports) + 预设组合 (GET /presets)
// - 对比 (POST /compare) → 并排 / 统一 diff + 关键字段表 + 统计卡片 (GET /stats)
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Segmented, Select, Space, Tag, message } from "antd";
import {
  Columns2,
  FileText,
  GitCompare,
  ListChecks,
  Percent,
  RefreshCw,
  RotateCcw,
  Rows3,
} from "lucide-react";
import {
  DataTable,
  PageContainer,
  PageHeader,
  StatCard,
  StatCardGrid,
} from "../../components/common";
import { t } from "../../i18n/appI18n";
import { severityTone, toneToAntd, type SeverityLevel } from "../../theme/statusTokens";
import {
  reportCompareV2Api,
  type ComparePreset,
  type CompareType,
  type CompareV2Stats,
  type DiffType,
  type KeyFieldComparison,
  type ReportCompareResult,
  type ReportSummary,
} from "../../services/api/reportCompareV2Api";

type ViewMode = "side" | "unified";

const TYPE_LABEL_KEY: Record<CompareType, string> = {
  "patient-history": "wD2.compare.type.patientHistory",
  "dual-read": "wD2.compare.type.dualRead",
  "doctor-ai": "wD2.compare.type.doctorAi",
};

const DIFF_LABEL_KEY: Record<DiffType, string> = {
  same: "wD2.compare.diff.type.same",
  modified: "wD2.compare.diff.type.modified",
  added: "wD2.compare.diff.type.added",
  removed: "wD2.compare.diff.type.removed",
};

function levelOf(type: DiffType): SeverityLevel {
  switch (type) {
    case "modified":
      return "warning";
    case "added":
      return "success";
    case "removed":
      return "critical";
    default:
      return "neutral";
  }
}

function splitLines(text: string | undefined): string[] {
  if (!text) return [];
  return text.split("\n").filter((line) => line.length > 0);
}

export default function ReportCompareV2Page() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [presets, setPresets] = useState<ComparePreset[]>([]);
  const [stats, setStats] = useState<CompareV2Stats | null>(null);

  const [reportAId, setReportAId] = useState<string | undefined>(undefined);
  const [reportBId, setReportBId] = useState<string | undefined>(undefined);
  const [presetId, setPresetId] = useState<string | undefined>(undefined);

  const [result, setResult] = useState<ReportCompareResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("side");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setListLoading(true);
    try {
      const [reportsRes, presetsRes, statsRes] = await Promise.all([
        reportCompareV2Api.listReports(),
        reportCompareV2Api.listPresets(),
        reportCompareV2Api.getStats(),
      ]);
      if (reportsRes.success && Array.isArray(reportsRes.data)) setReports(reportsRes.data);
      else setError(reportsRes.error?.message ?? t("wD2.compare.reportsError"));
      if (presetsRes.success && Array.isArray(presetsRes.data)) setPresets(presetsRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
    } catch {
      setError(t("wD2.compare.reportsError"));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const changePreset = useCallback(
    (id: string | undefined) => {
      setPresetId(id);
      const preset = presets.find((item) => item.id === id);
      if (preset) {
        setReportAId(preset.reportAId);
        setReportBId(preset.reportBId);
      }
    },
    [presets],
  );

  const runCompare = useCallback(async () => {
    if (!reportAId || !reportBId) {
      message.warning(t("wD2.compare.validate.needBoth"));
      return;
    }
    if (reportAId === reportBId) {
      message.warning(t("wD2.compare.validate.same"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const preset = presets.find((item) => item.id === presetId);
      const res = await reportCompareV2Api.compare({
        reportAId,
        reportBId,
        ...(preset ? { type: preset.type } : {}),
      });
      if (res.success && res.data) {
        setResult(res.data);
        message.success(t("wD2.compare.done"));
      } else {
        setError(res.error?.message ?? t("wD2.compare.error"));
      }
    } catch {
      setError(t("wD2.compare.error"));
    } finally {
      setLoading(false);
    }
  }, [reportAId, reportBId, presetId, presets]);

  const resetAll = useCallback(() => {
    setReportAId(undefined);
    setReportBId(undefined);
    setPresetId(undefined);
    setResult(null);
    setError(null);
  }, []);

  const reportOptions = reports.map((item) => ({
    value: item.id,
    label: `${item.patientName} · ${item.examDate} · ${item.modality} · ${item.id}`,
  }));
  const presetOptions = [
    { value: "", label: t("wD2.compare.presetCustom") },
    ...presets.map((item) => ({
      value: item.id,
      label: `${item.label} — ${item.description}`,
    })),
  ];

  const statsRow = result ? result.statistics : null;
  const reportA = reports.find((item) => item.id === reportAId);
  const reportB = reports.find((item) => item.id === reportBId);

  return (
    <PageContainer
      testId="report-compare-v2-page"
      padding="var(--space-4, 16px)"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}
    >
      <PageHeader
        title={t("wD2.compare.title")}
        subtitle={t("wD2.compare.subtitle")}
        icon={<GitCompare size={20} color="var(--color-primary-600)" />}
        actions={
          <Space wrap>
            <Tag color="blue">/report-compare-v2</Tag>
            <Button
              size="small"
              icon={<RefreshCw size={13} />}
              loading={listLoading}
              onClick={() => void loadLists()}
            >
              {t("wD2.compare.refresh")}
            </Button>
          </Space>
        }
        testId="report-compare-v2-header"
      />

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message={error}
          onClose={() => setError(null)}
          action={
            <Button size="small" onClick={() => void runCompare()}>
              {t("wD2.compare.run")}
            </Button>
          }
        />
      )}

      <StatCardGrid minWidth={180} gap={16}>
        <StatCard
          title={t("wD2.compare.stats.totalReports")}
          value={stats?.totalReports ?? reports.length}
          icon={<FileText size={14} />}
          color="primary"
          loading={listLoading}
          testId="report-compare-v2-stat-reports"
        />
        <StatCard
          title={t("wD2.compare.stats.presetCount")}
          value={stats?.presetCount ?? presets.length}
          icon={<ListChecks size={14} />}
          loading={listLoading}
          testId="report-compare-v2-stat-presets"
        />
        <StatCard
          title={t("wD2.compare.stats.avgSimilarity")}
          value={stats ? `${stats.avgSimilarity}%` : "--"}
          icon={<Percent size={14} />}
          color="info"
          loading={listLoading}
          testId="report-compare-v2-stat-similarity"
        />
      </StatCardGrid>

      {stats && (
        <div
          style={{
            display: "flex",
            gap: "var(--space-2, 8px)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("wD2.compare.stats.byType")}
          </span>
          <Tag>{t(TYPE_LABEL_KEY["patient-history"])} × {stats.byType["patient-history"]}</Tag>
          <Tag>{t(TYPE_LABEL_KEY["dual-read"])} × {stats.byType["dual-read"]}</Tag>
          <Tag>{t(TYPE_LABEL_KEY["doctor-ai"])} × {stats.byType["doctor-ai"]}</Tag>
        </div>
      )}

      <Card
        size="small"
        title={
          <Space>
            <GitCompare size={14} />
            {t("wD2.compare.picker.title")}
          </Space>
        }
        extra={
          <Space wrap>
            <Button size="small" icon={<RotateCcw size={13} />} onClick={resetAll}>
              {t("wD2.compare.reset")}
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<GitCompare size={13} />}
              loading={loading}
              onClick={() => void runCompare()}
              data-testid="report-compare-v2-run"
            >
              {t("wD2.compare.run")}
            </Button>
          </Space>
        }
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-3, 12px)",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("wD2.compare.reportA")}
            </span>
            <Select
              style={{ width: 320 }}
              showSearch
              allowClear
              loading={listLoading}
              value={reportAId}
              placeholder={t("wD2.compare.reportPlaceholder")}
              optionFilterProp="label"
              options={reportOptions}
              onChange={(v) => setReportAId(v as string | undefined)}
              aria-label={t("wD2.compare.reportA")}
              data-testid="report-compare-v2-report-a"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("wD2.compare.reportB")}
            </span>
            <Select
              style={{ width: 320 }}
              showSearch
              allowClear
              loading={listLoading}
              value={reportBId}
              placeholder={t("wD2.compare.reportPlaceholder")}
              optionFilterProp="label"
              options={reportOptions}
              onChange={(v) => setReportBId(v as string | undefined)}
              aria-label={t("wD2.compare.reportB")}
              data-testid="report-compare-v2-report-b"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("wD2.compare.preset")}
            </span>
            <Select
              style={{ width: 300 }}
              allowClear
              loading={listLoading}
              value={presetId ?? ""}
              placeholder={t("wD2.compare.presetPlaceholder")}
              options={presetOptions}
              onChange={(v) => changePreset(v ? (v as string) : undefined)}
              aria-label={t("wD2.compare.preset")}
              data-testid="report-compare-v2-preset"
            />
          </div>
        </div>
        {(reportA || reportB) && (
          <Space wrap style={{ marginTop: "var(--space-3, 12px)" }}>
            {reportA && (
              <Tag color="blue">
                {t("wD2.compare.reportA")}: {reportA.patientName} · {reportA.examDate} ·{" "}
                {reportA.modality} · {reportA.doctorName}
              </Tag>
            )}
            {reportB && (
              <Tag color="purple">
                {t("wD2.compare.reportB")}: {reportB.patientName} · {reportB.examDate} ·{" "}
                {reportB.modality} · {reportB.doctorName}
              </Tag>
            )}
          </Space>
        )}
      </Card>

      {statsRow && (
        <StatCardGrid minWidth={170} gap={16}>
          <StatCard
            title={t("wD2.compare.resStats.similarity")}
            value={`${statsRow.similarity}%`}
            color="success"
            icon={<Percent size={14} />}
            testId="report-compare-v2-stat-text-similarity"
          />
          <StatCard
            title={t("wD2.compare.resStats.changeRate")}
            value={`${statsRow.changeRate}%`}
            color="warning"
            testId="report-compare-v2-stat-change-rate"
          />
          <StatCard
            title={t("wD2.compare.resStats.totalLines")}
            value={statsRow.totalLines}
            testId="report-compare-v2-stat-lines"
          />
          <StatCard
            title={t("wD2.compare.resStats.keyFieldChanges")}
            value={statsRow.keyFieldChanges}
            color={statsRow.keyFieldChanges > 0 ? "error" : "success"}
            testId="report-compare-v2-stat-key-fields"
          />
        </StatCardGrid>
      )}

      <Card
        size="small"
        title={
          <Space>
            <Columns2 size={14} />
            {t("wD2.compare.results.title")}
          </Space>
        }
        extra={
          result ? (
            <Space wrap>
              <Segmented
                value={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
                options={[
                  {
                    label: (
                      <span>
                        <Columns2 size={13} /> {t("wD2.compare.view.sideBySide")}
                      </span>
                    ),
                    value: "side",
                  },
                  {
                    label: (
                      <span>
                        <Rows3 size={13} /> {t("wD2.compare.view.unified")}
                      </span>
                    ),
                    value: "unified",
                  },
                ]}
                data-testid="report-compare-v2-view"
              />
            </Space>
          ) : undefined
        }
      >
        {!result ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("wD2.compare.results.hint")}
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}
          >
            <Space wrap>
              <Tag color="geekblue">
                {t("wD2.compare.type")}: {t(TYPE_LABEL_KEY[result.type])}
              </Tag>
              <Tag>{result.reportA.id} → {result.reportB.id}</Tag>
              {result.deterministic && <Tag color="green">{t("wD2.compare.deterministic")}</Tag>}
              <Tag>
                {t("wD2.compare.generatedAt", {
                  time: new Date(result.generatedAt).toLocaleString(),
                })}
              </Tag>
            </Space>

            <Space wrap>
              <Tag color={toneToAntd(levelOf("modified"))}>
                {t("wD2.compare.resStats.modified")} {result.statistics.modified}
              </Tag>
              <Tag color={toneToAntd(levelOf("added"))}>
                {t("wD2.compare.resStats.added")} {result.statistics.added}
              </Tag>
              <Tag color={toneToAntd(levelOf("removed"))}>
                {t("wD2.compare.resStats.removed")} {result.statistics.removed}
              </Tag>
            </Space>

            {viewMode === "side" ? (
              result.sectionDiffs.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {t("wD2.compare.diff.empty")}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3, 12px)",
                  }}
                >
                  {result.sectionDiffs.map((section) => {
                    const oldLines = splitLines(section.original);
                    const newLines = splitLines(section.updated);
                    const rowCount = Math.max(oldLines.length, newLines.length);
                    return (
                      <Card
                        key={section.section}
                        size="small"
                        title={
                          <Space wrap>
                            <span>
                              {t("wD2.compare.diff.section")}: {section.label}
                            </span>
                            <Tag color={toneToAntd(levelOf(section.type))}>
                              {t(DIFF_LABEL_KEY[section.type])}
                            </Tag>
                          </Space>
                        }
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                            gap: "var(--space-3, 12px)",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted)",
                                marginBottom: "var(--space-1, 4px)",
                              }}
                            >
                              {t("wD2.compare.diff.original")}
                            </div>
                            {Array.from({ length: rowCount }).map((_, idx) => (
                              <div
                                key={`old-${idx}`}
                                style={{
                                  display: "flex",
                                  gap: "var(--space-2, 8px)",
                                  fontFamily: "monospace",
                                  fontSize: 12,
                                  padding: "var(--space-1, 4px)",
                                }}
                              >
                                <span style={{ color: "var(--text-muted)", minWidth: 44 }}>
                                  {t("wD2.compare.line.old")} {idx + 1}
                                </span>
                                <span>{oldLines[idx] ?? ""}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted)",
                                marginBottom: "var(--space-1, 4px)",
                              }}
                            >
                              {t("wD2.compare.diff.updated")}
                            </div>
                            {Array.from({ length: rowCount }).map((_, idx) => (
                              <div
                                key={`new-${idx}`}
                                style={{
                                  display: "flex",
                                  gap: "var(--space-2, 8px)",
                                  fontFamily: "monospace",
                                  fontSize: 12,
                                  padding: "var(--space-1, 4px)",
                                }}
                              >
                                <span style={{ color: "var(--text-muted)", minWidth: 44 }}>
                                  {t("wD2.compare.line.new")} {idx + 1}
                                </span>
                                <span>{newLines[idx] ?? ""}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1, 4px)",
                  maxHeight: 480,
                  overflow: "auto",
                }}
              >
                {result.lineDiffs.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {t("wD2.compare.diff.empty")}
                  </div>
                ) : (
                  result.lineDiffs.map((op, idx) => {
                    const tone = severityTone(levelOf(op.type));
                    const prefix =
                      op.type === "added"
                        ? "+"
                        : op.type === "removed"
                          ? "-"
                          : op.type === "modified"
                            ? "~"
                            : " ";
                    return (
                      <div
                        key={`${op.section}-${idx}`}
                        style={{
                          display: "flex",
                          gap: "var(--space-2, 8px)",
                          fontFamily: "monospace",
                          fontSize: 12,
                          padding: "var(--space-1, 4px)",
                          background: tone.bg,
                          borderLeft: `3px solid ${tone.border}`,
                        }}
                      >
                        <span style={{ color: tone.color, minWidth: 12 }}>{prefix}</span>
                        <span style={{ color: tone.color, flex: 1 }}>{op.line}</span>
                        <span style={{ color: "var(--text-muted)" }}>{op.sectionLabel}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: "var(--space-2, 8px)",
                }}
              >
                {t("wD2.compare.keyFields.title")}
              </div>
              <DataTable<KeyFieldComparison>
                rowKey={(row) => row.field}
                dataSource={result.keyFields}
                pagination={false}
                emptyText={t("wD2.compare.keyFields.empty")}
                exportFileName="report-compare-v2-key-fields"
                scroll={{ x: "max-content" }}
                columns={[
                  {
                    title: t("wD2.compare.keyFields.colField"),
                    dataIndex: "label",
                    key: "label",
                    width: 140,
                  },
                  {
                    title: t("wD2.compare.keyFields.colOriginal"),
                    dataIndex: "original",
                    key: "original",
                    width: 260,
                  },
                  {
                    title: t("wD2.compare.keyFields.colUpdated"),
                    dataIndex: "updated",
                    key: "updated",
                    width: 260,
                  },
                  {
                    title: t("wD2.compare.keyFields.colChange"),
                    dataIndex: "change",
                    key: "change",
                    width: 110,
                    render: (v: DiffType) => (
                      <Tag color={toneToAntd(levelOf(v))}>{t(DIFF_LABEL_KEY[v])}</Tag>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

// [G005 W4-AI] AI 模型注册表 / 市场 (概念 UI, 确定性模拟)
// 数据来源: src/services/ai/aiPlatformData.ts (seeded by id, 无 Math.random)
import React, { useCallback, useMemo, useState } from "react";
import {
  Card,
  Descriptions,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  Activity,
  Boxes,
  Cpu,
  GitCompare,
  Info,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  StopCircle,
  TrendingUp,
} from "lucide-react";
import {
  ActionButton,
  PageContainer,
  PageHeader,
  StatCard,
  StatCardGrid,
} from "../../components/common";
import { DataTable } from "../../components/common/DataTable";
import { t } from "../../i18n/appI18n";
import {
  AI_STATUS_KEYS,
  AI_VENDOR_KEYS,
  computeRegistryStats,
  getAiModelCatalog,
  type AiModelEntry,
  type AiModelMetrics,
  type AiModelStatus,
  type AiModelVersion,
  type AiVendorKey,
} from "../../services/ai/aiPlatformData";

const { Text } = Typography;

const STATUS_COLOR: Record<AiModelStatus, string> = {
  deployed: "green",
  gray: "gold",
  offline: "red",
};

const VENDOR_COLOR: Record<AiVendorKey, string> = {
  shukun: "geekblue",
  yizhun: "purple",
  inhouse: "cyan",
};

const STATUS_I18N: Record<AiModelStatus, string> = {
  deployed: "w4ai.status.deployed",
  gray: "w4ai.status.gray",
  offline: "w4ai.status.offline",
};

const VENDOR_I18N: Record<AiVendorKey, string> = {
  shukun: "w4ai.vendor.shukun",
  yizhun: "w4ai.vendor.yizhun",
  inhouse: "w4ai.vendor.inhouse",
};

const METRIC_ROWS: ReadonlyArray<{
  key: keyof AiModelMetrics;
  labelKey: string;
  kind: "percent" | "auc";
}> = [
  { key: "accuracy", labelKey: "w4ai.col.accuracy", kind: "percent" },
  { key: "sensitivity", labelKey: "w4ai.col.sensitivity", kind: "percent" },
  { key: "specificity", labelKey: "w4ai.col.specificity", kind: "percent" },
  { key: "approvalRate", labelKey: "w4ai.col.approvalRate", kind: "percent" },
  { key: "auc", labelKey: "w4ai.col.auc", kind: "auc" },
  { key: "consistency", labelKey: "w4ai.review.col.consistency", kind: "percent" },
];

function fmtMetric(value: number, kind: "percent" | "auc"): string {
  return kind === "auc" ? value.toFixed(3) : `${value.toFixed(1)}%`;
}

const MetricBar: React.FC<{ value: number; color?: string }> = ({
  value,
  color = "#2563eb",
}) => (
  <Space size={6} style={{ width: "100%" }}>
    <span style={{ width: 44, display: "inline-block", fontWeight: 600 }}>
      {value.toFixed(1)}%
    </span>
    <div style={{ width: 72 }}>
      <Progress
        percent={value}
        showInfo={false}
        size="small"
        strokeColor={color}
      />
    </div>
  </Space>
);

const AiModelRegistryPage: React.FC = () => {
  const [models, setModels] = useState<AiModelEntry[]>(() => getAiModelCatalog());
  const [keyword, setKeyword] = useState("");
  const [vendorFilter, setVendorFilter] = useState<"all" | AiVendorKey>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AiModelStatus>("all");
  const [modalityFilter, setModalityFilter] = useState<string>("all");

  const [compareModel, setCompareModel] = useState<AiModelEntry | null>(null);
  const [versionA, setVersionA] = useState<string>("");
  const [versionB, setVersionB] = useState<string>("");

  const [detailModel, setDetailModel] = useState<AiModelEntry | null>(null);

  const stats = useMemo(() => computeRegistryStats(models), [models]);

  const modalityOptions = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => m.modality.forEach((mo) => set.add(mo)));
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return models.filter((m) => {
      if (vendorFilter !== "all" && m.vendor !== vendorFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (modalityFilter !== "all" && !m.modality.includes(modalityFilter as never)) return false;
      if (!kw) return true;
      return (
        m.name.toLowerCase().includes(kw) ||
        m.nameEn.toLowerCase().includes(kw) ||
        m.indication.toLowerCase().includes(kw) ||
        m.id.toLowerCase().includes(kw)
      );
    });
  }, [models, keyword, vendorFilter, statusFilter, modalityFilter]);

  const patchModel = useCallback(
    (id: string, patch: Partial<AiModelEntry>) => {
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [],
  );

  const onDeploy = useCallback(
    (m: AiModelEntry) => {
      patchModel(m.id, { status: "deployed" });
      message.success(t("w4ai.msg.deployOk", { name: m.name, version: m.version }));
    },
    [patchModel],
  );

  const onGray = useCallback(
    (m: AiModelEntry) => {
      if (m.status === "offline") {
        message.warning(t("w4ai.msg.actionBlocked"));
        return;
      }
      patchModel(m.id, { status: "gray" });
      message.success(t("w4ai.msg.grayOk", { name: m.name }));
    },
    [patchModel],
  );

  const onOffline = useCallback(
    (m: AiModelEntry) => {
      patchModel(m.id, { status: "offline" });
      message.success(t("w4ai.msg.offlineOk", { name: m.name }));
    },
    [patchModel],
  );

  const onRollback = useCallback(
    (m: AiModelEntry) => {
      const target = m.versions[1];
      if (!target) {
        message.warning(t("w4ai.msg.actionBlocked"));
        return;
      }
      patchModel(m.id, { version: target.version, status: "deployed", metrics: target.metrics });
      message.success(t("w4ai.msg.rollbackOk", { name: m.name, version: target.version }));
    },
    [patchModel],
  );

  const openCompare = useCallback((m: AiModelEntry) => {
    setCompareModel(m);
    setVersionA(m.versions[0]?.version ?? "");
    setVersionB(m.versions[1]?.version ?? "");
  }, []);

  const resetFilters = useCallback(() => {
    setKeyword("");
    setVendorFilter("all");
    setStatusFilter("all");
    setModalityFilter("all");
  }, []);

  const columns: TableColumnsType<AiModelEntry> = useMemo(
    () => [
      {
        title: t("w4ai.col.name"),
        dataIndex: "name",
        key: "name",
        width: 210,
        fixed: "left",
        render: (_: unknown, r: AiModelEntry) => (
          <div>
            <Text strong>{r.name}</Text>
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>{r.nameEn}</div>
          </div>
        ),
      },
      {
        title: t("w4ai.col.indication"),
        dataIndex: "indication",
        key: "indication",
        width: 220,
        ellipsis: true,
      },
      {
        title: t("w4ai.col.modality"),
        dataIndex: "modality",
        key: "modality",
        width: 130,
        render: (mods: string[]) => (
          <Space size={[4, 4]} wrap>
            {mods.map((mo) => (
              <Tag key={mo} color="blue" style={{ marginInlineEnd: 0 }}>
                {mo}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: t("w4ai.col.vendor"),
        dataIndex: "vendor",
        key: "vendor",
        width: 90,
        render: (v: AiVendorKey) => <Tag color={VENDOR_COLOR[v]}>{t(VENDOR_I18N[v])}</Tag>,
      },
      { title: t("w4ai.col.version"), dataIndex: "version", key: "version", width: 90 },
      {
        title: t("w4ai.col.status"),
        dataIndex: "status",
        key: "status",
        width: 90,
        render: (s: AiModelStatus) => <Tag color={STATUS_COLOR[s]}>{t(STATUS_I18N[s])}</Tag>,
      },
      {
        title: t("w4ai.col.accuracy"),
        dataIndex: ["metrics", "accuracy"],
        key: "accuracy",
        width: 160,
        sorter: (a: AiModelEntry, b: AiModelEntry) =>
          a.metrics.accuracy - b.metrics.accuracy,
        render: (_: unknown, r: AiModelEntry) => <MetricBar value={r.metrics.accuracy} />,
      },
      {
        title: t("w4ai.col.sensitivity"),
        dataIndex: ["metrics", "sensitivity"],
        key: "sensitivity",
        width: 84,
        render: (_: unknown, r: AiModelEntry) => `${r.metrics.sensitivity.toFixed(1)}%`,
      },
      {
        title: t("w4ai.col.specificity"),
        dataIndex: ["metrics", "specificity"],
        key: "specificity",
        width: 84,
        render: (_: unknown, r: AiModelEntry) => `${r.metrics.specificity.toFixed(1)}%`,
      },
      {
        title: t("w4ai.col.approvalRate"),
        dataIndex: ["metrics", "approvalRate"],
        key: "approvalRate",
        width: 100,
        render: (_: unknown, r: AiModelEntry) => `${r.metrics.approvalRate.toFixed(1)}%`,
      },
      {
        title: t("w4ai.col.auc"),
        dataIndex: ["metrics", "auc"],
        key: "auc",
        width: 80,
        render: (_: unknown, r: AiModelEntry) => (
          <Text strong style={{ color: "#2563eb" }}>
            {r.metrics.auc.toFixed(3)}
          </Text>
        ),
      },
      {
        title: t("w4ai.col.updatedAt"),
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 100,
      },
      {
        title: t("w4ai.col.actions"),
        key: "actions",
        width: 360,
        fixed: "right",
        render: (_: unknown, r: AiModelEntry) => (
          <Space size={[6, 6]} wrap>
            {r.status !== "deployed" && (
              <ActionButton
                action="create"
                size="compact"
                icon={<Rocket size={13} />}
                onClick={() => onDeploy(r)}
                testId={`reg-deploy-${r.id}`}
              >
                {t("w4ai.act.deploy")}
              </ActionButton>
            )}
            {r.status === "deployed" && (
              <ActionButton
                action="edit"
                size="compact"
                onClick={() => onGray(r)}
                testId={`reg-gray-${r.id}`}
              >
                {t("w4ai.act.gray")}
              </ActionButton>
            )}
            {r.status !== "offline" && (
              <ActionButton
                action="delete"
                size="compact"
                icon={<StopCircle size={13} />}
                onClick={() => onOffline(r)}
                testId={`reg-offline-${r.id}`}
              >
                {t("w4ai.act.offline")}
              </ActionButton>
            )}
            <ActionButton
              action="refresh"
              size="compact"
              icon={<RotateCcw size={13} />}
              disabled={r.versions.length < 2}
              onClick={() => onRollback(r)}
              testId={`reg-rollback-${r.id}`}
            >
              {t("w4ai.act.rollback")}
            </ActionButton>
            <ActionButton
              action="refresh"
              size="compact"
              icon={<GitCompare size={13} />}
              onClick={() => openCompare(r)}
              testId={`reg-compare-${r.id}`}
            >
              {t("w4ai.act.compare")}
            </ActionButton>
            <ActionButton
              action="edit"
              size="compact"
              icon={<Info size={13} />}
              onClick={() => setDetailModel(r)}
              testId={`reg-detail-${r.id}`}
            >
              {t("w4ai.act.detail")}
            </ActionButton>
          </Space>
        ),
      },
    ],
    [onDeploy, onGray, onOffline, onRollback, openCompare],
  );

  const compareRows = useMemo(() => {
    if (!compareModel) return [];
    const a = compareModel.versions.find((v) => v.version === versionA);
    const b = compareModel.versions.find((v) => v.version === versionB);
    if (!a || !b) return [];
    return METRIC_ROWS.map((row) => ({
      key: row.key,
      label: t(row.labelKey),
      a: a.metrics[row.key],
      b: b.metrics[row.key],
      delta: b.metrics[row.key] - a.metrics[row.key],
      kind: row.kind,
    }));
  }, [compareModel, versionA, versionB]);

  const versionOptions = (v: AiModelVersion[]): { value: string; label: string }[] =>
    v.map((item, idx) => ({
      value: item.version,
      label: idx === 0 ? `${item.version} (${t("w4ai.compare.current")})` : item.version,
    }));

  return (
    <PageContainer testId="ai-model-registry">
      <PageHeader
        icon={<Boxes size={22} color="#2563eb" />}
        title={t("w4ai.reg.title")}
        subtitle={t("w4ai.reg.subtitle")}
        actions={
          <Space>
            <Tag color="purple" data-testid="reg-badge">
              {t("w4ai.badge")}
            </Tag>
            <ActionButton
              action="refresh"
              onClick={() => setModels(getAiModelCatalog())}
              testId="reg-refresh"
            >
              {t("w4ai.refresh")}
            </ActionButton>
          </Space>
        }
      />

      <StatCardGrid style={{ margin: "0 0 16px" }} minWidth={210}>
        <StatCard
          title={t("w4ai.reg.kpiTotal")}
          value={stats.total}
          icon={<Boxes size={18} />}
          color="primary"
          testId="reg-kpi-total"
        />
        <StatCard
          title={t("w4ai.reg.kpiDeployed")}
          value={stats.deployed}
          icon={<Rocket size={18} />}
          color="success"
          sub={`${t("w4ai.reg.grayCount")} ${stats.gray} · ${t("w4ai.reg.offlineCount")} ${stats.offline}`}
          testId="reg-kpi-deployed"
        />
        <StatCard
          title={t("w4ai.reg.kpiAvgAccuracy")}
          value={stats.avgAccuracy.toFixed(1)}
          suffix="%"
          icon={<Activity size={18} />}
          color="info"
          testId="reg-kpi-accuracy"
        />
        <StatCard
          title={t("w4ai.reg.kpiMonthlyCalls")}
          value={stats.monthlyCalls.toLocaleString("en-US")}
          icon={<TrendingUp size={18} />}
          color="warning"
          testId="reg-kpi-calls"
        />
      </StatCardGrid>

      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            style={{ width: 260 }}
            placeholder={t("w4ai.searchPlaceholder")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            data-testid="reg-search"
          />
          <Select
            style={{ width: 140 }}
            value={vendorFilter}
            onChange={setVendorFilter}
            aria-label={t("w4ai.reg.vendorFilter")}
            options={[
              { value: "all", label: `${t("w4ai.reg.vendorFilter")}: ${t("w4ai.all")}` },
              ...AI_VENDOR_KEYS.map((v) => ({ value: v, label: t(VENDOR_I18N[v]) })),
            ]}
          />
          <Select
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
            aria-label={t("w4ai.reg.statusFilter")}
            options={[
              { value: "all", label: `${t("w4ai.reg.statusFilter")}: ${t("w4ai.all")}` },
              ...AI_STATUS_KEYS.map((s) => ({ value: s, label: t(STATUS_I18N[s]) })),
            ]}
          />
          <Select
            style={{ width: 150 }}
            value={modalityFilter}
            onChange={setModalityFilter}
            aria-label={t("w4ai.reg.modalityFilter")}
            options={[
              { value: "all", label: `${t("w4ai.reg.modalityFilter")}: ${t("w4ai.all")}` },
              ...modalityOptions.map((mo) => ({ value: mo, label: mo })),
            ]}
          />
          <ActionButton
            action="refresh"
            icon={<RefreshCw size={14} />}
            onClick={resetFilters}
          >
            {t("w4ai.reset")}
          </ActionButton>
        </Space>

        <DataTable<AiModelEntry>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          showPagination={false}
          scroll={{ x: "max-content" }}
          emptyText={t("w4ai.empty")}
        />
      </Card>

      {/* 版本对比 */}
      <Modal
        open={compareModel !== null}
        title={t("w4ai.compare.title")}
        onCancel={() => setCompareModel(null)}
        footer={null}
        width={720}
      >
        {compareModel ? (
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Space wrap>
              <Text strong>{compareModel.name}</Text>
              <Tag color={STATUS_COLOR[compareModel.status]}>
                {t(STATUS_I18N[compareModel.status])}
              </Tag>
            </Space>
            <Space wrap>
              <span>{t("w4ai.compare.versionA")}:</span>
              <Select
                style={{ width: 200 }}
                value={versionA}
                onChange={setVersionA}
                options={versionOptions(compareModel.versions)}
              />
              <span>{t("w4ai.compare.versionB")}:</span>
              <Select
                style={{ width: 200 }}
                value={versionB}
                onChange={setVersionB}
                options={versionOptions(compareModel.versions)}
              />
            </Space>
            <DataTable
              rowKey="key"
              pagination={false}
              dataSource={compareRows}
              columns={[
                { title: t("w4ai.compare.metric"), dataIndex: "label", key: "label" },
                {
                  title: versionA || t("w4ai.compare.versionA"),
                  dataIndex: "a",
                  key: "a",
                  render: (v: number, r) => fmtMetric(v, r.kind),
                },
                {
                  title: versionB || t("w4ai.compare.versionB"),
                  dataIndex: "b",
                  key: "b",
                  render: (v: number, r) => fmtMetric(v, r.kind),
                },
                {
                  title: t("w4ai.compare.delta"),
                  dataIndex: "delta",
                  key: "delta",
                  render: (v: number, r) => {
                    const abs = r.kind === "auc" ? Math.abs(v).toFixed(3) : `${Math.abs(v).toFixed(1)}%`;
                    const color = v > 0 ? "#16a34a" : v < 0 ? "#dc2626" : "#8c8c8c";
                    return (
                      <span style={{ color, fontWeight: 600 }}>
                        {v > 0 ? "+" : v < 0 ? "-" : ""}
                        {abs}
                      </span>
                    );
                  },
                },
              ]}
            />
          </Space>
        ) : null}
      </Modal>

      {/* 模型详情 */}
      <Modal
        open={detailModel !== null}
        title={t("w4ai.detail.title")}
        onCancel={() => setDetailModel(null)}
        footer={null}
        width={760}
      >
        {detailModel ? (
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t("w4ai.col.name")} span={2}>
                {detailModel.name} · {detailModel.nameEn}
              </Descriptions.Item>
              <Descriptions.Item label={t("w4ai.col.indication")} span={2}>
                {detailModel.indication}
              </Descriptions.Item>
              <Descriptions.Item label={t("w4ai.col.vendor")}>
                <Tag color={VENDOR_COLOR[detailModel.vendor]}>
                  {t(VENDOR_I18N[detailModel.vendor])}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("w4ai.col.version")}>
                {detailModel.version}
              </Descriptions.Item>
              <Descriptions.Item label={t("w4ai.detail.trainingSet")} span={2}>
                {detailModel.trainingSet}
              </Descriptions.Item>
              <Descriptions.Item label={t("w4ai.detail.regulatory")} span={2}>
                <Space size={[8, 4]} wrap>
                  <Tag color={detailModel.regulatory.ce ? "green" : "default"}>
                    {t("w4ai.detail.ce")}
                    {detailModel.regulatory.ce ? ` ${detailModel.regulatory.ceClass}` : ""}
                  </Tag>
                  <Tag color={detailModel.regulatory.fda ? "green" : "default"}>
                    {t("w4ai.detail.fda")}
                  </Tag>
                  <Tag color={detailModel.regulatory.nmpa ? "green" : "default"}>
                    {t("w4ai.detail.nmpa")}
                  </Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t("w4ai.detail.validation")} span={2}>
                {detailModel.validationReport}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Space size={6} style={{ marginBottom: 8 }}>
                <ShieldCheck size={15} color="#2563eb" />
                <Text strong>{t("w4ai.detail.metrics")}</Text>
              </Space>
              <DataTable
                rowKey="key"
                pagination={false}
                dataSource={METRIC_ROWS.map((row) => ({
                  key: row.key,
                  label: t(row.labelKey),
                  value: fmtMetric(detailModel.metrics[row.key], row.kind),
                }))}
                columns={[
                  { title: t("w4ai.compare.metric"), dataIndex: "label", key: "label" },
                  { title: "", dataIndex: "value", key: "value", width: 200 },
                ]}
              />
            </div>

            <div>
              <Space size={6} style={{ marginBottom: 8 }}>
                <Cpu size={15} color="#2563eb" />
                <Text strong>{t("w4ai.detail.versionHistory")}</Text>
              </Space>
              <DataTable
                rowKey="version"
                pagination={false}
                dataSource={detailModel.versions}
                columns={[
                  { title: t("w4ai.col.version"), dataIndex: "version", key: "version", width: 90 },
                  {
                    title: t("w4ai.compare.releasedAt"),
                    dataIndex: "releasedAt",
                    key: "releasedAt",
                    width: 110,
                  },
                  {
                    title: t("w4ai.col.accuracy"),
                    key: "accuracy",
                    render: (_: unknown, r: AiModelVersion) => `${r.metrics.accuracy.toFixed(1)}%`,
                  },
                  {
                    title: t("w4ai.col.auc"),
                    key: "auc",
                    render: (_: unknown, r: AiModelVersion) => r.metrics.auc.toFixed(3),
                  },
                  { title: "", dataIndex: "note", key: "note" },
                ]}
              />
            </div>
          </Space>
        ) : null}
      </Modal>
    </PageContainer>
  );
};

export default AiModelRegistryPage;

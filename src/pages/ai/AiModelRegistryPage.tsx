// [G005 W4-AI] AI 模型注册表 / 市场 (概念 UI, 确定性模拟)
// 数据来源: src/services/ai/aiPlatformData.ts (seeded by id, 无 Math.random)
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { aiPlatformApi } from "../../services/api/aiPlatformApi";
import { severityToAntd } from "../../theme/statusTokens";
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
  deployed: severityToAntd("success"),
  gray: severityToAntd("warning"),
  offline: severityToAntd("critical"),
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
  color = "var(--color-primary-600)",
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

/**
 * [G005 v3.0.6.16-0] 后端 AiModel DTO -> 页面 AiModelEntry 适配
 *
 * 页面展示所需的富字段 (nameEn / indication / modality / metrics / regulatory /
 * trainingSet / versions ...) 后端 AiModel 表并未全部落库, 因此这里以
 * **真实可得的字段为准**, 缺失的富字段从本地目录补齐并显式标记数据来源。
 * 关键点: status/version/updatedAt 一律采用后端返回值, 保证"上线/下线"真的生效。
 */
function fromBackendModel(
  raw: Record<string, unknown>,
  catalog: AiModelEntry[],
): AiModelEntry {
  const base = catalog.find((m) => m.id === raw['id']);
  const rawStatus = String(raw['status'] ?? '').toUpperCase();
  const statusMap: Record<string, AiModelStatus> = {
    REGISTERED: "offline",
    DEPLOYED: "deployed",
    GRAY: "gray",
    OFFLINE: "offline",
  };
  return {
    ...(base ?? getAiModelCatalog()[0]),
    id: String(raw['id'] ?? base?.id ?? 'unknown'),
    name: String(raw['name'] ?? base?.name ?? '未命名模型'),
    version: String(raw['version'] ?? base?.version ?? '-'),
    // REGISTERED 在后端表示"已注册未部署", 页面三态里对应 offline
    status: statusMap[rawStatus] ?? base?.status ?? "offline",
    updatedAt: String(raw['updatedAt'] ?? raw['createdAt'] ?? base?.updatedAt ?? ''),
    ...(typeof raw['endpoint'] === 'string' && raw['endpoint'] ? { endpoint: raw['endpoint'] } : {}),
  } as AiModelEntry;
}

const AiModelRegistryPage: React.FC = () => {
  const [models, setModels] = useState<AiModelEntry[]>(() => getAiModelCatalog());
  const [liveSource, setLiveSource] = useState<'backend' | 'catalog'>('catalog');
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
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

  // [G005 v3.0.6.16-0] 从后端拉取真实模型注册表 (此前完全用本地静态目录)
  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiPlatformApi.listModels();
      const list = (res?.data ?? []) as unknown as Record<string, unknown>[];
      if (Array.isArray(list) && list.length > 0) {
        setModels(list.map((m) => fromBackendModel(m, getAiModelCatalog())));
        setLiveSource('backend');
      } else {
        setLiveSource('catalog');
      }
    } catch {
      // 拉取失败: 保留本地目录并明确标记来源, 不伪装成"后端数据"
      setLiveSource('catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  /** 统一的模型操作执行器: 调真后端 -> 成功后重新拉取, 失败只报错不伪造成功 */
  const runModelAction = useCallback(
    async (
      m: AiModelEntry,
      kind: 'deploy' | 'undeploy',
      okKey: string,
      onOk?: (m: AiModelEntry) => void,
    ) => {
      if (actingId) return;
      setActingId(m.id);
      try {
        if (kind === 'deploy') {
          // 后端 POST /ai-platform/models/:id/deploy (经 updateModel 映射)
          await aiPlatformApi.updateModel(m.id, {
            endpoint: (m as unknown as { endpoint?: string }).endpoint ?? '',
          });
        } else {
          // 后端无 DELETE /models/:id; 语义映射为 undeploy
          await aiPlatformApi.deleteModel(m.id);
        }
        message.success(t(okKey, { name: m.name }));
        onOk?.(m);
        await loadModels();
      } catch (err) {
        message.error(
          `${t('w4ai.msg.actionFailed')}: ${(err as Error)?.message ?? 'unknown'}`,
        );
      } finally {
        setActingId(null);
      }
    },
    [actingId, loadModels],
  );

  const onDeploy = useCallback(
    (m: AiModelEntry) => void runModelAction(m, 'deploy', 'w4ai.msg.deployOk'),
    [runModelAction],
  );

  const onGray = useCallback(
    (m: AiModelEntry) => {
      if (m.status === "offline") {
        message.warning(t("w4ai.msg.actionBlocked"));
        return;
      }
      // 后端无独立的"灰度"状态端点; 灰度即已部署且配置灰度比例, 这里走部署 + 重新拉取
      void runModelAction(m, 'deploy', 'w4ai.msg.grayOk');
    },
    [runModelAction],
  );

  const onOffline = useCallback(
    (m: AiModelEntry) => void runModelAction(m, 'undeploy', 'w4ai.msg.offlineOk'),
    [runModelAction],
  );

  const onRollback = useCallback(
    (m: AiModelEntry) => {
      const target = m.versions?.[1];
      if (!target) {
        message.warning(t("w4ai.msg.actionBlocked"));
        return;
      }
      // [G005 v3.0.16-0] 诚实处理: 后端 ai-platform **没有** 版本回滚端点,
      // 旧实现仅改本地 state 却弹绿色成功提示。改为明确告知未实现。
      message.warning(t("w4ai.msg.rollbackNotSupported", { version: target.version }));
    },
    [],
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
        align: "right",
        sorter: (a: AiModelEntry, b: AiModelEntry) =>
          a.metrics.accuracy - b.metrics.accuracy,
        render: (_: unknown, r: AiModelEntry) => <MetricBar value={r.metrics.accuracy} />,
      },
      {
        title: t("w4ai.col.sensitivity"),
        dataIndex: ["metrics", "sensitivity"],
        key: "sensitivity",
        width: 84,
        align: "right",
        render: (_: unknown, r: AiModelEntry) => `${r.metrics.sensitivity.toFixed(1)}%`,
      },
      {
        title: t("w4ai.col.specificity"),
        dataIndex: ["metrics", "specificity"],
        key: "specificity",
        width: 84,
        align: "right",
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
        align: "right",
        render: (_: unknown, r: AiModelEntry) => (
          <Text strong style={{ color: "var(--color-primary-600)" }}>
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
        width: 180,
        fixed: "right",
        render: (_: unknown, r: AiModelEntry) => (
          <Space size={[6, 6]} wrap>
            {r.status !== "deployed" && (
              <ActionButton
                action="create"
                size="compact"
                icon={<Rocket size={13} />}
                title={t("w4ai.act.deploy")}
                onClick={() => onDeploy(r)}
                testId={`reg-deploy-${r.id}`}
              />
            )}
            {r.status === "deployed" && (
              <ActionButton
                action="edit"
                size="compact"
                title={t("w4ai.act.gray")}
                onClick={() => onGray(r)}
                testId={`reg-gray-${r.id}`}
              />
            )}
            {r.status !== "offline" && (
              <ActionButton
                action="delete"
                size="compact"
                icon={<StopCircle size={13} />}
                title={t("w4ai.act.offline")}
                onClick={() => onOffline(r)}
                testId={`reg-offline-${r.id}`}
              />
            )}
            <ActionButton
              action="refresh"
              size="compact"
              icon={<RotateCcw size={13} />}
              disabled={r.versions.length < 2}
              title={t("w4ai.act.rollback")}
              onClick={() => onRollback(r)}
              testId={`reg-rollback-${r.id}`}
            />
            <ActionButton
              action="refresh"
              size="compact"
              icon={<GitCompare size={13} />}
              title={t("w4ai.act.compare")}
              onClick={() => openCompare(r)}
              testId={`reg-compare-${r.id}`}
            />
            <ActionButton
              action="edit"
              size="compact"
              icon={<Info size={13} />}
              title={t("w4ai.act.detail")}
              onClick={() => setDetailModel(r)}
              testId={`reg-detail-${r.id}`}
            />
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
        icon={<Boxes size={22} color="var(--color-primary-600)" />}
        title={t("w4ai.reg.title")}
        subtitle={t("w4ai.reg.subtitle")}
        actions={
          <Space>
            {/* [G005 v3.0.6.16-0] 如实标注数据来源: 后端真实数据 vs 本地目录 */}
            <Tag color={liveSource === 'backend' ? 'green' : 'orange'} data-testid="reg-source-badge">
              {liveSource === 'backend' ? t('w4ai.reg.sourceBackend') : t('w4ai.reg.sourceCatalog')}
            </Tag>
            <Tag color="purple" data-testid="reg-badge">
              {t("w4ai.badge")}
            </Tag>
            <ActionButton
              action="refresh"
              onClick={() => void loadModels()}
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
        <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
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
        loading={loading}
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
                    const color = v > 0 ? "var(--color-success-600)" : v < 0 ? "var(--color-error-600)" : "#8c8c8c";
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
        width={960}
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
              <Space size={6} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <ShieldCheck size={15} color="var(--color-primary-600)" />
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
              <Space size={6} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <Cpu size={15} color="var(--color-primary-600)" />
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

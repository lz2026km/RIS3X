import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { LungCadResult } from "../../services/api/lungCadApi";
import { radsApi } from "../../services/api/radsApi";
import type { RadsHistoryEntry, RadsScore } from "../../services/api/radsApi";
import RadsScoring from "../../components/ai/RadsScoring";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Tag,
  Space,
  Typography,
  Modal,
  Spin,
  Alert,
  message,
  Form,
  InputNumber,
  Select,
} from "antd";
import {
  Crosshair,
  CheckCircle,
  Activity,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Eye,
  Check,
  X,
  Sparkles,
  History,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { usePagination } from "../../hooks/usePagination";
import { t } from "../../i18n/appI18n";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const { Text } = Typography;

const riskColor: Record<string, string> = {
  low: "green",
  moderate: "orange",
  high: "red",
  very_high: "volcano",
};
const riskLabel: Record<string, string> = {
  low: "lungCad.risk.low",
  moderate: "lungCad.risk.moderate",
  high: "lungCad.risk.high",
  very_high: "lungCad.risk.veryHigh",
};

const LungCadPage: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<LungCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<LungCadResult | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  // [v3.0.6.11-95] W4-B P2: 受控分页 (检测结果表 / 结节明细表)
  const resultPagination = usePagination(results, 10);
  const nodulePagination = usePagination(selected?.nodules ?? [], 10);
  // [W-D7] Lung-RADS 评分 (POST /ai/cad/rads/lung) + 历史 (GET /ai/cad/rads/history/:patientId)
  const [radsOpen, setRadsOpen] = useState(false);
  const [radsTarget, setRadsTarget] = useState<LungCadResult | null>(null);
  const [radsLoading, setRadsLoading] = useState(false);
  const [radsResult, setRadsResult] = useState<RadsScore | null>(null);
  const [radsHistory, setRadsHistory] = useState<RadsHistoryEntry[]>([]);
  const [radsStats, setRadsStats] = useState<{ total: number; byType: Record<string, number> } | null>(null);
  const [radsForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiDiagnosisApi.listResults<LungCadResult>("lung-cad");
      if (res.success) {
        setResults(res.data ?? []);
      } else {
        setError(res.error?.message ?? t("lungCad.loadFailed"));
        setResults([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("lungCad.loadFailed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const modelVersion = results[0]?.modelVersion ?? "lungcad-v3.2.1";
      const res = await aiDiagnosisApi.retrainModel(modelVersion);
      if (res.success) {
        message.success(t("w9d.fracture.retrainSubmitted", { version: res.data?.modelVersion, status: res.data?.status }));
      } else {
        message.error(res.error?.message ?? t("lungCad.retrainFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("lungCad.retrainFailed"));
    } finally {
      setRetraining(false);
    }
  };

  const handleBatch = async (status: "confirmed" | "rejected") => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      const res = await aiDiagnosisApi.batchConfirm(
        selectedRowKeys.map(String),
        status,
        "lung-cad",
      );
      if (res.success) {
        message.success(status === "confirmed" ? t("w9d.lungCad.batchConfirmed", { count: selectedRowKeys.length }) : t("w9d.lungCad.batchRejected", { count: selectedRowKeys.length }));
        setSelectedRowKeys([]);
        await load();
      } else {
        message.error(res.error?.message ?? (status === "confirmed" ? t("w9d.lungCad.batchConfirmFailed") : t("w9d.lungCad.batchRejectFailed")));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? (status === "confirmed" ? t("w9d.lungCad.batchConfirmFailed") : t("w9d.lungCad.batchRejectFailed")));
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  // [W-D7] RADS 评分统计 (GET /ai/cad/rads/stats)
  useEffect(() => {
    radsApi
      .getStats()
      .then((res) => {
        if (res.success) setRadsStats(res.data);
      })
      .catch(() => {});
  }, []);

  // [W-D7] 打开 Lung-RADS 评分: 预填最大结节征象
  const openRads = (r: LungCadResult) => {
    setRadsTarget(r);
    setRadsResult(null);
    setRadsHistory([]);
    const nodules = r.nodules ?? [];
    const largest = nodules.reduce<(typeof nodules)[number] | null>(
      (best, n) => (!best || n.diameter > best.diameter ? n : best),
      null,
    );
    radsForm.setFieldsValue({
      noduleSizeMm: largest ? Math.round(largest.diameter) : 8,
      spiculatedMargin: false,
      solidComponent: largest ? largest.density === "solid" : true,
    });
    setRadsOpen(true);
  };

  // [W-D7] POST /ai/cad/rads/lung → Lung-RADS 分级
  const handleRadsScore = async () => {
    const valid = await radsForm.validateFields().catch(() => null);
    if (!valid) return;
    setRadsLoading(true);
    try {
      const res = await radsApi.scoreLung(valid as Record<string, unknown>);
      if (res.success && res.data) setRadsResult(res.data);
      else message.error(res.error?.message ?? t("aiRads.historyFail"));
    } catch (e) {
      message.error((e as Error)?.message ?? t("aiRads.historyFail"));
    } finally {
      setRadsLoading(false);
    }
  };

  // [W-D7] GET /ai/cad/rads/history/:patientId → 评分历史
  const handleRadsHistory = async () => {
    if (!radsTarget) return;
    setRadsLoading(true);
    try {
      const res = await radsApi.getHistory(radsTarget.patientName || radsTarget.studyId);
      if (res.success) setRadsHistory(res.data ?? []);
      else message.error(res.error?.message || t("aiRads.historyFail"));
    } finally {
      setRadsLoading(false);
    }
  };

  const columns = [
    { title: t("lungCad.colStudyId"), dataIndex: "studyId", key: "studyId" },
    { title: t("lungCad.colPatient"), dataIndex: "patientName", key: "patientName" },
    { title: t("lungCad.colModality"), dataIndex: "modality", key: "modality" },
    { title: t("lungCad.colNoduleCount"), dataIndex: "noduleCount", key: "noduleCount" },
    {
      title: t("lungCad.colOverallRisk"),
      dataIndex: "overallRisk",
      key: "overallRisk",
      render: (v?: string) => (v ? <Tag color={riskColor[v] ?? "default"}>{t(riskLabel[v] ?? v)}</Tag> : <span>-</span>),
    },
    {
      title: t("lungCad.colStatus"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag
          color={
            v === "confirmed" ? "green" : v === "reviewed" ? "blue" : "default"
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: t("lungCad.colAction"),
      key: "action",
      render: (_: unknown, r: LungCadResult) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<Crosshair size={14} />}
            onClick={() => {
              setSelected(r);
              setDetailOpen(true);
            }}
          >
            {t("lungCad.viewDetail")}
          </Button>
          <Button
            size="small"
            icon={<Eye size={14} />}
            data-testid={`goto-viewer-${r.id}`}
            onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(r.studyId)}&ai=1`)}
          >
            {t("lungCad.gotoViewer")}
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<Sparkles size={14} />}
            data-testid={`lung-rads-open-${r.id}`}
            onClick={() => openRads(r)}
          >
            {t("aiRads.startScoring")}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Crosshair size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("lungCad.title")}</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("lungCad.refresh")}
        </Button>
        <Button
          size="small"
          icon={<Cpu size={14} />}
          onClick={() => void handleRetrain()}
          loading={retraining}
        >
          {t("lungCad.retrainModel")}
        </Button>
        {selectedRowKeys.length > 0 && (
          <>
            <Button
              size="small"
              type="primary"
              icon={<Check size={14} />}
              loading={batchLoading}
              onClick={() => void handleBatch("confirmed")}
            >
              {t("lungCad.batchConfirm", { count: selectedRowKeys.length })}
            </Button>
            <Button
              size="small"
              danger
              icon={<X size={14} />}
              loading={batchLoading}
              onClick={() => void handleBatch("rejected")}
            >
              {t("lungCad.batchReject", { count: selectedRowKeys.length })}
            </Button>
          </>
        )}
      </Space>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard
          title={t("lungCad.statTotal")}
          value={results.length}
          icon={<Activity size={18} />}
          color="primary"
        />
        <StatCard
          title={t("lungCad.statHighRisk")}
          value={
            results.filter(
              (r) =>
                r.overallRisk === "high" || r.overallRisk === "very_high",
            ).length
          }
          icon={<AlertTriangle size={18} />}
          color="error"
        />
        <StatCard
          title={t("lungCad.statReviewed")}
          value={
            results.filter(
              (r) => r.status === "reviewed" || r.status === "confirmed",
            ).length
          }
          icon={<CheckCircle size={18} />}
          color="success"
        />
        <StatCard
          title={t("lungCad.statTotalNodules")}
          value={results.reduce((s, r) => s + (r.noduleCount ?? 0), 0)}
          icon={<Crosshair size={18} />}
          color="primary"
        />
        {/* [W-D7] RADS 评分统计 (GET /ai/cad/rads/stats) */}
        <StatCard
          title={t("aiRads.title")}
          value={radsStats?.total ?? 0}
          sub={`Lung-RADS: ${radsStats?.byType?.lung ?? 0}`}
          icon={<Sparkles size={18} />}
          color="info"
        />
      </StatCardGrid>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4, 16px)' }}
          title={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
              {t("lungCad.retry")}
            </Button>
          }
        />
      )}
      <Card>
        <Spin spinning={loading}>
          <DataTable
            rowKey="id"
            dataSource={resultPagination.pageData}
            columns={columns}
            pagination={resultPagination.pagination}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
      <Modal
        title={`${t("w9d.lungCad.detailTitle")} - ${selected?.patientName}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={960}
        footer={null}
      >
        {selected && (
          <>
            <DataTable
              rowKey="id"
              dataSource={nodulePagination.pageData}
              scroll={{ x: 'max-content' }}
              pagination={nodulePagination.pagination}
              columns={[
                {
                  title: t("lungCad.colLocation"),
                  dataIndex: "sliceLocation",
                  key: "sliceLocation",
                  render: (
                    _: unknown,
                    n: {
                      sliceLocation: number;
                      x: number;
                      y: number;
                      z: number;
                    },
                  ) => t("w9d.lungCad.sliceLocation", { slice: n.sliceLocation, x: n.x, y: n.y, z: n.z }),
                },
                { title: t("lungCad.colDiameter"), dataIndex: "diameter", key: "diameter" },
                { title: t("lungCad.colDensity"), dataIndex: "density", key: "density" },
                {
                  title: t("lungCad.colMalignancyRisk"),
                  dataIndex: "malignancyRisk",
                  key: "malignancyRisk",
                  render: (v: number) => `${(v * 100).toFixed(0)}%`,
                },
              ]}
            />
            <Card size="small" style={{ marginTop: 'var(--space-4, 16px)' }}>
              <Text strong>{t("lungCad.recommendationLabel")} </Text>
              <Text>{selected.recommendation}</Text>
            </Card>
          </>
        )}
      </Modal>
      {/* [W-D7] Lung-RADS 评分 (POST /ai/cad/rads/lung + GET history/stats) */}
      <Modal
        title={
          <Space>
            <Sparkles size={14} />
            <span>{t("aiRads.title")}</span>
            <Tag color="blue">Lung-RADS</Tag>
            {radsTarget && <Tag>{radsTarget.patientName}</Tag>}
          </Space>
        }
        open={radsOpen}
        onCancel={() => setRadsOpen(false)}
        width={860}
        footer={null}
        data-testid="lung-rads-modal"
      >
        {radsTarget && (
          <>
            <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Button
                type="primary"
                icon={<Sparkles size={14} />}
                loading={radsLoading}
                onClick={() => void handleRadsScore()}
                data-testid="lung-rads-score"
              >
                {t("aiRads.startScoring")}
              </Button>
              <Button
                icon={<History size={14} />}
                loading={radsLoading}
                onClick={() => void handleRadsHistory()}
                data-testid="lung-rads-history"
              >
                {t("aiRads.loadHistory")}
              </Button>
            </Space>
            <Form form={radsForm} layout="vertical">
              <Space wrap>
                <Form.Item name="noduleSizeMm" label={t("aiRads.f.noduleSize")} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <InputNumber min={1} max={50} style={{ width: 140 }} />
                </Form.Item>
                <Form.Item name="spiculatedMargin" label={t("aiRads.f.spiculatedMargin")} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <Select
                    style={{ width: 120 }}
                    options={[
                      { value: true, label: t("aiRads.opt.yes") },
                      { value: false, label: t("aiRads.opt.no") },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="solidComponent" label={t("aiRads.f.solidComponent")} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <Select
                    style={{ width: 120 }}
                    options={[
                      { value: true, label: t("aiRads.opt.yes") },
                      { value: false, label: t("aiRads.opt.no") },
                    ]}
                  />
                </Form.Item>
              </Space>
            </Form>
            <RadsScoring result={radsResult} history={radsHistory} loading={radsLoading} />
            {radsHistory.length > 0 && (
              <Card size="small" style={{ marginTop: 'var(--space-3, 12px)' }} title={t("historyTrend")}>
                <DataTable<RadsHistoryEntry>
                  rowKey={(r) => `${r.date}-${r.category}-${r.score}`}
                  dataSource={radsHistory}
                  pagination={{ pageSize: 5, showSizeChanger: false }}
                  columns={[
                    { title: t("common.table.date"), dataIndex: "date", key: "date", width: 110 },
                    {
                      title: t("common.table.type"),
                      dataIndex: "category",
                      key: "category",
                      width: 150,
                      render: (v: string) => <Tag>{v}</Tag>,
                    },
                    {
                      title: t("aiRads.col.level"),
                      dataIndex: "score",
                      key: "score",
                      width: 90,
                      render: (v: string) => <Tag color="blue">{v}</Tag>,
                    },
                    {
                      title: t("confidence"),
                      dataIndex: "confidence",
                      key: "confidence",
                      width: 100,
                      render: (v: number) => `${Math.round(v * 100)}%`,
                    },
                  ]}
                />
              </Card>
            )}
          </>
        )}
      </Modal>
    </PageContainer>
  );
};

export default LungCadPage;

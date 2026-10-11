import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { BreastCadResult } from "../../services/api/breastCadApi";
import { radsApi } from "../../services/api/radsApi";
import type { RadsHistoryEntry, RadsScore } from "../../services/api/radsApi";
import RadsScoring from "../../components/ai/RadsScoring";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Tag,
  Space,
  Spin,
  Alert,
  Button,
  message,
  Modal,
  Form,
  InputNumber,
  Select,
} from "antd";
import { Activity, RefreshCw, Cpu, Eye, Check, X, Sparkles, History } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { t } from "../../i18n/appI18n";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const biRadsColor: Record<string, string> = {
  "2": "green",
  "3": "blue",
  "4a": "orange",
  "4b": "volcano",
  "4c": "red",
  "5": "red",
};

// [W-D7] BI-RADS 评分征象选项 (POST /ai/cad/rads/breast)
const MASS_SHAPE_OPTIONS = ["round", "oval", "irregular"].map((v) => ({ value: v, label: v }));
const MASS_MARGIN_OPTIONS = ["circumscribed", "obscured", "spiculated", "microlobulated"].map((v) => ({
  value: v,
  label: v,
}));
const BI_RADS_OPTIONS = ["2", "3", "4a", "4b", "4c", "5"].map((v) => ({ value: v, label: `BI-RADS ${v}` }));

const BreastCadPage: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<BreastCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retraining, setRetraining] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  // [W-D7] BI-RADS 评分 (POST /ai/cad/rads/breast) + 历史 (GET /ai/cad/rads/history/:patientId)
  const [radsOpen, setRadsOpen] = useState(false);
  const [radsTarget, setRadsTarget] = useState<BreastCadResult | null>(null);
  const [radsLoading, setRadsLoading] = useState(false);
  const [radsResult, setRadsResult] = useState<RadsScore | null>(null);
  const [radsHistory, setRadsHistory] = useState<RadsHistoryEntry[]>([]);
  const [radsStats, setRadsStats] = useState<{ total: number; byType: Record<string, number> } | null>(null);
  const [radsForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiDiagnosisApi.listResults<BreastCadResult>("breast-cad");
      if (res.success) {
        setResults(res.data ?? []);
      } else {
        setError(res.error?.message ?? t("w9d.breast.loadFailed"));
        setResults([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("w9d.breast.loadFailed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const modelVersion = results[0]?.modelVersion ?? "breastcad-v2.8.0";
      const res = await aiDiagnosisApi.retrainModel(modelVersion);
      if (res.success) {
        message.success(t("w9d.breast.retrainSubmitted", { version: res.data?.modelVersion ?? "", status: res.data?.status ?? "" }));
      } else {
        message.error(res.error?.message ?? t("w9d.breast.retrainFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("w9d.breast.retrainFailed"));
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
        "breast-cad",
      );
      if (res.success) {
        message.success(t(status === "confirmed" ? "w9d.breast.batchConfirmed" : "w9d.breast.batchRejected", { count: selectedRowKeys.length }));
        setSelectedRowKeys([]);
        await load();
      } else {
        message.error(res.error?.message ?? t(status === "confirmed" ? "w9d.breast.batchConfirmFailed" : "w9d.breast.batchRejectFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t(status === "confirmed" ? "w9d.breast.batchConfirmFailed" : "w9d.breast.batchRejectFailed"));
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

  // [W-D7] 打开 BI-RADS 评分: 预填首个病灶征象
  const openRads = (r: BreastCadResult) => {
    setRadsTarget(r);
    setRadsResult(null);
    setRadsHistory([]);
    const lesions = r.lesions ?? [];
    const first = lesions[0];
    radsForm.setFieldsValue({
      massSizeMm: first ? Math.max(1, Math.round(first.width)) : 10,
      massShape: first?.shape ?? "irregular",
      massMargin: first?.margin ?? "spiculated",
      biradsCategory: BI_RADS_OPTIONS.some((o) => o.value === r.overallBiRads) ? r.overallBiRads : "3",
    });
    setRadsOpen(true);
  };

  // [W-D7] POST /ai/cad/rads/breast → BI-RADS 分级
  const handleRadsScore = async () => {
    const valid = await radsForm.validateFields().catch(() => null);
    if (!valid) return;
    setRadsLoading(true);
    try {
      const res = await radsApi.scoreBreast(valid as Record<string, unknown>);
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
    { title: t("w9d.breast.colStudyId"), dataIndex: "studyId", key: "studyId" },
    { title: t("w9d.breast.colPatient"), dataIndex: "patientName", key: "patientName" },
    { title: t("w9d.breast.colLesionCount"), dataIndex: "lesionCount", key: "lesionCount" },
    {
      title: "BI-RADS",
      dataIndex: "overallBiRads",
      key: "overallBiRads",
      render: (v: string) => <Tag color={biRadsColor[v]}>{`BI-RADS ${v}`}</Tag>,
    },
    {
      title: t("w9d.breast.colStatus"),
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
      title: t("w9d.breast.colAction"),
      key: "action",
      render: (_: unknown, r: BreastCadResult) => (
        <Space>
          <Button
            size="small"
            icon={<Eye size={14} />}
            data-testid={`goto-viewer-${r.id}`}
            onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(r.studyId)}&ai=1`)}
          >
            {t("w9d.breast.gotoViewer")}
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<Sparkles size={14} />}
            data-testid={`breast-rads-open-${r.id}`}
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
        <Activity size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("w9d.breast.title")}</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("w9d.breast.refresh")}
        </Button>
        <Button
          size="small"
          icon={<Cpu size={14} />}
          onClick={() => void handleRetrain()}
          loading={retraining}
        >
          {t("w9d.breast.retrain")}
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
              {t("w9d.breast.batchConfirm", { count: selectedRowKeys.length })}
            </Button>
            <Button
              size="small"
              danger
              icon={<X size={14} />}
              loading={batchLoading}
              onClick={() => void handleBatch("rejected")}
            >
              {t("w9d.breast.batchReject", { count: selectedRowKeys.length })}
            </Button>
          </>
        )}
      </Space>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t("w9d.breast.statTotal")} value={results.length} color="primary" icon={<Activity size={18} />} />
        <StatCard
          title="BI-RADS 4+"
          value={
            results.filter((r) =>
              ["4a", "4b", "4c", "5"].includes(r.overallBiRads),
            ).length
          }
          color="error"
        />
        <StatCard
          title={t("w9d.breast.statReviewed")}
          value={results.filter((r) => r.status !== "auto").length}
          color="success"
        />
        {/* [W-D7] RADS 评分统计 (GET /ai/cad/rads/stats) */}
        <StatCard
          title={t("aiRads.title")}
          value={radsStats?.total ?? 0}
          sub={`BI-RADS: ${radsStats?.byType?.breast ?? 0}`}
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
              {t("w9d.breast.retry")}
            </Button>
          }
        />
      )}
      <Card>
        <Spin spinning={loading}>
          <DataTable
            rowKey="id"
            dataSource={results}
            columns={columns}
            pagination={false}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
      {/* [W-D7] BI-RADS 评分 (POST /ai/cad/rads/breast + GET history/stats) */}
      <Modal
        title={
          <Space>
            <Sparkles size={14} />
            <span>{t("aiRads.title")}</span>
            <Tag color="purple">BI-RADS</Tag>
            {radsTarget && <Tag>{radsTarget.patientName}</Tag>}
          </Space>
        }
        open={radsOpen}
        onCancel={() => setRadsOpen(false)}
        width={860}
        footer={null}
        data-testid="breast-rads-modal"
      >
        {radsTarget && (
          <>
            <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Button
                type="primary"
                icon={<Sparkles size={14} />}
                loading={radsLoading}
                onClick={() => void handleRadsScore()}
                data-testid="breast-rads-score"
              >
                {t("aiRads.startScoring")}
              </Button>
              <Button
                icon={<History size={14} />}
                loading={radsLoading}
                onClick={() => void handleRadsHistory()}
                data-testid="breast-rads-history"
              >
                {t("aiRads.loadHistory")}
              </Button>
            </Space>
            <Form form={radsForm} layout="vertical">
              <Space wrap>
                <Form.Item name="massSizeMm" label={t("aiRads.f.lesionSize")} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <InputNumber min={1} max={100} style={{ width: 140 }} />
                </Form.Item>
                <Form.Item name="massShape" label={t("aiRads.f.shape")} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <Select style={{ width: 150 }} options={MASS_SHAPE_OPTIONS} />
                </Form.Item>
                <Form.Item name="massMargin" label={t("aiRads.f.margins")} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <Select style={{ width: 170 }} options={MASS_MARGIN_OPTIONS} />
                </Form.Item>
                <Form.Item name="biradsCategory" label={t("aiRads.col.level")} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <Select style={{ width: 140 }} options={BI_RADS_OPTIONS} />
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

export default BreastCadPage;

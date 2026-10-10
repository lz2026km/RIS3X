import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { LungCadResult } from "../../services/api/lungCadApi";
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
    </PageContainer>
  );
};

export default LungCadPage;

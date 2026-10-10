import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { CardiacAiResult } from "../../services/api/cardiacAiApi";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Tag,
  Space,
  Spin,
  Alert,
  Button,
  message,
} from "antd";
import { HeartPulse, RefreshCw, Cpu, Eye, Check, X } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { t } from "../../i18n/appI18n";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const cadRadsColor: Record<string, string> = {
  "0": "green",
  "1": "green",
  "2": "blue",
  "3": "orange",
  "4": "red",
  "5": "volcano",
};

const CardiacAiPage: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<CardiacAiResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retraining, setRetraining] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiDiagnosisApi.listResults<CardiacAiResult>("cardiac-ai");
      if (res.success) {
        setResults(res.data ?? []);
      } else {
        setError(res.error?.message ?? t("w9d.cardiac.loadFailed"));
        setResults([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("w9d.cardiac.loadFailed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const modelVersion = results[0]?.modelVersion ?? "cardiacai-v2.4.1";
      const res = await aiDiagnosisApi.retrainModel(modelVersion);
      if (res.success) {
        message.success(t("w9d.cardiac.retrainSubmitted", { version: res.data?.modelVersion ?? "", status: res.data?.status ?? "" }));
      } else {
        message.error(res.error?.message ?? t("w9d.cardiac.retrainFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("w9d.cardiac.retrainFailed"));
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
        "cardiac-ai",
      );
      if (res.success) {
        message.success(t(status === "confirmed" ? "w9d.cardiac.batchConfirmed" : "w9d.cardiac.batchRejected", { count: selectedRowKeys.length }));
        setSelectedRowKeys([]);
        await load();
      } else {
        message.error(res.error?.message ?? t(status === "confirmed" ? "w9d.cardiac.batchConfirmFailed" : "w9d.cardiac.batchRejectFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t(status === "confirmed" ? "w9d.cardiac.batchConfirmFailed" : "w9d.cardiac.batchRejectFailed"));
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const avgEf =
    results.filter((r) => r.ejectionFraction != null).length > 0
      ? results
          .filter((r) => r.ejectionFraction != null)
          .reduce((s, r) => s + (r.ejectionFraction ?? 0), 0) /
        results.filter((r) => r.ejectionFraction != null).length
      : 0;

  const columns = [
    { title: t("w9d.cardiac.colStudyId"), dataIndex: "studyId", key: "studyId" },
    { title: t("w9d.cardiac.colPatient"), dataIndex: "patientName", key: "patientName" },
    {
      title: "EF(%)",
      dataIndex: "ejectionFraction",
      key: "ef",
      render: (v?: number) => (v != null ? `${v}%` : "-"),
    },
    {
      title: "CAD-RADS",
      dataIndex: "cadRads",
      key: "cadRads",
      render: (v?: string) =>
        v != null ? <Tag color={cadRadsColor[v]}>{`CAD-RADS ${v}`}</Tag> : "-",
    },
    {
      title: t("w9d.cardiac.colStenosisCount"),
      key: "stenosisCount",
      render: (_: unknown, r: CardiacAiResult) => r.stenosis?.length ?? 0,
    },
    {
      title: t("w9d.cardiac.colStatus"),
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
      title: t("w9d.cardiac.colAction"),
      key: "action",
      render: (_: unknown, r: CardiacAiResult) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          data-testid={`goto-viewer-${r.id}`}
          onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(r.studyId)}&ai=1`)}
        >
          {t("w9d.cardiac.gotoViewer")}
        </Button>
      ),
    },
  ];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <HeartPulse size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("w9d.cardiac.title")}</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("w9d.cardiac.refresh")}
        </Button>
        <Button
          size="small"
          icon={<Cpu size={14} />}
          onClick={() => void handleRetrain()}
          loading={retraining}
        >
          {t("w9d.cardiac.retrain")}
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
              {t("w9d.cardiac.batchConfirm", { count: selectedRowKeys.length })}
            </Button>
            <Button
              size="small"
              danger
              icon={<X size={14} />}
              loading={batchLoading}
              onClick={() => void handleBatch("rejected")}
            >
              {t("w9d.cardiac.batchReject", { count: selectedRowKeys.length })}
            </Button>
          </>
        )}
      </Space>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t("w9d.cardiac.statTotal")} value={results.length} color="primary" icon={<HeartPulse size={18} />} />
        <StatCard
          title="CAD-RADS 3+"
          value={
            results.filter(
              (r) => r.cadRads && ["3", "4", "5"].includes(r.cadRads),
            ).length
          }
          color="error"
        />
        <StatCard title={t("w9d.cardiac.statAvgEf")} value={`${avgEf.toFixed(1)}%`} color="success" />
      </StatCardGrid>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4, 16px)' }}
          title={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
              {t("w9d.cardiac.retry")}
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
    </PageContainer>
  );
};

export default CardiacAiPage;

import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { BreastCadResult } from "../../services/api/breastCadApi";
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
import { Activity, RefreshCw, Cpu, Eye, Check, X } from "lucide-react";
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

const BreastCadPage: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<BreastCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retraining, setRetraining] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

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
        <Button
          size="small"
          icon={<Eye size={14} />}
          data-testid={`goto-viewer-${r.id}`}
          onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(r.studyId)}&ai=1`)}
        >
          {t("w9d.breast.gotoViewer")}
        </Button>
      ),
    },
  ];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#2563eb" />
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
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
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
      </StatCardGrid>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
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
    </PageContainer>
  );
};

export default BreastCadPage;

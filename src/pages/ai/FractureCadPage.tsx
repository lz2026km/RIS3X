import { aiDiagnosisApi } from "../../services/api/aiDiagnosisApi";
import type { FractureCadResult } from "../../services/api/fractureCadApi";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Spin,
  Alert,
  Button,
  message,
} from "antd";
import { Activity, RefreshCw, Cpu, Eye, Check, X } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { t } from "../../i18n/appI18n";

const severityColor: Record<string, string> = {
  mild: "green",
  moderate: "orange",
  severe: "red",
};

const FractureCadPage: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<FractureCadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retraining, setRetraining] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await aiDiagnosisApi.listResults<FractureCadResult>("fracture-cad");
      if (res.success) {
        setResults(res.data ?? []);
      } else {
        setError(res.error?.message ?? t("w9d.fracture.loadFailed"));
        setResults([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("w9d.fracture.loadFailed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const modelVersion = results[0]?.modelVersion ?? "fracturecad-v1.9.3";
      const res = await aiDiagnosisApi.retrainModel(modelVersion);
      if (res.success) {
        message.success(t("w9d.fracture.retrainSubmitted", { version: res.data?.modelVersion ?? "", status: res.data?.status ?? "" }));
      } else {
        message.error(res.error?.message ?? t("w9d.fracture.retrainFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("w9d.fracture.retrainFailed"));
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
        "fracture-cad",
      );
      if (res.success) {
        message.success(t(status === "confirmed" ? "w9d.fracture.batchConfirmed" : "w9d.fracture.batchRejected", { count: selectedRowKeys.length }));
        setSelectedRowKeys([]);
        await load();
      } else {
        message.error(res.error?.message ?? t(status === "confirmed" ? "w9d.fracture.batchConfirmFailed" : "w9d.fracture.batchRejectFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t(status === "confirmed" ? "w9d.fracture.batchConfirmFailed" : "w9d.fracture.batchRejectFailed"));
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const columns = [
    { title: t("w9d.fracture.colStudyId"), dataIndex: "studyId", key: "studyId" },
    { title: t("w9d.fracture.colPatient"), dataIndex: "patientName", key: "patientName" },
    { title: t("w9d.fracture.colBodyPart"), dataIndex: "bodyPart", key: "bodyPart" },
    { title: t("w9d.fracture.colFractureCount"), dataIndex: "fractureCount", key: "fractureCount" },
    {
      title: t("w9d.fracture.colSeverity"),
      dataIndex: "severity",
      key: "severity",
      render: (v: string) => <Tag color={severityColor[v]}>{t(`w9d.fracture.severity.${v}`)}</Tag>,
    },
    {
      title: t("w9d.fracture.colStatus"),
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
      title: t("w9d.fracture.colAction"),
      key: "action",
      render: (_: unknown, r: FractureCadResult) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          data-testid={`goto-viewer-${r.id}`}
          onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(r.studyId)}&ai=1`)}
        >
          {t("w9d.fracture.gotoViewer")}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("w9d.fracture.title")}</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("w9d.fracture.refresh")}
        </Button>
        <Button
          size="small"
          icon={<Cpu size={14} />}
          onClick={() => void handleRetrain()}
          loading={retraining}
        >
          {t("w9d.fracture.retrain")}
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
              {t("w9d.fracture.batchConfirm", { count: selectedRowKeys.length })}
            </Button>
            <Button
              size="small"
              danger
              icon={<X size={14} />}
              loading={batchLoading}
              onClick={() => void handleBatch("rejected")}
            >
              {t("w9d.fracture.batchReject", { count: selectedRowKeys.length })}
            </Button>
          </>
        )}
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t("w9d.fracture.statTotal")} value={results.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("w9d.fracture.statSevere")}
              value={results.filter((r) => r.severity === "severe").length}
              styles={{ content: {  color: "#ff4d4f"  } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("w9d.fracture.statReviewed")}
              value={results.filter((r) => r.status !== "auto").length}
            />
          </Card>
        </Col>
      </Row>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
              {t("w9d.fracture.retry")}
            </Button>
          }
        />
      )}
      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={results}
            columns={columns}
            pagination={false}
            size="small"
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default FractureCadPage;

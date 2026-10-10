import { stowRsApi } from "../../services/api/stowRsApi";
import { StowRsStoredInstance } from '../../services/api/stowRsApi'
import {
  Card,
  Tag,
  Space,
  Button,
  Upload,
  message,
  Spin,
  Alert,
  Typography,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { UploadCloud, CheckCircle, Database, RefreshCw } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { t } from "../../i18n/appI18n";

const { Text } = Typography;

const StowRsPage: React.FC = () => {
  const [instances, setInstances] = useState<StowRsStoredInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await stowRsApi.listStored();
      if (res.success) {
        setInstances(res.data ?? []);
      } else {
        setError(res.error?.message ?? t("w9d.stowRs.loadFailed"));
        setInstances([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("w9d.stowRs.loadFailed"));
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await stowRsApi.storeInstances({ formData });
      if (res.success) {
        const count = res.data?.receivedInstanceCount ?? 1;
        message.success(t("w9d.stowRs.stored", { count }));
        void load();
      } else {
        message.error(res.error?.message ?? t("w9d.stowRs.uploadFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("w9d.stowRs.uploadFailed"));
    } finally {
      setUploading(false);
    }
    return false;
  };

  const columns = [
    {
      title: t("w9d.stowRs.colStudyUid"),
      dataIndex: "studyInstanceUid",
      key: "uid",
      render: (v: string) => (
        <Text copyable style={{ fontSize: 11, fontFamily: "monospace" }}>
          {v}
        </Text>
      ),
    },
    { title: t("w9d.stowRs.colPatient"), dataIndex: "patientName", key: "patientName" },
    { title: t("w9d.stowRs.colPatientId"), dataIndex: "patientId", key: "patientId" },
    {
      title: t("w9d.stowRs.colModality"),
      dataIndex: "modality",
      key: "modality",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: t("w9d.stowRs.colDate"), dataIndex: "studyDate", key: "studyDate" },
    {
      title: t("w9d.stowRs.colReceivedAt"),
      dataIndex: "receivedAt",
      key: "receivedAt",
      render: (v: string) => (v ? new Date(v).toLocaleString() : "-"),
    },
  ];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <UploadCloud size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("w9d.stowRs.title")}</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("w9d.stowRs.refresh")}
        </Button>
      </Space>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard
          title={t("w9d.stowRs.statStored")}
          value={instances.length}
          icon={<Database size={16} />}
        />
        <StatCard
          title={t("w9d.stowRs.statSuccess")}
          value={instances.length}
          icon={<CheckCircle size={16} />}
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
              {t("w9d.stowRs.retry")}
            </Button>
          }
        />
      )}
      <Card
        extra={
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept=".dcm,.dicom"
          >
            <Button
              type="primary"
              icon={<UploadCloud size={14} />}
              loading={uploading}
            >
              {t("w9d.stowRs.uploadDicom")}
            </Button>
          </Upload>
        }
      >
        <Spin spinning={loading}>
          <DataTable
            rowKey="id"
            dataSource={instances}
            columns={columns}
            pagination={false}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
    </PageContainer>
  );
};

export default StowRsPage;

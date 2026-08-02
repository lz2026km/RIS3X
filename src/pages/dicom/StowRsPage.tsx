import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Button,
  Upload,
  message,
  Spin,
  Alert,
  Typography,
} from "antd";
import { UploadCloud, CheckCircle, Database, RefreshCw } from "lucide-react";
import { stowRsApi } from "../../services/api/stowRsApi";
import type { StowRsStoredInstance } from "../../services/api/stowRsApi";

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
        setError(res.error?.message ?? "加载失败");
        setInstances([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
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
        message.success(`已存储 ${count} 个实例`);
        void load();
      } else {
        message.error(res.error?.message ?? "上传失败");
      }
    } catch (e) {
      message.error((e as Error)?.message ?? "上传失败");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const columns = [
    {
      title: "Study UID",
      dataIndex: "studyInstanceUid",
      key: "uid",
      render: (v: string) => (
        <Text copyable style={{ fontSize: 11, fontFamily: "monospace" }}>
          {v}
        </Text>
      ),
    },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "编号", dataIndex: "patientId", key: "patientId" },
    {
      title: "模态",
      dataIndex: "modality",
      key: "modality",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: "日期", dataIndex: "studyDate", key: "studyDate" },
    {
      title: "接收时间",
      dataIndex: "receivedAt",
      key: "receivedAt",
      render: (v: string) => (v ? new Date(v).toLocaleString() : "-"),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <UploadCloud size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>STOW-RS 存储</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          刷新
        </Button>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="已存储实例"
              value={instances.length}
              prefix={<Database size={16} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="成功存储"
              value={instances.length}
              prefix={<CheckCircle size={16} />}
              styles={{ content: {  color: "#52c41a"  } }}
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
          action={
            <Button size="small" onClick={() => void load()}>
              重试
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
              上传 DICOM
            </Button>
          </Upload>
        }
      >
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={instances}
            columns={columns}
            pagination={false}
            size="small"
          />
        </Spin>
      </Card>
    </div>
  );
};

export default StowRsPage;

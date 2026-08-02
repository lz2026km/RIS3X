import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  Select,
  Button,
  Progress,
  Table,
  Statistic,
  Row,
  Col,
  Typography,
  Space,
  Divider,
  Alert,
  Spin,
  Tag,
  Empty,
} from "antd";
import {
  CompressOutlined,
  ExpandOutlined,
  BarChartOutlined,
  FileOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

interface TransferSyntax {
  uid: string;
  name: string;
  lossy: boolean;
}

interface CompressTask {
  id: string;
  fileId: string;
  transferSyntax: string;
  status: "pending" | "processing" | "done" | "failed";
  progress: number;
  originalSize: number;
  compressedSize: number | null;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface CompressRatio {
  instanceId: string;
  sopClass: string;
  sopClassName: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  transferSyntax: string;
}

const API_BASE = "/api/v1/dicom/compress";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export default function DicomCompressPage() {
  const { t } = useTranslation("dicomCompress");

  const [syntaxes, setSyntaxes] = useState<TransferSyntax[]>([]);
  const [selectedSyntax, setSelectedSyntax] = useState<string>("");
  const [fileId, setFileId] = useState("sample-dicom-001");
  const [task, setTask] = useState<CompressTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [ratioData, setRatioData] = useState<CompressRatio[]>([]);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/syntaxes`)
      .then((r) => r.json())
      .then((data) => {
        setSyntaxes(data);
        if (data.length > 0) setSelectedSyntax(data[0].uid);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
    fetchRatioData();
  }, []);

  const fetchRatioData = useCallback(() => {
    const ids = ["inst-001", "inst-002", "inst-003", "inst-004", "inst-005"];
    Promise.all(
      ids.map((id) =>
        fetch(`${API_BASE}/ratio/${id}`).then(
          (r) => r.json() as Promise<CompressRatio>,
        ),
      ),
    )
      .then(setRatioData)
      .catch((err) => {
        console.error("[F04]", err);
      });
  }, []);

  const startPolling = useCallback(
    (taskId: string) => {
      setPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/status/${taskId}`);
          const data: CompressTask = await res.json();
          setTask(data);
          if (data.status === "done" || data.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setPolling(false);
            fetchRatioData();
          }
        } catch (err) {
          console.warn("[DicomCompress] status polling failed", err);
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
        }
      }, 800);
    },
    [fetchRatioData],
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCompress = async () => {
    setLoading(true);
    setTask(null);
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, transferSyntax: selectedSyntax }),
      });
      const data: CompressTask = await res.json();
      setTask(data);
      startPolling(data.id);
    } catch (err) {
      console.warn("[DicomCompress] handleCompress failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecompress = async () => {
    setLoading(true);
    setTask(null);
    try {
      const res = await fetch(`${API_BASE}/decompress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data: CompressTask = await res.json();
      setTask(data);
    } catch (err) {
      console.warn("[DicomCompress] handleDecompress failed", err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t("table.instanceId"),
      dataIndex: "instanceId",
      key: "instanceId",
    },
    {
      title: t("table.sopClass"),
      dataIndex: "sopClassName",
      key: "sopClass",
    },
    {
      title: t("table.originalSize"),
      dataIndex: "originalSize",
      key: "originalSize",
      render: (v: number) => formatBytes(v),
    },
    {
      title: t("table.compressedSize"),
      dataIndex: "compressedSize",
      key: "compressedSize",
      render: (v: number) => formatBytes(v),
    },
    {
      title: t("table.ratio"),
      dataIndex: "ratio",
      key: "ratio",
      render: (v: number) => (
        <Tag color={v < 30 ? "green" : v < 50 ? "orange" : "red"}>{v}%</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>
        <CompressOutlined style={{ marginRight: 8 }} />
        {t("title")}
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title={t("card.compress.title")} variant="outlined">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text strong>{t("card.compress.fileId")}</Text>
                <Select
                  style={{ width: "100%", marginTop: 4 }}
                  value={fileId}
                  onChange={setFileId}
                  options={[
                    {
                      value: "sample-dicom-001",
                      label: "sample-dicom-001.dcm",
                    },
                    {
                      value: "sample-dicom-002",
                      label: "sample-dicom-002.dcm",
                    },
                    {
                      value: "sample-dicom-003",
                      label: "sample-dicom-003.dcm",
                    },
                  ]}
                />
              </div>
              <div>
                <Text strong>{t("card.compress.syntax")}</Text>
                <Select
                  style={{ width: "100%", marginTop: 4 }}
                  value={selectedSyntax}
                  onChange={setSelectedSyntax}
                  options={syntaxes.map((s) => ({
                    value: s.uid,
                    label: `${s.name} (${s.lossy ? t("card.compress.lossy") : t("card.compress.lossless")})`,
                  }))}
                />
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<CompressOutlined />}
                  loading={loading}
                  onClick={handleCompress}
                >
                  {t("card.compress.compressBtn")}
                </Button>
                <Button
                  icon={<ExpandOutlined />}
                  loading={loading}
                  onClick={handleDecompress}
                >
                  {t("card.compress.decompressBtn")}
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title={t("card.progress.title")} variant="outlined">
            {task ? (
              <div>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title={t("card.progress.taskId")}
                      value={task.id}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={t("card.progress.status")}
                      value={task.status}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={t("card.progress.originalSize")}
                      value={formatBytes(task.originalSize)}
                    />
                  </Col>
                </Row>
                {task.status === "processing" || task.status === "pending" ? (
                  <div style={{ marginTop: 16 }}>
                    <Text>{t("card.progress.compressing")}</Text>
                    <Progress percent={task.progress} />
                  </div>
                ) : task.status === "done" ? (
                  <div style={{ marginTop: 16 }}>
                    <Alert
                      type="success"
                      message={t("card.progress.doneMsg")}
                      showIcon
                    />
                    <Row gutter={16} style={{ marginTop: 12 }}>
                      <Col span={8}>
                        <Statistic
                          title={t("card.progress.originalSize")}
                          value={formatBytes(task.originalSize)}
                          prefix={<FileOutlined />}
                        />
                      </Col>
                      {task.compressedSize !== null && (
                        <Col span={8}>
                          <Statistic
                            title={t("card.progress.compressedSize")}
                            value={formatBytes(task.compressedSize)}
                            prefix={<FileOutlined />}
                          />
                        </Col>
                      )}
                      {task.compressedSize !== null && (
                        <Col span={8}>
                          <Statistic
                            title={t("card.progress.ratio")}
                            value={`${Math.round((1 - task.compressedSize / task.originalSize) * 100)}%`}
                            prefix={<BarChartOutlined />}
                          />
                        </Col>
                      )}
                    </Row>
                  </div>
                ) : task.status === "failed" ? (
                  <Alert
                    type="error"
                    message={task.error ?? t("card.progress.failedMsg")}
                    showIcon
                  />
                ) : null}
              </div>
            ) : (
              <Empty description={t("card.progress.noTask")} />
            )}
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card
        title={
          <Space>
            <BarChartOutlined />
            {t("card.ratio.title")}
          </Space>
        }
        variant="outlined"
        style={{ marginTop: 16 }}
      >
        {ratioData.length > 0 ? (
          <Table
            dataSource={ratioData}
            columns={columns}
            rowKey="instanceId"
            pagination={false}
          />
        ) : (
          <Spin />
        )}
      </Card>
    </div>
  );
}

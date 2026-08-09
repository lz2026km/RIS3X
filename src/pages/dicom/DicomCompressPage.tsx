import { usePagination } from "../../hooks/usePagination";
import type {
  CompressInstance,
  DicomCompressTask,
} from "../../services/api/dicomCompressApi";
import { dicomCompressApi } from '../../services/api/dicomCompressApi'
import {
  CompressOutlined,
  ExpandOutlined,
  BarChartOutlined,
  FileOutlined,
  UploadOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
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
  Slider,
  message,
  Popconfirm,
  Descriptions,
  Modal,
} from "antd";
import { BarChart3, File, FlaskConical, Inbox, Maximize2, RotateCw, Shrink, Trash2, Upload, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from "react";

const { Title, Text } = Typography;

interface TransferSyntax {
  uid: string;
  name: string;
  lossy: boolean;
}

interface RatioAgg {
  algorithm: string;
  algorithmName: string;
  modality: string;
  count: number;
  avgRatio: number;
  avgOriginalSize: number;
  avgCompressedSize: number;
  savedBytes: number;
}

interface CompareRow {
  key: string;
  algorithm: string;
  algorithmName: string;
  lossless: boolean;
  originalSize: number;
  compressedSize: number | null;
  ratio: number | null;
  savedPercent: number | null;
  elapsedMs?: number;
}
function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buf = new Uint8Array(reader.result as ArrayBuffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      resolve(btoa(binary));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const statusColor: Record<string, string> = {
  pending: "default",
  processing: "processing",
  done: "success",
  failed: "error",
};

export default function DicomCompressPage() {
  const [syntaxes, setSyntaxes] = useState<TransferSyntax[]>([]);
  const [instances, setInstances] = useState<CompressInstance[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("CT_CHEST/CT_CHEST_001.dcm");
  const [uploadedBase64, setUploadedBase64] = useState<string | undefined>(undefined);
  const [uploadName, setUploadName] = useState<string>("");
  const [selectedSyntax, setSelectedSyntax] = useState<string>("1.2.840.10008.1.2.4.90");
  const [quality, setQuality] = useState<number>(85);
  const [currentTask, setCurrentTask] = useState<DicomCompressTask | null>(null);
  const [tasks, setTasks] = useState<DicomCompressTask[]>([]);
  const [ratios, setRatios] = useState<{ byAlgorithm: RatioAgg[]; byModality: RatioAgg[]; totalSavedBytes: number; avgRatio: number }>({
    byAlgorithm: [],
    byModality: [],
    totalSavedBytes: 0,
    avgRatio: 0,
  });
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [polling, setPolling] = useState(false);
  // [W1-B] 任务操作: batchCompress / cancelTask / deleteTask / getTask / getStats
  const [batchLoading, setBatchLoading] = useState(false);
  const [taskActionId, setTaskActionId] = useState<string>("");
  const [taskStats, setTaskStats] = useState<{ totalTasks: number; completedTasks: number; failedTasks: number; totalSavedBytes: number; avgRatio: number } | null>(null);
  const [taskDetail, setTaskDetail] = useState<DicomCompressTask | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  // [G005 Wave1A P0] 行内真实压缩比: GET /dicom/compress/ratio/:instanceId (JPEG2000 无损预测)
  const [realRatios, setRealRatios] = useState<Record<string, { ratio: number; real: boolean }>>({});
  const [ratioLoadingId, setRatioLoadingId] = useState<string>("");
  const { pageData: taskPageData, pagination: taskPagination } = usePagination(tasks, 8);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const selectedLossy = syntaxes.find(s => s.uid === selectedSyntax)?.lossy ?? false;

  const loadInstances = useCallback(async () => {
    try {
      const res = await dicomCompressApi.listInstances();
      const data = (res.data ?? []) as CompressInstance[];
      setInstances(data);
      if (data.length > 0 && !data.some(i => i.fileId === selectedFileId)) {
        setSelectedFileId(data[0]!.fileId);
      }
    } catch (err) {
      console.warn("[DicomCompress] load instances failed", err);
    }
  }, [selectedFileId]);

  const loadTasks = useCallback(async () => {
    try {
      const res = await dicomCompressApi.listTasks();
      setTasks((res.data ?? []) as DicomCompressTask[]);
    } catch (err) {
      console.warn("[DicomCompress] load tasks failed", err);
    }
  }, []);

  const loadRatios = useCallback(async () => {
    try {
      const res = await dicomCompressApi.getRatios();
      const data = res.data ?? {};
      setRatios({
        byAlgorithm: data.byAlgorithm ?? [],
        byModality: data.byModality ?? [],
        totalSavedBytes: data.totalSavedBytes ?? 0,
        avgRatio: data.avgRatio ?? 0,
      });
    } catch (err) {
      console.warn("[DicomCompress] load ratios failed", err);
    }
  }, []);

  // [W1-B] 任务统计: GET /dicom/compress/stats
  const loadTaskStats = useCallback(async () => {
    try {
      const res = await dicomCompressApi.getStats();
      const d = (res.data ?? {}) as unknown as Record<string, unknown> | null;
      if (d) {
        setTaskStats({
          totalTasks: Number(d.totalTasks ?? 0),
          completedTasks: Number(d.completedTasks ?? 0),
          failedTasks: Number(d.failedTasks ?? 0),
          totalSavedBytes: Number(d.totalSavedBytes ?? 0),
          avgRatio: Number(d.avgRatio ?? 0),
        });
      }
    } catch (err) {
      console.warn("[DicomCompress] load stats failed", err);
    }
  }, []);

  useEffect(() => {
    dicomCompressApi.getSyntaxes()
      .then(res => {
        const data = (res.data ?? []) as TransferSyntax[];
        setSyntaxes(data);
        if (data.length > 0) setSelectedSyntax(data[0]!.uid);
      })
      .catch(err => console.warn("[DicomCompress] load syntaxes failed", err));
    loadInstances();
    loadTasks();
    loadRatios();
    loadTaskStats();
  }, [loadInstances, loadTasks, loadRatios, loadTaskStats]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling();
      setPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const res = await dicomCompressApi.getStatus(taskId);
          const data = res.data as DicomCompressTask | null;
          if (!data) {
            stopPolling();
            return;
          }
          setCurrentTask(data);
          if (data.status === "done" || data.status === "failed") {
            stopPolling();
            loadTasks();
            loadRatios();
          }
        } catch (err) {
          console.warn("[DicomCompress] status polling failed", err);
          stopPolling();
        }
      }, 500);
    },
    [loadTasks, loadRatios, stopPolling],
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const refreshAll = useCallback(() => {
    loadInstances();
    loadTasks();
    loadRatios();
    loadTaskStats();
  }, [loadInstances, loadTasks, loadRatios, loadTaskStats]);

  // [W1-B] 批量压缩: POST /dicom/compress/batch (当前实例 + 前 4 个实例)
  const handleBatchCompress = async () => {
    const fileIds = [selectedFileId, ...instances.map(i => i.fileId).filter(f => f !== selectedFileId)].slice(0, 5);
    setBatchLoading(true);
    try {
      const res = await dicomCompressApi.batchCompress({
        fileIds,
        transferSyntax: selectedSyntax,
        quality: selectedLossy ? quality : undefined,
      });
      const data = res.data as DicomCompressTask[] | null;
      if (Array.isArray(data)) {
        messageApi.success(`已提交 ${data.length} 个批量压缩任务 (POST /dicom/compress/batch)`);
        loadTasks();
        loadRatios();
        loadTaskStats();
      } else {
        messageApi.error("批量压缩响应异常");
      }
    } catch (err) {
      console.warn("[DicomCompress] handleBatchCompress failed", err);
      messageApi.error("批量压缩失败");
    } finally {
      setBatchLoading(false);
    }
  };

  // [W1-B] 取消任务: POST /dicom/compress/tasks/:id/cancel
  const handleCancelTask = async (task: DicomCompressTask) => {
    setTaskActionId(task.id);
    try {
      const res = await dicomCompressApi.cancelTask(task.id);
      if (res.success) {
        messageApi.success(`任务 ${task.id} 已取消`);
        loadTasks();
      } else {
        messageApi.error(res.error?.message ?? "取消失败");
      }
    } catch {
      messageApi.error("取消失败");
    } finally {
      setTaskActionId("");
    }
  };

  // [W1-B] 删除任务: DELETE /dicom/compress/tasks/:id
  const handleDeleteTask = async (task: DicomCompressTask) => {
    setTaskActionId(task.id);
    try {
      const res = await dicomCompressApi.deleteTask(task.id);
      if (res.success) {
        messageApi.success(`任务 ${task.id} 已删除`);
        loadTasks();
        loadRatios();
        loadTaskStats();
      } else {
        messageApi.error((res.error as { message?: string })?.message ?? "删除失败");
      }
    } catch {
      messageApi.error("删除失败");
    } finally {
      setTaskActionId("");
    }
  };

  // [W1-B] 任务详情: GET /dicom/compress/tasks/:id
  const handleViewTask = async (task: DicomCompressTask) => {
    setTaskDetailOpen(true);
    setTaskDetail(task);
    try {
      const res = await dicomCompressApi.getTask(task.id);
      if (res.success && res.data) setTaskDetail(res.data as DicomCompressTask);
      else messageApi.error(res.error?.message ?? "详情加载失败");
    } catch {
      messageApi.error("详情加载失败");
    }
  };

  const handleCompress = async () => {
    setLoading(true);
    setCurrentTask(null);
    try {
      const res = await dicomCompressApi.compress({
        fileId: selectedFileId,
        transferSyntax: selectedSyntax,
        quality: selectedLossy ? quality : undefined,
        dataBase64: uploadedBase64,
      });
      const data = res.data as DicomCompressTask | null;
      if (!data) {
        messageApi.error("压缩请求失败");
        return;
      }
      setCurrentTask(data);
      startPolling(data.id);
    } catch (err) {
      console.warn("[DicomCompress] handleCompress failed", err);
      messageApi.error("压缩请求失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDecompress = async () => {
    setLoading(true);
    setCurrentTask(null);
    try {
      const res = await dicomCompressApi.decompress(currentTask?.id ?? selectedFileId);
      const data = res.data as DicomCompressTask | null;
      if (!data) {
        messageApi.error("解压请求失败");
        return;
      }
      setCurrentTask(data);
      messageApi.success(
        data.error ? "解压失败" : "解压完成",
      );
      loadTasks();
    } catch (err) {
      console.warn("[DicomCompress] handleDecompress failed", err);
      messageApi.error("解压请求失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCompareAll = async () => {
    setComparing(true);
    setCompareRows([]);
    const rows: CompareRow[] = [];
    try {
      for (const syntax of syntaxes) {
        const res = await dicomCompressApi.compress({
          fileId: selectedFileId,
          transferSyntax: syntax.uid,
          quality: syntax.lossy ? quality : undefined,
          dataBase64: uploadedBase64,
        });
        const created = res.data as DicomCompressTask | null;
        if (!created) continue;
        const task = await pollTaskUntilDone(created.id);
        rows.push({
          key: syntax.uid,
          algorithm: syntax.uid,
          algorithmName: task.algorithmName ?? syntax.name,
          lossless: !syntax.lossy,
          originalSize: task.originalSize,
          compressedSize: task.compressedSize,
          ratio: task.ratio ?? null,
          savedPercent:
            task.compressedSize !== null
              ? Math.round((1 - task.compressedSize / task.originalSize) * 100)
              : null,
          elapsedMs: task.elapsedMs,
        });
        setCompareRows([...rows]);
      }
      messageApi.success("全算法对比完成");
      loadTasks();
      loadRatios();
    } catch (err) {
      console.warn("[DicomCompress] handleCompareAll failed", err);
      messageApi.error("对比失败");
    } finally {
      setComparing(false);
    }
  };

  const pollTaskUntilDone = async (taskId: string): Promise<DicomCompressTask> => {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await dicomCompressApi.getStatus(taskId);
        const data = res.data as DicomCompressTask | null;
        if (data && (data.status === "done" || data.status === "failed")) return data;
      } catch {
        /* retry */
      }
      await new Promise(r => setTimeout(r, 350));
    }
    const res = await dicomCompressApi.getStatus(taskId);
    const data = res.data as DicomCompressTask | null;
    if (!data) throw new Error("状态查询超时");
    return data;
  };

  const handleFilePick = async (file: File) => {
    try {
      const b64 = await fileToBase64(file);
      setUploadedBase64(b64);
      setUploadName(file.name);
      setSelectedFileId(file.name);
      messageApi.success(`已上传 ${file.name} (${formatBytes(file.size)})`);
    } catch (err) {
      console.warn("[DicomCompress] file read failed", err);
      messageApi.error("文件读取失败");
    }
  };

  const instanceOptions = [
    ...instances.map(i => ({
      value: i.fileId,
      label: `${i.fileName}  [${i.modality}] ${formatBytes(i.sizeBytes)} (${i.rows}x${i.columns})`,
    })),
    ...(uploadedBase64 && uploadName
      ? [{ value: uploadName, label: `${uploadName}  [UPLOAD]` }]
      : []),
  ];

  // [G005 Wave1A P0] 单实例真实压缩比 (GET /dicom/compress/ratio/:instanceId)
  const handleFetchRealRatio = async (row: DicomCompressTask) => {
    setRatioLoadingId(row.id);
    try {
      const res = await dicomCompressApi.getRatio(row.fileId);
      const data = res.data as { ratio?: number; real?: boolean; originalSize?: number; compressedSize?: number } | null;
      if (res.success && data && data.ratio !== undefined) {
        setRealRatios(prev => ({ ...prev, [row.fileId]: { ratio: data.ratio!, real: data.real !== false } }));
        messageApi.success(
          `实例 ${row.fileId} 真实压缩比 ${data.ratio.toFixed(2)}× (${data.real === false ? "查表估算" : "JPEG2000 真实编码"})`,
        );
      } else {
        messageApi.warning("该实例暂无可计算的真实压缩比");
      }
    } catch (err) {
      console.warn("[DicomCompress] getRatio failed", err);
      messageApi.error("真实压缩比获取失败");
    } finally {
      setRatioLoadingId("");
    }
  };

  const taskColumns = [
    { title: "任务 ID", dataIndex: "id", key: "id", width: 130 },
    { title: "文件", dataIndex: "fileId", key: "fileId", ellipsis: true },
    { title: "算法", dataIndex: "algorithmName", key: "algorithmName", width: 220 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => (
        <Tag color={statusColor[v] ?? "default"}>
          {v === "done" ? "完成" : v === "processing" ? "处理中" : v === "failed" ? "失败" : "排队"}
        </Tag>
      ),
    },
    {
      title: "进度",
      dataIndex: "progress",
      key: "progress",
      width: 140,
      render: (v: number, row: DicomCompressTask) =>
        row.status === "done" ? (
          <Text type="success">{v}%</Text>
        ) : (
          <Progress percent={v} size="small" />
        ),
    },
    {
      title: "原始",
      dataIndex: "originalSize",
      key: "originalSize",
      width: 110,
      render: (v: number) => formatBytes(v),
    },
    {
      title: "压缩后",
      dataIndex: "compressedSize",
      key: "compressedSize",
      width: 110,
      render: (v: number | null) => formatBytes(v),
    },
    {
      title: "压缩比",
      dataIndex: "ratio",
      key: "ratio",
      width: 100,
      render: (v: number | undefined, row: DicomCompressTask) =>
        v !== undefined ? (
          <Tag color={v > 3 ? "green" : v > 1.5 ? "blue" : "orange"}>{v.toFixed(2)}×</Tag>
        ) : row.status === "done" && row.compressedSize ? (
          <Tag color="orange">{(row.originalSize / row.compressedSize).toFixed(2)}×</Tag>
        ) : (
          "-"
        ),
    },
    {
      title: "真实",
      dataIndex: "simulated",
      key: "simulated",
      width: 90,
      render: (v: boolean | undefined) =>
        v ? <Tag color="gold">估算</Tag> : <Tag color="green">真实</Tag>,
    },
    {
      title: "JPEG2000 真实比",
      key: "realRatio",
      width: 120,
      render: (_: unknown, row: DicomCompressTask) => {
        const r = realRatios[row.fileId];
        return r ? (
          <Tag color={r.real ? "green" : "gold"}>{r.ratio.toFixed(2)}×{r.real ? "" : " (估算)"}</Tag>
        ) : (
          <Button size="small" type="link" loading={ratioLoadingId === row.id} onClick={() => void handleFetchRealRatio(row)}>
            查询
          </Button>
        );
      },
    },
    { title: "耗时", dataIndex: "elapsedMs", key: "elapsedMs", width: 90, render: (v?: number) => (v !== undefined ? `${v} ms` : "-") },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_: unknown, row: DicomCompressTask) => (
        <Space size={4}>
          <Button size="small" onClick={() => void handleViewTask(row)}>详情</Button>
          {(row.status === "pending" || row.status === "processing") && (
            <Button size="small" danger loading={taskActionId === row.id} onClick={() => void handleCancelTask(row)}>取消</Button>
          )}
          <Popconfirm title="确认删除该任务?" onConfirm={() => void handleDeleteTask(row)}>
            <Button size="small" type="text" danger loading={taskActionId === row.id} icon={<Trash2 size={12} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const compareColumns = [
    { title: "算法", dataIndex: "algorithmName", key: "algorithmName" },
    {
      title: "类型",
      dataIndex: "lossless",
      key: "lossless",
      width: 100,
      render: (v: boolean) => <Tag color={v ? "green" : "red"}>{v ? "无损" : "有损"}</Tag>,
    },
    { title: "原始", dataIndex: "originalSize", key: "originalSize", width: 110, render: (v: number) => formatBytes(v) },
    { title: "压缩后", dataIndex: "compressedSize", key: "compressedSize", width: 110, render: (v: number | null) => formatBytes(v) },
    {
      title: "压缩比",
      dataIndex: "ratio",
      key: "ratio",
      width: 110,
      render: (v: number | null) => (v ? <Tag color={v > 3 ? "green" : "blue"}>{v.toFixed(2)}×</Tag> : "-"),
    },
    {
      title: "节省",
      dataIndex: "savedPercent",
      key: "savedPercent",
      width: 110,
      render: (v: number | null) => (v !== null ? `${v}%` : "-"),
    },
    { title: "耗时", dataIndex: "elapsedMs", key: "elapsedMs", width: 100, render: (v?: number) => (v !== undefined ? `${v} ms` : "-") },
  ];

  const ratioColumns = [
    { title: "算法", dataIndex: "algorithmName", key: "algorithmName" },
    { title: "模态", dataIndex: "modality", key: "modality", width: 100 },
    { title: "次数", dataIndex: "count", key: "count", width: 90 },
    { title: "平均压缩比", dataIndex: "avgRatio", key: "avgRatio", width: 130, render: (v: number) => <Tag color="blue">{v.toFixed(2)}×</Tag> },
    { title: "平均节省", dataIndex: "savedBytes", key: "savedBytes", width: 120, render: (v: number) => formatBytes(v) },
    { title: "平均原始", dataIndex: "avgOriginalSize", key: "avgOriginalSize", width: 120, render: (v: number) => formatBytes(v) },
  ];

  const ratioModalityColumns = [
    { title: "模态", dataIndex: "modality", key: "modality" },
    { title: "算法", dataIndex: "algorithmName", key: "algorithmName" },
    { title: "次数", dataIndex: "count", key: "count", width: 90 },
    { title: "平均压缩比", dataIndex: "avgRatio", key: "avgRatio", width: 130, render: (v: number) => <Tag color="blue">{v.toFixed(2)}×</Tag> },
    { title: "累计节省", dataIndex: "savedBytes", key: "savedBytes", width: 120, render: (v: number) => formatBytes(v) },
  ];

  const savedPercent =
    currentTask?.compressedSize !== null && currentTask?.compressedSize !== undefined
      ? Math.round((1 - currentTask.compressedSize / currentTask.originalSize) * 100)
      : null;

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={3}>
        <Shrink size={16} style={{ marginRight: 8 }} />
        DICOM 压缩工作台
        <Text type="secondary" style={{ fontSize: 13, marginLeft: 12 }}>
          真实 JPEG2000/HTJ2K 对标: RLE 游程 + LOCO-I 预测 + Golomb-Rice 熵编码
        </Text>
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <File size={14} />
                源文件
              </Space>
            }
            variant="outlined"
          >
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Text strong>DICOM 实例</Text>
              <Select
                style={{ width: "100%" }}
                value={selectedFileId}
                onChange={v => {
                  setSelectedFileId(v);
                  setUploadedBase64(undefined);
                  setUploadName("");
                }}
                options={instanceOptions}
                showSearch
                optionFilterProp="label"
                placeholder="选择 DICOM 实例"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".dcm"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void handleFilePick(file);
                  e.target.value = "";
                }}
              />
              <Button
                icon={<Upload />}
                onClick={() => fileInputRef.current?.click()}
                block
              >
                上传 .dcm 文件
              </Button>
              {uploadName && (
                <Alert
                  type="info"
                  showIcon
                  message={`已上传: ${uploadName}`}
                  description="将使用真实字节流执行 RLE / Predictive 压缩"
                />
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <FlaskConical size={14} />
                压缩参数
              </Space>
            }
            variant="outlined"
          >
            <Space orientation="vertical" style={{ width: "100%" }}>
              <div>
                <Text strong>传输语法</Text>
                <Select
                  style={{ width: "100%", marginTop: 4 }}
                  value={selectedSyntax}
                  onChange={setSelectedSyntax}
                  options={syntaxes.map(s => ({
                    value: s.uid,
                    label: `${s.name} (${s.lossy ? "有损" : "无损"})`,
                  }))}
                />
              </div>
              {selectedLossy && (
                <div>
                  <Text strong>
                    质量: <Tag color="blue">{quality}</Tag>
                  </Text>
                  <Slider min={1} max={100} value={quality} onChange={setQuality} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    质量越低压缩比越高
                  </Text>
                </div>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <Zap size={14} />
                执行
              </Space>
            }
            variant="outlined"
          >
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Button
                type="primary"
                icon={<Shrink />}
                loading={loading}
                onClick={handleCompress}
                block
              >
                开始压缩
              </Button>
              <Button
                icon={<Shrink />}
                loading={batchLoading}
                onClick={() => void handleBatchCompress()}
                block
              >
                批量压缩 (最多5个)
              </Button>
              <Button
                icon={<Maximize2 />}
                loading={loading}
                onClick={handleDecompress}
                block
              >
                解压
              </Button>
              <Button
                icon={<BarChart3 />}
                loading={comparing}
                onClick={handleCompareAll}
                block
              >
                全部算法对比
              </Button>
              <Button icon={<RotateCw />} onClick={refreshAll} block>
                刷新任务与统计
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <BarChart3 size={16} />
            压缩结果
            {currentTask?.simulated === true && (
              <Tag color="gold">估算 (文件不可达时查表回退)</Tag>
            )}
            {currentTask?.simulated === false && <Tag color="green">真实压缩</Tag>}
          </Space>
        }
        variant="outlined"
        style={{ marginTop: 16 }}
      >
        {currentTask ? (
          <div>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="任务 ID" value={currentTask.id} styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="状态"
                  value={currentTask.status === "done" ? "完成" : currentTask.status === "processing" ? "处理中" : currentTask.status}
                  valueStyle={{ color: currentTask.status === "done" ? "#52c41a" : undefined }}
                />
              </Col>
              <Col span={6}>
                <Statistic title="算法" value={currentTask.algorithmName ?? currentTask.transferSyntax} styles={{ content: { fontSize: 13 } }} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="模态"
                  value={currentTask.modality ?? "-"}
                />
              </Col>
            </Row>
            {(currentTask.status === "pending" || currentTask.status === "processing") && (
              <div style={{ marginTop: 16 }}>
                <Text>真实压缩进行中...</Text>
                <Progress percent={currentTask.progress} />
              </div>
            )}
            {currentTask.status === "done" && currentTask.compressedSize !== null && (
              <div>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={4}>
                    <Statistic
                      title="原始大小"
                      value={formatBytes(currentTask.originalSize)}
                      prefix={<File size={14} />}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="压缩后"
                      value={formatBytes(currentTask.compressedSize)}
                      prefix={<File size={14} />}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="真实压缩比"
                      value={currentTask.ratio ? `${currentTask.ratio.toFixed(2)}×` : "-"}
                      valueStyle={{ color: "#2563eb", fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="节省"
                      value={savedPercent !== null ? `${savedPercent}%` : "-"}
                      valueStyle={{ color: savedPercent !== null && savedPercent > 0 ? "#52c41a" : undefined }}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="耗时"
                      value={currentTask.elapsedMs !== undefined ? `${currentTask.elapsedMs} ms` : "-"}
                    />
                  </Col>
                  <Col span={4}>
                    <Statistic
                      title="类型"
                      value={currentTask.lossless ? "无损" : "有损"}
                      valueStyle={{ color: currentTask.lossless ? "#52c41a" : "#fa541c" }}
                    />
                  </Col>
                </Row>
                <Alert
                  type={currentTask.lossless ? "success" : "warning"}
                  showIcon
                  style={{ marginTop: 12 }}
                  message={
                    currentTask.lossless
                      ? "无损压缩: 解压后可 100% 还原原始像素"
                      : `有损压缩: 重建误差受量化步长限制 (quality=${currentTask.quality ?? "-"})`
                  }
                />
              </div>
            )}
            {currentTask.status === "done" && currentTask.compressedSize === null && (
              <Alert type="success" showIcon title="已完成" style={{ marginTop: 12 }} />
            )}
            {currentTask.status === "failed" && (
              <Alert type="error" showIcon title={currentTask.error ?? "失败"} style={{ marginTop: 12 }} />
            )}
            {currentTask.status === "done" && (
              <Button
                icon={<Maximize2 />}
                style={{ marginTop: 12 }}
                onClick={handleDecompress}
              >
                解压验证
              </Button>
            )}
          </div>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={polling ? "压缩中..." : "尚未压缩"} />
        )}
      </Card>

      <Divider />

      <Card
        title={
          <Space>
            <File size={14} />
            任务列表
            {polling && <Tag color="processing">轮询中</Tag>}
          </Space>
        }
        variant="outlined"
      >
        {taskStats && (
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={5}><Statistic title="任务总数" value={taskStats.totalTasks} styles={{ content: { fontSize: 18 } }} /></Col>
            <Col span={5}><Statistic title="已完成" value={taskStats.completedTasks} valueStyle={{ color: "#52c41a" }} styles={{ content: { fontSize: 18 } }} /></Col>
            <Col span={5}><Statistic title="失败" value={taskStats.failedTasks} valueStyle={{ color: "#ff4d4f" }} styles={{ content: { fontSize: 18 } }} /></Col>
            <Col span={5}><Statistic title="累计节省" value={formatBytes(taskStats.totalSavedBytes)} styles={{ content: { fontSize: 18 } }} /></Col>
            <Col span={4}><Statistic title="平均压缩比" value={taskStats.avgRatio ? `${taskStats.avgRatio.toFixed(2)}×` : "-"} styles={{ content: { fontSize: 18 } }} /></Col>
          </Row>
        )}
        {tasks.length > 0 ? (
          <Table
            dataSource={taskPageData}
            columns={taskColumns}
            rowKey="id"
            size="small"
            pagination={taskPagination}
          scroll={{ x: 'max-content' }}
          />
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无任务" />
        )}
      </Card>

      <Divider />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BarChart3 size={16} />
                算法对比
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {compareRows.length > 0 ? `${formatBytes(compareRows[0]?.originalSize)} 像素数据` : ""}
                </Text>
              </Space>
            }
            variant="outlined"
          >
            {comparing ? (
              <Spin tip="对比中..." style={{ display: "block", padding: 32 }}>
                <div style={{ height: 60 }} />
              </Spin>
            ) : compareRows.length > 0 ? (
              <Table dataSource={compareRows} columns={compareColumns} rowKey="key" pagination={false} size="small" scroll={{ x: 'max-content' }}/>
            ) : (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description='点击 "全部算法对比" 查看各算法真实压缩比' />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BarChart3 size={16} />
                压缩比统计
                <Text type="secondary" style={{ fontSize: 12 }}>
                  共 {ratios.byAlgorithm.reduce((s, a) => s + a.count, 0)} 次任务, 节省 {formatBytes(ratios.totalSavedBytes)}, 平均 {ratios.avgRatio.toFixed(2)}×
                </Text>
              </Space>
            }
            variant="outlined"
          >
            {ratios.byAlgorithm.length > 0 ? (
              <>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  按算法
                </Text>
                <Table dataSource={ratios.byAlgorithm} columns={ratioColumns} rowKey={r => r.algorithm} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
                <Text strong style={{ display: "block", margin: "16px 0 8px" }}>
                  按模态
                </Text>
                <Table dataSource={ratios.byModality} columns={ratioModalityColumns} rowKey={r => `${r.modality}:${r.algorithm}`} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
              </>
            ) : (
              <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description="暂无统计数据，先执行一次压缩" />
            )}
          </Card>
        </Col>
      </Row>

      {/* [W1-B] 任务详情: GET /dicom/compress/tasks/:id */}
      <Modal
        title={`任务详情 - ${taskDetail?.id ?? ""}`}
        open={taskDetailOpen}
        onCancel={() => setTaskDetailOpen(false)}
        footer={<Button onClick={() => setTaskDetailOpen(false)}>关闭</Button>}
        width={560}
      >
        {taskDetail ? (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="任务 ID"><Text code>{taskDetail.id}</Text></Descriptions.Item>
            <Descriptions.Item label="文件">{taskDetail.fileId}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColor[taskDetail.status] ?? "default"}>{taskDetail.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="进度">{taskDetail.progress}%</Descriptions.Item>
            <Descriptions.Item label="算法">{taskDetail.algorithmName ?? taskDetail.transferSyntax}</Descriptions.Item>
            <Descriptions.Item label="模态">{taskDetail.modality ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="原始">{formatBytes(taskDetail.originalSize)}</Descriptions.Item>
            <Descriptions.Item label="压缩后">{formatBytes(taskDetail.compressedSize)}</Descriptions.Item>
            <Descriptions.Item label="压缩比">{taskDetail.ratio ? `${taskDetail.ratio.toFixed(2)}×` : "-"}</Descriptions.Item>
            <Descriptions.Item label="耗时">{taskDetail.elapsedMs !== undefined ? `${taskDetail.elapsedMs} ms` : "-"}</Descriptions.Item>
            <Descriptions.Item label="类型">{taskDetail.lossless ? "无损" : "有损"}</Descriptions.Item>
            <Descriptions.Item label="真实">{taskDetail.simulated ? "估算" : "真实"}</Descriptions.Item>
            <Descriptions.Item label="创建">{taskDetail.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新">{taskDetail.updatedAt}</Descriptions.Item>
            {taskDetail.error && <Descriptions.Item label="错误" span={2}><Text type="danger">{taskDetail.error}</Text></Descriptions.Item>}
          </Descriptions>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="加载中" />
        )}
      </Modal>
    </div>
  );
}

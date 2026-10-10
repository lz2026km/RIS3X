import { usePagination } from "../../hooks/usePagination";
const STAT_COLOR_MAP: Record<string, string> = {
  '#cf1322': 'error', 'var(--color-error-600)': 'error', '#f5222d': 'error', '#ff4d4f': 'error',
  '#fa8c16': 'warning', '#faad14': 'warning', 'var(--color-warning-600)': 'warning', '#ff7a45': 'warning',
  '#52c41a': 'success', 'var(--color-success-600)': 'success', '#059669': 'success',
  '#1890ff': 'primary', 'var(--color-primary-600)': 'primary', 'var(--color-primary-700)': 'primary',
  '#13c2c2': 'info',
};
const mapColor = (c?: string): string | undefined => (c ? STAT_COLOR_MAP[c.toLowerCase()] ?? c : c);
import type {
  CompressInstance,
  DicomCompressTask,
} from "../../services/api/dicomCompressApi";
import { dicomCompressApi } from '../../services/api/dicomCompressApi'
import type {
  CodecBenchmarkResult,
  CompressStrategy,
} from "../../services/api/dicomCompressApi";
import {
  Card,
  Select,
  Button,
  Progress,
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
import { BarChart3, File, FlaskConical, Inbox, Maximize2, RotateCw, Repeat2, Shrink, Trash2, Upload, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from "react";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { t } from "../../i18n/appI18n";

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
  // [v3.0.6.11-101 W1A] 8 算法基准 + 策略建议
  const [strategies, setStrategies] = useState<CompressStrategy[]>([]);
  const [benchmarkResult, setBenchmarkResult] = useState<CodecBenchmarkResult | null>(null);
  // [v3.0.6.11-103 Wave 2B] 真编码工具: real-jpeg2000 / transcode
  const [j2kLoading, setJ2kLoading] = useState(false);
  const [transcodeLoading, setTranscodeLoading] = useState(false);
  const [transcodeTarget, setTranscodeTarget] = useState<string>("1.2.840.10008.1.2.4.90");
  const [transcodeResult, setTranscodeResult] = useState<DicomCompressTask | null>(null);
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
    dicomCompressApi.getStrategies()
      .then(res => setStrategies((res.data ?? []) as CompressStrategy[]))
      .catch(err => console.warn("[DicomCompress] load strategies failed", err));
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
        messageApi.success(t("compressV2.batchSubmitted", { count: data.length }));
        loadTasks();
        loadRatios();
        loadTaskStats();
      } else {
        messageApi.error(t("compressV2.batchRespError"));
      }
    } catch (err) {
      console.warn("[DicomCompress] handleBatchCompress failed", err);
      messageApi.error(t("compressV2.batchFailed"));
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
        messageApi.success(t("compressV2.taskCancelled", { id: task.id }));
        loadTasks();
      } else {
        messageApi.error(res.error?.message ?? t("compressV2.cancelFailed"));
      }
    } catch {
      messageApi.error(t("compressV2.cancelFailed"));
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
        messageApi.success(t("compressV2.taskDeleted", { id: task.id }));
        loadTasks();
        loadRatios();
        loadTaskStats();
      } else {
        messageApi.error((res.error as { message?: string })?.message ?? t("compressV2.deleteFailed"));
      }
    } catch {
      messageApi.error(t("compressV2.deleteFailed"));
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
      else messageApi.error(res.error?.message ?? t("compressV2.detailLoadFailed"));
    } catch {
      messageApi.error(t("compressV2.detailLoadFailed"));
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
        messageApi.error(t("compressV2.compressFailed"));
        return;
      }
      setCurrentTask(data);
      startPolling(data.id);
    } catch (err) {
      console.warn("[DicomCompress] handleCompress failed", err);
      messageApi.error(t("compressV2.compressFailed"));
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
        messageApi.error(t("compressV2.decompressFailed"));
        return;
      }
      setCurrentTask(data);
      messageApi.success(
        data.error ? t("compressV2.decompressError") : t("compressV2.decompressDone"),
      );
      loadTasks();
    } catch (err) {
      console.warn("[DicomCompress] handleDecompress failed", err);
      messageApi.error(t("compressV2.decompressFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCompareAll = async () => {
    setComparing(true);
    setCompareRows([]);
    setBenchmarkResult(null);
    try {
      const res = await dicomCompressApi.benchmark({
        fileId: selectedFileId,
        quality: selectedLossy ? quality : undefined,
        dataBase64: uploadedBase64,
      });
      const data = res.data as CodecBenchmarkResult | null;
      if (!data || !Array.isArray(data.runs)) {
        messageApi.error(t("compressV2.benchmarkRespError"));
        return;
      }
      setBenchmarkResult(data);
      const rows: CompareRow[] = data.runs.map((r, i) => ({
        key: `${r.transferSyntax}-${i}`,
        algorithm: r.transferSyntax,
        algorithmName: r.name,
        lossless: r.lossless,
        originalSize: data.originalSize,
        compressedSize: r.compressedSize,
        ratio: r.ratio,
        savedPercent: r.savedPercent,
        elapsedMs: r.elapsedMs,
      }));
      setCompareRows(rows);
      const rec = data.recommendedName;
      messageApi.success(rec ? t("compressV2.benchmarkDone", { name: rec }) : t("compressV2.compareDone"));
      loadTasks();
      loadRatios();
    } catch (err) {
      console.warn("[DicomCompress] handleCompareAll failed", err);
      messageApi.error(t("compressV2.compareFailed"));
    } finally {
      setComparing(false);
    }
  };

  const handleFilePick = async (file: File) => {
    try {
      const b64 = await fileToBase64(file);
      setUploadedBase64(b64);
      setUploadName(file.name);
      setSelectedFileId(file.name);
      messageApi.success(t("compressV2.uploadedFile", { name: file.name, size: formatBytes(file.size) }));
    } catch (err) {
      console.warn("[DicomCompress] file read failed", err);
      messageApi.error(t("compressV2.fileReadFailed"));
    }
  };

  // [v3.0.6.11-103 Wave 2B] 真 JPEG2000 编码: POST /dicom/compress/real-jpeg2000 (OpenJPEG WASM 无损)
  const handleRealJpeg2000 = async () => {
    setJ2kLoading(true);
    try {
      const res = await dicomCompressApi.realJpeg2000({
        fileId: selectedFileId,
        quality: selectedLossy ? quality : undefined,
        dataBase64: uploadedBase64,
      });
      const data = res.data as DicomCompressTask | null;
      if (!data) {
        messageApi.error(t("compressV2.j2kRespError"));
        return;
      }
      setCurrentTask(data);
      startPolling(data.id);
      messageApi.success(t("compressV2.j2kStarted", { id: data.id }));
    } catch (err) {
      console.warn("[DicomCompress] realJpeg2000 failed", err);
      messageApi.error(t("compressV2.j2kFailed"));
    } finally {
      setJ2kLoading(false);
    }
  };

  // [v3.0.6.11-103 Wave 2B] 实例转码: POST /dicom/compress/transcode (目标传输语法重新编码)
  const handleTranscode = async () => {
    setTranscodeLoading(true);
    setTranscodeResult(null);
    try {
      const res = await dicomCompressApi.transcode({
        fileId: selectedFileId,
        targetSyntax: transcodeTarget,
        quality: selectedLossy ? quality : undefined,
        dataBase64: uploadedBase64,
      });
      const data = res.data as DicomCompressTask | null;
      if (!data) {
        messageApi.error(t("compressV2.transcodeRespError"));
        return;
      }
      setTranscodeResult(data);
      setCurrentTask(data);
      startPolling(data.id);
      messageApi.success(t("compressV2.transcodeStarted", { id: data.id }));
      loadTasks();
      loadRatios();
    } catch (err) {
      console.warn("[DicomCompress] transcode failed", err);
      messageApi.error(t("compressV2.transcodeFailed"));
    } finally {
      setTranscodeLoading(false);
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
          data.real === false
            ? t("compressV2.estRatioMsg", { id: row.fileId, ratio: data.ratio.toFixed(2) })
            : t("compressV2.realRatioMsg", { id: row.fileId, ratio: data.ratio.toFixed(2) }),
        );
      } else {
        messageApi.warning(t("compressV2.noRealRatio"));
      }
    } catch (err) {
      console.warn("[DicomCompress] getRatio failed", err);
      messageApi.error(t("compressV2.realRatioFailed"));
    } finally {
      setRatioLoadingId("");
    }
  };

  const taskColumns = [
    { title: t("compressV2.thTaskId"), dataIndex: "id", key: "id", width: 130 },
    { title: t("compressV2.thFile"), dataIndex: "fileId", key: "fileId", ellipsis: true },
    { title: t("compressV2.thAlgorithm"), dataIndex: "algorithmName", key: "algorithmName", width: 220 },
    {
      title: t("compressV2.thStatus"),
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => (
        <Tag color={statusColor[v] ?? "default"}>
          {v === "done" ? t("compressV2.statusDone") : v === "processing" ? t("compressV2.statusProcessing") : v === "failed" ? t("compressV2.statusFailed") : t("compressV2.statusPending")}
        </Tag>
      ),
    },
    {
      title: t("compressV2.thProgress"),
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
      title: t("compressV2.thOriginal"),
      dataIndex: "originalSize",
      key: "originalSize",
      width: 110,
      render: (v: number) => formatBytes(v),
    },
    {
      title: t("compressV2.thCompressed"),
      dataIndex: "compressedSize",
      key: "compressedSize",
      width: 110,
      render: (v: number | null) => formatBytes(v),
    },
    {
      title: t("compressV2.thRatio"),
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
      // [G005 Wave3A P16] 编码来源三态: real=JPEG2000 WASM 真实 / rle-approx=LOCO-I 近似 / estimated=查表估算
      title: t("compressV2.thSource"),
      dataIndex: "source",
      key: "source",
      width: 150,
      render: (_: unknown, row: DicomCompressTask) => {
        if (row.source === "real") return <Tag color="green">{t("compressV2.realShort")}</Tag>;
        if (row.source === "estimated") return <Tag color="gold">{t("compressV2.estimatedShort")}</Tag>;
        if (row.simulated) return <Tag color="gold">{t("compressV2.estimatedShort")}</Tag>;
        return <Tag color="blue">{t("compressV2.rleApprox")}</Tag>;
      },
    },
    {
      // [G005 Wave3A P16] JPEG2000 真实比 (OpenJPEG WASM / 估算标注)
      title: t("compressV2.thJ2kReal"),
      key: "realRatio",
      width: 170,
      render: (_: unknown, row: DicomCompressTask) => {
        const r = realRatios[row.fileId];
        return r ? (
          <Tag color={r.real ? "green" : "gold"} title={r.real ? t("compressV2.realShort") : t("compressV2.estimatedShort")}>
            {r.ratio.toFixed(2)}× {r.real ? t("compressV2.realCodeTag") : t("compressV2.estCodeTag")}
          </Tag>
        ) : (
          <Button size="small" type="link" loading={ratioLoadingId === row.id} onClick={() => void handleFetchRealRatio(row)}>
            {t("compressV2.query")}
          </Button>
        );
      },
    },
    { title: t("compressV2.thElapsed"), dataIndex: "elapsedMs", key: "elapsedMs", width: 90, render: (v?: number) => (v !== undefined ? `${v} ms` : "-") },
    {
      title: t("compressV2.thActions"),
      key: "actions",
      width: 160,
      render: (_: unknown, row: DicomCompressTask) => (
        <Space size={4}>
          <Button size="small" onClick={() => void handleViewTask(row)}>{t("compressV2.detail")}</Button>
          {(row.status === "pending" || row.status === "processing") && (
            <Button size="small" danger loading={taskActionId === row.id} onClick={() => void handleCancelTask(row)}>{t("compressV2.cancel")}</Button>
          )}
          <Popconfirm title={t("compressV2.deleteConfirm")} onConfirm={() => void handleDeleteTask(row)}>
            <Button size="small" type="text" danger loading={taskActionId === row.id} icon={<Trash2 size={12} />}>{t("compressV2.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const compareColumns = [
    {
      title: t("compressV2.thAlgorithm"),
      dataIndex: "algorithmName",
      key: "algorithmName",
      render: (v: string, row: CompareRow) => (
        <Space size={6} wrap>
          {v}
          {benchmarkResult?.recommended === row.algorithm && <Tag color="gold">{t("compressV2.recommended")}</Tag>}
        </Space>
      ),
    },
    {
      title: t("compressV2.thType"),
      dataIndex: "lossless",
      key: "lossless",
      width: 100,
      render: (v: boolean) => <Tag color={v ? "green" : "red"}>{v ? t("compressV2.losslessTag") : t("compressV2.lossyTag")}</Tag>,
    },
    { title: t("compressV2.thOriginal"), dataIndex: "originalSize", key: "originalSize", width: 110, render: (v: number) => formatBytes(v) },
    { title: t("compressV2.thCompressed"), dataIndex: "compressedSize", key: "compressedSize", width: 110, render: (v: number | null) => formatBytes(v) },
    {
      title: t("compressV2.thRatio"),
      dataIndex: "ratio",
      key: "ratio",
      width: 110,
      render: (v: number | null) => (v ? <Tag color={v > 3 ? "green" : "blue"}>{v.toFixed(2)}×</Tag> : "-"),
    },
    {
      title: t("compressV2.thSaved"),
      dataIndex: "savedPercent",
      key: "savedPercent",
      width: 110,
      render: (v: number | null) => (v !== null ? `${v}%` : "-"),
    },
    {
      title: t("compressV2.thPsnr"),
      key: "psnr",
      width: 100,
      render: (_: unknown, row: CompareRow) => {
        const run = benchmarkResult?.runs.find(r => r.transferSyntax === row.algorithm);
        if (!run) return "-";
        if (run.lossless) return <Tag color="green">{t("compressV2.losslessInf")}</Tag>;
        return run.psnr !== null && run.psnr !== Infinity ? `${run.psnr.toFixed(1)} dB` : "-";
      },
    },
    { title: t("compressV2.thElapsed"), dataIndex: "elapsedMs", key: "elapsedMs", width: 100, render: (v?: number) => (v !== undefined ? `${v} ms` : "-") },
  ];

  const ratioColumns = [
    { title: t("compressV2.thAlgorithm"), dataIndex: "algorithmName", key: "algorithmName" },
    { title: t("compressV2.thModality"), dataIndex: "modality", key: "modality", width: 100 },
    { title: t("compressV2.thCount"), dataIndex: "count", key: "count", width: 90 },
    { title: t("compressV2.thAvgRatio"), dataIndex: "avgRatio", key: "avgRatio", width: 130, render: (v: number) => <Tag color="blue">{v.toFixed(2)}×</Tag> },
    { title: t("compressV2.thAvgSaved"), dataIndex: "savedBytes", key: "savedBytes", width: 120, render: (v: number) => formatBytes(v) },
    { title: t("compressV2.thAvgOriginal"), dataIndex: "avgOriginalSize", key: "avgOriginalSize", width: 120, render: (v: number) => formatBytes(v) },
  ];

  const ratioModalityColumns = [
    { title: t("compressV2.thModality"), dataIndex: "modality", key: "modality" },
    { title: t("compressV2.thAlgorithm"), dataIndex: "algorithmName", key: "algorithmName" },
    { title: t("compressV2.thCount"), dataIndex: "count", key: "count", width: 90 },
    { title: t("compressV2.thAvgRatio"), dataIndex: "avgRatio", key: "avgRatio", width: 130, render: (v: number) => <Tag color="blue">{v.toFixed(2)}×</Tag> },
    { title: t("compressV2.thTotalSaved"), dataIndex: "savedBytes", key: "savedBytes", width: 120, render: (v: number) => formatBytes(v) },
  ];

  const savedPercent =
    currentTask?.compressedSize !== null && currentTask?.compressedSize !== undefined
      ? Math.round((1 - currentTask.compressedSize / currentTask.originalSize) * 100)
      : null;

  return (
    <PageContainer padding={24}>
      {contextHolder}
      <Title level={3}>
        <Shrink size={16} style={{ marginRight: 'var(--space-2, 8px)' }} />
        {t("compressV2.title")}
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'var(--space-3, 12px)' }}>
          {t("compressV2.subtitle")}
        </Text>
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <File size={14} />
                {t("compressV2.sourceFile")}
              </Space>
            }
            variant="outlined"
          >
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Text strong>{t("compressV2.dicomInstance")}</Text>
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
                placeholder={t("compressV2.selectInstance")}
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
                {t("compressV2.uploadDcm")}
              </Button>
              {uploadName && (
                <Alert
                  type="info"
                  showIcon
                  message={t("compressV2.uploaded", { name: uploadName })}
                  description={t("compressV2.uploadDesc")}
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
                {t("compressV2.paramsTitle")}
              </Space>
            }
            variant="outlined"
          >
            <Space orientation="vertical" style={{ width: "100%" }}>
              <div>
                <Text strong>{t("compressV2.transferSyntax")}</Text>
                <Select
                  style={{ width: "100%", marginTop: 'var(--space-1, 4px)' }}
                  value={selectedSyntax}
                  onChange={setSelectedSyntax}
                  options={syntaxes.map(s => ({
                    value: s.uid,
                    label: `${s.name} (${s.lossy ? t("compressV2.lossy") : t("compressV2.lossless")})`,
                  }))}
                />
              </div>
              {selectedLossy && (
                <div>
                  <Text strong>
                    {t("compressV2.quality")} <Tag color="blue">{quality}</Tag>
                  </Text>
                  <Slider min={1} max={100} value={quality} onChange={setQuality} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t("compressV2.qualityHint")}
                  </Text>
                </div>
              )}
              {selectedSyntax === "1.2.840.10008.1.2.4.201" && (
                <Alert
                  type="info"
                  showIcon
                  message={t("compressV2.htj2kTitle")}
                  description={t("compressV2.htj2kDesc")}
                />
              )}
              {selectedSyntax === "1.2.840.10008.1.2.4.80" && (
                <Alert
                  type="info"
                  showIcon
                  message={t("compressV2.jpeglsTitle")}
                  description={t("compressV2.jpeglsDesc")}
                />
              )}
              {strategies.length > 0 && (
                <div>
                  <Divider style={{ margin: "12px 0" }} />
                  <Text strong style={{ fontSize: 12 }}>{t("compressV2.strategyTitle")}</Text>
                  <div style={{ marginTop: 'var(--space-2, 8px)', maxHeight: 240, overflowY: "auto" }}>
                    {strategies.slice(0, 8).map(s => (
                      <div key={s.modality} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                        <Space size={6} wrap>
                          <Tag color="blue">{s.modalityName}</Tag>
                          <Text style={{ fontSize: 12 }}>{s.recommendedName}</Text>
                          <Tag color={s.lossless ? "green" : "orange"}>{s.lossless ? t("compressV2.lossless") : t("compressV2.nearLossless")}</Tag>
                        </Space>
                        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{s.reason}</div>
                      </div>
                    ))}
                  </div>
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
                {t("compressV2.execTitle")}
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
                {t("compressV2.startCompress")}
              </Button>
              <Button
                icon={<Shrink />}
                loading={batchLoading}
                onClick={() => void handleBatchCompress()}
                block
              >
                {t("compressV2.batchCompress")}
              </Button>
              <Button
                icon={<Maximize2 />}
                loading={loading}
                onClick={handleDecompress}
                block
              >
                {t("compressV2.decompress")}
              </Button>
              <Button
                icon={<BarChart3 />}
                loading={comparing}
                onClick={handleCompareAll}
                block
              >
                {t("compressV2.compareAll")}
              </Button>
              <Button
                icon={<Zap />}
                loading={j2kLoading}
                onClick={() => void handleRealJpeg2000()}
                block
              >
                {t("compressV2.j2kEncode")}
              </Button>
              <Divider style={{ margin: "8px 0" }} />
              <Text strong style={{ fontSize: 12 }}>{t("compressV2.transcodeTitle")}</Text>
              <Select
                style={{ width: "100%", marginTop: 'var(--space-1, 4px)' }}
                value={transcodeTarget}
                onChange={setTranscodeTarget}
                options={syntaxes.map(s => ({
                  value: s.uid,
                  label: `${s.name} (${s.lossy ? t("compressV2.lossy") : t("compressV2.lossless")})`,
                }))}
              />
              <Button
                icon={<Repeat2 />}
                loading={transcodeLoading}
                onClick={() => void handleTranscode()}
                block
              >
                {t("compressV2.transcodeBtn")}
              </Button>
              {transcodeResult && (
                <Alert
                  type="info"
                  showIcon
                  message={t("compressV2.transcodeDone", { id: transcodeResult.id, status: transcodeResult.status })}
                />
              )}
              <Button icon={<RotateCw />} onClick={refreshAll} block>
                {t("compressV2.refreshTasks")}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <BarChart3 size={16} />
            {t("compressV2.resultTitle")}
            {/* [G005 Wave3A P16] 编码来源三态标注, 杜绝估算/真实混淆 */}
            {currentTask?.source === "real" && <Tag color="green">{t("compressV2.realJ2k")}</Tag>}
            {currentTask?.source === "estimated" && <Tag color="gold">{t("compressV2.estimated")}</Tag>}
            {currentTask?.simulated === false && currentTask?.source !== "real" && (
              <Tag color="blue">{t("compressV2.realRle")}</Tag>
            )}
            {currentTask?.simulated === true && currentTask?.source !== "estimated" && (
              <Tag color="gold">{t("compressV2.estimatedShort")}</Tag>
            )}
          </Space>
        }
        variant="outlined"
        style={{ marginTop: 'var(--space-4, 16px)' }}
      >
        {currentTask ? (
          <div>
            <StatCardGrid minWidth={200} gap={16}>
              <StatCard title={t("compressV2.thTaskId")} value={currentTask.id} size="sm" />
              <StatCard
                title={t("compressV2.thStatus")}
                value={currentTask.status === "done" ? t("compressV2.statusDone") : currentTask.status === "processing" ? t("compressV2.statusProcessing") : currentTask.status}
                color={currentTask.status === "done" ? "success" : undefined}
                size="sm"
              />
              <StatCard title={t("compressV2.thAlgorithm")} value={currentTask.algorithmName ?? currentTask.transferSyntax} size="sm" />
              <StatCard title={t("compressV2.thModality")} value={currentTask.modality ?? "-"} size="sm" />
            </StatCardGrid>
            {(currentTask.status === "pending" || currentTask.status === "processing") && (
              <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                <Text>{t("compressV2.progressing")}</Text>
                <Progress percent={currentTask.progress} />
              </div>
            )}
            {currentTask.status === "done" && currentTask.compressedSize !== null && (
              <div>
                <StatCardGrid minWidth={200} gap={16} style={{ marginTop: 'var(--space-3, 12px)' }}>
                  <StatCard
                    title={t("compressV2.thOriginalSize")}
                    value={formatBytes(currentTask.originalSize)}
                    icon={<File size={14} />}
                    size="sm"
                  />
                  <StatCard
                    title={t("compressV2.thCompressed")}
                    value={formatBytes(currentTask.compressedSize)}
                    icon={<File size={14} />}
                    size="sm"
                  />
                  <StatCard
                    title={t("compressV2.thRealRatio")}
                    value={currentTask.ratio ? `${currentTask.ratio.toFixed(2)}×` : "-"}
                    color="primary"
                    size="sm"
                  />
                  <StatCard
                    title={t("compressV2.thSavedPct")}
                    value={savedPercent !== null ? `${savedPercent}%` : "-"}
                    color={savedPercent !== null && savedPercent > 0 ? "success" : undefined}
                    size="sm"
                  />
                  <StatCard
                    title={t("compressV2.thElapsed")}
                    value={currentTask.elapsedMs !== undefined ? `${currentTask.elapsedMs} ms` : "-"}
                    size="sm"
                  />
                  <StatCard
                    title={t("compressV2.thType")}
                    value={currentTask.lossless ? t("compressV2.lossless") : t("compressV2.lossy")}
                    color={mapColor(currentTask.lossless ? "#52c41a" : "#fa541c")}
                    size="sm"
                  />
                </StatCardGrid>
                <Alert
                  type={currentTask.lossless ? "success" : "warning"}
                  showIcon
                  style={{ marginTop: 'var(--space-3, 12px)' }}
                  message={
                    currentTask.lossless
                      ? t("compressV2.losslessAlert")
                      : t("compressV2.lossyAlert", { q: currentTask.quality ?? "-" })
                  }
                />
              </div>
            )}
            {currentTask.status === "done" && currentTask.compressedSize === null && (
              <Alert type="success" showIcon title={t("compressV2.done")} style={{ marginTop: 'var(--space-3, 12px)' }} />
            )}
            {currentTask.status === "failed" && (
              <Alert type="error" showIcon title={currentTask.error ?? t("compressV2.failed")} style={{ marginTop: 'var(--space-3, 12px)' }} />
            )}
            {currentTask.status === "done" && (
              <Button
                icon={<Maximize2 />}
                style={{ marginTop: 'var(--space-3, 12px)' }}
                onClick={handleDecompress}
              >
                {t("compressV2.decompressVerify")}
              </Button>
            )}
          </div>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={polling ? t("compressV2.compressing") : t("compressV2.notCompressed")} />
        )}
      </Card>

      <Divider />

      <Card
        title={
          <Space>
            <File size={14} />
            {t("compressV2.taskList")}
            {polling && <Tag color="processing">{t("compressV2.polling")}</Tag>}
          </Space>
        }
        variant="outlined"
      >
        {taskStats && (
          <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-3, 12px)' }}>
            <StatCard title={t("compressV2.kpiTotalTasks")} value={taskStats.totalTasks} size="sm" />
            <StatCard title={t("compressV2.kpiCompleted")} value={taskStats.completedTasks} color="success" size="sm" />
            <StatCard title={t("compressV2.kpiFailed")} value={taskStats.failedTasks} color="error" size="sm" />
            <StatCard title={t("compressV2.kpiSavedBytes")} value={formatBytes(taskStats.totalSavedBytes)} size="sm" />
            <StatCard title={t("compressV2.kpiAvgRatio")} value={taskStats.avgRatio ? `${taskStats.avgRatio.toFixed(2)}×` : "-"} size="sm" />
          </StatCardGrid>
        )}
        {tasks.length > 0 ? (
          <DataTable
            dataSource={taskPageData}
            columns={taskColumns}
            rowKey="id"
            pagination={taskPagination}
          scroll={{ x: 'max-content' }}
          />
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("compressV2.noTasks")} />
        )}
      </Card>

      <Divider />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BarChart3 size={16} />
                {t("compressV2.compareTitle")}
                {benchmarkResult?.recommendedName && (
                  <Tag color="gold">{t("compressV2.recommendTag", { name: benchmarkResult.recommendedName })}</Tag>
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {compareRows.length > 0 ? t("compressV2.pixelData", { size: formatBytes(compareRows[0]?.originalSize) }) : ""}
                </Text>
              </Space>
            }
            variant="outlined"
          >
            {comparing ? (
              <Spin tip={t("compressV2.comparing")} style={{ display: "block", padding: 'var(--space-8, 32px)' }}>
                <div style={{ height: 60 }} />
              </Spin>
            ) : compareRows.length > 0 ? (
              <DataTable dataSource={compareRows} columns={compareColumns} rowKey="key" pagination={false} scroll={{ x: 'max-content' }}/>
            ) : (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("compressV2.compareEmptyHint")} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BarChart3 size={16} />
                {t("compressV2.statsTitle")}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t("compressV2.statsSub", { count: ratios.byAlgorithm.reduce((s, a) => s + a.count, 0), saved: formatBytes(ratios.totalSavedBytes), avg: ratios.avgRatio.toFixed(2) })}
                </Text>
              </Space>
            }
            variant="outlined"
          >
            {ratios.byAlgorithm.length > 0 ? (
              <>
                <Text strong style={{ display: "block", marginBottom: 'var(--space-2, 8px)' }}>
                  {t("compressV2.thByAlgo")}
                </Text>
                <DataTable dataSource={ratios.byAlgorithm} columns={ratioColumns} rowKey={r => r.algorithm} pagination={false} scroll={{ x: 'max-content' }}/>
                <Text strong style={{ display: "block", margin: "16px 0 8px" }}>
                  {t("compressV2.thByModality")}
                </Text>
                <DataTable dataSource={ratios.byModality} columns={ratioModalityColumns} rowKey={r => `${r.modality}:${r.algorithm}`} pagination={false} scroll={{ x: 'max-content' }}/>
              </>
            ) : (
              <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description={t("compressV2.noStats")} />
            )}
          </Card>
        </Col>
      </Row>

      {/* [W1-B] 任务详情: GET /dicom/compress/tasks/:id */}
      <Modal
        title={t("compressV2.detailTitle", { id: taskDetail?.id ?? "" })}
        open={taskDetailOpen}
        onCancel={() => setTaskDetailOpen(false)}
        footer={<Button onClick={() => setTaskDetailOpen(false)}>{t("compressV2.close")}</Button>}
        width={560}
      >
        {taskDetail ? (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label={t("compressV2.thTaskId")}><Text code>{taskDetail.id}</Text></Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thFile")}>{taskDetail.fileId}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thStatus")}>
              <Tag color={statusColor[taskDetail.status] ?? "default"}>{taskDetail.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thProgress")}>{taskDetail.progress}%</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thAlgorithm")}>{taskDetail.algorithmName ?? taskDetail.transferSyntax}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thModality")}>{taskDetail.modality ?? "-"}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thOriginal")}>{formatBytes(taskDetail.originalSize)}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thCompressed")}>{formatBytes(taskDetail.compressedSize)}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thRatio")}>{taskDetail.ratio ? `${taskDetail.ratio.toFixed(2)}×` : "-"}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thElapsed")}>{taskDetail.elapsedMs !== undefined ? `${taskDetail.elapsedMs} ms` : "-"}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thType")}>{taskDetail.lossless ? t("compressV2.lossless") : t("compressV2.lossy")}</Descriptions.Item>
            <Descriptions.Item label={t("compressV2.thSource")}>
              {taskDetail.source === "real" ? (
                <Tag color="green">{t("compressV2.realJ2k")}</Tag>
              ) : taskDetail.source === "estimated" || taskDetail.simulated ? (
                <Tag color="gold">{t("compressV2.estimatedShort")}</Tag>
              ) : (
                <Tag color="blue">{t("compressV2.rleApprox")}</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("common.table.createdAt")}>{taskDetail.createdAt}</Descriptions.Item>
            <Descriptions.Item label={t("common.table.updatedAt")}>{taskDetail.updatedAt}</Descriptions.Item>
            {taskDetail.error && <Descriptions.Item label={t("common.table.description")} span={2}><Text type="danger">{taskDetail.error}</Text></Descriptions.Item>}
          </Descriptions>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("compressV2.loading")} />
        )}
      </Modal>
    </PageContainer>
  );
}

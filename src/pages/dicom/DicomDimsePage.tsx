import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card,
  Tabs,
  Button,
  Form,
  Input,
  Select,
  Upload,
  message,
  Tag,
  Space,
  Alert,
  InputNumber,
  Modal,
  Switch,
  Progress,
} from "antd";
import { Send, Search, Upload as UploadIcon, ArrowRight, CheckCircle, XCircle, Radio, RefreshCw, Plus, Lock, Clock3, FileKey, Save, ListOrdered, Pause, Play, RotateCcw, Ban } from 'lucide-react'
import { dicomDimseApi, type DicomTlsConfig, type MppsRecord, type TransferRecord, type TransferStats } from '../../services/api/dicomApi'
import { usePagination } from '../../hooks/usePagination'
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common"
import { t } from '../../i18n/appI18n'
import { severityToAntd, toneToAntd } from '../../theme/statusTokens'

const STAT_COLOR_MAP: Record<string, string> = {
  '#cf1322': 'error', 'var(--color-error-600)': 'error', '#f5222d': 'error', '#ff4d4f': 'error',
  '#fa8c16': 'warning', '#faad14': 'warning', 'var(--color-warning-600)': 'warning', '#ff7a45': 'warning',
  '#52c41a': 'success', 'var(--color-success-600)': 'success', '#059669': 'success',
  '#1890ff': 'primary', 'var(--color-primary-600)': 'primary', 'var(--color-primary-700)': 'primary',
  '#13c2c2': 'info',
}
const mapColor = (c?: string): string | undefined => (c ? STAT_COLOR_MAP[c.toLowerCase()] ?? c : c)

const DIMSE_STATUS_LABEL: Record<string, string> = { SUCCESS: t('dicomDimse.statusSuccess') };

const MPPS_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: t('dicomDimse.statusInProgress'),
  COMPLETED: t('dicomDimse.statusCompleted'),
  DISCONTINUED: t('dicomDimse.statusDiscontinued'),
}

const ECHO_COLUMNS: any[] = [
  { title: t('dicomDimse.colAeTitle'), dataIndex: 'aeTitle', key: 'aeTitle' },
  { title: t('dicomDimse.colIp'), dataIndex: 'ip', key: 'ip' },
  { title: t('dicomDimse.colPort'), dataIndex: 'port', key: 'port' },
  { title: t('dicomDimse.colModality'), dataIndex: 'modality', key: 'modality' },
  { title: t('dicomDimse.colConnectivity'), dataIndex: 'pingMs', key: 'pingMs', render: (v: number | null) => v != null ? `${v} ms` : '-' },
  // [G005 v3.0.6.11-90 Wave 4B (G-10)] 在线状态列 (轮询 C-ECHO 结果): 在线/离线/未知
  {
    title: t('dicomDimse.colOnlineStatus'),
    dataIndex: 'status',
    key: 'online',
    render: (v: string | null) => v === 'SUCCESS'
      ? <Tag color="green" icon={<CheckCircle size={14} />}>{t('dicomDimse.online')}</Tag>
      : v === 'FAIL'
        ? <Tag color="red" icon={<XCircle size={14} />}>{t('dicomDimse.offline')}</Tag>
        : <Tag color="default">{t('dicomDimse.unknown')}</Tag>,
  },
  {
    title: t('dicomDimse.colLastChecked'),
    dataIndex: 'lastCheckedAt',
    key: 'lastCheckedAt',
    render: (v: string | null) => v ? new Date(v).toLocaleTimeString() : '-',
  },
]

const MWL_COLUMNS = [
  { title: t('dicomDimse.colPatientName'), dataIndex: 'patientName', key: 'patientName' },
  { title: t('dicomDimse.colPatientId'), dataIndex: 'patientId', key: 'patientId' },
  { title: t('dicomDimse.colAccession'), dataIndex: 'accessionNumber', key: 'accessionNumber' },
  { title: t('dicomDimse.colModality'), dataIndex: 'modality', key: 'modality' },
  { title: t('dicomDimse.colStudyDate'), dataIndex: 'studyDate', key: 'studyDate' },
  { title: t('dicomDimse.colStatus'), dataIndex: 'status', key: 'status' },
]

const C_STORE_COLUMNS = [
  { title: t('dicomDimse.colSopUid'), dataIndex: 'sopInstanceUid', key: 'sopInstanceUid', ellipsis: true },
  { title: t('dicomDimse.colStoragePath'), dataIndex: 'storagePath', key: 'storagePath', ellipsis: true },
  { title: t('dicomDimse.colSize'), dataIndex: 'sizeBytes', key: 'sizeBytes', render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
  { title: t('dicomDimse.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
]

const C_MOVE_COLUMNS = [
  { title: t('dicomDimse.colStudyUid'), dataIndex: 'studyUid', key: 'studyUid', ellipsis: true },
  { title: t('dicomDimse.colDestAe'), dataIndex: 'destAe', key: 'destAe' },
  { title: t('dicomDimse.colTransferred'), dataIndex: 'transferredCount', key: 'transferredCount' },
  { title: t('dicomDimse.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
]

// [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度列
const MPPS_STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: toneToAntd('in_progress'),
  COMPLETED: toneToAntd('completed'),
  DISCONTINUED: toneToAntd('failed'),
}
const MPPS_COLUMNS = [
  { title: t('dicomDimse.colStudyUid'), dataIndex: 'studyUid', key: 'studyUid', ellipsis: true },
  { title: t('dicomDimse.colPatient'), dataIndex: 'patientName', key: 'patientName', render: (v?: string) => v || '-' },
  { title: t('dicomDimse.colModality'), dataIndex: 'modality', key: 'modality', render: (v?: string) => v || '-' },
  { title: t('dicomDimse.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={MPPS_STATUS_COLOR[v] ?? 'default'}>{MPPS_STATUS_LABEL[v] ?? v}</Tag> },
  { title: t('dicomDimse.colStartedAt'), dataIndex: 'startedAt', key: 'startedAt', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
  { title: t('dicomDimse.colCompletedAt'), dataIndex: 'completedAt', key: 'completedAt', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
  { title: t('dicomDimse.colSteps'), dataIndex: 'performedSteps', key: 'performedSteps', render: (v?: unknown[]) => Array.isArray(v) ? v.length : 0 },
  { title: t('dicomDimse.colSource'), dataIndex: 'source', key: 'source', render: (v?: string) => <Tag color={v === 'exam' ? 'blue' : 'default'}>{v === 'exam' ? t('dicomDimse.sourceExam') : t('dicomDimse.sourceMpps')}</Tag> },
]

const TLS_NODE_COLUMNS = [
  { title: t('dicomDimse.colAeTitle'), dataIndex: 'aeTitle', key: 'aeTitle' },
  { title: t('dicomDimse.colIp'), dataIndex: 'ip', key: 'ip' },
  { title: t('dicomDimse.colPort'), dataIndex: 'port', key: 'port' },
  { title: t('dicomDimse.colModality'), dataIndex: 'modality', key: 'modality' },
  { title: t('dicomDimse.colTls'), key: 'tls', render: (_: unknown, r: any) => <Tag color={r._tlsEnabled ? 'green' : 'default'}>{r._tlsEnabled ? t('dicomDimse.tlsEnabled') : t('dicomDimse.tlsDisabled')}</Tag> },
  { title: t('dicomDimse.colAction'), key: 'action', render: (_: unknown, r: any) => (
    <Switch
      size="small"
      checked={r._tlsEnabled}
      loading={r._tlsSaving}
      onChange={(checked) => r._onToggleTls(checked)}
    />
  ) },
]

// [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] 传输队列状态/标签映射
const TRANSFER_STATUS_META: Record<string, { color: string; label: string }> = {
  queued: { color: toneToAntd('queued'), label: t('dicomDimse.transferQueued') },
  sending: { color: toneToAntd('in_progress'), label: t('dicomDimse.transferSending') },
  paused: { color: toneToAntd('paused'), label: t('dicomDimse.transferPaused') },
  failed: { color: toneToAntd('failed'), label: t('dicomDimse.transferFailed') },
  completed: { color: toneToAntd('completed'), label: t('dicomDimse.transferCompleted') },
  canceled: { color: toneToAntd('cancelled'), label: t('dicomDimse.transferCanceled') },
}

const TRANSFER_PRIORITY_COLOR: Record<string, string> = { HIGH: severityToAntd('high'), NORMAL: severityToAntd('normal'), LOW: severityToAntd('neutral') }
const TRANSFER_PRIORITY_LABEL: Record<string, string> = { HIGH: t('dicomDimse.priorityHigh'), NORMAL: t('dicomDimse.priorityNormal'), LOW: t('dicomDimse.priorityLow') }

interface DimseDevice {
  aeTitle: string
  ip: string
  port: number
  modality: string
  pingMs: number | null
  status: string | null
  lastCheckedAt: string | null
  _echoing: boolean
}

const INITIAL_DEVICES: DimseDevice[] = [
  { aeTitle: 'CT_SCANNER_01', ip: '192.168.1.101', port: 11112, modality: 'CT', pingMs: null, status: null, lastCheckedAt: null, _echoing: false },
  { aeTitle: 'MR_SCANNER_02', ip: '192.168.1.102', port: 11113, modality: 'MR', pingMs: null, status: null, lastCheckedAt: null, _echoing: false },
  { aeTitle: 'XA_LAB_01', ip: '192.168.1.103', port: 11114, modality: 'XA', pingMs: null, status: null, lastCheckedAt: null, _echoing: false },
  { aeTitle: 'US_UNIT_01', ip: '192.168.1.104', port: 11115, modality: 'US', pingMs: null, status: null, lastCheckedAt: null, _echoing: false },
]

// [G005 v3.0.6.11-90 Wave 4B (G-10)] 在线状态轮询间隔
const POLL_INTERVAL_MS = 30_000

export const DicomDimsePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('echo')
  const [devices, setDevices] = useState<DimseDevice[]>(INITIAL_DEVICES)
  const [mwlResults, setMwlResults] = useState<any[]>([])
  const [mwlLoading, setMwlLoading] = useState(false)
  const [mwlForm] = Form.useForm()
  const [storeResults, setStoreResults] = useState<any[]>([])
  const [moveForm] = Form.useForm()
  const [moveResults, setMoveResults] = useState<any[]>([])
  const [moveLoading, setMoveLoading] = useState(false)
  const [deviceModal, setDeviceModal] = useState(false)
  const [deviceForm] = Form.useForm()
  // [W3-C] 受控分页: MWL 结果表 (C-FIND)
  const mwlPagination = usePagination(mwlResults, 10)
  // [G005 2B] 受控分页: 设备列表 (添加设备可增长)
  const devicePagination = usePagination(devices, 10)
  // [G005 2B] 受控分页: C-STORE / C-MOVE 结果表 (数据可增长)
  const storePagination = usePagination(storeResults, 10)
  const movePagination = usePagination(moveResults, 10)
  // [G005 v3.0.6.11-86 Wave 4B (G-03)] TLS 配置状态
  const [tlsConfig, setTlsConfig] = useState<DicomTlsConfig>({ enabled: false, port: 2762, verifyPeer: false })
  const [tlsLoading, setTlsLoading] = useState(true)
  const [tlsSaving, setTlsSaving] = useState(false)
  const [tlsCertFile, setTlsCertFile] = useState<string>()
  const [tlsCaCertFile, setTlsCaCertFile] = useState<string>()
  const [tlsNodes, setTlsNodes] = useState<any[]>([])
  // [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度状态
  const [mppsForm] = Form.useForm()
  const [mppsRecords, setMppsRecords] = useState<MppsRecord[]>([])
  const [mppsLoading, setMppsLoading] = useState(false)
  const [mppsSending, setMppsSending] = useState(false)
  const mppsPagination = usePagination(mppsRecords, 10)
  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列状态
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [transferStats, setTransferStats] = useState<TransferStats | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferModal, setTransferModal] = useState(false)
  const [transferForm] = Form.useForm()
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const transferPagination = usePagination(transfers, 10)
  // [G005 v3.0.6.11-90 Wave 4B (G-10)] 在线状态轮询
  const [autoPoll, setAutoPoll] = useState(true)
  const [pollRunning, setPollRunning] = useState(false)
  const devicesRef = useRef(devices)
  const pollRunningRef = useRef(false)

  useEffect(() => { devicesRef.current = devices }, [devices])

  // 轮询: 串行 C-ECHO, 失败静默降级 (状态未知 + 记时间), 不产生 console.error
  const pollDevices = useCallback(async () => {
    if (pollRunningRef.current) return
    const list = devicesRef.current
    if (!list.length) return
    pollRunningRef.current = true
    setPollRunning(true)
    try {
      // 节点过多 (>10) 时全部串行, 逐节点节流避免并发打满
      for (const device of list) {
        const res = await dicomDimseApi.cEcho({ calledAeTitle: device.aeTitle })
        const payload = (res.data as { data?: unknown })?.data ?? res.data
        const ok = res.success && (payload as any)?.statusCode === 0
        setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle
          ? {
              ...d,
              status: ok ? 'SUCCESS' : null,
              pingMs: ok ? ((payload as any)?.pingMs ?? d.pingMs) : d.pingMs,
              lastCheckedAt: new Date().toISOString(),
            }
          : d))
        await new Promise<void>(resolve => setTimeout(resolve, 150))
      }
    } catch {
      // 静默降级: 保持现有数据, 不中断
    } finally {
      pollRunningRef.current = false
      setPollRunning(false)
    }
  }, [])

  // [G005 v3.0.6.11-90 Wave 4B (G-10)] 每 30s 自动轮询, 组件卸载 clearInterval
  useEffect(() => {
    if (!autoPoll) return
    void pollDevices()
    const timer = setInterval(() => { void pollDevices() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [autoPoll, pollDevices])

  const loadTransfers = useCallback(async () => {
    setTransferLoading(true)
    const [listRes, statsRes] = await Promise.all([
      dicomDimseApi.listTransfers().catch(() => ({ success: false as const, data: undefined as TransferRecord[] | undefined })),
      dicomDimseApi.getTransferStats().catch(() => ({ success: false as const, data: undefined as TransferStats | undefined })),
    ])
    if (listRes.success && Array.isArray(listRes.data)) setTransfers(listRes.data)
    if (statsRes.success && statsRes.data) setTransferStats(statsRes.data)
    setTransferLoading(false)
  }, [])

  const loadTlsConfig = useCallback(async () => {
    setTlsLoading(true)
    const res = await dicomDimseApi.getTlsConfig()
    if (res.success && res.data) setTlsConfig(res.data)
    setTlsLoading(false)
  }, [])

  const loadMpps = useCallback(async () => {
    setMppsLoading(true)
    const res = await dicomDimseApi.listMpps()
    if (res.success) setMppsRecords(Array.isArray(res.data) ? res.data : [])
    setMppsLoading(false)
  }, [])

  const handleNodeTlsToggle = useCallback(async (device: DimseDevice, checked: boolean) => {
    setTlsNodes(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, _tlsSaving: true } : d))
    const res = await dicomDimseApi.setNodeTls(device.aeTitle, checked)
    setTlsNodes(prev => prev.map(d => d.aeTitle === device.aeTitle
      ? { ...d, _tlsEnabled: res.success ? !!res.data?.tlsEnabled : checked, _tlsSaving: false }
      : d))
    if (!res.success) message.error(res.error?.message ?? t('dicomDimse.nodeTlsUpdateFailed'))
    else message.success(t('dicomDimse.nodeTlsMsg', { ae: device.aeTitle, state: res.data?.tlsEnabled ? t('dicomDimse.tlsEnabled') : t('dicomDimse.nodeTlsDisabled') }))
  }, [])

  // 节点级 TLS 行: 设备列表同步 + 远程开关状态加载
  useEffect(() => {
    setTlsNodes(prev => devices.map(d => {
      const existing = prev.find(p => p.aeTitle === d.aeTitle)
      return { ...d, _tlsEnabled: existing?._tlsEnabled ?? false, _tlsSaving: false, _onToggleTls: (checked: boolean) => handleNodeTlsToggle(d, checked) }
    }))
  }, [devices, handleNodeTlsToggle])

  useEffect(() => {
    void loadTlsConfig()
    void loadMpps()
    void loadTransfers()
    let cancelled = false
    Promise.all(devices.map(d => dicomDimseApi.getNodeTls(d.aeTitle)
      .then(r => ({ ae: d.aeTitle, enabled: !!r.data?.tlsEnabled }))
      .catch(() => ({ ae: d.aeTitle, enabled: false }))))
      .then(results => {
        if (cancelled) return
        setTlsNodes(prev => prev.map(p => {
          const hit = results.find(r => r.ae === p.aeTitle)
          return hit ? { ...p, _tlsEnabled: hit.enabled } : p
        }))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveTls = async () => {
    setTlsSaving(true)
    const res = await dicomDimseApi.updateTlsConfig({
      enabled: tlsConfig.enabled,
      port: tlsConfig.port,
      verifyPeer: tlsConfig.verifyPeer,
      certificate: tlsCertFile,
      caCert: tlsCaCertFile,
    })
    if (res.success) {
      setTlsConfig(res.data ?? tlsConfig)
      message.success(t('dicomDimse.tlsSaved'))
    } else {
      message.error(res.error?.message ?? t('dicomDimse.tlsSaveFailed'))
    }
    setTlsSaving(false)
  }

  const handleMppsSend = async (values: any) => {
    setMppsSending(true)
    const res = await dicomDimseApi.sendMpps({ studyUid: values.studyUid, status: values.status })
    if (res.success) {
      message.success(t('dicomDimse.mppsUpdated', { status: MPPS_STATUS_LABEL[values.status] ?? values.status }))
      mppsForm.resetFields()
      void loadMpps()
    } else {
      message.error(res.error?.message ?? t('dicomDimse.mppsSendFailed'))
    }
    setMppsSending(false)
  }

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] 传输队列操作
  const runTransferAction = async (id: string, action: 'retry' | 'pause' | 'resume' | 'cancel') => {
    const apiCall = {
      retry: dicomDimseApi.retryTransfer,
      pause: dicomDimseApi.pauseTransfer,
      resume: dicomDimseApi.resumeTransfer,
      cancel: dicomDimseApi.cancelTransfer,
    }[action]
    const res = await apiCall(id)
    if (res.success) {
      message.success(t('dicomDimse.transferActionDone', { id, action: action === 'retry' ? t('dicomDimse.actionRetry') : action === 'pause' ? t('dicomDimse.actionPause') : action === 'resume' ? t('dicomDimse.actionResume') : t('dicomDimse.actionCancel') }))
      void loadTransfers()
    } else {
      message.error(res.error?.message ?? t('dicomDimse.opFailed'))
    }
  }

  // [G005 W4B] 推进传输队列 (POST /dicom-dimse/transfers/process)
  const [processingQueue, setProcessingQueue] = useState(false)
  const handleProcessQueue = async () => {
    setProcessingQueue(true)
    try {
      const res = await dicomDimseApi.processTransfers()
      if (res.success && res.data) {
        message.success(t('w4b.dimse.processed', { processed: res.data.processed, completed: res.data.completed, retried: res.data.retried }))
        void loadTransfers()
      } else {
        message.error(res.error?.message ?? t('w4b.dimse.processFailed'))
      }
    } catch {
      message.error(t('w4b.dimse.processFailed'))
    } finally {
      setProcessingQueue(false)
    }
  }

  const handleEnqueueTransfer = async () => {
    try {
      const values = await transferForm.validateFields()
      setTransferSubmitting(true)
      // [v3.0.6.11-96 Wave 2B (D)] 可选关联检查 (examId/accessionNumber, worklist 联动)
      const res = await dicomDimseApi.enqueueTransfer({
        studyUid: values.studyUid,
        targetAe: values.targetAe,
        priority: values.priority,
        examId: values.examId || undefined,
        accessionNumber: values.accessionNumber || undefined,
      })
      if (res.success) {
        message.success(t('dicomDimse.transferEnqueued', { id: res.data.id, ae: values.targetAe }))
        setTransferModal(false)
        transferForm.resetFields()
        void loadTransfers()
      } else {
        message.error(res.error?.message ?? t('dicomDimse.enqueueFailed'))
      }
    } catch { /* 校验失败忽略 */ }
    setTransferSubmitting(false)
  }

  const handleEcho = async (device: DimseDevice) => {
    setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, _echoing: true } : d))
    const start = performance.now()
    const res = await dicomDimseApi.cEcho({ calledAeTitle: device.aeTitle })
    const elapsed = Math.round(performance.now() - start)
    const now = new Date().toISOString()
    if (res.success) {
      // [G005 P1] 响应形状统一: 后端直接返回 C-ECHO 对象 (无 data 双包裹)
      const payload = (res.data as { data?: unknown })?.data ?? res.data
      setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, pingMs: (payload as any)?.pingMs ?? elapsed, status: 'SUCCESS', lastCheckedAt: now, _echoing: false } : d))
    } else {
      setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, pingMs: elapsed, status: 'FAIL', lastCheckedAt: now, _echoing: false } : d))
    }
  }

  const handleMwlQuery = async (values: any) => {
    setMwlLoading(true)
    const res = await dicomDimseApi.cFind({
      patientName: values.patientName,
      patientId: values.patientId,
      accessionNumber: values.accessionNumber,
      modality: values.modality,
    })
    // [G005 P1] 双形状兼容: 后端 { matches, items } / MSW { data: [...] }
    const items = (res.data as { items?: unknown[] })?.items ?? (res.data as { data?: unknown })?.data ?? res.data
    if (res.success && items !== undefined && items !== null) {
      setMwlResults(Array.isArray(items) ? items : [])
    } else {
      message.error(res.error?.message || t('dicomDimse.mwlQueryFailed'))
    }
    setMwlLoading(false)
  }

  // [v3.0.6.11-96 Wave 3A P2] C-STORE 多帧逐帧上传: 文件列表 + 每帧进度 + 失败重试
  interface StoreUploadItem {
    uid: string
    file: File
    name: string
    size: number
    status: 'pending' | 'uploading' | 'success' | 'fail'
    progress: number
    error?: string
  }
  const [storeModal, setStoreModal] = useState(false)
  const [storeItems, setStoreItems] = useState<StoreUploadItem[]>([])
  const [storeBatchRunning, setStoreBatchRunning] = useState(false)
  const storeFileInputRef = useRef<HTMLInputElement>(null)

  const onSelectStoreFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list: StoreUploadItem[] = Array.from(files).map((f) => ({
      uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending',
      progress: 0,
    }))
    setStoreItems(prev => [...prev, ...list])
    if (storeFileInputRef.current) storeFileInputRef.current.value = ''
  }

  // 单帧上传 (带逐帧进度回调), 成功/失败同步 storeResults
  const uploadOneStoreItem = async (item: StoreUploadItem) => {
    const formData = new FormData()
    formData.append('file', item.file)
    setStoreItems(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'uploading', progress: 0, error: undefined } : i))
    try {
      // [v3.0.6.11-92] W2-B P2: raw fetch → dicomDimseApi.cStore (multipart 兼容)
      // [v3.0.6.11-96 Wave 3A P2] onProgress 逐帧回调 (XHR upload.onprogress)
      const res = await dicomDimseApi.cStore(formData, (percent) => {
        setStoreItems(prev => prev.map(i => i.uid === item.uid ? { ...i, progress: percent } : i))
      })
      if (res.success) {
        setStoreItems(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'success', progress: 100 } : i))
        setStoreResults(prev => [...prev, { fileName: item.name, status: 'SUCCESS', sizeBytes: item.size }])
        return true
      }
      setStoreItems(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'fail', error: res.error?.message ?? t('dicomDimse.cstoreFailed') } : i))
      setStoreResults(prev => [...prev, { fileName: item.name, status: 'FAIL', sizeBytes: item.size }])
      return false
    } catch {
      setStoreItems(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'fail', error: t('dicomDimse.cstoreNetworkError') } : i))
      setStoreResults(prev => [...prev, { fileName: item.name, status: 'FAIL', sizeBytes: item.size }])
      return false
    }
  }

  // 逐帧顺序上传 (串行避免并发打满)
  const handleBatchStore = async () => {
    const pending = storeItems.filter(i => i.status === 'pending' || i.status === 'fail')
    if (pending.length === 0) return
    setStoreBatchRunning(true)
    let ok = 0
    for (const item of pending) {
      const success = await uploadOneStoreItem(item)
      if (success) ok += 1
    }
    setStoreBatchRunning(false)
    message.success(t('dicomDimse.uploadComplete', { ok, fail: pending.length - ok }))
  }

  const storeOverallPercent = storeItems.length === 0
    ? 0
    : Math.round(storeItems.reduce((sum, i) => sum + i.progress, 0) / storeItems.length)

  const handleMove = async (values: any) => {
    setMoveLoading(true)
    const res = await dicomDimseApi.cMove({
      studyInstanceUid: values.studyUid,
      destinationAe: values.destAe,
      destinationHost: values.destHost,
      destinationPort: values.destPort,
    })
    if (res.success) {
      // [G005 P1] 双形状兼容: 后端 numberOfCompletedSubOperations / MSW transferredCount
      const payload = (res.data as { data?: unknown })?.data ?? res.data
      setMoveResults(prev => [...prev, { studyUid: values.studyUid, destAe: values.destAe, transferredCount: (payload as any)?.numberOfCompletedSubOperations ?? (payload as any)?.transferredCount ?? 0, status: 'SUCCESS' }])
      message.success(t('dicomDimse.cmoveCompleted'))
    } else {
      setMoveResults(prev => [...prev, { studyUid: values.studyUid, destAe: values.destAe, transferredCount: 0, status: 'FAIL' }])
      message.error(t('dicomDimse.cmoveFailed'))
    }
    setMoveLoading(false)
  }

  const handleAddDevice = async () => {
    try {
      const values = await deviceForm.validateFields()
      setDevices(prev => [...prev, { ...values, pingMs: null, status: null, lastCheckedAt: null, _echoing: false }])
      setDeviceModal(false)
      deviceForm.resetFields()
      message.success(t('dicomDimse.deviceAdded'))
    } catch { /* ignore */ }
  }

  const tabItems = [
    {
      key: 'echo',
      label: <Space><Send />C-ECHO</Space>,
      children: (
        <Card size="small" title={t('dicomDimse.deviceListTitle')} extra={
          <Space>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{t('dicomDimse.autoPoll')}</span>
            <Switch size="small" checked={autoPoll} onChange={setAutoPoll} />
            <Button icon={<RefreshCw size={14} />} loading={pollRunning} onClick={() => void pollDevices()}>{t('dicomDimse.refreshStatus')}</Button>
            <Button icon={<Plus size={14} />} onClick={() => setDeviceModal(true)}>{t('dicomDimse.addDevice')}</Button>
            <Button icon={<RefreshCw size={14} />} onClick={() => setDevices(INITIAL_DEVICES)}>{t('dicomDimse.reset')}</Button>
          </Space>
        }>
          <DataTable scroll={{ x: 'max-content' }}
            dataSource={devicePagination.pageData}
            rowKey="aeTitle"
            pagination={devicePagination.pagination}
            columns={[
              ...ECHO_COLUMNS,
              {
                title: t('dicomDimse.colAction'),
                key: 'action',
                render: (_: any, record: DimseDevice) => (
                  <Button type="primary" size="small" icon={<Send />} loading={record._echoing} onClick={() => handleEcho(record)}>{t('dicomDimse.echoTest')}</Button>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'mwl',
      label: <Space><Search />C-FIND (MWL)</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <Form form={mwlForm} layout="inline" onFinish={handleMwlQuery}>
              <Form.Item name="patientName" label={t('dicomDimse.labelName')}><Input placeholder={t('dicomDimse.phPatientName')} allowClear /></Form.Item>
              <Form.Item name="patientId" label={t('dicomDimse.labelId')}><Input placeholder={t('dicomDimse.phPatientId')} allowClear /></Form.Item>
              <Form.Item name="accessionNumber" label={t('dicomDimse.labelAccession')}><Input placeholder={t('dicomDimse.phAccession')} allowClear /></Form.Item>
              <Form.Item name="modality" label={t('dicomDimse.labelModality')}>
                <Select allowClear placeholder={t('dicomDimse.phAll')} style={{ width: 100 }}>
                  <Select.Option value="CT">CT</Select.Option>
                  <Select.Option value="MR">MR</Select.Option>
                  <Select.Option value="XA">XA</Select.Option>
                  <Select.Option value="US">US</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<Search />} loading={mwlLoading}>{t('dicomDimse.query')}</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title={t('dicomDimse.worklistTitle')}>
            <DataTable scroll={{ x: 'max-content' }} dataSource={mwlPagination.pageData} rowKey={(r, i) => r.accessionNumber || `${i}`} columns={MWL_COLUMNS} loading={mwlLoading} pagination={mwlPagination.pagination}/>
          </Card>
        </>
      ),
    },
    {
      key: 'cstore',
      label: <Space><UploadIcon />C-STORE</Space>,
      children: (
        <Card size="small" title={t('dicomDimse.fileUploadTitle')}
          extra={
            <Space>
              <Button icon={<Upload />} type="primary" onClick={() => setStoreModal(true)}>{t('dicomDimse.selectDcmFiles')}</Button>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{t('dicomDimse.fileSelectHint')}</span>
            </Space>
          }>
          <Alert title={t('dicomDimse.fileUploadAlert')} type="info" showIcon style={{ marginBottom: 'var(--space-3, 12px)' }} />
          <DataTable scroll={{ x: 'max-content' }} dataSource={storePagination.pageData} rowKey={(r, i) => r.sopInstanceUid || `${i}`} columns={C_STORE_COLUMNS} pagination={storePagination.pagination} />
        </Card>
      ),
    },
    {
      key: 'cmove',
      label: <Space><ArrowRight />C-MOVE</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <Form form={moveForm} layout="inline" onFinish={handleMove}>
              <Form.Item name="studyUid" label={t('dicomDimse.labelStudyUid')} rules={[{ required: true, message: t('dicomDimse.requiredStudyUid') }]}>
                <Input placeholder={t('dicomDimse.phStudyUid')} style={{ width: 320 }} />
              </Form.Item>
              <Form.Item name="destAe" label={t('dicomDimse.labelDestAe')} rules={[{ required: true }]}>
                <Input placeholder="DEST_AE" />
              </Form.Item>
              <Form.Item name="destHost" label={t('dicomDimse.labelHost')}>
                <Input placeholder="192.168.1.200" />
              </Form.Item>
              <Form.Item name="destPort" label={t('dicomDimse.labelPort')}>
                <InputNumber placeholder="11112" min={1} max={65535} />
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<ArrowRight />} loading={moveLoading}>{t('dicomDimse.forward')}</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title={t('dicomDimse.cmoveRecords')}>
            <DataTable scroll={{ x: 'max-content' }} dataSource={movePagination.pageData} rowKey={(r, i) => `${r.studyUid}-${i}`} columns={C_MOVE_COLUMNS} pagination={movePagination.pagination} />
          </Card>
        </>
      ),
    },
    {
      key: 'tls',
      label: <Space><Lock />{t('dicomDimse.tabTls')}</Space>,
      children: (
        <>
          <Card
            size="small"
            title={t('dicomDimse.tlsGlobalConfig')}
            extra={<Button size="small" type="primary" icon={<Save size={14} />} loading={tlsSaving} onClick={() => void handleSaveTls()}>{t('dicomDimse.saveConfig')}</Button>}
            style={{ marginBottom: 'var(--space-4, 16px)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' }}>
              <div style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('dicomDimse.enableDicomTls')}</div>
                <Switch checked={tlsConfig.enabled} onChange={(v) => setTlsConfig(prev => ({ ...prev, enabled: v }))} />
                <span style={{ marginLeft: 'var(--space-2, 8px)', color: 'var(--text-muted, #64748b)', fontSize: 12 }}>{t('dicomDimse.tlsHint')}</span>
              </div>
              <div style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('dicomDimse.tlsPort')}</div>
                <InputNumber min={1} max={65535} value={tlsConfig.port} onChange={(v) => setTlsConfig(prev => ({ ...prev, port: v ?? 2762 }))} />
              </div>
              <div style={{ marginBottom: 'var(--space-2, 8px)' }}>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('dicomDimse.verifyCert')}</div>
                <Switch checked={tlsConfig.verifyPeer} onChange={(v) => setTlsConfig(prev => ({ ...prev, verifyPeer: v }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}><FileKey size={12} style={{ verticalAlign: -2 }} /> {t('dicomDimse.serverCert')}</div>
                <Upload accept=".pem,.crt,.cer" showUploadList={false} beforeUpload={(file) => { readFileText(file).then(setTlsCertFile); return false }}>
                  <Button size="small" icon={<UploadIcon size={12} />}>{tlsCertFile ? t('dicomDimse.certSelected') : t('dicomDimse.selectCert')}</Button>
                </Upload>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('dicomDimse.caCert')}</div>
                <Upload accept=".pem,.crt,.cer" showUploadList={false} beforeUpload={(file) => { readFileText(file).then(setTlsCaCertFile); return false }}>
                  <Button size="small" icon={<UploadIcon size={12} />}>{tlsCaCertFile ? t('dicomDimse.caSelected') : t('dicomDimse.selectCa')}</Button>
                </Upload>
              </div>
            </div>
          </Card>
          <Card size="small" title={t('dicomDimse.tlsNodeTitle')}>
            <DataTable scroll={{ x: 'max-content' }} rowKey="aeTitle" dataSource={tlsNodes} columns={TLS_NODE_COLUMNS} loading={tlsLoading} pagination={false} />
          </Card>
        </>
      ),
    },
    {
      key: 'mpps',
      label: <Space><Clock3 />{t('dicomDimse.mppsProgressTitle')}</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <Form form={mppsForm} layout="inline" onFinish={handleMppsSend}>
              <Form.Item name="studyUid" label={t('dicomDimse.labelStudyUid')} rules={[{ required: true, message: t('dicomDimse.requiredStudyUid') }]}>
                <Input placeholder={t('dicomDimse.phStudyUidOrExam')} style={{ width: 320 }} />
              </Form.Item>
              <Form.Item name="status" label={t('dicomDimse.labelStatus')} rules={[{ required: true }]} initialValue="IN_PROGRESS">
                <Select style={{ width: 160 }}>
                  <Select.Option value="IN_PROGRESS">{t('dicomDimse.statusInProgress')}</Select.Option>
                  <Select.Option value="COMPLETED">{t('dicomDimse.statusCompleted')}</Select.Option>
                  <Select.Option value="DISCONTINUED">{t('dicomDimse.statusDiscontinued')}</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<Clock3 size={14} />} loading={mppsSending}>{t('dicomDimse.sendMpps')}</Button>
              </Form.Item>
              <Form.Item>
                <Button icon={<RefreshCw size={14} />} onClick={() => void loadMpps()} loading={mppsLoading}>{t('dicomDimse.refresh')}</Button>
              </Form.Item>
            </Form>
          </Card>
          <Card size="small" title={t('dicomDimse.mppsProgressTitle2')}>
            <DataTable scroll={{ x: 'max-content' }} dataSource={mppsPagination.pageData} rowKey="studyUid" columns={MPPS_COLUMNS} loading={mppsLoading} pagination={mppsPagination.pagination} locale={{ emptyText: t('w2Empty.mppsEmpty') }} />
          </Card>
        </>
      ),
    },
    {
      key: 'transfers',
      label: <Space><ListOrdered />{t('dicomDimse.tabTransfers')}</Space>,
      children: (
        <>
          <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
            {[
              { title: t('dicomDimse.statTotal'), value: transferStats?.total ?? 0, color: 'var(--color-primary-800)' },
              { title: t('dicomDimse.statActive'), value: transferStats?.activeCount ?? 0, color: 'var(--color-info-600)' },
              { title: t('dicomDimse.statSending'), value: transferStats?.sending ?? 0, color: 'var(--color-primary-600)' },
              { title: t('dicomDimse.statFailed'), value: transferStats?.failed ?? 0, color: 'var(--color-error-600)' },
              { title: t('dicomDimse.statCompleted'), value: transferStats?.completed ?? 0, color: '#059669' },
              { title: t('dicomDimse.statSuccessRate'), value: transferStats?.successRate != null ? `${transferStats.successRate}%` : '-', color: '#7c3aed' },
            ].map(s => (
              <StatCard key={s.title} title={s.title} value={s.value} color={mapColor(s.color)} size="sm" />
            ))}
          </StatCardGrid>
          <Card size="small" title={t('dicomDimse.transferQueueTitle')} extra={
            <Space>
              <Button size="small" icon={<RefreshCw size={14} />} onClick={() => void loadTransfers()} loading={transferLoading}>{t('dicomDimse.refresh')}</Button>
              {/* [G005 W4B] 推进传输队列 (POST /dicom-dimse/transfers/process) */}
              <Button size="small" icon={<Play size={14} />} loading={processingQueue} onClick={() => void handleProcessQueue()}>{t('w4b.dimse.process')}</Button>
              <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setTransferModal(true)}>{t('dicomDimse.newTransfer')}</Button>
            </Space>
          }>
            <DataTable scroll={{ x: 'max-content' }}
              dataSource={transferPagination.pageData}
              rowKey="id"
              loading={transferLoading}
              pagination={transferPagination.pagination}
              columns={[
                { title: t('dicomDimse.colTaskId'), dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
                { title: t('dicomDimse.colStudyUid'), dataIndex: 'studyUid', key: 'studyUid', ellipsis: true, render: (v: string, r: TransferRecord) => <Space size={4}>{v}<Tag color={r.source === 'seed' ? 'orange' : 'blue'} style={{ fontSize: 10 }}>{r.source === 'seed' ? t('dicomDimse.sourceSeed') : t('dicomDimse.sourceQueue')}</Tag></Space> },
                // [v3.0.6.11-96 Wave 2B (D)] C-STORE worklist 联动: 关联检查列
                { title: t('dicomDimse.colRelatedExam'), key: 'exam', width: 150, render: (_: unknown, r: TransferRecord) => r.examId ? <Tag color="geekblue">{r.examId}{r.accessionNumber ? ` · ${r.accessionNumber}` : ''}</Tag> : <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>-</span> },
                { title: t('dicomDimse.colDestAe'), dataIndex: 'targetAe', key: 'targetAe', width: 150, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
                { title: t('dicomDimse.colPriority'), dataIndex: 'priority', key: 'priority', width: 80, render: (v: string) => <Tag color={TRANSFER_PRIORITY_COLOR[v] ?? 'default'}>{TRANSFER_PRIORITY_LABEL[v] ?? v}</Tag> },
                { title: t('dicomDimse.colStatus'), dataIndex: 'status', key: 'status', width: 90, render: (v: string) => { const meta = TRANSFER_STATUS_META[v] ?? { color: 'default', label: v }; return <Tag color={meta.color}>{meta.label}</Tag> } },
                { title: t('dicomDimse.colProgress'), key: 'progress', width: 180, render: (_: unknown, r: TransferRecord) => (
                  <Progress percent={r.progress} size="small" status={r.status === 'failed' ? 'exception' : r.status === 'completed' ? 'success' : r.status === 'paused' ? 'normal' : 'active'} format={(p) => `${r.completedInstances}/${r.totalInstances} (${p ?? 0}%)`} />
                ) },
                { title: t('dicomDimse.colUpdatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
                { title: t('dicomDimse.colError'), dataIndex: 'error', key: 'error', ellipsis: true, render: (v?: string) => v ? <span style={{ color: 'var(--color-error-600)', fontSize: 12 }}>{v}</span> : '-' },
                { title: t('dicomDimse.colAction'), key: 'action', width: 230, render: (_: unknown, r: TransferRecord) => (
                  <Space size={4} wrap>
                    {['failed', 'paused', 'canceled'].includes(r.status) && (
                      <Button size="small" icon={<RotateCcw size={12} />} onClick={() => void runTransferAction(r.id, 'retry')}>{t('dicomDimse.actionRetry')}</Button>
                    )}
                    {['sending', 'queued'].includes(r.status) && (
                      <Button size="small" icon={<Pause size={12} />} onClick={() => void runTransferAction(r.id, 'pause')}>{t('dicomDimse.actionPause')}</Button>
                    )}
                    {r.status === 'paused' && (
                      <Button size="small" icon={<Play size={12} />} onClick={() => void runTransferAction(r.id, 'resume')}>{t('dicomDimse.actionResume')}</Button>
                    )}
                    {r.status !== 'completed' && r.status !== 'canceled' && (
                      <Button size="small" danger icon={<Ban size={12} />} onClick={() => void runTransferAction(r.id, 'cancel')}>{t('dicomDimse.actionCancel')}</Button>
                    )}
                  </Space>
                ) },
              ]}
            />
          </Card>
        </>
      ),
    },
  ]

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Radio size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dicomDimse.pageTitle')}</span>
        <Tag color="blue">v3.0</Tag>
        {/* [v3.0.6.11-88 Round10] C-STORE 本地文件上传为演示行为 (后端 /dicom-dimse/store 为 JSON 协议) */}
        <Tag color="orange">{t('dicomDimse.demoBadge')}</Tag>
      </Space>
      <Alert title={t('dicomDimse.pageAlert')} type="info" showIcon style={{ marginBottom: 'var(--space-4, 16px)' }} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal title={t('dicomDimse.addDeviceTitle')} open={deviceModal} onCancel={() => setDeviceModal(false)} onOk={handleAddDevice}>
        <Form form={deviceForm} layout="vertical" size="small">
          <Form.Item name="aeTitle" label={t('dicomDimse.labelAeTitle')} rules={[{ required: true }]}>
            <Input placeholder={t('dicomDimse.phAeTitle')} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 8px' }}>
            <Form.Item name="ip" label={t('dicomDimse.colIp')} rules={[{ required: true }]}>
              <Input placeholder="192.168.1.105" />
            </Form.Item>
            <Form.Item name="port" label={t('dicomDimse.labelPort')} rules={[{ required: true }]}>
              <InputNumber placeholder="11112" min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="modality" label={t('dicomDimse.colModality')} rules={[{ required: true }]}>
              <Select placeholder={t('dicomDimse.phSelect')}>
                <Select.Option value="CT">CT</Select.Option>
                <Select.Option value="MR">MR</Select.Option>
                <Select.Option value="XA">XA</Select.Option>
                <Select.Option value="US">US</Select.Option>
                <Select.Option value="CR">CR</Select.Option>
              </Select>
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* [v3.0.6.11-96 Wave 3A P2] C-STORE 多帧上传 Modal: 文件列表 + 逐帧进度 + 失败重试 */}
      <Modal
        title={t('dicomDimse.storeUploadTitle')}
        open={storeModal}
        onCancel={() => { if (!storeBatchRunning) setStoreModal(false) }}
        footer={
          <Space>
            <Button onClick={() => { if (!storeBatchRunning) setStoreModal(false) }} disabled={storeBatchRunning}>{t('dicomDimse.close')}</Button>
            <Button onClick={() => onSelectStoreFiles(storeFileInputRef.current?.files ?? null)} disabled={storeBatchRunning} icon={<Plus size={14} />}>{t('dicomDimse.selectFiles')}</Button>
            <Button type="primary" onClick={() => void handleBatchStore()} loading={storeBatchRunning} disabled={!storeItems.some(i => i.status === 'pending' || i.status === 'fail')}>
              {storeItems.some(i => i.status === 'fail') ? t('dicomDimse.retryContinue') : t('dicomDimse.startUpload')}
            </Button>
          </Space>
        }
        width={720}
      >
        <input
          ref={storeFileInputRef}
          type="file"
          accept=".dcm"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => onSelectStoreFiles(e.target.files)}
        />
        {storeItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>
            {t('dicomDimse.storeEmptyHint')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
            {storeItems.map(item => {
              const tagColor = item.status === 'success' ? 'green' : item.status === 'fail' ? 'red' : item.status === 'uploading' ? 'processing' : 'default'
              const tagLabel = item.status === 'success' ? t('dicomDimse.statusDone') : item.status === 'fail' ? t('dicomDimse.statusFail') : item.status === 'uploading' ? t('dicomDimse.statusUploading') : t('dicomDimse.statusPending')
              return (
                <div key={item.uid} style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{(item.size / 1024).toFixed(1)} KB</span>
                    <Tag color={tagColor}>{tagLabel}</Tag>
                    {item.status === 'fail' && (
                      <Button size="small" icon={<RotateCcw size={12} />} disabled={storeBatchRunning}
                        onClick={() => void uploadOneStoreItem(item)}>{t('dicomDimse.retry')}</Button>
                    )}
                  </div>
                  <Progress percent={item.progress} size="small"
                    status={item.status === 'fail' ? 'exception' : item.status === 'success' ? 'success' : item.status === 'uploading' ? 'active' : 'normal'} />
                  {item.status === 'fail' && item.error && (
                    <div style={{ fontSize: 11, color: 'var(--color-error-600)', marginTop: 'var(--space-1, 4px)' }}>{item.error}</div>
                  )}
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary, #475569)', marginTop: 'var(--space-1, 4px)' }}>
              <span>{t('dicomDimse.totalProgress', { done: storeItems.filter(i => i.status === 'success').length, total: storeItems.length })}</span>
              <span style={{ fontWeight: 700, color: 'var(--color-primary-800)' }}>{storeOverallPercent}%</span>
            </div>
          </div>
        )}
      </Modal>

      <Modal title={t('dicomDimse.newTransferTitle')} open={transferModal} onCancel={() => setTransferModal(false)} onOk={() => void handleEnqueueTransfer()} confirmLoading={transferSubmitting}>
        <Form form={transferForm} layout="vertical" size="small">
          <Form.Item name="studyUid" label={t('dicomDimse.labelStudyUid')} rules={[{ required: true, message: t('dicomDimse.requiredStudyUid') }]}>
            <Input placeholder={t('dicomDimse.phStudyUid')} />
          </Form.Item>
          <Form.Item name="targetAe" label={t('dicomDimse.labelDestAe')} rules={[{ required: true, message: t('dicomDimse.requiredTargetAe') }]}>
            <Select placeholder={t('dicomDimse.phTargetAe')}>
              {devices.map(d => <Select.Option key={d.aeTitle} value={d.aeTitle}>{d.aeTitle} ({d.modality})</Select.Option>)}
              <Select.Option value="PACS_ARCHIVE">{t('dicomDimse.archive')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label={t('dicomDimse.colPriority')} initialValue="NORMAL">
            <Select>
              <Select.Option value="HIGH">{t('dicomDimse.priorityHigh')}</Select.Option>
              <Select.Option value="NORMAL">{t('dicomDimse.priorityNormal')}</Select.Option>
              <Select.Option value="LOW">{t('dicomDimse.priorityLow')}</Select.Option>
            </Select>
          </Form.Item>
          {/* [v3.0.6.11-96 Wave 2B (D)] 可选关联检查 (examId 留空时后端从 studyUid 反查) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
            <Form.Item name="examId" label={t('dicomDimse.labelRelatedExam')}>
              <Input placeholder={t('dicomDimse.phExamId')} />
            </Form.Item>
            <Form.Item name="accessionNumber" label={t('dicomDimse.labelAccessionOptional')}>
              <Input placeholder="Accession Number" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default DicomDimsePage

// [G005 v3.0.6.11-86 Wave 4B (G-03)] 证书文件读取 (PEM 文本)
const readFileText = (file: File): Promise<string> => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result ?? ''))
  reader.readAsText(file)
})

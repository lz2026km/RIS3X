import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Tabs, Table, Button, Form, Input, Select, Upload, message, Tag, Space, Alert, InputNumber, Modal, Switch, Progress, Statistic, Row, Col } from 'antd'
import { Send, Search, Upload as UploadIcon, ArrowRight, CheckCircle, XCircle, Radio, RefreshCw, Plus, Lock, Clock3, FileKey, Save, ListOrdered, Pause, Play, RotateCcw, Ban } from 'lucide-react'
import { dicomDimseApi, type DicomTlsConfig, type MppsRecord, type TransferRecord, type TransferStats } from '../../services/api/dicomApi'
import { usePagination } from '../../hooks/usePagination'

const DIMSE_STATUS_LABEL: Record<string, string> = { SUCCESS: '成功' };

const MPPS_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  DISCONTINUED: '已终止',
}

const ECHO_COLUMNS: any[] = [
  { title: '应用实体名', dataIndex: 'aeTitle', key: 'aeTitle' },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip' },
  { title: '端口', dataIndex: 'port', key: 'port' },
  { title: '设备', dataIndex: 'modality', key: 'modality' },
  { title: '连通性', dataIndex: 'pingMs', key: 'pingMs', render: (v: number | null) => v != null ? `${v} ms` : '-' },
  // [G005 v3.0.6.11-90 Wave 4B (G-10)] 在线状态列 (轮询 C-ECHO 结果): 在线/离线/未知
  {
    title: '在线状态',
    dataIndex: 'status',
    key: 'online',
    render: (v: string | null) => v === 'SUCCESS'
      ? <Tag color="green" icon={<CheckCircle size={14} />}>在线</Tag>
      : v === 'FAIL'
        ? <Tag color="red" icon={<XCircle size={14} />}>离线</Tag>
        : <Tag color="default">未知</Tag>,
  },
  {
    title: '上次检测',
    dataIndex: 'lastCheckedAt',
    key: 'lastCheckedAt',
    render: (v: string | null) => v ? new Date(v).toLocaleTimeString() : '-',
  },
]

const MWL_COLUMNS = [
  { title: '患者姓名', dataIndex: 'patientName', key: 'patientName' },
  { title: '患者 ID', dataIndex: 'patientId', key: 'patientId' },
  { title: '检查号', dataIndex: 'accessionNumber', key: 'accessionNumber' },
  { title: '设备', dataIndex: 'modality', key: 'modality' },
  { title: '检查日期', dataIndex: 'studyDate', key: 'studyDate' },
  { title: '状态', dataIndex: 'status', key: 'status' },
]

const C_STORE_COLUMNS = [
  { title: 'SOP 实例 UID', dataIndex: 'sopInstanceUid', key: 'sopInstanceUid', ellipsis: true },
  { title: '存储路径', dataIndex: 'storagePath', key: 'storagePath', ellipsis: true },
  { title: '大小', dataIndex: 'sizeBytes', key: 'sizeBytes', render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
]

const C_MOVE_COLUMNS = [
  { title: '检查 UID', dataIndex: 'studyUid', key: 'studyUid', ellipsis: true },
  { title: '目标 AE', dataIndex: 'destAe', key: 'destAe' },
  { title: '传输数', dataIndex: 'transferredCount', key: 'transferredCount' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
]

// [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度列
const MPPS_STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  DISCONTINUED: 'error',
}
const MPPS_COLUMNS = [
  { title: '检查 UID', dataIndex: 'studyUid', key: 'studyUid', ellipsis: true },
  { title: '患者', dataIndex: 'patientName', key: 'patientName', render: (v?: string) => v || '-' },
  { title: '设备', dataIndex: 'modality', key: 'modality', render: (v?: string) => v || '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={MPPS_STATUS_COLOR[v] ?? 'default'}>{MPPS_STATUS_LABEL[v] ?? v}</Tag> },
  { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
  { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
  { title: '步骤数', dataIndex: 'performedSteps', key: 'performedSteps', render: (v?: unknown[]) => Array.isArray(v) ? v.length : 0 },
  { title: '来源', dataIndex: 'source', key: 'source', render: (v?: string) => <Tag color={v === 'exam' ? 'blue' : 'default'}>{v === 'exam' ? '检查派生' : 'MPPS'}</Tag> },
]

const TLS_NODE_COLUMNS = [
  { title: '应用实体名', dataIndex: 'aeTitle', key: 'aeTitle' },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip' },
  { title: '端口', dataIndex: 'port', key: 'port' },
  { title: '设备', dataIndex: 'modality', key: 'modality' },
  { title: 'TLS', key: 'tls', render: (_: unknown, r: any) => <Tag color={r._tlsEnabled ? 'green' : 'default'}>{r._tlsEnabled ? '已启用' : '未启用'}</Tag> },
  { title: '操作', key: 'action', render: (_: unknown, r: any) => (
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
  queued: { color: 'default', label: '排队中' },
  sending: { color: 'processing', label: '发送中' },
  paused: { color: 'warning', label: '已暂停' },
  failed: { color: 'error', label: '失败' },
  completed: { color: 'success', label: '已完成' },
  canceled: { color: 'default', label: '已取消' },
}

const TRANSFER_PRIORITY_COLOR: Record<string, string> = { HIGH: 'red', NORMAL: 'blue', LOW: 'default' }
const TRANSFER_PRIORITY_LABEL: Record<string, string> = { HIGH: '高', NORMAL: '普通', LOW: '低' }

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
    if (!res.success) message.error(res.error?.message ?? '节点 TLS 更新失败')
    else message.success(`节点 ${device.aeTitle} TLS ${res.data?.tlsEnabled ? '已启用' : '已关闭'}`)
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
      message.success('TLS 配置已保存')
    } else {
      message.error(res.error?.message ?? 'TLS 配置保存失败')
    }
    setTlsSaving(false)
  }

  const handleMppsSend = async (values: any) => {
    setMppsSending(true)
    const res = await dicomDimseApi.sendMpps({ studyUid: values.studyUid, status: values.status })
    if (res.success) {
      message.success(`MPPS 已更新: ${MPPS_STATUS_LABEL[values.status] ?? values.status}`)
      mppsForm.resetFields()
      void loadMpps()
    } else {
      message.error(res.error?.message ?? 'MPPS 发送失败')
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
      message.success(`传输任务 ${id} 已${action === 'retry' ? '重试' : action === 'pause' ? '暂停' : action === 'resume' ? '恢复' : '取消'}`)
      void loadTransfers()
    } else {
      message.error(res.error?.message ?? '操作失败')
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
        message.success(`传输任务已入队: ${res.data.id} → ${values.targetAe}`)
        setTransferModal(false)
        transferForm.resetFields()
        void loadTransfers()
      } else {
        message.error(res.error?.message ?? '入队失败')
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
      message.error(res.error?.message || 'MWL 查询失败')
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
      setStoreItems(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'fail', error: res.error?.message ?? 'C-STORE 失败' } : i))
      setStoreResults(prev => [...prev, { fileName: item.name, status: 'FAIL', sizeBytes: item.size }])
      return false
    } catch {
      setStoreItems(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'fail', error: 'C-STORE 网络错误' } : i))
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
    message.success(`上传完成: 成功 ${ok} 帧，失败 ${pending.length - ok} 帧`)
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
      message.success('C-MOVE 转发完成')
    } else {
      setMoveResults(prev => [...prev, { studyUid: values.studyUid, destAe: values.destAe, transferredCount: 0, status: 'FAIL' }])
      message.error('C-MOVE 失败')
    }
    setMoveLoading(false)
  }

  const handleAddDevice = async () => {
    try {
      const values = await deviceForm.validateFields()
      setDevices(prev => [...prev, { ...values, pingMs: null, status: null, lastCheckedAt: null, _echoing: false }])
      setDeviceModal(false)
      deviceForm.resetFields()
      message.success('设备已添加')
    } catch { /* ignore */ }
  }

  const tabItems = [
    {
      key: 'echo',
      label: <Space><Send />C-ECHO</Space>,
      children: (
        <Card size="small" title="DICOM 设备列表" extra={
          <Space>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>自动轮询 30s</span>
            <Switch size="small" checked={autoPoll} onChange={setAutoPoll} />
            <Button icon={<RefreshCw size={14} />} loading={pollRunning} onClick={() => void pollDevices()}>刷新状态</Button>
            <Button icon={<Plus size={14} />} onClick={() => setDeviceModal(true)}>添加设备</Button>
            <Button icon={<RefreshCw size={14} />} onClick={() => setDevices(INITIAL_DEVICES)}>重置</Button>
          </Space>
        }>
          <Table scroll={{ x: 'max-content' }}
            dataSource={devicePagination.pageData}
            rowKey="aeTitle"
            pagination={devicePagination.pagination}
            columns={[
              ...ECHO_COLUMNS,
              {
                title: '操作',
                key: 'action',
                render: (_: any, record: DimseDevice) => (
                  <Button type="primary" size="small" icon={<Send />} loading={record._echoing} onClick={() => handleEcho(record)}>ECHO 测试</Button>
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
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form form={mwlForm} layout="inline" onFinish={handleMwlQuery}>
              <Form.Item name="patientName" label="名称"><Input placeholder="患者姓名" allowClear /></Form.Item>
              <Form.Item name="patientId" label="编号"><Input placeholder="患者 ID" allowClear /></Form.Item>
              <Form.Item name="accessionNumber" label="检查号"><Input placeholder="检查号" allowClear /></Form.Item>
              <Form.Item name="modality" label="设备">
                <Select allowClear placeholder="全部" style={{ width: 100 }}>
                  <Select.Option value="CT">CT</Select.Option>
                  <Select.Option value="MR">MR</Select.Option>
                  <Select.Option value="XA">XA</Select.Option>
                  <Select.Option value="US">US</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<Search />} loading={mwlLoading}>查询</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title="工作列表条目">
            <Table scroll={{ x: 'max-content' }} dataSource={mwlPagination.pageData} rowKey={(r, i) => r.accessionNumber || `${i}`} columns={MWL_COLUMNS} loading={mwlLoading} pagination={mwlPagination.pagination}/>
          </Card>
        </>
      ),
    },
    {
      key: 'cstore',
      label: <Space><UploadIcon />C-STORE</Space>,
      children: (
        <Card size="small" title="DICOM 文件上传"
          extra={
            <Space>
              <Button icon={<Upload />} type="primary" onClick={() => setStoreModal(true)}>选择 .dcm 文件（多帧）</Button>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>支持多文件选择 · 逐帧进度 · 失败重试</span>
            </Space>
          }>
          <Alert title="支持 DICOM .dcm 文件上传，系统将逐帧解析并存储至 PACS；多文件按顺序逐帧上传并实时显示每帧进度" type="info" showIcon style={{ marginBottom: 12 }} />
          <Table scroll={{ x: 'max-content' }} dataSource={storePagination.pageData} rowKey={(r, i) => r.sopInstanceUid || `${i}`} columns={C_STORE_COLUMNS} pagination={storePagination.pagination} />
        </Card>
      ),
    },
    {
      key: 'cmove',
      label: <Space><ArrowRight />C-MOVE</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form form={moveForm} layout="inline" onFinish={handleMove}>
              <Form.Item name="studyUid" label="检查 UID" rules={[{ required: true, message: '请输入检查 UID' }]}>
                <Input placeholder="1.2.840.xxxxx" style={{ width: 320 }} />
              </Form.Item>
              <Form.Item name="destAe" label="目标 AE" rules={[{ required: true }]}>
                <Input placeholder="DEST_AE" />
              </Form.Item>
              <Form.Item name="destHost" label="主机">
                <Input placeholder="192.168.1.200" />
              </Form.Item>
              <Form.Item name="destPort" label="端口">
                <InputNumber placeholder="11112" min={1} max={65535} />
              </Form.Item>
              <Form.Item><Button type="primary" htmlType="submit" icon={<ArrowRight />} loading={moveLoading}>转发</Button></Form.Item>
            </Form>
          </Card>
          <Card size="small" title="C-MOVE 转存记录">
            <Table scroll={{ x: 'max-content' }} dataSource={movePagination.pageData} rowKey={(r, i) => `${r.studyUid}-${i}`} columns={C_MOVE_COLUMNS} pagination={movePagination.pagination} />
          </Card>
        </>
      ),
    },
    {
      key: 'tls',
      label: <Space><Lock />TLS 安全</Space>,
      children: (
        <>
          <Card
            size="small"
            title="全局 TLS 配置 (内存 + 环境 seed 回退)"
            extra={<Button size="small" type="primary" icon={<Save size={14} />} loading={tlsSaving} onClick={() => void handleSaveTls()}>保存配置</Button>}
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>启用 DICOM TLS</div>
                <Switch checked={tlsConfig.enabled} onChange={(v) => setTlsConfig(prev => ({ ...prev, enabled: v }))} />
                <span style={{ marginLeft: 8, color: '#64748b', fontSize: 12 }}>对标 HL7 MLLP TLS 模式, 证书缺失时仅保存配置</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>TLS 端口</div>
                <InputNumber min={1} max={65535} value={tlsConfig.port} onChange={(v) => setTlsConfig(prev => ({ ...prev, port: v ?? 2762 }))} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>校验证书链</div>
                <Switch checked={tlsConfig.verifyPeer} onChange={(v) => setTlsConfig(prev => ({ ...prev, verifyPeer: v }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}><FileKey size={12} style={{ verticalAlign: -2 }} /> 服务器证书 (PEM)</div>
                <Upload accept=".pem,.crt,.cer" showUploadList={false} beforeUpload={(file) => { readFileText(file).then(setTlsCertFile); return false }}>
                  <Button size="small" icon={<UploadIcon size={12} />}>{tlsCertFile ? '已选择证书文件' : '选择证书文件'}</Button>
                </Upload>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>CA 证书 (PEM)</div>
                <Upload accept=".pem,.crt,.cer" showUploadList={false} beforeUpload={(file) => { readFileText(file).then(setTlsCaCertFile); return false }}>
                  <Button size="small" icon={<UploadIcon size={12} />}>{tlsCaCertFile ? '已选择 CA 文件' : '选择 CA 文件'}</Button>
                </Upload>
              </div>
            </div>
          </Card>
          <Card size="small" title="节点级 TLS 开关 (AE 节点)">
            <Table scroll={{ x: 'max-content' }} rowKey="aeTitle" dataSource={tlsNodes} columns={TLS_NODE_COLUMNS} loading={tlsLoading} pagination={false} size="small" />
          </Card>
        </>
      ),
    },
    {
      key: 'mpps',
      label: <Space><Clock3 />MPPS 进度</Space>,
      children: (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form form={mppsForm} layout="inline" onFinish={handleMppsSend}>
              <Form.Item name="studyUid" label="检查 UID" rules={[{ required: true, message: '请输入检查 UID' }]}>
                <Input placeholder="1.2.840.xxxxx 或 Exam ID" style={{ width: 320 }} />
              </Form.Item>
              <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="IN_PROGRESS">
                <Select style={{ width: 160 }}>
                  <Select.Option value="IN_PROGRESS">进行中</Select.Option>
                  <Select.Option value="COMPLETED">已完成</Select.Option>
                  <Select.Option value="DISCONTINUED">已终止</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<Clock3 size={14} />} loading={mppsSending}>发送 MPPS</Button>
              </Form.Item>
              <Form.Item>
                <Button icon={<RefreshCw size={14} />} onClick={() => void loadMpps()} loading={mppsLoading}>刷新</Button>
              </Form.Item>
            </Form>
          </Card>
          <Card size="small" title="检查进度 (N-CREATE/N-SET)">
            <Table scroll={{ x: 'max-content' }} dataSource={mppsPagination.pageData} rowKey="studyUid" columns={MPPS_COLUMNS} loading={mppsLoading} pagination={mppsPagination.pagination} />
          </Card>
        </>
      ),
    },
    {
      key: 'transfers',
      label: <Space><ListOrdered />传输队列</Space>,
      children: (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {[
              { title: '队列总数', value: transferStats?.total ?? 0, color: '#1e40af' },
              { title: '活跃任务', value: transferStats?.activeCount ?? 0, color: '#0891b2' },
              { title: '发送中', value: transferStats?.sending ?? 0, color: '#2563eb' },
              { title: '失败', value: transferStats?.failed ?? 0, color: '#dc2626' },
              { title: '已完成', value: transferStats?.completed ?? 0, color: '#059669' },
              { title: '成功率', value: transferStats?.successRate != null ? `${transferStats.successRate}%` : '-', color: '#7c3aed' },
            ].map(s => (
              <Col span={4} key={s.title}><Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{ color: s.color, fontSize: 18 }} /></Card></Col>
            ))}
          </Row>
          <Card size="small" title="DICOM C-STORE 发送队列 (内存 + seed 回退)" extra={
            <Space>
              <Button size="small" icon={<RefreshCw size={14} />} onClick={() => void loadTransfers()} loading={transferLoading}>刷新</Button>
              <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setTransferModal(true)}>新建传输</Button>
            </Space>
          }>
            <Table scroll={{ x: 'max-content' }}
              dataSource={transferPagination.pageData}
              rowKey="id"
              loading={transferLoading}
              pagination={transferPagination.pagination}
              columns={[
                { title: '任务 ID', dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
                { title: '检查 UID', dataIndex: 'studyUid', key: 'studyUid', ellipsis: true, render: (v: string, r: TransferRecord) => <Space size={4}>{v}<Tag color={r.source === 'seed' ? 'orange' : 'blue'} style={{ fontSize: 10 }}>{r.source === 'seed' ? '种子数据' : '队列'}</Tag></Space> },
                // [v3.0.6.11-96 Wave 2B (D)] C-STORE ↔ worklist 联动: 关联检查列
                { title: '关联检查', key: 'exam', width: 150, render: (_: unknown, r: TransferRecord) => r.examId ? <Tag color="geekblue">{r.examId}{r.accessionNumber ? ` · ${r.accessionNumber}` : ''}</Tag> : <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span> },
                { title: '目标 AE', dataIndex: 'targetAe', key: 'targetAe', width: 150, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
                { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: (v: string) => <Tag color={TRANSFER_PRIORITY_COLOR[v] ?? 'default'}>{TRANSFER_PRIORITY_LABEL[v] ?? v}</Tag> },
                { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => { const meta = TRANSFER_STATUS_META[v] ?? { color: 'default', label: v }; return <Tag color={meta.color}>{meta.label}</Tag> } },
                { title: '进度', key: 'progress', width: 180, render: (_: unknown, r: TransferRecord) => (
                  <Progress percent={r.progress} size="small" status={r.status === 'failed' ? 'exception' : r.status === 'completed' ? 'success' : r.status === 'paused' ? 'normal' : 'active'} format={(p) => `${r.completedInstances}/${r.totalInstances} (${p ?? 0}%)`} />
                ) },
                { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
                { title: '错误', dataIndex: 'error', key: 'error', ellipsis: true, render: (v?: string) => v ? <span style={{ color: '#dc2626', fontSize: 12 }}>{v}</span> : '-' },
                { title: '操作', key: 'action', width: 230, render: (_: unknown, r: TransferRecord) => (
                  <Space size={4} wrap>
                    {['failed', 'paused', 'canceled'].includes(r.status) && (
                      <Button size="small" icon={<RotateCcw size={12} />} onClick={() => void runTransferAction(r.id, 'retry')}>重试</Button>
                    )}
                    {['sending', 'queued'].includes(r.status) && (
                      <Button size="small" icon={<Pause size={12} />} onClick={() => void runTransferAction(r.id, 'pause')}>暂停</Button>
                    )}
                    {r.status === 'paused' && (
                      <Button size="small" icon={<Play size={12} />} onClick={() => void runTransferAction(r.id, 'resume')}>恢复</Button>
                    )}
                    {r.status !== 'completed' && r.status !== 'canceled' && (
                      <Button size="small" danger icon={<Ban size={12} />} onClick={() => void runTransferAction(r.id, 'cancel')}>取消</Button>
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
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Radio size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM DIMSE 管理</span>
        <Tag color="blue">v3.0</Tag>
        {/* [v3.0.6.11-88 Round10] C-STORE 本地文件上传为演示行为 (后端 /dicom-dimse/store 为 JSON 协议) */}
        <Tag color="orange">演示数据 (MSW)</Tag>
      </Space>
      <Alert title="DIMSE (DICOM Message Service Element) 设备集成管理，支持 C-ECHO、C-FIND (MWL)、C-STORE、C-MOVE 服务；v3.0.6.11-86 新增 TLS 安全 (G-03) 与 MPPS 检查进度 (G-05)" type="info" showIcon style={{ marginBottom: 16 }} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal title="添加 DICOM 设备" open={deviceModal} onCancel={() => setDeviceModal(false)} onOk={handleAddDevice}>
        <Form form={deviceForm} layout="vertical" size="small">
          <Form.Item name="aeTitle" label="应用实体名" rules={[{ required: true }]}>
            <Input placeholder="例如: CT_SCANNER_03" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 8px' }}>
            <Form.Item name="ip" label="IP 地址" rules={[{ required: true }]}>
              <Input placeholder="192.168.1.105" />
            </Form.Item>
            <Form.Item name="port" label="端口" rules={[{ required: true }]}>
              <InputNumber placeholder="11112" min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="modality" label="设备" rules={[{ required: true }]}>
              <Select placeholder="选择">
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
        title="C-STORE 多帧上传"
        open={storeModal}
        onCancel={() => { if (!storeBatchRunning) setStoreModal(false) }}
        footer={
          <Space>
            <Button onClick={() => { if (!storeBatchRunning) setStoreModal(false) }} disabled={storeBatchRunning}>关闭</Button>
            <Button onClick={() => onSelectStoreFiles(storeFileInputRef.current?.files ?? null)} disabled={storeBatchRunning} icon={<Plus size={14} />}>选择文件</Button>
            <Button type="primary" onClick={() => void handleBatchStore()} loading={storeBatchRunning} disabled={!storeItems.some(i => i.status === 'pending' || i.status === 'fail')}>
              {storeItems.some(i => i.status === 'fail') ? '重试失败 / 继续上传' : '开始上传'}
            </Button>
          </Space>
        }
        width={640}
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
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
            点击"选择文件"添加多个 .dcm 文件（多帧），将按顺序逐帧上传
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
            {storeItems.map(item => {
              const tagColor = item.status === 'success' ? 'green' : item.status === 'fail' ? 'red' : item.status === 'uploading' ? 'processing' : 'default'
              const tagLabel = item.status === 'success' ? '完成' : item.status === 'fail' ? '失败' : item.status === 'uploading' ? '上传中' : '待上传'
              return (
                <div key={item.uid} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{(item.size / 1024).toFixed(1)} KB</span>
                    <Tag color={tagColor}>{tagLabel}</Tag>
                    {item.status === 'fail' && (
                      <Button size="small" icon={<RotateCcw size={12} />} disabled={storeBatchRunning}
                        onClick={() => void uploadOneStoreItem(item)}>重试</Button>
                    )}
                  </div>
                  <Progress percent={item.progress} size="small"
                    status={item.status === 'fail' ? 'exception' : item.status === 'success' ? 'success' : item.status === 'uploading' ? 'active' : 'normal'} />
                  {item.status === 'fail' && item.error && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{item.error}</div>
                  )}
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginTop: 4 }}>
              <span>总进度 {storeItems.filter(i => i.status === 'success').length}/{storeItems.length} 帧完成</span>
              <span style={{ fontWeight: 700, color: '#1e40af' }}>{storeOverallPercent}%</span>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="新建 DICOM C-STORE 传输" open={transferModal} onCancel={() => setTransferModal(false)} onOk={() => void handleEnqueueTransfer()} confirmLoading={transferSubmitting}>
        <Form form={transferForm} layout="vertical" size="small">
          <Form.Item name="studyUid" label="检查 UID" rules={[{ required: true, message: '请输入检查 UID' }]}>
            <Input placeholder="1.2.840.xxxxx" />
          </Form.Item>
          <Form.Item name="targetAe" label="目标 AE" rules={[{ required: true, message: '请选择目标 AE' }]}>
            <Select placeholder="选择目标 AE Title">
              {devices.map(d => <Select.Option key={d.aeTitle} value={d.aeTitle}>{d.aeTitle} ({d.modality})</Select.Option>)}
              <Select.Option value="PACS_ARCHIVE">PACS_ARCHIVE (归档)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="NORMAL">
            <Select>
              <Select.Option value="HIGH">高</Select.Option>
              <Select.Option value="NORMAL">普通</Select.Option>
              <Select.Option value="LOW">低</Select.Option>
            </Select>
          </Form.Item>
          {/* [v3.0.6.11-96 Wave 2B (D)] 可选关联检查 (examId 留空时后端从 studyUid 反查) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
            <Form.Item name="examId" label="关联检查 (可选)">
              <Input placeholder="Exam ID, 留空自动反查" />
            </Form.Item>
            <Form.Item name="accessionNumber" label="检查号 (可选)">
              <Input placeholder="Accession Number" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default DicomDimsePage

// [G005 v3.0.6.11-86 Wave 4B (G-03)] 证书文件读取 (PEM 文本)
const readFileText = (file: File): Promise<string> => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result ?? ''))
  reader.readAsText(file)
})

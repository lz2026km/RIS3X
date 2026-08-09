import React, { useState, useEffect, useCallback } from 'react'
import { Card, Tabs, Table, Button, Form, Input, Select, Upload, message, Tag, Space, Alert, InputNumber, Modal, Switch } from 'antd'
import { Send, Search, Upload as UploadIcon, ArrowRight, CheckCircle, XCircle, Radio, RefreshCw, Plus, Lock, Clock3, FileKey, Save } from 'lucide-react'
import { dicomDimseApi, type DicomTlsConfig, type MppsRecord } from '../../services/api/dicomApi'
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
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string | null) => v ? <Tag color={v === 'SUCCESS' ? 'green' : 'red'} icon={v === 'SUCCESS' ? <CheckCircle size={14} /> : <XCircle size={14} />}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> : '-' },
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

interface DimseDevice {
  aeTitle: string
  ip: string
  port: number
  modality: string
  pingMs: number | null
  status: string | null
  _echoing: boolean
}

const INITIAL_DEVICES: DimseDevice[] = [
  { aeTitle: 'CT_SCANNER_01', ip: '192.168.1.101', port: 11112, modality: 'CT', pingMs: null, status: null, _echoing: false },
  { aeTitle: 'MR_SCANNER_02', ip: '192.168.1.102', port: 11113, modality: 'MR', pingMs: null, status: null, _echoing: false },
  { aeTitle: 'XA_LAB_01', ip: '192.168.1.103', port: 11114, modality: 'XA', pingMs: null, status: null, _echoing: false },
  { aeTitle: 'US_UNIT_01', ip: '192.168.1.104', port: 11115, modality: 'US', pingMs: null, status: null, _echoing: false },
]

export const DicomDimsePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('echo')
  const [devices, setDevices] = useState<DimseDevice[]>(INITIAL_DEVICES)
  const [mwlResults, setMwlResults] = useState<any[]>([])
  const [mwlLoading, setMwlLoading] = useState(false)
  const [mwlForm] = Form.useForm()
  const [storeResults, setStoreResults] = useState<any[]>([])
  const [storeLoading, setStoreLoading] = useState(false)
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

  const handleEcho = async (device: DimseDevice) => {
    setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, _echoing: true } : d))
    const start = performance.now()
    const res = await dicomDimseApi.cEcho({ calledAeTitle: device.aeTitle })
    const elapsed = Math.round(performance.now() - start)
    if (res.success) {
      // [G005 P1] 响应形状统一: 后端直接返回 C-ECHO 对象 (无 data 双包裹)
      const payload = (res.data as { data?: unknown })?.data ?? res.data
      setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, pingMs: (payload as any)?.pingMs ?? elapsed, status: 'SUCCESS', _echoing: false } : d))
    } else {
      setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, pingMs: elapsed, status: 'FAIL', _echoing: false } : d))
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

  const handleStore = async (file: File) => {
    setStoreLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/v1/dicom-dimse/store', { method: 'POST', body: formData })
    if (res.ok) {
      setStoreResults(prev => [...prev, { fileName: file.name, status: 'SUCCESS', sizeBytes: file.size }])
      message.success('C-STORE 成功')
    } else {
      setStoreResults(prev => [...prev, { fileName: file.name, status: 'FAIL', sizeBytes: file.size }])
      message.error('C-STORE 失败')
    }
    setStoreLoading(false)
  }

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
      setDevices(prev => [...prev, { ...values, pingMs: null, status: null, _echoing: false }])
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
        <Card size="small" title="DICOM 文件上传">
          <Upload
            accept=".dcm"
            showUploadList={false}
            beforeUpload={(file) => { handleStore(file); return false }}
            disabled={storeLoading}
          >
            <Button icon={<Upload />} loading={storeLoading}>选择 .dcm 文件上传</Button>
          </Upload>
          <Alert title="支持 DICOM .dcm 文件上传，系统将解析并存储至 PACS" type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }} />
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
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Radio size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM DIMSE 管理</span>
        <Tag color="blue">v3.0</Tag>
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

import React, { useState } from 'react'
import { Card, Tabs, Table, Button, Form, Input, Select, Upload, message, Tag, Space, Alert, InputNumber, Modal } from 'antd'
import { Send, Search, Upload, ArrowRight, CheckCircle, XCircle, Radio, RefreshCw, Plus } from 'lucide-react'
import { dicomDimseApi } from '../../services/api/dicomApi'

const DIMSE_STATUS_LABEL: Record<string, string> = { SUCCESS: '成功' };

const ECHO_COLUMNS: any[] = [
  { title: 'AE Title', dataIndex: 'aeTitle', key: 'aeTitle' },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip' },
  { title: '端口', dataIndex: 'port', key: 'port' },
  { title: 'Modality', dataIndex: 'modality', key: 'modality' },
  { title: '连通性', dataIndex: 'pingMs', key: 'pingMs', render: (v: number | null) => v != null ? `${v} ms` : '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string | null) => v ? <Tag color={v === 'SUCCESS' ? 'green' : 'red'} icon={v === 'SUCCESS' ? <CheckCircle size={14} /> : <XCircle size={14} />}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> : '-' },
]

const MWL_COLUMNS = [
  { title: '患者姓名', dataIndex: 'patientName', key: 'patientName' },
  { title: '患者 ID', dataIndex: 'patientId', key: 'patientId' },
  { title: 'Accession#', dataIndex: 'accessionNumber', key: 'accessionNumber' },
  { title: 'Modality', dataIndex: 'modality', key: 'modality' },
  { title: '检查日期', dataIndex: 'studyDate', key: 'studyDate' },
  { title: '状态', dataIndex: 'status', key: 'status' },
]

const C_STORE_COLUMNS = [
  { title: 'SOP Instance UID', dataIndex: 'sopInstanceUid', key: 'sopInstanceUid', ellipsis: true },
  { title: '存储路径', dataIndex: 'storagePath', key: 'storagePath', ellipsis: true },
  { title: '大小', dataIndex: 'sizeBytes', key: 'sizeBytes', render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
]

const C_MOVE_COLUMNS = [
  { title: 'Study UID', dataIndex: 'studyUid', key: 'studyUid', ellipsis: true },
  { title: 'Destination AE', dataIndex: 'destAe', key: 'destAe' },
  { title: '传输数', dataIndex: 'transferredCount', key: 'transferredCount' },
  { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{DIMSE_STATUS_LABEL[v] ?? v}</Tag> },
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

  const handleEcho = async (device: DimseDevice) => {
    setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, _echoing: true } : d))
    const start = performance.now()
    const res = await dicomDimseApi.cEcho({ calledAeTitle: device.aeTitle })
    const elapsed = Math.round(performance.now() - start)
    if (res.success) {
      setDevices(prev => prev.map(d => d.aeTitle === device.aeTitle ? { ...d, pingMs: res.data!.data ? (res.data.data as any).pingMs ?? elapsed : elapsed, status: 'SUCCESS', _echoing: false } : d))
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
    if (res.success && res.data?.data) {
      setMwlResults(Array.isArray(res.data.data) ? res.data.data : [])
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
      setMoveResults(prev => [...prev, { studyUid: values.studyUid, destAe: values.destAe, transferredCount: (res.data?.data as any)?.transferredCount || 0, status: 'SUCCESS' }])
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
          <Table
            dataSource={devices}
            rowKey="aeTitle"
            pagination={false}
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
              <Form.Item name="accessionNumber" label="Accession"><Input placeholder="Accession#" allowClear /></Form.Item>
              <Form.Item name="modality" label="Modality">
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
          <Card size="small" title="Worklist 条目">
            <Table dataSource={mwlResults} rowKey={(r, i) => r.accessionNumber || `${i}`} columns={MWL_COLUMNS} loading={mwlLoading} pagination={{ pageSize: 10 }} />
          </Card>
        </>
      ),
    },
    {
      key: 'cstore',
      label: <Space><Upload />C-STORE</Space>,
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
          <Table dataSource={storeResults} rowKey={(r, i) => r.sopInstanceUid || `${i}`} columns={C_STORE_COLUMNS} pagination={false} />
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
              <Form.Item name="studyUid" label="Study UID" rules={[{ required: true, message: '请输入 Study UID' }]}>
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
            <Table dataSource={moveResults} rowKey={(r, i) => `${r.studyUid}-${i}`} columns={C_MOVE_COLUMNS} pagination={false} />
          </Card>
        </>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Radio size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM DIMSE 管理</span>
        <Tag color="blue">v3.0</Tag>
      </Space>
      <Alert title="DIMSE (DICOM Message Service Element) 设备集成管理，支持 C-ECHO、C-FIND (MWL)、C-STORE、C-MOVE 四种服务" type="info" showIcon style={{ marginBottom: 16 }} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal title="添加 DICOM 设备" open={deviceModal} onCancel={() => setDeviceModal(false)} onOk={handleAddDevice}>
        <Form form={deviceForm} layout="vertical" size="small">
          <Form.Item name="aeTitle" label="AE Title" rules={[{ required: true }]}>
            <Input placeholder="例如: CT_SCANNER_03" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 8px' }}>
            <Form.Item name="ip" label="IP 地址" rules={[{ required: true }]}>
              <Input placeholder="192.168.1.105" />
            </Form.Item>
            <Form.Item name="port" label="端口" rules={[{ required: true }]}>
              <InputNumber placeholder="11112" min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="modality" label="Modality" rules={[{ required: true }]}>
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

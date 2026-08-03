/**
 * G005 RIS v3.0.6.11-60 - VNA 厂商中立归档仪表板 (对标 Agfa / Sectra / GE Datalogue)
 * 归档统计卡 + 对象列表 (类型筛选/搜索/WORM 标记/下载/删除/锁定)
 * 上传非 DICOM 内容 Modal + 对象详情 Drawer + 患者归档视图 (全生命周期时间线)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, Modal, Popconfirm,
  Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Typography, Upload, message,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import {
  Archive, Download, FileText, HardDrive, Image as ImageIcon, Lock, LockOpen, Plus,
  RefreshCw, Search, ShieldCheck, User, Database as DatabaseIcon,
} from 'lucide-react'
import {
  vnaApi, type VnaObject, type VnaObjectType, type VnaStats, type VnaStudy, type PatientArchive,
} from '../services/api/vnaApi'
import { invalidateApiCache } from '../services/api/client'

const { Text } = Typography

const TYPE_LABEL: Record<VnaObjectType, string> = { document: '文档', image: '图像' }

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

const VNADashboardPage: React.FC = () => {
  const [stats, setStats] = useState<VnaStats | null>(null)
  const [objects, setObjects] = useState<VnaObject[]>([])
  const [studies, setStudies] = useState<VnaStudy[]>([])
  const [loading, setLoading] = useState(false)
  const [studiesLoading, setStudiesLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<VnaObjectType | ''>('')
  const [search, setSearch] = useState('')
  const [statsLoading, setStatsLoading] = useState(false)

  // 上传 Modal
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadForm] = Form.useForm()

  // 详情 Drawer
  const [detail, setDetail] = useState<VnaObject | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // 患者归档视图
  const [patientInput, setPatientInput] = useState('')
  const [patientArchive, setPatientArchive] = useState<PatientArchive | null>(null)
  const [patientLoading, setPatientLoading] = useState(false)

  const previewRevoked = useRef<Set<string>>(new Set())

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await vnaApi.getStats()
      if (res.success) setStats(res.data)
      else message.error(res.error?.message || '归档统计加载失败')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadObjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await vnaApi.getObjects({ type: typeFilter, search })
      if (res.success) setObjects(res.data)
      else message.error(res.error?.message || '归档对象列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, search])

  const loadStudies = useCallback(async () => {
    setStudiesLoading(true)
    try {
      const res = await vnaApi.getStudies()
      if (res.success) setStudies(res.data)
      else message.error(res.error?.message || 'DICOM 检查归档加载失败')
    } finally {
      setStudiesLoading(false)
    }
  }, [])

  const refreshArchive = useCallback(async () => {
    await invalidateApiCache('/vna/objects')
    await invalidateApiCache('/vna/stats')
    await invalidateApiCache('/vna/studies')
    void loadObjects()
    void loadStats()
    void loadStudies()
  }, [loadObjects, loadStats, loadStudies])

  useEffect(() => {
    document.title = 'VNA 厂商中立归档 - G005 RIS'
    void loadStats()
    void loadObjects()
    void loadStudies()
  }, [loadStats, loadObjects, loadStudies])

  const revokePreview = useCallback((url: string | null) => {
    if (url && !previewRevoked.current.has(url)) {
      previewRevoked.current.add(url)
      URL.revokeObjectURL(url)
    }
  }, [])

  // ─────────────────────── 上传 ───────────────────────

  const openUpload = useCallback(() => {
    uploadForm.resetFields()
    uploadForm.setFieldsValue({ objectType: 'document' })
    setUploadFile(null)
    setUploadOpen(true)
  }, [uploadForm])

  const handleUploadSubmit = useCallback(async () => {
    const values = await uploadForm.validateFields()
    if (!uploadFile && !values.name) {
      message.warning('请选择文件或填写名称')
      return
    }
    const form = new FormData()
    form.set('patientId', values.patientId ?? '')
    form.set('studyUid', values.studyUid ?? '')
    form.set('objectType', values.objectType ?? 'document')
    form.set('name', values.name ?? uploadFile?.name ?? '')
    form.set('description', values.description ?? '')
    if (uploadFile) form.set('file', uploadFile, uploadFile.name)
    setUploading(true)
    try {
      const res = await vnaApi.createObject(form)
      if (res.success) {
        message.success(`对象 ${res.data.name} 已归档`)
        setUploadOpen(false)
        setUploadFile(null)
        void refreshArchive()
      } else {
        message.error(res.error?.message || '归档失败')
      }
    } finally {
      setUploading(false)
    }
  }, [uploadForm, uploadFile, refreshArchive])

  // ─────────────────────── 下载 / 详情 ───────────────────────

  const handleDownload = useCallback(async (obj: VnaObject) => {
    const blob = await vnaApi.downloadObject(obj.id)
    if (!blob) {
      message.error('下载失败')
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = obj.name || `${obj.id}.bin`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [])

  const openDetail = useCallback(async (obj: VnaObject) => {
    setDetail(obj)
    setPreviewUrl(null)
    setDrawerOpen(true)
    const isImage = obj.mimeType.startsWith('image/')
    if (isImage) {
      setPreviewLoading(true)
      try {
        const blob = await vnaApi.downloadObject(obj.id)
        if (blob) {
          revokePreview(previewUrl)
          setPreviewUrl(URL.createObjectURL(blob))
        }
      } finally {
        setPreviewLoading(false)
      }
    }
  }, [previewUrl, revokePreview])

  const closeDetail = useCallback(() => {
    setDrawerOpen(false)
    revokePreview(previewUrl)
    setPreviewUrl(null)
    setDetail(null)
  }, [previewUrl, revokePreview])

  const handleLock = useCallback(async (obj: VnaObject) => {
    const res = await vnaApi.wormLock(obj.id)
    if (res.success) {
      message.success(`对象 ${obj.name} 已 WORM 锁定 (不可删除)`)
      void refreshArchive()
      setDetail(res.data)
    } else {
      message.error(res.error?.message || '锁定失败')
    }
  }, [refreshArchive])

  const handleDelete = useCallback(async (obj: VnaObject) => {
    const res = await vnaApi.deleteObject(obj.id)
    if (res.success) {
      message.success(`对象 ${obj.name} 已删除`)
      void refreshArchive()
    } else {
      message.error(res.error?.message || '删除失败')
    }
  }, [refreshArchive])

  // ─────────────────────── 患者归档视图 ───────────────────────

  const handleQueryPatient = useCallback(async () => {
    const patientId = patientInput.trim()
    if (!patientId) {
      message.warning('请输入患者 ID')
      return
    }
    setPatientLoading(true)
    try {
      const res = await vnaApi.getPatientArchive(patientId)
      if (res.success) setPatientArchive(res.data)
      else message.error(res.error?.message || '患者归档加载失败')
    } finally {
      setPatientLoading(false)
    }
  }, [patientInput])

  const timelineItems = useMemo<{
    key: string
    color: 'blue' | 'green' | 'orange'
    time: string
    title: string
    description: string
    object?: VnaObject
  }[]>(() => {
    if (!patientArchive) return []
    const studyEvents = patientArchive.studies.map((s) => ({
      key: `study-${s.studyUid}`,
      color: 'blue' as const,
      time: s.createdAt,
      title: `DICOM 检查归档 · ${s.modality} (${s.instanceCount} 实例 / ${s.seriesCount} 序列)`,
      description: s.studyDescription,
    }))
    const objectEvents = patientArchive.objects.map((o) => ({
      key: `obj-${o.id}`,
      color: (o.objectType === 'image' ? 'green' : 'orange') as 'green' | 'orange',
      time: o.createdAt,
      title: `${TYPE_LABEL[o.objectType]}归档 · ${o.name}${o.wormLocked ? ' (WORM 锁定)' : ''}`,
      description: o.description || o.mimeType,
      object: o,
    }))
    return [...studyEvents, ...objectEvents].sort((a, b) => (a.time < b.time ? 1 : -1))
  }, [patientArchive])

  const actionRender = (obj: VnaObject) => (
    <Space size={4}>
      <Button size="small" type="link" onClick={() => void openDetail(obj)}>查看</Button>
      <Button size="small" type="link" icon={<Download size={14} />} onClick={() => void handleDownload(obj)}>下载</Button>
      {!obj.wormLocked && (
        <Popconfirm
          title="WORM 锁定后不可删除"
          description={`确认锁定 ${obj.name} ? (一次性不可逆)`}
          okText="锁定"
          cancelText="取消"
          onConfirm={() => void handleLock(obj)}
        >
          <Button size="small" type="link" icon={<Lock size={14} />}>锁定</Button>
        </Popconfirm>
      )}
      {!obj.wormLocked && (
        <Popconfirm
          title="删除归档对象"
          description={`确认删除 ${obj.name} ?`}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => void handleDelete(obj)}
        >
          <Button size="small" type="link" danger>删除</Button>
        </Popconfirm>
      )}
    </Space>
  )

  const objectColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 260, ellipsis: true, render: (v: string, r: VnaObject) => (
      <Space>
        {r.objectType === 'image' ? <ImageIcon size={15} color="#0ea5e9" /> : <FileText size={15} color="#f59e0b" />}
        <Text ellipsis style={{ maxWidth: 220 }}>{v}</Text>
      </Space>
    ) },
    { title: '类型', dataIndex: 'objectType', key: 'type', width: 80, render: (v: VnaObjectType) => (
      <Tag color={v === 'image' ? 'cyan' : 'orange'}>{TYPE_LABEL[v]}</Tag>
    ) },
    { title: '患者 ID', dataIndex: 'patientId', key: 'patientId', width: 100, render: (v: string | null) => v ?? <Text type="secondary">-</Text> },
    { title: 'MIME', dataIndex: 'mimeType', key: 'mime', width: 150, ellipsis: true },
    { title: '大小', dataIndex: 'size', key: 'size', width: 90, render: (v: number) => formatSize(v) },
    { title: '归档时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => formatDate(v) },
    { title: 'WORM', dataIndex: 'wormLocked', key: 'worm', width: 90, render: (v: boolean) => v
      ? <Tag color="purple" icon={<Lock size={12} />}>已锁定</Tag>
      : <Tag icon={<LockOpen size={12} />}>未锁定</Tag> },
    { title: '操作', key: 'actions', width: 220, render: (_: unknown, r: VnaObject) => actionRender(r) },
  ]

  return (
    <div style={{ padding: 24, background: '#f1f5f9', minHeight: 'calc(100vh - 56px)' }}>
      <Card style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)', color: '#fff', border: 'none', marginBottom: 16 }}>
        <Space size={16}>
          <Archive size={36} color="#fff" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>VNA 厂商中立归档</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              对标 Agfa Enterprise Imaging / Sectra VNA / GE Datalogue · 非 DICOM 内容归档 + WORM 不可变存储
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <Space>
              <Button icon={<RefreshCw size={14} />} onClick={() => { void loadStats(); void loadObjects(); void loadStudies() }}>刷新</Button>
              <Button type="primary" ghost icon={<Plus size={14} />} onClick={openUpload}>上传归档</Button>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 归档统计卡 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card loading={statsLoading}><Statistic title="归档对象数" value={stats?.totalObjects ?? 0} prefix={<FileText size={16} />} styles={{ content: { color: '#7c3aed' } }} /></Card></Col>
        <Col span={5}><Card loading={statsLoading}><Statistic title="归档总容量" value={stats ? formatSize(stats.totalSizeBytes) : '-'} prefix={<HardDrive size={16} />} styles={{ content: { color: '#dc2626' } }} /></Card></Col>
        <Col span={5}><Card loading={statsLoading}><Statistic title="DICOM 实例数" value={stats?.dicomCount ?? 0} prefix={<DatabaseIcon size={16} />} styles={{ content: { color: '#0891b2' } }} /></Card></Col>
        <Col span={5}><Card loading={statsLoading}><Statistic title="非 DICOM 对象" value={stats?.nonDicomCount ?? 0} prefix={<FileText size={16} />} styles={{ content: { color: '#f59e0b' } }} /></Card></Col>
        <Col span={5}><Card loading={statsLoading}><Statistic title="WORM 锁定" value={stats?.wormLockedCount ?? 0} prefix={<ShieldCheck size={16} />} styles={{ content: { color: '#10b981' } }} /></Card></Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="objects"
          items={[
            {
              key: 'objects',
              label: `归档对象 (${objects.length})`,
              children: (
                <>
                  <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
                    <Space>
                      <Select
                        style={{ width: 140 }}
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v)}
                        placeholder="类型筛选"
                        options={[
                          { value: '', label: '全部类型' },
                          { value: 'document', label: '文档' },
                          { value: 'image', label: '图像' },
                        ]}
                      />
                      <Input
                        style={{ width: 240 }}
                        allowClear
                        prefix={<Search size={14} />}
                        placeholder="搜索名称 / 描述 / Study UID"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onPressEnter={() => void loadObjects()}
                      />
                      <Button type="primary" onClick={() => void loadObjects()}>查询</Button>
                    </Space>
                    <Text type="secondary" data-testid="vna-objects-count">共 {objects.length} 个对象</Text>
                  </Space>
                  <Table
                    data-testid="vna-objects-table"
                    dataSource={objects}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    columns={objectColumns}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                  />
                </>
              ),
            },
            {
              key: 'studies',
              label: `DICOM 检查归档 (${studies.length})`,
              children: (
                <Table
                  data-testid="vna-studies-table"
                  dataSource={studies}
                  rowKey="studyUid"
                  size="small"
                  loading={studiesLoading}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  columns={[
                    { title: 'Study UID', dataIndex: 'studyUid', key: 'uid', width: 260, ellipsis: true },
                    { title: '模态', dataIndex: 'modality', key: 'mod', width: 80, render: (v: string) => <Tag color="blue">{v}</Tag> },
                    { title: '描述', dataIndex: 'studyDescription', key: 'desc', ellipsis: true },
                    { title: '序列数', dataIndex: 'seriesCount', key: 'series', width: 90 },
                    { title: '实例数', dataIndex: 'instanceCount', key: 'inst', width: 90 },
                    { title: '归档时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => formatDate(v) },
                  ]}
                />
              ),
            },
            {
              key: 'patient',
              label: '患者归档视图',
              children: (
                <div data-testid="vna-patient-archive">
                  <Space style={{ marginBottom: 16 }}>
                    <Input
                      style={{ width: 260 }}
                      prefix={<User size={14} />}
                      placeholder="输入患者 ID (如 P00001)"
                      value={patientInput}
                      onChange={(e) => setPatientInput(e.target.value)}
                      onPressEnter={() => void handleQueryPatient()}
                    />
                    <Button type="primary" loading={patientLoading} onClick={() => void handleQueryPatient()}>查看全生命周期归档</Button>
                  </Space>
                  {!patientArchive ? (
                    <Empty description="输入患者 ID 查看其全部归档对象 (DICOM 检查 + 非 DICOM 文档/图像)" style={{ padding: 32 }} />
                  ) : (
                    <>
                      <Alert
                        style={{ marginBottom: 16 }}
                        type="info"
                        showIcon
                        title={`患者 ${patientArchive.patientId} 归档汇总`}
                        description={`${patientArchive.studies.length} 个 DICOM 检查 · ${patientArchive.objects.length} 个非 DICOM 对象 · 归档容量 ${formatSize(patientArchive.totalSizeBytes)}`}
                      />
                      <Row gutter={16}>
                        <Col span={14}>
                          <Card size="small" title="对象列表">
                            <Table
                              dataSource={patientArchive.objects}
                              rowKey="id"
                              size="small"
                              pagination={false}
                              columns={[
                                { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
                                { title: '类型', dataIndex: 'objectType', key: 'type', width: 70, render: (v: VnaObjectType) => <Tag color={v === 'image' ? 'cyan' : 'orange'}>{TYPE_LABEL[v]}</Tag> },
                                { title: '大小', dataIndex: 'size', key: 'size', width: 80, render: (v: number) => formatSize(v) },
                                { title: '归档时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (v: string) => formatDate(v) },
                                { title: '操作', key: 'ops', width: 180, render: (_: unknown, r: VnaObject) => actionRender(r) },
                              ]}
                            />
                          </Card>
                        </Col>
                        <Col span={10}>
                          <Card size="small" title="全生命周期时间线" data-testid="vna-patient-timeline">
                            <Timeline
                              items={timelineItems.map((item) => ({
                                key: item.key,
                                color: item.color,
                                content: (
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>{item.description}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{formatDate(item.time)}</div>
                                    {item.object && (
                                      <Space size={4} style={{ marginTop: 4 }}>
                                        <Button size="small" type="link" onClick={() => void openDetail(item.object!)}>查看</Button>
                                        <Button size="small" type="link" onClick={() => void handleDownload(item.object!)}>下载</Button>
                                      </Space>
                                    )}
                                  </div>
                                ),
                              }))}
                            />
                          </Card>
                        </Col>
                      </Row>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 上传 Modal */}
      <Modal
        title="归档非 DICOM 内容"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => void handleUploadSubmit()}
        confirmLoading={uploading}
        okText="归档"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={uploadForm} layout="vertical" initialValues={{ objectType: 'document' }}>
          <Form.Item name="patientId" label="患者 ID" rules={[{ required: true, message: '请输入患者 ID' }]}>
            <Input placeholder="如 P00001" />
          </Form.Item>
          <Form.Item name="objectType" label="对象类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'document', label: '文档 (报告/知情同意/申请单等)' },
                { value: 'image', label: '图像 (胶片扫描/照片/截图等)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="studyUid" label="关联 Study UID (可选)">
            <Input placeholder="关联 DICOM 检查, 如 1.2.840.10008..." />
          </Form.Item>
          <Form.Item name="name" label="对象名称 (不填则用文件名)">
            <Input placeholder="对象名称" />
          </Form.Item>
          <Form.Item name="description" label="描述 (可选)">
            <Input.TextArea rows={2} placeholder="对象描述" />
          </Form.Item>
          <Form.Item label="文件">
            <Upload
              beforeUpload={(file) => {
                setUploadFile(file)
                return false
              }}
              maxCount={1}
              onRemove={() => setUploadFile(null)}
            >
              <Button icon={<UploadOutlined />}>选择文件 (最大 100MB)</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* 对象详情 Drawer */}
      <Drawer
        title={detail ? `对象详情 · ${detail.name}` : '对象详情'}
        width={480}
        open={drawerOpen}
        onClose={closeDetail}
        extra={detail && (
          <Space>
            {!detail.wormLocked && (
              <Popconfirm title="WORM 锁定后不可删除" okText="锁定" cancelText="取消" onConfirm={() => detail && void handleLock(detail)}>
                <Button icon={<Lock size={14} />}>WORM 锁定</Button>
              </Popconfirm>
            )}
            <Button type="primary" icon={<Download size={14} />} onClick={() => detail && void handleDownload(detail)}>下载</Button>
          </Space>
        )}
      >
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered data-testid="vna-object-detail">
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={detail.objectType === 'image' ? 'cyan' : 'orange'}>{TYPE_LABEL[detail.objectType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="患者 ID">{detail.patientId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Study UID">{detail.studyUid ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="MIME 类型">{detail.mimeType}</Descriptions.Item>
              <Descriptions.Item label="大小">{formatSize(detail.size)}</Descriptions.Item>
              <Descriptions.Item label="描述">{detail.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="WORM 状态">
                {detail.wormLocked
                  ? <Tag color="purple" icon={<Lock size={12} />}>已锁定 (不可删除)</Tag>
                  : <Tag icon={<LockOpen size={12} />}>未锁定</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="归档时间">{formatDate(detail.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="存储来源">
                <Tag color={detail.storageSource === 'database' ? 'green' : 'default'}>
                  {detail.storageSource === 'database' ? '数据库' : '内存回退'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Text strong>内容预览</Text>
              <div
                style={{
                  marginTop: 8, border: '1px dashed #d9d9d9', borderRadius: 8, padding: 12,
                  minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#fafafa',
                }}
                data-testid="vna-object-preview"
              >
                {detail.objectType === 'image' ? (
                  previewLoading ? <Text type="secondary">加载预览中...</Text>
                    : previewUrl ? <img src={previewUrl} alt={detail.name} style={{ maxWidth: '100%', maxHeight: 320 }} />
                    : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无法预览" />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="非图像文档, 请点击下载查看" />
                )}
              </div>
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}

export default VNADashboardPage

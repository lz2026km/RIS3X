/**
 * G005 v3.0.6.11-75 W3-1 - DICOMweb 工具页
 * QIDO-RS 检索(dicomWebApi.searchStudies) + 结果列表 + WADO-RS 预览 + STOW-RS 上传 + loading/error
 */
import WadoRsViewer from '../../components/dicom/WadoRsViewer'
import { dicomWebApi, type DicomWebCapabilities, type DicomWebStudy } from '../../services/api/dicomApi'
import { UploadOutlined, SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import {
  Card, Input, Select, Upload, Button, message, Typography, Space, Divider, Table, Tag, Alert, Spin, Empty, Modal,
} from 'antd'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const { Title, Text } = Typography

const SERVER_OPTIONS = [
  { label: 'DICOMweb (默认)', value: 'default' },
  { label: 'Orthanc', value: 'orthanc' },
  { label: 'dcm4chee', value: 'dcm4chee' },
]

const MODALITY_OPTIONS = ['CT', 'MR', 'DR', 'MG', 'US', 'DSA', 'CBCT'].map((m) => ({ label: m, value: m }))

export default function DicomWebPage() {
  const [server, setServer] = useState('default')
  const [studyUID, setStudyUID] = useState('')
  const [loadedUID, setLoadedUID] = useState('')
  const [capabilities, setCapabilities] = useState<DicomWebCapabilities | null>(null)
  const [uploading, setUploading] = useState(false)

  const [qidopatient, setQidopatient] = useState('')
  const [qidomodality, setQidomodality] = useState<string>('')
  const [qidokeyword, setQidokeyword] = useState('')
  const [studies, setStudies] = useState<DicomWebStudy[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [previewStudy, setPreviewStudy] = useState<string | null>(null)
  // [W2-C] 受控分页
  const [studyPage, setStudyPage] = useState(1)

  useEffect(() => {
    dicomWebApi.capabilities().then((res) => {
      if (res.success) setCapabilities(res.data)
    }).catch(() => { /* 能力探测失败不阻塞 */ })
  }, [])

  const loadCapabilities = async () => {
    try {
      const res = await dicomWebApi.capabilities()
      if (res.success) setCapabilities(res.data)
    } catch { /* ignore */ }
  }

  const handleLoad = async () => {
    if (!studyUID.trim()) {
      message.warning('请输入 StudyUID')
      return
    }
    setLoadedUID(studyUID.trim())
    await loadCapabilities()
  }

  const handleQidoSearch = useCallback(async () => {
    setSearchLoading(true)
    setSearchError('')
    try {
      const params: { PatientID?: string; Modality?: string; limit?: number } = { limit: 50 }
      if (qidopatient.trim()) params.PatientID = qidopatient.trim()
      if (qidomodality) params.Modality = qidomodality
      const res = await dicomWebApi.searchStudies(params)
      let list: DicomWebStudy[] = []
      if (res.success && Array.isArray(res.data)) list = res.data
      else {
        setSearchError(res.error?.message ?? 'QIDO-RS 检索失败')
        setStudies([])
        return
      }
      if (qidokeyword.trim()) {
        const kw = qidokeyword.trim().toLowerCase()
        list = list.filter((s) => `${s.patientName ?? ''} ${s.studyDescription ?? ''} ${s.patientID ?? ''}`.toLowerCase().includes(kw))
      }
      setStudies(list)
      setStudyPage(1)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'QIDO-RS 检索失败')
      setStudies([])
    } finally {
      setSearchLoading(false)
    }
  }, [qidopatient, qidomodality, qidokeyword])

  useEffect(() => {
    void handleQidoSearch()
  }, [handleQidoSearch])

  async function handleUpload(file: File) {
    setUploading(true)
    const studyUid = studyUID.trim() || 'default'
    try {
      await dicomWebApi.stowRsStore(studyUid, file)
      message.success('DICOM 上传成功')
      void handleQidoSearch()
    } catch (err) {
      message.error('上传失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setUploading(false)
    }
    return false
  }

  const columns = [
    { title: '检查 UID', dataIndex: 'studyInstanceUID', key: 'uid', width: 240, ellipsis: true, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: '患者', dataIndex: 'patientName', key: 'patient', width: 100 },
    { title: '患者 ID', dataIndex: 'patientID', key: 'pid', width: 100 },
    { title: '模态', dataIndex: 'modalitiesInStudy', key: 'modality', width: 110, render: (v: string[]) => <Space size={2} wrap>{(v ?? []).map((m) => <Tag key={m} color="blue">{m}</Tag>)}</Space> },
    { title: '检查描述', dataIndex: 'studyDescription', key: 'desc', ellipsis: true },
    { title: '日期', dataIndex: 'studyDate', key: 'date', width: 100 },
    { title: '序列/实例', key: 'count', width: 90, render: (_: unknown, r: DicomWebStudy) => <Text type="secondary" style={{ fontSize: 12 }}>{r.numberOfStudyRelatedSeries ?? '-'} / {r.numberOfStudyRelatedInstances ?? '-'}</Text> },
    {
      title: '操作', key: 'actions', width: 170,
      render: (_: unknown, r: DicomWebStudy) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setLoadedUID(r.studyInstanceUID); setPreviewStudy(r.studyInstanceUID) }}>WADO 预览</Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => {
            if (r.modalitiesInStudy?.[0]) {
              window.open(`/api/v1/dicom-web/studies/${encodeURIComponent(r.studyInstanceUID)}`, '_blank')
            } else {
              message.info('该检查暂无实例可下载')
            }
          }}>下载</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Space style={{ marginBottom: 8 }} wrap>
        <Title level={3} style={{ margin: 0 }}>DICOMweb 工具</Title>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="geekblue">QIDO-RS · WADO-RS · STOW-RS</Tag>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>DICOMweb RESTful 影像服务:检索检查(Study) → 预览序列/实例 → 上传 DICOM 文件</Text>

      {searchError && (
        <Alert type="error" showIcon message="QIDO-RS 检索失败" description={searchError} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void handleQidoSearch()}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <Card size="small" title="QIDO-RS 检索" style={{ marginBottom: 16 }} extra={capabilities && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          QIDO-RS: {capabilities.qidors ? '✓' : '✗'} | WADO-RS: {capabilities.wadors ? '✓' : '✗'} | STOW-RS: {capabilities.stowrs ? '✓' : '✗'} | v{capabilities.version}
        </Text>
      )}>
        <Space wrap style={{ width: '100%', marginBottom: 12 }}>
          <Input placeholder="患者 ID" value={qidopatient} onChange={(e) => setQidopatient(e.target.value)} style={{ width: 150 }} />
          <Select placeholder="模态" allowClear style={{ width: 100 }} options={MODALITY_OPTIONS} value={qidomodality || undefined} onChange={(v) => setQidomodality(v ?? '')} />
          <Input placeholder="检查描述关键词" value={qidokeyword} onChange={(e) => setQidokeyword(e.target.value)} style={{ width: 220 }} onPressEnter={() => void handleQidoSearch()} />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => void handleQidoSearch()} loading={searchLoading}>QIDO 检索</Button>
        </Space>
        {searchLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : studies.length === 0 ? (
          <Empty description="无检索结果(输入条件自动检索或全部列出)" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table rowKey="studyInstanceUID" size="small" dataSource={studies} columns={columns} pagination={{ current: studyPage, pageSize: 10, total: studies.length, onChange: setStudyPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 900 }} />
        )}
      </Card>

      <Card size="small" title="WADO-RS 按检查 UID 预览" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select options={SERVER_OPTIONS} value={server} onChange={setServer} style={{ width: 180 }} />
          <Input
            placeholder="检查实例 UID"
            value={studyUID}
            onChange={(e) => setStudyUID(e.target.value)}
            style={{ width: 360 }}
            onPressEnter={handleLoad}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleLoad}>WADO-RS</Button>
        </Space>
      </Card>

      {loadedUID && <WadoRsViewer studyUID={loadedUID} serverUrl={server} />}

      <Divider />

      <Card title="STOW-RS 上传" size="small">
        <Upload.Dragger accept=".dcm" showUploadList={false} beforeUpload={handleUpload} disabled={uploading}>
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">拖拽 DICOM 文件到这里</p>
        </Upload.Dragger>
      </Card>

      <Modal title="WADO-RS 影像预览" open={!!previewStudy} onCancel={() => setPreviewStudy(null)} footer={null} width={760}>
        {previewStudy && <WadoRsViewer studyUID={previewStudy} serverUrl={server} />}
      </Modal>
    </div>
  )
}

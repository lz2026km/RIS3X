/**
 * G005 v3.0.6.11-75 W3-1 - DICOMweb 工具页
 * QIDO-RS 检索(dicomWebApi.searchStudies) + 结果列表 + WADO-RS 预览 + STOW-RS 上传 + loading/error
 */
import WadoRsViewer from '../../components/dicom/WadoRsViewer'
import { dicomWebApi, type DicomWebCapabilities, type DicomWebStudy } from '../../services/api/dicomApi'
import {
  Card, Input, Select, Upload, Button, message, Typography, Space, Divider, Table, Tag, Alert, Spin, Modal,
} from 'antd'
import { EmptyState } from '../../components/common/EmptyState'
import { RefreshCw, Upload as UploadIcon, Search, Eye, Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { t } from '../../i18n/appI18n'

const { Title, Text } = Typography

const SERVER_OPTIONS = [
  { label: t('dw.server.default'), value: 'default' },
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
      message.warning(t('dw.enterStudyUid'))
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
        setSearchError(res.error?.message ?? t('dw.qidoFailed'))
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
      setSearchError(e instanceof Error ? e.message : t('dw.qidoFailed'))
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
      message.success(t('dw.uploadSuccess'))
      void handleQidoSearch()
    } catch (err) {
      message.error(t('w9d.dicomWeb.uploadFailed', { msg: err instanceof Error ? err.message : t('w9d.sidebar.unknownError') }))
    } finally {
      setUploading(false)
    }
    return false
  }

  const columns = [
    { title: t('dw.colUid'), dataIndex: 'studyInstanceUID', key: 'uid', width: 240, ellipsis: true, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: t('dw.colPatient'), dataIndex: 'patientName', key: 'patient', width: 100 },
    { title: t('dw.colPatientId'), dataIndex: 'patientID', key: 'pid', width: 100 },
    { title: t('dw.colModality'), dataIndex: 'modalitiesInStudy', key: 'modality', width: 110, render: (v: string[]) => <Space size={2} wrap>{(v ?? []).map((m) => <Tag key={m} color="blue">{m}</Tag>)}</Space> },
    { title: t('dw.colDesc'), dataIndex: 'studyDescription', key: 'desc', ellipsis: true },
    { title: t('dw.colDate'), dataIndex: 'studyDate', key: 'date', width: 100 },
    { title: t('dw.colSeriesInstances'), key: 'count', width: 90, render: (_: unknown, r: DicomWebStudy) => <Text type="secondary" style={{ fontSize: 12 }}>{r.numberOfStudyRelatedSeries ?? '-'} / {r.numberOfStudyRelatedInstances ?? '-'}</Text> },
    {
      title: t('dw.colActions'), key: 'actions', width: 170,
      render: (_: unknown, r: DicomWebStudy) => (
        <Space size={4}>
          <Button size="small" icon={<Eye />} onClick={() => { setLoadedUID(r.studyInstanceUID); setPreviewStudy(r.studyInstanceUID) }}>{t('dw.wadoPreview')}</Button>
          <Button size="small" icon={<Download />} onClick={() => {
            if (r.modalitiesInStudy?.[0]) {
              window.open(`/api/v1/dicom-web/studies/${encodeURIComponent(r.studyInstanceUID)}`, '_blank')
            } else {
              message.info(t('dw.noInstances'))
            }
          }}>{t('dw.download')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Space style={{ marginBottom: 8 }} wrap>
        <Title level={3} style={{ margin: 0 }}>{t('dw.title')}</Title>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="geekblue">QIDO-RS · WADO-RS · STOW-RS</Tag>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{t('dw.subtitle')}</Text>

      {searchError && (
        <Alert type="error" showIcon message={t('dw.qidoFailed')} description={searchError} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void handleQidoSearch()}><RefreshCw size={14} /> {t('dw.retry')}</Button>} />
      )}

      <Card size="small" title={t('dw.qidoTitle')} style={{ marginBottom: 16 }} extra={capabilities && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          QIDO-RS: {capabilities.qidors ? '' : ''} | WADO-RS: {capabilities.wadors ? '' : ''} | STOW-RS: {capabilities.stowrs ? '' : ''} | v{capabilities.version}
        </Text>
      )}>
        <Space wrap style={{ width: '100%', marginBottom: 12 }}>
          <Input placeholder={t('dw.colPatientId')} value={qidopatient} onChange={(e) => setQidopatient(e.target.value)} style={{ width: 150 }} />
          <Select placeholder={t('dw.colModality')} allowClear style={{ width: 100 }} options={MODALITY_OPTIONS} value={qidomodality || undefined} onChange={(v) => setQidomodality(v ?? '')} />
          <Input placeholder={t('dw.descKeywordPlaceholder')} value={qidokeyword} onChange={(e) => setQidokeyword(e.target.value)} style={{ width: 220 }} onPressEnter={() => void handleQidoSearch()} />
          <Button type="primary" icon={<Search />} onClick={() => void handleQidoSearch()} loading={searchLoading}>{t('dw.qidoSearch')}</Button>
        </Space>
        {searchLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : studies.length === 0 ? (
          <EmptyState description={t('dw.noResults')} />
        ) : (
          <Table rowKey="studyInstanceUID" size="small" dataSource={studies} columns={columns} pagination={{ current: studyPage, pageSize: 10, total: studies.length, onChange: setStudyPage, showSizeChanger: false, showTotal: (n) => t('w9d.dicomWeb.totalCount', { n }) }} scroll={{ x: 900 }} />
        )}
      </Card>

      <Card size="small" title={t('dw.wadoTitle')} style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select options={SERVER_OPTIONS} value={server} onChange={setServer} style={{ width: 180 }} />
          <Input
            placeholder={t('dw.studyUidPlaceholder')}
            value={studyUID}
            onChange={(e) => setStudyUID(e.target.value)}
            style={{ width: 360 }}
            onPressEnter={handleLoad}
          />
          <Button type="primary" icon={<Search />} onClick={handleLoad}>WADO-RS</Button>
        </Space>
      </Card>

      {loadedUID && <WadoRsViewer studyUID={loadedUID} serverUrl={server} />}

      <Divider />

      <Card title={t('dw.stowTitle')} size="small">
        <Upload.Dragger accept=".dcm" showUploadList={false} beforeUpload={handleUpload} disabled={uploading}>
          <p className="ant-upload-drag-icon"><UploadIcon /></p>
          <p className="ant-upload-text">{t('dw.dragHint')}</p>
        </Upload.Dragger>
      </Card>

      <Modal title={t('dw.wadoPreviewTitle')} open={!!previewStudy} onCancel={() => setPreviewStudy(null)} footer={null} width={760}>
        {previewStudy && <WadoRsViewer studyUID={previewStudy} serverUrl={server} />}
      </Modal>
    </div>
  )
}

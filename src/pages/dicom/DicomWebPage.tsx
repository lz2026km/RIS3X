import { useState } from 'react'
import { Card, Input, Select, Upload, Button, message, Typography, Space, Divider } from 'antd'
import { UploadOutlined, SearchOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import WadoRsViewer from '../../components/dicom/WadoRsViewer'
import { dicomWebApi, type DicomWebCapabilities } from '../../services/api/dicomApi'

const { Title, Text } = Typography

const SERVER_OPTIONS = [
  { label: 'DICOMweb (默认)', value: 'default' },
  { label: 'Orthanc', value: 'orthanc' },
  { label: 'dcm4chee', value: 'dcm4chee' },
]

export default function DicomWebPage() {
  const { t } = useTranslation('dicom')
  const [server, setServer] = useState('default')
  const [studyUID, setStudyUID] = useState('')
  const [loadedUID, setLoadedUID] = useState('')
  const [capabilities, setCapabilities] = useState<DicomWebCapabilities | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleLoad() {
    if (!studyUID.trim()) {
      message.warning('请输入 StudyUID')
      return
    }
    setLoadedUID(studyUID.trim())
    try {
      const res = await dicomWebApi.capabilities()
      if (res.success) setCapabilities(res.data)
    } catch { /* ignore */ }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    const studyUid = studyUID.trim() || 'default'
    try {
      await dicomWebApi.stowRsStore(studyUid, file)
      message.success('DICOM 上传成功')
    } catch (err) {
      message.error('上传失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setUploading(false)
    }
    return false
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3}>DICOMweb</Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select options={SERVER_OPTIONS} value={server} onChange={setServer} style={{ width: 180 }} />
          <Input
            placeholder="Study Instance UID"
            value={studyUID}
            onChange={(e) => setStudyUID(e.target.value)}
            style={{ width: 360 }}
            onPressEnter={handleLoad}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleLoad}>
            WADO-RS
          </Button>
        </Space>
        {capabilities && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              QIDO-RS: {capabilities.qidors ? '✓' : '✗'} |
              WADO-RS: {capabilities.wadors ? '✓' : '✗'} |
              STOW-RS: {capabilities.stowrs ? '✓' : '✗'} |
              v{capabilities.version}
            </Text>
          </div>
        )}
      </Card>

      {loadedUID && <WadoRsViewer studyUID={loadedUID} serverUrl={server} />}

      <Divider />

      <Card title="STOW-RS 上传" size="small">
        <Upload.Dragger
          accept=".dcm"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">{t('dragHere', '拖拽 DICOM 文件到这里')}</p>
        </Upload.Dragger>
      </Card>
    </div>
  )
}
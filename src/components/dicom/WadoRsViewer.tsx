import { useState, useEffect } from 'react'
import { Tree, Button, Spin, Modal, Typography, Space, Card } from 'antd'
import { DownloadOutlined, FolderOpenOutlined, FileOutlined, PictureOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../../services/api/client'
import { dicomWebApi, type DicomWebStudy, type DicomWebSeries, type DicomWebInstance } from '../../services/api/dicomApi'

const { Text } = Typography

interface TreeNode {
  title: string
  key: string
  icon: React.ReactNode
  children?: TreeNode[]
  isLeaf?: boolean
  data?: DicomWebInstance
}

interface Props {
  studyUID: string
  serverUrl?: string
}

export default function WadoRsViewer({ studyUID }: Props) {
  const { t } = useTranslation('dicom')
  const [loading, setLoading] = useState(false)
  const [study, setStudy] = useState<DicomWebStudy | null>(null)
  const [seriesList, setSeriesList] = useState<DicomWebSeries[]>([])
  const [instancesMap, setInstancesMap] = useState<Record<string, DicomWebInstance[]>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!studyUID) return
    loadStudy()
  }, [studyUID])

  async function loadStudy() {
    setLoading(true)
    try {
      const [studiesRes, seriesRes] = await Promise.all([
        dicomWebApi.searchStudies({ StudyInstanceUID: studyUID }),
        dicomWebApi.searchSeries(studyUID),
      ])
      if (studiesRes.success && studiesRes.data.length > 0) {
        const first = studiesRes.data[0]
        if (first) setStudy(first)
      }
      if (seriesRes.success) {
        setSeriesList(seriesRes.data)
        const map: Record<string, DicomWebInstance[]> = {}
        await Promise.all(seriesRes.data.map(async (s) => {
          const instRes = await dicomWebApi.searchInstances(studyUID, s.seriesInstanceUID)
          if (instRes.success) map[s.seriesInstanceUID] = instRes.data
        }))
        setInstancesMap(map)
      }
    } finally {
      setLoading(false)
    }
  }

  function buildTree(): TreeNode[] {
    return seriesList.map((series) => {
      const instances = instancesMap[series.seriesInstanceUID] || []
      return {
        title: `${series.modality} #${series.seriesNumber} - ${series.seriesDescription || 'N/A'} (${instances.length})`,
        key: `series-${series.seriesInstanceUID}`,
        icon: <FolderOpenOutlined />,
        children: instances.map((inst) => ({
          title: `#${inst.instanceNumber} SOP: ${inst.sopInstanceUID.slice(0, 12)}...`,
          key: `inst-${inst.sopInstanceUID}`,
          icon: <FileOutlined />,
          isLeaf: true,
          data: inst,
        })),
      }
    })
  }

  function handlePreview(inst: DicomWebInstance) {
    const url = dicomWebApi.retrieveInstanceUrl(studyUID, inst.seriesInstanceUID, inst.sopInstanceUID)
    setPreviewUrl(url)
    setPreviewOpen(true)
  }

  async function handleDownload() {
    if (!studyUID) return
    const a = document.createElement('a')
    a.href = `${API_BASE}/dicom-web/studies/${encodeURIComponent(studyUID)}`
    a.download = `study-${studyUID}.zip`
    a.click()
  }

  return (
    <Card title={t('viewer')} extra={study && <Button icon={<DownloadOutlined />} onClick={handleDownload}>{t('upload')}</Button>}>
      <Spin spinning={loading}>
        {study && (
          <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Text strong>{study.patientName} ({study.patientID})</Text>
            <Text type="secondary">{study.studyDescription} | {study.studyDate}</Text>
          </Space>
        )}
        <Tree
          showIcon
          treeData={buildTree()}
          onSelect={(_, info) => {
            const node = info.node as unknown as TreeNode
            if (node.data) handlePreview(node.data)
          }}
          style={{ marginTop: 'var(--space-3, 12px)' }}
        />
        {seriesList.length === 0 && !loading && (
          <Text type="secondary">{t('series')}</Text>
        )}
      </Spin>
      <Modal open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={600} title={t('viewer')}>
        {previewUrl ? (
          <div style={{ background: '#000', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PictureOutlined style={{ fontSize: 64, color: '#666' }} />
            <Text style={{ color: '#999', marginLeft: 'var(--space-3, 12px)' }}>{t('instance')}</Text>
          </div>
        ) : (
          <Text type="secondary">{t('series')}</Text>
        )}
      </Modal>
    </Card>
  )
}
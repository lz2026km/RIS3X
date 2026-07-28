import React, { useState, useEffect } from 'react'
import { Card, Space, Tag, Button, Row, Col, Select, Tabs, Empty, message } from 'antd'
import { Box, Activity, List } from 'lucide-react'
import VolumeRenderer from '../../components/v3/dicom/VolumeRenderer'
import { useTranslation } from 'react-i18next'
import { dicomWebApi, volumeApi } from '../../services/api/dicomApi'

interface SeriesInfo {
  seriesUID: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  instances: number
}

const VolumeViewerPage: React.FC = () => {
  const { t } = useTranslation('v3dicom')
  const [series, setSeries] = useState<SeriesInfo[]>([])
  const [selectedUid, setSelectedUid] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [reconstructing, setReconstructing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const [volumeDims, setVolumeDims] = useState<{ x: number; y: number; z: number } | null>(null)

  useEffect(() => {
    const studyUid = new URLSearchParams(window.location.search).get('studyUID')
    if (!studyUid) return
    setLoading(true)
    dicomWebApi.searchSeries(studyUid).then(res => {
      if (res.success) {
        setSeries(res.data.map(s => ({
          seriesUID: s.seriesInstanceUID,
          seriesNumber: s.seriesNumber,
          seriesDescription: s.seriesDescription,
          modality: s.modality,
          instances: s.numberOfSeriesRelatedInstances,
        })))
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleReconstruct = async () => {
    if (!selectedUid) { message.warning('请先选择序列'); return }
    setReconstructing(true)
    setProgress(0)
    setVolumeDims(null)
    const res = await volumeApi.reconstruct(selectedUid)
    if (!res.success) {
      setReconstructing(false)
      message.error(res.error?.message || '重建请求失败')
      return
    }
    const { jobId: newJobId, volume } = res.data
    setJobId(newJobId)
    setVolumeDims(volume)
    const poll = setInterval(async () => {
      const sr = await volumeApi.status(newJobId)
      if (!sr.success) { clearInterval(poll); setReconstructing(false); return }
      setProgress(sr.data.progress)
      if (sr.data.status === 'completed' || sr.data.progress >= 100) {
        clearInterval(poll)
        setReconstructing(false)
        message.success('体数据重建完成')
      }
    }, 300)
  }

  const selectedSeries = series.find(s => s.seriesUID === selectedUid)

  return (
    <div style={{ padding: 16, background: '#f0f2f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 12 }}>
        <Box size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('volumeViewer', '3D Volume Viewer')}</span>
        <Tag color="cyan">MIP / MPR / VR</Tag>
        {volumeDims && <Tag color="geekblue">{volumeDims.x}×{volumeDims.y}×{volumeDims.z}</Tag>}
      </Space>

      <Row gutter={12} style={{ height: 'calc(100vh - 100px)' }}>
        <Col span={4}>
          <Card size="small" title={<Space><List size={14} /><span>序列</span></Space>} style={{ height: '100%' }} styles={{ body: { overflow: 'auto', maxHeight: 'calc(100vh - 160px)' } }}>
            <Select
              style={{ width: '100%', marginBottom: 8 }}
              placeholder="选择序列"
              value={selectedUid}
              onChange={setSelectedUid}
              options={series.map(s => ({ value: s.seriesUID, label: `#${s.seriesNumber} ${s.seriesDescription}` }))}
            />
            {selectedSeries && (
              <div style={{ fontSize: 12 }}>
                <div><Tag color="blue">{selectedSeries.modality}</Tag></div>
                <div style={{ color: '#666', marginTop: 4 }}>{selectedSeries.seriesDescription}</div>
                <div style={{ color: '#999' }}>实例数: {selectedSeries.instances}</div>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <Button type="primary" size="small" block loading={reconstructing} onClick={handleReconstruct} icon={<Activity size={12} />}>
                {reconstructing ? `重建中 ${progress}%` : '重建'}
              </Button>
            </div>
            {jobId && <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>Job: {jobId}</div>}
            <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
              <Tabs
                size="small"
                items={[
                  { key: 'mip', label: 'MIP', children: <Empty description="数据待接入" /> },
                  { key: 'mpr', label: 'MPR', children: <Empty description="数据待接入" /> },
                  { key: 'vr', label: 'VR', children: <Empty description="数据待接入" /> },
                ]}
              />
            </div>
          </Card>
        </Col>
        <Col span={20}>
          <VolumeRenderer
            seriesUid={selectedUid}
            volumeData={volumeDims ?? undefined}
          />
        </Col>
      </Row>
    </div>
  )
}

export default VolumeViewerPage

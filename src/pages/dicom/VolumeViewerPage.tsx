import React, { useState, useEffect } from 'react'
import { Card, Space, Tag, Button, Row, Col, Select, Spin, Tabs, Empty, message, Badge } from 'antd'
import { Box, Activity, List, Layers, RefreshCw } from 'lucide-react'
import VolumeRenderer from '../../components/v3/dicom/VolumeRenderer'
import { useTranslation } from 'react-i18next'

interface SeriesInfo {
  seriesUID: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  instances: number
}

const MOCK_SERIES: SeriesInfo[] = [
  { seriesUID: '1.2.840.113619.2.55.3.604250.1.1.20260701.1', seriesNumber: 301, seriesDescription: 'CT 3.0 C+ 腹部', modality: 'CT', instances: 256 },
  { seriesUID: '1.2.840.113619.2.55.3.604250.1.1.20260701.2', seriesNumber: 401, seriesDescription: 'CT 3.0 平扫 腹部', modality: 'CT', instances: 192 },
  { seriesUID: '1.2.840.113619.2.55.3.604250.1.1.20260701.3', seriesNumber: 501, seriesDescription: 'MR 3D T1 颅脑', modality: 'MR', instances: 224 },
  { seriesUID: '1.2.840.113619.2.55.3.604250.1.1.20260701.4', seriesNumber: 601, seriesDescription: 'CT 冠脉 CTA', modality: 'CT', instances: 480 },
]

const VolumeViewerPage: React.FC = () => {
  const { t } = useTranslation('v3dicom')
  const [series, setSeries] = useState<SeriesInfo[]>(MOCK_SERIES)
  const [selectedUid, setSelectedUid] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [reconstructing, setReconstructing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const [volumeDims, setVolumeDims] = useState<{ x: number; y: number; z: number } | null>(null)

  const handleReconstruct = async () => {
    if (!selectedUid) { message.warning('请先选择序列'); return }
    setReconstructing(true)
    setProgress(0)
    setVolumeDims(null)
    try {
      const res = await fetch('/api/v1/volume/reconstruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesUID: selectedUid }),
      })
      const data = await res.json()
      if (data.jobId) {
        setJobId(data.jobId)
        setVolumeDims(data.volume)
        const poll = setInterval(async () => {
          try {
            const sr = await fetch(`/api/v1/volume/status/${data.jobId}`)
            const sd = await sr.json()
            setProgress(sd.progress)
            if (sd.status === 'completed' || sd.progress >= 100) {
              clearInterval(poll)
              setReconstructing(false)
              message.success('体数据重建完成')
            }
          } catch { clearInterval(poll); setReconstructing(false) }
        }, 300)
      }
    } catch {
      setReconstructing(false)
      message.error('重建失败，使用本地演示数据')
      setVolumeDims({ x: 512, y: 512, z: 256 })
    }
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
                  { key: 'mip', label: 'MIP', children: <div style={{ fontSize: 12, color: '#666' }}>最大密度投影<br />显示高密度结构</div> },
                  { key: 'mpr', label: 'MPR', children: <div style={{ fontSize: 12, color: '#666' }}>多平面重建<br />轴/冠/矢三视图</div> },
                  { key: 'vr', label: 'VR', children: <div style={{ fontSize: 12, color: '#666' }}>体绘制<br />三维容积渲染</div> },
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

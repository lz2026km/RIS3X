import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Space, Tag, Button, Row, Col, Select, Tabs, Empty, message, Slider } from 'antd'
import { Box, Activity, List } from 'lucide-react'
import VolumeRenderer from '../../components/v3/dicom/VolumeRenderer'
import { useTranslation } from 'react-i18next'
import { dicomWebApi } from '../../services/api/dicomApi'
import { volumeApi } from '../../services/api/volumeApi'
import {
  decodeInt16Base64,
  decodeRgbaBase64,
  applyWWL,
  drawImageDataCentered,
} from './volumeReal'

interface SeriesInfo {
  seriesUID: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  instances: number
}

/** 后端真实体数据切片面板 (MIP / MPR / VR) */
const RealSlicePanel: React.FC<{ jobId: string; kind: 'mip' | 'mpr' | 'vr'; totalSlices: number }> = ({ jobId, kind, totalSlices }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sliceIdx, setSliceIdx] = useState(Math.floor(totalSlices / 2))
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)
  const [opacity, setOpacity] = useState(0.8)
  const [tick, setTick] = useState(0)
  const cacheRef = useRef<Map<string, ImageData>>(new Map())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    canvas.width = w * devicePixelRatio
    canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.clearRect(0, 0, w, h)

    const drawRgba = (res: { width: number; height: number; pixelData: { dataBase64: string } }) => {
      const rgba = decodeRgbaBase64(res.pixelData.dataBase64)
      const imgData = new ImageData(new Uint8ClampedArray(rgba), res.width, res.height)
      drawImageDataCentered(ctx, imgData, w, h)
    }

    if (kind === 'vr') {
      volumeApi.vrImage(jobId, { preset: 'default', opacity }).then((res) => {
        if (res.success) drawRgba(res.data)
      })
      return
    }

    const key = kind === 'mip' ? `mip:${ww}:${wl}` : `mpr:${sliceIdx}:${ww}:${wl}`
    const cached = cacheRef.current.get(key)
    if (cached) {
      drawImageDataCentered(ctx, cached, w, h)
      return
    }
    if (kind === 'mip') {
      volumeApi.mipProjection(jobId, 'axial').then((res) => {
        if (!res.success) return
        const imgData = applyWWL(decodeInt16Base64(res.data.pixelData.dataBase64), res.data.pixelData.width, res.data.pixelData.height, ww, wl)
        cacheRef.current.set(key, imgData)
        drawImageDataCentered(ctx, imgData, w, h)
        setTick((t) => t + 1)
      })
    } else {
      volumeApi.mprSlice(jobId, 'axial', sliceIdx).then((res) => {
        if (!res.success) return
        const imgData = applyWWL(decodeInt16Base64(res.data.pixelData.dataBase64), res.data.pixelData.width, res.data.pixelData.height, ww, wl)
        cacheRef.current.set(key, imgData)
        drawImageDataCentered(ctx, imgData, w, h)
        setTick((t) => t + 1)
      })
    }
    void tick
  }, [jobId, kind, sliceIdx, ww, wl, opacity, tick])

  const controls = (
    <Row gutter={8} style={{ marginTop: 8 }}>
      {kind === 'mpr' && (
        <Col span={8}><Space style={{ width: '100%' }}><small>切片</small><Slider min={0} max={Math.max(1, totalSlices - 1)} value={sliceIdx} onChange={setSliceIdx} /></Space></Col>
      )}
      {kind === 'vr' && (
        <Col span={8}><Space style={{ width: '100%' }}><small>不透明度</small><Slider min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} /></Space></Col>
      )}
      <Col span={8}><Space style={{ width: '100%' }}><small>WW</small><Slider min={1} max={4000} value={ww} onChange={setWw} /></Space></Col>
      <Col span={8}><Space style={{ width: '100%' }}><small>WL</small><Slider min={-1000} max={3000} value={wl} onChange={setWl} /></Space></Col>
    </Row>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', minHeight: 260 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
      </div>
      {controls}
    </div>
  )
}

const VolumeViewerPage: React.FC = () => {
  const { t } = useTranslation('v3dicom')
  const [series, setSeries] = useState<SeriesInfo[]>([])
  const [selectedUid, setSelectedUid] = useState<string | undefined>()
  const [reconstructing, setReconstructing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const [volumeDims, setVolumeDims] = useState<{ x: number; y: number; z: number } | null>(null)
  const [jobSource, setJobSource] = useState<'real' | 'synthetic' | null>(null)
  const [activeTab, setActiveTab] = useState('mip')

  useEffect(() => {
    const studyUid = new URLSearchParams(window.location.search).get('studyUID')
    if (!studyUid) return
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
    })
  }, [])

  const handleReconstruct = useCallback(async () => {
    if (!selectedUid) { message.warning('请先选择序列'); return }
    setReconstructing(true)
    setProgress(0)
    setVolumeDims(null)
    setJobId(null)
    setJobSource(null)
    const res = await volumeApi.reconstruct(selectedUid)
    if (!res.success) {
      setReconstructing(false)
      message.error(res.error?.message || '重建请求失败')
      return
    }
    const { jobId: newJobId, volume, source } = res.data
    setJobId(newJobId)
    setVolumeDims(volume)
    setJobSource(source)
    const poll = setInterval(async () => {
      const sr = await volumeApi.status(newJobId)
      if (!sr.success) { clearInterval(poll); setReconstructing(false); return }
      setProgress(sr.data.progress)
      if (sr.data.status === 'completed' || sr.data.progress >= 100) {
        clearInterval(poll)
        setReconstructing(false)
        message.success(source === 'real' ? '真实体数据重建完成' : '体数据重建完成(合成)')
      }
    }, 300)
  }, [selectedUid])

  const selectedSeries = series.find(s => s.seriesUID === selectedUid)

  const renderTabContent = (kind: 'mip' | 'mpr' | 'vr') => {
    if (jobSource !== 'real' || !jobId) {
      return <Empty description={jobSource === 'synthetic' ? '当前为合成模式,重建后可用' : '重建后可用真实体数据'} />
    }
    return <RealSlicePanel jobId={jobId} kind={kind} totalSlices={volumeDims?.z ?? 20} />
  }

  return (
    <div style={{ padding: 16, background: '#f0f2f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 12 }}>
        <Box size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('volumeViewer', '3D Volume Viewer')}</span>
        <Tag color="cyan">MIP / MPR / VR</Tag>
        {volumeDims && <Tag color="geekblue">{volumeDims.x}×{volumeDims.y}×{volumeDims.z}</Tag>}
        {jobSource === 'real' && <Tag color="green">真实DICOM</Tag>}
        {jobSource === 'synthetic' && <Tag>合成数据</Tag>}
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
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  { key: 'mip', label: 'MIP', children: renderTabContent('mip') },
                  { key: 'mpr', label: 'MPR', children: renderTabContent('mpr') },
                  { key: 'vr', label: 'VR', children: renderTabContent('vr') },
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

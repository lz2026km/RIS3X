/**
 * G005 RIS v3.0.6.11-100 (Wave 2B 报告工作站 - MIP/3D 截图联动)
 * MIP 生成 Modal:
 *   - 选检查 (volumeApi.series) → 后端 mipProjection (真实 DICOM) 或前端 canvas 合成投影
 *   - 预览带「MIP 重建」水印 + 源检查信息
 *   - 确认后经 onInsert 回调 → 报告书写页 insertHtml 插入正文 (锚点通道)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Button, Select, Slider, Spin, Tag, Space, Alert, message } from 'antd'
import { Layers, RefreshCw, Check, ScanLine } from 'lucide-react'
import { volumeApi, type VolumeSeriesDto } from '@services/api/volumeApi'
import {
  setupRealVolume,
  decodeInt16Base64,
  applyWWL,
} from '@pages/dicom/volumeReal'
import { t } from '../../../../i18n/appI18n'

export interface MipScreenshotPayload {
  imageBase64: string
  label: string
  studyUid: string
  seriesUid: string
  direction: 'axial' | 'sagittal' | 'coronal'
  thickness: number
  source: 'real' | 'synthetic'
  // [v3.0.6.11-100 Wave 6B (D-2)] 来源类型: mip=阅片器/书写页 MIP, vr=VR 体绘制截帧 (同 sessionStorage 通道)
  kind?: 'mip' | 'vr'
}

interface Props {
  open: boolean
  defaultStudyUid?: string
  onClose: () => void
  onInsert: (payload: MipScreenshotPayload) => void
}

const DIRECTION_OPTIONS = [
  { value: 'axial', label: t('w9e.mipScreenshot.dirAxial') },
  { value: 'sagittal', label: t('w9e.mipScreenshot.dirSagittal') },
  { value: 'coronal', label: t('w9e.mipScreenshot.dirCoronal') },
]

const PREVIEW_SIZE = 256

function generateSyntheticMip(_direction: string, thickness: number, ww: number, wl: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_SIZE
  canvas.height = PREVIEW_SIZE
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(PREVIEW_SIZE, PREVIEW_SIZE)
  const half = ww / 2
  const min = wl - half
  const range = ww || 1
  const start = Math.max(0, 64 - thickness / 2)
  const end = Math.min(127, start + thickness)
  let i = 0
  for (let y = 0; y < PREVIEW_SIZE; y++) {
    for (let x = 0; x < PREVIEW_SIZE; x++) {
      const cx = x - PREVIEW_SIZE / 2
      const cy = y - PREVIEW_SIZE / 2
      const d = Math.sqrt(cx * cx + cy * cy)
      let maxVal = 0
      for (let z = Math.round(start); z <= Math.round(end); z++) {
        const zOff = (z - 64) / 64
        let v = 200 + 180 * Math.sin(d * 0.03 + zOff * 0.5) + 60 * Math.cos(Math.atan2(cy, cx) * 3 + zOff * 0.3)
        v += 40 * Math.sin((cx * 0.02 + cy * 0.025 + zOff * 0.4) * 2)
        maxVal = Math.max(maxVal, v)
      }
      const val = Math.max(0, Math.min(4095, Math.round(maxVal)))
      let gray = ((val - min) / range) * 255
      gray = Math.max(0, Math.min(255, Math.round(gray)))
      imgData.data[i++] = gray
      imgData.data[i++] = gray
      imgData.data[i++] = gray
      imgData.data[i++] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

const MipScreenshotModal: React.FC<Props> = ({ open, defaultStudyUid, onClose, onInsert }) => {
  const [seriesList, setSeriesList] = useState<VolumeSeriesDto[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [studyUid, setStudyUid] = useState<string | undefined>(defaultStudyUid)
  const [direction, setDirection] = useState<'axial' | 'sagittal' | 'coronal'>('axial')
  const [thickness, setThickness] = useState(80)
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [source, setSource] = useState<'real' | 'synthetic'>('synthetic')
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLCanvasElement>(null)
  const [seriesInfo, setSeriesInfo] = useState('')

  // 检查列表 (与 MipPage setupRealVolume 同源); MSW 数据用 seriesUid 字段 → 归一化为 seriesInstanceUid
  const normalizeSeries = useCallback((s: VolumeSeriesDto & { seriesUid?: string }): VolumeSeriesDto => ({
    ...s,
    seriesInstanceUid: s.seriesInstanceUid || s.seriesUid || '',
  }), [])

  const loadSeries = useCallback(async () => {
    setSeriesLoading(true)
    try {
      const res = await volumeApi.series()
      if (res.success && Array.isArray(res.data)) {
        setSeriesList(res.data.map(normalizeSeries))
        if (!studyUid && res.data.length > 0) setStudyUid(normalizeSeries(res.data[0]!).seriesInstanceUid)
      }
    } catch {
      setSeriesList([])
    } finally {
      setSeriesLoading(false)
    }
  }, [studyUid, normalizeSeries])

  useEffect(() => {
    if (open) void loadSeries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.seriesInstanceUid === studyUid) ?? null,
    [seriesList, studyUid],
  )

  // 生成 MIP: 真实后端优先 (mipProjection → Int16 → WWL), 不可用回退前端合成
  const generate = useCallback(async () => {
    if (!studyUid) {
      message.warning(t('w9e.mipScreenshot.selectSeriesFirst'))
      return
    }
    setGenerating(true)
    setError('')
    let canvas: HTMLCanvasElement | null = null
    let realSource = false
    try {
      const setup = await setupRealVolume({ seriesUid: studyUid, modality: 'CT' })
      if (setup.mode === 'real' && setup.jobId) {
        const res = await volumeApi.mipProjection(setup.jobId, direction, thickness)
        const p = res.data?.pixelData
        if (res.success && p?.dataBase64 && p.width && p.height) {
          const data = decodeInt16Base64(p.dataBase64)
          const imgData = applyWWL(data, p.width, p.height, res.data.windowWidth ?? ww, res.data.windowLevel ?? wl)
          const c = document.createElement('canvas')
          c.width = p.width
          c.height = p.height
          const ctx = c.getContext('2d')!
          ctx.putImageData(imgData, 0, 0)
          canvas = c
          realSource = true
          setSeriesInfo(t('w9e.mipScreenshot.seriesReal', { modality: setup.series?.modality ?? 'CT', count: setup.series?.instanceCount ?? '?', w: p.width, h: p.height }))
        }
      }
    } catch {
      /* 回退合成 */
    }
    if (!canvas) {
      canvas = generateSyntheticMip(direction, thickness, ww, wl)
      setSeriesInfo(selectedSeries ? t('w9e.mipScreenshot.seriesSynthetic', { modality: selectedSeries.modality, count: selectedSeries.instanceCount }) : t('w9e.mipScreenshot.syntheticData'))
    }
    setSource(realSource ? 'real' : 'synthetic')
    setPreview(canvas.toDataURL('image/png'))
    setGenerating(false)
  }, [studyUid, direction, thickness, ww, wl, selectedSeries])

  // 预览画布 → 水印叠加 (MIP 重建 + 源检查信息)
  useEffect(() => {
    if (!preview || !previewRef.current) return
    const canvas = previewRef.current
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      canvas.width = PREVIEW_SIZE
      canvas.height = PREVIEW_SIZE
      ctx.drawImage(img, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
      // 水印: 左下角「MIP 重建」+ 右下角源检查信息
      ctx.font = 'bold 15px "PingFang SC","Microsoft YaHei",sans-serif'
      const label = t('w9e.mipScreenshot.watermark')
      const labelW = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(8, PREVIEW_SIZE - 30, labelW + 16, 22)
      ctx.fillStyle = '#facc15'
      ctx.fillText(label, 16, PREVIEW_SIZE - 14)
      const info = t('w9e.mipScreenshot.canvasInfo', { uid: selectedSeries?.seriesInstanceUid?.slice(-8) ?? 'N/A', dir: DIRECTION_OPTIONS.find((d) => d.value === direction)?.label ?? direction, thickness, source: source === 'real' ? t('w9e.mipScreenshot.realInline') : t('w9e.mipScreenshot.syntheticInline') })
      ctx.font = '11px ui-monospace,monospace'
      const infoW = ctx.measureText(info).width
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(PREVIEW_SIZE - infoW - 16, 8, infoW + 16, 18)
      ctx.fillStyle = '#93c5fd'
      ctx.fillText(info, PREVIEW_SIZE - infoW - 8, 21)
    }
    img.src = preview
  }, [preview, direction, thickness, source, selectedSeries])

  const handleInsert = useCallback(() => {
    if (!preview) return
    onInsert({
      imageBase64: preview,
      label: t('w9e.mipScreenshot.watermark'),
      studyUid: studyUid ?? '',
      seriesUid: selectedSeries?.seriesInstanceUid ?? '',
      direction,
      thickness,
      source,
    })
    setPreview(null)
    onClose()
  }, [preview, onInsert, onClose, studyUid, selectedSeries, direction, thickness, source])

  const controls: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap',
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }

  return (
    <Modal
      title={<Space><Layers className="w-4 h-4" style={{ color: 'var(--color-info-600)' }} /><span>{t('w9e.mipScreenshot.title')}</span><Tag color="cyan">{t('w9e.mipScreenshot.tag3d')}</Tag></Space>}
      open={open}
      onCancel={onClose}
      width={620}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{t('w9e.mipScreenshot.cancel')}</Button>
          <Button icon={<RefreshCw className="w-3 h-3" />} onClick={() => void generate()} loading={generating}>
            {t('w9e.mipScreenshot.generateMip')}
          </Button>
          <Button type="primary" icon={<Check className="w-3 h-3" />} disabled={!preview} onClick={handleInsert} data-testid="mip-insert-report">
            {t('w9e.mipScreenshot.insertReport')}
          </Button>
        </Space>
      }
    >
      <div style={{ padding: '4px 0' }}>
        <div style={controls}>
          <span style={labelStyle}>{t('w9e.mipScreenshot.studyLabel')}</span>
          <Select
            size="small"
            style={{ minWidth: 300 }}
            loading={seriesLoading}
            placeholder={t('w9e.mipScreenshot.selectSeriesPlaceholder')}
            value={studyUid}
            onChange={setStudyUid}
            options={seriesList.map((s) => ({
              value: s.seriesInstanceUid,
              label: t('w9e.mipScreenshot.seriesOption', { modality: s.modality, uid: (s.seriesInstanceUid ?? '').slice(-8), count: s.instanceCount, rows: s.rows, cols: s.columns }),
            }))}
            data-testid="mip-study-select"
          />
        </div>
        <div style={controls}>
          <span style={labelStyle}>{t('w9e.mipScreenshot.directionLabel')}</span>
          <Select size="small" style={{ width: 110 }} value={direction} onChange={setDirection} options={DIRECTION_OPTIONS} />
          <span style={labelStyle}>{t('w9e.mipScreenshot.thicknessLabel')}</span>
          <Slider min={1} max={128} value={thickness} onChange={setThickness} style={{ width: 140 }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{thickness}</span>
          <span style={labelStyle}>WW:</span>
          <Slider min={1} max={4000} value={ww} onChange={setWw} style={{ width: 90 }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{ww}</span>
          <span style={labelStyle}>WL:</span>
          <Slider min={-1000} max={3000} value={wl} onChange={setWl} style={{ width: 90 }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{wl}</span>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
          {generating ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>
              <Spin size="large" />
              <div style={{ fontSize: 12, marginTop: 12 }}>{t('w9e.mipScreenshot.computing')}</div>
            </div>
          ) : preview ? (
            <canvas ref={previewRef} style={{ width: '100%', imageRendering: 'pixelated' }} data-testid="mip-preview-canvas" />
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>
              <ScanLine size={40} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={{ fontSize: 12 }}>{t('w9e.mipScreenshot.pickHint')}</div>
            </div>
          )}
        </div>

        {error && <Alert type="error" showIcon style={{ marginTop: 8 }} message={error} />}
        {preview && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={source === 'real' ? 'green' : 'orange'}>{source === 'real' ? t('w9e.mipScreenshot.realDicom') : t('w9e.mipScreenshot.syntheticDataTag')}</Tag>
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{seriesInfo}</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
          {t('w9e.mipScreenshot.footerNote')}
        </div>
      </div>
    </Modal>
  )
}

export default MipScreenshotModal

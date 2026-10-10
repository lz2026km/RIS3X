/**
 * G005 RIS v3.0.6.11-100 (Wave 2B 报告工作站 - 报告-影像标注双向同步)
 * 影像标注嵌入卡片:
 *   - 读取 GET /reports/:id/image-annotations (报告关联标注 JSON)
 *   - 缩略图 + 标注叠加渲染 (canvas: 箭头/圆/标尺/框 + 标签)
 *   - 标注列表 (检查/类型/坐标) — 点击跳转阅片器定位
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Tag, Empty, Space, Spin, Tooltip } from 'antd'
import { Image as ImageIcon, RefreshCw, PenLine, ArrowUpRight, Circle as CircleIcon, Ruler, Square, ExternalLink } from 'lucide-react'
import { reportApi, type ReportImageAnnotationItem, type ReportImageAnnotationsDto } from '@services/api/reportApi'
import { t } from '../../../../i18n/appI18n'

interface Props {
  reportId: string
  studyUid?: string
  seriesUid?: string
  /** 点击标注行 → 阅片器定位 */
  onJumpToViewer?: (studyUid?: string, seriesUid?: string) => void
}

const TYPE_META: Record<ReportImageAnnotationItem['type'], { label: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  arrow: { label: t('w9e.annotationEmbed.typeArrow'), Icon: ArrowUpRight },
  circle: { label: t('w9e.annotationEmbed.typeCircle'), Icon: CircleIcon },
  ruler: { label: t('w9e.annotationEmbed.typeRuler'), Icon: Ruler },
  box: { label: t('w9e.annotationEmbed.typeBox'), Icon: Square },
}

const CANVAS_W = 320
const CANVAS_H = 260

const TYPE_LABELS: Record<string, string> = {
  arrow: t('w9e.annotationEmbed.typeArrow'), circle: t('w9e.annotationEmbed.typeCircle'), ruler: t('w9e.annotationEmbed.typeRuler'), box: t('w9e.annotationEmbed.typeBox'),
  length: t('w9e.annotationEmbed.typeLength'), ellipse: t('w9e.annotationEmbed.typeEllipse'), text: t('w9e.annotationEmbed.typeText'),
}

const DicomAnnotationEmbed: React.FC<Props> = ({ reportId, studyUid: presetStudyUid, seriesUid: presetSeriesUid, onJumpToViewer }) => {
  const [data, setData] = useState<ReportImageAnnotationsDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const load = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    setError('')
    try {
      const res = await reportApi.getImageAnnotations(reportId)
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setData(null)
        setError(res.error?.message ?? t('w9e.annotationEmbed.loadFailed'))
      }
    } catch {
      setData(null)
      setError(t('w9e.annotationEmbed.loadFailedNetwork'))
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    void load()
  }, [load])

  const annotations = useMemo(() => data?.annotations ?? [], [data])
  const hasImage = useMemo(() => Boolean(data?.imageBase64 && data.imageBase64.startsWith('data:image/')), [data])

  // 渲染缩略图 + 标注叠加
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    // 背景: 占位肺野 CT 渐变 (无缩略图时)
    const bg = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 20, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.6)
    bg.addColorStop(0, '#1b2a42')
    bg.addColorStop(1, '#0a1120')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    if (hasImage && data?.imageBase64) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
        drawAnnotations(ctx)
      }
      img.src = data.imageBase64
    } else {
      drawAnnotations(ctx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hasImage, annotations, selectedId])

  const drawAnnotations = (ctx: CanvasRenderingContext2D) => {
    for (const a of annotations) {
      const scaleX = CANVAS_W / 512
      const scaleY = CANVAS_H / 512
      const x1 = a.x1 * scaleX
      const y1 = a.y1 * scaleY
      const x2 = a.x2 * scaleX
      const y2 = a.y2 * scaleY
      ctx.strokeStyle = a.color
      ctx.fillStyle = a.color
      ctx.lineWidth = selectedId === a.id ? 3 : 2
      ctx.font = 'bold 12px "PingFang SC","Microsoft YaHei",sans-serif'
      if (a.type === 'arrow') {
        const dx = x2 - x1
        const dy = y2 - y1
        const ang = Math.atan2(dy, dx)
        const head = 10
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6))
        ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6))
        ctx.closePath()
        ctx.fill()
      } else if (a.type === 'ruler') {
        ctx.setLineDash([5, 3])
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(x1, y1, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x2, y2, 4, 0, Math.PI * 2)
        ctx.fill()
      } else if (a.type === 'circle') {
        const cx = (x1 + x2) / 2
        const cy = (y1 + y2) / 2
        const rx = Math.abs(x2 - x1) / 2
        const ry = Math.abs(y2 - y1) / 2
        ctx.setLineDash([5, 3])
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.setLineDash([5, 3])
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
        ctx.setLineDash([])
      }
      if (a.label) {
        const textW = ctx.measureText(a.label).width
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(x1, Math.max(0, y1 - 20), textW + 10, 18)
        ctx.fillStyle = a.color
        ctx.fillText(a.label, x1 + 5, y1 - 6)
      }
    }
    // 底部水印
    ctx.font = '11px ui-monospace,monospace'
    const wm = t('w9e.annotationEmbed.watermark')
    const wmW = ctx.measureText(wm).width
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(CANVAS_W - wmW - 14, CANVAS_H - 22, wmW + 12, 18)
    ctx.fillStyle = '#93c5fd'
    ctx.fillText(wm, CANVAS_W - wmW - 7, CANVAS_H - 9)
  }

  const handleJump = useCallback((studyUid?: string, seriesUid?: string) => {
    const targetStudy = studyUid || presetStudyUid
    const targetSeries = seriesUid || presetSeriesUid
    if (onJumpToViewer) onJumpToViewer(targetStudy, targetSeries)
    else if (targetStudy) {
      const params = new URLSearchParams()
      params.set('studyUid', targetStudy)
      if (targetSeries) params.set('seriesUid', targetSeries)
      window.location.href = `/dicom-viewer-pro?${params.toString()}`
    }
  }, [onJumpToViewer, presetStudyUid, presetSeriesUid])

  return (
    <div className="dicom-annotation-embed" data-testid="dicom-annotation-embed">
      <div className="flex items-center justify-between mb-2">
        <Space>
          <PenLine className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
          <span className="text-xs font-semibold text-slate-600">{t('w9e.annotationEmbed.title')}</span>
          {annotations.length > 0 && <Tag color="purple">{t('w9e.annotationEmbed.countTag', { count: annotations.length })}</Tag>}
          {data?.updatedAt && <Tag className="text-[10px]">{new Date(data.updatedAt).toLocaleString()}</Tag>}
        </Space>
        <Tooltip title={t('w9e.annotationEmbed.refreshTip')}>
          <Button aria-label="刷新" size="small" icon={<RefreshCw className="w-3 h-3" />} loading={loading} onClick={() => void load()} data-testid="annotation-refresh" />
        </Tooltip>
      </div>

      {error && annotations.length === 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-2">{error}</div>
      )}

      {loading && annotations.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-400"><Spin size="small" /></div>
      ) : annotations.length === 0 && !error ? (
        <Empty
          image={<ImageIcon size={40} style={{ opacity: 0.35 }} />}
          description={
            <span className="text-xs text-slate-400">
              {t('w9e.annotationEmbed.emptyHint')}
            </span>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-200 rounded overflow-hidden bg-slate-900">
            <canvas ref={canvasRef} className="w-full block" data-testid="annotation-thumb-canvas" style={{ imageRendering: 'pixelated' }} />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {annotations.map((a: ReportImageAnnotationItem) => {
              const meta = TYPE_META[a.type] ?? TYPE_META.arrow!
              const Icon = meta.Icon
              return (
                <div
                  key={a.id}
                  data-testid={`annotation-item-${a.id}`}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer transition ${selectedId === a.id ? 'border-purple-400 bg-purple-50' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                  <Icon className="w-3 h-3 flex-shrink-0" style={{ color: a.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-slate-700">{a.label || (TYPE_LABELS[a.type] ?? meta.label)}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {meta.label} · ({Math.round(a.x1)},{Math.round(a.y1)})→({Math.round(a.x2)},{Math.round(a.y2)})
                    </div>
                  </div>
                  <Tooltip title={t('w9e.annotationEmbed.jumpTip')}>
                    <Button aria-label="跳转"
                      size="small"
                      type="text"
                      icon={<ExternalLink className="w-3 h-3" />}
                      onClick={(e) => { e.stopPropagation(); handleJump(data?.studyUid, data?.seriesUid) }}
                      data-testid="annotation-jump-viewer"
                    />
                  </Tooltip>
                </div>
              )
            })}
            <div className="text-[10px] text-slate-400 font-mono px-1 pt-1">
              {t('w9e.annotationEmbed.studyLabel')}{data?.studyUid ? data.studyUid.slice(-12) : '—'}
              {data?.seriesUid ? `${t('w9e.annotationEmbed.seriesSuffix')}${data.seriesUid.slice(-8)}` : ''}
            </div>
          </div>
        </div>
      )}

      {annotations.length > 0 && (
        <div className="text-[11px] text-slate-400 mt-2">
          {t('w9e.annotationEmbed.footerNote')}
        </div>
      )}
    </div>
  )
}

export default DicomAnnotationEmbed

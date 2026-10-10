import React, { useEffect, useRef } from 'react'
import { Card, Tag, Progress, List, Typography, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import type { RadsScore, RadsHistoryEntry } from '../../services/api/radsApi'

const { Text, Title } = Typography

function getScoreColor(score: string): string {
  const s = parseFloat(score)
  if (isNaN(s)) return 'var(--color-primary-600)'
  if (s >= 4) return '#ff4d4f'
  if (s >= 3) return '#faad14'
  return '#52c41a'
}

interface RadsScoringProps {
  result: RadsScore | null
  history: RadsHistoryEntry[]
  loading?: boolean
}

const RadsScoring: React.FC<RadsScoringProps> = ({ result, history }) => {
  const { t } = useTranslation('rads')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !result) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const size = canvasRef.current.width
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 12
    const conf = result.confidence
    ctx.clearRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 12
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * conf)
    ctx.strokeStyle = getScoreColor(result.score)
    ctx.lineWidth = 12
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.fillStyle = '#333'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(conf * 100)}%`, cx, cy)
  }, [result])

  if (!result && history.length === 0) return null

  const trendIds = Array.isArray(history) ? history : []

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      {result && (
        <Card size="small">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <canvas ref={canvasRef} width={110} height={110} style={{ width: 110, height: 110 }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Title level={5} style={{ margin: 0 }}>
                <Tag color={getScoreColor(result.score)} style={{ fontSize: 14, padding: '2px 10px' }}>
                  {result.category}
                </Tag>
              </Title>
              <Text type="secondary">{result.description}</Text>
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={Math.round(result.confidence * 100)}
                  size="small"
                  strokeColor={getScoreColor(result.score)}
                  format={(p) => t('confidence') + `: ${p}%`}
                />
              </div>
            </div>
          </div>
          <List
            size="small"
            header={<Text strong>{t('findings')}</Text>}
            dataSource={result.findings}
            renderItem={(item) => <List.Item>{item}</List.Item>}
            style={{ marginTop: 8 }}
          />
          <Text strong>{t('recommendations')}: </Text>
          <Text>{result.recommendations}</Text>
        </Card>
      )}
      {trendIds.length > 0 && (
        <Card size="small" title={t('historyTrend')}>
          <TrendChart data={trendIds} />
        </Card>
      )}
    </Space>
  )
}

const TrendChart: React.FC<{ data: RadsHistoryEntry[] }> = ({ data }) => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const pad = { top: 20, right: 20, bottom: 40, left: 50 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom
    ctx.clearRect(0, 0, w, h)
    const scores = data.map((d) => parseFloat(d.score) || 0)
    const maxVal = Math.max(...scores, 5)
    const minVal = Math.min(...scores, 0)
    const range = maxVal - minVal || 1

    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      const val = maxVal - (range / 4) * i
      ctx.fillStyle = '#999'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(val.toFixed(1), pad.left - 4, y + 3)
    }

    if (data.length < 2) {
      ctx.fillStyle = '#999'
      ctx.textAlign = 'center'
      ctx.font = '12px sans-serif'
      ctx.fillText('数据不足,无法绘制趋势', w / 2, h / 2)
      return
    }

    const stepX = plotW / (data.length - 1)
    ctx.beginPath()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    data.forEach((d, i) => {
      const x = pad.left + i * stepX
      const y = pad.top + plotH - ((parseFloat(d.score) || 0) - minVal) / range * plotH
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    data.forEach((d, i) => {
      const x = pad.left + i * stepX
      const y = pad.top + plotH - ((parseFloat(d.score) || 0) - minVal) / range * plotH
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#2563eb'
      ctx.fill()
      ctx.fillStyle = '#333'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(d.date.slice(5), x, pad.top + plotH + 14)
    })
  }, [data])

  return (
    <canvas ref={ref} width={400} height={180} style={{ width: '100%', height: 180 }} />
  )
}

export default RadsScoring
export { TrendChart }

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button, Space, Select, Card, Descriptions, Tag, Alert, Segmented } from 'antd'
import { Pen, Type, ShieldCheck, Lock, RotateCcw, CheckCircle } from 'lucide-react'

type SignatureMode = 'draw' | 'type' | 'ca'

interface CertificateInfo {
  id: string
  serialNumber: string
  subject: {
    commonName: string
    userId: string
    role: string
    organization?: string
    title?: string
  }
  issuer: {
    commonName: string
    organization?: string
  }
  notBefore: string
  notAfter: string
  status: string
}

export interface SignaturePadProps {
  onSign: (result: { mode: SignatureMode; value: string; certificateId?: string; signedAt: string }) => void
  mode?: SignatureMode
  certificateInfo?: CertificateInfo
}

const FONT_STYLES = [
  { label: '楷体', value: 'KaiTi, STKaiti, serif' },
  { label: '宋体', value: 'SimSun, STSong, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: '行书', value: '"STXingkai", "KaiTi", cursive' },
]

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('zh-CN')
  } catch {
    return dateStr
  }
}

export function SignaturePad({
  onSign,
  mode: initialMode = 'draw',
  certificateInfo,
}: SignaturePadProps) {
  const [mode, setMode] = useState<SignatureMode>(initialMode)
  const [isLocked, setIsLocked] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [fontStyle, setFontStyle] = useState(FONT_STYLES[0]!.value)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [mode])

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0]!.clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0]!.clientY : (e as React.MouseEvent).clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isLocked) return
    e.preventDefault()
    isDrawing.current = true
    lastPoint.current = getCanvasPos(e)
  }, [isLocked])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || isLocked) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const point = getCanvasPos(e)
    if (!ctx || !point || !lastPoint.current) return
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPoint.current = point
  }, [isLocked])

  const endDraw = useCallback(() => {
    isDrawing.current = false
    lastPoint.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const getDrawSignature = useCallback((): string => {
    const canvas = canvasRef.current
    if (!canvas) return ''
    return canvas.toDataURL('image/png')
  }, [])

  const handleDrawSign = useCallback(() => {
    const value = getDrawSignature()
    if (!value || value === canvasRef.current?.toDataURL('image/png')) {
      const ctx = canvasRef.current?.getContext('2d')
      const imageData = ctx?.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)
      const isBlank = imageData?.data.every((pixel) => pixel === 255)
      if (isBlank) return
    }
    setIsLocked(true)
    onSign({ mode: 'draw', value: getDrawSignature(), signedAt: new Date().toISOString() })
  }, [onSign, getDrawSignature])

  const handleTypeSign = useCallback(() => {
    if (!typedName.trim()) return
    setIsLocked(true)
    onSign({ mode: 'type', value: typedName.trim(), signedAt: new Date().toISOString() })
  }, [onSign, typedName])

  const handleCaSign = useCallback(() => {
    if (!certificateInfo) return
    setIsLocked(true)
    onSign({
      mode: 'ca',
      value: `CA:${certificateInfo.subject.commonName}`,
      certificateId: certificateInfo.id,
      signedAt: new Date().toISOString(),
    })
  }, [onSign, certificateInfo])

  const handleReset = useCallback(() => {
    setIsLocked(false)
    clearCanvas()
    setTypedName('')
  }, [clearCanvas])

  const modeOptions = [
    { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Pen size={14} />手写</span>, value: 'draw' },
    { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Type size={14} />打字</span>, value: 'type' },
    { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><ShieldCheck size={14} />CA证书</span>, value: 'ca' },
  ]

  return (
    <Card
      size="small"
      title={
        <Space>
          <Pen size={16} />
          <span style={{ fontWeight: 600 }}>电子签名</span>
        </Space>
      }
      extra={
        isLocked ? (
          <Tag icon={<Lock size={12} />} color="green">已锁定</Tag>
        ) : undefined
      }
    >
      <Segmented
        value={mode}
        onChange={(v) => setMode(v as SignatureMode)}
        options={modeOptions}
        style={{ marginBottom: 16 }}
        disabled={isLocked}
      />

      {mode === 'draw' && (
        <div>
          <div style={{ border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 8, overflow: 'hidden', marginBottom: 12, background: '#fff' }}>
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              style={{ width: '100%', height: 160, cursor: isLocked ? 'not-allowed' : 'crosshair' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button icon={<RotateCcw size={14} />} onClick={clearCanvas} disabled={isLocked} size="small">清除</Button>
            <Button type="primary" icon={<CheckCircle size={14} />} onClick={handleDrawSign} disabled={isLocked} size="small">签署</Button>
          </div>
        </div>
      )}

      {mode === 'type' && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#1e293b' }}>签名姓名</span>
            <input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              disabled={isLocked}
              placeholder="输入签名姓名"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: 6,
                fontSize: 16,
                fontFamily: fontStyle,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#1e293b' }}>字体风格</span>
            <Select value={fontStyle} onChange={setFontStyle} style={{ width: '100%' }} disabled={isLocked}>
              {FONT_STYLES.map((f) => (
                <Select.Option key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </Select.Option>
              ))}
            </Select>
          </div>
          {typedName && (
            <div style={{ textAlign: 'center', padding: 16, border: '1px dashed var(--border-subtle, #e2e8f0)', borderRadius: 8, marginBottom: 12, background: '#fafafa' }}>
              <span style={{ fontSize: 32, fontFamily: fontStyle, color: '#1e293b' }}>{typedName}</span>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <Button type="primary" icon={<CheckCircle size={14} />} onClick={handleTypeSign} disabled={isLocked || !typedName.trim()} size="small">签署</Button>
          </div>
        </div>
      )}

      {mode === 'ca' && (
        <div>
          {certificateInfo ? (
            <div>
              <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label="证书序列号">{certificateInfo.serialNumber}</Descriptions.Item>
                <Descriptions.Item label="持有人">{certificateInfo.subject.commonName}</Descriptions.Item>
                <Descriptions.Item label="角色">{certificateInfo.subject.role}</Descriptions.Item>
                <Descriptions.Item label="机构">{certificateInfo.subject.organization ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="颁发者">{certificateInfo.issuer.commonName}</Descriptions.Item>
                <Descriptions.Item label="有效期">
                  {formatDate(certificateInfo.notBefore)} ~ {formatDate(certificateInfo.notAfter)}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={certificateInfo.status === 'active' ? 'green' : 'red'}>{certificateInfo.status}</Tag>
                </Descriptions.Item>
              </Descriptions>
              <div style={{ textAlign: 'center' }}>
                <Button
                  type="primary"
                  icon={<ShieldCheck size={14} />}
                  onClick={handleCaSign}
                  disabled={isLocked || certificateInfo.status !== 'active'}
                  size="small"
                >
                  CA数字签名
                </Button>
              </div>
            </div>
          ) : (
            <Alert type="warning" message="未加载证书信息" description="请传入有效的 certificateInfo 属性" showIcon style={{ marginBottom: 12 }} />
          )}
        </div>
      )}

      {isLocked && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button icon={<RotateCcw size={14} />} onClick={handleReset} size="small">重新签署</Button>
        </div>
      )}
    </Card>
  )
}

export default SignaturePad

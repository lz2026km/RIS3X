import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Modal, Button, Space, Typography, Switch, Select, message, Progress, Image, Card } from 'antd'
import { Camera, CameraOff, RotateCw, Flashlight, ZoomIn, ImagePlus, X, Check, ScanLine } from 'lucide-react'
import type { CameraCaptureResult, CameraMode } from '../../types/mobile'
import { camera } from '../../services/mobile/Camera'

const { Text } = Typography

interface CameraCaptureProps {
  open: boolean
  onClose: () => void
  onCapture: (result: CameraCaptureResult) => void
  mode?: CameraMode
  maxImages?: number
  title?: string
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ open, onClose, onCapture, mode = 'photo', maxImages = 1, title = '拍照' }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [flash, setFlash] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captured, setCaptured] = useState<CameraCaptureResult[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null)
  const [quality, setQuality] = useState(0.85)

  useEffect(() => {
    if (open) {
      setStreaming(false)
      setCaptured([])
      setPreviewUrl(null)
      setHasCamera(true)

      if (!camera.isSupported) {
        setHasCamera(false)
        void message.warning('设备不支持相机')
        return
      }

      const startStream = async () => {
        try {
          if (!videoRef.current) return
          await camera.startPreview(videoRef.current, { facingMode, flash, quality })
          setStreaming(true)
          const zr = await camera.getZoomRange()
          if (zr) setZoomRange(zr)
        } catch {
          setHasCamera(false)
          void message.error('无法启动相机')
        }
      }

      const timer = setTimeout(startStream, 200)
      return () => {
        clearTimeout(timer)
        camera.stopPreview()
        setStreaming(false)
      }
    }
  }, [open])

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || capturing) return
    setCapturing(true)
    try {
      const result = await camera.captureFrame(videoRef.current, {
        mode,
        facingMode,
        flash,
        quality,
        format: 'jpeg',
        purpose: mode === 'barcode' ? 'barcode' : 'documentation',
        maxWidth: 1920,
        maxHeight: 1080,
      })
      setCaptured(prev => [...prev, result])
      setPreviewUrl(result.dataUrl)
      if (captured.length + 1 >= maxImages) {
        onCapture(result)
        onClose()
      }
    } catch {
      void message.error('拍照失败')
    } finally {
      setCapturing(false)
    }
  }, [capturing, mode, facingMode, flash, quality, captured.length, maxImages, onCapture, onClose])

  const handleFlip = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    if (videoRef.current && streaming) {
      camera.stopPreview()
      try {
        await camera.startPreview(videoRef.current, { facingMode: next, flash, quality })
        setStreaming(true)
      } catch {
        void message.error('切换摄像头失败')
      }
    }
  }

  const handleFlash = () => {
    setFlash(f => !f)
    camera.toggleFlash()
  }

  const handleZoom = async (v: number) => {
    setZoom(v)
    await camera.setZoom(v)
  }

  const handleConfirm = () => {
    if (captured.length > 0) {
      onCapture(captured[captured.length - 1]!)
      onClose()
    }
  }

  const handleRetake = () => {
    setPreviewUrl(null)
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      centered
      width={400}
      destroyOnHidden
    >
      <Space orientation="vertical" style={{ width: '100%' }} size={8}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>{title}</Text>
          <Button type="text" size="small" icon={<X size={14} />} onClick={onClose} />
        </div>

        {!hasCamera ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <CameraOff size={48} color="#94a3b8" />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>设备不支持相机</Text>
              <Button style={{ marginTop: 12 }} onClick={() => {
                const mock: CameraCaptureResult = {
                  blob: new Blob(),
                  dataUrl: '',
                  width: 0, height: 0, sizeBytes: 0,
                  mimeType: 'image/jpeg',
                  capturedAt: new Date().toISOString(),
                  deviceInfo: { model: 'mock', facing: 'rear' },
                }
                onCapture(mock)
                onClose()
              }}>使用模拟图像</Button>
            </div>
          </Card>
        ) : previewUrl ? (
          <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000' }}>
            <Image src={previewUrl} style={{ width: '100%' }} preview={false} />
            <Space style={{ width: '100%', justifyContent: 'center', padding: 12, background: '#1a1a2e' }}>
              <Button icon={<RotateCw size={14} />} onClick={handleRetake}>重拍</Button>
              <Button type="primary" icon={<Check size={14} />} onClick={handleConfirm}>
                {maxImages > 1 ? `确认 (${captured.length}/${maxImages})` : '确认'}
              </Button>
            </Space>
          </div>
        ) : (
          <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', position: 'relative' }}>
            <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted />
            {mode === 'barcode' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ScanLine size={64} color="rgba(59,130,246,0.4)" />
              </div>
            )}
            {!streaming && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                <Progress type="circle" size={32} percent={30} strokeColor="#3b82f6" />
              </div>
            )}
          </div>
        )}

        {hasCamera && !previewUrl && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <Button shape="circle" icon={<RotateCw size={16} />} onClick={handleFlip} />
              <Button shape="circle" icon={<Flashlight size={16} />} onClick={handleFlash} type={flash ? 'primary' : 'default'} />
              {zoomRange && (
                <Space>
                  <ZoomIn size={14} />
                  <input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step}
                    value={zoom} onChange={e => handleZoom(Number(e.target.value))}
                    style={{ width: 80 }} />
                </Space>
              )}
              <Select value={quality} onChange={setQuality} size="small" style={{ width: 80 }}
                options={[
                  { value: 0.5, label: '低' },
                  { value: 0.85, label: '中' },
                  { value: 1, label: '高' },
                ]} />
            </div>

            <Button type="primary" block size="large" icon={<ImagePlus size={16} />} onClick={handleCapture} loading={capturing}
              disabled={!streaming} style={{ height: 48, borderRadius: 24 }}>
              {capturing ? '拍摄中...' : `拍照${maxImages > 1 ? ` (${captured.length}/${maxImages})` : ''}`}
            </Button>

            {captured.length > 0 && (
              <Space wrap size={4}>
                {captured.map((img, i) => (
                  <Image key={i} src={img.dataUrl} width={48} height={48} style={{ borderRadius: 4, objectFit: 'cover' }} preview={false} />
                ))}
                <Text type="secondary" style={{ fontSize: 12 }}>已拍 {captured.length}/{maxImages}</Text>
              </Space>
            )}
          </>
        )}
      </Space>
    </Modal>
  )
}

export default CameraCapture

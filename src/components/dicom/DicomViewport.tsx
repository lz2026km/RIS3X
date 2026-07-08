import { useRef, useEffect, useCallback } from 'react'

interface Series {
  id: string
  seriesNumber: number
  seriesDescription: string
  modality: string
  imageCount: number
  thumbnail: string
}

interface DicomImage {
  id: string
  seriesId: string
  imageNumber: number
  sliceLocation: number
  windowWidth: number
  windowCenter: number
  pixelSpacing: number
  sliceThickness: number
  matrix: string
  fov: number
}

type PseudoColorMode = 'none' | 'hotIron' | 'coolBlue' | 'grayscale' | 'pet' | 'softTissue'

interface DicomViewportProps {
  zoom: number
  rotation: number
  flipH: boolean
  flipV: boolean
  ww: number
  wl: number
  brightness: number
  contrast: number
  panX: number
  panY: number
  activeSeries: Series
  imageIndex: number
  images: DicomImage[]
  pseudoColorMode?: PseudoColorMode
  showAnnotations?: boolean
  cornerstoneReady?: boolean
  onWheel?: (deltaY: number, deltaX: number) => void
}

const CANVAS_W = 512
const CANVAS_H = 512

function applyPseudoColor(gray: number, mode: PseudoColorMode) {
  let r = gray, g = gray, b = gray
  if (mode === 'hotIron') {
    if (gray < 85) { r = 0; g = 0; b = gray * 3 }
    else if (gray < 170) { r = (gray - 85) * 3; g = 0; b = 255 - (gray - 85) * 3 }
    else { r = 255; g = (gray - 170) * 3; b = 0 }
  } else if (mode === 'coolBlue') {
    if (gray < 128) { r = 0; g = gray * 2; b = 255 - gray }
    else { r = (gray - 128) * 2; g = 255 - (gray - 128); b = 128 }
  } else if (mode === 'softTissue') {
    r = Math.min(255, gray * 1.2); g = Math.min(255, gray * 1.1); b = Math.min(255, gray * 0.9)
  }
  return { r, g, b }
}

function windowLevel(base: number, windowCenter: number, windowWidth: number): number {
  const min = windowCenter - windowWidth / 2
  const max = windowCenter + windowWidth / 2
  const normalized = (base - min) / (max - min)
  return Math.max(0, Math.min(1, normalized))
}

function generateCTData() {
  const data = new Uint8Array(CANVAS_W * CANVAS_H)
  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const dx = x - CANVAS_W / 2
      const dy = y - CANVAS_H / 2
      const dist = Math.sqrt(dx * dx + dy * dy)
      let v = 20
      if (dist < 200) {
        const nx = dx / 200, ny = dy / 200
        const lungL = Math.sqrt((dx + 80) ** 2 + (dy + 20) ** 2)
        const lungR = Math.sqrt((dx - 80) ** 2 + (dy + 20) ** 2)
        if (lungL < 55 || lungR < 55) {
          v = -800 + Math.random() * 100
        } else {
          v = 45 + Math.sin(nx * 3 + ny * 2) * 8 + Math.random() * 5
          const heart = Math.sqrt((dx - 10) ** 2 + (dy + 30) ** 2)
          if (heart < 60) v = 50 + Math.sin(nx * 5 + ny * 4) * 6
          if (dy > 60 && dy < 140) v = 50 + Math.sin(ny * 0.1) * 5
          if (Math.abs(dx) < 20 && dy > 80 && dy < 110) v = 250
          const ribDist = Math.abs(Math.sqrt(dy ** 2 + ((dx % 40) - 20) ** 2) - 120)
          if (ribDist < 8 && dy < 60) v = 300 + Math.random() * 50
        }
      }
      data[y * CANVAS_W + x] = Math.max(0, Math.min(255, ((v + 1024) / 4096) * 255))
    }
  }
  return data
}

function generateMRData() {
  const data = new Uint8Array(CANVAS_W * CANVAS_H * 3)
  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const dx = x - CANVAS_W / 2, dy = y - CANVAS_H / 2
      const dist = Math.sqrt(dx * dx + dy * dy)
      let v = 30
      if (dist < 200) {
        const brain = Math.sqrt((dx - 5) ** 2 + (dy - 10) ** 2)
        if (brain < 120) {
          v = 60 + Math.sin(dx * 0.08) * 15 + Math.cos(dy * 0.1) * 15
          if (Math.abs(dx - 5) < 15 && dy < -20 && dy > -60) v = 20
        }
      }
      const idx = (y * CANVAS_W + x) * 3
      data[idx] = Math.max(0, Math.min(255, v + 10))
      data[idx + 1] = Math.max(0, Math.min(255, v))
      data[idx + 2] = Math.max(0, Math.min(255, v - 5))
    }
  }
  return data
}

function generateDRData() {
  const data = new Uint8Array(CANVAS_W * CANVAS_H)
  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const dx = x - CANVAS_W / 2, dy = y - CANVAS_H / 2
      let v = 180
      if (dy < 50 && Math.abs(dx) > 40) v = 40 + Math.random() * 30
      if (dx > -60 && dx < 20 && dy > -80 && dy < -20) v = 200 + Math.random() * 40
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ribAngle = Math.atan2(dy, dx)
      if (dist < 180 && Math.abs(Math.sin(ribAngle * 6)) < 0.15 && dy < 0) v = 220 + Math.random() * 35
      data[y * CANVAS_W + x] = Math.max(0, Math.min(255, v))
    }
  }
  return data
}

export default function DicomViewport({
  zoom, rotation, flipH, flipV, ww, wl, brightness, contrast,
  panX, panY, activeSeries, imageIndex, images: _images,
  pseudoColorMode, onWheel,
}: DicomViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.createImageData(CANVAS_W, CANVAS_H)
    const pixelData = imageData.data

    if (activeSeries.modality === 'MR') {
      const mrData = generateMRData()
      for (let y = 0; y < CANVAS_H; y++) {
        for (let x = 0; x < CANVAS_W; x++) {
          const idx = y * CANVAS_W + x
          const pixelIdx = idx * 4
          const r = mrData[idx * 3]!, g = mrData[idx * 3 + 1]!, b = mrData[idx * 3 + 2]!
          const wwFactor = ww / 400, wlFactor = (wl - 40) / 100
          pixelData[pixelIdx] = Math.max(0, Math.min(255, r * wwFactor + wlFactor * 50))
          pixelData[pixelIdx + 1] = Math.max(0, Math.min(255, g * wwFactor + wlFactor * 50))
          pixelData[pixelIdx + 2] = Math.max(0, Math.min(255, b * wwFactor + wlFactor * 50))
          pixelData[pixelIdx + 3] = 255
        }
      }
    } else {
      const rawData = activeSeries.modality === 'CT' ? generateCTData() : generateDRData()
      for (let y = 0; y < CANVAS_H; y++) {
        for (let x = 0; x < CANVAS_W; x++) {
          const idx = y * CANVAS_W + x
          const pixelIdx = idx * 4
          const gray = rawData[idx]!
          const windowedGray = windowLevel(gray * (ww / 400) + (wl - 40), 128, 256) * 255
          const finalGray = Math.max(0, Math.min(255, windowedGray))
          if (pseudoColorMode && pseudoColorMode !== 'none') {
            const pseudo = applyPseudoColor(finalGray, pseudoColorMode)
            pixelData[pixelIdx] = pseudo.r
            pixelData[pixelIdx + 1] = pseudo.g
            pixelData[pixelIdx + 2] = pseudo.b
          } else {
            pixelData[pixelIdx] = finalGray
            pixelData[pixelIdx + 1] = finalGray
            pixelData[pixelIdx + 2] = finalGray
          }
          pixelData[pixelIdx + 3] = 255
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [ww, wl, brightness, contrast, activeSeries.modality, pseudoColorMode, imageIndex])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (onWheel) onWheel(e.deltaY, e.deltaX)
  }, [onWheel])

  return (
    <div
      style={{
        position: 'relative', width: CANVAS_W, height: CANVAS_H,
        transform: `translate(${panX}px, ${panY}px) scale(${zoom / 100}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
        transition: 'transform 0.15s ease-out, filter 0.15s ease-out',
        transformOrigin: 'center center',
      }}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: 'block' }} />
    </div>
  )
}

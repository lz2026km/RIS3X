import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Mic, MousePointer, Play, Pause, Square, Maximize2, Minimize2 } from 'lucide-react'

export type RecorderState = 'idle' | 'recording' | 'paused' | 'playing'
export type ScreencastHandle = {
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<Blob | null>
  getState: () => RecorderState
}

type MouseEvent = { x: number; y: number; type: 'move' | 'click' | 'dblclick'; ts: number }

export default function Screencast({ handleRef, onStateChange }: {
  handleRef?: React.MutableRefObject<ScreencastHandle | undefined>
  onStateChange?: (state: RecorderState) => void
}) {
  const { t } = useTranslation('v3teach')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const mixedStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mouseEventsRef = useRef<MouseEvent[]>([])
  const animFrameRef = useRef<number>(0)
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [hasMic, setHasMic] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const startTimeRef = useRef(0)
  const recordedBlobRef = useRef<Blob | null>(null)
  const playbackStartRef = useRef(0)

  const notifyState = useCallback((s: RecorderState) => {
    setState(s)
    onStateChange?.(s)
  }, [onStateChange])

  const captureMouse = useCallback((e: MouseEvent) => {
    mouseEventsRef.current.push({ x: e.clientX, y: e.clientY, type: e.type as MouseEvent['type'], ts: Date.now() })
  }, [])

  const drawMouseTrail = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const now = Date.now()
    const trail = mouseEventsRef.current.filter(e => now - e.ts < 3000)
    for (const e of trail) {
      const alpha = Math.max(0.1, 1 - (now - e.ts) / 3000)
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.type === 'click' ? 12 : 6, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`
      ctx.fill()
      if (e.type === 'click') {
        ctx.strokeStyle = `rgba(255, 0, 0, ${alpha * 0.5})`
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
    animFrameRef.current = requestAnimationFrame(drawMouseTrail)
  }, [])

  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        start: async () => {
          try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
            screenStreamRef.current = screenStream
            let micStream: MediaStream | null = null
            try {
              micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
              micStreamRef.current = micStream
              setHasMic(true)
            } catch {
              setHasMic(false)
            }
            const tracks = [...screenStream.getVideoTracks()]
            if (micStream) tracks.push(...micStream.getAudioTracks())
            const mixed = new MediaStream(tracks)
            mixedStreamRef.current = mixed

            const video = videoRef.current
            if (video) {
              video.srcObject = screenStream
              video.play()
            }

            const canvas = canvasRef.current
            if (canvas) {
              canvas.width = window.innerWidth
              canvas.height = window.innerHeight
            }
            document.addEventListener('mousemove', captureMouse)
            document.addEventListener('click', captureMouse)
            document.addEventListener('dblclick', captureMouse)
            drawMouseTrail()

            chunksRef.current = []
            const mr = new MediaRecorder(mixed, { mimeType: 'video/webm;codecs=vp9,opus' })
            mediaRecorderRef.current = mr
            mr.ondataavailable = (event) => {
              if (event.data.size > 0) chunksRef.current.push(event.data)
            }
            mr.start(1000)
            startTimeRef.current = Date.now()
            timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 200)
            notifyState('recording')
          } catch (err) {
            console.error('Failed to start recording:', err)
            notifyState('idle')
          }
        },
        pause: () => {
          mediaRecorderRef.current?.pause()
          clearInterval(timerRef.current)
          notifyState('paused')
        },
        resume: () => {
          mediaRecorderRef.current?.resume()
          timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 200)
          notifyState('recording')
        },
        stop: async () => {
          return new Promise((resolve) => {
            const mr = mediaRecorderRef.current
            if (!mr || mr.state === 'inactive') {
              cleanup()
              resolve(null)
              return
            }
            mr.onstop = () => {
              const blob = new Blob(chunksRef.current, { type: 'video/webm' })
              recordedBlobRef.current = blob
              cleanup()
              notifyState('idle')
              resolve(blob)
            }
            mr.stop()
          })
        },
        getState: () => state,
      }
    }
  }, [handleRef, state, captureMouse, drawMouseTrail, notifyState])

  const cleanup = () => {
    document.removeEventListener('mousemove', captureMouse)
    document.removeEventListener('click', captureMouse)
    document.removeEventListener('dblclick', captureMouse)
    cancelAnimationFrame(animFrameRef.current)
    clearInterval(timerRef.current)
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    micStreamRef.current = null
    mixedStreamRef.current = null
    mediaRecorderRef.current = null
    mouseEventsRef.current = []
  }

  const playRecording = useCallback(() => {
    const blob = recordedBlobRef.current
    const video = videoRef.current
    if (!blob || !video) return
    const url = URL.createObjectURL(blob)
    video.srcObject = null
    video.src = url
    video.play()
    playbackStartRef.current = Date.now()
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    notifyState('playing')
    const playMouse = () => {
      if (!canvasRef.current || video?.paused) return
      const now = Date.now()
      const playbackElapsed = now - playbackStartRef.current
      const events = mouseEventsRef.current.filter(e => e.ts - startTimeRef.current <= playbackElapsed)
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        for (const e of events) {
          ctx.beginPath()
          ctx.arc(e.x, e.y, e.type === 'click' ? 12 : 6, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'
          ctx.fill()
          if (e.type === 'click') {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(playMouse)
    }
    playMouse()
    video.onended = () => {
      cancelAnimationFrame(animFrameRef.current)
      notifyState('idle')
    }
  }, [notifyState])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFSChange)
    return () => document.removeEventListener('fullscreenchange', onFSChange)
  }, [])

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden" style={{ minHeight: 400 }}>
      <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white text-sm">
            <Monitor size={16} />
            <Mic size={16} className={hasMic ? 'text-green-400' : 'text-red-400'} />
            <MousePointer size={16} />
          </div>
          <span className="text-white font-mono text-sm">{formatTime(elapsed)}</span>
          {state === 'recording' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-white/20 text-white" title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

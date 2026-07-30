import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Play, Trash2, FileVideo, Search, Loader2 } from 'lucide-react'
import Screencast, { type ScreencastHandle, type RecorderState } from '../../components/teach/Screencast'

type Lecture = {
  id: string
  title: string
  duration: number
  createdAt: string
  patientId?: string
  examId?: string
  reportId?: string
  blobs?: { filename: string }[]
}

const API_BASE = '/api/teach'

export default function TeachLecturePage() {
  const { t } = useTranslation('v3teach')
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [title, setTitle] = useState('')
  const [search, setSearch] = useState('')
  const [playingBlob, setPlayingBlob] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const screencastRef = useRef<ScreencastHandle | undefined>()
  const videoRef = useRef<HTMLVideoElement>(null)
  const chunksRef = useRef<Blob[]>([])

  const fetchLectures = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`${API_BASE}/lectures?${params}`)
      const data = await res.json()
      setLectures(data.items ?? [])
    } catch {
      setLectures([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchLectures() }, [fetchLectures])

  const handleStartRecording = async () => {
    if (!screencastRef.current) return
    setRecording(true)
    chunksRef.current = []
    await screencastRef.current.start()
  }

  const handlePauseRecording = () => screencastRef.current?.pause()
  const handleResumeRecording = () => screencastRef.current?.resume()

  const handleStopRecording = async () => {
    if (!screencastRef.current) return
    const blob = await screencastRef.current.stop()
    if (blob) {
      chunksRef.current = [blob]
    }
    setRecording(false)
  }

  const handleSave = async () => {
    if (!title.trim() || chunksRef.current.length === 0) return
    try {
      const res = await fetch(`${API_BASE}/lecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })
      const lecture = await res.json()
      for (let i = 0; i < chunksRef.current.length; i++) {
        const fd = new FormData()
        fd.append('blob', chunksRef.current[i], `chunk-${i}.webm`)
        await fetch(`${API_BASE}/lecture/${lecture.id}/blob?sequence=${i}`, {
          method: 'POST',
          body: fd,
        })
      }
      setTitle('')
      chunksRef.current = []
      setPlayingBlob(null)
      await fetchLectures()
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  const handlePlay = async (lecture: Lecture) => {
    try {
      const res = await fetch(`${API_BASE}/lecture/${lecture.id}`)
      const data = await res.json()
      if (data.blobs?.length) {
        const blobUrl = `${API_BASE}/lecture/${lecture.id}/blob/${data.blobs[0].filename}`
        setPlayingBlob(blobUrl)
        if (videoRef.current) {
          videoRef.current.src = blobUrl
          videoRef.current.play()
        }
      }
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      await fetch(`${API_BASE}/lecture/${id}`, { method: 'DELETE' })
      await fetchLectures()
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  }

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
    const fn = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fn)
    return () => document.removeEventListener('fullscreenchange', fn)
  }, [])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const RecorderBar = () => {
    if (!recording) return null
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-900 text-white rounded-lg mb-4">
        <span className="text-sm font-medium">{t('recording')}</span>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <div className="flex items-center gap-2 ml-auto">
          {recorderState === 'recording' ? (
            <button onClick={handlePauseRecording} className="p-2 rounded hover:bg-white/20">
              <Play size={16} className="rotate-180" />
            </button>
          ) : (
            <button onClick={handleResumeRecording} className="p-2 rounded hover:bg-white/20">
              <Play size={16} />
            </button>
          )}
          <button onClick={handleStopRecording} className="p-2 rounded hover:bg-white/20 text-red-400">
            <Square size={16} />
          </button>
        </div>
        {title && (
          <button onClick={handleSave} className="px-3 py-1.5 bg-blue-600 rounded text-sm hover:bg-blue-700">
            {t('save')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('lecture')}</h1>
        {!recording && (
          <button onClick={handleStartRecording} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            <FileVideo size={18} />
            {t('newLecture')}
          </button>
        )}
      </div>

      <RecorderBar />

      {recording && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <Screencast handleRef={screencastRef as any} onStateChange={setRecorderState} />
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-9 pr-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
      </div>

      {isFullscreen && playingBlob && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <video ref={videoRef} className="max-w-full max-h-full" controls autoPlay />
          <button onClick={toggleFullscreen} className="absolute top-4 right-4 p-2 bg-white/20 rounded text-white">
            {t('exitFullscreen')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : lectures.length === 0 ? (
        <div className="text-center py-20 text-gray-400">{t('noData')}</div>
      ) : (
        <div className="grid gap-4">
          {lectures.map((l) => (
            <div key={l.id} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <FileVideo size={24} className="text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{l.title}</p>
                <p className="text-sm text-gray-400">
                  {t('duration')}: {formatDuration(l.duration)} &middot; {new Date(l.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handlePlay(l)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Play size={18} />
                </button>
                <button onClick={() => handleDelete(l.id)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

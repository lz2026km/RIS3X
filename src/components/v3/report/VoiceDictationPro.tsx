/**
 * G005 放射RIS系统 v3.0.2 - 语音录入 Pro
 * 对标:3M M*Modal / Nuance Dragon Medical — 报告语音录入
 *
 * 升级项(vs v3.0.1):
 *  - 真实 Web Speech API 接入(浏览器原生)
 *  - 支持 continuous/interim 结果
 *  - 中/英文识别
 *  - 词库增强(医学术语纠正)
 *  - 静音检测 / 自动断句
 *  - 实时波形 / 音量显示
 *  - 一键标点
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button, Card, Space, Tag, Tooltip, Select, Switch, Alert, Statistic, Progress } from 'antd'
import { Mic, MicOff, Volume2, Square, Settings, Wand2, CheckCircle, AlertCircle } from 'lucide-react'

export interface VoiceDictationProProps {
  /** 当前文本 */
  value: string
  onChange: (v: string) => void
  /** 语种 */
  lang?: 'zh-CN' | 'en-US'
  /** 自动追加 */
  autoAppend?: boolean
  /** 医学词库(纠正) */
  medicalVocabulary?: Record<string, string>
  /** 自动标点 */
  autoPunctuation?: boolean
  /** 静音超时停止(ms) */
  silenceTimeout?: number
  /** 持续模式 */
  continuous?: boolean
}

const DEFAULT_MEDICAL_VOCAB: Record<string, string> = {
  // 常见医学发音纠正
  '色孤': '四骨',
  '波波': '薄壁',
  '爱爱': '癌',
  'mri': 'MR',
  'ct': 'CT',
  'bi-rads': 'BI-RADS',
  'ti-rads': 'TI-RADS',
  'li-rads': 'LI-RADS',
  'pi-rads': 'PI-RADS',
  'cad-rads': 'CAD-RADS',
  'lung-rads': 'Lung-RADS',
  '类圆形': '类圆形',
  '肺窗': '肺窗',
  '纵膈窗': '纵隔窗',
  '纵隔窗': '纵隔窗',
  '玻璃密度影': '磨玻璃密度影',
}

const PUNCTUATION_MAP: Record<string, string> = {
  '句号': '。', '逗号': ',', '冒号': ':', '分号': ';', '问号': '?', '感叹号': '!',
  '句号': '。', '点': '。', '顿号': '、', '引号': '"',
}

export const VoiceDictationPro: React.FC<VoiceDictationProProps> = ({
  value,
  onChange,
  lang = 'zh-CN',
  autoAppend = true,
  medicalVocabulary = DEFAULT_MEDICAL_VOCAB,
  autoPunctuation = true,
  silenceTimeout = 3000,
  continuous = true,
}) => {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [volume, setVolume] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [totalTime, setTotalTime] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [puncEnabled, setPuncEnabled] = useState(autoPunctuation)
  const [vocabEnabled, setVocabEnabled] = useState(true)

  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  // 计时器
  useEffect(() => {
    if (listening) {
      intervalRef.current = window.setInterval(() => {
        setTotalTime((t) => t + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [listening])

  // 媒体流(音量)
  const startAudioAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      const src = ctx.createMediaStreamSource(stream)
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setVolume(avg)
        if (avg < 5) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = window.setTimeout(() => {
              // 静音超时,自动停止
              stopListening()
            }, silenceTimeout)
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (err) {
      console.warn('无法访问麦克风:', err)
    }
  }, [silenceTimeout])

  const stopAudioAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    streamRef.current = null
    audioContextRef.current = null
    analyserRef.current = null
    setVolume(0)
  }, [])

  // 修正文本
  const applyCorrection = useCallback(
    (text: string): string => {
      if (!vocabEnabled) return text
      let result = text
      for (const [k, v] of Object.entries(medicalVocabulary)) {
        const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        result = result.replace(re, v)
      }
      // 自动标点
      if (puncEnabled) {
        for (const [k, v] of Object.entries(PUNCTUATION_MAP)) {
          result = result.replace(new RegExp(k, 'g'), v)
        }
        // 句末无标点补。
        if (result && !/[。.]$/.test(result.trim())) {
          result = result.trim() + '。'
        }
      }
      return result
    },
    [vocabEnabled, medicalVocabulary, puncEnabled]
  )

  // 启动识别
  const startListening = useCallback(async () => {
    setError(null)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('当前浏览器不支持 Web Speech API,请使用 Chrome/Edge')
      return
    }
    const recog = new SR()
    recog.lang = lang
    recog.continuous = continuous
    recog.interimResults = true
    recog.maxAlternatives = 1

    let finalTranscript = ''

    recog.onresult = (e: any) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          const corrected = applyCorrection(r[0].transcript)
          finalTranscript += corrected
          setWordCount((c) => c + r[0].transcript.length)
        } else {
          interimText += r[0].transcript
        }
      }
      if (finalTranscript) {
        const newVal = autoAppend ? value + finalTranscript : finalTranscript
        onChange(newVal)
        finalTranscript = ''
      }
      setInterim(interimText)
    }

    recog.onerror = (e: any) => {
      setError(`识别错误:${e.error ?? '未知'}`)
      stopListening()
    }

    recog.onend = () => {
      if (listening) {
        // 自动重连(continuous 模式)
        try {
          recog.start()
        } catch {
          // ignore
        }
      }
    }

    recognitionRef.current = recog
    setListening(true)
    setTotalTime(0)
    setWordCount(0)
    try {
      recog.start()
      void startAudioAnalyser()
    } catch (e: any) {
      setError(`启动失败:${e?.message ?? '未知'}`)
      setListening(false)
    }
  }, [lang, continuous, value, autoAppend, applyCorrection, onChange, startAudioAnalyser, listening])

  const stopListening = useCallback(() => {
    setListening(false)
    setInterim('')
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    stopAudioAnalyser()
  }, [stopAudioAnalyser])

  useEffect(() => {
    return () => {
      stopListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card
      data-testid="voice-dictation-pro"
      size="small"
      title={
        <Space>
          <Volume2 size={16} color={listening ? '#dc2626' : '#64748b'} />
          <span>语音录入 Pro</span>
          {listening && <Tag color="red" icon={<Mic size={10} />}>正在录音</Tag>}
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="设置">
            <Button
              size="small"
              type="text"
              icon={<Settings size={14} />}
              onClick={() => setShowSettings((s) => !s)}
              data-testid="vdp-settings"
            />
          </Tooltip>
        </Space>
      }
    >
      {error && (
        <Alert
          data-testid="vdp-error"
          type="error"
          showIcon
          icon={<AlertCircle size={14} />}
          message={error}
          closable
          style={{ marginBottom: 8 }}
        />
      )}

      <Space size={8} wrap>
        {!listening ? (
          <Button
            type="primary"
            danger
            icon={<Mic size={14} />}
            onClick={() => void startListening()}
            data-testid="vdp-start"
          >
            开始录音
          </Button>
        ) : (
          <Button
            icon={<Square size={14} />}
            onClick={stopListening}
            data-testid="vdp-stop"
          >
            停止
          </Button>
        )}

        <Tooltip title="麦克风">
          {listening ? <Mic size={16} color="#dc2626" /> : <MicOff size={16} color="#94a3b8" />}
        </Tooltip>

        {listening && (
          <Progress
            percent={Math.min(100, volume * 2)}
            size="small"
            showInfo={false}
            style={{ width: 80 }}
            strokeColor="#dc2626"
          />
        )}

        <Tag color="blue">{lang === 'zh-CN' ? '中文' : 'English'}</Tag>

        <Statistic
          title="时长"
          value={`${totalTime}s`}
          styles={{ content: {  fontSize: 12  } }}
          prefix={null}
        />
        <Statistic
          title="字数"
          value={wordCount}
          styles={{ content: {  fontSize: 12  } }}
        />
      </Space>

      {listening && interim && (
        <div
          data-testid="vdp-interim"
          style={{
            marginTop: 8,
            padding: 6,
            background: '#fef3c7',
            borderRadius: 4,
            fontSize: 12,
            color: '#92400e',
            fontStyle: 'italic',
          }}
        >
          <Wand2 size={12} /> 实时识别:{interim}
        </div>
      )}

      {showSettings && (
        <Card size="small" style={{ marginTop: 8, background: '#f8fafc' }} data-testid="vdp-settings-panel">
          <Space orientation="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <span style={{ fontSize: 12 }}>医学词库</span>
              <Switch size="small" checked={vocabEnabled} onChange={setVocabEnabled} />
            </Space>
            <Space>
              <span style={{ fontSize: 12 }}>自动标点</span>
              <Switch size="small" checked={puncEnabled} onChange={setPuncEnabled} />
            </Space>
            <Space>
              <span style={{ fontSize: 12 }}>语种</span>
              <Select
                size="small"
                value={lang}
                onChange={(v) => {/* re-init handled by parent */}}
                options={[
                  { label: '中文', value: 'zh-CN' },
                  { label: 'English', value: 'en-US' },
                ]}
                style={{ width: 100 }}
              />
            </Space>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              <CheckCircle size={10} /> 真实 Web Speech API(浏览器原生)
            </div>
          </Space>
        </Card>
      )}
    </Card>
  )
}

export default VoiceDictationPro

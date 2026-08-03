import { AsrService, sniffWavDuration } from '../src/modules/asr/asr.service'

describe('AsrService', () => {
  let svc: AsrService

  beforeAll(() => {
    svc = new AsrService()
  })

  it('transcribe returns response with id and text segments', async () => {
    const result = await svc.transcribe({ audioBase64: 'fakebase64', duration: 30 })
    expect(result.id).toBeDefined()
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.engine).toBe('aliyun')
    expect(result.duration).toBe(30)
    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.segments.map((s) => s.text).join('')).toBe(result.text)
  })

  it('transcribe defaults duration to 30 when not provided', async () => {
    const result = await svc.transcribe({})
    expect(result.duration).toBe(30)
  })

  it('feedback stores transcription correction', async () => {
    const result = await svc.feedback({
      transcriptionId: 't1',
      correctedText: '双肺纹理清晰',
      originalText: '双肺纹理青晰',
    })
    expect(result.success).toBe(true)
  })

  it('transcribe returns confidence between 0.85 and 1.0', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => svc.transcribe({ duration: 10 })))
    for (const r of results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0.85)
      expect(r.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('transcribe with audioBuffer returns deterministic radiology text', async () => {
    const result = await svc.transcribe({ audioBuffer: Buffer.from([0x00, 0x01, 0x02]), duration: 12 })
    expect(result.text).toContain('肺')
    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.duration).toBe(12)
  })
})

describe('sniffWavDuration', () => {
  function makeWav(byteRate: number, dataSize: number): Buffer {
    const buf = Buffer.alloc(44 + dataSize)
    buf.write('RIFF', 0, 'ascii')
    buf.write('WAVE', 8, 'ascii')
    buf.writeUInt32LE(byteRate, 28)
    buf.writeUInt32LE(dataSize, 40)
    return buf
  }

  it('parses duration from RIFF/WAVE header', () => {
    expect(sniffWavDuration(makeWav(16_000, 160_000))).toBe(10)
  })

  it('returns undefined for non-wav buffers', () => {
    expect(sniffWavDuration(Buffer.from('notaudio'))).toBeUndefined()
    expect(sniffWavDuration(Buffer.alloc(4))).toBeUndefined()
  })

  it('uses sniffed duration when not provided', async () => {
    const svc = new AsrService()
    const result = await svc.transcribe({ audioBuffer: makeWav(8_000, 8_000) })
    expect(result.duration).toBe(1)
  })
})

describe('AsrService external Whisper API', () => {
  const originalFetch = globalThis.fetch
  const originalUrl = process.env.WHISPER_API_URL
  const originalKey = process.env.ASR_API_KEY
  const originalModel = process.env.ASR_MODEL

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.WHISPER_API_URL
    else process.env.WHISPER_API_URL = originalUrl
    if (originalKey === undefined) delete process.env.ASR_API_KEY
    else process.env.ASR_API_KEY = originalKey
    if (originalModel === undefined) delete process.env.ASR_MODEL
    else process.env.ASR_MODEL = originalModel
  })

  it('returns whisper result when external API succeeds', async () => {
    process.env.WHISPER_API_URL = 'https://whisper.example.com/v1/audio/transcriptions'
    process.env.ASR_API_KEY = 'secret'
    process.env.ASR_MODEL = 'whisper-large-v3'
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '双肺纹理清晰。未见异常。' }),
    })
    globalThis.fetch = fetchMock as any
    const svc = new AsrService()
    const result = await svc.transcribe({ audioBuffer: Buffer.from([0x01, 0x02]), duration: 8, lang: 'zh-CN' })
    expect(result.engine).toBe('whisper')
    expect(result.text).toBe('双肺纹理清晰。未见异常。')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('whisper.example.com'), expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer secret' } }))
  })

  it('extracts text from non-text payload fields', async () => {
    process.env.WHISPER_API_URL = 'https://whisper.example.com/x'
    process.env.ASR_API_KEY = 'secret'
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output: '肝脏大小正常。' }),
    }) as any
    const result = await new AsrService().transcribe({ audioBuffer: Buffer.from([0x01]), duration: 5 })
    expect(result.engine).toBe('whisper')
    expect(result.text).toContain('肝脏')
  })

  it('falls back to mock when response is not ok', async () => {
    process.env.WHISPER_API_URL = 'https://whisper.example.com/x'
    process.env.ASR_API_KEY = 'secret'
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }) as any
    const result = await new AsrService().transcribe({ audioBuffer: Buffer.from([0x01]), duration: 3 })
    expect(result.engine).toBe('aliyun')
  })

  it('falls back to mock when payload has empty text', async () => {
    process.env.WHISPER_API_URL = 'https://whisper.example.com/x'
    process.env.ASR_API_KEY = 'secret'
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '   ' }),
    }) as any
    const result = await new AsrService().transcribe({ audioBuffer: Buffer.from([0x01]), duration: 3 })
    expect(result.engine).toBe('aliyun')
  })

  it('falls back to mock when fetch throws', async () => {
    process.env.WHISPER_API_URL = 'https://whisper.example.com/x'
    process.env.ASR_API_KEY = 'secret'
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any
    const result = await new AsrService().transcribe({ audioBuffer: Buffer.from([0x01]), duration: 4 })
    expect(result.engine).toBe('aliyun')
  })

  it('ignores external API when env vars are missing', async () => {
    delete process.env.WHISPER_API_URL
    delete process.env.ASR_API_KEY
    const fetchMock = jest.fn()
    globalThis.fetch = fetchMock as any
    const result = await new AsrService().transcribe({ audioBuffer: Buffer.from([0x01]), duration: 6 })
    expect(result.engine).toBe('aliyun')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps mime types to file extensions', async () => {
    process.env.WHISPER_API_URL = 'https://whisper.example.com/x'
    process.env.ASR_API_KEY = 'secret'
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '音频内容' }),
    })
    globalThis.fetch = fetchMock as any
    const svc = new AsrService()
    for (const mime of ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/x-unknown', undefined]) {
      await svc.transcribe({ audioBuffer: Buffer.from([0x01]), duration: 2, mimeType: mime })
    }
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })
})

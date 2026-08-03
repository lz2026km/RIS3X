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

import { AsrService } from '../src/modules/asr/asr.service'

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
    expect(result.segments).toHaveLength(1)
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
})

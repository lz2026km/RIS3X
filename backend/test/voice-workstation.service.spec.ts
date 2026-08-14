// [Wave 6A v3.0.6.11-99] 语音工作站服务测试 (医学词库 / 听写流校正 / 纠正反馈 / 会话 / 统计)
import { VoiceWorkstationService } from '../src/modules/voice-workstation/voice-workstation.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

describe('VoiceWorkstationService', () => {
  const makeService = () => new VoiceWorkstationService()

  describe('lexicon seed', () => {
    it('seeds 100+ medical terms across 6 categories', () => {
      const service = makeService()
      const lexicon = service.listLexicon()
      expect(lexicon.length).toBeGreaterThanOrEqual(100)
      const categories = new Set(lexicon.map((e) => e.category))
      expect(categories.has('解剖')).toBe(true)
      expect(categories.has('影像')).toBe(true)
      expect(categories.has('疾病')).toBe(true)
      expect(categories.has('药物')).toBe(true)
      expect(categories.has('单位')).toBe(true)
      expect(categories.has('操作')).toBe(true)
    })

    it('sorts lexicon by priority desc then term', () => {
      const service = makeService()
      const lexicon = service.listLexicon()
      for (let i = 1; i < lexicon.length; i++) {
        const prev = lexicon[i - 1]!
        const cur = lexicon[i]!
        if (prev.priority === cur.priority) {
          expect(prev.term.localeCompare(cur.term, 'zh-CN')).toBeLessThanOrEqual(0)
        } else {
          expect(prev.priority).toBeGreaterThanOrEqual(cur.priority)
        }
      }
    })
  })

  describe('lexicon CRUD', () => {
    it('creates a lexicon entry with defaults', () => {
      const service = makeService()
      const created = service.createLexicon({ term: '肺纹理增多', category: '影像', priority: 3, aliases: ['纹理增多'] })
      expect(created.term).toBe('肺纹理增多')
      expect(created.category).toBe('影像')
      expect(created.priority).toBe(3)
      expect(created.aliases).toEqual(['纹理增多'])
      expect(service.listLexicon().some((e) => e.term === '肺纹理增多')).toBe(true)
    })

    it('rejects empty term / invalid category / duplicate term', () => {
      const service = makeService()
      expect(() => service.createLexicon({ term: '  ', category: '影像' })).toThrow(BadRequestException)
      expect(() => service.createLexicon({ term: 'x', category: '不存在的分类' as never })).toThrow(BadRequestException)
      expect(() => service.createLexicon({ term: '磨玻璃影', category: '影像' })).toThrow(BadRequestException)
    })

    it('updates term/priority/aliases', () => {
      const service = makeService()
      const created = service.createLexicon({ term: '待更新', category: '操作', priority: 1 })
      const updated = service.updateLexicon(created.id, { term: '已更新', priority: 5, aliases: ['别名A'] })
      expect(updated.term).toBe('已更新')
      expect(updated.priority).toBe(5)
      expect(updated.aliases).toEqual(['别名A'])
      expect(service.listLexicon().find((e) => e.id === created.id)?.term).toBe('已更新')
    })

    it('throws 404 when updating/deleting missing entry', () => {
      const service = makeService()
      expect(() => service.updateLexicon('missing-id', { term: 'x' })).toThrow(NotFoundException)
      expect(() => service.deleteLexicon('missing-id')).toThrow(NotFoundException)
    })

    it('rejects invalid priority and duplicate rename', () => {
      const service = makeService()
      const created = service.createLexicon({ term: '唯一术语', category: '操作' })
      expect(() => service.updateLexicon(created.id, { priority: 99 })).toThrow(BadRequestException)
      expect(() => service.updateLexicon(created.id, { term: '磨玻璃影' })).toThrow(BadRequestException)
    })

    it('deletes an entry', () => {
      const service = makeService()
      const created = service.createLexicon({ term: '待删除', category: '药物' })
      const res = service.deleteLexicon(created.id)
      expect(res.success).toBe(true)
      expect(service.listLexicon().some((e) => e.id === created.id)).toBe(false)
    })
  })

  describe('lexicon search', () => {
    it('returns all when q empty, filters by term/alias/category otherwise', () => {
      const service = makeService()
      expect(service.searchLexicon('')).toHaveLength(service.listLexicon().length)
      expect(service.searchLexicon('磨玻璃影').every((e) => e.term.includes('磨玻璃影'))).toBe(true)
      expect(service.searchLexicon('毛玻璃').some((e) => e.term === '磨玻璃影')).toBe(true)
      expect(service.searchLexicon('药物').every((e) => e.category === '药物')).toBe(true)
      expect(service.searchLexicon('不存在的术语xx')).toHaveLength(0)
    })
  })

  describe('transcribe with lexicon correction', () => {
    it('corrects homophone errors via aliases and returns corrections[]', async () => {
      const service = makeService()
      const res = await service.transcribe({
        text: '右肺上叶见一结节影，边缘可见毛刺症及胸膜牵啦征象，内有钙化照。',
        reportId: 'rpt-999',
      })
      expect(res.correctedText).toContain('毛刺征')
      expect(res.correctedText).toContain('胸膜牵拉')
      expect(res.correctedText).toContain('钙化灶')
      expect(res.correctedText).not.toContain('毛刺症')
      const originals = res.corrections.map((c) => c.original)
      expect(originals).toContain('毛刺症')
      expect(originals).toContain('胸膜牵啦')
      const corrected = res.corrections.map((c) => c.corrected)
      expect(corrected).toContain('毛刺征')
      expect(corrected).toContain('钙化灶')
      expect(res.corrections.every((c) => c.category === '影像')).toBe(true)
    })

    it('returns demo deterministic transcript when no text/audio, and derives a session', async () => {
      const service = makeService()
      const before = service.listSessions().length
      const res = await service.transcribe({ reportId: 'rpt-demo' })
      expect(res.text.length).toBeGreaterThan(10)
      expect(res.correctedText).toContain('结节')
      expect(res.corrections.length).toBeGreaterThanOrEqual(2)
      const after = service.listSessions()
      expect(after.length).toBe(before + 1)
      expect(after[0]?.reportId).toBe('rpt-demo')
      expect(after[0]?.status).toBe('completed')
      expect(after[0]?.correctionCount).toBe(res.corrections.length)
    })

    it('falls back to demo transcript for blank text and rejects audio without ASR', async () => {
      const service = makeService()
      const res = await service.transcribe({ text: '   ' })
      expect(res.engine).toBe('mock')
      expect(res.correctedText).toContain('结节')
      await expect(service.transcribe({ audioBase64: 'AAAA' })).rejects.toThrow(BadRequestException)
    })

    it('delegates to AsrService when audioBase64 provided', async () => {
      const asr = {
        transcribe: jest.fn().mockResolvedValue({
          id: 'asr-1',
          text: '胸部平扫示双肺纹理清晰，可见毛刺症。',
          confidence: 0.91,
          engine: 'aliyun',
          duration: 12,
        }),
      }
      const service = new VoiceWorkstationService(asr as never)
      const res = await service.transcribe({ audioBase64: Buffer.from('fake-wav').toString('base64'), reportId: 'rpt-1' })
      expect(asr.transcribe).toHaveBeenCalled()
      expect(res.engine).toBe('aliyun')
      expect(res.correctedText).toContain('毛刺征')
      expect(res.correctedText).not.toContain('毛刺症')
    })
  })

  describe('correction feedback accumulates lexicon', () => {
    it('appends alias to existing term and records feedback', () => {
      const service = makeService()
      const record = service.submitCorrection({ original: '磨玻璃壮影', corrected: '磨玻璃影' })
      expect(record.source).toBe('feedback')
      expect(service.listCorrections()[0]?.original).toBe('磨玻璃壮影')
      const entry = service.listLexicon().find((e) => e.term === '磨玻璃影')
      expect(entry?.aliases).toContain('磨玻璃壮影')
    })

    it('auto-creates a new lexicon entry when corrected term is unknown', () => {
      const service = makeService()
      const before = service.listLexicon().length
      service.submitCorrection({ original: '某错词', corrected: '肺窗重建' })
      expect(service.listLexicon().length).toBe(before + 1)
      const entry = service.listLexicon().find((e) => e.term === '肺窗重建')
      expect(entry?.aliases).toContain('某错词')
      expect(entry?.priority).toBe(1)
    })

    it('rejects empty or identical original/corrected', () => {
      const service = makeService()
      expect(() => service.submitCorrection({ original: '', corrected: 'x' })).toThrow(BadRequestException)
      expect(() => service.submitCorrection({ original: 'x', corrected: 'x' })).toThrow(BadRequestException)
    })
  })

  describe('sessions and stats', () => {
    it('lists seeded sessions ordered by createdAt desc', () => {
      const service = makeService()
      const sessions = service.listSessions()
      expect(sessions.length).toBeGreaterThanOrEqual(6)
      for (let i = 1; i < sessions.length; i++) {
        expect(sessions[i - 1]!.createdAt >= sessions[i]!.createdAt).toBe(true)
      }
      expect(sessions[0]?.reportId).toBeTruthy()
    })

    it('computes stats: session count / avg duration / lexicon size / corrections', async () => {
      const service = makeService()
      await service.transcribe({ text: '双肺纹理清晰。', reportId: 'rpt-stats' })
      const stats = service.getStats()
      expect(stats.sessions.total).toBeGreaterThanOrEqual(7)
      expect(stats.sessions.avgDurationSec).toBeGreaterThan(0)
      expect(stats.lexiconSize).toBeGreaterThanOrEqual(100)
      expect(stats.corrections.total).toBeGreaterThanOrEqual(0)
      const sumCat = stats.categoryCounts.reduce((s, c) => s + c.count, 0)
      expect(sumCat).toBe(stats.lexiconSize)
    })

    it('counts today sessions by createdAt date', async () => {
      const service = makeService()
      const before = service.getStats().sessions.today
      await service.transcribe({ text: '双侧胸廓对称。', reportId: 'rpt-today' })
      expect(service.getStats().sessions.today).toBe(before + 1)
    })
  })
})

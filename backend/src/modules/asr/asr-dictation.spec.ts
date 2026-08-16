// [v3.0.6.11-103 Wave 17] 听写会话 V2 spec
// 1) 会话流转: start → append → end 状态机 + 分段累积
// 2) 术语命中: 热词优先识别 + 计数 + 置信度
// 3) 命令词解析: "下一段/保存/提交" 剥离正文并触发操作
// 4) 确定性: 相同输入恒得相同输出 (无随机)
import { AsrService } from './asr.service'
import {
  recognizeDictationChunk,
  dictationConfidence,
  createEmptyDictationSections,
  type DictationHotword,
} from './asr.service'

function makeHotword(term: string, priority = 2): DictationHotword {
  return {
    id: `hw-${term}`,
    term,
    category: '影像',
    priority,
    builtin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const HOTWORDS = [
  makeHotword('磨玻璃结节', 3),
  makeHotword('结节影', 3),
  makeHotword('右肺上叶', 3),
  makeHotword('毛刺征', 3),
  makeHotword('胸腔积液', 3),
]

describe('AsrService 听写会话 V2 (Wave 17)', () => {
  let svc: AsrService

  beforeEach(() => {
    svc = new AsrService()
  })

  it('会话流转: start(dictating) → append → end(completed), 文本按区累积', () => {
    const session = svc.startDictationSession({ reportId: 'rpt-901', doctorId: 'D1001', lang: 'zh-CN' })
    expect(session.status).toBe('dictating')
    expect(session.sections).toHaveLength(4)
    expect(session.text).toBe('')

    const r1 = svc.appendDictationChunk(session.id, '右肺上叶见一磨玻璃结节影,边缘见毛刺征')
    expect(r1.sessionId).toBe(session.id)
    expect(r1.engine).toBe('mock-dictation')
    expect(r1.sections.find((s) => s.key === 'findings')?.text.length).toBeGreaterThan(0)

    svc.appendDictationChunk(session.id, '【印象】磨玻璃结节,考虑早期肺癌可能')
    const r2 = svc.appendDictationChunk(session.id, '【建议】建议3个月后复查CT')
    expect(r2.sections.find((s) => s.key === 'impression')?.text).toContain('磨玻璃结节')
    expect(r2.sections.find((s) => s.key === 'recommendation')?.text).toContain('复查')

    const ended = svc.endDictationSession(session.id)
    expect(ended.status).toBe('completed')
    expect(ended.endedAt).not.toBeNull()
    expect(ended.durationSec).toBeGreaterThanOrEqual(1)
    expect(ended.sections.find((s) => s.key === 'findings')?.text).toContain('磨玻璃结节影')

    // 会话结束后禁止继续追加
    expect(() => svc.appendDictationChunk(session.id, '继续追加')).toThrow()
  })

  it('术语命中: 热词优先识别并计数, 置信度随命中提升且封顶', () => {
    const { hotwordHits, text } = recognizeDictationChunk(
      '右肺上叶见一磨玻璃结节影, 磨玻璃结节大小约1.2cm',
      HOTWORDS,
    )
    const hits = new Map(hotwordHits.map((h) => [h.term, h.count]))
    expect(hits.get('磨玻璃结节')).toBe(2)
    expect(hits.get('右肺上叶')).toBe(1)
    expect(text).toContain('磨玻璃结节')
    expect(dictationConfidence(hotwordHits, 0)).toBeGreaterThan(0.88)
    expect(dictationConfidence(hotwordHits, 0)).toBeLessThanOrEqual(0.99)
  })

  it('命令词解析: "下一段/保存/提交" 从正文剥离并触发操作事件', () => {
    const { commands, text } = recognizeDictationChunk('双肺纹理清晰 下一段 右肺上叶见结节影 保存', HOTWORDS)
    const actions = commands.map((c) => c.action)
    expect(actions).toContain('next_section')
    expect(actions).toContain('save')
    expect(text).not.toContain('下一段')
    expect(text).not.toContain('保存')
    expect(text).toContain('双肺纹理')
    expect(text).toContain('结节影')
    // 事件按出现位置排序
    expect(commands.every((c, i) => i === 0 || commands[i - 1]!.at <= c.at)).toBe(true)
  })

  it('自动标点: 无结尾标点句自动补句号/逗号', () => {
    const long = recognizeDictationChunk('右肺上叶见一磨玻璃结节影边缘见毛刺征', HOTWORDS)
    expect(long.text).toMatch(/[。！？]$/)
    const short = recognizeDictationChunk('未见异常', HOTWORDS)
    expect(short.text).toMatch(/[，。]$/)
  })

  it('确定性: 相同输入 + 相同热词 → 完全相同的输出', () => {
    const input = '右肺上叶见一磨玻璃结节影 下一段 【印象】考虑炎性结节 保存'
    const a = recognizeDictationChunk(input, HOTWORDS)
    const b = recognizeDictationChunk(input, HOTWORDS)
    expect(a).toEqual(b)
    expect(a.text).toBe(b.text)
    expect(a.commands).toEqual(b.commands)
    expect(a.hotwordHits).toEqual(b.hotwordHits)
  })

  it('热词库 CRUD: 创建/修改/删除 + 去重校验', () => {
    const created = svc.createDictationHotword({ term: '右肺中叶', category: '解剖', priority: 3 })
    expect(created.builtin).toBe(false)
    expect(() => svc.createDictationHotword({ term: '右肺中叶' })).toThrow()
    const updated = svc.updateDictationHotword(created.id, { priority: 5 })
    expect(updated.priority).toBe(5)
    const removed = svc.deleteDictationHotword(created.id)
    expect(removed.success).toBe(true)
    expect(svc.listDictationHotwords().some((h) => h.id === created.id)).toBe(false)
  })

  it('会话/热词查询: 不存在的会话与热词抛出 NotFound', () => {
    expect(() => svc.getDictationSession('no-such')).toThrow()
    expect(() => svc.appendDictationChunk('no-such', '文本')).toThrow()
    expect(() => svc.updateDictationHotword('no-such', { term: 'x' })).toThrow()
    expect(() => svc.deleteDictationHotword('no-such')).toThrow()
  })

  it('createEmptyDictationSections 恒为四区空结构', () => {
    const sections = createEmptyDictationSections()
    expect(sections.map((s) => s.key)).toEqual(['findings', 'impression', 'recommendation', 'conclusion'])
    expect(sections.every((s) => s.text === '')).toBe(true)
  })
})

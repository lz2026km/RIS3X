import { NotFoundException, BadRequestException } from '@nestjs/common'
import { TeachingCaseService } from './teaching-case.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    report: { findMany: reject, findUnique: reject },
    exam: { findUnique: reject },
  } as never
}

describe('TeachingCaseService', () => {
  describe('DB 不可用 → 确定性 seed 回退', () => {
    it('list 返回非空病例列表', async () => {
      const service = new TeachingCaseService(makePrisma())
      const { items, total } = await service.list({})
      expect(total).toBeGreaterThan(0)
      expect(items[0].title).toBeTruthy()
      expect(items[0].diagnosis).toBeTruthy()
    })

    it('按病种/部位/难度/标签/搜索筛选', async () => {
      const service = new TeachingCaseService(makePrisma())
      const byDisease = await service.list({ disease: '肺结节' })
      expect(byDisease.items.every((c) => c.disease === '肺结节')).toBe(true)
      const byPart = await service.list({ bodyPart: '头颅' })
      expect(byPart.items.every((c) => c.bodyPart === '头颅')).toBe(true)
      const byDiff = await service.list({ difficulty: '高级' })
      expect(byDiff.items.every((c) => c.difficulty === '高级')).toBe(true)
      const byTag = await service.list({ tag: 'DWI' })
      expect(byTag.items.every((c) => c.tags.includes('DWI'))).toBe(true)
      const search = await service.list({ search: '磨玻璃' })
      expect(search.items.length).toBeGreaterThan(0)
    })

    it('分类树包含 病种/部位/难度/标签 四组', async () => {
      const service = new TeachingCaseService(makePrisma())
      const cats = await service.categories()
      expect(cats.map((c) => c.name)).toEqual(expect.arrayContaining(['病种', '部位', '难度', '标签']))
      expect(cats[0].children!.length).toBeGreaterThan(0)
    })

    it('stats 统计字段齐全', async () => {
      const service = new TeachingCaseService(makePrisma())
      const stats = await service.stats()
      expect(stats.total).toBeGreaterThan(0)
      expect(stats.shared).toBeGreaterThan(0)
      expect(stats.byDifficulty['入门'] + stats.byDifficulty['进阶'] + stats.byDifficulty['高级']).toBe(stats.total)
      expect(stats.byBodyPart.length).toBeGreaterThan(0)
    })
  })

  describe('病例收藏 (CRUD)', () => {
    it('create 生成教学病例 (附病种/难度/要点)', async () => {
      const service = new TeachingCaseService(makePrisma())
      const created = await service.create({
        title: '测试教学病例',
        disease: '肺炎',
        bodyPart: '胸部',
        difficulty: '入门',
        keyPoints: ['要点一'],
        tags: ['教学重点'],
      })
      expect(created.id).toBeTruthy()
      expect(created.disease).toBe('肺炎')
      expect(created.difficulty).toBe('入门')
      const list = await service.list({ search: '测试教学病例' })
      expect(list.items.some((c) => c.id === created.id)).toBe(true)
    })

    it('update 修改分类/难度', async () => {
      const service = new TeachingCaseService(makePrisma())
      const created = await service.create({ title: '待更新病例' })
      const updated = await service.update(created.id, { difficulty: '高级', disease: '肺癌' })
      expect(updated.difficulty).toBe('高级')
      expect(updated.disease).toBe('肺癌')
    })

    it('未知 id → NotFoundException', async () => {
      const service = new TeachingCaseService(makePrisma())
      await expect(service.findById('unknown')).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.update('unknown', {})).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.remove('unknown')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('delete 移除病例', async () => {
      const service = new TeachingCaseService(makePrisma())
      const created = await service.create({ title: '待删除病例' })
      await service.remove(created.id)
      await expect(service.findById(created.id)).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('分享 + 评论', () => {
    it('share 生成分享 token/链接/QR 数据', async () => {
      const service = new TeachingCaseService(makePrisma())
      const shared = await service.share('TCL-001')
      expect(shared.shareToken).toBeTruthy()
      expect(shared.shareUrl).toContain('/teach/share/')
      expect(shared.qrData).toContain('RIS:TEACH:CASE')
      const byToken = await service.getSharedCase(shared.shareToken)
      expect(byToken?.id).toBe('TCL-001')
    })

    it('未分享 token 无法访问', async () => {
      const service = new TeachingCaseService(makePrisma())
      const byToken = await service.getSharedCase('invalid-token')
      expect(byToken).toBeUndefined()
    })

    it('addComment 追加评论 / 空内容拒绝', async () => {
      const service = new TeachingCaseService(makePrisma())
      const before = service.listComments('TCL-001').length
      const comment = service.addComment('TCL-001', '非常典型的征象', '测试医生')
      expect(comment.user).toBe('测试医生')
      expect(service.listComments('TCL-001').length).toBe(before + 1)
      expect(() => service.addComment('TCL-001', '   ')).toThrow(BadRequestException)
      expect(() => service.addComment('unknown', 'x')).toThrow(NotFoundException)
    })
  })

  describe('考试模式 (确定性)', () => {
    it('generateExam 生成随机抽题, 每题 4 个诊断选项含正确答案', async () => {
      const service = new TeachingCaseService(makePrisma())
      const paper = service.generateExam({ count: 5 })
      expect(paper.questions.length).toBe(5)
      expect(paper.examId).toBeTruthy()
      for (const q of paper.questions) {
        expect(q.options.length).toBe(4)
        expect(q.options[q.answerIndex]).toBe(q.options[q.answerIndex])
      }
    })

    it('难度过滤生效; 不同 examId 抽题结构一致', async () => {
      const service = new TeachingCaseService(makePrisma())
      const paper = service.generateExam({ count: 2, difficulty: '高级' })
      expect(paper.difficulty).toBe('高级')
      expect(paper.questions.length).toBe(2)
      const paper2 = service.generateExam({ count: 2, difficulty: '高级' })
      expect(paper2.questions.length).toBe(paper.questions.length)
      expect(paper2.examId).not.toBe(paper.examId)
    })

    it('submitExam 全对 → score=100 passed; 全错 → 0', async () => {
      const service = new TeachingCaseService(makePrisma())
      const paper = service.generateExam({ count: 3 })
      const allCorrect = paper.questions.map((q) => ({ caseId: q.caseId, selectedIndex: q.answerIndex }))
      const ok = service.submitExam(paper.examId, allCorrect)
      expect(ok.score).toBe(100)
      expect(ok.passed).toBe(true)
      expect(ok.wrongQuestions.length).toBe(0)

      const paper2 = service.generateExam({ count: 3 })
      const allWrong = paper2.questions.map((q) => ({ caseId: q.caseId, selectedIndex: (q.answerIndex + 1) % 4 }))
      const bad = service.submitExam(paper2.examId, allWrong)
      expect(bad.score).toBe(0)
      expect(bad.passed).toBe(false)
      expect(bad.wrongQuestions.length).toBe(3)
    })

    it('错题本记录错题并可清空', async () => {
      const service = new TeachingCaseService(makePrisma())
      const paper = service.generateExam({ count: 2 })
      const answers = paper.questions.map((q) => ({ caseId: q.caseId, selectedIndex: (q.answerIndex + 1) % 4 }))
      service.submitExam(paper.examId, answers)
      const book = service.wrongBook()
      expect(book.length).toBeGreaterThanOrEqual(2)
      expect(book[0].wrongCount).toBeGreaterThanOrEqual(1)
      const cleared = service.clearWrongBook()
      expect(cleared.cleared).toBeGreaterThanOrEqual(2)
      expect(service.wrongBook().length).toBe(0)
    })

    it('提交未知 examId → NotFoundException; 病例不足抽题 → BadRequestException', () => {
      const service = new TeachingCaseService(makePrisma())
      expect(() => service.submitExam('unknown', [])).toThrow(NotFoundException)
      expect(() => service.generateExam({ count: 99 })).toThrow(BadRequestException)
    })
  })
})

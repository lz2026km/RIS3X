/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (report-qc-v2) - 报告质控 V2 服务测试
 * 覆盖:
 *   1. 多维评分: 确定性 (同输入同输出) + 总分 0-100 + 等级边界 A/B/C/D
 *   2. 缺陷自动识别: 缺陷条目 / 严重度 / 维度归属
 *   3. 质控任务流: 创建 → 分配 → 一级复核 → 二次复核 → 关闭 (含退回路径)
 *   4. 二次复核: 双人复核记录 (复核人/意见/通过/退回)
 *   5. 质控统计: 缺陷分布 / 月度趋势 / 等级分布
 *   6. 孤儿模块回退: DB 不可用 → 确定性种子可工作
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReportQcV2Service, ReviewOpinion } from './report-qc-v2.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return { auditLog: { findMany: reject, create: reject } } as never
}

const GOOD_INPUT = {
  reportId: 'RPT-TEST-001',
  modality: 'CT',
  findings: '影像所见：胸部CT平扫, 双肺纹理清晰, 未见实变影。主动脉未见增宽, 纵隔居中, 心影不大。双侧胸膜未见增厚, 未见胸腔积液。',
  diagnosis: '诊断意见：双肺及纵隔未见明确异常。',
  conclusion: '结论：双肺及纵隔未见明确异常, 建议定期随访复查。',
  recommendations: '建议：1 年后随访复查胸部 CT。',
  radsCategory: 'RADS 不适用',
  isCritical: false,
  structuredCompletion: 95,
  reportTimeMinutes: 30,
  techParams: 'CT 平扫, 层厚 5mm',
}

const POOR_INPUT = {
  reportId: 'RPT-TEST-002',
  modality: 'CT',
  findings: '胸片',
  diagnosis: '',
  conclusion: '',
  recommendations: '',
  radsCategory: '',
  isCritical: true,
  structuredCompletion: 30,
  reportTimeMinutes: 300,
  techParams: '',
}

describe('ReportQcV2Service (Wave 6B 报告质控 V2)', () => {
  describe('1. 多维评分: 确定性 + 等级边界', () => {
    it('评分确定性: 同输入两次评分 → 维度/总分/等级完全一致', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const a = await service.scoreReport({ ...GOOD_INPUT })
      const b = await service.scoreReport({ ...GOOD_INPUT })
      expect(a.dimensions).toEqual(b.dimensions)
      expect(a.totalScore).toBe(b.totalScore)
      expect(a.grade).toBe(b.grade)
      expect(a.defects.map((d) => d.code)).toEqual(b.defects.map((d) => d.code))
    })

    it('总分范围 0-100: 5 维度各 20 分, 满分输入 → 等级 A', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const res = await service.scoreReport({ ...GOOD_INPUT })
      expect(res.dimensions).toHaveLength(5)
      expect(res.totalScore).toBeGreaterThanOrEqual(0)
      expect(res.totalScore).toBeLessThanOrEqual(100)
      expect(res.dimensions.reduce((a, d) => a + d.max, 0)).toBe(100)
      expect(res.grade).toBe('A')
      expect(res.totalScore).toBeGreaterThanOrEqual(90)
      expect(res.modelVersion).toBeTruthy()
    })

    it('等级边界: 高分 ≥90 → A, 中分 60-74 → C, 低分 <60 → D', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const a = await service.scoreReport({ ...GOOD_INPUT })
      expect(a.grade).toBe('A')
      const c = await service.scoreReport({
        ...GOOD_INPUT,
        reportId: 'RPT-TEST-003',
        findings: '影像所见：胸部CT平扫, 双肺纹理清晰, 未见实变影。主动脉未见增宽, 纵隔居中。',
        diagnosis: '未见明显异常。',
        conclusion: '未见异常。',
        recommendations: '',
        structuredCompletion: 70,
        reportTimeMinutes: 150,
        isCritical: true,
        techParams: '',
      })
      expect(c.grade).toBe('C')
      expect(c.totalScore).toBeLessThan(75)
      expect(c.totalScore).toBeGreaterThanOrEqual(60)
      const d = await service.scoreReport({ ...POOR_INPUT, reportId: 'RPT-TEST-004' })
      expect(d.grade).toBe('D')
      expect(d.totalScore).toBeLessThan(60)
    })

    it('维度总分 = 子项得分之和', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const res = await service.scoreReport({ ...GOOD_INPUT, reportId: 'RPT-TEST-005' })
      for (const dim of res.dimensions) {
        const sum = dim.subItems.reduce((a, s) => a + s.score, 0)
        expect(sum).toBe(dim.score)
        expect(dim.score).toBeLessThanOrEqual(dim.max)
      }
    })

    it('reportId 缺失 → BadRequestException', async () => {
      const service = new ReportQcV2Service(makePrisma())
      await expect(service.scoreReport({ reportId: '' })).rejects.toThrow(BadRequestException)
    })
  })

  describe('2. 缺陷自动识别', () => {
    it('不完整输入 → 检出完整性/准确性缺陷', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const res = await service.scoreReport({ ...POOR_INPUT, reportId: 'RPT-TEST-006' })
      expect(res.defects.length).toBeGreaterThan(0)
      const comp = res.defects.filter((d) => d.dimension === 'completeness')
      expect(comp.length).toBeGreaterThan(0)
      expect(comp[0]!.code).toMatch(/^QC-COMPLETENESS-/)
      expect(comp[0]!.severity).toBe('high')
      expect(comp[0]!.message).toBeTruthy()
    })

    it('危急值缺提示 → 准确性 critical 子项缺陷', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const res = await service.scoreReport({
        ...GOOD_INPUT,
        reportId: 'RPT-TEST-007',
        findings: '主动脉增宽, 内膜片影, 真假双腔形成。',
        conclusion: '主动脉夹层。',
        isCritical: true,
      })
      const critical = res.defects.find((d) => d.code === 'QC-ACCURACY-CRITICAL')
      expect(critical).toBeDefined()
      expect(critical!.severity).toBe('high')
    })

    it('满分输入 → 无缺陷', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const res = await service.scoreReport({ ...GOOD_INPUT, reportId: 'RPT-TEST-008' })
      expect(res.defects).toHaveLength(0)
      expect(res.suggestions[0]).toContain('优秀')
    })
  })

  describe('3. 质控任务流: 创建 → 分配 → 复核 → 二次复核 → 关闭', () => {
    it('完整闭环: pending → in_progress → reviewing → closed', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const created = await service.createTask({ reportId: 'RPT-FLOW-001', patientName: '测试患者', modality: 'CT' })
      expect(created.status).toBe('pending')
      const assigned = await service.assignTask(created.id, { assignee: 'u-201', assigneeName: '质控员甲' })
      expect(assigned.status).toBe('in_progress')
      expect(assigned.assigneeName).toBe('质控员甲')
      const reviewed = await service.reviewTask(assigned.id, { reviewer: '张质控', opinion: 'pass' as ReviewOpinion, comment: '一级通过' })
      expect(reviewed.status).toBe('reviewing')
      const closed = await service.secondReviewTask(reviewed.id, { reviewer: '王主任', opinion: 'pass' as ReviewOpinion, comment: '双人复核通过' })
      expect(closed.status).toBe('closed')
      expect(closed.closedAt).toBeTruthy()
      const reviews = await service.listReviews(closed.id)
      expect(reviews).toHaveLength(2)
      expect(reviews.map((r) => r.reviewer)).toEqual(['张质控', '王主任'])
      expect(reviews.every((r) => r.opinion === 'pass')).toBe(true)
      expect(closed.history.some((h) => h.action === 'closed')).toBe(true)
    })

    it('退回路径: 一级复核退回 → 保持 in_progress, 二次复核退回 → 返回 in_progress', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const created = await service.createTask({ reportId: 'RPT-FLOW-002' })
      await service.assignTask(created.id, { assignee: 'u-202' })
      const returned = await service.reviewTask(created.id, { reviewer: '张质控', opinion: 'return' as ReviewOpinion, comment: '结论需修改' })
      expect(returned.status).toBe('in_progress')
      const passed = await service.reviewTask(created.id, { reviewer: '张质控', opinion: 'pass' as ReviewOpinion })
      expect(passed.status).toBe('reviewing')
      const returned2 = await service.secondReviewTask(created.id, { reviewer: '王主任', opinion: 'return' as ReviewOpinion, comment: '造影剂剂量缺失' })
      expect(returned2.status).toBe('in_progress')
      expect(returned2.reviews).toHaveLength(3)
    })

    it('非法流转 → BadRequestException: 未分配不可复核 / 已关闭不可再操作', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const created = await service.createTask({ reportId: 'RPT-FLOW-003' })
      await expect(service.reviewTask(created.id, { reviewer: '张质控', opinion: 'pass' as ReviewOpinion })).rejects.toThrow(BadRequestException)
      await service.assignTask(created.id, { assignee: 'u-203' })
      await service.reviewTask(created.id, { reviewer: '张质控', opinion: 'pass' as ReviewOpinion })
      await service.secondReviewTask(created.id, { reviewer: '王主任', opinion: 'pass' as ReviewOpinion })
      await expect(service.assignTask(created.id, { assignee: 'u-204' })).rejects.toThrow(BadRequestException)
      await expect(service.closeTask(created.id)).rejects.toThrow(BadRequestException)
    })

    it('任务历史: 每次流转追加 history 条目', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const created = await service.createTask({ reportId: 'RPT-FLOW-004' })
      await service.assignTask(created.id, { assignee: 'u-205' })
      await service.reviewTask(created.id, { reviewer: '张质控', opinion: 'pass' as ReviewOpinion })
      const detail = await service.getTask(created.id)
      const actions = detail.history.map((h) => h.action)
      expect(actions).toContain('created')
      expect(actions).toContain('assigned')
      expect(actions).toContain('reviewed')
    })

    it('未知任务 id → NotFoundException', async () => {
      const service = new ReportQcV2Service(makePrisma())
      await expect(service.getTask('TQ-UNKNOWN')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('4. 质控统计: 缺陷分布 + 月度趋势 + 等级分布', () => {
    it('缺陷分布: 5 维度全量, count = high+medium+low, 排序按 count 降序', async () => {
      const service = new ReportQcV2Service(makePrisma())
      await service.scoreReport({ ...POOR_INPUT, reportId: 'RPT-STAT-001' })
      await service.createTask({ reportId: 'RPT-STAT-002', scoreInput: { ...POOR_INPUT, reportId: 'RPT-STAT-002' } })
      const stats = await service.getStats()
      expect(stats.defectDistribution).toHaveLength(5)
      const allDims = new Set(['completeness', 'normativity', 'accuracy', 'readability', 'timeliness'])
      expect(stats.defectDistribution.every((d) => allDims.has(d.key))).toBe(true)
      for (const d of stats.defectDistribution) {
        expect(d.count).toBe(d.high + d.medium + d.low)
      }
      const counts = stats.defectDistribution.map((d) => d.count)
      const sorted = [...counts].sort((a, b) => b - a)
      expect(counts).toEqual(sorted)
      const severityTotal = stats.severityDistribution.reduce((a, s) => a + s.count, 0)
      expect(severityTotal).toBeGreaterThan(0)
      expect(stats.severityDistribution.reduce((a, s) => a + s.count, 0)).toBe(stats.defectDistribution.reduce((a, d) => a + d.count, 0))
    })

    it('月度趋势: 按月升序, count 总和 = 任务总数', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const stats = await service.getStats()
      expect(stats.monthlyTrend.length).toBeGreaterThan(0)
      const months = stats.monthlyTrend.map((m) => m.month)
      expect(months).toEqual([...months].sort())
      const totalCount = stats.monthlyTrend.reduce((a, m) => a + m.count, 0)
      expect(totalCount).toBe(stats.totalTasks)
      stats.monthlyTrend.forEach((m) => expect(m.month).toMatch(/^\d{4}-\d{2}$/))
    })

    it('等级分布 + 通过率: 等级 count 之和 = 有评分任务数', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const stats = await service.getStats()
      const gradeSum = stats.gradeDistribution.reduce((a, g) => a + g.count, 0)
      const withScore = (await service.listTasks()).filter((t) => t.totalScore !== undefined).length
      expect(gradeSum).toBe(withScore)
      expect(stats.passRate).toBeGreaterThanOrEqual(0)
      expect(stats.passRate).toBeLessThanOrEqual(100)
      expect(stats.avgScore).toBeGreaterThan(0)
      const statusSum = Object.values(stats.taskByStatus).reduce((a, b) => a + (b ?? 0), 0)
      expect(statusSum).toBe(stats.totalTasks)
    })
  })

  describe('5. 孤儿模块回退 (DB 不可用)', () => {
    it('种子任务/记录可用, 统计与记录字段齐全', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const tasks = await service.listTasks()
      expect(tasks.length).toBeGreaterThan(0)
      expect(tasks[0]!.history.length).toBeGreaterThan(0)
      const records = await service.listRecords()
      expect(records.length).toBe(tasks.length)
      expect(records[0]!.reportId).toBeTruthy()
      expect(records.every((r) => r.defectCount >= 0)).toBe(true)
      const dimensions = service.getDimensions()
      expect(dimensions).toHaveLength(5)
      dimensions.forEach((d) => expect(d.subItems.length).toBeGreaterThan(0))
      const scores = await service.listScores()
      expect(scores.length).toBeGreaterThan(0)
    })

    it('listScores DB 派生失败 → 内存评分回退', async () => {
      const service = new ReportQcV2Service(makePrisma())
      const res = await service.scoreReport({ ...GOOD_INPUT, reportId: 'RPT-SEED-001' })
      const list = await service.listScores()
      expect(list.some((s) => s.id === res.id)).toBe(true)
      const detail = await service.getScore(res.id)
      expect(detail.totalScore).toBe(res.totalScore)
    })

    it('未知评分 id → NotFoundException', async () => {
      const service = new ReportQcV2Service(makePrisma())
      await expect(service.getScore('QS-UNKNOWN')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})

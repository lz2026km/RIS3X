/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (report-peer-review) - 报告互评服务测试
 * 覆盖:
 *   1. 分配确定性: 同输入两次分配 → 同一评审人; 指定评审人优先; 已分配报告不重复
 *   2. 评分边界: 1-5 整数, 越界/非整数 → BadRequestException; 合法评分 → reviewed
 *   3. 状态: 待评 / 已评 / 超时 (dueAt 过期派生)
 *   4. 统计: 平均分 (各维度+总体) 1-5 区间 / 分数分布 / 完成率 / 按科室
 *   5. 孤儿模块: 无 DB 可 seed 启动
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReportPeerReviewService } from './report-peer-review.service'

describe('ReportPeerReviewService (Wave 7C 报告互评)', () => {
  describe('1. 分配确定性', () => {
    it('同一 (reportId, department) 两次分配 → 同一评审人 (无随机)', () => {
      const service = new ReportPeerReviewService()
      const a = service.assign({ reportId: 'RPT-PR-001', department: '放射科', patientName: '张三' })
      const b = service.assign({ reportId: 'RPT-PR-001', department: '放射科', patientName: '张三' })
      expect(a.reviewerId).toBe(b.reviewerId)
      expect(a.reviewerName).toBe(b.reviewerName)
      expect(a.autoAssigned).toBe(true)
      expect(a.status).toBe('pending')
      expect(a.dueAt).toBeTruthy()
    })

    it('不同报告 → 评审人分布可不同且恒在池内', () => {
      const service = new ReportPeerReviewService()
      const a = service.assign({ reportId: 'RPT-PR-011', department: '放射科' })
      const c = service.assign({ reportId: 'RPT-PR-012', department: '放射科' })
      expect(a.reviewerId).toMatch(/^u-r\d+$/)
      expect(c.reviewerId).toMatch(/^u-r\d+$/)
      expect(a.reviewerId).not.toBe(c.reviewerId)
    })

    it('指定 reviewerId → 使用指定评审人且 autoAssigned=false', () => {
      const service = new ReportPeerReviewService()
      const task = service.assign({ reportId: 'RPT-PR-002', department: '骨科', reviewerId: 'u-r5' })
      expect(task.reviewerId).toBe('u-r5')
      expect(task.reviewerName).toBe('陈静')
      expect(task.autoAssigned).toBe(false)
    })

    it('非法输入 → BadRequestException: 空 reportId / 空科室 / 未知评审人', () => {
      const service = new ReportPeerReviewService()
      expect(() => service.assign({ reportId: '', department: '放射科' })).toThrow(BadRequestException)
      expect(() => service.assign({ reportId: 'RPT-PR-003', department: '' })).toThrow(BadRequestException)
      expect(() => service.assign({ reportId: 'RPT-PR-003', department: '骨科', reviewerId: 'u-999' })).toThrow(BadRequestException)
      expect(() => service.getTask('no-such')).toThrow(NotFoundException)
    })
  })

  describe('2. 评分边界', () => {
    it('合法评分 (1-5 整数) → status reviewed + scores + reviewedAt', () => {
      const service = new ReportPeerReviewService()
      const task = service.assign({ reportId: 'RPT-PR-100', department: '放射科' })
      const scored = service.score(task.id, {
        scores: { accuracy: 5, completeness: 4, normativity: 3 },
        comment: '诊断准确, 描述可更规范。',
      })
      expect(scored.status).toBe('reviewed')
      expect(scored.scores).toEqual({ accuracy: 5, completeness: 4, normativity: 3 })
      expect(scored.comment).toBe('诊断准确, 描述可更规范。')
      expect(scored.reviewedAt).toBeTruthy()
    })

    it('越界评分 → BadRequestException: 0 分 / 6 分 / 小数', () => {
      const service = new ReportPeerReviewService()
      const task = service.assign({ reportId: 'RPT-PR-101', department: '放射科' })
      expect(() => service.score(task.id, { scores: { accuracy: 0, completeness: 4, normativity: 3 } })).toThrow(BadRequestException)
      expect(() => service.score(task.id, { scores: { accuracy: 6, completeness: 4, normativity: 3 } })).toThrow(BadRequestException)
      expect(() => service.score(task.id, { scores: { accuracy: 4.5, completeness: 4, normativity: 3 } })).toThrow(BadRequestException)
      expect(() => service.score(task.id, { scores: { accuracy: 4, completeness: 4, normativity: 3.2 } })).toThrow(BadRequestException)
      const after = service.getTask(task.id)
      expect(after.status).toBe('pending')
    })

    it('评分后可再次修改评分 (覆盖)', () => {
      const service = new ReportPeerReviewService()
      const task = service.assign({ reportId: 'RPT-PR-102', department: '放射科' })
      service.score(task.id, { scores: { accuracy: 3, completeness: 3, normativity: 3 } })
      const updated = service.score(task.id, { scores: { accuracy: 5, completeness: 5, normativity: 5 } })
      expect(updated.scores?.accuracy).toBe(5)
    })
  })

  describe('3. 状态: 待评 / 已评 / 超时', () => {
    it('overdue 派生: 过 dueAt 的 pending 任务在读取时置 overdue', () => {
      const service = new ReportPeerReviewService()
      const list = service.listTasks({})
      const overdue = list.filter((t) => t.status === 'overdue')
      expect(overdue.length).toBeGreaterThan(0)
      for (const t of overdue) {
        expect(Date.parse(t.dueAt)).toBeLessThan(Date.now())
      }
      const pending = service.listTasks({ status: 'pending' })
      for (const t of pending) {
        expect(Date.parse(t.dueAt)).toBeGreaterThanOrEqual(Date.now())
      }
      const reviewed = service.listTasks({ status: 'reviewed' })
      expect(reviewed.length).toBeGreaterThan(0)
      expect(reviewed.every((t) => t.status === 'reviewed' && t.scores)).toBe(true)
    })

    it('超时任务提交评分 → 转为 reviewed', () => {
      const service = new ReportPeerReviewService()
      const list = service.listTasks({})
      const overdue = list.find((t) => t.status === 'overdue')
      expect(overdue).toBeDefined()
      const scored = service.score(overdue!.id, {
        scores: { accuracy: 4, completeness: 4, normativity: 4 },
        comment: '补评',
      })
      expect(scored.status).toBe('reviewed')
      expect(scored.reviewedAt).toBeTruthy()
    })
  })

  describe('4. 统计', () => {
    it('平均分区间 1-5, 分布与已评任务一致, 完成率正确', () => {
      const service = new ReportPeerReviewService()
      const t1 = service.assign({ reportId: 'RPT-PR-200', department: '放射科' })
      const t2 = service.assign({ reportId: 'RPT-PR-201', department: '胸外科' })
      const t3 = service.assign({ reportId: 'RPT-PR-202', department: '骨科' })
      service.score(t1.id, { scores: { accuracy: 5, completeness: 5, normativity: 4 } })
      service.score(t2.id, { scores: { accuracy: 4, completeness: 4, normativity: 4 } })
      service.score(t3.id, { scores: { accuracy: 3, completeness: 4, normativity: 3 } })
      const stats = service.getStats()
      expect(stats.reviewedCount).toBeGreaterThanOrEqual(3)
      expect(stats.total).toBe(stats.reviewedCount + stats.pendingCount + stats.overdueCount)
      const dims = [stats.avgScores.accuracy, stats.avgScores.completeness, stats.avgScores.normativity, stats.avgScores.overall]
      for (const d of dims) {
        expect(d).toBeGreaterThanOrEqual(1)
        expect(d).toBeLessThanOrEqual(5)
      }
      const distSum = stats.scoreDistribution.reduce((a, s) => a + s.count, 0)
      expect(distSum).toBe(stats.reviewedCount)
      expect(stats.scoreDistribution.map((s) => s.score)).toEqual([1, 2, 3, 4, 5])
      expect(stats.completionRate).toBeGreaterThan(0)
      expect(stats.completionRate).toBeLessThanOrEqual(100)
      const deptSum = stats.byDepartment.reduce((a, d) => a + d.total, 0)
      expect(deptSum).toBe(stats.total)
      for (const dept of stats.byDepartment) {
        expect(dept.avgOverall).toBeGreaterThanOrEqual(0)
        expect(dept.avgOverall).toBeLessThanOrEqual(5)
      }
    })

    it('维度元数据: 三维度 5 分制', () => {
      const service = new ReportPeerReviewService()
      const dims = service.getDimensions()
      expect(dims.map((d) => d.key)).toEqual(['accuracy', 'completeness', 'normativity'])
      expect(dims.every((d) => d.min === 1 && d.max === 5)).toBe(true)
    })
  })

  describe('5. 孤儿模块: seed 回退', () => {
    it('无 DB 构造服务 → seed 任务可用 (待评/已评/超时混合)', () => {
      const service = new ReportPeerReviewService()
      const list = service.listTasks({})
      expect(list.length).toBeGreaterThan(0)
      const statuses = new Set(list.map((t) => t.status))
      expect(statuses.has('pending')).toBe(true)
      expect(statuses.has('reviewed')).toBe(true)
      const first = service.getTask(list[0]!.id)
      expect(first.reportId).toBeTruthy()
    })
  })
})

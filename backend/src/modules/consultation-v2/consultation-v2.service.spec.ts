/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (consultation-v2) - 委员会会诊 V2 服务测试
 * 覆盖:
 *   1. 会诊室: 创建 (成员确定性选取) / 开始 / 成员角色与状态
 *   2. 发言时序: seq 严格递增, 按 seq 有序返回, 非成员发言拒绝
 *   3. 投票统计: 通过/驳回/修改计数 + 同意率 + 待投票成员
 *   4. 结论生成: 最终意见 + 与会成员签名列表 + 状态 concluded + 记录导出
 *   5. 孤儿模块: 无 DB 可 seed 启动, 统计正确
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ConsultationV2Service } from './consultation-v2.service'

describe('ConsultationV2Service (Wave 7C 委员会会诊 V2)', () => {
  describe('1. 会诊室创建与成员', () => {
    it('同一 reportId 两次创建 → 成员/角色完全一致 (确定性, 无随机)', () => {
      const service = new ConsultationV2Service()
      const a = service.createRoom({ reportId: 'RPT-CV2-001', reportTitle: '测试会诊', patientName: '张三', modality: 'CT' })
      const b = service.createRoom({ reportId: 'RPT-CV2-001', reportTitle: '测试会诊', patientName: '张三', modality: 'CT' })
      expect(a.members.map((m) => m.id)).toEqual(b.members.map((m) => m.id))
      expect(a.members[0]!.role).toBe('chair')
      expect(a.members.slice(1).every((m) => m.role === 'member')).toBe(true)
      expect(a.members.every((m) => m.status === 'joined')).toBe(true)
      expect(a.members.length).toBeGreaterThanOrEqual(3)
      expect(a.members.length).toBeLessThanOrEqual(6)
    })

    it('指定 memberIds → 使用指定成员且首个为主持', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-002', memberIds: ['D003', 'D005', 'D002'] })
      expect(room.members.map((m) => m.id)).toEqual(['D003', 'D005', 'D002'])
      expect(room.members[0]!.role).toBe('chair')
    })

    it('非法成员 / 空 reportId → 4xx 异常', () => {
      const service = new ConsultationV2Service()
      expect(() => service.createRoom({ reportId: '' })).toThrow(BadRequestException)
      expect(() => service.createRoom({ reportId: 'RPT-CV2-003', memberIds: ['D999'] })).toThrow(BadRequestException)
      expect(() => service.getRoom('no-such')).toThrow(NotFoundException)
    })

    it('startRoom: open → in_progress, 全员 joined', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-004' })
      const started = service.startRoom(room.id)
      expect(started.status).toBe('in_progress')
      expect(() => service.startRoom(room.id)).toThrow(BadRequestException)
    })
  })

  describe('2. 发言时序', () => {
    it('连续发言 → seq 严格递增且按 seq 有序返回', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-T1' })
      const m1 = room.members[0]!
      const m2 = room.members[1]!
      const after1 = service.sendMessage(room.id, { memberId: m1.id, content: '第一句' })
      const after2 = service.sendMessage(room.id, { memberId: m2.id, content: '第二句' })
      const after3 = service.sendMessage(room.id, { memberId: m1.id, content: '第三句' })
      const seqs = after3.messages.map((m) => m.seq)
      expect(seqs).toEqual([1, 2, 3])
      expect(after1.messages[0]!.content).toBe('第一句')
      expect(after2.messages[1]!.content).toBe('第二句')
      const list = service.listMessages(room.id)
      expect(list.map((m) => m.seq)).toEqual([1, 2, 3])
      for (let i = 1; i < list.length; i += 1) {
        expect(list[i]!.at >= list[i - 1]!.at).toBe(true)
      }
    })

    it('非成员发言 → NotFoundException; 空内容 → BadRequestException', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-T2' })
      expect(() => service.sendMessage(room.id, { memberId: 'D999', content: 'hi' })).toThrow(NotFoundException)
      expect(() => service.sendMessage(room.id, { memberId: room.members[0]!.id, content: '  ' })).toThrow(BadRequestException)
    })

    it('发言后消息包含成员名/角色, 发言返回 200 语义 (完整会诊室对象)', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-T3' })
      const updated = service.sendMessage(room.id, { memberId: room.members[0]!.id, content: '讨论发言' })
      expect(updated).toMatchObject({ id: room.id, status: 'in_progress' })
      expect(updated.messages[0]).toMatchObject({ memberId: room.members[0]!.id, memberName: room.members[0]!.name, role: room.members[0]!.role, content: '讨论发言' })
    })
  })

  describe('3. 投票统计', () => {
    it('投票后汇总: 通过/驳回/修改计数 + 同意率 + 待投票成员', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-V1', memberCount: 4 })
      const [c, m1, m2] = room.members
      service.vote(room.id, { memberId: c!.id, opinion: 'approve', comment: '同意' })
      service.vote(room.id, { memberId: m1!.id, opinion: 'approve', comment: '同意' })
      service.vote(room.id, { memberId: m2!.id, opinion: 'modify', comment: '建议修改' })
      const summary = service.voteSummary(room.id)
      expect(summary.votedCount).toBe(3)
      expect(summary.approveCount).toBe(2)
      expect(summary.rejectCount).toBe(0)
      expect(summary.modifyCount).toBe(1)
      expect(summary.approveRate).toBe(67)
      expect(summary.pendingMembers).toHaveLength(1)
      expect(summary.totalMembers).toBe(4)
      expect(summary.opinionLabel.approve).toBe('通过')
    })

    it('重复投票覆盖原意见 (不重复计数)', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-V2' })
      const c = room.members[0]!
      service.vote(room.id, { memberId: c.id, opinion: 'approve' })
      service.vote(room.id, { memberId: c.id, opinion: 'reject', comment: '改投驳回' })
      const summary = service.voteSummary(room.id)
      expect(summary.votedCount).toBe(1)
      expect(summary.rejectCount).toBe(1)
      expect(summary.approveCount).toBe(0)
    })

    it('非成员投票 → NotFoundException; 已结论后投票 → BadRequestException', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-V3' })
      expect(() => service.vote(room.id, { memberId: 'D999', opinion: 'approve' })).toThrow(NotFoundException)
      const c = room.members[0]!
      service.vote(room.id, { memberId: c.id, opinion: 'approve' })
      service.conclude(room.id, { finalOpinion: '已结论' })
      expect(() => service.vote(room.id, { memberId: c.id, opinion: 'approve' })).toThrow(BadRequestException)
    })
  })

  describe('4. 结论生成与导出', () => {
    it('结论生成: 最终意见 + 与会成员签名列表 + 状态 concluded', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-C1', memberCount: 4 })
      for (const m of room.members.slice(0, 3)) {
        service.vote(room.id, { memberId: m.id, opinion: 'approve' })
      }
      const concluded = service.conclude(room.id, { finalOpinion: '一致同意: 主动脉夹层诊断成立。', generatedBy: room.members[0]!.name })
      expect(concluded.status).toBe('concluded')
      expect(concluded.conclusion?.finalOpinion).toBe('一致同意: 主动脉夹层诊断成立。')
      expect(concluded.conclusion?.signatures).toHaveLength(3)
      expect(concluded.conclusion?.signatures.every((s) => s.name && s.title && s.signedAt)).toBe(true)
      expect(concluded.conclusion?.generatedBy).toBe(room.members[0]!.name)
    })

    it('未提供 finalOpinion → 按多数自动归纳最终意见', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-C2', memberCount: 3 })
      for (const m of room.members) {
        service.vote(room.id, { memberId: m.id, opinion: 'approve' })
      }
      const concluded = service.conclude(room.id, {})
      expect(concluded.status).toBe('concluded')
      expect(concluded.conclusion?.finalOpinion).toContain('一致通过')
    })

    it('无投票即结论 → BadRequestException; 重复结论 → BadRequestException', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-C3' })
      expect(() => service.conclude(room.id, { finalOpinion: 'x' })).toThrow(BadRequestException)
      const c = room.members[0]!
      service.vote(room.id, { memberId: c.id, opinion: 'approve' })
      service.conclude(room.id, { finalOpinion: '结论一' })
      expect(() => service.conclude(room.id, { finalOpinion: '结论二' })).toThrow(BadRequestException)
    })

    it('会诊记录导出: 包含最终意见与签名列表, 状态 concluded', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-C4', reportTitle: '疑难病例会诊', patientName: '王五' })
      for (const m of room.members.slice(0, 2)) {
        service.sendMessage(room.id, { memberId: m.id, content: '讨论意见' })
        service.vote(room.id, { memberId: m.id, opinion: 'approve' })
      }
      service.conclude(room.id, { finalOpinion: '结论: 建议手术。' })
      const record = service.exportRecord(room.id)
      expect(record.content).toContain('委员会会诊记录')
      expect(record.content).toContain('结论: 建议手术。')
      expect(record.content).toContain('签名委员 (2)')
      expect(record.content).toContain('发言记录 (2)')
      expect(record.content).toContain('投票汇总 (2)')
      expect(record.reportTitle).toBe('疑难病例会诊')
      expect(record.status).toBe('concluded')
    })
  })

  describe('5. 孤儿模块: seed 回退 + 统计', () => {
    it('无 DB 构造服务 → seed 会诊室可用', () => {
      const service = new ConsultationV2Service()
      const list = service.listRooms()
      expect(list.length).toBeGreaterThan(0)
      const first = service.getRoom(list[0]!.id)
      expect(first.members.length).toBeGreaterThan(0)
      const messages = service.listMessages(first.id)
      expect(Array.isArray(messages)).toBe(true)
    })

    it('统计: 状态分布 / 发言数 / 投票数 / 已结论数', () => {
      const service = new ConsultationV2Service()
      const room = service.createRoom({ reportId: 'RPT-CV2-S1' })
      for (const m of room.members.slice(0, 2)) {
        service.sendMessage(room.id, { memberId: m.id, content: 'x' })
        service.vote(room.id, { memberId: m.id, opinion: 'approve' })
      }
      service.conclude(room.id, {})
      const stats = service.getStats()
      expect(stats.totalRooms).toBeGreaterThan(0)
      expect(stats.totalMessages).toBeGreaterThan(0)
      expect(stats.totalVotes).toBeGreaterThan(0)
      expect(stats.concludedCount).toBeGreaterThan(0)
      const byStatusSum = (['open', 'in_progress', 'voting', 'concluded', 'cancelled'] as const).reduce((a, s) => a + stats.byStatus[s], 0)
      expect(byStatusSum).toBe(stats.totalRooms)
    })
  })
})

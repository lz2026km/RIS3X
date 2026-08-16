/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (critical-escalation) - 危急值升级链 V2 服务测试
 * 覆盖:
 *   1. 升级触发: 超时未确认 → 自动升级 (确定性 tick)
 *   2. 状态机流转: 通知中 → 待确认 → 已确认 / 已升级 / 已关闭
 *   3. 手动升级 + 最高级别封顶 (三级不再升级)
 *   4. 升级链配置: 3 级别超时时间更新 + 非法配置 400
 *   5. 响应耗时统计: 平均确认耗时 / 按级别 / 升级率
 *   6. 孤儿模块回退: DB 不可用 → 确定性种子可工作
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CriticalEscalationService } from './critical-escalation.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return { auditLog: { create: reject } } as never
}

describe('CriticalEscalationService (Wave 6B 危急值升级链 V2)', () => {
  describe('1. 升级触发: 超时自动升级', () => {
    it('一级超时未确认 → 自动升级二级 (状态机: NOTIFYING → ESCALATED)', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const start = new Date('2026-08-16T09:00:00.000Z')
      jest.useFakeTimers({ now: start })
      const chain = await service.startChain({ criticalValueId: 'CV-NEW-001', patientName: '测试患者', modality: 'CT', severity: 'critical' })
      expect(chain.status).toBe('NOTIFYING')
      expect(chain.currentLevel).toBe(1)
      const deadline = new Date(chain.currentDeadline).getTime()
      const before = service.tick(chain.id, new Date(deadline - 1000))
      expect(before.status).toBe('NOTIFYING')
      const after = service.tick(chain.id, new Date(deadline + 1000))
      expect(after.status).toBe('ESCALATED')
      expect(after.currentLevel).toBe(2)
      expect(after.escalatedCount).toBe(1)
      expect(after.steps).toHaveLength(2)
      expect(after.steps[0]!.status).toBe('TIMEOUT')
      expect(after.steps[1]!.level).toBe(2)
      expect(after.steps[1]!.status).toBe('NOTIFIED')
      jest.useRealTimers()
    })

    it('连续超时: 三级封顶, 不再自动升级', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const start = new Date('2026-08-16T09:00:00.000Z')
      jest.useFakeTimers({ now: start })
      const chain = await service.startChain({ criticalValueId: 'CV-NEW-002' })
      const at = (min: number) => new Date(start.getTime() + min * 60000)
      service.tick(chain.id, at(16)) // L1 超时 → L2
      service.tick(chain.id, at(27)) // L2 超时 → L3
      const l3 = service.tick(chain.id, at(28))
      expect(l3.currentLevel).toBe(3)
      expect(l3.status).toBe('ESCALATED')
      const capped = service.tick(chain.id, at(120)) // L3 超时 → 封顶
      expect(capped.currentLevel).toBe(3)
      expect(capped.escalatedCount).toBe(2)
      expect(capped.steps).toHaveLength(3)
      jest.useRealTimers()
    })

    it('已确认/已关闭的链不受超时影响', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const start = new Date('2026-08-16T10:00:00.000Z')
      jest.useFakeTimers({ now: start })
      const chain = await service.startChain({ criticalValueId: 'CV-NEW-003' })
      await service.acknowledge(chain.id, { confirmedBy: '值班医师 王浩' })
      const after = service.tick(chain.id, new Date(start.getTime() + 120 * 60000))
      expect(after.status).toBe('CONFIRMED')
      expect(after.currentLevel).toBe(1)
      jest.useRealTimers()
    })
  })

  describe('2. 状态机流转', () => {
    it('确认: NOTIFYING → CONFIRMED, 步骤标记已确认', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const chain = await service.startChain({ criticalValueId: 'CV-SM-001', patientName: '张伟', title: '急性脑梗死' })
      const done = await service.acknowledge(chain.id, { confirmedBy: '值班医师 李峰', comment: '已电话确认并通知临床' })
      expect(done.status).toBe('CONFIRMED')
      expect(done.acknowledgedBy).toBe('值班医师 李峰')
      expect(done.acknowledgedAt).toBeTruthy()
      expect(done.steps[0]!.status).toBe('CONFIRMED')
      expect(done.steps[0]!.confirmedBy).toBe('值班医师 李峰')
    })

    it('手动升级: 一级 → 二级, 记录 reason', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const chain = await service.startChain({ criticalValueId: 'CV-SM-002' })
      const done = await service.escalate(chain.id, { reason: '危急程度高, 值班医师判断需立即升级' })
      expect(done.status).toBe('ESCALATED')
      expect(done.currentLevel).toBe(2)
      expect(done.escalatedCount).toBe(1)
      expect(done.history[done.history.length - 1]!.reason).toContain('立即升级')
      expect(done.steps[0]!.status).toBe('TIMEOUT')
    })

    it('最高级别 (三级) 手动升级 → BadRequestException', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const start = new Date('2026-08-16T11:00:00.000Z')
      jest.useFakeTimers({ now: start })
      const chain = await service.startChain({ criticalValueId: 'CV-SM-003' })
      service.tick(chain.id, new Date(start.getTime() + 16 * 60000))
      service.tick(chain.id, new Date(start.getTime() + 27 * 60000))
      await expect(service.escalate(chain.id, { reason: '再次升级' })).rejects.toThrow(BadRequestException)
      jest.useRealTimers()
    })

    it('关闭: 任意打开状态 → CLOSED', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const chain = await service.startChain({ criticalValueId: 'CV-SM-004' })
      const done = await service.closeChain(chain.id, { closedBy: '质控组', comment: '危急值已闭环处理' })
      expect(done.status).toBe('CLOSED')
      expect(done.closedAt).toBeTruthy()
      await expect(service.closeChain(chain.id)).rejects.toThrow(BadRequestException)
    })

    it('非法流转: 已确认链不可再升级/确认, 未知链 → NotFoundException', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const chain = await service.startChain({ criticalValueId: 'CV-SM-005' })
      await service.acknowledge(chain.id, { confirmedBy: '值班医师' })
      await expect(service.escalate(chain.id)).rejects.toThrow(BadRequestException)
      await expect(service.acknowledge(chain.id, { confirmedBy: 'X' })).rejects.toThrow(BadRequestException)
      expect(() => service.getChain('ESC-UNKNOWN')).toThrow(NotFoundException)
      expect(() => service.tick('ESC-UNKNOWN')).toThrow(NotFoundException)
    })
  })

  describe('3. 升级链配置', () => {
    it('默认配置: 3 级别 (一级电话/二级值班/三级科主任) + 规则', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const config = service.getConfig()
      expect(config.levels).toHaveLength(3)
      expect(config.levels[0]!.name).toBe('一级电话')
      expect(config.levels[1]!.name).toBe('二级值班')
      expect(config.levels[2]!.name).toBe('三级科主任')
      expect(config.levels.every((l) => l.timeoutMinutes > 0)).toBe(true)
      expect(config.levels.every((l) => l.channels.length > 0)).toBe(true)
      expect(config.rules.some((r) => r.key === 'auto-timeout' && r.enabled)).toBe(true)
    })

    it('更新配置: 超时时间生效 (确定性校验)', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const updated = service.updateConfig({
        levels: [
          { level: 1, timeoutMinutes: 30 },
          { level: 2, timeoutMinutes: 20 },
          { level: 3, timeoutMinutes: 10 },
        ],
      })
      expect(updated.levels.map((l) => l.timeoutMinutes)).toEqual([30, 20, 10])
      const config = service.getConfig()
      expect(config.levels[0]!.timeoutMinutes).toBe(30)
      // 新链按新超时计算
      const start = new Date('2026-08-16T12:00:00.000Z')
      jest.useFakeTimers({ now: start })
      const chain = await service.startChain({ criticalValueId: 'CV-CFG-001' })
      const notYet = service.tick(chain.id, new Date(start.getTime() + 29 * 60000))
      expect(notYet.status).toBe('NOTIFYING')
      const escalated = service.tick(chain.id, new Date(start.getTime() + 31 * 60000))
      expect(escalated.currentLevel).toBe(2)
      jest.useRealTimers()
    })

    it('非法配置 → BadRequestException: 级别数 ≠3 / 超时越界 / 级别重复', async () => {
      const service = new CriticalEscalationService(makePrisma())
      expect(() =>
        service.updateConfig({ levels: [{ level: 1, timeoutMinutes: 10 }, { level: 2, timeoutMinutes: 10 }] }),
      ).toThrow(BadRequestException)
      expect(() =>
        service.updateConfig({ levels: [
          { level: 1, timeoutMinutes: 0 },
          { level: 2, timeoutMinutes: 10 },
          { level: 3, timeoutMinutes: 10 },
        ] }),
      ).toThrow(BadRequestException)
      expect(() =>
        service.updateConfig({ levels: [
          { level: 1, timeoutMinutes: 10 },
          { level: 1, timeoutMinutes: 10 },
          { level: 3, timeoutMinutes: 10 },
        ] }),
      ).toThrow(BadRequestException)
    })
  })

  describe('4. 响应耗时统计', () => {
    it('统计字段齐全: byStatus 总和 = 总数, 按级别平均确认耗时', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const stats = service.getStats()
      expect(stats.total).toBeGreaterThan(0)
      const statusSum = Object.values(stats.byStatus).reduce((a, b) => a + (b ?? 0), 0)
      expect(statusSum).toBe(stats.total)
      expect(stats.byLevel).toHaveLength(3)
      stats.byLevel.forEach((l) => {
        expect(l.level).toBeGreaterThanOrEqual(1)
        expect(l.level).toBeLessThanOrEqual(3)
        expect(l.count).toBeGreaterThan(0)
        expect(l.confirmed >= 0).toBe(true)
        expect(l.escalated >= 0).toBe(true)
      })
      expect(stats.escalationRate).toBeGreaterThan(0)
      expect(stats.closedRate).toBeGreaterThan(0)
      expect(stats.avgResponseMinutes).toBeGreaterThan(0)
      expect(stats.avgEscalationCount).toBeGreaterThan(0)
    })

    it('平均响应耗时确定性: 多次调用一致', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const a = service.getStats()
      const b = service.getStats()
      expect(a).toEqual(b)
      // 一级确认耗时 = 8 分钟 (种子链 CV-20260801-001)
      const l1 = a.byLevel.find((l) => l.level === 1)!
      expect(l1.confirmed).toBeGreaterThanOrEqual(1)
      expect(l1.avgResponseMinutes).toBe(8)
    })
  })

  describe('5. 孤儿模块回退 (DB 不可用)', () => {
    it('种子链可用, 步骤时间线/倒计时/升级记录齐全', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const chains = service.listChains()
      expect(chains.length).toBeGreaterThan(0)
      expect(chains.every((c) => c.steps.length >= 1)).toBe(true)
      expect(chains.every((c) => c.currentDeadline)).toBe(true)
      const escalated = service.listChains({ status: 'ESCALATED' })
      expect(escalated.every((c) => c.status === 'ESCALATED')).toBe(true)
      const detail = service.getChain(escalated[0]!.id)
      expect(detail.history.length).toBeGreaterThan(0)
      const steps = service.stepsOf(escalated[0]!.id)
      expect(steps.some((s) => s.status === 'TIMEOUT')).toBe(true)
    })

    it('配置可读且修改不影响种子链数量', async () => {
      const service = new CriticalEscalationService(makePrisma())
      const before = service.listChains().length
      service.updateConfig({ levels: [
        { level: 1, timeoutMinutes: 20 },
        { level: 2, timeoutMinutes: 15 },
        { level: 3, timeoutMinutes: 10 },
      ] })
      expect(service.listChains().length).toBe(before)
    })
  })
})

/**
 * G005 RIS v3.0.6.11-99 (Wave 6B) - TechScheduleService 测试
 * 技师排班: 列表/创建/编辑/删除/确认/换班/请假/月历/统计/批量生成 (内存 + 种子)
 */
import { TechScheduleService } from '../src/modules/tech-schedule/tech-schedule.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const dayStr = (offsetDay: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDay)
  return d.toISOString().slice(0, 10)
}

const monthStr = () => dayStr(0).slice(0, 7)

describe('TechScheduleService - 列表/筛选', () => {
  it('list 种子非空且按日期排序', () => {
    const svc = new TechScheduleService()
    const list = svc.list({})
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]!.date <= list[list.length - 1]!.date).toBe(true)
  })

  it('list 支持按日期/技师/状态筛选', () => {
    const svc = new TechScheduleService()
    const today = dayStr(0)
    const byDate = svc.list({ date: today })
    expect(byDate.length).toBeGreaterThan(0)
    expect(byDate.every((s) => s.date === today)).toBe(true)
    const byTech = svc.list({ technicianId: 'T-001' })
    expect(byTech.every((s) => s.technicianId === 'T-001')).toBe(true)
    const byStatus = svc.list({ status: 'ON_LEAVE' })
    expect(byStatus.every((s) => s.status === 'ON_LEAVE')).toBe(true)
  })

  it('list 支持按月过滤', () => {
    const svc = new TechScheduleService()
    const month = monthStr()
    const list = svc.list({ month })
    expect(list.every((s) => s.date.startsWith(month))).toBe(true)
  })
})

describe('TechScheduleService - 创建/编辑/删除', () => {
  it('create 成功后出现在列表, 技师名/检查室名自动派生', () => {
    const svc = new TechScheduleService()
    const created = svc.create({ date: dayStr(6), shift: 'NIGHT', technicianId: 'T-005', roomId: 'R-DSA1', notes: '造影备勤' })
    expect(created.id).toBeTruthy()
    expect(created.technicianName).toBe('陈静')
    expect(created.roomName).toBe('DSA-1 检查室')
    expect(created.status).toBe('SCHEDULED')
    expect(svc.list({}).some((s) => s.id === created.id)).toBe(true)
  })

  it('create 非法 date → BadRequestException', () => {
    const svc = new TechScheduleService()
    expect(() => svc.create({ date: '2026/08/13', shift: 'DAY', technicianId: 'T-001' })).toThrow(BadRequestException)
  })

  it('create 非法 shift / 未知技师 / 同日同技师冲突 → BadRequestException', () => {
    const svc = new TechScheduleService()
    expect(() => svc.create({ date: dayStr(6), shift: 'EVENING' as never, technicianId: 'T-001' })).toThrow(BadRequestException)
    expect(() => svc.create({ date: dayStr(6), shift: 'DAY', technicianId: 'T-999' })).toThrow(BadRequestException)
    expect(() => svc.create({ date: dayStr(0), shift: 'DAY', technicianId: 'T-001' })).toThrow(BadRequestException)
  })

  it('update 修改班次/备注/技师', () => {
    const svc = new TechScheduleService()
    const target = svc.list({ technicianId: 'T-008' })[0]!
    const updated = svc.update(target.id, { shift: 'NIGHT', notes: '临时调整', technicianId: 'T-003' })
    expect(updated.shift).toBe('NIGHT')
    expect(updated.notes).toBe('临时调整')
    expect(updated.technicianName).toBe('孙伟')
  })

  it('update 未知 id → NotFoundException', () => {
    const svc = new TechScheduleService()
    expect(() => svc.update('nope', { shift: 'DAY' })).toThrow(NotFoundException)
  })

  it('delete 删除后列表不再包含, 重复删除抛 NotFound', () => {
    const svc = new TechScheduleService()
    const target = svc.list({})[0]!
    svc.remove(target.id)
    expect(svc.list({}).some((s) => s.id === target.id)).toBe(false)
    expect(() => svc.remove(target.id)).toThrow(NotFoundException)
  })
})

describe('TechScheduleService - 确认/换班/请假', () => {
  it('confirm 状态 → CONFIRMED, 请假班次不可确认', () => {
    const svc = new TechScheduleService()
    const pending = svc.list({ status: 'SCHEDULED' })[0]!
    expect(svc.confirm(pending.id).status).toBe('CONFIRMED')
    const leave = svc.list({ status: 'ON_LEAVE' })[0]!
    expect(() => svc.confirm(leave.id)).toThrow(BadRequestException)
  })

  it('swap 按 targetId 双方交换技师并标记 SWAPPED + reason', () => {
    const svc = new TechScheduleService()
    const a = svc.list({ technicianId: 'T-001' })[0]!
    const b = svc.list({ technicianId: 'T-002' })[0]!
    const aName = a.technicianName
    const bName = b.technicianName
    const { source, target } = svc.swap(a.id, { targetId: b.id, reason: '家庭事务对调' })
    expect(source.technicianName).toBe(bName)
    expect(target.technicianName).toBe(aName)
    expect(source.status).toBe('SWAPPED')
    expect(target.status).toBe('SWAPPED')
    expect(source.swapReason).toBe('家庭事务对调')
  })

  it('swap 按 targetTechId 换同日同班次技师', () => {
    const svc = new TechScheduleService()
    const today = dayStr(0)
    const source = svc.list({ date: today })[0]!
    const targetTech = svc.list({ date: today }).map((s) => s.technicianId).find((id) => id !== source.technicianId)!
    const { source: swapped } = svc.swap(source.id, { targetTechId: targetTech, reason: '临时对调' })
    expect(swapped.technicianId).toBe(targetTech)
  })

  it('swap 无 target / 未知 id → 校验异常', () => {
    const svc = new TechScheduleService()
    expect(() => svc.swap('nope', { targetTechId: 'T-001' })).toThrow(NotFoundException)
    expect(() => svc.swap(svc.list({})[0]!.id, {})).toThrow(BadRequestException)
  })

  it('leave 状态 → ON_LEAVE + leaveReason 补位提示', () => {
    const svc = new TechScheduleService()
    const pending = svc.list({ status: 'SCHEDULED' })[0]!
    const updated = svc.leave(pending.id, { reason: '突发疾病, 请安排补位' })
    expect(updated.status).toBe('ON_LEAVE')
    expect(updated.leaveReason).toContain('补位')
    expect(() => svc.leave(pending.id, { reason: 'again' })).toThrow(BadRequestException)
  })
})

describe('TechScheduleService - 月历/统计/批量', () => {
  it('getCalendar 生成当月全部日期 + 技师矩阵数据', () => {
    const svc = new TechScheduleService()
    const month = monthStr()
    const cal = svc.getCalendar({ month })
    expect(cal.month).toBe(month)
    expect(cal.days.length).toBeGreaterThanOrEqual(28)
    expect(cal.technicians.length).toBeGreaterThan(0)
    const today = dayStr(0)
    const todayDay = cal.days.find((d) => d.date === today)
    expect(todayDay).toBeTruthy()
    expect(todayDay!.isToday).toBe(true)
  })

  it('getCalendar 非法月份 / year 不一致 → BadRequestException', () => {
    const svc = new TechScheduleService()
    expect(() => svc.getCalendar({ month: '2026-13' })).toThrow(BadRequestException)
    expect(() => svc.getCalendar({ month: 'abc' })).toThrow(BadRequestException)
    expect(() => svc.getCalendar({ month: '2026-08', year: '2025' })).toThrow(BadRequestException)
  })

  it('getStats 返回本月班次/技师分布/请假数/夜班数', () => {
    const svc = new TechScheduleService()
    const stats = svc.getStats({ month: monthStr() })
    expect(stats.totalShifts).toBeGreaterThan(0)
    expect(stats.technicianCount).toBeGreaterThan(0)
    expect(stats.byShift.find((b) => b.shift === 'NIGHT')!.count).toBe(stats.nightShiftCount)
    expect(stats.leaveCount).toBe(stats.byTechnician.reduce((sum, t) => sum + t.leaves, 0))
    expect(stats.byTechnician[0]!.technicianName).toBeTruthy()
  })

  it('batchCreate 按模式生成日期×班次并跳过同技师冲突', () => {
    const svc = new TechScheduleService()
    const before = svc.list({}).length
    const created = svc.batchCreate({ startDate: dayStr(7), endDate: dayStr(10), shiftPattern: ['DAY', 'NIGHT', 'BACKUP'] })
    expect(created.length).toBeGreaterThan(0)
    expect(svc.list({}).length - before).toBe(created.length)
    const days = new Set(created.map((c) => c.date))
    expect(days.size).toBe(4)
    const shifts = new Set(created.map((c) => c.shift))
    expect(shifts.has('DAY')).toBe(true)
    expect(shifts.has('NIGHT')).toBe(true)
    expect(shifts.has('BACKUP')).toBe(true)
  })

  it('batchCreate 参数校验: 日期倒置/空模式/非法班次 → BadRequestException', () => {
    const svc = new TechScheduleService()
    expect(() => svc.batchCreate({ startDate: dayStr(5), endDate: dayStr(3), shiftPattern: ['DAY'] })).toThrow(BadRequestException)
    expect(() => svc.batchCreate({ startDate: dayStr(3), endDate: dayStr(5), shiftPattern: [] })).toThrow(BadRequestException)
    expect(() => svc.batchCreate({ startDate: 'bad', endDate: dayStr(5), shiftPattern: ['DAY'] })).toThrow(BadRequestException)
  })
})

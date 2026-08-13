/**
 * G005 RIS v3.0.6.11-92 (Wave3A P2) - DeptAnnouncementService 测试
 * 公告 CRUD/置顶/有效期 + 值班 CRUD/月历 (内存 + 种子)
 */
import { DeptAnnouncementService } from './dept-announcement.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const dayStr = (offsetDay: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDay)
  return d.toISOString().slice(0, 10)
}

describe('DeptAnnouncementService - 公告', () => {
  it('listAnnouncements 种子非空且置顶优先', () => {
    const svc = new DeptAnnouncementService()
    const list = svc.listAnnouncements()
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]!.pinned).toBe(true)
  })

  it('listActiveAnnouncements 过滤过期公告', () => {
    const svc = new DeptAnnouncementService()
    const active = svc.listActiveAnnouncements()
    expect(active.every((a) => !a.expiresAt || a.expiresAt >= dayStr(0))).toBe(true)
    const created = svc.createAnnouncement({
      title: '过期测试公告',
      content: '这是一条已经过期的测试公告内容',
      expiresAt: dayStr(-1),
    })
    expect(svc.listActiveAnnouncements().some((a) => a.id === created.id)).toBe(false)
  })

  it('createAnnouncement 创建后出现在列表头部', () => {
    const svc = new DeptAnnouncementService()
    const created = svc.createAnnouncement({
      title: '临时会议',
      content: '今天下午三点在示教室开组会',
      category: 'meeting',
      pinned: true,
      author: '王建国',
    })
    expect(created.id).toBeTruthy()
    expect(created.pinned).toBe(true)
    const list = svc.listAnnouncements()
    expect(list[0]!.id).toBe(created.id)
  })

  it('title 缺失 → BadRequestException', () => {
    const svc = new DeptAnnouncementService()
    expect(() => svc.createAnnouncement({ title: '', content: '内容至少五个字' })).toThrow(BadRequestException)
  })

  it('updateAnnouncement 支持置顶开关 + 内容修改', () => {
    const svc = new DeptAnnouncementService()
    const target = svc.listAnnouncements().find((a) => !a.pinned)!
    const updated = svc.updateAnnouncement(target.id, { pinned: true, content: '更新后的公告内容更长一些' })
    expect(updated.pinned).toBe(true)
    expect(updated.content).toContain('更新后')
    expect(svc.listAnnouncements()[0]!.id).toBe(target.id)
  })

  it('updateAnnouncement 未知 id → NotFoundException', () => {
    const svc = new DeptAnnouncementService()
    expect(() => svc.updateAnnouncement('nope', { pinned: true })).toThrow(NotFoundException)
  })

  it('deleteAnnouncement 删除后列表不再包含', () => {
    const svc = new DeptAnnouncementService()
    const target = svc.listAnnouncements()[0]!
    svc.deleteAnnouncement(target.id)
    expect(svc.listAnnouncements().some((a) => a.id === target.id)).toBe(false)
    expect(() => svc.deleteAnnouncement(target.id)).toThrow(NotFoundException)
  })
})

describe('DeptAnnouncementService - 值班', () => {
  it('listSchedules 种子非空且按日期排序', () => {
    const svc = new DeptAnnouncementService()
    const list = svc.listSchedules()
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]!.date <= list[list.length - 1]!.date).toBe(true)
  })

  it('createSchedule 校验 date 格式', () => {
    const svc = new DeptAnnouncementService()
    expect(() =>
      svc.createSchedule({ date: '2026/08/13', doctorId: 'D1', doctorName: '张三', shift: 'DAY' }),
    ).toThrow(BadRequestException)
  })

  it('createSchedule + updateSchedule + deleteSchedule 全链路', () => {
    const svc = new DeptAnnouncementService()
    const created = svc.createSchedule({
      date: dayStr(3),
      doctorId: 'D-NEW',
      doctorName: '新值班医生',
      shift: 'NIGHT',
      role: '二线值班',
    })
    expect(created.id).toBeTruthy()
    expect(created.shift).toBe('NIGHT')
    const updated = svc.updateSchedule(created.id, { shift: 'DAY', doctorId: 'D-OTHER' })
    expect(updated.shift).toBe('DAY')
    expect(updated.doctorId).toBe('D-OTHER')
    svc.deleteSchedule(created.id)
    expect(svc.listSchedules().some((s) => s.id === created.id)).toBe(false)
    expect(() => svc.deleteSchedule(created.id)).toThrow(NotFoundException)
  })

  it('getCalendar 生成当月全部日期并聚合值班', () => {
    const svc = new DeptAnnouncementService()
    const month = new Date().toISOString().slice(0, 7)
    const cal = svc.getCalendar(month)
    expect(cal.month).toBe(month)
    expect(cal.days.length).toBeGreaterThanOrEqual(28)
    const today = dayStr(0)
    const todayDay = cal.days.find((d) => d.date === today)
    expect(todayDay).toBeTruthy()
    expect(todayDay!.isToday).toBe(true)
    expect(todayDay!.weekday).toBeTruthy()
  })

  it('getCalendar 非法月份 → BadRequestException', () => {
    const svc = new DeptAnnouncementService()
    expect(() => svc.getCalendar('2026-13')).toThrow(BadRequestException)
    expect(() => svc.getCalendar('abc')).toThrow(BadRequestException)
  })

  it('listSchedules 支持按月过滤', () => {
    const svc = new DeptAnnouncementService()
    const month = dayStr(0).slice(0, 7)
    const list = svc.listSchedules(month)
    expect(list.every((s) => s.date.startsWith(month))).toBe(true)
  })
})

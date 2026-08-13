// [G005 Wave3A P2] 科室公告 + 值班管理 MSW handlers
//   API = /api/v1/dept-announcements · /api/v1/on-call-schedules
//   → backend modules/dept-announcement (内存 + 种子)
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + "/api/v1"; } catch { return "http://localhost/api/v1"; }
})();

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

type Category = 'notice' | 'meeting' | 'policy' | 'urgent' | 'other';
type Shift = 'DAY' | 'NIGHT' | 'WEEKEND';

interface Announcement {
  id: string; title: string; content: string; category: Category;
  pinned: boolean; expiresAt: string; author: string; createdAt: string; updatedAt: string;
}

interface Schedule {
  id: string; date: string; doctorId: string; doctorName: string;
  shift: Shift; role: string; createdAt: string; updatedAt: string;
}

const SHIFT_LABELS: Record<Shift, string> = { DAY: '白班', NIGHT: '夜班', WEEKEND: '周末班' };
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const dayStr = (offsetDay: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDay);
  return d.toISOString().slice(0, 10);
};

const exp = (offsetDay: number) => dayStr(offsetDay);
const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString();

let announcements: Announcement[] = [
  {
    id: 'DA-001', title: '本周五业务学习: 主动脉夹层影像诊断',
    content: '周五 15:00 在示教室举行, 请全体医师参加, 会后考核登记学分。',
    category: 'meeting', pinned: true, expiresAt: exp(7), author: '张伟明', createdAt: iso(24 * 60), updatedAt: iso(24 * 60),
  },
  {
    id: 'DA-002', title: '危急值报告流程更新(2026-08 版)',
    content: '接医务处通知: 危急值确认电话后须在 30 分钟内补充站内留言, 闭环记录留档。',
    category: 'policy', pinned: false, expiresAt: exp(30), author: '王建国', createdAt: iso(48 * 60), updatedAt: iso(48 * 60),
  },
  {
    id: 'DA-003', title: 'CT 设备停机维护通知',
    content: '周六 02:00-06:00 CT-1 例行维护, 期间急诊检查走 CT-2。',
    category: 'urgent', pinned: false, expiresAt: exp(3), author: '陈海涛', createdAt: iso(6 * 60), updatedAt: iso(6 * 60),
  },
  {
    id: 'DA-004', title: '新进住院医师轮转安排',
    content: '本月新进住院医师 3 人, 轮转计划见科室公告栏附件。',
    category: 'notice', pinned: false, expiresAt: exp(60), author: '刘芳', createdAt: iso(72 * 60), updatedAt: iso(72 * 60),
  },
];

let schedules: Schedule[] = [
  { id: 'OC-001', date: dayStr(0), doctorId: 'D-LI', doctorName: '李天宇', shift: 'DAY', role: '首诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-002', date: dayStr(0), doctorId: 'D-LIN', doctorName: '林华', shift: 'NIGHT', role: '首诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-003', date: dayStr(0), doctorId: 'D-WANG', doctorName: '王琴', shift: 'WEEKEND', role: '主诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-004', date: dayStr(1), doctorId: 'D-ZHOU', doctorName: '周怡', shift: 'DAY', role: '主诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-005', date: dayStr(1), doctorId: 'D-CHEN', doctorName: '陈伟', shift: 'NIGHT', role: '二线值班', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-006', date: dayStr(2), doctorId: 'D-ZHANG', doctorName: '张明', shift: 'WEEKEND', role: '科主任', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
];

const sortAnnouncements = (list: Announcement[]) =>
  [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

export const deptHandlers = [
  // ==================== 公告 ====================
  http.get(`${API_BASE}/dept-announcements`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: sortAnnouncements(announcements), meta: { total: announcements.length } });
  }),

  http.get(`${API_BASE}/dept-announcements/active`, async () => {
    await delay(delayMs());
    const today = dayStr(0);
    const active = sortAnnouncements(announcements).filter((a) => !a.expiresAt || a.expiresAt >= today);
    return HttpResponse.json({ success: true, data: active, meta: { total: active.length } });
  }),

  http.post(`${API_BASE}/dept-announcements`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !String(body.title ?? '').trim() || String(body.content ?? '').trim().length < 5) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'title 必填且 content 至少 5 个字符' } }, { status: 400 });
    }
    const now = new Date().toISOString();
    const item: Announcement = {
      id: `DA-${Date.now()}`,
      title: String(body.title).trim(),
      content: String(body.content).trim(),
      category: body.category || 'notice',
      pinned: Boolean(body.pinned),
      expiresAt: body.expiresAt || exp(30),
      author: body.author || '当前用户',
      createdAt: now,
      updatedAt: now,
    };
    announcements.unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),

  http.patch(`${API_BASE}/dept-announcements/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const hit = announcements.find((a) => a.id === params.id);
    if (!hit) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `公告 ${params.id} 不存在` } }, { status: 404 });
    }
    if (body && body.title !== undefined) hit.title = String(body.title).trim();
    if (body && body.content !== undefined) hit.content = String(body.content).trim();
    if (body && body.category !== undefined) hit.category = body.category;
    if (body && body.pinned !== undefined) hit.pinned = Boolean(body.pinned);
    if (body && body.expiresAt !== undefined) hit.expiresAt = body.expiresAt;
    hit.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: hit });
  }),

  http.delete(`${API_BASE}/dept-announcements/:id`, async ({ params }) => {
    await delay(delayMs());
    const idx = announcements.findIndex((a) => a.id === params.id);
    if (idx < 0) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `公告 ${params.id} 不存在` } }, { status: 404 });
    }
    announcements.splice(idx, 1);
    return HttpResponse.json({ success: true, data: {} });
  }),

  // ==================== 值班 ====================
  http.get(`${API_BASE}/on-call-schedules`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    let items = schedules;
    if (month) items = items.filter((s) => s.date.startsWith(month));
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    return HttpResponse.json({ success: true, data: sorted, meta: { total: sorted.length } });
  }),

  http.get(`${API_BASE}/on-call-schedules/calendar`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    let month = url.searchParams.get('month') || dayStr(0).slice(0, 7);
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'month 格式应为 YYYY-MM' } }, { status: 400 });
    }
    const year = Number(m[1]);
    const monthNum = Number(m[2]);
    if (monthNum < 1 || monthNum > 12) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'month 应为 01-12' } }, { status: 400 });
    }
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const today = dayStr(0);
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${m[1]}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date,
        weekday: WEEKDAYS[new Date(year, monthNum - 1, d).getDay()] ?? '',
        isToday: date === today,
        schedules: schedules.filter((s) => s.date === date),
      });
    }
    return HttpResponse.json({ success: true, data: { month, days } });
  }),

  http.post(`${API_BASE}/on-call-schedules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? '')) || !String(body.doctorId ?? '').trim() || !String(body.doctorName ?? '').trim() || !['DAY', 'NIGHT', 'WEEKEND'].includes(body.shift)) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'date/doctorId/doctorName/shift 校验失败' } }, { status: 400 });
    }
    const now = new Date().toISOString();
    const item: Schedule = {
      id: `OC-${Date.now()}`,
      date: body.date,
      doctorId: body.doctorId,
      doctorName: body.doctorName,
      shift: body.shift,
      role: body.role || SHIFT_LABELS[body.shift as Shift],
      createdAt: now,
      updatedAt: now,
    };
    schedules.unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),

  http.put(`${API_BASE}/on-call-schedules/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const hit = schedules.find((s) => s.id === params.id);
    if (!hit) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `值班 ${params.id} 不存在` } }, { status: 404 });
    }
    if (body) {
      if (body.date !== undefined) hit.date = String(body.date);
      if (body.doctorId !== undefined) hit.doctorId = String(body.doctorId);
      if (body.doctorName !== undefined) hit.doctorName = String(body.doctorName);
      if (body.shift !== undefined) hit.shift = body.shift;
      if (body.role !== undefined) hit.role = String(body.role);
    }
    hit.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: hit });
  }),

  http.delete(`${API_BASE}/on-call-schedules/:id`, async ({ params }) => {
    await delay(delayMs());
    const idx = schedules.findIndex((s) => s.id === params.id);
    if (idx < 0) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `值班 ${params.id} 不存在` } }, { status: 404 });
    }
    schedules.splice(idx, 1);
    return HttpResponse.json({ success: true, data: {} });
  }),
];

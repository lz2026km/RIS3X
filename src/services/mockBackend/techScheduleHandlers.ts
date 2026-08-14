// [G005 Wave 6B (tech-schedule)] 技师排班管理 MSW handlers
//   API = /api/v1/tech-schedules (列表/日历/统计/meta/确认/换班/请假/批量生成)
//   → backend modules/tech-schedule (内存 + 种子)
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + "/api/v1"; } catch { return "http://localhost/api/v1"; }
})();

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export type TechShift = 'DAY' | 'NIGHT' | 'WEEKEND' | 'BACKUP';
export type TechScheduleStatus = 'SCHEDULED' | 'CONFIRMED' | 'SWAPPED' | 'ON_LEAVE';

export interface TechScheduleItem {
  id: string; date: string; shift: TechShift;
  technicianId: string; technicianName: string;
  roomId: string | null; roomName: string | null;
  status: TechScheduleStatus;
  notes: string | null; swapReason: string | null; leaveReason: string | null;
  createdAt: string; updatedAt: string;
}

const SHIFT_LABELS: Record<TechShift, string> = { DAY: '白班', NIGHT: '夜班', WEEKEND: '周末班', BACKUP: '备班' };
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const TECH_ROSTER = [
  { id: 'T-001', name: '刘洋', group: 'CT 室' },
  { id: 'T-002', name: '赵志刚', group: 'CT 组' },
  { id: 'T-003', name: '孙伟', group: 'MR 组' },
  { id: 'T-004', name: '王磊', group: 'DR 组' },
  { id: 'T-005', name: '陈静', group: 'DSA 组' },
  { id: 'T-006', name: '周婷', group: 'MG 组' },
  { id: 'T-007', name: '吴强', group: 'CT 组' },
  { id: 'T-008', name: '郑爽', group: 'MR 组' },
];

const ROOMS = [
  { id: 'R-CT1', name: 'CT-1 检查室' },
  { id: 'R-CT2', name: 'CT-2 检查室' },
  { id: 'R-MR1', name: 'MR-1 检查室' },
  { id: 'R-DR1', name: 'DR-1 检查室' },
  { id: 'R-DSA1', name: 'DSA-1 检查室' },
  { id: 'R-MG1', name: 'MG-1 检查室' },
];

const dayStr = (offsetDay: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDay);
  return d.toISOString().slice(0, 10);
};

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString();

const techName = (id: string) => TECH_ROSTER.find((t) => t.id === id)?.name ?? id;
const roomOf = (roomId: string | null | undefined) => {
  if (!roomId) return { roomId: null, roomName: null };
  const hit = ROOMS.find((r) => r.id === roomId);
  return { roomId, roomName: hit?.name ?? roomId };
};

let schedules: TechScheduleItem[] = [
  { id: 'TS-001', date: dayStr(0), shift: 'DAY', technicianId: 'T-001', technicianName: '刘洋', roomId: 'R-CT1', roomName: 'CT-1 检查室', status: 'CONFIRMED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-002', date: dayStr(0), shift: 'NIGHT', technicianId: 'T-004', technicianName: '王磊', roomId: 'R-MR1', roomName: 'MR-1 检查室', status: 'SCHEDULED', notes: '急诊通道备勤', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-003', date: dayStr(0), shift: 'BACKUP', technicianId: 'T-007', technicianName: '吴强', roomId: null, roomName: null, status: 'SCHEDULED', notes: '机动补位', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-004', date: dayStr(1), shift: 'DAY', technicianId: 'T-002', technicianName: '赵志刚', roomId: 'R-CT2', roomName: 'CT-2 检查室', status: 'CONFIRMED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-005', date: dayStr(1), shift: 'NIGHT', technicianId: 'T-005', technicianName: '陈静', roomId: 'R-DSA1', roomName: 'DSA-1 检查室', status: 'SCHEDULED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-006', date: dayStr(2), shift: 'DAY', technicianId: 'T-006', technicianName: '周婷', roomId: 'R-MG1', roomName: 'MG-1 检查室', status: 'CONFIRMED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-007', date: dayStr(2), shift: 'NIGHT', technicianId: 'T-003', technicianName: '孙伟', roomId: 'R-MR1', roomName: 'MR-1 检查室', status: 'SCHEDULED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-008', date: dayStr(3), shift: 'DAY', technicianId: 'T-008', technicianName: '郑爽', roomId: 'R-DR1', roomName: 'DR-1 检查室', status: 'SCHEDULED', notes: '带教见习', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-009', date: dayStr(3), shift: 'WEEKEND', technicianId: 'T-001', technicianName: '刘洋', roomId: 'R-CT1', roomName: 'CT-1 检查室', status: 'SWAPPED', notes: null, swapReason: '与赵志刚对调周末班', leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-010', date: dayStr(4), shift: 'NIGHT', technicianId: 'T-002', technicianName: '赵志刚', roomId: 'R-CT2', roomName: 'CT-2 检查室', status: 'ON_LEAVE', notes: null, swapReason: null, leaveReason: '家中有事，需补位', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-011', date: dayStr(4), shift: 'DAY', technicianId: 'T-007', technicianName: '吴强', roomId: 'R-CT1', roomName: 'CT-1 检查室', status: 'SCHEDULED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-012', date: dayStr(5), shift: 'WEEKEND', technicianId: 'T-006', technicianName: '周婷', roomId: 'R-MG1', roomName: 'MG-1 检查室', status: 'SCHEDULED', notes: '周末上午半天', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
];

const ok = (data: unknown, status = 200) => HttpResponse.json({ success: true, data }, { status });
const fail = (message: string, status = 400) => HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message } }, { status });

export const techScheduleHandlers = [
  http.get(`${API_BASE}/tech-schedules`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const month = url.searchParams.get('month');
    const technicianId = url.searchParams.get('technicianId');
    const status = url.searchParams.get('status');
    let items = schedules;
    if (date) items = items.filter((s) => s.date === date);
    if (month) items = items.filter((s) => s.date.startsWith(month));
    if (technicianId) items = items.filter((s) => s.technicianId === technicianId);
    if (status) items = items.filter((s) => s.status === status);
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
    return ok(sorted);
  }),

  http.get(`${API_BASE}/tech-schedules/calendar`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get('year')) || now.getFullYear();
    let month = url.searchParams.get('month') || `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m || Number(m[1]) !== year) return fail('month 格式应为 YYYY-MM', 400);
    const monthNum = Number(m[2]);
    if (monthNum < 1 || monthNum > 12) return fail('month 应为 01-12', 400);
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
    return ok({ month: `${m[1]}-${m[2]}`, year, days, technicians: TECH_ROSTER });
  }),

  http.get(`${API_BASE}/tech-schedules/stats`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get('year')) || now.getFullYear();
    const month = url.searchParams.get('month') || `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) return fail('month 格式应为 YYYY-MM', 400);
    const items = schedules.filter((s) => s.date.startsWith(month));
    const byTechnician = TECH_ROSTER.map((t) => {
      const list = items.filter((s) => s.technicianId === t.id);
      return {
        technicianId: t.id,
        technicianName: t.name,
        count: list.length,
        nights: list.filter((s) => s.shift === 'NIGHT').length,
        leaves: list.filter((s) => s.status === 'ON_LEAVE').length,
      };
    }).filter((x) => x.count > 0);
    const byShift = (['DAY', 'NIGHT', 'WEEKEND', 'BACKUP'] as TechShift[]).map((shift) => ({
      shift,
      label: SHIFT_LABELS[shift],
      count: items.filter((s) => s.shift === shift).length,
    }));
    return ok({
      month: `${m[1]}-${m[2]}`,
      totalShifts: items.length,
      technicianCount: new Set(items.map((s) => s.technicianId)).size,
      leaveCount: items.filter((s) => s.status === 'ON_LEAVE').length,
      nightShiftCount: items.filter((s) => s.shift === 'NIGHT').length,
      weekendShiftCount: items.filter((s) => s.shift === 'WEEKEND').length,
      backupShiftCount: items.filter((s) => s.shift === 'BACKUP').length,
      confirmedCount: items.filter((s) => s.status === 'CONFIRMED').length,
      swappedCount: items.filter((s) => s.status === 'SWAPPED').length,
      byTechnician,
      byShift,
    });
  }),

  http.get(`${API_BASE}/tech-schedules/meta`, async () => {
    await delay(delayMs());
    return ok({ technicians: TECH_ROSTER, rooms: ROOMS });
  }),

  http.post(`${API_BASE}/tech-schedules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? '')) || !String(body.technicianId ?? '').trim() || !SHIFT_LABELS[body.shift as TechShift]) {
      return fail('date/technicianId/shift 校验失败', 400);
    }
    if (schedules.some((s) => s.date === body.date && s.technicianId === body.technicianId)) {
      return fail(`${techName(body.technicianId)} 在 ${body.date} 已有排班`, 400);
    }
    const room = roomOf(body.roomId);
    const now = new Date().toISOString();
    const item: TechScheduleItem = {
      id: `TS-${Date.now()}`,
      date: body.date,
      shift: body.shift,
      technicianId: body.technicianId,
      technicianName: techName(body.technicianId),
      roomId: room.roomId,
      roomName: room.roomName,
      status: 'SCHEDULED',
      notes: body.notes || null,
      swapReason: null,
      leaveReason: null,
      createdAt: now,
      updatedAt: now,
    };
    schedules.unshift(item);
    return ok(item, 201);
  }),

  http.patch(`${API_BASE}/tech-schedules/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const hit = schedules.find((s) => s.id === params.id);
    if (!hit) return fail(`排班 ${params.id} 不存在`, 404);
    if (body) {
      if (body.date !== undefined) hit.date = String(body.date);
      if (body.shift !== undefined) hit.shift = body.shift;
      if (body.technicianId !== undefined) {
        hit.technicianId = String(body.technicianId);
        hit.technicianName = techName(String(body.technicianId));
      }
      if (body.roomId !== undefined) {
        const room = roomOf(body.roomId);
        hit.roomId = room.roomId;
        hit.roomName = room.roomName;
      }
      if (body.notes !== undefined) hit.notes = body.notes;
    }
    hit.updatedAt = new Date().toISOString();
    return ok(hit);
  }),

  http.delete(`${API_BASE}/tech-schedules/:id`, async ({ params }) => {
    await delay(delayMs());
    const idx = schedules.findIndex((s) => s.id === params.id);
    if (idx < 0) return fail(`排班 ${params.id} 不存在`, 404);
    schedules.splice(idx, 1);
    return ok({});
  }),

  http.post(`${API_BASE}/tech-schedules/:id/confirm`, async ({ params }) => {
    await delay(delayMs());
    const hit = schedules.find((s) => s.id === params.id);
    if (!hit) return fail(`排班 ${params.id} 不存在`, 404);
    if (hit.status === 'ON_LEAVE') return fail('已请假班次不可确认', 400);
    hit.status = 'CONFIRMED';
    hit.updatedAt = new Date().toISOString();
    return ok(hit);
  }),

  http.post(`${API_BASE}/tech-schedules/:id/swap`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const source = schedules.find((s) => s.id === params.id);
    if (!source) return fail(`排班 ${params.id} 不存在`, 404);
    let target = body?.targetId ? schedules.find((s) => s.id === body.targetId) : undefined;
    if (!target && body?.targetTechId) {
      target = schedules.find((s) => s.technicianId === body.targetTechId && s.date === source.date);
    }
    if (!target) return fail('targetId 或 targetTechId 必填/无匹配排班', 400);
    if (target.id === source.id) return fail('不能与自己换班', 400);
    const reason = body?.reason || '双方协商换班';
    const srcTechId = source.technicianId;
    const srcTechName = source.technicianName;
    source.technicianId = target.technicianId;
    source.technicianName = target.technicianName;
    target.technicianId = srcTechId;
    target.technicianName = srcTechName;
    source.status = 'SWAPPED';
    target.status = 'SWAPPED';
    source.swapReason = reason;
    target.swapReason = reason;
    source.updatedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    return ok({ source, target });
  }),

  http.post(`${API_BASE}/tech-schedules/:id/leave`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !String(body.reason ?? '').trim()) return fail('reason 必填', 400);
    const hit = schedules.find((s) => s.id === params.id);
    if (!hit) return fail(`排班 ${params.id} 不存在`, 404);
    if (hit.status === 'ON_LEAVE') return fail('该班次已在请假状态', 400);
    hit.status = 'ON_LEAVE';
    hit.leaveReason = String(body.reason).trim();
    hit.updatedAt = new Date().toISOString();
    return ok(hit);
  }),

  http.post(`${API_BASE}/tech-schedules/batch-create`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.startDate ?? '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.endDate ?? '')) || !Array.isArray(body.shiftPattern) || body.shiftPattern.length === 0) {
      return fail('startDate/endDate/shiftPattern 校验失败', 400);
    }
    if (!(body.shiftPattern as string[]).every((s) => SHIFT_LABELS[s as TechShift])) return fail('shiftPattern 含非法班次', 400);
    const start = new Date(body.startDate + 'T00:00:00');
    const end = new Date(body.endDate + 'T00:00:00');
    if (start.getTime() > end.getTime()) return fail('startDate 不能晚于 endDate', 400);
    const now = new Date().toISOString();
    const created: TechScheduleItem[] = [];
    let idx = 0;
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const date = cursor.toISOString().slice(0, 10);
      body.shiftPattern.forEach((shift: TechShift, p: number) => {
        const tech = TECH_ROSTER[(idx + p * 2) % TECH_ROSTER.length]!;
        if (schedules.some((s) => s.date === date && s.technicianId === tech.id)) return;
        const room = ROOMS[(idx + p) % ROOMS.length]!;
        const item: TechScheduleItem = {
          id: `TS-${Date.now()}-${idx}-${p}`,
          date,
          shift,
          technicianId: tech.id,
          technicianName: tech.name,
          roomId: room.id,
          roomName: room.name,
          status: 'SCHEDULED',
          notes: null,
          swapReason: null,
          leaveReason: null,
          createdAt: now,
          updatedAt: now,
        };
        schedules.push(item);
        created.push(item);
      });
      cursor.setDate(cursor.getDate() + 1);
      idx++;
    }
    return ok({ created, count: created.length }, 201);
  }),
];

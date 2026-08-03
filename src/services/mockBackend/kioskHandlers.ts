// [Phase 2] /api/v1/kiosk MSW handlers — 自助签到机
import { http, HttpResponse, delay } from 'msw';
import { list } from './store';

const API = '/api/v1/kiosk';

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min);

// 兜底患者数据（store 无 idCard 时使用）
const FALLBACK_PATIENTS = [
  { id: 'P001', name: '张三', idCard: '310101196805121234', exams: [{ id: 'E001', name: '胸部CT平扫' }] },
  { id: 'P002', name: '李四', idCard: '310101199003154567', exams: [{ id: 'E002', name: '颅脑MRI平扫' }] },
  { id: 'P003', name: '王五', idCard: '310101197512238901', exams: [{ id: 'E003', name: '腹部彩超' }] },
];

const ROOMS = ['CT-1室', 'CT-2室', 'MR-1室', 'DR-1室', 'US-1室'];

export const kioskHandlers = [
  // 按身份证后4位查询患者与待检项目
  http.get(`${API}/patients`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const last4 = (url.searchParams.get('last4') || '').trim();
    let items: any[] = [];
    try { items = list<any>('patients'); } catch { /* noop */ }
    const candidates = items
      .filter((p: any) => p.idCard && p.idCard.endsWith(last4))
      .map((p: any) => ({
        patientId: p.id,
        patientName: p.name,
        idCardLast4: last4,
        exams: [{ id: `E${p.id}`, name: p.examItem || '胸部CT平扫' }],
      }));
    if (candidates.length > 0) {
      return HttpResponse.json({ success: true, data: candidates, meta: { total: candidates.length } });
    }
    const fallback = FALLBACK_PATIENTS
      .filter(p => p.idCard.endsWith(last4))
      .map(p => ({ patientId: p.id, patientName: p.name, idCardLast4: last4, exams: p.exams }));
    return HttpResponse.json({ success: true, data: fallback, meta: { total: fallback.length } });
  }),

  // 报到：生成排队号
  http.post(`${API}/check-in`, async ({ request }) => {
    await delay(delayMs(100, 250));
    const body = (await request.json()) as any;
    const seq = 100 + Math.floor(Math.random() * 400);
    const roomName = ROOMS[Math.floor(Math.random() * ROOMS.length)];
    return HttpResponse.json({
      success: true,
      data: {
        patientId: body?.patientId,
        patientName: body?.patientName || '患者',
        examItemId: body?.examItemId,
        queueNumber: `A${String(seq).padStart(3, '0')}`,
        estimatedWaitMinutes: 10 + Math.floor(Math.random() * 25),
        roomName,
        checkedInAt: new Date().toISOString(),
      },
    });
  }),

  // 今日报到统计
  http.get(`${API}/today-stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        todayCount: 128 + Math.floor(Math.random() * 60),
        waitingCount: 12 + Math.floor(Math.random() * 20),
        avgWaitMinutes: 15 + Math.floor(Math.random() * 10),
        activeRooms: ROOMS.length,
      },
    });
  }),
];

// [Phase 2] /api/v1/screening MSW handlers — 早癌筛查队列 + 统计
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/screening';

const delayMs = (min = 60, max = 200) => Math.floor(Math.random() * (max - min) + min);

const SCREEN_TYPES = ['LDCT', 'MG', '乳腺超声', '消化道'];
const STATUSES = ['已登记', '筛查中', '已完成', '异常', '待审核'];
const NAMES = [
  '王秀兰', '李建国', '张桂英', '刘志明', '陈丽娟', '杨文华', '赵德福', '黄秀云',
  '周小刚', '吴翠花', '徐志远', '孙丽芳', '马金龙', '朱秀英', '胡金生', '郭彩霞',
  '林国强', '何春梅', '高建波', '罗素芳', '郑成文', '梁晓燕', '宋立功', '唐桂英',
];
const INSTITUTIONS = [
  '山东省立医院影像科', '河南省人民医院放射科', '华西医院放射科', '广东省人民医院影像科',
  '南京鼓楼医院放射科', '浙大一院影像科', '湘雅医院影像科', '西京医院放射科',
];

let QUEUE: any[] = Array.from({ length: 48 }, (_, i) => {
  const status = STATUSES[i % STATUSES.length];
  const type = SCREEN_TYPES[i % SCREEN_TYPES.length];
  const date = new Date(Date.UTC(2026, 3 + (i % 6), 5 + (i % 20)));
  return {
    id: `SC-${String(1000 + i)}`,
    examId: `E2026${String(5000 + i)}`,
    patientId: `P2026${String(1000 + i)}`,
    patientName: NAMES[i % NAMES.length],
    age: 35 + ((i * 7) % 45),
    gender: i % 2 === 0 ? '女' : '男',
    phone: `138${String(1000 + i).padStart(4, '0')}`,
    screenType: type,
    screenDate: date.toISOString().slice(0, 10),
    status,
    result: status === '已完成' ? (i % 3 === 0 ? '阳性' : '阴性') : status === '异常' ? '需进一步检查' : '-',
    rads: i % 7 === 0 ? (type === 'LDCT' ? 'Lung-RADS 4A' : 'BI-RADS 4A') : i % 9 === 0 ? 'Lung-RADS 3' : '-',
    institution: INSTITUTIONS[i % INSTITUTIONS.length],
    markDoctor: status === '已完成' ? `张${['伟', '磊', '涛', '勇'][i % 4]}医生` : '-',
    markedAt: status === '已完成' ? date.toISOString() : undefined,
  };
});

const STATS = {
  ldctCount: 8642,
  breastCount: 5826,
  highRiskCount: 1284,
  earlyCancerCount: 326,
  birads4Plus: 412,
  monthlyNew: 628,
};

export const screeningHandlers = [
  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: STATS });
  }),

  http.get(`${API}/queue`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('screenType');
    const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
    let items = QUEUE;
    if (status && status !== '全部') items = items.filter(i => i.status === status);
    if (type && type !== '全部') items = items.filter(i => i.screenType === type);
    if (keyword) {
      items = items.filter(i =>
        i.patientName.toLowerCase().includes(keyword) ||
        i.patientId.toLowerCase().includes(keyword) ||
        i.examId.toLowerCase().includes(keyword),
      );
    }
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  // 筛查标记（把检查标记为某类筛查并记录）
  http.post(`${API}/queue/:id/mark`, async ({ params, request }) => {
    await delay(delayMs(80, 200));
    const body = (await request.json()) as any;
    const item = QUEUE.find(q => q.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    item.status = '筛查中';
    item.screenType = body?.screenType || item.screenType;
    item.markDoctor = body?.doctor || item.markDoctor;
    item.markedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: item });
  }),

  // 更新状态（完成/异常）
  http.post(`${API}/queue/:id/status`, async ({ params, request }) => {
    await delay(delayMs(80, 200));
    const body = (await request.json()) as any;
    const item = QUEUE.find(q => q.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    item.status = body?.status || item.status;
    if (body?.status === '已完成') {
      item.result = body?.result || (Math.random() > 0.6 ? '阳性' : '阴性');
      item.rads = body?.result === '阳性' ? 'Lung-RADS 4A' : 'Lung-RADS 2';
    }
    return HttpResponse.json({ success: true, data: item });
  }),

  // 月度趋势（统计图）
  http.get(`${API}/trend`, async () => {
    await delay(delayMs());
    const months = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    return HttpResponse.json({
      success: true,
      data: months.map((month, i) => ({
        month,
        screenings: 580 + i * 55 + Math.floor(Math.random() * 40),
        detections: 15 + i * 2 + Math.floor(Math.random() * 4),
        rate: Number((2.8 + i * 0.06).toFixed(2)),
      })),
    });
  }),

  // 生成新筛查任务
  http.post(`${API}/queue`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = {
      id: `SC-${uuidv4().slice(0, 8).toUpperCase()}`,
      examId: `E2026${String(9000 + QUEUE.length)}`,
      patientId: `P2026${String(9000 + QUEUE.length)}`,
      patientName: body?.patientName || '新筛查患者',
      age: body?.age || 50,
      gender: body?.gender || '女',
      phone: body?.phone || '',
      screenType: body?.screenType || 'LDCT',
      screenDate: new Date().toISOString().slice(0, 10),
      status: '已登记',
      result: '-',
      rads: '-',
      institution: body?.institution || '本院放射科',
      markDoctor: '-',
    };
    QUEUE = [item, ...QUEUE];
    return HttpResponse.json({ success: true, data: item });
  }),
];

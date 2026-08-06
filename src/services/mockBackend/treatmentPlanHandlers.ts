// [W3-2] 跨科室治疗计划 MSW handlers (/api/v1/treatment-plans/*)
// 页面: /treatment-plans (TreatmentPlanCenterPage)
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/treatment-plans';

const STATUS_FLOW = ['planned', 'in_progress', 'completed'] as const;

let plans: any[] = [
  {
    id: 'PLAN-001',
    patientId: 'P100001',
    patient: '张伟',
    type: '种植',
    status: 'in_progress',
    progress: 0.6,
    department: '口腔科→放射科',
    startDate: '2026-06-20',
    desc: '36 位种植体植入 (Straumann BLT 4.1×10mm)',
    outcome: '待 CBCT 复核',
    timeline: [
      { step: '口腔科初诊', date: '2026-06-20', status: 'completed' },
      { step: '转诊放射科 CBCT', date: '2026-06-21', status: 'completed' },
      { step: '种植规划 (导板设计)', date: '2026-06-22', status: 'in_progress' },
      { step: '手术日', date: '2026-06-28', status: 'pending' },
      { step: '术后复查 CBCT', date: '2026-07-05', status: 'pending' },
    ],
    createdAt: '2026-06-20T08:00:00.000Z',
    updatedAt: '2026-06-22T10:00:00.000Z',
  },
  {
    id: 'PLAN-002',
    patientId: 'P100002',
    patient: '李娜',
    type: '根管治疗',
    status: 'completed',
    progress: 1,
    department: '口腔科',
    startDate: '2026-06-15',
    desc: '16 位根管治疗 (根管预备 + 充填)',
    outcome: '已完成, 建议全冠修复',
    timeline: [
      { step: '口腔科初诊', date: '2026-06-15', status: 'completed' },
      { step: '根管预备', date: '2026-06-16', status: 'completed' },
      { step: '根管充填', date: '2026-06-18', status: 'completed' },
      { step: '复查评估', date: '2026-07-10', status: 'pending' },
    ],
    createdAt: '2026-06-15T09:00:00.000Z',
    updatedAt: '2026-06-18T15:00:00.000Z',
  },
  {
    id: 'PLAN-003',
    patientId: 'P100003',
    patient: '王芳',
    type: '正畸-正颌',
    status: 'planned',
    progress: 0.2,
    department: '口腔科→放射科→口腔外科',
    startDate: '2026-07-01',
    desc: '下颌前突正畸-正颌联合治疗',
    outcome: '头影测量分析中',
    timeline: [
      { step: '口腔科初诊', date: '2026-07-01', status: 'completed' },
      { step: '头影测量分析', date: '2026-07-05', status: 'in_progress' },
      { step: '正颌手术规划', date: '2026-07-20', status: 'pending' },
      { step: '术后复查', date: '2026-09-01', status: 'pending' },
    ],
    createdAt: '2026-07-01T08:30:00.000Z',
    updatedAt: '2026-07-05T11:00:00.000Z',
  },
];

const today = () => new Date().toISOString().slice(0, 10);

export const treatmentPlanHandlers = [
  http.get(`${API}`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: [...plans].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  }),

  http.post(`${API}`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as any;
    const now = new Date().toISOString();
    const plan = {
      id: `PLAN-${String(plans.length + 1).padStart(3, '0')}`,
      patientId: body.patientId || `P${Date.now()}`,
      patient: body.patient || '待定患者',
      type: body.type || '综合治疗',
      status: 'planned',
      progress: 0,
      department: Array.isArray(body.departments) ? body.departments.join('→') : (body.department || '口腔科'),
      startDate: body.startDate || today(),
      desc: body.desc || '',
      outcome: body.outcome || '',
      timeline: body.timeline ?? [{ step: '初诊规划', date: body.startDate || today(), status: 'completed' }],
      createdAt: now,
      updatedAt: now,
    };
    plans.unshift(plan);
    return HttpResponse.json({ success: true, data: plan }, { status: 201 });
  }),

  http.patch(`${API}/:id`, async ({ params, request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const plan = plans.find((p) => p.id === params.id);
    if (!plan) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    Object.assign(plan, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: plan });
  }),

  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(60);
    const idx = plans.findIndex((p) => p.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    plans.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/:id/transition`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as { status?: string };
    const plan = plans.find((p) => p.id === params.id);
    if (!plan) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const next = body.status && STATUS_FLOW.includes(body.status as never) ? body.status : 'in_progress';
    plan.status = next;
    plan.progress = next === 'completed' ? 1 : next === 'in_progress' ? Math.max(plan.progress, 0.4) : plan.progress;
    plan.updatedAt = new Date().toISOString();
    if (next === 'completed' && !plan.outcome) plan.outcome = '治疗已完成, 建议随访复查';
    return HttpResponse.json({ success: true, data: plan });
  }),

  http.get(`${API}/:id/timeline`, async ({ params }) => {
    await delay(50);
    const plan = plans.find((p) => p.id === params.id);
    if (!plan) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: plan.timeline ?? [] });
  }),
];

export default treatmentPlanHandlers;

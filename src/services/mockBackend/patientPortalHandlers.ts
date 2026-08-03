// [v3.0.6.11-7] /api/v1/patient-portal MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/patient-portal';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

// [Phase 2] 患者宣教资料库（含视频/音频/图文）
const EDUCATION_MATERIALS = [
  {
    id: 'ED001', title: 'CT检查注意事项', category: 'pre_exam', modality: 'CT', bodyPart: '胸部',
    contentType: 'video', duration: 96,
    content: 'CT检查前需去除金属物品，检查前4小时禁食；如有造影剂过敏史请提前告知医生。检查过程中请保持体位不动，听从技师口令屏气。',
    summary: 'CT检查前的准备工作和注意事项',
    tags: ['CT', '检查准备', '造影剂'], language: 'zh-CN', createdAt: '2026-05-01', updatedAt: '2026-06-10',
  },
  {
    id: 'ED002', title: 'MRI检查安全须知', category: 'pre_exam', modality: 'MR', bodyPart: '颅脑',
    contentType: 'video', duration: 128,
    content: 'MRI检查安全须知：1. 去除所有金属物品；2. 体内有金属植入物请提前告知；3. 检查过程噪音较大，请勿紧张；4. 检查约需20-30分钟。',
    summary: 'MRI检查安全性指南',
    tags: ['MRI', '安全', '金属植入物'], language: 'zh-CN', createdAt: '2026-04-01', updatedAt: '2026-06-05',
  },
  {
    id: 'ED003', title: '造影剂使用说明', category: 'medication', modality: 'CT',
    contentType: 'text',
    content: '造影剂使用说明：1. 碘造影剂可能引起过敏反应；2. 检查后多饮水促进排出（24小时内饮水≥2000ml）；3. 如有不适及时告知医护人员。',
    summary: '造影剂相关知识',
    tags: ['造影剂', '过敏', '安全'], language: 'zh-CN', createdAt: '2026-03-10', updatedAt: '2026-05-20',
  },
  {
    id: 'ED004', title: '检查报告解读指南', category: 'post_exam',
    contentType: 'video', duration: 152,
    content: '如何理解您的影像报告：1. 检查描述部分记录影像所见；2. 诊断意见是医生的综合判断；3. 如有疑问请咨询临床医生；4. 电子报告与纸质报告具有同等效力。',
    summary: '帮助患者理解影像报告',
    tags: ['报告', '解读', '教育'], language: 'zh-CN', createdAt: '2026-02-05', updatedAt: '2026-05-15',
  },
  {
    id: 'ED005', title: '肺结节随访管理', category: 'condition', modality: 'CT', bodyPart: '胸部',
    contentType: 'audio', duration: 220,
    content: '肺结节的随访管理：根据结节大小与密度制定随访计划；Lung-RADS 1-2类建议定期随访；坚持戒烟与定期复查对预后至关重要。',
    summary: '肺结节患者的随访知识',
    tags: ['肺结节', '随访', 'LDCT'], language: 'zh-CN', createdAt: '2026-01-12', updatedAt: '2026-04-18',
  },
  {
    id: 'ED006', title: '乳腺钼靶检查须知', category: 'pre_exam', modality: 'MG', bodyPart: '乳腺',
    contentType: 'video', duration: 84,
    content: '乳腺钼靶检查须知：避开月经期检查；检查时需配合技师摆位；轻度挤压为正常现象，请勿紧张；如佩戴首饰请提前摘除。',
    summary: '乳腺钼靶检查流程与注意事项',
    tags: ['钼靶', '乳腺', '检查准备'], language: 'zh-CN', createdAt: '2026-01-20', updatedAt: '2026-04-22',
  },
  {
    id: 'ED007', title: '骨密度检查科普', category: 'general', modality: 'DR',
    contentType: 'audio', duration: 180,
    content: '骨密度检查用于评估骨质疏松风险，主要适用于绝经后女性、老年人及长期服用激素人群，检查无创、低剂量、过程约15分钟。',
    summary: '骨密度检查适用人群与流程',
    tags: ['骨密度', '骨质疏松', 'DR'], language: 'zh-CN', createdAt: '2025-12-01', updatedAt: '2026-03-30',
  },
  {
    id: 'ED008', title: '儿童影像检查注意事项', category: 'general',
    contentType: 'text',
    content: '儿童影像检查注意事项：家长需陪同并在技师指导下配合；部分检查可能需要镇静，请按医嘱执行；检查前请如实告知儿童近况与过敏史。',
    summary: '儿童影像检查家长须知',
    tags: ['儿童', '安全', '家长'], language: 'zh-CN', createdAt: '2025-11-15', updatedAt: '2026-03-12',
  },
];

export const patientPortalHandlers = [
  http.get(`${API}/patients`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('patients'); } catch {}
    if (!items.length) items = [{"id":"P001","name":"张三","phone":"13800138000"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/patients/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('patient', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/clinical-data`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('data'); } catch {}
    if (!items.length) items = [{"id":"CD001","patientId":"P001","type":"化验","value":"正常"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/education`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('materials'); } catch {}
    if (!items.length) items = EDUCATION_MATERIALS;
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/mobile/patients`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"appVersion":"2.1.0","features":["预约","查询报告"]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/mobile/doctors`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"appVersion":"2.1.0","features":["移动阅片","审批"]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];

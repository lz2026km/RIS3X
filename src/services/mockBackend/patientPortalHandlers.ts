// [v3.0.6.11-7] /api/v1/patient-portal MSW handlers
// [v3.1] 补全: appointments / reports / images / feedback 端点 (G005 患者门户成熟化)
// [v3.0.6.11-79 W2-B] 补全: clinical-data/:id · mobile/doctors·nurses·techs (医护联系方式)
import { http, HttpResponse, delay } from 'msw';
import { list, get, findOne } from './store';
import { parseQuery, applyQuery } from './queryBuilder';

const API = '/api/v1/patient-portal';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

// ===== [W2-B] 临床数据种子 (getClinicalData / listClinicalData) =====
const PORTAL_CLINICAL_DATA_SEED: any[] = [
  {
    id: 'CD001', patientId: 'P001', patientName: '张三', examType: '胸部CT平扫',
    examDate: '2026-07-20', bodyPart: '胸部', modality: 'CT',
    findings: '双肺纹理清晰，未见明显实变影。纵隔结构居中，未见明显肿大淋巴结。心影大小正常。',
    diagnosis: '双肺未见明显异常',
    reportStatus: '已出报告', labValues: 'WBC 6.8×10⁹/L, Hb 142g/L, PLT 210×10⁹/L',
  },
  {
    id: 'CD002', patientId: 'P001', patientName: '张三', examType: '头颅MR平扫',
    examDate: '2026-06-15', bodyPart: '颅脑', modality: 'MR',
    findings: '脑实质内未见明显异常信号灶，脑室系统形态正常，中线结构居中。',
    diagnosis: '头颅MR平扫未见明显异常',
    reportStatus: '已出报告', labValues: '血压 118/76 mmHg, 心率 72 bpm',
  },
  {
    id: 'CD003', patientId: 'P002', patientName: '李四', examType: '腰椎DR正侧位',
    examDate: '2026-07-08', bodyPart: '腰椎', modality: 'DR',
    findings: '腰椎生理曲度存在，各椎体形态规整，椎间隙未见明显变窄。',
    diagnosis: '腰椎DR未见明显异常',
    reportStatus: '已出报告', labValues: '血常规正常',
  },
  {
    id: 'CD004', patientId: 'P001', patientName: '张三', examType: '空腹血糖',
    examDate: '2026-07-21', bodyPart: '实验室', modality: 'LIS',
    findings: '空腹血糖 5.2 mmol/L，血脂四项均在参考范围。',
    diagnosis: '未见明显异常',
    reportStatus: '已出报告', labValues: 'FPG 5.2 mmol/L, TC 4.3 mmol/L, TG 1.4 mmol/L',
  },
];

// ===== [W2-B] 医护联系方式种子 (getDoctorMobile / getNurseMobile / getTechMobile) =====
const PORTAL_DOCTORS_SEED: any[] = [
  { id: 'D001', name: '张建国', role: 'DOCTOR', title: '放射科主任', department: '放射科', phone: '13801010001' },
  { id: 'D002', name: '李晓梅', role: 'DOCTOR', title: '副主任医师', department: '放射科', phone: '13801010002' },
  { id: 'D003', name: '王海峰', role: 'DOCTOR', title: '主治医师', department: '放射科', phone: '13801010003' },
];

const PORTAL_NURSES_SEED: any[] = [
  { id: 'N001', name: '陈丽', role: 'NURSE', title: '主管护师', department: '放射科', phone: '13801020001' },
  { id: 'N002', name: '杨雪', role: 'NURSE', title: '护师', department: '放射科', phone: '13801020002' },
];

const PORTAL_TECHS_SEED: any[] = [
  { id: 'T001', name: '赵丽华', role: 'TECHNICIAN', title: '主管技师', department: 'CT组', phone: '13801030001' },
  { id: 'T002', name: '刘涛', role: 'TECHNICIAN', title: '技师', department: 'MR组', phone: '13801030002' },
  { id: 'T003', name: '周强', role: 'TECHNICIAN', title: '技师', department: 'DR组', phone: '13801030003' },
];

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

// ===== [v3.1] 患者门户种子数据 (无数据时可演示) =====

const PORTAL_APPOINTMENTS_SEED: any[] = [
  { id: 'AP-P001-001', patientId: 'P001', patientName: '张三', modality: 'CT', bodyPart: '胸部', scheduledAt: '2026-08-04T09:00:00+08:00', state: 'CONFIRMED', createdAt: '2026-07-28T10:12:00+08:00' },
  { id: 'AP-P001-002', patientId: 'P001', patientName: '张三', modality: 'MR', bodyPart: '颅脑', scheduledAt: '2026-08-05T14:30:00+08:00', state: 'SCHEDULED', createdAt: '2026-07-29T09:30:00+08:00' },
  { id: 'AP-P001-003', patientId: 'P001', patientName: '张三', modality: 'DR', bodyPart: '胸部', scheduledAt: '2026-08-06T10:00:00+08:00', state: 'SCHEDULED', createdAt: '2026-07-30T15:40:00+08:00' },
  { id: 'AP-P002-001', patientId: 'P002', patientName: '李四', modality: 'DR', bodyPart: '腰椎', scheduledAt: '2026-08-04T10:30:00+08:00', state: 'CHECKED_IN', createdAt: '2026-07-25T11:20:00+08:00' },
];

const PORTAL_REPORTS_SEED: any[] = [
  {
    id: 'RPT-P001-001', patientId: 'P001', patientName: '张三', modality: 'CT', bodyPart: '胸部',
    examDate: '2026-07-20T10:00:00+08:00', state: 'PUBLISHED', signedAt: '2026-07-20T15:32:00+08:00',
    findings: '双肺纹理清晰，未见明显实变影。纵隔结构居中，未见明显肿大淋巴结。心影大小正常。',
    diagnosis: '双肺未见明显异常',
    impression: '胸部CT平扫未见明显异常。',
    recommendations: '建议保持健康生活方式，定期体检随访。',
    conclusion: '未见明显异常',
    isCritical: false,
  },
  {
    id: 'RPT-P001-002', patientId: 'P001', patientName: '张三', modality: 'MR', bodyPart: '颅脑',
    examDate: '2026-06-15T09:30:00+08:00', state: 'PUBLISHED', signedAt: '2026-06-15T17:20:00+08:00',
    findings: '脑实质内未见明显异常信号灶，脑室系统形态正常，中线结构居中，脑沟脑回无异常。',
    diagnosis: '头颅MR平扫未见明显异常',
    impression: '头颅MR平扫未见明显异常。',
    recommendations: '无明显异常，如症状持续建议神经内科门诊随访。',
    conclusion: '未见明显异常',
    isCritical: false,
  },
  {
    id: 'RPT-P001-003', patientId: 'P001', patientName: '张三', modality: 'CT', bodyPart: '胸部',
    examDate: '2026-03-18T09:40:00+08:00', state: 'PUBLISHED', signedAt: '2026-03-18T15:10:00+08:00',
    findings: '右肺上叶见磨玻璃样结节影，大小约 8mm，边界较清晰。余双肺纹理清晰，未见实变。纵隔未见明显肿大淋巴结。',
    diagnosis: '右肺上叶磨玻璃结节，建议随访',
    impression: '右肺上叶磨玻璃样结节（约8mm），较前无明显变化，建议定期随访。',
    recommendations: '建议 6-12 个月后复查胸部CT动态观察。',
    conclusion: '右肺上叶GGO，建议随访',
    isCritical: false,
  },
  {
    id: 'RPT-P002-001', patientId: 'P002', patientName: '李四', modality: 'DR', bodyPart: '腰椎',
    examDate: '2026-07-08T11:00:00+08:00', state: 'PUBLISHED', signedAt: '2026-07-08T16:45:00+08:00',
    findings: '腰椎生理曲度存在，各椎体形态规整，椎间隙未见明显变窄。',
    diagnosis: '腰椎DR未见明显异常',
    impression: '腰椎正侧位片未见明显异常。',
    recommendations: '建议避免久坐，加强腰背肌锻炼。',
    conclusion: '未见明显异常',
    isCritical: false,
  },
];

const PORTAL_STUDY_SEED = (studyUid: string) => ({
  studyInstanceUid: studyUid,
  studyDate: '2026-07-20T10:00:00+08:00',
  modality: 'CT',
  description: '胸部平扫',
  series: [
    {
      seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202607201000001',
      modality: 'CT',
      seriesNumber: 2,
      instanceCount: 120,
      wadoRs: {
        instances: `/dicom-web/studies/${studyUid}/series/1.2.826.0.1.3680043.8.498.202607201000001/instances`,
      },
    },
    {
      seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202607201000002',
      modality: 'CT',
      seriesNumber: 3,
      instanceCount: 1,
      wadoRs: {
        instances: `/dicom-web/studies/${studyUid}/series/1.2.826.0.1.3680043.8.498.202607201000002/instances`,
      },
    },
  ],
  wadoRs: { study: `/dicom-web/studies/${studyUid}` },
});

// 内存态: 会话内创建/提交的数据
let portalAppointments: any[] = [...PORTAL_APPOINTMENTS_SEED];
let portalFeedback: any[] = [];
// [W5] 宣教资料库可变副本 (POST/DELETE /education 会话内生效)
let portalEducation: any[] = [...EDUCATION_MATERIALS];

const lookupPatientName = (patientId: string): string | undefined => {
  try {
    return findOne<any>('patients', p => p.id === patientId)?.name;
  } catch {
    return undefined;
  }
};

export const patientPortalHandlers = [
  http.get(`${API}/patients`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('patients'); } catch {}
    if (!items.some((p: any) => p.phone === '13800138000' || p.id === 'P001')) {
      items = [{
        id: 'P001', name: '张三', gender: '男', age: 45, birthDate: '1981-03-12',
        phone: '13800138000', idNumber: '110101198103121234', createdAt: '2025-09-01T10:00:00+08:00',
      }, ...items];
    }
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/patients/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('patients', params.id as string); } catch {}
    if (!item && (params.id === 'P001' || params.id === 'current')) {
      item = {
        id: 'P001', name: '张三', gender: '男', age: 45, birthDate: '1981-03-12',
        phone: '13800138000', idNumber: '110101198103121234', createdAt: '2025-09-01T10:00:00+08:00',
      };
    }
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/clinical-data`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = PORTAL_CLINICAL_DATA_SEED;
    const patientId = url.searchParams.get('patientId');
    if (patientId) items = items.filter(d => d.patientId === patientId);
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  // ===== [W2-B] 临床数据详情 (患者门户 Drawer) =====
  http.get(`${API}/clinical-data/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = PORTAL_CLINICAL_DATA_SEED.find(d => d.id === params.id);
    if (!item) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `临床数据不存在: ${params.id}` } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/education`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const items = portalEducation.map(m => ({ ...m, key: m.key ?? m.id }));
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  // [W5] 宣教资料创建 (后端 POST /patient-portal/education → education_<key> SystemConfig)
  http.post(`${API}/education`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body.title !== 'string' || !body.title.trim() || typeof body.content !== 'string' || !body.content.trim()) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'title / content 为必填字段' } },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    const key = `education_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: any = {
      id: key,
      key,
      title: body.title,
      category: body.category ?? 'general',
      contentType: body.contentType ?? 'text',
      content: body.content,
      summary: body.summary ?? '',
      modality: body.modality,
      bodyPart: body.bodyPart,
      duration: body.duration,
      tags: body.tags ?? [],
      language: body.language ?? 'zh-CN',
      createdAt: now,
      updatedAt: now,
    };
    portalEducation = [record, ...portalEducation];
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  // [W5] 宣教资料删除
  http.delete(`${API}/education/:key`, async ({ params }) => {
    await delay(delayMs());
    const key = params.key as string;
    const before = portalEducation.length;
    portalEducation = portalEducation.filter(m => (m.key ?? m.id) !== key);
    if (portalEducation.length === before) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `宣教资料不存在: ${key}` } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: { deleted: true, key } });
  }),

  // ===== [v3.1] 患者预约列表 =====
  http.get(`${API}/appointments`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    let items: any[] = portalAppointments;
    if (patientId) items = items.filter(a => a.patientId === patientId);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  // ===== [v3.1] 自助预约创建 =====
  http.post(`${API}/appointments`, async ({ request }) => {
    await delay(delayMs());
    const body = await request.json().catch(() => null) as any;
    if (!body || !body.patientId || !body.modality || !body.scheduledAt) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'patientId/modality/scheduledAt 为必填字段' } },
        { status: 400 },
      );
    }
    const appt: any = {
      id: `AP-${body.patientId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      patientId: body.patientId,
      patientName: body.patientName || lookupPatientName(body.patientId) || '演示患者',
      modality: body.modality,
      bodyPart: body.bodyPart,
      scheduledAt: body.scheduledAt,
      state: 'SCHEDULED',
      createdAt: new Date().toISOString(),
    };
    portalAppointments = [appt, ...portalAppointments];
    return HttpResponse.json({ success: true, data: appt, meta: { total: portalAppointments.length } }, { status: 201 });
  }),

  // ===== [v3.1] 患者报告列表 =====
  http.get(`${API}/reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    let items: any[] = PORTAL_REPORTS_SEED;
    if (patientId) items = items.filter(r => r.patientId === patientId);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  // ===== [v3.1] 报告详情 =====
  http.get(`${API}/reports/:id`, async ({ params }) => {
    await delay(delayMs());
    const id = params.id as string;
    const report = PORTAL_REPORTS_SEED.find(r => r.id === id);
    if (!report) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: report });
  }),

  // ===== [v3.1] 影像查看 (检查列表 + WADO-RS 引用) =====
  http.get(`${API}/images/:studyUid`, async ({ params }) => {
    await delay(delayMs());
    const studyUid = decodeURIComponent(params.studyUid as string);
    return HttpResponse.json({ success: true, data: PORTAL_STUDY_SEED(studyUid) });
  }),

  // ===== [v3.1] 满意度反馈 =====
  http.post(`${API}/feedback`, async ({ request }) => {
    await delay(delayMs());
    const body = await request.json().catch(() => null) as any;
    const rating = body?.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'rating 必须为 1-5 的整数' } },
        { status: 400 },
      );
    }
    const record: any = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      patientId: body?.patientId,
      patientName: body?.patientName || (body?.patientId ? lookupPatientName(body.patientId) : undefined),
      rating,
      category: body?.category || 'general',
      comment: body?.comment || '',
      createdAt: new Date().toISOString(),
    };
    portalFeedback = [record, ...portalFeedback];
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  // ===== [v3.1] 患者档案(登录会话) =====
  // [G005 W1-C] /user/:id · /exam-history* · /voucher 后端无对应端点, 已移除对应 MSW handler
  // 档案改用 GET /patients/:id, 检查记录改用 GET /clinical-data, 影像统一 GET /images/:studyUid
  http.get(`${API}/mobile/patients`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: PORTAL_CLINICAL_DATA_SEED.map(() => ({ id: 'P001', name: '张三', phone: '13800138000' })) });
  }),

  // ===== [W2-B] 医护联系方式 (医生/护士/技师) =====
  http.get(`${API}/mobile/doctors`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: PORTAL_DOCTORS_SEED });
  }),
  http.get(`${API}/mobile/nurses`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: PORTAL_NURSES_SEED });
  }),
  http.get(`${API}/mobile/techs`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: PORTAL_TECHS_SEED });
  }),
];

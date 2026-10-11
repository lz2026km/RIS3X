// [W3-2] 跨科室治疗计划 MSW handlers (/api/v1/treatment-plans/*)
// 页面: /treatment-plans (TreatmentPlanCenterPage)
// [G005 demo-data] 20 条计划种子 (CT/MR/PET-CT): 患者 ← PATIENT_MASTER, index report ← store.list('exams'),
//   每条 3-6 个随访时间点 + 实测病灶径线, 状态 计划中/进行中/已完成/中断
import { http, HttpResponse, delay } from 'msw';
import { list } from './store';
import { PATIENT_MASTER, PATIENT_BY_ID } from '../../data/master';
import { EXAM_REPORT_PRE } from '../../data/_generators';

const API = '/api/v1/treatment-plans';

const STATUS_FLOW = ['planned', 'in_progress', 'completed'] as const;

type PlanSeedStatus = 'planned' | 'in_progress' | 'completed' | 'interrupted';
type FollowUpStatus = 'completed' | 'in_progress' | 'pending';

interface SeedExamRef {
  examId: string;
  reportId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  examItem: string;
  findings: string;
  impression: string;
}

interface PlanLesion {
  id: string;
  name: string;
  site: string;
  baselineLengthMm: number;
  baselineWidthMm: number;
}

interface PlanFollowUp {
  no: number;
  date: string;
  modality: string;
  intervalDays: number;
  status: FollowUpStatus;
  response: 'CR' | 'PR' | 'SD' | 'PD' | null;
  measurements: Array<{ lesionId: string; name: string; lengthMm: number; widthMm: number; changePct: number }>;
  note: string;
}

interface TreatmentPlanSeed {
  id: string;
  patientId: string;
  patient: string;
  type: string;
  status: PlanSeedStatus;
  statusLabel: string;
  progress: number;
  department: string;
  startDate: string;
  desc: string;
  outcome: string;
  modality: string;
  bodyPart: string;
  indexExamId: string;
  indexReportId: string;
  lesions: PlanLesion[];
  followUps: PlanFollowUp[];
  timeline: Array<{ step: string; date: string; status: FollowUpStatus }>;
  createdAt: string;
  updatedAt: string;
}

const PLAN_COUNT = 20;
const DAY_MS = 86400000;

// 状态配比: 计划中 4 / 进行中 6 / 已完成 7 / 中断 3
const PLAN_STATUS_PATTERN: PlanSeedStatus[] = [
  'in_progress', 'completed', 'planned', 'interrupted',
  'in_progress', 'completed', 'in_progress', 'planned',
  'completed', 'in_progress', 'completed', 'planned',
  'interrupted', 'in_progress', 'completed', 'planned',
  'completed', 'in_progress', 'interrupted', 'completed',
];

const STATUS_LABEL: Record<PlanSeedStatus, string> = {
  planned: '计划中',
  in_progress: '进行中',
  completed: '已完成',
  interrupted: '中断',
};

const PLAN_TYPE_BY_BODY: Record<string, string> = {
  胸部: '肺部病变根治性放疗',
  腹部: '腹部肿瘤综合治疗',
  全腹: '腹部肿瘤综合治疗',
  头部: '颅脑肿瘤放疗',
  脑部: '颅脑肿瘤放疗',
  盆腔: '盆腔肿瘤放化疗',
  肝脏: '肝癌局部消融/介入',
  脊柱: '脊柱转移灶立体定向放疗',
  颈椎: '颈椎病变序贯治疗',
  腰椎: '腰椎间盘突出微创治疗',
  膝关节: '膝关节运动损伤修复',
  肩关节: '肩袖损伤修复治疗',
  乳腺: '乳腺肿瘤新辅助治疗',
  全身: '全身淋巴瘤疗效评估',
  心脏: '心肌病变综合管理',
  脑垂体: '垂体瘤术后辅助治疗',
  冠脉: '冠脉病变介入治疗',
  肺动脉: '肺栓塞抗凝/溶栓治疗',
  泌尿系: '泌尿系肿瘤根治治疗',
  '冠脉+头颈': '心脑血管病变介入治疗',
};

const DEPT_BY_BODY: Record<string, string> = {
  胸部: '放射科→呼吸科→放疗科',
  腹部: '放射科→消化内科→介入科',
  全腹: '放射科→消化内科→介入科',
  头部: '放射科→神经外科→放疗科',
  脑部: '放射科→神经外科→放疗科',
  盆腔: '放射科→肿瘤内科→放疗科',
  肝脏: '放射科→肝胆外科→介入科',
  脊柱: '放射科→骨科→放疗科',
  颈椎: '放射科→骨科→康复科',
  腰椎: '放射科→骨科→疼痛科',
  膝关节: '放射科→运动医学科',
  肩关节: '放射科→运动医学科',
  乳腺: '放射科→乳腺外科→肿瘤内科',
  全身: '核医学科→肿瘤内科',
  心脏: '放射科→心内科',
  脑垂体: '放射科→神经外科',
  冠脉: '放射科→心内科→介入科',
  肺动脉: '放射科→呼吸科→血管外科',
  泌尿系: '放射科→泌尿外科',
  '冠脉+头颈': '放射科→神经内科→介入科',
};

const LESION_NAMES: Record<string, string[]> = {
  胸部: ['右肺上叶靶病灶', '纵隔淋巴结', '胸膜结节'],
  腹部: ['肝右叶靶病灶', '腹膜后淋巴结', '胰头病灶'],
  全腹: ['肝左叶靶病灶', '肠系膜淋巴结', '网膜结节'],
  头部: ['右侧额叶靶病灶', '左侧基底节病灶', '颈部淋巴结'],
  脑部: ['右侧额叶靶病灶', '左侧顶叶病灶', '小脑病灶'],
  盆腔: ['前列腺靶病灶', '盆腔淋巴结', '直肠壁病灶'],
  肝脏: ['肝右叶靶病灶', '肝左叶病灶', '门静脉癌栓'],
  脊柱: ['胸椎靶病灶', '腰椎病灶', '椎旁软组织病灶'],
  颈椎: ['颈3/4椎间盘突出', '颈5/6椎间盘突出', '椎旁病灶'],
  腰椎: ['腰4/5椎间盘突出', '腰5/骶1椎间盘突出', '椎管内病灶'],
  膝关节: ['外侧半月板损伤区', '前交叉韧带损伤区', '关节软骨缺损区'],
  肩关节: ['冈上肌腱撕裂区', '肩峰下滑囊炎', '关节盂唇损伤区'],
  乳腺: ['左乳外上象限靶病灶', '腋窝淋巴结', '右乳病灶'],
  全身: ['锁骨上淋巴结', '腹主动脉旁淋巴结', '脾脏病灶'],
  心脏: ['左室壁运动异常区', '心包积液', '冠脉斑块区'],
  脑垂体: ['垂体微腺瘤', '鞍区靶病灶', '海绵窦病灶'],
  冠脉: ['左前降支病变', '回旋支病变', '右冠脉病变'],
  肺动脉: ['右肺动脉主干栓子', '左肺动脉栓子', '下肢深静脉血栓'],
  泌尿系: ['左肾上极靶病灶', '右肾病灶', '输尿管壁病灶'],
  '冠脉+头颈': ['左前降支病变', '颈内动脉斑块', '椎动脉狭窄区'],
};

function planTypeOf(bodyPart: string, modality: string): string {
  return PLAN_TYPE_BY_BODY[bodyPart] ?? `${modality} 影像引导治疗`;
}

function normalizeSeedExam(row: unknown): SeedExamRef | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const reportId = String(r.reportId ?? r.id ?? '');
  const patientId = String(r.patientId ?? '');
  if (!reportId || !patientId) return null;
  const person = PATIENT_BY_ID[patientId];
  const patientName = String(r.patientName ?? person?.name ?? '');
  if (!patientName) return null;
  return {
    examId: String(r.id ?? reportId),
    reportId,
    patientId,
    patientName,
    modality: String(r.modality ?? 'CT'),
    bodyPart: String(r.bodyPart ?? '未知'),
    examItem: String(r.examItem ?? ''),
    findings: String(r.findings ?? ''),
    impression: String(r.impression ?? ''),
  };
}

function pickSeedExams(count: number, allowed: string[]): SeedExamRef[] {
  const allow = new Set(allowed);
  const out: SeedExamRef[] = [];
  const used = new Set<string>();
  const push = (row: unknown): void => {
    const normalized = normalizeSeedExam(row);
    if (!normalized || used.has(normalized.reportId)) return;
    used.add(normalized.reportId);
    out.push(normalized);
  };
  let raw: unknown[] = [];
  try { raw = list<unknown>('exams'); } catch { raw = []; }
  const pool = raw.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    return allow.has(String((row as Record<string, unknown>).modality ?? ''));
  });
  if (pool.length > 0) {
    const strideCount = Math.min(count, pool.length);
    const step = pool.length / strideCount;
    for (let i = 0; i < strideCount; i++) push(pool[Math.floor(i * step)]);
  }
  if (out.length < count) for (const row of pool) { if (out.length >= count) break; push(row); }
  if (out.length < count) {
    const seen = new Set(used);
    for (const row of EXAM_REPORT_PRE) {
      if (out.length >= count) break;
      if (allow.has(row.modality) && !seen.has(row.reportId)) push(row);
    }
  }
  if (out.length < count) {
    // store + 生成器同时不可用: PATIENT_MASTER 兜底
    PATIENT_MASTER.forEach((p, i) => {
      if (out.length >= count) return;
      const seq = String(i + 1).padStart(5, '0');
      const reportId = `RPT-FALLBACK-${seq}`;
      if (used.has(reportId)) return;
      used.add(reportId);
      out.push({
        examId: `EXAM-FALLBACK-${seq}`,
        reportId,
        patientId: p.id,
        patientName: p.name,
        modality: allowed[i % allowed.length] ?? 'CT',
        bodyPart: p.bodyPart,
        examItem: p.examItem,
        findings: `${p.bodyPart}检查所见请结合临床。`,
        impression: `${p.bodyPart}检查建议随访或进一步检查。`,
      });
    });
  }
  return out;
}

const dateOnly = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function buildSeedPlans(): TreatmentPlanSeed[] {
  const now = Date.now();
  // 20 条计划按 CT(8) / MR(7) / PET-CT(5) 分模态取真实 index report
  const exams = [
    ...pickSeedExams(8, ['CT']),
    ...pickSeedExams(7, ['MR']),
    ...pickSeedExams(5, ['PET-CT']),
  ];

  return exams.slice(0, PLAN_COUNT).map((exam, i) => {
    const status = PLAN_STATUS_PATTERN[i] ?? 'planned';
    const followUpCount = 3 + (i % 4); // 3-6 个随访时间点
    const intervalDays = 21 + (i % 4) * 7; // 21/28/35/42 天
    const lesionCount = 1 + (i % 3); // 1-3 个靶病灶
    const planId = `PLAN-${String(i + 1).padStart(3, '0')}`;
    const planType = planTypeOf(exam.bodyPart, exam.modality);
    const department = DEPT_BY_BODY[exam.bodyPart] ?? '放射科→相关临床科室';

    const lesionNamePool = LESION_NAMES[exam.bodyPart] ?? [`${exam.bodyPart}靶病灶`, `${exam.bodyPart}淋巴结`];
    const lesions: PlanLesion[] = Array.from({ length: lesionCount }, (_, k) => ({
      id: `${planId}-L${k + 1}`,
      name: lesionNamePool[k % lesionNamePool.length] ?? `${exam.bodyPart}靶病灶 ${k + 1}`,
      site: exam.bodyPart,
      baselineLengthMm: 12 + ((i * 7 + k * 11) % 34), // 12-45 mm
      baselineWidthMm: 10 + ((i * 5 + k * 7) % 28),
    }));

    const doneCount = status === 'completed' ? followUpCount
      : status === 'planned' ? 0
        : status === 'interrupted' ? Math.floor(followUpCount / 2)
          : Math.max(1, Math.floor(followUpCount / 2));

    const startOffsetDays = status === 'planned' ? 5 + (i % 10)
      : status === 'completed' ? followUpCount * intervalDays + 10 + (i % 15)
        : status === 'interrupted' ? Math.max(7, doneCount * intervalDays + 5 + (i % 5))
          : Math.max(7, (doneCount + 1) * intervalDays);
    const startMs = now - startOffsetDays * DAY_MS;
    const updatedAtMs = status === 'completed' ? startMs + followUpCount * intervalDays * DAY_MS + DAY_MS
      : status === 'interrupted' ? startMs + doneCount * intervalDays * DAY_MS + 2 * DAY_MS
        : status === 'in_progress' ? startMs + doneCount * intervalDays * DAY_MS
          : startMs;

    // 疗效靶点: PR 缩小 / SD 稳定 / PD 进展
    const targetPct = (i % 7 === 5) ? 30 : (i % 3 === 0) ? -10 : (i % 3 === 1) ? -38 : -8;

    const followUps: PlanFollowUp[] = Array.from({ length: followUpCount }, (_, k) => {
      const dateMs = startMs + (k + 1) * intervalDays * DAY_MS;
      const fuStatus: FollowUpStatus = k < doneCount ? 'completed'
        : (status === 'in_progress' && k === doneCount) ? 'in_progress'
          : 'pending';
      const basePct = Math.round(targetPct * ((k + 1) / followUpCount));
      const measurements = fuStatus === 'pending' ? [] : lesions.map((lesion, li) => {
        const localPct = basePct + ((i * 3 + k * 5 + li * 7) % 7) - 3;
        return {
          lesionId: lesion.id,
          name: lesion.name,
          lengthMm: Math.max(3, Math.round(lesion.baselineLengthMm * (1 + localPct / 100))),
          widthMm: Math.max(3, Math.round(lesion.baselineWidthMm * (1 + localPct / 100))),
          changePct: localPct,
        };
      });
      let response: PlanFollowUp['response'] = null;
      if (measurements.length > 0) {
        const avgPct = Math.round(measurements.reduce((s, m) => s + m.changePct, 0) / measurements.length);
        response = avgPct <= -95 ? 'CR' : avgPct <= -30 ? 'PR' : avgPct < 20 ? 'SD' : 'PD';
      }
      return {
        no: k + 1,
        date: dateOnly(dateMs),
        modality: exam.modality,
        intervalDays,
        status: fuStatus,
        response,
        measurements,
        note: fuStatus === 'pending' ? '待执行' : `靶病灶${response === 'PD' ? '增大' : response === 'SD' ? '稳定' : '缩小'}, RECIST ${response}`,
      };
    });

    const measured = followUps.filter((f) => f.status !== 'pending');
    const lastMeasured = measured[measured.length - 1];
    const lastPct = lastMeasured?.measurements.length
      ? Math.round(lastMeasured.measurements.reduce((s, m) => s + m.changePct, 0) / lastMeasured.measurements.length)
      : 0;

    const outcome = status === 'completed'
      ? `疗程结束, 疗效评估 ${lastMeasured?.response ?? 'SD'}: 靶病灶较基线${lastPct < 0 ? '缩小' : '增大'} ${Math.abs(lastPct)}%`
      : status === 'in_progress'
        ? `已完成 ${doneCount}/${followUpCount} 次随访, 当前 ${lastMeasured?.response ?? 'SD'}`
        : status === 'interrupted'
          ? `计划中断: 已完成 ${doneCount}/${followUpCount} 次随访, 后续待重启`
          : `待开始首次随访 (计划 ${followUpCount} 次, 间隔 ${intervalDays} 天)`;

    const timeline: TreatmentPlanSeed['timeline'] = [
      { step: '制定治疗计划', date: dateOnly(startMs), status: 'completed' },
      ...followUps.map((f) => ({ step: `随访 T${f.no}`, date: f.date, status: f.status })),
    ];
    if (status === 'completed') {
      timeline.push({ step: '疗效评估与结案', date: dateOnly(updatedAtMs), status: 'completed' });
    } else if (status === 'interrupted') {
      timeline.push({ step: '计划中断', date: dateOnly(updatedAtMs), status: 'pending' });
    }

    return {
      id: planId,
      patientId: exam.patientId,
      patient: exam.patientName,
      type: planType,
      status,
      statusLabel: STATUS_LABEL[status],
      progress: status === 'completed' ? 1 : +(doneCount / followUpCount).toFixed(2),
      department,
      startDate: dateOnly(startMs),
      desc: `${exam.modality} ${exam.bodyPart}: ${planType}, 靶病灶 ${lesionCount} 个, 计划随访 ${followUpCount} 次 (间隔 ${intervalDays} 天)`,
      outcome,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      indexExamId: exam.examId,
      indexReportId: exam.reportId,
      lesions,
      followUps,
      timeline,
      createdAt: new Date(startMs).toISOString(),
      updatedAt: new Date(updatedAtMs).toISOString(),
    };
  });
}

let plans: any[] = [];
let seeded = false;

// 幂等种子: 首个路由命中时构建 (store 为空则回落 PATIENT_MASTER / EXAM_REPORT_PRE)
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  plans = buildSeedPlans();
}

// 路由入口统一入口: 先确保种子就绪, 再执行 msw delay
function routeDelay(ms: number): Promise<void> {
  ensureSeeded();
  return delay(ms);
}

const today = () => new Date().toISOString().slice(0, 10);

export const treatmentPlanHandlers = [
  http.get(`${API}`, async () => {
    await routeDelay(80);
    return HttpResponse.json({ success: true, data: [...plans].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  }),

  http.post(`${API}`, async ({ request }) => {
    await routeDelay(120);
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
    await routeDelay(80);
    const body = (await request.json()) as any;
    const plan = plans.find((p) => p.id === params.id);
    if (!plan) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    Object.assign(plan, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: plan });
  }),

  http.delete(`${API}/:id`, async ({ params }) => {
    await routeDelay(60);
    const idx = plans.findIndex((p) => p.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    plans.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/:id/transition`, async ({ params, request }) => {
    await routeDelay(100);
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
    await routeDelay(50);
    const plan = plans.find((p) => p.id === params.id);
    if (!plan) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: plan.timeline ?? [] });
  }),
];

export default treatmentPlanHandlers;

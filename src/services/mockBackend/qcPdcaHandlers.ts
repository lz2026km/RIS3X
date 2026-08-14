// [G005 Wave 3A v3.0.6.11-99] /api/v1/qc-pdca MSW handlers
// 与后端 qc-pdca.module 对齐: cycles CRUD / advance / phases CRUD / defects / stats / complete
// 响应形状: { success: true, data: <PdcaEnvelope | entity> }
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/qc-pdca';

type PdcaPhaseCode = 'plan' | 'do' | 'check' | 'act' | 'completed';
type PdcaCategory = '报告质控' | '图像质控' | '流程质控' | '服务质控';

interface PdcaPhaseEntry {
  id: string;
  phase: Exclude<PdcaPhaseCode, 'completed'>;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface PdcaCycle {
  id: string;
  title: string;
  category: PdcaCategory;
  description: string;
  target: string;
  ownerId: string;
  ownerName: string;
  phase: PdcaPhaseCode;
  status: '进行中' | '已完成';
  startDate: string;
  dueDate: string;
  completedAt?: string;
  summary?: string;
  defectIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface PdcaDefectRef {
  id: string;
  defectType: string;
  description: string;
  severity: string;
  status: string;
  reportedBy: string;
  reportedAt: string;
}

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min);

const iso = (day: string) => new Date(day + 'T00:00:00Z').toISOString();
const daysAfter = (day: string, n: number) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
};

const DEFECTS: PdcaDefectRef[] = [
  { id: 'df-001', defectType: '术语错误', description: '诊断结论中"考虑"类模糊表述占比偏高', severity: 'medium', status: 'in_progress', reportedBy: '质控组', reportedAt: '2026-07-02' },
  { id: 'df-002', defectType: '完整性缺陷', description: 'CT 增强报告未描述造影剂用量与过敏反应', severity: 'high', status: 'open', reportedBy: '张主任', reportedAt: '2026-07-05' },
  { id: 'df-003', defectType: '描述缺陷', description: '部分报告影像所见与诊断结论逻辑不符', severity: 'medium', status: 'in_progress', reportedBy: '李医生', reportedAt: '2026-07-08' },
  { id: 'df-004', defectType: '格式缺陷', description: '报告模板字段未按规范排版(左对齐/字号)', severity: 'low', status: 'resolved', reportedBy: '王技师', reportedAt: '2026-07-10' },
  { id: 'df-005', defectType: '流程缺陷', description: '危急值报告口头通知后 30 分钟内未电话复核', severity: 'high', status: 'open', reportedBy: '护士站', reportedAt: '2026-07-12' },
  { id: 'df-006', defectType: '图像缺陷', description: 'DR 胸片曝光不足, 心影后方结构无法评估', severity: 'medium', status: 'resolved', reportedBy: '王技师', reportedAt: '2026-07-15' },
  { id: 'df-007', defectType: '服务缺陷', description: '患者取报告等待时长超过 60 分钟投诉', severity: 'low', status: 'in_progress', reportedBy: '服务中心', reportedAt: '2026-07-18' },
];

const mkCycle = (
  id: string,
  title: string,
  category: PdcaCategory,
  description: string,
  target: string,
  ownerName: string,
  phase: PdcaPhaseCode,
  startDay: string,
  dueDay: string,
  defectIds: string[],
  completedAt?: string,
  summary?: string,
): PdcaCycle => ({
  id, title, category, description, target,
  ownerId: 'u-' + ownerName,
  ownerName,
  phase,
  status: phase === 'completed' ? '已完成' : '进行中',
  startDate: iso(startDay),
  dueDate: iso(dueDay),
  completedAt,
  summary,
  defectIds,
  createdAt: iso(startDay),
  updatedAt: iso(completedAt ?? dueDay),
});

let cycles: PdcaCycle[] = [
  mkCycle('pdca-001', '报告术语规范专项', '报告质控', '降低诊断结论中模糊表述占比', '模糊表述率 ≤ 5%', '张主任', 'completed', '2026-05-06', '2026-06-30', ['df-001', 'df-003'], '2026-06-28', '术语规范化培训完成, 复评抽查 120 份报告达标'),
  mkCycle('pdca-002', 'CT 增强报告完整性提升', '报告质控', '补充造影剂使用与过敏反应描述字段', '完整性字段覆盖率 100%', '李医生', 'act', '2026-06-10', '2026-08-15', ['df-002']),
  mkCycle('pdca-003', '危急值报告复核流程再造', '流程质控', '危急值通知后电话复核确认闭环', '复核率 ≥ 98%', '张主任', 'check', '2026-06-20', '2026-08-31', ['df-005']),
  mkCycle('pdca-004', 'DR 胸片曝光参数校准', '图像质控', '胸片曝光不足问题整改与技师培训', '曝光合格率 ≥ 95%', '王技师', 'do', '2026-07-01', '2026-09-10', ['df-006']),
  mkCycle('pdca-005', '报告排版模板统一', '报告质控', '全科报告模板排版字段统一', '模板统一率 100%', '王技师', 'plan', '2026-07-15', '2026-09-30', ['df-004']),
  mkCycle('pdca-006', '患者取报告时长优化', '服务质控', '缩短患者取报告等待时长', '平均等待 ≤ 40 分钟', '李医生', 'plan', '2026-08-01', '2026-10-15', ['df-007']),
];

let phaseEntries: Record<string, PdcaPhaseEntry[]> = {
  'pdca-001': [
    { id: 'phase-pdca-001-1', phase: 'plan', content: '统计 4 月-5 月 600 份报告中模糊表述分布', createdAt: iso('2026-05-06'), updatedAt: iso('2026-05-06') },
    { id: 'phase-pdca-001-2', phase: 'plan', content: '制定术语规范清单与培训课件', createdAt: iso('2026-05-10'), updatedAt: iso('2026-05-10') },
    { id: 'phase-pdca-001-3', phase: 'do', content: '组织 2 场全员术语规范培训', createdAt: iso('2026-05-20'), updatedAt: iso('2026-05-20') },
    { id: 'phase-pdca-001-4', phase: 'do', content: '更新报告模板与常用短语库', createdAt: iso('2026-06-01'), updatedAt: iso('2026-06-01') },
    { id: 'phase-pdca-001-5', phase: 'check', content: '抽查 120 份报告, 模糊表述率降至 4.2%', createdAt: iso('2026-06-15'), updatedAt: iso('2026-06-15') },
    { id: 'phase-pdca-001-6', phase: 'act', content: '写入科室质控 SOP, 纳入月度质控指标', createdAt: iso('2026-06-25'), updatedAt: iso('2026-06-25') },
  ],
  'pdca-002': [
    { id: 'phase-pdca-002-1', phase: 'plan', content: '盘点增强报告缺失字段 Top10', createdAt: iso('2026-06-10'), updatedAt: iso('2026-06-10') },
    { id: 'phase-pdca-002-2', phase: 'do', content: '模板增加造影剂描述必填字段', createdAt: iso('2026-06-20'), updatedAt: iso('2026-06-20') },
    { id: 'phase-pdca-002-3', phase: 'check', content: '7 月抽查覆盖率 92%, 剩余科室提示提醒', createdAt: iso('2026-07-10'), updatedAt: iso('2026-07-10') },
    { id: 'phase-pdca-002-4', phase: 'act', content: '固化模板并培训低分医生', createdAt: iso('2026-07-20'), updatedAt: iso('2026-07-20') },
  ],
  'pdca-003': [
    { id: 'phase-pdca-003-1', phase: 'plan', content: '梳理危急值通知-复核流程断点', createdAt: iso('2026-06-20'), updatedAt: iso('2026-06-20') },
    { id: 'phase-pdca-003-2', phase: 'do', content: '上线电话复核提醒与超时预警', createdAt: iso('2026-07-01'), updatedAt: iso('2026-07-01') },
    { id: 'phase-pdca-003-3', phase: 'check', content: '运行两周复核率 96%, 待满月评估', createdAt: iso('2026-07-20'), updatedAt: iso('2026-07-20') },
  ],
  'pdca-004': [
    { id: 'phase-pdca-004-1', phase: 'plan', content: '统计 DR 曝光不足率与设备分布', createdAt: iso('2026-07-01'), updatedAt: iso('2026-07-01') },
    { id: 'phase-pdca-004-2', phase: 'do', content: '校准 3 台 DR 自动曝光参数并培训技师', createdAt: iso('2026-07-15'), updatedAt: iso('2026-07-15') },
  ],
};

let phaseCounter = 100;

const PHASE_ORDER: Exclude<PdcaPhaseCode, 'completed'>[] = ['plan', 'do', 'check', 'act'];
const PHASE_LABEL: Record<string, string> = { plan: '计划', do: '执行', check: '检查', act: '处理', completed: '已完成' };

function envelope(source: 'database' | 'demo', data: unknown) {
  return { source, generatedAt: new Date().toISOString(), data };
}

export const qcPdcaHandlers = [
  http.get(`${API}/cycles`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: envelope('demo', [...cycles].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    });
  }),

  http.post(`${API}/cycles`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { title?: string; category?: string; description?: string; target?: string; ownerId?: string };
    if (!body.title?.trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '标题不能为空' } }, { status: 400 });
    const ownerName = body.ownerId === 'u-李医生' ? '李医生' : body.ownerId === 'u-王技师' ? '王技师' : '张主任';
    const cycle: PdcaCycle = {
      id: `pdca-${Date.now()}`,
      title: body.title.trim(),
      category: (body.category ?? '报告质控') as PdcaCategory,
      description: body.description ?? '',
      target: body.target ?? '',
      ownerId: body.ownerId ?? 'u-张主任',
      ownerName,
      phase: 'plan',
      status: '进行中',
      startDate: iso('2026-08-14'),
      dueDate: daysAfter('2026-08-14', 45),
      defectIds: [],
      createdAt: iso('2026-08-14'),
      updatedAt: iso('2026-08-14'),
    };
    cycles.unshift(cycle);
    phaseEntries[cycle.id] = [];
    return HttpResponse.json({ success: true, data: cycle }, { status: 201 });
  }),

  http.get(`${API}/cycles/:id`, async ({ params }) => {
    await delay(delayMs());
    const cycle = cycles.find((c) => c.id === params.id);
    if (!cycle) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: { ...cycle, phases: phaseEntries[cycle.id] ?? [] } });
  }),

  http.patch(`${API}/cycles/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const cycle = cycles.find((c) => c.id === params.id);
    if (!cycle) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.title === 'string' && body.title.trim()) cycle.title = body.title.trim();
    if (typeof body.category === 'string') cycle.category = body.category as PdcaCategory;
    if (typeof body.description === 'string') cycle.description = body.description;
    if (typeof body.target === 'string') cycle.target = body.target;
    if (typeof body.ownerId === 'string') {
      cycle.ownerId = body.ownerId;
      cycle.ownerName = body.ownerId === 'u-李医生' ? '李医生' : body.ownerId === 'u-王技师' ? '王技师' : '张主任';
    }
    if (typeof body.dueDate === 'string') cycle.dueDate = body.dueDate;
    cycle.updatedAt = iso('2026-08-14');
    return HttpResponse.json({ success: true, data: cycle });
  }),

  http.delete(`${API}/cycles/:id`, async ({ params }) => {
    await delay(delayMs());
    const idx = cycles.findIndex((c) => c.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    cycles.splice(idx, 1);
    delete phaseEntries[String(params.id)];
    return HttpResponse.json({ success: true, data: { id: params.id, deleted: true } });
  }),

  http.post(`${API}/cycles/:id/advance`, async ({ params }) => {
    await delay(delayMs());
    const cycle = cycles.find((c) => c.id === params.id);
    if (!cycle) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    if (cycle.phase === 'completed') return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '周期已完成, 不能再推进' } }, { status: 400 });
    const idx = PHASE_ORDER.indexOf(cycle.phase);
    if (idx < PHASE_ORDER.length - 1) {
      cycle.phase = PHASE_ORDER[idx + 1]!;
    } else {
      cycle.phase = 'completed';
      cycle.status = '已完成';
      cycle.completedAt = cycle.completedAt ?? iso('2026-08-14');
      cycle.summary = cycle.summary ?? `周期闭环: ${PHASE_LABEL.plan}/${PHASE_LABEL.do}/${PHASE_LABEL.check}/${PHASE_LABEL.act} 全阶段措施已落实`;
    }
    cycle.updatedAt = iso('2026-08-14');
    return HttpResponse.json({ success: true, data: cycle });
  }),

  http.post(`${API}/cycles/:id/complete`, async ({ params, request }) => {
    await delay(delayMs());
    const cycle = cycles.find((c) => c.id === params.id);
    if (!cycle) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    if (cycle.phase === 'completed') return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '周期已完成' } }, { status: 400 });
    const body = (await request.json().catch(() => ({}))) as { summary?: string };
    cycle.phase = 'completed';
    cycle.status = '已完成';
    cycle.completedAt = iso('2026-08-14');
    cycle.summary = body.summary?.trim() || '周期闭环: 各阶段措施已落实';
    cycle.updatedAt = iso('2026-08-14');
    return HttpResponse.json({ success: true, data: cycle });
  }),

  http.get(`${API}/cycles/:id/phases`, async ({ params }) => {
    await delay(delayMs());
    if (!cycles.some((c) => c.id === params.id)) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: envelope('demo', (phaseEntries[String(params.id)] ?? []).map((p) => ({ ...p })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) });
  }),

  http.post(`${API}/cycles/:id/phases`, async ({ params, request }) => {
    await delay(delayMs());
    if (!cycles.some((c) => c.id === params.id)) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    const body = (await request.json()) as { phase?: string; content?: string };
    if (!PHASE_ORDER.includes(body.phase as never)) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '阶段必须为 plan|do|check|act' } }, { status: 400 });
    if (!body.content?.trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '内容不能为空' } }, { status: 400 });
    const entry: PdcaPhaseEntry = { id: `phase-${++phaseCounter}`, phase: body.phase as never, content: body.content.trim(), createdAt: iso('2026-08-14'), updatedAt: iso('2026-08-14') };
    (phaseEntries[String(params.id)] ??= []).push(entry);
    return HttpResponse.json({ success: true, data: entry }, { status: 201 });
  }),

  http.patch(`${API}/phases/:phaseId`, async ({ params, request }) => {
    await delay(delayMs());
    let target: { key: string; entry: PdcaPhaseEntry } | undefined;
    for (const [key, list] of Object.entries(phaseEntries)) {
      const entry = list.find((p) => p.id === params.phaseId);
      if (entry) { target = { key, entry }; break; }
    }
    if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '阶段条目不存在' } }, { status: 404 });
    const body = (await request.json()) as { phase?: string; content?: string };
    if (body.phase !== undefined) {
      if (!PHASE_ORDER.includes(body.phase as never)) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '阶段不合法' } }, { status: 400 });
      target.entry.phase = body.phase as never;
    }
    if (body.content !== undefined) {
      if (!body.content.trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '内容不能为空' } }, { status: 400 });
      target.entry.content = body.content.trim();
    }
    target.entry.updatedAt = iso('2026-08-14');
    void target.key;
    return HttpResponse.json({ success: true, data: target.entry });
  }),

  http.get(`${API}/cycles/:id/defects`, async ({ params }) => {
    await delay(delayMs());
    const cycle = cycles.find((c) => c.id === params.id);
    if (!cycle) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    const picked = cycle.defectIds.length > 0
      ? DEFECTS.filter((d) => cycle.defectIds.includes(d.id))
      : DEFECTS.slice(0, 3);
    return HttpResponse.json({ success: true, data: envelope('demo', picked.map((d) => ({ ...d }))) });
  }),

  http.post(`${API}/cycles/:id/defects`, async ({ params, request }) => {
    await delay(delayMs());
    const cycle = cycles.find((c) => c.id === params.id);
    if (!cycle) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '周期不存在' } }, { status: 404 });
    const body = (await request.json()) as { defectId?: string };
    if (!body.defectId) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'defectId 不能为空' } }, { status: 400 });
    if (!cycle.defectIds.includes(body.defectId)) cycle.defectIds.push(body.defectId);
    cycle.updatedAt = iso('2026-08-14');
    return HttpResponse.json({ success: true, data: { linked: true, defectIds: [...cycle.defectIds] } }, { status: 201 });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    const byPhase: Record<string, number> = { plan: 0, do: 0, check: 0, act: 0, completed: 0 };
    const byCategory: Record<string, number> = { '报告质控': 0, '图像质控': 0, '流程质控': 0, '服务质控': 0 };
    let completed = 0;
    let durationSum = 0;
    let durationCount = 0;
    for (const c of cycles) {
      byPhase[c.phase] = (byPhase[c.phase] ?? 0) + 1;
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
      if (c.phase === 'completed') {
        completed += 1;
        const start = new Date(c.startDate).getTime();
        const end = new Date(c.completedAt ?? c.dueDate).getTime();
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          durationSum += (end - start) / 86400000;
          durationCount += 1;
        }
      }
    }
    return HttpResponse.json({
      success: true,
      data: envelope('demo', {
        total: cycles.length,
        byPhase,
        completionRate: cycles.length > 0 ? Math.round((completed / cycles.length) * 1000) / 10 : 0,
        byCategory,
        avgDurationDays: durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : 0,
        inProgress: cycles.length - completed,
      }),
    });
  }),

  http.get(`${API}/defects`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: envelope('demo', DEFECTS.map((d) => ({ ...d }))) });
  }),
];

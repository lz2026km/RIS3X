// [G005 Wave 8B v3.0.6.11-101] /api/v1/qc-analytics MSW handlers
// 与后端 qc-analytics.module 对齐: dashboard / trends / pareto / departments / loop 闭环状态机
// 响应形状: { success: true, data: <DashboardData | Envelope | RectificationItem> }
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/qc-analytics';

type LoopStatus = 'open' | 'rectifying' | 'rechecking' | 'closed';
type DefectTypeCode =
  | 'missing_field' | 'terminology' | 'unit' | 'length_range'
  | 'numeric_reasonability' | 'duplicate' | 'structure' | 'critical';

interface RectificationItem {
  id: string;
  defectId: string;
  defectCode: DefectTypeCode;
  typeLabel: string;
  reportId: string;
  department: string;
  severity: string;
  source: 'rules-engine' | 'qc-v2' | 'manual';
  title: string;
  assignee: string;
  assigneeName: string;
  status: LoopStatus;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  fixNote?: string;
  recheckResult?: 'pass' | 'fail';
  recheckNote?: string;
  recheckRounds: number;
  history: Array<{ at: string; action: string; actor: string; note: string }>;
}

interface LoopDefect {
  id: string;
  code: DefectTypeCode;
  typeLabel: string;
  reportId: string;
  department: string;
  severity: 'high' | 'medium' | 'low';
  source: 'rules-engine' | 'qc-v2' | 'manual';
  message: string;
  discoveredAt: string;
  status: LoopStatus;
  itemId?: string;
}

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min);
const iso = (day: string, hour = 8) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`).toISOString();

// ── 确定性样本 (与后端 seed 同口径) ─────────────────────────────────
const DEPTS = ['放射科一区', '放射科二区', '介入科', '核医学科', '超声科', '急诊影像', '神经影像', '乳腺影像'];
const MODALITIES = ['CT', 'MR', 'DR', 'MG', 'US', 'XA'];
const CODES: DefectTypeCode[] = ['missing_field', 'terminology', 'unit', 'length_range', 'numeric_reasonability', 'duplicate', 'structure', 'critical'];
const LABELS: Record<string, string> = {
  missing_field: '必填字段缺失', terminology: '术语不规范', unit: '单位缺失', length_range: '长度异常',
  numeric_reasonability: '数值不合理', duplicate: '重复表述', structure: '结构不完整', critical: '危急提示缺失',
};

interface Rec { reportedAt: string; department: string; modality: string; defectCodes: DefectTypeCode[]; qcScored: boolean; score?: number; responseMinutes: number; timely: boolean }

const RECORDS: Rec[] = (() => {
  const out: Rec[] = [];
  let seq = 0;
  const spans: Array<[string, number, number]> = [
    ['2026-04', 1, 30], ['2026-05', 1, 31], ['2026-06', 1, 30], ['2026-07', 1, 31], ['2026-08', 1, 14],
  ];
  for (const [month, start, end] of spans) {
    for (let day = start; day <= end; day++) {
      const perDay = 1 + ((day * 3) % 2);
      for (let i = 0; i < perDay; i++) {
        seq += 1;
        const defectCodes: DefectTypeCode[] = [];
        const count = (day * 5 + i * 13) % 4;
        for (let k = 0; k < count; k++) {
          const code = CODES[(day * 3 + i * 7 + k * 5) % CODES.length]!;
          if (!defectCodes.includes(code)) defectCodes.push(code);
        }
        const qcScored = (day + i) % 4 !== 0;
        out.push({
          reportedAt: new Date(`${month}-${String(day).padStart(2, '0')}T0${(day % 9) + 1}:00:00Z`).toISOString(),
          department: DEPTS[(day * 7 + i * 3) % DEPTS.length]!,
          modality: MODALITIES[(day + i) % MODALITIES.length]!,
          defectCodes,
          qcScored,
          score: qcScored ? 62 + ((day * 7 + i * 11) % 37) : undefined,
          responseMinutes: 15 + ((day * 13 + i * 5) % 80),
          timely: (day * 11 + i * 7) % 10 < 8,
        });
      }
    }
  }
  return out;
})();

const round1 = (n: number) => Math.round(n * 10) / 10;

const DEFECTS: LoopDefect[] = [
  { id: 'qcd-001', code: 'terminology', typeLabel: '术语不规范', reportId: 'RPT-A-0001', department: '放射科一区', severity: 'medium', source: 'rules-engine', message: '诊断结论存在"考虑/可能"类模糊表述 3 处', discoveredAt: iso('2026-07-06', 2), status: 'closed', itemId: 'it-001' },
  { id: 'qcd-002', code: 'missing_field', typeLabel: '必填字段缺失', reportId: 'RPT-A-0012', department: '介入科', severity: 'high', source: 'rules-engine', message: 'CTA 报告缺少对比剂剂量字段', discoveredAt: iso('2026-07-10', 3), status: 'rectifying', itemId: 'it-003' },
  { id: 'qcd-003', code: 'structure', typeLabel: '结构不完整', reportId: 'RPT-A-0021', department: '超声科', severity: 'medium', source: 'qc-v2', message: '影像所见与诊断结论结构不完整 (completeness 维度扣分)', discoveredAt: iso('2026-07-15', 1), status: 'open' },
  { id: 'qcd-004', code: 'critical', typeLabel: '危急提示缺失', reportId: 'RPT-A-0030', department: '急诊影像', severity: 'high', source: 'qc-v2', message: '危急值报告缺少紧急提示措辞', discoveredAt: iso('2026-07-18', 6), status: 'rechecking', itemId: 'it-002' },
  { id: 'qcd-005', code: 'duplicate', typeLabel: '重复表述', reportId: 'RPT-A-0035', department: '放射科二区', severity: 'low', source: 'rules-engine', message: '结论段落重复描述所见 2 处', discoveredAt: iso('2026-07-22', 2), status: 'open' },
  { id: 'qcd-006', code: 'numeric_reasonability', typeLabel: '数值不合理', reportId: 'RPT-A-0040', department: '神经影像', severity: 'medium', source: 'rules-engine', message: '病灶尺寸数值超出模态合理范围', discoveredAt: iso('2026-07-25', 4), status: 'rechecking', itemId: 'it-004' },
  { id: 'qcd-007', code: 'unit', typeLabel: '单位缺失', reportId: 'RPT-A-0044', department: '核医学科', severity: 'low', source: 'rules-engine', message: 'SUV 值缺少单位说明', discoveredAt: iso('2026-07-29', 1), status: 'open' },
  { id: 'qcd-008', code: 'length_range', typeLabel: '长度异常', reportId: 'RPT-A-0048', department: '乳腺影像', severity: 'medium', source: 'qc-v2', message: '报告语句过长, 可读性维度扣分', discoveredAt: iso('2026-08-03', 2), status: 'open', itemId: 'it-005' },
  { id: 'qcd-009', code: 'terminology', typeLabel: '术语不规范', reportId: 'RPT-A-0055', department: '放射科二区', severity: 'medium', source: 'rules-engine', message: '使用非规范缩写 2 处', discoveredAt: iso('2026-08-07', 3), status: 'open' },
  { id: 'qcd-010', code: 'missing_field', typeLabel: '必填字段缺失', reportId: 'RPT-A-0060', department: '放射科一区', severity: 'high', source: 'qc-v2', message: '增强报告缺少随访建议字段', discoveredAt: iso('2026-08-11', 1), status: 'closed', itemId: 'it-006' },
];

const mkItem = (id: string, defectId: string, status: LoopStatus, title: string, assigneeName: string, fixNote?: string): RectificationItem => {
  const defect = DEFECTS.find((d) => d.id === defectId)!;
  const createdAt = defect.discoveredAt;
  const base: RectificationItem = {
    id, defectId, defectCode: defect.code, typeLabel: defect.typeLabel,
    reportId: defect.reportId, department: defect.department, severity: defect.severity, source: defect.source,
    title, assignee: 'u-' + assigneeName, assigneeName, status,
    createdAt, updatedAt: createdAt, recheckRounds: 0,
    history: [{ at: createdAt, action: 'created', actor: '系统', note: `由缺陷 ${defectId} 派生整改任务` }],
  };
  if (fixNote) base.fixNote = fixNote;
  return base;
};

let items: RectificationItem[] = [
  {
    ...mkItem('it-001', 'qcd-001', 'closed', '术语规范整改: 消除"考虑/可能"模糊表述', '王质控员', '已更新结论表述并复核模板术语库'),
    closedAt: iso('2026-07-20'), recheckResult: 'pass', recheckNote: '复查通过, 模糊表述清零', recheckRounds: 1, updatedAt: iso('2026-07-20'),
    history: [
      { at: iso('2026-07-08'), action: 'created', actor: '系统', note: '由缺陷 qcd-001 派生整改任务' },
      { at: iso('2026-07-09'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-07-16'), action: 'fixed', actor: '王质控员', note: '已更新结论表述' },
      { at: iso('2026-07-18'), action: 'rechecked', actor: '张质控', note: '复查验证通过' },
      { at: iso('2026-07-20'), action: 'closed', actor: '张质控', note: '整改闭环' },
    ],
  },
  {
    ...mkItem('it-002', 'qcd-004', 'rechecking', '危急值报告紧急提示措辞整改', '李质控员', '模板增加危急提示语, 已覆盖 3 例在途报告'),
    recheckRounds: 1, updatedAt: iso('2026-08-10'),
    history: [
      { at: iso('2026-07-20'), action: 'created', actor: '系统', note: '由缺陷 qcd-004 派生整改任务' },
      { at: iso('2026-07-22'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-08-05'), action: 'fixed', actor: '李质控员', note: '已提交整改说明' },
      { at: iso('2026-08-10'), action: 'rechecked', actor: '张质控', note: '进入复查验证' },
    ],
  },
  {
    ...mkItem('it-003', 'qcd-002', 'rectifying', 'CTA 对比剂剂量必填字段整改', '赵质控员'),
    updatedAt: iso('2026-08-12'),
    history: [
      { at: iso('2026-07-12'), action: 'created', actor: '系统', note: '由缺陷 qcd-002 派生整改任务' },
      { at: iso('2026-07-15'), action: 'started', actor: '质控组长', note: '开始整改' },
    ],
  },
  {
    ...mkItem('it-004', 'qcd-006', 'rechecking', '病灶尺寸数值合理性整改', '王质控员', '数值校验规则已加入规则引擎'),
    recheckResult: 'fail', recheckNote: '复查未通过: 历史报告未全部回刷', recheckRounds: 1, updatedAt: iso('2026-08-13'),
    history: [
      { at: iso('2026-07-27'), action: 'created', actor: '系统', note: '由缺陷 qcd-006 派生整改任务' },
      { at: iso('2026-07-29'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-08-08'), action: 'fixed', actor: '王质控员', note: '提交数值校验规则' },
      { at: iso('2026-08-10'), action: 'rechecked', actor: '张质控', note: '复查退回: 历史报告未全部回刷' },
      { at: iso('2026-08-13'), action: 'rechecked', actor: '张质控', note: '进入复查验证' },
    ],
  },
  {
    ...mkItem('it-005', 'qcd-008', 'open', '报告语句长度整改', '孙质控员'),
  },
  {
    ...mkItem('it-006', 'qcd-010', 'closed', '增强报告随访建议字段整改', '王质控员', '模板增加随访建议必填项'),
    closedAt: iso('2026-08-13'), recheckResult: 'pass', recheckNote: '复查通过', recheckRounds: 1, updatedAt: iso('2026-08-13'),
    history: [
      { at: iso('2026-08-06'), action: 'created', actor: '系统', note: '由缺陷 qcd-010 派生整改任务' },
      { at: iso('2026-08-07'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-08-11'), action: 'fixed', actor: '王质控员', note: '提交模板更新' },
      { at: iso('2026-08-12'), action: 'rechecked', actor: '张质控', note: '复查验证通过' },
      { at: iso('2026-08-13'), action: 'closed', actor: '张质控', note: '整改闭环' },
    ],
  },
];

let itemSeq = 100;

function envelope(source: 'database' | 'demo', data: unknown) {
  return { source, generatedAt: new Date().toISOString(), data };
}

function weekStartOf(isoStr: string): string {
  const d = new Date(isoStr);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function buildTrends(period: 'week' | 'month') {
  const map = new Map<string, { reports: number; qc: number; defects: number; timely: number; respSum: number; scoreSum: number; scoreCount: number }>();
  for (const r of RECORDS) {
    const key = period === 'month' ? r.reportedAt.slice(0, 7) : weekStartOf(r.reportedAt);
    const agg = map.get(key) ?? { reports: 0, qc: 0, defects: 0, timely: 0, respSum: 0, scoreSum: 0, scoreCount: 0 };
    agg.reports += 1;
    if (r.qcScored) agg.qc += 1;
    agg.defects += r.defectCodes.length;
    if (r.timely) agg.timely += 1;
    agg.respSum += r.responseMinutes;
    if (r.score !== undefined) { agg.scoreSum += r.score; agg.scoreCount += 1; }
    map.set(key, agg);
  }
  const keys = [...map.keys()].sort();
  const points: Array<{ bucket: string; label: string; reports: number; qcRate: number; defectRate: number; timelyRate: number; avgResponseMinutes: number; improvement: number | null }> = [];
  for (let i = 0; i < keys.length; i++) {
    const agg = map.get(keys[i]!)!;
    const defectRate = round1((agg.defects / agg.reports) * 100);
    const prev = points[i - 1];
    const improvement = prev && prev.defectRate > 0 ? round1(((prev.defectRate - defectRate) / prev.defectRate) * 100) : null;
    points.push({
      bucket: keys[i]!, label: period === 'month' ? keys[i]! : keys[i]!.slice(5),
      reports: agg.reports,
      qcRate: round1((agg.qc / agg.reports) * 100),
      defectRate,
      timelyRate: round1((agg.timely / agg.reports) * 100),
      avgResponseMinutes: round1(agg.respSum / agg.reports),
      improvement,
    });
  }
  return envelope('demo', { source: 'demo', generatedAt: new Date().toISOString(), period, points });
}

function buildPareto() {
  const counts = new Map<DefectTypeCode, number>();
  for (const r of RECORDS) for (const c of r.defectCodes) counts.set(c, (counts.get(c) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  let cumulative = 0;
  const items = sorted.map(([code, count]) => {
    cumulative += count;
    const cumulativePercent = round1((cumulative / total) * 100);
    return { code, label: LABELS[code] ?? code, count, cumulativeCount: cumulative, cumulativePercent, isMain: cumulativePercent <= 80 };
  });
  return envelope('demo', { source: 'demo', generatedAt: new Date().toISOString(), totalDefects: total, items });
}

function buildDepartments() {
  const map = new Map<string, { reports: number; defects: number; timely: number; qc: number; respSum: number; scoreSum: number; scoreCount: number }>();
  for (const r of RECORDS) {
    const agg = map.get(r.department) ?? { reports: 0, defects: 0, timely: 0, qc: 0, respSum: 0, scoreSum: 0, scoreCount: 0 };
    agg.reports += 1;
    agg.defects += r.defectCodes.length;
    if (r.timely) agg.timely += 1;
    if (r.qcScored) agg.qc += 1;
    agg.respSum += r.responseMinutes;
    if (r.score !== undefined) { agg.scoreSum += r.score; agg.scoreCount += 1; }
    map.set(r.department, agg);
  }
  const data = [...map.entries()].map(([department, agg]) => ({
    department,
    reports: agg.reports,
    defects: agg.defects,
    defectRate: round1((agg.defects / agg.reports) * 100),
    timelyRate: round1((agg.timely / agg.reports) * 100),
    avgResponseMinutes: round1(agg.respSum / agg.reports),
    qcRate: round1((agg.qc / agg.reports) * 100),
    avgScore: agg.scoreCount > 0 ? round1(agg.scoreSum / agg.scoreCount) : 0,
  })).sort((a, b) => a.defectRate - b.defectRate || a.department.localeCompare(b.department));
  return envelope('demo', { source: 'demo', generatedAt: new Date().toISOString(), data });
}

function buildDashboard() {
  const totalReports = RECORDS.length;
  const qcReports = RECORDS.filter((r) => r.qcScored).length;
  const totalDefects = RECORDS.reduce((a, r) => a + r.defectCodes.length, 0);
  const timelyReports = RECORDS.filter((r) => r.timely).length;
  const avgResponseMinutes = round1(RECORDS.reduce((a, r) => a + r.responseMinutes, 0) / totalReports);
  const scored = RECORDS.filter((r) => r.score !== undefined);
  const avgScore = scored.length > 0 ? round1(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : 0;
  const loopClosed = items.filter((i) => i.status === 'closed').length;
  return {
    source: 'demo',
    generatedAt: new Date().toISOString(),
    totalReports,
    qcReports,
    qcRate: round1((qcReports / totalReports) * 100),
    totalDefects,
    defectRate: round1((totalDefects / totalReports) * 100),
    timelyReports,
    timelyRate: round1((timelyReports / totalReports) * 100),
    avgResponseMinutes,
    avgScore,
    loopOpen: items.length - loopClosed,
    loopClosed,
    closureRate: round1((loopClosed / items.length) * 100),
  };
}

function buildLoopStats() {
  const byStatus: Record<LoopStatus, number> = { open: 0, rectifying: 0, rechecking: 0, closed: 0 };
  let daysSum = 0, daysCount = 0, roundsSum = 0;
  for (const it of items) {
    byStatus[it.status] += 1;
    if (it.status === 'closed') {
      const start = new Date(it.createdAt).getTime();
      const end = new Date(it.closedAt ?? it.updatedAt).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) { daysSum += (end - start) / 86400000; daysCount += 1; }
    }
    roundsSum += it.recheckRounds;
  }
  return envelope('demo', {
    total: items.length,
    byStatus,
    closureRate: round1((byStatus.closed / items.length) * 100),
    avgDaysToClose: daysCount > 0 ? round1(daysSum / daysCount) : 0,
    avgRecheckRounds: round1(roundsSum / items.length),
    openDefects: byStatus.open + byStatus.rectifying + byStatus.rechecking,
  });
}

const TRANSITIONS: Record<LoopStatus, LoopStatus[]> = {
  open: ['rectifying', 'closed'],
  rectifying: ['rechecking'],
  rechecking: ['rectifying', 'closed'],
  closed: [],
};

export const qcAnalyticsHandlers = [
  http.get(`${API}/dashboard`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: buildDashboard() });
  }),

  http.get(`${API}/trends`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const period = url.searchParams.get('period') === 'week' ? 'week' : 'month';
    return HttpResponse.json({ success: true, data: buildTrends(period) });
  }),

  http.get(`${API}/pareto`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: buildPareto() });
  }),

  http.get(`${API}/departments`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: buildDepartments() });
  }),

  http.get(`${API}/loop/defects`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const data = DEFECTS.map((d) => {
      const item = items.find((it) => it.defectId === d.id);
      return { ...d, status: item ? item.status : 'open', itemId: item?.id };
    }).filter((d) => !status || d.status === status);
    return HttpResponse.json({ success: true, data: envelope('demo', data) });
  }),

  http.get(`${API}/loop/items`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const data = items.filter((it) => !status || it.status === status);
    return HttpResponse.json({ success: true, data: envelope('demo', data) });
  }),

  http.get(`${API}/loop/items/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = items.find((it) => it.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改任务不存在' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),

  http.post(`${API}/loop/items`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { defectId?: string; title?: string; assigneeName?: string };
    if (!body.defectId?.trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'defectId 不能为空' } }, { status: 400 });
    const defect = DEFECTS.find((d) => d.id === body.defectId);
    if (!defect) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '缺陷不存在' } }, { status: 404 });
    if (items.some((it) => it.defectId === body.defectId && it.status !== 'closed')) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '该缺陷已有进行中的整改任务' } }, { status: 400 });
    }
    const now = new Date().toISOString();
    const item: RectificationItem = {
      id: `it-${++itemSeq}`,
      defectId: defect.id,
      defectCode: defect.code,
      typeLabel: defect.typeLabel,
      reportId: defect.reportId,
      department: defect.department,
      severity: defect.severity,
      source: defect.source,
      title: body.title?.trim() || `${defect.typeLabel}整改 (${defect.reportId})`,
      assignee: 'u-102',
      assigneeName: body.assigneeName?.trim() || '王质控员',
      status: 'open',
      createdAt: now,
      updatedAt: now,
      recheckRounds: 0,
      history: [{ at: now, action: 'created', actor: '系统', note: `由缺陷 ${defect.id} 派生整改任务` }],
    };
    items.unshift(item);
    return HttpResponse.json({ success: true, data: item });
  }),

  http.post(`${API}/loop/items/:id/start`, async ({ params }) => {
    await delay(delayMs());
    const item = items.find((it) => it.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改任务不存在' } }, { status: 404 });
    if (!TRANSITIONS[item.status].includes('rectifying')) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `非法状态流转: ${item.status} → rectifying` } }, { status: 400 });
    }
    const now = new Date().toISOString();
    item.status = 'rectifying';
    item.updatedAt = now;
    item.history.push({ at: now, action: 'started', actor: '当前用户', note: '开始整改' });
    return HttpResponse.json({ success: true, data: item });
  }),

  http.post(`${API}/loop/items/:id/fix`, async ({ params, request }) => {
    await delay(delayMs());
    const item = items.find((it) => it.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改任务不存在' } }, { status: 404 });
    if (!TRANSITIONS[item.status].includes('rechecking')) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `非法状态流转: ${item.status} → rechecking` } }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const now = new Date().toISOString();
    item.status = 'rechecking';
    item.fixNote = body.note?.trim() || item.fixNote || '已提交整改说明';
    item.updatedAt = now;
    item.history.push({ at: now, action: 'fixed', actor: '当前用户', note: item.fixNote });
    return HttpResponse.json({ success: true, data: item });
  }),

  http.post(`${API}/loop/items/:id/recheck`, async ({ params, request }) => {
    await delay(delayMs());
    const item = items.find((it) => it.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改任务不存在' } }, { status: 404 });
    const body = (await request.json()) as { result?: string; reviewer?: string; note?: string };
    if (body.result !== 'pass' && body.result !== 'fail') {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'result 必须为 pass|fail' } }, { status: 400 });
    }
    if (!body.reviewer?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'reviewer 不能为空' } }, { status: 400 });
    }
    if (item.status !== 'rechecking') {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `当前状态 ${item.status} 不可复查验证, 仅 rechecking 可复查` } }, { status: 400 });
    }
    const now = new Date().toISOString();
    item.recheckRounds += 1;
    item.recheckResult = body.result as 'pass' | 'fail';
    item.recheckNote = body.note?.trim() || (body.result === 'pass' ? '复查验证通过' : '复查退回, 需继续整改');
    item.updatedAt = now;
    if (body.result === 'pass') {
      item.status = 'closed';
      item.closedAt = item.closedAt ?? now;
      item.history.push({ at: now, action: 'rechecked', actor: body.reviewer.trim(), note: '复查验证通过' });
      item.history.push({ at: now, action: 'closed', actor: body.reviewer.trim(), note: '整改闭环' });
    } else {
      item.status = 'rectifying';
      item.history.push({ at: now, action: 'rechecked', actor: body.reviewer.trim(), note: `复查退回: ${item.recheckNote}` });
    }
    return HttpResponse.json({ success: true, data: item });
  }),

  http.post(`${API}/loop/items/:id/close`, async ({ params, request }) => {
    await delay(delayMs());
    const item = items.find((it) => it.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改任务不存在' } }, { status: 404 });
    if (item.status === 'closed') {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '任务已关闭' } }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const now = new Date().toISOString();
    item.status = 'closed';
    item.closedAt = now;
    item.updatedAt = now;
    item.history.push({ at: now, action: 'closed', actor: '当前用户', note: body.note?.trim() || '整改任务关闭' });
    return HttpResponse.json({ success: true, data: item });
  }),

  http.get(`${API}/loop/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: buildLoopStats() });
  }),
];

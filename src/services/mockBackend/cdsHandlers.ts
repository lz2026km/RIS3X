// [v3.0.6.11-7] /api/v1/cds MSW handlers
// [G005 W2-B] 补全 6 方法覆盖: listGuidelines / getGuideline / createGuideline /
//             listAlerts / acknowledgeAlert / getDoseMonitoring
// 页面: /cds/guidelines (GuidelineLibraryPage), /cds/alerts (AlertCenterPage),
//       /cds/dose-monitoring (CdsDoseMonitoringPage)
import { http, HttpResponse, delay } from 'msw';
import { list, create, update } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/cds';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

// ── 指南库种子 (与 CdsGuidelineDto 对齐) ──
const SEED_GUIDELINES: any[] = [
  {
    id: 'GL001',
    name: '肺结节诊疗指南',
    category: '呼吸',
    version: '2025',
    status: 'active',
    updatedAt: '2026-07-20T08:00:00Z',
    description: '基于 Fleischner 学会的肺结节随访与管理建议',
    source: 'Fleischner Society',
  },
  {
    id: 'GL002',
    name: '对比剂使用规范',
    category: '造影',
    version: '2025',
    status: 'active',
    updatedAt: '2026-07-15T08:00:00Z',
    description: '含碘对比剂适应症、禁忌症与肾功能评估流程',
    source: 'ACR Manual on Contrast Media',
  },
  {
    id: 'GL003',
    name: '儿童 CT 低剂量协议',
    category: '剂量',
    version: '2024',
    status: 'draft',
    updatedAt: '2026-06-30T08:00:00Z',
    description: '儿科 CT 检查辐射剂量优化与协议选择',
    source: 'Image Gently Campaign',
  },
];

// ── 告警种子 (与 CdsAlertDto 对齐) ──
const SEED_ALERTS: any[] = [
  {
    id: 'AL001',
    severity: 'critical',
    patientName: '王五',
    type: '剂量告警',
    message: 'CT 扫描 DLP 超过 1500 mGy·cm，超过常规阈值',
    time: '2026-08-01T09:30:00Z',
    status: 'pending',
  },
  {
    id: 'AL002',
    severity: 'warning',
    patientName: '赵敏',
    type: '路径偏离',
    message: '增强扫描时相偏早，建议按协议重新扫描',
    time: '2026-08-01T08:45:00Z',
    status: 'pending',
  },
  {
    id: 'AL003',
    severity: 'info',
    patientName: '李静',
    type: '用药提醒',
    message: '含碘对比剂使用前请确认 eGFR 水平',
    time: '2026-08-01T08:10:00Z',
    status: 'acknowledged',
  },
];

// ── 剂量监测种子 (与 CdsDoseMonitoringDto 对齐: records / thresholds) ──
const SEED_DOSE_RECORDS: any[] = [
  {
    id: 'DOSE-001',
    patientName: '王五',
    examType: 'CT 胸部增强',
    modality: 'CT',
    dlp: 1520,
    kerma: 42.5,
    threshold: 1500,
    status: 'exceeded',
    date: '2026-08-01T09:30:00Z',
  },
  {
    id: 'DOSE-002',
    patientName: '张明远',
    examType: 'CT 腹部平扫',
    modality: 'CT',
    dlp: 980,
    kerma: 28.1,
    threshold: 1500,
    status: 'normal',
    date: '2026-07-31T14:20:00Z',
  },
  {
    id: 'DOSE-003',
    patientName: '周婷',
    examType: '胸部 DR',
    modality: 'DR',
    dlp: 2.4,
    kerma: 0.32,
    threshold: 5,
    status: 'normal',
    date: '2026-07-30T10:05:00Z',
  },
];

const SEED_DOSE_THRESHOLDS: any[] = [
  { id: 'TH-CT', modality: 'CT', dlpLimit: 1500, unit: 'mGy·cm', level: '常规' },
  { id: 'TH-CT-PED', modality: 'CT', dlpLimit: 500, unit: 'mGy·cm', level: '儿童' },
  { id: 'TH-DR', modality: 'DR', dlpLimit: 5, unit: 'mGy·cm', level: '常规' },
];

const ensureSeeded = (key: any, seed: any[]) => {
  try {
    const existing = list<any>(key);
    if (!existing.length) {
      for (const item of seed) create(key, { ...item });
    }
  } catch {}
};

export const cdsHandlers = [
  // ── 指南库 (3 端点) ──
  http.get(`${API}/guidelines`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsGuidelines' as any, SEED_GUIDELINES);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(list<any>('cdsGuidelines' as any), opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/guidelines/:id`, async ({ params }) => {
    await delay(delayMs());
    ensureSeeded('cdsGuidelines' as any, SEED_GUIDELINES);
    const found = list<any>('cdsGuidelines' as any).find((g) => g.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `指南 ${params.id} 不存在` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: found });
  }),
  http.post(`${API}/guidelines`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsGuidelines' as any, SEED_GUIDELINES);
    const body = (await request.json()) as any;
    const newItem = {
      id: body.id || `GL-${uuidv4()}`,
      name: body.name || '未命名指南',
      category: body.category || '通用',
      version: body.version || '1.0',
      status: body.status || 'draft',
      updatedAt: new Date().toISOString(),
      description: body.description || '',
      source: body.source || '',
      ...body,
    };
    try { create('cdsGuidelines' as any, newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // ── 告警中心 (2 端点) ──
  http.get(`${API}/alerts`, async ({ request }) => {
    await delay(delayMs());
    ensureSeeded('cdsAlerts' as any, SEED_ALERTS);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(list<any>('cdsAlerts' as any), opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/alerts/:id/acknowledge`, async ({ params, request }) => {
    await delay(delayMs());
    ensureSeeded('cdsAlerts' as any, SEED_ALERTS);
    const body = (await request.json()) as any;
    const updated = update<any>('cdsAlerts' as any, params.id as string, {
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: body?.acknowledgedBy || '当前用户',
    });
    if (!updated) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `告警 ${params.id} 不存在` } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: updated });
  }),

  // ── 剂量监测 (1 端点) ──
  http.get(`${API}/dose-monitoring`, async () => {
    await delay(delayMs());
    ensureSeeded('cdsDoseRecords' as any, SEED_DOSE_RECORDS);
    ensureSeeded('cdsDoseThresholds' as any, SEED_DOSE_THRESHOLDS);
    return HttpResponse.json({
      success: true,
      data: {
        records: list<any>('cdsDoseRecords' as any),
        thresholds: list<any>('cdsDoseThresholds' as any),
      },
    });
  }),

  http.get(`${API}/statistics`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = [{"totalAlerts":89,"acknowledged":76,"escalated":5}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/rules`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = [{"id":"CDR001","name":"辐射剂量超限","condition":"DOSE>1000"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/rules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalRules', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // ── 规则管理页 (CdsManagementPage): GET /cds/management ──
  // [W2-B-3] 对齐后端 cds.controller getCdsManagement: { rules, audit }
  http.get(`${API}/management`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        rules: [
          { id: 'CDR001', type: 'appropriateness', name: '辐射剂量超限拦截', isActive: true, version: '1.2', updatedTime: '2026-07-20T08:00:00Z', usageCount: 128 },
          { id: 'CDR002', type: 'pathway', name: '胸部CT肺结节随访路径', isActive: true, version: '2.0', updatedTime: '2026-07-18T08:00:00Z', usageCount: 96 },
          { id: 'CDR003', type: 'contrast', name: '造影剂适应症检查', isActive: true, version: '1.1', updatedTime: '2026-07-15T08:00:00Z', usageCount: 243 },
          { id: 'CDR004', type: 'drug', name: '药物交互检查', isActive: false, version: '1.0', updatedTime: '2026-06-30T08:00:00Z', usageCount: 12 },
        ],
        audit: [
          { id: 'AUD-001', ruleId: 'CDR002', ruleType: 'pathway', action: 'updated', performedBy: '张主任', performedAt: '2026-07-18T09:00:00Z', details: '更新肺结节随访周期' },
          { id: 'AUD-002', ruleId: 'CDR001', ruleType: 'appropriateness', action: 'activated', performedBy: '张主任', performedAt: '2026-07-16T09:00:00Z', details: '启用辐射剂量超限拦截' },
          { id: 'AUD-003', ruleId: 'CDR004', ruleType: 'drug', action: 'deactivated', performedBy: '李医生', performedAt: '2026-07-01T09:00:00Z', details: '药物库升级后停用旧规则' },
          { id: 'AUD-004', ruleId: 'CDR003', ruleType: 'contrast', action: 'created', performedBy: '张主任', performedAt: '2026-06-25T09:00:00Z', details: '创建造影剂适应症检查规则' },
        ],
      },
    });
  }),

  // ── 规则评估 (RuleConfigPanel): POST /cds/rule/evaluate ──
  // [W2-B-3] 对齐前端 cdsApi.evaluateRule: { results: RuleEvaluateResult[] }
  http.post(`${API}/rule/evaluate`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const examType = String(body?.examType ?? '常规');
    const modality = String(body?.modality ?? 'CT');
    const age = Number(body?.age ?? 40);
    const results: any[] = [
      {
        ruleId: 'contrast-001',
        ruleName: '造影剂适应症检查',
        priority: 1,
        triggered: examType.includes('增强'),
        severity: examType.includes('增强') ? 'warning' : 'info',
        message: examType.includes('增强') ? '增强检查需确认肾功能正常 (eGFR > 30)' : '当前检查类型无需对比剂核查',
        suggestions: examType.includes('增强') ? ['检查血清肌酐水平', '确认 eGFR > 30 mL/min/1.73m²'] : [],
        source: 'ACR Manual on Contrast Media',
      },
      {
        ruleId: 'dose-001',
        ruleName: '辐射剂量优化',
        priority: 2,
        triggered: modality === 'CT' && age < 18,
        severity: modality === 'CT' && age < 18 ? 'warning' : 'info',
        message: modality === 'CT' && age < 18 ? '儿童CT检查建议使用低剂量协议' : '辐射剂量处于常规范围',
        suggestions: modality === 'CT' && age < 18 ? ['启用儿童低剂量协议', '考虑MRI替代检查'] : [],
        source: 'Image Gently Campaign',
      },
      {
        ruleId: 'protocol-001',
        ruleName: '检查协议匹配',
        priority: 3,
        triggered: true,
        severity: 'info',
        message: `推荐检查方案: ${examType}扫描`,
        suggestions: ['标准扫描序列'],
        source: 'RSNA Radiology Protocols',
      },
    ];
    return HttpResponse.json({ success: true, data: { results } });
  }),

  // ── 规则优先级 (RuleConfigPanel): PUT /cds/rule/priority ──
  // [W2-B-3] 对齐后端 cds.controller updateRulePriority: { success }
  http.put(`${API}/rule/priority`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { success: true } });
  }),
];

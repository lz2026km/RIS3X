// [G005 W2] 后端有前端无 端点补齐 MSW handlers (前置注册)
// 覆盖:
//   GET  /clinical-pathways/definitions            (路径定义: 步骤/时长/入排标准)
//   GET  /clinical-pathways/definitions/:id/steps  (路径步骤定义)
//   GET  /dictionary                               (分类列表 {categories,total}; 对齐后端新协议)
//   GET  /tech-ops/emergency/records/:id           (急诊插入记录详情)
//   GET  /eye/subspecialty/:sub                    (旧路径, 等价 /eye/subspecialty/:sub/records)
//   POST /ai/score                                 (AI 报告评分)
// 数据确定性 (无 Math.random), 与后端 service seed 口径一致。
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const nowIso = () => new Date().toISOString()

// ── 1) 临床路径定义 (对齐 backend clinical-pathway.service SEED_PATHWAY_STEPS) ──

interface PathwayStep {
  index: number
  name: string
  dept: string
  durationDays: number
  triggers?: string
  keyCheckpoints?: string[]
}

interface PathwayDefinition {
  id: string
  name: string
  dept: string
  phase: string
  progress: number
  status: 'active' | 'paused' | 'archived'
  patients: number
  version: string
  updatedAt: string
  steps: PathwayStep[]
  inclusion: string
  exclusion: string
}

const PATHWAY_STEPS: Record<string, PathwayStep[]> = {
  'PW-001': [
    { index: 1, name: '门诊初诊登记', dept: '呼吸科', durationDays: 1, triggers: '肺结节影像学报告', keyCheckpoints: ['获取既往影像'] },
    { index: 2, name: '低剂量螺旋 CT (LDCT)', dept: '放射科', durationDays: 3, triggers: '结节 >4mm', keyCheckpoints: ['层厚 ≤1.25mm'] },
    { index: 3, name: 'AI 辅助分析 (肺结节 CAD)', dept: '放射科', durationDays: 1, triggers: '自动触发', keyCheckpoints: ['风险分级 低/中/高'] },
    { index: 4, name: '随访复查预约', dept: '呼吸科', durationDays: 90, triggers: '中危 6 个月/低危 12 个月', keyCheckpoints: ['Fleischner 指南'] },
    { index: 5, name: '增强 CT / PET-CT', dept: '放射科', durationDays: 7, triggers: '高危或可疑恶性', keyCheckpoints: ['分期评估'] },
    { index: 6, name: '肺结节专科门诊', dept: '胸外科', durationDays: 5, triggers: '高危结节', keyCheckpoints: ['手术可行性'] },
    { index: 7, name: '穿刺活检', dept: '介入科', durationDays: 3, triggers: '患者同意', keyCheckpoints: ['病理回报'] },
    { index: 8, name: '多学科会诊 (MDT)', dept: '肿瘤科', durationDays: 7, triggers: '病理确诊', keyCheckpoints: ['治疗方案'] },
  ],
  'PW-002': [
    { index: 1, name: '乳腺筛查登记', dept: '体检中心', durationDays: 1, triggers: '40 岁以上女性', keyCheckpoints: ['高危问卷'] },
    { index: 2, name: '乳腺钼靶 (MG)', dept: '放射科', durationDays: 3, triggers: '常规筛查', keyCheckpoints: ['双体位'] },
    { index: 3, name: '乳腺超声补充', dept: '超声科', durationDays: 2, triggers: '致密型乳腺或 BI-RADS 0', keyCheckpoints: ['BI-RADS 分级'] },
    { index: 4, name: '影像评估 (BI-RADS)', dept: '放射科', durationDays: 1, triggers: '自动', keyCheckpoints: ['4a 及以上转诊'] },
    { index: 5, name: '穿刺活检', dept: '乳腺外科', durationDays: 5, triggers: 'BI-RADS 4-5', keyCheckpoints: ['病理结果'] },
    { index: 6, name: '乳腺癌专科门诊', dept: '乳腺外科', durationDays: 3, triggers: '病理确诊', keyCheckpoints: ['分期'] },
  ],
  'PW-003': [
    { index: 1, name: '急诊分诊 (FAST 评分)', dept: '急诊科', durationDays: 0, triggers: '疑似卒中', keyCheckpoints: ['发病时间 <4.5h'] },
    { index: 2, name: '头颅 CT (平扫)', dept: '放射科', durationDays: 0, triggers: '急诊绿色通道', keyCheckpoints: ['排除出血 25min 内'] },
    { index: 3, name: 'CT 血管成像 (CTA)', dept: '放射科', durationDays: 0, triggers: '缺血性卒中', keyCheckpoints: ['大血管闭塞'] },
    { index: 4, name: 'ASPECTS 评分', dept: '放射科', durationDays: 0, triggers: '前循环梗死', keyCheckpoints: ['≥6 分'] },
    { index: 5, name: '静脉溶栓 (rt-PA)', dept: '神经内科', durationDays: 0, triggers: '时间窗内无禁忌', keyCheckpoints: ['Door-to-Needle <60min'] },
    { index: 6, name: '机械取栓评估', dept: '介入科', durationDays: 1, triggers: '大血管闭塞', keyCheckpoints: ['M1/ICA 闭塞'] },
  ],
  'PW-004': [
    { index: 1, name: '门诊评估 (Framingham 评分)', dept: '心内科', durationDays: 1, triggers: '胸痛/冠心病高危', keyCheckpoints: ['危险分层'] },
    { index: 2, name: '冠脉 CTA', dept: '放射科', durationDays: 3, triggers: '中危', keyCheckpoints: ['CAD-RADS 分级'] },
    { index: 3, name: '负荷心肌灌注 (SPECT/CMR)', dept: '核医学科', durationDays: 5, triggers: 'CTA 中重度狭窄', keyCheckpoints: ['缺血范围'] },
    { index: 4, name: '冠脉造影 (CAG)', dept: '导管室', durationDays: 3, triggers: '功能学阳性', keyCheckpoints: ['FFR 测量'] },
    { index: 5, name: '血运重建 (PCI/CABG)', dept: '心内科', durationDays: 7, triggers: '造影决策', keyCheckpoints: ['完全血运重建'] },
  ],
  'PW-005': [
    { index: 1, name: '急诊创伤评估 (ATLS)', dept: '急诊科', durationDays: 0, triggers: '创伤患者', keyCheckpoints: ['气道/循环稳定'] },
    { index: 2, name: 'X 线/CT 检查', dept: '放射科', durationDays: 0, triggers: '疑似骨折', keyCheckpoints: ['骨折部位确认'] },
    { index: 3, name: '骨折分型评估', dept: '骨科', durationDays: 1, triggers: '影像确诊', keyCheckpoints: ['AO 分型'] },
    { index: 4, name: '手法复位/石膏固定', dept: '骨科', durationDays: 1, triggers: '无移位/可复位', keyCheckpoints: ['复位后复查 X 线'] },
    { index: 5, name: '手术内固定', dept: '骨科', durationDays: 3, triggers: '不稳定骨折', keyCheckpoints: ['钢板/髓内钉'] },
  ],
}

const PATHWAY_DEFINITIONS: PathwayDefinition[] = [
  {
    id: 'PW-001', name: '肺结节随访路径', dept: '呼吸科', phase: '随访复查', progress: 0.65, status: 'active',
    patients: 128, version: 'v1.3', updatedAt: '2026-07-28T08:00:00.000Z', steps: PATHWAY_STEPS['PW-001']!,
    inclusion: '影像学发现肺结节(≥4mm)或肺癌高危人群筛查', exclusion: '晚期转移性肺癌、无法耐受手术',
  },
  {
    id: 'PW-002', name: '乳腺癌筛查路径', dept: '乳腺外科', phase: '影像评估', progress: 0.4, status: 'active',
    patients: 86, version: 'v2.1', updatedAt: '2026-07-27T09:30:00.000Z', steps: PATHWAY_STEPS['PW-002']!,
    inclusion: '40-69 岁女性常规筛查或乳腺自查异常', exclusion: '妊娠期、既往乳腺癌根治术后',
  },
  {
    id: 'PW-003', name: '卒中绿色通道', dept: '神经内科', phase: '溶栓评估', progress: 0.8, status: 'active',
    patients: 42, version: 'v1.0', updatedAt: '2026-07-28T10:00:00.000Z', steps: PATHWAY_STEPS['PW-003']!,
    inclusion: '疑似急性缺血性卒中(发病 <4.5h)', exclusion: '出血性卒中、发病 >4.5h 且无影像学支持',
  },
  {
    id: 'PW-004', name: '骨科术后康复路径', dept: '骨科', phase: '术后康复', progress: 0.3, status: 'paused',
    patients: 57, version: 'v1.1', updatedAt: '2026-07-20T14:00:00.000Z', steps: PATHWAY_STEPS['PW-004']!,
    inclusion: '四肢/骨盆闭合性骨折(无血管神经损伤)', exclusion: '开放性骨折伴神经血管损伤、病理性骨折',
  },
  {
    id: 'PW-005', name: '心血管CTA路径', dept: '心内科', phase: '随访', progress: 1, status: 'archived',
    patients: 214, version: 'v3.0', updatedAt: '2026-06-30T16:00:00.000Z', steps: PATHWAY_STEPS['PW-005']!,
    inclusion: '冠心病高危或确诊冠心病患者', exclusion: '急性心梗 STEMI(走胸痛中心路径)',
  },
]

// ── 3) 数据字典分类 (对齐 backend dictionary.service.listCategories) ──

const DICT_CATEGORIES = [
  { category: '诊断术语', count: 24, activeCount: 22 },
  { category: '检查部位', count: 18, activeCount: 18 },
  { category: '报告模板分类', count: 9, activeCount: 8 },
  { category: '危急值类型', count: 13, activeCount: 13 },
]

export const w2OrphansHandlers = [
  // ── 1) 临床路径定义 (静态路径需先于 /clinical-pathways/:id/steps) ──
  http.get(`${API_BASE}/clinical-pathways/definitions`, async () => {
    await delay(120)
    return HttpResponse.json({ success: true, data: PATHWAY_DEFINITIONS })
  }),

  http.get(`${API_BASE}/clinical-pathways/definitions/:id/steps`, async ({ params }) => {
    await delay(90)
    const steps = PATHWAY_STEPS[String(params.id)] ?? []
    return HttpResponse.json({ success: true, data: steps })
  }),

  // ── 3) 数据字典分类列表 (GET /dictionary, 对齐后端 { categories, total }) ──
  //   旧条目协议 (category/keyword 过滤) 已废弃: 前端改用 /dictionary/categories + /dictionary/:category
  http.get(`${API_BASE}/dictionary`, async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    if (url.searchParams.has('category') || url.searchParams.has('keyword')) {
      return HttpResponse.json({ success: true, data: [] })
    }
    return HttpResponse.json({
      success: true,
      data: { categories: DICT_CATEGORIES, total: DICT_CATEGORIES.length },
    })
  }),

  // ── 6) 技师工作站: 急诊插入记录详情 ──
  http.get(`${API_BASE}/tech-ops/emergency/records/:id`, async ({ params }) => {
    await delay(60)
    const id = String(params.id)
    return HttpResponse.json({
      success: true,
      data: {
        id,
        patientName: '孙立军',
        examItem: '头部外伤 CT',
        modality: 'CT',
        priority: 'STAT',
        deviceId: 'dev-ct-1',
        deviceName: 'CT 一室 (16排)',
        technician: '刘技师',
        startMin: 495,
        startAt: '2026-08-16T08:15:00.000Z',
        endMin: 510,
        endAt: '2026-08-16T08:30:00.000Z',
        status: 'INSERTED',
        conflictCount: 1,
        adjustments: [
          { examId: 'ex-104', patientName: '张建国', examItem: '胸部 CT 平扫', originalStartMin: 495, suggestedStartMin: 525, suggestedDeviceId: 'dev-ct-2', suggestedDeviceName: 'CT 二室 (64排)', action: 'MOVE_DEVICE' },
        ],
        reason: '急诊抢救通道',
        createdAt: '2026-08-16T08:10:00.000Z',
      },
    })
  }),

  // ── 9) 眼科亚专科检查记录 (旧路径 GET /eye/subspecialty/:sub, 等价 /:sub/records) ──
  http.get(`${API_BASE}/eye/subspecialty/:sub`, async ({ params, request }) => {
    await delay(80)
    const sub = String(params.sub)
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId') ?? 'P001'
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: `SR-${sub}-001`,
          subspecialty: sub,
          patientId,
          patientName: '陈晓明',
          diagnosis: '随访观察,未见进展',
          examDate: '2026-08-12',
          findings: { note: '亚专科检查记录 (旧路径)' },
        },
      ],
    })
  }),

  // ── 8) AI 报告评分 (POST /ai/score, 对齐 backend modules/ai ai.service.scoreReport) ──
  http.post(`${API_BASE}/ai/score`, async ({ request }) => {
    await delay(150)
    const body = (await request.json().catch(() => ({}))) as {
      radsCategory?: string
    }
    const totalScore = body.radsCategory ? 85 : 70
    return HttpResponse.json({
      success: true,
      data: {
        totalScore,
        grade: totalScore >= 80 ? 'B' : 'C',
        evaluatedAt: nowIso(),
      },
    })
  }),
]

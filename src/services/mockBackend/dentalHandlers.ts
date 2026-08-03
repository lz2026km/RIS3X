// [v3.0.6.8-53] PR 口腔: 口腔专科 handlers (82 端点)
// 对标: 3Shape / Sirona / Planmeca / Carestream / 朗呈 (国产)
// Day 1: 影像 PACS (24 端点) | Day 2: 牙位图 (12 端点) + AI (8 端点)
// Day 3: 治疗管理 (20 端点) | Day 4: 管理 + 远程 (18 端点)
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { getDentalChart } from '../../data/dental/dentalChartMock';
import { MOCK_DENTAL_STUDIES, getDentalStudiesByModality, getDentalStudiesByPatient, getDentalStudyById } from '../../data/dental/dentalImagingMock';
import { MOCK_CAD_DESIGNS, MOCK_CAD_MATERIALS, MOCK_VITA_SHADES, MOCK_MILLING_UNITS } from '../../data/dental/dentalCadMock';
import { MOCK_IMPLANT_BRANDS, MOCK_IMPLANT_PLANS_3D, MOCK_NERVE_3D, MOCK_BONE_DENSITY_MAP, MOCK_NERVE_DISTANCES } from '../../data/dental/dentalImplant3dMock';
import { MOCK_SURGICAL_GUIDES, MOCK_GUIDE_SLEEVES, MOCK_ABUTMENT_OPTIONS, MOCK_GUIDE_MATERIALS } from '../../data/dental/dentalGuideMock';
import { MOCK_CEPH_STUDIES, MOCK_LANDMARKS, MOCK_ANALYSIS_TYPES, MOCK_STEINER_ANALYSIS, MOCK_ARCH_ANALYSIS } from '../../data/dental/dentalCephMock';
import { MOCK_ALIGNER_PLANS, generateMockStages, MOCK_ALIGNER_PROGRESS, MOCK_ARCH_3D } from '../../data/dental/dentalAlignerMock';
import { MOCK_VOLUME_STUDIES, MOCK_VOLUME_RENDER_PRESETS, generateMockVolumeSlices, MOCK_ARCH_SPLINE, MOCK_3D_MESH_META } from '../../data/dental/dentalVolumeMock';
import { MOCK_DENTAL_PATIENTS, MOCK_PATIENT_TREATMENT_HISTORY, MOCK_PATIENT_APPOINTMENTS, MOCK_PATIENT_RECALLS, MOCK_PATIENT_CONSENTS, MOCK_PATIENT_PRESCRIPTIONS, MOCK_PATIENT_BILLING } from '../../data/dental/dentalEmrMock';
import { MOCK_FEE_CATALOG, MOCK_INVOICES, MOCK_PAYMENT_METHODS, MOCK_PATIENT_INSURANCE } from '../../data/dental/dentalBillingMock';
import { MOCK_DENTAL_CHAIRS, MOCK_DENTISTS, generateMockAppointments, MOCK_PSR_RECORDS, MOCK_SCHEDULE_STATS } from '../../data/dental/dentalSchedMock';
import { MOCK_AIRWAY_ANALYSIS, MOCK_BONE_AGE, MOCK_IMPACTED_RISK, MOCK_SEGMENTATION_RESULT, MOCK_CYST_DETECTION, MOCK_AI_REPORT_TEMPLATES } from '../../data/dental/dentalAiEnhanceMock';

const DENTAL_API = '/api/v1/dental';

// ============= Day 1: 影像 PACS (24 端点) =============
const dentalImagingModule = [
  // 影像 CRUD
  http.get(`${DENTAL_API}/studies`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const toothNo = url.searchParams.get('toothNo');
    // [v3.0.6.8-81] 优先查 store 中新增的, fallback 到 mock
    let storeItems: any[] = [];
    try { storeItems = list<any>('dental_studies'); } catch {}
    const combined = [...storeItems, ...MOCK_DENTAL_STUDIES];
    const dedup = Array.from(new Map(combined.map(s => [s.id, s])).values());
    let filtered = dedup;
    if (toothNo) {
      const tn = parseInt(toothNo);
      filtered = dedup.filter((s: any) => s.toothNumbers?.includes(tn));
    }
    const result = applyQuery(filtered, opts, ['patientName', 'indication', 'modality', 'region']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total, library: 'dental_imaging' } });
  }),
  http.get(`${DENTAL_API}/studies/:id`, async ({ params }) => {
    await delay(50);
    // [v3.0.6.8-81] 先查 store, fallback mock
    let s: any = null;
    try { s = get<any>('dental_studies', params.id as string); } catch {}
    if (!s) s = MOCK_DENTAL_STUDIES.find(x => x.id === params.id);
    if (!s) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),
  http.post(`${DENTAL_API}/studies`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `STU${Date.now()}`, createdAt: new Date().toISOString() };
    try { create('dental_studies', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${DENTAL_API}/studies/:id`, async ({ params, request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const updated = update<any>('dental_studies', params.id as string, { ...body, updatedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.delete(`${DENTAL_API}/studies/:id`, async ({ params }) => {
    await delay(50);
    const ok = remove('dental_studies', params.id as string);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),
  // 影像路径
  
  // 分割
  http.get(`${DENTAL_API}/studies/:id/segments`, async ({ params }) => {
    await delay(30);
    const s = MOCK_DENTAL_STUDIES.find(x => x.id === params.id);
    return HttpResponse.json({ success: true, data: { segments: s?.segments || [] } });
  }),
  http.post(`${DENTAL_API}/studies/:id/segment`, async ({ params, request }) => {
    await delay(2000); // 模拟 AI 分割耗时
    const body = (await request.json()) as { model?: string };
    const newSeg = {
      id: `seg-${Date.now()}`,
      type: body.model || 'tooth',
      label: '自动分割结果',
      volume: 100,
      color: '#52c41a',
    };
    // [v3.0.6.8-81] 写回 study.segments
    try {
      const existing = get<any>('dental_studies', params.id as string)
        || MOCK_DENTAL_STUDIES.find(x => x.id === params.id);
      if (existing) {
        const segs = existing.segments || [];
        update<any>('dental_studies', params.id as string, { segments: [...segs, newSeg] });
      }
    } catch {}
    return HttpResponse.json({ success: true, data: newSeg }, { status: 201 });
  }),
  // MPR
  http.get(`${DENTAL_API}/studies/:id/mpr`, async ({ params }) => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: {
        axes: ['axial', 'sagittal', 'coronal'],
        sliceCount: 100,
        resolution: '512x512',
        format: 'DICOM',
      },
    });
  }),
  // 3D 模型
  http.get(`${DENTAL_API}/studies/:id/3d-model`, async ({ params }) => {
    await delay(200);
    const s = MOCK_DENTAL_STUDIES.find(x => x.id === params.id);
    return HttpResponse.json({
      success: true,
      data: {
        modelUrl: `/api/v1/dental/studies/${params.id}/3d-model.stl`,
        format: s?.modality === 'Scan' ? 'STL' : 'OBJ',
        triangleCount: 50000,
        size: '2.4 MB',
      },
    });
  }),
  // CBCT 专项
  http.get(`${DENTAL_API}/cbct/list`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: getDentalStudiesByModality('CBCT').slice(0, 50) });
  }),
  http.get(`${DENTAL_API}/cbct/:id/nerve-canal`, async ({ params }) => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: {
        lowerAlveolarNerve: { path: [[100, 200, 50], [105, 210, 55], [110, 220, 60]], diameter: 3.2, safeDistance: 8.5 },
        mentalForamen: { left: { x: 45, y: 180, z: 30 }, right: { x: 155, y: 180, z: 30 } },
      },
    });
  }),
  http.get(`${DENTAL_API}/cbct/:id/bone-density`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        regions: [
          { region: '下颌前牙区', density: 850, unit: 'HU' },
          { region: '下颌后牙区', density: 1100, unit: 'HU' },
          { region: '上颌前牙区', density: 720, unit: 'HU' },
          { region: '上颌后牙区', density: 480, unit: 'HU' },
          { region: '颏部', density: 1450, unit: 'HU' },
        ],
      },
    });
  }),
  http.get(`${DENTAL_API}/cbct/:id/measure`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        measurements: [
          { id: 'meas-1', type: 'distance', label: '缺牙区骨高度', value: 12.5, unit: 'mm' },
          { id: 'meas-2', type: 'distance', label: '下牙槽神经管距牙槽嵴', value: 15.2, unit: 'mm' },
          { id: 'meas-3', type: 'angle', label: '下颌平面角', value: 28.5, unit: '°' },
        ],
      },
    });
  }),
  // 全景片
  http.get(`${DENTAL_API}/panoramic/list`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: getDentalStudiesByModality('Panoramic').slice(0, 50) });
  }),
  http.get(`${DENTAL_API}/panoramic/:id`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_DENTAL_STUDIES.find(x => x.id === params.id) });
  }),
  // 根尖片
  http.get(`${DENTAL_API}/periapical/list`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: getDentalStudiesByModality('Periapical').slice(0, 50) });
  }),
  http.get(`${DENTAL_API}/periapical/:id`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_DENTAL_STUDIES.find(x => x.id === params.id) });
  }),
  // 口扫
  http.get(`${DENTAL_API}/scan/list`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: getDentalStudiesByModality('Scan').slice(0, 50) });
  }),
  http.get(`${DENTAL_API}/scan/:id/model`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { modelUrl: `/api/v1/dental/scan/${params.id}/model.stl`, format: 'STL' } });
  }),
  http.get(`${DENTAL_API}/scan/:id/compare`, async ({ params }) => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: { differences: { volume: 0.12, surfaceArea: 0.05, toothMovement: [] } },
    });
  }),
  http.post(`${DENTAL_API}/scan/:id/align`, async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as { targetScanId: string };
    return HttpResponse.json({ success: true, data: { aligned: true, targetScanId: body.targetScanId } });
  }),
  // 咬合翼片
  http.get(`${DENTAL_API}/bitewing/list`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: getDentalStudiesByModality('Bitewing').slice(0, 50) });
  }),
  // 影像对比
  http.get(`${DENTAL_API}/compare/:idA/:idB`, async ({ params }) => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        studyA: MOCK_DENTAL_STUDIES.find(x => x.id === params.idA),
        studyB: MOCK_DENTAL_STUDIES.find(x => x.id === params.idB),
        differences: ['36 牙位骨密度变化', '根尖周透亮影增加', '下牙槽神经管位置未变'],
      },
    });
  }),
  // 龋齿 on-image (Day 1 早期 AI)
  
];


const FDI_TEETH = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];

const dentalChartAiModule = [
  // 获取患者牙位图
  http.get(`${DENTAL_API}/chart/:patientId`, async ({ params }) => {
    await delay(50);
    const chart = list<any>('dental_charts').length > 0 ? get<any>('dental_charts', params.patientId as string) : null;
    if (chart) return HttpResponse.json({ success: true, data: chart });
    // 从 mock 获取
    const mockChart = getDentalChart(params.patientId as string);
    if (mockChart) return HttpResponse.json({ success: true, data: mockChart });
    return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
  }),

  // 更新单牙状态
  

  // 牙面状态
  

  // 牙周记录
  

  // 牙位图历史
  

  // 牙位图模板
  

  // 编号系统
  

  // 导入牙位图
  

  // 导出牙位图
  

  // 治疗计划 (牙位图关联)
  

  // 复诊安排
  

  // 删除牙记录
  

  // 龋齿检测 AI
  http.post(`${DENTAL_API}/ai/caries-detection`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as { imageBase64?: string; modality?: string };
    return HttpResponse.json({
      success: true,
      data: {
        detections: [
          { toothNo: '16', surface: 'O', confidence: 0.88, severity: 'moderate', bbox: [100, 80, 180, 150] },
          { toothNo: '36', surface: 'M', confidence: 0.75, severity: 'mild', bbox: [280, 90, 350, 160] },
          { toothNo: '24', surface: 'O', confidence: 0.62, severity: 'incipient', bbox: [200, 70, 260, 140] },
        ],
        analysisTimeMs: 450,
        model: 'dental-yolov8n-v1.3',
        method: 'backend-mock',
      },
    });
  }),

  // 根尖周炎分级 AI
  http.post(`${DENTAL_API}/ai/periapical-grading`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { imageBase64?: string };
    return HttpResponse.json({
      success: true,
      data: {
        periapicalIndex: 2.5,
        rcpScore: 7,
        lesions: [
          { toothNo: '36', region: 'mesial-root', diameter: 4.2, unit: 'mm', stage: 'RCP-stage-2' },
        ],
        confidence: 0.82,
      },
    });
  }),

  // 牙周骨丧失测量 AI
  http.post(`${DENTAL_API}/ai/bone-loss`, async ({ request }) => {
    await delay(350);
    const body = (await request.json()) as { imageBase64?: string };
    return HttpResponse.json({
      success: true,
      data: {
        boneLoss: { maxilla: 15, mandible: 22, unit: '%' },
        furcationInvolvements: ['36-buccal', '37-mesial'],
        confidence: 0.78,
      },
    });
  }),

  // 根管检测 AI
  http.post(`${DENTAL_API}/ai/root-canal-detection`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { imageBase64?: string };
    return HttpResponse.json({
      success: true,
      data: {
        canals: [
          { toothNo: '36', canalCount: 3, filled: 2, missed: 'mesiolingual', difficulty: 'moderate' },
          { toothNo: '46', canalCount: 2, filled: 2, missed: null, difficulty: 'easy' },
        ],
      },
    });
  }),

  // 口腔黏膜筛查 AI
  http.post(`${DENTAL_API}/ai/oral-cavity-screening`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { imageBase64?: string };
    return HttpResponse.json({
      success: true,
      data: {
        findings: [
          { location: '左侧颊黏膜', type: 'leukoplakia', probability: 0.72, risk: 'moderate' },
          { location: '舌腹', type: 'normal', probability: 0.91, risk: 'low' },
        ],
      },
    });
  }),

  // AI 模型列表
  

  // AI 检测历史
  

  // AI 反馈
  
];

import { MOCK_DENTAL_TREATMENTS } from '../../data/dental/dentalTreatmentMock';

// ============= Day 3: 治疗管理 (20 端点) =============
const dentalTreatmentModule = [
  // 治疗列表
  http.get(`${DENTAL_API}/treatments`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(MOCK_DENTAL_TREATMENTS, opts, ['patientName', 'diagnosis', 'type']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${DENTAL_API}/treatments/:id`, async ({ params }) => {
    await delay(40);
    const t = MOCK_DENTAL_TREATMENTS.find(x => x.id === params.id) || get<any>('dental_treatments', params.id as string);
    if (!t) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: t });
  }),
  http.post(`${DENTAL_API}/treatments`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `TREAT${Date.now()}`, createdAt: new Date().toISOString() };
    try { create('dental_treatments', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${DENTAL_API}/treatments/:id`, async ({ params, request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, ...body, updatedAt: new Date().toISOString() } });
  }),
  http.post(`${DENTAL_API}/treatments/:id/start`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'InProgress', startedAt: new Date().toISOString() } });
  }),
  http.post(`${DENTAL_API}/treatments/:id/complete`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'Completed', completedAt: new Date().toISOString() } });
  }),
  
  
  
  http.get(`${DENTAL_API}/treatments/types`, async () => {
    await delay(20);
    return HttpResponse.json({ success: true, data: ['Restorative','Endodontic','Periodontal','Implant','Orthodontic','Extraction','Surgery','Pediatric'] });
  }),
  
  
  
  
  
  
  http.get(`${DENTAL_API}/ortho/plans`, async ({ request }) => {
    await delay(50);
    // [v3.0.6.11-60] 合并 store 新建病例
    let storeItems: any[] = [];
    try { storeItems = list<any>('dental_treatments').filter((t: any) => t.type === 'Orthodontic'); } catch {}
    return HttpResponse.json({ success: true, data: [...storeItems, ...MOCK_DENTAL_TREATMENTS.filter(t => t.type === 'Orthodontic').slice(0, 10)] });
  }),
  http.post(`${DENTAL_API}/ortho/plans`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { planId: `ORTHO${Date.now()}`, ...body } }, { status: 201 });
  }),
  
  
];

// [v3.0.6.8-87] Phase 1: 修复 CAD/CAM (15 端点) =============
const dentalCadModule = [
  // 材料列表
  http.get(`${DENTAL_API}/cad/materials`, async () => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_CAD_MATERIALS });
  }),
  // VITA 比色板
  http.get(`${DENTAL_API}/cad/shades`, async () => {
    await delay(20);
    return HttpResponse.json({ success: true, data: MOCK_VITA_SHADES });
  }),
  // 研磨机列表
  http.get(`${DENTAL_API}/cad/milling-units`, async () => {
    await delay(20);
    return HttpResponse.json({ success: true, data: MOCK_MILLING_UNITS });
  }),
  // 开始设计
  http.post(`${DENTAL_API}/cad/design`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newDesign = {
      id: `CAD-${Date.now()}`,
      ...body,
      marginLine: Array.from({length:12},(_,i)=>[200+Math.sin(i/12*Math.PI*2)*30,200+Math.cos(i/12*Math.PI*2)*30]),
      occlusalAnatomy: 'anatomic', thickness: 1.5, cementGap: 30, contactStrength: 'normal',
      status: 'draft', designTime: 0, designer: 'Dr. CAD',
      createdAt: new Date().toISOString(),
    };
    try { create('cad_designs', newDesign); } catch {}
    return HttpResponse.json({ success: true, data: newDesign }, { status: 201 });
  }),
  // 获取设计
  http.get(`${DENTAL_API}/cad/design/:id`, async ({ params }) => {
    await delay(40);
    let d: any = null;
    try { d = get<any>('cad_designs', params.id as string); } catch {}
    if (!d) d = MOCK_CAD_DESIGNS.find(x => x.id === params.id);
    if (!d) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: d });
  }),
  // 设计列表
  
  // 保存边缘线
  http.put(`${DENTAL_API}/cad/design/:id/margin-line`, async ({ params, request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, marginLine: body.marginLine, updatedAt: new Date().toISOString() } });
  }),
  // 保存解剖形态参数
  http.put(`${DENTAL_API}/cad/design/:id/anatomy`, async ({ params, request }) => {
    await delay(40);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, ...body, updatedAt: new Date().toISOString() } });
  }),
  // 生成 3D 预览
  http.post(`${DENTAL_API}/cad/design/:id/preview`, async ({ params }) => {
    await delay(500);
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id,
        previewUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
        stlUrl: `/api/v1/dental/cad/design/${params.id}/model.stl`,
        triangleCount: 18500,
        volume: 0.28,
        facets: ['occlusal','buccal','lingual','mesial','distal'].map(f => ({ facet: f, quality: 'good' })),
      },
    });
  }),
  // 导出 STL
  http.post(`${DENTAL_API}/cad/design/:id/export-stl`, async ({ params }) => {
    await delay(200);
    return HttpResponse.json({ success: true, data: { url: `/api/v1/dental/cad/design/${params.id}/model.stl`, format: 'STL', size: '1.2 MB' } });
  }),
  // 更新设计状态
  http.put(`${DENTAL_API}/cad/design/:id/status`, async ({ params, request }) => {
    await delay(40);
    const body = (await request.json()) as { status: string };
    return HttpResponse.json({ success: true, data: { id: params.id, status: body.status, updatedAt: new Date().toISOString() } });
  }),
  // 提交研磨
  http.post(`${DENTAL_API}/cad/design/:id/submit-mill`, async ({ params, request }) => {
    await delay(300);
    const body = (await request.json()) as { millingUnit: string };
    return HttpResponse.json({
      success: true,
      data: { id: params.id, millingUnit: body.millingUnit, submittedAt: new Date().toISOString(), estimatedTime: '15min', status: 'milling' },
    });
  }),
  // 研磨状态查询
  http.get(`${DENTAL_API}/cad/milling-status/:id`, async ({ params }) => {
    await delay(20);
    return HttpResponse.json({
      success: true,
      data: { id: params.id, status: 'in-progress', progress: 65, estimatedRemaining: '5min', errors: [] },
    });
  }),
  // 设计模板列表
  http.get(`${DENTAL_API}/cad/templates`, async () => {
    await delay(30);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'tpl-1', name: '标准全冠 (前磨牙)', type: 'crown', anatomy: 'anatomic', thickness: 1.5 },
        { id: 'tpl-2', name: '标准全冠 (磨牙)', type: 'crown', anatomy: 'semi-anatomic', thickness: 1.5 },
        { id: 'tpl-3', name: '嵌体 MOD 预备型', type: 'inlay', anatomy: 'semi-anatomic', thickness: 2.0 },
        { id: 'tpl-4', name: '贴面 (前牙)', type: 'veneer', anatomy: 'anatomic', thickness: 0.8 },
      ],
    });
  }),
];

// [v3.0.6.8-88] Phase 1: 种植 3D 规划 (12 端点)
const dentalImplant3dModule = [
  // 种植体品牌/型号库
  http.get(`${DENTAL_API}/implant/inventory/brands`, async () => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_IMPLANT_BRANDS.map(b=>({id:b.id,name:b.name,country:b.country,modelCount:b.models.length})) });
  }),
  
  // 3D 种植规划 CRUD
  http.post(`${DENTAL_API}/implant/plan-3d`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newPlan = {
      id: `IMP3D-${Date.now()}`,
      ...body,
      entryPoint: { x: 150, y: 120, z: 80 },
      apexPoint: { x: 148, y: 109, z: 30 },
      distanceToNerve: 3.5, boneDensityAtApex: 800,
      status: 'planning', guideDesigned: false,
      createdAt: new Date().toISOString(),
    };
    try { create('implant_plans_3d', newPlan); } catch {}
    return HttpResponse.json({ success: true, data: newPlan }, { status: 201 });
  }),
  http.get(`${DENTAL_API}/implant/plan-3d/:id`, async ({ params }) => {
    await delay(40);
    let p: any = null;
    try { p = get<any>('implant_plans_3d', params.id as string); } catch {}
    if (!p) p = MOCK_IMPLANT_PLANS_3D.find(x => x.id === params.id);
    if (!p) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: p });
  }),
  http.get(`${DENTAL_API}/implant/plan-3d`, async () => {
    await delay(50);
    let list: any[] = [];
    try { list = list<any>('implant_plans_3d'); } catch {}
    return HttpResponse.json({ success: true, data: [...list, ...MOCK_IMPLANT_PLANS_3D] });
  }),
  http.put(`${DENTAL_API}/implant/plan-3d/:id/placement`, async ({ params, request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, ...body, updatedAt: new Date().toISOString() } });
  }),
  http.put(`${DENTAL_API}/implant/plan-3d/:id/implant`, async ({ params, request }) => {
    await delay(50);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, brand: body.brand, model: body.model, updatedAt: new Date().toISOString() } });
  }),
  http.get(`${DENTAL_API}/implant/plan-3d/:id/nerve-distance`, async ({ params }) => {
    await delay(50);
    const plan = MOCK_IMPLANT_PLANS_3D.find(x => x.id === params.id);
    return HttpResponse.json({
      success: true,
      data: {
        distances: MOCK_NERVE_DISTANCES,
        nervePath: MOCK_NERVE_3D,
        closestNerve: { distance: plan?.distanceToNerve || 3.2, safe: (plan?.distanceToNerve || 3.2) > 2, position: { x: 150, y: 115, z: 35 } },
      },
    });
  }),
  http.post(`${DENTAL_API}/implant/plan-3d/:id/bone-density-roi`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: {
        studyId: params.id,
        roi: body.roi || { x: 145, y: 110, z: 30, radius: 3 },
        ...MOCK_BONE_DENSITY_MAP,
      },
    });
  }),
  http.post(`${DENTAL_API}/implant/plan-3d/:id/nerve-mark`, async ({ params, request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { planId: params.id, markedPoints: body.points } });
  }),
  http.post(`${DENTAL_API}/implant/plan-3d/:id/validate`, async ({ params }) => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: { valid: true, collision: false, minDistanceToNerve: 3.2, warnings: [], decisions: [ { key: '36 distal bone', action: '注意远中骨量', severity: 'info' } ] },
    });
  }),
  http.post(`${DENTAL_API}/implant/plan-3d/:id/approve`, async ({ params }) => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'approved', approvedAt: new Date().toISOString() } });
  }),
];

// [v3.0.6.8-89] Phase 1: 导板 + 上部 + 种植体库 (8 端点)
const dentalGuideModule = [
  
  
  http.get(`${DENTAL_API}/guide/materials`, async () => {
    await delay(20);
    return HttpResponse.json({ success: true, data: MOCK_GUIDE_MATERIALS });
  }),
  http.get(`${DENTAL_API}/guide/list`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: MOCK_SURGICAL_GUIDES });
  }),
  http.post(`${DENTAL_API}/guide`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newGuide = { id: `GUIDE-${Date.now()}`, ...body, status: 'designing', createdAt: new Date().toISOString() };
    try { create('surgical_guides', newGuide); } catch {}
    return HttpResponse.json({ success: true, data: newGuide }, { status: 201 });
  }),
  http.put(`${DENTAL_API}/guide/:id/sleeve`, async ({ params, request }) => {
    await delay(40);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, sleeve: body.sleeveType } });
  }),
  http.post(`${DENTAL_API}/guide/:id/export`, async ({ params }) => {
    await delay(300);
    return HttpResponse.json({ success: true, data: { url: `/dental/guides/${params.id}.stl`, format: 'STL', size: '3.5 MB', estimatedPrintTime: '4h' } });
  }),
  http.get(`${DENTAL_API}/implant/inventory/price-check`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const brand = url.searchParams.get('brand');
    const models = url.searchParams.get('models')?.split(',') || [];
    return HttpResponse.json({ success: true, data: models.map(m => {
      const item = MOCK_IMPLANT_BRANDS.flatMap(b => b.models).find(mo => mo.id === m);
      return { modelId: m, brand, price: item?.price || 0 };
    })     });
  }),
];

// [v3.0.6.8-90] Phase 2: 头影测量分析 (12 端点)
const dentalCephModule = [
  http.get(`${DENTAL_API}/ceph/studies`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const pid = url.searchParams.get('patientId');
    let list = MOCK_CEPH_STUDIES;
    if (pid) list = list.filter(s => s.patientId === pid);
    return HttpResponse.json({ success: true, data: list });
  }),
  http.get(`${DENTAL_API}/ceph/studies/:id`, async ({ params }) => {
    await delay(30);
    const s = MOCK_CEPH_STUDIES.find(x => x.id === params.id);
    if (!s) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),
  http.post(`${DENTAL_API}/ceph/studies`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newStudy = { id: `CEPH-${Date.now()}`, ...body, status: 'pending', acquisitionDate: new Date().toISOString().slice(0,10) };
    try { create('ceph_studies', newStudy); } catch {}
    return HttpResponse.json({ success: true, data: newStudy }, { status: 201 });
  }),
  http.get(`${DENTAL_API}/ceph/landmarks`, async () => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_LANDMARKS });
  }),
  http.put(`${DENTAL_API}/ceph/:id/landmarks`, async ({ params, request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { studyId: params.id, landmarks: body.landmarks, updatedAt: new Date().toISOString() } });
  }),
  http.get(`${DENTAL_API}/ceph/:id/analysis`, async ({ params }) => {
    await delay(80);
    const study = MOCK_CEPH_STUDIES.find(x => x.id === params.id);
    if (!study || !study.analysisType) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: { ...MOCK_STEINER_ANALYSIS, analysisType: study.analysisType, studyId: params.id } });
  }),
  http.get(`${DENTAL_API}/ceph/analysis-types`, async () => {
    await delay(20);
    return HttpResponse.json({ success: true, data: MOCK_ANALYSIS_TYPES });
  }),
  http.post(`${DENTAL_API}/ceph/:id/analysis`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as { type: string };
    return HttpResponse.json({ success: true, data: { studyId: params.id, ...MOCK_STEINER_ANALYSIS, analysisType: body.type || 'steiner', performedAt: new Date().toISOString() } });
  }),
  
  
  // 牙弓分析
  http.post(`${DENTAL_API}/ortho/arch-analysis`, async ({ request }) => {
    await delay(80);
    return HttpResponse.json({ success: true, data: MOCK_ARCH_ANALYSIS });
  }),
  
];

// [v3.0.6.8-92] Phase 2: 隐形矫治 (10 端点)
const dentalAlignerModule = [
  http.get(`${DENTAL_API}/ortho/aligner-plans`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: MOCK_ALIGNER_PLANS });
  }),
  http.post(`${DENTAL_API}/ortho/aligner-plans`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newPlan = { id: `ALIGN-${Date.now()}`, ...body, currentStage: 0, status: 'pending', createdAt: new Date().toISOString() };
    try { create('aligner_plans', newPlan); } catch {}
    return HttpResponse.json({ success: true, data: newPlan }, { status: 201 });
  }),
  http.get(`${DENTAL_API}/ortho/aligner-plans/:id`, async ({ params }) => {
    await delay(30);
    let p: any = null;
    try { p = get<any>('aligner_plans', params.id as string); } catch {}
    if (!p) p = MOCK_ALIGNER_PLANS.find(x => x.id === params.id);
    if (!p) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: p });
  }),
  http.get(`${DENTAL_API}/ortho/aligner-plans/:id/stages`, async ({ params }) => {
    await delay(80);
    const plan = MOCK_ALIGNER_PLANS.find(x => x.id === params.id);
    const stages = generateMockStages(plan?.totalStages || 24);
    return HttpResponse.json({ success: true, data: Object.entries(stages).map(([k, v]) => ({ stage: parseInt(k), toothMovements: v })) });
  }),
  http.put(`${DENTAL_API}/ortho/aligner-plans/:id/stage/:stage`, async ({ params, request }) => {
    await delay(50);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { planId: params.id, stage: parseInt(params.stage as string), ...body } });
  }),
  http.post(`${DENTAL_API}/ortho/aligner-plans/:id/approve`, async ({ params }) => {
    await delay(80);
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'approved', approvedAt: new Date().toISOString() } });
  }),
  http.get(`${DENTAL_API}/ortho/aligner-plans/:id/progress`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({ success: true, data: { ...MOCK_ALIGNER_PROGRESS, planId: params.id } });
  }),
  
  // 头影 + 隐形矫治综合
  
  // 生产订单
  http.post(`${DENTAL_API}/ortho/aligner-plans/:id/order-lab`, async ({ params, request }) => {
    await delay(300);
    const body = (await request.json()) as { lab: string; quantity: number; shippingMethod: string };
    return HttpResponse.json({ success: true, data: { planId: params.id, orderId: `ORD-${Date.now()}`, lab: body.lab, quantity: body.quantity || 6, status: 'submitted', estimatedDelivery: new Date(Date.now() + 14*86400000).toISOString() } });
  }),
];

// [v3.0.6.8-93] Phase 3: CBCT 体渲染 + Curve MPR (10 端点)
const dentalVolumeModule = [
  http.get(`${DENTAL_API}/volume/studies`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: MOCK_VOLUME_STUDIES });
  }),
  http.get(`${DENTAL_API}/volume/studies/:id`, async ({ params }) => {
    await delay(30);
    const s = MOCK_VOLUME_STUDIES.find(x => x.id === params.id);
    if (!s) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),
  
  http.get(`${DENTAL_API}/volume/presets`, async () => {
    await delay(20);
    return HttpResponse.json({ success: true, data: MOCK_VOLUME_RENDER_PRESETS });
  }),
  
  
  
  http.get(`${DENTAL_API}/volume/presets/:id/apply`, async ({ params }) => {
    await delay(40);
    const preset = MOCK_VOLUME_RENDER_PRESETS.find(p => p.id === params.id);
    if (!preset) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: { preset, applied: true } });
  }),
  
];

// [v3.0.6.8-94] Phase 4: 口腔 360° 患者视图 (8 端点)
const dentalEmrModule = [
  http.get(`${DENTAL_API}/patients/:id/overview`, async ({ params }) => {
    await delay(60);
    const p = MOCK_DENTAL_PATIENTS.find(x => x.id === params.id);
    if (!p) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({
      success: true,
      data: { ...p, summary: { treatments: MOCK_PATIENT_TREATMENT_HISTORY.length, appointments: MOCK_PATIENT_APPOINTMENTS.filter(a => a.status !== 'completed').length, unpaid: MOCK_PATIENT_BILLING.filter(b => b.status !== 'paid').reduce((s:number,b:any)=>s+b.selfPay,0) } },
    });
  }),
  http.get(`${DENTAL_API}/patients/:id/overview/treatments`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({ success: true, data: MOCK_PATIENT_TREATMENT_HISTORY });
  }),
  http.get(`${DENTAL_API}/patients/:id/overview/appointments`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_PATIENT_APPOINTMENTS });
  }),
  http.get(`${DENTAL_API}/patients/:id/overview/billing`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({ success: true, data: MOCK_PATIENT_BILLING });
  }),
  http.get(`${DENTAL_API}/patients/:id/overview/prescriptions`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_PATIENT_PRESCRIPTIONS });
  }),
  http.get(`${DENTAL_API}/patients/:id/overview/consents`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_PATIENT_CONSENTS });
  }),
  http.get(`${DENTAL_API}/patients/:id/overview/recalls`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_PATIENT_RECALLS });
  }),
  // 收藏患者标记
  
];

// [v3.0.6.8-95] Phase 4: 收费/划价/医保 (15 端点)
const dentalBillingModule = [
  http.get(`${DENTAL_API}/billing/fee-catalog`, async () => {
    await delay(30);
    return HttpResponse.json({ success: true, data: MOCK_FEE_CATALOG });
  }),
  http.get(`${DENTAL_API}/billing/invoices`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const pid = url.searchParams.get('patientId');
    let list = MOCK_INVOICES;
    if (pid) list = list.filter(inv => inv.patientId === pid);
    return HttpResponse.json({ success: true, data: list });
  }),
  http.get(`${DENTAL_API}/billing/invoices/:id`, async ({ params }) => {
    await delay(30);
    const inv = MOCK_INVOICES.find(x => x.id === params.id);
    if (!inv) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: inv });
  }),
  http.post(`${DENTAL_API}/billing/invoices`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const invoice = { id: `INV-${Date.now()}`, ...body, status: 'pending', createdAt: new Date().toISOString() };
    try { create('dental_invoices', invoice); } catch {}
    return HttpResponse.json({ success: true, data: invoice }, { status: 201 });
  }),
  http.post(`${DENTAL_API}/billing/invoices/:id/pay`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as { paymentMethod: string; amount?: number };
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'paid', paidAt: new Date().toISOString(), paymentMethod: body.paymentMethod } });
  }),
  
  
  http.post(`${DENTAL_API}/billing/insurance-verify`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { patientId: string; insuranceType: string; feeTotal: number };
    return HttpResponse.json({
      success: true,
      data: { verified: true, insuranceCover: Math.round(body.feeTotal * 0.4), selfPay: Math.round(body.feeTotal * 0.6), recommendation: '建议使用城镇职工医保+补充医疗', items: [
        { category: '甲类', total: 120, ratio: 0.8, cover: 96 }, { category: '乙类', total: 2000, ratio: 0.6, cover: 1200 }, { category: '丙类', total: 8000, ratio: 0, cover: 0 },
      ] },
    });
  }),
  http.get(`${DENTAL_API}/billing/payment-methods`, async () => {
    await delay(20);
    return HttpResponse.json({ success: true, data: MOCK_PAYMENT_METHODS });
  }),
  
  
  // 经营报表
  
  
  
  
];

// [v3.0.6.8-96] Phase 4: 牙椅排班 + PSR 6分位 (12 端点)
const dentalSchedModule = [
  
  
  http.get(`${DENTAL_API}/schedule/appointments`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0,10);
    const chairId = url.searchParams.get('chairId');
    let data = generateMockAppointments(date);
    if (chairId) data = data.filter(a => a.chairId === chairId);
    return HttpResponse.json({ success: true, data, meta: { date, total: data.length } });
  }),
  http.post(`${DENTAL_API}/schedule/appointments`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const apt = { id: `APT-${Date.now()}`, ...body, status: 'scheduled', createdAt: new Date().toISOString() };
    try { create('dental_appointments', apt); } catch {}
    return HttpResponse.json({ success: true, data: apt }, { status: 201 });
  }),
  http.put(`${DENTAL_API}/schedule/appointments/:id`, async ({ params, request }) => {
    await delay(50);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, ...body, updatedAt: new Date().toISOString() } });
  }),
  http.delete(`${DENTAL_API}/schedule/appointments/:id`, async ({ params }) => {
    await delay(40);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${DENTAL_API}/schedule/appointments/:id/status`, async ({ params, request }) => {
    await delay(40);
    const body = (await request.json()) as { status: string };
    return HttpResponse.json({ success: true, data: { id: params.id, status: body.status, updatedAt: new Date().toISOString() } });
  }),
  
  // PSR 6分位
  http.get(`${DENTAL_API}/chart/:patientId/psr`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({ success: true, data: MOCK_PSR_RECORDS.filter(r => r.patientId === params.patientId) });
  }),
  http.post(`${DENTAL_API}/chart/:patientId/psr`, async ({ params, request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { patientId: params.patientId, ...body, createdAt: new Date().toISOString() } }, { status: 201 });
  }),
  
  
];

// [v3.0.6.8-97] Phase 5: AI 增强 (10 端点)
const dentalAiEnhanceModule = [
  
  
  
  
  
  
  
  // 患者沟通增强 - 3D 治疗前后对比
  
  
  // 口内照片管理
  http.get(`${DENTAL_API}/patient/:pid/photos`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({ success: true, data: [
      { id: 'PHOTO-001', type: 'frontal', label: '正面微笑像', url: 'data:image/png;base64,PHOTO_FRONTAL', takenAt: '2026-06-20T10:00:00Z', category: 'extraoral' },
      { id: 'PHOTO-002', type: 'occlusal-upper', label: '上颌合面', url: 'data:image/png;base64,PHOTO_OCCLUSAL_U', takenAt: '2026-06-20T10:05:00Z', category: 'intraoral' },
      { id: 'PHOTO-003', type: 'occlusal-lower', label: '下颌合面', url: 'data:image/png;base64,PHOTO_OCCLUSAL_L', takenAt: '2026-06-20T10:05:00Z', category: 'intraoral' },
      { id: 'PHOTO-004', type: 'buccal-right', label: '右侧咬合', url: 'data:image/png;base64,PHOTO_BL', takenAt: '2026-06-20T10:10:00Z', category: 'intraoral' },
      { id: 'PHOTO-005', type: 'buccal-left', label: '左侧咬合', url: 'data:image/png;base64,PHOTO_BR', takenAt: '2026-06-20T10:10:00Z', category: 'intraoral' },
    ] });
  }),
];

// ============= Day 4: 管理 + 远程 (18 端点) =============
const dentalManagementModule = [
  http.get(`${DENTAL_API}/patients`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    return HttpResponse.json({ success: true, data: MOCK_DENTAL_TREATMENTS.slice(0, 50).map(t => ({ id: t.patientId, name: t.patientName })), meta: { total: 200 } });
  }),
  http.get(`${DENTAL_API}/patients/:id`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: { id: params.id, name: '患者姓名', age: 35, phone: '13800000000' } });
  }),
  http.post(`${DENTAL_API}/patients`, async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: `P${Date.now()}`, ...body } }, { status: 201 });
  }),
  http.put(`${DENTAL_API}/patients/:id`, async ({ params, request }) => {
    await delay(40);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),
  
  
  
  
  
  http.get(`${DENTAL_API}/inventory`, async () => {
    await delay(30);
    return HttpResponse.json({ success: true, data: [
      { id: 'inv-1', name: '3M Filtek Z350 树脂 (A2)', category: 'Filling', stock: 45, unit: '支', minStock: 10 },
      { id: 'inv-2', name: 'Straumann BLT 种植体 RC 4.1x10mm', category: 'Implant', stock: 12, unit: '颗', minStock: 5 },
      { id: 'inv-3', name: 'ProTaper Gold 根管锉', category: 'Endo', stock: 8, unit: '盒', minStock: 3 },
      { id: 'inv-4', name: 'E-max CAD 瓷块 HT A2', category: 'Restorative', stock: 3, unit: '块', minStock: 5 },
    ] });
  }),
  
  http.get(`${DENTAL_API}/stats`, async () => {
    await delay(40);
    return HttpResponse.json({ success: true, data: { todayPatients: 12, thisWeek: 58, avgPerDay: 10, revenueToday: 18500, topTreatments: { Restorative: 25, Endodontic: 15, Extraction: 10, Implant: 5 } } });
  }),
  http.post(`${DENTAL_API}/tele/sessions`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { sessionId: `TEL${Date.now()}`, ...body, createdAt: new Date().toISOString() } });
  }),
  http.get(`${DENTAL_API}/tele/sessions`, async () => {
    await delay(30);
    return HttpResponse.json({ success: true, data: [] });
  }),
  
  
  
];

// 合并所有模块
export const dentalHandlers = [
  ...dentalImagingModule,
  ...dentalChartAiModule,
  ...dentalTreatmentModule,
  ...dentalCadModule, // [v3.0.6.8-87] Phase 1: 修复 CAD/CAM
  ...dentalImplant3dModule, // [v3.0.6.8-88] Phase 1: 种植 3D 规划
  ...dentalGuideModule, // [v3.0.6.8-89] Phase 1: 导板+上部+种植体库
  ...dentalCephModule, // [v3.0.6.8-90] Phase 2: 头影测量分析
  ...dentalAlignerModule, // [v3.0.6.8-92] Phase 2: 隐形矫治
  ...dentalVolumeModule, // [v3.0.6.8-93] Phase 3: CBCT体渲染+CurveMPR
  ...dentalEmrModule, // [v3.0.6.8-94] Phase 4: 360° 患者视图
  ...dentalBillingModule, // [v3.0.6.8-95] Phase 4: 收费/划价/医保
  ...dentalSchedModule, // [v3.0.6.8-96] Phase 4: 排班+PSR
  ...dentalAiEnhanceModule, // [v3.0.6.8-97] Phase 5: AI增强
  ...dentalManagementModule,
];
export default dentalHandlers;

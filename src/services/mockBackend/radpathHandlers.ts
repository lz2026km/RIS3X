// [W2-B-3] /api/v1/radpath MSW handlers
// 对齐后端 radpath.controller (create / report/:reportId / pathology/:pathId /
//   consistency / stats) + 前端 radpathApi.getRecords 需的 /records 端点。
// 页面: /radpath (RadPathPage) /radpath/tracker (RadPathTrackerPage) /radpath/detail
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/radpath';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

const SEED_RECORDS: any[] = [
  {
    id: 'RP-000',
    reportId: 'RPT001',
    pathologyId: 'PATH001',
    radFinding: '右肺上叶磨玻璃结节，约 6mm，边界清晰',
    pathResult: '微浸润性肺腺癌',
    consistency: 'concordant',
    notes: '影像与病理一致',
    createdAt: '2026-07-20T09:00:00Z',
    report: {
      id: 'RPT001',
      findings: '右肺上叶磨玻璃结节，约 6mm',
      conclusion: '肺结节，建议随访或手术评估',
      signedAt: '2026-07-20T08:30:00Z',
      patient: { name: '张伟', gender: '男', birthDate: '1962-05-10' },
      exam: { modality: 'CT', bodyPart: '胸部', accessionNumber: 'ACC001' },
    },
  },
  {
    id: 'RP-001',
    reportId: 'RPT202607001',
    pathologyId: 'PATH202607001',
    radFinding: '右肺上叶磨玻璃结节，约 8mm，边界清晰',
    pathResult: '浸润性肺腺癌 (IA期)',
    consistency: 'concordant',
    notes: '影像与病理一致',
    createdAt: '2026-07-15T09:30:00Z',
    report: {
      id: 'RPT202607001',
      findings: '右肺上叶磨玻璃结节',
      conclusion: '肺结节性质待定，建议随访',
      signedAt: '2026-07-15T09:00:00Z',
      patient: { name: '张伟', gender: '男', birthDate: '1962-05-10' },
      exam: { modality: 'CT', bodyPart: '胸部', accessionNumber: 'ACC202607001' },
    },
  },
  {
    id: 'RP-002',
    reportId: 'RPT202607002',
    pathologyId: 'PATH202607002',
    radFinding: '左乳腺外上象限结节伴钙化',
    pathResult: '纤维腺瘤',
    consistency: 'discordant',
    notes: '影像可疑 BI-RADS 4A，病理良性',
    createdAt: '2026-07-12T10:15:00Z',
    report: {
      id: 'RPT202607002',
      findings: '左乳腺结节伴钙化',
      conclusion: 'BI-RADS 4A，建议穿刺活检',
      signedAt: '2026-07-12T09:45:00Z',
      patient: { name: '李娜', gender: '女', birthDate: '1975-03-22' },
      exam: { modality: 'MG', bodyPart: '乳腺', accessionNumber: 'ACC202607002' },
    },
  },
  {
    id: 'RP-003',
    reportId: 'RPT202607003',
    pathologyId: 'PATH202607003',
    radFinding: '肝脏右叶低密度灶',
    pathResult: '',
    consistency: 'pending',
    notes: '待病理回报',
    createdAt: '2026-07-10T14:00:00Z',
    report: {
      id: 'RPT202607003',
      findings: '肝右叶低密度灶，增强扫描呈快进快出',
      conclusion: '肝细胞癌可能',
      signedAt: '2026-07-10T13:30:00Z',
      patient: { name: '王磊', gender: '男', birthDate: '1958-11-02' },
      exam: { modality: 'MR', bodyPart: '腹部', accessionNumber: 'ACC202607003' },
    },
  },
];

let records: any[] = [...SEED_RECORDS];

export const radpathHandlers = [
  http.get(`${API}/records`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: records });
  }),

  http.post(`${API}/create`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newRecord = {
      id: `RP-${uuidv4().slice(0, 8)}`,
      reportId: String(body?.reportId ?? ''),
      pathologyId: String(body?.pathologyId ?? ''),
      radFinding: String(body?.radFinding ?? ''),
      pathResult: String(body?.pathResult ?? ''),
      consistency: String(body?.consistency ?? 'pending'),
      notes: body?.notes ? String(body.notes) : undefined,
      createdAt: new Date().toISOString(),
      report: {
        id: String(body?.reportId ?? ''),
        findings: String(body?.radFinding ?? ''),
        conclusion: '影像与病理对照',
        signedAt: new Date().toISOString(),
        patient: { name: '演示患者', gender: '男', birthDate: '' },
        exam: { modality: 'CT', bodyPart: '胸部', accessionNumber: '' },
      },
    };
    records = [newRecord, ...records];
    return HttpResponse.json({ success: true, data: newRecord }, { status: 201 });
  }),

  http.get(`${API}/report/:reportId`, async ({ params }) => {
    await delay(delayMs());
    const item = records.find((r) => r.reportId === params.reportId);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `RadPath record for report ${params.reportId} not found` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),

  http.get(`${API}/pathology/:pathId`, async ({ params }) => {
    await delay(delayMs());
    const item = records.find((r) => r.pathologyId === params.pathId);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `RadPath record for pathology ${params.pathId} not found` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),

  http.put(`${API}/consistency`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const found = records.find((r) => r.id === body?.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `RadPath record ${body?.id} not found` } }, { status: 404 });
    const updated = {
      ...found,
      consistency: String(body?.consistency ?? found.consistency),
      notes: body?.notes !== undefined ? String(body.notes) : found.notes,
    };
    records = records.map((r) => (r.id === updated.id ? updated : r));
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    const total = records.length;
    const concordant = records.filter((r) => r.consistency === 'concordant').length;
    const discordant = records.filter((r) => r.consistency === 'discordant').length;
    const pending = records.filter((r) => r.consistency === 'pending').length;
    const trendMap = new Map<string, { total: number; concordant: number }>();
    for (const r of records) {
      const month = (r.createdAt ?? '').slice(0, 7);
      const entry = trendMap.get(month) ?? { total: 0, concordant: 0 };
      entry.total += 1;
      if (r.consistency === 'concordant') entry.concordant += 1;
      trendMap.set(month, entry);
    }
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, rate: v.total > 0 ? +((v.concordant / v.total) * 100).toFixed(1) : 0 }));
    return HttpResponse.json({
      success: true,
      data: {
        total,
        concordant,
        discordant,
        pending,
        positiveConsistency: total > 0 ? +((concordant / total) * 100).toFixed(1) : 0,
        trend,
      },
    });
  }),
];

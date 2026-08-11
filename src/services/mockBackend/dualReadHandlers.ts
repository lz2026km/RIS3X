// [W2-B-3] /api/v1/dual-read MSW handlers
// 对齐后端 dual-read.controller (assign / arbitrate/:id / list / discrepancy / :id/reader)
// 页面: /dual-read (DualReadPage)
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/dual-read';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

let assignments: any[] = [
  {
    id: 'DR-001', studyId: 'STU-001', patientName: '张伟', patientId: 'P001', modality: 'CT',
    reader1Id: 'D001', reader1Name: '张医生', reader2Id: 'D002', reader2Name: '李医生',
    report1: '右肺上叶磨玻璃结节，建议随访', report2: '右肺上叶磨玻璃结节伴分叶，建议增强',
    status: 'both_done', discrepancyScore: 0.32, createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-01T10:30:00Z',
  },
  {
    id: 'DR-002', studyId: 'STU-002', patientName: '李秀英', patientId: 'P002', modality: 'MR',
    reader1Id: 'D003', reader1Name: '王医生', reader2Id: 'D001', reader2Name: '张医生',
    report1: '', report2: '',
    status: 'pending', createdAt: '2026-08-02T09:00:00Z', updatedAt: '2026-08-02T09:00:00Z',
  },
  {
    id: 'DR-003', studyId: 'STU-003', patientName: '王建国', patientId: 'P003', modality: 'CT',
    reader1Id: 'D002', reader1Name: '李医生', reader2Id: 'D003', reader2Name: '王医生',
    report1: '腰椎间盘突出 L4/5', report2: '腰椎间盘膨出 L4/5、L5/S1',
    status: 'arbitrated', discrepancyScore: 0.18,
    arbitrationReport: 'L4/5 椎间盘突出伴 L5/S1 膨出',
    arbitratorId: 'D004', arbitratorName: '赵医生',
    createdAt: '2026-07-30T09:00:00Z', updatedAt: '2026-07-31T15:00:00Z',
  },
];

export const dualReadHandlers = [
  http.get(`${API}/list`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: assignments });
  }),

  http.post(`${API}/assign`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newItem = {
      id: `DR-${uuidv4().slice(0, 8)}`,
      studyId: String(body?.studyId ?? ''),
      patientName: String(body?.patientName ?? ''),
      patientId: String(body?.patientId ?? ''),
      modality: String(body?.modality ?? 'CT'),
      reader1Id: 'D001', reader1Name: '张医生', reader2Id: 'D002', reader2Name: '李医生',
      report1: '', report2: '',
      status: 'pending',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    assignments = [newItem, ...assignments];
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  http.post(`${API}/arbitrate/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const found = assignments.find((a) => a.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Assignment ${params.id} not found` } }, { status: 404 });
    const updated = {
      ...found,
      status: 'arbitrated',
      arbitrationReport: String(body?.report ?? found.arbitrationReport ?? ''),
      arbitratorId: String(body?.arbitratorId ?? 'D004'),
      arbitratorName: String(body?.arbitratorName ?? '赵医生'),
      updatedAt: new Date().toISOString(),
    };
    assignments = assignments.map((a) => (a.id === updated.id ? updated : a));
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.post(`${API}/:id/reader`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const found = assignments.find((a) => a.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Assignment ${params.id} not found` } }, { status: 404 });
    const readerNumber = Number(body?.readerNumber ?? 1);
    const updated = {
      ...found,
      [readerNumber === 1 ? 'report1' : 'report2']: String(body?.report ?? ''),
      status: readerNumber === 1 ? (found.report2 ? 'both_done' : 'reader1_done') : (found.report1 ? 'both_done' : 'reader2_done'),
      updatedAt: new Date().toISOString(),
    };
    assignments = assignments.map((a) => (a.id === updated.id ? updated : a));
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.get(`${API}/discrepancy`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        totalAssignments: assignments.length,
        pendingCount: assignments.filter((a) => a.status === 'pending').length,
        bothDoneCount: assignments.filter((a) => a.status === 'both_done').length,
        arbitratedCount: assignments.filter((a) => a.status === 'arbitrated').length,
        avgDiscrepancy: 0.25,
      },
    });
  }),
];

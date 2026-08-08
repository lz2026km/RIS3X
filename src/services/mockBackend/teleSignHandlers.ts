// [G005 W1-C] /api/v1/tele-sign MSW handlers
// 对齐后端 (backend/src/modules/tele-sign/tele-sign.controller.ts):
//   GET  /tele-sign/sessions  · POST /tele-sign/session · POST /tele-sign/approve · POST /tele-sign/reject
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/tele-sign';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

interface SignSession {
  id: string
  reportId: string
  reportTitle: string
  patientName: string
  signerId: string
  signerName: string
  status: 'pending' | 'approved' | 'rejected'
  signatureData?: string
  comment?: string
  createdAt: string
  updatedAt?: string
}

let sessions: SignSession[] = [
  { id: 'ts-001', reportId: 'RPT001', reportTitle: 'Chest CT Report', patientName: 'Zhang San', signerId: 'dr-001', signerName: 'Dr. Wang', status: 'pending', createdAt: '2026-07-11T10:00:00Z' },
  { id: 'ts-002', reportId: 'RPT002', reportTitle: 'Brain MRI Report', patientName: 'Li Si', signerId: 'dr-002', signerName: 'Dr. Li', status: 'approved', signatureData: 'data:image/png;base64,iVBOR', createdAt: '2026-07-10T14:00:00Z', updatedAt: '2026-07-10T15:30:00Z' },
  { id: 'ts-003', reportId: 'RPT003', reportTitle: 'Chest X-Ray Report', patientName: 'Wang Wu', signerId: 'dr-003', signerName: 'Dr. Zhang', status: 'rejected', comment: '需要补充影像学描述', createdAt: '2026-07-09T09:00:00Z', updatedAt: '2026-07-09T11:00:00Z' },
];

export const teleSignHandlers = [
  http.get(`${API}/sessions`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const signerId = url.searchParams.get('signerId');
    let items = sessions;
    if (status) items = items.filter(s => s.status === status);
    if (signerId) items = items.filter(s => s.signerId === signerId);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  http.post(`${API}/session`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body.reportId !== 'string' || !body.reportId.trim() || typeof body.reportTitle !== 'string' || !body.reportTitle.trim() || typeof body.patientName !== 'string' || !body.patientName.trim() || typeof body.signerId !== 'string' || !body.signerId.trim() || typeof body.signerName !== 'string' || !body.signerName.trim()) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'reportId/reportTitle/patientName/signerId/signerName 为必填字段' } },
        { status: 400 },
      );
    }
    const session: SignSession = {
      id: `ts-${Date.now().toString(36).slice(-6)}`,
      reportId: body.reportId,
      reportTitle: body.reportTitle,
      patientName: body.patientName,
      signerId: body.signerId,
      signerName: body.signerName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    sessions = [session, ...sessions];
    return HttpResponse.json({ success: true, data: session }, { status: 201 });
  }),

  http.post(`${API}/approve`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const target = sessions.find(s => s.id === body?.id);
    if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Session not found: ${body?.id}` } }, { status: 404 });
    if (typeof body?.signatureData !== 'string' || !body.signatureData) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'signatureData 为必填字段' } }, { status: 400 });
    }
    target.status = 'approved';
    target.signatureData = body.signatureData;
    target.comment = body.comment;
    target.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: target });
  }),

  http.post(`${API}/reject`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const target = sessions.find(s => s.id === body?.id);
    if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Session not found: ${body?.id}` } }, { status: 404 });
    if (typeof body?.comment !== 'string' || !body.comment.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'comment 为必填字段' } }, { status: 400 });
    }
    target.status = 'rejected';
    target.comment = body.comment;
    target.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: target });
  }),
];

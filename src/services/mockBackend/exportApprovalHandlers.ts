// [W1-5] /api/v1/export-approval MSW handlers (与 backend export-approval.controller 对齐)
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update } from './store';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/export-approval';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export interface ExportApprovalRecord {
  id: string;
  resource: string;
  resourceId?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requesterId: string;
  requesterName?: string;
  approverId?: string;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
}

function currentUser(): { id: string; name: string } {
  try {
    const raw = window.localStorage.getItem('ris_current_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && (u.id || u.userId || u.username)) {
        return { id: String(u.id || u.userId || u.username), name: String(u.name || u.username || u.id) };
      }
    }
  } catch {}
  return { id: 'U001', name: '系统用户' };
}

function seedIfEmpty(): void {
  try {
    if (list<any>('exportApprovals').length > 0) return;
  } catch {}
  const now = Date.now();
  const seeds: ExportApprovalRecord[] = [
    {
      id: 'EA-0001', resource: 'REPORT', resourceId: 'RPT-202607-001',
      reason: '申请导出 5 份胸部CT报告(PDF)用于院内会诊',
      status: 'PENDING', requesterId: 'D001', requesterName: '张伟',
      createdAt: new Date(now - 3 * 3600 * 1000).toISOString(), updatedAt: new Date(now - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'EA-0002', resource: 'REPORT', resourceId: 'RPT-202607-013',
      reason: '导出磁共振报告附件用于科研课题资料归档',
      status: 'APPROVED', requesterId: 'D002', requesterName: '李娜',
      approverId: 'A001', createdAt: new Date(now - 26 * 3600 * 1000).toISOString(), updatedAt: new Date(now - 25 * 3600 * 1000).toISOString(),
    },
    {
      id: 'EA-0003', resource: 'PATIENT_EXPORT', resourceId: 'P001584',
      reason: '导出患者检查记录用于医保复核',
      status: 'REJECTED', requesterId: 'D003', requesterName: '王芳',
      approverId: 'A001', rejectReason: '医保复核仅允许导出具名汇总表,请联系信息科',
      createdAt: new Date(now - 50 * 3600 * 1000).toISOString(), updatedAt: new Date(now - 49 * 3600 * 1000).toISOString(),
    },
  ];
  seeds.forEach(s => { try { create('exportApprovals', s); } catch {} });
}

function toRecord(item: any): ExportApprovalRecord {
  return {
    id: item.id ?? item.invoiceId ?? '',
    resource: item.resource ?? 'REPORT',
    resourceId: item.resourceId ?? item.invoiceId ?? '',
    reason: item.reason ?? '',
    status: (item.status ?? 'PENDING').toUpperCase(),
    requesterId: item.requesterId ?? 'U001',
    requesterName: item.requesterName,
    approverId: item.approverId,
    rejectReason: item.rejectReason,
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  };
}

export const exportApprovalHandlers = [
  http.get(API, async ({ request }) => {
    await delay(delayMs());
    seedIfEmpty();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
    const pageSize = Math.max(1, parseInt(url.searchParams.get('pageSize') || '20') || 20);
    let items = (list<any>('exportApprovals') as any[]).map(toRecord);
    if (status) items = items.filter(i => i.status === String(status).toUpperCase());
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = items.length;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);
    return HttpResponse.json({ success: true, data: slice, meta: { total, page, pageSize } });
  }),
  http.post(API, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const user = currentUser();
    const record: ExportApprovalRecord = {
      id: uuidv4(),
      resource: String(body?.resource ?? 'REPORT'),
      resourceId: body?.resourceId ? String(body.resourceId) : undefined,
      reason: String(body?.reason ?? ''),
      status: 'PENDING',
      requesterId: user.id,
      requesterName: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try { create('exportApprovals', record); } catch {}
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),
  http.post(`${API}/:id/approve`, async ({ params }) => {
    await delay(delayMs());
    const id = String(params.id);
    const existing = get<any>('exportApprovals', id);
    if (!existing) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '请求不存在' } }, { status: 404 });
    if (existing.status !== 'PENDING' && existing.status !== 'pending') {
      return HttpResponse.json({ success: false, error: { code: 'ALREADY_HANDLED', message: '请求已处理' } }, { status: 409 });
    }
    const user = currentUser();
    const updated = update<any>('exportApprovals', id, {
      status: 'APPROVED',
      approverId: user.id,
      updatedAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: toRecord(updated) }, { status: 201 });
  }),
  http.post(`${API}/:id/reject`, async ({ request, params }) => {
    await delay(delayMs());
    const id = String(params.id);
    const body = (await request.json()) as any;
    const existing = get<any>('exportApprovals', id);
    if (!existing) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '请求不存在' } }, { status: 404 });
    if (existing.status !== 'PENDING' && existing.status !== 'pending') {
      return HttpResponse.json({ success: false, error: { code: 'ALREADY_HANDLED', message: '请求已处理' } }, { status: 409 });
    }
    const user = currentUser();
    const updated = update<any>('exportApprovals', id, {
      status: 'REJECTED',
      approverId: user.id,
      rejectReason: String(body?.reason ?? ''),
      updatedAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: toRecord(updated) }, { status: 201 });
  }),
];

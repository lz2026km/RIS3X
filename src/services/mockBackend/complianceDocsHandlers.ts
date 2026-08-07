// [v3.0.6.11-79 W1-C] 合规文档库 7 端点 (list/getById/create/update/delete/publish/archive)
// 与后端 compliance-docs 模块对齐: 状态流转 DRAFT -> CURRENT (publish) -> ARCHIVED (archive)
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5191/api/v1'; }
})();

type DocStatus = 'DRAFT' | 'CURRENT' | 'ARCHIVED';

interface ComplianceDoc {
  id: string;
  title: string;
  category: string;
  type: string;
  version: string;
  content: string;
  status: DocStatus;
  author?: string | null;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

let DOCS: ComplianceDoc[] = [
  {
    id: 'd-001', title: '隐私政策', category: '法规文档', type: 'POLICY', version: '3.2',
    content: '本政策适用于 G005 放射RIS系统收集、存储、使用患者影像与个人信息的行为。\n\n1. 数据最小化采集原则\n2. 传输加密 (TLS 1.3)\n3. 访问留痕与审计\n4. 数据保留期: 影像 15 年 / 登记信息 30 年',
    status: 'CURRENT', author: '合规部', approvedBy: '医务处', effectiveDate: isoDaysAgo(7),
    publishedAt: isoDaysAgo(7), archivedAt: null, createdAt: isoDaysAgo(400), updatedAt: isoDaysAgo(7),
  },
  {
    id: 'd-002', title: '数据安全管理制度', category: '管理制度', type: 'SOP', version: '2.1',
    content: '1. 人员账号唯一性与实名制\n2. 最小权限授权与季度复核\n3. 敏感数据脱敏与导出审批\n4. 离职账号即时冻结',
    status: 'CURRENT', author: '信息科', approvedBy: '院长办', effectiveDate: isoDaysAgo(14),
    publishedAt: isoDaysAgo(14), archivedAt: null, createdAt: isoDaysAgo(500), updatedAt: isoDaysAgo(14),
  },
  {
    id: 'd-003', title: '等保测评报告 (2026)', category: '测评报告', type: 'REPORT', version: '1.0',
    content: '2026 年度等保三级测评结论: 通过。\n\n- 物理安全: 通过\n- 网络安全: 通过\n- 主机安全: 通过\n- 应用安全: 通过\n- 数据安全: 通过 (1 项整改项已闭环)',
    status: 'CURRENT', author: '测评机构', approvedBy: '信息科', effectiveDate: isoDaysAgo(30),
    publishedAt: isoDaysAgo(30), archivedAt: null, createdAt: isoDaysAgo(120), updatedAt: isoDaysAgo(30),
  },
  {
    id: 'd-004', title: '应急响应预案 (2026 修订)', category: '应急预案', type: 'SOP', version: '0.9',
    content: '草案: 系统中断/数据丢失/网络攻击场景下的响应流程与责任人矩阵。\n\n待科室评审后发布。',
    status: 'DRAFT', author: '信息科', approvedBy: null, effectiveDate: null,
    publishedAt: null, archivedAt: null, createdAt: isoDaysAgo(3), updatedAt: isoDaysAgo(3),
  },
  {
    id: 'd-005', title: '历史 SOP (旧版)', category: '管理制度', type: 'SOP', version: '1.5',
    content: '已被 v2.x 替代的历史 SOP,仅存档备查。',
    status: 'ARCHIVED', author: '医务处', approvedBy: '医务处', effectiveDate: isoDaysAgo(600),
    publishedAt: isoDaysAgo(600), archivedAt: isoDaysAgo(180), createdAt: isoDaysAgo(900), updatedAt: isoDaysAgo(180),
  },
];

const findIndex = (id: string) => DOCS.findIndex((d) => d.id === id);

const toDto = (d: ComplianceDoc) => ({ ...d });

export const complianceDocsHandlers = [
  http.get(`${API_BASE}/compliance-docs`, async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.toLowerCase();
    let rows = DOCS.map(toDto);
    if (category) rows = rows.filter((d) => d.category === category);
    if (status) rows = rows.filter((d) => d.status === status);
    if (search) rows = rows.filter((d) =>
      (d.title + d.category + d.content).toLowerCase().includes(search),
    );
    rows = [...rows].sort((a, b) => (a.status > b.status ? 1 : -1) || (a.updatedAt < b.updatedAt ? 1 : -1));
    return HttpResponse.json({ success: true, data: rows });
  }),

  http.get(`${API_BASE}/compliance-docs/report`, async () => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        systemName: 'G005 放射RIS系统',
        complianceStandard: '等保三级 (GB/T 22239-2019)',
        summary: { totalDocs: DOCS.length, published: DOCS.filter((d) => d.status === 'CURRENT').length, drafts: DOCS.filter((d) => d.status === 'DRAFT').length, archived: DOCS.filter((d) => d.status === 'ARCHIVED').length },
      },
    });
  }),

  http.get(`${API_BASE}/compliance-docs/:id`, async ({ params }) => {
    await delay(120);
    const doc = DOCS.find((d) => d.id === params.id);
    if (!doc) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '文档不存在' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toDto(doc) });
  }),

  http.post(`${API_BASE}/compliance-docs`, async ({ request }) => {
    await delay(220);
    const body = (await request.json().catch(() => null)) as Partial<ComplianceDoc> | null;
    if (!body?.title?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '标题不能为空' } }, { status: 400 });
    }
    if (!body?.category?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '分类不能为空' } }, { status: 400 });
    }
    const now = new Date().toISOString();
    const doc: ComplianceDoc = {
      id: 'd-' + String(DOCS.length + 1).padStart(3, '0') + '-' + Date.now().toString(36),
      title: body.title.trim(),
      category: body.category.trim(),
      type: body.type?.trim() || 'SOP',
      version: body.version?.trim() || '1.0',
      content: body.content ?? '',
      status: (body.status ?? 'DRAFT') as DocStatus,
      author: body.author ?? null,
      approvedBy: body.approvedBy ?? null,
      effectiveDate: body.effectiveDate ?? null,
      publishedAt: body.status === 'CURRENT' ? now : null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    DOCS = [doc, ...DOCS];
    return HttpResponse.json({ success: true, data: toDto(doc) }, { status: 201 });
  }),

  http.put(`${API_BASE}/compliance-docs/:id`, async ({ params, request }) => {
    await delay(200);
    const idx = findIndex(String(params.id));
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '文档不存在' } }, { status: 404 });
    const body = (await request.json().catch(() => null)) as Partial<ComplianceDoc> | null;
    const prev = DOCS[idx]!;
    const next: ComplianceDoc = {
      ...prev,
      ...(body ?? {}),
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
    };
    if (body?.status === 'CURRENT' && prev.status !== 'CURRENT' && !next.publishedAt) {
      next.publishedAt = new Date().toISOString();
      next.effectiveDate = next.effectiveDate ?? new Date().toISOString();
    }
    DOCS[idx] = next;
    return HttpResponse.json({ success: true, data: toDto(next) });
  }),

  http.delete(`${API_BASE}/compliance-docs/:id`, async ({ params }) => {
    await delay(150);
    const idx = findIndex(String(params.id));
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '文档不存在' } }, { status: 404 });
    DOCS.splice(idx, 1);
    return HttpResponse.json({ success: true, data: { success: true, deletedId: params.id } });
  }),

  http.post(`${API_BASE}/compliance-docs/:id/publish`, async ({ params }) => {
    await delay(200);
    const idx = findIndex(String(params.id));
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '文档不存在' } }, { status: 404 });
    if (DOCS[idx]!.status === 'ARCHIVED') {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '已归档文档不能发布' } }, { status: 400 });
    }
    const now = new Date().toISOString();
    DOCS[idx] = { ...DOCS[idx]!, status: 'CURRENT', publishedAt: DOCS[idx]!.publishedAt ?? now, effectiveDate: DOCS[idx]!.effectiveDate ?? now, updatedAt: now };
    return HttpResponse.json({ success: true, data: toDto(DOCS[idx]!) });
  }),

  http.post(`${API_BASE}/compliance-docs/:id/archive`, async ({ params }) => {
    await delay(200);
    const idx = findIndex(String(params.id));
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '文档不存在' } }, { status: 404 });
    if (DOCS[idx]!.status === 'ARCHIVED') return HttpResponse.json({ success: true, data: toDto(DOCS[idx]!) });
    const now = new Date().toISOString();
    DOCS[idx] = { ...DOCS[idx]!, status: 'ARCHIVED', archivedAt: now, updatedAt: now };
    return HttpResponse.json({ success: true, data: toDto(DOCS[idx]!) });
  }),
];

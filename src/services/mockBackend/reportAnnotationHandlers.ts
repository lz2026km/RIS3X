/**
 * G005 RIS v3.0.6.11-99 (Wave 2A 报告批注) - MSW Report Annotation Handlers
 * 与后端 report-annotation 模块对齐 (内存 + 种子):
 *   - GET    /report-annotations?reportId=   批注列表
 *   - POST   /report-annotations             新建批注
 *   - PATCH  /report-annotations/:id         编辑
 *   - DELETE /report-annotations/:id         删除
 *   - POST   /report-annotations/:id/reply   回复 (嵌套 1 层)
 *   - POST   /report-annotations/:id/resolve 解决
 *   - POST   /report-annotations/:id/reopen  重开
 *   - GET    /report-annotations/stats?reportId= 统计
 */
import { http, HttpResponse, delay } from 'msw';

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

export type ReportAnnotationStatus = 'open' | 'resolved';

export interface ReportAnnotationReply {
  id: string;
  annotationId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface ReportAnnotation {
  id: string;
  reportId: string;
  authorId: string;
  authorName: string;
  content: string;
  quote: string | null;
  status: ReportAnnotationStatus;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  replies: ReportAnnotationReply[];
}

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString();

const SEED_ANNOTATIONS: ReportAnnotation[] = [
  {
    id: 'RA-001',
    reportId: 'RPT-000001',
    authorId: 'D001',
    authorName: '张海涛',
    content: '右肺中叶结节建议补充测量值 (长径/短径) 与密度描述, 便于随访对比。',
    quote: '右肺中叶见约1.5cm结节影，边缘毛糙。',
    status: 'open',
    createdAt: iso(180),
    updatedAt: iso(180),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [
      {
        id: 'RAR-001',
        annotationId: 'RA-001',
        authorId: 'D002',
        authorName: '王秀峰',
        content: '已补充测量: 1.5×1.2cm, 密度欠均匀, 建议增强进一步评估。',
        createdAt: iso(150),
      },
    ],
  },
  {
    id: 'RA-002',
    reportId: 'RPT-000001',
    authorId: 'D003',
    authorName: '李建国',
    content: '临床病史与检查所见吻合, 建议补充既往手术史说明。',
    quote: '临床病史: 咳嗽咳痰 1 月余, 无发热。',
    status: 'resolved',
    createdAt: iso(60 * 26),
    updatedAt: iso(60 * 24),
    editedAt: null,
    resolvedAt: iso(60 * 24),
    resolvedBy: 'D001',
    resolution: '已补充既往史, 前后对比未见明显改变。',
    replies: [],
  },
  {
    id: 'RA-003',
    reportId: 'RPT-000002',
    authorId: 'D004',
    authorName: '陈海涛',
    content: '印象与诊断意见表述重复, 建议精简。',
    quote: '诊断意见: 左肺上叶磨玻璃结节, 建议随访。',
    status: 'open',
    createdAt: iso(90),
    updatedAt: iso(90),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [],
  },
  {
    id: 'RA-004',
    reportId: 'RPT-000100',
    authorId: 'D001',
    authorName: '张海涛',
    content: '危急值报告需在 30 分钟内电话确认并留档。',
    quote: '危急值: 右侧基底节区急性脑梗死。',
    status: 'open',
    createdAt: iso(30),
    updatedAt: iso(30),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [
      {
        id: 'RAR-002',
        annotationId: 'RA-004',
        authorId: 'D002',
        authorName: '王秀峰',
        content: '已电话确认值班医师并记录, 电话录音已归档。',
        createdAt: iso(20),
      },
    ],
  },
  // 书写页默认报告 (报告书写页 reportId=RPT-20260122-00001, 现有表派生种子)
  {
    id: 'RA-101',
    reportId: 'RPT-20260122-00001',
    authorId: 'D001',
    authorName: '张海涛',
    content: '所见中建议补充结节密度 (实性/磨玻璃) 描述, 便于分级。',
    quote: '右肺中叶见约 8mm 磨玻璃结节影，边界欠清。',
    status: 'open',
    createdAt: iso(60 * 4),
    updatedAt: iso(60 * 4),
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    replies: [],
  },
  {
    id: 'RA-102',
    reportId: 'RPT-20260122-00001',
    authorId: 'D002',
    authorName: '王秀峰',
    content: '临床病史信息不足, 建议补充吸烟史与既往胸部影像对比。',
    quote: '临床病史: 体检发现肺结节 1 周。',
    status: 'resolved',
    createdAt: iso(60 * 30),
    updatedAt: iso(60 * 20),
    editedAt: null,
    resolvedAt: iso(60 * 20),
    resolvedBy: 'D001',
    resolution: '已补充吸烟史 (30 年) 与 1 年前基线片对比。',
    replies: [],
  },
];

let annotations: ReportAnnotation[] = SEED_ANNOTATIONS.map((a) => ({
  ...a,
  replies: a.replies.map((r) => ({ ...r })),
}));

const ok = (data: unknown) => HttpResponse.json({ success: true, data });
const fail = (status: number, message: string) =>
  HttpResponse.json({ success: false, error: { code: 'ERROR', message } }, { status });

const findOrNull = (id: string) => annotations.find((a) => a.id === id) ?? null;

export const reportAnnotationHandlers = [
  http.get(`${API_BASE}/report-annotations`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') ?? '';
    if (!reportId) return fail(400, 'reportId 必填');
    return ok(
      annotations
        .filter((a) => a.reportId === reportId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),

  http.get(`${API_BASE}/report-annotations/stats`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') ?? '';
    if (!reportId) return fail(400, 'reportId 必填');
    const items = annotations.filter((a) => a.reportId === reportId);
    const byAuthorMap = new Map<string, { authorId: string; authorName: string; count: number; open: number }>();
    for (const a of items) {
      const key = a.authorId || a.authorName;
      const cur = byAuthorMap.get(key) ?? { authorId: a.authorId, authorName: a.authorName, count: 0, open: 0 };
      cur.count += 1;
      if (a.status === 'open') cur.open += 1;
      byAuthorMap.set(key, cur);
    }
    return ok({
      reportId,
      total: items.length,
      open: items.filter((a) => a.status === 'open').length,
      resolved: items.filter((a) => a.status === 'resolved').length,
      byAuthor: Array.from(byAuthorMap.values()).sort((a, b) => b.count - a.count),
    });
  }),

  http.post(`${API_BASE}/report-annotations`, async ({ request }) => {
    await delay(120);
    const body = (await request.json().catch(() => ({}))) as {
      reportId?: string; content?: string; quote?: string; authorName?: string;
    };
    const reportId = String(body.reportId ?? '').trim();
    const content = String(body.content ?? '').trim();
    if (!reportId) return fail(400, 'reportId 必填');
    if (content.length < 2) return fail(400, 'content 至少 2 个字符');
    const now = new Date().toISOString();
    const item: ReportAnnotation = {
      id: `RA-${Date.now()}`,
      reportId,
      authorId: 'u-current',
      authorName: String(body.authorName ?? '').trim() || '当前用户',
      content,
      quote: body.quote && String(body.quote).trim() ? String(body.quote).trim().slice(0, 500) : null,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      editedAt: null,
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
      replies: [],
    };
    annotations.unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),

  http.patch(`${API_BASE}/report-annotations/:id`, async ({ params, request }) => {
    await delay(80);
    const hit = findOrNull(params.id as string);
    if (!hit) return fail(404, '批注不存在');
    const body = (await request.json().catch(() => ({}))) as { content?: string };
    const content = String(body.content ?? '').trim();
    if (content.length < 2) return fail(400, 'content 至少 2 个字符');
    hit.content = content;
    hit.editedAt = new Date().toISOString();
    hit.updatedAt = hit.editedAt;
    return ok({ ...hit, replies: [...hit.replies] });
  }),

  http.delete(`${API_BASE}/report-annotations/:id`, async ({ params }) => {
    await delay(80);
    const idx = annotations.findIndex((a) => a.id === params.id);
    if (idx < 0) return fail(404, '批注不存在');
    annotations.splice(idx, 1);
    return ok({ success: true });
  }),

  http.post(`${API_BASE}/report-annotations/:id/reply`, async ({ params, request }) => {
    await delay(100);
    const hit = findOrNull(params.id as string);
    if (!hit) return fail(404, '批注不存在');
    const body = (await request.json().catch(() => ({}))) as { content?: string; authorName?: string };
    const content = String(body.content ?? '').trim();
    if (content.length < 2) return fail(400, 'content 至少 2 个字符');
    hit.replies.push({
      id: `RAR-${Date.now()}-${hit.replies.length}`,
      annotationId: hit.id,
      authorId: 'u-current',
      authorName: String(body.authorName ?? '').trim() || '当前用户',
      content,
      createdAt: new Date().toISOString(),
    });
    hit.updatedAt = new Date().toISOString();
    return ok({ ...hit, replies: [...hit.replies] });
  }),

  http.post(`${API_BASE}/report-annotations/:id/resolve`, async ({ params, request }) => {
    await delay(80);
    const hit = findOrNull(params.id as string);
    if (!hit) return fail(404, '批注不存在');
    const body = (await request.json().catch(() => ({}))) as { resolution?: string };
    hit.status = 'resolved';
    hit.resolvedAt = new Date().toISOString();
    hit.resolvedBy = '当前用户';
    hit.resolution = body.resolution && String(body.resolution).trim()
      ? String(body.resolution).trim().slice(0, 500)
      : null;
    hit.updatedAt = hit.resolvedAt;
    return ok({ ...hit, replies: [...hit.replies] });
  }),

  http.post(`${API_BASE}/report-annotations/:id/reopen`, async ({ params }) => {
    await delay(80);
    const hit = findOrNull(params.id as string);
    if (!hit) return fail(404, '批注不存在');
    hit.status = 'open';
    hit.resolvedAt = null;
    hit.resolvedBy = null;
    hit.resolution = null;
    hit.updatedAt = new Date().toISOString();
    return ok({ ...hit, replies: [...hit.replies] });
  }),
];

/**
 * G005 RIS v3.0.6.11-100 (Wave 2B 报告-影像标注双向同步) - MSW Image Annotation Handlers
 * 与后端 reports 模块对齐 (内存 + 种子):
 *   - GET  /reports/:id/image-annotations  读取报告关联影像标注 (无记录返回空列表形状)
 *   - POST /reports/:id/image-annotations  保存 (覆盖) 标注 JSON (标注项 + 源检查 UID + 可选缩略图 base64)
 */
import { http, HttpResponse, delay } from 'msw';

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

export type ReportImageAnnotationType = 'arrow' | 'circle' | 'ruler' | 'box';

export interface ReportImageAnnotationItem {
  id: string;
  type: ReportImageAnnotationType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  color: string;
}

export interface ReportImageAnnotationsRecord {
  reportId: string;
  studyUid: string;
  seriesUid: string;
  instanceUid: string;
  annotations: ReportImageAnnotationItem[];
  imageBase64: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString();

const SEED: ReportImageAnnotationsRecord[] = [
  {
    reportId: 'RPT-000001',
    studyUid: '1.2.840.10008.5.1.4.1.1.2.1.1',
    seriesUid: '1.2.840.10008.5.1.4.1.1.2.1.1.1',
    instanceUid: '1.2.840.10008.5.1.4.1.1.2.1.1.1.1',
    annotations: [
      { id: 'img-ann-001', type: 'arrow', x1: 120, y1: 140, x2: 165, y2: 120, label: '右肺上叶结节', color: '#ff4d4f' },
      { id: 'img-ann-002', type: 'ruler', x1: 210, y1: 230, x2: 280, y2: 230, label: '长径 12.5mm', color: 'var(--color-warning-400)' },
      { id: 'img-ann-003', type: 'circle', x1: 300, y1: 180, x2: 360, y2: 240, label: '磨玻璃影 ROI', color: 'var(--color-success-500)' },
    ],
    imageBase64: '',
    createdAt: iso(60 * 5),
    updatedAt: iso(60 * 5),
    createdBy: '张海涛',
  },
];

const store = new Map<string, ReportImageAnnotationsRecord>(SEED.map((r) => [r.reportId, { ...r, annotations: r.annotations.map((a) => ({ ...a })) }]));

export const imageAnnotationHandlers = [
  http.get(`${API_BASE}/reports/:id/image-annotations`, async ({ params }) => {
    await delay(60);
    const id = params.id as string;
    const record = store.get(id);
    if (!record) {
      return HttpResponse.json({
        success: true,
        data: { reportId: id, studyUid: '', seriesUid: '', instanceUid: '', annotations: [], imageBase64: '', updatedAt: null },
      });
    }
    return HttpResponse.json({ success: true, data: { ...record } });
  }),

  http.post(`${API_BASE}/reports/:id/image-annotations`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json().catch(() => ({}))) as {
      studyUid?: string;
      seriesUid?: string;
      instanceUid?: string;
      annotations?: ReportImageAnnotationItem[];
      imageBase64?: string;
    };
    const annotations = Array.isArray(body.annotations) ? body.annotations : [];
    if (annotations.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'annotations 至少 1 条' } }, { status: 400 });
    }
    for (const a of annotations) {
      if (!a?.id || !['arrow', 'circle', 'ruler', 'box'].includes(a.type)) {
        return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '标注项非法 (id/type)' } }, { status: 400 });
      }
    }
    const now = new Date().toISOString();
    const prev = store.get(id);
    const record: ReportImageAnnotationsRecord = {
      reportId: id,
      studyUid: String(body.studyUid ?? '').trim(),
      seriesUid: String(body.seriesUid ?? '').trim(),
      instanceUid: String(body.instanceUid ?? '').trim(),
      annotations: annotations.map((a) => ({ ...a })),
      imageBase64: String(body.imageBase64 ?? '').trim().slice(0, 8_000_000),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      createdBy: '当前用户',
    };
    store.set(id, record);
    return HttpResponse.json({ success: true, data: { ...record } });
  }),
];

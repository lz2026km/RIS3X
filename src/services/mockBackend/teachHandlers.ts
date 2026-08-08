// [G005 P1 W2-C] /api/v1/teach MSW handlers
// 对齐 backend modules/teach/teach.controller.ts (@Controller('teach')):
//   POST /teach/lecture · POST /teach/lecture/:id/blob?sequence=n
//   GET  /teach/lecture/:id · GET /teach/lectures · DELETE /teach/lecture/:id
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/teach';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

interface MockLecture {
  id: string;
  title: string;
  duration: number;
  createdAt: string;
  patientId?: string;
  examId?: string;
  reportId?: string;
  createdBy?: string;
  blobs: Array<{ id: string; lectureId: string; sequence: number; filename: string; sizeBytes: number; data?: Blob }>;
}

const seedLectures: MockLecture[] = [
  {
    id: 'lecture-001',
    title: '胸部CT影像判读示教',
    duration: 245,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    patientId: 'P0001',
    examId: 'exam-1001',
    createdBy: 'u-admin',
    blobs: [],
  },
  {
    id: 'lecture-002',
    title: '急诊骨折识别要点',
    duration: 320,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    patientId: 'P0002',
    examId: 'exam-1002',
    createdBy: 'u-admin',
    blobs: [],
  },
];

const lectures: MockLecture[] = [...seedLectures];

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const teachHandlers = [
  http.post(`${API}/lecture`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { title?: string; patientId?: string; examId?: string; reportId?: string };
    const title = (body?.title ?? '').trim();
    if (!title) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'title is required' } }, { status: 400 });
    }
    const lecture: MockLecture = {
      id: nextId('lecture'),
      title,
      duration: 0,
      createdAt: new Date().toISOString(),
      patientId: body.patientId,
      examId: body.examId,
      reportId: body.reportId,
      createdBy: 'u-admin',
      blobs: [],
    };
    lectures.unshift(lecture);
    return HttpResponse.json({ success: true, data: lecture }, { status: 201 });
  }),

  http.post(`${API}/lecture/:id/blob`, async ({ params, request }) => {
    await delay(delayMs(30, 90));
    const id = params.id as string;
    const lecture = lectures.find((l) => l.id === id);
    if (!lecture) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lecture not found' } }, { status: 404 });
    }
    const url = new URL(request.url);
    const seq = Number(url.searchParams.get('sequence') ?? 0);
    const form = await request.formData();
    const file = form.get('blob');
    let sizeBytes = 0;
    if (file instanceof Blob) sizeBytes = file.size;
    const filename = `${id}-${String(seq).padStart(5, '0')}.webm`;
    const blob: MockLecture['blobs'][number] = {
      id: nextId('blob'),
      lectureId: id,
      sequence: seq,
      filename,
      sizeBytes,
      data: file instanceof Blob ? file : undefined,
    };
    lecture.blobs = [...lecture.blobs.filter((b) => b.sequence !== seq), blob].sort((a, b) => a.sequence - b.sequence);
    lecture.duration = Math.max(lecture.duration, (seq + 1) * 30);
    return HttpResponse.json({ success: true, data: { id: blob.id, lectureId: id, sequence: seq, filename, sizeBytes } });
  }),

  http.get(`${API}/lecture/:id/blob/:filename`, async ({ params }) => {
    await delay(delayMs(20, 60));
    const id = params.id as string;
    const filename = params.filename as string;
    const lecture = lectures.find((l) => l.id === id);
    const blob = lecture?.blobs.find((b) => b.filename === filename);
    if (!blob) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Blob not found' } }, { status: 404 });
    }
    if (blob.data) {
      return new HttpResponse(blob.data, {
        headers: { 'Content-Type': 'video/webm', 'Content-Disposition': `inline; filename="${blob.filename}"` },
      });
    }
    // 无真实录制数据时返回最小 WebM 容器 (可被 video 元素解码播放)
    const fakeWebm = new Uint8Array([
      0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x1f, 0x42, 0x86, 0x81, 0x01,
      0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x01,
      0x42, 0xf3, 0x81, 0x01, 0x42, 0x82, 0x88, 0x77,
    ]);
    return new HttpResponse(fakeWebm, {
      headers: { 'Content-Type': 'video/webm', 'Content-Disposition': `inline; filename="${blob.filename}"` },
    });
  }),

  http.get(`${API}/lecture/:id`, async ({ params }) => {
    await delay(delayMs());
    const lecture = lectures.find((l) => l.id === params.id);
    if (!lecture) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lecture not found' } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: lecture });
  }),

  http.get(`${API}/lectures`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)));
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
    let items = lectures;
    if (search) items = items.filter((l) => l.title.toLowerCase().includes(search));
    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, page * pageSize).map((l) => ({
      ...l,
      blobs: undefined,
      _count: { blobs: l.blobs.length },
    }));
    return HttpResponse.json({ success: true, data: { items: paged, total, page, pageSize } });
  }),

  http.delete(`${API}/lecture/:id`, async ({ params }) => {
    await delay(delayMs());
    const id = params.id as string;
    const idx = lectures.findIndex((l) => l.id === id);
    if (idx < 0) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Lecture not found' } }, { status: 404 });
    }
    lectures.splice(idx, 1);
    return HttpResponse.json({ success: true, data: { deleted: id } });
  }),
];

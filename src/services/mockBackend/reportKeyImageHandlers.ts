import { http, HttpResponse, delay } from "msw";
import { v4 as uuidv4 } from "uuid";

const API_BASE =
  typeof process !== "undefined" && process.env.VITEST
    ? "http://localhost:5173/api/v1"
    : typeof window !== "undefined" && window.location?.origin
      ? window.location.origin + "/api/v1"
      : "http://localhost:5173/api/v1";

export interface ReportKeyImageRecord {
  id: string;
  reportId: string;
  examId?: string | null;
  studyUid: string;
  seriesUid: string;
  sopUid: string;
  imageKey: string;
  frame: number;
  caption: string;
  thumbnail: string;
  createdById?: string | null;
  createdAt: string;
}

const keyImageStore = new Map<string, ReportKeyImageRecord[]>();

const SEED: ReportKeyImageRecord[] = [
  {
    id: "RKI-000001",
    reportId: "RPT-000001",
    examId: "EX-001",
    studyUid: "1.2.840.10008.5.1.4.1.1.2.1.1",
    seriesUid: "1.2.840.10008.5.1.4.1.1.2.1.1.1",
    sopUid: "1.2.840.10008.5.1.4.1.1.2.1.1.1.1",
    imageKey: "1.2.840.10008.5.1.4.1.1.2.1.1.1.1",
    frame: 1,
    caption: "右肺上叶结节",
    thumbnail: "",
    createdById: "A001",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
  },
];

for (const item of SEED) {
  keyImageStore.set(item.reportId, [item]);
}

function listFor(reportId: string): ReportKeyImageRecord[] {
  const existing = keyImageStore.get(reportId);
  if (existing) return existing;
  return [];
}

export const reportKeyImageHandlers = [
  http.get(`${API_BASE}/reports/:id/key-images`, async ({ params }) => {
    await delay(80);
    const reportId = String(params.id);
    const items = listFor(reportId);
    return HttpResponse.json({
      success: true,
      data: { reportId, items, total: items.length },
    });
  }),

  http.post(
    `${API_BASE}/reports/:id/key-images`,
    async ({ params, request }) => {
      await delay(120);
      const reportId = String(params.id);
      const body = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const sopUid = String(body.sopUid ?? body.imageKey ?? "").trim();
      if (!sopUid) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: "BAD_REQUEST",
              message: "imageKey 或 sopUid 至少需要一个",
            },
          },
          { status: 400 },
        );
      }
      const record: ReportKeyImageRecord = {
        id: uuidv4(),
        reportId,
        examId: (body.examId as string | undefined) ?? null,
        studyUid: String(body.studyUid ?? "").trim(),
        seriesUid: String(body.seriesUid ?? "").trim(),
        sopUid,
        imageKey: sopUid,
        frame: Number(body.frame ?? 0),
        caption: String(body.caption ?? body.label ?? body.description ?? ""),
        thumbnail: String(body.thumbnail ?? ""),
        createdById: "A001",
        createdAt: new Date().toISOString(),
      };
      keyImageStore.set(reportId, [record, ...listFor(reportId)]);
      return HttpResponse.json(
        { success: true, data: record },
        { status: 201 },
      );
    },
  ),

  http.delete(
    `${API_BASE}/reports/:id/key-images/:imageId`,
    async ({ params }) => {
      await delay(80);
      const reportId = String(params.id);
      const imageId = String(params.imageId);
      const items = listFor(reportId);
      const next = items.filter((item) => item.id !== imageId);
      if (next.length === items.length) {
        return HttpResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "Key image not found" },
          },
          { status: 404 },
        );
      }
      keyImageStore.set(reportId, next);
      return HttpResponse.json({
        success: true,
        data: { deleted: true, id: imageId },
      });
    },
  ),
];

export default reportKeyImageHandlers;

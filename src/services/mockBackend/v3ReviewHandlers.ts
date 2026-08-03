/**
 * G005 RIS v3.0.5.1 - MSW Handlers: R3.REVIEW.ASSIST (20 handlers)
 * [v3.0.6.12-B2] top-10 routes use store.
 */
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';
import { list, get, create, update } from './store';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5173/api/v1'; }
})();

// Section 1: AI Hint
const reviewAiHintHandlers = [
  
  
  
];

// Section 2: History
const reviewHistoryHandlers = [
  
  
  
  
];

// Section 3: Comments
const reviewCommentHandlers = [
  
  
  
];

// Section 4: Reject Templates
const rejectTemplateHandlers = [
  
  
  http.post(`${API_BASE}/reviews/:id/reject`, async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as { reason: string; category: string };
    if (!body.reason || body.reason.length < 5) {
      return HttpResponse.json({ success: false, error: 'reason>=5' }, { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      data: { id: params.id, status: 'rejected', rejectReason: body.reason, rejectCategory: body.category },
    });
  }),
];

// Section 5: Workload
const workloadHandlers = [
  http.get(`${API_BASE}/reviews/workload`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const period = url.searchParams.get('period') ?? 'week';
    let data: any[] = [];
    try { data = list<any>('review_workloads').map(w => ({ ...w, period })); } catch {}
    if (data.length === 0) {
      data = Array.from({ length: 6 }, (_, i) => ({
        reviewerId: 'D00' + (i + 1),
        reviewerName: 'r' + (i + 1),
        reviewerTitle: i === 0 ? 'chief' : i < 3 ? 'associateChief' : 'attending',
        period,
        totalAssigned: 30 + i * 5,
        totalCompleted: 25 + i * 5,
        totalRejected: 3 + i,
        totalEscalated: 1,
        averageMinutes: 90 + i * 4,
        onTimeRate: 85 + i,
        rejectionRate: 10 + i % 3,
        byStage: [
          { stage: 'initial', count: 12 + i * 2, avgMinutes: 100 },
          { stage: 'final', count: 8 + i, avgMinutes: 70 },
          { stage: 'cosign', count: 3, avgMinutes: 30 },
          { stage: 'sign', count: 2 + i, avgMinutes: 20 },
        ],
        byModality: [{ modality: 'CT', count: 15 + i * 2 }, { modality: 'MR', count: 8 + i }],
        byPriority: [{ priority: 'urgent', count: 8 + i }],
        trend: Array.from({ length: 7 }, (_, j) => ({
          date: new Date(Date.now() - (6 - j) * 86400000).toISOString().slice(0, 10),
          completed: 4 + (j % 3) + i,
          rejected: j % 4 === 0 ? 1 : 0,
        })),
      }));
    }
    return HttpResponse.json({ success: true, data });
  }),
  
  
  
];

// Section 6: SLA
const slaHandlers = [
  http.get(`${API_BASE}/reviews/sla`, async () => {
    await delay(100);
    let data: any = null;
    try { data = get<any>('review_sla', 'current'); } catch {}
    if (!data) {
      data = {
        id: 'current',
        initialReviewSLA: 4,
        finalReviewSLA: 2,
        signSLA: 1,
        cosignSLA: 1,
        escalateSLA: 0.5,
        onTimeRate: 87.5,
        overdueCount: 5,
        averageInitialMinutes: 108,
        averageFinalMinutes: 72,
        averageCosignMinutes: 30,
        p95InitialMinutes: 240,
        p95FinalMinutes: 180,
        breachByStage: { initial: 3, final: 2, cosign: 1, sign: 2 },
      };
    }
    return HttpResponse.json({ success: true, data });
  }),
  
  
];

// Section 7: Reviewer Assignment
const reviewerAssignmentHandlers = [
  
  http.post(`${API_BASE}/reviews/:id/assign`, async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as { reviewerId: string; reviewerName: string; strategy: string };
    const item = {
      id: 'ra-' + Date.now() + '-' + uuidv4().slice(0, 8),
      taskId: params.id,
      reviewerId: body.reviewerId,
      reviewerName: body.reviewerName,
      assignedBy: 'D001',
      assignedAt: new Date().toISOString(),
      strategy: body.strategy,
    };
    try { create('review_assignments', item); } catch {}
    return HttpResponse.json({ success: true, data: item });
  }),
  
];

export const reviewAssistHandlers = [
  ...reviewAiHintHandlers,
  ...reviewHistoryHandlers,
  ...reviewCommentHandlers,
  ...rejectTemplateHandlers,
  ...workloadHandlers,
  ...slaHandlers,
  ...reviewerAssignmentHandlers,
];
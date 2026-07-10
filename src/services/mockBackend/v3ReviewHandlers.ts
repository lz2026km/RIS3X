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
  http.get(`${API_BASE}/reviews/ai-hint/:reportId`, async ({ params }) => {
    await delay(400);
    let data: any = null;
    try {
      const all = list<any>('review_ai_hints');
      const found = all.find(a => a.reportId === params.reportId);
      data = found ?? all[0] ?? null;
    } catch {}
    if (!data) {
      data = {
        id: 'ai-' + uuidv4().slice(0, 8),
        reportId: params.reportId,
        suggestedScore: 88,
        confidence: 0.86,
        riskLevel: 'low',
        consistencyScore: 0.9,
        completenessScore: 0.85,
        terminologyScore: 0.92,
        criticalFindingDetected: false,
        defects: [
          { code: 'D-001', name: 'term', severity: 'minor', position: 'p1', suggestion: 'use std term' },
        ],
        suggestions: ['ok'],
        generatedAt: new Date().toISOString(),
        modelVersion: 'v2.3.1',
      };
    }
    return HttpResponse.json({ success: true, data });
  }),
  http.post(`${API_BASE}/reviews/ai-hint/:reportId/trigger`, async ({ params }) => {
    await delay(1500);
    const id = 'ai-' + Date.now() + '-' + uuidv4().slice(0, 8);
    const item = {
      id,
      reportId: params.reportId,
      suggestedScore: 85,
      confidence: 0.84,
      riskLevel: 'medium',
      consistencyScore: 0.85,
      completenessScore: 0.82,
      terminologyScore: 0.88,
      criticalFindingDetected: false,
      defects: [],
      suggestions: ['AI re-analyzed'],
      generatedAt: new Date().toISOString(),
      modelVersion: 'v2.3.1',
    };
    try { create('review_ai_hints', item); } catch {}
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API_BASE}/reviews/ai-hint/:reportId/diff`, async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: { diffs: [{ field: 'findings', aiText: 'a', doctorText: 'b', severity: 'minor' }] } });
  }),
];

// Section 2: History
const reviewHistoryHandlers = [
  http.get(`${API_BASE}/reviews/:id/history`, async ({ params }) => {
    await delay(120);
    let data: any[] = [];
    try { data = list<any>('review_history').filter(h => h.taskId === params.id); } catch {}
    if (data.length === 0) {
      data = [
        { id: 'h-1', taskId: params.id, action: 'submit', actorName: 'zmy', timestamp: '2026-06-15T08:00:00Z', fromStage: 'writing', toStage: 'submitted' },
        { id: 'h-2', taskId: params.id, action: 'assign', actorName: 'sys', timestamp: '2026-06-15T08:05:00Z', fromStage: 'submitted', toStage: 'initial' },
        { id: 'h-3', taskId: params.id, action: 'start-initial', actorName: 'lhm', timestamp: '2026-06-15T08:30:00Z', fromStage: 'submitted', toStage: 'initial' },
        { id: 'h-4', taskId: params.id, action: 'approve-initial', actorName: 'lhm', score: 92, comment: 'ok', timestamp: '2026-06-15T09:15:00Z', fromStage: 'initial', toStage: 'final' },
      ];
    }
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/reviews/:id/history.pdf`, async () => {
    await delay(500);
    return HttpResponse.json({ success: true, data: { data: 'PDF', mime: 'application/pdf', filename: 'r.pdf' } });
  }),
  http.get(`${API_BASE}/reviews/:id/history.json`, async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: { data: '[]', mime: 'application/json', filename: 'r.json' } });
  }),
  http.get(`${API_BASE}/reviews/:id/comment-history`, async () => {
    await delay(150);
    return HttpResponse.json({ success: true, data: [{ id: 'ch-1', content: 'note', author: 'a', at: '2026-06-15T08:35:00Z' }] });
  }),
];

// Section 3: Comments
const reviewCommentHandlers = [
  http.get(`${API_BASE}/reviews/:id/comments`, async ({ params }) => {
    await delay(100);
    let data: any[] = [];
    try { data = list<any>('review_comments').filter(c => c.taskId === params.id); } catch {}
    if (data.length === 0) data = [{ id: 'c-1', taskId: params.id, reviewId: params.id, author: 'doc', content: 'note', createdAt: '2026-07-03T10:00:00Z' }];
    return HttpResponse.json({ success: true, data });
  }),
  http.post(`${API_BASE}/reviews/:id/comments`, async ({ params, request }) => {
    await delay(150);
    const body = (await request.json().catch(() => ({}))) as { content?: string; mentions?: string[] };
    const id = 'cmt-' + Date.now() + '-' + uuidv4().slice(0, 8);
    const item = {
      id,
      taskId: params.id,
      reportId: 'RP20260615001',
      authorId: 'D001',
      authorName: 'current',
      authorColor: '#3b82f6',
      content: body.content ?? '',
      position: { x: 0, y: 0 },
      resolved: false,
      mentions: body.mentions ?? [],
      createdAt: new Date().toISOString(),
    };
    try { create('review_comments', item); } catch {}
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.post(`${API_BASE}/reviews/comments/:id/resolve`, async ({ params }) => {
    await delay(100);
    let updated: any = { id: params.id, resolved: true, resolvedAt: new Date().toISOString() };
    try {
      const existing = get<any>('review_comments', params.id as string);
      if (existing) updated = update<any>('review_comments', params.id as string, { resolved: true, resolvedAt: updated.resolvedAt }) ?? updated;
      else create('review_comments', updated);
    } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
];

// Section 4: Reject Templates
const rejectTemplateHandlers = [
  http.get(`${API_BASE}/reviews/reject-templates`, async () => {
    await delay(80);
    let data: any[] = [];
    try { data = list<any>('review_reject_templates'); } catch {}
    if (data.length === 0) {
      data = [
        { id: 'rt-1', category: 'unclear-description', title: 'unclear', presetComment: 'desc', requiredMinLength: 10 },
        { id: 'rt-2', category: 'terminology-error', title: 'term', presetComment: 'fix term', requiredMinLength: 5 },
        { id: 'rt-3', category: 'left-right-confusion', title: 'lr', presetComment: 'check lr', requiredMinLength: 8 },
      ];
    }
    return HttpResponse.json({ success: true, data });
  }),
  http.post(`${API_BASE}/reviews/reject-templates`, async ({ request }) => {
    await delay(100);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = 'rt-' + Date.now() + '-' + uuidv4().slice(0, 8);
    const item = { id, ...body, createdAt: new Date().toISOString() };
    try { create('review_reject_templates', item as any); } catch {}
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
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
  http.get(`${API_BASE}/reviews/kpi/personal`, async () => {
    await delay(150);
    let data: any = null;
    try { data = get<any>('review_kpi_personal', 'current'); } catch {}
    if (!data) {
      data = {
        id: 'current',
        todayCompleted: 12,
        passRate: 92.5,
        rejectRate: 7.5,
        avgMinutes: 75,
        overdueCount: 1,
        totalScore: 1240,
        rank: 3,
      };
    }
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/reviews/kpi/ranking`, async () => {
    await delay(120);
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        reviewerId: 'D00' + (i + 1),
        reviewerName: 'r' + (i + 1),
        score: 1500 - i * 50,
        completed: 80 - i * 4,
      })),
    });
  }),
  http.get(`${API_BASE}/reviews/kpi/distribution`, async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: [{ name: 'initial', value: 45 }, { name: 'final', value: 30 }, { name: 'cosign', value: 15 }, { name: 'sign', value: 10 }],
    });
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
  http.get(`${API_BASE}/reviews/sla-config`, async () => {
    await delay(80);
    let data: any = null;
    try { data = get<any>('review_sla_config', 'default'); } catch {}
    if (!data) data = { id: 'default', initialReviewSLA: 4, finalReviewSLA: 2, signSLA: 1, cosignSLA: 1, escalateSLA: 0.5 };
    return HttpResponse.json({ success: true, data });
  }),
  http.put(`${API_BASE}/reviews/sla-config`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as Record<string, number>;
    const item = { id: 'default', ...body, updatedAt: new Date().toISOString() };
    try {
      const existing = get<any>('review_sla_config', 'default');
      if (existing) update<any>('review_sla_config', 'default', item);
      else create('review_sla_config', item);
    } catch {}
    return HttpResponse.json({ success: true, data: item });
  }),
];

// Section 7: Reviewer Assignment
const reviewerAssignmentHandlers = [
  http.get(`${API_BASE}/reviews/reviewers`, async () => {
    await delay(150);
    let data: any[] = [];
    try { data = list<any>('review_reviewers'); } catch {}
    if (data.length === 0) {
      data = Array.from({ length: 6 }, (_, i) => ({
        id: 'D00' + (i + 1),
        name: 'r' + (i + 1),
        title: i === 0 ? 'chief' : i < 3 ? 'associateChief' : 'attending',
        titleLabel: i === 0 ? 'chief' : i < 3 ? 'associateChief' : 'attending',
        department: 'rad',
        status: i % 3 === 0 ? 'busy' : 'online',
        currentLoad: 5 + i,
        maxLoad: 15,
        pendingCount: 3 + i,
        inProgressCount: 2,
        completedToday: 8 + i,
        avgReviewMinutes: 80 + i * 4,
        onTimeRate: 88 + i,
        rejectionRate: 10 + i % 3,
        specialty: ['ct', 'mr'],
      }));
    }
    return HttpResponse.json({ success: true, data });
  }),
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
  http.post(`${API_BASE}/reviews/batch-assign`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { taskIds: string[]; reviewerId: string };
    return HttpResponse.json({
      success: true,
      data: { assigned: body.taskIds?.length ?? 0, failed: 0, reviewerId: body.reviewerId },
    });
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
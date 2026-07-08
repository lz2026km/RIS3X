/**
 * G005 RIS v3.0.5.1 - MSW Handlers: R3.REVIEW.ASSIST (20 handlers)
 * Covers R3.REVIEW.045-046 (AI Hint), .010/.086-088 (History),
 * .063-064 (Comment), .038-039 (Reject Templates), .246-250 (Workload),
 * .027-028 (SLA), .020-022 (Reviewer Assignment).
 */
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = 'http://localhost:5173/api/v1';

// ============================================================
// 1. R3.REVIEW AI Hint (3 handlers)
// ============================================================
const reviewAiHintHandlers = [
  http.get(`${API_BASE}/reviews/ai-hint/:reportId`, async () => {
    await delay(400);
    return HttpResponse.json({
      success: true,
      data: {
        id: `ai-${uuidv4().slice(0, 8)}`,
        reportId: 'RP20260615001',
        suggestedScore: 88,
        confidence: 0.86,
        riskLevel: 'low',
        consistencyScore: 0.9,
        completenessScore: 0.85,
        terminologyScore: 0.92,
        criticalFindingDetected: false,
        defects: [
          {
            code: 'D-001',
            name: '术语不统一',
            severity: 'minor',
            position: '所见 第2段',
            suggestion: '建议统一使用"斑片状高密度影"',
          },
        ],
        suggestions: ['整体质量良好，可提交审核'],
        generatedAt: new Date().toISOString(),
        modelVersion: 'v2.3.1',
      },
    });
  }),
  http.post(`${API_BASE}/reviews/ai-hint/:reportId/trigger`, async ({ params }) => {
    await delay(1500);
    return HttpResponse.json({
      success: true,
      data: {
        id: `ai-${Date.now()}`,
        reportId: params.reportId,
        suggestedScore: 85,
        confidence: 0.84,
        riskLevel: 'medium',
        consistencyScore: 0.85,
        completenessScore: 0.82,
        terminologyScore: 0.88,
        criticalFindingDetected: false,
        defects: [],
        suggestions: ['AI 重新分析完成'],
        generatedAt: new Date().toISOString(),
        modelVersion: 'v2.3.1',
      },
    });
  }),
  http.get(`${API_BASE}/reviews/ai-hint/:reportId/diff`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: {
        diffs: [
          { field: 'findings', aiText: '右肺上叶斑片影', doctorText: '右肺上叶斑片状高密度影', severity: 'minor' },
        ],
      },
    });
  }),
];

// ============================================================
// 2. R3.REVIEW History (4 handlers)
// ============================================================
const reviewHistoryHandlers = [
  http.get(`${API_BASE}/reviews/:id/history`, async () => {
    await delay(120);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'h-1', action: 'submit', actorName: '张明远', timestamp: '2026-06-15T08:00:00Z', fromStage: 'writing', toStage: 'submitted' },
        { id: 'h-2', action: 'assign', actorName: '系统', timestamp: '2026-06-15T08:05:00Z', fromStage: 'submitted', toStage: 'initial' },
        { id: 'h-3', action: 'start-initial', actorName: '李慧敏', timestamp: '2026-06-15T08:30:00Z', fromStage: 'submitted', toStage: 'initial' },
        { id: 'h-4', action: 'approve-initial', actorName: '李慧敏', score: 92, comment: '描述清晰', timestamp: '2026-06-15T09:15:00Z', fromStage: 'initial', toStage: 'final' },
      ],
    });
  }),
  http.get(`${API_BASE}/reviews/:id/history.pdf`, async () => {
    await delay(500);
    return HttpResponse.json({
      success: true,
      data: { data: 'PDF-mock-content', mime: 'application/pdf', filename: 'review-history.pdf' },
    });
  }),
  http.get(`${API_BASE}/reviews/:id/history.json`, async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: { data: '[]', mime: 'application/json', filename: 'review-history.json' },
    });
  }),
  http.get(`${API_BASE}/reviews/:id/comment-history`, async () => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'ch-1', content: '初稿建议补充测量数据', author: '李慧敏', at: '2026-06-15T08:35:00Z' },
      ],
    });
  }),
];

// ============================================================
// 3. R3.REVIEW Comments (3 handlers)
// ============================================================
const reviewCommentHandlers = [
  http.get(`${API_BASE}/reviews/:id/comments`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: [{ id: 'c-1', reviewId: '1', author: '张医生', content: '建议补充影像所见描述', createdAt: '2026-07-03T10:00:00Z' }] });
  }),
  http.post(`${API_BASE}/reviews/:id/comments`, async ({ params, request }) => {
    await delay(150);
    const body = (await request.json()) as { content: string; mentions?: string[] };
    return HttpResponse.json({
      success: true,
      data: {
        id: `cmt-${Date.now()}`,
        taskId: params.id,
        reportId: 'RP20260615001',
        authorId: 'D001',
        authorName: '当前用户',
        authorColor: '#3b82f6',
        content: body.content ?? '',
        position: { x: 0, y: 0 },
        resolved: false,
        mentions: body.mentions ?? [],
        createdAt: new Date().toISOString(),
      },
    });
  }),
  http.post(`${API_BASE}/reviews/comments/:id/resolve`, async ({ params }) => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id,
        resolved: true,
        resolvedAt: new Date().toISOString(),
      },
    });
  }),
];

// ============================================================
// 4. R3.REVIEW Reject Templates (3 handlers)
// ============================================================
const rejectTemplateHandlers = [
  http.get(`${API_BASE}/reviews/reject-templates`, async () => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'rt-1', category: 'unclear-description', title: '描述不充分', presetComment: '请补充病灶描述', requiredMinLength: 10 },
        { id: 'rt-2', category: 'terminology-error', title: '术语错误', presetComment: '请修正术语', requiredMinLength: 5 },
        { id: 'rt-3', category: 'left-right-confusion', title: '左右混淆', presetComment: '请核对左右', requiredMinLength: 8 },
      ],
    });
  }),
  http.post(`${API_BASE}/reviews/reject-templates`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: { id: `rt-${Date.now()}` } }, { status: 201 });
  }),
  http.post(`${API_BASE}/reviews/:id/reject`, async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as { reason: string; category: string };
    if (!body.reason || body.reason.length < 5) {
      return HttpResponse.json({ success: false, error: '驳回原因不能少于 5 字符' }, { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      data: { id: params.id, status: 'rejected', rejectReason: body.reason, rejectCategory: body.category },
    });
  }),
];

// ============================================================
// 5. R3.REVIEW Workload Stats (4 handlers)
// ============================================================
const workloadHandlers = [
  http.get(`${API_BASE}/reviews/workload`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const period = url.searchParams.get('period') ?? 'week';
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: 6 }, (_, i) => ({
        reviewerId: `D00${i + 1}`,
        reviewerName: `审核员${i + 1}`,
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
        byModality: [
          { modality: 'CT', count: 15 + i * 2 },
          { modality: 'MR', count: 8 + i },
        ],
        byPriority: [{ priority: 'urgent', count: 8 + i }],
        trend: Array.from({ length: 7 }, (_, j) => ({
          date: new Date(Date.now() - (6 - j) * 86400000).toISOString().slice(0, 10),
          completed: 4 + (j % 3) + i,
          rejected: j % 4 === 0 ? 1 : 0,
        })),
      })),
    });
  }),
  http.get(`${API_BASE}/reviews/kpi/personal`, async () => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: {
        todayCompleted: 12,
        passRate: 92.5,
        rejectRate: 7.5,
        avgMinutes: 75,
        overdueCount: 1,
        totalScore: 1240,
        rank: 3,
      },
    });
  }),
  http.get(`${API_BASE}/reviews/kpi/ranking`, async () => {
    await delay(120);
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        reviewerId: `D00${i + 1}`,
        reviewerName: `审核员${i + 1}`,
        score: 1500 - i * 50,
        completed: 80 - i * 4,
      })),
    });
  }),
  http.get(`${API_BASE}/reviews/kpi/distribution`, async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: [
        { name: '初审', value: 45 },
        { name: '终审', value: 30 },
        { name: '双签', value: 15 },
        { name: '签发', value: 10 },
      ],
    });
  }),
];

// ============================================================
// 6. R3.REVIEW SLA (3 handlers)
// ============================================================
const slaHandlers = [
  http.get(`${API_BASE}/reviews/sla`, async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      data: {
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
      },
    });
  }),
  http.get(`${API_BASE}/reviews/sla-config`, async () => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: { initialReviewSLA: 4, finalReviewSLA: 2, signSLA: 1, cosignSLA: 1, escalateSLA: 0.5 },
    });
  }),
  http.put(`${API_BASE}/reviews/sla-config`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as Record<string, number>;
    return HttpResponse.json({ success: true, data: body });
  }),
];

// ============================================================
// 7. R3.REVIEW Reviewer Assignment (3 handlers)
// ============================================================
const reviewerAssignmentHandlers = [
  http.get(`${API_BASE}/reviews/reviewers`, async () => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: 6 }, (_, i) => ({
        id: `D00${i + 1}`,
        name: `审核员${i + 1}`,
        title: i === 0 ? 'chief' : i < 3 ? 'associateChief' : 'attending',
        titleLabel: i === 0 ? '主任' : i < 3 ? '副主任' : '主治',
        department: '放射科',
        status: i % 3 === 0 ? 'busy' : 'online',
        currentLoad: 5 + i,
        maxLoad: 15,
        pendingCount: 3 + i,
        inProgressCount: 2,
        completedToday: 8 + i,
        avgReviewMinutes: 80 + i * 4,
        onTimeRate: 88 + i,
        rejectionRate: 10 + i % 3,
        specialty: ['胸部', '腹部'],
      })),
    });
  }),
  http.post(`${API_BASE}/reviews/:id/assign`, async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as { reviewerId: string; reviewerName: string; strategy: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: `ra-${Date.now()}`,
        taskId: params.id,
        reviewerId: body.reviewerId,
        reviewerName: body.reviewerName,
        assignedBy: 'D001',
        assignedAt: new Date().toISOString(),
        strategy: body.strategy,
      },
    });
  }),
  http.post(`${API_BASE}/reviews/batch-assign`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { taskIds: string[]; reviewerId: string };
    return HttpResponse.json({
      success: true,
      data: {
        assigned: body.taskIds?.length ?? 0,
        failed: 0,
        reviewerId: body.reviewerId,
      },
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

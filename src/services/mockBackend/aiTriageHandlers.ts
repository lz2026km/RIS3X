// [W3-2] AI 智能分检 MSW handlers (/api/v1/triage/*)
// 页面: /ai-triage (AiTriagePage) / TriageDashboardPage
// [G005 Wave1A P0] 路径与后端 triage.controller 对齐 (/triage/score|batch-score|assign|pending|stats)。
// 后端已实现同路径真实端点, MSW 仅用于 dev mock 模式支撑。
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/triage';

const LEVEL_DOCTORS: Record<string, string> = {
  CRITICAL: '急诊放射科·值班二线',
  URGENT: '放射科·高年资主治',
  SEMI_URGENT: '放射科·主治医师',
  ROUTINE: '放射科·住院医师',
};

function buildFactors(score: number, level: string) {
  const base = [
    { name: '危急征象', weight: 0.4, contribution: level === 'CRITICAL' ? 0.38 : level === 'URGENT' ? 0.3 : 0.15, description: 'AI 检出危急征象(出血/张力性气胸/主动脉夹层等)' },
    { name: '症状相关性', weight: 0.25, contribution: 0.18, description: '主诉与影像征象关联度' },
    { name: '病史风险', weight: 0.2, contribution: 0.14, description: '年龄/既往史/危险因素' },
    { name: '检查类别', weight: 0.15, contribution: 0.1, description: '急诊/平诊检查类别权重' },
  ];
  return base.map((f) => ({
    ...f,
    contribution: Math.round(f.weight * score * 100) / 100,
  }));
}

let pendingItems: any[] = [
  {
    examId: 'EXAM-20260807-001',
    patientId: 'P100001',
    patientName: '张伟',
    examType: 'CT',
    symptoms: '突发胸痛、呼吸困难 30 分钟',
    clinicalInfo: '疑似主动脉夹层, 高血压病史',
    referringDept: '急诊科',
    patientAge: 58,
    gender: '男',
    score: 92,
    level: 'CRITICAL' as const,
    factors: buildFactors(0.92, 'CRITICAL'),
    suggestedDoctor: '急诊放射科·值班二线',
    aiConfidence: 0.96,
    reasoning: '患者突发胸痛伴呼吸困难, 病史含高血压, 检查为胸部增强CT。AI 检出主动脉增宽征象, 需优先处理。',
    status: 'PENDING',
    createdAt: '2026-08-07T08:42:00.000Z',
  },
  {
    examId: 'EXAM-20260807-002',
    patientId: 'P100002',
    patientName: '李娜',
    examType: 'CT',
    symptoms: '头部外伤后呕吐 2 次',
    clinicalInfo: '高处坠落, GCS 14 分',
    referringDept: '急诊科',
    patientAge: 34,
    gender: '女',
    score: 78,
    level: 'URGENT' as const,
    factors: buildFactors(0.78, 'URGENT'),
    suggestedDoctor: '放射科·高年资主治',
    aiConfidence: 0.9,
    reasoning: '外伤后呕吐提示颅内压升高可能, 需尽快完成头颅CT并观察出血征象。',
    status: 'PENDING',
    createdAt: '2026-08-07T08:30:00.000Z',
  },
  {
    examId: 'EXAM-20260807-003',
    patientId: 'P100003',
    patientName: '王芳',
    examType: 'MR',
    symptoms: '腰椎间盘突出复查',
    clinicalInfo: '术后 3 月复查',
    referringDept: '骨科',
    patientAge: 52,
    gender: '女',
    score: 55,
    level: 'SEMI_URGENT' as const,
    factors: buildFactors(0.55, 'SEMI_URGENT'),
    suggestedDoctor: '放射科·主治医师',
    aiConfidence: 0.84,
    reasoning: '常规术后复查, 无急性神经症状, 可按序安排。',
    status: 'ASSIGNED',
    assignedDoctor: '放射科·主治医师',
    createdAt: '2026-08-07T07:50:00.000Z',
  },
  {
    examId: 'EXAM-20260807-004',
    patientId: 'P100004',
    patientName: '陈丽',
    examType: 'X-ray',
    symptoms: '常规体检胸片',
    clinicalInfo: '无异常主诉',
    referringDept: '体检中心',
    patientAge: 41,
    gender: '女',
    score: 25,
    level: 'ROUTINE' as const,
    factors: buildFactors(0.25, 'ROUTINE'),
    suggestedDoctor: '放射科·住院医师',
    aiConfidence: 0.78,
    reasoning: '常规体检检查, 无风险因素, 常规流程处理。',
    status: 'COMPLETED',
    assignedDoctor: '放射科·住院医师',
    createdAt: '2026-08-06T15:20:00.000Z',
  },
];

let aiTriageStats = {
  total: 128,
  byLevel: { CRITICAL: 3, URGENT: 11, SEMI_URGENT: 27, ROUTINE: 87 },
  avgScore: 61,
  accuracy: 95,
};

export const aiTriageHandlers = [
  http.get(`${API}/pending`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: pendingItems });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true, data: aiTriageStats });
  }),

  http.post(`${API}/score`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const score = 62 + Math.floor((body.examId?.length ?? 0) % 30);
    const level = score >= 80 ? 'CRITICAL' : score >= 65 ? 'URGENT' : score >= 45 ? 'SEMI_URGENT' : 'ROUTINE';
    const result = {
      examId: body.examId || `EXAM-${Date.now()}`,
      patientId: body.patientId || `P${Date.now()}`,
      patientName: body.patientName || '当前患者',
      examType: body.examType || 'CT',
      score,
      level,
      factors: buildFactors(score / 100, level),
      suggestedDoctor: LEVEL_DOCTORS[level],
      aiConfidence: 0.82 + (score % 15) / 100,
      reasoning: `基于症状(${body.symptoms || '无'})、病史与检查类别的多因子加权评分, 综合得分 ${score} 分, 建议 ${LEVEL_DOCTORS[level]} 优先处理。`,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
    };
    pendingItems.unshift(result);
    aiTriageStats = { ...aiTriageStats, total: aiTriageStats.total + 1 };
    return HttpResponse.json({ success: true, data: result }, { status: 201 });
  }),

  http.post(`${API}/assign`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as any;
    const item = pendingItems.find((i) => i.examId === body.examId);
    const assignedDoctor = body.assignedDoctor ?? LEVEL_DOCTORS[item?.level ?? 'ROUTINE'] ?? '放射科·住院医师';
    const result = {
      examId: body.examId,
      patientId: body.patientId,
      patientName: body.patientName,
      examType: body.examType,
      score: item?.score ?? 60,
      level: item?.level ?? 'ROUTINE',
      factors: item?.factors ?? buildFactors(0.6, 'ROUTINE'),
      suggestedDoctor: assignedDoctor,
      assignedDoctor,
      aiConfidence: item?.aiConfidence ?? 0.8,
      reasoning: item?.reasoning ?? 'AI 自动分诊并分配。',
      status: 'ASSIGNED' as const,
      createdAt: item?.createdAt ?? new Date().toISOString(),
    };
    if (item) { item.status = 'ASSIGNED'; item.assignedDoctor = assignedDoctor; }
    return HttpResponse.json({ success: true, data: result });
  }),

  http.post(`${API}/batch-score`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as any;
    const items: any[] = (body.items ?? []).map((input: any) => {
      const score = 55 + Math.floor(Math.random() * 35);
      const level = score >= 80 ? 'CRITICAL' : score >= 65 ? 'URGENT' : score >= 45 ? 'SEMI_URGENT' : 'ROUTINE';
      return {
        examId: input.examId,
        patientId: input.patientId,
        patientName: input.patientName,
        examType: input.examType,
        score,
        level,
        factors: buildFactors(score / 100, level),
        suggestedDoctor: LEVEL_DOCTORS[level],
        aiConfidence: 0.8,
        reasoning: '批量分诊完成。',
      };
    });
    return HttpResponse.json({ success: true, data: items });
  }),
];

export default aiTriageHandlers;

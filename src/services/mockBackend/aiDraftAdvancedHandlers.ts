/**
 * G005 RIS v3.0.6.11-100 Wave 3A (G-19) — AI 草稿深化 MSW Handlers
 * GET  /ai-draft/providers           可用模型列表 (mock/deepseek/hunyuan)
 * GET  /ai-draft/rag-context?reportId=  既往报告摘要 + 匹配 SNOMED 术语
 * POST /ai-draft/generate-advanced    LLM 生成草稿 + confidenceScore + sources[]
 * POST /ai-draft/generate-structured  自动填充 现病史/检查所见/诊断意见 段落
 */
import { http, HttpResponse, delay } from 'msw';
import { list, create } from './store';

const DRAFT_STORE = 'ai_report_drafts' as const;

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1';

interface Section { heading: string; content: string }

const PROVIDERS = [
  {
    id: 'mock', name: '确定性模板引擎', model: 'mock-nlg-1.0', kind: 'template',
    available: true, apiKeyConfigured: false,
    description: '本地模板 NLG: 确定性生成, 无网络依赖, 可用于演示/离线回退',
  },
  {
    id: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat', kind: 'llm',
    available: false, apiKeyConfigured: false,
    description: 'DeepSeek-V3 通用大模型 (OpenAI 兼容接口, 需 DEEPSEEK_API_KEY)',
  },
  {
    id: 'hunyuan', name: '腾讯混元', model: 'hunyuan-turbo', kind: 'llm',
    available: false, apiKeyConfigured: false,
    description: '腾讯混元大模型 (需 HUNYUAN_API_KEY)',
  },
];

const SNOMED_TERMS: { term: string; code: string; keywords: string[] }[] = [
  { term: '肺', code: 'SNOMED-CT:39607008', keywords: ['肺', '胸', '结节', '磨玻璃', '实变'] },
  { term: '肝', code: 'SNOMED-CT:10200004', keywords: ['肝', '胆囊'] },
  { term: '乳腺', code: 'SNOMED-CT:76752008', keywords: ['乳腺', '乳房', 'BI-RADS'] },
  { term: '脑', code: 'SNOMED-CT:12738006', keywords: ['脑', '颅', '卒中', '梗死'] },
  { term: '腰椎', code: 'SNOMED-CT:122494005', keywords: ['腰', '椎', '间盘'] },
  { term: '腹部', code: 'SNOMED-CT:818983003', keywords: ['腹', '胰腺', '脾'] },
  { term: '甲状腺', code: 'SNOMED-CT:69748006', keywords: ['甲状腺', 'TI-RADS'] },
  { term: '心脏', code: 'SNOMED-CT:80891009', keywords: ['心', '冠脉'] },
];

function matchTerms(bodyPart: string, findings: string) {
  const haystack = `${bodyPart ?? ''} ${findings ?? ''}`;
  return SNOMED_TERMS.filter((t) => t.keywords.some((k) => haystack.includes(k)))
    .map((t) => ({ term: t.term, code: t.code }));
}

function snippetOf(text: string, max = 80): string {
  const plain = (text ?? '').replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

function findReport(reportId: string): any {
  try {
    const rp = (list<any>('reports') || []).find((r: any) =>
      String(r.reportId ?? r.id ?? '') === reportId || String(r.examId ?? '') === reportId);
    if (rp) return rp;
  } catch { /* ignore */ }
  try {
    return (list<any>('exams') || []).find((e: any) => String(e.id ?? e.reportId ?? e.examId ?? '') === reportId);
  } catch {
    return null;
  }
}

function priorReports(patientId: string, excludeId: string, take = 5): any[] {
  const all = [
    ...(list<any>('reports') || []),
    ...(list<any>('exams') || []),
  ];
  return all
    .filter((r: any) => r.patientId && String(r.patientId) === String(patientId)
      && String(r.reportId ?? r.id ?? r.examId ?? '') !== String(excludeId)
      && (r.findings || r.impression))
    .sort((a: any, b: any) => String(b.createdAt ?? b.studyDate ?? '').localeCompare(String(a.createdAt ?? a.studyDate ?? '')))
    .slice(0, take);
}

function buildAdvancedDraft(body: any) {
  const reportId = String(body.reportId ?? '');
  const report = findReport(reportId);
  const modality = report?.modality ?? 'CT';
  const bodyPart = report?.bodyPart ?? '胸部';
  const findings = report?.findings ?? body?.findings ?? '';
  const includeRag = Boolean(body?.includeRag);
  const provider: 'mock' | 'deepseek' | 'hunyuan' =
    body?.provider === 'deepseek' || body?.provider === 'hunyuan' ? body.provider : 'mock';
  const fallbackToMock = provider !== 'mock';

  const sources: { reportId: string; date: string; snippet: string }[] = [];
  if (includeRag && report?.patientId) {
    for (const r of priorReports(report.patientId, reportId)) {
      sources.push({
        reportId: String(r.reportId ?? r.id ?? r.examId ?? ''),
        date: (r.createdAt ?? r.studyDate ?? '').toString().slice(0, 10),
        snippet: snippetOf(r.findings || r.impression),
      });
    }
  }

  const sections: Section[] = [
    { heading: '检查技术', content: `${modality}${bodyPart}平扫` },
  ];
  const findingsLines: string[] = [];
  if (findings) findingsLines.push(`${bodyPart}检查显示${findings}${findings.endsWith('。') ? '' : '。'}`);
  findingsLines.push(`${bodyPart}未见明确异常密度影，边界清晰，形态规则。`);
  if (sources.length) {
    findingsLines.push(`与既往报告（${sources.map((s) => s.reportId).join('、')}）比较：病灶大小、形态未见明显变化。`);
  }
  sections.push({ heading: '影像所见', content: findingsLines.join('\n') });
  sections.push({ heading: '影像诊断', content: findings ? `1. ${findings}，性质待定。\n2. 建议结合临床随访观察。` : '1. 未见明确异常。' });
  sections.push({ heading: '建议', content: '建议定期随访复查。' });

  const baseScore = { mock: 0.9, deepseek: 0.94, hunyuan: 0.93 }[provider] ?? 0.9;
  let confidenceScore = baseScore;
  if (sources.length) confidenceScore = Math.min(0.98, confidenceScore + 0.03);
  if (fallbackToMock) confidenceScore = Math.min(0.98, confidenceScore - 0.05);
  confidenceScore = Math.round(confidenceScore * 100) / 100;

  return { reportId, provider, modelVersion: { mock: 'mock-nlg-1.0', deepseek: 'deepseek-chat', hunyuan: 'hunyuan-turbo' }[provider], sections, confidenceScore, sources, ragUsed: sources.length > 0, fallbackToMock };
}

function serialize(sections: Section[]): string {
  return sections.map((s) => `【${s.heading}】\n${s.content}`).join('\n\n');
}

let advSeq = 0;

export const aiDraftAdvancedHandlers = [
  http.get(`${API_BASE}/ai-draft/providers`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true, data: PROVIDERS });
  }),

  http.get(`${API_BASE}/ai-draft/rag-context`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId') ?? '';
    const report = findReport(reportId);
    if (!report) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Report ${reportId} not found` } }, { status: 404 });
    }
    const prior = priorReports(report.patientId, reportId);
    return HttpResponse.json({
      success: true,
      data: {
        reportId,
        patientId: report.patientId,
        modality: report.modality ?? 'CT',
        bodyPart: report.bodyPart ?? '胸部',
        clinicalInfo: '',
        matchedTerms: matchTerms(report.bodyPart ?? '', `${report.findings ?? ''} ${report.impression ?? ''}`),
        priorReports: prior.map((r: any) => ({
          reportId: String(r.reportId ?? r.id ?? r.examId ?? ''),
          date: (r.createdAt ?? r.studyDate ?? '').toString().slice(0, 10),
          snippet: snippetOf(r.findings || r.impression),
        })),
      },
    });
  }),

  http.post(`${API_BASE}/ai-draft/generate-advanced`, async ({ request }) => {
    await delay(700);
    const body = (await request.json()) as any;
    if (!body?.reportId) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'reportId is required' } }, { status: 400 });
    }
    const built = buildAdvancedDraft(body);
    const id = `aidraft-adv-${++advSeq}-${Date.now()}`;
    const now = new Date().toISOString();
    const record = {
      id,
      reportId: built.reportId,
      draftText: serialize(built.sections),
      sections: built.sections,
      style: 'standard',
      status: 'PENDING',
      confidence: built.confidenceScore,
      modelVersion: built.modelVersion,
      provider: built.provider,
      confidenceScore: built.confidenceScore,
      sources: built.sources,
      ragUsed: built.ragUsed,
      fallbackToMock: built.fallbackToMock,
      createdAt: now,
      updatedAt: now,
    };
    create(DRAFT_STORE, record);
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  http.post(`${API_BASE}/ai-draft/generate-structured`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as any;
    if (!body?.reportId) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'reportId is required' } }, { status: 400 });
    }
    const reportId = String(body.reportId);
    const report = findReport(reportId);
    if (!report) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Report ${reportId} not found` } }, { status: 404 });
    }
    const bodyPart = report.bodyPart ?? '胸部';
    const sections: Section[] = [
      { heading: '现病史', content: `患者因临床需要行${bodyPart}影像检查，具体病史待补充。` },
      { heading: '检查所见', content: report.findings || `${bodyPart}未见明确异常。` },
      { heading: '诊断意见', content: report.impression || '未见明确异常，建议定期随访。' },
    ];
    const now = new Date().toISOString();
    const record = {
      id: `aidraft-struct-${++advSeq}-${Date.now()}`,
      reportId,
      draftText: serialize(sections),
      sections,
      style: 'standard',
      status: 'PENDING',
      confidence: 0.88,
      modelVersion: 'mock-nlg-1.0',
      provider: 'mock',
      confidenceScore: 0.88,
      createdAt: now,
      updatedAt: now,
    };
    create(DRAFT_STORE, record);
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),
];

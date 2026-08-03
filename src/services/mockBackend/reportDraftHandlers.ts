/**
 * G005 放射RIS系统 v3.0.6.11-61 — 环境式 AI 报告草稿 MSW Handlers
 * POST /ai/report-draft           生成 (确定性模板草稿)
 * POST /ai/report-draft/:id/accept  医生接受 → 落 reports 表
 * POST /ai/report-draft/:id/modify  医生修改后保存
 * GET  /ai/report-draft/:reportId   按报告查草稿
 */
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update } from './store';

const DRAFT_STORE = 'ai_report_drafts' as const;

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1';

interface Section { heading: string; content: string }

interface DraftTemplate {
  key: string; modality: string; bodyPart: string; technique: string;
  findings: string[]; conclusions: string[]; recommendation: string;
}

const TEMPLATES: DraftTemplate[] = [
  {
    key: 'ct-head', modality: 'CT', bodyPart: '头颅',
    technique: '头颅CT平扫',
    findings: ['双侧大脑半球对称，脑实质内未见明显异常密度影，灰白质分界清晰。', '脑室、脑池及脑沟形态、大小正常，中线结构居中。', '颅骨骨质结构完整，未见明显异常。'],
    conclusions: ['头颅CT平扫未见明显异常。', '建议结合临床随访观察。'],
    recommendation: '如症状持续或加重，建议复查头颅CT或进一步行头颅MRI检查。',
  },
  {
    key: 'ct-chest', modality: 'CT', bodyPart: '胸部',
    technique: '胸部CT平扫',
    findings: ['双肺纹理清晰，走行自然，肺野透亮度正常，未见明显异常密度影。', '气管及双侧主支气管通畅，管壁未见明显增厚。', '双侧肺门及纵隔未见明显肿大淋巴结影。', '心脏及大血管形态未见明显异常，胸腔未见积液。'],
    conclusions: ['胸部CT平扫未见明显异常。', '所见符合正常胸部CT表现。'],
    recommendation: '建议每 1-2 年常规体检复查胸部CT。',
  },
  {
    key: 'ct-abdomen', modality: 'CT', bodyPart: '腹部',
    technique: '腹部CT平扫',
    findings: ['肝脏大小、形态正常，实质密度均匀，未见明显占位性病变。', '胆囊不大，壁不厚，囊内未见明显异常；胰腺大小形态正常。', '脾脏、双肾大小形态正常，未见明显结石及占位。', '腹腔及腹膜后未见明显肿大淋巴结，腹腔未见积液。'],
    conclusions: ['腹部CT平扫未见明显异常。', '所见符合正常腹部CT表现。'],
    recommendation: '建议结合临床症状及实验室检查综合评估。',
  },
  {
    key: 'mr-head', modality: 'MR', bodyPart: '头颅',
    technique: '头颅MRI平扫 (T1WI/T2WI/FLAIR/DWI)',
    findings: ['双侧大脑半球对称，脑灰白质信号正常，未见明显异常信号影。', '脑室、脑池、脑沟形态及信号未见明显异常，中线结构居中。', 'DWI未见明显弥散受限，MRA未见明显血管异常。'],
    conclusions: ['头颅MRI平扫未见明显异常。', '所见符合正常头颅MRI表现。'],
    recommendation: '如有新发神经症状，建议复查并咨询神经内科。',
  },
  {
    key: 'mr-spine', modality: 'MR', bodyPart: '脊柱',
    technique: '脊柱MRI平扫 (矢状位T1WI/T2WI)',
    findings: ['各椎体形态、信号未见明显异常，椎间隙无明显变窄。', '脊髓走行连续，信号均匀，未见明显占位及受压改变。', '椎间盘信号正常，硬膜囊及神经根未见明显受压。'],
    conclusions: ['脊柱MRI平扫未见明显异常。', '所见符合正常脊柱MRI表现。'],
    recommendation: '建议结合临床体征随访观察。',
  },
  {
    key: 'dr-chest', modality: 'DR', bodyPart: '胸部',
    technique: '胸部正位片',
    findings: ['双肺野透亮度正常，肺纹理清晰，未见明显实变、结节及肿块影。', '心影大小、形态正常，主动脉未见明显增宽。', '双侧肋膈角锐利，膈面光滑，胸廓骨质结构完整。'],
    conclusions: ['胸部X线片未见明显异常。', '所见符合正常胸部X线表现。'],
    recommendation: '建议定期健康体检。',
  },
  {
    key: 'dr-limb', modality: 'DR', bodyPart: '四肢',
    technique: '四肢正侧位片',
    findings: ['骨皮质连续完整，骨小梁结构清晰，未见明显骨折线及骨质破坏。', '关节面光滑，关节间隙未见明显变窄，未见脱位及半脱位征象。', '周围软组织未见明显肿胀及异常钙化影。'],
    conclusions: ['四肢X线片未见明显骨折及脱位。', '所见符合正常X线表现。'],
    recommendation: '如局部持续疼痛，建议休息并复查。',
  },
  {
    key: 'us-abdomen', modality: 'US', bodyPart: '腹部',
    technique: '腹部超声 (肝胆胰脾)',
    findings: ['肝脏大小、形态正常，实质回声均匀，肝内血管走行清晰，未见明显占位。', '胆囊大小正常，壁不厚，囊内透声好，未见明显结石及息肉。', '胰腺大小、形态及回声未见明显异常。', '脾脏大小正常，双肾大小形态正常，实质回声未见明显异常。'],
    conclusions: ['腹部超声未见明显异常。', '所见符合正常腹部超声表现。'],
    recommendation: '建议定期复查，注意饮食与生活规律。',
  },
  {
    key: 'us-breast', modality: 'US', bodyPart: '乳腺',
    technique: '乳腺超声检查 (双乳+腋窝)',
    findings: ['双侧乳腺腺体结构清晰，未见明显占位性病变。', '双侧乳腺导管未见明显扩张，未见异常血流信号。', '双侧腋窝未见明显肿大淋巴结。'],
    conclusions: ['双侧乳腺超声未见明显异常 (BI-RADS 1类)。', '所见符合正常乳腺超声表现。'],
    recommendation: '建议定期乳腺超声筛查，结合临床触诊。',
  },
  {
    key: 'us-thyroid', modality: 'US', bodyPart: '甲状腺',
    technique: '甲状腺超声检查',
    findings: ['甲状腺大小、形态正常，包膜完整，实质回声均匀。', '双侧叶内未见明显结节及囊性占位，未见明显异常血流信号。', '颈部未见明显肿大淋巴结。'],
    conclusions: ['甲状腺超声未见明显异常 (TI-RADS 1类)。', '所见符合正常甲状腺超声表现。'],
    recommendation: '建议定期复查，并检查甲状腺功能。',
  },
];

const FALLBACK: DraftTemplate = TEMPLATES[1] ?? {
  key: 'ct-chest', modality: 'CT', bodyPart: '胸部',
  technique: '胸部CT平扫',
  findings: ['双肺纹理清晰，肺野透亮度正常，未见明显异常密度影。'],
  conclusions: ['胸部CT平扫未见明显异常。'],
  recommendation: '建议定期健康体检。',
};

function findTemplate(modality: string, bodyPart: string): DraftTemplate {
  const mod = (modality || '').toUpperCase();
  const part = (bodyPart || '').trim();
  return (
    TEMPLATES.find((t) => t.modality === mod && part && (t.bodyPart === part || part.includes(t.bodyPart) || t.bodyPart.includes(part))) ??
    TEMPLATES.find((t) => t.modality === mod) ??
    FALLBACK
  );
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[。；;])/).map((s) => s.trim()).filter(Boolean);
}

function trimParagraph(text: string, style: string): string {
  if (style === 'concise') {
    const first = splitSentences(text)[0] ?? text;
    return first.endsWith('。') ? first : `${first}。`;
  }
  return text;
}

const DETAILED_ADDON = '本次检查各序列图像质量良好，可满足诊断要求，建议结合临床病史综合评估。';

function buildDraftSections(body: {
  modality: string; bodyPart: string; clinicalInfo?: string; findings?: string; keywords?: string[]; style?: string;
}): Section[] {
  const style = body.style ?? 'standard';
  const tpl = findTemplate(body.modality, body.bodyPart);
  const findingsKeywords = (body.findings ?? '').trim();
  const keywords = (body.keywords ?? []).filter(Boolean);

  const sections: Section[] = [{ heading: '检查技术', content: tpl.technique }];
  if (body.clinicalInfo?.trim()) {
    sections.push({ heading: '临床信息', content: body.clinicalInfo.trim() });
  }
  const findings: string[] = [];
  if (findingsKeywords || keywords.length) {
    const kwText = findingsKeywords || keywords.join('、');
    findings.push(`${tpl.bodyPart}检查显示${kwText}${kwText.endsWith('。') ? '' : '。'}`);
  }
  for (const para of tpl.findings) findings.push(trimParagraph(para, style));
  if (style === 'detailed') findings.push(DETAILED_ADDON);
  sections.push({ heading: '影像所见', content: findings.join('\n') });

  const conclusions = (style === 'concise' ? tpl.conclusions.slice(0, 1) : tpl.conclusions).slice();
  sections.push({ heading: '影像诊断', content: conclusions.map((c, i) => `${i + 1}. ${c}`).join('\n') });
  sections.push({ heading: '建议', content: style === 'concise' ? '定期随访。' : tpl.recommendation });
  return sections;
}

function serialize(sections: Section[]): string {
  return sections.map((s) => `【${s.heading}】\n${s.content}`).join('\n\n');
}

interface DraftRecord {
  id: string;
  reportId: string;
  draftText: string;
  sections: Section[];
  style: string;
  status: 'PENDING' | 'ACCEPTED' | 'MODIFIED';
  confidence: number;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
}

let draftSeq = 0;

function toDraftRecord(row: any): DraftRecord {
  return {
    id: row.id,
    reportId: row.reportId,
    draftText: row.draftText,
    sections: row.sections,
    style: row.style,
    status: row.status,
    confidence: 0.9,
    modelVersion: 'deepseek-v3.0',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const reportDraftHandlers = [
  http.post(`${API_BASE}/ai/report-draft`, async ({ request }) => {
    await delay(900);
    const body = (await request.json()) as any;
    const sections = buildDraftSections(body);
    const id = `aidraft-${++draftSeq}-${Date.now()}`;
    const now = new Date().toISOString();
    const record: DraftRecord = {
      id,
      reportId: body.reportId,
      draftText: serialize(sections),
      sections,
      style: body.style ?? 'standard',
      status: 'PENDING',
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: now,
      updatedAt: now,
    };
    create(DRAFT_STORE, record);
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  http.get(`${API_BASE}/ai/report-draft/:reportId`, async ({ params }) => {
    await delay(200);
    const reportId = params.reportId as string;
    const rows = list<any>(DRAFT_STORE)
      .filter((d: any) => d.reportId === reportId)
      .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (rows.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: toDraftRecord(rows[0]) });
  }),

  http.post(`${API_BASE}/ai/report-draft/:id/accept`, async ({ params }) => {
    await delay(300);
    const id = params.id as string;
    const before = get<any>(DRAFT_STORE, id);
    if (!before) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 });
    }
    if (before.status === 'ACCEPTED') {
      return HttpResponse.json({ success: false, error: { code: 'INVALID_STATUS', message: 'Draft already accepted' } }, { status: 400 });
    }
    // 落 reports 表 (若报告存在则更新所见/诊断/建议)
    const exam = get<any>('exams', before.reportId);
    if (exam) {
      const find = (h: string) => before.sections.find((s: Section) => s.heading === h)?.content ?? '';
      update<any>('exams', before.reportId, {
        findings: find('影像所见'),
        impression: find('影像诊断'),
        recommendations: find('建议'),
        conclusion: find('影像诊断'),
      });
    }
    const updated = update<any>(DRAFT_STORE, id, {
      status: 'ACCEPTED',
      updatedAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: toDraftRecord(updated) });
  }),

  http.post(`${API_BASE}/ai/report-draft/:id/modify`, async ({ params, request }) => {
    await delay(300);
    const id = params.id as string;
    const body = (await request.json()) as { draftText: string };
    const before = get<any>(DRAFT_STORE, id);
    if (!before) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 });
    }
    if (!body.draftText?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'draftText is required' } }, { status: 400 });
    }
    const updated = update<any>(DRAFT_STORE, id, {
      draftText: body.draftText,
      status: 'MODIFIED',
      updatedAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: toDraftRecord(updated) });
  }),
];

// [Phase 2] /api/v1/search MSW handlers — 企业级跨模态全局搜索
import { http, HttpResponse, delay } from 'msw';
import { list } from './store';

const API = '/api/v1/search';

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min);

function buildIndex() {
  const patients = (list<any>('patients') || []).slice(0, 300);
  const exams = (list<any>('exams') || []).slice(0, 800);
  return { patients, exams };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(field: string, q: string): string {
  if (!field || !q) return field || '';
  const escaped = escapeRegex(q);
  return field.replace(new RegExp(`(${escaped})`, 'gi'), '⟪$1⟫');
}

function buildResults(q: string, typeFilter?: string) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const { patients, exams } = buildIndex();
  const results: any[] = [];
  const seen = new Set<string>();

  if (!typeFilter || typeFilter === 'patient' || typeFilter === 'all') {
    for (const p of patients) {
      if (results.length >= 200) break;
      const hay = `${p.id} ${p.name} ${p.phone || ''} ${p.idCard || ''}`.toLowerCase();
      if (!hay.includes(query)) continue;
      const key = `p-${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: key,
        type: 'patient',
        title: highlight(p.name, q.trim()),
        subtitle: `${p.gender || '-'} ${p.age ?? '-'}岁 · ${p.id}`,
        description: `登记时间：${p.registeredAt || '-'} · 就诊科室：${p.referringDepartment || '-'}`,
        score: 95 + Math.floor(Math.random() * 5),
        matchedFields: ['patientName', 'patientId'],
        metadata: { patientId: p.id, phone: p.phone, examItem: p.examItem },
        createdAt: p.registeredAt || new Date().toISOString(),
        updatedAt: p.registeredAt || new Date().toISOString(),
      });
    }
  }

  if (!typeFilter || typeFilter === 'exam' || typeFilter === 'all') {
    for (const e of exams) {
      if (results.length >= 200) break;
      const hay = `${e.patientName || ''} ${e.examItem || ''} ${e.examItemName || ''} ${e.reportId || e.id || ''} ${e.modality || ''} ${e.bodyPart || ''} ${e.patientId || ''}`.toLowerCase();
      if (!hay.includes(query)) continue;
      const key = `e-${e.id || e.reportId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: key,
        type: 'exam',
        title: highlight(`${e.examItem || e.examItemName || '影像检查'}`, q.trim()),
        subtitle: `${e.patientName || '-'} · ${e.modality || '-'} · ${e.bodyPart || '-'}`,
        description: `检查日期：${e.examAt || e.examDate || '-'} · 状态：${e.status || '-'}`,
        score: 88 + Math.floor(Math.random() * 10),
        matchedFields: ['examItem', 'patientName'],
        metadata: { examId: e.id || e.reportId, patientId: e.patientId, modality: e.modality },
        createdAt: e.examAt || new Date().toISOString(),
        updatedAt: e.examAt || new Date().toISOString(),
      });
    }
  }

  if (!typeFilter || typeFilter === 'report' || typeFilter === 'all') {
    for (const e of exams) {
      if (results.length >= 200) break;
      const hay = `${e.findings || ''} ${e.impression || ''} ${e.patientName || ''} ${e.reportId || e.id || ''}`.toLowerCase();
      if (!hay.includes(query)) continue;
      const key = `r-${e.reportId || e.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: key,
        type: 'report',
        title: highlight(`报告 ${e.reportId || e.id}`, q.trim()),
        subtitle: `${e.patientName || '-'} · ${e.modality || '-'} · ${e.bodyPart || '-'}`,
        description: `所见：${highlight(e.findings || '—', q.trim()).slice(0, 120)}`,
        score: 82 + Math.floor(Math.random() * 15),
        matchedFields: ['findings', 'impression'],
        metadata: { reportId: e.reportId || e.id, patientId: e.patientId },
        createdAt: e.signedAt || e.reportAt || new Date().toISOString(),
        updatedAt: e.signedAt || e.reportAt || new Date().toISOString(),
      });
    }
  }

  return results.sort((a, b) => (b.score || 0) - (a.score || 0));
}

export const searchHandlers = [
  // 全局搜索 (searchClient 使用)
  http.get(`${API}`, async ({ request }) => {
    await delay(delayMs(80, 200));
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const type = url.searchParams.get('type') || '';
    const page = parseInt(url.searchParams.get('page') || '1') || 1;
    const pageSize = Math.min(50, parseInt(url.searchParams.get('pageSize') || '20') || 20);
    const all = buildResults(q, type);
    const start = (page - 1) * pageSize;
    const suggestions = q
      ? [`${q} CT`, `${q} MRI`, `${q} 增强`, `${q} 复查`].slice(0, 4)
      : [];
    const typeCounts: Record<string, number> = {};
    for (const r of all) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    return HttpResponse.json({
      success: true,
      data: {
        results: all.slice(start, start + pageSize),
        total: all.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(all.length / pageSize)),
        tookMs: 20 + Math.floor(Math.random() * 60),
        suggestions,
        facets: Object.entries(typeCounts).map(([value, count]) => ({
          field: 'type',
          label: value === 'patient' ? '患者' : value === 'exam' ? '检查' : value === 'report' ? '报告' : value,
          values: [{ value, count, selected: type === value }],
        })),
      },
    });
  }),

  http.get(`${API}/suggest`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const prefix = url.searchParams.get('q') || '';
    const pool = ['胸部 CT', '颅脑 MRI', '腹部彩超', '乳腺钼靶', '冠脉 CTA', '肺部结节', '主动脉夹层', '膝关节 DR'];
    return HttpResponse.json({
      success: true,
      data: prefix ? pool.filter(s => s.includes(prefix)).slice(0, 5) : pool.slice(0, 5),
    });
  }),
];

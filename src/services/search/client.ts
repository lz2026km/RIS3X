import {
  reportSearchV2Api,
  type SearchCondition,
  type SearchHit,
  type SearchResult,
} from '../api/reportSearchV2Api';
import type { SearchResponse, SearchResultItem } from './types';

// 后端没有 `search` 控制器 (原 /search* 仅存在于 MSW demo handlers), 真实端点为 report-search-v2:
//   POST /report-search-v2/search | GET /report-search-v2/meta | GET /report-search-v2/stats
// 下面 4 个方法全部改走真实端点, 并把 SearchHit DTO 映射成 SearchResponse / SearchResultItem。

type SearchOptions = {
  type?: string;
  page?: number;
  pageSize?: number;
  filters?: Record<string, string[]>;
};

const EMPTY_RESPONSE: SearchResponse = {
  results: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  tookMs: 0,
};

const HL_OPEN = '\u27EA';
const HL_CLOSE = '\u27EB';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILTER_KEYS = ['modality', 'doctor', 'organization', 'diagnosisKeyword'] as const;

/** 把后端 snippets[].ranges 渲染为页面使用的 \u27EA...\u27EB 高亮标记 */
function markRanges(text: string, ranges: Array<{ start: number; end: number }> | undefined): string {
  if (!text || !ranges || ranges.length === 0) return text;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const range of sorted) {
    const start = Math.max(cursor, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (end <= start) continue;
    out += text.slice(cursor, start) + HL_OPEN + text.slice(start, end) + HL_CLOSE;
    cursor = end;
  }
  return out + text.slice(cursor);
}

/** SearchHit (报告语料) → SearchResultItem (页面渲染模型); 后端语料只有报告, 故 type 固定 report */
function toResultItem(hit: SearchHit): SearchResultItem {
  const snippets = hit.snippets ?? [];
  const snippet = snippets[0];
  const fields = [...new Set(snippets.map((s) => s.field))];
  return {
    id: hit.reportId,
    type: 'report',
    title: `${hit.patientName} \u00B7 ${hit.modality} ${hit.bodyPart}`,
    subtitle: `${hit.examDate} \u00B7 ${hit.doctorName} \u00B7 ${hit.organization}`,
    description: snippet ? markRanges(snippet.text, snippet.ranges) : hit.conclusion,
    score: hit.relevance,
    matchedFields: fields.length > 0 ? fields : hit.matchedKeywords ?? [],
    metadata: {
      reportId: hit.reportId,
      patientId: hit.patientId,
      modality: hit.modality,
      bodyPart: hit.bodyPart,
      doctorName: hit.doctorName,
      organization: hit.organization,
      isCritical: hit.isCritical,
    },
    createdAt: hit.examDate,
    updatedAt: hit.examDate,
  };
}

/** 后端无分页参数 → 结果全量返回后在前端切页 */
function toSearchResponse(result: SearchResult, options: SearchOptions | undefined, tookMs: number): SearchResponse {
  let list = (result.items ?? []).map(toResultItem);
  const requestedType = options?.type;
  if (requestedType && requestedType !== 'all') {
    list = list.filter((item) => item.type === requestedType);
  }
  const pageSize = Math.max(1, options?.pageSize ?? 20);
  const page = Math.max(1, options?.page ?? 1);
  const start = (page - 1) * pageSize;
  return {
    results: list.slice(start, start + pageSize),
    total: list.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(list.length / pageSize)),
    tookMs,
  };
}

function toConditions(query: string, options?: SearchOptions): SearchCondition {
  const conditions: SearchCondition = { keyword: query };
  const filters = options?.filters;
  if (filters) {
    for (const key of FILTER_KEYS) {
      const value = filters[key]?.[0];
      if (value) conditions[key] = value;
    }
    const dateFrom = filters.dateFrom?.[0];
    if (dateFrom && DATE_RE.test(dateFrom)) conditions.dateFrom = dateFrom;
    const dateTo = filters.dateTo?.[0];
    if (dateTo && DATE_RE.test(dateTo)) conditions.dateTo = dateTo;
  }
  return conditions;
}

export const searchClient = {
  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const started = Date.now();
    const res = await reportSearchV2Api.search(toConditions(query, options));
    if (!res.success || !res.data) return { ...EMPTY_RESPONSE, tookMs: Date.now() - started };
    return toSearchResponse(res.data, options, Date.now() - started);
  },

  async suggest(prefix: string): Promise<string[]> {
    const res = await reportSearchV2Api.getMeta();
    if (!res.success) return [];
    const needle = (prefix ?? '').trim().toLowerCase();
    const keywords = res.data?.keywords ?? [];
    return keywords.filter((keyword) => String(keyword).toLowerCase().includes(needle)).slice(0, 8);
  },

  async getById(id: string, type: string): Promise<SearchResultItem | null> {
    const res = await reportSearchV2Api.search({ keyword: id });
    if (!res.success || !res.data) return null;
    const hit = (res.data.items ?? []).find((item) => item.reportId === id || item.patientId === id);
    if (!hit) return null;
    const result = toResultItem(hit);
    if (type && type !== 'all' && result.type !== type) return null;
    return result;
  },

  async exportCsv(query: string): Promise<Blob> {
    const res = await reportSearchV2Api.search({ keyword: query });
    const items = res.success && res.data ? res.data.items ?? [] : [];
    const header = [
      'reportId',
      'patientId',
      'patientName',
      'examDate',
      'modality',
      'bodyPart',
      'doctorName',
      'organization',
      'conclusion',
      'isCritical',
      'relevance',
    ];
    const escape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = items.map((hit) =>
      header.map((key) => escape((hit as unknown as Record<string, unknown>)[key])).join(','),
    );
    const csv = ['\uFEFF' + header.join(','), ...rows].join('\r\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
  },
};

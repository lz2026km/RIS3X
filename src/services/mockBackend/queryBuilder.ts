// [v3.0.6.8-32] Query Builder - 分页/排序/搜索/过滤
// 解析 URL query params, 应用于数据数组
export interface QueryOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  // 任意过滤字段 (e.g. ?modality=CT&status=已签发)
  filters?: Record<string, string>;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

export function parseQuery(url: URL | string): QueryOptions {
  const u = typeof url === 'string' ? new URL(url, 'http://localhost') : url;
  const opts: QueryOptions = {};
  const page = parseInt(u.searchParams.get('page') || '1');
  const pageSize = parseInt(u.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE));
  opts.page = isNaN(page) ? 1 : Math.max(1, page);
  opts.pageSize = isNaN(pageSize) ? DEFAULT_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
  const sortBy = u.searchParams.get('sortBy');
  if (sortBy) opts.sortBy = sortBy;
  const sortDir = u.searchParams.get('sortDir');
  if (sortDir === 'asc' || sortDir === 'desc') opts.sortDir = sortDir;
  const search = u.searchParams.get('search') || u.searchParams.get('q');
  if (search) opts.search = search;
  opts.filters = {};
  for (const [key, value] of u.searchParams.entries()) {
    // [v3.0.6.11-70] take/skip/state 由 handlers 消费, 不作为数据过滤条件
    if (['page', 'pageSize', 'sortBy', 'sortDir', 'search', 'q', 'take', 'skip', 'state'].includes(key)) continue;
    if (value) opts.filters[key] = value;
  }
  return opts;
}

export function applyQuery<T extends Record<string, any>>(
  data: T[],
  opts: QueryOptions,
  searchFields: (keyof T)[] = [],
): QueryResult<T> {
  let result = [...data];

  // 过滤
  if (opts.filters && Object.keys(opts.filters).length > 0) {
    result = result.filter(item => {
      for (const [key, value] of Object.entries(opts.filters!)) {
        if (value === '') continue;
        const itemValue = item[key];
        if (itemValue === undefined || itemValue === null) return false;
        // 支持多值 (逗号分隔) - 任一匹配
        const values = value.split(',').map(v => v.trim());
        if (!values.some(v => String(itemValue) === v || String(itemValue).includes(v))) {
          return false;
        }
      }
      return true;
    });
  }

  // 搜索 (跨字段)
  if (opts.search && searchFields.length > 0) {
    const q = opts.search.toLowerCase();
    result = result.filter(item => {
      return searchFields.some(field => {
        const val = item[field];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }

  const total = result.length;

  // 排序
  if (opts.sortBy) {
    const sortBy = opts.sortBy;
    const dir = opts.sortDir === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  // 分页
  const page = opts.page || 1;
  const pageSize = opts.pageSize || DEFAULT_PAGE_SIZE;
  const start = (page - 1) * pageSize;
  const paged = result.slice(start, start + pageSize);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// 聚合辅助 - 按字段分组
export function groupBy<T>(data: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of data) {
    const k = keyFn(item);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

// 按字段求和
export function sumBy<T>(data: T[], keyFn: (item: T) => number): number {
  return data.reduce((s, item) => s + keyFn(item), 0);
}

// 按字段平均
export function avgBy<T>(data: T[], keyFn: (item: T) => number): number {
  if (data.length === 0) return 0;
  return sumBy(data, keyFn) / data.length;
}

// 时间范围过滤
export function filterByDateRange<T extends Record<string, any>>(
  data: T[],
  dateField: keyof T,
  startDate?: string,
  endDate?: string,
): T[] {
  if (!startDate && !endDate) return data;
  return data.filter(item => {
    const date = item[dateField];
    if (!date) return false;
    const dateStr = String(date).slice(0, 10); // YYYY-MM-DD
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  });
}

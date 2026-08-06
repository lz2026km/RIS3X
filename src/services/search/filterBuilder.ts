export interface FilterCondition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between';
  value: string | number | string[];
}

export interface FilterGroup {
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
}

export function buildFilterString(group: FilterGroup): string {
  const parts = group.conditions.map(c => {
    switch (c.operator) {
      case 'eq': return `${c.field}:${c.value}`;
      case 'neq': return `-${c.field}:${c.value}`;
      case 'contains': return `${c.field}:*${c.value}*`;
      case 'gt': return `${c.field}:>${c.value}`;
      case 'gte': return `${c.field}:>=${c.value}`;
      case 'lt': return `${c.field}:<${c.value}`;
      case 'lte': return `${c.field}:<=${c.value}`;
      case 'in': return `${c.field}:(${(c.value as string[]).join(' OR ')})`;
      case 'between': return `${c.field}:[${c.value}]`;
    }
  });
  const joiner = group.logic === 'AND' ? ' AND ' : ' OR ';
  return parts.length > 1 ? `(${parts.join(joiner)})` : parts[0];
}

export function parseFilterString(_filterStr: string): FilterGroup {
  return { logic: 'AND', conditions: [] };
}

export function isFilterActive(filters: Record<string, string[]>): boolean {
  return Object.values(filters).some(v => v.length > 0);
}

export function countActiveFilters(filters: Record<string, string[]>): number {
  return Object.values(filters).reduce((sum, v) => sum + v.length, 0);
}

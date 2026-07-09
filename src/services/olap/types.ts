export interface MetricDefinition {
  name: string
  id: string
  dimension: string
  aggregation: 'sum' | 'avg' | 'count' | 'distinctCount' | 'min' | 'max'
  format: 'number' | 'percent' | 'currency' | 'duration' | 'decimal'
  unit?: string
  description: string
}

export interface HierarchyLevel {
  name: string
  column: string
}

export interface DimensionDefinition {
  name: string
  id: string
  type: 'date' | 'categorical' | 'numeric'
  hierarchies?: HierarchyLevel[][]
  description: string
}

export interface OLAPFilter {
  dimension: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'between' | 'like'
  value: string | number | (string | number)[]
}

export interface OLAPQuery {
  dimensions: string[]
  measures: string[]
  filters?: OLAPFilter[]
  granularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  orderBy?: { dimension: string; direction: 'asc' | 'desc' }[]
  limit?: number
  offset?: number
}

export interface QueryResultColumn {
  key: string
  name: string
  type: 'dimension' | 'measure'
}

export interface QueryResult {
  columns: QueryResultColumn[]
  rows: Record<string, unknown>[]
  total: number
  summary?: Record<string, number>
  generatedAt: string
  query: OLAPQuery
}

export interface MetadataResponse {
  metrics: MetricDefinition[]
  dimensions: DimensionDefinition[]
}

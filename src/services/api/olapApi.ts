import { api } from './client'

// [G005 Wave1B P1] OLAP API — query/metadata 真实; cubes/drill-down/chart/export/csv 已补
// (olap.controller, 预定义 cube + 查询派生), MSW 标注已更新。
export interface OlapCubeDto { id: string; name: string; dimensions: string[]; measures: string[]; lastUpdated: string }
export interface OlapQueryDto { cube: string; measures: string[]; dimensions: string[]; filters?: Array<{ dimension: string; operator: string; value: unknown }>; orderBy?: string; limit?: number; offset?: number }
export interface OlapQueryResult { columns: Array<{ code: string; name: string; type: string }>; rows: Record<string, unknown>[]; total: number }
export interface OlapDrillDownDto { cube: string; dimension: string; value: string; measures: string[] }
export interface OlapChartDataDto { labels: string[]; datasets: Array<{ label: string; values: number[]; type?: string }> }

export const olapApi = {
  listCubes: () => api.get<OlapCubeDto[]>('/olap/cubes'),
  query: (dto: OlapQueryDto) => api.post<OlapQueryResult>('/olap/query', dto),
  drillDown: (dto: OlapDrillDownDto) => api.post<OlapQueryResult>('/olap/drill-down', dto),
  getChartData: (dto: OlapQueryDto) => api.post<OlapChartDataDto>('/olap/chart', dto),
  getMetadata: () => api.get<{ cubes: OlapCubeDto[] }>('/olap/metadata'),
  exportCsv: (dto: OlapQueryDto) => api.post<Blob>('/olap/export/csv', dto, { responseType: 'blob' }),
}

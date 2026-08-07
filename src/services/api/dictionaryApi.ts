// [W4-A v3.0.6.11-79] 数据字典 API: 分类列表 + 分类条目 CRUD
import { api, invalidateApiCacheByPrefix } from './client'

export interface DictEntryDto {
  id: string
  category: string
  key: string
  value: string
  sort: number
  active: boolean
  extra: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface DictCategoryDto {
  category: string
  count: number
  activeCount: number
}

export interface DictEntryInput {
  key: string
  value: string
  sort?: number
  active?: boolean
  extra?: Record<string, unknown>
}

export const dictionaryApi = {
  listCategories: () =>
    api.get<{ categories: DictCategoryDto[]; total: number }>('/dictionary/categories'),

  listEntries: (category: string) =>
    api.get<DictEntryDto[]>(`/dictionary/${encodeURIComponent(category)}`),

  createEntry: async (category: string, data: DictEntryInput) => {
    const res = await api.post<DictEntryDto>(
      `/dictionary/${encodeURIComponent(category)}`,
      data,
    )
    await invalidateApiCacheByPrefix('/dictionary')
    return res
  },

  updateEntry: async (
    category: string,
    key: string,
    data: Partial<DictEntryInput>,
  ) => {
    const res = await api.put<DictEntryDto>(
      `/dictionary/${encodeURIComponent(category)}/${encodeURIComponent(key)}`,
      data,
    )
    await invalidateApiCacheByPrefix('/dictionary')
    return res
  },

  deleteEntry: async (category: string, key: string) => {
    const res = await api.delete<{ success: boolean; deletedKey: string }>(
      `/dictionary/${encodeURIComponent(category)}/${encodeURIComponent(key)}`,
    )
    await invalidateApiCacheByPrefix('/dictionary')
    return res
  },
}

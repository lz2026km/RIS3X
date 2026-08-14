import { api } from './client'

// [v3.0.6.11-98 Wave2B (报告 P1)] 征象库后端化
//   GET /finding-library            分组列表
//   GET /finding-library/search?q=  关键词检索
// 后端 finding-library 模块已实现, MSW 兜底; 失败时 FindingLibraryPage 回退内置 200 条
export interface FindingLibraryItem {
  id: string
  name: string
  description: string
  keywords: string[]
}

export interface FindingLibraryCategory {
  category: string
  items: FindingLibraryItem[]
}

export const findingLibraryApi = {
  list: () =>
    api.get<FindingLibraryCategory[]>('/finding-library'),

  search: (q: string) =>
    api.get<FindingLibraryCategory[]>(`/finding-library/search?q=${encodeURIComponent(q)}`),
}

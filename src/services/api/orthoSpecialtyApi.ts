import { api } from './client'

// [W10-B] 骨科影像分析 (OrthoSpecialtyPage) API
// 后端暂无骨科专项端点, 由 MSW (w10MockFillHandlers) 提供;
// 接口不可用/返回空时页面回退内置演示数据。

export interface OrthoStudy {
  id: string
  name: string
  age: number
  gender: string
  joint: string
  modality: string
  klGrade: string
  oaScore: number
  fracture: boolean
  date: string
}

export const orthoSpecialtyApi = {
  // GET /ortho-specialty/studies
  listStudies: () => api.get<OrthoStudy[]>('/ortho-specialty/studies'),

  // POST /ortho-specialty/studies
  createStudy: (data: Partial<OrthoStudy>) =>
    api.post<OrthoStudy>('/ortho-specialty/studies', data),
}

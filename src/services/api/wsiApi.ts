import { api } from './client'

// [v3.0.6.11-101 Wave 2B] 病理切片 WSI (全切片图像) 浏览与标注
// 后端: backend/src/modules/pathology/ (孤儿模块, 可无 DB 启动, seed 回退)

export interface PathologyLevelMeta {
  level: number
  width: number
  height: number
  tilesX: number
  tilesY: number
  tileSize: number
}

export interface PathologyCaseSummary {
  id: string
  patientId: string
  patientName: string
  specimen: string
  diagnosis: string
  status: 'pending' | 'reviewed' | 'reported'
  reportedAt?: string
  slideCount: number
  accessionNumber: string
}

export interface PathologySlideSummary {
  id: string
  caseId: string
  patientId: string
  patientName: string
  stain: string
  stainLabel: string
  magnification: number
  institution: string
  levels: number
  width: number
  height: number
  tileSize: number
  scannedAt: string
  caseStatus: string
}

export interface PathologySlideDetail extends PathologySlideSummary {
  levelsMeta: PathologyLevelMeta[]
  case: PathologyCaseSummary
}

export type AnnotationKind = 'rect' | 'circle' | 'polygon'

export interface PathologyAnnotation {
  id: string
  slideId: string
  kind: AnnotationKind
  /** level-0 全分辨率坐标系: rect=[x1,y1,x2,y2]; circle=[cx,cy,r]; polygon=[x1,y1,x2,y2,...] */
  points: number[]
  label: string
  category: string
  color: string
  confidence?: number
  level: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateAnnotationDto {
  kind: AnnotationKind
  points: number[]
  label: string
  category?: string
  color?: string
  confidence?: number
  level?: number
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return ''
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

export interface TileFetchResult {
  ok: boolean
  url: string
}

const tileObjectUrls = new Map<string, string>()

export const wsiApi = {
  listSlides: (params?: { patientId?: string; stain?: string }) =>
    api.get<PathologySlideSummary[]>(`/pathology/slides${qs(params)}`),

  getSlide: (slideId: string) =>
    api.get<PathologySlideDetail>(`/pathology/slides/${encodeURIComponent(slideId)}`),

  listCases: () => api.get<PathologyCaseSummary[]>('/pathology/cases'),

  /** 瓦片 → blob object URL (PNG 二进制; 非 image 类型视为失败) */
  getTile: async (slideId: string, level: number, x: number, y: number): Promise<TileFetchResult> => {
    const key = `${slideId}:${level}:${x}:${y}`
    const cached = tileObjectUrls.get(key)
    if (cached) return { ok: true, url: cached }
    const path = `/pathology/slides/${encodeURIComponent(slideId)}/tile/${level}/${x}/${y}`
    const res = await api.getBlob<Blob>(path)
    if (!res.success || !res.data || !res.data.type.startsWith('image/')) {
      return { ok: false, url: '' }
    }
    const url = URL.createObjectURL(res.data)
    tileObjectUrls.set(key, url)
    if (tileObjectUrls.size > 512) {
      const first = tileObjectUrls.keys().next().value
      if (first !== undefined) tileObjectUrls.delete(first)
    }
    return { ok: true, url }
  },

  releaseTile: (slideId: string, level: number, x: number, y: number) => {
    const key = `${slideId}:${level}:${x}:${y}`
    const url = tileObjectUrls.get(key)
    if (url) {
      tileObjectUrls.delete(key)
      URL.revokeObjectURL(url)
    }
  },

  listAnnotations: (slideId: string) =>
    api.get<PathologyAnnotation[]>(`/pathology/slides/${encodeURIComponent(slideId)}/annotations`),

  createAnnotation: (slideId: string, dto: CreateAnnotationDto) =>
    api.post<PathologyAnnotation>(`/pathology/slides/${encodeURIComponent(slideId)}/annotations`, dto),

  updateAnnotation: (id: string, dto: Partial<CreateAnnotationDto>) =>
    api.put<PathologyAnnotation>(`/pathology/annotations/${encodeURIComponent(id)}`, dto),

  deleteAnnotation: (id: string) =>
    api.delete<{ deleted: boolean; id: string }>(`/pathology/annotations/${encodeURIComponent(id)}`),
}

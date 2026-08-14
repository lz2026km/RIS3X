import { api, invalidateApiCacheByPrefix } from './client'
import type { ListData } from './client'

// [v3.0.6.11-99 Wave3B] 随访模板库 (病种/术式/检查类型 → 间隔数组 + 随访项目)
export interface FollowUpTemplate {
  id: string
  name: string
  category: string
  intervals: number[]
  items: string[]
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateFollowUpTemplateDto {
  name: string
  category?: string
  intervals: number[]
  items?: string[]
  active?: boolean
}

export interface UpdateFollowUpTemplateDto extends Partial<CreateFollowUpTemplateDto> {}

export interface ApplyTemplateResult {
  items: Array<{ id: string; patientId: string; patientName: string; planDate: string; nextDate: string; status: string }>
  total: number
  templateId: string
}

const PREFIX = '/followup-templates'

export const followupTemplatesApi = {
  list: () => api.getList<FollowUpTemplate>(PREFIX),

  create: async (dto: CreateFollowUpTemplateDto) => {
    const res = await api.post<FollowUpTemplate>(PREFIX, dto)
    await invalidateApiCacheByPrefix(PREFIX)
    return res
  },

  update: async (id: string, dto: UpdateFollowUpTemplateDto) => {
    const res = await api.patch<FollowUpTemplate>(`${PREFIX}/${id}`, dto)
    await invalidateApiCacheByPrefix(PREFIX)
    return res
  },

  remove: async (id: string) => {
    const res = await api.delete<{ ok: boolean; id: string }>(`${PREFIX}/${id}`)
    await invalidateApiCacheByPrefix(PREFIX)
    return res
  },

  // [v3.0.6.11-99 Wave3B] 应用模板到患者: 按模板间隔批量生成随访计划
  apply: async (
    id: string,
    dto: { patientId: string; patientName: string; planDate: string; reportId?: string; examId?: string; note?: string },
  ) => {
    const res = await api.post<ApplyTemplateResult>(`${PREFIX}/${id}/apply`, dto)
    await invalidateApiCacheByPrefix(PREFIX)
    // 批量生成的随访计划需同时失效列表缓存
    await invalidateApiCacheByPrefix('/followups')
    return res
  },
}

export type FollowUpTemplateListResult = ListData<FollowUpTemplate>

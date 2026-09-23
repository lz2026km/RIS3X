export interface ChargeItemDto {
  id: string
  code: string
  name: string
  modality: 'CT' | 'MRI' | 'DSA' | 'DR' | 'CR' | 'MG' | 'RF'
  category: '检查' | '增强' | '介入' | '造影' | '其他'
  price: number
  insuranceCode?: string
  isActive: boolean
  description?: string
  createdTime: string
  updatedTime: string
}

export interface BulkPriceUpdateDto {
  ids: string[]
  price: number
}

const MOCK_ITEMS: ChargeItemDto[] = [
  { id: 'ci-001', code: 'CT-PLAIN-HEAD', name: 'CT平扫(头颅)', modality: 'CT', category: '检查', price: 450, insuranceCode: '210300001', isActive: true, description: '头颅CT平扫', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-002', code: 'CT-CONTRAST-CHEST', name: 'CT增强(胸部)', modality: 'CT', category: '增强', price: 850, insuranceCode: '210300002', isActive: true, description: '胸部CT增强扫描', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-003', code: 'CT-CCTA', name: '冠脉CTA', modality: 'CT', category: '造影', price: 1500, insuranceCode: '210300003', isActive: true, description: '冠状动脉CT血管成像', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-004', code: 'MR-PLAIN-BRAIN', name: 'MRI平扫(头颅)', modality: 'MRI', category: '检查', price: 780, insuranceCode: '210300004', isActive: true, description: '头颅MRI平扫', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-005', code: 'MR-CONTRAST-ABDOMEN', name: 'MRI增强(腹部)', modality: 'MRI', category: '增强', price: 1200, insuranceCode: '210300005', isActive: true, description: '腹部MRI增强扫描', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-006', code: 'DSA-CORONARY', name: '冠脉造影', modality: 'DSA', category: '介入', price: 8500, insuranceCode: '210300006', isActive: true, description: '冠状动脉造影术', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-007', code: 'DSA-PERIPHERAL', name: '外周血管造影', modality: 'DSA', category: '介入', price: 6800, insuranceCode: '210300007', isActive: true, description: '外周血管造影及介入治疗', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-008', code: 'DR-CHEST', name: '胸部正侧位', modality: 'DR', category: '检查', price: 120, insuranceCode: '210300008', isActive: true, description: '胸部正侧位DR', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-009', code: 'DR-BONE', name: '骨骼X线(单部位)', modality: 'DR', category: '检查', price: 150, insuranceCode: '210300009', isActive: true, description: '单部位骨骼X线检查', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-010', code: 'MG-BREAST', name: '乳腺钼靶(双乳)', modality: 'MG', category: '检查', price: 280, insuranceCode: '210300010', isActive: true, description: '双侧乳腺钼靶摄影', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-011', code: 'CT-LUNG-LOWDOSE', name: 'CT低剂量肺筛查', modality: 'CT', category: '检查', price: 320, insuranceCode: '210300011', isActive: false, description: '低剂量胸部CT肺癌筛查', createdTime: '2025-06-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-012', code: 'MR-FUNCTIONAL', name: 'MR功能成像(fMRI)', modality: 'MRI', category: '检查', price: 980, insuranceCode: '210300012', isActive: true, description: '脑功能磁共振成像', createdTime: '2025-06-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
]

export const chargeItemService = {
  list: async (params?: { modality?: string; isActive?: boolean; search?: string }): Promise<ChargeItemDto[]> => {
    let items = [...MOCK_ITEMS]
    if (params?.modality && params.modality !== 'all') items = items.filter(i => i.modality === params.modality)
    if (params?.isActive !== undefined) items = items.filter(i => i.isActive === params.isActive)
    if (params?.search) {
      const q = params.search.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.insuranceCode?.toLowerCase().includes(q))
    }
    return items
  },

  getById: async (id: string): Promise<ChargeItemDto | undefined> =>
    MOCK_ITEMS.find(i => i.id === id),

  create: async (data: Partial<ChargeItemDto>): Promise<ChargeItemDto> => {
    const newItem: ChargeItemDto = {
      id: `ci-${Date.now()}`,
      code: data.code || '',
      name: data.name || '',
      modality: data.modality || 'CT',
      category: data.category || '检查',
      price: data.price || 0,
      isActive: data.isActive ?? true,
      insuranceCode: data.insuranceCode,
      description: data.description,
      createdTime: new Date().toISOString(),
      updatedTime: new Date().toISOString(),
    }
    return newItem
  },

  update: async (id: string, data: Partial<ChargeItemDto>): Promise<ChargeItemDto | undefined> => {
    const idx = MOCK_ITEMS.findIndex(i => i.id === id)
    if (idx === -1) return undefined
    return { ...MOCK_ITEMS[idx]!, ...data, updatedTime: new Date().toISOString() }
  },

  toggleActive: async (id: string): Promise<ChargeItemDto | undefined> => {
    const idx = MOCK_ITEMS.findIndex(i => i.id === id)
    if (idx === -1) return undefined
    MOCK_ITEMS[idx]!.isActive = !MOCK_ITEMS[idx]!.isActive
    MOCK_ITEMS[idx]!.updatedTime = new Date().toISOString()
    return { ...MOCK_ITEMS[idx]! }
  },

  bulkUpdatePrice: async (dto: BulkPriceUpdateDto): Promise<number> => {
    let count = 0
    for (const item of MOCK_ITEMS) {
      if (dto.ids.includes(item.id)) {
        item.price = dto.price
        item.updatedTime = new Date().toISOString()
        count++
      }
    }
    return count
  },
}

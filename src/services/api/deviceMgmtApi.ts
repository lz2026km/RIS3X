import { api, invalidateApiCacheByPrefix } from './client'

//  Equipment Lifecycle 
export interface EquipmentLifecycle {
  id: string
  name: string
  model: string
  serialNumber: string
  manufacturer: string
  location: string
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED'
  purchaseDate?: string
  installationDate?: string
  warrantyExpiry?: string
  lastMaintenanceDate?: string
  nextMaintenanceDate?: string
  totalCost?: number
  maintenanceCost?: number
}

export interface UpdateEquipmentLifecycleDto {
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED'
  maintenanceDate?: string
  notes?: string
}

//  Device (CRUD) 
export interface DeviceMgmtItem {
  id: string
  code: string
  name: string
  modality: string
  manufacturer?: string
  location?: string
  state?: 'IDLE' | 'IN_USE' | 'MAINTENANCE' | 'BROKEN' | 'OFFLINE'
}

export interface CreateDeviceMgmtDto {
  code: string
  name: string
  modality: string
  manufacturer?: string
  location?: string
}

export interface UpdateDeviceMgmtDto {
  name?: string
  modality?: string
  manufacturer?: string
  location?: string
  state?: 'IDLE' | 'IN_USE' | 'MAINTENANCE' | 'BROKEN' | 'OFFLINE'
}

//  Device Fault 
export interface DeviceFault {
  id: string
  deviceId: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  reportedBy: string
  status: string
  createdAt: string
}

export interface ReportDeviceFaultDto {
  deviceId: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  reportedBy: string
}

//  Material 
export interface Material {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minStock?: number
  createdAt: string
}

export interface AddMaterialDto {
  name: string
  category: string
  quantity: number
  unit: string
  minStock?: number
}

//  Dose Tracking 
export interface DoseRecord {
  id: string
  patientId: string
  deviceId: string
  doseValue: number
  doseUnit: string
  examType: string
  recordedAt: string
}

export interface RecordDoseDto {
  patientId: string
  deviceId: string
  doseValue: number
  doseUnit: string
  examType: string
  recordedAt?: string
}

//  Contrast Agent 
export interface AdverseReaction {
  id: string
  patientId: string
  contrastType: string
  reaction: string
  severity: 'MILD' | 'MODERATE' | 'SEVERE'
  administeredAt: string
  notes?: string
  createdAt: string
}

export interface ReportAdverseReactionDto {
  patientId: string
  contrastType: string
  reaction: string
  severity: 'MILD' | 'MODERATE' | 'SEVERE'
  administeredAt: string
  notes?: string
}

export interface ContrastInventory {
  id: string
  name: string
  quantity: number
  batchNo?: string
  expiryDate?: string
  location?: string
}

export interface UpdateContrastInventoryDto {
  quantity: number
  batchNo?: string
  expiryDate?: string
  location?: string
}

export interface InjectionWorkstation {
  id: string
  name: string
  status: string
  lastCalibration?: string
}

export interface ContrastQuality {
  id: string
  contrastType: string
  batchNo: string
  qualityStatus: string
  expiryDate: string
}

// [W4-B] 设备保养计划
export interface MaintenancePlan {
  id: string
  deviceId: string
  deviceName: string
  maintenanceDate: string
  intervalDays: number
  type: string
  content: string
  estimatedCost: number | null
  assignee: string
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
  nextDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMaintenancePlanDto {
  deviceId: string
  deviceName?: string
  maintenanceDate: string
  intervalDays?: number
  type?: string
  content?: string
  estimatedCost?: number
  assignee?: string
}

export interface UpdateMaintenancePlanDto extends Partial<CreateMaintenancePlanDto> {
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED'
}

//  API Client 
export const deviceMgmtApi = {
  //  Equipment Lifecycle 
  listEquipmentLifecycle: () =>
    api.get<EquipmentLifecycle[]>('/device-mgmt/equipment-lifecycle'),

  getEquipmentLifecycle: (id: string) =>
    api.get<EquipmentLifecycle>(`/device-mgmt/equipment-lifecycle/${id}`),

  updateEquipmentLifecycle: async (id: string, dto: UpdateEquipmentLifecycleDto) => {
    const res = await api.put<EquipmentLifecycle>(`/device-mgmt/equipment-lifecycle/${id}`, dto)
    await invalidateApiCacheByPrefix('/device-mgmt/equipment-lifecycle')
    return res
  },

  //  Devices (devicemgmt controller) 
  listDevices: () =>
    api.get<DeviceMgmtItem[]>('/device-mgmt/devices'),

  getDevice: (id: string) =>
    api.get<DeviceMgmtItem>(`/device-mgmt/devices/${id}`),

  updateDevice: async (id: string, dto: UpdateDeviceMgmtDto) => {
    const res = await api.put<DeviceMgmtItem>(`/device-mgmt/devices/${id}`, dto)
    await invalidateApiCacheByPrefix('/device-mgmt/devices')
    return res
  },

  //  Device Faults 
  listDeviceFaults: () =>
    api.get<DeviceFault[]>('/device-mgmt/faults'),

  reportDeviceFault: async (dto: ReportDeviceFaultDto) => {
    const res = await api.post<DeviceFault>('/device-mgmt/faults', dto)
    await invalidateApiCacheByPrefix('/device-mgmt/faults')
    return res
  },

  //  Materials 
  listMaterials: () =>
    api.get<Material[]>('/device-mgmt/materials'),

  addMaterial: async (dto: AddMaterialDto) => {
    const res = await api.post<Material>('/device-mgmt/materials', dto)
    await invalidateApiCacheByPrefix('/device-mgmt/materials')
    return res
  },

  //  Dose Tracking 
  getDoseTracking: () =>
    api.get<DoseRecord[]>('/device-mgmt/dose-tracking'),

  recordDose: async (dto: RecordDoseDto) => {
    const res = await api.post<DoseRecord>('/device-mgmt/dose-tracking', dto)
    await invalidateApiCacheByPrefix('/device-mgmt/dose-tracking')
    return res
  },

  //  Contrast: Adverse Reactions 
  listAdverseReactions: () =>
    api.get<AdverseReaction[]>('/device-mgmt/contrast/adverse-reactions'),

  reportAdverseReaction: async (dto: ReportAdverseReactionDto) => {
    const res = await api.post<AdverseReaction>('/device-mgmt/contrast/adverse-reactions', dto)
    await invalidateApiCacheByPrefix('/device-mgmt/contrast/adverse-reactions')
    return res
  },

  //  Contrast: Injection Workstation 
  getInjectionWorkstation: () =>
    api.get<InjectionWorkstation>('/device-mgmt/contrast/injection'),

  //  Contrast: Inventory 
  getContrastInventory: () =>
    api.get<ContrastInventory[]>('/device-mgmt/contrast/inventory'),

  updateContrastInventory: async (id: string, dto: UpdateContrastInventoryDto) => {
    const res = await api.put<ContrastInventory>(`/device-mgmt/contrast/inventory/${id}`, dto)
    await invalidateApiCacheByPrefix('/device-mgmt/contrast/inventory')
    return res
  },

  //  Contrast: Quality 
  getContrastQuality: () =>
    api.get<ContrastQuality[]>('/device-mgmt/contrast/quality'),

  //  Device CRUD (device.controller) 
  list: (params?: { skip?: number; take?: number; modality?: string; state?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return api.get<DeviceMgmtItem[]>(`/device-mgmt${query}`)
  },

  getById: (id: string) =>
    api.get<DeviceMgmtItem>(`/device-mgmt/${id}`),

  create: async (dto: CreateDeviceMgmtDto) => {
    const res = await api.post<DeviceMgmtItem>('/device-mgmt', dto)
    await invalidateApiCacheByPrefix('/device-mgmt')
    return res
  },

  patch: async (id: string, dto: UpdateDeviceMgmtDto) => {
    const res = await api.patch<DeviceMgmtItem>(`/device-mgmt/${id}`, dto)
    await invalidateApiCacheByPrefix('/device-mgmt')
    return res
  },

  remove: async (id: string) => {
    const res = await api.delete<null>(`/device-mgmt/${id}`)
    await invalidateApiCacheByPrefix('/device-mgmt')
    return res
  },

  getStats: (id: string) =>
    api.get<any>(`/device-mgmt/${id}/stats`),

  //  [W4-B] 保养计划 CRUD + 到期提醒
  listMaintenancePlans: (params?: { deviceId?: string; status?: string }) => {
    const query = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
    ).toString() : ''
    return api.getList<MaintenancePlan>(`/device-mgmt/maintenance-plans${query}`)
  },

  createMaintenancePlan: async (dto: CreateMaintenancePlanDto) => {
    const res = await api.post<MaintenancePlan>('/device-mgmt/maintenance-plans', dto)
    await invalidateApiCacheByPrefix('/device-mgmt/maintenance-plans')
    return res
  },

  updateMaintenancePlan: async (id: string, dto: UpdateMaintenancePlanDto) => {
    const res = await api.put<MaintenancePlan>(`/device-mgmt/maintenance-plans/${id}`, dto)
    await invalidateApiCacheByPrefix('/device-mgmt/maintenance-plans')
    return res
  },

  deleteMaintenancePlan: async (id: string) => {
    const res = await api.delete<{ ok: boolean; id: string }>(`/device-mgmt/maintenance-plans/${id}`)
    await invalidateApiCacheByPrefix('/device-mgmt/maintenance-plans')
    return res
  },

  maintenanceDue: (days: number = 30) =>
    api.get<{ items: MaintenancePlan[]; total: number; days: number }>(`/device-mgmt/maintenance-due?days=${days}`),
}

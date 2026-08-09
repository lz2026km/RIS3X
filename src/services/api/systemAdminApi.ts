import { api } from './client'

// [G005 Wave1B P1] 系统管理 API — users/roles 后端已实现 (system-admin.module, User 表派生只读);
// configs 走 system-storage.controller (Wave1A 已实现)。MSW 标注已更新。
export interface SystemUserDto {
  id: string
  name: string
  role: string
  dept: string
  status: string
  lastLogin: string
}

export interface SystemRoleDto {
  name: string
  permissions: string[]
  userCount: number
}

export interface SystemConfigDto {
  key: string
  value: string
  desc: string
}

export const systemAdminApi = {
  getUsers: () =>
    api.get<SystemUserDto[]>('/system/admin/users'),

  createUser: (data: { name: string; role: string }) =>
    api.post<SystemUserDto>('/system/admin/users', data),

  deleteUser: (id: string) =>
    api.delete<void>(`/system/admin/users/${id}`),

  getRoles: () =>
    api.get<SystemRoleDto[]>('/system/admin/roles'),

  getConfigs: () =>
    api.get<SystemConfigDto[]>('/system/admin/configs'),

  // [W5] 批量保存系统配置 (PUT /system/admin/configs)
  saveConfigs: (configs: Array<{ key: string; value: unknown }>) =>
    api.put<SystemConfigDto[]>('/system/admin/configs', configs),

  updateConfig: (key: string, value: string) =>
    api.patch<SystemConfigDto>(`/system/admin/configs/${key}`, { value }),
}

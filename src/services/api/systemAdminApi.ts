import { api } from './client'

// [G005 Wave1B P1] 系统管理 API — users/roles 后端已实现 (system-admin.module, User 表派生只读);
// configs 走 system-storage.controller (Wave1A 已实现)。MSW 标注已更新。
// [G005 v3.0.6.11-91 W1-B P1 第12轮] 删除 createUser/deleteUser (指向不存在端点 POST/DELETE /system/admin/users,
// 后端无对应 controller 路由; SystemAdminPage 用户增删已走 userApi.create/delete — 第12轮确认 0 引用)。
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

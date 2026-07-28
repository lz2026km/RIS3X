import { api } from './client'

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

  updateConfig: (key: string, value: string) =>
    api.patch<SystemConfigDto>(`/system/admin/configs/${key}`, { value }),
}

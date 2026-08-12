import { api } from './client'
import type { UserDto, CreateUserDto, UpdateUserDto } from '../../types/dto'

export type { UserDto, CreateUserDto, UpdateUserDto }

export const userApi = {
  list: (skip = 0, take = 20) =>
    api.get<UserDto[]>(`/users?skip=${skip}&take=${take}`),

  getById: (id: string) =>
    api.get<UserDto>(`/users/${id}`),

  create: (data: CreateUserDto) =>
    api.post<UserDto>('/users', data),

  update: (id: string, data: UpdateUserDto) =>
    api.patch<UserDto>(`/users/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/users/${id}`),

  getActivity: (id: string) =>
    api.get<{ recentActions: Array<{ action: string; timestamp: string; details: string }> }>(`/users/${id}/activity`),

  // [G005 Wave2A P1] 重置密码: 后端生成一次性临时密码并返回
  resetPassword: (id: string) =>
    api.post<{ id: string; username: string; temporaryPassword: string }>(`/users/${id}/reset-password`),
}

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
}

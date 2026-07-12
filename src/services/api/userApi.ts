import { api } from './client'

export interface UserDto {
  id: string
  username: string
  fullName: string
  role: 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR'
  department?: string
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateUserDto {
  username: string
  password: string
  fullName: string
  role: 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR'
  department?: string
}

export interface UpdateUserDto {
  fullName?: string
  role?: 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR'
  department?: string
  active?: boolean
}

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

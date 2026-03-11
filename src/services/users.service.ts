import { api } from './api'
import type { Store } from './stores.service'

export enum UserRole {
  ADMIN         = 'Admin',
  OPERATIONS    = 'Operations',
  AREA_MANAGER  = 'Area Manager',
  FRANCHISE     = 'Franchise',
}

export enum UserStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive',
}

export interface User {
  _id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  stores: (string | Store)[]
  createdAt: string
  updatedAt: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: UserRole
  status?: UserStatus
  stores?: string[]
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'password'>>

export interface ChangePasswordPayload {
  newPassword: string
  adminPassword: string
}

export const usersService = {
  getAll:   ()                                        => api.get<User[]>('/users'),
  getOne:   (id: string)                              => api.get<User>(`/users/${id}`),
  create:   (payload: CreateUserPayload)              => api.post<User>('/users', payload),
  update:   (id: string, payload: UpdateUserPayload)  => api.patch<User>(`/users/${id}`, payload),
  changePassword: (id: string, payload: ChangePasswordPayload) =>
                                                         api.put<void>(`/users/${id}/change-password`, payload),
  activate:     (id: string) => api.patch<User>(`/users/${id}/activate`),
  deactivate:   (id: string) => api.patch<User>(`/users/${id}/deactivate`),
  assignStores: (id: string, storeIds: string[]) => api.post<User>(`/users/${id}/stores`, { storeIds }),
  removeStores: (id: string, storeIds: string[]) => api.delete<User>(`/users/${id}/stores`, { storeIds }),
  remove:       (id: string) => api.delete<void>(`/users/${id}`),
}

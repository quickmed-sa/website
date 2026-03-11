import { api } from './api'
import type { Visit } from './visits.service'

export interface ScheduleStore {
  _id: string
  name: string
  city: string
}

export interface Schedule {
  _id: string
  areaManager: { _id: string; name: string } | string
  date: string
  stores: (ScheduleStore | string)[]
  visitIds: (Visit | string)[]
  createdAt: string
  updatedAt: string
}

export interface ScheduleFilters {
  areaManagerId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface PaginatedSchedules {
  data: Schedule[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateSchedulePayload {
  areaManagerId: string
  date: string
  storeIds: string[]
}

export interface UpdateSchedulePayload {
  storeIds: string[]
}

function buildQuery(filters: ScheduleFilters): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const schedulesService = {
  getAll:  (filters: ScheduleFilters = {})                      => api.get<PaginatedSchedules>(`/schedules${buildQuery(filters)}`),
  getOne:  (id: string)                                          => api.get<Schedule>(`/schedules/${id}`),
  create:  (payload: CreateSchedulePayload)                      => api.post<Schedule>('/schedules', payload),
  update:  (id: string, payload: UpdateSchedulePayload)          => api.patch<Schedule>(`/schedules/${id}`, payload),
  remove:  (id: string)                                          => api.delete<void>(`/schedules/${id}`),
}

import { api } from './api'

export enum VisitStatus {
  SCHEDULED  = 'scheduled',
  INCOMPLETE = 'incomplete',
  OVERDUE    = 'overdue',
  COMPLETED  = 'completed',
  CANCELLED  = 'cancelled',
}

export interface PopulatedStore {
  _id: string
  name: string
  city: string
}

export interface PopulatedUser {
  _id: string
  name: string
  email: string
}

export interface Inspection {
  conducted: boolean
  notes?: string
  conductedAt?: string
}

export interface Visit {
  _id: string
  store: PopulatedStore | string
  areaManager: PopulatedUser | string
  visitDate: string
  status: VisitStatus
  inspection?: Inspection
  inspectionId?: Inspection | string
  photo?: string
  draftStage?: number
  draftStep?: number
  createdAt: string
  updatedAt: string
}

export interface VisitFilters {
  page?: number
  limit?: number
  dateFrom?: string
  dateTo?: string
  storeId?: string
  areaManagerId?: string
  inspection?: 'yes' | 'no'
  status?: VisitStatus
}

export interface PaginatedVisits {
  data: Visit[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateVisitPayload {
  store: string
  areaManager?: string
  visitDate: string
  status?: VisitStatus
}

export type UpdateVisitPayload = Partial<CreateVisitPayload> & {
  draftStage?: number
  draftStep?: number
}

function buildQuery(filters: VisitFilters): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const visitsService = {
  getAll:   (filters: VisitFilters = {})                => api.get<PaginatedVisits>(`/visits${buildQuery(filters)}`),
  getOne:   (id: string)                                => api.get<Visit>(`/visits/${id}`),
  create:   (payload: CreateVisitPayload)               => api.post<Visit>('/visits', payload),
  update:   (id: string, payload: UpdateVisitPayload)   => api.patch<Visit>(`/visits/${id}`, payload),
  complete: (id: string)                                => api.patch<Visit>(`/visits/${id}/complete`),
  cancel:   (id: string)                                => api.patch<Visit>(`/visits/${id}/cancel`),
  remove:   (id: string)                                => api.delete<void>(`/visits/${id}`),
}

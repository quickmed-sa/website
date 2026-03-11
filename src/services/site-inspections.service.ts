import { api, apiUpload, apiDownload } from './api'

// ── Enums & section types ─────────────────────────────────────────────────────

export type SiteInspectionStage =
  | 'pending_fo'
  | 'pending_am'
  | 'pending_ops'
  | 'pending_admin'
  | 'approved'
  | 'rejected'

export type SISection = Record<string, number | undefined>

export interface SISectionPayload {
  locationAndCatchment?: SISection
  visibilityAndAccessibility?: SISection
  shopSpecifications?: SISection
  legalAndCompliance?: SISection
  powerWaterInfrastructure?: SISection
  competitionAnalysis?: SISection
  commercialsAndFinancials?: SISection
  safetyAndSecurity?: SISection
  parkingAndLogistics?: SISection
  growthAndExpansionPotential?: SISection
  remarks?: string
}

// ── Populated sub-types ───────────────────────────────────────────────────────

export interface SIPopulatedStore {
  _id: string
  name: string
  erpCode?: string
  city: string
  state: string
  type: 'COCO' | 'FOFO'
  status: string
  location?: { latitude: number; longitude: number }
  radius?: number
  maxSites?: number
}

export interface SIPopulatedUser {
  _id: string
  name: string
  email: string
}

// ── Sub-document types ────────────────────────────────────────────────────────

export interface SiteSubmission extends SISectionPayload {
  submittedBy: SIPopulatedUser | string
  submittedAt?: string
  gpsCoordinates?: { latitude: number; longitude: number }
  photos: string[]
  videos: string[]
  status: 'draft' | 'submitted'
}

export interface OperationsSubmission extends SISectionPayload {
  submittedBy: SIPopulatedUser | string
  submittedAt?: string
  status: 'draft' | 'submitted'
}

// ── Top-level SiteInspection type ────────────────────────────────────────────

export interface SiteInspection {
  _id: string
  store: SIPopulatedStore | string
  stage: SiteInspectionStage
  name?: string
  franchiseSubmission?: SiteSubmission
  areaManagerSubmission?: SiteSubmission
  operationsSubmission?: OperationsSubmission
  amSkippedBy?: SIPopulatedUser | string
  amSkippedAt?: string
  approvedBy?: SIPopulatedUser | string
  approvedAt?: string
  rejectedBy?: SIPopulatedUser | string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

// ── Filter & pagination types ─────────────────────────────────────────────────

export interface SIFilters {
  stage?: SiteInspectionStage
  storeId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface PaginatedSiteInspections {
  data: SiteInspection[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ── Service ───────────────────────────────────────────────────────────────────

export const siteInspectionsService = {
  // ── List & detail ──────────────────────────────────────────────────────────

  getOne: (id: string) =>
    api.get<SiteInspection>(`/site-inspections/${id}`),

  getAll: (filters?: SIFilters) => {
    const params = new URLSearchParams()
    if (filters?.stage)    params.set('stage',    filters.stage)
    if (filters?.storeId)  params.set('storeId',  filters.storeId)
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters?.dateTo)   params.set('dateTo',   filters.dateTo)
    if (filters?.page)     params.set('page',     String(filters.page))
    if (filters?.limit)    params.set('limit',    String(filters.limit))
    const qs = params.toString()
    return api.get<PaginatedSiteInspections>(`/site-inspections${qs ? `?${qs}` : ''}`)
  },

  getComparison: (storeId: string) =>
    api.get<SiteInspection[]>(`/site-inspections/compare/${storeId}`),

  // ── Create ─────────────────────────────────────────────────────────────────

  create: (storeId: string, gps?: { latitude: number; longitude: number }, name?: string) =>
    api.post<SiteInspection>('/site-inspections', {
      storeId,
      ...(gps ?? {}),
      ...(name ? { name } : {}),
    }),

  // ── Franchise submission ───────────────────────────────────────────────────

  updateFranchise: (id: string, data: SISectionPayload) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/franchise`, data),

  addFranchisePhotos: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return apiUpload<SiteInspection>(`/site-inspections/${id}/franchise/photos`, fd)
  },

  addFranchiseVideos: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return apiUpload<SiteInspection>(`/site-inspections/${id}/franchise/videos`, fd)
  },

  submitFranchise: (id: string) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/franchise/submit`),

  // ── Area Manager submission ────────────────────────────────────────────────

  updateAreaManager: (id: string, data: SISectionPayload & { latitude?: number; longitude?: number }) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/area-manager`, data),

  addAreaManagerPhotos: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return apiUpload<SiteInspection>(`/site-inspections/${id}/area-manager/photos`, fd)
  },

  addAreaManagerVideos: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return apiUpload<SiteInspection>(`/site-inspections/${id}/area-manager/videos`, fd)
  },

  submitAreaManager: (id: string) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/area-manager/submit`),

  skipAreaManager: (id: string) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/area-manager/skip`),

  // ── Operations submission ──────────────────────────────────────────────────

  updateOperations: (id: string, data: SISectionPayload) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/operations`, data),

  submitOperations: (id: string) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/operations/submit`),

  // ── Admin actions ──────────────────────────────────────────────────────────

  approve: (id: string) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/approve`),

  reject: (id: string, reason?: string) =>
    api.patch<SiteInspection>(`/site-inspections/${id}/reject`, reason ? { reason } : {}),

  remove: (id: string) =>
    api.delete<void>(`/site-inspections/${id}`),

  downloadMedia: (id: string, storeName: string) =>
    apiDownload(
      `/site-inspections/${id}/media.zip`,
      `SI-${storeName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-media.zip`,
    ),
}

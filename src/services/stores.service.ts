import { api, apiUpload, apiDownload } from './api'

// ── Activation-phase enums ────────────────────────────────────────────────────

export enum FirmType {
  PROPRIETORSHIP  = 'Proprietorship',
  PARTNERSHIP     = 'Partnership',
  LLP             = 'LLP',
  PRIVATE_LIMITED = 'Private Limited',
  PUBLIC_LIMITED  = 'Public Limited',
  OTHER           = 'Other',
}

export enum Gender {
  MALE   = 'Male',
  FEMALE = 'Female',
  OTHER  = 'Other',
}

export enum Ownership {
  RENTED     = 'Rented',
  SELF_OWNED = 'Self-Owned',
}

export enum DrugLicenseType {
  DL_20_20B = '20_20B',
  DL_21_21B = '21_21B',
  DL_21C    = '21C',
  DL_20F    = '20F',
}

export enum DrugLicenseStatus {
  APPLIED  = 'applied',
  REJECTED = 'rejected',
  RECEIVED = 'received',
}

// ── Activation-phase interfaces ───────────────────────────────────────────────

export interface DrugLicenseEntry {
  licenseNumber?: string
  validUpto?: string
  file?: string
  status?: DrugLicenseStatus
}

export interface DrugLicenseDetails {
  dl20_20B?: DrugLicenseEntry
  dl21_21B?: DrugLicenseEntry
  dl21C?: DrugLicenseEntry
  dl20F?: DrugLicenseEntry
  storeArea?: number
  drugLicenseName?: string
  fullAddressAsPerDL?: string
}

export interface FirmDetails {
  firmName?: string
  authorizedPerson?: string
  firmType?: FirmType
  designation?: string
  address?: string
  panNo?: string
  gstNo?: string
}

export interface PersonalDetails {
  name?: string
  gender?: Gender
  qualification?: string
  experienceYears?: number
  email?: string
  dob?: string
  aadharNo?: string
}

export interface ShutterDimensions {
  width?: number
  height?: number
}

export interface ShopDimensions {
  length?: number
  width?: number
  height?: number
}

export interface StoreActivationDetails {
  shutterDimensions?: ShutterDimensions
  ownership?: Ownership
  rentPerMonth?: number
  videos?: string[]
  images?: string[]
  actualCarpetArea?: number
  shopDimensions?: ShopDimensions
}

export enum StoreType {
  COCO = 'COCO',
  FOFO = 'FOFO',
}

export enum StoreStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  ACTIVE   = 'active',
  REJECTED = 'rejected',
}

export interface StoreLocation {
  latitude: number
  longitude: number
}

export interface AllocatedUser {
  _id: string
  name: string
  email: string
}

export interface Store {
  _id: string
  name: string
  erpCode?: string
  city: string
  state: string
  address?: string
  location?: StoreLocation
  radius?: number
  type: StoreType
  status: StoreStatus
  allocatedUsers: (AllocatedUser | string)[]
  createdAt: string
  updatedAt: string
  // Activation-phase sub-documents
  drugLicenseDetails?: DrugLicenseDetails
  firmDetails?: FirmDetails
  personalDetails?: PersonalDetails
  storeDetails?: StoreActivationDetails
}

export interface CreateStorePayload {
  name: string
  city: string
  state: string
  address?: string
  type: StoreType
  radius: number
  location: StoreLocation
}

export interface UpdateStorePayload {
  name?: string
  city?: string
  state?: string
  address?: string
  type?: StoreType
  erpCode?: string
  location?: StoreLocation
  radius?: number
}

export interface ActivationPayload {
  drugLicenseDetails?: Partial<DrugLicenseDetails> & {
    dl20_20B?: Partial<DrugLicenseEntry>
    dl21_21B?: Partial<DrugLicenseEntry>
    dl21C?: Partial<DrugLicenseEntry>
    dl20F?: Partial<DrugLicenseEntry>
  }
  firmDetails?: Partial<FirmDetails>
  personalDetails?: Partial<PersonalDetails>
  storeDetails?: Partial<Omit<StoreActivationDetails, 'shutterDimensions' | 'shopDimensions'>> & {
    shutterDimensions?: Partial<ShutterDimensions>
    shopDimensions?: Partial<ShopDimensions>
  }
}

export const storesService = {
  getAll: ()                                    => api.get<Store[]>('/stores'),
  getOne: (id: string)                          => api.get<Store>(`/stores/${id}`),
  create: (payload: CreateStorePayload)         => api.post<Store>('/stores', payload),
  update: (id: string, payload: UpdateStorePayload) => api.patch<Store>(`/stores/${id}`, payload),
  approve:   (id: string)                       => api.patch<Store>(`/stores/${id}/approve`),
  activate:  (id: string)                       => api.patch<Store>(`/stores/${id}/activate`),
  reject:    (id: string)                       => api.patch<Store>(`/stores/${id}/reject`),
  resubmit:  (id: string)                       => api.patch<Store>(`/stores/${id}/resubmit`),
  remove:    (id: string)                       => api.delete<void>(`/stores/${id}`),

  // Activation-phase
  updateActivation: (id: string, payload: ActivationPayload) =>
    api.patch<Store>(`/stores/${id}/activation`, payload),

  addDrugLicenseFile: (id: string, type: DrugLicenseType, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiUpload<Store>(`/stores/${id}/activation/drug-license-file?type=${type}`, fd)
  },

  addStoreImages: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('images', f))
    return apiUpload<Store>(`/stores/${id}/activation/images`, fd)
  },

  addStoreVideos: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('videos', f))
    return apiUpload<Store>(`/stores/${id}/activation/video`, fd)
  },

  removeStoreImage: (id: string, url: string) =>
    api.delete<Store>(`/stores/${id}/activation/images?url=${encodeURIComponent(url)}`),

  removeStoreVideo: (id: string, url: string) =>
    api.delete<Store>(`/stores/${id}/activation/videos?url=${encodeURIComponent(url)}`),

  downloadMedia: (id: string, storeName: string) =>
    apiDownload(
      `/stores/${id}/media.zip`,
      `${storeName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-media.zip`,
    ),
}

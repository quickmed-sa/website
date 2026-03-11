import { api, apiUpload } from './api'

// ── Shared primitives ─────────────────────────────────────────────────────────

export type YesNo   = 'yes' | 'no'
export type GoodAvg = 'good' | 'average'

export interface YesNoItem { status?: YesNo; remarks?: string }

// ── Section types (mirror backend entity) ─────────────────────────────────────

export interface AmbianceSection {
  signboard?:       YesNoItem
  insideLighting?:  YesNoItem
  airConditioner?:  YesNoItem
  floorDisplayUnit?: YesNoItem
  cleanliness?: {
    dust?:            YesNo
    cleaningNeeded?:  YesNo
    luxReading?:      string
    unwantedObjects?: YesNo
    remarks?:         string
  }
  inStoreBranding?: YesNoItem
}

export interface EquipmentSection {
  cctvDvr?:           YesNoItem
  printer?:           YesNoItem
  refrigerators?:     YesNoItem
  ledTvsProjectors?:  YesNoItem
  waterDispenser?:    YesNoItem
}

export interface ComplianceSection {
  offerDisplay?: {
    skuDisplayedListed?:          string
    shelfTalkersDisplayedListed?: string
    licenseDisplayed?:            YesNo
    remarks?:                     string
  }
  categoryStickers?: {
    numberOfCategoryStickers?: string
    properFacing?:             YesNo
    babyFoodFefo?:             YesNo
    remarks?:                  string
  }
  pharmaRacking?: {
    tabletBoxArrangement?:     YesNo
    alphabeticalArrangement?:  YesNo
    genericCounter?:           YesNo
    feedbackSignage?:          YesNo
    remarks?:                  string
  }
}

export interface StoreTeamSection {
  attitude?: {
    grooming?:     GoodAvg
    discipline?:   GoodAvg
    greeting?:     GoodAvg
    cooperation?:  GoodAvg
    remarks?:      string
  }
  skill?: {
    upselling?:    GoodAvg
    crossSelling?:  GoodAvg
    saleClosing?:  GoodAvg
    acceptability?: GoodAvg
    remarks?:      string
  }
  knowledge?: {
    counselling?:              GoodAvg
    dispensingPrescription?:   string
    monthlyOffer?:             GoodAvg
    substitution?:             GoodAvg
    remarks?:                  string
  }
}

export interface OperationsSection {
  cashAccounting?: {
    closingCashVsBanking?: YesNo
    runningCash?:          YesNo
    pettyCash?:            YesNo
    excessCashBook?:       YesNo
    handoverBook?:         YesNo
  }
  stockAccounting?: {
    unaccountedStock?:   YesNo
    randomAudit50Sku?:   YesNo
    stockCheckCycle?:    YesNo
    highValueTop50?:     YesNo
    damageExpiry?:       YesNo
  }
  refillReminder?:  { frequencyEntry?: YesNo; dailyCalling?: YesNo }
  bounce?:          { bounceEntryLast3Days?: YesNo }
  jit?:             { jitVsSales?: YesNo }
  scheduleH1?: {
    scheduleH1Register?: YesNo
    prescriptionFile?:   YesNo
    billingAccuracy?:    YesNo
  }
  billing?: {
    contactNo?:          YesNo
    frequencyAccuracy?:  YesNo
    doctorName?:         YesNo
  }
  returns?:         { returnAuditLast7Days?: YesNo }
  inactiveCalling?: { dailyCallingLast7Days?: YesNo }
  manualBill?:      { consumptionReportVsPhysical?: YesNo }
  deliveryLogBook?: { reportVsPhysical?: YesNo }
}

export interface InspectionPayload {
  ambiance?:   AmbianceSection
  equipment?:  EquipmentSection
  compliance?: ComplianceSection
  storeTeam?:  StoreTeamSection
  operations?: OperationsSection
  notes?:      string
}

export interface Inspection extends InspectionPayload {
  _id:     string
  visit:   string
  status:  'draft' | 'submitted'
  photos:  string[]
  videos:  string[]
}

// ── Service ───────────────────────────────────────────────────────────────────

export const inspectionsService = {
  create:     (visitId: string)                          => api.post<Inspection>('/inspections', { visitId }),
  getByVisit: (visitId: string)                          => api.get<Inspection | null>(`/inspections/for-visit/${visitId}`),
  update:     (id: string, data: InspectionPayload)      => api.patch<Inspection>(`/inspections/${id}`, data),
  submit:     (id: string)                               => api.patch<Inspection>(`/inspections/${id}/submit`),
  addPhotos: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return apiUpload<Inspection>(`/inspections/${id}/photos`, fd)
  },

  addVideos: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return apiUpload<Inspection>(`/inspections/${id}/videos`, fd)
  },
}

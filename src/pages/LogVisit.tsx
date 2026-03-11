import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { storesService, Store, StoreStatus, StoreType } from '../services/stores.service'
import { visitsService, VisitStatus, PopulatedStore } from '../services/visits.service'
import { inspectionsService, InspectionPayload, YesNo, GoodAvg, Inspection as InspectionEntity } from '../services/inspections.service'
import { tokenStorage } from '../services/api'
import { authService } from '../services/auth.service'
import { CameraCapture, CapturedImage } from '../components/CameraCapture'
import { VideoCapture } from '../components/VideoCapture'
import './LogVisit.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

// ── Inspection form state ─────────────────────────────────────────────────────

type YNItem = { status?: YesNo; remarks?: string }
type SimpleAmbianceKey = 'signboard' | 'insideLighting' | 'airConditioner' | 'floorDisplayUnit' | 'inStoreBranding'

interface IForm {
  ambiance: {
    signboard:        YNItem
    insideLighting:   YNItem
    airConditioner:   YNItem
    floorDisplayUnit: YNItem
    cleanliness: {
      dust?:            YesNo
      cleaningNeeded?:  YesNo
      luxReading?:      string
      unwantedObjects?: YesNo
      remarks?:         string
    }
    inStoreBranding: YNItem
  }
  equipment: {
    cctvDvr:          YNItem
    printer:          YNItem
    refrigerators:    YNItem
    ledTvsProjectors: YNItem
    waterDispenser:   YNItem
  }
  compliance: {
    offerDisplay: {
      skuDisplayedListed?:          string
      shelfTalkersDisplayedListed?: string
      licenseDisplayed?:            YesNo
      remarks?:                     string
    }
    categoryStickers: {
      numberOfCategoryStickers?: string
      properFacing?:             YesNo
      babyFoodFefo?:             YesNo
      remarks?:                  string
    }
    pharmaRacking: {
      tabletBoxArrangement?:    YesNo
      alphabeticalArrangement?: YesNo
      genericCounter?:          YesNo
      feedbackSignage?:         YesNo
      remarks?:                 string
    }
  }
  storeTeam: {
    attitude:  { grooming?: GoodAvg; discipline?: GoodAvg; greeting?: GoodAvg; cooperation?: GoodAvg; remarks?: string }
    skill:     { upselling?: GoodAvg; crossSelling?: GoodAvg; saleClosing?: GoodAvg; acceptability?: GoodAvg; remarks?: string }
    knowledge: { counselling?: GoodAvg; dispensingPrescription?: string; monthlyOffer?: GoodAvg; substitution?: GoodAvg; remarks?: string }
  }
  operations: {
    cashAccounting:  { closingCashVsBanking?: YesNo; runningCash?: YesNo; pettyCash?: YesNo; excessCashBook?: YesNo; handoverBook?: YesNo }
    stockAccounting: { unaccountedStock?: YesNo; randomAudit50Sku?: YesNo; stockCheckCycle?: YesNo; highValueTop50?: YesNo; damageExpiry?: YesNo }
    refillReminder:  { frequencyEntry?: YesNo; dailyCalling?: YesNo }
    bounce:          { bounceEntryLast3Days?: YesNo }
    jit:             { jitVsSales?: YesNo }
    scheduleH1:      { scheduleH1Register?: YesNo; prescriptionFile?: YesNo; billingAccuracy?: YesNo }
    billing:         { contactNo?: YesNo; frequencyAccuracy?: YesNo; doctorName?: YesNo }
    returns:         { returnAuditLast7Days?: YesNo }
    inactiveCalling: { dailyCallingLast7Days?: YesNo }
    manualBill:      { consumptionReportVsPhysical?: YesNo }
    deliveryLogBook: { reportVsPhysical?: YesNo }
  }
  notes: string
}

const defaultForm: IForm = {
  ambiance: {
    signboard: {}, insideLighting: {}, airConditioner: {}, floorDisplayUnit: {},
    cleanliness: {},
    inStoreBranding: {},
  },
  equipment: { cctvDvr: {}, printer: {}, refrigerators: {}, ledTvsProjectors: {}, waterDispenser: {} },
  compliance: { offerDisplay: {}, categoryStickers: {}, pharmaRacking: {} },
  storeTeam: { attitude: {}, skill: {}, knowledge: {} },
  operations: {
    cashAccounting: {}, stockAccounting: {}, refillReminder: {}, bounce: {}, jit: {},
    scheduleH1: {}, billing: {}, returns: {}, inactiveCalling: {}, manualBill: {}, deliveryLogBook: {},
  },
  notes: '',
}

// ── Small reusable UI pieces ──────────────────────────────────────────────────

function YNBtn({ value, onChange }: { value?: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <div className="lv-yn">
      <button type="button" className={`lv-yn-btn${value === 'yes' ? ' lv-yn-yes' : ''}`} onClick={() => onChange('yes')}>Yes</button>
      <button type="button" className={`lv-yn-btn${value === 'no'  ? ' lv-yn-no'  : ''}`} onClick={() => onChange('no')}>No</button>
    </div>
  )
}

function GABtn({ value, onChange }: { value?: GoodAvg; onChange: (v: GoodAvg) => void }) {
  return (
    <div className="lv-yn">
      <button type="button" className={`lv-yn-btn${value === 'good'    ? ' lv-yn-yes' : ''}`} onClick={() => onChange('good')}>Good</button>
      <button type="button" className={`lv-yn-btn${value === 'average' ? ' lv-yn-no'  : ''}`} onClick={() => onChange('average')}>Avg</button>
    </div>
  )
}

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="lv-field-row">
      <span className="lv-field-label">{label}{required && <span className="lv-required"> *</span>}</span>
      <div className="lv-field-ctrl">{children}</div>
    </div>
  )
}

function RemarksInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <input
      className="form-input lv-remarks"
      placeholder="Remarks (optional)"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    />
  )
}

// ── Stage indicator ───────────────────────────────────────────────────────────

const STAGES = ['Location', 'Photo', 'Inspection']

function StageBar({ current }: { current: number }) {
  return (
    <div className="lv-stagebar">
      {STAGES.map((label, i) => {
        const idx = i + 1
        const done    = idx < current
        const active  = idx === current
        return (
          <div key={label} className={`lv-stage${active ? ' lv-stage-active' : ''}${done ? ' lv-stage-done' : ''}`}>
            <div className="lv-stage-dot">
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : idx}
            </div>
            <span className="lv-stage-label">{label}</span>
            {i < STAGES.length - 1 && <div className="lv-stage-line" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreWithDist extends Store { dist?: number }

// ── Main component ────────────────────────────────────────────────────────────

export function LogVisit() {
  const navigate = useNavigate()

  // Stage flow
  const [stage, setStage] = useState<1 | 2 | 3>(1)

  // Stage 1 — location + store
  const [locLoading, setLocLoading] = useState(true)
  const [locError,   setLocError]   = useState<string | null>(null)
  const [userLat,    setUserLat]    = useState<number | null>(null)
  const [userLon,    setUserLon]    = useState<number | null>(null)
  const [stores,     setStores]     = useState<Store[]>([])
  const [storeId,    setStoreId]    = useState('')
  const [storesLoading, setStoresLoading] = useState(true)

  // Stage 2 — photo
  const [photo, setPhoto] = useState<CapturedImage | null>(null)

  // Stage 3 — inspection form
  const [form, setForm] = useState<IForm>(defaultForm)
  const [inspStep, setInspStep] = useState(1)

  // Submission
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [sectionError,  setSectionError]  = useState<string | null>(null)

  // Inspection photos
  const [inspectionPhotos, setInspectionPhotos] = useState<{ file: File; preview: string }[]>([])
  // Inspection videos
  const [inspectionVideos, setInspectionVideos] = useState<File[]>([])
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef  = useRef<HTMLInputElement>(null)

  // Draft persistence state
  const [visitId,          setVisitId]          = useState<string | null>(null)
  const [inspectionId,     setInspectionId]     = useState<string | null>(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [draftLoading,     setDraftLoading]     = useState(true)
  const [saving,           setSaving]           = useState(false)

  // ── Geolocation ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.')
      setLocLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude)
        setUserLon(pos.coords.longitude)
        setLocLoading(false)
      },
      () => {
        setLocError('Could not get your location. Location access is required to log a visit.')
        setLocLoading(false)
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  // ── Load stores ───────────────────────────────────────────────────────────

  useEffect(() => {
    storesService.getAll()
      .then(all => setStores(all.filter(s => s.status === StoreStatus.ACTIVE)))
      .catch(() => setStores([]))
      .finally(() => setStoresLoading(false))
  }, [])

  // ── Draft check — runs once on mount ─────────────────────────────────────

  useEffect(() => {
    async function checkDraft() {
      const user = authService.getCurrentUser()
      const query: Parameters<typeof visitsService.getAll>[0] = { status: VisitStatus.INCOMPLETE, limit: 1 }
      if (user?.role === 'Admin' || user?.role === 'Operations') query.areaManagerId = user.sub

      try {
        const result = await visitsService.getAll(query)
        if (result.data.length === 0) return

        const draft = result.data[0]
        const store = draft.store as PopulatedStore

        setVisitId(draft._id)
        setStoreId(store._id)
        setExistingPhotoUrl(draft.photo ?? null)

        // Restore stage and inspection sub-step first
        const restoreStage = Math.min(Math.max(draft.draftStage ?? 1, 1), 3) as 1 | 2 | 3
        const restoreStep  = Math.min(Math.max(draft.draftStep  ?? 1, 1), 6)
        setStage(restoreStage)
        if (restoreStage === 3) setInspStep(restoreStep)

        // Restore inspection form data.
        // visit.inspectionId is only populated after the inspection is *submitted*,
        // so for a draft inspection we must fetch it separately.
        let insp: InspectionEntity | null = null

        if (draft.inspectionId && typeof draft.inspectionId === 'object') {
          insp = draft.inspectionId as unknown as InspectionEntity
        } else if (restoreStage >= 3) {
          // Inspection was created but not yet submitted — look it up by visitId
          try { insp = await inspectionsService.getByVisit(draft._id) } catch { /* not found */ }
        }

        if (insp) {
          setInspectionId(insp._id)
          setForm({
            ambiance:   { ...defaultForm.ambiance,   ...(insp.ambiance   ?? {}) } as IForm['ambiance'],
            equipment:  { ...defaultForm.equipment,  ...(insp.equipment  ?? {}) } as IForm['equipment'],
            compliance: { ...defaultForm.compliance, ...(insp.compliance ?? {}) } as IForm['compliance'],
            storeTeam:  { ...defaultForm.storeTeam,  ...(insp.storeTeam  ?? {}) } as IForm['storeTeam'],
            operations: { ...defaultForm.operations, ...(insp.operations ?? {}) } as IForm['operations'],
            notes: insp.notes ?? '',
          })
        }
      } catch {
        // draft check errors are non-fatal — start fresh
      } finally {
        setDraftLoading(false)
      }
    }

    checkDraft()
  }, [])

  // ── Store sorting ─────────────────────────────────────────────────────────

  const sortedStores: StoreWithDist[] = (() => {
    if (userLat === null || userLon === null) return stores
    return [...stores]
      .map((s): StoreWithDist => {
        const loc = s.location
        if (!loc?.latitude || !loc?.longitude) return { ...s }
        return { ...s, dist: haversineKm(userLat, userLon, loc.latitude, loc.longitude) }
      })
      .sort((a, b) => {
        if (a.dist === undefined && b.dist === undefined) return 0
        if (a.dist === undefined) return 1
        if (b.dist === undefined) return -1
        return a.dist - b.dist
      })
  })()

  const nearbyStores = sortedStores.filter(s => s.dist !== undefined && s.dist <= 0.1)

  // ── Deep state update helper ──────────────────────────────────────────────

  function upd(path: string[], value: unknown) {
    setForm(prev => {
      const clone = JSON.parse(JSON.stringify(prev)) as IForm
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cur: any = clone
      for (let i = 0; i < path.length - 1; i++) {
        if (cur[path[i]] === undefined) cur[path[i]] = {}
        cur = cur[path[i]]
      }
      cur[path[path.length - 1]] = value
      return clone
    })
  }

  // ── Inspection photo handlers ─────────────────────────────────────────────

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setInspectionPhotos(prev => {
      const remaining = 10 - prev.length
      if (remaining <= 0) return prev
      const entries = files.slice(0, remaining).map(f => ({ file: f, preview: URL.createObjectURL(f) }))
      return [...prev, ...entries]
    })
  }

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setInspectionPhotos(prev => {
      if (prev.length >= 10) return prev
      return [...prev, { file, preview: URL.createObjectURL(file) }]
    })
  }

  function removeInspectionPhoto(idx: number) {
    setInspectionPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // ── Discard draft ─────────────────────────────────────────────────────────

  async function handleDiscard() {
    if (!visitId) return
    setSaving(true)
    try {
      await visitsService.cancel(visitId)
    } catch { /* ignore — visit may already be in a non-cancellable state */ }
    setVisitId(null)
    setInspectionId(null)
    setExistingPhotoUrl(null)
    setStoreId('')
    setPhoto(null)
    setForm(defaultForm)
    setInspStep(1)
    setStage(1)
    setError(null)
    setSaving(false)
  }

  // ── Stage 1 → 2 ──────────────────────────────────────────────────────────

  async function handleStage1Next() {
    if (!storeId) return
    setSaving(true)
    setError(null)
    try {
      let vid = visitId
      if (!vid) {
        const today = new Date().toISOString().split('T')[0]
        const scheduled = await visitsService.getAll({ storeId, status: VisitStatus.SCHEDULED, dateFrom: today, dateTo: today, limit: 1 })
        if (scheduled.data.length > 0) {
          vid = scheduled.data[0]._id
        } else {
          const visit = await visitsService.create({ store: storeId, visitDate: new Date().toISOString(), status: VisitStatus.INCOMPLETE })
          vid = visit._id
        }
        setVisitId(vid)
      }
      await visitsService.update(vid, { status: VisitStatus.INCOMPLETE, draftStage: 2 })
      setStage(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Stage 2 → 3 ──────────────────────────────────────────────────────────

  async function handleStage2Next() {
    if (!photo && !existingPhotoUrl) return
    if (!visitId) return
    setSaving(true)
    setError(null)
    try {
      // Upload new photo if the user just captured one
      if (photo) {
        const res  = await fetch(photo.dataUrl)
        const blob = await res.blob()
        const fd   = new FormData()
        fd.append('file', blob, 'visit-photo.jpg')
        const token = tokenStorage.get()
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/visits/${visitId}/photo`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        })
        setExistingPhotoUrl(photo.dataUrl)
      }

      // Create draft inspection if not yet done
      let iid = inspectionId
      if (!iid) {
        try {
          const insp = await inspectionsService.create(visitId)
          iid = insp._id
        } catch {
          // Inspection already exists (e.g. user went back from stage 3 to stage 2)
          const existing = await inspectionsService.getByVisit(visitId)
          if (!existing) throw new Error('Could not create or find inspection for this visit.')
          iid = existing._id
          // Restore any previously saved form data
          setForm({
            ambiance:   { ...defaultForm.ambiance,   ...(existing.ambiance   ?? {}) } as IForm['ambiance'],
            equipment:  { ...defaultForm.equipment,  ...(existing.equipment  ?? {}) } as IForm['equipment'],
            compliance: { ...defaultForm.compliance, ...(existing.compliance ?? {}) } as IForm['compliance'],
            storeTeam:  { ...defaultForm.storeTeam,  ...(existing.storeTeam  ?? {}) } as IForm['storeTeam'],
            operations: { ...defaultForm.operations, ...(existing.operations ?? {}) } as IForm['operations'],
            notes: existing.notes ?? '',
          })
        }
        setInspectionId(iid)
      }

      await visitsService.update(visitId, { draftStage: 3, draftStep: 1 })
      setInspStep(1)
      setStage(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Stage 2 back ──────────────────────────────────────────────────────────

  function handleStage2Back() {
    if (visitId) visitsService.update(visitId, { draftStage: 1 }).catch(() => {})
    setStage(1)
  }

  // ── Store type awareness ──────────────────────────────────────────────────

  const selectedStore = stores.find(s => s._id === storeId)
  const isCOCO = selectedStore?.type === StoreType.COCO

  // ── Mandatory field checks per section (all visible YN/GA fields) ──────────

  function getMandatoryChecks(step: number): { label: string; check: (f: IForm) => boolean }[] {
    switch (step) {
      case 1: return [
        { label: 'Signboard',          check: f => !!f.ambiance.signboard.status },
        { label: 'Inside Lighting',    check: f => !!f.ambiance.insideLighting.status },
        { label: 'Air Conditioner',    check: f => !!f.ambiance.airConditioner.status },
        { label: 'Floor Display Unit', check: f => !!f.ambiance.floorDisplayUnit.status },
        { label: 'In-Store Branding',  check: f => !!f.ambiance.inStoreBranding.status },
        { label: 'Dust',               check: f => !!f.ambiance.cleanliness.dust },
        { label: 'Cleaning Needed',    check: f => !!f.ambiance.cleanliness.cleaningNeeded },
        { label: 'Unwanted Objects',   check: f => !!f.ambiance.cleanliness.unwantedObjects },
        { label: 'Lux Reading',        check: f => !!f.ambiance.cleanliness.luxReading?.trim() },
      ]
      case 2: return [
        { label: 'CCTV / DVR',           check: f => !!f.equipment.cctvDvr.status },
        { label: 'Printer',              check: f => !!f.equipment.printer.status },
        { label: 'Refrigerators',        check: f => !!f.equipment.refrigerators.status },
        { label: 'LED TVs / Projectors', check: f => !!f.equipment.ledTvsProjectors.status },
        { label: 'Water Dispenser',      check: f => !!f.equipment.waterDispenser.status },
      ]
      case 3: return [
        { label: 'SKU Displayed / Listed',          check: f => !!f.compliance.offerDisplay.skuDisplayedListed?.trim() },
        { label: 'Shelf Talkers Displayed / Listed', check: f => !!f.compliance.offerDisplay.shelfTalkersDisplayedListed?.trim() },
        { label: 'License Displayed',               check: f => !!f.compliance.offerDisplay.licenseDisplayed },
        { label: 'No. of Category Stickers',        check: f => !!f.compliance.categoryStickers.numberOfCategoryStickers?.trim() },
        { label: 'Proper Facing',                   check: f => !!f.compliance.categoryStickers.properFacing },
        { label: 'Baby Food FEFO',                  check: f => !!f.compliance.categoryStickers.babyFoodFefo },
        { label: 'Tablet Box Arrangement',          check: f => !!f.compliance.pharmaRacking.tabletBoxArrangement },
        { label: 'Alphabetical Arrangement',        check: f => !!f.compliance.pharmaRacking.alphabeticalArrangement },
        { label: 'Generic Counter',                 check: f => !!f.compliance.pharmaRacking.genericCounter },
        { label: 'Feedback Signage',                check: f => !!f.compliance.pharmaRacking.feedbackSignage },
      ]
      case 4: return [
        { label: 'Grooming',                  check: f => !!f.storeTeam.attitude.grooming },
        { label: 'Discipline',                check: f => !!f.storeTeam.attitude.discipline },
        { label: 'Greeting',                  check: f => !!f.storeTeam.attitude.greeting },
        { label: 'Cooperation',               check: f => !!f.storeTeam.attitude.cooperation },
        { label: 'Upselling',                 check: f => !!f.storeTeam.skill.upselling },
        { label: 'Cross Selling',             check: f => !!f.storeTeam.skill.crossSelling },
        { label: 'Sale Closing',              check: f => !!f.storeTeam.skill.saleClosing },
        { label: 'Acceptability',             check: f => !!f.storeTeam.skill.acceptability },
        { label: 'Counselling',               check: f => !!f.storeTeam.knowledge.counselling },
        { label: 'Monthly Offer',             check: f => !!f.storeTeam.knowledge.monthlyOffer },
        { label: 'Substitution',              check: f => !!f.storeTeam.knowledge.substitution },
        { label: 'Dispensing Prescription',   check: f => !!f.storeTeam.knowledge.dispensingPrescription?.trim() },
      ]
      case 5: {
        const common: { label: string; check: (f: IForm) => boolean }[] = [
          { label: 'Unaccounted Stock',    check: f => !!f.operations.stockAccounting.unaccountedStock },
          { label: 'Random Audit 50 SKU', check: f => !!f.operations.stockAccounting.randomAudit50Sku },
          { label: 'Stock Check Cycle',   check: f => !!f.operations.stockAccounting.stockCheckCycle },
          { label: 'High Value Top 50',   check: f => !!f.operations.stockAccounting.highValueTop50 },
          { label: 'Damage / Expiry',     check: f => !!f.operations.stockAccounting.damageExpiry },
          { label: 'Frequency Entry',     check: f => !!f.operations.refillReminder.frequencyEntry },
          { label: 'Daily Calling',       check: f => !!f.operations.refillReminder.dailyCalling },
          { label: 'Bounce Entry',        check: f => !!f.operations.bounce.bounceEntryLast3Days },
          { label: 'JIT vs Sales',        check: f => !!f.operations.jit.jitVsSales },
          { label: 'Schedule H1 Register',check: f => !!f.operations.scheduleH1.scheduleH1Register },
          { label: 'Prescription File',   check: f => !!f.operations.scheduleH1.prescriptionFile },
          { label: 'Billing Accuracy',    check: f => !!f.operations.scheduleH1.billingAccuracy },
          { label: 'Contact No',          check: f => !!f.operations.billing.contactNo },
          { label: 'Frequency Accuracy',  check: f => !!f.operations.billing.frequencyAccuracy },
          { label: 'Doctor Name',         check: f => !!f.operations.billing.doctorName },
        ]
        if (!isCOCO) return common
        return [
          { label: 'Closing Cash vs Banking',       check: f => !!f.operations.cashAccounting.closingCashVsBanking },
          { label: 'Running Cash',                  check: f => !!f.operations.cashAccounting.runningCash },
          { label: 'Petty Cash',                    check: f => !!f.operations.cashAccounting.pettyCash },
          { label: 'Excess Cash Book',              check: f => !!f.operations.cashAccounting.excessCashBook },
          { label: 'Handover Book',                 check: f => !!f.operations.cashAccounting.handoverBook },
          ...common,
          { label: 'Return Audit — Last 7 Days',    check: f => !!f.operations.returns.returnAuditLast7Days },
          { label: 'Daily Calling — Last 7 Days',   check: f => !!f.operations.inactiveCalling.dailyCallingLast7Days },
          { label: 'Consumption Report vs Physical',check: f => !!f.operations.manualBill.consumptionReportVsPhysical },
          { label: 'Report vs Physical',            check: f => !!f.operations.deliveryLogBook.reportVsPhysical },
        ]
      }
      default: return []
    }
  }

  function getMissing(step: number): string[] {
    return getMandatoryChecks(step)
      .filter(r => !r.check(form))
      .map(r => r.label)
  }

  // ── Inspection step navigation ────────────────────────────────────────────

  async function handleInspNext() {
    const missing = getMissing(inspStep)
    if (missing.length > 0) {
      setSectionError(`Please complete all required fields: ${missing.join(', ')}`)
      return
    }
    setSectionError(null)
    const nextStep = inspStep + 1
    if (inspectionId) {
      setSaving(true)
      try {
        await inspectionsService.update(inspectionId, {
          ambiance:   form.ambiance,
          equipment:  form.equipment,
          compliance: form.compliance,
          storeTeam:  form.storeTeam,
          operations: form.operations,
          notes:      form.notes || undefined,
        })
        if (visitId) await visitsService.update(visitId, { draftStep: nextStep })
      } catch { /* non-blocking — form data still in local state */ }
      setSaving(false)
    }
    setInspStep(nextStep as typeof inspStep)
  }

  async function handleInspBack() {
    setSectionError(null)
    if (inspStep === 1) {
      if (visitId) visitsService.update(visitId, { draftStage: 2 }).catch(() => {})
      setStage(2)
      return
    }
    const prevStep = inspStep - 1
    if (inspectionId && visitId) {
      visitsService.update(visitId, { draftStep: prevStep }).catch(() => {})
    }
    setInspStep(prevStep as typeof inspStep)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!visitId || !inspectionId) {
      setError('Session state is missing. Please go back to the photo step and try again.')
      return
    }
    // Final mandatory-field check across all sections
    const allMissing = [1, 2, 3, 4, 5].flatMap(s => getMissing(s))
    if (allMissing.length > 0) {
      setError(`Please complete all required fields: ${allMissing.join(', ')}`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload: InspectionPayload = {
        ambiance:   form.ambiance,
        equipment:  form.equipment,
        compliance: form.compliance,
        storeTeam:  form.storeTeam,
        operations: form.operations,
        notes:      form.notes || undefined,
      }
      await inspectionsService.update(inspectionId, payload)
      if (inspectionPhotos.length > 0) {
        await inspectionsService.addPhotos(inspectionId, inspectionPhotos.map(p => p.file))
      }
      if (inspectionVideos.length > 0) {
        await inspectionsService.addVideos(inspectionId, inspectionVideos)
      }
      await inspectionsService.submit(inspectionId)
      await visitsService.complete(visitId)
      navigate('/visits')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Stage 1 ───────────────────────────────────────────────────────────────

  function renderStage1() {
    // Resuming mode: visit already exists — show the locked-in store
    if (visitId) {
      const resumedStore = stores.find(s => s._id === storeId)
      return (
        <div className="lv-section">
          <div className="lv-resume-banner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Pending visit — continuing where you left off
          </div>

          <h2 className="lv-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
            Selected Store
          </h2>

          {storesLoading ? (
            <div className="lv-status"><span className="spinner" />Loading store info…</div>
          ) : resumedStore ? (
            <div className="lv-store-list">
              <div className="lv-store-card lv-store-nearby lv-store-selected" style={{ cursor: 'default' }}>
                <div className="lv-store-top">
                  <span className="lv-store-name">{resumedStore.name}</span>
                  <span className="lv-nearby-badge">Draft</span>
                </div>
                <span className="lv-store-sub">{resumedStore.city}{resumedStore.erpCode ? ` · ${resumedStore.erpCode}` : ''}</span>
              </div>
            </div>
          ) : (
            <p className="lv-hint" style={{ fontFamily: 'monospace' }}>Store ID: {storeId}</p>
          )}

          {error && <p className="error">{error}</p>}

          <div className="lv-nav lv-nav-row">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={handleDiscard}>
              {saving ? <><span className="spinner" /> Discarding…</> : 'Discard Visit'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={handleStage1Next}
            >
              {saving ? <><span className="spinner" /> Saving…</> : 'Next — Take Photo'}
            </button>
          </div>
        </div>
      )
    }

    // Normal mode: fresh visit — show store selection
    return (
      <div className="lv-section">
        <h2 className="lv-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
          Select Store
        </h2>

        {(locLoading || storesLoading) && (
          <div className="lv-status">
            <span className="spinner" />
            {locLoading ? 'Getting your location…' : 'Loading stores…'}
          </div>
        )}

        {!locLoading && !storesLoading && locError && (
          <div className="lv-notice lv-notice-error">{locError}</div>
        )}

        {!locLoading && !storesLoading && !locError && nearbyStores.length === 0 && (
          <div className="lv-notice lv-notice-error">
            No stores found within 100 m of your location. Visits can only be logged near stores.
          </div>
        )}

        {!locLoading && !storesLoading && !locError && nearbyStores.length > 0 && (
          <div className="lv-store-list">
            {nearbyStores.map(s => (
              <button
                key={s._id}
                type="button"
                className={`lv-store-card lv-store-nearby${storeId === s._id ? ' lv-store-selected' : ''}`}
                onClick={() => setStoreId(s._id)}
              >
                <div className="lv-store-top">
                  <span className="lv-store-name">{s.name}</span>
                  <span className="lv-nearby-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                    {s.dist !== undefined ? fmtDist(s.dist) : 'Nearby'}
                  </span>
                </div>
                <span className="lv-store-sub">{s.city}{s.erpCode ? ` · ${s.erpCode}` : ''}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="lv-nav">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!storeId || nearbyStores.length === 0 || saving}
            onClick={handleStage1Next}
          >
            {saving ? <><span className="spinner" /> Saving…</> : 'Next — Take Photo'}
          </button>
        </div>
      </div>
    )
  }

  // ── Stage 2 ───────────────────────────────────────────────────────────────

  function renderStage2() {
    return (
      <div className="lv-section">
        <h2 className="lv-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Snap a Visit Photo
        </h2>
        <p className="lv-hint">Take a photo to confirm you are at the store. This is attached to your visit record.</p>

        {existingPhotoUrl && !photo && (
          <div className="lv-existing-photo">
            <img src={existingPhotoUrl} alt="Existing visit photo" className="lv-existing-photo-img" />
            <p className="lv-existing-photo-label">Photo from previous session — take a new one or continue with this.</p>
          </div>
        )}

        <CameraCapture onCapture={img => setPhoto(img)} />

        {error && <p className="error">{error}</p>}

        <div className="lv-nav lv-nav-row">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={handleStage2Back}>Back</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={(!photo && !existingPhotoUrl) || saving}
            onClick={handleStage2Next}
          >
            {saving ? <><span className="spinner" /> Saving…</> : 'Next — Inspection'}
          </button>
        </div>
      </div>
    )
  }

  // ── Stage 3 ───────────────────────────────────────────────────────────────

  const INSP_SECTION_LABELS = [
    '1. Ambiance',
    '2. Equipment',
    '3. Compliance & Merchandising',
    '4. Store Team Observation',
    '5. Operations',
    '6. Comments & Photos',
  ]

  function renderInspSectionContent() {
    const f = form
    if (inspStep === 1) return (
      <>
        {([ ['Signboard', 'signboard'], ['Inside Lighting', 'insideLighting'],
             ['Air Conditioner', 'airConditioner'], ['Floor Display Unit', 'floorDisplayUnit'],
             ['In-Store Branding', 'inStoreBranding'] ] as [string, SimpleAmbianceKey][])
          .map(([label, key]) => (
            <div key={key} className="lv-item-group">
              <FieldRow label={label} required>
                <YNBtn value={(f.ambiance[key] as YNItem).status} onChange={v => upd(['ambiance', key, 'status'], v)} />
              </FieldRow>
              <RemarksInput value={(f.ambiance[key] as YNItem).remarks} onChange={v => upd(['ambiance', key, 'remarks'], v)} />
            </div>
          ))}
        <div className="lv-subsection-label">Cleanliness</div>
        <FieldRow label="Dust" required><YNBtn value={f.ambiance.cleanliness.dust} onChange={v => upd(['ambiance','cleanliness','dust'], v)} /></FieldRow>
        <FieldRow label="Cleaning Needed" required><YNBtn value={f.ambiance.cleanliness.cleaningNeeded} onChange={v => upd(['ambiance','cleanliness','cleaningNeeded'], v)} /></FieldRow>
        <FieldRow label="Unwanted Objects" required><YNBtn value={f.ambiance.cleanliness.unwantedObjects} onChange={v => upd(['ambiance','cleanliness','unwantedObjects'], v)} /></FieldRow>
        <FieldRow label="Lux Reading" required>
          <input className="form-input lv-text-input" placeholder="Enter reading" value={f.ambiance.cleanliness.luxReading ?? ''} onChange={e => upd(['ambiance','cleanliness','luxReading'], e.target.value)} />
        </FieldRow>
        <RemarksInput value={f.ambiance.cleanliness.remarks} onChange={v => upd(['ambiance','cleanliness','remarks'], v)} />
      </>
    )
    if (inspStep === 2) return (
      <>
        {([ ['CCTV / DVR', 'cctvDvr'], ['Printer', 'printer'], ['Refrigerators', 'refrigerators'],
             ['LED TVs / Projectors', 'ledTvsProjectors'], ['Water Dispenser', 'waterDispenser'] ] as [string, keyof typeof f.equipment][])
          .map(([label, key]) => (
            <div key={key} className="lv-item-group">
              <FieldRow label={label} required>
                <YNBtn value={f.equipment[key].status} onChange={v => upd(['equipment', key, 'status'], v)} />
              </FieldRow>
              <RemarksInput value={f.equipment[key].remarks} onChange={v => upd(['equipment', key, 'remarks'], v)} />
            </div>
          ))}
      </>
    )
    if (inspStep === 3) return (
      <>
        <div className="lv-subsection-label lv-subsection-first">Offer Display</div>
        <FieldRow label="SKU Displayed / Listed" required>
          <input className="form-input lv-text-input" value={f.compliance.offerDisplay.skuDisplayedListed ?? ''} onChange={e => upd(['compliance','offerDisplay','skuDisplayedListed'], e.target.value)} />
        </FieldRow>
        <FieldRow label="Shelf Talkers Displayed / Listed" required>
          <input className="form-input lv-text-input" value={f.compliance.offerDisplay.shelfTalkersDisplayedListed ?? ''} onChange={e => upd(['compliance','offerDisplay','shelfTalkersDisplayedListed'], e.target.value)} />
        </FieldRow>
        <FieldRow label="License Displayed" required><YNBtn value={f.compliance.offerDisplay.licenseDisplayed} onChange={v => upd(['compliance','offerDisplay','licenseDisplayed'], v)} /></FieldRow>
        <RemarksInput value={f.compliance.offerDisplay.remarks} onChange={v => upd(['compliance','offerDisplay','remarks'], v)} />
        <div className="lv-subsection-label">Category Stickers</div>
        <FieldRow label="No. of Category Stickers" required>
          <input className="form-input lv-text-input" value={f.compliance.categoryStickers.numberOfCategoryStickers ?? ''} onChange={e => upd(['compliance','categoryStickers','numberOfCategoryStickers'], e.target.value)} />
        </FieldRow>
        <FieldRow label="Proper Facing" required><YNBtn value={f.compliance.categoryStickers.properFacing} onChange={v => upd(['compliance','categoryStickers','properFacing'], v)} /></FieldRow>
        <FieldRow label="Baby Food FEFO" required><YNBtn value={f.compliance.categoryStickers.babyFoodFefo} onChange={v => upd(['compliance','categoryStickers','babyFoodFefo'], v)} /></FieldRow>
        <RemarksInput value={f.compliance.categoryStickers.remarks} onChange={v => upd(['compliance','categoryStickers','remarks'], v)} />
        <div className="lv-subsection-label">Pharma Racking</div>
        <FieldRow label="Tablet Box Arrangement" required><YNBtn value={f.compliance.pharmaRacking.tabletBoxArrangement} onChange={v => upd(['compliance','pharmaRacking','tabletBoxArrangement'], v)} /></FieldRow>
        <FieldRow label="Alphabetical Arrangement" required><YNBtn value={f.compliance.pharmaRacking.alphabeticalArrangement} onChange={v => upd(['compliance','pharmaRacking','alphabeticalArrangement'], v)} /></FieldRow>
        <FieldRow label="Generic Counter" required><YNBtn value={f.compliance.pharmaRacking.genericCounter} onChange={v => upd(['compliance','pharmaRacking','genericCounter'], v)} /></FieldRow>
        <FieldRow label="Feedback Signage" required><YNBtn value={f.compliance.pharmaRacking.feedbackSignage} onChange={v => upd(['compliance','pharmaRacking','feedbackSignage'], v)} /></FieldRow>
        <RemarksInput value={f.compliance.pharmaRacking.remarks} onChange={v => upd(['compliance','pharmaRacking','remarks'], v)} />
      </>
    )
    if (inspStep === 4) return (
      <>
        <div className="lv-subsection-label lv-subsection-first">Attitude</div>
        {([ ['Grooming', 'grooming'], ['Discipline', 'discipline'], ['Greeting', 'greeting'], ['Cooperation', 'cooperation'] ] as [string, keyof typeof f.storeTeam.attitude][])
          .filter(([,k]) => k !== 'remarks')
          .map(([label, key]) => (
            <FieldRow key={key} label={label} required><GABtn value={f.storeTeam.attitude[key] as GoodAvg} onChange={v => upd(['storeTeam','attitude',key], v)} /></FieldRow>
          ))}
        <RemarksInput value={f.storeTeam.attitude.remarks} onChange={v => upd(['storeTeam','attitude','remarks'], v)} />
        <div className="lv-subsection-label">Skill</div>
        {([ ['Upselling', 'upselling'], ['Cross Selling', 'crossSelling'], ['Sale Closing', 'saleClosing'], ['Acceptability', 'acceptability'] ] as [string, keyof typeof f.storeTeam.skill][])
          .filter(([,k]) => k !== 'remarks')
          .map(([label, key]) => (
            <FieldRow key={key} label={label} required><GABtn value={f.storeTeam.skill[key] as GoodAvg} onChange={v => upd(['storeTeam','skill',key], v)} /></FieldRow>
          ))}
        <RemarksInput value={f.storeTeam.skill.remarks} onChange={v => upd(['storeTeam','skill','remarks'], v)} />
        <div className="lv-subsection-label">Knowledge</div>
        <FieldRow label="Counselling" required><GABtn value={f.storeTeam.knowledge.counselling} onChange={v => upd(['storeTeam','knowledge','counselling'], v)} /></FieldRow>
        <FieldRow label="Monthly Offer" required><GABtn value={f.storeTeam.knowledge.monthlyOffer} onChange={v => upd(['storeTeam','knowledge','monthlyOffer'], v)} /></FieldRow>
        <FieldRow label="Substitution" required><GABtn value={f.storeTeam.knowledge.substitution} onChange={v => upd(['storeTeam','knowledge','substitution'], v)} /></FieldRow>
        <FieldRow label="Dispensing Prescription" required>
          <input className="form-input lv-text-input" value={f.storeTeam.knowledge.dispensingPrescription ?? ''} onChange={e => upd(['storeTeam','knowledge','dispensingPrescription'], e.target.value)} />
        </FieldRow>
        <RemarksInput value={f.storeTeam.knowledge.remarks} onChange={v => upd(['storeTeam','knowledge','remarks'], v)} />
      </>
    )
    // inspStep === 5
    return (
      <>
        {isCOCO && (
          <>
            <div className="lv-subsection-label lv-subsection-first">Cash Accounting</div>
            <FieldRow label="Closing Cash vs Banking" required><YNBtn value={f.operations.cashAccounting.closingCashVsBanking} onChange={v => upd(['operations','cashAccounting','closingCashVsBanking'], v)} /></FieldRow>
            <FieldRow label="Running Cash" required><YNBtn value={f.operations.cashAccounting.runningCash} onChange={v => upd(['operations','cashAccounting','runningCash'], v)} /></FieldRow>
            <FieldRow label="Petty Cash" required><YNBtn value={f.operations.cashAccounting.pettyCash} onChange={v => upd(['operations','cashAccounting','pettyCash'], v)} /></FieldRow>
            <FieldRow label="Excess Cash Book" required><YNBtn value={f.operations.cashAccounting.excessCashBook} onChange={v => upd(['operations','cashAccounting','excessCashBook'], v)} /></FieldRow>
            <FieldRow label="Handover Book" required><YNBtn value={f.operations.cashAccounting.handoverBook} onChange={v => upd(['operations','cashAccounting','handoverBook'], v)} /></FieldRow>
          </>
        )}
        <div className={`lv-subsection-label${isCOCO ? '' : ' lv-subsection-first'}`}>Stock Accounting</div>
        <FieldRow label="Unaccounted Stock" required><YNBtn value={f.operations.stockAccounting.unaccountedStock} onChange={v => upd(['operations','stockAccounting','unaccountedStock'], v)} /></FieldRow>
        <FieldRow label="Random Audit 50 SKU" required><YNBtn value={f.operations.stockAccounting.randomAudit50Sku} onChange={v => upd(['operations','stockAccounting','randomAudit50Sku'], v)} /></FieldRow>
        <FieldRow label="Stock Check Cycle" required><YNBtn value={f.operations.stockAccounting.stockCheckCycle} onChange={v => upd(['operations','stockAccounting','stockCheckCycle'], v)} /></FieldRow>
        <FieldRow label="High Value Top 50" required><YNBtn value={f.operations.stockAccounting.highValueTop50} onChange={v => upd(['operations','stockAccounting','highValueTop50'], v)} /></FieldRow>
        <FieldRow label="Damage / Expiry" required><YNBtn value={f.operations.stockAccounting.damageExpiry} onChange={v => upd(['operations','stockAccounting','damageExpiry'], v)} /></FieldRow>
        <div className="lv-subsection-label">Refill Reminder</div>
        <FieldRow label="Frequency Entry" required><YNBtn value={f.operations.refillReminder.frequencyEntry} onChange={v => upd(['operations','refillReminder','frequencyEntry'], v)} /></FieldRow>
        <FieldRow label="Daily Calling" required><YNBtn value={f.operations.refillReminder.dailyCalling} onChange={v => upd(['operations','refillReminder','dailyCalling'], v)} /></FieldRow>
        <div className="lv-subsection-label">Bounce</div>
        <FieldRow label="Bounce Entry — Last 3 Days" required><YNBtn value={f.operations.bounce.bounceEntryLast3Days} onChange={v => upd(['operations','bounce','bounceEntryLast3Days'], v)} /></FieldRow>
        <div className="lv-subsection-label">JIT</div>
        <FieldRow label="JIT vs Sales" required><YNBtn value={f.operations.jit.jitVsSales} onChange={v => upd(['operations','jit','jitVsSales'], v)} /></FieldRow>
        <div className="lv-subsection-label">Schedule H1</div>
        <FieldRow label="Schedule H1 Register" required><YNBtn value={f.operations.scheduleH1.scheduleH1Register} onChange={v => upd(['operations','scheduleH1','scheduleH1Register'], v)} /></FieldRow>
        <FieldRow label="Prescription File" required><YNBtn value={f.operations.scheduleH1.prescriptionFile} onChange={v => upd(['operations','scheduleH1','prescriptionFile'], v)} /></FieldRow>
        <FieldRow label="Billing Accuracy" required><YNBtn value={f.operations.scheduleH1.billingAccuracy} onChange={v => upd(['operations','scheduleH1','billingAccuracy'], v)} /></FieldRow>
        <div className="lv-subsection-label">Billing</div>
        <FieldRow label="Contact No" required><YNBtn value={f.operations.billing.contactNo} onChange={v => upd(['operations','billing','contactNo'], v)} /></FieldRow>
        <FieldRow label="Frequency Accuracy" required><YNBtn value={f.operations.billing.frequencyAccuracy} onChange={v => upd(['operations','billing','frequencyAccuracy'], v)} /></FieldRow>
        <FieldRow label="Doctor Name" required><YNBtn value={f.operations.billing.doctorName} onChange={v => upd(['operations','billing','doctorName'], v)} /></FieldRow>
        {isCOCO && (
          <>
            <div className="lv-subsection-label">Returns</div>
            <FieldRow label="Return Audit — Last 7 Days" required><YNBtn value={f.operations.returns.returnAuditLast7Days} onChange={v => upd(['operations','returns','returnAuditLast7Days'], v)} /></FieldRow>
            <div className="lv-subsection-label">Inactive Calling</div>
            <FieldRow label="Daily Calling — Last 7 Days" required><YNBtn value={f.operations.inactiveCalling.dailyCallingLast7Days} onChange={v => upd(['operations','inactiveCalling','dailyCallingLast7Days'], v)} /></FieldRow>
            <div className="lv-subsection-label">Manual Bill</div>
            <FieldRow label="Consumption Report vs Physical" required><YNBtn value={f.operations.manualBill.consumptionReportVsPhysical} onChange={v => upd(['operations','manualBill','consumptionReportVsPhysical'], v)} /></FieldRow>
            <div className="lv-subsection-label">Delivery Log Book</div>
            <FieldRow label="Report vs Physical" required><YNBtn value={f.operations.deliveryLogBook.reportVsPhysical} onChange={v => upd(['operations','deliveryLogBook','reportVsPhysical'], v)} /></FieldRow>
          </>
        )}
      </>
    )
  }

  function renderStage3() {
    return (
      <div className="lv-section">
        <div className="lv-insp-header">
          <h2 className="lv-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            {INSP_SECTION_LABELS[inspStep - 1]}
          </h2>
          <div className="lv-insp-steps">
            {INSP_SECTION_LABELS.map((_, i) => (
              <div
                key={i}
                className={`lv-insp-dot${i + 1 === inspStep ? ' lv-insp-dot-active' : i + 1 < inspStep ? ' lv-insp-dot-done' : ''}`}
              />
            ))}
          </div>
          <p className="lv-insp-step-hint">Section {inspStep} of {INSP_SECTION_LABELS.length}</p>
        </div>

        {inspStep < 6 && (
          <>
            <p className="lv-hint" style={{ marginBottom: '0.5rem' }}>Fields marked <span className="lv-required">*</span> are required.</p>
            <div className="lv-insp-body">
              {renderInspSectionContent()}
            </div>
          </>
        )}

        {inspStep === 6 && (
          <div className="lv-notes-wrap">
            <label className="form-label">Overall Notes (optional)</label>
            <textarea
              className="form-input lv-notes"
              placeholder="Any general observations…"
              rows={4}
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        )}

        {/* Photos — available on every section step */}
        <div className="lv-photos-wrap">
          <div className="lv-photos-label">
            <span className="form-label">
              Photos <span className="lv-photos-hint">(optional, max 10)</span>
            </span>
            <div className="lv-photo-actions">
              <button type="button" className="lv-photo-btn" onClick={() => galleryInputRef.current?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Gallery
              </button>
              <button type="button" className="lv-photo-btn" onClick={() => cameraInputRef.current?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Camera
              </button>
            </div>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleGalleryChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
          />

          {inspectionPhotos.length === 0 && (
            <p className="lv-photos-empty">No photos added yet.</p>
          )}

          {inspectionPhotos.length > 0 && (
            <div className="lv-photo-grid">
              {inspectionPhotos.map(({ preview }, i) => (
                <div key={i} className="lv-photo-thumb">
                  <img src={preview} alt={`Photo ${i + 1}`} className="lv-photo-img" />
                  <button
                    type="button"
                    className="lv-photo-remove"
                    onClick={() => removeInspectionPhoto(i)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Videos — available on every section step */}
        <div className="lv-photos-wrap">
          <div className="lv-photos-label">
            <span className="form-label">
              Videos <span className="lv-photos-hint">(optional, max 10)</span>
            </span>
          </div>
          <VideoCapture onChange={setInspectionVideos} maxVideos={10} />
        </div>

        {sectionError && <p className="error">{sectionError}</p>}
        {error && <p className="error">{error}</p>}

        <div className="lv-nav lv-nav-row">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving || submitting}
            onClick={handleInspBack}
          >
            Back
          </button>
          {inspStep < INSP_SECTION_LABELS.length ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || getMissing(inspStep).length > 0}
              onClick={handleInspNext}
            >
              {saving ? <><span className="spinner" /> Saving…</> : `Next — ${INSP_SECTION_LABELS[inspStep]}`}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting || saving}
              onClick={handleSubmit}
            >
              {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit Visit & Inspection'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedStoreName = storeId ? stores.find(s => s._id === storeId)?.name : null

  if (draftLoading) {
    return (
      <div className="lv-page">
        <div className="lv-header">
          <h1 className="page-title">Log Visit</h1>
        </div>
        <div className="lv-status" style={{ justifyContent: 'center', padding: '3rem 0' }}>
          <span className="spinner" /> Checking for pending visits…
        </div>
      </div>
    )
  }

  return (
    <div className="lv-page">
      <div className="lv-header">
        <h1 className="page-title">
          Log Visit{selectedStoreName ? <span className="lv-header-store"> — {selectedStoreName}</span> : null}
        </h1>
        <p className="lv-header-sub">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <StageBar current={stage} />

      <div className="lv-body">
        {stage === 1 && renderStage1()}
        {stage === 2 && renderStage2()}
        {stage === 3 && renderStage3()}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { storesService, type Store, StoreType } from '../services/stores.service'
import { siteInspectionsService, type SISection, type SISectionPayload } from '../services/site-inspections.service'
import { authService } from '../services/auth.service'
import { CameraCapture, type CapturedImage } from '../components/CameraCapture'
import { VideoCapture } from '../components/VideoCapture'
import './SiteInspection.css'

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Form sections ──────────────────────────────────────────────────────────────

interface SectionDef {
  key: string
  label: string
  fields: { key: string; label: string; required?: boolean }[]
}

const FORM_SECTIONS: SectionDef[] = [
  {
    key: 'locationAndCatchment',
    label: 'Location & Catchment',
    fields: [
      { key: 'highResidentialDensity',             label: 'High Residential Density', required: true },
      { key: 'nearbyHospitalsClinicsNursingHomes', label: 'Nearby Hospitals / Clinics / Nursing Homes', required: true },
      { key: 'doctorClinicsWithin300m',            label: 'Doctor Clinics Within 300m', required: true },
      { key: 'elderlyFamilyPopulation',            label: 'Elderly / Family Population', required: true },
      { key: 'strongWalkInPotential',              label: 'Strong Walk-In Potential', required: true },
      { key: 'competitorsWithin500m',              label: 'Competitors Within 500m', required: true },
    ],
  },
  {
    key: 'visibilityAndAccessibility',
    label: 'Visibility & Accessibility',
    fields: [
      { key: 'groundFloorLocation',          label: 'Ground Floor Location', required: true },
      { key: 'roadFacingShop',               label: 'Road Facing Shop', required: true },
      { key: 'visibleSignageOpportunity',    label: 'Visible Signage Opportunity', required: true },
      { key: 'highPedestrianFootfall',       label: 'High Pedestrian Footfall', required: true },
      { key: 'easyEntryExit',                label: 'Easy Entry / Exit', required: true },
      { key: 'closeToMainRoad',              label: 'Close to Main Road', required: true },
      { key: 'accessibleForSeniorCitizens',  label: 'Accessible for Senior Citizens', required: true },
      { key: 'noObstructions',               label: 'No Obstructions', required: true },
    ],
  },
  {
    key: 'shopSpecifications',
    label: 'Shop Specifications',
    fields: [
      { key: 'minimumCarpetArea',        label: 'Minimum Carpet Area', required: true },
      { key: 'properFrontageWidth',      label: 'Proper Frontage Width', required: true },
      { key: 'rectangularLayout',        label: 'Rectangular Layout', required: true },
      { key: 'adequateStorageSpace',     label: 'Adequate Storage Space', required: true },
      { key: 'properVentilation',        label: 'Proper Ventilation', required: true },
      { key: 'electricalLoadSufficient', label: 'Electrical Load Sufficient', required: true },
    ],
  },
  {
    key: 'legalAndCompliance',
    label: 'Legal & Compliance',
    fields: [
      { key: 'commercialUsagePermitted',   label: 'Commercial Usage Permitted', required: true },
      { key: 'tradeLicenseFeasible',       label: 'Trade License Feasible', required: true },
      { key: 'drugLicenseFeasible',        label: 'Drug License Feasible', required: true },
      { key: 'fireSafetyNorms',            label: 'Fire Safety Norms', required: true },
      { key: 'noSealingDisputeHistory',    label: 'No Sealing / Dispute History', required: true },
      { key: 'clearOwnershipDocuments',    label: 'Clear Ownership Documents', required: true },
      { key: 'municipalApprovalAvailable', label: 'Municipal Approval Available', required: true },
      { key: 'taxUpdated',                 label: 'Tax Updated', required: true },
    ],
  },
  {
    key: 'powerWaterInfrastructure',
    label: 'Power, Water & Infrastructure',
    fields: [
      { key: 'electricity24x7',          label: '24×7 Electricity', required: true },
      { key: 'ceilingWallCondition',     label: 'Ceiling / Wall Condition', required: true },
      { key: 'buildingCondition',        label: 'Building Condition', required: true },
      { key: 'inverterDgBackupFeasible', label: 'Inverter / DG Backup Feasible', required: true },
      { key: 'waterSupply',              label: 'Water Supply', required: true },
      { key: 'drainageFacility',         label: 'Drainage Facility', required: true },
      { key: 'internetAvailability',     label: 'Internet Availability', required: true },
    ],
  },
  {
    key: 'competitionAnalysis',
    label: 'Competition Analysis',
    fields: [
      { key: 'pharmaciesWithin100m',     label: 'Pharmacies Within 100m', required: true },
      { key: 'dailyMarketNearby',        label: 'Daily Market Nearby', required: true },
      { key: 'doctorClinicsNearby',      label: 'Doctor Clinics Nearby', required: true },
      { key: 'competitorTypeAndCount',   label: 'Competitor Type & Count', required: true },
      { key: 'competitorOperatingHours', label: 'Competitor Operating Hours', required: true },
      { key: 'competitorAverageSales',   label: 'Competitor Average Sales', required: true },
      { key: 'priceCompetitiveness',     label: 'Price Competitiveness', required: true },
      { key: 'uspOpportunity',           label: 'USP Opportunity', required: true },
    ],
  },
  {
    key: 'commercialsAndFinancials',
    label: 'Commercials & Financials',
    fields: [
      { key: 'rentWithinBudget',           label: 'Rent Within Budget', required: true },
      { key: 'securityDepositReasonable',  label: 'Security Deposit Reasonable', required: true },
      { key: 'leaseTenureMinimum5Year',    label: 'Lease Tenure ≥ 5 Years', required: true },
      { key: 'lockInPeriodAcceptable',     label: 'Lock-In Period Acceptable', required: true },
      { key: 'rentEscalationAcceptable',   label: 'Rent Escalation Acceptable', required: true },
      { key: 'roiFeasibility18to24Months', label: 'ROI Feasibility (18–24 Months)', required: true },
    ],
  },
  {
    key: 'safetyAndSecurity',
    label: 'Safety & Security',
    fields: [
      { key: 'safeNeighborhood',          label: 'Safe Neighbourhood', required: true },
      { key: 'lowTheftRisk',              label: 'Low Theft Risk', required: true },
      { key: 'shutterLockProvision',      label: 'Shutter / Lock Provision', required: true },
      { key: 'cctvInstallationPossible',  label: 'CCTV Installation Possible', required: true },
      { key: 'nightOperationFeasible',    label: 'Night Operation Feasible', required: true },
    ],
  },
  {
    key: 'parkingAndLogistics',
    label: 'Parking & Logistics',
    fields: [
      { key: 'twoWheelerParkingAvailable',    label: 'Two-Wheeler Parking Available', required: true },
      { key: 'ambulancePatientVehicleAccess', label: 'Ambulance / Patient Vehicle Access', required: true },
      { key: 'deliveryRiderParkingFeasible',  label: 'Delivery Rider Parking Feasible', required: true },
      { key: 'stockDeliveryVehicleAccess',    label: 'Stock Delivery Vehicle Access', required: true },
    ],
  },
  {
    key: 'growthAndExpansionPotential',
    label: 'Growth & Expansion Potential',
    fields: [
      { key: 'scopeForFutureExpansion',          label: 'Scope for Future Expansion', required: true },
      { key: 'increasingResidentialDevelopment', label: 'Increasing Residential Development', required: true },
      { key: 'upcomingHospitalsClinicsNearby',   label: 'Upcoming Hospitals / Clinics Nearby', required: true },
      { key: 'areaGrowthTrendPositive',          label: 'Area Growth Trend Positive', required: true },
    ],
  },
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface SIForm {
  locationAndCatchment: SISection
  visibilityAndAccessibility: SISection
  shopSpecifications: SISection
  legalAndCompliance: SISection
  powerWaterInfrastructure: SISection
  competitionAnalysis: SISection
  commercialsAndFinancials: SISection
  safetyAndSecurity: SISection
  parkingAndLogistics: SISection
  growthAndExpansionPotential: SISection
  remarks: string
}

const defaultForm: SIForm = {
  locationAndCatchment: {},
  visibilityAndAccessibility: {},
  shopSpecifications: {},
  legalAndCompliance: {},
  powerWaterInfrastructure: {},
  competitionAnalysis: {},
  commercialsAndFinancials: {},
  safetyAndSecurity: {},
  parkingAndLogistics: {},
  growthAndExpansionPotential: {},
  remarks: '',
}

// ── Draft persistence ──────────────────────────────────────────────────────────

interface SIDraft {
  siId: string
  stage: 1 | 2 | 3
  sectionStep: number
}

function draftKey(storeId: string) {
  return `si_draft_${storeId}`
}

function loadDraftLocal(storeId: string): SIDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(storeId))
    return raw ? (JSON.parse(raw) as SIDraft) : null
  } catch {
    return null
  }
}

function saveDraftLocal(storeId: string, siId: string, stage: 1 | 2 | 3, sectionStep: number) {
  localStorage.setItem(draftKey(storeId), JSON.stringify({ siId, stage, sectionStep }))
}

function clearDraftLocal(storeId: string) {
  localStorage.removeItem(draftKey(storeId))
}

// ── Photo types & constants ────────────────────────────────────────────────────

const MAX_PHOTOS = 10

interface SIPhotoItem {
  id: number
  dataUrl: string
  file: File
}

// ── Small UI components ────────────────────────────────────────────────────────

function RatingButtons({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="si-rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`si-rating-btn${value === n ? ' si-rating-active' : ''}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lv-field-row">
      <span className="lv-field-label">{label}</span>
      <div className="lv-field-ctrl">{children}</div>
    </div>
  )
}

// ── Stage bar ──────────────────────────────────────────────────────────────────

const STAGES = ['Location', 'Photo', 'Form']

function StageBar({ current }: { current: number }) {
  return (
    <div className="lv-stagebar">
      {STAGES.map((label, i) => {
        const idx    = i + 1
        const done   = idx < current
        const active = idx === current
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

// ── Determine mode from role + store type ──────────────────────────────────────

type WizardMode = 'fo' | 'am' | 'none'

function getWizardMode(role: string | undefined, storeType: StoreType | undefined): WizardMode {
  if (!role || !storeType) return 'none'
  if (role === 'Admin' || role === 'Operations') {
    return storeType === StoreType.COCO ? 'am' : 'fo'
  }
  if (role === 'Franchise' && storeType === StoreType.FOFO) return 'fo'
  if (role === 'Area Manager' && storeType === StoreType.COCO) return 'am'
  return 'none'
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SiteInspection() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate    = useNavigate()
  const currentUser = authService.getCurrentUser()

  // Stage
  const [stage, setStage] = useState<1 | 2 | 3>(1)

  // Stage 1 — store + location
  const [store,          setStore]        = useState<Store | null>(null)
  const [storeLoading,   setStoreLoading] = useState(true)
  const [storeError,     setStoreError]   = useState<string | null>(null)
  const [locLoading,     setLocLoading]   = useState(true)
  const [locError,       setLocError]     = useState<string | null>(null)
  const [userLat,        setUserLat]      = useState<number | null>(null)
  const [userLon,        setUserLon]      = useState<number | null>(null)
  const [inspectorName,  setInspectorName] = useState('')

  // Stage 2 — photo
  const [photo, setPhoto] = useState<CapturedImage | null>(null)

  // Stage 3 — form
  const [form,        setForm]        = useState<SIForm>(defaultForm)
  const [sectionStep, setSectionStep] = useState(0)

  // Stage 3 — site photos
  const [locationPhotos, setLocationPhotos] = useState<SIPhotoItem[]>([])
  const [locationVideos, setLocationVideos] = useState<File[]>([])
  const photoIdRef  = useRef(0)
  const galleryRef  = useRef<HTMLInputElement>(null)
  const cameraRef   = useRef<HTMLInputElement>(null)

  // Draft / SI state
  const [siId,        setSiId]        = useState<string | null>(null)
  const [hasDraft,    setHasDraft]    = useState(false)
  const [draftLoading,setDraftLoading]= useState(true)
  const [creating,    setCreating]    = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Submission
  const [submitting,    setSubmitting]    = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [sectionError,  setSectionError]  = useState<string | null>(null)

  // ── Load store ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!storeId) {
      setStoreError('No store specified.')
      setStoreLoading(false)
      return
    }
    storesService.getOne(storeId)
      .then(setStore)
      .catch(() => setStoreError('Store not found or you do not have access.'))
      .finally(() => setStoreLoading(false))
  }, [storeId])

  // ── Redirect if role not allowed for this store type ───────────────────────

  useEffect(() => {
    if (!store) return
    const m = getWizardMode(currentUser?.role, store.type)
    if (m === 'none') {
      navigate('/site-inspections', { replace: true })
    }
  }, [store, currentUser, navigate])

  // ── Draft restoration (runs after store is available) ─────────────────────

  useEffect(() => {
    if (!store || !storeId) return
    const m = getWizardMode(currentUser?.role, store.type)
    if (m === 'none') { setDraftLoading(false); return }

    const draft = loadDraftLocal(storeId)
    if (!draft) { setDraftLoading(false); return }

    const expectedStage = m === 'fo' ? 'pending_fo' : 'pending_am'

    siteInspectionsService.getOne(draft.siId)
      .then(si => {
        if (si.stage !== expectedStage) {
          // SI has moved past draft stage — discard
          clearDraftLocal(storeId)
          setDraftLoading(false)
          return
        }

        // Restore navigation state
        setSiId(draft.siId)
        setHasDraft(true)
        setStage(draft.stage)
        setSectionStep(draft.sectionStep)

        // Restore form data from server
        const sub = m === 'fo' ? si.franchiseSubmission : si.areaManagerSubmission
        if (sub) {
          setForm({
            locationAndCatchment:        sub.locationAndCatchment        ?? {},
            visibilityAndAccessibility:  sub.visibilityAndAccessibility  ?? {},
            shopSpecifications:          sub.shopSpecifications          ?? {},
            legalAndCompliance:          sub.legalAndCompliance          ?? {},
            powerWaterInfrastructure:    sub.powerWaterInfrastructure    ?? {},
            competitionAnalysis:         sub.competitionAnalysis         ?? {},
            commercialsAndFinancials:    sub.commercialsAndFinancials    ?? {},
            safetyAndSecurity:           sub.safetyAndSecurity           ?? {},
            parkingAndLogistics:         sub.parkingAndLogistics         ?? {},
            growthAndExpansionPotential: sub.growthAndExpansionPotential ?? {},
            remarks:                     sub.remarks                     ?? '',
          })
        }

        setDraftLoading(false)
      })
      .catch(() => {
        clearDraftLocal(storeId)
        setDraftLoading(false)
      })
  }, [store, storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Geolocation ────────────────────────────────────────────────────────────

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
        setLocError('Could not get your location. Please enable location access.')
        setLocLoading(false)
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  // ── Distance from store GPS (if any) ───────────────────────────────────────

  const distance: number | null = (() => {
    if (
      userLat === null || userLon === null ||
      !store?.location?.latitude || !store?.location?.longitude
    ) return null
    return haversineKm(userLat, userLon, store.location.latitude, store.location.longitude)
  })()

  const hasStoreLocation = !!(store?.location?.latitude && store?.location?.longitude)
  const radiusM          = store?.radius ?? 2000
  const radiusKm         = radiusM / 1000
  const withinRange      = distance !== null && distance <= radiusKm

  const isAdminOrOps = currentUser?.role === 'Admin' || currentUser?.role === 'Operations'

  const canProceedFromStage1 =
    !!inspectorName.trim() &&
    !storeError &&
    !locLoading && !storeLoading &&
    (isAdminOrOps || !locError) &&
    (isAdminOrOps || withinRange || !hasStoreLocation)

  // ── Form update ────────────────────────────────────────────────────────────

  function upd(sectionKey: string, fieldKey: string, value: number) {
    setForm(prev => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey as keyof SIForm] as SISection), [fieldKey]: value },
    }))
  }

  // ── Photo handlers ─────────────────────────────────────────────────────────

  function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const remaining = MAX_PHOTOS - locationPhotos.length
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        setLocationPhotos(prev => [
          ...prev,
          { id: ++photoIdRef.current, dataUrl: reader.result as string, file },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  function handleCameraSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || locationPhotos.length >= MAX_PHOTOS) return
    const reader = new FileReader()
    reader.onload = () => {
      setLocationPhotos(prev => [
        ...prev,
        { id: ++photoIdRef.current, dataUrl: reader.result as string, file },
      ])
    }
    reader.readAsDataURL(file)
  }

  // ── Stage transitions ──────────────────────────────────────────────────────

  const mode = getWizardMode(currentUser?.role, store?.type)

  // Stage 1 → 2: create the SI document on the server, save draft
  async function handleProceedToStage2() {
    if (!storeId) return
    setCreating(true)
    setCreateError(null)
    try {
      let id = siId
      if (!id) {
        const gps = userLat !== null && userLon !== null
          ? { latitude: userLat, longitude: userLon }
          : undefined
        const si = await siteInspectionsService.create(storeId, gps, inspectorName.trim() || undefined)
        id = si._id
        setSiId(id)
      }
      saveDraftLocal(storeId, id, 2, 0)
      setStage(2)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to start site inspection.')
    } finally {
      setCreating(false)
    }
  }

  // Stage 3 — advance section + auto-save to server
  function handleSectionNext() {
    // All fields in the current section are required
    if (sectionStep < FORM_SECTIONS.length) {
      const section = FORM_SECTIONS[sectionStep]
      const sectionData = form[section.key as keyof SIForm] as SISection
      const missingLabels = section.fields
        .filter(f => !sectionData[f.key])
        .map(f => f.label)
      if (missingLabels.length > 0) {
        setSectionError(`Please rate all items: ${missingLabels.join(', ')}`)
        return
      }
    }
    setSectionError(null)
    const nextStep = sectionStep + 1
    setSectionStep(nextStep)
    if (siId && storeId) {
      saveDraftLocal(storeId, siId, 3, nextStep)
      // Auto-save current form data (fire-and-forget)
      const { remarks, ...sections } = form
      const payload: SISectionPayload = { ...sections, ...(remarks.trim() ? { remarks } : {}) }
      if (mode === 'fo') {
        siteInspectionsService.updateFranchise(siId, payload).catch(() => {})
      } else {
        const gps = userLat !== null && userLon !== null
          ? { latitude: userLat, longitude: userLon }
          : {}
        siteInspectionsService.updateAreaManager(siId, { ...payload, ...gps }).catch(() => {})
      }
    }
  }

  // Stage 3 — back
  function handleSectionBack() {
    setSectionError(null)
    if (sectionStep === 0) {
      setStage(2)
      if (siId && storeId) saveDraftLocal(storeId, siId, 2, 0)
    } else {
      const prevStep = sectionStep - 1
      setSectionStep(prevStep)
      if (siId && storeId) saveDraftLocal(storeId, siId, 3, prevStep)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!storeId || !store || !siId) return

    if (locationPhotos.length < 5) {
      setSubmitError('At least 5 site photos are required before submitting.')
      return
    }
    if (locationVideos.length < 1) {
      setSubmitError('At least 1 site video is required before submitting.')
      return
    }

    // Validate all fields in all sections
    const allMissing: string[] = []
    for (const sec of FORM_SECTIONS) {
      const sectionData = form[sec.key as keyof SIForm] as SISection
      for (const f of sec.fields) {
        if (!sectionData[f.key]) {
          allMissing.push(`${f.label} (${sec.label})`)
        }
      }
    }
    if (allMissing.length > 0) {
      setSubmitError(`Please complete all required fields: ${allMissing.join(', ')}`)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const gps = userLat !== null && userLon !== null
        ? { latitude: userLat, longitude: userLon }
        : undefined

      const { remarks, ...sections } = form

      if (mode === 'fo') {
        // Save final form data
        await siteInspectionsService.updateFranchise(siId, {
          ...sections,
          ...(remarks.trim() ? { remarks } : {}),
        })

        // Upload presence + site photos
        const photoFiles: File[] = []
        if (photo) {
          try {
            const res = await fetch(photo.dataUrl)
            const blob = await res.blob()
            photoFiles.push(new File([blob], 'presence.jpg', { type: 'image/jpeg' }))
          } catch { /* non-fatal */ }
        }
        photoFiles.push(...locationPhotos.map(p => p.file))
        if (photoFiles.length > 0) {
          try {
            await siteInspectionsService.addFranchisePhotos(siId, photoFiles)
          } catch { /* non-fatal */ }
        }

        // Upload videos
        if (locationVideos.length > 0) {
          try {
            await siteInspectionsService.addFranchiseVideos(siId, locationVideos)
          } catch { /* non-fatal */ }
        }

        await siteInspectionsService.submitFranchise(siId)

      } else {
        // Save final form data
        await siteInspectionsService.updateAreaManager(siId, {
          ...sections,
          ...(remarks.trim() ? { remarks } : {}),
          ...(gps ?? {}),
        })

        // Upload presence + site photos
        const photoFiles: File[] = []
        if (photo) {
          try {
            const res = await fetch(photo.dataUrl)
            const blob = await res.blob()
            photoFiles.push(new File([blob], 'presence.jpg', { type: 'image/jpeg' }))
          } catch { /* non-fatal */ }
        }
        photoFiles.push(...locationPhotos.map(p => p.file))
        if (photoFiles.length > 0) {
          try {
            await siteInspectionsService.addAreaManagerPhotos(siId, photoFiles)
          } catch { /* non-fatal */ }
        }

        // Upload videos
        if (locationVideos.length > 0) {
          try {
            await siteInspectionsService.addAreaManagerVideos(siId, locationVideos)
          } catch { /* non-fatal */ }
        }

        await siteInspectionsService.submitAreaManager(siId)
      }

      clearDraftLocal(storeId)
      navigate('/site-inspections')
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Stage 1 ────────────────────────────────────────────────────────────────

  function renderStage1() {
    const isFO = mode === 'fo'
    return (
      <div className="lv-section">
        <h2 className="lv-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {isFO ? 'Capture Site Location' : 'Verify Your Location'}
        </h2>
        {isFO && (
          <p className="lv-hint">Your GPS coordinates will be recorded as the proposed site location.</p>
        )}

        {(storeLoading || locLoading) && (
          <div className="lv-status">
            <span className="spinner" />
            {storeLoading ? 'Loading store…' : 'Getting your location…'}
          </div>
        )}

        {!storeLoading && storeError && (
          <div className="lv-notice lv-notice-error">{storeError}</div>
        )}

        {!storeLoading && !storeError && store && (
          <div className="si-store-card">
            <div className="si-store-name">{store.name}</div>
            <div className="si-store-meta">
              {store.city}, {store.state}
              {store.erpCode ? ` · ${store.erpCode}` : ''}
              {' · '}<span className="si-store-type">{store.type}</span>
            </div>
            {store.address && (
              <div className="si-store-address">{store.address}</div>
            )}
          </div>
        )}

        {!locLoading && !locError && userLat !== null && (
          <div className="lv-notice lv-notice-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Location captured: {userLat.toFixed(6)}, {userLon!.toFixed(6)}
          </div>
        )}

        {!locLoading && locError && !isAdminOrOps && (
          <div className="lv-notice lv-notice-error">{locError}</div>
        )}

        {/* For AM wizard: show range check if store has GPS */}
        {!isFO && !isAdminOrOps && !locLoading && !locError && !storeLoading && store && (
          hasStoreLocation ? (
            distance !== null && (
              withinRange ? (
                <div className="lv-notice si-notice-ok">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  You are {fmtDist(distance)} from the store — within range.
                </div>
              ) : (
                <div className="lv-notice lv-notice-error">
                  You are {fmtDist(distance)} from the store. Must be within {fmtDist(radiusKm)} to proceed.
                </div>
              )
            )
          ) : (
            <div className="lv-notice lv-notice-warn">
              This store has no GPS coordinates on record. Location check skipped.
            </div>
          )
        )}

        <div className="si-inspector-field">
          <label className="form-label" htmlFor="si-inspection-name">
            Name <span className="as-req">*</span>
          </label>
          <input
            id="si-inspection-name"
            type="text"
            className="form-input"
            placeholder="Enter a name for this inspection"
            value={inspectorName}
            onChange={e => setInspectorName(e.target.value)}
          />
        </div>

        {createError && (
          <div className="lv-notice lv-notice-error">{createError}</div>
        )}

        <div className="lv-nav">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canProceedFromStage1 || creating}
            onClick={handleProceedToStage2}
          >
            {creating
              ? <><span className="spinner" /> Starting…</>
              : 'Next — Take Photo'
            }
          </button>
        </div>
      </div>
    )
  }

  // ── Stage 2 ────────────────────────────────────────────────────────────────

  function renderStage2() {
    return (
      <div className="lv-section">
        <h2 className="lv-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Log Your Presence
        </h2>
        <p className="lv-hint">Take a photo to confirm you are at the site. This is attached to the inspection record.</p>
        {hasDraft && (
          <p className="lv-hint" style={{ color: 'var(--color-warning, #b45309)' }}>
            Resuming from a saved draft — retake your presence photo to continue.
          </p>
        )}
        <CameraCapture onCapture={img => setPhoto(img)} />
        <div className="lv-nav lv-nav-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setStage(1)
              if (siId && storeId) saveDraftLocal(storeId, siId, 1, 0)
            }}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!photo}
            onClick={() => {
              setSectionStep(0)
              setStage(3)
              if (siId && storeId) saveDraftLocal(storeId, siId, 3, 0)
            }}
          >
            Next — Fill Form
          </button>
        </div>
      </div>
    )
  }

  // ── Stage 3 ────────────────────────────────────────────────────────────────

  function renderStage3() {
    const isCommentsStep = sectionStep === FORM_SECTIONS.length
    const section    = isCommentsStep ? null : FORM_SECTIONS[sectionStep]
    const isLast     = isCommentsStep
    const sectionKey = section ? section.key as keyof SIForm : null

    return (
      <div className="lv-section">
        {/* Hidden file inputs */}
        <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleGallerySelect} />
        <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCameraSelect} />

        {/* Section progress header */}
        <div className="lv-insp-header">
          <h2 className="lv-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            {isCommentsStep ? 'Comments & Photos' : section!.label}
          </h2>
          <div className="lv-insp-steps">
            {Array.from({ length: FORM_SECTIONS.length + 1 }).map((_, i) => (
              <div
                key={i}
                className={`lv-insp-dot${i === sectionStep ? ' lv-insp-dot-active' : i < sectionStep ? ' lv-insp-dot-done' : ''}`}
              />
            ))}
          </div>
          <p className="lv-insp-step-hint">Section {sectionStep + 1} of {FORM_SECTIONS.length + 1}</p>
        </div>

        {!isCommentsStep && (
          <>
            <p className="lv-hint si-rating-hint">Rate each item from 1 (poor) to 5 (excellent). All items are required.</p>
            <div className="lv-insp-body">
              {section!.fields.map(f => (
                <FieldRow key={f.key} label={f.required ? `${f.label} *` : f.label}>
                  <RatingButtons
                    value={(form[sectionKey!] as SISection)[f.key]}
                    onChange={v => upd(section!.key, f.key, v)}
                  />
                </FieldRow>
              ))}
            </div>
          </>
        )}

        {isCommentsStep && (
          <>
            <div className="lv-notes-wrap">
              <label className="form-label">Overall Remarks</label>
              <textarea
                className="form-input lv-notes"
                placeholder="Any overall observations about the site…"
                rows={4}
                value={form.remarks}
                onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>

            <div className="si-photos-section">
              <div className="si-photos-header">
                <span className="si-photos-label">Site Photos <span className="as-req">*</span></span>
                <span className="si-photos-count">{locationPhotos.length} / {MAX_PHOTOS}</span>
              </div>
              <p className="si-photos-hint">Minimum 5 photos required. Add photos of the site for documentation.</p>

              {locationPhotos.length > 0 && (
                <div className="si-photos-grid">
                  {locationPhotos.map(p => (
                    <div key={p.id} className="si-photo-thumb">
                      <img src={p.dataUrl} alt="Site photo" />
                      <button
                        type="button"
                        className="si-photo-remove"
                        onClick={() => setLocationPhotos(prev => prev.filter(x => x.id !== p.id))}
                        aria-label="Remove photo"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {locationPhotos.length < MAX_PHOTOS && (
                <div className="si-photos-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => galleryRef.current?.click()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    From Gallery
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => cameraRef.current?.click()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    Take Photo
                  </button>
                </div>
              )}
            </div>

            <div className="si-photos-section">
              <div className="si-photos-header">
                <span className="si-photos-label">Site Videos <span className="as-req">*</span></span>
                <span className="si-photos-count">{locationVideos.length} / 10</span>
              </div>
              <p className="si-photos-hint">Minimum 1 video required. Add videos of the site for documentation.</p>
              <VideoCapture onChange={setLocationVideos} maxVideos={10} />
            </div>
          </>
        )}

        {sectionError && (
          <p className="error" style={{ marginTop: '1rem' }}>{sectionError}</p>
        )}
        {submitError && (
          <p className="error" style={{ marginTop: '1rem' }}>{submitError}</p>
        )}

        <div className="lv-nav lv-nav-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleSectionBack}
          >
            Back
          </button>
          {!isLast ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={(() => {
                if (sectionStep >= FORM_SECTIONS.length) return false
                const sec = FORM_SECTIONS[sectionStep]
                const sectionData = form[sec.key as keyof SIForm] as SISection
                return sec.fields.some(f => !sectionData[f.key])
              })()}
              onClick={handleSectionNext}
            >
              Next — {sectionStep === FORM_SECTIONS.length - 1 ? 'Comments & Photos' : FORM_SECTIONS[sectionStep + 1].label}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting || !siId || locationPhotos.length < 5 || locationVideos.length < 1}
              onClick={handleSubmit}
            >
              {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit Inspection'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (storeLoading || draftLoading) {
    return (
      <div className="lv-page">
        <div className="lv-status" style={{ justifyContent: 'center', padding: '3rem 0' }}>
          <span className="spinner" /> Loading…
        </div>
      </div>
    )
  }

  const wizardTitle = mode === 'fo' ? 'Site Inspection — Franchise' : 'Site Inspection — Area Manager'

  return (
    <div className="lv-page">
      <div className="lv-header">
        <h1 className="page-title">{wizardTitle}</h1>
        <p className="lv-header-sub">
          {store
            ? store.name
            : 'Unknown Store'
          }
          {' · '}
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {hasDraft && (
        <div className="lv-resume-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.55"/>
          </svg>
          Resuming saved draft — your progress has been restored.
        </div>
      )}

      <StageBar current={stage} />

      <div className="lv-body">
        {stage === 1 && renderStage1()}
        {stage === 2 && renderStage2()}
        {stage === 3 && renderStage3()}
      </div>
    </div>
  )
}

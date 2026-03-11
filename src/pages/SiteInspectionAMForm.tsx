import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  siteInspectionsService,
  type SiteInspection,
  type SISection,
  type SIPopulatedStore,
} from '../services/site-inspections.service'
import { CameraCapture, type CapturedImage } from '../components/CameraCapture'
import { VideoCapture } from '../components/VideoCapture'
import './SiteInspectionAMForm.css'

// ── Helpers ────────────────────────────────────────────────────────────────────

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

// ── Form sections (shared definition) ─────────────────────────────────────────

interface SectionDef { key: string; label: string; fields: { key: string; label: string; required?: boolean }[] }

const FORM_SECTIONS: SectionDef[] = [
  { key: 'locationAndCatchment', label: 'Location & Catchment', fields: [
    { key: 'highResidentialDensity',             label: 'High Residential Density', required: true },
    { key: 'nearbyHospitalsClinicsNursingHomes', label: 'Nearby Hospitals / Clinics / Nursing Homes', required: true },
    { key: 'doctorClinicsWithin300m',            label: 'Doctor Clinics Within 300m', required: true },
    { key: 'elderlyFamilyPopulation',            label: 'Elderly / Family Population', required: true },
    { key: 'strongWalkInPotential',              label: 'Strong Walk-In Potential', required: true },
    { key: 'competitorsWithin500m',              label: 'Competitors Within 500m', required: true },
  ]},
  { key: 'visibilityAndAccessibility', label: 'Visibility & Accessibility', fields: [
    { key: 'groundFloorLocation',         label: 'Ground Floor Location', required: true },
    { key: 'roadFacingShop',              label: 'Road Facing Shop', required: true },
    { key: 'visibleSignageOpportunity',   label: 'Visible Signage Opportunity', required: true },
    { key: 'highPedestrianFootfall',      label: 'High Pedestrian Footfall', required: true },
    { key: 'easyEntryExit',               label: 'Easy Entry / Exit', required: true },
    { key: 'closeToMainRoad',             label: 'Close to Main Road', required: true },
    { key: 'accessibleForSeniorCitizens', label: 'Accessible for Senior Citizens', required: true },
    { key: 'noObstructions',              label: 'No Obstructions', required: true },
  ]},
  { key: 'shopSpecifications', label: 'Shop Specifications', fields: [
    { key: 'minimumCarpetArea',        label: 'Minimum Carpet Area', required: true },
    { key: 'properFrontageWidth',      label: 'Proper Frontage Width', required: true },
    { key: 'rectangularLayout',        label: 'Rectangular Layout', required: true },
    { key: 'adequateStorageSpace',     label: 'Adequate Storage Space', required: true },
    { key: 'properVentilation',        label: 'Proper Ventilation', required: true },
    { key: 'electricalLoadSufficient', label: 'Electrical Load Sufficient', required: true },
  ]},
  { key: 'legalAndCompliance', label: 'Legal & Compliance', fields: [
    { key: 'commercialUsagePermitted',   label: 'Commercial Usage Permitted', required: true },
    { key: 'tradeLicenseFeasible',       label: 'Trade License Feasible', required: true },
    { key: 'drugLicenseFeasible',        label: 'Drug License Feasible', required: true },
    { key: 'fireSafetyNorms',            label: 'Fire Safety Norms', required: true },
    { key: 'noSealingDisputeHistory',    label: 'No Sealing / Dispute History', required: true },
    { key: 'clearOwnershipDocuments',    label: 'Clear Ownership Documents', required: true },
    { key: 'municipalApprovalAvailable', label: 'Municipal Approval Available', required: true },
    { key: 'taxUpdated',                 label: 'Tax Updated', required: true },
  ]},
  { key: 'powerWaterInfrastructure', label: 'Power, Water & Infrastructure', fields: [
    { key: 'electricity24x7',          label: '24×7 Electricity', required: true },
    { key: 'ceilingWallCondition',     label: 'Ceiling / Wall Condition', required: true },
    { key: 'buildingCondition',        label: 'Building Condition', required: true },
    { key: 'inverterDgBackupFeasible', label: 'Inverter / DG Backup Feasible', required: true },
    { key: 'waterSupply',              label: 'Water Supply', required: true },
    { key: 'drainageFacility',         label: 'Drainage Facility', required: true },
    { key: 'internetAvailability',     label: 'Internet Availability', required: true },
  ]},
  { key: 'competitionAnalysis', label: 'Competition Analysis', fields: [
    { key: 'pharmaciesWithin100m',     label: 'Pharmacies Within 100m', required: true },
    { key: 'dailyMarketNearby',        label: 'Daily Market Nearby', required: true },
    { key: 'doctorClinicsNearby',      label: 'Doctor Clinics Nearby', required: true },
    { key: 'competitorTypeAndCount',   label: 'Competitor Type & Count', required: true },
    { key: 'competitorOperatingHours', label: 'Competitor Operating Hours', required: true },
    { key: 'competitorAverageSales',   label: 'Competitor Average Sales', required: true },
    { key: 'priceCompetitiveness',     label: 'Price Competitiveness', required: true },
    { key: 'uspOpportunity',           label: 'USP Opportunity', required: true },
  ]},
  { key: 'commercialsAndFinancials', label: 'Commercials & Financials', fields: [
    { key: 'rentWithinBudget',           label: 'Rent Within Budget', required: true },
    { key: 'securityDepositReasonable',  label: 'Security Deposit Reasonable', required: true },
    { key: 'leaseTenureMinimum5Year',    label: 'Lease Tenure ≥ 5 Years', required: true },
    { key: 'lockInPeriodAcceptable',     label: 'Lock-In Period Acceptable', required: true },
    { key: 'rentEscalationAcceptable',   label: 'Rent Escalation Acceptable', required: true },
    { key: 'roiFeasibility18to24Months', label: 'ROI Feasibility (18–24 Months)', required: true },
  ]},
  { key: 'safetyAndSecurity', label: 'Safety & Security', fields: [
    { key: 'safeNeighborhood',         label: 'Safe Neighbourhood', required: true },
    { key: 'lowTheftRisk',             label: 'Low Theft Risk', required: true },
    { key: 'shutterLockProvision',     label: 'Shutter / Lock Provision', required: true },
    { key: 'cctvInstallationPossible', label: 'CCTV Installation Possible', required: true },
    { key: 'nightOperationFeasible',   label: 'Night Operation Feasible', required: true },
  ]},
  { key: 'parkingAndLogistics', label: 'Parking & Logistics', fields: [
    { key: 'twoWheelerParkingAvailable',    label: 'Two-Wheeler Parking Available', required: true },
    { key: 'ambulancePatientVehicleAccess', label: 'Ambulance / Patient Vehicle Access', required: true },
    { key: 'deliveryRiderParkingFeasible',  label: 'Delivery Rider Parking Feasible', required: true },
    { key: 'stockDeliveryVehicleAccess',    label: 'Stock Delivery Vehicle Access', required: true },
  ]},
  { key: 'growthAndExpansionPotential', label: 'Growth & Expansion Potential', fields: [
    { key: 'scopeForFutureExpansion',          label: 'Scope for Future Expansion', required: true },
    { key: 'increasingResidentialDevelopment', label: 'Increasing Residential Development', required: true },
    { key: 'upcomingHospitalsClinicsNearby',   label: 'Upcoming Hospitals / Clinics Nearby', required: true },
    { key: 'areaGrowthTrendPositive',          label: 'Area Growth Trend Positive', required: true },
  ]},
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface AMForm {
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

const defaultForm: AMForm = {
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

const MAX_PHOTOS = 10

interface PhotoItem { id: number; dataUrl: string; file: File }

// ── Small UI ───────────────────────────────────────────────────────────────────

function RatingButtons({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="amf-rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`amf-rating-btn${value === n ? ' amf-rating-active' : ''}`}
          onClick={() => onChange(n)}
        >{n}</button>
      ))}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="amf-field-row">
      <span className="amf-field-label">{label}</span>
      <div className="amf-field-ctrl">{children}</div>
    </div>
  )
}

const STAGE_LABELS = ['Location', 'Photo', 'Form']

function StageBar({ current }: { current: number }) {
  return (
    <div className="amf-stagebar">
      {STAGE_LABELS.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={label} className={`amf-stage${active ? ' amf-stage-active' : ''}${done ? ' amf-stage-done' : ''}`}>
            <div className="amf-stage-dot">
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : idx}
            </div>
            <span className="amf-stage-label">{label}</span>
            {i < STAGE_LABELS.length - 1 && <div className="amf-stage-line" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SiteInspectionAMForm() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [stage, setStage] = useState<1 | 2 | 3>(1)

  // Load SI
  const [si,        setSi]        = useState<SiteInspection | null>(null)
  const [siLoading, setSiLoading] = useState(true)
  const [siError,   setSiError]   = useState<string | null>(null)

  // Location
  const [locLoading, setLocLoading] = useState(true)
  const [locError,   setLocError]   = useState<string | null>(null)
  const [userLat,    setUserLat]    = useState<number | null>(null)
  const [userLon,    setUserLon]    = useState<number | null>(null)

  // Photo
  const [photo, setPhoto] = useState<CapturedImage | null>(null)

  // Form
  const [form,        setForm]        = useState<AMForm>(defaultForm)
  const [sectionStep, setSectionStep] = useState(0)
  const [sitePhotos,  setSitePhotos]  = useState<PhotoItem[]>([])
  const [siteVideos,  setSiteVideos]  = useState<File[]>([])
  const photoIdRef = useRef(0)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef  = useRef<HTMLInputElement>(null)

  // Submission
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)

  // ── Load SI ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    siteInspectionsService.getOne(id)
      .then(data => {
        if (data.stage !== 'pending_am') {
          setSiError(`This site inspection is not in 'pending_am' stage (current: ${data.stage}).`)
        } else {
          setSi(data)
        }
      })
      .catch(err => setSiError(err?.message ?? 'Failed to load site inspection.'))
      .finally(() => setSiLoading(false))
  }, [id])

  // ── Geolocation ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported.')
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
        setLocError('Could not get location. Please enable location access.')
        setLocLoading(false)
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  // ── GPS proximity vs FO GPS ────────────────────────────────────────────────

  const foGps = si?.franchiseSubmission?.gpsCoordinates
  const distFromFO: number | null = (() => {
    if (!foGps || userLat === null || userLon === null) return null
    return haversineMetres(userLat, userLon, foGps.latitude, foGps.longitude)
  })()

  const PROXIMITY_LIMIT_M = 100
  const withinFORange = distFromFO !== null && distFromFO <= PROXIMITY_LIMIT_M

  const canProceedStage1 =
    !siError && !locError && !siLoading && !locLoading &&
    (foGps === undefined || foGps === null || withinFORange)

  // ── Form update ────────────────────────────────────────────────────────────

  function upd(sectionKey: string, fieldKey: string, value: number) {
    setForm(prev => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey as keyof AMForm] as SISection), [fieldKey]: value },
    }))
  }

  // ── Photo handlers ─────────────────────────────────────────────────────────

  function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const remaining = MAX_PHOTOS - sitePhotos.length
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        setSitePhotos(prev => [...prev, { id: ++photoIdRef.current, dataUrl: reader.result as string, file }])
      }
      reader.readAsDataURL(file)
    })
  }

  function handleCameraSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || sitePhotos.length >= MAX_PHOTOS) return
    const reader = new FileReader()
    reader.onload = () => {
      setSitePhotos(prev => [...prev, { id: ++photoIdRef.current, dataUrl: reader.result as string, file }])
    }
    reader.readAsDataURL(file)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!id) return

    if (sitePhotos.length < 5) {
      setSubmitError('At least 5 site photos are required before submitting.')
      return
    }
    if (siteVideos.length < 1) {
      setSubmitError('At least 1 site video is required before submitting.')
      return
    }

    // Validate all fields in all sections
    const allMissing: string[] = []
    for (const sec of FORM_SECTIONS) {
      const sectionData = form[sec.key as keyof AMForm] as SISection
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
      const { remarks, ...sections } = form

      // 1. Update AM submission with sections + GPS
      await siteInspectionsService.updateAreaManager(id, {
        ...sections,
        ...(remarks.trim() ? { remarks } : {}),
        ...(userLat !== null && userLon !== null ? { latitude: userLat, longitude: userLon } : {}),
      })

      // 2. Upload presence + site photos
      const photoFiles: File[] = []
      if (photo) {
        try {
          const res = await fetch(photo.dataUrl)
          const blob = await res.blob()
          photoFiles.push(new File([blob], 'presence.jpg', { type: 'image/jpeg' }))
        } catch { /* non-fatal */ }
      }
      photoFiles.push(...sitePhotos.map(p => p.file))
      if (photoFiles.length > 0) {
        try {
          await siteInspectionsService.addAreaManagerPhotos(id, photoFiles)
        } catch { /* non-fatal */ }
      }

      // 3. Upload videos
      if (siteVideos.length > 0) {
        try {
          await siteInspectionsService.addAreaManagerVideos(id, siteVideos)
        } catch { /* non-fatal */ }
      }

      // 4. Submit
      await siteInspectionsService.submitAreaManager(id)

      navigate('/site-inspections')
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (siLoading) return (
    <div className="page">
      <div className="state-box"><span className="spinner" /><span className="state-box-text">Loading…</span></div>
    </div>
  )

  if (siError || !si) return (
    <div className="page">
      <div className="state-box">
        <span className="state-box-icon">!</span>
        <p className="state-box-text">{siError ?? 'Site inspection not found.'}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/site-inspections')}>Back</button>
      </div>
    </div>
  )

  const store = typeof si.store === 'object' ? si.store as SIPopulatedStore : null

  // ── Stage 1: Location ──────────────────────────────────────────────────────

  function renderStage1() {
    return (
      <div className="amf-section">
        <h2 className="amf-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Verify Your Location
        </h2>

        {store && (
          <div className="amf-store-card">
            <div className="amf-store-name">{store.name}</div>
            <div className="amf-store-meta">{store.city}, {store.state}{store.erpCode ? ` · ${store.erpCode}` : ''}</div>
          </div>
        )}

        {locLoading && (
          <div className="lv-status"><span className="spinner" /> Getting your location…</div>
        )}

        {!locLoading && locError && (
          <div className="lv-notice lv-notice-error">{locError}</div>
        )}

        {!locLoading && !locError && userLat !== null && (
          <div className="lv-notice lv-notice-info">
            Your GPS: {userLat.toFixed(6)}, {userLon!.toFixed(6)}
          </div>
        )}

        {/* Show distance to FO-recorded GPS */}
        {foGps && !locLoading && !locError && distFromFO !== null && (
          withinFORange ? (
            <div className="lv-notice si-notice-ok">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {fmtDist(distFromFO)} from franchise owner's recorded location — within 100m limit.
            </div>
          ) : (
            <div className="lv-notice lv-notice-error">
              You are {fmtDist(distFromFO)} from the franchise owner's recorded location. Must be within 100m.
            </div>
          )
        )}

        {foGps === undefined || foGps === null ? (
          <div className="lv-notice lv-notice-warn">No franchise GPS recorded — location check skipped.</div>
        ) : null}

        <div className="amf-nav">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canProceedStage1}
            onClick={() => setStage(2)}
          >
            Next — Take Photo
          </button>
        </div>
      </div>
    )
  }

  // ── Stage 2: Photo ─────────────────────────────────────────────────────────

  function renderStage2() {
    return (
      <div className="amf-section">
        <h2 className="amf-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Log Your Presence
        </h2>
        <p className="lv-hint">Take a photo to confirm you are at the site.</p>
        <CameraCapture onCapture={img => setPhoto(img)} />
        <div className="amf-nav amf-nav-row">
          <button type="button" className="btn btn-ghost" onClick={() => setStage(1)}>Back</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!photo}
            onClick={() => { setSectionStep(0); setStage(3) }}
          >
            Next — Fill Form
          </button>
        </div>
      </div>
    )
  }

  // ── Stage 3: Form ──────────────────────────────────────────────────────────

  function renderStage3() {
    const isCommentsStep = sectionStep === FORM_SECTIONS.length
    const section    = isCommentsStep ? null : FORM_SECTIONS[sectionStep]
    const sectionKey = section ? section.key as keyof AMForm : null

    return (
      <div className="amf-section">
        <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleGallerySelect} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCameraSelect} />

        <div className="amf-form-header">
          <h2 className="amf-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            {isCommentsStep ? 'Comments & Photos' : section!.label}
          </h2>
          <div className="amf-dots">
            {Array.from({ length: FORM_SECTIONS.length + 1 }).map((_, i) => (
              <div key={i} className={`amf-dot${i === sectionStep ? ' amf-dot-active' : i < sectionStep ? ' amf-dot-done' : ''}`} />
            ))}
          </div>
          <p className="amf-step-hint">Section {sectionStep + 1} of {FORM_SECTIONS.length + 1}</p>
        </div>

        {!isCommentsStep && (
          <>
            <p className="lv-hint">Rate each item from 1 (poor) to 5 (excellent). All items are required.</p>
            <div className="amf-form-body">
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
            <div className="amf-remarks-wrap">
              <label className="form-label">Overall Remarks</label>
              <textarea
                className="form-input amf-remarks"
                placeholder="Any overall observations about the site…"
                rows={4}
                value={form.remarks}
                onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>

            <div className="amf-photos-section">
              <div className="amf-photos-header">
                <span className="amf-photos-label">Site Photos <span className="as-req">*</span></span>
                <span className="amf-photos-count">{sitePhotos.length} / {MAX_PHOTOS}</span>
              </div>
              <p className="si-photos-hint">Minimum 5 photos required.</p>
              {sitePhotos.length > 0 && (
                <div className="amf-photos-grid">
                  {sitePhotos.map(p => (
                    <div key={p.id} className="amf-photo-thumb">
                      <img src={p.dataUrl} alt="Site" />
                      <button
                        type="button"
                        className="amf-photo-remove"
                        onClick={() => setSitePhotos(prev => prev.filter(x => x.id !== p.id))}
                        aria-label="Remove"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {sitePhotos.length < MAX_PHOTOS && (
                <div className="amf-photos-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => galleryRef.current?.click()}>From Gallery</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => cameraRef.current?.click()}>Take Photo</button>
                </div>
              )}
            </div>

            <div className="amf-photos-section">
              <div className="amf-photos-header">
                <span className="amf-photos-label">Site Videos <span className="as-req">*</span></span>
                <span className="amf-photos-count">{siteVideos.length} / 10</span>
              </div>
              <p className="si-photos-hint">Minimum 1 video required.</p>
              <VideoCapture onChange={setSiteVideos} maxVideos={10} />
            </div>
          </>
        )}

        {sectionError && <p className="error" style={{ marginTop: '1rem' }}>{sectionError}</p>}
        {submitError && <p className="error" style={{ marginTop: '1rem' }}>{submitError}</p>}

        <div className="amf-nav amf-nav-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSectionError(null)
              sectionStep === 0 ? setStage(2) : setSectionStep(s => s - 1)
            }}
          >Back</button>
          {sectionStep < FORM_SECTIONS.length ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={(() => {
                if (sectionStep >= FORM_SECTIONS.length) return false
                const sec = FORM_SECTIONS[sectionStep]
                const secData = form[sec.key as keyof AMForm] as SISection
                return sec.fields.some(f => !secData[f.key])
              })()}
              onClick={() => {
                if (sectionStep < FORM_SECTIONS.length) {
                  const sec = FORM_SECTIONS[sectionStep]
                  const secData = form[sec.key as keyof AMForm] as SISection
                  const missing = sec.fields
                    .filter(f => !secData[f.key])
                    .map(f => f.label)
                  if (missing.length > 0) {
                    setSectionError(`Please rate all items: ${missing.join(', ')}`)
                    return
                  }
                }
                setSectionError(null)
                setSectionStep(s => s + 1)
              }}
            >
              Next — {sectionStep === FORM_SECTIONS.length - 1 ? 'Comments & Photos' : FORM_SECTIONS[sectionStep + 1].label}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={submitting || sitePhotos.length < 5 || siteVideos.length < 1} onClick={handleSubmit}>
              {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit AM Review'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="amf-page">
      <div className="amf-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/site-inspections')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h1 className="page-title">Area Manager Review</h1>
        <p className="amf-header-sub">
          {store ? store.name : 'Unknown Store'}
          {' · '}
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <StageBar current={stage} />

      <div className="amf-body">
        {stage === 1 && renderStage1()}
        {stage === 2 && renderStage2()}
        {stage === 3 && renderStage3()}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  siteInspectionsService,
  type SiteInspection,
  type SISection,
  type SIPopulatedStore,
  type SIPopulatedUser,
} from '../services/site-inspections.service'
import './SiteInspectionOpsForm.css'

// ── Form sections ──────────────────────────────────────────────────────────────

interface SectionDef { key: string; label: string; fields: { key: string; label: string }[] }

const FORM_SECTIONS: SectionDef[] = [
  { key: 'locationAndCatchment', label: 'Location & Catchment', fields: [
    { key: 'highResidentialDensity',             label: 'High Residential Density' },
    { key: 'nearbyHospitalsClinicsNursingHomes', label: 'Nearby Hospitals / Clinics / Nursing Homes' },
    { key: 'doctorClinicsWithin300m',            label: 'Doctor Clinics Within 300m' },
    { key: 'elderlyFamilyPopulation',            label: 'Elderly / Family Population' },
    { key: 'strongWalkInPotential',              label: 'Strong Walk-In Potential' },
    { key: 'competitorsWithin500m',              label: 'Competitors Within 500m' },
  ]},
  { key: 'visibilityAndAccessibility', label: 'Visibility & Accessibility', fields: [
    { key: 'groundFloorLocation',         label: 'Ground Floor Location' },
    { key: 'roadFacingShop',              label: 'Road Facing Shop' },
    { key: 'visibleSignageOpportunity',   label: 'Visible Signage Opportunity' },
    { key: 'highPedestrianFootfall',      label: 'High Pedestrian Footfall' },
    { key: 'easyEntryExit',               label: 'Easy Entry / Exit' },
    { key: 'closeToMainRoad',             label: 'Close to Main Road' },
    { key: 'accessibleForSeniorCitizens', label: 'Accessible for Senior Citizens' },
    { key: 'noObstructions',              label: 'No Obstructions' },
  ]},
  { key: 'shopSpecifications', label: 'Shop Specifications', fields: [
    { key: 'minimumCarpetArea',        label: 'Minimum Carpet Area' },
    { key: 'properFrontageWidth',      label: 'Proper Frontage Width' },
    { key: 'rectangularLayout',        label: 'Rectangular Layout' },
    { key: 'adequateStorageSpace',     label: 'Adequate Storage Space' },
    { key: 'properVentilation',        label: 'Proper Ventilation' },
    { key: 'electricalLoadSufficient', label: 'Electrical Load Sufficient' },
  ]},
  { key: 'legalAndCompliance', label: 'Legal & Compliance', fields: [
    { key: 'commercialUsagePermitted',   label: 'Commercial Usage Permitted' },
    { key: 'tradeLicenseFeasible',       label: 'Trade License Feasible' },
    { key: 'drugLicenseFeasible',        label: 'Drug License Feasible' },
    { key: 'fireSafetyNorms',            label: 'Fire Safety Norms' },
    { key: 'noSealingDisputeHistory',    label: 'No Sealing / Dispute History' },
    { key: 'clearOwnershipDocuments',    label: 'Clear Ownership Documents' },
    { key: 'municipalApprovalAvailable', label: 'Municipal Approval Available' },
    { key: 'taxUpdated',                 label: 'Tax Updated' },
  ]},
  { key: 'powerWaterInfrastructure', label: 'Power, Water & Infrastructure', fields: [
    { key: 'electricity24x7',          label: '24×7 Electricity' },
    { key: 'ceilingWallCondition',     label: 'Ceiling / Wall Condition' },
    { key: 'buildingCondition',        label: 'Building Condition' },
    { key: 'inverterDgBackupFeasible', label: 'Inverter / DG Backup Feasible' },
    { key: 'waterSupply',              label: 'Water Supply' },
    { key: 'drainageFacility',         label: 'Drainage Facility' },
    { key: 'internetAvailability',     label: 'Internet Availability' },
  ]},
  { key: 'competitionAnalysis', label: 'Competition Analysis', fields: [
    { key: 'pharmaciesWithin100m',     label: 'Pharmacies Within 100m' },
    { key: 'dailyMarketNearby',        label: 'Daily Market Nearby' },
    { key: 'doctorClinicsNearby',      label: 'Doctor Clinics Nearby' },
    { key: 'competitorTypeAndCount',   label: 'Competitor Type & Count' },
    { key: 'competitorOperatingHours', label: 'Competitor Operating Hours' },
    { key: 'competitorAverageSales',   label: 'Competitor Average Sales' },
    { key: 'priceCompetitiveness',     label: 'Price Competitiveness' },
    { key: 'uspOpportunity',           label: 'USP Opportunity' },
  ]},
  { key: 'commercialsAndFinancials', label: 'Commercials & Financials', fields: [
    { key: 'rentWithinBudget',           label: 'Rent Within Budget' },
    { key: 'securityDepositReasonable',  label: 'Security Deposit Reasonable' },
    { key: 'leaseTenureMinimum5Year',    label: 'Lease Tenure ≥ 5 Years' },
    { key: 'lockInPeriodAcceptable',     label: 'Lock-In Period Acceptable' },
    { key: 'rentEscalationAcceptable',   label: 'Rent Escalation Acceptable' },
    { key: 'roiFeasibility18to24Months', label: 'ROI Feasibility (18–24 Months)' },
  ]},
  { key: 'safetyAndSecurity', label: 'Safety & Security', fields: [
    { key: 'safeNeighborhood',         label: 'Safe Neighbourhood' },
    { key: 'lowTheftRisk',             label: 'Low Theft Risk' },
    { key: 'shutterLockProvision',     label: 'Shutter / Lock Provision' },
    { key: 'cctvInstallationPossible', label: 'CCTV Installation Possible' },
    { key: 'nightOperationFeasible',   label: 'Night Operation Feasible' },
  ]},
  { key: 'parkingAndLogistics', label: 'Parking & Logistics', fields: [
    { key: 'twoWheelerParkingAvailable',    label: 'Two-Wheeler Parking Available' },
    { key: 'ambulancePatientVehicleAccess', label: 'Ambulance / Patient Vehicle Access' },
    { key: 'deliveryRiderParkingFeasible',  label: 'Delivery Rider Parking Feasible' },
    { key: 'stockDeliveryVehicleAccess',    label: 'Stock Delivery Vehicle Access' },
  ]},
  { key: 'growthAndExpansionPotential', label: 'Growth & Expansion Potential', fields: [
    { key: 'scopeForFutureExpansion',          label: 'Scope for Future Expansion' },
    { key: 'increasingResidentialDevelopment', label: 'Increasing Residential Development' },
    { key: 'upcomingHospitalsClinicsNearby',   label: 'Upcoming Hospitals / Clinics Nearby' },
    { key: 'areaGrowthTrendPositive',          label: 'Area Growth Trend Positive' },
  ]},
]

// ── Types ──────────────────────────────────────────────────────────────────────

type OpsForm = Record<string, SISection>

function initOpsForm(): OpsForm {
  return Object.fromEntries(FORM_SECTIONS.map(s => [s.key, {}]))
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSectionRating(sections: Record<string, SISection> | undefined, key: string, field: string): number | undefined {
  return (sections as any)?.[key]?.[field]
}

function hasSectionData(sub: Record<string, any> | undefined, sectionKey: string): boolean {
  const section = sub?.[sectionKey]
  if (!section) return false
  return Object.values(section).some(v => typeof v === 'number' && (v as number) >= 1 && (v as number) <= 5)
}

function userName(u: SIPopulatedUser | string | undefined): string {
  if (!u) return '—'
  return typeof u === 'object' ? u.name : u
}

function RatingDisplay({ value }: { value?: number }) {
  if (!value) return <span className="ops-rating-empty">—</span>
  return <span className="ops-rating-val">{value}</span>
}

function RatingButtons({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="ops-rating-btns">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`ops-rating-btn${value === n ? ' ops-rating-active' : ''}`}
          onClick={() => onChange(n)}
        >{n}</button>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SiteInspectionOpsForm() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [si,        setSi]        = useState<SiteInspection | null>(null)
  const [siLoading, setSiLoading] = useState(true)
  const [siError,   setSiError]   = useState<string | null>(null)

  const [form,        setForm]        = useState<OpsForm>(initOpsForm())
  const [remarks,     setRemarks]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Load SI ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    siteInspectionsService.getOne(id)
      .then(data => {
        if (data.stage !== 'pending_ops') {
          setSiError(`This site inspection is not in 'pending_ops' stage (current: ${data.stage}).`)
        } else {
          setSi(data)
          // Pre-fill ops form with existing data if any
          if (data.operationsSubmission) {
            const pre: OpsForm = {}
            for (const sec of FORM_SECTIONS) {
              pre[sec.key] = ((data.operationsSubmission as any)[sec.key] as SISection) ?? {}
            }
            setForm(pre)
            setRemarks(data.operationsSubmission.remarks ?? '')
          }
        }
      })
      .catch(err => setSiError(err?.message ?? 'Failed to load site inspection.'))
      .finally(() => setSiLoading(false))
  }, [id])

  // ── Form update ────────────────────────────────────────────────────────────

  function upd(sectionKey: string, fieldKey: string, value: number) {
    setForm(prev => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [fieldKey]: value },
    }))
  }

  function copySection(sectionKey: string, source: Record<string, any> | undefined) {
    const section = source?.[sectionKey]
    if (!section) return
    const copied: SISection = {}
    for (const [k, v] of Object.entries(section)) {
      if (typeof v === 'number' && v >= 1 && v <= 5) copied[k] = v
    }
    setForm(prev => ({ ...prev, [sectionKey]: copied }))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!id) return
    // Validate all fields in all sections
    const allMissing: string[] = []
    for (const sec of FORM_SECTIONS) {
      for (const f of sec.fields) {
        if (!form[sec.key]?.[f.key]) {
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
      await siteInspectionsService.updateOperations(id, {
        ...form,
        ...(remarks.trim() ? { remarks } : {}),
      })
      await siteInspectionsService.submitOperations(id)
      navigate('/site-inspections')
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / error ────────────────────────────────────────────────────────

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

  const store   = typeof si.store === 'object' ? si.store as SIPopulatedStore : null
  const amSkipped = !!si.amSkippedBy
  const foSubs  = si.franchiseSubmission
  const amSubs  = si.areaManagerSubmission

  const foUser  = typeof foSubs?.submittedBy === 'object' ? foSubs.submittedBy as SIPopulatedUser : undefined
  const amUser  = typeof amSubs?.submittedBy === 'object' ? amSubs.submittedBy as SIPopulatedUser : undefined

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ops-page">
      <div className="ops-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/site-inspections')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h1 className="page-title">Operations Review</h1>
        {store && (
          <p className="ops-header-sub">
            {store.name}
            {store.erpCode ? ` · ${store.erpCode}` : ''}
            {' · '}{store.type}
          </p>
        )}
      </div>

      {/* Reviewer legend */}
      <div className="ops-legend">
        <div className="ops-legend-item">
          <span className="ops-legend-dot ops-dot-fo" />
          <span>FO: {foSubs ? userName(foUser) : '—'}</span>
        </div>
        <div className="ops-legend-item">
          <span className="ops-legend-dot ops-dot-am" />
          <span>AM: {amSkipped ? 'Skipped' : amSubs ? userName(amUser) : '—'}</span>
        </div>
        <div className="ops-legend-item">
          <span className="ops-legend-dot ops-dot-ops" />
          <span>Ops (you)</span>
        </div>
      </div>

      {/* Sections */}
      {FORM_SECTIONS.map(sec => (
        <div key={sec.key} className="ops-section-card">
          <div className="ops-section-head">
            <span className="ops-section-title">{sec.label}</span>
            <div className="ops-copy-btns">
              {hasSectionData(foSubs as any, sec.key) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm ops-copy-btn"
                  onClick={() => copySection(sec.key, foSubs as any)}
                >
                  Copy from FO
                </button>
              )}
              {!amSkipped && hasSectionData(amSubs as any, sec.key) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm ops-copy-btn"
                  onClick={() => copySection(sec.key, amSubs as any)}
                >
                  Copy from AM
                </button>
              )}
            </div>
          </div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th className="ops-th-field">Item</th>
                  <th className="ops-th-fo">FO</th>
                  <th className="ops-th-am">AM</th>
                  <th className="ops-th-ops">Ops Rating</th>
                </tr>
              </thead>
              <tbody>
                {sec.fields.map(f => {
                  const foVal  = getSectionRating(foSubs as any, sec.key, f.key)
                  const amVal  = amSkipped ? undefined : getSectionRating(amSubs as any, sec.key, f.key)
                  const opsVal = form[sec.key]?.[f.key]
                  return (
                    <tr key={f.key}>
                      <td className="ops-td-field">{f.label}</td>
                      <td className="ops-td-fo"><RatingDisplay value={foVal} /></td>
                      <td className="ops-td-am">
                        {amSkipped
                          ? <span className="ops-skipped">Skip</span>
                          : <RatingDisplay value={amVal} />
                        }
                      </td>
                      <td className="ops-td-ops">
                        <RatingButtons value={opsVal} onChange={v => upd(sec.key, f.key, v)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Remarks */}
      <div className="ops-remarks-section">
        <label className="form-label">Overall Remarks (optional)</label>
        <textarea
          className="form-input ops-remarks"
          placeholder="Any overall observations or notes…"
          rows={4}
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
        />
      </div>

      {submitError && <p className="error" style={{ marginTop: '1rem' }}>{submitError}</p>}

      <div className="ops-submit-bar">
        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting || FORM_SECTIONS.some(sec => sec.fields.some(f => !form[sec.key]?.[f.key]))}
          onClick={handleSubmit}
        >
          {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit Ops Review'}
        </button>
      </div>
    </div>
  )
}
